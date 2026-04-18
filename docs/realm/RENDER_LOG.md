# Realm Render Log — Session 3

Focused on the **visual fidelity of render.js**, independent of the LOOP_STATE.md cycle log (which is UX/bugs/flow). Only touch render.js polish per loop — no scope creep into other systems.

## Engine Assessment

*After reading render.js (5191 lines) cold.*

| System | Rating | What's architecturally wrong |
|---|---|---|
| Citizens | 7/10 | Drawn inline in render() at 911-1280. ~370 lines of per-frame Math.sin/arc/ellipse. No sprite-cache pre-bake, no per-citizen scale/height variation. Re-computes skinHash/hairHash every frame from `c.name.charCodeAt`. |
| Buildings | 6/10 | 20 individual drawX functions (drawHouse, drawFarm, …) all procedural canvas. `drawTree` at 4642 redraws trees every frame — hot. Building decorations are shipped via `enhancements.js` register-pattern, which was the right architectural choice in 2024, but the core draw functions still read as patchwork. |
| Terrain | 5/10 | Tile loop draws top face + 2 side faces + haze + wear + texture + biome blend — up to 7 fill operations per tile. Cached gradient only for fog-of-war. Grass uses 4-color position-hash scatter but scenery decorations (grass tufts, mushrooms, pebbles, clover, flowers) are redrawn every frame per tile from hash. |
| Weather | ? | Not in render.js — lives in enhancements.js |
| Water | 6/10 | `drawWater` at 4855 animates but was deliberately slowed. No reflection/shimmer caustic; wave lines are visible sine scribbles. |
| Minimap | 4/10 | Per-frame full redraw of 80×80 tiles + all citizens + all buildings. Could be fog-diffed. |
| Overall | 6/10 | "accumulated patches" — many good ideas layered without revisiting older ones. 5191 lines of code but no file split. No sprite caching anywhere. Zero per-frame budget hygiene. |

**Key architectural smells:**
- Everything is inline `ctx.beginPath` → no intermediate offscreen-canvas bake for static-per-citizen heads/bodies.
- `for (const c of G.citizens)` in render() does 370 lines per citizen including string charCodeAt hashing. An 80-citizen late-game scene = ~30,000 lines of JS work per frame just on citizens.
- Trees/rocks/decorations: drawn stateless every frame.
- No split: render-citizens / render-buildings / render-terrain as separate modules would make this tractable.

**Capability note:** No image-generation/diffusion tools available in this environment. Sprite atlases must be either hand-authored SVG → canvas bake, or procedural bake (draw once to offscreen canvas, blit per frame).

## Loop History

| Loop | Improvement | Challenge | Evidence | Verdict |
|------|-------------|-----------|----------|---------|
| 1 | Head-neck join: killed head outline stroke, widened neck 2.2×2.6 → 3.0×3.0, dropped head y cy-20 → cy-19 | Eye spacing ±1.7 was too close (whites touched at centerline = "goggles" read) | Before: s3_loop00_zoom2.jpg. After: s3_loop01_zoom3.jpg — heads no longer severed; eyes at ±2.0 with 1.3 whites = clear 0.7px gap between whites | KEEP both. Agent critique #1 ("heads read as severed") visually resolved; eyes now read as a face, not goggles. |
| 2 | Mountain variance: per-tile hash now drives base half-width (10-17px), lean (±3px), snow asymmetry, ~1/4 twin-peak, ~1/32 snowless rocky | Body 6.3×7 too blobby → tried 5.4×7.4 (narrower, taller) with arm-stubs pulled in 7.0 → 6.0 | realm_s3_loop02_mountains.jpg shows cluster of ~5 mountains, all different. realm_s3_loop02_body.jpg shows narrower bodies — head-to-body ratio now reads more clearly chibi | KEEP both. Mountains no longer "stamped traffic cones". Bodies less ball-like. |
| 3 | Citizen personal-space separation: soft repulsion force pushes pairs apart at d < 0.75 tiles, linear falloff, strength 0.22. Deterministic break-direction for perfectly stacked citizens (avoids forces-cancel stall). Blocks pushes into water/mountain tiles. Impl in citizens.js:updateCitizens after-pass. | Do citizens currently clump at shared destinations? YES — teleported all 7 to (45,40) before fix → all 7 at exact same (45,40). After fix → min pair 0.44, median 0.74, max 1.50 | realm_s3_loop03_separation.jpg: 7 distinct chibi figures visible in a loose cluster, none overlapping | KEEP. User-requested "citizens respect each other". Also surfaced discovery: browser ES module cache needs `?_cb` URL change + no-cache server to pick up edits. |
| 4 | Social facing: if a citizen has no movement direction AND a neighbor is within 1.4 tiles, orient `faceX/faceZ` toward that neighbor. Clusters now look like conversations, not back-to-back strangers. | Walking-bob phase was tied to `c.x * 3` — adjacent citizens bobbed in stadium-wave lockstep. Switched to per-name hash (`charCodeAt * 91 + ...`) so each citizen has its own rhythm | realm_s3_loop04_facing.jpg: paired citizens show mirrored 3/4 views confirming they face each other | KEEP both. Social facing addresses the "respect each other" request at render level; desynced bob makes crowds read as individuals. |



