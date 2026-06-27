# 077 - actor-scale-ambient-prop-read-pass

## Goal

Tune concrete read issues from the fresh actor/ambient source baseline: actor
scale, foot contact, ambient prop clarity, and cart/boat/cargo contrast.

## Starting Point

- Previous handoff: `rounds/076-source-sheet-actor-ambient-reset.md`.
- Screenshots inspected:
  - `scripts/screenshots/actors-source-live-close-crop-round-076.png`
  - `scripts/screenshots/anim-live-actors-close.png`
  - `scripts/screenshots/critic-zoom-close.png`
  - `scripts/screenshots/actors-source-sheets-round-076.png`
- Relevant files:
  - `js/render.js`
  - `scripts/build-motion-atlases.mjs`
  - `assets/sprites/ambient/*.png`
  - `assets/sprites/actors-atlas.png`
  - `assets/sprites/ambient-atlas.png`

## Changes

- Reduced live actor sprite draw size from `30x39` to `27x35` in
  `drawCitizenSpriteIfReady(...)`.
- Shifted the actor draw anchor from `cy + 4 - targetH` to
  `cy + 3 - targetH` so the boot/contact area sits closer to the ground
  shadow after the scale reduction.
- Softened the live citizen shadow stack when the actor atlas is available,
  because the source sheets already contain painted contact shadows.
- Repainted the four ambient source sprites directly:
  - `assets/sprites/ambient/cart.png`
  - `assets/sprites/ambient/fishboat.png`
  - `assets/sprites/ambient/sailboat.png`
  - `assets/sprites/ambient/cargo.png`
- Replaced the Chromium-backed actor/ambient compiler with an ImageMagick-backed
  stitcher that validates source PNG dimensions, appends actor sheets, appends
  ambient props, and writes a source proof.
- Rebuilt runtime atlases and proof:
  - `assets/sprites/actors-atlas.png`
  - `assets/sprites/ambient-atlas.png`
  - `scripts/screenshots/actors-source-sheets-round-077.png`
- Updated `assets/sprites/README.md` to document that the compiler uses
  ImageMagick and does not repaint source art.
- Updated `loop/graphics/AUTOMATION_HANDOFF.md` to remove the stale `rounds/003`
  next-target text.

## Verification

Commands run:

```sh
node --check js/render.js js/ui.js js/main.js js/input.js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs scripts/build-motion-atlases.mjs scripts/bootstrap-sprite-sources.mjs
node scripts/build-motion-atlases.mjs
node scripts/verify-anim.mjs
node scripts/verify-critic.mjs
node scripts/verify.mjs --game --logic
node scripts/verify-logic.mjs
find assets/sprites -maxdepth 1 -name '*.svg' -print
rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" index.html js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs assets/sprites/README.md
magick identify -format '%f %wx%h %[channels]\n' assets/sprites/actors-atlas.png assets/sprites/ambient-atlas.png assets/sprites/ambient/*.png scripts/screenshots/actors-source-sheets-round-077.png
```

Screenshots:

- `scripts/screenshots/actors-source-sheets-round-077.png`
- Existing live shots inspected:
  - `scripts/screenshots/actors-source-live-close-crop-round-076.png`
  - `scripts/screenshots/critic-zoom-close.png`

Browser or Playwright findings:

- `node --check ...` passed.
- `node scripts/build-motion-atlases.mjs` passed.
- ImageMagick dimension audit passed:
  - `actors-atlas.png`: `512x18816`
  - `ambient-atlas.png`: `192x48`
  - ambient source props: `48x48`
  - proof image: `900x690`
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` produced no output.
- SVG-runtime grep invariant produced no matches.
- The custom live capture attempt, `verify-anim`, `verify-critic`,
  `verify.mjs --game --logic`, and `verify-logic` all failed before game load
  because Chromium cannot check in its Mach rendezvous port in this sandbox:
  `Permission denied (1100)`.

## Visual Result

Actor sprites should read slightly less oversized in the canonical 2D renderer:
the live draw target is smaller, and the ground shadow no longer competes as
strongly with the actor sheet's own contact shadow. The ambient strip has a
clearer cart canopy, brighter boat sails/hulls, stronger cargo highlights, and
painted shadows/highlight strokes that should survive small moving-prop scale.

## Remaining Issues

- The scale/contact changes still need browser-backed live screenshots once
  Chromium can launch in this environment or another permitted environment.
- The first actor source sheets still derive from one knight base, so role
  silhouettes remain insufficiently distinct.
- Service walkers still use the separate small procedural path.

## Next Best Target

Run a permitted live readback for round 077 and tune only confirmed screenshot
issues around actor scale/contact and ambient prop contrast. This should happen
before another actor-source repaint round so the scale baseline is trusted.

## Files Changed

- `js/render.js`
- `scripts/build-motion-atlases.mjs`
- `assets/sprites/README.md`
- `assets/sprites/ambient/cart.png`
- `assets/sprites/ambient/fishboat.png`
- `assets/sprites/ambient/sailboat.png`
- `assets/sprites/ambient/cargo.png`
- `assets/sprites/actors-atlas.png`
- `assets/sprites/ambient-atlas.png`
- `scripts/screenshots/actors-source-sheets-round-077.png`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/AUTOMATION_HANDOFF.md`
- `loop/graphics/rounds/077-actor-scale-ambient-prop-read-pass.md`
