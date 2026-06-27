# 098 - builder side work imagegen

## Goal

Continue raising actor animation quality by replacing a top old-port work row
with a role-specific bitmap construction loop, while keeping the one-role-sheet
source contract intact.

## Changes

- Replaced `builder/work/left` in `assets/sprites/actors/builder.png` with an
  imagegen-assisted construction work strip.
  - The accepted strip is an eight-frame hammering loop with a timber prop.
  - It was generated on a flat chroma-key background, packed into exact
    `64x84` cells, and inserted into the per-role builder source sheet.
  - The generated strip was mirrored into `builder/work/right` so side work
    directions share one coherent construction animation.
- Rebuilt `assets/sprites/actors-atlas.png` and
  `assets/sprites/ambient-atlas.png` from the per-type source sheets.

## Proofs

- Imagegen source:
  `tmp/realm-graphics-round-098/builder-work-left-imagegen-v1-source.png`
- Packed accepted row:
  `tmp/realm-graphics-round-098/packed-builder-v1/builder-work-left-v1.png`
- Packed accepted proof:
  `tmp/realm-graphics-round-098/packed-builder-v1/builder-work-left-v1-x4.png`
- Before/after side proof:
  `tmp/realm-graphics-round-098/builder-work-side-before-after-x3.png`
- Refreshed continuity proof:
  `scripts/screenshots/sprite-audit-worst-rows.png`
- Refreshed gait proof:
  `scripts/screenshots/walk-gait-audit-worst-rows.png`

## Rejected Attempts

- `farmer/walk/up` was inspected first because it was the top gait failure.
  The row proved to be a larger old-style repaint problem, not a safe
  lower-foot tweak.
- A candidate that borrowed `farmer/carry/up` as a cleaner walking base was
  rejected because it did not walk correctly and initially exposed a row
  replacement risk during testing.
- A generic lower-band mirror on `farmer/walk/up` was rejected because it made
  the gait score worse (`83.5` to `129.1`).

## Audit Result

Before this pass, `builder/work/left` was the top continuity failure:

```text
builder/work/left score=135.2 fragments=299/2
```

After the accepted imagegen-assisted replacement:

```text
builder/work/left score=9.0 fragments=0/0
builder/work/right score=9.0 fragments=0/0
```

The side work rows no longer appear in the worst continuity audit. The
remaining top builder target is now `builder/work/down`.

## Verification

Commands run:

```sh
env PATH=/opt/homebrew/bin:$PATH node scripts/build-motion-atlases.mjs
node scripts/verify-sprite-source-contract.mjs
node scripts/audit-sprite-frames.mjs
node scripts/audit-walk-gait.mjs
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

- `builder/work/down` is now the top continuity target.
- The top gait failures remain older front/back rows:
  `farmer/walk/up`, `miner/walk/up`, `guard/walk/up`, `rancher/walk/up`, and
  `trader/walk/up`.
- Farmer walk rows need a true repaint pass; mechanical lower-foot fixes are
  not enough.
- A dedicated Storehouse sprite is still needed; the live Storehouse currently
  reuses granary art as a temporary stand-in.
