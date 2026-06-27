# 042 - actor-workpose-drape-pass

## Goal

Push actor bitmap motion farther past puppet-like reads by adding a role-specific drape/asymmetry layer that deepens silhouette hooks, cloth fold drape, asymmetric payload drop, and hand cadence separation.

## Starting Point

- Previous handoff: `rounds/041-actor-workpose-fold-pass.md`.
- Relevant files: `scripts/build-motion-atlases.mjs`, `loop/graphics/CURRENT.md`, `loop/graphics/BACKLOG.md`.

## Changes

- Added `ROLE_WORKPOSE_DRAPE` in `scripts/build-motion-atlases.mjs` with per-role values for:
  - `silhouetteHook`
  - `foldDrape`
  - `payloadDrop`
  - `handFavor`
- Wired `ROLE_WORKPOSE_DRAPE` through `drawActor(...)` silhouette/body and fold warp math to push stronger role-distinct hooks and a deeper drape-fold slash layer in work poses.
- Extended `drawPayload(...)` signature + carry pulse/width shaping to include `workposeDrape`, increasing role-specific payload drop asymmetry and carry drift breakup.
- Extended work hand Y timing with `workposeDrape` offsets and `workposeDrapeRhythm` to reduce mirrored cadence.
- Advanced round proof path/label wiring to:
  - `scripts/screenshots/actors-workpose-close-round-042.png`

## Verification

Commands run:

```sh
node --check js/render.js js/ui.js js/main.js js/input.js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs scripts/build-motion-atlases.mjs
node scripts/verify-anim.mjs
node scripts/verify-critic.mjs
node scripts/verify.mjs --game --logic
find assets/sprites -maxdepth 1 -name '*.svg' -print
rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" index.html js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs assets/sprites/README.md
```

Results:

- `node --check ...` passed.
- `node scripts/verify-anim.mjs` failed at Chromium launch with:
  - `bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`.
- `node scripts/verify-critic.mjs` failed with the same Chromium launch denial.
- `node scripts/verify.mjs --game --logic` failed with the same Chromium launch denial.
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` returned no files.
- `rg -n ...` returned no matches.

## Visual Result

Runtime screenshot proof and atlas rebuild remain blocked by Chromium permissions in this sandbox, but the canonical actor atlas generator now includes an additional role-driven drape layer that should yield chunkier silhouettes, heavier cloth fold drape, more asymmetric carried mass, and less mirrored work-hand cadence when rebuilt.

## Remaining Issues

- Chromium launch denial still prevents `build-motion-atlases` and verify screenshot scripts from running, so no new close 2D screenshots were generated this round.
- Role-by-role tuning against fresh `anim-live-actors-close.png` and `critic-zoom-close.png` remains pending.

## Next Best Target

Run `node scripts/build-motion-atlases.mjs`, `node scripts/verify-anim.mjs`, and `node scripts/verify-critic.mjs` in a Chromium-allowed environment, then tune outliers from fresh close captures and exported `actors-workpose-close-round-042.png`.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/042-actor-workpose-drape-pass.md`
