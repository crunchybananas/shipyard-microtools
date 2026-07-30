# Current Graphics Handoff

## Realm 170 multi-resolution actor presentation — 2026-07-29

- Large-screen inspection proved that actor review art was authored at
  `64x84`, drawn at `27x35`, transformed again by camera zoom/device scale, and
  then—on Retina—downsampled to half device resolution before post-processing.
  Art quality could not be judged honestly through that path.
- The exact `512x84` eight-frame row remains the review/source contract.
  The compiler now emits row-isolated `27x35`, `35x46`, `54x70`, and `64x84`
  runtime atlases. It uses `LanczosSharp`, strips changing PNG metadata, and
  records dimensions, derivation settings, and SHA-256 hashes in
  `assets/sprites/actors-runtime-atlases.json`.
- The renderer measures the current Canvas transform in physical pixels.
  Default zoom on a Retina display selects `35x46` at exact `2x`, while a
  native-scale zoom transition selects `54x70` at exact `1x`; both disable
  smoothing. Arbitrary zooms choose the least-destructive tier and use
  high-quality smoothing only when no integer fit exists.
- Post-processing now keeps full `1x`/`2x` backing resolution instead of
  halving Retina frames before upload. The existing performance guard remains
  the escape hatch: it may hide post-processing while leaving the sharp base
  canvas visible.
- The runtime publishes its active tier, projected size, integer scale, and
  smoothing state as `data-actor-atlas-*` attributes on the game canvas.
  Browser verification at `1440x1000`, DPR `2`, proved `35x46 @ 2x` at default
  zoom and `54x70 @ 1x` after the common zoom transition, both unsmoothed.
- Two consecutive clean builds produced identical SHA-256 hashes for all four
  actor atlases. `verify-render-sharpness.mjs` and the expanded source-contract
  verifier are now mandatory checks in `verify-realm.mjs`.
- This fixes the rendering baseline only; it does not bless the current art
  style. The active next phase remains a new in-game visual slice whose actor,
  terrain, building, road, and effect sources may replace all existing art.

Validation run:

```sh
node scripts/build-motion-atlases.mjs
node scripts/verify-render-sharpness.mjs
node scripts/verify-sprite-source-contract.mjs
node scripts/runtime-revision.mjs --check
```

## Offline actor pose-compiler decision — 2026-07-18

- The owner correctly identified a systemic scale change: accepted guard
  idle/walk/work rows measure `73px` facing up and `76–77px` facing down or
  sideways. Three blue-tunic guard carry candidates are warning-free but remain
  candidates. The generated up row was not staged because matching the smaller
  accepted up family would preserve the visible direction pop.
- At council review, the cast problem was broader than the `37` inherited rows:
  `149/187` accepted rows had settler-derived provenance. After the temporal
  phase repairs, the current manifest contains `191 LOCKED`, `3 CANDIDATE`, and
  `30` unstaged `BASE` rows; because candidates never compile, the runtime still
  inherits `33` base rows. Row-local cleanup can therefore produce mechanically
  stable palette-swapped bodies without a distinct or persistent character
  identity.
- RFC 0002's bounded offline comparison is complete; it never enabled a live
  skeletal renderer. All three candidates produced the same `128`-frame
  guard/builder comparison and remain outside the runtime manifest.
- Candidate A is the only continuation. Its `16/16` rows pass hash-tied
  body-mask scale, root/feet, authored phase/contact, socket, and reproducible
  build checks. Right-facing frames are exact same-beat derivations of left,
  eliminating a second horizontal chronology authority. Its style-era cue is
  painted on `16/16` rows.
- Candidate B is rejected as visible art: its rig evidence is mechanically
  clean, but only `4/16` rows register the painted cue and the result is visibly
  faceted/sterile. Candidate C is rejected as future source authority: it has no
  authored body/contact/socket surface, and the staged guard-carry family still
  contains reversed chronology.
- A is not canonical. It currently bakes identity and base garment together in
  role concepts; `VisualDNA`/`GarmentKit` interchangeability, handed equipment,
  target runtime scale, `1x` identity, seams/occlusion, live transitions,
  authoring economics, and the complete guard pilot remain red.
- The isolated A output profile selects flattened rows for the next pilot:
  three synchronized layers measured about `3×` the command submission,
  `2.8` versus `7.1ms` median drain at `250` actors, and approximately
  `8.26` versus `2.75 MiB` decoded. All `48` layer strips are unique, so no
  interchange reuse dividend exists yet. This does not select the permanent
  runtime strategy.
- If a winner is adopted, its rig source becomes the sole actor source after
  conversion and the old row-by-row authoring source is deleted. Runtime output
  remains raster atlas data; there is no dual source path or compatibility
  mode.

## Cross-direction temporal phase repair — 2026-07-18

- The runtime intentionally preserves animation frame `N` when facing changes,
  so warning-free rows can still pop to a different gait or tool beat on a
  turn. `scripts/audit-sprite-direction-phase.mjs` audits all `56` role/action
  families and all `224` direction rows as one temporal contract, with a
  mandatory negative self-test and no waiver path.
- The first strict run reported decisive left/right cyclic matches of
  `+3` for `builder/work`, `+1` for `blacksmith/walk`, and `+1` for
  `blacksmith/carry`. Pixel-level inspection found the deeper common cause:
  the right rows were not merely cyclically shifted. They were the left rows
  mirrored and stored in full reverse chronology. Both blacksmith rows match
  their left peer pixel-for-pixel under `right[N] = mirror(left[7-N])`; builder
  also matches pixel-for-pixel with its existing one-pixel native horizontal
  anchor offset.
- Only the right rows were deterministically reordered from old frames
  `0,1,2,3,4,5,6,7` to `7,6,5,4,3,2,1,0`. No pixel was repainted, rescaled, or
  filtered, so identity, body scale, handedness, anchors, and the authored loop
  are unchanged. Frame `N` is now the same chronological beat in both side
  views.
- `builder/work/right`, `blacksmith/walk/right`, and
  `blacksmith/carry/right` were promoted with
  `deterministic-frame-reversal` provenance and fresh hashes/proofs. This adds
  the two formerly inherited blacksmith rows to the protected set, bringing the
  manifest to `189 LOCKED` overrides. The compiled atlas and actor
  registration were rebuilt.
- The hardened exact side-view check then exposed five more rows that were
  hidden by cyclic-only scoring: `farmer/work/right`, `miner/work/right`,
  `builder/walk/right`, `builder/carry/right`, and `guard/carry/right`.
  Independent full-color inspection proved that all `40/40` frames satisfy
  exact RGBA equality under
  `left[N] = mirror(oldRight[7-N])`; these were true source-order defects, not
  silhouette coincidences.
