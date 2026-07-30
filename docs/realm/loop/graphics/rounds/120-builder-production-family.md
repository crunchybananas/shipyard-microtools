# Round 120 — Builder production family

Date: 2026-07-30
Runtime revision: 178

## Problem

Builder had ten reviewed rows from three unrelated mechanical sources and six
directions that still fell through to inherited base art. The accepted rows
were legacy derivatives or scale repairs rather than one authored identity:
idle came from walk stances, right-facing rows came from reversals, and work
used uniformly rescaled source frames. Activity and direction changes could
therefore change the role's identity, costume, proportions, palette, and
motion language.

## Decision

Replace all sixteen rows together. A9 uses:

- a new hash-locked master-mason identity board;
- a new hash-locked brick-work garment board;
- a new hash-locked four-view construction mallet;
- the approved eight-beat A2 pose authority;
- the shared directional cargo crate;
- one compact render profile, root, scale, palette, and lighting contract.

Image generation creates only orthographic modular source components. The
offline joint compiler owns every pose, direction, action, runtime row, and
scale tier. The live renderer remains raster-only.

## Source provenance

The project stores the original keyed and locally chroma-removed transparent
images for identity, garment, and mallet. Every source records:

- the complete final built-in image-generation prompt;
- the role of each input reference;
- detected key color and removal settings;
- directional component crop boxes;
- keyed and alpha SHA-256 hashes;
- transparent-corner and nonblank-crop verification.

The builder has olive-warm skin, close black hair, a prominent moustache,
short goatee, and compact sturdy build. His workwear uses dusty sandstone
canvas, a muted terracotta leather apron, dark tool belt, reinforced trousers,
and work boots. These are distinct authorities rather than recolors of the
farmer or lumber worker.

## Compiler and gates

`a9_builder_actions.py` emits:

- `16` flattened rows and `128` frames;
- body, identity, garment, equipment, and semantic planes;
- joints, sockets, contacts, mallet-head landmarks, and per-frame hashes;
- body-only and flattened quality reports and proofs;
- a complete family contact sheet;
- exact `27x35`, `35x46`, `54x70`, and `64x84` runtime tiers;
- a shared 48-color, no-dither, binary-alpha runtime palette;
- a complete source/output hash inventory.

Work uses eight construction beats: ready, measure, draw back, raise, drive,
strike, rebound, and recover. Both boots remain planted while the socketed
mallet moves independently around the body.

The compiler rejects blank or clipped component crops, stale prompt hashes,
partial runtime alpha, direction duplication, finished-row mirroring, body
height outside `76±1px`, occupied clear rows, disconnected equipment sockets,
cross-action scale drift, row-quality warnings, and non-deterministic second
builds. `verify_a9_builder_actions.py` independently inventories the artifact
tree and requires a byte-identical clean rebuild.

## Production promotion

All sixteen rows were staged through the row workbench. The initial
mixed-family comparison warnings disappeared after all four directions were
present, and the complete candidate family passed with zero warnings.
`promote-family` then replaced the role in one manifest transaction.

The result contains:

- `218` production overrides;
- `0` candidates;
- all sixteen builder rows under A9 provenance;
- content-addressed production files;
- no inherited builder action or direction.

## Cargo ownership

Builder carry rows contain the directional crate and authored hand occlusion,
so `builder/carry` joins guard, farmer, and lumber as an explicit
baked-container owner. A6 supplies all nine payload kinds without drawing the
old procedural container over any of the four modular families.

## Browser proof

The browser gates prove:

- every A9 row draws through the real renderer at exact `3x` with smoothing
  disabled;
- every action transition begins at frame `0` and advances at its authored
  cadence;
- an assigned Hall-of-Ages builder selects every carry direction from the
  zoom-matched A9 tier;
- A6 stone cargo shares the actor frame, tier, and destination rectangle;
- production covers
  `4 baked-container roles × 9 resources × 4 directions = 144` pairs;
- ordinary URLs request no A5, A7, A8, or A9 preview rows.

## Verification

```sh
python3 scripts/actor-pose-prototype/a9_builder_actions.py --verify
python3 scripts/actor-pose-prototype/verify_a9_builder_actions.py
python3 scripts/actor-pose-prototype/a6_cargo_payloads.py --verify
node scripts/verify-a6-cargo-payloads.mjs
scripts/sprite-row verify
node scripts/build-motion-atlases.mjs
node scripts/verify-sprite-source-contract.mjs
node scripts/verify-builder-vertical-slice.mjs
node scripts/verify-guard-cargo-browser.mjs
node scripts/verify-actor-row-candidate-browser.mjs
node scripts/verify-realm.mjs
```

## Next

Blacksmith is now the remaining role without all sixteen production rows.
Replace its entire family with distinct modular identity, garment, and
equipment authorities before continuing through the remaining derivative
actor and world art.
