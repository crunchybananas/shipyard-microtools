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
  // keyed by W.level; level 2 falls through to the level-4 line, as it always has.
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
    journal: 'A letter in the coat pocket, never sent. The kettle has been on a long time.',
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
    journal: 'A bottle on the beach, a note inside: the keeper says the light is lit for someone — and today he has decided that someone can be you.',
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
    journal: 'Through the keeper’s reading glass, lampblack on the chart too small for the eye: he keeps the light not for ships — there are none — but so that when he goes down, something stays lit above him to climb back toward.',
  },
  lens_mark_stone: {
    kind: 'inscription', hand: 'keeper', title: 'Scratched into the stone, hair-fine',
    pages: [
      '(only the glass shows it) Whoever you are, holding this glass: you are not the first to read these. You will not be the last.',
      'We each think we are the one who went down. We are each also the light left lit. The whole trick of it is to be the one who fell AND the one who keeps the lamp — at once, without choosing. Hold both. And climb.',
    ],
    journal: 'Hair-fine letters on a standing stone, shown only by the glass: “We each think we are the one who went down. We are each also the light left lit. Hold both, and climb.”',
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

// The fragments that say MORE the deeper you read them (LORE.deepFrom). Reaching a deep
// page records the id in W.regions.fragmentsFound and accretes a journalDeep line; reading
// ALL of them assembles the grief→integration arc (ui.js _renderReader fires the payoff).
// Spread across the descent: the stone bares at L2, logbook+cot turn at L3, the box at L4.
export const DEEP_FRAGMENTS = ['stone_inscription', 'keeper_logbook', 'quarters_journal', 'music_note'];

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
];
