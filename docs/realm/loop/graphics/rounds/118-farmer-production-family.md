# Round 118 — Farmer production family

Date: 2026-07-30
Runtime revision: 176

## Problem

The farmer changed art systems during play. Idle and walk used a small
settler-derived body with a transplanted farmer head, two work directions used
a separate larger mechanical repaint, two work directions remained inherited,
and all carry directions still came from the base sheet. Body scale, palette,
costume construction, tool handling, and animation rhythm changed at ordinary
activity transitions.

## Decision

Replace all sixteen farmer rows together. A7 uses:

- the hash-locked craftsperson identity;
- the hash-locked ochre workwear garment kit;
- the approved eight-beat A2 pose authority;
- four directional source-component sets;
- an independently generated four-view farming hoe;
- the shared directional cargo crate;
- one lean render profile, root, scale, palette, and lighting contract.

The runtime remains raster-only. Modular joints and parts are offline
authoring controls that compile to reviewable `512x84` rows and exact-size
runtime tiers.

## Image-generation source

Image generation was limited to the hoe source board. The actor body and
garment were not regenerated per frame.

The project stores:

- the original keyed `1536x1024` source;
- the locally chroma-removed transparent source;
- the complete prompt and reference roles;
- the detected key color and removal settings;
- four explicit directional crop boxes;
- keyed and alpha SHA-256 hashes.

This keeps the generated work reproducible and prevents identity drift across
animation frames.

## Compiler and gates

`a7_farmer_actions.py` emits:

- `16` flattened rows and `128` frames;
- body, identity, garment, equipment, and semantic planes;
- per-frame joints, sockets, tool-tip landmarks, contacts, and hashes;
- body-only and flattened quality reports/proofs;
- a complete family contact sheet;
- exact `27x35`, `35x46`, `54x70`, and `64x84` tiers;
- a shared 48-color, no-dither, binary-alpha runtime palette;
- a complete source/output hash inventory.

The compiler rejects blank or clipped components, missing crop margins,
partial runtime alpha, direction duplication, finished-row mirroring, body
height outside `76±1px`, ground-anchor drift, occupied clear rows, disconnected
equipment sockets, cross-action scale drift, warnings, and non-deterministic
second builds.

`verify_a7_farmer_actions.py` independently checks the artifact tree and runs a
clean compiler in a temporary directory, requiring a byte-identical result.

## Production promotion

All sixteen rows were first staged as candidates. The direction comparator was
run again after the complete candidate family existed so no new front/back row
was judged against the obsolete mixed art. Every candidate then had zero
warnings.

`promote-family` validated and promoted all sixteen rows in one manifest
transaction. The result contains:

- `201` production overrides;
- `0` candidates;
- all sixteen farmer rows under one A7 provenance;
- content-addressed production files;
- no inherited farmer action or direction.

## Cargo ownership

The farmer carry rows include the same directional crate and load sockets as
the guard. `farmer/carry` therefore joins `guard/carry` as an explicit baked
container owner. A6 draws the nine resource payloads over either actor family;
the old procedural load remains available only to rows without a baked
container.

The renderer's preview registry was generalized from one hard-coded A5 family
to data-driven A5 and A7 configurations. Preview container ownership is also
explicit, so pre-promotion farmer review never paints a duplicate load.

## Browser proof

The browser gates prove:

- every A7 action/direction row draws through the production renderer at exact
  `3x`, with smoothing disabled;
- every action transition starts at frame `0` and advances at its authored
  cadence;
- an assigned in-world farmer selects all four carry directions from the
  correct zoom-matched A7 tier;
- A6 cargo shares the actor frame and destination rectangle;
- production rendering covers
  `2 baked-container roles × 9 resources × 4 directions`;
- ordinary URLs request no A5 or A7 preview rows.

## Verification

```sh
python3 scripts/actor-pose-prototype/a7_farmer_actions.py --verify
python3 scripts/actor-pose-prototype/verify_a7_farmer_actions.py
python3 scripts/actor-pose-prototype/a6_cargo_payloads.py --verify
node scripts/verify-a6-cargo-payloads.mjs
scripts/sprite-row verify
node scripts/build-motion-atlases.mjs
node scripts/verify-sprite-source-contract.mjs
node scripts/verify-farmer-vertical-slice.mjs
node scripts/verify-guard-cargo-browser.mjs
node scripts/verify-actor-row-candidate-browser.mjs
node scripts/verify-realm.mjs
```

## Next

Build the next complete role from a distinct modular identity and garment
authority. Do not recolor the farmer into another profession. Preserve the
same sixteen-row atomic promotion and close live-canvas proof.
