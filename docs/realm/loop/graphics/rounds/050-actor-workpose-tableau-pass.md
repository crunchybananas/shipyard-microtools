# 050 - actor-workpose-tableau-pass

## Goal

Push actor bitmap motion farther from puppet symmetry by adding a new role-specific tableau layer for stronger silhouette snap, cloth fold pinch, asymmetric payload cant, and work-pose set cadence.

## Starting Point

- Previous handoff: `rounds/049-actor-workpose-story-pass.md`.
- Screenshots inspected: `scripts/screenshots/actors-workpose-close-round-049.png`.
- Relevant files: `scripts/build-motion-atlases.mjs`, `loop/graphics/CURRENT.md`, `loop/graphics/BACKLOG.md`.

## Changes

- Added `ROLE_WORKPOSE_TABLEAU` in `scripts/build-motion-atlases.mjs` with per-role:
  - `silhouetteSnap`
  - `foldPinch`
  - `payloadCant`
  - `poseSet`
- Advanced close proof export target to:
  - `scripts/screenshots/actors-workpose-close-round-050.png`
- Wired `ROLE_WORKPOSE_TABLEAU` through `drawActor(...)`:
  - added `workposeTableauWarp` and `workposeTableauRhythm`,
  - added an extra deep tableau fold stroke for stronger silhouette pinch,
  - extended left/right hand cadence breakup with tableau pose-set and rhythm offsets.
- Wired `ROLE_WORKPOSE_TABLEAU` through `drawPayload(...)`:
  - added `workposeTableauPulse` into payload drift and width shaping for more asymmetric carry cant.
- Rebuilt painted motion atlases:
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

- New close proof generated:
  - `scripts/screenshots/actors-workpose-close-round-050.png`

Browser or Playwright findings:

- `node --check ...` passed.
- `node --check scripts/build-motion-atlases.mjs` passed.
- `node scripts/build-motion-atlases.mjs` passed and wrote atlas/proof PNGs.
- `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` failed at Chromium launch with:
  - `bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`.
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` returned no files.
- `rg -n ...` returned no matches.

## Visual Result

Actor work motion now carries a stronger role-specific tableau layer: silhouettes snap harder off-center, cloth fold strokes pinch/deepen under work strain, carried payloads cant with less mirrored timing, and hand cadence reads more task-biased in close bitmap proof output.

## Remaining Issues

- Chromium launch denial still blocks live `verify-anim`, `verify-critic`, and `verify.mjs --game --logic` screenshot proof in this sandbox.
- Role-by-role outlier tuning from live verify close captures remains pending.

## Next Best Target

Run `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` where Chromium can launch, then retune outlier role cadence from refreshed close captures (`anim-live-actors-close.png`, `critic-zoom-close.png`) against `actors-workpose-close-round-050.png`.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `assets/sprites/actors-atlas.png`
- `assets/sprites/ambient-atlas.png`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/050-actor-workpose-tableau-pass.md`
