# 078 - imagegen-lumber-work-left-prototype

## Goal

Prototype a Ralph-style imagegen improvement loop on one actor animation row:
generate candidate frames, compare them against the current source row, select
the best candidate, rebuild the atlas, and document what worked.

## Starting Point

- Previous handoff: `rounds/077-actor-scale-ambient-prop-read-pass.md`.
- Target row: `assets/sprites/actors/lumber.png`, `work / left`, row index
  `10`, crop `512x84+0+840`.
- Existing target frames: the true `lumber/work/left` row was transparent.
- Reference inspected first:
  - `scripts/screenshots/round-078-lumber-work-left-existing.png`
    accidentally captured row `6` (`walk / left`) before the row-indexing
    mistake was caught and corrected.
- Relevant files:
  - `assets/sprites/actors/lumber.png`
  - `assets/sprites/actors-atlas.png`
  - `scripts/build-motion-atlases.mjs`

## Changes

- Used the built-in imagegen skill path to generate three candidate
  left-facing lumber work/chop strips.
- Selected candidate C because it had the clearest stocky woodsman silhouette,
  visible axe, and eight-pose chop cadence.
- Added a second imagegen pass for the lumber walking rows after preview
  showed that deriving walk from chop frames produced chopping animations. The
  accepted walk sheet uses four walking-only rows with a carried axe:
  `down`, `up`, `left`, and `right`.
- Fixed the generated `walk / down` row after preview showed the axe changing
  hands in frames 6 and 7; those frames now reuse adjacent same-side carry
  poses so the axe stays on the same side through the down-facing loop.
- Filled the lumber `carry` rows by reusing the completed walking rows. The
  live renderer switches from `walk` to `carry` while returning with wood; the
  empty carry rows made the body disappear while the carried-resource marker
  still drew, producing floating wood.
- Copied the selected generation into the workspace under
  `tmp/realm-graphics-round-078/`, chroma-keyed the green background with
  ImageMagick, split the poses into eight crops, and composed them into an
  exact `512x84` transparent row.
- Restored the accidentally touched `walk / left` row from the saved pre-edit
  crop, then inserted the selected candidate into the correct `work / left`
  row at `y = 840`.
- After browser preview, normalized frames 2, 4, and 5 because their original
  foreground bounds were visibly smaller than neighboring poses and made the
  animation pop. A later preview rejected the enlarged frame 2 because it made
  the wind-up pose blurry, so frame 2 was replaced with a crisp anticipation
  pose derived from frame 1. The adjusted frame bounds are now:
  - frame 2: `58x72`
  - frame 4: `62x72`
  - frame 5: `62x72`
- Advanced the atlas source proof output in `scripts/build-motion-atlases.mjs`
  from `actors-source-sheets-round-077.png` to
  `actors-source-sheets-round-078.png`.
- Rebuilt runtime atlases:
  - `assets/sprites/actors-atlas.png`
  - `assets/sprites/ambient-atlas.png`
- Wrote proof images:
  - `scripts/screenshots/round-078-lumber-work-left-proof.png`
  - `scripts/screenshots/round-078-lumber-work-left-selected-source.png`
  - `scripts/screenshots/round-078-lumber-work-left-selected-source-x4.png`
  - `scripts/screenshots/actors-source-sheets-round-078.png`

## Verification

Commands run:

```sh
node --check scripts/build-motion-atlases.mjs
node scripts/build-motion-atlases.mjs
node --check js/render.js js/ui.js js/main.js js/input.js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs scripts/build-motion-atlases.mjs scripts/bootstrap-sprite-sources.mjs
magick identify -format '%f %wx%h %[channels]\n' assets/sprites/actors/lumber.png assets/sprites/actors-atlas.png assets/sprites/ambient-atlas.png scripts/screenshots/actors-source-sheets-round-078.png scripts/screenshots/round-078-lumber-work-left-proof.png scripts/screenshots/round-078-lumber-work-left-selected-source.png
find assets/sprites -maxdepth 1 -name '*.svg' -print
rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" index.html js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs assets/sprites/README.md
node scripts/verify-anim.mjs
node scripts/verify-critic.mjs
node scripts/verify.mjs --game --logic
```

Screenshots:

- `scripts/screenshots/round-078-lumber-work-left-proof.png`
- `scripts/screenshots/actors-source-sheets-round-078.png`
- `scripts/screenshots/anim-live-actors.png`
- `scripts/screenshots/anim-live-actors-close.png`
- `scripts/screenshots/critic-zoom-close.png`
- `scripts/screenshots/game-initial.png`

Browser or Playwright findings:

- `node scripts/verify-anim.mjs` passed, with no page errors, actor atlas
  `512x18816`, and live actor screenshots refreshed.
- `node scripts/verify-critic.mjs` passed and refreshed critic screenshots,
  with no page errors.
- `node scripts/verify.mjs --game --logic` passed; only repeated GPU
  `ReadPixels` performance warnings appeared in the console.
- SVG-path invariants passed: no top-level sprite SVGs and no retired SVG
  runtime references.
- In-app browser preview:
  - `http://127.0.0.1:4711/tmp/realm-graphics-round-078/lumber-work-left-preview.html`

## Visual Result

The true `lumber/work/left` row is no longer blank. It now shows a left-facing
woodsman with a stocky brown silhouette, hood, beard, and axe swing sequence.
The row is more detailed and less source-native than the knight-derived rows,
but it proves the loop: generated candidate, local cleanup, fixed-cell
composition, source-sheet replacement, atlas rebuild, and live verification.

## Remaining Issues

- Candidate C still has slight chroma-key edge artifacts at 4x proof scale.
  They are minor at atlas scale but worth improving before rolling this method
  across more rows.
- The candidate's rendering style is richer and warmer than the reset actor
  sheets, so a future pass should either tune prompts closer to the current
  atlas or repaint adjacent lumber rows to make the role coherent.
- The first two imagegen attempts were too concept-art-like; the successful
  prompt had to emphasize tiny fixed-cell sprite-strip constraints.

## Next Best Target

Use the same one-row loop on `lumber/work/right` or another blank/weak work row,
but add a stricter style-matching cleanup step so generated rows integrate more
quietly with the existing actor sheet.

## Files Changed

- `assets/sprites/actors/lumber.png`
- `assets/sprites/actors-atlas.png`
- `assets/sprites/ambient-atlas.png`
- `scripts/build-motion-atlases.mjs`
- `scripts/screenshots/actors-source-sheets-round-078.png`
- `scripts/screenshots/round-078-lumber-work-left-proof.png`
- `scripts/screenshots/round-078-lumber-work-left-selected-source.png`
- `scripts/screenshots/round-078-lumber-work-left-selected-source-x4.png`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/078-imagegen-lumber-work-left-prototype.md`
