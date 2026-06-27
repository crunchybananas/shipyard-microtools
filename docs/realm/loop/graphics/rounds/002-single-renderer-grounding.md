# 002 - single-renderer-grounding

## Goal

Rally graphics work around one implementation and reduce the floating
look caused by baked sprite shadows that were not visually attached to
the terrain.

## Starting Point

- Previous handoff: `rounds/001-painted-wall-continuity.md`.
- Screenshots inspected: `scripts/screenshots/critic-midday.png`,
  `scripts/screenshots/critic-zoom-close.png`,
  `scripts/screenshots/critic-walls-2d.png`.
- Relevant files: `js/main.js`, `js/input.js`, `js/render.js`,
  `index.html`, `scripts/verify-critic.mjs`, `scripts/_play-probe.mjs`,
  `loop/graphics/CURRENT.md`, `loop/graphics/BACKLOG.md`,
  `loop/graphics/LOOP.md`.

## Changes

- Removed the WebGL/diorama renderer implementation (`js/webgl3d.js`).
- Removed the 3D HUD toggle, startup/init path, input hit-test path,
  minimap resolver switching, and render-loop branch.
- Simplified `scripts/verify-critic.mjs` to audit the canonical 2D
  renderer only.
- Removed dead procedural building draw helpers from `js/render.js` so
  the remaining live building renderer is the painted atlas path.
- Removed retired sprite SVG files, the `svg-test` sandbox, and the
  opt-in legacy SVG branch from `scripts/verify.mjs`.
- Added a 2D raster sprite grounding pass: soft contact shadow, subtle
  dirt bite, and lighter hard-diamond foundation for atlas sprites.
- Updated active graphics-loop docs to make canonical 2D the only
  player-facing graphics implementation.

## Verification

Commands run:

```sh
node --check js/main.js js/input.js js/render.js scripts/verify-critic.mjs scripts/_play-probe.mjs scripts/verify.mjs scripts/verify-anim.mjs
node scripts/verify-critic.mjs
node scripts/verify-anim.mjs
node scripts/verify.mjs --game --logic
node scripts/verify-logic.mjs
rg -n "webgl3d|game3d|btn-3d|toggle3D|screenToTile3D|screenToWorld3D|render3D|buildTerrainMesh|buildBuildingsMesh|gl3d|canvas3d|_3dVisible" index.html js scripts sw.js
find assets/sprites -maxdepth 1 -name '*.svg' -print
rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" index.html js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs assets/sprites/README.md
```

Screenshots:

- `scripts/screenshots/critic-midday.png`
- `scripts/screenshots/critic-zoom-close.png`
- `scripts/screenshots/critic-walls-2d.png`
- `scripts/screenshots/critic-walls-construction-2d.png`
- `scripts/screenshots/anim-live-actors.png`
- `scripts/screenshots/game-initial.png`

Browser or Playwright findings:

- `scripts/verify-critic.mjs` reported 5/5 sprite cache entries ready
  and no page errors.
- `scripts/verify-anim.mjs` reported all sampled actor rows moving
  across 7/7 frame pairs and no page errors.
- `scripts/verify.mjs --game --logic` passed; only the existing
  non-fatal post-processing `ReadPixels` performance warning appeared.
- `scripts/verify-logic.mjs` passed 80/80.
- Focused grep found no live references to the removed 3D runtime.
- Focused SVG cleanup checks found no retired sprite SVG files and no
  live SVG loader/toggle/sandbox references.
- In-app browser loaded `http://127.0.0.1:4711/index.html`, entered the
  game, showed no 3D toggle in the DOM, and reported no warning/error logs.
  Browser screenshot capture timed out, so visual evidence is from the saved
  Playwright screenshots.

## Visual Result

The player-facing game now opens directly into the painted 2D renderer.
Painted building sprites have a low, soft contact shadow/dirt pad at
the footprint, and the older hard diamond below raster sprites is less
opaque. This reduces the "floating above its own shadow" read without
adding a heavy black blob under every structure.

## Remaining Issues

- Some atlas sprites still contain baked shadow shapes that cannot be
  fully corrected from the renderer; future asset passes should clean
  those pixels directly.
- Animated actor art remains the next obvious quality gap: silhouettes
  and limb arcs need to feel more painted and less puppet-like.
- Historical journal entries still mention the old SVG/3D era; those are
  archive records, not live assets or code paths.

## Next Best Target

Actor animation art. The renderer is now single-path, so the next visual
push should improve the bitmap actor atlas itself: stronger silhouettes,
cloth folds, role-specific poses, and close 2D screenshots.

## Files Changed

- `index.html`
- `js/main.js`
- `js/input.js`
- `js/render.js`
- `js/webgl3d.js` removed
- `scripts/verify-critic.mjs`
- `scripts/_play-probe.mjs`
- `scripts/verify.mjs`
- `assets/sprites/*.svg` removed
- `svg-test/index.html` removed
- `loop/MANIFEST.md`
- `loop/graphics/LOOP.md`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/TEMPLATE.md`
- `loop/graphics/rounds/002-single-renderer-grounding.md`
