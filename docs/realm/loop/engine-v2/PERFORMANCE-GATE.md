# Engine v2 Phase 1A performance gate

`scripts/capture-engine-v2-performance.mjs` is the repeatable Phase 1A
acceptance capture required by RFC 0003. It is intentionally machine-specific:
the `+5%` comparison is valid only when the host, operating-system release,
Node version, Chromium version, viewport, DPR, logical CPU count, and reported
memory match the realm-163 Apple M4 baseline.

The command performs five independent reference-town trials in fresh browser
contexts within one Chromium process. Each trial records:

- fixed-step core batches after deterministic warmup;
- steady and particle-stress renderer passes;
- separately metered Canvas2D image draws, including an isolated citizen-only
  pass that must remain one flattened atlas draw per citizen;
- the real renderer-owned citizen cache and its live actor-ID bound;
- save serialization and byte size;
- forced-GC heap before and after the reference workload; and
- immutable presentation-snapshot allocation, cache prune/reset, and retained
  heap at 100 and 250 actors.

The 100/250 counts are not optional quick-test sizes. RFC 0002 establishes them
as Realm's actor-output stress sizes, and the Phase 1A gate reuses them to prove
the ownership/presentation boundary scales without introducing a live layered
renderer.

The gate writes `loop/engine-v2/baselines/performance-v<revision>.json` and
`.md` before returning a failed status. A red report is therefore durable
evidence rather than lost terminal output.

Run it alone because Realm browser tests share local server resources:

```sh
REALM_PORT=4753 REALM_PERF_TRIALS=5 node scripts/capture-engine-v2-performance.mjs
```

Promotion requires every gate to pass:

- all trials reproduce the exact realm-163 fixture and environment;
- core and steady-render median-of-medians are each at most `+5%`;
- the post-GC retained-heap median is at most `+5%`;
- full-frame actor-atlas draws do not exceed realm 163 and the citizen-only
  pass remains exactly one draw per citizen;
- actual and stress caches are unique, live-ID keyed, bounded, precisely
  prunable, and reset to zero;
- 100/250 actor snapshot graphs are immutable and reference-free, stay below
  the per-actor retained bound, and release within the residue bound; and
- every representative current-schema save is below 1 MiB.
