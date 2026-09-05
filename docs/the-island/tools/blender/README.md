# Original Island environment kits

Open `harbor-rooms.blend` in Blender. `east-room.png` is a render of its real meshes.
The runtime asset is `../../assets/harbor-rooms.glb`; eight consolidated mesh parts
use vertex colors and a shared material. No downloaded models or textures are used.

Regenerate from the Island root:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python tools/blender/harbor_rooms.py
```

The generator writes the .blend source, GLB, geometry.json and a Cycles room render.
If geometry changes, update the manifest byte count in `js/assets.js` and the
inventory in `ASSETS.md`. Then run the full harness and recapture the playthrough.
Never put private narrative source or a biography mapping in this directory.

## Landfall

`landfall.blend` contains the lighthouse shaft, spiral stair, handrails, vaulted
room ribs, drying table, wind pines, basalt and a coastal arch. Collections name
each reusable part. `landfall.png` is the source tower render; the in-game lantern
and occupied study complete the building at runtime.

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python tools/blender/landfall.py
```

The generator reads the `layout:start` JSON in `../../js/tower-course.js`. Change
that authority before regenerating stairs; hand-editing only the mesh would break
the player floor. The GLB includes separate distant shaft and pine meshes. Runtime
assembly and LOD live in `../../js/landfall.js`. Review geometry totals in
`landfall-geometry.json` and run `tools/harness/landfall.mjs` through `one.sh`.
