# 016 - actor-pose-accent-layer

## Goal

Push bitmap actor work/carry motion farther from puppet symmetry by adding role-specific accent weight to silhouette cant, cloth slash folds, and asymmetric payload drift.

## Starting Point

- Previous handoff: `rounds/015-actor-workpose-asymmetry-surge.md`.
- Screenshots inspected: existing prior round captures only; no newly generated close shots in this sandbox.
- Relevant files: `scripts/build-motion-atlases.mjs`, `loop/graphics/CURRENT.md`, `loop/graphics/BACKLOG.md`.

## Changes

- Added `ROLE_ACCENT` in `scripts/build-motion-atlases.mjs` to provide per-role motion accent controls:
  - `silhouette` for torso cant exaggeration,
  - `cloth` for additional work-only slash fold weight,
  - `payload` for carry bundle asymmetry/tilt escalation.
- Extended `drawPayload(...)` to consume `accent` and apply additional:
  - payload tilt gain,
  - asymmetry drift gain,
  - secondary cross-phase jitter (`crossNudge`) so load offsets no longer follow one mirrored sinusoid.
- Added a third work-only diagonal cloth slash line in `drawActor(...)` driven by role accent cloth weight.
- Routed `accent` through actor render path and into payload draw call.

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

- None newly captured in this sandbox.

Browser or Playwright findings:

- `node --check ...` passed.
- `node --check scripts/build-motion-atlases.mjs` passed.
- `node scripts/build-motion-atlases.mjs` failed at Chromium launch with:
  `bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`.
- `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and
  `node scripts/verify.mjs --game --logic` failed with the same Chromium launch error.
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` returned no files.
- `rg -n ...` returned no matches (exit code `1`).

## Visual Result

Code-level actor motion shaping is now more role-distinct in the generator path: heavy roles gained extra carry-load jitter/tilt and stronger work-slashed cloth breakup, while lighter roles keep smaller offsets. Live atlas/screenshot proof is pending because Chromium launch is blocked in this environment.

## Remaining Issues

- Atlas rebake is blocked by Playwright Chromium launch permission denial.
- Close 2D proof shots (`anim-live-actors-close.png`, `critic-zoom-close.png`) remain pending in a Chromium-allowed runtime.

## Next Best Target

Run atlas rebuild and all verify screenshot scripts where Chromium can launch, then inspect new close actor shots and trim any role outliers that still read mirrored.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/016-actor-pose-accent-layer.md`
