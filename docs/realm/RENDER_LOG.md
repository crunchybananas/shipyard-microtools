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


## Open Challenges (things to question each loop)

- ~~**Eye spacing ±1.7**: on cheek-dense close-up (zoom 2.0) whites touch. Try ±2.0 with smaller whites.~~ RESOLVED Loop 1 → ±2.0, whites 1.3.
- **Ground ring job-colored (alpha 0.45, size 8×3.5)**: at zoom 1.0 forms a distracting colored halo under every villager. Noisy vs. helpful?
- **Body shape 6.3×7 (near-circular)**: too blobby — most chibi references have a clearer torso/shoulder taper.
- **Hair arc sheen (cycle 8)**: does the 0.18-alpha 1.3-width stroke actually read at zoom 1.0? Likely sub-pixel.
- **Mouth zoom threshold 1.5**: most players play at zoom 1.0-1.5; the smile is invisible to them.
- **Cheek threshold 1.5**: same.
- **All citizens same scale**: canvas save()/scale() per citizen would let 0.85-1.15 height variation read as "crowd".
- **Mountain cones**: all clone from one shape. Dominate the visual at zoom 2.0. Variety or de-emphasis needed.
- **Grass tuft density**: cycle 50 halved; cycle 82 killed sway; are they still noise or have they become texture?
- **Arm stubs 2.6×1.9 at (±7.0, cy-9)**: look like wings, not arms. Counter-swing works but shape reads odd.
- **Feet ellipse 2.8×1.7**: slightly larger than head-end features; overwhelms the silhouette bottom.
- **Walking bob `sin(tick*0.2 + c.x*3) * 0.8`**: phase based on `c.x` — citizens at neighboring tiles bob in near-identical phase, which reads as "the ground shakes" rather than "they walk". Should phase off a per-citizen hash, not position.

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
