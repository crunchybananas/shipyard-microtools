# Round 108 - Miner Side Work Height Stabilization

## Goal

Use Sprite Lab and the new sprite repair workflow to address the visible
`miner/work/right` acceptance failure where the NPC body appeared to shrink to
make room for the pickaxe.

## Changes

- Stabilized the dense miner body in `assets/sprites/actors/miner.png` for:
  - `work / left`
  - `work / right`
- Avoided full-frame scaling, which previously made the row look inflated and
  muddy.
- Rebuilt generated runtime atlases:
  - `assets/sprites/actors-atlas.png`
  - `assets/sprites/ambient-atlas.png`
- Added Sprite Lab-only cache busting for editable actor/ambient PNG loads so
  the preview reflects rebuilt source art after page reloads.

## Before / After

- `miner/work/right` height delta: `17px` -> `8px`.
- `miner/work/left` height delta: `17px` -> `8px`.
- Sprite Lab now shows `HEIGHT RANGE 70-78` and no height warning for the
  visible `miner/work/right` row.

Remaining warnings are expected for this partial pass:

- Pickaxe reach still touches cell edges.
- Tool swing still contributes to size and center jumps.
- A future true repaint can clean up the pickaxe arc without changing the
  repaired body scale.

## Verification

```bash
node --check js/sprite-lab.js
node --check js/main.js
node scripts/verify-sprite-source-contract.mjs
node scripts/build-motion-atlases.mjs
python3 ~/.codex/skills/realm-sprite-repair/scripts/measure_sprite_row.py assets/sprites/actors/miner.png --action work --dir right --proof /private/tmp/miner-work-right-after.png
python3 ~/.codex/skills/realm-sprite-repair/scripts/measure_sprite_row.py assets/sprites/actors/miner.png --action work --dir left --proof /private/tmp/miner-work-left-after.png
node scripts/verify-anim.mjs
node scripts/verify.mjs --game --logic
```

Sprite Lab was refreshed at
`http://127.0.0.1:4711/index.html?spritelab=1&role=miner&action=work&dir=right`
and reported no height warning after the cache-bust fix.
