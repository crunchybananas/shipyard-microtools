#!/usr/bin/env bash
# syntax.sh — parse-check the game's ES modules, for real.
#
# `node --check js/props.js` DOES NOT WORK on these files and does not tell you so.
# There is no package.json here, so node treats a .js file as CommonJS; it then meets
# `import` at the top, and instead of failing it short-circuits and exits 0. Proven:
# append `const x = 0xbfb broken;` to a copy of props.js and
#
#   node --check copy.js   -> exit 0      (silently passes a broken file)
#   node --check copy.mjs  -> exit 1      (SyntaxError, correctly)
#
# I leaned on `node --check` as a gate for a whole session before noticing, and shipped
# a file containing `color: 0xbfb characters` behind a green "syntax ok". The only
# reason it did not reach the browser is that the dev server serves the working tree
# and it would have been the next refresh.
#
#   usage: tools/harness/syntax.sh [files…]      (default: the game's js/)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
ISLAND="$(cd "$HERE/../.." && pwd)"

files=("$@")
if [ ${#files[@]} -eq 0 ]; then
  # shellcheck disable=SC2207
  files=($(ls "$ISLAND"/js/*.js))
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

bad=0
for f in "${files[@]}"; do
  [ -f "$f" ] || { echo "  MISSING  $f"; bad=1; continue; }
  # the extension is the whole trick: as .mjs, node parses it as a module and reports
  cp "$f" "$TMP/$(basename "${f%.js}").mjs"
  if out=$(node --check "$TMP/$(basename "${f%.js}").mjs" 2>&1); then
    printf '  ok       %s\n' "$(basename "$f")"
  else
    printf '  SYNTAX   %s\n' "$(basename "$f")"
    echo "$out" | sed 's/^/           /' | head -6
    bad=1
  fi
done

[ $bad -eq 0 ] && echo "syntax green" || echo "SYNTAX FAILED"
exit $bad
