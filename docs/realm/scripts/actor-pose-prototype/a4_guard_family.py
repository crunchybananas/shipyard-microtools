#!/usr/bin/env python3
"""Compile the first four-direction Realm guard family.

A4 promotes the approved A2/A3 modular proof from one right-facing carry row
to four authored directions.  Left is built by reflecting joints and using
the unflipped side-view source parts; the compiler never mirrors a finished
frame or row.  Down and up use their own painted head, torso, garment, boot,
and crate views while retaining the approved eight-beat contact chronology.

The output remains ordinary flattened raster rows.  Skeletal parts are an
offline consistency and review mechanism, not a runtime renderer.
"""

from __future__ import annotations

import argparse
import copy
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

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from a2_layered2d import (  # noqa: E402
    A2Error,
    BEATS,
    GROUND_Y,
    H,
    ROW_W,
    SEMANTIC_COLORS,
    W,
    blank,
    canonical,
    compose_frame,
    digest,
    direct_piece,
    foot_piece,
    normalize_ground,
    png,
    segment_piece,
    semantic_plane,
    strip,
    trim,
)
from a3_factorial import (  # noqa: E402
    ATTACHMENT_SEMANTIC_COLOR,
    RUNTIME_STYLE,
    RUNTIME_TIERS,
    apply_runtime_style,
    derive_runtime_palette,
    palette_swatch,
    runtime_row,
)
from sprite_row_quality import analyze_row, write_proof  # noqa: E402


PROTO = ROOT / "assets/sprites/prototypes/actor-pose"
SOURCE = PROTO / "source/a4-guard-family"
OUT = PROTO / "output/a4-guard-family"
CONTRACT_PATH = SOURCE / "parts.json"
DIRECTIONS = ("down", "up", "left", "right")
ATTACHMENTS = ("off", "cargo-crate")
ACTION = "carry"
IDENTITY = "watchman"
GARMENT = "watch-blue"
RUNTIME_SIZE = (35, 46)
DEFAULT_CARDINAL_RENDER_PROFILE = {
    "identity_leg_far_width": 7.5,
    "identity_leg_near_width": 8.8,
    "garment_leg_far_width": 8.7,
    "garment_leg_near_width": 10.0,
    "upper_arm_far_width": 6.5,
    "upper_arm_near_width": 7.5,
    "forearm_far_width": 6.0,
    "forearm_near_width": 6.8,
    "identity_torso_size": [29, 34],
    "garment_tunic_size": [32, 34],
    "garment_belt_size": [27, 5],
    "identity_head_size": [24, 24],
    "garment_headgear_size": [30, 22],
}


def file_sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def alpha_bbox(
    image: Image.Image,
    threshold: int = 18,
) -> tuple[int, int, int, int] | None:
    return image.getchannel("A").point(
        lambda value: 255 if value >= threshold else 0
    ).getbbox()


def frame_delta(first: Image.Image, second: Image.Image) -> int:
    return sum(
        abs(left - right)
        for left, right in zip(
            first.convert("RGBA").tobytes(),
            second.convert("RGBA").tobytes(),
        )
    )


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


def crop_component(
    sheet: Image.Image,
    box: list[int],
    *,
    transform: str = "none",
) -> Image.Image:
    component = trim(sheet.crop(tuple(box)))
    if transform == "flip-x":
        return component.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    if transform != "none":
        raise A2Error(f"unsupported component transform: {transform}")
    return component


