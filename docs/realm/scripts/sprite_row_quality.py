#!/usr/bin/env python3
"""Analyze one exact Realm actor animation row.

The analyzer treats the dense actor body separately from thin tools and loose
particles. This makes body-scale and anchor warnings useful for work rows where
the tool is expected to travel farther than the NPC.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import statistics
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw


FRAME_W = 64
FRAME_H = 84
FRAMES = 8
ACTIONS = ("idle", "walk", "work", "carry")
ALPHA_CUTOFF = 18

# Style-era classifier thresholds. Keep in sync with the ERA constants in
# scripts/audit-sprite-frames.mjs; both were calibrated 2026-07-01 against
# visually confirmed rows (blocky: colorCount 80-160, shadingRatio 0.19-0.23;
# painted: colorCount 315-706, shadingRatio 0.61-0.67). The painted era is the
# art direction, so any non-painted row earns a `legacy-blocky-style` warning
# and can only be accepted as an explicit waiver.
ERA_COLOR_COUNT_PAINTED = 250
ERA_COLOR_COUNT_BLOCKY = 180
ERA_SHADING_PAINTED = 0.45
ERA_SHADING_BLOCKY = 0.30
SHADING_DELTA_MIN = 12
SHADING_DELTA_MAX = 96


def components(mask: list[list[int]]) -> list[list[tuple[int, int]]]:
    height = len(mask)
    width = len(mask[0]) if height else 0
    seen = [[False] * width for _ in range(height)]
    found: list[list[tuple[int, int]]] = []
    for y in range(height):
        for x in range(width):
            if not mask[y][x] or seen[y][x]:
                continue
            seen[y][x] = True
            queue = deque([(x, y)])
            points: list[tuple[int, int]] = []
            while queue:
                px, py = queue.popleft()
                points.append((px, py))
                for nx, ny in ((px - 1, py), (px + 1, py), (px, py - 1), (px, py + 1)):
                    if 0 <= nx < width and 0 <= ny < height and mask[ny][nx] and not seen[ny][nx]:
                        seen[ny][nx] = True
                        queue.append((nx, ny))
            found.append(points)
    return sorted(found, key=len, reverse=True)


def erode(mask: list[list[int]], iterations: int = 2) -> list[list[int]]:
    height = len(mask)
    width = len(mask[0]) if height else 0
    current = mask
    for _ in range(iterations):
        next_mask = [[0] * width for _ in range(height)]
        for y in range(1, height - 1):
            for x in range(1, width - 1):
                if all(current[ny][nx] for ny in range(y - 1, y + 2) for nx in range(x - 1, x + 2)):
                    next_mask[y][x] = 1
        current = next_mask
    return current


def bounds(points: list[tuple[int, int]], pad: int = 0) -> dict[str, float]:
    if not points:
        return {"minX": 0, "minY": 0, "maxX": 0, "maxY": 0, "w": 0, "h": 0, "cx": 0, "cy": 0}
    min_x = max(0, min(x for x, _ in points) - pad)
    min_y = max(0, min(y for _, y in points) - pad)
    max_x = min(FRAME_W - 1, max(x for x, _ in points) + pad)
    max_y = min(FRAME_H - 1, max(y for _, y in points) + pad)
    return {
        "minX": min_x,
        "minY": min_y,
        "maxX": max_x,
        "maxY": max_y,
        "w": max_x - min_x + 1,
        "h": max_y - min_y + 1,
        "cx": round(sum(x for x, _ in points) / len(points), 2),
        "cy": round(sum(y for _, y in points) / len(points), 2),
    }


def analyze_frame(frame: Image.Image) -> dict:
    rgba = frame.convert("RGBA")
    pixels = rgba.load()
    mask = [[0] * FRAME_W for _ in range(FRAME_H)]
    points: list[tuple[int, int]] = []
    edge_pixels = 0
    rgb_sum = [0.0, 0.0, 0.0]
    alpha_sum = 0.0
    quantized_colors: set[int] = set()

    for y in range(FRAME_H):
        for x in range(FRAME_W):
            r, g, b, a = pixels[x, y]
            if a <= ALPHA_CUTOFF:
                continue
            mask[y][x] = 1
            points.append((x, y))
            weight = a / 255
            rgb_sum[0] += r * weight
            rgb_sum[1] += g * weight
            rgb_sum[2] += b * weight
            alpha_sum += weight
            quantized_colors.add(((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3))
            if x <= 1 or x >= FRAME_W - 2 or y <= 1 or y >= FRAME_H - 2:
                edge_pixels += 1

    # Shading ratio: fraction of adjacent opaque pixel pairs whose color delta
    # sits in the continuous-shading band. Flat blocky fills score near zero.
    pair_total = 0
    pair_shaded = 0
    for x, y in points:
        r, g, b, _ = pixels[x, y]
        for nx, ny in ((x + 1, y), (x, y + 1)):
            if nx >= FRAME_W or ny >= FRAME_H or not mask[ny][nx]:
                continue
            nr, ng, nb, _ = pixels[nx, ny]
            delta = abs(r - nr) + abs(g - ng) + abs(b - nb)
            pair_total += 1
            if SHADING_DELTA_MIN <= delta <= SHADING_DELTA_MAX:
                pair_shaded += 1

    opaque_components = components(mask)
    fragment_components = opaque_components[1:] if opaque_components else []
    opened_components = components(erode(mask))
    body_points = opened_components[0] if opened_components else (opaque_components[0] if opaque_components else [])
    full = bounds(points)
    body = bounds(body_points, pad=2)
    mean_color = [round(value / max(1, alpha_sum), 1) for value in rgb_sum]

    return {
        "pixels": len(points),
        "edgePixels": edge_pixels,
        "fragmentPixels": sum(len(item) for item in fragment_components),
        "fragmentCount": sum(1 for item in fragment_components if len(item) >= 4),
        "bounds": full,
        "body": body,
        "meanColor": mean_color,
        "colorCount": len(quantized_colors),
        "shadingRatio": round(pair_shaded / pair_total, 4) if pair_total else 0.0,
        "sha256": hashlib.sha256(rgba.tobytes()).hexdigest(),
        "_mask": mask,
    }


def max_adjacent(values: list[float]) -> float:
    return max((abs(values[index] - values[index - 1]) for index in range(1, len(values))), default=0)


def max_point_jump(frames: list[dict], key: str) -> float:
    jumps = []
    for index in range(1, len(frames)):
        left = frames[index - 1][key]
        right = frames[index][key]
        if not left["w"] or not right["w"]:
            continue
        jumps.append(math.hypot(left["cx"] - right["cx"], left["cy"] - right["cy"]))
    return max(jumps, default=0)


def palette_drift(frames: list[dict]) -> float:
    drift = []
    for index in range(1, len(frames)):
        left = frames[index - 1]["meanColor"]
        right = frames[index]["meanColor"]
        drift.append(math.sqrt(sum((left[channel] - right[channel]) ** 2 for channel in range(3))))
    return max(drift, default=0)


def aligned_alpha_delta(left: dict, right: dict) -> float:
    if not left["body"]["w"] or not right["body"]["w"]:
        return 1.0
    dx = round(left["body"]["cx"] - right["body"]["cx"])
    dy = round(left["body"]["cy"] - right["body"]["cy"])
    intersection = 0
    union = 0
    left_mask = left["_mask"]
    right_mask = right["_mask"]
    for y in range(FRAME_H):
        for x in range(FRAME_W):
            a = left_mask[y][x]
            rx = x - dx
            ry = y - dy
            b = right_mask[ry][rx] if 0 <= rx < FRAME_W and 0 <= ry < FRAME_H else 0
            if a or b:
                union += 1
                if a and b:
                    intersection += 1
    return round(1 - intersection / max(1, union), 4)


def analyze_row(path: Path, action: str) -> dict:
    image = Image.open(path).convert("RGBA")
    if image.size != (FRAME_W * FRAMES, FRAME_H):
        return {
            "path": str(path),
            "dimensions": list(image.size),
            "errors": [f"row must be {FRAME_W * FRAMES}x{FRAME_H}"],
            "warnings": [],
            "frames": [],
        }

    frames = [
        analyze_frame(image.crop((index * FRAME_W, 0, (index + 1) * FRAME_W, FRAME_H)))
        for index in range(FRAMES)
    ]
    populated = [frame for frame in frames if frame["pixels"]]
    body_heights = [frame["body"]["h"] for frame in populated]
    body_widths = [frame["body"]["w"] for frame in populated]
    body_bottoms = [frame["body"]["maxY"] for frame in populated]
    alpha_counts = [frame["pixels"] for frame in populated]
    alpha_deltas = [aligned_alpha_delta(frames[index - 1], frames[index]) for index in range(1, len(frames))]

    summary = {
        "path": str(path),
        "dimensions": list(image.size),
        "rowSha256": hashlib.sha256(image.tobytes()).hexdigest(),
        "blankCount": FRAMES - len(populated),
        "bodyHeightRange": max(body_heights, default=0) - min(body_heights, default=0),
        "bodyWidthRange": max(body_widths, default=0) - min(body_widths, default=0),
        "bodyBottomRange": max(body_bottoms, default=0) - min(body_bottoms, default=0),
        "medianBodyHeight": round(statistics.median(body_heights), 2) if body_heights else 0,
        "medianBodyWidth": round(statistics.median(body_widths), 2) if body_widths else 0,
        "medianColor": [
            round(statistics.median(frame["meanColor"][channel] for frame in populated), 2)
            for channel in range(3)
        ] if populated else [0, 0, 0],
        "medianColorCount": round(statistics.median(frame["colorCount"] for frame in populated), 1) if populated else 0,
        "medianShadingRatio": round(statistics.median(frame["shadingRatio"] for frame in populated), 4) if populated else 0.0,
        "maxBodyCenterJump": round(max_point_jump(frames, "body"), 2),
        "maxFullCenterJump": round(max_point_jump(frames, "bounds"), 2),
        "maxAlphaRatio": round(max(alpha_counts, default=1) / max(1, min(alpha_counts, default=1)), 3),
        "maxPaletteDrift": round(palette_drift(frames), 2),
        "maxAlignedAlphaDelta": round(max(alpha_deltas, default=0), 4),
        "maxEdgePixels": max((frame["edgePixels"] for frame in frames), default=0),
        "maxFragmentPixels": max((frame["fragmentPixels"] for frame in frames), default=0),
        "maxFragmentCount": max((frame["fragmentCount"] for frame in frames), default=0),
        "duplicateFrameCount": FRAMES - len({frame["sha256"] for frame in frames}),
        "errors": [],
        "warnings": [],
        "frames": [],
    }

    if summary["blankCount"]:
        summary["errors"].append("blank-frame")
    body_height_limit = 10 if action == "work" else 8
    body_width_limit = 16 if action == "work" else 12
    if summary["bodyHeightRange"] > body_height_limit:
        summary["warnings"].append("body-height-drift")
    if summary["bodyWidthRange"] > body_width_limit:
        summary["warnings"].append("body-width-drift")
    if summary["bodyBottomRange"] > 5:
        summary["warnings"].append("ground-anchor-drift")
    if summary["maxBodyCenterJump"] > 9:
        summary["warnings"].append("body-center-jump")
    if summary["maxAlphaRatio"] > 1.85:
        summary["warnings"].append("alpha-mass-flicker")
    if summary["maxPaletteDrift"] > 42:
        summary["warnings"].append("palette-flicker")
    if summary["maxFragmentPixels"] > 160 or summary["maxFragmentCount"] > 8:
        summary["warnings"].append("loose-fragments")
    if summary["maxEdgePixels"] > 48:
        summary["warnings"].append("edge-contact")
    if summary["duplicateFrameCount"] >= 4 and action in ("walk", "work"):
        summary["warnings"].append("low-frame-variety")

    painted_votes = int(summary["medianColorCount"] >= ERA_COLOR_COUNT_PAINTED) + int(
        summary["medianShadingRatio"] >= ERA_SHADING_PAINTED
    )
    blocky_votes = int(summary["medianColorCount"] <= ERA_COLOR_COUNT_BLOCKY) + int(
        summary["medianShadingRatio"] <= ERA_SHADING_BLOCKY
    )
    if painted_votes >= 1 and not blocky_votes:
        summary["styleEra"] = "painted"
    elif blocky_votes >= 1 and not painted_votes:
        summary["styleEra"] = "blocky"
    else:
        summary["styleEra"] = "ambiguous"
    if populated and summary["styleEra"] != "painted":
        summary["warnings"].append("legacy-blocky-style")

    summary["flickerScore"] = round(
        summary["bodyHeightRange"] * 2.0
        + summary["bodyWidthRange"] * 1.2
        + summary["bodyBottomRange"] * 2.0
        + max(0, summary["maxBodyCenterJump"] - 4) * 3.0
        + max(0, summary["maxAlphaRatio"] - 1.25) * 35
        + max(0, summary["maxPaletteDrift"] - 20) * 0.8
        + max(0, summary["maxFragmentPixels"] - 60) * 0.08,
        1,
    )

    for frame in frames:
        clean = {key: value for key, value in frame.items() if not key.startswith("_")}
        summary["frames"].append(clean)
    return summary


def write_proof(path: Path, out: Path, report: dict) -> None:
    image = Image.open(path).convert("RGBA")
    scale = 4
    label_h = 38
    proof = Image.new("RGBA", (image.width * scale, image.height * scale + label_h), (15, 20, 24, 255))
    draw = ImageDraw.Draw(proof)
    warnings = ", ".join(report.get("warnings", [])) or "no warnings"
    draw.text((8, 6), f"flicker {report.get('flickerScore', 0)} | {warnings}", fill=(232, 237, 240, 255))
    proof.alpha_composite(image.resize((image.width * scale, image.height * scale), Image.Resampling.NEAREST), (0, label_h))
    for index in range(FRAMES + 1):
        x = index * FRAME_W * scale
        draw.line((x, label_h, x, proof.height), fill=(245, 200, 76, 160))
    out.parent.mkdir(parents=True, exist_ok=True)
    proof.save(out)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--action", required=True, choices=ACTIONS)
    parser.add_argument("--json", type=Path)
    parser.add_argument("--proof", type=Path)
    args = parser.parse_args()

    report = analyze_row(args.input, args.action)
    if args.json:
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(json.dumps(report, indent=2) + "\n")
    if args.proof and not report["errors"]:
        write_proof(args.input, args.proof, report)
    print(json.dumps(report, indent=2))
    raise SystemExit(1 if report["errors"] else 0)


if __name__ == "__main__":
    main()
