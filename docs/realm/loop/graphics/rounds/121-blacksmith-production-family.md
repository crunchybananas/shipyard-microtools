# Round 121 — Blacksmith production family

Date: 2026-07-30
Runtime revision: 179

## Problem

Blacksmith had ten accepted rows assembled from reversals, walk-derived idle
stances, and mechanically repeated work motion, while six directions still
fell through to inherited base art. The work rows showed a walking man rather
than a smith striking a grounded target. Direction and activity changes could
therefore change identity, clothing, proportions, source quality, and motion
language.

## Decision

Replace all sixteen rows together. A10 uses:

- a new hash-locked woman master-smith identity board;
- a new hash-locked ember-forge garment board;
- a new hash-locked four-view cross-peen forging hammer;
- a separate hash-locked four-view anvil and oak block;
- the approved eight-beat A2 pose authority;
- the shared directional cargo crate;
- one powerful compact render profile, root, scale, palette, and lighting
  contract.

Image generation creates only orthographic modular source components. The
offline joint compiler owns pose, direction, action, runtime row, equipment
occlusion, and scale tier. The live renderer remains raster-only.

## Source provenance

The project stores the original keyed and locally chroma-removed transparent
images for identity, garment, hammer, and workstation. Every source records:

- the complete final built-in image-generation prompt;
- the role of each input reference;
- detected key color and removal settings;
- directional component crop boxes;
- keyed and alpha SHA-256 hashes;
- transparent-corner and nonblank-crop verification.

The blacksmith is a powerful compact middle-aged woman with deep warm-brown
skin, high cheekbones, a square jaw, close black cornrow braids in a small low
knot, and a restrained silver streak. Her clothing uses a deep ember-red
headscarf, soot-charcoal rolled-sleeve shirt, oxblood heavy leather forge
apron, smoke-brown trousers, and black-brown iron-toe boots. These are
independent authorities, not recolors or head transplants from another role.

## Compiler and gates

`a10_blacksmith_actions.py` emits:

- `16` flattened rows and `128` frames;
- body, identity, garment, equipment, and semantic planes;
- joints, sockets, contacts, hammer-head, anvil-face, and workstation
  landmarks;
- body-only and flattened quality reports and proofs;
- a complete family contact sheet;
- exact `27x35`, `35x46`, `54x70`, and `64x84` runtime tiers;
- a shared 48-color, no-dither, binary-alpha runtime palette;
- a complete source/output hash inventory.

Work uses ready, set-piece, draw-back, raise, drive, anvil-strike, rebound, and
recover beats. Both boots remain planted. The hammer follows the right-hand
socket while the direction-specific anvil is compiled as a separate grounded
plane with front/back occlusion authority.

The compiler rejects blank or clipped component crops, stale prompt hashes,
partial runtime alpha, direction duplication, finished-row mirroring, body
height outside `76±1px`, occupied clear rows, disconnected equipment sockets,
cross-action scale drift, row-quality warnings, and non-deterministic second
builds. `verify_a10_blacksmith_actions.py` independently inventories the
artifact tree, requires hammer and anvil landmarks, and performs a
byte-identical clean rebuild.

## Production promotion

All sixteen rows were staged warning-free through the row workbench and then
promoted as one role transaction. The result contains:

- `224` production overrides;
- `0` candidates;
- all sixteen blacksmith rows under A10 provenance;
- content-addressed production files;
- no inherited role/action/direction slot anywhere in the actor manifest.

Complete manifest coverage does not make the remaining derivative families
finished artwork; it removes base fallthrough and makes every future
replacement explicit and reviewable.

## Cargo ownership

Blacksmith carry rows contain the directional crate and authored hand
occlusion, so `blacksmith/carry` joins guard, farmer, lumber, and builder as an
explicit baked-container owner. A6 supplies all nine payload kinds without
drawing a procedural container over any of the five modular families.

## Browser proof

The browser gates prove:

- every A10 row draws through the real renderer at exact `3x` with smoothing
  disabled;
- every action transition begins at frame `0` and advances at its authored
  cadence;
- an assigned blacksmith selects every carry direction from the zoom-matched
  A10 tier;
- A6 iron cargo shares the actor frame, tier, and destination rectangle;
- production covers
  `5 baked-container roles × 9 resources × 4 directions = 180` pairs;
- ordinary URLs request no A5, A7, A8, A9, or A10 preview rows.

## Verification

```sh
python3 scripts/actor-pose-prototype/a10_blacksmith_actions.py --verify
python3 scripts/actor-pose-prototype/verify_a10_blacksmith_actions.py
python3 scripts/actor-pose-prototype/a6_cargo_payloads.py --verify
node scripts/verify-a6-cargo-payloads.mjs
scripts/sprite-row verify
node scripts/build-motion-atlases.mjs
node scripts/verify-sprite-source-contract.mjs
node scripts/verify-blacksmith-vertical-slice.mjs
node scripts/verify-guard-cargo-browser.mjs
node scripts/verify-actor-row-candidate-browser.mjs
node scripts/verify-realm.mjs
```

## Next

Replace the remaining derivative actor families with equally distinct modular
identity, garment, and equipment authorities, then continue through world art
using the same atomic family promotion and live-canvas proof.
