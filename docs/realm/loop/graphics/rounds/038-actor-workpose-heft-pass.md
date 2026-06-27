# 038 - actor-workpose-heft-pass

## Goal

Push actor bitmap motion further beyond puppet-like mirroring with stronger silhouette crank, deeper cloth fold breakup, asymmetric payload yaw, and role-specific hand drop offsets.

## Starting Point

- Previous handoff: `rounds/037-actor-workpose-strike-pass.md`.
- Screenshots inspected: none in this sandbox (Chromium launch remains blocked).
- Relevant files: `scripts/build-motion-atlases.mjs`, `assets/sprites/actors-atlas.png`, `assets/sprites/ambient-atlas.png`, `loop/graphics/CURRENT.md`, `loop/graphics/BACKLOG.md`.

## Changes

- Added `ROLE_WORKPOSE_HEFT` in `scripts/build-motion-atlases.mjs` with per-role controls:
  - `silhouetteCrank` for stronger role-specific silhouette crank displacement.
  - `foldSplay` for a deeper work-only fold-splay slash layer.
  - `payloadYaw` for heavier asymmetric carry yaw cadence and width shaping.
  - `handDrop` for deeper left/right hand-height breakup.
- Integrated `ROLE_WORKPOSE_HEFT` into `drawActor(...)`:
  - added silhouette crank displacement into `bodyX`,
  - added `workposeHeftWarp` phase shaping,
  - added a new deep work-only fold-splay slash,
  - increased left/right hand-height breakup via `handDrop`.
- Integrated `ROLE_WORKPOSE_HEFT` into `drawPayload(...)`:
  - expanded payload pulse shaping with `workposeHeftPulse`,
  - increased role-weighted carry width/offset asymmetry using `payloadYaw`.
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

The actor atlas now stacks `ROLE_WORKPOSE_HEFT` on top of prior motion layers so work/carry roles should read less mirrored through stronger silhouette crank, deeper fold-splay cloth slashes, and heavier asymmetric payload yaw once close 2D screenshots are captured.

## Remaining Issues

- Close 2D screenshot proof remains blocked by Chromium launch denial in this sandbox.
- Final role-by-role tuning still needs refreshed close captures (`anim-live-actors-close.png`, `critic-zoom-close.png`).

## Next Best Target

Run `node scripts/verify-anim.mjs` and `node scripts/verify-critic.mjs` in a Chromium-allowed environment, capture refreshed close 2D shots, and tune any roles that still read mirrored after the stacked `ROLE_WORKPOSE_HEFT` layer.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `assets/sprites/actors-atlas.png`
- `assets/sprites/ambient-atlas.png`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/038-actor-workpose-heft-pass.md`
