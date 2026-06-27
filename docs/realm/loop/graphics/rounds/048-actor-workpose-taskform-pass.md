# 048 - actor-workpose-taskform-pass

## Goal

Push actor bitmap work/carry motion farther past puppet symmetry by adding a role-specific taskform layer for silhouette hooks, braided cloth folds, asymmetric payload lunge, and deeper pose-offset cadence.

## Starting Point

- Previous handoff: `rounds/047-actor-workpose-profile-pass.md`.
- Screenshots inspected: existing close references only (`scripts/screenshots/critic-zoom-close.png`) because fresh captures are still blocked in this sandbox.
- Relevant files: `scripts/build-motion-atlases.mjs`, `loop/graphics/CURRENT.md`, `loop/graphics/BACKLOG.md`.

## Changes

- Added `ROLE_WORKPOSE_TASKFORM` in `scripts/build-motion-atlases.mjs` with per-role:
  - `silhouetteHook`
  - `foldBraid`
  - `payloadLunge`
  - `poseOffset`
- Advanced round proof export target to:
  - `scripts/screenshots/actors-workpose-close-round-048.png`
- Wired `ROLE_WORKPOSE_TASKFORM` through `drawActor(...)`:
  - extended body silhouette displacement,
  - added `workposeTaskFormWarp` and `workposeTaskFormRhythm`,
  - added an extra deep work-only fold stroke layer,
  - added stronger left/right hand-height cadence breakup.
- Wired `ROLE_WORKPOSE_TASKFORM` through `drawPayload(...)`:
  - extended carry pulse drift and width shaping with `workposeTaskFormPulse` and `payloadLunge`.

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
- Existing close reference remains: `scripts/screenshots/critic-zoom-close.png`.

Browser or Playwright findings:

- `node --check ...` passed.
- `node --check scripts/build-motion-atlases.mjs` passed.
- `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` failed at Chromium launch with:
  - `bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`.
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` returned no files.
- `rg -n ...` returned no matches.

## Visual Result

The actor motion generator now stacks a taskform layer above the profile pass, adding stronger role-specific silhouette hooks, deeper braided cloth-fold breakup, heavier asymmetric payload lunge, and more desynced work hand cadence once close capture can be refreshed.

## Remaining Issues

- Chromium launch denial still blocks atlas rebuild + fresh close 2D screenshot proof in this sandbox.
- Role-by-role outlier tuning from refreshed close captures remains pending.

## Next Best Target

Run `node scripts/build-motion-atlases.mjs`, `node scripts/verify-anim.mjs`, and `node scripts/verify-critic.mjs` where Chromium can launch, then tune outlier roles from refreshed `anim-live-actors-close.png`, `critic-zoom-close.png`, and `actors-workpose-close-round-048.png`.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/048-actor-workpose-taskform-pass.md`