def load_inputs(
    source_dir: Path,
) -> tuple[
    dict[str, Any],
    dict[str, Image.Image],
    dict[str, Any],
    dict[str, dict[str, Any]],
]:
    contract_path = source_dir / "parts.json"
    contract = json.loads(contract_path.read_text())
    if contract.get("schema") != "realm.actor-pose.a4-guard-family-parts.v1":
        raise A2Error("A4 parts contract must be v1")
    if contract.get("stage") != "guard-carry-four-directions":
        raise A2Error("A4 contract stage changed")
    if tuple(contract.get("scope", {}).get("directions", [])) != DIRECTIONS:
        raise A2Error("A4 must declare four ordered directions")
    if tuple(contract.get("scope", {}).get("attachments", [])) != ATTACHMENTS:
        raise A2Error("A4 must declare the off and cargo-crate states")

    sheets: dict[str, Image.Image] = {}
    files: dict[str, dict[str, Any]] = {}
    for owner in ("identity", "garment", "attachment"):
        record = contract[owner]
        path = ROOT / record["path"]
        data = path.read_bytes()
        actual = digest(data)
        if actual != record["sha256"]:
            raise A2Error(f"A4 {owner} source hash changed")
        sheets[owner] = Image.open(io.BytesIO(data)).convert("RGBA")
        files[record["path"]] = {
            "sha256": actual,
            "bytes": len(data),
            "owner": owner,
        }
        for direction in DIRECTIONS:
            if direction not in record["parts"]:
                raise A2Error(f"A4 {owner} lacks {direction} source parts")
            boxes = record["parts"][direction]
            if owner == "attachment":
                boxes = {"attachment": boxes}
            for name, box in boxes.items():
                if len(box) != 4:
                    raise A2Error(
                        f"A4 {owner}/{direction}/{name} crop is malformed"
                    )
                crop = sheets[owner].crop(tuple(box))
                bbox = alpha_bbox(crop)
                if bbox is None:
                    raise A2Error(
                        f"A4 {owner}/{direction}/{name} crop is blank"
                    )
                if min(
                    bbox[0],
                    bbox[1],
                    crop.width - bbox[2],
                    crop.height - bbox[3],
                ) < 8 and owner != "attachment":
                    raise A2Error(
                        f"A4 {owner}/{direction}/{name} lacks an 8px "
                        "transparent crop margin"
                    )

    pose_record = contract["pose"]["right_source"]
    pose_path = ROOT / pose_record["path"]
    if file_sha(pose_path) != pose_record["sha256"]:
        raise A2Error("A4 right-pose authority hash changed")
    pose = json.loads(pose_path.read_text())
    if pose.get("schema") != "realm.actor-pose.a2-pose.v2":
        raise A2Error("A4 requires the approved A2 v2 pose")
    if len(pose.get("frames", [])) != BEATS:
        raise A2Error("A4 requires exactly eight pose beats")

    for path, owner in (
        (contract_path, "directional-parts-contract"),
        (pose_path, "right-pose-authority"),
        (Path(__file__), "compiler-source"),
        (
            ROOT / "scripts/actor-pose-prototype/a2_layered2d.py",
            "shared-joint-compiler",
        ),
        (
            ROOT / "scripts/actor-pose-prototype/a3_factorial.py",
            "shared-runtime-style-compiler",
        ),
        (ROOT / "scripts/sprite_row_quality.py", "quality-gate-source"),
    ):
        data = path.read_bytes()
        files[path.relative_to(ROOT).as_posix()] = {
            "sha256": digest(data),
            "bytes": len(data),
            "owner": owner,
        }
    return contract, sheets, pose, files


def source_parts_for(
    contract: dict[str, Any],
    sheets: dict[str, Image.Image],
    direction: str,
) -> dict[str, Image.Image]:
    parts: dict[str, Image.Image] = {}
    # The side-view source art faces left as painted.  Right is compiled by
    # flipping each independent component before joint placement.  Left keeps
    # the original components and receives reflected joints; no completed
    # frame is mirrored.
    transform = "flip-x" if direction == "right" else "none"
    for owner in ("identity", "garment"):
        for name, box in contract[owner]["parts"][direction].items():
            parts[f"{owner}:{name}"] = crop_component(
                sheets[owner],
                box,
                transform=transform if direction in ("left", "right") else "none",
            )
    return parts


def reflect_point(point: list[int]) -> list[int]:
    return [W - point[0], point[1]]


def reflected_side_pose(frame: dict[str, Any]) -> dict[str, Any]:
    result = copy.deepcopy(frame)
    for key in ("head", "torso", "pelvis"):
        result[key] = reflect_point(result[key])
    for side in ("near", "far"):
        for key in ("hip", "knee", "ankle", "heel", "toe"):
            result[side][key] = reflect_point(result[side][key])
        run = result[side].get("sole_run")
        if run is not None:
            result[side]["sole_run"] = [W - run[1], W - run[0]]
    for group in ("shoulders", "elbows", "wrists", "hands"):
        for side in ("near", "far"):
            result[group][side] = reflect_point(result[group][side])
    for key in ("right_hand", "left_hand", "load", "belt"):
        result["sockets"][key] = reflect_point(result["sockets"][key])
    return result


