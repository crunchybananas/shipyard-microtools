# 034 - actor-workpose-torque-layer

## Goal

Push actor bitmap motion beyond puppet-like cadence with a new role layer that adds stronger torso brace silhouette offsets, deeper cloth-whip folds, and heavier asymmetric payload drag.

## Starting Point

- Previous handoff: `rounds/033-actor-workpose-grit-pass.md`.
- Screenshots inspected: none in this sandbox (Chromium launch remains blocked).
- Relevant files: `scripts/build-motion-atlases.mjs`, `assets/sprites/actors-atlas.png`, `assets/sprites/ambient-atlas.png`, `loop/graphics/CURRENT.md`, `loop/graphics/BACKLOG.md`.

## Changes

- Added `ROLE_WORKPOSE_TORQUE` in `scripts/build-motion-atlases.mjs` with per-role controls:
  - `silhouetteBrace` for stronger role-specific torso offset and stance brace.
  - `foldWhip` for deeper work-only cloth whip folds.
  - `payloadDrag` for larger carry-payload width and asymmetry pulses.
  - `handBrace` for stronger left/right hand-height breakup.
- Integrated `ROLE_WORKPOSE_TORQUE` into `drawActor(...)`:
  - added torque-based silhouette displacement into `bodyX`,
  - added `workposeTorqueWarp` phase shaping,
  - added an extra work-only fold-whip slash,
  - increased hand-height asymmetry using `handBrace`.
- Integrated `ROLE_WORKPOSE_TORQUE` into `drawPayload(...)`:
  - added `workposeTorquePulse` for carry drift cadence,
  - increased role-weighted carry payload shaping via `payloadDrag`.
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

The actor atlas now stacks `ROLE_WORKPOSE_TORQUE` over prior layers so work/carry frames should read chunkier and less mirrored via stronger torso brace displacement, extra cloth-whip slashes, and heavier payload drag asymmetry once close 2D screenshots are captured in a Chromium-allowed environment.

## Remaining Issues

- Close 2D screenshot proof remains blocked by Chromium launch denial in this sandbox.
- Final role-by-role tuning still needs refreshed close captures (`anim-live-actors-close.png`, `critic-zoom-close.png`).

## Next Best Target

Run `node scripts/verify-anim.mjs` and `node scripts/verify-critic.mjs` in a Chromium-allowed environment, capture refreshed close 2D shots, and tune any roles that still read mirrored after the stacked `ROLE_WORKPOSE_TORQUE` layer.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `assets/sprites/actors-atlas.png`
- `assets/sprites/ambient-atlas.png`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/034-actor-workpose-torque-layer.md`
