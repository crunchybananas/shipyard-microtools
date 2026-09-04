# Lighthouse Hub — Current Design Contract

The lighthouse is the game's instrument panel, evidence room, and return point. It
must feel like a worked place in the world, never a menu wrapped in architecture.

## Spatial reading

A player entering the study should understand the room in this order:

1. **Window and basin:** the valve can be operated while its full-sized tide result
   remains visible outside.
2. **Chart table:** the 1:240 island is the center of the room. The crack, lighthouse
   lens seat, moving player marker, and plumb alignment all belong to this object.
3. **Time instrument:** the crank has a clear silhouette and a view toward the sky.
4. **Signal shelf:** eight manuals are close enough to compare as one index, but
   separated from the beam's cliff so the deduction requires memory or Field Notes.
5. **Floor plate:** the threshold is physically under the model beach. It stays
   visually secondary until the plumb completes the circuit.
6. **Tower stair:** lighting the lamp opens the climb to the gallery and its exterior
   confirmation.
7. **Quarters and records:** these deepen the place without competing with the
   surface circuit.

The room may be dense with lived detail, but progression props need clean sightlines
and independent interaction volumes. No floating arrows or HUD objectives should be
needed to distinguish them.

## The model circuit

Every required surface interaction has a local action and a distant confirmation.

| Study action | Full-sized consequence | Earned evidence |
|---|---|---|
| Turn valve | Bay drains or fills | Basin and bay move together |
| Drag sun crank | Sky changes hour | Model lamp moves with the sun |
| Lay ruler over model crack | Eastern bridge rises | Scale turns measurement into passage |
| Fit lens to model lighthouse | Tower lamp can burn at night | Two lighthouse lenses answer together |
| Drag model lamp housing | Beam crosses the cliff | Four projected figures gain an order |
| Read signal shelf | Eight figure–instrument bindings become available | The route points back into the room and island |
| Hang plumb above model | Floor plate wakes | Model beach and crossing plate align |

These are physical facts, not arbitrary inventory locks. If an action cannot be
understood by looking at both scales, improve the staging before adding explanatory
copy.

## Signal shelf

The shelf is an index, not a solution.

- It contains exactly eight manuals.
- Every spine carries one recurring figure and one named instrument.
- The complete figure–instrument routing is visible at once; no value is printed.
- No volume is emphasized as one of the four needed.
- The manuals never encode an extra sentence, ordering trick, or fallback answer.
- The beam supplies selection and order; the shelf supplies destinations; the
  instruments supply physical readings.
- The buried hatch uses four decimal numeral rings, visually distinct from the beam
  figure atlas.

The notebook may preserve the beam order and the shelf bindings. It must never write
the exact four-wheel answer or make the physical instruments optional.

## Field Notes in the hub

The hub is where observations are compared, so `J` should feel like opening a field
instrument at the table.

- Entries are earned and keyed by stable IDs.
- Copy is observational; it does not issue objectives.
- Discovery order is preserved.
- A page reached later is separate evidence from the artifact's first page.
- **Trace a lead** is explicit, optional, and visually separate from the evidence
  spread.
- Hint tiers may point to a relationship but cannot write evidence or satisfy a
  challenge gate.

When the tab pulses, it means a new observation was earned. It does not mean a new
task was assigned.

## Plate behavior

The plate is the sole threshold across all strata. It uses one consistent grammar:

1. stand on its center;
2. first touch arms the available crossing;
3. second touch commits;
4. stepping away disarms it.

On the surface, it remains cold until the full model circuit is complete. On lower
strata, it reports the local missing evidence through its material response and a
brief line. At the source it points upward. After the full climb, it commits the
bottom disposition at the returned surface.

The bell and oar can answer touch with sound or movement, but never compete with the
plate as terminal authority.

## The hub across strata

The study is repeated, not reset. Each return changes what the same architecture
means.

| Stratum | Hub function |
|---|---|
| Surface | Learn agency through the live model and complete the circuit |
| Shallows | Discover that an act above still arrives below through the dead valve |
| Inspection | Let the register count the hands and costs that the surface concealed |
| Source | Read the wet consequences, regard the Lower Hand, set a disposition |
| Returned surface | See what endured, then commit the chosen relation at the plate |

The Lower Hand remains visually and narratively separate. The scene asks for regard,
not collection, substitution, or a reveal that collapses two figures into one.

## Return composition

All four dispositions share one visual standard: the same island, rotating lamp,
golden hour, and long shadow. The game does not rank the selections through spectacle.

Only the physical result and coda change:

- **tend:** hold the transfer at its present level;
- **carry:** reverse this hand's interventions;
- **open:** join upper and lower flow;
- **close:** seal the crossing.

The final image should make the lighthouse readable as a maintained system inside an
imperfect world, not as a trophy or a punishment screen.

## Implementation boundaries

- `world.js` owns live state and stack integration.
- `progression.js` owns challenge requirements and plate decisions.
- `notebook.js` owns earned evidence and requested hint tiers.
- `content.js` owns words and sketches, never gate truth.
- `props.js` owns the glyph, instrument, and dial atlases plus shelf/hatch forms.
- `puzzles.js` owns hub interactions.
- `main.js` owns crossings and the single ending commit.

Do not reintroduce special-case progress checks in UI copy, obsolete save-field
aliases, or alternate terminals. A changed contract belongs in these authorities and
their tests.
