# 100 - builder work-up imagegen

## Goal

Finish the builder `work` cardinal set by replacing the last old-port work row
with a role-specific bitmap construction loop.

## Changes

- Replaced `builder/work/up` in `assets/sprites/actors/builder.png` with an
  imagegen-assisted back-facing construction work strip.
  - The accepted strip is an eight-frame hammering loop over a compact timber
    workpiece.
  - The generated chroma-key source was packed into exact `64x84` cells before
    insertion.
  - The row preserves the newer builder identity established by the down and
    side work replacements: olive tunic, brown apron, boots, hammer, and timber
    workpiece.
- Rebuilt `assets/sprites/actors-atlas.png` and
  `assets/sprites/ambient-atlas.png` from the per-type source sheets.

## Proofs

- Before/reference proof:
  `tmp/realm-graphics-round-100/builder-work-up-before-down-left-reference-x35.png`
- Imagegen source:
  `tmp/realm-graphics-round-100/builder-work-up-imagegen-v1-source.png`
- Packed accepted row:
  `tmp/realm-graphics-round-100/packed-builder-up-v1/builder-work-up-v1.png`
- Packed accepted proof:
  `tmp/realm-graphics-round-100/packed-builder-up-v1/builder-work-up-v1-x4.png`
- Before/after/reference proof:
  `tmp/realm-graphics-round-100/builder-work-up-before-after-reference-x3.png`
- Refreshed continuity proof:
  `scripts/screenshots/sprite-audit-worst-rows.png`
- Refreshed gait proof:
  `scripts/screenshots/walk-gait-audit-worst-rows.png`

## Audit Result

Before this pass, `builder/work/up` was the last old-port builder work row:

```text
builder/work/up score=69.0 fragments=61/2
```

After the accepted imagegen-assisted replacement:

```text
builder/work/down score=12.0 fragments=0/0
builder/work/up score=17.0 fragments=0/0
builder/work/left score=9.0 fragments=0/0
builder/work/right score=9.0 fragments=0/0
```

The builder `work` action is now replaced in all four directions with coherent
role-specific construction animation rows.

## Verification

Commands run:

```sh
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

- Builder carry rows still use older derived art and remain visible in the
  continuity audit.
- The top continuity targets now start with blacksmith work rows, guard
  walk/down, rancher walk/work, miner walk rows, farmer walk rows, and builder
  carry rows.
- The top gait failures remain older front/back rows:
  `farmer/walk/up`, `miner/walk/up`, `guard/walk/up`, `rancher/walk/up`, and
  `trader/walk/up`.
- A dedicated Storehouse sprite is still needed; the live Storehouse currently
  reuses granary art as a temporary stand-in.
