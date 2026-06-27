# 001 - painted-wall-continuity

## Goal

Make multi-tile walls read as connected painted fortifications in both
2D and 3D without reviving procedural canvas line-wall art.

## Starting Point

- Previous handoff: `rounds/000-raster-only-baseline.md`.
- Screenshots inspected: `scripts/screenshots/critic-walls-2d.png`,
  `scripts/screenshots/critic-walls-3d.png`, construction variants, and
  the in-app browser live-game view.
- Relevant files: `js/render.js`, `js/webgl3d.js`,
  `scripts/verify-critic.mjs`, `loop/graphics/CURRENT.md`,
  `loop/graphics/BACKLOG.md`.

## Changes

- Added a 2D wall-neighbor path that draws east/south connected wall
  links from the painted support atlas before drawing the center wall
  crop.
- Replaced the live 3D procedural connected-wall strokes/fillRects with
  the same atlas-backed wall-link approach.
- Converted the old inert 2D wall helper bodies to delegate to the
  painted atlas helper instead of preserving wall-specific line art.
- Updated the critic to seed `G.buildingGrid` while placing audit
  buildings, add a connected wall cluster, and capture complete plus
  construction wall screenshots in both render modes.

## Verification

Commands run:

```sh
node --check js/render.js js/webgl3d.js scripts/verify-critic.mjs scripts/verify-anim.mjs scripts/verify.mjs
node scripts/verify-anim.mjs
node scripts/verify-critic.mjs
node scripts/verify.mjs --game --logic
node scripts/verify-logic.mjs
rg -n "\\.svg|svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" index.html js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs assets/sprites/README.md
```

Screenshots:

- `scripts/screenshots/critic-walls-2d.png`
- `scripts/screenshots/critic-walls-3d.png`
- `scripts/screenshots/critic-walls-construction-2d.png`
- `scripts/screenshots/critic-walls-construction-3d.png`
- `scripts/screenshots/anim-live-actors.png`
- `scripts/screenshots/game-initial.png`

Browser or Playwright findings:

- `scripts/verify-critic.mjs` reported 5/5 sprite cache entries ready
  and no page errors.
- `scripts/verify-anim.mjs` reported all sampled actor rows moving
  across 7/7 frame pairs and no page errors.
- `scripts/verify.mjs --game --logic` passed; only the existing
  non-fatal WebGL `ReadPixels` performance warning appeared.
- `scripts/verify-logic.mjs` passed 80/80.
- In-app browser reloaded `http://127.0.0.1:4711/index.html`, started a
  new game, and showed the painted PNG build icons and bitmap citizens.
- Focused grep found no live SVG loader/toggle names; only the retired
  artifact README note and opt-in legacy sandbox path remain.

## Visual Result

At close wall-audit zoom, connected walls now form heavier linked stone
runs instead of isolated single support-atlas cells. The same wall crop
language appears in 2D and 3D, including under partial construction
reveal. This is a first-pass continuity improvement, not a final wall
variant sheet.

## Remaining Issues

- Corners, T-junctions, ends, and crosses still reuse the same wall crop,
  so very close views can read as cloned stone runs.
- Construction still uses the generic overlay/ring language; a later
  construction pass should replace this with painterly scaffolds and
  material piles.
- Actor sprites still need the user-requested push toward more painted,
  less puppet-like bitmap motion.

## Next Best Target

Actor animation art. The user specifically called out animated sprites
as still not reaching the desired painted quality, and the existing
8-frame atlas gives a clear surface for the next measurable graphics
round.

## Files Changed

- `js/render.js`
- `js/webgl3d.js`
- `scripts/verify-critic.mjs`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/001-painted-wall-continuity.md`
