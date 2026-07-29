#!/usr/bin/env python3
"""Realm RFC 0002 Candidate B: deterministic orthographic 3D/2.5D bake.

This is deliberately an offline prototype compiler. It owns pose, projection,
depth, occlusion and sockets, then bakes flattened Canvas2D-compatible rows.
It does not import runtime code or mutate accepted actor sources/atlases.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
import shutil
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from statistics import median
from typing import Any, Iterable, Mapping, Sequence

import PIL
from PIL import Image, ImageDraw


COMPILER_VERSION = "1.0.0"
CANDIDATE = "b-orthographic3d"
ROLES_ACTIONS: Mapping[str, tuple[str, ...]] = {
    "guard": ("walk", "carry"),
    "builder": ("walk", "work"),
}
DIRECTIONS = ("down", "up", "left", "right")
LAYERS = ("rear", "body", "front")
Vec3 = tuple[float, float, float]
Color = tuple[int, int, int, int]


@dataclass(frozen=True)
class Projection:
    width: int
    height: int
    frames: int
    pixels_per_unit: float
    center_x: float
    ground_y: float
    supersample: int
    yaw_by_direction: Mapping[str, float]
    rear_threshold: float
    front_threshold: float


@dataclass(frozen=True)
class Primitive:
    kind: str
    points: tuple[Vec3, ...]
    radius: float
    color: Color
    outline: Color
    semantic: str
    category: str
    order: int


@dataclass(frozen=True)
class Pose:
    joints: Mapping[str, Vec3]
    sockets: Mapping[str, Vec3]
    contacts: tuple[str, ...]
    phase: float
    load: Vec3 | None
    tool_grip: Vec3 | None
    tool_tip: Vec3 | None
    lean: float


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def source_root() -> Path:
    return repo_root() / "assets/sprites/prototypes/actor-pose/source/orthographic3d"


def default_out_dir() -> Path:
    return repo_root() / "assets/sprites/prototypes/actor-pose/output/b-orthographic3d"


def read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def stable_digest(entries: Sequence[Mapping[str, Any]]) -> str:
    payload = "\n".join(
        f"{entry['path']}\0{entry['sha256']}\0{entry['bytes']}"
        for entry in sorted(entries, key=lambda item: item["path"])
    )
    return sha256_bytes(payload.encode("utf-8"))


def parse_hex(value: str) -> Color:
    raw = value.lstrip("#")
    if len(raw) != 6:
        raise ValueError(f"Expected #RRGGBB color, got {value!r}")
    return (int(raw[0:2], 16), int(raw[2:4], 16), int(raw[4:6], 16), 255)


def shade(color: Color, amount: float) -> Color:
    if amount >= 0:
        rgb = tuple(round(channel + (255 - channel) * amount) for channel in color[:3])
    else:
        rgb = tuple(round(channel * (1.0 + amount)) for channel in color[:3])
    return (rgb[0], rgb[1], rgb[2], color[3])


def vec_add(a: Vec3, b: Vec3) -> Vec3:
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def vec_sub(a: Vec3, b: Vec3) -> Vec3:
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def vec_mul(a: Vec3, scalar: float) -> Vec3:
    return (a[0] * scalar, a[1] * scalar, a[2] * scalar)


def vec_lerp(a: Vec3, b: Vec3, t: float) -> Vec3:
    return (
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t,
    )


def rotate_xy(point: Vec3, yaw: float) -> Vec3:
    cosine = math.cos(yaw)
    sine = math.sin(yaw)
    return (
        point[0] * cosine + point[1] * sine,
        -point[0] * sine + point[1] * cosine,
        point[2],
    )


def project(point: Vec3, yaw: float, projection: Projection) -> tuple[float, float, float]:
    rotated = rotate_xy(point, yaw)
    return (
        projection.center_x + rotated[0] * projection.pixels_per_unit,
        projection.ground_y - rotated[2] * projection.pixels_per_unit,
        rotated[1],
    )


def id_color(semantic: str) -> Color:
    digest = hashlib.sha256(("realm-id:" + semantic).encode("utf-8")).digest()
    return (
        48 + digest[0] % 192,
        48 + digest[1] % 192,
        48 + digest[2] % 192,
        255,
    )


def primitive_depth(primitive: Primitive, yaw: float) -> float:
    depths = [rotate_xy(point, yaw)[1] for point in primitive.points]
    return sum(depths) / len(depths)


def load_projection(config: Mapping[str, Any]) -> Projection:
    raw = config["projection"]
    views = config["views"]
    occlusion = config["occlusion"]
    return Projection(
        width=int(raw["frame_width"]),
        height=int(raw["frame_height"]),
        frames=int(raw["frames_per_row"]),
        pixels_per_unit=float(raw["pixels_per_unit"]),
        center_x=float(raw["screen_center_x"]),
        ground_y=float(raw["ground_y"]),
        supersample=int(raw["supersample"]),
        yaw_by_direction={
            name: math.radians(float(views[name]["yaw_degrees"])) for name in DIRECTIONS
        },
        rear_threshold=float(occlusion["rear_threshold"]),
        front_threshold=float(occlusion["front_threshold"]),
    )


class Scene:
    def __init__(self) -> None:
        self.primitives: list[Primitive] = []
        self.legend: dict[str, str] = {}

    def add(
        self,
        kind: str,
        points: Sequence[Vec3],
        radius: float,
        color: Color,
        outline: Color,
        semantic: str,
        category: str,
    ) -> None:
        previous = self.legend.setdefault(semantic, category)
        if previous != category:
            raise ValueError(f"Semantic {semantic!r} changed category")
        self.primitives.append(
            Primitive(
                kind=kind,
                points=tuple(points),
                radius=radius,
                color=color,
                outline=outline,
                semantic=semantic,
                category=category,
                order=len(self.primitives),
            )
        )

    def capsule(
        self,
        start: Vec3,
        end: Vec3,
        radius: float,
        color: Color,
        outline: Color,
        semantic: str,
        category: str = "body",
    ) -> None:
        self.add("capsule", (start, end), radius, color, outline, semantic, category)

    def sphere(
        self,
        center: Vec3,
        radius: float,
        color: Color,
        outline: Color,
        semantic: str,
        category: str = "body",
    ) -> None:
        self.add("sphere", (center,), radius, color, outline, semantic, category)

    def polygon(
        self,
        points: Sequence[Vec3],
        color: Color,
        outline: Color,
        semantic: str,
        category: str = "body",
    ) -> None:
        self.add("polygon", points, 0.0, color, outline, semantic, category)


def add_box(
    scene: Scene,
    center: Vec3,
    size: Vec3,
    color: Color,
    outline: Color,
    semantic: str,
    category: str,
) -> None:
    x, y, z = center
    hx, hy, hz = size[0] / 2.0, size[1] / 2.0, size[2] / 2.0
    corners = {
        "lbf": (x - hx, y + hy, z - hz),
        "rbf": (x + hx, y + hy, z - hz),
        "ltf": (x - hx, y + hy, z + hz),
        "rtf": (x + hx, y + hy, z + hz),
        "lbb": (x - hx, y - hy, z - hz),
        "rbb": (x + hx, y - hy, z - hz),
        "ltb": (x - hx, y - hy, z + hz),
        "rtb": (x + hx, y - hy, z + hz),
    }
    faces = (
        ("back", ("lbb", "rbb", "rtb", "ltb"), -0.16),
        ("left", ("lbb", "lbf", "ltf", "ltb"), -0.10),
        ("right", ("rbf", "rbb", "rtb", "rtf"), 0.06),
        ("bottom", ("lbb", "rbb", "rbf", "lbf"), -0.22),
        ("front", ("lbf", "rbf", "rtf", "ltf"), 0.02),
        ("top", ("ltf", "rtf", "rtb", "ltb"), 0.18),
    )
    for face, names, amount in faces:
        scene.polygon(
            [corners[name] for name in names],
            shade(color, amount),
            outline,
            f"{semantic}:{face}",
            category,
        )


def add_tapered_torso(
    scene: Scene,
    bottom_center: Vec3,
    top_center: Vec3,
    bottom_half_width: float,
    top_half_width: float,
    half_depth: float,
    color: Color,
    outline: Color,
    semantic: str,
) -> None:
    bx, by, bz = bottom_center
    tx, ty, tz = top_center
    corners = {
        "lbf": (bx - bottom_half_width, by + half_depth, bz),
        "rbf": (bx + bottom_half_width, by + half_depth, bz),
        "ltf": (tx - top_half_width, ty + half_depth, tz),
        "rtf": (tx + top_half_width, ty + half_depth, tz),
        "lbb": (bx - bottom_half_width, by - half_depth, bz),
        "rbb": (bx + bottom_half_width, by - half_depth, bz),
        "ltb": (tx - top_half_width, ty - half_depth, tz),
        "rtb": (tx + top_half_width, ty - half_depth, tz),
    }
    faces = (
        ("back", ("lbb", "rbb", "rtb", "ltb"), -0.15),
        ("left", ("lbb", "lbf", "ltf", "ltb"), -0.09),
        ("right", ("rbf", "rbb", "rtb", "rtf"), 0.07),
        ("front", ("lbf", "rbf", "rtf", "ltf"), 0.03),
        ("top", ("ltf", "rtf", "rtb", "ltb"), 0.16),
    )
    for face, names, amount in faces:
        scene.polygon(
            [corners[name] for name in names],
            shade(color, amount),
            outline,
            f"{semantic}:{face}",
            "body",
        )


def build_pose(
    role: str,
    action: str,
    beat: Mapping[str, Any],
    role_config: Mapping[str, Any],
) -> Pose:
    proportions = role_config["proportions"]
    pelvis_z = float(proportions["pelvis_z"])
    shoulder_z = float(proportions["shoulder_z"])
    neck_z = float(proportions["neck_z"])
    head_z = float(proportions["head_z"])
    hip_half = float(proportions["hip_width"]) / 2.0
    shoulder_half = float(proportions["shoulder_width"]) / 2.0
    lean = float(beat.get("lean", 0.0))

    left_stride = float(beat.get("left_stride", 0.06))
    right_stride = float(beat.get("right_stride", -0.06))
    left_lift = float(beat.get("left_lift", 0.0))
    right_lift = float(beat.get("right_lift", 0.0))

    foot_l = (-hip_half * 0.92, left_stride, left_lift)
    foot_r = (hip_half * 0.92, right_stride, right_lift)
    ankle_l = (foot_l[0], foot_l[1] - 0.02, foot_l[2] + 0.23)
    ankle_r = (foot_r[0], foot_r[1] - 0.02, foot_r[2] + 0.23)
    hip_l = (-hip_half, 0.0, pelvis_z)
    hip_r = (hip_half, 0.0, pelvis_z)
    knee_l = (
        (hip_l[0] + ankle_l[0]) / 2.0,
        left_stride * 0.52 + 0.08,
        0.78 + left_lift * 0.28,
    )
    knee_r = (
        (hip_r[0] + ankle_r[0]) / 2.0,
        right_stride * 0.52 + 0.08,
        0.78 + right_lift * 0.28,
    )

    shoulder_l = (-shoulder_half, lean, shoulder_z)
    shoulder_r = (shoulder_half, lean, shoulder_z)
    chest = (0.0, lean * 0.6, float(proportions["chest_z"]))
    neck = (0.0, lean, neck_z)
    head = (0.0, lean, head_z)

    load: Vec3 | None = None
    tool_grip: Vec3 | None = None
    tool_tip: Vec3 | None = None
    if action == "carry":
        load_z = float(beat["load_z"])
        load = (0.0, 0.61, load_z)
        hand_l = (-0.45, 0.91, load_z + 0.06)
        hand_r = (0.45, 0.91, load_z + 0.06)
        elbow_l = vec_lerp(shoulder_l, hand_l, 0.54)
        elbow_r = vec_lerp(shoulder_r, hand_r, 0.54)
    elif action == "work":
        angle = math.radians(float(beat["tool_angle"]))
        tool_grip = (
            float(beat["grip_x"]),
            float(beat["grip_y"]),
            float(beat["grip_z"]),
        )
        tool_tip = (
            tool_grip[0] + math.sin(angle) * 0.70,
            tool_grip[1] + 0.16,
            tool_grip[2] - math.cos(angle) * 0.70,
        )
        hand_r = tool_grip
        hand_l = vec_lerp(tool_grip, tool_tip, 0.34)
        elbow_l = vec_lerp(shoulder_l, hand_l, 0.53)
        elbow_r = vec_lerp(shoulder_r, hand_r, 0.52)
    else:
        swing = float(beat.get("arm_swing", 0.0))
        hand_l = (-shoulder_half * 1.02, swing, 1.64 + abs(swing) * 0.08)
        hand_r = (shoulder_half * 1.02, -swing, 1.64 + abs(swing) * 0.08)
        elbow_l = vec_lerp(shoulder_l, hand_l, 0.51)
        elbow_r = vec_lerp(shoulder_r, hand_r, 0.51)

    joints: dict[str, Vec3] = {
        "root": (0.0, 0.0, 0.0),
        "pelvis": (0.0, 0.0, pelvis_z),
        "chest": chest,
        "neck": neck,
        "head": head,
        "hip_l": hip_l,
        "hip_r": hip_r,
        "knee_l": knee_l,
        "knee_r": knee_r,
        "ankle_l": ankle_l,
        "ankle_r": ankle_r,
        "foot_l": foot_l,
        "foot_r": foot_r,
        "shoulder_l": shoulder_l,
        "shoulder_r": shoulder_r,
        "elbow_l": elbow_l,
        "elbow_r": elbow_r,
        "hand_l": hand_l,
        "hand_r": hand_r,
    }

    if role == "guard":
        equipment = (0.50, -0.27, 1.60)
        default_tool = (0.47, -0.27, 1.68)
    else:
        equipment = (0.52, 0.01, 1.34)
        default_tool = (0.48, 0.03, 1.48)
    default_load = (0.0, 0.58, 1.62)
    sockets: dict[str, Vec3] = {
        "root": joints["root"],
        "foot_l": foot_l,
        "foot_r": foot_r,
        "head": (head[0], head[1], head[2] + float(proportions["head_radius"])),
        "hand_l": hand_l,
        "hand_r": hand_r,
        "tool": tool_grip or default_tool,
        "tool_tip": tool_tip or default_tool,
        "load": load or default_load,
        "equipment": equipment,
    }
    return Pose(
        joints=joints,
        sockets=sockets,
        contacts=tuple(str(item) for item in beat["contacts"]),
        phase=float(beat["phase"]),
        load=load,
        tool_grip=tool_grip,
        tool_tip=tool_tip,
        lean=lean,
    )


def build_scene(
    role: str,
    action: str,
    pose: Pose,
    role_config: Mapping[str, Any],
) -> Scene:
    scene = Scene()
    palette = {name: parse_hex(value) for name, value in role_config["palette"].items()}
    proportions = role_config["proportions"]
    outline = palette["outline"]
    limb_radius = float(proportions["limb_radius"])
    joints = pose.joints

    # Legs and planted/lifted feet share the same world-space root authority.
    for side in ("l", "r"):
        scene.capsule(
            joints[f"hip_{side}"],
            joints[f"knee_{side}"],
            limb_radius * 1.06,
            palette["pants"],
            outline,
            f"leg:{side}:upper",
        )
        scene.capsule(
            joints[f"knee_{side}"],
            joints[f"ankle_{side}"],
            limb_radius * 0.92,
            shade(palette["pants"], -0.08 if side == "l" else 0.03),
            outline,
            f"leg:{side}:lower",
        )
        foot_center = vec_add(joints[f"foot_{side}"], (0.0, 0.10, 0.105))
        scene.capsule(
            vec_add(foot_center, (-0.10, -0.09, 0.0)),
            vec_add(foot_center, (0.10, 0.10, 0.0)),
            0.115,
            palette["boots"],
            outline,
            f"boot:{side}",
        )

    bottom = (0.0, 0.0, float(proportions["pelvis_z"]) - 0.10)
    top = (
        0.0,
        pose.lean,
        float(proportions["shoulder_z"]) - 0.02,
    )
    if role == "guard":
        add_tapered_torso(
            scene,
            bottom,
            top,
            float(proportions["hip_width"]) * 0.58,
            float(proportions["shoulder_width"]) * 0.49,
            float(proportions["torso_depth"]) / 2.0,
            palette["tunic"],
            outline,
            "guard:tunic",
        )
    else:
        add_tapered_torso(
            scene,
            bottom,
            top,
            float(proportions["hip_width"]) * 0.61,
            float(proportions["shoulder_width"]) * 0.50,
            float(proportions["torso_depth"]) / 2.0,
            palette["shirt"],
            outline,
            "builder:shirt",
        )
        # The squared apron is a front-only geometry cue, not a palette swap.
        apron_y = float(proportions["torso_depth"]) / 2.0 + 0.035
        scene.polygon(
            (
                (-0.37, apron_y, 1.36),
                (0.37, apron_y, 1.36),
                (0.34, apron_y + pose.lean * 0.1, 2.20),
                (-0.34, apron_y + pose.lean * 0.1, 2.20),
            ),
            palette["apron"],
            outline,
            "builder:apron",
        )

    upper_arm = palette["tunic"] if role == "guard" else palette["shirt"]
    for side in ("l", "r"):
        scene.capsule(
            joints[f"shoulder_{side}"],
            joints[f"elbow_{side}"],
            limb_radius * 1.02,
            shade(upper_arm, -0.06 if side == "l" else 0.05),
            outline,
            f"arm:{side}:upper",
        )
        scene.capsule(
            joints[f"elbow_{side}"],
            joints[f"hand_{side}"],
            limb_radius * 0.82,
            palette["skin"],
            outline,
            f"arm:{side}:fore",
        )
        scene.sphere(
            joints[f"hand_{side}"],
            0.145,
            palette["skin"],
            outline,
            f"hand:{side}",
        )

    head = joints["head"]
    # Back hair and front skin are separate depth-sorted shells. Rotation swaps
    # which shell is visible, producing true front/back views from one model.
    scene.sphere(
        vec_add(head, (0.0, -0.10, 0.025)),
        float(proportions["head_radius"]) * 1.01,
        palette["hair"],
        outline,
        f"{role}:hair",
    )
    scene.sphere(
        vec_add(head, (0.0, 0.075, 0.0)),
        float(proportions["head_radius"]) * 0.97,
        palette["skin"],
        outline,
        f"{role}:face",
    )

    # Small face geometry naturally disappears behind the head in the up view.
    for x in (-0.12, 0.12):
        scene.sphere(
            (x, head[1] + 0.43, head[2] + 0.06),
            0.035,
            shade(outline, 0.03),
            outline,
            f"{role}:eye:{'l' if x < 0 else 'r'}",
        )

    if role == "guard":
        for side in ("l", "r"):
            scene.sphere(
                joints[f"shoulder_{side}"],
                0.245,
                palette["metal"],
                outline,
                f"guard:pauldron:{side}",
            )
        helmet_center = vec_add(head, (0.0, -0.015, 0.19))
        scene.sphere(
            helmet_center,
            0.425,
            palette["metal"],
            outline,
            "guard:helmet",
        )
        scene.capsule(
            (-0.48, 0.025, head[2] + 0.15),
            (0.48, 0.025, head[2] + 0.15),
            0.068,
            palette["metal_light"],
            outline,
            "guard:helmet-brim",
        )
        scene.capsule(
            (0.0, -0.01, head[2] + 0.46),
            (0.0, -0.01, head[2] + 0.65),
            0.072,
            palette["belt"],
            outline,
            "guard:crest",
        )
        scene.capsule(
            (-0.39, 0.275, 1.54),
            (0.39, 0.275, 1.54),
            0.07,
            palette["belt"],
            outline,
            "guard:belt",
        )
        # Rear sword equipment is present in both requested clips.
        scene.capsule(
            (0.50, -0.28, 1.54),
            (0.68, -0.31, 0.70),
            0.075,
            palette["wood"],
            outline,
            "guard:sword-sheath",
            "attachment",
        )
        scene.capsule(
            (0.38, -0.28, 1.68),
            (0.60, -0.28, 1.68),
            0.055,
            palette["metal_light"],
            outline,
            "guard:sword-hilt",
            "attachment",
        )
    else:
        cap_center = vec_add(head, (0.0, -0.015, 0.27))
        scene.sphere(
            cap_center,
            0.405,
            palette["cap"],
            outline,
            "builder:cap",
        )
        scene.capsule(
            (-0.52, 0.10, head[2] + 0.20),
            (0.52, 0.10, head[2] + 0.20),
            0.072,
            palette["cap_light"],
            outline,
            "builder:cap-brim",
        )
        scene.sphere(
            (0.0, head[1] + 0.39, head[2] - 0.17),
            0.18,
            palette["hair"],
            outline,
            "builder:beard",
        )
        scene.capsule(
            (-0.42, 0.30, 1.50),
            (0.42, 0.30, 1.50),
            0.075,
            palette["belt"],
            outline,
            "builder:tool-belt",
        )
        add_box(
            scene,
            (0.49, 0.01, 1.34),
            (0.30, 0.28, 0.38),
            palette["apron_shadow"],
            outline,
            "builder:pouch",
            "body",
        )

    if pose.load is not None:
        add_box(
            scene,
            pose.load,
            (1.02, 0.56, 0.70),
            palette["load"],
            outline,
            "load:crate",
            "attachment",
        )
        # Cross battens make the load read at 1x without changing its bounds.
        scene.capsule(
            vec_add(pose.load, (-0.48, 0.295, 0.0)),
            vec_add(pose.load, (0.48, 0.295, 0.0)),
            0.035,
            palette["load_light"],
            outline,
            "load:batten",
            "attachment",
        )

    if pose.tool_grip is not None and pose.tool_tip is not None:
        scene.capsule(
            pose.tool_grip,
            pose.tool_tip,
            0.052,
            palette["wood"],
            outline,
            "tool:hammer-shaft",
            "attachment",
        )
        head_cross = (0.20, 0.055, 0.0)
        scene.capsule(
            vec_sub(pose.tool_tip, head_cross),
            vec_add(pose.tool_tip, head_cross),
            0.13,
            palette["metal"],
            outline,
            "tool:hammer-head",
            "attachment",
        )
        scene.sphere(
            vec_add(pose.tool_tip, head_cross),
            0.09,
            palette["metal_light"],
            outline,
            "tool:hammer-highlight",
            "attachment",
        )

    return scene


def scaled_points(
    primitive: Primitive,
    yaw: float,
    projection: Projection,
) -> list[tuple[float, float]]:
    factor = projection.supersample
    return [
        (project(point, yaw, projection)[0] * factor, project(point, yaw, projection)[1] * factor)
        for point in primitive.points
    ]


def draw_primitive(
    draw: ImageDraw.ImageDraw,
    primitive: Primitive,
    yaw: float,
    projection: Projection,
    fill: Color,
    *,
    styled: bool,
) -> None:
    points = scaled_points(primitive, yaw, projection)
    factor = projection.supersample
    outline = primitive.outline if styled else fill
    if primitive.kind == "polygon":
        draw.polygon(points, fill=fill)
        if styled:
            closed = points + [points[0]]
            draw.line(closed, fill=outline, width=max(1, factor), joint="curve")
            if len(points) >= 4:
                facet = (points[0], points[1], points[2])
                draw.polygon(facet, fill=shade(fill, 0.035))
    elif primitive.kind == "sphere":
        center = points[0]
        radius = primitive.radius * projection.pixels_per_unit * factor
        bounds = (
            center[0] - radius,
            center[1] - radius,
            center[0] + radius,
            center[1] + radius,
        )
        if styled:
            draw.ellipse(
                (
                    bounds[0] - factor,
                    bounds[1] - factor,
                    bounds[2] + factor,
                    bounds[3] + factor,
                ),
                fill=outline,
            )
        draw.ellipse(bounds, fill=fill)
        if styled and radius >= 2 * factor:
            draw.ellipse(
                (
                    center[0] - radius * 0.52,
                    center[1] - radius * 0.58,
                    center[0] + radius * 0.05,
                    center[1] - radius * 0.04,
                ),
                fill=shade(fill, 0.13),
            )
    elif primitive.kind == "capsule":
        start, end = points
        width = max(1, round(primitive.radius * 2 * projection.pixels_per_unit * factor))
        if styled:
            draw.line(
                (start, end),
                fill=outline,
                width=width + 2 * factor,
                joint="curve",
            )
            cap_radius = (width + 2 * factor) / 2.0
            for point in (start, end):
                draw.ellipse(
                    (
                        point[0] - cap_radius,
                        point[1] - cap_radius,
                        point[0] + cap_radius,
                        point[1] + cap_radius,
                    ),
                    fill=outline,
                )
        draw.line((start, end), fill=fill, width=width, joint="curve")
        cap_radius = width / 2.0
        for point in (start, end):
            draw.ellipse(
                (
                    point[0] - cap_radius,
                    point[1] - cap_radius,
                    point[0] + cap_radius,
                    point[1] + cap_radius,
                ),
                fill=fill,
            )
        if styled and width >= 3 * factor:
            highlight_start = (start[0] - factor * 0.55, start[1] - factor * 0.55)
            highlight_end = (end[0] - factor * 0.55, end[1] - factor * 0.55)
            draw.line(
                (highlight_start, highlight_end),
                fill=shade(fill, 0.12),
                width=max(factor, width // 4),
            )
    else:
        raise ValueError(f"Unknown primitive kind: {primitive.kind}")


def painterly_downsample(image: Image.Image, projection: Projection) -> Image.Image:
    result = image.resize(
        (projection.width, projection.height),
        Image.Resampling.LANCZOS,
    ).convert("RGBA")
    pixels = result.load()
    for y in range(result.height):
        for x in range(result.width):
            red, green, blue, alpha = pixels[x, y]
            # LANCZOS can leave 1–3 alpha dust outside an otherwise contained
            # silhouette. Remove only that sub-visible fringe; real edges and
            # the soft antialias remain intact.
            if alpha < 8:
                pixels[x, y] = (0, 0, 0, 0)
                continue
            # Fixed 8-level posterization consolidates supersampled facets into
            # soft, repeatable pixel clusters without temporal noise.
            pixels[x, y] = (
                min(255, (red // 8) * 8 + 4),
                min(255, (green // 8) * 8 + 4),
                min(255, (blue // 8) * 8 + 4),
                alpha,
            )
    return result


def nearest_downsample(image: Image.Image, projection: Projection) -> Image.Image:
    result = image.resize(
        (projection.width, projection.height),
        Image.Resampling.NEAREST,
    ).convert("RGBA")
    pixels = result.load()
    for y in range(result.height):
        for x in range(result.width):
            if pixels[x, y][3] == 0:
                pixels[x, y] = (0, 0, 0, 0)
    return result


def layer_for_depth(depth: float, projection: Projection) -> str:
    if depth < projection.rear_threshold:
        return "rear"
    if depth > projection.front_threshold:
        return "front"
    return "body"


def render_frame(
    scene: Scene,
    direction: str,
    projection: Projection,
) -> tuple[Image.Image, Image.Image, Image.Image, Mapping[str, Image.Image], Image.Image]:
    yaw = projection.yaw_by_direction[direction]
    high_size = (
        projection.width * projection.supersample,
        projection.height * projection.supersample,
    )
    id_pass = Image.new("RGBA", high_size, (0, 0, 0, 0))
    depth_pass = Image.new("RGBA", high_size, (0, 0, 0, 0))
    body_mask = Image.new("RGBA", high_size, (0, 0, 0, 0))
    layers = {name: Image.new("RGBA", high_size, (0, 0, 0, 0)) for name in LAYERS}
    id_draw = ImageDraw.Draw(id_pass, "RGBA")
    depth_draw = ImageDraw.Draw(depth_pass, "RGBA")
    body_draw = ImageDraw.Draw(body_mask, "RGBA")
    layer_draws = {name: ImageDraw.Draw(image, "RGBA") for name, image in layers.items()}

    sorted_primitives = sorted(
        scene.primitives,
        key=lambda primitive: (primitive_depth(primitive, yaw), primitive.order),
    )
    for primitive in sorted_primitives:
        depth = primitive_depth(primitive, yaw)
        depth_value = max(24, min(240, round(132 + depth * 50)))
        identifier = id_color(primitive.semantic)
        draw_primitive(
            id_draw,
            primitive,
            yaw,
            projection,
            identifier,
            styled=False,
        )
        draw_primitive(
            depth_draw,
            primitive,
            yaw,
            projection,
            (depth_value, depth_value, depth_value, 255),
            styled=False,
        )
        if primitive.category == "body":
            draw_primitive(
                body_draw,
                primitive,
                yaw,
                projection,
                (255, 255, 255, 255),
                styled=False,
            )
        target_layer = layer_for_depth(depth, projection)
        draw_primitive(
            layer_draws[target_layer],
            primitive,
            yaw,
            projection,
            primitive.color,
            styled=True,
        )

    raster_layers = {
        name: painterly_downsample(image, projection)
        for name, image in layers.items()
    }
    # The primary row is defined as the exact source-over result of the three
    # synchronized raster layers. This makes the flattened and layered runtime
    # experiments visually identical instead of introducing a second bake.
    raster_flattened = Image.new(
        "RGBA",
        (projection.width, projection.height),
        (0, 0, 0, 0),
    )
    for name in LAYERS:
        raster_flattened = Image.alpha_composite(raster_flattened, raster_layers[name])
    return (
        raster_flattened,
        nearest_downsample(id_pass, projection),
        nearest_downsample(depth_pass, projection),
        raster_layers,
        nearest_downsample(body_mask, projection),
    )


def socket_metadata(
    sockets: Mapping[str, Vec3],
    direction: str,
    projection: Projection,
) -> Mapping[str, Any]:
    yaw = projection.yaw_by_direction[direction]
    result: dict[str, Any] = {}
    for name in sorted(sockets):
        world = sockets[name]
        screen_x, screen_y, depth = project(world, yaw, projection)
        pixel_x, pixel_y = round(screen_x), round(screen_y)
        residual = math.hypot(screen_x - pixel_x, screen_y - pixel_y)
        result[name] = {
            "world": [round(value, 6) for value in world],
            "projected": [round(screen_x, 6), round(screen_y, 6)],
            "pixel": [pixel_x, pixel_y],
            "depth": round(depth, 6),
            "residual_px": round(residual, 6),
        }
    return result


def image_bounds(mask: Image.Image) -> list[int]:
    alpha = mask.getchannel("A")
    bounds = alpha.getbbox()
    if bounds is None:
        return [0, 0, 0, 0]
    return [int(value) for value in bounds]


def edge_contact_count(image: Image.Image, margin: int = 2) -> int:
    alpha = image.getchannel("A")
    pixels = alpha.load()
    return sum(
        pixels[x, y] > 0
        for y in range(image.height)
        for x in range(image.width)
        if (
            x < margin
            or x >= image.width - margin
            or y < margin
            or y >= image.height - margin
        )
    )


def frame_pixel_hash(image: Image.Image) -> str:
    return sha256_bytes(image.tobytes())


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG", optimize=False, compress_level=9)


def source_entries() -> list[dict[str, Any]]:
    root = repo_root()
    paths = [Path(__file__).resolve()]
    paths.extend(sorted(path for path in source_root().iterdir() if path.is_file()))
    result = []
    for path in paths:
        result.append(
            {
                "path": path.relative_to(root).as_posix(),
                "sha256": sha256_file(path),
                "bytes": path.stat().st_size,
            }
        )
    return sorted(result, key=lambda entry: entry["path"])


def output_entries(out_dir: Path) -> list[dict[str, Any]]:
    result = []
    for path in sorted(out_dir.rglob("*.png")):
        relative = path.relative_to(out_dir).as_posix()
        if relative.startswith(("rows/", "passes/", "layers/")):
            if relative.startswith("rows/"):
                kind = "primary-row"
            elif relative.startswith("passes/depth/"):
                kind = "depth-pass"
            elif relative.startswith("passes/id/"):
                kind = "id-pass"
            else:
                kind = "layer-row"
            result.append(
                {
                    "path": relative,
                    "sha256": sha256_file(path),
                    "bytes": path.stat().st_size,
                    "kind": kind,
                }
            )
    return result


def write_manifest(manifest: Mapping[str, Any], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(manifest, indent=2, sort_keys=True, ensure_ascii=False) + "\n"
    path.write_text(payload, encoding="utf-8")


def build_candidate(
    out_dir: Path,
    manifest_path: Path,
    *,
    double_build_matched: bool,
) -> Mapping[str, Any]:
    visual_source = read_json(source_root() / "visual-dna.json")
    clip_source = read_json(source_root() / "action-clips.json")
    view_source = read_json(source_root() / "views.json")
    projection = load_projection(view_source)

    if projection.width != 64 or projection.height != 84 or projection.frames != 8:
        raise ValueError("Candidate B only supports the 64x84, eight-frame row contract")

    for relative in ("rows", "passes", "layers"):
        generated = out_dir / relative
        if generated.exists():
            shutil.rmtree(generated)
    out_dir.mkdir(parents=True, exist_ok=True)

    rows: dict[str, Any] = {}
    combined_legend: dict[str, Mapping[str, Any]] = {}
    for role in sorted(ROLES_ACTIONS):
        role_config = visual_source["roles"][role]
        for action in ROLES_ACTIONS[role]:
            beats = clip_source["clips"][action]["beats"]
            if len(beats) != projection.frames:
                raise ValueError(f"{action} must contain exactly eight shared beats")
            for direction in DIRECTIONS:
                primary_row = Image.new(
                    "RGBA",
                    (projection.width * projection.frames, projection.height),
                    (0, 0, 0, 0),
                )
                id_row = Image.new("RGBA", primary_row.size, (0, 0, 0, 0))
                depth_row = Image.new("RGBA", primary_row.size, (0, 0, 0, 0))
                layer_rows = {
                    name: Image.new("RGBA", primary_row.size, (0, 0, 0, 0))
                    for name in LAYERS
                }
                frame_records = []
                body_heights: list[int] = []
                ground_anchors: list[int] = []
                for frame_index, beat in enumerate(beats):
                    pose = build_pose(role, action, beat, role_config)
                    scene = build_scene(role, action, pose, role_config)
                    for semantic, category in scene.legend.items():
                        combined_legend[semantic] = {
                            "rgba": list(id_color(semantic)),
                            "category": category,
                        }
                    primary, identifier, depth, frame_layers, body_mask = render_frame(
                        scene,
                        direction,
                        projection,
                    )
                    x = frame_index * projection.width
                    primary_row.paste(primary, (x, 0))
                    id_row.paste(identifier, (x, 0))
                    depth_row.paste(depth, (x, 0))
                    for layer in LAYERS:
                        layer_rows[layer].paste(frame_layers[layer], (x, 0))

                    bounds = image_bounds(body_mask)
                    height = bounds[3] - bounds[1]
                    ground_anchor = bounds[3] - 1
                    body_heights.append(height)
                    ground_anchors.append(ground_anchor)
                    frame_records.append(
                        {
                            "index": frame_index,
                            "phase": float(beat["phase"]),
                            "contacts": list(pose.contacts),
                            "body_bounds": bounds,
                            "body_height": height,
                            "ground_anchor_y": ground_anchor,
                            "edge_contact_pixels": edge_contact_count(primary),
                            "pixel_sha256": frame_pixel_hash(primary),
                            "sockets": socket_metadata(
                                pose.sockets,
                                direction,
                                projection,
                            ),
                        }
                    )

                primary_relative = Path("rows") / role / action / f"{direction}.png"
                id_relative = Path("passes/id") / role / action / f"{direction}.png"
                depth_relative = Path("passes/depth") / role / action / f"{direction}.png"
                layer_relatives = {
                    layer: Path("layers") / layer / role / action / f"{direction}.png"
                    for layer in LAYERS
                }
                save_png(primary_row, out_dir / primary_relative)
                save_png(id_row, out_dir / id_relative)
                save_png(depth_row, out_dir / depth_relative)
                for layer in LAYERS:
                    save_png(layer_rows[layer], out_dir / layer_relatives[layer])

                key = f"{role}/{action}/{direction}"
                rows[key] = {
                    "role": role,
                    "action": action,
                    "direction": direction,
                    "path": primary_relative.as_posix(),
                    "sha256": sha256_file(out_dir / primary_relative),
                    "passes": {
                        "id": id_relative.as_posix(),
                        "depth": depth_relative.as_posix(),
                    },
                    "layers": {
                        layer: layer_relatives[layer].as_posix() for layer in LAYERS
                    },
                    "metrics": {
                        "body_height_min": min(body_heights),
                        "body_height_max": max(body_heights),
                        "body_height_range": max(body_heights) - min(body_heights),
                        "body_height_median": float(median(body_heights)),
                        "ground_anchor_min": min(ground_anchors),
                        "ground_anchor_max": max(ground_anchors),
                        "ground_anchor_range": max(ground_anchors) - min(ground_anchors),
                    },
                    "frames": frame_records,
                }

    sources = source_entries()
    outputs = output_entries(out_dir)
    manifest: dict[str, Any] = {
        "schema": "realm.actor-pose-prototype.manifest.v1",
        "candidate": CANDIDATE,
        "compiler": {
            "name": "orthographic3d.py",
            "version": COMPILER_VERSION,
            "python_constraint": "Python 3 stdlib plus Pillow only",
            "pillow_version": PIL.__version__,
            "network_required": False,
        },
        "contract": {
            "primary_row_count": 16,
            "frame_width": projection.width,
            "frame_height": projection.height,
            "frames_per_row": projection.frames,
            "row_width": projection.width * projection.frames,
            "row_height": projection.height,
            "directions": list(DIRECTIONS),
            "layers": list(LAYERS),
            "projection": "orthographic four-view yaw",
            "runtime_mutated": False,
        },
        "authority": {
            "joints": [
                "root",
                "pelvis",
                "chest",
                "neck",
                "head",
                "hip_l",
                "hip_r",
                "knee_l",
                "knee_r",
                "ankle_l",
                "ankle_r",
                "foot_l",
                "foot_r",
                "shoulder_l",
                "shoulder_r",
                "elbow_l",
                "elbow_r",
                "hand_l",
                "hand_r",
            ],
            "segments": [
                "upper/lower legs",
                "boots",
                "tapered torso prism",
                "upper/lower arms",
                "head shells",
                "role garments/equipment",
                "load box",
                "tool shaft/head",
            ],
            "sockets": list(view_source["sockets"]),
            "phase_source": "action-clips.json",
            "occlusion": view_source["occlusion"],
            "paint_treatment": "supersampled low-poly facets, fixed posterization, no noise",
            "flattening": "exact rear/body/front source-over composition",
        },
        "source_files": sources,
        "source_digest": stable_digest(sources),
        "output_files": outputs,
        "output_digest": stable_digest(outputs),
        "id_legend": dict(sorted(combined_legend.items())),
        "rows": dict(sorted(rows.items())),
        "determinism": {
            "byte_deterministic": True,
            "doubleBuildMatched": bool(double_build_matched),
            "manifest_excludes_self_hash": True,
        },
        "reproducibility": {
            "network_free": True,
            "same_sources_same_png_bytes": True,
            "doubleBuildMatched": bool(double_build_matched),
        },
        "prototype_limitations": [
            "Pillow polygon/capsule geometry is a bounded low-poly proxy, not a Blender mesh",
            "the faceted posterized treatment is intentionally less painterly than final Realm art",
            "no hand-painted per-view corrective masks are included in this geometry-first test",
            "layer strips prove deterministic occlusion/compositing but have not been browser-profiled",
        ],
    }
    write_manifest(manifest, manifest_path)
    return manifest


def crop_frame(row: Image.Image, index: int, width: int) -> Image.Image:
    return row.crop((index * width, 0, (index + 1) * width, row.height))


def alpha_mask_from_id(
    image: Image.Image,
    legend: Mapping[str, Mapping[str, Any]],
    *,
    category: str,
) -> set[tuple[int, int]]:
    allowed = {
        tuple(int(channel) for channel in entry["rgba"])
        for entry in legend.values()
        if entry["category"] == category
    }
    pixels = image.convert("RGBA").load()
    return {
        (x, y)
        for y in range(image.height)
        for x in range(image.width)
        if pixels[x, y] in allowed
    }


def silhouette_iou(a: set[tuple[int, int]], b: set[tuple[int, int]]) -> float:
    union = a | b
    if not union:
        return 1.0
    return len(a & b) / len(union)


def verify_candidate(
    out_dir: Path,
    manifest_path: Path,
    *,
    require_double_build: bool,
) -> Mapping[str, Any]:
    manifest = read_json(manifest_path)
    errors: list[str] = []
    expected_keys = {
        f"{role}/{action}/{direction}"
        for role, actions in ROLES_ACTIONS.items()
        for action in actions
        for direction in DIRECTIONS
    }
    rows = manifest.get("rows", {})
    if set(rows) != expected_keys:
        errors.append(
            f"row keys differ: expected {len(expected_keys)}, found {len(rows)}"
        )

    primary_files = sorted((out_dir / "rows").rglob("*.png"))
    if len(primary_files) != 16:
        errors.append(f"expected exactly 16 primary rows, found {len(primary_files)}")

    expected_size = (64 * 8, 84)
    frame_uniqueness: dict[str, int] = {}
    max_socket_residual = 0.0
    total_edge_contacts = 0
    layer_composite_mismatches = 0
    for key in sorted(expected_keys & set(rows)):
        row = rows[key]
        path = out_dir / row["path"]
        if not path.is_file():
            errors.append(f"{key}: missing primary row {row['path']}")
            continue
        image = Image.open(path)
        image.load()
        if image.mode != "RGBA":
            errors.append(f"{key}: expected RGBA, got {image.mode}")
        if image.size != expected_size:
            errors.append(f"{key}: expected {expected_size}, got {image.size}")
            continue
        if sha256_file(path) != row["sha256"]:
            errors.append(f"{key}: primary row hash mismatch")
        cell_hashes: list[str] = []
        for index in range(8):
            frame = crop_frame(image, index, 64)
            if frame.getchannel("A").getbbox() is None:
                errors.append(f"{key}: frame {index} is blank")
            cell_hashes.append(frame_pixel_hash(frame))
            for corner in ((0, 0), (63, 0), (0, 83), (63, 83)):
                if frame.getpixel(corner)[3] != 0:
                    errors.append(f"{key}: frame {index} corner {corner} is not transparent")
            contacts = edge_contact_count(frame)
            total_edge_contacts += contacts
            if contacts != 0:
                errors.append(
                    f"{key}: frame {index} contacts the outer two-pixel boundary"
                )
        unique = len(set(cell_hashes))
        frame_uniqueness[key] = unique
        if unique != 8:
            errors.append(f"{key}: expected 8 distinct frames, found {unique}")

        metrics = row["metrics"]
        if metrics["body_height_range"] > 2:
            errors.append(
                f"{key}: body height range {metrics['body_height_range']} exceeds 2px"
            )
        if metrics["ground_anchor_range"] > 1:
            errors.append(
                f"{key}: ground anchor range {metrics['ground_anchor_range']} exceeds 1px"
            )
        if len(row["frames"]) != 8:
            errors.append(f"{key}: socket metadata does not contain 8 frames")
        for frame in row["frames"]:
            for socket_name in manifest["authority"]["sockets"]:
                socket = frame["sockets"].get(socket_name)
                if socket is None:
                    errors.append(
                        f"{key}: frame {frame['index']} missing socket {socket_name}"
                    )
                    continue
                residual = float(socket["residual_px"])
                max_socket_residual = max(max_socket_residual, residual)
                if residual > 1.0:
                    errors.append(
                        f"{key}: frame {frame['index']} socket {socket_name} "
                        f"residual {socket['residual_px']} exceeds 1px"
                    )
                pixel_x, pixel_y = socket["pixel"]
                if not (0 <= int(pixel_x) < 64 and 0 <= int(pixel_y) < 84):
                    errors.append(
                        f"{key}: frame {frame['index']} socket {socket_name} "
                        f"is outside the 64x84 cell"
                    )

        for diagnostic in (
            row["passes"]["id"],
            row["passes"]["depth"],
            *row["layers"].values(),
        ):
            diagnostic_path = out_dir / diagnostic
            if not diagnostic_path.is_file():
                errors.append(f"{key}: missing diagnostic {diagnostic}")
                continue
            diagnostic_image = Image.open(diagnostic_path)
            diagnostic_image.load()
            if diagnostic_image.size != expected_size:
                errors.append(f"{key}: diagnostic {diagnostic} has wrong dimensions")

        composite = Image.new("RGBA", expected_size, (0, 0, 0, 0))
        for layer in LAYERS:
            composite = Image.alpha_composite(
                composite,
                Image.open(out_dir / row["layers"][layer]).convert("RGBA"),
            )
        if composite.tobytes() != image.convert("RGBA").tobytes():
            layer_composite_mismatches += 1
            errors.append(f"{key}: synchronized layer composition differs from primary")

    # Phase is clip-owned: every direction must retain the exact same beat index.
    for role, actions in ROLES_ACTIONS.items():
        for action in actions:
            phase_tracks = []
            for direction in DIRECTIONS:
                key = f"{role}/{action}/{direction}"
                if key in rows:
                    phase_tracks.append(
                        tuple(frame["phase"] for frame in rows[key]["frames"])
                    )
            if phase_tracks and any(track != phase_tracks[0] for track in phase_tracks[1:]):
                errors.append(f"{role}/{action}: direction phase tracks differ")

    # Height authority is shared across direction and action for each role.
    max_direction_height_delta = 0.0
    max_action_height_delta = 0.0
    for role, actions in ROLES_ACTIONS.items():
        for action in actions:
            values = [
                float(rows[f"{role}/{action}/{direction}"]["metrics"]["body_height_median"])
                for direction in DIRECTIONS
                if f"{role}/{action}/{direction}" in rows
            ]
            if values:
                delta = max(values) - min(values)
                max_direction_height_delta = max(max_direction_height_delta, delta)
                if delta > 2:
                    errors.append(
                        f"{role}/{action}: cross-direction body height delta {delta}px"
                    )
        for direction in DIRECTIONS:
            values = [
                float(rows[f"{role}/{action}/{direction}"]["metrics"]["body_height_median"])
                for action in actions
                if f"{role}/{action}/{direction}" in rows
            ]
            if values:
                delta = max(values) - min(values)
                max_action_height_delta = max(max_action_height_delta, delta)
                if delta > 2:
                    errors.append(
                        f"{role}/{direction}: cross-action body height delta {delta}px"
                    )

    outputs = output_entries(out_dir)
    if stable_digest(outputs) != manifest.get("output_digest"):
        errors.append("output digest mismatch")
    recorded_outputs = {
        entry["path"]: entry["sha256"] for entry in manifest.get("output_files", [])
    }
    for entry in outputs:
        if recorded_outputs.get(entry["path"]) != entry["sha256"]:
            errors.append(f"unrecorded or changed output: {entry['path']}")
    for entry in manifest.get("source_files", []):
        path = repo_root() / entry["path"]
        if not path.is_file() or sha256_file(path) != entry["sha256"]:
            errors.append(f"source hash mismatch: {entry['path']}")
    if stable_digest(source_entries()) != manifest.get("source_digest"):
        errors.append("source digest mismatch")

    if require_double_build and not bool(
        manifest.get("determinism", {}).get("doubleBuildMatched")
    ):
        errors.append("double-build determinism has not been recorded")

    identity_iou = 1.0
    guard_key = "guard/walk/down"
    builder_key = "builder/walk/down"
    if guard_key in rows and builder_key in rows:
        guard_id = Image.open(out_dir / rows[guard_key]["passes"]["id"]).convert("RGBA")
        builder_id = Image.open(out_dir / rows[builder_key]["passes"]["id"]).convert("RGBA")
        guard_mask = alpha_mask_from_id(
            crop_frame(guard_id, 0, 64),
            manifest["id_legend"],
            category="body",
        )
        builder_mask = alpha_mask_from_id(
            crop_frame(builder_id, 0, 64),
            manifest["id_legend"],
            category="body",
        )
        identity_iou = silhouette_iou(guard_mask, builder_mask)
        if identity_iou >= 0.92:
            errors.append(
                f"guard/builder body silhouettes too similar at 1x (IoU {identity_iou:.3f})"
            )

    evidence = {
        "candidate": CANDIDATE,
        "primary_rows": len(primary_files),
        "frames": len(primary_files) * 8,
        "max_body_height_range_px": max(
            (
                int(row["metrics"]["body_height_range"])
                for row in rows.values()
            ),
            default=0,
        ),
        "max_ground_anchor_range_px": max(
            (
                int(row["metrics"]["ground_anchor_range"])
                for row in rows.values()
            ),
            default=0,
        ),
        "max_cross_direction_height_delta_px": max_direction_height_delta,
        "max_cross_action_height_delta_px": max_action_height_delta,
        "guard_builder_body_silhouette_iou": round(identity_iou, 6),
        "minimum_unique_frames_per_row": min(frame_uniqueness.values(), default=0),
        "max_socket_residual_px": round(max_socket_residual, 6),
        "outer_boundary_contact_pixels": total_edge_contacts,
        "layer_composite_mismatches": layer_composite_mismatches,
        "double_build_matched": bool(
            manifest.get("determinism", {}).get("doubleBuildMatched")
        ),
        "source_digest": manifest.get("source_digest"),
        "output_digest": manifest.get("output_digest"),
        "errors": errors,
        "ok": not errors,
    }
    if errors:
        raise RuntimeError(json.dumps(evidence, indent=2, sort_keys=True))
    return evidence


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=default_out_dir(),
        help="Candidate root; primary rows are emitted under rows/<role>/<action>/<dir>.png",
    )
    parser.add_argument(
        "--manifest",
        type=Path,
        default=None,
        help="Manifest path (default: <out-dir>/manifest.json)",
    )
    parser.add_argument(
        "--verify",
        action="store_true",
        help="Perform a clean second bake, record byte equality, then run all gates",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    out_dir = args.out_dir.resolve()
    manifest_path = (
        args.manifest.resolve() if args.manifest is not None else out_dir / "manifest.json"
    )
    build_candidate(out_dir, manifest_path, double_build_matched=False)

    if args.verify:
        with tempfile.TemporaryDirectory(prefix="realm-ortho3d-") as temporary:
            second_out = Path(temporary) / CANDIDATE
            second_manifest = second_out / "manifest.json"
            first = read_json(manifest_path)
            second = build_candidate(
                second_out,
                second_manifest,
                double_build_matched=False,
            )
            matched = (
                first["source_digest"] == second["source_digest"]
                and first["output_digest"] == second["output_digest"]
                and {
                    item["path"]: item["sha256"] for item in first["output_files"]
                }
                == {
                    item["path"]: item["sha256"] for item in second["output_files"]
                }
            )
            if not matched:
                raise RuntimeError("Clean double build produced different PNG bytes")
        manifest = read_json(manifest_path)
        manifest["determinism"]["doubleBuildMatched"] = True
        manifest["reproducibility"]["doubleBuildMatched"] = True
        write_manifest(manifest, manifest_path)
        evidence = verify_candidate(
            out_dir,
            manifest_path,
            require_double_build=True,
        )
        print(json.dumps(evidence, indent=2, sort_keys=True))
    else:
        manifest = read_json(manifest_path)
        print(
            json.dumps(
                {
                    "candidate": CANDIDATE,
                    "manifest": manifest_path.as_posix(),
                    "output_digest": manifest["output_digest"],
                    "primary_rows": manifest["contract"]["primary_row_count"],
                    "verified": False,
                },
                indent=2,
                sort_keys=True,
            )
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
