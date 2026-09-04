# Round 008 — Living Supply Web + Thinking Warband

Date: 2026-09-03
Promotion target: Realm `198`
Save version: `7`
Simulation epoch: `10`

## Product diagnosis

Round 007 gave food a physical address, but the production chain still crossed
the map through global wheat and flour totals. Raiders had the opposite problem:
they had targets, yet no durable explanation for why they used a gap, attacked a
wall, crossed a tower line, or crowded the same lane.

This round joins those two systems around one rule: **movement carries intent**.
Production chooses a reachable, useful destination before a carrier departs;
warbands choose a bounded route, objective, and deliberate breach before combat
executes them. Both decisions are deterministic and inspectable.

## Shipped vertical slice

- Food, wheat, and flour share one physical inventory authority. Windmills and
  Bakeries consume only input delivered to their own bins; Granaries and
  Storehouses provide fallback bulk storage. Houses remain food pantries, never
  grain depots, and the global resource totals are exact compatibility mirrors
  of stock held in live buildings.
- `logistics.js` ranks destinations using the actual reachable path, local free
  space, already-reserved inbound cargo, converter usefulness, operating crew,
  workforce priority, and downstream food urgency. Scores and stable
  building-order ties are fixed and deterministic; plans and their reason lists
  are immutable diagnostics.
- A carrier reserves its full load so a second carrier cannot overbook the same
  bin. A positive final slot is still useful: delivery accepts what fits and the
  remainder takes another bounded route. Full, incompatible, unreachable, and
  demolished targets are rejected or replanned without recursive retry loops.
- Output with no valid route remains visibly buffered at its producer. If a
  carrier loses both source and destination after pickup, the physical load is
  preserved while the person may still eat, sleep, and shelter; delivery resumes
  when compatible storage returns instead of deadlocking or starving the actor.
- The ordinary Farm → Windmill → Bakery handoff now happens through citizen
  cargo and local converter input. Food keeps its established occupancy-aware
  eating route, and legacy nonphysical deliveries keep their prior behavior.
- Windmill, Bakery, Granary, and Storehouse panels expose a Supply ledger with
  local stock/capacity, reserved inbound cargo, operating status, and buffered
  output. The ledger is responsive and does not present the realm-wide mirror as
  stock inside the selected building.
- `raid-planner.js` is a dependency-free, bounded fixed-cost planner over one
  explicit belief snapshot. It minimizes
  `travel + breach + exposure + congestion - objective value`, rejects corner
  cutting, uses stable ties, and returns an immutable path, ordered breaches,
  cost breakdown, rationale, and compact decision fingerprint.
- `raid-intelligence.js` adapts the live simulation into that contract: terrain,
  faster roads, completed destructible structures and hit points, tower exposure,
  physical loot value, and already-committed assault corridors. First Muster
  keeps its authored target contract; later raids may compare ranked objectives.
  Offshore spawns now reach the nearest connected viable coastline through a
  bounded water-only search, then follow the ground plan without tunnelling
  through mountains or buildings.
- Combat follows the planned cells, strikes only named breach structures, and
  resumes after an ordered breach. A topology change or externally removed
  objective triggers a bounded deterministic replan. Sequential raiders can
  split across equivalent corridors instead of stacking by accident.
- The warband shares one bounded ambition: one strategic sack, a fire-completed
  objective, or enough combined physical plunder sends the whole force home.
  Planned breaches do not count as victory. Morale measures actual deaths only,
  holds at exactly 60% losses, and breaks strictly above that threshold; allies
  already withdrawing with loot are never miscounted as casualties.
- One player-readable scout sentence exposes the lead raider's target, open or
  breach route, and relevant tower/corridor cue without leaking raw fixed-point
  diagnostics. Planned route and intent state have a strict save-shaped surface.

## Verified evidence

Focused gates pass on the working implementation:

```sh
node scripts/verify-physical-grain-inventory.mjs
node scripts/verify-logistics-broker.mjs
node scripts/verify-production-logistics.mjs
node scripts/verify-supply-ledger-browser.mjs
node scripts/verify-raid-planner.mjs
node scripts/verify-raid-route-integration.mjs
node scripts/verify-combat-terminal-death.mjs
node scripts/verify-first-muster-playthrough.mjs
node scripts/verify-determinism.mjs
node scripts/verify-realm.mjs --from "deterministic-core purity"
```

The fixtures prove conservation and partial transfer, no reservation overbooking,
real-route destination choice, live Farm → Windmill → Bakery delivery, truthful
desktop/mobile ledger output, healthy-wall detours, intentional weak-wall and
multi-wall breaches, tower avoidance, corridor splitting, stable plan hashes,
local obstacle-safe landfall, topology/target replanning, shared objective/loot/
fire withdrawal, strict casualty morale, first-raid balance, embodied orphan-cargo
recovery, and physical cargo-loss integrity. The complete 68-check gameplay/core/
browser promotion run is green, including the 4.57-minute First Muster journey.

Realm `198`, save `7`, and simulation epoch `10` are promoted atomically for the
changed module graph, durable physical-supply/raid-intent shape, and new simulation
decisions. The reviewed 43,200-tick golden finishes on day 13 with all 10 scripted
settlement buildings still standing; runtime identity, strict save/continue, and
the complete promotion suite are green.

## Deliberately next, not shipped

- The planner accepts a deliberately limited belief snapshot, but today's live
  adapter supplies the current authoritative battlefield. Scout knowledge,
  uncertainty, remembered defenses, deception, rival learning, and doctrines
  that persist across a campaign are the next partial-information layer.
- The living supply web covers food, wheat, and flour. Physical wood, stone,
  iron, planks, tools, market orders, dedicated carters, cart capacity, and road
  throughput remain future slices.
- Corridor pressure coordinates route assignment and the band now shares mission
  success and casualty morale. It is not yet formation AI, focus fire, a siege
  command hierarchy, or a complete hard-mode balance pass.
