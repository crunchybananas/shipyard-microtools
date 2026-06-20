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

### Running a panel as a multi-agent workflow (subagents that confer)

A panel can run inside one head (sequential personas) OR — preferred for big
decisions like the endgame — as a **Workflow** where each persona is its own
subagent. The point of separate agents is DIVERGENCE: blind, independent voices
that don't converge on the first plausible answer. Conferral protocol:

1. **GENERATE (parallel, blind).** Each *generative* persona proposes 1–2
   concrete concepts FROM ITS LENS, not seeing the others' first — diversity by
   construction. Generative lenses: **The Finisher** (does it END + land
   emotionally? would a real player feel closure?), **The Narrative Architect**
   (does it pay off grief→INTEGRATION + the two-hands motif? is it earned?),
   **The Genre Historian** (how do Myst / Outer Wilds / Gone Home / Firewatch
   end — the canonical move, and the tasteful subversion?), **The Art Director /
   Cinematographer** (the final IMAGE: last shot, light, composition, camera
   move), **The Player-Avatar lens** (WHO is the player — does this concept
   answer or hold it?).
2. **ADVERSARIAL CROSS-CRITIQUE.** Every concept is attacked by **The Skeptic**
   + an independent refute-pass (default to "this is sentimental / over-explained
   / rings false / contradicts canon / leaks biography" and try to kill it).
   Only concepts that survive a majority advance. Diverse lenses, not redundant
   refuters.
3. **SYNTHESIZE (The Showrunner).** Judges the survivors against the SPINE and
   the open forks, merges the best ideas, and produces **3–4 distinct
   option-sketches for the OWNER** — never a single pre-decided answer.
4. **OWNER DECIDES the shape** (the forks below are HIS). Then **IMPLEMENT →
   adversarial-review** pipeline: build, then independent reviewers verify it
   plays clean end-to-end, lands, stays all-metaphor (no biography), and is
   power-safe.

**Decision rights:** the panel PROPOSES and pressure-tests; the owner DECIDES
the forks. Subagents must never bake in fork #2 (who-is-the-player) or #3 (final
camera) — they surface options. (Past panels live in CRITIQUES.md; the endgame
forks are the live tensions at the foot of SPINE.md.)

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
     grades in `world.js` are the only palettes; extend, don't fork. Pure
     quality-bar ticks obey "The Graphics Quality Bar & Power Ledger" (below)
     and are RATE-LIMITED: at most 1 in every 3 build iterations, never two in
     a row, each carries a Power Ledger or it is logged VISUAL DEBT. Story still
     leads — a graphics tick can still be REJECTED by a persona panel as avoidance.
   - **Audio / music** — everything synthesized in `audio.js`; the 5-note
     leitmotif (E G A D C) is the seed of all melody.
   - **Performance / code health** — budget: **locked 60fps; draws < 360
     (interior/overview), < 260 (open beach); tris < 800k** (`?debug` shows all
     three). (The old "<200 draws" was fictional — the real island runs ~307–340;
     measure at the `?debug` bench pose, never guess.)
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

## The Graphics Quality Bar & Power Ledger (2026-06-20, owner-asked; Panel-of-4 + adversarial)

Story still leads (the 2026-06-19 reframe). This is a PARALLEL, rate-limited graphics-quality
lane (≤1 in 3 builds, never two in a row; still rejectable as story-avoidance). A graphics
tick ships only if it clears ALL of:

1. **SERVES THE FIVE GRADES** — reads right at dawn 7.4h / noon 12h / golden 17.7h / night 23h
   AND under the L2–L4 `gradeBias` decay. Extends the grades; never forks them.
2. **POWER-NEUTRAL OR BETTER (the Power Ledger)** — record, from the fixed `?debug` bench pose,
   the BEFORE→AFTER of **draws · tris · GPU-frame-ms** at **noon AND night**. May not raise any
   of the three net; if it adds cost it must pay it back IN THE SAME TICK (bake/instance/cull/
   LOD/resolution) and show the math. `fps ≥ 60` is necessary but NOT sufficient — the 60fps cap
   hides headroom loss; **GPU-frame-ms is the real signal.** No Ledger ⇒ VISUAL DEBT, not a ship.
