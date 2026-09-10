# 203 — The Founder enters the settlement

Date: 2026-09-05. Owner requested first-character gameplay integration and a
repair to the shoulder in Work over there.

The existing `G.avatar` now renders the authored Founder through a dedicated
Canvas2D adapter inside the world depth pass. Eight directional views, walk,
idle, pointing and beckoning reuse the saved Blender source. The existing
Founder control, pathfinding, scouting rewards, production influence and save
identity continue to apply. Other citizens keep their current families.

Accepted placement, assignment and upgrade commands point at their target;
rally orders beckon. Walking interrupts, rejected orders do nothing, and a
gesture returns to idle. Animation state is shell-owned and absent from saves.
Source tiers load on demand, with one enlarged map retained at a time.

The pointing arm now reaches outward with a soft elbow and an aligned bend
plane. Its maximum extension is 0.920327 of arm length; maximum wrist bend is
3.0552 degrees. Only that action's right arm curves were replaced. The prior
scene is backed up as `founder-actions-before-shoulder-repair.blend`.

The game's compressed map uses 1.6 tiles per cycle at unchanged scouting speed.
This is a cadence calibration, not physical world-space foot locking. Live
normal maps and relighting remain in the workshop; the game uses baked maps.

Verification:

- Installed Chrome 152: seven gameplay checks, including real eight-direction
  movement, successful and rejected orders, interrupts, pause, Save/Continue,
  actual front/behind-house canvas ordering, and 390px phone touch movement.
- Action gate: all 4,032 rendered cells, standing feet, flat toes, shoulder and
  wrist limits, loop closure, and independent saved-Blender joint agreement.
- Walking gate: all 576 walk cells, fixed bone lengths and source stance error
  below 0.00000034 units. Detail gate: all named beats in eight directions,
  lighting, context recovery, atlas eviction and mobile controls.
- Core purity and deterministic replay: unchanged golden at tick 43,200.
- Runtime graph, source contract, existing First Muster/Founder controls pass.
- Realm lint, core/FX isolation, scouting rewards and the 224-row registration
  audit pass. The final gameplay gate also checks runtime frame/duration
  metadata against the Blender manifest and bounds enlarged atlas retention.
- Native Safari renders the new character in the ordinary settlement. The
  full automated interaction gate runs in Chrome; no full Safari automation
  or crowd-scale 3D claim is made.

Reports and screenshots: `tmp/founder-sprites/game-validation-chrome.json`,
`actions-validation.json`, `detail-validation.json`, `founder-in-game.png`,
`founder-work-order.png`, `founder-behind-house.png`,
`founder-in-front-house.png`, `founder-in-game-mobile.png`.

Local implementation, not committed or published. The four Founder checks are
registered in `scripts/verify-realm.mjs`; this pass ran the applicable focused
checks rather than claiming a complete repository release run.
