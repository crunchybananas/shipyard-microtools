# 014 - actor-gesture-cloth-shear

## Goal

Push actor bitmap motion beyond puppet-like cadence by adding stronger role-specific work-pose gesture bias: elbow lift, reach skew, cloth shear, and asymmetric carry-load tilt.

## Starting Point

- Previous handoff: `rounds/013-actor-silhouette-load-breakup.md`.
- Baseline artifacts: `assets/sprites/actors-atlas.png`, `assets/sprites/ambient-atlas.png`.
- Relevant files: `scripts/build-motion-atlases.mjs`, `loop/graphics/CURRENT.md`, `loop/graphics/BACKLOG.md`.

## Changes

- Added `ROLE_GESTURE` role map in `scripts/build-motion-atlases.mjs` with:
  - `elbowLift`
  - `reachBias`
  - `clothShear`
  - `loadTilt`
- Wired `ROLE_GESTURE` into actor motion generation:
  - extra diagonal cloth-shear fold lines that shift by role/work pose,
  - role-biased elbow lift offsets on both arms so work/carry gestures read less mirrored,
  - carry payload tilt phase to break static bundle orientation during movement.
- Kept all changes in the canonical painted PNG atlas pipeline.
- Rebuilt atlases with `node scripts/build-motion-atlases.mjs`.

## Verification

Commands run:

```sh
node --check js/render.js js/ui.js js/main.js js/input.js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs
node scripts/build-motion-atlases.mjs
node scripts/verify-anim.mjs
node scripts/verify-critic.mjs
node scripts/verify.mjs --game --logic
find assets/sprites -maxdepth 1 -name '*.svg' -print
rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" index.html js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs assets/sprites/README.md
```

Results:

- `node --check ...` passed.
- `node scripts/build-motion-atlases.mjs` passed and rewrote:
  - `assets/sprites/actors-atlas.png`
  - `assets/sprites/ambient-atlas.png`
- `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` failed at Chromium launch with sandbox denial:
  `bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`.
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` returned no files.
- `rg -n ...` returned no matches (exit code `1`).

## Visual Result

Role motion silhouettes now show stronger pose identity in the baked atlas:
heavier labor roles (builder/blacksmith/miner/lumber) lift and torque arm/cloth masses more aggressively, while lighter roles keep tighter, less forceful gestures. Carry bundles now tilt and sway with role-dependent asymmetry instead of reading as rigid mirrored props.

## Remaining Issues

- Chromium launch remains blocked in this sandbox, so refreshed close 2D screenshots were not captured this round.
- `scripts/screenshots/anim-live-actors-close.png` still needs capture in a Chromium-allowed environment.
- `scripts/screenshots/critic-zoom-close.png` should be refreshed after the round 014 gesture pass.

## Next Best Target

Run `verify-anim`, `verify-critic`, and `verify.mjs --game --logic` where Chromium can launch, capture refreshed close actor screenshots, then tune any remaining mirrored role cadence visible after rounds 009-014.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `assets/sprites/actors-atlas.png`
- `assets/sprites/ambient-atlas.png`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/014-actor-gesture-cloth-shear.md`