## Open Challenges (things to question each loop)

- ~~**Eye spacing ±1.7**: on cheek-dense close-up (zoom 2.0) whites touch. Try ±2.0 with smaller whites.~~ RESOLVED Loop 1 → ±2.0, whites 1.3.
- **Ground ring job-colored (alpha 0.45, size 8×3.5)**: at zoom 1.0 forms a distracting colored halo under every villager. Noisy vs. helpful?
- ~~**Body shape 6.3×7 (near-circular)**: too blobby — most chibi references have a clearer torso/shoulder taper.~~ RESOLVED Loop 2 → 5.4×7.4 with arm stubs 6.0 offset.
- **Hair arc sheen (cycle 8)**: does the 0.18-alpha 1.3-width stroke actually read at zoom 1.0? Likely sub-pixel.
- **Mouth zoom threshold 1.5**: most players play at zoom 1.0-1.5; the smile is invisible to them.
- **Cheek threshold 1.5**: same.
- **All citizens same scale**: canvas save()/scale() per citizen would let 0.85-1.15 height variation read as "crowd".
- **Mountain cones**: all clone from one shape. Dominate the visual at zoom 2.0. Variety or de-emphasis needed.
- **Grass tuft density**: cycle 50 halved; cycle 82 killed sway; are they still noise or have they become texture?
- **Arm stubs 2.6×1.9 at (±7.0, cy-9)**: look like wings, not arms. Counter-swing works but shape reads odd.
- **Feet ellipse 2.8×1.7**: slightly larger than head-end features; overwhelms the silhouette bottom.
- **Walking bob `sin(tick*0.2 + c.x*3) * 0.8`**: phase based on `c.x` — citizens at neighboring tiles bob in near-identical phase, which reads as "the ground shakes" rather than "they walk". Should phase off a per-citizen hash, not position.

## Future Research / Big Bets (user-requested)

- **Citizens respect environment elements** — currently they walk through the *image* of trees/bushes on walkable tiles. A denser graph + per-decoration occupancy would let citizens weave between trees rather than stamp over them. (See hex/sub-tile research below.)

### Hex tiles vs. denser iso pathfinding — feasibility study (Loop 5)

**Current projection.** `render.js:48` — `toScreen(tx, ty) = { x:(tx-ty)*TW/2, y:(tx+ty)*TH/2 }` with `TW=64, TH=32` (iso diamond, 2:1 aspect). Tiles are integer-indexed `G.map[y][x]`. Pathfinding is 8-direction A* over the same grid (`pathfinding.js`).

**Option A — true hex tiles.**
| Area | Change |
|---|---|
| Projection | `toScreen` → axial `(q,r)`: `x = size * sqrt(3) * (q + r/2)`, `y = size * 3/2 * r`. Diamond fills → hex fills (6-point `beginPath/closePath`). |
| Storage | `G.map[y][x]` → `G.map[r][q]` (names only), but neighbor math diverges. Cliff/water edge code in render.js:284 and every `G.map[y][x+1]` check needs rewriting with hex adjacency. |
| Neighbors | 8-way → 6-way, with axial offsets `[[+1,0],[-1,0],[0,+1],[0,-1],[+1,-1],[-1,+1]]`. Uniform (no offset-row parity). |
| Pathfinding | A* still works; replace `DIRS` array + `heuristic` with hex distance (`(|dq|+|dr|+|dq+dr|)/2`). Step cost uniform (no SQRT2 diagonal). |
| Building placement | Each building currently claims `x,y` footprint. Castle (2×2) and walls assume orthogonal neighbors — would need rewrite or hex-aware shapes. |
| Minimap | Minor — still pixel-per-tile, slightly different aspect. |
| Other | `screenToWorld`, `toWorld`, god rays, vignette, fog edge blending, viewport culling all take coords — all need audit. |
| **Scope** | **~1200-1800 lines touched across ≥12 files. Multi-day rewrite.** |
| **ROI** | Aesthetic: organic shapes, 6-neighbor feel. Functional gain: modest (8-dir A* already feels natural). |
| **Risk** | High — regression surface is enormous. Existing 83 LOOP_STATE cycles' worth of visual polish tuning would need re-validation. |

**Option B — sub-tile granularity (keep iso).**
Citizens move on a grid at **half-tile or quarter-tile** resolution while `G.map` stays at whole tiles. Decorations (trees, rocks, individual tree dabs) register as sub-tile obstacles. Pathfinding operates on the denser graph.

