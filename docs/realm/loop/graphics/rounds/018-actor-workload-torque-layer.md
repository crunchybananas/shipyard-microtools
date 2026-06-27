# 018 - actor-workload-torque-layer

## Goal

Push actor animation farther from clean puppet symmetry by layering stronger role-specific work torque, cloth snap cadence, and asymmetric carry pack swing into the painted bitmap atlas pipeline.

## Starting Point

- Previous handoff: `rounds/017-actor-task-bias-breakup.md`.
- Screenshots inspected: existing captures only; no new close proofs captured in this sandbox.
- Relevant files: `scripts/build-motion-atlases.mjs`, `loop/graphics/CURRENT.md`, `loop/graphics/BACKLOG.md`.

## Changes

- Added a new `ROLE_WORKLOAD` role map in `scripts/build-motion-atlases.mjs` with per-role controls for:
  - `torque` (work torsion / torso cant amplification),
  - `foldSnap` (cloth fold cadence and snap intensity),
  - `packSwing` (cross-axis carry payload drift).
- Routed `ROLE_WORKLOAD` through `drawActor(...)` and `drawPayload(...)`.
- Increased role-specific torso cant swing during work animation using `workload.torque`.
- Increased work-only cloth skew cadence/amplitude using `workload.foldSnap`.
- Added an extra work-only slash fold stroke that uses workload torque/snap for stronger asymmetry in labor silhouettes.
- Increased carry payload cross-nudge shaping with `workload.packSwing` so role payloads drift less mirror-cleanly across frames.

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

- None newly captured in this sandbox.

Browser or Playwright findings:

- `node --check ...` passed.
- `node --check scripts/build-motion-atlases.mjs` passed.
- `node scripts/build-motion-atlases.mjs` failed at Chromium launch with:
  `bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`.
- `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and
  `node scripts/verify.mjs --game --logic` remain blocked by the same Chromium launch failure.
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` returned no files.
- `rg -n ...` returned no matches (exit code `1`).

## Visual Result

The motion generator now has a dedicated workload layer that should produce more role-specific torque and less mirrored cloth/payload cadence for work and carry frames; however, this sandbox could not relaunch Chromium to rebake atlases or capture fresh close 2D proofs, so visible result confirmation remains pending in a Chromium-allowed environment.

## Remaining Issues

- Atlas rebake is blocked by Chromium launch denial in this sandbox.
- Close 2D screenshot proof (`anim-live-actors-close.png`, `critic-zoom-close.png`) remains pending.

## Next Best Target

Run atlas rebuild plus `verify-anim`/`verify-critic` in a Chromium-allowed environment and capture refreshed close 2D proofs first, because round-018 motion improvements are not yet visually validated in live screenshots.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/018-actor-workload-torque-layer.md`
