// content.js — what can be heard, read, and physically recorded on the island.
//
// The prose observes; it does not solve. Written artifacts contain measurements,
// omissions, and traces left by other hands. Interpretation belongs to the player.

// ---- THE KEEPER -------------------------------------------------------------
// A voice from a lower landing. It asks about consequences visible from below; it never
// names the player, explains itself, or resolves into a secret identity.
export const KEEPER = {
  look: {
    3: '“Was it dry where you stood?”',
    4: '“Did you see what the water carried?”',
  },
  arrive: {
    shallow: '“It rose when the wheel turned.”',
    deep: '“I thought the water was mine.”',
  },
  farewell: '“Do you know where it went?”',
};

// The shelf is a routing index, never an answer key. Each stamped figure names one
// physical instrument elsewhere on the island; the instrument's already-observed
// construction supplies the reading. Geometry renders only `symbol` + `label` on
// the spines. `reading` remains here as the single, testable rules authority.
export const SIGNAL_BINDINGS = Object.freeze([
  Object.freeze({ glyph: 0, instrument: 'sun-crank', symbol: '☉', label: 'SUN', reading: 1, readingLabel: 'one moving sun', evidenceId: 'evidence.crank' }),
  Object.freeze({ glyph: 1, instrument: 'tide-staff', symbol: '≡', label: 'TIDE STAFF', reading: 5, readingLabel: 'five gauge rings', evidenceId: 'evidence.model-gauge' }),
  Object.freeze({ glyph: 2, instrument: 'basin-wheel', symbol: '⊕', label: 'BASIN WHEEL', reading: 4, readingLabel: 'four wheel spokes', evidenceId: 'evidence.valve' }),
  Object.freeze({ glyph: 3, instrument: 'music-cylinder', symbol: '♫', label: 'MUSIC TEETH', reading: 4, readingLabel: 'fourth filed tooth', evidenceId: 'evidence.music-box' }),
  Object.freeze({ glyph: 4, instrument: 'stone-arc', symbol: '●', label: 'STONE ARC', reading: 6, readingLabel: 'six sounding stones', evidenceId: 'evidence.fallen-stone' }),
  Object.freeze({ glyph: 5, instrument: 'lamp-eye', symbol: '◉', label: 'LAMP EYE', reading: 1, readingLabel: 'one lens eye', evidenceId: 'evidence.lens' }),
  Object.freeze({ glyph: 6, instrument: 'survey-rule', symbol: '━', label: 'SURVEY RULE', reading: 1, readingLabel: 'one spanning rule', evidenceId: 'evidence.ruler' }),
  Object.freeze({ glyph: 7, instrument: 'plumb-line', symbol: '◆', label: 'PLUMB LINE', reading: 1, readingLabel: 'one hanging line', evidenceId: 'evidence.plumb' }),
]);

export const SIGNAL_ROUTE = Object.freeze([1, 5, 3, 4]);
export const SIGNAL_HATCH_CODE = Object.freeze(SIGNAL_ROUTE.map((glyph) => {
  const binding = SIGNAL_BINDINGS.find((entry) => entry.glyph === glyph);
  if (!binding) throw new Error(`Missing signal binding for glyph ${glyph}`);
  return binding.reading;
}));

