# Round 114 - A4 Guard Direction Family

## Goal

Expand the approved modular guard proof from one side-facing carry row into a
crisp, consistent, reviewable four-direction family without copying legacy
frames, mirroring finished rows, or adding a skeletal runtime.

## Changes

- Audited the unused painted components already present in the watchman,
  watch-blue, and cargo source sheets.
- Added a hash-locked A4 parts contract for front, back, left, and right
  identity, garment, and attachment views.
- Corrected the cargo mapping: down/up use their perspective views and both
  side directions use the previously unused true side crate.
- Added a deterministic offline compiler for four directions and two
  attachment states.
- Kept the reviewed right-facing A2 joint chain. Left reflects the joints and
  uses the source sheet's unflipped left-facing components. Down and up use
  authored frontal/back chains with the same contact chronology, weight track,
  hand sockets, load socket, root, and ground authority.
- Preserved independent identity, garment, attachment, semantic-mask, and
  landmark artifacts alongside each flattened `512x84` animation row.
- Compiled exact `27x35`, `35x46`, `54x70`, and `64x84` runtime rows with one
  shared 48-color palette, binary alpha, fixed tone curve, and no dithering.
- Staged all four cargo rows as warning-free candidates.
- Replaced the single-row A3 preview with
  `?actorpreview=a4-guard-carry-family`, which preloads and selects the correct
  row for all four directions while leaving ordinary URLs untouched.
- Expanded the live browser gate to verify every direction in Actor Muster and
  on an actual guard carrier in the settlement.

## Mechanical Result

- Flattened rows: `8/8`
- Distinct frames: `64/64`
- Direction rows visually distinct: `4/4`
- Finished-frame/row mirrors: `0`
- Median body height: `76px` in every row
- Ground root: `[32,79]`
- Reserved clear rows: `80-83`
- Row analyzer warnings/errors: `0`
- Runtime palette ceiling: `48` colors
- Runtime alpha values: exactly `0` or `255`
- Independent clean rebuild: byte-identical
- Actor Muster directions: `4/4` use the A4 preview
- Settlement directions: `4/4` use the exact zoom-matched tier
- Ordinary URL preview assets: `0`

## Visual Decision

The complete carry family is coherent enough to remain the actor-system
direction: the same helmet, blue tunic, face/back-of-head, hands, boots,
lighting, scale, and cargo language survive every turn at actual game size.
The front/back gait is intentionally compact and grounded rather than wide or
floaty. It is a candidate family, not yet accepted production art; the guard
must be reviewed across idle, walk, work, and carry before promotion.

## Evidence

Generated proof:

- `assets/sprites/prototypes/actor-pose/output/a4-guard-family/proof/guard-carry-four-directions-x3.png`

Runtime evidence is written to the gitignored
`tmp/actor-a4-vertical-slice/` directory:

- `live-canvas.png`
- `live-world.png`
- `report.json`

## Verification

```sh
python3 scripts/actor-pose-prototype/a4_guard_family.py --verify
python3 scripts/actor-pose-prototype/verify_a4_guard_family.py
scripts/sprite-row verify
node scripts/verify-actor-vertical-slice.mjs
```

## Next

Add a direction-aware, handed short-sword source and sentinel gate, then
compile the guard's idle, walk, and work rows from these same modular
authorities. Review all four actions and all four directions together before
accepting the family into the production atlas.
