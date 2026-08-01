# ABYME — Session Handoff · 2026-07-27/28

The Island (ABYME) lives at `docs/the-island/` in `crunchybananas/shipyard-microtools`
(submodule of `crunchybananas/dockhand`). `docs/` is the deployed GitHub Pages site, so
**everything on submodule `main` is live**. Both repos' `main` branches carry everything
described below.

---

## What shipped this session

**Audit batch (7 commits):**
- **#47/#38 waterline pass** — terrain knows the tide (`uWaterY`, object-space): wet-sand
  swash band, submerged warm-light falloff, min-of-two seabed caustics; water got a
  scalloped foam collar + dual-scroll surface caustic. Rides every SEA-STRATA level; the
  1:240 model clone inherits its own tide line.
- **#37 farSea shader** — the glitter road reaches the horizon; the 280–438 m double-draw
  band is gone (world sea circled at r = 310, ring inner 310). Shares the near water's
  uniform objects, so `applyAtmosphere` drives both for free.
- **#45 pier** — silvered driftwood, four lengthwise deck boards with gaps, per-piece
  timber tone, baked tide-stain rings on the piles.
- **#46 gulls** — folded wings hug the flanks (FOLD constants shared by `addWings` and
  `tickPerched`); crows inherit.
- **#51 depth responses** — music box waterlogged + **the fourth note never comes at L4**
  (tied to the stones-vault lore), crank drags at depth, stones hum damped; persisted
  once-whispers. Crank ratio verified exactly 0.5 at L3.
- **#52 progress** — the L3 **bell-buoy** in the flooded chasm channel: untended
  distance-faded toll (~13 s swell clock, `puzzles._tickBuoy`) + proximity journal beat.

**Loop fires 1–5:**
1. **#36 rock relief** — cliffs swap wind-ripples for bedding + wall-plane fracture above
   ~0.5 slope; ±9 % albedo strata survive the haze at the 170 m glyph-study range.
2. **#43 study contact AO** — Baker callbacks now get the world vertex; a tessellated ring
   walk-surface bakes pools under every furniture footprint (0.200 vs 0.302 lum at legs).
3. **Story pass** — twist locks verified in code (two-touch embrace, body-before-line,
   carried/farewell exclusive); 16 unillustrated journal entries (both climaxes, both
   endings) got sketches. Coverage is enforced-complete (see "Rules of the house").
4. **Gameplay pass** — fixed the **post-return lockout**: annex wall / inner door / coat
   letter / cot journal / keeper lamp all honour `W.flags.returned` now.
5. **Generative era music** — the Bender mp3 beds are REPLACED by a ~7-node synth graph
   (drone + fifth through a breathing lowpass, sea-breath pad, sparse leitmotif fragments
   per era root E/G/A/D/C). Depth darkens cutoff 950→220 Hz, widens detune, thins the
   melody; **the fourth note plays flat below the surface and never comes at the source**.
   `musicTo(level)` retargets the one graph — the transition is the crossfade.

**Owner-reported fixes (tonight):**
- **Lighthouse door** — was a 1.9×3.4 m unframed slab in a wall-wide breach; now a
  battened keeper's leaf with frame + brass pull in a ~1.1×2.55 m doorway (stone infills +
  transom, taper-matched so no seam slits). Collision follows the visuals (`LH_GAPS`).
- **Study window** — was a 2.6 m flat sheet chording a curved 30° opening; now a framed
  four-pane sash in a ~13° opening (chord deviation < 4 cm). The model reads through the
  glass from outside.
- **The annex ("chamber next to the tower")** — it is DESIGNED to open one level down,
  but gave no feedback. Clicking the shut inner door now answers: *"Locked — not from
  this side. Whatever holds it shut is further down than the latch."* + a once-only
  journal line. Opens at L2+, stays open after the return.

## Issues closed this session
#36 #37 #38 #43 #45 #46 #47 #51 #66 (all with verification comments) · #52 progressed.

---

## Awaiting the owner

1. **LISTEN to the generative music.** Verified structurally (era retargeting, the flat/
   missing fourth, stop/restart), not subjectively. Tuning is one table in `js/audio.js`
   (`_ERAS`: root / cutoff / melody gaps / breath period / volume per level). The old
   mp3s are still in `assets/music/` unreferenced if you want to A/B.
