# 076 - source-sheet-actor-ambient-reset

## Goal

Stop trying to improve bad actor and ambient art by repainting one compiled
atlas. Reset the pipeline so each actor role and ambient prop has its own
editable PNG source file, then compile the runtime atlases from those sources.

## Starting Point

- Previous handoff: `rounds/075-fresh-painted-actor-ambient-atlases.md`.
- User feedback: the actor sprite maps were getting worse, the atlas kept
  repeating the same style, and editing one giant atlas made it too hard to
  focus on one character.
- Relevant files:
  - `scripts/build-motion-atlases.mjs`
  - `assets/sprites/actors-atlas.png`
  - `assets/sprites/ambient-atlas.png`
  - `assets/sprites/README.md`

## Changes

- Replaced `scripts/build-motion-atlases.mjs` with an atlas compiler. It now
  validates and stitches source PNGs; it no longer paints actor bodies or
  ambient props procedurally.
- Added reset-only `scripts/bootstrap-sprite-sources.mjs`, which bootstraps
  editable source files from imported CC0 reset material.
- Added 14 editable actor source sheets:
  - `assets/sprites/actors/settler.png`
  - `assets/sprites/actors/farmer.png`
  - `assets/sprites/actors/rancher.png`
  - `assets/sprites/actors/lumber.png`
  - `assets/sprites/actors/miner.png`
  - `assets/sprites/actors/stonecutter.png`
  - `assets/sprites/actors/fisher.png`
  - `assets/sprites/actors/trader.png`
  - `assets/sprites/actors/innkeeper.png`
  - `assets/sprites/actors/builder.png`
  - `assets/sprites/actors/blacksmith.png`
  - `assets/sprites/actors/guard.png`
  - `assets/sprites/actors/scholar.png`
  - `assets/sprites/actors/forager.png`
- Added 4 editable ambient source sprites:
  - `assets/sprites/ambient/cart.png`
  - `assets/sprites/ambient/fishboat.png`
  - `assets/sprites/ambient/sailboat.png`
  - `assets/sprites/ambient/cargo.png`
- Kept the live renderer contracts unchanged:
  - `actors-atlas.png`: `512x18816`, 14 roles, 4 actions, 4 directions, 8 frames.
  - `ambient-atlas.png`: `192x48`, cart, fishboat, sailboat, cargo.
- Added provenance/source docs for imported CC0 material:
  - OpenGameArt "Isometric Painted Game Assets" by laetissima.
  - OpenGameArt "Simple generic ship" by prushik.
  - OpenGameArt "380+ Isometric Crates" by Screaming Brain Studios.
  - OpenGameArt "Pixel village" by pixel32.
- Updated `assets/sprites/README.md`, `assets/sprites/actors/README.md`, and
  `assets/sprites/ambient/README.md` to document the new source-file workflow.

## Verification

Commands run:

```sh
node --check js/render.js js/ui.js js/main.js js/input.js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs scripts/build-motion-atlases.mjs scripts/bootstrap-sprite-sources.mjs
node scripts/bootstrap-sprite-sources.mjs
node scripts/build-motion-atlases.mjs
node scripts/verify-anim.mjs
node scripts/verify-critic.mjs
node scripts/verify.mjs --game --logic
find assets/sprites -maxdepth 1 -name '*.svg' -print
rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" index.html js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs assets/sprites/README.md
```

Screenshots:

- `scripts/screenshots/actor-source-sheets-bootstrap-round-076.png`
- `scripts/screenshots/actors-source-sheets-round-076.png`
- `scripts/screenshots/actors-source-live-close-round-076.png`
- `scripts/screenshots/actors-source-live-close-crop-round-076.png`
- `scripts/screenshots/anim-live-actors.png`
- `scripts/screenshots/anim-live-actors-close.png`
- `scripts/screenshots/critic-zoom-close.png`
- `scripts/screenshots/game-initial.png`

Browser or Playwright findings:

- `node --check ...` passed.
- `node scripts/bootstrap-sprite-sources.mjs` passed.
- `node scripts/build-motion-atlases.mjs` passed.
- `node scripts/verify-anim.mjs` passed: actor atlas remained `512x18816`,
  all sampled animation rows had real per-frame bitmap motion, and page errors
  were none.
- `node scripts/verify-critic.mjs` passed and refreshed critic screenshots.
- `node scripts/verify.mjs --game --logic` passed.
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` produced no output.
- `rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" ...` produced no matches.

## Visual Result

Round 076 removes the bad feedback loop where every actor improvement meant
editing the entire atlas generator. The runtime atlas is now compiled from
separate source images, so the next pass can replace one role or prop without
touching the rest. The live renderer now draws actor sprites bootstrapped from
real CC0 sprite art rather than the rejected procedural puppet atlas.

## Remaining Issues

- The initial actor sheets still derive from one CC0 knight base, so the roles
  are cleaner and source-backed but not yet truly distinct silhouettes.
- Props and payloads exist, but they should be repainted directly inside
  individual role sheets rather than expanded in the bootstrap script.
- Ambient props are now separate source files, but cart and boat style still
  need stronger matching to Realm terrain/building/mountain art.
- Service walkers still use a separate small procedural drawing path.

## Next Best Target

Replace or repaint the first four role source sheets directly:
`farmer.png`, `lumber.png`, `miner.png`, and `guard.png`. Keep the source sheet
contract, run the compiler, and capture a live close crop after each group.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `scripts/bootstrap-sprite-sources.mjs`
- `assets/sprites/README.md`
- `assets/sprites/actors/README.md`
- `assets/sprites/ambient/README.md`
- `assets/sprites/actors/*.png`
- `assets/sprites/actors/_sources/isometric-painted-game-assets/*`
- `assets/sprites/ambient/*.png`
- `assets/sprites/ambient/_sources/simple-generic-ship/*`
- `assets/sprites/ambient/_sources/isometric-crates/*`
- `assets/sprites/ambient/_sources/pixel-village/*`
- `assets/sprites/actors-atlas.png`
- `assets/sprites/ambient-atlas.png`
- `scripts/screenshots/actor-source-sheets-bootstrap-round-076.png`
- `scripts/screenshots/actors-source-sheets-round-076.png`
- `scripts/screenshots/actors-source-live-close-round-076.png`
- `scripts/screenshots/actors-source-live-close-crop-round-076.png`
- `scripts/screenshots/anim-live-actors.png`
- `scripts/screenshots/anim-live-actors-close.png`
- `scripts/screenshots/critic-zoom-close.png`
- `scripts/screenshots/game-initial.png`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/076-source-sheet-actor-ambient-reset.md`
