# 069 - actor-workpose-tableau-breakup-pass

## Goal

Push actor bitmap work animation farther past puppet-like mirroring with stronger heavy-role silhouettes, cloth fold pinch, asymmetric payload cant, and role-specific work/carry hand cadence.

## Starting Point

- Previous handoff: `rounds/068-actor-workpose-silhouette-torque-split-pass.md`.
- Screenshots inspected: `scripts/screenshots/actors-workpose-close-round-068.png`.
- Relevant files: `scripts/build-motion-atlases.mjs`.

## Changes

- Advanced close proof export target:
  - `scripts/screenshots/actors-workpose-close-round-069.png`
- Updated proof panel heading text to identify round 069 tableau breakup review.
- Increased `ROLE_WORKPOSE_TABLEAU_RAW` values across roles with stronger heavy-role deltas (`lumber`/`miner`/`builder`/`blacksmith`) to deepen silhouette snap, fold pinch, payload cant, pose set, hand cadence, and asym-lift splits.
- Refreshed close proof rows/directions to emphasize asymmetric role-specific motion:
  - `lumber` work-right, `builder` work-left, `miner` work-left, `blacksmith` work-right, `trader` carry-left, `forager` carry-right.

## Verification

Commands run:

```sh
node --check js/render.js js/ui.js js/main.js js/input.js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs scripts/build-motion-atlases.mjs
node scripts/build-motion-atlases.mjs
node scripts/verify-anim.mjs
node scripts/verify-critic.mjs
node scripts/verify.mjs --game --logic
find assets/sprites -maxdepth 1 -name '*.svg' -print
rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" index.html js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs assets/sprites/README.md
```

Screenshots:

- Intended output path: `scripts/screenshots/actors-workpose-close-round-069.png` (not regenerated in this sandbox due Chromium launch denial).

Browser or Playwright findings:

- `node --check ...` passed.
- `node scripts/build-motion-atlases.mjs`, `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` failed due to Chromium launch denial (`bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`).
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` produced no output.
- `rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" ...` produced no matches.

## Visual Result

Round 069 further deepens 2D bitmap role separation in the generator logic: heavy-role silhouettes now bias harder by direction, cloth-fold pinch timing is more aggressive, and carry mass/hand cadence are more asymmetric per role rather than mirrored.

## Remaining Issues

- Chromium cannot launch in this sandbox, so updated atlas PNGs and close 2D proof screenshots for round 069 could not be regenerated.

## Next Best Target

Run atlas/verify scripts in a Chromium-allowed environment and inspect `actors-workpose-close-round-069.png` plus live close captures for any remaining mirrored cadence between `lumber`, `miner`, `builder`, and `blacksmith`.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/069-actor-workpose-tableau-breakup-pass.md`
