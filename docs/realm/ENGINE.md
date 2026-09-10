# Realm Engine — Architecture Contract

Living document. Established 2026-07-03 after the engine investigation. Every
iteration that touches simulation code MUST follow the tier rules below and run
the applicable verification suite listed at the end of this document.

## Why this exists

Four owner goals converge on one architecture:

1. **Separation of concerns** — the sim must not know about canvas/DOM.
2. **Citizen autonomy & intelligence** — schedules, needs, job markets (pure-core work).
3. **Multiplayer** (Stardew model) — wander a shared town that keeps simulating.
4. **Native iOS/macOS port** — sim algorithms as clean input→output silos.

All four need the same thing: **a deterministic, headless simulation core with one
command funnel in and one event stream out.** Web shell today; Swift shell later
(JavaScriptCore can host the same core JS on Apple platforms before any rewrite).

```
┌──────────────── shells (one per platform) ────────────────┐
│  web today:   canvas render · DOM UI · input · WebAudio   │
│  mac/ios later: SpriteKit/Metal render · SwiftUI · touch  │
└───────────────┬───────────────────────▲───────────────────┘
        commands│                       │events (bus) + state reads
┌───────────────▼───────────────────────┴───────────────────┐
│  CORE — headless, deterministic                           │
│  coreTick(): exactly ONE tick of simulation               │
│  dispatch(cmd): the ONLY way player intent mutates state  │
│  data: BUILDINGS/TECHS/… catalogs · seeded rng() only     │
└───────────────────────────────────────────────────────────┘
```

## The two-tier simulation

**CORE tier** — deterministic, shared in multiplayer, ported natively, hashed by the
golden-master test. Citizens, soldiers, enemies, walkers, economy, tech, events,
missions, story-state checks, wonder, caravans, and the clock.

**AMBIENT/SHELL tier** — per-client, cosmetic, allowed to be nondeterministic.
Animals (deer/cows/chickens), boats, flocks, wolves, birds, all of enhancements.js,
particles *updating*, audio, rendering, UI panels. Two multiplayer clients may see
different birds; they must never see different granaries.

### Module tiers

| Tier | Modules |
|---|---|
| CORE | state, world, pathfinding-kernel, pathfinding-service, pathfinding, ground-traffic, citizens, citizen-activity, citizen-needs, citizen-work, citizen-food, citizen-shelter, citizen-navigation, citizen-traffic, citizen-route-state, soldiers, combat, military, walkers, economy, building-inventory, logistics, events, tech, trade, wonder, scenarios, first-muster, post-raid-recovery, missions, story, raid-summary, raid-planner, raid-intelligence, sim, commands, bus, log, fx, avatar, building-lifecycle, building-operation, workforce-policy, citizen-ownership, residences, death-markers |
| SHELL | main (loop/init), pathfinding-client, pathfinding-worker, render, landscape, building-surfaces, building-lighting, house-presentation, minimap, postfx, ui, input, audio, notifications (DOM half), story-ui (chronicle DOM + optional wall-clock preview), achievements, advisor, save (localStorage wrapper), save-state/save-schema (pure boundary), citizen-inspector, citizen-presentation, citizen-render-cache, founder-presentation, builder-presentation, presentation-cues, enhancements, particles (update), animals, sprite-lab, sprite-muster, sprite-source-contract, actor-registration, enemy-sprite-contract, atlas-loader |

## Core contract rules

1. **No platform APIs in core:** no `document`, `window`, `localStorage`, canvas,
   Web Audio, `requestAnimationFrame`, `setTimeout`.
2. **No wall-clock or unseeded randomness in core:** no `Date.now()`,
   `performance.now()`, `Math.random()`. Time is `G.gameTick`; randomness is the
   seeded `rng()` family from state.js. The seeded stream is for authoritative
   gameplay decisions only; cosmetic jitter uses stateless hashes. Shell/ambient
   code must NOT call `rng()` (it would desync the stream); shell uses
   `Math.random()` freely.
3. **All player intent enters via `dispatch(cmd)`** (commands.js). UI/input handlers
   never mutate sim state directly. Camera, zoom, selection, hovered tile, open
   panels, photo mode are client-local — not commands.
