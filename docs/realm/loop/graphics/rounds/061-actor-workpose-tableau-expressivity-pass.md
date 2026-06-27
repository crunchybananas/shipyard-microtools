# 061 - actor-workpose-tableau-expressivity-pass

## Goal

Push actor bitmap work/carry motion farther from puppet-like symmetry by
amplifying role-specific silhouette snap, cloth-fold slash depth,
asymmetric payload lift/cant, and hand cadence separation.

## Starting Point

- Previous handoff: `rounds/060-actor-workpose-tableau-silhouette-cadence-pass.md`.
- Screenshots inspected: `scripts/screenshots/actors-workpose-close-round-060.png`.
- Relevant files: `scripts/build-motion-atlases.mjs`.

## Changes

- Advanced close proof export target:
  - `scripts/screenshots/actors-workpose-close-round-061.png`
- Updated proof panel label text to round 061.
- Increased `ROLE_WORKPOSE_TABLEAU` values across roles for stronger
  silhouette/fold/payload/pose cadence and asymmetric lift separation.
- Strengthened tableau synthesis wiring:
  - increased `workposeTableauRhythm` frequency, phase coupling, and amplitude,
  - deepened final tableau fold slash sweep, displacement, and thickness,
  - increased tableau hand-height asymmetry and rhythm weighting.

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

- `scripts/screenshots/actors-workpose-close-round-061.png`

Browser or Playwright findings:

- `node scripts/build-motion-atlases.mjs` passed and wrote:
  - `assets/sprites/actors-atlas.png`
  - `assets/sprites/ambient-atlas.png`
  - `scripts/screenshots/actors-workpose-close-round-061.png`
- `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` failed due to Chromium launch denial in this sandbox (`bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`).
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` produced no output.
- `rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" ...` produced no matches.

## Visual Result

Round 061 further exaggerates role-distinct labor posture: heavier roles
show chunkier off-axis torso and hand spread, fold slashes read more
directional and uneven, and payloads sit with stronger asymmetric cant.
The close 2D proof (`actors-workpose-close-round-061.png`) shows clearer
bitmap silhouette breakup and stronger role-specific hand cadence.

## Remaining Issues

- Live verifier scripts remain blocked in this environment by Chromium launch permissions, so `verify-anim`, `verify-critic`, and full `verify.mjs --game --logic` captures could not be refreshed.

## Next Best Target

Run `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and
`node scripts/verify.mjs --game --logic` in a Chromium-allowed
environment and tune any remaining mirrored cadence outliers against
`scripts/screenshots/actors-workpose-close-round-061.png`.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/061-actor-workpose-tableau-expressivity-pass.md`
