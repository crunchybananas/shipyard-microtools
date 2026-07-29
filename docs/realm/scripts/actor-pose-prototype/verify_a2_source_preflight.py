#!/usr/bin/env python3
"""Strict independent gate for the RFC 0002 A2 source-crop preflight.

The sibling preflight is source-readiness evidence only.  This verifier never
writes to its checked output tree or to the frozen actor reference.  It
independently remeasures every declared crop, re-hashes every source and proof,
checks the hash-bound review subject, and invokes the generator only against a
temporary directory for an exact clean-tree comparison.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import struct
import subprocess
import sys
import tempfile
from collections import deque
from pathlib import Path
from typing import Any

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
PROTO = ROOT / "assets/sprites/prototypes/actor-pose"
DEFAULT_OUT = PROTO / "output/a2-source-preflight"
DEFAULT_CONTRACT = PROTO / "source/a2-layered2d/a2-contract.json"
GENERATOR = ROOT / "scripts/actor-pose-prototype/a2_source_preflight.py"
REFERENCE_OUT = PROTO / "output/a2-layered2d"
SOURCE_README = PROTO / "references/a2-source/README.md"

SOURCE_SIZE = (1536, 1024)
OVERLAY_SIZE = (768, 512)
CONTACT_SIZE = (980, 856)
ALPHA_THRESHOLD = 24
MIN_FOREGROUND_PIXELS = 256
EXPECTED_IDENTITIES = ["craftsperson", "watchman"]
EXPECTED_GARMENTS = ["ochre-work", "watch-blue"]
EXPECTED_PROMOTION_BLOCKERS = [
    "reference-render-crops-not-cut-over",
    "left-down-up-view-parts-not-authored",
    "sword-and-pouch-sources-not-authored",
    "factorial-compiler-not-built",
]
FORBIDDEN_OUTPUT_PARTS = {
    "actor-rows",
    "actors",
    "actors-compiled",
    "atlas",
    "atlases",
    "id-masks",
    "masks",
    "planes",
    "rows",
}
ALLOWED_OUTPUT_ROOTS = {"proof", "reports"}
DOMAIN_OWNER = {
    "identities": "identity",
    "garments": "garment",
}


class VerificationError(RuntimeError):
    """Raised when the verifier cannot safely continue gathering evidence."""


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha(path: Path) -> str:
    return digest(path.read_bytes())


def subject_digest(subject: Any) -> str:
    return digest(
        json.dumps(
            subject,
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=False,
        ).encode("utf-8")
    )


def repo_path(relative: Any, label: str) -> Path:
    if (
        not isinstance(relative, str)
        or not relative
        or Path(relative).is_absolute()
        or ".." in Path(relative).parts
    ):
        raise VerificationError(f"{label} is not a safe repository-relative path")
    target = (ROOT / relative).resolve()
    if not target.is_relative_to(ROOT):
        raise VerificationError(f"{label} escapes the repository root")
    return target


def output_path(root: Path, relative: Any, label: str) -> Path:
    if (
        not isinstance(relative, str)
        or not relative
        or Path(relative).is_absolute()
        or ".." in Path(relative).parts
    ):
        raise VerificationError(f"{label} is not a safe output-relative path")
    target = (root / relative).resolve()
    if not target.is_relative_to(root):
        raise VerificationError(f"{label} escapes the output root")
    return target


def alpha_mask(image: Image.Image) -> Image.Image:
    return image.getchannel("A").point(
        lambda value: 255 if value >= ALPHA_THRESHOLD else 0
    )


def component_areas(mask: Image.Image) -> list[int]:
    """Return four-connected foreground component areas, largest first."""

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


def measure_crop(
    image: Image.Image,
    raw_box: Any,
    required_margin: int,
) -> tuple[dict[str, Any], list[str]]:
    """Independently reproduce the declared crop evidence."""

    findings: list[str] = []
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
    opaque_box = mask.getbbox()
    if opaque_box is None:
        return {
            "box": raw_box,
            "size": list(crop.size),
            "foreground_pixels": 0,
        }, ["crop is blank"]

    foreground_pixels = sum(1 for value in mask.getdata() if value)
    areas = component_areas(mask)
    margins = [
        opaque_box[0],
        opaque_box[1],
        crop.width - opaque_box[2],
        crop.height - opaque_box[3],
    ]
    if foreground_pixels < MIN_FOREGROUND_PIXELS:
        findings.append(
            f"crop has {foreground_pixels} foreground pixels, "
            f"minimum is {MIN_FOREGROUND_PIXELS}"
        )
    if len(areas) != 1:
        findings.append(
            f"crop has {len(areas)} four-connected components, expected 1"
        )
    if min(margins) < required_margin:
        findings.append(
            f"crop alpha margin {margins} is below {required_margin}px"
        )

    trimmed = crop.crop(opaque_box)
    trimmed_hash = digest(
        struct.pack(">II", trimmed.width, trimmed.height)
        + trimmed.tobytes()
    )
    return {
        "box": raw_box,
        "size": list(crop.size),
        "opaque_bbox_local": list(opaque_box),
        "opaque_bbox_global": [
            left + opaque_box[0],
            top + opaque_box[1],
            left + opaque_box[2],
            top + opaque_box[3],
        ],
        "foreground_pixels": foreground_pixels,
        "component_areas": areas,
        "alpha_margins": margins,
        "trimmed_size": list(trimmed.size),
        "trimmed_rgba_sha256": trimmed_hash,
        "passed": not findings,
    }, findings


def generation_pair_metrics(
    transparent: Image.Image,
    keyed: Image.Image,
) -> dict[str, Any]:
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
    dimensions_match = transparent.size == keyed.size
    return {
        "dimensions_match": dimensions_match,
        "zero_alpha_rgb_pixels": hidden_rgb_pixels,
        "opaque_rgb_mismatches": opaque_rgb_mismatches,
        "passed": (
            dimensions_match
            and hidden_rgb_pixels == 0
            and opaque_rgb_mismatches == 0
        ),
    }


def boxes_overlap(first: list[int], second: list[int]) -> bool:
    return not (
        first[2] <= second[0]
        or second[2] <= first[0]
        or first[3] <= second[1]
        or second[3] <= first[1]
    )


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


def expected_output_paths(contract: dict[str, Any]) -> set[str]:
    view = contract["source_preflight"]["view"]
    result = {
        "proof/right-source-parts.png",
        "reports/crops.json",
    }
    for domain in ("identities", "garments"):
        owner = DOMAIN_OWNER[domain]
        for source_name in contract[domain]:
            result.add(f"proof/{owner}-{source_name}-{view}-source.png")
    return result


def validate_review(
    contract: dict[str, Any],
    report: dict[str, Any],
    expected_sources: dict[str, dict[str, Any]],
    failures: list[str],
) -> dict[str, str]:
    review_relative = contract.get("review_record")
    try:
        review_path = repo_path(review_relative, "review record path")
        review = json.loads(review_path.read_text())
    except (
        OSError,
        TypeError,
        ValueError,
        json.JSONDecodeError,
        VerificationError,
    ) as error:
        failures.append(f"cannot read review authority: {error}")
        return {}

    if review.get("schema") != "realm.actor-pose.review-record.v1":
        failures.append("review authority schema is not v1")
    if review.get("review_id") != "a2-right-reference-v3":
        failures.append("review authority ID changed")
    subject = review.get("subject", {})
    if subject.get("purpose") != "derivation-reference-only":
        failures.append("review subject purpose changed")
    expected_scope = {
        key: contract["reference_gate"][key]
        for key in ("identity", "garment", "attachment", "action", "direction")
    }
    if subject.get("scope") != expected_scope:
        failures.append("review subject scope changed")
    subject_hash = subject_digest(subject)
    if review.get("subject_sha256") != subject_hash:
        failures.append("review subject digest is stale")

    decisions = review.get("decisions", {})
    if set(decisions) != {"terra", "luna", "owner"}:
        failures.append("review authority must contain Terra, Luna, and owner")
    allowed_verdicts = {"pending", "approve-reference-only", "veto"}
    for reviewer in ("terra", "luna", "owner"):
        decision = decisions.get(reviewer, {})
        verdict = decision.get("verdict")
        if verdict not in allowed_verdicts:
            failures.append(f"{reviewer} verdict is outside the review vocabulary")
            continue
        if verdict != "pending":
            if decision.get("subject_sha256") != subject_hash:
                failures.append(f"{reviewer} decision is bound to another subject")
            if not decision.get("recorded_at") or not decision.get("evidence_ref"):
                failures.append(f"{reviewer} decision lacks time/evidence provenance")
        if verdict == "veto" and not decision.get("defect"):
            failures.append(f"{reviewer} veto lacks a defect")

    frozen_hashes: dict[str, str] = {}
    report_frozen = report.get("frozen_reference", {})
    expected_artifacts = {
        "flattened_row": (
            "flattened_row",
            "rows/watchman/watch-blue/off/carry-right.png",
        ),
        "native_1x_loop": (
            "native_1x_loop",
            "proof/carry-right-unlabeled-x1.gif",
        ),
    }
    for report_name, (subject_name, expected_relative) in expected_artifacts.items():
        record = subject.get(subject_name, {})
        relative = record.get("path")
        if relative != expected_relative:
            failures.append(f"review subject {report_name} path changed")
            continue
        try:
            target = output_path(
                REFERENCE_OUT,
                relative,
                f"frozen {report_name}",
            )
            data = target.read_bytes()
        except (OSError, VerificationError) as error:
            failures.append(f"cannot read frozen {report_name}: {error}")
            continue
        actual = digest(data)
        expected = record.get("sha256")
        if actual != expected:
            failures.append(f"frozen {report_name} hash changed")
        frozen_hashes[report_name] = actual
        relative_to_root = target.relative_to(ROOT).as_posix()
        expected_sources[relative_to_root] = {
            "sha256": actual,
            "bytes": len(data),
            "owner": "frozen-reviewed-output",
        }
        expected_report_record = {
            "path": relative,
            "expected_sha256": expected,
            "actual_sha256": actual,
            "passed": actual == expected,
        }
        if report_frozen.get(report_name) != expected_report_record:
            failures.append(f"report frozen {report_name} evidence differs")

    try:
        review_data = review_path.read_bytes()
        expected_sources[review_path.relative_to(ROOT).as_posix()] = {
            "sha256": digest(review_data),
            "bytes": len(review_data),
            "owner": "human-review-authority",
        }
    except OSError as error:
        failures.append(f"cannot hash review authority: {error}")
    return frozen_hashes


def validate() -> int:
    parser = argparse.ArgumentParser(
        description="Verify the RFC A2 all-source crop preflight."
    )
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--contract", type=Path, default=DEFAULT_CONTRACT)
    parser.add_argument(
        "--skip-clean-rebuild",
        action="store_true",
        help="Skip the independent temporary generator run (diagnosis only).",
    )
    args = parser.parse_args()
    out = args.out_dir.resolve()
    contract_path = args.contract.resolve()
    failures: list[str] = []

    try:
        manifest_path = out / "manifest.json"
        manifest = json.loads(manifest_path.read_text())
        contract = json.loads(contract_path.read_text())
        report_relative = manifest.get("report")
        report_path = output_path(out, report_relative, "preflight report")
        report = json.loads(report_path.read_text())
    except (
        OSError,
        TypeError,
        ValueError,
        json.JSONDecodeError,
        VerificationError,
    ) as error:
        print(f"FAIL: cannot open preflight authority: {error}")
        return 1

    if contract.get("schema") != "realm.actor-pose.a2-layered2d.v2":
        failures.append("contract is not A2 layered2d v2")
    if contract.get("stage") != "right-reference-cycle":
        failures.append("contract is no longer at the bounded reference stage")
    preflight = contract.get("source_preflight", {})
    expected_toolchain = {
        "python": f"{sys.version_info.major}.{sys.version_info.minor}",
        "pillow": Image.__version__,
    }
    if preflight.get("toolchain") != expected_toolchain:
        failures.append("contract toolchain does not match the running verifier")
    if manifest.get("toolchain") != expected_toolchain:
        failures.append("manifest toolchain does not match the running verifier")
    if preflight.get("view") != "right":
        failures.append("preflight view must be right")
    if preflight.get("transparent_margin_px") != 12:
        failures.append("preflight transparent margin must be 12px")
    if preflight.get("identity_parts") != ["head", "torso", "arm", "leg"]:
        failures.append("identity part vocabulary/order changed")
    if preflight.get("garment_parts") != [
        "headgear",
        "tunic",
        "sleeve",
        "belt",
        "boot",
    ]:
        failures.append("garment part vocabulary/order changed")
    if sorted(contract.get("identities", {})) != EXPECTED_IDENTITIES:
        failures.append("identity source set changed")
    if sorted(contract.get("garments", {})) != EXPECTED_GARMENTS:
        failures.append("garment source set changed")

    expected_scope = {
        "identities": EXPECTED_IDENTITIES,
        "garments": EXPECTED_GARMENTS,
        "views": ["right"],
        "generated_actor_rows": 0,
        "runtime": "none; source-readiness evidence only",
    }
    if manifest.get("schema") != (
        "realm.actor-pose.a2-source-preflight-manifest.v1"
    ):
        failures.append("preflight manifest schema changed")
    if manifest.get("candidate") != "a2-layered2d":
        failures.append("preflight candidate changed")
    if manifest.get("status") != (
        "source-parts-ready-reference-cutover-pending"
    ):
        failures.append("preflight manifest status changed")
    if manifest.get("scope") != expected_scope:
        failures.append("preflight manifest scope changed")
    expected_verification = {
        "source_preflight_passed": True,
        "factorial_ready": False,
        "reference_cutover_required": True,
        "generated_actor_rows": 0,
        "byte_deterministic_second_pass": True,
        "failures": [],
    }
    if manifest.get("verification") != expected_verification:
        failures.append("preflight manifest verification state changed")

    if report.get("schema") != "realm.actor-pose.a2-source-preflight-report.v1":
        failures.append("crop report schema changed")
    if report.get("stage") != "source-readiness-before-owner-gate":
        failures.append("crop report stage changed")
    if report.get("status") != manifest.get("status"):
        failures.append("crop report status differs from manifest")
    if report.get("view") != preflight.get("view"):
        failures.append("crop report view differs from contract")
    if report.get("alpha_threshold") != ALPHA_THRESHOLD:
        failures.append("crop report alpha threshold changed")
    if report.get("minimum_foreground_pixels") != MIN_FOREGROUND_PIXELS:
        failures.append("crop report foreground threshold changed")
    if report.get("transparent_margin_px") != preflight.get(
        "transparent_margin_px"
    ):
        failures.append("crop report margin differs from contract")
    if report.get("source_preflight_passed") is not True:
        failures.append("crop report does not pass source preflight")
    if report.get("factorial_ready") is not False:
        failures.append("crop report incorrectly claims factorial readiness")
    if report.get("generated_actor_rows") != 0:
        failures.append("crop report claims actor rows")
    if report.get("promotion_blockers") != EXPECTED_PROMOTION_BLOCKERS:
        failures.append("crop report promotion blockers changed")
    if report.get("failures") != []:
        failures.append("crop report contains failures")

    outputs = manifest.get("outputs", {})
    expected_outputs = expected_output_paths(contract)
    if set(outputs) != expected_outputs:
        failures.append(
            "manifest output set changed: "
            f"missing={sorted(expected_outputs - set(outputs))}, "
            f"extra={sorted(set(outputs) - expected_outputs)}"
        )
    actual_files = {
        path.relative_to(out).as_posix()
        for path in out.rglob("*")
        if path.is_file()
    }
    expected_tree = expected_outputs | {"manifest.json"}
    if actual_files != expected_tree:
        failures.append(
            "preflight tree contains missing or stale files: "
            f"missing={sorted(expected_tree - actual_files)}, "
            f"extra={sorted(actual_files - expected_tree)}"
        )
    for path in out.rglob("*"):
        if path.is_symlink():
            failures.append(
                f"preflight tree contains symlink {path.relative_to(out)}"
            )
    for relative, record in outputs.items():
        path_parts = set(Path(relative).parts)
        if path_parts & FORBIDDEN_OUTPUT_PARTS or any(
            "atlas" in part.lower() for part in Path(relative).parts
        ):
            failures.append(f"forbidden actor output {relative}")
        if not Path(relative).parts or (
            Path(relative).parts[0] not in ALLOWED_OUTPUT_ROOTS
        ):
            failures.append(f"preflight output is outside proof/report roots: {relative}")
        try:
            target = output_path(out, relative, f"output {relative}")
            data = target.read_bytes()
        except (OSError, VerificationError) as error:
            failures.append(f"cannot read output {relative}: {error}")
            continue
        expected_record = {
            "sha256": digest(data),
            "bytes": len(data),
        }
        if record != expected_record:
            failures.append(f"output hash/size mismatch {relative}")

    for relative in sorted(expected_outputs):
        if not relative.startswith("proof/"):
            continue
        try:
            image = Image.open(out / relative)
            image.load()
        except (OSError, ValueError) as error:
            failures.append(f"invalid proof PNG {relative}: {error}")
            continue
        expected_size = (
            CONTACT_SIZE
            if relative == "proof/right-source-parts.png"
            else OVERLAY_SIZE
        )
        if image.format != "PNG" or image.size != expected_size:
            failures.append(
                f"proof {relative} expected PNG {expected_size}, "
                f"got {image.format} {image.size}"
            )

    expected_sources: dict[str, dict[str, Any]] = {}
    declared_report = report.get("declared_sources", {})
    expected_declared_domains = {"identities", "garments"}
    if set(declared_report) != expected_declared_domains:
        failures.append("crop report declared-source domains changed")
    measured_parts = 0
    for domain, expected_names in (
        ("identities", EXPECTED_IDENTITIES),
        ("garments", EXPECTED_GARMENTS),
    ):
        records = contract.get(domain, {})
        report_records = declared_report.get(domain, {})
        if sorted(report_records) != expected_names:
            failures.append(f"crop report {domain} set changed")
        owner = DOMAIN_OWNER[domain]
        required_parts = preflight.get(
            "identity_parts" if domain == "identities" else "garment_parts",
            [],
        )
        for source_name in expected_names:
            source_record = records.get(source_name, {})
            report_record = report_records.get(source_name, {})
            try:
                source_path = repo_path(
                    source_record.get("path"),
                    f"{domain}/{source_name} source",
                )
                generation_record = source_record.get("generation_source", {})
                generation_path = repo_path(
                    generation_record.get("path"),
                    f"{domain}/{source_name} generation source",
                )
                source_data = source_path.read_bytes()
                generation_data = generation_path.read_bytes()
                source_disk = Image.open(source_path)
                generation_disk = Image.open(generation_path)
                source_disk.load()
                generation_disk.load()
            except (
                OSError,
                TypeError,
                ValueError,
                VerificationError,
            ) as error:
                failures.append(f"cannot read {domain}/{source_name}: {error}")
                continue

            if source_disk.mode != "RGBA" or source_disk.size != SOURCE_SIZE:
                failures.append(
                    f"{domain}/{source_name} must be RGBA {SOURCE_SIZE}"
                )
            if generation_disk.mode != "RGB" or generation_disk.size != SOURCE_SIZE:
                failures.append(
                    f"{domain}/{source_name} keyed source must be RGB {SOURCE_SIZE}"
                )
            if digest(source_data) != source_record.get("sha256"):
                failures.append(f"{domain}/{source_name} source hash changed")
            if digest(generation_data) != generation_record.get("sha256"):
                failures.append(
                    f"{domain}/{source_name} generation hash changed"
                )
            expected_sources[source_path.relative_to(ROOT).as_posix()] = {
                "sha256": digest(source_data),
                "bytes": len(source_data),
                "owner": owner,
            }
            expected_sources[generation_path.relative_to(ROOT).as_posix()] = {
                "sha256": digest(generation_data),
                "bytes": len(generation_data),
                "owner": "generation-provenance",
            }

            source = source_disk.convert("RGBA")
            generation = generation_disk.convert("RGBA")
            expected_pair = generation_pair_metrics(source, generation)
            if not expected_pair["passed"]:
                failures.append(
                    f"{domain}/{source_name} generation pairing failed"
                )
            if report_record.get("generation_pair") != expected_pair:
                failures.append(
                    f"{domain}/{source_name} generation metrics differ"
                )
            expected_report_header = {
                "path": source_record.get("path"),
                "sha256": source_record.get("sha256"),
                "generation_source": {
                    "path": generation_record.get("path"),
                    "sha256": generation_record.get("sha256"),
                },
                "size": list(source.size),
            }
            for key, value in expected_report_header.items():
                if report_record.get(key) != value:
                    failures.append(
                        f"{domain}/{source_name} report {key} differs"
                    )

            part_sets = source_record.get("parts", {})
            if set(part_sets) != {"right"}:
                failures.append(
                    f"{domain}/{source_name} must declare only right preflight parts"
                )
            parts = part_sets.get("right", {})
            if list(parts) != required_parts:
                failures.append(f"{domain}/{source_name} part order/set changed")
            report_parts = report_record.get("parts", {})
            if set(report_parts) != set(required_parts):
                failures.append(
                    f"{domain}/{source_name} report part set changed"
                )
            boxes: list[tuple[str, list[int]]] = []
            for part_name in required_parts:
                box = parts.get(part_name)
                metrics, findings = measure_crop(
                    source,
                    box,
                    preflight.get("transparent_margin_px"),
                )
                measured_parts += 1
                if findings or not metrics.get("passed"):
                    failures.append(
                        f"{domain}/{source_name}/{part_name} failed: {findings}"
                    )
                if report_parts.get(part_name) != metrics:
                    failures.append(
                        f"{domain}/{source_name}/{part_name} metrics differ"
                    )
                if isinstance(box, list) and len(box) == 4:
                    boxes.append((part_name, box))
            for index, (first_name, first_box) in enumerate(boxes):
                for second_name, second_box in boxes[index + 1 :]:
                    if boxes_overlap(first_box, second_box):
                        failures.append(
                            f"{domain}/{source_name} {first_name}/{second_name} overlap"
                        )
    if measured_parts != 18:
        failures.append(f"measured {measured_parts} parts, expected 18")

    reference_report = report.get("reference_render_parts", {})
    if reference_report.get("matches_preflight") is not False:
        failures.append("report hides the pending reference crop cutover")
    reference_audit = reference_report.get("audit", {})
    expected_reference_domains = {"identity", "garment"}
    if set(reference_audit) != expected_reference_domains:
        failures.append("reference render-part audit domains changed")
    for owner, domain in (("identity", "identities"), ("garment", "garments")):
        source_name = contract["reference_gate"][owner]
        source_record = contract[domain][source_name]
        try:
            source = Image.open(
                repo_path(source_record["path"], f"reference {owner} source")
            ).convert("RGBA")
        except (OSError, VerificationError) as error:
            failures.append(f"cannot audit reference {owner}: {error}")
            continue
        current_parts = contract["reference_gate"].get("render_parts", {}).get(
            owner,
            {},
        )
        safe_parts = source_record["parts"]["right"]
        if list(current_parts) != list(safe_parts):
            failures.append(f"reference {owner} part set/order changed")
        expected_owner_audit: dict[str, Any] = {}
        for part_name, box in current_parts.items():
            metrics, findings = measure_crop(
                source,
                box,
                preflight["transparent_margin_px"],
            )
            expected_owner_audit[part_name] = {
                **metrics,
                "matches_preflight_box": box == safe_parts[part_name],
                "findings": findings,
            }
        if reference_audit.get(owner) != expected_owner_audit:
            failures.append(f"reference {owner} crop audit differs")
        if all(
            current_parts.get(name) == safe_parts.get(name)
            for name in safe_parts
        ):
            failures.append(f"reference {owner} unexpectedly already matches preflight")

    frozen_before = validate_review(
        contract,
        report,
        expected_sources,
        failures,
    )
    for path, owner in (
        (contract_path, "source-contract"),
        (GENERATOR, "preflight-implementation"),
        (SOURCE_README, "source-provenance"),
    ):
        try:
            data = path.read_bytes()
            relative = path.relative_to(ROOT).as_posix()
        except (OSError, ValueError) as error:
            failures.append(f"cannot hash {path}: {error}")
            continue
        expected_sources[relative] = {
            "sha256": digest(data),
            "bytes": len(data),
            "owner": owner,
        }

    manifest_sources = manifest.get("sources", {})
    source_files = manifest_sources.get("files", {})
    if set(source_files) != set(expected_sources):
        failures.append(
            "manifest source set changed: "
            f"missing={sorted(set(expected_sources) - set(source_files))}, "
            f"extra={sorted(set(source_files) - set(expected_sources))}"
        )
    for relative, expected_record in expected_sources.items():
        if source_files.get(relative) != expected_record:
            failures.append(f"source provenance record differs: {relative}")
    expected_source_hash = digest(
        "\n".join(
            f"{path}\0{record['sha256']}"
            for path, record in sorted(expected_sources.items())
        ).encode()
    )
    if manifest_sources.get("source_hash") != expected_source_hash:
        failures.append("aggregate source hash differs")
    if manifest_sources.get("network_required") is not False:
        failures.append("preflight must be network-free")
    if manifest_sources.get("generation_sources_are_provenance_only") is not True:
        failures.append("generation sources are not marked provenance-only")

    if not args.skip_clean_rebuild:
        try:
            with tempfile.TemporaryDirectory(
                prefix="realm-a2-source-preflight-verify-"
            ) as temp:
                rebuilt = Path(temp) / "output"
                result = subprocess.run(
                    [
                        sys.executable,
                        str(GENERATOR),
                        "--verify",
                        "--contract",
                        str(contract_path),
                        "--out-dir",
                        str(rebuilt),
                    ],
                    cwd=ROOT,
                    text=True,
                    capture_output=True,
                    check=False,
                    timeout=120,
                )
                if result.returncode:
                    failures.append(
                        "clean preflight rebuild failed: "
                        f"{result.stdout.strip()} {result.stderr.strip()}"
                    )
                else:
                    failures.extend(compare_tree(out, rebuilt))
        except (OSError, subprocess.SubprocessError) as error:
            failures.append(f"clean preflight rebuild could not run: {error}")

    # A source-only clean build must never alter either hash-bound actor proof.
    for name, before in frozen_before.items():
        subject_name = (
            "flattened_row" if name == "flattened_row" else "native_1x_loop"
        )
        relative = (
            report.get("frozen_reference", {})
            .get(subject_name, {})
            .get("path")
        )
        try:
            after = sha(output_path(REFERENCE_OUT, relative, f"frozen {name}"))
        except (OSError, VerificationError) as error:
            failures.append(f"cannot recheck frozen {name}: {error}")
            continue
        if after != before:
            failures.append(f"source preflight mutated frozen {name}")

    if failures:
        for failure in failures:
            print(f"FAIL: {failure}")
        return 1
    print(
        "A2 source preflight verification OK: 4 hash-locked sheets / "
        "18 independently measured margin-safe right-view parts / 0 actor rows; "
        "source provenance, frozen review artifacts, toolchain, output hashes, "
        "and byte-identical clean rebuild pass; factorial cutover remains vetoed"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(validate())
