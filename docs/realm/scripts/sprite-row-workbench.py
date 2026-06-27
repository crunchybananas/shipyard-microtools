#!/usr/bin/env python3
"""Create, validate, accept, and verify canonical Realm actor rows."""

from __future__ import annotations

import argparse
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
