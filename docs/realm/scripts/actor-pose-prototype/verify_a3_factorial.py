#!/usr/bin/env python3
"""Strict disk and clean-rebuild gate for the Realm A3 interchange proof."""

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
    / "assets/sprites/prototypes/actor-pose/output/a3-interchange"
)
COMPILER = ROOT / "scripts/actor-pose-prototype/a3_factorial.py"
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
        description="Verify the Realm A3 interchange artifact tree."
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
        if manifest.get("schema") != "realm.actor-pose.a3-interchange-manifest.v1":
            failures.append("manifest schema is not A3 interchange v1")
        if manifest.get("stage") != "right-factorial":
            failures.append("manifest stage is not right-factorial")
        if manifest.get("status") != "factorial-proven":
            failures.append("manifest status is not factorial-proven")

        scope = manifest.get("scope", {})
        expected_scope = {
            "identities": ["craftsperson", "watchman"],
            "garments": ["ochre-work", "watch-blue"],
            "attachments": ["cargo-crate", "off"],
            "actions": ["carry"],
            "directions": ["right"],
            "flattened_rows": 8,
            "flattened_frames": 64,
            "frame_size": [64, 84],
            "row_size": [512, 84],
            "root": [32, 79],
            "runtime": (
                "none; ordinary flattened rows plus prefiltered raster tiers "
                "are promotion artifacts"
            ),
            "runtime_tiers": [
                {
                    "key": key,
                    "frame_size": list(frame_size),
                    "row_size": [frame_size[0] * FRAMES, frame_size[1]],
                }
                for key, frame_size in RUNTIME_TIERS.items()
            ],
        }
        if scope != expected_scope:
            failures.append("manifest factorial scope changed")

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

        for relative, record in (
            manifest.get("sources", {}).get("files", {}).items()
        ):
            source = ROOT / relative
            if not source.is_file():
                failures.append(f"missing source {relative}")
            elif sha(source) != record.get("sha256"):
                failures.append(f"source hash mismatch {relative}")
        sources = manifest.get("sources", {})
        for key in (
            "network_required",
            "current_or_legacy_frame_pixels_copied",
            "runtime_skeletal_renderer",
        ):
            if sources.get(key) is not False:
                failures.append(f"forbidden source/runtime flag {key}")

        gate_path = out / manifest["verification"]["report"]
        gate = json.loads(gate_path.read_text())
        if gate.get("schema") != "realm.actor-pose.a3-factorial-gate.v1":
            failures.append("factorial gate schema changed")
        if not gate.get("mechanical_passed") or gate.get("failures"):
            failures.append("factorial gate is not green")
        if manifest["verification"].get("byte_deterministic_second_pass") is not True:
            failures.append("manifest lacks byte-deterministic second pass")
        if manifest["verification"].get("failures"):
            failures.append("manifest records factorial failures")
        if gate.get("distinct_flattened_rows") != 8:
            failures.append("factorial does not contain eight unique rows")
        if gate.get("distinct_identity_planes") != 2:
            failures.append("factorial does not contain two identity authorities")
        if gate.get("distinct_garment_planes") != 2:
            failures.append("factorial does not contain two garment authorities")
        if gate.get("identity_plane_invariant_across_garments") is not True:
            failures.append("identity plane changes with garment")
        if gate.get("garment_fit_variants_by_identity") != {
            "ochre-work": 2,
            "watch-blue": 2,
        }:
            failures.append("garment kits do not fit both identity builds")
        if gate.get("semantic_categorical_valid") is not True:
            failures.append("semantic category gate is not green")
        runtime_style = gate.get("runtime_style", {})
        if runtime_style.get("mechanical_passed") is not True:
            failures.append("classic runtime style gate is not green")
        if runtime_style.get("palette_colors") != 48:
            failures.append("classic runtime palette size changed")
        if runtime_style.get("actual_palette_colors", 999) > 48:
            failures.append("styled runtime rows exceed 48 colors")
        if runtime_style.get("actual_alpha_values") != [0, 255]:
            failures.append("styled runtime rows contain partial alpha")
        palette_document = json.loads(
            (out / "style/actor-palette.json").read_text()
        )
        if (
            palette_document.get("schema")
            != "realm.actor-pose.a3-runtime-palette.v1"
        ):
            failures.append("runtime palette schema changed")
        if len(palette_document.get("colors", [])) != 48:
            failures.append("runtime palette does not contain 48 colors")
        if gate.get("median_body_height_range") != [76.0, 76.0]:
            failures.append("factorial body-height authority drifted")
        for garment, metrics in gate.get(
            "identity_runtime_legibility", {}
        ).items():
            if metrics.get("mean_visual_delta", 0) < 0.016:
                failures.append(f"identity visual delta collapsed under {garment}")
            if metrics.get("mean_silhouette_delta", 0) < 0.035:
                failures.append(
                    f"identity silhouette delta collapsed under {garment}"
                )
        for identity, metrics in gate.get(
            "garment_runtime_legibility", {}
        ).items():
            if metrics.get("mean_visual_delta", 0) < 0.04:
                failures.append(f"garment visual delta collapsed on {identity}")

        rows = manifest.get("rows", {})
        if set(rows) != {
            f"{identity}/{garment}/{attachment}"
            for identity in ("craftsperson", "watchman")
            for garment in ("ochre-work", "watch-blue")
            for attachment in ("off", "cargo-crate")
        }:
            failures.append("factorial row matrix is incomplete")
        row_images: dict[str, Image.Image] = {}
        identity_planes: dict[str, Image.Image] = {}
        garment_planes: dict[str, Image.Image] = {}
        attachment_planes: dict[str, Image.Image] = {}
        for key, record in rows.items():
            row = rgba(out / record["row"], ROW_SIZE)
            runtime_rows = record.get("runtime_rows", {})
            if set(runtime_rows) != set(RUNTIME_TIERS):
                failures.append(f"{key} runtime tier matrix is incomplete")
            for tier, frame_size in RUNTIME_TIERS.items():
                relative = runtime_rows.get(tier)
                if not relative:
                    continue
                tier_row = rgba(
                    out / relative,
                    (frame_size[0] * FRAMES, frame_size[1]),
                )
                for frame_index in range(FRAMES):
                    frame = tier_row.crop(
                        (
                            frame_index * frame_size[0],
                            0,
                            (frame_index + 1) * frame_size[0],
                            frame_size[1],
                        )
                    )
                    if frame.getbbox() is None:
                        failures.append(
                            f"{key} {tier} frame {frame_index} is blank"
                        )
                tier_colors = {
                    pixel[:3]
                    for pixel in tier_row.getdata()
                    if pixel[3]
                }
                tier_alpha = {
                    pixel[3]
                    for pixel in tier_row.getdata()
                }
                if len(tier_colors) > 48:
                    failures.append(
                        f"{key} {tier} row exceeds 48 runtime colors"
                    )
                if not tier_alpha <= {0, 255}:
                    failures.append(
                        f"{key} {tier} row contains partial alpha"
                    )
            identity = rgba(out / record["identity_plane"], ROW_SIZE)
            garment = rgba(out / record["garment_plane"], ROW_SIZE)
            attachment = rgba(out / record["attachment_plane"], ROW_SIZE)
            rgba(out / record["semantic_mask"], ROW_SIZE)
            attachment_key = record["scope"]["attachment"]
            if attachment_key == "off" and attachment.getbbox() is not None:
                failures.append(f"{key} attachment-off plane is not blank")
            if attachment_key != "off" and attachment.getbbox() is None:
                failures.append(f"{key} cargo attachment plane is blank")
            if attachment_key == "cargo-crate":
                interface = record["gate"].get("cargo_interface", {})
                if interface.get("occlusion") != "far-hand < cargo < near-hand":
                    failures.append(f"{key} cargo occlusion contract changed")
                if len(interface.get("frames", [])) != FRAMES:
                    failures.append(f"{key} cargo interface lacks eight frames")
                for frame in interface.get("frames", []):
                    if frame.get("near_hand_visible_pixels", 0) < 8:
                        failures.append(f"{key} cargo hides the near hand")
                    if frame.get("far_hand_visible_pixels", 0) < 5:
                        failures.append(f"{key} cargo erases the far hand")
                    if frame.get("load_socket_owned") is not True:
                        failures.append(f"{key} cargo misses its load socket")
            if not record["gate"].get("mechanical_passed"):
                failures.append(f"{key} row gate is not green")
            if record["gate"].get("failures"):
                failures.append(f"{key} row records failures")
            frame_hashes: list[str] = []
            for frame_index in range(FRAMES):
                frame = row.crop(
                    (
                        frame_index * W,
                        0,
                        (frame_index + 1) * W,
                        H,
                    )
                )
                if frame.getbbox() is None:
                    failures.append(f"{key} frame {frame_index} is blank")
                frame_hashes.append(hashlib.sha256(frame.tobytes()).hexdigest())
            if len(set(frame_hashes)) != FRAMES:
                failures.append(f"{key} lacks eight distinct frames")
            row_images[key] = row
            identity_planes[key] = identity
            garment_planes[key] = garment
            attachment_planes[key] = attachment

        for identity in ("craftsperson", "watchman"):
            samples = {
                identity_planes[
                    f"{identity}/{garment}/{attachment}"
                ].tobytes()
                for garment in ("ochre-work", "watch-blue")
                for attachment in ("off", "cargo-crate")
            }
            if len(samples) != 1:
                failures.append(
                    f"{identity} identity plane changes with garment"
                )
        for garment in ("ochre-work", "watch-blue"):
            for identity in ("craftsperson", "watchman"):
                left = garment_planes[
                    f"{identity}/{garment}/off"
                ].tobytes()
                right = garment_planes[
                    f"{identity}/{garment}/cargo-crate"
                ].tobytes()
                if left != right:
                    failures.append(
                        f"{garment} garment plane changes with attachment"
                    )
            left = garment_planes[
                f"craftsperson/{garment}/off"
            ].tobytes()
            right = garment_planes[
                f"watchman/{garment}/off"
            ].tobytes()
            if left == right:
                failures.append(
                    f"{garment} garment plane ignores identity fit profile"
                )
        cargo_planes = {
            attachment_planes[
                f"{identity}/{garment}/cargo-crate"
            ].tobytes()
            for identity in ("craftsperson", "watchman")
            for garment in ("ochre-work", "watch-blue")
        }
        if len(cargo_planes) != 1:
            failures.append("cargo attachment changes with identity or garment")
        if len({image.tobytes() for image in row_images.values()}) != 8:
            failures.append("flattened factorial rows are not unique")

        if not args.skip_clean_rebuild:
            with tempfile.TemporaryDirectory(prefix="realm-a3-verify-") as temp:
                rebuilt = Path(temp) / "output"
                result = subprocess.run(
                    [
                        sys.executable,
                        str(COMPILER),
                        "--verify",
                        "--out-dir",
                        str(rebuilt),
                    ],
                    cwd=ROOT,
                    text=True,
                    capture_output=True,
                    check=False,
                )
                if result.returncode:
                    failures.append(
                        "clean rebuild failed: "
                        f"{result.stdout.strip()} {result.stderr.strip()}"
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
        for failure in failures:
            print(f"FAIL: {failure}")
        return 1
    print(
        "A3 interchange verification OK: 2 identities × 2 garment kits × "
        "2 attachment states = 8 deterministic painted rows / 64 distinct "
        "frames; independent source ownership, build-aware fit, socketed "
        "cargo occlusion, native identity legibility, and clean rebuild pass"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
