# Realm Graphics Push Loop

Purpose: keep every graphics round small, visual, verified, and easy
for the next round to continue.

This loop is for art/rendering/assets only. Gameplay support changes are
allowed only when a graphics feature cannot be verified without them.

## Start Of Round

1. Read this file.
2. Read `CURRENT.md`.
3. Read the newest file in `rounds/`.
4. If this is an automation wake, skim `AUTOMATION_HANDOFF.md` for any
   scheduler notes or current user constraints.
5. Pick one target from `BACKLOG.md`.
6. State the target in one sentence before editing.

Do not start by surveying the whole system. Stay in this Realm folder
unless the user explicitly asks otherwise.

## Push Rule

Each round must leave the game visually better in at least one of these
ways:

- New or improved painted bitmap art.
- Better live integration of existing painted atlases.
- More visible building state: construction, damage, upgrade, fire,
  selection, wall connections.
- Better canonical 2D rendering, where the player-facing game now lives.
- Better visual verification harnesses that make future art regressions
  harder to miss.

Pure review-only rounds are allowed only when they produce a ranked
shot-backed target list and update `BACKLOG.md`.

## Current Art Direction

- Painted raster atlases are the live source of truth.
- Do not add live SVG fallbacks.
- Do not add procedural canvas line-art fallbacks for buildings.
- If a bitmap sheet is missing or not loaded, skip the sprite and fix the
  atlas path; do not silently draw legacy primitives.
- Prefer bitmap-painterly forms, texture, shadow, and asymmetry over
  clean vector outlines.

## Required Verification

Run the checks that match the files touched. For normal graphics rounds,
use this full queue:

```sh
node --check js/render.js js/ui.js js/main.js js/input.js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs
node scripts/verify-all-sprite-maps.mjs
node scripts/verify-anim.mjs
node scripts/verify-critic.mjs
node scripts/verify.mjs --game --logic
```

Also run this invariant check whenever live art paths change:

```sh
find assets/sprites -maxdepth 1 -name '*.svg' -print
rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" index.html js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs assets/sprites/README.md
```

Expected: no retired sprite SVG files and no live SVG loader/toggle/sandbox
references.

When possible, use the in-app browser or Playwright to capture at least
one live screenshot. Put screenshot paths in the round handoff.

## End Of Round

Every round must update all three:

1. `CURRENT.md` - latest state, next target, verification status.
2. `BACKLOG.md` - move completed work to Done, add newly discovered
   visual issues.
3. `rounds/NNN-short-name.md` - a durable handoff using `TEMPLATE.md`.

The handoff must include:

- The visual goal.
- Files changed.
- Before/after evidence, preferably screenshot paths.
- Verification commands and outcomes.
- Remaining visual issues.
- The single best next target.

## Stop Conditions

Stop and ask the user if:

- A required change would delete or overwrite unrelated user work.
- Visual verification repeatedly fails for environmental reasons.
- The next useful step requires brand-new art direction from the user.
