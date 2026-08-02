# Round 003 — Citizen Work Orders

Date: 2026-08-02

Runtime revision: 187

## Outcome

Promoted direct citizen workplace assignment from a nearly unreachable control
to an ordinary gameplay surface. The population roster now lets the player move
an already-employed citizen straight to any open workplace, labels automatic
choices as **AI assigned**, labels direct choices as **Crown order**, and offers
an explicit **Return to AI** action.

Automatic staffing remains the default. Its utility score still considers
distance, food supply, active construction, the Hall of Ages, current vocation,
and job stability. A valid Crown order now wins over job-market and food-crisis
reallocation, while personal needs, sleep, cargo delivery, danger response, and
unreachable-path recovery remain citizen-owned. The balance is deliberate:
player strategy owns the workplace, but does not turn the citizen into a puppet.

## Live Reproduction

Realm 186 already had an `ASSIGN_CITIZEN` command and a population-panel select,
but the select rendered only while a citizen had no assignment. In an ordinary
New Game the AI claimed the first Farm immediately, leaving the roster with an
unlabeled release `✕` and no way to choose a different employed citizen or move
that worker directly. Releasing the worker briefly exposed `Assign to…`, then
returned them to the same automatic market.

The result felt entirely passive even though part of the command foundation was
present: the useful control disappeared exactly when there was a real staffing
decision to make.

## Gameplay Contract

- **AI by default:** an un-ordered citizen uses the deterministic utility-scored
  job market and may shift to food work during a sustained shortage.
- **Direct workplace order:** choosing an open workplace replaces the current
  assignment atomically; there is no unassigned race window.
- **Stable identity:** a Farmer ordered to help at a Lumber Mill stays a Farmer.
  The cross-vocation assignment is explicitly temporary rather than silently
  retraining or changing actor art.
- **Smart autonomy:** ordered citizens continue to eat, sleep, deliver, flee,
  and recover from unreachable routes.
- **Visible ownership:** roster rows, citizen details, and building crews show
  whether AI or the player owns the current work choice.
- **Explicit handback:** Return to AI releases the Crown order and immediately
  re-enters automatic staffing.

Permanent vocation training/retraining, building-level labor priorities,
off-duty policy, and deterministic swaps between two full workplaces remain
future workforce systems. This round does not fake them through profession
morphing or over-capacity assignments.

## Changed Surface

- `js/ui.js` renders work-order controls for employed and unemployed citizens,
  supplies immediate order/handback feedback, refreshes the open roster on real
  assignment transitions, and identifies ordered building crews.
- `js/citizens.js` excludes `player-command` assignments from automatic
  food-crisis reassignment while retaining all survival and recovery behavior.
- `js/input.js` identifies Crown orders in the selected-citizen detail panel.
- `index.html` widens the desktop roster into a legible workforce ledger and
  stacks it into phone cards with 44px work controls and no horizontal scroll.
- `scripts/verify-citizen-work-orders-browser.mjs` is included in the Realm
  release suite.

## Save Contract Decision

No save or simulation version changes. The authoritative assignment already
stores, validates, hashes, and round-trips its causal `reason`; `player-command`
was already a current allowed value. Realm 187 uses that existing provenance as
the Crown-order signal and adds no citizen field, optional compatibility slot,
migration, dual schema, or alternate assignment owner.

## Focused Evidence

The browser gate starts a real New Game and proves:

- an AI-employed Farmer can be ordered directly from Farm to an open Lumber Mill;
- the old Farm slot is released and the new Lumber slot is claimed atomically;
- the citizen remains a Farmer and the mismatch is shown as temporary help;
- a sustained food crisis moves an AI-managed non-food worker onto the open
  Farm while leaving the Crown-ordered Lumber worker intact;
- Save, reload, and Continue preserve actor ID, workplace, and player provenance;
- Return to AI resumes a non-player automatic assignment;
- desktop feedback and roster state are immediately legible; and
- at `390x844`, the roster has no horizontal overflow and both select/button
  targets are exactly 44px high.

Proof frames:

- `tmp/citizen-work-orders/desktop-crown-order.png`
- `tmp/citizen-work-orders/phone-crown-order.png`

Focused gates:

```sh
node scripts/verify-engine-v2-citizen-ownership.mjs
node scripts/verify-citizen-work-orders-browser.mjs
node scripts/verify-engine-v2-ownership-browser.mjs
node scripts/runtime-revision.mjs --check
node scripts/verify-module-graph.mjs
```

The final promotion gate, `node scripts/verify-realm.mjs`, passed all 49 checks,
including the work-order browser proof, deterministic ownership and saves,
autonomous citizen lifecycle, navigation, and mixed-traffic correctness.

## Deployment

Realm 187 is the publication checkpoint for this round. GitHub Pages deploys
the canonical `docs/` tree from `main` through the repository's Build & Deploy
workflow.
