# Wildhaven verification — October 1, 2026

The new game is local, uncommitted, and not deployed. Verification applies to `wildhaven/`; it makes no claim about the existing Realm implementation or a full migration of its systems.

## Gameplay and persistence

`node --test wildhaven/test/sim.test.mjs` passes 16 focused tests. These cover real costs and production, adjacency effects, arrivals, pantry recovery, complete earned-resource progression, undo/refund boundaries, malformed saves, and once-per-day exchanges across reloads. An efficient deterministic route restores the bell on day 5 using two optional exchanges; the baseline route finishes on day 6.

`tools/playthrough.mjs` runs visible-control tests in fresh Chromium contexts at 1440×1000 and touch-emulated 390×844. It places buildings through the shelf and canvas, skips waiting through the real simulation tick, and never grants resources or population for progression. It checks pause/speed, actual Web Audio startup/mute, occupancy rejection, exact undo refunds, roof picking, earned-resource growth, reload/continue, bell restoration, the completed save, landing exchanges and mobile controls. Its JSON report contains exact source/GLB SHA-256 values at start and end; use that report for the latest run result.

Mobile verification includes explicit bounds of the supply strip and its labels, not only document width. The first visual pass caught a fixed-position label clipped outside the screen even though the document did not overflow. The final layout gives rates their own line and makes columns shrinkable.

## Navigation and motion

`tools/navigation.mjs` passes five checks in an isolated controlled fixture. It checks 69 paths (806 traversed cells), all 13 residents over 30 simulated seconds, animated gait, the real Pause control, and rescue from an enclosure made by new cottages. No traversed cell was occupied by a building or a natural obstacle. All residents moved; the pause check froze both positions and limb rotations.

These tests deliberately construct fixture villages and reposition one actor. They are stress evidence, separate from the earned-resource playthrough. Three actual close-up gait screenshots were inspected in addition to numeric checks. The rendered character has a consistent hat/apron silhouette, tunic variation and alternating legs/arms; no new clipping was observed in those sampled poses. This is sampled motion review, not exhaustive animation coverage.

## Visuals and performance

The original Blender kit, character pose sheet, nature sheet, actual village screenshots and phone screenshots were inspected. The changes from the first rendered prototype include authored broadleaf/cypress trees, corrected water color, connected footpaths, slope foundations, dock height, hull contact, building mesh picking and safer resident routes.

The live Codex in-app browser reported 120 fps in sampled views on this machine, with no console warnings/errors. Headless Chromium measured about 13–14 fps in the automated software-rendered environment; those figures are not representative of the live view and are retained separately in the browser report. An early headless capture emitted depth-shader validation messages; subsequent complete runs recorded zero console/page/audio errors. No general device-performance guarantee is inferred from either sample.

ESLint's unused-variable, unreachable-code and constant-condition checks passed for all four browser modules. JavaScript syntax checks, the simulation tests and repository whitespace checks passed.

## Limits and retained boundaries

- Chromium and the live in-app browser were exercised. Safari, Firefox and physical touch devices were not tested.
- Sound lifecycle was exercised in a real AudioContext; listening balance was not formally reviewed on speakers/headphones.
- The new game has a complete opening and continued building, but does not include Realm's armies, campaign or large-settlement economy.
- Residents visually walk, work and carry; resource authority is the deterministic daily building simulation. Rendering is capped at 26 residents; larger populations remain counted in the economy.
- The local preview server is intentionally left running for play. Temporary test browser contexts were closed. The visible app tab is retained as the deliverable.
- Existing Realm graphics, dirty files, save keys and the separate Island game were not changed by this implementation.

## Evidence

- [Playthrough report](playthrough-report.json)
- [Navigation report](navigation-report.json)
- [Growing village](qa-04-ten-islanders.png)
- [Completed village](qa-06-completed-village.png)
- [Phone layout](qa-09-mobile-cottage.png)
- [Landing exchange](qa-11-landing-exchange.png)
- [Sampled gait](navigation-pose-2.png)
- [Original model kit](../assets/village-kit-contact.png)
- [Character poses](../assets/villager-pose-review.png)
- [Nature silhouettes](../assets/nature-review.png)

`initial/` contains the earlier working prototype screenshots, before the authored tree and palette refinements.
