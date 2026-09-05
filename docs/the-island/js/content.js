// content.js — what can be heard, read, and physically recorded on the island.
//
// The prose observes; it does not solve. Written artifacts contain measurements,
// omissions, and traces left by other hands. Interpretation belongs to the player.

// ---- THE KEEPER -------------------------------------------------------------
// A voice from a lower landing. It asks about consequences visible from below; it never
// names the player, explains itself, or resolves into a secret identity.
export const KEEPER = {
  look: { 3: '“There used to be a table there. We all fitted round it.”', 4: '“You can put that down for a while.”' },
  arrive: { shallow: '“I heard the wheel. Come and see.”', deep: '“I kept making the boat smaller. I thought it might be easier.”' },
  farewell: '“The kettle will need filling.”',
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
  watch_book: {
    era: 'spanning', kind: 'book', hand: 'keeper', title: 'The watch book',
    pages: [
      'Three boats through before dark. The last had no running light. I kept the beam on the channel until she was clear. Then I came down for the soup.',
      'A page in a smaller hand:\n\nI counted the stairs. You were right: eighty-three. I still think you could have come down when I called.\n\nThere is a small circle of dried soup beside the reply: Fair.'
    ], notes: { surface: 'artifact.watch-book' }
  },
  drying_papers: {
    era: 'inspection', kind: 'letter', hand: 'inspector', title: 'Papers in a bread tin',
    pages: [
      'We had six tins and considerably more than six tins of paper. We started with the names. The measurements could be taken again.',
      'The boatwright stood in the doorway passing sheets to the keeper. I dried them on the table. At some point we stopped being careful about whose handwriting was whose.\n\nPlease leave the lid loose. They are still damp.'
    ], notes: { surface: 'artifact.drying-papers' }
  },
  "keeper_logbook": {
    "era": "spanning",
    "eraDeep": "inspection",
    "kind": "book",
    "hand": "keeper",
    "title": "The keeper’s working book",
    "pages": [
      "First clear evening. The lens took all day to clean. By supper the boats were answering from the channel. I watched until the last one passed, though the soup was getting cold.",
      "Water at the third stair again. The printed table says it should be dry. I have cut a new mark beside the old one. For now I am keeping both.",
      "Began the island on the table. One to two hundred and forty, including the crack in the eastern path. The boatwright asked whether I meant to put the draught under the door in it too.",
      "The little valve works. The bay falls when I empty the basin. I called her in to see the road come out of the water. She stayed a long time at the window. I went back to the valve."
    ],
    "deepFrom": 3,
    "deep": [
      "Her question is written below the figures: Where does the water go?\n\nI wrote several answers. None came from going down to look."
    ],
    "notes": {
      "surface": "evidence.logbook.surface",
      "deep": "evidence.logbook.deep"
    }
  },
  "signal_shelf": {
    "era": "spanning",
    "kind": "shelf",
    "hand": "keeper",
    "title": "The instrument index",
    "place": {
      "prop": "none",
      "label": "the instrument index",
      "maxDist": 3,
      "glow": "gilt"
    },
    "pages": [
      "Eight small harbour manuals, rubbed pale where they were pulled from the shelf. Each stamped figure belongs to an instrument: sun crank, tide staff, basin wheel, music teeth, stone arc, lamp eye, survey rule, or plumb line.",
      "A pencilled note on the shelf: The bindings are right even where the books are out of date.\n\nThe same stamps are cut into the cliff. There are no readings printed here."
    ],
    "notes": {
      "surface": "artifact.signal-shelf.surface"
    }
  },
  "coat_letter": {
    "era": "spanning",
    "eraDeep": "lastwinter",
    "kind": "letter",
    "hand": "boatwright",
    "title": "A letter in the coat",
    "pages": [
      "I have put the blue blanket in the east room. The kettle has rainwater in it. The cup with the bent handle is yours if you want it.",
      "You left halfway through telling me about the boat. The bit where you had to start the stern again. I would like to hear the rest.\n\nI will be in when you come back."
    ],
    "deepFrom": 3,
    "deep": [
      "A later line, in softer pencil:\n\nI fixed the latch. You can open it from either side now."
    ],
    "notes": {
      "surface": "evidence.coat-letter.surface",
      "deep": "evidence.coat-letter.deep"
    }
  },
  "stone_inscription": {
    "era": "founding",
    "kind": "inscription",
    "hand": "founders",
    "title": "On the standing stone",
    "pages": [
      "WE BUILT THE STEPS WIDE\nENOUGH TO WALK UP TOGETHER"
    ],
    "deepFrom": 2,
    "deep": [
      "A smaller cut below the water stain:\n\nTHE BOATS ARE TIED ABOVE THE HALL.\nBRING THE DOGS FIRST."
    ],
    "notes": {
      "surface": "evidence.standing-stone.surface",
      "deep": "evidence.standing-stone.deep"
    }
  },
  "bottle_note": {
    "era": "lastday",
    "kind": "letter",
    "hand": "boatwright",
    "title": "A note sent by water",
    "pages": [
      "If this comes ashore near you, the light is still working. The door below it opens with a lift and a push. It swells in the wet.",
      "I put a very small boat in the east room. There is a split along one side. Please leave it as it is for now. I am trying something."
    ],
    "deepFrom": 2,
    "deep": [
      "The bottle came back.\n\nI sent it out again with a fresh cork. There may still be someone on the other shore."
    ],
    "notes": {
      "surface": "evidence.bottle.surface",
      "deep": "evidence.bottle.deep"
    }
  },
  "kelp_slate": {
    "era": "arrival",
    "kind": "inscription",
    "hand": "boatwright",
    "title": "The boatwright’s wax slate",
    "pages": [
      "I saw someone between the weeds and went splashing over. By the time I got there the water was empty. I felt foolish calling out to it.",
      "Next morning I sat on the dry end of the bench. After a while a head came up. We stayed like that. Then it made a low sound, almost a note, and I found I had been holding my breath."
    ],
    "notes": {
      "surface": "evidence.kelp-slate.surface"
    }
  },
  "bluff_cairn": {
    "era": "inspection",
    "kind": "inscription",
    "hand": "inspector",
    "title": "Pencil under the cairn",
    "pages": [
      "He kept appearing nearer whenever I looked at the hall. I thought he wanted me to leave. I put my bag down so I could watch without having to carry it.",
      "He raised his head at last. I had been expecting a face I knew. There was only someone waiting, as wet as I was."
    ],
    "notes": {
      "surface": "evidence.bluff-cairn.surface"
    }
  },
  "source_note": {
    "era": "lastwinter",
    "kind": "letter",
    "hand": "keeper",
    "title": "Beside the unfinished boat",
    "pages": [
      "This was going to be the good boat. I cut six sterns for it. Each was a little closer to what I had drawn. The first one is under the bench. There is nothing much wrong with it.",
      "She stitched the split with blue thread while I was finding a better piece of wood. It leaks a little. She says we can put it in the shallows and see.\n\nI have left room beside it."
    ],
    "notes": {
      "surface": "evidence.transfer-sheet.surface"
    }
  },
  "quarters_journal": {
    "era": "inspection",
    "eraDeep": "lastwinter",
    "kind": "book",
    "hand": "keeper",
    "title": "The book beside the pillow",
    "pages": [
      "I could hear the wind through the latch, so I put a chair against the door. Later I woke to the sound of the chair moving. It was only the house settling. I stayed awake anyway.",
      "The boatwright brought another chair. Its lower rung is the wrong wood. We sat until the kettle ran dry. I did not once get up to look at the model."
    ],
    "deepFrom": 3,
    "deep": [
      "I moved the first chair back to the table.\n\nThe door still rattles. Last night I slept through it."
    ],
    "notes": {
      "surface": "evidence.quarters-journal.surface",
      "deep": "evidence.quarters-journal.deep"
    }
  },
  "lens_mark_study": {
    "era": "inspection",
    "kind": "inscription",
    "hand": "keeper",
    "title": "Writing beneath the reading glass",
    "pages": [
      "She was halfway through a story when the beam touched the cliff. I asked her to wait while I copied the figures. When I looked up she was carrying the cups through to the other room.",
      "The figures return after dark, in the same order. I have left space for them here. I have also left space for the end of her story."
    ],
    "deepFrom": 3,
    "deep": [
      "I took the book down to the hall. The ledge where they kept the winter cups was underwater. My own cup was still dry above."
    ],
    "notes": {
      "surface": "evidence.lens-study.surface",
      "deep": "evidence.lens-study.deep"
    }
  },
  "lens_mark_stone": {
    "era": "inspection",
    "kind": "inscription",
    "hand": "founders",
    "title": "On the smooth side of the stone",
    "pages": [
      "Thirty-seven shallow strokes, in groups of five. A few have been rubbed smooth by a thumb.",
      "Beside them, small words:\n\ni made this bit smooth so your hand can rest here"
    ],
    "deepFrom": 3,
    "deep": [
      "The next line was covered by sand:\n\nthere is room for two hands"
    ],
    "notes": {
      "surface": "evidence.lens-stone.surface",
      "deep": "evidence.lens-stone.deep"
    }
  },
  "pool_phial": {
    "era": "lastwinter",
    "kind": "letter",
    "hand": "keeper",
    "title": "Paper inside the little phial",
    "pages": [
      "A water mark and a date have blurred together. Beneath them, still legible:\n\nSaved from the high pool. The boatwright wanted to know whether it would taste of rain.",
      "A pencilled answer on the folded edge:\n\nIt did."
    ],
    "notes": {
      "surface": "evidence.pool-phial.surface"
    }
  },
  "drain_ledger": {
    "record": true,
    "era": "inspection",
    "kind": "book",
    "hand": "inspector",
    "title": "The visitor’s tide ledger",
    "pages": [
      "District visit. The keeper’s gauge is accurate. Water stands four centimetres above the table. I have entered the measured figure and asked for the table to be corrected.",
      "Second visit. Eleven centimetres now. The boatwright showed me the wet stair. I said a correction was pending. She asked whether I had brought any dry socks."
    ],
    "deepFrom": 3,
    "deep": [
      "Final visit. The archive floor had flooded before I arrived. We carried the loose sheets upstairs in bread tins. The keeper gave me his spare socks.\n\nI have stopped writing PENDING against the water."
    ],
    "notes": {
      "surface": "evidence.drain-ledger.surface",
      "deep": "evidence.drain-ledger.deep"
    }
  },
  "commendation_copy": {
    "record": true,
    "era": "inspection",
    "handDeep": "keeper",
    "kind": "letter",
    "hand": "inspector",
    "title": "A recommendation, kept",
    "place": {
      "parent": "quarters",
      "pos": [
        -0.35,
        0.44,
        1.05
      ],
      "rx": -1.5107963267948965,
      "rz": 0.3,
      "prop": "sheet",
      "label": "a carbon copy, kept",
      "maxDist": 2.6,
      "gate": "quarters"
    },
    "pages": [
      "Recommendation: the light has remained in service through three winters without a missed night. The lens work is exact. The keeper has done the work of a larger station.\n\nI would like this said somewhere he can read it."
    ],
    "deepFrom": 3,
    "deep": [
      "The signature line is empty. Along the bottom, in the keeper’s hand:\n\nI kept waiting for this to make it easier to stop."
    ],
    "notes": {
      "surface": "evidence.commendation.surface",
      "deep": "evidence.commendation.deep"
    }
  },
  "closure_notice": {
    "record": true,
    "era": "lastwinter",
    "handDeep": "boatwright",
    "kind": "letter",
    "hand": "inspector",
    "title": "The proposed closure",
    "place": {
      "pos": [
        -84.45,
        14.475,
        -41.06
      ],
      "ry": 0.35,
      "prop": "fold",
      "label": "a paper, folded small",
      "maxDist": 2.8
    },
    "pages": [
      "District of Lights. Proposed closure. The light and its instruments may be transferred when a replacement route is established. A response is requested before the next supply boat.\n\nThe date has been folded into the crease."
    ],
    "deepFrom": 4,
    "deep": [
      "Across the back, in the boatwright’s hand:\n\nWe could have a window that looks at something other than the light. I am only saying we could."
    ],
    "notes": {
      "surface": "evidence.closure.surface",
      "deep": "evidence.closure.deep"
    }
  },
  "field_slip": {
    "record": true,
    "era": "inspection",
    "handDeep": "keeper",
    "kind": "letter",
    "hand": "inspector",
    "title": "A field slip under the stone",
    "place": {
      "parent": "bluffCairn",
      "pos": [
        0.18,
        0.62,
        0.14
      ],
      "rx": -1.3707963267948966,
      "rz": -0.4,
      "prop": "sheet",
      "label": "a field slip, pinched under stone",
      "maxDist": 2.8,
      "gate": "l3"
    },
    "pages": [
      "The bluff took me most of the morning. I wrote twenty-two minutes in the return. It was what the last visitor had written.\n\nThe boatwright caught up carrying a chair. She did not mention the time."
    ],
    "deepFrom": 3,
    "deep": [
      "Reverse: tower, twenty-one metres; stair, eighty-three treads. Under RELIEF, the keeper has written:\n\nSomeone who will stay for supper."
    ],
    "notes": {
      "surface": "evidence.field-slip.surface",
      "deep": "evidence.field-slip.deep"
    }
  },
  "transfer_offer": {
    "record": true,
    "era": "lastwinter",
    "handDeep": "keeper",
    "kind": "letter",
    "hand": "inspector",
    "title": "An offer, never burnt",
    "place": {
      "parent": "quarters",
      "pos": [
        0.95,
        0.02,
        1.35
      ],
      "ry": 0.7,
      "prop": "fold",
      "label": "a letter, wedged behind the stove",
      "maxDist": 2.6,
      "gate": "quarters"
    },
    "pages": [
      "A place is available at the mainland station. Two assistants share the watch. There is a garden behind the house, though the soil needs work.\n\nThe visitor has added: I have seen it. There is room."
    ],
    "deepFrom": 4,
    "deep": [
      "An unfinished reply:\n\nI know how to keep this light going. I do not yet know what I would do in the mornings if someone else took a turn."
    ],
    "notes": {
      "surface": "evidence.transfer-offer.surface",
      "deep": "evidence.transfer-offer.deep"
    }
  },
  "model_margin": {
    "era": "lastwinter",
    "kind": "inscription",
    "hand": "keeper",
    "title": "In the model’s margin",
    "pages": [
      "SCALE 1:240. A pencilled island sits inside the drawn lighthouse. There is another lighthouse on it, and a smaller island on that.",
      "A different hand has added a tiny chair beside the smallest table. It is much too large for the scale."
    ],
    "notes": {
      "surface": "evidence.model-margin.surface"
    }
  },
  "music_note": {
    "era": "spanning",
    "eraDeep": "lastwinter",
    "kind": "letter",
    "hand": "keeper",
    "title": "A note inside the music box",
    "pages": [
      "Fourth tooth catches again. Filed it. Worse.\n\nShe laughed when I said I could fix the song. She asked whether the bird had complained.",
      "After filing: E · G · A · D · C.\n\nThe bird still answers from the stones at dawn. It waits for the box to finish before it starts."
    ],
    "deepFrom": 4,
    "deep": [
      "Inside the fold:\n\nThe bird takes the fourth note higher. We left the window open to hear it again."
    ],
    "notes": {
      "surface": "evidence.music-note.surface",
      "deep": "evidence.music-note.deep"
    }
  },
  "spare_place": {
    "era": "spanning",
    "kind": "letter",
    "hand": "boatwright",
    "title": "Under the spare chair",
    "pages": [
      "This rung came off a different chair. I could have stained it to match. Then I would have had to wait for it to dry, and you were already putting the kettle on.",
      "I will bring the boat tomorrow. We can try it in the basin. There is no need to clear the whole table."
    ],
    "notes": {
      "surface": "evidence.spare-place"
    }
  },
  "boat_return": {
    "era": "lastwinter",
    "kind": "letter",
    "hand": "boatwright",
    "title": "The little boat",
    "pages": [
      "The stitches are still visible along its side. One end sits lower than the other. It has been in the water and come back with a little sand inside.",
      "Under the seat, a word cut into the wood:\n\nAgain."
    ],
    "notes": {
      "surface": "evidence.boat-return"
    }
  }
};

