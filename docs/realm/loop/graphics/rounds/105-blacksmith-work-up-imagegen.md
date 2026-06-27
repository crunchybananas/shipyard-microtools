# 105 - blacksmith work-up imagegen

## Goal

Finish the blacksmith `work` action by replacing the last old-port row,
`blacksmith/work/up`, with a back-facing hammering loop.

## Changes

- Generated a blacksmith-only back-facing hammer/anvil strip on a flat
  chroma-key background using the built-in imagegen workflow.
- Packed the accepted strip into exact `64x84` cells with
  `scripts/pack-generated-sprite-strip.py`.
- Inserted the packed strip into `blacksmith/work/up` in
  `assets/sprites/actors/blacksmith.png`.
- Rebuilt `assets/sprites/actors-atlas.png` and
  `assets/sprites/ambient-atlas.png` from the per-type source sheets.

## Proofs

- Imagegen source:
  `tmp/realm-graphics-round-105/blacksmith-work-up-imagegen-v1-source.png`
- Packed accepted row:
  `tmp/realm-graphics-round-105/packed-blacksmith-up-v1/blacksmith-work-up-v1.png`
- Packed accepted proof:
  `tmp/realm-graphics-round-105/packed-blacksmith-up-v1/blacksmith-work-up-v1-x4.png`
- Full before/after/reference proof:
  `tmp/realm-graphics-round-105/blacksmith-work-complete-before-after-reference-x3.png`
- Refreshed continuity proof:
  `scripts/screenshots/sprite-audit-worst-rows.png`
- Refreshed gait proof:
  `scripts/screenshots/walk-gait-audit-worst-rows.png`

## Audit Result

Before this pass, `blacksmith/work/up` was the final old-port blacksmith work
row:

```text
blacksmith/work/up score=70.1 fragments=59/2
```

After the accepted replacement, the full blacksmith work block is:

```text
blacksmith/work/down score=22.0 fragments=0/0 center=5.3 size=1/16
blacksmith/work/up score=37.0 fragments=0/0 center=6.1 size=8/19
blacksmith/work/left score=29.0 fragments=0/0 center=6.0 size=8/17
blacksmith/work/right score=29.0 fragments=0/0 center=6.0 size=8/17
```

Blacksmith `walk`, `work`, and `carry` now all use the newer painted blacksmith
style; no blacksmith rows remain in the top continuity audit list.

## Verification

Commands run:

```sh
node scripts/audit-sprite-frames.mjs
node scripts/verify-sprite-source-contract.mjs
node --check js/citizens.js
node --check js/render.js
node --check js/enhancements.js
env PATH=/opt/homebrew/bin:$PATH node scripts/build-motion-atlases.mjs
node scripts/verify-sprite-source-contract.mjs
node scripts/audit-sprite-frames.mjs
node scripts/audit-walk-gait.mjs
env REALM_PORT=4923 node scripts/verify-anim.mjs
env REALM_PORT=4921 node scripts/verify.mjs --game --logic
env REALM_PORT=4924 node scripts/verify-critic.mjs
env REALM_PORT=4922 node scripts/verify-logic.mjs
```

`verify-logic` passed `81/81`, including:

```text
delivery: produced wood with no storage/home stays carried
state=needs_delivery carrying=wood wood=0 need=true delivered=false
```

## Remaining Issues

- The top continuity targets now start with guard `walk/down`, rancher
  walk/work rows, miner walk rows, farmer walk rows, lumber `work/up`, and
  settler walk/work rows.
- The top gait failures remain older front/back rows:
  `farmer/walk/up`, `miner/walk/up`, `guard/walk/up`, `rancher/walk/up`, and
  `trader/walk/up`.
- A dedicated Storehouse sprite is still needed; the live Storehouse currently
  reuses granary art as a temporary stand-in.
