# render-layers.md

**Status:** Written in tick 165. Updated 167, 168, 170, 172.
Maintained by subsequent loops as new sprites/meshes land or the
integration story changes.
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
  (170, 188 LoC), house (173, 194 LoC), tavern (175, 239 LoC),
  blacksmith (176, 223 LoC), market (179, 234 LoC), bakery
  (180, 230 LoC), barracks (182, 242 LoC) — **11 of 11 — FULL
  SVG ROSTER COMPLETE** (Phase A formally closed at 182).
  Total: ~2401 lines across 11 sprites.

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
  granary (post-163), windmill (post-167), barracks (post-183),
  tavern (post-185), blacksmith (post-186), market (post-187)
  — **11 of 11 user-buildable roster — 3D LAYER COMPLETE**.
  (Plus barn from pre-loop has no canvas/SVG sibling — 3D-only;
  farm has no SVG/3D — canvas-only.)

### asset/meshes/ — LOOP DOES NOT TOUCH

`docs/realm/assets/meshes/buildings/*.glb` (10 buildings) +
`assets/meshes/tree_*.glb` (3 trees) exist but are **NOT loaded**
by the 3D prototype. The .glb files change outside the loop's
awareness (showed up in `git status` repeatedly across many
ticks; presumably from a separate Blender / asset pipeline). The
3D prototype generates its own procedural meshes in JS via the
`Mesh` class.

**Boundary (set 172, post-171 strategic decision):**
- Loop ticks DO NOT modify, regenerate, or load the .glb files.
- Loop ticks DO NOT attempt to reconcile procedural 3D meshes
  with .glb files.
- If a future tick wants to bridge them, that's a deliberate
  scope expansion requiring user steering — not an emergent
  loop decision.

This boundary prevents future ticks from spending effort on
reconciliation that the user hasn't requested. The .glb pipeline
is treated as an external system.

## the cross-axis triangle

**Granary is the first building expressed in all three layers**;
**windmill is the second** (post-168):

| Building | Canvas | SVG | 3D  | Pattern |
| -------- | -----: | --: | --: | ------- |
| granary  | 158 (~75 LoC) | 161 (172 LoC) | 163 (~15 LoC) | canvas → SVG → 3D |
| windmill | 094/096/158 (~70 LoC) | 168 (213 LoC) | 167 (~25 LoC) | canvas → 3D → SVG |
| tower    | pre-loop (~42 LoC) | 170 (188 LoC) | pre-loop (~15 LoC) | canvas + 3D pre-loop → SVG |
| barracks | pre-loop (~115 LoC) | 182 (242 LoC) | 183 (~25 LoC) | canvas pre-loop → SVG → 3D |
| tavern   | pre-loop (~120 LoC) | 175 (239 LoC) | 185 (~25 LoC) | canvas pre-loop → SVG → 3D |
| blacksmith | pre-loop (~140 LoC) | 176 (223 LoC) | 186 (~30 LoC) | canvas pre-loop → SVG → 3D |
| market   | pre-loop (~90 LoC)  | 179 (234 LoC) | 187 (~23 LoC) | canvas pre-loop → SVG → 3D |

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
tick 172:

| Building     | Canvas | SVG (161+) | 3D (163+) |
| ------------ | :----: | :--------: | :-------: |
| castle       |   ✓    |    ✓ (162) |    ✓      |
| church       |   ✓    |    ✓ (164) |    ✓      |
| granary      |   ✓    |    ✓ (161) |    ✓ (163)|
| house        |   ✓    |    ✓ (173) |    ✓      |
| tower        |   ✓    |    ✓ (170) |    ✓      |
| barn         |   —    |     —      |    ✓      |
| windmill     |   ✓    |    ✓ (168) |    ✓ (167)|
| farm         |   ✓    |     —      |     —     |
| tavern       |   ✓    |    ✓ (175) |    ✓ (185)|
| blacksmith   |   ✓    |    ✓ (176) |    ✓ (186)|
| market       |   ✓    |    ✓ (179) |    ✓ (187)|
| bakery       |   ✓    |    ✓ (180) |     —     |
| barracks     |   ✓    |    ✓ (182) |    ✓ (183)|
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

## strategic plan (post-171)

171 (meta) made the strategic call after 5 SVG sprites + 3 cross-
axis triangles. The decision: **target live integration**, not
sandbox-only — but staged in three phases so neither risk nor
investment outpaces evidence.

### Phase A — complete the sprite roster (~5 ticks)

Continue current cadence to ship sprites for the remaining 6
buildings: house, tavern, blacksmith, market, bakery, barracks
(possibly farm). House first (simplest); tavern has most
narrative weight; the rest in roughly visual-complexity order.

