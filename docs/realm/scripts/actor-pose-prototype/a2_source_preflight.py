#!/usr/bin/env python3
"""Preflight every declared A2 identity/garment source without baking actors.

This is deliberately separate from the frozen right-reference compiler.  It
proves that the future factorial stage has explicit, hash-locked, margin-safe
right-view source parts while reporting that the reviewed reference still uses
its older crop authority.  It cannot write rows, planes, masks, or an atlas.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import shutil
import struct
import sys
from collections import deque
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
PROTO = ROOT / "assets/sprites/prototypes/actor-pose"
CONTRACT = PROTO / "source/a2-layered2d/a2-contract.json"
OUT = PROTO / "output/a2-source-preflight"
REFERENCE_OUT = PROTO / "output/a2-layered2d"
SOURCE_SIZE = (1536, 1024)
ALPHA_THRESHOLD = 24
MIN_FOREGROUND_PIXELS = 256
FORBIDDEN_OUTPUT_PARTS = {"rows", "planes", "id-masks", "atlas", "masks"}
DOMAIN_OWNER = {
    "identities": "identity",
    "garments": "garment",
}
COLORS = (
    "#78b8dd",
    "#d5a252",
    "#7db887",
    "#d27a69",
    "#b28ce2",
)


class PreflightError(RuntimeError):
    """Raised when declared A2 source authority is not trustworthy."""


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def canonical(value: Any) -> bytes:
    return json.dumps(value, indent=2, sort_keys=True).encode() + b"\n"


def png(image: Image.Image) -> bytes:
    output = io.BytesIO()
    image.convert("RGBA").save(
        output,
        "PNG",
        optimize=False,
        compress_level=9,
    )
    return output.getvalue()


def alpha_mask(image: Image.Image) -> Image.Image:
    return image.getchannel("A").point(
        lambda value: 255 if value >= ALPHA_THRESHOLD else 0
    )


def component_areas(mask: Image.Image) -> list[int]:
    width, height = mask.size
    data = mask.tobytes()
    seen = bytearray(width * height)
    areas: list[int] = []
    for start, value in enumerate(data):
        if value == 0 or seen[start]:
            continue
        queue: deque[int] = deque([start])
        seen[start] = 1
        area = 0
        while queue:
            index = queue.popleft()
            area += 1
            x = index % width
            y = index // width
            for neighbor in (
                index - 1 if x else -1,
                index + 1 if x + 1 < width else -1,
                index - width if y else -1,
                index + width if y + 1 < height else -1,
            ):
                if (
                    neighbor >= 0
                    and data[neighbor] != 0
                    and not seen[neighbor]
                ):
                    seen[neighbor] = 1
                    queue.append(neighbor)
        areas.append(area)
    return sorted(areas, reverse=True)


def crop_metrics(
    image: Image.Image,
    raw_box: Any,
    required_margin: int,
) -> tuple[dict[str, Any], list[str]]:
    failures: list[str] = []
    if (
        not isinstance(raw_box, list)
        or len(raw_box) != 4
        or any(type(value) is not int for value in raw_box)
    ):
        return {"box": raw_box}, ["crop must contain four integer coordinates"]
    left, top, right, bottom = raw_box
    width, height = image.size
    if not (0 <= left < right <= width and 0 <= top < bottom <= height):
        return {"box": raw_box}, ["crop is empty or outside its source sheet"]
    crop = image.crop((left, top, right, bottom))
    mask = alpha_mask(crop)
    box = mask.getbbox()
    if box is None:
        return {
            "box": raw_box,
            "size": list(crop.size),
            "foreground_pixels": 0,
        }, ["crop is blank"]

    foreground_pixels = sum(1 for value in mask.getdata() if value)
    areas = component_areas(mask)
    margins = [
        box[0],
        box[1],
        crop.width - box[2],
        crop.height - box[3],
    ]
    if foreground_pixels < MIN_FOREGROUND_PIXELS:
        failures.append(
            f"crop has {foreground_pixels} foreground pixels, "
            f"minimum is {MIN_FOREGROUND_PIXELS}"
        )
    if len(areas) != 1:
        failures.append(
            f"crop has {len(areas)} four-connected components, expected 1"
        )
    if min(margins) < required_margin:
        failures.append(
            f"crop alpha margin {margins} is below {required_margin}px"
        )

    trimmed = crop.crop(box)
    raw_hash = digest(
        struct.pack(">II", trimmed.width, trimmed.height)
        + trimmed.tobytes()
    )
    return {
        "box": raw_box,
        "size": list(crop.size),
        "opaque_bbox_local": list(box),
        "opaque_bbox_global": [
            left + box[0],
            top + box[1],
            left + box[2],
            top + box[3],
        ],
        "foreground_pixels": foreground_pixels,
        "component_areas": areas,
        "alpha_margins": margins,
        "trimmed_size": list(trimmed.size),
        "trimmed_rgba_sha256": raw_hash,
        "passed": not failures,
    }, failures


def boxes_overlap(first: list[int], second: list[int]) -> bool:
    return not (
        first[2] <= second[0]
        or second[2] <= first[0]
        or first[3] <= second[1]
        or second[3] <= first[1]
    )


def generation_pair_metrics(
    transparent: Image.Image,
    keyed: Image.Image,
) -> tuple[dict[str, Any], list[str]]:
    failures: list[str] = []
    if transparent.size != keyed.size:
        failures.append("transparent/keyed dimensions differ")
    transparent_pixels = list(transparent.convert("RGBA").getdata())
    keyed_pixels = list(keyed.convert("RGBA").getdata())
    hidden_rgb_pixels = sum(
        1
        for red, green, blue, alpha in transparent_pixels
        if alpha == 0 and (red or green or blue)
    )
    opaque_rgb_mismatches = sum(
        1
        for transparent_pixel, keyed_pixel in zip(
            transparent_pixels,
            keyed_pixels,
        )
        if (
            transparent_pixel[3] == 255
            and transparent_pixel[:3] != keyed_pixel[:3]
        )
    )
    if hidden_rgb_pixels:
        failures.append(
            f"transparent source retains RGB in {hidden_rgb_pixels} zero-alpha pixels"
        )
    if opaque_rgb_mismatches:
        failures.append(
            f"{opaque_rgb_mismatches} opaque pixels differ from generation source"
        )
    return {
        "dimensions_match": transparent.size == keyed.size,
        "zero_alpha_rgb_pixels": hidden_rgb_pixels,
        "opaque_rgb_mismatches": opaque_rgb_mismatches,
        "passed": not failures,
    }, failures


def checker(size: tuple[int, int], cell: int = 12) -> Image.Image:
    image = Image.new("RGBA", size, "#101b20")
    draw = ImageDraw.Draw(image)
    for y in range(0, size[1], cell):
        for x in range(0, size[0], cell):
            if (x // cell + y // cell) % 2:
                draw.rectangle(
                    (x, y, x + cell - 1, y + cell - 1),
                    fill="#15272e",
                )
    return image


def overlay_proof(
    image: Image.Image,
    parts: dict[str, list[int]],
) -> Image.Image:
    scale = 0.5
    result = checker((768, 512), 8)
    source = image.resize((768, 512), Image.Resampling.LANCZOS)
    result.alpha_composite(source)
    draw = ImageDraw.Draw(result)
    font = ImageFont.load_default()
    for index, (name, box) in enumerate(parts.items()):
        color = COLORS[index % len(COLORS)]
        scaled = tuple(round(value * scale) for value in box)
        draw.rectangle(scaled, outline=color, width=2)
        label_x = scaled[0] + 3
        label_y = max(1, scaled[1] - 12)
        label_box = draw.textbbox((label_x, label_y), name, font=font)
        draw.rectangle(label_box, fill="#081115")
        draw.text((label_x, label_y), name, fill=color, font=font)
    return result


def fit_part(image: Image.Image, box: list[int], size: tuple[int, int]) -> Image.Image:
    crop = image.crop(tuple(box))
    alpha_box = alpha_mask(crop).getbbox()
    if alpha_box is None:
        raise PreflightError("cannot preview a blank source crop")
    crop = crop.crop(alpha_box)
    crop.thumbnail(size, Image.Resampling.LANCZOS)
    return crop


def contact_sheet(
    entries: list[tuple[str, Image.Image, list[int]]],
) -> Image.Image:
    cell_width, cell_height, columns = 196, 214, 5
    rows = (len(entries) + columns - 1) // columns
    result = checker((cell_width * columns, cell_height * rows), 10)
    draw = ImageDraw.Draw(result)
    font = ImageFont.load_default()
    for index, (label, source, box) in enumerate(entries):
        column = index % columns
        row = index // columns
        origin_x = column * cell_width
        origin_y = row * cell_height
        part = fit_part(source, box, (164, 164))
        x = origin_x + (cell_width - part.width) // 2
        y = origin_y + 24 + (164 - part.height) // 2
        result.alpha_composite(part, (x, y))
        draw.text(
            (origin_x + 8, origin_y + 6),
            label,
            fill="#eadfc6",
            font=font,
        )
    return result


def read_hashed_image(record: dict[str, Any]) -> tuple[Image.Image, bytes]:
    path = ROOT / record["path"]
    data = path.read_bytes()
    if digest(data) != record["sha256"]:
        raise PreflightError(f"source hash mismatch: {record['path']}")
    image = Image.open(io.BytesIO(data)).convert("RGBA")
    if image.size != SOURCE_SIZE:
        raise PreflightError(
            f"{record['path']} is {image.size}, expected {SOURCE_SIZE}"
        )
    return image, data


def build(
    contract_path: Path,
) -> tuple[dict[str, bytes], dict[str, Any], dict[str, Any]]:
    contract_bytes = contract_path.read_bytes()
    contract = json.loads(contract_bytes)
    if contract.get("schema") != "realm.actor-pose.a2-layered2d.v2":
        raise PreflightError("A2 contract schema changed")
    preflight = contract["source_preflight"]
    expected_toolchain = {
        "python": f"{sys.version_info.major}.{sys.version_info.minor}",
        "pillow": Image.__version__,
    }
    if preflight.get("toolchain") != expected_toolchain:
        raise PreflightError(
            f"toolchain {expected_toolchain} does not match contract "
            f"{preflight.get('toolchain')}"
        )

    required = {
        "identities": list(preflight["identity_parts"]),
        "garments": list(preflight["garment_parts"]),
    }
    expected_sources = {
        "identities": ["craftsperson", "watchman"],
        "garments": ["ochre-work", "watch-blue"],
    }
    failures: list[str] = []
    source_report: dict[str, Any] = {}
    images: dict[tuple[str, str], Image.Image] = {}
    proof_entries: list[tuple[str, Image.Image, list[int]]] = []
    artifacts: dict[str, bytes] = {}
    source_files: dict[str, dict[str, Any]] = {}

    for domain in ("identities", "garments"):
        owner_name = DOMAIN_OWNER[domain]
        records = contract.get(domain, {})
        if sorted(records) != expected_sources[domain]:
            failures.append(
                f"{domain} set {sorted(records)} != {expected_sources[domain]}"
            )
        source_report[domain] = {}
        for source_name in sorted(records):
            record = records[source_name]
            image, data = read_hashed_image(record)
            generation_image, generation_data = read_hashed_image(
                record["generation_source"]
            )
            images[(domain, source_name)] = image
            source_files[record["path"]] = {
                "sha256": digest(data),
                "bytes": len(data),
                "owner": owner_name,
            }
            generation_record = record["generation_source"]
            source_files[generation_record["path"]] = {
                "sha256": digest(generation_data),
                "bytes": len(generation_data),
                "owner": "generation-provenance",
            }
            pair_metrics, pair_failures = generation_pair_metrics(
                image,
                generation_image,
            )
            for failure in pair_failures:
                failures.append(f"{domain}/{source_name}: {failure}")

            view = preflight["view"]
            parts = record.get("parts", {}).get(view, {})
            if list(parts) != required[domain]:
                failures.append(
                    f"{domain}/{source_name} parts {list(parts)} "
                    f"!= {required[domain]}"
                )
            part_report: dict[str, Any] = {}
            boxes: list[tuple[str, list[int]]] = []
            for part_name, box in parts.items():
                metrics, part_failures = crop_metrics(
                    image,
                    box,
                    preflight["transparent_margin_px"],
                )
                part_report[part_name] = metrics
                boxes.append((part_name, box))
                proof_entries.append(
                    (
                        f"{owner_name}:{source_name}:{part_name}",
                        image,
                        box,
                    )
                )
                for failure in part_failures:
                    failures.append(
                        f"{domain}/{source_name}/{part_name}: {failure}"
                    )
            for index, (first_name, first_box) in enumerate(boxes):
                for second_name, second_box in boxes[index + 1 :]:
                    if boxes_overlap(first_box, second_box):
                        failures.append(
                            f"{domain}/{source_name}: {first_name} and "
                            f"{second_name} crops overlap"
                        )
            source_report[domain][source_name] = {
                "path": record["path"],
                "sha256": record["sha256"],
                "generation_source": {
                    "path": generation_record["path"],
                    "sha256": generation_record["sha256"],
                },
                "size": list(image.size),
                "generation_pair": pair_metrics,
                "parts": part_report,
            }
            proof_path = f"proof/{owner_name}-{source_name}-right-source.png"
            artifacts[proof_path] = png(overlay_proof(image, parts))

    selected = {
        "identity": (
            "identities",
            contract["reference_gate"]["identity"],
        ),
        "garment": (
            "garments",
            contract["reference_gate"]["garment"],
        ),
    }
    reference_audit: dict[str, Any] = {}
    reference_matches = True
    for owner, (domain, source_name) in selected.items():
        image = images[(domain, source_name)]
        current_parts = contract["reference_gate"]["render_parts"][owner]
        safe_parts = contract[domain][source_name]["parts"][preflight["view"]]
        owner_report: dict[str, Any] = {}
        for part_name, current_box in current_parts.items():
            metrics, current_failures = crop_metrics(
                image,
                current_box,
                preflight["transparent_margin_px"],
            )
            matches = current_box == safe_parts[part_name]
            reference_matches = reference_matches and matches
            owner_report[part_name] = {
                **metrics,
                "matches_preflight_box": matches,
                "findings": current_failures,
            }
        reference_audit[owner] = owner_report

    review_path = ROOT / contract["review_record"]
    review_bytes = review_path.read_bytes()
    review = json.loads(review_bytes)
    source_files[contract["review_record"]] = {
        "sha256": digest(review_bytes),
        "bytes": len(review_bytes),
        "owner": "human-review-authority",
    }
    frozen_reference: dict[str, Any] = {}
    for name, record in (
        ("flattened_row", review["subject"]["flattened_row"]),
        ("native_1x_loop", review["subject"]["native_1x_loop"]),
    ):
        path = REFERENCE_OUT / record["path"]
        data = path.read_bytes()
        actual = digest(data)
        if actual != record["sha256"]:
            failures.append(f"frozen reference {name} hash changed")
        relative = path.relative_to(ROOT).as_posix()
        source_files[relative] = {
            "sha256": actual,
            "bytes": len(data),
            "owner": "frozen-reviewed-output",
        }
        frozen_reference[name] = {
            "path": record["path"],
            "expected_sha256": record["sha256"],
            "actual_sha256": actual,
            "passed": actual == record["sha256"],
        }

    artifacts["proof/right-source-parts.png"] = png(contact_sheet(proof_entries))
    promotion_blockers = [
        "reference-render-crops-not-cut-over",
        "left-down-up-view-parts-not-authored",
        "sword-and-pouch-sources-not-authored",
        "factorial-compiler-not-built",
    ]
    report = {
        "schema": "realm.actor-pose.a2-source-preflight-report.v1",
        "stage": "source-readiness-before-owner-gate",
        "view": preflight["view"],
        "alpha_threshold": ALPHA_THRESHOLD,
        "minimum_foreground_pixels": MIN_FOREGROUND_PIXELS,
        "transparent_margin_px": preflight["transparent_margin_px"],
        "declared_sources": source_report,
        "frozen_reference": frozen_reference,
        "reference_render_parts": {
            "matches_preflight": reference_matches,
            "audit": reference_audit,
        },
        "source_preflight_passed": not failures,
        "factorial_ready": False,
        "generated_actor_rows": 0,
        "promotion_blockers": promotion_blockers,
        "status": (
            "source-parts-ready-reference-cutover-pending"
            if not failures
            else "source-preflight-failed"
        ),
        "failures": failures,
    }
    artifacts["reports/crops.json"] = canonical(report)

    for path, owner in (
        (contract_path, "source-contract"),
        (Path(__file__), "preflight-implementation"),
        (
            PROTO / "references/a2-source/README.md",
            "source-provenance",
        ),
    ):
        data = path.read_bytes()
        source_files[path.relative_to(ROOT).as_posix()] = {
            "sha256": digest(data),
            "bytes": len(data),
            "owner": owner,
        }

    for path in artifacts:
        if set(Path(path).parts) & FORBIDDEN_OUTPUT_PARTS:
            raise PreflightError(f"preflight attempted forbidden output {path}")
    if failures:
        raise PreflightError("; ".join(failures))

    manifest = {
        "schema": "realm.actor-pose.a2-source-preflight-manifest.v1",
        "candidate": "a2-layered2d",
        "status": report["status"],
        "scope": {
            "identities": sorted(contract["identities"]),
            "garments": sorted(contract["garments"]),
            "views": [preflight["view"]],
            "generated_actor_rows": 0,
            "runtime": "none; source-readiness evidence only",
        },
        "sources": {
            "files": {
                path: record
                for path, record in sorted(source_files.items())
            },
            "source_hash": digest(
                "\n".join(
                    f"{path}\0{record['sha256']}"
                    for path, record in sorted(source_files.items())
                ).encode()
            ),
            "network_required": False,
            "generation_sources_are_provenance_only": True,
        },
        "outputs": {
            path: {
                "sha256": digest(data),
                "bytes": len(data),
            }
            for path, data in sorted(artifacts.items())
        },
        "report": "reports/crops.json",
        "verification": {
            "source_preflight_passed": True,
            "factorial_ready": False,
            "reference_cutover_required": not reference_matches,
            "generated_actor_rows": 0,
            "byte_deterministic_second_pass": False,
            "failures": [],
        },
        "toolchain": expected_toolchain,
    }
    return artifacts, manifest, report


def write_output(
    output_dir: Path,
    artifacts: dict[str, bytes],
    manifest: dict[str, Any],
) -> None:
    if output_dir.exists():
        shutil.rmtree(output_dir)
    for relative, data in artifacts.items():
        target = output_dir / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    (output_dir / "manifest.json").write_bytes(canonical(manifest))


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Preflight all declared A2 source parts without actor output."
    )
    parser.add_argument("--contract", type=Path, default=CONTRACT)
    parser.add_argument("--out-dir", type=Path, default=OUT)
    parser.add_argument(
        "--verify",
        action="store_true",
        help="Require a byte-identical second in-memory build.",
    )
    args = parser.parse_args()
    try:
        artifacts, manifest, report = build(args.contract.resolve())
        second = build(args.contract.resolve()) if args.verify else None
        deterministic = bool(
            second
            and artifacts == second[0]
            and canonical(report) == canonical(second[2])
        )
        if args.verify and not deterministic:
            raise PreflightError("second in-memory preflight differed")
        manifest["verification"]["byte_deterministic_second_pass"] = deterministic
        write_output(args.out_dir.resolve(), artifacts, manifest)
        print(
            "A2 source preflight OK: 4 hash-locked sheets / 18 margin-safe "
            "right-view parts / 0 actor rows; factorial cutover remains vetoed"
        )
        print(f"output: {args.out_dir.resolve()}")
        return 0
    except (
        KeyError,
        OSError,
        PreflightError,
        TypeError,
        ValueError,
        json.JSONDecodeError,
    ) as error:
        print(f"FAIL: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
