// content.js — the island's WORDS, in one place.
//
// As ABYME pivots toward "a deep story, a lot of content," narrative text moves out of
// the engine handlers and into data here, so a line can be rewritten — or, soon, VOICED
// — without touching puzzles.js / main.js logic. This first slice centralises the
// KEEPER's spoken lines (exactly the material the voice routing and the "the light was
// lit for you" twist will edit) and the journal SKETCHES. The diegetic whisper/journal
// PAGE catalogue is the next content tick; those stay at their call sites for now where
// they are coupled to puzzle logic.
//
// All metaphor, no biography — an abstract lighthouse poem (see loop/SPINE.md).

// ---- THE KEEPER -------------------------------------------------------------
// The drowned voice one floor down — the only "I/you" in the game. Spare, metaphor
// only; recognition curdling into resignation the deeper you go. These are the lines
// the voice layer (bm_george, through the drowned bus) routes, and the ones the twist
// re-points from below to eye-level on the final approach. The quote marks are part of
// the line: his words are always in quotes.
export const KEEPER = {
  // when the figure looks back as you lean over the chart-table model, at depth (#14).
  // keyed by W.level; the look fires only from L3 down (puzzles gates at W.level >= 3),
  // and at the bottom the look[4] line opens the twist beat.
  look: {
    3: '“Oh. Not again.”',
    4: '“You’re faster than I was. Don’t be proud of it.”',
  },
  // his answer when you first arrive at a new depth (#14). `deep` is W.level >= 4.
  arrive: {
    shallow: '“Oh. You came down too.”',
    deep: '“There is no bottom. I looked.”',
  },
  // the last, resigned line as you climb back up past him; then he falls silent (#12).
  farewell: '“…go on up. Don’t leave the light on for me. I never could.”',
};

