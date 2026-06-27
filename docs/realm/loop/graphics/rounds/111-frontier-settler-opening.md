# Round 111 - Frontier Settler Opening Family

## Goal

Stop treating sprite tooling as the finish line. Replace the legacy figures
the player sees at the beginning of a real game, prove them in the live
renderer, and strengthen the pipeline wherever that inspection exposes false
confidence.

## Starting Point

- Previous handoff: `rounds/110-live-actor-muster.md`
- `settler/idle`, `settler/walk`, `settler/work`, and `settler/carry` were BASE.
- A fresh game opened on three round-headed blue legacy settlers.
- The saved Year 16 town made the wider problem obvious: farmer, rancher, and
  other employed roles still looked flat and pasted onto the painted world.
- Generic in-app screenshots timed out on Realm's dual high-resolution
  canvases, and the first rebuilt atlas appeared unchanged because its URL was
  cached.

## Art Direction

The new settler is a sturdy frontier villager:

- short uncovered dark-brown hair
- blue-gray layered wool tunic
- cream rolled sleeves
- leather belt and one side satchel
- dark trousers and brown boots
- painterly clustered pixels matching the terrain/building vocabulary

The identity deliberately rejects the old hooded-knight/SVG-port silhouette.

## Changes

- Generated and packed a complete four-direction `settler/walk` family.
- Rejected two generated left-facing candidates for dense-width instability.
  The final left row is a cell-wise reflection of the clean right-facing peer,
  preserving frame order, physical satchel side, and exact peer scale.
- Generated a complete four-direction `settler/idle` family.
- Repacked every idle direction against the walk family's `72px` body height
  after visual review found the first candidates were `77-78px` tall and would
  pop larger whenever movement stopped.
- Regenerated the front/back walk cadence after the gait audit exposed subtle
  one-foot bias. The final front row keeps the imagegen upper body and changes
  only the pants/boots region on alternating frames.
- Updated `scripts/audit-walk-gait.mjs` so front/back rows use which boot
  reaches farther down-screen, the actual isometric perspective cue, instead
  of horizontal lower-body centroid. Side rows retain horizontal stride
  scoring.
- Updated runtime atlas revisioning:
  - the actor atlas inherits the renderer release revision
  - a page `v` query can override it during iterative review
- Added query-gated `?runtimecapture=1` composed-canvas evidence. It captures
  game plus postfx, also rendering a verification frame during Realm's normal
  hidden-tab simulation branch. Ordinary gameplay does no capture work.
- Fixed `scripts/verify-anim.mjs` so its close screenshot preserves the
  starting camera center instead of moving off-map.
- Updated the row workbench's peer lookup so staged action families compare
  against staged/accepted sibling rows rather than stale compiled legacy peers.

## Accepted Rows

All eight settler opening rows are LOCKED with no warning waivers.

Idle:

- body height: `71-72px`
- within-row height range: `0-1px`
- flicker: `1.2-4.4`
- ground-anchor range: `0px`
- max body-center jump: `0.84-1.27px`

Walk:

- body height: `71-72px`
- front/back within-row height range: `0-1px`
- side within-row height range: `4px`
- front/back flicker: `1.2-5.6`
- side flicker: `28.8`
- warnings: none

Cross-action idle-to-walk checks:

- height delta: `0-1px`
- front/back width delta: `0.5-1px`
- side width delta: `7px`, expected because idle legs close
- palette delta: `5.95-12.24`

Final gait scores:

- `settler/walk/down`: `8.0`
- `settler/walk/up`: `8.0`
- previous accepted front row under the corrected metric: `77.0`

## Runtime Findings

The first live saved-town capture confirmed the user's concern: buildings and
terrain were painterly, while most employed citizens remained flat legacy
figures. A fresh unsaved game then exercised the default settler role.

After atlas cache revisioning was fixed, the opening scene showed all three
citizens as the new frontier settler at consistent game scale. Close animation
verification at `2.2x` showed the same identity and body height across the
cluster. No saved game was overwritten.

Evidence:

- `scripts/screenshots/runtime-settler-opening-round-111.png`
- `scripts/screenshots/anim-live-actors.png`
- `scripts/screenshots/anim-live-actors-close.png`
- `assets/sprites/actor-rows/proofs/settler-idle-*-x4.png`
- `assets/sprites/actor-rows/proofs/settler-walk-*-x4.png`

## Verification

Commands run after the final art and runtime changes:

```sh
node --check js/main.js js/render.js js/sprite-lab.js \
  scripts/verify-anim.mjs scripts/audit-walk-gait.mjs
scripts/sprite-row verify
node scripts/build-motion-atlases.mjs
node scripts/verify-sprite-source-contract.mjs
node scripts/audit-sprite-frames.mjs
node scripts/audit-walk-gait.mjs
node scripts/verify-all-sprite-maps.mjs
node scripts/verify-anim.mjs
node scripts/verify-critic.mjs
node scripts/verify.mjs --game --logic
```

Final results:

- accepted row overrides: `11`
- exhaustive rows: `224/224`
- exhaustive frames: `1,792/1,792`
- blanks, low-variety rows, address/mapping/page errors: `0`
- exhaustive row digest: `dad90dad5713`
- animation moving pairs: `7/7`
- critic page errors: `0`
- game/logic page errors: `0`

At the `390x844` responsive breakpoint, Sprite Lab had
`scrollWidth === clientWidth === 390`, the active settler row remained
reviewable, and provenance showed LOCKED with warnings `none`, body height
`71-72`, body delta `1`, and no false body-height warning.

## Remaining Issues

- `settler/work` and `settler/carry` are still BASE and can visually pop back
  to legacy art after the opening movement/idle states.
- Farmer and rancher remain conspicuous legacy families in established towns.
- Miner side work remains protected WAIVED repaint debt.
- Lumber work up/down and guard work still rank high in the continuity audit,
  largely because of large tools, but remain visual repaint candidates.

## Next Best Target

Finish `settler/work` as a coherent four-direction action family at the same
`71-72px` body scale, then replace `settler/carry`. This removes all remaining
action-transition pops from the game's first character identity before moving
to farmer and rancher.

## Files Changed

- `assets/sprites/actor-rows/`
- `assets/sprites/actors-compiled/settler.png`
- `assets/sprites/actors-atlas.png`
- `assets/sprites/README.md`
- `index.html`
- `js/main.js`
- `js/render.js`
- `scripts/sprite-row-workbench.py`
- `scripts/audit-walk-gait.mjs`
- `scripts/verify-anim.mjs`
- `scripts/screenshots/`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/111-frontier-settler-opening.md`
