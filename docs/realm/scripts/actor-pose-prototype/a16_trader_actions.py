#!/usr/bin/env python3
"""Compile the Realm A16 trader from four independent art authorities.

A16 reuses A13's flattened family compositor without changing A13's shipped
source. This adapter owns the mature factor identity, hollow madder-and-teal
merchant garments, brass steelyard, grounded trade counter, and a custom
four-direction road gait. The runtime still receives exact-size raster rows.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import io
import json
import math
import sys
from pathlib import Path
from typing import Any

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import a4_guard_family as a4  # noqa: E402
import a13_fisher_actions as engine  # noqa: E402
from a2_layered2d import (  # noqa: E402
    A2Error,
    BEATS,
    GROUND_Y,
    H,
    ROW_W,
    W,
    canonical,
    digest,
    quantize,
)
from a3_factorial import RUNTIME_TIERS  # noqa: E402


PROTO = ROOT / "assets/sprites/prototypes/actor-pose"
SOURCE = PROTO / "source/a16-trader-actions"
OUT = PROTO / "output/a16-trader-actions"
ACTIONS = ("idle", "walk", "work", "carry")
DIRECTIONS = ("down", "up", "left", "right")
ROLE = "trader"
IDENTITY = "factor"
GARMENT = "madder-teal"
TOOL_COLOR = (186, 146, 52, 255)
WORKSTATION_COLOR = (119, 72, 43, 255)
WORK_PHASES = (
    "ready",
    "set-sample",
    "balance",
    "slide-weight",
    "read",
    "tally",
    "close-ledger",
    "recover",
)
WORK_VECTORS = {
    "right": (
        (14, 0),
        (15, -2),
        (15, 3),
        (13, -4),
        (14, 1),
        (12, -5),
        (13, 2),
        (14, 0),
    ),
    "left": (
        (-14, 0),
        (-15, -2),
        (-15, 3),
        (-13, -4),
        (-14, 1),
        (-12, -5),
        (-13, 2),
        (-14, 0),
    ),
    "down": (
        (12, 1),
        (13, -2),
        (12, 3),
        (11, -4),
        (12, 1),
        (10, -5),
        (11, 2),
        (12, 1),
    ),
    "up": (
        (-12, -1),
        (-13, 2),
        (-12, -3),
        (-11, 4),
        (-12, -1),
        (-10, 5),
        (-11, -2),
        (-12, -1),
    ),
}
SCHEMA_REPLACEMENTS = {
    "realm.actor-pose.a13-row-gate.v1": (
        "realm.actor-pose.a16-row-gate.v1"
    ),
    "realm.actor-pose.a13-landmarks.v1": (
        "realm.actor-pose.a16-landmarks.v1"
    ),
    "realm.actor-pose.a13-fisher-actions-gate.v1": (
        "realm.actor-pose.a16-trader-actions-gate.v1"
    ),
    "realm.actor-pose.a13-runtime-palette.v1": (
        "realm.actor-pose.a16-runtime-palette.v1"
    ),
}
BASE_ACTION_POSE = engine.action_pose
BASE_APPLY_WORKSTATION = engine.apply_workstation
BASE_COMPOSE_BODY = engine.compose_body


def file_sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def add_source(
    files: dict[str, dict[str, Any]],
    path: Path,
    owner: str,
) -> None:
    data = path.read_bytes()
    files[path.relative_to(ROOT).as_posix()] = {
        "sha256": digest(data),
        "bytes": len(data),
        "owner": owner,
    }


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
        raise A2Error(f"A16 {label} crop is malformed")
    left, top, right, bottom = box
    if not (
        0 <= left < right <= sheet.width
        and 0 <= top < bottom <= sheet.height
    ):
        raise A2Error(f"A16 {label} crop is outside its source")
    crop = sheet.crop(tuple(box))
    bbox = a4.alpha_bbox(crop)
    if bbox is None:
        raise A2Error(f"A16 {label} crop is blank")
    margin = min(
        bbox[0],
        bbox[1],
        crop.width - bbox[2],
        crop.height - bbox[3],
    )
    seam_exceptions = {
        f"garment/{direction}/{part}": 0
        for direction in DIRECTIONS
        for part in ("belt", "boot")
    }
    required_margin = seam_exceptions.get(label, 8)
    if require_margin and margin < required_margin:
        raise A2Error(
            f"A16 {label} has {margin}px transparent margin; "
            f"requires {required_margin}px"
        )


def validate_generation(
    record: dict[str, Any],
    label: str,
    files: dict[str, dict[str, Any]],
) -> None:
    keyed_record = record["generation_source"]
    keyed_path = ROOT / keyed_record["path"]
    if file_sha(keyed_path) != keyed_record["sha256"]:
        raise A2Error(f"A16 keyed {label} source hash changed")
    prompt_path = ROOT / record["source_prompt"]
    prompt = json.loads(prompt_path.read_text())
    if prompt.get("schema") != "realm.imagegen-source.v1":
        raise A2Error(f"A16 {label} prompt schema changed")
    if prompt.get("alpha_path") != record["path"]:
        raise A2Error(f"A16 {label} prompt alpha path changed")
    if prompt.get("alpha_sha256") != record["sha256"]:
        raise A2Error(f"A16 {label} prompt alpha hash changed")
    if prompt.get("keyed_path") != keyed_record["path"]:
        raise A2Error(f"A16 {label} prompt keyed path changed")
    if prompt.get("keyed_sha256") != keyed_record["sha256"]:
        raise A2Error(f"A16 {label} prompt keyed hash changed")
    add_source(files, keyed_path, f"imagegen-keyed-{label}-source")
    add_source(files, prompt_path, f"imagegen-{label}-provenance")
    for reference in prompt.get("references", []):
        reference_path = Path(reference["path"])
        if reference_path.is_absolute():
            continue
        target = ROOT / reference_path
        expected = reference.get("sha256")
        if expected and file_sha(target) != expected:
            raise A2Error(f"A16 {label} reference hash changed")
        add_source(files, target, f"imagegen-{label}-reference")


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
    if contract.get("schema") != "realm.actor-pose.a16-trader-actions.v1":
        raise A2Error("A16 parts contract must be v1")
    if contract.get("stage") != "trader-four-action-family":
        raise A2Error("A16 contract stage changed")
    scope = contract.get("scope", {})
    if scope.get("role") != ROLE:
        raise A2Error("A16 role must remain trader")
    if scope.get("identity") != IDENTITY or scope.get("garment") != GARMENT:
        raise A2Error("A16 identity or garment authority changed")
    if tuple(scope.get("actions", [])) != ACTIONS:
        raise A2Error("A16 must declare four ordered actions")
    if tuple(scope.get("directions", [])) != DIRECTIONS:
        raise A2Error("A16 must declare four ordered directions")

    sheets: dict[str, Image.Image] = {}
    files: dict[str, dict[str, Any]] = {}
    for owner in ("identity", "garment", "attachment"):
        record = contract[owner]
        path = ROOT / record["path"]
        data = path.read_bytes()
        if digest(data) != record["sha256"]:
            raise A2Error(f"A16 {owner} source hash changed")
        sheet = Image.open(io.BytesIO(data)).convert("RGBA")
        sheets[owner] = sheet
        add_source(files, path, owner)
        if owner in ("identity", "garment"):
            validate_generation(record, owner, files)
        for direction in DIRECTIONS:
            parts = record["parts"].get(direction)
            if parts is None:
                raise A2Error(f"A16 {owner} lacks {direction} parts")
            if owner == "attachment":
                parts = {"attachment": parts}
            for name, box in parts.items():
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
        raise A2Error("A16 merchant steelyard source hash changed")
    tool_sheet = Image.open(io.BytesIO(tool_data)).convert("RGBA")
    add_source(files, tool_path, "tool")
    validate_generation(tool_record, "tool", files)
    for direction in DIRECTIONS:
        validate_crop(
            tool_sheet,
            tool_record["parts"].get(direction),
            f"tool/{direction}",
            require_margin=True,
        )

    workstation_record = contract["workstation"]
    workstation_path = ROOT / workstation_record["path"]
    workstation_data = workstation_path.read_bytes()
    if digest(workstation_data) != workstation_record["sha256"]:
        raise A2Error("A16 folding trade-counter source hash changed")
    workstation_sheet = Image.open(
        io.BytesIO(workstation_data)
    ).convert("RGBA")
    add_source(files, workstation_path, "workstation")
    validate_generation(workstation_record, "workstation", files)
    for direction in DIRECTIONS:
        validate_crop(
            workstation_sheet,
            workstation_record["parts"].get(direction),
            f"workstation/{direction}",
            require_margin=True,
        )

    pose_record = contract["pose"]["right_source"]
    pose_path = ROOT / pose_record["path"]
    if file_sha(pose_path) != pose_record["sha256"]:
        raise A2Error("A16 right-pose authority hash changed")
    pose = json.loads(pose_path.read_text())
    if pose.get("schema") != "realm.actor-pose.a2-pose.v2":
        raise A2Error("A16 requires the approved A2 v2 pose")
    if len(pose.get("frames", [])) != BEATS:
        raise A2Error("A16 requires exactly eight pose beats")

    for path, owner in (
        (contract_path, "trader-family-contract"),
        (pose_path, "right-pose-authority"),
        (Path(__file__), "compiler-source"),
        (
            ROOT / "scripts/actor-pose-prototype/a13_fisher_actions.py",
            "shared-action-family-engine",
        ),
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
        add_source(files, path, owner)
    return contract, sheets, pose, tool_sheet, workstation_sheet, files


def refresh_arm_chain(frame: dict[str, Any]) -> None:
    """Keep the authored hand track connected after the factor's road step."""

    frame["elbows"] = {
        side: [
            round(
                (frame["shoulders"][side][axis]
                 + frame["hands"][side][axis])
                / 2
            )
            for axis in (0, 1)
        ]
        for side in ("near", "far")
    }
    frame["wrists"] = {
        side: [
            round(
                (frame["elbows"][side][axis]
                 + frame["hands"][side][axis])
                / 2
            )
            for axis in (0, 1)
        ]
        for side in ("near", "far")
    }
    dy = frame["body_dy"]
    frame["sockets"] = {
        "right_hand": list(frame["hands"]["near"]),
        "left_hand": list(frame["hands"]["far"]),
        "load": [
            round(
                (frame["hands"]["near"][0]
                 + frame["hands"]["far"][0])
                / 2
            ),
            52 + dy,
        ],
        "belt": [frame["pelvis"][0], 51 + dy],
    }


