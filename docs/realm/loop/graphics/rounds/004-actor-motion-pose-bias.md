# 004 - actor-motion-pose-bias

## Goal

Push actor bitmap animation farther from puppet-like symmetry with role-specific work posture bias, stronger cloth fold breakup, and side-biased carry/read silhouettes.

## Starting Point

- Previous handoff: `rounds/003-actor-motion-silhouette-pass.md`.
- Screenshots inspected: prior round proofs (`scripts/screenshots/anim-live-actors.png`, `scripts/screenshots/anim-live-actors-close.png`) from existing baseline artifacts.
- Relevant files: `scripts/build-motion-atlases.mjs`, `loop/graphics/CURRENT.md`, `loop/graphics/BACKLOG.md`.

## Changes

- Added `ROLE_POSE` in the atlas generator with per-role stance width, torso cant, shoulder drop, and carry-side bias values.
- Applied role-specific stance width into leg separation so heavy roles read wider and grounded while light roles stay tighter.
- Added dynamic torso cant and shoulder tilt offsets to break mirrored arm arcs and create role-specific work asymmetry.
- Added two extra painted cloth-fold strokes driven by pose cant so tunics read as twisting fabric rather than static panels.
- Added carry-side bias wiring so payload side assignment is role-skewed instead of uniformly mirrored.

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

Screenshots:

- New screenshots could not be captured this run because Playwright Chromium launch failed before verifier startup.

Browser or Playwright findings:

- `node scripts/build-motion-atlases.mjs` failed at browser launch with `browserType.launch: Target page, context or browser has been closed`.
- Chromium reported `MachPortRendezvousServer ... Permission denied (1100)` and exited.
- `node --check ...` passed.
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` returned no files.
- `rg -n ...` returned no matches.
- `verify-anim`, `verify-critic`, and `verify.mjs --game --logic` were not runnable due to the same Playwright launch blocker.

## Visual Result

Generator-side actor motion logic now encodes stronger role-specific posture asymmetry (stance, shoulder drop, torso cant, and carry-side bias), which should produce less mirrored and more role-distinct bitmap motion once atlases are rebuilt and captured in the canonical 2D renderer.

## Remaining Issues

- Atlas rebuild is blocked in this environment by Playwright Chromium launch permissions, so updated pixels were not regenerated in this run.
- Close 2D proof screenshots for the new pose-bias pass remain missing until Playwright launch is restored.

## Next Best Target

Unblock Playwright/Chromium launch in this environment, then rerun atlas build plus `verify-anim` close captures so the pose-bias improvements are proven in live 2D screenshots.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/004-actor-motion-pose-bias.md`