// ---- THE LORE CORPUS (the reading surface / Meow-Wolf unfolding) -------------
// Books, letters, charts, inscriptions the player OPENS and READS — the keeper's life
// assembled in fragments, found in any order across the world. Each fragment: { kind, hand,
// title, pages[], deepFrom?+deep[] (extra pages legible only at W.level>=deepFrom — the surface
// read vs the deep read), journal? (a story-bearing line added to the journal on first read) }.
// All metaphor: the lensmaker who keeps a light for someone out on the water, the rising sea,
// the model built to hold one day back. Reading marks W.readKeys (the Codex + the endgame book).
export const LORE = {
  keeper_logbook: {
    kind: 'book', hand: 'keeper', title: 'The Keeper’s Logbook',
    pages: [
      'I keep the light. That is the whole of it, set down plainly, the way you are taught to set it down. Wind from the south-west. The lamp trimmed. The glass clear. A keeper’s hand should be dull on the page. Mine wants to say more, and must not.',
      'Ground a new lens today — the fourth this season. The last one fogged where I breathed on it too long. A lens is only patience made solid: you take a flaw, and you turn it, and turn it against the stone, until the flaw becomes a way of seeing. I keep the light so that someone out on the water can find the way back to the shore. That is the use of patience. That is the use of me.',
      'The sea stands higher this month than last, and last than the month before. I marked the old line on the third step, and the new one has gone over it. No one else has marked it. I do not say it aloud. To say a thing is to let it be true.',
      'I have begun to build the island again, small, upon the chart table. A foolishness. But if I can hold the whole of it in my two hands — the shore, the stones, this room with its very small lamp — then perhaps I am holding the day it was still whole. The model does not lie. It only hopes.',
      'Smaller. The model needs a model, for the model has a sea too, and that sea is rising in it. So I built one smaller still inside it, and the smallest holds a lamp the size of a grain of light. I cannot stop. Each one is the day held a little tighter. Each one drowns a little slower.',
      'If you are reading this, you have come a long way down to find it. Do not be proud of how fast you came; I was slow, and the slowness was the only mercy I had. Keep the light, or do not. But do not leave it burning for no one — that is the cruelty I taught myself, and I would not teach it to you.',
    ],
    deepFrom: 3,
    deep: [
      '(The hand here is not steady. It may be mine. It may be yours.) There is no bottom — I have looked. Each room I make to be safe becomes the next room I am afraid in. The trick the sea teaches: you do not drown all at once. You drown a little, and call it keeping busy.',
    ],
    journal: 'Found the keeper’s logbook on the chart table. He ground lenses to keep a light for someone out on the water — and when the sea began to rise, he started building the island again, small, to hold one whole day back.',
    journalDeep: 'Read again from the deep, the logbook’s last page turns colder, the hand no longer steady: there is no bottom — he has looked. Each room built to be safe becomes the next room he is afraid in. You do not drown all at once; you drown a little, and call it keeping busy.',
  },
  coat_letter: {
    kind: 'letter', hand: 'keeper', title: 'A letter, folded small',
    pages: [
      'I write this and I will not send it, because to send it is to admit you are far enough away to need a letter.',
      'The light still turns. I want you to know that. Whatever you saw from the water — whatever it looked like, out there — the light still turns, and I am the one turning it, and I have not stopped, and I will not.',
      'Come up the stairs. The kettle is on. It has been on a long time.\n\n— the one who keeps it',
    ],
    deepFrom: 3,
    deep: [
      '(folded inside the fold, in a smaller hand — the part I did not let myself write the first time) The kettle is not on for you. I have known that a while now. It is on for me — for the version of me still out on the water, who has not yet understood he is allowed to come in. I keep it warm so that when he finally rows up to the door, soaked and ashamed and years too late, there is something waiting that does not ask him where he has been.',
    ],
    journal: 'A letter in the coat pocket, never sent. The kettle has been on a long time.',
    journalDeep: 'Read again from deeper down, the unsent letter gives up its smaller hand: the kettle was never for someone else. It is on for the part of him still out on the water — kept warm for the soaked, ashamed, years-too-late self, so that when he finally rows up to the door, something waits that does not ask where he has been.',
  },
  stone_inscription: {
    kind: 'inscription', hand: 'keeper', title: 'Cut into the standing stone',
    pages: [
      'WE WHO WENT DOWN\nLEFT THE LIGHT FOR\nWHOEVER WASHES UP\n\n— turn it, and turn it',
    ],
    deepFrom: 2,
    deep: [
      '(the tide has been over the stone, and below the old cut a fainter line is bared — the same chisel, later, set lower than any dry hand would reach)\n\nAND WHOEVER WASHES UP\nIS WHO WENT DOWN.\nTHERE WAS ONLY EVER ONE.',
    ],
    journal: 'Words cut into a standing stone, worn soft by the sea: “We who went down left the light for whoever washes up.”',
    journalDeep: 'The tide has been over the standing stone, and below the worn cut a fainter line is bared — set lower than any dry hand would reach: “and whoever washes up is who went down. there was only ever one.”',
  },
  // washed up at the wake-up beach — the FIRST fragment most players meet, an invitation.
  bottle_note: {
    kind: 'letter', hand: 'keeper', title: 'A note in a bottle, washed up',
    pages: [
      'To whoever finds this — and someone always does; the sea is a poor keeper of secrets — the light you can see from here is mine.',
      'If you are reading this on my beach, you have already come further than most turn back. Keep going, or do not. But know the light is lit, and it is lit for someone.\n\nToday I have decided that someone can be you.',
    ],
    deepFrom: 2,
    deep: [
      '(the paper has a back, and the back was written on too, in a smaller hand that did not expect to be read — because by the time you turn it over, you have already gone under) You found this on the beach and thought it was meant for some stranger the light was waiting on. It was not. I wrote "someone can be you" because I could not yet write the truer thing. The someone was always you. The light was always yours. I have kept it lit on your own behalf, against the day you would come back up the beach from the wrong direction — out of the water, not down the road — and need to be told you are allowed to come in.',
    ],
    journal: 'A bottle on the beach, a note inside: the keeper says the light is lit for someone — and today he has decided that someone can be you.',
    journalDeep: 'Turned over once you have gone under, the bottle’s note has writing on its back: “someone can be you” was the truer thing he could not yet say — the someone was always you, the light always yours, kept lit against the day you would come back up the beach out of the WATER, not down the road, and need telling that you are allowed to come in.',
  },
  // SEA-STRATA L2: a wax slate hidden in the kelp (loop #132) — the keeper's FIRST shallow
  // descent, and a diegetic hint for the Tide-Figure that stands in this same water. Lives in
  // region2, so it is reachable (and readable) only at L2 — a depth-specific hidden fragment.
  kelp_slate: {
    kind: 'inscription', hand: 'keeper', title: 'A wax slate, tangled in the kelp',
    pages: [
      'I went down the first time only as far as the kelp — no deeper. I told myself I was checking the mooring. A keeper is allowed his small lies; they are the ballast that lets a man sink slowly enough to bear it.',
      'There is a shape that stands in the kelp at this depth. Soft, and dark, and patient. The first dive I waded at it, certain it was the one I keep the light for — and it scattered like silt and was gone. The second dive I did not chase. I stood, and was still, and let it be what it was: which was me, waiting for me. Be still with it. It is not cruel. It is only early.',
    ],
    journal: 'A wax slate tangled in the L2 kelp — the keeper’s first shallow descent. A soft dark shape stands in the kelp: wade at it and it scatters like silt; be still and it resolves. “It was me, waiting for me. It is not cruel. It is only early.”',
  },
  // SEA-STRATA L3: a cairn on the bluff (loop #134), the keeper's note from deeper in the descent
  // — the high dry vantage over the drowned hall, and a diegetic hint for the Watcher (don't run,
  // don't look away — hold its gaze and it lets go). Lives in region3, readable only at L3.
  bluff_cairn: {
    kind: 'inscription', hand: 'keeper', title: 'A cairn on the bluff, scratched in the top stone',
    pages: [
      'I stacked these stones where the water has not yet reached, to mark the last dry place I know. From here you can see it: the drowned hall, the tops of the columns breaking the surface like a hand going under. I built those rooms, every one, to be safe in. I am also the sea that took them. Both. At once. That is the thing no one tells you.',
      'There is a watcher in the deep water below. It comes toward you when you turn away, and stops when you face it. Do not run — running is only how it follows. Do not look away. Hold its gaze, and keep holding, until it lifts its head and lets you go. It was never the sea’s. It is your own attention, walked all this way down to find you. Meet it. Then climb.',
    ],
    journal: 'A cairn on the L3 bluff, the keeper’s mark scratched in the top stone: from the last dry place he watches the drowned hall break the surface — the rooms he built AND the sea that took them, both at once. A warning, too: there is a watcher in the deep water; don’t run, don’t look away. “Hold its gaze until it lets you go. It is your own attention, come to find you.”',
  },
  // SEA-STRATA L4 'source': a note left at the bottom (loop #135), the keeper's last instruction —
  // a diegetic frame for the chart-table look-back + carry-up (the integration). Lives in region4,
  // readable only at L4. Completes the per-level hint set (L2 Tide-Figure, L3 Watcher, L4 keeper).
  source_note: {
    kind: 'letter', hand: 'keeper', title: 'A note left at the bottom, weighted with a stone',
    pages: [
      'If you have come all the way down to the source, then there is only the one errand left, and I will set it down plainly so you cannot pretend you did not understand. Go to the chart table. Lean over the model — over the smallest island, the one with the grain-of-light lamp.',
      'Someone is bent over it. Do not flinch when he lifts his head. He is not a stranger and he is not the sea; he is the one you came down here to find, which is to say he is you, at the worst hour, still keeping a light. Turn him to face you. Then carry him up. Do not leave him at the bottom — leaving him is the only way to lose, and I have lost that way before, and I would not have you learn it.',
    ],
    journal: 'A note weighted with a stone on the cold floor of the source: the last errand. Lean over the chart-table model; the one bent over it is not a stranger, not the sea — he is you, at the worst hour, still keeping a light. Turn him to face you and carry him up. “Leaving him at the bottom is the only way to lose.”',
  },
  // the keeper's PRIVATE bedside journal, in the quarters behind the inner door (revealed one
  // level down). The intimate counterpart to the public logbook; its deep page turns toward the
  // descent — he begins to suspect the one he keeps the light for went DOWN, not out to sea.
  quarters_journal: {
    kind: 'book', hand: 'keeper', title: 'A journal kept by the cot',
    pages: [
      'The public log is for the inspector. This one is for me, and I keep it where no inspector goes — under the pillow, against my own ear. Here I am allowed to say it plainly: I am afraid. Not of the sea. Of being the last one awake when it comes.',
      'I drew the island again tonight — smaller — on the wall where I can see it from the cot. My hand does this without me now. They say a man draws what he cannot say, and I have said nothing aloud in a long while, so my hand has a great deal of work.',
      'There was someone I keep the light for. I will not set the name down — to write it is to admit how long the lamp has burned with no boat coming. But I trim it every dusk. A light kept for no one is only a fire; a light kept for someone is a promise. I choose, each dusk, to call it a promise.',
    ],
    deepFrom: 3,
    deep: [
      '(later, in a worse hand) I have begun to suspect the one I keep the light for is not out on the water, rowing up toward me. I think they are already here — that they came, and went DOWN, and that I have aimed the beam at the wrong horizon all this time. Tomorrow I will turn it to face the deep. Tomorrow I will go down and look.',
    ],
    journal: 'Found the keeper’s private journal by his cot — kept under the pillow, against his own ear. He is afraid of being the last one awake; he draws the island smaller each night; he trims a light at every dusk for someone he will not name.',
    journalDeep: 'From further down, the cot-journal turns: he stopped trusting the horizon. He came to suspect the one he kept the light for went DOWN, not out to sea — and resolved to turn the lamp to face the deep, and go down after them.',
  },
  // legible ONLY once you hold the keeper's reading glass — lampblack written too small for the
  // naked eye. The found-lens reveal (puzzles.js): these marks fade in when W.flags.readGlass.
  lens_mark_study: {
    kind: 'inscription', hand: 'keeper', title: 'Lampblack, too small to read by eye',
    pages: [
      '(the glass makes it legible) I write the true things small, in lampblack, where only a patient hand with a glass will ever find them. The inspector reads the big log and goes home satisfied.',
      'You have a glass, and a patient hand, so here is a true thing: I am not keeping the light to save a ship. There are no ships. I am keeping it so that when I finally go down to look, there will be something lit above me to climb back toward.',
    ],
    deepFrom: 3,
    deep: [
      '(smaller still, and the glass shakes as you read it — or your hand is mine) If you are reading even this, with the glass, from down here, then you already know the thing I could write only at the very bottom of the very small: there is no inspector, no ship, no other light kept by anyone else. There is only this — one hand, grinding one lens, to read one true line by which to find the way back up. You are the patient hand. You always were. Now put the glass down, and climb.',
    ],
    journal: 'Through the keeper’s reading glass, lampblack on the chart too small for the eye: he keeps the light not for ships — there are none — but so that when he goes down, something stays lit above him to climb back toward.',
    journalDeep: 'The smallest lampblack line, read with the glass from the deep: there is no inspector, no ship, no other light — only one hand grinding one lens to read one true line by which to climb back up. “You are the patient hand. You always were. Put the glass down, and climb.”',
  },
  lens_mark_stone: {
    kind: 'inscription', hand: 'keeper', title: 'Scratched into the stone, hair-fine',
    pages: [
      '(only the glass shows it) Whoever you are, holding this glass: you are not the first to read these. You will not be the last.',
      'We each think we are the one who went down. We are each also the light left lit. The whole trick of it is to be the one who fell AND the one who keeps the lamp — at once, without choosing. Hold both. And climb.',
    ],
    deepFrom: 3,
    deep: [
      '(below the hair-fine line, fainter, as if added on a different night — or by the same hand much later) Count the scratches under this one, if you can hold the glass steady. Each is someone who stood here, went down, and came back up far enough to add a mark and leave the glass for the next. You think your grief is the deepest, and the first. It is neither — and that is the only comfort the stone has to give: the way down is worn smooth by everyone who climbed back. Add your mark. Leave the glass. Climb.',
    ],
    journal: 'Hair-fine letters on a standing stone, shown only by the glass: “We each think we are the one who went down. We are each also the light left lit. Hold both, and climb.”',
    journalDeep: 'Below the hair-fine letters, fainter, read with the glass from the deep: count the scratches — each is someone who stood here, went down, and climbed back up far enough to add a mark and leave the glass for the next. “You think your grief is the deepest and the first. It is neither. The way down is worn smooth by everyone who climbed back. Add your mark. Leave the glass. Climb.”',
  },
  // sealed in the high pool's phial (#49 round trip) — found glinting in the DRY pool at the
  // surface, floated free only at the bottom (the risen sea reaches the basin at last), dried
  // and read back at the surface study. A letter addressed to the SEA itself: the reader's
  // arrival condition (water this high = the bottom) is baked into the fiction.
  pool_phial: {
    kind: 'letter', hand: 'keeper', title: 'A note sealed in a phial, dried and unrolled',
    pages: [
      'To the sea — because you will arrive; everything I keep comes to you in the end. I found this pool already old when I came: your work, from some year when you stood higher than anyone now believes. Then you drew back and left it to the gulls, the way you leave everything you take. I am sealing this against the day you climb back up for it.',
      'When you stand this high again, it will mean the island is nearly done, and so am I. So here is the one thing I ask, set down while my hand is still dry: whoever fishes this out of your risen water — let them up. They will have come down a long way to be standing there. Carry them back to the surface the way you carry everything else you finally return. That is all. Keep the rest.\n\n— the keeper of the light above you',
    ],
    journal: 'The dried note from the phial is a letter to the SEA, sealed against the day it rose high enough to take it. He asked it one thing: that whoever fishes the phial from the risen water be let back up — carried to the surface “the way you carry everything else you finally return.”',
  },
  // the inspector's tide ledger (#55), wedged in the drain — the INSTITUTIONAL record of
  // the rising sea, its official hand cracking. A written artifact, not a speaking voice
  // (the keeper stays the game's only I/you); it countersigns his instruments from outside:
  // the gauge's rings, the logbook's third step, the buoy's channel.
  drain_ledger: {
    kind: 'book', hand: 'inspector', title: 'A tide ledger, water-swollen',
    pages: [
      'DISTRICT OF LIGHTS — QUARTERLY RETURN. Station: the island. Keeper: [the ink has run]. Mean high water: RISEN — see appendix. Appendix: missing. Remarks: the keeper’s figures disagree with the printed tables. The keeper’s figures are carefully made. The printed tables are reprinted each year unchanged. One of these is a record; the other is a habit.',
      'SECOND QUARTER. Mean high water: risen again. The boat-store stair is wet at the third step at neap. I have signed the return, and I note here, unofficially, between one damp page and the next: no one reads these. I file them to a cabinet that floods. The keeper alone measures as if measuring mattered — his rings on the channel staff are the only honest instrument in this district. I have recommended him for commendation and expect nothing.',
    ],
    deepFrom: 3,
    deep: [
      '(the last leaf, unlined — the official hand abandoned) They will close the station before they will reprint the tables. When the water reaches the archive, the district will finally agree with the keeper — all at once, and by drowning. I have left this ledger where the tide can countersign it. What you bury, the tide still finds. What you file, it finds sooner.',
    ],
    journal: 'A tide ledger, water-swollen, wedged where the drain wall meets the floor — the district’s official record of the rising sea. The printed tables never changed; his figures did. “One of these is a record; the other is a habit.”',
    journalDeep: 'The ledger’s last leaf, read from the deep, drops the official hand: they would close the station before reprinting the tables — when the water reaches the archive, the district will agree with him all at once, and by drowning. He left it where the tide could countersign it. “What you file, it finds sooner.”',
  },
  // #50-A: the inspector's second fragment. The AMBIGUITY ENGINE is canon (lens_mark_study's
  // deep page negates him), so every inspector artifact must survive two readings: a real
  // official, or the keeper writing in an invented hand to feel witnessed.
  commendation_copy: {
    kind: 'letter', hand: 'inspector', title: 'A carbon copy, kept',
    pages: [
      'CARBON RETAINED — RECOMMENDATION FOR COMMENDATION. To the District Board: I write concerning the keeper of the island light. His returns are exact where exactness costs sleep. His lens-work is the finest in the district, and the light has never once stood dark on his watch. I am aware the Board does not commend stations scheduled for review. I recommend him anyway. Some records exist to be filed. This one exists to be true.',
    ],
    deepFrom: 3,
    deep: [
      '(read again from below, the sheet gives up its trouble: the carbon is the top copy. There is no pressed original beneath it — and a carbon without an original is not a copy of anything; it is a letter never sent, in a hand very like a man praising himself in the only voice he could bear to hear it in. Or it is exactly what it claims, and the original went to a Board that never answered. The glass cannot settle it. Neither can I.)',
    ],
    journal: 'A carbon copy kept by the cot: the inspector recommending him for commendation — “some records exist to be filed; this one exists to be true.” He kept the copy. Of course he kept the copy.',
    journalDeep: 'Read from below, the carbon gives up its trouble: there is no pressed original — praise in a hand very like his own, a copy of nothing; or exactly what it claims, sent to a Board that never answered. The glass cannot settle which. I have stopped needing it to.',
  },
  // #50-A: the inspector's third fragment — the end of keeping, drafted. deepFrom 4: the
  // bottom alone can read what the notice actually is.
  closure_notice: {
    kind: 'letter', hand: 'inspector', title: 'A notice of review, folded small',
    pages: [
      'NOTICE OF REVIEW — DISTRICT OF LIGHTS. The Board, having considered the returns of the island station, finds the cost of its keeping to exceed the traffic served. The light is to be extinguished and the station struck from the list, effective the turn of the quarter. The keeper will present himself at the mainland office with the log, the instruments, and the great lens.',
    ],
    deepFrom: 4,
    deep: [
      '(from the bottom, the notice reads otherwise. The date is blank. The quarter is never named. An order to extinguish a light that never says WHEN is not an order — it is a fear, drafted in officialese: the day the keeping ends, written down to see whether it could be survived on paper first. He did not obey it. There may have been nothing to obey. Either way the light is still lit. Go up and see.)',
    ],
    journal: 'Folded small under the chart table’s rim: a notice of review — the light to be extinguished, the station struck from the list, “effective the turn of the quarter.” He wedged it where he would see it every day, and did not obey it.',
    journalDeep: 'From the bottom, the notice comes apart: the date is blank, the quarter never named. Not an order — a fear drafted in officialese, the end of keeping written down to see whether it could be survived on paper first. Either way: the light is still lit. Go up and see.',
  },
  // on the MODEL's own chart table (#53) — a margin the width of a fingernail, read only by
  // someone bent over a model with a glass: which is exactly what HE was when he wrote it.
  // The recursion speaks to the next hand down.
  model_margin: {
    kind: 'inscription', hand: 'keeper', title: 'The model’s margin, under the glass',
    pages: [
      '(the glass, pressed close over the model’s little chart table — a margin the width of a fingernail, and on it, his smallest hand) You are bent over a model with a glass in your hand. That is what I was when I wrote this. That is what whoever reads the margin below this one will be. It does not end. I have stopped needing it to.',
      'To the next hand down, whichever of us you are: the sea in your model is rising too. Hold the day as long as you can bear to. Then let the model hold it instead. That is all a model is for — a place to set a day down, so your two hands are free.',
    ],
    journal: 'On the MODEL’s chart table, under the glass: a margin the width of a fingernail, written in his smallest hand — a letter to the next hand down. “It does not end. I have stopped needing it to.”',
  },
  // folded into the music box on the study shelf — ties the box/bird puzzle (the fourth note he
  // bends DOWN where the bird bends it UP) to his grief: the thing he could never do, that you do.
  music_note: {
    kind: 'letter', hand: 'keeper', title: 'A note folded into the music box',
    pages: [
      'I wind it more than I should. Five notes — E, G, A, D, C — and then I wind it again. The fourth note is wrong; I have always known it is wrong; I bend it down where it ought to bend up, and I cannot make my hands do otherwise. A man plays the song he can play, not the song he means.',
      'I wound it for someone who is not here to hear the fourth note come out wrong. If you are the one who finally hears the bird sing it right — the way I never could — then you have done the one small thing I came all this way down to do, and could not.\n\nWind it once for me. Then let it stop.',
    ],
    deepFrom: 4,
    deep: [
      '(unfolded all the way, there is writing on the inside of the fold, pressed so faint it needs the deep dark to show)\n\nI was wrong to ask you to let it stop. Wind it once for me — yes — and then keep it. The fourth note will always bend the way your hands bend it; that is not the flaw to be ground out. That is the playing. Carry the song up wrong, and call the wrongness yours, and it is music.',
    ],
    journal: 'A note folded into the music box: he wound it for someone not there to hear, and could never play the fourth note right — he bends it down where the bird bends it up. “Wind it once for me. Then let it stop.”',
    journalDeep: 'Unfolded all the way, faint on the inside of the fold, he takes the asking-back: “Wind it once — and then keep it. The fourth note bends the way your hands bend it. That is not the flaw; that is the playing. Carry the song up wrong, and call it yours, and it is music.”',
  },
};

