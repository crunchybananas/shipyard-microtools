# 062 - actor-workpose-asymmetric-tableau-depth-pass

## Goal

Push actor bitmap work/carry motion further from puppet-like symmetry with stronger role silhouette split, deeper cloth folds, asymmetric payload cant, and clearer role-specific hand cadence.

## Starting Point

- Previous handoff: `rounds/061-actor-workpose-tableau-expressivity-pass.md`.
- Screenshots inspected: `scripts/screenshots/actors-workpose-close-round-061.png`.
- Relevant files: `scripts/build-motion-atlases.mjs`.

## Changes

- Advanced close proof export target:
  - `scripts/screenshots/actors-workpose-close-round-062.png`
- Updated proof panel label text to round 062.
- Increased `ROLE_WORKPOSE_TABLEAU` values across roles for stronger silhouette snap, fold pinch, payload cant, and pose-set breakup.
- Increased per-role tableau hand cadence and asymmetric lift values to separate left/right work-hand timing by role.

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

- `scripts/screenshots/actors-workpose-close-round-062.png`

Browser or Playwright findings:

- `node scripts/build-motion-atlases.mjs` passed and wrote:
  - `assets/sprites/actors-atlas.png`
  - `assets/sprites/ambient-atlas.png`
  - `scripts/screenshots/actors-workpose-close-round-062.png`
- `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` failed due to Chromium launch denial in this sandbox (`bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`).
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` produced no output.
- `rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" ...` produced no matches.

## Visual Result

Round 062 increases role separation in close 2D bitmap motion: labor-heavy roles now read with stronger off-axis body snap and deeper fold pinch, while carry payloads tilt and pulse with clearer asymmetric cant. Hand cadence between sides is less mirrored and reads more task-specific in `actors-workpose-close-round-062.png`.

## Remaining Issues

- Live verify scripts remain blocked in this environment by Chromium launch permissions, so runtime `verify-anim`, `verify-critic`, and full `verify.mjs --game --logic` captures could not be refreshed.

## Next Best Target

Run `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` in a Chromium-allowed environment, then tune any mirrored cadence outliers against `scripts/screenshots/actors-workpose-close-round-062.png`.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/062-actor-workpose-asymmetric-tableau-depth-pass.md`
