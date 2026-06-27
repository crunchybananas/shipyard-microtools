# 047 - actor-workpose-profile-pass

## Goal

Push actor bitmap work/carry motion farther from puppet symmetry by adding a stronger role-profile layer for silhouette yaw, cloth fold stacks, asymmetric payload skew, and role-specific hand cadence.

## Starting Point

- Previous handoff: `rounds/046-actor-workpose-rolepose-pass.md`.
- Screenshots inspected: `scripts/screenshots/critic-zoom-close.png` (existing baseline from prior rounds).
- Relevant files: `scripts/build-motion-atlases.mjs`, `loop/graphics/CURRENT.md`, `loop/graphics/BACKLOG.md`.

## Changes

- Added `ROLE_WORKPOSE_PROFILE` in `scripts/build-motion-atlases.mjs` with per-role:
  - `silhouetteYaw`
  - `foldStack`
  - `payloadSkew`
  - `handBias`
- Wired `ROLE_WORKPOSE_PROFILE` into `drawActor(...)`:
  - added a new `bodyX` silhouette-yaw contribution,
  - added `workposeProfileWarp` and `workposeProfileRhythm`,
  - extended hand-height asymmetry with role-specific hand bias and rhythm breakup.
- Extended `drawPayload(...)` signature + carry pulse math to include `workposeProfile` and apply `workposeProfilePulse` to carry drift and width shaping.
- Advanced round proof export target text/path to:
  - `scripts/screenshots/actors-workpose-close-round-047.png`

## Verification

Commands run:

```sh
node --check js/render.js js/ui.js js/main.js js/input.js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs
node --check scripts/build-motion-atlases.mjs
node scripts/verify-anim.mjs
node scripts/verify-critic.mjs
node scripts/verify.mjs --game --logic
find assets/sprites -maxdepth 1 -name '*.svg' -print
rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" index.html js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs assets/sprites/README.md
```

Screenshots:

- No new screenshots generated this round (Chromium launch blocked in sandbox).
- Existing close reference still present: `scripts/screenshots/critic-zoom-close.png`.

Browser or Playwright findings:

- `node --check ...` and `node --check scripts/build-motion-atlases.mjs` passed.
- `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` failed at Chromium launch with:
  - `bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`.
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` returned no files.
- `rg -n ...` returned no matches.

## Visual Result

The actor motion atlas generator now stacks a role-profile layer over prior workpose passes so each role gets stronger silhouette yaw offsets, deeper cloth-fold stack breakup, heavier asymmetric payload skew pulsing, and more desynced hand cadence once atlas rebuild and close proof capture run in a Chromium-allowed environment.

## Remaining Issues

- Chromium launch denial still blocks atlas rebuild and fresh close 2D screenshot proof in this sandbox.
- Role-by-role tuning from refreshed `anim-live-actors-close.png`, `critic-zoom-close.png`, and `actors-workpose-close-round-047.png` remains pending.

## Next Best Target

Run `node scripts/build-motion-atlases.mjs`, `node scripts/verify-anim.mjs`, and `node scripts/verify-critic.mjs` where Chromium can launch, then tune outlier roles from refreshed close captures after the profile layer.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/047-actor-workpose-profile-pass.md`
