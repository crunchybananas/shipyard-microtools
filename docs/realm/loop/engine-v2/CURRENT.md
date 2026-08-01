# Engine v2 Current State

Date: 2026-07-19

## 2026-08-01 focus overlay

The live module revision is now Realm `185`; the Realm 165 figures below remain
the last formal engine performance and traffic baseline, not the current module
revision. Graphics work from 166–184 did not replace the gameplay kernel or
close the deliberately red crowd/navigation controls. Subsequent movement work
already present in the current tree now makes both strict traffic gates pass on
Realm 185 with zero known fixture defects; reproduce and add a fixture for any
remaining live crowd failure instead of treating the historical red list as
current behavior.

The owner has paused production art and returned focus to gameplay, responsive
UX, movement, and cleanup. Begin with
[`../playability/CURRENT.md`](../playability/CURRENT.md). Keep the live world on
the canonical two-dimensional Canvas2D renderer; the old 3D/diorama path is not
an active engine option.

Active checkpoint: **Phase 1A citizen ownership promoted on realm 165; RFC 0002
sprite work paused at owner review of one Realm-owned carry/right row**

Council conversation history: [`CONVERSATIONS.md`](CONVERSATIONS.md)

## Controlling owner direction

Realm is in development. Engine changes cut directly to the current design and
delete superseded execution paths after their replacement gates pass. Source
control is rollback. The runtime does not carry old save migrations, dual
schemas, adapters, fallback loaders, feature-flagged retired kernels, or data-
preservation promises for superseded development builds.

The browser remains playable at promoted checkpoints, but "playable" does not
mean preserving an obsolete internal contract.

## Realm 165 contract

| Contract field | Current value |
| --- | --- |
| Module revision | `165` |
| Save schema/key | `realm.engine-v2` / `realm-engine-v2-save` |
| Save/simulation version | `4` / `3` |
| Core order | `sha256:14621d8fcd8b94594989a9bc8b98e0e67c7f654687e80cdab8cafd940c19c014` |

`runtime-contract.json` is the only source for those values. Its system-order
identifier is the content address of the executable order. The module-graph
gate reaches all `51/51` runtime files through 207 internal edges, registers 147
browser-evaluated and 81 Node roots, and requires no alternate-identity
allowlist. Missing, stale, duplicate, extra-query, fragment, non-literal, and
queryless local runtime identities fail closed.

## Phase 0B foundation evidence

- Determinism executes the real graph to tick `43,200`, day `13`, with nine
  buildings and 13 accepted commands. Exact midpoint/final/replay hashes,
  independent seed and command sensitivity, story cadence, shared `G` identity,
  and hostile presentation controls pass.
- Core FX suppression and perturbation observe 3,410 presentation descriptors
  without changing authoritative state or gameplay RNG. The douse and burnout
  controls remain invariant at ticks 4 and 70.
- The strict Engine v2 save gate proves `72/72` root wrong-kind rejections and
  passes 66 preparation rejections and 14
  malformed public-load rejections. The 72-field authoritative root is fully
  initialized, required, and mechanically paired with a validator registry;
  each actor kind has the same allowed-field/validator coverage assertion. One
  `STATE_OWNERSHIP` declaration drives process-local preservation, presentation
  resets, durable non-authoritative state, replay provenance, and actor render-
  field omission. Candidate preparation is detached; injected commit failure
  restores the exact live world.
- Independent control, checkpoint producer, and resumed consumer converge
  immediately and after `+1`, `+60`, and `+3,600` ticks, through tick `10,800`.
- A real New Game reaches day `201`/tick `720,000`; the current browser capture
  is 176,063 bytes, remains below the 1 MiB comfort limit, uses 3.36% of a
  conservative 5 MiB quota, and survive reload/Continue exactly.
  Welcome/victory UI and paused renders do not mutate authoritative state, RNG,
  tick, save payload, or attack cues.
- Manual demolition, fire, raid combat, and undo now use one authoritative
  building-removal lifecycle. Capacity, defense, grid, worker/home/delivery,
  garrison, walker/caravan/animal/cart/school-child, selection/cache, wonder,
  refund/story, undo, and immediate-save invariants pass.
