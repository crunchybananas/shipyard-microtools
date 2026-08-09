# Current Playability And Cleanup Handoff

Date updated: 2026-08-08

Current live checkpoint: Realm `191` / simulation epoch `4`

Production graphics follow the atomic workflow in
[`../graphics/PAUSE_AND_RESUME.md`](../graphics/PAUSE_AND_RESUME.md). The active
focus is gameplay feel, responsive UX, movement correctness, and removal of old
or surprising behavior that no longer fits the game.

## Fixed Architecture

- The game remains a two-dimensional Canvas2D settlement renderer with painted
  raster atlases. WebGL2 is fullscreen post-processing only.
- There is no active Three.js/3D world path. The old live diorama renderer was
  deleted in graphics round 002; historical 3D notes are not a roadmap.
- Do not reopen renderer exploration during ordinary gameplay or cleanup work.
  The later engine roadmap allows a GPU comparison only after renderer purity
  and a feature-equivalent measured benchmark.

## Completed Cleanup: Hot-Air Balloon Retirement

Round 001 removed the legacy procedural hot-air balloon completely. The live
updater, balloon renderer, screen-space shadow renderer, imports, calls, state
initializer, and save allowlist entry are gone.

The save decision is an intentional clean cut with no compatibility slot and
no save-version bump. Balloon state was resettable presentation state and was
already excluded from serialized saves, so valid Realm 184 saves remain valid
while no current New Game, Save, Load, or Continue surface carries the field.

The browser gate now fails if any of the five live source surfaces retain the
retired token. It also runs ordinary daytime play at `4x` through the old
tick-1200 forced-spawn point, then proves the state is absent from New Game,
Save, reload, and Continue. The full 47-check Realm 185 suite passes. See
[`rounds/001-balloon-retirement.md`](rounds/001-balloon-retirement.md).

## Completed Responsive Slice: Phone Build Mode

Round 002 established a fresh desktop, tablet, and `390x844` evidence set, then
fixed the first coherent surface: touch build-mode lifecycle and gesture
arbitration. A selected build now exposes a reachable 44px-or-larger Cancel
control. A tap places, a one-finger drag pans without placing, and pinch zoom
does not place or leave the camera dragging. Ordinary building selection still
works after Cancel. The focused phone gate is part of the Realm release suite.
See [`rounds/002-responsive-build-mode.md`](rounds/002-responsive-build-mode.md).

## Completed Gameplay-AI Slice: Citizen Work Orders

Round 003 turns the hidden citizen-assignment command into an ordinary gameplay
surface. The population roster now distinguishes AI assignments from Crown
orders, lets the player move an employed citizen directly to any open workplace,
and makes Return to AI explicit. Building and citizen panels expose who controls
the current job.

Automatic staffing remains the default and still weighs travel distance, food
pressure, construction, and vocation fit. A Crown order is not silently erased
by that utility scorer or by food-crisis reallocation; the citizen still handles
food, sleep, cargo, danger, and bounded path recovery. Orders survive Save and
Continue through the existing assignment provenance field, so the save schema
and versions do not change. See
[`rounds/003-citizen-work-orders.md`](rounds/003-citizen-work-orders.md).

## Completed Opening-Flow Slice: Truthful Farm Build State

Round 004 repairs the first playable instruction. The tutorial's Farm target
used the same gold halo as an active build, so it looked selected while the
authoritative build selection was empty and a grass click did nothing. Tutorial
targets now use a teal dashed **Select** ribbon; actual build mode remains the
gold lifted card, carries `aria-pressed`, and exposes Cancel.

The welcome no longer advances on a hidden timer while claiming to await a
click. A deliberate **Start building** action begins the tutorial, Cancel and
Escape return an unplaced Farm to the selection instruction, the same number
hotkey no longer silently exits build mode, and in-page New Game resets the
tutorial shell. The fading title is immediately inert so it cannot swallow a
fast first phone tap. See
[`rounds/004-opening-build-truth.md`](rounds/004-opening-build-truth.md).

## Completed Living-Frontier Slice: First Muster And Labor Policy

Round 005 grounds the opening economy and turns the military scenario into a
single authored chapter. Buildings grant benefits only after completion and
while actually staffed; houses name their residents and hide sleepers only
after arrival; services require on-duty people; and idle settlers no longer
mint shadow resources. Barracks expose explicit named muster orders, the
Founder has visible scouting controls and discoveries, and raid survival is
credited only when the battle resolves.

Rise of the Sword now advances through seven saved beats from food source to
first-raid survival. Its mission card exposes one direct action at a time and
hides the old side-goal wall. Building panels expose High, Normal, Low, and Off
labor priorities with deterministic AI reassignment, cooldowns, Crown-order
protection, stable citizen vocations, strict save validation, and desktop/touch
coverage. See
[`rounds/005-living-frontier-release-dive.md`](rounds/005-living-frontier-release-dive.md).

Every muster also names the exact eligible civilian before the order. That
person leaves population, home occupancy, and labor, then emerges from drill as
the same named soldier. Candidate order is deterministic; Crown workers and
protected story identities are never consumed. The real four-person post-House
opening can raise three defenders while retaining one active instructor.

## Completed After-The-Horn Slice: Shelter, Recovery, And Painted Raiders

Round 006 makes the first battle physically and narratively consequential.
Residents now run to their own completed House portal when a raid begins,
remain vulnerable until they arrive, disappear indoors only after arrival, and
return to ordinary life when the danger clears. Homeless citizens and blocked
routes remain visible failures instead of becoming invulnerable flags.

