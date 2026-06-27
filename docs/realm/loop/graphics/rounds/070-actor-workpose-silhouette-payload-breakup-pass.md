# 070 - actor-workpose-silhouette-payload-breakup-pass

## Goal

Push actor bitmap work/carry animation farther beyond puppet-like mirroring with stronger heavy-role silhouettes, cloth-fold pinch, asymmetric payload cant, and role-specific hand cadence.

## Starting Point

- Previous handoff: `rounds/069-actor-workpose-tableau-breakup-pass.md`.
- Screenshots inspected: `scripts/screenshots/actors-workpose-close-round-069.png`.
- Relevant files: `scripts/build-motion-atlases.mjs`.

## Changes

- Advanced close proof export target:
  - `scripts/screenshots/actors-workpose-close-round-070.png`
- Updated proof panel heading text to identify round 070 silhouette/payload breakup review.
- Increased `ROLE_WORKPOSE_TABLEAU_RAW` values across roles with larger heavy-role deltas (`lumber`/`miner`/`builder`/`blacksmith`) to deepen silhouette snap, fold pinch, payload cant, pose split, hand cadence, and asym-lift.
- Updated close proof rows/directions to emphasize asymmetric work/carry contrast across heavy and payload roles:
  - `lumber` work-right, `miner` work-left, `builder` carry-right, `blacksmith` carry-left, `trader` carry-left, `forager` work-right.

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

- `scripts/screenshots/actors-workpose-close-round-070.png` (regenerated).

Browser or Playwright findings:

- `node --check ...` passed.
- `node scripts/build-motion-atlases.mjs` passed and regenerated actor/ambient atlases plus the round-070 close screenshot.
- `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` failed due to Chromium launch denial (`bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`).
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` produced no output.
- `rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" ...` produced no matches.

## Visual Result

Round 070 pushes heavier role-specific separation in the bitmap atlas generator: heavy labor roles now read with stronger side-biased silhouette torque and deeper fold pinch, while carry roles show more pronounced asymmetric payload cant and hand-cadence breakup in close 2D proof frames.

## Remaining Issues

- Playwright-driven live verification remains blocked in this sandbox because Chromium cannot launch.

## Next Best Target

Run live verify scripts where Chromium launch is allowed, then tune any remaining mirrored heavy-role cadence outliers by comparing refreshed close captures to `actors-workpose-close-round-070.png`.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `assets/sprites/actors-atlas.png`
- `assets/sprites/ambient-atlas.png`
- `scripts/screenshots/actors-workpose-close-round-070.png`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/070-actor-workpose-silhouette-payload-breakup-pass.md`
