# Round 001 — Hot-Air Balloon Retirement

Date: 2026-08-01

Runtime revision: 185

## Outcome

Removed the legacy procedural hot-air balloon and its projected shadow from
ordinary Realm gameplay. The release keeps the canonical Canvas2D settlement
renderer and does not replace the decoration with a hidden flag, transparent
draw, compatibility slot, or alternate renderer path.

## Live Reproduction

Realm 184 initialized `G.balloons` for every New Game. During daytime,
`shellTick()` called `updateBalloons()`; at each 1,200-tick boundary a low
`Math.random()` value spawned one. `render()` drew the screen-space envelope,
while the enhancement registry separately drew its projected screen-space
shadow.

The focused browser proof preserves those former spawn conditions: a daytime
New Game runs at `4x` with `Math.random()` fixed to `0.1` until after tick
1,200. Realm 185 crossed tick 1,224 during the full release run with no retired
state and no live renderer capable of drawing the object or its shadow.

## Removed Paths

- Deleted `updateBalloons()`, `renderBalloons()`, the color table, and
  `renderBalloonShadows()` from `js/enhancements.js`.
- Removed the updater import/call from `js/main.js` and draw import/call from
  `js/render.js`.
- Removed the presentation-state initializer and ownership entry from
  `js/state.js`.
- Removed the obsolete root-surface name from `js/save-state.js`.
- Advanced every canonical runtime URL to Realm 185.

## Save Contract Decision

This is an intentional clean cut with no compatibility slot and no save schema
or simulation-version bump. Balloon state was resettable presentation state,
not authoritative simulation state, and the Realm 184 serializer already
excluded it from stored payloads. Therefore valid Realm 184 saves contain no
balloon field and continue under Realm 185 without a migration. A current
New Game, serialized Save, Load, and Continue never recreate the property.

## Regression Evidence

`scripts/verify-browser-save-shell.mjs` now:

- scans the live enhancement, main, render, state, and save-state sources and
  fails if the retired token returns;
- proves a daytime New Game has no retired state;
- runs the ordinary shell at `4x` through the old forced-spawn point;
- proves the serialized payload has no retired field; and
- reloads and Continues without recreating it.

Focused checks passed:

```sh
node scripts/runtime-revision.mjs --check
node scripts/verify-module-graph.mjs
node scripts/verify-engine-v2-save.mjs
node scripts/verify-save-continuity.mjs
node scripts/verify-determinism.mjs
node scripts/verify-browser-save-shell.mjs
```

The final `node scripts/verify-realm.mjs` run passed all 47 release checks,
including strict navigation and mixed-traffic correctness, deterministic
simulation, save continuity, browser New Game/Save/reload/Continue, and every
runtime rendering gate.

## Deferred Work

No responsive HUD, input, movement, or renderer architecture was changed in
this cleanup. The next round is the responsive UX baseline across desktop,
tablet, and `390x844`, fixing one reproduced surface at a time.

## Deployment

Realm 185 is the publication checkpoint for this round. GitHub Pages deploys
the canonical `docs/` tree from `main` through the repository's Build & Deploy
workflow.
