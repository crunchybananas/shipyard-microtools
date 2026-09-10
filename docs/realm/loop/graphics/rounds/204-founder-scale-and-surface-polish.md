# 204 — Founder scale and surface polish

Date: 2026-09-05. Owner reported that the first Founder integration was giant
and asked for AAA as the visual quality target. Treat that as a continuing
standard for authored art and animation; this checkpoint completes the first
Founder's scale/material integration, not a claim that the entire game is AAA.

## Changes

The 58px runtime cell made the visible Founder roughly 50% taller than settlers.
It is now 36px. Measuring the rendered bodies instead of their padded atlas
cells keeps him slightly shorter to balance his broad silhouette. Runtime
anchor Y moves from .86 to .90, with a layered contact shadow, smaller selection
ring, and a tiny crest replacing the pennant. His name appears only while
selected at normal or close zoom.

`settlement-materials.js` shares character art direction between the workshop
and offline bake. Cloth has calmer forest greens; leather, warm skin, hair and
metal retain distinct surface response. Existing normal/roughness recipes,
environment reflections, and self-shadowing are baked at 384×504 before
downsampling into all four actions at all three resolutions. The original
Blender model palette and all saved motion keys remain unchanged in this pass.
The workshop courtyard and moving lights remain live browser additions.

The game chooses 64/128/192px source frames from the actual canvas transform.
Each enlarged load contains one facing, with exact RGBA agreement to its full
authoring sheet. Only two enlarged direction rows are retained, and enlarged
decodes are serialized. Existing small maps cover missing directions while
their larger rows load. The maximum retained RGBA references total 37.41 MiB;
browser image-cache and GPU allocation can exceed this reference accounting.

## Evidence

- Scale gate: 80 comparisons of actual settler/Founder renders; eight headings,
  five zooms from .65 through 3, and 1x/2x density. At the representative 1.3
  zoom / 2x density, visible height is 30.4 versus 31.9 world pixels, with .38px
  ground-baseline difference. All three source tiers are exercised.
- Gameplay gate: eight checks, including real eight-direction movement at the
  192px tier, work/rally orders, pause and interruption, Save/Continue, house
  occlusion, and 390px touch movement. The measured enlarged work/rally cache
  held 32.98 MiB of decoded RGBA references and never more than two large rows.
- Action gate: 4,032 rendered cells, plus exact decoded pixel comparisons for
  all 64 runtime direction strips. Saved Blender agreement, flat toes, planted
  standing feet, loop closure, relaxed shoulder and straight wrist still pass.
- Walk gate: 576 nonblank, distinct, unclipped cells; source stance error
  3.30e-7 units; fixed limb lengths, studio controls and phone layout pass.
- Live detail gate: nine checks for rendered light/material changes, all named
  poses, context recovery, quality levels, atlas eviction and mobile touch.
  Installed Chrome 152.0.7977.76; 10,211 triangles and 106 draws in the reviewed
  live pose. This pass was also inspected in the in-app browser.
- Realm lint, the canonical revision/module graph, and whitespace checks pass.

The focused reports and screenshots are under `tmp/founder-sprites/`, including
`scale-validation.json`, `scale-comparison.png`, `game-validation-chrome.json`,
`actions-validation.json`, and `detail-validation.json`. GIF proofs were rebuilt.
The new scale gate is registered in `scripts/verify-realm.mjs`.

## Remaining scope

The broader settlement still mixes older citizen art with this character.
Its compressed map uses the existing 1.6-tile animation cadence at unchanged
scouting speed; it does not provide physically locked world-space stance feet.
Future art work should preserve the new stature/grounding gate and extend the
same authored source approach to the remaining citizens and actions.

Local implementation, not committed or published. No simulation/save changes
were made in this polish pass, and no new full Safari interaction or complete
repository release run is claimed.
