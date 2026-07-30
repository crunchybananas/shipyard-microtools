# Round 124 — Fisher production family

Date: 2026-07-30
Runtime revision: 182

## Problem

Every production fisher row was a palette transfer of the settler. The role
had no stable fisher identity, weatherproof harbor clothing, fishing tool,
catch container, or fishing-specific work cycle. Side-facing walk and carry
rows also drifted furthest from the role's cardinal silhouette.

## Decision

Replace all sixteen rows together. A13 uses:

- a new hash-locked elderly harborhand identity board;
- a new hash-locked storm-teal dock-worker garment board;
- a new hash-locked four-view long harbor gaff;
- a separate hash-locked four-view open fish creel;
- the approved eight-beat A2 pose authority;
- the shared directional cargo crate;
- one lean, wiry render profile, root, scale, palette, and lighting contract.

Image generation creates only orthographic modular source components. The
offline joint compiler owns action, pose, direction, sockets, occlusion,
single-row outputs, and runtime tiers. The live renderer remains raster-only.

## Source provenance

The project stores both keyed and locally chroma-removed transparent sources
for identity, garment, gaff, and creel. Every authority records the complete
effective image-generation prompt, reference role, key-color and removal
settings, crop boxes with transparent margins, and keyed and alpha SHA-256
hashes.

The fisher is an elderly Black man with deep walnut skin, a lean build,
angular high-cheekboned face, crooked broad nose, eyebrow nick,
salt-and-pepper curls, and a short silver beard. His dark watch cap,
sea-teal waxed jacket, brick-red yoke, salt-beige apron, dark trousers, and
sea boots are independent authorities rather than a settler recolor.

## Compiler and gates

`a13_fisher_actions.py` emits:

- `16` flattened rows and `128` frames;
- body, identity, garment, equipment, and semantic planes;
- joints, sockets, contacts, gaff-hook, creel, and workstation landmarks;
- body-only and flattened quality reports and proofs;
- a complete family contact sheet;
- exact `27x35`, `35x46`, `54x70`, and `64x84` runtime tiers;
- a shared 48-color, no-dither, binary-alpha runtime palette;
- a complete source/output hash inventory.

Work uses ready, sight, reach, hook, draw, lift, stow, and recover beats. Both
boots stay planted. The gaff remains socketed to the hands while the
direction-specific creel stays on its own grounded equipment plane and
remains visible in rear-facing frames.

The compiler rejects blank or clipped crops, stale prompt hashes, partial
runtime alpha, duplicate directions, finished-row mirroring, body-height or
ground-anchor drift, occupied clear rows, disconnected equipment, row-quality
warnings, and non-deterministic rebuilds. The strict verifier inventories the
entire artifact tree and requires a byte-identical clean build.

## Production promotion

All sixteen rows were staged through the row workbench and restaged after the
complete direction family existed so cross-direction comparisons used the new
peers. Every row was warning-free before `promote-family` replaced the full
fisher role in one manifest transaction.

The result contains:

- `224` production overrides;
- `0` candidates;
- all sixteen fisher rows under `a13-modular-fisher-actions` provenance;
- content-addressed production files;
- no inherited fisher action or direction.

## Cargo ownership

Fisher carry rows include the directional crate and authored hand occlusion,
so `fisher/carry` joins the seven earlier modular owners. A6 supplies all nine
payload kinds without drawing a procedural container over any of the eight
families.

## Browser proof

The browser gates prove:

- every A13 row draws through the real renderer at exact `3x` with smoothing
  disabled;
- every action transition begins at frame `0` and advances at its authored
  cadence;
- an assigned fisherman selects every carry direction from the zoom-matched
  A13 tier;
- A6 food cargo shares the actor frame, tier, and destination rectangle;
- production covers
  `8 baked-container roles × 9 resources × 4 directions = 288` pairs;
- ordinary URLs request no A5, A7, A8, A9, A10, A11, A12, or A13 preview
  rows.

## Verification

```sh
python3 scripts/actor-pose-prototype/a13_fisher_actions.py --verify
python3 scripts/actor-pose-prototype/verify_a13_fisher_actions.py
python3 scripts/actor-pose-prototype/a6_cargo_payloads.py --verify
node scripts/verify-a6-cargo-payloads.mjs
scripts/sprite-row verify
node scripts/build-motion-atlases.mjs
node scripts/verify-sprite-source-contract.mjs
node scripts/verify-fisher-vertical-slice.mjs
node scripts/verify-guard-cargo-browser.mjs
node scripts/verify-actor-row-candidate-browser.mjs
node scripts/verify-realm.mjs
```

## Next

Replace the remaining derivative actor families with equally distinct modular
identity, garment, and equipment authorities, then continue through world art
using the same atomic promotion and live-canvas proof.
