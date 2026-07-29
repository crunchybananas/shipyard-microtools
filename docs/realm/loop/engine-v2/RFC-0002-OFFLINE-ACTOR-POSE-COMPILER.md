# Engine v2 RFC 0002: Offline Actor Pose Compiler

Status: `A2 RIGHT REFERENCE COUNCIL PASS — OWNER REVIEW PENDING; CANONICAL ADOPTION VETOED`

Canonical adoption remains vetoed until one source pipeline wins the acceptance
matrix below. This RFC does not authorize a live skeletal renderer or a second
permanent actor-art path.

## Player-visible outcome

One NPC remains visibly the same person while turning, walking, working, and
carrying. Direction changes preserve body height, feet contact, costume,
equipment, and animation beat. Professions and loads add readable garments and
attachments without replacing the actor's identity.

## Problem and baseline

Realm currently treats each `512x84` action/direction row as an independent art
unit. The row factory can enforce dimensions, painted style, within-row body
stability, and atlas registration, but every repaint still re-solves identity,
proportion, pose phase, hands, occlusion, and lighting.

The current evidence shows the structural ceiling:

- all `224` runtime rows and `1,792` frames exist and pass atlas mapping;
- `187` rows are accepted and `37` still inherit base art;
- `149/187` accepted rows have settler-derived provenance, so mechanical
  consistency often produces palette-swapped bodies rather than a distinct
  cast;
- the locked guard is `73px` dense-body height facing up and `76–77px` facing
  down or sideways across idle, walk, and work;
- the inherited guard carry family depicts a shielded plate-armour identity
  rather than the blue-tunic guard;
- the cross-direction phase gate finds a three-frame builder work offset and
  one-frame blacksmith walk and carry offsets; and
- row-by-row generation required a separate identity-reference guardrail after
  same-action base rows supplied the wrong character as their own reference.

The current actor atlas is about `7.5 MiB` compressed and `38.5 MiB` decoded
RGBA. Pre-baking every identity/profession combination could multiply that
memory, while live compositing could multiply draw calls. Both output strategies
must be measured.

## Scope

### Retained

- Canvas2D atlas rendering in the live game.
- The current `64x84`, eight-frame, four-direction runtime row contract.
- Sprite Lab, Actor Muster, source/hash checks, frame, gait, registration,
  direction-phase, animation, and full-map verification.
- Painted raster output as the visible style.

### Replaced if the prototype wins

- Independent flattened rows as the primary pose and identity authority.
- Image generation as a source of canonical body pose or frame order.
- Opaque-bounds-derived registration and ad hoc per-row scale correction.
- Baked-in cargo that conflicts with runtime loads.
- Settler palette transfer as the default way to create professions.

### Explicitly deferred

- Canonical adoption before the A/B evidence exists.
- Broad cast conversion before the complete guard pilot is accepted.
- Live runtime bones, limb transforms, or a 3D renderer.
- Choosing layered 2D or 3D/2.5D by preference alone.
- Save-schema changes. The prototype is an offline presentation artifact.

## Source model and ownership

The proposed `Actor Pose Compiler` consumes versioned, hash-locked source data:

- `VisualDNA`: immutable body proportions, face/head/hair, skin, silhouette
  rules, and identity palette;
- `GarmentKit`: profession clothing and role silhouette additions;
- `ActionClip`: one normalized eight-beat timeline with authored foot contacts,
  root motion policy, and action entry/remap markers;
- `ViewTrack`: explicit down/up/left/right poses for the same beat;
- `AttachmentSet`: head, hand, carry, rear-equipment, front-equipment, and tool
  sockets;
- `OcclusionPlan`: per-view and, where required, per-pose depth/layer ordering;
- `PaintCorrective`: bounded painted masks for folds, foreshortening, seams, and
  highlights that may not redefine root, sockets, scale, or frame phase; and
- `BakeManifest`: exact source hashes, compiler/tool versions, output hashes,
  dimensions, metrics, and provenance.

The skeleton or pose graph owns scale, root, feet, sockets, and phase. Painted
parts own visible texture and silhouette. Corrective masks may repair a pose but
cannot become a second full-frame pose authority.

The live Phase 1 presentation snapshot will eventually provide stable
`appearanceId`, profession garment kit, activity clip, facing, phase, and
attachments. The renderer must not infer a different identity from transient
job or activity state.

