# 085 - farmer-work-directions

## Goal

Replace the old derived farmer `work` block with role-specific farming
animation that matches the quality direction of the lumber and miner passes.

## Workflow Rule

- Treat `assets/sprites/actors/farmer.png` as the only editable actor source
  for this pass.
- Keep imagegen candidates, packed rows, and proof sheets under
  `tmp/realm-graphics-round-085/`.
- Rebuild `assets/sprites/actors-atlas.png` from role source sheets after row
  insertion; do not hand-edit the compiled atlas.

## Changes

- Inspected farmer and guard proof blocks. Farmer `work` was the largest
  mismatch: it still read as an old derived knight/robe base rather than a
  farmer action.
- Generated farmer-only work candidates for `down`, `up`, `left`, and `right`.
- Rejected the first overhead-swing set where tall tool poses made the actor
  shrink in some frames.
- Regenerated a compact hoeing/tilling set with low tool motion so body scale
  stays stable.
- Packed selected rows into exact `64x84` cells:
  - `tmp/realm-graphics-round-085/farmer-work-down/row-final.png`
  - `tmp/realm-graphics-round-085/farmer-work-up/row-final.png`
  - `tmp/realm-graphics-round-085/farmer-work-left/row-final.png`
  - `tmp/realm-graphics-round-085/farmer-work-right/row-final.png`
- Used the generated left row mirrored for `work / right` because the generated
  right row clipped at the cell edge.
- Inserted the selected rows into `assets/sprites/actors/farmer.png` at the
  four `work` directions.
- Rebuilt the runtime actor and ambient atlases with
  `scripts/build-motion-atlases.mjs`.

## Proofs

- Old farmer work block:
  `tmp/realm-graphics-round-085/farmer-proof/work-block-x4.png`
- New farmer work block:
  `tmp/realm-graphics-round-085/farmer-work-candidate-block-x4.png`
- Selected row proofs:
  - `tmp/realm-graphics-round-085/farmer-work-down/row-selected-x8.png`
  - `tmp/realm-graphics-round-085/farmer-work-up/row-selected-x8.png`
  - `tmp/realm-graphics-round-085/farmer-work-left/row-selected-x8.png`
  - `tmp/realm-graphics-round-085/farmer-work-right/row-selected-x8.png`

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

Notes:

- `node scripts/verify-anim.mjs` passed and specifically exercised
  `farmer work right`, reporting all 7 frame-to-frame pairs moving with no page
  errors.
- `node scripts/verify.mjs --game --logic` passed; console output contained
  only GPU `ReadPixels` performance warnings.
- `node scripts/verify-critic.mjs` passed and reported no page errors.
- `assets/sprites/actors/farmer.png` remains `512x1344`.
- `assets/sprites/actors-atlas.png` remains `512x18816`.

## Remaining Issues

- A few blue/purple matte edge pixels remain visible at exaggerated proof zoom.
  They are acceptable at runtime scale but should be improved by future
  prompt/matte passes.
- The farmer `carry` rows still use the older derived look. They are now a
  better next target than farmer `work`.
- Guard work/carry rows still use the old derived role base and remain a
  high-priority animation target.
