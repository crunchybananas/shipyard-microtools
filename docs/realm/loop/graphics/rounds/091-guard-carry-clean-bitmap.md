# 091 - guard-carry-clean-bitmap

## Goal

Replace the old-port guard `carry` block with clean bitmap actor-base rows that
do not bake in carried props. Runtime `drawCarryLoad(...)` remains the single
source for visible wood, stone, food, gold, and iron loads.

## Changes

- Generated guard-only no-load `carry/down`, `carry/up`, and `carry/left`
  sprite strips on a removable magenta key.
- Rejected the old carry rows as SVG-port artifacts because their audit scores
  and proof sheet showed center jumps, edge fragments, and non-bitmap styling.
- Packed the accepted generated rows through
  `scripts/pack-generated-sprite-strip.py`:
  - shared scale across all eight frames
  - chroma-key removal and despill
  - alpha fragment cleanup
  - exact `64x84` cells
- Mirrored the accepted left-facing row into `carry/right`.
- Inserted the four rows into `assets/sprites/actors/guard.png`.
- Rebuilt `assets/sprites/actors-atlas.png` and `assets/sprites/ambient-atlas.png`.

## Proofs

- Old/new carry block proof:
  `tmp/realm-graphics-round-091/guard-carry-proof-x4.png`
- Accepted carry-down row:
  `tmp/realm-graphics-round-091/guard-carry-down/row-carry-down.png`
- Accepted carry-up row:
  `tmp/realm-graphics-round-091/guard-carry-up/row-carry-up.png`
- Accepted carry-left row:
  `tmp/realm-graphics-round-091/guard-carry-left/row-carry-left.png`
- Mirrored carry-right row:
  `tmp/realm-graphics-round-091/guard-carry-left/row-carry-right.png`
- Refreshed audit sheet:
  `scripts/screenshots/sprite-audit-worst-rows.png`

## Audit Result

Before this pass:

```text
guard/carry/down  score=126.0
guard/carry/up    score=46.9
guard/carry/left  score=127.0
guard/carry/right score=48.5
```

After replacement:

```text
guard/carry/down  score=0.0 center=1.4 widthRange=0 heightRange=1 pixelRatio=1.03 fragments=0/0
guard/carry/up    score=0.0 center=2.1 widthRange=2 heightRange=1 pixelRatio=1.03 fragments=0/0
guard/carry/left  score=0.0 center=1.6 widthRange=8 heightRange=1 pixelRatio=1.07 fragments=0/0
guard/carry/right score=0.0 center=1.6 widthRange=8 heightRange=1 pixelRatio=1.07 fragments=0/0
```

The guard carry block dropped out of the global worst-row list entirely. The
current worst rows are now blacksmith, builder, rancher, miner walk/work rows,
plus `guard/walk/down`.

## Verification

Commands run:

```sh
env PATH=/opt/homebrew/bin:$PATH node scripts/build-motion-atlases.mjs
node scripts/audit-sprite-frames.mjs
node --check js/render.js
node --check js/citizens.js
node --check scripts/audit-sprite-frames.mjs
env PYTHONPYCACHEPREFIX=/private/tmp/realm-pycache python3 -m py_compile scripts/pack-generated-sprite-strip.py
/opt/homebrew/bin/magick identify assets/sprites/actors/guard.png assets/sprites/actors-atlas.png assets/sprites/ambient-atlas.png
node scripts/verify-anim.mjs
node scripts/verify.mjs --game --logic
node scripts/verify-critic.mjs
```

Notes:

- `assets/sprites/actors/guard.png` remains `512x1344`.
- `assets/sprites/actors-atlas.png` remains `512x18816`.
- `assets/sprites/ambient-atlas.png` remains `192x48`.
- `node scripts/verify-anim.mjs` passed with no page errors and explicitly
  exercised `guard carry left`.
- `node scripts/verify.mjs --game --logic` passed; console output contained
  only the known GPU `ReadPixels` performance warning.
- `node scripts/verify-critic.mjs` passed with no page errors.

## Remaining Issues

- Guard `walk/down` and `walk/up` still use the old-port base and should be
  repainted next for guard consistency.
- Blacksmith and builder rows are now the highest global audit outliers and
  should be treated as bitmap replacement targets, not SVG cleanup targets.
- Future carry rows should stay no-load unless the renderer changes; carried
  resources belong in the runtime overlay, not in the actor sheet.