| Area | Change |
|---|---|
| Projection | No change. `toScreen` still projects floats — sub-tile coords naturally interpolate. |
| Storage | New `G.subGrid[sy][sx]` at 2× (or 4×) resolution, derived from `G.map` + registered decorations. |
| Neighbors | Still 8-way; DIRS unchanged. |
| Pathfinding | `findPath` takes `MAP_W*2 × MAP_H*2` (i.e., 160×160) grid. Bump `maxIter` 2000 → 6000 to cover 4× search space. |
| Building placement | Unchanged. Buildings stay on whole tiles; sub-grid marks building footprint as blocked. |
| Citizens | Movement step size stays the same (continuous coords). The difference is the *path* has more, finer waypoints. |
| Decorations | New step: at world-gen (or lazily on first render), enumerate tree/rock positions on each forest/rock tile → mark their sub-cells as blocked. Trees currently drawn in `drawTree(ctx, x, y, a, seasonShift)` from tile-hash — positions are deterministic and recoverable. |
| **Scope** | **~250-450 lines. Mostly in `pathfinding.js`, a new `world.js:registerDecorations()`, and `citizens.pathTo()`. 1-2 dev days.** |
| **ROI** | High — directly enables "citizens weave between trees" behavior the user described. |
| **Risk** | Medium — 4× pathfinding grid = 4× memory for the search sets and ~4× worst-case iterations. At 80×80 → 160×160 = 25,600 cells, still fine for 2000+ iter A*. |

**Recommendation.** **Option B (sub-tile iso)** is the right next bet. Same visual language, targeted at the user's "respect environment elements" request, ~4× cheaper than hex, and doesn't risk regressing 83 cycles of visual polish. Hex can come later if aesthetics warrant.

**Prerequisite for either: a world-gen pass that persists decoration positions.** Currently trees/rocks are drawn from position hash every frame but never stored in state. The first implementation step is `G.decorations[y][x] = [{type:'tree', ox: 0.2, oy: -0.1}, …]` populated at `generateWorld()`. This alone is a useful refactor because (a) it lets pathfinding see them, (b) it lets citizens slow/dodge near them, and (c) it fixes the bug where decoration positions can drift if the hash seed changes.

**Not to touch next loop** (implementation would be Loop 6+), but documented here so the shape of the change is clear.


## Rejected / Reverted Approaches

_(empty — populate as experiments run)_

## Sub-agent Findings

### Session 3 / Loop 0 — fresh-eyes critique (general-purpose agent, no context)

Ranked by perceived quality impact:

1. **Chibi proportions broken — heads read as severed.** Ball-on-a-bottle look. Visible gap between skull base and shoulder. Four villagers, one haircut.  
   → *Fix*: drop head y by 3-4px so jaw overlaps collar; add ~2px neck trapezoid matching skin; 3-4 hair silhouette variants (tuft/bob/bald/braid) per hairHash.

2. **Water is a chain of disconnected blue diamonds.** Hard white per-tile borders. Cyan clashes with forest greens.  
   → *Fix*: remove per-tile stroke; darken base to ~#2a5a8a; connected spline overlay for river centerline; alpha-feather sand→grass.

3. **Mountains are identical grey traffic cones stamped in rows.** 8+ cones at identical scale/rotation = tutorial placeholder look.  
   → *Fix*: jitter base width ±25%, rotation ±8°, notched ridge (2-3 apex points), cooler desaturated highlight.

4. **Global bloom/glow frosting everything.** Trees carry radial green halo larger than the tree.  
   → *Fix*: kill per-object glow; restrict to emissive (torches/lit windows/moon); ~60% smaller radius.

5. **Tile seams visible as diamond lattice over grass.** Per-tile lighter edges tile into visible grid.  
   → *Fix*: remove per-tile edge lighten; one global directional light pass, or ±4% luminance noise so seams disappear.

**Keep:** warm lit cottage window + distant hot-air balloon against deeper backdrop — the single warm point is atmospheric. (Note: this may be a reading of the dim far-tiles + ambient balloon against the haze edge, not actual "night sky".)



## Notes from Prior Sessions

The LOOP_STATE.md log (cycles 1-83) shipped many visual fixes that are now "landmines" — not to revert blindly:

- **Cycle 10**: removed 💤 idle emote (don't re-add)
- **Cycle 34**: disabled swallows (don't re-enable without verifying the V-stroke-in-void fix)
- **Cycle 37**: night capped at 0.7 darkness (don't darken further)
- **Cycle 38**: breathing bob (don't kill)
- **Cycle 44**: disabled spring petals (user complained)
- **Cycle 50**: grass tuft density halved
- **Cycle 72**: carrying indicator shrunk + strapped (don't bloat)
- **Cycle 82**: killed per-frame grass-tuft sway, bumped decoration alphas to 1.0
