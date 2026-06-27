# 010 - actor-workpose-silhouette-overdrive

## Goal

Push actor animation art farther past puppet-like cadence by amplifying role-specific work bends, shoulder silhouette bulk, cloth-fold split motion, and asymmetric labor payload accents in the bitmap atlas generator.

## Starting Point

- Previous handoff: `rounds/009-actor-pose-asymmetry-escalation.md`.
- Screenshots inspected: none this round (Chromium launch blocked in sandbox).
- Relevant files: `scripts/build-motion-atlases.mjs`, `loop/graphics/CURRENT.md`, `loop/graphics/BACKLOG.md`.

## Changes

- Added `ROLE_MOTION` tuning map to encode per-role shoulder bulk, hem split, asymmetric pack weight, and work-bend intensity.
- Increased work pose breakup by injecting role-biased bend swing into torso center motion during work cycles.
- Added extra shoulder mass read with painterly silhouette ellipses that shift with profile/pose direction.
- Added additional cloth-fold split lines that follow carry-bias and hem-wave deformation for stronger non-mirrored tunic motion.
- Deepened asymmetric strap payload accents for heavy labor roles (`builder`, `blacksmith`, `lumber`) with an extra bias-weighted pouch form.

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

- None this round (Chromium launch blocked before capture).

Browser or Playwright findings:

- `node scripts/build-motion-atlases.mjs` failed before export with Chromium launch denial: `bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`.
- `node --check js/render.js js/ui.js js/main.js js/input.js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs` passed.
- `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` failed at Chromium launch with the same MachPort permission denial.
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` returned no files.
- `rg -n ...` returned no matches.

## Visual Result

Round 010 strengthens the intended baked motion language in the atlas generator: labor roles now carry heavier shoulder reads, stronger off-axis work bends, deeper cloth split deformation, and more asymmetric strap/pouch silhouettes, which should read less mirrored and more role-distinct once atlas rebuild and live 2D capture are unblocked.

## Remaining Issues

- Chromium launch remains blocked in this environment, preventing atlas rebuild and fresh close proof screenshots.
- `anim-live-actors-close.png` and `critic-zoom-close.png` still need refresh in a Chromium-allowed run to validate the new bitmap motion pass in live 2D.

## Next Best Target

Run atlas rebuild and screenshot verifiers in a Chromium-allowed environment so rounds 009-010 actor motion changes can be baked and visually proven with close 2D evidence.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/010-actor-workpose-silhouette-overdrive.md`
