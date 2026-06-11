# THE ISLAND — ABYME

*An island within an island.* A Myst-inspired first-person mystery in real-time 3D,
built from pure web tech. One dependency (three.js, from a CDN), **zero assets** —
every mesh, texture, and sound is synthesized in code.

**Play it:** open `index.html` over any static server. Headphones recommended.

## The conceit

You wash up on a lonely lighthouse island. In the lighthouse study stands a chart
table holding a perfect 1:240 living model of the island you're standing on — same
sea, same lighthouse, same study. The model and the world render from one shared
`WorldState`, so they can never disagree:

- Turn the **brass valve** by the model's basin → the real ocean drains, exposing a
  causeway. Watch it happen through the study window.
- Crank the **orrery lamp** around the model → the actual sun wheels across the sky.
  Cross the horizon and you might catch the green flash.
- Lay a pocket **ruler** across a crack in the model → a 36-metre brass ruler now
  bridges the real chasm, centimetre etchings tall as doorways.
- Set the small **lens** in the model's lamp room → the real lighthouse burns at
  night, and its beam writes glyphs on a cliff.

The finale inverts the trick: the world swells 240× around you, and you land on the
same beach, one level down.

## Puzzle chain (spoilers)

tide valve → causeway chest (ruler) → bridge the chasm → music box vs. the dawn
bird's corrected melody on the standing stones (lens) → golden-hour stone shadows
reveal the buried hatch → night beam projects the 4-glyph dial code → cellar plumb
bob → hang it over the model's beach → stand on the brass plate → **dive** → ring
the bell in the now-open annex.

## Architecture

Static ES modules, no build step. `js/`:

| file | role |
|---|---|
| `world.js` | the single authoritative WorldState + sun path + 5 master color grades + save/load |
| `terrain.js` | one analytic height function feeds geometry, collision, water depth, foam |
| `props.js` | every structure baked from primitives into few merged draw calls; the model clone |
| `shaders.js` | hand-written GLSL: ocean (object-space waves → free 1:240 miniature sea), sky (sun/moon/stars/milky way/green flash), beams, glow points |
| `puzzles.js` | the puzzle state machine; applies WorldState to BOTH island instances per frame |
| `player.js` / `interact.js` | drag-look walking, iris cursor, glint hovers, drag hotspots |
| `audio.js` | all synthesized: swell-locked surf, wind by altitude, FM music box, bird, stone drones, progressive score stems, the dive sweep |
| `main.js` | boot, grades→lights, intro dolly, the dive, the finale |

Append `?debug` to the URL for a time scrubber, teleports, and puzzle shortcuts.

The previous 2D SVG version of The Island lives in git history (`app.js`,
`styles.css` before this rewrite).
