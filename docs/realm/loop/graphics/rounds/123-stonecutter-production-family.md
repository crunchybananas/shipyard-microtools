# Round 123 — Stonecutter production family

Date: 2026-07-30
Runtime revision: 181

## Problem

Every production stonecutter row was a palette transfer of the settler.
Changing action or direction preserved the generic settler silhouette but
never communicated quarry work: there was no stonecutter identity, protective
clothing, heavy tool, grounded stone target, or role-specific work motion.
Stonecutters were also visually interchangeable with six other derivative
professions.

## Decision

Replace all sixteen rows together. A12 uses:

- a new hash-locked, broad and low-built middle-aged woman quarry-master
  identity board;
- a new hash-locked limestone-gray, russet, tan-leather, and charcoal garment
  board;
- a new hash-locked four-view long-handled quarry sledge;
- a separate hash-locked four-view split limestone block with an embedded
  wedge;
- the approved eight-beat A2 pose authority;
- the shared directional cargo crate;
- one strong quarry-worker render profile, root, scale, palette, and lighting
  contract.

Image generation creates only orthographic modular source components. The
offline joint compiler owns action, pose, direction, sockets, occlusion,
single-row outputs, and runtime tiers. The live renderer remains raster-only.

## Source provenance

The project stores both keyed and locally chroma-removed transparent sources
for identity, garment, sledge, and split stone. Every authority records the
complete effective image-generation prompt, input-reference role, detected key
color, removal settings, crop boxes with transparent margins, and keyed and
alpha SHA-256 hashes.

The stonecutter is a sturdy middle-aged East Asian woman with warm golden-olive
skin, a square face, high cheekbones, a scar through her right eyebrow, cropped
black hair, and a compact braided coil. Her padded limestone-gray jacket,
muted-russet yoke and head-wrap band, split-leather apron, charcoal trousers,
and stone-dusted boots are independent authorities rather than a settler
recolor.

## Compiler and gates

`a12_stonecutter_actions.py` emits:

- `16` flattened rows and `128` frames;
- body, identity, garment, equipment, and semantic planes;
- joints, sockets, contacts, sledge-head, split-face, and workstation
  landmarks;
- body-only and flattened quality reports and proofs;
- a complete family contact sheet;
- exact `27x35`, `35x46`, `54x70`, and `64x84` runtime tiers;
- a shared 48-color, no-dither, binary-alpha runtime palette;
- a complete source/output hash inventory.

Work uses ready, set-footing, draw-back, raise, drive, wedge-strike, rebound,
and recover beats. Both boots stay planted. The sledge remains socketed to the
physical right hand while the direction-specific limestone block is compiled
as a separate grounded plane with front/back occlusion authority.

The compiler rejects blank or clipped crops, stale prompt hashes, partial
runtime alpha, duplicate directions, finished-row mirroring, body-height or
ground-anchor drift, occupied clear rows, disconnected equipment, row-quality
warnings, and non-deterministic rebuilds. The strict verifier inventories the
entire artifact tree and requires a byte-identical clean build.

## Production promotion

All sixteen rows were staged through the row workbench and restaged after the
complete direction family existed so cross-direction comparisons used the new
peers. Every row was warning-free before `promote-family` replaced the full
stonecutter role in one manifest transaction.

The result contains:

- `224` production overrides;
- `0` candidates;
- all sixteen stonecutter rows under `a12-modular-stonecutter-actions`
  provenance;
- content-addressed production files;
- no inherited stonecutter action or direction.

## Cargo ownership

Stonecutter carry rows include the directional crate and authored hand
occlusion, so `stonecutter/carry` joins the six earlier modular owners. A6
supplies all nine payload kinds without drawing a procedural container over
any of the seven families.

## Browser proof

The browser gates prove:

- every A12 row draws through the real renderer at exact `3x` with smoothing
  disabled;
- every action transition begins at frame `0` and advances at its authored
  cadence;
- an assigned quarry worker selects every carry direction from the
  zoom-matched A12 tier;
- A6 stone cargo shares the actor frame, tier, and destination rectangle;
- production covers
  `7 baked-container roles × 9 resources × 4 directions = 252` pairs;
- ordinary URLs request no A5, A7, A8, A9, A10, A11, or A12 preview rows.

## Verification

```sh
python3 scripts/actor-pose-prototype/a12_stonecutter_actions.py --verify
python3 scripts/actor-pose-prototype/verify_a12_stonecutter_actions.py
python3 scripts/actor-pose-prototype/a6_cargo_payloads.py --verify
node scripts/verify-a6-cargo-payloads.mjs
scripts/sprite-row verify
node scripts/build-motion-atlases.mjs
node scripts/verify-sprite-source-contract.mjs
node scripts/verify-stonecutter-vertical-slice.mjs
node scripts/verify-guard-cargo-browser.mjs
node scripts/verify-actor-row-candidate-browser.mjs
node scripts/verify-realm.mjs
```

## Next

Replace the remaining derivative actor families with equally distinct modular
identity, garment, and equipment authorities, then continue through world art
using the same atomic promotion and live-canvas proof.
