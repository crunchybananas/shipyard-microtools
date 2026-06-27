# 072 - actor-workpose-fold-cadence-overdrive-pass

## Goal

Push actor bitmap work/carry motion farther from puppet-like mirroring by increasing role-specific silhouette snap, cloth-fold cadence breakup, and asymmetric payload cant, with close 2D proof frames for the updated atlas.

## Starting Point

- Previous handoff: `rounds/071-actor-workpose-rolepose-asymmetry-depth-pass.md`.
- Screenshots inspected: `scripts/screenshots/actors-workpose-close-round-071.png`.
- Relevant files: `scripts/build-motion-atlases.mjs`.

## Changes

- Advanced close proof export target:
  - `scripts/screenshots/actors-workpose-close-round-072.png`
- Updated proof panel heading text to identify round 072 fold-cadence overdrive review.
- Increased `ROLE_WORKPOSE_TABLEAU_RAW` values across roles, with larger heavy-role deltas (`lumber`/`miner`/`builder`/`blacksmith`) and additional asymmetry boosts for `trader` and `forager` to further separate silhouettes, fold cadence, and payload cant.
- Updated close proof rows/directions to emphasize role-specific work/carry pose reads:
  - `lumber` work-right, `miner` work-left, `builder` work-left, `blacksmith` work-right, `trader` carry-left, `forager` carry-right.

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

- `scripts/screenshots/actors-workpose-close-round-072.png` (regenerated).

Browser or Playwright findings:

- `node --check ...` passed.
- `node scripts/build-motion-atlases.mjs` passed and regenerated actor/ambient atlases plus the round-072 close screenshot.
- `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` failed due to Chromium launch denial (`bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`).
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` produced no output.
- `rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" ...` produced no matches.

## Visual Result

Round 072 deepens role-specific bitmap motion by widening work-pose silhouette separation, increasing cloth-fold cadence asymmetry, and pushing heavier payload cant in both labor and carry reads; close 2D frames now show stronger per-role pose identity instead of mirrored puppet cadence.

## Remaining Issues

- Playwright-driven live verification remains blocked in this sandbox because Chromium cannot launch.

## Next Best Target

Run live verify scripts where Chromium launch is allowed, then tune any remaining mirrored cadence outliers by comparing refreshed close captures to `actors-workpose-close-round-072.png`.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `assets/sprites/actors-atlas.png`
- `assets/sprites/ambient-atlas.png`
- `scripts/screenshots/actors-workpose-close-round-072.png`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/072-actor-workpose-fold-cadence-overdrive-pass.md`