Variety ticks (surprise / refactor / fixer) interleave at
~30-40% rate. At one sprite per ~2-3 ticks, Phase A ends near
tick ~180-185.

**Don't integrate at 5/11** — half-roster integration creates
two visual styles in the live game (some SVG, some canvas)
which is worse than either end-state. 9-11/11 is the critical-
mass threshold.

### Phase B — integration sprint (~~3-5 ticks~~ shipped 216-221, 6 ticks)

**COMPLETE as of tick 221.** All 6 steps shipped. Live game now
ships SVG sprites with per-realm variants by default. Canvas drawX
remains as fallback for unloaded sprites + non-sprite types
(farm/lumber/well/etc).

1. **216 — Scaffolding.** `_USE_SVG_SPRITES` flag (default false)
   + lazy loader + `drawSpriteIfReady` dispatch hook + console
   toggle `window.__realm.toggleSVG()`.
2. **217 — Anchor + sizing.** Per-building `_SPRITE_SIZES` table.
   SVG path moved INSIDE the scale/translate envelope so damage
   cracks + winter cap compose correctly on either path. (216
   originally had an early-return bug skipping composition.)
3. **218 — Winter cap.** Free win from 217's structural fix.
   `_WINTER_CAPS` overlay composes on SVG sprites identically
   to canvas. Verified via 2 winter screenshots.
4. **219 — Hover halo + fog.** Free win — both layers render
   OUTSIDE drawBuilding (halo at line ~1150 after building loop;
   fog at line ~1111 before, only on unfogged tiles where
   buildings live). Z-order independent of dispatch path.
5. **220 — Per-realm variants.** First real-code step. Fetch +
   string-replace + Blob URL pipeline. `_VARIANT_PALETTES` table
   with church glass shipped as proof (4 palettes blue/red/
   amber/green; kingdom-hash picks per realm). Loader signature
   `_loadSprite(type, kname)`; cache key `${type}__${kname}`.
   Closes 164 filed (76 ticks). Verified 4 kingdoms → 3 distinct
   palettes.
6. **221 — Live-game enable.** Flag default flipped to TRUE.
   Module-init eager preload populates default cache so first
   frame dispatches to SVG immediately. Per-kingdom variants
   load lazily on first dispatch (one-frame canvas fallback per
   type per realm — acceptable). Console toggle preserved as
   rollback path: `window.__realm.toggleSVG(false)` reverts to
   canvas if needed.

Rollback: set flag false via console. Per-step verify scripts
in `docs/realm/scripts/` provide regression tests:
- `verify.mjs` — smoke (game + sandbox + logic)
- `verify-logic.mjs` — targeted state tests (10 items)
- `verify-phaseb.mjs` — toggle + winter + halo
- `verify-variants.mjs` — per-realm palette distribution
- `verify-default-svg.mjs` — default-flag-true sanity

### Phase C — animation polish (~2-3 ticks)

After integration, ship animation:
- Animated windmill sails (rotation around hub axis)
- Castle pennants + flag sway
- Tower lantern flicker + banner sway

Use `<animate>` or CSS keyframes for SVG-internal animation;
fall back to canvas-pipeline timer-driven re-render if the SVG
animation path doesn't compose with the integration approach.

### What's deferred

- **3D engine canvas-replacement.** Architectural cost of
  switching the live game to WebGL2 exceeds the visual gain.
  3D stays standalone exploration.
- **.glb mesh reconciliation.** External pipeline; loop boundary
  set above.
- **Tower / market / specialized building canvas redraws.** The
  canvas drawX functions can be improved INDEPENDENTLY of SVG
  integration. Both axes survive.

### Loop 215 update — 3D axis explicitly RETIRED for the loop

User flagged at tick 215: "the 3d version still seems like a
dead end as I see no progress." Honest accounting:

- **11 meshes shipped 163-187** (granary / castle / church /
  windmill / tower / house / tavern / blacksmith / market /
  barracks / + scaffolding) live in `docs/realm/3d/3d.js` as a
  STANDALONE prototype.
- **They are not integrated into the live game** and no path
  to integration was planned. 171's strategic plan correctly
  deferred 3D-canvas-replacement; the loop kept shipping
  meshes anyway as chrome-offline fallback work.
- **The "cross-axis triangle" framing oversold the value.**
  Triangle = canvas + SVG + 3D for each building. In practice
  only canvas reaches the player today. SVG awaits Phase B.
  3D awaits an integration architecture that doesn't exist.

