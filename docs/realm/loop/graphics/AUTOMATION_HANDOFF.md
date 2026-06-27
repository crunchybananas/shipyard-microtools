# Graphics Automation Handoff

## Current Automation State

Automation ID: `tonight-graphics-polish-loop`

The automation exists at:

`/Users/cloken/.codex/automations/tonight-graphics-polish-loop/automation.toml`

It is marked `ACTIVE`, but its schedule is expired:

```toml
rrule = "DTSTART:20260508T200000\nRRULE:FREQ=HOURLY;INTERVAL=1;COUNT=5"
```

That ran only five hourly slots starting on May 8, 2026. A restart may
reload the automation metadata, but it will not make an expired RRULE
fire again unless the schedule is updated.

## What To Do After Restart

Use the app automation tool, if available, to update the existing
automation rather than creating a new duplicate.

Recommended update:

- Keep ID: `tonight-graphics-polish-loop`
- Keep workspace: `/Users/cloken/code/Dockhand/shipyard-microtools/docs/realm`
- Set status: `ACTIVE`
- Replace the expired RRULE with a new recurring schedule.
- Update the prompt to the current graphics direction below.

## Current Prompt

Continue progressive visual polish for the Realm game. Work only in
`/Users/cloken/code/Dockhand/shipyard-microtools/docs/realm`.

Before editing:

1. Read `loop/graphics/LOOP.md`.
2. Read `loop/graphics/CURRENT.md`.
3. Read the newest file in `loop/graphics/rounds/`.
4. Start the next graphics round number.

Current art direction:

- Painted PNG atlases are the source of truth.
- Canonical renderer is the 2D canvas renderer.
- Do not reintroduce SVG sprite paths, SVG sandboxes, procedural
  building fallbacks, or a second live renderer.
- Preserve existing user changes.
- Stay scoped to graphics/rendering/assets unless a tiny support change
  is required for visual verification.

Next target:

Continue from `CURRENT.md`. The next run should follow the current graphics
handoff, start the next round number, and prefer screenshot-confirmed
actor/ambient polish over broad pipeline work.

Required verification when possible:

```sh
node --check js/render.js js/ui.js js/main.js js/input.js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs
node scripts/verify-anim.mjs
node scripts/verify-critic.mjs
node scripts/verify.mjs --game --logic
find assets/sprites -maxdepth 1 -name '*.svg' -print
rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" index.html js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs assets/sprites/README.md
```

At the end of each run:

- Update `loop/graphics/CURRENT.md`.
- Update `loop/graphics/BACKLOG.md`.
- Add `loop/graphics/rounds/NNN-<short-name>.md`.
- Append the run summary to
  `/Users/cloken/.codex/automations/tonight-graphics-polish-loop/memory.md`.
- Summarize what changed, what was verified, and remaining visual issues.
