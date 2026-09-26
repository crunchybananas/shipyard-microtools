# The Island — asset review, September 19, 2026 UTC

The current pass is implemented locally. This review separates changes made from
remaining work; it is not a claim that every asset is finished. Screenshots are
from the running game, including explicitly staged eras and encounter fixtures.

## Direction

Leave room for the island. Concentrate evidence of work around the dory and net
rack, keep the landing and route to the lighthouse readable, and make a few living
things worth watching. Judge detail at walking distance before using close views.
The Blender sources, captured game views and executable budgets remain the evidence.

## Asset families

| Family | This pass and evidence | Remaining work / judgment |
|---|---|---|
| Beach, terrain and scatter | Six driftwood pieces instead of twelve, nine wrack clumps instead of eighteen, three shore gulls instead of five. One western tide-rock cluster replaces three. A 24-metre arrival-to-working-shore walk is collision-tested. Shingle fades continuously into sand. [Arrival](01-arrival.jpg), [shore](02-worked-shore.jpg). | Preserve the open arrival. Improve dune vegetation through shape and placement; adding more objects is not the aim. |
| Gulls, crows and clue bird | Original Blender anatomy, twelve moving joints, feathered wings, eyes, bills, feet and tails. Watching, foraging, preening, blinks, calls, gliding, wingbeats and a continuous return/landing. The musical bird follows actual scheduled notes and sits on its real stone crown. [Video](gull-life.mp4), [crow](crow-0.jpg), [clue](12-songbird.jpg). | The stylized bodies are deliberately economical. A later anatomy pass can refine shoulder/neck transitions and foot placement on irregular terrain. Keep asynchronous pauses. |
| Boat and shore tools | Open lapstrake dory with ribs, floorboards, seats, keel and shaped oar. Cleat moved onto the gunwale; the real pointer still operates the oar. Shared geometry at full and model scale. The rack retains its imagegen timber. [Dory](03-open-dory.jpg). | Consider wear at contact points and more distinct tool handles, only where readable. No additional beach clutter is needed. |
| Conifers and low vegetation | Boughs changed from one ten-vertex ring to two five-vertex rings for fuller volume. Identical triangle count and asset byte size. Existing positions and colliders remain. [Forest](06-forest.jpg). | Highest visual priority: grass and heath still read as bright flat cards; trees remain repetitive at close range. Author a small family of bent stems, needle clumps and sheltered/dead variants, replacing weak shapes rather than increasing density. |
| Boulders, standing stones and cliffs | All six stone crowns now have closed corners: shared positions receive the same height, removing split faces. The bird is seated by a surface raycast. [Stones](11-stone-circle.jpg). | Existing rock relief looks too strongly striated, sometimes like wood grain. Recalibrate material frequency and normals, then selectively reshape silhouettes. |
| Sea, tide, kelp and fish | Reviewed the existing wave/tide composition, kelp and raised-water scene; gameplay gates retain the persistent tide consequence. [Shallows](16-shallows.jpg), [raised water](19-tide-figure.jpg). | No new water or fish asset is claimed in this pass. Investigate shoreline contact, foam and purposeful fish movement with a measured shader budget. |
| Lighthouse, stair and architecture | The existing Blender shaft, windows, stair course and gallery remain the route's landmarks. Full movement regression passes. [Lighthouse](15-lighthouse.jpg). | Add only structural/weathering details that explain construction and exposure. Preserve clear openings and human scale. |
| Study, instruments and miniature | Reviewed tide gauge, table island and shelf mechanisms; near/far bird meshes keep the miniature economical. The boat shares authored geometry between scales. [Study](07-study.jpg), [gauge](08-instruments.jpg). | Strongest detail should explain how an instrument works. The music-box survey framing is partly occluded by the stair and is not a beauty shot. |
| Refuge, furniture and textiles | Reviewed existing daybed, blanket, chair, kettle and cups with their working interactions covered by the regression. [Room](10-refuge-room.jpg). | More cloth weight, touch wear and material differences would help. Do not fill the room simply to make it look busy. |
| Drain and archive | Captured the actual interiors at their floor heights; descent/walk gates pass. [Drain](13-drain.jpg), [archive](14-archive.jpg). | Archive objects remain simple blocks; vault relief can read as wood. These are clear candidates for replacement with authored cases, book edges and appropriate masonry. |
| Story objects and readable pages | The final note, record slab and cradle now sit on the fitted timber floor; the note lies flat instead of being partly buried. Existing readable paper stays legible. [Source](18-source.jpg), [reader](21-readable.jpg). | Add folds and handling wear to close paper props when it reinforces the story. Preserve the reading UI's contrast and content authority. |
| Human encounters | Inspected the Watcher's actual head-and-cloak silhouette. [Watcher](20-watcher.jpg). Existing encounter progression remains covered by the walk. | High priority after vegetation/materials: replace primitive body construction with an authored silhouette, weight and posture. Keep the mystery. The attempted Tide-Figure capture does not visibly prove the figure; it is only a water/shore view. A dedicated staged reveal capture is still needed before judging that figure visually. |
| Lighting, atmosphere and four eras | Captured the study in all four eras at noon and night. No additional point lights; nine remain. [Era gallery](index.html#eras). | Continue checking material choices across the four grades. Do not bake lighting into a texture to compensate for a weak material. |
| Audio and accessibility | The actual bird clue triggers visible beak movement and runtime reset cancels it with pending notes. Existing audio/control contracts pass regression. | Captures are muted; this pass does not establish listening quality. A listening review of species calls, proximity and quiet intervals remains useful. |

## Next art passes, in order

1. Replace the weakest low vegetation and correct the rock/masonry material language.
2. Give human silhouettes authored anatomy and meaningful idle posture; capture the Tide-Figure reveal properly.
3. Replace archive blocks and refine cloth/paper contact detail, keeping the room sparse.
4. Review shoreline contact and the soundscape while walking, then measure their cost.

Every pass should retain the current interaction, save and power contracts and
produce an actual gameplay view. A structurally valid GLB alone is not acceptance.

## Capture method and limits

The primary survey is generated by `tools/harness/island-life.mjs`; `validation.json`
records poses, eras, hours, zoom and assertions. Era/prerequisite changes are debug
fixtures, not a recording of progression earned in that session. Crow/encounter/reader
supplements are likewise labelled in `supplement.json`. Close bird cameras use zoom;
`04-gull-gameplay.jpg` shows ordinary walking scale. Pose stills deliberately select
production animation states; the video runs ordinary production time.

The review includes weak assets on purpose. It is a continuation map, not a gallery
claiming the whole island has reached the same level of finish.
