# Round 119 — Lumber production family

Date: 2026-07-30
Runtime revision: 177

## Problem

Lumber was the least complete production actor. Only five of sixteen rows were
reviewed: one independently generated rear walk row and four mechanically
repeated work rows. Idle, three walk directions, and all carry directions still
fell through to inherited base art. The role changed identity, body scale,
costume, palette, and animation source across ordinary activity transitions.

## Decision

Replace all sixteen rows together. A8 uses:

- a new hash-locked woodsman identity board;
- a new hash-locked forest-work garment board;
- a new hash-locked four-view felling axe;
- the approved eight-beat A2 pose authority;
- the shared directional cargo crate;
- one sturdy render profile, root, scale, palette, and lighting contract.

Image generation produces only orthographic modular source components. The
offline joint compiler owns every pose, direction, action, runtime row, and
scale tier. The live renderer remains raster-only.

## Source provenance

The project stores the original keyed and locally chroma-removed transparent
images for the identity, garment, and axe. Each source has:

- the complete final built-in image-generation prompt;
- explicit input-image roles;
- detected key color and removal settings;
- directional component crop boxes;
- keyed and alpha SHA-256 hashes;
- transparent-corner and nonblank-crop verification.

The woodsman has a broad square face, close dark-auburn hair with gray temples,
a short boxed beard, and a sturdy build. Forest workwear uses moss wool,
rust-brown protective leather, reinforced trousers, and logging boots. These
are distinct authorities rather than recolors of the farmer.

## Compiler and gates

`a8_lumber_actions.py` emits:

- `16` flattened rows and `128` frames;
- body, identity, garment, equipment, and semantic planes;
- joints, sockets, contacts, axe-tip landmarks, and per-frame hashes;
- body-only and flattened quality reports and proofs;
- a complete family contact sheet;
- exact `27x35`, `35x46`, `54x70`, and `64x84` runtime tiers;
- a shared 48-color, no-dither, binary-alpha runtime palette;
- a complete source/output hash inventory.

Work uses eight chopping beats: ready, draw back, raise, overhead, drive,
timber contact, follow-through, and recover. The body keeps a fixed root and
scale while the axe is free to travel outside its silhouette.

The compiler rejects blank or clipped component crops, stale prompt hashes,
partial runtime alpha, direction duplication, finished-row mirroring, body
height outside `76±1px`, occupied clear rows, disconnected equipment sockets,
cross-action scale drift, row-quality warnings, and non-deterministic second
builds. `verify_a8_lumber_actions.py` independently inventories the artifact
tree and requires a byte-identical clean rebuild.

## Production promotion

All sixteen rows were staged through the row workbench and passed with zero
warnings. `promote-family` then replaced the complete role in one manifest
transaction.

The result contains:

- `212` production overrides;
- `0` candidates;
- all sixteen lumber rows under A8 provenance;
- content-addressed production files;
- no inherited lumber action or direction.

## Cargo ownership

The lumber carry rows contain the directional crate and authored hand
occlusion, so `lumber/carry` joins `guard/carry` and `farmer/carry` as an
explicit baked-container owner. A6 provides the nine resource payloads without
drawing the old procedural container over any of the three modular families.

## Browser proof

The browser gates prove:

- every A8 row draws through the real renderer at exact `3x` with smoothing
  disabled;
- every action transition begins at frame `0` and advances at its authored
  cadence;
- an assigned sawmill worker selects every carry direction from the
  zoom-matched A8 tier;
- A6 cargo shares the actor frame, tier, and destination rectangle;
- production covers
  `3 baked-container roles × 9 resources × 4 directions`;
- ordinary URLs request no A5, A7, or A8 preview rows.

## Verification

```sh
python3 scripts/actor-pose-prototype/a8_lumber_actions.py --verify
python3 scripts/actor-pose-prototype/verify_a8_lumber_actions.py
python3 scripts/actor-pose-prototype/a6_cargo_payloads.py --verify
node scripts/verify-a6-cargo-payloads.mjs
scripts/sprite-row verify
node scripts/build-motion-atlases.mjs
node scripts/verify-sprite-source-contract.mjs
node scripts/verify-lumber-vertical-slice.mjs
node scripts/verify-guard-cargo-browser.mjs
node scripts/verify-actor-row-candidate-browser.mjs
node scripts/verify-realm.mjs
```

## Next

Builder and blacksmith are now the only roles without all sixteen production
rows. Complete those missing rows, then continue replacing derivative role
families with distinct modular identities, garments, tools, and full-family
runtime proofs.
