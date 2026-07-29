# Realm Engine v2 Council Conversations

This is the readable history of the Engine v2 design conversation. It captures
the questions, positions, pushback, evidence, and decisions that changed the
roadmap. It intentionally summarizes the useful discussion rather than storing
raw model transcripts or private reasoning.

Newest sessions are appended at the bottom.

---

## Session 001 — Should Realm replace its engine or evolve it?

Date: 2026-07-11

Phase: Goal formation / Phase 0A

### Question presented

Realm's NPCs visibly change identities, struggle with paths, overlap, and are
hard to extend. Should the current engine or renderer be scrapped? Should each
NPC own its own logic, with the world and other NPCs exposed through a narrow
input/output surface?

### Primary proposal

Keep one deterministic scheduler, but give every NPC durable identity and
mind-state. A brain reads a bounded world view and emits intents. A world
resolver arbitrates jobs, resources, interactions, navigation, and collision.
The renderer consumes a read-only presentation snapshot.

The initial recommendation was a controlled Engine v2 migration rather than a
blank rewrite: retain the fixed timestep, seeded core, command/event direction,
gameplay data, tests, sprite pipeline, and current renderer output; replace the
citizen kernel and leaky ownership boundaries behind adapters.

### Terra's position

Verdict: **Approve with conditions.**

Terra agreed that NPCs should own minds rather than independent clocks. Her
main pushback was that technically perfect reservations and stable professions
could make the settlement feel sterile or inflexible.

Key conditions:

- Preserve route variation, staggered schedules, social pauses, impatience,
  alternate work positions, and visible yielding.
- Separate persistent profession from temporary assignment. A miner can help
  during a food emergency without becoming visually or historically a farmer.
- Prove the architecture through one complete miner lifecycle before migrating
  every profession or mover.
- Require player-visible reasons for changes and an NPC inspector showing goal,
  plan, reservation, wait, and recent transitions.
- Keep old and new citizen execution comparable behind a rollback flag.

Terra rejected a whole-engine rewrite and voted for a citizen-kernel
replacement bounded by playable acceptance scenarios.

### Luna's position

Verdict: **Veto Phase 1 until Phase 0 evidence is repaired.**

Luna agreed with the actor-intent/world-resolver boundary but challenged the
assumption that existing green tests made the migration safe.

She found two concrete blockers:

1. The determinism harness imports `realm=135` modules while the live graph
   imports `realm=159`. Node creates separate module instances, so the harness
   can invoke 43,200 ticks in one graph while hashing an untouched graph.
2. The save writer emits version 2 while the architecture describes version 3;
   the loader preserves citizen rest only for version 3, so current saves
   silently restore everyone at full rest.

Luna also opposed choosing GPU, Worker, ECS, behavior-tree, or crowd libraries
before reproducible baselines and an architecture decision record justify them.
Canvas2D should first be made snapshot-only and measured.

### Evidence checked

- The determinism command reported success but printed day 1, population 3,
  and zero buildings after its intended twelve-day run.
- A road-aware A* probe chose a cost-11 direct route instead of an available
  cost-6.621 road route because the heuristic ignored the road's 0.5 cost.
- A head-on two-citizen probe reached 0.0287 tiles center-to-center and crossed
  through; moving/moving separation is deliberately skipped until very close.
- Renderer role selection derives character appearance from active work,
  construction, or foraging rather than a stable identity model.

### Discussion and reconciliation

All three positions converged on one distinction:

> Each NPC owns its mind; the world owns shared reality; the renderer observes.

Terra's concern changed the plan from a generic autonomous-agent rewrite to a
living-town vertical slice with explicit behavioral acceptance criteria.
Luna's findings changed the order of work: stable identities and new brains are
not allowed to become authoritative until determinism and persistence can
actually prove continuity.

### Decision

- Start the Engine v2 goal and council process.
- Authorize Phase 0 setup and evidence repair only.
- Accept Luna's veto on Phase 1 promotion.
- Use a miner's full work/delivery/needs/sleep loop as the first vertical slice
  after the safety contracts pass.
- Retain Canvas2D until a purified renderer and feature-equivalent stress test
  justify a backend change.
- Record every future council proposal, disagreement, and resolution in this
  file.

### Open questions carried forward

- How should one canonical browser/Node module revision be generated without
  losing local cache invalidation?
- What historical save fixtures exist or need to be manufactured?
- Which identity and profession changes are legitimate domain events?
- What collision radii and crowd-performance budgets fit Realm's visual scale?
- Which parts of adaptive labor should be personal preference versus realm-wide
  emergency policy?

---

## Session 002 — Can Phase 0B repair the safety contracts without changing the game?

Date: 2026-07-11

Phase: RFC 0001 council review

### Question presented

Should Realm retain its query-versioned native-module deployment while adding a
canonical contract and graph verifier? Can the false-positive determinism gate
and mislabeled save version be repaired as one foundational slice without
starting the NPC rewrite?

### Primary proposal

RFC 0001 proposed one canonical runtime contract for module revision, save
version, and core system-order version; transactional revision tooling; a
non-vacuous determinism harness; pure ordered v2-to-v3 migrations; validation
before load; and fresh-process save continuity.

The slice deliberately retains existing gameplay, Canvas2D, native ES modules,
and query-based browser cache invalidation.

### Terra's position

Verdict: **Approve with conditions.**

Terra investigated the historical save sequence and found that Phase 3 fields
arrived in stages rather than together. `homeIdx` and meaningful rest preceded
`needs`, which preceded the avatar. A classifier requiring all markers would
erase legitimate energy from early Phase 3 saves.

Terra required:

- Per-citizen rest classification using own `homeIdx` presence, preserving
  finite zero as well as midrange values.
- Fixtures for Phase 3a, 3b, and 3d partial shapes.
- Transactional protection for RNG, missions, grid, avatar, object links, and
  the outer Continue entrypoint—not only ordinary `G` properties.
