# 101 - builder carry clean base

## Goal

Remove the last old-port builder action block by making `builder/carry` use the
same clean bitmap actor base as `builder/walk`.

## Changes

- Replaced the four `builder/carry` rows in
  `assets/sprites/actors/builder.png` with the matching clean builder walking
  rows.
- Kept carried materials out of the actor sheet. The live renderer still paints
  wood, stone, iron, food, and gold through `drawCarryLoad(...)`, so the actor
  source remains a no-load body animation.
- Rebuilt `assets/sprites/actors-atlas.png` and
  `assets/sprites/ambient-atlas.png` from the per-type source sheets.

## Proofs

- Walk/carry comparison before replacement:
  `tmp/realm-graphics-round-101/builder-walk-vs-carry-before-x25.png`
- Old carry block backup:
  `tmp/realm-graphics-round-101/builder-carry-block-before.png`
- Accepted carry block:
  `tmp/realm-graphics-round-101/builder-carry-block-accepted.png`
- Before/after proof:
  `tmp/realm-graphics-round-101/builder-carry-before-after-x25.png`
- Refreshed continuity proof:
  `scripts/screenshots/sprite-audit-worst-rows.png`
- Refreshed gait proof:
  `scripts/screenshots/walk-gait-audit-worst-rows.png`

## Audit Result

Before this pass, the builder carry rows were old-port derived rows:

```text
builder/carry/down score=104.2 fragments=282/2
builder/carry/up score=59.7 fragments=61/2
builder/carry/left score=121.1 fragments=299/2
builder/carry/right score=63.1 fragments=59/2
```

After replacing the block with the clean builder walk base:

```text
builder/carry/down score=0.0 blank=0 fragments=0/0 center=1.2 size=1/1
builder/carry/up score=0.0 blank=0 fragments=0/0 center=0.8 size=1/0
builder/carry/left score=0.0 blank=0 fragments=0/0 center=2.5 size=10/1
builder/carry/right score=0.0 blank=0 fragments=0/0 center=2.5 size=10/1
```

The full builder action set now uses the newer bitmap actor style for walk,
work, and carry.

## Verification

Commands run:

```sh
identify -format '%w %h %[channels]\n' assets/sprites/actors/builder.png
node scripts/verify-sprite-source-contract.mjs
node scripts/audit-sprite-frames.mjs
node scripts/audit-walk-gait.mjs
env PATH=/opt/homebrew/bin:$PATH node scripts/build-motion-atlases.mjs
node --check scripts/build-motion-atlases.mjs
node --check scripts/audit-sprite-frames.mjs
env REALM_PORT=4923 node scripts/verify-anim.mjs
env REALM_PORT=4921 node scripts/verify.mjs --game --logic
env REALM_PORT=4922 node scripts/verify-logic.mjs
env REALM_PORT=4924 node scripts/verify-critic.mjs
```

`verify-logic` passed `81/81`, including:

```text
delivery: produced wood with no storage/home stays carried
state=needs_delivery carrying=wood wood=0 need=true delivered=false
```

## Remaining Issues

- The top continuity targets now start with blacksmith work rows, guard
  walk/down, rancher walk/work, miner walk rows, farmer walk rows, lumber
  work/up, and settler walk/work down rows.
- The top gait failures remain older front/back rows:
  `farmer/walk/up`, `miner/walk/up`, `guard/walk/up`, `rancher/walk/up`, and
  `trader/walk/up`.
- A dedicated Storehouse sprite is still needed; the live Storehouse currently
  reuses granary art as a temporary stand-in.
