// ledger.js — the stack's append-only record of what hands did (STACK.md §3.1/§3.2).
//
// THE LAW: a solution is never dissolved, only displaced. Every act that makes
// your rung easier makes the rung below harder. This module is the bookkeeping
// for that law and nothing else — it holds no opinion about how a mark is drawn
// or what a tide looks like.
//
//   a MARK   — one recorded act, scoped to the rung it was performed on
//   a HAND   — whoever performed it (you, a past you, or online, a stranger)
//   the DRAFT— how much water a mark displaces onto everything below it
//
// A rung inherits the marks of the rungs ABOVE it: their evidence is what you
// wake up in, and their draft is the water you wake up standing in.
//
// Deliberately dependency-free (no three.js, no DOM, no localStorage) for the
// same reason save-schema.js is: node imports it directly and the whole contract
// is exercised headlessly. world.js owns the storage I/O at its boundary.
//
// SANITATION IS NOT OPTIONAL. A shared source makes these marks arrive from
// strangers. Every inbound payload therefore goes
// through sanitizeLedger() before it can touch WorldState: unknown kinds dropped,
// positions clamped to the island's bounds, per-rung counts capped, total draft
// clamped. A hostile ledger must not be able to drown a player or inject geometry.
// The call sites must never sanitize; this module must never trust.

export const LEDGER_VERSION = 2;

// A shore line is intentionally small: it has to fit as one scratched thought,
// and online it becomes permanent stranger-controlled text. Count code points,
// not UTF-16 halves, so a non-ASCII hand is not cut in the middle of a character.
export const MAX_WRITING_LENGTH = 48;
export const MAX_WRITINGS_PER_RUNG = 8;

// Its own storage key, deliberately NOT part of the save payload: wiping a save
// starts your run over, but the stack you are standing in outlives you. That is
// the thesis, and it is also why "Begin again" must not hand you a dry island.
export const LEDGER_KEY = 'abyme-ledger-v2';

// Who you are to the stack. Kept apart from the ledger AND from the save: a new
// run is a new run, but it is the same hand — so your rung-1 work still reads as
// one person's when rung 2 inherits it.
export const HAND_KEY = 'abyme-hand-v1';

// The island's playable extent, used only to clamp inbound positions to somewhere
// a mark could plausibly have been made. Generous — this rejects garbage and
// hostile coordinates, not unusual play.
const BOUND_XZ = 400;
const BOUND_Y = 120;

// ---------------- the mark kind table ----------------------------------------
// One row per act the game records. `draft` is in TIDE UNITS — the same scale as
// W.tide, where 1.0 is high water and the LEVELS table already raises to 1.35 /
// 1.65 / 1.9. So these are deliberately small: a full clean run of the surface
// chain displaces roughly a tenth of a tide onto the rung below, and a rung that
// has been worked hard by several hands is visibly, but not unfairly, deeper.
//
//   evidence — whether an inherited mark should render as something you can find
//              (slice 4). Kinds that are pure bookkeeping stay invisible.
//
// A flag with no row here records NOTHING. That is the default and it is correct:
// only the god-verbs — the acts that reach through the model and change the world
// — cost anybody anything. Reading a letter is free; writing is the named exception.
export const MARK_KINDS = {
  // the four instruments on the chart table: the model reaching into the world
  valve:   { draft: 0.030, evidence: true },   // the sea moved because you asked
  crank:   { draft: 0.012, evidence: false },  // the hour moved; cheap, but it moved
  ruler:   { draft: 0.022, evidence: true },   // a bridge that is now always there
  lens:    { draft: 0.018, evidence: true },   // a light that now burns every night
  // the world-side acts that leave the island permanently altered
  chest:   { draft: 0.008, evidence: true },
  hatch:   { draft: 0.020, evidence: true },
  stones:  { draft: 0.010, evidence: true },
  plumb:   { draft: 0.014, evidence: true },
  // the plate itself — the heaviest act in the game, because it is the one that
  // makes a new rung for somebody to be born on
  dive:    { draft: 0.060, evidence: true },
  // THE EXCEPTION. Words travel down like every other mark, but displace no water
  // and never become a generic pale scuff: the dedicated shore renderer carries
  // them. This is the one thing a hand can leave below that is not harm.
  writing: { draft: 0.000, evidence: false },
};