def cardinal_leg(
    side: str,
    base_leg: dict[str, Any],
    *,
    direction: str,
    body_dy: int,
) -> dict[str, Any]:
    if direction == "down":
        base_x = 27 if side == "near" else 37
        depth_sign = 1
    else:
        base_x = 37 if side == "near" else 27
        depth_sign = -1
    source_offset = base_leg["toe"][0] - base_leg["hip"][0]
    foot_shift = max(-2, min(2, round(source_offset * 0.22))) * depth_sign
    knee_offset = max(
        -2,
        min(2, round((base_leg["knee"][0] - base_leg["hip"][0]) * 0.18)),
    ) * depth_sign
    center_x = base_x + foot_shift
    bottom = max(base_leg["heel"][1], base_leg["toe"][1])
    contact = base_leg.get("sole_run") is not None
    ankle_y = min(76, bottom - 3)
    run = [center_x - 2, center_x + 2] if contact else None
    return {
        "hip": [base_x, 53 + body_dy],
        "knee": [base_x + knee_offset, 64 + body_dy],
        "ankle": [center_x, ankle_y],
        "heel": [center_x - 2, bottom],
        "toe": [center_x + 2, bottom],
        "sole_run": run,
        "foot_state": base_leg["foot_state"],
    }


def cardinal_pose(
    direction: str,
    frame: dict[str, Any],
) -> dict[str, Any]:
    body_dy = frame["body_dy"]
    if direction == "down":
        near_x, far_x = 24, 40
        head_x = 32 + (1 if frame["frame"] in (2, 3) else 0)
    elif direction == "up":
        near_x, far_x = 40, 24
        head_x = 32 - (1 if frame["frame"] in (6, 7) else 0)
    else:
        raise A2Error(f"not a cardinal pose: {direction}")
    hand_y = 49 + body_dy
    result = {
        "frame": frame["frame"],
        "phase": frame["phase"],
        "body_dy": body_dy,
        "contacts": list(frame["contacts"]),
        "head": [head_x, 16 + body_dy],
        "torso": [32, 38 + body_dy],
        "pelvis": [32, 53 + body_dy],
        "near": cardinal_leg(
            "near",
            frame["near"],
            direction=direction,
            body_dy=body_dy,
        ),
        "far": cardinal_leg(
            "far",
            frame["far"],
            direction=direction,
            body_dy=body_dy,
        ),
        "shoulders": {
            "near": [near_x, 33 + body_dy],
            "far": [far_x, 33 + body_dy],
        },
        "elbows": {
            "near": [near_x - (1 if direction == "down" else -1), 41 + body_dy],
            "far": [far_x + (1 if direction == "down" else -1), 41 + body_dy],
        },
        "wrists": {
            "near": [near_x + (1 if direction == "down" else -1), 47 + body_dy],
            "far": [far_x - (1 if direction == "down" else -1), 47 + body_dy],
        },
        "hands": {
            "near": [near_x + (2 if direction == "down" else -2), hand_y],
            "far": [far_x - (2 if direction == "down" else -2), hand_y],
        },
    }
    result["sockets"] = {
        "right_hand": list(result["hands"]["near"]),
        "left_hand": list(result["hands"]["far"]),
        "load": [32, 51 + body_dy],
        "belt": [32, 51 + body_dy],
    }
    return result


def cardinal_texture(
    parts: dict[str, Image.Image],
    owner: str,
    kind: str,
    side: str,
    direction: str,
) -> Image.Image:
    screen_side = (
        "left"
        if (
            (direction == "down" and side == "near")
            or (direction == "up" and side == "far")
        )
        else "right"
    )
    return parts[f"{owner}:{kind}_screen_{screen_side}"]


