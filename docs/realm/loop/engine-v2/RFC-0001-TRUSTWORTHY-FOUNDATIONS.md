# Engine v2 RFC 0001: Trustworthy Module, Determinism, and Save Contracts

Status: `ACCEPTED AND CLOSED — SESSION 004`

## Player-visible outcome

This slice makes later NPC work safe: the browser, Node verifiers, saves, and
continued games execute one simulation graph and prove that they reached the
state they claim to test. It also moves authoritative story cadence out of the
browser shell and into the fixed-step core; that intentional correctness change
is recorded as a new baseline rather than disguised as a refactor.

Realm is in development. This RFC intentionally starts a clean Engine v2 save
epoch and rejects old save shapes instead of preserving compatibility cruft.
The open browser build remains playable throughout.

## Problem and baseline

The existing determinism gate is a false positive. Its six root imports use
`?realm=135`, while live modules import `?realm=159`. Node creates separate
module instances. The child invokes 43,200 `coreTick()` calls through one graph
but hashes another graph that remains tick 0, day 1, population 3, and zero
buildings. Different seeds still alter the separately generated map, so the
weak control also passes.

The save contract is internally inconsistent: documentation calls version 3
current while the writer emits version 2. Loading mutates live state before a
complete schema check and omits future-affecting transient state, so a fresh-
process save/continue probe already diverges from uninterrupted simulation.

The pre-change v159 living-town baseline is recorded under
`baselines/v159/`: tick 7,200, day 3, population 19, 16 buildings, four day-cycle
captures, and complete citizen/job/resource snapshots. It measured 97 visible
role changes, 100 job changes, 582 activity-state changes, and 48 cargo changes
in two simulated days, confirming the identity problem the later phases must
solve.

## Scope

### Retained

- Native browser ES modules and static-file serving.
- Query-based runtime cache invalidation for this phase.
- Fixed timestep, seeded simulation, current system order, command log, event
  bus, gameplay catalogs, Canvas2D output, and sprite pipeline.
- Native-module cache identity, promoted transactionally from realm 159 through
  the current realm 163 checkpoint.

### Replaced

- Independently edited revision strings with one canonical runtime contract and
  transactional update/verification tooling.
- Determinism checks that compare hashes without asserting executed state.
- The legacy save key and ambiguous v2/v3 formats with one strict Engine v2 save
  epoch.
- Load paths that mutate the current world before preparation succeeds.
- Partial serialization that cannot continue exactly in a fresh process.
- WebGL1 post-processing, the retired local service-worker cleanup shim, and API
  compatibility re-exports from superseded module owners.
- Permissive building/render defaults, incomplete sprite metadata fallbacks,
  sprite waiver states, the mixed-era audit bypass, and legacy Sprite Lab query
  aliases.

### Explicitly deferred

- Stable actor/building IDs and the new NPC schema (Phase 1).
- Autonomous brains, navigation, reservations, and renderer restructuring.
- Bundler, GPU, Worker, ECS, behavior-tree, or runtime library adoption.

## Canonical runtime contract

Add one repository-owned contract:

```json
{
  "moduleRevision": 163,
  "saveSchema": "realm.engine-v2",
  "saveKey": "realm-engine-v2-save",
  "saveVersion": 3,
  "simulationVersion": 2,
  "coreSystemOrderVersion": "sha256:14621d8fcd8b94594989a9bc8b98e0e67c7f654687e80cdab8cafd940c19c014",
  "coreSystemOrder": [
    "advance-clock", "avatar", "citizens", "soldiers", "enemies",
    "towers", "projectiles", "walkers", "production", "fires",
    "research", "missions@60", "era@60", "scenario@120",
    "wonder@720", "raid-summary", "story@60"
  ]
}
```

`moduleRevision` is cache/build identity and is not persisted as save
compatibility. `saveVersion` identifies serialized shape. `simulationVersion`
changes when semantics make exact continuation intentionally incompatible.
`coreSystemOrderVersion` is the SHA-256 content address of the executable system
ordering, so an order change cannot retain the old identifier.

## Module graph design

A revision tool supports read-only `--check` and transactional `--write`. It
prepares all edits, validates the prospective graph, and only then replaces
files. A verifier scans and resolves:

- the `index.html` module entrypoint;
- all reachable static imports, re-exports, and side-effect imports;
- literal dynamic imports;
- runtime imports executed inside browser verification scripts;
- Node verifier roots that import runtime code.

Each stateful runtime file must have exactly one URL identity: one canonical
`realm` parameter, no missing, stale, duplicate, alternate, extra-query, or
fragment identity. Non-literal local imports fail closed unless narrowly
registered. Tool-only alternate identities require an allowlist proving they
cannot reach mutable runtime singletons.

Negative fixtures exercise every supported import form while proving comments
and inert strings are not rewritten. The gate also directly proves that root
imports, `dispatch()`, and `coreTick()` observe the same `G` object.

The project retains query-versioned native modules for this phase. A later RFC
may replace them with a bundled or path-versioned build graph after deployment
and benchmark evidence exists.

## Determinism design

- Make core system order executable or statically guarded; changing order
  without changing its contract version fails.
