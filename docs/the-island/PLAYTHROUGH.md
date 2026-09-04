# ABYME — Playthrough and Test Guide

This is the developer-facing route for the current game. It names gates, state,
and debug controls exactly enough to reproduce failures without preserving an old
design contract.

For a player-facing route, use [WALKTHROUGH.md](WALKTHROUGH.md).

## Launch modes

Serve the directory over HTTP and open the game:

```sh
python3 -m http.server 8000
```

- `http://localhost:8000/` — normal play.
- `http://localhost:8000/?debug` — normal play plus GPU timing.
- `http://localhost:8000/?debug&localstack` — explicit local test origin; remains
  the required harness URL if the complete shared transport is enabled later.
- `?report=last` or `?report=<timestamp>` — replay a settled-play report, or show
  the captured thumbnail and reason for an observation-only report.

The state-changing developer panel is built only on `?debug&localstack`. Press
backtick there to show or hide it. `?debug` by itself enables GPU timing without
exposing mutation shortcuts.

## Controls

| Input | Action |
|---|---|
| Drag canvas | Look |
| `W A S D` | Walk |
| Click | Use the centered hotspot |
| Drag a mechanism | Operate the sun crank or model lamp housing |
| Click or `Space` during a crossing | Accelerate the authored crossing curve |
| `J` | Open or close Field Notes |
| `M` | Mute |
| `C` | Reduced-motion toggle |
| `Esc` | Close the active reading surface or Field Notes |
| Backtick | Toggle developer panel |
| `F8` | Capture a field report |

Readers own input while open. Field Notes also pause movement. **Trace a lead** is
the only action that advances a hint tier; opening notes alone must never do so.

## Debug panel

The panel groups the current tools as follows:

- **Teleport:** beach, study, stones, islet, cliff, bridge, dory, bluff, cellar.
- **Time & Tide:** dawn, golden, night, freeze sun, drain, high, mist, plus time
  and tide sliders.
- **Grant — surface chain:** ruler, ruler bridge, bird solve, lens, beam, beam
  observation, signal shelf, reading glass, or the complete surface state.
- **Grant — bluff / dive chain:** hatch shadow, hatch code, plumb, dive armed.
- **Levels & dives:** L1 through L4, authored or instant descent/ascent, bottom.
- **Encounters:** bird, Watcher controls, Lower Hand, depth gates, Tide-Figure.
- **Ending dispositions:** tend, carry, open, close.
- **Power & Reset:** benchmark pose, replay one-time scenes, mark readable
  surfaces, clear notes, open key books, clear region sightings, save, soft reset,
  or wipe and reload.

Panel grants are state fixtures, not substitutes for the causal path. Use real
hotspots whenever the behavior under test is a gate, interaction distance,
animation, sound, or evidence write.

## Console surface

`window.ABYME` exists in all builds with the bounded feedback and replay surface:

```js
ABYME.state()
ABYME.report('note')
ABYME.reports()
ABYME.applyReport(report)     // settled-play reports only
ABYME.importReport(json)
```

On `?debug&localstack`, it additionally exposes the local mutation and inspection
surface used by the harness:

```js
ABYME.W
ABYME.player
ABYME.game
ABYME.notebook
ABYME.refs
ABYME.modelRefs

ABYME.state()                 // structured progression, notes, stack, and view state
ABYME.tp(x, z, yaw, pitch)    // teleport and refresh spatial LOD immediately
ABYME.goLevel(1)              // 1 surface, 2 shallows, 3 inspection, 4 source
ABYME.dive(true)              // instant debug descent by one stratum
ABYME.ascend(true)            // instant debug ascent by one stratum
ABYME.bottom()                // stand beside the Lower Hand at L4

ABYME.watcher('spawn')        // also accepts 'resolve' or 'reset'
ABYME.tideFigure()            // stage the L2 stillness encounter
ABYME.getRegard()             // Lower Hand hold progress and completion
ABYME.upstreamHandState()     // L2 transfer phase and scale-break state

ABYME.read('keeper_logbook')  // open a readable surface by stable content key
ABYME.resetFlags()            // soft reset run state; does not clear the stack
ABYME.ending('tend')          // direct finale fixture; carry/open/close also valid
ABYME.getFinale()

```

The signal route and data-driven instrument bindings are exported for tests:

```js
ABYME.BEAM_GLYPHS
ABYME.SIGNAL_BINDINGS
ABYME.HATCH_CODE
```

For a direct hatch fixture, copy `ABYME.HATCH_CODE`; do not transcribe a literal
combination into a test. That keeps the physical atlas, runtime truth, and test
setup aligned.

## Full causal playthrough

### A. Surface circuit

1. Begin a fresh run and enter the lighthouse study.
2. Turn the valve and verify the model basin and real bay drain together.
3. With low tide, open the flats chest and take the ruler.
4. Lay the ruler across the crack in the table model; verify the eastern bridge.
5. Open the music box and listen through all five notes.
6. Drag the crank to dawn and wait near the standing stones for the bird.
7. Play the bird's corrected phrase on the five stones; take the lens from the
   opened outcrop.
8. Fit the lens to the model lighthouse.
9. Drag to night, aim the model housing at the signal cliff, and observe all four
   beam figures in order.
10. Read the eight figure-to-instrument bindings on the signal-manual spines.
11. Follow the selected bindings back to physical counts already exposed by play.
12. Cross the ruler bridge, drag to golden hour, and touch the troubled sand.
13. Enter those instrument readings on the four decimal hatch rings in beam order.
14. Take the plumb from the cellar and hang it over the table model.
15. Stand on the floor plate. First touch arms; second touch descends.

