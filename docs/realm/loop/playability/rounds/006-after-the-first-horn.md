# Round 006 — After The First Horn

Date: 2026-08-08
Runtime: Realm `190`
Simulation epoch: `4`

## Product diagnosis

Round 005 made the first settlement and muster truthful, but the raid still
exposed three gaps in the fantasy. Citizens could be protected by abstract state
instead of physically reaching shelter; victory ended at the battle with no
authored next decision; and painted defenders fought procedural enemy blobs.
The raid calendar could also pre-empt its own chapter, while fresh Era II games
could not serialize their non-contiguous era history.

The release thesis remains **living frontier defense**. Danger must travel
through the same world as work and sleep, the first battle must create a visible
strategic consequence, and opposing forces must be readable at play scale.

## Shipped vertical slice

- A realm-wide raid alarm interrupts safe work and sends each housed citizen to
  the walkable portal of their own completed House. They remain visible and
  vulnerable while travelling. Only a real portal arrival enters
  `sheltered`/indoors state; blocked or homeless citizens visibly flee.
- Indoor residents leave the world draw, crowd pressure, hit testing, and enemy
  civilian damage together. The House panel reports current occupancy and
  sheltering. When danger clears, survivors exit, become selectable again, and
  resume sleep or work without silently discarding delivery obligations.
- The resolved First Muster presents exactly three exclusive recovery
  doctrines. **Rebuild** requires one additional operational food workplace,
  **Fortify** requires a new wall or tower on the remembered attack edge, and
  **Explore** requires another Founder scouting find. Each records a same-tick
  scalar baseline, persists flat save-safe flags, and supplies no free resources
  or population.
- Military victory now requires completing the chosen recovery doctrine. The
  UI latches the choice to one primary action. Rebuild opens an existing
  non-operational food workplace when useful and otherwise starts Farm
  placement; Fortify starts Wall placement. The phone mission opener is a native
  semantic control with a `44px` minimum target.
- The first military raid is deferred until the rally step is complete. The HUD
  suppresses its numeric countdown while gated, then gives the intended runway;
  the Founder's scouted direction is the direction that actually spawns. Fresh
  Era II state now initializes contiguous era history and serializes immediately.
- Enemy bodies and weapons are fully painted. Ash reaver, iron lancer, and bone
  breaker cover idle, walk, attack, and retreat in all four directions:
  `48` rows / `384` frames. Four exact runtime tiers, binary alpha, bounded
  palette, edge clearance, deterministic packing, source provenance, and live
  browser selection are mandatory gates. Threat rings and HP bars remain.
- Enemy terminal death still resolves before any action. Fixed-seed normal First
  Muster combat retains all three rallied swordsmen in `32/32` trials, while
  exact-once loot, rival rewards, stats, projectile detachment, and civilian
  survival accounting remain covered.

## Verified evidence

New focused gates in the Realm release suite:

```sh
python3 scripts/build-enemy-sprites.py --verify
node scripts/verify-enemy-sprites.mjs
node scripts/verify-enemy-sprites-browser.mjs
node scripts/verify-raid-shelters.mjs
node scripts/verify-raid-shelters-browser.mjs
node scripts/verify-first-muster-raid-gate.mjs
node scripts/verify-post-raid-recovery.mjs
node scripts/verify-post-raid-recovery-browser.mjs
```

The strict save, save/continue, determinism, combat, ownership, building,
responsive, module-graph, sprite, navigation, and browser gates remain part of
the same `67`-check suite. The reviewed simulation-v4 fixture intentionally
records six additional residents surviving its canonical raid; same seed and
commands remain byte-identical.

## Release blockers that remain

1. **Physical food and storage.** Hunger still consumes a global resource
   wallet. Storehouses need owned inventories, reachable eating, shortages, and
   raider plunder before logistics feels as grounded as shelter and work.
2. **Remaining actor identity debt.** Trader, innkeeper, scholar, and forager
   still share literal palette-derived geometry across `64` rows. Older modular
   front/back gaits remain restrained.
3. **Combat tactics beyond the opening proof.** Hard-mode survival, focus-fire,
   formations/stances, and retreat readability need ordinary-world evidence and
   sharper player agency.
4. **Campaign depth after recovery.** The doctrine is a meaningful first fork,
   but its completion does not yet create a differentiated second act, rival
   response, or sustained pressure curve.

Realm now has a materially stronger opening loop: build a functioning
settlement, enlist named people, scout and rally, survive with physically
sheltered residents, then choose what the victory means. It is closer to the
Stronghold/Warcraft II target, but the physical-logistics and second-act gaps
remain release blockers rather than hidden polish work.
