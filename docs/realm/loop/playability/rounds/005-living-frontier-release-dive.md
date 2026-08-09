# Round 005 — Living Frontier Release Dive

Date: 2026-08-08
Runtime: Realm `189`
Simulation epoch: `4`

## Product diagnosis

Realm already had more systems than its opening could explain: needs, homes,
work orders, production chains, raids, army postures, a controllable Founder,
scenarios, and story. The weak point was consequence. Foundations granted
finished-building rewards, passive settlers minted resources while the player
read the welcome, military buildings spent resources and generated troops
without an order, services worked without a staff, sleeping citizens remained
outside, and the Founder was hidden behind an undocumented key. The result was
activity without authorship.

The release thesis is now **living frontier defense**: every useful building
must be completed, staffed, and visibly used; every soldier must answer a
player-issued muster; exploration belongs to the Founder; scarce opening
resources make the first farm, house, and workforce allocation consequential.
This is the overlap between Stronghold's lived settlement and Warcraft II's
legible production-and-command loop.

## Shipped vertical slice

- Fresh realms pause behind a real **Start building** action. Peaceful Valley
  begins with `55 wood / 30 stone / 12 food / 15 gold`; healthy idle settlers
  no longer create free wood and stone. One lowest-ID unassigned citizen may
  gather one emergency food per day only below three food-days.
- Building benefits commission exactly once on completion. Foundations no
  longer grant housing, settlers, reveal, defense, or happiness. Scenario and
  mission building checks require completion and the first rewards no longer
  refill the economy.
- Completed houses derive residents from the authoritative citizen `home`
  reference. Citizens route home at night, disappear indoors only after a
  successful arrival, and remain visibly homeless when a route fails. House
  panels name residents and report who is sleeping inside.
- Production, services, walkers, happiness venues, and military drill require
  workers actually on duty. Assigned-but-sleeping citizens do not operate a
  building. Ordinary workers can leave for dusk leisure; tavern and church
  staff remain to serve them, then everyone goes home at night.
- Barracks and ranges never auto-spend or auto-train. A completed, fully
  staffed yard exposes a one-slot **Muster** order with a visible resource cost,
  exact named civilian candidate, their current workplace, drill progress,
  local company cap, instructor pause, and no automatic next unit. Enlistment
  removes that real person from population, housing, and labor immediately;
  their identity becomes the soldier. Crown-ordered workers, founders, and
  protected named characters cannot be taken. Rise of the Sword starts in Era
  II with the military chain researched and enough planks for its first yard.
- The Founder is now a permanent HUD action. Mouse, keyboard, and touch can
  enter scouting mode; only newly charted terrain counts, every 24 new tiles
  yields one gold find, and standing still cannot farm the reward. Rally flag
  placement now has a tap-first control path as well as shift-right-click.
- Rise of the Sword now has one sequential, saved **First Muster** chapter:
  finish food production, finish a house, fully staff a barracks, order three
  named defenders, chart a Founder scouting find, plant a rally flag, and
  survive the resolved first raid. The mission panel shows one current action
  and its reason, keeps only the two most recent completed beats, hides future
  beats, and suppresses the unrelated fifteen-goal checklist.
- Every staffed building and construction site has a player-authored labor
  policy: **High / Normal / Low / Off**. High priority can deterministically
  pull an eligible AI worker from a lower-value full workforce; Off releases
  automatic crew and blocks later AI claims. Assignment cooldown and a score
  threshold prevent thrash, while Crown orders are preserved and permanent
  vocations never morph as a side effect.
- `raidsSurvived` is now credited once when a battle actually resolves with
  citizens alive. Merely owning a defensive foundation when enemies spawn no
  longer awards victory or completes the chapter.
- Enemy terminal state now resolves before morale, engagement, attacks,
  movement, or civilian harm. The old ordering allowed a raider at negative HP
  to remain engaged and keep attacking for hundreds of ticks. The focused
  fixed-seed balance gate now retains all three rallied swordsmen in `32/32`
  normal first raids (minimum combined HP `193`, slowest resolution `1329`
  ticks), while a live-control raider still deals its intended damage.
- A15 replaces the entire `16`-row rancher palette derivative atomically with
  a distinct stockman, cedar-sage workwear, custom four-direction gait,
  grounded feed trough and fork, and independent carry crate. It differs from
  the shared A5 gait in all `32` walk frames and from every remaining legacy
  palette role in all `16` alpha rows. Production remains `224/224` rows,
  `1,792/1,792` frames, and zero candidates.
- Stale actor-registration offsets were regenerated from the current compiled
  rows. All `224` rows now share the intended `79±1px` source baseline; the old
  offsets had made work/action turns float by roughly `2.5–3.3` Retina pixels.
  The live animation verifier was also fixed so it samples relative to the
  current runtime tick instead of rewinding ownership timestamps.

## Verified evidence

Focused gates added to the release suite:

```sh
node scripts/verify-lived-in-buildings.mjs
node scripts/verify-first-muster.mjs
node scripts/verify-first-muster-chapter.mjs
node scripts/verify-building-workforce-priority.mjs
node scripts/verify-raid-resolution.mjs
node scripts/verify-combat-terminal-death.mjs
node scripts/verify-a15-rancher-actions.mjs
node scripts/verify-rancher-world-browser.mjs
node scripts/verify-founder-scouting.mjs
node scripts/verify-first-muster-browser.mjs
node scripts/audit-sprite-registration.mjs
node scripts/verify-anim.mjs
```

The deterministic simulation, strict save preparation, save/continue
continuity, citizen lifecycle, citizen work orders, desktop opening, phone
build mode, and navigation/traffic controls also pass individually on Realm
189. The simulation epoch is intentionally `4`; its reviewed golden fixture
records the lower-population, lower-resource economy.

## Release blockers that remain

1. **Authored animation quality.** A15 closes rancher, leaving trader,
   innkeeper, scholar, and forager as `64` literal palette-swap rows. Older
   modular roles still use a restrained front/back chronology, and enemy
   raiders still render as procedural blobs beside painted allies.
2. **Combat readability and tactics.** Terminal death and normal first-raid
   balance are now proven, but the approached edge, focus-fire, and retreat
   behavior need ordinary-player visual evidence at every difficulty. Painted
   raiders are part of this blocker, not cosmetic polish after it.
3. **Physical logistics and danger.** Hunger still consumes from a global
   wallet, storage is mostly a delivery endpoint, and raid shelter is not yet a
   real building destination. These are the next grounding systems after the
   release chapter proves the loop.
4. **After the first horn.** The chapter creates a strong first battle, but the
   next authored decision is still open-ended sandbox. Recovery needs a compact
   follow-on choice—restore food labor, bury losses, fortify the known edge, or
   press exploration—before the longer scenario becomes compelling.

Realm is materially more truthful, authored, and campaign-shaped after this
round, but the remaining enemy art, post-raid arc, and physical-logistics
blockers mean it is not yet release-ready.
