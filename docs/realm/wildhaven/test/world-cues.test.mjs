import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, villageNeeds } from '../js/sim.js';
import { BUILDINGS, JOBS, getBuildingSpec } from '../js/catalog.js';
import { residentCue, serviceReach } from '../js/world-cues.js';

const building = (id, type, x, z, extra = {}) => ({
  id, type, x, z, rotation: 0, status: 'ready', level: 1, paused: false,
  workerIds: [], production: { efficiency: 1, blockedReason: '' }, ...extra,
});
const home = (id, x, z, extra = {}) => building(id, 'cottage', x, z, { level: 3, ...extra });
function town(buildings) {
  const state = createGame();
  state.buildings = buildings;
  state.resources.food = 100;
  return state;
}
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
function actor(workplace, job, extra = {}) {
  return {
    citizen: { id: 'c1', name: 'Ada', workplace, job }, path: [], activity: 'work',
    root: { userData: { workState: 'working' } },
    parcel: { visible: false, userData: { cargo: 'cloth' } }, ...extra,
  };
}

test('existing service cues preserve canonical capacity, allocations, and home access in overlapping catchments', () => {
  const west = building('west-clinic', 'clinic', 0, 0, { production: { efficiency: 1 / 3 } });
  const east = building('east-clinic', 'clinic', 6, 0, { production: { efficiency: 1 / 3 } });
  const state = freeze(town([home('west-home', -3, 0), home('shared-home', 2, 0), home('east-home', 7, 0), home('edge-home', 11, 0), west, east]));
  const before = structuredClone(state), needs = villageNeeds(state);
  for (const clinic of [west, east]) {
    const cue = serviceReach(state, clinic.type, clinic, clinic.level);
    const provider = needs.services.health.providers.find(item => item.id === clinic.id);
    assert.equal(cue.isPreview, false);
    assert.equal(cue.capacity, provider.capacity);
    assert.equal(cue.allocatedBeds, provider.served);
    assert.equal(cue.nearbyBeds, provider.nearbyDemand);
    assert.ok(cue.nearbyBeds > cue.allocatedBeds, 'Geometric reach must remain distinct from scarce allocated service');
    for (const shown of cue.homes) {
      const canonical = needs.homes.find(item => item.id === shown.id);
      assert.deepEqual(shown.served, canonical.served);
      assert.deepEqual(shown.coverage, canonical.coverage);
      assert.equal(shown.inRange, Math.hypot(shown.x - clinic.x, shown.z - clinic.z) <= provider.radius);
    }
  }
  assert.deepEqual(state, before);
});

test('upgraded service cues report the canonical provider for every service kind', () => {
  for (const type of ['well', 'clinic', 'chapel', 'brewery', 'barracks', 'manor']) {
    const source = building('provider', type, 0, 0, { level: 2, production: { efficiency: .5 } });
    const state = freeze(town([home('near', 1, 0), home('far', 12, 0), source]));
    const service = getBuildingSpec(type, 2).service;
    const provider = villageNeeds(state).services[service.kind].providers.find(item => item.id === source.id);
    const cue = serviceReach(state, type, source, 2);
    assert.equal(cue.kind, service.kind, type);
    assert.equal(cue.radius, service.radius, type);
    assert.equal(cue.potentialCapacity, provider.potentialCapacity, type);
    assert.equal(cue.capacity, provider.capacity, type);
    assert.equal(cue.allocatedBeds, provider.served, type);
  }
});

test('paused and unfinished providers show zero actual capacity despite homes in reach', () => {
  for (const extra of [{ paused: true }, { status: 'building' }, { status: 'queued', constructionKind: 'upgrade' }]) {
    const source = building('closed-well', 'well', 0, 0, extra);
    const state = freeze(town([home('near', 1, 0), source]));
    const cue = serviceReach(state, 'well', source);
    const canonical = villageNeeds(state).services.water.providers[0];
    assert.equal(cue.isPreview, false);
    assert.equal(cue.inRangeHomes, 1);
    assert.equal(cue.capacity, canonical.capacity);
    assert.equal(cue.capacity, 0);
    assert.equal(cue.allocatedBeds, canonical.served);
    assert.equal(cue.allocatedBeds, 0);
    assert.equal(cue.potentialCapacity, 35);
  }
});