- `miner/work/right`, `builder/walk/right`, and `builder/carry/right` now have
  fresh hash-locked `deterministic-frame-reversal` rows. The builder rows add
  two accepted overrides, bringing the manifest to `191 LOCKED`. The unchanged
  farmer row still trips the strict `edge-contact` analyzer, so it remains an
  inherited `BASE` row instead of receiving a waiver. Its canonical base
  source was reordered directly.
- `guard/carry/right` also remains inherited at runtime because its manifest
  slot intentionally holds the newer blue-tunic `CANDIDATE`. Only the old
  runtime base row was reordered; the candidate PNG, manifest entry, and
  SHA-256 remain unchanged. This keeps one runtime source and one explicitly
  non-compiling review candidate without deleting semantic work.
- The after audit has no findings: all five newly exposed families and the
  original three repairs now preserve runtime frame `N`, and all `56/56`
  families pass. Visual evidence is recorded in
  `assets/sprites/actor-rows/proofs/direction-phase-resequence.png` and
  `assets/sprites/actor-rows/proofs/direction-phase-resequence-runtime.png`.

Validation run:

```sh
scripts/sprite-row verify
node scripts/build-motion-atlases.mjs
node scripts/verify-sprite-source-contract.mjs
node scripts/audit-sprite-registration.mjs
node scripts/audit-sprite-frames.mjs
node scripts/audit-walk-gait.mjs
node scripts/audit-sprite-direction-phase.mjs
REALM_PORT=4870 node scripts/verify-anim.mjs
REALM_PORT=4871 node scripts/verify-all-sprite-maps.mjs
REALM_PORT=4872 node scripts/verify.mjs --game --logic
```

## Realm 163 strict sprite/runtime clean cut — 2026-07-12

- Realm `163` has one strict actor-row promotion path. The workbench cannot
  accept a row with analyzer warnings, the compiler and source verifier reject
  any status outside the current contract, and the frame audit has no
  `--allow-mixed` escape hatch. Waiver-capable statuses and manifest fields
  have been removed; source control is the rollback path.
- Sprite Lab now opens only through `?spritelab=1` and the explicit
  `role`/`action`/`dir` parameters. The old `?rolesheet=...` parser is gone.
  Sprite Lab and Actor Muster expose exactly three provenance states:
  `BASE` for inherited source art, `CANDIDATE` for staged art that does not
  compile, and `LOCKED` for warning-free, SHA-256-protected row overrides.
- The realm 163 checkpoint contained `187 LOCKED` overrides and `37 BASE`
  inherited rows with no candidates or waiver path. The current worktree has
  `191 LOCKED` overrides after protecting the blacksmith and builder phase
  repairs, plus three uncompiled guard carry candidates. All source-contract, manifest,
  frame-continuity, temporal-phase, gait, registration, atlas-addressing,
  runtime animation, live-mapping, and logic gates are green under the strict
  path.
- The remaining blind spot is semantic visual consistency. Structural gates
  can prove dimensions, nonblank frames, stable body scale/anchor/palette,
  motion variety, and correct runtime addressing; they cannot prove that two
  clean rows depict the same character identity, costume, or equipment. The
  inherited `guard/carry/*` family demonstrates this: it passes mechanical
  checks but does not match the blue-tunic, simple-helmet, short-sword guard
  identity established by idle, walk, and work. Promotion still requires a
  human Sprite Lab and live-runtime comparison across adjacent actions.
- Repaint work orders now keep that semantic comparison explicit:
  `identity-reference-contact.png` is assembled only from warning-free,
  hash-matched `LOCKED` adjacent actions for the same role/direction, while
  `motion-reference-contact.png` labels target-action rows as `BASE`,
  `CANDIDATE`, or `LOCKED` and is never authoritative for identity. Generation
  fails when no trusted identity row exists instead of treating inherited
  `BASE` art as the character definition.

Strict verification checkpoint:

```sh
scripts/sprite-row verify
node scripts/build-motion-atlases.mjs
node scripts/verify-sprite-source-contract.mjs
node scripts/audit-sprite-registration.mjs
node scripts/audit-sprite-frames.mjs
node scripts/audit-walk-gait.mjs
node scripts/audit-sprite-direction-phase.mjs
node scripts/verify-anim.mjs
node scripts/verify-all-sprite-maps.mjs
node scripts/verify.mjs --game --logic
```

## Guard identity and native-anchor polish — 2026-07-10

- Repainted the complete `guard/work/down|up|left|right` family around the
  guard's actual idle/walk identity: simple helmet, blue tunic, brown pouch,
  and boots. The obsolete shielded plate-armour identity is gone from this
  action, and all four directions now use the same compact short-sword drill.
- Rejected the first spear passes instead of waiving their defects. Long
  thrusts either shrank the body, clipped the cell, or introduced 14px center
  pops. The accepted rows have no blank frames, loose fragments, edge contact,
  direction-scale warnings, or ground-anchor drift; the reviewed left row is
  mirrored exactly for right-facing timing and scale symmetry.
- Native anchor stabilization now skips negligible whole-frame resampling.
  One-pixel painted pose variation remains intact while integer translation
  removes lateral body jitter, avoiding the softness and chroma-edge flicker
  that a 1% LANCZOS resize introduced during review. Actor atlases and
  registration were rebuilt, and client imports were revised to `realm=159`.

Validation run:

```sh
scripts/sprite-row verify
node scripts/verify-sprite-source-contract.mjs
node scripts/audit-sprite-registration.mjs
node scripts/audit-sprite-frames.mjs
node scripts/audit-walk-gait.mjs
REALM_PORT=4740 node scripts/verify-anim.mjs
REALM_PORT=4741 node scripts/verify-all-sprite-maps.mjs
REALM_PORT=4742 node scripts/verify.mjs --game
REALM_PORT=4743 node scripts/verify-logic.mjs
node scripts/verify-core-purity.mjs
node scripts/verify-determinism.mjs
```

## Engine + ambient animal transition polish — 2026-07-10

- Replaced the context-free procedural sheep with three painted ambient atlas
  sources: deer remain gradual wild forest life, cows exist only around a
  completed cow pen, and chickens exist only around a completed coop. Domestic
  animals are removed with their owning building, stay inside local habitat,
  face their real travel direction, settle immediately on arrival, and now
  participate in the same isometric depth queue as buildings and actors.
- Removed every opaque-area-derived actor row scale. Tools, cargo, and broad
  work poses were being counted as body mass, shrinking entire work/carry rows
  by roughly 3–4 screen pixels at the transition. Registration now contains
  feet-line offsets only; body consistency remains an art-quality gate.
- Actor animation now has a per-entity action epoch: real action changes begin
  on frame 0, direction changes preserve phase, idle rows use their authored
  breathing loop, and stationary carry poses hold frame 0. Interpolated actor
  coordinates are no longer rounded away at draw time, while lane easing and
  direction hysteresis are elapsed-time based across 60–144Hz displays.
