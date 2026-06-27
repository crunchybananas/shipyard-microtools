# 029 - actor-signature-asymmetry-pass

## Goal

Push actor bitmap motion farther from puppet mirroring by adding stronger role-signature asymmetry: dominant shoulder bias, cloth pinch folds, asymmetric load drag, and favored work-hand pose offsets.

## Starting Point

- Previous handoff: `rounds/028-actor-exertion-silhouette-torque.md`.
- Screenshots inspected: none new in this sandbox (Chromium launch still blocked).
- Relevant files: `scripts/build-motion-atlases.mjs`, `assets/sprites/actors-atlas.png`, `assets/sprites/ambient-atlas.png`, `loop/graphics/CURRENT.md`, `loop/graphics/BACKLOG.md`.

## Changes

- Added `ROLE_SIGNATURE` in `scripts/build-motion-atlases.mjs` with per-role controls:
  - `shoulderBias` for dominant shoulder offset cadence,
  - `foldPinch` for sharper work-only cloth pinch breakup,
  - `loadDrag` for asymmetric carry payload drag,
  - `handFavor` for non-mirrored favored hand height bias.
- Integrated `ROLE_SIGNATURE` into `drawPayload(...)`:
  - added `signaturePulse` and blended it into carry payload offset drift,
  - expanded carry payload width shaping with role-specific `loadDrag`.
- Integrated `ROLE_SIGNATURE` into `drawActor(...)`:
  - added `signatureWarp` and `shoulderBias` role cadence,
  - added a new work-only cloth pinch slash in the exertion fold stack,
  - offset left/right hand heights using `handFavor` plus shoulder bias.
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

The actor atlas now adds a role-signature asymmetry layer on top of prior motion passes, increasing shoulder dominance, fold pinch breakup, and load drag irregularity so work/carry loops should read less mirrored once close 2D capture is unblocked.

## Remaining Issues

- Chromium launch remains blocked in this sandbox, preventing refreshed close 2D screenshots (`anim-live-actors-close.png`, `critic-zoom-close.png`).
- Live screenshot validation is still needed to confirm any remaining mirrored cadence across heavy labor roles after `ROLE_SIGNATURE`.

## Next Best Target

Run `node scripts/verify-anim.mjs` and `node scripts/verify-critic.mjs` in a Chromium-allowed environment, then tune any remaining mirrored role outliers from refreshed close 2D screenshots.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/029-actor-signature-asymmetry-pass.md`
