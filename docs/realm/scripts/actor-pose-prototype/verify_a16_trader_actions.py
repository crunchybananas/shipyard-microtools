#!/usr/bin/env python3
"""Strict source, artifact, hollow-garment, and clean-rebuild gate for A16."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
DEFAULT = (
    ROOT
    / "assets/sprites/prototypes/actor-pose/output/a16-trader-actions"
)
COMPILER = ROOT / "scripts/actor-pose-prototype/a16_trader_actions.py"
CONTRACT = (
    ROOT
    / "assets/sprites/prototypes/actor-pose/source/a16-trader-actions/parts.json"
)
ACTIONS = ("idle", "walk", "work", "carry")
DIRECTIONS = ("down", "up", "left", "right")
W, H, FRAMES = 64, 84, 8
ROW_SIZE = (W * FRAMES, H)
RUNTIME_TIERS = {
    "native": (27, 35),
    "default": (35, 46),
    "double": (54, 70),
    "review": (64, 84),
}


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def rgba(path: Path, size: tuple[int, int]) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    if image.size != size:
        raise ValueError(f"{path}: expected {size}, got {image.size}")
    return image


def compare_tree(left: Path, right: Path) -> list[str]:
    failures: list[str] = []
    left_files = {
        path.relative_to(left).as_posix(): path
        for path in left.rglob("*")
        if path.is_file()
    }
    right_files = {
        path.relative_to(right).as_posix(): path
        for path in right.rglob("*")
        if path.is_file()
    }
    if set(left_files) != set(right_files):
        failures.append(
            "clean rebuild file set differs: "
            f"missing={sorted(set(left_files) - set(right_files))}, "
            f"extra={sorted(set(right_files) - set(left_files))}"
        )
        return failures
    for relative in sorted(left_files):
        if left_files[relative].read_bytes() != right_files[relative].read_bytes():
            failures.append(f"clean rebuild byte mismatch: {relative}")
    return failures


def source_checks(contract: dict, failures: list[str]) -> None:
    authority_hashes: set[str] = set()
    for owner in ("identity", "garment", "tool", "workstation"):
        record = contract[owner]
        alpha_path = ROOT / record["path"]
        keyed_path = ROOT / record["generation_source"]["path"]
        prompt_path = ROOT / record["source_prompt"]
        alpha = Image.open(alpha_path).convert("RGBA")
        corners = (
            (0, 0),
            (alpha.width - 1, 0),
            (0, alpha.height - 1),
            (alpha.width - 1, alpha.height - 1),
        )
        if any(alpha.getpixel(point)[3] != 0 for point in corners):
            failures.append(f"{owner} alpha source has opaque corner pixels")
        if sha(alpha_path) != record["sha256"]:
            failures.append(f"{owner} alpha source hash changed")
        authority_hashes.add(record["sha256"])
        if sha(keyed_path) != record["generation_source"]["sha256"]:
            failures.append(f"{owner} keyed source hash changed")
        prompt = json.loads(prompt_path.read_text())
        if prompt.get("alpha_sha256") != record["sha256"]:
            failures.append(f"{owner} prompt alpha hash changed")
        if (
            prompt.get("keyed_sha256")
            != record["generation_source"]["sha256"]
        ):
            failures.append(f"{owner} prompt keyed hash changed")
        if prompt.get("generator", {}).get("mode") != "built-in image_gen":
            failures.append(f"{owner} lost built-in imagegen authority")
        if not prompt.get("prompt"):
            failures.append(f"{owner} generation prompt is blank")

    if len(authority_hashes) != 4:
        failures.append("identity, garment, tool, and workstation are not independent authorities")

    garment = Image.open(ROOT / contract["garment"]["path"]).convert("RGBA")
    hollow_samples = {
        "front cap opening": (414, 110),
        "front neck opening": (414, 230),
        "left sleeve cuff": (188, 430),
        "right sleeve cuff": (1320, 430),
        "front coat leg opening": (412, 545),
    }
    for label, point in hollow_samples.items():
        if garment.getpixel(point)[3] != 0:
            failures.append(f"{label} is opaque instead of hollow")

    head_box = contract["garment"]["parts"]["down"]["headgear"]
    headgear = garment.crop(tuple(head_box))
    hole_pixels = sum(
        1 for alpha in headgear.getchannel("A").get_flattened_data()
        if alpha == 0
    )
    if hole_pixels < 24_000:
        failures.append("front merchant cap lacks a substantial transparent opening")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Verify the Realm A16 trader action-family tree."
    )
    parser.add_argument("--out-dir", type=Path, default=DEFAULT)
    parser.add_argument(
        "--skip-clean-rebuild",
        action="store_true",
        help="Skip the independent compiler invocation (diagnosis only).",
    )
    args = parser.parse_args()
    out = args.out_dir.resolve()
    failures: list[str] = []
    try:
        manifest = json.loads((out / "manifest.json").read_text())
        if (
            manifest.get("schema")
            != "realm.actor-pose.a16-trader-actions-manifest.v1"
        ):
            failures.append("manifest schema is not A16 trader-actions v1")
        if manifest.get("stage") != "trader-four-action-family":
            failures.append("manifest stage changed")
        if manifest.get("status") != "action-family-proven":
            failures.append("manifest status is not action-family-proven")

        scope = manifest.get("scope", {})
        for key, value in {
            "role": "trader",
            "identity": "factor",
            "garment": "madder-teal",
        }.items():
            if scope.get(key) != value:
                failures.append(f"manifest {key} changed")
        if scope.get("actions") != list(ACTIONS):
            failures.append("manifest action order changed")
        if scope.get("directions") != list(DIRECTIONS):
            failures.append("manifest direction order changed")
        if scope.get("flattened_rows") != 16:
            failures.append("manifest does not declare 16 rows")
        if scope.get("flattened_frames") != 128:
            failures.append("manifest does not declare 128 frames")
        if scope.get("frame_size") != [W, H]:
            failures.append("manifest frame size changed")
        if scope.get("row_size") != list(ROW_SIZE):
            failures.append("manifest row size changed")
        if scope.get("root") != [32, 79]:
            failures.append("manifest root changed")

        outputs = manifest.get("outputs", {})
        actual_files = {
            path.relative_to(out).as_posix()
            for path in out.rglob("*")
            if path.is_file()
        }
        expected_files = set(outputs) | {"manifest.json"}
        if actual_files != expected_files:
            failures.append(
                "artifact set differs: "
                f"missing={sorted(expected_files - actual_files)}, "
                f"extra={sorted(actual_files - expected_files)}"
            )
        for relative, record in outputs.items():
            target = out / relative
            if not target.is_file():
                failures.append(f"missing output {relative}")
            elif sha(target) != record.get("sha256"):
                failures.append(f"output hash mismatch {relative}")

        sources = manifest.get("sources", {})
        for relative, record in sources.get("files", {}).items():
            source = ROOT / relative
            if not source.is_file():
                failures.append(f"missing source {relative}")
            elif sha(source) != record.get("sha256"):
                failures.append(f"source hash mismatch {relative}")
        for key in (
            "network_required",
            "finished_frame_or_row_mirroring",
            "runtime_skeletal_renderer",
        ):
            if sources.get(key) is not False:
                failures.append(f"forbidden source/runtime flag {key}")

        gate = json.loads(
            (out / manifest["verification"]["report"]).read_text()
        )
        if (
            gate.get("schema")
            != "realm.actor-pose.a16-trader-actions-gate.v1"
        ):
            failures.append("trader-actions gate schema changed")
        if not gate.get("mechanical_passed") or gate.get("failures"):
            failures.append("trader-actions gate is not green")
        if gate.get("rows") != 16 or gate.get("frames") != 128:
            failures.append("trader-actions gate scope changed")
        if gate.get("finished_row_mirroring") is not False:
            failures.append("finished-row mirroring was enabled")
        if manifest["verification"].get(
            "byte_deterministic_second_pass"
        ) is not True:
            failures.append("manifest lacks a deterministic second pass")
        runtime_style = gate.get("runtime_style", {})
        if runtime_style.get("mechanical_passed") is not True:
            failures.append("runtime style gate is not green")
        if runtime_style.get("actual_palette_colors", 999) > 48:
            failures.append("runtime rows exceed the 48-color palette")
        if runtime_style.get("actual_alpha_values") != [0, 255]:
            failures.append("runtime rows contain partial alpha")
        gait = gate.get("gait_authority", {})
        if gait.get("schema") != "realm.actor-pose.a16-trader-gait-authority.v1":
            failures.append("trader gait-authority schema changed")
        if gait.get("authority") != "factor-brisk-step-v1":
            failures.append("trader gait authority changed")
        if gait.get("shared_a5_walk_pose") is not False:
            failures.append("trader fell back to the shared A5 walk pose")
        if gait.get("distinct_direction_trajectories") != 4:
            failures.append("trader lacks four distinct gait trajectories")
        if not gait.get("mechanical_passed") or gait.get("failures"):
            failures.append("trader gait-authority gate is not green")
        for direction in DIRECTIONS:
            changed = gait.get("directions", {}).get(direction, {}).get(
                "changed_frames_from_shared_a5", []
            )
            if changed != list(range(FRAMES)):
                failures.append(
                    f"walk/{direction} does not change all frames from shared A5"
                )

        exact_proofs = {
            "walk_default_exact": (35 * FRAMES, 46 * len(DIRECTIONS)),
            "walk_review_exact": (64 * FRAMES, 84 * len(DIRECTIONS)),
        }
        for key, size in exact_proofs.items():
            proof_path = out / manifest.get("proof", {}).get(key, "")
            if not proof_path.is_file():
                failures.append(f"missing exact walk proof {key}")
            else:
                rgba(proof_path, size)

        rows = manifest.get("rows", {})
        expected_keys = {
            f"{action}/{direction}"
            for action in ACTIONS
            for direction in DIRECTIONS
        }
        if set(rows) != expected_keys:
            failures.append("manifest row combination set changed")
        for action in ACTIONS:
            direction_hashes: set[str] = set()
            for direction in DIRECTIONS:
                key = f"{action}/{direction}"
                record = rows.get(key, {})
                row = rgba(out / record["row"], ROW_SIZE)
                direction_hashes.add(hashlib.sha256(row.tobytes()).hexdigest())
                row_gate = record.get("gate", {})
                if row_gate.get("scope", {}).get("role") != "trader":
                    failures.append(f"{key} row lost trader scope")
                if not row_gate.get("mechanical_passed"):
                    failures.append(f"{key} row gate is not green")
                for measurement in ("flattened", "body"):
                    quality = row_gate.get(
                        "production_quality", {}
                    ).get(measurement, {})
                    if quality.get("warnings") or quality.get("errors"):
                        failures.append(f"{key} {measurement} quality is not clean")
                    if quality.get("style_era") != "painted":
                        failures.append(f"{key} {measurement} lost painted style")
                equipment = rgba(out / record["equipment_plane"], ROW_SIZE)
                expected_equipment = action in ("work", "carry")
                if expected_equipment != (equipment.getbbox() is not None):
                    failures.append(f"{key} equipment plane state changed")
                landmarks = json.loads((out / record["landmarks"]).read_text())
                landmark_frames = landmarks.get("frames", [])
                if len(landmark_frames) != FRAMES:
                    failures.append(f"{key} landmark frame count changed")
                if action == "work" and any(
                    "tool_tip" not in frame for frame in landmark_frames
                ):
                    failures.append(f"{key} lacks merchant steelyard landmarks")
                if action == "work" and any(
                    "counter_anchor" not in frame
                    or "ledger_socket" not in frame
                    or "workstation_bbox" not in frame
                    for frame in landmark_frames
                ):
                    failures.append(f"{key} lacks grounded trade-counter landmarks")
                if action == "walk" and any(
                    frame.get("gait_authority") != "factor-brisk-step-v1"
                    for frame in landmark_frames
                ):
                    failures.append(f"{key} lost factor gait landmarks")
                for frame_index in range(FRAMES):
                    frame = row.crop((
                        frame_index * W,
                        0,
                        (frame_index + 1) * W,
                        H,
                    ))
                    bbox = frame.getchannel("A").getbbox()
                    if bbox is None or not 78 <= bbox[3] - 1 <= 80:
                        failures.append(
                            f"{key} frame {frame_index} baseline is not 79±1"
                        )
                for tier, size in RUNTIME_TIERS.items():
                    runtime = rgba(
                        out / record["runtime_rows"][tier],
                        (size[0] * FRAMES, size[1]),
                    )
                    alpha_values = set(
                        runtime.getchannel("A").get_flattened_data()
                    )
                    if not alpha_values <= {0, 255}:
                        failures.append(f"{key}/{tier} has partial alpha")
            if len(direction_hashes) != 4:
                failures.append(f"{action} lacks four distinct direction rows")

        # Palette-derived production rows are cadence evidence only. A16 must
        # not preserve any old trader/innkeeper/scholar/forager silhouette.
        for action in ACTIONS:
            for direction in DIRECTIONS:
                key = f"{action}/{direction}"
                candidate = rgba(out / rows[key]["row"], ROW_SIZE)
                candidate_alpha = candidate.getchannel("A").tobytes()
                # Atomic promotion retires the old compatibility-path trader
                # files. The three surviving palette peers had the same
                # byte-identical alpha geometry as the rejected trader rows.
                for peer in ("innkeeper", "scholar", "forager"):
                    legacy = rgba(
                        ROOT
                        / "assets/sprites/actor-rows"
                        / peer
                        / f"{action}-{direction}.png",
                        ROW_SIZE,
                    )
                    if candidate_alpha == legacy.getchannel("A").tobytes():
                        failures.append(
                            f"{key} is alpha-identical to palette-derived {peer}"
                        )

        contract = json.loads(CONTRACT.read_text())
        source_checks(contract, failures)
        if not args.skip_clean_rebuild:
            with tempfile.TemporaryDirectory(prefix="realm-a16-verify-") as tmp:
                rebuilt = Path(tmp) / "a16-trader-actions"
                process = subprocess.run(
                    [
                        sys.executable,
                        str(COMPILER),
                        "--source-dir",
                        str(CONTRACT.parent),
                        "--out-dir",
                        str(rebuilt),
                        "--verify",
                    ],
                    cwd=ROOT,
                    capture_output=True,
                    text=True,
                )
                if process.returncode:
                    failures.append(
                        "clean rebuild failed: "
                        + (process.stderr or process.stdout).strip()
                    )
                else:
                    failures.extend(compare_tree(out, rebuilt))
    except (KeyError, OSError, TypeError, ValueError, json.JSONDecodeError) as error:
        failures.append(str(error))

    if failures:
        for failure in failures:
            print(f"FAIL: {failure}")
        return 1
    print(
        "A16 trader verification OK: four source authorities, hollow garment, "
        "custom gait, grounded workstation, exact walk tiers, 16 rows, and "
        "clean rebuild are exact"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