- Combat, plague, and soldier deaths use a core-owned marker lifecycle that
  atomically retains the newest 40 graves. A valid 41-death realm remains
  serializable after one canonical core tick and round-trips through commit;
  the shell only reads grave history.

These results closed the concrete implementation blockers from the earlier
module/save and building-lifecycle vetoes. Session 004 records independent
Terra and Luna approval to close Phase 0 and begin Phase 1.

Realm163 also applies the owner's clean-cut direction to browser and asset
surfaces. The WebGL1 post-processing backend and retired local service-worker
unregister/reload shim are deleted. Consumers import APIs from their owning
modules instead of compatibility re-exports. Buildings must provide the strict
current shape, and every catalog type must satisfy a complete raster sprite
contract; unknown or incomplete data fails loudly. Sprite rows have no waived
or mixed-era release path, legacy Sprite Lab query alias, or runtime body-scale
correction.

## Phase 0C measured evidence

The immutable v159 pre-change record and separate v160/v161 checkpoints remain
historical evidence. The current deterministic-core baseline is
[`baselines/v163/state.json`](baselines/v163/state.json): tick `7,200`, day `3`,
population `19`, 16 buildings, and 135 role, 125 job, 584 activity, and 58 cargo
transitions. The separate
[`baselines/v163/playable/manifest.json`](baselines/v163/playable/manifest.json)
records the shell-driven town at the same tick/day/population/building count,
with a synchronized HUD, five animals, three birds, a bounded particle queue,
four day-cycle captures, and no page errors.

The opt-in `?npcdebug=1` inspector and `window.realmNpcDebug` expose a read-only,
bounded transition ledger. Its executable fixture records 122 transitions
across profession, assignment, activity, goal, cargo, and presentation role.
Reasons are explicitly labeled `observed-current-kernel`; they are inferred
diagnostics, and the reservation field is intentionally null. This is not the
Phase 1 explicit causal-transition invariant.

[`baselines/traffic-v163.md`](baselines/traffic-v163.md) adds:

- a four-miner legal-worksite control: four paths, zero replans, zero blocked
  ticks, zero profession/visual-job/visual-role churn, all working by tick 286;
- a dynamic-wall defect: one delayed replan after 131 ticks;
- a mixed citizen/soldier/walker/chicken defect: exact overlap, with all four at
  the center for 21 ticks.

[`baselines/performance-v163.md`](baselines/performance-v163.md) records an Apple
M4 Chrome profile: core median `182.5 µs/tick` (p95 `260.0`), steady Canvas
median `36.2 ms` (p95 `48.1`), and 1,153-particle median `39.2 ms` (p95 `43.4`).
The entities/world pass consumes `32.5 ms`, about 90% of the steady median;
terrain/fog is `3.6 ms`. Forced-GC setup/workload costs are `7.9`/`86.2 ms`,
and the retained-heap delta is 2,642,932 bytes. That delta is an investigation
target, not proof of a leak from one run.

## Deliberately red replacement controls

The navigation baseline recorded under v159 reproduces exactly on runtime 163:
weighted A* returns cost `11` instead of the `6.62132034356` oracle route;
head-on and doorway actors cross at `0.02873303825` tiles; and the intersection
admits all four actors for 50 ticks. The realm163 dynamic-obstacle and mixed-
actor fixtures add two more known defects.

Default baseline gates are green because they prove reproducibility. Their
strict correctness modes remain red by design. These failures do not block the
Phase 1 ownership/schema cut, but weighted routing, invalidation, capacity,
right-of-way, and collision correctness must pass before the crowd-safe miner
vertical slice can be promoted.

## Phase 1A ownership promotion

Realm 165 promotes the direct citizen-ownership cut:

- one citizen ownership authority creates monotonic actor IDs and owns separate
  identity, profession, assignment, and activity state;
- command APIs and causal events own all supported transitions, while staffing
  is derived rather than reciprocally stored on buildings;
- the renderer, UI, debug inspector, save surface, and tests consume detached
  immutable presentation snapshots; and