4. **All outward effects leave via the bus** (bus.js): `emit('sfx'|'notify'|'fx-…'|
   'victory'|…)`. Core never calls audio/toast/confetti/camera directly. Transitional
   core sites may still append plain particle descriptors before snapshot conversion, but
   they may not branch on `G.particles.length` or consume simulation RNG; their
   visual jitter must be stateless. New effects use bus events.
5. **One tick = one unit of sim time.** `coreTick()` advances everything by exactly
   one tick. `G.speed` multiplies how many ticks run per frame — NEVER appears
   inside a tick function. (The old code multiplied by `G.speed` inside functions
   that were already called `G.speed` times — quadratic day-clock, split-brain
   economy at 2×/4×. Do not reintroduce.)

## The tick

- **1× speed = 60 ticks/second, wall-clock**, via an accumulator in main.js.
  Display refresh rate must not affect sim rate (120 Hz ProMotion ran 2× before).
- `G.dayLength = 3600` ticks → one game day = 60 s at 1×.
- Hidden tabs keep simulating at full rate (timer-driven) — the town keeps working.
- Catch-up is capped (max 30 ticks/frame); beyond that, sim time is dropped.
- `fastForward(days)` runs `coreTick()` in a tight loop — no speed tricks.

## Citizen routing

- `pathfinding-kernel.js` is the sole pure A* implementation. The main thread,
  the native module Worker, and headless Node execute that same module; road
  weights, blocked-goal rings, tie-breaking, corner rules, and search budgets
  therefore cannot drift between hosts.
- Citizen route requests are authoritative only at a fixed `T+5` simulation
  tick. The browser shell sends them to `pathfinding-worker.js`; the service
  first shadow-compares Worker and synchronous bytes, then promotes the Worker
  only after an exact match. A missing, late, failed, or stale Worker response
  runs the same kernel synchronously at `T+5`, so platform scheduling cannot
  change simulation timing or paths.
- Grid snapshots are compact `Uint8Array` values keyed by `obstacleEpoch`.
  Production topology writes must increment that epoch. New/load world identity
  swaps reset the process-local service generation, and late generations are
  rejected.
- `_pathRequest` is the only durable in-flight request state. Save/Continue can
  resume at `T`, `T+1`, or any later pending tick without serializing Worker
  timing or computed results. Local collision avoidance and right-of-way remain
  deterministic main-thread traffic decisions; global A* does not model moving
  citizens as hard obstacles.
- `logistics.js` is the deterministic production-delivery broker. For physical
  wheat and flour it ranks only live, capacity-bearing destinations with a real
  route, then weighs converter role, free space, inbound reservations,
  operational staffing, workforce priority, and downstream food urgency. It
  returns immutable diagnostics; `citizens.js` owns bounded route adoption,
  partial deposit, and remainder rerouting. Food eating retains its separate
  occupancy-aware route contract.
- Physical supply currently means `food`, `wheat`, and `flour`. Windmills and
  Bakeries consume their own delivered input; Granaries and Storehouses are
  fallback grain stores; Houses never receive wheat or flour. Other resources
  still use their legacy wallet/delivery paths until a later physical-goods and
  cart slice changes them deliberately. Unroutable output stays in the producer
  buffer. A carrier orphaned from both source and destination keeps the load but
  may still eat, sleep, and shelter, then resumes the obligation when storage
  becomes reachable.

## Raid intent and siege routing

- `raid-planner.js` is a dependency-free fixed-cost planner. An explicit belief
  snapshot is its complete authority; it chooses an objective, engagement cell,
  path, and ordered breaches by minimizing
  `travel + breach + exposure + congestion - value`. Stable string/node ties,
  fixed integer costs, an `80x80` search bound, immutable rationales, and a
  compact decision fingerprint keep the result replayable and debuggable.
- `raid-intelligence.js` is the Realm adapter. It projects authoritative terrain,
  road travel, live completed structures and hit points, tower exposure,
  building-local physical loot, and prior route assignments into planner input.
  It persists a bounded save-shaped intent on each active raider and produces
  the player-facing scout sentence. An offshore spawn uses bounded water-only
  BFS to the nearest connected viable landfall before the ground assault begins;
  every stored route step is adjacent and combat never opens a permissive tunnel
  through mountain or building cells. The live adapter currently sees the
  current battlefield; campaign fog of war, stale knowledge, deception, and
  learned doctrine are future belief-layer work, not shipped behavior.
