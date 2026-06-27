# realm — LOOP MANIFEST

> A letter from past-Claude to future-Claude. Read this first.

## What this is

realm is a browser settlement-builder at `docs/realm/`. Pure HTML/JS,
no build step, no dependencies. It has already been through 200+
autonomous improvement loops under an older protocol — see
`archive/LOOPS.md` and `archive/LOOPS_PROGRESS.md` for that history.

This loop is a new protocol, inspired by `~/code/playground/strand`:
**fresh context every tick, one challenge per tick, append-only
journal.** No single long-running session carrying drift. Each
iteration is a fresh Claude that reads this file, picks one
challenge, does one thing, writes it down, and schedules the next.

The north star for realm itself: *a medieval city-builder that
makes people say "an AI built this?"* See `../MISSION.md` and
`../ROADMAP.md` for game-level direction.

The north star for the loop: **each tick is small, honest, and
documented.** Small enough to fit; honest enough to report what
didn't work; documented enough that iteration 047 can learn from
iteration 006.

## The contract

Each iteration:

1. **Read `MANIFEST.md`** (this file).
2. **Read `journal/index.md`** and the latest 2 entries.
3. **Read `prompts/challenges.md`**. Pick exactly one challenge.
   `grep -h '^\*\*Challenge:\*\*' journal/*.md` shows prior takes.
   Accept, mutate, or reject in a one-line reason.
4. **Skim `prompts/ideas.md`**. Pull one if it fits your challenge,
   or add to it if you invent something worth passing on.
5. **Execute the challenge.** One of three forms:
   - **`[play]`** — serve realm, load it in chrome-mcp, actually
     interact for at least a few minutes as the persona. Capture
     at least one screenshot. The journal entry must cite
     *specific moments* from play, not generic critique.
   - **`[code]`** — make a focused code change. Must pass
     `node --check` on every touched `.js`. Commit with a
     descriptive message. One challenge = one commit.
   - **`[review]`** — written finding, no code change. The
     journal entry IS the deliverable. Cite file:line.
6. **Write `journal/NNN.md`.** First line after the header must be
   `**Challenge:** <name> — accepted|mutated|rejected: <reason>`.
   Then: what you did, what you noticed, a concrete suggestion for
   next. If something broke, say so.
7. **Append one line to `journal/index.md`** in the same style as
   prior entries.
8. **Schedule the next wake** via `ScheduleWakeup` with a
   challenge-aware `delaySeconds` (see "Cadence" below) — unless
   the user said stop, or you legitimately can't pick a next
   challenge (see "On stopping").

## Serving realm for play

```
python3 -m http.server 8889 --directory docs/realm
```

Then in chrome-mcp, navigate to `http://localhost:8889/`. Once the
game is loaded:

- `window.G` exposes live game state from the console (no import).
- Force-fix the camera if blank: `G.camera.x=0; G.camera.y=768`.
- Bust module cache by opening a fresh tab or clearing site data.
- MCP tabs are always "hidden" — Chrome throttles rAF. The game
  batches 60 ticks per call to compensate; use `G.speed=4` and
  wait if you need time to pass.

## Graphics is a first-class axis

realm's competitive edge is that it's beautiful. A city-builder with
broken pathing is embarrassing; a city-builder with flat visuals is
forgettable. Every tick should at minimum *notice* the graphic state
— even `[code]` ticks that touch non-rendering systems. At least one
in three ticks should be a graphics-focused persona or review
(`the-photographer`, `the-screenshot-critic`, `the-art-director`,
`the-color-eye`, `the-pixel-critic`, or a `[review]` of a recent
render change).

When flagging a graphic issue, always attach:

- a **specific frame** (time of day, season, building mix, zoom
  level) so the next iteration can reproduce it
- **what you'd change** in one sentence — even if you're not the
  one coding it. Vague "it looks bad" is a reject; "the midday
  shadow under the church is too opaque, breaks silhouette" is
  what we want.

### Active graphics handoff loop

For graphics-only work, read `graphics/LOOP.md` after this manifest.
That directory is the current handoff system for painted bitmap art,
canonical 2D visual audits, construction/upgrade state, walls, actors,
and no-SVG live rendering. Use `graphics/CURRENT.md` as the first handoff
and write one `graphics/rounds/NNN-*.md` entry at the end of each
graphics round.

## Constraints

- **One challenge per iteration.** Not two. Not zero.
- **`[play]` challenges must actually load realm in Chrome.** A
  dry-run review without loading counts as a reject.
- **Commits build clean.** `node --check js/*.js` before committing.
  Don't push a broken game.
- **No dependencies.** realm is pure web. No npm adds, no CDN
  imports, no build step.
- **Don't rewrite.** One focused change per tick. If the change
  wants to be large, split it and journal the plan; later ticks
  will land pieces.
- **Report failure honestly.** If the challenge didn't work, the
  journal says so. Negative findings are as valuable as positive.

## Cadence

