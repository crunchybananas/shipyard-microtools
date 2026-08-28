#!/usr/bin/env bash
# run.sh — the release gate, end to end: static server + headless Chrome + the
# 45-assertion full-game walk + the journal↔sketch coverage check. Exit 0 = ship.
#
#   SERVE_PORT (default 8642)   CDP_PORT (default 9223)   CHROME_BIN (autodetect)
#
# NOTE: launch Chrome WITHOUT --disable-gpu — new headless kills WebGL under it
# ('Error creating WebGL context' is the tell). --autoplay-policy keeps the audio
# context runnable for the structural audio checks.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
SERVE_PORT="${SERVE_PORT:-8642}"
CDP_PORT="${CDP_PORT:-9223}"

if [ -z "${CHROME_BIN:-}" ]; then
  for c in "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
           "$(command -v google-chrome || true)" \
           "$(command -v chromium-browser || true)" \
           "$(command -v chrome || true)"; do
    [ -x "$c" ] && CHROME_BIN="$c" && break
  done
fi
[ -z "${CHROME_BIN:-}" ] && { echo "no chrome found; set CHROME_BIN"; exit 2; }

WORK="$(mktemp -d)"
cleanup() { kill "${SRV_PID:-}" "${CHROME_PID:-}" 2>/dev/null; wait 2>/dev/null; sleep 1; rm -rf "$WORK" 2>/dev/null; }
trap cleanup EXIT

python3 "$HERE/serve.py" & SRV_PID=$!
# CI runners (containers) crash chrome without --no-sandbox; keep local runs sandboxed.
# --use-angle=swiftshader guarantees software WebGL where the runner has no GPU.
EXTRA_FLAGS=""
[ "${CI:-}" = "true" ] && EXTRA_FLAGS="--no-sandbox --disable-dev-shm-usage --use-angle=swiftshader"
# shellcheck disable=SC2086
"$CHROME_BIN" --headless=new --remote-debugging-port="$CDP_PORT" \
  --autoplay-policy=no-user-gesture-required --mute-audio \
  --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows \
  --window-size=1280,800 --user-data-dir="$WORK/profile" $EXTRA_FLAGS about:blank \
  > "$WORK/chrome.log" 2>&1 & CHROME_PID=$!

for i in $(seq 1 30); do
  curl -sf "http://127.0.0.1:$CDP_PORT/json/version" > /dev/null && break
  sleep 1
done
curl -sf "http://127.0.0.1:$CDP_PORT/json/version" > /dev/null || { echo "chrome CDP never came up"; exit 2; }
curl -sf "http://127.0.0.1:$SERVE_PORT/the-island/" > /dev/null || { echo "server never came up"; exit 2; }

echo "== saves schema =="
node "$HERE/saves.spec.mjs" || exit 1
echo "== coverage =="
node "$HERE/coverage.mjs" || exit 1
echo "== the stack =="
# STACK.md slices 1-2: the ledger records the god-verbs, the draft accumulates
# downward, and both survive a wiped save and a reload. Pure logic + storage — no
# cinematics — so this is a hard gate on CI too.
SERVE_PORT="$SERVE_PORT" CDP_PORT="$CDP_PORT" node "$HERE/cdp.mjs" "$HERE/stack.mjs" | tee "$WORK/stack.out"
grep -q "STACKWALK 47 / 47" "$WORK/stack.out" || { echo "STACK FAILED"; exit 1; }

echo "== the doors =="
# The owner watched a door pass through the tower wall. Nothing in the gate looked at
# where props END UP — the walk proves you can get THROUGH a doorway, not that the
# door hung in it is inside the building. Pure geometry, so it gates on CI too.
SERVE_PORT="$SERVE_PORT" CDP_PORT="$CDP_PORT" node "$HERE/cdp.mjs" "$HERE/doors.mjs" | tee "$WORK/doors.out"
grep -q "DOORS 6 / 6" "$WORK/doors.out" || { echo "DOORS FAILED"; exit 1; }

echo "== bloom =="
# Guards the ceiling on the bloom threshold. Raising it is the tempting fix for anything
# that looks blown out, and it kills the dimmest real light sources silently.
SERVE_PORT="$SERVE_PORT" CDP_PORT="$CDP_PORT" node "$HERE/cdp.mjs" "$HERE/bloom.mjs" | tee "$WORK/bloom.out"
grep -q "BLOOM 3 / 3" "$WORK/bloom.out" || { echo "BLOOM FAILED"; exit 1; }

echo "== the shell =="
# The lighthouse is a building; you should not see sky through its walls. Two holes
# have shipped and nothing else in the gate could catch either.
SERVE_PORT="$SERVE_PORT" CDP_PORT="$CDP_PORT" node "$HERE/cdp.mjs" "$HERE/shell.mjs" | tee "$WORK/shell.out"
grep -q "SHELL 5 / 5" "$WORK/shell.out" || { echo "SHELL FAILED"; exit 1; }