def compose_cardinal_frame(
    parts: dict[str, Image.Image],
    pose_frame: dict[str, Any],
    direction: str,
    render_profile: dict[str, Any] | None = None,
) -> tuple[dict[str, Image.Image], dict[str, Any]]:
    profile = {
        **DEFAULT_CARDINAL_RENDER_PROFILE,
        **(render_profile or {}),
    }
    near = pose_frame["near"]
    far = pose_frame["far"]
    shoulders = pose_frame["shoulders"]
    elbows = pose_frame["elbows"]
    wrists = pose_frame["wrists"]
    hands = pose_frame["hands"]
    pieces: list[tuple[str, str, Image.Image]] = []

    def add(owner: str, label: str, image: Image.Image) -> None:
        pieces.append((owner, label, image))

    def leg_chain(
        side: str,
        data: dict[str, Any],
        is_far: bool,
    ) -> list[tuple[str, str, Image.Image]]:
        identity_label = f"identity-leg-{side}"
        garment_label = f"garment-boot-{side}"
        identity_source = parts["identity:leg"]
        garment_source = parts["garment:boot"]
        identity_width = profile[
            "identity_leg_far_width"
            if is_far
            else "identity_leg_near_width"
        ]
        garment_width = profile[
            "garment_leg_far_width"
            if is_far
            else "garment_leg_near_width"
        ]
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

    def upper_arm(
        side: str,
        is_far: bool,
    ) -> list[tuple[str, str, Image.Image]]:
        width = profile[
            "upper_arm_far_width"
            if is_far
            else "upper_arm_near_width"
        ]
        identity_source = cardinal_texture(
            parts, "identity", "arm", side, direction
        )
        garment_source = cardinal_texture(
            parts, "garment", "sleeve", side, direction
        )
        return [
            (
                "identity",
                f"identity-arm-{side}",
                segment_piece(
                    identity_source,
                    tuple(shoulders[side]),
                    tuple(elbows[side]),
                    width,
                    width - 0.5,
                    far=is_far,
                ),
            ),
            (
                "garment",
                f"garment-sleeve-{side}",
                segment_piece(
                    garment_source,
                    tuple(shoulders[side]),
                    tuple(elbows[side]),
                    width + 1.4,
                    width,
                    far=is_far,
                ),
            ),
        ]

    def forearm(
        side: str,
        is_far: bool,
    ) -> list[tuple[str, str, Image.Image]]:
        width = profile[
            "forearm_far_width"
            if is_far
            else "forearm_near_width"
        ]
        source = cardinal_texture(
            parts, "identity", "arm", side, direction
        )
        return [
            (
                "identity",
                f"identity-arm-{side}",
                segment_piece(
                    source,
                    tuple(elbows[side]),
                    tuple(wrists[side]),
                    width,
                    width - 0.7,
                    far=is_far,
                ),
            ),
            (
                "identity",
                f"identity-arm-{side}",
                segment_piece(
                    source,
                    tuple(wrists[side]),
                    tuple(hands[side]),
                    width - 0.7,
                    width - 1.2,
                    far=is_far,
                ),
            ),
        ]

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
            tuple(profile["identity_torso_size"]),
            tuple(pose_frame["torso"]),
        ),
    )
    add(
        "garment",
        "garment-tunic",
        direct_piece(
            parts["garment:tunic"],
            tuple(profile["garment_tunic_size"]),
            tuple(pose_frame["torso"]),
        ),
    )
    add(
        "garment",
        "garment-belt",
        direct_piece(
            parts["garment:belt"],
            tuple(profile["garment_belt_size"]),
            tuple(pose_frame["sockets"]["belt"]),
        ),
    )
    for record in forearm("far", True):
        add(*record)
    add(
        "identity",
        "identity-head",
        direct_piece(
            parts["identity:head"],
            tuple(profile["identity_head_size"]),
            tuple(pose_frame["head"]),
        ),
    )
    add(
        "garment",
        "garment-headgear",
        direct_piece(
            parts["garment:headgear"],
            tuple(profile["garment_headgear_size"]),
            (pose_frame["head"][0], pose_frame["head"][1] - 1),
        ),
    )
    for record in upper_arm("near", False):
        add(*record)
    for record in forearm("near", False):
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
        **copy.deepcopy(pose_frame),
        "root": [32, GROUND_Y],
        "direction": direction,
    }


def apply_attachment(
    result: dict[str, Image.Image],
    pose_frame: dict[str, Any],
    source: Image.Image,
    contract: dict[str, Any],
    direction: str,
) -> dict[str, Image.Image]:
    crop = contract["attachment"]["parts"][direction]
    render = contract["attachment"]["render"][direction]
    component = crop_component(
        source,
        crop,
        transform=render["transform"],
    )
    socket = pose_frame["sockets"]["load"]
    center = (
        socket[0] + render["offset"][0],
        socket[1] + render["offset"][1],
    )
    attachment = direct_piece(
        component,
        tuple(render["size"]),
        center,
    )

    original_flattened = result["flattened"]
    original_semantic = result["semantic"]
    near_colors = {
        SEMANTIC_COLORS["identity-arm-near"],
        SEMANTIC_COLORS["garment-sleeve-near"],
    }
    near_mask = Image.new("L", (W, H), 0)
    near_mask.putdata(
        [
            255 if pixel in near_colors else 0
            for pixel in original_semantic.get_flattened_data()
        ]
    )
    near_surface = blank()
    near_surface.paste(original_flattened, (0, 0), near_mask)
    near_semantic = blank()
    near_semantic.paste(original_semantic, (0, 0), near_mask)
    flattened = original_flattened.copy()
    flattened.alpha_composite(attachment)
    flattened.alpha_composite(near_surface)
    semantic = original_semantic.copy()
    semantic.alpha_composite(
        semantic_plane(attachment, ATTACHMENT_SEMANTIC_COLOR)
    )
    semantic.alpha_composite(near_semantic)
    return {
        **result,
        "flattened": flattened,
        "attachment": attachment,
        "semantic": semantic,
    }


