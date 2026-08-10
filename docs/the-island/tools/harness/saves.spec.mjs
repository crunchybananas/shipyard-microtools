// saves.spec.mjs (#140, AAA-C2) — the save schema's contract, testable in bare node
// because save-schema.js is deliberately dependency-free. Covers: every migration
// step, a REAL captured full-progress v3 fixture, forward/unknown fields, corrupt
// payloads, and the pack→apply round trip. world.js's storage boundary (the corrupt
// stash, the fresh-start path) is exercised browser-side by walk.mjs's restore
// branch + verify140 — this spec owns the pure layer.
import { readFileSync } from 'node:fs';
import { migrateSave, applySave, packSave, SAVE_VERSION, SAVE_FIELDS } from '../../js/save-schema.js';

const FIX = new URL('./fixtures/', import.meta.url).pathname;
let pass = 0;
const fails = [];
const ok = (name, cond) => (cond ? pass++ : fails.push(name));

// a minimal W with the schema-relevant default shapes (the contract surface —
// apply() merges flags/recDisp INTO these, everything else lands whole)
const freshW = () => ({
  time: 7.4, tide: 1, tideTarget: 1, lensPlaced: false, beamAngle: 2.2,
  flags: { introDone: false, chestOpen: false, rulerTaken: false, carried: false },
  stems: 0, inventory: [], recDisp: {}, journal: [], onceKeys: [], readKeys: [],
  dials: [0, 0, 0, 0], playerPos: null, playerLook: null, level: 1,
  regions: { l2seen: false, l3seen: false, l4seen: false, fragmentsFound: [] },
});

// ---- migration steps -----------------------------------------------------------
// v1: no version int, ruler taken but chestOpen never persisted → inferred true
const v1 = { flags: { rulerTaken: true }, level: 2, stems: 2 };
const m1 = migrateSave(JSON.parse(JSON.stringify(v1)));
ok('v1→ chestOpen inferred', m1.flags.chestOpen === true);
ok('v1→ data carried', m1.level === 2 && m1.stems === 2);

// a v1 save WITHOUT the ruler must not gain the chest
ok('v1 no-ruler untouched', migrateSave({ flags: {} }).flags.chestOpen === undefined);

// v2: full flags always written; contiguous chain to current
const v2 = { v: 2, flags: { rulerTaken: true, chestOpen: false }, level: 3 };
ok('v2 flags respected (no re-inference)', migrateSave(v2).flags.chestOpen === false);

// ---- the real thing: a captured full-progress v3 payload ------------------------
const full = JSON.parse(readFileSync(FIX + 'v3-full.json', 'utf8'));
ok('fixture is current version', full.v === SAVE_VERSION);
{
  const W = freshW();
  applySave(W, JSON.parse(JSON.stringify(full)));
  ok('full: deep progress lands', W.level >= 1 && W.flags.returned === true);
  // the canonical fixture is the walk's end-state: the P9 bell branch restores the
  // pre-Wind snapshot, so three rounds are true and Wind is legitimately absent
  ok('full: rounds persisted', W.flags.roundMoor === true && W.flags.roundLight === true);
  ok('full: record dispositions persisted', W.recDisp.commendation_copy === 'filed' && W.recDisp.closure_notice === 'kept');
  ok('full: journal survives', Array.isArray(W.journal) && W.journal.length > 20);
  ok('full: once-keys survive', W.onceKeys.includes('eraThreshold'));
}

// ---- forward-compat + partials --------------------------------------------------
{
  const W = freshW();
  applySave(W, { v: SAVE_VERSION, futureField: { anything: true }, flags: { introDone: true } });
  ok('unknown future field ignored', !('futureField' in W));
  ok('partial payload: defaults hold', W.level === 1 && W.stems === 0 && W.flags.carried === false);
  ok('partial payload: given fields land', W.flags.introDone === true);
}

// ---- corrupt payloads must not throw and must leave defaults --------------------
for (const [name, junk] of [['null', null], ['number', 17], ['string', 'junk'], ['array', [1, 2]], ['empty', {}]]) {
  const W = freshW();
  let threw = false;
  try { applySave(W, junk); } catch (_) { threw = true; }
  ok(`corrupt ${name}: no throw + defaults`, !threw && W.level === 1 && W.flags.introDone === false);
}

// ---- round trip -----------------------------------------------------------------
{
  const W = freshW();
  applySave(W, JSON.parse(JSON.stringify(full)));
  const packed = packSave(W, { pos: { x: 1, y: 2, z: 3 }, yaw: 0.5, pitch: -0.1 });
  const W2 = freshW();
  applySave(W2, JSON.parse(JSON.stringify(packed)));
  ok('round trip: version stamped', packed.v === SAVE_VERSION);
  ok('round trip: flags stable', JSON.stringify(W2.flags) === JSON.stringify(W.flags));
  ok('round trip: recDisp stable', JSON.stringify(W2.recDisp) === JSON.stringify(W.recDisp));
  ok('round trip: journal length stable', W2.journal.length === W.journal.length);
}

ok('field table covers the fixture', Object.keys(full).filter((k) => k !== 'v')
  .every((k) => SAVE_FIELDS.some((f) => f.key === k)));

console.log(`SAVES ${pass} / ${pass + fails.length}`);
if (fails.length) { console.log('FAILURES:', JSON.stringify(fails)); process.exit(1); }
