#!/usr/bin/env python3
"""Strict disk and clean-rebuild gate for the Realm A4 guard family."""

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
    / "assets/sprites/prototypes/actor-pose/output/a4-guard-family"
)
COMPILER = ROOT / "scripts/actor-pose-prototype/a4_guard_family.py"
DIRECTIONS = ("down", "up", "left", "right")
ATTACHMENTS = ("off", "cargo-crate")
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
        description="Verify the Realm A4 guard-family artifact tree."
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
            != "realm.actor-pose.a4-guard-family-manifest.v1"
        ):
            failures.append("manifest schema is not A4 guard-family v1")
        if manifest.get("stage") != "guard-carry-four-directions":
            failures.append("manifest stage changed")
        if manifest.get("status") != "direction-family-proven":
            failures.append("manifest status is not direction-family-proven")

        scope = manifest.get("scope", {})
        if scope.get("directions") != list(DIRECTIONS):
            failures.append("manifest direction order changed")
        if scope.get("attachments") != list(ATTACHMENTS):
            failures.append("manifest attachment states changed")
        if scope.get("flattened_rows") != 8:
            failures.append("manifest does not declare eight rows")
        if scope.get("flattened_frames") != 64:
            failures.append("manifest does not declare 64 frames")
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
        if gate.get("schema") != "realm.actor-pose.a4-guard-family-gate.v1":
            failures.append("guard-family gate schema changed")
        if not gate.get("mechanical_passed") or gate.get("failures"):
            failures.append("guard-family gate is not green")
        if gate.get("distinct_direction_rows") != 4:
            failures.append("four cargo directions are not visually distinct")
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
            f"{direction}/{attachment}"
            for direction in DIRECTIONS
            for attachment in ATTACHMENTS
        }
        if set(rows) != expected_keys:
            failures.append("manifest row combination set changed")
        direction_hashes: set[str] = set()
        for direction in DIRECTIONS:
            for attachment in ATTACHMENTS:
                key = f"{direction}/{attachment}"
                record = rows.get(key, {})
                row = rgba(out / record["row"], ROW_SIZE)
                if direction and attachment == "cargo-crate":
                    direction_hashes.add(hashlib.sha256(row.tobytes()).hexdigest())
                row_gate = record.get("gate", {})
                if not row_gate.get("mechanical_passed"):
                    failures.append(f"{key} row gate is not green")
                quality = row_gate.get("production_quality", {})
                if quality.get("warnings") or quality.get("errors"):
                    failures.append(f"{key} has quality warnings or errors")
                if quality.get("style_era") != "painted":
                    failures.append(f"{key} lost the painted style class")
                attachment_plane = rgba(
                    out / record["attachment_plane"],
                    ROW_SIZE,
                )
                if (
                    attachment == "off"
                    and attachment_plane.getbbox() is not None
                ):
                    failures.append(f"{key} off plane is not transparent")
                if (
                    attachment == "cargo-crate"
                    and attachment_plane.getbbox() is None
                ):
                    failures.append(f"{key} cargo plane is blank")
                for tier, frame_size in RUNTIME_TIERS.items():
                    runtime = rgba(
                        out / record["runtime_rows"][tier],
                        (frame_size[0] * FRAMES, frame_size[1]),
                    )
                    alpha = set(
                        runtime.getchannel("A").get_flattened_data()
                    )
                    if not alpha <= {0, 255}:
                        failures.append(
                            f"{key}/{tier} contains partial alpha"
                        )
        if len(direction_hashes) != 4:
            failures.append("cargo direction hashes collapsed")

        if not args.skip_clean_rebuild:
            with tempfile.TemporaryDirectory(
                prefix="realm-a4-guard-family-verify-"
            ) as temp:
                rebuilt = Path(temp) / "a4-guard-family"
                process = subprocess.run(
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
                if process.returncode != 0:
                    failures.append(
                        "clean rebuild failed: "
                        + (process.stderr.strip() or process.stdout.strip())
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
        print("A4 guard-family verification failed:", file=sys.stderr)
        for failure in failures:
            print(f"- {failure}", file=sys.stderr)
        return 1
    print(
        "A4 guard-family verification OK: "
        "4 directions × 2 attachment states × 8 frames; "
        "clean rebuild is byte-identical"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
