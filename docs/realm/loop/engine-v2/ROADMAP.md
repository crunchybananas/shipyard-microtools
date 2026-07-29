# Realm Engine v2 Roadmap

## Strategy

Engine v2 is a controlled replacement of the citizen simulation kernel and its
leaky world boundaries, not a blank-repository rewrite. Realm retains the fixed
timestep, seeded simulation concept, command/event direction, gameplay catalogs,
sprite pipeline, current visual goals, and executable browser harnesses.

The game remains playable at each promoted checkpoint. Each slice cuts directly
to the new implementation and deletes its superseded execution path after the
gates pass. Realm is in development: rollback is source control, never a runtime
adapter, migration, dual schema, fallback, or dormant feature-flag branch.

## Phase 0A — council and baseline contract

Status: **complete**

- Persist the council charter, RFC template, roadmap, and decision record.
- Inventory authoritative state owners, direct mutation paths, import graph,
  save schema, renderer writes, navigation implementations, and existing gates.
- Record player-visible identity, pathfinding, collision, and performance
  failures as reproducible fixtures.

## Phase 0B — trustworthy safety instruments

Status: **complete on realm 163; closed by Session 004**

- One canonical module/build contract owns runtime identity, strict save epoch,
  simulation semantics, and content-addressed executable system order.
- The graph gate reaches `48/48` runtime files, 173 internal edges, 108 browser-
  evaluated roots, and 64 Node roots with no alternate-identity allowlist.
- Determinism executes the real graph to tick `43,200`/day `13`, proves shared
  state identity and exact midpoint/final/replay outcomes, and independently
  exercises seed, command, story, and hostile-presentation controls.
- Save version 3 is the only runtime save shape. Its fully initialized 71-field
  root and each actor surface have mechanically complete validator registries.
  Strict validation, detached
  candidate preparation, atomic commit/rollback, centralized state ownership,
  and fresh-process continuation at `+0/+1/+60/+3,600` ticks pass.
- Core/shell randomness is isolated. A real browser New Game, 200-day advance,
  save/reload/Continue, transient UI, paused-render, and victory gate pass.
- Manual, fire, raid, and undo building loss use one lifecycle and pass capacity,
  defense, grid, reference, refund/story, undo, and immediate-save invariants.
- Modern-browser and asset surfaces are direct cutovers: WebGL2 is the sole
  post-processing backend; the retired service-worker cleanup shim and
  compatibility API re-exports are gone; strict building shape and complete
  raster sprite contracts fail closed; sprite waivers, mixed-era bypasses,
  legacy query aliases, and runtime body-scale corrections do not exist.

The earlier stale-module, ambiguous-save, continuity, RNG, and lifecycle veto
conditions have executable evidence. Terra and Luna independently accepted that
evidence in Session 004 and authorized Phase 0 closure.

## Phase 0C — correctness and performance baselines

Status: **complete on realm 163; closed by Session 004**

- The immutable v159 navigation control now states explicitly that all four old
  defects reproduce on runtime 163: weighted-A* oracle mismatch, head-on and
  doorway pass-through, and four-way intersection over-capacity.
- The [realm163 traffic evidence](baselines/traffic-v163.md) adds a legal
  four-miner control plus deterministic
  dynamic-obstacle and mixed-ground-actor defects, with path-call, replan,
  blocked-time, identity, profession, and presentation-role measurements.
- A bounded read-only NPC ledger and `?npcdebug=1` inspector expose identity,
  profession, assignment, activity, goal, cargo, presentation role, wait age,
  reservation, and latest observed reason. Inferred reasons are diagnostics,
  not the Phase 1 causal transition model.
- The v163 [deterministic living town](baselines/v163/state.json) and separate
  [shell-driven playable town](baselines/v163/playable/manifest.json) both reach
  tick `7,200`, day `3`, population `19`, and 16 buildings. The playable record
  adds a synchronized HUD, bounded presentation queues, four day-cycle captures,
  and no page errors.
- The [realm163 Apple M4 profile](baselines/performance-v163.md) records core,
  save, renderer-pass, forced-GC, DOM/listener,
  and retained-heap evidence. Core cost is `182.5 µs/tick` median, steady
  rendering is `36.2 ms` median, and particle stress is `39.2 ms`; the
  entities/world pass alone is `32.5 ms`, the first optimization target.

Baseline gates prove repeatability, not that known movement behavior is correct.
`--require-correct` remains deliberately red for dynamic-obstacle and mixed-
actor traffic, and the older strict navigation controls remain red. Those
failures become Phase 2 promotion blockers rather than blocking the Phase 1
schema/ownership cut.

## Phase 1 — actor ownership foundations

Status: **Phase 1A citizen ownership complete on realm 165; broader actor-brain,
resolver, reservation, and RFC 0002 work remain**

- Give every actor a stable ID and separate `identity`, `profession`,
  `assignment`, `activity`, `brain`, and `presentation` data.