**Effective immediately**, the 3D axis is RETIRED as a loop
priority:
- No further 3D mesh ships until chrome returns AND a concrete
  integration plan exists (rendering 3D into the live game,
  not sandbox).
- The 11 existing meshes stay as reference artifact in
  `docs/realm/3d/`. Don't delete; don't extend.
- 161's user steering ("really focus on the svg generation /
  rethink them or think about the 3d engine version") is
  re-interpreted: SVG is the live-game path (Phase B). 3D
  was exploration; exploration concluded.
- The "cross-axis triangle invariant" in narrative-surfaces.md
  / observed-patterns context is renamed/demoted: it was
  describing breadth-of-prototype, not breadth-of-live-game.

**What replaces it as priority while chrome is offline:** narrative
ships that reach the player (chronicle prose runs in chrome-
present and chrome-offline equally; players see beats on
reload). Mechanic ships that don't require visual verification
to be correct (math-checkable). Doc/discipline ticks that
maintain the loop's coherence. NOT graphics-axis exploration
that doesn't reach the player.

**When chrome returns:** Phase B remains the priority — it has
been blocked 35+ ticks. After Phase B ships, the loop can
re-evaluate whether 3D integration is worth a fresh attempt.
Until then, treating 3D as "ongoing axis" is dishonest about
where the loop's work lands.

### Dates are estimates

The phase-tick numbers are pace estimates, not commitments.
User steering can accelerate or decelerate. The PHASE STRUCTURE
is the durable artifact, not the tick numbers.

## visual-debt log (post-182)

User flagged 2026-04-28: chrome-mcp fell out of habit during the SVG
sprite arc. All 11 SVG sprites shipped with **static-only verification**
(`node --check` of touched JS, XML parse of SVG, git diff). No browser
ever loaded the sandbox at `/svg-test/`. Visual quality is the WHOLE
POINT of this axis; this is a real gap.

**Catch-up batch (when chrome-mcp comes back):**

1. Open `http://localhost:8889/svg-test/` (after `python3 -m http.server
   --directory docs/realm 8889`). Verify each of the 11 sprites at the
   four zoom levels (48/96/192/384px) renders correctly: no broken
   gradients, no clipped shapes, no collapsed paths.
2. Compare each SVG to its canvas-equivalent at matching scales (run
   the live game in another tab; place each building at the same iso
   tile). Note where SVG looks better, worse, or off-spec relative to
   canvas.
3. Stress test: render multiple instances of each sprite on the sandbox
   page to estimate paint cost (will inform Phase B integration
   approach — `<img>` lazy-load vs inline fetch vs sprite atlas).
4. Photo-mode-zoom verification: view each at 384px equivalent (5×
   in-game zoom). Confirm vector-crispness claims hold (especially gold
   spire on castle, cross emblem on flag, cruciform arrow slits on
   tower/barracks).

**Discipline going forward (per
`feedback_realm_loop_visual_verification.md`):** every visual-shipping
tick MUST attempt `mcp__claude-in-chrome__tabs_context_mcp` first. Only
file `live-verify` after the connection actually fails. Phase B
integration ticks (post-183) cannot ship without chrome — there's no
static-only equivalent of "did the day/night tint actually composite
correctly under the SVG sprite."

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
- **171** — strategic-decision check-in (meta, 165-filed).
  Adopted **3-phase plan toward live integration**: Phase A
  (complete sprite roster ~5 ticks) → Phase B (integration
  sprint ~3-5 ticks via `_USE_SVG_SPRITES` feature flag) →
  Phase C (animation polish ~2-3 ticks). 3D engine declared
  standalone (canvas-replacement architectural cost exceeds
  gain). .glb meshes declared "loop does not touch."
- **172** — captures 171's strategic plan as a durable doc
  artifact (new "strategic plan (post-171)" section). Status
  line + coverage map header dated through 172. .glb-meshes
  section gains explicit BOUNDARY language (loop does not
  modify, regenerate, load, or reconcile). Future fresh-
  context ticks now inherit the integration plan by reading
  this doc.
- **173** — Phase A start. SVG house sprite ships (194 lines:
  half-timber wall accents + red-tile pitched roof with ridge
  highlight + brick chimney with smoke wisps + glowing window
  with 4-pane mullions + flowerbox with red/yellow/white
  flowers + plank wooden door with iron studs and ring handle).
  Canvas drawHouse picks 1 of 4 roof variants × 2 chimney
  positions × extra-window via per-house hash; SVG ships the
  CANONICAL variant (red tile + right chimney + single window).
  Per-instance variation deferred to Phase B integration step
  5. SVG layer coverage 5 → 6 of 11 (Phase A: 1 of 5).