// ---- THE CLIMBERS (#50-B: the worn way down) -----------------------------------------
// lens_mark_stone's deep page promised them: "count the scratches under this one — each
// is someone who stood here, went down, and came back up far enough to add a mark."
// Five marks in five visibly different hands, one per depth along the descent's spine.
// Written hands only; none of them knows the player — the keeper stays the only I/you.
export const CLIMBERS = [
  { id: 'cmTallies',
    whisper: 'Under the hair-fine letters, just as they said: tally strokes — dozens, in fists of five — and one place where a hand rested so many times the stone has gone smooth.',
    journal: 'Scratched under the glass — the tallies beneath the standing stone: dozens of strokes in fists of five, and a palm-hollow worn smooth where each of them must have leaned. Not a message. Attendance.' },
  { id: 'cmFormal',
    whisper: 'An old formal hand, every letter ruled straight: “I DESCENDED IN MY SIXTIETH YEAR. THE SEA WAS ALREADY IN THE PARLOUR.”',
    journal: 'Scratched under the glass — an old formal hand low on the tower wall, ruled straight as a return: “I DESCENDED IN MY SIXTIETH YEAR. THE SEA WAS ALREADY IN THE PARLOUR.” Dignity, kept to the last inch of it.' },
  { id: 'cmPlain',
    whisper: 'A plain hand on the stone: “went down for my brother. came up with the weather.”',
    journal: 'Scratched under the glass — a plain hand on a stone in the kelp: “went down for my brother. came up with the weather.” It does not say whether he found him. The weather says.' },
  { id: 'cmUnfinished',
    whisper: 'A hurried hand, low on the cairn: “day nine below. the lamp is” — and it stops.',
    journal: 'Scratched under the glass — low on the cairn, a hurried hand: “day nine below. the lamp is”. It stops there. Either the light went out, or it did not and there was nothing further worth carving. I have decided to believe the second.' },
  { id: 'cmChild',
    whisper: 'Small letters, close to the cold floor, in a hand still learning its letters: “im not lost. dont come down.”',
    journal: 'Scratched under the glass — small letters close to the floor of the source, in a hand still learning its letters: “im not lost. dont come down.” The bravest lie on the island. Somebody’s whole descent, in six words.' },
];
export const CLIMBERS_CLOSE = {
  whisper: 'Five hands, five descents. The way down is worn smooth — you have been reading the wear.',
  journal: 'I have found five climbers’ hands now, one at every depth: the counter, the dignified, the brother, the day-niner, the child. None of them made it into any log. The way down is worn smooth by every hand that climbed it back — and the stone under my palm is smooth, so most of them did. I am one of the hands now.',
};