Each tick picks its *own* next-wake delay when calling
`ScheduleWakeup`, based on what type of tick *just* completed. This
lets cheap ticks cycle fast while expensive play ticks get breathing
room.

Bands:

| Tick just completed           | Next wake | Why                                         |
| ----------------------------- | --------- | ------------------------------------------- |
| `[review]` (pure critique)    | 300s      | Cheap to produce; no need to wait.          |
| `[code]` (small commit)       | 420s      | Change has settled; no user review window.  |
| `[code]` (larger / risky)     | 600s      | Give the user a chance to notice.           |
| `[play]` (persona play)       | 720s      | Play itself is slow; don't stack them.      |
| Surprise tick                 | 600s      | Default.                                    |
| Loop self-reports stuck       | 1800s     | Buy time before another try.                |

The clamp is [60, 3600]. Shorter than 300s is usually wrong for this
loop (fresh-context reload has fixed cost regardless of work). Longer
than 1200s usually means you should stop and let the user resume.

The current tick may override with judgment — document the override
in the journal ("wake in 600s instead of 300s because ..."). Don't
pick a number you can't justify in one line.

## Tick-type mix (updated after tick 033)

User steering: **favor builder work over persona plays.** Plays are
valuable but surface-level; code ticks that ship graphics, mechanics,
or systems move realm forward. After ~34 ticks, the observed mix was
11 play / 13 code / 4 review (33% / 39% / 12%). The new target:

- **~60%+ builder ticks** (code — `the-fixer`, `refactor-only`,
  `the-profiler`, `the-name-giver`, `the-dead-code-detective`,
  `constant-shift`, `silent-module`, `cut-as-you-add`, surprise
  `[code]` entries).
- **~15–20% plays**, spaced out. Persona plays are for diagnostic
  surveys, not every-third-tick check-ins. Prefer fresh-persona
  plays that surface a class of findings no other persona can (the
  31-persona survey axis from 020 still applies — but once per
  area is usually enough).
- **~15–20% reviews**. Keep the-contrarian / the-archivist / the-
  minimalist / the-skeptic / the-art-director available for when
  the loop needs to step back.

The 40% the-fixer monoculture warning from 020 still stands for
variety **among code ticks** — if half the builder work is
the-fixer closing ideas, the other half should be exploratory
code challenges (refactor-only tried in 026; name-giver, dead-
code-detective, silent-module still un-picked).

Play for information; build for progress.

## Evolution mandate (updated after tick 038)

User directive: **the loop should evolve realm into something
unexpected**. Queue-draining is not the goal. The 47+ open
ideas create gravity; resist it.

Rules:

- **Not every tick needs to close an ideas.md entry.** A tick
  that ADDS something new — a feature, scenario, mechanic,
  or system nobody filed — is equally legitimate, often more
  valuable.
- **At least one in five ticks should pick from the "surprise"
  category** (`unnamed-thing`, `a-scene-that-happens-once`,
  `time-aware`, `the-dream`) OR propose something not in
  ideas.md. None of the four surprise challenges had been
  picked in 38 ticks before this section was added — that's
  the gap this mandate closes.
- **Risk is permitted.** Ship bold things; document honestly
  when they don't land. A half-broken experiment with clear
  reasoning is more valuable than a fifth trivial fix.
- **Cross-reference over silo.** New features should touch
  existing named characters / chronicle / scenarios where
  it makes sense, deepening the realm's web instead of
  bolting on unconnected mechanics.
- **Preserve the surprise.** Don't pre-announce the novel
  beat in ScheduleWakeup prompts — ship it; user finds out
  from the journal. The ScheduleWakeup prompt can hint at
  *kind* ("a surprise tick") without spoiling the *thing*.

If a tick genuinely can't think of something surprising, it
may fall back to a fixer tick — but own that choice in the
journal, don't default to it.

The goal: over a day of loop-time, realm should feel as if
someone unseen has been working on it — not merely *fixing*
it. Weirdness is welcome.

## Meta

- **START**: 2026-04-20 (iteration 001 is this scaffolding)
- **TARGET**: ~100 iterations, then reassess (the loop may retire
  early by writing `journal/FINAL.md`, or continue past 100 if it
  still has juice)
- **Prior history**: `archive/LOOPS.md`, `archive/LOOPS_PROGRESS.md`,
  and `archive/LOOP_STATE.md` document 200+ iterations under the
  old 3-agent protocol. Read them for context; don't re-do what's
  already there.

## On stopping

If no challenge feels right and no idea in `ideas.md` compels you:

1. Write your normal `journal/NNN.md` documenting the pause and
   what you considered.
2. **Do not** schedule another wakeup.
3. Leave a suggestion for when the loop resumes.

The user can always say "continue the realm loop" and a future
iteration will pick up the thread.

## Resuming

To re-enter this loop from a fresh Claude session, either:

- The user says "continue the realm loop" — you read this file and
  run the next tick.
- A prior `ScheduleWakeup` fires with a prompt that points here —
  same result.

Never attempt two iterations in one session. One tick, then
schedule or stop.
