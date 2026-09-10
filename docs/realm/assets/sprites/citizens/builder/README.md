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
northwest, west and southwest. Hammering includes ready, backswing, contact,
rebound and recovery. Carrying preserves the walk's ankle trajectories while
both hands grip the crate. Standing actions keep the feet planted. The saved
joint witnesses independently verify exported poses and reviewed wrist/toe
limits.

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
`tmp/`. It is deliberately absent from the rebuild command: rerunning it
would discard subsequent artistic edits. Keep reviewing the saved source.
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
