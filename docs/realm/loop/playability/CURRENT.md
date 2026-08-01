# Current Playability And Cleanup Handoff

Date opened: 2026-08-01

Starting live checkpoint: Realm `184`

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

## First Cleanup Target: Retire The Hot-Air Balloon Completely

The balloon seen in the live game is not coming from a hidden 3D engine. It is
old procedural Canvas decoration:

- `updateBalloons` and `renderBalloons` in `js/enhancements.js` date to loop 6;
- `renderBalloonShadows` is a later loop-89 screen renderer;
- `js/main.js` still updates it;
- `js/render.js` still draws it;
- `js/state.js` and `js/save-state.js` still include balloon state.

Removal should delete the spawn/update/draw/shadow path and its imports/calls,
then make an explicit save-contract decision. Do not merely make the balloon
transparent or lower its spawn chance. Acceptance evidence:

- no live or saved-state balloon references unless an intentionally documented
  save-compatibility slot is retained;
- deterministic New Game, Save, Load, and Continue pass;
- daytime live play at accelerated speed shows no balloon or balloon shadow;
- the full Realm release suite passes.

## Ranked Work After The Balloon

1. **Responsive UX baseline.** Play the complete opening flow at desktop,
   tablet, and `390x844`; audit HUD density, build-bar reachability, tutorial
   obstruction, panel overflow, touch targets, canvas resize, camera gestures,
   and keyboard-only affordances. Capture specific frames and fix one coherent
   surface at a time. The old mobile audit concluded “usable, not designed”; do
   not assume later additions preserved even that baseline.
2. **Crowd-safe NPC movement.** Continue Engine v2 Phase 2 with the miner
   lifecycle and make the existing red navigation controls pass: weighted
   route cost, dynamic-obstacle invalidation, head-on/doorway pass-through,
   intersection capacity, mixed-actor overlap, deterministic yielding, and
   bounded recovery. This is the durable answer to NPCs walking into one
   another; cosmetic separation is not.
3. **Gameplay-friction playthrough.** Run a fresh peaceful settlement through
   the tutorial, first production chain, housing growth, first research, and
   save/continue. Rank moments where the player lacks feedback or where a click
   does not produce an immediate, legible response.
4. **Measured render responsiveness.** Re-profile the entities/world pass at a
   living-town workload. Cull before sorting and cache static work only from
   measurements; retain Canvas2D unless a feature-equivalent alternative wins.
5. **Dead-code and surprise audit.** Trace ambient systems, old feature flags,
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

The default traffic checks preserve repeatable baselines; their strict
correctness modes remain the promotion gates for the movement replacement.
Read `../engine-v2/CURRENT.md` before changing ownership, save, or navigation
surfaces because its Realm 165 measurements remain the last formal performance
and traffic baseline even though the live module revision is now 184.

## Definition Of Progress

A cleanup round counts only when a player-visible problem is reproduced,
changed in the ordinary game, protected by focused evidence, included in the
release suite where practical, and deployed. Documentation-only surveys are
useful when they produce a ranked, reproducible queue; repeated broad audits
without a shipped fix are not the default cadence.
