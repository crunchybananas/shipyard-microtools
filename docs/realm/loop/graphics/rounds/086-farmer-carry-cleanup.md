# 086 - farmer-carry-cleanup

## Goal

Improve farmer carry behavior by removing the old baked-in carry sack shapes so
the runtime resource overlay is the only visible carried load.

## Workflow Rule

- Treat `assets/sprites/actors/farmer.png` as the only editable actor source
  for this pass.
- Keep proofs and rejected/generated candidates under
  `tmp/realm-graphics-round-086/`.
- Rebuild `assets/sprites/actors-atlas.png` from role source sheets after row
  insertion; do not hand-edit the compiled atlas.

## Changes

- Inspected the runtime carry path in `js/render.js`.
- Confirmed `drawCarryLoad(...)` paints the carried resource separately after
  the actor sprite, so the actor `carry` rows should be no-prop base poses.
- Inspected the current farmer `carry` block:
  `tmp/realm-graphics-round-086/farmer-proof/carry-current-block-x4.png`.
- Attempted a farmer-only imagegen carry row, but the built-in imagegen output
  misfired into unrelated non-sprite imagery. The output was rejected and not
  inserted.
- Replaced farmer `carry/down`, `carry/up`, `carry/left`, and `carry/right`
  with the existing no-prop farmer walking base rows. This removes the baked-in
  generic sack shapes while preserving smooth 8-frame movement.
- Rebuilt the runtime actor and ambient atlases with
  `scripts/build-motion-atlases.mjs`.

## Proofs

- Old farmer carry block:
  `tmp/realm-graphics-round-086/farmer-proof/carry-current-block-x4.png`
- No-prop carry candidate block:
  `tmp/realm-graphics-round-086/farmer-carry-candidate-block-x4.png`
- Source walk block:
  `tmp/realm-graphics-round-086/farmer-proof/walk-source-block-x4.png`

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

- `node scripts/verify-anim.mjs` passed with no page errors.
- `node scripts/verify.mjs --game --logic` passed; console output contained
  only GPU `ReadPixels` performance warnings.
- `node scripts/verify-critic.mjs` passed and reported no page errors.
- `assets/sprites/actors/farmer.png` remains `512x1344`.
- `assets/sprites/actors-atlas.png` remains `512x18816`.

## Remaining Issues

- Farmer `carry` rows are now cleaner no-prop rows, but they still derive from
  the older walk silhouette. A later dedicated generated carry row could improve
  the base posture if imagegen returns a reliable sprite strip.
- Guard work/carry rows still use the old derived role base and remain the next
  high-priority animation target.
- A dedicated Storehouse sprite is still needed so deliveries have a stronger
  visual destination.
