# Round 107 - Sprite Lab Tooling

## Goal

Make sprite-map iteration easier to inspect and discuss before doing another
row repaint. The previous workflow had good compiler/audit scripts, but the
human review step was still too indirect: screenshots and audit sheets made it
hard to say which exact row or frame looked wrong.

## Changes

- Added `js/sprite-lab.js`, a zero-dependency in-app review surface backed by
  the same `scripts/sprite-source-contract.mjs` constants as the atlas
  compiler.
- Added Sprite Lab entry points on the title screen and HUD.
- Added direct URL support for `?spritelab=1`, plus `?rolesheet=...` parsing
  when the value contains a role/action/direction name.
- Actor review now supports:
  - exact per-role/action/direction row selection,
  - animated frame playback,
  - strip scrubbing,
  - grid, onion, zoom, and alpha-mask overlays,
  - frame/row diagnostics for bounds, center, edge pixels, and row/atlas rects,
  - local review marks with severity, tags, notes, and export.
- Ambient review now supports browsing the separate prop source PNGs and
  marking them in the same review queue.

## Verification

- `node --check js/sprite-lab.js`
- `node --check js/main.js`
- `node scripts/verify-sprite-source-contract.mjs`
- `node scripts/audit-sprite-frames.mjs`
- `node scripts/audit-walk-gait.mjs`
- `node scripts/verify.mjs --game --logic`
- Headless browser probe opened `index.html?spritelab=1&role=miner&action=work&dir=left`,
  verified the lab opened, rendered the row preview/strip/metrics, saved a test
  review mark to localStorage, switched to ambient props, and reported no page
  errors.

## Next Use

Before repainting more rows, open Sprite Lab and mark rows/frames that look bad
in live visual terms. Export the report and use it to choose the next one-role
imagegen or pixel-edit pass. The audit scripts still say the likely targets are
`lumber/work/up`, `miner/work/up`, `lumber/work/down`, and miner side work, but
the review marks should decide which one is visually most disruptive.