// ---- READABLE ARTIFACTS -----------------------------------------------------
// Every readable has stable surface/deep notebook IDs. Pages expose traces and records;
// they do not add an authorial interpretation to the notebook.
export const LORE = {
  keeper_logbook: { era: 'spanning', eraDeep: 'inspection',
    kind: 'book', hand: 'keeper', title: 'The Keeper’s Logbook',
    pages: [
      '3 April. Wind southwest. Lamp trimmed 18:40. Lens clear. Mean high water 4 cm above the printed table.',
      '17 May. New line cut on the third stair. The old line is below water at neap tide.',
      '2 June. Table model begun at one to two hundred and forty. Basin, channel, bridge, tower. All levels taken from the island.',
      '19 June. A valve fitted beneath the basin. The model loses water when the bay does. Discharge not visible from the study.',
    ],
    deepFrom: 3,
    deep: [
      'BOARD QUERY: Where is displaced water received?\n\nREPLY: [the ruled space is blank; the paper is worn through where a word was erased.]',
    ],
    notes: { surface: 'evidence.logbook.surface', deep: 'evidence.logbook.deep' },
  },
  // A routing index, not a cipher: the beam selects figures; the bindings name
  // instruments whose physical readings the player has earned elsewhere.
  signal_shelf: { era: 'spanning',
    kind: 'shelf', hand: 'keeper', title: 'The instrument index',
    place: { prop: 'none', label: 'the instrument index', maxDist: 3.0, glow: 'gilt' },
    pages: [
      'Eight narrow harbour manuals. Each spine binds one stamped figure to an instrument: sun crank, tide staff, basin wheel, music teeth, stone arc, lamp eye, survey rule, or plumb line.',
      'The stamps match the forms cut into the cliff. No values are printed; the bindings point back into the working room and the island beyond it.',
    ],
    notes: { surface: 'artifact.signal-shelf.surface' },
  },
  coat_letter: { era: 'spanning', eraDeep: 'lastwinter',
    kind: 'letter', hand: 'keeper', title: 'A letter, folded small',
    pages: [
      'The east room is dry. The blue blanket is in the chest. The kettle draws from the rain tank, not the sea.',
      'No account is required at the door. Come in wet if you must.\n\n— K.',
    ],
    deepFrom: 3,
    deep: [
      'Inside the fold: EAST ROOM — repaired latch; dry boards; spare key beneath the blue cup.',
    ],
    notes: { surface: 'evidence.coat-letter.surface', deep: 'evidence.coat-letter.deep' },
  },
  stone_inscription: { era: 'founding',
    kind: 'inscription', hand: 'keeper', title: 'Cut into the standing stone',
    pages: [
      'WE WHO WENT DOWN\nLEFT THE LIGHT FOR\nWHOEVER WASHES UP',
    ],
    deepFrom: 2,
    deep: [
      'Below the old cut, bared by the higher tide:\n\nTHE HILL HELD.\nTHE HALL DID NOT.\nBOTH WERE OUR WORK.',
    ],
    notes: { surface: 'evidence.standing-stone.surface', deep: 'evidence.standing-stone.deep' },
  },
  // The first current measurement most players find.
  bottle_note: { era: 'lastday',
    kind: 'letter', hand: 'keeper', title: 'A note in a bottle, washed up',
    pages: [
      'The bottle was sealed at the jetty at low water. Wind southwest. If it returns to this beach, the west current has reversed.',
      'The lamp room is unlocked. The rain tank is sound. The east room is dry.',
    ],
    deepFrom: 2,
    deep: [
      'On the back: RETURN OBSERVED. Water 11 cm above the mark. Bottle intact.',
    ],
    notes: { surface: 'evidence.bottle.surface', deep: 'evidence.bottle.deep' },
  },
  // L2: two recorded trials, enough to compare without an instruction.
  kelp_slate: { era: 'arrival',
    kind: 'inscription', hand: 'keeper', title: 'A wax slate, tangled in the kelp',
    pages: [
      'FIRST WADE. Dark form at twelve paces. Closed distance: form broke apart; water clouded with silt.',
      'SECOND WADE. Held position. Form surfaced once. One low note crossed the bay. Duration: nine breaths.',
    ],
    notes: { surface: 'evidence.kelp-slate.surface' },
  },
  // L3: a measured change in the Watcher's distance.
  bluff_cairn: { era: 'inspection',
    kind: 'inscription', hand: 'keeper', title: 'A cairn on the bluff, scratched in the top stone',
    pages: [
      'Cairn rebuilt above the wet line. Drowned hall roof visible to the east.',
      'The shore figure was twelve paces nearer after I checked the hall. No wake. No footprints. It did not advance while observed.',
    ],
    notes: { surface: 'evidence.bluff-cairn.surface' },
  },
  // L4: conservation evidence, not a final instruction.
  source_note: { era: 'lastwinter',
    kind: 'letter', hand: 'keeper', title: 'A transfer sheet, weighted with a stone',
    pages: [
      'TRANSFER TEST 4. Upper basin lowered: 28 cm. Lower pool raised: 28 cm. Delay: eleven seconds.',
      'Return test incomplete. Wheel seized after reversal. Pressure remained on both sides of the plate.',
    ],
    notes: { surface: 'evidence.transfer-sheet.surface' },
  },
  // The room's safety changes from barricade to chosen shelter across its two reads.
  quarters_journal: { era: 'inspection', eraDeep: 'lastwinter',
    kind: 'book', hand: 'keeper', title: 'A journal kept by the cot',
    pages: [
      'Could not sleep through the west gale. Moved the chair against the inner door.',
      'Drew the island again from memory. The channel is too narrow. The east room remains dry in every version.',
      'Lamp trimmed at dusk. Cot lamp left burning until morning.',
    ],
    deepFrom: 3,
    deep: [
      'Later: moved the chair away from the door. Slept with it open. Rain reached the threshold; the east boards stayed dry.',
    ],
    notes: { surface: 'evidence.quarters-journal.surface', deep: 'evidence.quarters-journal.deep' },
  },
  // Legible only through the reading glass.
  lens_mark_study: { era: 'inspection',
    kind: 'inscription', hand: 'keeper', title: 'Lampblack, too small to read by eye',
    pages: [
      'Through the glass: LENS ROTATION 04:10. Beam crossed the west cliff at 04:13. Four figures returned from the cut face.',
      'Order copied in the margin as figures only. No numerals are written here.',
    ],
    deepFrom: 3,
    deep: [
      'A second hand added: CLIFF DRY. HALL FLOODED. Same figures visible on both faces.',
    ],
    notes: { surface: 'evidence.lens-study.surface', deep: 'evidence.lens-study.deep' },
  },
  lens_mark_stone: { era: 'inspection',
    kind: 'inscription', hand: 'keeper', title: 'Scratched into the stone, hair-fine',
    pages: [
      'Through the glass: thirty-seven short strokes, grouped by five. Five longer strokes cross the groups at different angles.',
      'The stone is polished at palm height. The polish overlaps several generations of cuts.',
    ],
    deepFrom: 3,
    deep: [
      'Below the tide line are more strokes, softened but still deliberate. One ends above the water; another continues beneath it.',
    ],
    notes: { surface: 'evidence.lens-stone.surface', deep: 'evidence.lens-stone.deep' },
  },
  // A physical round trip between the dry upper pool and the fifth water ring.
  pool_phial: { era: 'lastwinter',
    kind: 'letter', hand: 'keeper', title: 'A note sealed in a phial, dried and unrolled',
    pages: [
      'POOL TEST. Phial wedged at dry datum: +14.8 m. It can clear the lip only when the basin reaches the fifth ring.',
      'Paper dried after recovery. Salt line inside the glass: 3 mm below the cork.',
    ],
    notes: { surface: 'evidence.pool-phial.surface' },
  },
  // The institutional measurements lag the island's instruments.
  drain_ledger: { record: true, era: 'inspection',
    kind: 'book', hand: 'inspector', title: 'A tide ledger, water-swollen',
    pages: [
      'DISTRICT OF LIGHTS — QUARTERLY RETURN. Mean high water: +4 cm against table. Keeper’s staff checked against survey chain: exact.',
      'SECOND QUARTER. Mean high water: +11 cm. Boat-store stair wet at third step during neap. Printed table unchanged.',
    ],
    deepFrom: 3,
    deep: [
      'FINAL RETURN. Archive floor flooded before inspection. Station figures accepted. Printed table withdrawn.',
    ],
    notes: { surface: 'evidence.drain-ledger.surface', deep: 'evidence.drain-ledger.deep' },
  },
  // A retained recommendation whose provenance remains physically uncertain.
  commendation_copy: { record: true, era: 'inspection',
    kind: 'letter', hand: 'inspector', title: 'A carbon copy, kept',
    place: { parent: 'quarters', pos: [-0.35, 0.44, 1.05], rx: -Math.PI / 2 + 0.06, rz: 0.3, prop: 'sheet', label: 'a carbon copy, kept', maxDist: 2.6, gate: 'quarters' },
    pages: [
      'CARBON RETAINED — RECOMMENDATION FOR COMMENDATION. Returns exact. Lens work within tolerance. Light outages: none. Recommendation submitted despite pending station review.',
    ],
    deepFrom: 3,
    deep: [
      'The retained sheet is top carbon. No impression from an original page is visible beneath it. The signature line is blank.',
    ],
    notes: { surface: 'evidence.commendation.surface', deep: 'evidence.commendation.deep' },
  },
  // A closure proposal without the fields that would make it an order.
  closure_notice: { record: true, era: 'lastwinter',
    kind: 'letter', hand: 'inspector', title: 'A notice of review, folded small',
    place: { pos: [-84.45, 14.475, -41.06], ry: 0.35, prop: 'fold', label: 'a paper, folded small', maxDist: 2.8 },
    pages: [
      'NOTICE OF REVIEW — DISTRICT OF LIGHTS. Station cost exceeds traffic served. Proposed action: extinguish light; recover instruments and great lens; offer mainland transfer.',
    ],
    deepFrom: 4,
    deep: [
      'The effective date and authorising signature are blank. In the margin: RECEIPT NOT ACKNOWLEDGED.',
    ],
    notes: { surface: 'evidence.closure.surface', deep: 'evidence.closure.deep' },
  },
  // Measurements on the smallest visible chart-table margin.
  field_slip: { record: true, era: 'inspection',
    kind: 'letter', hand: 'inspector', title: 'A field slip, pinched under the cairn',
    place: { parent: 'bluffCairn', pos: [0.18, 0.62, 0.14], rx: -Math.PI / 2 + 0.2, rz: -0.4, prop: 'sheet', label: 'a field slip, pinched under stone', maxDist: 2.8, gate: 'l3' },
    pages: [
      'FIELD SLIP — wind SW, moderate. Glass falling. North bluff ascent: 22 minutes. Cairn at crest not shown on survey.',
    ],
    deepFrom: 3,
    deep: [
      'Reverse: tower 21.4 m; stair 83 treads; mean high water +11 cm; oil 146 L. Column headed KEEPER RELIEF is blank.',
    ],
    notes: { surface: 'evidence.field-slip.surface', deep: 'evidence.field-slip.deep' },
  },
  transfer_offer: { record: true, era: 'lastwinter',
    kind: 'letter', hand: 'inspector', title: 'An offer of transfer, never burnt',
    place: { parent: 'quarters', pos: [0.95, 0.02, 1.35], ry: 0.7, prop: 'fold', label: 'a letter, wedged behind the stove', maxDist: 2.6, gate: 'quarters' },
    pages: [
      'DISTRICT OF LIGHTS — NOTICE OF VACANCY. Mainland station available from spring quarter. Housing included. Two assistants. Application invited.',
    ],
    deepFrom: 4,
    deep: [
      'Draft on reverse, unsent: TRANSFER DECLINED. Reason field first reads STATION REQUIRES KEEPER, then is struck through. No replacement reason.',
    ],
    notes: { surface: 'evidence.transfer-offer.surface', deep: 'evidence.transfer-offer.deep' },
  },
  model_margin: { era: 'lastwinter',
    kind: 'inscription', hand: 'keeper', title: 'The model’s margin, under the glass',
    pages: [
      'Under the glass: SCALE 1:240. ERROR AT WEST CHANNEL: +0.8 mm. ERROR AT UPPER POOL: -0.3 mm.',
      'A smaller model is drawn inside the lamp room. Its basin is marked FULL; the surrounding sea is marked LOW.',
    ],
    notes: { surface: 'evidence.model-margin.surface' },
  },
  // A repair record; the bird remains an independent observation.
  music_note: { era: 'spanning', eraDeep: 'lastwinter',
    kind: 'letter', hand: 'keeper', title: 'A note folded into the music box',
    pages: [
      'Fourth tooth catches again. Filed it. Worse.',
      'Box sequence after filing: E · G · A · D · C. Dawn bird answers from the stone arc.',
    ],
    deepFrom: 4,
    deep: [
      'Inside fold: BIRD, FOURTH NOTE HIGH. 04:52. Clear sky.',
    ],
    notes: { surface: 'evidence.music-note.surface', deep: 'evidence.music-note.deep' },
  },
};

