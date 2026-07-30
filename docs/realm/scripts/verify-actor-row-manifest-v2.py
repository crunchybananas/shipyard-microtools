#!/usr/bin/env python3
"""Exercise actor-row v1 migration and v2 candidate/production isolation."""

from __future__ import annotations

import argparse
import copy
import hashlib
import importlib.util
import json
import shutil
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "scripts" / "sprite-row-workbench.py"
sys.path.insert(0, str(SCRIPT.parent))
SPEC = importlib.util.spec_from_file_location("realm_sprite_row_workbench", SCRIPT)
if SPEC is None or SPEC.loader is None:
    raise SystemExit(f"cannot import {SCRIPT}")
WORKBENCH = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(WORKBENCH)


def command_args(**values: object) -> argparse.Namespace:
    defaults = {
        "role": "guard",
        "action": "idle",
        "dir": "down",
        "input": None,
        "provenance": "manifest-v2-self-test",
        "note": "isolated workflow verification",
    }
    defaults.update(values)
    return argparse.Namespace(**defaults)


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> None:
    source_manifest = WORKBENCH.load_manifest()
    key = "guard/idle/down"
    source_production = WORKBENCH.production_item(source_manifest, key)
    require(source_production is not None, f"{key} must have production authority")
    production_source_path = WORKBENCH.ROW_DIR / source_production["file"]
    candidate_source_root = (
        ROOT
        / "assets/sprites/prototypes/actor-pose/output/a5-guard-actions"
        / "rows/watchman/watch-blue"
    )
    candidate_source_path = candidate_source_root / "idle-down.png"
    require(production_source_path.is_file(), f"missing production fixture {production_source_path}")
    require(candidate_source_path.is_file(), f"missing candidate fixture {candidate_source_path}")

    original_paths = {
        "ROW_DIR": WORKBENCH.ROW_DIR,
        "MANIFEST_PATH": WORKBENCH.MANIFEST_PATH,
        "WORK_ORDER_DIR": WORKBENCH.WORK_ORDER_DIR,
    }
    try:
        with tempfile.TemporaryDirectory(prefix="realm-row-manifest-v2-") as temp_name:
            temp_root = Path(temp_name)
            row_dir = temp_root / "actor-rows"
            legacy_relative = Path("guard/idle-down.png")
            legacy_path = row_dir / legacy_relative
            legacy_path.parent.mkdir(parents=True)
            shutil.copyfile(production_source_path, legacy_path)

            v1_item = copy.deepcopy(source_production)
            v1_item["file"] = str(legacy_relative)
            v1_manifest = {
                "version": 1,
                "updatedAt": "2026-01-01T00:00:00Z",
                "rows": {key: v1_item},
            }
            manifest_path = row_dir / "manifest.json"
            manifest_path.write_text(json.dumps(v1_manifest, indent=2) + "\n")

            WORKBENCH.ROW_DIR = row_dir
            WORKBENCH.MANIFEST_PATH = manifest_path
            WORKBENCH.WORK_ORDER_DIR = temp_root / "work-orders"

            migrated = WORKBENCH.load_manifest()
            require(migrated["version"] == 2, "v1 manifest did not normalize to v2")
            require(
                WORKBENCH.production_item(migrated, key)["sha256"]
                == source_production["sha256"],
                "v1 migration changed the production hash",
            )
            require(
                WORKBENCH.candidate_item(migrated, key) is None,
                "v1 accepted row unexpectedly became a candidate",
            )

            runtime_before = WORKBENCH.crop_row("guard", "idle", "down").tobytes()
            WORKBENCH.stage_row(command_args(input=candidate_source_path))
            staged = json.loads(manifest_path.read_text())
            require(staged["version"] == 2, "stage did not persist manifest v2")
            require(
                WORKBENCH.production_item(staged, key)["sha256"]
                == source_production["sha256"],
                "staging changed the production authority",
            )
            candidate = WORKBENCH.candidate_item(staged, key)
            require(candidate is not None, "stage did not create a candidate slot")
            require(
                candidate["file"] == "candidates/guard/idle-down.png",
                "candidate was not isolated under the candidates directory",
            )
            require(
                WORKBENCH.crop_row("guard", "idle", "down").tobytes() == runtime_before,
                "staging changed the compiled runtime crop",
            )
            WORKBENCH.verify_manifest(command_args())

            WORKBENCH.reject_candidate(command_args())
            rejected = json.loads(manifest_path.read_text())
            require(
                WORKBENCH.production_item(rejected, key)["sha256"]
                == source_production["sha256"],
                "reject changed the production authority",
            )
            require(
                WORKBENCH.candidate_item(rejected, key) is None,
                "reject left candidate metadata behind",
            )
            require(
                not (row_dir / "candidates/guard/idle-down.png").exists(),
                "reject left the candidate file behind",
            )

            for direction in WORKBENCH.DIRS:
                WORKBENCH.stage_row(
                    command_args(
                        dir=direction,
                        input=candidate_source_root / f"idle-{direction}.png",
                    )
                )
            WORKBENCH.promote_family(
                command_args(
                    actions=["idle"],
                    note="promoted self-test candidate family",
                )
            )
            promoted = json.loads(manifest_path.read_text())
            promoted_item = WORKBENCH.production_item(promoted, key)
            require(promoted_item is not None, "promote removed production authority")
            require(
                promoted_item["sha256"]
                == hashlib.sha256(candidate_source_path.read_bytes()).hexdigest(),
                "promote did not lock the candidate bytes",
            )
            require(
                WORKBENCH.candidate_item(promoted, key) is None,
                "promote did not clear the candidate slot",
            )
            require(
                promoted_item["file"]
                == f"production/guard/idle-down-{promoted_item['sha256'][:12]}.png",
                "promote did not isolate the production file",
            )
            WORKBENCH.verify_manifest(command_args())

            for direction in WORKBENCH.DIRS:
                WORKBENCH.stage_row(
                    command_args(
                        dir=direction,
                        input=candidate_source_root / f"idle-{direction}.png",
                    )
                )
            corrupted = row_dir / "candidates/guard/idle-down.png"
            corrupted.write_bytes(corrupted.read_bytes() + b"manifest-v2-corruption")
            manifest_before_failed_promotion = manifest_path.read_bytes()
            production_before_failed_promotion = {
                direction: WORKBENCH.production_item(
                    json.loads(manifest_path.read_text()),
                    f"guard/idle/{direction}",
                )["sha256"]
                for direction in WORKBENCH.DIRS
            }
            try:
                WORKBENCH.promote_family(
                    command_args(actions=["idle"], note="must not promote")
                )
            except SystemExit as error:
                require(
                    "hash does not match" in str(error),
                    f"corrupt family promotion failed for the wrong reason: {error}",
                )
            else:
                raise AssertionError("corrupt candidate family was promoted")
            require(
                manifest_path.read_bytes() == manifest_before_failed_promotion,
                "failed family promotion changed the manifest",
            )
            after_failed_promotion = json.loads(manifest_path.read_text())
            require(
                {
                    direction: WORKBENCH.production_item(
                        after_failed_promotion,
                        f"guard/idle/{direction}",
                    )["sha256"]
                    for direction in WORKBENCH.DIRS
                }
                == production_before_failed_promotion,
                "failed family promotion changed production locks",
            )
            try:
                WORKBENCH.verify_manifest(command_args())
            except SystemExit as error:
                require(
                    "sha256 mismatch" in str(error),
                    f"corrupt candidate failed for the wrong reason: {error}",
                )
            else:
                raise AssertionError("candidate hash corruption was not detected")
    finally:
        for name, value in original_paths.items():
            setattr(WORKBENCH, name, value)

    print(
        "[actor-row-manifest-v2] PASS — migration, stage, reject, atomic family promotion, "
        "runtime isolation, and candidate hash locking verified"
    )


if __name__ == "__main__":
    main()