- Citizen and founder paths consume a waypoint on the tick that reaches it,
  eliminating the old 0.15-tile corner shortcut and blank movement beat.
  Runtime capture no longer performs a full-DPR canvas copy plus synchronous
  PNG encoding every 750ms; it captures once at startup and thereafter only
  through the explicit `captureRealmFrame()` inspection hook.
- The editable ambient roster is now seven `48x48` sources and compiles into a
  `336x48` atlas. Client imports were revised to `realm=158`.

Validation run:

```sh
node scripts/verify-sprite-source-contract.mjs
node scripts/audit-sprite-registration.mjs
REALM_PORT=4732 node scripts/verify-logic.mjs
REALM_PORT=4733 node scripts/verify-anim.mjs
```

## Runtime actor continuity and motion stabilization — 2026-07-09

- A citizen now retains `visualJob` through short-lived route retries,
  delivery legs, and food-crisis reallocations. The renderer uses that stable
  profession when there is no active `jobBuilding`, so a miner no longer
  flashes into the generic settler sprite between real assignments. A newly
  selected job updates the appearance immediately; an explicitly unassigned
  citizen returns to the settler appearance.
- Work-state scheduling no longer detours through `find_job`/idle whenever a
  production check has no cargo. Workers remain in the active work loop, and
  their final approach direction is locked for the whole tool beat. This
  prevents frozen work frames and row changes mid-swing.
- Road lane offsets now apply to the interpolated actor position rather than
  overwriting it with the simulation position. Blocked paths also stop using
  the walk cycle after the short startup grace instead of treading in place.
  Together these remove the most visible motion shiver without touching
  accepted sprite art or introducing any runtime frame scaling.
- `scripts/verify-logic.mjs` now covers miner identity across a delivery gap,
  continuous work state, locked work facing, and builder art at unfinished
  sites. Client module imports were revised to `realm=157` so a local tab
  loads the corrected runtime rather than its prior module graph.

Validation run:

```sh
node scripts/verify-sprite-source-contract.mjs
node scripts/audit-sprite-frames.mjs
node scripts/audit-walk-gait.mjs
REALM_PORT=4742 node scripts/verify-logic.mjs
REALM_PORT=4743 node scripts/verify-anim.mjs
REALM_PORT=4744 node scripts/verify-all-sprite-maps.mjs
REALM_PORT=4745 node scripts/verify.mjs --game
```

## Directional work-row stabilization — 2026-07-09

- Rebuilt every previously waived work-direction row as a strict, role-local
  animation family: `lumber/work/down|up`, `miner/work/down|left|right`,
  `farmer/work/down|up`, `guard/work/left|right`, and all four
  `blacksmith/work` directions. The cleanest native role pose is now used as
  the fixed body/foot anchor; a compact upper-body work rhythm supplies the
  eight distinct beats. This removes the frame-scale, ground-anchor,
  edge-clipping, fragment, and cross-direction scale waivers without
  reintroducing legacy/vector art or scaling frames at render time.
- Repainted `lumber/walk/up` as a dedicated eight-frame rear walk cycle. It
  keeps a 79px painted body, a fixed ground anchor, one consistent axe side,
  zero loose fragments, and eight unique frames. The conservative rear-view
  gait heuristic still flags this row for follow-up because the axe and
  overlapping boots obscure its foot-balance signal; it remains a review cue,
  not a sprite-contract failure.
- The blacksmith set was promoted as one four-direction family so its front
  view no longer carries an anvil-sized body mismatch relative to the other
  three directions. Miner and guard side directions are mirrored only after
  their reviewed left rows pass, preserving exact timing, palette, and anchor
  symmetry.
- The complete **187-row** accepted override manifest now has **zero**
  `accepted-with-waiver` rows. A fresh compiled-atlas audit leaves ordinary
  side-walk stride breadth as the highest remaining metric; it is stable,
  gait-tested motion rather than body jitter, clipping, fragments, or a style
  era fault.

Validation run:

```sh
scripts/sprite-row verify
node scripts/build-motion-atlases.mjs
node scripts/audit-sprite-registration.mjs --write
node scripts/verify-sprite-source-contract.mjs
node scripts/audit-sprite-frames.mjs
node scripts/audit-walk-gait.mjs
node scripts/verify-all-sprite-maps.mjs
```

## Release polish pass — 2026-07-09

- Repainted `miner/work/left` with a dedicated eight-frame painted pick
  cycle, palette-harmonized it toward the miner walk family, then mirrored the
  reviewed row to `miner/work/right`. Both rows now have a stable 72px
  effective body height, 1px ground-anchor range, zero loose fragments, and
  no legacy/vector fallback in the live atlas. The
  reviewer kept a named `body-width-drift` waiver: the compact crouch and
  overhead-pick silhouettes still vary in width, but this is visibly a pose
  difference rather than a scale pop. The audit score fell from `136.6` to
  `70.3` for each side row; `lumber/work/up` is now the top repaint target.
- Rebuilt `actors-compiled/miner.png` and `actors-atlas.png`, then regenerated
  actor registration after the repaint. Registration uses stable feet-anchor
  corrections and never whole-frame scale normalization.
  The registration gate reports no rows above feet/centroid tolerance, and
  animation/browser checks pass.
- Removed the unreachable procedural citizen and soldier renderers plus the
  service-walker fallback from `render.js`. Canonical painted PNG atlases are
  now the sole near-camera human actor path; the renderer leaves a shadow
  while an atlas decodes instead of briefly showing the retired canvas/SVG-era
  look. Idle social facing now uses a spatial hash instead of per-citizen
  full-population scans.
- Citizen routes now blacklist unreachable jobs and delivery sites for a
  bounded period, release bad job assignments, retry alternate real storage,
  and reacquire a changed resource work tile before continuing to work. The
  logic suite adds a moat-island regression for both job and delivery recovery.

Validation run:

```sh
scripts/sprite-row verify
node scripts/build-motion-atlases.mjs
node scripts/verify-sprite-source-contract.mjs
node scripts/audit-sprite-registration.mjs --write
node scripts/audit-sprite-frames.mjs
REALM_PORT=4714 node scripts/verify-anim.mjs
REALM_PORT=4713 node scripts/verify-logic.mjs
```

## Baseline

Current baseline: `rounds/112-round-player-cleanup.md`

The live game still uses painted PNG atlases in the canonical 2D canvas
renderer. Actor and ambient source files remain the editable source of truth:
actor sheets live one role at a time in `assets/sprites/actors/`, ambient props
live one prop at a time in `assets/sprites/ambient/`, and the runtime
`actors-atlas.png` / `ambient-atlas.png` files are compiled artifacts.

