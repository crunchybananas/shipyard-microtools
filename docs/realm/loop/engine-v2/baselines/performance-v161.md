# Engine v2 Phase 0C performance baseline (realm 161)

Captured 2026-07-12 in headless Chrome on an Apple M4. The deterministic
fixture contains 66 citizens, 45 buildings, 7 soldiers, 6 walkers, 10 active
citizen paths, and no enemies. Exact samples and host/browser metadata are in
[`performance-v161.json`](performance-v161.json). These numbers are descriptive
for this machine, not a release budget.

| Measurement | Median | p95 |
| --- | ---: | ---: |
| Fixed-step core | `148.3 µs/tick` | `197.5 µs/tick` |
| Steady Canvas frame | `27.8 ms` | `29.7 ms` |
| 1,162-particle frame | `31.4 ms` | `34.0 ms` |
| Strict save serialization | `9.3 ms` | `11.8 ms` |
| Save payload | `238,979 bytes` | — |

## Renderer pass profile

| Pass | Steady median | Particle-stress median |
| --- | ---: | ---: |
| Sky/camera | `<0.1 ms` | `<0.1 ms` |
| Terrain/fog | `2.9 ms` | `4.0 ms` |
| Entities/world | `24.8 ms` | `26.6 ms` |
| Particles | `<0.1 ms` | `0.8 ms` |
| World overlays | `<0.1 ms` | `<0.1 ms` |
| Screen overlays | `<0.1 ms` | `<0.1 ms` |

The entities/world pass is the clear measured bottleneck, accounting for about
89% of the steady median. A GPU rewrite is not yet justified: first split that
pass further, remove draw-time entity bookkeeping, cull before depth sorting,
and cache static structure work. Particle stress adds less than 1 ms in the
particle loop itself; its broader frame increase also includes noisier terrain
and entity samples.

## GC and retained memory

Forced collection after fixture setup took `57.1 ms` with `3,683,504` bytes of
used JS heap. After the core/render/save/rAF workload, forced collection took
`70.1 ms` with `6,014,564` bytes used: a retained delta of `2,331,060` bytes.
DOM nodes decreased from `4,227` to `3,966`; documents remained `1` and event
listeners remained `142`. The retained delta is a baseline investigation target,
not proof of a leak from a single run.
