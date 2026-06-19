# ABYME Quality Loop — Mission

You are one iteration of an ongoing quality loop for **THE ISLAND: ABYME**
(`docs/the-island/` in shipyard-microtools — a 3D island-within-an-island
Myst-like; read its `README.md` for the architecture map and puzzle chain).

## The contract of one iteration

Ship **exactly one significant, finished, verified improvement**, then stop.

"Significant" means a player would notice it and be gladder for it, or the
codebase is meaningfully healthier. A tweak is not an iteration. Half-shipped
is worse than nothing — finish it or revert it; main never holds a broken game.
The owner's bar is explicit: *"I really want to be wow'd."*

## The story comes first now (2026-06-19 reframe)

The game is **Myst-*inspired*, not a Myst clone** — the lineage is Journeyman
Project, Phantasmagoria, The 7th Guest: rich environments and a story with a
**reveal**. A persona panel diagnosed the hard truth: 26 iterations polished a
beautiful snow globe because "finished and verified" rewards graphics and
punishes story. That stops here.

- **[SPINE.md](SPINE.md)** is the working bible — the recommended direction
  (grief rendered as recursion), the candidate **One Truth** (owner's call),
  the "leaving the island" endgame, the new environments, and the live
  tensions. Every **story / puzzle / environment** tick must cite a named beat
  or environment from SPINE.md. The recursion is the *mechanic*; the keeper and
  the choice are the *reveal*.
- **Graphics / audio ticks must serve an answered question**, not substitute
  for one. A graphics tick that is pure avoidance of the story may be
  **rejected** by a persona review. Genuine polish, perf, and jank fixes are
  always welcome — but the loop no longer flees uphill.
- **The One Truth (grief / quarantine / transmission / watched-loop) is the
  owner's decision** and is NOT yet canon. Build what pays off under any of
  them (environments, the ascent, divergence, structure); do not hard-code a
  reveal until the owner picks.

## Persona iterations

Some iterations are not for building — they are for **pushback**. Adopt a
critical persona (the skeptic, the art director, the narrative architect, the
genre historian, the finisher, or a new one the moment calls for) and attack
the shipped or planned work: what is hollow, unmotivated, or merely pretty?
Record the critique in **[CRITIQUES.md](CRITIQUES.md)** (newest panel first).
Run one roughly every ~5 build iterations, or whenever a thread feels adrift.
A persona's job is friction, not kindness; its findings become the next
iterations' work. The synthesis of a panel updates SPINE.md and files issues.

## Procedure

1. **Read `LOG.md`** (same directory): the last 3 entries, the backlog, and the
   previous iteration's *Next tick suggestion*.
2. **Choose one item.** The suggestion is advisory, not binding — pick the
   highest-wow-per-effort item. Do not work the same axis more than two
   iterations in a row; the axes:
   - **Story / worldbuilding** — the cartographer's traces, journal pages,
     environmental storytelling, whisper writing. No text dumps; the world
     is the interface.
   - **Puzzle / secret** — optional discoveries, layered clues, a secret for
     attentive players. NEVER break or gate the existing main chain.
   - **Close-look jank** — the "grass poking through a table" class: things
     that betray the illusion within 2 metres. Hunt them with screenshots.
   - **Graphics wow** — sky, water, light, weather, post. The five master
     grades in `world.js` are the only palettes; extend, don't fork.
   - **Audio / music** — everything synthesized in `audio.js`; the 5-note
     leitmotif (E G A D C) is the seed of all melody.
   - **Performance / code health** — budget: ≥60fps, <200 draw calls,
     <800k tris (`?debug` panel shows all three).
   - **UX / onboarding / accessibility** — never adding HUD chrome.
3. **Build it.**
4. **Verify it** (see protocol below).
5. **Ship it** (see protocol below).
6. **Log it** — append to `LOG.md` (see template there), including a concrete
   *Next tick suggestion* with a why.

## Hard rules

- **No external JavaScript dependencies or frameworks.** This is THE
  constraint (owner, 2026-06-19). three.js (via the CDN import map) is the
  one sanctioned exception, because it earns its weight; lodash, React, Vue,
  and friends are **non-starters**. Static ES modules, no build step. Add a
  JS dependency only with a compelling, stated reason and owner sign-off.
- **Assets may now come from Bender or open-source** (meshes, textures,
  audio) — the old "zero asset files / everything is math" rule is
  *relaxing over time*. Prefer code-generated when it's as good (it's lean,
  seeds well, and is the house style), but a generated/open-source asset is
  allowed when it genuinely raises the bar. Use restraint; keep the download
  honest. NOTE: when the first non-generated asset ships, update
  `README.md` and the title-screen "everything you will see and hear is made
  of math" line — that claim becomes false and must change.
