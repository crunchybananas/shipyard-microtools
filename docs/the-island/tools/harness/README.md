# The ABYME harness — the release gate, in the repo

The scratchpad stopped being load-bearing at fire 38 (#139). This directory IS the
gate that has guarded every fire since the walk was born:

- **`run.sh`** — one command: static server + headless Chrome + save and notebook
  contracts + runtime reset + Upstream Hand + sand writing + player-facing experience
  + the visual gates + the full walk. Exit 0 = ship.
  `SERVE_PORT` / `CDP_PORT` / `CHROME_BIN` env-overridable.
- **`walk.mjs`** — the 64-assertion future-facing route: physical evidence →
  instrument-routed signal → every gated descent → held-regard encounters → atomic
  ascent saves → returned-surface commitment for all four dispositions. It uses
  shipped hotspots and asserts zero window errors. Power is not asserted here.
- **`coverage.mjs`** — 21 static assertions keep every stable Field Notes id,
  sketch, lore layer, hint thread, and progression reference reachable while making
  retired journal, save-migration, identity-ending, and instrument-ending paths fail.
- **`runtime-reset.mjs`** — six assertions prove Begin, soft reset, and report replay
  cancel cinematics, score nodes, puzzle timers, queued copy, and delayed old-run work.
- **`stack.mjs`** — a focused ledger walk retained for direct stack development; it
  is not invoked by the current release gate.
- **`upstream-hand.mjs`** — a real L1 valve input under one local identity becomes
  another identity's inherited L2 cause: model, wall and bay channels stage in order;
  the exact `+0.06` surge commits once; controls stay live; transients clean up; save,
  late-merge, revisit, max-draft, reduced-motion, replay, clean-ledger and same-hand
  fallback, out-of-order shared pulls, overlapping audio ownership, crossing and terminal cleanup,
  and deep-Continue arrival paths all hold. Its executable power assertion requires
  peak work below 525 calls and 1,000,000 triangles, no more than +16 calls / +20,000
  triangles over baseline, and no point-light increase above nine. 32 assertions. It forces
  `?localstack`, so the two test identities can never reach the permanent ledger.
- **`writing.mjs`** — the zero-draft exception: the real shoreline input, hostile-text
  sanitation, save-independent persistence, one-line-per-hand idempotency, downward
  inheritance, upright glyph mapping, and terrain-conforming weathered rendering.
  19 assertions. It forces
  `?localstack`, so a test can never leave permanent prose in the shared world.
- **`terrain-finish.mjs`** — pins the two visual causes one frame exposed together:
  sand relief is one continuous, locally turning analytic field (never a repeated tile
  or texture-LOD block); every authored tide cuts a watertight, sub-metre adaptive coast
  financed by permanently deep seabed simplification; the water/foam contact reads the
  matching denser 512² depth field;
  and high daylight bypasses the non-MSAA bloom target while dawn, gold and night retain
  their glow. 10 assertions.
- **`experience.mjs`** — the player-facing journey the flag walk cannot see: readable
  first-use copy; unobstructed L2/L3/L4 arrivals; the L3 hall actually breaching in the
  frame named by its prose; story whispers waiting until a reader closes; a stateful,
  diegetic journal bearing; and opt-in acceleration that lands both the descent and
  ascent through their real state/save boundaries. 18 assertions.
- **`doors.mjs`** — where props END UP. The owner watched a door swing through the
  tower wall; the walk proved you can get THROUGH a doorway, never that the door hung
  in it is inside the building. Pure geometry. 6 assertions.
- **`bloom.mjs`** — the bloom threshold must stay under the dimmest emissive that is
  meant to glow. Raising it is the tempting fix for anything blown out and it kills
  real light sources silently. 3 assertions.
- **`shell.mjs`** — the lighthouse is a building; you should not see sky through its
  walls. Casts from the eye positions bugs were REPORTED from, because an axis sweep
  cannot see a radial seam (see the file's header — I watched a sweep pass with the
  bug reinstated). 5 assertions.
- **`relief.mjs`** — every surface that asked for relief actually got it, counted rather
  than eyeballed. getTexture ran your callback on a cache hit ONLY if the image had
  already decoded, so whoever asked second for an asset still in flight got nothing, in
  silence: the shore's three stone types all derive relief from one heightmap and two came
  out bare, and the terrain's sand ripples never switched on. Timing-dependent, so it came
  and went. 8 assertions.
- **`gulls.mjs`** — the dawn percher must not fly through the lighthouse. Walks the whole
  settle ramp (the bug lives entirely in the MIDDLE — sampling the settled state scores
  identically either way) and measures the bird's origin against the tower's real profile,
  against the HALF-SPAN: a gull is 2.64 m across, so 0.98 m of origin clearance still
  buries a third of a metre of wing in the copper. It also inspects the one-draw grounded
  body for eyes, beak, legs and feet, pins every idle sole/root to terrain while the
  folded wings breathe, and follows a proximity takeoff until its continuous six-second
  curve has carried the bird beyond visible shore scale. 7 assertions.
- **`vault-outcrop.mjs`** — the lens vault is a sealed boulder with a shallow reveal
  niche, not an enterable room. Sweeps the real rotated collision footprint before and
  after the bird solution, pins the exact reported penetration point, and proves the
  carved arch, slab and lens all live on a reachable exterior face. 8 assertions.
- **`trees.mjs`** — the canopy's fray, needle grain, clump bump and tip-weighted sway are
  a custom vertex attribute plus three shader-chunk replacements, and both kinds fail
  SILENTLY: a dropped attribute reads as 0 in GLSL, a replace that matches nothing is a
  no-op. Checks all eight canopy geometries (near + far across four silhouettes), proves
  each is made of dozens of independent branch sprays rather than circumferential cone
  tiers, and checks that the needle-litter mask the TERRAIN samples lands under the
  trunks AND nowhere else — a CanvasTexture flip mirrors it in z, which looks perfect and
  is in the wrong place. 13 assertions.
- **`tabletop.mjs`** — everything that lies on the chart table lies ON it: inside the
  vellum, clear of the model's footprint, with a working margin between them. The table
  shrank and six props were left out past the brass rim; the owner found one of them.
- **`glare.mjs`** — nothing in the study clips to white under the window sun (#147).
  Counts pixels at near-max LUMINANCE, not neutral white: the glare is a warm reflection
  off amber brass, and a white test reported 0.00% against a frame that was a white-out.
  8 assertions, including a floor so a frame cannot pass by being dark.
- **`spines.mjs`** — the study's eight signal manuals each bind one beam glyph to
  one named physical instrument. The checks prove the three atlases and physical
  shelf form a complete route; the beam supplies order, instruments supply readings,
  and no spine contains a value, four-place answer, or hidden acrostic.
- **`glint.mjs`** — the hover highlight marks a prop, it does not replace it: it ramps
  rather than steps, it cannot manufacture a light source, and it restores even from a
  re-hover that lands mid-fade. 25 assertions. `SHOT_DIR=` also photographs each style
  (off/wash/pulse/rim) on one prop from one camera — the comparison that chose the rim.
- **`cdp.mjs`** — the minimal CDP driver (node 22, global WebSocket). Runner errors
  print and exit non-zero (a bare `finally { exit(0) }` once swallowed a day's bugs).
- **`one.sh`** — run ONE script against a fresh server + Chrome, for visual and
  exploratory passes. `SERVE_PORT=8261 CDP_PORT=9455 one.sh glint.mjs`
- **`syntax.sh`** — recursively parse-check every game ES module, including `js/regions/`.
  **`node --check js/foo.js` does
  not work here and does not say so**: with no package.json node treats `.js` as
  CommonJS, meets `import`, and exits 0 on a broken file. syntax.sh copies to `.mjs`
  first. A whole session of "syntax ok" was worthless before this existed.
- **`serve.py`** — docs/ docroot, `Cache-Control: no-store`. Honours `SERVE_PORT`.

## Hard-won rules

- **Never `--disable-gpu`** — new headless kills WebGL under it.
- **Poll for boot** (`typeof ABYME !== 'undefined'`) — fixed waits die on cold
  profiles; the dive wait carries a 30s margin for first-compile shader hitches.
- The bell/oar waits carry 15s/19s margins for the same reason.
- Manual `game.tick` pumping advances puzzles but NOT the drive scheduler
  (`runDrives` lives in the rAF loop) — vista holds and rope swings need real waits.
- Goldens (`loop/goldens/`) are captured at pinned `W.time` per level; cross-OS
  pixel-diffing headless GL is flaky, so CI uploads fresh captures as artifacts for
  human eyes instead of hard-failing on pixels.
- **A new gate is worthless until you have watched it go RED.** Every gate here was
  run with its own bug deliberately reinstated before being trusted, and three of them
  passed on the first try with the bug in place: shell.mjs's axis sweep could not see
  the seam it was written for, glint.mjs's first "it eases" check was equally true of
  a step, and its first "it restores" check compared the material against the very
  baseline the bug corrupts. Assert on something the bug CANNOT produce.

CI: `.github/workflows/island-walk.yml` runs the same `run.sh` gate on every push or
pull request touching `docs/the-island/**`, then uploads current golden images for
human inspection. Local and CI runs use the same assertion counts and failure rules.
