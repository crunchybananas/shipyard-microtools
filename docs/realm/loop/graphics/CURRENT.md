# Current Graphics Handoff

## Baseline

Current baseline: `rounds/111-frontier-settler-opening.md`

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
contract. `scripts/sprite-source-contract.mjs` now defines the canonical actor
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

Round 107 added the missing human review surface for sprite iteration. Sprite
Lab is now available from the title screen, HUD, `?spritelab=1`, or
`?rolesheet=...` values that contain a role/action/direction name. It imports
the canonical sprite-source contract, previews exact actor rows, animates and
scrubs frames, shows grid/onion/alpha overlays, reports row/frame diagnostics,
and stores row/frame review marks in localStorage with Copy Report and Export
JSON actions. Ambient prop source PNGs can be reviewed and marked in the same
queue. This should be the first stop before more row repainting so visual
judgment, audit scores, and next-pass instructions stay aligned.

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
- `BASE` rows are inherited and unreviewed; `WAIVED` rows are protected but
  remain repaint debt; `CANDIDATE` rows never enter runtime output.
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
  `scripts/sprite-source-contract.mjs`; do not add a second hand-maintained
  actor-atlas map.
- New actor roles are not integrated until both normal citizen resolution and
  Actor Muster coverage are verified.

## Last Known Verification

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
- Manual live preview target:
  `http://127.0.0.1:4711/index.html?rolesheet=round100-builder-work-up` or any fresh
  cache-busted query.

## Best Next Target

Use the row factory for a true repaint of `miner/work/left`. It is currently
WAIVED for body height/width drift, center jump, and loose fragments, so it is
the clearest protected-but-unfinished row next to the clean `work/up` baseline.
Preserve the miner identity, left-facing read, peer-direction body scale and
palette, and ground anchor while reducing pickaxe fragments and body motion.
Do not mirror or accept a right-facing row automatically; review that direction
as its own row after the left baseline is clean.

## Secondary Targets

- Continue true per-role actor source art: replace or repaint
  `farmer.png`, `lumber.png`, `miner.png`, and `guard.png` directly so roles
  stop deriving from the same knight base.
- Service walker art integration: the live `G.walkers` path still draws small
  procedural walkers in `js/render.js`; consider routing them through the actor
  atlas vocabulary or a dedicated walker strip.
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
