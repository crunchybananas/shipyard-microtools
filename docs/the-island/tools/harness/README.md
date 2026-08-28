# The ABYME harness — the release gate, in the repo

The scratchpad stopped being load-bearing at fire 38 (#139). This directory IS the
gate that has guarded every fire since the walk was born:

- **`run.sh`** — one command: static server + headless Chrome + saves + coverage +
  stack + doors + bloom + shell + glint + the walk. Exit 0 = ship.
  `SERVE_PORT` / `CDP_PORT` / `CHROME_BIN` env-overridable.
- **`walk.mjs`** — the 45-assertion FULL-GAME regression: wake-up → surface chain →
  the era threshold → all three era events → the four rounds → FILE and KEEP → the
  drowned shore → both endings with their read-back codas → the restored-save branch —
  plus the power budget (draws < 340, tris < 460k per composer frame) and the
  undefined-visible regression guard. Real mechanics, no shortcuts the player
  couldn't take (hotspot invocation aside).
- **`coverage.mjs`** — every journal-bound line (content corpus, T-table sites,
  `_doRound` args, ui.js literals) must hit a SKETCHES matcher. 103/103.
- **`stack.mjs`** — STACK.md slices 1–2: the ledger records the god-verbs, the draft
  accumulates downward, and both survive a wiped save and a reload. 47 assertions.
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
- **`tabletop.mjs`** — everything that lies on the chart table lies ON it: inside the
  vellum, clear of the model's footprint, with a working margin between them. The table
  shrank and six props were left out past the brass rim; the owner found one of them.
- **`glare.mjs`** — nothing in the study clips to white under the window sun (#147).
  Counts pixels at near-max LUMINANCE, not neutral white: the glare is a warm reflection
  off amber brass, and a white test reported 0.00% against a frame that was a white-out.
  6 assertions, including a floor so a frame cannot pass by being dark.
- **`spines.mjs`** — every spine in the study is lettered, and eighteen of them are
  struck with a DOUBLED gilt rule where every other volume carries one. Those eighteen,
  read top board down and left to right, spell the line of canon the game says aloud
  once. Gates all three layers: the message reads (it shipped bottom-up and mirrored the
  first time), the KEY holds (counted off the atlas pixels — two rules on the message,
  one on everything else, and no blank spines to give the set away), and the reader does
  not hand it over (the surface pages may make you look, never explain; the method waits
  for the deep reading at rung 3). 21 assertions.
- **`glint.mjs`** — the hover highlight marks a prop, it does not replace it: it ramps
  rather than steps, it cannot manufacture a light source, and it restores even from a
  re-hover that lands mid-fade. 25 assertions. `SHOT_DIR=` also photographs each style
  (off/wash/pulse/rim) on one prop from one camera — the comparison that chose the rim.
- **`cdp.mjs`** — the minimal CDP driver (node 22, global WebSocket). Runner errors
  print and exit non-zero (a bare `finally { exit(0) }` once swallowed a day's bugs).
- **`one.sh`** — run ONE script against a fresh server + Chrome, for visual and
  exploratory passes. `SERVE_PORT=8261 CDP_PORT=9455 one.sh glint.mjs`
- **`syntax.sh`** — parse-check the game's ES modules. **`node --check js/foo.js` does
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

CI: `.github/workflows/island-walk.yml` runs this on every push touching
`docs/the-island/**`. **CI is the logic gate**: on the runner's software GL,
20-second real-time cinematics cannot hit wall-clock, so CI requires the 33 pumped
assertions green AND the failure list to equal exactly the whitelisted realtime
set (any other failure is red). The full 45/45 — cinematics, endings, both
terminals in real time — is the LOCAL pre-push bar.
