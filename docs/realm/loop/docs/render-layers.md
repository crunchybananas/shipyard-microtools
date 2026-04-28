# render-layers.md

**Status:** Written in tick 165. Maintained by subsequent loops as
new sprites/meshes land or the integration story changes.
**Sources:** 161 opened the SVG axis (granary.svg + sandbox); 162
shipped castle.svg; 163 opened the 3D engine axis with granary mesh
+ pushCylinder + debug-pillar cleanup; 164 shipped church.svg
completing the 3-sprite milestone that unlocks this doc. 165 (this
update) captures the three-render-layer landscape before more
sprites land — so future ticks have a single place to consult when
deciding which layer to ship into.

## why this exists

Realm has THREE render targets. The loop ignored two of them for
ticks 001-160 (~160 ticks of canvas-only work). The user steered
mid-session 2026-04-28: "in some loops can we really focus on the
svg generation. opus 4.7 has expanded capabilities so we should
rethink them or think about the 3d engine version."

Memory captured the steering as
`memory/project_realm_loop_render_axis.md`. This doc captures the
TECHNICAL state — what each layer is, where it lives, what it's
good at, and how to decide between them on a per-tick basis.

Keep it accurate or retire it.

## the three layers

### Layer 1: 2D canvas (the live game)

- **Entry point:** `docs/realm/index.html` + `docs/realm/js/render.js`
- **Form:** procedural canvas drawing primitives (`ctx.fillRect`,
  `ctx.arc`, `ctx.fillStyle`, `ctx.createLinearGradient`,
  `ctx.beginPath`/`stroke`/`fill`)
- **Per-building:** named function in render.js (`drawCastle`,
  `drawGranary`, `drawChurch`, ~30 of these total covering all
  building types + decor + UI)
- **Strengths:** ships in the live game; integrates with all
  existing systems (day/night tint, fog, winter caps, hover halo,
  photo-mode, pixel-perfect at default zoom); 30 buildings already
  authored
- **Weaknesses:** imperative 100-300-line drawing routines per
  building; gradients allocated each frame; pixel-stairs at high
  zoom (5× photo-mode); patterns require nested for-loops;
  decorative detail expensive to author

### Layer 2: SVG sprites (sandbox, post-tick-161)

- **Entry point:** `docs/realm/svg-test/index.html` (sandbox);
  `docs/realm/assets/sprites/*.svg` (asset files)
- **Form:** declarative SVG markup (`<rect>`, `<path>`, `<ellipse>`,
  `<circle>`, `<linearGradient>`, `<radialGradient>`, `<pattern>`)
- **Per-building:** standalone `.svg` file with viewBox 128×128
- **Strengths:** vector-clean at any zoom; gradients + patterns
  declared once and instanced; decorative detail at ~1 line per
  element; expressive form (true elliptical-arc paths for gothic
  windows; tileable textures via `<pattern>`); side-by-side authoring
  vs canvas confirmed cleaner expression for complex forms (158
  granary dome cap → 161 sprite; 162 castle; 164 church gothic rose
  window)
