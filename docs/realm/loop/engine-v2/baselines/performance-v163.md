# Engine v2 Phase 0C performance baseline (realm 163)

Captured 2026-07-12 in headless Chrome on an Apple M4. The deterministic
fixture finishes with 67 citizens, 45 buildings, 7 soldiers, 6 walkers, 11
active citizen paths, and no enemies. Exact samples and host/browser metadata
are in [`performance-v163.json`](performance-v163.json). These numbers are
descriptive for this machine, not a release budget.

| Measurement | Median | p95 |
| --- | ---: | ---: |
| Fixed-step core | `182.5 µs/tick` | `260.0 µs/tick` |
| Steady Canvas frame | `36.2 ms` | `48.1 ms` |
| 1,153-particle frame | `39.2 ms` | `43.4 ms` |
| Strict save serialization | `14.8 ms` | `14.8 ms` |
| Save payload | `241,630 bytes` | — |

## Renderer pass profile

| Pass | Steady median | Particle-stress median |
| --- | ---: | ---: |
| Sky/camera | `<0.1 ms` | `<0.1 ms` |
| Terrain/fog | `3.6 ms` | `3.9 ms` |
| Entities/world | `32.5 ms` | `34.1 ms` |
| Particles | `<0.1 ms` | `1.0 ms` |
| World overlays | `<0.1 ms` | `<0.1 ms` |
| Screen overlays | `0.1 ms` | `0.1 ms` |

The entities/world pass remains the clear measured bottleneck, accounting for
about 90% of the steady median. This capture does not justify a GPU rewrite:
the next renderer phase should split that pass further, remove draw-time actor
bookkeeping, cull before depth sorting, and cache static structure work, then
compare a measured prototype against this exact workload.

## GC and retained memory

Forced collection after fixture setup took `7.9 ms` with `3,557,764` bytes of
used JS heap. After the core/render/save/rAF workload, forced collection took
`86.2 ms` with `6,200,696` bytes used: a retained delta of `2,642,932` bytes.
DOM nodes decreased from `4,220` to `3,959`; documents remained `1` and event
listeners remained `142`. The retained delta is an investigation target, not
proof of a leak from a single run.
