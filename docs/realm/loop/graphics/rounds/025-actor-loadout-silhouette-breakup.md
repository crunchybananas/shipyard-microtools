# 025 - actor-loadout-silhouette-breakup

## Goal

Push actor bitmap motion beyond puppet symmetry with stronger role-specific loadout asymmetry: heavier shoulder-pack drift, hem-weighted cloth folds, and less mirrored carry payload silhouettes.

## Starting Point

- Previous handoff: `rounds/024-actor-workpose-silhouette-fold-pass.md`.
- Screenshots inspected: none new in this sandbox (Chromium launch still blocked).
- Relevant files: `scripts/build-motion-atlases.mjs`, `loop/graphics/CURRENT.md`, `loop/graphics/BACKLOG.md`.

## Changes

- Added `ROLE_LOADOUT` in `scripts/build-motion-atlases.mjs` with per-role controls:
  - `shoulderPack` for role-specific shoulder mass drift,
  - `hemWeight` for heavier cloth-drop bias under load,
  - `kitSwing` for asymmetrical carried-gear swing cadence,
  - `clothClamp` for role-specific fold tightness under work strain.
- Integrated `ROLE_LOADOUT` into `drawPayload(...)`:
  - added `loadoutPulse` into carry offset drift,
  - increased payload width/height asymmetry per role with `kitSwing` and `hemWeight`.
- Integrated `ROLE_LOADOUT` into `drawActor(...)`:
  - added a new work-only diagonal fold slash driven by `shoulderPack`, `hemWeight`, and `clothClamp`,
  - made heavy-role strap/pack overlays drift asymmetrically via `loadoutSwing` and `shoulderPack`.

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

- none new this run (Chromium blocked before capture).

Browser or Playwright findings:

- `node --check ...` passed.
- `node scripts/build-motion-atlases.mjs` failed on Chromium launch with
  `bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`.
- `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and
  `node scripts/verify.mjs --game --logic` failed on the same Chromium launch error.
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` returned no files.
- `rg -n ...` returned no matches.

## Visual Result

The actor atlas generator now applies a dedicated role loadout layer so cloth folds and carry payload blocks drift with role-specific shoulder/kit bias, which should read less mirrored and more job-specific once close 2D captures are unblocked.

## Remaining Issues

- Chromium launch remains blocked in this sandbox, preventing atlas rebuild proof and refreshed close 2D screenshots (`anim-live-actors-close.png`, `critic-zoom-close.png`).
- Outlier role tuning still needs screenshot-backed review once Chromium is available.

## Next Best Target

Run `node scripts/build-motion-atlases.mjs`, `node scripts/verify-anim.mjs`, and `node scripts/verify-critic.mjs` in a Chromium-allowed environment, then tune any roles that still read mirrored in work/carry motion.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/025-actor-loadout-silhouette-breakup.md`
