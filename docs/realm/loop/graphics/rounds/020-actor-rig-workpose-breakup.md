# 020 - actor-rig-workpose-breakup

## Goal

Push actor bitmap animation farther from puppet-like symmetry by adding a role rig layer that intensifies hip shift, cloth fold fan, asymmetric load skew, and role-specific work reach arcs.

## Starting Point

- Previous handoff: `rounds/019-actor-posture-yaw-drape.md`.
- Screenshots inspected: none new in this sandbox (Chromium launch remains blocked).
- Relevant files: `scripts/build-motion-atlases.mjs`, `loop/graphics/CURRENT.md`, `loop/graphics/BACKLOG.md`.

## Changes

- Added `ROLE_RIG` in `scripts/build-motion-atlases.mjs` with per-role controls:
  - `hipShift` for stronger non-mirrored torso side bias,
  - `foldFan` for deeper work cloth fold spread,
  - `loadSkew` for asymmetric payload skew,
  - `toolReach` for role-weighted work slash reach offsets.
- Routed `ROLE_RIG` into `drawActor(...)`:
  - mixed `hipShift` into work side-bias and posture hinge oscillation,
  - mixed `foldFan` into drape snap and fold line amplitudes,
  - mixed `toolReach`/`foldFan` into work slash line endpoints to break mirrored reach silhouettes.
- Routed `ROLE_RIG` into `drawPayload(...)`:
  - added role-weighted `offX` load skew,
  - added `skewNudge` phase signal to all carry payload families.

## Verification

Commands run:

```sh
node --check js/render.js js/ui.js js/main.js js/input.js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs
node --check scripts/build-motion-atlases.mjs
node scripts/verify-anim.mjs
node scripts/verify-critic.mjs
node scripts/verify.mjs --game --logic
find assets/sprites -maxdepth 1 -name '*.svg' -print
rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" index.html js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs assets/sprites/README.md
```

Screenshots:

- none new this run (Chromium blocked).

Browser or Playwright findings:

- `node --check ...` passed.
- `node --check scripts/build-motion-atlases.mjs` passed.
- `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` failed on Chromium launch with:
  `bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`.
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` returned no files.
- `rg -n ...` returned no matches.

## Visual Result

The motion atlas generator now carries a dedicated role rig layer that should produce stronger work-pose silhouette divergence: heavier roles shift hips and reach farther, cloth folds fan with more role separation, and carry payloads skew with less mirrored cadence. Live close 2D screenshot proof remains pending in a Chromium-allowed runtime.

## Remaining Issues

- Chromium launch remains blocked in this sandbox, so close capture proof cannot refresh.
- Atlas rebuild output images cannot be regenerated here while `scripts/build-motion-atlases.mjs` stays Chromium-gated.

## Next Best Target

Run `node scripts/build-motion-atlases.mjs`, `node scripts/verify-anim.mjs`, and `node scripts/verify-critic.mjs` in a Chromium-allowed environment and tune any outlier roles from refreshed close actor screenshots.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/020-actor-rig-workpose-breakup.md`
