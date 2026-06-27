# 006 - actor-work-pose-breakup

## Goal

Push actor atlas motion beyond puppet-like mirroring with stronger role-specific work poses, heavier silhouette breakup for labor roles, and deeper cloth/payload asymmetry.

## Starting Point

- Previous handoff: `rounds/005-actor-motion-silhouette-depth.md`.
- Round target: continue actor animation art polish while preserving raster-only 2D renderer invariants.
- Primary file: `scripts/build-motion-atlases.mjs`.

## Changes

- Increased heavy-role body-form separation in `ROLE_FORM` for lumber, miner, builder, blacksmith, and guard so shoulder mass/lean/lift differences read stronger.
- Increased role pose spread in `ROLE_POSE` for the same heavy roles (stance, torso cant, shoulder drop, carry bias) to widen work posture differences.
- Added role-driven work-side kick (`roleKick`) so arm height and cloth-fold direction are intentionally asymmetric in work cycles instead of evenly mirrored.
- Added two additional tunic fold strokes tied to kick/hem motion to make cloth deformation look less rigid and more painterly under movement.
- Rebuilt atlases, updating `assets/sprites/actors-atlas.png` and `assets/sprites/ambient-atlas.png`.

## Verification

Commands run:

```sh
node scripts/build-motion-atlases.mjs
node --check js/render.js js/ui.js js/main.js js/input.js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs
node scripts/verify-anim.mjs
node scripts/verify-critic.mjs
node scripts/verify.mjs --game --logic
find assets/sprites -maxdepth 1 -name '*.svg' -print
rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" index.html js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs assets/sprites/README.md
```

Outcomes:

- `node scripts/build-motion-atlases.mjs` passed and rewrote actor/ambient atlas PNGs.
- `node --check ...` passed.
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` returned no files.
- `rg -n ...` returned no matches.
- `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` still failed with `HTTP server did not come up on port 4711` from `scripts/_serve.mjs`.

## Visual Result

Heavy labor roles now read with stronger off-axis motion and wider stance/torso divergence, cloth folds break across sides more unevenly during work/carry cycles, and carried masses keep a less balanced silhouette.

## Remaining Issues

- Close in-game 2D screenshot proof is still blocked by local verify server startup failure.

## Next Best Target

Unblock `scripts/_serve.mjs` startup so the screenshot verifiers can run and capture close 2D proof of actor motion improvements.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `assets/sprites/actors-atlas.png`
- `assets/sprites/ambient-atlas.png`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/006-actor-work-pose-breakup.md`
