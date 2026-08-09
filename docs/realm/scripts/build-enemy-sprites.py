#!/usr/bin/env python3
"""Compile Realm's painted three-variant raider family atomically.

Image generation owns only hash-locked modular source boards. This compiler
owns joint-space motion, occlusion, palette reduction, row packing, exact
runtime tiers, proofs, provenance, and release gates. The browser receives
ordinary flattened PNG atlases; there is no live skeletal renderer.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import io
import json
import shutil
import statistics
import sys
import tempfile
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT / "scripts/actor-pose-prototype"))

import a4_guard_family as a4  # noqa: E402
import a5_guard_actions as a5  # noqa: E402
from a2_layered2d import (  # noqa: E402
    A2Error,
    BEATS,
    GROUND_Y,
    H,
    ROW_W,
    W,
    canonical,
    digest,
    png,
    strip,
)
from a3_factorial import (  # noqa: E402
    RUNTIME_STYLE,
    RUNTIME_TIERS,
    apply_runtime_style,
    derive_runtime_palette,
    palette_swatch,
    runtime_row,
)
from sprite_row_quality import analyze_row, write_proof  # noqa: E402


SOURCE = ROOT / "assets/sprites/enemies-source"
OUT = SOURCE / "output"
PARTS_PATH = SOURCE / "parts.json"
VARIANTS = ("ash-reaver", "iron-lancer", "bone-breaker")
ACTIONS = ("idle", "walk", "attack", "retreat")
DIRECTIONS = ("down", "up", "left", "right")
WEAPON_COLORS = {
    "ash-reaver": (197, 71, 60, 255),
    "iron-lancer": (99, 137, 181, 255),
    "bone-breaker": (206, 166, 102, 255),
}
RUNTIME_FILES = {
    "native": "enemies-atlas-native.png",
    "default": "enemies-atlas-default.png",
    "double": "enemies-atlas-double.png",
    "review": "enemies-atlas.png",
}
_SOURCE_PARTS_CACHE: dict[tuple[int, int, str], dict[str, Image.Image]] = {}


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def assert_hash(path: Path, expected: str, label: str) -> None:
    if sha(path) != expected:
        raise A2Error(f"{label} hash changed: {path.relative_to(ROOT)}")


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    return image.getchannel("A").getbbox()


def load_inputs() -> tuple[
    dict[str, Any],
    Image.Image,
    dict[str, Image.Image],
    Image.Image,
    dict[str, Any],
    dict[str, dict[str, Any]],
]:
    contract = json.loads(PARTS_PATH.read_text())
    if contract.get("schema") != "realm.enemy-sprites.raider-family.v1":
        raise A2Error("raider parts contract schema changed")
    scope = contract.get("scope", {})
    if tuple(scope.get("variants", [])) != VARIANTS:
        raise A2Error("raider variant order changed")
    if tuple(scope.get("actions", [])) != ACTIONS:
        raise A2Error("raider action order changed")
    if tuple(scope.get("directions", [])) != DIRECTIONS:
        raise A2Error("raider direction order changed")

    files: dict[str, dict[str, Any]] = {}

    def locked(record: dict[str, Any], label: str) -> Image.Image:
        path = ROOT / record["path"]
        keyed = ROOT / record["keyedPath"]
        assert_hash(path, record["sha256"], label)
        assert_hash(keyed, record["keyedSha256"], f"{label} keyed")
        files[path.relative_to(ROOT).as_posix()] = {
            "sha256": record["sha256"], "owner": label,
        }
        files[keyed.relative_to(ROOT).as_posix()] = {
            "sha256": record["keyedSha256"], "owner": f"{label}-keyed",
        }
        image = Image.open(path).convert("RGBA")
        if image.size != (1536, 1024):
            raise A2Error(f"{label} board must be 1536x1024")
        if set(image.getchannel("A").get_flattened_data()) - {0, 255}:
            raise A2Error(f"{label} source alpha is not binary")
        return image

    identity = locked(contract["identity"], "raider-identity")
    garments = {
        variant: locked(contract["garments"][variant], f"{variant}-garment")
        for variant in VARIANTS
    }
    weapons_record = {
        "path": contract["weapons"]["path"],
        "sha256": contract["weapons"]["sha256"],
        "keyedPath": contract["weapons"]["keyedPath"],
        "keyedSha256": contract["weapons"]["keyedSha256"],
    }
    weapons = locked(weapons_record, "raider-weapons")

    pose_path = ROOT / contract["pose"]["path"]
    assert_hash(pose_path, contract["pose"]["sha256"], "A2 pose authority")
    pose = json.loads(pose_path.read_text())
    if len(pose.get("frames", [])) != BEATS:
        raise A2Error("raider pose authority must contain eight beats")
    files[pose_path.relative_to(ROOT).as_posix()] = {
        "sha256": contract["pose"]["sha256"], "owner": "pose-authority",
    }

    provenance_path = ROOT / contract["provenance"]
    provenance = json.loads(provenance_path.read_text())
    if provenance.get("schema") != "realm.imagegen-source-family.v1":
        raise A2Error("raider imagegen provenance schema changed")
    for source in provenance.get("sources", []):
        assert_hash(ROOT / source["alphaPath"], source["alphaSha256"], source["key"])
        assert_hash(ROOT / source["keyedPath"], source["keyedSha256"], f"{source['key']} keyed")
        reference = source["reference"]
        assert_hash(ROOT / reference["path"], reference["sha256"], f"{source['key']} reference")
    files[provenance_path.relative_to(ROOT).as_posix()] = {
        "sha256": sha(provenance_path), "owner": "imagegen-provenance",
    }
    files[PARTS_PATH.relative_to(ROOT).as_posix()] = {
        "sha256": sha(PARTS_PATH), "owner": "family-contract",
    }
    for script in (
        Path(__file__),
        ROOT / "scripts/actor-pose-prototype/a4_guard_family.py",
        ROOT / "scripts/actor-pose-prototype/a5_guard_actions.py",
        ROOT / "scripts/actor-pose-prototype/a2_layered2d.py",
        ROOT / "scripts/actor-pose-prototype/a3_factorial.py",
        ROOT / "scripts/sprite_row_quality.py",
    ):
        files[script.relative_to(ROOT).as_posix()] = {
            "sha256": sha(script), "owner": "compiler-authority",
        }
    return contract, identity, garments, weapons, pose, files


def validate_crop(image: Image.Image, box: list[int], label: str) -> None:
    if len(box) != 4 or any(type(value) is not int for value in box):
        raise A2Error(f"{label} crop is malformed")
    left, top, right, bottom = box
    if not (0 <= left < right <= image.width and 0 <= top < bottom <= image.height):
        raise A2Error(f"{label} crop is outside its board")
    crop = image.crop(tuple(box))
    bbox = alpha_bbox(crop)
    if bbox is None:
        raise A2Error(f"{label} crop is blank")
    # Generated modular boards can place two independently connected parts in
    # overlapping rectangular lanes. The compositor isolates the largest
    # connected alpha component before trimming, so rectangular margin is not
    # itself an acceptance signal; exact output edge and clipping gates remain
    # strict below.


def isolated_component(
    sheet: Image.Image,
    box: list[int],
    *,
    transform: str = "none",
) -> Image.Image:
    """Keep the largest 8-connected alpha island inside one source crop."""

    crop = sheet.crop(tuple(box)).convert("RGBA")
    width, height = crop.size
    alpha = crop.getchannel("A")
    visible = bytearray(1 if value else 0 for value in alpha.get_flattened_data())
    seen = bytearray(width * height)
    largest: list[int] = []
    for start, value in enumerate(visible):
        if not value or seen[start]:
            continue
        stack = [start]
        seen[start] = 1
        component: list[int] = []
        while stack:
            current = stack.pop()
            component.append(current)
            x = current % width
            y = current // width
            for ny in range(max(0, y - 1), min(height, y + 2)):
                for nx in range(max(0, x - 1), min(width, x + 2)):
                    neighbor = ny * width + nx
                    if visible[neighbor] and not seen[neighbor]:
                        seen[neighbor] = 1
                        stack.append(neighbor)
        if len(component) > len(largest):
            largest = component
    if not largest:
        raise A2Error("isolated source component is blank")
    mask = Image.new("L", crop.size, 0)
    mask_data = bytearray(width * height)
    for index in largest:
        mask_data[index] = 255
    mask.putdata(mask_data)
    isolated = Image.new("RGBA", crop.size, (0, 0, 0, 0))
    isolated.paste(crop, (0, 0), mask)
    isolated = a4.trim(isolated)
    if transform == "flip-x":
        return isolated.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    if transform != "none":
        raise A2Error(f"unsupported component transform: {transform}")
    return isolated


def source_parts_for(
    contract: dict[str, Any],
    identity: Image.Image,
    garment: Image.Image,
    direction: str,
) -> dict[str, Image.Image]:
    cache_key = (id(identity), id(garment), direction)
    cached = _SOURCE_PARTS_CACHE.get(cache_key)
    if cached is not None:
        return cached
    transform = "flip-x" if direction == "right" else "none"
    parts: dict[str, Image.Image] = {}
    for name, box in contract["identity"]["parts"][direction].items():
        parts[f"identity:{name}"] = a4.crop_component(
            identity,
            box,
            transform=transform if direction in ("left", "right") else "none",
        )
    for name, box in contract["garment"]["parts"][direction].items():
        parts[f"garment:{name}"] = isolated_component(
            garment,
            box,
            transform=transform if direction in ("left", "right") else "none",
        )
    _SOURCE_PARTS_CACHE[cache_key] = parts
    return parts


def validate_sources(
    contract: dict[str, Any],
    identity: Image.Image,
    garments: dict[str, Image.Image],
    weapons: Image.Image,
) -> None:
    for direction in DIRECTIONS:
        for name, box in contract["identity"]["parts"][direction].items():
            validate_crop(identity, box, f"identity/{direction}/{name}")
    for variant in VARIANTS:
        for direction in DIRECTIONS:
            for name, box in contract["garments"][variant]["parts"][direction].items():
                validate_crop(garments[variant], box, f"{variant}/{direction}/{name}")
            validate_crop(
                weapons,
                contract["weapons"]["variants"][variant]["parts"][direction],
                f"{variant}/weapon/{direction}",
            )


def refresh_arm_chain(frame: dict[str, Any]) -> None:
    frame["elbows"] = {
        side: [
            round((frame["shoulders"][side][axis] + frame["hands"][side][axis]) / 2)
            for axis in (0, 1)
        ]
        for side in ("near", "far")
    }
    frame["wrists"] = {
        side: [
            round((frame["elbows"][side][axis] + frame["hands"][side][axis]) / 2)
            for axis in (0, 1)
        ]
        for side in ("near", "far")
    }
    frame["sockets"]["right_hand"] = list(frame["hands"]["near"])
    frame["sockets"]["left_hand"] = list(frame["hands"]["far"])


def weapon_vector(action: str, direction: str, index: int) -> list[int]:
    if action == "attack":
        raise A2Error("attack vector must come from the authored A5 strike")
    held = {
        "down": [3, -12], "up": [-3, -12],
        "left": [5, -12], "right": [-5, -12],
    }
    if action == "idle":
        sway = (-1, 0, 1, 1, 0, -1, -1, 0)[index]
        return [held[direction][0] + sway, held[direction][1]]
    if action == "walk":
        sway = (-2, -1, 0, 2, 2, 1, 0, -2)[index]
        return [held[direction][0] + sway, held[direction][1]]
    trailing = {
        "down": [-7, -10], "up": [7, -10],
        "left": [11, -7], "right": [-11, -7],
    }
    return list(trailing[direction])


def action_pose(action: str, direction: str, base: dict[str, Any]) -> dict[str, Any]:
    mapped = "work" if action == "attack" else ("walk" if action == "retreat" else action)
    frame = a5.action_pose(mapped, direction, base)
    if action == "retreat":
        # A hunched sprint and rearward weapon distinguish morale-break flight
        # from the advancing march while preserving the grounded gait order.
        shift = {
            "down": (0, 1), "up": (0, -1),
            "left": (-2, 0), "right": (2, 0),
        }[direction]
        for name in ("head", "torso", "pelvis"):
            frame[name][0] += shift[0]
            frame[name][1] += shift[1]
        for side, arm_back in (("near", -2), ("far", 1)):
            frame["shoulders"][side][0] += shift[0]
            frame["shoulders"][side][1] += shift[1]
            frame["hands"][side][0] -= shift[0] * 2
            frame["hands"][side][1] += arm_back
        frame["phase"] = f"break-{frame['phase']}"
        refresh_arm_chain(frame)
    if action == "attack":
        # The A5 authored strike already carries a directional weapon vector.
        frame["phase"] = f"raid-{frame['phase']}"
    else:
        frame["weapon_vector"] = weapon_vector(action, direction, frame["frame"])
    return frame


def weapon_contract(contract: dict[str, Any], variant: str) -> dict[str, Any]:
    record = contract["weapons"]["variants"][variant]
    return {
        "weapon": {
            "parts": record["parts"],
            "authority": {
                "render_height": record["renderHeight"],
                "hilt_fraction_from_top": record["gripFractionFromTop"],
            },
        }
    }


def quality_for(row_bytes: bytes, action: str, label: str) -> tuple[dict[str, Any], bytes]:
    analyzer_action = "work" if action == "attack" else ("walk" if action == "retreat" else action)
    with tempfile.TemporaryDirectory(prefix="realm-raider-quality-") as temp:
        row_path = Path(temp) / "row.png"
        proof_path = Path(temp) / "proof.png"
        row_path.write_bytes(row_bytes)
        report = analyze_row(row_path, analyzer_action)
        report["path"] = label
        report["raiderAction"] = action
        write_proof(row_path, proof_path, report)
        return report, proof_path.read_bytes()


def gate_row(
    variant: str,
    action: str,
    direction: str,
    frames: list[Image.Image],
    body_frames: list[Image.Image],
    equipment_frames: list[Image.Image],
    landmarks: list[dict[str, Any]],
    quality: dict[str, Any],
    body_quality: dict[str, Any],
) -> dict[str, Any]:
    failures: list[str] = []
    hashes = [digest(frame.tobytes()) for frame in frames]
    body_hashes = [digest(frame.tobytes()) for frame in body_frames]
    if len(set(hashes)) != BEATS:
        failures.append("flattened row lacks eight distinct frames")
    if action != "idle" and len(set(body_hashes)) != BEATS:
        failures.append("active body row lacks eight distinct frames")
    heights: list[int] = []
    widths: list[int] = []
    metrics: list[dict[str, Any]] = []
    for index, (frame, body, equipment, info) in enumerate(
        zip(frames, body_frames, equipment_frames, landmarks)
    ):
        box = alpha_bbox(frame)
        body_box = alpha_bbox(body)
        equipment_box = alpha_bbox(equipment)
        if box is None or body_box is None or equipment_box is None:
            failures.append(f"frame {index} is missing body or weapon")
            continue
        heights.append(body_box[3] - body_box[1])
        widths.append(body_box[2] - body_box[0])
        if body_box[3] - 1 != GROUND_Y:
            failures.append(f"frame {index} body ground is {body_box[3] - 1}, expected {GROUND_Y}")
        if box[0] <= 0 or box[2] >= W or box[1] <= 0 or box[3] > 80:
            failures.append(f"frame {index} enters the reserved edge/ground band")
        if any(frame.getchannel("A").getpixel((x, y)) for y in range(80, H) for x in range(W)):
            failures.append(f"frame {index} occupies clear rows 80-83")
        socket = info["sockets"]["right_hand"]
        alpha = equipment.getchannel("A")
        if not any(
            alpha.getpixel((x, y))
            for y in range(max(0, socket[1] - 2), min(H, socket[1] + 3))
            for x in range(max(0, socket[0] - 2), min(W, socket[0] + 3))
        ):
            failures.append(f"frame {index} weapon leaves its hand socket")
        metrics.append({
            "frame": index,
            "phase": info["phase"],
            "contacts": info["contacts"],
            "bodyBBox": list(body_box),
            "equipmentBBox": list(equipment_box),
            "flattenedBBox": list(box),
            "rightHand": socket,
            "weaponTip": info.get("weapon_tip"),
            "sha256Rgba": hashes[index],
        })
    if heights and max(heights) - min(heights) > 3:
        failures.append(f"body height range is {max(heights) - min(heights)}px")
    if widths and max(widths) - min(widths) > 9:
        failures.append(f"body width range is {max(widths) - min(widths)}px")
    for label, report in (("flattened", quality), ("body", body_quality)):
        failures.extend(f"{label} quality: {item}" for item in report["errors"] + report["warnings"])
        if report.get("styleEra") != "painted":
            failures.append(f"{label} quality is {report.get('styleEra')}, expected painted")
    return {
        "schema": "realm.enemy-sprites.raider-row-gate.v1",
        "scope": {"variant": variant, "action": action, "direction": direction},
        "frameMetrics": metrics,
        "bodyHeights": heights,
        "bodyWidths": widths,
        "mechanicalPassed": not failures,
        "failures": failures,
    }


def build_row(
    contract: dict[str, Any],
    identity: Image.Image,
    garment: Image.Image,
    weapons: Image.Image,
    pose: dict[str, Any],
    variant: str,
    action: str,
    direction: str,
) -> tuple[dict[str, bytes], dict[str, Any], dict[str, Image.Image]]:
    source_contract = {
        "identity": contract["identity"],
        "garment": contract["garments"][variant],
    }
    parts = source_parts_for(source_contract, identity, garment, direction)
    frames: list[Image.Image] = []
    body_frames: list[Image.Image] = []
    equipment_frames: list[Image.Image] = []
    identity_frames: list[Image.Image] = []
    garment_frames: list[Image.Image] = []
    semantic_frames: list[Image.Image] = []
    landmarks: list[dict[str, Any]] = []
    old_color = a5.WEAPON_COLOR
    a5.WEAPON_COLOR = WEAPON_COLORS[variant]
    try:
        for base in pose["frames"]:
            posed = action_pose(action, direction, base)
            result, metadata = a5.compose_body(parts, posed, direction)
            body = result["flattened"].copy()
            result, tip = a5.apply_weapon(
                result,
                posed,
                weapons,
                weapon_contract(contract, variant),
                direction,
            )
            metadata["weapon_tip"] = tip
            metadata["weapon_vector"] = list(posed["weapon_vector"])
            frames.append(result["flattened"])
            body_frames.append(body)
            equipment_frames.append(result["attachment"])
            identity_frames.append(result["identity"])
            garment_frames.append(result["garment"])
            semantic_frames.append(result["semantic"])
            landmarks.append(metadata)
    finally:
        a5.WEAPON_COLOR = old_color

    row = strip(frames)
    body_row = strip(body_frames)
    prefix = f"{variant}/{action}-{direction}"
    row_path = f"rows/{prefix}.png"
    body_path = f"planes/body/{prefix}.png"
    row_bytes = png(row)
    body_bytes = png(body_row)
    quality, quality_proof = quality_for(row_bytes, action, row_path)
    body_quality, body_proof = quality_for(body_bytes, action, body_path)
    gate = gate_row(
        variant, action, direction, frames, body_frames, equipment_frames,
        landmarks, quality, body_quality,
    )
    artifacts = {
        row_path: row_bytes,
        body_path: body_bytes,
        f"planes/identity/{prefix}.png": png(strip(identity_frames)),
        f"planes/garment/{prefix}.png": png(strip(garment_frames)),
        f"planes/equipment/{prefix}.png": png(strip(equipment_frames)),
        f"id-masks/{prefix}.png": png(strip(semantic_frames)),
        f"landmarks/{prefix}.json": canonical({
            "schema": "realm.enemy-sprites.raider-landmarks.v1",
            "scope": gate["scope"],
            "frames": landmarks,
        }),
        f"reports/quality/{prefix}.json": canonical(quality),
        f"reports/quality-body/{prefix}.json": canonical(body_quality),
        f"proof/quality/{prefix}-x4.png": quality_proof,
        f"proof/quality-body/{prefix}-x4.png": body_proof,
    }
    runtime_paths = {}
    raw_runtime = {}
    for tier, frame_w, frame_h in RUNTIME_TIERS:
        runtime_path = f"rows-runtime/{tier}/{prefix}.png"
        raw_runtime[tier] = runtime_row(frames, (frame_w, frame_h))
        runtime_paths[tier] = runtime_path
    return artifacts, {
        "scope": gate["scope"],
        "row": row_path,
        "runtimeRows": runtime_paths,
        "gate": gate,
    }, {
        "row": row,
        "body": body_row,
        "equipment": strip(equipment_frames),
        **{f"runtime:{tier}": image for tier, image in raw_runtime.items()},
    }


def contact_sheet(
    rows: dict[tuple[str, str, str], Image.Image],
    frame_w: int,
    frame_h: int,
    title: str,
) -> Image.Image:
    label_h = 18
    title_h = 28
    result = Image.new(
        "RGBA",
        (frame_w * BEATS * len(DIRECTIONS), title_h + len(VARIANTS) * len(ACTIONS) * (frame_h + label_h)),
        "#101820ff",
    )
    draw = ImageDraw.Draw(result)
    draw.text((8, 8), title, fill="#f5e7ca")
    row_index = 0
    for variant in VARIANTS:
        for action in ACTIONS:
            y = title_h + row_index * (frame_h + label_h)
            for column, direction in enumerate(DIRECTIONS):
                x = column * frame_w * BEATS
                draw.text((x + 4, y + 3), f"{variant} / {action} / {direction}", fill="#d9e4e8")
                result.alpha_composite(rows[(variant, action, direction)], (x, y + label_h))
            row_index += 1
    return result


def build(
    contract: dict[str, Any],
    identity: Image.Image,
    garments: dict[str, Image.Image],
    weapons: Image.Image,
    pose: dict[str, Any],
) -> tuple[dict[str, bytes], dict[str, Any]]:
    artifacts: dict[str, bytes] = {}
    records: dict[tuple[str, str, str], dict[str, Any]] = {}
    images: dict[tuple[str, str, str], dict[str, Image.Image]] = {}
    combinations = [
        (variant, action, direction)
        for variant in VARIANTS
        for action in ACTIONS
        for direction in DIRECTIONS
    ]
    for variant, action, direction in combinations:
        row_artifacts, record, row_images = build_row(
            contract, identity, garments[variant], weapons, pose,
            variant, action, direction,
        )
        artifacts.update(row_artifacts)
        records[(variant, action, direction)] = record
        images[(variant, action, direction)] = row_images

    default_rows = [images[key]["runtime:default"] for key in combinations]
    palette, colors = derive_runtime_palette(default_rows)
    styled: dict[str, dict[tuple[str, str, str], Image.Image]] = {
        tier: {} for tier, _w, _h in RUNTIME_TIERS
    }
    for key in combinations:
        for tier, _frame_w, _frame_h in RUNTIME_TIERS:
            image = apply_runtime_style(images[key][f"runtime:{tier}"], palette)
            styled[tier][key] = image
            path = records[key]["runtimeRows"][tier]
            artifacts[path] = png(image)

    failures = [
        f"{variant}/{action}/{direction}: {failure}"
        for (variant, action, direction), record in records.items()
        for failure in record["gate"]["failures"]
    ]
    for variant in VARIANTS:
        for action in ACTIONS:
            hashes = {
                digest(images[(variant, action, direction)]["row"].tobytes())
                for direction in DIRECTIONS
            }
            if len(hashes) != len(DIRECTIONS):
                failures.append(f"{variant}/{action} direction rows are not distinct")
    for action in ACTIONS:
        for direction in DIRECTIONS:
            hashes = {
                digest(styled["default"][(variant, action, direction)].tobytes())
                for variant in VARIANTS
            }
            if len(hashes) != len(VARIANTS):
                failures.append(f"{action}/{direction} default-tier variants are not distinct")
    for variant in VARIANTS:
        for direction in DIRECTIONS:
            walk = images[(variant, "walk", direction)]["row"].tobytes()
            retreat = images[(variant, "retreat", direction)]["row"].tobytes()
            if walk == retreat:
                failures.append(f"{variant}/{direction} retreat duplicates walk")
    for variant in VARIANTS:
        left = images[(variant, "attack", "left")]["row"]
        right = images[(variant, "attack", "right")]["row"]
        if left.tobytes() == right.transpose(Image.Transpose.FLIP_LEFT_RIGHT).tobytes():
            failures.append(f"{variant} attack uses forbidden finished-row mirroring")

    styled_colors = {
        pixel[:3]
        for image in styled["default"].values()
        for pixel in image.get_flattened_data()
        if pixel[3]
    }
    styled_alpha = {
        pixel[3]
        for tier_rows in styled.values()
        for image in tier_rows.values()
        for pixel in image.get_flattened_data()
    }
    if len(styled_colors) > RUNTIME_STYLE["palette_colors"]:
        failures.append(f"default runtime palette has {len(styled_colors)} colors")
    if styled_alpha - {0, 255}:
        failures.append("runtime rows contain partial alpha")

    atlases: dict[str, Image.Image] = {}
    runtime_manifest = {
        "schema": "realm.enemy-runtime-atlases.v1",
        "variants": list(VARIANTS),
        "actions": list(ACTIONS),
        "directions": list(DIRECTIONS),
        "frames": BEATS,
        "atlases": [],
    }
    for tier, frame_w, frame_h in RUNTIME_TIERS:
        atlas = Image.new(
            "RGBA",
            (frame_w * BEATS, frame_h * len(combinations)),
            (0, 0, 0, 0),
        )
        for row_index, key in enumerate(combinations):
            atlas.alpha_composite(styled[tier][key], (0, row_index * frame_h))
        atlases[tier] = atlas
        atlas_bytes = png(atlas)
        artifacts[f"atlases/{RUNTIME_FILES[tier]}"] = atlas_bytes
        runtime_manifest["atlases"].append({
            "key": tier,
            "file": RUNTIME_FILES[tier],
            "frameWidth": frame_w,
            "frameHeight": frame_h,
            "width": atlas.width,
            "height": atlas.height,
            "sha256": digest(atlas_bytes),
        })

    review_rows = {key: styled["review"][key] for key in combinations}
    default_contact = contact_sheet(
        styled["default"], 35, 46,
        "Realm painted raiders — exact default 35x46 tier",
    )
    review_contact = contact_sheet(
        review_rows, 64, 84,
        "Realm painted raiders — exact review 64x84 tier",
    )
    artifacts["proof/raiders-default-35x46.png"] = png(default_contact)
    artifacts["proof/raiders-review-64x84.png"] = png(review_contact)
    artifacts["style/raider-palette.png"] = png(palette_swatch(colors))

    gate = {
        "schema": "realm.enemy-sprites.raider-family-gate.v1",
        "rows": len(combinations),
        "frames": len(combinations) * BEATS,
        "variants": list(VARIANTS),
        "actions": list(ACTIONS),
        "directions": list(DIRECTIONS),
        "runtimeStyle": {
            **RUNTIME_STYLE,
            "actualPaletteColors": len(styled_colors),
            "actualAlphaValues": sorted(styled_alpha),
        },
        "rowGates": {
            "/".join(key): records[key]["gate"] for key in combinations
        },
        "mechanicalPassed": not failures,
        "failures": failures,
    }
    artifacts["reports/raider-family-gate.json"] = canonical(gate)
    artifacts["enemies-runtime-atlases.json"] = canonical(runtime_manifest)
    return artifacts, gate


def manifest(
    files: dict[str, dict[str, Any]],
    artifacts: dict[str, bytes],
    gate: dict[str, Any],
    deterministic: bool,
) -> dict[str, Any]:
    return {
        "schema": "realm.enemy-sprites.raider-family-manifest.v1",
        "status": "production-ready" if gate["mechanicalPassed"] and deterministic else "veto",
        "scope": {
            "variants": list(VARIANTS),
            "actions": list(ACTIONS),
            "directions": list(DIRECTIONS),
            "rows": gate["rows"],
            "frames": gate["frames"],
            "frameSize": [W, H],
            "rowSize": [ROW_W, H],
        },
        "sources": {
            "files": files,
            "sourceHash": digest("\n".join(
                f"{path}\0{record['sha256']}" for path, record in sorted(files.items())
            ).encode()),
            "networkRequired": False,
            "imagegenDirectStrips": False,
            "paintSourcesTransformedByJointChain": True,
            "finishedFrameOrRowMirroring": False,
        },
        "outputs": {
            path: {"sha256": digest(data), "bytes": len(data)}
            for path, data in sorted(artifacts.items())
        },
        "proof": {
            "default": "proof/raiders-default-35x46.png",
            "review": "proof/raiders-review-64x84.png",
            "palette": "style/raider-palette.png",
        },
        "verification": {
            "mechanicalPassed": gate["mechanicalPassed"],
            "byteDeterministicSecondPass": deterministic,
            "failures": gate["failures"],
        },
    }


def write_package(artifacts: dict[str, bytes], document: dict[str, Any]) -> None:
    temp = OUT.with_name(f"{OUT.name}.tmp")
    if temp.exists():
        shutil.rmtree(temp)
    for relative, data in artifacts.items():
        target = temp / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    (temp / "manifest.json").write_bytes(canonical(document))
    if OUT.exists():
        shutil.rmtree(OUT)
    temp.replace(OUT)


def promote(artifacts: dict[str, bytes]) -> None:
    for tier, filename in RUNTIME_FILES.items():
        target = ROOT / "assets/sprites" / filename
        staged = target.with_suffix(".png.tmp")
        staged.write_bytes(artifacts[f"atlases/{filename}"])
        staged.replace(target)
    manifest_target = ROOT / "assets/sprites/enemies-runtime-atlases.json"
    staged_manifest = manifest_target.with_suffix(".json.tmp")
    staged_manifest.write_bytes(artifacts["enemies-runtime-atlases.json"])
    staged_manifest.replace(manifest_target)


def main() -> int:
    parser = argparse.ArgumentParser(description="Build painted Realm raider sprites")
    parser.add_argument("--verify", action="store_true", help="require a byte-identical second build")
    parser.add_argument("--no-promote", action="store_true", help="leave the reviewed package unpromoted")
    args = parser.parse_args()
    try:
        contract, identity, garments, weapons, pose, files = load_inputs()
        validate_sources(contract, identity, garments, weapons)
        artifacts, gate = build(contract, identity, garments, weapons, pose)
        second = build(contract, identity, garments, weapons, pose) if args.verify else None
        deterministic = bool(second and artifacts == second[0] and canonical(gate) == canonical(second[1]))
        if gate["failures"]:
            raise A2Error("; ".join(gate["failures"]))
        if args.verify and not deterministic:
            raise A2Error("second in-memory raider build differed")
        document = manifest(files, artifacts, gate, deterministic)
        write_package(artifacts, document)
        if not args.no_promote:
            promote(artifacts)
        print(
            f"Painted raiders OK: {gate['rows']} rows / {gate['frames']} frames; "
            f"3 variants x 4 actions x 4 directions; deterministic={deterministic}"
        )
        print(f"output: {OUT}")
        return 0
    except (A2Error, OSError, KeyError, ValueError, TypeError, json.JSONDecodeError) as error:
        print(f"build-enemy-sprites: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
