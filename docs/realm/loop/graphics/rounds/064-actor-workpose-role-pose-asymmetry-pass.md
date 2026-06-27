# 064 - actor-workpose-role-pose-asymmetry-pass

## Goal

Push actor bitmap work/carry motion farther beyond puppet-like cadence by strengthening role silhouettes, cloth folds, asymmetric payloads, and role-specific work-pose rhythm in close 2D proof frames.

## Starting Point

- Previous handoff: `rounds/063-actor-workpose-role-asymmetry-breakup-pass.md`.
- Screenshots inspected: `scripts/screenshots/actors-workpose-close-round-063.png`.
- Relevant files: `scripts/build-motion-atlases.mjs`.

## Changes

- Advanced close proof export target:
  - `scripts/screenshots/actors-workpose-close-round-064.png`
- Updated proof panel heading text to identify round 064 close review.
- Increased `ROLE_WORKPOSE_TABLEAU` role values (silhouetteSnap/foldPinch/payloadCant/poseSet/handCadence/asymLift) with stronger heavy-role asymmetry and wider left/right role split.
- Updated close proof rows to emphasize role-specific labor poses and asymmetric carry (`settler work down`, `lumber work right`, `miner work left`, `builder work right`, `trader carry right`, `blacksmith carry left`).

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

- `scripts/screenshots/actors-workpose-close-round-064.png`

Browser or Playwright findings:

- `node --check ...` passed.
- `node scripts/build-motion-atlases.mjs` passed and wrote:
  - `assets/sprites/actors-atlas.png`
  - `assets/sprites/ambient-atlas.png`
  - `scripts/screenshots/actors-workpose-close-round-064.png`
- `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` failed due to Chromium launch denial in this sandbox (`bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`).
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` produced no output.
- `rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" ...` produced no matches.

## Visual Result

Round 064 deepens role separation in close 2D bitmap playback: heavy labor roles read with broader off-axis silhouettes, sharper cloth-fold compression, and stronger asymmetric carry/work cadence than the round-063 baseline.

## Remaining Issues

- Live verify scripts are still blocked in this environment by Chromium launch permissions, so runtime `verify-anim`, `verify-critic`, and full `verify.mjs --game --logic` screenshots cannot be refreshed.

## Next Best Target

Run the three Playwright-based verify scripts in a Chromium-allowed environment, then tune remaining mirrored cadence outliers against `scripts/screenshots/actors-workpose-close-round-064.png`.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/064-actor-workpose-role-pose-asymmetry-pass.md`
