# Round 210 — Complete building sources and conforming snow

The winter building pass replaces floating snow geometry inherited from the
old procedural renderer. Inspecting the real source silhouettes also uncovered
clipped roofs and fragments of adjacent sprites. This is a local checkpoint
within the continuing whole-game AAA goal, not completion of that goal.

## Source repairs and winter material

`js/building-surfaces.js` now owns 16 explicit support-art rectangles. The
painted sheet is not a regular grid: the chicken-coop roof extends above its
assumed cell. The previous school crop included 51 of those roof pixels; the
coop itself omitted them and included 60 pixels from the orchard below it. The
cow-pen crop included 142 pixels of the neighboring hay asset. All three
defects are reproduced by the gate against the old rectangles and absent from
the new complete regions. Each has transparent padding. Source-pixel scale is
preserved when removing the erroneous margins and fragments.

An independent audit of every actual production crop then found one town-hall
edge pixel in the barracks crop. The explicit main-atlas corrections retain
that pixel with the town hall and remove it from the barracks. All runtime
building crops now include their complete connected source body and no pixels
belonging to another substantial sprite. The one detached lumber detail is
reported separately; it is not misclassified as a neighboring building.

Winter is now a material on the source art. Authored planes follow thatch,
slate, tile, canvas and exposed stone, retaining the source lighting and texture.
Pigment checks and explicit cutouts protect timber, windows, dormers, chimneys,
banners, entrances and the cow in its pen. Frost follows painted plants within
the asset rather than covering fences and crops with another tile diamond.
The generic roof caps, icicles and farm snow diamonds are removed.

The source PNGs are unchanged. Both 512×512 derived atlases preserve every
source alpha byte and transparent pixel. They retain **2 MiB** of additional
pixel data in total and require one source readback each when first used.
There are no warm material readbacks. Building composites distinguish bare
and winter material while retaining the existing 64-entry cap; all 58 tested
type/tier/material combinations reuse one copy across zoom changes.

## Verification

- **Chrome 152.0.7977.76 and Playwright WebKit 26.4** pass the same building
  gate: 16 complete padded support regions; all actual production crops;
  27 seasonal silhouettes; 30 live type/tier pairs at multiple zooms;
  protected semantic landmarks; visible roof snow; two material bakes and zero
  readbacks during 30 warm renders.
- Both engines preserve source alpha exactly. Chrome's rendered alpha is also
  byte-identical between seasons. WebKit has 19 wall-edge pixels differing by
  a single alpha level. A separate unchanged-image round-trip control reproduces
  this one-level resampling effect without snow. The rendered gate permits at
  most one alpha unit, while source-alpha and source-ownership checks remain
  exact; no product workaround or extra runtime copy was added for this rounding.
- WebKit passes continuous landscape pixels, world-coordinate stability,
  seasons, fog isolation, visible-water animation, paused frame reuse, context
  recovery, eight scenery crossings, Canvas fallback and actual phone touch.
- WebKit passes all **12 road configurations**, construction and removal,
  hidden-road isolation, winter travel lanes, pan stability and water-aware
  caching. Both WebGL and Canvas roads draw before the citizen and Founder.
- All **eight Founder gameplay checks pass in WebKit**, including eight
  movement directions, pointing and rally orders, pause, action interruption,
  enlarged atlas residency, Save/Continue, building occlusion and 390px touch.
- The expanded **7,200-tick construction fixture** adds a school, cow pen,
  chicken coop, town hall and barracks. All **46 structures**, including 32
  roads, finish by the **4,200-tick checkpoint**; population reaches 12. The
  longest measured wait for another 0.4 tile of progress toward an unchanged
  route waypoint is **59 ticks**. Across 1,200 rendered observations, **5,540
  continuously stationary observations contain zero unwanted gait changes**.
- This fixture temporarily shows winter only while rendering, restoring the
  ordinary season before each CORE step. It validates winter presentation
  during real building activity, not winter economy or survival behavior.
- The first construction captures exposed a harness fault: manually calling
  `forceRender` updated the world canvas beneath a stale post-processing canvas.
  The final capture path also runs the real post-processing and updates the
  HUD/minimap. Only `buildings-210-construction-final` is final visual proof.
  Its saved state is byte-identical to the first run: **169,527 bytes**, SHA-256
  `6ff891cb9a52eea2e5a22c66dab42259ce8a4e3b089759d9aa5d8be630cd574a`.
- Dense traffic still completes **24/24 routes**, with a longest exact
  no-progress interval of 2 ticks, minimum center spacing 0.310008447, zero
  blocked-building penetration and a matching deterministic rerun. Brief
  close-contact intervals remain reported; this is not strict non-overlap.
- The 77 ground-contact cases, full **87/87 browser logic checks**, deterministic
  replay over 43,200 ticks, Founder gameplay, core purity, runtime identity,
  module graph and lint pass. The building gate is included in `verify-realm`.

Evidence is under `tmp/graphics-world/`:

- `building-material-210/`: enlarged source references and independently
  recovered connected-component boundaries.
- `building-surfaces-gate/` and `building-surfaces-gate-webkit/`: exact reports
  and the 27-building winter gallery.
- `buildings-210-construction-final/{report.json,save.json,construction.png,settlement.png,close.png}`.
- `buildings-210-capture-comparison.json` and `probe-wall-webkit-210.json`.
- `landscape-gate-webkit/`, `road-material-gate-webkit/` and
  `road-depth-gate-webkit/` for engine-specific graphics evidence.
- `building-surfaces-210-chrome-final.log`,
  `building-surfaces-210-webkit-final.log`, `landscape-210-webkit.log`,
  `road-material-210-webkit.log`, `road-depth-210-webkit.log`,
  `founder-game-210-webkit.log`, `ground-contacts-210-final.log`,
  `dense-settlement-210.log`, `logic-210.log`, `determinism-210.log`.
- `tmp/founder-sprites/game-validation-webkit.json` separately records the
  Founder browser version and checks.

The temporary browser installation is at `/private/tmp/realm-webkit-210`.
Reproduce these engine checks with `PLAYWRIGHT_BROWSERS_PATH` set to that path,
`REALM_BROWSER=webkit` and `REALM_PORT=8942`. Founder uses
`FOUNDER_BROWSER=webkit` instead. The shared preview server is left running.

## Remaining work and limits

The roof repair makes the unchanged repetition in houses, source-painted
ground patches, older character proportions and animal art more conspicuous.
Source-aligned night windows and construction detail need the same treatment;
the current generic overlays still refer to earlier building shapes. Further
architectural variation, restrained effects, coherent materials and lighting
are required. These are the next visual targets, not a claim of AAA completion.

WebKit engine coverage is new and useful, but it is not a native Safari UI or
performance result. Native Safari review remains pending because the last
native UI attempt found the Mac locked and the unlock request is unanswered.
No new full-town frame-rate claim is made. Module revision **198**, save shape
**7** and simulation **11** remain unchanged. The original in-app game was not
reloaded. All changes remain local and uncommitted.