- **174** — first-frost beat (surprise; non-graphics variety
  break in Phase A). Year-2+ autumn day ≥ 45; sibling to 147
  great-storm pairs past-tense memory + present-tense
  observation in same season.
- **175** — Phase A 2/5. SVG tavern sprite ships (239 lines:
  warm wood walls + half-timber posts + plank pattern + amber
  pitched roof with ridge highlight + roof-top flag (051
  silhouette-distinguishability fix) + side sign board with
  bracket and chain + mug emblem + 2 glowing windows with
  mullions + warm hearth glow leaking out door + cobblestone
  path + hanging harvest bundle + iron strap hinges + door
  ring handle + door slightly-ajar warm crack of light).
  Canvas drawTavern picks 1 of 4 sign-color palettes × 4
  emblems = 16 variants; SVG ships canonical gold + mug.
  SVG layer 6 → 7 of 11 (Phase A: 2 of 5).
- **176** — Phase A 3/5. SVG blacksmith sprite ships (223
  lines: dark stone walls (industrial contrast vs tavern) +
  side-wall depth + flat parapet roof + arched forge window
  with bright amber fire core + ash pile under window with
  embers + 4 rising smoke wisps from chimney (industrial coal
  smoke, darker than house's) + 3 spark dots above forge +
  iron tongs hanging on wall + iron-banded wooden door (3
  bands, iron studs, ring handle) + anvil prop with horn +
  hammer mid-strike on anvil + propped hammer against wall +
  ambient orange ground glow near forge). Canvas drawBlacksmith
  picks 1 of 6 fire palettes (amber/purple/green/white/blue);
  SVG ships canonical amber. SVG layer 7 → 8 of 11 (Phase A:
  3 of 5).
- **177** — narrative-surfaces.md catch-up; documents 166
  frog + 174 frost. Caught math mistake in 166's day-gate.
- **178** — fixer for 177-found bug: 166 frog day-gate
  70 → 35.
- **179** — Phase A 4/5. SVG market sprite ships (234 lines:
  open-air covered stall (most distinct silhouette in
  roster — only no-walls building) + 2 wooden support posts
  with caps + striped trapezoidal red awning with white
  vertical stripes + scalloped awning fringe + hanging
  price-tag bunting (yellow triangular pennants) + wooden
  counter with grain pattern + sunlit shelf edge + bread
  loaves with score lines + apples with stem and leaf and
  highlights + coin pile / tip jar between goods + barrel
  prop on left with 3 hoops + crate prop on right with
  stacked smaller crate + scattered cobblestones underfoot).
  Canvas drawMarket picks 16 variants (4 awning palettes ×
  4 goods); SVG ships canonical red + bread+apples. SVG
  layer 8 → 9 of 11 (Phase A: 4 of 5). **9/11 = PHASE B
  CRITICAL MASS THRESHOLD REACHED per 171 strategic plan.**
- **180** — **PHASE A 5/5 (sprint).** SVG bakery
  sprite ships (230 lines: warm plaster walls + half-timber
  posts + plaster texture + stone base + sunlit edge + lower-
  wall warm spill (oven heat through wall) + terracotta
  pitched roof with sunlit ridge highlight + 4 tile rows +
  chimney with 4 dough-light smoke wisps (white-grey, gentler
  than blacksmith's coal-smoke) + brick courses + cap +
  arched oven-warmth window with bright cream core + warm
  yellow halo + **drawn hanging bread-loaf sign** (replaces
  canvas's emoji 🍞 with proper SVG bread + score lines +
  bracket + chain links) + iron-banded wooden door with
  strap hinges + ring handle + warm light spilling under
  the door + **bread paddle leaning against wall** (NEW)
  + flour dust on doorstep area (NEW) + warmth flecks near
  oven). Domestic warmth complement to blacksmith's
  industrial forge — same "fire inside" structural
  language but warm domestic palette. SVG layer 9 → 10 of
  11 (Phase A: 5/5 COMPLETE). **Only barracks remains
  un-SVG'd of the live-game roster.** Per 171 strategic
  plan, **Phase B integration sprint becomes appropriate
  next**.
- **181** — meta. Phase A milestone review (sibling to 100/
  157/171). 3 emergent patterns documented (interior-OPEN
  idiom, tools-propped idiom, family-palette correspondences).
  Per-instance variation finding: 5 of 10 sprites have canvas
  hash variants (70+ configurations) that SVG ships single-
  variant — Phase B step 5 is HEAVIER than 171 estimated.
  Animation finding: 4 of 10 sprites have canvas animations
  — Phase C MEDIUM not LOW. Decision: barracks at 182 before
  Phase B. Revised timeline ~+5 ticks.
- **182** — **PHASE A 11/11 — FULL ROSTER COMPLETE.** SVG
  barracks ships (242 lines: cool grey-blue stone + cruciform
  arrow slits (matching tower 170) + crenellations + iron-
  banded door + tall flag pole + red banner with white stripe
  + training dummy on left (post + sack body + rope bindings
  + painted target head + worn struck spots) + **weapons rack
  on right** (NEW: 3 spears + round shield with red-cross
  emblem) + cobble path. Defensive-industrial family palette.
  SVG layer **11 of 11 ROSTER COMPLETE** (~2401 lines total).
  **Visual-debt log added to this doc** capturing the 11-
  sprite catch-up batch needed when chrome-mcp returns.
- **183** — Phase B was scheduled here per 181 plan but
  REQUIRES chrome-mcp for visual verification of composition
  (no static-only equivalent for "did the day/night tint
  composite correctly under the SVG sprite"). Chrome offline
  → 183 pivots to **3D barracks mesh** (chrome-independent;
  3D prototype is its own page and renders standalone).
  Cross-axis triangle for barracks now complete (canvas
  pre-loop + 182 SVG + 183 3D). 3D layer 7 → **8 of 11**.
  **Cross-axis triangles complete: 7 of 11** —
  castle/church/house (canvas + SVG + 3D pre-loop +
  loop-shipped SVG), granary (158/161/163),
  tower (170 + pre-loop 3D), windmill (094/096/158/167/168),
  barracks (canvas pre-loop / 182 / 183).
- **184** — surprise (chrome-offline interleave). Stone
  arc closes with `stone_forgotten` beat — fourth beat on
  056/079/122 standing-stone arc. Chrome-independent,
  narrative-only.
- **185** — Phase B still blocked on chrome; fallback queue
  continues with **3D tavern mesh**. Sibling to 175 SVG.
  Form: warm-wood walls box + amber pyramid roof + roof-
  top flag pole + flag + side sign board with bracket arm
  + small dark door. Per 181 milestone-review's family-
  palette correspondence (warm-wood family with house +
  bakery). 3D layer **9 of 11**; **8 of 11 cross-axis
  triangles complete**. 2 buildings still need 3D meshes:
  blacksmith / market.
- **186** — Phase B still blocked; fallback queue 3/3 with
  **3D blacksmith mesh**. Sibling to 176 SVG. Form:
  defensive-industrial family palette (matches tower /
  barracks dark stone tone, slightly warmer toward iron-
  grey); walls box (taller than tavern — fortified
  industrial framing) + flat parapet (no pyramid) + heavy
  chimney projecting above parapet + **bright saturated-
  amber forge-fire box** on front face (per-vertex flat
  color is the 3D prototype's only color mechanism, so
  the forge appears as a small glowing cube against dark
  walls — acceptable affordance even without emissive
  shading) + iron-banded door + 3-box anvil prop with
  horn extending forward. 3D layer **10 of 11**; **9 of
  11 cross-axis triangles complete**. **Only market
  remains unmeshed** — its trapezoidal awning would
  benefit from the filed `pushFrustum` primitive.
- **187** — Phase B still blocked; **3D market mesh —
  CLOSES 3D ROSTER 11/11**. Open-air stall: counter wide-
  low-box + 2 wooden support posts + awning (slightly-
  wider box; pushFrustum filed but not shipped — box
  silhouette reads acceptably as trapezoid awning at iso
  scale) + awning ridge highlight thin top strip + barrel
  prop. Reused all-pushBox primitives. **Cross-axis
  triangle for market complete** (canvas pre-loop / 179
  SVG / 187 3D). **3D layer 11/11 ROSTER COMPLETE.**
  **All 11 user-buildable buildings now have full cross-
  axis triangles (canvas + SVG + 3D).** Only edge cases:
  barn is 3D-only with no canvas/SVG sibling; farm is
  canvas-only with no SVG/3D sibling. Visual-debt batch
  grows to 21 items (11 SVG sprites + 10 3D meshes).
  After 187, the loop has no chrome-independent SVG/3D
  ship work remaining — must pivot to non-graphics
  ticks until chrome returns.

## how to update this doc

Future ticks that add sprites, meshes, or integration code touching
multiple layers SHOULD update this doc in the same commit. The
coverage map should track ✓/— per layer per building. The
authoring-cost table should add rows for new shared buildings.
Related-loops chronology should keep growing as the axes evolve.

If integration ships (SVG into the live game, or 3D meshes into
the canvas pipeline), this doc grows a new "integration" section
documenting how the layers compose.
