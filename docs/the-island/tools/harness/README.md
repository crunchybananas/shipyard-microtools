# The ABYME harness — the release gate, in the repo

The scratchpad stopped being load-bearing at fire 38 (#139). This directory IS the
gate that has guarded every fire since the walk was born:

- **`run.sh`** — one command: static server + headless Chrome + coverage + the walk.
  Exit 0 = ship. `SERVE_PORT` / `CDP_PORT` / `CHROME_BIN` env-overridable.
- **`walk.mjs`** — the 45-assertion FULL-GAME regression: wake-up → surface chain →
  the era threshold → all three era events → the four rounds → FILE and KEEP → the
  drowned shore → both endings with their read-back codas → the restored-save branch —
  plus the power budget (draws < 340, tris < 460k per composer frame) and the
  undefined-visible regression guard. Real mechanics, no shortcuts the player
  couldn't take (hotspot invocation aside).
- **`coverage.mjs`** — every journal-bound line (content corpus, T-table sites,
  `_doRound` args, ui.js literals) must hit a SKETCHES matcher. 103/103.
- **`cdp.mjs`** — the minimal CDP driver (node 22, global WebSocket). Runner errors
  print and exit non-zero (a bare `finally { exit(0) }` once swallowed a day's bugs).
- **`serve.py`** — docs/ docroot, `Cache-Control: no-store`.

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

CI: `.github/workflows/island-walk.yml` runs this on every push touching
`docs/the-island/**`.
