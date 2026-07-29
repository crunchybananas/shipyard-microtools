# Engine v2 Phase 0C — navigation and crowd baseline (realm 159)

Recorded 2026-07-11 from the canonical realm 159 module graph. The exact realm
159 measurements reproduced unchanged through the historical realm 160/161
checkpoints and again on the canonical realm 163 runtime on 2026-07-12. This is
a historical behavioral baseline for replacing movement; it is not evidence
that the current navigation or crowd system is correct.

The verifier reports both provenance values separately: `recordedRevision` is
the realm 159 checkpoint whose metrics are asserted, while
`reproducedRuntime.moduleRevision` is the runtime graph executing the fixture.
The latter is read from `runtime-contract.json`, so a normal run cannot imply
that the historical label is the active runtime revision.

## Commands

```sh
node scripts/verify-navigation-crowd-baseline.mjs
node scripts/verify-navigation-crowd-baseline.mjs --json
node scripts/verify-navigation-crowd-baseline.mjs --require-correct
```

The default command exits successfully only when the controls hold, the whole
suite repeats byte-for-byte after a clean state reset, and all current defects
are still reproduced at their recorded metrics. It labels those results
`EXPECTED DEFECT`; it never describes them as correctness passes. Its summary
uses the explicit form `recorded realm=159 reproduced exactly on runtime
realm=<current>`.

`--require-correct` intentionally exits non-zero while any recorded finding
remains. Use that mode as the Phase 3 correctness gate. When a defect is fixed,
the baseline assertion will fail loudly and its scenario should be promoted
from `findings` to a correctness control rather than weakening the expected
number.

## Controls

- An open 2x2 corner permits the one-step diagonal at cost `sqrt(2)`.
- The same diagonal with both orthogonal cells blocked returns no path from
  both production A* and the independent oracle. `stepEntityToward` also stays
  put, so planner and direct-mover corner policy agree.
- Two walkable 3x3 islands at `(9,10)` and `(31,10)` return unreachable from
  both searches. Opening the one-tile row between them produces a 22-step,
  cost-22 route from both searches. This prevents a null result caused by a
  malformed endpoint from masquerading as disconnected-region coverage.

## Finding 1 — weighted A* is suboptimal

Fixture:

- Start: `(10,10)`
- Goal: `(21,10)`
- Terrain: otherwise open grass
- Road destinations: `(11,11)` through `(20,11)`, inclusive
- Movement cost: road `0.5`, grass `1.0`, multiplied by `sqrt(2)` diagonally

The first road step is diagonal. Its current A* priority is approximately
`11.121`, while each node on the direct grass row keeps priority `11`. The goal
is therefore settled on the direct row before the cheaper road branch is
expanded.

| Measurement | Current result |
| --- | ---: |
| Production A* cost | `11.000000000000` |
| Dijkstra oracle cost | `6.621320343560` |
| Excess cost | `4.378679656440` |
| A* road destinations used | `0` |
| Oracle road destinations used | `10` |

The oracle route cost is exactly
`9 × 0.5 + sqrt(2) × 0.5 + sqrt(2) = 6.621320343559...`.
The oracle is implemented independently: it shares no heuristic, heap,
nearest-goal snapping, closed set, or predecessor data with production A*.

## Finding 2 — two moving citizens penetrate and cross

On open grass, two speed-`0.03` citizens receive valid production paths on the
same row:

- Traffic A: `(20,20)` to `(24,20)`
- Traffic B: `(22,20)` to `(18,20)`
- Run: 80 fixed citizen ticks at midday

| Measurement | Current result |
| --- | ---: |
| Minimum center separation | `0.028733038250` tiles |
| Minimum tick | `37` |
| Order reversal / crossing tick | `38` |
| Ticks below the current 0.5-tile personal-space radius | `20` |

The order reversal is asserted separately from the minimum distance, so a
close approach without actual pass-through cannot satisfy this finding.

## Finding 3 — opposing traffic crosses inside a one-tile doorway

A mountain wall occupies every `(20,y)` cell except the doorway at `(20,20)`.
Traffic A travels from `(18,20)` to `(22,20)` while Traffic B travels in the
opposite direction. Both begin with valid production paths through the door.

| Measurement | Current result |
| --- | ---: |
| Minimum center separation | `0.028733038250` tiles |
| Minimum tick | `71` |
| Order reversal / crossing tick | `72` |
| Ticks below 0.5-tile personal space | `20` |

This proves the open-field result is not merely a harmless visual lane offset:
opposing agents exchange order in a single-tile choke with no ownership or
right-of-way decision.

## Finding 4 — four-way intersection has no capacity control

Four speed-`0.03` citizens start two tiles west, east, north, and south of
`(20,20)` and receive valid production paths to the opposite point. The run is
bounded at 240 fixed citizen ticks.

| Measurement | Current result |
| --- | ---: |
| Minimum pair separation | `0.026924397795` tiles |
| Minimum tick / pair | `110`, West–East |
| West–East order reversal | tick `111` |
| North–South order reversal | tick `91` |
| Maximum citizens within 0.5 tile of center | `4` |
| Ticks with at least three at center | `63` |
| Ticks with all four at center | `50` |
| All four authored routes complete | tick `178` |

All routes eventually complete, which is an important scenario control, but
the center admits the entire group for 50 ticks and pair centers nearly
coincide. Completion alone must not be used as the future crowd-quality gate.

## What Phase 3 must change

The replacement gate should make weighted A* match the Dijkstra oracle for
this and randomized fixtures, preserve the diagonal/disconnected controls,
and replace pass-through with deterministic right-of-way, reservations, or a
similarly explicit local-avoidance contract. Once that lands, retain these
exact scenarios as regression controls and remove their `known-defect`
classification.
