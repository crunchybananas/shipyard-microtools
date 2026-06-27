# 022 - actor-poise-silhouette-torsion

## Goal

Push actor bitmap motion beyond clean puppet-like symmetry by adding a role-poise layer that increases silhouette drift, cloth fold torsion, and asymmetric carry-load knot motion.

## Starting Point

- Previous handoff: `rounds/021-actor-stance-payload-breakup.md`.
- Screenshots inspected: none new in this sandbox (Chromium launch remains blocked).
- Relevant files: `scripts/build-motion-atlases.mjs`, `loop/graphics/CURRENT.md`, `loop/graphics/BACKLOG.md`.

## Changes

- Added `ROLE_POISE` in `scripts/build-motion-atlases.mjs` with per-role controls:
  - `silhouetteShift` for lateral torso drift,
  - `foldTorsion` for stronger work-phase cloth twist,
  - `payloadKnot` for asymmetric carry-load nudge,
  - `stanceDrive` for phase-weighted silhouette push.
- Routed `ROLE_POISE` into `drawActor(...)`:
  - added role-driven `silhouetteShift` into `bodyX` so work poses break mirror symmetry more aggressively,
  - added `foldTorsion` to cloth fold and work-slash fold Y offsets,
  - applied `foldTorsion` into left/right hand Y offsets for stronger asymmetric work posture.
- Routed `ROLE_POISE` into `drawPayload(...)`:
  - added `knotNudge` and integrated it into builder/heavy/default carry clusters to make load lobes drift less uniformly.

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
- `node scripts/build-motion-atlases.mjs` failed on Chromium launch with:
  `bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`.
- `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and
  `node scripts/verify.mjs --game --logic` failed on the same Chromium launch permission error.
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` returned no files.
- `rg -n ...` returned no matches.

## Visual Result

The actor motion generation logic now includes a dedicated role-poise layer that should produce more role-specific lateral silhouette push, cloth torsion under work cadence, and asymmetrically drifting carry payload knots. Live close 2D screenshot proof is still blocked by Chromium launch permissions in this sandbox.

## Remaining Issues

- Chromium launch remains blocked in this sandbox, preventing atlas rebuild and live close proof screenshots.
- Outlier role tuning still needs screenshot-backed review once Chromium is available.

## Next Best Target

Run `node scripts/build-motion-atlases.mjs`, `node scripts/verify-anim.mjs`, and `node scripts/verify-critic.mjs` in a Chromium-allowed environment, then tune any roles that still read mirrored in work/carry close shots.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/022-actor-poise-silhouette-torsion.md`