Round 078 proved a narrow imagegen-assisted actor source workflow. It generated
candidate frames for one row, selected the best left-facing lumber work/chop
cycle, chroma-keyed and packed it into exact `64x84` cells, inserted it into
`assets/sprites/actors/lumber.png` at `work / left`, rebuilt the runtime atlas,
and verified through the static proof plus browser-backed checks. Visible
preview passes then normalized the work row, added proper walking-only lumber
rows for `down`, `up`, `left`, and `right`, and fixed a `walk/down` handedness
bug where the axe changed sides in frames 6 and 7. The lumber `carry` rows were
then filled from the completed walk rows after live play showed returning
workers as floating wood because the carry rows were blank. The true existing
`lumber/work/left` row was transparent, so this round filled a missing
direction/action row rather than repainting populated frames.

Round 079 closed the immediate live-play issues around that work. The remaining
lumber `work` rows are now non-empty so the worker no longer flashes during
direction changes, lumber citizens choose reachable nearby forest tiles as
their work target instead of standing in the mill, and delivered materials now
prefer a real `Storehouse` building. The Storehouse is unlocked with
Agriculture, appears under Infrastructure, and currently reuses granary art as a
temporary visual stand-in.

Round 080 broadened polish across the actor and movement loop. All actor
role/action/direction rows are now populated after filling the remaining lumber
`idle` rows. Runtime actor playback is slower and calmer, with lower bobbing and
discrete per-citizen frame offsets. Citizen pathing now compresses straight
segments, remembers last-facing direction, uses gentler separation, sends
resource workers to stable exterior/resource work sites, and keeps idle citizens
loitering near settlement anchors instead of repeatedly choosing map-center
wander paths.

Round 081 improved carriers and delivery truthfulness. Carried resources now use
a material-specific overlay for all actor roles: wood is a strapped log bundle,
stone/iron are compact block loads, and food/gold are small pouch loads.
Carrying citizens hold a stable frame while paused. Delivery no longer falls
back to any building; if no valid storage/home/economy drop-off exists, the
carrier keeps the load, enters `needs_delivery`, and prompts `Need storage`
until a valid target is built.

Round 082 incorporated the one-character-type-per-sheet constraint for
imagegen work. Actor source sheets remain per role under
`assets/sprites/actors/<role>.png`, and generated/proof rows should target one
role sheet at a time rather than mixing actor types. The pass inserted an
imagegen pickaxe swing into `miner.png` at `work / left` and mirrored it into
`work / right`, leaving other role sheets untouched.

Round 083 finished the miner `work` action directions using that same per-role
sheet workflow. Imagegen candidates were generated only for miner `work/down`
and `work/up`, packed into exact `64x84` rows, inserted into
`assets/sprites/actors/miner.png`, and rebuilt into the runtime actor atlas.
The already-improved miner `work/left` and `work/right` rows were preserved.

Round 084 returned to the lumber sheet and replaced `lumber/work/down` and
`lumber/work/up` with true chopping strips. The pass used lumber-only imagegen
candidates on a removable magenta key, packed them into exact `64x84` rows,
inserted them into `assets/sprites/actors/lumber.png`, and rebuilt the runtime
actor atlas. The existing improved `lumber/work/left` and `lumber/work/right`
rows were preserved.

Round 085 replaced the farmer `work` block with compact, role-specific
hoeing/tilling rows. The first generated set was rejected because overhead tool
poses made the actor shrink in some frames. A second compact set was packed into
exact `64x84` rows, inserted into `assets/sprites/actors/farmer.png`, and
rebuilt into the runtime actor atlas. The final `work/right` row mirrors the
cleaner generated left row to avoid cell-edge clipping.

Round 086 cleaned up farmer `carry` rows after confirming the renderer paints
carried resources separately through `drawCarryLoad(...)`. The old farmer carry
rows had baked-in generic sack shapes, which could visually compete with the
runtime load overlay. A farmer-only imagegen carry attempt misfired into
unrelated non-sprite imagery and was rejected. The accepted pass replaced the
four farmer carry rows with no-prop farmer walking base rows, preserving smooth
movement while making the overlay the single visible carried object.

Round 087 corrected the visible style regression from round 086. The no-prop
walking base rows were clean but still came from the older hooded derived actor
style, so the live farmer carry animation looked out of step with the newer
round 085 painted farmer work rows. Additional imagegen attempts for clean
farmer carry art misfired into unrelated non-sprite imagery and were rejected.
The accepted checkpoint replaces farmer carry with a newer painted farmer block
derived from the accepted work art, rebuilds the atlas, and documents the
rejected hybrid and hard-mask cleanup proofs. This is a better style match but
still has some tool remnants; a true no-prop painted carry strip remains a
future target.

Round 088 added a quantitative sprite audit before doing more art replacement.
`scripts/audit-sprite-frames.mjs` now scores every actor row for blank frames,
center jumps, width/height jumps, alpha fragments, and edge-touching pixels,
then writes `scripts/screenshots/sprite-audit-worst-rows.png`. The audit proved
that the biggest transition artifacts are old SVG-port rows, not the newer
bitmap lumber/miner/farmer strips. The pass generated and packed a true
bitmap-painted guard side-walk strip, inserted it into `guard/walk/left`, and
mirrored it into `guard/walk/right`. After replacement, both side-walk rows
score `0.0` in the audit, while guard `work` and `carry` remain intentionally
unfixed old-port rows for future dedicated bitmap passes.

Round 089 continued the guard replacement with a dedicated bitmap `work/left`
strip. A new `scripts/pack-generated-sprite-strip.py` helper now segments
generated chroma-key strips, removes/despills the key, deletes tiny alpha
fragments, applies a shared scale, and packs exact `64x84` cells. The accepted
guard work strip is a planted spear-ready/thrust/recover motion, not a reused
walk cycle. It was inserted into `guard/work/left` and mirrored into
`guard/work/right`. The side work rows dropped from the old-port audit score
of `126.9` to `70.0`; the remaining score is mostly expected spear-extension
width change.

Round 090 finished the remaining guard `work` cardinal directions. Separate
imagegen candidates were generated for `guard/work/down` and `guard/work/up`,
packed with the chroma-key strip helper, proofed at x4 scale, inserted into
`assets/sprites/actors/guard.png`, and rebuilt into the runtime atlas.
`guard/work/down` dropped from `126.1` to `23.0`; `guard/work/up` is now
`47.0`; both have `0/0` alpha fragments in the audit. The full guard `work`
action now uses bitmap-painted rows across all directions.

