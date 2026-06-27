#!/usr/bin/env python3
"""Pack a generated chroma-key sprite strip into exact Realm actor cells.

The imagegen workflow often returns a wide strip with frames placed on a flat
key background, but not on exact 64x84 cell boundaries. This script segments
the largest foreground components, removes/despills the key color, and packs
each component into a fixed cell with a shared scale.
"""

from __future__ import annotations

import argparse
import math
import statistics
from collections import deque
from pathlib import Path

from PIL import Image


def dist(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    return math.sqrt(sum((a[i] - b[i]) ** 2 for i in range(3)))


def parse_color(value: str) -> tuple[int, int, int]:
    value = value.strip()
    if value.startswith("#"):
        value = value[1:]
    if len(value) != 6:
        raise argparse.ArgumentTypeError("color must be #rrggbb")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


def segment_components(img: Image.Image, key: tuple[int, int, int], threshold: int, min_pixels: int):
    w, h = img.size
    pix = img.load()
    mask = bytearray(w * h)
    for y in range(h):
        for x in range(w):
            r, g, b, a = pix[x, y]
            if a > 20 and dist((r, g, b), key) > threshold:
                mask[y * w + x] = 1

    visited = bytearray(w * h)
    components = []
    for start, value in enumerate(mask):
        if not value or visited[start]:
            continue
        queue = deque([start])
        visited[start] = 1
        min_x = w
        min_y = h
        max_x = 0
        max_y = 0
        count = 0
        while queue:
            idx = queue.popleft()
            count += 1
            x = idx % w
            y = idx // w
            min_x = min(min_x, x)
            max_x = max(max_x, x)
            min_y = min(min_y, y)
            max_y = max(max_y, y)
            for nxt in (
                idx - 1 if x > 0 else -1,
                idx + 1 if x < w - 1 else -1,
                idx - w if y > 0 else -1,
                idx + w if y < h - 1 else -1,
            ):
                if nxt >= 0 and mask[nxt] and not visited[nxt]:
                    visited[nxt] = 1
                    queue.append(nxt)
        if count >= min_pixels:
            components.append((count, min_x, min_y, max_x, max_y))
    return components


def chroma_to_alpha(img: Image.Image, key: tuple[int, int, int], transparent: int, soft: int) -> Image.Image:
    out = img.convert("RGBA")
    pix = out.load()
    w, h = out.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pix[x, y]
            d = dist((r, g, b), key)
            if d < transparent:
                pix[x, y] = (r, g, b, 0)
                continue
            if d < soft:
                alpha = int(a * (d - transparent) / max(1, soft - transparent))
            else:
                alpha = a

            is_neon_magenta = r > 145 and b > 145 and g < 120
            is_neon_green = g > 135 and r < 125 and b < 135
            is_neon_yellow = r > 165 and g > 115 and b < 95 and alpha < 190
            if is_neon_magenta or is_neon_green or is_neon_yellow:
                pix[x, y] = (r, g, b, 0)
                continue

            if r > g + 70 and b > g + 70:
                clamp = max(g + 55, 0)
                r = min(r, clamp)
                b = min(b, clamp)
            if alpha < 155 and max(r, g, b) - min(r, g, b) > 70:
                neutral = int((r + g + b) / 3)
                r = g = b = neutral
            if alpha < 90:
                alpha = 0
            pix[x, y] = (r, g, b, alpha)
    return out


def clean_alpha(img: Image.Image, min_keep: int, alpha_cutoff: int) -> Image.Image:
    out = img.convert("RGBA")
    pix = out.load()
    w, h = out.size
    opaque = bytearray(w * h)
    for y in range(h):
        for x in range(w):
            r, g, b, a = pix[x, y]
            if a < alpha_cutoff:
                pix[x, y] = (r, g, b, 0)
                continue
            if pix[x, y][3] > 0:
                opaque[y * w + x] = 1

    visited = bytearray(w * h)
    components: list[list[int]] = []
    for start, value in enumerate(opaque):
        if not value or visited[start]:
            continue
        queue = deque([start])
        visited[start] = 1
        component = []
        while queue:
            idx = queue.popleft()
            component.append(idx)
            x = idx % w
            y = idx // w
            for nxt in (
                idx - 1 if x > 0 else -1,
                idx + 1 if x < w - 1 else -1,
                idx - w if y > 0 else -1,
                idx + w if y < h - 1 else -1,
            ):
                if nxt >= 0 and opaque[nxt] and not visited[nxt]:
                    visited[nxt] = 1
                    queue.append(nxt)
        components.append(component)

    if not components:
        return out
    components.sort(key=len, reverse=True)
    largest = len(components[0])
    for component in components[1:]:
        if len(component) >= min_keep or len(component) >= largest * 0.08:
            continue
        for idx in component:
            x = idx % w
            y = idx // w
            r, g, b, _ = pix[x, y]
            pix[x, y] = (r, g, b, 0)
    return out


def alpha_bounds(img: Image.Image, cutoff: int = 18):
    pix = img.load()
    points = []
    for y in range(img.height):
        for x in range(img.width):
            if pix[x, y][3] > cutoff:
                points.append((x, y))
    if not points:
        return None
    min_x = min(x for x, _ in points)
    min_y = min(y for _, y in points)
    max_x = max(x for x, _ in points)
    max_y = max(y for _, y in points)
    return {
        "minX": min_x,
        "minY": min_y,
        "maxX": max_x,
        "maxY": max_y,
        "w": max_x - min_x + 1,
        "h": max_y - min_y + 1,
    }


def dense_body_bounds(img: Image.Image, cutoff: int = 18, iterations: int = 2):
    width, height = img.size
    pix = img.load()
    mask = [[1 if pix[x, y][3] > cutoff else 0 for x in range(width)] for y in range(height)]
    for _ in range(iterations):
        next_mask = [[0] * width for _ in range(height)]
        for y in range(1, height - 1):
            for x in range(1, width - 1):
                if all(mask[ny][nx] for ny in range(y - 1, y + 2) for nx in range(x - 1, x + 2)):
                    next_mask[y][x] = 1
        mask = next_mask

    visited = [[False] * width for _ in range(height)]
    groups = []
    for y in range(height):
        for x in range(width):
            if not mask[y][x] or visited[y][x]:
                continue
            queue = deque([(x, y)])
            visited[y][x] = True
            points = []
            while queue:
                px, py = queue.popleft()
                points.append((px, py))
                for nx, ny in ((px - 1, py), (px + 1, py), (px, py - 1), (px, py + 1)):
                    if 0 <= nx < width and 0 <= ny < height and mask[ny][nx] and not visited[ny][nx]:
                        visited[ny][nx] = True
                        queue.append((nx, ny))
            groups.append(points)
    if not groups:
        return alpha_bounds(img, cutoff)
    points = max(groups, key=len)
    pad = 2
    min_x = max(0, min(x for x, _ in points) - pad)
    min_y = max(0, min(y for _, y in points) - pad)
    max_x = min(width - 1, max(x for x, _ in points) + pad)
    max_y = min(height - 1, max(y for _, y in points) + pad)
    return {
        "minX": min_x,
        "minY": min_y,
        "maxX": max_x,
        "maxY": max_y,
        "w": max_x - min_x + 1,
        "h": max_y - min_y + 1,
        "cx": (min_x + max_x) / 2,
    }


def normalize_body_heights(
    cells: list[Image.Image],
    max_adjust: float,
    target_height: float | None = None,
) -> tuple[list[Image.Image], list[int], list[int]]:
    body_boxes = [dense_body_bounds(cell) for cell in cells]
    heights = [box["h"] for box in body_boxes if box]
    if not heights:
        return cells, [], []
    target = target_height if target_height is not None else statistics.median(heights)
    normalized = []
    after_heights = []

    for cell, body in zip(cells, body_boxes):
        full = alpha_bounds(cell)
        if not body or not full:
            normalized.append(cell)
            after_heights.append(0)
            continue
        desired = target / max(1, body["h"])
        factor = max(1 - max_adjust, min(1 + max_adjust, desired))
        if abs(factor - 1) < 0.015:
            normalized.append(cell)
            after_heights.append(body["h"])
            continue

        crop = cell.crop((full["minX"], full["minY"], full["maxX"] + 1, full["maxY"] + 1))
        scaled = crop.resize(
            (max(1, round(crop.width * factor)), max(1, round(crop.height * factor))),
            Image.Resampling.LANCZOS,
        )
        body_rel_cx = (body["cx"] - full["minX"]) * factor
        body_rel_bottom = (body["maxY"] - full["minY"]) * factor
        paste_x = round(body["cx"] - body_rel_cx)
        paste_y = round(body["maxY"] - body_rel_bottom)
        out = Image.new("RGBA", cell.size, (0, 0, 0, 0))
        out.alpha_composite(scaled, (paste_x, paste_y))
        normalized.append(out)
        after = dense_body_bounds(out)
        after_heights.append(after["h"] if after else 0)
    return normalized, heights, after_heights


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--out-dir", required=True, type=Path)
    parser.add_argument("--name", default="row")
    parser.add_argument("--key", default="#ff00ff", type=parse_color)
    parser.add_argument("--frames", default=8, type=int)
    parser.add_argument("--cell-w", default=64, type=int)
    parser.add_argument("--cell-h", default=84, type=int)
    parser.add_argument("--max-w", default=58, type=int)
    parser.add_argument("--max-h", default=78, type=int)
    parser.add_argument("--pad", default=10, type=int)
    parser.add_argument("--bottom-pad", default=2, type=int)
    parser.add_argument("--threshold", default=105, type=int)
    parser.add_argument("--transparent", default=115, type=int)
    parser.add_argument("--soft", default=175, type=int)
    parser.add_argument("--min-pixels", default=500, type=int)
    parser.add_argument("--min-fragment-keep", default=8, type=int)
    parser.add_argument("--alpha-cutoff", default=90, type=int)
    parser.add_argument("--normalize-body-height", action="store_true")
    parser.add_argument("--max-body-adjust", default=0.12, type=float)
    parser.add_argument("--target-body-height", type=float)
    args = parser.parse_args()

    args.out_dir.mkdir(parents=True, exist_ok=True)
    img = Image.open(args.input).convert("RGBA")
    components = segment_components(img, args.key, args.threshold, args.min_pixels)
    if len(components) < args.frames:
        raise SystemExit(f"found {len(components)} components, need {args.frames}")
    components = sorted(components, reverse=True)[: args.frames]
    components = sorted(components, key=lambda c: (c[1] + c[3]) / 2)

    max_component_w = max(c[3] - c[1] + 1 for c in components)
    max_component_h = max(c[4] - c[2] + 1 for c in components)
    scale = min(args.max_w / max_component_w, args.max_h / max_component_h)

    cells = []
    for i, component in enumerate(components):
        _, min_x, min_y, max_x, max_y = component
        box = (
            max(0, min_x - args.pad),
            max(0, min_y - args.pad),
            min(img.width, max_x + args.pad + 1),
            min(img.height, max_y + args.pad + 1),
        )
        crop = chroma_to_alpha(img.crop(box), args.key, args.transparent, args.soft)
        crop_w = max(1, round(crop.width * scale))
        crop_h = max(1, round(crop.height * scale))
        small = crop.resize((crop_w, crop_h), Image.Resampling.LANCZOS)
        cell = Image.new("RGBA", (args.cell_w, args.cell_h), (0, 0, 0, 0))
        cell.alpha_composite(small, ((args.cell_w - crop_w) // 2, args.cell_h - crop_h - args.bottom_pad))
        cell = clean_alpha(cell, args.min_fragment_keep, args.alpha_cutoff)
        cells.append(cell)

    before_body_heights = []
    after_body_heights = []
    if args.normalize_body_height:
        cells, before_body_heights, after_body_heights = normalize_body_heights(
            cells,
            args.max_body_adjust,
            args.target_body_height,
        )
        cells = [clean_alpha(cell, args.min_fragment_keep, args.alpha_cutoff) for cell in cells]

    for i, cell in enumerate(cells):
        cell.save(args.out_dir / f"{args.name}-frame_{i:02d}.png")

    row = Image.new("RGBA", (args.cell_w * args.frames, args.cell_h), (0, 0, 0, 0))
    for i, cell in enumerate(cells):
        row.alpha_composite(cell, (args.cell_w * i, 0))
    row.save(args.out_dir / f"{args.name}.png")
    row.resize((args.cell_w * args.frames * 4, args.cell_h * 4), Image.Resampling.NEAREST).save(
        args.out_dir / f"{args.name}-x4.png"
    )

    print(
        f"[pack-strip] {args.name}: components={len(components)} "
        f"max={max_component_w}x{max_component_h} scale={scale:.3f}"
    )
    if before_body_heights:
        print(
            f"[pack-strip] body heights {before_body_heights} -> {after_body_heights} "
            f"(max adjust {args.max_body_adjust:.2f})"
        )
    print(f"[pack-strip] wrote {args.out_dir / f'{args.name}.png'}")


if __name__ == "__main__":
    main()
