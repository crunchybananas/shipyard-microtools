# 027 - actor-labor-pose-breakup

## Goal

Push actor bitmap animation farther from mirrored puppet motion by adding a new role-specific labor layer for pose snap, cloth fold jerk, payload cant, and work-arm drive.

## Starting Point

- Previous handoff: `rounds/026-actor-impact-silhouette-lag.md`.
- Screenshots inspected: none new in this sandbox (Chromium launch still blocked).
- Relevant files: `scripts/build-motion-atlases.mjs`, `assets/sprites/actors-atlas.png`, `assets/sprites/ambient-atlas.png`, `loop/graphics/CURRENT.md`, `loop/graphics/BACKLOG.md`.

## Changes

- Added `ROLE_LABOR` in `scripts/build-motion-atlases.mjs` with per-role controls:
  - `poseSnap` for stronger asymmetric role timing snap,
  - `foldJerk` for rougher cloth fold accents in work poses,
  - `payloadCant` for role-specific carry shape/cant breakup,
  - `armDrive` for heavier work-arm cadence split.
- Integrated `ROLE_LABOR` into `drawPayload(...)`:
  - added `laborPulse` and blended it into carry offsets and payload width shaping.
- Integrated `ROLE_LABOR` into `drawActor(...)`:
  - added `laborSnap` into cloth fold endpoints,
  - added an extra work-only slash fold line driven by labor controls,
  - increased work arm swing phase/amplitude using labor pose + arm controls.
- Rebuilt motion atlases:
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

- none new this run (Chromium blocked before capture).

Browser or Playwright findings:

- `node --check ...` passed.
- `node scripts/build-motion-atlases.mjs` passed and wrote actor/ambient atlases.
- `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and
  `node scripts/verify.mjs --game --logic` failed on Chromium launch with
  `bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`.
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` returned no files.
- `rg -n ...` returned no matches.

## Visual Result

The actor atlas now includes a stacked `ROLE_LABOR` pass on top of prior role shaping, so work poses should read with chunkier non-mirrored torso snap, rougher cloth fold timing, and more asymmetric carry cants once close 2D captures are unblocked.

## Remaining Issues

- Chromium launch remains blocked in this sandbox, preventing refreshed close 2D screenshots (`anim-live-actors-close.png`, `critic-zoom-close.png`).
- Live screenshot validation is still needed to identify any outlier roles that remain too mirrored after `ROLE_IMPACT` + `ROLE_LABOR`.

## Next Best Target

Run `node scripts/verify-anim.mjs` and `node scripts/verify-critic.mjs` in a Chromium-allowed environment, then tune any roles that still read mirrored in close work/carry shots.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/027-actor-labor-pose-breakup.md`