// ---- FIELD NOTES ------------------------------------------------------------
// Notes are evidence, never narration. They record only what the player has actually
// touched, read, heard, or changed. Optional hints live in HINT_THREADS below.
const dispositionCount = (world, disposition) => Object.values(world.recDisp)
  .filter((value) => value === disposition).length;

export const FIELD_NOTES = Object.freeze({
  'arrival.shallows': { text: 'The shallows are higher. Kelp crosses the old footpath.', sketchId: 'upstream-hand' },
  'arrival.inspection': { text: 'Water reaches the drowned hall roof. The study window is below the tide line.', sketchId: 'register' },
  'arrival.source': { text: 'The fifth gauge ring is wet. The upper stone pool is full.', sketchId: 'lower-hand' },
  'return.receiver': { text: 'The dry-room lamp is still burning. Water left above was received in the shallows.', sketchId: 'upstream-hand' },
  'return.surface': { text: 'The original beach is smaller. The lit east room remains above water.', sketchId: 'disposition' },
  'evidence.model-marker': { text: 'A moving point on the table model matches my position on the island.', sketchId: 'model-marker' },

  'event.refuge-lit': { text: 'One dry circle of floor around the cot. Lamp oil: half a cup.', sketchId: 'disposition' },
  'evidence.valve': { text: 'Turning the brass valve lowers the model basin and the bay together.', sketchId: 'valve' },
  'evidence.music-box': { text: 'The music box plays E · G · A · D · C. Its fourth tooth has been filed twice.', sketchId: 'bird' },
  'evidence.ruler': { text: 'The brass ruler spans the crack in the model. A measured bridge now spans the eastern chasm.', sketchId: 'ruler' },
  'evidence.lens': { text: 'The small lens fits the model lighthouse. The full lighthouse lens turns with it.', sketchId: 'lens' },
  'evidence.bird': { text: 'At dawn the bird sings five notes. Its fourth note is higher than the music box’s.', sketchId: 'bird' },
  'evidence.beam-glyphs': { kind: 'transcription', label: 'copied from the cliff', text: 'Four figures returned in the lighthouse beam. I copied their order.', sketchId: 'beam-glyphs' },
  'artifact.signal-shelf.surface': { kind: 'transcription', label: 'copied from the instrument index', text: 'Eight stamped figures each point to a different working instrument. The spines print names, not values.', sketchId: 'signal-bindings' },
  'evidence.hatch-numerals': { text: 'The buried hatch has four numeral wheels and the same figure stamps as the manuals.', sketchId: 'hatch-numerals' },
  'evidence.shadow-hatch': { text: 'At golden hour the five standing stones cast one joined shadow toward the buried hatch.', sketchId: 'hatch-numerals' },
  'evidence.plumb': { text: 'The plumb hangs over the model beach. A brass plate lies at the corresponding point in the study floor.', sketchId: 'plumb' },
  'evidence.tide-gauge': { text: 'The gauge has five rings. The first four cuts are weathered; the fifth is pale and sharp.', sketchId: 'upstream-hand' },
  'evidence.dead-wheel': { text: 'Below the surface, the full-sized valve is locked. Salt prints ring its wheel; the model counterpart is free.', sketchId: 'upstream-hand' },
  'evidence.fallen-stone': { text: 'Five stones stand in an arc. A sixth lies face down and gives only a dull knock.', sketchId: 'bird' },
  'event.upstream-hand': { text: 'With the lower wheel still, the water rose by one hand’s width. Salt handprints remain on the wheel.', sketchId: 'upstream-hand' },
  'evidence.register': { text: 'The register records work at this table before and after the keeper’s entries. Several hands did not sign.', sketchId: 'register' },
  'encounter.tide-figure': { text: 'When I stopped advancing, the form held together and surfaced. It left one low note across the bay.', sketchId: 'tide-figure' },
  'encounter.watcher': { text: 'The shore figure advanced only while unobserved. Under a held gaze it raised its head and dispersed.', sketchId: 'watcher' },
  'encounter.lower-hand': { text: 'The lower study bears the results of changes made above: wet steps, a raised basin, and another hand’s measurements.', sketchId: 'lower-hand' },
  'event.capitals-breach': { text: 'Three inscribed crowns rose through the water over the drowned hall.', sketchId: 'register' },
  'event.beam-farewell': { text: 'At the source, the beam completed one submerged circuit and went dark.', sketchId: 'beam-glyphs' },
  'evidence.room-disagreement': { text: 'The facing study’s model shows a drained bay and lit lamp not present in this room.', sketchId: 'model-marker' },
  'evidence.bell-buoy': { text: 'The buoy still marks its old channel, now beneath the flooded bluff.', sketchId: 'upstream-hand' },
  'evidence.crank': { text: 'The model lamp crank changes the sky’s hour. The mechanism lags at greater depth.' },
  'evidence.model-bottle': { text: 'A sealed bottle rests on the model beach. A smaller curl of paper is visible inside.' },
  'evidence.model-gauge': { text: 'A five-ring gauge stands beside the model sea. Its top ring is pale.' },
  'evidence.climber-rope': { text: 'A tied climbing rope is still moving at the wade line; its lower end is submerged.' },
  'mechanism.stone-vault': { text: 'The stone arc opened a chamber in the outcrop. A fitted lens lay inside.', sketchId: 'lens' },
  'mechanism.lighthouse': { text: 'With the model lens seated, the full lighthouse beam follows the model housing.', sketchId: 'beam-glyphs' },
  'mechanism.reading-glass': { text: 'The reading glass resolves lampblack marks invisible to the unaided eye.', sketchId: 'lens' },
  'event.fifth-ring': { text: 'Water has reached the fifth gauge ring for the first recorded time.', sketchId: 'upstream-hand' },
  'event.returned-shore': { text: 'After the ascent, the outer jetty arm, shallows bench, and skiff are underwater.' },
  'evidence.study-model': { text: 'The study model matches the island at one to two hundred and forty, including this room.', sketchId: 'model-marker' },
  'evidence.study-unchanged': { text: 'On return, the cup, chair, dust, and clock hand occupy their earlier positions.' },
  'collection.climber.cmTallies': { text: 'Thirty-seven short strokes in groups of five; a palm-wide hollow beside them.' },
  'collection.climber.cmFormal': { text: '“I DESCENDED IN MY SIXTIETH YEAR. THE SEA WAS ALREADY IN THE PARLOUR.”' },
  'collection.climber.cmPlain': { text: '“went down for my brother. came up with the weather.”' },
  'collection.climber.cmUnfinished': { text: '“day nine below. the lamp is” — the cut ends mid-line.' },
  'collection.climber.cmChild': { text: '“im not lost. dont come down.”' },
  'collection.climbers-complete': { text: 'Five distinct hands appear at five depths. None is listed in the station log.' },
  'collection.hall.cgRoof': { text: '“WE RAISED THE ROOF ABOVE THE SPRING TIDE’S REACH.” Water now stands above it.' },
  'collection.hall.cgCount': { text: '“WE COUNTED OURSELVES EACH WINTER —” The number is effaced.' },
  'collection.hall.cgLight': { text: '“WHEN THE WATER CAME WE WENT UP THE HILL AND BUILT A LIGHT.”' },
  'collection.hall-complete': { text: 'All three hall inscriptions use the same plural hand.' },
  'collection.lampblack.lmValve': { text: 'TEST 6 — upper basin minus 9; lower basin plus 9.' },
  'collection.lampblack.lmBox': { text: 'Fourth tooth filed twice. Pitch fell both times.' },
  'collection.lampblack.lmChest': { text: 'Seal held through three spring tides.' },
  'collection.lampblack.lmDory': { text: 'Hull sound. One oar missing before inventory.' },
  'collection.lampblack.lmJetty': { text: 'West current reversed after 02:10.' },
  'collection.lampblack.lmStair': { text: 'Eighty-three treads. Third wet at neap.' },
  'collection.lampblack.lmBell': { text: 'Toll carries farther below the water line.' },
  'collection.lampblack.lmBuoy': { text: 'Mooring datum no longer marks the channel.' },
  'collection.lampblack.lmDrain': { text: 'Return flow delayed eleven seconds.' },
  'collection.lampblack-complete': { text: 'Nine lampblack measurements appear on working objects across the island.' },
  'record.filed': {
    deriveArgs: (world) => ({ count: dispositionCount(world, 'filed') }),
    text: ({ count }) => `${count} record${count === 1 ? ' rests' : 's rest'} in the quarters cabinet with the District returns.`,
  },
  'record.kept': {
    deriveArgs: (world) => ({ count: dispositionCount(world, 'kept') }),
    text: ({ count }) => `${count} record${count === 1 ? ' remains' : 's remain'} at the source, weighted above the wet line.`,
  },
  'event.round.moor': { text: 'The dory line is made fast at the jetty cleat.' },
  'event.round.log': { text: 'The day’s return is signed with the observed water level.' },
  'event.round.light': { text: 'The cot lamp is lit. The model lighthouse answers briefly.' },
  'event.round.wind': { text: 'The music box is wound once. A bird remains at the sill through all five notes.' },
  'event.rounds-complete': { text: 'Mooring, return, cot lamp, and music box have each been tended once.' },
  'evidence.completed-song': { text: 'The standing stones accept six notes when the fallen stone carries the added low tone.', sketchId: 'bird' },
  'evidence.disposition': { text: 'The mechanism can hold, reverse, join, or seal the transfer. Each changes both sides of the plate.', sketchId: 'disposition' },
  'evidence.logbook.surface': { text: 'The log records rising water, a one-to-240 model, and a valve whose discharge cannot be seen from the study.', sketchId: 'valve' },
  'evidence.logbook.deep': { text: 'The Board asked where displaced water was received. The reply was erased through the paper.', sketchId: 'register' },
  'evidence.coat-letter.surface': { text: 'An unsent letter says the east room is dry and no account is required at its door.' },
  'evidence.coat-letter.deep': { text: 'Inside the fold: repaired latch, dry boards, spare key beneath the blue cup.' },
  'evidence.standing-stone.surface': { text: 'The stone reads: WE WHO WENT DOWN / LEFT THE LIGHT FOR / WHOEVER WASHES UP.' },
  'evidence.standing-stone.deep': { text: 'A lower cut reads: THE HILL HELD. / THE HALL DID NOT. / BOTH WERE OUR WORK.' },
  'evidence.bottle.surface': { text: 'The bottle was released at low water to test whether the west current would return it.' },
  'evidence.bottle.deep': { text: 'The back records its return intact, with water 11 cm above the mark.' },
  'evidence.kelp-slate.surface': { text: 'The slate records two approaches to the kelp form: pursuit scattered it; waiting preceded one low note.', sketchId: 'tide-figure' },
  'evidence.bluff-cairn.surface': { text: 'The cairn note says the shore figure moved twelve paces while the writer looked away.', sketchId: 'watcher' },
  'evidence.transfer-sheet.surface': { text: 'Transfer test: upper basin fell 28 cm; lower pool rose 28 cm. The attempted reversal seized.' },
  'evidence.quarters-journal.surface': { text: 'The cot journal records a barred door, repeated island drawings, and the east room staying dry.' },
  'evidence.quarters-journal.deep': { text: 'A later entry records the chair moved away and the door left open overnight.' },
  'evidence.lens-study.surface': { text: 'Lampblack records four figures reflected from the west cliff after the lens rotated.', sketchId: 'beam-glyphs' },
  'evidence.lens-study.deep': { text: 'A second hand reports the same figures on the dry cliff and flooded hall.' },
  'evidence.lens-stone.surface': { text: 'The glass reveals grouped strokes and overlapping palm-polish on the stone.' },
  'evidence.lens-stone.deep': { text: 'More deliberate strokes continue below the tide line.' },
  'evidence.pool-phial.surface': { text: 'The phial clears the upper pool lip only when the basin reaches the fifth ring.' },
  'evidence.drain-ledger.surface': { text: 'The ledger measurements rise from +4 cm to +11 cm while the printed table stays unchanged.' },
  'evidence.drain-ledger.deep': { text: 'The final return accepts the station figures after the archive floods.' },
  'evidence.commendation.surface': { text: 'A retained carbon lists exact returns, acceptable lens work, and no light outages.' },
  'evidence.commendation.deep': { text: 'The top carbon has no underlying original impression and no signature.' },
  'evidence.closure.surface': { text: 'An unsigned review proposes closing the station, recovering the lens, and offering a transfer.' },
  'evidence.closure.deep': { text: 'The notice has no effective date. Its receipt was never acknowledged.' },
  'evidence.field-slip.surface': { text: 'The inspector timed the bluff ascent and found a cairn absent from the survey.' },
  'evidence.field-slip.deep': { text: 'The reverse measures tower, stair, water, and oil. KEEPER RELIEF is blank.' },
  'evidence.transfer-offer.surface': { text: 'The mainland vacancy included housing and two assistants.' },
  'evidence.transfer-offer.deep': { text: 'An unsent refusal has its only stated reason struck through.' },
  'evidence.model-margin.surface': { text: 'The model margin lists scale errors and shows a smaller model with a full basin inside a low sea.' },
  'evidence.music-note.surface': { text: 'The box plays E · G · A · D · C. A note says filing the fourth tooth made it worse.', sketchId: 'bird' },
  'evidence.music-note.deep': { text: 'Inside the fold: BIRD, FOURTH NOTE HIGH. 04:52. Clear sky.' },

  'ending.tend': { text: 'The transfer is held at its present level. The lamp continues to turn.', sketchId: 'disposition' },
  'ending.carry': { text: ({ removed = 0 } = {}) => `The mechanism is reversed across ${removed} interventions. Water retreats below and returns above.`, sketchId: 'disposition' },
  'ending.open': { text: 'The basins are joined. Their water levels move toward one another.', sketchId: 'disposition' },
  'ending.close': { text: 'The plate is sealed. Pressure falls to zero on the upper side and remains below.', sketchId: 'disposition' },
});

