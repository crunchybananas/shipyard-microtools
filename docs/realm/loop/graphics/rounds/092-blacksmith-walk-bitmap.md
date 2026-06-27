# 092 - blacksmith-walk-bitmap

## Goal

Replace the old-port blacksmith `walk` action block with true bitmap-painted
rows in all four directions, matching the newer lumber/miner/farmer workflow
instead of preserving the SVG-derived actor style.

## Changes

- Generated blacksmith-only `walk/down`, `walk/up`, and `walk/left` strips on a
  removable magenta key.
- Mirrored the accepted left-facing strip into `walk/right`.
- Packed all generated strips through `scripts/pack-generated-sprite-strip.py`
  with shared per-row scale, chroma-key removal, alpha fragment cleanup, and
  exact `64x84` cells.
- Rejected the partial three-direction swap after the proof showed that leaving
  old `walk/up` in place would make the action block visually inconsistent.
- Inserted the full four-row walk block into
  `assets/sprites/actors/blacksmith.png`.
- Rebuilt `assets/sprites/actors-atlas.png` and `assets/sprites/ambient-atlas.png`.

## Proofs

- Old/new blacksmith walk proof:
  `tmp/realm-graphics-round-092/blacksmith-walk-proof-x4.png`
- Accepted walk-down row:
  `tmp/realm-graphics-round-092/blacksmith-walk-down/row-walk-down.png`
- Accepted walk-up row:
  `tmp/realm-graphics-round-092/blacksmith-walk-up/row-walk-up.png`
- Accepted walk-left row:
  `tmp/realm-graphics-round-092/blacksmith-walk-left/row-walk-left.png`
- Mirrored walk-right row:
  `tmp/realm-graphics-round-092/blacksmith-walk-left/row-walk-right.png`
- Pre-replacement source backup for this round:
  `tmp/realm-graphics-round-092/blacksmith-before.png`
- Refreshed audit sheet:
  `scripts/screenshots/sprite-audit-worst-rows.png`

## Audit Result

Before this pass:

```text
blacksmith/walk/down  score=141.5
blacksmith/walk/up    score=70.6
blacksmith/walk/left  score=137.9
blacksmith/walk/right score=69.4
```

After replacement:

```text
blacksmith/walk/down  score=0.0 center=0.8 widthRange=1  heightRange=1 pixelRatio=1.02 fragments=0/0
blacksmith/walk/up    score=0.0 center=0.7 widthRange=0  heightRange=0 pixelRatio=1.02 fragments=0/0
blacksmith/walk/left  score=0.0 center=1.9 widthRange=12 heightRange=1 pixelRatio=1.12 fragments=0/0
blacksmith/walk/right score=0.0 center=1.9 widthRange=12 heightRange=1 pixelRatio=1.12 fragments=0/0
```

The blacksmith walk rows dropped out of the global worst-row list. The current
top outliers are now builder walk/work rows, blacksmith work rows,
`guard/walk/down`, rancher walk/work rows, and miner/farmer walk rows.

## Verification

Commands run:

```sh
env PATH=/opt/homebrew/bin:$PATH node scripts/build-motion-atlases.mjs
node scripts/audit-sprite-frames.mjs
node --check js/render.js
node --check js/citizens.js
node --check scripts/audit-sprite-frames.mjs
env PYTHONPYCACHEPREFIX=/private/tmp/realm-pycache python3 -m py_compile scripts/pack-generated-sprite-strip.py
/opt/homebrew/bin/magick identify assets/sprites/actors/blacksmith.png assets/sprites/actors-atlas.png assets/sprites/ambient-atlas.png
node scripts/verify-anim.mjs
node scripts/verify.mjs --game --logic
node scripts/verify-critic.mjs
```

Notes:

- `assets/sprites/actors/blacksmith.png` remains `512x1344`.
- `assets/sprites/actors-atlas.png` remains `512x18816`.
- `assets/sprites/ambient-atlas.png` remains `192x48`.
- `node scripts/verify-anim.mjs` passed with no page errors.
- `node scripts/verify.mjs --game --logic` passed; console output contained
  only the known GPU `ReadPixels` performance warning.
- `node scripts/verify-critic.mjs` passed with no page errors.

## Remaining Issues

- Blacksmith `work/down` and `work/left` remain old-port rows and now score
  `125.9` and `127.2`.
- Builder walk/work rows are now the highest global audit outliers.
- Blacksmith idle/carry rows still use the old derived style, so the role is
  only partially converted to the newer bitmap look.
