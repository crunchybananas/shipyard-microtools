# Round 110 - Live Actor Muster

## Goal

Connect the complete actor sprite-map contract to the production game canvas
and prove every runtime row and frame, not a small sample.

## Starting Point

- Previous handoff: `rounds/109-row-sprite-factory-miner-up.md`
- Existing runtime proof: `scripts/verify-anim.mjs` sampled only three rows.
- Existing renderer risk:
  - actor geometry and role lists were duplicated inside `js/render.js`
  - the dedicated `forager` sheet was never selected by live citizens
  - Sprite Lab proved source rows, but there was no exhaustive real-canvas
    presentation of the compiled runtime atlas

## Changes

- Replaced the renderer's hand-maintained actor constants with imports from
  `scripts/sprite-source-contract.mjs`.
- Added shared production functions in `js/render.js`:
  - `actorAtlasRowIndex(...)`
  - `actorAtlasFrameRect(...)`
  - `drawActorAtlasFrame(...)`
- Routed normal citizen rendering through the same shared frame-draw function.
- Fixed live role resolution so citizens in the `foraging` state select the
  `forager` sheet.
- Added Actor Muster:
  - title-screen **Actor Muster** entry
  - Sprite Lab **Live Canvas** entry
  - direct `index.html?spritemuster=1` entry
  - animated role/action/direction formations on the actual `#game` canvas
  - BASE, LOCKED, WAIVED, and CANDIDATE source-state color cues
  - keyboard/button paging and pause/play controls
  - direct handoff from the visible muster into Sprite Lab
  - desktop, tablet, and mobile page planning
- Added `scripts/verify-all-sprite-maps.mjs`, which verifies:
  - all runtime atlas dimensions and addresses
  - every role/action/direction row
  - all eight frames per row
  - no blank frames
  - motion variety for walk/work/carry rows
  - all fourteen live role mappings
  - all four live action mappings
  - all four live direction mappings
  - complete real-canvas Actor Muster coverage

## Verification

Commands run:

```sh
node --check js/render.js js/ui.js js/main.js js/input.js js/economy.js js/sprite-lab.js js/sprite-muster.js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs scripts/verify-all-sprite-maps.mjs
scripts/sprite-row verify
node scripts/build-motion-atlases.mjs
node scripts/verify-sprite-source-contract.mjs
node scripts/audit-sprite-frames.mjs
node scripts/audit-walk-gait.mjs
node scripts/verify-all-sprite-maps.mjs
node scripts/verify-anim.mjs
node scripts/verify-critic.mjs
node scripts/verify.mjs --game --logic
```

All commands passed.

Exhaustive runtime results:

- actor rows: `224/224`
- actor frames: `1,792/1,792`
- blank rows/frames: `0`
- low-variety moving rows: `0`
- atlas-address mismatches: `0`
- live mapping failures: `0`
- real-canvas rows drawn: `224/224`
- desktop muster pages: `2`
- page errors: `0`
- row report digest: `1efc7303eda4`

Browser checks:

- Desktop Actor Muster rendered seven roles by four actions per page, with all
  four directions visible in every cell.
- Mobile `390x844` rendering uses four roles by one action per page, keeps all
  four directions visible, and has no document or toolbar horizontal overflow.
- Title-screen buttons wrap cleanly on mobile.
- The title-screen Actor Muster button opened the live canvas.
- **Inspect in Sprite Lab** deep-linked the first visible runtime row into the
  matching role/action/direction review.

## Visual Result

The actor atlas now reads like a living guild muster rather than a hidden data
file. Every role stands in four-direction formation across idle, walk, work,
and carry, animated from the production runtime atlas. The first page shows
settler through fisher; the second shows trader through forager. Provenance
dots immediately reveal the one clean LOCKED row, two WAIVED rows, and the
remaining inherited BASE art.

## Evidence

- `scripts/screenshots/actor-muster-01.png`
- `scripts/screenshots/actor-muster-02.png`
- `scripts/screenshots/all-sprite-maps-report.json`
- `scripts/screenshots/anim-live-actors.png`
- `scripts/screenshots/anim-live-actors-close.png`

## Remaining Issues

- `221` rows remain BASE: they are now fully visible and runtime-tested, but
  they are not yet reviewed or hash-locked.
- `miner/work/left` and `miner/work/right` remain WAIVED repaint debt.
- Several inherited idle rows visibly retain the old hooded-knight vocabulary;
  Actor Muster makes that cross-role inconsistency impossible to miss.

## Next Best Target

Repaint `miner/work/left` through the row factory. It is already protected by a
waiver, Actor Muster now supplies immediate runtime comparison against all peer
directions, and clean `miner/work/up` provides the scale/palette reference.

## Files Changed

- `index.html`
- `js/render.js`
- `js/main.js`
- `js/input.js`
- `js/economy.js`
- `js/sprite-lab.js`
- `js/sprite-muster.js`
- `scripts/verify-all-sprite-maps.mjs`
- `scripts/screenshots/actor-muster-01.png`
- `scripts/screenshots/actor-muster-02.png`
- `scripts/screenshots/all-sprite-maps-report.json`
- `assets/sprites/README.md`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/LOOP.md`
- `loop/graphics/rounds/110-live-actor-muster.md`