The resolved First Muster now opens one exclusive doctrine choice: **Rebuild**
an additional operational food workplace, **Fortify** the charted approach, or
**Explore** for another Founder discovery. The chosen objective snapshots a
same-tick baseline so old assets cannot auto-complete it, persists through
save/continue, and gates military victory. The first military raid cannot spawn
before the rally beat, its HUD countdown stays hidden until then, and its
charted direction remains the actual attack direction.

Enemy raiders are no longer procedural canvas bodies. Three painted identities
carry axe, spear, and club silhouettes across idle, walk, attack, and retreat:
`48` rows / `384` frames at four exact runtime tiers. Desktop and phone mission
controls, immediate Era II saves, shelter selection parity, deterministic
combat, and the complete asset/runtime graph are release-gated. See
[`rounds/006-after-the-first-horn.md`](rounds/006-after-the-first-horn.md).

## Completed Physical-Logistics Slice: Food Has An Address

Round 007 removes the last abstract-food contradiction from the opening loop.
Every fresh realm now begins with a free completed Founder Stockpile holding
exactly the scenario's starting rations. Completed Houses, Granaries, and
Storehouses own bounded local food inventories, while the HUD total is only an
exact compatibility mirror of those live stores.

Citizens leave safe work, walk to a reachable public store or their own House
pantry, consume one ration only after arrival, and return without losing Crown
orders. Empty or unreachable stores produce a visible bounded shortage state.
Food harvests, foraging, partial deliveries, mission rewards, imports,
recruitment, research, Wonder bills, demolition, and raider loot all conserve
through the same authority. Raiders now steal only from the building they are
physically striking.

Farms provide one direct ration plus bulk wheat, so the opening instruction is
truthful without erasing the windmill/bakery chain. The Founder Stockpile never
counts as a player-built tutorial, achievement, story, or victory structure.
See [`rounds/007-food-has-an-address.md`](rounds/007-food-has-an-address.md).

The trader is also atomically replaced as A16: a distinct traveling factor with
a madder coat, teal sash, merchant cap, brass balance, ledger counter, shared
cargo crate, and custom four-direction brisk gait across all `16` rows / `128`
frames. Innkeeper, scholar, and forager are the remaining palette-derived
families.

## Ranked Work Now

1. **Deepen combat tactics and readability.** Normal First Muster balance and
   terminal death order are proven. Add ordinary-player evidence for hard mode,
   focus-fire, formation/stance response, and retreat clarity before broad
   tuning. The charted edge and three weapon silhouettes now provide the visual
   foundation for that work.
2. **Write the campaign's second act.** The recovery doctrine closes the first
   battle but is still one objective. Make its completion alter the next
   pressure, unlock, or rival response so Rebuild, Fortify, and Explore begin
   meaningfully different settlement stories.
3. **Replace the remaining legacy actor families.** Innkeeper, scholar, and
   forager still share palette-derived geometry. Continue only through complete
   atomic A17+ families using the graphics handoff; do not resume partial-row
   repair.
4. **Responsive UX continuation.** Remove the invisible advisor hit target that
   can block phone title actions after the tip fades. Then restore ordinary
   keyboard focus by retiring the global Tab interception, correct the Research
   and completion tutorial contracts, make tablet HUD overflow legible, resolve
   phone minimap/build-bar overlap, and raise the remaining undersized touch
   targets. Keep shipping one reproduced surface at a time from the Round 002
   queue.
5. **Crowd-safe NPC movement.** Reproduce remaining player-visible miner or
   town-crowd failures before changing the kernel. On Realm 188, both strict
   navigation gates are green with zero known fixture defects: weighted route
   cost, dynamic-obstacle invalidation, head-on/doorway separation,
   intersection capacity, and mixed-actor separation all pass. Extend the
   deterministic fixtures for any new live failure; cosmetic separation is
   not a substitute for a movement invariant.
6. **Gameplay-friction playthrough.** Run a fresh peaceful settlement through
   the tutorial, first production chain, housing growth, first research, and
   save/continue. Rank moments where the player lacks feedback or where a click
   does not produce an immediate, legible response.
7. **Measured render responsiveness.** Re-profile the entities/world pass at a
   living-town workload. Cull before sorting and cache static work only from
   measurements; retain Canvas2D unless a feature-equivalent alternative wins.
8. **Dead-code and surprise audit.** Trace ambient systems, old feature flags,
   stale imports/exports, unreachable UI, redundant state, and archived
   renderer assumptions. Remove one proven-dead slice at a time with tests.

## Existing Evidence To Reuse

```sh
node scripts/verify-navigation-crowd-baseline.mjs
node scripts/verify-phase0c-traffic-baseline.mjs
node scripts/verify-browser-save-shell.mjs
node scripts/verify-engine-v2-citizen-lifecycle-browser.mjs
node scripts/runtime-revision.mjs --check
node scripts/verify-realm.mjs
```

The traffic fixtures remain the promotion gates for movement changes. Their
strict modes both pass on Realm 191, while the Realm 165 measurements remain
the last formal performance baseline. Read `../engine-v2/CURRENT.md` before
changing ownership, save, or navigation surfaces.

## Definition Of Progress

A cleanup round counts only when a player-visible problem is reproduced,
changed in the ordinary game, protected by focused evidence, included in the
release suite where practical, and deployed. Documentation-only surveys are
useful when they produce a ranked, reproducible queue; repeated broad audits
without a shipped fix are not the default cadence.