// Which progression flags ARE acts of displacement. puzzles.js `flag()` is the
// single choke point every one-shot flag passes through, so this table is the
// one-shot recording surface. Repeated physical acts (`lens` placement and one
// `dive` per rung) record directly at their action sites.
//
// Note the choices: taking the ruler is free, LAYING it is the act — the bridge is
// what the rung below inherits. Opening the chest costs a little because the lid
// stays open forever.
export const FLAG_MARKS = {
  valveTurned: 'valve',
  crankUsed:   'crank',
  rulerPlaced: 'ruler',
  chestOpen:   'chest',
  hatchOpen:   'hatch',
  birdSolved:  'stones',
  plumbHung:   'plumb',
};

// Per-rung retention. Online, a popular rung accumulates marks without bound;
// we keep the most recent N and drop the rest. Chosen so a rung reads as WORKED
// (crowded with other hands) without the evidence pass ever having to place more
// props than the power budget allows.
export const MAX_MARKS_PER_RUNG = 64;

// The most water the whole stack above you may ever push down, no matter how many
// hands worked it. Without this cap an old enough rung is unplayable — the island
// is simply underwater — and a hostile ledger could put it there on purpose.
export const MAX_DRAFT = 0.75;

// Dispositions are immutable operations. The sanitized ledger reduces them to a
// compact CRDT-like state: one durable CARRY tombstone per hand, one winning
// OPEN/CLOSE register per rung, and a bounded set of inert TEND acknowledgements.
// The high cap covers every active hand that could survive the mark retention
// budget while still placing a hard ceiling on hostile local/network payloads.
export const MAX_DISPOSITION_OPS = (MAX_MARKS_PER_RUNG + MAX_WRITINGS_PER_RUNG) * 64 + 128;
const MAX_TEND_OPS = 64;
const MAX_CLOCK = 0x7ffffffe;

// ---------------- construction ------------------------------------------------

// THE DISPOSITIONS (STACK.md §6) — the last act of displacement.
//
// Every other verb in the game pushes cost downhill. These are the only four that
// decide what happens to what you already pushed, and they are the one place a
// player can pay a cost instead of passing it on. They are ledger operations, not
// cards: an ending that only changes a line of text would be the same ending.
//
//   TEND   your marks stay. You add nothing further. (the default; costs nothing,
//          helps nobody, and is an honest answer)
//   CARRY  your marks are ERASED. The rung below inherits less water because you
//          went back and undid your own work. The only generous ending, and it
//          costs you the record of everything you did.
//   OPEN   your marks stay AND the rung below's draft starts flowing back onto
//          you. Connection, at cost, in both directions.
//   CLOSE  your marks stay and the rung below is SEALED — nothing of yours reaches
//          them, and nothing ever will. Peace, made smaller.
export const DISPOSITIONS = ['tend', 'carry', 'open', 'close'];

export function emptyLedger() {
  return { v: LEDGER_VERSION, marks: [], ops: [] };
}

// Perform a disposition on behalf of `hand`, standing on `rung`. Pure: it mutates
// the ledger and returns what changed, so the caller can narrate it truthfully
// (the coda says how many marks you took back, and it has to be the real number).
export function dispose(led, { kind, rung, hand }) {
  if (!DISPOSITIONS.includes(kind)) return null;
  const r = Number(rung);
  const h = sanitizeHand(hand);
  if (!Number.isInteger(r) || r < 1 || r > 64 || !h) return null;

  const n = nextClock(led);
  if (n === null) return null;
  const operation = { k: kind, r, h, n };
  const before = led.marks.length;
  const normalized = sanitizeLedger({
    marks: led.marks,
    ops: [...(Array.isArray(led.ops) ? led.ops : []), operation],
  });
  led.v = LEDGER_VERSION;
  led.marks = normalized.marks;
  led.ops = normalized.ops;

  const result = { kind, operation };
  if (kind === 'carry') result.removed = before - led.marks.length;
  if (kind === 'close') result.sealedAt = r;
  if (kind === 'open') result.openAt = r;
  return result;
}

