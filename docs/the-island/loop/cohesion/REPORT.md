# The Island — cohesion and human scale

Local revision, September 26, 2026. Open `index.html` for the visual review and
`journey/index.html` for the complete causal route. This pass continues the sparse
shore and animated Blender birds from September 19.

## What changed

The lighthouse books have names again: 25 reference volumes carry 16 authored
titles, including *Coast Pilot*, *Lamp Keeping*, *Birds of the Coast* and *The Winter
Log*. Each has a page block, separate covers and a spine. The lettering is one
shared atlas and one draw. The signal shelf keeps all eight figure–instrument
bindings, with larger instrument names and space above both rows. Its reader and
puzzle deduction still work; the titles do not give away numerical answers.

The staircase now has 115 risers over 20.6 metres, instead of 83 steep increments.
That is 17.9 cm per riser. It makes three turns, with 1.16 m wide treads and a
95 cm aisle beside the chart table. Closed risers, iron stringers and inset worn
nosings replace the floating plank construction. The ceiling opening and joists
clear the widened course; two metres of headroom are checked along its walking
width. Camera height eases across each step while collision stays on the real
floor. The gallery landing and three windows remain part of the route. The watch
book, inspection note and field journal now describe the actual stair count.

The tide tube moved to the south wall. Its pipe drops below the floor, and the
wheel moved clear of the first flight. The real pointer still operates the wheel;
the sea, miniature and float all follow the same tide state. Cabinet rails no
longer hide the top of the library. Joinery relief is finer and less burlap-like.

The built-in imagegen tool produced a new isotropic granite height field. It
replaces the wood-like streaks on boulders and stonework, with smaller mineral pits
and restrained relief. Grass has narrower pointed blades and muted root-to-tip
color. Heath is folded and tapered. Kelp now has a narrow stipe, curved blade and
pointed tip, instead of a broad rectangular sheet. Existing patch counts remain.

The Blender archive kit now has hollow tins, rolled rims, hinges, handles, inset
lids and paper stacks. The interactive tin still opens from its existing hinge and
reveals its papers. The Watcher and Tide-Figure have authored coats, bent sleeves,
hands, fingers, boots and smaller heads, at 1.795 m and 1.738 m tall. Their coats
move subtly. The Watcher's starting site has a clear view from the arrival slope.
A figure now earns regard only when its head is on screen and visible past
terrain, masonry, rocks and tree crowns. Looking through a boulder or up at the
sky no longer silently completes the encounter. Existing dissolution and reset
ownership remain intact.

The beach remains open: three shore gulls, six driftwood pieces, nine wrack
clumps, and one western tide-rock cluster. No blanket layer of extra props was
added. The Blender bird rigs, asynchronous foraging/preening, flight and landing,
clue-note beak motion, and open lapstrake dory remain in the live build.

## Walking and validation

- A recorded 27-second walk goes from the released arrival at the beach into the
  lighthouse study. Held keyboard input and yaw steering drive ordinary player
  movement. There are no position writes, teleports or collision bypasses during
  the recorded walk, and no rescue repositioning occurred. Route planning probes
  collision before recording, then restores the arrival position.
- The complete tower ascent and descent also use held keyboard input. The lens
  is an explicit prerequisite fixture for this isolated movement test. Each
  direction takes about 12 seconds. Camera changes remain below a full riser.
- The full regression gate passes, including 69 causal-route checks, 21 Landfall
  checks, 20 signal-shelf checks, 9 cohesion checks and 8 visible-encounter checks.
  Door containment, shell openings, glare, birds, terrain, materials, reset,
  notebook, tide consequences, saves and the inhabited rooms also pass.
- All 116 unit tests pass. Syntax and whitespace checks pass.
- The complete illustrated journey records 165 stages and all four endings with
  no browser exceptions. It earns progression through the shipped interactions.
  Long travel and crossing cinematics are accelerated; actors use disclosed
  placement fixtures. Tower and underground connectors traverse the production
  collision code. It is distinct from the uninterrupted keyboard walk video.

## Rendering and sources

The fixed study view draws 479 calls / 924,585 triangles at noon and night. The
Upstream Hand event peaks at 514 calls / 926,968 triangles, within its existing
budget. Fixed beach and forest samples, including night, are in `power/power.json`.
GPU timing is local observed evidence with uncontrolled host load, not a guarantee
for another device. No point light was added.

Editable Blender sources and generators:

- `../../tools/blender/landfall.blend` and `landfall.py` — stair and archive.
- `../../tools/blender/working-coast.blend` and `working_coast.py` — study fittings.
- `../../tools/blender/island-life.blend` and `island_life.py` — birds, boat, figures.

Imagegen output: `../../tools/blender/granite-height-source.png`.
Exact prompt: `../../tools/blender/granite-height-prompt.txt`.
Runtime derivative: `../../assets/rock-height.jpg` (512 × 512, 161,465 bytes).
This was generated with OpenAI's built-in imagegen tool; Blender generation used
Blender 5.2.1 LTS in separate factory-startup processes. `provenance.json` records
current source hashes and geometry counts.

## Limits of this review

This is a substantial, verified local art and movement pass, not a claim of literal
pixel perfection. The audit covers every asset family; it does not replace every
asset. Close tree crowns and distant coast geometry retain the game's faceted
style. The source keeper at the nested model retains its separate existing pose.
The browser runs are muted, so sound scheduling is checked but this is not a
listening review. No public deployment or commit is claimed. Older review folders
remain as dated evidence and their original source hashes describe those builds.
