# Engine v2 RFC: <slice name>

Status: `DRAFT | COUNCIL REVIEW | APPROVED | IMPLEMENTING | VERIFYING | PROMOTED | ROLLED BACK`

## Player-visible outcome

What becomes more believable, understandable, correct, or responsive?

## Problem and baseline

Include a minimal reproduction, current metrics, affected modules, and why the
existing behavior cannot be safely extended.

## Scope

### Retained

-

### Replaced

-

### Explicitly deferred

-

## Data and ownership

State the authoritative owner of every new datum. Describe stable IDs,
current-schema serialization, world-query inputs, intents, outcomes, and
events. Historical schema migration is out of scope during development.

## Deterministic ordering and randomness

Define decision cadence, conflict ordering, actor-scoped randomness, hashes,
and replay expectations.

## Failure modes and rollback

List expected failures, observability, direct cutover and code-deletion plan,
and exact source-control rollback point. Do not retain a runtime compatibility
adapter for the superseded path.

## Performance and libraries

State the baseline, budget, profiler method, allocation/memory expectations, and
the measured reason for any dependency.

## Acceptance evidence

- Logic/unit fixtures:
- Determinism/replay:
- Current-schema save/load:
- Navigation/crowd:
- Browser/playable scenario:
- Performance/soak:

## Council reviews

### Terra

Verdict: `PENDING`

Objections and conditions:

-

### Luna

Verdict: `PENDING`

Objections and conditions:

-

## Reconciliation and final decision

Record accepted changes, rejected objections with evidence, owner overrides,
and the promotion or rollback decision.

Conversation record: `<link to CONVERSATIONS.md session>`