- The island and its 1:240 model render from one `WorldState` (`js/world.js`).
  Anything state-driven must be applied to BOTH instances (`puzzles.js
  _apply`) or shared by material. Never let them disagree.
- The game must remain completable end-to-end after every iteration:
  valve → chest/ruler → bridge → birdsong → lens → shadows → beam glyphs →
  dials → plumb → dive → bell. If you touch terrain, puzzles, props, or
  player movement, re-verify the affected links of that chain.
- **No debug-only payoffs (Panel #2, 2026-06-19).** A tick whose effect is only
  reachable by forcing state through `?debug` — e.g. behavior gated on
  `W.level > 2`, a flag a player can't yet set — is NOT shippable as a "story"
  or "wow" feature unless it ALSO ships the in-play path that makes that state
  reachable. "Verified via debug `W.level`" is not verification: loops 30–32
  shipped a five-level decay no player could reach (the dive only ever set
  `W.level = 2`). If you can't make the effect reachable this tick, it is
  **VISUAL DEBT**, logged as such — not a shipped feature, and not "verified."
- Saves must survive: new persistent state goes through `world.js`
  `save()/load()` with a backward-compatible default.

## Known traps (learned the hard way)

- **`getObjectByName` on `core` finds the MODEL CLONE'S copies first** (the
  clone sits early in child order). Use `collectRefs`-style DFS that skips
  `modelAnchor`, and add new state-driven node names to `NAMES` in `props.js`
  — a name missing from NAMES gave `refs.X === undefined` and a render-loop-
  killing raycast throw once.
- Materials are intentionally shared across the two islands (water, lens
  kindling). Hover-glint clones materials per hotspot (`interact.js add()`);
  keep that invariant for any new hotspot.
- Movement: natural slopes >1.35 gradient are unclimbable; structures
  (bridge, stairs) are exempt because walkableY diverges from heightAt
  (`player.js step()`). New walkable structures must keep that divergence
  >0.4m, and terrain edits must re-check that the bluff stays bridge-only
  (sample `maxGrad` on the flanks like the review did).
- Verification tooling: the preview tab suspends rAF when hidden — frames
  freeze, projections go stale; split pointer-move and click across separate
  evals; the preview console does NOT capture rAF exceptions, so install
  `window.addEventListener('error', ...)` before reproducing a suspected crash.
- Seeded determinism: all randomness through `util.js` PRNG. No
  `Math.random()` in world generation.
- **Never add a `Points` (makeGlowPoints) to `core`.** `instantiateModel`
  clones `core` and strips `Points` mid-`traverse` (`o.isPoints &&
  o.removeFromParent()`) — removing during traversal corrupts the iteration and
  throws (`Cannot read properties of undefined (reading 'traverse')`), killing
  module init silently (no preview-console error; `window.ABYME` never set, so
  it looks like the page just won't start). Glow points go to `diveGroup` in
  main (like `biolume`/`fireflies`/`motes`): return them from `buildWorld` and
  `diveGroup.add(...)` them; drive their uniforms via the direct reference, not
  `refs`. (Cost the loop #38 ~10 evals to diagnose.)

## Verification protocol (non-negotiable)

- Serve with the existing launch config (`preview_start` name `abyme`, port
  8741) and load `/?debug` for the time scrubber, teleports, and fps/draws.
- Every visual change gets **screenshots at the times of day it affects**
  (the grades differ wildly: dawn 7h, noon 12h, golden 17.7h, night 23h)
  and at close range if it's within player reach.
- If the browser/preview is unavailable this tick, you may NOT claim visual
  work verified — ship only non-visual work, or log the item as **VISUAL
  DEBT** in LOG.md and leave the change uncommitted.
- Puzzle-affecting changes: drive the real input pipeline at least once
  (dispatch pointermove → next eval → pointerdown/up) or walk the debug
  buttons through the affected steps.
- Check the `?debug` readout after: fps ≥60, draws <200, no console errors.

## Ship protocol

1. Commit in the submodule, message prefix `the-island:`, on top of
   `origin/main` (fetch & rebase if it moved).
2. Update the Dockhand parent pointer: `git add shipyard-microtools`,
   commit `submodule: The Island — <one-line summary>`.
3. Push **every 5th iteration only** (owner's cadence, 2026-06-11: after
   LOG entries 5, 10, 15, …). Order matters: first the submodule
   (`git push origin HEAD:main` — docs/ is the live GitHub Pages site),
   then the parent (rebase on `origin/main` if it moved; gitlink
   conflicts resolve to the submodule's pushed HEAD). Between batches,
   commits stay local — still one commit per iteration in both repos,
   so a batch push ships cleanly even if a session ends mid-cycle.
4. End with the co-author trailer on commits, as established in history.
