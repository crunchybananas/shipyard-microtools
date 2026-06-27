# 096 - carry-delivery-builder-gait

## Goal

Continue the lumberjack-quality animation pass by tightening the wood carry
read, proving delivery truthfulness, and fixing the clearest remaining
front/back gait failure without drifting back to mixed atlas editing.

## Changes

- Reworked the runtime wood carry overlay in `js/render.js`.
  - Wood is now a larger strapped bundle of three logs.
  - The bundle has visible body straps, log ends, end shading, and tie bands.
  - Stone, iron, food, and gold still use the existing compact loads.
- Added a targeted no-storage delivery regression to `scripts/verify-logic.mjs`.
  - A lumber worker with produced wood and no valid storage/home remains in
    `needs_delivery`.
  - The carried wood stays on the worker.
  - Wood is not added to resources.
  - The UI emits `Need storage`, not `Delivered!`.
- Corrected `builder/walk/up` inside the per-role source sheet
  `assets/sprites/actors/builder.png`.
  - The edit moves only lower-leg and boot pixels.
  - The torso, hands, head, straps, and tool pouch are untouched.
  - The row stays in the newer bitmap-painted builder style.
- Rebuilt `assets/sprites/actors-atlas.png` and
  `assets/sprites/ambient-atlas.png`.

## Proofs

- Builder walk-up backup:
  `tmp/realm-graphics-round-096/builder-before-walk-up-gait.png`
- Accepted builder walk-up proof:
  `tmp/realm-graphics-round-096/builder-walk-up-cadence-v2-x6.png`
- Rejected/earlier gentler proof:
  `tmp/realm-graphics-round-096/builder-walk-up-cadence-v1-x6.png`
- Refreshed gait proof:
  `scripts/screenshots/walk-gait-audit-worst-rows.png`
- Refreshed continuity proof:
  `scripts/screenshots/sprite-audit-worst-rows.png`

## Audit Result

Before this pass, `builder/walk/up` was the top gait failure:

```text
builder/walk/up gait=131.2 signs=+0/-3 changes=0
```

After the lower-leg cadence correction:

```text
builder/walk/up gait=30.2 signs=+2/-2 changes=2 balance=4.2 span=3.0
```

The row no longer appears in the top gait-audit failures. The remaining top
gait targets are mostly older shared walk rows plus `blacksmith/walk/up`.

## Verification

Commands run:

```sh
env PATH=/opt/homebrew/bin:$PATH node scripts/build-motion-atlases.mjs
env PATH=/opt/homebrew/bin:$PATH node scripts/verify-sprite-source-contract.mjs
node scripts/audit-walk-gait.mjs
node scripts/audit-sprite-frames.mjs
node --check js/render.js
node --check scripts/verify-logic.mjs
node --check scripts/build-motion-atlases.mjs
node --check scripts/verify-sprite-source-contract.mjs
node --check scripts/audit-walk-gait.mjs
env REALM_PORT=4922 node scripts/verify-logic.mjs
```

`verify-logic` passed `81/81`, including:

```text
delivery: produced wood with no storage/home stays carried
state=needs_delivery carrying=wood wood=0 need=true delivered=false
```

## Remaining Issues

- `blacksmith/walk/up` is now the clearest newer bitmap gait target.
- Standard sprite continuity audit is still dominated by older derived/SVG-port
  rows such as builder work rows, blacksmith work rows, guard walk/down, and
  rancher/miner/farmer walk rows.
- The Codex in-app browser session accepted the local URL but did not reliably
  render/inspect the page in this run. The local preview server is available at
  `http://127.0.0.1:4711/index.html?rolesheet=round096-carry`.
