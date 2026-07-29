# Engine v2 RFC 0003: Stable Actor Ownership — Phase 1A

Status: `IMPLEMENTED — PROMOTED ON REALM 165`

## Player-visible outcome

A citizen remains the same person and profession while travelling, carrying,
resting, recovering from a blocked route, helping at construction, or waiting
for another assignment. The population panel and opt-in NPC inspector explain
what the citizen is assigned to and why their activity changed without the
renderer inventing identity from transient work state.

## Problem and baseline

The realm 163 citizen shape conflates four domains:

- `name` is the only durable identity;
- `visualJob` is a sticky renderer patch standing in for profession;
- `jobBuilding` simultaneously means assignment, worker-slot ownership, and
  presentation role; and
- `state` mixes activity, navigation phase, schedule, and animation choice.

`citizens.js`, `economy.js`, `building-lifecycle.js`, `combat.js`, and `ui.js`
write those values directly. `render.js` then derives a sprite role from
`state`, `jobBuilding.buildProgress`, `jobBuilding.type`, and `visualJob`.
Consequently, a route failure, building completion, food-crisis reassignment,
construction task, or foraging activity can redraw a citizen as another
character even when no identity or profession transition occurred.

The realm 163 traffic control proves the sticky `visualJob` patch prevents
miner flicker in one legal four-worker fixture. It does not establish an owner
for profession, make transition reasons causal, or stop other temporary
activities from selecting a different actor family.

## Scope

### Retained

- One fixed-step deterministic scheduler and the current citizen state machine.
- Current job scoring, building worker capacities, schedules, needs, cargo,
  path requests, movement, and production behavior.
- Building worker capacities and all gameplay that consumes staffing counts.
- Flattened actor atlas rendering and the current sprite-role catalog.

### Replaced

- Citizen `name`, `jobBuilding`, `visualJob`, and `state`.
- Saved `building.workers` arrays and their second assignment authority.
- Direct assignment/activity writes outside the actor-ownership module.
- Renderer and UI inference of profession from a building or temporary
  activity.
- Observer-inferred transition reasons in the NPC inspector.

### Explicitly deferred

- Pure per-NPC brains, intent/outcome resolvers, actor-scoped randomness, and
  work/inventory/interaction reservations; those are Phase 1B.
- Stable ownership conversion for the avatar, soldiers, walkers, caravans,
  enemies, and animals. RFC 0003 promotes the citizen foundation only; it does
  not close Phase 1's every-actor or global snapshot-renderer gates.
- Navigation, collision, crowd capacity, and right-of-way correction; those
  remain Phase 2 promotion gates.
- Profession skills, retraining UI, relationships, memories, and schedules
  beyond the retained behavior.
- A2 art promotion. Phase 1A exposes stable appearance/profession inputs but
  does not add live skeletal rendering or a second art source.

## Data and ownership

Each citizen has the following current-runtime-only authoritative shape:

```text
actorId: positive safe integer unique among G.citizens
identity: {
  name: non-empty bounded string,
  appearanceId: stable current-art appearance key
}
profession: {
  kind: one semantic citizen profession,
  sinceTick: non-negative integer,
  reason: non-empty domain reason
}
assignment: null | {
  kind: "work",
  building: live building reference,
  duty: semantic building duty,
  purpose: "vocation" | "temporary",
  sinceTick: non-negative integer,
  reason: non-empty domain reason
}
activity: {
  kind: current citizen activity,
  sinceTick: non-negative integer,
  reason: non-empty domain reason
}
```

`G.nextActorId` owns citizen allocation. It is initialized before world
generation. An accepted `makeCitizen()` call prevalidates capacity, consumes
exactly one positive safe integer in spawn order, and never reuses it; overflow
fails before mutation. Actor IDs are deterministic, unique among `G.citizens`,
serialized, and stable through current-schema continuation. Save validation
requires `nextActorId > max(G.citizens[*].actorId)`. This citizen-scoped
namespace is intentionally not advertised as a completed every-actor identity
system.

`identity.appearanceId` has no runtime mutation API in this slice. The retained
namesake story may rename `identity.name` only through an explicit causal
identity transition; actor ID and appearance remain unchanged. A citizen begins
with profession `settler`. The first accepted assignment to a completed
vocational building may establish a profession through a fixed
building-type-to-profession map and an explicit
`profession-established` transition. Ordinary assignment release,
reassignment, construction help, foraging, cargo, sleep, hunger, and path
recovery never change it. Later career changes require a separate explicit
domain action; Phase 1A intentionally provides none.