Round 091 replaced the guard `carry` block with clean bitmap no-load actor base
rows. This keeps the actor sheet free of baked logs, sacks, crates, stones, or
weapons while `drawCarryLoad(...)` remains responsible for visible carried
materials at runtime. The old-port guard carry rows scored between `46.9` and
`127.0`; after replacement, `guard/carry/down`, `up`, `left`, and `right` all
score `0.0` with `0/0` alpha fragments and no longer appear in the global
worst-row audit sheet.

Round 092 replaced the full blacksmith `walk` action block with bitmap-painted
rows. A partial three-direction candidate was rejected after the proof showed
that leaving old `walk/up` in place would make the action block inconsistent.
The accepted pass generated blacksmith-only `walk/down`, `walk/up`, and
`walk/left`, mirrored `walk/right`, packed each row through the chroma-key
strip helper, inserted the four-row block into `blacksmith.png`, and rebuilt the
runtime atlas. Blacksmith walk rows dropped from `141.5`, `70.6`, `137.9`, and
`69.4` to `0.0` in all four directions with `0/0` fragments.

Round 093 paired animation polish with a runtime performance fix. The live loop
now throttles minimap redraws, suspends post-processing when measured rAF
cadence degrades, avoids rendering/postfx/minimap work in hidden tabs, and skips
close-up terrain micro-geometry at normal gameplay zoom. A 1280x720 fresh-game
probe improved from roughly `8 FPS` before this performance pass to roughly
`32 FPS` after it. The same round replaced the builder `walk` block with
bitmap-painted rows in all four directions. Builder walk scores are now `0.0`
with `0/0` fragments for down, up, left, and right.

Round 094 added a dedicated gait audit after live inspection showed that some
front/back walk cycles can pass the normal continuity audit while still reading
as one-footed. `scripts/audit-walk-gait.mjs` now writes
`scripts/screenshots/walk-gait-audit-report.json` and
`scripts/screenshots/walk-gait-audit-worst-rows.png`, scoring walk rows for
left/right foot alternation. The audit focuses on the central lower boot band
for front/back rows so tools such as the lumber axe are not counted as feet.
`lumber/walk/down` was corrected with a boot-only alternating pass and no
longer appears in the highest gait failures. `builder/walk/up` and
`blacksmith/walk/up` remain the clearest bitmap gait repaint targets; quick
overlay attempts were rejected because they made the lower body muddy or too
repetitive.

Round 095 turned the one-file-per-sprite-type workflow into an enforceable
contract. `js/sprite-source-contract.js` now defines the canonical actor
roles, ambient props, frame geometry, and compiled atlas dimensions.
`scripts/verify-sprite-source-contract.mjs` fails when actor/ambient source
folders are missing declared files, contain unexpected extra PNGs, include
retired combined-source filenames, or have wrong dimensions. The atlas compiler
imports the same contract and refuses to build unless the actor sources are one
role per file under `assets/sprites/actors/` and ambient sources are one prop
per file under `assets/sprites/ambient/`. `actors-atlas.png` and
`ambient-atlas.png` remain generated runtime artifacts only.

Round 096 tightened the carry/delivery work and removed the clearest newer
bitmap gait offender. The runtime wood carry overlay now reads as a larger
strapped three-log bundle attached to the worker body, with visible straps, log
ends, end shading, and tie bands. `scripts/verify-logic.mjs` now includes a
regression proving that produced wood with no storage/home stays carried in
`needs_delivery` instead of being counted as delivered. The same round corrected
`builder/walk/up` with a lower-leg-only cadence pass, dropping its gait score
from `131.2` to `30.2`.

Round 097 corrected `blacksmith/walk/up`, the next clearest newer-bitmap
front/back gait issue. The accepted edit changes only lower-foot cadence pixels
inside `assets/sprites/actors/blacksmith.png`; body scale, head, apron, arms,
and silhouette remain intact. `blacksmith/walk/up` gait dropped from `79.7` to
`31.4` and no longer appears in the top gait-audit failures. Candidate variants
that scored well but visibly added oversized foot marks were rejected.

Round 098 used the imagegen workflow for a full row replacement instead of
another mechanical gait patch. `farmer/walk/up` was inspected first and rejected
as a shortcut target because both a carry-row substitution and a lower-band
mirror made the row worse. The accepted work replaced `builder/work/left` with
an imagegen-assisted hammering/construction strip, packed it into exact `64x84`
cells, and mirrored it into `builder/work/right`. Builder side work dropped from
the old-port `builder/work/left` score of `135.2` to `9.0` on both side rows
with `0/0` fragments.

Round 099 continued the same imagegen-assisted builder work replacement with
`builder/work/down`. A front-facing hammering strip was generated on chroma key,
packed into exact `64x84` cells, inserted into the per-role builder sheet, and
rebuilt into the runtime atlas. `builder/work/down` dropped from `134.0` to
`12.0` with `0/0` fragments, leaving `builder/work/up` and builder carry rows
as the main remaining builder old-port targets.

Round 100 finished the builder `work` action by replacing `builder/work/up`
with a back-facing imagegen-assisted hammering strip. It was generated on chroma
key, packed into exact `64x84` cells, inserted into the per-role builder sheet,
and rebuilt into the runtime atlas. `builder/work/up` dropped from `69.0` to
`17.0` with `0/0` fragments. Builder `work/down`, `work/up`, `work/left`, and
`work/right` now form a coherent role-specific construction animation block.

Round 101 removed the remaining old-port builder action block. Because carried
materials are rendered at runtime through `drawCarryLoad(...)`, the builder
`carry` rows were replaced with the clean bitmap builder walk base instead of
baking crates, logs, or sacks into the actor sheet. `builder/carry/down`, `up`,
`left`, and `right` now all score `0.0` with `0/0` fragments, and the rebuilt
atlas keeps the full builder walk/work/carry set in the newer painted style.

Round 108 used the new Sprite Lab + sprite-repair workflow on the visible
`miner/work/right` issue. The pass stabilized the dense actor body in both
`miner/work/left` and `miner/work/right` without scaling whole frames, rebuilt
the motion atlases, and fixed Sprite Lab cache busting so refreshed source PNGs
are visible after atlas/source rebuilds. Both side rows now show `70-78px`
height range and `8px` height delta in Sprite Lab, down from the previous
`61-78px` range and `17px` delta. Tool reach still produces size/center/edge
warnings, so those rows can receive a true repaint later, but the obvious
body-shrink acceptance failure is cleared.

Round 109 made row-level review and promotion the durable actor production
path. Canonical overrides now live under `assets/sprites/actor-rows/`, accepted
rows are SHA-256 locked in the manifest, generated role sheets live under
`assets/sprites/actors-compiled/`, and the compiler applies override rows with
copy semantics so transparency erases legacy art. `miner/work/up` is the first
clean LOCKED migration: provenance
`imagegen-direction-locked-peer-scale`, flicker `27.8`, dense-body height range
`1px`, cross-direction body-height delta `0.5px`, and no quality warnings.
Sprite Lab now measures the dense body instead of the full pickaxe silhouette,
loads standalone CANDIDATE strips from row zero, and keeps the active row
visible without rebuilding the asset list on every animation frame. Browser
checks confirmed LOCKED/WAIVED/BASE provenance and responsive layouts at
1280x720, 1024x768, and 390x844.

