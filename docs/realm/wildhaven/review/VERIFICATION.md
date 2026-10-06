> Historical v2 town checkpoint. Current frontier implementation and evidence are documented in [FRONTIER_VERIFICATION.md](FRONTIER_VERIFICATION.md). The counts and source hashes below describe the earlier town release.

# Wildhaven town verification — October 2, 2026

All changes are local under `wildhaven/`, uncommitted and not deployed. Existing Realm work is outside this review. The previous opening-game report is preserved as `V1-VERIFICATION.md`; its test counts, rendering cap and performance claims do not describe the town expansion.

## Deterministic simulation

`node --test wildhaven/test/*.test.mjs` passes 72 tests. These exercise named finite labor, construction escrow, pause/reorder/cancel, upgrade interruption, migration/save normalization, actual recipe inputs, partial supplies, finite service capacity and overlapping neighborhoods, entrance preservation, exact trade transactions and quotas, separate charter ambitions, coastal deadlines and supplied patrol defenses. No resident or building is deleted by a raid. The game continues after the bell.

The runtime uses plain JavaScript modules and one existing vendored Three.js library. Blender sources and generators remain editable. No UI framework or new runtime dependency was introduced.

## Earned development paths

Each campaign starts with `createGame` and uses public simulation/progression actions. No goods, residents, research or completed buildings are granted. Reports retain actions, daily balances, reload checkpoints, source hashes and limits. An accelerated simulation clock is used; the durations below are simulated time at 1×, not measured human play sessions.

| Path | Duration | Residents | Evidence of different choices |
| --- | ---: | ---: | --- |
| Breadbasket | 90.4 min | 76 | 800 food and 240 grain exported; 13 upgrades; 108 orders; 10 voyages; one raid recovered from |
| Free Port | 78 min | 94 | 66 paid imports and 12 voyages; 9/15 research fields; no mine, smith, toolmaker, flax field, weaver or brewhouse; six demands paid with no guards |
| Forge Town | 93.2 min | 75 | Locally produced 120 iron and 114 tools exported; six upgraded industrial workshops; five prepared defenses backed by 102 guard worker-minutes; no grain/bread/textile/brewing buildings and no voyages |

All three reach their selected specialty and common town ambitions. Their entrance audits find every building entrance connected: 59/59 for Breadbasket and 52/52 for both alternatives. Water, health and community are actual supplied capacity allocated across housing, not full credit for placing one provider.

The automated managers make many stock-threshold staffing changes (4,342 / 539 / 2,131). These are not a measured number of required player clicks: the initial scripts reconsider staffing every five simulated seconds and lack hysteresis. Runtime production independently throttles for missing inputs or full storage. The separate `campaign-freeport-slow-report.json` completes in 81 simulated minutes with at most one staffing/priority mutation per 30 seconds: 121 labor actions total, 94 residents and all Free Port ambitions. Five reload checkpoints and every entrance pass. Its 460 other macro actions still run through an automated manager, so it is not a full human-paced session.

Current evidence: `campaign-services-lanes-report.json`, `campaign-freeport-report.json`, `campaign-forge-report.json` and their corresponding saves/access evidence. Earlier `campaign-foundation-*` and `campaign-pressure-*` retain superseded rules. `campaign-services-report.json` preserves a failed automated strategy that built insufficiently supplied clinics; it is not a passing campaign.

## Browser and save checks

`town-ui-report.json` records 14 passing checks and no application errors on a fixed source snapshot. Real controls cover placement costs, rejecting a blocked entrance, queue order/pause, named staffing/priority, partial refunds, growth, person finding, research navigation, desktop panels, 390×844 touch layout and separate-key v1 migration. Only waiting is skipped through the real simulation clock. Exact placement costs are compared with the paused starting balance because the real game may legitimately run briefly between Start and Pause.

`town-progression-ui-verification.json` reconciles 13 passing advanced-control checks and four later smoke checks, with zero browser/application errors. It distinguishes a fresh earned school checkpoint from independently earned late-town checkpoints. The initial Watch fixture ran out of planks because toolmakers kept consuming them during a clock skip; that raw failure remains recorded. The targeted rerun preserves a real reserve through public staffing actions and passes exact shelter/payment costs, patrol progress, deadlines and the coastal record. Gameplay/UI module hashes match across the contributing runs. Later artwork-only revisions are verified by the separate render and geometry reports. No UI test writes the user's browser save.

