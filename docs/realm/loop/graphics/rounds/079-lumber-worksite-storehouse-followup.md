# 079 - lumber-worksite-storehouse-followup

## Goal

Close the live-play issues found after the round 078 lumber sprite pass:
working lumber workers should not flash, lumber jobs should happen at trees
instead of inside the mill, and delivered goods should have a storage target
instead of defaulting to houses.

## Changes

- Filled all lumber `work` directions in `assets/sprites/actors/lumber.png`.
  `work / left` keeps the selected chop strip, `work / right` mirrors it, and
  `work / down` plus `work / up` use visible lumber rows as placeholders. This
  removes transparent-frame flashes while the worker is in the `working` state.
- Rebuilt the runtime actor atlas after the source-sheet edits.
- Added forest-aware lumber work targeting in `js/citizens.js`. Lumber workers
  now pick a reachable nearby `TILE.FOREST` tile around their mill, path there,
  and work at the tree line instead of walking to the mill footprint.
- Added a lightweight `Storehouse` building. It appears under Infrastructure,
  is unlocked with Agriculture, uses the granary sprite as a temporary visual
  stand-in, and is now preferred for delivered wood, stone, iron, and overflow
  goods.

## Verification

Commands run:

```sh
node scripts/build-motion-atlases.mjs
node --check js/citizens.js
node --check js/render.js
node --check js/state.js
node --check js/ui.js
node --check js/tech.js
node --check js/minimap.js
node --check scripts/verify.mjs
node --check scripts/verify-critic.mjs
node scripts/verify-anim.mjs
node scripts/verify-critic.mjs
node scripts/verify.mjs --game --logic
```

Additional audit:

- Alpha maxima for lumber rows `work/down`, `work/up`, `work/left`,
  `work/right`, and all four `carry` rows were `1`, confirming the rows are no
  longer blank.
- The in-app browser was refreshed at
  `http://127.0.0.1:4711/index.html?storefix=...`; the loaded game build bar
  shows `storehouse`.

## Remaining Issues

- The new `Storehouse` currently reuses granary art. It is behaviorally useful,
  but should receive its own small warehouse sprite in a later art pass.
- `work/down` and `work/up` are visible placeholders rather than true chopping
  rows. They stop the flash; a future imagegen pass should replace them with
  direction-specific work strips.