Round 110 connected the full actor atlas to an exhaustive live-canvas proof.
The renderer now imports the canonical sprite-source contract instead of
maintaining duplicate role/action/direction constants, and all citizen drawing
goes through one shared `drawActorAtlasFrame(...)` path. Actor Muster is
available from the title screen, Sprite Lab, and `?spritemuster=1`; it renders
all 224 role/action/direction maps on the actual game canvas with animated
frames and BASE/LOCKED/WAIVED provenance. The live mapping gap for foragers was
also fixed, so citizens in the `foraging` state now use the dedicated forager
sheet rather than silently falling back to settler art.

`scripts/verify-all-sprite-maps.mjs` now checks the complete runtime atlas:
224/224 rows, 1,792/1,792 frames, zero blank frames, zero low-variety moving
rows, zero address mismatches, zero role/action/direction mapping failures,
224/224 rows drawn through Actor Muster, and zero page errors. Desktop proofs
live at `scripts/screenshots/actor-muster-01.png` and
`actor-muster-02.png`; the machine-readable report is
`scripts/screenshots/all-sprite-maps-report.json`.

Round 111 began the player-facing legacy-art migration with the opening
settler family instead of declaring the tooling itself complete. All four
`settler/idle` and all four `settler/walk` rows are now LOCKED frontier
villager art with one identity, costume, satchel side, palette, and `71-72px`
dense-body scale. Idle rows were explicitly normalized against walk before
acceptance so stopping does not produce a body-size pop. The front/back walk
rows received a second gait pass; the gait audit now measures perspective
depth for front/back movement, and both final rows score `8.0` instead of the
old front row's `77.0`.

Live verification exposed and fixed a stale-atlas risk: the actor atlas now
inherits the renderer/page revision, so a rebuilt atlas cannot appear
unchanged during review because the browser reused an earlier PNG. A
query-gated `?runtimecapture=1` hook publishes the exact composed game canvas
for in-app inspection without changing normal gameplay. The opening game now
shows three detailed frontier settlers rather than the round-headed blue
legacy figures. Evidence:
`scripts/screenshots/runtime-settler-opening-round-111.png`,
`scripts/screenshots/anim-live-actors.png`, and
`scripts/screenshots/anim-live-actors-close.png`.

Round 112 continued the cleanup from the user's "weird round players" report
instead of only chasing the highest numeric motion scores. The broad legacy
actor painter now targets 39 old round or hooded role/action blocks across 13
source sheets, including idle rows for builder, blacksmith, guard, farmer,
miner, rancher, fisher, trader, innkeeper, scholar, stonecutter, and forager.
Those BASE rows now use slimmer tapered bodies, smaller heads, belts, boots,
and role-specific headgear/props rather than circular placeholder silhouettes.

The remaining settler action pop was fixed more strictly through row overrides:
`scripts/refit-settler-frontier-rows.mjs` derives `settler/work/*` and
`settler/carry/*` from the locked frontier settler idle/walk strips, adds small
cargo bundles to carry rows, and accepts all eight rows with no warning waivers.
The settler family is now fully locked across idle, walk, work, and carry, and
Actor Muster shows 17 locked settler/worker rows plus 4 existing waivers and
203 BASE rows. Full runtime verification still reports `224/224` rows,
`1,792/1,792` frames, no blanks, no low-variety rows, no mapping failures, and
row digest `34a267348715`.

Round 102 resumed imagegen-assisted row replacement on the next old-port work
family. A blacksmith-only side-facing hammer/anvil strip was generated on
chroma key, packed into exact `64x84` cells, inserted into
`blacksmith/work/left`, and mirrored into `blacksmith/work/right`.
`blacksmith/work/left` dropped from `127.2` to `29.0`, and both side rows now
have `0/0` fragments. `blacksmith/work/down` and `blacksmith/work/up` remain
old-port front/back rows for their own dedicated passes.

Round 103 responded to live preview findings on the paused Year 13 save.
Citizens standing on non-road building tiles are now evacuated toward the
nearest walkable tile and skipped visually while invalid, preventing actors from
appearing on top of roofs in loaded/paused states. Persistent death markers no
longer render when their rounded tile is occupied by a live building, which
keeps old gravestones off huts. The same pass replaced old-port
`blacksmith/carry` rows with the clean blacksmith walk base; all four carry
directions now score `0.0` with `0/0` fragments.

Round 104 replaced `blacksmith/work/down` with a front-facing imagegen-assisted
hammer/anvil loop. The accepted strip was generated on chroma key, packed into
exact `64x84` cells, inserted into the per-role blacksmith sheet, and rebuilt
into the runtime atlas. `blacksmith/work/down` dropped from `125.9` to `22.0`
with `0/0` fragments. `blacksmith/work/up` remains the last old-port
blacksmith work row.

Round 105 finished the blacksmith `work` action by replacing
`blacksmith/work/up` with a back-facing imagegen-assisted hammer/anvil loop.
The accepted strip was packed into exact `64x84` cells, inserted into the
per-role blacksmith sheet, and rebuilt into the runtime atlas.
`blacksmith/work/up` dropped from `70.1` to `37.0` with `0/0` fragments.
Blacksmith `walk`, `work`, and `carry` now all use the newer painted blacksmith
style and no blacksmith rows remain in the top continuity audit list.

Round 106 switched from one-row repainting to a broad artifact audit pass.
`scripts/paint-cohesive-legacy-actors.mjs` now regenerates cohesive raster base
rows for legacy old-port role/action blocks with detached hands, feet, hair
plumes, and loose props while preserving newer imagegen-style lumber, miner,
builder, blacksmith, farmer work, and guard work/carry rows. The pass refreshed
28 role/action blocks across 11 per-role actor sheets, then tuned front/back
footfall and side stride so the clean base rows no longer read as one-foot
shuffles. `scripts/scrub-work-row-particles.mjs` was added but narrowed to the
accepted lumber work cleanup only after a miner/farmer scrub proof worsened
miner side-work audit scores. The old separated-limb rows dropped out of the
top continuity audit; the remaining worst rows are now deliberate tool/work
animations such as lumber chopping, miner pick swings, guard spear work, and
farmer hoeing.