- renderer caches are keyed by stable actor ID rather than display name or
  temporary job state.

Ownership, presentation, strict current-schema save, continuation, transition
ledger, logic, module graph, core/shell isolation, lifecycle, animation,
sprite-map, and three browser gates pass. The real miner browser lifecycle
covers mine work, cargo delivery, route failure/recovery, food-crisis cover,
forage, eating, sleep/wake, story renaming, death/spawn cache cleanup, and
save/Continue/New Game without identity or profession morphing.

The five-trial [same-host performance gate](baselines/performance-v165.md)
passes against realm 163: core median is `160.8 µs/tick` (`-11.87%`), steady
Canvas median is `36.60 ms`
(`+1.10%`, below the `+5%` limit), retained heap is `-24.63%`, the flattened
actor draw maximum remains `81`, and the `100`/`250` snapshot/cache stress gates
pass. Terra and Luna independently approved RFC 0003 closure in Session 009.

The [v165 traffic baseline](baselines/traffic-v165.json) still records the known
worksite separation, 131-tick obstacle replan, and mixed-center overlap defects.
Those are Phase 2 movement blockers, not reasons to restore the removed actor
shape.

## RFC 0002 actor-pose prototype result

The bounded A/B/C experiment is complete and remains isolated from runtime.
Candidate A's layered painted compiler is the only continuation:

- `16/16` rows and `128/128` distinct frames pass exact dimensions,
  hash-tied body-mask scale, root/feet, authored contacts/phase, sockets, and
  clean double-build checks;
- right-facing frames are exact same-beat derivations of left-facing frames, so
  horizontal chronology has one authority and all four tested families are
  zero-shift;
- the style-era cue classifies `16/16` A rows as painted; and
- the compiler now states its real limitation: `VisualDNA` and `GarmentKit` are
  validated declarations, while identity and base garment remain co-authored
  in role-specific concept parts. Interchangeability is not yet proven.

Candidate B's geometry evidence is mechanically sound but its visible output is
too flat/faceted (`4/16` painted-style cue). Candidate C has no authored
body/socket/contact authority and its staged guard-carry family still contains
reversed chronology. B and C do not continue as source architectures.

Terra withdrew A's bounded phase/scale veto after independently proving all 32
right frames are exact same-index mirrors, but retained the canonical-adoption
veto. Luna selected A as the only continuing architecture while noting that
final-raster mirroring flips handed asymmetries and that A's `68–69px` body is
smaller than the control guard/builder ranges. The remaining blockers are a
genuine identity/body/garment/load swap, handed asymmetric equipment, explicit
target scale, blind `1x` identity, seam/occlusion and turn-transition review,
authoring economics, and the complete guard pilot. The comparison bench remains
available at `pose-prototype.html`.

The isolated output profile favors flattened rows for A2: at `250` actors,
flattened versus three-layer output measured `0.100` versus `0.290ms` median
submission and `2.8` versus `7.1ms` median drain, with approximately `2.75`
versus `8.26 MiB` decoded. All `48` A layer strips are unique and the body layer
already contains the base garment, so layered output has no demonstrated reuse
benefit yet. This is a next-pilot decision, not a permanent renderer choice.

## Sprite pause checkpoint

The CC0 Mixxit side walk remains a pinned registration/contact/phase fixture,
not production art. Its evidence enabled one Realm-owned reference cycle.

The sole A2 compiler now emits exactly one offline row:
`watchman × watch-blue × attachment-off × carry/right`. The stale 32-row v1
output and its sentinel-pixel/rigid-limb compiler were replaced in place. The
rejected crate-bearing pose draft and guide path were deleted.

The v2 row has explicit hip/knee/ankle/heel/toe and
shoulder/elbow/wrist/hand chains, categorical near/far IDs, two hand sockets,
an empty load socket, explicit far/body/near occlusion, and no cargo pixels. Its
current evidence is:

- eight distinct painted frames in one `512x84` flattened row;
- heights `[76,75,76,77,76,75,76,77]`, grounded at `y=79`, with rows
  `80–83` clear;
