# 093 - performance-builder-walk

## Goal

Keep improving actor animation quality while fixing the runtime performance
issue that made otherwise-clean sprite rows feel choppy in game.

## Changes

- Added adaptive render-loop performance handling in `js/main.js`:
  - hidden tabs no longer render, postprocess, and minimap-update in a hot loop
  - minimap redraws are throttled to every 6 visible frames
  - post-processing is automatically suspended when actual rAF cadence or
    render cost becomes unhealthy
  - `G.debug.perf` now exposes frame timing, rAF timing, postfx suspension, and
    minimap cadence
- Reduced low-zoom terrain draw cost in `js/render.js`:
  - close-up terrain micro-ornaments now require inspection zoom
  - side faces, haze overlays, and tiny noise specks are skipped at normal
    gameplay zoom
  - actor/building/terrain sprite rendering remains live at normal zoom
- Replaced the full builder `walk` action block with bitmap-painted rows:
  - generated `walk/down`, `walk/up`, and `walk/left`
  - mirrored `walk/left` into `walk/right`
  - packed all rows through `scripts/pack-generated-sprite-strip.py`
  - inserted only the four builder walk rows into
    `assets/sprites/actors/builder.png`
- Rebuilt `assets/sprites/actors-atlas.png` and `assets/sprites/ambient-atlas.png`.

## Proofs

- Old/new builder walk proof:
  `tmp/realm-graphics-round-093/builder-walk-proof-x4.png`
- Accepted walk-down row:
  `tmp/realm-graphics-round-093/builder-walk-down/row-walk-down.png`
- Accepted walk-up row:
  `tmp/realm-graphics-round-093/builder-walk-up/row-walk-up.png`
- Accepted walk-left row:
  `tmp/realm-graphics-round-093/builder-walk-left/row-walk-left.png`
- Mirrored walk-right row:
  `tmp/realm-graphics-round-093/builder-walk-left/row-walk-right.png`
- Pre-replacement source backup for this round:
  `tmp/realm-graphics-round-093/builder-before.png`
- Refreshed audit sheet:
  `scripts/screenshots/sprite-audit-worst-rows.png`

## Audit Result

Before this pass:

```text
builder/walk/down  score=134.0
builder/walk/up    score=69.4
builder/walk/left  score=135.2
builder/walk/right score=68.3
```

After replacement:

```text
builder/walk/down  score=0.0 center=1.0 widthRange=2  heightRange=1 pixelRatio=1.04 fragments=0/0
builder/walk/up    score=0.0 center=0.7 widthRange=1  heightRange=0 pixelRatio=1.02 fragments=0/0
builder/walk/left  score=0.0 center=2.5 widthRange=11 heightRange=1 pixelRatio=1.08 fragments=0/0
builder/walk/right score=0.0 center=2.5 widthRange=11 heightRange=1 pixelRatio=1.08 fragments=0/0
```

The top remaining old-port rows are now builder `work/down`, builder
`work/left`, blacksmith work rows, `guard/walk/down`, and rancher/miner/farmer
walk rows.

## Performance Result

Headless 1280x720 fresh-game rAF probe:

```text
before loop changes: about 8 FPS
after postfx/minimap throttling: about 20 FPS
after terrain low-zoom simplification and rAF-based postfx suspension: about 32 FPS
```

The final probe reported:

```text
avgMs=31.17 fps=32.1 p95Ms=34.3 p99Ms=50.1 postFxSuspended=true minimapInterval=6
```

This is not the end of performance work, but it removes the worst stall and
makes sprite animation playback much more credible in the live game.

## Verification

Commands run:

```sh
env PATH=/opt/homebrew/bin:$PATH node scripts/build-motion-atlases.mjs
node scripts/audit-sprite-frames.mjs
node --check js/main.js
node --check js/render.js
node --check js/citizens.js
node --check scripts/audit-sprite-frames.mjs
env PYTHONPYCACHEPREFIX=/private/tmp/realm-pycache python3 -m py_compile scripts/pack-generated-sprite-strip.py
/opt/homebrew/bin/magick identify assets/sprites/actors/builder.png assets/sprites/actors-atlas.png assets/sprites/ambient-atlas.png
node scripts/verify-anim.mjs
node scripts/verify.mjs --game --logic
node scripts/verify-critic.mjs
```

Notes:

- `assets/sprites/actors/builder.png` remains `512x1344`.
- `assets/sprites/actors-atlas.png` remains `512x18816`.
- `assets/sprites/ambient-atlas.png` remains `192x48`.
- `node scripts/verify-anim.mjs` passed with no page errors.
- `node scripts/verify.mjs --game --logic` passed; console output contained
  only the known GPU `ReadPixels` performance warning.
- `node scripts/verify-critic.mjs` passed with no page errors.

## Remaining Issues

- Builder `work/down` and `work/left` are now the highest audit outliers and
  need a dedicated building/hammering strip, not a reused walk cycle.
- Blacksmith work rows still use the old derived style.
- The performance pass is adaptive rather than a full terrain cache; a future
  cache pass can target stable 60 FPS if needed.
