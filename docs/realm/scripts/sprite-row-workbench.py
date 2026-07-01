#!/usr/bin/env python3
"""Create, validate, accept, and verify canonical Realm actor rows."""

from __future__ import annotations

import argparse
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


def row_file(role: str, action: str, direction: str) -> Path:
    return ROW_DIR / role / f"{action}-{direction}.png"


def load_manifest() -> dict:
    if not MANIFEST_PATH.exists():
        return {"version": 1, "updatedAt": now_iso(), "rows": {}}
    data = json.loads(MANIFEST_PATH.read_text())
    if data.get("version") != 1 or not isinstance(data.get("rows"), dict):
        raise SystemExit(f"invalid row manifest: {MANIFEST_PATH}")
    return data


def save_manifest(data: dict) -> None:
    ROW_DIR.mkdir(parents=True, exist_ok=True)
    data["updatedAt"] = now_iso()
    MANIFEST_PATH.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n")


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


def comparison_row(role: str, action: str, direction: str) -> Image.Image:
    manifest = load_manifest()
    item = manifest["rows"].get(row_key(role, action, direction))
    if item and item.get("status") in ("candidate", "accepted", "accepted-with-waiver"):
        path = ROW_DIR / item.get("file", "")
        if path.is_file():
            return Image.open(path).convert("RGBA")
    return crop_row(role, action, direction)


def add_direction_comparison(report: dict, role: str, action: str, direction: str) -> dict:
    peers = []
    for peer_dir in DIRS:
        if peer_dir == direction:
            continue
        with tempfile.NamedTemporaryFile(suffix=".png") as handle:
            comparison_row(role, action, peer_dir).save(handle.name)
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
    if height_delta > 8 or width_delta > 10:
        report["warnings"].append("direction-scale-mismatch")
    if palette_delta > 35:
        report["warnings"].append("direction-palette-mismatch")
    report["warnings"] = list(dict.fromkeys(report["warnings"]))
    return report


def make_contact(role: str, action: str, direction: str, out: Path) -> None:
    image = Image.open(source_sheet(role)).convert("RGBA")
    entries = [
        (f"target {action}/{direction}", action, direction, 4),
    ]
    entries.extend((f"{action}/{item}", action, item, 2) for item in DIRS if item != direction)
    width = FRAME_W * FRAMES * 4
    heights = [FRAME_H * scale + 28 for _, _, _, scale in entries]
    contact = Image.new("RGBA", (width, sum(heights)), (15, 20, 24, 255))
    draw = ImageDraw.Draw(contact)
    y_out = 0
    for (label, row_action, row_dir, scale), height in zip(entries, heights):
        row_index = ACTIONS.index(row_action) * len(DIRS) + DIRS.index(row_dir)
        strip = image.crop((0, row_index * FRAME_H, FRAME_W * FRAMES, (row_index + 1) * FRAME_H))
        draw.text((8, y_out + 6), label, fill=(232, 237, 240, 255))
        contact.alpha_composite(
            strip.resize((FRAME_W * FRAMES * scale, FRAME_H * scale), Image.Resampling.NEAREST),
            (0, y_out + 28),
        )
        y_out += height
    out.parent.mkdir(parents=True, exist_ok=True)
    contact.save(out)