- Assert the twelve-day run reaches tick 43,200, day 13, phase 0.
- Assert exact outcomes for all scripted commands, command-log count, a real
  intermediate checkpoint, and non-empty final building state.
- Repeat same seed and commands in fresh child processes.
- Prove different-seed sensitivity through a derived map fingerprint that
  excludes the seed value.
- Prove changed-command sensitivity with an accepted command whose world-state
  consequence is asserted.
- Exclude seed, command log, applied labels, and test metadata from the
  simulation-state sensitivity hash. A separate replay-envelope hash may cover
  provenance.
- Include citizen names and all existing identity/job/state-facing data in the
  canonical snapshot; Phase 1 adds IDs, intents, claims, reservations, and
  transition reasons.
- Reject cycles, functions, non-finite values, accidental `undefined`, and
  unnormalized `Map`/`Set` values rather than letting JSON serialization erase
  them.

## Clean Engine v2 save contract

Use a new key and envelope:

```text
SAVE_KEY = "realm-engine-v2-save"
```

```json
{
  "schema": "realm.engine-v2",
  "saveVersion": 3,
  "simulationVersion": 2,
  "coreSystemOrderVersion": "sha256:14621d8fcd8b94594989a9bc8b98e0e67c7f654687e80cdab8cafd940c19c014",
  "savedAt": 0,
  "state": {}
}
```

Only exact current schema/version values are accepted. Superseded keys and
shapes have no runtime contract and receive no preservation guarantee.
`hasSave()` and Continue consult only the current key. There is no migration,
fallback, legacy probing, historical fixture matrix, or raw backup.

`STATE_OWNERSHIP` is the shared declaration for process-local root state,
resettable presentation root state, durable non-authoritative root state,
replay provenance, and resettable per-entity presentation fields. The saver,
loader, state reset, and shell gates derive their exclusions from that contract.
The in-memory command log and actor animation caches are omitted and reset on
load; neither can silently enlarge or steer the authoritative save.

Create a pure schema/preparation surface:

```text
validateSave(raw) -> typed result
prepareSave(raw) -> complete validated candidate or typed failure
serializeGame() -> detached current envelope
commitGameLoad(candidate) -> non-throwing commit
```

Validation covers required fields, exact types, finite numeric values, grid/fog
dimensions and tiles, enums, bounded collections, and reference integrity.
Preparation constructs complete linked citizens/buildings, building grid,
avatar, seed, missions, research sets, obstacle state, actors, and derived
defaults without reading or mutating live `G`. Helpers that depend on `G` are
made candidate-aware or excluded.

All validation and ordinary construction finish before the first live mutation.
The public commit is non-throwing and restores exact pre-commit references if an
assignment fails; an injected mid-commit failure proves the rollback. Invalid
data, malformed JSON, invalid references, preparation failure, or commit failure
leave the active state hash, collection identities, RNG seed, mission flags,
grid, avatar, and active realm unchanged. Continue no longer calls
`generateWorld()` before loading and does not enter the game after failure.

Focused fixtures cover golden current data, fresh writer output, wrong schema,
older/newer save or simulation version, missing/extra incompatible fields,
invalid dimensions/numbers/enums/references, duplicate exclusive references,
malformed JSON, and unchanged-world sentinels.

## Exact save/continue continuity

Continuity uses three fresh processes/module graphs:

1. uninterrupted control;
2. midpoint checkpoint producer;
3. resumed consumer continuing the same absolute-tick command schedule.

Compare immediately after load and after 1, 60, and at least 3,600 continued
ticks. The canonical future-state hash includes RNG and every value that can
affect later simulation. Current version 3 must persist or deterministically
reconstruct citizen paths/goals/watchdogs and activity state; building production
and construction timers; soldiers, enemies, projectiles, walkers, caravans and
references; obstacle and raid state; undo and scenario state; and any cosmetic
collection whose length gates seeded core random calls. Such a cosmetic/core
dependency is itself a defect: the shell-isolation gate runs hostile ambient
schedules and requires the authoritative projection to converge exactly.

Divergence remains a Phase 1 veto. The comparison is not narrowed, both branches
are not normalized through loading, and unexplained changes are not blessed into
a new hash.

## Failure modes and rollback

- A noncanonical import identity fails before browser testing.
- Invalid current-save data is hidden/rejected before world mutation.
- Save/continue divergence blocks Phase 1.
- Runtime revision edits are mechanically reversible.
- Superseded saves are intentionally not rollback artifacts; incompatible
  development builds start a new realm. Source control, not a runtime adapter,
  is the rollback mechanism.

No dependency is added. Verifier wall time may increase because it now executes
real simulation; correctness, not prior test duration, is the criterion.

## Acceptance evidence at realm 163

- The graph gate reaches all `48/48` runtime files through `173` internal edges,
  registers `108` browser-evaluated and `63` Node roots, uses no alternate
  identity allowlist, and passes deliberate invalid-identity/queryless-module
  mutations.
- Determinism reaches tick `43,200`, day `13`, nine buildings, and 13 accepted
  commands; its exact midpoint, final simulation hash, replay hash, seed and
  command controls, story cadence, and shared-`G` assertions pass.
