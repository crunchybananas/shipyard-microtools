# 024 - actor-workpose-silhouette-fold-pass

## Goal

Push actor bitmap motion farther past puppet symmetry with stronger role silhouette edges, deeper cloth-fold drop, and more asymmetric carry payload skew in work/carry poses.

## Starting Point

- Previous handoff: `rounds/023-actor-workpose-drift-breakup.md`.
- Screenshots inspected: none new in this sandbox (Chromium launch remains blocked).
- Relevant files: `scripts/build-motion-atlases.mjs`, `assets/sprites/actors-atlas.png`, `loop/graphics/CURRENT.md`, `loop/graphics/BACKLOG.md`.

## Changes

- Added `ROLE_WORKPOSE` in `scripts/build-motion-atlases.mjs` with per-role controls:
  - `silhouetteEdge` for stronger role-specific body edge drift,
  - `foldDrop` for deeper work-phase cloth fold descents,
  - `payloadSkew` for asymmetric carry bundle skew,
  - `workReach` for role-specific forward/back work reach breakup.
- Integrated `ROLE_WORKPOSE` into `drawActor(...)`:
  - added `workReachPulse` and `silhouetteEdge` into body lateral drift,
  - added an extra work-only cloth slash fold line driven by `workReach` and `foldDrop` to break mirrored tunic rhythm.
- Integrated `ROLE_WORKPOSE` into `drawPayload(...)`:
  - added `payloadSkewPulse` and role-scaled width/height shaping for builder/heavy/default carry bundles,
  - increased role-specific payload asymmetry in carry motion offsets.
- Rebuilt painted atlases:
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

- none new this run (Chromium blocked before capture).

Browser or Playwright findings:

- `node --check ...` passed.
- `node scripts/build-motion-atlases.mjs` passed and wrote updated actor/ambient atlases.
- `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` failed on Chromium launch with `bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`.
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` returned no files.
- `rg -n ...` returned no matches.

## Visual Result

The actor atlas generator now includes a dedicated role workpose layer that increases silhouette breakup, cloth fold drop, and payload skew across work/carry frames; this should produce more varied role reads and less mirrored puppet-like motion once close 2D live captures can run.

## Remaining Issues

- Chromium launch remains blocked in this sandbox, preventing refreshed close 2D screenshot proof (`anim-live-actors-close.png`, `critic-zoom-close.png`).
- Outlier role tuning still needs screenshot-backed review once Chromium is available.

## Next Best Target

Run `node scripts/verify-anim.mjs` and `node scripts/verify-critic.mjs` in a Chromium-allowed environment, capture refreshed close 2D screenshots, and tune any roles that still read mirrored.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `assets/sprites/actors-atlas.png`
- `assets/sprites/ambient-atlas.png`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/024-actor-workpose-silhouette-fold-pass.md`
