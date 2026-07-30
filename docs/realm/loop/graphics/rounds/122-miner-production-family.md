# Round 122 — Miner production family

Date: 2026-07-30
Runtime revision: 180

## Problem

The production miner changed identity and scale between actions. Idle, walk,
and carry mostly used a settler body with transplanted mining headgear, while
work mixed reversed frames, walk-derived motion, and independently generated
large bearded workers. The down and up work rows did not agree with the side
rows, the pick could detach from the hands, and there was no stable grounded
ore target. Direction or activity changes could therefore change the
character, clothing, proportions, and motion language.

## Decision

Replace all sixteen rows together. A11 uses:

- a new hash-locked compact older veteran deepdelver identity board;
- a new hash-locked slate-blue, coal-black, ochre, and brass garment board;
- a new hash-locked four-view traditional two-ended mining pickaxe;
- a separate hash-locked four-view grounded ore-face board;
- the approved eight-beat A2 pose authority;
- the shared directional cargo crate;
- one barrel-chested render profile, root, scale, palette, and lighting
  contract.

Image generation creates only orthographic modular source components. The
offline joint compiler owns pose, action, direction, tool sockets, workstation
occlusion, single-row outputs, and runtime tiers. The live renderer remains
raster-only.

## Source provenance

The project stores both the keyed and locally chroma-removed transparent
sources for identity, garment, pickaxe, and ore face. Every authority records:

- the complete final built-in image-generation prompt;
- the role of each input reference;
- the detected key color and removal settings;
- explicit component crop boxes with transparent margins;
- keyed and alpha SHA-256 hashes;
- transparent-corner and nonblank-crop verification.

The miner is a compact older man with medium copper-olive skin, broad
cheekbones, a notched iron-gray brow, a long slightly broken nose, close
salt-and-pepper hair, and a short square beard. His clothing uses a deep
slate-blue quilted jacket, coal-black reinforced bib, ochre-brown harness,
aged brass hardware, a black mining cap with an unlit brass lamp, charcoal
trousers, and iron-capped boots. These are independent authorities rather than
settler recolors or head transplants.

## Compiler and gates

`a11_miner_actions.py` emits:

- `16` flattened rows and `128` frames;
- body, identity, garment, equipment, and semantic planes;
- joints, sockets, contacts, pick-head, ore-face, and workstation landmarks;
- body-only and flattened quality reports and proofs;
- a complete family contact sheet;
- exact `27x35`, `35x46`, `54x70`, and `64x84` runtime tiers;
- a shared 48-color, no-dither, binary-alpha runtime palette;
- a complete source/output hash inventory.

Work uses ready, set-footing, draw-back, raise, drive, ore-strike, rebound,
and recover beats. Both boots remain planted. The pick follows the physical
right-hand socket while the direction-specific ore target is compiled as a
separate grounded plane with front/back occlusion authority.

The compiler rejects blank or clipped source crops, stale prompt hashes,
partial runtime alpha, direction duplication, finished-row mirroring, body
height outside `76±1px`, occupied clear rows, disconnected equipment sockets,
cross-action scale drift, row-quality warnings, and non-deterministic second
builds. `verify_a11_miner_actions.py` independently inventories the complete
artifact tree, requires pick and ore landmarks, and performs a byte-identical
clean rebuild.

## Production promotion

All sixteen rows were staged through the row workbench. Once the complete
direction families were present, every row was warning-free.
`promote-family` replaced the entire miner role in one manifest transaction.

The result contains:

- `224` production overrides;
- `0` candidates;
- all sixteen miner rows under `a11-modular-miner-actions` provenance;
- content-addressed production files;
- no inherited miner action or direction.

## Cargo ownership

Miner carry rows include the directional crate and authored hand occlusion, so
`miner/carry` joins guard, farmer, lumber, builder, and blacksmith as an
explicit baked-container owner. A6 supplies all nine payload kinds without
drawing a procedural container over any of the six modular families.

## Browser proof

The browser gates prove:

- every A11 row draws through the real renderer at exact `3x` with smoothing
  disabled;
- every action transition begins at frame `0` and advances at its authored
  cadence;
- an assigned mine worker selects every carry direction from the zoom-matched
  A11 tier;
- A6 iron cargo shares the actor frame, tier, and destination rectangle;
- production covers
  `6 baked-container roles × 9 resources × 4 directions = 216` pairs;
- ordinary URLs request no A5, A7, A8, A9, A10, or A11 preview rows.

## Verification

```sh
python3 scripts/actor-pose-prototype/a11_miner_actions.py --verify
python3 scripts/actor-pose-prototype/verify_a11_miner_actions.py
python3 scripts/actor-pose-prototype/a6_cargo_payloads.py --verify
node scripts/verify-a6-cargo-payloads.mjs
scripts/sprite-row verify
node scripts/build-motion-atlases.mjs
node scripts/verify-sprite-source-contract.mjs
node scripts/verify-miner-vertical-slice.mjs
node scripts/verify-guard-cargo-browser.mjs
node scripts/verify-actor-row-candidate-browser.mjs
node scripts/verify-realm.mjs
```

## Next

Replace the remaining derivative actor families with equally distinct modular
identity, garment, and equipment authorities, then continue through world art
using the same atomic family promotion and live-canvas proof.
