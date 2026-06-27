# 035 - actor-workpose-weight-pass

## Goal

Push actor bitmap motion further away from mirrored puppet motion by adding heavier role-specific silhouette drop, cloth crush folds, asymmetric payload lurch, and work-hand load offsets.

## Starting Point

- Previous handoff: `rounds/034-actor-workpose-torque-layer.md`.
- Screenshots inspected: none in this sandbox (Chromium launch remains blocked).
- Relevant files: `scripts/build-motion-atlases.mjs`, `assets/sprites/actors-atlas.png`, `assets/sprites/ambient-atlas.png`, `loop/graphics/CURRENT.md`, `loop/graphics/BACKLOG.md`.

## Changes

- Added `ROLE_WORKPOSE_WEIGHT` in `scripts/build-motion-atlases.mjs` with per-role controls:
  - `silhouetteDrop` for stronger role-specific body mass drop/brace.
  - `foldCrush` for deeper work-only cloth compression folds.
  - `payloadLurch` for heavier asymmetric carry wobble and width breakup.
  - `handLoad` for stronger left/right hand-height load imbalance.
- Integrated `ROLE_WORKPOSE_WEIGHT` into `drawActor(...)`:
  - added weighted silhouette displacement into `bodyX`,
  - added `workposeWeightWarp` phase shaping,
  - added a new work-only fold-crush slash,
  - increased left/right hand-height breakup using `handLoad`.
- Integrated `ROLE_WORKPOSE_WEIGHT` into `drawPayload(...)`:
  - added `workposeWeightPulse` for stronger carry lurch cadence,
  - increased role-weighted payload shaping via `payloadLurch` across builder/heavy/default carry bags.
- Rebuilt painted motion atlases:
  - `assets/sprites/actors-atlas.png`
  - `assets/sprites/ambient-atlas.png`

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

- Not refreshed this round due sandbox Chromium launch denial.

Browser or Playwright findings:

- `node --check ...` passed.
- `node scripts/build-motion-atlases.mjs` passed and rewrote raster atlases.
- `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` failed at Chromium launch with:
  - `bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`.
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` returned no files.
- `rg -n ...` returned no matches.

## Visual Result

The actor atlas now stacks `ROLE_WORKPOSE_WEIGHT` over prior motion layers so work/carry roles should read denser and less mirrored through deeper fold compression, stronger payload lurch asymmetry, and clearer weighted hand-load offsets once close 2D screenshots are captured.

## Remaining Issues

- Close 2D screenshot proof remains blocked by Chromium launch denial in this sandbox.
- Final role-by-role tuning still needs refreshed close captures (`anim-live-actors-close.png`, `critic-zoom-close.png`).

## Next Best Target

Run `node scripts/verify-anim.mjs` and `node scripts/verify-critic.mjs` in a Chromium-allowed environment, capture refreshed close 2D shots, and tune any roles that still read mirrored after the stacked `ROLE_WORKPOSE_WEIGHT` layer.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `assets/sprites/actors-atlas.png`
- `assets/sprites/ambient-atlas.png`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/035-actor-workpose-weight-pass.md`