def trader_walk_pose(
    direction: str,
    base: dict[str, Any],
) -> dict[str, Any]:
    """Author a brisk satchel-weighted road gait without changing phase."""

    if direction == "left":
        right = trader_walk_pose("right", base)
        reflected = a4.reflected_side_pose(right)
        reflected["direction"] = "left"
        reflected["gait_authority"] = "factor-brisk-step-v1"
        return reflected

    frame = BASE_ACTION_POSE("walk", direction, base)
    index = frame["frame"]
    body_roll = (0, 1, 1, 0, 0, -1, -1, 0)[index]
    shoulder_roll = (1, 1, 0, -1, -1, -1, 0, 1)[index]
    boot_lift = (0, 1, 3, 4, 0, 1, 3, 4)[index]

    if direction == "right":
        for side in ("near", "far"):
            leg = frame[side]
            hip_x = leg["hip"][0]
            for key in ("knee", "ankle", "heel", "toe"):
                leg[key][0] = hip_x + round(
                    (leg[key][0] - hip_x) * 1.16
                )
            if leg.get("sole_run") is None:
                leg["ankle"][1] -= max(1, boot_lift - 1)
                leg["heel"][1] -= boot_lift
                leg["toe"][1] -= boot_lift
            else:
                leg["sole_run"] = [
                    min(leg["heel"][0], leg["toe"][0]),
                    max(leg["heel"][0], leg["toe"][0]),
                ]
        for key in ("head", "torso", "pelvis"):
            frame[key][0] += body_roll
        for side, sign in (("near", 1), ("far", -1)):
            frame["shoulders"][side][0] += body_roll
            frame["shoulders"][side][1] += shoulder_roll * sign
        counter = (1, 2, 3, 1, -1, -2, -3, -1)[index]
        frame["hands"]["near"][0] += counter + body_roll
        frame["hands"]["far"][0] -= counter - body_roll
        frame["hands"]["near"][1] -= abs(counter) // 2
        frame["hands"]["far"][1] += abs(counter) // 2
    else:
        # Front/back views use an emphatic unloaded-boot lift and a narrow
        # shoulder rhythm so the gait survives the 35x46 default tier.
        shifts = (
            {"near": -1, "far": 1}
            if direction == "down"
            else {"near": 1, "far": -1}
        )
        for side in ("near", "far"):
            leg = frame[side]
            for key in ("hip", "knee", "ankle", "heel", "toe"):
                leg[key][0] += shifts[side]
            if leg.get("sole_run") is None:
                leg["ankle"][1] -= max(1, boot_lift - 1)
                leg["heel"][1] -= boot_lift
                leg["toe"][1] -= boot_lift
            else:
                leg["sole_run"] = [
                    min(leg["heel"][0], leg["toe"][0]),
                    max(leg["heel"][0], leg["toe"][0]),
                ]
        view_roll = body_roll if direction == "down" else -body_roll
        for key in ("head", "torso", "pelvis"):
            frame[key][0] += view_roll
        counter = (1, -1, -3, -1, -1, 1, 3, 1)[index]
        for side, sign in (("near", 1), ("far", -1)):
            frame["shoulders"][side][0] += view_roll
            frame["shoulders"][side][1] += shoulder_roll * sign
            frame["hands"][side][0] += view_roll
            frame["hands"][side][1] += counter * sign

    refresh_arm_chain(frame)
    frame["gait_authority"] = "factor-brisk-step-v1"
    return frame


