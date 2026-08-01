#!/usr/bin/env python3
"""Exhaustively verify A6 cargo sources, rows, atlases, and runtime copies."""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
import tempfile
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "assets/sprites/prototypes/actor-pose/output/a6-cargo-payloads"
MANIFEST = OUTPUT / "manifest.json"
COMPILER = ROOT / "scripts/actor-pose-prototype/a6_cargo_payloads.py"
SPRITES = ROOT / "assets/sprites"
RESOURCES = ("wood", "stone", "food", "gold", "iron", "wheat", "flour", "planks", "tools")
DIRECTIONS = ("down", "up", "left", "right")
TIERS = {
    "native": (27, 35),
    "default": (35, 46),
    "double": (54, 70),
    "review": (64, 84),
}


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def file_map(root: Path) -> dict[str, str]:
    return {
        path.relative_to(root).as_posix(): sha(path)
        for path in sorted(root.rglob("*"))
        if path.is_file()
    }


def binary_alpha(image: Image.Image) -> bool:
    return set(image.convert("RGBA").getchannel("A").get_flattened_data()) <= {0, 255}


def main() -> int:
    failures: list[str] = []
    manifest = json.loads(MANIFEST.read_text())
    if manifest.get("schema") != "realm.actor-pose.a6-cargo-payloads-manifest.v1":
        failures.append("manifest schema changed")
    scope = manifest.get("scope", {})
    if tuple(scope.get("resources", ())) != RESOURCES:
        failures.append("manifest resource order changed")
    if tuple(scope.get("directions", ())) != DIRECTIONS:
        failures.append("manifest direction order changed")
    if scope.get("rows") != 36 or scope.get("frames") != 288:
        failures.append("manifest must describe 36 rows and 288 frames")
    if (
        scope.get("ownerRows")
        != [
            "guard/carry",
            "farmer/carry",
            "lumber/carry",
            "builder/carry",
            "blacksmith/carry",
            "miner/carry",
            "stonecutter/carry",
            "fisher/carry",
            "settler/carry",
        ]
        or scope.get("bakedContainer") is not True
    ):
        failures.append("manifest baked-container ownership changed")

    state_source = (ROOT / "js/state.js").read_text()
    match = re.search(
        r"RESOURCE_KEYS\s*=\s*Object\.freeze\(\[(.*?)\]\)",
        state_source,
        re.DOTALL,
    )
    runtime_resources = tuple(re.findall(r"'([^']+)'", match.group(1))) if match else ()
    if runtime_resources != RESOURCES:
        failures.append("A6 resources do not exactly match state.js RESOURCE_KEYS")

    declared_outputs = manifest.get("outputs", {})
    actual_outputs = {
        path.relative_to(OUTPUT).as_posix(): {
            "sha256": sha(path),
            "bytes": path.stat().st_size,
        }
        for path in sorted(OUTPUT.rglob("*"))
        if path.is_file() and path.name != "manifest.json"
    }
    if declared_outputs != actual_outputs:
        failures.append("checked A6 output set or hash inventory differs from manifest")

    for resource in RESOURCES:
        part = OUTPUT / "source-parts" / f"{resource}.png"
        if not part.is_file() or Image.open(part).convert("RGBA").getbbox() is None:
            failures.append(f"{resource} source part is missing or blank")
        for direction in DIRECTIONS:
            row = OUTPUT / "rows" / resource / f"{direction}.png"
            if not row.is_file():
                failures.append(f"missing canonical row {resource}/{direction}")
                continue
            image = Image.open(row).convert("RGBA")
            if image.size != (512, 84):
                failures.append(f"{resource}/{direction} row is not 512x84")
            if not binary_alpha(image):
                failures.append(f"{resource}/{direction} row does not use binary alpha")
            for frame in range(8):
                if image.crop((frame * 64, 0, (frame + 1) * 64, 84)).getbbox() is None:
                    failures.append(f"{resource}/{direction} frame {frame} is blank")

    atlas_records = {record["key"]: record for record in manifest.get("atlases", [])}
    runtime_manifest_path = SPRITES / "cargo-payloads-runtime-atlases.json"
    runtime_manifest = json.loads(runtime_manifest_path.read_text())
    runtime_records = {record["key"]: record for record in runtime_manifest.get("atlases", [])}
    for key, (frame_w, frame_h) in TIERS.items():
        record = atlas_records.get(key)
        runtime_record = runtime_records.get(key)
        if not record or not runtime_record:
            failures.append(f"missing {key} atlas metadata")
            continue
        source = OUTPUT / record["path"]
        runtime = SPRITES / record["file"]
        expected_size = (frame_w * 8, frame_h * len(RESOURCES) * len(DIRECTIONS))
        for label, path in (("source", source), ("runtime", runtime)):
            if not path.is_file():
                failures.append(f"missing {key} {label} atlas")
                continue
            image = Image.open(path).convert("RGBA")
            if image.size != expected_size:
                failures.append(f"{key} {label} atlas has dimensions {image.size}, expected {expected_size}")
        if source.is_file() and sha(source) != record["sha256"]:
            failures.append(f"{key} source atlas hash mismatch")
        if source.is_file() and runtime.is_file() and source.read_bytes() != runtime.read_bytes():
            failures.append(f"{key} runtime atlas is not the exact compiled source atlas")
        if runtime.is_file() and runtime_record.get("sha256") != sha(runtime):
            failures.append(f"{key} runtime manifest hash mismatch")

    with tempfile.TemporaryDirectory(prefix="realm-a6-verify-") as temp:
        rebuilt = Path(temp) / "a6-cargo-payloads"
        result = subprocess.run(
            [
                "python3",
                str(COMPILER),
                "--source-dir",
                str(ROOT / "assets/sprites/prototypes/actor-pose/source/a6-cargo-payloads"),
                "--out-dir",
                str(rebuilt),
                "--verify",
            ],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode:
            failures.append(f"clean A6 rebuild failed: {result.stdout}{result.stderr}")
        elif file_map(rebuilt) != file_map(OUTPUT):
            failures.append("clean A6 rebuild differs byte-for-byte from checked output")

    if failures:
        print("[a6-cargo-verify] FAIL")
        for failure in failures:
            print(f"  - {failure}")
        return 1
    print(
        "[a6-cargo-verify] PASS — 9 resources / 4 directions / "
        "36 rows / 288 frames / 4 byte-locked runtime tiers / 9 baked-container owners"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
