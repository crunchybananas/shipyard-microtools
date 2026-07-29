#!/usr/bin/env python3
"""Shared constants and deterministic I/O for the actor-pose prototype."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
PROTOTYPE_ROOT = ROOT / "assets" / "sprites" / "prototypes" / "actor-pose"
OUTPUT_ROOT = PROTOTYPE_ROOT / "output"
REPORT_ROOT = PROTOTYPE_ROOT / "reports"

FRAME_WIDTH = 64
FRAME_HEIGHT = 84
FRAME_COUNT = 8
ROW_WIDTH = FRAME_WIDTH * FRAME_COUNT

DIRECTIONS = ("down", "up", "left", "right")
TARGETS = (
    ("guard", "walk"),
    ("guard", "carry"),
    ("builder", "walk"),
    ("builder", "work"),
)
EXPECTED_KEYS = tuple(
    f"{role}/{action}/{direction}"
    for role, action in TARGETS
    for direction in DIRECTIONS
)


def row_key(role: str, action: str, direction: str) -> str:
    return f"{role}/{action}/{direction}"


def split_row_key(key: str) -> tuple[str, str, str]:
    parts = key.split("/")
    if len(parts) != 3:
        raise ValueError(f"invalid actor row key: {key!r}")
    role, action, direction = parts
    if key not in EXPECTED_KEYS:
        raise ValueError(f"row is outside the bounded prototype: {key}")
    return role, action, direction


def repository_path(path: Path) -> str:
    resolved = path.resolve()
    try:
        return resolved.relative_to(ROOT.resolve()).as_posix()
    except ValueError:
        return resolved.as_posix()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def sha256_image_pixels(image: Image.Image) -> str:
    rgba = image if image.mode == "RGBA" else image.convert("RGBA")
    return sha256_bytes(rgba.tobytes())


def frame_pixel_hashes(image: Image.Image) -> list[str]:
    rgba = image if image.mode == "RGBA" else image.convert("RGBA")
    return [
        sha256_image_pixels(
            rgba.crop(
                (
                    frame * FRAME_WIDTH,
                    0,
                    (frame + 1) * FRAME_WIDTH,
                    FRAME_HEIGHT,
                )
            )
        )
        for frame in range(FRAME_COUNT)
    ]


def save_rgba_png(image: Image.Image, path: Path) -> None:
    """Write a normalized PNG without timestamps or adaptive optimization."""
    if image.size != (ROW_WIDTH, FRAME_HEIGHT):
        raise ValueError(
            f"{path} must be {ROW_WIDTH}x{FRAME_HEIGHT}; got "
            f"{image.width}x{image.height}"
        )
    rgba = image if image.mode == "RGBA" else image.convert("RGBA")
    path.parent.mkdir(parents=True, exist_ok=True)
    rgba.save(path, format="PNG", optimize=False, compress_level=9)


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, indent=2, sort_keys=True, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def file_hash_map(root: Path) -> dict[str, str]:
    return {
        path.relative_to(root).as_posix(): sha256_file(path)
        for path in sorted(root.rglob("*"))
        if path.is_file()
    }


def tree_hash(files: dict[str, str]) -> str:
    payload = "\n".join(f"{name}\0{digest}" for name, digest in sorted(files.items()))
    return sha256_bytes(payload.encode("utf-8"))
