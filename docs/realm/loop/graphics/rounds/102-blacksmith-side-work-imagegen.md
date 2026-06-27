# 102 - blacksmith side work imagegen

## Goal

Replace the old-port blacksmith side work rows with a role-specific bitmap
hammering loop while preserving the per-role source-sheet workflow.

## Changes

- Generated a blacksmith-only side-facing hammer/anvil strip on a flat
  chroma-key background using the built-in imagegen workflow.
- Packed the accepted strip into exact `64x84` cells with
  `scripts/pack-generated-sprite-strip.py`.
- Inserted the packed strip into `blacksmith/work/left` in
  `assets/sprites/actors/blacksmith.png` and mirrored it into
  `blacksmith/work/right`.
- Rebuilt `assets/sprites/actors-atlas.png` and
  `assets/sprites/ambient-atlas.png` from the per-type source sheets.

## Proofs

- Walk style reference:
  `tmp/realm-graphics-round-102/blacksmith-walk-reference-x3.png`
- Old work block:
  `tmp/realm-graphics-round-102/blacksmith-work-before-x3.png`
- Imagegen source:
  `tmp/realm-graphics-round-102/blacksmith-work-left-imagegen-v1-source.png`
- Packed accepted row:
  `tmp/realm-graphics-round-102/packed-blacksmith-left-v1/blacksmith-work-left-v1.png`
- Packed accepted proof:
  `tmp/realm-graphics-round-102/packed-blacksmith-left-v1/blacksmith-work-left-v1-x4.png`
- Before/after/reference proof:
  `tmp/realm-graphics-round-102/blacksmith-work-side-before-after-reference-x3.png`
- Refreshed continuity proof:
  `scripts/screenshots/sprite-audit-worst-rows.png`
- Refreshed gait proof:
  `scripts/screenshots/walk-gait-audit-worst-rows.png`

## Audit Result

Before this pass, `blacksmith/work/left` was the top global continuity offender:

```text
blacksmith/work/left score=127.2 fragments=305/2
```

After the accepted side-work replacement:

```text
blacksmith/work/down score=125.9 blank=0 fragments=303/2 center=10.9 size=15/13
blacksmith/work/up score=70.1 blank=0 fragments=59/2 center=11.7 size=13/20
blacksmith/work/left score=29.0 blank=0 fragments=0/0 center=6.0 size=8/17
blacksmith/work/right score=29.0 blank=0 fragments=0/0 center=6.0 size=8/17
```

The side rows now use the newer blacksmith identity: dark shirt, brown leather
apron, planted boots, stable anvil, and hammer lift/strike/recover motion.

## Verification

Commands run:

```sh
identify -format '%w %h %[channels]\n' assets/sprites/actors/blacksmith.png
node scripts/verify-sprite-source-contract.mjs
node scripts/audit-sprite-frames.mjs
node scripts/audit-walk-gait.mjs
env PATH=/opt/homebrew/bin:$PATH node scripts/build-motion-atlases.mjs
node --check scripts/build-motion-atlases.mjs
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

- `blacksmith/work/down` and `blacksmith/work/up` are still old-port rows and
  need direction-specific front/back imagegen passes.
- The top continuity targets now start with guard `walk/down`,
  blacksmith `work/down`, rancher walk/work rows, miner walk rows, farmer walk
  rows, lumber `work/up`, and settler walk/work down rows.
- The top gait failures remain older front/back rows:
  `farmer/walk/up`, `miner/walk/up`, `guard/walk/up`, `rancher/walk/up`, and
  `trader/walk/up`.
- A dedicated Storehouse sprite is still needed; the live Storehouse currently
  reuses granary art as a temporary stand-in.
