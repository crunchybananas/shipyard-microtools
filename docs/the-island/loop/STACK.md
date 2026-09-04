# THE STACK — Persistent Asynchronous World Contract

The stack is ABYME's multiplayer layer. Players do not share a live simulation.
They inherit physical evidence of acts completed on shallower strata.

The governing rule is simple:

> A change made above is not erased. Its cost is displaced downward.

This rule is fully playable offline. A shared source changes whose traces arrive,
not how the game works.

## Terms

- **Rung:** one stratum of the island.
- **Hand:** a stable, pseudonymous actor in the ledger.
- **Mark:** one recorded world-changing act by one hand on one rung.
- **Draft:** the water a rung inherits from costed marks above it.
- **Writing:** a short shore line that travels downward with zero draft.
- **Disposition:** the final operation that decides what relation remains between
  rungs.

The surface inherits nothing and therefore begins at its authored tide. Each lower
rung begins at its authored tide plus bounded inherited draft.

## What becomes a mark

Only acts that reach through the model or leave the world altered carry cost:

| Kind | Meaning |
|---|---|
| `valve` | moved the sea |
| `crank` | moved the hour |
| `ruler` | made the bridge |
| `lens` | made the night lamp possible |
| `chest` | left the flats chest open |
| `hatch` | opened the buried route |
| `stones` | changed the standing-stone state |
| `plumb` | completed the crossing instrument |
| `dive` | created access to another rung |
| `writing` | left words for a lower hand; zero draft |

Reading, looking, and most encounter flags are free. Adding a progression flag does
not imply cost; only `FLAG_MARKS` is authoritative.

A mark is idempotent by `(hand, rung, kind)`. Repeating the same mechanism cannot
farm draft or flood a lower player.

## Data contract

`ledger.js` is dependency-free and owns the pure contract:

```text
ledger = {
  v,
  marks: [{ k, r, h, n, at?, t? }],
  ops: [{ k, r, h, n }]
}
```

- `k`: allowed mark kind.
- `r`: rung.
- `h`: compact hand ID.
- `n`: logical operation clock for stable order and merge supersession.
- `at`: optional clamped world position.
- `t`: sanitized text, present only for writing.

`ops` contains dispositions. CARRY is a durable per-hand high-water tombstone:
marks at or below its clock stay retired when stale copies merge later. OPEN and
CLOSE share one last-writer register per rung, so both can never be active at the
same boundary. TEND is an inert but explicit acknowledgement.

There are no player names, profiles, wall-clock timestamps, chat channels, or
movement streams.

## Inheritance

Standing on rung `n`, a player inherits valid marks from rungs above it. Their
draft adds to the authored tide and their visible subset becomes worn evidence in
the world.

The stack is bounded:

- at most 64 costed marks per rung;
- at most 8 shore writings per rung;
- at most 0.75 total inherited draft;
- positions clamped to the playable extent;
- unknown kinds, malformed rungs, duplicate identities, empty writing, and invalid
  disposition arrays removed during sanitation.

Bounds are game design and threat protection at the same time. A popular or hostile
stack must remain playable.

## How the history appears

The ledger is never presented as a social feed.

- Costed marks raise the water on lower strata.
- Evidence-bearing marks become stable scuffs near where a hand acted.
- A dead L2 valve can replay an inherited valve act across model, room, and bay.
- The tide gauge measures authored level plus accumulated draft.
- The L3 register counts distinct hands rather than inventing a narrator.
- One short shore line per hand and rung weathers into the next level without adding
  water.

The player encounters consequences first and provenance second.

The Upstream Hand records those two moments independently in run state. Its
`upstreamHandSurged` flag commits the permanent L2 rise when the bay moves;
`upstreamHandWitnessed` records the later reveal that can satisfy progression. A
reload between them may replay the reveal, never the cost.

## Dispositions

The Lower Hand encounter reveals a four-position physical index. Selection happens
at the source; application happens only after the player climbs back and commits at
the surface plate.

### Tend

Leave existing marks and transfer boundaries unchanged. Tend adds no final mark.

### Carry

Remove this hand's marks from the ledger. Lower strata inherit less water because
the player reverses their own interventions. The coda reports the actual number
removed.

### Open

Keep existing marks and open the selected rung to backflow from below. Deeper cost
can travel upward at half weight. Connection has a visible cost on both sides.

### Close

Keep existing marks but seal the selected rung. Marks at or above the deepest seal
no longer reach lower inheritors. The boundary holds by becoming smaller.

These are operations, not scores. The final camera and light do not reward one over
another.

## Local-first source

`world.js` always boots with `localSource`:

- `abyme-ledger-v2` stores the local sanitized ledger;
- `abyme-hand-v1` stores an eight-hex local hand;
- reads and writes are synchronous;
- a run wipe does not clear either key.

This is the complete single-player game: the player's own earlier work becomes the
history inherited below.

## Shared source

The current Firebase transport publishes marks only. Shared activation is therefore
disabled: a partial transport would make CARRY appear durable locally and then let
a later remote merge resurrect the retired marks. Enabling it requires an explicitly
authorized append-only disposition collection, authenticated rules, a durable local
outbox for both record types, and bounded per-rung reads. Until that complete
contract exists, the game remains honestly and fully local.

## Source interface

Consumers depend on behavior, not storage:

```text
load()                         → sanitized local mirror
pushMark(mark)                 → persist one mark fact
pushDisposition(operation)    → persist one disposition operation
sync(rung)                     → reconcile relevant upstream marks when supported
clear()                        → clear only the local view
uid()                          → authenticated hand when shared
```

World and puzzle code must not reach into Firebase, localStorage, or raw ledger
payloads directly.

## Lifetime boundaries

Run state and stack state are intentionally independent:

- `abyme-save` stores the current playthrough and Field Notes.
- The ledger stores cumulative acts and writings.
- Begin again starts a new run but leaves the world history standing.
- `ABYME.clearStack()` is an explicit developer action.
- Clearing a local shared mirror never deletes other hands' remote marks.

This separation is part of the fiction and the architecture.

## Extension rules

Future multiplayer work must preserve these properties:

- asynchronous traces, never required co-presence;
- offline completeness;
- stable, sanitized, bounded payloads;
- idempotent acts;
- world consequences before social metadata;
- no trusted client input;
- no UI-only multiplayer state that bypasses the ledger;
- dispositions implemented as real ledger operations;
- shared state never required to solve a gate.

Add a mark kind only when a world-changing act deserves downstream cost. Add a
network feature only when its absence leaves the same complete route playable.
