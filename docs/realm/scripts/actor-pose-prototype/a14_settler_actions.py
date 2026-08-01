#!/usr/bin/env python3
"""Compile the Realm A14 settler from hash-locked modular sources.

A14 reuses the proven A7 action-family engine without changing A7's shipped
source.  This adapter owns the settler contract, source provenance, downward
pointing spade geometry, A14 schemas, artifact names, and manifest.
"""

from __future__ import annotations

import argparse
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
import a7_farmer_actions as engine  # noqa: E402
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
SOURCE = PROTO / "source/a14-settler-actions"
OUT = PROTO / "output/a14-settler-actions"
ACTIONS = ("idle", "walk", "work", "carry")
DIRECTIONS = ("down", "up", "left", "right")
ROLE = "settler"
IDENTITY = "wayfarer"
GARMENT = "hearth-indigo"
TOOL_COLOR = (151, 143, 124, 255)
WORK_PHASES = (
    "ready",
    "brace",
    "raise",
    "align",
    "drive",
    "press",
    "lever",
    "recover",
)
WORK_VECTORS = {
    "right": (
        (9, -12),
        (4, -18),
        (-5, -20),
        (10, -9),
        (16, 8),
        (13, 18),
        (6, 8),
        (9, -12),
    ),
    "left": (
        (-9, -12),
        (-4, -18),
        (5, -20),
        (-10, -9),
        (-16, 8),
        (-13, 18),
        (-6, 8),
        (-9, -12),
    ),
    "down": (
        (6, -12),
        (2, -18),
        (-6, -17),
        (-3, 4),
        (0, 20),
        (5, 16),
        (7, 5),
        (6, -12),
    ),
    "up": (
        (-6, 12),
        (-2, 18),
        (6, 17),
        (3, -4),
        (0, -20),
        (-5, -16),
        (-7, -5),
        (-6, 12),
    ),
}
SCHEMA_REPLACEMENTS = {
    "realm.actor-pose.a7-row-gate.v1": (
        "realm.actor-pose.a14-row-gate.v1"
    ),
    "realm.actor-pose.a7-landmarks.v1": (
        "realm.actor-pose.a14-landmarks.v1"
    ),
    "realm.actor-pose.a7-farmer-actions-gate.v1": (
        "realm.actor-pose.a14-settler-actions-gate.v1"
    ),
    "realm.actor-pose.a7-runtime-palette.v1": (
        "realm.actor-pose.a14-runtime-palette.v1"
    ),
}


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
        raise A2Error(f"A14 {label} crop is malformed")
    left, top, right, bottom = box
    if not (
        0 <= left < right <= sheet.width
        and 0 <= top < bottom <= sheet.height
    ):
        raise A2Error(f"A14 {label} crop is outside its source")
    crop = sheet.crop(tuple(box))
    bbox = a4.alpha_bbox(crop)
    if bbox is None:
        raise A2Error(f"A14 {label} crop is blank")
    if require_margin and min(
        bbox[0],
        bbox[1],
        crop.width - bbox[2],
        crop.height - bbox[3],
    ) < 8:
        raise A2Error(f"A14 {label} lacks an 8px transparent margin")


def validate_generation(
    record: dict[str, Any],
    label: str,
    files: dict[str, dict[str, Any]],
) -> None:
    keyed_record = record["generation_source"]
    keyed_path = ROOT / keyed_record["path"]
    if file_sha(keyed_path) != keyed_record["sha256"]:
        raise A2Error(f"A14 keyed {label} source hash changed")
    prompt_path = ROOT / record["source_prompt"]
    prompt = json.loads(prompt_path.read_text())
    if prompt.get("schema") != "realm.imagegen-source.v1":
        raise A2Error(f"A14 {label} prompt schema changed")
    if prompt.get("alpha_path") != record["path"]:
        raise A2Error(f"A14 {label} prompt alpha path changed")
    if prompt.get("alpha_sha256") != record["sha256"]:
        raise A2Error(f"A14 {label} prompt alpha hash changed")
    if prompt.get("keyed_path") != keyed_record["path"]:
        raise A2Error(f"A14 {label} prompt keyed path changed")
    if prompt.get("keyed_sha256") != keyed_record["sha256"]:
        raise A2Error(f"A14 {label} prompt keyed hash changed")
    add_source(files, keyed_path, f"imagegen-keyed-{label}-source")
    add_source(files, prompt_path, f"imagegen-{label}-provenance")
    for reference in prompt.get("references", []):
        reference_path = Path(reference["path"])
        if reference_path.is_absolute():
            continue
        target = ROOT / reference_path
        expected = reference.get("sha256")
        if expected and file_sha(target) != expected:
            raise A2Error(f"A14 {label} reference hash changed")
        add_source(files, target, f"imagegen-{label}-reference")


