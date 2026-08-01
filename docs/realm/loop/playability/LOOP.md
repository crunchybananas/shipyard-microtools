# Realm Playability And Cleanup Loop

Purpose: improve the game the player actually touches while the production-art
push is paused.

## Start Of Round

1. Read `CURRENT.md`.
2. Read `../engine-v2/CURRENT.md` and `../engine-v2/ROADMAP.md` for ownership,
   movement, save, and renderer constraints.
3. If work touches art or atlas contracts, read
   `../graphics/PAUSE_AND_RESUME.md`; do not silently resume the graphics
   production queue.
4. Reproduce one player-visible problem in the live game before editing.
5. State one focused target and its acceptance evidence.

## Working Rules

- Keep the player-facing world on the canonical two-dimensional renderer.
- Prefer deletion of superseded behavior over hiding it behind a flag.
- Do not add a second renderer, compatibility path, dormant experiment, or
  speculative dependency during cleanup.
- Separate fast cleanup from architectural movement work. A small ambient
  removal should not become a navigation rewrite in the same change.
- Test desktop and `390x844` phone layouts when HUD, panels, build controls,
  canvas sizing, pointer input, or keyboard/touch affordances change.
- For movement changes, use the existing deterministic traffic fixtures. Do
  not judge crowd correctness from a screenshot alone.
- Preserve the one current save contract intentionally. If a cleanup changes
  its shape, make that decision explicit and prove New Game, Save, Load, and
  Continue rather than allowing accidental incompatibility.
- Every change must land in ordinary gameplay. Debug-only or standalone demos
  are evidence, not completion.

## End Of Round

Record:

- the exact live reproduction;
- files and superseded paths removed;
- desktop and mobile evidence when relevant;
- deterministic/browser/release checks run;
- regressions or intentionally deferred debt;
- one next target.

Update `CURRENT.md` so the next session can continue without conversation
history.
