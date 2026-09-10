# Founder eight-direction walking pilot

Date: 2026-09-04. Runtime revision remains 198; this is a standalone authoring
workshop plus a title-screen entry, with no simulation or production-renderer
change. The round filename is a journal identifier, not a release number.

The owner asked for a much stronger sprite foundation, beginning with one
character walking in eight directions, and explicitly reopened the possibility
of 3D. During the work they installed Blender and asked for setup help.

## Result

- A CC0 KayKit Rogue mesh, texture and rig, credited to Kay Lousberg.
- A grounded 24-pose cycle rendered from S, SE, E, NE, N, NW, W and SW.
- Transparent 64x84, 128x168 and 192x252 sprite cells at a fixed root and scale.
- `founder-walk.blend`, with editable action, eight cameras, studio lighting,
  a review pedestal, and in-file instructions. The scene was opened in the
  installed Blender and playback was visually checked.
- `rebuild-from-blender.mjs`, which exports the saved scene and rebuilds PNGs.
- `walk-studio.html`: slow motion, every-pose scrubbing, contact guides,
  neighboring poses, mouse/keyboard movement, eight-view thumbnails, a live
  3D source view, and the current settler comparison.
- `eight-directions.gif` and `blender-preview.png` for quick review.

The owner still needs to judge the new character style and gait. This is one
complete walking study; it does not claim to have fixed every production role
or authored the next action family. The existing 224 production rows retain
their original locks and runtime selection.

## Defects caught during implementation

1. AnimationMixer's unchanged-value optimization could retain manually changed
   IK joints when revisiting a pose. The source sampler now assigns the bind
   transform and every sampled channel explicitly before applying the solve.
2. Fractional frame selection could round an exact scrub position down to the
   previous pose. Every one of the 24 slider positions now selects itself.
3. Blender 5.2.1 imported the intended cycle over 42.67 frames with the initial
   fractional FPS settings. Keys are explicitly retimed to 1–25, and exported
   glTF time arrays are normalized to a zero origin and 1.066667-second span.
4. The workshop initially lived in `js/`, where it conflicted with the game's
   strict module identity graph. Authoring code now lives under
   `scripts/founder-sprites/`; the ordinary renderer does not import Three.js.

An automatic approval check rejected reloading an unsaved Blender session.
The open session was preserved as
`assets/sprites/founder/founder-session-before-timing-reload.blend` before the
corrected scene was opened. No unsaved work was discarded.

## Validation run

```sh
env REALM_PORT=8942 node scripts/founder-sprites/rebuild-from-blender.mjs
env REALM_PORT=8942 node scripts/founder-sprites/bake.mjs --from-blender --out tmp/founder-sprites/clean-rebuild
env REALM_PORT=8942 node scripts/verify-founder-walk.mjs --clean-rebuild
node scripts/runtime-revision.mjs --check
node scripts/verify-sprite-source-contract.mjs
env REALM_PORT=8942 node scripts/verify.mjs --game --logic
scripts/.venv/bin/python scripts/founder-sprites/proof.py
git diff --check
```

All pass. The focused report is `tmp/founder-sprites/validation.json`; the
rebuild/geometry evidence lives beside the assets. A full release suite and
deployment were not performed for this isolated pilot.

## Continue

Use `assets/sprites/founder/founder-walk.blend` as the editing scene, save it,
then run the rebuild and focused gate. Do not rerun `blender_scene.py` over
edited work; it is a bootstrap. Discuss the next action's contact, anticipation,
impact and recovery poses against this stable character before widening the
asset family. Production migration will also need a deliberate decision about
actor scale and movement cadence; the new 24-frame/eight-view contract differs
from the existing eight-frame/four-view actors.