## Candidate source pipelines

### A — layered painted 2D

Direction-specific painted body, garment, limb, head, and equipment parts are
deformed or selected by the shared pose timeline, then composited with explicit
per-view occlusion. This is the leading painterly-fidelity hypothesis, but must
prove it avoids paper-doll seams, generic silhouettes, and manual four-view
drift.

### B — orthographic 3D/2.5D authority

A low-poly rig renders albedo, ID, normal/depth, and socket passes from four
orthographic views. Deterministic painted treatment and bounded 2D correctives
produce the final raster. Raw 3D is never the final style. This is the leading
geometry/occlusion hypothesis, but must prove it avoids sterile rotoscope
lighting, toolchain instability, and excessive authoring cost.

### C — current workflow control

The present row factory supplies the exact candidate/locked/base rows its review
surface would select, with the same roles, actions, directions, and review
budget. It is an honest control, not a retroactively corrected one: staged
candidate defects remain visible. It exists only to measure whether either rig
improves quality and economics; it is not a second canonical path after
adoption.

Do not mechanically cut the current flattened sheets into reusable limbs.
Antialiased overlaps and baked lighting cannot recover trustworthy part
boundaries. Prototype sources begin cleanly.

## Prototype

The bounded comparison produces three isolated, non-runtime candidates:

- guard `walk` and `carry`, including sword and crate/load sockets;
- builder `walk` and `work`, including an asymmetric construction-tool arc;
- four directions and eight synchronized beats for every action;
- `128` frames per source candidate.

If A or B wins, extend only that winner to guard idle/walk/work/carry before a
canonical-adoption review. The current guard carry candidates remain candidates;
the `73px` up-facing family is not promoted or mechanically scaled to disguise
the source inconsistency.

Each source candidate is built twice from a clean checkout. Record cold and
incremental bake time, time to add one clip and one garment kit, source/artifact
size, output hashes, and human correction time.

## Runtime output experiment

Both outputs remain Canvas2D atlas-only:

1. Flattened identity/profession variants: one draw per actor, measured atlas
   and decoded-memory growth.
2. Two-to-four synchronized layers: rear equipment, body/garment, and
   front tool/load, measured draw CPU and ordering correctness.

Measure both at `100` and `250` visible actors using the existing renderer
profile. No output strategy is selected without the measurements.

## Determinism and failure modes

- Canonical builds are offline, network-free, version-pinned, and byte-
  reproducible.
- Image generation may propose concepts, textures, or bounded overpaint ideas;
  a canonical bake never calls a model or network.
- Two clean builds with the same sources must produce identical PNG and
  manifest hashes.
- Wrong phase, root, socket, occlusion, identity source, or unpinned dependency
  fails the build.
- If neither A nor B visibly beats C within the prototype budget, neither is
  adopted.
- If a winner is adopted, it becomes the sole actor source and the old
  row-by-row authoring/derivation source is deleted after complete conversion.
  There is no dual-source adapter or compatibility mode.
- Source control is rollback.

## Acceptance evidence

- Exact `64x84` cells, eight nonblank distinct frames, and four views.
- Root/feet drift `<=1px`; authored foot-contact oscillation is explicit.
- Dense-body height range `<=2px` within a row.
- Same-action cross-direction and same-direction cross-action dense-body median
  delta `<=2px`, unless a reviewed perspective corrective explains a measured
  optical—not padding—difference.
- Zero direction-phase findings; frame `N` is the same beat in all views.
- Hand/carry/head/equipment socket residual `<=1px`.
- Zero joint gaps, layer seams, detached pieces, or occlusion-order defects
  across the `128`-frame comparison.
- Guard and builder remain distinguishable at `1x` without relying only on
  color or a held tool.
- Painted-era metrics remain in Realm's established range and human review
  confirms the same warm, soft-clustered style.
- Sprite Lab beat matrix, onion-skin contact sheets, and live turning/action
  transitions pass owner, Terra, and Luna review.
- Two clean builds have identical output hashes.
- Cold/incremental bake time and authoring/correction time are recorded.
- `100`/`250` actor flattened-versus-layered Canvas2D profiles record frame
  cost, draw count, atlas bytes, decoded bytes, and retained heap.
- All existing sprite, game, logic, core-purity, and determinism gates remain
  green for any runtime promotion.

## Prototype result

