# 021 - actor-stance-payload-breakup

## Goal

Push actor bitmap motion further beyond puppet symmetry by adding a role-stance layer that increases lead-hand bias, shoulder imbalance, cloth fold sweep, and asymmetric carry payload lobe drift.

## Starting Point

- Previous handoff: `rounds/020-actor-rig-workpose-breakup.md`.
- Screenshots inspected: none new in this sandbox (Chromium launch remains blocked).
- Relevant files: `scripts/build-motion-atlases.mjs`, `assets/sprites/actors-atlas.png`, `loop/graphics/CURRENT.md`, `loop/graphics/BACKLOG.md`.

## Changes

- Added `ROLE_STANCE` in `scripts/build-motion-atlases.mjs` with per-role controls:
  - `leadHand` for dominant-side arm anchor drift,
  - `offShoulder` for work shoulder height imbalance,
  - `foldSweep` for stronger directional cloth fold diagonals,
  - `payloadLobe` for role-specific carry lobe asymmetry.
- Routed `ROLE_STANCE` into `drawActor(...)`:
  - biased left/right hand X/Y anchors by role lead-hand and off-shoulder values,
  - added an extra cloth fold diagonal keyed to `foldSweep` to deepen role-specific work silhouette breakup.
- Routed `ROLE_STANCE` into `drawPayload(...)`:
  - added phase-driven `lobeNudge` that perturbs carry-body offset,
  - applied lobe asymmetry to builder/heavy/default payload families so carried loads read less mirrored.
- Rebuilt atlases with `node scripts/build-motion-atlases.mjs`, producing updated `assets/sprites/actors-atlas.png` and `assets/sprites/ambient-atlas.png`.

## Verification

Commands run:

```sh
node --check js/render.js js/ui.js js/main.js js/input.js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs scripts/build-motion-atlases.mjs
node scripts/build-motion-atlases.mjs
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
- `node scripts/build-motion-atlases.mjs` passed and rewrote the actor/ambient PNG atlases.
- `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` failed on Chromium launch with:
  `bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`.
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` returned no files.
- `rg -n ...` returned no matches.

## Visual Result

The painted actor atlas now has stronger role-specific asymmetry in work/carry poses: dominant-hand reach offsets are less mirrored, shoulders ride at more distinct heights under load, cloth folds sweep directionally by role, and carry volumes wobble with asymmetric lobe drift rather than uniform pendulum motion. Live close 2D screenshot proof remains pending in a Chromium-allowed runtime.

## Remaining Issues

- Chromium launch remains blocked in this sandbox, so close capture proof cannot refresh.
- Outlier role tuning still needs screenshot-backed review after this stance layer.

## Next Best Target

Run `node scripts/verify-anim.mjs` and `node scripts/verify-critic.mjs` in a Chromium-allowed environment, review refreshed close shots, and tune any roles that still read mirrored in work/carry cadence.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `assets/sprites/actors-atlas.png`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/021-actor-stance-payload-breakup.md`