- Exact continuity without shrinking the compared state to hide divergence.
- A living-town v159 baseline and immediate post-Continue identity/job checks.
- A one-time backup of the original raw v2 blob before a migrated realm is ever
  overwritten as v3.

Terra also corrected the RFC's “no gameplay change” wording: preserving saved
energy is an intentional player-visible correctness change after Continue.

### Luna's position

Verdict: **Approve with conditions.**

Luna argued that equal query strings alone do not prove one module graph. The
gate must resolve every local import and prove one URL identity for each
stateful file, including imports executed inside browser verification pages.

Luna required:

- Coverage for static imports, re-exports, side-effect imports, literal dynamic
  imports, browser-evaluated imports, and fail-closed handling of non-literal
  local imports.
- Transactional `--write`, read-only `--check`, and negative import fixtures.
- Determinism controls whose state hash excludes seed and command metadata.
- Exact tick/day/checkpoint and command-consequence assertions.
- A derived map difference for seed sensitivity and an accepted world mutation
  for command sensitivity.
- Strict canonicalization, executable or statically guarded system order, pure
  migrations, full candidate construction, and failure-injection tests.
- Fresh-process uninterrupted/midpoint/resumed comparisons including future-
  affecting transient state.

### Reconciliation and decision

The RFC was revised to incorporate both sets of conditions. Query-versioned
native modules remain temporarily, but only behind one contract, transactional
updater, and resolved-identity verifier. The save migration uses per-citizen
historical markers, preserves the raw first-migration blob, and treats exact
continuation as a hard gate.

Decision: **Implementation authorized; promotion not yet authorized.** Luna's
Phase 1 veto remains active until unique module identity and fresh-process save
continuity pass. Terra's living-town baseline and migration-backup requirements
are also promotion blockers.

---

## Session 003 — Development saves: migrate history or cut cleanly?

Date: 2026-07-11

Phase: RFC 0001 owner correction

### Owner direction

The owner clarified that Realm is still in development and explicitly rejected
backward-compatibility cruft. Historical save migration, partial-shape
classification, raw v2 backups, and legacy fixture work should not constrain
Engine v2.

### Terra's revised position

Verdict: **Approve with conditions.** Terra withdrew the historical migration
requirements. She retained current-build correctness requirements: one explicit
save epoch, incompatible Continue hidden, atomic loading, complete identity/job/
rest/cargo/path continuity, the living-town baseline, and one coherent module
graph.

### Luna's revised position

Verdict: **Approve with conditions.** Luna recommended a new
`realm-engine-v2-save` key and `realm.engine-v2` envelope with independent save,
simulation, and system-order versions. Old keys remain untouched but invisible.
Only exact current versions load; there is no migration or fallback logic.

Luna retained the strict graph, determinism, validation, atomic-commit, and
fresh-process continuity gates because those protect the current engine rather
than historical compatibility.

### Decision

RFC 0001 was rewritten around a clean save epoch. All legacy migration,
classifier, backup, and rollback promises were removed. Exact continuation for
the current schema remains mandatory, and schema/semantic changes during
development deliberately start a new save epoch.

---

## Session 004 — Does realm 163 close Phase 0 safely?

Date: 2026-07-12

Phase: Phase 0B/0C closure review

### Question presented

Does the realm 163 tree now provide trustworthy enough graph, determinism, save,
lifecycle, traffic, performance, browser, and sprite evidence to close Phase 0
and begin the actor-ownership foundation without carrying compatibility paths?

### Evidence presented

- One canonical graph reaches all 48 runtime files through 173 internal edges
  with no alternate-identity allowlist.
- Determinism executes the real graph through tick 43,200/day 13; independent
  seed, command, story-cadence, shared-state, and hostile-presentation controls
  pass.
- The clean save epoch validates all 71 root fields and every admitted actor
  field, rejects malformed preparation and public-load fixtures atomically, and
  converges through tick 10,800 in fresh processes.
- Building removal has one lifecycle across manual demolition, fire, raid, and
  undo, with reference, capacity, defense, grid, refund, story, and immediate-
  save controls.
- The browser reaches day 201/tick 720,000 and reloads/continues exact
  authoritative state. Capture-specific saves remain about 175 KB and below the
  1 MiB comfort bound.
- Current traffic and performance defects are reproducible rather than hidden:
  weighted routing, dynamic invalidation, pass-through, intersection capacity,
  mixed-actor overlap, and the entities/world render hotspot remain explicit
  replacement targets.
- The sprite path has 187 warning-free locked rows and 37 inherited base rows;
  all 224 runtime maps are structurally covered, while semantic identity review
  remains a human promotion requirement.

### Terra's review

Verdict: **Approve with conditions. Phase 0 may close and Phase 1 may begin.**

Terra found no remaining Phase 0 invariant failure. She required Phase 1 to:

- establish stable actor and building IDs;
- separate identity, profession, assignment, activity, brain, and presentation;
- replace inferred transition diagnostics with causal domain events;
- let NPC brains own memory and policy while shared world services resolve jobs,
  inventory, slots, interactions, and lifecycle;
- prove navigation, traffic, resource conservation, and claim atomicity before
  promoting the miner slice;
- make rendering consume read-only presentation snapshots before choosing a
  backend; and
- preserve the clean-cut rule: no migrations, adapters, dual kernels, or
  compatibility fallbacks.

### Luna's initial review and schema veto

Luna first vetoed closure because hostile current-save fixtures could admit an
invalid `population` value and did not exhaustively prove `building.active`.
The save surface was changed to mechanically pair every admitted root and entity
field with an exact validator, followed by a 71/71 root wrong-kind matrix,
strict preparation fixtures, and atomic public-load fixtures. Luna withdrew that
schema veto after independently checking the resulting coverage.

### Luna's final ownership veto