Assignment purpose is explicit. Construction, food-crisis cover, forage, and a
player-directed mismatch are temporary. A new settler's accepted completed
workplace may be a vocation; an established professional's compatible workplace
is a vocation. Only an accepted vocation may establish profession. The job
scorer prefers compatible vocation openings for established professionals and
treats a mismatched claim as visible temporary cover rather than accidental
retraining.

The citizen-ownership module is the only writer for profession, assignment,
activity, and causal renames. The citizen's assignment is the sole authority.
A deterministic revision-invalidated index derives building staffing and
capacity views from citizens in stable actor-ID order; buildings do not save a
reciprocal worker array. Claim and release commits increment the assignment
revision before synchronous observers run, so capacity checks and production
observe the change in the same tick without an independently mutable
subscriber-owned cache.

Transition APIs own `sinceTick` and accept only fixed per-field domain reason
enums. They fully validate before mutation, commit atomically, and emit one
synchronous read-only event containing actor ID, field, immutable serializable
old/new summaries, tick, and reason. Building values are summarized by exact
integer coordinates and type, never exposed as live references. A same-value
request is a no-op: it emits nothing, resets no clock, and does not bump the
assignment revision. No browser timers, promises, or new event loops are
introduced.

Player assignment and unassignment use replayable commands addressed by a
positive-safe actor ID and exact integer building coordinates. Domain lookup
rejects missing or duplicate actors, missing or ineligible buildings, capacity
conflicts, and duplicate/no-op commands before mutation. UI array positions,
object references, and names never identify a domain actor.

Name is display data, not a random seed or collection key. Actor-scoped
deterministic hashes use world seed, actor ID, channel, and tick/beat as
appropriate. Renaming or duplicating a name cannot change decisions, tie
ordering, gait phase, or inspector ownership.

The citizen-presentation module builds one immutable ephemeral snapshot from
identity, profession, assignment summary, activity, movement, cargo, and
facing. It never writes simulation state. The renderer, population UI, hover
text, and NPC inspector consume this snapshot; they do not inspect
`G.citizens`, follow assignment building references, or reconstruct roles.
Profession selects the current flattened-atlas actor role; activity selects
action. `appearanceId` is a closed, stable current-art identity input preserved
in the snapshot, but Phase 1A does not invent appearance-specific rows before
the separately gated A2 art promotion. Unknown schema, appearance, or role fails
closed without a settler fallback. Animation
clocks, lane placement, and direction hysteresis live in a renderer-owned cache
keyed by actor ID, are purged for absent citizens and reset on new game/load,
remain bounded by the live citizen count, and never enter saves or simulation
hashes.

Normal population and hover surfaces show who the actor is, their durable
profession, their current duty/purpose, and their activity. Temporary work may
change action, held prop, or a small task badge, but never the stable
profession-to-atlas presentation role.

The save format cuts directly to this shape. `name`, `jobBuilding`,
`visualJob`, `state`, and `building.workers` are removed from the authoritative
schema. There is no migration, alias, getter, load fallback, dual schema, or
old-field adapter.

## Deterministic ordering and randomness

- Actor IDs are allocated monotonically in existing deterministic spawn order,
  with overflow rejected before mutation and no reuse after death.
- Transition functions are synchronous and preserve caller order.
- Assignment indexing and any contention tie-break use ascending actor ID, not
  array order or name.
- Same-value activity or assignment requests are no-ops and do not reset
  `sinceTick` or emit duplicate events.
- The derived assignment index is invalidated synchronously after every
  accepted claim/release, so two same-tick contenders cannot observe the same
  final slot.
- Reasons are fixed domain strings selected by the caller, never inferred from
  wall time or presentation state.
- Phase 1A adds no randomness and does not change the core system order.
- Rename and scoped citizen-array reorder tests cover actor-keyed hashes and
  animation phase only; Phase 1A does not claim arbitrary full-simulation
  reorder invariance while scheduler ordering remains in scope for Phase 1B.
- Save/reload at a midpoint must preserve IDs, structured ownership records,
  assignment building references, RNG state, and exact final simulation state.

## Failure modes and rollback

- Duplicate/non-positive actor IDs, an allocator not above every live ID,
  unknown professions/activities, malformed ownership records, stale building
  references, mismatched derived staffing, missing reasons, and future-dated
  transitions fail current-schema validation.
- Assignment helpers reject non-live or ineligible buildings, capacity
  conflicts, duplicate actors, malformed locators, and duplicate claims before
  mutation.
- Unknown presentation professions fail closed instead of falling back to
  `settler`.
- Static gates reject the removed citizen fields and renderer inference terms.
- Cutover is one source revision and one save/simulation epoch. Rollback is the
  preceding source-control commit; no dormant runtime path remains.

## Performance and libraries

