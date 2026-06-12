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

- Pure web tech. Static ES modules, **no build step, no new dependencies**
  (three.js 0.180 via the CDN import map is the only one), **zero asset
  files** — every mesh, texture, and sound is generated in code.
- The island and its 1:240 model render from one `WorldState` (`js/world.js`).
  Anything state-driven must be applied to BOTH instances (`puzzles.js
  _apply`) or shared by material. Never let them disagree.
- The game must remain completable end-to-end after every iteration:
  valve → chest/ruler → bridge → birdsong → lens → shadows → beam glyphs →
  dials → plumb → dive → bell. If you touch terrain, puzzles, props, or
  player movement, re-verify the affected links of that chain.
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
2. Push: `git push origin HEAD:main` (docs/ is the live GitHub Pages site).
3. Update the Dockhand parent pointer: `git add shipyard-microtools`,
   commit `submodule: The Island — <one-line summary>`, rebase on
   `origin/main` if needed (gitlink conflicts: resolve to the submodule's
   pushed HEAD), push to main.
4. End with the co-author trailer on commits, as established in history.