- `combat.js` executes the named route and may attack only a matching ordered
  breach or the chosen objective. Obstacle-epoch changes and external target
  loss replan deterministically; sequential assignment pressure can split
  equivalent corridors. One strategic sack, a fire-completed objective, or the
  shared physical-loot goal withdraws the whole band. Planned breaches do not
  satisfy the mission. Morale uses actual raid deaths, holds at exactly 60%, and
  breaks strictly beyond it; successful withdrawal is never a casualty. This is
  tactical route coordination, not yet formation or full campaign command AI.

## Commands (the only mutation surface)

`PLACE_BUILDING{type,x,y}` · `DEMOLISH{x,y}` · `UNDO` · `UPGRADE{x,y}` ·
`START_RESEARCH{tech}` · `TRADE{partner,res,amount}` · `SET_RALLY{x,y}|null` ·
`SET_STANCE{stance}` · `GARRISON{x,y}` · `EJECT_GARRISON{x,y}` ·
`RECRUIT_UNIT{x,y}` · `SET_WORKFORCE_PRIORITY{x,y,priority}` ·
`CHOOSE_RECOVERY_DOCTRINE{doctrine}` ·
`AVATAR_MOVE{dx,dy}` · `AVATAR_GOTO{x,y}`

Every applied command is stamped with `G.gameTick` and appended to the in-memory
command log (`G._commandLog`, capped, not saved). Same seed + same command log →
identical state. That property is CI-enforced.

## Bus events (core → shell)

`sfx{name}` · `notify{text,type,meta}` (log.js also appends to G.notificationLog —
saved state — core-side) · `chronicle{text,tag}` (data-write happens core-side in
log.js) · `raid-started{x,y}` (shell pans camera) · `season-changed{season}` ·
`mission-complete{id}` · `scenario-won{id}` · `victory{}` · `wonder-stage{stage}` ·
`realm-event{id,positive}` · `citizen-died{name,cause}` · `house-evolved{level}`

Shell subscribers live in main.js/ui.js. Headless runs have zero subscribers and
the core neither knows nor cares.

## Determinism & the golden-master gate

- Seed: hashed from kingdom name at new game (`setSeed`), persisted in saves.
- `scripts/verify-core-purity.mjs` — static gate: core files must not import shell
  files nor contain banned tokens (rule 1/2 above).
- `scripts/verify-determinism.mjs` — behavioral gate: boot one canonical graph
  headless in fresh Node processes, execute exactly 43,200 ticks with an exact
  command/checkpoint fixture, and compare strict canonical state. It proves
  same-run equality, derived-map seed sensitivity, accepted-command world
  sensitivity, story@60 cadence, shared `G` identity, and immunity to hostile
  shell particle queue evolution.
- The simulation-sensitivity hash excludes seed/provenance, command logs,
  particles, camera, and notification output. Chronicle history is included
  because echo selection reads it and can affect future story state. A separate replay
  envelope covers RNG state and accepted commands. Seed sensitivity is proven
  from the terrain map itself, never by hashing the seed field.

## Save format

- Realm is in development and uses one strict Engine v2 save epoch. Round 008 is
  promoted atomically at module revision `198`, schema `realm.engine-v2`, key
  `realm-engine-v2-save`, save version `7`. The current arrival correction uses
  simulation version `11`. These
  values are not permission for mixed-version loads. The authoritative live
  values and core order identifier come only from `runtime-contract.json`; the
  order identifier is the content address of the executable order.
- Save `7` is the clean cut for authoritative food/wheat/flour inventories, the
  required `physicalSupplyWeb` marker, physical-cargo delivery references, and
  bounded raid path/intent/breach state. Simulation `10` introduced delivery,
  local conversion, and warband decisions. Simulation `11` releases completed
  and cancelled citizen routes into their activity decisions instead of
  following stale tile-center targets. Explicit open raid flight still moves
  without a path. The changed worker timing has a separately reviewed golden;
  simulation-10 development saves are outside the current strict epoch.
