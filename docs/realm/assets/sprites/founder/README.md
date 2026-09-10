# Founder: first game integration and animation workshop

Open `walk-studio.html`, or choose **Character Workshop** on Realm's title
screen. The existing **Founder** in the actual settlement now uses this character,
with a corrected walk and three standing actions rendered independently from
eight directions. Select **Founder** or press **F**, then use WASD or tap open
ground. The other citizen families retain their existing assets.

The character starts from Kay Lousberg's **KayKit Rogue**, a CC0 mesh, texture
and rig. Realm now reshapes its body and bind skeleton toward adult proportions,
rebuilds its sleeves, adds fitted clothing details, and retargets all four
actions. The source remains editable in Blender.

## Adult traveler source

The head now occupies 18% of the neutral model height, down from 47%. The legs
are longer, the torso and boots slimmer, and the ready pose lets the hands
rest beside the body. The cloak ends above the boots and opens behind the legs.
Continuous sleeves replace the old shoulder geometry; their weights blend
across the elbow. Leather cuffs, a fitted survey strap, a bronze clasp and
separate linen wraps carry the material detail into both the studio and game.

All four actions were retargeted together. The ankle trajectories stay fixed;
shortened boots use the rotation delta from their new neutral rest axes. This
preserves the level soles and the .119247 ankle-to-toe drop. Pointing retains a
relaxed elbow and aligned wrist. The action gate measures the new proportions
from Blender and compares every exported joint with the rendered source.

`founder-actions-before-anatomy.blend` preserves the prior source.
`scripts/founder-sprites/refine_anatomy.py` stages this one-time reshaping from
that file. It refuses an already reshaped rig. Routine rebuilds continue to
read the current saved scene and preserve subsequent hand edits.

## In the game

`js/founder-presentation.js` draws the Founder in the existing Canvas2D depth
pass, with a calibrated ground anchor, soft contact shadow, selection ring,
eight headings, and 64px/128px/192px source tiers. His runtime cell is 44px high,
calibrated to the slimmer source's 53–56px visible height within an 84px cell.
The rendered body stays close to settler stature. A small crest marks him; his name
appears when selected at normal or close zoom.

Source resolution follows the actual canvas transform, including display
density. Close zoom loads one facing from `runtime/` instead of an entire
eight-view sheet. The adapter retains the small idle/walk maps, the active
gesture map, and at most two enlarged direction rows, loading one enlarged row
at a time. Ready small maps cover turns and decode delays. The maximum retained
RGBA references total 37.41 MiB; the browser may retain additional image-cache
or GPU memory. The game loads no Three.js or GLB.

Successful building placement, upgrade, and citizen assignment turn the idle
Founder toward the worksite and play **Work over there** once. A rally order
plays **Come with me**. Failed commands cause no gesture. Movement interrupts
gestures, and orders received during movement are discarded. Pausing freezes
the pose; a gesture ends in the living idle. The core emits a frozen accepted
command fact; the shell owns all animation state. Save/Continue preserves the
existing Founder without serializing transient gestures.

The game uses a presentation stride of 1.6 map tiles per cycle, giving 1.875
cycles/s at the existing .05 tile/tick travel speed. The compressed settlement
scale is independent of the source rig's .64-unit stride. This preserves game
travel speed; it is not a claim of physically locked world-space stance feet.
Cloth, linen, leather, hair, metal, and skin use the shared settlement material
profile when baking these PNGs: muted forest greens, warm skin, normal and
roughness maps, filtered reflections, and self-shadowing. The game receives
the rendered lighting in its sprite pixels. Dynamic relighting remains a
feature of the live workshop.

```sh
REALM_PORT=8942 FOUNDER_BROWSER=chrome node scripts/verify-founder-game.mjs
REALM_PORT=8942 FOUNDER_BROWSER=chrome node scripts/verify-founder-scale.mjs
```

The gate exercises real movement commands in all eight directions, work/rally
gestures, interruption, pause, save/continue, actual house draw order, and phone
touch movement. It also visits all eight walking directions at maximum zoom
and bounds retained atlas references during action changes. The scale gate
compares actual Founder and settler rendering in 80 cases: eight headings, five
zooms, and 1x/2x display density. It checks stature, width, and the ground baseline.
Both are registered in `scripts/verify-realm.mjs` with the walk, action, and
detail gates.

## Living scene: materials and light

The default **Living scene** view renders the same animation GLB in Three.js
0.180 / WebGL2. Morning, Cloud, and Lanterns relight the character and courtyard.
Drag the character, move the key light, zoom in, and toggle surface detail or
wireframe. Cloth, linen, leather, metal, skin, hair, and eyes have separate material
responses. A second set of surface coordinates follows the skinned mesh;
the original palette coordinates remain available alongside named materials
for the newly authored garments.