// ---- FIELD NOTES ------------------------------------------------------------
// Notes are evidence, never narration. They record only what the player has actually
// touched, read, heard, or changed. Optional hints live in HINT_THREADS below.
const dispositionCount = (world, disposition) => Object.values(world.recDisp)
  .filter((value) => value === disposition).length;

export const FIELD_NOTES = Object.freeze({
  'place.lamp-gallery': { text: 'I climbed the eighty-three treads. Both ends of the causeway are visible from the gallery.', sketchId: 'model-marker' },
  'artifact.watch-book': { text: 'The keeper watched the last unlit boat clear the channel. Another hand counted the stairs.', sketchId: 'model-marker' },
  'artifact.drying-papers': { text: 'Three people carried papers into the western room in bread tins. They saved the names first.', sketchId: 'register' },
  'event.archive-opened': { text: 'I opened a tin on the drying table in the western study.', sketchId: 'register' },
  'evidence.spare-place': { text: 'The spare chair has a replaced rung. A note underneath invites the keeper to try the boat.', sketchId: 'disposition' },
  'evidence.boat-return': { text: 'The small boat came back with sand inside. Its blue stitches are still visible.', sketchId: 'lower-hand' },
  'event.place-made': { text: 'I pulled out the spare chair beside the table.', sketchId: 'disposition' },
  'event.boat-launched': { text: 'I set the stitched boat in the basin. It floats with one end a little low.', sketchId: 'lower-hand' },
  'arrival.shallows': { text: 'The shallows are higher. Kelp crosses the old footpath.', sketchId: 'upstream-hand' },
  'arrival.inspection': { text: 'Water reaches the drowned hall roof. The study window is below the tide line.', sketchId: 'register' },
  'arrival.source': { text: 'The fifth gauge ring is wet. The upper stone pool is full.', sketchId: 'lower-hand' },
  'return.receiver': { text: "Back from the shallows. The lamp is still burning in the east room.", sketchId: 'upstream-hand' },
  'return.surface': { text: "Back at the original study. The east room is above the changed waterline.", sketchId: 'disposition' },
  'evidence.model-marker': { text: 'A moving point on the table model matches my position on the island.', sketchId: 'model-marker' },

  'event.refuge-lit': { text: "The cot lamp is lit. The east room is dry.", sketchId: 'disposition' },
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
  'collection.climber.cmFormal': { text: '“I CAME DOWN LATE. THEY MADE A PLACE FOR ME.”' },
  'collection.climber.cmPlain': { text: '“left my coat on the third stair. anyone can have it.”' },
  'collection.climber.cmUnfinished': { text: '“day nine below. more tea, less measuring” — the cut ends mid-line.' },
  'collection.climber.cmChild': { text: '“i can hear you up there”' },
  'collection.climbers-complete': { text: 'Five distinct hands appear at five depths. None is listed in the station log.' },
  'collection.hall.cgRoof': { text: '“WE MADE THE TABLE LONGER EACH WINTER.” Water now stands above it.' },
  'collection.hall.cgCount': { text: '“WE COUNTED OURSELVES EACH WINTER —” The number is effaced.' },
  'collection.hall.cgLight': { text: '“WHEN WE MOVED UPHILL WE TOOK THE TABLE.”' },
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
  'evidence.logbook.surface': { text: "The keeper built a working model. The boatwright watched the water leave the bay.", sketchId: 'valve' },
  'evidence.logbook.deep': { text: "The boatwright asked where the water went. The keeper wrote answers before going down to look.", sketchId: 'register' },
  'evidence.coat-letter.surface': { text: "The boatwright left a blanket, a cup and an invitation to finish a story." },
  'evidence.coat-letter.deep': { text: "The latch was repaired so the door opens from either side." },
  'evidence.standing-stone.surface': { text: "The first settlers built the steps wide enough to walk up together." },
  'evidence.standing-stone.deep': { text: "The lower inscription says the boats are above the hall and the dogs should go first." },
  'evidence.bottle.surface': { text: "A note gives directions to the light. It mentions a small split boat left in the east room." },
  'evidence.bottle.deep': { text: "The bottle returned and was sent out again with a fresh cork." },
  'evidence.kelp-slate.surface': { text: "The boatwright lost the figure by approaching. Sitting on the bench, she heard its low note.", sketchId: 'tide-figure' },
  'evidence.bluff-cairn.surface': { text: "The visitor watched the shore figure after putting down the bag. It raised its head.", sketchId: 'watcher' },
  'evidence.transfer-sheet.surface': { text: "The keeper made six sterns. The boatwright stitched the split with blue thread." },
  'evidence.quarters-journal.surface': { text: "The keeper blocked the door with a chair. Later the boatwright brought another chair." },
  'evidence.quarters-journal.deep': { text: "The keeper moved the chair back to the table and slept through the rattling door." },
  'evidence.lens-study.surface': { text: "The keeper interrupted a story to copy the beam. Space remains for both on the page.", sketchId: 'beam-glyphs' },
  'evidence.lens-study.deep': { text: "The keeper found the winter cup ledge flooded in the lower hall." },
  'evidence.lens-stone.surface': { text: "Beside the tallies, someone smoothed a place for a hand." },
  'evidence.lens-stone.deep': { text: "The covered line says there is room for two hands." },
  'evidence.pool-phial.surface': { text: "The paper records water from the high pool. The boatwright said it tasted of rain." },
  'evidence.drain-ledger.surface': { text: "The visitor recorded rising water. The boatwright asked whether the visitor had dry socks." },
  'evidence.drain-ledger.deep': { text: "The archive flooded. They carried sheets upstairs in bread tins." },
  'evidence.commendation.surface': { text: "A visitor recommended recognition for the keeper’s uninterrupted work." },
  'evidence.commendation.deep': { text: "The keeper hoped recognition would make it easier to stop." },
  'evidence.closure.surface': { text: "The District proposed closure when a replacement route was established." },
  'evidence.closure.deep': { text: "The boatwright suggested a window facing away from the light." },
  'evidence.field-slip.surface': { text: "The visitor copied an earlier walking time. The boatwright arrived carrying a chair." },
  'evidence.field-slip.deep': { text: "The keeper wrote that relief could mean someone who stayed for supper." },
  'evidence.transfer-offer.surface': { text: "A mainland station offered shared watches and a garden." },
  'evidence.transfer-offer.deep': { text: "An unfinished reply wonders what the keeper would do if someone else took a watch." },
  'evidence.model-margin.surface': { text: "Someone drew a spare chair beside the smallest table. It exceeds the scale." },
  'evidence.music-note.surface': { text: "The fourth tooth was filed. The bird waits for the box to finish before answering.", sketchId: 'bird' },
  'evidence.music-note.deep': { text: "The bird raises the fourth note. The window was left open to hear it again." },

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
    whisper: 'An old formal hand, every letter ruled straight: “I CAME DOWN LATE. THEY MADE A PLACE FOR ME.”' },
  { id: 'cmPlain', noteId: 'collection.climber.cmPlain',
    whisper: 'A plain hand on the stone: “left my coat on the third stair. anyone can have it.”' },
  { id: 'cmUnfinished', noteId: 'collection.climber.cmUnfinished',
    whisper: 'A hurried hand, low on the cairn: “day nine below. more tea, less measuring” — and it stops.' },
  { id: 'cmChild', noteId: 'collection.climber.cmChild',
    whisper: 'Small letters, close to the cold floor, in a hand still learning its letters: “i can hear you up there”' },
];
export const CLIMBERS_CLOSE = {
  noteId: 'collection.climbers-complete',
  whisper: 'Five distinct hands. Five different depths.',
};