- Superseded save keys and shapes are outside the runtime contract. There is no
  migration, fallback, backup, compatibility classifier, or preservation
  guarantee for development-era data. Source control is the rollback mechanism.
- `serializeGame()` returns a detached complete object graph. `prepareSave()`
  strictly validates and constructs a candidate without touching live state;
  `commitGameLoad()` atomically swaps a prepared candidate into the existing
  `G` identity. localStorage, timestamps, and toasts live in the thin shell.
- `STATE_OWNERSHIP` in `state.js` is the one ownership declaration used by state
  initialization, save preparation, and shell gates. Process-local resources
  are preserved in place; resettable presentation state and the in-memory
  command log are omitted and reset on load; durable non-authoritative state is
  persisted deliberately. Actor animation caches are presentation fields, not
  save state.
- Citizen walk/carry phase follows accepted, interpolated world displacement
  in the renderer-owned motion cache. Route intent and `_movedAt` are not
  evidence that the actor moved: crowd separation can cancel the step. Brief
  waits hold the feet; longer waits settle once onto a contact pose. The
  renderer adds neither a second road-lane offset nor a timed vertical bob.
  The Founder's loading fallback uses a WeakMap record, outside citizen IDs.
- `builder-presentation` draws the saved Blender craftsperson for settlers and
  builders, including opening construction workers whose profession remains
  settler. It reads the existing motion cache and activity/cargo projection;
  it does not assign a profession or edit the simulation. All four small action
  maps must be ready before the family replaces its legacy counterpart.
  Twelve detailed direction rows and two concurrent loads bound the shared
  cache; visible rows are retained to prevent repeated crowd decoding. The
  retained decoded image references are at most 39.375 MiB, not a total browser
  memory estimate. Both Blender characters register the physical ground at
  normalized cell `(0.5, 0.86)`. Sprite Lab's explicit older-family previews
  remain independent. Other professions still use their original families.

## Clean-cut browser and asset surface

- `house-presentation` draws the saved Blender home family: three material
  variants, four housing tiers and sixteen installed construction stages.
  Variant, tier and stage derive only from the existing coordinates, level and
  progress. Seven PNG maps plus measured chimney anchors load atomically;
  the entire painted house family remains available if any are unavailable.
  The runtime never downloads the source GLB or opens a 3D house renderer.
  Twelve 512×640 detail cells and two concurrent loads bound the shared cache
  at 32.34375 MiB of retained decoded image references, plus at most 1,167,360
  alpha-mask bytes for input. Visible cells stay resident. Contact and ground
  light precede actors; aperture emission shares the body depth and transform.
  Snow changes roof materials without changing geometry or registration.
  The fixed 112×140 destination registers its ground at `(0.5, 0.78)`.
  Picking and hover use source alpha, including tall roofs and scaffolds;
  unfinished projects also own their whole ground cell. Smoke uses the saved
  chimney position. None of these presentation choices changes routes,
  construction, occupancy or saves. See the architecture source README and
  `verify-house-source.mjs` / `verify-house-game.mjs`.
- Modern browsers are the only target. Post-processing requests WebGL2 and
  disables itself if WebGL2 is unavailable; the WebGL1 shader, buffer, and
  branching path were deleted.
- The local service-worker unregister/reload shim was deleted. Realm owns one
  revisioned native-module graph and does not keep cleanup code for a retired
  development worker.
- Consumers import APIs from their owning module. Compatibility re-exports from
  superseded module boundaries were removed rather than carried forward.
- Every live building has the strict Engine v2 building shape, and rendering
  prebuilds a complete raster sprite contract for every catalog type. Unknown
  types, missing shape fields, or incomplete sprite metadata fail loudly; there
  is no procedural-building fallback.
- Painted ground contact uses the visible alpha edge of each decoded crop,
  measured once and retained only in SHELL memory. Building and scenery contact
  shading draws in the ground pass before every actor. Building composites
  contain only the painted body and are keyed by type, housing tier and winter
  material; daylight changes do not create duplicate copies. The cache retains
  at most 64 entries. Warm rendering performs no contact pixel readbacks.
