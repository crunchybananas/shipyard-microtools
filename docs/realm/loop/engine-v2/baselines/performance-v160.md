# Engine v2 Phase 0C — performance baseline (realm 160)

Captured 2026-07-12 with `scripts/capture-engine-v2-performance.mjs` in
Headless Chrome 147 at 1440×900, DPR 1, on an Apple M4 (10 logical CPUs).
The raw measurements and full environment metadata are in
`performance-v160.json`.

This is a machine-specific diagnostic baseline, not a release budget. The
fixture itself is deterministic: 66 citizens, 45 completed buildings, seven
soldiers, six service walkers, eight active citizen paths, events disabled,
and raids deferred. Wall-clock samples naturally vary between runs.

## Measurements

| Surface | Median | p95 | Notes |
| --- | ---: | ---: | --- |
| Core simulation | 142.5 µs/tick | 200.8 µs/tick | 20 batches × 120 ticks |
| Canvas render, particles cleared | 28.4 ms | 30.5 ms | 120 synchronous renders |
| Canvas render, 1,091 particles | 34.0 ms | 37.8 ms | 60 synchronous renders |
| Browser frame interval | 33.4 ms | 50.0 ms | 120 requestAnimationFrame intervals |
| Strict save serialization | 10.2 ms | 12.7 ms | 281,711-byte JSON, five samples |

## Interpretation

The deterministic simulation is not the present bottleneck. At this town size,
one tick costs about 0.14 ms, while a steady render costs about 28 ms and cannot
hold 60 fps in this headless reference browser. Accumulated particle debris adds
another ~5.6 ms at 1,091 particles but does not explain the base cost. Rendering
therefore needs pass-level profiling, culling, static terrain/structure caching,
and removal of draw-time actor mutation before considering a new backend.

The save is moderate in size but synchronous serialization is visible work. Once
ambient/render state is fully proven non-authoritative, it should be excluded
from the current-epoch payload rather than compressed or migrated.

Re-run with:

```sh
REALM_PORT=4753 node scripts/capture-engine-v2-performance.mjs
```
