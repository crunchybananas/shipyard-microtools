# Adult craftsperson

The first saved-scene NPC family serves ordinary **settlers and builders** in
the live game. Temporary opening construction assignments keep the settler
profession, so both roles deliberately share this family. Other professions
still use their existing painted families. This is one step in the continuing
whole-game quality goal, not a completed art overhaul.

## Editable source

`source/builder.blend` is authoritative. Open it in Blender to edit the body,
clothing, materials, mallet, cargo crate or four named actions. The family was
authored with Blender 5.2.1 LTS. `source/builder.glb`, `source/joints.json`, the
PNG maps and the manifest are derived output; do not paint or patch them as
source. The original Founder scene remains separate and unchanged by this
character's authoring pipeline.

The adult body is 1.820 m tall with a 0.272 m head and 0.786 m leg chain. New
continuous sleeves and wrists, narrow boots, a fitted waistcoat, rolled linen
cuffs and a split leather apron replace the earlier flat builder silhouette.
The face has smaller eyes, a continuous sculpted surface, cropped hair and
stubble pigment. Stable cloth, leather and wood normal/roughness maps share
the Founder's settlement material profile during baking. The ordinary game
loads only PNGs, not this 46,468-triangle source scene or its material maps.

The skeleton derives from the KayKit Adventurers CC0 source used by the
Founder. Original attribution and license are retained in
`source/LICENSE-KayKit.txt`; the manifest records both that derivation and
the new Realm geometry and actions. Do not describe the character as an
image-generated asset.

| Action | Blender action | Duration | Poses per direction |
| --- | --- | ---: | ---: |
| Walk | `Builder_Walk` | 1.066667 s | 24 |
| Rest | `Builder_Rest` | 4 s | 24 |
| Hammer | `Builder_Hammer` | 1.6 s | 24 |
| Carry | `Builder_Carry` | 1.066667 s | 24 |

Every action has eight views: south, southeast, east, northeast, north,
northwest, west and southwest. Standing actions keep the feet planted. The
saved joint witnesses independently verify exported poses and reviewed
wrist/toe limits.

### Motion v2

`scripts/citizen-sprites/animate_builder.py` re-authored all four actions
from animator key poses (the saved keys, not the script, are now the source).
It replaced a mannequin pass whose arms were held 45° out from the body, whose
walk shuffled 0.64 m per cycle with bent knees, a backward lean and the body
at its highest on heel contact, and whose mallet only stirred at chest height.

- **Walk:** 0.95 m stride with flat 60% stances (the gate contract), the
  weight lowest just after each heel contact and highest over the planted
  foot, pelvis yaw/list/sway, chest counter-rotation, a 4° forward lean, a
  stabilised head, and arms that counter-swing the legs with the forearm and
  hand trailing by a few frames.
- **Rest:** contrapposto on the right leg with a soft left knee, a breath per
  loop, a slow weight drift and one glance; the arms hang beside the torso.
- **Hammer:** ready (frame 0, the action's entry pose) · lift 1–6 · a
  one-frame anticipation hold at the apex 7–8 · overhead whip 9–10 · contact
  11–12 with the knees dropping into the blow · rebound 13 · settle and
  recover 14–23. The off hand steadies in front, then braces the thigh.
- **Carry:** the walk's exact ankle paths under a lower, heavier pelvis, a
  backward counter-lean against the load, and a crate that rides the chest
  one frame late with both wrists solved onto its sides.

The pass solves every frame analytically (pelvis and spine rotations, two-bone
IK with pole-derived bone twist for each ankle and wrist) and asserts the gate
contracts before saving: level planted soles, unmoving standing feet, carry
feet identical to walk, leg reach below 99.85%, and wrist bends under 45°. It
writes only to `tmp/` for review:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background \
  assets/sprites/citizens/builder/source/builder.blend \
  --python scripts/citizen-sprites/animate_builder.py -- --table
```

After review, copy the staged `.blend` over `source/builder.blend` and run the
rebuild below. Do not rerun the pass over later hand edits to the keys.

## Rebuild and review

From the Realm directory, with the local preview on port 8942:

```sh
REALM_PORT=8942 node scripts/citizen-sprites/rebuild-from-blender.mjs
REALM_PORT=8942 node scripts/verify-builder-source.mjs
REALM_PORT=8942 node scripts/verify-builder-game.mjs
```

Set `BLENDER_PATH` if Blender is installed elsewhere. The default rebuild
exports **the saved production scene**, normalizes clip timing, samples poses,
bakes every action and writes hashes. For an isolated review build:

```sh
REALM_PORT=8942 node scripts/citizen-sprites/rebuild-from-blender.mjs --out tmp/citizen-sprites/review-build
```

`author_builder.py` is a bootstrap for creating a staged character under
`tmp/`, and `animate_builder.py` is the staged motion pass above. Both are
deliberately absent from the rebuild command: rerunning either would discard
subsequent artistic edits. Keep reviewing the saved source.
Review the direction contact sheets and live construction, cargo, pause,
near/far depth and phone selection after changes. Set `REALM_BROWSER=webkit`
to run the same source/game gates in an installed Playwright WebKit browser.
That automated engine check is separate from native Safari playtesting.

## Runtime contract

- **768 authored poses**, each baked at 64×84 and 128×168: 1,536 cells.
- Four complete small maps plus 32 exact 128px direction strips. Full 128px
  maps and direction contact sheets remain review artifacts.
- Each runtime cell is 44 world pixels tall, with width `44 × 64 / 84`.
  Its physical ground origin is `(0.5, 0.86)`, shared with the bake camera
  and the Founder. Do not align the camera origin to the foremost toe.
- `js/builder-presentation.js` switches to the new body only when **all four**
  small maps are ready. Delayed or failed loading retains the complete old
  family; it cannot mix a new walk with an old work/carry body.
- Walk and carry read accepted displacement from the existing actor cache.
  A blocked route holds the feet. Idle and hammer use presentation time;
  pause holds all poses. No renderer change mutates routes, activities or saves.
- Close zoom requests at most two detail rows concurrently and retains at
  most twelve. Rows used by the current crowd stay pinned; remaining facings
  use complete small maps. Maximum retained decoded image references total
  **41,287,680 bytes (39.375 MiB)**, not a process/GPU peak-memory estimate.
- Cargo is baked into the carry pose, so the renderer adds no second cargo
  overlay. Eating and foraging show rest instead of an unrelated hammer swing.
  Explicit legacy Sprite Lab and Actor Muster previews retain their source
  families for independent review.

Action-entry/exit poses, resource-specific cargo, eating/foraging actions,
additional identities and the older profession families still need authored
work. The current source should not be presented as final AAA character art.
