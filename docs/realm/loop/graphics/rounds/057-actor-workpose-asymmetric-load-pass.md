# 057 - actor-workpose-asymmetric-load-pass

## Goal

Push actor bitmap motion farther beyond puppet cadence by strengthening role-separated silhouette snap, cloth fold pinch stress, asymmetric payload cant, and role-specific left/right work-hand cadence.

## Starting Point

- Previous handoff: `rounds/056-actor-workpose-profile-stress-pass.md`.
- Screenshots inspected: none newly generated in this sandbox (Chromium launch remains blocked).
- Relevant files: `scripts/build-motion-atlases.mjs`.

## Changes

- Advanced close proof export target:
  - `scripts/screenshots/actors-workpose-close-round-057.png`
- Updated proof panel label text to round 057.
- Increased `ROLE_WORKPOSE_TABLEAU` values across roles to amplify:
  - silhouette snap separation,
  - cloth fold pinch stress,
  - payload cant asymmetry,
  - pose-set hand cadence breakup.
- Increased tableau dynamics in synthesis:
  - stronger `workposeTableauPulse` frequency/amplitude,
  - stronger `workposeTableauRhythm` frequency/amplitude,
  - stronger left/right hand asymmetry weighting through `leftHandY` and `rightHandY` tableau multipliers.

## Verification

Commands run:

```sh
node --check js/render.js js/ui.js js/main.js js/input.js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs
node scripts/verify-anim.mjs
node scripts/verify-critic.mjs
node scripts/verify.mjs --game --logic
node scripts/build-motion-atlases.mjs
find assets/sprites -maxdepth 1 -name '*.svg' -print
rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" index.html js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs assets/sprites/README.md
```

Results:

- `node --check ...` passed.
- `node scripts/verify-anim.mjs` failed: Chromium launch denial (`bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`).
- `node scripts/verify-critic.mjs` failed with the same Chromium launch denial.
- `node scripts/verify.mjs --game --logic` failed with the same Chromium launch denial.
- `node scripts/build-motion-atlases.mjs` failed with the same Chromium launch denial.
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` produced no output.
- `rg -n ...` produced no matches.

## Visual Result

Round 057 further biases actor work/carry motion toward non-mirrored role silhouettes by strengthening tableau-driven body snap, fold stress, and payload/hand desynchronization controls in the canonical 2D atlas generator.

## Remaining Issues

- Chromium launch remains blocked in this sandbox, preventing atlas rebuild and new close PNG proof capture.
- The round-057 close proof image remains pending until Chromium can run.

## Next Best Target

Run atlas/verify scripts in a Chromium-allowed environment to generate `scripts/screenshots/actors-workpose-close-round-057.png`, then tune any remaining mirrored cadence outliers from the refreshed close captures.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/057-actor-workpose-asymmetric-load-pass.md`
