# 066 - actor-workpose-fold-cadence-split-pass

## Goal

Push actor bitmap work/carry animation farther from puppet-like mirroring by amplifying heavy-role silhouette split, cloth-fold pinch cadence, and asymmetric payload/work pose timing.

## Starting Point

- Previous handoff: `rounds/065-actor-workpose-silhouette-load-asymmetry-pass.md`.
- Screenshots inspected: `scripts/screenshots/actors-workpose-close-round-065.png`.
- Relevant files: `scripts/build-motion-atlases.mjs`.

## Changes

- Advanced close proof export target:
  - `scripts/screenshots/actors-workpose-close-round-066.png`
- Updated proof panel heading text to identify round 066 close review.
- Increased heavy-role `ROLE_WORKPOSE_TABLEAU` values (`lumber`, `miner`, `builder`, `blacksmith`) for `silhouetteSnap`, `foldPinch`, `payloadCant`, `poseSet`, `handCadence`, and `asymLift`.
- Refreshed close proof rows/directions to force clearer left/right role cadence separation (`builder` moved to work-left, `blacksmith` to work-right, `trader` carry to left).

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

- `scripts/screenshots/actors-workpose-close-round-066.png`

Browser or Playwright findings:

- `node --check ...` passed.
- `node scripts/build-motion-atlases.mjs` passed and wrote:
  - `assets/sprites/actors-atlas.png`
  - `assets/sprites/ambient-atlas.png`
  - `scripts/screenshots/actors-workpose-close-round-066.png`
- `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` failed due to Chromium launch denial in this sandbox (`bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`).
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` produced no output.
- `rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" ...` produced no matches.

## Visual Result

Round 066 strengthens role-specific bitmap work silhouettes in close 2D playback: heavy roles now lean and recover with more distinct left/right cadence, folds pinch and release with less mirrored timing, and payload/work pose asymmetry reads more clearly between `lumber`, `miner`, `builder`, and `blacksmith` while preserving lighter `trader` carry contrast.

## Remaining Issues

- Playwright-based runtime verification remains blocked by Chromium launch permissions in this environment, so live `verify-anim`/`verify-critic`/`verify.mjs --game --logic` captures could not be refreshed.

## Next Best Target

Run Playwright-based verify scripts in a Chromium-allowed environment, then compare refreshed close captures against `scripts/screenshots/actors-workpose-close-round-066.png` and tune any remaining mirrored heavy-role cadence outliers in `ROLE_WORKPOSE_TABLEAU`.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/066-actor-workpose-fold-cadence-split-pass.md`
