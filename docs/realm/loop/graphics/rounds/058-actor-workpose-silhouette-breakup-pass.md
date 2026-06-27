# 058 - actor-workpose-silhouette-breakup-pass

## Goal

Push actor bitmap work/carry motion further beyond puppet cadence using stronger role-separated silhouette offsets, deeper cloth fold breakup, and more asymmetric payload/hand cadence, with updated close proof output for the canonical 2D atlas.

## Starting Point

- Previous handoff: `rounds/057-actor-workpose-asymmetric-load-pass.md`.
- Relevant files: `scripts/build-motion-atlases.mjs`.
- Chromium-backed verifier scripts are still sandbox-constrained in this environment.

## Changes

- Advanced close proof export target:
  - `scripts/screenshots/actors-workpose-close-round-058.png`
- Updated proof panel label text to round 058.
- Increased `ROLE_WORKPOSE_TABLEAU` values across all roles to strengthen:
  - silhouette snap,
  - cloth fold pinch,
  - asymmetric payload cant,
  - role-specific pose-set hand cadence.
- Increased tableau dynamics in synthesis:
  - stronger `workposeTableauPulse` frequency/amplitude,
  - stronger `workposeTableauRhythm` frequency/amplitude.
- Strengthened late-stage tableau fold stroke geometry/amplitude in `drawActor(...)` for more visible silhouette breakup.
- Increased left/right hand asymmetry weighting from tableau pose/rhythm terms to reduce mirrored arm cadence.

## Verification

Commands run:

```sh
node --check js/render.js js/ui.js js/main.js js/input.js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs
node scripts/build-motion-atlases.mjs
node scripts/verify-anim.mjs
node scripts/verify-critic.mjs
node scripts/verify.mjs --game --logic
find assets/sprites -maxdepth 1 -name '*.svg' -print
rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" index.html js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs assets/sprites/README.md
```

Results:

- `node --check ...` passed.
- `node scripts/build-motion-atlases.mjs` passed and wrote:
  - `assets/sprites/actors-atlas.png`
  - `assets/sprites/ambient-atlas.png`
  - `scripts/screenshots/actors-workpose-close-round-058.png`
- `node scripts/verify-anim.mjs` failed: Chromium launch denial (`bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`).
- `node scripts/verify-critic.mjs` failed with the same Chromium launch denial.
- `node scripts/verify.mjs --game --logic` failed with the same Chromium launch denial.
- `find assets/sprites -maxdepth 1 -name '*.svg' -print` produced no output.
- `rg -n ...` produced no matches.

## Visual Result

Round 058 further exaggerates role-separated labor silhouettes in the painted atlas path, with deeper fold slash breakup and more uneven hand/payload cadence. A refreshed close proof PNG was generated at `scripts/screenshots/actors-workpose-close-round-058.png`.

## Remaining Issues

- Playwright-driven live verifier screenshots (`verify-anim`, `verify-critic`, `verify.mjs --game --logic`) remain blocked by Chromium launch denial in this sandbox.

## Next Best Target

Run `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic` in a Chromium-allowed environment, then inspect refreshed close captures against `scripts/screenshots/actors-workpose-close-round-058.png` and tune any remaining mirrored role cadence outliers.

## Files Changed

- `scripts/build-motion-atlases.mjs`
- `loop/graphics/CURRENT.md`
- `loop/graphics/BACKLOG.md`
- `loop/graphics/rounds/058-actor-workpose-silhouette-breakup-pass.md`