- `building-surfaces` owns the reviewed static-building source rectangles and
  winter material masks. The support art is irregular, not a uniform 128px
  grid; every runtime crop must retain its complete painted body and exclude
  neighboring sprites. Winter changes RGB only inside reviewed source surfaces,
  preserving the source alpha, crop, scale and ground registration. Two cached
  512px seasonal atlases retain 2 MiB of pixel data in total; there are no warm
  material readbacks and no source-PNG rewrite or CORE/save field. Winter roof
  geometry inherited from the removed procedural buildings is not rendered.
- `building-lighting` traces actual painted windows, glass, lanterns and furnace
  openings. Facade light uses the exact body crop/transform inside the building's
  depth entry; its soft ground spill draws before all bodies and actors. Hidden
  and unfinished buildings produce no added light. Two cached emission atlases
  and one shared ground-light stamp retain 2,113,536 pixel bytes, with no warm
  readbacks. The cyclic window fade and restrained flame variation read the
  existing clock without changing it. Lighting is not part of body-cache keys
  or saves. Generic window rectangles and house/church/forge light overlays
  after the world depth pass are removed.
- The continuous WebGL2 landscape owns roads before the actor/building depth
  pass. Adjacent arms form curved junctions with world-space gravel, soft
  verges and restrained wheel wear. The existing RGBA8 map stores terrain,
  discovery, traffic wear and footprints: alpha 0 is open ground, 64–127
  encodes road construction progress, and 255 is another building. Hidden
  neighbors cannot expose road connections or foundations. Dry surfaces reuse
  their GPU frame until the view, lighting, season or map changes; known water
  overlapping the viewport keeps its animation. Canvas recovery draws connected
  curves clipped to their owning cells, before actors. No CORE/save field or
  additional texture asset is introduced.
- `js/sprite-source-contract.js` is the one runtime and tooling sprite contract.
  Accepted row overrides must pass the painted-era and stable-body gates. The
  `WAIVED` state, mixed-era bypass, legacy role-sheet query alias, and runtime
  body-scale correction were deleted; repainting is the only release path.

## Current citizen behavior retained as replacement input

- **Schedule:** citizens read the day clock (`getDayPeriod()`): sleep at home at
  night (rest restores), work by day, leisure at dusk. Production *pulses* are
  unchanged (no economy rebalance); what changes is where bodies are and hauling
  rhythm. Food, wheat, and flour remain in building inventory, output buffers,
  or carried cargo until a valid transfer, while legacy nonphysical goods retain
  their existing banking behavior.
- **Needs:** `needs{rest,joy,faith}` + existing hunger. Walker visits now actually
  satisfy resident needs (walkers stop being cosmetic); dusk leisure visits pull
  services. Per-citizen mood contributes a bounded ±15 to realm happiness on top of
  the existing coverage formula.
- **Job market:** utility scoring replaces greedy-nearest (distance + dynamic
  priority — food crisis boosts food jobs — + hysteresis for the current job), so
  the colony visibly reallocates labor under shortage.
- **Avatar:** `G.avatar` walks the town on citizen movement infra (WASD in follow
  mode + click-to-walk, `F` toggles follow camera). Small "inspiration" aura
  (+10% production cycle rate within 5 tiles). The avatar is what a remote player
  will look like in multiplayer.

The behavior above is player-facing input to Engine v2, not a reason to retain
the current citizen implementation. Phase 1 introduces explicit identity,
profession, assignment, activity, intent, and outcome ownership; each old path
is deleted when its replacement slice passes promotion.

## Multiplayer plan (after the replacement kernel, not yet built)

Host-authoritative (the Stardew model): the host runs the core; clients send
commands + avatar intents, receive the bus event stream and periodic snapshots
(`serializeGame()` is roughly 175–240 KB in the current browser and performance
fixtures). Lockstep is NOT the plan: it inherits every determinism bug forever
and handles rejoin badly. The determinism work still matters — it makes
host/client prediction cheap and desyncs detectable (hash comparison).

## Native port plan (after the replacement kernel, not yet built)

Phase N1: Swift shell (SpriteKit or Metal renderer, SwiftUI chrome) hosting the
SAME core JS in JavaScriptCore — one sim implementation everywhere, zero deps.
Phase N2 (optional): rewrite core modules in Swift one at a time, validating each
against the JS reference with the golden-master hash on identical command logs.

## Engine v2 checkpoint

