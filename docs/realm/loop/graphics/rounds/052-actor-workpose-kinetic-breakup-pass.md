# 052 - actor-workpose-kinetic-breakup-pass

## Goal

Push actor bitmap work poses further away from puppet-like motion by deepening role silhouette breakage, cloth-fold stacking, and asymmetric payload/hand cadence.

## Starting Point

- Previous handoff: `rounds/051-actor-workpose-silhouette-snap-pass.md`.
- Screenshot reference inspected: `scripts/screenshots/actors-workpose-close-round-051.png`.
- Relevant file: `scripts/build-motion-atlases.mjs`.

## Changes

- Advanced close proof export target to:
  - `scripts/screenshots/actors-workpose-close-round-052.png`
- Increased `ROLE_WORKPOSE_TABLEAU` values across all roles (`silhouetteSnap`, `foldPinch`, `payloadCant`, `poseSet`) to exaggerate role-specific work posture signatures.
- Increased tableau influence in `drawActor(...)` body displacement (`bodyX`) so role silhouettes swing farther from centerline.
- Increased tableau warp and rhythm amplitude (`workposeTableauWarp`, `workposeTableauRhythm`) for chunkier cloth deformation timing.
- Added an extra deep tableau fold slash in the work-only fold stack to increase painterly cloth breakup under exertion.
- Increased tableau impact on left/right hand height and cadence desync in `leftHandY`/`rightHandY` to reduce mirrored hand beats.

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

Outcomes:

- `node --check ...` passed.
- `node --check scripts/build-motion-atlases.mjs` passed.
- `node scripts/build-motion-atlases.mjs` failed due Chromium launch denial:
  - `bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`
- `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` failed with the same Chromium launch denial.
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` produced no output.
- `rg -n ...` produced no matches.

## Visual Result

Code-side motion tuning now biases stronger role-distinct silhouettes, deeper fold rake, and less mirrored hand cadence, but live atlas/screenshot evidence could not be regenerated in this sandbox due Chromium launch failure.

## Remaining Issues

- Chromium launch remains blocked in this environment, preventing atlas rebuild and fresh close 2D screenshot proof for round 052.
- `assets/sprites/actors-atlas.png` and `scripts/screenshots/actors-workpose-close-round-052.png` still need regeneration in a Chromium-allowed environment.

## Next Best Target

Run `node scripts/build-motion-atlases.mjs`, `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` where Chromium can launch, then tune outlier role cadence from refreshed close captures.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `loop/graphics/rounds/052-actor-workpose-kinetic-breakup-pass.md`