def load_inputs(
    source_dir: Path,
) -> tuple[
    dict[str, Any],
    dict[str, Image.Image],
    dict[str, Any],
    Image.Image,
    dict[str, dict[str, Any]],
]:
    contract_path = source_dir / "parts.json"
    contract = json.loads(contract_path.read_text())
    if contract.get("schema") != "realm.actor-pose.a14-settler-actions.v1":
        raise A2Error("A14 parts contract must be v1")
    if contract.get("stage") != "settler-four-action-family":
        raise A2Error("A14 contract stage changed")
    scope = contract.get("scope", {})
    if scope.get("role") != ROLE:
        raise A2Error("A14 role must remain settler")
    if scope.get("identity") != IDENTITY or scope.get("garment") != GARMENT:
        raise A2Error("A14 identity or garment authority changed")
    if tuple(scope.get("actions", [])) != ACTIONS:
        raise A2Error("A14 must declare four ordered actions")
    if tuple(scope.get("directions", [])) != DIRECTIONS:
        raise A2Error("A14 must declare four ordered directions")

    sheets: dict[str, Image.Image] = {}
    files: dict[str, dict[str, Any]] = {}
    for owner in ("identity", "garment", "attachment"):
        record = contract[owner]
        path = ROOT / record["path"]
        data = path.read_bytes()
        if digest(data) != record["sha256"]:
            raise A2Error(f"A14 {owner} source hash changed")
        sheet = Image.open(io.BytesIO(data)).convert("RGBA")
        sheets[owner] = sheet
        add_source(files, path, owner)
        if owner in ("identity", "garment"):
            validate_generation(record, owner, files)
        for direction in DIRECTIONS:
            parts = record["parts"].get(direction)
            if parts is None:
                raise A2Error(f"A14 {owner} lacks {direction} parts")
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
        raise A2Error("A14 settler-spade source hash changed")
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

    pose_record = contract["pose"]["right_source"]
    pose_path = ROOT / pose_record["path"]
    if file_sha(pose_path) != pose_record["sha256"]:
        raise A2Error("A14 right-pose authority hash changed")
    pose = json.loads(pose_path.read_text())
    if pose.get("schema") != "realm.actor-pose.a2-pose.v2":
        raise A2Error("A14 requires the approved A2 v2 pose")
    if len(pose.get("frames", [])) != BEATS:
        raise A2Error("A14 requires exactly eight pose beats")

    for path, owner in (
        (contract_path, "settler-family-contract"),
        (pose_path, "right-pose-authority"),
        (Path(__file__), "compiler-source"),
        (
            ROOT / "scripts/actor-pose-prototype/a7_farmer_actions.py",
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
    return contract, sheets, pose, tool_sheet, files


def rotated_spade(
    component: Image.Image,
    socket: list[int],
    vector: list[int],
    contract: dict[str, Any],
) -> tuple[Image.Image, list[int]]:
    """Rotate a source whose working blade points down, toward the vector."""
    authority = contract["tool"]["authority"]
    height = int(authority["render_height"])
    width = max(3, round(component.width * height / component.height))
    scaled = component.resize((width, height), Image.Resampling.LANCZOS)
    grip_fraction = float(authority["grip_fraction_from_top"])
    work_size = 96
    center = work_size // 2
    grip_y = round(height * grip_fraction)
    work = Image.new("RGBA", (work_size, work_size), (0, 0, 0, 0))
    work.alpha_composite(scaled, (center - width // 2, center - grip_y))
    dx, dy = vector
    angle = math.degrees(math.atan2(-dx, dy))
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
    blade_distance = round(height * (1.0 - grip_fraction))
    magnitude = max(1.0, math.hypot(dx, dy))
    blade_tip = [
        round(socket[0] + dx * blade_distance / magnitude),
        round(socket[1] + dy * blade_distance / magnitude),
    ]
    return canvas, blade_tip


def configure_engine() -> None:
    engine.ROLE = ROLE
    engine.IDENTITY = IDENTITY
    engine.GARMENT = GARMENT
    engine.TOOL_COLOR = TOOL_COLOR
    engine.WORK_PHASES = WORK_PHASES
    engine.WORK_VECTORS = WORK_VECTORS
    engine.rotated_tool = rotated_spade


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


def build(
    contract: dict[str, Any],
    sheets: dict[str, Image.Image],
    pose: dict[str, Any],
    tool_sheet: Image.Image,
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
    )
    records = normalize(records)
    gate = normalize(gate)
    normalized_artifacts: dict[str, bytes] = {}
    for relative, data in artifacts.items():
        renamed = {
            "proof/farmer-four-actions-x3.png": (
                "proof/settler-four-actions-x3.png"
            ),
            "reports/farmer-actions-gate.json": (
                "reports/settler-actions-gate.json"
            ),
        }.get(relative, relative)
        if relative.endswith(".json"):
            data = canonical(normalize(json.loads(data)))
        normalized_artifacts[renamed] = data
    normalized_artifacts["reports/settler-actions-gate.json"] = canonical(
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
        "schema": "realm.actor-pose.a14-settler-actions-manifest.v1",
        "candidate": "a14-settler-actions",
        "stage": "settler-four-action-family",
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
            "action_family": "proof/settler-four-actions-x3.png",
            "runtime_palette": "style/actor-palette.png",
        },
        "verification": {
            "mechanical_passed": gate["mechanical_passed"],
            "byte_deterministic_second_pass": deterministic,
            "report": "reports/settler-actions-gate.json",
            "failures": gate["failures"],
        },
        "compiler": {
            "path": "scripts/actor-pose-prototype/a14_settler_actions.py",
            "engine": "scripts/actor-pose-prototype/a7_farmer_actions.py",
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
        description="Compile the Realm A14 four-action settler family."
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
        contract, sheets, pose, tool_sheet, files = load_inputs(
            args.source_dir.resolve()
        )
        artifacts, records, gate = build(
            contract,
            sheets,
            pose,
            tool_sheet,
        )
        second = (
            build(contract, sheets, pose, tool_sheet)
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
            raise A2Error("second in-memory A14 build differed")
        document = manifest(
            files,
            artifacts,
            records,
            gate,
            deterministic,
        )
        engine.write_output(args.out_dir.resolve(), artifacts, document)
        print(
            "A14 settler actions OK: "
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
        print(f"A14 settler actions failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
