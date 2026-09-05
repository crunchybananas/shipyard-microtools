# THE ISLAND — ABYME

*An island within an island.* ABYME is a first-person journey through a lighthouse island and its live
miniature. A keeper, a boatwright and a visitor leave ordinary traces in an
impossible place. The player makes a refuge, follows the water down, and returns
to an unfinished boat.

It is a static Three.js application with no build step. Original furniture, cloth,
boats, lighthouse masonry, spiral stairs, vault ribs, wind pines and coastal rock
are authored in Blender and loaded as two GLBs.

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
- the plumb hung over the model extends the crossing beyond the shallows;
- a stitched boat launched into the model sea appears at full size offshore.

The hatch is a circuit through the island. The beam supplies four figures in order.
Eight signal-manual spines bind those figures to working instruments, never to
numbers. The player must carry the route back through physical observations—rings,
an eye, a filed tooth, sounding stones—then set four decimal dials at the hatch.

The plate descends through four strata of the same island. Every threshold has an
authored evidence gate:

1. **Surface:** light the east-room refuge, lower the water, place the ruler and turn the sun. The first crossing does not require the complete instrument circuit.
2. **Shallows, first visit:** witness the Upstream Hand and wait with the Tide-Figure, then return to the surface. The lamp is still lit.
3. **Surface, second visit:** compare the music box and bird; follow the lens, figures, shadow, hatch and plumb into the deeper crossing.
4. **Inspection:** let the study register settle and hold the shore visitor in view.
5. **Source:** regard the Lower Hand, read beside the unfinished boat, and select a physical disposition.

The climb returns through every level. In the east room, the stitched boat can be
taken to the model sea. One persistent state places the same hull at both scales.
The chair, boat and observed notes survive Continue.

A final two-touch commitment at the **small refuge lamp** applies **tend**,
**carry**, **open**, or **close**. The plate, bell and oar remain nonterminal.
Each ending has a distinct water result and a quiet continuation afterward.

The lighthouse also has a physical climb: eighty-three treads around an open shaft,
three windows onto the coast, and a lantern gallery above the whole island. Fitting
the lens opens the stair in daylight as well as at night. A watch book waits above.
Under the bluff, the cellar opens east onto an inverted lighthouse and west into
another study. Damp papers in a bread tin add a small account of work shared.
The drain under the standing stones is a separate chamber, reached by its own ramp.

## Field Notes

`J` opens a diegetic field notebook. Gameplay records stable evidence IDs and the
UI resolves their current wording, so changing prose does not corrupt progression
or saves. Notes only contain things the player has actually observed.

Help is deliberately separate. **Trace a lead** advances one eligible hint thread
only when the player asks. Requested help never becomes evidence and never unlocks
a gate.

## Persistence

The current run lives at `abyme-save`, payload version `2`. The loader accepts only
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
| `js/harbor.js` | Blender room assembly, spare chair and two-scale boat homecoming |
| `js/landfall.js` | Blender tower, vaults, coast, pines and persistent drying-room tin |
| `js/tower-course.js` | Shared staircase layout, tread heights and movement course |
| `js/props.js` | structures, glyph/instrument/dial atlases, model clone |
| `js/puzzles.js` | physical interactions and state-to-scene application |
| `js/main.js` | boot, crossings, return, ending commit, debug and field reports |

Developer routes and exact debug calls live in [PLAYTHROUGH.md](PLAYTHROUGH.md).
The spoiler-light player route lives in [WALKTHROUGH.md](WALKTHROUGH.md).


## Review every stage

Open [the playthrough folder](loop/playthrough/2026-09-05/index.html) for the complete
route, four endings, before/after views and every readable page. The exporter is
`tools/harness/capture-playthrough.mjs`; its output labels skipped travel and
encounter fixtures explicitly. The Blender source is
[tools/blender/harbor-rooms.blend](tools/blender/harbor-rooms.blend), reproducible
with the Python generator beside it.