// Hints are requested, never pushed into the evidence stream. Later steps become more
// direct, but they still point to relationships rather than supplying an answer.
export const HINT_THREADS = Object.freeze([
  { id: 'surface-circuit', after: ['event.refuge-lit'], complete: { kind: 'flag', key: 'receiverReturned' }, steps: [
    'The dry room gives the machinery something worth keeping dry.',
    'Three table instruments reach outward: basin, sky, and broken crossing.',
    'Light the room; lower the bay; move the hour; span the model crack. Then stand on the brass plate.',
  ] },
  { id: 'deep-circuit', after: ['return.receiver'], complete: { kind: 'flag', key: 'plumbHung' }, steps: [
    'The low note returned with you. The surface still has an unfinished circuit.',
    'Compare the music cylinder with the dawn bird, then follow what their sixth note opens.',
    'Seat the lens, read the cliff order, find the joined shadow, open the hatch, and bring its plumb line to the study hook.',
  ] },
  { id: 'signal-hatch', after: ['evidence.beam-glyphs', 'artifact.signal-shelf.surface'], complete: { kind: 'flag', key: 'hatchCodeDecoded' }, steps: [
    'The cliff supplies an order. The shelf points away from itself.',
    'Match each projected figure to the instrument named on its spine.',
    'Read a count from each physical instrument, then turn the wheels in the beam’s order.',
  ] },
  { id: 'tide-figure', after: ['evidence.kelp-slate.surface'], complete: { kind: 'flag', key: 'tideFigureSeen' }, steps: [
    'Pursuit changes the water before it changes the figure.',
    'Compare the slate’s first and second wades.',
    'Approach only far enough to see it, then stop moving and wait.',
  ] },
  { id: 'watcher', after: ['evidence.bluff-cairn.surface'], complete: { kind: 'flag', key: 'watcherSeen' }, steps: [
    'Its distance changes when your attention leaves it.',
    'The cairn records movement without wake or footprints.',
    'Face it continuously; do not trade sight for distance.',
  ] },
  { id: 'upstream-hand', after: ['evidence.dead-wheel'], complete: { kind: 'flag', key: 'upstreamHandWitnessed' }, steps: [
    'The dead wheel is still connected to another level.',
    'Compare the salt prints with the sudden rise.',
    'Remain near the wheel long enough to witness a transfer initiated elsewhere.',
  ] },
  { id: 'lower-account', after: ['evidence.register'], complete: { kind: 'flag', key: 'lowerHandRegarded' }, steps: [
    'The register counts work; the water shows its cost.',
    'Revisit the lower study after reading the names and blanks.',
    'Inspect the model, wet line, and waiting figure before choosing what crosses the plate.',
  ] },
]);

