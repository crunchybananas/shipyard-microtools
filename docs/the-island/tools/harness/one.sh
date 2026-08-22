#!/usr/bin/env bash
# one.sh — run ONE harness script against a fresh server + headless Chrome.
#
# run.sh brings up the server and the browser and then runs the whole gate. Every
# visual or exploratory pass wants the same two processes and exactly one script,
# and hand-rolling that each time is how you end up running a script against a
# server that is serving someone else's port, or against a Chrome that died.
#
#   tools/harness/one.sh path/to/script.mjs [more.mjs …]
#   SERVE_PORT=8261 CDP_PORT=9455 SHOT_DIR=/tmp/shots tools/harness/one.sh glint.mjs
#
# Pick ports that are not 8642/9223 (run.sh's defaults) and not 8650 (the play server
# in .claude/launch.json) if any of those might be up.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
SERVE_PORT="${SERVE_PORT:-8642}"
CDP_PORT="${CDP_PORT:-9223}"
[ $# -ge 1 ] || { echo "usage: one.sh script.mjs [script.mjs …]"; exit 2; }

if [ -z "${CHROME_BIN:-}" ]; then
  for c in "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
           "$(command -v google-chrome || true)" "$(command -v chromium-browser || true)"; do
    [ -x "$c" ] && CHROME_BIN="$c" && break
  done
fi
[ -z "${CHROME_BIN:-}" ] && { echo "no chrome found; set CHROME_BIN"; exit 2; }

WORK="$(mktemp -d)"
cleanup() { kill "${SRV_PID:-}" "${CHROME_PID:-}" 2>/dev/null; wait 2>/dev/null; rm -rf "$WORK" 2>/dev/null; }
trap cleanup EXIT

SERVE_PORT="$SERVE_PORT" python3 "$HERE/serve.py" > "$WORK/serve.log" 2>&1 & SRV_PID=$!
# no --disable-gpu: new headless kills WebGL under it
"$CHROME_BIN" --headless=new --remote-debugging-port="$CDP_PORT" \
  --autoplay-policy=no-user-gesture-required --mute-audio \
  --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows \
  --window-size=1280,800 --user-data-dir="$WORK/profile" about:blank \
  > "$WORK/chrome.log" 2>&1 & CHROME_PID=$!

for i in $(seq 1 30); do curl -sf "http://127.0.0.1:$CDP_PORT/json/version" >/dev/null && break; sleep 1; done
curl -sf "http://127.0.0.1:$CDP_PORT/json/version" >/dev/null || { echo "chrome CDP never came up"; exit 2; }
curl -sf "http://127.0.0.1:$SERVE_PORT/the-island/" >/dev/null || { echo "server never came up on $SERVE_PORT"; exit 2; }

rc=0
for s in "$@"; do
  # accept a bare name, a harness-relative name, or any path
  p="$s"; [ -f "$p" ] || p="$HERE/$s"
  [ -f "$p" ] || { echo "no such script: $s"; rc=1; continue; }
  echo "== $(basename "$p") =="
  SERVE_PORT="$SERVE_PORT" CDP_PORT="$CDP_PORT" node "$HERE/cdp.mjs" "$p" || rc=1
done
exit $rc
