# 053 - actor-workpose-role-asymmetry-pass

## Goal

Push actor bitmap work animation farther from puppet-like motion by increasing role silhouette offsets, cloth fold pinch/warp, payload cant asymmetry, and hand cadence desync in close 2D motion.

## Starting Point

- Previous handoff: `rounds/052-actor-workpose-kinetic-breakup-pass.md`.
- Screenshots inspected: `scripts/screenshots/actors-workpose-close-round-052.png` (prior round reference only).
- Relevant files: `scripts/build-motion-atlases.mjs`.

## Changes

- Advanced close proof export target:
  - `scripts/screenshots/actors-workpose-close-round-053.png`
- Increased `ROLE_WORKPOSE_TABLEAU` values across all roles so each role carries stronger role-specific silhouette snap, cloth-fold pinch, payload cant, and pose-set cadence.
- Increased tableau contribution to `bodyX` displacement in `drawActor(...)` so profile/readable role offsets separate more clearly.
- Increased tableau warp/rhythm terms (`workposeTableauWarp`, `workposeTableauRhythm`) to deepen cloth fold motion and reduce mirrored cadence.
- Increased tableau influence on left/right hand timing/height (`leftHandY`, `rightHandY`) to push asymmetric work-pose beats.
- Updated close proof panel metadata for this round:
  - Title text now references round 053.
  - Proof role set now emphasizes heavy-role asymmetry (`lumber`, `miner`, `builder`, `blacksmith`, `stonecutter`, `guard`).

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

- Could not refresh in this sandbox because Playwright Chromium launch is denied.

Browser or Playwright findings:

- `node --check ...` passed.
- `node --check scripts/build-motion-atlases.mjs` passed.
- `node scripts/build-motion-atlases.mjs` failed on Chromium launch with:
  - `bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`
- `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` failed with the same Chromium launch denial.
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` produced no output.
- `rg -n ...` produced no matches.

## Visual Result

Code-side actor motion now drives stronger role-separated silhouette offsets, deeper cloth fold pinch, heavier asymmetric payload cant, and less mirrored hand cadence in the canonical 2D atlas path. In this sandbox, Chromium launch denial prevented atlas rebuild and close screenshot proof refresh.

## Remaining Issues

- Chromium launch is still blocked in this environment, so refreshed `actors-atlas.png` and round-053 close captures could not be regenerated.
- Live visual confirmation of the new tableau pass remains pending in a Chromium-allowed environment.

## Next Best Target

Run `node scripts/build-motion-atlases.mjs`, `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` in a Chromium-allowed environment, then tune any remaining mirrored role cadence from refreshed close captures.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `loop/graphics/rounds/053-actor-workpose-role-asymmetry-pass.md`
