// saves.spec.mjs — the one current save contract.
import { applySave, packSave, SAVE_VERSION, SAVE_KEY, SAVE_FLAG_DEFAULTS, SAVE_FIELDS } from '../../js/save-schema.js';

let pass = 0;
const fails = [];
const ok = (name, cond) => (cond ? pass++ : fails.push(name));
const freshW = () => ({
  time: 7.4, tide: 1, tideTarget: 1, lensPlaced: false, beamAngle: 2.2,
  disposition: 'tend',
  flags: {
    introDone: false, dove: false, returned: false, hatchCodeDecoded: false, hatchOpen: false,
    upstreamHandSurged: false, upstreamHandWitnessed: false, registerRead: false, lowerHandRegarded: false,
    dispositionChosen: false, endingCommitted: false,
  },
  stems: 0, inventory: [], recDisp: {},
  notebook: { entries: [], hintLevels: {} }, onceKeys: [],
  dials: [0, 0, 0, 0], playerPos: null, playerLook: null, level: 1,
  regions: { l2seen: false, l3seen: false, l4seen: false },
});

ok('current contract is payload v2', SAVE_VERSION === 2);
ok('there is one canonical storage key', SAVE_KEY === 'abyme-save');
ok('unversioned data rejected', applySave(freshW(), { flags: {} }) === false);
ok('wrong payload version rejected', applySave(freshW(), { v: 3, journal: [] }) === false);
ok('previous development payload rejected', applySave(freshW(), { v: 1, flags: {} }) === false);

const original = freshW();
original.time = 17.6;
original.tideTarget = 1.65;
original.lensPlaced = true;
original.disposition = 'open';
original.flags.hatchCodeDecoded = true;
original.flags.hatchOpen = true;
original.flags.upstreamHandSurged = true;
original.flags.upstreamHandWitnessed = true;
original.flags.registerRead = true;
original.flags.lowerHandRegarded = true;
original.flags.dispositionChosen = true;
original.notebook.entries = [
  { id: 'evidence.beam-glyphs', args: { glyphs: [1, 5, 3, 4] } },
  { id: 'artifact.signal-shelf.surface' },
];
original.notebook.hintLevels = { 'signal-hatch': 2 };
original.dials = [5, 1, 4, 6];
original.level = 4;
original.regions = { l2seen: true, l3seen: true, l4seen: true };

const packed = JSON.parse(JSON.stringify(packSave(original, {
  pos: { x: 1, y: 2, z: 3 }, yaw: 0.5, pitch: -0.1,
})));
ok('pack stamps the current contract', packed.v === 2);
ok('payload contains every declared field', Object.keys(packed).filter((k) => k !== 'v')
  .every((key) => SAVE_FIELDS.some((field) => field.key === key)));
ok('payload contains exactly the current flag shape',
  JSON.stringify(Object.keys(packed.flags)) === JSON.stringify(Object.keys(SAVE_FLAG_DEFAULTS)));
ok('payload omits rendered journal prose', !('journal' in packed));
ok('payload omits lore read keys', !('readKeys' in packed));
ok('regions omit fragment bookkeeping', !('fragmentsFound' in packed.regions));

const restored = freshW();
ok('current payload applies', applySave(restored, packed) === true);
ok('notebook ids and args survive', JSON.stringify(restored.notebook.entries) === JSON.stringify(original.notebook.entries));
ok('requested hint tier survives', restored.notebook.hintLevels['signal-hatch'] === 2);
ok('one solved hatch state survives', restored.flags.hatchCodeDecoded && restored.flags.hatchOpen
  && JSON.stringify(restored.dials) === '[5,1,4,6]');
ok('new progression flags survive', restored.flags.upstreamHandSurged
  && restored.flags.lowerHandRegarded && restored.flags.dispositionChosen);
ok('disposition survives', restored.disposition === 'open');
ok('position and view survive', JSON.stringify(restored.playerPos) === '[1,2,3]' && JSON.stringify(restored.playerLook) === '[0.5,-0.1]');

const malformed = freshW();
applySave(malformed, {
  v: 2,
  flags: { introDone: true, valveTurned: 'yes', retiredFlag: true },
  inventory: ['lens', 'lens', 'retired-item', 'phial'],
  recDisp: { field_slip: 'kept', closure_notice: 'burned', retired_record: 'carried' },
  notebook: { entries: [{ id: 'evidence.valve' }, { id: 'evidence.valve' }, null] },
  dials: [3, 99, -1, 5],
});
ok('duplicate note ids normalize', JSON.stringify(malformed.notebook.entries) === '[{"id":"evidence.valve"}]');
ok('bad numerals normalize independently', JSON.stringify(malformed.dials) === '[3,0,0,5]');
ok('flags accept only current boolean fields', malformed.flags.introDone === true
  && malformed.flags.valveTurned === false && !('retiredFlag' in malformed.flags));
ok('inventory accepts only current unique ids', JSON.stringify(malformed.inventory) === '["lens","phial"]');
ok('record dispositions accept only current ids and states',
  JSON.stringify(malformed.recDisp) === '{"field_slip":"kept"}');

const polluted = freshW();
polluted.flags.retiredFlag = true;
polluted.inventory = ['plumb', 'retired-item', 'plumb'];
polluted.recDisp = { transfer_offer: 'filed', mystery: 'carried' };
const cleaned = packSave(polluted);
ok('packing strips state outside the current contract', !('retiredFlag' in cleaned.flags)
  && JSON.stringify(cleaned.inventory) === '["plumb"]'
  && JSON.stringify(cleaned.recDisp) === '{"transfer_offer":"filed"}');

console.log(`SAVES ${pass} / ${pass + fails.length}`);
if (fails.length) { console.log('FAILURES:', JSON.stringify(fails)); process.exit(1); }
