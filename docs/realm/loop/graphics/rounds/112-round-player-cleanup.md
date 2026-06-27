# Round 112 - Round Player Cleanup

## Goal

Continue the actor-sprite cleanup after the opening settler pass by removing
the broad cohort of round, hooded, samey BASE citizens that still appeared
beside the newer painted terrain, buildings, and locked settler rows.

## Starting Point

- `settler/idle` and `settler/walk` were locked frontier rows, but
  `settler/work` and `settler/carry` still popped back to inherited art.
- Farmer, rancher, miner, stonecutter, fisher, trader, innkeeper, scholar,
  guard, builder, blacksmith, and forager still had old round idle/walk/work
  or carry rows in at least one action block.
- Actor Muster made the mismatch obvious: detailed rows sat next to squat
  circular placeholder citizens.

## Changes

- Expanded `scripts/paint-cohesive-legacy-actors.mjs` from detached-limb cleanup
  into a broader blobby-base repaint pass.
- Repainted 39 role/action blocks across 13 per-role actor sheets:
  - blacksmith idle
  - builder idle
  - farmer idle/walk
  - fisher idle/walk/work/carry
  - forager idle/walk/work/carry
  - guard idle/walk
  - innkeeper idle/walk/work/carry
  - miner idle/walk/carry
  - rancher idle/walk/work/carry
  - scholar idle/walk/work/carry
  - settler work/carry source fallback
  - stonecutter idle/walk/work/carry
  - trader idle/walk/work/carry
- Replaced the old circular body language with slimmer tapered torsos, smaller
  heads, stronger belts/necklines, visible boots, and role-specific headgear or
  handheld props.
- Added `scripts/refit-settler-frontier-rows.mjs`, which derives the remaining
  `settler/work/*` and `settler/carry/*` rows from the locked frontier settler
  idle/walk strips.
- Accepted all eight settler work/carry rows as canonical row overrides with no
  warning waivers. The settler family now has 16/16 action-direction rows locked.
- Rebuilt compiled actor sheets and the runtime actor atlas.

## Results

- Accepted row overrides increased from `13` to `21`.
- Actor Muster now shows the default settler identity across idle, walk, work,
  and carry instead of switching art styles mid-task.
- The broad round-player families no longer dominate the muster; remaining
  BASE rows read as slimmer role silhouettes rather than circular hooded
  placeholders.
- The top continuity audit is again dominated by deliberate tool rows:
  `miner/work/left`, `miner/work/right`, `lumber/work/up`,
  `lumber/work/down`, and guard spear work.
- `scripts/verify-all-sprite-maps.mjs` reported `224/224` rows,
  `1,792/1,792` frames, no blanks, no low-variety rows, no mapping failures,
  and row digest `34a267348715`.

## Proofs

- `tmp/realm-graphics-round-112/cohesive-legacy-proof.png`
- `tmp/realm-graphics-round-112/settler-frontier-rows/settler-frontier-work-carry-proof.png`
- `assets/sprites/actor-rows/proofs/settler-work-*-x4.png`
- `assets/sprites/actor-rows/proofs/settler-carry-*-x4.png`
- `scripts/screenshots/actor-muster-01.png`
- `scripts/screenshots/actor-muster-02.png`
- `scripts/screenshots/anim-live-actors-close.png`

## Verification

```sh
node --check scripts/paint-cohesive-legacy-actors.mjs scripts/refit-settler-frontier-rows.mjs
node scripts/build-motion-atlases.mjs
node scripts/verify-sprite-source-contract.mjs
scripts/sprite-row verify
node scripts/audit-sprite-frames.mjs
node scripts/audit-walk-gait.mjs
node scripts/verify-all-sprite-maps.mjs
node scripts/verify-anim.mjs
node scripts/verify.mjs --game --logic
```

Final results:

- accepted row overrides: `21`
- exhaustive rows: `224/224`
- exhaustive frames: `1,792/1,792`
- blanks, low-variety rows, address/mapping/page errors: `0`
- animation moving pairs: `7/7`
- game/logic page errors: `0`

## Remaining Issues

- `miner/work/left` and `miner/work/right` remain protected WAIVED repaint debt
  with body/anchor drift from the large pickaxe motion.
- `lumber/work/up` and `lumber/work/down` remain high-score chopping rows.
- Farmer work up/down still carry visible soil/tool particles and can receive a
  true repaint later.
- The broad procedural base cleanup is a quality floor, not the final art
  target; future passes should replace high-visibility roles with locked
  painted rows one action family at a time.

## Next

The next best target is still a true row-factory repaint of
`miner/work/left` and `miner/work/right`, followed by lumber chopping rows, now
that the common round-player cohort is no longer distracting from those
high-motion problems.
