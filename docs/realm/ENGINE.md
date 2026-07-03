# Realm Engine — Architecture Contract

Living document. Established 2026-07-03 after the engine investigation. Every loop
iteration that touches simulation code MUST follow the tier rules below and run the
engine gates (`verify-core-purity.mjs`, `verify-determinism.mjs`) before committing.

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
missions-check, wonder, caravans, the clock.

**AMBIENT/SHELL tier** — per-client, cosmetic, allowed to be nondeterministic.
Animals (deer/sheep/chickens), boats, flocks, wolves, birds, all of enhancements.js,
particles *updating*, audio, rendering, UI panels. Two multiplayer clients may see
different birds; they must never see different granaries.

### Module tiers

| Tier | Modules |
|---|---|
| CORE | state, world, pathfinding, citizens, soldiers, combat, walkers, economy, events, tech, trade, wonder, scenarios, missions (check half), sim, commands, bus, log, fx, avatar |
| SHELL | main (loop/init), render, minimap, postfx, ui, input, audio, notifications (DOM half), story (beats run shell-side; `chronicle()` data-write is core-safe in log.js), achievements, advisor, save (localStorage wrapper; serialize/apply are core-safe), enhancements, particles (update), animals, sprite-lab, sprite-muster, atlas-loader |

## Core contract rules

1. **No platform APIs in core:** no `document`, `window`, `localStorage`, canvas,
   Web Audio, `requestAnimationFrame`, `setTimeout`.
2. **No wall-clock or unseeded randomness in core:** no `Date.now()`,
   `performance.now()`, `Math.random()`. Time is `G.gameTick`; randomness is the
   seeded `rng()` family from state.js. Shell/ambient code must NOT call `rng()`
   (it would desync the stream); shell uses `Math.random()` freely.
3. **All player intent enters via `dispatch(cmd)`** (commands.js). UI/input handlers
   never mutate sim state directly. Camera, zoom, selection, hovered tile, open
   panels, photo mode are client-local — not commands.
4. **All outward effects leave via the bus** (bus.js): `emit('sfx'|'notify'|'fx-…'|
   'victory'|…)`. Core never calls audio/toast/confetti/camera directly.
   Pushing plain-data particles to `G.particles` from core IS allowed (it is state,
   headless-safe, excluded from the determinism hash) — but use `rng()` for jitter.
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
- `scripts/verify-determinism.mjs` — behavioral gate: boot the core headless in
  Node (no DOM), run N ticks with a scripted command log, hash the sim-relevant
  state (map, resources, buildings, citizens, soldiers, enemies, tech, era, wonder,
  clock, seed). Two runs with the same seed must produce identical hashes; a
  different seed must produce a different hash.
- Hash EXCLUDES: particles, camera, ambient arrays (animals/birds/…), chronicle
  text, notification log — cosmetic or shell-owned.

## Save format

- Key `realm-save-v2` (unchanged), version field bumped to `v:3`.
- v3 adds: citizen `needs` + `homeIdx`, `G.avatar`. Loader accepts v2 with defaults.
- `serializeGame()`/`applySave(obj)` are pure (core-safe); localStorage + toasts
  live in the shell wrapper.

## Citizen intelligence roadmap (Phase 3)

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

## Multiplayer plan (post-Phase 3, not yet built)

Host-authoritative (the Stardew model): the host runs the core; clients send
commands + avatar intents, receive the bus event stream and periodic snapshots
(`serializeGame()` is ~50–200 KB JSON — join/resync is trivial). Lockstep is NOT
the plan: it inherits every determinism bug forever and handles rejoin badly. The
determinism work still matters — it makes host/client prediction cheap and desyncs
detectable (hash comparison).

## Native port plan (post-Phase 3, not yet built)

Phase N1: Swift shell (SpriteKit or Metal renderer, SwiftUI chrome) hosting the
SAME core JS in JavaScriptCore — one sim implementation everywhere, zero deps.
Phase N2 (optional): rewrite core modules in Swift one at a time, validating each
against the JS reference with the golden-master hash on identical command logs.

## Phase checklist

### Phase 0 — determinism hygiene ✅ (2026-07-03)
- [x] Fixed-timestep accumulator (60 ticks/s at 1×; refresh-rate independent)
- [x] `coreTick()` = exactly one tick; all `G.speed` factors stripped from tick fns
- [x] `Math.random` → `rng()`/hash in CORE files (raids, fires, events, soldiers,
      combat skirt, citizen heartbeat, army targets, story `pick()`)
- [x] `fastForward` rewritten as a plain tick loop

### Phase 1 — command funnel ✅ (2026-07-03)
- [x] commands.js: typed handlers, validation, tick-stamped command log
- [x] input.js / ui.js / main.js rewired through `dispatch()`
- [x] Buildings addressed by coordinates in commands (never object refs)

### Phase 2 — core extraction ✅ (2026-07-03)
- [x] bus.js (emit/on) + log.js (announce/chronicle data-writes core-side)
- [x] sim.js: `coreTick()` owns the core system order; ambient updates move to the
      shell frame loop (same cadence, out of core)
- [x] Core files import no shell files (audio/particles-spawn exempted per rule 4;
      render/notifications/story imports severed; confetti+prestige-localStorage
      moved shell-side; missions renderer moved to ui.js)
- [x] save.js split: pure serialize/apply + shell wrapper
- [x] scripts/verify-core-purity.mjs (static gate — 20 core files)
- [x] scripts/verify-determinism.mjs (golden-master gate, headless Node; the
      scenario scripts 11 build/research commands + 2 founder journeys over 12
      game-days and demands identical sha256 state hashes)

### Phase 3 — citizen intelligence & avatar ✅ (2026-07-03)
- [x] 3a schedule: homes, sleep/wake, dawn rush (+ raid-aware waking; walkers
      rest at night)
- [x] 3b needs: joy/faith + rest, real walker services, dusk leisure trips,
      bounded ±15 mood → happiness (own row in the breakdown panel)
- [x] 3c job market: utility scoring (food-crisis priority, wonder pull,
      hysteresis) + famine reallocation into food jobs/foraging
- [x] 3d avatar: the Founder — command-driven walking (WASD/click), fog
      scouting, inspiration aura, follow camera (F), pennant + name plate,
      save v3

### Later (needs owner input before starting)
- [ ] Multiplayer transport spike (host-auth over WebSocket, 2 browsers)
- [ ] Swift shell spike (JavaScriptCore hosting core)
- [ ] Needs-driven building expansion (bathhouse/theater/guildhall become real
      service sinks once needs exist)

## Verification for every engine-touching loop iteration

```
node docs/realm/scripts/verify-core-purity.mjs     # static tier gate
node docs/realm/scripts/verify-determinism.mjs     # golden-master hash gate
node docs/realm/scripts/verify.mjs --logic         # existing behavior suite
node docs/realm/scripts/_play-probe.mjs            # browser smoke + screenshots
```
