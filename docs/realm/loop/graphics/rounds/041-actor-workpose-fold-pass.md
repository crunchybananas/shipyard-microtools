# 041 - actor-workpose-fold-pass

## Goal

Push actor bitmap motion further past mirrored puppet-like reads by adding a new role-specific fold/asymmetry layer affecting silhouettes, cloth fold stacks, payload sling behavior, and work-hand timing.

## Starting Point

- Previous handoff: `rounds/040-actor-workpose-sway-proof.md`.
- Relevant files: `scripts/build-motion-atlases.mjs`, `loop/graphics/CURRENT.md`, `loop/graphics/BACKLOG.md`.

## Changes

- Added `ROLE_WORKPOSE_FOLD` in `scripts/build-motion-atlases.mjs` with per-role values for:
  - `silhouetteTilt`
  - `foldStack`
  - `payloadSling`
  - `handOffset`
- Wired `ROLE_WORKPOSE_FOLD` into `drawActor(...)` body placement and fold/rhythm calculations to increase role-distinct silhouette lean and hand timing breakup.
- Added an extra deep work-only fold stroke that uses `workposeFoldWarp` to strengthen cloth stack asymmetry in work poses.
- Extended `drawPayload(...)` signature + carry-shape/pulse math to include `workposeFold` so payload drift and width asymmetry diverge more by role.
- Advanced round proof path/label wiring to:
  - `scripts/screenshots/actors-workpose-close-round-041.png`

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

Results:

- `node --check ...` passed.
- `node scripts/build-motion-atlases.mjs` failed at Chromium launch with:
  - `bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`.
- `node scripts/verify-anim.mjs` failed with the same Chromium launch denial.
- `node scripts/verify-critic.mjs` failed with the same Chromium launch denial.
- `node scripts/verify.mjs --game --logic` failed with the same Chromium launch denial.
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` returned no files.
- `rg -n ...` returned no matches.

## Visual Result

Runtime screenshot proof and rebuilt atlas export are still blocked by Chromium permissions in this sandbox, but the canonical actor atlas generator now contains an additional role-driven fold/asymmetry layer that should produce stronger silhouette and carry differentiation when rebuilt.

## Remaining Issues

- Chromium launch denial prevents `build-motion-atlases` and verify screenshot scripts from running, so no new close 2D screenshots were generated this round.
- Role-by-role tuning against fresh `anim-live-actors-close.png` and `critic-zoom-close.png` remains pending.

## Next Best Target

Run `node scripts/build-motion-atlases.mjs`, `node scripts/verify-anim.mjs`, and `node scripts/verify-critic.mjs` in a Chromium-allowed environment, then tune role outliers from fresh close captures and exported `actors-workpose-close-round-041.png`.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/041-actor-workpose-fold-pass.md`