2. **Walk the new door/window/annex** in real play — headless shots look right; feel is
   yours to judge. Same for the L3 bell-buoy toll volume (`_tickBuoy`, vol curve).
3. **The generative beds replaced #66's complaint** — if you'd rather have Bender stems
   *fixed* instead (longer chains, better prompts), that's a fresh Bender run via Peel;
   the engine can layer under or instead of them.

## Open backlog (by cluster)
- **Story/puzzle:** #49 optional depth-keyed puzzle chains (the big one), #50 non-keeper
  voices, #53 model micro-finds, #54 reading-glass payoff (8–12 lampblack marks), #55
  drainMark lore, #52 remainder (L3/L4 micro-puzzle, region4 landmark), #75 content
  migration, #76 per-depth codex.
- **Graphics:** #44 micro-pass (glass fresnel, canopy dapple, beam-mist, green-flash,
  songbird), #48 close-range rock relief + seaweed props.
- **Audio:** #63 spatialize one-shots, #64 audible day/night cycle (natural companion to
  the new music engine).
- **Perf:** #27 #28 #30 #31 #32 #34 (light gating, shadow freeze, grass chunking, water
  fbm bake, bloom probe, regional Bakers).
- **UX:** #57 hotspot labels, #59 settings tab, #60 touch input, #61 intro-skip
  advertisement.
- **Architecture:** #69–#73, #77 (fragment factory, prop registry, region modules,
  encounter engine, update scheduler, terrain purify).

## Running + verifying (the 5-minute version)
- Serve `docs/` statically **with no-store headers** and an **absolute docroot** (a bare
  `python3 -m http.server` will bite you twice: Chrome's heuristic cache serves stale
  modules, and a relative docroot can resolve against the wrong checkout).
- `?debug` → `window.ABYME` (`tp`, `goLevel`, `bench(t)`, `state()`, panel chips). Reach
  play: click Begin (+ confirm), then `ABYME.setIntroT(99)`.
- **Frozen-tab rules** (headless/background): game logic and eased params stop — drive
  `game._apply(refs,false,0)` and uniforms manually; the canvas has no
  `preserveDrawingBuffer`, so call `ABYME.composer.render()` in the SAME eval before a
  screenshot; wait ~1.6 s after `tp` for the camera to catch up, and re-shoot if stale.
- `tp` near water/obstacles can tide-rescue you to the beach ("The tide brought you
  back") — always read back `player.pos`. The `bridge` chip drops to the chasm floor on
  fresh saves (no ruler bridge yet) — that black screen is a dark crack, not a crash.
- The audio singleton: `(await import('/the-island/js/audio.js')).default`.
- Full detail: `PLAYTHROUGH.md` (tester toolkit), `WALKTHROUGH.md` (player path).

## Rules of the house (do not break)
- **Canon:** grief → INTEGRATION (`loop/SPINE.md`); the embrace is a PLAYER ACTION;
  all-metaphor, never biography. The twist beats are wired in `puzzles.js` (keeperTwist /
  embrace / carried-vs-farewell) — treat as load-bearing.
- **Tech:** three.js only (no new JS deps); power-safe (60 fps cap, adaptive DPR — every
  graphics change holds or cuts load); **never add a point light** (9 = the fragility
  ceiling; a 10th black-screens weaker GPUs — light with emissives).
- **The clone:** everything in `core` clones to the 1:240 chart-table model. Never
  `THREE.Points` in `core`; new named props go in `NAMES` (props.js); region content is
  auto-pruned with its region group. Shared materials must damp scale-dependent effects
  via the `mini`/`cMini` derivative trick.
- **Journal coverage:** every `addJournal`/`journal:`/`journalDeep:` string must match a
  `SKETCHES` entry (content.js). Check:
  `node` one-liner in LOG habit — currently 50/50.
- **Push protocol:** submodule `HEAD:main` first, then the parent gitlink (separate
  commands, worktree root). The Realm project pushes to the same repo — expect fetch +
  rebase.

## Suggested next moves
1. Owner listens to the music; tune `_ERAS` together.
2. #49 (optional puzzle chains) — the biggest remaining gameplay depth win.
3. #64 audible day/night, now trivial on the music engine's scheduler.
4. #54 reading-glass payoff — highest story-per-effort of the open lore items.
