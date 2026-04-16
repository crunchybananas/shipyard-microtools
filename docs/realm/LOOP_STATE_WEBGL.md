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

**Cycle 7:** Brighten the scene — grass is too dark/olive. Two changes:
1. Increase ambient from `0.15` to `0.25` in fragment shader
2. Increase GRASS color brightness: `[0.30, 0.66, 0.33]` → `[0.40, 0.78, 0.42]`
This should make the island pop vs the dark navy background and bring it closer to the 2D mode's bright green palette.
