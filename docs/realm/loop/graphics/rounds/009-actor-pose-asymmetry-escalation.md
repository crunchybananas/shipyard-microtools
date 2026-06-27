# 009 - actor-pose-asymmetry-escalation

## Goal

Push actor motion farther beyond puppet-like timing by increasing role-specific silhouette mass, cloth-fold breakup, and asymmetric gear weighting in the bitmap atlas generator.

## Starting Point

- Previous handoff: `rounds/008-actor-motion-silhouette-breakthrough.md`.
- Screenshots inspected: none (Chromium launch blocked in this sandbox).
- Relevant files: `scripts/build-motion-atlases.mjs`, `loop/graphics/CURRENT.md`, `loop/graphics/BACKLOG.md`.

## Changes

- Increased heavy-role body form spread for `lumber`, `miner`, `builder`, and `blacksmith` (broader shoulder mass, stronger lean/lift, tighter hems).
- Increased heavy-role stance/cant/shoulder-drop offsets to push more role-specific work silhouettes and less mirrored cadence.
- Raised stride, work kick, torso cant, shoulder tilt, and arm swing amplitudes for stronger pose separation during work and carry cycles.
- Added extra dynamic cloth-fold strokes so tunic deformation reads more layered and asymmetric under motion.
- Added asymmetric diagonal straps + side pouches for heavy labor roles (`builder`, `blacksmith`, `lumber`) to break clean puppet symmetry.

## Verification

Commands run:

```sh
node scripts/build-motion-atlases.mjs
node --check js/render.js js/ui.js js/main.js js/input.js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs
node scripts/verify-anim.mjs
node scripts/verify-critic.mjs
node scripts/verify.mjs --game --logic
find assets/sprites -maxdepth 1 -name '*.svg' -print
rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" index.html js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs assets/sprites/README.md
```

Screenshots:

- None this round (Chromium launch blocked before verify capture).

Browser or Playwright findings:

- `node scripts/build-motion-atlases.mjs` fails before export in this sandbox due to Chromium launch denial: `bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`.
- `node --check ...` passed.
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` returned no files.
- `rg -n ...` returned no matches.
- `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` remain blocked by the same Chromium launch denial.

## Visual Result

Round 009 improves the baked motion design intent in the atlas generator: heavy labor roles now carry wider mass/read, stronger off-axis cant, and clearer asymmetric strap/pouch + cloth-fold breakup, which should present as less mirrored and more role-distinct once the atlas is rebuilt and captured in the canonical 2D renderer.

## Remaining Issues

- Chromium launch is blocked in this environment, so actor/ambient atlas rebuild and live 2D screenshot proof are not possible here.
- Close proof shots (`anim-live-actors-close.png`, `critic-zoom-close.png`) still need refresh after a successful rebuild in a Chromium-allowed environment.

## Next Best Target

Run the motion atlas rebuild + verify screenshot suite in a Chromium-allowed environment so round 009's generator changes are baked and visually proven in live 2D captures.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/009-actor-pose-asymmetry-escalation.md`
