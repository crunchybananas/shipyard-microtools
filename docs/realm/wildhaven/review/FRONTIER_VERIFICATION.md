# Wildhaven v3 frontier — October 2, 2026

Local implementation under `wildhaven/`; uncommitted and not deployed. Existing Realm work and browser saves are separate. This document supersedes the v2 report for current frontier claims. The exact delivered source and evidence hashes are recorded in `frontier-release-checkpoint.json`.

## Playable scope

The island now has five connected regions and three physical neighboring settlements. Named residents train as spearmen and archers, leaving civilian jobs. Engineers walk to paid walls, gates, towers and outposts. Troops move, hold, attack, retreat, recover and can die. Arrows, hit reactions, gate leaves and construction stages follow simulation state. Walls block, breach, become rubble, repair and salvage; rotated gates preserve their actual passage axis.

Envoys travel out and back, reserving labor throughout. Contact opens exact trades, relations, alliances, reinforcements, war and priced truces. Announced bands and hostile columns move across the land. Taking a stronghold ends that neighbor's attacks. Surveying and completing an outpost permits ordinary building in its region. Salvaging the outpost removes permission for new buildings while preserving existing homes.

The interface includes an interactive coast chart, accessible Find buttons, multi-unit selection, mouse/touch commands, full wall-line quotes before spending, explicit war/outpost consequences and a persistent event record. There is no fog overlay. Plain ES modules and the existing vendored Three.js remain the only runtime architecture.

## Earned simulation progression

`frontier-town-foundation-report.json` starts with `createGame` and earns a Forge Town using public actions. It completes all selected town ambitions at day 63, with 75 residents, 85 beds, 32 upgrades, 111 coastal orders, five defended coastal incidents and four paid demands. Its 5,590 simulated seconds are not measured human playtime. This automated foundation still makes many staffing decisions; it is evidence of a viable economy, not low-effort human pacing.

`frontier-campaign-report.json` continues that exact hashed save without granting supplies, people, research, diplomacy, units or damage. It recruits eight named residents, completes a wall/gate/tower line, reaches an alliance and physical allied aid, builds a frontier cottage, claims all five regions, defeats the actual Blackthorn garrison and stronghold, and pays the quoted Stonehaven truce. It finishes after 1,032 additional simulated seconds with 85 residents, nine defeated enemies, one wounded resident, one death, one breach, one defeated raid and no stolen cargo. Thirty-four serialization/reload checkpoints and exclusive-labor/resource invariants pass. Both reports record unchanged source hashes across their runs.

## Deterministic checks

`frontier-tests.txt` records 114 passing tests, with no failures or skips. The suite includes the existing town economy and persistence tests, canonical island/entrance checks, 33 focused frontier cases and six integration cases using an earned town. Coverage includes exact transactions, exclusive named labor, training and travel, delayed arrows and line of sight, actual breaches, occupied destinations, rotated gates, atomic wall lines, repairs and escrow destruction, alliances and aid, claims and salvage, wounds and casualties, bounded stolen cargo, accurate raid outcomes, conquest rewards, malformed saves and deterministic reload/tick partitions.

The final integration regression places and demolishes a real civilian building across a troop's cached route. Both changes invalidate navigation, the immediate save remains loadable, and the troop replans and finishes its original order. Explicit move/retreat destinations cannot be built over.

## Rendered art and movement

`frontier-geometry-report.json` passes against unchanged source and exported Blender hashes. It checks 2,475 terrain samples, canonical natural obstacles and navigation, fortification states, wall corners, gate leaf motion, exclusive military/civilian rendering, selection/placement overlays and read-only projectile animation. Opposing civilian streams cross the real gate opening for 60 seconds with no entries into its stone piers.

`frontier-earned-render-report.json` loads separately earned campaign checkpoints into isolated browser storage. The wall line, company, full island and all three hamlets were captured and visually inspected. The report has unchanged source hashes and no browser errors. Its wall checkpoint matches the final campaign; its older battle subsection is retained as historical observation.

