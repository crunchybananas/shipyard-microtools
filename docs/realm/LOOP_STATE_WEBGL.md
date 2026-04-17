# WebGL 3D Polish Loop — State File

**Branch:** `realm/webgl-polish`  
**Loop start:** 2026-04-16  
**Cycle mechanic:** Each cycle edits ONE file, commits, verifies visually, schedules next cycle at 900s.

---

## Goal

Make `window.toggle3D()` mode **clearly prettier** than the default Canvas 2D mode. 2D remains the fallback — add, don't replace.

---

## Cycle Mechanics

Each cycle (~15 min):
1. Read this file for context.
2. Screenshot both 2D and 3D modes (toggle via `window.toggle3D()` in console on tab 1347743485 at http://localhost:8000/realm/?_cb=N).
3. Spawn fresh-eyes VALIDATOR subagent with both screenshots — "which looks better, and why?"
4. Pick ONE improvement from validator critique. Edit ONE file per cycle.
5. `node --check <file>` if JS. Reload tab with bumped `?_cb=N`. Verify visually.
6. Commit on `realm/webgl-polish`. Update this file.
7. Schedule next cycle at 900s.

**Every 5th cycle: DEEP-PLAY** — place buildings, fast-forward, screenshot both modes mid-play.

**If one approach fails 3 cycles in a row:** pivot and note why.

---

## Hard Constraints

- Keep 2D mode working. Both modes must render.
- No npm/build steps. Vanilla ES modules. `python3 -m http.server 8000` in docs/.
- Stay on `realm/webgl-polish` — no commits to main.
- Never `alert()`, `confirm()`, `prompt()`.

---

## Known Gotchas

- Chrome caches ES modules — if live shows old behavior but curl returns new code, trust on-disk.
- Check console errors after each change — 60fps error loops freeze game.
- Game state: `window.G`. TILE enum in `js/state.js`. Map is 80×80 tiles.
- User hates: "pulsing," "ghostly," "smudges." Wants solid, distinct, readable.

---

## Improvement Priority (let validator guide order)

- [ ] Terrain texturing / per-vertex color noise
- [ ] Proper vertex normals + stronger directional light
- [ ] Tree/rock meshes readable at zoom
- [ ] Soft shadows / cheap AO
- [ ] Atmospheric fog near horizon
- [ ] Water surface shader (normal map + fresnel)
- [ ] Building meshes — remove DEBUG hot-pink marker

---

## Baseline Observations (Cycle 0, 2026-04-16)

### Code survey of `js/webgl3d.js` (874 lines)

**Architecture:**
- WebGL2 with WebGL1 fallback. VAO support. Single draw program for terrain + buildings.
- Terrain: 80×80 tiles, each an elevated box with top face + side faces. Water skips side faces.
- Trees: trunk (brown box) + pyramid canopy. Added on FOREST tiles in terrain mesh.
- Buildings: separate VAO rebuilt every 500ms. Distinct geometry per building type (house, farm, tower, church, barracks, market, castle, well, tavern, blacksmith, windmill).
- Camera: true isometric (arctan(1/√2) pitch, -45° yaw), orthographic projection centered on map center (40,40).

**Shader:**
- Vertex: passes aPos/aNormal/aColor through; vertex-displaced water wave animation.
- Fragment: `ambient = color * 0.35 + diffuse = color * NdotL * 0.8`. Light from (0.6, 0.8, -0.2) normalized. No fog, no specular, no shadows.
- orthoSize = 40 / zoom (default zoom ≈ 1.3 → orthoSize ≈ 30.8).

**Per-tile noise:**
- Deterministic hash noise adds ±12% height and ±15% color variation per tile. Breaks uniform look but can appear "dirty."

### Critical Bug Found

**Line 654–655 in `buildBuildingsMesh()`:**
```js
// DEBUG: Bright marker - bigger than building, hot pink, high
pushBox(verts, indices, cx-0.5, groundY, cz-0.5, cx+0.5, groundY+6.0, cz+0.5, [1.0, 0.0, 1.0]);
```
Every building renders a **6-unit tall hot-pink pillar** as a debug marker. Must be removed before buildings look usable.

### Visual Problems Ranked

1. **Hot pink debug pillars** on all buildings — critical, removes any building prettiness.
2. **Water dominates and shows triangle grid** — 3D view shows the entire 80×80 water plane with visible triangle tessellation lines (from color noise). Looks like a tech demo mesh.
3. **Island appears small/distant** — water tiles extend to all edges; the island (non-water tiles) occupies ~40% of view. 2D mode clips to just the island area.
4. **Trees invisible at zoom level** — trunk/canopy geometry exists but renders too small to read.
5. **Flat lighting** — ambient 0.35 is quite high, washing out the directional shading. Reducing ambient to 0.15–0.20 would give much stronger contrast on faces.
6. **No fog** — horizon reads as abrupt edge where water meets dark background.
7. **No specular/rim light** — everything matte.

### 2D vs 3D First Impression

2D: Bright, readable, colorful isometric with distinct grass/sand/forest/mountain tiles and animated sprites.  
3D: Small dark blob surrounded by huge blue tessellated water plane. Terrain unreadable. No visible buildings or trees.

---

## Cycle Log

### Cycle 0 — 2026-04-16
- Checked out `realm/webgl-polish`
- Read `js/webgl3d.js` (874 lines) + `js/main.js` integration
- Screenshotted 2D (tab 1347743485, _cb=115) and 3D modes
- Identified critical debug hot-pink marker bug + 5 major visual issues
- **No code changes** — survey only
- Spawned VALIDATOR subagent for baseline critique

### Validator Baseline Critique (Cycle 0)

**2D wins clearly. 3D problems ranked by impact:**

1. **Trees/sprites completely missing (highest impact)** — 2D has charming conifer sprites, settler characters, visible buildings. In 3D all sprites vanish. Map looks empty and dead. The 3D tree geometry exists (trunk+pyramid canopy) but renders too small to see at 80×80 zoom (~3–5px).
2. **Terrain reads as undifferentiated noise** — Every tile renders as two triangles forming diamond/pyramid faces. Dense uniform zigzag texture; cannot distinguish grass from forest from beach. Caused by per-tile color noise (±15%) + isometric tile boundaries creating visible zigzag lines.
3. **Interior water nearly invisible** — In 2D, inland water is a striking blue landmark. In 3D, shrinks to tiny jagged blue patch.
4. **Ocean water looks wrong** — Flat solid baby-blue fill with subtle repeating triangle texture. Reads as plastic tray. The triangle pattern comes from per-vertex color noise on water tiles creating slight color differences between adjacent tiles.
5. **Island has ragged staircase edges** — Blocky isometric extrusion creates harsh stair-step perimeter instead of smooth soft outline.
6. **Color palette goes muddy** — 3D shading darkens everything; grass→dark olive, sand→dark khaki, contrast between zones collapses.

**Validator's top recommendation:** Render the 2D sprite layer on top of 3D terrain. (Multi-cycle effort.)  
**Most actionable quick win per validator:** Fix #4 (water) and #6 (lighting/color) for immediate visual improvement.

---

### Cycle 1 — 2026-04-16
**Changes (js/webgl3d.js):**
- Removed hot-pink 6-unit debug pillar from `buildBuildingsMesh()` (was on every building)
- WATER tiles now skip per-vertex color noise (`cv = 0` for water) → eliminates triangle-grid artifact
- Fragment shader ambient: 0.35 → 0.20 (stronger directional contrast between lit/unlit faces)

**Visual result:** Water slightly more uniform. Terrain side-faces now have stronger contrast. Debug pillars gone (will show when buildings are placed). Triangle pattern in water still slightly visible (from mesh topology/JPEG artifacts, not color noise). Island still appears small/distant — zoom remains the next priority.

**Validator critique (cycle 1):**
- Water STILL noisy triangle-grid — coastline looks like torn paper (geometry/boundary issue, not just color)
- Terrain nearly unreadable: dark olive + khaki blur, mountains invisible, no distinct biomes
- No sprites/trees/settlers at all — island looks barren
- Extreme darkness: side faces pre-darkened 0.75× THEN only get 0.20 ambient → ~15% of base color (near black)
- Zoom still too far out — island ~50% of screen, looks like a thumbnail
- Single highest-impact fix per validator: add sprite billboards for trees/mountains + reduce side-face shadow darkening

---

## Next Cycle Plan

### Cycle 2 — 2026-04-16
**Changes (js/webgl3d.js):**
- `buildViewProjection()`: orthoSize 40/zoom → 18/zoom (2.2× zoom)
- `buildTerrainMesh()`: removed `sideColor * 0.75` pre-darkening; side faces now use base color, shader handles differentiation

**Visual result:** Island somewhat larger in view. Side faces brighter (no more near-black sides). However island still surrounded by lots of blue water. Terrain noise still creates busy/unreadable biomes.

**Validator critique (cycle 2):**
- ✅ Island now ~60% viewport width — clear zoom improvement
- ✅ Side faces markedly brighter / tan edges readable
- ⚠️ Side shading uniform (no left/right differentiation), reads as flat-sided not volumetric
- ✅ Grass vs sand vs mountain zones now distinguishable by color
- ❌ **Most damaging**: Top surface is a flat textured carpet — ZERO elevation relief. All top faces share [0,1,0] normal regardless of actual height, so no shading difference between mountain (h=3.5) and lowland (h=0.8).
- 💡 **Next fix**: Per-vertex normals on top faces derived from height-field gradients → visible slope shading between high/low tiles

---

### Cycle 3 — 2026-04-16
**Plan:** Height-field top-face normals in `js/webgl3d.js`
- Pre-compute heights grid at start of `buildTerrainMesh()`
- Add `pushFaceNormals()` helper (per-vertex normals instead of single normal)
- For each tile's top face, compute 4 corner normals from finite differences of neighboring heights
- Mountains/hills will face light differently than flat ground → visible elevation relief

**Visual result (zoomed in):** Height-field normals ARE working — mountain/highland interior shows clear darker shadow gradients vs. flat ground. Inland water patches visible. BUT ±15% per-tile color noise is masking the normals with overwhelming triangle contrast noise.

**Validator critique:** *(pending)*

---

## Next Cycle Plan

**Cycle 4:** Reduce terrain color noise from ±15% to ±5% (`noise2 * 0.15` → `noise2 * 0.05`). This lets the height-field normals actually show through instead of being masked by per-tile color chaos. Also boost diffuse strength (`NdotL * 0.8` → `NdotL * 1.1`) so lit faces are brighter.

---

### Cycle 5 — 2026-04-16
**Changes (js/webgl3d.js):**
- Separate terrain/tree index ranges in same VAO: trees drawn after terrain with `gl.depthFunc(gl.ALWAYS)` to defeat ortho depth inversion (tall objects have HIGHER z_clip depth = fail LEQUAL against flat terrain)
- Buildings also drawn with `gl.depthFunc(gl.ALWAYS)`
- Side faces culled when `tileBaseH(neighbor) >= h` → eliminates intra-biome wall grid
- Water top face uses flat `[0,1,0]` normal → no per-tile shading variation on water
- Geometry height noise zeroed (`h = baseH`); `tileH()` noise retained for slope normals
- All debug code removed (orange grass, red box, count log)
- Added `terrainIndexCount` / `treeIndexCount` module vars

**Visual result:** HUGE improvement. Water plane clean/flat. Island outline sharp with proper biome-height steps. Trees clearly visible as green pyramids. Buildings visible. Triangle grid eliminated within flat biomes.

---

### Cycle 6 — 2026-04-16
**Changes (js/webgl3d.js):**
- Attempted `gl.depthFunc(gl.LEQUAL)` for trees (validator recommended) → trees invisible
- Root cause confirmed: `z_eye = s*y + c*z_ry` where s=sin(-35.26°)=-0.578, so tall objects get MORE NEGATIVE z_eye → HIGHER depth → fail LEQUAL. Reverted to ALWAYS.
- Removed trunk boxes from `addTree()` — canopy-only pyramids read clearly; trunk boxes filled forest floor with brown clutter
- Set `trunkH = 0.3*S` so canopy base starts slightly above ground

**Visual result:** Forest now reads as legible canopy of green pyramids. Much cleaner than trunk+canopy version. Island looks like a proper settlement map.

---

## Next Cycle Plan

**Cycle 7:** Brighten grass + raise ambient. **Cycle 8:** Tree density 40% hash. **Cycle 9:** lz -0.2→0.5, both faces lit.

**Visual result (cycles 7-9):** Bright lime-green grass, readable sparse forest, lit terrain faces, buildings visible with 3D depth.

**Cycle 10:** Make buildings more visually distinct — currently all read as grey boxes at zoom-out. Boost building scale multiplier from S=3.5 to S=4.5, and give house a warmer tan (`[0.92, 0.72, 0.48]`), church off-white (`[0.96, 0.92, 0.84]`), castle/tower a cooler blue-grey (`[0.52, 0.54, 0.62]`) to break up the monochrome grey blob.

### Cycle 10 — 2026-04-16
**Changes (js/webgl3d.js):**
- `addTree()` now accepts variable `S` scale parameter (default 2.8)
- Tree scale randomized 1.8–3.4 via deterministic tile hash (`treeSeed >>> 8`)
- `treeTiles[]` stores `[cx, cz, groundY, scale]` tuples

**Visual result:** Forest reads as natural mixed-height canopy instead of uniform carpet. Organic silhouette. Buildings visible in clearing but still small.

---

### Cycle 11 — 2026-04-16
**Changes (js/webgl3d.js):**
- Building scale S: 3.5 → 4.0 (tried 5.5, too dominant, settled on 4.0)
- House walls brightened: `[0.82,0.62,0.38]` → `[0.94,0.88,0.72]` (cream)
- House roof more vivid: `[0.78,0.22,0.18]` → `[0.88,0.18,0.12]` (vivid red)

**Key finding:** Chrome ES module cache must be busted with Cmd+Shift+R (hard refresh), not just ?_cb= URL bump. Module at cached line 673 ≠ current line 684 = stale execution. Also: injected test buildings need full schema `{hp:100, workers:[], active:true, prodTimer:0, level:1, buildProgress:1}` — missing `workers` crashes economy.js.

**Visual result:** Buildings clearly visible with distinct shapes — church steeple, tower, castle corner towers, windmill blades all readable. Cream house walls + vivid red roof landmark visible against green canopy.

**Validator recommendation (cycle 11):**
1. Buildings grey — fix colors/roof → DONE (partially: house now cream+red; other types still grey-ish)
2. Dark navy void background — "floating island in space" breaks immersion
3. Blocky shoreline staircase edges

---

## Next Cycle Plan

**Cycle 12:** Replace flat dark navy background with a sky gradient. Currently `gl.clearColor(0.05, 0.05, 0.12, 1.0)` paints a solid dark void. Change to a light blue sky gradient rendered as a fullscreen quad before the terrain pass — this would make the ocean water blend into a horizon rather than cutting off at a hard dark boundary. Alternatively, just brightening the clear color to a lighter horizon blue `(0.55, 0.75, 0.90)` would immediately improve the "floating island" feel.

### Cycle 12 — 2026-04-16
**Changes (js/webgl3d.js):**
- `gl.clearColor` changed from dark navy `(0.08, 0.10, 0.18)` → sky blue `(0.45, 0.68, 0.88)`

**Visual result:** Major transformation. Island now sits in a coherent sky/water world instead of floating in space. Ocean water blends naturally into sky background. Buildings clearly visible (church steeple, tower, castle corner towers, brown house/tavern). The scene feels like a proper game.

**Key learning:** ES module cache — must Cmd+Shift+R (hard refresh) after every code change, not just ?_cb= bump.

---

## Next Cycle Plan

### Cycle 13 — 2026-04-16
**Changes (js/webgl3d.js):**
- Water color `[0.10,0.40,0.75]` → `[0.38,0.65,0.87]` — now matches sky hue
- Fragment shaders (WebGL2 + WebGL1): `smoothstep(30.0, 46.0, fogDist)` fog blends geometry toward sky `(0.45,0.68,0.88)` at 80% weight near map edges

**Visual result:** Ocean and sky now read as one coherent blue environment. Hard ocean cutoff eliminated. Island sits naturally in sky-water world. Forest pyramid density still dominates — most prominent remaining issue.

---

## Next Cycle Plan

### Cycle 14 — 2026-04-16
**Changes (js/webgl3d.js):**
- Tree density: `(treeSeed % 10) < 4` → `(treeSeed % 25) < 7` (~28% of FOREST tiles)
- Scale range: 1.8–3.4 → 1.4–2.6 (smaller canopy radius, less overlap)
- Canopy color: `[0.22,0.82,0.28]` → `[0.18,0.60,0.22]` (forest green, not neon lime)
- Dark face: `[0.14,0.55,0.18]` → `[0.11,0.40,0.14]`

**Visual result:** Terrain floor visible between trees, island biomes readable. Forest reads as forest glade not solid carpet. Mountains much more visible in center.

**Validator (subagent) consensus:** Tree density was #1 issue. Next: mountains look like grey concrete rubble (#2). Life/animation (#3 — addressed by GLTF mesh effort below).

---

## Open Source Mesh Research (subagent, 2026-04-16)

Best free CC0 GLTF sources for this project:

| Pack | Source | License | Coverage |
|------|--------|---------|----------|
| **KayKit Medieval Hexagon** | kaylousberg.itch.io/kaykit-medieval-hexagon | CC0 | 9/11 building types (church, tavern, blacksmith, windmill, barracks, well, market, house) + trees + rocks |
| **Kenney Nature Kit** | kenney.nl/assets/nature-kit | CC0 | Trees, rocks, foliage in GLB |
| **Kenney Fantasy Town Kit** | kenney.nl/assets/fantasy-town-kit | CC0 | 160 medieval building GLBs |
| **Quaternius Medieval Village MegaKit** | quaternius.itch.io/medieval-village-megakit | CC0 | 300+ modular pieces, GLTF |

**Technical path:** Write ~100-line `loadGLB(url, gl)` vanilla JS parser. GLB = 12-byte header + JSON chunk + binary buffer chunk. For static diffuse meshes, only need POSITION/NORMAL/indices. Fits cleanly into existing webgl3d.js VAO pattern.

**Recommended:** Download KayKit Medieval Hexagon (covers most buildings + nature), write minimal GLB loader, replace pyramid trees and box buildings over 3–4 cycles.

---

## Next Cycle Plan

### Cycle 15 — 2026-04-16
**Changes (js/webgl3d.js):**
- STONE top face: `[0.74,0.70,0.66]` (warm pale rock) vs dark grey `[0.60,0.58,0.56]` sides
- MOUNTAIN top face: `[0.88,0.88,0.92]` (snow cap) vs grey `[0.42,0.42,0.48]` sides
- Note: MOUNTAIN is only 12 tiles on a typical map; STONE (109 tiles) was the visible fix
- Side note: IRON tiles `[0.35,0.52,0.72]` produce a blue hue — could be toned down later

**Visual result:** Rocky terrain reads as carved stone with clear depth. Stone outcroppings have proper top-side contrast. Not concrete anymore.

---

## Next Cycle Plan

### Cycle 16 — 2026-04-16
**New files:**
- `js/glb-loader.js` — 80-line vanilla GLB parser (header → JSON chunk → BIN chunk → POSITION+NORMAL+indices)
- `assets/meshes/tree_pineDefaultA.glb` (17KB), `tree_pineTallA.glb` (7KB), `tree_pineSmallC.glb` (5.3KB) — Kenney Nature Kit CC0

**Changes (js/webgl3d.js):**
- Imports `loadGLBGeometry` from `./glb-loader.js`
- GLBs load async on `initGL3D()`, trigger `buildTerrainMesh()` rebuild when ready
- `inlineGLBTree()` transforms GLB geometry into terrain VAO at each tree position (scale 0.38× of tile scale)
- Falls back to pyramid if GLB not yet loaded
- Removed noisy per-frame "No buildings to render" log

**Visual result:** Real multi-tiered Kenney pine conifers render in place of flat pyramids. Trees have proper normals and directional shading. Recognizable as forest.

**Remaining issue:** Trees somewhat small at scale 0.38. Some tree variants may show z-fighting or clipping at ground level.

---

### Cycles 17–19 — 2026-04-16

**Cycle 17:** Tree scale tuned to 0.55× (from 0.38×). 3 Kenney Nature Kit pine GLBs load as `glbTreeVariants`. Trees now properly sized, recognizable as conifers. Trees raised `groundY + 0.08` to prevent clipping into terrain.

**Cycle 18:** Added `js/glb-loader.js` invocation for 10 Kenney Hexagon Kit building GLBs in `assets/meshes/buildings/`. `initGL3D()` loads all 10 async; `buildBuildingsMesh()` uses `inlineGLBTree()` to render GLB geometry per type.

**Cycle 19 (2026-04-16):**
- Building scale: 0.30 → 0.65 (buildings were invisible at 0.30, now fill ~1 tile each)
- Per-type colors added via `GLB_COLORS` map in `buildBuildingsMesh()`:
  - house=tan, farm=earthy, tower=blue-grey, church=cream, barracks=slate, market=gold, castle=dark stone, tavern=warm wood, blacksmith=dark metal, windmill=cream
- Removed noisy rebuild logs from `buildBuildingsMesh()`

**Visual result:** Buildings clearly visible as Kenney hexagon-style structures with their characteristic hex base platforms. Distinct colors per type make settlement readable. 10 building types covered.

**Remaining issues:**
1. Kenney hex base tiles visible below buildings (dark hexagons) — by design, but may look odd in square-tile context
2. Buildings render as single-color flat-lit — no material variation within one model
3. Types with no GLB mapping (lumber_mill, granary, fisherman_hut) fall back to procedural geometry

---

### Cycle 20 — 2026-04-16
- Building scale: 0.65→0.80 for better visibility
- Hex base burial: sink buildings 0.42 units so dark hex platform is mostly underground
- Default zoom: 1.3→1.7 so island fills viewport

### Cycle 21 — 2026-04-16
- Added `citizensVao` rebuilt every render frame
- Citizens render as colored body+head box pairs (6 colors: red, blue, green, yellow, purple, teal)
- Skin-tone head cap on each citizen
- **World now feels alive** — settlers move smoothly in 3D

**Visual result (confirmed via screenshot):** Citizens clearly visible as small colored figures against green terrain. Red and blue settlers standing next to buildings. Massive life improvement.

---

## Next Cycle Plan

**Cycle 22:** Make buildings MORE recognizable at default zoom. Options:
1. Source Kenney Fantasy Town Kit GLBs — more medieval silhouettes (peaked roofs, towers, arches)
2. Increase base color brightness in shader (ambient 0.20 → 0.25) so buildings read better at distance
3. Add enemy/raid rendering with red color so combat is visible in 3D
