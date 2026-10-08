# Original art and runtime ownership

The game uses an original Blender-authored village kit, not the existing Realm sprite atlases. `tools/create_assets.py` generates the editable `assets/village-kit.blend` and runtime `assets/village-kit.glb`. Geometry, colors, models, character, and procedural audio were created for this game. The world models need no external textures, fonts, or model downloads. Interface illustrations have separate provenance below.

The GLB exports twelve named roots at the origin: cottage, lumber, quarry, orchard, garden, windmill, bell, hearth, villager, boat, broadleaf, cypress. The world loads and uses every root. The building shelf images are rendered from those same runtime models.

Models use meters, Y-up in the exported GLB and +Z as the front. Terrain grid cells are 1.8 meters. The windmill rotor turns about local Z; the bell swings about local X; arms and legs swing about local X. Villager tunic variants replace only the original tunic vertex color. Trees are instanced from their Blender meshes, not duplicated objects with individual draw calls.

The generated kit contains 18 mesh nodes and 19 material primitives, with 94,974 triangles across all twelve source models. Its 9,004,100-byte GLB is loaded once. Runtime counts depend on buildings and residents; the current town renderer presents every citizen. Ground, shoreline, footpaths, dock and resource rocks are procedural world geometry.

Editable model sources accompany the export. The three reference renders are `village-kit-contact.png`, `villager-pose-review.png`, and `nature-review.png`. These show art and articulation; gameplay screenshots and navigation reports provide separate runtime evidence.

To regenerate with the installed Blender executable, run from the Realm directory:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python wildhaven/tools/create_assets.py
```

The generator uses its own background scene. It does not alter an open Blender session. The `.blend` contains editable source assemblies; contact-sheet arrangements and pose reviews are separate render scenes. Review metadata in `village-kit.json` after regeneration and rerun browser verification if the GLB changes.

The only third-party game code is the existing Three.js 0.180.0 distribution in `../vendor/three/`, MIT; see that directory's README and LICENSE.

## Town expansion

`tools/create_town_assets.py` authors the additional editable `assets/town-kit.blend` and runtime `assets/town-kit.glb`. Its twenty roots are farm, bakery, sawmill, mine, smith, market, school, well, barracks, warehouse, clinic, upgrade_cottage, construction, and seven hand-grip tools (hammer, axe, pick, hoe, spear, book, basket). Each root is one vertex-colored mesh using one shared material; no textures are needed. The 6,476,180-byte pack contains 64,249 triangles. Every workplace fits a 1.7-meter footprint.

`town-kit.json` records physical workstation targets and dimensions. `town-art-contact.png` is the authored asset review. Runtime workers use the canonical occupation colors and held tools, walk to real work surfaces, perform job poses, carry deliveries and patrol. These are presentations of the authoritative jobs: movement does not duplicate resources or create workers. Ground coverage markings and the approaching coastal boat also read simulation state without changing it.

Every actual citizen has a renderer actor and is findable, including populations above sixty. Several related buildings share kit models (for example smith/toolmaker and school/chapel); second- and third-level production buildings gain a height/plaque treatment. Only the upgraded cottage currently has a wholly distinct replacement building. Unique art for every ordinary building level remains future work; the frontier kit adds tactical soldier models and animations.

Regenerate the additional kit with:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python wildhaven/tools/create_town_assets.py
```

Both generators use a separate background Blender process and leave interactive Blender sessions untouched. The original village GLB was not changed by the expansion.


## Island frontier

`tools/create_frontier_assets.py` creates editable `assets/frontier-kit.blend`, runtime `assets/frontier-kit.glb`, metadata `assets/frontier-kit.json` and the `frontier-art-contact.png` review. Its fourteen roots cover connected stone wall sections, a hinged gate, watchtower, outpost, rubble, spearmen, archers, raiders, enemy archers and three distinct neighbor compounds. Original geometry and vertex colors require no image textures or extra runtime library.

The renderer consumes actual fortification progress, HP, gate state, unit position, attack timing, damage and arrow trajectories. Military citizens are excluded from ordinary worker actors so nobody is drawn twice. Neighbor hamlets fit their shared 3×3 blocked compound; cardinal approaches remain open. The widened gate, physical pier clearance and both troop/civilian navigation use the same rotation rules. `review/frontier-geometry-report.json`, `review/frontier-earned-render-report.json` and `review/frontier-earned-battle-render-report.json` separate geometric checks from current rendered evidence.

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python wildhaven/tools/create_frontier_assets.py
```

## Living island kit

`tools/create_living_assets.py` creates `assets/living-kit.blend`, `living-kit.glb`, `living-kit.json` and `living-art-contact.png`. It reuses the project's original frontier geometry helpers in a separate background Blender process. The 22 roots contain four landmarks in original/restored forms and fourteen job-specific cargo models. All geometry is original; there are no textures, downloaded models, audio files, or new runtime dependencies.

The pack contains 14,868 triangles and exports to 1,434,160 bytes. Each root is consolidated to one mesh. All landmark horizontal bounds remain within 0.83 meters of their tile center; they replace four existing natural obstacle cells, preserving old town layouts and navigation. The metadata records both the living generator and shared helper hashes. Carried goods use the actual workplace type, so orchard fruit, field grain, mill flour, mined ore, forged iron and finished tools remain distinguishable.

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python wildhaven/tools/create_living_assets.py
```

The Web Audio instrument set is original code in `js/audio.js`. `review/living-sound-reel.wav` is a generated review artifact, not a runtime dependency. Its cue order and measured levels are recorded in `review/living-browser-report.json`.

## Interface illustration library

`assets/resource-icons.webp` is the existing four-resource interface sheet. This pass preserves its bytes and use in the compact HUD.

`assets/resource-pantry.jpg` was generated in one ImageGen request on October 8, 2026 for Stores and resource details: a warm, playful painterly pantry shelf with bread, fruit, timber, stone, tools, folded cloth, books and foliage, on a pale cream background, without lettering. The 2172 × 724 source was packaged as a quality-82 JPEG with the existing macOS image utility, without cropping, resizing or redrawing. The 311,740-byte runtime file has SHA-256 `dfb8ca765741cd87d40b5ba93f9ad34f61cfa17ddf895101ed2d980fd796d27c`. The original generated PNG remains preserved in the task workspace. This decorative image is reused by the resource panels, with empty alternative text and reduced height on compact screens; it carries no controls or essential information.

Seasonal scenery reuses the original terrain and forest geometry. Only authored foliage colors, terrain, flowers and lighting change; tree trunks, buildings, navigation and production rules retain their original roles. Temporary harvest bunting is procedural presentation tied to the saved festival timer.

`assets/defense-company.jpg` extends the same interface illustration library. Generated in one ImageGen request on October 8, 2026, it depicts three friendly adult town defenders preparing together at an open village gate, with a map, shield, bow and small sparrow. The original 2172 × 724 PNG remains at `generated_images/exec-213e95db-ef8d-45bb-a261-fce56e7cfef7.png` in the task workspace. The existing macOS image utility packaged the unaltered composition as a quality-82 JPEG: 625,638 bytes, SHA-256 `1c678d384b0c86d33ae46683dd27af2671979d4a0f3e7682060098bab12b12e1`. Company uses it as a lazy-loaded decorative header with empty alternative text; compact styling reserves space for actual orders and hides the art in short landscape. It contains no essential instructions or interactive controls.
