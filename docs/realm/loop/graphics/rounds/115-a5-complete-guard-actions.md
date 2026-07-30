# Round 115 - A5 Complete Guard Action Family

## Goal

Replace the guard's mixed idle, walk, work, and carry art systems with one
crisp, consistent, reviewable modular family before any production promotion.

## Changes

- Added a hash-locked A5 action-family contract covering four actions, four
  directions, sixteen single-row animation files, and 128 frames.
- Kept A4's watchman identity, watch-blue garment, directional painted
  components, corrected crate views, body scale, ground root, and runtime
  palette authority.
- Authored a planted idle breath/weight loop and a grounded walk with
  counter-swinging arms.
- Preserved the exact A4 carry body and load-socket chronology.
- Generated one project-bound painted guard short sword with front, back, and
  side views. Stored the keyed source, transparent source, prompt/provenance,
  crop boxes, and hashes.
- Authored a planted eight-phase sword drill. The weapon attaches only to the
  right-hand socket, and the extension sentinel must point down, up, left, or
  right according to the row.
- Replaced a degenerate raised-forearm pose found by the first compiler run
  with an evenly spaced shoulder/elbow/wrist/hand chain before rasterization.
- Split validation into body and equipment measurements so sword reach cannot
  disguise body scale drift.
- Emitted body, identity, garment, equipment, semantic-mask, landmark, quality,
  proof, palette, and exact runtime-tier artifacts for every row.
- Added an independent source/output/hash/clean-rebuild verifier.
- Expanded the opt-in renderer preview to the whole family under
  `?actorpreview=a5-guard-actions`.
- Expanded browser verification to draw all sixteen rows in Actor Muster and
  every carry direction on an actual settlement guard.
- Kept all sixteen warning-free rows in the self-contained A5 review tree. A
  staging rehearsal exposed that the v1 actor-row manifest cannot represent a
  locked production row and its replacement candidate simultaneously; the
  rehearsal writes were removed so a future clean atlas build cannot silently
  fall back to older base pixels. No A5 row was accepted or compiled into the
  normal production atlas.

## Mechanical Result

- Flattened rows: `16/16`
- Distinct frames: `128/128`
- Direction rows visually distinct per action: `4/4`
- Finished-frame/row mirrors: `0`
- Median body height: `76px` in every row
- Cross-action and cross-direction height spread: at most `1px`
- Ground root: `[32,79]`
- Reserved clear rows: `80-83`
- Flattened/body analyzer warnings and errors: `0`
- Work equipment state: sword only
- Carry equipment state: cargo only
- Sword right-hand socket checks: `32/32`
- Directional extension checks: `4/4`
- Runtime palette ceiling: `48` colors
- Runtime alpha values: exactly `0` or `255`
- Independent clean rebuild: byte-identical
- Actor Muster preview rows: `16/16`
- Settlement carry directions: `4/4`
- Ordinary URL preview assets: `0`

## Visual Decision

A5 closes the cross-action identity and scale gap: the helmet, tunic, face,
back-of-head, arms, boots, lighting, body proportions, and ground registration
now survive both turns and action changes. The family remains candidate art
because the final production decision should review animation transitions and
whether one baked crate is the correct visual language for all carried
resources. Those questions can now be answered on the real game canvas without
changing the normal player path or weakening the existing locked-row source
contract.

## Evidence

Generated proof:

- `assets/sprites/prototypes/actor-pose/output/a5-guard-actions/proof/guard-four-actions-x3.png`

Runtime evidence is written to the gitignored
`tmp/actor-a5-vertical-slice/` directory:

- `live-canvas.png`
- `live-world.png`
- `report.json`

## Verification

```sh
python3 scripts/actor-pose-prototype/a5_guard_actions.py --verify
python3 scripts/actor-pose-prototype/verify_a5_guard_actions.py
scripts/sprite-row verify
node scripts/verify-sprite-source-contract.mjs
node scripts/verify-actor-vertical-slice.mjs
```

## Next

Inspect close action transitions and resource-specific cargo semantics. Promote
the complete guard family together only if that live review stays green. Add
candidate-plus-locked coexistence to the row manifest before staging another
replacement for an accepted row, then use the same source-unit and gate
structure for the next actor identity.