def quality_for(
    row_bytes: bytes,
    relative: str,
) -> tuple[dict[str, Any], bytes]:
    with tempfile.TemporaryDirectory(prefix="realm-a4-quality-") as temp:
        temp_path = Path(temp)
        row_path = temp_path / "row.png"
        proof_path = temp_path / "proof.png"
        row_path.write_bytes(row_bytes)
        quality = analyze_row(row_path, ACTION)
        quality["path"] = relative
        write_proof(row_path, proof_path, quality)
        return quality, proof_path.read_bytes()


def validate_row(
    frames: list[Image.Image],
    planes: dict[str, list[Image.Image]],
    landmarks: list[dict[str, Any]],
    direction: str,
    attachment: str,
    quality: dict[str, Any],
) -> dict[str, Any]:
    failures: list[str] = []
    metrics: list[dict[str, Any]] = []
    hashes = [digest(frame.tobytes()) for frame in frames]
    heights: list[int] = []
    masses: list[float] = []
    if len(set(hashes)) != BEATS:
        failures.append("row does not contain eight distinct frames")
    for index, (frame, info) in enumerate(zip(frames, landmarks)):
        box = alpha_bbox(frame)
        if box is None:
            failures.append(f"frame {index} is blank")
            continue
        height = box[3] - box[1]
        mass = round(
            sum(frame.getchannel("A").get_flattened_data()) / 255,
            2,
        )
        heights.append(height)
        masses.append(mass)
        runs = visible_runs(frame, GROUND_Y)
        expected_runs = sorted(
            value
            for side in ("far", "near")
            if (value := info[side].get("sole_run")) is not None
        )
        if runs != expected_runs:
            failures.append(
                f"frame {index} ground runs {runs} != {expected_runs}"
            )
        if box[3] - 1 != GROUND_Y:
            failures.append(f"frame {index} does not register on y={GROUND_Y}")
        if not 75 <= height <= 77:
            failures.append(
                f"frame {index} body height {height}px is outside 76±1"
            )
        if box[0] <= 1 or box[2] >= W - 1 or box[1] <= 1:
            failures.append(f"frame {index} enters the edge safety band")
        if any(
            frame.getchannel("A").getpixel((x, y)) >= 18
            for y in range(80, H)
            for x in range(W)
        ):
            failures.append(f"frame {index} occupies a reserved clear row")
        if info["root"] != [32, GROUND_Y]:
            failures.append(f"frame {index} root drifted")
        cargo_box = alpha_bbox(planes["attachment"][index])
        if attachment == "off" and cargo_box is not None:
            failures.append(f"frame {index} off state contains cargo pixels")
        if attachment != "off":
            load = info["sockets"]["load"]
            if cargo_box is None or not (
                cargo_box[0] <= load[0] < cargo_box[2]
                and cargo_box[1] <= load[1] < cargo_box[3]
            ):
                failures.append(
                    f"frame {index} cargo does not own the load socket"
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
                "cargo_bbox": list(cargo_box) if cargo_box else None,
                "sha256_rgba": hashes[index],
            }
        )
    if heights and statistics.median(heights) != 76:
        failures.append(
            f"median body height {statistics.median(heights)}px != 76px"
        )
    if masses and max(masses) / min(masses) > 1.16:
        failures.append(
            f"alpha-mass ratio {max(masses) / min(masses):.3f} exceeds 1.16"
        )
    deltas = [
        frame_delta(frames[index], frames[(index + 1) % BEATS])
        for index in range(BEATS)
    ]
    internal_median = statistics.median(deltas[:-1])
    loop_ratio = deltas[-1] / max(1, internal_median)
    if not 0.55 <= loop_ratio <= 1.55:
        failures.append(
            f"loop delta ratio {loop_ratio:.3f} outside [0.55, 1.55]"
        )
    quality_failures = list(quality["errors"]) + list(quality["warnings"])
    if quality.get("styleEra") != "painted":
        quality_failures.append(
            f"row classified as {quality.get('styleEra')}, not painted"
        )
    failures.extend(f"quality: {failure}" for failure in quality_failures)
    return {
        "schema": "realm.actor-pose.a4-row-gate.v1",
        "scope": {
            "identity": IDENTITY,
            "garment": GARMENT,
            "attachment": attachment,
            "action": ACTION,
            "direction": direction,
        },
        "frame_metrics": metrics,
        "body_heights": heights,
        "alpha_mass_ratio": max(masses) / min(masses) if masses else None,
        "transition_deltas": deltas,
        "loop_delta_ratio": loop_ratio,
        "production_quality": {
            "style_era": quality["styleEra"],
            "median_body_height": quality["medianBodyHeight"],
            "body_height_range": quality["bodyHeightRange"],
            "body_width_range": quality["bodyWidthRange"],
            "body_bottom_range": quality["bodyBottomRange"],
            "flicker_score": quality["flickerScore"],
            "max_alpha_ratio": quality["maxAlphaRatio"],
            "max_fragment_pixels": quality["maxFragmentPixels"],
            "warnings": quality["warnings"],
            "errors": quality["errors"],
        },
        "mechanical_passed": not failures,
        "failures": failures,
    }


