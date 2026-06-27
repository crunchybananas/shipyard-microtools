# 090 - guard-work-cardinals

## Goal

Finish the guard `work` action block with dedicated bitmap rows for the
remaining cardinal directions, keeping the frame-transition audit as the proof
gate.

## Changes

- Generated a guard-only `work/down` strip with a planted front-facing spear
  check motion.
- Generated a separate guard-only `work/up` strip with a planted back-facing
  spear check motion.
- Packed both generated chroma-key strips through
  `scripts/pack-generated-sprite-strip.py`:
  - shared scale across all eight frames
  - chroma-key removal and despill
  - alpha fragment cleanup
  - exact `64x84` cells
- Inserted the accepted rows into:
  - `guard/work/down`
  - `guard/work/up`
- Rebuilt `assets/sprites/actors-atlas.png` and `assets/sprites/ambient-atlas.png`.

## Proofs

- Guard work-down old/new proof:
  `tmp/realm-graphics-round-090/guard-work-down/guard-work-down-proof-x4.png`
- Guard work-up old/new proof:
  `tmp/realm-graphics-round-090/guard-work-up/guard-work-up-proof-x4.png`
- Packed work-down row:
  `tmp/realm-graphics-round-090/guard-work-down/row-work-down.png`
- Packed work-up row:
  `tmp/realm-graphics-round-090/guard-work-up/row-work-up.png`
- Refreshed audit sheet:
  `scripts/screenshots/sprite-audit-worst-rows.png`

## Audit Result

After replacement:

```text
guard/work/down  score=23.0 center=5.5 widthRange=14 heightRange=15 pixelRatio=1.11 fragments=0/0
guard/work/up    score=47.0 center=7.8 widthRange=27 heightRange=7  pixelRatio=1.05 fragments=0/0
guard/work/left  score=70.0 center=5.7 widthRange=34 heightRange=12 pixelRatio=1.08 fragments=36/2
guard/work/right score=70.0 center=5.7 widthRange=34 heightRange=12 pixelRatio=1.08 fragments=36/2
```

Before this pass, `guard/work/down` scored `126.1` and appeared in the global
worst-row list. The full guard `work` action now uses bitmap-painted rows in
all four directions.

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
- `node scripts/verify-anim.mjs` passed with no page errors.
- `node scripts/verify.mjs --game --logic` passed; console output contained
  only the known GPU `ReadPixels` performance warning.
- `node scripts/verify-critic.mjs` passed with no page errors.

## Remaining Issues

- Guard `carry` rows remain old-port rows and are now the next best guard
  target.
- Guard `walk/down` and `walk/up` still use the old-port base.
- Blacksmith and builder remain the highest global audit outliers.