- **Weaknesses:** NOT yet integrated into live game (sandbox-only);
  no day/night tint composition path; no animation path; no winter-
  cap composition (158's dome arc); 8 of 11 buildings still
  un-shipped
- **Currently shipped:** granary (161, 172 LoC), castle (162, 270
  LoC), church (164, 196 LoC), windmill (168, 213 LoC), tower
  (170, 188 LoC) — 5 of 11

### Layer 3: 3D WebGL2 prototype (parallel)

- **Entry point:** `docs/realm/3d/index.html` (separate page);
  `docs/realm/3d/3d.js` (WebGL2 module)
- **Form:** procedural mesh construction via `Mesh` class
  (`pushBox`, `pushPyramid`, `pushQuad`, `pushTri`, post-163
  `pushCylinder`)
- **Per-building:** `else if (b.type === 'X')` branch in
  `buildBuildingsMesh` adding boxes/pyramids/cylinders for the
  form
- **Strengths:** real 3D — proper occlusion, hemisphere+sun
  lighting, water vertex animation, iso camera with
  drag-pan/scroll-zoom/Q-E rotation; meshes scale uniformly at any
  zoom; compositing day/night sun rotation is a single uniform
  change
- **Weaknesses:** completely separate from the 2D game (no shared
  state, no buildings system, no citizens, no economy); 6 of 11
  building types meshed (castle / house / tower / church / barn /
  granary); lower per-building visual fidelity than canvas/SVG; no
  textures yet (per-vertex color only)
- **Currently shipped:** castle, house, tower, church, barn,
  granary (post-163), windmill (post-167) — 7 of 11+ types

### asset/meshes/

`docs/realm/assets/meshes/buildings/*.glb` exists but is **NOT
loaded** by the 3D prototype. The .glb meshes change outside the
loop's awareness (e.g., from a separate Blender pipeline). The 3D
prototype generates its own procedural meshes in JS. Reconciling
the two is a **future tick** — could be: a glb-loader pass that
swaps procedural meshes for higher-fidelity .glb when available.

## the cross-axis triangle

**Granary is the first building expressed in all three layers**;
**windmill is the second** (post-168):

| Building | Canvas | SVG | 3D  | Pattern |
| -------- | -----: | --: | --: | ------- |
| granary  | 158 (~75 LoC) | 161 (172 LoC) | 163 (~15 LoC) | canvas → SVG → 3D |
| windmill | 094/096/158 (~70 LoC) | 168 (213 LoC) | 167 (~25 LoC) | canvas → 3D → SVG |
| tower    | pre-loop (~42 LoC) | 170 (188 LoC) | pre-loop (~15 LoC) | canvas + 3D pre-loop → SVG |

158 (canvas) shipped a dome-conforming snow cap closing 095's
filed idea. 161 (SVG) demonstrated the same building authored
declaratively. 163 (3D) added the granary mesh + a new
`pushCylinder` primitive.

094/096/158 anchored windmill in canvas (per-building winter cap
+ sail-tip alignment). 167 added the 3D mesh (reusing 163's
`pushCylinder`). 168 shipped the SVG sprite — 4 sails in canonical
cross pose with cloth panels + wooden cross-frames + iron hub.

The pattern: **when a building gets meaningful work in one layer,
a sibling tick in another layer pairs the work**. Order isn't
fixed (granary went canvas → SVG → 3D; windmill went canvas → 3D
→ SVG); what matters is closing the triangle.

## coverage map

11 building types in the live game. Coverage across layers as of
tick 165:

| Building     | Canvas | SVG (161+) | 3D (163+) |
| ------------ | :----: | :--------: | :-------: |
| castle       |   ✓    |    ✓ (162) |    ✓      |
| church       |   ✓    |    ✓ (164) |    ✓      |
| granary      |   ✓    |    ✓ (161) |    ✓ (163)|
| house        |   ✓    |     —      |    ✓      |
| tower        |   ✓    |    ✓ (170) |    ✓      |
| barn         |   —    |     —      |    ✓      |
| windmill     |   ✓    |    ✓ (168) |    ✓ (167)|
| farm         |   ✓    |     —      |     —     |
| tavern       |   ✓    |     —      |     —     |
| blacksmith   |   ✓    |     —      |     —     |
| market       |   ✓    |     —      |     —     |
| bakery       |   ✓    |     —      |     —     |
| barracks     |   ✓    |     —      |     —     |
| school       |   ✓    |     —      |     —     |

(Plus the canvas-only specialized buildings: archery, chickencoop,
cowpen, fisherman, ironore, lumber, mine, quarry, road, tradingpost,
well — and `drawGeneric`/`drawBuilding` dispatchers.)

Coverage gaps:
- **`barn` exists only in 3D**; canvas has `farm`. Different name
  for what may be the same conceptual building.
- **8 of 11 game buildings still need SVG sprites.**
- **5 of 11 still need 3D meshes.**

## authoring-cost data points

For the 3 buildings shipped in both canvas and SVG:

| Building | Canvas LoC | SVG LoC | Detail level (subjective) |
| -------- | ---------: | ------: | ------------------------- |
| granary  |        ~85 |     172 | SVG significantly richer (true dome shading via pattern + gradient; on-dome icicles in canvas were 158's addition; SVG has decorative grain specks, plank seams, hoop nail studs that canvas omits) |
| castle   |       ~245 |     270 | Roughly equivalent fidelity; SVG's stone-block pattern + window-halo `radialGradient` instancing replaces canvas's nested for-loops + per-window gradient allocation |
| church   |       ~115 |     196 | SVG meaningfully richer (true elliptical-arc gothic windows; lead tracery; door ring handle visible at zoom; canvas approximates gothic windows via half-circle `arc()` calls) |
| **total**|       ~445 |     638 | SVG ~43% more lines for ~2× detail per building |

(Canvas LoC counted by source-line of the named draw function;
SVG LoC includes XML declaration + license comment + defs.)

For the granary in 3D: ~15 LoC of mesh-construction calls. The
fidelity is much lower than canvas/SVG — boxes + pyramids + a
pushCylinder — but the form reads at iso zoom against the lit
terrain.

## when to pick each layer

**Canvas (Layer 1): default.** All live-game work. Until the
integration tick lands, no SVG can ship into the live game; the
canvas is the only path that affects player experience. Use canvas
for fixer/feature work that needs to ship to players.

**SVG (Layer 2): when authoring expressive detail.** Pick SVG when
the building's form benefits from gradients, patterns, or
elliptical-arc paths (gothic windows, dome curves, complex tile
roofs). The sandbox is the deliverable; integration is a separate
tick.

**3D (Layer 3): when exploring spatial/lighting.** Pick the 3D
prototype for sun-rotation, shadow, terrain-conformance, or
camera-control experiments. The prototype is genuinely separate
from the live game — what ships there doesn't affect players.
Useful for atmospheric exploration that the canvas can't easily
express.

## integration concerns (NOT yet solved)

When SVG sprites eventually integrate into the live canvas
pipeline, these will need solving:

- **Day/night tint.** Canvas applies multiply-blend tint per frame
  across the whole scene. SVG sprites composited via `<img>` would
  need either CSS `filter` or a final canvas pass that draws each
  SVG into a buffer and applies the tint.
- **Winter caps.** 158 ships a dome-conforming snow arc as a
  separate canvas primitive AFTER drawGranary. SVG sprites would
  need either a winter-variant SVG file OR a runtime overlay layer
  that the canvas pipeline composites on top.
- **Hover halo / selection.** Canvas draws a glow around the
  hovered building. SVG would need a parallel halo render path.
- **Fog modulation.** Distance-based fog in canvas modulates
  alpha; SVG sprites would need similar per-frame opacity.
- **Per-instance variation.** Canvas drawChurch picks one of 4
  glass palettes + 3-4 steeple ornaments via kingdom hash. SVG
  sprite is static. Solutions: variant files, CSS custom
  properties parameterizing the palette, or inline SVG with
  template substitution.
- **Animation.** Canvas drawCastle has flag-sway via
  `Math.sin(G.gameTick * 0.06)`. SVG would use `<animate>` or CSS
  keyframes — works in `<img>` only if SVG is loaded via
  `<object>` or inlined.

## invariants

- **Cross-axis pairing.** When meaningful work lands on a building
  in one layer, prefer pairing the work in another layer within
  ~5 ticks. Granary established this with 158 → 161 → 163.
- **Sandbox before integration.** New SVG sprites land in
  `assets/sprites/` and the sandbox; they don't replace canvas
  draw functions until a deliberate integration tick.
- **3D prototype stays standalone.** Until reconciled with the .glb
  pipeline + the live game, 3D work is exploration. Don't try to
  bridge it without a deliberate tick.
- **Detail per-zoom invariant** (SVG advantage): authoring fidelity
  should be at least as rich at 384px as at 48px. SVG holds this
  by construction; canvas requires deliberate effort.

## related loops

- **016** — original 3D prototype + disabled space effects (left-
  over from a "too out of place" design pass)
- **031** — 3D prototype debug pillars added during pipeline
  diagnosis
- **095, 158** — granary canvas dome-conforming work (095 audit;
  158 fix)
- **161** — SVG axis opens; granary.svg + sandbox; durable memory
  steering captured
- **162** — castle.svg; 2nd sprite confirms axis isn't a one-off
- **163** — 3D engine first touch; granary mesh + pushCylinder +
  debug-pillar cleanup; granary now in all three layers
- **164** — church.svg; 3rd sprite milestone reached
- **165** — render-layers.md captures the canvas/SVG/3D landscape;
  coverage map; cross-axis triangle invariant; authoring-cost
  data; integration-concern checklist for future integration
  tick.
- **166** — frog-voices acknowledgment (3rd ambient-entity beat;
  148/152 grammar). Non-graphics tick; doesn't change render
  layers but documents the variety cadence around graphics work.
- **167** — 3D windmill mesh added; coverage map updated. Builds
  toward windmill cross-axis triangle (158 canvas anchor; SVG
  sibling pending). 3D layer coverage now 7 of 11 buildings.
- **168** — windmill SVG sprite ships (213 lines: tapered stone
  base + wooden cap + smaller cupola + 4 sails in canonical cross
  pose with wooden cross-frames + 3-section cloth panels per blade
  + iron hub with bolts + arched door). **SECOND CROSS-AXIS
  TRIANGLE COMPLETE**: windmill canvas (094/096/158 conforming-
  cap thread) + 167 3D mesh + 168 SVG. Granary at 158/161/163
  was the first triangle; windmill is the second. SVG layer
  coverage now 4 of 11.
- **169** — type-scale phase 4 (8 exact-match font-size
  migrations); non-graphics variety after the SVG/3D run; doesn't
  change render layers but fits the "in some loops" cadence.
- **170** — tower SVG sprite ships (188 lines: stone body with
  block pattern + side-wall depth + 4 crenellations + cross-shape
  arrow slits + iron lantern bracket with warm glow + arched
  doorway + ring handle + moss at base + small red banner).
  **THIRD CROSS-AXIS TRIANGLE COMPLETE**: tower canvas (pre-loop)
  + 3D (pre-loop) + 170 SVG. Tower's triangle closed via SVG
  shipping last (different order than granary or windmill). SVG
  layer coverage now 5 of 11; ~half the building roster has SVG.

## how to update this doc

Future ticks that add sprites, meshes, or integration code touching
multiple layers SHOULD update this doc in the same commit. The
coverage map should track ✓/— per layer per building. The
authoring-cost table should add rows for new shared buildings.
Related-loops chronology should keep growing as the axes evolve.

If integration ships (SVG into the live game, or 3D meshes into
the canvas pipeline), this doc grows a new "integration" section
documenting how the layers compose.