def work_order(args: argparse.Namespace) -> None:
    validate_target(args.role, args.action, args.dir)
    key = row_key(args.role, args.action, args.dir)
    out = WORK_ORDER_DIR / key.replace("/", "-")
    out.mkdir(parents=True, exist_ok=True)
    current = crop_row(args.role, args.action, args.dir)
    current_path = out / "current-row.png"
    current.save(current_path)
    current.resize((current.width * 4, current.height * 4), Image.Resampling.NEAREST).save(out / "current-row-x4.png")
    make_contact(args.role, args.action, args.dir, out / "reference-contact.png")
    report = add_direction_comparison(analyze_row(current_path, args.action), args.role, args.action, args.dir)
    (out / "current-quality.json").write_text(json.dumps(report, indent=2) + "\n")

    prompt = f"""Use case: stylized-concept
Asset type: Realm game actor animation source
Primary request: Create exactly eight animation poses for {args.role} performing {args.action}, facing {args.dir}.
Input images: Reference contact sheet defines the exact character identity, body scale, palette, painted pixel-cluster style, and direction.
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
        "version": 1,
        "key": key,
        "role": args.role,
        "action": args.action,
        "dir": args.dir,
        "expectedPackedSize": [FRAME_W * FRAMES, FRAME_H],
        "chromaKey": "#ff00ff",
        "reference": "reference-contact.png",
        "currentRow": "current-row.png",
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
    source_item = manifest["rows"].get(row_key(source_role, source_action, source_dir))
    if source_item and source_item.get("status") in ("accepted", "accepted-with-waiver"):
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
    body_item = manifest["rows"].get(row_key("settler", args.action, args.dir))
    if not body_item or body_item.get("status") not in ("accepted", "accepted-with-waiver"):
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


def accept_row(args: argparse.Namespace) -> None:
    validate_target(args.role, args.action, args.dir)
    source = args.input.resolve()
    report = add_direction_comparison(analyze_row(source, args.action), args.role, args.action, args.dir)
    if report["errors"]:
        raise SystemExit(f"row has errors: {', '.join(report['errors'])}")
    allowed = sorted(set(args.allow_warning or []))
    unapproved = [warning for warning in report["warnings"] if warning not in allowed]
    if unapproved:
        raise SystemExit(
            "row has unapproved warnings: "
            + ", ".join(unapproved)
            + "; pass --allow-warning for deliberate exceptions"
        )

    destination = row_file(args.role, args.action, args.dir)
    destination.parent.mkdir(parents=True, exist_ok=True)
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

    manifest = load_manifest()
    key = row_key(args.role, args.action, args.dir)
    status = "accepted-with-waiver" if copied_report["warnings"] else "accepted"
    manifest["rows"][key] = {
        "status": status,
        "file": str(destination.relative_to(ROW_DIR)),
        "sha256": digest,
        "provenance": args.provenance,
        "note": args.note or "",
        "acceptedAt": now_iso(),
        "allowedWarnings": allowed,
        "quality": {
            key: copied_report[key]
            for key in (
                "flickerScore", "bodyHeightRange", "bodyWidthRange", "bodyBottomRange",
                "medianBodyHeight", "medianBodyWidth", "medianColor", "directionReference",
                "styleEra", "medianColorCount", "medianShadingRatio",
                "maxBodyCenterJump", "maxAlphaRatio", "maxPaletteDrift",
                "maxFragmentPixels", "maxEdgePixels", "warnings",
            )
        },
    }
    save_manifest(manifest)
    print(f"[sprite-workbench] {status} {key}")
    print(f"[sprite-workbench] row {destination}")
    print(f"[sprite-workbench] proof {proof}")


def stage_row(args: argparse.Namespace) -> None:
    validate_target(args.role, args.action, args.dir)
    source = args.input.resolve()
    report = add_direction_comparison(analyze_row(source, args.action), args.role, args.action, args.dir)
    if report["errors"]:
        raise SystemExit(f"row has errors: {', '.join(report['errors'])}")
    destination = row_file(args.role, args.action, args.dir)
    destination.parent.mkdir(parents=True, exist_ok=True)
    if source != destination.resolve():
        shutil.copyfile(source, destination)
    digest = hashlib.sha256(destination.read_bytes()).hexdigest()
    proof = ROW_DIR / "proofs" / f"{args.role}-{args.action}-{args.dir}-candidate-x4.png"
    write_proof(destination, proof, report)

    manifest = load_manifest()
    key = row_key(args.role, args.action, args.dir)
    manifest["rows"][key] = {
        "status": "candidate",
        "file": str(destination.relative_to(ROW_DIR)),
        "sha256": digest,
        "provenance": args.provenance,
        "note": args.note or "",
        "stagedAt": now_iso(),
        "allowedWarnings": [],
        "quality": {
            key: report[key]
            for key in (
                "flickerScore", "bodyHeightRange", "bodyWidthRange", "bodyBottomRange",
                "medianBodyHeight", "medianBodyWidth", "medianColor", "directionReference",
                "styleEra", "medianColorCount", "medianShadingRatio",
                "maxBodyCenterJump", "maxAlphaRatio", "maxPaletteDrift",
                "maxFragmentPixels", "maxEdgePixels", "warnings",
            )
        },
    }
    save_manifest(manifest)
    print(f"[sprite-workbench] staged candidate {key}")
    print(f"[sprite-workbench] warnings {','.join(report['warnings']) or 'none'}")
    print(f"[sprite-workbench] proof {proof}")


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
    accepted = 0
    declared_files: set[Path] = set()
    for key, item in sorted(manifest["rows"].items()):
        path = ROW_DIR / item.get("file", "")
        if item.get("file"):
            declared_files.add(path.resolve())
        if item.get("status") not in ("accepted", "accepted-with-waiver"):
            continue
        accepted += 1
        try:
            role, action, direction = key.split("/")
            validate_target(role, action, direction)
        except (ValueError, SystemExit):
            failures.append(f"{key}: invalid key")
            continue
        if not path.is_file():
            failures.append(f"{key}: missing {path}")
            continue
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest != item.get("sha256"):
            failures.append(f"{key}: sha256 mismatch")
        report = add_direction_comparison(analyze_row(path, action), role, action, direction)
        if report["errors"]:
            failures.append(f"{key}: {', '.join(report['errors'])}")
        allowed = set(item.get("allowedWarnings", []))
        unapproved = [warning for warning in report["warnings"] if warning not in allowed]
        if unapproved:
            failures.append(f"{key}: unapproved warnings {', '.join(unapproved)}")

    actual_files = {
        path.resolve()
        for path in ROW_DIR.glob("*/*.png")
        if path.parent.name != "proofs"
    }
    extras = sorted(actual_files - declared_files)
    for path in extras:
        failures.append(f"unmanifested row: {path.relative_to(ROOT)}")

    if failures:
        raise SystemExit("\n".join(f"[sprite-workbench] ERROR {failure}" for failure in failures))
    print(f"[sprite-workbench] verified {accepted} accepted row override(s)")


def show_status(_args: argparse.Namespace) -> None:
    manifest = load_manifest()
    accepted = {
        key: value
        for key, value in manifest["rows"].items()
        if value.get("status") in ("accepted", "accepted-with-waiver")
    }
    print(f"accepted overrides: {len(accepted)} / {len(ROLES) * len(ACTIONS) * len(DIRS)}")
    for key, item in sorted(accepted.items()):
        quality = item.get("quality", {})
        print(
            f"- {key}: status={item.get('status')} flicker={quality.get('flickerScore', '?')} "
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

    create_work_order = sub.add_parser("work-order")
    target_args(create_work_order)
    create_work_order.set_defaults(func=work_order)

    derive = sub.add_parser("derive")
    target_args(derive)
    derive.add_argument("--source-role", default="settler", choices=ROLES)
    derive.add_argument("--source-action", choices=ACTIONS)
    derive.add_argument("--source-dir", choices=DIRS)
    derive.add_argument("--out", type=Path)
    derive.set_defaults(func=derive_row)

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
    accept.add_argument("--allow-warning", action="append", default=[])
    accept.set_defaults(func=accept_row)

    stage = sub.add_parser("stage")
    target_args(stage)
    stage.add_argument("--input", required=True, type=Path)
    stage.add_argument("--provenance", required=True)
    stage.add_argument("--note")
    stage.set_defaults(func=stage_row)

    extract = sub.add_parser("extract")
    target_args(extract)
    extract.add_argument("--provenance", required=True)
    extract.add_argument("--note")
    extract.add_argument("--allow-warning", action="append", default=[])
    extract.set_defaults(func=extract_row)

    verify = sub.add_parser("verify")
    verify.set_defaults(func=verify_manifest)

    status = sub.add_parser("status")
    status.set_defaults(func=show_status)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