// ---- THE CONGREGATION (#50-C: the WE in the stone) -----------------------------------
// The jetty stone's founding plural ("WE WHO WENT DOWN / LEFT THE LIGHT / FOR WHOEVER
// WASHES UP") finally accounted for: three monumental lines carved on the drowned hall,
// readable only at L3 when the capitals break the surface — across the water, through
// the glass. Liturgical, pre-keeper, no I and no you.
export const CONGREGATION = [
  { id: 'cgRoof',
    line: 'WE RAISED THE ROOF ABOVE THE SPRING TIDE’S REACH',
    journal: 'Carved on the drowned hall, read across the water: “WE RAISED THE ROOF ABOVE THE SPRING TIDE’S REACH.” The water stands above the roofline now. They measured a sea that kept its word for a while.' },
  { id: 'cgCount',
    line: 'WE COUNTED OURSELVES EACH WINTER — …',
    journal: 'Carved on the drowned hall, read across the water: “WE COUNTED OURSELVES EACH WINTER —” and then the number, effaced by the sea. A census kept until the counting stopped mattering, or the counters did.' },
  { id: 'cgLight',
    line: 'WHEN THE WATER CAME WE WENT UP THE HILL AND BUILT A LIGHT',
    journal: 'Carved on the drowned hall: “WHEN THE WATER CAME WE WENT UP THE HILL AND BUILT A LIGHT.” So the light is older than its keeper. They built it climbing OUT — the lighthouse is what a congregation of the drowning made of their own ascent. He has been keeping their promise, not only his.' },
];
export const CONGREGATION_CLOSE = {
  whisper: 'Three lines, one WE. The stone at the jetty finally has its congregation.',
  journal: 'The drowned hall has given up its three carved lines, and the WE of the jetty stone has faces now — a congregation that raised roofs against the tide, counted its winters, and when the water came anyway, went up the hill and built the light. Whoever washes up is who went down. They wrote it first. Everyone since has only been keeping it lit.',
};