Round 107 added the missing human review surface for sprite iteration. It
originally included a cache-busting compatibility query alongside
`?spritelab=1`; realm 162 retired that parser, leaving explicit
`spritelab`/`role`/`action`/`dir` parameters as the only deep-link contract.
Sprite Lab imports the canonical sprite-source contract, previews exact actor
rows, animates and scrubs frames, shows grid/onion/alpha overlays, reports
row/frame diagnostics, and stores row/frame review marks in localStorage with
Copy Report and Export JSON actions. Ambient prop source PNGs can be reviewed
and marked in the same queue. This should be the first stop before more row
repainting so visual judgment, audit scores, and next-pass instructions stay
aligned.

## Invariants

- Keep the loop scoped to graphics/rendering/assets.
- Preserve user changes and do not revert unrelated edits.
- Do not reintroduce live `.svg` art paths.
- Do not restore procedural building fallbacks as the live path.
- Do not add a second live renderer; polish the canonical 2D path.
- Actor and ambient source PNGs are the editable source of truth.
- Review actor changes one `512x84` action/direction row at a time.
- Canonical accepted row overrides live under `assets/sprites/actor-rows/` and
  must match their manifest SHA-256.
- `BASE` rows are inherited and unreviewed; `CANDIDATE` rows never enter
  runtime output; `LOCKED` rows are warning-free overrides protected by their
  manifest SHA-256. There is no waiver-capable status.
- Rows with analyzer warnings must remain candidates and be repaired before
  promotion. Do not add a bypass flag, warning allowlist, or compatibility
  status to the compiler, workbench, or audits.
- Do not edit generated `actors-compiled/*.png` role sheets directly.
- `actors-atlas.png` and `ambient-atlas.png` are compiled runtime artifacts.
- Motion sprite source files must stay split by sprite type: one actor role per
  PNG and one ambient prop per PNG. Do not generate or edit a single mixed
  actor source atlas.
- Run `scripts/verify-sprite-source-contract.mjs` before and after motion
  sprite work.
- Do not revive the old layered `ROLE_WORKPOSE_*` motion stack.
- Do not turn `scripts/build-motion-atlases.mjs` back into a procedural actor
  painter.
- `scripts/bootstrap-sprite-sources.mjs` is reset-only; re-running it
  overwrites editable actor/ambient source PNGs.
- Verify with screenshots when the round affects how the game looks.
- For front/back walk rows, check gait alternation with
  `scripts/audit-walk-gait.mjs`; a clean continuity score alone is not enough.
- For generated work/carry rows, actor body height and scale must stay stable
  across the row. Tools may extend through the cell, but the NPC should not
  shrink or grow to make room for the prop. Treat large Sprite Lab height
  deltas or visible body-scale drift as a rejection.
- Generated rows also require cross-direction body-scale/palette checks,
  Sprite Lab inspection, and runtime verification before acceptance.
- The live renderer must import role/action/direction/frame geometry from
  `js/sprite-source-contract.js`; do not add a second hand-maintained
  actor-atlas map.
- New actor roles are not integrated until both normal citizen resolution and
  Actor Muster coverage are verified.

## Last Known Verification

- Runtime and browser modules are on canonical revision `realm=163`.
- `scripts/sprite-row verify` passed with `187` warning-free accepted row
  overrides. The remaining `37` runtime rows inherit `BASE` role-sheet art;
  the manifest contains no candidate or waiver-capable status and no warning
  allowlist fields.
- `node scripts/build-motion-atlases.mjs` rebuilt the per-role sheets and actor
  atlas from the strict current source contract.
- `node scripts/verify-sprite-source-contract.mjs` passed: `14` base plus
  compiled role sheets have the expected `512x1344` dimensions, all `187`
  locked row hashes match, all `7` ambient sources are `48x48`, and the
  compiled atlases have their declared dimensions.
- `node scripts/audit-sprite-frames.mjs` passed without an escape flag. Every
  compiled row is in the painted era and remains within the current
  cross-action body-scale tolerance.
- Registration, walk-gait, animation, all-sprite-map, game, and logic gates
  passed. The exhaustive runtime map still covers `224/224` rows and
  `1,792/1,792` frames with no blanks, low-variety moving rows, atlas-address
  mismatches, live mapping failures, or Actor Muster omissions.
- Browser verification uses
  `index.html?spritelab=1&role=<role>&action=<action>&dir=<dir>` and
  `index.html?spritemuster=1`. The retired compatibility deep link is not part
  of the current review contract.
- These gates do not certify semantic identity across actions. A row can be
  mechanically clean while depicting the wrong costume or weapon; compare
  every promotion against the role's adjacent LOCKED actions in Sprite Lab
  and on the live canvas.

## Historical Verification Archive (pre-realm162)

- `node scripts/build-motion-atlases.mjs` passed and regenerated:
  - `assets/sprites/actors-atlas.png`
  - `assets/sprites/ambient-atlas.png`
  - `scripts/screenshots/actors-source-sheets-round-078.png`
- `node --check js/citizens.js js/render.js` passed.
- `scripts/verify-logic.mjs` includes a direct delivery regression proving
  produced wood with no storage/home stays carried in `needs_delivery`, emits
  `Need storage`, does not emit `Delivered!`, and does not add wood to
  resources.
- ImageMagick dimension audit passed:
  - `assets/sprites/actors/builder.png`: `512x1344`
  - `assets/sprites/actors-atlas.png`: `512x18816`
  - `assets/sprites/ambient-atlas.png`: `192x48`
  - all actor role/action/direction rows are populated.
- `node scripts/verify-anim.mjs` passed, refreshed
  `scripts/screenshots/anim-live-actors.png` and
  `scripts/screenshots/anim-live-actors-close.png`, and reported no page
  errors. The round 091 pass specifically exercised `guard carry left`.
- `node scripts/verify-critic.mjs` passed and refreshed critic screenshots with
  no page errors.
- `node scripts/verify.mjs --game --logic` passed; console output contained
  only repeated GPU `ReadPixels` performance warnings.
- `node --check js/sprite-lab.js` and `node --check js/main.js` passed after
  adding the Sprite Lab module.
- A headless browser probe opened
  `index.html?spritelab=1&role=miner&action=work&dir=left`, verified the lab
  opened, rendered the actor row preview/strip/metrics, saved a test review
  mark, switched to ambient props, confirmed actor-only controls hide in
  ambient mode, and reported no page errors.
- `node scripts/verify.mjs --game --logic` passed after the Sprite Lab import,
  with only the existing GPU `ReadPixels` warnings.
- `scripts/sprite-row verify` passed with three protected miner overrides:
  clean LOCKED `work/up` plus WAIVED `work/left` and `work/right`.
- The rebuilt `miner/work/up` row is byte-for-byte visible through the runtime
  path: ImageMagick reported `0` differing pixels between the canonical
  override, compiled miner row at `y=756`, and actor-atlas row at `y=6132`.