test('placement preview marks geometric reach without inventing service or changing the town', () => {
  const source = building('existing-well', 'well', 0, 0, { paused: true });
  const state = freeze(town([
    home('radius-edge', 0, 4), home('within-circle', 2, 3), home('outside-circle', 3, 3),
    home('upgrading-home', 0, 2, { level: 2, status: 'building', constructionKind: 'upgrade' }),
    home('unfinished-home', 1, 0, { status: 'building', constructionKind: 'new' }), source,
  ]));
  const before = structuredClone(state), preview = serviceReach(state, 'well', { x: 0, z: 0 });
  assert.equal(preview.isPreview, true, 'Coordinates alone must not select an existing provider');
  assert.equal(preview.allocatedBeds, null, 'A placement preview has no actual allocation');
  assert.equal(preview.capacity, getBuildingSpec('well').service.capacity);
  assert.equal(preview.inRangeHomes, 3);
  assert.equal(preview.outsideHomes, 1);
  assert.equal(preview.totalHomes, 4);
  assert.equal(preview.nearbyBeds, 27);
  assert.deepEqual(preview.homes.filter(item => item.inRange).map(item => item.id), ['radius-edge', 'within-circle', 'upgrading-home']);
  assert.ok(preview.homes.every(item => item.served.water === 0), 'Reach does not grant water to homes');
  assert.deepEqual(state, before);
  assert.equal(serviceReach(state, 'cottage', { x: 0, z: 0 }), null);
  assert.equal(serviceReach(state, 'well', null), null);
});

test('resident cues identify current work, named workplace, and cargo without changing actors or simulation', () => {
  for (const [type, job, action] of [['orchard', 'farmer', 'Picking fruit'], ['toolmaker', 'smith', 'Forging tools'], ['clinic', 'medic', 'Treating neighbors']]) {
    const state = freeze(town([building('workplace', type, 0, 0)]));
    const worker = freeze(actor('workplace', job));
    const beforeState = structuredClone(state), beforeActor = structuredClone(worker);
    const cue = residentCue(worker, state);
    assert.equal(cue.name, 'Ada');
    assert.equal(cue.job, JOBS[job].name);
    assert.equal(cue.workplace, BUILDINGS[type].name);
    assert.equal(cue.action, action);
    assert.equal(cue.paused, false);
    assert.deepEqual(worker, beforeActor);
    assert.deepEqual(state, beforeState);
  }
  const state = freeze(town([building('weaver', 'weaver', 0, 0)]));
  for (const [path, action] of [[[{ x: 1, z: 0 }], 'Carrying cloth'], [[], 'Delivering cloth']]) {
    const worker = freeze(actor('weaver', 'weaver', { path, activity: 'deliver', parcel: { visible: true, userData: { cargo: 'cloth' } } }));
    assert.equal(residentCue(worker, state).action, action, 'Visible cargo takes precedence over cached work state');
  }
});

test('pausing retains a resident cue and an idle neighbor remains available for work', () => {
  const state = freeze(town([building('workplace', 'orchard', 0, 0)]));
  const worker = freeze(actor('workplace', 'farmer'));
  const running = residentCue(worker, state), paused = residentCue(worker, state, true);
  assert.deepEqual(paused, { ...running, paused: true });
  const idle = freeze(actor(null, 'idle', { activity: 'rest', root: { userData: { workState: 'waiting' } } }));
  assert.equal(residentCue(idle, state, true).action, 'Available for work');
  assert.equal(residentCue(idle, state, true).workplace, null);
  assert.equal(residentCue(null, state), null);
});

test('current production blocks override stale work and entrance explanations', () => {
  for (const blockedReason of ['Needs cloth', 'Storage full', 'No workers available']) {
    const state = freeze(town([building('clinic', 'clinic', 0, 0, { production: { efficiency: 0, blockedReason } })]));
    for (const workState of ['working', 'waiting']) {
      const worker = freeze(actor('clinic', 'medic', {
        activity: 'waiting', root: { userData: { workState, workReason: 'The workplace needs a clear, connected approach.' } },
      }));
      const beforeState = structuredClone(state), beforeActor = structuredClone(worker);
      const cue = residentCue(worker, state, true);
      assert.equal(cue.action, blockedReason);
      assert.equal(cue.reason, blockedReason);
      assert.equal(cue.paused, true);
      assert.deepEqual(state, beforeState);
      assert.deepEqual(worker, beforeActor);
    }
  }
});

test('resident cues distinguish paused workplaces, blocked approaches, and active builders', () => {
  const paused = freeze(town([building('clinic', 'clinic', 0, 0, { paused: true })]));
  assert.equal(residentCue(freeze(actor('clinic', 'medic')), paused).action, 'Workplace paused');

  const ready = freeze(town([building('clinic', 'clinic', 0, 0)]));
  const waiting = freeze(actor('clinic', 'medic', {
    activity: 'waiting', root: { userData: { workState: 'waiting', workReason: 'The workplace needs a clear, connected approach.' } },
  }));
  assert.equal(residentCue(waiting, ready).action, 'Entrance blocked');

  const site = freeze(town([building('site', 'clinic', 0, 0, {
    status: 'building', production: { efficiency: 0, blockedReason: 'Under construction' },
  })]));
  const builder = freeze(actor('site', 'builder'));
  assert.equal(residentCue(builder, site).action, 'Building', 'A construction site is active work for its builder');
});
