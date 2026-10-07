# ABYME — asset contract

This file describes the assets that the current game actually ships. Historical
experiments are not a compatibility surface: when an asset or loader stops serving
the game, remove the manifest row, code path, and file together.

## Current architecture

- `js/assets.js` owns the 13 generated textures sampled by Three.js/WebGL. Every
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
| `landfall.glb` | 2,604,048 | 12 parts; 28,656 triangles including alternative LODs | Original procedural Blender geometry, created for this project |
| `working-coast.glb` | 1,585,772 | 15 parts; 21,608 triangles including near, far and miniature crowns | Original Blender geometry for this project |

The kit contains the east-room floor, daybed, creased blanket, kettle, cups,
spare chair, carved bird mobile, stitched boat, tide bench and source cradle.
It adds no texture images, external models or external asset licenses. The original
12 WebGL textures and two CSS-native textures retain their original ownership;
the imagegen shore timber below is the thirteenth WebGL texture.
The manifest owns 21 WebGL assets: 15 textures and six models.

Source: `tools/blender/harbor-rooms.blend`. Generator:
`tools/blender/harbor_rooms.py`, Blender 5.2.1 LTS. `geometry.json` records per-part
counts, and `east-room.png` is a render of that actual source. The source and
runtime kit contain fictional room objects only, with no private narration.

Each part has one vertex-color material and one draw. The runtime keeps shared
geometry between boat scales; it bakes glTF's node transform before positioning the
hull against the actual waterline. The room adds no point lights.

The Landfall kit adds an open masonry lighthouse shaft, 115 supported treads, handrails,
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


## Landing-beach details — September 19, 2026

`shore-details.glb` (918,788 bytes) is original Blender geometry, generated by
`tools/blender/shore_details.py`. Its six parts total 9,846 triangles, including a
98-triangle rack for distance and the table model. The full rack has 7,684 triangles;
one west-shore tide-rock cluster batches by material into three meshes. Barnacles have hollow
mouths, the net and creel have open gaps, and rope coils are geometric. Grounded
colliders cover the rack legs, creel and rocks. No lights or save fields are added.
The rack changes to its silhouette at 42 metres with 12% hysteresis; only the
silhouette is added to the miniature after the main clone boundary.

`shore-timber.jpg` is a 512×512 albedo (116,076 bytes), generated with the built-in
OpenAI imagegen tool. It is project-generated artwork, not an externally licensed
texture. `tools/blender/shore-texture-prompt.txt` preserves the complete prompt;
`shore-timber-source.png` beside it preserves the generated original. Packaging
used macOS sips at JPEG quality 85. Board UVs follow each piece's grain. The texture
is not used as a heightmap. Existing `rock_height` supplies the rock relief.

`tools/harness/shore-details.mjs` gates asset loading, real collision, near/far
selection, the miniature, all four era grades, and the incremental draw/triangle
budget against the captured baseline. Fixed noon/night measurements are retained
under `loop/shore-details/` for the initial pass and `loop/island-life/power.json`
for the current combined pass; GPU samples are observations on the local host.


## Living coastal birds and dory — September 19, 2026

`island-life.glb` (830,804 bytes) contains original Blender gull, crow and songbird
skins (2,806 / 2,522 / 2,522 triangles), a twelve-joint skeleton, a 4,836-triangle
open lapstrake dory, a 44-triangle oar, and two coastal figures (2,564 / 2,004 triangles). `tools/blender/island_life.py` regenerates
the kit; `island-life.blend` retains editable geometry and authored pose actions.
Runtime bone poses control watching, foraging, preening, blinking, calling, wingbeats
and landing. Each bird draws one skin and one material. Authored far skins use
859 / 563 / 563 triangles and switch at 18/22 metres with hysteresis, scaled by
apparent size; the miniature uses the far skin. The three shore gulls share
the beach with six driftwood pieces and nine wrack clumps; the arrival stays open.

The clue bird's beak follows actual scheduled notes, and the existing reset boundary
cancels that motion with the sound. The beached dory and its miniature share authored
geometry while preserving the existing oar interaction and lens mark. The existing
imagegen timber remains on the drying rack. This kit adds no image texture, light,
save field, network write, or external model dependency.

The conifer boughs now use two five-vertex rings instead of one ten-vertex ring;
this rounds their shape without adding canopy triangles. The current study revision
brings the combined kit to 33,944 triangles and 1,715,112 bytes. The fitted study seats the final note, record slab and cradle on
its actual timber surface. The songbird similarly raycasts its stone crown.

