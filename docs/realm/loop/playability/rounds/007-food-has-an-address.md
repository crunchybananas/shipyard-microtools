# Round 007 — Food Has An Address

Date: 2026-08-08
Runtime: Realm `191`
Simulation epoch: `4`

## Product diagnosis

The living-building and raid work made labor, sleep, shelter, enlistment, and
combat spatial, but food still crossed the world as a global number. Citizens
could eat remotely, Storehouses did not own what their panels implied, and a
raider striking an empty wall could steal abstract goods from the realm.

The release thesis for this round is **visible logistics**: production is not
owned until somebody carries it to a real place, hunger is not resolved until a
body reaches that place, and plunder can remove only what the attacked building
actually contains.

## Shipped vertical slice

- Every fresh realm receives one free completed Founder Stockpile near the
  starting clearing. It adopts exactly the scenario's starting food without
  minting a second copy. Its capacity is `120`; ordinary Storehouses hold `40`,
  Granaries `30`, and completed House pantries `8`.
- `G.resources.food` remains available to existing affordability and UI code,
  but it is now an exact aggregate mirror of food in live completed stores.
  Producer buffers, carried cargo, and raider bags remain outside that mirror
  until a successful deposit.
- Hungry citizens safely interrupt exterior work, route to a reachable
  Storehouse/Granary or their own private House pantry, withdraw one ration only
  after physical arrival, eat, and resume the same assignment. Crown orders are
  preserved. Empty and unreachable stores create a readable bounded
  `waiting_for_food` state without remote withdrawal.
- Food deliveries use the same Manhattan-distance/building-order authority and
  real path reachability. Partial deposits preserve the remainder and reroute.
  Empty private Houses reject automatic provisioning; occupied homes remain
  valid. Foraging produces cargo rather than wallet food.
- Farms now buffer one direct ration and three wheat per cycle. Workers haul one
  resource key per trip without erasing the other, so the opening Farm is
  truthful while windmill and bakery processing remains the larger food chain.
- Recruitment, food-cost research, Wonder bills, trade, events, missions, and
  production rewards use the inventory authority. Imports fail before payment
  when no capacity exists. Manual demolition relocates what fits and destroys
  overflow exactly once; fire and raids destroy remaining local stock.
- Raiders withdraw only from the building they physically strike. Walls and
  empty structures create no loot or plunder progress. Slain raiders return only
  what fits in live storage; unrecovered overflow is reported and lost exactly
  once, and the raid ledger cannot leak into the next attack.
- Panels report each local `food/capacity` value and name the Founder Stockpile.
  The HUD reports physical store count/capacity and tells the player that
  citizens walk there. The free stockpile is excluded from authored tutorial,
  achievement, story-milestone, and victory building counts.
- Strict saves persist building inventory and a citizen's live `_foodTarget`.
  Development-era saves without authoritative physical food inventory reject
  cleanly; the runtime carries no save migration or dual-schema path.

## Art completion in the same checkpoint

A16 replaces the trader's complete palette-derived family with a distinct
traveling factor/bookkeeper. Four independent generated authorities feed one
deterministic compiler: identity, hollow madder/teal garment, brass balance,
and grounded ledger counter. A custom brisk gait, separate work semantics, and
the shared baked crate cover `16` rows / `128` frames at all four exact runtime
tiers. Exact-size visual review preceded one atomic promotion.

## Verified evidence

Focused gates added to the release suite:

```sh
node scripts/verify-building-inventory.mjs
node scripts/verify-citizen-food-routes.mjs
node scripts/verify-citizen-food-routes-browser.mjs
node scripts/verify-a16-trader-actions.mjs
```

The reviewed simulation-v4 golden was refreshed only after the new routes were
stable; same seed, commands, and hostile shell schedules remain byte-identical.
The full Realm 191 release suite contains `72` sequential checks.

## Paused release blockers

1. **Combat tactics beyond the opening proof:** hard-mode player evidence,
   focus-fire, formation/stance response, and retreat readability.
2. **Campaign second act:** make Rebuild, Fortify, and Explore change the next
   pressure, unlock, or rival response instead of converging after one task.
3. **Remaining actor identity debt:** innkeeper, scholar, and forager still use
   the older palette-derived geometry.
4. **Responsive and long-play friction:** complete the ranked phone/tablet queue
   and run a fresh peaceful logistics playthrough through winter and recovery.

Realm now has one coherent first-act sentence: build functioning workplaces,
carry harvests into real stores, watch people sleep and eat where they live,
enlist named citizens, scout the attack, shelter the town, repel painted
raiders, and choose what recovery means. The goal is paused here as a deployable
checkpoint, not declared complete.
