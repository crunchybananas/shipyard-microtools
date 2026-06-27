# 007 - verify-runtime-fallback

## Goal

Unblock graphics verifier startup in restricted environments so the actor-motion polish loop can continue to produce screenshot evidence when local TCP bind is unavailable.

## Starting Point

- Previous handoff: `rounds/006-actor-work-pose-breakup.md`.
- Known blocker: `scripts/_serve.mjs` failed with `HTTP server did not come up on port 4711` because this sandbox disallows local socket bind.
- Round target: make verifier startup robust without reintroducing any SVG/live-renderer paths.

## Changes

- Updated `scripts/_serve.mjs` to expose a `gameUrl` and `mode` (`http` or `file`) in addition to `origin` compatibility for HTTP mode.
- Added startup fallback in `scripts/_serve.mjs`: if Python HTTP server bind fails with permission-denied style errors, verifiers now fall back to `file:///.../index.html` instead of hard failing at server startup.
- Preserved normal HTTP behavior when port binding succeeds (existing external server or launched Python server).
- Updated Playwright verification entrypoints to consume `server.gameUrl`:
  - `scripts/verify.mjs`
  - `scripts/verify-anim.mjs`
  - `scripts/verify-critic.mjs`
  - `scripts/verify-logic.mjs`
  - `scripts/verify-streak-hud.mjs`
  - `scripts/_play-probe.mjs`
- Fixed `scripts/verify.mjs` startup log to print resolved `gameUrl`, mode, and started state.

## Verification

Commands run:

```sh
node --check js/render.js js/ui.js js/main.js js/input.js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs
node scripts/verify-anim.mjs
node scripts/verify-critic.mjs
node scripts/verify.mjs --game --logic
find assets/sprites -maxdepth 1 -name '*.svg' -print
rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" index.html js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs assets/sprites/README.md
```

Outcomes:

- `node --check ...` passed.
- `_serve.mjs` no longer fails on Python bind denial; it now selects `file://` mode in this environment.
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` returned no files.
- `rg -n ...` returned no matches.
- Playwright verifiers remain blocked by environment-level Chromium launch failure:
  - `bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`
  - Affects `verify-anim`, `verify-critic`, and `verify.mjs --game --logic` regardless of HTTP vs file mode.

## Visual Result

No new actor atlas art was baked this round because Chromium cannot launch in this environment, which blocks both atlas-generation workflows that depend on browser canvas execution and screenshot-based visual proof capture.

## Remaining Issues

- Chromium/Playwright launch is blocked by sandbox/system permission constraints, so close 2D proof screenshots still cannot be captured here.
- Actor animation art still needs the next pass (silhouette asymmetry + cloth/payload pose differentiation) once screenshot runtime is available.

## Next Best Target

Run the same round on an environment that allows Chromium launch, then execute the intended actor-motion art pass and capture close 2D screenshots (`anim-live-actors-close.png`, `critic-zoom-close.png`) as proof.

## Files Changed

- `scripts/_serve.mjs`
- `scripts/verify.mjs`
- `scripts/verify-anim.mjs`
- `scripts/verify-critic.mjs`
- `scripts/verify-logic.mjs`
- `scripts/verify-streak-hud.mjs`
- `scripts/_play-probe.mjs`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/007-verify-runtime-fallback.md`
