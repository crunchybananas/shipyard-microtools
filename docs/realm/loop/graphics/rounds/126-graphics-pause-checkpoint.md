# Round 126 — Graphics Pause Checkpoint

Date: 2026-08-01

Runtime revision: 184

## Outcome

Paused production graphics at a clean live checkpoint and created one
canonical restart playbook. Gameplay, responsive UX, crowd movement, and
general cleanup are now the active project focus.

## Durable Decisions

- Canvas2D painted atlases remain the live two-dimensional renderer.
- WebGL2 remains fullscreen post-processing only.
- The removed WebGL/3D diorama path is historical and is not resumed.
- Nine modular actor families are live; A15 rancher is the next art target
  only when the owner explicitly returns to graphics.
- Future art work starts from `../PAUSE_AND_RESUME.md`, not conversation
  memory or the long historical handoff alone.

## Handoff Artifacts

- `loop/graphics/PAUSE_AND_RESUME.md` records the source, compiler, row,
  staging, atomic-promotion, runtime, verification, and deployment process.
- `loop/playability/LOOP.md` defines the cleanup operating contract.
- `loop/playability/CURRENT.md` records the current ranked work, beginning with
  complete removal of the legacy procedural hot-air balloon.

## Verification

- Checked every referenced production command and path against the Realm 184
  workspace.
- Confirmed the production checkpoint and `origin/main` both pointed to
  `c28a5affff7a1fd0386dbd74dada3183588125ca` before this documentation round.
- Confirmed the old 3D live path is absent and graphics round 002 records its
  removal.
- Traced all current balloon update, render, shadow, state, and save references
  so the cleanup target is complete and reproducible.

## Next

Retire the procedural hot-air balloon in one focused playability cleanup,
including an explicit save-contract decision and live accelerated-day proof.
