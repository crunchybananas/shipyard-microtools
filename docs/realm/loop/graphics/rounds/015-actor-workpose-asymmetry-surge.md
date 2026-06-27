# 015 - actor-workpose-asymmetry-surge

## Goal

Push actor bitmap motion further beyond puppet-like cadence by increasing role-specific work-pose asymmetry, deepening cloth-fold slash lines, and adding more uneven payload motion so silhouettes read less mirrored at close zoom.

## Starting Point

- Previous handoff: `rounds/014-actor-gesture-cloth-shear.md`.
- Baseline artifacts: `assets/sprites/actors-atlas.png`, `assets/sprites/ambient-atlas.png`.
- Relevant files: `scripts/build-motion-atlases.mjs`, `loop/graphics/CURRENT.md`, `loop/graphics/BACKLOG.md`.

## Changes

- Increased `ROLE_GESTURE` ranges for all roles in `scripts/build-motion-atlases.mjs` (`elbowLift`, `reachBias`, `clothShear`, `loadTilt`) with stronger boosts for heavy labor roles (`builder`, `blacksmith`, `lumber`, `miner`) and moderate boosts for lighter roles.
- Added carry-load asymmetry drift in `drawPayload(...)` via `asymNudge`, phase-driven by carry bias and role motion so bundles no longer sit on a near-fixed mirrored offset each frame.
- Added role-specific payload breakup accents for heavy carry roles:
  - extra top chunk/lump forms for `builder`,
  - darker top mass for `blacksmith`/`miner`/`stonecutter`.
- Added two extra work-only diagonal cloth slash/fold lines in `drawActor(...)` to strengthen role-specific work torsion and break mirrored torso reads.
- Rebuilt motion atlases with `node scripts/build-motion-atlases.mjs`.

## Verification

Commands run:

```sh
node --check js/render.js js/ui.js js/main.js js/input.js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs
node scripts/build-motion-atlases.mjs
node scripts/verify-anim.mjs
node scripts/verify-critic.mjs
node scripts/verify.mjs --game --logic
find assets/sprites -maxdepth 1 -name '*.svg' -print
rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" index.html js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs assets/sprites/README.md
```

Results:

- `node --check ...` passed.
- `node scripts/build-motion-atlases.mjs` passed and rewrote:
  - `assets/sprites/actors-atlas.png`
  - `assets/sprites/ambient-atlas.png`
- `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` failed at Chromium launch in this sandbox:
  `bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`.
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` returned no files.
- `rg -n ...` returned no matches (exit code `1`).

## Visual Result

The baked actor atlas now carries stronger role-specific work silhouettes: heavy labor roles show larger elbow-rise/reach skew, deeper diagonal cloth torsion, and more uneven load drift, while lighter roles remain tighter but less mirrored than before. Carry bundles now shift laterally through phase instead of reading as a rigid side attachment.

## Remaining Issues

- Chromium launch remains blocked in this sandbox, so close 2D screenshots could not be refreshed.
- `scripts/screenshots/anim-live-actors-close.png` and `scripts/screenshots/critic-zoom-close.png` remain pending capture in a Chromium-allowed environment.

## Next Best Target

Run `verify-anim`, `verify-critic`, and `verify.mjs --game --logic` where Chromium can launch, capture refreshed close actor screenshots for rounds 009-015, then tune any remaining mirrored cadence outliers seen in those shots.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `assets/sprites/actors-atlas.png`
- `assets/sprites/ambient-atlas.png`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/015-actor-workpose-asymmetry-surge.md`
