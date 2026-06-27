# 026 - actor-impact-silhouette-lag

## Goal

Push actor bitmap motion farther from clean puppet cadence by adding role-specific silhouette snap, cloth torque, payload lag asymmetry, and reach drift.

## Starting Point

- Previous handoff: `rounds/025-actor-loadout-silhouette-breakup.md`.
- Screenshots inspected: none new in this sandbox (Chromium launch still blocked).
- Relevant files: `scripts/build-motion-atlases.mjs`, `loop/graphics/CURRENT.md`, `loop/graphics/BACKLOG.md`.

## Changes

- Added `ROLE_IMPACT` in `scripts/build-motion-atlases.mjs` with per-role controls:
  - `silhouetteSnap` for role-specific torso snap offsets,
  - `clothTorque` for sharper work-fold torque accents,
  - `payloadLag` for asymmetric carry lag breakup,
  - `reachDrift` for role-biased work arm drift.
- Integrated `ROLE_IMPACT` into `drawPayload(...)`:
  - added `impactPulse` to carry offset drift and payload width shaping,
  - increased role-specific carry lag breakup for heavy and asymmetrical roles.
- Integrated `ROLE_IMPACT` into `drawActor(...)`:
  - added silhouette snap bias directly into body X shaping,
  - added torque accents into work-only slash folds,
  - added role-specific reach drift into work arm swing cadence.

## Verification

Commands run:

```sh
node --check js/render.js js/ui.js js/main.js js/input.js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs
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
- `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and
  `node scripts/verify.mjs --game --logic` failed on Chromium launch with
  `bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`.
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` returned no files.
- `rg -n ...` returned no matches.

## Visual Result

The actor atlas generator now layers impact shaping on top of prior loadout/workpose passes, so body drift, cloth folds, work-arm rhythm, and carry offsets should read more role-specific and less mirrored once close captures are unblocked.

## Remaining Issues

- Chromium launch remains blocked in this sandbox, preventing refreshed close 2D screenshots (`anim-live-actors-close.png`, `critic-zoom-close.png`).
- Atlas rebuild confirmation from `node scripts/build-motion-atlases.mjs` could not be refreshed in this run.

## Next Best Target

Run `node scripts/build-motion-atlases.mjs`, `node scripts/verify-anim.mjs`, and `node scripts/verify-critic.mjs` in a Chromium-allowed environment, then tune outlier roles that still read mirrored in close work/carry poses.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/026-actor-impact-silhouette-lag.md`