Luna then found a different writer/reader invariant failure. One valid realm
could suffer 41 citizen deaths in a canonical core tick. The core appended all
41 grave markers, while only the browser-shell updater trimmed the collection to
the schema's maximum of 40. A headless or core-only simulation could therefore
write a state its own save contract rejected, and presentation code was mutating
authoritative history.

The implementation moved marker creation and the newest-40 FIFO bound into
`js/death-markers.js`. Combat, plague, and soldier deaths now use that service;
the shell mutator and updater registration were deleted. A permanent regression
begins with a schema-admitted 41-citizen realm, executes one `coreTick()`,
verifies the exact newest 40 names, then serializes, prepares, commits, and
preserves their order.

### Luna's reconsideration

Verdict: **Approve with conditions. Phase 0 closure is authorized; the ownership
veto is withdrawn.**

Luna found no new Phase 0 safety veto. Her non-blocking closure conditions are:

- describe browser save byte counts as capture-specific;
- remove the redundant renderer fallback for a missing `deathMarkers` array
  when that section is next touched; and
- keep the 41-death regression, validator-coverage assertions, and clean-epoch
  rule mandatory for future save changes.

### Decision

Phase 0 is closed on realm 163. RFC 0001 is accepted. Phase 1 actor ownership is
authorized with both reviewers' conditions carried forward. Navigation and
traffic defects remain deliberate Phase 2 miner-slice promotion blockers, not
reasons to retain the old ownership model. Source control remains rollback;
there will be no migration, adapter, dual-schema, or retired-kernel path.

---

## Session 005 — Stop repainting the same inconsistency or adopt a rig?

Date: 2026-07-18

Phase: Phase 1 presentation source proposal

### Question presented

The owner observed that guard height changes when direction changes and asked
whether interchangeable sprite parts or a skeletal system are necessary to stop
re-solving the same inconsistency.

The measurement confirmed the observation. Locked guard idle, walk, and work
rows use `73px` dense bodies facing up and `76–77px` facing down or sideways.
The inherited guard carry family also depicts a different, shielded plate-
armour identity. Three new blue-tunic carry candidates are mechanically clean,
but remain candidates; the up-facing generated row was not staged because
matching its `73px` peer scale would preserve the visible direction pop.

The broader audit found `149/187` accepted rows with settler-derived provenance.
A new cross-direction phase gate also found builder work left/right offset by
three frames and blacksmith walk/carry left/right offset by one. The problem is
therefore systemic source authority, not one bad strip.

### Primary proposal

Replace independent flattened rows as the primary authoring model with an
offline Actor Pose Compiler. One rig/pose graph owns scale, root, feet, sockets,
and an eight-beat timeline shared by all directions. Stable identity, profession
garments, activity clips, equipment, loads, per-view occlusion, and bounded
paint correctives remain separate inputs. The compiler bakes the current
`64x84` raster rows; the live game remains Canvas2D atlas rendering.

Image generation may assist concepts, textures, or bounded correctives, but no
longer invents canonical bodies and frame phase one row at a time.

### Terra's position

Verdict: **Approve with conditions for an offline layered-2D pilot.**

Terra vetoed both a live skeletal/3D runtime and continued independent-row
painting as the primary architecture. She favors direction-specific painted 2D
layers driven by one shared pose clock because they have the best chance of
preserving Realm's warmth.

Her required guard pilot includes one `VisualDNA`, all four actions and
directions, eight synchronized beats, explicit feet/hand/load/tool sockets,
per-view occlusion, bounded overpaint, deterministic baking, semantic identity
review, and proof that it costs less to author than independent rows. She warned
against another generic settler body with palette swaps and against full-frame
overpaint becoming a second pose authority.

### Luna's position

Verdict: **Approve a bounded prototype; veto canonical adoption and an early
2D-versus-3D choice.**

Luna noted that Realm's retired procedural role rig consumed dozens of rounds
without escaping a generic puppet look. A new system must not revive it under a
new name.

She required an A/B/C comparison:

- layered painted 2D as the painterly-fidelity hypothesis;
- orthographic low-poly 3D/2.5D as an invisible geometry, depth, mask, and
  socket authority followed by deterministic painted treatment; and
- the corrected current row factory as the control.

The comparison uses guard walk/carry and builder walk/work across four
directions and eight beats, `128` frames per candidate. It must measure
reproducible bake hashes, authoring time, root/feet/hand/socket error, dense-body
scale, phase, seams, occlusion, and 1x identity. Flattened versus layered atlas
output must also be profiled with 100 and 250 actors because the current atlas
already decodes to roughly 38.5 MiB.

Luna vetoed live skeletal rendering. She also required the Phase 1 presentation
snapshot to supply stable appearance, profession kit, activity clip, facing,
phase, and attachments instead of letting the renderer infer identity from
transient work state.

### Reconciliation and decision

RFC 0002 authorizes the isolated A/B/C prototype only. Layered 2D is the leading
paint hypothesis; 3D/2.5D is the geometry/depth hypothesis; neither is canonical
until it visibly and economically beats the control.

The live Canvas2D atlas contract remains unchanged. The current guard carry rows
are not promoted by scaling finished art. If a source pipeline wins and passes a
complete guard pilot, it becomes the sole actor source after conversion and the
old row-by-row source path is deleted. No dual authoring pipeline, adapter, or
compatibility mode survives adoption.

---

## Session 006 — Did the A/B/C pose compilers actually solve direction drift?

Date: 2026-07-18

Phase: RFC 0002 bounded prototype and post-build council

### Question presented

Build the three authorized source hypotheses rather than choosing from a design
document, keep their evolution visible in a live browser bench, and decide
whether Realm should adopt interchangeable 2D parts, offline 3D authority, or
the current row factory.

The owner repeated the controlling constraint: Realm is in development. A
winning source replaces the losing source; no compatibility adapter, dual
authoring route, or fallback survives conversion.

### Evidence built

All three isolated candidates emitted the same `16` rows and `128` frames:
guard walk/carry and builder walk/work in four directions.

