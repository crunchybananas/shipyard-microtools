# Round 109 - Row Sprite Factory and Miner Work-Up Migration

## Goal

Make one actor action/direction row the reliable production unit, then prove
the pipeline with a clean, direction-locked `miner/work/up` migration.

## Starting Point

- Previous handoff: `rounds/108-miner-side-work-height.md`
- Review target:
  `index.html?spritelab=1&role=miner&action=work&dir=up`
- Relevant source:
  - `assets/sprites/actors/miner.png`
  - `assets/sprites/actor-rows/manifest.json`
  - `assets/sprites/actor-rows/miner/work-up.png`
  - `js/sprite-lab.js`

The accepted up-facing art was already present when this continuation began.
No new image generation was justified: the row passed identity, viewing
direction, within-row dense-body, peer-direction scale/palette, visual, and
runtime checks.

## Changes

- Made the row-based source hierarchy explicit:
  - base role sheets in `assets/sprites/actors/`
  - canonical accepted/candidate rows in `assets/sprites/actor-rows/`
  - SHA-256 locks and provenance in `actor-rows/manifest.json`
  - generated role sheets in `assets/sprites/actors-compiled/`
  - generated runtime atlas in `assets/sprites/actors-atlas.png`
- Confirmed the compiler uses copy semantics when inserting accepted rows, so
  transparent override pixels erase legacy pixels below them.
- Preserved current row states:
  - `miner/work/up`: LOCKED
  - `miner/work/left`: WAIVED
  - `miner/work/right`: WAIVED
  - all other inherited rows: BASE
- Finished the Sprite Lab dense-body diagnostic patch. The clean up-facing row
  now reports body height `72-73` and body delta `1`, rather than treating the
  moving pickaxe as actor-body growth.
- Fixed standalone CANDIDATE loading. A staged `512x84` strip now uses source
  row zero for preview, analysis, alpha view, and download instead of applying
  the role-sheet row offset.
- Fixed responsive asset-list behavior:
  - active-row centering is relative to the scroll container
  - animation no longer rebuilds and snaps the row list every frame

## Acceptance Evidence

`miner/work/up`:

- provenance: `imagegen-direction-locked-peer-scale`
- flicker score: `27.8`
- dense-body height range: `1px`
- median body height: `72px`
- cross-direction body-height delta: `0.5px`
- cross-direction palette delta: `6.4`
- quality warnings: none

The legacy full-silhouette measurement still sees a `9px` height delta and edge
pixels because the pickaxe crosses the top of some frames. That is useful tool
motion evidence, not body-scale drift; Sprite Lab and the row gate now measure
the dense actor body separately.

## Verification

Commands run:

```sh
node --check js/sprite-lab.js
scripts/sprite-row status
scripts/sprite-row verify
node scripts/build-motion-atlases.mjs
node scripts/verify-sprite-source-contract.mjs
node scripts/audit-sprite-frames.mjs
node scripts/audit-walk-gait.mjs
node scripts/verify-anim.mjs
node scripts/verify-critic.mjs
node scripts/verify.mjs --game --logic
node --check js/render.js js/ui.js js/main.js js/input.js js/sprite-lab.js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs
```

All commands passed. The game/logic verifier reported no page errors; console
output contained only the existing GPU `ReadPixels` performance warnings.

Exact ImageMagick comparisons reported `0` differing pixels between:

- `actor-rows/miner/work-up.png`
- the compiled miner row at `y=756`
- the runtime actor-atlas row at `y=6132`

Proofs and refreshed outputs:

- `assets/sprites/actor-rows/proofs/miner-work-up-x4.png`
- `scripts/screenshots/actors-compiled-proof.png`
- `scripts/screenshots/sprite-audit-worst-rows.png`
- `scripts/screenshots/walk-gait-audit-worst-rows.png`
- `screenshots/anim-live-actors.png`
- `screenshots/anim-live-actors-close.png`

Browser findings:

- `miner/work/up` showed LOCKED, warnings `none`, body height `72-73`, and body
  delta `1`, with no false warning treatment.
- `miner/work/left` and `miner/work/right` showed WAIVED.
- inherited `miner/work/down` showed BASE.
- 1280x720, 1024x768, and 390x844 layouts had no horizontal overflow.
- the selected mobile row remained visible and scrollable after the list fix.

## Visual Result

The up-facing miner keeps one stable back-facing identity, costume, body scale,
palette, and ground anchor across the eight-frame pickaxe cycle. Tool reach is
free to cross the body silhouette without making the miner shrink. Sprite Lab
now communicates that distinction instead of flagging a clean body because of
the pickaxe arc.

## Remaining Issues

- `miner/work/left` and `miner/work/right` remain WAIVED mechanical repairs
  with body drift, center-jump, and fragment warnings.
- The broad continuity audit still ranks lumber work up/down and miner side
  work among the clearest work-row repaint targets.
- BASE rows remain inherited and may still contain legacy or placeholder art.

## Next Best Target

Repaint `miner/work/left` through the row factory. It is protected from
accidental overwrite but remains explicit quality debt, and the clean
`miner/work/up` row now provides a trustworthy peer-scale and palette reference.

## Files Changed

- `js/sprite-lab.js`
- `assets/sprites/README.md`
- `assets/sprites/actor-rows/`
- `assets/sprites/actors-compiled/`
- `assets/sprites/actors-atlas.png`
- `assets/sprites/ambient-atlas.png`
- `scripts/screenshots/`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/109-row-sprite-factory-miner-up.md`