3. **SHARED-MATERIAL SAFE** — anything touching `matStone`/`matBrass`/water/Baker-merged or
   cloned geometry must look right on BOTH the island AND the 1:240 model (scale procedural
   frequencies so the model reads as chalk, not noise mush).
4. **ONE THING, FINISHED** — one effect/material/pass per tick.

**Precondition (do FIRST, before any other graphics tick):** extend the `?debug` panel with a
rolling **GPU-frame-ms** (`EXT_disjoint_timer_query_webgl2`; CPU-rAF fallback on Safari, LABELLED
— and note the fallback measures wall-clock, not true GPU time) + a fixed **bench teleport+time
preset** so every Ledger is from an identical pose. Without GPU-ms, clause 2 is unfalsifiable.

**WebGL post is PRE-AUTHORIZED but fenced:** `three/addons/` jsm passes (EffectComposer, bloom,
SMAA, Output) are allowed (they ship inside three@0.180 — one import-map line). Each is a POWER
EVENT. ⚠️ MSAA TRAP: a composer renders to a plain RT and SILENTLY discards the free
`antialias:true` MSAA — so the SAME tick that adds a composer MUST add SMAAPass and prove edges
aren't worse at night against the sky. Bloom must be SELECTIVE (high emissive threshold), half-res
buffers, DPR-clamped, near-zero during the 240× dive/ascent — and gated behind the GPU-ms readout.

**Asset honesty:** all planned work is generated (procedural-noise CanvasTextures, in-shader math,
baked vertex AO) — the "everything … is made of math" claim holds. The moment any tick reaches for
a downloaded image/normal-map/mesh, update **`index.html:33`** (the title line) AND **`index.html:7`**
(the synthesized-in-code meta) — NOT README (it doesn't hold the claim).

**Roadmap, sequenced cheap-and-power-neutral FIRST (banks headroom for the one power-raiser):**
(1) the Power Ledger + bench pose + reconciled draw budget [gate]; (2) per-grade
`toneMappingExposure` from the active grade [zero GPU cost]; (3) cheap CUT stack, ONE safe item per
tick: beam/shaft/cellar-shaft `.visible` gate when animated intensity~0 ✓ DONE iter 68 (−3 additive
draws + the overdraw fill when dormant; the beams are AdditiveBlending so they cost fill even at 0
intensity). REMAINING — gate the 7 conditional point-lights via `.visible` on state EDGES (a
zero-intensity light STILL costs a per-fragment loop iteration — only `.visible=false` drops it;
hide the one-time shader recompile on the hatch-open/dive curtain) [biggest cut]; `frustumCulled=true`
+boundingSphere on the Points — NOT a one-liner: they live in `diveGroup` which rescales 240× mid-dive
and the auto boundingSphere ignores the shader's ±0.6 drift + proximity point-size, so it needs a
dive-edge frustumCull toggle + dive-scale cull check; water fbm 4→3; (4) vertex-baked AO ✓ DONE iter 71
(terrain.js: concavity AO read from the finished 257² height grid — FREE, no extra heightAt — multiplied
into the existing terrain vertex colours; chasm/cliff folds get depth, flats untouched, +0 runtime,
grade-safe, model clone inherits it); (5a) distance aerial-perspective — terrain ✓ DONE iter 71→74 (terrain melts toward the grade haze past
170 m via its onBeforeCompile, like the canopy; fragment-only, power-neutral; stone props still TODO but near-field)
[near-free] — ship this FIRST and SEPARATELY from (5b) the triplanar normal/roughness break-up
[treat as adds-MEDIUM, terrain fills the frame — bench-profile at noon before shipping]; (6)
in-shader beam god-rays [bench-check; additive overdraw near the beam isn't free]; (7) EffectComposer
bloom+SMAA as its OWN gated iteration AFTER 1–6 bank headroom. DEFER (owner-ask only): PMREM env
refresh, planar/SSR water reflection (a 2nd scene render + breaks the shared-water invariant), DOF
(fights puzzle legibility). Full panel: the iter-63 graphics-strategy workflow.

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
- Check the `?debug` readout after: 60fps locked, draws within the reconciled
  budget (< 360 interior/overview, < 260 beach), tris < 800k, no console errors.

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
