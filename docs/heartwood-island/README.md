# Heartwood Island

A framework-free Three.js vertical slice, replacing the retired 2D Heartwood Trail. Play as the Frog Alchemist, explore a miniature Blue Ridge island, recover three shrine melodies and ingredients, brew the remedy, and discover five original field plates.

## Run

Serve `docs/` with a static server and visit `/heartwood-island/`. WebGL 2 is required; a visible fallback links to the original character artwork when WebGL or assets fail. No account, analytics, network API, runtime CDN, or backend. Journal storage uses only `heartwood-island-v1` in localStorage, never the 2D journal.

## Controls and accessibility

Tap a clear path to walk via collision-aware A*. Drag to orbit. Direction pad supports pointer release/cancel, and WASD/arrows support keyboard walking. Space interacts; Q/E orbit. Shrine name buttons guide walking without teleportation. Zoom toggles a follow camera and whole-island view. Settings offer safe return to workshop, reduced animation, optional synthesized audio and quality presets. All important actions and puzzle notes are native buttons. Melody challenges offer replay and a visible-pattern option; they have no penalty or timer. Escape closes dialogs. This remains a visual 3D game, not a fully nonvisual navigation experience.

## Fidelity and rendering

The original monochrome Frog Alchemist engraving informed a real Blender-built sculptural model: thinking pose, round flask, oversized eyes, floppy hat, cape and heart clasp. Color is an interpretation; contours are not claimed as an exact 3D reconstruction. The original five SVG plates remain unchanged in this game’s `assets/plates/` directory. Blender generator/provenance are under `tools/heartwood`; source/model preview accompany the GLB.

Static world and actor geometries are batched by material. Trees/grass/rocks use instancing. No expensive postprocessing or real-time water reflections. DPR is capped; Auto uses contact shadows instead of expensive real-time shadows on narrow screens. Low-quality mode disables real-time shadows on every screen. Animation and rendering pause when the tab is hidden. Ambient motion can be disabled. The model is 29,378 triangles, 643 KiB; the complete scene is roughly 86k visible triangles. Model animation is root hopping/breathing, not a skeletal gait.

Three.js 0.180.0 is vendored from the official npm package with package integrity verified. License: `vendor/THREE-LICENSE.txt`. The loader/utilities' bare `three` import was changed to a local relative import so browser and Node checks resolve the same files.

## Verification

```
node scripts/verify-heartwood-island.mjs
node scripts/verify-heartwood-island-browser.mjs
```

The browser check uses isolated Chromium desktop and touch profiles, not the user's browser profile. It covers movement release, shrine routing, cancel/reopen during playback, wrong-note recovery, all three ingredients, ending, journal persistence, settings, and reset cancellation. `HEARTWOOD_ISLAND_URL` can point it to production. Native Safari is separately smoke-tested. These are not actual iPhone hardware performance measurements.

The obsolete 2D engine and its tests were removed at Cory’s explicit request. The old `/creature-field-notes/` URL is now only a redirect. The implementation remains recoverable in Git history at `a98cfc4a`. Existing browser journal data is not deleted.
