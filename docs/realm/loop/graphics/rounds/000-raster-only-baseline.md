# 000 - raster-only-baseline

## Goal

Remove live SVG/procedural line-art fallbacks and make the live game
render from painted bitmap atlases.

## Starting Point

- Building sprites looked like a port of the old SVG/vector direction
  because the renderer still had live SVG loading and fallback paths.
- Title/build-bar UI still referenced individual SVG building files.
- Walls still took a procedural connected-wall branch before the painted
  atlas path could draw them.
- The animation verifier still tested retired SVG sandbox animation.

## Changes

- Removed the live SVG loader, palette replacement cache, sprite mode
  toggle, and SVG fallback branch from `js/render.js`.
- Switched the title icon and build bar icons to PNG atlas background
  crops in `index.html` and `js/ui.js`.
- Routed walls through the painted support atlas and adjusted wall/road
  presentation in `js/render.js` and `js/webgl3d.js`.
- Retired SVG sandbox from the default verification path in
  `scripts/verify.mjs`.
- Replaced `scripts/verify-anim.mjs` with a raster actor-atlas motion
  verifier.
- Expanded `scripts/verify-critic.mjs` to stage every buildable painted
  sprite and capture 2D plus 3D audit screenshots.

## Verification

Commands run:

```sh
node --check js/render.js js/ui.js js/state.js js/story.js js/webgl3d.js scripts/build-motion-atlases.mjs scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs
node scripts/verify-logic.mjs
node scripts/verify-anim.mjs
node scripts/verify-critic.mjs
node scripts/verify.mjs --game --logic
```

Screenshots:

- `scripts/screenshots/critic-midday.png`
- `scripts/screenshots/critic-3d.png`
- `scripts/screenshots/anim-live-actors.png`
- `scripts/screenshots/painted-live-smoke.png`

Browser or Playwright findings:

- No page errors in critic or animation verification.
- Focused probe found zero live `.svg` DOM/style references.
- All five atlas loaders reported ready: buildings, support, actors,
  nature, terrain.
- Actor atlas reports 8 frames and bitmap row-diff checks pass.
- In-app browser rendered new game with PNG build-bar icons and animated
  bitmap citizens; no console errors.

## Visual Result

The game now presents painted atlas art as the live visual language. The
UI no longer advertises individual SVG files, the renderer no longer
falls back to line-art sprites, and the verification suite is pointed at
the current raster art path.

## Remaining Issues

- Wall continuity is only a repeated painted wall cell. It needs
  dedicated painted connection states.
- Upgrade states still rely heavily on overlays instead of physical
  painted building changes.
- Construction could feel more like staged painted work rather than an
  effect laid over finished art.
- Actor animation is technically improved but can still become more
  painterly and less puppet-clean.

## Next Best Target

Painted wall continuity. It is the clearest remaining place where the
old procedural/game-grid thinking shows through, and it affects both
defense gameplay readability and settlement composition.

## Files Changed

- `assets/sprites/README.md`
- `assets/sprites/actors-atlas.png`
- `index.html`
- `js/render.js`
- `js/state.js`
- `js/story.js`
- `js/ui.js`
- `js/webgl3d.js`
- `scripts/build-motion-atlases.mjs`
- `scripts/verify-anim.mjs`
- `scripts/verify-critic.mjs`
- `scripts/verify.mjs`