// ---- THE CLIMBERS -----------------------------------------------------------
// Five visibly different hands on the worn route. Their marks imply company without
// declaring who anyone is or telling the player what the marks mean.

export const CLIMBERS = [
  { id: 'cmTallies', noteId: 'collection.climber.cmTallies',
    whisper: 'Thirty-seven short strokes, grouped by five. The stone is smooth beside them.' },
  { id: 'cmFormal', noteId: 'collection.climber.cmFormal',
    whisper: 'An old formal hand, every letter ruled straight: “I DESCENDED IN MY SIXTIETH YEAR. THE SEA WAS ALREADY IN THE PARLOUR.”' },
  { id: 'cmPlain', noteId: 'collection.climber.cmPlain',
    whisper: 'A plain hand on the stone: “went down for my brother. came up with the weather.”' },
  { id: 'cmUnfinished', noteId: 'collection.climber.cmUnfinished',
    whisper: 'A hurried hand, low on the cairn: “day nine below. the lamp is” — and it stops.' },
  { id: 'cmChild', noteId: 'collection.climber.cmChild',
    whisper: 'Small letters, close to the cold floor, in a hand still learning its letters: “im not lost. dont come down.”' },
];
export const CLIMBERS_CLOSE = {
  noteId: 'collection.climbers-complete',
  whisper: 'Five distinct hands. Five different depths.',
};

