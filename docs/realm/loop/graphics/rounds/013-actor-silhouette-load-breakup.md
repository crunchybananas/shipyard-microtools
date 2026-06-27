# 013 - actor-silhouette-load-breakup

## Goal

Push actor bitmap motion further past puppet-like cadence by increasing role-specific torso skew, cloth fold depth, and asymmetric carry load width/drop so each job silhouette reads more distinct in close 2D animation.

## Starting Point

- Previous handoff: `rounds/012-actor-workpose-gait-drag-pass.md`.
- Screenshot baseline: `scripts/screenshots/critic-zoom-close.png` (existing file from May 19); `scripts/screenshots/anim-live-actors-close.png` is still absent in this sandbox.
- Relevant files: `scripts/build-motion-atlases.mjs`, `assets/sprites/actors-atlas.png`, `assets/sprites/ambient-atlas.png`, `loop/graphics/CURRENT.md`, `loop/graphics/BACKLOG.md`.

## Changes

- Added a new `ROLE_SILHOUETTE` map in `scripts/build-motion-atlases.mjs` with per-role `torsoSkew`, `foldDepth`, `loadWidth`, and `loadDrop` controls.
- Wired silhouette skew into `bodyX` offsets so work/carry frames lean and offset differently by role beyond gait-phase timing alone.
- Extended cloth breakup with two additional role-sensitive fold strokes driven by `foldDepth`, `torsoSkew`, `hemWave`, and `hemTorque`.
- Expanded carry payload shaping in `drawPayload(...)` so role load geometry now responds to `loadWidth` and `loadDrop`; heavy roles (builder/blacksmith/miner/stonecutter) get chunkier, lower-hanging asymmetric bundles.
- Rebuilt atlases with `node scripts/build-motion-atlases.mjs`; refreshed `assets/sprites/actors-atlas.png` and `assets/sprites/ambient-atlas.png`.
- Kept all work in the canonical painted PNG atlas path; no SVG sprite/runtime/fallback paths were reintroduced.

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

Results:

- `node --check ...` and `node --check scripts/build-motion-atlases.mjs` passed.
- `node scripts/build-motion-atlases.mjs` passed and rewrote actor/ambient atlases.
- `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` failed at Chromium launch with sandbox denial:
  `bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`.
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` returned no files.
- `rg -n ...` returned no matches (exit code `1`).

## Visual Result

Round 013 deepens role silhouette contrast in the baked bitmap motion: heavy labor roles now drag wider/lower carry masses and torque torso mass farther off center, while lighter roles retain tighter carry envelopes. Cloth folds also break up with stronger directional asymmetry, reducing mirrored puppet-like reads during work/carry loops.

## Remaining Issues

- Chromium launch is still blocked in this sandbox, so close 2D proof screenshots could not be refreshed.
- `scripts/screenshots/anim-live-actors-close.png` still needs capture in a Chromium-allowed environment.
- `scripts/screenshots/critic-zoom-close.png` exists but was not refreshed this round.

## Next Best Target

Run `verify-anim`, `verify-critic`, and `verify.mjs --game --logic` where Chromium can launch, capture refreshed close actor screenshots, then tune any remaining mirrored role cadence visible after rounds 009-013.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `assets/sprites/actors-atlas.png`
- `assets/sprites/ambient-atlas.png`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/013-actor-silhouette-load-breakup.md`