- A used hash-pinned painted component concepts, shared ActionClips, explicit
  anchors, sockets, occlusion groups, and deterministic rear/body/front plus
  flattened outputs.
- B used an orthographic software rig with joint, depth, body-ID, socket, and
  layer passes.
- C copied the exact candidate/locked/base rows the current review workflow
  would select without correcting their semantics.

The shared evaluator was hardened after its first pass confused flattened tool
and limb silhouettes with body scale. It now validates hash-tied compiler
body-mask/ID, root, contact, phase, and socket evidence while retaining
flattened-raster heuristics as review warnings. Identity, paint/style, and
seam/occlusion remain mandatory non-automatic gates, so no candidate can pass
overall by self-report.

The build also exposed a release-gate blind spot. The direction-phase audit
could detect cyclic offsets but not exact reversed chronology. A mandatory
reversal mutation was added. It exposed five additional runtime rows after the
first three repairs. All eight affected families were repaired by deterministic
frame resequencing only; no pixels were repainted, rescaled, or filtered. The
hardened audit now passes all `56` families and `224` rows.

### Terra's first review and reconsideration

Terra initially judged A the only painterly-credible hypothesis but retained
phase and scale objections because flattened-raster warnings contradicted the
manifest's zero-drift claims. B was visibly sterile; C mixed exactly the
candidate, transplant, rescale, and row-local authorities the RFC intended to
remove.

A was then simplified instead of teaching the evaluator to ignore a real
degree of freedom. The right view lost its independent anchors and chronology;
the compiler now derives `right[N]` from `left[N]` and fails the build if any
frame differs. Terra independently compared all 32 horizontal frame pairs and
found zero mismatches. Hash-tied body masks measured `0–1px` height/ground
variation and `0px` root-Y drift.

Terra withdrew the bounded horizontal-phase and scale vetoes. She retained the
canonical-adoption veto because A still co-authors identity and base garment in
role-specific concepts, has not demonstrated an arbitrary kit swap, and lacks
blind `1x`, seam/occlusion, live-transition, authoring-time, and full-guard
evidence.

### Luna's review

Luna agreed that A should be the sole continuing source direction, but pushed
back on treating exact final-frame mirroring as the finished design. It also
mirrors anatomical asymmetries such as a guard sword or builder pouch. A real
pose compiler must mirror joint transforms, then recompose semantic identity,
garment, and attachment parts with explicit handedness and occlusion.

Luna also distinguished consistency from correct target scale. A's compiler
body is approximately `68–69px`, while control guard rows are `73–77px` and
builder rows `79–80px`. A2 needs an explicit accepted Realm scale target rather
than becoming consistent by shrinking.

B's root, phase, depth/ID, and sub-pixel socket evidence were sound, but only
`4/16` rows reached the mechanical painted-style cue. Luna rejected B as a
production source while retaining its ID/depth validation ideas. C remained the
richest paint but failed semantic authority: no authored contacts or sockets,
identity/scale changed between rows, and staged guard carry retained exact
reversed chronology.

### Runtime-output decision

The A benchmark was revised so flattened and layered modes run in separate fresh
Chromium processes and load only their own assets. On the Apple M4 reference:

- at `250` actors, flattened output measured `250` draws, `0.100ms` median
  submission, `2.8ms` median drain, and about `2.75 MiB` decoded;
- three-layer output measured `750` draws, `0.290ms` submission, `7.1ms` drain,
  and about `8.26 MiB` decoded.

All `48` A layer strips are unique and the body layer already includes the base
garment. Layering therefore has no reuse dividend in this prototype. Flattened
rows are selected for A2; layered runtime output remains vetoed until a real
identity-by-garment cross-product changes the memory equation.

### Decision

- Continue A only as an **offline coarse 2D skeletal/pose compiler**. Runtime
  remains flattened Canvas2D atlas rendering; there are no live bones.
- Reject B as production art/source architecture and archive it only as
  geometry/ID/depth evidence.
- Reject C as future source authority and retain it only as comparison evidence.
- Keep the hardened cyclic/reversal direction-phase gate permanently.
- Do not promote any prototype art.

The next bounded slice is A2: two independent identities by two independent
garment kits on one shared walk clip; separate body/skin/head, garment, and
attachment inputs; one-sided pouch/sword sentinels; semantic ID masks and
landmark overlays; target-scale proof; flattened output; and blind `1x` turn
review. Canonical adoption stays vetoed until that cross-product, authoring
economics, seams/motion, and a complete live guard idle/walk/work/carry pilot
pass.

---

## Session 007 — Can one correct open walk stop the sprite inconsistency loop?

Date: 2026-07-18

Phase: RFC 0002 A2 visual veto and focused motion-baseline pause

### Owner correction

The owner rejected the current guard carry proof on direct visual grounds:
the middle of the sequence ran backward, only one readable foot appeared to
advance, and the row did not describe how a loaded person moves from one frame
to the next. The owner required one sprite to be made correct before any
directional, garment, or role propagation.

This superseded the earlier mechanical A2 result. Passing hashes, dimensions,
frame uniqueness, scale range, and socket metadata did not make the visible
motion acceptable.

### Whole-strip generation attempt and veto

An explicit eight-beat
`contact -> down -> pass -> up -> opposite contact -> down -> pass -> up`
pose contract was authored with hip, knee, ankle, foot, shoulder, elbow, hand,
head, pelvis, and load landmarks. It drove an image-generation pass using the
painted guard component concept, the landmark guide, and the rejected row as
references.

The generation prompts required one eight-cell right-facing guard strip,
two-segment legs, continuous ground support, stable identity and crate, and an
opposite-leg repair in frames 4–7. The generated originals remain in the Codex
artifact store:

- `call_qQnxcOyEnlFVFqDSa7vPKhpm.png`: first painted strip with a checker field;
- `call_3bpSzRf4mSSAxC68U45yWfgg.png`: chroma-key repair; and
- `call_euuMgB8qajtq3G2w7R2LSBAp.png`: second-half leg repair attempt.

