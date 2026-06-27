# 017 - actor-task-bias-breakup

## Goal

Push actor work/carry motion farther from puppet symmetry using stronger role-specific side bias, cloth skew, elbow asymmetry, and load drift so silhouettes read more task-specific in the painted atlas.

## Starting Point

- Previous handoff: `rounds/016-actor-pose-accent-layer.md`.
- Screenshots inspected: prior existing captures only; no newly captured close proofs in this sandbox.
- Relevant files: `scripts/build-motion-atlases.mjs`, `assets/sprites/actors-atlas.png`, `loop/graphics/CURRENT.md`, `loop/graphics/BACKLOG.md`.

## Changes

- Added `ROLE_TASK` in `scripts/build-motion-atlases.mjs` with per-role controls for:
  - `sideBias` (work stance offset / silhouette weight direction),
  - `elbowBias` (role-specific arm/elbow imbalance under load/work),
  - `foldBias` (cloth fold skew amount),
  - `loadBias` (carry payload asymmetry amplification).
- Routed `ROLE_TASK` through `drawActor(...)` and `drawPayload(...)`.
- Increased role-distinct body offset in work poses by injecting `sideBiasShift` into `bodyX`.
- Added `workSkew` driven by role task bias and phase, then applied it to cloth fold endpoints and work-only slash folds to avoid mirrored fold cadence.
- Increased working arm asymmetry by biasing `armSwing` phase/amplitude and left/right hand Y offsets with `elbowBias`.
- Expanded carry payload offset/nudge using `task.loadBias` and `task.sideBias` in payload drift equations.
- Rebuilt painted atlases with `node scripts/build-motion-atlases.mjs`, writing:
  - `assets/sprites/actors-atlas.png`
  - `assets/sprites/ambient-atlas.png`

## Verification

Commands run:

```sh
node --check js/render.js js/ui.js js/main.js js/input.js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs
node --check scripts/build-motion-atlases.mjs
node scripts/build-motion-atlases.mjs
node scripts/verify-anim.mjs
node scripts/verify-critic.mjs
node scripts/verify.mjs --game --logic
find assets/sprites -maxdepth 1 -name '*.svg' -print
rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" index.html js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs assets/sprites/README.md
```

Screenshots:

- None newly captured in this sandbox (Chromium launch blocked for verify scripts).

Browser or Playwright findings:

- `node --check ...` passed.
- `node --check scripts/build-motion-atlases.mjs` passed.
- `node scripts/build-motion-atlases.mjs` passed and rewrote actor/ambient PNG atlases.
- `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` failed at Chromium launch with:
  `bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`.
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` returned no files.
- `rg -n ...` returned no matches (exit code `1`).

## Visual Result

Atlas motion shaping is now more role-weighted and less mirrored: heavy labor roles (builder/blacksmith/lumber/miner) lean and fold harder to one side with stronger elbow/load imbalance, while lighter roles stay calmer but still non-symmetric. This pass materially increases silhouette drift and cloth fold breakup in work/carry frames in the canonical painted actor atlas.

## Remaining Issues

- Close 2D screenshot proof (`anim-live-actors-close.png`, `critic-zoom-close.png`) is still blocked by Chromium launch permissions in this sandbox.
- Final visual tuning of outlier roles must wait for fresh close captures in a Chromium-allowed environment.

## Next Best Target

Run `verify-anim` and `verify-critic` in a Chromium-allowed runtime and capture fresh close 2D shots, then tune any remaining mirrored role cadence using `ROLE_TASK` outliers first.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `assets/sprites/actors-atlas.png`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/017-actor-task-bias-breakup.md`