`frontier-earned-battle-render-report.json` follows the final earned battle checkpoint, preserving an immutable input copy and matching its SHA at both ends. Seven saved troops receive a public attack order. Twelve simulated seconds include 14 samples with an actual projectile and one enemy's HP falling from 46 to zero. Four melee frames were captured and visually inspected; spearmen close on the target outside the compound, archers remain behind, weapons stay attached and hit feedback is visible. No positions, troops, HP or damage are inserted. Source, checkpoint and snapshot hashes remain stable, with no browser errors.

`frontier-town-traffic-report.json` replays all 76 residents of an earned town for 120 presentation seconds. It ends with 55 working and 20 walking, no stalled walkers, no illegal terrain/building positions, and minimum measured pair separation of 0.447 m. The renderer does not change simulation state. This shorter current regression supplements the historical v2 movement study; it is not a new 30-minute run.

## Browser controls and saves

`frontier-town-ui-report.json` passes all 14 fresh-town, desktop, 390px touch and legacy-migration checks with no browser errors and unchanged source hashes. Actual controls exercise construction costs, entrance protection, queue order/pause, mid-build save/reload, named staffing, refunds, growth, citizen finding and research links. Only waiting is skipped using the real simulation clock.

`frontier-town-progression-ui-report.json` passes all 13 advanced-control checks with no browser errors or source changes. Real buttons cover research, reload, all resource/storage views, paid charters, imports/exports and quotas, upgrades, orders, voyages, coastal warning/patrol/shelter/payment, and the 390px layout. Its late-game inputs are separately earned town checkpoints; public staffing actions prepare resources for clock skips. These are interface tests, not browser-played campaigns.

`frontier-ui-verification.json` reconciles 13 unique real frontier UI checks across identical runtime hashes. They cover exact recruitment/cancellation, named labor through reload, physical envoys, trade/war/truce, actual mouse/touch world targeting, paid wall-line confirmation, engineering, gate controls, salvage, the phone chart and outpost removal/rebuilding. Nine separate component checks use mocked APIs and are identified separately.

The full raw frontier run passed 12 checks and stopped its final scenario when the earned expansion fixture still contained two raiders. The displayed hostile-region restriction was correct. That failure remains in `frontier-ui-all-report.json` and `frontier-ui-hostile-fixture-report.json`. `frontier-ui-outpost-report.json` repeats the whole outpost scenario from the earned postwar checkpoint: exact refund, existing home preserved, new construction blocked after claim loss, exact reclaim payment, and a named engineer completing the new outpost in 100 skipped seconds. Runtime hashes match the earlier 12 checks and current disk; the manifest deduplicates their shared no-errors check. No game-code change was needed for this fixture correction.

The existing in-app browser tab stopped responding to browser-control requests. It was left untouched. A fresh preview loaded the existing saved village through **Come back home** and was visually reviewed: day 21, seven residents, ten beds, 106 timber, 81 stone, 14 food and two queued projects. It opened paused and remained paused while the new Frontier panel was opened and closed; displayed supplies and projects stayed unchanged. This is the current persisted save, not a claim that it equals every earlier historical snapshot. No campaign fixture was written into this browser. The fresh playable tab remains available, and the temporary read-only review tab was closed. `frontier-live-preview.json` records this scope.

There are 40 unique real browser checks across the three current suites (14 opening, 13 advanced town, 13 frontier), plus the separately labeled nine component checks. These are scoped checks, not a claim of exhaustive input coverage. Raw reports retain their actual scope; prepared UI/render fixtures are not browser-played campaigns. Earlier failed or source-changing runs are not counted as final passing evidence.

## Limits

Automated simulation, Chromium browser checks and rendered observation do not establish hours of enjoyable human play, final balance or physical-device performance. Safari, Firefox and real phones/tablets have not been validated. Some ordinary building upgrades still share authored models. Coastal cargo incidents remain a separate economic system from physical frontier battles. Everything is local; nothing has been published, committed or pushed.
