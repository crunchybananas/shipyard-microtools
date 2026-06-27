# 003 - actor-motion-silhouette-pass

## Goal

Push actor bitmap animation beyond clean puppet-like motion with stronger
silhouettes, cloth folds, asymmetric payloads, and role-specific work poses.

## Starting Point

- Previous handoff: `rounds/002-single-renderer-grounding.md`.
- Target from `CURRENT.md`: actor animation art.
- Relevant files: `scripts/build-motion-atlases.mjs`,
  `assets/sprites/actors-atlas.png`, `scripts/verify-anim.mjs`.

## Changes

- Expanded actor body-form variation in the atlas generator via per-role
  silhouette parameters (shoulder/hem/lean/lift) to break uniform puppet
  outlines.
- Increased role-weighted motion arcs so heavy workers (builder,
  blacksmith, miner, lumber) now lean and swing farther during work/carry.
- Added stronger painted cloth-fold strokes to tunics so torso movement
  reads as cloth deformation instead of a rigid capsule.
- Reworked carry payload rendering to be asymmetric and role-specific:
  trader stack, forager bundle, builder plank-plus-crate, and updated
  default sacks with phase sway.
- Updated animation verification screenshot capture to force a closer 2D
  camera framing and save an extra proof shot (`anim-live-actors-close.png`).
- Rebuilt atlases with the edited generator; actor atlas pixels changed in
  `assets/sprites/actors-atlas.png`.

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

- `node scripts/build-motion-atlases.mjs` passed.
- `node --check ...` passed.
- `find assets/sprites ... '*.svg'` returned no files.
- SVG/sandbox probe grep returned no matches.
- `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and
  `node scripts/verify.mjs --game --logic` are blocked in this environment:
  `scripts/_serve.mjs` fails to bring up `http://127.0.0.1:4711` and throws
  `HTTP server did not come up on port 4711`.

## Visual Result

The rebuilt actor atlas now has visibly less mirrored, uniform motion:
heavier roles read with broader shoulder mass and stronger work lean,
carry sets are less symmetric, and tunic folds animate more like painted
fabric rather than flat puppet panels.

## Remaining Issues

- Runtime screenshot verification is currently blocked by local HTTP serve
  startup failure in this environment, so new close 2D proof captures
  could not be generated this run.
- Building upgrade states are still mostly overlay-level and remain the
  next high-impact visual gap.

## Next Best Target

Building upgrade states: add painted Level 2/3 structural differences so
upgraded buildings read as materially evolved forms, not just accented
variants.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `scripts/verify-anim.mjs`
- `assets/sprites/actors-atlas.png`
- `assets/sprites/ambient-atlas.png`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/003-actor-motion-silhouette-pass.md`
