#!/usr/bin/env python3
"""Build RFC 0002 Candidate C from Realm's current row-review sources.

Candidate C is deliberately a control, not a repair pass. For each of the
sixteen bounded rows it selects the exact art Sprite Lab would put in front of
a reviewer:

1. a staged manifest candidate;
2. an accepted, hash-locked manifest override;
3. the compiled role sheet; or
4. the editable base role sheet when no compiled sheet exists.

The build normalizes only the PNG container. It never rescales, reorders, or
repaints pixels.
"""

from __future__ import annotations

import argparse
import json
import shutil
import tempfile
from pathlib import Path

from PIL import Image

from common import (
    DIRECTIONS,
    EXPECTED_KEYS,
    FRAME_COUNT,
    FRAME_HEIGHT,
    FRAME_WIDTH,
    OUTPUT_ROOT,
    ROOT,
    ROW_WIDTH,
    file_hash_map,
    frame_pixel_hashes,
    repository_path,
    save_rgba_png,
    sha256_file,
    sha256_image_pixels,
    split_row_key,
    tree_hash,
    write_json,
)


SPRITES = ROOT / "assets" / "sprites"
BASE_DIR = SPRITES / "actors"
COMPILED_DIR = SPRITES / "actors-compiled"
ROW_DIR = SPRITES / "actor-rows"
ROW_MANIFEST = ROW_DIR / "manifest.json"
DEFAULT_OUTPUT = OUTPUT_ROOT / "c-row-factory"
ACTIONS = ("idle", "walk", "work", "carry")


def load_row_manifest() -> dict:
    data = json.loads(ROW_MANIFEST.read_text(encoding="utf-8"))
    if data.get("version") != 1 or not isinstance(data.get("rows"), dict):
        raise RuntimeError(f"{repository_path(ROW_MANIFEST)} is not a version 1 row manifest")
    return data


def manifest_row_path(item: dict, key: str) -> Path:
    file_value = item.get("file")
    if not isinstance(file_value, str) or not file_value:
        raise RuntimeError(f"{key} has no file in the actor-row manifest")
    path = (ROW_DIR / file_value).resolve()
    row_root = ROW_DIR.resolve()
    if path != row_root and row_root not in path.parents:
        raise RuntimeError(f"{key} escapes {repository_path(ROW_DIR)}")
    if not path.is_file():
        raise RuntimeError(f"{key} source is missing: {repository_path(path)}")
    return path


def open_exact_row(path: Path, key: str) -> Image.Image:
    with Image.open(path) as source:
        if source.size != (ROW_WIDTH, FRAME_HEIGHT):
            raise RuntimeError(
                f"{key} source must be {ROW_WIDTH}x{FRAME_HEIGHT}; got "
                f"{source.width}x{source.height}"
            )
        return source.convert("RGBA")


def crop_sheet_row(path: Path, key: str, action: str, direction: str) -> Image.Image:
    with Image.open(path) as source:
        expected_height = len(ACTIONS) * len(DIRECTIONS) * FRAME_HEIGHT
        if source.size != (ROW_WIDTH, expected_height):
            raise RuntimeError(
                f"{key} sheet must be {ROW_WIDTH}x{expected_height}; got "
                f"{source.width}x{source.height}"
            )
        row_index = ACTIONS.index(action) * len(DIRECTIONS) + DIRECTIONS.index(direction)
        y = row_index * FRAME_HEIGHT
        return source.convert("RGBA").crop((0, y, ROW_WIDTH, y + FRAME_HEIGHT))


def select_row(manifest: dict, key: str) -> tuple[Image.Image, dict]:
    role, action, direction = split_row_key(key)
    item = manifest["rows"].get(key)
    if item and item.get("status") in ("candidate", "accepted"):
        status = item["status"]
        source_path = manifest_row_path(item, key)
        source_file_hash = sha256_file(source_path)
        declared_hash = item.get("sha256")
        if source_file_hash != declared_hash:
            raise RuntimeError(
                f"{key} {status} source hash differs from the actor-row manifest: "
                f"{source_file_hash} != {declared_hash}"
            )
        image = open_exact_row(source_path, key)
        source = {
            "kind": f"manifest-{status}",
            "path": repository_path(source_path),
            "fileSha256": source_file_hash,
            "declaredSha256": declared_hash,
            "provenance": item.get("provenance"),
            "note": item.get("note"),
            "quality": item.get("quality"),
            "status": status,
        }
        return image, source

    compiled = COMPILED_DIR / f"{role}.png"
    base = BASE_DIR / f"{role}.png"
    source_path = compiled if compiled.is_file() else base
    if not source_path.is_file():
        raise RuntimeError(f"{key} has neither a compiled nor base role sheet")
    image = crop_sheet_row(source_path, key, action, direction)
    source = {
        "kind": "compiled-sheet" if source_path == compiled else "base-sheet",
        "path": repository_path(source_path),
        "fileSha256": sha256_file(source_path),
        "declaredSha256": None,
        "provenance": "current-compiled-row" if source_path == compiled else "current-base-row",
        "note": "No candidate or accepted row override exists for this review key.",
        "quality": None,
        "status": "base",
        "rowIndex": ACTIONS.index(action) * len(DIRECTIONS) + DIRECTIONS.index(direction),
    }
    return image, source


