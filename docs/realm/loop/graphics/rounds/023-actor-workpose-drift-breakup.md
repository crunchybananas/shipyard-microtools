# 023 - actor-workpose-drift-breakup

## Goal

Push actor bitmap motion farther beyond puppet symmetry by adding a role-specific drama layer for shoulder skew, cloth drop, lead-hand bias, and asymmetric payload drift.

## Starting Point

- Previous handoff: `rounds/022-actor-poise-silhouette-torsion.md`.
- Screenshots inspected: none new in this sandbox (Chromium launch remains blocked).
- Relevant files: `scripts/build-motion-atlases.mjs`, `loop/graphics/CURRENT.md`, `loop/graphics/BACKLOG.md`.

## Changes

- Added `ROLE_DRAMA` in `scripts/build-motion-atlases.mjs` with per-role controls:
  - `shoulderSkew` for uneven shoulder/hand elevation,
  - `clothDrop` for deeper work-phase fold drop,
  - `loadSwing` for role-weighted carry payload drift,
  - `leadBias` for lead-hand pose asymmetry.
- Routed `ROLE_DRAMA` into `drawActor(...)`:
  - added `dramaSkew` into work cloth-fold endpoints so role silhouettes split harder,
  - added `clothDrop` weighting to fold falloff for stronger role-specific drape,
  - integrated `leadBias` into hand X anchors and `shoulderSkew` into hand Y offsets to break mirrored arm timing.
- Routed `ROLE_DRAMA` into `drawPayload(...)`:
  - added `dramaSwing` and integrated it into carry payload offsets so heavy/labor roles drift more asymmetrically over phase.

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

- none new this run (Chromium blocked).

Browser or Playwright findings:

- `node --check ...` passed.
- `node scripts/build-motion-atlases.mjs`, `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` failed on Chromium launch with: `bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`.
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` returned no files.
- `rg -n ...` returned no matches.

## Visual Result

The atlas generator now has an explicit role-drama layer that should produce less mirrored work posture through uneven shoulder lift, stronger cloth drop, and carry-load phase drift breakup. Live close 2D screenshot proof is still blocked by Chromium launch permissions in this sandbox.

## Remaining Issues

- Chromium launch remains blocked in this sandbox, preventing atlas rebuild and live close proof screenshots.
- Outlier role tuning still needs screenshot-backed review once Chromium is available.

## Next Best Target

Run `node scripts/build-motion-atlases.mjs`, `node scripts/verify-anim.mjs`, and `node scripts/verify-critic.mjs` in a Chromium-allowed environment, then tune any roles that still read mirrored in close work/carry shots.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/023-actor-workpose-drift-breakup.md`