The isolated comparison is complete. It did not authorize runtime promotion.

### Candidate A — continue as A2

- Emits all `16` rows and `128` distinct frames from a hash-locked, network-free
  compiler. A second clean output build matches byte-for-byte.
- Hash-tied body masks measure `0–1px` within-row height and ground variation,
  `0px` root-Y drift, and `0–1px` cross-view/action median height delta.
- All rows expose authored beat/contact and socket evidence. Right-facing
  frames are no longer separately authored: `right[N]` is the exact horizontal
  derivation of `left[N]`, and the compiler rejects any mismatch. All four
  horizontal action families now score zero-shift.
- The mechanical style cue classifies `16/16` rows as painted, and the contact
  sheet is the closest of the three candidates to Realm's warm raster language.
- It does **not** yet prove the architecture's central interchange claim.
  `VisualDNA` and `GarmentKit` are validated declarations, while identity and
  the base garment remain co-authored in role-specific painted torso/head
  concepts. Arbitrary body/garment swaps, handed asymmetric equipment,
  visible seam/occlusion review, target on-screen scale, and a full guard pilot
  remain unresolved.

Candidate A therefore continues only as a second experiment: one body identity,
two independently swappable garment/load kits, semantic landmark overlays, and
visible turn/action-transition review. It is not a provisional canonical path.

### Candidate B — reject

B proves that deterministic orthographic geometry can own root, scale, depth,
contacts, and sockets: all mechanical gates pass and maximum socket residual is
below `0.67px`. Its visible result is nevertheless too flat, faceted, and
vector-like; only `4/16` rows register the painted-style cue. Adding a broad
full-frame paint correction would reintroduce a second pose authority. B is
archived as evidence and does not continue.

### Candidate C — reject as architecture

C remains painted and useful as historical comparison evidence, but it exposes
no authored body-mask, root/feet, contact, or socket authority. After the
runtime reversal repairs, its staged guard-carry family still contains exact
reversed left/right chronology. This demonstrates why candidate/base/locked
row selection cannot be the future source of truth. C is not carried forward.

### Runtime-output evidence

The isolated Apple M4/Chromium profile ran each A output in a fresh browser
process. At `100`/`250` actors, flattened submission medians were
`0.040`/`0.100ms` with `1.4`/`2.8ms` median drain probes; synchronized
three-layer output measured `0.120`/`0.290ms` and `3.3`/`7.1ms`. The fixed
prototype rows decode to approximately `2.75 MiB` flattened versus `8.26 MiB`
layered. There were no browser errors.

Candidate A currently emits `48/48` unique layer strips and its body layer
already includes the base garment, so it has no demonstrated reuse dividend.
Flattened output is selected for the next pilot only. Layered runtime output is
vetoed until A2 proves real identity/garment reuse that changes the memory
equation. A permanent choice still requires the full Realm renderer and
combinatorial kit evidence; this microprofile is not that gate.

## Post-prototype council decision

### Terra

Verdict: `CONTINUE A; VETO CANONICAL ADOPTION`

Terra independently compared all `32` horizontal A frame pairs after the
derived-right simplification and found exact same-index mirrors. She withdrew
the bounded phase and scale vetoes: the authored contacts, body masks, and root
evidence corroborate the visible rows. She retained the adoption veto because
the pilot has not demonstrated arbitrary identity/garment interchange, blind
`1x` identity, seam/occlusion quality, live transitions, authoring cost, or a
complete guard.

### Luna

Verdict: `SELECT A FOR A2; VETO CANONICAL AND LAYERED-RUNTIME ADOPTION`

Luna selects an offline coarse 2D skeletal/pose compiler as the sole continuing
source direction and rejects live bones or a renderer replacement. She requires
A2 to separate identity/body/skin/head, garment, and attachment sources;
mirror joint transforms before recomposing handed semantic parts; emit ID masks
and landmarks; and match an explicit accepted Realm scale. She rejects B's
visible style and C's semantic authority.

Luna selects flattened rows for A2. The current layers are all unique and cost
approximately `3×` the submission work and `3×` decoded bytes without reuse.
Layered runtime remains vetoed unless a real identity-by-garment cross-product
materially changes that evidence.

## Reconciliation

Candidate A wins the right to a second bounded experiment, not the right to
become canonical. Candidate B and Candidate C stop here as source
architectures. Runtime Canvas2D and the current atlas contract remain
unchanged; no prototype rows are promoted.