// A mark is stored short because it is eventually a network payload:
//   k  kind (a MARK_KINDS key)   r  rung it was performed on (1..)
//   h  hand id                   n  logical operation clock (ordering)
//   at [x,y,z] or null           — where, when the kind is worth showing
//   t  sanitized text            — writing only; absent on every costed mark
export function sanitizeWriting(value) {
  if (typeof value !== 'string') return '';
  // NFKC closes visually-confusable width variants; controls and every run of
  // whitespace collapse to one ordinary space. Rendering uses canvas (never HTML),
  // but sanitation still belongs here because shared payloads are hostile input.
  const clean = value.normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    // Invisible direction controls can make a shared line appear to say
    // something other than its stored order. Keep joiners used by emoji and
    // scripts, but drop bidi overrides, isolates, BOM and zero-width space.
    .replace(/[\u200b\u200e\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return Array.from(clean).slice(0, MAX_WRITING_LENGTH).join('');
}

function sanitizeHand(value) {
  if (typeof value !== 'string') return '';
  const hand = value.slice(0, 16);
  return /^[A-Za-z0-9_-]{1,16}$/.test(hand) ? hand : '';
}

function sanitizeClock(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= MAX_CLOCK ? n : null;
}

// Lamport clock for operations and marks made against the ledger currently in
// hand. A later action observed in this replica always supersedes an earlier one;
// concurrent replicas resolve equal clocks deterministically in compareOps().
function nextClock(led) {
  let latest = -1;
  for (const item of [...(led?.marks || []), ...(led?.ops || [])]) {
    const n = sanitizeClock(item?.n);
    if (n !== null && n > latest) latest = n;
  }
  return latest < MAX_CLOCK ? latest + 1 : null;
}

const OP_ORDER = { tend: 0, open: 1, close: 2, carry: 3 };
function compareOps(a, b) {
  if (a.n !== b.n) return a.n - b.n;
  if (a.h !== b.h) return a.h < b.h ? -1 : 1;
  if (a.r !== b.r) return a.r - b.r;
  return OP_ORDER[a.k] - OP_ORDER[b.k];
}

function newer(a, b) {
  return !a || compareOps(a, b) < 0 ? b : a;
}

function makeMark(kind, rung, hand, seq, at, text = '') {
  const mark = {
    k: kind,
    r: rung | 0,
    h: String(hand || '?').slice(0, 16),
    n: seq | 0,
    at: at && at.length === 3 && at.every(Number.isFinite)
      ? [+at[0], +at[1], +at[2]]
      : null,
  };
  if (kind === 'writing') mark.t = sanitizeWriting(text);
  return mark;
}

// ---------------- recording ---------------------------------------------------

// Append one mark. Returns it, or null when the kind is unknown or its payload is
// unusable (the overwhelmingly common case at flag() sites — most flags are free).
//
// Idempotent per (hand, rung, kind): turning the valve forty times is one act of
// displacement, not forty. The world already gates most of these behind a
// one-shot flag, but the ledger must not depend on that discipline holding.
export function record(led, { kind, rung, hand, at = null, text = '' }) {
  if (!MARK_KINDS[kind]) return null;
  if (kind === 'writing' && !sanitizeWriting(text)) return null;
  const r = Number(rung);
  if (!Number.isInteger(r) || r < 1 || r > 64) return null;
  const h = sanitizeHand(hand);
  if (!h) return null;
  if (led.marks.some((m) => m.h === h && m.r === r && m.k === kind)) return null;

  const seq = nextClock(led);
  if (seq === null) return null;
  const mark = makeMark(kind, r, h, seq, at, text);
  led.marks.push(mark);
  pruneRung(led, r);
  return mark;
}

// Keep the most recent MAX_MARKS_PER_RUNG on a rung. "Recent" is append order,
// which is the only ordering that survives a merge of several hands' logs — there
// are no wall-clock timestamps in a mark, on purpose (they would be a lie across
// machines and a fingerprint across players).
function pruneRung(led, rung) {
  const costed = [], words = [];
  for (let i = 0; i < led.marks.length; i++) {
    if (led.marks[i].r !== rung) continue;
    (led.marks[i].k === 'writing' ? words : costed).push(i);
  }
  // Helpful text has its own small budget. It can never evict the costed history
  // and quietly lower somebody's tide merely because a popular rung got chatty.
  const drop = new Set([
    ...costed.slice(0, Math.max(0, costed.length - MAX_MARKS_PER_RUNG)),
    ...words.slice(0, Math.max(0, words.length - MAX_WRITINGS_PER_RUNG)),
  ]);
  if (!drop.size) return;
  led.marks = led.marks.filter((_, i) => !drop.has(i));
}

// ---------------- reading -----------------------------------------------------

// What was done ON this rung.
export function marksAt(led, rung) {
  return led.marks.filter((m) => m.r === (rung | 0));
}

// What you INHERIT standing on this rung: everything performed above you, which
// is everything you are living inside and did not do. Ordered shallowest-first,
// so evidence from directly overhead reads as the freshest.
export function inheritedAt(led, rung) {
  const r = rung | 0;
  // A CLOSE seals a rung: nothing from at-or-above it reaches anyone deeper. Take
  // the DEEPEST seal above you — a later hand's seal supersedes an earlier one's,
  // because the water has to get past the lowest closed door first.
  const seals = (led.ops || []).filter((op) => op.k === 'close' && op.r < r).map((op) => op.r);
  const floor = seals.length ? Math.max(...seals) : 0;
  return led.marks.filter((m) => m.r < r && m.r > floor).sort((a, b) => a.r - b.r || a.n - b.n);
}

// The active bidirectional-flow state at one rung. OPEN and CLOSE share a single
// last-writer register, so the ledger can never claim both at once.
export function boundaryAt(led, rung) {
  const r = rung | 0;
  const op = (led.ops || []).find((candidate) =>
    candidate.r === r && (candidate.k === 'open' || candidate.k === 'close'));
  return op ? op.k : null;
}

// An OPEN rung also takes on what is BELOW it — the one disposition where cost runs
// uphill. Only marks strictly deeper than the opened rung count, and only for the
// rung that was opened, so opening does not leak the whole stack onto everybody.
function openBackflowAt(led, rung) {
  const r = rung | 0;
  if (boundaryAt(led, r) !== 'open') return [];
  return led.marks.filter((m) => m.r > r);
}

// A sealed flow boundary must not make a future run impossible. The hand event is
// an observation of what happened immediately above, not inherited material or
// water, so it deliberately reads across OPEN/CLOSE while still respecting CARRY
// tombstones (carried marks have already been removed from led.marks).
export function upstreamEventsAt(led, rung, kind) {
  const r = rung | 0;
  if (r <= 1 || !MARK_KINDS[kind]) return [];
  return led.marks
    .filter((m) => m.r === r - 1 && m.k === kind)
    .sort((a, b) => b.n - a.n || (a.h < b.h ? -1 : a.h > b.h ? 1 : 0));
}

// Only the inherited marks worth SHOWING (slice 4 places these in the world).
export function evidenceAt(led, rung) {
  return inheritedAt(led, rung).filter((m) => MARK_KINDS[m.k] && MARK_KINDS[m.k].evidence);
}

// Words visible on a rung: everything that survives the inheritance law above,
// plus this hand's own fresh line on the rung where it was scratched. A CLOSE
// therefore closes words too; OPEN does not pull words uphill, because a promise
// was made to the next hand down, not to the hand above.
export function writingsAt(led, rung, hand = null) {
  const r = rung | 0;
  const inherited = inheritedAt(led, r).filter((m) => m.k === 'writing');
  const h = hand == null ? null : String(hand).slice(0, 16);
  // Firebase uids are longer than the compact ledger hand field. Compare the
  // canonical prefix on both sides so a freshly authenticated hand still sees
  // its own same-rung line after a remote reconciliation.
  const own = marksAt(led, r).filter((m) =>
    m.k === 'writing' && (h === null || String(m.h).slice(0, 16) === h));
  return [...inherited, ...own].sort((a, b) => a.r - b.r || a.n - b.n);
}

// THE DRAFT: the water everything above you displaces onto you. Clamped, always.
// Rung 1 inherits nothing: nobody is upstream of the surface. OPEN is the named
// exception, carrying half the lower basin's cost back uphill.
export function draftAt(led, rung) {
  let d = 0;
  for (const m of inheritedAt(led, rung)) d += (MARK_KINDS[m.k] || { draft: 0 }).draft;
  // an OPEN rung carries the water of everyone below it too, at half weight — the
  // cost of connection is real but it must not exceed simply being downstream
  for (const m of openBackflowAt(led, rung)) d += (MARK_KINDS[m.k] || { draft: 0 }).draft * 0.5;
  return Math.min(d, MAX_DRAFT);
}

// The tide a rung actually sits at: its authored baseline (LEVELS[n].tide) plus
// what it inherited. The one function the world should call.
export function tideFor(led, rung, baseTide) {
  const base = Number.isFinite(baseTide) ? baseTide : 1;
  return base + draftAt(led, rung);
}

// How many DISTINCT hands have worked at or above this rung. The chart tally
// counts levels today (v1); under this spine it counts hands (STACK.md §4).
export function handsAbove(led, rung) {
  return new Set(led.marks.filter((m) => m.r <= (rung | 0)).map((m) => m.h)).size;
}

// ---------------- sanitation --------------------------------------------------

// Everything inbound — from localStorage, from a file, and from slice 8's server —
// lands here first. Never throws: a wholly unusable payload becomes an empty
// ledger, because an island with no history is playable and a crash is not.
export function sanitizeLedger(raw) {
  const out = emptyLedger();
  if (!raw || typeof raw !== 'object') return out;

  // Reduce disposition operations before marks. CARRY is a high-water tombstone:
  // every mark by that hand at or below its clock stays retired even if an older
  // remote copy arrives in a later merge. OPEN/CLOSE is one LWW register per rung.
  const carries = new Map();
  const boundaries = new Map();
  const tends = new Map();
  for (const candidate of Array.isArray(raw.ops) ? raw.ops : []) {
    if (!candidate || typeof candidate !== 'object' || !DISPOSITIONS.includes(candidate.k)) continue;
    const r = Number(candidate.r);
    const h = sanitizeHand(candidate.h);
    const n = sanitizeClock(candidate.n);
    if (!Number.isInteger(r) || r < 1 || r > 64 || !h || n === null) continue;
    const op = { k: candidate.k, r, h, n };
    if (op.k === 'carry') carries.set(h, newer(carries.get(h), op));
    else if (op.k === 'open' || op.k === 'close') boundaries.set(r, newer(boundaries.get(r), op));
    else tends.set(h + '|' + r, newer(tends.get(h + '|' + r), op));
  }

  const boundaryOps = [...boundaries.values()].sort(compareOps);
  const carryBudget = Math.max(0, MAX_DISPOSITION_OPS - boundaryOps.length - MAX_TEND_OPS);
  const carryOps = [...carries.values()].sort(compareOps).slice(-carryBudget);
  const structural = [...boundaryOps, ...carryOps];
  const roomForTends = Math.max(0, Math.min(MAX_TEND_OPS, MAX_DISPOSITION_OPS - structural.length));
  const inert = [...tends.values()].sort(compareOps).slice(-roomForTends);
  out.ops = [...structural, ...inert].sort(compareOps);

  const activeCarry = new Map(out.ops.filter((op) => op.k === 'carry').map((op) => [op.h, op]));
  const byIdentity = new Map();
  for (const m of Array.isArray(raw.marks) ? raw.marks : []) {
    if (!m || typeof m !== 'object') continue;
    if (!MARK_KINDS[m.k]) continue;                       // unknown/renamed kind
    const r = Number(m.r);
    if (!Number.isInteger(r) || r < 1 || r > 64) continue;
    const h = sanitizeHand(m.h);
    if (!h) continue;
    const n = sanitizeClock(m.n);
    if (n === null) continue;

    // Validate writing before claiming its idempotency key. Otherwise a hostile
    // empty line placed first could mask a later valid copy of the same mark.
    const text = m.k === 'writing' ? sanitizeWriting(m.t) : '';
    if (m.k === 'writing' && !text) continue;

    // One ACTIVE mark per (hand, rung, kind), same rule as record(). A mark made
    // after CARRY has a newer clock and becomes a legitimate new act; stale copies
    // at or below the tombstone can never resurrect.
    const key = h + '|' + r + '|' + m.k;

    let at = null;
    if (Array.isArray(m.at) && m.at.length === 3 && m.at.every((v) => Number.isFinite(+v))) {
      const cl = (v, b) => Math.max(-b, Math.min(b, +v));
      at = [cl(m.at[0], BOUND_XZ), cl(m.at[1], BOUND_Y), cl(m.at[2], BOUND_XZ)];
    }
    const mark = makeMark(m.k, r, h, n, at, text);
    const carried = activeCarry.get(h);
    if (carried && mark.n <= carried.n) continue;

    const prior = byIdentity.get(key);
    if (!prior || prior.n < mark.n || (prior.n === mark.n && markFingerprint(prior) < markFingerprint(mark))) {
      byIdentity.set(key, mark);
    }
  }
  out.marks = [...byIdentity.values()].sort((a, b) =>
    a.r - b.r || a.n - b.n || (a.h < b.h ? -1 : a.h > b.h ? 1 : a.k.localeCompare(b.k)));

  // cap every rung AFTER the merge, not per source
  for (const rung of new Set(out.marks.map((m) => m.r))) pruneRung(out, rung);
  return out;
}

function markFingerprint(mark) {
  return JSON.stringify([mark.t || '', mark.at || null]);
}

// ---------------- payload -----------------------------------------------------

export function packLedger(led) {
  const clean = sanitizeLedger(led);
  return { v: LEDGER_VERSION, marks: clean.marks, ops: clean.ops };
}

// The game is in development: there is one current ledger contract and no legacy
// adapter. Bumping the version starts a fresh stack namespace deliberately.
export function applyLedger(raw) {
  return raw && raw.v === LEDGER_VERSION ? sanitizeLedger(raw) : emptyLedger();
}

// State-based merge used by both local tests and the shared source. Sanitation is
// the reducer: operation order and duplicate delivery cannot change the outcome.
export function mergeLedgers(...ledgers) {
  return sanitizeLedger({
    marks: ledgers.flatMap((led) => Array.isArray(led?.marks) ? led.marks : []),
    ops: ledgers.flatMap((led) => Array.isArray(led?.ops) ? led.ops : []),
  });
}

// ---------------- the source interface ----------------------------------------
//
// A SOURCE is where marks come from. The local one is your own history: the acts
// you performed on rung 1 are what rung 2 inherits, so the whole thesis is
// playable single-player with no server and no stranger. A complete shared source
// can fetch other hands' marks for a rung; NOTHING else changes,
// because every consumer reads through this interface.
//
//   load()                    → the sanitized materialized ledger
//   pushMark(mark)            → persist one mark fact
//   pushDisposition(operation)→ persist one disposition operation/tombstone
//
// `io` is the storage shim world.js passes in ({ get, set }) so this module stays
// free of localStorage and remains node-testable.
export function localSource(io) {
  let led = null;
  const persist = () => {
    try { io.set(LEDGER_KEY, JSON.stringify(packLedger(led || emptyLedger()))); } catch (_) {
      /* private mode: the stack forgets, the island still works */
    }
  };
  return {
    load() {
      if (led) return led;
      let raw = null;
      try { raw = JSON.parse(io.get(LEDGER_KEY) || 'null'); } catch (_) { raw = null; }
      led = applyLedger(raw);
      return led;
    },
    pushMark(mark) {
      if (!mark) return;
      persist();
    },
    pushDisposition(operation) {
      if (!operation || !DISPOSITIONS.includes(operation.k)) return;
      persist();
    },
    // Forget the stack in place — storage AND the in-memory cache. Without the
    // second half, clearing the key looks like it worked and the old draft keeps
    // being served from this closure until a reload. (Playtest tooling needs the
    // no-reload path: a reload lands on the title screen, not the world.)
    clear() {
      led = emptyLedger();
      try { io.set(LEDGER_KEY, JSON.stringify(packLedger(led))); } catch (_) { /* private mode */ }
    },
  };
}

// A hand id: stable for one player's history, meaningless to anyone else. Not a
// fingerprint — 8 hex characters of local randomness, generated once and stored.
// Collisions across strangers are harmless (two hands read as one).
export function newHandId(rand = Math.random) {
  let s = '';
  for (let i = 0; i < 8; i++) s += Math.floor(rand() * 16).toString(16);
  return s;
}

// Read the stored hand, minting one on first run. Falls back to an ephemeral id
// when storage is unavailable (private mode): that session's marks still cost the
// rung below correctly, they just don't survive the tab.
export function loadHandId(io, rand = Math.random) {
  let id = null;
  try { id = io.get(HAND_KEY); } catch (_) { id = null; }
  if (typeof id === 'string' && /^[0-9a-f]{1,16}$/.test(id)) return id;
  id = newHandId(rand);
  try { io.set(HAND_KEY, id); } catch (_) { /* private mode: this hand is a ghost */ }
  return id;
}
