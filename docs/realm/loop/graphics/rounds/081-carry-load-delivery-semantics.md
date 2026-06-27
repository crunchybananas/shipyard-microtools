# 081 - carry-load-delivery-semantics

## Goal

Continue the character animation/behavior quality push by fixing two live
lumberjack issues: the carried wood looked like an odd generic blob, and a
worker could say `Delivered!` even when there was no valid delivery destination.

## Changes

- Replaced the generic carried-resource oval with a shared material-specific
  carry overlay for all actor roles.
  - Wood now draws as a small strapped log bundle.
  - Stone and iron draw as compact block loads.
  - Food and gold draw as small pouch loads.
- Carrying citizens now use the `carry` action even while paused, and stationary
  non-work carry poses hold frame `0` instead of cycling a walk strip in place.
- Added a real `needs_delivery` citizen state.
  - If a worker picks up resources and no valid drop-off exists, they keep the
    load, do not add resources, and show `Need storage`.
  - When a valid drop-off later appears, the same worker switches to
    `walk_to_deliver`.
- Delivery destinations no longer fall back to any building. Wood, stone, and
  iron require a storehouse, granary, or house; food requires granary,
  storehouse, or house; gold requires market, storehouse, or house.
- Hover status now displays `Needs storage` for the waiting carrier state.

## Verification

Commands run:

```sh
node --check js/citizens.js
node --check js/render.js
node --input-type=module <state-machine delivery probe>
node scripts/build-motion-atlases.mjs
node scripts/verify-anim.mjs
node scripts/verify.mjs --game --logic
node scripts/verify-critic.mjs
```

Delivery probe result:

- With only a lumber mill, a worker carrying produced wood entered
  `needs_delivery`, kept `wood:3`, left global wood unchanged, and emitted
  `Need storage`.
- After adding a storehouse, the same worker switched to `walk_to_deliver` and
  requested the storehouse coordinates.

Browser:

- Refreshed the visible in-app browser at
  `http://127.0.0.1:4711/index.html?carrypolish=...`.

## Remaining Issues

- The shared carry overlay improves all carriers, but dedicated carry frames
  per role/resource would be better than overlay composition.
- Broader actor quality work remains: role-specific work rows should be
  repainted progressively, with `lumber/work/down` and `lumber/work/up` still
  the highest-priority placeholders.
