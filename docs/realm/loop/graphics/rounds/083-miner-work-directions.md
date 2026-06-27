# 083 - miner-work-directions

## Goal

Finish the miner work action across all four directions while preserving the
one-character-type-per-sheet workflow.

## Workflow Rule

- Treat `assets/sprites/actors/miner.png` as the only editable actor source for
  this pass.
- Keep imagegen candidates, packed rows, and proof sheets under
  `tmp/realm-graphics-round-083/`.
- Rebuild `assets/sprites/actors-atlas.png` from role source sheets after row
  insertion; do not hand-edit the compiled atlas.

## Changes

- Generated miner-only imagegen candidate rows for:
  - `work / down`
  - `work / up`
- Copied raw candidates into:
  - `tmp/realm-graphics-round-083/miner-work-down/generated-raw.png`
  - `tmp/realm-graphics-round-083/miner-work-up/generated-raw.png`
- Chroma-keyed, trimmed, centered, and packed both rows into exact `64x84`
  cells:
  - `tmp/realm-graphics-round-083/miner-work-down/row-alphaopen.png`
  - `tmp/realm-graphics-round-083/miner-work-up/row-alphaopen.png`
- Inserted those rows into `assets/sprites/actors/miner.png` at `work / down`
  and `work / up`.
- Kept the existing improved `work / left` and `work / right` rows untouched.
- Rebuilt the runtime actor and ambient atlases with
  `scripts/build-motion-atlases.mjs`.

## Proofs

- Before block:
  `tmp/realm-graphics-round-083/miner-work-current-block-x4.png`
- Candidate block:
  `tmp/realm-graphics-round-083/miner-work-candidate-block-x4.png`
- Row proofs:
  - `tmp/realm-graphics-round-083/miner-work-down/row-alphaopen-x8.png`
  - `tmp/realm-graphics-round-083/miner-work-up/row-alphaopen-x8.png`

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

- `node scripts/verify-anim.mjs` passed after rerunning outside the filesystem
  sandbox so headless Chromium could launch.
- `node scripts/verify.mjs --game --logic` passed after rerunning outside the
  filesystem sandbox; console output contained only GPU `ReadPixels`
  performance warnings.
- `node scripts/verify-critic.mjs` passed after rerunning outside the
  filesystem sandbox and reported no page errors.
- `assets/sprites/actors/miner.png` remains `512x1344`.
- `assets/sprites/actors-atlas.png` remains `512x18816`.

## Remaining Issues

- The generated rows still show small green matte edge artifacts at exaggerated
  proof zoom. The alpha-mask cleanup keeps them acceptable at runtime scale, but
  the next imagegen prompts should ask for flatter key edges and more empty
  padding around tools.
- The down-row frame with the raised pickaxe has a small loose blade sliver in
  the proof. It is minor in-game, but it is worth improving in a later repaint.
- Continue the same one-role-sheet loop for the next weakest actor sheet rather
  than generating a combined multi-character sheet.
