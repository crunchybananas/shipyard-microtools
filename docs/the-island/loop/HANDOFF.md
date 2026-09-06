# ABYME — Engineering Handoff

This file is the shortest current contract for contributors. Narrative intent lives
in [SPINE.md](SPINE.md), stack semantics in [STACK.md](STACK.md), and the exact test
route in [../PLAYTHROUGH.md](../PLAYTHROUGH.md).

## Product sentence

A player makes a refuge in a lighthouse, changes a live island model, follows the
water into rooms kept by other people, and returns to try an unfinished boat.
The tone is quiet, humane wonder; the keeper, boatwright and visitor have distinct
voices. See SPINE.md for the current fictional narrative contract.

## Non-negotiable contracts

### One state, two scales

The island and its 1:240 model render from the same `W`. A model action and its
full-sized consequence may animate at different scales, but they do not maintain
parallel truth.

### Earned evidence

Gameplay records stable Field Note IDs through `Notebook`. The UI resolves copy and
sketches from `content.js`.

- Never save rendered prose.
- Never infer progression from displayed text.
- Never write an observation the player has not made.
- Never mix requested guidance into the evidence list.
- **Trace a lead** advances a supported hint thread only on explicit input.

### Physical signal deduction

The hatch relationship is fixed:

```text
beam figures in order
        ↓
eight figure–instrument bindings
        ↓
physical readings already earned in play
        ↓
four decimal hatch wheels
```

The beam does not provide values. The shelf does not provide selection, order, or
numbers. The revealed hatch wheels always turn; only the exact physical reading opens
them. Do not add a fallback answer, emphasized spine subset, exact-code note, hidden
sentence, or bypass flag.

### Declarative crossings

`progression.js` is the authority for challenge nodes, gate requirements, dial
behavior, Lower Hand regard, and plate decisions. `puzzles.js` enacts those
instructions; it does not invent a second route.

Current gates:

- First L1 → L2: refuge lamp, valve, ruler and sun crank.
- First L2 → L1: witnessed Upstream Hand plus regarded Tide-Figure. Sets `receiverReturned`, not `returned`.
- Second L1 → L2: complete the music, lens, signal, hatch and plumb circuit.
- Second L2 → L3: both earlier encounters persist.
- L3 → L4: settled register plus regarded shore visitor.
- L4 → ascent: regarded Lower Hand plus chosen disposition.
- Returned L1 → ending: two touches on the refuge lamp.

Every crossing uses the same arm/commit grammar and disarms when the player steps off.

### Lower Hand

The bottom encounter is gaze, proximity, and stillness held together. Proximity alone
is not completion. The figure remains another hand; it is neither collected nor
collapsed into the player. Completing regard reveals the physical four-position
index.

### One ending threshold

The bottom index selects `tend | carry | open | close`. The selected operation is
committed only by the returned refuge lamp after the full ascent. Every choice gets
the same final visual dignity and a truthful physical coda. The bell and oar are
nonterminal world instruments.

### Clean run persistence

The run key is `abyme-save`, with payload version `2`. The loader accepts only the
current version and declared fields, sanitizing current values at the boundary.
Change the version when the shape changes; do not add aliases, backup slots, or
recovery branches to gameplay.

The stack ledger is intentionally separate and outlives Begin again.

## Authority map

| Concern | Owner |
|---|---|
| World state, levels, time, tide, stack boundary | `js/world.js` |
| Current run schema | `js/save-schema.js` |
| Pure stack operations and sanitation | `js/ledger.js` |
| Challenge graph and pure gate decisions | `js/progression.js` |
| Stable evidence and hint requests | `js/notebook.js` |
| Prose, readable surfaces, sketches, hint threads | `js/content.js` |
| Physical signal, instrument, and dial assets | `js/props.js` |
| Blender tower, vaults, coast, pines and drying-room tin | `js/landfall.js` |
| Shared Blender stair layout and player tread surface | `js/tower-course.js` |
| Blender forest profiles, study finish and tide sight glass | `js/forest-profile.js`, `js/working-coast.js` |
| Hotspots and world application | `js/puzzles.js` |
| Crossings, finale, reports, debug tools | `js/main.js` |
| Notebook presentation and readers | `js/ui.js`, `style.css` |

