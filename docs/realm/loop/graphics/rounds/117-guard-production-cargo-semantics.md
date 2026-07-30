# Round 117 — Guard production family and resource cargo semantics

Date: 2026-07-30
Runtime revision: 175

## Problem

The complete A5 guard family was mechanically clean but still blocked from
production. Its carry rows contain a baked, hand-socketed crate, while the
renderer also painted a second procedural load. Suppressing the procedural
load removed the duplicate but erased the distinction between wood, stone,
food, gold, iron, wheat, flour, planks, and tools.

## Decision

The baked crate remains part of the guard carry row because it already owns
the correct hand occlusion, direction, gait, and per-frame load socket. A new
A6 attachment family draws only the resource contents/signifier over that
container. Actor rows without a baked container continue to use the legacy
procedural load until their own families migrate.

The runtime ownership contract is explicit:

- `guard/carry` owns a baked cargo container.
- A6 owns the resource-specific raster payload.
- Actor and payload select the same runtime tier and frame.
- Both use the exact same destination rectangle and registration correction.
- The procedural fallback never draws for an owning row.

## Source and compiler

One project-bound image-generation source board contains nine isolated
payloads in a fixed `3x3` grid. The keyed source, transparent source, complete
prompt, style reference, chroma-removal record, crop order, dimensions, and
SHA-256 hashes are checked in.

`a6_cargo_payloads.py`:

- crops each declared resource cell independently;
- trims by alpha and downsamples to its resource-specific source box;
- applies a fixed contrast/color treatment, 16-color ceiling, binary alpha,
  and no dithering;
- attaches each payload to every A5 `load` socket;
- emits 36 reviewable `512x84` rows and 288 frames;
- compiles exact `27x35`, `35x46`, `54x70`, and `64x84` atlases without
  sampling across frame seams;
- writes a complete hash inventory and a composite guard proof;
- produces a byte-identical clean rebuild.

The atlas builder verifies the A6 manifest before copying its four exact
atlases into the production sprite directory.

## Production promotion

All 16 A5 rows were promoted in one actor-row manifest transaction. The result
has:

- `195` production overrides;
- `0` review candidates;
- four newly owned guard carry rows rather than inherited base art;
- content-addressed production files for all promoted rows;
- no warning-bearing or hash-mismatched guard source.

## Browser proof

The production renderer—not the preview path—draws two close-zoom proof
canvases at exact `3x` scale:

- all nine resources across all four directions (`36` actor/payload pairs);
- idle, walk, work, and carry across all four directions (`16` action rows).

The browser gate proves:

- every action transition resets to authored frame `0` before advancing;
- actor and payload source frames stay synchronized;
- actor and payload destination rectangles are identical;
- the `64x84` review tier is used at exact `3x`;
- smoothing is disabled;
- no A5 preview asset is requested by the ordinary production URL.

## Verification

```sh
python3 scripts/actor-pose-prototype/a6_cargo_payloads.py --verify
node scripts/verify-a6-cargo-payloads.mjs
scripts/sprite-row verify
node scripts/build-motion-atlases.mjs
node scripts/verify-actor-vertical-slice.mjs
node scripts/verify-guard-cargo-browser.mjs
node scripts/verify-realm.mjs
```

## Next

Use the same complete-family discipline for the farmer: one stable identity,
four actions, four directions, reviewable single-row files, independent tool
and cargo attachments, and production promotion only after close transition
proof. Generalize baked-container ownership only when another role receives a
real modular carry family; do not force A6 payloads over inherited rows.
