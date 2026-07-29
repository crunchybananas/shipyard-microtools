# Engine v2 Phase 0C — worksite and mixed-traffic baseline (realm 160)

Captured 2026-07-12 from runtime module revision `160`, simulation version
`1`, and core-system-order version `3`. The machine-readable capture is
[`traffic-v160.json`](traffic-v160.json). This is replacement-engine evidence,
not a promise to preserve the current movement implementation.

## Commands

```sh
node scripts/verify-phase0c-traffic-baseline.mjs
node scripts/verify-phase0c-traffic-baseline.mjs --json
node scripts/verify-phase0c-traffic-baseline.mjs --require-correct
```

The default command exits successfully only when the realm-160 metrics below
repeat exactly, including both known defects. It runs the complete suite twice
after clean world resets and compares every captured value. `--require-correct`
intentionally exits `1` while either defect remains.

`pathCallCount` comes from before/after snapshots of a read-only counter in the
production planner, so internal and failed citizen calls are included.
`replanCount` excludes fixture-authored or first-assignment plans. A blocked
tick has movement intent at tick start and less than `0.000001` tile of actual
displacement. Identity churn counts post-initialization changes to
`jobBuilding.type`, `visualJob`, and the renderer-equivalent derived role.

## Control — legal worksite load remains stable

Two completed mines at `(20,19)` and `(20,21)` expose four legal worker slots
and share one exterior ore tile at `(21,20)`. Four citizens begin unassigned at
the cardinal approaches, then run the production job selector, target selector,
path planner, movement, arrival, and working state.

| Measurement | Realm 160 |
| --- | ---: |
| Ticks captured | `375` |
| Path calls / replans | `4 / 0` |
| Total blocked time | `0` ticks |
| All four working | tick `286` |
| Minimum separation | `1.0` tile |
| Ticks inside 0.5-tile personal space | `0` |
| Maximum workers within 1 tile of shared ore | `1` |
| Profession / visual-job / visual-role churn after assignment | `0 / 0 / 0` |

The four expected initialization transitions in each identity field are
reported separately as `assignmentTransitions`; they are not churn. Every
worker ends as profession `mine`, visual job `mine`, visual role `miner`, and
state `working`. This control catches the reported miner-to-settler identity
regression while stressing a shared work target without illegally overstaffing
a building.

## Expected defect — obstacle epoch misses a compressed segment

A citizen starts at `(10,20)` with the same compressed straight route produced
by citizen AI: waypoints `(11,20)` and `(22,20)`. At tick `20`, a blocking wall
is placed at `(15,20)` and `obstacleEpoch` advances. The wall is on the segment,
but not on either stored waypoint.

| Measurement | Realm 160 |
| --- | ---: |
| Path calls / replans | `2 / 1` |
| Epoch change to replan | `131` ticks |
| Replan tick | `151` |
| Blocked time | `1` tick |
| Route completion | tick `470` |
| Minimum obstacle-center distance | `0.52` tile |
| Profession / visual-job / visual-role churn | `0 / 0 / 0` |

The actor eventually detours and completes, but the epoch check only validates
stored waypoints. It therefore continues down the stale compressed segment for
131 ticks and replans only when the step gate reaches the new wall. Phase 3
should invalidate traversed segments or use a navigation representation whose
revision can reject the complete corridor immediately.

## Expected defect — ground actor systems overlap exactly

One citizen, soldier, service walker, and chicken traverse the same open center
from west, east, north, and south. The fixture uses the production update order
for all four systems and runs for 110 ticks, before periodic ambient spawns.

| Measurement | Realm 160 |
| --- | ---: |
| Path calls / replans | `1 / 0` |
| Total blocked time | `0` ticks |
| Minimum separation | `0.0` tile at tick `67` |
| Ticks with any pair inside 0.5 tile | `30` |
| Maximum center occupancy | `4` actors |
| Ticks with all four at center | `21` |
| Profession / visual-job / visual-role churn | `0 / 0 / 0` |

Zero blocked time is not a success: the actor centers overlap exactly because
citizens only separate from citizens, while soldiers, walkers, and animals use
independent straight-line movement. Phase 3 needs a shared ground-occupancy and
right-of-way contract across actor systems, not another category-specific
avoidance patch.

## Promotion rule

After the movement replacement lands, retain these fixtures but move each
fixed finding to a control with explicit correctness thresholds. Do not weaken
the recorded values to make a partial implementation green; the strict command
must remain red until compressed-route invalidation is immediate and mixed
ground actors obey one capacity/avoidance contract.
