#!/usr/bin/env python3
"""Strict disk gate for the RFC 0002 A2 right-reference cycle."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
DEFAULT = ROOT / "assets/sprites/prototypes/actor-pose/output/a2-layered2d"
COMPILER = ROOT / "scripts/actor-pose-prototype/a2_layered2d.py"
W, H, ROW_W, BEATS, GROUND_Y = 64, 84, 512, 8, 79
REFERENCE = {
    "identity": "watchman",
    "garment": "watch-blue",
    "attachment": "off",
    "action": "carry",
    "direction": "right",
}


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_png(path: Path, expected: tuple[int, int]) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    if image.size != expected:
        raise ValueError(
            f"{path.relative_to(ROOT) if path.is_relative_to(ROOT) else path}: "
            f"expected {expected}, got {image.size}"
        )
    return image


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    return image.getchannel("A").point(
        lambda value: 255 if value >= 18 else 0
    ).getbbox()


def runs(image: Image.Image, frame: int, y: int) -> list[list[int]]:
    alpha = image.getchannel("A")
    xs = [
        x
        for x in range(W)
        if alpha.getpixel((frame * W + x, y)) >= 18
    ]
    result: list[list[int]] = []
    for x in xs:
        if not result or x > result[-1][1] + 1:
            result.append([x, x])
        else:
            result[-1][1] = x
    return result


def color_count(
    image: Image.Image,
    color: tuple[int, int, int, int],
    box: tuple[int, int, int, int] | None = None,
) -> int:
    sample = image.crop(box) if box is not None else image
    return sum(1 for pixel in sample.getdata() if pixel == color)


def has_2x2(
    image: Image.Image,
    color: tuple[int, int, int, int],
    center: tuple[int, int],
) -> bool:
    cx, cy = center
    for y in range(max(0, cy - 4), min(H - 1, cy + 4)):
        for x in range(max(0, cx - 4), min(W - 1, cx + 4)):
            if all(
                image.getpixel((x + dx, y + dy)) == color
                for dy in range(2)
                for dx in range(2)
            ):
                return True
    return False


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


def expected_runs(info: dict[str, Any]) -> list[list[int]]:
    result = [
        leg["sole_run"]
        for side in ("far", "near")
        if (leg := info[side]).get("sole_run") is not None
    ]
    return sorted(result)


def evaluate_review(
    review: dict[str, Any],
    outputs: dict[str, Any],
    out: Path,
    record_path: str,
) -> dict[str, Any]:
    """Independently derive review state from authored data and disk bytes."""

    failures: list[str] = []
    subject_failures: list[str] = []

    def reject(message: str, *, subject: bool = False) -> None:
        failures.append(message)
        if subject:
            subject_failures.append(message)

    if review.get("schema") != "realm.actor-pose.review-record.v1":
        reject("review record schema is not v1")
    if review.get("review_id") != "a2-right-reference-v3":
        reject("review ID is not the frozen v3 reference")

    subject = review.get("subject", {})
    if not isinstance(subject, dict):
        reject("review subject must be an object", subject=True)
        subject = {}
    if subject.get("purpose") != "derivation-reference-only":
        reject("review purpose is not derivation-reference-only", subject=True)
    if subject.get("scope") != REFERENCE:
        reject(
            "review record scope does not match the frozen row",
            subject=True,
        )

    expected_artifacts = {
        "flattened_row": (
            "flattened_row",
            "rows/watchman/watch-blue/off/carry-right.png",
        ),
        "native_unlabeled_loop": (
            "native_1x_loop",
            "proof/carry-right-unlabeled-x1.gif",
        ),
    }
    artifact_hashes: dict[str, dict[str, str]] = {}
    for name, (subject_key, path) in expected_artifacts.items():
        record = subject.get(subject_key, {})
        if record.get("path") != path:
            reject(f"review record {name} path changed", subject=True)
            continue
        target = out / path
        if not target.is_file():
            reject(f"review target {path} is missing", subject=True)
            continue
        actual = sha(target)
        expected = record.get("sha256")
        if expected != actual:
            reject(
                f"review target {name} changed: expected {expected}, got {actual}",
                subject=True,
            )
        if outputs.get(path, {}).get("sha256") != actual:
            reject(
                f"review target {name} differs from manifest output",
                subject=True,
            )
        artifact_hashes[name] = {
            "path": path,
            "sha256": actual,
        }

    subject_hash = hashlib.sha256(
        json.dumps(
            subject,
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=False,
        ).encode("utf-8")
    ).hexdigest()
    if review.get("subject_sha256") != subject_hash:
        reject("review subject digest is stale", subject=True)

    reviews = review.get("decisions", {})
    if not isinstance(reviews, dict):
        reject("review decisions must be an object")
        reviews = {}
    if set(reviews) != {"terra", "luna", "owner"}:
        reject("review record must contain exactly Terra, Luna, and owner")
    decisions = {
        reviewer: (
            reviews.get(reviewer, {}).get("verdict")
            if isinstance(reviews.get(reviewer, {}), dict)
            else None
        )
        for reviewer in ("terra", "luna", "owner")
    }
    allowed_verdicts = {"pending", "approve-reference-only", "veto"}
    for reviewer in ("terra", "luna", "owner"):
        decision = reviews.get(reviewer, {})
        if not isinstance(decision, dict):
            reject(f"{reviewer.title()} decision must be an object")
            continue
        verdict = decision.get("verdict")
        if verdict not in allowed_verdicts:
            reject(f"{reviewer.title()} verdict is outside the review vocabulary")
            continue
        if verdict == "pending":
            continue
        if decision.get("subject_sha256") != subject_hash:
            reject(
                f"{reviewer.title()} decision is bound to another subject"
            )
        for field in ("recorded_at", "evidence_ref"):
            if not isinstance(decision.get(field), str) or not decision[field].strip():
                reject(f"{reviewer.title()} decision lacks {field}")
        if verdict == "veto" and (
            not isinstance(decision.get("defect"), str)
            or not decision["defect"].strip()
        ):
            reject(f"{reviewer.title()} veto lacks a defect")

    owner = reviews.get("owner", {})
    if not isinstance(owner, dict):
        owner = {}
    owner_verdict = owner.get("verdict")
    valid = not failures
    subject_bound = not subject_failures
    council_pass = valid and subject_bound and all(
        reviews.get(reviewer, {}).get("verdict") == "approve-reference-only"
        and reviews.get(reviewer, {}).get("subject_sha256") == subject_hash
        for reviewer in ("terra", "luna")
    )
    owner_pass = (
        valid
        and subject_bound
        and owner_verdict == "approve-reference-only"
        and owner.get("subject_sha256") == subject_hash
    )
    factorial_authorized = valid and council_pass and owner_pass
    if failures:
        status = "invalid"
    elif owner_verdict == "veto":
        status = "owner-veto"
    elif any(
        reviews.get(reviewer, {}).get("verdict") == "veto"
        for reviewer in ("terra", "luna")
    ):
        status = "council-veto"
    elif factorial_authorized:
        status = "owner-approved-reference"
    elif council_pass and owner_verdict == "pending":
        status = "council-approved-owner-pending"
    else:
        status = "review-incomplete"

    return {
        "schema": "realm.actor-pose.review-evaluation.v1",
        "record": record_path,
        "review_id": review.get("review_id"),
        "subject_sha256": subject_hash,
        "artifacts": artifact_hashes,
        "decisions": decisions,
        "subject_bound": subject_bound,
        "council_reference_pass": council_pass,
        "owner_reference_pass": owner_pass,
        "factorial_authorized": factorial_authorized,
        "status": status,
        "valid": valid,
        "failures": failures,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Verify the RFC A2 cargo-free right-reference artifact set."
    )
    parser.add_argument("--out-dir", type=Path, default=DEFAULT)
    parser.add_argument(
        "--skip-clean-rebuild",
        action="store_true",
        help="Skip the independent compiler invocation (local diagnosis only).",
    )
    args = parser.parse_args()
    out = args.out_dir.resolve()
    failures: list[str] = []
    try:
        manifest_path = out / "manifest.json"
        doc = json.loads(manifest_path.read_text())
        if doc.get("schema") != "realm.actor-pose.a2-reference-manifest.v2":
            failures.append("manifest is not the v2 right-reference schema")
        if doc.get("stage") != "right-reference-cycle":
            failures.append("manifest stage is not the bounded reference cycle")
        scope = doc.get("scope", {})
        expected_scope = {
            **REFERENCE,
            "flattened_rows": 1,
            "flattened_frames": 8,
            "frame_size": [64, 84],
            "row_size": [512, 84],
            "root": [32, 79],
            "ground_y": 79,
            "runtime": "none; flattened offline evidence only",
        }
        scope_without_review = {
            key: value
            for key, value in scope.items()
            if key != "factorial_expansion"
        }
        if scope_without_review != expected_scope:
            failures.append("bounded manifest scope changed")

        outputs = doc.get("outputs", {})
        actual = {
            path.relative_to(out).as_posix()
            for path in out.rglob("*")
            if path.is_file()
        }
        expected_files = set(outputs) | {"manifest.json"}
        if actual != expected_files:
            failures.append(
                "artifact set contains missing or superseded files: "
                f"missing={sorted(expected_files - actual)}, "
                f"extra={sorted(actual - expected_files)}"
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
            elif sha(target) != record["sha256"]:
                failures.append(f"output hash mismatch {relative}")

        # Re-hash every current source and compiler input.  The stale v1 disk
        # verifier omitted this and could report green after sources changed.
        source_files = doc.get("sources", {}).get("files", {})
        for relative, record in source_files.items():
            source = ROOT / relative
            if not source.is_file():
                failures.append(f"missing source {relative}")
            elif sha(source) != record["sha256"]:
                failures.append(f"source hash mismatch {relative}")
        review_info = doc.get("review", {})
        review_relative = review_info.get("record")
        review_source = source_files.get(review_relative, {})
        if review_source.get("owner") != "human-review-authority":
            failures.append("manifest review record lacks human-review authority")
        review_record = json.loads((ROOT / review_relative).read_text())
        expected_review = evaluate_review(
            review_record,
            outputs,
            out,
            review_relative,
        )
        if review_info != expected_review:
            failures.append("manifest review snapshot does not match its authority")
        if not expected_review["valid"]:
            failures.append(
                "review authority is invalid: "
                + "; ".join(expected_review["failures"])
            )
        expected_expansion = (
            "authorized"
            if (
                expected_review["factorial_authorized"]
                and doc.get("verification", {}).get("mechanical_passed") is True
                and doc.get("verification", {}).get(
                    "byte_deterministic_second_pass"
                )
                is True
            )
            else "vetoed"
        )
        if scope.get("factorial_expansion") != expected_expansion:
            failures.append(
                "manifest factorial scope is not derived from review authority"
            )
        if doc.get("status") != review_info.get("status"):
            failures.append("manifest status is not derived from review evaluation")
        provenance = doc.get("sources", {})
        for key in (
            "current_or_legacy_frame_pixels_copied",
            "final_bitmap_mirroring",
            "sentinel_or_registration_pixels",
        ):
            if provenance.get(key) is not False:
                failures.append(f"forbidden provenance flag {key}")
        if provenance.get("network_required") is not False:
            failures.append("compiler must be network-free")

        row_path = out / doc["row"]["path"]
        identity_path = out / doc["row"]["identity_plane"]
        garment_path = out / doc["row"]["garment_plane"]
        attachment_path = out / doc["row"]["attachment_plane"]
        mask_path = out / doc["row"]["semantic_mask"]
        row = read_png(row_path, (ROW_W, H))
        read_png(identity_path, (ROW_W, H))
        read_png(garment_path, (ROW_W, H))
        attachment = read_png(attachment_path, (ROW_W, H))
        semantic = read_png(mask_path, (ROW_W, H))
        if attachment.getbbox() is not None:
            failures.append("cargo/attachment plane is not transparent")

        gate = json.loads(
            (out / doc["verification"]["report"]).read_text()
        )
        review_evaluation = json.loads(
            (out / doc["verification"]["review_report"]).read_text()
        )
        landmarks = json.loads(
            (out / doc["row"]["landmarks"]).read_text()
        )
        quality = json.loads(
            (out / doc["proof"]["quality_report"]).read_text()
        )
        if not gate.get("mechanical_passed") or gate.get("failures"):
            failures.append("reference mechanical gate is not green")
        if gate.get("cargo_pixels") != 0:
            failures.append("reference gate reports cargo pixels")
        for forbidden in (
            "factorial_expansion",
            "human_native_1x_review",
            "review",
        ):
            if forbidden in gate:
                failures.append(
                    f"mechanical report contains human review field {forbidden}"
                )
        if review_evaluation != review_info:
            failures.append("review evaluation differs from manifest")
        if doc["verification"].get("byte_deterministic_second_pass") is not True:
            failures.append("manifest lacks byte-deterministic second pass")
        if quality.get("styleEra") != "painted":
            failures.append("quality gate did not classify the row as painted")
        if quality.get("errors") or quality.get("warnings"):
            failures.append(
                f"quality findings: errors={quality.get('errors')}, "
                f"warnings={quality.get('warnings')}"
            )
        if quality.get("rowSha256") != hashlib.sha256(row.tobytes()).hexdigest():
            failures.append("quality report does not belong to the current row")
        if quality.get("medianBodyHeight") != 76.0:
            failures.append("quality median body height is not 76px")
        if quality.get("bodyHeightRange") != 2:
            failures.append("quality body-height range is not exactly 2px")
        if quality.get("maxFragmentPixels") != 0:
            failures.append("quality gate found detached fragments")

        frame_info = landmarks.get("frames", [])
        if len(frame_info) != BEATS:
            failures.append("landmark file does not contain eight frames")
        hashes: list[str] = []
        palette = {
            tuple(color)
            for color in gate.get("semantic_palette", {}).values()
        }
        semantic_colors = {
            pixel
            for pixel in semantic.getdata()
            if pixel[3] >= 18
        }
        if not semantic_colors or not semantic_colors.issubset(palette):
            failures.append("semantic mask contains non-categorical colors")
        far_hand_color = tuple(
            gate["semantic_palette"]["identity-arm-far"]
        )
        for index, info in enumerate(frame_info):
            frame = row.crop((index * W, 0, (index + 1) * W, H))
            mask_frame = semantic.crop(
                (index * W, 0, (index + 1) * W, H)
            )
            box = alpha_bbox(frame)
            if box is None:
                failures.append(f"frame {index} is blank")
                continue
            hashes.append(hashlib.sha256(frame.tobytes()).hexdigest())
            height = box[3] - box[1]
            if not 75 <= height <= 77:
                failures.append(f"frame {index} height {height}px")
            if box[3] - 1 != GROUND_Y:
                failures.append(f"frame {index} misses ground y={GROUND_Y}")
            if any(
                frame.getchannel("A").getpixel((x, y)) >= 18
                for y in range(80, H)
                for x in range(W)
            ):
                failures.append(f"frame {index} occupies reserved clear rows")
            actual_runs = runs(row, index, GROUND_Y)
            if actual_runs != expected_runs(info):
                failures.append(
                    f"frame {index} support {actual_runs} != "
                    f"{expected_runs(info)}"
                )
            if info.get("root") != [32, 79]:
                failures.append(f"frame {index} root drift")
            for anatomical, socket in (
                ("near", "right_hand"),
                ("far", "left_hand"),
            ):
                hand = info["hands"][anatomical]
                if info["sockets"][socket] != hand:
                    failures.append(
                        f"frame {index} {socket} does not own its hand"
                    )
            far_hand = tuple(info["hands"]["far"])
            hand_box = (
                max(0, far_hand[0] - 4),
                max(0, far_hand[1] - 4),
                min(W, far_hand[0] + 5),
                min(H, far_hand[1] + 5),
            )
            if (
                color_count(mask_frame, far_hand_color, hand_box) < 8
                or not has_2x2(mask_frame, far_hand_color, far_hand)
            ):
                failures.append(
                    f"frame {index} far hand lacks an exposed 2x2 cluster"
                )
        if len(set(hashes)) != BEATS:
            failures.append("reference row lacks eight distinct frames")

        near_boot = tuple(gate["semantic_palette"]["garment-boot-near"])
        far_boot = tuple(gate["semantic_palette"]["garment-boot-far"])

        def semantic_pixel(frame: int, x: int) -> tuple[int, int, int, int]:
            return semantic.getpixel((frame * W + x, GROUND_Y))

        if not (
            semantic_pixel(0, 40) == near_boot
            and semantic_pixel(0, 24) == far_boot
            and semantic_pixel(4, 24) == near_boot
            and semantic_pixel(4, 40) == far_boot
        ):
            failures.append("semantic near/far support does not swap at 0/4")
        for frame_index, side in ((2, "far"), (6, "near")):
            color = tuple(
                gate["semantic_palette"][f"garment-boot-{side}"]
            )
            mask_frame = semantic.crop(
                (
                    frame_index * W,
                    0,
                    (frame_index + 1) * W,
                    H,
                )
            )
            native_pixels = color_count(mask_frame, color)
            runtime_pixels = color_count(
                mask_frame.resize((27, 35), Image.Resampling.NEAREST),
                color,
            )
            if native_pixels < 60 or runtime_pixels < 1:
                failures.append(
                    f"frame {frame_index} {side} pass boot collapses "
                    f"({native_pixels}px native, {runtime_pixels}px at 27x35)"
                )

        if not args.skip_clean_rebuild:
            with tempfile.TemporaryDirectory(prefix="realm-a2-verify-") as temp:
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
    review_note = {
        "owner-approved-reference": "owner-approved derivation reference",
        "council-approved-owner-pending": "owner native-1x review pending",
        "owner-veto": "owner veto recorded",
        "council-veto": "council veto recorded",
        "review-incomplete": "human review incomplete",
    }.get(expected_review["status"], expected_review["status"])
    print(
        "A2 reference verification OK: 1 painted cargo-free 512x84 row / "
        "8 distinct 64x84 frames; categorical IDs, joints, contacts, sockets, "
        f"source hashes, quality, and clean rebuild pass; {review_note}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
