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
