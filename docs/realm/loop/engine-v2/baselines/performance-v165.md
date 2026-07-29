# Engine v2 Phase 1A performance evidence (realm 165)

Verdict: **PASS**

Captured 2026-07-19T02:12:03.200Z as 5 independent browser contexts in one Chromium process on the same host. Raw per-trial profiles, memory snapshots, draw-source counts, and gate evidence are in [`performance-v165.json`](performance-v165.json).

The timing gate compares the median of each trial’s median to the realm-163 Apple M4 reference-town baseline. Timed renders run with draw instrumentation disabled. Draw counts are collected in a separate pass.

## Realm-163 budget comparison

| Gate | Realm 163 | Realm 165 | Limit | Change | Verdict |
| --- | ---: | ---: | ---: | ---: | :---: |
| Fixed-step core | 182.5 µs/tick | 160.8 µs/tick | 191.6 µs/tick | -11.87% | PASS |
| Steady Canvas render | 36.20 ms | 36.60 ms | 38.01 ms | 1.10% | PASS |
| Post-GC retained delta | 2.52 MiB | 1.90 MiB | 2.65 MiB | -24.63% | PASS |
| Actor-atlas draws/frame | 81 | 81 max | no increase | — | PASS |
| Save payload | < 1.00 MiB | 256.9 KiB max | < 1.00 MiB | — | PASS |

## Repeated reference-town trials

| Trial | Core median | Steady render median | Actor draws | Retained delta | Cache/live | Save |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 160.8 µs/tick | 36.60 ms | 81 | 2.24 MiB | 67/67 | 256.9 KiB |
| 2 | 172.5 µs/tick | 41.40 ms | 81 | 2.27 MiB | 67/67 | 256.9 KiB |
| 3 | 161.7 µs/tick | 36.60 ms | 81 | 1.90 MiB | 67/67 | 256.9 KiB |
| 4 | 140.0 µs/tick | 33.90 ms | 81 | 1.83 MiB | 67/67 | 256.9 KiB |
| 5 | 136.7 µs/tick | 30.40 ms | 81 | 1.88 MiB | 67/67 | 256.9 KiB |

Fixture identity holds setup, tick/day, and final actor counts exact. Non-gating deterministic diagnostics changed from 1153 particles / 11 active paths on realm 163 to 1135 / 9 in every realm 165 trial; full values remain in the JSON evidence.

## Snapshot/cache stress

The 100/250 actor counts are the explicit Realm actor-output stress sizes from RFC 0002. They are also used here to exercise Phase 1A’s immutable presentation and renderer-owned cache boundary.

| Actors | Snapshot median/actor | Retained/actor max | Released delta max | Structural gate |
| ---: | ---: | ---: | ---: | :---: |
| 100 | 2.00 µs | 422 B | -39.4 KiB | PASS |
| 250 | 2.00 µs | 610 B | 2.7 KiB | PASS |

Each probe proves the returned array and nested presentation records are frozen, assignment summaries do not retain building references, actor IDs are unique, cache size equals the requested actor count, pruning reaches the exact live half, and reset reaches zero.

## Gate ledger

- PASS — `repeated-same-host-trials`: At least 5 independent trials share the realm-163 host/browser fingerprint.
- PASS — `reference-town-fixture`: Every trial reproduces the exact realm-163 reference-town setup and final actor counts.
- PASS — `core-plus-five-percent`: Median-of-trial core cost is no more than +5% over realm 163.
- PASS — `steady-render-plus-five-percent`: Median-of-trial steady render cost is no more than +5% over realm 163.
- PASS — `retained-heap-plus-five-percent`: Median post-GC reference-town retained-heap delta is no more than +5% over realm 163.
- PASS — `flattened-actor-draw-count`: The reference town does not exceed realm 163 actor-atlas draws, and each citizen remains one flattened draw.
- PASS — `actual-render-cache-bound`: The real renderer cache stays unique, actor-ID keyed, and bounded by live citizens.
- PASS — `snapshot-cache-100`: 100-actor snapshots are immutable/reference-free; cache prune/reset and retained-heap bounds pass.
- PASS — `snapshot-cache-250`: 250-actor snapshots are immutable/reference-free; cache prune/reset and retained-heap bounds pass.
- PASS — `save-comfort-limit`: Every representative current-schema save remains below 1 MiB.

## Reproduce

```sh
REALM_PORT=4753 REALM_PERF_TRIALS=5 node scripts/capture-engine-v2-performance.mjs
```

This command intentionally exits non-zero after writing both reports when any gate fails.
