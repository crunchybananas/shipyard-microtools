# 040 - actor-workpose-sway-proof

## Goal

Push actor bitmap motion farther past puppet-like symmetry by deepening role-specific silhouette sway, cloth fold ripple, payload lag asymmetry, and work-hand cadence in close 2D proof.

## Starting Point

- Previous handoff: `rounds/039-actor-workpose-rhythm-proof.md`.
- Screenshots inspected: new atlas close proof export from this round.
- Relevant files: `scripts/build-motion-atlases.mjs`, `assets/sprites/actors-atlas.png`, `scripts/screenshots/actors-workpose-close-round-040.png`, `loop/graphics/CURRENT.md`, `loop/graphics/BACKLOG.md`.

## Changes

- Added `ROLE_WORKPOSE_SWAY` in `scripts/build-motion-atlases.mjs` with per-role values for:
  - `silhouetteSway`
  - `foldRipple`
  - `payloadLag`
  - `handBrake`
- Wired `ROLE_WORKPOSE_SWAY` through `drawActor(...)` body placement to create stronger role-distinct silhouette offsets beyond prior `ROLE_WORKPOSE_HEFT` and rhythm layers.
- Added `workposeSwayWarp` + `workposeSwayRhythm` tri-wave deformation and integrated them into cloth fold slashes and left/right hand heights to further break mirrored timing.
- Extended `drawPayload(...)` with `workposeSwayPulse` and applied it across carry payload nudge/width shaping for heavier asymmetric carry reads.
- Advanced proof output path and label from round 039 to round 040:
  - `scripts/screenshots/actors-workpose-close-round-040.png`
- Rebuilt atlas outputs:
  - `assets/sprites/actors-atlas.png`
  - `assets/sprites/ambient-atlas.png`

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

Results:

- `node --check ...` passed.
- `node scripts/build-motion-atlases.mjs` passed and wrote:
  - `assets/sprites/actors-atlas.png`
  - `assets/sprites/ambient-atlas.png`
  - `scripts/screenshots/actors-workpose-close-round-040.png`
- `node scripts/verify-anim.mjs` failed at Chromium launch with:
  - `bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`.
- `node scripts/verify-critic.mjs` failed with the same Chromium launch denial.
- `node scripts/verify.mjs --game --logic` failed with the same Chromium launch denial.
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` returned no files.
- `rg -n ...` returned no matches.

## Visual Result

The atlas now carries a dedicated post-heft sway layer that increases role-specific silhouette offset, fold ripple depth, payload lag asymmetry, and hand cadence breakup. Close bitmap proof export for this exact round now exists at `scripts/screenshots/actors-workpose-close-round-040.png`.

## Remaining Issues

- Playwright verification remains blocked by Chromium launch permissions in this sandbox, so live `verify-anim` and `verify-critic` close captures could not be refreshed.
- Role-by-role tuning against live runtime close shots is still pending once Chromium can launch.

## Next Best Target

Run `node scripts/verify-anim.mjs` and `node scripts/verify-critic.mjs` in a Chromium-allowed environment, compare against `scripts/screenshots/actors-workpose-close-round-040.png`, and tune any roles that still read mirrored in work or carry at close zoom.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `assets/sprites/actors-atlas.png`
- `assets/sprites/ambient-atlas.png`
- `scripts/screenshots/actors-workpose-close-round-040.png`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/040-actor-workpose-sway-proof.md`
