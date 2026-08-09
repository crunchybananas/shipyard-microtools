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
| CORE | state, world, pathfinding, ground-traffic, citizens, soldiers, combat, military, walkers, economy, building-inventory, events, tech, trade, wonder, scenarios, first-muster, post-raid-recovery, missions, story, raid-summary, sim, commands, bus, log, fx, avatar, building-lifecycle, building-operation, workforce-policy, citizen-ownership, residences, death-markers |
| SHELL | main (loop/init), render, minimap, postfx, ui, input, audio, notifications (DOM half), story-ui (chronicle DOM + optional wall-clock preview), achievements, advisor, save (localStorage wrapper), save-state/save-schema (pure boundary), citizen-inspector, citizen-presentation, citizen-render-cache, presentation-cues, enhancements, particles (update), animals, sprite-lab, sprite-muster, sprite-source-contract, actor-registration, enemy-sprite-contract, atlas-loader |

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

- Realm is in development and uses one strict Engine v2 save epoch. The current
  contract is module revision `191`, schema `realm.engine-v2`, key
  `realm-engine-v2-save`, save version `4`, simulation version `4`, and core
  order
  `sha256:14621d8fcd8b94594989a9bc8b98e0e67c7f654687e80cdab8cafd940c19c014`.
  These values come only from `runtime-contract.json`; the order identifier is
  the content address of the executable order.
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

## Clean-cut browser and asset surface

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
- `js/sprite-source-contract.js` is the one runtime and tooling sprite contract.
  Accepted row overrides must pass the painted-era and stable-body gates. The
  `WAIVED` state, mixed-era bypass, legacy role-sheet query alias, and runtime
  body-scale correction were deleted; repainting is the only release path.

## Current citizen behavior retained as replacement input

- **Schedule:** citizens read the day clock (`getDayPeriod()`): sleep at home at
  night (rest restores), work by day, leisure at dusk. Production *pulses* are
  unchanged (no economy rebalance); what changes is where bodies are and hauling
  rhythm (goods bank directly overnight, hauling resumes at dawn).
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

## Verification for every engine-touching loop iteration

```
node docs/realm/scripts/verify-core-purity.mjs     # static tier gate
node docs/realm/scripts/verify-module-graph.mjs    # canonical runtime identity/order
node docs/realm/scripts/verify-determinism.mjs     # golden-master hash gate
node docs/realm/scripts/verify-engine-v2-save.mjs  # strict clean-epoch schema/load
node docs/realm/scripts/verify-save-continuity.mjs # fresh-process continuation
node docs/realm/scripts/verify-building-lifecycle.mjs
node docs/realm/scripts/verify-citizen-transition-ledger.mjs
node docs/realm/scripts/verify-navigation-crowd-baseline.mjs --require-correct
node docs/realm/scripts/verify-phase0c-traffic-baseline.mjs --require-correct
node docs/realm/scripts/verify-sprite-source-contract.mjs
node docs/realm/scripts/audit-sprite-frames.mjs
node docs/realm/scripts/audit-sprite-direction-phase.mjs
node docs/realm/scripts/audit-sprite-registration.mjs  # sprite feet-registration gate (--write after repaints)
node docs/realm/scripts/verify.mjs --logic         # existing behavior suite
node docs/realm/scripts/_play-probe.mjs            # browser smoke + screenshots
```
