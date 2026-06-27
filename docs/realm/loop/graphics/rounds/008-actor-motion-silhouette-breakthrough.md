# 008 - actor-motion-silhouette-breakthrough

## Goal

Push actor bitmap animation farther past puppet-like motion with stronger role silhouettes, deeper cloth-fold deformation, and more asymmetric carry payload behavior per role.

## Starting Point

- Previous handoff: `rounds/007-verify-runtime-fallback.md`.
- Round target: continue actor animation art polish on the painted atlas pipeline without reintroducing retired SVG/runtime paths.
- Primary file: `scripts/build-motion-atlases.mjs`.

## Changes

- Increased role body-form separation in `ROLE_FORM` so heavy labor roles (lumber, miner, builder, blacksmith) carry visibly broader shoulder mass and stronger lean/lift than soft roles.
- Increased role stance/cant/shoulder-drop spread in `ROLE_POSE` to push more role-specific work posture breakup and less mirrored arm/torso rhythm.
- Deepened work-cycle asymmetry by increasing role kick amplitude and strengthening torso cant + shoulder tilt multipliers during motion.
- Added two more moving tunic fold strokes tied to role kick and torso cant so cloth reads as shifting mass rather than rigid puppet shells.
- Reworked carry payload offset logic to include role-pose-driven x/y bias, so loads hang more unevenly and role-specific carry silhouettes diverge further.
- Rebuilt painted motion atlases:
  - `assets/sprites/actors-atlas.png`
  - `assets/sprites/ambient-atlas.png`

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

- `node scripts/build-motion-atlases.mjs` passed and rewrote actor/ambient atlases.
- `node --check ...` passed.
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` returned no files.
- `rg -n ...` returned no matches.
- `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` still fail in this sandbox because Chromium cannot launch:
  `bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`.

## Visual Result

Actor silhouettes and motion breakup are now more role-distinct in the baked bitmap atlas: labor roles read heavier/off-axis, cloth folds deform more asymmetrically across the stride/work cycles, and carry loads hang with stronger side-biased mass.

## Remaining Issues

- Live close 2D proof screenshots (`anim-live-actors-close.png`, `critic-zoom-close.png`) remain blocked by environment-level Chromium launch denial.
- Runtime verification still needs one pass in a Chromium-allowed environment to prove the improved atlas motion in live scene playback.

## Next Best Target

Run verify scripts in an environment where Chromium can launch and capture refreshed close 2D screenshots proving this round's stronger bitmap motion.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `assets/sprites/actors-atlas.png`
- `assets/sprites/ambient-atlas.png`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/008-actor-motion-silhouette-breakthrough.md`
