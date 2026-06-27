# 067 - actor-workpose-pose-asymmetry-split-pass

## Goal

Push actor bitmap work/carry animation farther from puppet-like mirroring by increasing role-specific silhouette asymmetry, cloth fold pinch cadence, and heavy-role payload split in close 2D proof frames.

## Starting Point

- Previous handoff: `rounds/066-actor-workpose-fold-cadence-split-pass.md`.
- Screenshots inspected: `scripts/screenshots/actors-workpose-close-round-066.png`.
- Relevant files: `scripts/build-motion-atlases.mjs`.

## Changes

- Advanced close proof export target:
  - `scripts/screenshots/actors-workpose-close-round-067.png`
- Updated proof panel heading text to identify round 067 close review.
- Increased `ROLE_WORKPOSE_TABLEAU_RAW` values across roles, with stronger heavy-role (`lumber`/`miner`/`builder`/`blacksmith`) boosts for `silhouetteSnap`, `foldPinch`, `payloadCant`, `poseSet`, `handCadence`, and `asymLift`.
- Refreshed close proof rows/directions to highlight work/carry asymmetry split:
  - `lumber` work-right, `miner` work-left, `builder` carry-right, `blacksmith` carry-left, `trader` work-right.

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

- `scripts/screenshots/actors-workpose-close-round-067.png`

Browser or Playwright findings:

- `node --check ...` passed.
- `node scripts/build-motion-atlases.mjs` passed and wrote:
  - `assets/sprites/actors-atlas.png`
  - `assets/sprites/ambient-atlas.png`
  - `scripts/screenshots/actors-workpose-close-round-067.png`
- `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` failed due to Chromium launch denial in this sandbox (`bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`).
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` produced no output.
- `rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" ...` produced no matches.

## Visual Result

Round 067 deepens close 2D role separation in bitmap motion: heavy labor silhouettes now pull farther off center during work/carry phases, cloth fold pinches read with clearer cadence offsets, and asymmetric payload orientation is easier to distinguish between mirrored-facing role pairs.

## Remaining Issues

- Playwright-based runtime verification remains blocked by Chromium launch permissions in this environment, so live `verify-anim`/`verify-critic`/`verify.mjs --game --logic` screenshots could not be refreshed.

## Next Best Target

Run Playwright-based verify scripts in a Chromium-allowed environment, then compare refreshed close captures against `scripts/screenshots/actors-workpose-close-round-067.png` and tune any remaining mirrored heavy-role cadence outliers in `ROLE_WORKPOSE_TABLEAU`.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/067-actor-workpose-pose-asymmetry-split-pass.md`
