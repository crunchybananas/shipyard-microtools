# 031 - actor-workpose-edge-pass

## Goal

Push actor bitmap motion further beyond mirrored puppet read using stronger stance twist, cloth drag folds, asymmetric payload swing, and role-specific hand set offsets.

## Starting Point

- Previous handoff: `rounds/030-actor-workpose-plus-pass.md`.
- Screenshots inspected: none new in this sandbox (Chromium launch still blocked).
- Relevant files: `scripts/build-motion-atlases.mjs`, `assets/sprites/actors-atlas.png`, `assets/sprites/ambient-atlas.png`, `loop/graphics/CURRENT.md`, `loop/graphics/BACKLOG.md`.

## Changes

- Added `ROLE_WORKPOSE_EDGE` in `scripts/build-motion-atlases.mjs` with per-role controls:
  - `stanceTwist` for added role-specific silhouette drift in work/carry posture,
  - `clothDrag` for deeper work-only cloth drag slash motion,
  - `payloadSwing` for stronger asymmetric carry-load swing and width pulse,
  - `handSet` for additional left/right hand pose offset breakup.
- Integrated `ROLE_WORKPOSE_EDGE` into `drawPayload(...)`:
  - added `workposeEdgePulse` into carry payload offset cadence,
  - increased payload width shaping from per-role `payloadSwing`.
- Integrated `ROLE_WORKPOSE_EDGE` into `drawActor(...)`:
  - added role-based stance twist into body X silhouette drift,
  - added `workposeEdgeWarp` cadence and a new work-only cloth drag slash,
  - added role-based `handSet` contribution to left/right hand height asymmetry.
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

The actor atlas now layers `ROLE_WORKPOSE_EDGE` over prior role controls so work/carry loops should read chunkier and less mirrored, with stronger role-separated stance twist, extra cloth drag folds, asymmetric payload swing pulses, and additional hand-set offsets once close 2D screenshot capture is unblocked.

## Remaining Issues

- Chromium launch remains blocked in this sandbox, preventing refreshed close 2D screenshots (`anim-live-actors-close.png`, `critic-zoom-close.png`).
- Live screenshot validation is still needed to confirm any remaining mirrored role cadence after stacking `ROLE_WORKPOSE_EDGE` with the prior asymmetry passes.

## Next Best Target

Run `node scripts/verify-anim.mjs` and `node scripts/verify-critic.mjs` in a Chromium-allowed environment, then tune any remaining mirrored role outliers from refreshed close 2D screenshots.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/031-actor-workpose-edge-pass.md`
