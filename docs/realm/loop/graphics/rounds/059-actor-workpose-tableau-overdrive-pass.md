# 059 - actor-workpose-tableau-overdrive-pass

## Goal

Push actor bitmap work/carry motion farther past puppet cadence with stronger role-specific tableau silhouette snap, deeper cloth pinch/fold breakup, stronger asymmetric payload cant, and heavier role-specific hand-cadence separation.

## Starting Point

- Previous handoff: `rounds/058-actor-workpose-silhouette-breakup-pass.md`.
- Relevant files: `scripts/build-motion-atlases.mjs`.
- Chromium-backed verifier scripts remain sandbox-constrained in this environment.

## Changes

- Advanced close proof export target:
  - `scripts/screenshots/actors-workpose-close-round-059.png`
- Updated proof panel label text to round 059.
- Increased `ROLE_WORKPOSE_TABLEAU` values across all roles to further strengthen:
  - silhouette snap,
  - cloth fold pinch,
  - asymmetric payload cant,
  - role-specific pose-set cadence.
- Increased tableau dynamics in synthesis:
  - stronger `workposeTableauWarp` frequency/amplitude and stronger silhouette coupling,
  - stronger `workposeTableauRhythm` cadence frequency/amplitude,
  - stronger body drift weight from `workposeTableau.silhouetteSnap`.

## Verification

Commands run:

```sh
node --check js/render.js js/ui.js js/main.js js/input.js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs
node --check scripts/build-motion-atlases.mjs
node scripts/build-motion-atlases.mjs
node scripts/verify-anim.mjs
node scripts/verify-critic.mjs
node scripts/verify.mjs --game --logic
find assets/sprites -maxdepth 1 -name '*.svg' -print
rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" index.html js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs assets/sprites/README.md
```

Results:

- `node --check ...` passed.
- `node --check scripts/build-motion-atlases.mjs` passed.
- `node scripts/build-motion-atlases.mjs` failed: Chromium launch denial (`bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`).
- `node scripts/verify-anim.mjs` failed with the same Chromium launch denial.
- `node scripts/verify-critic.mjs` failed with the same Chromium launch denial.
- `node scripts/verify.mjs --game --logic` failed with the same Chromium launch denial.
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` produced no output.
- `rg -n ...` produced no matches.

## Visual Result

Round 059 deepens role-separated labor silhouettes and cloth/payload asymmetry in the atlas motion synthesis path, with stronger body drift and cadence breakup wiring around tableau controls. A fresh live close PNG proof could not be generated here because Chromium cannot launch in this sandbox.

## Remaining Issues

- Playwright-driven atlas bake and live verifier screenshots (`build-motion-atlases`, `verify-anim`, `verify-critic`, `verify.mjs --game --logic`) remain blocked by Chromium launch denial in this sandbox.

## Next Best Target

Run `node scripts/build-motion-atlases.mjs`, `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` in a Chromium-allowed environment, then compare refreshed close captures to verify round-059 silhouette/cloth/payload/hand-cadence gains and tune any remaining mirrored role outliers.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/059-actor-workpose-tableau-overdrive-pass.md`
