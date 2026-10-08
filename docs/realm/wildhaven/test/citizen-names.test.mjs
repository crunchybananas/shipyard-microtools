import test from 'node:test';
import assert from 'node:assert/strict';
import { GIVEN_NAMES, FAMILY_NAMES, newCitizenName } from '../js/citizen-names.js';
import { createGame, build, tick, DAY_LENGTH, serialize, restore, setBuilderTarget } from '../js/sim.js';

const identity = person => [person.id, person.name, person.arrivalDay];
const key = name => name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();

test('the broad name pool has unique, save-safe names and a varied opening town', () => {
  assert.ok(GIVEN_NAMES.length >= 190);
  assert.ok(FAMILY_NAMES.length >= 60);
  for (const pool of [GIVEN_NAMES, FAMILY_NAMES]) {
    assert.equal(new Set(pool.map(key)).size, pool.length);
    for (const name of pool) assert.ok(name.length < 30 && !/[<>\d\x00-\x1f]/.test(name), name);
  }
  assert.deepEqual(createGame().citizens.map(person => person.name), ['Ada', 'Amina', 'Arun', 'Beatriz', 'Chen', 'Dalia']);
});

test('one thousand residents receive distinct names without numeric suffixes', () => {
  const names = new Set();
  for (let id = 1; id <= 1000; id++) {
    const name = newCitizenName(id, names);
    assert.ok(!names.has(name));
    assert.ok(name.length <= 60 && !/\d/.test(name), name);
    names.add(name);
  }
  assert.equal(names.size, 1000);
  assert.equal([...names].slice(0, GIVEN_NAMES.length).filter(name => name.includes(' ')).length, 0);
  assert.ok([...names].slice(GIVEN_NAMES.length).every(name => name.includes(' ')), 'Family names replace numbered copies when given names run out');
});

test('new names skip existing names with case, whitespace and Unicode-equivalent spelling', () => {
  assert.equal(newCitizenName(1, ['  ADA  ', 'AMINA', 'Arun']), 'Beatriz');
  const accent = GIVEN_NAMES.indexOf('Céline');
  assert.equal(newCitizenName(accent + 1, ['Ce\u0301line']), GIVEN_NAMES[accent + 1]);
  const occupied = ['ADA   ALDEN', 'AMINA ALDEN'];
  assert.equal(newCitizenName(GIVEN_NAMES.length + 1, occupied), 'Arun Alden');
});

test('large arrival IDs wrap deterministically and search the full name pool before exhaustion', () => {
  const all = [...GIVEN_NAMES, ...FAMILY_NAMES.flatMap(family => GIVEN_NAMES.map(given => `${given} ${family}`))];
  const last = all.pop();
  assert.equal(newCitizenName(1, all), last);
  assert.equal(newCitizenName(9999999, all), last);
  assert.equal(newCitizenName(9999999), newCitizenName((9999999 - 1) % (all.length + 1) + 1));
  assert.throws(() => newCitizenName(1, [...all, last]), RangeError);
});

test('actual arrivals and replenishment avoid legacy residents and each other across reload', () => {
  let state = createGame();
  state.citizens[0].name = 'Emeka';
  state.citizens[1].name = ' FARAH ';
  const originals = state.citizens.map(identity);
  const site = build(state, 'cottage', -2, 2);
  assert.equal(site.ok, true, site.reason);
  tick(state, DAY_LENGTH);
  assert.equal(state.population, 8);
  assert.deepEqual(state.citizens.slice(0, 6).map(identity), originals);
  assert.deepEqual(state.citizens.slice(6).map(person => person.name), ['Gabriel', 'Hana']);

  // A departed resident frees a bed; existing IDs, names and arrival dates remain.
  state.citizens = state.citizens.filter(person => person.id !== 'c3');
  state.population = state.citizens.length;
  setBuilderTarget(state, 2);
  const survivors = state.citizens.map(identity);
  state = restore(serialize(state));
  assert.ok(state);
  tick(state, DAY_LENGTH);
  assert.equal(state.population, 9);
  assert.deepEqual(state.citizens.slice(0, survivors.length).map(identity), survivors);
  assert.deepEqual(state.citizens.slice(survivors.length).map(person => person.name), ['Idris', 'Jun']);
  assert.equal(new Set(state.citizens.map(person => key(person.name))).size, state.population);
  const loaded = restore(serialize(state));
  assert.deepEqual(loaded.citizens.map(identity), state.citizens.map(identity));
});

test('current saves preserve numbered, duplicate and Unicode resident identities exactly', () => {
  const state = createGame();
  ['Ada 2', 'Renée', '李明', 'A\u0301lvaro', 'Amina', 'Amina'].forEach((name, i) => { state.citizens[i].name = name; });
  state.citizens[0].experience.builder = 160;
  const raw = serialize(state), loaded = restore(raw);
  assert.ok(loaded);
  assert.deepEqual(loaded.citizens.map(identity), state.citizens.map(identity));
  assert.deepEqual(loaded.citizens.map(person => person.experience), state.citizens.map(person => person.experience));
  assert.equal(serialize(state), raw, 'Restoring does not rewrite the source town');
});

test('v1 migration keeps its established identity assignment', () => {
  const state = createGame();
  const legacy = { version: 1, resources: { wood: 100, stone: 70, food: 65 }, population: 6, day: 1, time: 0, elapsed: 0, won: false, buildings: state.buildings };
  const loaded = restore(legacy);
  assert.ok(loaded);
  assert.deepEqual(loaded.citizens.map(person => person.name), ['Ada', 'Bram', 'Cora', 'Dev', 'Elin', 'Finn']);
  assert.deepEqual(loaded.citizens.map(person => person.id), state.citizens.map(person => person.id));
});