// ---- THE HALL INSCRIPTIONS --------------------------------------------------
// Three monumental lines share the plural hand cut into the standing stone.
export const CONGREGATION = [
  { id: 'cgRoof', noteId: 'collection.hall.cgRoof',
    line: 'WE MADE THE TABLE LONGER EACH WINTER' },
  { id: 'cgCount', noteId: 'collection.hall.cgCount',
    line: 'WHOEVER ARRIVED WAS GIVEN A CUP' },
  { id: 'cgLight', noteId: 'collection.hall.cgLight',
    line: 'WHEN WE MOVED UPHILL WE TOOK THE TABLE' },
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
  "the_sea_no_longer": "The sea no longer answers the wheel down here.",
  "the_wheel_turns_and": "The wheel turns. The sky follows after a delay.",
  "the_hour_will_not": "The wheel turns freely. The sky does not move.",
  "the_register_has_one": "The first pages are in the keeper’s hand. Later on, other people took a watch.",
  "the_register_counts_the": "{n} different hands have kept this book. Some have left only a line.",
  "the_top_ring_stands": "The top ring stands {gap} m clear of the water. Fresh-cut. Nothing has ever reached it.",
  "the_water_is_at": "The water is at the fifth ring.",
  "it_has_to_go_somewhere": "The lower gauge rises as the upper basin falls.",
  "below_the_window_the": "Below the window, the sea obeys.",
  "the_crank_resists_as": "The crank is stiff. The sky moves a little after your hand stops.",
  "the_little_lamp_drags": "The little lamp drags the real sun with it.",
  "the_fourth_note_does": "The fourth tooth catches. The note falls silent.",
  "the_song_comes_up": "The song comes up slow and flat, as through water.",
  "fallen_and_long_silent": "A stone on its side. A tap gives a dull knock.",
  "the_fallen_stone_hums": "The fallen stone now carries the low note heard across the kelp.",
  "the_hinges_remember_how": "The lid sticks, then opens with a long creak.",
  "a_cartographer_s_brass": "A fifteen-centimetre cartographer’s rule. Brass, straight, unmarked by salt.",
  "across_the_island_something": "Across the island, something vast settles into place.",
  "you_do_not_need": "The etched marks align with the model’s survey grid.",
  "far_above_glass_settles": "Far above, glass settles into brass.",
  "on_the_model_s": "On the model beach, a rice-grain bottle is corked around a curl of paper.",
  "even_here_a_staff": "A staff the height of an eyelash stands in the model sea. It has five rings; the top is pale.",
  "cold_as_seawater_clear": "The lens is cold through your sleeve. A small flaw catches the light.",
  "the_sand_slides_from": "The sand slides from a brass door, dialled shut.",
  "stone_breath_long_held": "The brass door drops inward. Cold air lifts from a lit stair below.",
  "heavier_than_it_looks": "The brass weight pulls the cord vertical.",
  "it_hangs_dead_centre": "The plumb hangs over the model beach. The floor plate lies on the same vertical line.",
  "stand_on_it": "The brass plate is underfoot beside the table. Move onto its centre to cross.",
  "the_stair_is_roped": "The stair is roped off and dark. The lamp socket beside it is empty.",
  "a_line_cut_low": "Cut low into the wet stone: “RETURN FLOW +11 SEC.”",
  "locked_not_from_this": "The latch turns. The hinges do not move.",
  "glass_and_brass_wedged": "Glass and brass are wedged below the dry pool lip, beyond a hand’s reach.",
  "the_bottom_of_the": "The bottom of the world, and the pool is finally full. The phial rides the risen water, and your hand closes around it.",
  "a_keeper_s_reading": "A keeper’s reading glass. Through it, the faint marks resolve — there is writing everywhere you did not see.",
  "that_is_all_of": "Nine lampblack marks found. Their measurements agree.",
  "the_stones_hum_lower": "The stones hum lower here, as through water.",
  "e_g_a_d": "E, G, A, D, C — with the fallen stone’s lower note beneath them. All six stones sound.",
  "the_stones_refuse_the": "The fourth note rings wrong. The dawn bird sang that part differently.",
  "the_outcrop_opens_like": "A slab slides into the rock. Behind it, a lens on a dry shelf.",
  "some_corrections_only_ever": "The fourth stone answers the higher pitch.",
  "the_bird_sings_the": "The bird sings the box’s song. Almost.",
  "the_bay_gives_up": "The bay gives up a road of wet stone.",
  "the_lighthouse_remembers_its": "The full lighthouse lens seats. Its beam falls through the tower onto the lit model lamp.",
  "the_beam_writes_on": "The beam returns four figures from the west cliff.",
  "the_risen_capitals_catch": "Four figures reflect from the capitals above the drowned hall, in the same order as the cliff.",
  "far_out_on_the": "The beam catches on the drowned hall and holds for one circuit.",
  "a_chart_table_and": "The table holds a model of the island. There is a light in its tiny window.",
  "centimetre_marks_underfoot_tall": "The ruler marks are taller than you now.",
  "the_dory_and_its": "The beached dory holds one unused oar. Its line remains fast to the jetty.",
  "you_set_the_phial": "You set the phial from the high pool on the chart table. In the dry air of the study, the little roll of paper loosens from the glass at last.",
  "the_inner_door_stands": "The door to the east room is open.",
  "you_have_stood_here": "The cup is where you left it. The window is open a little.",
  "another_study_west_of": "A facing study contains a drained model basin and a lit model lamp.",
  "a_bell_buoy_listing": "A bell-buoy, listing in the drowned channel. It keeps ringing anyway.",
  "you_did_not_run": "Under a held gaze, the figure raises its head and breaks into a cold light.",
  "far_along_the_shore": "A small cold light stands on the far shore for three breaths, then goes dark.",
  "you_stop_wading_for": "When movement stops, the form surfaces and sends one low note across the water.",
  "faint_from_the_kelp": "Faint, from the kelp: the note it laid, still crossing the water now and then.",
  "click_and_the_sea": "Click, and the sea will hurry.",
  "the_tide_brought_you": "The light is on. A path leads up from the beach.",
  "down_is_the_only": "The plate’s lower ring is lit. Its upper ring is dark.",
  "there_is_no_level": "This is the surface. The east room is through the open door.",
  "you_run_the_mechanism": "The room draws smaller. The table above comes into view.",
  "salt_and_lamp_oil": "The familiar smell of lamp oil. The kettle has cooled.",
  "far_down_a_light": "A light burns in the room below.",
  "there_you_are_a": "A lit point appears on the model shore.",
  "the_ground_gives_you": "Sand underfoot again.",
  "already_at_the_bottom": "The line ends here.",
  "everything_down_here_is": "Marks below the water line have sharper edges than those above.",
  "the_rope_is_still": "A rope swings above the weeds. Someone tied it recently.",
  "the_water_over_the": "The water over the hall is moving. Something is coming up.",
  "the_light_passes_under": "The light passes under the water — once, all the way around.",
  "the_line_takes_the": "The line settles into the cleat’s worn turns.",
  "one_true_line_signed": "The observed water level is signed beneath the earlier entries.",
  "the_small_flame_takes": "The wick catches. The blue blanket comes into view.",
  "wound_the_way_he": "The spring takes one full turn. The cylinder begins to move.",
  "folded_into_my_coat": "The folded record fits inside the coat lining.",
  "the_drawer_takes_it": "The record rests beside the District returns.",
  "left_with_him_at": "Weighted on the source slab, above the wet line.",
  "the_jetty_s_outer": "The jetty’s outer arm is a shadow under green water.",
  "the_bench_faces_the": "Water washes over the bench seat. There is still a dry place at one end.",
  "the_skiff_is_off": "The skiff has lifted off its blocks. Its line is still tied to the old anchor.",
  "field_report_taken_copied": "Note sent — position, view, state and a screenshot went with it."
};

// ---- finale observations ----------------------------------------------------
// Four physical dispositions, four visible results. The coda reports state without
// scoring it. Unknown retired ending kinds deliberately produce no copy.
export function finaleCoda(kind, s = {}) {
  const lines = [];
  if (kind === 'tend') lines.push('water held at the marked line', 'The evening watch begins. The east-room window stays lit.');
  if (kind === 'carry') {
    const removed = Math.max(0, Number(s.removed ?? 0) || 0);
    lines.push(`${removed} intervention${removed === 1 ? '' : 's'} reversed`, 'Water retreats below and returns above. There is room to beach the little boat.');
  }
  if (kind === 'open') lines.push('upper and lower basins joined', 'Both gauges settle. For a while, the rooms share the sound of water.');
  if (kind === 'close') lines.push('plate sealed', 'The transfer stops here. The water below remains. In the east room, a cup beside the kettle.');
  if (!lines.length) return [];
  if (s.filed > 0) lines.push('The papers you filed are in the east-room cabinet.');
  if (s.kept > 0) lines.push('The papers you left below are weighted above the water.');
  return lines;
}