All six standing-stone crowns use coordinate-consistent heights at their shared
corners, keeping the geometry closed. Existing deterministic scatter is preserved.
The current visual review, family-by-family audit and evidence are in
[loop/island-life/](loop/island-life/index.html): 21 asset checks, 11 wildlife checks,
the full game regression and matched-view measurements. The wider audit records
remaining weak assets separately from implemented changes.


## Human scale and cohesion — September 26, 2026

The shared stair course now has 115 risers over 20.6 m (17.9 cm per riser), three
turns, and 1.16 m tread width. Closed risers, inset nosings and two iron stringers
explain its support. The outer first flight leaves a 95 cm central aisle beside the
chart table; the upper course retains two metres of tested headroom. The player's
eye eases over risers while collision remains on the physical floor. Ordinary
keyboard input has walked the entire course both ways.

The library has 16 original reference titles across 25 books. Page blocks, covers
and spines have physical thickness. Scene lettering uses one 1024-square canvas
atlas and one draw; it is pruned from the miniature. The eight signal manuals keep
their existing figure–instrument bindings, with larger, wrapped instrument labels
and clearance beneath the cabinet cap. No puzzle values are printed on the spines.
The tide tube sits on the south wall clear of the stairs; the pipe passes below
the floor, and the wheel stays reachable from the room.

The runtime rock height field is now `assets/rock-height.jpg`, 512 × 512,
161,465 bytes, generated with the built-in OpenAI imagegen tool. Its isotropic
mineral relief replaces the old directional streaks. The original generation and
exact prompt are preserved in `tools/blender/granite-height-source.png` and
`granite-height-prompt.txt`. It is a project-generated height source, not an albedo.
Grass has slender pointed blades and muted root-to-tip color; heath is folded and
tapered; underwater kelp is a curved ribbon instead of a rectangular sheet. These
replace shapes in the existing patches without increasing scatter density.

The archive contains five hollow tins with rims, hinges, handles and inset lids.
The interactive open tin retains its existing hinge and paper interaction. The
Watcher and Tide-Figure use authored coats, sleeves, hands and boots, with a small
cloth motion. Human heights are 1.795 m and 1.738 m. Their runtime reset, dissolution
and evidence stay on the existing anchors. Regard now requires an on-screen head
and a clear sightline through terrain, architecture, rocks and tree crowns.

[The cohesion review](loop/cohesion/index.html) contains matched views, the actual
beach-to-study keyboard walk, the complete causal journey and current validation.
Earlier review folders are retained as dated evidence, not current source hashes.


## Handwork and grounded lower keeper — September 26, 2026

The working-coast crowns now use six slender, closed sprays per bough, fitted to
its bowed wooden support. Near profiles have 5,536 / 5,340 / 4,164 / 3,576 triangles;
far profiles have 1,368 / 1,320 / 1,032 / 888. Placements, colliders, wind weights,
LOD thresholds, and the miniature silhouettes are retained. The working-coast kit
is 1,705,768 bytes. Foliage remains deliberately faceted at close range.

The refuge blanket has a turned head hem, a fitted hanging side, sewn repair, and
solid edges. The rectangular pillow has a compressed seam. Rug bands meet rather
than leaving floor gaps. Cloth uses a small derivative-filtered weave in its own
material. `roomCloth` uses 6,700 triangles; the full harbor kit uses 19,584 triangles
and 1,714,344 bytes. The journal's binding batches into one draw plus its page block.
The carbon copy now lies above the blanket and carries a restrained printed face;
its reader and lore are unchanged.

The life kit adds `keeperCraft` (2,188 triangles), an eight-joint `KeeperRig`, and a
108-triangle worktable. The miniature keeps the existing exaggerated reading scale
(2.65 times a human figure inside the 1:240 model). Head and arms move independently;
resting palms meet the boards with 2 mm source clearance. The anchor stays upright
and the table feet fit the actual terrain. Its dry shore terrace is 7.636 m above
sea datum, above the highest supported sea of 6.93 m. It exists only on the nested
model from era two onward and preserves the final-era stillness requirement.
No point light, save field, prop scatter, or new downloaded texture is added.

