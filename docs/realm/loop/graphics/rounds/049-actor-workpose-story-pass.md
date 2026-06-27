# 049 - actor-workpose-story-pass

## Goal

Push actor bitmap motion beyond puppet symmetry by adding a role-specific
story layer for stronger silhouette breaks, cloth drape/fold breakup,
asymmetric payload skew, and hand tuck cadence.

## Starting Point

- Previous handoff: `rounds/048-actor-workpose-taskform-pass.md`.
- Screenshots inspected: previous close references plus fresh round proof output.
- Relevant files: `scripts/build-motion-atlases.mjs`, `loop/graphics/CURRENT.md`, `loop/graphics/BACKLOG.md`.

## Changes

- Added `ROLE_WORKPOSE_STORY` in `scripts/build-motion-atlases.mjs` with per-role:
  - `silhouetteBreak`
  - `foldDrape`
  - `payloadSkew`
  - `handTuck`
- Advanced round proof export target to:
  - `scripts/screenshots/actors-workpose-close-round-049.png`
- Wired `ROLE_WORKPOSE_STORY` through `drawActor(...)`:
  - extended silhouette displacement,
  - added `workposeStoryWarp` and `workposeStoryRhythm`,
  - added an extra deep work-only story-fold stroke,
  - added stronger left/right hand tuck cadence breakup.
- Wired `ROLE_WORKPOSE_STORY` through `drawPayload(...)`:
  - extended carry pulse drift and width shaping with `workposeStoryPulse`.
- Rebuilt painted motion atlases:
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

- New close proof generated:
  - `scripts/screenshots/actors-workpose-close-round-049.png`

Browser or Playwright findings:

- `node --check ...` passed.
- `node --check scripts/build-motion-atlases.mjs` passed.
- `node scripts/build-motion-atlases.mjs` passed and wrote atlas/proof PNGs.
- `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` failed at Chromium launch with:
  - `bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`.
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` returned no files.
- `rg -n ...` returned no matches.

## Visual Result

Actor motion now includes an additional role-specific story layer that
amplifies silhouette break asymmetry, deepens cloth-drape breakup, skews
carried payloads more unevenly, and further desyncs hand cadence to read
less puppet-like in close bitmap proof output.

## Remaining Issues

- Chromium launch denial still blocks live `verify-anim`, `verify-critic`,
  and `verify.mjs --game --logic` screenshot proof in this sandbox.
- Role-by-role outlier tuning from live verify close captures remains pending.

## Next Best Target

Run `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and
`node scripts/verify.mjs --game --logic` where Chromium can launch, then
retune any outlier role cadence from refreshed close captures
(`anim-live-actors-close.png`, `critic-zoom-close.png`) against
`actors-workpose-close-round-049.png`.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/049-actor-workpose-story-pass.md`