def trader_action_pose(
    action: str,
    direction: str,
    base: dict[str, Any],
) -> dict[str, Any]:
    if action == "walk":
        return trader_walk_pose(direction, base)
    return BASE_ACTION_POSE(action, direction, base)


def apply_trade_counter(
    result: dict[str, Image.Image],
    workstation_sheet: Image.Image,
    contract: dict[str, Any],
    direction: str,
) -> tuple[dict[str, Image.Image], dict[str, list[int]]]:
    composed, landmarks = BASE_APPLY_WORKSTATION(
        result,
        workstation_sheet,
        contract,
        direction,
    )
    return composed, {
        "counter_anchor": landmarks["creel_anchor"],
        "ledger_socket": landmarks["creel_catch"],
        "workstation_bbox": landmarks["workstation_bbox"],
    }


def compose_trader_body(
    parts: dict[str, Image.Image],
    pose_frame: dict[str, Any],
    direction: str,
    render_profile: dict[str, Any],
) -> tuple[dict[str, Image.Image], dict[str, Any]]:
    composed, metadata = BASE_COMPOSE_BODY(
        parts,
        pose_frame,
        direction,
        render_profile,
    )
    if "gait_authority" in pose_frame:
        metadata["gait_authority"] = pose_frame["gait_authority"]
    return composed, metadata