def build_candidate(output: Path, *, determinism_checked: bool) -> dict:
    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True)
    manifest = load_row_manifest()
    rows: dict[str, dict] = {}
    outputs: dict[str, dict] = {}

    for key in EXPECTED_KEYS:
        role, action, direction = split_row_key(key)
        image, source = select_row(manifest, key)
        relative_output = Path("rows") / role / action / f"{direction}.png"
        destination = output / relative_output
        save_rgba_png(image, destination)
        frame_hashes = frame_pixel_hashes(image)
        item = {
            "role": role,
            "action": action,
            "direction": direction,
            "output": relative_output.as_posix(),
            "width": image.width,
            "height": image.height,
            "mode": "RGBA",
            "sha256": sha256_file(destination),
            "pixelSha256": sha256_image_pixels(image),
            "framePixelSha256": frame_hashes,
            "distinctFrameHashes": len(set(frame_hashes)),
            "source": source,
            "sockets": {
                "status": "missing",
                "reason": "Flattened current-row art has no authored socket data.",
            },
        }
        rows[key] = item
        outputs[relative_output.as_posix()] = {
            key_name: value
            for key_name, value in item.items()
            if key_name not in ("output",)
        }

    source_selection_hash = tree_hash(
        {
            key: (
                f"{item['source']['fileSha256']}:{item['source']['kind']}:"
                f"{item['pixelSha256']}"
            )
            for key, item in rows.items()
        }
    )
    candidate_manifest = {
        "schema": "realm.actor-pose-prototype.candidate/v1",
        "candidate": "C",
        "name": "corrected-current-row-factory-control",
        "generator": {
            "script": "scripts/actor-pose-prototype/control.py",
            "version": 1,
            "networkFree": True,
        },
        "reproducibility": {
            "byteReproducible": True if determinism_checked else None,
            "doubleBuildChecked": determinism_checked,
            "matched": True if determinism_checked else None,
            "method": (
                "two isolated clean output directories compared by relative file SHA-256"
                if determinism_checked
                else "not checked in this invocation"
            ),
        },
        "cell": {
            "width": FRAME_WIDTH,
            "height": FRAME_HEIGHT,
            "frames": FRAME_COUNT,
            "rowWidth": ROW_WIDTH,
            "mode": "RGBA",
        },
        "selectionPolicy": [
            "manifest-candidate",
            "manifest-accepted",
            "compiled-sheet",
            "base-sheet",
        ],
        "timeline": {
            "frameOrder": list(range(FRAME_COUNT)),
            "authoredBeats": False,
            "note": (
                "Runtime frame order is preserved, but the flattened control "
                "does not provide authored cross-view beat/contact metadata."
            ),
        },
        "socketContract": {
            "status": "missing",
            "reason": (
                "Candidate C contains flattened review art. Socket coordinates "
                "must not be inferred and presented as authored data."
            ),
        },
        "expectedRows": list(EXPECTED_KEYS),
        "sourceSelectionSha256": source_selection_hash,
        "rows": rows,
        "outputs": outputs,
    }
    write_json(output / "manifest.json", candidate_manifest)
    return candidate_manifest


def validate_output_path(output: Path) -> Path:
    resolved = output.resolve()
    allowed = DEFAULT_OUTPUT.resolve()
    if resolved != allowed:
        raise SystemExit(
            "Candidate C output is intentionally isolated; --output must resolve to "
            f"{repository_path(allowed)}"
        )
    return resolved


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        "--out-dir",
        dest="output",
        type=Path,
        default=DEFAULT_OUTPUT,
    )
    parser.add_argument(
        "--skip-determinism-check",
        action="store_true",
        help="Build once. Intended only for local debugging.",
    )
    args = parser.parse_args()
    output = validate_output_path(args.output)

    if args.skip_determinism_check:
        build_candidate(output, determinism_checked=False)
        files = file_hash_map(output)
        print(
            f"[actor-pose:C] wrote {len(EXPECTED_KEYS)} rows; "
            f"tree sha256 {tree_hash(files)} (determinism check skipped)"
        )
        return

    with tempfile.TemporaryDirectory(prefix="realm-pose-control-a-") as first_tmp, \
            tempfile.TemporaryDirectory(prefix="realm-pose-control-b-") as second_tmp:
        first = Path(first_tmp) / "c-row-factory"
        second = Path(second_tmp) / "c-row-factory"
        build_candidate(first, determinism_checked=True)
        build_candidate(second, determinism_checked=True)
        first_files = file_hash_map(first)
        second_files = file_hash_map(second)
        if first_files != second_files:
            all_names = sorted(set(first_files) | set(second_files))
            mismatches = [
                name
                for name in all_names
                if first_files.get(name) != second_files.get(name)
            ]
            raise SystemExit(
                "Candidate C double-build mismatch: " + ", ".join(mismatches)
            )
        if output.exists():
            shutil.rmtree(output)
        shutil.copytree(first, output)

    digest = tree_hash(file_hash_map(output))
    print(
        f"[actor-pose:C] deterministic double build matched; "
        f"wrote {len(EXPECTED_KEYS)} rows; tree sha256 {digest}"
    )


if __name__ == "__main__":
    main()
