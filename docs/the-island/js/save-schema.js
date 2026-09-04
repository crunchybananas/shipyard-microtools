// save-schema.js — the save contract for the current game.
//
// The Island is still in development. This module describes one current contract;
// `v` asserts that exact shape rather than representing a history of past designs.

import { normalizeNotebook } from './notebook-schema.js';
import { SIGNAL_HATCH_CODE } from './content.js';

export const SAVE_VERSION = 2;
export const SAVE_KEY = 'abyme-save';

// This is the authoritative persisted flag shape. WorldState starts from the same
// object, so adding a flag requires one contract change rather than parallel lists.
export const SAVE_FLAG_DEFAULTS = Object.freeze({
  introDone: false,
  enteredStudy: false,
  refugeLit: false,
  receiverReturned: false,
  valveTurned: false,
  crankUsed: false,
  rulerTaken: false,
  rulerPlaced: false,
  chestOpen: false,
  heardBox: false,
  heardBird: false,
  birdSolved: false,
  lensTaken: false,
  shadowRevealed: false,
  glyphsSeen: false,
  hatchCodeDecoded: false,
  hatchOpen: false,
  plumbTaken: false,
  plumbHung: false,
  dove: false,
  climbing: false,
  returned: false,
  upstreamHandSurged: false,
  upstreamHandWitnessed: false,
  registerRead: false,
  lowerHandRegarded: false,
  dispositionChosen: false,
  endingCommitted: false,
  readGlass: false,
  phialTaken: false,
  phialDried: false,
  keeperSong: false,
  tideFigureSeen: false,
  watcherSeen: false,
  beamDeepSeen: false,
  beamFarewell: false,
  roundMoor: false,
  roundLog: false,
  roundLight: false,
  roundWind: false,
});

const INVENTORY_IDS = new Set(['ruler', 'lens', 'plumb', 'readglass', 'phial']);
const RECORD_IDS = new Set([
  'drain_ledger',
  'commendation_copy',
  'closure_notice',
  'field_slip',
  'transfer_offer',
]);
const RECORD_DISPOSITIONS = new Set(['carried', 'filed', 'kept']);
const ENDING_KINDS = new Set(['tend', 'carry', 'open', 'close']);

const cleanDisposition = (value) => ENDING_KINDS.has(value) ? value : 'tend';

const cleanFlags = (value) => {
  const src = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return Object.fromEntries(Object.keys(SAVE_FLAG_DEFAULTS).map((key) => [
    key,
    typeof src[key] === 'boolean' ? src[key] : false,
  ]));
};

const cleanInventory = (value) => [...new Set(
  (Array.isArray(value) ? value : []).filter((id) => INVENTORY_IDS.has(id)),
)];

const cleanRecordDispositions = (value) => {
  const src = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const out = {};
  for (const id of RECORD_IDS) {
    if (RECORD_DISPOSITIONS.has(src[id])) out[id] = src[id];
  }
  return out;
};

const cleanEndingOutcome = (value) => {
  if (!value || typeof value !== 'object' || !ENDING_KINDS.has(value.kind)) return null;
  if (value.kind !== 'carry') return { kind: value.kind };
  const removed = Number.isInteger(value.removed) && value.removed >= 0 ? value.removed : 0;
  return { kind: 'carry', removed };
};

const cleanDials = (value) => Array.isArray(value) && value.length === 4
  ? value.map((n) => Number.isInteger(n) && n >= 0 && n <= 9 ? n : 0)
  : [0, 0, 0, 0];

