#!/usr/bin/env python3
"""Deterministic offline layered-painted 2D actor-pose prototype.

Candidate A for Realm Engine v2 RFC 0002.  Painted component concepts own
texture and silhouette.  JSON pose sources own root, feet, sockets, phase, and
occlusion.  The only runtime-facing artifacts are ordinary 512x84 RGBA rows
and optional synchronized rear/body/front layer strips.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import io
import json
import math
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

from PIL import Image, ImageDraw


FRAME_W = 64
FRAME_H = 84
FRAMES = 8
ROW_W = FRAME_W * FRAMES
DIRECTIONS = ("down", "up", "left", "right")
SEMANTIC_LAYERS = (
    "rear_equipment",
    "far_leg",
    "far_arm",
    "torso",
    "garment",
    "near_leg",
    "head",
    "headgear",
    "load",
    "near_arm",
    "tool",
    "corrective",
)
RUNTIME_LAYER_GROUPS = {
    "rear": ("rear_equipment", "far_leg", "far_arm"),
    "body": ("torso", "garment", "near_leg", "head", "headgear"),
    "front": ("load", "near_arm", "tool", "corrective"),
}
SOURCE_FILENAMES = (
    "visual-dna.json",
    "garment-kits.json",
    "action-clips.json",
    "views-occlusion.json",
    "attachments.json",
    "concept-references.json",
)
REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SOURCE_DIR = (
    REPO_ROOT / "assets/sprites/prototypes/actor-pose/source/layered2d"
)
DEFAULT_OUT_DIR = (
    REPO_ROOT / "assets/sprites/prototypes/actor-pose/output/a-layered2d"
)


class PrototypeError(RuntimeError):
    """A deterministic source or acceptance failure."""


@dataclass(frozen=True)
class Sources:
    source_dir: Path
    visual_dna: dict[str, Any]
    garments: dict[str, Any]
    actions: dict[str, Any]
    views: dict[str, Any]
    attachments: dict[str, Any]
    concepts: dict[str, Any]
    source_files: dict[str, dict[str, Any]]
    source_hash: str
    compiler_hash: str
    input_hash: str


@dataclass
class RenderedFrame:
    flattened: Image.Image
    runtime_layers: dict[str, Image.Image]
    body_mask: Image.Image
    sockets: dict[str, Any]


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def canonical_json(value: Any) -> bytes:
    return (
        json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
        .encode("utf-8")
    )


def aggregate_hash(items: Iterable[tuple[str, str]]) -> str:
    digest = hashlib.sha256()
    for name, item_hash in sorted(items):
        digest.update(name.encode("utf-8"))
        digest.update(b"\0")
        digest.update(item_hash.encode("ascii"))
        digest.update(b"\n")
    return digest.hexdigest()


def read_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise PrototypeError(f"cannot read valid JSON source {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise PrototypeError(f"source must contain a JSON object: {path}")
    return value


def load_sources(source_dir: Path) -> Sources:
    documents: dict[str, dict[str, Any]] = {}
    source_files: dict[str, dict[str, Any]] = {}
    for filename in SOURCE_FILENAMES:
        path = source_dir / filename
        data = path.read_bytes()
        documents[filename] = read_json(path)
        source_files[f"source/{filename}"] = {
            "sha256": sha256_bytes(data),
            "bytes": len(data),
            "responsibility": filename.removesuffix(".json"),
        }

    schemas = {
        "visual-dna.json": "realm.actor-pose.visual-dna.v1",
        "garment-kits.json": "realm.actor-pose.garment-kit.v1",
        "action-clips.json": "realm.actor-pose.action-clips.v1",
        "views-occlusion.json": "realm.actor-pose.views-occlusion.v1",
        "attachments.json": "realm.actor-pose.attachments.v1",
        "concept-references.json": "realm.actor-pose.concept-references.v1",
    }
    for filename, schema in schemas.items():
        if documents[filename].get("schema") != schema:
            raise PrototypeError(f"{filename}: expected schema {schema}")

    assignments = documents["action-clips.json"].get("assignments")
    if assignments != {
        "guard": ["walk", "carry"],
        "builder": ["walk", "work"],
    }:
        raise PrototypeError("action assignments must exactly match the bounded RFC")
    roles = set(assignments)
    if set(documents["visual-dna.json"].get("roles", {})) != roles:
        raise PrototypeError("VisualDNA roles must exactly match action assignments")
    if set(documents["garment-kits.json"].get("kits", {})) != roles:
        raise PrototypeError("GarmentKit roles must exactly match action assignments")
    if set(documents["concept-references.json"].get("references", {})) != roles:
        raise PrototypeError("painted concept roles must exactly match action assignments")

    attachment_document = documents["attachments.json"]
    attachment_sets = attachment_document.get("sets", {})
    if set(attachment_sets) != roles:
        raise PrototypeError("AttachmentSet roles must exactly match action assignments")
    referenced_attachments: set[str] = set()
    for role, actions in assignments.items():
        role_sets = attachment_sets.get(role, {})
        if set(role_sets) != set(actions):
            raise PrototypeError(f"{role}: attachment actions do not match clips")
        for action in actions:
            names = role_sets[action]
            if not isinstance(names, list) or len(names) != len(set(names)):
                raise PrototypeError(f"{role}/{action}: invalid attachment membership")
            for name in names:
                definition = attachment_document.get("attachments", {}).get(name)
                if not isinstance(definition, dict):
                    raise PrototypeError(f"{role}/{action}: unknown attachment {name}")
                if definition.get("owner") != role:
                    raise PrototypeError(f"{name}: attachment owner does not match {role}")
                anchor = definition.get("painted_anchor")
                if not isinstance(anchor, list) or len(anchor) != 2:
                    raise PrototypeError(f"{name}: painted anchor must be a 2D point")
                referenced_attachments.add(name)
    if referenced_attachments != set(attachment_document.get("attachments", {})):
        raise PrototypeError("every attachment definition must be used by the bounded pilot")

    views = documents["views-occlusion.json"].get("views", {})
    if tuple(views) != DIRECTIONS:
        raise PrototypeError(f"view order must be {DIRECTIONS}")
    for direction, view in views.items():
        derived_from = view.get("derived_from")
        if derived_from is not None:
            if (
                direction != "right"
                or derived_from != "left"
                or view.get("transform") != "mirror-x"
                or view.get("mirror_x") is not True
            ):
                raise PrototypeError(
                    f"{direction}: unsupported derived-view declaration"
                )
            continue
        if tuple(view.get("z_order", ())) != tuple(dict.fromkeys(view["z_order"])):
            raise PrototypeError(f"{direction}: z-order contains duplicates")
        if set(view.get("z_order", ())) != set(SEMANTIC_LAYERS):
            raise PrototypeError(f"{direction}: z-order must name every semantic layer")
        group_sequence: list[str] = []
        for layer in view["z_order"]:
            group = next(
                name for name, members in RUNTIME_LAYER_GROUPS.items() if layer in members
            )
            if not group_sequence or group_sequence[-1] != group:
                group_sequence.append(group)
        if group_sequence != ["rear", "body", "front"]:
            raise PrototypeError(
                f"{direction}: z-order cannot be reproduced by rear/body/front strips"
            )
        required_anchors = {
            "root",
            "head",
            "left_shoulder",
            "right_shoulder",
            "left_hip",
            "right_hip",
            "left_foot",
            "right_foot",
        }
        if set(view.get("anchors", {})) != required_anchors:
            raise PrototypeError(f"{direction}: incomplete explicit view anchors")

    concept_doc = documents["concept-references.json"]
    for role, reference in concept_doc.get("references", {}).items():
        path = REPO_ROOT / reference["path"]
        data = path.read_bytes()
        actual = sha256_bytes(data)
        if actual != reference["sha256"]:
            raise PrototypeError(
                f"{role}: painted concept hash mismatch {actual} != "
                f"{reference['sha256']}"
            )
        source_files[f"concept/{role}"] = {
            "path": reference["path"],
            "sha256": actual,
            "bytes": len(data),
            "responsibility": "painted-texture-palette-silhouette-only",
        }

    compiler_data = Path(__file__).read_bytes()
    compiler_hash = sha256_bytes(compiler_data)
    source_hash = aggregate_hash(
        (name, record["sha256"]) for name, record in source_files.items()
    )
    input_hash = aggregate_hash(
        (("source_hash", source_hash), ("compiler_hash", compiler_hash))
    )
    return Sources(
        source_dir=source_dir,
        visual_dna=documents["visual-dna.json"],
        garments=documents["garment-kits.json"],
        actions=documents["action-clips.json"],
        views=documents["views-occlusion.json"],
        attachments=documents["attachments.json"],
        concepts=concept_doc,
        source_files=source_files,
        source_hash=source_hash,
        compiler_hash=compiler_hash,
        input_hash=input_hash,
    )


def transparent() -> Image.Image:
    return Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))


def normalize_painted_part(part: Image.Image, target: tuple[int, int]) -> Image.Image:
    """Downsample a clean concept part into stable, warm native pixel clusters."""

    part = part.convert("RGBA").resize(target, Image.Resampling.LANCZOS)
    r, g, b, a = part.split()
    # A fixed 5-bit paint palette keeps the source's warm shading while avoiding
    # sub-pixel color fizz after transforms. Alpha retains soft silhouette edges.
    posterize = lambda value: min(255, ((value + 4) // 8) * 8)
    r = r.point(posterize)
    g = g.point(posterize)
    b = b.point(posterize)
    a = a.point(lambda value: 0 if value < 12 else value)
    return Image.merge("RGBA", (r, g, b, a))


class ConceptLibrary:
    def __init__(self, sources: Sources):
        self.sources = sources
        self.images: dict[str, Image.Image] = {}
        self.parts: dict[tuple[str, str, bool], Image.Image] = {}
        for role, reference in sources.concepts["references"].items():
            self.images[role] = Image.open(REPO_ROOT / reference["path"]).convert("RGBA")

    def part(self, role: str, name: str, mirror: bool = False) -> Image.Image:
        key = (role, name, mirror)
        if key not in self.parts:
            cfg = self.sources.concepts["references"][role]["components"][name]
            cropped = self.images[role].crop(tuple(cfg["crop"]))
            part = normalize_painted_part(cropped, tuple(cfg["target"]))
            if mirror:
                part = part.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
            self.parts[key] = part
        return self.parts[key].copy()


def composite_at(canvas: Image.Image, part: Image.Image, x: int, y: int) -> None:
    canvas.alpha_composite(part, (int(x), int(y)))


def paste_centered(
    canvas: Image.Image, part: Image.Image, center: tuple[int, int], top: int
) -> None:
    composite_at(canvas, part, center[0] - part.width // 2, top)


def oriented_segment(
    part: Image.Image,
    start: tuple[int, int],
    end: tuple[int, int],
    *,
    clip_below_end: bool = False,
    endpoint_color: str | None = None,
) -> Image.Image:
    dx = end[0] - start[0]
    dy = end[1] - start[1]
    distance = max(4, int(round(math.hypot(dx, dy))))
    resized = part.resize((part.width, distance), Image.Resampling.LANCZOS)
    staging = transparent()
    composite_at(staging, resized, start[0] - resized.width // 2, start[1])
    angle = math.degrees(math.atan2(dx, dy))
    oriented = staging.rotate(
        angle,
        resample=Image.Resampling.BICUBIC,
        center=start,
        expand=False,
    )
    if clip_below_end and end[1] + 1 < FRAME_H:
        ImageDraw.Draw(oriented).rectangle(
            (0, end[1] + 1, FRAME_W - 1, FRAME_H - 1),
            fill=(0, 0, 0, 0),
        )
    if endpoint_color:
        ImageDraw.Draw(oriented).line(
            (end[0] - 1, end[1], end[0] + 1, end[1]),
            fill=endpoint_color,
            width=1,
        )
    return oriented


def sprite_about_anchor(
    part: Image.Image,
    painted_anchor: tuple[int, int],
    socket: tuple[int, int],
    angle: float = 0.0,
) -> Image.Image:
    staging = transparent()
    composite_at(
        staging,
        part,
        socket[0] - painted_anchor[0],
        socket[1] - painted_anchor[1],
    )
    if angle:
        staging = staging.rotate(
            angle,
            resample=Image.Resampling.BICUBIC,
            center=socket,
            expand=False,
        )
    return staging


def alpha_over(target: Image.Image, source: Image.Image) -> None:
    target.alpha_composite(source)


def remove_transform_dust(image: Image.Image) -> Image.Image:
    """Drop only sub-review-threshold alpha introduced by part transforms."""

    r, g, b, a = image.split()
    a = a.point(lambda value: 0 if value < 32 else value)
    return Image.merge("RGBA", (r, g, b, a))


def mirror_point_x(point: list[int]) -> list[int]:
    if len(point) != 2:
        raise PrototypeError(f"cannot mirror non-2D socket point: {point}")
    return [FRAME_W - 1 - int(point[0]), int(point[1])]


def mirror_rendered_frame(frame: RenderedFrame) -> RenderedFrame:
    """Derive the right view from the exact same left-view authored beat.

    Horizontal side views have one pose authority. Deriving the opposing view
    removes a second hand-authored chronology/scale surface while retaining
    independent down/up art.
    """

    sockets = copy.deepcopy(frame.sockets)
    for name in ("root", "head", "belt_rear"):
        sockets[name] = mirror_point_x(sockets[name])
    for group in ("feet", "hands"):
        for side in ("left", "right"):
            sockets[group][side] = mirror_point_x(sockets[group][side])
    for name in ("tool", "load"):
        if sockets[name] is not None:
            sockets[name] = mirror_point_x(sockets[name])
    return RenderedFrame(
        flattened=frame.flattened.transpose(Image.Transpose.FLIP_LEFT_RIGHT),
        runtime_layers={
            name: image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
            for name, image in frame.runtime_layers.items()
        },
        body_mask=frame.body_mask.transpose(Image.Transpose.FLIP_LEFT_RIGHT),
        sockets=sockets,
    )


def select_parts(
    library: ConceptLibrary, role: str, direction: str
) -> dict[str, Image.Image]:
    side = direction in ("left", "right")
    mirror = direction == "right"
    head_name = f"head_{'side' if side else direction}"
    torso_name = f"torso_{'side' if side else direction}"
    if side:
        if role == "guard":
            leg_left_name = "leg_side_left"
            leg_right_name = "leg_side_right"
        else:
            leg_left_name = leg_right_name = "leg_side"
        arm_left_name = "arm_side_left"
        arm_right_name = "arm_side_right"
    elif direction == "up" and role == "builder":
        leg_left_name = "leg_up_left"
        leg_right_name = "leg_up_right"
        arm_left_name = "arm_front_left"
        arm_right_name = "arm_front_right"
    else:
        leg_left_name = "leg_front_left"
        leg_right_name = "leg_front_right"
        arm_left_name = "arm_front_left"
        arm_right_name = "arm_front_right"
    return {
        "head": library.part(role, head_name, mirror),
        "torso": library.part(role, torso_name, mirror),
        "left_leg": library.part(role, leg_left_name, mirror),
        "right_leg": library.part(role, leg_right_name, mirror),
        "left_arm": library.part(role, arm_left_name, mirror),
        "right_arm": library.part(role, arm_right_name, mirror),
    }


def mirrored_stride(direction: str, value: int) -> int:
    return -value if direction == "right" else value


def hand_positions(
    role: str,
    action: str,
    direction: str,
    anchors: dict[str, tuple[int, int]],
    beat: dict[str, Any],
) -> tuple[dict[str, tuple[int, int]], tuple[int, int] | None]:
    side = direction in ("left", "right")
    facing_x = -1 if direction == "left" else 1
    arm = int(beat["arm"])
    load_socket: tuple[int, int] | None = None
    if action == "carry":
        cx = 32 + int(beat["load_dx"]) + (facing_x * 2 if side else 0)
        cy = 55 + int(beat["load_dy"])
        load_socket = (cx, cy)
        if side:
            hands = {
                "left": (cx - facing_x * 5, cy - 5),
                "right": (cx + facing_x * 5, cy - 4),
            }
        else:
            hands = {"left": (cx - 9, cy - 5), "right": (cx + 9, cy - 5)}
        return hands, load_socket

    if action == "work":
        angle = math.radians(float(beat["tool_angle"]))
        if side:
            grip = (
                anchors["right_shoulder"][0] + facing_x * (6 + arm // 2),
                45 + arm,
            )
            support = (
                anchors["left_shoulder"][0] + facing_x * 4,
                48 - arm // 2,
            )
        else:
            grip = (40 + int(round(math.cos(angle) * 2)), 45 + arm)
            support = (28, 48 - arm // 2)
        return {"left": support, "right": grip}, None

    if side:
        hands = {
            "left": (
                anchors["left_shoulder"][0] + facing_x * (5 + arm),
                50 + arm // 2,
            ),
            "right": (
                anchors["right_shoulder"][0] + facing_x * (5 - arm),
                50 - arm // 2,
            ),
        }
    else:
        hands = {"left": (21, 49 + arm), "right": (43, 49 - arm)}
    return hands, None


def body_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    alpha = image.getchannel("A").point(lambda value: 255 if value >= 32 else 0)
    return alpha.getbbox()


def rect_list(value: tuple[int, int, int, int] | None) -> list[int] | None:
    return list(value) if value else None


def attachment_anchor(
    sources: Sources, name: str
) -> tuple[int, int]:
    return tuple(sources.attachments["attachments"][name]["painted_anchor"])


def render_frame(
    sources: Sources,
    library: ConceptLibrary,
    role: str,
    action: str,
    direction: str,
    frame_index: int,
) -> RenderedFrame:
    view = sources.views["views"][direction]
    anchors = {name: tuple(point) for name, point in view["anchors"].items()}
    beat = sources.actions["clips"][action]["beats"][frame_index]
    parts = select_parts(library, role, direction)
    layers = {name: transparent() for name in SEMANTIC_LAYERS}

    left_foot = (
        anchors["left_foot"][0]
        + mirrored_stride(direction, int(beat["left_dx"])),
        anchors["left_foot"][1] - int(beat["left_lift"]),
    )
    right_foot = (
        anchors["right_foot"][0]
        + mirrored_stride(direction, int(beat["right_dx"])),
        anchors["right_foot"][1] - int(beat["right_lift"]),
    )
    hands, load_socket = hand_positions(
        role, action, direction, anchors, beat
    )

    far_label = (
        "left" if view["occlusion"]["far_side"] == "actor-left" else "right"
    )
    near_label = "right" if far_label == "left" else "left"
    feet = {"left": left_foot, "right": right_foot}
    hips = {"left": anchors["left_hip"], "right": anchors["right_hip"]}
    boot_color = sources.garments["kits"][role]["palette"]["leather_deep"]

    alpha_over(
        layers["far_leg"],
        oriented_segment(
            parts[f"{far_label}_leg"],
            hips[far_label],
            feet[far_label],
            clip_below_end=True,
            endpoint_color=boot_color,
        ),
    )
    alpha_over(
        layers["near_leg"],
        oriented_segment(
            parts[f"{near_label}_leg"],
            hips[near_label],
            feet[near_label],
            clip_below_end=True,
            endpoint_color=boot_color,
        ),
    )

    torso = parts["torso"]
    torso_top = 29 if role == "guard" else 28
    paste_centered(layers["garment"], torso, anchors["head"], torso_top)
    head = parts["head"]
    head_top = anchors["head"][1] - head.height // 2
    head_layer = "headgear" if role == "guard" else "head"
    paste_centered(layers[head_layer], head, anchors["head"], head_top)

    shoulders = {
        "left": anchors["left_shoulder"],
        "right": anchors["right_shoulder"],
    }
    alpha_over(
        layers["far_arm"],
        oriented_segment(
            parts[f"{far_label}_arm"], shoulders[far_label], hands[far_label]
        ),
    )
    alpha_over(
        layers["near_arm"],
        oriented_segment(
            parts[f"{near_label}_arm"], shoulders[near_label], hands[near_label]
        ),
    )

    side = direction in ("left", "right")
    facing_x = -1 if direction == "left" else 1
    belt_rear = {
        "down": (44, 50),
        "up": (21, 50),
        "left": (38, 50),
        "right": (26, 50),
    }[direction]
    attachment_residuals: dict[str, float] = {}
    tool_socket: tuple[int, int] | None = None
    assigned_attachments = set(
        sources.attachments["sets"][role][action]
    )

    if role == "guard":
        if "guard-sword" in assigned_attachments:
            sword = library.part("guard", "sword")
            sword_anchor = attachment_anchor(sources, "guard-sword")
            sword_angle = {
                "down": -12,
                "up": 12,
                "left": -18,
                "right": 18,
            }[direction]
            alpha_over(
                layers["rear_equipment"],
                sprite_about_anchor(sword, sword_anchor, belt_rear, sword_angle),
            )
            attachment_residuals["guard-sword"] = 0.0
        if "guard-crate" in assigned_attachments:
            if load_socket is None:
                raise PrototypeError("guard carry requires a load socket")
            crate = library.part("guard", "crate")
            crate_anchor = attachment_anchor(sources, "guard-crate")
            alpha_over(
                layers["load"],
                sprite_about_anchor(crate, crate_anchor, load_socket),
            )
            attachment_residuals["guard-crate"] = 0.0
    elif "builder-belt-hammer" in assigned_attachments:
        hammer = library.part("builder", "hammer")
        hammer_anchor = attachment_anchor(sources, "builder-belt-hammer")
        alpha_over(
            layers["rear_equipment"],
            sprite_about_anchor(
                hammer,
                hammer_anchor,
                belt_rear,
                66 * facing_x if side else 72,
            ),
        )
        attachment_residuals["builder-belt-hammer"] = 0.0
    elif "builder-hammer" in assigned_attachments:
        hammer = library.part("builder", "hammer")
        hammer_anchor = attachment_anchor(sources, "builder-hammer")
        grip = hands["right"]
        angle = float(beat["tool_angle"])
        if direction == "right":
            angle = -angle
        alpha_over(
            layers["tool"],
            sprite_about_anchor(hammer, hammer_anchor, grip, angle),
        )
        reach = int(beat["tool_reach"])
        rad = math.radians(angle)
        tool_socket = (
            int(round(grip[0] - math.cos(rad) * reach)),
            int(round(grip[1] + math.sin(rad) * reach)),
        )
        attachment_residuals["builder-hammer"] = 0.0
    if set(attachment_residuals) != assigned_attachments:
        missing = sorted(assigned_attachments - set(attachment_residuals))
        raise PrototypeError(
            f"{role}/{action}: no renderer for assigned attachments {missing}"
        )

    # Bounded native-pixel correctives: stable garment-readable clusters. They
    # never move an outline, root, limb, or socket.
    corrective = ImageDraw.Draw(layers["corrective"])
    if role == "guard":
        badge_x = 29 if direction == "left" else 34 if direction == "right" else 32
        corrective.rectangle(
            (badge_x, 37, badge_x + 1, 39),
            fill=sources.garments["kits"]["guard"]["palette"]["accent"],
        )
    else:
        stitch_x = 29 if direction == "left" else 34 if direction == "right" else 31
        stitch = sources.garments["kits"]["builder"]["palette"]["apron_light"]
        corrective.point((stitch_x, 43), fill=stitch)
        corrective.point((stitch_x, 46), fill=stitch)

    layers = {
        name: remove_transform_dust(image) for name, image in layers.items()
    }
    runtime_layers: dict[str, Image.Image] = {}
    for group, members in RUNTIME_LAYER_GROUPS.items():
        grouped = transparent()
        for layer_name in view["z_order"]:
            if layer_name in members:
                alpha_over(grouped, layers[layer_name])
        runtime_layers[group] = grouped

    recomposed = transparent()
    for group in ("rear", "body", "front"):
        alpha_over(recomposed, runtime_layers[group])
    # Bake the primary from the same synchronized three strips used by the
    # draw-call experiment. This avoids alpha-rounding differences between
    # semantically equivalent grouping orders.
    flattened = recomposed

    body_mask_image = transparent()
    for layer_name in (
        "far_leg",
        "far_arm",
        "torso",
        "garment",
        "near_leg",
        "head",
        "headgear",
        "near_arm",
    ):
        alpha_over(body_mask_image, layers[layer_name])

    beat_name = sources.actions["timeline"]["beat_names"][frame_index]
    contacts = set(beat["contact"])
    socket_metadata: dict[str, Any] = {
        "frame": frame_index,
        "beat": frame_index,
        "beat_name": beat_name,
        "root": list(anchors["root"]),
        "feet": {
            "left": list(left_foot),
            "right": list(right_foot),
            "contacts": {
                "left": "left" in contacts,
                "right": "right" in contacts,
            },
        },
        "head": list(anchors["head"]),
        "hands": {"left": list(hands["left"]), "right": list(hands["right"])},
        "tool": list(tool_socket) if tool_socket else None,
        "load": list(load_socket) if load_socket else None,
        "belt_rear": list(belt_rear),
        "attachments": sorted(attachment_residuals),
        "attachment_residual_px": attachment_residuals,
        "residual_px": 0,
        "z_order": list(view["z_order"]),
    }
    return RenderedFrame(
        flattened=flattened,
        runtime_layers=runtime_layers,
        body_mask=body_mask_image,
        sockets=socket_metadata,
    )


def horizontal_strip(images: list[Image.Image]) -> Image.Image:
    if len(images) != FRAMES:
        raise PrototypeError(f"expected {FRAMES} frames, got {len(images)}")
    row = Image.new("RGBA", (ROW_W, FRAME_H), (0, 0, 0, 0))
    for frame_index, frame in enumerate(images):
        if frame.mode != "RGBA" or frame.size != (FRAME_W, FRAME_H):
            raise PrototypeError("compiler produced an invalid frame")
        row.alpha_composite(frame, (frame_index * FRAME_W, 0))
    return row


def encode_png(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    image.save(
        buffer,
        format="PNG",
        optimize=False,
        compress_level=9,
    )
    return buffer.getvalue()


def edge_pixel_count(image: Image.Image) -> int:
    alpha = image.getchannel("A")
    count = 0
    for y in range(FRAME_H):
        for x in range(FRAME_W):
            if x < 2 or x >= FRAME_W - 2 or y < 2 or y >= FRAME_H - 2:
                if alpha.getpixel((x, y)) >= 32:
                    count += 1
    return count


def row_metrics(frames: list[RenderedFrame]) -> dict[str, Any]:
    body_bounds = [body_bbox(frame.body_mask) for frame in frames]
    full_bounds = [body_bbox(frame.flattened) for frame in frames]
    if any(bounds is None for bounds in body_bounds + full_bounds):
        raise PrototypeError("blank body or frame")
    body_bounds_safe = [bounds for bounds in body_bounds if bounds]
    full_bounds_safe = [bounds for bounds in full_bounds if bounds]
    body_heights = [bounds[3] - bounds[1] for bounds in body_bounds_safe]
    body_widths = [bounds[2] - bounds[0] for bounds in body_bounds_safe]
    body_bottoms = [bounds[3] - 1 for bounds in body_bounds_safe]
    frame_hashes = [sha256_bytes(frame.flattened.tobytes()) for frame in frames]
    return {
        "body_bounds": [rect_list(bounds) for bounds in body_bounds],
        "full_bounds": [rect_list(bounds) for bounds in full_bounds],
        "body_heights": body_heights,
        "body_widths": body_widths,
        "body_height_min": min(body_heights),
        "body_height_max": max(body_heights),
        "body_height_range": max(body_heights) - min(body_heights),
        "body_height_median": sorted(body_heights)[len(body_heights) // 2],
        "body_bottom_min": min(body_bottoms),
        "body_bottom_max": max(body_bottoms),
        "body_bottom_range": max(body_bottoms) - min(body_bottoms),
        "unique_frames": len(set(frame_hashes)),
        "edge_pixels": [edge_pixel_count(frame.flattened) for frame in frames],
        "frame_pixel_hashes": frame_hashes,
    }


def compile_artifacts(
    sources: Sources,
) -> tuple[dict[str, bytes], list[dict[str, Any]], list[str]]:
    library = ConceptLibrary(sources)
    artifacts: dict[str, bytes] = {}
    rows: list[dict[str, Any]] = []
    failures: list[str] = []
    assignments = sources.actions["assignments"]

    for role, actions in assignments.items():
        for action in actions:
            clip = sources.actions["clips"].get(action)
            if not clip or len(clip.get("beats", ())) != FRAMES:
                raise PrototypeError(f"{role}/{action}: clip must have eight beats")
            direction_frames: dict[str, list[RenderedFrame]] = {}
            for direction in DIRECTIONS:
                if direction == "right":
                    frames = [
                        mirror_rendered_frame(frame)
                        for frame in direction_frames["left"]
                    ]
                else:
                    frames = [
                        render_frame(
                            sources, library, role, action, direction, frame_index
                        )
                        for frame_index in range(FRAMES)
                    ]
                direction_frames[direction] = frames
                path = f"rows/{role}/{action}/{direction}.png"
                flattened_row = horizontal_strip(
                    [frame.flattened for frame in frames]
                )
                artifacts[path] = encode_png(flattened_row)
                layer_paths: dict[str, str] = {}
                for group in ("rear", "body", "front"):
                    layer_path = (
                        f"layers/{group}/{role}/{action}-{direction}.png"
                    )
                    artifacts[layer_path] = encode_png(
                        horizontal_strip(
                            [frame.runtime_layers[group] for frame in frames]
                        )
                    )
                    layer_paths[group] = layer_path

                metrics = row_metrics(frames)
                if metrics["body_height_range"] > 2:
                    failures.append(
                        f"{role}/{action}/{direction}: body height range "
                        f"{metrics['body_height_range']} > 2"
                    )
                if metrics["body_bottom_range"] > 1:
                    failures.append(
                        f"{role}/{action}/{direction}: body bottom range "
                        f"{metrics['body_bottom_range']} > 1"
                    )
                if metrics["unique_frames"] != FRAMES:
                    failures.append(
                        f"{role}/{action}/{direction}: only "
                        f"{metrics['unique_frames']} unique frames"
                    )
                if any(metrics["edge_pixels"]):
                    failures.append(
                        f"{role}/{action}/{direction}: art touches two-pixel edge"
                    )
                rows.append(
                    {
                        "artifact_kind": "primary-row",
                        "role": role,
                        "action": action,
                        "direction": direction,
                        "path": path,
                        "layer_paths": layer_paths,
                        "sha256": sha256_bytes(artifacts[path]),
                        "width": ROW_W,
                        "height": FRAME_H,
                        "mode": "RGBA",
                        "frame_width": FRAME_W,
                        "frames": FRAMES,
                        "timeline": "shared-eight-beat-v1",
                        "phase_offset": 0,
                        "root_drift_px": 0,
                        "feet_line_y": 76,
                        "socket_residual_max_px": 0,
                        "metrics": metrics,
                        "sockets": [frame.sockets for frame in frames],
                    }
                )
            for frame_index, (left, right) in enumerate(
                zip(direction_frames["left"], direction_frames["right"])
            ):
                expected = left.flattened.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
                if expected.tobytes() != right.flattened.tobytes():
                    failures.append(
                        f"{role}/{action}: right frame {frame_index} is not the "
                        "exact same-beat mirror of left"
                    )

    for role in assignments:
        medians = [
            row["metrics"]["body_height_median"]
            for row in rows
            if row["role"] == role
        ]
        if max(medians) - min(medians) > 2:
            failures.append(
                f"{role}: cross-action/direction median body-height delta "
                f"{max(medians) - min(medians)} > 2 ({medians})"
            )
    if len(rows) != 16:
        failures.append(f"expected exactly 16 primary rows, got {len(rows)}")
    return artifacts, rows, failures


def artifact_records(artifacts: dict[str, bytes]) -> dict[str, dict[str, Any]]:
    records: dict[str, dict[str, Any]] = {}
    for path, data in sorted(artifacts.items()):
        kind = "primary-row" if path.startswith("rows/") else "layer-strip"
        records[path] = {
            "artifact_kind": kind,
            "sha256": sha256_bytes(data),
            "bytes": len(data),
            "width": ROW_W,
            "height": FRAME_H,
            "mode": "RGBA",
        }
    return records


def output_hash(artifacts: dict[str, bytes]) -> str:
    return aggregate_hash(
        (path, sha256_bytes(data)) for path, data in artifacts.items()
    )


def build_manifest(
    sources: Sources,
    artifacts: dict[str, bytes],
    rows: list[dict[str, Any]],
    failures: list[str],
    deterministic_second_pass: bool,
) -> dict[str, Any]:
    primary_hash = aggregate_hash(
        (row["path"], row["sha256"]) for row in rows
    )
    layer_hash = aggregate_hash(
        (path, sha256_bytes(data))
        for path, data in artifacts.items()
        if path.startswith("layers/")
    )
    outputs = artifact_records(artifacts)
    for row in rows:
        outputs[row["path"]].update(
            {
                "role": row["role"],
                "action": row["action"],
                "direction": row["direction"],
                "frames": row["frames"],
                "timeline": row["timeline"],
                "phase_offset": row["phase_offset"],
                "root_drift_px": row["root_drift_px"],
                "socket_residual_max_px": row["socket_residual_max_px"],
                "metrics": row["metrics"],
                "sockets": row["sockets"],
            }
        )
    return {
        "schema": "realm.actor-pose.bake-manifest.v1",
        "candidate": "a-layered2d",
        "status": "prototype-only",
        "compiler": {
            "path": "scripts/actor-pose-prototype/layered2d.py",
            "sha256": sources.compiler_hash,
            "python": f"{sys.version_info.major}.{sys.version_info.minor}",
            "pillow": Image.__version__,
            "network_required": False,
            "whole_frame_scaling": False,
        },
        "contract": {
            "primary_rows": 16,
            "roles": {"guard": ["walk", "carry"], "builder": ["walk", "work"]},
            "directions": list(DIRECTIONS),
            "frames": FRAMES,
            "frame_size": [FRAME_W, FRAME_H],
            "row_size": [ROW_W, FRAME_H],
            "mode": "RGBA",
            "timeline": "one shared eight-beat timeline per action",
            "runtime": "Canvas2D atlas-only; prototype not registered",
            "runtime_layer_groups": ["rear", "body", "front"],
        },
        "timeline": {
            "authoredBeats": True,
            "frameOrder": list(range(FRAMES)),
            "beats": list(sources.actions["timeline"]["beat_names"]),
            "policy": sources.actions["timeline"]["policy"],
            "crossDirectionPhaseOffset": 0,
        },
        "authority": {
            "visual_dna": (
                "validated identity declaration; arbitrary body swaps are not "
                "implemented by this bounded pilot"
            ),
            "garment_kit": (
                "validated role palette and bounded corrective colors; the "
                "base garment remains baked into painted concept parts"
            ),
            "action_clip": "shared phase, contacts, and in-place motion",
            "view_occlusion": (
                "independent down/up/left anchors and z-order; right is the exact "
                "same-beat horizontal derivation of left"
            ),
            "attachment_set": "action membership, painted anchor, and semantic socket",
            "painted_concepts": "texture, palette, and silhouette only",
            "compiler": "root, feet, head, hands, tool/load sockets, and bake",
        },
        "limitations": [
            (
                "VisualDNA and GarmentKit are validated source contracts, but "
                "the pilot has not demonstrated an arbitrary identity/garment swap."
            ),
            (
                "Identity and the base garment are still co-authored in the "
                "painted torso/head component concepts."
            ),
            (
                "Limbs use single painted segments; paper-doll seams and motion "
                "stiffness still require human beat review."
            ),
            (
                "Cold/incremental bake time, correction time, and live action-turn "
                "transition evidence are not yet recorded."
            ),
        ],
        "sources": {
            "source_hash": sources.source_hash,
            "compiler_hash": sources.compiler_hash,
            "input_hash": sources.input_hash,
            "files": sources.source_files,
        },
        "rows": rows,
        "outputs": outputs,
        "hashes": {
            "primary_rows_hash": primary_hash,
            "layer_strips_hash": layer_hash,
            "output_hash": output_hash(artifacts),
        },
        "verification": {
            "passed": not failures and deterministic_second_pass,
            "failures": failures,
            "byte_deterministic_second_pass": deterministic_second_pass,
            "checks": [
                "exactly-16-primary-rows",
                "exact-512x84-rgba",
                "eight-nonblank-distinct-frames",
                "body-height-range-at-most-2px",
                "body-bottom-range-at-most-1px",
                "cross-view-action-height-delta-at-most-2px",
                "root-drift-zero",
                "shared-beat-phase-zero",
                "right-is-exact-same-beat-mirror-of-left",
                "socket-residual-zero",
                "explicit-view-z-order",
                "no-two-pixel-edge-contact",
                "rear-body-front-recomposes-flattened",
                "hash-pinned-painted-concepts",
            ],
        },
        "reproducibility": {
            "doubleBuildMatched": deterministic_second_pass,
            "networkRequired": False,
            "sourceHash": sources.source_hash,
            "outputHash": output_hash(artifacts),
        },
    }


def write_build(
    out_dir: Path,
    manifest_path: Path,
    artifacts: dict[str, bytes],
    manifest: dict[str, Any],
) -> None:
    for relative, data in sorted(artifacts.items()):
        destination = out_dir / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_bytes(
        json.dumps(manifest, indent=2, sort_keys=True).encode("utf-8") + b"\n"
    )


def verify_disk(
    out_dir: Path,
    manifest_path: Path,
    artifacts: dict[str, bytes],
    manifest: dict[str, Any],
) -> list[str]:
    failures: list[str] = []
    for relative, expected in sorted(artifacts.items()):
        path = out_dir / relative
        if not path.is_file():
            failures.append(f"missing output: {relative}")
            continue
        actual = path.read_bytes()
        if actual != expected:
            failures.append(f"byte mismatch: {relative}")
        try:
            with Image.open(io.BytesIO(actual)) as image:
                if image.mode != "RGBA" or image.size != (ROW_W, FRAME_H):
                    failures.append(
                        f"invalid row contract: {relative} "
                        f"{image.mode} {image.size}"
                    )
        except OSError as exc:
            failures.append(f"invalid PNG {relative}: {exc}")
    expected_manifest = (
        json.dumps(manifest, indent=2, sort_keys=True).encode("utf-8") + b"\n"
    )
    if not manifest_path.is_file() or manifest_path.read_bytes() != expected_manifest:
        failures.append("manifest byte mismatch")
    return failures


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Bake Realm RFC 0002 Candidate A layered-painted 2D rows."
    )
    parser.add_argument(
        "--source-dir",
        type=Path,
        default=DEFAULT_SOURCE_DIR,
        help="Hash-locked layered2d JSON source directory.",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=DEFAULT_OUT_DIR,
        help="Artifact root; rows use rows/<role>/<action>/<dir>.png.",
    )
    parser.add_argument(
        "--manifest",
        type=Path,
        default=None,
        help="Bake manifest path (default: <out-dir>/manifest.json).",
    )
    parser.add_argument(
        "--verify",
        action="store_true",
        help="Compile twice, prove byte determinism, and verify written bytes.",
    )
    args = parser.parse_args()

    source_dir = args.source_dir.resolve()
    out_dir = args.out_dir.resolve()
    manifest_path = (
        args.manifest.resolve()
        if args.manifest
        else (out_dir / "manifest.json").resolve()
    )
    try:
        sources = load_sources(source_dir)
        artifacts, rows, failures = compile_artifacts(sources)
        # A single build cannot establish reproducibility. Keep the manifest
        # explicitly unverified unless the caller requests the clean second
        # compile below.
        deterministic = False
        if args.verify:
            second_artifacts, second_rows, second_failures = compile_artifacts(sources)
            deterministic = (
                artifacts == second_artifacts
                and canonical_json(rows) == canonical_json(second_rows)
                and failures == second_failures
            )
            if not deterministic:
                failures.append("second in-memory compile was not byte deterministic")
        manifest = build_manifest(
            sources, artifacts, rows, failures, deterministic
        )
        if failures:
            for failure in failures:
                print(f"FAIL: {failure}", file=sys.stderr)
            return 1
        write_build(out_dir, manifest_path, artifacts, manifest)
        disk_failures = verify_disk(
            out_dir, manifest_path, artifacts, manifest
        )
        if disk_failures:
            for failure in disk_failures:
                print(f"FAIL: {failure}", file=sys.stderr)
            return 1
        print(
            f"Candidate A OK: {len(rows)} primary rows, "
            f"{len(artifacts) - len(rows)} synchronized layer strips"
        )
        print(f"source hash: {sources.source_hash}")
        print(f"output hash: {manifest['hashes']['output_hash']}")
        print(f"manifest: {manifest_path}")
        return 0
    except (OSError, PrototypeError, KeyError, TypeError, ValueError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
