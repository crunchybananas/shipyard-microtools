# Round 213 — Carpentered homes and visible construction

September 10, 2026. Local, uncommitted work under the continuing standard of
refining every pixel toward AAA quality. This is a substantial architecture
pass, not completion of the wider goal.

## The actual game

All four House tiers now use an original saved Blender family, with three
stable variants: reed, slate and clay. The first two tiers have one storey;
the last two have two. Muted plaster, timber joinery, recessed windows, stone
plinths and individually built roof coverings replace the repeated painted
house. Variation derives from existing building coordinates and is stable
through saves, seasons and upgrades.

Sixteen installed stages replace a completed sprite beneath wobbling generic
scaffolding: setting out, footings, plinth, joists, uprights, wall frames, lower
infill, upper infill, gables, roof trusses, battens, eaves, covering, ridge and
chimney, joinery, complete. Temporary staging, ladders and delivered materials
appear and leave at appropriate stages. The existing simulation still owns
all progress and assignments; real builders raise the new visual structure.

Roof snow follows the source material. Window dividers occlude emission, and
light reaches the ground through the actual openings. The body and window
emission share painter depth; source-cast contact and ground light stay below
actors. Smoke begins at a mouth measured from each saved chimney and is
suppressed for unfinished or undiscovered homes.

Tall roof and scaffold picking uses source alpha, including Retina displays.
Early plots also own their whole ground cell, so their empty center is
clickable. Hover shows the building or construction stage instead of the
terrain behind its roof. A selected or hovered construction site exposes its
progress below the footprint. The old floating completion ring is removed
from authored houses; unconditional nighttime sleep letters are retired
because they appeared even without sleeping residents. Real household status
remains in the House panel.

## Source and bounded runtime

`assets/sprites/architecture/homes/source/homes.blend` is the editable
authority: 9,339 named parts, 920,652 offline triangles, 112 materials and
8,466 normal-mapped components. Independent Blender bounds describe every
installed stage. The bootstrap only authors new staging sources; normal
rebuilds export the saved scene, including edits, without recreating geometry.
See the [source contract](../../../assets/sprites/architecture/homes/README.md).

The family supplies 384 detailed 512×640 body cells, seven base maps and
source-measured chimney anchors. All seven maps and the anchors must be ready
before the old painted family switches atomically. Failure or delay retains
the complete old family. The ordinary game downloads no source GLB and adds
no live 3D house scene.

Completed base cells are 128×160; construction cells are 64×80. A shared cache
retains at most twelve detail cells, with two simultaneous loads and visible
frames pinned against churn. Retained decoded image references are at most
**32.34375 MiB**, with up to 1,167,360 additional alpha-mask bytes for input.
These are retained pixel references, not total browser-process/GPU peak memory.
The game uses a fixed 112×140 draw rectangle and ground anchor `(0.5, 0.78)`.

Source review corrected duplicate corner posts, knee braces crossing window
openings, glass in front of mullions, jagged roof-course ends and overly hard
scaffold shadow edges. Initial browser canvas reduction also lost thin pegs
and differed between image/canvas paths. The bake now packs small cells using
deterministic, alpha-weighted area filtering in linear light. Comparison
checks spatial coverage and premultiplied radiance across 16×20 regions.

## Evidence

- **Source gates:** Chrome 152.0.7977.83 and Playwright WebKit 26.4 pass all
  192 independently measured construction stages, 384 detail cells, seven
  base maps, clipping, winter alpha and emission containment. Maximum source
  bounds discrepancy is 2.384185791015625e-7 m. Maximum regional image error
  is 0.373106 in Chrome and 0.409822 in WebKit, on a 0–255 scale.
- **Clean rebuild:** a separate export/bake from the production saved scene
  reproduces all **394 generated output files byte for byte**. Evidence:
  `tmp/graphics-world/houses-clean-rebuild-213.json` and its log; clean staging
  remains in `tmp/house-sprites/houses-213-clean/`.
