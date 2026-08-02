# Current Playability And Cleanup Handoff

Date updated: 2026-08-02

Current live checkpoint: Realm `187`

Production graphics are intentionally paused at
[`../graphics/PAUSE_AND_RESUME.md`](../graphics/PAUSE_AND_RESUME.md). The active
focus is gameplay feel, responsive UX, movement correctness, and removal of
old or surprising behavior that no longer fits the game.

## Fixed Architecture

- The game remains a two-dimensional Canvas2D settlement renderer with painted
  raster atlases. WebGL2 is fullscreen post-processing only.
- There is no active Three.js/3D world path. The old live diorama renderer was
  deleted in graphics round 002; historical 3D notes are not a roadmap.
- Do not reopen renderer exploration during ordinary gameplay or cleanup work.
  The later engine roadmap allows a GPU comparison only after renderer purity
  and a feature-equivalent measured benchmark.

## Completed Cleanup: Hot-Air Balloon Retirement

Round 001 removed the legacy procedural hot-air balloon completely. The live
updater, balloon renderer, screen-space shadow renderer, imports, calls, state
initializer, and save allowlist entry are gone.

The save decision is an intentional clean cut with no compatibility slot and
no save-version bump. Balloon state was resettable presentation state and was
already excluded from serialized saves, so valid Realm 184 saves remain valid
while no current New Game, Save, Load, or Continue surface carries the field.

The browser gate now fails if any of the five live source surfaces retain the
retired token. It also runs ordinary daytime play at `4x` through the old
tick-1200 forced-spawn point, then proves the state is absent from New Game,
Save, reload, and Continue. The full 47-check Realm 185 suite passes. See
[`rounds/001-balloon-retirement.md`](rounds/001-balloon-retirement.md).

## Completed Responsive Slice: Phone Build Mode

Round 002 established a fresh desktop, tablet, and `390x844` evidence set, then
fixed the first coherent surface: touch build-mode lifecycle and gesture
arbitration. A selected build now exposes a reachable 44px-or-larger Cancel
control. A tap places, a one-finger drag pans without placing, and pinch zoom
does not place or leave the camera dragging. Ordinary building selection still
works after Cancel. The focused phone gate is part of the Realm release suite.
See [`rounds/002-responsive-build-mode.md`](rounds/002-responsive-build-mode.md).

## Completed Gameplay-AI Slice: Citizen Work Orders

Round 003 turns the hidden citizen-assignment command into an ordinary gameplay
surface. The population roster now distinguishes AI assignments from Crown
orders, lets the player move an employed citizen directly to any open workplace,
and makes Return to AI explicit. Building and citizen panels expose who controls
the current job.

Automatic staffing remains the default and still weighs travel distance, food
pressure, construction, and vocation fit. A Crown order is not silently erased
by that utility scorer or by food-crisis reallocation; the citizen still handles
food, sleep, cargo, danger, and bounded path recovery. Orders survive Save and
Continue through the existing assignment provenance field, so the save schema
and versions do not change. See
[`rounds/003-citizen-work-orders.md`](rounds/003-citizen-work-orders.md).

## Ranked Work Now

1. **Workforce intelligence continuation.** Add building-side staffing controls,
   job priorities, explicit off-duty policy, and deterministic full-slot swaps.
   Keep permanent vocation retraining separate from workplace orders so citizen
   identity does not morph as a side effect of temporary help. Use visible AI
   reasons and preserve the rule that needs and unreachable-path recovery can
   interrupt execution without silently rewriting valid player strategy.
2. **Responsive UX continuation.** Remove the invisible advisor hit target that
   can block phone title actions after the tip fades. Then restore ordinary
   keyboard focus by retiring the global Tab interception, correct the tutorial
   step contracts, make tablet HUD overflow legible, resolve phone minimap/build
   bar overlap, and raise the remaining undersized touch targets. Keep shipping
   one reproduced surface at a time from the Round 002 queue.
3. **Crowd-safe NPC movement.** Reproduce remaining player-visible miner or
   town-crowd failures before changing the kernel. On Realm 187, both strict
   navigation gates are green with zero known fixture defects: weighted route
   cost, dynamic-obstacle invalidation, head-on/doorway separation,
   intersection capacity, and mixed-actor separation all pass. Extend the
   deterministic fixtures for any new live failure; cosmetic separation is
   not a substitute for a movement invariant.
4. **Gameplay-friction playthrough.** Run a fresh peaceful settlement through
   the tutorial, first production chain, housing growth, first research, and
   save/continue. Rank moments where the player lacks feedback or where a click
   does not produce an immediate, legible response.
5. **Measured render responsiveness.** Re-profile the entities/world pass at a
   living-town workload. Cull before sorting and cache static work only from
   measurements; retain Canvas2D unless a feature-equivalent alternative wins.
6. **Dead-code and surprise audit.** Trace ambient systems, old feature flags,
   stale imports/exports, unreachable UI, redundant state, and archived
   renderer assumptions. Remove one proven-dead slice at a time with tests.

## Existing Evidence To Reuse

```sh
node scripts/verify-navigation-crowd-baseline.mjs
node scripts/verify-phase0c-traffic-baseline.mjs
node scripts/verify-browser-save-shell.mjs
node scripts/verify-engine-v2-citizen-lifecycle-browser.mjs
node scripts/runtime-revision.mjs --check
node scripts/verify-realm.mjs
```

The traffic fixtures remain the promotion gates for movement changes. Their
strict modes both pass on Realm 187, while the Realm 165 measurements remain
the last formal performance baseline. Read `../engine-v2/CURRENT.md` before
changing ownership, save, or navigation surfaces.

## Definition Of Progress

A cleanup round counts only when a player-visible problem is reproduced,
changed in the ordinary game, protected by focused evidence, included in the
release suite where practical, and deployed. Documentation-only surveys are
useful when they produce a ranked, reproducible queue; repeated broad audits
without a shipped fix are not the default cadence.
