# Actor Pose Compiler Prototype

This directory contains the isolated RFC 0002 A/B/C experiment. Nothing here is
read by Realm's runtime, actor manifest, compiled role sheets, or atlas builder.

Every candidate produces the same sixteen `512x84` rows:

- guard `walk` and `carry`;
- builder `walk` and `work`;
- `down`, `up`, `left`, and `right`;
- eight synchronized `64x84` frames per row.

The candidates are:

- `a-layered2d`: painted parts driven by a shared 2D pose clock, sockets, and
  explicit occlusion. Down, up, and left are authored views; right is an exact
  same-beat mirror derived from left so it cannot acquire an independent frame
  chronology;
- `b-orthographic3d`: a software-rendered low-poly 3D/2.5D pose, depth, and
  socket authority followed by deterministic raster treatment; and
- `c-row-factory`: the current candidate/locked/base row workflow as the
  control.

`references/` contains image-generated component concepts. They are offline
source material only: generation is never part of a canonical bake, and pose,
scale, sockets, frame order, and output hashes remain deterministic.
[`references/README.md`](references/README.md) records their prompt intent,
hashes, and authority boundary.

The prototype is evidence, not a migration or compatibility path. If a
candidate eventually wins council review, it must first complete the guard
pilot and pass the runtime memory/frame-time experiment. After full conversion,
the winning authoring source replaces the old row-by-row source; both do not
remain canonical.

## Build

### A2 right-reference gate

The broad A2 factorial output was deleted after direct review exposed rigid
hip-to-foot limbs, detached paper-doll pieces, non-categorical masks, and
sentinel pixels that manufactured its claimed body height.

The sole continuing A2 compiler now stops at one deliberately bounded row:
`watchman × watch-blue × attachment-off × carry/right`. Its v2 pose source owns
explicit hip/knee/ankle/heel/toe and shoulder/elbow/wrist/hand chains, foot
contacts, two hand sockets, an empty load socket, y=79 registration, and a
76px median Realm scale. Painted identity and garment sources own texture and
silhouette only. No current or legacy frame pixels are copied, no final bitmap
is mirrored, and no cargo is baked into the actor.

```sh
scripts/.venv/bin/python scripts/actor-pose-prototype/a2_layered2d.py --verify
scripts/.venv/bin/python scripts/actor-pose-prototype/verify_a2_layered2d.py
scripts/.venv/bin/python scripts/actor-pose-prototype/a2_source_preflight.py --verify
scripts/.venv/bin/python scripts/actor-pose-prototype/verify_a2_source_preflight.py
```

Inputs live in `source/a2-layered2d/`. The output contains exactly one flattened
`512x84` row, categorical semantic IDs, identity/garment/empty-attachment
planes, landmarks, native-1x and 27x35 loops, joint/socket and still proofs,
quality report, manifest, and strict reference gate.

Terra and Luna accept v3 of this exact row at native and 27x35 scale. Owner
acceptance remains pending. Left/up/down derivation, attachments, the second
identity, the second garment, atlases, and runtime promotion remain vetoed until
that final pause gate. The verifier re-hashes all current sources, rejects extra
stale artifacts, and performs an independent byte-identical clean rebuild.

Human decisions live in
`reviews/a2-right-reference-v3.json`, not in compiler code. The record binds
each non-pending decision to the exact flattened PNG, native-1x GIF, and compact
subject digest. The compiler and an independent disk verifier derive pending,
approval, and veto states from that data; invalid or stale review data cannot
authorize expansion. The browser fetches those exact row/GIF bytes with
`no-store`, hashes them through WebCrypto, independently loads and derives the
authored review record, and also hashes the mechanical, landmark, quality, and
review-evaluation JSON it displays. It refuses to display an approval surface
when any byte or derived state differs.

`output/a2-source-preflight/` is separate source-readiness evidence. It audits
all four transparent identity/garment sheets and their generation-provenance
companions, measures 18 isolated right-view parts with at least 12 transparent
pixels of margin, and emits only crop reports and source proofs. It deliberately
emits zero actor rows, planes, masks, or atlases. Its independent verifier
recomputes every crop and hash, rejects actor-output paths, and byte-compares a
clean temporary rebuild. The safe crop table is not applied to the frozen
reference: doing so changes reviewed pixels, so that replacement belongs to the
post-approval factorial cut.

Open `pose-prototype.html` for the focused owner gate. The page presents the
exact row at native `64x84`, actual `27x35` gameplay scale, 4x pixel inspection,
and as a native eight-beat rail. It also exposes identity, garment, and semantic
planes, per-frame metrics, the bounded CC0 chronology fixture, and the precise
row-hash decision language. The previous broad A/B/C candidates remain
historical artifacts and are no longer the default review surface.

The contract's unselected identity, garment, attachment, and direction names
are declarations only at this stage. They are not hidden compiler support. The
factorial stage will replace the one-row schema/compiler/verifier after owner
approval, beginning with the four right-facing attachment-off identity ×
garment combinations. It will not retain a compatibility mode.

Run the candidate scripts with the repository Pillow environment:

```sh
scripts/.venv/bin/python scripts/actor-pose-prototype/layered2d.py \
  --out-dir assets/sprites/prototypes/actor-pose/output/a-layered2d \
  --manifest assets/sprites/prototypes/actor-pose/output/a-layered2d/manifest.json \
  --verify

scripts/.venv/bin/python scripts/actor-pose-prototype/orthographic3d.py \
  --out-dir assets/sprites/prototypes/actor-pose/output/b-orthographic3d \
  --manifest assets/sprites/prototypes/actor-pose/output/b-orthographic3d/manifest.json \
  --verify

scripts/.venv/bin/python scripts/actor-pose-prototype/control.py \
  --out-dir assets/sprites/prototypes/actor-pose/output/c-row-factory

scripts/.venv/bin/python scripts/actor-pose-prototype/evaluate.py \
  --root assets/sprites/prototypes/actor-pose

node scripts/actor-pose-prototype/benchmark.mjs
```

Open `pose-prototype.html` through the local Realm server for the side-by-side
review surface.

## Prototype result

- A passes the bounded structural, body-mask scale, root/feet, authored phase,
  socket, and reproducibility gates. Its painted-style raster cue is `16/16`,
  but identity, seams/occlusion, and paint quality still require human review.
  It is the only candidate continuing.
- B passes its mechanical rig gates, but only `4/16` rows register a painted
  style cue. Its geometric output is rejected as Realm's visible actor style.
- C remains useful as historical comparison evidence, but it has no authored
  socket/contact authority and its staged guard-carry family still contains
  reversed chronology. It is rejected as the future source architecture.

No candidate is canonical. Candidate A still co-authors identity and base
garments in role-specific painted concepts; it has not demonstrated a body with
independently swappable garment/load kits. The next experiment must prove that
interchange surface and visible seam/turn quality before any runtime promotion.

The current A-only output profile favors flattened rows for that next
experiment. Three synchronized layers cost about `3×` the draw submission and
decode to about `8.26 MiB` versus `2.75 MiB` for the fixed flattened set. A has
`48/48` unique layer strips and no demonstrated garment reuse yet, so layered
runtime output is not justified by this prototype.

`reports/evaluation.md` is the mechanical comparison.
`reports/runtime-profile.md` is a machine-specific output-strategy
microprofile; it is not the full Realm renderer benchmark.
