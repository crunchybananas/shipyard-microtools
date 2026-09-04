#!/usr/bin/env bash
# run.sh — the release gate, end to end: static server + headless Chrome + the
# 64-assertion full-game walk + the field-note contract. Exit 0 = ship.
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
node "$HERE/coverage.mjs" | tee "$WORK/coverage.out"
grep -q "COVERAGE PASS 21 / 21" "$WORK/coverage.out" || { echo "COVERAGE FAILED"; exit 1; }

echo "== runtime reset ownership =="
# Begin, debug reset, delayed puzzle work, intro copy, and score nodes share one
# cancellable boundary. A fresh run must never hear or see the run it replaced.
SERVE_PORT="$SERVE_PORT" CDP_PORT="$CDP_PORT" node "$HERE/cdp.mjs" "$HERE/runtime-reset.mjs" | tee "$WORK/runtime-reset.out"
grep -q "RUNTIME-RESET PASS 6 / 6" "$WORK/runtime-reset.out" || { echo "RUNTIME RESET FAILED"; exit 1; }

echo "== the upstream hand =="
# The L2 valve's delayed answer is causal, physical, and one-shot: make one real
# upstream valve mark under a separate local identity, stage the whole event, and
# prove its +0.06 surge, cleanup, save/reload behavior, and render budget.  The
# script always uses ?localstack, so neither identity can publish a test mark.
SERVE_PORT="$SERVE_PORT" CDP_PORT="$CDP_PORT" node "$HERE/cdp.mjs" "$HERE/upstream-hand.mjs" | tee "$WORK/upstream-hand.out"
grep -q "UPSTREAM-HAND 32 / 32" "$WORK/upstream-hand.out" || { echo "UPSTREAM HAND FAILED"; exit 1; }

echo "== the writing in the sand =="
# The one mark that travels downhill without harm: a bounded line survives outside
# the save, appears on the next rung, and renders increasingly weathered on dry terrain.
# ?localstack is built into writing.mjs so a gate can never publish test prose.
SERVE_PORT="$SERVE_PORT" CDP_PORT="$CDP_PORT" node "$HERE/cdp.mjs" "$HERE/writing.mjs" | tee "$WORK/writing.out"
grep -q "WRITING 19 / 19" "$WORK/writing.out" || { echo "WRITING FAILED"; exit 1; }

echo "== the finished terrain =="
# The beach relief must be one continuous analytic field rather than a repeated tile; the
# visible water/foam contact must use the denser 512² depth field over a sub-metre,
# topology-preserving coast; and high daylight must regain native MSAA instead of
# going through the non-antialiased bloom target.
SERVE_PORT="$SERVE_PORT" CDP_PORT="$CDP_PORT" node "$HERE/cdp.mjs" "$HERE/terrain-finish.mjs" | tee "$WORK/terrain-finish.out"
grep -q "TERRAIN-FINISH 10 / 10" "$WORK/terrain-finish.out" || { echo "TERRAIN FINISH FAILED"; exit 1; }

echo "== the player-facing journey =="
# The ChallengeGraph walk proves flags can be earned; this proves the notebook contains
# only observed evidence, renders its physical spread at both breakpoints, waits until a
# reader closes to speak, and reveals help only when Trace a lead is explicitly pressed.
SERVE_PORT="$SERVE_PORT" CDP_PORT="$CDP_PORT" node "$HERE/cdp.mjs" "$HERE/experience.mjs" | tee "$WORK/experience.out"
grep -q "EXPERIENCE PASS 22 / 22" "$WORK/experience.out" || { echo "EXPERIENCE FAILED"; exit 1; }

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

echo "== the gulls =="
# At dawn one gull leaves the gyre for the gallery rail. It used to get there in a
# straight line THROUGH the lantern and the dome, and the owner photographed it mid-flight
# with a wing out through the copper.
SERVE_PORT="$SERVE_PORT" CDP_PORT="$CDP_PORT" node "$HERE/cdp.mjs" "$HERE/gulls.mjs" | tee "$WORK/gulls.out"
grep -q "GULLS 7 / 7" "$WORK/gulls.out" || { echo "GULLS FAILED"; exit 1; }

echo "== the lens-vault outcrop =="
# The slab reveals a shallow niche, not a room. The irregular boulder must stay
# solid before and after the bird puzzle, while the lens stays reachable outside it.
SERVE_PORT="$SERVE_PORT" CDP_PORT="$CDP_PORT" node "$HERE/cdp.mjs" "$HERE/vault-outcrop.mjs" | tee "$WORK/vault-outcrop.out"
grep -q "VAULT-OUTCROP 8 / 8" "$WORK/vault-outcrop.out" || { echo "VAULT OUTCROP FAILED"; exit 1; }

echo "== the trees =="
# The canopy's detail rides on a custom attribute and three shader-chunk replacements, and
# both die silently — a dropped attribute reads as 0 in GLSL, a replace that matches
# nothing is a no-op. Neither reports anything; the trees just go back to folded paper.
SERVE_PORT="$SERVE_PORT" CDP_PORT="$CDP_PORT" node "$HERE/cdp.mjs" "$HERE/trees.mjs" | tee "$WORK/trees.out"
grep -q "TREES 13 / 13" "$WORK/trees.out" || { echo "TREES FAILED"; exit 1; }

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

echo "== the signal index =="
# Eight manuals route the beam's figures to named physical instruments. The index must
# stay complete without printing values, becoming a sentence, or selecting the order.
SERVE_PORT="$SERVE_PORT" CDP_PORT="$CDP_PORT" node "$HERE/cdp.mjs" "$HERE/spines.mjs" | tee "$WORK/spines.out"
grep -q "SPINES 20 / 20" "$WORK/spines.out" || { echo "SPINES FAILED"; exit 1; }

echo "== the hover glint =="
# The highlight must mark a prop, not replace it. The full-body wash it used to be
# turned the music box into a cream block and flared the desk notice past the bloom
# threshold, and it stepped rather than eased. Both are pinned here.
SERVE_PORT="$SERVE_PORT" CDP_PORT="$CDP_PORT" node "$HERE/cdp.mjs" "$HERE/glint.mjs" | tee "$WORK/glint.out"
grep -q "GLINT 25 / 25" "$WORK/glint.out" || { echo "GLINT FAILED"; exit 1; }

echo "== the walk =="
# Every puzzle action goes through its shipped hotspot. Crossing travel uses the public
# instant transition so local and software-GL runs enforce the same 64 assertions: the
# instrument-routed decoder, every depth gate, held regard, return, and all dispositions.
SERVE_PORT="$SERVE_PORT" CDP_PORT="$CDP_PORT" node "$HERE/cdp.mjs" "$HERE/walk.mjs" | tee "$WORK/walk.out"
grep -q "WALK PASS 64 / 64" "$WORK/walk.out" || { echo "WALK FAILED"; exit 1; }
echo "gate green"
