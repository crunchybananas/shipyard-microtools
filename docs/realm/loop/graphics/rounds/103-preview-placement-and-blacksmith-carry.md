# 103 - preview placement and blacksmith carry

## Goal

Fix the artifacts reported from the live Codex preview: citizens appearing on
top of buildings, gravestones rendering over huts, and another old-port actor
block appearing in live animation.

## Changes

- Added blocked-building-tile evacuation in `js/citizens.js`.
  - Citizens loaded or pushed onto non-road building tiles now step toward the
    nearest walkable tile and replan from there.
  - This handles paused/developed saves where a citizen can otherwise remain
    visually stuck on a roof until their normal state machine chooses a new
    target.
- Added a render-side guard in `js/render.js`.
  - Citizens whose rounded tile is currently occupied by a non-road building
    are skipped visually until the movement pass evacuates them.
- Hid death markers in `js/enhancements.js` when their rounded tile is occupied
  by a live non-road building.
  - This prevents old persistent gravestones from drawing on top of buildings
    such as the fisherman hut after the settlement changes around them.
- Replaced `blacksmith/carry` rows in
  `assets/sprites/actors/blacksmith.png` with the clean blacksmith walk base.
  Runtime `drawCarryLoad(...)` remains responsible for visible carried
  materials.
- Rebuilt `assets/sprites/actors-atlas.png` and
  `assets/sprites/ambient-atlas.png`.

## Proofs

- Live preview screenshot after placement fixes:
  `/private/tmp/realm-round103-placement-preview.png`
- Old carry vs clean base proof:
  `tmp/realm-graphics-round-103/blacksmith-carry-before-after-base-x25.png`
- Refreshed continuity proof:
  `scripts/screenshots/sprite-audit-worst-rows.png`
- Refreshed gait proof:
  `scripts/screenshots/walk-gait-audit-worst-rows.png`

## Audit Result

Before this pass, blacksmith carry still used old-port rows:

```text
blacksmith/carry/down score=119.3 fragments=303/2
blacksmith/carry/left score=119.0 fragments=305/2
```

After replacing the block with the clean blacksmith walk base:

```text
blacksmith/carry/down score=0.0 fragments=0/0
blacksmith/carry/up score=0.0 fragments=0/0
blacksmith/carry/left score=0.0 fragments=0/0
blacksmith/carry/right score=0.0 fragments=0/0
```

## Verification

Commands run:

```sh
node --check js/citizens.js
node --check js/render.js
node --check js/enhancements.js
env REALM_PORT=4922 node scripts/verify-logic.mjs
env PATH=/opt/homebrew/bin:$PATH node scripts/build-motion-atlases.mjs
node scripts/audit-sprite-frames.mjs
node scripts/audit-walk-gait.mjs
node scripts/verify-sprite-source-contract.mjs
env REALM_PORT=4923 node scripts/verify-anim.mjs
env REALM_PORT=4921 node scripts/verify.mjs --game --logic
env REALM_PORT=4924 node scripts/verify-critic.mjs
```

`verify-logic` passed `81/81`, including:

```text
delivery: produced wood with no storage/home stays carried
state=needs_delivery carrying=wood wood=0 need=true delivered=false
```

## Remaining Issues

- `blacksmith/work/down` and `blacksmith/work/up` are still old-port rows.
- The top continuity targets now start with guard `walk/down`, rancher
  walk/work rows, miner walk rows, farmer walk rows, lumber `work/up`, and
  settler walk/work rows.
- The top gait failures remain older front/back rows:
  `farmer/walk/up`, `miner/walk/up`, `guard/walk/up`, `rancher/walk/up`, and
  `trader/walk/up`.
- A dedicated Storehouse sprite is still needed; the live Storehouse currently
  reuses granary art as a temporary stand-in.