// ---- THE HALL INSCRIPTIONS --------------------------------------------------
// Three monumental lines share the plural hand cut into the standing stone.
export const CONGREGATION = [
  { id: 'cgRoof', noteId: 'collection.hall.cgRoof',
    line: 'WE RAISED THE ROOF ABOVE THE SPRING TIDE’S REACH' },
  { id: 'cgCount', noteId: 'collection.hall.cgCount',
    line: 'WE COUNTED OURSELVES EACH WINTER — …' },
  { id: 'cgLight', noteId: 'collection.hall.cgLight',
    line: 'WHEN THE WATER CAME WE WENT UP THE HILL AND BUILT A LIGHT' },
];
export const CONGREGATION_CLOSE = {
  noteId: 'collection.hall-complete',
  whisper: 'Three lines, all cut in the same plural hand.',
};

// ---- HAND TRACES AND LAMPBLACK MEASUREMENTS --------------------------------
// Physical traces establish that more than one person used the mechanisms. Lampblack
// records the numbers the public log omits. Words live here; geometry lives in props.
export const HAND_MARKS = {
  valve:  'Salt has dried in the shape of two hands on the wheel. The prints are smaller than yours.',
  crank:  'The grass around the crank is worn through a quarter-circle. Two heel marks overlap.',
  ruler:  'A straight edge left a clean line through the silt. Its length matches the model crack.',
  lens:   'A circular glass mark remains in the dust. The brass beneath it is untarnished.',
  chest:  'The lid was opened before the last tide. One object-shaped patch inside stayed dry.',
  hatch:  'Four numeral wheels carry fresh oil. Older scratches stop at several different settings.',
  stones: 'Five heel hollows face the arc. A sixth hollow faces the fallen stone.',
  plumb:  'A cord mark circles the hook. The older line hangs two centimetres off centre.',
  dive:   'Bare footprints end at the plate. A second set begins one level below.',
};

export const LAMPBLACK = [
  { id: 'lmValve', noteId: 'collection.lampblack.lmValve', place: 'the brass valve',                        line: 'TEST 6 — upper basin minus 9; lower basin plus 9.' },
  { id: 'lmBox',   noteId: 'collection.lampblack.lmBox', place: 'the music box',                         line: 'Fourth tooth filed twice. Pitch fell both times.' },
  { id: 'lmChest', noteId: 'collection.lampblack.lmChest', place: 'the half-buried chest',                 line: 'Seal held through three spring tides.' },
  { id: 'lmDory',  noteId: 'collection.lampblack.lmDory', place: 'the dory’s hull',                       line: 'Hull sound. One oar missing before inventory.' },
  { id: 'lmJetty', noteId: 'collection.lampblack.lmJetty', place: 'the jetty lantern post',                line: 'West current reversed after 02:10.' },
  { id: 'lmStair', noteId: 'collection.lampblack.lmStair', place: 'the stair to the lamp',                 line: 'Eighty-three treads. Third wet at neap.' },
  { id: 'lmBell',  noteId: 'collection.lampblack.lmBell', place: 'the small bright bell',                 line: 'Toll carries farther below the water line.' },
  { id: 'lmBuoy',  noteId: 'collection.lampblack.lmBuoy', place: 'the listing bell-buoy',                 line: 'Mooring datum no longer marks the channel.' },
  { id: 'lmDrain', noteId: 'collection.lampblack.lmDrain', place: 'the drain wall, beside the carved line', line: 'Return flow delayed eleven seconds.' },
];
export const LAMPBLACK_CLOSE = Object.freeze({
  noteId: 'collection.lampblack-complete',
  whisper: 'Nine lampblack measurements. Their figures agree.',
});

// Deep-read progress is derived from this authored set. Other deep pages remain optional
// evidence and use the same stable note contract.
export const DEEP_SETS = {
  2: ['stone_inscription'],                                                     // the tide bares the stone
  3: ['keeper_logbook', 'quarters_journal', 'drain_ledger', 'commendation_copy', 'field_slip'], // the hands turn colder (+#55, +#50-A, +#132)
  4: ['music_note', 'closure_notice', 'transfer_offer'],                                          // the fold gives up its inside; the notice comes apart
};
export const DEEP_FRAGMENTS = Object.values(DEEP_SETS).flat();