No new dependency is justified. Structured fields add a small fixed amount of
state per citizen; transition listeners are synchronous and bounded. The
realm-163 Apple M4 baseline is `182.5 µs/tick` core median and `36.2 ms`
steady-render median. Phase 1A must stay within `+5%` in repeated reference-town
measurements and must not increase renderer draw count. Save size remains below
the existing 1 MiB comfort limit.

## Acceptance evidence

- Logic/unit fixtures: unique deterministic allocation, no reuse, and overflow
  rejection; exact immutable causal events;
  profession persistence across release, construction, foraging, delivery,
  sleep, path failure, and reassignment; atomic worker-index agreement; removed
  fields absent; rename and citizen-array reorder do not alter actor-scoped
  decisions or animation phase.
- Determinism/replay: exact same-seed and command-log repeat plus accepted seed
  and command sensitivity through the real core graph.
- Current-schema save/load: strict new shape, invalid-field mutations, duplicate
  IDs, allocator violations, midpoint convergence, fresh-process continuation,
  and identical staffing derived from saved actor assignment references.
- Navigation/crowd: existing realm-163 baselines remain reproducible; known
  strict correctness failures remain deliberately red.
- Browser/playable scenario: New Game; duplicate-name selection; command-driven
  vocation and temporary assignment; unassignment; construction completion;
  building destruction; mine/carry/deliver/eat/sleep/recovery; food-crisis
  cover/forage; causal namesake rename; midpoint save/reload/Continue; and no
  sprite-role morph without a profession event.
- Renderer boundary: rendering the same frozen snapshot twice leaves simulation
  state byte-identical; cache cleanup and reset remain bounded through
  spawn/death/new-game/load cycles.
- Performance/soak: repeated deterministic core, renderer-pass, snapshot
  allocation/GC, cache size, heap, and browser reference-town measurements
  against realm 163. Draw count cannot increase and representative saves remain
  below 1 MiB.

## Council reviews

### Terra

Verdict: `APPROVE WITH CONDITIONS`

Objections and conditions:

- Assignment must distinguish vocation from temporary duty. Only vocation may
  establish profession; mismatched and emergency work stays visibly temporary.
- Namesake renaming must be a causal identity transition keyed by actor ID.
- Normal hover/population presentation must distinguish identity, profession,
  assignment purpose/duty, and activity without changing the person's body.
- Derived staffing must be same-tick consistent and unsaved.
- RFC 0003 may promote only the citizen ownership foundation, not close the
  every-actor Phase 1 gate.

### Luna

Verdict: `APPROVE WITH CONDITIONS`

Objections and conditions:

- State the citizen-only scope honestly and make allocation monotonic,
  overflow-safe, and non-reusing.
- Establish profession only from a first accepted completed vocational
  workplace through a fixed map; temporary construction, forage, hauling,
  travel, emergency cover, and mismatched work never morph it.
- Delete every instance worker array and convert all staffing consumers to a
  same-tick revision-invalidated derived view.
- Make causal transitions atomic, fixed-reason, immutable, serializable, and
  post-commit; no inferred inspector reasons or live building references.
- Address commands by actor ID and building coordinates; normal UI must explain
  durable profession, temporary duty/purpose, and current activity.
- Require one immutable citizen-presentation boundary, a bounded renderer-owned
  cache, strict unknown-role failure, and renderer-purity evidence.
- Cut the schema directly, atomically bump runtime/save/simulation revisions,
  and reject every removed field without a compatibility path.
- Hold canonical promotion for deterministic, playable, save/load,
  performance, cache, and UI evidence.

## Reconciliation and final decision

All acceptance evidence passes on realm 165:

- determinism reaches tick `43,200`/day `13`; independent continuation converges
  through tick `10,800`;
- the strict current-schema save gate rejects `72/72` root wrong kinds, 66
  hostile preparations, and 14 malformed public loads;
- ownership, transition, presentation, cache, building-lifecycle, logic
  (`84/84`), core/shell isolation, and the `51/51`/207-edge module graph pass;
- native browser gates cover ownership, miner work/carry/delivery and
  failure/recovery, food crisis, needs/sleep, story rename, UI cleanup,
  death/spawn cache lifecycle, New Game, save, and Continue; and
- five same-host trials pass the unchanged budgets: `160.8 µs/tick` core,
  `36.60 ms` steady Canvas, `-24.63%` retained heap, at most `81` actor draws,
  and green `100`/`250` snapshot/cache stress.

Terra and Luna independently approve canonical Phase 1A closure in Session 009.
The fixed-step scheduler and flattened renderer remain. This decision promotes
only the citizen ownership foundation: it does not close broader Phase 1,
authorize RFC 0002 A2 art propagation, or waive the three reproduced Phase 2
movement defects.

Conversation record: [`CONVERSATIONS.md`](CONVERSATIONS.md)
