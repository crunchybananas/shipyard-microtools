# 087 - farmer-carry-style-correction

## Goal

Correct the round 086 farmer carry regression where the no-prop carry rows
looked like the older derived actor style instead of the newer painted farmer
work style.

## What Happened

- Round 086 correctly identified that carried resources are drawn separately by
  `drawCarryLoad(...)`, so farmer carry rows should not include baked sacks.
- The accepted round 086 source used clean no-prop walk rows, but those rows
  still came from the older hooded placeholder silhouette.
- When the carry row was viewed in-game, it read as a return to the old SVG-like
  style instead of the newer straw-hat painted farmer.
- Follow-up imagegen attempts for a no-prop farmer carry strip misfired into
  unrelated non-sprite imagery. Those outputs were rejected and not inserted.

## Changes

- Replaced the round 086 old-style farmer carry rows with a newer painted farmer
  carry block derived from the accepted round 085 farmer work art.
- Rebuilt the runtime actor and ambient atlases from the source sheets.
- Kept rejected cleanup attempts under `tmp/realm-graphics-round-087/` instead
  of inserting them into source art.

## Proofs

Proof sheet:
`tmp/realm-graphics-round-087/farmer-carry-round087-proof.png`

Top-to-bottom proof order:

- Round 086 clean no-prop carry base, rejected as too old-style.
- Current round 087 painted farmer carry block, accepted as the least-bad live
  checkpoint because it matches the newer farmer look.
- Hybrid old/new carry mask, rejected because it leaves ghost tools and torn
  silhouette fragments.
- Hard alpha tool mask, rejected because it creates rectangular holes in the
  actor.

## Verification

Commands run:

```sh
node scripts/build-motion-atlases.mjs
node --check js/render.js
node --check js/citizens.js
identify assets/sprites/actors/farmer.png assets/sprites/actors-atlas.png assets/sprites/ambient-atlas.png
node scripts/verify-anim.mjs
node scripts/verify.mjs --game --logic
node scripts/verify-critic.mjs
```

Notes:

- `assets/sprites/actors/farmer.png` remains `512x1344`.
- `assets/sprites/actors-atlas.png` remains `512x18816`.
- `assets/sprites/ambient-atlas.png` remains `192x48`.
- `node scripts/verify-anim.mjs` passed with no page errors.
- `node scripts/verify.mjs --game --logic` passed; console output contained
  only the known GPU `ReadPixels` performance warning.
- `node scripts/verify-critic.mjs` passed with no page errors.

## Remaining Issues

- Farmer carry rows now match the newer painted style better, but they still
  contain some farming-tool remnants because the clean no-prop imagegen pass did
  not produce usable sprite art.
- Farmer idle and walk rows are still old-style and should be a future dedicated
  role-sheet pass.
- The next safe graphics target is either a true generated no-prop farmer carry
  row with stricter proof gates, or guard work/carry rows.