// ---- THE LAMPBLACK MARKS (#54: the reading-glass payoff) -----------------------------
// The glass promised "writing everywhere" and gated exactly two planes. Now nine more
// micro-marks hide on the working things of the keeper's life — one line each, found in
// any order, tallied diegetically in the journal ("the third of his small true things").
// Words live here; geometry lives in props LAMPBLACK_SITES; gates live in puzzles.
export const LAMPBLACK = [
  { id: 'lmValve', place: 'the brass valve',                      line: 'The sea always minded the wheel. It never once minded me.' },
  { id: 'lmBox',   place: 'the music box',                       line: 'Wound it again. The wrong note is the only part that sounds like me.' },
  { id: 'lmChest', place: 'the half-buried chest',               line: 'A chest keeps what you can bear to close. The rest you carry.' },
  { id: 'lmDory',  place: 'the dory’s hull',                     line: 'One oar is enough for leaving. It was never enough for following.' },
  { id: 'lmJetty', place: 'the jetty lantern post',              line: 'Lit for whoever rows in. Lately I light it so the water has something to hold.' },
  { id: 'lmStair', place: 'the stair to the lamp',               line: 'Ten thousand times up. The light never once came down to meet me. That is what keeping is.' },
  { id: 'lmBell',  place: 'the small bright bell',               line: 'A bell is a wound given a use.' },
  { id: 'lmBuoy',  place: 'the listing bell-buoy',               line: 'I moored it over the safe water. The safe water moved. It did not.' },
  { id: 'lmDrain', place: 'the drain wall, beside the carved line', line: 'And what the tide finds, it returns. That is the mercy nobody warns you of.' },
];

// The CANONICAL deep-read arc (#76: DEEP_SETS): the fragments that say MORE the deeper
// you read them, grouped by the depth their cold page bares at. Counts are DERIVED —
// nothing downstream may assume "four" — so a new deep fragment is one line here.
// (Other fragments with deepFrom pages — the bottle, the coat, the lens marks — stay
// BONUS reads outside the arc, acknowledged but untallied, as shipped.)
export const DEEP_SETS = {
  2: ['stone_inscription'],                                                     // the tide bares the stone
  3: ['keeper_logbook', 'quarters_journal', 'drain_ledger', 'commendation_copy'], // the hands turn colder (+#55, +#50-A)
  4: ['music_note', 'closure_notice'],                                          // the fold gives up its inside; the notice comes apart
};
export const DEEP_FRAGMENTS = Object.values(DEEP_SETS).flat();