The L1 gate is deliberately exhaustive. It requires:

```text
valveTurned, crankUsed, rulerPlaced, heardBox, heardBird, birdSolved,
lensPlaced, glyphsSeen, hatchCodeDecoded,
shadowRevealed, hatchOpen, plumbHung
```

`lensPlaced` is a top-level world field. The rest are progression flags. A malformed
state with only `hatchOpen` or `plumbHung` must not cross.

### B. Signal deduction assertions

Test the mechanism before a complete surface run:

1. Reveal the hatch without reading the shelf or seeing the beam. Every ring still
   cycles `0…9`; information gates understanding, not physical input.
2. Read the shelf and observe the beam. Confirm neither action changes a dial or
   creates an exact-code note.
3. Verify four independent decimal rings wrap to `0` and open only
   when they match `ABYME.HATCH_CODE`.
4. Confirm `hatchCodeDecoded` and `hatchOpen` become true in that same saved state.

There is no fallback combination, hidden phrase, or alternate lock path.

### C. Shallows gate

1. On L2, return to the study and touch the dead valve.
2. Stay for the entire model → room → bay transfer. The gate requires
   `upstreamHandWitnessed`, not merely proximity or an inherited mark.
   Inspecting mid-score should show `upstreamHandSurged` become true when the water
   moves, before the later `upstreamHandWitnessed` reveal.
3. Find the Tide-Figure. Moving toward it quickly disperses it; facing it while
   still completes `tideFigureSeen` after the hold.
4. Confirm the plate refuses either partial state, then accepts both. Touch twice
   to descend.

L2 gate: `upstreamHandWitnessed + tideFigureSeen`.

### D. Inspection gate

1. On L3, stand beside the study register until its count settles and records
   `registerRead`.
2. Meet the Watcher. It advances while unobserved and freezes when seen. Maintain
   gaze until it resolves to `watcherSeen`.
3. Confirm the plate refuses either partial state, then accepts both. Touch twice
   to descend.

L3 gate: `registerRead + watcherSeen`.

### E. Source gate and disposition

1. At L4, verify that simple proximity to the Lower Hand does not resolve it.
2. Stand within regard distance, face it, stop moving, and hold for roughly 2.6
   seconds. Confirm `lowerHandRegarded` and the appearance of the brass index.
3. First index touch explicitly selects `tend`; later touches cycle in the stable
   order `tend → carry → open → close → tend`.
4. Confirm the plate refuses ascent until `dispositionChosen` is true.
5. Touch twice to begin ascent.

L4 gate: `lowerHandRegarded + dispositionChosen`.

### F. Return and ending

1. Use the plate twice at each stratum to ascend L4 → L3 → L2 → L1.
2. Confirm the return sets `returned`, clears active climbing, preserves the chosen
   disposition, and leaves the surface visibly changed.
3. Ring the bell at depth: it sounds and no terminal mode begins.
4. Lift the oar after returning: it moves and no terminal mode begins.
5. At the returned surface plate, first touch arms the selected setting; second
   touch calls the sole ending commit.
6. Confirm `endingCommitted`, the matching stable ending note, and one common
   golden-hour composition with choice-specific physical coda.
7. Continue from the committed save. The finale may resume, but the stack operation
   must not run twice.

## Field Notes contract

Verify these separately from world progression:

- A fresh run has no unearned entries.
- First observation writes one stable ID; repeats do not duplicate it.
- Copy and sketches resolve from `content.js`, not from saved prose or substring
  matching.
- Opening Field Notes shows earned evidence in discovery order.
- Opening Field Notes does not generate a hint.
- **Trace a lead** chooses only an eligible unresolved thread and advances one tier.
- A requested hint changes `hintLevels`, not `entries`, and never satisfies a gate.
- Reading a later page records its own stable ID only when that page is reached.

## Persistence contract

- Run key: `abyme-save`.
- Payload version: `1`.
- The loader accepts only the current version and declared fields; there are no
  compatibility or backup paths.
- Current fields are sanitized. Unparseable or wrong-version payloads fail closed
  to a fresh run.
- `Begin again` clears the current run but does not clear the stack ledger.
- Four hatch dials normalize to decimal values only.
- Notebook persistence contains `{entries, hintLevels}` with stable IDs and data
  arguments, never rendered copy.

The stack has its own keys and lifetime. Use `?localstack` for tests that write.
`ABYME.clearStack()` is an explicit developer operation, not part of Begin again.

## Field reports

`F8` or **⚑ field report** captures pose, facing, mode, state, performance, current
save, and a screenshot. The lean JSON is copied and the full report downloads;
the last ten are retained per origin. Settled play captures are replayable with
`?report=last`, a timestamp, or `ABYME.applyReport(...)`. A transition, reader,
Field Notes, writer, armed plate, or finale is recorded as observation-only: its URL
shows the bounded captured frame and reason without fabricating a replayable state.

Reports are origin-scoped. To move one between hosts, use `ABYME.importReport(...)`
with the copied or downloaded JSON.

## Verification commands

```sh
node --test test/*.test.mjs
node tools/harness/saves.spec.mjs
bash tools/harness/run.sh
```

The pure tests cover the save epoch, notebook semantics, challenge graph, content
evidence, and stack ledger. The browser gate remains responsible for the full
physical route, visuals, input ownership, console errors, and performance.