def build_row(
    contract: dict[str, Any],
    sheets: dict[str, Image.Image],
    pose: dict[str, Any],
    direction: str,
    attachment: str,
) -> tuple[dict[str, bytes], dict[str, Any], dict[str, Image.Image]]:
    parts = source_parts_for(contract, sheets, direction)
    frames: list[Image.Image] = []
    landmarks: list[dict[str, Any]] = []
    plane_frames: dict[str, list[Image.Image]] = {
        name: []
        for name in ("identity", "garment", "attachment", "semantic")
    }
    for base_frame in pose["frames"]:
        if direction == "right":
            pose_frame = copy.deepcopy(base_frame)
            result, metadata = compose_frame(
                parts,
                pose_frame,
                {
                    "identity_leg_far_width": 7.5,
                    "identity_leg_near_width": 8.8,
                    "garment_leg_far_width": 8.7,
                    "garment_leg_near_width": 10.0,
                    "identity_torso_size": [26, 31],
                    "garment_tunic_size": [30, 34],
                    "garment_belt_size": [27, 5],
                    "identity_head_size": [24, 24],
                    "garment_headgear_size": [28, 22],
                },
            )
            metadata["direction"] = direction
        elif direction == "left":
            pose_frame = reflected_side_pose(base_frame)
            result, metadata = compose_frame(
                parts,
                pose_frame,
                {
                    "identity_leg_far_width": 7.5,
                    "identity_leg_near_width": 8.8,
                    "garment_leg_far_width": 8.7,
                    "garment_leg_near_width": 10.0,
                    "identity_torso_size": [26, 31],
                    "garment_tunic_size": [30, 34],
                    "garment_belt_size": [27, 5],
                    "identity_head_size": [24, 24],
                    "garment_headgear_size": [28, 22],
                },
            )
            metadata["direction"] = direction
        else:
            pose_frame = cardinal_pose(direction, base_frame)
            result, metadata = compose_cardinal_frame(
                parts,
                pose_frame,
                direction,
            )
        if attachment != "off":
            result = apply_attachment(
                result,
                pose_frame,
                sheets["attachment"],
                contract,
                direction,
            )
        frames.append(result["flattened"])
        landmarks.append(metadata)
        for name in plane_frames:
            plane_frames[name].append(result[name])

    row = strip(frames)
    prefix = f"{IDENTITY}/{GARMENT}/{attachment}/{ACTION}-{direction}"
    row_relative = f"rows/{prefix}.png"
    row_bytes = png(row)
    quality, quality_proof = quality_for(row_bytes, row_relative)
    gate = validate_row(
        frames,
        plane_frames,
        landmarks,
        direction,
        attachment,
        quality,
    )
    runtime_paths = {
        tier: f"rows-runtime/{tier}/{prefix}.png"
        for tier, _frame_w, _frame_h in RUNTIME_TIERS
    }
    artifacts = {
        row_relative: row_bytes,
        **{
            runtime_paths[tier]: png(
                runtime_row(frames, (frame_w, frame_h))
            )
            for tier, frame_w, frame_h in RUNTIME_TIERS
        },
        f"planes/identity/{prefix}.png": png(
            strip(plane_frames["identity"])
        ),
        f"planes/garment/{prefix}.png": png(
            strip(plane_frames["garment"])
        ),
        f"planes/attachment/{prefix}.png": png(
            strip(plane_frames["attachment"])
        ),
        f"id-masks/{prefix}.png": png(strip(plane_frames["semantic"])),
        f"landmarks/{prefix}.json": canonical(
            {
                "schema": "realm.actor-pose.a4-landmarks.v1",
                "scope": gate["scope"],
                "frames": landmarks,
            }
        ),
        f"reports/quality/{attachment}-{direction}.json": canonical(quality),
        f"proof/quality/{attachment}-{direction}-x4.png": quality_proof,
    }
    record = {
        "scope": gate["scope"],
        "row": row_relative,
        "runtime_rows": runtime_paths,
        "identity_plane": f"planes/identity/{prefix}.png",
        "garment_plane": f"planes/garment/{prefix}.png",
        "attachment_plane": f"planes/attachment/{prefix}.png",
        "semantic_mask": f"id-masks/{prefix}.png",
        "landmarks": f"landmarks/{prefix}.json",
        "quality_report": f"reports/quality/{attachment}-{direction}.json",
        "quality_proof": f"proof/quality/{attachment}-{direction}-x4.png",
        "gate": gate,
    }
    images = {
        "row": row,
        "identity": strip(plane_frames["identity"]),
        "garment": strip(plane_frames["garment"]),
        "attachment": strip(plane_frames["attachment"]),
        "semantic": strip(plane_frames["semantic"]),
    }
    return artifacts, record, images


