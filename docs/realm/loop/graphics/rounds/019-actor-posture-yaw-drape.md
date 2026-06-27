# 019 - actor-posture-yaw-drape

## Goal

Push actor animation farther from puppet-like symmetry by adding a role-specific posture layer that increases work-pose hinge offsets, cloth drape snap, shoulder lead timing, and carry payload yaw drift.

## Starting Point

- Previous handoff: `rounds/018-actor-workload-torque-layer.md`.
- Relevant files: `scripts/build-motion-atlases.mjs`, `loop/graphics/CURRENT.md`, `loop/graphics/BACKLOG.md`.
- Sandbox still blocks Chromium launch, so this round targets atlas generator shaping and verification invariants.

## Changes

- Added `ROLE_POSTURE` in `scripts/build-motion-atlases.mjs` with per-role controls:
  - `hinge` for work torso/body hinge displacement,
  - `drape` for cloth drape snap amplitude,
  - `shoulderLead` for shoulder hitch phase/intensity,
  - `payloadYaw` for carry payload cross-yaw drift.
- Routed `ROLE_POSTURE` into `drawActor(...)`:
  - added `postureHinge` into `bodyX` shaping during work,
  - increased `shoulderHitch` phase/strength with `shoulderLead`,
  - added `drapeSnap` modulation to opposing cloth fold lines.
- Routed `ROLE_POSTURE` into `drawPayload(...)`:
  - added `yawNudge` and applied it across role payload variants to reduce mirrored carry offsets.

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

Results:

- `node --check ...` passed.
- `node --check scripts/build-motion-atlases.mjs` passed.
- `node scripts/verify-anim.mjs` failed on Chromium launch:
  `bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`.
- `node scripts/verify-critic.mjs` failed on the same Chromium launch error.
- `node scripts/verify.mjs --game --logic` failed on the same Chromium launch error.
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` returned no files.
- `rg -n ...` returned no matches.

## Visual Result

The motion generator now has an explicit role posture layer that should make work frames read with stronger hinge and cloth asymmetry and make carry frames drift less mirror-cleanly through payload yaw variance. Live close 2D screenshot proof is still pending in a Chromium-allowed environment.

## Remaining Issues

- Chromium launch remains blocked in this sandbox, preventing atlas rebuild and live screenshot verification.
- Close proofs remain pending: `scripts/screenshots/anim-live-actors-close.png` and `scripts/screenshots/critic-zoom-close.png`.

## Next Best Target

Run `node scripts/build-motion-atlases.mjs`, `node scripts/verify-anim.mjs`, and `node scripts/verify-critic.mjs` where Chromium can launch, then tune any outlier roles from the refreshed close captures.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/019-actor-posture-yaw-drape.md`