// ---- journal marginalia (SKETCHES) -----------------------------------------
// A small ink sketch for each journal entry, matched by words the entry contains — so
// every save, old or new, gets its pictures (loop #72). renderJournal() in ui.js looks
// each entry's text up here. Moved out of ui.js so the journal's PAGES and PICTURES can
// live together as content.
const S = (body) => `<svg viewBox="0 0 96 40" xmlns="http://www.w3.org/2000/svg" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5">${body}</svg>`;
export const SKETCHES = [
  ['living model of the island', S('<path d="M14 30h68M22 30v6M74 30v6"/><path d="M24 30c4-8 14-10 24-10s20 2 24 10" opacity=".5"/><path d="M40 20l6-7 6 7"/><path d="M30 26q6-3 12 0t12 0t12 0" opacity=".6"/>')],
  ['A valve beside the chart table', S('<circle cx="48" cy="18" r="11"/><path d="M40 10l16 16M56 10L40 26M48 29v7"/><path d="M30 34q4-3 8 0" opacity=".5"/>')],
  ['crank turns the orrery lamp', S('<path d="M20 30a30 30 0 0 1 56 0" opacity=".6"/><circle cx="76" cy="14" r="4"/><path d="M76 6v-3M84 14h3M82 7l2-2" opacity=".6"/><path d="M20 30l-4 4M16 34h7" />')],
  ['music box turns five notes', S('<rect x="14" y="22" width="26" height="12" rx="2"/><path d="M40 22l4-5" opacity=".6"/><circle cx="56" cy="22" r="2"/><circle cx="64" cy="18" r="2"/><circle cx="72" cy="15" r="2"/><circle cx="80" cy="24" r="2"/><circle cx="88" cy="27" r="2"/>')],
  ['small brass ruler from a chest', S('<path d="M20 26h24v8H20zM20 26l4-6h24l-4 6M48 20l-4 6"/><path d="M56 30h26M58 30v-3M64 30v-2M70 30v-3M76 30v-2M82 30v-3" />')],
  ['Laid the ruler over the crack', S('<path d="M10 32l22-2M64 30l22 2"/><path d="M32 30l8 8M64 30l-8 8" opacity=".6"/><path d="M28 24h40v5H28z"/><path d="M34 24v3M42 24v2M50 24v3M58 24v2"/>')],
  ['Set the small lens', S('<path d="M44 34V16M52 34V16M44 16h8"/><path d="M48 13l-4-5 4-5 4 5z"/><path d="M38 8l-5-3M58 8l5-3M48 1V-2" opacity=".6"/>')],
  ['golden hour the stones’ shadows', S('<path d="M20 16v8M32 14v10M44 15v9M56 13v11M68 15v9"/><path d="M20 24L8 34M32 24L20 36M44 24l-12 12M56 24l-12 13M68 24l-12 12" opacity=".5"/><path d="M82 30l4 4M86 30l-4 4"/>')],
  ['cellar: a brass plumb bob', S('<path d="M28 34h16M36 34V22"/><path d="M36 22l-3 6h6z"/><path d="M60 8v14l-3-4M60 22l3-4" opacity=".7"/><path d="M52 30q8 4 16 0" opacity=".5"/>')],
  ['Hung the plumb line', S('<path d="M48 4v18"/><path d="M48 22l-3 6h6z"/><path d="M36 34q12-6 24 0" opacity=".6"/><rect x="42" y="35" width="12" height="3" opacity=".8"/>')],
  ['stones accepted the bird', S('<path d="M24 32c-3-10 2-18 10-20l6 4-2 8c8 0 14 4 14 10" opacity=".8"/><path d="M52 18l6-4 6 4-6 4z"/><path d="M64 14l6 18" opacity=".5"/>')],
  ['bird on the stones sang', S('<path d="M30 24v10"/><path d="M30 24c0-4 3-6 6-5l4-4 1 5c3 2 2 6-1 7" opacity=".8"/><circle cx="56" cy="20" r="1.6"/><circle cx="63" cy="16" r="1.6"/><circle cx="70" cy="13" r="1.6"/><circle cx="77" cy="9" r="1.6"/><circle cx="84" cy="22" r="1.6"/><path d="M74 6l6 0" opacity=".5"/>')],
  ['At night the lamp burns', S('<path d="M30 36V14l4-6 4 6v22"/><path d="M34 14h0M30 20h8" opacity=".5"/><path d="M38 10l20 8M38 12l20 14" opacity=".6"/><path d="M62 22l3-4 3 4-3 4z"/><path d="M65 30v4" opacity=".5"/>')],
  ['projects four glyphs', S('<path d="M70 4v32" opacity=".7"/><path d="M10 10l44 8M10 14l44 10" opacity=".5"/><rect x="76" y="8" width="7" height="7"/><circle cx="80" cy="22" r="3.5"/><path d="M76 30l7 0-3.5 6z"/><path d="M76 -2l7 7" opacity="0"/>')],
  ['One level down', S('<rect x="20" y="8" width="56" height="26" rx="2" opacity=".6"/><rect x="32" y="14" width="32" height="14" rx="1.5" opacity=".8"/><rect x="42" y="18" width="12" height="6" rx="1"/><circle cx="48" cy="21" r="0.8"/>')],
  // the emotional / recursion climaxes — once plain, now illustrated like the rest,
  // so the journal's hand carries its most-read pages too (loop #72).
  ['mark has appeared on the model', S('<path d="M16 27c4-9 16-12 32-12s28 3 32 12" opacity=".55"/><path d="M12 30h72" opacity=".5"/><path d="M43 19l10 9M53 19l-10 9"/><circle cx="48" cy="23" r="8" opacity=".45"/>')],
  ['bottom of my own making', S('<rect x="12" y="5" width="72" height="31" rx="1.5" opacity=".35"/><rect x="25" y="11" width="46" height="20" rx="1.5" opacity=".55"/><rect x="37" y="17" width="22" height="11" rx="1" opacity=".85"/><circle cx="48" cy="23" r="1.7"/><path d="M43 27h10" opacity=".7"/>')],
  ['all the way down and all the way back', S('<path d="M12 36h13v-6h13v-6h13v-6h13v-6h12" opacity=".8"/><circle cx="80" cy="9" r="5"/><path d="M80 1v-1M89 9h1M87 3l1-1M87 15l1 1" opacity=".5"/>')],
  ['carrying what I found at the bottom', S('<path d="M16 36h11v-7h11v-7h11v-7h11v-6h11" opacity=".8"/><path d="M14 30l3-5 3 5z"/><path d="M17 25v-3" opacity=".6"/><path d="M40 16q4-2 8 0" opacity=".4"/>')],
  ['second study faces mine', S('<rect x="9" y="13" width="30" height="18" rx="1.5"/><rect x="57" y="13" width="30" height="18" rx="1.5" opacity=".7"/><path d="M15 25q9-5 18 0" opacity=".6"/><path d="M63 27h18" opacity=".6"/><path d="M46 9v22M50 9v22" opacity=".3"/>')],
  ['keep leaving this study', S('<path d="M22 35V17l7-4v22M22 23h7" opacity=".85"/><path d="M20 35h13"/><path d="M52 24h16v5q0 4-8 4t-8-4z"/><path d="M68 26q5 0 5 4t-5 3" opacity=".6"/>')],
  ['which of us holds the pen', S('<path d="M30 31l23-19 6 6-23 19-9 3z" opacity=".85"/><path d="M51 12l6 6" opacity=".5"/><path d="M20 35h9" opacity=".6"/>')],
  ['it only hopes', S('<path d="M16 26c4-8 14-11 24-11s20 3 26 11" opacity=".55"/><path d="M12 30h72"/><path d="M28 30h40" opacity=".7"/><path d="M70 13l2-4 2 4-2 3z" opacity=".6"/>')],
  // SEA-STRATA fragments + the deep-read close (loop #142) — give the accreting journal entries
  // from #131-140 their marginalia too, in the same low-stroke hand.
  ['wax slate tangled', S('<path d="M30 31c-6-6-9-14-8-23" opacity=".45"/><path d="M70 32c5-7 7-15 5-24" opacity=".45"/><rect x="36" y="9" width="24" height="23" rx="2"/><path d="M41 15h14M41 20h14M41 25h9" opacity=".7"/>')],
  ['cairn on the L3 bluff', S('<ellipse cx="48" cy="33" rx="17" ry="4.5"/><ellipse cx="46" cy="26" rx="12.5" ry="4"/><ellipse cx="49" cy="20" rx="8.5" ry="3.5"/><circle cx="48" cy="13" r="3"/><path d="M48 10v-3" opacity=".5"/>')],
  ['weighted with a stone on the cold floor', S('<path d="M30 26l28-7 3 10-28 7z"/><path d="M58 19l-7 2 3 7" opacity=".55"/><path d="M35 24l16-4M35 28l13-3" opacity=".4"/><ellipse cx="38" cy="28" rx="4" ry="3"/><path d="M18 35h60" opacity=".35"/>')],
  ['said more the deeper I read', S('<circle cx="48" cy="11" r="4.5"/><path d="M48 15v9"/><path d="M48 17l-9 5M48 17l9 5"/><path d="M40 23q-14 9 8 13t8-13" opacity=".6"/><path d="M12 36h72" opacity=".3"/>')],
  // the DEEP-READ marginalia (loop #145) — the colder hand each fragment turns from below.
  ['the logbook’s last page turns colder', S('<path d="M48 11c-7-4-15-4-22 0v20c7-4 15-4 22 0 7-4 15-4 22 0V11c-7-4-15-4-22 0z" opacity=".6"/><path d="M48 11v20" opacity=".45"/><path d="M48 30v8M44 35l4 4 4-4" opacity=".75"/>')],
  ['the cot-journal turns', S('<path d="M40 11h16l-2 7H42z"/><path d="M44 18v5h8v-5" opacity=".7"/><path d="M48 23v3M43 26l5 9 5-9z" opacity=".6"/><path d="M30 15l9 4M66 15l-9 4" opacity=".4"/>')],
  ['below the worn cut a fainter line is bared', S('<path d="M34 37V15c0-3 3-5 7-5h10c4 0 7 2 7 5v22z"/><path d="M40 18h16" opacity=".85"/><path d="M40 25h16" opacity=".3"/><path d="M14 37h68" opacity=".4"/>')],
  ['inside of the fold', S('<path d="M28 30l30-8 2 8-30 8z" opacity=".7"/><path d="M58 22l-6 2 2 6" opacity=".5"/><circle cx="40" cy="31" r="2"/><circle cx="51" cy="28" r="2"/><path d="M42 31v-8M53 28v-8" opacity=".75"/>')],
  // the two BONUS deep-read lines (loop #146) — finishing the journal marginalia.
  ['the kettle was never for someone else', S('<path d="M32 33c-2-8-1-14 4-16h20c5 2 6 8 4 16z"/><path d="M40 17c2-4 14-4 16 0" opacity=".7"/><path d="M56 22l8-3 1 4" opacity=".6"/><path d="M44 11q2-3 0-6M52 11q2-3 0-6" opacity=".5"/><path d="M28 36h36" opacity=".4"/>')],
  ['note has writing on its back', S('<path d="M22 23h26v12H22z"/><path d="M48 25l8 1v8l-8 1" opacity=".8"/><path d="M56 27h6v6h-6" opacity=".7"/><path d="M26 27h18M26 31h12" opacity=".45"/>')],
  ['one hand grinding one lens', S('<circle cx="40" cy="19" r="11"/><path d="M48 27l16 13" /><path d="M35 14a8 8 0 0 1 8 1" opacity=".5"/><path d="M40 19h0" /><path d="M58 30l8 4" opacity="0"/>')],
  ['worn smooth by everyone who climbed back', S('<path d="M30 12v16M37 12v16M44 12v16M51 12v16" /><path d="M26 26l29-18" opacity=".8"/><path d="M20 32h54" opacity=".45"/>')],
  // STORY PASS (2026-07-27): sixteen journal entries still rendered bare — including the
  // twist's own climaxes and both endings. The rest of the missing marginalia, same hand.
  ['lit at both ends of the', S('<path d="M14 36h12v-7h12v-7h12v-7h12v-7h12" opacity=".75"/><path d="M20 33q-2-4 0-6q2 2 0 6z"/><path d="M72 5q-2-4 0-6q2 2 0 6z" transform="translate(0 6)"/><path d="M20 26v-2M72 12v-2" opacity=".4"/>')],
  ['lighthouse lamp’s eye', S('<path d="M40 8l16 0 -3 24h-10z" opacity=".5"/><circle cx="48" cy="20" r="7"/><circle cx="48" cy="20" r="2.6" opacity=".8"/><path d="M35 20h-6M67 20h-6M48 7v-4" opacity=".45"/>')],
  ['left the light on, and I have left', S('<path d="M70 30V12l4-5 4 5v18" opacity=".8"/><path d="M74 12h0M70 18h8" opacity=".45"/><path d="M14 32q8 4 16 0l-2-6h-12z"/><path d="M22 26v-8M22 18l6 3" opacity=".7"/><path d="M36 33h52" opacity=".3"/>')],
  ['keeper’s reading glass on the islet', S('<circle cx="38" cy="18" r="9"/><path d="M45 25l14 11"/><path d="M33 16h10M33 20h7" opacity=".55"/><path d="M60 12h14M60 16h10" opacity=".25"/>')],
  ['bell-buoy lists', S('<g transform="rotate(14 48 24)"><path d="M38 30h20l-4-8h-12z" opacity=".8"/><path d="M42 22l6-12 6 12"/><path d="M45 17h6v4h-6z" opacity=".85"/></g><path d="M14 32q10 4 20 0t20 0t20 0t14 0" opacity=".45"/>')],
  ['toward me when I looked away', S('<path d="M64 34c0-8 3-12 6-12s6 4 6 12" opacity=".85"/><circle cx="70" cy="18" r="3.6" opacity=".85"/><circle cx="26" cy="16" r="6"/><circle cx="26" cy="16" r="2" opacity=".8"/><path d="M34 16h22" opacity=".35"/>')],
  ['stood in the kelp and slipped off', S('<path d="M24 36c-3-8-2-18 2-26M34 36c-2-6-1-14 2-22M74 36c3-8 2-18-2-26M64 36c2-6 1-14-2-22" opacity=".5"/><path d="M44 35c0-7 2-11 5-11s5 4 5 11" opacity=".7"/><circle cx="49" cy="19" r="3.2" opacity=".6"/>')],
  ['ground lenses to keep a light', S('<path d="M18 32V12h22v20" opacity=".7"/><path d="M18 12q11-5 22 0M22 17h14M22 21h14M22 25h9" opacity=".5"/><path d="M62 30V16l4-5 4 5v14" opacity=".8"/><path d="M66 16h0M62 21h8" opacity=".45"/>')],
  ['A letter in the coat pocket', S('<path d="M40 6l-9 6v22h34V12l-9-6z" opacity=".6"/><path d="M40 6h16v6H40z" opacity="0"/><rect x="42" y="20" width="16" height="10" rx="1"/><path d="M42 20l8 6 8-6" opacity=".8"/>')],
  ['worn soft by the sea', S('<path d="M40 36V14c0-4 3-7 8-7s8 3 8 7v22z"/><path d="M45 18h10M45 23h10M45 28h7" opacity=".45"/><path d="M12 36q8-4 16 0M68 36q8-4 16 0" opacity=".5"/>')],
  ['A bottle on the beach', S('<g transform="rotate(-8 44 24)"><path d="M40 34V18q0-4 4-6v-4h4v4q4 2 4 6v16z"/><path d="M42 22h8v8h-8z" opacity=".5"/></g><path d="M14 36h68" opacity=".4"/><circle cx="76" cy="8" r="4" opacity=".5"/>')],
  ['under the pillow', S('<path d="M16 30h56v4H16z" opacity=".7"/><path d="M20 30v-4q0-2 2-2h20q4 0 4 4v2" opacity=".85"/><rect x="52" y="22" width="14" height="8" rx="1"/><path d="M59 22v8" opacity=".5"/>')],
  ['lampblack on the chart too small', S('<rect x="26" y="8" width="34" height="24" rx="1" opacity=".6"/><path d="M30 14h20M30 18h24M30 22h16" opacity=".2"/><circle cx="56" cy="24" r="7"/><path d="M61 29l10 8" /><path d="M52 24h8" opacity=".7"/>')],
  ['Hair-fine letters on a standing stone', S('<path d="M38 36V13c0-4 3-6 8-6s8 2 8 6v23z"/><path d="M42 17h8M42 20h8M42 23h6" opacity=".18"/><circle cx="60" cy="24" r="6"/><path d="M64 28l9 7" opacity=".8"/>')],
  ['bends it down where the bird bends it up', S('<rect x="12" y="24" width="20" height="10" rx="2"/><circle cx="46" cy="18" r="2"/><circle cx="54" cy="15" r="2"/><circle cx="62" cy="12" r="2"/><circle cx="70" cy="22" r="2" opacity=".55"/><path d="M70 18q3-6 0-10" opacity=".4"/><circle cx="80" cy="9" r="2"/><path d="M84 6q4-2 6 1" opacity=".5"/>')],
  ['shut fast', S('<rect x="36" y="8" width="24" height="28" rx="1"/><path d="M40 14h16M40 22h16M40 30h16" opacity=".4"/><circle cx="55" cy="23" r="1.6"/><path d="M55 23v4" opacity=".7"/><path d="M30 36h36" opacity=".45"/>')],
  // #49 — the three optional chains (the high pool, the beam to the deep, the sixth note).
  ['sixth stone lies fallen', S('<path d="M20 32V16M30 32V13M40 32V15M50 32V12M60 32V14" opacity=".8"/><rect x="66" y="27" width="19" height="6" rx="2" transform="rotate(-9 75 30)"/><path d="M12 34h74" opacity=".35"/>')],
  ['fallen stone has its note back', S('<rect x="30" y="26" width="20" height="6" rx="2" transform="rotate(-9 40 29)"/><path d="M56 24q5-5 0-11M63 27q9-8 0-19" opacity=".55"/><circle cx="72" cy="12" r="2.2"/><path d="M74 12V5l4 1" opacity=".7"/><path d="M12 35h72" opacity=".35"/>')],
  ['played his song at the stones', S('<circle cx="18" cy="20" r="2"/><circle cx="29" cy="16" r="2"/><circle cx="40" cy="13" r="2"/><circle cx="51" cy="24" r="2"/><circle cx="62" cy="27" r="2"/><circle cx="78" cy="32" r="2.4"/><path d="M72 32h12" opacity=".5"/><path d="M18 18V8l4 1M78 30V20l4 1" opacity=".4"/>')],
  ['dry stone pool the sea abandoned', S('<ellipse cx="48" cy="24" rx="22" ry="8"/><ellipse cx="48" cy="24" rx="15" ry="5" opacity=".5"/><path d="M44 27l3 2" opacity=".8"/><path d="M46 26l4 4M50 26l-4 4" opacity=".9"/><path d="M10 36q10-4 20 0M66 36q10-4 20 0" opacity=".3"/>')],
  ['abandoned pool is full', S('<ellipse cx="48" cy="24" rx="22" ry="8"/><path d="M30 24q9 4 18 0t18 0" opacity=".7"/><g transform="rotate(-8 48 21)"><path d="M42 21h9M42 19v4M51 19v4" opacity=".9"/></g><path d="M8 12q10-4 20 0M68 12q10-4 20 0" opacity=".35"/>')],
  ['set the phial out to dry', S('<path d="M14 32h68" opacity=".7"/><g transform="rotate(-90 48 27) translate(0 2)"><path d="M44 14v14q0 3 4 3t4-3V14z"/><path d="M46 14h4v-4h-4z" opacity=".7"/></g><path d="M42 12q2-4 0-7M52 12q2-4 0-7M62 14q2-4 0-7" opacity=".4"/>')],
  ['turn the light to face the deep', S('<path d="M16 30V10l4-5 4 5v20" opacity=".85"/><path d="M20 10h0M16 16h8" opacity=".45"/><path d="M26 10l40 14M26 13l40 20" opacity=".55"/><path d="M60 34V22M70 34V24M80 34V23" opacity=".8"/><path d="M52 28q16 5 34 0" opacity=".4"/>')],
  ['letter to the SEA', S('<path d="M26 12h38l6 5v13H26z" opacity=".8"/><path d="M64 12v5h6" opacity=".6"/><path d="M31 19h24M31 24h18" opacity=".45"/><path d="M12 36q9-4 18 0t18 0t18 0t12 0" opacity=".55"/>')],
  // #50 — the three new hands: the climbers (shared + close), the congregation (shared +
  // close), and the inspector's two further fragments.
  ['Scratched under the glass —', S('<circle cx="26" cy="17" r="8"/><path d="M32 23l10 8"/><path d="M52 12l4 10M58 12l4 10M64 12l4 10M70 12l4 10" opacity=".6"/><path d="M54 30h24" opacity=".3"/>')],
  ['I am one of the hands now', S('<path d="M20 32c0-8 3-12 6-12s6 4 6 12M36 32c0-7 2-10 5-10s5 3 5 10M50 32c0-8 3-12 6-12s6 4 6 12M66 32c0-6 2-9 4-9s4 3 4 9" opacity=".7"/><path d="M12 34h72" opacity=".4"/><path d="M78 14q3-3 6 0" opacity=".5"/>')],
  ['Carved on the drowned hall', S('<path d="M24 30V16M36 30V13M48 30V15M60 30V13M72 30V16" opacity=".8"/><path d="M20 15h56" opacity=".6"/><path d="M28 20h8M40 18h8M52 20h8" opacity=".3"/><path d="M10 30q10 4 20 0t20 0t20 0t14 0" opacity=".5"/>')],
  ['They wrote it first', S('<path d="M30 34V20l6-8 6 8v14" opacity=".4"/><path d="M48 34V14l5-6 5 6v20" opacity=".85"/><path d="M53 14h0M48 22h10" opacity=".5"/><path d="M14 36h68" opacity=".35"/><path d="M68 10q4-3 8 0" opacity=".4"/>')],
  ['A carbon copy kept by the cot', S('<rect x="30" y="10" width="30" height="22" rx="1" opacity=".85"/><rect x="35" y="14" width="30" height="22" rx="1" opacity=".35"/><path d="M35 17h18M35 22h20M35 27h14" opacity=".45"/><path d="M14 36h30" opacity=".4"/>')],
  ['the carbon gives up its trouble', S('<rect x="34" y="12" width="30" height="22" rx="1" opacity=".85"/><path d="M39 17h18M39 22h20M39 27h14" opacity=".4"/><path d="M24 30l8-8M24 22l8 8" opacity=".6"/><circle cx="74" cy="16" r="5" opacity=".5"/><path d="M78 20l6 5" opacity=".5"/>')],
  ['notice of review', S('<rect x="32" y="8" width="32" height="26" rx="1" opacity=".85"/><path d="M37 14h22M37 19h22M37 24h16" opacity=".45"/><path d="M37 29h9" opacity=".2"/><path d="M60 27l6 6M66 27l-6 6" opacity=".7"/>')],
  ['survived on paper', S('<rect x="30" y="10" width="30" height="24" rx="1" opacity=".7"/><path d="M35 16h20M35 21h20" opacity=".4"/><path d="M35 27h12" opacity=".15"/><path d="M64 30V12l4-5 4 5v18" opacity=".85"/><path d="M68 12h0M64 18h8" opacity=".45"/>')],
  // #55 — the inspector's tide ledger.
  ['tide ledger, water-swollen', S('<path d="M28 30l24-5 2 8-24 5z" opacity=".85"/><path d="M52 25l-5 1 1.5 7" opacity=".6"/><path d="M33 29l14-3M34 33l11-2" opacity=".35"/><path d="M60 14h16M60 18h12M60 22h16" opacity=".3"/><path d="M12 36q10 4 20 0t20 0t20 0" opacity=".45"/>')],
  ['the tide could countersign', S('<path d="M26 12h36v18H26z" opacity=".7"/><path d="M30 17h20M30 21h26" opacity=".35"/><path d="M32 26q6-4 10 0t10 0" opacity=".85"/><path d="M12 36q10 4 20 0t20 0t20 0" opacity=".5"/>')],
  // #53 — the model's micro-finds (lean all the way in).
  ['a letter to the next hand down', S('<rect x="26" y="10" width="44" height="22" rx="1" opacity=".6"/><rect x="36" y="15" width="24" height="12" rx="1" opacity=".8"/><rect x="42" y="18" width="12" height="6" rx="0.5"/><circle cx="76" cy="28" r="6"/><path d="M80 32l8 6" opacity=".8"/>')],
  ['The invitation goes all the way down', S('<g transform="rotate(-8 40 24)"><path d="M36 30V18q0-3 3-4v-3h3v3q3 1 3 4v12z"/></g><g transform="rotate(-8 62 27) scale(0.55) translate(50 20)"><path d="M36 30V18q0-3 3-4v-3h3v3q3 1 3 4v12z" opacity=".7"/></g><path d="M14 34h68" opacity=".4"/><circle cx="22" cy="14" r="5" opacity=".5"/>')],
  ['a sea the size of a dinner tray', S('<ellipse cx="48" cy="26" rx="26" ry="8" opacity=".5"/><path d="M60 26V10"/><ellipse cx="60" cy="22" rx="3" ry="1"/><ellipse cx="60" cy="18" rx="3" ry="1"/><ellipse cx="60" cy="14" rx="3" ry="1" opacity=".45"/><circle cx="30" cy="24" r="4" opacity=".6"/>')],
  ['two figures on the model’s beach', S('<path d="M40 32c0-6 2-9 4-9s4 3 4 9" opacity=".85"/><circle cx="44" cy="19" r="2.6" opacity=".85"/><path d="M52 32c0-5 2-8 4-8s4 3 4 8" opacity=".85"/><circle cx="56" cy="21" r="2.4" opacity=".85"/><path d="M20 34h56" opacity=".4"/><path d="M14 12q6 3 12 0M70 12q6 3 12 0" opacity=".3"/>')],
  // #124 — the plate refuses the unmeasured deep.
  ['The plate would not take me deeper', S('<circle cx="30" cy="26" rx="0" r="11" opacity=".85"/><ellipse cx="30" cy="26" rx="11" ry="4" opacity=".5"/><path d="M52 12l8 6-6 5 9 7-5 6" opacity=".8"/><path d="M50 34h32" opacity=".4"/>')],
  // #52 — the tide gauge landmark.
  ['graduated staff, ringed at five heights', S('<path d="M48 5v31"/><ellipse cx="48" cy="31" rx="7" ry="2"/><ellipse cx="48" cy="25" rx="7" ry="2"/><ellipse cx="48" cy="19" rx="7" ry="2"/><ellipse cx="48" cy="13" rx="7" ry="2"/><ellipse cx="48" cy="7" rx="7" ry="2" opacity=".45"/><path d="M12 33q9-4 18 0M66 33q9-4 18 0" opacity=".5"/>')],
  // #54 — the lampblack tally (one shared sketch for all nine finds) + the completion.
  ['Lampblack, under the glass — on', S('<circle cx="34" cy="19" r="9"/><path d="M41 26l13 10"/><path d="M30 17h8M30 21h6" opacity=".7"/><path d="M56 14h26M56 19h20M56 24h23" opacity=".2"/>')],
  ['the last of the lampblack', S('<circle cx="26" cy="18" r="8"/><path d="M32 24l10 9"/><path d="M48 12v6M54 12v6M60 12v6M66 12v6M72 12v6" opacity=".7"/><path d="M48 24v6M54 24v6M60 24v6M66 24v6" opacity=".7"/><path d="M14 37h68" opacity=".3"/>')],
];
