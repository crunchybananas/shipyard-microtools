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
"$CHROME_BIN" --headless=new --remote-debugging-port="$CDP_PORT" \
  --autoplay-policy=no-user-gesture-required --mute-audio \
  --window-size=1280,800 --user-data-dir="$WORK/profile" about:blank \
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
echo "== the walk =="
walk_once() { SERVE_PORT="$SERVE_PORT" CDP_PORT="$CDP_PORT" node "$HERE/cdp.mjs" "$HERE/walk.mjs" | tee "$WORK/walk.out"; grep -q "WALK PASS 45 / 45" "$WORK/walk.out"; }
# one retry: cold-profile shader hitches can eat a timing margin on the first pass;
# a real regression fails both runs (the retry is flake armor, not forgiveness)
if ! walk_once; then
  echo "== first pass failed — one retry =="
  walk_once || { echo "WALK FAILED (twice)"; exit 1; }
fi
echo "gate green"
