# Graphics checkpoint — September 10, 2026

The owner requested: “lets find a place where you can commit abd push and then
pause”. This is a checkpoint of completed work through Round 213, on
`codex/graphics-checkpoint-round-213`, based on `972db16e`. It does not complete
the wider graphics goal. Do not resume implementation, asset generation or test
campaigns until the owner asks to continue.

## Included in the checkpoint

Rounds 200–213 bring the Founder and adult settlers/builders into the game with
eight-direction authored animation, repaired anatomy and gestures, grounded
motion, continuous terrain and roads, source-aligned snow and lighting, and
three saved Blender house variants with four tiers and sixteen construction
stages. Editable scenes, generated assets, local Three.js tooling, the walk
studio, integration code and their verification scripts are included. Runtime
198, simulation 11, save 7 and `realm.engine-v2` remain the current contracts.

The detailed evidence and remaining defects are recorded in
[Round 213](rounds/213-carpentered-homes-and-visible-construction.md) and the
earlier round reports. Completed validation includes Chrome and WebKit house
source/game gates, all 394 house outputs reproducing byte for byte, builder
motion/construction/touch gates in both engines, 68 CORE/shell checks and a
final 24-check shell pass. The 7,200-tick town completes 21 buildings with an
unchanged simulation save and no unwanted gait changes in 4,787 stationary
observations. Lint, the module graph and whitespace checks passed. Native
Safari construction, roof selection and Save/Continue were reviewed directly.
These are the completed checks, not a claim that every possible game regression
or the full AAA quality standard has passed.

The final staged whitespace check passes for project-owned files. The vendored
Three.js source retains one upstream space-before-tab warning; it is preserved
without a local formatting patch.

Local logs, captures and generated clean-rebuild evidence remain under
`tmp/graphics-world/` and `tmp/house-sprites/`; those ignored directories are not
part of the pushed checkpoint. The running local preview is left available.
The isolated native Safari review town is saved, paused and muted.

## Local work deliberately outside the commit

- `js/world-picking.js`: an unused candidate for recording drawn world bodies
  and selecting their visible pixels in reverse painter order. It is not
  imported by the game. Its alpha cache, clipping and pointer behavior still
  require integration, review and verification.
- `scripts/verify-visible-world-picking.mjs`: an unfinished independent pixel
  oracle for construction plots beside citizens, roof occlusion, foreground
  citizens and open frames. It is not registered in `verify-realm.mjs`. The
  baseline attempt timed out at tutorial startup; it has not produced valid
  case results. The diagnostic log is
  `tmp/graphics-world/picking-baseline-214.log`.

Both files are preserved locally. No production source changed for Round 214.
The known oversized citizen hit circle can still steal a site/roof click, as
observed in native Safari; the completed Round 213 tests do not claim otherwise.

## Resume when requested

First repair the new selection fixture's startup wait and capture trustworthy
baseline failures. Then review and integrate visible-body picking with the
actual painter order, clip shapes and touch behavior, and verify it in Chrome,
WebKit and the actual game. Avoid replacing production drawing with a global
canvas monkeypatch. Keep selection changes separate from simulation state.

Subsequent known work includes the premature “House built!” placement message,
tutorial persistence after Continue, remaining older profession/building art,
character/door scale, generic ambient marks, the overall night curve and hard
winter lake boundaries. Continue inspecting growing-town traffic and performance
as the visual work expands. No new work on these items is authorized during
this pause.
