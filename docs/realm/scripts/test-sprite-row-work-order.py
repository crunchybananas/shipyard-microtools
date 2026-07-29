#!/usr/bin/env python3
"""Focused regression tests for sprite-row work-order reference semantics."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw


SCRIPTS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS_DIR))
MODULE_SPEC = importlib.util.spec_from_file_location(
    "sprite_row_workbench",
    SCRIPTS_DIR / "sprite-row-workbench.py",
)
if MODULE_SPEC is None or MODULE_SPEC.loader is None:
    raise RuntimeError("could not load sprite-row-workbench.py")
workbench = importlib.util.module_from_spec(MODULE_SPEC)
MODULE_SPEC.loader.exec_module(workbench)


class WorkOrderReferenceTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        self.original_paths = {
            name: getattr(workbench, name)
            for name in (
                "ROOT",
                "SPRITES",
                "BASE_DIR",
                "COMPILED_DIR",
                "ROW_DIR",
                "MANIFEST_PATH",
                "WORK_ORDER_DIR",
            )
        }
        workbench.ROOT = self.root
        workbench.SPRITES = self.root / "assets" / "sprites"
        workbench.BASE_DIR = workbench.SPRITES / "actors"
        workbench.COMPILED_DIR = workbench.SPRITES / "actors-compiled"
        workbench.ROW_DIR = workbench.SPRITES / "actor-rows"
        workbench.MANIFEST_PATH = workbench.ROW_DIR / "manifest.json"
        workbench.WORK_ORDER_DIR = self.root / "tmp" / "sprite-work-orders"
        workbench.BASE_DIR.mkdir(parents=True)
        workbench.ROW_DIR.mkdir(parents=True)
        self.sheet = self._make_role_sheet()
        self.sheet.save(workbench.BASE_DIR / "guard.png")
        self.manifest = {"version": 1, "rows": {}}

    def tearDown(self) -> None:
        for name, value in self.original_paths.items():
            setattr(workbench, name, value)
        self.temp_dir.cleanup()

    def _make_role_sheet(self) -> Image.Image:
        width = workbench.FRAME_W * workbench.FRAMES
        height = (
            len(workbench.ACTIONS)
            * len(workbench.DIRS)
            * workbench.FRAME_H
        )
        sheet = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(sheet)
        for row_index in range(len(workbench.ACTIONS) * len(workbench.DIRS)):
            row_y = row_index * workbench.FRAME_H
            for frame in range(workbench.FRAMES):
                frame_x = frame * workbench.FRAME_W
                color = (
                    55 + (row_index * 11 + frame * 3) % 150,
                    70 + (row_index * 7 + frame * 5) % 140,
                    85 + (row_index * 5 + frame * 7) % 130,
                    255,
                )
                draw.rectangle(
                    (
                        frame_x + 20 + frame % 2,
                        row_y + 10,
                        frame_x + 43 + frame % 2,
                        row_y + 77,
                    ),
                    fill=color,
                )
                draw.rectangle(
                    (
                        frame_x + 24,
                        row_y + 4,
                        frame_x + 39,
                        row_y + 20,
                    ),
                    fill=(
                        min(255, color[0] + 25),
                        min(255, color[1] + 20),
                        min(255, color[2] + 15),
                        255,
                    ),
                )
        return sheet

    def _source_row(self, action: str, direction: str) -> Image.Image:
        row_index = (
            workbench.ACTIONS.index(action) * len(workbench.DIRS)
            + workbench.DIRS.index(direction)
        )
        y = row_index * workbench.FRAME_H
        return self.sheet.crop(
            (
                0,
                y,
                workbench.FRAME_W * workbench.FRAMES,
                y + workbench.FRAME_H,
            )
        )

    def _manifest_row(
        self,
        action: str,
        direction: str,
        *,
        status: str,
        warnings: list[str] | None = None,
        valid_hash: bool = True,
    ) -> None:
        key = f"guard/{action}/{direction}"
        relative = Path("guard") / f"{action}-{direction}.png"
        path = workbench.ROW_DIR / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        self._source_row(action, direction).save(path)
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        self.manifest["rows"][key] = {
            "status": status,
            "file": str(relative),
            "sha256": digest if valid_hash else "0" * 64,
            "quality": {"warnings": warnings or []},
        }

    def _write_manifest(self) -> None:
        workbench.MANIFEST_PATH.write_text(
            json.dumps(self.manifest, indent=2) + "\n"
        )

    def test_work_order_separates_locked_identity_from_motion(self) -> None:
        self._manifest_row("idle", "down", status="accepted")
        self._manifest_row("walk", "down", status="accepted")
        self._manifest_row("carry", "down", status="candidate")
        self._write_manifest()
        out = self.root / "order"
        (out / "reference-contact.png").parent.mkdir(parents=True)
        (out / "reference-contact.png").write_bytes(b"obsolete")

        workbench.work_order(
            argparse.Namespace(
                role="guard",
                action="carry",
                dir="down",
                out_dir=out,
            )
        )

        self.assertTrue((out / "identity-reference-contact.png").is_file())
        self.assertTrue((out / "motion-reference-contact.png").is_file())
        self.assertFalse((out / "reference-contact.png").exists())
        prompt = (out / "prompt.txt").read_text()
        self.assertIn("IDENTITY AUTHORITY", prompt)
        self.assertIn("MOTION EVIDENCE ONLY", prompt)
        self.assertIn("identity-reference-contact.png always wins", prompt)

        spec = json.loads((out / "spec.json").read_text())
        self.assertEqual(spec["version"], 2)
        identity = spec["references"]["identity"]
        motion = spec["references"]["motion"]
        self.assertEqual(
            [row["key"] for row in identity["rows"]],
            ["guard/idle/down", "guard/walk/down"],
        )
        self.assertTrue(all(row["status"] == "LOCKED" for row in identity["rows"]))
        self.assertTrue(all(row["warnings"] == [] for row in identity["rows"]))
        self.assertEqual(identity["rows"][0]["identityRole"], "PRIMARY")
        self.assertEqual(motion["rows"][0]["key"], "guard/carry/down")
        self.assertEqual(motion["rows"][0]["status"], "CANDIDATE")
        self.assertEqual(spec["currentSource"]["status"], "CANDIDATE")

    def test_no_base_or_candidate_fallback_for_identity(self) -> None:
        self._manifest_row("carry", "down", status="candidate")
        self._write_manifest()

        with self.assertRaisesRegex(
            SystemExit,
            "no trusted identity reference.*BASE and CANDIDATE rows are motion evidence only",
        ):
            workbench.select_identity_references(
                self.manifest,
                "guard",
                "carry",
                "down",
            )

    def test_warning_or_hash_mismatch_disqualifies_locked_identity(self) -> None:
        self._manifest_row(
            "idle",
            "down",
            status="accepted",
            warnings=["palette-flicker"],
        )
        self._manifest_row(
            "walk",
            "down",
            status="accepted",
            valid_hash=False,
        )
        self._write_manifest()

        with self.assertRaisesRegex(
            SystemExit,
            "LOCKED-with-untrusted-warnings.*LOCKED-hash-mismatch",
        ):
            workbench.select_identity_references(
                self.manifest,
                "guard",
                "carry",
                "down",
            )


if __name__ == "__main__":
    unittest.main()
