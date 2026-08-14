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
// SANITATION IS NOT OPTIONAL. Slice 8 swaps the local source for an HTTP one and
// these marks start arriving from strangers. Every inbound payload therefore goes
// through sanitizeLedger() before it can touch WorldState: unknown kinds dropped,
// positions clamped to the island's bounds, per-rung counts capped, total draft
// clamped. A hostile ledger must not be able to drown a player or inject geometry.
// The call sites must never sanitize; this module must never trust.

export const LEDGER_VERSION = 1;

// Its own storage key, deliberately NOT part of the save payload: wiping a save
// starts your run over, but the stack you are standing in outlives you. That is
// the thesis, and it is also why "Begin again" must not hand you a dry island.
export const LEDGER_KEY = 'abyme-ledger-v1';

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
// — cost anybody anything. Reading a letter is free.
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
};

// Which progression flags ARE acts of displacement. puzzles.js `flag()` is the
// single choke point every flag passes through, so the whole recording surface is
// this table — a flag absent from it costs nobody anything, which is the default
// and the correct one. (`lens` has no flag: the placement sets the top-level
// W.lensPlaced, so that one site records directly.)
//
// Note the choices: taking the ruler is free, LAYING it is the act — the bridge is
// what the rung below inherits. Opening the chest costs a little because the lid
// stays open forever. Diving costs the most, because it makes the rung.
export const FLAG_MARKS = {
  valveTurned: 'valve',
  crankUsed:   'crank',
  rulerPlaced: 'ruler',
  chestOpen:   'chest',
  hatchOpen:   'hatch',
  birdSolved:  'stones',
  plumbHung:   'plumb',
  dove:        'dive',
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

// ---------------- construction ------------------------------------------------

export function emptyLedger() {
  return { v: LEDGER_VERSION, marks: [] };
}

// A mark is stored short because it is eventually a network payload:
//   k  kind (a MARK_KINDS key)   r  rung it was performed on (1..)
//   h  hand id                   n  that hand's sequence number (ordering)
//   at [x,y,z] or null           — where, when the kind is worth showing
function makeMark(kind, rung, hand, seq, at) {
  return {
    k: kind,
    r: rung | 0,
    h: String(hand || '?').slice(0, 16),
    n: seq | 0,
    at: at && at.length === 3 && at.every(Number.isFinite)
      ? [+at[0], +at[1], +at[2]]
      : null,
  };
}

// ---------------- recording ---------------------------------------------------

// Append one act. Returns the mark, or null when the kind is not one we cost
// (the overwhelmingly common case — most flags are free).
//
// Idempotent per (hand, rung, kind): turning the valve forty times is one act of
// displacement, not forty. The world already gates most of these behind a
// one-shot flag, but the ledger must not depend on that discipline holding.
export function record(led, { kind, rung, hand, at = null }) {
  if (!MARK_KINDS[kind]) return null;
  const r = rung | 0;
  if (!(r >= 1)) return null;
  const h = String(hand || '?').slice(0, 16);
  if (led.marks.some((m) => m.h === h && m.r === r && m.k === kind)) return null;

  const seq = led.marks.reduce((n, m) => (m.h === h && m.n >= n ? m.n + 1 : n), 0);
  const mark = makeMark(kind, r, h, seq, at);
  led.marks.push(mark);
  pruneRung(led, r);
  return mark;
}

// Keep the most recent MAX_MARKS_PER_RUNG on a rung. "Recent" is append order,
// which is the only ordering that survives a merge of several hands' logs — there
// are no wall-clock timestamps in a mark, on purpose (they would be a lie across
// machines and a fingerprint across players).
function pruneRung(led, rung) {
  const idx = [];
  for (let i = 0; i < led.marks.length; i++) if (led.marks[i].r === rung) idx.push(i);
  const excess = idx.length - MAX_MARKS_PER_RUNG;
  if (excess <= 0) return;
  const drop = new Set(idx.slice(0, excess));
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
  return led.marks.filter((m) => m.r < r).sort((a, b) => a.r - b.r || a.n - b.n);
}

// Only the inherited marks worth SHOWING (slice 4 places these in the world).
export function evidenceAt(led, rung) {
  return inheritedAt(led, rung).filter((m) => MARK_KINDS[m.k] && MARK_KINDS[m.k].evidence);
}

// THE DRAFT: the water everything above you displaces onto you. Clamped, always.
// Rung 1 inherits nothing and is therefore always the dry island — the surface is
// the one place in the stack where nobody is upstream of you.
export function draftAt(led, rung) {
  let d = 0;
  for (const m of inheritedAt(led, rung)) d += (MARK_KINDS[m.k] || { draft: 0 }).draft;
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
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.marks)) return out;

  const seen = new Set();
  for (const m of raw.marks) {
    if (!m || typeof m !== 'object') continue;
    if (!MARK_KINDS[m.k]) continue;                       // unknown/renamed kind
    const r = Number(m.r) | 0;
    if (!(r >= 1 && r <= 64)) continue;                   // absurd rung
    const h = typeof m.h === 'string' && m.h ? m.h.slice(0, 16) : null;
    if (!h) continue;

    // one mark per (hand, rung, kind), same rule as record()
    const key = h + '|' + r + '|' + m.k;
    if (seen.has(key)) continue;
    seen.add(key);

    let at = null;
    if (Array.isArray(m.at) && m.at.length === 3 && m.at.every((v) => Number.isFinite(+v))) {
      const cl = (v, b) => Math.max(-b, Math.min(b, +v));
      at = [cl(m.at[0], BOUND_XZ), cl(m.at[1], BOUND_Y), cl(m.at[2], BOUND_XZ)];
    }
    out.marks.push(makeMark(m.k, r, h, Number(m.n) | 0, at));
  }

  // cap every rung AFTER the merge, not per source
  for (const rung of new Set(out.marks.map((m) => m.r))) pruneRung(out, rung);
  return out;
}

// ---------------- payload -----------------------------------------------------

export function packLedger(led) {
  return { v: LEDGER_VERSION, marks: led.marks };
}

// Migrations get the save-schema treatment when there is a v2. Until then the
// version int exists so that day is additive rather than a wipe.
export function applyLedger(raw) {
  return sanitizeLedger(raw);
}

// ---------------- the source interface ----------------------------------------
//
// A SOURCE is where marks come from. The local one is your own history: the acts
// you performed on rung 1 are what rung 2 inherits, so the whole thesis is
// playable single-player with no server and no stranger. Slice 8 adds an HTTP
// source that fetches other hands' marks for a rung; NOTHING else changes,
// because every consumer reads through this interface.
//
//   load()            → a sanitized ledger (sync for local, a promise for HTTP)
//   push(mark)        → record it wherever this source keeps things
//
// `io` is the storage shim world.js passes in ({ get, set }) so this module stays
// free of localStorage and remains node-testable.
export function localSource(io) {
  let led = null;
  return {
    load() {
      if (led) return led;
      let raw = null;
      try { raw = JSON.parse(io.get(LEDGER_KEY) || 'null'); } catch (_) { raw = null; }
      led = applyLedger(raw);
      return led;
    },
    push(mark) {
      if (!mark) return;
      try { io.set(LEDGER_KEY, JSON.stringify(packLedger(led || emptyLedger()))); } catch (_) {
        /* private mode: the stack forgets, the island still works */
      }
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
