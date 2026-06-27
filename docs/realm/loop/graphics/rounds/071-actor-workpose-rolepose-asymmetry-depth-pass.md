# 071 - actor-workpose-rolepose-asymmetry-depth-pass

## Goal

Push actor bitmap work/carry animation farther beyond puppet-like mirroring with stronger role silhouettes, deeper cloth-fold torsion, asymmetric payload cant, and role-specific work poses.

## Starting Point

- Previous handoff: `rounds/070-actor-workpose-silhouette-payload-breakup-pass.md`.
- Screenshots inspected: `scripts/screenshots/actors-workpose-close-round-070.png`.
- Relevant files: `scripts/build-motion-atlases.mjs`.

## Changes

- Advanced close proof export target:
  - `scripts/screenshots/actors-workpose-close-round-071.png`
- Updated proof panel heading text to identify round 071 rolepose/asymmetry depth review.
- Increased `ROLE_WORKPOSE_TABLEAU_RAW` values across roles, with larger heavy-role deltas (`lumber`/`miner`/`builder`/`blacksmith`) to deepen silhouette snap, cloth-fold torsion, payload cant, pose split, and hand cadence/asym-lift.
- Updated close proof rows/directions to emphasize role-specific work/carry pose reads:
  - `lumber` work-right, `miner` work-left, `builder` work-right, `blacksmith` carry-left, `trader` carry-right, `forager` work-left.

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

- `scripts/screenshots/actors-workpose-close-round-071.png` (regenerated).

Browser or Playwright findings:

- `node --check ...` passed.
- `node scripts/build-motion-atlases.mjs` passed and regenerated actor/ambient atlases plus the round-071 close screenshot.
- `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` failed due to Chromium launch denial (`bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`).
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` produced no output.
- `rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" ...` produced no matches.

## Visual Result

Round 071 increases role-specific bitmap pose separation in the atlas generator: heavy labor roles read with stronger silhouette torque and deeper fold torsion, while payload roles show clearer side-biased carry cant and hand-cadence asymmetry in close 2D proof frames.

## Remaining Issues

- Playwright-driven live verification remains blocked in this sandbox because Chromium cannot launch.

## Next Best Target

Run live verify scripts where Chromium launch is allowed, then tune any remaining mirrored cadence outliers by comparing refreshed close captures to `actors-workpose-close-round-071.png`.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `assets/sprites/actors-atlas.png`
- `assets/sprites/ambient-atlas.png`
- `scripts/screenshots/actors-workpose-close-round-071.png`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/071-actor-workpose-rolepose-asymmetry-depth-pass.md`