- Strict save validation proves `71/71` root wrong-kind rejections and passes
  37 preparation rejections and 14 malformed public-load rejections. Every one
  of the 71 initialized root fields and every
  admitted actor field is paired mechanically with a validator; detached
  projectile targets are exact impact snapshots rather than arbitrary retained
  graphs. Detached preparation, injected commit rollback, ownership-derived
  presentation resets, reference reconstruction, and fresh-process continuation
  converge at `+0`, `+1`, `+60`, and `+3,600` ticks.
- A real New Game reaches day `201`; capture-specific saves are about 175 KB,
  stay below the 1 MiB comfort limit, and survive reload and
  Continue exactly. Welcome/victory UI and three paused renders do not mutate
  authoritative state, RNG, tick, save payload, or attack cues.
- A core-owned death-marker service caps grave history atomically at the newest
  40 entries. The permanent 41-death regression proves one canonical core tick
  cannot turn a valid realm into a writer-rejected realm, and the browser shell
  performs no authoritative grave maintenance.
- Full-core FX suppression and perturbation preserve the authoritative hash and
  gameplay RNG while observing 3,369 presentation descriptors. Low/high shell
  schedules and a core-only host converge while ambient populations differ.
- Manual, fire, raid, and undo removals use one building lifecycle and pass
  capacity, defense, reference, refund/story, grid, and immediate-save checks.
- The immutable v159 pre-change record and separate v160/v161 checkpoints remain
  historical evidence. The v163
  [core state](baselines/v163/state.json) reaches tick `7,200`, day `3`,
  population `19`, and 16 buildings, with 135 role, 125 job, 584 activity, and
  58 cargo transitions. Its separate
  [playable manifest](baselines/v163/playable/manifest.json) and
  dawn/day/dusk/night captures have a synchronized HUD, bounded queues, and no
  page errors.
- The transition inspector records 122 reasoned observed-current-kernel changes
  across six fields. These inferred reasons and a null reservation field are
  diagnostics only, not the Phase 1 explicit causal-transition contract.
- The [realm163 traffic record](baselines/traffic-v163.md) includes a four-miner
  control (`4` paths, zero
  replans/blocked ticks/churn) and deliberately red dynamic-obstacle and mixed-
  actor cases. The older weighted-A*, head-on, doorway, and intersection defects
  also reproduce exactly on realm 163.
- The [realm163 Apple M4 profile](baselines/performance-v163.md) records
  `182.5 µs/tick` median core cost and `36.2 ms`
  median steady rendering. The entities/world pass is the measured hotspot at
  `32.5 ms`; forced-GC and retained-heap measurements are preserved as evidence,
  not treated as proof of a leak or justification for a GPU rewrite.
- Realm163 removes rather than adapts retired browser and asset paths: WebGL1
  post-processing, the service-worker cleanup shim, compatibility API
  re-exports, permissive building shape defaults, procedural/missing building-
  sprite fallbacks, sprite waivers, the mixed-era audit bypass, and the legacy
  role-sheet query alias are absent. WebGL2 is the sole post-processing backend;
  strict building and sprite-source contracts fail closed.

## Council implementation reviews (Session 003; historical)

### Terra

Verdict: `APPROVE WITH CONDITIONS`

- Use one explicit current save epoch and hide incompatible data.
- Make every load entrypoint atomic across `G`, seed, missions, grid, avatar,
  relationships, and active realm.
- Require exact current-build fresh-process continuation and complete actor-
  facing persistence.
- Preserve the recorded living-town baseline.
- Prove one coherent graph and non-vacuous executed-state assertions.

### Luna

Verdict: `APPROVE WITH CONDITIONS`

- Prove unique resolved URL identity across runtime and browser-evaluated tests.
- Keep determinism controls independent of metadata and reject lossy canonical
  values.
- Strictly validate the clean schema/version envelope and reference integrity.
- Fully prepare candidate state before a non-throwing commit.
- Require exact fresh-process continuity including future-affecting transients.

## Reconciliation and current decision

The owner explicitly rejected backward-compatibility cruft for this development
build. Both Session 003 reviewers authorized the clean-break implementation
subject to the gates above. Those implementation blockers now pass on realm 163;
the earlier veto is historical.

In Session 004, Terra retained an `APPROVE WITH CONDITIONS` verdict and found no
new Phase 0 invariant failure. Luna initially found one final ownership defect:
the deterministic core could append 41 grave markers while a shell updater
enforced the schema's newest-40 bound. The fix moved marker creation and bounding
into one core service, removed the shell writer, and added a permanent 41-death
tick/serialize/prepare/commit regression. Luna then withdrew the veto and
authorized Phase 0 closure.

Decision: **RFC 0001 is accepted and closed. Phase 1 may begin.** Phase 1 still
must establish stable IDs, causal transitions, brain/world ownership, and
snapshot-only presentation. Navigation correctness remains a miner-slice
promotion blocker rather than a Phase 1-foundation blocker.

Conversation record: `CONVERSATIONS.md`, Session 004.
