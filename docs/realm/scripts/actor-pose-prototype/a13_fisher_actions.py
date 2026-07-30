#!/usr/bin/env python3
"""Compile one coherent four-action, four-direction Realm fisher family.

A13 applies the proven A4/A5 modular actor system to the harborhand identity
and storm-teal clothing. Idle, walk, work, and carry share one body, garment,
palette, lighting model, root, and scale. The gaff, grounded fish creel, and cargo
remain independent authoring planes; the runtime receives ordinary flattened
512x84 animation rows plus exact-size prefiltered tiers.
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
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import a4_guard_family as a4  # noqa: E402
import a5_guard_actions as a5  # noqa: E402
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
    png,
    quantize,
    semantic_plane,
    strip,
    trim,
)
from a3_factorial import (  # noqa: E402
    RUNTIME_STYLE,
    RUNTIME_TIERS,
    apply_runtime_style,
    derive_runtime_palette,
    palette_swatch,
    runtime_row,
)


PROTO = ROOT / "assets/sprites/prototypes/actor-pose"
SOURCE = PROTO / "source/a13-fisher-actions"
OUT = PROTO / "output/a13-fisher-actions"
ACTIONS = ("idle", "walk", "work", "carry")
DIRECTIONS = ("down", "up", "left", "right")
ROLE = "fisher"
IDENTITY = "harborhand"
GARMENT = "storm-teal"
TOOL_COLOR = (146, 137, 117, 255)
WORKSTATION_COLOR = (180, 132, 69, 255)
WORK_PHASES = (
    "ready",
    "sight",
    "reach",
    "hook",
    "draw",
    "lift",
    "stow",
    "recover",
)
WORK_VECTORS = {
    "right": (
        (3, -20),
        (7, -17),
        (12, -10),
        (17, 11),
        (13, 15),
        (5, 3),
        (4, -10),
        (3, -20),
    ),
    "left": (
        (-3, -20),
        (-7, -17),
        (-12, -10),
        (-17, 11),
        (-13, 15),
        (-5, 3),
        (-4, -10),
        (-3, -20),
    ),
    "down": (
        (7, -16),
        (5, -19),
        (0, -18),
        (-3, 8),
        (5, 19),
        (4, 10),
        (7, -5),
        (7, -16),
    ),
    "up": (
        (-3, -20),
        (-7, -17),
        (-12, -10),
        (-17, 11),
        (-13, -15),
        (-5, 3),
        (-4, -10),
        (-3, -20),
    ),
}


def file_sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate_crop(
    sheet: Image.Image,
    box: Any,
    label: str,
    *,
    require_margin: bool,
) -> None:
    if (
        not isinstance(box, list)
        or len(box) != 4
        or any(type(value) is not int for value in box)
    ):
        raise A2Error(f"A13 {label} crop is malformed")
    left, top, right, bottom = box
    if not (
        0 <= left < right <= sheet.width
        and 0 <= top < bottom <= sheet.height
    ):
        raise A2Error(f"A13 {label} crop is outside its source")
    crop = sheet.crop(tuple(box))
    bbox = a4.alpha_bbox(crop)
    if bbox is None:
        raise A2Error(f"A13 {label} crop is blank")
    if require_margin and min(
        bbox[0],
        bbox[1],
        crop.width - bbox[2],
        crop.height - bbox[3],
    ) < 8:
        raise A2Error(f"A13 {label} lacks an 8px transparent crop margin")


def load_inputs(
    source_dir: Path,
) -> tuple[
    dict[str, Any],
    dict[str, Image.Image],
    dict[str, Any],
    Image.Image,
    Image.Image,
    dict[str, dict[str, Any]],
]:
    contract_path = source_dir / "parts.json"
    contract = json.loads(contract_path.read_text())
    if contract.get("schema") != "realm.actor-pose.a13-fisher-actions.v1":
        raise A2Error("A13 parts contract must be v1")
    if contract.get("stage") != "fisher-four-action-family":
        raise A2Error("A13 contract stage changed")
    scope = contract.get("scope", {})
    if scope.get("role") != ROLE:
        raise A2Error("A13 role must remain fisher")
    if tuple(scope.get("actions", [])) != ACTIONS:
        raise A2Error("A13 must declare four ordered actions")
    if tuple(scope.get("directions", [])) != DIRECTIONS:
        raise A2Error("A13 must declare four ordered directions")
    if scope.get("identity") != IDENTITY or scope.get("garment") != GARMENT:
        raise A2Error("A13 identity or garment authority changed")

    sheets: dict[str, Image.Image] = {}
    files: dict[str, dict[str, Any]] = {}
    for owner in ("identity", "garment", "attachment"):
        record = contract[owner]
        path = ROOT / record["path"]
        data = path.read_bytes()
        actual = digest(data)
        if actual != record["sha256"]:
            raise A2Error(f"A13 {owner} source hash changed")
        sheet = Image.open(io.BytesIO(data)).convert("RGBA")
        sheets[owner] = sheet
        files[record["path"]] = {
            "sha256": actual,
            "bytes": len(data),
            "owner": owner,
        }
        if owner in ("identity", "garment"):
            keyed_record = record["generation_source"]
            keyed_path = ROOT / keyed_record["path"]
            keyed_actual = file_sha(keyed_path)
            if keyed_actual != keyed_record["sha256"]:
                raise A2Error(f"A13 keyed {owner} source hash changed")
            prompt_path = ROOT / record["source_prompt"]
            prompt = json.loads(prompt_path.read_text())
            if prompt.get("alpha_sha256") != record["sha256"]:
                raise A2Error(
                    f"A13 {owner} prompt alpha provenance changed"
                )
            if prompt.get("keyed_sha256") != keyed_record["sha256"]:
                raise A2Error(
                    f"A13 {owner} prompt keyed provenance changed"
                )
            for generated_path, generated_owner in (
                (keyed_path, f"imagegen-keyed-{owner}-source"),
                (prompt_path, f"imagegen-{owner}-provenance"),
            ):
                generated_data = generated_path.read_bytes()
                files[generated_path.relative_to(ROOT).as_posix()] = {
                    "sha256": digest(generated_data),
                    "bytes": len(generated_data),
                    "owner": generated_owner,
                }
        for direction in DIRECTIONS:
            boxes = record["parts"].get(direction)
            if boxes is None:
                raise A2Error(f"A13 {owner} lacks {direction} source parts")
            if owner == "attachment":
                boxes = {"attachment": boxes}
            for name, box in boxes.items():
                validate_crop(
                    sheet,
                    box,
                    f"{owner}/{direction}/{name}",
                    require_margin=owner != "attachment",
                )

    tool_record = contract["tool"]
    tool_path = ROOT / tool_record["path"]
    tool_data = tool_path.read_bytes()
    if digest(tool_data) != tool_record["sha256"]:
        raise A2Error("A13 harbor-gaff source hash changed")
    tool_sheet = Image.open(io.BytesIO(tool_data)).convert("RGBA")
    for direction in DIRECTIONS:
        validate_crop(
            tool_sheet,
            tool_record["parts"].get(direction),
            f"tool/{direction}",
            require_margin=True,
        )

    keyed_record = tool_record["generation_source"]
    keyed_path = ROOT / keyed_record["path"]
    if file_sha(keyed_path) != keyed_record["sha256"]:
        raise A2Error("A13 keyed harbor-gaff source hash changed")
    prompt_path = ROOT / tool_record["source_prompt"]
    prompt = json.loads(prompt_path.read_text())
    if prompt.get("alpha_sha256") != tool_record["sha256"]:
        raise A2Error("A13 harbor-gaff prompt alpha provenance changed")
    if prompt.get("keyed_sha256") != keyed_record["sha256"]:
        raise A2Error("A13 harbor-gaff prompt keyed provenance changed")

    workstation_record = contract["workstation"]
    workstation_path = ROOT / workstation_record["path"]
    workstation_data = workstation_path.read_bytes()
    if digest(workstation_data) != workstation_record["sha256"]:
        raise A2Error("A13 fish-creel source hash changed")
    workstation_sheet = Image.open(
        io.BytesIO(workstation_data)
    ).convert("RGBA")
    for direction in DIRECTIONS:
        validate_crop(
            workstation_sheet,
            workstation_record["parts"].get(direction),
            f"workstation/{direction}",
            require_margin=True,
        )
    workstation_keyed_record = workstation_record["generation_source"]
    workstation_keyed_path = ROOT / workstation_keyed_record["path"]
    if file_sha(workstation_keyed_path) != workstation_keyed_record["sha256"]:
        raise A2Error("A13 keyed fish-creel source hash changed")
    workstation_prompt_path = ROOT / workstation_record["source_prompt"]
    workstation_prompt = json.loads(workstation_prompt_path.read_text())
    if workstation_prompt.get("alpha_sha256") != workstation_record["sha256"]:
        raise A2Error("A13 fish-creel prompt alpha provenance changed")
    if (
        workstation_prompt.get("keyed_sha256")
        != workstation_keyed_record["sha256"]
    ):
        raise A2Error("A13 fish-creel prompt keyed provenance changed")

    pose_record = contract["pose"]["right_source"]
    pose_path = ROOT / pose_record["path"]
    if file_sha(pose_path) != pose_record["sha256"]:
        raise A2Error("A13 right-pose authority hash changed")
    pose = json.loads(pose_path.read_text())
    if pose.get("schema") != "realm.actor-pose.a2-pose.v2":
        raise A2Error("A13 requires the approved A2 v2 pose")
    if len(pose.get("frames", [])) != BEATS:
        raise A2Error("A13 requires exactly eight pose beats")

    for path, owner in (
        (contract_path, "fisher-family-contract"),
        (keyed_path, "imagegen-keyed-tool-source"),
        (tool_path, "painted-tool-source"),
        (prompt_path, "imagegen-provenance"),
        (workstation_keyed_path, "imagegen-keyed-workstation-source"),
        (workstation_path, "painted-workstation-source"),
        (workstation_prompt_path, "imagegen-workstation-provenance"),
        (pose_path, "right-pose-authority"),
        (Path(__file__), "compiler-source"),
        (
            ROOT / "scripts/actor-pose-prototype/a4_guard_family.py",
            "shared-direction-compiler",
        ),
        (
            ROOT / "scripts/actor-pose-prototype/a5_guard_actions.py",
            "shared-action-and-row-gate",
        ),
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
    return contract, sheets, pose, tool_sheet, workstation_sheet, files


def action_pose(
    action: str,
    direction: str,
    base: dict[str, Any],
) -> dict[str, Any]:
    frame = a5.action_pose(action, direction, base)
    if action != "work":
        return frame
    index = frame["frame"]
    frame["phase"] = WORK_PHASES[index]
    frame["weapon_vector"] = list(WORK_VECTORS[direction][index])
    return frame


def compose_body(
    parts: dict[str, Image.Image],
    pose_frame: dict[str, Any],
    direction: str,
    render_profile: dict[str, Any],
) -> tuple[dict[str, Image.Image], dict[str, Any]]:
    if direction in ("left", "right"):
        result, metadata = compose_frame(
            parts,
            pose_frame,
            render_profile,
        )
        metadata["direction"] = direction
        return result, metadata
    return a4.compose_cardinal_frame(
        parts,
        pose_frame,
        direction,
        render_profile,
    )


def tool_component(
    tool_sheet: Image.Image,
    contract: dict[str, Any],
    direction: str,
) -> Image.Image:
    return trim(tool_sheet.crop(tuple(contract["tool"]["parts"][direction])))


def rotated_tool(
    component: Image.Image,
    socket: list[int],
    vector: list[int],
    contract: dict[str, Any],
) -> tuple[Image.Image, list[int]]:
    authority = contract["tool"]["authority"]
    height = int(authority["render_height"])
    width = max(3, round(component.width * height / component.height))
    scaled = component.resize((width, height), Image.Resampling.LANCZOS)
    grip_fraction = float(authority["grip_fraction_from_top"])
    work_size = 96
    center = work_size // 2
    grip_y = round(height * grip_fraction)
    work = Image.new("RGBA", (work_size, work_size), (0, 0, 0, 0))
    work.alpha_composite(
        scaled,
        (center - width // 2, center - grip_y),
    )
    dx, dy = vector
    angle = math.degrees(math.atan2(-dx, -dy))
    turned = work.rotate(
        angle,
        resample=Image.Resampling.BICUBIC,
        expand=False,
        center=(center, center),
    )
    canvas = blank()
    canvas.alpha_composite(
        quantize(turned),
        (socket[0] - center, socket[1] - center),
    )
    head_distance = round(height * grip_fraction)
    magnitude = max(1.0, math.hypot(dx, dy))
    tool_tip = [
        round(socket[0] + dx * head_distance / magnitude),
        round(socket[1] + dy * head_distance / magnitude),
    ]
    return canvas, tool_tip


def apply_tool(
    result: dict[str, Image.Image],
    pose_frame: dict[str, Any],
    tool_sheet: Image.Image,
    contract: dict[str, Any],
    direction: str,
) -> tuple[dict[str, Image.Image], list[int]]:
    component = tool_component(tool_sheet, contract, direction)
    socket = pose_frame["sockets"]["right_hand"]
    tool, tool_tip = rotated_tool(
        component,
        socket,
        pose_frame["weapon_vector"],
        contract,
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
    flattened.alpha_composite(tool)
    flattened.alpha_composite(near_surface)
    semantic = original_semantic.copy()
    semantic.alpha_composite(semantic_plane(tool, TOOL_COLOR))
    semantic.alpha_composite(near_semantic)
    equipment = result["attachment"].copy()
    equipment.alpha_composite(tool)
    return {
        **result,
        "flattened": flattened,
        "attachment": equipment,
        "semantic": semantic,
    }, tool_tip


def workstation_component(
    workstation_sheet: Image.Image,
    contract: dict[str, Any],
    direction: str,
) -> Image.Image:
    return trim(
        workstation_sheet.crop(
            tuple(contract["workstation"]["parts"][direction])
        )
    )


def apply_workstation(
    result: dict[str, Image.Image],
    workstation_sheet: Image.Image,
    contract: dict[str, Any],
    direction: str,
) -> tuple[dict[str, Image.Image], dict[str, list[int]]]:
    render = contract["workstation"]["render"][direction]
    component = workstation_component(
        workstation_sheet,
        contract,
        direction,
    )
    workstation = a4.direct_piece(
        component,
        tuple(render["size"]),
        tuple(render["center"]),
    )
    workstation_semantic = semantic_plane(
        workstation,
        WORKSTATION_COLOR,
    )
    if direction == "up":
        flattened = workstation.copy()
        flattened.alpha_composite(result["flattened"])
        semantic = workstation_semantic.copy()
        semantic.alpha_composite(result["semantic"])
    else:
        flattened = result["flattened"].copy()
        flattened.alpha_composite(workstation)
        semantic = result["semantic"].copy()
        semantic.alpha_composite(workstation_semantic)
    equipment = result["attachment"].copy()
    equipment.alpha_composite(workstation)
    center_x, center_y = render["center"]
    width, height = render["size"]
    landmarks = {
        "creel_anchor": [center_x, center_y],
        "creel_catch": [center_x, center_y - height // 4],
        "workstation_bbox": [
            center_x - width // 2,
            center_y - height // 2,
            center_x + (width + 1) // 2,
            center_y + (height + 1) // 2,
        ],
    }
    return {
        **result,
        "flattened": flattened,
        "attachment": equipment,
        "semantic": semantic,
    }, landmarks


def build_row(
    contract: dict[str, Any],
    sheets: dict[str, Image.Image],
    pose: dict[str, Any],
    tool_sheet: Image.Image,
    workstation_sheet: Image.Image,
    action: str,
    direction: str,
) -> tuple[dict[str, bytes], dict[str, Any], dict[str, Image.Image]]:
    parts = a4.source_parts_for(contract, sheets, direction)
    render_profile = contract["render_profile"]
    frames: list[Image.Image] = []
    body_frames: list[Image.Image] = []
    landmarks: list[dict[str, Any]] = []
    plane_frames: dict[str, list[Image.Image]] = {
        name: []
        for name in ("identity", "garment", "attachment", "semantic")
    }
    for base_frame in pose["frames"]:
        pose_frame = action_pose(action, direction, base_frame)
        result, metadata = compose_body(
            parts,
            pose_frame,
            direction,
            render_profile,
        )
        body = result["flattened"].copy()
        if action == "carry":
            result = a4.apply_attachment(
                result,
                pose_frame,
                sheets["attachment"],
                contract,
                direction,
            )
        elif action == "work":
            result, workstation_landmarks = apply_workstation(
                result,
                workstation_sheet,
                contract,
                direction,
            )
            result, tool_tip = apply_tool(
                result,
                pose_frame,
                tool_sheet,
                contract,
                direction,
            )
            metadata["weapon_tip"] = tool_tip
            metadata["tool_tip"] = tool_tip
            metadata["tool_vector"] = list(pose_frame["weapon_vector"])
            metadata.update(workstation_landmarks)
        frames.append(result["flattened"])
        body_frames.append(body)
        landmarks.append(metadata)
        for name in plane_frames:
            plane_frames[name].append(result[name])

    row = strip(frames)
    body_row = strip(body_frames)
    prefix = f"{IDENTITY}/{GARMENT}/{action}-{direction}"
    row_relative = f"rows/{prefix}.png"
    body_relative = f"planes/body/{prefix}.png"
    row_bytes = png(row)
    body_bytes = png(body_row)
    quality, quality_proof = a5.quality_for(
        row_bytes,
        row_relative,
        action,
        "flattened",
    )
    body_quality, body_proof = a5.quality_for(
        body_bytes,
        body_relative,
        action,
        "body",
    )
    gate = a5.validate_row(
        action,
        direction,
        frames,
        body_frames,
        plane_frames["attachment"],
        landmarks,
        quality,
        body_quality,
        identity=IDENTITY,
        garment=GARMENT,
        work_tool_label="gaff",
    )
    gate["schema"] = "realm.actor-pose.a13-row-gate.v1"
    gate["scope"] = {
        **gate["scope"],
        "role": ROLE,
    }
    runtime_paths = {
        tier: f"rows-runtime/{tier}/{prefix}.png"
        for tier, _frame_w, _frame_h in RUNTIME_TIERS
    }
    artifacts = {
        row_relative: row_bytes,
        body_relative: body_bytes,
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
        f"planes/equipment/{prefix}.png": png(
            strip(plane_frames["attachment"])
        ),
        f"id-masks/{prefix}.png": png(strip(plane_frames["semantic"])),
        f"landmarks/{prefix}.json": canonical(
            {
                "schema": "realm.actor-pose.a13-landmarks.v1",
                "scope": gate["scope"],
                "frames": landmarks,
            }
        ),
        f"reports/quality/{action}-{direction}.json": canonical(quality),
        f"reports/quality-body/{action}-{direction}.json": canonical(
            body_quality
        ),
        f"proof/quality/{action}-{direction}-x4.png": quality_proof,
        f"proof/quality-body/{action}-{direction}-x4.png": body_proof,
    }
    record = {
        "scope": gate["scope"],
        "row": row_relative,
        "runtime_rows": runtime_paths,
        "body_plane": body_relative,
        "identity_plane": f"planes/identity/{prefix}.png",
        "garment_plane": f"planes/garment/{prefix}.png",
        "equipment_plane": f"planes/equipment/{prefix}.png",
        "semantic_mask": f"id-masks/{prefix}.png",
        "landmarks": f"landmarks/{prefix}.json",
        "quality_report": f"reports/quality/{action}-{direction}.json",
        "body_quality_report": (
            f"reports/quality-body/{action}-{direction}.json"
        ),
        "quality_proof": f"proof/quality/{action}-{direction}-x4.png",
        "body_quality_proof": (
            f"proof/quality-body/{action}-{direction}-x4.png"
        ),
        "gate": gate,
    }
    images = {
        "row": row,
        "body": body_row,
        "equipment": strip(plane_frames["attachment"]),
    }
    return artifacts, record, images


def review_contact(
    images: dict[tuple[str, str], dict[str, Image.Image]],
) -> Image.Image:
    scale = 3
    label_h = 18
    keys = [
        (action, direction)
        for action in ACTIONS
        for direction in DIRECTIONS
    ]
    result = Image.new(
        "RGBA",
        (ROW_W * scale, len(keys) * (H * scale + label_h)),
        "#0d1820ff",
    )
    draw = ImageDraw.Draw(result)
    for index, key in enumerate(keys):
        action, direction = key
        y = index * (H * scale + label_h)
        draw.text(
            (6, y + 3),
            f"{ROLE} / {action} / {direction}",
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
    tool_sheet: Image.Image,
    workstation_sheet: Image.Image,
) -> tuple[
    dict[str, bytes],
    dict[tuple[str, str], dict[str, Any]],
    dict[str, Any],
]:
    combinations = [
        (action, direction)
        for action in ACTIONS
        for direction in DIRECTIONS
    ]
    artifacts: dict[str, bytes] = {}
    records: dict[tuple[str, str], dict[str, Any]] = {}
    images: dict[tuple[str, str], dict[str, Image.Image]] = {}
    for action, direction in combinations:
        built, record, row_images = build_row(
            contract,
            sheets,
            pose,
            tool_sheet,
            workstation_sheet,
            action,
            direction,
        )
        artifacts.update(built)
        records[(action, direction)] = record
        images[(action, direction)] = row_images

    default_rows = [
        Image.open(
            io.BytesIO(
                artifacts[records[key]["runtime_rows"]["default"]]
            )
        ).convert("RGBA")
        for key in combinations
    ]
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
        f"{action}/{direction}: {failure}"
        for (action, direction), record in sorted(records.items())
        for failure in record["gate"]["failures"]
    ]
    for action in ACTIONS:
        row_hashes = {
            digest(images[(action, direction)]["row"].tobytes())
            for direction in DIRECTIONS
        }
        if len(row_hashes) != len(DIRECTIONS):
            failures.append(f"{action} direction rows are not all distinct")
    for action in ACTIONS:
        heights = [
            statistics.median(
                records[(action, direction)]["gate"]["body_heights"]
            )
            for direction in DIRECTIONS
        ]
        if max(heights) - min(heights) > 1:
            failures.append(
                f"{action} cross-direction body height spread exceeds 1px"
            )
    for direction in DIRECTIONS:
        heights = [
            statistics.median(
                records[(action, direction)]["gate"]["body_heights"]
            )
            for action in ACTIONS
        ]
        if max(heights) - min(heights) > 1:
            failures.append(
                f"{direction} cross-action body height spread exceeds 1px"
            )
    if (
        images[("work", "left")]["row"].tobytes()
        == images[("work", "right")]["row"].transpose(
            Image.Transpose.FLIP_LEFT_RIGHT
        ).tobytes()
    ):
        failures.append("left work row is a forbidden finished-row mirror")

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
        "schema": "realm.actor-pose.a13-fisher-actions-gate.v1",
        "scope": contract["scope"],
        "rows": len(combinations),
        "frames": len(combinations) * BEATS,
        "actions": list(ACTIONS),
        "directions": list(DIRECTIONS),
        "finished_row_mirroring": False,
        "runtime_style": runtime_style,
        "row_gates": {
            f"{action}/{direction}": records[(action, direction)]["gate"]
            for action, direction in combinations
        },
        "mechanical_passed": not failures,
        "failures": failures,
    }
    artifacts["proof/fisher-four-actions-x3.png"] = png(
        review_contact(images)
    )
    artifacts["style/actor-palette.png"] = png(palette_swatch(colors))
    artifacts["style/actor-palette.json"] = canonical(
        {
            "schema": "realm.actor-pose.a13-runtime-palette.v1",
            **RUNTIME_STYLE,
            "colors": runtime_style["palette_hex"],
        }
    )
    artifacts["reports/fisher-actions-gate.json"] = canonical(gate)
    return artifacts, records, gate


def manifest(
    files: dict[str, dict[str, Any]],
    artifacts: dict[str, bytes],
    records: dict[tuple[str, str], dict[str, Any]],
    gate: dict[str, Any],
    deterministic: bool,
) -> dict[str, Any]:
    return {
        "schema": "realm.actor-pose.a13-fisher-actions-manifest.v1",
        "candidate": "a13-fisher-actions",
        "stage": "fisher-four-action-family",
        "status": (
            "action-family-proven"
            if gate["mechanical_passed"] and deterministic
            else "action-family-veto"
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
            f"{action}/{direction}": record
            for (action, direction), record in records.items()
        },
        "proof": {
            "action_family": "proof/fisher-four-actions-x3.png",
            "runtime_palette": "style/actor-palette.png",
        },
        "verification": {
            "mechanical_passed": gate["mechanical_passed"],
            "byte_deterministic_second_pass": deterministic,
            "report": "reports/fisher-actions-gate.json",
            "failures": gate["failures"],
        },
        "compiler": {
            "path": "scripts/actor-pose-prototype/a13_fisher_actions.py",
            "python": f"{sys.version_info.major}.{sys.version_info.minor}",
            "pillow": Image.__version__,
            "runtime_proof_downsample": {
                "filter": "Box",
                "unsharp": {
                    "radius": 0.7,
                    "percent": 80,
                    "threshold": 5
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
        description="Compile the Realm A13 four-action fisher family."
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
        (
            contract,
            sheets,
            pose,
            tool_sheet,
            workstation_sheet,
            files,
        ) = load_inputs(
            args.source_dir.resolve()
        )
        artifacts, records, gate = build(
            contract,
            sheets,
            pose,
            tool_sheet,
            workstation_sheet,
        )
        second = (
            build(
                contract,
                sheets,
                pose,
                tool_sheet,
                workstation_sheet,
            )
            if args.verify
            else None
        )
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
            raise A2Error("second in-memory A13 build differed")
        document = manifest(
            files,
            artifacts,
            records,
            gate,
            deterministic,
        )
        write_output(args.out_dir.resolve(), artifacts, document)
        print(
            "A13 fisher actions OK: "
            f"{gate['rows']} flattened rows / {gate['frames']} frames; "
            "one shared modular identity spans four actions and directions"
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
        print(f"A13 fisher actions failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
