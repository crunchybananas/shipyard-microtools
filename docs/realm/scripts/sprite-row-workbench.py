#!/usr/bin/env python3
"""Create, validate, accept, and verify canonical Realm actor rows."""

from __future__ import annotations

import argparse
import copy
import colorsys
import hashlib
import json
import math
import shutil
import statistics
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageDraw

from sprite_row_quality import ACTIONS, FRAME_H, FRAME_W, FRAMES, analyze_row, write_proof


ROOT = Path(__file__).resolve().parent.parent
SPRITES = ROOT / "assets" / "sprites"
BASE_DIR = SPRITES / "actors"
COMPILED_DIR = SPRITES / "actors-compiled"
ROW_DIR = SPRITES / "actor-rows"
MANIFEST_PATH = ROW_DIR / "manifest.json"
WORK_ORDER_DIR = ROOT / "tmp" / "sprite-work-orders"
DIRS = ("down", "up", "left", "right")
ROLES = (
    "settler", "farmer", "rancher", "lumber", "miner", "stonecutter",
    "fisher", "trader", "innkeeper", "builder", "blacksmith", "guard",
    "scholar", "forager",
)
# Identity references deliberately prefer neutral adjacent actions. The target
# action is always excluded: a BASE or CANDIDATE action family may be the very
# semantic mismatch the work order is meant to repair.
IDENTITY_ACTION_PRIORITY = ("idle", "walk", "work", "carry")

# Role tunic identity colors, carried over from the retired procedural
# ROLE_CONFIG (paint-cohesive-legacy-actors round): the palette players
# already associate with each role. Used by the `derive` command.
ROLE_CLOTH = {
    "farmer": "#5c9a43",
    "rancher": "#8f7938",
    "lumber": "#9f6334",
    "miner": "#5e7f93",
    "stonecutter": "#7a7b78",
    "fisher": "#4f7f90",
    "trader": "#9b7b41",
    "innkeeper": "#a45d3f",
    "builder": "#9a743e",
    "blacksmith": "#3f4952",
    "guard": "#426ca0",
    "scholar": "#6c627d",
    "forager": "#70904a",
}

# The settler reference tunic occupies an isolated slate-blue hue band
# (everything else on the sheet is warm brown/skin), so cloth pixels can be
# selected by hue alone and remapped per role while per-pixel value keeps the
# painted shading intact.
CLOTH_HUE_MIN = 150 / 360
CLOTH_HUE_MAX = 240 / 360
CLOTH_REF_HUE = 195 / 360
CLOTH_REF_SAT = 0.20
CLOTH_REF_VAL = 0.45


