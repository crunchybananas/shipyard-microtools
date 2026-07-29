#!/usr/bin/env python3
"""Compile and verify the pinned CC0 walk as a Realm motion benchmark."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import statistics
import sys
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

from sprite_row_quality import analyze_row, write_proof  # noqa: E402


DEFAULT_SOURCE = (
    ROOT
    / "assets/sprites/prototypes/actor-pose/references/open-source/cc0-mixxit-64x80"
)
DEFAULT_CONTRACT = (
    ROOT
    / "assets/sprites/prototypes/actor-pose/source/a2-layered2d/cc0-walk-baseline.json"
)
DEFAULT_OUTPUT = (
    ROOT
    / "assets/sprites/prototypes/actor-pose/output/open-source-walk-baseline"
)
FRAME_W = 64
FRAME_H = 84
FRAMES = 8
LAYERS = ("male-body-walk.png", "male-pants-walk.png", "male-shirt-walk.png")


class BaselineError(RuntimeError):
    pass


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def png_bytes(image: Image.Image) -> bytes:
    output = io.BytesIO()
    image.save(output, "PNG", optimize=False, compress_level=9)
    return output.getvalue()


def visible_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    bbox = image.getchannel("A").point(
        lambda value: 255 if value >= 32 else 0
    ).getbbox()
    if bbox is None:
        raise BaselineError("baseline frame is blank")
    return bbox


def ground_runs(image: Image.Image, ground_y: int) -> list[list[int]]:
    alpha = image.getchannel("A")
    visible = [
        x for x in range(image.width) if alpha.getpixel((x, ground_y)) >= 32
    ]
    runs: list[list[int]] = []
    for x in visible:
        if not runs or x > runs[-1][1] + 1:
            runs.append([x, x])
        else:
            runs[-1][1] = x
    return runs


def frame_delta(first: Image.Image, second: Image.Image) -> int:
    return sum(
        abs(a - b)
        for a, b in zip(first.convert("RGBA").tobytes(), second.convert("RGBA").tobytes())
    )


def load_sources(
    source_dir: Path,
) -> tuple[dict[str, Any], dict[str, Image.Image], dict[str, bytes]]:
    source_record = json.loads((source_dir / "SOURCE.json").read_text())
    selected = {
        record["path"]: record for record in source_record["selected_files"]
    }
    images: dict[str, Image.Image] = {}
    source_bytes: dict[str, bytes] = {}
    for filename in LAYERS:
        path = source_dir / filename
        data = path.read_bytes()
        expected = selected.get(filename)
        if expected is None:
            raise BaselineError(f"{filename} missing from SOURCE.json")
        actual_hash = sha256_bytes(data)
        if actual_hash != expected["sha256"]:
            raise BaselineError(
                f"{filename} hash mismatch: {actual_hash} != {expected['sha256']}"
            )
        image = Image.open(io.BytesIO(data)).convert("RGBA")
        if image.size != (FRAME_W * FRAMES, 80):
            raise BaselineError(f"{filename} is not a 512x80 eight-frame row")
        images[filename] = image
        source_bytes[filename] = data
    return source_record, images, source_bytes


def compile_frames(
    images: dict[str, Image.Image],
    contract: dict[str, Any],
) -> list[Image.Image]:
    source_order = contract["source_frame_order"]
    if sorted(source_order) != list(range(FRAMES)):
        raise BaselineError("source_frame_order must be a permutation of 0..7")
    source_height = int(contract["frame"]["source_size"][1])
    y_offset = int(contract["frame"]["source_y_offset"])
    frames: list[Image.Image] = []
    for source_index in source_order:
        frame = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
        for filename in LAYERS:
            source_cell = images[filename].crop(
                (
                    source_index * FRAME_W,
                    0,
                    (source_index + 1) * FRAME_W,
                    source_height,
                )
            )
            frame.alpha_composite(source_cell, (0, y_offset))
        frames.append(frame)
    return frames


def validate(
    frames: list[Image.Image],
    contract: dict[str, Any],
) -> tuple[list[dict[str, Any]], list[int], list[str]]:
    ground_y = int(contract["frame"]["ground_y"])
    timeline = contract["timeline"]
    metrics: list[dict[str, Any]] = []
    failures: list[str] = []
    heights: list[int] = []
    for index, (frame, phase) in enumerate(zip(frames, timeline)):
        bbox = visible_bbox(frame)
        runs = ground_runs(frame, ground_y)
        height = bbox[3] - bbox[1]
        heights.append(height)
        frame_failures: list[str] = []
        if bbox[3] - 1 != ground_y:
            frame_failures.append(
                f"bottom {bbox[3] - 1} does not equal ground {ground_y}"
            )
        if runs != phase["ground_runs"]:
            frame_failures.append(
                f"ground runs {runs} do not equal {phase['ground_runs']}"
            )
        if len(runs) != len(phase["contacts"]):
            frame_failures.append(
                f"{len(runs)} rendered contacts != {len(phase['contacts'])} declared"
            )
        for failure in frame_failures:
            failures.append(f"frame {index} {phase['phase']}: {failure}")
        metrics.append(
            {
                "frame": index,
                "source_frame": contract["source_frame_order"][index],
                "phase": phase["phase"],
                "contacts": phase["contacts"],
                "bbox": list(bbox),
                "height": height,
                "bottom": bbox[3] - 1,
                "ground_runs": runs,
                "failures": frame_failures,
            }
        )

    height_range = max(heights) - min(heights)
    if height_range > int(contract["acceptance"]["height_range_max_px"]):
        failures.append(f"height range {height_range}px exceeds contract")
    hashes = [sha256_bytes(frame.tobytes()) for frame in frames]
    if len(set(hashes)) != FRAMES:
        failures.append("baseline does not contain eight distinct frames")

    deltas = [
        frame_delta(frames[index], frames[(index + 1) % FRAMES])
        for index in range(FRAMES)
    ]
    internal_median = statistics.median(deltas[:-1])
    loop_ratio = deltas[-1] / internal_median
    ratio_min, ratio_max = contract["acceptance"][
        "loop_delta_ratio_to_internal_median"
    ]
    if not ratio_min <= loop_ratio <= ratio_max:
        failures.append(
            f"loop delta ratio {loop_ratio:.3f} is outside "
            f"[{ratio_min:.3f}, {ratio_max:.3f}]"
        )
    return metrics, deltas, failures


def row_from_frames(frames: list[Image.Image]) -> Image.Image:
    row = Image.new("RGBA", (FRAME_W * FRAMES, FRAME_H), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        row.alpha_composite(frame, (index * FRAME_W, 0))
    return row


def proof_bytes(
    row: Image.Image,
    timeline: list[dict[str, Any]],
    ground_y: int,
) -> bytes:
    scale = 4
    scaled = row.resize((row.width * scale, row.height * scale), Image.Resampling.NEAREST)
    canvas = Image.new("RGB", (scaled.width, scaled.height + 24), "#111820")
    canvas.paste(scaled, (0, 24), scaled)
    draw = ImageDraw.Draw(canvas)
    draw.line(
        (0, 24 + ground_y * scale, canvas.width - 1, 24 + ground_y * scale),
        fill="#3f5968",
    )
    for phase in timeline:
        draw.text(
            (phase["frame"] * FRAME_W * scale + 4, 5),
            f"{phase['frame']} {phase['phase']}",
            fill="#e5edf0",
        )
    return png_bytes(canvas)


def motion_proof_bytes(
    frames: list[Image.Image],
    timeline: list[dict[str, Any]],
    ground_y: int,
) -> bytes:
    animation: list[Image.Image] = []
    for frame, phase in zip(frames, timeline):
        canvas = Image.new("RGB", (FRAME_W * 5, FRAME_H * 5 + 25), "#111820")
        scaled = frame.resize((FRAME_W * 5, FRAME_H * 5), Image.Resampling.NEAREST)
        canvas.paste(scaled, (0, 25), scaled)
        draw = ImageDraw.Draw(canvas)
        draw.text((6, 6), f"{phase['frame']} {phase['phase']}", fill="#e5edf0")
        draw.line(
            (0, 25 + ground_y * 5, canvas.width - 1, 25 + ground_y * 5),
            fill="#3f5968",
        )
        animation.append(canvas)
    output = io.BytesIO()
    animation[0].save(
        output,
        "GIF",
        save_all=True,
        append_images=animation[1:],
        duration=140,
        loop=0,
        disposal=2,
        optimize=False,
    )
    return output.getvalue()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--contract", type=Path, default=DEFAULT_CONTRACT)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--require-clean", action="store_true")
    args = parser.parse_args()

    source_record, images, source_files = load_sources(args.source_dir)
    contract_bytes = args.contract.read_bytes()
    contract = json.loads(contract_bytes)
    frames = compile_frames(images, contract)
    metrics, deltas, failures = validate(frames, contract)
    row = row_from_frames(frames)
    ground_y = int(contract["frame"]["ground_y"])
    row_bytes = png_bytes(row)
    proof = proof_bytes(row, contract["timeline"], ground_y)
    animation = motion_proof_bytes(
        frames, contract["timeline"], ground_y
    )
    internal_median = statistics.median(deltas[:-1])

    args.output_dir.mkdir(parents=True, exist_ok=True)
    row_path = args.output_dir / "walk-right.png"
    row_path.write_bytes(row_bytes)
    quality = analyze_row(row_path, "walk")
    quality_bytes = (
        json.dumps(quality, indent=2, sort_keys=True) + "\n"
    ).encode()
    quality_path = args.output_dir / "quality.json"
    quality_path.write_bytes(quality_bytes)
    quality_proof_path = args.output_dir / "quality-x4.png"
    write_proof(row_path, quality_proof_path, quality)
    quality_proof_bytes = quality_proof_path.read_bytes()

    manifest = {
        "schema": "realm.actor-pose.open-source-walk-baseline-output.v1",
        "status": "registration-contact-reference-not-production-art",
        "license": source_record["license"],
        "inputs": {
            "source_record": {
                "path": (args.source_dir / "SOURCE.json").relative_to(ROOT).as_posix(),
                "sha256": sha256_bytes(
                    (args.source_dir / "SOURCE.json").read_bytes()
                ),
            },
            "selected_files": {
                name: {
                    "sha256": sha256_bytes(data),
                    "bytes": len(data),
                }
                for name, data in sorted(source_files.items())
            },
            "contract": {
                "path": args.contract.relative_to(ROOT).as_posix(),
                "sha256": sha256_bytes(contract_bytes),
            },
            "compiler": {
                "path": Path(__file__).relative_to(ROOT).as_posix(),
                "sha256": sha256_bytes(Path(__file__).read_bytes()),
            },
        },
        "metrics": {
            "frames": metrics,
            "transition_deltas": deltas,
            "internal_transition_median": internal_median,
            "loop_delta_ratio": deltas[-1] / internal_median,
            "production_quality": {
                "style_era": quality["styleEra"],
                "median_color_count": quality["medianColorCount"],
                "median_shading_ratio": quality["medianShadingRatio"],
                "warnings": quality["warnings"],
                "errors": quality["errors"],
            },
            "failures": failures,
        },
        "outputs": {
            "row": "walk-right.png",
            "proof": "walk-right-x4.png",
            "motion_proof": "walk-right-x5.gif",
            "quality": {
                "path": "quality.json",
                "sha256": sha256_bytes(quality_bytes),
            },
            "quality_proof": {
                "path": "quality-x4.png",
                "sha256": sha256_bytes(quality_proof_bytes),
            },
        },
    }

    (args.output_dir / "walk-right-x4.png").write_bytes(proof)
    (args.output_dir / "walk-right-x5.gif").write_bytes(animation)
    (args.output_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n"
    )

    print(
        f"[open-source-walk-baseline] compiled {FRAMES} frames; "
        f"loop-ratio={deltas[-1] / internal_median:.3f}; "
        f"failures={len(failures)}"
    )
    for failure in failures:
        print(f"  FAIL: {failure}")
    return 1 if args.require_clean and failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
