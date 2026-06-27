# 060 - actor-workpose-tableau-silhouette-cadence-pass

## Goal

Push actor bitmap work/carry motion farther beyond puppet cadence via stronger role silhouettes, deeper cloth folds, heavier asymmetric payloads, and clearer role-specific hand-work rhythm.

## Starting Point

- Previous handoff: `rounds/059-actor-workpose-tableau-overdrive-pass.md`.
- Screenshots inspected: `scripts/screenshots/actors-workpose-close-round-059.png`.
- Relevant files: `scripts/build-motion-atlases.mjs`.

## Changes

- Advanced close proof export target:
  - `scripts/screenshots/actors-workpose-close-round-060.png`
- Updated proof panel label text to round 060.
- Increased `ROLE_WORKPOSE_TABLEAU` values across all roles for stronger silhouette snap, cloth fold pinch, payload cant, and pose-set spread.
- Added two new per-role tableau controls:
  - `handCadence` to force role-specific work-hand rhythm separation.
  - `asymLift` to introduce directional asymmetric lift/cant posture per role.
- Strengthened synthesis wiring:
  - increased `workposeTableauWarp` frequency/amplitude,
  - increased `workposeTableauRhythm` frequency/amplitude and hand-cadence coupling,
  - deepened late-stage tableau fold slash displacement/thickness,
  - increased tableau-driven hand-height asymmetry weighting.

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

- `scripts/screenshots/actors-workpose-close-round-060.png`

Browser or Playwright findings:

- `node scripts/build-motion-atlases.mjs` passed and wrote:
  - `assets/sprites/actors-atlas.png`
  - `assets/sprites/ambient-atlas.png`
  - `scripts/screenshots/actors-workpose-close-round-060.png`
- `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` failed due to Chromium launch denial in this sandbox (`bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`).
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` produced no output.
- `rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" ...` produced no matches.

## Visual Result

Round 060 pushes the work/carry atlas motion toward chunkier role-unique silhouettes and less mirrored cadence: heavy roles now show stronger off-axis shoulder/hand spread, cloth fold slashes read deeper and more uneven, and carry/work payloads sit with more directional cant. The close 2D proof (`actors-workpose-close-round-060.png`) confirms stronger bitmap asymmetry and role separation in the canonical 2D art path.

## Remaining Issues

- Live verifier scripts remain blocked in this environment by Chromium launch permissions, so `verify-anim`, `verify-critic`, and full `verify.mjs --game --logic` captures could not be refreshed.

## Next Best Target

Run `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` in a Chromium-allowed environment and tune any remaining mirrored work-hand outliers against `scripts/screenshots/actors-workpose-close-round-060.png`.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/060-actor-workpose-tableau-silhouette-cadence-pass.md`
