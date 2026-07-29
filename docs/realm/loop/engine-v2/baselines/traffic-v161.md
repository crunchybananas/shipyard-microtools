# Engine v2 Phase 0C traffic baseline (realm 161)

Captured 2026-07-12 from runtime revision `161`, simulation version `2`, and
content-addressed core order
`sha256:14621d8fcd8b94594989a9bc8b98e0e67c7f654687e80cdab8cafd940c19c014`.
The exact artifact is [`traffic-v161.json`](traffic-v161.json).

```sh
node scripts/verify-phase0c-traffic-baseline.mjs
node scripts/verify-phase0c-traffic-baseline.mjs --require-correct
```

The default gate repeats every measurement exactly. `--require-correct`
intentionally remains red while either recorded defect exists.

| Scenario | Paths / replans | Blocked ticks | Identity churn | Result |
| --- | ---: | ---: | ---: | --- |
| Four-miner legal worksite | `4 / 0` | `0` | `0 / 0 / 0` | control; all four working by tick `286` |
| Dynamic wall invalidation | `2 / 1` | `1` | `0 / 0 / 0` | defect; replan delayed `131` ticks |
| Mixed citizen/soldier/walker/chicken | `1 / 0` | `0` | `0 / 0 / 0` | defect; exact overlap, all four at center for `21` ticks |

The worksite control proves the current miner assignment does not itself cause
profession, visual-job, or visual-role churn after initialization. The dynamic
obstacle fixture shows that a compressed path segment is not invalidated when
`obstacleEpoch` changes. The mixed fixture shows that ground actor systems have
no shared capacity or right-of-way contract: minimum center separation is
`0.0`, despite every subsystem reporting zero blocked time.

These are replacement-engine inputs, not behavior to preserve. After unified
navigation lands, each defect must become a correctness control; the strict
gate must not be weakened to bless partial avoidance.
