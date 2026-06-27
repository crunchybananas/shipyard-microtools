# 028 - actor-exertion-silhouette-torque

## Goal

Push painted actor animation farther past mirrored puppet motion with a role-specific exertion layer: stronger silhouette warp, cloth fold slicing, asymmetric carried mass, and torque-heavy work poses.

## Starting Point

- Previous handoff: `rounds/027-actor-labor-pose-breakup.md`.
- Screenshots inspected: none new in this sandbox (Chromium launch still blocked).
- Relevant files: `scripts/build-motion-atlases.mjs`, `assets/sprites/actors-atlas.png`, `assets/sprites/ambient-atlas.png`, `loop/graphics/CURRENT.md`, `loop/graphics/BACKLOG.md`.

## Changes

- Added `ROLE_EXERT` in `scripts/build-motion-atlases.mjs` with per-role controls:
  - `silhouetteWarp` for stronger lateral non-mirrored torso/pose drift,
  - `foldSlice` for sharper work-only fold breakup,
  - `loadAsym` for heavier payload shape/asymmetry pulse,
  - `poseTorque` for tougher work arm/hand timing torque.
- Integrated `ROLE_EXERT` into `drawPayload(...)`:
  - added `exertPulse` and blended it into payload lateral drift,
  - widened and reweighted payload shape by role via `loadAsym`,
  - added role-driven load height/volume asymmetry via `silhouetteWarp`.
- Integrated `ROLE_EXERT` into `drawActor(...)`:
  - added exertion-based silhouette warp into body X drift,
  - added `exertWarp` cadence and new work fold slash lines,
  - increased work arm swing phase/amplitude via `poseTorque`,
  - offset hand Y torque asymmetrically for less mirrored read.
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

The actor atlas now stacks `ROLE_EXERT` over previous role layers, increasing role-unique silhouette torque and cloth/payload asymmetry so work and carry loops should read chunkier and less mirrored once close 2D capture is unblocked.

## Remaining Issues

- Chromium launch remains blocked in this sandbox, preventing refreshed close 2D screenshots (`anim-live-actors-close.png`, `critic-zoom-close.png`).
- Live screenshot validation is still needed to confirm whether any role pair remains too synchronized after `ROLE_LOADOUT` + `ROLE_IMPACT` + `ROLE_LABOR` + `ROLE_EXERT`.

## Next Best Target

Run `node scripts/verify-anim.mjs` and `node scripts/verify-critic.mjs` in a Chromium-allowed environment, then tune remaining mirrored role outliers from fresh close 2D captures.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/028-actor-exertion-silhouette-torque.md`
