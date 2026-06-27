# 032 - actor-workpose-force-pass

## Goal

Push actor bitmap motion farther beyond puppet-like symmetry using stronger role-separated silhouette displacement, deeper cloth fold slashes, and heavier asymmetric carry payload cadence.

## Starting Point

- Previous handoff: `rounds/031-actor-workpose-edge-pass.md`.
- Screenshots inspected: none new in this sandbox (Chromium launch still blocked).
- Relevant files: `scripts/build-motion-atlases.mjs`, `loop/graphics/CURRENT.md`, `loop/graphics/BACKLOG.md`.

## Changes

- Added `ROLE_WORKPOSE_FORCE` in `scripts/build-motion-atlases.mjs` with per-role controls:
  - `silhouetteDrive` for stronger role-specific body displacement.
  - `foldPress` for a deeper work-only cloth fold slash layer.
  - `payloadList` for heavier asymmetric carry payload cadence/width shaping.
  - `handDrive` for stronger left/right hand-height separation.
- Integrated `ROLE_WORKPOSE_FORCE` into `drawPayload(...)`:
  - added `workposeForcePulse` into carry payload lateral drift cadence,
  - increased role-weighted carry payload width shaping from `payloadList`.
- Integrated `ROLE_WORKPOSE_FORCE` into `drawActor(...)`:
  - added role-based silhouette displacement via `silhouetteDrive`,
  - added `workposeForceWarp` and a new deeper work-only fold slash,
  - increased hand asymmetry using `handDrive` in left/right hand Y offsets.

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
- `node scripts/build-motion-atlases.mjs`, `node scripts/verify-anim.mjs`,
  `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic`
  failed on Chromium launch with
  `bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`.
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` returned no files.
- `rg -n ...` returned no matches.

## Visual Result

The actor motion generator now stacks `ROLE_WORKPOSE_FORCE` on top of prior
asymmetry layers so work/carry frames should read chunkier and less mirrored,
with stronger role-separated silhouette drift, deeper cloth fold accents,
and heavier asymmetric payload oscillation once close 2D screenshots can be
captured in a Chromium-allowed environment.

## Remaining Issues

- Chromium launch remains blocked in this sandbox, preventing atlas rebuild
  proof and refreshed close 2D screenshots (`anim-live-actors-close.png`,
  `critic-zoom-close.png`).
- Live screenshot validation is still required to tune any remaining mirrored
  role cadence after adding `ROLE_WORKPOSE_FORCE`.

## Next Best Target

Run `node scripts/verify-anim.mjs` and `node scripts/verify-critic.mjs` in a
Chromium-allowed environment, capture close 2D shots, and tune any mirrored
role cadence outliers from the `ROLE_WORKPOSE_FORCE` layer.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/032-actor-workpose-force-pass.md`
