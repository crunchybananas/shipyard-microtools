# 065 - actor-workpose-silhouette-load-asymmetry-pass

## Goal

Push actor bitmap work/carry motion farther beyond puppet-like cadence by deepening role-specific silhouette breakup, cloth fold pinch, asymmetric payload cant, and role work-pose cadence split in close 2D proof frames.

## Starting Point

- Previous handoff: `rounds/064-actor-workpose-role-pose-asymmetry-pass.md`.
- Screenshots inspected: `scripts/screenshots/actors-workpose-close-round-064.png`.
- Relevant files: `scripts/build-motion-atlases.mjs`.

## Changes

- Advanced close proof export target:
  - `scripts/screenshots/actors-workpose-close-round-065.png`
- Updated proof panel heading text to identify round 065 close review.
- Increased `ROLE_WORKPOSE_TABLEAU` role values (`silhouetteSnap`, `foldPinch`, `payloadCant`, `poseSet`, `handCadence`, `asymLift`) with stronger heavy-role asymmetry and wider left/right split.
- Updated close proof rows to prioritize heavy-role work-pose comparison while retaining carry contrast (`settler work down`, `lumber work left`, `miner work right`, `builder work right`, `blacksmith work left`, `trader carry right`).

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

Screenshots:

- `scripts/screenshots/actors-workpose-close-round-065.png`

Browser or Playwright findings:

- `node --check ...` passed.
- `node scripts/build-motion-atlases.mjs` passed and wrote:
  - `assets/sprites/actors-atlas.png`
  - `assets/sprites/ambient-atlas.png`
  - `scripts/screenshots/actors-workpose-close-round-065.png`
- `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` failed due to Chromium launch denial in this sandbox (`bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`).
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` produced no output.
- `rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" ...` produced no matches.

## Visual Result

Round 065 increases silhouette and load asymmetry in close 2D bitmap playback: heavy labor roles (`lumber`, `miner`, `builder`, `blacksmith`) now read with stronger off-axis body set, deeper cloth pinch cadence, and less mirrored hand timing, while `trader` carry remains distinct as a lighter asymmetric counterpoint.

## Remaining Issues

- Playwright-based verification remains blocked by Chromium launch permissions in this environment, so live runtime close captures (`verify-anim`, `verify-critic`, `verify.mjs --game --logic`) could not be refreshed.

## Next Best Target

Run Playwright-based verify scripts in a Chromium-allowed environment and tune any remaining mirrored heavy-role cadence seen in refreshed close captures against `scripts/screenshots/actors-workpose-close-round-065.png`.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/065-actor-workpose-silhouette-load-asymmetry-pass.md`
