# 068 - actor-workpose-silhouette-torque-split-pass

## Goal

Push actor bitmap work animation farther past puppet-like mirroring by increasing heavy-role silhouette torque, cloth fold pinch spread, asymmetric payload cant, and role-specific hand cadence.

## Starting Point

- Previous handoff: `rounds/067-actor-workpose-pose-asymmetry-split-pass.md`.
- Screenshots inspected: `scripts/screenshots/actors-workpose-close-round-067.png`.
- Relevant files: `scripts/build-motion-atlases.mjs`.

## Changes

- Advanced close proof export target:
  - `scripts/screenshots/actors-workpose-close-round-068.png`
- Updated proof panel heading text to identify round 068 silhouette/torque split review.
- Increased `ROLE_WORKPOSE_TABLEAU_RAW` values across roles with stronger heavy-role boosts (`lumber`/`miner`/`builder`/`blacksmith`) for `silhouetteSnap`, `foldPinch`, `payloadCant`, `poseSet`, `handCadence`, and `asymLift`.
- Refreshed close proof rows/directions to emphasize role-specific work-pose breakup:
  - `lumber` work-right, `miner` work-left, `builder` work-right, `blacksmith` work-left, `trader` carry-right, `forager` work-left.

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

Screenshots:

- `scripts/screenshots/actors-workpose-close-round-068.png`

Browser or Playwright findings:

- `node --check ...` passed.
- `node scripts/build-motion-atlases.mjs` passed and wrote:
  - `assets/sprites/actors-atlas.png`
  - `assets/sprites/ambient-atlas.png`
  - `scripts/screenshots/actors-workpose-close-round-068.png`
- `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` failed due to Chromium launch denial in this sandbox (`bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`).
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` produced no output.
- `rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" ...` produced no matches.

## Visual Result

Round 068 increases 2D bitmap motion separation between heavy roles: torso silhouettes lean and recover with stronger directional split, cloth folds shear with clearer pinch timing, and payload mass reads with more asymmetric cant between mirrored-facing workers.

## Remaining Issues

- Playwright-based runtime verification remains blocked by Chromium launch permissions in this environment, so live `verify-anim`/`verify-critic`/`verify.mjs --game --logic` screenshots could not be refreshed.

## Next Best Target

Run Playwright-based verify scripts in a Chromium-allowed environment, then compare refreshed close captures against `scripts/screenshots/actors-workpose-close-round-068.png` and tune remaining heavy-role mirrored cadence outliers in `ROLE_WORKPOSE_TABLEAU`.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/068-actor-workpose-silhouette-torque-split-pass.md`
