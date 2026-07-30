#!/usr/bin/env python3
"""Compile resource-specific raster payloads for the A5 guard carry family."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import shutil
import tempfile
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[2]
PROTO = ROOT / "assets/sprites/prototypes/actor-pose"
SOURCE = PROTO / "source/a6-cargo-payloads"
OUT = PROTO / "output/a6-cargo-payloads"
CONTRACT_PATH = SOURCE / "parts.json"
FRAME_W = 64
FRAME_H = 84
FRAMES = 8


class A6Error(RuntimeError):
    pass


def canonical(value: Any) -> bytes:
    return (json.dumps(value, indent=2, sort_keys=True) + "\n").encode()


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def file_record(path: Path, owner: str) -> dict[str, Any]:
    data = path.read_bytes()
    return {
        "path": path.relative_to(ROOT).as_posix(),
        "sha256": digest(data),
        "bytes": len(data),
        "owner": owner,
    }


def png(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, "PNG", optimize=False)
    return buffer.getvalue()


def sanitize(image: Image.Image) -> Image.Image:
    result = image.convert("RGBA")
    result.putdata([
        pixel if pixel[3] else (0, 0, 0, 0)
        for pixel in result.get_flattened_data()
    ])
    return result


def alpha_bbox(image: Image.Image, threshold: int = 18) -> tuple[int, int, int, int] | None:
    return image.getchannel("A").point(
        lambda value: 255 if value >= threshold else 0
    ).getbbox()


def fit_size(source: Image.Image, maximum: tuple[int, int]) -> tuple[int, int]:
    scale = min(maximum[0] / source.width, maximum[1] / source.height)
    return (
        max(1, round(source.width * scale)),
        max(1, round(source.height * scale)),
    )


def palette_bound(image: Image.Image, colors: int, alpha_threshold: int) -> Image.Image:
    rgba = sanitize(image)
    alpha = rgba.getchannel("A").point(
        lambda value: 255 if value >= alpha_threshold else 0
    )
    toned = ImageEnhance.Color(rgba.convert("RGB")).enhance(1.08)
    toned = ImageEnhance.Contrast(toned).enhance(1.06)
    indexed = toned.quantize(
        colors=colors,
        method=Image.Quantize.MEDIANCUT,
        dither=Image.Dither.NONE,
    ).convert("RGB")
    indexed.putalpha(alpha)
    return sanitize(indexed)


def downsample_frame(frame: Image.Image, size: tuple[int, int]) -> Image.Image:
    source = sanitize(frame)
    if size == (FRAME_W, FRAME_H):
        return source
    return sanitize(
        source.resize(size, Image.Resampling.BOX).filter(
            ImageFilter.UnsharpMask(radius=0.7, percent=80, threshold=5)
        )
    )


def load_inputs(source_dir: Path) -> tuple[dict[str, Any], Image.Image, dict[str, Any]]:
    contract_path = source_dir / "parts.json"
    contract = json.loads(contract_path.read_text())
    if contract.get("schema") != "realm.actor-pose.a6-cargo-payloads.v1":
        raise A6Error("A6 parts contract must be v1")
    frame = contract.get("frame", {})
    if (
        frame.get("width"),
        frame.get("height"),
        frame.get("beats"),
    ) != (FRAME_W, FRAME_H, FRAMES):
        raise A6Error("A6 frame contract changed")

    source_record = contract["source"]
    source_path = ROOT / source_record["path"]
    if digest(source_path.read_bytes()) != source_record["sha256"]:
        raise A6Error("A6 transparent source hash changed")
    prompt_path = ROOT / source_record["prompt"]
    prompt = json.loads(prompt_path.read_text())
    if prompt["transparent_source"]["sha256"] != source_record["sha256"]:
        raise A6Error("A6 prompt provenance does not lock the transparent source")

    files = {
        "contract": file_record(contract_path, "attachment-contract"),
        "source": file_record(source_path, "imagegen-transparent-source"),
        "prompt": file_record(prompt_path, "imagegen-provenance"),
        "compiler": file_record(Path(__file__), "compiler-source"),
    }
    return contract, Image.open(source_path).convert("RGBA"), files


def crop_sources(
    contract: dict[str, Any],
    board: Image.Image,
) -> dict[str, Image.Image]:
    edges = contract["source"]["grid"]["edges"]
    if edges != [0, 418, 836, 1254] or board.size != (1254, 1254):
        raise A6Error("A6 source board or declared equal-cell grid changed")
    parts: dict[str, Image.Image] = {}
    for record in contract["resources"]:
        column, row = record["cell"]
        cell = board.crop((
            edges[column],
            edges[row],
            edges[column + 1],
            edges[row + 1],
        ))
        box = alpha_bbox(cell)
        if not box:
            raise A6Error(f"{record['key']} source cell is blank")
        parts[record["key"]] = sanitize(cell.crop(box))
    return parts


def build_payload(
    source: Image.Image,
    maximum: tuple[int, int],
    *,
    width_scale: float,
    mirror: bool,
    style: dict[str, Any],
) -> Image.Image:
    width, height = fit_size(source, maximum)
    width = max(1, round(width * width_scale))
    payload = source.resize((width, height), Image.Resampling.LANCZOS)
    payload = palette_bound(
        payload,
        int(style["colors_per_payload"]),
        int(style["alpha_threshold"]),
    )
    return payload.transpose(Image.Transpose.FLIP_LEFT_RIGHT) if mirror else payload


def compose_row(
    payload: Image.Image,
    landmarks: dict[str, Any],
    bottom_offset: int,
) -> Image.Image:
    row = Image.new("RGBA", (FRAME_W * FRAMES, FRAME_H), (0, 0, 0, 0))
    if len(landmarks.get("frames", [])) != FRAMES:
        raise A6Error("A5 carry landmark row must contain eight frames")
    for index, record in enumerate(landmarks["frames"]):
        socket = record.get("sockets", {}).get("load")
        if not isinstance(socket, list) or len(socket) != 2:
            raise A6Error(f"A5 carry frame {index} has no load socket")
        left = round(socket[0] - payload.width / 2)
        top = round(socket[1] + bottom_offset - payload.height)
        if left < 0 or top < 0 or left + payload.width > FRAME_W or top + payload.height > FRAME_H:
            raise A6Error(f"payload clips frame {index}")
        frame = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
        frame.alpha_composite(payload, (left, top))
        row.alpha_composite(frame, (index * FRAME_W, 0))
    return row


def row_frames(row: Image.Image) -> list[Image.Image]:
    return [
        row.crop((index * FRAME_W, 0, (index + 1) * FRAME_W, FRAME_H))
        for index in range(FRAMES)
    ]


def resize_row(row: Image.Image, frame_size: tuple[int, int]) -> Image.Image:
    out = Image.new(
        "RGBA",
        (frame_size[0] * FRAMES, frame_size[1]),
        (0, 0, 0, 0),
    )
    for index, frame in enumerate(row_frames(row)):
        out.alpha_composite(
            downsample_frame(frame, frame_size),
            (index * frame_size[0], 0),
        )
    return out


def make_proof(
    rows: dict[tuple[str, str], Image.Image],
    carrier_rows: dict[str, Image.Image],
    resources: list[str],
    directions: list[str],
) -> Image.Image:
    scale = 3
    label_w = 76
    row_h = FRAME_H * scale
    image = Image.new(
        "RGBA",
        (label_w + FRAME_W * FRAMES * scale, 28 + len(resources) * len(directions) * row_h),
        (20, 25, 29, 255),
    )
    draw = ImageDraw.Draw(image)
    draw.text((8, 8), "A6 RESOURCE PAYLOADS | actor-aligned 64x84 source rows | x3 nearest", fill=(245, 211, 118, 255))
    y = 28
    for resource in resources:
        for direction in directions:
            draw.text((6, y + 8), f"{resource}\\n{direction}", fill=(231, 236, 239, 255))
            composite = carrier_rows[direction].copy()
            composite.alpha_composite(rows[(resource, direction)])
            image.alpha_composite(
                composite.resize(
                    (FRAME_W * FRAMES * scale, row_h),
                    Image.Resampling.NEAREST,
                ),
                (label_w, y),
            )
            y += row_h
    return image


def build(
    contract: dict[str, Any],
    board: Image.Image,
    files: dict[str, Any],
) -> tuple[dict[str, bytes], dict[str, Any]]:
    parts = crop_sources(contract, board)
    resources = [record["key"] for record in contract["resources"]]
    directions = list(contract["directions"])
    resource_records = {record["key"]: record for record in contract["resources"]}
    rows: dict[tuple[str, str], Image.Image] = {}
    carrier_rows: dict[str, Image.Image] = {}
    artifacts: dict[str, bytes] = {}

    for direction in directions:
        carrier_path = (
            ROOT
            / contract["carrier"]["rows_root"]
            / f"carry-{direction}.png"
        )
        carrier = Image.open(carrier_path).convert("RGBA")
        if carrier.size != (FRAME_W * FRAMES, FRAME_H):
            raise A6Error(f"A5 carry-{direction} row dimensions changed")
        carrier_rows[direction] = carrier
        files[f"carrier-row-{direction}"] = file_record(
            carrier_path,
            "A5-baked-container-carrier",
        )

    for resource in resources:
        artifacts[f"source-parts/{resource}.png"] = png(parts[resource])
        maximum = tuple(resource_records[resource]["max_size"])
        for direction in directions:
            placement = contract["placement"][direction]
            payload = build_payload(
                parts[resource],
                maximum,
                width_scale=float(placement["width_scale"]),
                mirror=bool(placement["mirror"]),
                style=contract["style"],
            )
            landmarks_path = (
                ROOT
                / contract["carrier"]["landmarks_root"]
                / f"carry-{direction}.json"
            )
            landmarks = json.loads(landmarks_path.read_text())
            files[f"landmarks-{direction}"] = file_record(
                landmarks_path,
                "A5-load-socket-authority",
            )
            row = compose_row(payload, landmarks, int(placement["bottom_offset"]))
            rows[(resource, direction)] = row
            artifacts[f"rows/{resource}/{direction}.png"] = png(row)

    atlas_records = []
    for tier in contract["runtime_tiers"]:
        frame_size = (tier["frame_width"], tier["frame_height"])
        atlas = Image.new(
            "RGBA",
            (
                frame_size[0] * FRAMES,
                frame_size[1] * len(resources) * len(directions),
            ),
            (0, 0, 0, 0),
        )
        row_index = 0
        for resource in resources:
            for direction in directions:
                resized = resize_row(rows[(resource, direction)], frame_size)
                relative = f"rows-runtime/{tier['key']}/{resource}-{direction}.png"
                artifacts[relative] = png(resized)
                atlas.alpha_composite(resized, (0, row_index * frame_size[1]))
                row_index += 1
        relative = f"atlases/{tier['file']}"
        atlas_bytes = png(atlas)
        artifacts[relative] = atlas_bytes
        atlas_records.append({
            "key": tier["key"],
            "file": tier["file"],
            "path": relative,
            "frameWidth": frame_size[0],
            "frameHeight": frame_size[1],
            "width": atlas.width,
            "height": atlas.height,
            "sha256": digest(atlas_bytes),
        })

    artifacts["proof/cargo-payloads-x3.png"] = png(
        make_proof(rows, carrier_rows, resources, directions)
    )
    output_records = {
        path: {"sha256": digest(data), "bytes": len(data)}
        for path, data in sorted(artifacts.items())
    }
    manifest = {
        "schema": "realm.actor-pose.a6-cargo-payloads-manifest.v1",
        "compiler": "scripts/actor-pose-prototype/a6_cargo_payloads.py",
        "contract": contract["schema"],
        "inputs": files,
        "scope": {
            "resources": resources,
            "directions": directions,
            "framesPerRow": FRAMES,
            "rows": len(rows),
            "frames": len(rows) * FRAMES,
            "ownerRows": [
                "guard/carry",
                "farmer/carry",
                "lumber/carry",
                "builder/carry",
            ],
            "bakedContainer": True,
        },
        "layout": {
            "row": "resource-major then direction",
            "sourceFrame": [FRAME_W, FRAME_H],
        },
        "atlases": atlas_records,
        "outputs": output_records,
    }
    artifacts["manifest.json"] = canonical(manifest)
    return artifacts, manifest


def write_outputs(output_dir: Path, artifacts: dict[str, bytes]) -> None:
    temporary = Path(tempfile.mkdtemp(prefix=".a6-build-", dir=output_dir.parent))
    try:
        for relative, data in artifacts.items():
            target = temporary / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
        if output_dir.exists():
            shutil.rmtree(output_dir)
        temporary.replace(output_dir)
    finally:
        if temporary.exists():
            shutil.rmtree(temporary)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Compile the Realm A6 resource cargo attachment family."
    )
    parser.add_argument("--source-dir", type=Path, default=SOURCE)
    parser.add_argument("--out-dir", type=Path, default=OUT)
    parser.add_argument(
        "--verify",
        action="store_true",
        help="require a byte-identical second in-memory build",
    )
    args = parser.parse_args()
    args.out_dir.parent.mkdir(parents=True, exist_ok=True)
    try:
        contract, board, files = load_inputs(args.source_dir.resolve())
        artifacts, manifest = build(contract, board, files)
        if args.verify:
            second, _ = build(contract, board, files)
            if artifacts != second:
                raise A6Error("A6 build is not byte-identical")
        write_outputs(args.out_dir.resolve(), artifacts)
    except A6Error as error:
        print(f"[a6-cargo-payloads] FAIL: {error}")
        return 1
    print(
        "[a6-cargo-payloads] PASS — "
        f"{manifest['scope']['rows']} rows / {manifest['scope']['frames']} frames / "
        f"{len(manifest['atlases'])} runtime tiers"
    )
    print(f"[a6-cargo-payloads] wrote {args.out_dir.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
