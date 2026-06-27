# 011 - actor-workpose-torque-pass

## Goal

Push actor work animation further away from puppet symmetry by adding role-specific torso crush, shoulder hitch, tool-reach bias, and hem torque so labor silhouettes read heavier and less mirrored in bitmap motion.

## Starting Point

- Previous handoff: `rounds/010-actor-workpose-silhouette-overdrive.md`.
- Screenshots inspected: none this round (Chromium launch blocked in sandbox).
- Relevant files: `scripts/build-motion-atlases.mjs`, `loop/graphics/CURRENT.md`, `loop/graphics/BACKLOG.md`.

## Changes

- Added a new `ROLE_WORK` profile map in `scripts/build-motion-atlases.mjs` with per-role `crouch`, `hitch`, `reach`, and `hemTwist` intensities.
- Added work-only torso compression (`torsoCrush`) and shoulder hitch offsets that bias upper-body mass and hand heights per role while working.
- Increased role-specific work arm reach by blending `ROLE_WORK.reach` into working arm swing amplitude.
- Added work-only hem torsion (`hemTorque`) and fed it into key cloth-fold strokes so tunic motion reads asymmetric and rotational rather than mirrored side-to-side.
- Kept all changes in the canonical bitmap atlas generator path; no renderer split or SVG fallback paths were added.

## Verification

Commands run:

```sh
node --check js/render.js js/ui.js js/main.js js/input.js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs
node --check scripts/build-motion-atlases.mjs
node scripts/verify-anim.mjs
node scripts/verify-critic.mjs
node scripts/verify.mjs --game --logic
find assets/sprites -maxdepth 1 -name '*.svg' -print
rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" index.html js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs assets/sprites/README.md
```

Screenshots:

- None this round (Chromium launch blocked before capture).

Browser or Playwright findings:

- `node --check ...` and `node --check scripts/build-motion-atlases.mjs` passed.
- `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` failed at Chromium launch with the same sandbox denial: `bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`.
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` returned no files.
- `rg -n ...` returned no matches (exit code `1`).

## Visual Result

Round 011 deepens role-specific work posture language in the atlas generator: heavy labor roles now carry stronger crouch + shoulder hitch timing with larger work reach and twisted hem folds, which should read as chunkier, less mirrored 2D bitmap motion once atlas rebuild and close captures can run in a Chromium-allowed environment.

## Remaining Issues

- Chromium launch remains blocked in this sandbox, so atlas rebuild and close proof screenshots still cannot be produced.
- `anim-live-actors-close.png` and `critic-zoom-close.png` remain stale and need refresh where Playwright Chromium can launch.

## Next Best Target

Run `node scripts/build-motion-atlases.mjs` plus `verify-anim` and `verify-critic` in a Chromium-allowed environment to bake rounds 009-011 actor motion changes and capture fresh close 2D proof shots.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/011-actor-workpose-torque-pass.md`
