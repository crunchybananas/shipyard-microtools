# 063 - actor-workpose-role-asymmetry-breakup-pass

## Goal

Push actor bitmap work/carry motion farther from puppet-like sync by strengthening role silhouettes, cloth fold depth, asymmetric payload cant, and role-specific hand cadence in close 2D proof frames.

## Starting Point

- Previous handoff: `rounds/062-actor-workpose-asymmetric-tableau-depth-pass.md`.
- Screenshots inspected: `scripts/screenshots/actors-workpose-close-round-062.png`.
- Relevant files: `scripts/build-motion-atlases.mjs`.

## Changes

- Advanced close proof export target:
  - `scripts/screenshots/actors-workpose-close-round-063.png`
- Updated proof panel heading text to identify round 063 close review.
- Increased `ROLE_WORKPOSE_TABLEAU` role values for silhouette snap, fold pinch, payload cant, pose set, hand cadence, and asymmetric lift.
- Updated close proof rows to emphasize role-specific work/carry asymmetry (`settler work down`, `miner work left`, `blacksmith carry left`).

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

- `scripts/screenshots/actors-workpose-close-round-063.png`

Browser or Playwright findings:

- `node --check ...` passed.
- `node scripts/build-motion-atlases.mjs` passed and wrote:
  - `assets/sprites/actors-atlas.png`
  - `assets/sprites/ambient-atlas.png`
  - `scripts/screenshots/actors-workpose-close-round-063.png`
- `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` failed due to Chromium launch denial in this sandbox (`bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`).
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` produced no output.
- `rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" ...` produced no matches.

## Visual Result

Round 063 further separates role motion in close 2D bitmap playback: heavy roles show broader off-axis silhouette snaps, deeper cloth fold slashes, stronger carry-side payload cant, and less mirrored left/right work-hand cadence in the round-063 proof strip.

## Remaining Issues

- Live verify scripts remain blocked in this environment by Chromium launch permissions, so runtime `verify-anim`, `verify-critic`, and full `verify.mjs --game --logic` captures still cannot be refreshed.

## Next Best Target

Run the three Playwright-based verify scripts in a Chromium-allowed environment, then tune any remaining mirrored cadence outliers against `scripts/screenshots/actors-workpose-close-round-063.png`.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/063-actor-workpose-role-asymmetry-breakup-pass.md`
