# 073 - actor-workpose-role-tableau-breakup-pass

## Goal

Push actor bitmap motion beyond clean puppet mirroring with stronger role silhouettes, deeper cloth-fold breakup, heavier asymmetric payload cant, and role-specific work/carry pose bias proven by a fresh close 2D proof sheet.

## Starting Point

- Previous handoff: `rounds/072-actor-workpose-fold-cadence-overdrive-pass.md`.
- Screenshots inspected: `scripts/screenshots/actors-workpose-close-round-072.png`.
- Relevant files: `scripts/build-motion-atlases.mjs`.

## Changes

- Advanced close proof export target:
  - `scripts/screenshots/actors-workpose-close-round-073.png`
- Updated proof panel heading text to identify round 073 role/tableau breakup review.
- Increased `ROLE_WORKPOSE_TABLEAU_RAW` values across roles with heavier deltas for `lumber`/`miner`/`builder`/`blacksmith` and stronger asymmetry for `trader`/`forager` so silhouette snap, fold pinch cadence, asymmetric payload cant, and hand timing separate more clearly.
- Updated close proof rows/directions to expose role-specific reads under mixed work/carry load:
  - `lumber` work-right, `miner` work-left, `builder` carry-right, `blacksmith` work-left, `trader` work-left, `forager` work-right.

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

- `scripts/screenshots/actors-workpose-close-round-073.png` (regenerated).

Browser or Playwright findings:

- `node --check ...` passed.
- `node scripts/build-motion-atlases.mjs` passed and regenerated actor/ambient atlases plus the round-073 close screenshot.
- `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` failed due to Chromium launch denial (`bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`).
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` produced no output.
- `rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" ...` produced no matches.

## Visual Result

Round 073 further breaks mirrored motion in the canonical 2D bitmap actor pass: heavy labor roles read chunkier and less synchronized, cloth folds rake/pinch with clearer role-specific cadence, and trader/forager carry-vs-work asymmetry reads stronger in close proof frames.

## Remaining Issues

- Playwright-driven live verification remains blocked in this sandbox because Chromium cannot launch.

## Next Best Target

Run live verify scripts where Chromium launch is allowed, then compare refreshed close captures against `actors-workpose-close-round-073.png` and tune any remaining mirrored cadence outliers (especially heavy-role work vs carry timing).

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `assets/sprites/actors-atlas.png`
- `assets/sprites/ambient-atlas.png`
- `scripts/screenshots/actors-workpose-close-round-073.png`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/073-actor-workpose-role-tableau-breakup-pass.md`