`tools/harness/handwork.mjs` checks the letter by pointer, all four paper corners,
regard timing, palm contact, planted feet, nested visibility, and flood clearance.
It is included in the full regression gate. `loop/handwork/` holds matched images,
local walk evidence, render comparisons and source hashes for this refinement.


## Boulder kit and the player walk — October 6, 2026

`boulders.glb` (35,680 bytes) is original Blender geometry generated by
`tools/blender/boulders.py` (Blender 5.2.1 LTS): three fractured erratics of 180, 180 and
180 triangles — exactly the old displaced icosphere's budget (a detail-2 icosahedron is
180 faces; the code comment that called it 320 was wrong), because each instance is drawn
twice (island + model) and the first 420-triangle cut pushed the upstream-hand peak frame
past the 1,000,000-triangle ceiling.
and finished with sharp-edge normal splits, a baked vertex cavity term, a lighter tint on
the planar fracture faces and box-projected UVs for the shared `rock_height` relief.
`boulders.blend` and `boulders.png` are the editable source and its inspection render;
`boulders-geometry.json` records the counts. The runtime instances the three stones for
every shore rock and inland erratic in place of the former displaced icospheres, keeping
every position, collider and draw count; the kit adds no light, texture or save field.

`rock_height` is now declared `linear`. It is a height field, and sampling it as sRGB
crushed its 0.35–0.68 band to 0.10–0.42 before the cliff and vault shaders ever saw it.

The review of this pass, with the baseline and corrected views of every stage of the
game, is in [loop/player-walk/2026-10-06/](loop/player-walk/2026-10-06/REPORT.md).


## Needle-card crowns, the channel buoy and the cellar walls — October 7, 2026

The four conifer crowns are textured needle cards now. `tools/blender/working_coast.py`
keeps the same bough skeleton per profile (so every tree stands where it stood, with the
same colliders, litter and wind habit) and lays three alpha-tested card strips along each
bough: the flat fan a conifer bough is, and two narrower cards tilted ±62° so the bough
keeps its mass seen edge-on. Near crowns carry the bough wood as well; far crowns are the
cards alone. The 1:240 model crowns keep the opaque closed lobes on their own material —
an alpha test at four pixels mips a tree into nothing. Near profiles are 2,488 / 2,400 / 1,872 / 1,608 triangles,
far profiles 1,020 / 984 / 768 / 660; the kit is 1,585,772 bytes. TEXCOORD_0 is the card texture and TEXCOORD_1 the
wind weight (0 at the trunk, 1 at the growing tips) that `js/working-coast.js` turns into
the `aRim` attribute. Cards shade with crown-volume normals (out from the trunk axis and a
little up), never flipped on the back face, so the crown lights as the volume it stands for.

`needle-card.jpg` (42,491 bytes) and `needle-alpha.jpg` (104,580 bytes) are drawn by
`tools/blender/needle_card.py` with PIL alone, deterministic (seed 20261006): one bough
seen from above, a central twig, thirty alternating forward-swept twiglets, two ranks of
short needles a side, dark blue-green inside to a lighter yellow-green at the tips, flat
unlit colour over the body green so the alpha-tested edge never fringes black. The alpha
is a separate greyscale JPEG so each file stays under the size contract; three.js reads
the alpha map from its green channel. `needle-card-preview.png` composites the two.

`js/encounter-sightline.js` now reads a card's coverage at the raycast hit, so a figure
seen through the air between twigs counts as seen; any other solid still blocks outright.
`tools/harness/trees.mjs` checks the card mechanism (16 assertions: both LODs, aRim at the
tips, root-to-tip texture coordinates, map + alpha map + alpha test, decoded textures, the
sway and new-growth patches, and the model's separate opaque dappled material).

The L3 bell-buoy (`js/regions/l3_gallery.js`) is a real iron channel buoy: a flat-decked
float with skirt and rubbing strake, a four-post lattice tower with cross-braces and
diagonals, the bell hung under its cap with a clapper, a dead lamp in its cage, and a
mooring chain down into the water. One merged geometry, one material, one draw; vertex
colours carry the rust streaking down from the fittings and the weed below the waterline.
It adds no asset file.

The cellar and drain limewash (`js/landfall.js`) gained coats of trowel mottle at hand
scale, water staining run down from the vault in streaks that follow the courses, and a
dark tide mark where the drowned years stood. Frames for all three are in
[loop/player-walk/2026-10-06/day2/](loop/player-walk/2026-10-06/REPORT.md).
