# 039 - actor-workpose-rhythm-proof

## Goal

Push actor bitmap motion further beyond clean puppet-like loops by adding a sharper, role-weighted work cadence deformation and wiring close 2D proof export into the atlas build path.

## Starting Point

- Previous handoff: `rounds/038-actor-workpose-heft-pass.md`.
- Screenshots inspected: none refreshed this round due Chromium launch denial in this sandbox.
- Relevant files: `scripts/build-motion-atlases.mjs`, `loop/graphics/CURRENT.md`, `loop/graphics/BACKLOG.md`.

## Changes

- Added `OUT_ACTOR_PROOF` in `scripts/build-motion-atlases.mjs` targeting:
  - `scripts/screenshots/actors-workpose-close-round-039.png`.
- Added `triWave(...)` helper and a new `workposeHeftRhythm` term in
  `drawActor(...)` so work poses gain less mirrored, less purely sinusoidal
  role-weighted timing.
- Applied `workposeHeftRhythm` to left/right hand-height offsets so heavy
  roles read more asymmetric under work cadence.
- Added close proof canvas export in the atlas build flow, emitting a
  stitched role/frame bitmap panel for `lumber`, `miner`, `builder`,
  `blacksmith`, `trader`, and `forager` work poses.

## Verification

Commands run:

```sh
node --check js/render.js js/ui.js js/main.js js/input.js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs scripts/build-motion-atlases.mjs
node scripts/build-motion-atlases.mjs
node scripts/verify-anim.mjs
node scripts/verify-critic.mjs
node scripts/verify.mjs --game --logic
find assets/sprites -maxdepth 1 -name '*.svg' -print
rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" index.html js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs assets/sprites/README.md
```

Screenshots:

- `scripts/screenshots/actors-workpose-close-round-039.png` (export path added, but not produced in this sandbox due Chromium launch failure before atlas generation).

Browser or Playwright findings:

- `node --check ...` passed.
- `node scripts/build-motion-atlases.mjs` failed at Chromium launch with:
  - `bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`.
- `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and
  `node scripts/verify.mjs --game --logic` failed with the same Chromium
  launch denial.
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` returned no files.
- `rg -n ...` returned no matches.

## Visual Result

Code-level motion shaping now adds a sharper non-sine workpose rhythm term on top of prior `ROLE_WORKPOSE_HEFT` deformation, so once the atlas can rebuild in a Chromium-allowed environment, heavy-role silhouettes and hand cadence should read less mirrored in close 2D captures.

## Remaining Issues

- Chromium launch remains blocked in this sandbox, preventing atlas rebuild and close screenshot proof refresh.
- New round-039 proof image export path cannot be validated until Chromium is available.

## Next Best Target

Run this same round in a Chromium-allowed environment and execute atlas build plus `verify-anim`/`verify-critic` so `actors-workpose-close-round-039.png`, `anim-live-actors-close.png`, and `critic-zoom-close.png` can be captured and used for immediate role-by-role tuning.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/039-actor-workpose-rhythm-proof.md`
