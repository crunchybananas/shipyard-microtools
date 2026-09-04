# THE ISLAND — ABYME

*An island within an island.* ABYME is a first-person mystery about changing a
miniature world, descending into the consequences, and returning to decide what
should cross between levels.

It is a static Three.js application with no build step. Geometry, materials,
weather, water, animation, and audio are synthesized at runtime.

## Run it

Serve this directory over HTTP; `file://` cannot load the ES modules.

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000/`. Headphones are recommended. Add `?debug` for
GPU timing. State-changing developer tools are built only on the isolated
`?debug&localstack` route; there, backtick shows or hides the panel.

## The game

The lighthouse study contains a live 1:240 model of the island. Both scales render
from the same `WorldState`, so a small physical act has one full-sized consequence:

- the brass valve lowers the model basin and the real bay;
- the sun crank moves the model lamp and the sky;
- the ruler laid across a model crack becomes the eastern bridge;
- the lens fitted to the model lighthouse lights the real tower;
- the aimed beam writes an ordered signal on the cliff;
- the plumb hung over the model wakes the brass crossing plate.

The hatch is a circuit through the island. The beam supplies four figures in order.
Eight signal-manual spines bind those figures to working instruments, never to
numbers. The player must carry the route back through physical observations—rings,
an eye, a filed tooth, sounding stones—then set four decimal dials at the hatch.

The plate descends through four strata of the same island. Every threshold has an
authored evidence gate:

1. **Surface:** complete the model circuit, decode and open the hatch, hang the
   plumb.
2. **Shallows:** witness the dead valve transfer water from above and hold still
   with the Tide-Figure.
3. **Inspection:** let the study register finish its count and hold the Watcher in
   view.
4. **Source:** regard the Lower Hand without approaching it as a prize, then set
   one of four physical dispositions.

The climb returns through the same plate. Back at the surface, a final two-touch
commit applies the selected disposition: **tend**, **carry**, **open**, or
**close**. They are operations on the persistent stack, not morality labels. The
bell and oar remain usable world instruments; neither is an ending switch.

## Field Notes

`J` opens a diegetic field notebook. Gameplay records stable evidence IDs and the
UI resolves their current wording, so changing prose does not corrupt progression
or saves. Notes only contain things the player has actually observed.

Help is deliberately separate. **Trace a lead** advances one eligible hint thread
only when the player asks. Requested help never becomes evidence and never unlocks
a gate.

## Persistence

The current run lives at `abyme-save`, payload version `1`. The loader accepts only
that version and its declared fields, sanitizing current values at the boundary;
there are no migration or backup branches in gameplay code.

The L2 transfer persists consequence and observation separately:
`upstreamHandSurged` owns the permanent water rise at the instant it happens, while
`upstreamHandWitnessed` is earned only when the later reveal is actually seen.
Interrupted scores can therefore resume without duplicating water or inventing evidence.

The stack ledger is separate from the run save. Restarting a run clears the run,
not the history of acts already displaced onto deeper strata. Ledger epoch `2`
stores marks plus durable disposition operations locally. The incomplete mark-only
Firebase transport is deliberately not activated; shared play waits for the same
complete mark, tombstone, outbox, and rules contract.

## Architecture

| Module | Authority |
|---|---|
| `js/world.js` | live world state, strata, sky, tide, stack boundary, save I/O |
| `js/save-schema.js` | clean save-epoch schema and normalization |
| `js/ledger.js` | pure append-only stack, inheritance, sanitation, dispositions |
| `js/progression.js` | pure challenge graph, gate requirements, plate decisions |
| `js/notebook.js` | stable earned evidence and explicitly requested hint tiers |
| `js/content.js` | field-note copy, hint threads, readable artifacts, sketches |
| `js/props.js` | structures, glyph/instrument/dial atlases, model clone |
| `js/puzzles.js` | physical interactions and state-to-scene application |
| `js/main.js` | boot, crossings, return, ending commit, debug and field reports |

Developer routes and exact debug calls live in [PLAYTHROUGH.md](PLAYTHROUGH.md).
The spoiler-light player route lives in [WALKTHROUGH.md](WALKTHROUGH.md).
