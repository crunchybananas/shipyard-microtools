# 082 - per-role-miner-work-sheet

## Goal

Continue raising character animations toward the lumberjack quality bar while
keeping imagegen work constrained to one character type at a time.

## Workflow Rule

- Editable actor sources remain one character type per sheet:
  `assets/sprites/actors/<role>.png`.
- Imagegen prompts and proofing should target one role sheet, or one row within
  one role sheet, instead of mixing several actor types into a single generated
  sheet. Mixed-role sheets invite scale, direction, and identity mistakes.
- Runtime `assets/sprites/actors-atlas.png` is still a compiled artifact only.

## Changes

- Created a miner-only work-row prototype using the built-in imagegen workflow.
- Copied the generated source into:
  `tmp/realm-graphics-round-082/miner-work-left/generated-raw.png`.
- Chroma-keyed and packed the generated left-facing pickaxe swing into exact
  `64x84` cells:
  `tmp/realm-graphics-round-082/miner-work-left/row-f28-hueclean.png`.
- Inserted the row into `assets/sprites/actors/miner.png` at `work / left`.
- Mirrored the same row into `work / right`.
- Left other character sheets untouched in this pass.

## Verification

Commands run:

```sh
node scripts/build-motion-atlases.mjs
node --check js/render.js
node --check js/citizens.js
node scripts/verify-anim.mjs
node scripts/verify.mjs --game --logic
node scripts/verify-critic.mjs
```

Additional audit:

- `assets/sprites/actors/miner.png` remains `512x1344`.
- Every actor role/action/direction row still has visible alpha.
- Visible browser refreshed at
  `http://127.0.0.1:4711/index.html?rolesheet=...`.

## Remaining Issues

- The miner row is a useful quality lift but still has minor chroma-key edge
  artifacts at high proof zoom. It is acceptable at runtime scale, but future
  imagegen prompts should use a flatter key background or a cleaner local matte.
- `miner/work/down` and `miner/work/up` still use the older source style.
- The next per-role pass should either finish the miner work directions or move
  to stonecutter as a paired mining-role sheet.
