# 005 - actor-motion-silhouette-depth

## Goal

Push actor bitmap animation farther from puppet-like symmetry with deeper role silhouette separation, stronger cloth-fold motion, and more asymmetric carry masses.

## Starting Point

- Previous handoff: `rounds/004-actor-motion-pose-bias.md`.
- Target from automation: continue actor animation art polish with close 2D proof when possible.
- Relevant files: `scripts/build-motion-atlases.mjs`, `assets/sprites/actors-atlas.png`, `assets/sprites/ambient-atlas.png`.

## Changes

- Increased `ROLE_FORM` shoulder/lean/lift/hem spread so heavy roles (builder, blacksmith, lumber, miner) read broader and more forceful while lighter roles stay tighter.
- Increased `ROLE_POSE` stance/cant/shoulder-drop separation to amplify role-specific work posture and reduce mirrored motion.
- Deepened carry payload asymmetry by increasing per-role load offsets, vertical drift, and strap angles in `drawPayload`.
- Added two extra moving cloth-fold strokes tied to body swing so tunics read as deforming fabric instead of rigid capsules.
- Expanded hand spacing by role shoulder mass so upper-body silhouettes vary more clearly across professions.
- Rebuilt motion atlases; new pixels were written to `assets/sprites/actors-atlas.png` and `assets/sprites/ambient-atlas.png`.

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

- `node scripts/build-motion-atlases.mjs` passed and rewrote both motion atlas PNGs.
- `node --check ...` passed.
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` returned no files.
- `rg -n ...` returned no matches.
- `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` failed with: `HTTP server did not come up on port 4711`.
- Retest with `REALM_PORT=4722` also failed with the same server startup error.

## Visual Result

Actor motion frames now show stronger role-dependent mass and pose contrast: heavier labor roles carry wider shoulders and deeper tilt, tunic folds break more dynamically, and carry sets read as off-balance loads instead of symmetric props.

## Remaining Issues

- Close in-game 2D screenshots proving the new motion read are still blocked because the verify server helper cannot stand up local HTTP in this environment.

## Next Best Target

Unblock local verify server startup so `verify-anim`, `verify-critic`, and `verify.mjs --game --logic` can capture close 2D proof screenshots for this actor pass.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `assets/sprites/actors-atlas.png`
- `assets/sprites/ambient-atlas.png`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/005-actor-motion-silhouette-depth.md`