- Sprite Lab at
  `index.html?spritelab=1&role=miner&action=work&dir=up` showed LOCKED,
  provenance `imagegen-direction-locked-peer-scale`, warnings `none`,
  body height `72-73`, and body delta `1`. No diagnostic tile was marked as a
  warning.
- Sprite Lab showed `miner/work/left` and `miner/work/right` as WAIVED and
  inherited `miner/work/down` as BASE.
- Responsive browser checks at `1280x720`, `1024x768`, and `390x844` found no
  document or workspace horizontal overflow. The mobile active row remained
  visible after the list-centering fix.
- `node --check js/render.js js/ui.js js/main.js js/input.js
  js/sprite-lab.js scripts/verify.mjs scripts/verify-critic.mjs
  scripts/verify-anim.mjs` passed.
- `node scripts/build-motion-atlases.mjs`,
  `node scripts/verify-sprite-source-contract.mjs`,
  `node scripts/audit-sprite-frames.mjs`, and
  `node scripts/audit-walk-gait.mjs` passed after the row migration.
- `node scripts/verify-anim.mjs` passed with no page errors and refreshed the
  live actor screenshots.
- `node scripts/verify-critic.mjs` passed with no page errors and refreshed
  dawn, midday, dusk, night, zoom, wall, construction, and winter screenshots.
- `node scripts/verify.mjs --game --logic` passed with no page errors; console
  output contained only the existing GPU `ReadPixels` performance warnings.
- `node scripts/verify-all-sprite-maps.mjs` passed:
  - `224/224` runtime rows inspected.
  - `1,792/1,792` frames inspected.
  - `0` blank rows or frames.
  - `0` moving rows with fewer than two unique frames.
  - `0` atlas-address mismatches.
  - `0` live role/action/direction mapping failures.
  - `224/224` rows drawn on the real game canvas across two desktop muster
    pages.
  - `0` page errors.
- Actor Muster responsive checks passed at `1440x960` and `390x844`. Mobile
  uses sixteen smaller role/action musters, keeps all four directions visible,
  and has no horizontal page or toolbar overflow.
- Title-screen access, Actor Muster navigation, and the handoff from a live
  muster row into its Sprite Lab deep link were browser-verified.
- Dedicated `forager` art is now selected for citizens whose live state is
  `foraging`.
- `node scripts/audit-sprite-frames.mjs` passed and refreshed
  `scripts/screenshots/sprite-audit-worst-rows.png`; the old separated-limb
  legacy walk/work/carry rows no longer dominate the top audit sheet.
- `guard/work/left` and `guard/work/right` now score `70.0`, down from the
  previous old-port `126.9`.
- `guard/work/down` now scores `23.0`, `guard/work/up` scores `47.0`, and the
  guard `work` action is bitmap-painted in all four directions.
- `guard/carry/down`, `guard/carry/up`, `guard/carry/left`, and
  `guard/carry/right` now score `0.0` with `0/0` fragments.
- `blacksmith/walk/down`, `blacksmith/walk/up`, `blacksmith/walk/left`, and
  `blacksmith/walk/right` now score `0.0` with `0/0` fragments.
- `builder/walk/down`, `builder/walk/up`, `builder/walk/left`, and
  `builder/walk/right` now score `0.0` with `0/0` fragments.
- Fresh-game 1280x720 rAF performance probe now reports about `32 FPS`, up from
  about `8 FPS` before the round 093 loop and terrain changes.
- `node scripts/audit-walk-gait.mjs` passed and refreshed
  `scripts/screenshots/walk-gait-audit-worst-rows.png`; `lumber/walk/down`
  dropped out of the highest gait failures after the boot-only correction.
- `node scripts/verify-sprite-source-contract.mjs` passed before and after
  `node scripts/build-motion-atlases.mjs`, confirming the actor and ambient
  source folders contain only declared per-type PNGs and the compiled atlases
  have expected dimensions.
- `builder/walk/up` gait now scores `30.2`, down from `131.2`, after the
  lower-leg cadence correction.
- `blacksmith/walk/up` gait now scores `31.4`, down from `79.7`, after the
  lower-foot cadence correction.
- `builder/work/left` and `builder/work/right` now score `9.0` with `0/0`
  fragments after the imagegen-assisted construction row replacement.
- `builder/work/down` now scores `12.0` with `0/0` fragments after the
  front-facing imagegen-assisted construction row replacement.
- `builder/work/up` now scores `17.0` with `0/0` fragments after the
  back-facing imagegen-assisted construction row replacement.
- Round 106 refreshed 28 legacy role/action blocks across 11 actor sheets with
  cohesive raster base rows; the new broad side-walk rows sit around
  `16.6-16.8` in the gait audit after stride tuning.
- `lumber/work/up` now scores `115.4` and `lumber/work/down` now scores `99.7`
  after the accepted particle scrub; the miner/farmer scrub was rejected and
  restored.
- Historical round-100 review used the compatibility deep-link parser that
  realm 162 has since retired. Current reviews use the explicit Sprite Lab
  URL documented above.

## Best Next Target

Execute RFC 0002's A2 interchange/handedness proof. Bake two independent
identities by two independent garment kits from one shared walk clip. Keep
skin/head/body identity, garment, and attachments in separate source parts;
include one-sided pouch/sword sentinels; mirror joint transforms before
semantic recomposition instead of mirroring a finished frame; emit body,
identity, garment, and attachment ID masks; and match an explicit accepted
Realm scale target.

Bake flattened review rows only. Review all four turns at `1x`, measure seams,
occlusion, landmarks, phase, authoring time, and real-renderer `100`/`250`
actor cost. Do not promote the partial guard carry candidates or keep B/C as a
second authoring route.

## Secondary Targets

- Continue true per-role actor source art after the guard → farmer → lumber
  sequence, prioritizing the remaining inherited rows rather than repainting
  already-LOCKED families.
- After one source pipeline wins, extend the complete guard family and then
  convert farmer and lumber identity families before the palette-derived cast.
- Building upgrade states: pre-rendered or atlas-backed visual changes for
  Level 2/3+ instead of only small overlay pennants.
- Construction-phase polish: painterly scaffolds, material piles, and reveal
  masks that match the atlas style.
- Dedicated wall variants: the first wall-continuity pass now uses atlas-backed
  links, but a future art pass can still add true corner/end/T/cross frames
  instead of reusing one wall crop.
- Terrain/building integration: reduce the visible grid feel beneath painted
  buildings and keep grounding shadows tuned after the new contact-shadow pass.
- Title/build-bar crops: confirm all atlas icons frame well at small UI scale,
  especially tall structures and support buildings.

## Handoff Discipline

At the end of the next round, write `rounds/111-<short-name>.md`, update this
file's Best Next Target, and move any completed backlog item to Done.
