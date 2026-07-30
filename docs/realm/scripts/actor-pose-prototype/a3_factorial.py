#!/usr/bin/env python3
"""Prove interchangeable painted identity and garment sources for Realm actors.

This remains an offline compiler. It combines two independently painted
identities with two independently painted garment kits, drives every
combination from the same authored eight-beat right-facing carry skeleton, and
bakes ordinary 512x84 rows. The live game still consumes flattened raster
atlases; no skeletal runtime is introduced.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import shutil
import statistics
import sys
import tempfile
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from a2_layered2d import (  # noqa: E402
    A2Error,
    BEATS,
    GROUND_Y,
    H,
    ROW_W,
    SEMANTIC_COLORS,
    W,
    blank,
    canonical,
    compose_frame,
    digest,
    direct_piece,
    exact_color_count,
    has_color_block,
    png,
    semantic_plane,
    source_parts,
    strip,
    validate,
)
from sprite_row_quality import analyze_row, write_proof  # noqa: E402


PROTO = ROOT / "assets/sprites/prototypes/actor-pose"
SOURCE = PROTO / "source/a2-layered2d"
RENDER_PROFILES = PROTO / "source/a3-interchange/render-profiles.json"
ATTACHMENT_CONTRACT = PROTO / "source/a3-interchange/attachments.json"
A2_OUT = PROTO / "output/a2-layered2d"
OUT = PROTO / "output/a3-interchange"
ACTION = "carry"
DIRECTION = "right"
ATTACHMENTS = ("off", "cargo-crate")
RUNTIME_SIZE = (35, 46)
RUNTIME_TIERS = (
    ("native", 27, 35),
    ("default", 35, 46),
    ("double", 54, 70),
    ("review", 64, 84),
)
RUNTIME_STYLE = {
    "name": "classic-strategy-clusters",
    "palette_colors": 48,
    "palette_scope": "all factorial rows",
    "alpha_threshold": 61,
    "contrast": 1.08,
    "saturation": 1.12,
    "dither": "none",
}
ATTACHMENT_SEMANTIC_COLOR = (244, 190, 55, 255)


def file_sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def alpha_bbox(image: Image.Image, threshold: int = 18) -> tuple[int, int, int, int] | None:
    return image.getchannel("A").point(
        lambda value: 255 if value >= threshold else 0
    ).getbbox()


def sanitize_transparent_rgb(image: Image.Image) -> Image.Image:
    """Discard invisible chroma before native-size proof downsampling."""

    rgba = image.convert("RGBA")
    rgba.putdata(
        [
            pixel if pixel[3] else (0, 0, 0, 0)
            for pixel in rgba.getdata()
        ]
    )
    return rgba


def downsample_frame(
    frame: Image.Image,
    size: tuple[int, int],
) -> Image.Image:
    source = sanitize_transparent_rgb(frame)
    if size == (W, H):
        return source
    result = source.resize(size, Image.Resampling.BOX)
    return result.filter(
        ImageFilter.UnsharpMask(radius=0.7, percent=80, threshold=5)
    )


def runtime_frame(frame: Image.Image) -> Image.Image:
    return downsample_frame(frame, RUNTIME_SIZE)


def runtime_row(
    frames: list[Image.Image],
    frame_size: tuple[int, int],
) -> Image.Image:
    """Compile a tier row without allowing pixels to cross frame seams."""

    row = Image.new(
        "RGBA",
        (frame_size[0] * BEATS, frame_size[1]),
        (0, 0, 0, 0),
    )
    for index, frame in enumerate(frames):
        row.alpha_composite(
            downsample_frame(frame, frame_size),
            (index * frame_size[0], 0),
        )
    return row


def tone_runtime_rgb(image: Image.Image) -> Image.Image:
    """Apply one fixed tone curve before palette mapping."""

    rgb = ImageEnhance.Color(image.convert("RGB")).enhance(
        RUNTIME_STYLE["saturation"]
    )
    contrast = RUNTIME_STYLE["contrast"]
    lookup = [
        max(0, min(255, round((value - 128) * contrast + 128)))
        for value in range(256)
    ]
    return rgb.point(lookup * 3)


def derive_runtime_palette(
    rows: list[Image.Image],
) -> tuple[Image.Image, list[tuple[int, int, int]]]:
    """Derive one deterministic palette for the entire factorial slice."""

    pixels: list[tuple[int, int, int]] = []
    for row in rows:
        toned = tone_runtime_rgb(row)
        alpha = row.getchannel("A")
        pixels.extend(
            pixel
            for pixel, alpha_value in zip(toned.getdata(), alpha.getdata())
            if alpha_value >= RUNTIME_STYLE["alpha_threshold"]
        )
    if not pixels:
        raise A2Error("runtime palette source has no opaque pixels")
    contact = Image.new("RGB", (len(pixels), 1))
    contact.putdata(pixels)
    reduced = contact.quantize(
        colors=RUNTIME_STYLE["palette_colors"] - 1,
        method=Image.Quantize.MEDIANCUT,
        dither=Image.Dither.NONE,
    )
    used_indices = sorted(set(reduced.getdata()))
    raw_palette = reduced.getpalette()
    colors = [(0, 0, 0)]
    colors.extend(
        tuple(raw_palette[index * 3:index * 3 + 3])
        for index in used_indices
    )
    colors = colors[:RUNTIME_STYLE["palette_colors"]]
    authority = Image.new("P", (1, 1))
    flattened = [
        channel
        for color in colors
        for channel in color
    ]
    authority.putpalette(
        flattened
        + [0] * (256 * 3 - len(flattened))
    )
    return authority, colors


def apply_runtime_style(
    row: Image.Image,
    palette: Image.Image,
) -> Image.Image:
    """Map a tier row to crisp opaque clusters and one shared palette."""

    toned = tone_runtime_rgb(row)
    reduced = toned.quantize(
        palette=palette,
        dither=Image.Dither.NONE,
    ).convert("RGB")
    alpha = row.getchannel("A").point(
        lambda value: 255
        if value >= RUNTIME_STYLE["alpha_threshold"]
        else 0
    )
    result = Image.merge("RGBA", (*reduced.split(), alpha))
    return sanitize_transparent_rgb(result)


def palette_swatch(colors: list[tuple[int, int, int]]) -> Image.Image:
    columns = 8
    cell = 12
    rows = (len(colors) + columns - 1) // columns
    result = Image.new("RGB", (columns * cell, rows * cell), "#000000")
    draw = ImageDraw.Draw(result)
    for index, color in enumerate(colors):
        x = (index % columns) * cell
        y = (index // columns) * cell
        draw.rectangle((x, y, x + cell - 1, y + cell - 1), fill=color)
    return result


def runtime_row_delta(
    first: Image.Image,
    second: Image.Image,
) -> tuple[float, float]:
    """Return mean visual and silhouette deltas at the 35x46 target."""

    visual: list[float] = []
    silhouette: list[float] = []
    for beat in range(BEATS):
        box = (beat * W, 0, (beat + 1) * W, H)
        left = runtime_frame(first.crop(box))
        right = runtime_frame(second.crop(box))
        left_alpha = left.getchannel("A")
        right_alpha = right.getchannel("A")
        union = sum(
            1
            for l_value, r_value in zip(
                left_alpha.getdata(),
                right_alpha.getdata(),
            )
            if l_value >= 18 or r_value >= 18
        )
        different = sum(
            1
            for l_value, r_value in zip(
                left_alpha.getdata(),
                right_alpha.getdata(),
            )
            if (l_value >= 18) != (r_value >= 18)
        )
        silhouette.append(different / max(1, union))

        background = Image.new("RGBA", RUNTIME_SIZE, "#25313aff")
        left_composite = Image.alpha_composite(background, left).convert("RGB")
        right_composite = Image.alpha_composite(background, right).convert("RGB")
        channel_delta = sum(
            abs(l_value - r_value)
            for l_value, r_value in zip(
                left_composite.tobytes(),
                right_composite.tobytes(),
            )
        )
        visual.append(
            channel_delta
            / (RUNTIME_SIZE[0] * RUNTIME_SIZE[1] * 3 * 255)
        )
    return statistics.mean(visual), statistics.mean(silhouette)


def load_inputs(
    source_dir: Path,
) -> tuple[
    dict[str, Any],
    dict[str, Any],
    dict[str, dict[str, Image.Image]],
    dict[str, dict[str, Any]],
    dict[str, Any],
    dict[str, dict[str, Any]],
]:
    contract_path = source_dir / "a2-contract.json"
    pose_path = source_dir / "pose-spec.json"
    contract = json.loads(contract_path.read_text())
    pose = json.loads(pose_path.read_text())
    a2_manifest_path = A2_OUT / "manifest.json"
    a2_manifest = json.loads(a2_manifest_path.read_text())
    render_profiles = json.loads(RENDER_PROFILES.read_text())
    attachment_contract = json.loads(ATTACHMENT_CONTRACT.read_text())

    if contract.get("schema") != "realm.actor-pose.a2-layered2d.v2":
        raise A2Error("A3 requires the A2 v2 painted-source contract")
    if pose.get("schema") != "realm.actor-pose.a2-pose.v2":
        raise A2Error("A3 requires the A2 v2 authored pose")
    if pose.get("frames") is None or len(pose["frames"]) != BEATS:
        raise A2Error("A3 requires exactly eight authored pose beats")
    if a2_manifest.get("schema") != "realm.actor-pose.a2-reference-manifest.v2":
        raise A2Error("A3 requires the frozen A2 reference manifest")
    if a2_manifest.get("verification", {}).get("mechanical_passed") is not True:
        raise A2Error("A2 mechanical reference gate is not green")
    if (
        a2_manifest.get("verification", {}).get(
            "byte_deterministic_second_pass"
        )
        is not True
    ):
        raise A2Error("A2 reference is not byte deterministic")
    if a2_manifest.get("review", {}).get("factorial_authorized") is not True:
        raise A2Error("A2 reference review has not authorized factorial proof")
    if render_profiles.get("schema") != "realm.actor-pose.a3-render-profiles.v1":
        raise A2Error("A3 render profiles have an unsupported schema")
    if set(render_profiles.get("profiles", {})) != set(contract["identities"]):
        raise A2Error("A3 must define exactly one render profile per identity")
    if (
        attachment_contract.get("schema")
        != "realm.actor-pose.a3-attachments.v1"
    ):
        raise A2Error("A3 attachment contract has an unsupported schema")
    if set(attachment_contract.get("attachments", {})) != {"cargo-crate"}:
        raise A2Error("A3 attachment contract must define cargo-crate exactly")
    for relative, record in a2_manifest.get("outputs", {}).items():
        path = A2_OUT / relative
        if not path.is_file() or file_sha(path) != record.get("sha256"):
            raise A2Error(f"A2 prerequisite output changed: {relative}")

    sheets: dict[str, dict[str, Image.Image]] = {
        "identity": {},
        "garment": {},
        "attachment": {},
    }
    files: dict[str, dict[str, Any]] = {}
    for owner, collection_key in (
        ("identity", "identities"),
        ("garment", "garments"),
    ):
        for key, record in sorted(contract[collection_key].items()):
            path = ROOT / record["path"]
            data = path.read_bytes()
            actual = digest(data)
            if actual != record["sha256"]:
                raise A2Error(f"{owner} source hash changed: {key}")
            sheets[owner][key] = Image.open(io.BytesIO(data)).convert("RGBA")
            files[record["path"]] = {
                "sha256": actual,
                "bytes": len(data),
                "owner": owner,
                "key": key,
            }
    for key, record in sorted(
        attachment_contract["attachments"].items()
    ):
        path = ROOT / record["path"]
        data = path.read_bytes()
        actual = digest(data)
        if actual != record["sha256"]:
            raise A2Error(f"attachment source hash changed: {key}")
        sheets["attachment"][key] = Image.open(io.BytesIO(data)).convert(
            "RGBA"
        )
        files[record["path"]] = {
            "sha256": actual,
            "bytes": len(data),
            "owner": "attachment",
            "key": key,
        }
        generation = record["generation_source"]
        generation_path = ROOT / generation["path"]
        generation_data = generation_path.read_bytes()
        if digest(generation_data) != generation["sha256"]:
            raise A2Error(f"attachment generation source changed: {key}")
        files[generation["path"]] = {
            "sha256": digest(generation_data),
            "bytes": len(generation_data),
            "owner": "imagegen-provenance",
            "key": key,
        }

    for path, owner in (
        (contract_path, "source-contract"),
        (pose_path, "sole-pose-authority"),
        (a2_manifest_path, "approved-reference-authority"),
        (RENDER_PROFILES, "identity-silhouette-authority"),
        (ATTACHMENT_CONTRACT, "attachment-source-authority"),
        (Path(__file__), "compiler-source"),
        (
            ROOT / "scripts/actor-pose-prototype/a2_layered2d.py",
            "shared-compiler-source",
        ),
        (ROOT / "scripts/sprite_row_quality.py", "quality-gate-source"),
    ):
        data = path.read_bytes()
        files[path.relative_to(ROOT).as_posix()] = {
            "sha256": digest(data),
            "bytes": len(data),
            "owner": owner,
        }
    return (
        contract,
        pose,
        sheets,
        render_profiles["profiles"],
        attachment_contract,
        files,
    )


def apply_attachment(
    result: dict[str, Image.Image],
    pose_frame: dict[str, Any],
    source: Image.Image,
    record: dict[str, Any],
) -> dict[str, Image.Image]:
    """Socket cargo between the far and near hand surfaces."""

    crop = record["parts"][DIRECTION]
    component = source.crop(tuple(crop))
    render = record["render"][DIRECTION]
    socket = pose_frame["sockets"][render["socket"]]
    center = (
        socket[0] + render["offset"][0],
        socket[1] + render["offset"][1],
    )
    attachment = direct_piece(
        component,
        tuple(render["size"]),
        center,
    )

    original_flattened = result["flattened"]
    original_semantic = result["semantic"]
    near_colors = {
        SEMANTIC_COLORS["identity-arm-near"],
        SEMANTIC_COLORS["garment-sleeve-near"],
    }
    near_mask = Image.new("L", (W, H), 0)
    near_mask.putdata(
        [
            255 if pixel in near_colors else 0
            for pixel in original_semantic.getdata()
        ]
    )
    near_surface = blank()
    near_surface.paste(original_flattened, (0, 0), near_mask)
    near_semantic = blank()
    near_semantic.paste(original_semantic, (0, 0), near_mask)

    flattened = original_flattened.copy()
    flattened.alpha_composite(attachment)
    flattened.alpha_composite(near_surface)
    semantic = original_semantic.copy()
    semantic.alpha_composite(
        semantic_plane(attachment, ATTACHMENT_SEMANTIC_COLOR)
    )
    semantic.alpha_composite(near_semantic)
    return {
        **result,
        "flattened": flattened,
        "attachment": attachment,
        "semantic": semantic,
    }


def quality_for(
    row_bytes: bytes,
    relative: str,
) -> tuple[dict[str, Any], bytes]:
    with tempfile.TemporaryDirectory(prefix="realm-a3-quality-") as temp:
        temp_path = Path(temp)
        row_path = temp_path / "row.png"
        proof_path = temp_path / "proof.png"
        row_path.write_bytes(row_bytes)
        quality = analyze_row(row_path, ACTION)
        quality["path"] = relative
        write_proof(row_path, proof_path, quality)
        return quality, proof_path.read_bytes()


def runtime_metrics(frames: list[Image.Image]) -> dict[str, Any]:
    heights: list[int] = []
    widths: list[int] = []
    masses: list[float] = []
    for frame in frames:
        small = runtime_frame(frame)
        box = alpha_bbox(small)
        if box is None:
            raise A2Error("runtime legibility proof contains a blank frame")
        widths.append(box[2] - box[0])
        heights.append(box[3] - box[1])
        masses.append(round(sum(small.getchannel("A").getdata()) / 255, 2))
    return {
        "frame_size": list(RUNTIME_SIZE),
        "height_range": [min(heights), max(heights)],
        "width_range": [min(widths), max(widths)],
        "minimum_alpha_mass": min(masses),
        "all_frames_nonblank": len(heights) == BEATS,
    }


def build_combination(
    contract: dict[str, Any],
    pose: dict[str, Any],
    sheets: dict[str, dict[str, Image.Image]],
    render_profiles: dict[str, dict[str, Any]],
    attachment_contract: dict[str, Any],
    identity: str,
    garment: str,
    attachment: str,
) -> tuple[dict[str, bytes], dict[str, Any], dict[str, Image.Image]]:
    scope = {
        "identity": identity,
        "garment": garment,
        "attachment": attachment,
        "action": ACTION,
        "direction": DIRECTION,
    }
    crops = {
        "identity": contract["identities"][identity]["parts"][DIRECTION],
        "garment": contract["garments"][garment]["parts"][DIRECTION],
    }
    parts = source_parts(
        {
            "identity": sheets["identity"][identity],
            "garment": sheets["garment"][garment],
        },
        crops,
    )
    frames: list[Image.Image] = []
    landmarks: list[dict[str, Any]] = []
    planes = {
        name: []
        for name in ("identity", "garment", "attachment", "semantic")
    }
    for pose_frame in pose["frames"]:
        result, metadata = compose_frame(
            parts,
            pose_frame,
            render_profiles[identity],
        )
        if attachment != "off":
            result = apply_attachment(
                result,
                pose_frame,
                sheets["attachment"][attachment],
                attachment_contract["attachments"][attachment],
            )
        frames.append(result["flattened"])
        landmarks.append(metadata)
        for name in planes:
            planes[name].append(result[name])

    gate = validate(
        frames,
        {
            **planes,
            "attachment": [blank() for _frame in range(BEATS)],
        },
        landmarks,
    )
    gate["scope"] = scope
    gate["cargo_pixels"] = max(
        sum(
            frame.getchannel("A").getdata()
        )
        // 255
        for frame in planes["attachment"]
    )
    if attachment != "off":
        # The reference gate requires a fully exposed far hand and at least
        # 60 native pass-boot pixels for the cargo-free derivation reference.
        # A held crate intentionally occupies part of both regions. Replace
        # those two reference-only checks with explicit cargo-interface
        # visibility and socket-ownership checks.
        reference_only_prefixes = (
            "frame 0 far hand",
            "frame 1 far hand",
            "frame 2 far hand",
            "frame 3 far hand",
            "frame 4 far hand",
            "frame 5 far hand",
            "frame 6 far hand",
            "frame 7 far hand",
            "frame 2 far pass boot collapses",
            "frame 6 near pass boot collapses",
        )
        gate["failures"] = [
            failure
            for failure in gate["failures"]
            if not failure.startswith(reference_only_prefixes)
        ]
        cargo_frames: list[dict[str, Any]] = []
        for frame_index, (semantic, cargo, metadata) in enumerate(
            zip(planes["semantic"], planes["attachment"], landmarks)
        ):
            near_hand = tuple(metadata["hands"]["near"])
            far_hand = tuple(metadata["hands"]["far"])

            def hand_box(center: tuple[int, int]) -> tuple[int, int, int, int]:
                return (
                    max(0, center[0] - 4),
                    max(0, center[1] - 4),
                    min(W, center[0] + 5),
                    min(H, center[1] + 5),
                )

            near_pixels = exact_color_count(
                semantic,
                SEMANTIC_COLORS["identity-arm-near"],
                hand_box(near_hand),
            )
            far_pixels = exact_color_count(
                semantic,
                SEMANTIC_COLORS["identity-arm-far"],
                hand_box(far_hand),
            )
            cargo_box = alpha_bbox(cargo)
            load = tuple(metadata["sockets"]["load"])
            socket_owned = bool(
                cargo_box
                and cargo_box[0] <= load[0] < cargo_box[2]
                and cargo_box[1] <= load[1] < cargo_box[3]
            )
            if near_pixels < 8 or not has_color_block(
                semantic,
                SEMANTIC_COLORS["identity-arm-near"],
                near_hand,
            ):
                gate["failures"].append(
                    f"frame {frame_index} cargo hides the gripping near hand"
                )
            if far_pixels < 5:
                gate["failures"].append(
                    f"frame {frame_index} cargo erases the supporting far hand"
                )
            if not socket_owned:
                gate["failures"].append(
                    f"frame {frame_index} cargo does not own the load socket"
                )
            cargo_frames.append(
                {
                    "frame": frame_index,
                    "near_hand_visible_pixels": near_pixels,
                    "far_hand_visible_pixels": far_pixels,
                    "load_socket_owned": socket_owned,
                    "cargo_bbox": list(cargo_box) if cargo_box else None,
                }
            )
        gate["cargo_interface"] = {
            "occlusion": "far-hand < cargo < near-hand",
            "semantic_color": list(ATTACHMENT_SEMANTIC_COLOR),
            "frames": cargo_frames,
        }
        gate["mechanical_passed"] = not gate["failures"]
    row = strip(frames)
    prefix = f"{identity}/{garment}/{attachment}/{ACTION}-{DIRECTION}"
    row_relative = f"rows/{prefix}.png"
    row_bytes = png(row)
    quality, quality_proof = quality_for(row_bytes, row_relative)
    quality_failures = list(quality["errors"]) + list(quality["warnings"])
    if quality.get("styleEra") != "painted":
        quality_failures.append(
            f"quality gate classified row as {quality.get('styleEra')}"
        )
    if quality_failures:
        gate["failures"].extend(
            f"quality: {failure}" for failure in quality_failures
        )
        gate["mechanical_passed"] = False
    gate["production_quality"] = {
        "style_era": quality["styleEra"],
        "median_body_height": quality["medianBodyHeight"],
        "body_height_range": quality["bodyHeightRange"],
        "body_width_range": quality["bodyWidthRange"],
        "body_bottom_range": quality["bodyBottomRange"],
        "flicker_score": quality["flickerScore"],
        "max_alpha_ratio": quality["maxAlphaRatio"],
        "max_fragment_pixels": quality["maxFragmentPixels"],
        "warnings": quality["warnings"],
        "errors": quality["errors"],
    }
    gate["runtime_legibility"] = runtime_metrics(frames)

    plane_rows = {
        name: strip(values)
        for name, values in planes.items()
    }
    runtime_rows = {
        tier: runtime_row(frames, (frame_w, frame_h))
        for tier, frame_w, frame_h in RUNTIME_TIERS
    }
    runtime_paths = {
        tier: f"rows-runtime/{tier}/{prefix}.png"
        for tier, _frame_w, _frame_h in RUNTIME_TIERS
    }
    artifacts = {
        row_relative: row_bytes,
        **{
            runtime_paths[tier]: png(runtime_rows[tier])
            for tier, _frame_w, _frame_h in RUNTIME_TIERS
        },
        f"planes/identity/{prefix}.png": png(plane_rows["identity"]),
        f"planes/garment/{prefix}.png": png(plane_rows["garment"]),
        f"planes/attachment/{prefix}.png": png(plane_rows["attachment"]),
        f"id-masks/{prefix}.png": png(plane_rows["semantic"]),
        f"landmarks/{prefix}.json": canonical(
            {
                "schema": "realm.actor-pose.a3-landmarks.v1",
                "scope": scope,
                "frames": landmarks,
            }
        ),
        f"reports/quality/{identity}-{garment}-{attachment}.json": canonical(quality),
        f"proof/quality/{identity}-{garment}-{attachment}-x4.png": quality_proof,
    }
    record = {
        "scope": scope,
        "row": row_relative,
        "runtime_rows": runtime_paths,
        "identity_plane": f"planes/identity/{prefix}.png",
        "garment_plane": f"planes/garment/{prefix}.png",
        "attachment_plane": f"planes/attachment/{prefix}.png",
        "semantic_mask": f"id-masks/{prefix}.png",
        "landmarks": f"landmarks/{prefix}.json",
        "quality_report": f"reports/quality/{identity}-{garment}-{attachment}.json",
        "quality_proof": f"proof/quality/{identity}-{garment}-{attachment}-x4.png",
        "gate": gate,
    }
    images = {
        "row": row,
        "identity": plane_rows["identity"],
        "garment": plane_rows["garment"],
        "attachment": plane_rows["attachment"],
        "semantic": plane_rows["semantic"],
    }
    return artifacts, record, images


def still_contact(
    combinations: list[tuple[str, str, str]],
    images: dict[tuple[str, str, str], dict[str, Image.Image]],
) -> Image.Image:
    scale = 3
    label_h = 22
    row_h = H * scale + label_h
    result = Image.new("RGB", (ROW_W * scale, row_h * len(combinations)), "#101820")
    draw = ImageDraw.Draw(result)
    for row_index, (identity, garment, attachment) in enumerate(combinations):
        y = row_index * row_h
        row = images[(identity, garment, attachment)]["row"].resize(
            (ROW_W * scale, H * scale),
            Image.Resampling.NEAREST,
        )
        result.paste(row, (0, y + label_h), row)
        draw.text(
            (6, y + 5),
            f"{identity} + {garment} + {attachment}",
            fill="#e8eef2",
        )
    return result


def runtime_contact(
    combinations: list[tuple[str, str, str]],
    rows: dict[tuple[str, str, str], Image.Image],
) -> bytes:
    cells: list[Image.Image] = []
    for beat in range(BEATS):
        canvas = Image.new("RGB", (316, 124), "#25313a")
        draw = ImageDraw.Draw(canvas)
        for index, (identity, garment, attachment) in enumerate(combinations):
            row = rows[(identity, garment, attachment)]
            actor = row.crop(
                (
                    beat * RUNTIME_SIZE[0],
                    0,
                    (beat + 1) * RUNTIME_SIZE[0],
                    RUNTIME_SIZE[1],
                )
            )
            x = 16 + (index % 4) * 76
            y = 15 + (index // 4) * 58
            canvas.paste(actor, (x, y), actor)
        draw.text((4, 4), f"beat {beat}", fill="#e8eef2")
        cells.append(canvas)
    output = io.BytesIO()
    cells[0].save(
        output,
        "GIF",
        save_all=True,
        append_images=cells[1:],
        duration=117,
        loop=0,
        disposal=2,
        optimize=False,
    )
    return output.getvalue()


def factorial_gate(
    combinations: list[tuple[str, str, str]],
    records: dict[tuple[str, str, str], dict[str, Any]],
    images: dict[tuple[str, str, str], dict[str, Image.Image]],
) -> dict[str, Any]:
    failures: list[str] = []
    identities = sorted(
        {identity for identity, _garment, _attachment in combinations}
    )
    garments = sorted(
        {garment for _identity, garment, _attachment in combinations}
    )
    attachments = sorted(
        {attachment for _identity, _garment, attachment in combinations}
    )

    for identity in identities:
        samples = [
            images[(identity, garment, attachment)]["identity"].tobytes()
            for garment in garments
            for attachment in attachments
        ]
        if len(set(samples)) != 1:
            failures.append(
                f"identity plane {identity} changes when garment changes"
            )
    garment_fit_variants = {
        garment: len(
            {
                images[(identity, garment, attachment)]["garment"].tobytes()
                for identity in identities
                for attachment in attachments
            }
        )
        for garment in garments
    }
    for garment, variants in garment_fit_variants.items():
        if variants != len(identities):
            failures.append(
                f"garment plane {garment} does not fit each identity build"
            )
    identity_authorities = {
        digest(
            images[(identity, garments[0], attachments[0])][
                "identity"
            ].tobytes()
        )
        for identity in identities
    }
    garment_authorities = {
        digest(
            images[(identities[0], garment, attachments[0])][
                "garment"
            ].tobytes()
        )
        for garment in garments
    }
    flattened = {
        digest(images[combination]["row"].tobytes())
        for combination in combinations
    }
    if len(identity_authorities) != len(identities):
        failures.append("distinct identities do not produce distinct identity planes")
    if len(garment_authorities) != len(garments):
        failures.append("distinct garments do not produce distinct garment planes")
    if len(flattened) != len(combinations):
        failures.append("factorial combinations do not produce unique rows")

    identity_legibility: dict[str, dict[str, float]] = {}
    for garment in garments:
        visual, silhouette = runtime_row_delta(
            images[(identities[0], garment, "cargo-crate")]["row"],
            images[(identities[1], garment, "cargo-crate")]["row"],
        )
        identity_legibility[garment] = {
            "mean_visual_delta": round(visual, 5),
            "mean_silhouette_delta": round(silhouette, 5),
        }
        if visual < 0.016:
            failures.append(
                f"identity visual delta under {garment} is "
                f"{visual:.4f} < 0.0160"
            )
        if silhouette < 0.035:
            failures.append(
                f"identity silhouette delta under {garment} is "
                f"{silhouette:.4f} < 0.0350"
            )

    garment_legibility: dict[str, dict[str, float]] = {}
    for identity in identities:
        visual, silhouette = runtime_row_delta(
            images[(identity, garments[0], "cargo-crate")]["row"],
            images[(identity, garments[1], "cargo-crate")]["row"],
        )
        garment_legibility[identity] = {
            "mean_visual_delta": round(visual, 5),
            "mean_silhouette_delta": round(silhouette, 5),
        }
        if visual < 0.04:
            failures.append(
                f"garment visual delta on {identity} is {visual:.4f} < 0.0400"
            )

    median_heights: list[float] = []
    for combination in combinations:
        record = records[combination]
        gate = record["gate"]
        if not gate["mechanical_passed"] or gate["failures"]:
            failures.append(
                f"{combination[0]}+{combination[1]}+{combination[2]} "
                "failed row gate: "
                + "; ".join(gate["failures"])
            )
        attachment = combination[2]
        attachment_blank = (
            images[combination]["attachment"].getbbox() is None
        )
        if attachment == "off" and not attachment_blank:
            failures.append(
                f"{combination[0]}+{combination[1]} attachment-off plane is not blank"
            )
        if attachment != "off" and attachment_blank:
            failures.append(
                f"{combination[0]}+{combination[1]} cargo plane is blank"
            )
        legibility = gate["runtime_legibility"]
        if not legibility["all_frames_nonblank"]:
            failures.append(
                f"{combination[0]}+{combination[1]} collapses at 35x46"
            )
        median_heights.append(
            gate["production_quality"]["median_body_height"]
        )
    if max(median_heights) - min(median_heights) > 1:
        failures.append("factorial median body height differs by more than 1px")

    return {
        "schema": "realm.actor-pose.a3-factorial-gate.v1",
        "identities": identities,
        "garments": garments,
        "attachments": attachments,
        "action": ACTION,
        "direction": DIRECTION,
        "rows": len(combinations),
        "frames": len(combinations) * BEATS,
        "identity_plane_invariant_across_garments": not any(
            "identity plane" in failure for failure in failures
        ),
        "garment_fit_variants_by_identity": garment_fit_variants,
        "identity_runtime_legibility": identity_legibility,
        "garment_runtime_legibility": garment_legibility,
        "semantic_categorical_valid": all(
            records[combination]["gate"]["mechanical_passed"]
            for combination in combinations
        ),
        "distinct_identity_planes": len(identity_authorities),
        "distinct_garment_planes": len(garment_authorities),
        "distinct_flattened_rows": len(flattened),
        "median_body_height_range": [
            min(median_heights),
            max(median_heights),
        ],
        "mechanical_passed": not failures,
        "failures": failures,
    }


def build(
    contract: dict[str, Any],
    pose: dict[str, Any],
    sheets: dict[str, dict[str, Image.Image]],
    render_profiles: dict[str, dict[str, Any]],
    attachment_contract: dict[str, Any],
) -> tuple[
    dict[str, bytes],
    dict[tuple[str, str, str], dict[str, Any]],
    dict[str, Any],
]:
    combinations = [
        (identity, garment, attachment)
        for identity in sorted(contract["identities"])
        for garment in sorted(contract["garments"])
        for attachment in ATTACHMENTS
    ]
    artifacts: dict[str, bytes] = {}
    records: dict[tuple[str, str, str], dict[str, Any]] = {}
    images: dict[tuple[str, str, str], dict[str, Image.Image]] = {}
    for identity, garment, attachment in combinations:
        built, record, row_images = build_combination(
            contract,
            pose,
            sheets,
            render_profiles,
            attachment_contract,
            identity,
            garment,
            attachment,
        )
        artifacts.update(built)
        records[(identity, garment, attachment)] = record
        images[(identity, garment, attachment)] = row_images

    default_runtime_rows = {
        combination: runtime_row(
            [
                images[combination]["row"].crop(
                    (beat * W, 0, (beat + 1) * W, H)
                )
                for beat in range(BEATS)
            ],
            RUNTIME_SIZE,
        )
        for combination in combinations
    }
    palette, colors = derive_runtime_palette(
        list(default_runtime_rows.values())
    )
    styled_default_rows: dict[
        tuple[str, str, str],
        Image.Image,
    ] = {}
    for combination in combinations:
        record = records[combination]
        for tier, relative in record["runtime_rows"].items():
            raw = Image.open(io.BytesIO(artifacts[relative])).convert("RGBA")
            styled = apply_runtime_style(raw, palette)
            artifacts[relative] = png(styled)
            if tier == "default":
                styled_default_rows[combination] = styled

    gate = factorial_gate(combinations, records, images)
    styled_colors = {
        pixel[:3]
        for row in styled_default_rows.values()
        for pixel in row.getdata()
        if pixel[3]
    }
    styled_alpha = {
        pixel[3]
        for row in styled_default_rows.values()
        for pixel in row.getdata()
    }
    gate["runtime_style"] = {
        **RUNTIME_STYLE,
        "actual_palette_colors": len(styled_colors),
        "actual_alpha_values": sorted(styled_alpha),
        "palette_hex": [
            f"#{red:02x}{green:02x}{blue:02x}"
            for red, green, blue in colors
        ],
        "mechanical_passed": (
            len(styled_colors) <= RUNTIME_STYLE["palette_colors"]
            and styled_alpha <= {0, 255}
        ),
    }
    if not gate["runtime_style"]["mechanical_passed"]:
        gate["failures"].append(
            "classic runtime style exceeded palette or alpha contract"
        )
        gate["mechanical_passed"] = False
    artifacts["proof/factorial-still-x3.png"] = png(
        still_contact(combinations, images)
    )
    artifacts["proof/factorial-runtime-35x46.gif"] = runtime_contact(
        combinations,
        styled_default_rows,
    )
    artifacts["style/actor-palette.png"] = png(palette_swatch(colors))
    artifacts["style/actor-palette.json"] = canonical(
        {
            "schema": "realm.actor-pose.a3-runtime-palette.v1",
            **RUNTIME_STYLE,
            "colors": gate["runtime_style"]["palette_hex"],
        }
    )
    artifacts["reports/factorial-gate.json"] = canonical(gate)
    return artifacts, records, gate


def manifest(
    files: dict[str, dict[str, Any]],
    artifacts: dict[str, bytes],
    records: dict[tuple[str, str, str], dict[str, Any]],
    gate: dict[str, Any],
    deterministic: bool,
) -> dict[str, Any]:
    return {
        "schema": "realm.actor-pose.a3-interchange-manifest.v1",
        "candidate": "a3-interchange",
        "stage": "right-factorial",
        "status": (
            "factorial-proven"
            if gate["mechanical_passed"] and deterministic
            else "factorial-veto"
        ),
        "scope": {
            "identities": gate["identities"],
            "garments": gate["garments"],
            "attachments": gate["attachments"],
            "actions": [ACTION],
            "directions": [DIRECTION],
            "flattened_rows": gate["rows"],
            "flattened_frames": gate["frames"],
            "frame_size": [W, H],
            "row_size": [ROW_W, H],
            "root": [32, GROUND_Y],
            "runtime": (
                "none; ordinary flattened rows plus prefiltered raster tiers "
                "are promotion artifacts"
            ),
            "runtime_tiers": [
                {
                    "key": key,
                    "frame_size": [frame_w, frame_h],
                    "row_size": [frame_w * BEATS, frame_h],
                }
                for key, frame_w, frame_h in RUNTIME_TIERS
            ],
        },
        "sources": {
            "files": files,
            "source_hash": digest(
                "\n".join(
                    f"{name}\0{record['sha256']}"
                    for name, record in sorted(files.items())
                ).encode()
            ),
            "network_required": False,
            "paint_sources_transformed_by_joint_chain": True,
            "current_or_legacy_frame_pixels_copied": False,
            "runtime_skeletal_renderer": False,
        },
        "outputs": {
            path: {"sha256": digest(data), "bytes": len(data)}
            for path, data in sorted(artifacts.items())
        },
        "rows": {
            f"{identity}/{garment}/{attachment}": record
            for (identity, garment, attachment), record in sorted(records.items())
        },
        "proof": {
            "factorial_still": "proof/factorial-still-x3.png",
            "runtime_35x46_loop": "proof/factorial-runtime-35x46.gif",
            "runtime_palette": "style/actor-palette.png",
        },
        "verification": {
            "mechanical_passed": gate["mechanical_passed"],
            "byte_deterministic_second_pass": deterministic,
            "report": "reports/factorial-gate.json",
            "failures": gate["failures"],
        },
        "compiler": {
            "path": "scripts/actor-pose-prototype/a3_factorial.py",
            "python": f"{sys.version_info.major}.{sys.version_info.minor}",
            "pillow": Image.__version__,
            "runtime_proof_downsample": {
                "filter": "Box",
                "unsharp": {
                    "radius": 0.7,
                    "percent": 80,
                    "threshold": 5,
                },
                "transparent_rgb": "#000000",
            },
        },
    }


def write_output(
    output_dir: Path,
    artifacts: dict[str, bytes],
    document: dict[str, Any],
) -> None:
    if output_dir.exists():
        shutil.rmtree(output_dir)
    for relative, data in artifacts.items():
        target = output_dir / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    (output_dir / "manifest.json").write_bytes(canonical(document))


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Compile the Realm A3 two-identity by two-garment proof."
    )
    parser.add_argument("--source-dir", type=Path, default=SOURCE)
    parser.add_argument("--out-dir", type=Path, default=OUT)
    parser.add_argument(
        "--verify",
        action="store_true",
        help="Require a byte-identical second in-memory build.",
    )
    args = parser.parse_args()
    try:
        (
            contract,
            pose,
            sheets,
            render_profiles,
            attachment_contract,
            files,
        ) = load_inputs(args.source_dir.resolve())
        artifacts, records, gate = build(
            contract,
            pose,
            sheets,
            render_profiles,
            attachment_contract,
        )
        second = (
            build(
                contract,
                pose,
                sheets,
                render_profiles,
                attachment_contract,
            )
            if args.verify
            else None
        )
        deterministic = bool(
            second
            and artifacts == second[0]
            and canonical(
                {
                    f"{key[0]}/{key[1]}": value
                    for key, value in records.items()
                }
            )
            == canonical(
                {
                    f"{key[0]}/{key[1]}": value
                    for key, value in second[1].items()
                }
            )
            and canonical(gate) == canonical(second[2])
        )
        if gate["failures"]:
            raise A2Error("; ".join(gate["failures"]))
        if args.verify and not deterministic:
            raise A2Error("second in-memory factorial build differed")
        document = manifest(
            files,
            artifacts,
            records,
            gate,
            deterministic,
        )
        write_output(args.out_dir.resolve(), artifacts, document)
        print(
            "A3 interchange OK: "
            f"{gate['rows']} flattened rows / {gate['frames']} frames; "
            "identity and garment planes remain independently invariant"
        )
        print(f"output: {args.out_dir.resolve()}")
        return 0
    except (
        A2Error,
        OSError,
        KeyError,
        TypeError,
        ValueError,
        json.JSONDecodeError,
    ) as error:
        print(f"A3 interchange failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
