# 074 - actor-workpose-payload-cant-breakup-pass

## Goal

Push actor bitmap work/carry motion further past puppet-like mirroring with stronger silhouettes, deeper cloth-fold breakup, and more asymmetric role payload cants, with fresh close 2D proof frames.

## Starting Point

- Previous handoff: `rounds/073-actor-workpose-role-tableau-breakup-pass.md`.
- Screenshot inspected: `scripts/screenshots/actors-workpose-close-round-073.png`.
- Relevant files: `scripts/build-motion-atlases.mjs`.

## Changes

- Advanced close proof export target:
  - `scripts/screenshots/actors-workpose-close-round-074.png`
- Updated proof panel heading text to identify round 074 silhouette/fold/payload-asymmetry review.
- Increased `ROLE_WORKPOSE_TABLEAU_RAW` values across all roles and pushed stronger deltas for heavy labor roles (`lumber`/`miner`/`builder`/`blacksmith`) with additional asymmetry boosts for `trader` and `forager` to deepen silhouette snap, cloth-fold pinch cadence, payload cant breakup, and hand timing split.
- Updated close proof rows/directions to expose role-specific carries and work reads under stronger asymmetry:
  - `lumber` carry-right, `miner` carry-left, `builder` work-right, `blacksmith` carry-left, `trader` work-right, `forager` carry-left.

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

- `scripts/screenshots/actors-workpose-close-round-074.png` (regenerated).

Browser or Playwright findings:

- `node --check ...` passed.
- `node scripts/build-motion-atlases.mjs` passed and regenerated actor/ambient atlases plus the round-074 close screenshot.
- `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` failed due to Chromium launch denial (`bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`).
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` produced no output.
- `rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" ...` produced no matches.

## Visual Result

Round 074 increases role-specific read in close 2D frames: heavy labor roles carry more lopsided body mass and payload cant, cloth folds break more unevenly through cadence, and trader/forager asymmetry separates work and carry beats more clearly.

## Remaining Issues

- Playwright-driven live verification remains blocked in this sandbox because Chromium cannot launch.

## Next Best Target

Run live verify scripts where Chromium launch is allowed, then compare refreshed close captures against `actors-workpose-close-round-074.png` and tune any remaining mirrored cadence outliers (especially heavy-role work-vs-carry timing and trader/forager asymmetry).

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `assets/sprites/actors-atlas.png`
- `assets/sprites/ambient-atlas.png`
- `scripts/screenshots/actors-workpose-close-round-074.png`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/074-actor-workpose-payload-cant-breakup-pass.md`