- Make each NPC brain own its internal memory and decision policy. Its world
  surface is narrow: immutable actor/world views and outcome inboxes enter;
  intents leave. Brains do not mutate shared jobs, inventory, buildings, or
  other actors directly.
- Add actor-scoped deterministic randomness keyed by world seed and stable ID.
- Define explicit intent and outcome types plus deterministic resolvers for job,
  work-slot, inventory, delivery, interaction, and lifecycle claims. Define the
  movement-reservation surface without claiming crowd correctness yet.
- Make identity/profession/assignment/activity transitions causal domain events
  with reasons; the renderer consumes presentation identity rather than deriving
  a different person from temporary work state.
- Introduce a read-only presentation snapshot, convert consumers directly, and
  delete the mutable-state rendering surface as each consumer moves.
- RFC 0002's isolated Actor Pose Compiler A/B/C prototype is complete.
  Layered painted 2D is the only continuing hypothesis; orthographic 3D is
  rejected for visible style and the row factory is rejected as future source
  authority. A2 must prove one body with independently swappable garment/load
  kits, semantic landmarks, target scale, seams/occlusion, live transitions,
  authoring cost, and real-renderer economics before canonical adoption.

No old actor-shape adapter or derived-role fallback survives a promoted cut.

The stable-ID/identity/profession/assignment/activity authority, direct save cut,
causal command/event surface, immutable presentation boundary, and actor-ID
render cache are promoted on realm 165 after deterministic, continuation,
browser, UI, cache, and five-trial performance evidence. Terra and Luna closed
RFC 0003 Phase 1A in Session 009. This is citizen-only and does not claim the
brain/intent/resolver or every-actor work listed above.

The CC0 side walk remains only a registration/contact fixture. A2 now has one
deterministic painted
`watchman/watch-blue/off/carry-right` reference row with explicit joint chains,
categorical near/far IDs, hand/load sockets, cargo-free art, native and 27x35
visibility gates, and Terra/Luna approval for the bounded artifact. Owner
native-scale acceptance is the pause gate before any direction, kit, attachment,
or role propagation. Runtime skeletal deformation and baked resource cargo stay
outside the accepted design; atlas adoption also requires socket-driven
front/back cargo placement and the complete four-direction carry family.

## Phase 2 — first playable vertical slice

Replace one complete miner lifecycle:

```text
claim mine slot -> travel -> work -> reserve output -> carry
-> reserve storage -> deliver -> satisfy urgent need -> sleep -> resume
```

Before promotion, this slice must correct the weighted-route oracle and the
dynamic-obstacle, pass-through, and capacity/right-of-way failures exercised by
its citizen/worksite traffic. It must demonstrate stable identity, explicit
temporary assignments, atomic resource conservation, bounded recovery, unique
claims, crowd-safe movement, save continuity, deterministic replay, and
snapshot-only presentation. The superseded miner path is deleted in the same
promotion.

## Phase 3 — unified ground movement

- Generalize the corrected weighted A* with reusable storage and connectivity
  data.
- Add authored building portals, work positions, delivery positions, and
  interaction slots.
- Add one spatial index for all collidable ground actors.
- Resolve preferred movement, short-horizon tile/edge reservations,
  deterministic yielding with wait aging, and local avoidance before commit.
- Convert citizens, soldiers, walkers, caravans, enemies, animals, and the
  avatar where shared semantics apply. Delete post-movement separation and
  actor-type locomotion as each conversion passes; add no compatibility wrappers.

## Phase 4 — broaden simulation and purify rendering

- Convert remaining professions and interactions to the intent/outcome surface.
- Make rendering a pure function of presentation snapshot, view state, and
  explicit presentation time.
- Split the measured entities/world hotspot, cull before sorting, cache static
  terrain/structure chunks, and investigate retained heap with repeated runs.
- Benchmark the purified Canvas2D backend against a feature-equivalent GPU
  spike. Adopt a new backend only for a measured win with no visual regression.
- Define a `SimulationHost` interface now; move the entire deterministic core to
  one Dedicated Worker only if later profiling justifies it.

## Promotion gates

- Determinism reaches its asserted tick/day/state, repeats exactly for the same
  seed and command log, and changes for an accepted different seed or command.
- Continuous and midpoint-save/reload runs of the one current schema converge;
  rejected data cannot partially mutate the live realm.
- Identity and profession cannot change without an explicit domain event and
  transition reason. Temporary activity never redraws an actor as a new person.
- Navigation costs match an oracle; actors do not cut corners, swap through one
  another, overfill shared space, deadlock permanently, or retry disconnected
  goals indefinitely.
- Job, inventory, output, delivery, and interaction claims remain unique and
  resource-conserving under contention and destruction.
- Rendering the same snapshot cannot change the simulation hash.
- Representative performance budgets are set from repeated measured evidence,
  then enforced for the reference settlement and browser/device profiles.
- Each promoted replacement removes the superseded implementation and its tests,
  imports, schema fields, and branches; no compatibility layer remains dormant.
