# 033 - actor-workpose-grit-pass

## Goal

Push actor bitmap motion further beyond puppet-like cadence by adding a new role-specific grit layer for torso jut, cloth-rake folds, asymmetric payload skid, and stronger left/right hand clamp offsets.

## Starting Point

- Previous handoff: `rounds/032-actor-workpose-force-pass.md`.
- Relevant files: `scripts/build-motion-atlases.mjs`, `assets/sprites/actors-atlas.png`, `loop/graphics/CURRENT.md`, `loop/graphics/BACKLOG.md`.
- Sandbox note: Chromium launch remains denied, so close 2D screenshot capture via Playwright verifiers is still blocked.

## Changes

- Added `ROLE_WORKPOSE_GRIT` in `scripts/build-motion-atlases.mjs` with per-role controls:
  - `torsoJut` for stronger role-specific body displacement.
  - `foldRake` for another work-only cloth-fold rake slash.
  - `payloadSkid` for heavier asymmetry in carry payload lateral cadence/width.
  - `handClamp` for deeper left/right hand-height separation.
- Integrated `ROLE_WORKPOSE_GRIT` into `drawActor(...)`:
  - added grit-based torso displacement to `bodyX`,
  - added `workposeGritWarp` phase shaping,
  - added one extra work-only diagonal fold-rake slash,
  - increased hand-height asymmetry using `handClamp`.
- Integrated `ROLE_WORKPOSE_GRIT` into `drawPayload(...)`:
  - added `workposeGritPulse` into carry drift cadence,
  - widened role-weighted carry payload shaping with `payloadSkid`.
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

Results:

- `node --check ...` passed.
- `node scripts/build-motion-atlases.mjs` passed and rewrote the raster atlases.
- `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and
  `node scripts/verify.mjs --game --logic` failed at Chromium launch with
  `bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`.
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` returned no files.
- `rg -n ...` returned no matches.

## Visual Result

The actor generator now stacks `ROLE_WORKPOSE_GRIT` on top of prior role
layers, increasing non-mirrored torso/hand offsets and adding a new cloth-rake
fold slash so work/carry frames read chunkier and more role-specific once close
2D screenshots can be captured in a Chromium-allowed environment.

## Remaining Issues

- Close 2D screenshot proof is still blocked by Chromium launch denial in this
  sandbox, so refreshed `anim-live-actors-close.png` and
  `critic-zoom-close.png` were not produced.
- Final role-by-role tuning still requires those close captures.

## Next Best Target

Run `node scripts/verify-anim.mjs` and `node scripts/verify-critic.mjs` in a
Chromium-allowed environment, capture refreshed close 2D shots, and tune any
remaining mirrored role cadence after the added `ROLE_WORKPOSE_GRIT` layer.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `assets/sprites/actors-atlas.png`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/033-actor-workpose-grit-pass.md`
