import test from 'node:test';
import assert from 'node:assert/strict';
import { companySoldiers, createCompanySelection } from '../js/frontier-ui.js';

const soldier = (id, extras = {}) => ({ id, faction: 'player', kind: 'spearman', citizenId: `resident-${id}`, status: 'active', order: { type: 'hold' }, ...extras });
function fixture() {
  const units = [soldier('a'), soldier('b', { kind: 'archer' }), soldier('training', { status: 'training' }), soldier('wounded', { status: 'wounded' }), soldier('enemy', { faction: 'raiders', citizenId: null }), soldier('ally', { citizenId: null, allyFrom: 'reedbank' }), soldier('engineer', { kind: 'engineer' }), soldier('dead', { status: 'dead' }), soldier('released', { status: 'released' })];
  return { units, selection: createCompanySelection(() => units) };
}

test('company selection includes living resident soldiers, never town workers, allies or enemies', () => {
  const { units, selection } = fixture();
  assert.deepEqual(companySoldiers(units).map(unit => unit.id), ['a', 'b', 'training', 'wounded']);
  selection.replace(units.map(unit => unit.id));
  assert.deepEqual(selection.ids, ['a', 'b', 'training', 'wounded']);
  for (const id of ['enemy', 'ally', 'engineer', 'dead', 'released', 'empty-ground']) assert.equal(selection.toggle(id), false);
  assert.deepEqual(selection.ids, ['a', 'b', 'training', 'wounded']);
});

test('ordinary selection replaces, additive selection toggles, and no selection operation issues orders', () => {
  const { units, selection } = fixture(), before = JSON.stringify(units);
  selection.toggle('a', false); selection.toggle('b', true); assert.deepEqual(selection.ids, ['a', 'b']);
  selection.toggle('a', true); assert.deepEqual(selection.ids, ['b']);
  selection.toggle('training', false); assert.deepEqual(selection.ids, ['training']);
  assert.equal(JSON.stringify(units), before);
});

test('Cancel restores the pre-mode selection while Done commits only the selected IDs', () => {
  const { units, selection } = fixture(), before = JSON.stringify(units);
  selection.replace(['a']); selection.begin(); assert.equal(selection.active, true);
  selection.toggle('a'); selection.toggle('b'); assert.deepEqual(selection.ids, ['b']);
  assert.equal(selection.cancel(), true); assert.equal(selection.active, false); assert.deepEqual(selection.ids, ['a']);
  selection.begin(); selection.toggle('b'); assert.deepEqual(selection.finish(), ['a', 'b']);
  assert.equal(selection.active, false); assert.equal(selection.cancel(), false); assert.deepEqual(selection.ids, ['a', 'b']);
  assert.equal(JSON.stringify(units), before);
});

test('Cancel cannot resurrect members who died or left during group selection', () => {
  const { units, selection } = fixture();
  selection.replace(['a', 'b', 'training']); selection.begin(); selection.clear(); selection.toggle('wounded');
  units.find(unit => unit.id === 'a').status = 'dead'; units.find(unit => unit.id === 'b').status = 'released';
  selection.cancel(); assert.deepEqual(selection.ids, ['training']);
});

test('live pruning and repeated begin preserve a valid cancellation boundary', () => {
  const { units, selection } = fixture();
  selection.replace(['a']); selection.begin(); selection.toggle('b'); selection.begin();
  selection.cancel(); assert.deepEqual(selection.ids, ['a']);
  units.find(unit => unit.id === 'a').status = 'dead'; assert.deepEqual(selection.ids, []);
  selection.begin(); selection.replace(['training', 'wounded']); selection.cancel(); assert.deepEqual(selection.ids, []);
});

test('a town replacement resets both selection and its pending cancellation snapshot', () => {
  const { units, selection } = fixture();
  selection.replace(['a']); selection.begin(); selection.toggle('b');
  units.splice(0, units.length, soldier('a', { citizenId: 'other-town-resident' }), soldier('b'));
  selection.reset(); assert.equal(selection.active, false); assert.deepEqual(selection.ids, []);
  assert.equal(selection.cancel(), false); assert.deepEqual(selection.ids, [], 'Reused IDs in a new town cannot recover an old selection');
  selection.toggle('a'); assert.deepEqual(selection.ids, ['a'], 'The new town can start its own independent selection');
});