export const SAVE_FIELDS = [
  { key: 'disposition', pack: (W) => W.disposition,
    apply: (W, v) => { W.disposition = cleanDisposition(v); } },
  { key: 'endingOutcome', pack: (W) => cleanEndingOutcome(W.endingOutcome),
    apply: (W, v) => { W.endingOutcome = cleanEndingOutcome(v); } },
  { key: 'time', pack: (W) => W.time,
    apply: (W, v) => { if (Number.isFinite(v)) W.time = v; } },
  { key: 'tide', pack: (W) => W.tideTarget,
    apply: (W, v) => { W.tide = W.tideTarget = Number.isFinite(v) ? v : 1; } },
  { key: 'lensPlaced', pack: (W) => W.lensPlaced,
    apply: (W, v) => { W.lensPlaced = !!v; } },
  { key: 'beamAngle', pack: (W) => W.beamAngle,
    apply: (W, v) => { if (Number.isFinite(v)) W.beamAngle = v; } },
  { key: 'flags', pack: (W) => cleanFlags(W.flags),
    apply: (W, v) => { W.flags = cleanFlags(v); } },
  { key: 'stems', pack: (W) => W.stems,
    apply: (W, v) => { W.stems = Number.isInteger(v) ? Math.max(0, Math.min(6, v)) : 0; } },
  { key: 'inventory', pack: (W) => cleanInventory(W.inventory),
    apply: (W, v) => { W.inventory = cleanInventory(v); } },
  { key: 'notebook', pack: (W) => normalizeNotebook(W.notebook),
    apply: (W, v) => { W.notebook = normalizeNotebook(v); } },
  { key: 'level', pack: (W) => W.level,
    apply: (W, v) => { W.level = Number.isInteger(v) ? Math.max(1, Math.min(4, v)) : 1; } },
  { key: 'onceKeys', pack: (W) => W.onceKeys,
    apply: (W, v) => { W.onceKeys = Array.isArray(v) ? [...new Set(v.filter((id) => typeof id === 'string'))] : []; } },
  { key: 'recDisp', pack: (W) => cleanRecordDispositions(W.recDisp),
    apply: (W, v) => { W.recDisp = cleanRecordDispositions(v); } },
  { key: 'dials', pack: (W) => cleanDials(W.dials),
    apply: (W, v) => { W.dials = cleanDials(v); } },
  { key: 'regions', pack: (W) => W.regions,
    apply: (W, v) => {
      const src = v && typeof v === 'object' ? v : {};
      W.regions = { l2seen: !!src.l2seen, l3seen: !!src.l3seen, l4seen: !!src.l4seen };
    } },
  { key: 'pos',
    pack: (_W, ctx) => ctx?.pos ? [ctx.pos.x, ctx.pos.y, ctx.pos.z] : null,
    apply: (W, v) => { W.playerPos = Array.isArray(v) && v.length === 3 && v.every(Number.isFinite) ? v : null; } },
  { key: 'look',
    pack: (_W, ctx) => Number.isFinite(ctx?.yaw) ? [ctx.yaw, Number.isFinite(ctx.pitch) ? ctx.pitch : 0] : null,
    apply: (W, v) => { W.playerLook = Array.isArray(v) && v.length === 2 && v.every(Number.isFinite) ? v : null; } },
];

// A committed ending is one fact, not three loosely related fields. Never invent a
// missing outcome (CARRY's removed count cannot be reconstructed): an incomplete or
// contradictory unit is simply uncommitted current state.
const reconcileEnding = (state) => {
  state.disposition = cleanDisposition(state.disposition);
  const outcome = cleanEndingOutcome(state.endingOutcome);
  const committed = state.flags?.endingCommitted === true;
  if (!committed || !outcome || outcome.kind !== state.disposition) {
    if (state.flags) state.flags.endingCommitted = false;
    state.endingOutcome = null;
    return;
  }
  state.endingOutcome = outcome;
};

// The four wheels and the open hatch are one mechanical fact. A payload can only
// preserve the solved state when both flags were committed with the exact dial
// setting; malformed half-states collapse closed rather than inventing a solve.
const reconcileHatch = (state) => {
  if (!state.flags) return;
  const exact = Array.isArray(state.dials)
    && state.dials.length === SIGNAL_HATCH_CODE.length
    && state.dials.every((value, index) => value === SIGNAL_HATCH_CODE[index]);
  const solved = exact
    && state.flags.hatchCodeDecoded === true
    && state.flags.hatchOpen === true;
  state.flags.hatchCodeDecoded = solved;
  state.flags.hatchOpen = solved;
};

export const isCurrentSavePayload = (payload) => !!payload
  && typeof payload === 'object'
  && !Array.isArray(payload)
  && payload.v === SAVE_VERSION;

const sameData = (a, b) => {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length
      && a.every((value, index) => sameData(value, b[index]));
  }
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  return aKeys.length === bKeys.length
    && aKeys.every((key) => Object.hasOwn(b, key) && sameData(a[key], b[key]));
};

const isJsonData = (value) => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonData);
  return !!value && typeof value === 'object'
    && Object.values(value).every(isJsonData);
};

export function packSave(W, player) {
  const out = { v: SAVE_VERSION };
  for (const field of SAVE_FIELDS) out[field.key] = field.pack(W, player || null);
  reconcileHatch(out);
  reconcileEnding(out);
  return out;
}

// Field reports promise exact replay, so they accept only the canonical output of
// packSave—not merely something the forgiving load boundary could normalize.
export function isPackedSavePayload(payload) {
  if (!isCurrentSavePayload(payload) || !isJsonData(payload)) return false;
  const staged = {};
  for (const field of SAVE_FIELDS) field.apply(staged, payload[field.key]);
  reconcileHatch(staged);
  reconcileEnding(staged);
  const context = {
    pos: staged.playerPos
      ? { x: staged.playerPos[0], y: staged.playerPos[1], z: staged.playerPos[2] }
      : null,
    yaw: staged.playerLook?.[0],
    pitch: staged.playerLook?.[1],
  };
  return sameData(payload, packSave(staged, context));
}

export function applySave(W, payload) {
  if (!isCurrentSavePayload(payload)) return false;
  for (const field of SAVE_FIELDS) field.apply(W, payload[field.key]);
  reconcileHatch(W);
  reconcileEnding(W);
  return true;
}
