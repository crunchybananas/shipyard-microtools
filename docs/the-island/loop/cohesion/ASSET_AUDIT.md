# Every asset family — September 26, 2026

Judged from actual gameplay views, then checked against interactions and movement.
The matched comparisons are in the review page; `journey/` contains the complete
route and every readable page. Scene fixtures, zooms and skipped travel are labelled.

| Family | Finding and action | Evidence |
|---|---|---|
| Arrival and working shore | Kept the arrival open. Sparse logs, wrack, three gulls and one western rock cluster give the fishing equipment room. Normal keyboard movement reaches the lighthouse without rescue. | `coast-walk.mp4`, `coast-walk.json`, `families/01-arrival.jpg`, `families/02-worked-shore.jpg` |
| Birds | Retained the Blender gull, crow and clue-bird rigs, lighter distant skins and asynchronous idle/flight actions. Rechecked the full flight return, foot contact, near/far geometry, reset and actual note-driven beak. | `families/04-gull-gameplay.jpg`, `families/12-songbird.jpg`, full regression GULLS 11/11 and ISLAND LIFE 21/21; prior continuous bird video linked in the review |
| Dory and fishing equipment | Open hull, ribs, seats, oar, cleat, drying rack, net and hollow barnacles remain correctly scaled. Oar and shore interactions still respond to a real pointer. No extra beach furniture added. | `families/03-open-dory.jpg`, shore and living-asset gates |
| Terrain, cliffs and rock | New imagegen granite relief removes directional streaks from stonework. Continuous beach topology, coast contact and water depth remain verified. Standing-stone corners remain closed. | `before/rocks.jpg`, `after/rocks.jpg`, `families/11-stone-circle.jpg`, TERRAIN-FINISH 10/10 |
| Grass, heath and trees | Narrowed grass, tapered and folded heath, softened colors and restrained sway. Closed tree crowns and distance variants retained; no density increase. Boughs remain visibly faceted up close. | `before/forest.jpg`, `after/forest.jpg`, `families/06-forest.jpg`, TREES 13/13 |
| Water, kelp and fish | Kelp sheets replaced by curved tapering ribbons. Tide continues to control sea, miniature, tube, pool and flooded rooms. Fish retain their existing economical silhouettes. | `encounters/tideFigure.jpg`, `families/16-shallows.jpg`, complete raised-water route and Upstream Hand 32/32 |
| Lighthouse exterior and stair | 115 supported treads; 17.9 cm risers; wider lower course; adjusted ceiling and joists; clear headroom. Camera stepping eased. Windows, gallery and doors checked at player height. | `after/climb-0.25.jpg`, `checks/validation.json`, LANDFALL 21/21, COHESION 9/9 |
| Library and signal shelf | Restored 16 authored titles across 25 ordinary books. Added page blocks/covers. Refit shelf cap and book heights. Enlarged signal labels; retained all eight bindings and reader targets. | `checks/library.jpg`, `checks/signal.jpg`, SPINES 20/20 |
| Study and working instruments | Moved wheel, gauge and pipe out of the first flight and door. Preserved the chart table's miniature, crank, music box, lens seat, hanging line and floor plate. | `checks/circulation.jpg`, `families/08-instruments.jpg`, `families/09-music-box.jpg`, WORKING COAST 10/10 |
| Refuge and furniture | Reviewed bed, blanket, chair, cup, kettle, lamp, mobile and stitched boat at room scale. Existing authored geometry retained; homecoming, lamp and chair actions are exercised through the full route. | `families/10-refuge-room.jpg`, HARBOR 11/11, journey homecoming and endings |
| Drain, cellar and archive | Real ramp and stair entry/exit verified. Replaced solid archive blocks with hollow hinged tins, handles, rims and paper stacks. Mineral source also improves vault masonry. | `families/13-drain.jpg`, `after/archive.jpg`, journey underground chapters and tin pointer interaction |
| Human encounters | Replaced primitive head/cone shapes with authored figures and restrained cloth motion. New geometry remains on original encounter/reset anchors. Rock, canopy and off-screen regard failures corrected. | `encounters/watcher.jpg`, `encounters/tideFigure.jpg`, ENCOUNTERS 8/8 |
| Paper, story and field notes | Surface seating remains correct; readable pages remain legible. Corrected stair counts in watch book, inspection copy, lampblack notes and field journal to agree with physical construction. | Complete manuscript, 165-stage journey and notebook/content unit tests |
| Light, weather and eras | Rechecked all four study grades by day and night, plus water changes and endings. Existing nine-point-light budget retained. New shapes/materials remain readable under the grades. | `families/era-*.jpg`, `power/power.json`, glare/bloom/shell gates |
| Controls, saves and sound | Keyboard coast and stair walking, pointer interactions, notebook/touch layouts, runtime reset and save persistence exercised. Tests are muted; listening quality is explicitly outside this visual evidence. | Full regression, experience 22/22, saves 24/24, runtime reset 6/6 |

## Remaining refinement opportunities

The broad coherence problems addressed here are implemented and checked. Further
art direction can still improve close pine branch variety, contact wear on textiles
and small paper props, distant cliff silhouettes and the source keeper's posture.
Those are visible style limits, not changes claimed by this pass. An audible
soundscape walk should judge call distance, quiet intervals and weather balance.