Put new truth in one owner and test that owner. Avoid mirrored constant tables in
docs, UI, and harnesses; import runtime exports where exact values matter.

The tower is a continuous walking route once the lens is fitted. `atTop` is derived
from the player's height; `towerVisited` records actual gallery arrival. The cellar
and western study are reached through the hatch ramp, not a surface teleport.
The drying-room tin records `archiveTinOpened` and restores its lid on Continue.
These optional rooms add evidence and character without extra crossing gates.

## Content standard

Every line should do at least one of these:

- record a measurement;
- expose a material consequence;
- preserve an omission the player can interpret;
- distinguish one hand, era, or level from another.

No text should explain the whole metaphysics, name a correct moral answer, or turn a
physical puzzle into instructions. Readable surfaces may deepen on later strata, but
reaching a page is what earns its evidence.

## Visual standard

The room and notebook use material hierarchy rather than generic interface chrome:
sea-black, field paper, oxidized metal, and warm lamp brass. Progression objects need
clean silhouettes, visible cause-and-effect, and usable focus states. Respect reduced
motion without deleting state transitions or evidence.

The four final choices share the same island, time, camera importance, and light.
Difference belongs in world state and coda, not reward spectacle.

## Required verification

Run pure contracts first:

```sh
node --test test/*.test.mjs
node tools/harness/saves.spec.mjs
```

Then run the browser gate:

```sh
bash tools/harness/run.sh
```

A release candidate also needs one visible end-to-end pass on
`?debug&localstack`:

1. reveal the dials and verify they always turn but only the physical answer opens;
2. complete every plate gate through real interactions;
3. prove proximity alone cannot resolve the Lower Hand;
4. climb all the way back;
5. prove bell and oar do not enter terminal mode;
6. commit each disposition fixture and confirm idempotent reload;
7. open Field Notes before and after **Trace a lead** and compare entry count;
8. inspect the study, shelf, hatch, lower figure, and finale at the shipped viewport;
9. check console errors and the performance readout.

## Reproducible feedback

Use `F8` or **⚑ field report** for visual or interaction defects. A report captures
pose, facing, mode, run state, performance, and screenshot. Settled play can reopen
exactly with `?report=last`; unstable scenes are observation-only and reopen their
captured thumbnail plus the reason replay was withheld. Import either report kind on
another origin. Fix the reported state, then return to the complete route; a local
visual correction is not done if it breaks the challenge graph.

## Future-change rule

Nothing is protected merely because it shipped. The authorities above are protected
because they keep change coherent. Remove obsolete data and old paths when a design
changes; do not leave compatibility names, dormant terminals, or prose-based adapters
behind.


## Blender room and boat

`assets/harbor-rooms.glb` is preloaded through the asset manifest before the world
is cloned. `harbor.js` attaches the room parts, tide bench and source workbench.
The model cache shares geometry; it never races an asynchronous clone. Room and
region roots are pruned from the miniature as before. The sailing hull is manually
shared by the full island and miniature, after baking the glTF node's Y-up transform.

`placeMade`, `boatCarried`, and `boatLaunched` are sanitized save flags. The boat
is optional after the complete return. Its launch is guarded both at the visible
hotspot and inside its callback. No text or private source material enters a save.

The initial room is physically open in `terrain.syncGates`, matching the open-door
animation. Its ground is flattened below the new floor. `harbor.mjs` checks real
keyboard entrance and pointer selection, then boat restoration and water contact.
`ABYME.cross()` validates the production gate while skipping only the camera trip;
use it for causal captures. Legacy level fixtures do not prove progression.

## Working coast

`working-coast.glb` preloads with the two other kits. `forest-profile.js` owns
crown proportions for the Blender generator and trunk placement. The full stand
retains its deterministic positions, colliders and litter mask; a separate
232–296-triangle version of each crown serves the 1:240 model. Both scales use
the same placement list. The study kit is pruned from the miniature.

The sight-glass float follows `W.tide`, never the target or a separate state.
This preserves gradual drainage and the inherited rise on the lower island.
The new ledge has physical colliders. Rock lichen is now a material on the
actual stone surface; the old floating lichen instances were removed.

`working-coast.mjs` verifies authored LODs, wind weights, open room apertures,
a real pointer on the wheel and the float throughout its travel.
`coast-power.mjs` captures identical poses at noon and night in either revision.