def rotated_merchant_steelyard(
    component: Image.Image,
    socket: list[int],
    vector: list[int],
    contract: dict[str, Any],
) -> tuple[Image.Image, list[int]]:
    """Socket a horizontal balance around its painted wrapped grip."""
    authority = contract["tool"]["authority"]
    width = int(authority["render_width"])
    height = max(3, round(component.height * width / component.width))
    scaled = component.resize((width, height), Image.Resampling.LANCZOS)
    grip_x = round(width * float(authority["grip_fraction_from_left"]))
    grip_y = round(height * float(authority["grip_fraction_from_top"]))
    work_size = 96
    center = work_size // 2
    work = Image.new("RGBA", (work_size, work_size), (0, 0, 0, 0))
    work.alpha_composite(scaled, (center - grip_x, center - grip_y))
    dx, dy = vector
    # Directional crops own handedness. The vector contributes only the
    # weighing/tally tilt, never a 180-degree finished-tool mirror.
    angle = math.degrees(math.atan2(dy, max(1, abs(dx))))
    turned = work.rotate(
        angle,
        resample=Image.Resampling.BICUBIC,
        expand=False,
        center=(center, center),
    )
    canvas = engine.blank()
    canvas.alpha_composite(
        quantize(turned),
        (socket[0] - center, socket[1] - center),
    )
    pan_distance = max(4, round(width * 0.42))
    magnitude = max(1.0, math.hypot(dx, dy))
    pan_tip = [
        round(socket[0] + dx * pan_distance / magnitude),
        round(socket[1] + dy * pan_distance / magnitude),
    ]
    return canvas, pan_tip