- **Production house gate:** each engine passes 384 seasonal/stage draws,
  48 opaque roof clicks and hover labels across DPR 1/2 and zoom 1.3/2.7,
  four empty-plot selections, eight atomic loading failures, delayed-family
  loading, twelve chimney origins, continuous dusk/midnight and paused light,
  fog/construction silence, citizen/Founder painter depth and bounded cache.
  Warm cache makes zero additional detail requests and zero render readbacks.
  Reports: `tmp/graphics-world/house-game-gate{,-webkit}/report.json`.
- **Actual construction review:** a command-placed House in “The carpenter’s
  row” reaches uprights at tick 216, trusses at 326, ridge/chimney at 414 and
  completion at 458. Real builder work poses appear throughout. Day/night and
  summer/winter captures use the supported maximum zoom 3 at DPR 2; thirty
  further render frames leave the serialized save unchanged. Captures and
  report: `tmp/graphics-world/house-review-213/`.
- **Growing settlement:** the “Worn roads” fixture runs 7,200 real CORE ticks
  and 1,200 renders. All 21 buildings complete by tick 5,400; population reaches
  14. Maximum route wait is 57 ticks, with no long-wait episode. There are zero
  unwanted gait changes in 4,787 stationary observations. Before/after saves
  match exactly: SHA-256
  `6b2904372f377b7e0de624e7fc8d25e417f33462b42ceea1d264254c6e091d9f`.
  Evidence: `tmp/graphics-world/houses-213-{before,after}/`.
- **Dense traffic:** all 24 workers arrive, with maximum 426 ticks and longest
  zero-motion streak 2 ticks. Minimum separation is 0.310008447 tiles; the
  fixture records 3,262 brief close-pair ticks and zero blocked-cell penetration.
  This is not a claim of zero overlap everywhere.
- **Regression:** all 68 canonical checks from deterministic-core purity
  through browser logic pass, in two consecutive chunks after correcting an
  old raid-shelter assertion to expect the already-adopted readable activity
  label. All 24 shell checks pass again after the late input/overlay fixes;
  browser logic is 87/87 with no page errors. Both engines pass the 16-target
  existing Retina citizen/building gate. Painted-source/winter, light and
  contact gates pass with authored houses covered by their dedicated gates.
  Lint, canonical module graph (87 reachable files, 377 edges) and whitespace
  checks pass. The two new house gates are registered in `verify-realm.mjs`.

The additional adult-builder regression initially timed out opening new
pages. A serial run isolated a test deadlock: `page.goto` waited for the
window load event while that scenario deliberately held an action PNG open.
The gate now waits for DOM readiness and the actual game entry point, then
releases the image after testing the fallback. Completed scenarios also close
their pages before the next begins. Chrome and WebKit pass the corrected eight-way
motion, real construction, cargo/traffic/pause, save, loading/cache and 390px
touch checks with no page errors; the phone panel clears the dock by 10.796875
CSS pixels. Evidence: `houses-builder-213-{chrome,webkit}-final.log` and the
refreshed `builder-game-gate{,-webkit}/report.json` under `tmp/graphics-world/`.

Native Safari was also played directly in an isolated private window. A House
was placed, built, populated and selected through its roof; its lit windows
were inspected. After Save and Reload Page From Origin, Continue restored the
town and the roof opened the correct operational House panel again. The
review window is left paused, muted and saved, with one complete home and a
second setting-out project. Personal Safari tabs and the user's normal game
storage were not used.

## Remaining quality work

The native playtest exposed the older oversized citizen hit circle: a nearby
settler still steals taps on a construction plot even when its body is not
under the pointer. Automated empty-plot cases pass without an overlapping
citizen; native occupied-site selection is **not** claimed fixed. Address
visible actor/house picking together, including painter depth and touch.

Placement still announces “House built!” immediately through `js/log.js`,
before construction. Correct that at its causal source with appropriate
history/save checks, not by hiding a false message in the DOM. The skipped
tutorial also reopened on native Continue and deserves an explicit regression.

Other profession and building families retain the older visual style. Close
review still shows mismatched character/door scale, generic dust/ground marks,
an overly bright night curve and hard lake boundaries in the winter view.
Those, action handoffs and growing-town performance remain substantial work.
No general frame-rate or overall AAA claim is made. Runtime 198, simulation
11, save 7 and `realm.engine-v2` remain unchanged.
