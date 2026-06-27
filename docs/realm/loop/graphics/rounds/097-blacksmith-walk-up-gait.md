# 097 - blacksmith walk-up gait

## Goal

Continue the actor animation quality pass by fixing the clearest remaining
newer-bitmap front/back gait issue without reverting to old mixed-atlas or SVG
workflows.

## Changes

- Corrected `blacksmith/walk/up` inside the per-role source sheet
  `assets/sprites/actors/blacksmith.png`.
  - The accepted edit is a lower-foot cadence pass only.
  - Torso, apron, arms, head, and overall actor scale are unchanged.
  - The row stays in the newer bitmap-painted blacksmith style.
- Rebuilt `assets/sprites/actors-atlas.png` and
  `assets/sprites/ambient-atlas.png` from the per-type source sheets.

## Proofs

- Original row:
  `tmp/realm-graphics-round-097/blacksmith-before-walk-up.png`
- Original magnified proof:
  `tmp/realm-graphics-round-097/blacksmith-before-walk-up-x4.png`
- Accepted row:
  `tmp/realm-graphics-round-097/blacksmith-accepted-walk-up.png`
- Accepted magnified proof:
  `tmp/realm-graphics-round-097/blacksmith-accepted-walk-up-x4.png`
- Rejected proofs:
  - `tmp/realm-graphics-round-097/blacksmith-after-walk-up-band54-x4.png`
  - `tmp/realm-graphics-round-097/blacksmith-after-walk-up-footfall-v1-x4.png`
  - `tmp/realm-graphics-round-097/blacksmith-after-walk-up-footfall-v3.png`
  - `tmp/realm-graphics-round-097/blacksmith-after-walk-up-footfall-v4.png`
  - `tmp/realm-graphics-round-097/blacksmith-after-walk-up-footfall-v5.png`
- Refreshed gait proof:
  `scripts/screenshots/walk-gait-audit-worst-rows.png`
- Refreshed continuity proof:
  `scripts/screenshots/sprite-audit-worst-rows.png`

## Audit Result

Before this pass, `blacksmith/walk/up` was still one of the top newer-bitmap
front/back gait failures:

```text
blacksmith/walk/up gait=79.7 signs=+2/-1 changes=1 balance=3.5 span=1.0
```

After the accepted lower-foot cadence edit:

```text
blacksmith/walk/up gait=31.4 signs=+2/-3 changes=2 balance=3.9 span=1.0
```

The row no longer appears in the top gait-audit failures. Rejected candidate
`v1` scored well numerically but visibly added oversized contact marks beneath
the boots, so it was not accepted. Gentler candidates `v3` and `v5` looked
cleaner but did not materially improve the gait score.

## Verification

Commands run:

```sh
env PATH=/opt/homebrew/bin:$PATH node scripts/build-motion-atlases.mjs
node scripts/verify-sprite-source-contract.mjs
node scripts/audit-walk-gait.mjs
node scripts/audit-sprite-frames.mjs
node --check scripts/build-motion-atlases.mjs
node --check scripts/audit-walk-gait.mjs
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

The Codex in-app browser preview was successfully used earlier in the session.
After the atlas rebuild, the browser connector could still list the Codex
browser but could not create a route for the active session, so the final
preview refresh was covered by the browser-backed animation, critic, game, and
logic verifiers instead.

## Remaining Issues

- The top gait failures are now mostly older front/back rows:
  `farmer/walk/up`, `miner/walk/up`, `guard/walk/up`, `rancher/walk/up`, and
  `trader/walk/up`.
- Standard sprite continuity audit remains dominated by older derived/SVG-port
  rows such as builder work rows, blacksmith work rows, guard walk/down, and
  rancher/miner/farmer walk rows.
- A dedicated Storehouse sprite is still needed; the live Storehouse currently
  reuses granary art as a temporary stand-in.