def configure_engine() -> None:
    engine.ROLE = ROLE
    engine.IDENTITY = IDENTITY
    engine.GARMENT = GARMENT
    engine.TOOL_COLOR = TOOL_COLOR
    engine.WORKSTATION_COLOR = WORKSTATION_COLOR
    engine.WORK_PHASES = WORK_PHASES
    engine.WORK_VECTORS = WORK_VECTORS
    engine.action_pose = trader_action_pose
    engine.compose_body = compose_trader_body
    engine.apply_workstation = apply_trade_counter
    engine.rotated_tool = rotated_merchant_steelyard


def normalize(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: normalize(item) for key, item in value.items()}
    if isinstance(value, list):
        return [normalize(item) for item in value]
    if isinstance(value, tuple):
        return tuple(normalize(item) for item in value)
    if isinstance(value, str):
        return SCHEMA_REPLACEMENTS.get(value, value)
    return value


def gait_signature(frame: dict[str, Any]) -> dict[str, Any]:
    return {
        "head": frame["head"],
        "torso": frame["torso"],
        "pelvis": frame["pelvis"],
        "near": frame["near"],
        "far": frame["far"],
        "shoulders": frame["shoulders"],
        "hands": frame["hands"],
        "contacts": frame["contacts"],
        "phase": frame["phase"],
    }


def gait_authority_report(pose: dict[str, Any]) -> dict[str, Any]:
    directions: dict[str, Any] = {}
    failures: list[str] = []
    trajectory_hashes: set[str] = set()
    for direction in DIRECTIONS:
        authored = [
            gait_signature(trader_walk_pose(direction, base))
            for base in pose["frames"]
        ]
        shared = [
            gait_signature(engine.a5.action_pose("walk", direction, base))
            for base in pose["frames"]
        ]
        changed = [
            index
            for index, (ours, baseline) in enumerate(zip(authored, shared))
            if ours != baseline
        ]
        trajectory_hash = digest(canonical(authored))
        trajectory_hashes.add(trajectory_hash)
        directions[direction] = {
            "changed_frames_from_shared_a5": changed,
            "changed_frame_count": len(changed),
            "trajectory_sha256": trajectory_hash,
            "phases": [frame["phase"] for frame in authored],
            "contacts": [frame["contacts"] for frame in authored],
        }
        if len(changed) != BEATS:
            failures.append(
                f"{direction} changes only {len(changed)}/{BEATS} gait frames"
            )
    if len(trajectory_hashes) != len(DIRECTIONS):
        failures.append("trader gait lacks four distinct joint trajectories")
    return {
        "schema": "realm.actor-pose.a16-trader-gait-authority.v1",
        "authority": "factor-brisk-step-v1",
        "shared_a5_walk_pose": False,
        "directions": directions,
        "distinct_direction_trajectories": len(trajectory_hashes),
        "mechanical_passed": not failures,
        "failures": failures,
    }


