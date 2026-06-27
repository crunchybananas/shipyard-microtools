# 051 - actor-workpose-silhouette-snap-pass

## Goal

Push actor bitmap work poses beyond puppet-like symmetry with stronger tableau silhouette displacement, deeper cloth-fold breakup, and more asymmetric hand/payload motion.

## Starting Point

- Previous handoff: `rounds/050-actor-workpose-tableau-pass.md`.
- Screenshots inspected: `scripts/screenshots/actors-workpose-close-round-050.png`.
- Relevant files: `scripts/build-motion-atlases.mjs`, `loop/graphics/CURRENT.md`, `loop/graphics/BACKLOG.md`.

## Changes

- Advanced close proof export target to:
  - `scripts/screenshots/actors-workpose-close-round-051.png`
- Increased `ROLE_WORKPOSE_TABLEAU` role values (silhouetteSnap/foldPinch/payloadCant/poseSet) to push stronger role-distinct work posing.
- Wired tableau silhouette directly into `bodyX` displacement in `drawActor(...)` so role work poses read with stronger side-biased silhouettes.
- Added a new extra deep tableau cloth-fold slash in the work-only fold stack for stronger painted fold depth under strain.
- Increased tableau influence on left/right hand height and rhythm desync for less mirrored cadence in work/carry motion.
- Rebuilt painted motion atlases:
  - `assets/sprites/actors-atlas.png`
  - `assets/sprites/ambient-atlas.png`

## Verification

Commands run:

```sh
node --check js/render.js js/ui.js js/main.js js/input.js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs
node --check scripts/build-motion-atlases.mjs
node scripts/build-motion-atlases.mjs
node scripts/verify-anim.mjs
node scripts/verify-critic.mjs
node scripts/verify.mjs --game --logic
find assets/sprites -maxdepth 1 -name '*.svg' -print
rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" index.html js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs assets/sprites/README.md
```

Screenshots:

- New close proof generated:
  - `scripts/screenshots/actors-workpose-close-round-051.png`

Browser or Playwright findings:

- `node --check ...` passed.
- `node --check scripts/build-motion-atlases.mjs` passed.
- `node scripts/build-motion-atlases.mjs` passed and wrote atlas/proof PNGs.
- `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` failed at Chromium launch with:
  - `bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`.
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` returned no files.
- `rg -n ...` returned no matches.

## Visual Result

Work/carry actor motion now reads chunkier and less symmetrical in close atlas proof: silhouettes break farther from centerline, cloth folds stack with a deeper painted pinch line, and hand/payload timing shows stronger role-specific cadence offsets.

## Remaining Issues

- Chromium launch denial still blocks live `verify-anim`, `verify-critic`, and `verify.mjs --game --logic` screenshot proof in this sandbox.
- Outlier role tuning still needs live close captures (`anim-live-actors-close.png`, `critic-zoom-close.png`) in a Chromium-allowed run.

## Next Best Target

Run `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` where Chromium can launch, then tune any remaining mirrored roles against `scripts/screenshots/actors-workpose-close-round-051.png`.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `assets/sprites/actors-atlas.png`
- `assets/sprites/ambient-atlas.png`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/051-actor-workpose-silhouette-snap-pass.md`
