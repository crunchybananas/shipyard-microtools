# 012 - actor-workpose-gait-drag-pass

## Goal

Push actor bitmap motion farther past puppet-like cadence by adding role-specific gait phase offsets and load drag so torso, arms, cloth, and carry payloads desynchronize into heavier, asymmetrical work silhouettes.

## Starting Point

- Previous handoff: `rounds/011-actor-workpose-torque-pass.md`.
- Screenshots inspected: existing close proofs only (`scripts/screenshots/anim-live-actors-close.png`, `scripts/screenshots/critic-zoom-close.png`), not refreshed this round.
- Relevant files: `scripts/build-motion-atlases.mjs`, `assets/sprites/actors-atlas.png`, `assets/sprites/ambient-atlas.png`, `loop/graphics/CURRENT.md`, `loop/graphics/BACKLOG.md`.

## Changes

- Added a new `ROLE_GAIT` profile map in `scripts/build-motion-atlases.mjs` with per-role `phase`, `drag`, and `lurch` controls.
- Wired gait phase into work torso lean, bend swing, torso cant, shoulder hitch, hem torque, and arm swing so labor roles move off synchronized sine timing.
- Extended carry payload drawing to consume `motion` + `gait` so bag/crate sway, drag, and offset respond to role-specific mass and asymmetry.
- Rebuilt atlases with `node scripts/build-motion-atlases.mjs`; refreshed `assets/sprites/actors-atlas.png` and `assets/sprites/ambient-atlas.png`.
- Kept all work inside canonical bitmap atlas generation; no SVG path/fallback/runtime toggle was reintroduced.

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

- None refreshed this round (Chromium launch blocked before capture).

Browser or Playwright findings:

- `node --check ...` and `node --check scripts/build-motion-atlases.mjs` passed.
- `node scripts/build-motion-atlases.mjs` passed and wrote updated actor/ambient atlases.
- `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` all failed at Chromium launch with the same sandbox denial: `bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`.
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` returned no files.
- `rg -n ...` returned no matches (exit code `1`).

## Visual Result

Round 012 introduces role-specific timing separation on top of prior work-pose asymmetry: heavy labor roles now pull cloth and payloads with later, draggier follow-through while lighter roles stay tighter. The intended live read is less mirrored arm/torso cadence and chunkier asymmetric carry silhouettes in close 2D motion.

## Remaining Issues

- Chromium launch remains blocked in this sandbox, preventing fresh live close screenshots.
- `scripts/screenshots/anim-live-actors-close.png` and `scripts/screenshots/critic-zoom-close.png` still need refresh in an environment where Playwright Chromium can launch.

## Next Best Target

Run `verify-anim`, `verify-critic`, and `verify.mjs --game --logic` in a Chromium-allowed environment to capture fresh close proofs for rounds 009-012, then tune any remaining mirrored roles visible in those shots.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `assets/sprites/actors-atlas.png`
- `assets/sprites/ambient-atlas.png`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/012-actor-workpose-gait-drag-pass.md`
