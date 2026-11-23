# Frog Alchemist: modeled from the approved tile

Runtime asset: `docs/heartwood-island/assets/frog-alchemist.glb`.

Source generator: `tools/heartwood/build_frog.py` (Blender 5.2.1). Regenerate from repository root with:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python tools/heartwood/build_frog.py
```

The source is the unchanged approved `docs/heartwood-island/assets/plates/frog-alchemist.svg`. Its pixels were inspected before modeling. This is an original sculptural interpretation, not an exact automatic 2D-to-3D conversion and not a billboard. It preserves the reference's identifying pose: one finger at the chin, a round potion flask raised in the opposite hand, large eyes, broad mouth, folded haunches, webbed feet, bent floppy wizard hat, draped cape, and explicit heart clasp. The monochrome reference does not specify colors; sage skin, midnight-teal hat, blackberry cape and coral/gold heart are deliberate color interpretations.

The first rendered model was inspected and revised to fix a partially obscured heart and hat/eye intersections. The final preview was inspected again. The display plinth, lights and camera in the `.blend` preview scene are not in the GLB.

Verified character-only bounds (glTF coordinates):
- Width: 1.2437605; height: 1.5; depth: 0.9010019.
- Feet minimum Y: 0; forward: +Z.
- 29,378 triangles across 54 meshes; GLB approximately 643 KiB.
- No external textures, models or decoders needed.
- Named groups: `Body`, `Head`, `Hat`, `Cape`, `Flask`, under `FrogAlchemist`.
- No skeletal rig or clips. Apply procedural hopping/breathing to the root. Child group pivots are at the root, so do not rotate the head group as if it were a neck joint.

The exact source artwork remains unchanged. The reference PNG is only a white-background rasterization for visual comparison.