- `1.090` alpha-mass ratio and `1.201` loop-delta ratio;
- a persistent visible `2x2` far-hand cluster in every frame;
- pass-boot visibility at both native and actual 27x35 scale;
- zero fragments, edge pixels, quality warnings, or errors; and
- byte-identical in-memory and independent clean-directory rebuilds.

Terra passes this bounded pause artifact. Luna's first native review vetoed a
collapsed second hand and pass boot; both were corrected in the authored joints
and now have executable visibility gates. Terra's final recheck passes with no
material defect, and Luna withdrew her native-motion/art veto after the v3
review. Final owner native-1x acceptance remains the promotion condition for
deriving any other row.

The focused owner gate now replaces the superseded default A/B/C bench at
`pose-prototype.html`. It shows the exact `64x84` loop at 1x, the actual
`27x35` gameplay sample on Realm terrain, frame stepping/scrubbing, all current
contribution and semantic planes, the native motion rail, machine evidence, and
hash-specific approve/veto language. Browser inspection confirms all assets and
four canvases load, controls work, and the `1280x720` view has no horizontal
overflow.

An executable-scope audit also confirms that the contract's second identity,
second garment, attachment-on state, and other directions are declarations,
not latent compiler capability. The old reference-render crop map could not
safely consume the ochre garment because its sleeve crop was blank; attachment
art and occlusion do not exist; and there is no atlas/index. After owner
approval, the one-row schema/compiler/verifier is replaced—not adapted—by the
preflighted per-source/view contract data. The first new proof is the four
right-facing, attachment-off identity × garment combinations before direction
or attachment propagation.

The source side of that future cut is now preflighted without crossing the
gate. A sibling, source-only tool hash-locks both identities, both garments,
their generation-provenance companions, and 18 isolated right-view parts with
12px transparent margins. Its output is seven files: one manifest, one crop
report, four source overlays, and one contact sheet. It emits zero actor rows,
planes, masks, or atlas data, reports the reference-crop cutover as still
required, and passes an independent byte-identical clean rebuild. Applying
those safer crops would change the reviewed reference pixels, so the crop
authority remains intentionally separate until owner approval.

Review authority is also source-controlled data now. The exact PNG
`491bfcd0a3cb5b96c5371f31900531937448ce2219ce1e5b32cc30a64166da9c`,
native GIF
`e9fe0199ff891a39b962adce0ee12366964b5474a28253541beed1fa7a0ac8aa`,
and review subject
`9584845536c03912fc266c8d00507123b6878737206c10c548ef930980183849`
bind the Terra, Luna, and owner decisions. Compiler, disk verifier, and browser
derive pending/approve/veto state rather than hardcoding the current outcome.
Non-pending verdicts require subject binding, date, and evidence; veto also
requires a defect. Forged or stale records cannot authorize factorial work.
The browser hashes the exact row, native loop, contribution/mask images, all
displayed JSON evidence, and the authored review record; it independently
re-derives the subject and decision state before presenting them.

This row is not live. The current renderer places right-facing cargo about ten
screen pixels opposite the authored load socket and has no rear/front hand
ordering. Runtime promotion stays vetoed until a deterministic frame-socket
attachment surface exists and all four carry directions pass. No live bones,
dual art path, or compatibility fallback is authorized.

## Next actions

This is the clean pause point. Phase 1A is promoted and the one-row A2 artifact
is mechanically and review-authority frozen. All future right-view source parts
are audited, but no compatibility branch, sprite propagation, or half-started
factorial compiler is left active.

1. On owner approval, resume with the crowd-safe miner vertical slice and
   correct the recorded navigation and traffic defects as a promotion condition
   for the miner vertical slice; delete each superseded path during cutover.
2. Split and optimize the entities/world render pass, cull before sorting, cache
   static work, and investigate retained heap before considering a GPU backend.
3. Obtain owner native-1x acceptance for the one-row A2 cycle. Only then replace
   the reference-only compiler with the factorial authority: prove the four
   right/off identity × garment swaps first, then directions, handed
   attachments, flattened atlas, complete guard pilot, and the real renderer
   `100`/`250` actor profile.