def still_contact(
    records: dict[tuple[str, str], dict[str, Any]],
    images: dict[tuple[str, str], dict[str, Image.Image]],
) -> Image.Image:
    scale = 3
    label_h = 18
    result = Image.new(
        "RGBA",
        (ROW_W * scale, len(records) * (H * scale + label_h)),
        "#0d1820ff",
    )
    draw = ImageDraw.Draw(result)
    for index, key in enumerate(sorted(records)):
        direction, attachment = key
        y = index * (H * scale + label_h)
        draw.text(
            (6, y + 3),
            f"guard / carry / {direction} / {attachment}",
            fill="#dbe7eb",
        )
        enlarged = images[key]["row"].resize(
            (ROW_W * scale, H * scale),
            Image.Resampling.NEAREST,
        )
        result.alpha_composite(enlarged, (0, y + label_h))
    return result


def build(
    contract: dict[str, Any],
    sheets: dict[str, Image.Image],
    pose: dict[str, Any],
) -> tuple[
    dict[str, bytes],
    dict[tuple[str, str], dict[str, Any]],
    dict[str, Any],
]:
    combinations = [
        (direction, attachment)
        for direction in DIRECTIONS
        for attachment in ATTACHMENTS
    ]
    artifacts: dict[str, bytes] = {}
    records: dict[tuple[str, str], dict[str, Any]] = {}
    images: dict[tuple[str, str], dict[str, Image.Image]] = {}
    for direction, attachment in combinations:
        built, record, row_images = build_row(
            contract,
            sheets,
            pose,
            direction,
            attachment,
        )
        artifacts.update(built)
        records[(direction, attachment)] = record
        images[(direction, attachment)] = row_images

    default_rows = []
    for direction, attachment in combinations:
        relative = records[(direction, attachment)]["runtime_rows"]["default"]
        default_rows.append(
            Image.open(io.BytesIO(artifacts[relative])).convert("RGBA")
        )
    palette, colors = derive_runtime_palette(default_rows)
    styled_default_rows: dict[tuple[str, str], Image.Image] = {}
    for key in combinations:
        for tier, relative in records[key]["runtime_rows"].items():
            raw = Image.open(io.BytesIO(artifacts[relative])).convert("RGBA")
            styled = apply_runtime_style(raw, palette)
            artifacts[relative] = png(styled)
            if tier == "default":
                styled_default_rows[key] = styled

    failures = [
        f"{direction}/{attachment}: {failure}"
        for (direction, attachment), record in sorted(records.items())
        for failure in record["gate"]["failures"]
    ]
    row_hashes = {
        key: digest(images[key]["row"].tobytes())
        for key in combinations
    }
    direction_hashes = {
        direction: row_hashes[(direction, "cargo-crate")]
        for direction in DIRECTIONS
    }
    if len(set(direction_hashes.values())) != len(DIRECTIONS):
        failures.append("cargo direction rows are not all visually distinct")
    if (
        images[("left", "cargo-crate")]["row"].tobytes()
        == images[("right", "cargo-crate")]["row"].transpose(
            Image.Transpose.FLIP_LEFT_RIGHT
        ).tobytes()
    ):
        failures.append("left cargo row is a forbidden finished-row mirror")

    styled_colors = {
        pixel[:3]
        for row in styled_default_rows.values()
        for pixel in row.get_flattened_data()
        if pixel[3]
    }
    styled_alpha = {
        pixel[3]
        for row in styled_default_rows.values()
        for pixel in row.get_flattened_data()
    }
    runtime_style = {
        **RUNTIME_STYLE,
        "actual_palette_colors": len(styled_colors),
        "actual_alpha_values": sorted(styled_alpha),
        "palette_hex": [
            f"#{red:02x}{green:02x}{blue:02x}"
            for red, green, blue in colors
        ],
        "mechanical_passed": (
            len(styled_colors) <= RUNTIME_STYLE["palette_colors"]
            and styled_alpha <= {0, 255}
        ),
    }
    if not runtime_style["mechanical_passed"]:
        failures.append("runtime style exceeded palette or alpha contract")
    gate = {
        "schema": "realm.actor-pose.a4-guard-family-gate.v1",
        "scope": contract["scope"],
        "rows": len(combinations),
        "frames": len(combinations) * BEATS,
        "directions": list(DIRECTIONS),
        "attachments": list(ATTACHMENTS),
        "distinct_direction_rows": len(set(direction_hashes.values())),
        "finished_row_mirroring": False,
        "runtime_style": runtime_style,
        "row_gates": {
            f"{direction}/{attachment}": records[
                (direction, attachment)
            ]["gate"]
            for direction, attachment in sorted(records)
        },
        "mechanical_passed": not failures,
        "failures": failures,
    }
    artifacts["proof/guard-carry-four-directions-x3.png"] = png(
        still_contact(records, images)
    )
    artifacts["style/actor-palette.png"] = png(palette_swatch(colors))
    artifacts["style/actor-palette.json"] = canonical(
        {
            "schema": "realm.actor-pose.a4-runtime-palette.v1",
            **RUNTIME_STYLE,
            "colors": runtime_style["palette_hex"],
        }
    )
    artifacts["reports/guard-family-gate.json"] = canonical(gate)
    return artifacts, records, gate