All three are under
`/Users/cloken/.codex/generated_images/019f47f7-1aa2-70a2-9787-a03b34962f24/`.

The result improved identity, paint, knees, and upper-body weight, but repeated
the same visible rear-leg swing in both half-cycles. Frames 2/6 remained
near-duplicates, the loop closed by snapping, and only one grip read at native
scale. It also baked a wooden crate into the actor even though Realm renders
the resource-specific carried load separately. Promotion would therefore
double-render wood and misrepresent stone, iron, food, and gold.

Terra and Luna independently vetoed promotion. The generated candidate rows,
their one-off packer, and the early paper-doll rig were deleted rather than
retained as alternate pipelines. The readable pose draft and this decision
record preserve the useful evidence.

### Open-source baseline search

The owner proposed using open-source animation as a testable baseline. The
council compared:

- [Universal LPC](https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator),
  which is the strongest four-direction modular taxonomy but carries mixed
  per-piece CC0, OGA-BY, CC-BY, CC-BY-SA, and GPL obligations;
- [Kenney](https://kenney.nl/assets/roguelike-characters) CC0 packs, whose
  common 16px actor scale and inconsistent action matrices are unsuitable for
  Realm motion authority; and
- the CC0
  [Mixxit 64x80 character template](https://opengameart.org/content/80x64-male-and-female-sprites-character-template),
  whose side walk is already an eight-frame 512px row with separate body,
  pants, and shirt layers.

Only the three Mixxit rows needed by the benchmark were imported. `SOURCE.json`
pins the author, CC0 declaration, asset/archive URLs, archive hash, file hashes,
native dimensions, and cargo-free policy. No unrelated Unity metadata, editor
files, or unused art was vendored.

### Executable evidence

The source chronology was cyclically rotated from `[0,1,2,3,4,5,6,7]` to
`[6,7,0,1,2,3,4,5]`, producing two complete
`contact/down/pass/up` halves without reversing time.

The benchmark compiler composites the three source layers, places the native
64x80 image unchanged in a 64x84 Realm cell, and appends four transparent rows.
It does not scale or offset the actor:

- all eight frames end at Realm source baseline `y=79`;
- rows `80–83` remain clear;
- contact frames 0 and 4 contain two separated ground runs;
- every other frame contains one support run and no flight;
- silhouette height is `68–69px`;
- all frames are distinct; and
- the `7 -> 0` pixel delta is `1.371x` the internal transition median.

The production quality analyzer intentionally remains red as art guidance:
six median colors, `0.0345` shading ratio, `blocky` style, and
`legacy-blocky-style`. Its eroded-body heuristic also reports
`ground-anchor-drift` even though the full silhouette is exactly grounded; the
production gate was not weakened to accommodate the reference.

### Council reconciliation

Terra confirmed that the cyclic phase order is coherent and useful as a
side-walk comparison. Luna accepted its unusually stable registration but
rejected it as Realm's sole biomechanical or visual authority: the actor is
only `18–25px` wide, arm counter-swing is weak, transition magnitude is uneven,
and there is no up/down, work, or carry coverage.

The reconciled role of open art is therefore narrow:

- Mixxit owns a pinned **registration, ground-contact, and phase-vocabulary
  fixture**, not Realm identity, proportions, cadence, or final poses.
- LPC informs component taxonomy and four-direction metadata. Pixels are not
  imported without a per-file license allowlist; the default allowlist is
  `CC0-1.0` and `LicenseRef-OGA-BY-3.0`.
- Realm owns the canonical skeletal-lite pose data: root, joints, contacts,
  per-frame timing, hand/load sockets, and occlusion.
- Painted modular parts are baked offline into ordinary flattened rows.
  Runtime bone deformation remains vetoed.
- Carry body art is pose-only. Resource cargo stays in the existing independent
  runtime attachment pass until a socket-aware replacement is explicitly
  adopted.

### Pause decision

The open-source fixture is complete and visible in the Codex browser. This is
the agreed pause boundary. No runtime sprites were replaced and no other
directions or roles were propagated.

On resume, the next bounded task is one Realm-owned guard right-facing cycle:
retime and widen the authored gait against the CC0 contact fixture, keep cargo
out of the body row, prove both leg identities and hand sockets with semantic
masks, and win an unlabeled native-1x review before deriving left or beginning
up/down.

---

## Session 008 — What does “one sprite first” require at native scale?

Date: 2026-07-18

Phase: RFC 0002 A2 right-reference compiler and review boundary

### The old green gate was false

Terra audited the broad A2 compiler against its actual pixels rather than its
manifest claims. The compiler reduced bilateral leg concepts to tiny rigid
hip-to-foot segments, had no knees or ankles, and injected individual pixels at
`[32,4]` and `[32,79]` to manufacture a `76px` height. Its semantic masks were
alpha-composited artwork with more than a thousand colors rather than
categorical IDs. All 32 rows contained loose fragments; many also triggered
anchor, center, height, or painted-era findings.

The complete stale v1 A2 output was deleted. The compiler and verifier were
replaced in place rather than retaining an adapter or a second pose path.

### One explicit carry cycle

The v2 source stops at exactly
`watchman × watch-blue × attachment-off × carry/right`. It owns:

- a fixed `[32,79]` root and ground row with rows `80–83` clear;
- an authored `contact -> down -> pass -> up` half-cycle for each leg;
- separate hip, knee, ankle, heel, and toe coordinates;
- a shared `[0,+1,0,-1]` head/torso/pelvis/arm weight track;
- separate shoulder, elbow, wrist, and hand chains;
- right-hand, left-hand, belt, and empty-load sockets;
- categorical near/far identity and garment IDs; and
- a cargo-free body row.

The CC0 Mixxit strip contributes only its pinned phase/contact vocabulary. The
painted A2 identity and garment concepts contribute texture and silhouette.
Current/legacy actor pixels are not copied, the final bitmap is not mirrored,
and no runtime skeleton is introduced.

The rejected crate-bearing pose draft and its guide generator were deleted
after the useful coordinates were re-authored in v2. The CC0 contract moved
under the sole A2 source directory.

### Compiler and verifier

The offline compiler renders tapered, supersampled upper/lower limbs around the
authored joints, composites explicit far/body/near occlusion, flattens the
result, and emits exactly one row. Evidence consists of:

- the `512x84` flattened row;
- identity, garment, and empty attachment contribution planes;
- one categorical semantic mask;
- landmark JSON;
- labeled still and joint/socket proofs;
- unlabeled native-1x, labeled 5x, and actual 27x35 loops;
- production quality and transition reports; and
- a source/output hash manifest.

The strict disk verifier rejects any extra artifact, re-hashes every output and
selected source/tool input, independently invokes the compiler in a temporary
directory, and byte-compares the complete rebuilt tree. The compiler also runs
two in-memory builds.

### Council iteration

Terra accepted the regenerated architecture and mechanical evidence for this
bounded pause, while retaining the runtime-promotion veto.

Luna's first native-art review accepted the chronology, body weight,
registration, painted identity, empty cargo space, and loop, but vetoed two
remaining silhouette failures: the far hand looked like shading on one long
arm, and pass frames 2/6 compressed into one readable leg at runtime scale.

The source—not the packed pixels—was corrected:

- every far wrist and hand moved two pixels upward, exposing a persistent
  second hand cluster;
- the frame-2 far swing and frame-6 near swing advanced through their knee,
  ankle, heel, and toe chains; and
- new gates require at least eight visible far-hand ID pixels with a true
  `2x2` cluster in every frame, plus a visible pass boot at both `64x84` and
  `27x35`.

The final mechanical evidence measures:

- body heights `[76,75,76,77,76,75,76,77]`;
- `1.090` maximum/minimum alpha-mass ratio;
- `1.201` loop delta versus the internal transition median;
- frame-2 far boot visibility of `69` native pixels / `13` at 27x35;
- frame-6 near boot visibility of `246` / `42`;
- eight visible far-hand pixels and a `2x2` cluster in every frame;
- zero cargo, fragment, edge, quality warning, or quality error findings; and
- painted style with `76px` median body height.

Terra's final v3 review found no material defect and passed the exact bounded
row. Luna re-ran the native and 27x35 review, confirmed that the darker far grip
now reads independently and that both pass boots survive the downsample, and
withdrew her native-motion/art veto. Neither approval extends to another row or
to runtime integration.

### Runtime boundary

The row remains prototype-only. Realm's current right-facing cargo overlay maps
to approximately `s.x-5.2, cy-13.8`, while the authored A2 socket maps near
`s.x+5.06, cy-10.33`. Promoting the body alone would place cargo about ten
screen pixels on the wrong side and cannot represent one hand behind and one in
front of the load.

Runtime adoption therefore requires a small deterministic per-row/frame socket
surface and explicit rear/front load-hand ordering. It does not require live
bones. All four carry directions must pass before any atlas replacement so a
turn cannot preserve phase while switching into unrelated art.

### Pause boundary

The compiler, one row, deterministic/quality evidence, Codex browser review
surface, and Terra/Luna review are complete. Factorial expansion, attachments,
left/up/down, atlas promotion, and runtime replacement remain vetoed. Owner
native-scale acceptance is still required before this single reference cycle
can authorize derivation.

---

## Session 009 — Is the citizen ownership cut ready to promote and pause?

Date: 2026-07-19

Phase: RFC 0003 Phase 1A promotion on realm 165

### Question

Can Realm freeze a trustworthy citizen-ownership foundation now—without
pretending the broader NPC brain, movement, renderer, or sprite work is done—and
stop at a clean review boundary?

### Adversarial pass before council

The first promotion audit did not accept the implementation at face value. It
found and forced corrections for:

- RNG consumption before actor-ID allocation failure;
- duplicated construction staffing policy and fake road/wall builder ownership;
- impossible profession, purpose, and assignment-reason save combinations;
- caller-controlled command ticks and non-replayable arbitrary command fields;
- transition observers that could throw through committed domain changes;
- selected citizens and transition ledgers surviving death or realm replacement;
- two same-tick activity changes when a workplace disappeared;
- permissive appearance keys, unknown activities, missing ownership fields, and
  object values crossing the presentation boundary; and
- population, hover, and inspector consumers reading live citizens instead of
  detached snapshots.

The final hostile case used object-valued `building.type` and
`assignment.duty` records whose string coercion could masquerade as valid
values. Closed known-string building types, bounded string duties, and explicit
coercion-reference regressions removed that last veto. Claim and release reasons
are now direction-specific; `food-crisis` deliberately belongs to both because
the real behavior releases non-food work and then claims temporary food work.

### Browser and performance evidence

Realm 165 passed the real ownership browser, the full miner lifecycle browser,
and the 200-day save/Continue browser. The lifecycle crosses mine work, iron
carry/delivery, route failure and recovery, food-crisis farm cover, forage,
eating, sleep/wake, story renaming, selected-panel cleanup, road/wall UI, death,
spawn, New Game, and load without changing actor identity, appearance, or miner
profession.

The first five-trial performance capture was red for two harness defects even
though every engine budget passed. The fixture hash accidentally included
particle and terminal-path diagnostics beyond its stated actor-count contract,
and live animation frames pruned the synthetic 250-actor cache during forced
GC. The gate was corrected without changing a budget: the fixture now compares
exact setup/tick/day/actor counts while retaining particle/path deltas as
diagnostics, and the live render loop is quiesced only after all real timing,
draw, rAF, and workload-memory measurements.

The repeated capture then passed:

- core median `160.8 µs/tick`, `11.87%` faster than realm 163;
- steady Canvas median `36.60 ms`, `1.10%` slower and within the `+5%` limit;
- retained heap `24.63%` lower;
- exactly `81` maximum actor-atlas draws; and
- green immutable/reference-free snapshot and cache lifecycle probes at `100`
  and `250` actors.

The v165 traffic fixture still reproduces the same three known defects:
worksite personal-space intrusion, 131-tick obstacle invalidation, and mixed
ground actors sharing the center. They remain visible Phase 2 inputs.

### Terra

Verdict: `APPROVE`

Terra independently reran the ownership, presentation/cache, strict save,
continuation, determinism, logic, module-graph, browser, isolation, traffic, and
performance evidence. No Phase 1A blocker remained. Terra emphasized that this
is citizen-only: it does not establish every-actor identity, independent brains,
intent/resolver ownership, or movement reservations.

### Luna

Verdict: `APPROVE`

Luna accepted the exact current-schema cut, causal domain surface,
reference-free presentation, actor-ID cache lifecycle, and repeated browser and
performance evidence. Luna retained the boundary: the decision does not
authorize A2 runtime sprite promotion and does not waive the three Phase 2
movement failures.

### Reconciled decision and pause

RFC 0003 Phase 1A is promoted on realm 165. Broader Phase 1 and Phase 2 remain
open by design.

RFC 0002 stays at its separate owner-review boundary: one mechanically approved
`watchman × watch-blue × attachment-off × carry/right` row, no factorial
expansion, no other direction, no attachment propagation, and no runtime atlas
replacement. This is the clean pause point requested by the owner.

---

## Session 010 — What exactly earns A2 propagation?

Date: 2026-07-19

Phase: RFC 0002 A2 owner review and executable-scope audit

### Question

Can the declared two-identity, two-garment A2 contract be treated as latent
compiler capability after the right-reference cycle passes, or does the next
stage need a deliberate source/compiler replacement? What evidence lets the
owner judge the single row without being biased by a large preview?

### Executable scope, not manifest language

Three independent reads compared the RFC, contract, pose source, compiler,
verifier, outputs, and visible motion. They agreed that the current A2 is a
strong **one-row reference compiler**, not a dormant factorial compiler:

- `watchman` and `watch-blue` are the only art sheets loaded, source-hashed,
  cropped, composed, and verified;
- `craftsperson` and `ochre-work` are declarations only, and the global crop
  map cannot safely consume them—the ochre sleeve crop is blank;
- attachment `off` is proven empty, while attachment `on`, sword, and pouch
  have no source paths, hashes, semantic IDs, composition, handedness, or
  occlusion plan;
- right-facing carry is the only pose/view; left/down/up are declarations, not
  ViewTracks;
- one flattened row exists, but there is no flattened atlas or deterministic
  atlas index; and
- the native loop is not a turn or action-transition proof.

The current compiler's literal paths and verifier expectations correctly
prevent accidental expansion. The contract declaration is therefore not
allowed to count as interchange, attachment, direction, or atlas evidence.

### What the reference really proves

The frozen row continues to pass exact dimensions, eight distinct beats,
categorical identity/garment masks, authored contacts, explicit joints and hand
sockets, `75–77px` height, y=79 registration, cargo-free paint, fragment and
edge checks, native/runtime boot and second-hand visibility, quality
classification, source/output hashing, and byte-identical clean rebuild.

Human review remains meaningful in four places the mechanical gate cannot
settle:

- frame 2's far pass boot is much quieter than frame 6's near pass boot
  (`69/13` versus `246/42` visible pixels at native/runtime scale);
- frame 7 → 0 is the largest transition at `1.201×` the internal median;
- heel and toe remain nearly flat at contact instead of visibly rolling; and
- the rigid two-hand carry pose can read as holding an invisible object while
  attachment state is off.

No one infers owner approval from Terra/Luna's bounded pass.

### Owner review surface

The superseded default A/B/C comparison view was replaced by a focused A2 gate
at `pose-prototype.html`. It loads the exact manifest-selected row and exposes:

- the unlabeled `64x84` cycle at exact CSS-native scale;
- the actual `27x35` gameplay sample on a Realm grass tile;
- pause, stepping, scrubbing, and half/normal/double speed;
- final paint, identity, garment, and categorical semantic planes;
- a nearest-neighbor 4x inspection frame and native eight-beat rail;
- per-frame support, height, second-hand, and transition evidence;
- the pinned CC0 chronology fixture with its non-production boundary; and
- hash-specific approval/veto wording.

The shared-browser audit loaded every asset, rendered all four canvases at their
declared dimensions, exercised pause and semantic-plane controls, and found no
horizontal overflow at `1280x720`.

The exact owner gate is the flattened-row SHA-256
`491bfcd0a3cb5b96c5371f31900531937448ce2219ce1e5b32cc30a64166da9c`
and native-loop SHA-256
`e9fe0199ff891a39b962adce0ee12366964b5474a28253541beed1fa7a0ac8aa`.
Approval authorizes this row as a **derivation reference only**. It does not
approve attachments, atlas promotion, or runtime integration.

### Reconciled next build, after approval

There is no compatibility unlock. The reference-only schema/compiler/verifier
will be replaced by the factorial-stage authority:

1. encode per-source and per-view crops, anchors, hashes, anatomical ownership,
   and margin/nonblank preflight in the contract;
2. compile only the four right-facing, attachment-off identity × garment
   combinations first and prove contribution-plane invariance and blind 1x
   recognition;
3. replace near/far pose ownership with anatomical left/right limbs, derive
   left by mirroring transforms before semantic recomposition, then author
   explicit down/up ViewTracks;
4. measure body scale from body masks so attachments cannot falsify height;
5. add hash-locked sword/pouch art, handed sockets, categorical attachment IDs,
   and explicit rear/body/front occlusion;
6. emit exactly the declared rows, masks, landmarks, flattened atlas, and
   deterministic index, with atlas extraction equality; and
7. run blinded 1x turn review, clean rebuild, full sprite gates, real-renderer
   `100`/`250` profiles, and a fresh Terra/Luna gate.

The one-row schema expectations are deleted in that cut. No adapter, fallback,
dual compiler, or live skeletal renderer survives it.

### Pause decision

This step ends at the owner gate. The game remains live on realm 165 and the
focused review is open beside it. No second identity, garment, attachment,
direction, atlas, or runtime art has been generated. That is the deliberate
pause point.

---

## Session 011 — Can source work continue without crossing the owner gate?

Date: 2026-07-19

Phase: RFC 0002 A2 source preflight, review authority, and deliberate pause

### Question

Can Realm remove the known crop/review infrastructure risks now while keeping
the exact one-row owner subject frozen? What is a truthful stopping point that
does not quietly begin the factorial compiler or generate another sprite?

### Three independent infrastructure audits

The crop audit measured all four declared transparent source sheets against
their actual alpha components. One shared crop table was not viable:
craftsperson and ochre parts were truncated, the old ochre sleeve selection was
blank, and the old ochre belt selected the wrong view. It produced an explicit
per-source right-view table covering four identity parts and five garment parts
with 12px transparent margins.

The verifier audit proved that applying those safer boxes to the selected
watchman/watch-blue reference would change the reviewed bytes. Expanding even
the clipped watchman torso crop changed the flattened row from `491bfcd0…` to
`04b97783…` and the native loop from `e9fe0199…` to `9619aaf6…`. Mechanical
checks still passed, but the hash-bound review correctly became stale. The
auditors therefore rejected a crop “fix” inside the frozen compiler.

The review-authority audit found that human outcomes had been moved into data,
but the first disk/browser implementation still assumed the current outcome:
Terra/Luna approved and owner pending. A future legitimate owner approval would
have been rejected, while a malformed review ID could still expose an
authorization boolean. The browser also trusted un-hashed JSON evidence and
could describe an owner approval even when a council veto made the aggregate
state incomplete.

### Clean source-only preflight

A sibling preflight now consumes the future source boundary without composing
actors. It pins:

- two transparent identity sheets and two transparent garment sheets;
- all four keyed generation-provenance companions;
- exactly 18 right-view component crops;
- the source contract, source provenance, human review record, and frozen
  reference row/GIF; and
- Python `3.9` and Pillow `11.3.0`.

It emits one manifest, one crop report, four source overlays, and one contact
sheet. Every part is nonblank, single-component, isolated, and margin-safe.
The generator cannot write rows, planes, masks, or atlas paths; the independent
verifier remeasures the pixels, rejects forbidden paths and symlinks, re-hashes
all provenance, and byte-compares a clean temporary rebuild. The manifest
truthfully records `generated_actor_rows: 0`, `factorial_ready: false`, and four
remaining blockers:

1. the reference-render crops have not been cut over;
2. left/down/up view parts are not authored;
3. sword and pouch sources are not authored; and
4. the factorial compiler does not exist.

The safe crop authority is ready for the later replacement cut, not installed
behind a compatibility flag.

### Authored and fail-closed human review

`reviews/a2-right-reference-v3.json` is now the sole human-review authority. Its
subject binds:

- row SHA-256
  `491bfcd0a3cb5b96c5371f31900531937448ce2219ce1e5b32cc30a64166da9c`;
- native-loop SHA-256
  `e9fe0199ff891a39b962adce0ee12366964b5474a28253541beed1fa7a0ac8aa`;
  and
- compact subject SHA-256
  `9584845536c03912fc266c8d00507123b6878737206c10c548ef930980183849`.

All three reviewers share the same pending/reference-only-approval/veto
vocabulary. Every non-pending verdict must bind that subject and carry a date
and evidence reference; veto also requires a concrete defect. Compiler and
independent verifier derive validity, council pass, owner pass, status, and
factorial authorization. Tests exercised pending, valid owner approval, valid
owner veto, valid council veto, forged review ID, missing provenance, and stale
artifact bytes. Invalid and veto states always fail closed.

The focused browser now fetches with `no-store`, hashes the actual row, native
GIF, contribution/mask images, mechanical report, landmarks, quality report,
review evaluation, and authored review record. It recomputes the subject digest
and review state before showing or copying decision language. The live page
reports `Frozen bytes hash-bound · owner review`; pause, step, semantic-plane,
and rendering controls work without console errors.

### Terra's final pause review

Terra reran both independent clean rebuilds, verified the pinned toolchain and
three review hashes, counted exactly one A2 row and seven source-preflight
files, inspected the strip/joint/source proofs, and ran tamper probes for a
truncated row and forbidden actor output. Both failed closed.

Verdict: **APPROVE THE PAUSE GATE.**

Terra's only initial hardening note was symlink parity between verifiers. The
one-row verifier now rejects symlinks as well, and both current trees contain
none.

### Luna's final pause review

Luna exercised pending, approval, owner-veto, council-veto-with-owner-approval,
and stale-subject states across the dynamic review logic. She confirmed that
negative or stale states cannot be rendered as authorization. She also verified
the exact frozen bytes over HTTP and the source preflight's zero-output
boundary.

Verdict: **APPROVE THE PAUSE GATE; NO REMAINING VETO.**

The owner can judge this one sprite honestly at native `64x84` and gameplay
`27x35` scale. The unresolved visual questions remain explicit: frame 3/7
pass-leg balance, nearly flat contacts, rigid carry arms, and the frame 8→1
seam.

### Reconciled pause

This is the requested pausing point. Realm 165 is live, the owner gate is open,
the reference row/GIF are byte-for-byte unchanged, and no new actor art exists.
The source crop and review machinery are ready, independently verified, and
fail closed. Work resumes only after the owner approves or vetoes this exact
subject; approval starts a replacement cut, not a compatibility unlock.
