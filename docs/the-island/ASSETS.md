# ABYME — asset contract

This file describes the assets that the current game actually ships. Historical
experiments are not a compatibility surface: when an asset or loader stops serving
the game, remove the manifest row, code path, and file together.

## Current architecture

- `js/assets.js` owns the 12 generated textures sampled by Three.js/WebGL. Every
  `MANIFEST` row has a live runtime consumer and records its path, byte size,
  license, source, prompt, and sampler settings. JavaScript loads those textures
  through the module rather than by URL.
- Two UI textures are intentionally CSS-native. CSS is their loader, so putting
  dormant duplicate rows in the JavaScript manifest would not make ownership more
  honest. These are the complete exceptions:

  | File | Live consumer | Bytes | Embedded provenance |
  |---|---|---:|---|
  | `sand.jpg` | `style.css` shore-writing surface | 58,051 | MFLUX 0.18.0, FLUX.1-schnell, seed 0; prompt: “seamless tileable fine beach sand, gentle wind ripples, pale warm cream grains, a few tiny shell flecks and pebbles, soft daylight, top-down orthographic, no seams, tileable seamless texture” |
  | `note_paper.jpg` | `style.css` reading surface | 38,257 | MFLUX 0.18.0, FLUX.1-schnell, seed 0; prompt: “seamless tileable aged ruled ledger paper, faint water stains and foxing, soft daylight, top-down, low saturation, tileable seamless texture” |

  Both files are 512×512 JPEGs whose embedded metadata identifies MFLUX as the
  creator and the content as AI-generated. No JavaScript loader shim is warranted.
- `js/audio.js` synthesizes the entire score and sound world with Web Audio. Its
  persistent generative bed, puzzle instruments, environmental voices, and the
  keeper's nonverbal drowned timbre use no downloaded music or speech files.
  Language remains visible text.
- `js/world.js` owns exactly four playable strata: the last day, the arrival years,
  the inspection years, and the last winter. Visual grading and the procedural
  arrangement in `js/audio.js` follow those same four states.

## Visual language

ABYME is a hand-built, weathered island under a time-of-day and era grade. Generated
textures should be matte, low-chroma, and free of baked directional lighting so the
same material remains believable in every stratum and in the 1:240 table model.

Use the material vocabulary already established in `js/props.js`; do not add a
strong baked hue to compensate for lighting. Texture frequency matters more than
micro-detail because every surface also appears at model scale.

A useful generation baseline is:

> seamless tileable material texture, hand-built weathered surface, matte,
> low saturation, soft diffuse light, no text, logo, or watermark, orthographic

Then name the physical material and its useful structure. Height sources must be
actual grayscale height information; `applyRelief` derives and caches their normal
maps at runtime.

## Size and power contract

- Shipped textures are 512×512 or smaller and below 256 KB compressed. Keep that
  ceiling unless a measured visual need justifies changing the contract.
- Reuse cached textures and materials. A texture should add no geometry or draw call;
  account for shader fetches, upload memory, and model-scale readability.
- The current automated rendered-event gate is `tools/harness/upstream-hand.mjs`:
  peak work must stay below 525 calls and 1,000,000 triangles, and the event may add
  at most 16 calls and 20,000 triangles over its measured baseline. Point lights may
  not exceed nine or increase over that baseline. These are the enforced limits;
  the debug panel's color is only a live diagnostic.
- For any visual change, record fixed-pose before/after draws, triangles, and GPU
  frame time at noon and night. A visual gain must hold or reduce the measured load,
  or update an executable gate in the same change.

## Acceptance

Before adding or replacing a texture:

1. For a WebGL texture, add or update its single `MANIFEST` row with truthful
   provenance and byte count. For a CSS-native UI texture, add the direct CSS
   reference and update the exception inventory above instead.
2. Verify every manifest row has a live JavaScript consumer, every CSS exception has
   a live stylesheet consumer, and every file under `assets/` belongs to one of those
   two sets. Remove superseded candidates; possible future reuse is not a runtime use.
3. Inspect it in the full-size world and the table model across all four strata.
4. Run `bash tools/harness/syntax.sh` and the relevant visual gate; for a broad
   rendering change, run `bash tools/harness/run.sh`.
5. Record the power comparison. Do not ship an unmeasured visual exception.

Most WebGL texture work came from the Bender asset pipeline; the two CSS-native
textures preserve their embedded local MFLUX provenance above. Copy only accepted,
live output into `assets/`; the runtime repository is not a candidate archive.


## Original Blender environment kit — September 2026

| Runtime asset | Bytes | Geometry | Ownership |
|---|---:|---|---|
| `harbor-rooms.glb` | 1,716,348 | 8 consolidated parts; 16,244 triangles | Original procedural Blender geometry, created for this project |
| `landfall.glb` | 2,081,688 | 12 parts; 23,340 triangles including alternative LODs | Original procedural Blender geometry, created for this project |
| `working-coast.glb` | 1,718,784 | 15 parts; 33,984 triangles including near, far and miniature crowns | Original Blender geometry for this project |

The kit contains the east-room floor, daybed, creased blanket, kettle, cups,
spare chair, carved bird mobile, stitched boat, tide bench and source cradle.
It adds no texture images, external models or external asset licenses. The existing
12 WebGL textures and two CSS-native textures retain their original ownership.
The manifest owns 15 WebGL assets: 12 textures and three models.

Source: `tools/blender/harbor-rooms.blend`. Generator:
`tools/blender/harbor_rooms.py`, Blender 5.2.1 LTS. `geometry.json` records per-part
counts, and `east-room.png` is a render of that actual source. The source and
runtime kit contain fictional room objects only, with no private narration.

Each part has one vertex-color material and one draw. The runtime keeps shared
geometry between boat scales; it bakes glTF's node transform before positioning the
hull against the actual waterline. The room adds no point lights.

The Landfall kit adds an open masonry lighthouse shaft, 83 treads, handrails,
vault ribs, a drying table, basalt, a coastal arch and wind pines. The miniature
uses a 672-triangle shaft; pines swap to a 284-triangle silhouette at distance.
`tools/blender/landfall.py` reads the layout embedded in `js/tower-course.js`, so
the visible treads and player floor agree. `landfall-geometry.json` records every
part and `landfall.blend` preserves the editable source. The assembly reuses the
owned rock relief texture and adds no point lights.

The working-coast kit replaces the procedural canopy cards with closed needle
volumes. Its four profiles share heights and bend with runtime trunks through
`js/forest-profile.js`. Every tree keeps the same deterministic position, collider
and terrain litter. Near/far hysteresis runs at 48/56 metres; the 1:240 model uses
232–296-triangle crowns with the same layout. No trees are removed for this saving.

The main study has fitted boards, limewashed walls, painted panelling, shelf
joinery and a pipe run from the tide wheel to a stilling tube. The tube's water and
float read `W.tide` each frame, including the delayed rise from the Upstream Hand.
The room adds no point light. `tools/blender/working-coast.blend` is the editable
scene; `working_coast.py` regenerates the runtime asset and inspection render.
