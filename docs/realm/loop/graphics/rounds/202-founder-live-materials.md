# Founder live surfaces and courtyard

Date: 2026-09-05. The owner asked for more detail, suggested Bender/Peel
textures and normal maps, and wanted to push evergreen Safari and Chrome.

The workshop now opens a live Three.js/WebGL2 courtyard. It has separate
cloth, leather, metal, skin, hair and eye materials; independent detail UVs
follow the skinned mesh. Periodic surface recipes produce matching normal
and roughness maps. Filtered environment reflections, directional shadows,
three lighting presets and a movable key light make surface changes visible.
A survey table, map, crates, banner, lantern and instanced vegetation give the
Founder a place to direct. Zoom, wireframe and detail toggles support review.

Peel was reachable through its local RPC discovery/invoke API. The live
ledger showed Bender online. A new 512px limestone request timed out without
returning a job ID and was not retried. Instead, the scene uses the completed
Bender/FLUX.1-schnell job `946C3E6C-DB78-404B-86AA-EF11239A4443`, already present
in Peel's asset library. Its PNG hash matches the saved output; provenance is
copied alongside the asset. No new Bender generation success is claimed. The
available texture tool produces a color image, not a full PBR map set.

The saved Blender action source and all existing baked maps are unchanged.
The new normal maps, materials and courtyard are browser-authored additions;
the Blender download remains the animation scene. Production actors and the
ordinary Canvas2D game are outside this prototype conversion.

Startup no longer decodes all large sprite sheets. Small thumbnails remain
available, and at most one 192px atlas is retained after on-demand loading.
Paused scenes redraw only on changes. Quality caps and a downward adjustment
after sustained slow frame pacing bound resolution. Context loss falls back
to sprites; recovery regenerates the prefiltered lighting environment and
immediately redraws the live scene. Tests caught the missing immediate redraw.

Validation: installed Chrome 152.0.7977.76 passes the new detail gate and both
existing Founder gates. The detail gate compares real pixels after material
and light changes, checks every named key pose across four actions/eight views,
tests live/source/sprite visibility, atlas eviction, quality switches, actual
WebGL loss/restoration and 390px touch controls. Native Safari 26.3.1 visually
renders the scene, pointing pose and lantern lighting. Structural production
sprite and runtime URL graph gates pass. The reviewed live pose uses 10,211
rendered triangles, 106 draws and 21 textures. This is one character, not a
settlement-scale performance acceptance result.

A separate ten-second Chrome run used `ANGLE Metal Renderer: Apple M4` at
1440×1080 viewport / 1.5 render pixel ratio. After a two-second warm-up it
sampled 601 animation frames over 10.007 seconds: 60.06 average fps, 16.7 ms
median and 95th-percentile frame intervals. This is browser frame pacing on
this Mac, not a GPU timestamp benchmark or a phone/crowd performance claim.

Evidence: `tmp/founder-sprites/detail-validation.json`, the action and walking
reports, `living-scene-*.png`, `detail-performance.json`, and
`peel-texture-investigation.json`. No commit, push, deployment or production
renderer migration is included in this checkpoint.
