# 030 - actor-workpose-plus-pass

## Goal

Push actor bitmap motion farther from clean mirrored puppet motion with stronger role-separated work silhouettes, cloth fold hooks, asymmetric payload offset drift, and role-biased hand pose lead.

## Starting Point

- Previous handoff: `rounds/029-actor-signature-asymmetry-pass.md`.
- Screenshots inspected: none new in this sandbox (Chromium launch still blocked).
- Relevant files: `scripts/build-motion-atlases.mjs`, `assets/sprites/actors-atlas.png`, `assets/sprites/ambient-atlas.png`, `loop/graphics/CURRENT.md`, `loop/graphics/BACKLOG.md`.

## Changes

- Added `ROLE_WORKPOSE_PLUS` in `scripts/build-motion-atlases.mjs` with per-role controls:
  - `silhouetteLift` for stronger role-specific body drift,
  - `foldHook` for an additional work-only cloth hook/slash fold,
  - `payloadOffset` for stronger asymmetric carry-load pulse drift,
  - `poseLead` for less mirrored left/right hand-height offsets.
- Integrated `ROLE_WORKPOSE_PLUS` into `drawPayload(...)`:
  - added `workposePlusPulse` to carry payload X-offset cadence,
  - increased payload width shaping using role-specific `payloadOffset`.
- Integrated `ROLE_WORKPOSE_PLUS` into `drawActor(...)`:
  - added role-based silhouette lift into body X drift,
  - added `workposePlusWarp` cadence and a new work-only cloth hook slash,
  - added role-based `poseLead` contribution to left/right hand-height asymmetry.
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

The actor atlas now layers `ROLE_WORKPOSE_PLUS` over prior role controls so work/carry loops should read chunkier and less mirrored, with stronger role-specific silhouette lift, extra cloth hook folds, and asymmetric payload/hand pose drift once close 2D capture is unblocked.

## Remaining Issues

- Chromium launch remains blocked in this sandbox, preventing refreshed close 2D screenshots (`anim-live-actors-close.png`, `critic-zoom-close.png`).
- Live screenshot validation is still needed to confirm any remaining mirrored role cadence after stacking `ROLE_WORKPOSE_PLUS` with prior asymmetry passes.

## Next Best Target

Run `node scripts/verify-anim.mjs` and `node scripts/verify-critic.mjs` in a Chromium-allowed environment, then tune any remaining mirrored role outliers from refreshed close 2D screenshots.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/030-actor-workpose-plus-pass.md`
