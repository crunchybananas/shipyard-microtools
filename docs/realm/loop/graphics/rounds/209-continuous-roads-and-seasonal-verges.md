# Round 209 — Continuous roads and seasonal verges

The road pass replaced flat brown diamonds that were painting over the new
continuous landscape. This is a local graphics checkpoint within the owner's
whole-game AAA goal; that broader goal remains active.

## Result

Roads now belong to the existing WebGL2 landscape. Their connected centerlines
curve around corners, retain usable width through junctions and dissolve into
grass at the verges. Gravel varies in world coordinates rather than repeating
an image per tile. The first aggregate treatment looked too evenly dotted in
the town review; the final version uses sparse clusters, independent stone
size/pigment and lower contrast. Fine stones fade by pixel footprint at distant
zoom. Wheel tracks are restrained and broken by surface variation.

Actual road construction progress blends bare earth toward finished aggregate.
The existing 80×80 RGBA8 map uses alpha 64–127 for that progress, retaining 0
for open ground and 255 for other buildings. The map remains **25,600 bytes**;
there is no added material image, GL context or simulation field. Road flags
cannot accidentally become foundation shading. Undiscovered roads and buildings
cannot influence revealed junctions or ground color.

Dry ground has no animated material. It now reuses its GPU result across clock
ticks when the view, daylight, season and map are unchanged. Known water whose
surface or shoreline overlaps the viewport still advances. Paused construction,
removal, panning and discovery invalidate the result correctly. This is measured
cache behavior, not a new whole-town frame-rate claim.

During context loss or unavailable WebGL2, Canvas draws connected curved roads
with several quiet verge strokes. Each cell clips its own pixels, preventing
translucent endpoint caps from accumulating dark bands over their neighbors.
Both paths keep roads below citizens and the Founder.

The winter review exposed a legacy enhancement stamping two bright snow ovals
beside every building, including every road tile. That renderer is removed;
snow is part of the ground material. Winter roads retain a readable cleared
surface with softer wheel-track contrast. The unrelated floating roof caps are
still visible and are an explicit next target for the building art pass.

## Verification

- **12 rendered road configurations**: isolated, both straights, all four
  corners, all four T junctions and a crossing. Actual centerline and lane
  samples remain connected on both sides of cell joins; samples outside the
  verge match the underlying grass exactly.
- Exact paused and advancing-dry-ground pixel stability; **zero pan error**
  at the tested integer translation. Adjacent road material differs by a mean
  **3.148 RGB levels**, instead of repeating the same pixels.
- Construction at 0%, 50% and 100% visibly changes material while preserving
  the road. Winter retains readable travel lanes. Removing roads restores the
  original ground exactly; paused placement refreshes both map and GPU frame.
- Zero pixel disclosure from hidden roads or hidden foundations. Distant and
  unknown water permit frame reuse; visible water and an offscreen water center
  with an overlapping shore still animate in actual pixels.
- WebGL and Canvas road-depth checks pass for the citizen and Founder, with
  unchanged actor pixel-resolution contracts. Winter road samples reject the
  old bright snow stamps; both paths retain a curved-junction screenshot.
- The final **7,200-tick construction run** uses real placement commands and
  real builders. All **41 structures**, including **32 roads**, finish by the
  2,400-tick checkpoint. Population reaches **10**. The longest measured wait
  for another 0.4 tile of progress toward an unchanged route waypoint is
  **32 ticks**. Across **1,200 real renders**, **5,830 continuously stationary
  observations** contain **zero unwanted gait changes**.
- The complete saved JSON is **byte-identical** to the pre-change construction
  run. No simulation behavior or compatibility policy changed.
- Dense traffic completes **24/24 routes**; the longest exact no-progress
  interval is **2 ticks**, minimum center distance **0.310008447**, and no actor
  penetrates a blocked building. The deterministic rerun agrees. Brief close
  contacts are still measured and reported by that gate, not represented as
  strict non-overlap.
- Landscape/scenery validation, eight Founder gameplay checks, 77 ground-contact
  cases, citizen locomotion, actual phone touch, graphics context recovery and
  Canvas fallback pass. Core purity, runtime identity/module graph, lint and
  whitespace checks pass. The new material gate is included in `verify-realm`.

Evidence:

- `tmp/graphics-world/roads-209-before/{settlement,close,construction}.png`.
- `tmp/graphics-world/roads-209-seasonal-final/{settlement,spring,autumn,winter}.png`.
- `tmp/graphics-world/roads-209-construction-final/{report,save}.json` and
  `tmp/graphics-world/road-simulation-209-comparison.json`.
- `tmp/graphics-world/road-material-gate/{report.json,junctions.png}`.
- `tmp/graphics-world/road-depth-gate/{webgl-bend,canvas-bend}.png`.
- `tmp/graphics-world/road-material-209-final.log`,
  `road-rendering-209-final.log`, `landscape-209-final.log`,
  `dense-settlement-209.log`, `ground-contacts-209.log`, `locomotion-209.log`,
  `founder-game-209.log`, and `lint-209-final.log`.

## Remaining work and limits

The new roads make the older citizen families, identical houses and bright
roof details more conspicuous. Roof snow geometry still targets the superseded
procedural buildings and visibly floats over the painted assets. Construction
scaffolds/progress bars, architectural variation and material coherence require
further work. No claim is made that the whole scene has reached AAA quality.

This pass uses Chrome/Chromium. Native Safari review is pending: the last native
UI attempt reported a locked Mac, the unlock request has no answer, and the
local Playwright WebKit executable is absent. The previous Safari result is
not being reused as proof for these changes. There is no new full-town GPU
performance result.

Module revision **198**, save shape **7**, simulation **11** remain current.
The original in-app game was left intact. Changes are local and uncommitted.