def manifest(
    files: dict[str, dict[str, Any]],
    artifacts: dict[str, bytes],
    records: dict[tuple[str, str], dict[str, Any]],
    gate: dict[str, Any],
    deterministic: bool,
) -> dict[str, Any]:
    return {
        "schema": "realm.actor-pose.a4-guard-family-manifest.v1",
        "candidate": "a4-guard-family",
        "stage": "guard-carry-four-directions",
        "status": (
            "direction-family-proven"
            if gate["mechanical_passed"] and deterministic
            else "direction-family-veto"
        ),
        "scope": {
            **gate["scope"],
            "flattened_rows": gate["rows"],
            "flattened_frames": gate["frames"],
            "frame_size": [W, H],
            "row_size": [ROW_W, H],
            "root": [32, GROUND_Y],
            "runtime": (
                "none; modular sources compile to flattened rows and "
                "prefiltered exact-size runtime tiers"
            ),
            "runtime_tiers": [
                {
                    "key": key,
                    "frame_size": [frame_w, frame_h],
                    "row_size": [frame_w * BEATS, frame_h],
                }
                for key, frame_w, frame_h in RUNTIME_TIERS
            ],
        },
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
            "finished_frame_or_row_mirroring": False,
            "runtime_skeletal_renderer": False,
        },
        "outputs": {
            path: {"sha256": digest(data), "bytes": len(data)}
            for path, data in sorted(artifacts.items())
        },
        "rows": {
            f"{direction}/{attachment}": record
            for (direction, attachment), record in sorted(records.items())
        },
        "proof": {
            "directional_still": "proof/guard-carry-four-directions-x3.png",
            "runtime_palette": "style/actor-palette.png",
        },
        "verification": {
            "mechanical_passed": gate["mechanical_passed"],
            "byte_deterministic_second_pass": deterministic,
            "report": "reports/guard-family-gate.json",
            "failures": gate["failures"],
        },
        "compiler": {
            "path": "scripts/actor-pose-prototype/a4_guard_family.py",
            "python": f"{sys.version_info.major}.{sys.version_info.minor}",
            "pillow": Image.__version__,
            "runtime_proof_downsample": {
                "filter": "Box",
                "unsharp": {
                    "radius": 0.7,
                    "percent": 80,
                    "threshold": 5,
                },
                "transparent_rgb": "#000000",
            },
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
        description="Compile the Realm A4 four-direction guard carry family."
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
        contract, sheets, pose, files = load_inputs(
            args.source_dir.resolve()
        )
        artifacts, records, gate = build(contract, sheets, pose)
        second = build(contract, sheets, pose) if args.verify else None
        deterministic = bool(
            second
            and artifacts == second[0]
            and canonical(
                {
                    f"{key[0]}/{key[1]}": value
                    for key, value in records.items()
                }
            )
            == canonical(
                {
                    f"{key[0]}/{key[1]}": value
                    for key, value in second[1].items()
                }
            )
            and canonical(gate) == canonical(second[2])
        )
        if gate["failures"]:
            raise A2Error("; ".join(gate["failures"]))
        if args.verify and not deterministic:
            raise A2Error("second in-memory A4 build differed")
        document = manifest(
            files,
            artifacts,
            records,
            gate,
            deterministic,
        )
        write_output(args.out_dir.resolve(), artifacts, document)
        print(
            "A4 guard family OK: "
            f"{gate['rows']} flattened rows / {gate['frames']} frames; "
            "four directions use modular source parts"
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
        print(f"A4 guard family failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
