# 036 - actor-workpose-shift-pass

## Goal

Push actor bitmap motion further beyond puppet-like mirroring by adding stronger role-specific silhouette hooks, cloth-shear fold breakup, asymmetric payload cant, and hand-set offsets.

## Starting Point

- Previous handoff: `rounds/035-actor-workpose-weight-pass.md`.
- Screenshots inspected: none in this sandbox (Chromium launch remains blocked).
- Relevant files: `scripts/build-motion-atlases.mjs`, `assets/sprites/actors-atlas.png`, `assets/sprites/ambient-atlas.png`, `loop/graphics/CURRENT.md`, `loop/graphics/BACKLOG.md`.

## Changes

- Added `ROLE_WORKPOSE_SHIFT` in `scripts/build-motion-atlases.mjs` with per-role controls:
  - `silhouetteHook` for stronger role-specific body hook displacement.
  - `foldShear` for deeper work-only cloth shear folds.
  - `payloadCant` for heavier asymmetric carry cant and width breakup.
  - `handSet` for stronger left/right hand-height imbalance.
- Integrated `ROLE_WORKPOSE_SHIFT` into `drawActor(...)`:
  - added silhouette hook displacement into `bodyX`,
  - added `workposeShiftWarp` phase shaping,
  - added a new work-only fold-shear slash,
  - increased left/right hand-height breakup using `handSet`.
- Integrated `ROLE_WORKPOSE_SHIFT` into `drawPayload(...)`:
  - added `workposeShiftPulse` for stronger carry cant cadence,
  - increased role-weighted payload shaping via `payloadCant` across builder/heavy/default carry bags.
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

The actor atlas now stacks `ROLE_WORKPOSE_SHIFT` on top of prior motion layers so work/carry roles should read more role-specific and less mirrored through stronger silhouette hook offsets, deeper cloth shear folds, and heavier asymmetric payload cant once close 2D screenshots are captured.

## Remaining Issues

- Close 2D screenshot proof remains blocked by Chromium launch denial in this sandbox.
- Final role-by-role tuning still needs refreshed close captures (`anim-live-actors-close.png`, `critic-zoom-close.png`).

## Next Best Target

Run `node scripts/verify-anim.mjs` and `node scripts/verify-critic.mjs` in a Chromium-allowed environment, capture refreshed close 2D shots, and tune any roles that still read mirrored after the stacked `ROLE_WORKPOSE_SHIFT` layer.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `assets/sprites/actors-atlas.png`
- `assets/sprites/ambient-atlas.png`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/036-actor-workpose-shift-pass.md`