`scripts/founder-sprites/materials.js` creates deterministic periodic height
fields and derives tangent-space normal and roughness maps for weave, leather
grain, hair, wood, and stone. These are authored surface approximations, not
depth recovered from a photograph. The limestone color image is a completed
FLUX.1-schnell texture generated on **Bender Bending Rodriguez** through Peel.
`materials/provenance.json` records its exact job, prompt, model, license and
SHA-256; the local image matches that output. The new request on September 5
timed out without a job ID; this scene deliberately uses the verified existing
asset rather than claiming a new generation completed.

`scripts/founder-sprites/settlement-materials.js` defines the shared character
palette and the lighting used for sprite bakes. It wraps the surface recipes
without altering the saved geometry or animation during a bake. The physical materials are authored browser additions;
the Blender download remains the animation source with its base palette.

`scripts/founder-sprites/detailed-scene.js` owns the courtyard, survey table,
lantern, banner, instanced vegetation, filtered environment reflections and
shadow lighting. The courtyard props are live browser additions. Sprite maps
now bake the detailed character materials under dedicated settlement lighting;
rebuilding them does not bake the courtyard.

Automatic quality caps device pixel ratio at 1.5 and reduces it to 1 after
180 observed slow frames. High caps it at 2; Light uses 1 and a 1024px shadow
map. Paused scenes render only when something changes; hidden documents skip
animation/render work. Initial live view loads only the small sprite atlases.
The large 192px sheets load on demand, retaining at most one (a standing
sheet decodes to 70.875 MiB). Context loss returns to sprites; returning to the
restored live view also rebuilds environment reflections.

Validate the live scene and the existing animation contract:

```sh
REALM_PORT=8942 FOUNDER_BROWSER=chrome node scripts/verify-founder-detail.mjs
REALM_PORT=8942 FOUNDER_BROWSER=chrome node scripts/verify-founder-actions.mjs
REALM_PORT=8942 FOUNDER_BROWSER=chrome node scripts/verify-founder-walk.mjs
```

`FOUNDER_BROWSER=chrome` uses installed Chrome with its default ANGLE backend.
Omitting it uses Playwright Chromium with SwiftShader for functional checks;
software-rendered timings are not a device-performance claim. Native Safari
26.3.1 rendered the earlier integration. This anatomy pass was verified in
installed Chrome 152.0.7977.76; its native Safari review is pending a Mac unlock. The Chrome
gate covers actual relighting pixels, all named poses in eight directions,
context recovery, quality settings, atlas eviction, 390px layout and touch.

