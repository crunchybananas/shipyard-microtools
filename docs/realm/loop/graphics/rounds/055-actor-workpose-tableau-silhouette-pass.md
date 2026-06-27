# 055 - actor-workpose-tableau-silhouette-pass

## Goal

Push actor bitmap work/carry motion further from puppet-like cadence with stronger role-specific silhouette snap, cloth fold pinch, and asymmetric payload cant in the tableau layer.

## Starting Point

- Previous handoff: `rounds/054-actor-workpose-tableau-cadence-pass.md`.
- Screenshots inspected: `scripts/screenshots/actors-workpose-close-round-054.png` (prior round reference only).
- Relevant files: `scripts/build-motion-atlases.mjs`.

## Changes

- Advanced close proof export target:
  - `scripts/screenshots/actors-workpose-close-round-055.png`
- Updated close proof panel text to round 055.
- Increased `ROLE_WORKPOSE_TABLEAU` values across roles to further amplify:
  - role-separated silhouette snap,
  - cloth fold pinch breakup,
  - asymmetric payload cant,
  - role-specific work pose-set cadence.
- Kept existing close proof role focus for readable heavy-work asymmetry comparisons:
  - `lumber`, `miner`, `builder`, `blacksmith`, `trader`, `forager`.

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

- No new screenshot generated in this sandbox run because Chromium launch remains denied.
- Most recent close proof reference remains `scripts/screenshots/actors-workpose-close-round-054.png`.

Browser or Playwright findings:

- `node --check ...` passed.
- `node scripts/build-motion-atlases.mjs` failed on Chromium launch with:
  - `bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`.
- `node scripts/verify-anim.mjs` failed with the same Chromium launch denial.
- `node scripts/verify-critic.mjs` failed with the same Chromium launch denial.
- `node scripts/verify.mjs --game --logic` failed with the same Chromium launch denial.
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` produced no output.
- `rg -n ...` produced no matches.

## Visual Result

Round 055 deepens tableau-driven role separation in the canonical 2D actor atlas generator path so work/carry silhouettes, cloth folds, and payload asymmetry should read more strongly once atlas generation runs in a Chromium-allowed environment.

## Remaining Issues

- Chromium launch is still blocked for Playwright-dependent atlas and screenshot verification in this environment.
- Round-055 close 2D proof image generation remains pending until Chromium can launch.

## Next Best Target

Run `node scripts/build-motion-atlases.mjs`, `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` in a Chromium-allowed environment to generate round-055 close proofs and confirm the new tableau asymmetry in live 2D screenshots.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `loop/graphics/rounds/055-actor-workpose-tableau-silhouette-pass.md`
