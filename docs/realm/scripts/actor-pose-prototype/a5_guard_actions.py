#!/usr/bin/env python3
"""Compile one coherent four-action, four-direction Realm guard family.

A5 keeps the A4 watchman identity, watch-blue garment, cargo, scale, and
directional component authorities.  It adds authored idle, counter-swing walk,
and short-sword work clips so the guard no longer changes art systems between
actions.  Modular joints and attachments remain offline authoring controls;
the runtime receives ordinary flattened, exact-size raster rows.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import io
import json
import math
import shutil
import statistics
import sys
import tempfile
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import a4_guard_family as a4  # noqa: E402
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
    png,
    quantize,
    semantic_plane,
    strip,
    trim,
)
from a3_factorial import (  # noqa: E402
    RUNTIME_STYLE,
    RUNTIME_TIERS,
    apply_runtime_style,
    derive_runtime_palette,
    palette_swatch,
    runtime_row,
)
from sprite_row_quality import analyze_row, write_proof  # noqa: E402


PROTO = ROOT / "assets/sprites/prototypes/actor-pose"
SOURCE = PROTO / "source/a5-guard-actions"
OUT = PROTO / "output/a5-guard-actions"
CONTRACT_PATH = SOURCE / "parts.json"
A4_SOURCE = PROTO / "source/a4-guard-family"
ACTIONS = ("idle", "walk", "work", "carry")
DIRECTIONS = ("down", "up", "left", "right")
IDENTITY = "watchman"
GARMENT = "watch-blue"
WEAPON_COLOR = (233, 194, 76, 255)
PHASES = {
    "idle": (
        "settle",
        "inhale-a",
        "inhale-b",
        "high-hold",
        "exhale-a",
        "exhale-b",
        "low-hold",
        "return",
    ),
    "work": (
        "ready",
        "gather",
        "lift",
        "strike",
        "extension",
        "follow-through",
        "recover",
        "settle",
    ),
}
RENDER_PROFILE = {
    "identity_leg_far_width": 7.5,
    "identity_leg_near_width": 8.8,
    "garment_leg_far_width": 8.7,
    "garment_leg_near_width": 10.0,
    "identity_torso_size": [26, 31],
    "garment_tunic_size": [30, 34],
    "garment_belt_size": [27, 5],
    "identity_head_size": [24, 24],
    "garment_headgear_size": [28, 22],
}


def file_sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_inputs(
    source_dir: Path,
) -> tuple[
    dict[str, Any],
    dict[str, Any],
    dict[str, Image.Image],
    dict[str, Any],
    Image.Image,
    dict[str, dict[str, Any]],
]:
    contract_path = source_dir / "parts.json"
    contract = json.loads(contract_path.read_text())
    if contract.get("schema") != "realm.actor-pose.a5-guard-actions.v1":
        raise A2Error("A5 parts contract must be v1")
    if contract.get("stage") != "guard-four-action-family":
        raise A2Error("A5 contract stage changed")
    scope = contract.get("scope", {})
    if tuple(scope.get("actions", [])) != ACTIONS:
        raise A2Error("A5 must declare four ordered actions")
    if tuple(scope.get("directions", [])) != DIRECTIONS:
        raise A2Error("A5 must declare four ordered directions")

    shared = contract["shared_parts"]
    shared_path = ROOT / shared["path"]
    if file_sha(shared_path) != shared["sha256"]:
        raise A2Error("A5 shared A4 parts contract hash changed")
    base_contract, sheets, pose, files = a4.load_inputs(A4_SOURCE)

    weapon_record = contract["weapon"]
    weapon_path = ROOT / weapon_record["path"]
    weapon_data = weapon_path.read_bytes()
    if digest(weapon_data) != weapon_record["sha256"]:
        raise A2Error("A5 weapon source hash changed")
    weapon_sheet = Image.open(io.BytesIO(weapon_data)).convert("RGBA")
    for direction in DIRECTIONS:
        box = weapon_record["parts"][direction]
        if len(box) != 4:
            raise A2Error(f"A5 weapon/{direction} crop is malformed")
        crop = weapon_sheet.crop(tuple(box))
        if a4.alpha_bbox(crop) is None:
            raise A2Error(f"A5 weapon/{direction} crop is blank")

    prompt_path = ROOT / weapon_record["source_prompt"]
    prompt = json.loads(prompt_path.read_text())
    if prompt.get("alpha_sha256") != weapon_record["sha256"]:
        raise A2Error("A5 weapon prompt provenance hash changed")
    for path, owner in (
        (contract_path, "action-family-contract"),
        (shared_path, "shared-a4-parts-contract"),
        (weapon_path, "painted-weapon-source"),
        (prompt_path, "imagegen-provenance"),
        (Path(__file__), "compiler-source"),
        (
            ROOT / "scripts/actor-pose-prototype/a4_guard_family.py",
            "shared-direction-compiler",
        ),
        (
            ROOT / "scripts/actor-pose-prototype/a2_layered2d.py",
            "shared-joint-compiler",
        ),
        (
            ROOT / "scripts/actor-pose-prototype/a3_factorial.py",
            "shared-runtime-style-compiler",
        ),
        (ROOT / "scripts/sprite_row_quality.py", "quality-gate-source"),
    ):
        data = path.read_bytes()
        files[path.relative_to(ROOT).as_posix()] = {
            "sha256": digest(data),
            "bytes": len(data),
            "owner": owner,
        }
    return contract, base_contract, sheets, pose, weapon_sheet, files


def set_leg(
    frame: dict[str, Any],
    side: str,
    *,
    hip: tuple[int, int],
    knee: tuple[int, int],
    ankle: tuple[int, int],
    heel: tuple[int, int],
    toe: tuple[int, int],
) -> None:
    frame[side] = {
        "hip": list(hip),
        "knee": list(knee),
        "ankle": list(ankle),
        "heel": list(heel),
        "toe": list(toe),
        "sole_run": [min(heel[0], toe[0]), max(heel[0], toe[0])],
        "foot_state": "planted",
    }


def side_stance(
    base: dict[str, Any],
    index: int,
    action: str,
) -> dict[str, Any]:
    frame = copy.deepcopy(base)
    body_tracks = {
        "idle": (0, 0, -1, -1, 0, 0, 1, 1),
        "work": (0, 0, -1, -1, 0, 0, 0, 0),
    }
    dy = body_tracks[action][index]
    frame.update(
        {
            "frame": index,
            "phase": PHASES[action][index],
            "body_dy": dy,
            "contacts": ["near", "far"],
            "head": [33 + (0, 1, 1, 0, -1, 0, 0, 1)[index], 16 + dy],
            "torso": [32, 38 + dy],
            "pelvis": [32, 53 + dy],
        }
    )
    set_leg(
        frame,
        "near",
        hip=(34, 53 + dy),
        knee=(36, 65 + round(dy / 2)),
        ankle=(37, 75),
        heel=(35, 79),
        toe=(40, 79),
    )
    set_leg(
        frame,
        "far",
        hip=(30, 52 + dy),
        knee=(28, 64 + round(dy / 2)),
        ankle=(27, 75),
        heel=(24, 79),
        toe=(29, 79),
    )
    frame["shoulders"] = {
        "near": [34, 32 + dy],
        "far": [30, 33 + dy],
    }
    if action == "idle":
        near_hand = [
            (36, 51),
            (37, 50),
            (36, 49),
            (35, 49),
            (35, 51),
            (36, 52),
            (37, 53),
            (37, 52),
        ][index]
        far_hand = [
            (30, 50),
            (29, 49),
            (30, 48),
            (31, 49),
            (31, 50),
            (30, 51),
            (29, 52),
            (30, 51),
        ][index]
        frame["elbows"] = {
            "near": [37, 42 + dy],
            "far": [28, 42 + dy],
        }
        frame["wrists"] = {
            "near": [near_hand[0], near_hand[1] - 3],
            "far": [far_hand[0], far_hand[1] - 3],
        }
        frame["hands"] = {
            "near": list(near_hand),
            "far": list(far_hand),
        }
    else:
        near_hands = (
            (36, 48),
            (34, 45),
            (33, 38),
            (37, 41),
            (38, 45),
            (37, 48),
            (34, 50),
            (36, 49),
        )
        far_hands = (
            (30, 48),
            (31, 46),
            (32, 44),
            (32, 44),
            (31, 47),
            (30, 49),
            (29, 50),
            (30, 49),
        )
        frame["hands"] = {
            "near": list(near_hands[index]),
            "far": list(far_hands[index]),
        }
        frame["elbows"] = {
            side: [
                round(
                    (2 * frame["shoulders"][side][axis]
                     + frame["hands"][side][axis])
                    / 3
                )
                for axis in (0, 1)
            ]
            for side in ("near", "far")
        }
        frame["wrists"] = {
            side: [
                round(
                    (frame["shoulders"][side][axis]
                     + 2 * frame["hands"][side][axis])
                    / 3
                )
                for axis in (0, 1)
            ]
            for side in ("near", "far")
        }
        weapon_vectors = (
            (8, -15),
            (3, -20),
            (10, -19),
            (19, -12),
            (21, -2),
            (18, 9),
            (10, 13),
            (8, -15),
        )
        frame["weapon_vector"] = list(weapon_vectors[index])
    frame["sockets"] = {
        "right_hand": list(frame["hands"]["near"]),
        "left_hand": list(frame["hands"]["far"]),
        "load": [
            round((frame["hands"]["near"][0] + frame["hands"]["far"][0]) / 2),
            max(frame["hands"]["near"][1], frame["hands"]["far"][1]) + 2,
        ],
        "belt": [35, 51 + dy],
    }
    return frame


def cardinal_stance(
    direction: str,
    base: dict[str, Any],
    index: int,
    action: str,
) -> dict[str, Any]:
    body_tracks = {
        "idle": (0, 0, -1, -1, 0, 0, 1, 1),
        "work": (0, 0, -1, -1, 0, 0, 0, 0),
    }
    source = copy.deepcopy(base)
    source["frame"] = index
    source["body_dy"] = body_tracks[action][index]
    frame = a4.cardinal_pose(direction, source)
    frame["phase"] = PHASES[action][index]
    frame["contacts"] = ["near", "far"]
    dy = frame["body_dy"]
    near_x = 24 if direction == "down" else 40
    far_x = 40 if direction == "down" else 24
    head_dx = (0, 1, 1, 0, -1, 0, 0, 1)[index]
    frame["head"][0] = 32 + head_dx
    if action == "idle":
        hand_track = (0, -1, -2, -1, 0, 1, 2, 1)[index]
        frame["elbows"] = {
            "near": [near_x + (-1 if direction == "down" else 1), 42 + dy],
            "far": [far_x + (1 if direction == "down" else -1), 42 + dy],
        }
        frame["hands"] = {
            "near": [near_x + (hand_track // 2), 51 + dy + hand_track],
            "far": [far_x - (hand_track // 2), 51 + dy - hand_track],
        }
    else:
        if direction == "down":
            near_hands = (
                (27, 47),
                (26, 44),
                (25, 39),
                (27, 43),
                (28, 48),
                (29, 49),
                (29, 47),
                (27, 48),
            )
            far_hands = (
                (39, 49),
                (38, 47),
                (37, 44),
                (37, 44),
                (38, 47),
                (39, 50),
                (40, 51),
                (40, 50),
            )
            weapon_vectors = (
                (7, -14),
                (2, -18),
                (-7, -15),
                (-4, 5),
                (0, 21),
                (6, 15),
                (8, 5),
                (7, -14),
            )
        else:
            near_hands = (
                (37, 49),
                (38, 47),
                (39, 42),
                (37, 39),
                (36, 43),
                (35, 46),
                (35, 48),
                (37, 49),
            )
            far_hands = (
                (25, 49),
                (26, 47),
                (27, 44),
                (27, 44),
                (26, 47),
                (25, 50),
                (24, 51),
                (24, 50),
            )
            weapon_vectors = (
                (-7, 14),
                (-2, 18),
                (7, 15),
                (4, -5),
                (0, -22),
                (-6, -15),
                (-8, -5),
                (-7, 14),
            )
        frame["hands"] = {
            "near": list(near_hands[index]),
            "far": list(far_hands[index]),
        }
        frame["elbows"] = {
            "near": [
                round((frame["shoulders"]["near"][0] + near_hands[index][0]) / 2),
                round((frame["shoulders"]["near"][1] + near_hands[index][1]) / 2),
            ],
            "far": [
                round((frame["shoulders"]["far"][0] + far_hands[index][0]) / 2),
                round((frame["shoulders"]["far"][1] + far_hands[index][1]) / 2),
            ],
        }
        frame["weapon_vector"] = list(weapon_vectors[index])
    if action == "work":
        # Three evenly spaced arm segments avoid collapsing a forearm when a
        # raised hand passes close to its shoulder during the sword lift.
        frame["elbows"] = {
            side: [
                round(
                    (2 * frame["shoulders"][side][axis]
                     + frame["hands"][side][axis])
                    / 3
                )
                for axis in (0, 1)
            ]
            for side in ("near", "far")
        }
        frame["wrists"] = {
            side: [
                round(
                    (frame["shoulders"][side][axis]
                     + 2 * frame["hands"][side][axis])
                    / 3
                )
                for axis in (0, 1)
            ]
            for side in ("near", "far")
        }
    else:
        frame["wrists"] = {
            side: [
                round((frame["elbows"][side][0] + frame["hands"][side][0]) / 2),
                round((frame["elbows"][side][1] + frame["hands"][side][1]) / 2),
            ]
            for side in ("near", "far")
        }
    frame["sockets"] = {
        "right_hand": list(frame["hands"]["near"]),
        "left_hand": list(frame["hands"]["far"]),
        "load": [32, 52 + dy],
        "belt": [32, 51 + dy],
    }
    return frame


def walk_pose(
    direction: str,
    base: dict[str, Any],
) -> dict[str, Any]:
    if direction == "left":
        right = walk_pose("right", base)
        reflected = a4.reflected_side_pose(right)
        reflected["direction"] = "left"
        return reflected
    if direction == "right":
        frame = copy.deepcopy(base)
        swing = (-5, -3, 0, 4, 5, 3, 0, -4)[frame["frame"]]
        dy = frame["body_dy"]
        frame["shoulders"] = {
            "near": [34, 32 + dy],
            "far": [30, 33 + dy],
        }
        frame["hands"] = {
            "near": [35 + swing, 50 + dy - abs(swing) // 3],
            "far": [29 - swing, 50 + dy - abs(swing) // 3],
        }
        frame["elbows"] = {
            side: [
                round((frame["shoulders"][side][0] + frame["hands"][side][0]) / 2),
                round((frame["shoulders"][side][1] + frame["hands"][side][1]) / 2),
            ]
            for side in ("near", "far")
        }
        frame["wrists"] = {
            side: [
                round((frame["elbows"][side][0] + frame["hands"][side][0]) / 2),
                round((frame["elbows"][side][1] + frame["hands"][side][1]) / 2),
            ]
            for side in ("near", "far")
        }
        frame["sockets"] = {
            "right_hand": list(frame["hands"]["near"]),
            "left_hand": list(frame["hands"]["far"]),
            "load": [32, 52 + dy],
            "belt": [35, 51 + dy],
        }
        return frame

    frame = a4.cardinal_pose(direction, base)
    swing = (-3, -2, 0, 2, 3, 2, 0, -2)[frame["frame"]]
    dy = frame["body_dy"]
    near_x = 24 if direction == "down" else 40
    far_x = 40 if direction == "down" else 24
    frame["hands"] = {
        "near": [near_x + (1 if swing > 0 else -1), 50 + dy + swing],
        "far": [far_x - (1 if swing > 0 else -1), 50 + dy - swing],
    }
    frame["elbows"] = {
        side: [
            round((frame["shoulders"][side][0] + frame["hands"][side][0]) / 2),
            round((frame["shoulders"][side][1] + frame["hands"][side][1]) / 2),
        ]
        for side in ("near", "far")
    }
    frame["wrists"] = {
        side: [
            round((frame["elbows"][side][0] + frame["hands"][side][0]) / 2),
            round((frame["elbows"][side][1] + frame["hands"][side][1]) / 2),
        ]
        for side in ("near", "far")
    }
    frame["sockets"] = {
        "right_hand": list(frame["hands"]["near"]),
        "left_hand": list(frame["hands"]["far"]),
        "load": [32, 52 + dy],
        "belt": [32, 51 + dy],
    }
    return frame


def action_pose(
    action: str,
    direction: str,
    base: dict[str, Any],
) -> dict[str, Any]:
    if action == "carry":
        if direction == "right":
            return copy.deepcopy(base)
        if direction == "left":
            return a4.reflected_side_pose(base)
        return a4.cardinal_pose(direction, base)
    if action == "walk":
        return walk_pose(direction, base)
    if direction == "right":
        return side_stance(base, base["frame"], action)
    if direction == "left":
        right = side_stance(base, base["frame"], action)
        frame = a4.reflected_side_pose(right)
        if "weapon_vector" in right:
            frame["weapon_vector"] = [-right["weapon_vector"][0], right["weapon_vector"][1]]
        return frame
    return cardinal_stance(direction, base, base["frame"], action)


def compose_body(
    parts: dict[str, Image.Image],
    pose_frame: dict[str, Any],
    direction: str,
) -> tuple[dict[str, Image.Image], dict[str, Any]]:
    if direction in ("left", "right"):
        result, metadata = compose_frame(parts, pose_frame, RENDER_PROFILE)
        metadata["direction"] = direction
        return result, metadata
    return a4.compose_cardinal_frame(parts, pose_frame, direction)


def weapon_component(
    weapon_sheet: Image.Image,
    contract: dict[str, Any],
    direction: str,
) -> Image.Image:
    return trim(weapon_sheet.crop(tuple(contract["weapon"]["parts"][direction])))


def rotated_weapon(
    component: Image.Image,
    socket: list[int],
    vector: list[int],
    contract: dict[str, Any],
) -> tuple[Image.Image, list[int]]:
    height = int(contract["weapon"]["authority"]["render_height"])
    width = max(3, round(component.width * height / component.height))
    scaled = component.resize((width, height), Image.Resampling.LANCZOS)
    pivot_fraction = float(
        contract["weapon"]["authority"]["hilt_fraction_from_top"]
    )
    work_size = 80
    center = work_size // 2
    pivot_y = round(height * pivot_fraction)
    work = Image.new("RGBA", (work_size, work_size), (0, 0, 0, 0))
    work.alpha_composite(
        scaled,
        (center - width // 2, center - pivot_y),
    )
    dx, dy = vector
    angle = math.degrees(math.atan2(-dx, -dy))
    turned = work.rotate(
        angle,
        resample=Image.Resampling.BICUBIC,
        expand=False,
        center=(center, center),
    )
    canvas = blank()
    canvas.alpha_composite(
        quantize(turned),
        (socket[0] - center, socket[1] - center),
    )
    blade_length = round(height * pivot_fraction)
    magnitude = max(1.0, math.hypot(dx, dy))
    tip = [
        round(socket[0] + dx * blade_length / magnitude),
        round(socket[1] + dy * blade_length / magnitude),
    ]
    return canvas, tip


def apply_weapon(
    result: dict[str, Image.Image],
    pose_frame: dict[str, Any],
    weapon_sheet: Image.Image,
    contract: dict[str, Any],
    direction: str,
) -> tuple[dict[str, Image.Image], list[int]]:
    component = weapon_component(weapon_sheet, contract, direction)
    socket = pose_frame["sockets"]["right_hand"]
    weapon, tip = rotated_weapon(
        component,
        socket,
        pose_frame["weapon_vector"],
        contract,
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
            for pixel in original_semantic.get_flattened_data()
        ]
    )
    near_surface = blank()
    near_surface.paste(original_flattened, (0, 0), near_mask)
    near_semantic = blank()
    near_semantic.paste(original_semantic, (0, 0), near_mask)
    flattened = original_flattened.copy()
    flattened.alpha_composite(weapon)
    flattened.alpha_composite(near_surface)
    semantic = original_semantic.copy()
    semantic.alpha_composite(semantic_plane(weapon, WEAPON_COLOR))
    semantic.alpha_composite(near_semantic)
    return {
        **result,
        "flattened": flattened,
        "attachment": weapon,
        "semantic": semantic,
    }, tip


def quality_for(
    row_bytes: bytes,
    relative: str,
    action: str,
    suffix: str,
) -> tuple[dict[str, Any], bytes]:
    with tempfile.TemporaryDirectory(prefix=f"realm-a5-{suffix}-") as temp:
        temp_path = Path(temp)
        row_path = temp_path / "row.png"
        proof_path = temp_path / "proof.png"
        row_path.write_bytes(row_bytes)
        quality = analyze_row(row_path, action)
        quality["path"] = relative
        quality["measurement"] = suffix
        write_proof(row_path, proof_path, quality)
        return quality, proof_path.read_bytes()


def socket_has_alpha(
    equipment: Image.Image,
    socket: list[int],
    radius: int = 2,
) -> bool:
    alpha = equipment.getchannel("A")
    return any(
        alpha.getpixel((x, y)) >= 18
        for y in range(max(0, socket[1] - radius), min(H, socket[1] + radius + 1))
        for x in range(max(0, socket[0] - radius), min(W, socket[0] + radius + 1))
    )


def validate_row(
    action: str,
    direction: str,
    frames: list[Image.Image],
    body_frames: list[Image.Image],
    equipment_frames: list[Image.Image],
    landmarks: list[dict[str, Any]],
    quality: dict[str, Any],
    body_quality: dict[str, Any],
) -> dict[str, Any]:
    failures: list[str] = []
    frame_metrics: list[dict[str, Any]] = []
    hashes = [digest(frame.tobytes()) for frame in frames]
    body_heights: list[int] = []
    if len(set(hashes)) != BEATS:
        failures.append("row does not contain eight distinct frames")
    for index, (frame, body, equipment, info) in enumerate(
        zip(frames, body_frames, equipment_frames, landmarks)
    ):
        box = a4.alpha_bbox(frame)
        body_box = a4.alpha_bbox(body)
        equipment_box = a4.alpha_bbox(equipment)
        if box is None or body_box is None:
            failures.append(f"frame {index} is blank")
            continue
        body_height = body_box[3] - body_box[1]
        body_heights.append(body_height)
        runs = a4.visible_runs(body, GROUND_Y)
        expected_runs = sorted(
            value
            for side in ("far", "near")
            if (value := info[side].get("sole_run")) is not None
        )
        if runs != expected_runs:
            failures.append(
                f"frame {index} ground runs {runs} != {expected_runs}"
            )
        if body_box[3] - 1 != GROUND_Y:
            failures.append(f"frame {index} does not register on y={GROUND_Y}")
        if not 75 <= body_height <= 77:
            failures.append(
                f"frame {index} body height {body_height}px is outside 76±1"
            )
        if box[0] <= 1 or box[2] >= W - 1 or box[1] <= 1:
            failures.append(f"frame {index} enters the edge safety band")
        if any(
            frame.getchannel("A").getpixel((x, y)) >= 18
            for y in range(80, H)
            for x in range(W)
        ):
            failures.append(f"frame {index} occupies a reserved clear row")
        if info["root"] != [32, GROUND_Y]:
            failures.append(f"frame {index} root drifted")

        expected_equipment = action in ("work", "carry")
        if expected_equipment != (equipment_box is not None):
            failures.append(
                f"frame {index} equipment state does not match {action}"
            )
        if action == "work":
            socket = info["sockets"]["right_hand"]
            if not socket_has_alpha(equipment, socket):
                failures.append(
                    f"frame {index} sword hilt left the right-hand socket"
                )
            tip = info.get("weapon_tip")
            if tip is None:
                failures.append(f"frame {index} lacks weapon-tip metadata")
            elif index == 4:
                if direction == "right" and tip[0] <= socket[0]:
                    failures.append("right thrust does not point right")
                if direction == "left" and tip[0] >= socket[0]:
                    failures.append("left thrust does not point left")
                if direction == "down" and tip[1] <= socket[1]:
                    failures.append("down thrust does not point down")
                if direction == "up" and tip[1] >= socket[1]:
                    failures.append("up thrust does not point up")
        frame_metrics.append(
            {
                "frame": index,
                "phase": info["phase"],
                "body_bbox": list(body_box),
                "flattened_bbox": list(box),
                "equipment_bbox": (
                    list(equipment_box) if equipment_box else None
                ),
                "body_height": body_height,
                "ground_runs": runs,
                "contacts": info["contacts"],
                "right_hand": info["sockets"]["right_hand"],
                "weapon_tip": info.get("weapon_tip"),
                "sha256_rgba": hashes[index],
            }
        )
    if body_heights and statistics.median(body_heights) != 76:
        failures.append(
            f"median body height {statistics.median(body_heights)}px != 76px"
        )
    for label, report in (("flattened", quality), ("body", body_quality)):
        failures.extend(
            f"{label} quality: {failure}"
            for failure in report["errors"] + report["warnings"]
        )
        if report.get("styleEra") != "painted":
            failures.append(
                f"{label} quality: classified as "
                f"{report.get('styleEra')}, not painted"
            )
    return {
        "schema": "realm.actor-pose.a5-row-gate.v1",
        "scope": {
            "identity": IDENTITY,
            "garment": GARMENT,
            "action": action,
            "direction": direction,
        },
        "frame_metrics": frame_metrics,
        "body_heights": body_heights,
        "production_quality": {
            "flattened": {
                "style_era": quality.get("styleEra"),
                "median_body_height": quality.get("medianBodyHeight"),
                "body_height_range": quality.get("bodyHeightRange"),
                "body_width_range": quality.get("bodyWidthRange"),
                "flicker_score": quality.get("flickerScore"),
                "warnings": quality.get("warnings"),
                "errors": quality.get("errors"),
            },
            "body": {
                "style_era": body_quality.get("styleEra"),
                "median_body_height": body_quality.get("medianBodyHeight"),
                "body_height_range": body_quality.get("bodyHeightRange"),
                "body_width_range": body_quality.get("bodyWidthRange"),
                "flicker_score": body_quality.get("flickerScore"),
                "warnings": body_quality.get("warnings"),
                "errors": body_quality.get("errors"),
            },
        },
        "mechanical_passed": not failures,
        "failures": failures,
    }


def build_row(
    contract: dict[str, Any],
    base_contract: dict[str, Any],
    sheets: dict[str, Image.Image],
    pose: dict[str, Any],
    weapon_sheet: Image.Image,
    action: str,
    direction: str,
) -> tuple[dict[str, bytes], dict[str, Any], dict[str, Image.Image]]:
    parts = a4.source_parts_for(base_contract, sheets, direction)
    frames: list[Image.Image] = []
    body_frames: list[Image.Image] = []
    landmarks: list[dict[str, Any]] = []
    plane_frames: dict[str, list[Image.Image]] = {
        name: []
        for name in ("identity", "garment", "attachment", "semantic")
    }
    for base_frame in pose["frames"]:
        pose_frame = action_pose(action, direction, base_frame)
        result, metadata = compose_body(parts, pose_frame, direction)
        body = result["flattened"].copy()
        if action == "carry":
            result = a4.apply_attachment(
                result,
                pose_frame,
                sheets["attachment"],
                base_contract,
                direction,
            )
        elif action == "work":
            result, tip = apply_weapon(
                result,
                pose_frame,
                weapon_sheet,
                contract,
                direction,
            )
            metadata["weapon_tip"] = tip
            metadata["weapon_vector"] = list(pose_frame["weapon_vector"])
        frames.append(result["flattened"])
        body_frames.append(body)
        landmarks.append(metadata)
        for name in plane_frames:
            plane_frames[name].append(result[name])

    row = strip(frames)
    body_row = strip(body_frames)
    prefix = f"{IDENTITY}/{GARMENT}/{action}-{direction}"
    row_relative = f"rows/{prefix}.png"
    body_relative = f"planes/body/{prefix}.png"
    row_bytes = png(row)
    body_bytes = png(body_row)
    quality, quality_proof = quality_for(
        row_bytes,
        row_relative,
        action,
        "flattened",
    )
    body_quality, body_proof = quality_for(
        body_bytes,
        body_relative,
        action,
        "body",
    )
    gate = validate_row(
        action,
        direction,
        frames,
        body_frames,
        plane_frames["attachment"],
        landmarks,
        quality,
        body_quality,
    )
    runtime_paths = {
        tier: f"rows-runtime/{tier}/{prefix}.png"
        for tier, _frame_w, _frame_h in RUNTIME_TIERS
    }
    artifacts = {
        row_relative: row_bytes,
        body_relative: body_bytes,
        **{
            runtime_paths[tier]: png(runtime_row(frames, (frame_w, frame_h)))
            for tier, frame_w, frame_h in RUNTIME_TIERS
        },
        f"planes/identity/{prefix}.png": png(strip(plane_frames["identity"])),
        f"planes/garment/{prefix}.png": png(strip(plane_frames["garment"])),
        f"planes/equipment/{prefix}.png": png(strip(plane_frames["attachment"])),
        f"id-masks/{prefix}.png": png(strip(plane_frames["semantic"])),
        f"landmarks/{prefix}.json": canonical(
            {
                "schema": "realm.actor-pose.a5-landmarks.v1",
                "scope": gate["scope"],
                "frames": landmarks,
            }
        ),
        f"reports/quality/{action}-{direction}.json": canonical(quality),
        f"reports/quality-body/{action}-{direction}.json": canonical(body_quality),
        f"proof/quality/{action}-{direction}-x4.png": quality_proof,
        f"proof/quality-body/{action}-{direction}-x4.png": body_proof,
    }
    record = {
        "scope": gate["scope"],
        "row": row_relative,
        "runtime_rows": runtime_paths,
        "body_plane": body_relative,
        "identity_plane": f"planes/identity/{prefix}.png",
        "garment_plane": f"planes/garment/{prefix}.png",
        "equipment_plane": f"planes/equipment/{prefix}.png",
        "semantic_mask": f"id-masks/{prefix}.png",
        "landmarks": f"landmarks/{prefix}.json",
        "quality_report": f"reports/quality/{action}-{direction}.json",
        "body_quality_report": f"reports/quality-body/{action}-{direction}.json",
        "quality_proof": f"proof/quality/{action}-{direction}-x4.png",
        "body_quality_proof": f"proof/quality-body/{action}-{direction}-x4.png",
        "gate": gate,
    }
    images = {
        "row": row,
        "body": body_row,
        "equipment": strip(plane_frames["attachment"]),
    }
    return artifacts, record, images


def review_contact(
    records: dict[tuple[str, str], dict[str, Any]],
    images: dict[tuple[str, str], dict[str, Image.Image]],
) -> Image.Image:
    scale = 3
    label_h = 18
    keys = [(action, direction) for action in ACTIONS for direction in DIRECTIONS]
    result = Image.new(
        "RGBA",
        (ROW_W * scale, len(keys) * (H * scale + label_h)),
        "#0d1820ff",
    )
    draw = ImageDraw.Draw(result)
    for index, key in enumerate(keys):
        action, direction = key
        y = index * (H * scale + label_h)
        draw.text(
            (6, y + 3),
            f"guard / {action} / {direction}",
            fill="#dbe7eb",
        )
        enlarged = images[key]["row"].resize(
            (ROW_W * scale, H * scale),
            Image.Resampling.NEAREST,
        )
        result.alpha_composite(enlarged, (0, y + label_h))
    return result


def build(
    contract: dict[str, Any],
    base_contract: dict[str, Any],
    sheets: dict[str, Image.Image],
    pose: dict[str, Any],
    weapon_sheet: Image.Image,
) -> tuple[
    dict[str, bytes],
    dict[tuple[str, str], dict[str, Any]],
    dict[str, Any],
]:
    combinations = [
        (action, direction)
        for action in ACTIONS
        for direction in DIRECTIONS
    ]
    artifacts: dict[str, bytes] = {}
    records: dict[tuple[str, str], dict[str, Any]] = {}
    images: dict[tuple[str, str], dict[str, Image.Image]] = {}
    for action, direction in combinations:
        built, record, row_images = build_row(
            contract,
            base_contract,
            sheets,
            pose,
            weapon_sheet,
            action,
            direction,
        )
        artifacts.update(built)
        records[(action, direction)] = record
        images[(action, direction)] = row_images

    default_rows = [
        Image.open(
            io.BytesIO(
                artifacts[records[key]["runtime_rows"]["default"]]
            )
        ).convert("RGBA")
        for key in combinations
    ]
    palette, colors = derive_runtime_palette(default_rows)
    styled_default_rows: dict[tuple[str, str], Image.Image] = {}
    for key in combinations:
        for tier, relative in records[key]["runtime_rows"].items():
            raw = Image.open(io.BytesIO(artifacts[relative])).convert("RGBA")
            styled = apply_runtime_style(raw, palette)
            artifacts[relative] = png(styled)
            if tier == "default":
                styled_default_rows[key] = styled

    failures = [
        f"{action}/{direction}: {failure}"
        for (action, direction), record in sorted(records.items())
        for failure in record["gate"]["failures"]
    ]
    for action in ACTIONS:
        row_hashes = {
            digest(images[(action, direction)]["row"].tobytes())
            for direction in DIRECTIONS
        }
        if len(row_hashes) != len(DIRECTIONS):
            failures.append(f"{action} direction rows are not all distinct")
    for action in ACTIONS:
        heights = [
            statistics.median(
                records[(action, direction)]["gate"]["body_heights"]
            )
            for direction in DIRECTIONS
        ]
        if max(heights) - min(heights) > 1:
            failures.append(
                f"{action} cross-direction body height spread exceeds 1px"
            )
    for direction in DIRECTIONS:
        heights = [
            statistics.median(
                records[(action, direction)]["gate"]["body_heights"]
            )
            for action in ACTIONS
        ]
        if max(heights) - min(heights) > 1:
            failures.append(
                f"{direction} cross-action body height spread exceeds 1px"
            )
    if (
        images[("work", "left")]["row"].tobytes()
        == images[("work", "right")]["row"].transpose(
            Image.Transpose.FLIP_LEFT_RIGHT
        ).tobytes()
    ):
        failures.append("left work row is a forbidden finished-row mirror")

    styled_colors = {
        pixel[:3]
        for row in styled_default_rows.values()
        for pixel in row.get_flattened_data()
        if pixel[3]
    }
    styled_alpha = {
        pixel[3]
        for row in styled_default_rows.values()
        for pixel in row.get_flattened_data()
    }
    runtime_style = {
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
    if not runtime_style["mechanical_passed"]:
        failures.append("runtime style exceeded palette or alpha contract")
    gate = {
        "schema": "realm.actor-pose.a5-guard-actions-gate.v1",
        "scope": contract["scope"],
        "rows": len(combinations),
        "frames": len(combinations) * BEATS,
        "actions": list(ACTIONS),
        "directions": list(DIRECTIONS),
        "finished_row_mirroring": False,
        "runtime_style": runtime_style,
        "row_gates": {
            f"{action}/{direction}": records[(action, direction)]["gate"]
            for action, direction in combinations
        },
        "mechanical_passed": not failures,
        "failures": failures,
    }
    artifacts["proof/guard-four-actions-x3.png"] = png(
        review_contact(records, images)
    )
    artifacts["style/actor-palette.png"] = png(palette_swatch(colors))
    artifacts["style/actor-palette.json"] = canonical(
        {
            "schema": "realm.actor-pose.a5-runtime-palette.v1",
            **RUNTIME_STYLE,
            "colors": runtime_style["palette_hex"],
        }
    )
    artifacts["reports/guard-actions-gate.json"] = canonical(gate)
    return artifacts, records, gate


def manifest(
    files: dict[str, dict[str, Any]],
    artifacts: dict[str, bytes],
    records: dict[tuple[str, str], dict[str, Any]],
    gate: dict[str, Any],
    deterministic: bool,
) -> dict[str, Any]:
    return {
        "schema": "realm.actor-pose.a5-guard-actions-manifest.v1",
        "candidate": "a5-guard-actions",
        "stage": "guard-four-action-family",
        "status": (
            "action-family-proven"
            if gate["mechanical_passed"] and deterministic
            else "action-family-veto"
        ),
        "scope": {
            **gate["scope"],
            "flattened_rows": gate["rows"],
            "flattened_frames": gate["frames"],
            "frame_size": [W, H],
            "row_size": [ROW_W, H],
            "root": [32, GROUND_Y],
            "runtime": (
                "none; modular sources compile to flattened rows and "
                "prefiltered exact-size runtime tiers"
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
            "finished_frame_or_row_mirroring": False,
            "runtime_skeletal_renderer": False,
        },
        "outputs": {
            path: {"sha256": digest(data), "bytes": len(data)}
            for path, data in sorted(artifacts.items())
        },
        "rows": {
            f"{action}/{direction}": record
            for (action, direction), record in records.items()
        },
        "proof": {
            "action_family": "proof/guard-four-actions-x3.png",
            "runtime_palette": "style/actor-palette.png",
        },
        "verification": {
            "mechanical_passed": gate["mechanical_passed"],
            "byte_deterministic_second_pass": deterministic,
            "report": "reports/guard-actions-gate.json",
            "failures": gate["failures"],
        },
        "compiler": {
            "path": "scripts/actor-pose-prototype/a5_guard_actions.py",
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
        description="Compile the Realm A5 four-action guard family."
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
            base_contract,
            sheets,
            pose,
            weapon_sheet,
            files,
        ) = load_inputs(args.source_dir.resolve())
        artifacts, records, gate = build(
            contract,
            base_contract,
            sheets,
            pose,
            weapon_sheet,
        )
        second = (
            build(contract, base_contract, sheets, pose, weapon_sheet)
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
            raise A2Error("second in-memory A5 build differed")
        document = manifest(files, artifacts, records, gate, deterministic)
        write_output(args.out_dir.resolve(), artifacts, document)
        print(
            "A5 guard actions OK: "
            f"{gate['rows']} flattened rows / {gate['frames']} frames; "
            "one shared modular identity spans four actions and directions"
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
        print(f"A5 guard actions failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