Phase 0 is closed on realm 163 by the independent Terra and Luna Session 004
review recorded in `loop/engine-v2/`. The executable evidence proves one
canonical module graph; non-vacuous deterministic execution; strict, atomic
current-epoch save/continue; core/presentation RNG isolation; one building
removal lifecycle; transition, traffic, playable-town, renderer-pass, GC, and
retained-memory baselines. Luna's final grave-history ownership veto was
withdrawn after marker creation and the newest-40 bound moved into the core and
the permanent 41-death round-trip regression passed.

Phase 1A's citizen-ownership foundation is promoted on realm 165 by the
independent Terra and Luna Session 009 review. Stable actor IDs, separate
identity/profession/assignment/activity authority, causal transitions, derived
staffing, strict current-schema persistence, immutable reference-free
presentation, and actor-ID renderer caches pass deterministic, continuation,
browser-lifecycle, UI, cache, and repeated performance gates. This closes only
the citizen ownership slice, not broader Phase 1.

Realm 166 closes the navigation replacement target: weighted A* matches its
Dijkstra oracle, reconstruction is linear, dynamic obstacles invalidate routes
immediately, spatial buckets replace all-pairs citizen separation, and
deterministic ground-traffic spacing covers citizens, soldiers, walkers, and
ambient animals. The strict navigation and traffic gates now report zero known
defects. RFC 0002's sprite work remains governed separately by its native-scale
acceptance and source-contract evidence. See `loop/engine-v2/CURRENT.md` and
`loop/engine-v2/ROADMAP.md` for current status.

Realm 198 promotes the Round 008 Living Supply Web + Thinking Warband slice. It
adds deterministic reserved production routes, local grain conversion, truthful
supply ledgers, embodied orphan-cargo recovery, coast-aware raid landfalls,
explicit raid intent, deliberate breach execution, shared band ambition, honest
casualty morale, and topology/target replanning. The new module graph, strict save
shape, reviewed simulation-10 golden, and complete 68-check affected release run
are green together; broader physical goods/carts and deeper partial-information
campaign intelligence remain later phases.

## Verification for every engine-touching loop iteration

```
node docs/realm/scripts/verify-core-purity.mjs     # static tier gate
node docs/realm/scripts/verify-module-graph.mjs    # canonical runtime identity/order
node docs/realm/scripts/verify-determinism.mjs     # golden-master hash gate
node docs/realm/scripts/verify-engine-v2-save.mjs  # strict clean-epoch schema/load
node docs/realm/scripts/verify-save-continuity.mjs # fresh-process continuation
node docs/realm/scripts/verify-building-lifecycle.mjs
node docs/realm/scripts/verify-building-use.mjs
node docs/realm/scripts/verify-physical-grain-inventory.mjs
node docs/realm/scripts/verify-logistics-broker.mjs
node docs/realm/scripts/verify-production-logistics.mjs
node docs/realm/scripts/verify-supply-ledger-browser.mjs
node docs/realm/scripts/verify-raid-planner.mjs
node docs/realm/scripts/verify-raid-route-integration.mjs
node docs/realm/scripts/verify-army-orders.mjs
node docs/realm/scripts/verify-a17-innkeeper-actions.mjs
node docs/realm/scripts/verify-a18-scholar-actions.mjs
node docs/realm/scripts/verify-a19-forager-actions.mjs
node docs/realm/scripts/verify-citizen-transition-ledger.mjs
node docs/realm/scripts/verify-first-muster-playthrough.mjs
node docs/realm/scripts/verify-pathfinding-service.mjs
node docs/realm/scripts/verify-pathfinding-worker-browser.mjs
node docs/realm/scripts/verify-navigation-crowd-baseline.mjs --require-correct
node docs/realm/scripts/verify-phase0c-traffic-baseline.mjs --require-correct
node docs/realm/scripts/verify-sprite-source-contract.mjs
node docs/realm/scripts/audit-sprite-frames.mjs
node docs/realm/scripts/audit-sprite-direction-phase.mjs
node docs/realm/scripts/audit-sprite-registration.mjs  # sprite feet-registration gate (--write after repaints)
node docs/realm/scripts/verify.mjs --logic         # existing behavior suite
node docs/realm/scripts/_play-probe.mjs            # browser smoke + screenshots
```
