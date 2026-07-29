#!/usr/bin/env python3
"""Compile the RFC 0002 A2 right-facing reference cycle.

This is the sole continuing A2 authoring path.  The current stage deliberately
emits one cargo-free watchman/watch-blue carry row.  It must win native-scale
motion review before left mirroring, additional views, attachment states, or
the two-identity by two-garment factorial are enabled.

The compiler is offline and deterministic.  Painted sources own texture and
silhouette language; the pose document owns root, joints, contacts, sockets,
phase, and scale.  Runtime output remains one flattened Canvas2D row.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
import shutil
import statistics
import sys
import tempfile
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageEnhance


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

from sprite_row_quality import analyze_row, write_proof  # noqa: E402


PROTO = ROOT / "assets/sprites/prototypes/actor-pose"
SOURCE = PROTO / "source/a2-layered2d"
OUT = PROTO / "output/a2-layered2d"
W, H, BEATS, ROW_W = 64, 84, 8, 512
SUPERSAMPLE = 4
GROUND_Y = 79

REFERENCE = {
    "identity": "watchman",
    "garment": "watch-blue",
    "attachment": "off",
    "action": "carry",
    "direction": "right",
}

SEMANTIC_COLORS = {
    "identity-head": (214, 55, 62, 255),
    "identity-torso": (174, 42, 52, 255),
    "identity-arm-near": (244, 121, 66, 255),
    "identity-arm-far": (198, 82, 55, 255),
    "identity-leg-near": (237, 104, 130, 255),
    "identity-leg-far": (180, 68, 104, 255),
    "garment-headgear": (72, 190, 105, 255),
    "garment-tunic": (39, 150, 83, 255),
    "garment-sleeve-near": (51, 192, 183, 255),
    "garment-sleeve-far": (33, 130, 139, 255),
    "garment-belt": (145, 208, 69, 255),
    "garment-boot-near": (69, 142, 230, 255),
    "garment-boot-far": (62, 96, 180, 255),
}


class A2Error(RuntimeError):
    """Raised when source or compiled evidence violates the reference gate."""


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def canonical(value: Any) -> bytes:
    return json.dumps(value, indent=2, sort_keys=True).encode() + b"\n"


def png(image: Image.Image) -> bytes:
    output = io.BytesIO()
    image.convert("RGBA").save(
        output, "PNG", optimize=False, compress_level=9
    )
    return output.getvalue()


def blank(size: tuple[int, int] = (W, H)) -> Image.Image:
    return Image.new("RGBA", size, (0, 0, 0, 0))


def alpha_bbox(image: Image.Image, threshold: int = 24) -> tuple[int, int, int, int] | None:
    return image.getchannel("A").point(
        lambda value: 255 if value >= threshold else 0
    ).getbbox()


def trim(image: Image.Image) -> Image.Image:
    box = alpha_bbox(image)
    if box is None:
        raise A2Error("painted source part is blank")
    return image.crop(box)


def strip(frames: list[Image.Image]) -> Image.Image:
    if len(frames) != BEATS:
        raise A2Error("reference row must have exactly eight frames")
    result = blank((ROW_W, H))
    for index, frame in enumerate(frames):
        if frame.size != (W, H):
            raise A2Error("reference frame dimensions changed")
        result.alpha_composite(frame, (index * W, 0))
    return result


def quantize(image: Image.Image) -> Image.Image:
    """Bound transform dust without flattening the painted source palette."""

    red, green, blue, alpha = image.convert("RGBA").split()

    def channel(value: int) -> int:
        return min(255, ((value + 2) // 4) * 4)

    return Image.merge(
        "RGBA",
        (
            red.point(channel),
            green.point(channel),
            blue.point(channel),
            alpha.point(lambda value: 0 if value < 18 else value),
        ),
    )


def dim_far(image: Image.Image) -> Image.Image:
    """Value-separate the occluded limb without changing scale or alpha."""

    red, green, blue, alpha = image.convert("RGBA").split()
    rgb = Image.merge("RGB", (red, green, blue))
    rgb = ImageEnhance.Brightness(rgb).enhance(0.72)
    result = rgb.convert("RGBA")
    result.putalpha(alpha)
    return result


def source_texture(image: Image.Image) -> Image.Image:
    """Return opaque painted RGB texture for joint-owned polygon silhouettes."""

    rgba = trim(image).convert("RGBA")
    pixels = [
        pixel for pixel in rgba.getdata() if pixel[3] >= 64
    ]
    if not pixels:
        raise A2Error("painted source texture has no opaque samples")
    mean = tuple(
        round(sum(pixel[channel] for pixel in pixels) / len(pixels))
        for channel in range(3)
    )
    base = Image.new("RGBA", rgba.size, (*mean, 255))
    base.alpha_composite(rgba)
    return base.convert("RGB")


def polygon_piece(
    texture: Image.Image,
    points: list[tuple[float, float]],
    *,
    joint_caps: list[tuple[tuple[float, float], float]] = [],
    far: bool = False,
) -> Image.Image:
    """Fill one supersampled semantic silhouette with a painted source."""

    scale = SUPERSAMPLE
    mask = Image.new("L", (W * scale, H * scale), 0)
    draw = ImageDraw.Draw(mask)
    scaled_points = [
        (round(x * scale), round(y * scale)) for x, y in points
    ]
    draw.polygon(scaled_points, fill=255)
    for (x, y), radius in joint_caps:
        draw.ellipse(
            (
                round((x - radius) * scale),
                round((y - radius) * scale),
                round((x + radius) * scale),
                round((y + radius) * scale),
            ),
            fill=255,
        )
    bounds = mask.getbbox()
    if bounds is None:
        raise A2Error("joint-owned polygon is blank")
    painted = source_texture(texture).resize(
        (bounds[2] - bounds[0], bounds[3] - bounds[1]),
        Image.Resampling.LANCZOS,
    )
    full_texture = Image.new("RGB", mask.size, (0, 0, 0))
    full_texture.paste(painted, bounds[:2])
    rendered = full_texture.convert("RGBA")
    rendered.putalpha(mask)
    rendered = rendered.resize((W, H), Image.Resampling.LANCZOS)
    rendered = quantize(rendered)
    return dim_far(rendered) if far else rendered


def segment_piece(
    texture: Image.Image,
    start: tuple[int, int],
    end: tuple[int, int],
    start_width: float,
    end_width: float,
    *,
    far: bool = False,
) -> Image.Image:
    """Render one tapered semantic bone with overlapping joint caps."""

    sx, sy = start
    ex, ey = end
    dx, dy = ex - sx, ey - sy
    length = math.hypot(dx, dy)
    if length < 2:
        raise A2Error(f"degenerate segment {start}->{end}")
    px, py = -dy / length, dx / length
    points = [
        (sx + px * start_width / 2, sy + py * start_width / 2),
        (sx - px * start_width / 2, sy - py * start_width / 2),
        (ex - px * end_width / 2, ey - py * end_width / 2),
        (ex + px * end_width / 2, ey + py * end_width / 2),
    ]
    return polygon_piece(
        texture,
        points,
        joint_caps=[
            (start, start_width * 0.48),
            (end, end_width * 0.52),
        ],
        far=far,
    )


def foot_piece(
    texture: Image.Image,
    leg: dict[str, Any],
    *,
    far: bool = False,
) -> Image.Image:
    """Render a boot whose visible sole is the authored contact authority."""

    ax, ay = leg["ankle"]
    hx, hy = leg["heel"]
    tx, ty = leg["toe"]
    points = [
        (ax - 3.8, ay - 2.0),
        (ax + 3.5, ay - 1.0),
        (tx + 1.5, ty - 2.5),
        (tx + 0.5, ty),
        (hx - 0.5, hy),
        (hx - 1.5, hy - 2.0),
    ]
    result = polygon_piece(
        texture,
        points,
        joint_caps=[((ax, ay), 3.2)],
        far=far,
    )
    pixels = result.load()
    sole = leg.get("sole_run")
    # Ground-row ownership is categorical: a planted boot owns its declared
    # continuous sole, while a swing boot owns no ground pixel.
    for x in range(W):
        pixels[x, GROUND_Y] = (0, 0, 0, 0)
    if sole is not None:
        start, end = sole
        fallback = next(
            (
                pixels[x, GROUND_Y - 1]
                for x in range(start, end + 1)
                if pixels[x, GROUND_Y - 1][3] >= 18
            ),
            (78, 48, 31, 255),
        )
        for x in range(start, end + 1):
            sample = pixels[x, GROUND_Y - 1]
            if sample[3] < 18:
                sample = fallback
            pixels[x, GROUND_Y] = (*sample[:3], 255)
    for y in range(GROUND_Y + 1, H):
        for x in range(W):
            pixels[x, y] = (0, 0, 0, 0)
    return result


def direct_piece(
    source: Image.Image,
    size: tuple[int, int],
    center: tuple[int, int],
    *,
    far: bool = False,
) -> Image.Image:
    """Place one trimmed painted component without per-frame rescaling."""

    part = trim(source).resize(
        (size[0] * SUPERSAMPLE, size[1] * SUPERSAMPLE),
        Image.Resampling.LANCZOS,
    )
    canvas = blank((W * SUPERSAMPLE, H * SUPERSAMPLE))
    x = round((center[0] - size[0] / 2) * SUPERSAMPLE)
    y = round((center[1] - size[1] / 2) * SUPERSAMPLE)
    canvas.alpha_composite(part, (x, y))
    result = quantize(
        canvas.resize((W, H), Image.Resampling.LANCZOS)
    )
    return dim_far(result) if far else result


def semantic_plane(image: Image.Image, color: tuple[int, int, int, int]) -> Image.Image:
    result = Image.new("RGBA", (W, H), color)
    result.putalpha(
        image.getchannel("A").point(lambda value: 255 if value >= 18 else 0)
    )
    return result


def normalize_ground(
    planes: dict[str, Image.Image],
    pose_frame: dict[str, Any],
) -> None:
    """Clamp the real boot silhouettes to the declared Realm ground surface."""

    contact_runs = [
        (side, pose_frame[side]["sole_run"])
        for side in ("far", "near")
        if pose_frame[side].get("sole_run") is not None
    ]
    allowed = {
        x
        for _side, run in contact_runs
        for x in range(run[0], run[1] + 1)
    }
    for name in ("identity", "garment", "flattened", "semantic"):
        pixels = planes[name].load()
        for y in range(GROUND_Y + 1, H):
            for x in range(W):
                pixels[x, y] = (0, 0, 0, 0)
        for x in range(W):
            if x not in allowed:
                pixels[x, GROUND_Y] = (0, 0, 0, 0)

    for side, run in contact_runs:
        semantic_color = SEMANTIC_COLORS[f"garment-boot-{side}"]
        for x in range(run[0], run[1] + 1):
            garment_sample = planes["garment"].getpixel((x, GROUND_Y - 1))
            if garment_sample[3] < 18:
                garment_sample = (82, 49, 31, 255)
            identity_sample = planes["identity"].getpixel((x, GROUND_Y - 1))
            if identity_sample[3] < 18:
                identity_sample = (70, 43, 30, 255)
            planes["garment"].putpixel(
                (x, GROUND_Y), (*garment_sample[:3], 255)
            )
            planes["identity"].putpixel(
                (x, GROUND_Y), (*identity_sample[:3], 255)
            )
            planes["flattened"].putpixel(
                (x, GROUND_Y), (*garment_sample[:3], 255)
            )
            planes["semantic"].putpixel(
                (x, GROUND_Y), semantic_color
            )


def load_sources(
    source_dir: Path,
) -> tuple[
    dict[str, Any],
    dict[str, Any],
    dict[str, Image.Image],
    dict[str, dict[str, Any]],
    dict[str, Any],
]:
    contract_path = source_dir / "a2-contract.json"
    pose_path = source_dir / "pose-spec.json"
    contract_bytes = contract_path.read_bytes()
    pose_bytes = pose_path.read_bytes()
    contract = json.loads(contract_bytes)
    pose = json.loads(pose_bytes)
    review_path = ROOT / contract["review_record"]
    review_bytes = review_path.read_bytes()
    review = json.loads(review_bytes)
    if contract.get("schema") != "realm.actor-pose.a2-layered2d.v2":
        raise A2Error("A2 contract must be v2")
    if pose.get("schema") != "realm.actor-pose.a2-pose.v2":
        raise A2Error("A2 pose source must be v2")
    if review.get("schema") != "realm.actor-pose.review-record.v1":
        raise A2Error("A2 review record must be v1")
    if contract.get("stage") != "right-reference-cycle":
        raise A2Error("factorial expansion remains vetoed at this stage")
    for key, value in REFERENCE.items():
        if pose.get(key) != value:
            raise A2Error(f"reference selection drifted: {key}")
        if contract["reference_gate"].get(key) != value:
            raise A2Error(f"contract reference selection drifted: {key}")
    expected_frame = {
        "width": 64,
        "height": 84,
        "root": [32, 79],
        "ground_y": 79,
        "clear_rows": [80, 81, 82, 83],
        "body_height": 76,
        "body_height_tolerance": 1,
        "beats": 8,
    }
    if contract.get("frame") != expected_frame:
        raise A2Error("A2 frame/root/ground contract changed")
    if len(pose.get("frames", [])) != BEATS:
        raise A2Error("reference pose must contain exactly eight frames")
    if [frame["frame"] for frame in pose["frames"]] != list(range(BEATS)):
        raise A2Error("reference frame order is not chronological 0..7")
    if [frame["phase"] for frame in pose["frames"]] != pose["timeline"]:
        raise A2Error("frame phase labels do not match the timeline")

    sheets: dict[str, Image.Image] = {}
    files: dict[str, dict[str, Any]] = {}
    selected = {
        "identity": contract["identities"][REFERENCE["identity"]],
        "garment": contract["garments"][REFERENCE["garment"]],
    }
    for owner, record in selected.items():
        path = ROOT / record["path"]
        data = path.read_bytes()
        if digest(data) != record["sha256"]:
            raise A2Error(f"{owner} painted source hash mismatch")
        sheets[owner] = Image.open(io.BytesIO(data)).convert("RGBA")
        files[record["path"]] = {
            "sha256": digest(data),
            "bytes": len(data),
            "owner": owner,
        }
    reference = pose["scale"]["accepted_reference"]
    reference_path = ROOT / reference["path"]
    reference_data = reference_path.read_bytes()
    if digest(reference_data) != reference["sha256"]:
        raise A2Error("accepted Realm scale reference hash mismatch")
    files[reference["path"]] = {
        "sha256": digest(reference_data),
        "bytes": len(reference_data),
        "owner": "scale-and-painted-detail-reference-only",
    }
    for path, owner in (
        (contract_path, "compiler-source"),
        (pose_path, "sole-pose-authority"),
        (review_path, "human-review-authority"),
        (Path(__file__), "compiler-source"),
        (ROOT / "scripts/sprite_row_quality.py", "quality-gate-source"),
    ):
        data = path.read_bytes()
        files[path.relative_to(ROOT).as_posix()] = {
            "sha256": digest(data),
            "bytes": len(data),
            "owner": owner,
        }
    return contract, pose, sheets, files, review


def source_parts(
    sheets: dict[str, Image.Image],
    crops: dict[str, dict[str, list[int]]],
) -> dict[str, Image.Image]:
    parts: dict[str, Image.Image] = {}
    for owner, owner_crops in crops.items():
        sheet = sheets[owner]
        for name, box in owner_crops.items():
            source = trim(sheet.crop(box))
            parts[f"{owner}:{name}"] = source.transpose(
                Image.Transpose.FLIP_LEFT_RIGHT
            )
    return parts


def compose_frame(
    parts: dict[str, Image.Image],
    pose_frame: dict[str, Any],
) -> tuple[dict[str, Image.Image], dict[str, Any]]:
    near = pose_frame["near"]
    far = pose_frame["far"]
    shoulders = pose_frame["shoulders"]
    elbows = pose_frame["elbows"]
    wrists = pose_frame["wrists"]
    hands = pose_frame["hands"]

    # Each entry is (owner, semantic ID, image).  The list is the explicit
    # right-view occlusion authority for the flattened row and semantic mask.
    pieces: list[tuple[str, str, Image.Image]] = []

    def add(owner: str, label: str, image: Image.Image) -> None:
        pieces.append((owner, label, image))

    def leg_chain(side: str, data: dict[str, Any], is_far: bool) -> list[tuple[str, str, Image.Image]]:
        identity_label = f"identity-leg-{side}"
        garment_label = f"garment-boot-{side}"
        identity_source = parts["identity:leg"]
        garment_source = parts["garment:boot"]
        identity_width = 7.0 if is_far else 8.0
        garment_width = 8.0 if is_far else 9.0
        return [
            (
                "identity",
                identity_label,
                segment_piece(
                    identity_source,
                    tuple(data["hip"]),
                    tuple(data["knee"]),
                    identity_width,
                    identity_width - 0.5,
                    far=is_far,
                ),
            ),
            (
                "identity",
                identity_label,
                segment_piece(
                    identity_source,
                    tuple(data["knee"]),
                    tuple(data["ankle"]),
                    identity_width - 0.5,
                    identity_width - 1.0,
                    far=is_far,
                ),
            ),
            (
                "identity",
                identity_label,
                foot_piece(identity_source, data, far=is_far),
            ),
            (
                "garment",
                garment_label,
                segment_piece(
                    garment_source,
                    tuple(data["hip"]),
                    tuple(data["knee"]),
                    garment_width,
                    garment_width - 0.5,
                    far=is_far,
                ),
            ),
            (
                "garment",
                garment_label,
                segment_piece(
                    garment_source,
                    tuple(data["knee"]),
                    tuple(data["ankle"]),
                    garment_width - 0.5,
                    garment_width - 1.0,
                    far=is_far,
                ),
            ),
            (
                "garment",
                garment_label,
                foot_piece(garment_source, data, far=is_far),
            ),
        ]

    def upper_arm(side: str, is_far: bool) -> list[tuple[str, str, Image.Image]]:
        identity_label = f"identity-arm-{side}"
        garment_label = f"garment-sleeve-{side}"
        width = 6.5 if is_far else 7.5
        return [
            (
                "identity",
                identity_label,
                segment_piece(
                    parts["identity:arm"],
                    tuple(shoulders[side]),
                    tuple(elbows[side]),
                    width,
                    width - 0.5,
                    far=is_far,
                ),
            ),
            (
                "garment",
                garment_label,
                segment_piece(
                    parts["garment:sleeve"],
                    tuple(shoulders[side]),
                    tuple(elbows[side]),
                    width + 1.4,
                    width,
                    far=is_far,
                ),
            ),
        ]

    def forearm_and_hand(side: str, is_far: bool) -> list[tuple[str, str, Image.Image]]:
        label = f"identity-arm-{side}"
        width = 6.0 if is_far else 6.8
        return [
            (
                "identity",
                label,
                segment_piece(
                    parts["identity:arm"],
                    tuple(elbows[side]),
                    tuple(wrists[side]),
                    width,
                    width - 0.7,
                    far=is_far,
                ),
            ),
            (
                "identity",
                label,
                segment_piece(
                    parts["identity:arm"],
                    tuple(wrists[side]),
                    tuple(hands[side]),
                    width - 0.7,
                    width - 1.2,
                    far=is_far,
                ),
            ),
        ]

    # Legs sit behind the tunic.  Far limbs remain the same semantic limbs and
    # are value-separated, never resized per beat.
    for record in leg_chain("far", far, True):
        add(*record)
    for record in leg_chain("near", near, False):
        add(*record)
    for record in upper_arm("far", True):
        add(*record)

    add(
        "identity",
        "identity-torso",
        direct_piece(
            parts["identity:torso"],
            (24, 31),
            tuple(pose_frame["torso"]),
        ),
    )
    add(
        "garment",
        "garment-tunic",
        direct_piece(
            parts["garment:tunic"],
            (28, 34),
            tuple(pose_frame["torso"]),
        ),
    )
    add(
        "garment",
        "garment-belt",
        direct_piece(
            parts["garment:belt"],
            (25, 5),
            tuple(pose_frame["sockets"]["belt"]),
        ),
    )

    # Both forearms cross the front silhouette so the empty load interface is
    # legible without baked cargo.
    for record in forearm_and_hand("far", True):
        add(*record)

    add(
        "identity",
        "identity-head",
        direct_piece(
            parts["identity:head"],
            (23, 24),
            tuple(pose_frame["head"]),
        ),
    )
    add(
        "garment",
        "garment-headgear",
        direct_piece(
            parts["garment:headgear"],
            (27, 22),
            (pose_frame["head"][0], pose_frame["head"][1] - 1),
        ),
    )

    for record in upper_arm("near", False):
        add(*record)
    for record in forearm_and_hand("near", False):
        add(*record)

    planes = {
        "identity": blank(),
        "garment": blank(),
        "attachment": blank(),
        "semantic": blank(),
        "flattened": blank(),
    }
    for owner, label, image in pieces:
        planes[owner].alpha_composite(image)
        planes["flattened"].alpha_composite(image)
        planes["semantic"].alpha_composite(
            semantic_plane(image, SEMANTIC_COLORS[label])
        )
    normalize_ground(planes, pose_frame)
    return planes, {
        "frame": pose_frame["frame"],
        "phase": pose_frame["phase"],
        "body_dy": pose_frame["body_dy"],
        "contacts": pose_frame["contacts"],
        "root": [32, 79],
        "head": pose_frame["head"],
        "pelvis": pose_frame["pelvis"],
        "near": pose_frame["near"],
        "far": pose_frame["far"],
        "shoulders": pose_frame["shoulders"],
        "elbows": pose_frame["elbows"],
        "wrists": pose_frame["wrists"],
        "hands": pose_frame["hands"],
        "sockets": pose_frame["sockets"],
    }


def visible_runs(image: Image.Image, y: int) -> list[list[int]]:
    alpha = image.getchannel("A")
    xs = [x for x in range(W) if alpha.getpixel((x, y)) >= 18]
    runs: list[list[int]] = []
    for x in xs:
        if not runs or x > runs[-1][1] + 1:
            runs.append([x, x])
        else:
            runs[-1][1] = x
    return runs


def frame_delta(first: Image.Image, second: Image.Image) -> int:
    return sum(
        abs(left - right)
        for left, right in zip(
            first.convert("RGBA").tobytes(),
            second.convert("RGBA").tobytes(),
        )
    )


def cross(
    first: tuple[int, int],
    middle: tuple[int, int],
    last: tuple[int, int],
) -> int:
    return (
        (middle[0] - first[0]) * (last[1] - middle[1])
        - (middle[1] - first[1]) * (last[0] - middle[0])
    )


def exact_color_count(
    image: Image.Image,
    color: tuple[int, int, int, int],
    box: tuple[int, int, int, int] | None = None,
) -> int:
    sample = image.crop(box) if box is not None else image
    return sum(1 for pixel in sample.getdata() if pixel == color)


def has_color_block(
    image: Image.Image,
    color: tuple[int, int, int, int],
    center: tuple[int, int],
    size: int = 2,
) -> bool:
    cx, cy = center
    for y in range(max(0, cy - 4), min(H - size + 1, cy + 4)):
        for x in range(max(0, cx - 4), min(W - size + 1, cx + 4)):
            if all(
                image.getpixel((x + dx, y + dy)) == color
                for dy in range(size)
                for dx in range(size)
            ):
                return True
    return False


def validate(
    frames: list[Image.Image],
    planes: dict[str, list[Image.Image]],
    landmarks: list[dict[str, Any]],
) -> dict[str, Any]:
    failures: list[str] = []
    metrics: list[dict[str, Any]] = []
    hashes = [digest(frame.tobytes()) for frame in frames]
    if len(set(hashes)) != BEATS:
        failures.append("the reference cycle does not contain eight distinct frames")

    expected_contacts = [
        ["near", "far"],
        ["near"],
        ["near"],
        ["near"],
        ["near", "far"],
        ["far"],
        ["far"],
        ["far"],
    ]
    expected_body_dy = [0, 1, 0, -1, 0, 1, 0, -1]
    alpha_mass: list[int] = []
    heights: list[int] = []
    for index, (frame, info) in enumerate(zip(frames, landmarks)):
        box = alpha_bbox(frame)
        if box is None:
            failures.append(f"frame {index} is blank")
            continue
        height = box[3] - box[1]
        heights.append(height)
        mass = round(
            sum(frame.getchannel("A").getdata()) / 255,
            2,
        )
        alpha_mass.append(mass)
        runs = visible_runs(frame, GROUND_Y)
        expected_runs = [
            value
            for side in ("far", "near")
            if (value := info[side].get("sole_run")) is not None
        ]
        expected_runs.sort()
        if runs != expected_runs:
            failures.append(
                f"frame {index} ground runs {runs} != {expected_runs}"
            )
        if info["contacts"] != expected_contacts[index]:
            failures.append(f"frame {index} contact declaration drifted")
        if info["body_dy"] != expected_body_dy[index]:
            failures.append(f"frame {index} body weight track drifted")
        if box[3] - 1 != GROUND_Y:
            failures.append(f"frame {index} does not register on y={GROUND_Y}")
        if not 75 <= height <= 77:
            failures.append(f"frame {index} body height {height}px is outside 76±1")
        if box[0] <= 1 or box[2] >= W - 1 or box[1] <= 1:
            failures.append(f"frame {index} clips or enters the edge safety band")
        if any(
            frame.getchannel("A").getpixel((x, y)) >= 18
            for y in range(80, H)
            for x in range(W)
        ):
            failures.append(f"frame {index} occupies a reserved clear row")
        if info["root"] != [32, 79]:
            failures.append(f"frame {index} root drifted")
        for side in ("near", "far"):
            leg = info[side]
            bend = abs(
                cross(
                    tuple(leg["hip"]),
                    tuple(leg["knee"]),
                    tuple(leg["ankle"]),
                )
            )
            if bend < 3:
                failures.append(
                    f"frame {index} {side} knee is visually straight ({bend})"
                )
            if side not in info["contacts"]:
                bottom = max(leg["heel"][1], leg["toe"][1])
                expected_bottom = {1: 76, 2: 75, 3: 73, 5: 76, 6: 75, 7: 73}[index]
                if bottom != expected_bottom:
                    failures.append(
                        f"frame {index} {side} swing bottom {bottom} != {expected_bottom}"
                    )
        for anatomical, key in (("near", "right_hand"), ("far", "left_hand")):
            socket = info["sockets"][key]
            hand = info["hands"][anatomical]
            if math.dist(socket, hand) > 1:
                failures.append(f"frame {index} {key} socket residual exceeds 1px")
        if math.dist(
            info["sockets"]["right_hand"],
            info["sockets"]["left_hand"],
        ) < 6:
            failures.append(f"frame {index} hand sockets collapse")
        far_hand_color = SEMANTIC_COLORS["identity-arm-far"]
        far_hand = tuple(info["hands"]["far"])
        far_hand_box = (
            max(0, far_hand[0] - 4),
            max(0, far_hand[1] - 4),
            min(W, far_hand[0] + 5),
            min(H, far_hand[1] + 5),
        )
        far_hand_pixels = exact_color_count(
            planes["semantic"][index],
            far_hand_color,
            far_hand_box,
        )
        far_hand_block = has_color_block(
            planes["semantic"][index],
            far_hand_color,
            far_hand,
        )
        if far_hand_pixels < 8 or not far_hand_block:
            failures.append(
                f"frame {index} far hand is not an exposed native cluster "
                f"({far_hand_pixels}px, 2x2={far_hand_block})"
            )
        metrics.append(
            {
                "frame": index,
                "phase": info["phase"],
                "bbox": list(box),
                "height": height,
                "alpha_mass": mass,
                "ground_runs": runs,
                "contacts": info["contacts"],
                "near_knee_cross": abs(
                    cross(
                        tuple(info["near"]["hip"]),
                        tuple(info["near"]["knee"]),
                        tuple(info["near"]["ankle"]),
                    )
                ),
                "far_knee_cross": abs(
                    cross(
                        tuple(info["far"]["hip"]),
                        tuple(info["far"]["knee"]),
                        tuple(info["far"]["ankle"]),
                    )
                ),
                "sockets": info["sockets"],
                "far_hand_visible_pixels": far_hand_pixels,
                "far_hand_has_2x2_cluster": far_hand_block,
                "sha256_rgba": hashes[index],
            }
        )

    if planes["attachment"][0].getbbox() is not None or any(
        image.getbbox() is not None for image in planes["attachment"]
    ):
        failures.append("cargo/attachment plane is not fully transparent")
    semantic_colors = {
        pixel
        for image in planes["semantic"]
        for pixel in image.getdata()
        if pixel[3] >= 18
    }
    # The visible mask categorizes the final flattened surface.  Identity torso
    # and legs are intentionally hidden by the garment; their independent
    # contribution remains inspectable in the identity plane.
    required_labels = {
        "identity-head",
        "identity-arm-near",
        "identity-arm-far",
        "garment-headgear",
        "garment-tunic",
        "garment-sleeve-near",
        "garment-belt",
        "garment-boot-near",
        "garment-boot-far",
    }
    required_colors = {
        SEMANTIC_COLORS[label] for label in required_labels
    }
    if not required_colors.issubset(semantic_colors):
        missing = sorted(required_colors - semantic_colors)
        failures.append(f"semantic categorical IDs missing: {missing}")
    if heights and statistics.median(heights) != 76:
        failures.append(
            f"median body height {statistics.median(heights)}px != 76px"
        )
    if alpha_mass and max(alpha_mass) / min(alpha_mass) > 1.12:
        failures.append(
            f"alpha-mass ratio {max(alpha_mass) / min(alpha_mass):.3f} exceeds 1.12"
        )

    deltas = [
        frame_delta(frames[index], frames[(index + 1) % BEATS])
        for index in range(BEATS)
    ]
    internal_median = statistics.median(deltas[:-1])
    loop_ratio = deltas[-1] / max(1, internal_median)
    if not 0.65 <= loop_ratio <= 1.40:
        failures.append(
            f"loop delta ratio {loop_ratio:.3f} outside [0.65, 1.40]"
        )
    semantic_zero = planes["semantic"][0]
    semantic_four = planes["semantic"][4]
    near_boot = SEMANTIC_COLORS["garment-boot-near"]
    far_boot = SEMANTIC_COLORS["garment-boot-far"]
    if not (
        semantic_zero.getpixel((40, GROUND_Y)) == near_boot
        and semantic_zero.getpixel((24, GROUND_Y)) == far_boot
        and semantic_four.getpixel((24, GROUND_Y)) == near_boot
        and semantic_four.getpixel((40, GROUND_Y)) == far_boot
    ):
        failures.append("opposite contact frames do not swap semantic support")

    pass_boots = []
    for frame_index, side in ((2, "far"), (6, "near")):
        color = SEMANTIC_COLORS[f"garment-boot-{side}"]
        native_pixels = exact_color_count(
            planes["semantic"][frame_index],
            color,
        )
        runtime_mask = planes["semantic"][frame_index].resize(
            (27, 35),
            Image.Resampling.NEAREST,
        )
        runtime_pixels = exact_color_count(runtime_mask, color)
        pass_boots.append(
            {
                "frame": frame_index,
                "side": side,
                "native_visible_pixels": native_pixels,
                "runtime_27x35_visible_pixels": runtime_pixels,
            }
        )
        if native_pixels < 60 or runtime_pixels < 1:
            failures.append(
                f"frame {frame_index} {side} pass boot collapses "
                f"({native_pixels}px native, {runtime_pixels}px at 27x35)"
            )
    if landmarks[0]["near"]["toe"][0] <= landmarks[0]["far"]["toe"][0]:
        failures.append("near leg does not lead at frame 0")
    if landmarks[4]["far"]["toe"][0] <= landmarks[4]["near"]["toe"][0]:
        failures.append("far leg does not lead at frame 4")

    return {
        "schema": "realm.actor-pose.a2-right-reference-gate.v2",
        "scope": REFERENCE,
        "tested_rows": 1,
        "tested_frames": 8,
        "root": [32, 79],
        "ground_y": 79,
        "frame_metrics": metrics,
        "transition_deltas": deltas,
        "internal_transition_median": internal_median,
        "loop_delta_ratio": loop_ratio,
        "alpha_mass_ratio": (
            max(alpha_mass) / min(alpha_mass) if alpha_mass else None
        ),
        "body_heights": heights,
        "semantic_palette": {
            key: list(value) for key, value in SEMANTIC_COLORS.items()
        },
        "cargo_pixels": 0,
        "pass_boot_visibility": pass_boots,
        "mechanical_passed": not failures,
        "failures": failures,
    }


def bind_review_record(
    review: dict[str, Any],
    artifacts: dict[str, bytes],
    record_path: str,
) -> dict[str, Any]:
    """Bind human decisions to the exact frozen row and native loop."""

    failures: list[str] = []
    subject_failures: list[str] = []

    def reject(message: str, *, subject: bool = False) -> None:
        failures.append(message)
        if subject:
            subject_failures.append(message)

    if review.get("schema") != "realm.actor-pose.review-record.v1":
        reject("review record schema is not v1")
    if review.get("review_id") != "a2-right-reference-v3":
        reject("review ID is not the frozen v3 reference")

    subject = review.get("subject", {})
    if not isinstance(subject, dict):
        reject("review subject must be an object", subject=True)
        subject = {}
    if subject.get("purpose") != "derivation-reference-only":
        reject("review purpose is not derivation-reference-only", subject=True)
    if subject.get("scope") != REFERENCE:
        reject(
            "review record scope does not match the frozen row",
            subject=True,
        )

    expected_artifacts = {
        "flattened_row": (
            "flattened_row",
            "rows/watchman/watch-blue/off/carry-right.png",
        ),
        "native_unlabeled_loop": (
            "native_1x_loop",
            "proof/carry-right-unlabeled-x1.gif",
        ),
    }
    artifact_hashes: dict[str, dict[str, str]] = {}
    for name, (subject_key, path) in expected_artifacts.items():
        record = subject.get(subject_key, {})
        if record.get("path") != path:
            reject(f"review record {name} path changed", subject=True)
            continue
        data = artifacts.get(path)
        if data is None:
            reject(f"review target {path} is missing", subject=True)
            continue
        actual = digest(data)
        expected = record.get("sha256")
        if expected != actual:
            reject(
                f"review target {name} changed: expected {expected}, got {actual}",
                subject=True,
            )
        artifact_hashes[name] = {
            "path": path,
            "sha256": actual,
        }

    subject_hash = digest(
        json.dumps(
            subject,
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=False,
        ).encode("utf-8")
    )
    if review.get("subject_sha256") != subject_hash:
        reject("review subject digest is stale", subject=True)

    reviews = review.get("decisions", {})
    if not isinstance(reviews, dict):
        reject("review decisions must be an object")
        reviews = {}
    if set(reviews) != {"terra", "luna", "owner"}:
        reject("review record must contain exactly Terra, Luna, and owner")
    decisions = {
        reviewer: (
            reviews.get(reviewer, {}).get("verdict")
            if isinstance(reviews.get(reviewer, {}), dict)
            else None
        )
        for reviewer in ("terra", "luna", "owner")
    }
    allowed_verdicts = {"pending", "approve-reference-only", "veto"}
    for reviewer in ("terra", "luna", "owner"):
        decision = reviews.get(reviewer, {})
        if not isinstance(decision, dict):
            reject(f"{reviewer.title()} decision must be an object")
            continue
        verdict = decision.get("verdict")
        if verdict not in allowed_verdicts:
            reject(f"{reviewer.title()} verdict is outside the review vocabulary")
            continue
        if verdict == "pending":
            continue
        if decision.get("subject_sha256") != subject_hash:
            reject(
                f"{reviewer.title()} decision is bound to another subject"
            )
        for field in ("recorded_at", "evidence_ref"):
            if not isinstance(decision.get(field), str) or not decision[field].strip():
                reject(f"{reviewer.title()} decision lacks {field}")
        if verdict == "veto" and (
            not isinstance(decision.get("defect"), str)
            or not decision["defect"].strip()
        ):
            reject(f"{reviewer.title()} veto lacks a defect")

    owner = reviews.get("owner", {})
    if not isinstance(owner, dict):
        owner = {}
    owner_verdict = owner.get("verdict")
    valid = not failures
    subject_bound = not subject_failures
    council_pass = valid and subject_bound and all(
        reviews.get(reviewer, {}).get("verdict") == "approve-reference-only"
        and reviews.get(reviewer, {}).get("subject_sha256") == subject_hash
        for reviewer in ("terra", "luna")
    )
    owner_pass = (
        valid
        and subject_bound
        and owner_verdict == "approve-reference-only"
        and owner.get("subject_sha256") == subject_hash
    )
    factorial_authorized = valid and council_pass and owner_pass
    if failures:
        status = "invalid"
    elif owner_verdict == "veto":
        status = "owner-veto"
    elif any(
        reviews.get(reviewer, {}).get("verdict") == "veto"
        for reviewer in ("terra", "luna")
    ):
        status = "council-veto"
    elif factorial_authorized:
        status = "owner-approved-reference"
    elif council_pass and owner_verdict == "pending":
        status = "council-approved-owner-pending"
    else:
        status = "review-incomplete"

    return {
        "schema": "realm.actor-pose.review-evaluation.v1",
        "record": record_path,
        "review_id": review.get("review_id"),
        "subject_sha256": subject_hash,
        "artifacts": artifact_hashes,
        "decisions": decisions,
        "subject_bound": subject_bound,
        "council_reference_pass": council_pass,
        "owner_reference_pass": owner_pass,
        "factorial_authorized": factorial_authorized,
        "status": status,
        "valid": valid,
        "failures": failures,
    }


def joint_overlay(
    frames: list[Image.Image],
    landmarks: list[dict[str, Any]],
) -> Image.Image:
    scale = 4
    result = Image.new("RGB", (ROW_W * scale, H * scale + 24), "#101820")
    for index, (frame, info) in enumerate(zip(frames, landmarks)):
        cell = frame.resize((W * scale, H * scale), Image.Resampling.NEAREST)
        x_offset = index * W * scale
        result.paste(cell, (x_offset, 24), cell)
        draw = ImageDraw.Draw(result)

        def point(value: list[int]) -> tuple[int, int]:
            return (
                x_offset + value[0] * scale,
                24 + value[1] * scale,
            )

        for side, color in (("far", "#cf68ff"), ("near", "#48d7ff")):
            leg = info[side]
            chain = [
                leg["hip"],
                leg["knee"],
                leg["ankle"],
                leg["heel"],
                leg["toe"],
            ]
            draw.line([point(value) for value in chain], fill=color, width=2)
            for value in chain:
                x, y = point(value)
                draw.ellipse((x - 2, y - 2, x + 2, y + 2), fill=color)
            arm = [
                info["shoulders"][side],
                info["elbows"][side],
                info["wrists"][side],
                info["hands"][side],
            ]
            draw.line([point(value) for value in arm], fill=color, width=2)
        load_x, load_y = point(info["sockets"]["load"])
        draw.rectangle(
            (load_x - 3, load_y - 3, load_x + 3, load_y + 3),
            outline="#ffe177",
            width=2,
        )
        draw.text(
            (x_offset + 4, 5),
            f"{index} {info['phase']}",
            fill="#e8eef2",
        )
    return result


def still_proof(
    row: Image.Image,
    landmarks: list[dict[str, Any]],
) -> Image.Image:
    scale = 4
    scaled = row.resize(
        (ROW_W * scale, H * scale), Image.Resampling.NEAREST
    )
    result = Image.new("RGB", (scaled.width, scaled.height + 24), "#101820")
    result.paste(scaled, (0, 24), scaled)
    draw = ImageDraw.Draw(result)
    draw.line(
        (
            0,
            24 + GROUND_Y * scale,
            result.width - 1,
            24 + GROUND_Y * scale,
        ),
        fill="#48606d",
    )
    for index, info in enumerate(landmarks):
        draw.text(
            (index * W * scale + 4, 5),
            f"{index} {info['phase']}",
            fill="#e8eef2",
        )
    return result


def animated_proof(
    frames: list[Image.Image],
    *,
    scale: int,
    labeled: bool,
) -> bytes:
    images: list[Image.Image] = []
    label_height = 22 if labeled else 0
    for index, frame in enumerate(frames):
        canvas = Image.new(
            "RGB",
            (W * scale, H * scale + label_height),
            "#101820",
        )
        enlarged = frame.resize(
            (W * scale, H * scale),
            Image.Resampling.NEAREST,
        )
        canvas.paste(enlarged, (0, label_height), enlarged)
        if labeled:
            ImageDraw.Draw(canvas).text(
                (5, 5),
                f"{index}",
                fill="#e8eef2",
            )
        images.append(canvas)
    output = io.BytesIO()
    images[0].save(
        output,
        "GIF",
        save_all=True,
        append_images=images[1:],
        duration=117,
        loop=0,
        disposal=2,
        optimize=False,
    )
    return output.getvalue()


def runtime_scale_proof(frames: list[Image.Image]) -> bytes:
    images: list[Image.Image] = []
    for frame in frames:
        actor = frame.resize((27, 35), Image.Resampling.LANCZOS)
        canvas = Image.new("RGB", (64, 64), "#25313a")
        canvas.paste(actor, (19, 15), actor)
        images.append(canvas)
    output = io.BytesIO()
    images[0].save(
        output,
        "GIF",
        save_all=True,
        append_images=images[1:],
        duration=117,
        loop=0,
        disposal=2,
        optimize=False,
    )
    return output.getvalue()


def build(
    contract: dict[str, Any],
    pose: dict[str, Any],
    sheets: dict[str, Image.Image],
    review: dict[str, Any],
) -> tuple[dict[str, bytes], dict[str, Any], dict[str, Any]]:
    parts = source_parts(
        sheets,
        contract["reference_gate"]["render_parts"],
    )
    frames: list[Image.Image] = []
    landmarks: list[dict[str, Any]] = []
    frame_planes = {
        name: []
        for name in ("identity", "garment", "attachment", "semantic")
    }
    for pose_frame in pose["frames"]:
        result, metadata = compose_frame(parts, pose_frame)
        frames.append(result["flattened"])
        landmarks.append(metadata)
        for name in frame_planes:
            frame_planes[name].append(result[name])

    gate = validate(frames, frame_planes, landmarks)
    row = strip(frames)
    row_path = "rows/watchman/watch-blue/off/carry-right.png"
    row_bytes = png(row)
    native_path = "proof/carry-right-unlabeled-x1.gif"
    native_bytes = animated_proof(frames, scale=1, labeled=False)
    review_state = bind_review_record(
        review,
        {
            row_path: row_bytes,
            native_path: native_bytes,
        },
        contract["review_record"],
    )
    with tempfile.TemporaryDirectory(prefix="realm-a2-quality-") as temp:
        temp_path = Path(temp)
        quality_row = temp_path / "carry-right.png"
        quality_proof = temp_path / "quality-x4.png"
        quality_row.write_bytes(row_bytes)
        quality = analyze_row(quality_row, "carry")
        quality["path"] = row_path
        write_proof(quality_row, quality_proof, quality)
        quality_proof_bytes = quality_proof.read_bytes()
    quality_failures = list(quality["errors"]) + list(quality["warnings"])
    if quality.get("styleEra") != "painted":
        quality_failures.append(
            f"quality gate classified row as {quality.get('styleEra')}"
        )
    if quality_failures:
        gate["failures"].extend(
            f"quality: {failure}" for failure in quality_failures
        )
        gate["mechanical_passed"] = False
    gate["production_quality"] = {
        "style_era": quality["styleEra"],
        "flicker_score": quality["flickerScore"],
        "median_color_count": quality["medianColorCount"],
        "median_shading_ratio": quality["medianShadingRatio"],
        "body_height_range": quality["bodyHeightRange"],
        "body_width_range": quality["bodyWidthRange"],
        "body_bottom_range": quality["bodyBottomRange"],
        "max_alpha_ratio": quality["maxAlphaRatio"],
        "max_fragment_pixels": quality["maxFragmentPixels"],
        "warnings": quality["warnings"],
        "errors": quality["errors"],
    }
    artifacts = {
        row_path: row_bytes,
        "planes/identity/watchman/watch-blue/off/carry-right.png": png(
            strip(frame_planes["identity"])
        ),
        "planes/garment/watchman/watch-blue/off/carry-right.png": png(
            strip(frame_planes["garment"])
        ),
        "planes/attachment/watchman/watch-blue/off/carry-right.png": png(
            strip(frame_planes["attachment"])
        ),
        "id-masks/watchman/watch-blue/off/carry-right.png": png(
            strip(frame_planes["semantic"])
        ),
        "proof/carry-right-still-x4.png": png(still_proof(row, landmarks)),
        "proof/carry-right-joints-x4.png": png(
            joint_overlay(frames, landmarks)
        ),
        native_path: native_bytes,
        "proof/carry-right-review-x5.gif": animated_proof(
            frames, scale=5, labeled=True
        ),
        "proof/carry-right-runtime-27x35.gif": runtime_scale_proof(frames),
        "proof/quality-x4.png": quality_proof_bytes,
        "landmarks/carry-right.json": canonical(
            {
                "schema": "realm.actor-pose.a2-landmarks.v2",
                "scope": REFERENCE,
                "frames": landmarks,
            }
        ),
        "reports/reference-gate.json": canonical(gate),
        "reports/review-evaluation.json": canonical(review_state),
        "reports/quality.json": canonical(quality),
    }
    return artifacts, gate, review_state


def manifest(
    contract: dict[str, Any],
    pose: dict[str, Any],
    files: dict[str, dict[str, Any]],
    artifacts: dict[str, bytes],
    gate: dict[str, Any],
    review_state: dict[str, Any],
    deterministic: bool,
) -> dict[str, Any]:
    expansion_authorized = bool(
        gate["mechanical_passed"]
        and deterministic
        and review_state["factorial_authorized"]
    )
    return {
        "schema": "realm.actor-pose.a2-reference-manifest.v2",
        "candidate": "a2-layered2d",
        "stage": "right-reference-cycle",
        "status": (
            review_state["status"]
            if (
                gate["mechanical_passed"]
                and deterministic
                and review_state["valid"]
            )
            else "mechanical-determinism-or-review-veto"
        ),
        "scope": {
            **REFERENCE,
            "flattened_rows": 1,
            "flattened_frames": 8,
            "frame_size": [64, 84],
            "row_size": [512, 84],
            "root": [32, 79],
            "ground_y": 79,
            "runtime": "none; flattened offline evidence only",
            "factorial_expansion": (
                "authorized"
                if expansion_authorized
                else "vetoed"
            ),
        },
        "authority": contract["authority"],
        "sources": {
            "files": files,
            "source_hash": digest(
                "\n".join(
                    f"{name}\0{record['sha256']}"
                    for name, record in sorted(files.items())
                ).encode()
            ),
            "network_required": False,
            "paint_sources_transformed_by_joint_chain": True,
            "current_or_legacy_frame_pixels_copied": False,
            "final_bitmap_mirroring": False,
            "sentinel_or_registration_pixels": False,
        },
        "outputs": {
            path: {"sha256": digest(data), "bytes": len(data)}
            for path, data in sorted(artifacts.items())
        },
        "row": {
            "path": "rows/watchman/watch-blue/off/carry-right.png",
            "identity_plane": "planes/identity/watchman/watch-blue/off/carry-right.png",
            "garment_plane": "planes/garment/watchman/watch-blue/off/carry-right.png",
            "attachment_plane": "planes/attachment/watchman/watch-blue/off/carry-right.png",
            "semantic_mask": "id-masks/watchman/watch-blue/off/carry-right.png",
            "landmarks": "landmarks/carry-right.json",
        },
        "proof": {
            "native_unlabeled_loop": "proof/carry-right-unlabeled-x1.gif",
            "labeled_review_loop": "proof/carry-right-review-x5.gif",
            "still_strip": "proof/carry-right-still-x4.png",
            "joint_socket_overlay": "proof/carry-right-joints-x4.png",
            "runtime_27x35_loop": "proof/carry-right-runtime-27x35.gif",
            "quality_proof": "proof/quality-x4.png",
            "quality_report": "reports/quality.json",
        },
        "verification": {
            "mechanical_passed": gate["mechanical_passed"],
            "byte_deterministic_second_pass": deterministic,
            "report": "reports/reference-gate.json",
            "review_report": "reports/review-evaluation.json",
            "failures": gate["failures"],
        },
        "review": review_state,
        "compiler": {
            "path": "scripts/actor-pose-prototype/a2_layered2d.py",
            "python": f"{sys.version_info.major}.{sys.version_info.minor}",
            "pillow": Image.__version__,
            "supersample": SUPERSAMPLE,
        },
        "contract_snapshot": {
            "frame": contract["frame"],
            "reference_gate": contract["reference_gate"],
            "pose_schema": pose["schema"],
            "review_schema": review_state["schema"],
        },
    }


def write_output(
    output_dir: Path,
    artifacts: dict[str, bytes],
    document: dict[str, Any],
) -> None:
    if output_dir.exists():
        shutil.rmtree(output_dir)
    for relative, data in artifacts.items():
        target = output_dir / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    (output_dir / "manifest.json").write_bytes(canonical(document))


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Compile the RFC A2 right-facing cargo-free reference cycle."
    )
    parser.add_argument("--source-dir", type=Path, default=SOURCE)
    parser.add_argument("--out-dir", type=Path, default=OUT)
    parser.add_argument(
        "--verify",
        action="store_true",
        help="Require a byte-identical second in-memory build.",
    )
    args = parser.parse_args()
    try:
        contract, pose, sheets, files, review = load_sources(
            args.source_dir.resolve()
        )
        artifacts, gate, review_state = build(contract, pose, sheets, review)
        second = build(contract, pose, sheets, review) if args.verify else None
        deterministic = bool(
            second
            and artifacts == second[0]
            and canonical(gate) == canonical(second[1])
            and canonical(review_state) == canonical(second[2])
        )
        if gate["failures"]:
            raise A2Error("; ".join(gate["failures"]))
        if review_state["failures"]:
            raise A2Error(
                "; ".join(
                    f"review: {failure}"
                    for failure in review_state["failures"]
                )
            )
        if args.verify and not deterministic:
            raise A2Error("second in-memory build differed")
        document = manifest(
            contract,
            pose,
            files,
            artifacts,
            gate,
            review_state,
            deterministic,
        )
        write_output(args.out_dir.resolve(), artifacts, document)
        review_note = {
            "owner-approved-reference": "owner-approved derivation reference",
            "council-approved-owner-pending": "owner native-1x review pending",
            "owner-veto": "owner veto recorded",
            "council-veto": "council veto recorded",
            "review-incomplete": "human review incomplete",
        }.get(review_state["status"], review_state["status"])
        print(
            "A2 reference OK: 1 cargo-free carry/right row / 8 frames; "
            f"loop-ratio={gate['loop_delta_ratio']:.3f}; "
            f"{review_note}"
        )
        print(f"output: {args.out_dir.resolve()}")
        return 0
    except (
        A2Error,
        OSError,
        KeyError,
        TypeError,
        ValueError,
        json.JSONDecodeError,
    ) as error:
        print(f"FAIL: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
