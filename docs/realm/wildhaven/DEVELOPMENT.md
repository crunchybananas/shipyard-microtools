# Wildhaven: town and frontier RTS

**Current version: v4 living island.** Named surveyors and restorers, a four-place fieldbook, paid persistent restoration projects, job-specific cargo and spatial procedural sound extend the v3 town/frontier. Current evidence is in `review/LIVING_ISLAND_VERIFICATION.md`; v3 evidence remains in `review/FRONTIER_VERIFICATION.md`. The detailed town results below describe the earlier v2 checkpoint and remain historical.

## User objective

Deep jobs and population types, real visible building construction queues, consequential upgrades, many development paths, and hours of resource-management play drawing on Stronghold, Caesar III, SimCity and Warcraft. This local town expansion is implemented and verified through three distinct earned development paths, a slower labor-management run, desktop/touch controls, migration, and rendered motion review. Actual human-session pacing and enjoyment remain unmeasured; simulated campaign duration is not a claim of hours of tested human engagement.

## Completion requirements

1. Named residents hold real jobs; finite workforce and training/skills affect output. Builders compete for people with food, industry, services and defense. The interface explains vacancies, shortages and reassignment.
2. Construction takes labor and time, pays materials, exposes a reorderable queue and visible construction stages, and safely survives cancellation, pause, save and reload. Sites cannot produce or house people before completion.
3. Building upgrades change capacity, recipes, workforce, services and appearances. Upgrades consume resources and construction time, with meaningful economic opportunity costs.
4. Connected production chains include farming and food processing, timber and crafted materials, ore and metal/tools, and goods for trade. Actual inputs are consumed; storage and bottlenecks are legible.
5. Town development offers distinct food/agrarian, craft/industrial, trade, civic and defensive approaches. Research, charters and policies have live effects and costs rather than cosmetic labels.
6. Population has needs, prosperity and civic services. Growth exposes new constraints. Services and upgraded housing influence the development of neighborhoods.
7. External trade, timed requests and threats create ongoing decisions. Defenses and troop roles must eventually meet actual threats, not just score toward a counter.
8. A long progression with multiple sustained objectives, meaningful mid/late-game decisions, setbacks and recovery offers hours of play. This requires economy and extended-session evidence, not timers artificially lengthened to claim duration.
9. The game retains its authored 3D identity, usable desktop/touch controls, local save safety and no-framework/browser-native approach. Every added asset and control has a runtime consumer.
10. Full new-game and migrated-save playthroughs, resource/labor invariants, construction and upgrade interruption cases, renderer/animation inspection and extended-session balance are verified at the scope claimed.

## Current implementation

The town now has 25 building types, 14 resources, named citizens in 18 occupations, real finite labor, retained skill, escrowed construction, reorder/pause/cancel, queued upgrades, input-dependent production, storage, research, charters, timed orders, trust-gated voyages, coin imports/exports, finite neighborhood service capacity, and coastal warnings resolved by payment, sheltered cargo or supplied patrol work. The new Blender pack adds workplaces, scaffolds, an upgraded cottage and held tools. Workers approach authored stations and crowds have obstacle-safe spacing.

The latest depth pass removes forced all-technology/all-building completion. Breadbasket, Free Port and Forge Town have different specialty ambitions. A town can import selected goods instead of building their chains; export quotas turn a surplus into purchasing power. Production upgrades improve labor productivity. Service upgrades expand actual supplied bed capacity and reach; half staffing no longer grants full neighborhood coverage.

## Historical v2 evidence and limits

- All 72 focused economy, persistence, service and pressure tests pass, covering construction interruption, exact transactions, shared labor, finite inputs, upgrades, charter changes and coastal outcomes.
- Fourteen fresh/migrated browser checks and thirteen advanced-control checks pass, plus four later renderer/UI smoke checks. Late-game UI checks use clearly labeled independently earned checkpoints. The user's live village was preserved and left paused on the final version.
- Three current earned campaigns complete independently: Breadbasket (76 residents, 90.4 simulated minutes), Free Port (94 residents, 78 minutes, six optional industries omitted), and Forge Town (75 residents, 93.2 minutes, locally produced metal exports and five prepared defenses). Each passes source-stable economy, reload and connected-entrance checks. A separate Free Port run limits staffing changes to one every 30 simulated seconds and still completes in 81 minutes with 121 labor actions. None of these is a measured human play session.
- Render review prompted crowd and workstation fixes. The final 30-minute motion run has no stalled walkers or illegal terrain/building positions; all citizens remain visible. The actual Blender anvil and smith pose were corrected together, with 144 contact/recovery cases and independently reviewed impact/raised/descending captures.
- Final source hashes and scoped evidence are reconciled in `review/town-release-checkpoint.json`; `review/VERIFICATION.md` records methodology, earlier failed fixtures and practical limits. No implementation or verification from this pass is left running.
- Human-session pacing and enjoyment are not established by an automated clock. There are no tactical squad orders, active enemy skirmish AI, alternate islands or complete unique art for every building/upgrade. Coastal defense is an economic readiness/patrol system with visible deterministic outcomes.

That checkpoint delivered the town economy. V3 adds the requested tactical combat and expands this island; it does not add alternate islands or unique models for every remaining upgrade alias. Balance changes still need real human sessions.

## Preserved state

The prior Wildhaven source/art/review was captured at /private/tmp/wildhaven-v1-before-town-20261002.tar.gz before this implementation. V1 saves must migrate through explicit validation; legacy Realm save keys remain outside this game.
