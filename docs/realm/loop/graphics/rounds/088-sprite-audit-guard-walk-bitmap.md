# 088 - sprite-audit-guard-walk-bitmap

## Goal

Make sprite progress measurable and avoid pushing old SVG-port rows forward as
if they were finished bitmap animation.

## Changes

- Added `scripts/audit-sprite-frames.mjs`, which inspects every actor
  role/action/direction row for:
  - blank frames
  - frame-to-frame center jumps
  - width/height range jumps
  - alpha fragment counts
  - edge-touching pixels
- Generated a worst-row proof sheet at
  `scripts/screenshots/sprite-audit-worst-rows.png`.
- Confirmed the largest issues are old derived/SVG-port rows, not the newer
  lumber/miner/farmer bitmap rows.
- Generated a guard-only bitmap walking-left strip on a flat chroma-key
  background using the built-in imagegen workflow.
- Segmented the eight actual guard figures, removed the chroma key, despilled
  the matte, packed them into exact `64x84` frames, and mirrored the accepted
  side row for `walk/right`.
- Replaced only:
  - `guard/walk/left`
  - `guard/walk/right`
- Rebuilt `assets/sprites/actors-atlas.png` and `assets/sprites/ambient-atlas.png`.

## Proofs

- Audit proof after replacement:
  `scripts/screenshots/sprite-audit-worst-rows.png`
- Guard side-walk proof:
  `tmp/realm-graphics-round-088/guard-walk-left/guard-walk-side-proof-x4.png`
- Packed left row:
  `tmp/realm-graphics-round-088/guard-walk-left/row-matte.png`
- Packed mirrored right row:
  `tmp/realm-graphics-round-088/guard-walk-left/row-matte-right.png`

## Audit Result

After replacement:

```text
guard/walk/left  score=0.0 center=2.2 widthRange=5 heightRange=3 pixelRatio=1.06 fragments=1/0
guard/walk/right score=0.0 center=2.2 widthRange=5 heightRange=3 pixelRatio=1.06 fragments=1/0
```

The remaining guard outliers are still old-port rows:

```text
guard/work/left  score=126.9
guard/carry/left score=127.0
```

Those were intentionally not replaced with the walk row.

## Verification

Commands run:

```sh
env PATH=/opt/homebrew/bin:$PATH node scripts/build-motion-atlases.mjs
node scripts/audit-sprite-frames.mjs
node --check js/render.js
node --check js/citizens.js
node --check scripts/audit-sprite-frames.mjs
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

- Guard `work` and `carry` rows are still old-port rows and should be replaced
  with dedicated bitmap strips rather than copied from walk.
- Blacksmith and builder old-port rows are currently the highest-scoring audit
  outliers.
- Farmer idle/walk rows remain older style and still need a dedicated bitmap
  pass to match the newer farmer work/carry direction.