The existing live Codex browser village was reloaded and migrated through **Come back home**. The visible values remained day 21, seven residents, 124 timber, 87 stone and 14 food. The completed cottage now contributes v2 housing for a total of ten beds. The game remained paused; People & jobs showed the actual seven named residents and two reserve foragers. The original v1 save remains separate, as additionally verified in an isolated migration test.

## Rendered workers and town

`town-render-report.json` names the earned source checkpoint and the public staffing changes used for review. Screenshots show the large town, an artisan, grounded service reach and coastal warning. A found working actor is only a numeric prerequisite; the actual captured poses are reviewed separately.

Rendered review caught two issues that earlier numeric gates missed: dense legacy layouts had disconnected workplace approaches, and crowd body separation could stop people on opposite sides of an overly precise street waypoint. New construction preserves entrances. Workstation approach points and street movement have separate precision requirements; the final movement report must verify sustained displacement as well as no overlap. The geometry fixture does not change simulation authority or user saves.

The final street-routing geometry report checks 84 station orientations, all 32 workers across 16 prepared workplaces, service radii, rotated entrance markers and the earned 76-person town. Its final 120-second full-staff geometry fixture ends with 57 working and 17 walking. The separate traffic report measures actual displacement and completed waypoints rather than treating a walking animation as movement. `town-traffic-report.json` extends this to 30 presentation minutes: no stalled walkers, no illegal terrain/building positions, and no change to simulation state. The longest gap between completed waypoints is eight seconds in the final 30-minute run. Short crowd fixtures keep at least 0.4456 m separation; the long run briefly reaches 0.337 m for a passing/working pair, so minor shoulder or tool contact is still possible. Refreshed whole-town screenshots were inspected and the dense stationary packs are gone.

The artisan review also exposed an unreachable, nearly head-height anvil. The original Blender generator and editable source were corrected to place it at working height. A fixed-length shoulder/grip/hammer solve preserves the held tool connection. `town-artisan-contact-optimized.json` verifies actual metal-head contact and raised recovery in all 144 stance/rotation/upgrade/villager-size cases. The flat-face contact compression is about two millimeters. The final impact, raised and descending images (`town-artisan-smith-pose-0/1/2.png`) were independently reviewed: the hammer stays in the hand, lifts above the waist-height anvil, and returns to its real surface. These are prepared close-up fixtures, not earned-town motion or hardware-performance evidence. `town-artisan-reviewed.json` records that distinction.

## Practical limits

- Three earned automated paths demonstrate economic alternatives and recovery, not hours of enjoyable human pacing. No long human session has been measured.
- The watch is an economic preparation and patrol system. Tactical squad control, enemy skirmish AI, campaign maps and alternate islands are not implemented.
- The new Blender kit has 20 roots, including tools and scaffold. Some buildings share a model and some upgrade levels use structural scale/detail variations; unique art for every catalog entry and level is not claimed.
- Chromium and the live in-app browser were exercised; Safari, Firefox, physical phones and tablets remain untested. The live seven-person paused village reported a sampled 120 fps on this machine. The separate motion-review page sampled 91 fps for 76 residents and 89 fps for 94 residents at 1280×720, before the final smith correction. A later sample on the final renderer showed 113 fps for the same 76-person checkpoint, with zero console warnings/errors. `live-town-review.json` records each renderer hash and scope; these changing samples are not an optimization benchmark. Headless software rendering is substantially slower and is not a hardware benchmark. These brief samples do not establish a device-performance guarantee.
- Original Web Audio sounds remain optional. Lifecycle behavior has historical browser evidence; the expansion does not claim a new speaker/headphone listening pass.
- Keep the visible village paused for the user. Temporary isolated test contexts close after their scripts. The local preview server remains available.

## Final checkpoint

`town-release-checkpoint.json` verifies that all final render, geometry, traffic and artisan report inputs match the current files. It also matches the UI/economy sources from their scoped checks and all four earned campaigns. The final world hash is `d59ce6cd37860b6135709ee62eb0c156014a319beedf884557645bfe5aadeb8c`; town GLB hash is `92d69afda39fdf9f67e8feff6c6faa376e027bf9c57d186c83dff72e5373e218`. The final browser reload again retained day 21, seven residents and the same visible supplies, paused.
