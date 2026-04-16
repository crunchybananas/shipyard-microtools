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
*(See validator output below — populated after subagent returns)*

---

## Next Cycle Plan

**Cycle 1:** Remove hot-pink debug marker + fix water color noise (water should be solid color with no per-vertex noise, which creates the triangle grid appearance). These are both in `js/webgl3d.js`.