echo "== relief =="
# Every surface that asked for relief has to get it. getTexture dropped the callback for
# anyone who asked for an asset that was cached but still decoding, so the second and
# third consumers of a heightmap ended up flat and silent — 4 of 12 when it was found.
SERVE_PORT="$SERVE_PORT" CDP_PORT="$CDP_PORT" node "$HERE/cdp.mjs" "$HERE/relief.mjs" | tee "$WORK/relief.out"
grep -q "RELIEF 8 / 8" "$WORK/relief.out" || { echo "RELIEF FAILED"; exit 1; }

echo "== the trees =="
# The canopy's detail rides on a custom attribute and three shader-chunk replacements, and
# both die silently — a dropped attribute reads as 0 in GLSL, a replace that matches
# nothing is a no-op. Neither reports anything; the trees just go back to folded paper.
SERVE_PORT="$SERVE_PORT" CDP_PORT="$CDP_PORT" node "$HERE/cdp.mjs" "$HERE/trees.mjs" | tee "$WORK/trees.out"
grep -q "TREES 8 / 8" "$WORK/trees.out" || { echo "TREES FAILED"; exit 1; }

echo "== the tabletop =="
# Everything that lies on the chart table has to lie ON it. The table came down from
# 3.1 m to 2.5 m and six props were left out past the rim, one of which the owner found.
SERVE_PORT="$SERVE_PORT" CDP_PORT="$CDP_PORT" node "$HERE/cdp.mjs" "$HERE/tabletop.mjs" | tee "$WORK/tabletop.out"
grep -q "TABLETOP OK" "$WORK/tabletop.out" || { echo "TABLETOP FAILED"; exit 1; }

echo "== the glare =="
# "The study props wash out under window sun" has been reported three times and nothing
# could see it, because it is a question about pixels. This one counts them.
SERVE_PORT="$SERVE_PORT" CDP_PORT="$CDP_PORT" node "$HERE/cdp.mjs" "$HERE/glare.mjs" | tee "$WORK/glare.out"
grep -q "GLARE 8 / 8" "$WORK/glare.out" || { echo "GLARE FAILED"; exit 1; }

echo "== the lettered spines =="
# The eighteen gilt volumes in the study spell the one line of canon the game says aloud
# once. Nothing else in the gate can see the MESSAGE — the geometry is fine either way.
SERVE_PORT="$SERVE_PORT" CDP_PORT="$CDP_PORT" node "$HERE/cdp.mjs" "$HERE/spines.mjs" | tee "$WORK/spines.out"
grep -q "SPINES 21 / 21" "$WORK/spines.out" || { echo "SPINES FAILED"; exit 1; }

echo "== the hover glint =="
# The highlight must mark a prop, not replace it. The full-body wash it used to be
# turned the music box into a cream block and flared the desk notice past the bloom
# threshold, and it stepped rather than eased. Both are pinned here.
SERVE_PORT="$SERVE_PORT" CDP_PORT="$CDP_PORT" node "$HERE/cdp.mjs" "$HERE/glint.mjs" | tee "$WORK/glint.out"
grep -q "GLINT 25 / 25" "$WORK/glint.out" || { echo "GLINT FAILED"; exit 1; }

echo "== the walk =="
# CI runs on software GL where 20s real-time cinematics cannot hit wall-clock, so
# CI is the LOGIC GATE: the 33 pumped assertions must pass AND the failure list
# must equal EXACTLY the known realtime set below — any other failure is red.
# The full 45/45 (cinematics included) is the local pre-push bar.
REALTIME_SET='P2.realDive→L2|P2.vista(#135 held+released)|P3.kelpSlate|P5.keeperTwist(realProximity)|P6.embrace+realAscent→L3|P7.returned|P7.phialDried+read|P7.roundWind+all(#131)|P7.shoreNamed(#133)|P8.oarFinale|P8.oarCoda(#134)|P9.bellFinale'
walk_ok() {
  if [ "${CI:-}" = "true" ]; then
    grep -q "WALK PASS 45 / 45" "$WORK/walk.out" && return 0
    grep -q "WALK PASS 33 / 45" "$WORK/walk.out" || return 1
    fails=$(grep "FAILURES:" "$WORK/walk.out" | sed 's/FAILURES: //')
    node -e "
      const fails = JSON.parse(process.argv[1]);
      const allowed = new Set(process.argv[2].split('|'));
      process.exit(fails.every((f) => allowed.has(f)) ? 0 : 1);
    " "$fails" "$REALTIME_SET"
  else
    grep -q "WALK PASS 45 / 45" "$WORK/walk.out"
  fi
}
walk_once() { SERVE_PORT="$SERVE_PORT" CDP_PORT="$CDP_PORT" node "$HERE/cdp.mjs" "$HERE/walk.mjs" | tee "$WORK/walk.out"; walk_ok; }
# one retry: cold-profile shader hitches can eat a timing margin on the first pass;
# a real regression fails both runs (the retry is flake armor, not forgiveness)
if ! walk_once; then
  echo "== first pass failed — one retry =="
  walk_once || { echo "WALK FAILED (twice)"; exit 1; }
fi
[ "${CI:-}" = "true" ] && echo "gate green (CI logic subset; realtime cinematics are the local bar)" || echo "gate green"