If A2 and the complete guard pilot eventually pass, the offline pose source
becomes the sole actor-art authority and the old row-by-row source is deleted
after full conversion. There will be no adapter, fallback, compatibility flag,
or permanent dual-source path.

## A2 right-reference checkpoint

The first broad A2 factorial output was rejected after visual/source audit. Its
rigid hip-to-foot segments, detached parts, non-categorical masks, and
height-sentinel pixels made the apparent structural pass invalid. That v1
output and compiler behavior were replaced in place.

A2 v2 deliberately emits only
`watchman × watch-blue × attachment-off × carry/right`:

- explicit hip/knee/ankle/heel/toe and shoulder/elbow/wrist/hand chains;
- fixed `[32,79]` root, y=79 contact ownership, and rows `80–83` clear;
- categorical near/far identity and garment IDs;
- separate identity/garment/empty-attachment evidence planes;
- right/left hand, belt, and empty-load sockets;
- one ordinary flattened `512x84` row;
- native-1x, 5x, and actual 27x35 transition loops; and
- strict source/output hashes plus byte-identical in-memory and independent
  clean-directory builds.

After Luna vetoed a collapsed far grip and one-leg pass silhouette, the authored
joints were corrected. Executable gates now require a visible `2x2` far-hand
cluster in all eight frames and a distinct pass boot at native and 27x35 scale.
The final row measures `75–77px` height, `1.090` alpha-mass ratio, `1.201` loop
ratio, zero cargo/fragments/edge pixels, and painted style with no quality
warning or error.

Terra and Luna pass this exact bounded row. Owner native-scale acceptance
remains pending. No left/up/down, attachments, second identity/garment, atlas,
or runtime art is authorized by this checkpoint.

The completion audit makes that boundary executable rather than rhetorical.
Only `watchman` and `watch-blue` enter the current compiler/hash chain; the
second identity and garment remain uncompiled declarations. The original
reference-render crop map would produce a blank ochre sleeve. Attachment-on has
no source art, semantic IDs, handed composition, or occlusion plan. Other
directions have no ViewTracks, and no atlas/index exists. Owner approval
therefore authorizes derivation from this row, not a flag that unlocks a hidden
factorial.

The future right-view source boundary is now executable without producing
actors. A separate preflight pins the two identity and two garment sheets plus
their generation-provenance companions, and independently measures all 18
declared parts as nonblank, single-component crops with at least 12 transparent
pixels of margin. It emits only four source overlays, one crop contact sheet,
one report, and one manifest. Both generator and verifier prohibit rows,
planes, masks, and atlases, record `generated_actor_rows: 0`, and compare a
clean temporary rebuild byte-for-byte. The safer crop table is not consumed by
the reference compiler because that would change the reviewed row; it becomes
render authority only in the post-approval replacement cut.

Human review is authored, hash-bound data rather than a compiler constant. The
review record binds the flattened PNG, native-1x GIF, scope, and purpose into
one subject digest. Terra, Luna, and owner may independently record pending,
reference-only approval, or veto. Every non-pending decision requires the
subject digest, date, and evidence reference; veto additionally requires a
defect. Compiler and independent verifier derive council pass, owner pass,
status, and factorial authorization. Any schema, subject, artifact, or
provenance failure makes the record invalid and authorization false. The review
page hashes the fetched row, GIF, contribution/mask images, displayed JSON
reports, and authored review record, then independently derives the subject and
decision state before it renders or copies decision language. Manifest text
alone cannot bless stale browser pixels or evidence.

After approval, the one-row schema/compiler/verifier is replaced in one cut.
The new authority first proves all four right-facing attachment-off identity ×
garment combinations with owned-plane invariance and blind 1x recognition.
Only then does it add anatomical left/right transform mirroring, explicit
up/down views, handed hash-locked attachments, body-mask scale gates, and an
indexed flattened atlas. No v2 adapter or dual output survives the replacement.

The renderer also remains an integration blocker: its fixed right-facing cargo
offset is about ten screen pixels opposite the A2 load socket and has no
rear/front hand ordering. Runtime promotion requires deterministic per-frame
attachment sockets and the complete four-direction carry family, not live
bones or a compatibility fallback.

Conversation record: `CONVERSATIONS.md`, Sessions 005–011.
