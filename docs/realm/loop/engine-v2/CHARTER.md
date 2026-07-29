# Realm Engine v2 Council Charter

## Purpose

The council challenges each Engine v2 slice before implementation and judges
the evidence afterward. Its role is to prevent a technically attractive
rewrite from damaging Realm's determinism, persistence, performance, or living
town character.

The council is advisory unless a reviewer issues a veto against a named
invariant or promotion gate. A veto pauses promotion until the objection is
resolved, recorded as accepted risk, or explicitly overridden by the owner.

## Roles

- **Terra — world and character council.** Reviews NPC autonomy, stable
  identity, professions, schedules, relationships, interactions, navigation,
  crowd legibility, emergent play, and whether the settlement still feels
  alive rather than mechanically perfect and sterile.
- **Luna — engine and evidence council.** Reviews deterministic architecture,
  ownership boundaries, current-schema persistence, renderer purity,
  performance, browser/runtime strategy, test validity, library value, and
  rollback safety.
- **Primary implementer.** Proposes slices, reconciles the two reviews,
  implements approved work, maintains a playable build, and records evidence
  and decisions. The primary does not silently discard council objections.

Terra and Luna review independently. Neither is asked to reach consensus before
submitting a verdict.

`CONVERSATIONS.md` is the durable, human-readable council record. Each council
session appends the question posed, each reviewer's position and pushback, the
evidence discussed, unresolved disagreements, and the primary decision. It is
an editorial meeting record rather than a raw transcript or hidden reasoning
dump, so it remains concise and useful as the architecture evolves.

## Non-negotiable actor model

Realm keeps one deterministic scheduler. Each NPC owns durable mind-state and
makes decisions through a pure brain surface; no NPC owns an asynchronous
timer, browser loop, worker, or unrestricted world mutation.

```text
read-only world view -> NPC brain -> intents -> deterministic world resolver
                                              -> outcomes and committed state
                                              -> presentation snapshot
```

The NPC owns identity, profession, traits, needs, memories, relationships,
goals, plan, and inbox. The world owns coordinates, collision, reservations,
job capacity, inventories, transfers, interactions, spawning, death, and
conflict resolution. The renderer only observes an explicit presentation
snapshot.

## Review cadence

Each major phase or vertical slice follows this loop:

1. Write a short RFC using `RFC_TEMPLATE.md`.
2. Capture the relevant baseline and failure reproduction.
3. Terra and Luna review independently.
4. Record and reconcile objections; revise the RFC when required.
5. Implement one direct replacement slice. Keep rollback in source control;
   do not retain the superseded runtime path as an adapter or flag branch.
6. Run deterministic, save, behavioral, navigation, browser, and performance
   gates appropriate to the slice.
7. Terra and Luna perform a closure review against the evidence.
8. Append the conversation and resolution to `CONVERSATIONS.md`.
9. Promote, revise, or roll back the slice before beginning the next one.

The council reconvenes at phase proposal, first playable vertical slice, and
promotion. It does not block routine implementation details already covered by
an approved RFC.

## Verdicts

- `APPROVE` — all applicable invariants and gates are satisfied.
- `APPROVE WITH CONDITIONS` — implementation may proceed, but promotion is
  conditional on explicitly listed evidence.
- `VETO` — a named invariant, correctness requirement, or measured gate has
  failed. The veto must include a reproducible reason and a path to reconsider.

Passing existing tests or producing a good screenshot is never sufficient by
itself. Council dissent and the primary's resolution are permanent project
records.

## Slice requirements

Every RFC must state:

- the player-visible outcome;
- retained and replaced boundaries;
- invariants and failure modes;
- data/schema and save implications;
- deterministic ordering and randomness rules;
- performance budget and measurement method;
- cutover boundary, code-deletion plan, and source-control rollback point;
- library justification, when applicable;
- automated and playable acceptance scenarios.

“Cleaner architecture” without a player-facing, correctness, scalability, or
maintenance outcome is not sufficient justification.
