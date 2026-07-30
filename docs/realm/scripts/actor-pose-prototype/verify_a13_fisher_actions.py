#!/usr/bin/env python3
"""Strict disk, source, and clean-rebuild gate for the Realm A13 fisher."""

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
    / "assets/sprites/prototypes/actor-pose/output/a13-fisher-actions"
)
COMPILER = ROOT / "scripts/actor-pose-prototype/a13_fisher_actions.py"
CONTRACT = (
    ROOT
    / "assets/sprites/prototypes/actor-pose/source/a13-fisher-actions/parts.json"
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


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Verify the Realm A13 fisher action-family artifact tree."
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
            != "realm.actor-pose.a13-fisher-actions-manifest.v1"
        ):
            failures.append("manifest schema is not A13 fisher-actions v1")
        if manifest.get("stage") != "fisher-four-action-family":
            failures.append("manifest stage changed")
        if manifest.get("status") != "action-family-proven":
            failures.append("manifest status is not action-family-proven")

        scope = manifest.get("scope", {})
        expected_scope = {
            "role": "fisher",
            "identity": "harborhand",
            "garment": "storm-teal",
        }
        for key, value in expected_scope.items():
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
        for path in out.rglob("*"):
            if path.is_symlink():
                failures.append(
                    f"artifact tree contains symlink {path.relative_to(out)}"
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

        gate_path = out / manifest["verification"]["report"]
        gate = json.loads(gate_path.read_text())
        if gate.get("schema") != "realm.actor-pose.a13-fisher-actions-gate.v1":
            failures.append("fisher-actions gate schema changed")
        if not gate.get("mechanical_passed") or gate.get("failures"):
            failures.append("fisher-actions gate is not green")
        if gate.get("rows") != 16 or gate.get("frames") != 128:
            failures.append("fisher-actions gate scope changed")
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
                if row_gate.get("scope", {}).get("role") != "fisher":
                    failures.append(f"{key} row lost fisher scope")
                if not row_gate.get("mechanical_passed"):
                    failures.append(f"{key} row gate is not green")
                for measurement in ("flattened", "body"):
                    quality = row_gate.get(
                        "production_quality", {}
                    ).get(measurement, {})
                    if quality.get("warnings") or quality.get("errors"):
                        failures.append(
                            f"{key} {measurement} quality is not clean"
                        )
                    if quality.get("style_era") != "painted":
                        failures.append(
                            f"{key} {measurement} lost painted style"
                        )
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
                    failures.append(f"{key} lacks gaff-head landmarks")
                if action == "work" and any(
                    "creel_catch" not in frame
                    or "creel_anchor" not in frame
                    for frame in landmark_frames
                ):
                    failures.append(f"{key} lacks grounded-creel landmarks")
                for tier, size in RUNTIME_TIERS.items():
                    runtime = rgba(
                        out / record["runtime_rows"][tier],
                        (size[0] * FRAMES, size[1]),
                    )
                    alpha_values = set(
                        runtime.getchannel("A").get_flattened_data()
                    )
                    if not alpha_values <= {0, 255}:
                        failures.append(
                            f"{key}/{tier} contains partial runtime alpha"
                        )
            if len(direction_hashes) != 4:
                failures.append(f"{action} lacks four distinct direction rows")

        contract = json.loads(CONTRACT.read_text())
        for owner in ("identity", "garment", "tool", "workstation"):
            record = contract[owner]
            alpha_path = ROOT / record["path"]
            source = Image.open(alpha_path).convert("RGBA")
            alpha = source.getchannel("A")
            corners = (
                (0, 0),
                (source.width - 1, 0),
                (0, source.height - 1),
                (source.width - 1, source.height - 1),
            )
            if any(alpha.getpixel(point) for point in corners):
                failures.append(
                    f"{owner} source corners are not transparent"
                )
            for direction in DIRECTIONS:
                parts = record["parts"][direction]
                if owner in ("tool", "workstation"):
                    part_name = "gaff" if owner == "tool" else "creel"
                    parts = {part_name: parts}
                for part, box in parts.items():
                    crop = source.crop(tuple(box))
                    if crop.getbbox() is None:
                        failures.append(
                            f"{owner}/{direction}/{part} crop is blank"
                        )
            keyed = record["generation_source"]
            keyed_path = ROOT / keyed["path"]
            if sha(keyed_path) != keyed["sha256"]:
                failures.append(f"{owner} keyed source hash is stale")
            prompt_path = ROOT / record["source_prompt"]
            prompt = json.loads(prompt_path.read_text())
            if prompt.get("alpha_sha256") != sha(alpha_path):
                failures.append(
                    f"{owner} prompt alpha provenance is stale"
                )
            if prompt.get("keyed_sha256") != sha(keyed_path):
                failures.append(
                    f"{owner} prompt keyed provenance is stale"
                )
            if prompt.get("generator", {}).get("mode") != (
                "built-in image_gen"
            ):
                failures.append(
                    f"{owner} prompt generator mode changed"
                )
            if not prompt.get("prompt"):
                failures.append(f"{owner} final generation prompt is blank")

        if not args.skip_clean_rebuild:
            with tempfile.TemporaryDirectory(
                prefix="realm-a13-clean-"
            ) as temp:
                rebuilt = Path(temp) / "a13-fisher-actions"
                result = subprocess.run(
                    [
                        sys.executable,
                        str(COMPILER),
                        "--verify",
                        "--out-dir",
                        str(rebuilt),
                    ],
                    cwd=ROOT,
                    capture_output=True,
                    text=True,
                    check=False,
                )
                if result.returncode:
                    failures.append(
                        "clean rebuild failed: "
                        f"{result.stdout.strip()} {result.stderr.strip()}"
                    )
                else:
                    failures.extend(compare_tree(out, rebuilt))
    except (
        OSError,
        KeyError,
        TypeError,
        ValueError,
        json.JSONDecodeError,
    ) as error:
        failures.append(str(error))

    if failures:
        print("A13 fisher action-family verification failed:", file=sys.stderr)
        for failure in failures:
            print(f"- {failure}", file=sys.stderr)
        return 1
    print(
        "A13 fisher action-family verified: 16 rows / 128 frames, "
        "clean quality, socketed gaff, grounded fish creel, and cargo, exact "
        "runtime tiers, and byte-identical clean rebuild"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
