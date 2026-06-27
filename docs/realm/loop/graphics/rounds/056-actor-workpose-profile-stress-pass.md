# 056 - actor-workpose-profile-stress-pass

## Goal

Push actor bitmap motion beyond puppet-like cadence with stronger role-separated silhouette drift, cloth fold stress, asymmetric payload swing, and more distinct hand cadence in close 2D work poses.

## Starting Point

- Previous handoff: `rounds/055-actor-workpose-tableau-silhouette-pass.md`.
- Screenshots inspected: `scripts/screenshots/actors-workpose-close-round-054.png` (latest available in this sandbox).
- Relevant files: `scripts/build-motion-atlases.mjs`.

## Changes

- Advanced close proof export target:
  - `scripts/screenshots/actors-workpose-close-round-056.png`
- Updated proof panel label text to round 056.
- Updated close proof role set to emphasize heavier role-specific asymmetry comparisons:
  - `lumber`, `miner`, `builder`, `blacksmith`, `trader`, `guard`.
- Increased `ROLE_WORKPOSE_TABLEAU` values across roles to further amplify:
  - role-separated silhouette snap,
  - cloth fold pinch stress,
  - asymmetric payload cant,
  - pose-set hand cadence breakup.
- Increased tableau influence in motion synthesis:
  - stronger `bodyX` silhouette displacement weighting,
  - higher `workposeTableauWarp` frequency/amplitude,
  - stronger `workposeTableauRhythm` phase/amplitude,
  - stronger left/right hand offset multipliers driven by `poseSet` and tableau rhythm.

## Verification

Commands run:

```sh
node --check js/render.js js/ui.js js/main.js js/input.js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs
node scripts/verify-anim.mjs
node scripts/verify-critic.mjs
node scripts/verify.mjs --game --logic
find assets/sprites -maxdepth 1 -name '*.svg' -print
rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" index.html js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs assets/sprites/README.md
```

Screenshots:

- No new screenshot generated in this sandbox run because Chromium launch remains denied.
- Expected output path once Chromium is available: `scripts/screenshots/actors-workpose-close-round-056.png`.

Browser or Playwright findings:

- `node --check ...` passed.
- `node scripts/verify-anim.mjs` failed on Chromium launch with:
  - `bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`.
- `node scripts/verify-critic.mjs` failed with the same Chromium launch denial.
- `node scripts/verify.mjs --game --logic` failed with the same Chromium launch denial.
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` produced no output.
- `rg -n ...` produced no matches.

## Visual Result

Round 056 deepens role-specific work-pose separation in the canonical 2D actor atlas generator by increasing silhouette displacement, fold stress motion, and asymmetric hand/payload cadence controls, positioning the next atlas bake to show less mirrored, more labor-specific bitmap motion.

## Remaining Issues

- Chromium launch is still blocked for Playwright-dependent atlas and screenshot verification in this environment.
- Round-056 close 2D proof image generation remains pending until Chromium can launch.

## Next Best Target

Run `node scripts/build-motion-atlases.mjs`, `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` in a Chromium-allowed environment to generate `actors-workpose-close-round-056.png` and confirm the new silhouette/fold/payload/hand asymmetry in live 2D captures.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/056-actor-workpose-profile-stress-pass.md`