// ---- keyed field-note sketches ----------------------------------------------
// Notes select pictures by stable sketch ID. Copy can change without breaking art.
const S = (body) => `<svg viewBox="0 0 96 40" xmlns="http://www.w3.org/2000/svg" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5">${body}</svg>`;
export const SKETCHES_BY_ID = Object.freeze({
  valve: S('<circle cx="48" cy="19" r="11"/><path d="M40 11l16 16M56 11L40 27M48 30v7"/><path d="M10 34q9-4 18 0t18 0t18 0t18 0" opacity=".35"/>'),
  ruler: S('<path d="M10 31l23-2M63 29l23 2"/><path d="M29 22h38v6H29z"/><path d="M35 22v3M43 22v2M51 22v3M59 22v2"/>'),
  lens: S('<circle cx="43" cy="18" r="11"/><path d="M51 26l15 12"/><path d="M28 18H8M58 18h28" opacity=".45"/>'),
  bird: S('<path d="M22 31c0-10 5-18 14-19l7 5-3 8c8-1 15 3 16 10"/><circle cx="67" cy="18" r="2"/><circle cx="76" cy="13" r="2"/><path d="M78 13V5l5 1"/>'),
  'beam-glyphs': S('<path d="M8 9l48 9M8 13l48 11" opacity=".5"/><path d="M66 5v30"/><rect x="73" y="5" width="7" height="7"/><circle cx="76.5" cy="20" r="3.5"/><path d="M72 31h9l-4.5 6z"/>'),
  'signal-bindings': S('<path d="M8 34h80"/><path d="M13 34V8h8v26M25 34V11h8v23M37 34V7h8v27M49 34V10h8v24M61 34V8h8v26M73 34V12h8v22" opacity=".7"/><circle cx="17" cy="15" r="2"/><path d="M28 18h4M39 14h4M50 17h6M63 15h4M75 13v10"/>'),
  'hatch-numerals': S('<path d="M10 32h76L77 9H19z"/><circle cx="32" cy="21" r="7"/><circle cx="64" cy="21" r="7"/><path d="M32 14v14M57 21h14" opacity=".55"/>'),
  plumb: S('<path d="M48 3v20"/><path d="M48 23l-5 9h10z"/><ellipse cx="48" cy="35" rx="16" ry="3" opacity=".5"/>'),
  'upstream-hand': S('<path d="M10 30q9-5 18 0t18 0t18 0t18 0"/><path d="M33 24c-3-8 0-14 4-14s5 4 4 8c2-7 8-6 7 1c4-5 8-1 5 5" opacity=".7"/>'),
  register: S('<rect x="20" y="6" width="56" height="29" rx="1"/><path d="M48 6v29M26 13h16M54 13h16M26 20h12M54 20h16M26 27h16" opacity=".45"/><path d="M56 29h13"/>'),
  'tide-figure': S('<path d="M15 34c-3-10-2-20 2-29M25 34c-2-8-1-16 2-24M79 34c3-10 2-20-2-29M69 34c2-8 1-16-2-24" opacity=".4"/><path d="M43 34c0-8 2-13 6-13s6 5 6 13"/><circle cx="49" cy="15" r="4"/>'),
  watcher: S('<circle cx="24" cy="17" r="7"/><circle cx="24" cy="17" r="2"/><path d="M34 17h24" opacity=".35"/><circle cx="69" cy="14" r="4"/><path d="M63 35c0-10 2-17 6-17s6 7 6 17"/>'),
  'lower-hand': S('<path d="M10 31q9-5 18 0t18 0t18 0t18 0" opacity=".5"/><path d="M32 25c-3-8 0-13 4-13 3 0 4 4 3 8 3-5 7-2 5 4M58 25c3-8 0-13-4-13-3 0-4 4-3 8-3-5-7-2-5 4"/>'),
  disposition: S('<circle cx="48" cy="20" r="5"/><path d="M43 20H12M53 20h31M48 15V3M48 25v12"/><path d="M12 20l5-4M12 20l5 4M84 20l-5-4M84 20l-5 4M48 3l-4 5M48 3l4 5M48 37l-4-5M48 37l4-5"/>'),
  'model-marker': S('<path d="M12 31c5-9 17-13 36-13s31 4 36 13" opacity=".5"/><path d="M9 34h78"/><circle cx="52" cy="22" r="4"/><path d="M52 15v-4"/>'),
});

