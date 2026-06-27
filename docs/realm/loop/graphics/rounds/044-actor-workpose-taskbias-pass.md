# 044 - actor-workpose-taskbias-pass

## Goal

Push actor bitmap work motion farther from puppet symmetry by adding a task-bias layer that increases role-specific silhouette yaw, cloth-fold crank, asymmetric payload offset, and hand-lead cadence.

## Starting Point

- Previous handoff: `rounds/043-actor-workpose-rolesign-pass.md`.
- Screenshots inspected: none (Chromium launch remains blocked in this sandbox).
- Relevant files: `scripts/build-motion-atlases.mjs`, `loop/graphics/CURRENT.md`, `loop/graphics/BACKLOG.md`.

## Changes

- Added `ROLE_WORKPOSE_TASKBIAS` in `scripts/build-motion-atlases.mjs` with per-role:
  - `silhouetteYaw`
  - `foldCrank`
  - `payloadOffset`
  - `handLead`
- Wired `ROLE_WORKPOSE_TASKBIAS` through `drawActor(...)`:
  - extended body silhouette drift,
  - added `workposeTaskBiasWarp` + `workposeTaskBiasRhythm`,
  - added a new deep work-only fold-crank slash,
  - increased left/right hand-height desync.
- Extended `drawPayload(...)` to accept `workposeTaskBias` and apply `workposeTaskBiasPulse` in payload drift and width shaping.
- Advanced round proof output path/text to:
  - `scripts/screenshots/actors-workpose-close-round-044.png`

## Verification

Commands run:

```sh
node --check js/render.js js/ui.js js/main.js js/input.js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs scripts/build-motion-atlases.mjs
node scripts/verify-anim.mjs
node scripts/verify-critic.mjs
node scripts/verify.mjs --game --logic
find assets/sprites -maxdepth 1 -name '*.svg' -print
rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" index.html js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs assets/sprites/README.md
```

Screenshots:

- None generated in this sandbox (Chromium launch blocked).

Browser or Playwright findings:

- `node --check ...` passed.
- `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` all failed at Chromium launch with:
  - `bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` returned no files.
- `rg -n ...` returned no matches.

## Visual Result

The actor atlas generator now includes another role-specific asymmetry layer that should further separate work silhouettes, deepen fold crank asymmetry, and increase payload/hand cadence breakup once rebuilt and captured in a Chromium-allowed environment.

## Remaining Issues

- Chromium launch denial still blocks atlas rebuild and close 2D screenshot proof in this sandbox.
- Role-by-role live tuning from `anim-live-actors-close.png`, `critic-zoom-close.png`, and `actors-workpose-close-round-044.png` remains pending.

## Next Best Target

Run `node scripts/build-motion-atlases.mjs`, `node scripts/verify-anim.mjs`, and `node scripts/verify-critic.mjs` where Chromium can launch, then tune any remaining mirrored role cadence from refreshed close captures.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/044-actor-workpose-taskbias-pass.md`
