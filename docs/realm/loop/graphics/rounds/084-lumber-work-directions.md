# 084 - lumber-work-directions

## Goal

Replace the remaining lumber `work/down` and `work/up` placeholder-like rows
with true role-specific chopping animation strips.

## Workflow Rule

- Treat `assets/sprites/actors/lumber.png` as the only editable actor source
  for this pass.
- Keep imagegen candidates, packed rows, and proof sheets under
  `tmp/realm-graphics-round-084/`.
- Rebuild `assets/sprites/actors-atlas.png` from role source sheets after row
  insertion; do not hand-edit the compiled atlas.

## Changes

- Generated lumber-only imagegen candidate rows for:
  - `work / down`
  - `work / up`
- Copied raw candidates into:
  - `tmp/realm-graphics-round-084/lumber-work-down/generated-raw.png`
  - `tmp/realm-graphics-round-084/lumber-work-up/generated-raw.png`
- Chroma-keyed, trimmed, centered, and packed both rows into exact `64x84`
  cells:
  - `tmp/realm-graphics-round-084/lumber-work-down/row-final.png`
  - `tmp/realm-graphics-round-084/lumber-work-up/row-final.png`
- Inserted those rows into `assets/sprites/actors/lumber.png` at `work / down`
  and `work / up`.
- Kept the already-improved lumber `work / left` and `work / right` rows
  untouched.
- Rebuilt the runtime actor and ambient atlases with
  `scripts/build-motion-atlases.mjs`.

## Proofs

- Before block:
  `tmp/realm-graphics-round-084/lumber-work-current-block-x4.png`
- Candidate block:
  `tmp/realm-graphics-round-084/lumber-work-candidate-block-x4.png`
- Row proofs:
  - `tmp/realm-graphics-round-084/lumber-work-down/row-final-x8.png`
  - `tmp/realm-graphics-round-084/lumber-work-up/row-final-x8.png`

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
- `node scripts/verify.mjs --game --logic` passed; console output contained
  only GPU `ReadPixels` performance warnings.
- `node scripts/verify-critic.mjs` passed and reported no page errors.
- `assets/sprites/actors/lumber.png` remains `512x1344`.
- `assets/sprites/actors-atlas.png` remains `512x18816`.

## Remaining Issues

- The generated down/up rows still show a few blue/purple matte edge pixels at
  exaggerated proof zoom. They are much less visible at runtime scale, but a
  future repaint could use a cleaner matte or true transparent workflow.
- The new down/up rows are more frontal/back-view and less side-leaning than
  the older left/right rows. This is acceptable for direction readability, but
  a later full lumber pass could normalize the whole work block from one
  generation style.
- Continue the one-role-sheet loop for farmer and guard work/carry rows, then
  add a dedicated Storehouse sprite.