// ---- SHORT WORLD CUES --------------------------------------------------------
// Immediate sensory feedback for active mechanics. Persistent evidence belongs in
// FIELD_NOTES; requested guidance belongs in HINT_THREADS.
export const T = {
  the_sea_no_longer: 'The sea no longer answers the wheel down here.',
  // The same instrument obeys, lags, is audited, then refuses across the descent.
  the_wheel_turns_and: 'The wheel turns. The sky follows after a delay.',
  the_hour_will_not: 'The wheel turns freely. The sky does not move.',
  the_register_has_one: 'The register begins in one hand. Later entries use different pressure and slant.',
  the_register_counts_the: 'The register counts {n} distinct hands at this table.',
  // The fifth ring is a visible threshold, not an interpreted prophecy.
  the_top_ring_stands: 'The top ring stands {gap} m clear of the water. Fresh-cut. Nothing has ever reached it.',
  the_water_is_at: 'The water is at the fifth ring.',
  // The lower gauge makes the upstream transfer visible.
  it_has_to_go_somewhere: 'The lower gauge rises as the upper basin falls.',
  below_the_window_the: 'Below the window, the sea obeys.',
  the_crank_resists_as: 'The crank resists, as if the hours themselves have taken on water.',
  the_little_lamp_drags: 'The little lamp drags the real sun with it.',
  the_fourth_note_does: 'The fourth tooth catches. The note falls silent.',
  the_song_comes_up: 'The song comes up slow and flat, as through water.',
  fallen_and_long_silent: 'Fallen, and long silent. Knocking on it is like knocking on a door with no room behind it.',
  the_fallen_stone_hums: 'The fallen stone now carries the low note heard across the kelp.',
  the_hinges_remember_how: 'The hinges remember how.',
  a_cartographer_s_brass: 'A fifteen-centimetre cartographer’s rule. Brass, straight, unmarked by salt.',
  across_the_island_something: 'Across the island, something vast settles into place.',
  you_do_not_need: 'The etched marks align with the model’s survey grid.',
  far_above_glass_settles: 'Far above, glass settles into brass.',
  on_the_model_s: 'On the model beach, a rice-grain bottle is corked around a curl of paper.',
  even_here_a_staff: 'A staff the height of an eyelash stands in the model sea. It has five rings; the top is pale.',
  cold_as_seawater_clear: 'Cold as seawater, clear as morning — a lamp’s eye, far too fine for a pocket.',
  the_sand_slides_from: 'The sand slides from a brass door, dialled shut.',
  stone_breath_long_held: 'The brass door drops inward. Cold air lifts from a lit stair below.',
  heavier_than_it_looks: 'The brass weight pulls the cord vertical.',
  it_hangs_dead_centre: 'The plumb hangs over the model beach. The floor plate lies on the same vertical line.',
  stand_on_it: 'The plate vibrates beneath the plumb line.',
  the_stair_is_roped: 'The stair is roped off and dark. The lamp socket beside it is empty.',
  a_line_cut_low: 'Cut low into the wet stone: “RETURN FLOW +11 SEC.”',
  locked_not_from_this: 'The latch turns. The hinges do not move.',
  glass_and_brass_wedged: 'Glass and brass are wedged below the dry pool lip, beyond a hand’s reach.',
  the_bottom_of_the: 'The bottom of the world, and the pool is finally full. The phial rides the risen water, and your hand closes around it.',
  a_keeper_s_reading: 'A keeper’s reading glass. Through it, the faint marks resolve — there is writing everywhere you did not see.',
  that_is_all_of: 'Nine lampblack marks found. Their measurements agree.',
  the_stones_hum_lower: 'The stones hum lower here, as through water.',
  e_g_a_d: 'E, G, A, D, C — with the fallen stone’s lower note beneath them. All six stones sound.',
  the_stones_refuse_the: 'The stones refuse the box’s song. Something out here sings it differently.',
  the_outcrop_opens_like: 'The outcrop opens like a held breath.',
  some_corrections_only_ever: 'The fourth stone answers the higher pitch.',
  the_bird_sings_the: 'The bird sings the box’s song. Almost.',
  the_bay_gives_up: 'The bay gives up a road of wet stone.',
  the_lighthouse_remembers_its: 'The full lighthouse lens seats. Its beam falls through the tower onto the lit model lamp.',
  the_beam_writes_on: 'The beam returns four figures from the west cliff.',
  the_risen_capitals_catch: 'Four figures reflect from the capitals above the drowned hall, in the same order as the cliff.',
  far_out_on_the: 'The beam catches on the drowned hall and holds for one circuit.',
  a_chart_table_and: 'A chart table. And on it — this island. This lighthouse. This room.',
  centimetre_marks_underfoot_tall: 'Centimetre marks underfoot, tall as doorways.',
  the_dory_and_its: 'The beached dory holds one unused oar. Its line remains fast to the jetty.',
  you_set_the_phial: 'You set the phial from the high pool on the chart table. In the dry air of the study, the little roll of paper loosens from the glass at last.',
  the_inner_door_stands: 'The inner door stands open. A coat is warm. Damp footprints lead inward.',
  you_have_stood_here: 'The chair, cup, dust, and clock hand occupy their earlier positions.',
  another_study_west_of: 'A facing study contains a drained model basin and a lit model lamp.',
  a_bell_buoy_listing: 'A bell-buoy, listing in the drowned channel. It keeps ringing anyway.',
  you_did_not_run: 'Under a held gaze, the figure raises its head and breaks into a cold light.',
  far_along_the_shore: 'A small cold light stands on the far shore for three breaths, then goes dark.',
  you_stop_wading_for: 'When movement stops, the form surfaces and sends one low note across the water.',
  faint_from_the_kelp: 'Faint, from the kelp: the note it laid, still crossing the water now and then.',
  click_and_the_sea: 'Click, and the sea will hurry.',
  the_tide_brought_you: 'The tide brought you back.',
  down_is_the_only: 'The plate’s lower ring is lit. Its upper ring is dark.',
  there_is_no_level: 'There is no level above the surface. Not yet.',
  you_run_the_mechanism: 'The mechanism reverses. The level marks pass upward one by one.',
  salt_and_lamp_oil: 'Salt and lamp oil, still.',
  far_down_a_light: 'Far down, a light is still lit.',
  there_you_are_a: 'A lit point appears on the model shore.',
  the_ground_gives_you: 'The ground gives you back.',
  already_at_the_bottom: 'Already at the bottom.',
  everything_down_here_is: 'Marks below the water line have sharper edges than those above.',
  the_rope_is_still: 'The rope is still moving. Nothing down here should still be moving.',
  the_water_over_the: 'The water over the hall is moving. Something is coming up.',
  the_light_passes_under: 'The light passes under the water — once, all the way around.',
  the_line_takes_the: 'The line settles into the cleat’s worn turns.',
  one_true_line_signed: 'The observed water level is signed beneath the earlier entries.',
  the_small_flame_takes: 'The small flame takes. The dark backs off by one cot’s width.',
  wound_the_way_he: 'The spring takes one full turn. The cylinder begins to move.',
  folded_into_my_coat: 'The folded record fits inside the coat lining.',
  the_drawer_takes_it: 'The record rests beside the District returns.',
  left_with_him_at: 'Weighted on the source slab, above the wet line.',
  the_jetty_s_outer: 'The jetty’s outer arm is a shadow under green water.',
  the_bench_faces_the: 'The bench faces the sea from inside it now. The seat goes awash with every third wave. The water holds it now.',
  the_skiff_is_off: 'The skiff is off its blocks and rides at the old anchor, half a gunwale under. The water holds it now.',
  field_report_taken_copied: 'Note sent — position, view, state and a screenshot went with it.',
};

// ---- finale observations ----------------------------------------------------
// Four physical dispositions, four visible results. The coda reports state without
// scoring it. Unknown retired ending kinds deliberately produce no copy.
export function finaleCoda(kind, s = {}) {
  const lines = [];
  if (kind === 'tend') lines.push('water held at the marked line', 'lamp circuit continuing');
  if (kind === 'carry') {
    const removed = Math.max(0, Number(s.removed ?? 0) || 0);
    lines.push(`${removed} intervention${removed === 1 ? '' : 's'} reversed`, 'water retreating below and returning above');
  }
  if (kind === 'open') lines.push('upper and lower basins joined', 'both gauges moving toward one level');
  if (kind === 'close') lines.push('plate sealed', 'upper pressure zero; lower pressure holding');
  if (!lines.length) return [];
  if (s.rounds > 0) lines.push(`${s.rounds} maintenance round${s.rounds === 1 ? '' : 's'} completed`);
  if (s.filed > 0) lines.push(`${s.filed} record${s.filed === 1 ? '' : 's'} filed in the quarters cabinet`);
  if (s.kept > 0) lines.push(`${s.kept} record${s.kept === 1 ? '' : 's'} weighted at the source`);
  return lines;
}