WebGL2 is sufficient for this scene. WebGPU is an additional option, supported
in [Safari 26](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/#webgpu)
and [Chrome](https://developer.chrome.com/docs/web-platform/webgpu/overview),
when larger workloads justify a different renderer. No WebGPU feature is
required here. A settlement-scale actor/crowd budget remains a separate test.

## Actions and key poses

| Action | Poses | Duration | Key beats |
| --- | ---: | ---: | --- |
| Walk | 24 | 1.066667 s | Left contact, right passing, right contact, left passing |
| Take stock | 48 | 4 s | Settle, breathe in, look across, exhale |
| Work over there | 48 | 3.2 s | Ready, look and gather, indicate, hold the direction, recover |
| Come with me | 48 | 3.2 s | Ready, catch the eye, first invitation, again, settle |

Standing actions share a ready pose, keep both feet in place and close back
into that pose. The torso, head and arm carry the gesture. These are deliberate
review loops; the game plays standing gestures once in response to orders.
The workshop starts with **Work over there**. Action tabs, named beat buttons,
the scrubber and the eight direction buttons all show the selected animation.
The 3D source view plays the same exported action. Download this action saves
its matching sprite map. Reduced-motion preferences start playback paused.

## Original toe correction

The first walk mistakenly used the original gait's heel-contact orientation
as a flat-foot reference, and copied the left ankle's reference to both sides.
It then retained the original toe-roll keys after replacing the ankle motion.
That combination tilted the boots and curled the toes independently.

Each ankle now uses its own neutral sole orientation and each toe keeps its
neutral rotation relative to the boot. Swing clearance comes from the leg and
a small whole-foot rotation. The corrected Blender walk changes only the foot
and toe rotation curves; existing hip, knee, ankle-position and upper-body
motion stay in the saved walk.

## Original pointing arm correction

The first pointing hold aimed the hand independently from the forearm, bending
the wrist about 48° and folding the thick glove into its cuff. The revised
point keeps the wrist and hand aligned with the forearm and reaches slightly
outward. Only the right shoulder, elbow, wrist and hand rotation curves were
replaced in the saved pointing action. The other actions retain their keys.
The focused gate checks the wrist throughout all 48 poses; the repaired scene
stays within about 3.1° of a straight forearm-to-hand line.

`founder-actions-before-arm-repair.blend` preserves the earlier action scene.
`export-authored-action.mjs` and `repair_pointing_arm.py` prepared and applied
this one reviewed correction. Routine editing still uses the saved-scene
rebuild below, without reapplying choreography.

## Original pointing shoulder correction

The first reach nearly straightened the entire arm. The revised indication
keeps a relaxed elbow, with the hand slightly wider and closer to the body.
The upper arm swivels to align the elbow bend plane before the forearm flexes.
Only the pointing action's right arm rotation curves were replaced; the saved
walk, idle, and beckon curves remain intact. The new maximum shoulder-to-wrist
reach is 92.03% of arm length, and the wrist stays within 3.06 degrees of the
forearm. Both bounds are checked by `verify-founder-actions.mjs`.

`founder-actions-before-shoulder-repair.blend` preserves the prior scene.
`repair_pointing_shoulder.py` applies the reviewed candidate once. Routine
rebuilds continue to read the saved Blender file. All four actions, sprite
tiers, preview GLBs, GIF proofs and hash-locked provenance were rebuilt.

## In Blender

**`founder-actions.blend`** is the editing scene for this checkpoint. It opens
on the standing ready pose. Press **Space** to play or pause; set the scene FPS
for the action being reviewed using the rates below.
Select **Founder - editable skeleton**, then use the **Action Editor** to pick:

- `Realm_Grounded_Walk`: frames 1–24, 22.5 fps (24 fps / 1.066667 base).
- `Realm_Take_Stock`: frames 1–48, 12 fps.
- `Realm_Direct_Work`: frames 1–48, 15 fps.
- `Realm_Beckon`: frames 1–48, 15 fps.

Frame 25 or 49 is the duplicate closure key; exclude it from playback. Named
pose markers identify the authored beats. Bone poses remain ordinary editable
Blender keys. Eight cameras and the review lighting are retained.

After editing, save the scene and run from the Realm directory:

```sh
node scripts/founder-sprites/rebuild-from-blender.mjs
node scripts/verify-founder-walk.mjs
node scripts/verify-founder-actions.mjs
```

Set `REALM_BLENDER` if Blender is installed elsewhere. The rebuild reads the
saved file without changing the open Blender session, exports only the
character and its four actions, normalizes each clip's timeline independently,
and bakes the maps. It does not reapply the initial pose authoring over saved
edits. Preserve the frame counts; update `actions.js` and the action's
`realm_duration` metadata together if changing its duration.

The exporter locates the slot with skeleton curves, rather than assuming that
the first slot belongs to the skeleton. Blender's glTF importer creates separate
slots for the costume parts and rig. This distinction is necessary to export
actual motion and retain each action's correct name.

`founder-walk.blend` preserves the original walking checkpoint. The earlier
`founder-session-before-timing-reload.blend` also remains available. Neither is
the current editing file. `blender_scene.py` and `install_actions.py` are
bootstrap/migration scripts; do not rerun them over edited scenes.

## Sprite contract and evidence

- Rows: **S, SE, E, NE, N, NW, W, SW**. No bitmap mirroring.
- Files: `<action>-64.png`, `<action>-128.png`, `<action>-192.png`.
- Game close-zoom files: `runtime/<action>-<128|192>-<direction>.png`.
  All 64 direction strips are checked against decoded atlas RGBA pixels.
- Cell sizes: 64×84, 128×168, 192×252. Walk rows have 24 cells;
  standing rows have 48. No duplicate closing cell in a PNG.
- Authoring reference anchor `(0.5, 0.86)`, view height 2.6, camera elevation 30°.
  Runtime anchor `(0.5, 0.86)` registers the same physical ground origin.
  Round 212 removed the old front-toe alignment and aligned contact shading
  across the Founder and citizens; the Blender stance is unchanged.
- Smooth raster edges and transparency; a separate authoring contract from
  the four-view/eight-frame production citizens.
- Walking travel is 0.64 model units per cycle. The play area advances phase
  from distance, compensating for Realm's isometric 2:1 projection.

`manifest.json` locks saved Blender source, compiler inputs and outputs.
Per-action landmarks and quality reports accompany the PNGs.
`blender-actions-validation.json` records joint positions directly from the
saved Blender scene. The independent gate compares every rendered pose with
those witnesses; it also checks level toe geometry, planted standing feet,
closed loops, shared ready poses, gesture motion, actual decoded pixels,
named beats, all scrub positions, facing continuity, 3D, and mobile controls.

For a clean, byte-identical bake check:

```sh
node scripts/founder-sprites/bake.mjs --from-blender --out tmp/founder-sprites/clean-rebuild
node scripts/verify-founder-walk.mjs --clean-rebuild
```

The renderer is pinned to Three.js 0.180.0 and Chromium/SwiftShader. Exact pixel
agreement is checked on the build machine, not promised across GPU versions.

## Credits

- Mesh, texture, original rig and base walk/idle: [Kay Lousberg / KayKit](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0), revision `672074b73ba276876a19e8816ecdc5241817ab47`, CC0. License: `source/LICENSE-KayKit.txt`.
- Offline/preview renderer: Three.js 0.180.0, MIT ([license](../../../vendor/three/LICENSE)).
- Realm: adult body proportions, sleeve topology and weights, fitted clothing details, sole correction, leg/arm retargeting, standing gestures, camera and timing contract, Blender adapter, sprite compiler, workshop and validation.

No accounts or runtime network services are required. The ordinary game does
not import Three.js or decode these models.
