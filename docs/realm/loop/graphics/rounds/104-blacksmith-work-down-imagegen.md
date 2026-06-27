# 104 - blacksmith work-down imagegen

## Goal

Replace the old-port `blacksmith/work/down` row with a front-facing
role-specific hammering loop.

## Changes

- Generated a blacksmith-only front-facing hammer/anvil strip on a flat
  chroma-key background using the built-in imagegen workflow.
- Packed the accepted strip into exact `64x84` cells with
  `scripts/pack-generated-sprite-strip.py`.
- Inserted the packed strip into `blacksmith/work/down` in
  `assets/sprites/actors/blacksmith.png`.
- Preserved the existing `blacksmith/work/up`, side work rows, and cleaned
  carry block.
- Rebuilt `assets/sprites/actors-atlas.png` and
  `assets/sprites/ambient-atlas.png` from the per-type source sheets.

## Proofs

- Old work block:
  `tmp/realm-graphics-round-104/blacksmith-work-before-x3.png`
- Walk style reference:
  `tmp/realm-graphics-round-104/blacksmith-walk-reference-x3.png`
- Imagegen source:
  `tmp/realm-graphics-round-104/blacksmith-work-down-imagegen-v1-source.png`
- Packed accepted row:
  `tmp/realm-graphics-round-104/packed-blacksmith-down-v1/blacksmith-work-down-v1.png`
- Packed accepted proof:
  `tmp/realm-graphics-round-104/packed-blacksmith-down-v1/blacksmith-work-down-v1-x4.png`
- Before/after/reference proof:
  `tmp/realm-graphics-round-104/blacksmith-work-down-before-after-reference-x3.png`
- Refreshed continuity proof:
  `scripts/screenshots/sprite-audit-worst-rows.png`
- Refreshed gait proof:
  `scripts/screenshots/walk-gait-audit-worst-rows.png`

## Audit Result

Before this pass, `blacksmith/work/down` was still an old-port row:

```text
blacksmith/work/down score=125.9 fragments=303/2
```

After the accepted replacement:

```text
blacksmith/work/down score=22.0 fragments=0/0 center=5.3 size=1/16
blacksmith/work/up score=70.1 fragments=59/2 center=11.7 size=13/20
blacksmith/work/left score=29.0 fragments=0/0 center=6.0 size=8/17
blacksmith/work/right score=29.0 fragments=0/0 center=6.0 size=8/17
```

The blacksmith `work/down`, `work/left`, and `work/right` rows now use the
newer blacksmith identity. `work/up` remains the last old-port blacksmith work
row.

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

The Codex in-app preview bridge dropped its browser route while refreshing to
the round 104 cache-busted URL, so this round was verified through the
browser-backed smoke/animation/critic scripts rather than a visible preview
refresh.

## Remaining Issues

- `blacksmith/work/up` is the last old-port blacksmith work row.
- The top continuity targets now start with guard `walk/down`, rancher
  walk/work rows, miner walk rows, farmer walk rows, lumber `work/up`, and
  settler walk/work rows.
- The top gait failures remain older front/back rows:
  `farmer/walk/up`, `miner/walk/up`, `guard/walk/up`, `rancher/walk/up`, and
  `trader/walk/up`.
- A dedicated Storehouse sprite is still needed; the live Storehouse currently
  reuses granary art as a temporary stand-in.
