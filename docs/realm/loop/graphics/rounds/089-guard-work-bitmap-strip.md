# 089 - guard-work-bitmap-strip

## Goal

Continue replacing old SVG-port guard animation rows with true bitmap-painted
sprite strips, while keeping frame transitions measurable and artifact-gated.

## Changes

- Added `scripts/pack-generated-sprite-strip.py` to make the imagegen-to-atlas
  workflow repeatable:
  - segment the eight largest foreground figures from a flat chroma-key strip
  - remove/despill the key color
  - remove tiny alpha fragments
  - apply a shared scale across all frames
  - pack exact `64x84` cells and an x4 proof
- Generated a guard-only `work/left` strip using the built-in imagegen workflow.
- Rejected the raw strip as a direct atlas input until it passed segmentation,
  chroma cleanup, and x4 visual proofing.
- Inserted the accepted strip into:
  - `guard/work/left`
  - mirrored `guard/work/right`
- Rebuilt `assets/sprites/actors-atlas.png` and `assets/sprites/ambient-atlas.png`.

## Proofs

- Old/new guard work side proof:
  `tmp/realm-graphics-round-089/guard-work-left/guard-work-side-proof-x4.png`
- Packed work-left row:
  `tmp/realm-graphics-round-089/guard-work-left/row-work-left.png`
- Packed mirrored work-right row:
  `tmp/realm-graphics-round-089/guard-work-left/row-work-right.png`
- Refreshed audit sheet:
  `scripts/screenshots/sprite-audit-worst-rows.png`

## Audit Result

After replacement:

```text
guard/work/left  score=70.0 center=5.7 widthRange=34 heightRange=12 pixelRatio=1.08 fragments=36/2
guard/work/right score=70.0 center=5.7 widthRange=34 heightRange=12 pixelRatio=1.08 fragments=36/2
```

The score is mostly from expected spear extension width during the thrust. The
old row previously scored `126.9` and appeared in the worst-row list.

Current guard status:

```text
guard/walk/left   score=0.0
guard/walk/right  score=0.0
guard/work/left   score=70.0
guard/work/right  score=70.0
guard/work/down   score=126.1
guard/carry/left  score=127.0
```

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

- Guard `work/down`, `work/up`, and all `carry` rows still use the old-port
  style and need dedicated bitmap rows.
- Blacksmith and builder remain the highest global audit outliers.
- The packer is useful for future imagegen rows, but every candidate still needs
  an x4 proof check before insertion.
