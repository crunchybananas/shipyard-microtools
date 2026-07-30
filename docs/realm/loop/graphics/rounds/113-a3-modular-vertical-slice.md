# Round 113 - A3 Modular Vertical Slice

## Goal

Prove that Realm can produce crisp, consistent actors from reusable painted
identity, garment, skeleton, and attachment authorities without introducing a
skeletal runtime or silently replacing production art.

## Changes

- Converted the reviewed A2 right-facing carry pose into an A3 factorial
  compiler.
- Combined two identities, two garment kits, and two attachment states into
  eight ordinary eight-frame rows.
- Added broad and lean identity render profiles so one garment source can fit
  visibly different body builds.
- Added an original project-bound cargo-crate source with retained generation
  provenance, transparent cleanup, crop ownership, a load socket, and an
  explicit `far-hand < cargo < near-hand` occlusion contract.
- Added deterministic `27x35`, `35x46`, `54x70`, and `64x84` row derivatives.
  Each frame is resized independently so pixels cannot leak across animation
  seams.
- Added one shared 48-color runtime palette, fixed tone curve, binary alpha,
  and no dithering. The canonical painted rows remain unchanged; the runtime
  derivatives use deliberate classic-strategy pixel clusters.
- Staged `guard/carry/right` as a warning-free `CANDIDATE`. Candidate status
  keeps it out of normal production compilation.
- Added `?actorpreview=a3-watchman-blue-cargo`, which substitutes only the
  candidate row and requests no preview assets on an ordinary game URL.
- Updated Actor Muster to display exact compiled frame sizes instead of
  introducing review-only fractional blur.
- Added a browser gate that proves the candidate in Actor Muster and on an
  actual guard carrier in the settlement, while separately proving that the
  ordinary URL stays on production art.

## Mechanical Result

- Factorial rows: `8/8`
- Distinct frames: `64/64`
- Identity planes: invariant across both garments and both attachment states
- Garment planes: invariant across attachment state and fitted to both builds
- Cargo plane: invariant across all four identity/garment combinations
- Cargo socket and hand-visibility checks: `8/8`
- Runtime palette ceiling: `48` colors
- Runtime alpha values: exactly `0` or `255`
- Clean independent rebuild: byte-identical
- Actor Muster preview: exact tier, no smoothing
- Settlement carrier preview: exact zoom-matched tier, no smoothing
- Ordinary game URL: no preview loaders

## Visual Decision

The first structurally correct A3 runtime pass was rejected as too soft. Its
large painted gradients produced thousands of nearly identical runtime colors,
which blurred small features despite correct source resolution. The shared
palette pass makes the helmet, face, garment, hands, boots, and crate read as
deliberate clusters at actual game size. This is the current direction for the
next guard-family slice, not yet a production-art approval.

## Verification

```sh
scripts/.venv/bin/python scripts/actor-pose-prototype/a2_layered2d.py --verify
scripts/.venv/bin/python scripts/actor-pose-prototype/verify_a2_layered2d.py
scripts/.venv/bin/python scripts/actor-pose-prototype/a3_factorial.py --verify
scripts/.venv/bin/python scripts/actor-pose-prototype/verify_a3_factorial.py
REALM_SPRITE_PYTHON=scripts/.venv/bin/python scripts/sprite-row verify
node scripts/verify-actor-vertical-slice.mjs
```

Runtime evidence is written to the gitignored
`tmp/actor-a3-vertical-slice/` directory:

- `live-canvas.png`
- `live-world.png`
- `report.json`

## Next

Build the complete guard action/direction family from the same identity,
garment, pose, palette, anchor, lighting, and attachment contracts. Add
handed-equipment sentinels before authoring the remaining directions, then
review every flattened row in Sprite Lab, Actor Muster, and controlled
settlement fixtures before accepting it.
