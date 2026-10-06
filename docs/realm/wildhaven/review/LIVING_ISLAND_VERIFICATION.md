# Wildhaven v4 — living island verification

Local checkpoint, October 2–3, 2026. This increment adds named fieldwork, four authored places, lasting restoration choices, job-specific cargo, spatial work sounds and an illustrated fieldbook. It builds on the existing town/frontier game. No new runtime library was added; Three.js remains the only one.

## Play and scope

Open <http://127.0.0.1:4751/wildhaven/>. Press **B** for the fieldbook; select a resident and send a surveyor. The resident leaves their town job, travels through the real navigation grid, studies the site and returns to report. Choose restoration or salvage after the report. Recall retains site progress and paid materials. Only a returned report or completed project awards its result. Closed gates, wounds and nearby enemies affect the trip.

The four restorations improve actual town construction, garden/orchard harvests, quarry/smith/toolmaker output and school knowledge. The authored Blender kit contains eight landmark states and fourteen carried goods. Surveyors have a pack and notebook; restorers carry a hammer. Ordinary cargo animation illustrates existing production and does not award extra stock.

Sound is opt-in through **♪**. **mix** adjusts work/actions and ambience separately. Thirteen procedural cues use stereo position and camera distance. Work strokes and traveled steps drive their cues; pause silences village work. No downloaded recordings or sound library are used.

The building catalog folds while the fieldbook is open and returns when it closes. The footer still exposes Landing, Journal, Frontier and Fieldbook. The book uses a compact illustrated layout on short laptop windows, scrolls on phones and supports keyboard controls. Find turns toward a landmark from its open approach, keeping its silhouette visible among the existing trees.

## Evidence

| Check | Result | Evidence |
| --- | --- | --- |
| Node simulation/persistence suite | 126 passed, 0 failed | `living-tests.txt` |
| New fieldwork, sound and responsive browser flows | 12 passed, 0 console/page errors; sources stable during run | `living-browser-report.json` |
| Existing fresh-town and migration browser regression | 14 passed, 0 errors; earlier scoped v4 checkpoint | `living-town-ui-report.json` |
| Earned four-place campaign | Four surveys and four paid restorations returned; 59 save/reloads over 298.75 simulated seconds; no injected stock, residents or positions | `living-campaign-report.json` |
| Ordinary crowd movement | 76 actors, 120 presentation seconds, no stalled walkers or illegal positions; simulation unchanged | `living-traffic-report.json` |
| Restorer motion | Four actual raised/descending work phases at the earned waystone assignment; no runtime errors | `living-motion-report.json`, `living-motion-restorer-0.png` through `-3.png` |
| Audio rendering | All 13 production cues rendered to stereo; nonzero, nonclipping samples; left/right panning verified | `living-browser-report.json`, `living-sound-reel.wav` |
| Existing user village | Day 21, 7 residents/10 beds, 106 timber, 81 stone, 14 food, 78% morale, 2 projects retained; resumed paused | `living-live-preview.json` |

The new discovery tests cover canonical obstacle placement, exact v3 migration, physical arrival and reporting, exclusive named labor, minimum civilian reserve, recall/resume without a second payment, actual construction benefit, capacity-limited salvage without duplicate rewards, reload at each mission stage, blocked routes, hostile retreats and corrupt-save rejection. Existing economy/frontier tests also pass.

The earned campaign starts from `frontier-town-foundation-save.json`, an independently earned v3 town. Bram 2, Cora 2, Dev 2 and Elin 2 complete the trips through public actions and normal ticks. The maximum movement in a quarter-second tick is 0.295001 cells, consistent with their 1.18-cell/second speed. The report records all seven affected construction/production multipliers. This is simulated time, not a measured human play session.

The browser review uses isolated Chromium contexts. Its opening expedition is clicked through a fresh game's controls; the review clock skips waiting. Restored-landmark and mature-workshop images use the separately earned campaign checkpoint and are labeled accordingly. They do not depict the user's saved town. Live work produced spatial cues from visible steps, axes, saws, chisels, anvils and gathering. Pausing stopped new work cues; mute stopped scheduled sources. Offline rendering separately checks all thirteen instruments.

Visual inspection covered the Blender contact sheet, the fieldbook at phone and laptop sizes, each landmark at gameplay scale, a mature workshop and the restorer's raised/down poses. This caught and corrected tree occlusion in the spring/star Find views, an overlap between the new footer and construction controls, cramped laptop reading, and the smith sound's contact phase. The new Find views preserve trees and navigation obstacles.

## Source reconciliation

`living-release-checkpoint.json` records current runtime/art/document/tool hashes and compares every reported source hash against the delivered files. The final living browser, campaign and restorer motion reports match their recorded runtime inputs. The Node suite ran against the final simulation; subsequent work changed only fieldbook CSS and browser layout checks.

The town regression precedes the final blocked-route/wound wording, field-route status feedback, smith sound phase and fieldbook reading-space adjustment. Its original source hashes are retained, not rewritten. The final living browser run covers the new fieldbook layout and shelf restoration. The earlier traffic run precedes camera presentation, sound-phase and field-route feedback refinements; ordinary crowd routing did not change after that run. Its source differences remain explicit in the checkpoint manifest. The town report's old migration-check label says “v3 key,” but its assertion uses `wildhaven.v4`; the harness label was subsequently corrected.

V1/v2/v3 reports remain historical. No old release checkpoint is overwritten or promoted into a claim of complete v4 verification.

## Preservation and limits

V4 saves use `wildhaven.v4`, with validated migration from v3/v2/v1 and all older keys retained. Local preferences preserve sound opt-in and store both mixer levels. The actual browser village was reloaded through **Come back home**, inspected, left paused with the fieldbook open and marked to remain available. No fixture was imported into that browser, no resident was assigned there and no simulation time was deliberately advanced. Existing dirty Realm sprite/code work was left alone. The pre-v4 folder backup is `/private/tmp/wildhaven-v3-before-living-island-20261002.tar.gz`.

Current verification covers Node, isolated Chromium and the in-app browser. It does not establish Safari/Firefox or physical-device compatibility, human listening quality, sustained human-session pacing, performance/thermal budgets or comprehensive review of every animation. The four discoveries are a finite authored layer, not an unlimited content system. Some existing buildings/upgrades still share models as documented in `ASSETS.md`.

All work is local and uncommitted; nothing is deployed. The local preview server remains running. The Blender generator used a separate background process and left the interactive Blender session untouched.

## Reproduce

Run from the Realm directory with its local server on port 4751:

```sh
node --test wildhaven/test/*.test.mjs
node wildhaven/tools/living-campaign.mjs
node wildhaven/tools/living-review.mjs
node wildhaven/tools/living-motion.mjs
WILDHAVEN_REVIEW_PREFIX=living- node wildhaven/tools/town-playthrough.mjs
TRAFFIC_SECONDS=120 TRAFFIC_REPORT=living-traffic-report.json node wildhaven/tools/town-traffic.mjs
```

Browser tools use isolated storage. Headless Chromium may require permission to run outside the restricted macOS process sandbox. Re-running a report replaces that report and its same-name review images; retain the checkpoint if preserving this exact evidence matters.