def exact_walk_proof(
    artifacts: dict[str, bytes],
    tier: str,
    frame_size: tuple[int, int],
) -> bytes:
    frame_w, frame_h = frame_size
    surface = Image.new(
        "RGBA",
        (frame_w * BEATS, frame_h * len(DIRECTIONS)),
        (0, 0, 0, 0),
    )
    for row, direction in enumerate(DIRECTIONS):
        relative = (
            f"rows-runtime/{tier}/{IDENTITY}/{GARMENT}/"
            f"walk-{direction}.png"
        )
        source = Image.open(io.BytesIO(artifacts[relative])).convert("RGBA")
        expected = (frame_w * BEATS, frame_h)
        if source.size != expected:
            raise A2Error(
                f"A16 walk/{direction}/{tier} is {source.size}, expected {expected}"
            )
        surface.alpha_composite(source, (0, row * frame_h))
    return engine.png(surface)


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
    configure_engine()
    artifacts, records, gate = engine.build(
        contract,
        sheets,
        pose,
        tool_sheet,
        workstation_sheet,
    )
    records = normalize(records)
    gate = normalize(gate)
    gait = gait_authority_report(pose)
    gate["gait_authority"] = gait
    gate["failures"].extend(gait["failures"])
    gate["mechanical_passed"] = not gate["failures"]
    normalized_artifacts: dict[str, bytes] = {}
    for relative, data in artifacts.items():
        renamed = {
            "proof/fisher-four-actions-x3.png": (
                "proof/trader-four-actions-x3.png"
            ),
            "reports/fisher-actions-gate.json": (
                "reports/trader-actions-gate.json"
            ),
        }.get(relative, relative)
        if relative.endswith(".json"):
            data = canonical(normalize(json.loads(data)))
        normalized_artifacts[renamed] = data
    normalized_artifacts["proof/trader-walk-default-35x46.png"] = (
        exact_walk_proof(normalized_artifacts, "default", (35, 46))
    )
    normalized_artifacts["proof/trader-walk-review-64x84.png"] = (
        exact_walk_proof(normalized_artifacts, "review", (64, 84))
    )
    normalized_artifacts["reports/trader-gait-authority.json"] = canonical(
        gait
    )
    normalized_artifacts["reports/trader-actions-gate.json"] = canonical(
        gate
    )
    return normalized_artifacts, records, gate


def manifest(
    files: dict[str, dict[str, Any]],
    artifacts: dict[str, bytes],
    records: dict[tuple[str, str], dict[str, Any]],
    gate: dict[str, Any],
    deterministic: bool,
) -> dict[str, Any]:
    return {
        "schema": "realm.actor-pose.a16-trader-actions-manifest.v1",
        "candidate": "a16-trader-actions",
        "stage": "trader-four-action-family",
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
            "action_family": "proof/trader-four-actions-x3.png",
            "walk_default_exact": "proof/trader-walk-default-35x46.png",
            "walk_review_exact": "proof/trader-walk-review-64x84.png",
            "runtime_palette": "style/actor-palette.png",
        },
        "verification": {
            "mechanical_passed": gate["mechanical_passed"],
            "byte_deterministic_second_pass": deterministic,
            "report": "reports/trader-actions-gate.json",
            "gait_report": "reports/trader-gait-authority.json",
            "failures": gate["failures"],
        },
        "compiler": {
            "path": "scripts/actor-pose-prototype/a16_trader_actions.py",
            "engine": "scripts/actor-pose-prototype/a13_fisher_actions.py",
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


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Compile the Realm A16 four-action trader family."
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
        ) = load_inputs(args.source_dir.resolve())
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
            raise A2Error("second in-memory A16 build differed")
        document = manifest(
            files,
            artifacts,
            records,
            gate,
            deterministic,
        )
        engine.write_output(args.out_dir.resolve(), artifacts, document)
        print(
            "A16 trader actions OK: "
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
        print(f"A16 trader actions failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
