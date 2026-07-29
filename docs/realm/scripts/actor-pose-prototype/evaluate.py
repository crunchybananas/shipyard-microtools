#!/usr/bin/env python3
"""Evaluate and render comparable proofs for RFC 0002 candidates A, B, and C.

The evaluator is intentionally source-pipeline-neutral. A candidate owns a
`rows/` tree of sixteen exact PNG strips and may describe those rows through a
root `manifest.json`. Layer passes, depth/ID passes, and source files are
counted as artifacts but never mistaken for primary review rows.

This is an evidence harness, not an automatic art director. Raster-derived
root and feet values are explicitly labelled as proxies. Authored sockets from
candidate manifests remain the authority for A and B; missing data is reported
instead of invented.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import statistics
import sys
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont

from common import (
    DIRECTIONS,
    EXPECTED_KEYS,
    FRAME_COUNT,
    FRAME_HEIGHT,
    FRAME_WIDTH,
    PROTOTYPE_ROOT,
    REPORT_ROOT,
    ROOT,
    ROW_WIDTH,
    TARGETS,
    file_hash_map,
    frame_pixel_hashes,
    repository_path,
    sha256_file,
    tree_hash,
    write_json,
)


sys.path.insert(0, str(ROOT / "scripts"))
from sprite_row_quality import ALPHA_CUTOFF, analyze_row  # noqa: E402


MANIFEST_NAMES = ("manifest.json", "candidate.json", "build-manifest.json", "metadata.json")
LABEL_ORDER = ("A", "B", "C")
EVALUATOR_REPORT_NAMES = (
    *(f"candidate-{label.lower()}-contact.png" for label in LABEL_ORDER),
    *(f"candidate-{label.lower()}-beats.gif" for label in LABEL_ORDER),
    "comparison-contact.png",
    "evaluation.json",
    "comparison.json",
    "evaluation.md",
)
CHECKER_LIGHT = (58, 64, 69, 255)
CHECKER_DARK = (42, 47, 52, 255)
PANEL = (24, 29, 33, 255)
TEXT = (235, 238, 240, 255)
MUTED = (165, 174, 181, 255)
ACCENT = (239, 185, 73, 255)
ERROR = (224, 90, 82, 255)


def load_manifest(candidate_dir: Path) -> tuple[dict, Path | None]:
    for name in MANIFEST_NAMES:
        path = candidate_dir / name
        if not path.is_file():
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            raise ValueError(f"{repository_path(path)} must contain a JSON object")
        return data, path
    return {}, None


def safe_candidate_path(candidate_dir: Path, value: str) -> Path:
    path = (candidate_dir / value).resolve()
    root = candidate_dir.resolve()
    if path != root and root not in path.parents:
        raise ValueError(f"candidate artifact escapes its directory: {value}")
    return path


def row_path_from_record(
    candidate_dir: Path,
    key: str,
    record: dict,
    default_value: str | None = None,
) -> Path | None:
    for field in ("output", "path", "row", "file", "strip"):
        value = record.get(field)
        if isinstance(value, str) and value:
            return safe_candidate_path(candidate_dir, value)
    if default_value:
        return safe_candidate_path(candidate_dir, default_value)
    role, action, direction = key.split("/")
    candidates = (
        candidate_dir / "rows" / role / action / f"{direction}.png",
        candidate_dir / "rows" / role / f"{action}-{direction}.png",
    )
    for path in candidates:
        if path.is_file():
            return path.resolve()
    return None


def parse_primary_row_path(rows_root: Path, path: Path) -> str | None:
    relative = path.relative_to(rows_root)
    parts = relative.parts
    if len(parts) == 3 and path.suffix.lower() == ".png":
        role, action, file_name = parts
        direction = Path(file_name).stem
        key = f"{role}/{action}/{direction}"
        return key if key in EXPECTED_KEYS else None
    if len(parts) == 2 and path.suffix.lower() == ".png":
        role, file_name = parts
        stem = Path(file_name).stem
        for action in ("walk", "carry", "work"):
            prefix = f"{action}-"
            if stem.startswith(prefix):
                key = f"{role}/{action}/{stem[len(prefix):]}"
                return key if key in EXPECTED_KEYS else None
    match = re.fullmatch(
        r"(guard|builder)[-_](walk|carry|work)[-_](down|up|left|right)",
        path.stem,
    )
    if match:
        key = "/".join(match.groups())
        return key if key in EXPECTED_KEYS else None
    return None


def discover_rows(candidate_dir: Path, manifest: dict) -> tuple[dict[str, dict], list[str]]:
    discovered: dict[str, dict] = {}
    issues: list[str] = []

    rows_value = manifest.get("rows")
    if isinstance(rows_value, dict):
        for key, value in rows_value.items():
            if key not in EXPECTED_KEYS or not isinstance(value, dict):
                continue
            path = row_path_from_record(candidate_dir, key, value)
            if path is None:
                issues.append(f"{key}: manifest row has no discoverable path")
                continue
            discovered[key] = {"path": path, "record": value, "origin": "manifest.rows"}

    outputs_value = manifest.get("outputs")
    if isinstance(outputs_value, dict):
        for output_path, value in outputs_value.items():
            if not isinstance(value, dict):
                continue
            artifact_kind = value.get("artifact_kind") or value.get("artifactKind")
            if artifact_kind and artifact_kind not in ("primary-row", "row", "actor-row"):
                continue
            role = value.get("role")
            action = value.get("action")
            direction = value.get("direction") or value.get("dir")
            key = f"{role}/{action}/{direction}"
            if key not in EXPECTED_KEYS:
                continue
            path = row_path_from_record(candidate_dir, key, value, output_path)
            if path is None:
                issues.append(f"{key}: manifest output has no discoverable path")
                continue
            current = discovered.get(key)
            if current and current["path"] != path:
                issues.append(f"{key}: manifest declares two different primary rows")
                continue
            discovered.setdefault(
                key,
                {"path": path, "record": value, "origin": "manifest.outputs"},
            )

    output_files = manifest.get("output_files") or manifest.get("outputFiles")
    if isinstance(output_files, list):
        for value in output_files:
            if not isinstance(value, dict):
                continue
            path_value = value.get("path") or value.get("file")
            kind = value.get("kind") or value.get("artifact_kind")
            if not isinstance(path_value, str) or (
                kind and kind not in ("primary-row", "row", "actor-row")
            ):
                continue
            role = value.get("role")
            action = value.get("action")
            direction = value.get("direction") or value.get("dir")
            key = f"{role}/{action}/{direction}"
            if key not in EXPECTED_KEYS:
                continue
            path = safe_candidate_path(candidate_dir, path_value)
            current = discovered.get(key)
            if current and current["path"] != path:
                issues.append(f"{key}: output_files conflicts with another row declaration")
                continue
            discovered.setdefault(
                key,
                {"path": path, "record": value, "origin": "manifest.output_files"},
            )

    rows_root = candidate_dir / "rows"
    if rows_root.is_dir():
        for path in sorted(rows_root.rglob("*.png")):
            key = parse_primary_row_path(rows_root, path)
            if key is None:
                issues.append(
                    f"unexpected or unrecognized primary-row PNG: "
                    f"{repository_path(path)}"
                )
                continue
            resolved = path.resolve()
            current = discovered.get(key)
            if current and current["path"] != resolved:
                issues.append(f"{key}: filesystem row conflicts with manifest path")
                continue
            discovered.setdefault(
                key,
                {"path": resolved, "record": {}, "origin": "rows-tree"},
            )

    return discovered, issues


def numeric_range(values: list[float]) -> float | None:
    return round(max(values) - min(values), 2) if values else None


def max_pair_distance(points: list[tuple[float, float]]) -> float | None:
    if not points:
        return None
    return round(
        max(
            (
                math.hypot(ax - bx, ay - by)
                for index, (ax, ay) in enumerate(points)
                for bx, by in points[index + 1 :]
            ),
            default=0.0,
        ),
        2,
    )


def opaque_points(frame: Image.Image, mirror: bool = False) -> set[tuple[int, int]]:
    alpha = frame.getchannel("A")
    points: set[tuple[int, int]] = set()
    for y in range(FRAME_HEIGHT):
        for x in range(FRAME_WIDTH):
            if alpha.getpixel((x, y)) <= ALPHA_CUTOFF:
                continue
            points.add((FRAME_WIDTH - 1 - x if mirror else x, y))
    return points


def infer_root_and_feet(image: Image.Image, row_report: dict) -> dict:
    roots: list[tuple[float, float]] = []
    support_y: list[float] = []
    left_x: list[float] = []
    right_x: list[float] = []
    stance_width: list[float] = []
    missing_foot_proxies = 0

    for frame_index, frame_report in enumerate(row_report.get("frames", [])):
        body = frame_report.get("body", {})
        if not body.get("w") or not body.get("h"):
            missing_foot_proxies += 1
            continue
        root = (float(body["cx"]), float(body["maxY"]))
        roots.append(root)
        frame = image.crop(
            (
                frame_index * FRAME_WIDTH,
                0,
                (frame_index + 1) * FRAME_WIDTH,
                FRAME_HEIGHT,
            )
        )
        points = opaque_points(frame)
        min_x = int(body["minX"])
        max_x = int(body["maxX"])
        min_y = max(0, int(body["maxY"]) - 9)
        max_y = min(FRAME_HEIGHT - 1, int(body["maxY"]) + 1)
        support = [
            (x, y)
            for x, y in points
            if min_x <= x <= max_x and min_y <= y <= max_y
        ]
        if not support:
            missing_foot_proxies += 1
            continue
        floor_y = max(y for _, y in support)
        floor_band = [(x, y) for x, y in support if y >= floor_y - 2]
        left = [x for x, _ in floor_band if x < body["cx"]]
        right = [x for x, _ in floor_band if x >= body["cx"]]
        support_y.append(float(floor_y))
        if left:
            left_value = statistics.mean(left)
            left_x.append(left_value)
        else:
            left_value = None
        if right:
            right_value = statistics.mean(right)
            right_x.append(right_value)
        else:
            right_value = None
        if left_value is not None and right_value is not None:
            stance_width.append(right_value - left_value)

    root_x = [point[0] for point in roots]
    root_y = [point[1] for point in roots]
    return {
        "rootProxy": {
            "definition": "dense-body centroid X and dense-body bottom Y",
            "xRangePx": numeric_range(root_x),
            "yRangePx": numeric_range(root_y),
            "maxPairDisplacementPx": max_pair_distance(roots),
        },
        "feetProxy": {
            "definition": "opaque support band within the lower dense-body bounds",
            "supportYRangePx": numeric_range(support_y),
            "leftXRangePx": numeric_range(left_x),
            "rightXRangePx": numeric_range(right_x),
            "stanceWidthRangePx": numeric_range(stance_width),
            "missingFrames": missing_foot_proxies,
        },
    }


def points_centroid(points: set[tuple[int, int]]) -> tuple[float, float]:
    if not points:
        return FRAME_WIDTH / 2, FRAME_HEIGHT / 2
    return (
        sum(x for x, _ in points) / len(points),
        sum(y for _, y in points) / len(points),
    )


def aligned_iou_cost(
    reference: set[tuple[int, int]],
    candidate: set[tuple[int, int]],
) -> float:
    if not reference or not candidate:
        return 1.0
    reference_center = points_centroid(reference)
    candidate_center = points_centroid(candidate)
    dx = round(reference_center[0] - candidate_center[0])
    dy = round(reference_center[1] - candidate_center[1])
    shifted = {
        (x + dx, y + dy)
        for x, y in candidate
        if 0 <= x + dx < FRAME_WIDTH and 0 <= y + dy < FRAME_HEIGHT
    }
    union = reference | shifted
    return 1.0 - len(reference & shifted) / max(1, len(union))


def left_right_phase(left: Image.Image, right: Image.Image) -> dict:
    left_frames = []
    right_frames = []
    for frame in range(FRAME_COUNT):
        bounds = (
            frame * FRAME_WIDTH,
            0,
            (frame + 1) * FRAME_WIDTH,
            FRAME_HEIGHT,
        )
        left_frames.append(opaque_points(left.crop(bounds)))
        right_frames.append(opaque_points(right.crop(bounds), mirror=True))
    forward_costs = []
    reverse_costs = []
    for shift in range(FRAME_COUNT):
        forward_costs.append(
            statistics.mean(
                aligned_iou_cost(
                    left_frames[frame],
                    right_frames[(frame + shift) % FRAME_COUNT],
                )
                for frame in range(FRAME_COUNT)
            )
        )
        reverse_costs.append(
            statistics.mean(
                aligned_iou_cost(
                    left_frames[frame],
                    right_frames[(FRAME_COUNT - 1 - frame + shift) % FRAME_COUNT],
                )
                for frame in range(FRAME_COUNT)
            )
        )
    best_forward_shift = min(
        range(FRAME_COUNT),
        key=lambda value: (forward_costs[value], value),
    )
    best_reverse_shift = min(
        range(FRAME_COUNT),
        key=lambda value: (reverse_costs[value], value),
    )
    zero_cost = forward_costs[0]
    alternatives = [
        ("forward", best_forward_shift, forward_costs[best_forward_shift]),
        ("reversed", best_reverse_shift, reverse_costs[best_reverse_shift]),
    ]
    best_mapping, best_shift, best_cost = min(
        alternatives,
        key=lambda value: (value[2], value[0] != "forward", value[1]),
    )
    improvement = (
        (zero_cost - best_cost) / zero_cost
        if zero_cost > 1e-9
        else 0.0
    )
    decisive_mismatch = (
        (best_mapping != "forward" or best_shift != 0)
        and improvement >= 0.15
    )
    if not decisive_mismatch:
        status = "zero-shift"
    elif best_mapping == "reversed":
        status = "reversed-chronology"
    else:
        status = "decisive-offset"
    return {
        "comparison": "left-vs-horizontally-mirrored-right",
        "alignment": "integer alpha-centroid translation per compared frame",
        "forwardCostsByCyclicShift": [
            round(value, 4)
            for value in forward_costs
        ],
        "reversedChronologyCostsByShift": [
            round(value, 4)
            for value in reverse_costs
        ],
        "bestMapping": best_mapping,
        "bestShift": best_shift,
        "zeroShiftCost": round(zero_cost, 4),
        "bestCost": round(best_cost, 4),
        "improvement": round(improvement, 4),
        "status": status,
        "passes": not decisive_mismatch,
    }


def recursive_eight_beat_evidence(value: Any, path: str = "") -> list[str]:
    evidence: list[str] = []
    if isinstance(value, dict):
        for key, child in value.items():
            normalized = re.sub(r"[^a-z]", "", key.lower())
            child_path = f"{path}.{key}" if path else key
            if isinstance(child, list) and len(child) == FRAME_COUNT and (
                "beat" in normalized
                or normalized in ("frameorder", "timeline", "contacts")
            ):
                evidence.append(child_path)
            evidence.extend(recursive_eight_beat_evidence(child, child_path))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            evidence.extend(recursive_eight_beat_evidence(child, f"{path}[{index}]"))
    return evidence


def phase_metadata(manifest: dict) -> dict:
    timeline = manifest.get("timeline")
    authored_flag = (
        timeline.get("authoredBeats")
        if isinstance(timeline, dict)
        else None
    )
    evidence = sorted(set(recursive_eight_beat_evidence(manifest)))
    authored = authored_flag is True or any(
        "beat" in path.lower() or "contact" in path.lower()
        for path in evidence
    )
    frame_order = timeline.get("frameOrder") if isinstance(timeline, dict) else None
    frame_order_valid = frame_order == list(range(FRAME_COUNT)) if frame_order is not None else None
    return {
        "authoredEightBeatMetadata": authored,
        "evidencePaths": evidence,
        "frameOrder": frame_order,
        "frameOrderValid": frame_order_valid,
        "status": "present" if authored else "partial" if evidence else "missing",
    }


def normalize_contacts(value: Any) -> tuple[str, ...] | None:
    if isinstance(value, dict):
        if not all(
            key in value and isinstance(value[key], bool)
            for key in ("left", "right")
        ):
            return None
        return tuple(
            key
            for key in ("left", "right")
            if value[key]
        )
    if isinstance(value, list) and all(
        item in ("left", "right")
        for item in value
    ):
        return tuple(sorted(set(value)))
    return None


def authored_phase_contract(
    manifest: dict,
    discovered: dict[str, dict],
    evaluated_rows: dict[str, dict],
) -> dict:
    """Validate per-row authored phase/contact evidence for A and B.

    A top-level timeline assertion is useful context but never sufficient.
    Every row must carry eight hash-tied beat/contact records. Candidate B's
    per-frame indices, normalized phases, and contact sets are equivalent
    authored evidence even though it has no redundant top-level timeline.
    """

    timeline = manifest.get("timeline")
    timeline_errors: list[str] = []
    global_beats = (
        timeline.get("beats")
        if isinstance(timeline, dict)
        else None
    )
    if not (
        isinstance(global_beats, list)
        and len(global_beats) == FRAME_COUNT
        and all(isinstance(beat, str) and beat for beat in global_beats)
    ):
        global_beats = None
    if isinstance(timeline, dict):
        frame_order = timeline.get("frameOrder")
        if (
            frame_order is not None
            and frame_order != list(range(FRAME_COUNT))
        ):
            timeline_errors.append("timeline.frameOrder must be 0..7")
        phase_offset = timeline.get("crossDirectionPhaseOffset")
        if (
            phase_offset is not None
            and not numbers_match(phase_offset, 0)
        ):
            timeline_errors.append(
                "timeline.crossDirectionPhaseOffset must be zero"
            )

    row_evidence: dict[str, dict] = {}
    family_patterns: dict[str, list[tuple[str, tuple[tuple[str, ...], ...]]]] = {}
    for key in EXPECTED_KEYS:
        record = discovered.get(key, {}).get("record", {})
        row_result = evaluated_rows.get(key, {})
        errors: list[str] = []
        if row_result.get("declaredHashMatches") is not True:
            errors.append("phase evidence is not tied to the matching row SHA-256")

        contacts: list[tuple[str, ...]] = []
        schema = None
        sockets = record.get("sockets")
        frames = record.get("frames")
        if isinstance(sockets, list):
            schema = "socket-beats"
            record_phase_offset = record.get("phase_offset")
            if (
                record_phase_offset is not None
                and not numbers_match(record_phase_offset, 0)
            ):
                errors.append("row phase_offset must be zero")
            if len(sockets) != FRAME_COUNT:
                errors.append(
                    f"expected {FRAME_COUNT} socket beats, found {len(sockets)}"
                )
            for index, socket_frame in enumerate(sockets):
                if not isinstance(socket_frame, dict):
                    errors.append(f"socket beat {index}: expected object")
                    continue
                if socket_frame.get("frame") != index:
                    errors.append(f"socket beat {index}: frame index mismatch")
                if socket_frame.get("beat") != index:
                    errors.append(f"socket beat {index}: authored beat mismatch")
                if (
                    global_beats is not None
                    and socket_frame.get("beat_name") != global_beats[index]
                ):
                    errors.append(
                        f"socket beat {index}: beat_name disagrees with timeline"
                    )
                contact = normalize_contacts(
                    socket_frame.get("feet", {}).get("contacts")
                    if isinstance(socket_frame.get("feet"), dict)
                    else None
                )
                if contact is None:
                    errors.append(f"socket beat {index}: invalid contact schema")
                else:
                    contacts.append(contact)
        elif isinstance(frames, list):
            schema = "indexed-phases"
            ordered = sorted(
                (frame for frame in frames if isinstance(frame, dict)),
                key=lambda frame: frame.get("index", -1),
            )
            if (
                len(ordered) != FRAME_COUNT
                or [frame.get("index") for frame in ordered]
                != list(range(FRAME_COUNT))
            ):
                errors.append("expected unique authored frame indices 0..7")
            else:
                for index, frame in enumerate(ordered):
                    expected_phase = index / FRAME_COUNT
                    if not numbers_match(frame.get("phase"), expected_phase):
                        errors.append(
                            f"frame {index}: phase must equal {expected_phase}"
                        )
                    contact = normalize_contacts(frame.get("contacts"))
                    if contact is None:
                        errors.append(f"frame {index}: invalid contact schema")
                    else:
                        contacts.append(contact)
        else:
            errors.append("no recognized per-row authored beat/contact schema")

        if len(contacts) != FRAME_COUNT:
            errors.append(
                f"contact evidence covers {len(contacts)}/{FRAME_COUNT} frames"
            )
        family = "/".join(key.split("/")[:2])
        direction = key.split("/")[2]
        if len(contacts) == FRAME_COUNT:
            family_patterns.setdefault(family, []).append(
                (direction, tuple(contacts))
            )
        row_evidence[key] = {
            "schema": schema,
            "hashTied": row_result.get("declaredHashMatches") is True,
            "status": "valid" if not errors else "invalid",
            "errors": errors,
            "contacts": [list(contact) for contact in contacts],
        }

    family_evidence = []
    for role, action in TARGETS:
        family = f"{role}/{action}"
        patterns = family_patterns.get(family, [])
        complete = len(patterns) == len(DIRECTIONS)
        synchronized = (
            complete
            and len({pattern for _, pattern in patterns}) == 1
        )
        family_evidence.append(
            {
                "family": family,
                "directions": [direction for direction, _ in patterns],
                "complete": complete,
                "contactPatternSynchronized": synchronized,
            }
        )

    valid_rows = sum(
        evidence["status"] == "valid"
        for evidence in row_evidence.values()
    )
    passed = (
        not timeline_errors
        and valid_rows == len(EXPECTED_KEYS)
        and all(item["contactPatternSynchronized"] for item in family_evidence)
    )
    schemas = sorted(
        {
            evidence["schema"]
            for evidence in row_evidence.values()
            if evidence["schema"]
        }
    )
    return {
        "status": (
            "valid"
            if passed
            else "missing"
            if not schemas
            else "invalid"
        ),
        "passed": passed,
        "validRows": valid_rows,
        "expectedRows": len(EXPECTED_KEYS),
        "schemas": schemas,
        "timelineErrors": timeline_errors,
        "globalTimelineBeatsValidated": global_beats is not None,
        "rows": row_evidence,
        "families": family_evidence,
    }


def reproducibility_metadata(manifest: dict) -> dict:
    """Read declared double-build evidence without treating determinism as visual."""
    evidence_paths: list[str] = []
    positive: list[bool] = []
    negative: list[bool] = []

    def visit(value: Any, path: str = "") -> None:
        if isinstance(value, dict):
            for key, child in value.items():
                normalized = re.sub(r"[^a-z]", "", str(key).lower())
                child_path = f"{path}.{key}" if path else str(key)
                is_relevant = any(
                    token in normalized
                    for token in (
                        "bytereproduc",
                        "doublebuild",
                        "determin",
                        "reproduc",
                    )
                ) or (
                    normalized == "matched"
                    and any(
                        token in path.lower()
                        for token in ("reproduc", "determin")
                    )
                )
                if is_relevant and isinstance(child, bool):
                    evidence_paths.append(child_path)
                    (positive if child else negative).append(child)
                visit(child, child_path)
        elif isinstance(value, list):
            for index, child in enumerate(value):
                visit(child, f"{path}[{index}]")

    for field in ("reproducibility", "determinism", "verification"):
        if field in manifest:
            visit(manifest[field], field)
    passed = True if positive and not negative else False if negative else None
    return {
        "passed": passed,
        "status": "pass" if passed is True else "fail" if passed is False else "pending",
        "evidencePaths": sorted(set(evidence_paths)),
    }


def scalar_residuals(value: Any) -> list[float]:
    residuals: list[float] = []
    if isinstance(value, dict):
        normalized = {
            re.sub(r"[^a-z]", "", str(key).lower()): child
            for key, child in value.items()
        }
        for key, child in normalized.items():
            if "residual" in key and isinstance(child, (int, float)):
                residuals.append(float(child))
        for expected_name, actual_name in (
            ("expected", "actual"),
            ("target", "actual"),
            ("authored", "baked"),
        ):
            expected = normalized.get(expected_name)
            actual = normalized.get(actual_name)
            if (
                isinstance(expected, (list, tuple))
                and isinstance(actual, (list, tuple))
                and len(expected) >= 2
                and len(actual) >= 2
                and all(isinstance(item, (int, float)) for item in (*expected[:2], *actual[:2]))
            ):
                residuals.append(
                    math.hypot(
                        float(expected[0]) - float(actual[0]),
                        float(expected[1]) - float(actual[1]),
                    )
                )
        for child in value.values():
            residuals.extend(scalar_residuals(child))
    elif isinstance(value, list):
        for child in value:
            residuals.extend(scalar_residuals(child))
    return residuals


def socket_payload(manifest: dict, key: str, record: dict) -> Any:
    sockets = record.get("sockets")
    if sockets is not None:
        return sockets
    frames = record.get("frames")
    if isinstance(frames, list) and any(
        isinstance(frame, dict) and "sockets" in frame
        for frame in frames
    ):
        return [frame.get("sockets") for frame in frames if isinstance(frame, dict)]
    top = manifest.get("sockets")
    if isinstance(top, dict):
        return top.get(key)
    return None


def socket_frame_coverage(payload: Any) -> int:
    if isinstance(payload, list):
        frame_values = []
        for index, item in enumerate(payload):
            if not isinstance(item, dict):
                continue
            frame = item.get("frame", index)
            if isinstance(frame, int) and 0 <= frame < FRAME_COUNT:
                frame_values.append(frame)
        return len(set(frame_values))
    if isinstance(payload, dict):
        frames = payload.get("frames")
        if isinstance(frames, list):
            return socket_frame_coverage(frames)
    return 0


def row_declared_hash(record: dict) -> str | None:
    for field in ("sha256", "rowSha256", "row_sha256", "hash"):
        value = record.get(field)
        if isinstance(value, str) and re.fullmatch(r"[0-9a-fA-F]{64}", value):
            return value.lower()
    return None


def is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def numbers_match(left: Any, right: Any, tolerance: float = 1e-6) -> bool:
    return (
        is_number(left)
        and is_number(right)
        and math.isclose(float(left), float(right), abs_tol=tolerance)
    )


def validate_metric_summary(
    metrics: dict,
    prefix: str,
    values: list[float],
    errors: list[str],
) -> None:
    if not values:
        errors.append(f"{prefix}: no eight-frame source values")
        return
    expected = {
        f"{prefix}_min": min(values),
        f"{prefix}_max": max(values),
        f"{prefix}_median": statistics.median(values),
        f"{prefix}_range": max(values) - min(values),
    }
    for field, calculated in expected.items():
        declared = metrics.get(field)
        if declared is None:
            # The two prototype compilers do not both emit every redundant
            # summary field. Missing redundancy is acceptable; a declaration
            # that is present must agree with its per-frame evidence.
            continue
        if not numbers_match(declared, calculated):
            errors.append(
                f"{field}: declared {declared!r}, calculated {calculated!r}"
            )


def socket_root_points(record: dict) -> list[tuple[float, float]]:
    sockets = record.get("sockets")
    if isinstance(sockets, list):
        roots = []
        for socket_frame in sockets:
            root = socket_frame.get("root") if isinstance(socket_frame, dict) else None
            if (
                isinstance(root, (list, tuple))
                and len(root) >= 2
                and is_number(root[0])
                and is_number(root[1])
            ):
                roots.append((float(root[0]), float(root[1])))
        return roots

    frames = record.get("frames")
    roots = []
    if not isinstance(frames, list):
        return roots
    for frame in frames:
        frame_sockets = frame.get("sockets") if isinstance(frame, dict) else None
        root = frame_sockets.get("root") if isinstance(frame_sockets, dict) else None
        pixel = root.get("pixel") if isinstance(root, dict) else None
        if (
            isinstance(pixel, (list, tuple))
            and len(pixel) >= 2
            and is_number(pixel[0])
            and is_number(pixel[1])
        ):
            roots.append((float(pixel[0]), float(pixel[1])))
    return roots


def compiler_rig_evidence(record: dict, row_result: dict) -> dict:
    """Validate compiler-owned body/ground metrics against hash-tied row data.

    Candidate A measures a compiler body mask and records per-frame mask bounds.
    Candidate B measures its body ID pass and records the resulting per-frame
    body heights and ground anchors. Both records declare the exact flattened
    row SHA-256. We accept those measurements only when the declaration matches
    the row on disk and all redundant summaries agree with the eight-frame
    evidence.
    """

    metrics = record.get("metrics")
    if not isinstance(metrics, dict):
        return {
            "status": "missing",
            "authority": None,
            "hashTied": False,
            "errors": ["no compiler body/ground metrics"],
            "bodyPass": None,
            "rootFeetPass": None,
        }

    declared_hash = row_result.get("declaredSha256")
    hash_tied = (
        isinstance(declared_hash, str)
        and row_result.get("declaredHashMatches") is True
    )
    errors: list[str] = []
    if not hash_tied:
        errors.append("metrics are not tied to the matching row SHA-256")

    frames = record.get("frames")
    body_heights: list[float] = []
    ground_anchors: list[float] = []
    authority = "compiler body mask"

    metric_heights = metrics.get("body_heights")
    if (
        isinstance(metric_heights, list)
        and len(metric_heights) == FRAME_COUNT
        and all(is_number(value) for value in metric_heights)
    ):
        body_heights = [float(value) for value in metric_heights]
        bounds = metrics.get("body_bounds")
        if isinstance(bounds, list) and len(bounds) == FRAME_COUNT:
            for index, bound in enumerate(bounds):
                if not (
                    isinstance(bound, (list, tuple))
                    and len(bound) >= 4
                    and all(is_number(value) for value in bound[:4])
                ):
                    errors.append(f"body_bounds[{index}]: invalid bounds")
                    continue
                calculated_height = float(bound[3]) - float(bound[1])
                if not numbers_match(body_heights[index], calculated_height):
                    errors.append(
                        f"body_bounds[{index}]: height disagrees with body_heights"
                    )
                ground_anchors.append(float(bound[3]) - 1)
        else:
            errors.append("body_bounds: expected eight compiler mask bounds")

        declared_frame_hashes = metrics.get("frame_pixel_hashes")
        actual_frame_hashes = row_result.get("framePixelSha256")
        if (
            not isinstance(declared_frame_hashes, list)
            or declared_frame_hashes != actual_frame_hashes
        ):
            errors.append("frame_pixel_hashes do not match the flattened row")
    elif isinstance(frames, list) and len(frames) == FRAME_COUNT:
        authority = "compiler body ID pass"
        ordered_frames = sorted(
            (frame for frame in frames if isinstance(frame, dict)),
            key=lambda frame: frame.get("index", -1),
        )
        if (
            len(ordered_frames) != FRAME_COUNT
            or [frame.get("index") for frame in ordered_frames]
            != list(range(FRAME_COUNT))
        ):
            errors.append("frames: expected unique indices 0..7")
        else:
            for frame in ordered_frames:
                body_height = frame.get("body_height")
                ground_anchor = frame.get("ground_anchor_y")
                if not is_number(body_height):
                    errors.append(
                        f"frame {frame['index']}: missing numeric body_height"
                    )
                else:
                    body_heights.append(float(body_height))
                if not is_number(ground_anchor):
                    errors.append(
                        f"frame {frame['index']}: missing numeric ground_anchor_y"
                    )
                else:
                    ground_anchors.append(float(ground_anchor))
                bounds = frame.get("body_bounds")
                if (
                    is_number(body_height)
                    and isinstance(bounds, (list, tuple))
                    and len(bounds) >= 4
                    and all(is_number(value) for value in bounds[:4])
                    and not numbers_match(
                        body_height,
                        float(bounds[3]) - float(bounds[1]),
                    )
                ):
                    errors.append(
                        f"frame {frame['index']}: body bounds disagree with body_height"
                    )
                pixel_hash = frame.get("pixel_sha256")
                actual_hashes = row_result.get("framePixelSha256", [])
                if (
                    not isinstance(pixel_hash, str)
                    or frame["index"] >= len(actual_hashes)
                    or pixel_hash != actual_hashes[frame["index"]]
                ):
                    errors.append(
                        f"frame {frame['index']}: pixel hash disagrees with row"
                    )
    else:
        errors.append("metrics have no recognized eight-frame body evidence")

    if len(body_heights) != FRAME_COUNT:
        errors.append(
            f"body evidence covers {len(body_heights)}/{FRAME_COUNT} frames"
        )
    if len(ground_anchors) != FRAME_COUNT:
        errors.append(
            f"ground evidence covers {len(ground_anchors)}/{FRAME_COUNT} frames"
        )

    if len(body_heights) == FRAME_COUNT:
        validate_metric_summary(metrics, "body_height", body_heights, errors)
    if len(ground_anchors) == FRAME_COUNT:
        ground_prefix = (
            "body_bottom"
            if "body_bottom_range" in metrics
            else "ground_anchor"
        )
        validate_metric_summary(metrics, ground_prefix, ground_anchors, errors)

    roots = socket_root_points(record)
    if len(roots) != FRAME_COUNT:
        errors.append(f"root sockets cover {len(roots)}/{FRAME_COUNT} frames")
    root_vertical_range = (
        numeric_range([point[1] for point in roots])
        if len(roots) == FRAME_COUNT
        else None
    )
    declared_root_drift = record.get("root_drift_px")
    if (
        declared_root_drift is not None
        and root_vertical_range is not None
        and not numbers_match(declared_root_drift, root_vertical_range)
    ):
        errors.append(
            "root_drift_px disagrees with the eight authored root sockets"
        )

    body_range = numeric_range(body_heights)
    body_median = (
        round(float(statistics.median(body_heights)), 2)
        if len(body_heights) == FRAME_COUNT
        else None
    )
    ground_range = numeric_range(ground_anchors)
    valid = not errors
    return {
        "status": "valid" if valid else "invalid",
        "authority": authority,
        "hashTied": hash_tied,
        "rowSha256": declared_hash,
        "errors": errors,
        "bodyHeightRangePx": body_range,
        "bodyMedianHeightPx": body_median,
        "groundAnchorRangePx": ground_range,
        "rootVerticalRangePx": root_vertical_range,
        "bodyPass": (
            body_range is not None and body_range <= 2
            if valid
            else False
        ),
        "rootFeetPass": (
            ground_range is not None
            and ground_range <= 1
            and root_vertical_range is not None
            and root_vertical_range <= 1
            if valid
            else False
        ),
    }


def evaluate_row(key: str, row: dict) -> tuple[dict, Image.Image | None]:
    path: Path = row["path"]
    result: dict[str, Any] = {
        "path": repository_path(path),
        "origin": row["origin"],
        "errors": [],
    }
    if not path.is_file():
        result["errors"].append("missing-file")
        return result, None

    with Image.open(path) as opened:
        original_mode = opened.mode
        size = opened.size
        image = opened.convert("RGBA")
    result["dimensions"] = list(size)
    result["mode"] = original_mode
    result["fileBytes"] = path.stat().st_size
    result["fileSha256"] = sha256_file(path)
    declared_hash = row_declared_hash(row["record"])
    result["declaredSha256"] = declared_hash
    result["declaredHashMatches"] = (
        result["fileSha256"] == declared_hash if declared_hash else None
    )
    if size != (ROW_WIDTH, FRAME_HEIGHT):
        result["errors"].append("wrong-dimensions")
    if original_mode != "RGBA":
        result["errors"].append("wrong-mode")
    if declared_hash and result["fileSha256"] != declared_hash:
        result["errors"].append("declared-hash-mismatch")
    if result["errors"]:
        return result, image

    alpha_extrema = []
    for frame in range(FRAME_COUNT):
        frame_image = image.crop(
            (
                frame * FRAME_WIDTH,
                0,
                (frame + 1) * FRAME_WIDTH,
                FRAME_HEIGHT,
            )
        )
        alpha_extrema.append(frame_image.getchannel("A").getextrema())
    blank_frames = [
        index
        for index, extrema in enumerate(alpha_extrema)
        if extrema is None or extrema[1] <= ALPHA_CUTOFF
    ]
    frame_hashes = frame_pixel_hashes(image)
    quality = analyze_row(path, key.split("/")[1])
    inferred = infer_root_and_feet(image, quality)
    result.update(
        {
            "blankFrames": blank_frames,
            "framePixelSha256": frame_hashes,
            "distinctFrameHashes": len(set(frame_hashes)),
            "body": {
                "heightRangePx": quality.get("bodyHeightRange"),
                "widthRangePx": quality.get("bodyWidthRange"),
                "medianHeightPx": quality.get("medianBodyHeight"),
                "medianWidthPx": quality.get("medianBodyWidth"),
                "maxCenterJumpPx": quality.get("maxBodyCenterJump"),
            },
            **inferred,
            "paintedStyleSignals": {
                "styleEra": quality.get("styleEra"),
                "medianColorCount": quality.get("medianColorCount"),
                "medianShadingRatio": quality.get("medianShadingRatio"),
            },
            "qualityWarnings": quality.get("warnings", []),
        }
    )
    result["compilerRigEvidence"] = compiler_rig_evidence(
        row["record"],
        result,
    )
    if blank_frames:
        result["errors"].append("blank-frame")
    if len(set(frame_hashes)) != FRAME_COUNT:
        result["errors"].append("duplicate-frame-hash")
    result["contractPass"] = not result["errors"]
    result["flattenedRasterHeuristic"] = {
        "role": (
            "review warning only; props, detached limbs, and geometric facets "
            "can distort dense-body inference"
        ),
        "denseBodyHeightRangeLe2": quality.get("bodyHeightRange", math.inf) <= 2,
        "rootVerticalDriftLe1": (
            inferred["rootProxy"]["yRangePx"] is not None
            and inferred["rootProxy"]["yRangePx"] <= 1
        ),
        "feetVerticalDriftLe1": (
            inferred["feetProxy"]["supportYRangePx"] is not None
            and inferred["feetProxy"]["supportYRangePx"] <= 1
            and inferred["feetProxy"]["missingFrames"] == 0
        ),
    }
    return result, image


def candidate_artifact_bytes(candidate_dir: Path) -> int:
    return sum(path.stat().st_size for path in candidate_dir.rglob("*") if path.is_file())


def tri_and(values: list[bool | None]) -> bool | None:
    if any(value is False for value in values):
        return False
    if values and all(value is True for value in values):
        return True
    return None


def scale_comparisons(
    rows: dict[str, dict],
    value_path: tuple[str, ...],
) -> tuple[list[dict], list[dict]]:
    def row_value(key: str) -> Any:
        value: Any = rows.get(key, {})
        for field in value_path:
            value = value.get(field) if isinstance(value, dict) else None
        return value

    cross_direction = []
    for role, action in TARGETS:
        values = [
            row_value(f"{role}/{action}/{direction}")
            for direction in DIRECTIONS
        ]
        present = [float(value) for value in values if is_number(value)]
        delta = numeric_range(present) if len(present) == len(DIRECTIONS) else None
        cross_direction.append(
            {
                "family": f"{role}/{action}",
                "medianHeightByDirection": dict(zip(DIRECTIONS, values)),
                "rangePx": delta,
                "passesLe2": delta <= 2 if delta is not None else None,
            }
        )

    cross_action = []
    action_pairs = {"guard": ("walk", "carry"), "builder": ("walk", "work")}
    for role, actions in action_pairs.items():
        for direction in DIRECTIONS:
            values = [
                row_value(f"{role}/{action}/{direction}")
                for action in actions
            ]
            present = [float(value) for value in values if is_number(value)]
            delta = numeric_range(present) if len(present) == len(actions) else None
        cross_action.append(
            {
                    "family": f"{role}/{direction}",
                "medianHeightByAction": dict(zip(actions, values)),
                "rangePx": delta,
                "passesLe2": delta <= 2 if delta is not None else None,
                }
            )
    return cross_direction, cross_action


def painted_style_summary(rows: dict[str, dict]) -> dict:
    styles: dict[str, int] = {}
    color_counts = []
    shading_ratios = []
    for row in rows.values():
        signals = row.get("paintedStyleSignals", {})
        style = signals.get("styleEra") or "unknown"
        styles[style] = styles.get(style, 0) + 1
        if is_number(signals.get("medianColorCount")):
            color_counts.append(float(signals["medianColorCount"]))
        if is_number(signals.get("medianShadingRatio")):
            shading_ratios.append(float(signals["medianShadingRatio"]))
    painted_count = styles.get("painted", 0)
    return {
        "status": "review-required",
        "mechanicalSignalOnly": True,
        "paintedRows": painted_count,
        "expectedRows": len(EXPECTED_KEYS),
        "styleEraCounts": styles,
        "medianColorCountAcrossRows": (
            round(statistics.median(color_counts), 2)
            if color_counts
            else None
        ),
        "medianShadingRatioAcrossRows": (
            round(statistics.median(shading_ratios), 4)
            if shading_ratios
            else None
        ),
        "humanPass": None,
        "note": (
            "Color/shading statistics are a style-era cue, not proof of "
            "painterly coherence, identity, or final Realm quality."
        ),
    }


def evaluate_candidate(label: str, candidate_dir: Path) -> tuple[dict, dict[str, Image.Image]]:
    manifest, manifest_path = load_manifest(candidate_dir)
    discovered, discovery_issues = discover_rows(candidate_dir, manifest)
    missing = [key for key in EXPECTED_KEYS if key not in discovered]
    rows: dict[str, dict] = {}
    images: dict[str, Image.Image] = {}
    for key in EXPECTED_KEYS:
        if key not in discovered:
            continue
        result, image = evaluate_row(key, discovered[key])
        rows[key] = result
        if image is not None and image.size == (ROW_WIDTH, FRAME_HEIGHT):
            images[key] = image

    cross_direction, cross_action = scale_comparisons(
        rows,
        ("compilerRigEvidence", "bodyMedianHeightPx"),
    )
    raster_cross_direction, raster_cross_action = scale_comparisons(
        rows,
        ("body", "medianHeightPx"),
    )

    phase_pairs = []
    for role, action in TARGETS:
        left_key = f"{role}/{action}/left"
        right_key = f"{role}/{action}/right"
        if left_key in images and right_key in images:
            phase_pairs.append(
                {
                    "family": f"{role}/{action}",
                    **left_right_phase(images[left_key], images[right_key]),
                }
            )
        else:
            phase_pairs.append(
                {
                    "family": f"{role}/{action}",
                    "status": "missing-row",
                    "passes": False,
                }
            )
    metadata_phase = phase_metadata(manifest)
    authored_phase = authored_phase_contract(manifest, discovered, rows)
    reproducibility = reproducibility_metadata(manifest)

    socket_rows = {}
    socket_residual_values: list[float] = []
    for key in EXPECTED_KEYS:
        record = discovered.get(key, {}).get("record", {})
        payload = socket_payload(manifest, key, record)
        if isinstance(payload, dict) and payload.get("status") == "missing":
            socket_rows[key] = {
                "status": "missing",
                "reason": payload.get("reason"),
                "frameCoverage": 0,
                "residualCount": 0,
                "maxResidualPx": None,
            }
            continue
        if payload is None:
            socket_rows[key] = {
                "status": "missing",
                "frameCoverage": 0,
                "residualCount": 0,
                "maxResidualPx": None,
            }
            continue
        residuals = scalar_residuals(payload)
        socket_residual_values.extend(residuals)
        coverage = socket_frame_coverage(payload)
        socket_rows[key] = {
            "status": "present" if residuals else "present-unmeasured",
            "frameCoverage": coverage,
            "residualCount": len(residuals),
            "maxResidualPx": round(max(residuals), 3) if residuals else None,
        }
    rows_with_sockets = sum(
        value["status"].startswith("present")
        for value in socket_rows.values()
    )
    socket_summary = {
        "status": (
            "missing"
            if rows_with_sockets == 0
            else "complete"
            if rows_with_sockets == len(EXPECTED_KEYS)
            else "partial"
        ),
        "rowsWithSocketMetadata": rows_with_sockets,
        "expectedRows": len(EXPECTED_KEYS),
        "maxResidualPx": (
            round(max(socket_residual_values), 3)
            if socket_residual_values
            else None
        ),
        "passesLe1": (
            rows_with_sockets == len(EXPECTED_KEYS)
            and bool(socket_residual_values)
            and max(socket_residual_values) <= 1
        ),
        "rows": socket_rows,
    }
    socket_contract = manifest.get("socketContract")
    if rows_with_sockets == 0 and isinstance(socket_contract, dict):
        socket_summary["declaredContract"] = socket_contract

    structural_pass = (
        not discovery_issues
        and not missing
        and len(discovered) == len(EXPECTED_KEYS)
        and all(row.get("contractPass") for row in rows.values())
    )
    compiler_statuses = [
        row.get("compilerRigEvidence", {}).get("status")
        for row in rows.values()
    ]
    if len(rows) != len(EXPECTED_KEYS):
        body_pass: bool | None = False
        root_feet_pass: bool | None = False
    elif all(status == "missing" for status in compiler_statuses):
        body_pass = None
        root_feet_pass = None
    elif any(status != "valid" for status in compiler_statuses):
        body_pass = False
        root_feet_pass = False
    else:
        body_pass = (
            all(
                row["compilerRigEvidence"]["bodyPass"] is True
                for row in rows.values()
            )
            and all(item["passesLe2"] for item in cross_direction)
            and all(item["passesLe2"] for item in cross_action)
        )
        root_feet_pass = all(
            row["compilerRigEvidence"]["rootFeetPass"] is True
            for row in rows.values()
        )

    phase_conflicts = [
        item
        for item in phase_pairs
        if item.get("passes") is False
    ]
    # A valid authored schema is necessary, but a decisive contradiction in
    # the flattened side views remains a release-blocking review conflict. We
    # do not silently bless Candidate A from its top-level timeline assertion.
    phase_pass = authored_phase["passed"] and not phase_conflicts
    painted_style = painted_style_summary(rows)
    body_root_feet_pass = tri_and([body_pass, root_feet_pass])
    row_hashes = [row.get("fileSha256") for row in rows.values() if row.get("fileSha256")]
    result = {
        "label": label,
        "directory": repository_path(candidate_dir),
        "manifest": repository_path(manifest_path) if manifest_path else None,
        "manifestCandidate": manifest.get("candidate"),
        "discoveryIssues": discovery_issues,
        "missingRows": missing,
        "rowCount": len(discovered),
        "expectedRowCount": len(EXPECTED_KEYS),
        "primaryRowBytes": sum(row.get("fileBytes", 0) for row in rows.values()),
        "candidateArtifactBytes": candidate_artifact_bytes(candidate_dir),
        "candidateTreeSha256": tree_hash(file_hash_map(candidate_dir)),
        "distinctRowFileHashes": len(set(row_hashes)),
        "rows": rows,
        "bodyScale": {
            "crossDirection": cross_direction,
            "crossAction": cross_action,
            "authority": (
                "row-hash-tied compiler body mask/ID metrics; "
                "flattened raster measurements are warnings"
            ),
            "flattenedRasterHeuristic": {
                "crossDirection": raster_cross_direction,
                "crossAction": raster_cross_action,
            },
        },
        "phase": {
            "sourceMetadata": metadata_phase,
            "authoredContract": authored_phase,
            "leftRightSimilarity": phase_pairs,
            "flattenedRasterConflictFamilies": [
                item["family"]
                for item in phase_conflicts
            ],
            "passes": phase_pass,
        },
        "reproducibility": reproducibility,
        "sockets": socket_summary,
        "paintedStyle": painted_style,
        "gates": {
            "structural": structural_pass,
            "bodyHeightAndScale": body_pass,
            "rootFeet": root_feet_pass,
            "bodyRootFeetAndScale": body_root_feet_pass,
            "phase": phase_pass,
            "sockets": socket_summary["passesLe1"],
            "reproducible": reproducibility["passed"],
            "identity": None,
            "occlusion": None,
            "paintedStyle": None,
        },
    }
    result["gates"]["overall"] = all(
        value is True
        for key, value in result["gates"].items()
        if key != "overall"
    )
    return result, images


def checker(size: tuple[int, int], tile: int = 8) -> Image.Image:
    image = Image.new("RGBA", size, CHECKER_DARK)
    draw = ImageDraw.Draw(image)
    for y in range(0, size[1], tile):
        for x in range(0, size[0], tile):
            if (x // tile + y // tile) % 2 == 0:
                draw.rectangle(
                    (x, y, min(size[0] - 1, x + tile - 1), min(size[1] - 1, y + tile - 1)),
                    fill=CHECKER_LIGHT,
                )
    return image


def render_contact(label: str, images: dict[str, Image.Image], output: Path) -> Image.Image:
    label_width = 170
    header_height = 42
    row_gap = 12
    row_height = FRAME_HEIGHT
    width = label_width + ROW_WIDTH + 24
    height = header_height + len(EXPECTED_KEYS) * (row_height + row_gap) + 12
    proof = Image.new("RGBA", (width, height), PANEL)
    draw = ImageDraw.Draw(proof)
    font = ImageFont.load_default()
    draw.text((12, 12), f"Candidate {label} - synchronized row contact", font=font, fill=TEXT)
    y = header_height
    for key in EXPECTED_KEYS:
        draw.text((12, y + 8), key, font=font, fill=TEXT if key in images else ERROR)
        if key in images:
            background = checker((ROW_WIDTH, FRAME_HEIGHT))
            background.alpha_composite(images[key])
            proof.alpha_composite(background, (label_width, y))
            for frame in range(FRAME_COUNT + 1):
                x = label_width + frame * FRAME_WIDTH
                draw.line((x, y, x, y + FRAME_HEIGHT - 1), fill=ACCENT, width=1)
            for frame in range(FRAME_COUNT):
                draw.text(
                    (label_width + frame * FRAME_WIDTH + 3, y + 3),
                    str(frame),
                    font=font,
                    fill=ACCENT,
                )
        else:
            draw.rectangle(
                (label_width, y, label_width + ROW_WIDTH - 1, y + FRAME_HEIGHT - 1),
                outline=ERROR,
            )
            draw.text((label_width + 8, y + 8), "MISSING", font=font, fill=ERROR)
        y += row_height + row_gap
    output.parent.mkdir(parents=True, exist_ok=True)
    proof.convert("RGB").save(output, format="PNG", optimize=False, compress_level=9)
    return proof


def render_animated_matrix(
    label: str,
    images: dict[str, Image.Image],
    output: Path,
) -> None:
    scale = 2
    label_width = 132
    header_height = 38
    cell_width = FRAME_WIDTH * scale
    cell_height = FRAME_HEIGHT * scale
    family_label_height = 20
    width = label_width + len(DIRECTIONS) * cell_width + 12
    height = (
        header_height
        + len(TARGETS) * (cell_height + family_label_height + 8)
        + 8
    )
    font = ImageFont.load_default()
    animation_frames = []
    for beat in range(FRAME_COUNT):
        canvas = Image.new("RGB", (width, height), PANEL[:3])
        draw = ImageDraw.Draw(canvas)
        draw.text((10, 10), f"Candidate {label} - beat {beat}", font=font, fill=TEXT[:3])
        for direction_index, direction in enumerate(DIRECTIONS):
            x = label_width + direction_index * cell_width
            draw.text((x + 4, 10), direction, font=font, fill=ACCENT[:3])
        y = header_height
        for role, action in TARGETS:
            draw.text((10, y + 4), f"{role}/{action}", font=font, fill=TEXT[:3])
            sprite_y = y + family_label_height
            for direction_index, direction in enumerate(DIRECTIONS):
                key = f"{role}/{action}/{direction}"
                x = label_width + direction_index * cell_width
                background = checker((cell_width, cell_height), tile=12)
                if key in images:
                    frame = images[key].crop(
                        (
                            beat * FRAME_WIDTH,
                            0,
                            (beat + 1) * FRAME_WIDTH,
                            FRAME_HEIGHT,
                        )
                    )
                    background.alpha_composite(
                        frame.resize((cell_width, cell_height), Image.Resampling.NEAREST)
                    )
                else:
                    missing_draw = ImageDraw.Draw(background)
                    missing_draw.text((8, 8), "MISSING", font=font, fill=ERROR)
                canvas.paste(background.convert("RGB"), (x, sprite_y))
            y += cell_height + family_label_height + 8
        animation_frames.append(canvas)
    output.parent.mkdir(parents=True, exist_ok=True)
    animation_frames[0].save(
        output,
        format="GIF",
        save_all=True,
        append_images=animation_frames[1:],
        duration=140,
        loop=0,
        disposal=2,
        optimize=False,
    )


def render_comparison(
    contacts: dict[str, Image.Image],
    output: Path,
) -> None:
    if not contacts:
        return
    target_width = 420
    margin = 12
    resized = {}
    for label, image in contacts.items():
        target_height = round(image.height * target_width / image.width)
        resized[label] = image.resize(
            (target_width, target_height),
            Image.Resampling.NEAREST,
        )
    width = len(resized) * target_width + (len(resized) + 1) * margin
    height = max(image.height for image in resized.values()) + 44
    canvas = Image.new("RGB", (width, height), PANEL[:3])
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.load_default()
    for index, label in enumerate(LABEL_ORDER):
        image = resized.get(label)
        if image is None:
            continue
        x = margin + list(resized).index(label) * (target_width + margin)
        draw.text((x, 10), f"Candidate {label}", font=font, fill=TEXT[:3])
        canvas.paste(image.convert("RGB"), (x, 32))
    canvas.save(output, format="PNG", optimize=False, compress_level=9)


def format_bool(value: Any) -> str:
    return "PASS" if value is True else "FAIL" if value is False else "—"


def write_markdown(report: dict, path: Path) -> None:
    lines = [
        "# Actor Pose Prototype Evaluation",
        "",
        "This report compares the same sixteen flattened `512x84` runtime rows. "
        "It does not promote any candidate into the game.",
        "",
        "| Candidate | Rows | Primary bytes | Structural | Body scale | Root/feet | Phase | Sockets | Paint/style | Overall |",
        "| --- | ---: | ---: | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for label in LABEL_ORDER:
        candidate = report["candidates"].get(label)
        if not candidate:
            continue
        gates = candidate["gates"]
        lines.append(
            f"| {label} | {candidate['rowCount']}/{candidate['expectedRowCount']} | "
            f"{candidate['primaryRowBytes']:,} | {format_bool(gates['structural'])} | "
            f"{format_bool(gates['bodyHeightAndScale'])} | "
            f"{format_bool(gates['rootFeet'])} | "
            f"{format_bool(gates['phase'])} | {format_bool(gates['sockets'])} | "
            f"{format_bool(gates['paintedStyle'])} | "
            f"{format_bool(gates['overall'])} |"
        )

    for label in LABEL_ORDER:
        candidate = report["candidates"].get(label)
        if not candidate:
            continue
        lines.extend(
            [
                "",
                f"## Candidate {label}",
                "",
                f"- Directory: `{candidate['directory']}`",
                f"- Artifact tree SHA-256: `{candidate['candidateTreeSha256']}`",
                f"- Distinct primary-row file hashes: "
                f"{candidate['distinctRowFileHashes']}/{candidate['expectedRowCount']}",
                f"- Authored phase/contact contract: "
                f"{candidate['phase']['authoredContract']['status']} "
                f"({candidate['phase']['authoredContract']['validRows']}/"
                f"{candidate['phase']['authoredContract']['expectedRows']} rows)",
                f"- Flattened side-view phase conflicts: "
                f"{', '.join(candidate['phase']['flattenedRasterConflictFamilies']) or 'none'}",
                f"- Socket metadata: {candidate['sockets']['status']} "
                f"({candidate['sockets']['rowsWithSocketMetadata']}/"
                f"{candidate['sockets']['expectedRows']} rows)",
                f"- Paint/style raster cue: "
                f"{candidate['paintedStyle']['paintedRows']}/"
                f"{candidate['paintedStyle']['expectedRows']} rows classified painted; "
                "human verdict pending",
                "",
                "| Row | Frames | Compiler body range | Compiler root Y | Compiler ground Y | Rig evidence | Structural |",
                "| --- | ---: | ---: | ---: | ---: | --- | --- |",
            ]
        )
        for key in EXPECTED_KEYS:
            row = candidate["rows"].get(key)
            if not row:
                lines.append(f"| `{key}` | — | — | — | — | MISSING |")
                continue
            lines.append(
                f"| `{key}` | {row.get('distinctFrameHashes', 0)}/8 | "
                f"{row.get('compilerRigEvidence', {}).get('bodyHeightRangePx', '—')} | "
                f"{row.get('compilerRigEvidence', {}).get('rootVerticalRangePx', '—')} | "
                f"{row.get('compilerRigEvidence', {}).get('groundAnchorRangePx', '—')} | "
                f"{row.get('compilerRigEvidence', {}).get('status', '—')} | "
                f"{format_bool(row.get('contractPass'))} |"
            )
        lines.extend(["", "Cross-direction compiler body height:"])
        for item in candidate["bodyScale"]["crossDirection"]:
            lines.append(
                f"- `{item['family']}`: range `{item['rangePx']}` px "
                f"({format_bool(item['passesLe2'])})"
            )
        lines.extend(["", "Left/right temporal similarity:"])
        for item in candidate["phase"]["leftRightSimilarity"]:
            lines.append(
                f"- `{item['family']}`: `{item['status']}`"
                + (
                    f", best cyclic shift `{item.get('bestShift')}`"
                    if "bestShift" in item
                    else ""
                )
            )
        raster_warning_rows = [
            key
            for key, row in candidate["rows"].items()
            if not all(
                value is True
                for field, value in row.get("flattenedRasterHeuristic", {}).items()
                if field != "role"
            )
        ]
        lines.extend(
            [
                "",
                "Flattened-raster review warnings: "
                + (
                    ", ".join(f"`{key}`" for key in raster_warning_rows)
                    if raster_warning_rows
                    else "none"
                ),
            ]
        )

    lines.extend(
        [
            "",
            "## Interpretation limits",
            "",
            "- Raster-inferred root and feet measurements are review proxies. "
            "They are warnings and do not override hash-tied compiler body-mask/ID, "
            "ground, root, contact, or socket evidence.",
            "- Mirrored left/right alpha similarity can expose a cyclic offset, "
            "but cannot prove that all four views express the same semantic beat. "
            "A decisive contradiction still blocks phase approval for review.",
            "- Hash, bounds, and style-era signals cannot decide whether guard and "
            "builder identities are sufficiently distinct at `1x`; that remains a "
            "blind visual review.",
            "- The `painted` style-era signal is descriptive only. Human paint/style "
            "approval remains mandatory, so no candidate can auto-pass overall.",
            "- Joint gaps, paint seams, and occlusion defects require proof review; "
            "the evaluator does not pretend alpha continuity establishes anatomy.",
            "- Cold/incremental authoring time and the `100`/`250` actor flattened-"
            "versus-layered runtime profile are separate RFC evidence and are not "
            "measured here.",
            "",
            "Proofs: `candidate-<label>-contact.png`, "
            "`candidate-<label>-beats.gif`, and `comparison-contact.png`.",
            "",
        ]
    )
    path.write_text("\n".join(lines), encoding="utf-8")


def ui_gate(pass_value: bool | None, detail: str) -> dict:
    return {"pass": pass_value, "detail": detail}


def make_ui_comparison(report: dict) -> dict:
    candidate_ids = {
        "A": "a-layered2d",
        "B": "b-orthographic3d",
        "C": "c-row-factory",
    }
    candidates = {}
    for label in LABEL_ORDER:
        candidate = report["candidates"].get(label)
        if not candidate:
            continue
        rows = candidate["rows"]
        dimension_pass = (
            len(rows) == len(EXPECTED_KEYS)
            and all(
                row.get("dimensions") == [ROW_WIDTH, FRAME_HEIGHT]
                and row.get("mode") == "RGBA"
                for row in rows.values()
            )
        )
        nonblank_count = sum(
            FRAME_COUNT - len(row.get("blankFrames", []))
            for row in rows.values()
        )
        distinct_count = sum(
            row.get("distinctFrameHashes", 0)
            for row in rows.values()
        )
        frame_contract_pass = (
            len(rows) == len(EXPECTED_KEYS)
            and nonblank_count == len(EXPECTED_KEYS) * FRAME_COUNT
            and distinct_count == len(EXPECTED_KEYS) * FRAME_COUNT
        )
        height_pass = candidate["gates"]["bodyHeightAndScale"]
        root_feet_pass = candidate["gates"]["rootFeet"]
        rig_valid_rows = sum(
            row.get("compilerRigEvidence", {}).get("status") == "valid"
            for row in rows.values()
        )
        rig_authorities = sorted(
            {
                row.get("compilerRigEvidence", {}).get("authority")
                for row in rows.values()
                if row.get("compilerRigEvidence", {}).get("authority")
            }
        )
        phase_detail = "; ".join(
            f"{item['family']} {item['status']}"
            for item in candidate["phase"]["leftRightSimilarity"]
        )
        authored_phase = candidate["phase"]["authoredContract"]
        phase_detail = (
            f"{authored_phase['validRows']}/{authored_phase['expectedRows']} "
            f"authored rows; {phase_detail}"
        )
        socket_detail = (
            f"{candidate['sockets']['rowsWithSocketMetadata']}/"
            f"{candidate['sockets']['expectedRows']} rows"
        )
        reproducible = candidate["reproducibility"]["passed"]
        style = candidate["paintedStyle"]
        style_detail = (
            f"Raster cue {style['paintedRows']}/{style['expectedRows']} painted; "
            "human paint/style review required"
        )
        rig_detail = (
            f"{rig_valid_rows}/{len(EXPECTED_KEYS)} hash-tied compiler rows"
            + (
                f" ({', '.join(rig_authorities)})"
                if rig_authorities
                else ""
            )
        )
        body_detail = (
            f"{rig_detail}; ≤2 px within/across views and actions"
            if height_pass is not None
            else f"{rig_detail}; compiler body evidence unavailable"
        )
        root_detail = (
            f"{rig_detail}; compiler ground/root ≤1 px"
            if root_feet_pass is not None
            else f"{rig_detail}; compiler ground/root evidence unavailable"
        )
        candidates[candidate_ids[label]] = {
            "code": label,
            "directory": candidate["directory"],
            "proofs": {
                "contact": f"candidate-{label.lower()}-contact.png",
                "animated": f"candidate-{label.lower()}-beats.gif",
            },
            "gates": {
                "completeRows": ui_gate(
                    candidate["rowCount"] == candidate["expectedRowCount"]
                    and not candidate["missingRows"]
                    and not candidate["discoveryIssues"],
                    f"{candidate['rowCount']}/{candidate['expectedRowCount']} rows",
                ),
                "dimensions": ui_gate(
                    dimension_pass,
                    f"{FRAME_COUNT} x {FRAME_WIDTH}x{FRAME_HEIGHT} RGBA frames",
                ),
                "nonblankFrames": ui_gate(
                    frame_contract_pass,
                    f"{nonblank_count}/128 nonblank; {distinct_count}/128 distinct",
                ),
                "bodyHeight": ui_gate(
                    height_pass,
                    body_detail,
                ),
                "rootFeet": ui_gate(
                    root_feet_pass,
                    root_detail,
                ),
                "directionPhase": ui_gate(
                    candidate["phase"]["passes"],
                    phase_detail,
                ),
                "sockets": ui_gate(
                    candidate["sockets"]["passesLe1"],
                    socket_detail,
                ),
                "reproducible": ui_gate(
                    reproducible,
                    candidate["reproducibility"]["status"],
                ),
                # These are visual review decisions. Mechanical measurements
                # must never promote them to a pass.
                "identity": ui_gate(
                    None,
                    f"Pending blind 1× identity review; {style_detail}",
                ),
                "occlusion": ui_gate(None, "Pending seam/occlusion review"),
                "paintedStyle": ui_gate(None, style_detail),
            },
            "paintedStyleSignals": style,
            "overallAccepted": False,
        }
    return {
        "schema": "realm.actor-pose-prototype.ui-comparison/v1",
        "summary": (
            "Hash-tied rig evidence and flattened-raster warnings loaded. "
            "Identity, occlusion, and paint/style remain mandatory human reviews; "
            "no candidate is promoted."
        ),
        "candidates": candidates,
    }


def validate_report_dir(path: Path) -> Path:
    resolved = path.resolve()
    if resolved != REPORT_ROOT.resolve():
        raise SystemExit(
            "Prototype reports are intentionally isolated; --reports-dir must resolve "
            f"to {repository_path(REPORT_ROOT)}"
        )
    return resolved


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--a", type=Path, help="Candidate A directory")
    parser.add_argument("--b", type=Path, help="Candidate B directory")
    parser.add_argument("--c", type=Path, help="Candidate C directory")
    parser.add_argument(
        "--root",
        type=Path,
        help=(
            "Prototype root containing output/a-layered2d, "
            "output/b-orthographic3d, and output/c-row-factory"
        ),
    )
    parser.add_argument("--reports-dir", type=Path, default=REPORT_ROOT)
    parser.add_argument(
        "--fail-on-acceptance",
        action="store_true",
        help="Exit nonzero when any evaluated candidate misses an RFC gate.",
    )
    args = parser.parse_args()
    requested = {
        label: path
        for label, path in (("A", args.a), ("B", args.b), ("C", args.c))
        if path is not None
    }
    if args.root is not None:
        prototype_root = args.root.resolve()
        if prototype_root != PROTOTYPE_ROOT.resolve():
            raise SystemExit(
                "--root must resolve to the isolated actor-pose prototype: "
                f"{repository_path(PROTOTYPE_ROOT)}"
            )
        for label, candidate_id in (
            ("A", "a-layered2d"),
            ("B", "b-orthographic3d"),
            ("C", "c-row-factory"),
        ):
            candidate_path = prototype_root / "output" / candidate_id
            if candidate_path.is_dir():
                requested.setdefault(label, candidate_path)
    if not requested:
        parser.error("provide at least one of --a, --b, or --c")
    reports_dir = validate_report_dir(args.reports_dir)
    reports_dir.mkdir(parents=True, exist_ok=True)
    for name in EVALUATOR_REPORT_NAMES:
        (reports_dir / name).unlink(missing_ok=True)

    report = {
        "schema": "realm.actor-pose-prototype.evaluation/v1",
        "contract": {
            "frame": {
                "width": FRAME_WIDTH,
                "height": FRAME_HEIGHT,
                "count": FRAME_COUNT,
                "rowWidth": ROW_WIDTH,
                "mode": "RGBA",
            },
            "expectedRows": list(EXPECTED_KEYS),
            "thresholds": {
                "rootFeetVerticalDriftPx": 1,
                "denseBodyHeightRangePx": 2,
                "crossDirectionDenseBodyMedianDeltaPx": 2,
                "crossActionDenseBodyMedianDeltaPx": 2,
                "socketResidualPx": 1,
            },
        },
        "candidates": {},
        "limitations": [
            "Flattened-raster body, root, and feet measurements are warning proxies, not acceptance authority.",
            "Left/right silhouette similarity cannot prove four-view semantic phase; decisive contradictions block review approval.",
            "Identity, seam/occlusion, and paint/style quality are unresolved mandatory human gates.",
            "Authoring time and runtime actor profiles are outside this evaluator.",
        ],
    }
    contacts: dict[str, Image.Image] = {}
    structural_failures = []
    acceptance_failures = []
    for label in LABEL_ORDER:
        candidate_path = requested.get(label)
        if candidate_path is None:
            continue
        resolved = candidate_path.resolve()
        if not resolved.is_dir():
            raise SystemExit(f"Candidate {label} directory is missing: {resolved}")
        candidate_result, images = evaluate_candidate(label, resolved)
        report["candidates"][label] = candidate_result
        contacts[label] = render_contact(
            label,
            images,
            reports_dir / f"candidate-{label.lower()}-contact.png",
        )
        render_animated_matrix(
            label,
            images,
            reports_dir / f"candidate-{label.lower()}-beats.gif",
        )
        if not candidate_result["gates"]["structural"]:
            structural_failures.append(label)
        if not candidate_result["gates"]["overall"]:
            acceptance_failures.append(label)

    render_comparison(contacts, reports_dir / "comparison-contact.png")
    write_json(reports_dir / "evaluation.json", report)
    write_json(reports_dir / "comparison.json", make_ui_comparison(report))
    write_markdown(report, reports_dir / "evaluation.md")
    proof_files = {
        name: sha256_file(reports_dir / name)
        for name in EVALUATOR_REPORT_NAMES
        if (reports_dir / name).is_file()
    }
    print(
        f"[actor-pose:evaluate] evaluated {', '.join(report['candidates'])}; "
        f"wrote {len(proof_files)} deterministic report/proof files; "
        f"tree sha256 {tree_hash(proof_files)}"
    )
    for label, candidate in report["candidates"].items():
        gates = candidate["gates"]
        print(
            f"[actor-pose:evaluate] {label}: "
            f"rows {candidate['rowCount']}/{candidate['expectedRowCount']}; "
            f"structural={format_bool(gates['structural'])}; "
            f"body/root/feet={format_bool(gates['bodyRootFeetAndScale'])}; "
            f"phase={format_bool(gates['phase'])}; "
            f"sockets={format_bool(gates['sockets'])}; "
            f"overall={format_bool(gates['overall'])}"
        )
    if structural_failures:
        raise SystemExit(
            "structural candidate failure(s): " + ", ".join(structural_failures)
        )
    if args.fail_on_acceptance and acceptance_failures:
        raise SystemExit(
            "candidate(s) miss RFC acceptance: " + ", ".join(acceptance_failures)
        )


if __name__ == "__main__":
    main()