def derive_role_row(source: Image.Image, cloth_hex: str) -> Image.Image:
    target = cloth_hex.lstrip("#")
    target_h, target_s, target_v = colorsys.rgb_to_hsv(
        int(target[0:2], 16) / 255, int(target[2:4], 16) / 255, int(target[4:6], 16) / 255
    )
    out = source.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if not a:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if not (CLOTH_HUE_MIN <= h <= CLOTH_HUE_MAX and s >= 0.06 and v >= 0.10):
                continue
            nh = (target_h + (h - CLOTH_REF_HUE) * 0.35) % 1.0
            ns = min(1.0, max(0.02, s * (target_s / CLOTH_REF_SAT)))
            nv = min(1.0, v * (1 + (target_v / CLOTH_REF_VAL - 1) * 0.5))
            nr, ng, nb = colorsys.hsv_to_rgb(nh, ns, nv)
            px[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
    return out


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def row_key(role: str, action: str, direction: str) -> str:
    return f"{role}/{action}/{direction}"


def row_file(
    role: str,
    action: str,
    direction: str,
    digest: str,
) -> Path:
    return (
        ROW_DIR
        / "production"
        / role
        / f"{action}-{direction}-{digest[:12]}.png"
    )


def candidate_file(role: str, action: str, direction: str) -> Path:
    return ROW_DIR / "candidates" / role / f"{action}-{direction}.png"


def empty_manifest() -> dict:
    return {"version": 2, "updatedAt": now_iso(), "rows": {}}


def normalize_manifest(data: dict) -> dict:
    """Return the v2 two-slot manifest without changing source records.

    Version 1 stored either an accepted row or a candidate at each logical
    key. Version 2 stores both independently so review work cannot erase the
    production authority used by clean atlas builds.
    """
    rows = data.get("rows")
    if not isinstance(rows, dict):
        raise SystemExit(f"invalid row manifest: {MANIFEST_PATH}")
    if data.get("version") == 2:
        return data
    if data.get("version") != 1:
        raise SystemExit(f"invalid row manifest: {MANIFEST_PATH}")

    migrated = {
        "version": 2,
        "updatedAt": data.get("updatedAt", now_iso()),
        "rows": {},
    }
    for key, item in rows.items():
        if not isinstance(item, dict):
            raise SystemExit(f"invalid v1 row manifest entry: {key}")
        status = item.get("status")
        if status == "accepted":
            migrated["rows"][key] = {"production": item}
        elif status == "candidate":
            migrated["rows"][key] = {"candidate": item}
        else:
            raise SystemExit(f"{key} has unsupported v1 status {status!r}")
    return migrated


def load_manifest() -> dict:
    if not MANIFEST_PATH.exists():
        return empty_manifest()
    return normalize_manifest(json.loads(MANIFEST_PATH.read_text()))


def save_manifest(data: dict) -> None:
    ROW_DIR.mkdir(parents=True, exist_ok=True)
    data = normalize_manifest(data)
    data["version"] = 2
    data["updatedAt"] = now_iso()
    payload = json.dumps(data, indent=2, sort_keys=True) + "\n"
    with tempfile.NamedTemporaryFile(
        mode="w",
        dir=ROW_DIR,
        prefix=".manifest-",
        suffix=".json",
        delete=False,
    ) as handle:
        handle.write(payload)
        temporary = Path(handle.name)
    temporary.replace(MANIFEST_PATH)


def row_slots(manifest: dict, key: str) -> dict:
    entry = manifest["rows"].get(key)
    if entry is None:
        return {}
    if not isinstance(entry, dict):
        raise SystemExit(f"{key} has invalid row slots")
    return entry


def production_item(manifest: dict, key: str) -> dict | None:
    item = row_slots(manifest, key).get("production")
    return item if isinstance(item, dict) else None


def candidate_item(manifest: dict, key: str) -> dict | None:
    item = row_slots(manifest, key).get("candidate")
    return item if isinstance(item, dict) else None


def preferred_review_item(manifest: dict, key: str) -> dict | None:
    return candidate_item(manifest, key) or production_item(manifest, key)


def validate_target(role: str, action: str, direction: str) -> None:
    if role not in ROLES:
        raise SystemExit(f"unknown role: {role}")
    if action not in ACTIONS:
        raise SystemExit(f"unknown action: {action}")
    if direction not in DIRS:
        raise SystemExit(f"unknown direction: {direction}")


def source_sheet(role: str) -> Path:
    compiled = COMPILED_DIR / f"{role}.png"
    return compiled if compiled.exists() else BASE_DIR / f"{role}.png"


def crop_row(role: str, action: str, direction: str) -> Image.Image:
    validate_target(role, action, direction)
    image = Image.open(source_sheet(role)).convert("RGBA")
    row_index = ACTIONS.index(action) * len(DIRS) + DIRS.index(direction)
    y = row_index * FRAME_H
    return image.crop((0, y, FRAME_W * FRAMES, y + FRAME_H))


def comparison_row(
    role: str,
    action: str,
    direction: str,
    *,
    source: str = "review",
) -> Image.Image:
    manifest = load_manifest()
    key = row_key(role, action, direction)
    if source == "production":
        item = production_item(manifest, key)
    elif source == "review":
        item = preferred_review_item(manifest, key)
    else:
        raise ValueError(f"unknown comparison source {source!r}")
    if item:
        path = ROW_DIR / item.get("file", "")
        if path.is_file():
            return Image.open(path).convert("RGBA")
    return crop_row(role, action, direction)


def add_direction_comparison(
    report: dict,
    role: str,
    action: str,
    direction: str,
    *,
    reference_source: str = "review",
) -> dict:
    peers = []
    for peer_dir in DIRS:
        if peer_dir == direction:
            continue
        with tempfile.NamedTemporaryFile(suffix=".png") as handle:
            comparison_row(
                role,
                action,
                peer_dir,
                source=reference_source,
            ).save(handle.name)
            peers.append(analyze_row(Path(handle.name), action))
    reference_height = statistics.median(peer["medianBodyHeight"] for peer in peers)
    reference_width = statistics.median(peer["medianBodyWidth"] for peer in peers)
    reference_color = [
        statistics.median(peer["medianColor"][channel] for peer in peers)
        for channel in range(3)
    ]
    height_delta = abs(report["medianBodyHeight"] - reference_height)
    width_delta = abs(report["medianBodyWidth"] - reference_width)
    palette_delta = math.sqrt(
        sum((report["medianColor"][channel] - reference_color[channel]) ** 2 for channel in range(3))
    )
    report["directionReference"] = {
        "medianBodyHeight": round(reference_height, 2),
        "medianBodyWidth": round(reference_width, 2),
        "medianColor": [round(value, 2) for value in reference_color],
        "bodyHeightDelta": round(height_delta, 2),
        "bodyWidthDelta": round(width_delta, 2),
        "paletteDelta": round(palette_delta, 2),
    }
    # Work poses legitimately merge tools and benches into the dense body from
    # some angles, so cross-direction width gets the same looser allowance the
    # analyzer grants within-row work width; height stays the scale authority.
    width_limit = 16 if action == "work" else 10
    if height_delta > 8 or width_delta > width_limit:
        report["warnings"].append("direction-scale-mismatch")
    if palette_delta > 35:
        report["warnings"].append("direction-palette-mismatch")
    report["warnings"] = list(dict.fromkeys(report["warnings"]))
    return report


def _relative_source(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(ROOT.resolve()))
    except ValueError:
        return str(path.resolve())


def _manifest_row_path(item: dict, key: str) -> Path:
    file_value = item.get("file")
    if not isinstance(file_value, str) or not file_value:
        raise SystemExit(f"{key} has no row file in the manifest")
    path = (ROW_DIR / file_value).resolve()
    row_root = ROW_DIR.resolve()
    if path != row_root and row_root not in path.parents:
        raise SystemExit(f"{key} row file escapes {ROW_DIR}")
    if not path.is_file():
        raise SystemExit(f"{key} row file is missing: {path}")
    return path


def _reference_metadata(reference: dict) -> dict:
    return {
        key: value
        for key, value in reference.items()
        if key != "image"
    }


def _locked_identity_reference(
    manifest: dict,
    role: str,
    action: str,
    direction: str,
) -> tuple[dict | None, str]:
    key = row_key(role, action, direction)
    item = production_item(manifest, key)
    if not item:
        return None, f"{key}=BASE"
    status = item.get("status")
    if status != "accepted":
        return None, f"{key}=invalid-production-{status!r}"
    warnings = item.get("quality", {}).get("warnings")
    if warnings != []:
        return None, f"{key}=LOCKED-with-untrusted-warnings"
    try:
        path = _manifest_row_path(item, key)
    except SystemExit as error:
        return None, f"{key}=invalid-LOCKED ({error})"
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if digest != item.get("sha256"):
        return None, f"{key}=LOCKED-hash-mismatch"
    return {
        "key": key,
        "role": role,
        "action": action,
        "dir": direction,
        "status": "LOCKED",
        "source": _relative_source(path),
        "sha256": digest,
        "warnings": [],
        "image": Image.open(path).convert("RGBA"),
    }, ""


def select_identity_references(
    manifest: dict,
    role: str,
    action: str,
    direction: str,
) -> list[dict]:
    """Return trusted same-role/direction rows from actions other than target.

    BASE, CANDIDATE, missing, warning-bearing, and hash-mismatched rows are
    diagnostics only. They must never silently become identity authorities.
    """
    references = []
    rejected = []
    for peer_action in IDENTITY_ACTION_PRIORITY:
        if peer_action == action:
            continue
        reference, reason = _locked_identity_reference(
            manifest,
            role,
            peer_action,
            direction,
        )
        if reference:
            references.append(reference)
        else:
            rejected.append(reason)
    if not references:
        checked = "; ".join(rejected)
        raise SystemExit(
            f"no trusted identity reference for {row_key(role, action, direction)}; "
            "a work order requires at least one warning-free, hash-matched LOCKED "
            f"adjacent action for the same role/direction (checked: {checked}). "
            "BASE and CANDIDATE rows are motion evidence only."
        )
    for index, reference in enumerate(references):
        reference["identityRole"] = "PRIMARY" if index == 0 else "SUPPORTING"
    return references


def _motion_reference(
    manifest: dict,
    role: str,
    action: str,
    direction: str,
) -> dict:
    key = row_key(role, action, direction)
    candidate = candidate_item(manifest, key)
    production = production_item(manifest, key)
    item = candidate or production
    if item:
        status = item.get("status")
        if status not in ("accepted", "candidate"):
            raise SystemExit(f"{key} has unsupported manifest status {status!r}")
        path = _manifest_row_path(item, key)
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest != item.get("sha256"):
            raise SystemExit(f"{key} manifest hash does not match {path}")
        display_status = "LOCKED" if status == "accepted" else "CANDIDATE"
        if candidate:
            display_status += "+RUNTIME-LOCKED" if production else "+RUNTIME-BASE"
        return {
            "key": key,
            "role": role,
            "action": action,
            "dir": direction,
            "status": display_status,
            "source": _relative_source(path),
            "sha256": digest,
            "warnings": item.get("quality", {}).get("warnings", []),
            "image": Image.open(path).convert("RGBA"),
        }

    path = BASE_DIR / f"{role}.png"
    if not path.is_file():
        raise SystemExit(f"missing BASE role sheet: {path}")
    image = Image.open(path).convert("RGBA")
    row_index = ACTIONS.index(action) * len(DIRS) + DIRS.index(direction)
    y = row_index * FRAME_H
    return {
        "key": key,
        "role": role,
        "action": action,
        "dir": direction,
        "status": "BASE",
        "source": f"{_relative_source(path)}#row={action}/{direction}",
        "sha256": None,
        "warnings": ["unreviewed-base-source"],
        "image": image.crop((0, y, FRAME_W * FRAMES, y + FRAME_H)),
    }


def select_motion_references(
    manifest: dict,
    role: str,
    action: str,
    direction: str,
) -> list[dict]:
    ordered_dirs = (direction,) + tuple(item for item in DIRS if item != direction)
    references = [
        _motion_reference(manifest, role, action, peer_dir)
        for peer_dir in ordered_dirs
    ]
    for index, reference in enumerate(references):
        reference["motionRole"] = "TARGET" if index == 0 else "PEER"
    return references


def make_contact(
    references: list[dict],
    out: Path,
    *,
    heading: str,
    guidance: str,
    role_field: str,
    primary_scale: int,
    peer_scale: int,
) -> None:
    width = FRAME_W * FRAMES * primary_scale
    scales = [primary_scale if index == 0 else peer_scale for index in range(len(references))]
    header_height = 52
    label_height = 28
    heights = [FRAME_H * scale + label_height for scale in scales]
    contact = Image.new("RGBA", (width, header_height + sum(heights)), (15, 20, 24, 255))
    draw = ImageDraw.Draw(contact)
    draw.text((8, 6), heading, fill=(255, 215, 108, 255))
    draw.text((8, 25), guidance, fill=(232, 237, 240, 255))
    y_out = header_height
    for reference, scale, height in zip(references, scales, heights):
        warnings = reference["warnings"]
        warning_text = ",".join(warnings) if warnings else "none"
        label = (
            f"{reference[role_field]} | {reference['key']} | {reference['status']} | "
            f"source={reference['source']} | warnings={warning_text}"
        )
        strip = reference["image"]
        draw.text((8, y_out + 6), label, fill=(232, 237, 240, 255))
        contact.alpha_composite(
            strip.resize((FRAME_W * FRAMES * scale, FRAME_H * scale), Image.Resampling.NEAREST),
            (0, y_out + label_height),
        )
        y_out += height
    out.parent.mkdir(parents=True, exist_ok=True)
    contact.save(out)


def work_order(args: argparse.Namespace) -> None:
    validate_target(args.role, args.action, args.dir)
    key = row_key(args.role, args.action, args.dir)
    manifest = load_manifest()
    identity_references = select_identity_references(
        manifest,
        args.role,
        args.action,
        args.dir,
    )
    motion_references = select_motion_references(
        manifest,
        args.role,
        args.action,
        args.dir,
    )
    out = args.out_dir or (WORK_ORDER_DIR / key.replace("/", "-"))
    out.mkdir(parents=True, exist_ok=True)
    current = motion_references[0]["image"]
    current_path = out / "current-row.png"
    current.save(current_path)
    current.resize((current.width * 4, current.height * 4), Image.Resampling.NEAREST).save(out / "current-row-x4.png")
    legacy_contact = out / "reference-contact.png"
    if legacy_contact.exists():
        legacy_contact.unlink()
    make_contact(
        identity_references,
        out / "identity-reference-contact.png",
        heading="IDENTITY REFERENCE - AUTHORITATIVE",
        guidance="Copy the common character identity only; these are warning-free, hash-verified LOCKED adjacent actions.",
        role_field="identityRole",
        primary_scale=4,
        peer_scale=2,
    )
    make_contact(
        motion_references,
        out / "motion-reference-contact.png",
        heading="MOTION REFERENCE - NOT AN IDENTITY AUTHORITY",
        guidance="Use only for target-action pose/cadence; BASE or CANDIDATE rows may depict the wrong costume or equipment.",
        role_field="motionRole",
        primary_scale=4,
        peer_scale=2,
    )
    report = add_direction_comparison(analyze_row(current_path, args.action), args.role, args.action, args.dir)
    (out / "current-quality.json").write_text(json.dumps(report, indent=2) + "\n")

    identity_keys = ", ".join(reference["key"] for reference in identity_references)
    motion_statuses = ", ".join(
        f"{reference['key']} [{reference['status']}]"
        for reference in motion_references
    )
    prompt = f"""Use case: stylized-concept
Asset type: Realm game actor animation source
Primary request: Create exactly eight animation poses for {args.role} performing {args.action}, facing {args.dir}.
Input image 1 — IDENTITY AUTHORITY: identity-reference-contact.png contains only warning-free, hash-verified LOCKED rows for the same {args.role} facing {args.dir}: {identity_keys}. Copy their common character identity, costume, face/headgear, body proportions, palette, body scale, and painted pixel-cluster style. The PRIMARY row is the first choice; SUPPORTING rows confirm continuity. Do not copy their action-specific pose or prop.
Input image 2 — MOTION EVIDENCE ONLY: motion-reference-contact.png shows the {args.action} target and direction peers: {motion_statuses}. Use it only to understand {args.action} pose, cadence, direction, and tool travel. BASE and CANDIDATE rows are untrusted for identity and may contain obsolete, semantically wrong costume, armour, equipment, palette, or legacy art. When the two contacts conflict, identity-reference-contact.png always wins for character identity.
Scene/backdrop: perfectly flat solid #ff00ff chroma-key background.
Subject: the same {args.role} in every frame, with identical costume, face, body proportions, and approximate body height.
Style/medium: compact painterly pixel-art game sprite, crisp clustered pixels, no smooth concept-art rendering.
Composition/framing: one horizontal strip of eight separated poses in chronological order, generous gaps, every pose fully visible.
Constraints: keep the NPC body scale and ground anchor stable; tools may travel farther than the body; no frame may shrink the actor to fit a tool; no cast shadow; no labels; no UI; no border; no extra characters.
Avoid: old hooded-knight/SVG-port appearance, detached hands or feet, loose duplicate props, changing costume, changing handedness, background texture, gradients, perspective floor, watermark, text.
Output intent: the result will be segmented and packed into eight exact 64x84 transparent cells by local tooling.
"""
    (out / "prompt.txt").write_text(prompt)
    spec = {
        "version": 2,
        "key": key,
        "role": args.role,
        "action": args.action,
        "dir": args.dir,
        "expectedPackedSize": [FRAME_W * FRAMES, FRAME_H],
        "chromaKey": "#ff00ff",
        "references": {
            "identity": {
                "file": "identity-reference-contact.png",
                "authority": "character-identity",
                "policy": "warning-free hash-matched LOCKED adjacent actions only",
                "rows": [
                    _reference_metadata(reference)
                    for reference in identity_references
                ],
            },
            "motion": {
                "file": "motion-reference-contact.png",
                "authority": "target-action-motion-only",
                "warning": "BASE and CANDIDATE rows must not define character identity",
                "rows": [
                    _reference_metadata(reference)
                    for reference in motion_references
                ],
            },
        },
        "currentRow": "current-row.png",
        "currentSource": _reference_metadata(motion_references[0]),
        "qualityBefore": report,
    }
    (out / "spec.json").write_text(json.dumps(spec, indent=2) + "\n")
    print(f"[sprite-workbench] wrote {out}")


def derive_row(args: argparse.Namespace) -> None:
    validate_target(args.role, args.action, args.dir)
    source_role = args.source_role
    source_action = args.source_action or args.action
    source_dir = args.source_dir or args.dir
    validate_target(source_role, source_action, source_dir)
    same_role = args.role == source_role
    if same_role and source_action == args.action and source_dir == args.dir:
        raise SystemExit("derive source and target are the same row")
    cloth = None
    if not same_role:
        cloth = ROLE_CLOTH.get(args.role)
        if not cloth:
            raise SystemExit(f"no ROLE_CLOTH entry for {args.role}")
    manifest = load_manifest()
    source_item = production_item(
        manifest,
        row_key(source_role, source_action, source_dir),
    )
    if source_item:
        source_image = Image.open(ROW_DIR / source_item["file"]).convert("RGBA")
    else:
        # No accepted override for the source row: fall back to the compiled
        # (or base) sheet crop. Same-role pose reuse is the main client here.
        source_image = crop_row(source_role, source_action, source_dir)
    derived = derive_role_row(source_image, cloth) if cloth else source_image.copy()
    out = args.out or (WORK_ORDER_DIR / "derived" / f"{args.role}-{args.action}-{args.dir}.png")
    out.parent.mkdir(parents=True, exist_ok=True)
    derived.save(out)
    report = analyze_row(out, args.action)
    print(
        f"[sprite-workbench] derived {args.role}/{args.action}/{args.dir} from "
        f"{source_role}/{source_action}/{source_dir} ({report['styleEra']}, "
        f"body {report['medianBodyHeight']}px, warnings {','.join(report['warnings']) or 'none'})"
    )
    print(f"[sprite-workbench] wrote {out}")


def _alpha_points(frame: Image.Image, cutoff: int) -> list[tuple[int, int]]:
    px = frame.load()
    return [(x, y) for y in range(frame.height) for x in range(frame.width) if px[x, y][3] > cutoff]


def _neck_row(frame: Image.Image, cutoff: int) -> tuple[int, int]:
    """Locate the neck: the narrowest row between the head mass and the
    shoulders. Returns (neck_y, head_center_x). Search is limited to the top
    40% of the figure so wide hat brims and tools do not confuse it."""
    points = _alpha_points(frame, cutoff)
    if not points:
        raise SystemExit("frame is blank")
    top = min(y for _, y in points)
    bottom = max(y for _, y in points)
    height = bottom - top + 1
    widths = {}
    for y in range(top, top + int(height * 0.4)):
        xs = [x for x, py in points if py == y]
        if xs:
            widths[y] = (max(xs) - min(xs) + 1, (max(xs) + min(xs)) // 2)
    rows = sorted(widths)
    if len(rows) < 8:
        raise SystemExit("figure too small for neck detection")
    # Find the head width peak in the upper half of the search band, then the
    # narrowest row after it: that pinch is the neck.
    upper = rows[: max(4, len(rows) // 2)]
    peak_y = max(upper, key=lambda y: widths[y][0])
    after = [y for y in rows if y > peak_y]
    neck_y = min(after, key=lambda y: widths[y][0])
    return neck_y, widths[peak_y][1]


def headswap_row(args: argparse.Namespace) -> None:
    # Chimera-role repaint: settler-derived body wearing the role's own
    # painted head (face + headgear lifted from the role's painted work/carry
    # frames). Keeps every pixel in-family with the art direction.
    validate_target(args.role, args.action, args.dir)
    from sprite_row_quality import ALPHA_CUTOFF

    cloth = args.cloth_hex or ROLE_CLOTH.get(args.role)
    if not cloth:
        raise SystemExit(f"no ROLE_CLOTH entry for {args.role}")

    # Donor head: the role's own painted row, cleanest-head frame unless a
    # frame is forced. --head-dir overrides the donor row direction (a straw
    # hat is nearly round: the clean down-view hat serves side views too).
    donor_dir = args.head_dir or args.dir
    donor_row = comparison_row(args.role, args.head_action, donor_dir)
    donor_frames = []
    for index in range(FRAMES):
        frame = donor_row.crop((index * FRAME_W, 0, (index + 1) * FRAME_W, FRAME_H))
        points = _alpha_points(frame, ALPHA_CUTOFF)
        if not points:
            continue
        # Cleanest donor head = the frame with the LEAST mass above the neck:
        # raised hands and swung tools inflate the head zone.
        try:
            neck_y, _ = _neck_row(frame, ALPHA_CUTOFF)
        except SystemExit:
            continue
        head_mass = sum(1 for _, y in points if y < neck_y)
        donor_frames.append((head_mass, index, frame))
    if not donor_frames:
        raise SystemExit("donor row is blank")
    donor_frames.sort(key=lambda item: (item[0], item[1]))
    if args.head_frame is not None:
        donor_frame = donor_row.crop((args.head_frame * FRAME_W, 0, (args.head_frame + 1) * FRAME_W, FRAME_H))
        donor_index = args.head_frame
    else:
        _, donor_index, donor_frame = donor_frames[0]
    donor_neck, donor_cx = _neck_row(donor_frame, ALPHA_CUTOFF)
    donor_px = donor_frame.load()
    # Keyhole extraction: the full hat width above the face line, but only
    # face-width pixels for the chin rows below it — on bent work poses the
    # shoulders overlap the chin rows and must stay behind.
    face_xs = [x for x, y in _alpha_points(donor_frame, ALPHA_CUTOFF) if y == donor_neck]
    face_min_x = min(face_xs) - 1
    face_max_x = max(face_xs) + 1
    chin_extend = args.chin_extend
    # Torso-color filter: on bent donor poses the vest/shoulder tops rise into
    # head rows at the frame edges. Drop head-crop pixels whose hue matches
    # the role cloth color so only hat, hair, and skin travel.
    target = cloth.lstrip("#")
    cloth_h, cloth_s, _ = colorsys.rgb_to_hsv(
        int(target[0:2], 16) / 255, int(target[2:4], 16) / 255, int(target[4:6], 16) / 255
    )

    def is_torso_color(x: int, y: int) -> bool:
        if not args.cloth_filter:
            return False
        r, g, b, a = donor_px[x, y]
        h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        if s < 0.22 or v < 0.12:
            return False
        return min(abs(h - cloth_h), 1 - abs(h - cloth_h)) < 30 / 360

    # Horizontal bound: the hat brim's own x-span (widest head row). Carried
    # props riding at head height behind the shoulder stay out of the crop.
    brim_yws = {}
    for x, y in _alpha_points(donor_frame, ALPHA_CUTOFF):
        if y < donor_neck:
            lo, hi = brim_yws.get(y, (x, x))
            brim_yws[y] = (min(lo, x), max(hi, x))
    brim_lo, brim_hi = max(brim_yws.values(), key=lambda span: span[1] - span[0])
    head_points = [
        (x, y)
        for x, y in _alpha_points(donor_frame, 0)
        if (y < donor_neck or (y < donor_neck + chin_extend and face_min_x <= x <= face_max_x))
        and brim_lo - 1 <= x <= brim_hi + 1
        and not is_torso_color(x, y)
    ]
    if not head_points:
        raise SystemExit("no head pixels above donor neck")
    # A head is one connected mass: drop satellite blobs (carried props riding
    # at head height) by keeping only the largest component of the crop.
    from sprite_row_quality import components as _components

    keep = set(head_points)
    crop_mask = [[0] * FRAME_W for _ in range(FRAME_H)]
    for x, y in head_points:
        crop_mask[y][x] = 1
    crop_components = _components(crop_mask)
    if crop_components:
        keep = set(crop_components[0])
    head_points = [p for p in head_points if p in keep]
    head_min_x = min(x for x, _ in head_points)
    head_max_x = max(x for x, _ in head_points)
    head_min_y = min(y for _, y in head_points)
    head_max_y = max(y for _, y in head_points)
    head = Image.new("RGBA", (head_max_x - head_min_x + 1, head_max_y - head_min_y + 1), (0, 0, 0, 0))
    head_px = head.load()
    for x, y in head_points:
        head_px[x - head_min_x, y - head_min_y] = donor_px[x, y]
    if args.head_scale != 1.0:
        head = head.resize(
            (max(1, round(head.width * args.head_scale)), max(1, round(head.height * args.head_scale))),
            Image.Resampling.NEAREST,
        )
    head_anchor_x = donor_cx - head_min_x  # donor head center within the head crop
    if args.head_scale != 1.0:
        head_anchor_x = round(head_anchor_x * args.head_scale)

    # Body: settler locked row for the same action/dir, palette-shifted to
    # the role identity color.
    manifest = load_manifest()
    body_item = production_item(
        manifest,
        row_key("settler", args.action, args.dir),
    )
    if not body_item:
        raise SystemExit(f"settler/{args.action}/{args.dir} is not an accepted override")
    body_row = derive_role_row(Image.open(ROW_DIR / body_item["file"]).convert("RGBA"), cloth)

    if args.hat_only:
        # Reduce the donor head to its headgear: hue-keyed straw/hat pixels in
        # the crop's upper rows. The body keeps its own head; the hat sits on
        # the hair crown.
        hat = Image.new("RGBA", head.size, (0, 0, 0, 0))
        hat_px = hat.load()
        src_px = head.load()
        hat_floor = int(head.height * args.hat_floor)
        for y in range(min(hat_floor, head.height)):
            for x in range(head.width):
                r, g, b, a = src_px[x, y]
                if not a:
                    continue
                h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
                if (
                    args.hat_hue_min / 360 <= h <= args.hat_hue_max / 360
                    and args.hat_sat_min <= s <= args.hat_sat_max
                    and args.hat_val_min <= v <= args.hat_val_max
                ):
                    hat_px[x, y] = (r, g, b, a)
        hat_mask = [[1 if hat_px[x, y][3] > 18 else 0 for x in range(hat.width)] for y in range(hat.height)]
        from sprite_row_quality import components as _hat_components

        hat_comps = _hat_components(hat_mask)
        if not hat_comps:
            raise SystemExit("no hat pixels found in donor head")
        keep_hat = set(hat_comps[0])
        for y in range(hat.height):
            for x in range(hat.width):
                if (x, y) not in keep_hat:
                    hat_px[x, y] = (0, 0, 0, 0)
        hat_ys = [y for x, y in keep_hat]
        hat_xs = [x for x, y in keep_hat]
        head = hat.crop((min(hat_xs), min(hat_ys), max(hat_xs) + 1, max(hat_ys) + 1))
        head_anchor_x = (min(hat_xs) + max(hat_xs)) // 2 - min(hat_xs)

    out_image = Image.new("RGBA", (FRAME_W * FRAMES, FRAME_H), (0, 0, 0, 0))
    for index in range(FRAMES):
        body = body_row.crop((index * FRAME_W, 0, (index + 1) * FRAME_W, FRAME_H)).copy()
        body_neck, body_cx = _neck_row(body, ALPHA_CUTOFF)
        body_px = body.load()
        if args.hat_only:
            body_points = _alpha_points(body, ALPHA_CUTOFF)
            body_top = min(y for _, y in body_points)
            head_xs = [x for x, y in body_points if y < body_neck]
            body_head_cx = (min(head_xs) + max(head_xs)) // 2 if head_xs else body_cx
            paste_y = body_top - args.hat_lift
            body.alpha_composite(head, (max(0, body_head_cx - head_anchor_x), max(0, paste_y)))
            out_image.paste(body, (index * FRAME_W, 0))
            continue
        for x, y in _alpha_points(body, 0):
            if y < body_neck:
                body_px[x, y] = (0, 0, 0, 0)
        paste_x = body_cx - head_anchor_x
        paste_y = body_neck - head.height + args.head_drop
        pasted_head = head
        if paste_y < 0:
            # The donor head is taller than the space above the neck: crop its
            # crown instead of shifting it up, so the chin stays anchored on
            # the collar and never disconnects.
            pasted_head = head.crop((0, -paste_y, head.width, head.height))
            paste_y = 0
        body.alpha_composite(pasted_head, (max(0, paste_x), paste_y))
        out_image.paste(body, (index * FRAME_W, 0))

    out = args.out or (WORK_ORDER_DIR / "derived" / f"{args.role}-{args.action}-{args.dir}.png")
    out.parent.mkdir(parents=True, exist_ok=True)
    out_image.save(out)
    report = analyze_row(out, args.action)
    print(
        f"[sprite-workbench] headswap {args.role}/{args.action}/{args.dir}: settler body + "
        f"{args.role}/{args.head_action}/{args.dir} frame {donor_index} head "
        f"({report['styleEra']}, body {report['medianBodyHeight']}px, "
        f"warnings {','.join(report['warnings']) or 'none'})"
    )
    print(f"[sprite-workbench] wrote {out}")


def stance_row(args: argparse.Namespace) -> None:
    # Build an idle row from the most neutral frame of a source row (usually
    # the role's own painted walk row): pick the narrowest-silhouette frame,
    # replicate it, and add a 1px upper-body breathing bob. Follows the Round
    # 111 precedent of repacking idle rows from the locked walk family.
    validate_target(args.role, args.action, args.dir)
    from sprite_row_quality import ALPHA_CUTOFF

    source_action = args.source_action or "walk"
    source_dir = args.source_dir or args.dir
    validate_target(args.role, source_action, source_dir)
    source = comparison_row(args.role, source_action, source_dir)

    frames = []
    for index in range(FRAMES):
        frame = source.crop((index * FRAME_W, 0, (index + 1) * FRAME_W, FRAME_H))
        px = frame.load()
        points = [(x, y) for y in range(FRAME_H) for x in range(FRAME_W) if px[x, y][3] > ALPHA_CUTOFF]
        if not points:
            continue
        top = min(y for _, y in points)
        bottom = max(y for _, y in points)
        width = max(x for x, _ in points) - min(x for x, _ in points) + 1
        # The standing-most frame of a walk cycle is the passing frame: legs
        # together. Judge by the spread of the leg region (bottom 30% of the
        # figure), not the full silhouette, which shoulders and arms dominate.
        leg_floor = bottom - int((bottom - top + 1) * 0.3)
        leg_xs = [x for x, y in points if y >= leg_floor]
        leg_width = max(leg_xs) - min(leg_xs) + 1
        frames.append((leg_width, width, index, frame, top, bottom))
    if not frames:
        raise SystemExit("source row is blank")
    frames.sort()
    _, _, chosen_index, pose, top, bottom = frames[0] if args.frame is None else next(
        f for f in frames if f[2] == args.frame
    )

    # Breathing bob: shift the upper 60% of the figure down 1px on the middle
    # beats (frames 2-5) so the feet and ground anchor never move.
    waist = top + int((bottom - top + 1) * 0.6)
    upper = pose.crop((0, 0, FRAME_W, waist))
    bobbed = pose.copy()
    bobbed.paste(Image.new("RGBA", (FRAME_W, 1), (0, 0, 0, 0)), (0, 0))
    bobbed.paste(upper, (0, 1))

    out_image = Image.new("RGBA", (FRAME_W * FRAMES, FRAME_H), (0, 0, 0, 0))
    pattern = (0, 0, 1, 1, 1, 1, 0, 0)
    for index in range(FRAMES):
        out_image.paste(bobbed if pattern[index] else pose, (index * FRAME_W, 0))

    out = args.out or (WORK_ORDER_DIR / "derived" / f"{args.role}-{args.action}-{args.dir}.png")
    out.parent.mkdir(parents=True, exist_ok=True)
    out_image.save(out)
    report = analyze_row(out, args.action)
    print(
        f"[sprite-workbench] stance {args.role}/{args.action}/{args.dir} from "
        f"{args.role}/{source_action}/{source_dir} frame {chosen_index} "
        f"({report['styleEra']}, body {report['medianBodyHeight']}px, "
        f"warnings {','.join(report['warnings']) or 'none'})"
    )
    print(f"[sprite-workbench] wrote {out}")


def pulse_row(args: argparse.Namespace) -> None:
    # Add a deterministic vertical work-rhythm to a row whose only defect is
    # zero frame-to-frame motion (all-sprite-maps gate: a moving row needs at
    # least two unique frames). Per frame, the upper body shifts DOWN by the
    # pattern offset (windup/strike/recover); feet and ground anchor never
    # move. Same paste mechanics as stance_row's accepted 1px breathing bob —
    # only non-negative offsets so no transparent seam can open at the waist.
    validate_target(args.role, args.action, args.dir)
    from sprite_row_quality import ALPHA_CUTOFF

    row = Image.open(args.input).convert("RGBA") if args.input else comparison_row(args.role, args.action, args.dir)
    offsets = [int(v) for v in (args.pattern or "0,0,2,1,0,0,2,1").split(",")]
    if len(offsets) != FRAMES:
        raise SystemExit(f"pattern must list {FRAMES} offsets")
    if any(v < 0 for v in offsets):
        raise SystemExit("pattern offsets must be >= 0 (down-shifts only)")

    out_image = Image.new("RGBA", (FRAME_W * FRAMES, FRAME_H), (0, 0, 0, 0))
    for index in range(FRAMES):
        frame = row.crop((index * FRAME_W, 0, (index + 1) * FRAME_W, FRAME_H))
        off = offsets[index]
        if off:
            px = frame.load()
            points = [(x, y) for y in range(FRAME_H) for x in range(FRAME_W) if px[x, y][3] > ALPHA_CUTOFF]
            if points:
                top = min(y for _, y in points)
                bottom = max(y for _, y in points)
                waist = top + int((bottom - top + 1) * 0.55)
                upper = frame.crop((0, 0, FRAME_W, waist))
                shifted = frame.copy()
                shifted.paste(Image.new("RGBA", (FRAME_W, waist), (0, 0, 0, 0)), (0, 0))
                shifted.paste(upper, (0, off))
                frame = shifted
        out_image.paste(frame, (index * FRAME_W, 0))

    out = args.out or (WORK_ORDER_DIR / "derived" / f"{args.role}-{args.action}-{args.dir}.png")
    out.parent.mkdir(parents=True, exist_ok=True)
    out_image.save(out)
    report = analyze_row(out, args.action)
    print(
        f"[sprite-workbench] pulse {args.role}/{args.action}/{args.dir} pattern "
        f"{','.join(str(v) for v in offsets)} ({report['styleEra']}, "
        f"body {report['medianBodyHeight']}px, warnings {','.join(report['warnings']) or 'none'})"
    )
    print(f"[sprite-workbench] wrote {out}")


def rescale_row(args: argparse.Namespace) -> None:
    # Uniform per-row body rescale about a fixed ground anchor. One transform
    # for every frame, so relative frame-to-frame motion is preserved exactly
    # and the operation cannot introduce jitter.
    validate_target(args.role, args.action, args.dir)
    row = Image.open(args.input).convert("RGBA") if args.input else comparison_row(args.role, args.action, args.dir)
    with tempfile.NamedTemporaryFile(suffix=".png") as handle:
        row.save(handle.name)
        report = analyze_row(Path(handle.name), args.action)
    current = report["medianBodyHeight"]
    if not current:
        raise SystemExit("row has no measurable body")
    factor = args.target_height / current
    bottoms = [frame["body"]["maxY"] for frame in report["frames"] if frame["pixels"]]
    anchor_y = statistics.median(bottoms)
    anchor_x = FRAME_W / 2

    out_image = Image.new("RGBA", (FRAME_W * FRAMES, FRAME_H), (0, 0, 0, 0))
    lost = 0
    for index in range(FRAMES):
        frame = row.crop((index * FRAME_W, 0, (index + 1) * FRAME_W, FRAME_H))
        scaled = frame.resize(
            (max(1, round(FRAME_W * factor)), max(1, round(FRAME_H * factor))),
            Image.Resampling.LANCZOS,
        )
        offset_x = round(anchor_x - anchor_x * factor)
        offset_y = round(anchor_y - anchor_y * factor)
        cell = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
        cell.alpha_composite(scaled, dest=(max(0, offset_x), max(0, offset_y)),
                             source=(max(0, -offset_x), max(0, -offset_y)))
        before = sum(1 for _, a in enumerate(scaled.getdata()) if a[3] > 18)
        after = sum(1 for _, a in enumerate(cell.getdata()) if a[3] > 18)
        lost += max(0, before - after)
        out_image.paste(cell, (index * FRAME_W, 0))

    out = args.out or (WORK_ORDER_DIR / "derived" / f"{args.role}-{args.action}-{args.dir}.png")
    out.parent.mkdir(parents=True, exist_ok=True)
    out_image.save(out)
    new_report = analyze_row(out, args.action)
    print(
        f"[sprite-workbench] rescaled {args.role}/{args.action}/{args.dir} x{factor:.3f}: "
        f"body {current} -> {new_report['medianBodyHeight']}px (target {args.target_height}), "
        f"clipped {lost}px, warnings {','.join(new_report['warnings']) or 'none'}"
    )
    print(f"[sprite-workbench] wrote {out}")


def stabilize_row(args: argparse.Namespace) -> None:
    # Jitter repair: normalize each frame's dense-body height to the row
    # median (ground-anchored, clamped factor) and optionally align the body
    # center-x to the row median. Kills body-scale flicker and lateral jitter
    # while preserving every pose; tools may still travel.
    validate_target(args.role, args.action, args.dir)
    row = Image.open(args.input).convert("RGBA") if args.input else comparison_row(args.role, args.action, args.dir)
    with tempfile.NamedTemporaryFile(suffix=".png") as handle:
        row.save(handle.name)
        before = analyze_row(Path(handle.name), args.action)
    heights = [f["body"]["h"] for f in before["frames"] if f["pixels"]]
    centers = [f["body"]["cx"] for f in before["frames"] if f["pixels"]]
    bottoms = [f["body"]["maxY"] for f in before["frames"] if f["pixels"]]
    median_h = statistics.median(heights)
    median_cx = statistics.median(centers)

    out_image = Image.new("RGBA", (FRAME_W * FRAMES, FRAME_H), (0, 0, 0, 0))
    for index in range(FRAMES):
        frame = row.crop((index * FRAME_W, 0, (index + 1) * FRAME_W, FRAME_H))
        stats = before["frames"][index]
        if not stats["pixels"]:
            out_image.paste(frame, (index * FRAME_W, 0))
            continue
        factor = max(0.82, min(1.22, median_h / max(1, stats["body"]["h"])))
        anchor_y = stats["body"]["maxY"]
        anchor_x = stats["body"]["cx"]
        # Preserve native pixel clusters for ordinary one-pixel pose
        # variation.  Resampling such a small correction softens the sprite
        # and can expose low-alpha chroma pixels around painted edges.
        if abs(factor - 1) < 0.015:
            factor = 1
            scaled = frame
        else:
            scaled = frame.resize(
                (max(1, round(FRAME_W * factor)), max(1, round(FRAME_H * factor))),
                Image.Resampling.LANCZOS,
            )
        offset_x = round(anchor_x - anchor_x * factor)
        offset_y = round(anchor_y - anchor_y * factor)
        if args.align_x:
            offset_x += round(median_cx - anchor_x)
        cell = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
        cell.alpha_composite(scaled, dest=(max(0, offset_x), max(0, offset_y)),
                             source=(max(0, -offset_x), max(0, -offset_y)))
        out_image.paste(cell, (index * FRAME_W, 0))

    out = args.out or (WORK_ORDER_DIR / "derived" / f"{args.role}-{args.action}-{args.dir}.png")
    out.parent.mkdir(parents=True, exist_ok=True)
    out_image.save(out)
    after = analyze_row(out, args.action)
    print(
        f"[sprite-workbench] stabilized {args.role}/{args.action}/{args.dir}: "
        f"bodyHeightRange {before['bodyHeightRange']} -> {after['bodyHeightRange']}, "
        f"centerJump {before['maxBodyCenterJump']} -> {after['maxBodyCenterJump']}, "
        f"flicker {before['flickerScore']} -> {after['flickerScore']}, "
        f"warnings {','.join(after['warnings']) or 'none'}"
    )
    print(f"[sprite-workbench] wrote {out}")


def scrub_row(args: argparse.Namespace) -> None:
    # Consolidated from the retired scrub-work-row-particles.mjs one-shot:
    # drop small disconnected alpha components (baked debris, loose chips)
    # while keeping the actor, tools, and other substantial parts.
    validate_target(args.role, args.action, args.dir)
    from sprite_row_quality import ALPHA_CUTOFF, components

    row = Image.open(args.input).convert("RGBA") if args.input else comparison_row(args.role, args.action, args.dir)
    out_image = row.copy()
    removed_total = 0
    for frame_index in range(FRAMES):
        frame = out_image.crop((frame_index * FRAME_W, 0, (frame_index + 1) * FRAME_W, FRAME_H))
        px = frame.load()
        mask = [[1 if px[x, y][3] > ALPHA_CUTOFF else 0 for x in range(FRAME_W)] for y in range(FRAME_H)]
        found = components(mask)
        for component in found[1:]:
            if len(component) >= args.min_keep:
                continue
            for x, y in component:
                px[x, y] = (0, 0, 0, 0)
            removed_total += len(component)
        out_image.paste(frame, (frame_index * FRAME_W, 0))
    out = args.out or (WORK_ORDER_DIR / "derived" / f"{args.role}-{args.action}-{args.dir}.png")
    out.parent.mkdir(parents=True, exist_ok=True)
    out_image.save(out)
    report = analyze_row(out, args.action)
    print(
        f"[sprite-workbench] scrubbed {args.role}/{args.action}/{args.dir}: removed {removed_total}px "
        f"of sub-{args.min_keep}px fragments (fragments now {report['maxFragmentPixels']}px/"
        f"{report['maxFragmentCount']}, warnings {','.join(report['warnings']) or 'none'})"
    )
    print(f"[sprite-workbench] wrote {out}")


QUALITY_FIELDS = (
    "flickerScore", "bodyHeightRange", "bodyWidthRange", "bodyBottomRange",
    "medianBodyHeight", "medianBodyWidth", "medianColor", "directionReference",
    "styleEra", "medianColorCount", "medianShadingRatio",
    "maxBodyCenterJump", "maxAlphaRatio", "maxPaletteDrift",
    "maxFragmentPixels", "maxEdgePixels", "warnings",
)


def quality_record(report: dict) -> dict:
    return {key: report[key] for key in QUALITY_FIELDS}


def declared_row_files(manifest: dict) -> set[Path]:
    declared: set[Path] = set()
    for entry in manifest["rows"].values():
        if not isinstance(entry, dict):
            continue
        for slot in ("production", "candidate"):
            item = entry.get(slot)
            if isinstance(item, dict) and item.get("file"):
                declared.add((ROW_DIR / item["file"]).resolve())
    return declared


def remove_unreferenced_row_file(manifest: dict, item: dict | None) -> None:
    if not item or not item.get("file"):
        return
    path = (ROW_DIR / item["file"]).resolve()
    row_root = ROW_DIR.resolve()
    if path == row_root or row_root not in path.parents:
        raise SystemExit(f"refusing to remove actor row outside {ROW_DIR}: {path}")
    if path in declared_row_files(manifest):
        return
    if path.is_file():
        path.unlink()


def accept_row(args: argparse.Namespace) -> None:
    validate_target(args.role, args.action, args.dir)
    source = args.input.resolve()
    report = add_direction_comparison(analyze_row(source, args.action), args.role, args.action, args.dir)
    if report["errors"]:
        raise SystemExit(f"row has errors: {', '.join(report['errors'])}")
    if report["warnings"]:
        raise SystemExit(
            "row has warnings and cannot be accepted: "
            + ", ".join(report["warnings"])
            + "; stage it as a candidate and repair the row"
        )

    manifest = load_manifest()
    key = row_key(args.role, args.action, args.dir)
    slots = row_slots(manifest, key).copy()
    previous_production = slots.get("production")
    previous_candidate = slots.get("candidate")
    source_digest = hashlib.sha256(source.read_bytes()).hexdigest()
    destination = row_file(
        args.role,
        args.action,
        args.dir,
        source_digest,
    )
    destination.parent.mkdir(parents=True, exist_ok=True)
    if source != destination.resolve():
        shutil.copyfile(source, destination)
    copied_report = add_direction_comparison(
        analyze_row(destination, args.action),
        args.role,
        args.action,
        args.dir,
    )
    digest = hashlib.sha256(destination.read_bytes()).hexdigest()
    proof = ROW_DIR / "proofs" / f"{args.role}-{args.action}-{args.dir}-x4.png"
    write_proof(destination, proof, copied_report)

    status = "accepted"
    production = {
        "status": status,
        "file": str(destination.relative_to(ROW_DIR)),
        "sha256": digest,
        "provenance": args.provenance,
        "note": args.note or "",
        "acceptedAt": now_iso(),
        "quality": quality_record(copied_report),
    }
    manifest["rows"][key] = {"production": production}
    save_manifest(manifest)
    remove_unreferenced_row_file(manifest, previous_production)
    remove_unreferenced_row_file(manifest, previous_candidate)
    print(f"[sprite-workbench] {status} {key}")
    print(f"[sprite-workbench] row {destination}")
    print(f"[sprite-workbench] proof {proof}")


def stage_row(args: argparse.Namespace) -> None:
    validate_target(args.role, args.action, args.dir)
    source = args.input.resolve()
    report = add_direction_comparison(analyze_row(source, args.action), args.role, args.action, args.dir)
    if report["errors"]:
        raise SystemExit(f"row has errors: {', '.join(report['errors'])}")

    manifest = load_manifest()
    key = row_key(args.role, args.action, args.dir)
    slots = row_slots(manifest, key).copy()
    previous_candidate = slots.get("candidate")
    destination = candidate_file(args.role, args.action, args.dir)
    destination.parent.mkdir(parents=True, exist_ok=True)
    if source != destination.resolve():
        shutil.copyfile(source, destination)
    digest = hashlib.sha256(destination.read_bytes()).hexdigest()
    proof = ROW_DIR / "proofs" / f"{args.role}-{args.action}-{args.dir}-candidate-x4.png"
    write_proof(destination, proof, report)

    slots["candidate"] = {
        "status": "candidate",
        "file": str(destination.relative_to(ROW_DIR)),
        "sha256": digest,
        "provenance": args.provenance,
        "note": args.note or "",
        "stagedAt": now_iso(),
        "quality": quality_record(report),
    }
    manifest["rows"][key] = slots
    save_manifest(manifest)
    remove_unreferenced_row_file(manifest, previous_candidate)
    print(f"[sprite-workbench] staged candidate {key}")
    print(f"[sprite-workbench] warnings {','.join(report['warnings']) or 'none'}")
    print(f"[sprite-workbench] proof {proof}")


def promote_candidate(args: argparse.Namespace) -> None:
    validate_target(args.role, args.action, args.dir)
    manifest = load_manifest()
    key = row_key(args.role, args.action, args.dir)
    candidate = candidate_item(manifest, key)
    if not candidate:
        raise SystemExit(f"{key} has no candidate to promote")
    args.input = _manifest_row_path(candidate, key)
    args.provenance = candidate.get("provenance") or "promoted-candidate"
    args.note = args.note if args.note is not None else candidate.get("note", "")
    accept_row(args)


def promote_family(args: argparse.Namespace) -> None:
    """Promote a complete role/action family with one manifest transaction."""
    role = args.role
    actions = tuple(args.actions or ACTIONS)
    manifest = load_manifest()
    targets = [
        (action, direction, row_key(role, action, direction))
        for action in actions
        for direction in DIRS
    ]
    prepared = []
    for action, direction, key in targets:
        candidate = candidate_item(manifest, key)
        if not candidate:
            raise SystemExit(
                f"family promotion requires a candidate for every target; missing {key}"
            )
        path = _manifest_row_path(candidate, key)
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest != candidate.get("sha256"):
            raise SystemExit(f"{key} candidate hash does not match its manifest lock")
        report = add_direction_comparison(
            analyze_row(path, action),
            role,
            action,
            direction,
        )
        if report["errors"] or report["warnings"]:
            messages = report["errors"] + report["warnings"]
            raise SystemExit(
                f"{key} blocks family promotion: {', '.join(messages)}"
            )
        prepared.append((action, direction, key, candidate, path, digest, report))

    next_manifest = copy.deepcopy(manifest)
    accepted_at = now_iso()
    previous_items = []
    created_paths = []
    try:
        for action, direction, key, candidate, path, digest, report in prepared:
            destination = row_file(role, action, direction, digest)
            destination.parent.mkdir(parents=True, exist_ok=True)
            existed = destination.exists()
            if path != destination.resolve():
                shutil.copyfile(path, destination)
            if hashlib.sha256(destination.read_bytes()).hexdigest() != digest:
                raise SystemExit(f"{key} production copy changed bytes")
            if not existed:
                created_paths.append(destination)
            old_slots = row_slots(manifest, key)
            previous_items.extend(
                item
                for item in (
                    old_slots.get("production"),
                    old_slots.get("candidate"),
                )
                if item
            )
            next_manifest["rows"][key] = {
                "production": {
                    "status": "accepted",
                    "file": str(destination.relative_to(ROW_DIR)),
                    "sha256": digest,
                    "provenance": candidate.get("provenance", "promoted-candidate"),
                    "note": args.note if args.note is not None else candidate.get("note", ""),
                    "acceptedAt": accepted_at,
                    "quality": quality_record(report),
                }
            }
            proof = ROW_DIR / "proofs" / f"{role}-{action}-{direction}-x4.png"
            write_proof(destination, proof, report)
        save_manifest(next_manifest)
    except BaseException:
        for path in created_paths:
            if path.is_file():
                path.unlink()
        raise

    for item in previous_items:
        remove_unreferenced_row_file(next_manifest, item)
    print(
        f"[sprite-workbench] promoted {len(prepared)} {role} row(s) "
        f"as one family transaction at {accepted_at}"
    )


def reject_candidate(args: argparse.Namespace) -> None:
    validate_target(args.role, args.action, args.dir)
    manifest = load_manifest()
    key = row_key(args.role, args.action, args.dir)
    slots = row_slots(manifest, key).copy()
    candidate = slots.pop("candidate", None)
    if not candidate:
        raise SystemExit(f"{key} has no candidate to reject")
    if slots:
        manifest["rows"][key] = slots
    else:
        manifest["rows"].pop(key, None)
    save_manifest(manifest)
    remove_unreferenced_row_file(manifest, candidate)
    print(f"[sprite-workbench] rejected candidate {key}; production source unchanged")


def migrate_manifest(_args: argparse.Namespace) -> None:
    manifest = load_manifest()
    save_manifest(manifest)
    production = sum(
        1 for key in manifest["rows"] if production_item(manifest, key)
    )
    candidates = sum(
        1 for key in manifest["rows"] if candidate_item(manifest, key)
    )
    print(
        "[sprite-workbench] actor row manifest v2 ready: "
        f"{production} production, {candidates} candidate"
    )


def extract_row(args: argparse.Namespace) -> None:
    validate_target(args.role, args.action, args.dir)
    temp = WORK_ORDER_DIR / ".extract" / f"{args.role}-{args.action}-{args.dir}.png"
    temp.parent.mkdir(parents=True, exist_ok=True)
    crop_row(args.role, args.action, args.dir).save(temp)
    args.input = temp
    accept_row(args)


def verify_manifest(_args: argparse.Namespace) -> None:
    manifest = load_manifest()
    failures: list[str] = []
    if MANIFEST_PATH.is_file():
        persisted_version = json.loads(MANIFEST_PATH.read_text()).get("version")
        if persisted_version != 2:
            failures.append(
                "manifest is readable but not persisted as version 2; "
                "run scripts/sprite-row migrate-manifest"
            )
    accepted = 0
    candidates = 0
    declared_owners: dict[Path, str] = {}
    for key, slots in sorted(manifest["rows"].items()):
        try:
            role, action, direction = key.split("/")
            validate_target(role, action, direction)
        except (ValueError, SystemExit):
            failures.append(f"{key}: invalid key")
            continue

        if not isinstance(slots, dict):
            failures.append(f"{key}: row slots must be an object")
            continue
        unexpected = sorted(set(slots) - {"production", "candidate"})
        if unexpected:
            failures.append(f"{key}: unsupported slot(s) {', '.join(unexpected)}")
        if not any(slot in slots for slot in ("production", "candidate")):
            failures.append(f"{key}: row entry has no production or candidate")

        for slot, expected_status in (
            ("production", "accepted"),
            ("candidate", "candidate"),
        ):
            item = slots.get(slot)
            if item is None:
                continue
            if not isinstance(item, dict):
                failures.append(f"{key}/{slot}: metadata must be an object")
                continue
            if item.get("status") != expected_status:
                failures.append(
                    f"{key}/{slot}: status must be {expected_status!r}, "
                    f"got {item.get('status')!r}"
                )
                continue
            if slot == "production":
                accepted += 1
            else:
                candidates += 1
            try:
                path = _manifest_row_path(item, f"{key}/{slot}")
            except SystemExit as error:
                failures.append(f"{key}/{slot}: {error}")
                continue
            owner = declared_owners.get(path)
            if owner:
                failures.append(f"{key}/{slot}: row file is also owned by {owner}")
            else:
                declared_owners[path] = f"{key}/{slot}"
            if slot == "candidate":
                relative_path = path.relative_to(ROW_DIR.resolve())
                if not relative_path.parts or relative_path.parts[0] != "candidates":
                    failures.append(
                        f"{key}/candidate: v2 candidates must live under "
                        "assets/sprites/actor-rows/candidates/"
                    )
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            if digest != item.get("sha256"):
                failures.append(f"{key}/{slot}: sha256 mismatch")
                continue
            report = add_direction_comparison(
                analyze_row(path, action),
                role,
                action,
                direction,
                reference_source="production" if slot == "production" else "review",
            )
            if report["errors"]:
                failures.append(f"{key}/{slot}: {', '.join(report['errors'])}")
            if slot == "production" and report["warnings"]:
                failures.append(
                    f"{key}/{slot}: warnings {', '.join(report['warnings'])}"
                )

    actual_files = {
        path.resolve()
        for path in ROW_DIR.rglob("*.png")
        if path.relative_to(ROW_DIR).parts[0] != "proofs"
    }
    extras = sorted(actual_files - set(declared_owners))
    for path in extras:
        failures.append(f"unmanifested row: {path.relative_to(ROOT)}")

    if failures:
        raise SystemExit("\n".join(f"[sprite-workbench] ERROR {failure}" for failure in failures))
    print(
        "[sprite-workbench] verified manifest v2: "
        f"{accepted} production override(s), {candidates} candidate(s)"
    )


def show_status(_args: argparse.Namespace) -> None:
    manifest = load_manifest()
    accepted = {
        key: production_item(manifest, key)
        for key in manifest["rows"]
        if production_item(manifest, key)
    }
    candidates = {
        key: candidate_item(manifest, key)
        for key in manifest["rows"]
        if candidate_item(manifest, key)
    }
    print(f"accepted overrides: {len(accepted)} / {len(ROLES) * len(ACTIONS) * len(DIRS)}")
    for key, item in sorted(accepted.items()):
        quality = item.get("quality", {})
        print(
            f"- {key}: status={item.get('status')} flicker={quality.get('flickerScore', '?')} "
            f"warnings={','.join(quality.get('warnings', [])) or 'none'} "
            f"source={item.get('provenance', 'unknown')}"
        )
    print(f"review candidates: {len(candidates)}")
    for key, item in sorted(candidates.items()):
        quality = item.get("quality", {})
        runtime = "LOCKED" if key in accepted else "BASE"
        print(
            f"- {key}: status=candidate runtime={runtime} "
            f"warnings={','.join(quality.get('warnings', [])) or 'none'} "
            f"source={item.get('provenance', 'unknown')}"
        )


def target_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--role", required=True, choices=ROLES)
    parser.add_argument("--action", required=True, choices=ACTIONS)
    parser.add_argument("--dir", required=True, choices=DIRS)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    create_work_order = sub.add_parser(
        "work-order",
        help="write separate trusted identity and target-action motion references",
        description=(
            "Create a repaint work order. Identity comes only from warning-free, "
            "hash-matched LOCKED adjacent actions for the same role/direction; "
            "BASE and CANDIDATE target-action rows are motion evidence only."
        ),
    )
    target_args(create_work_order)
    create_work_order.add_argument(
        "--out-dir",
        type=Path,
        help="write the work order here instead of tmp/sprite-work-orders/<role>-<action>-<dir>",
    )
    create_work_order.set_defaults(func=work_order)

    derive = sub.add_parser("derive")
    target_args(derive)
    derive.add_argument("--source-role", default="settler", choices=ROLES)
    derive.add_argument("--source-action", choices=ACTIONS)
    derive.add_argument("--source-dir", choices=DIRS)
    derive.add_argument("--out", type=Path)
    derive.set_defaults(func=derive_row)

    rescale = sub.add_parser("rescale")
    target_args(rescale)
    rescale.add_argument("--target-height", type=float, required=True)
    rescale.add_argument("--input", type=Path)
    rescale.add_argument("--out", type=Path)
    rescale.set_defaults(func=rescale_row)

    stabilize = sub.add_parser("stabilize")
    target_args(stabilize)
    stabilize.add_argument("--align-x", action=argparse.BooleanOptionalAction, default=True)
    stabilize.add_argument("--input", type=Path)
    stabilize.add_argument("--out", type=Path)
    stabilize.set_defaults(func=stabilize_row)

    scrub = sub.add_parser("scrub")
    target_args(scrub)
    scrub.add_argument("--min-keep", type=int, default=84)
    scrub.add_argument("--input", type=Path)
    scrub.add_argument("--out", type=Path)
    scrub.set_defaults(func=scrub_row)

    stance = sub.add_parser("stance")
    target_args(stance)
    stance.add_argument("--source-action", choices=ACTIONS)
    stance.add_argument("--source-dir", choices=DIRS)
    stance.add_argument("--frame", type=int)
    stance.add_argument("--out", type=Path)
    stance.set_defaults(func=stance_row)

    pulse = sub.add_parser("pulse")
    target_args(pulse)
    pulse.add_argument("--pattern", help="8 comma-separated non-negative upper-body down-shifts, default 0,0,2,1,0,0,2,1")
    pulse.add_argument("--input", type=Path)
    pulse.add_argument("--out", type=Path)
    pulse.set_defaults(func=pulse_row)

    headswap = sub.add_parser("headswap")
    target_args(headswap)
    headswap.add_argument("--head-action", default="work", choices=ACTIONS)
    headswap.add_argument("--head-dir", choices=DIRS)
    headswap.add_argument("--head-frame", type=int)
    headswap.add_argument("--hat-only", action="store_true")
    headswap.add_argument("--hat-floor", type=float, default=0.62)
    headswap.add_argument("--hat-lift", type=int, default=2)
    headswap.add_argument("--hat-hue-min", type=float, default=30)
    headswap.add_argument("--hat-hue-max", type=float, default=60)
    headswap.add_argument("--hat-sat-min", type=float, default=0.25)
    headswap.add_argument("--hat-sat-max", type=float, default=1.0)
    headswap.add_argument("--hat-val-min", type=float, default=0.35)
    headswap.add_argument("--hat-val-max", type=float, default=1.0)
    headswap.add_argument("--cloth-hex")
    headswap.add_argument("--head-scale", type=float, default=1.0)
    headswap.add_argument("--chin-extend", type=int, default=6)
    headswap.add_argument("--head-drop", type=int, default=1)
    headswap.add_argument("--cloth-filter", action=argparse.BooleanOptionalAction, default=True)
    headswap.add_argument("--out", type=Path)
    headswap.set_defaults(func=headswap_row)

    accept = sub.add_parser("accept")
    target_args(accept)
    accept.add_argument("--input", required=True, type=Path)
    accept.add_argument("--provenance", required=True)
    accept.add_argument("--note")
    accept.set_defaults(func=accept_row)

    stage = sub.add_parser("stage")
    target_args(stage)
    stage.add_argument("--input", required=True, type=Path)
    stage.add_argument("--provenance", required=True)
    stage.add_argument("--note")
    stage.set_defaults(func=stage_row)

    promote = sub.add_parser(
        "promote",
        help="promote the hash-verified candidate into production and clear its review slot",
    )
    target_args(promote)
    promote.add_argument("--note")
    promote.set_defaults(func=promote_candidate)

    promote_role = sub.add_parser(
        "promote-family",
        help="promote every staged row for a role/action set in one manifest transaction",
    )
    promote_role.add_argument("--role", required=True, choices=ROLES)
    promote_role.add_argument(
        "--actions",
        nargs="+",
        choices=ACTIONS,
        help="actions to promote; defaults to idle walk work carry",
    )
    promote_role.add_argument("--note")
    promote_role.set_defaults(func=promote_family)

    reject = sub.add_parser(
        "reject",
        help="remove a candidate without changing its production or base runtime source",
    )
    target_args(reject)
    reject.set_defaults(func=reject_candidate)

    migrate = sub.add_parser(
        "migrate-manifest",
        help="rewrite a v1 actor-row manifest into the v2 production/candidate slot schema",
    )
    migrate.set_defaults(func=migrate_manifest)

    extract = sub.add_parser("extract")
    target_args(extract)
    extract.add_argument("--provenance", required=True)
    extract.add_argument("--note")
    extract.set_defaults(func=extract_row)

    verify = sub.add_parser("verify")
    verify.set_defaults(func=verify_manifest)

    status = sub.add_parser("status")
    status.set_defaults(func=show_status)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
