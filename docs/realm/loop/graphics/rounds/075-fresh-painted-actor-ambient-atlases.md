# 075 - fresh-painted-actor-ambient-atlases

## Goal

Reset actor and ambient sprite maps from scratch so they read as painted PNG atlas art matching the terrain, building, support, and mountain style instead of inherited SVG-era or overfit motion-stack remnants.

## Starting Point

- Previous handoff: `rounds/074-actor-workpose-payload-cant-breakup-pass.md`.
- Screenshots inspected:
  - `scripts/screenshots/actors-fresh-painted-atlas-round-075.png`
  - `scripts/screenshots/anim-live-actors-close.png`
  - `scripts/screenshots/critic-zoom-close.png`
- Relevant files:
  - `scripts/build-motion-atlases.mjs`
  - `assets/sprites/actors-atlas.png`
  - `assets/sprites/ambient-atlas.png`

## Changes

- Replaced the old accumulated actor/ambient atlas generator with a fresh painted generator.
- Preserved the live atlas contracts used by the renderer:
  - `actors-atlas.png`: `512x18816`, 14 roles, 4 actions, 4 directions, 8 frames.
  - `ambient-atlas.png`: `192x48`, cart, fishboat, sailboat, cargo.
- Removed the layered `ROLE_WORKPOSE_*` maps from the generator.
- Rebuilt actors around restrained painted silhouettes, role-colored coats, hats, role props, simple foot contact shadows, and subtle action-specific motion.
- Rebuilt ambient sprites around the same earthy paint language as tiles, buildings, and mountains.
- Added a fresh proof sheet:
  - `scripts/screenshots/actors-fresh-painted-atlas-round-075.png`
- Updated handoff docs to stop future graphics rounds from continuing the old workpose escalation path.

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

- `scripts/screenshots/actors-fresh-painted-atlas-round-075.png`
- `scripts/screenshots/anim-live-actors.png`
- `scripts/screenshots/anim-live-actors-close.png`
- `scripts/screenshots/critic-zoom-close.png`
- `scripts/screenshots/game-initial.png`

Browser or Playwright findings:

- `node --check ...` passed.
- `node scripts/build-motion-atlases.mjs` passed.
- `node scripts/verify-anim.mjs` passed: actor atlas remained `512x18816`, all sampled animation rows had real per-frame bitmap motion, and page errors were none.
- `node scripts/verify-critic.mjs` passed and refreshed critic screenshots.
- `node scripts/verify.mjs --game --logic` passed.
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` produced no output.
- `rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" ...` produced no matches.

## Visual Result

Round 075 establishes a calmer, fresher sprite baseline in the canonical 2D renderer: actors now read as small painted figures with grounded feet, role props, and quiet motion, while carts and boats use the same textured, earthy paint handling as the surrounding atlas art.

## Remaining Issues

- The proof sheet reads cleaner, but live settlement screenshots should drive the next pass for actor scale, foot contact, prop clarity, and ambient contrast.
- Service walkers in `js/render.js` still use a small procedural drawing path and should be considered separately from the refreshed actor/ambient atlases.

## Next Best Target

Run a live read pass on the fresh atlas baseline and tune only concrete screenshot issues: actor scale, contact shadows, role prop clarity, and ambient prop contrast on water/roads.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `assets/sprites/actors-atlas.png`
- `assets/sprites/ambient-atlas.png`
- `scripts/screenshots/actors-fresh-painted-atlas-round-075.png`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/075-fresh-painted-actor-ambient-atlases.md`
