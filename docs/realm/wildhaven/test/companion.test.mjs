import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../js/sim.js';
import { sendFieldworker } from '../js/frontier.js';
import { HOME_SAVE_KEY, COMPANION_SAVE_KEY, createCompanionStore } from '../js/companion-store.js';

class MemoryStorage {
  constructor(entries = []) {
    this.data = new Map(entries);
    this.writes = [];
    this.failReads = new Set();
    this.failWrites = new Set();
  }
  getItem(key) {
    if (this.failReads.has(key)) throw new Error('Storage access denied');
    return this.data.get(key) ?? null;
  }
  setItem(key, value) {
    if (this.failWrites.has(key)) throw new Error('Quota exceeded');
    this.data.set(key, String(value));
    this.writes.push({ key, value: String(value) });
  }
  removeItem(key) { this.data.delete(key); }
}

class FakeLocks {
  constructor({ paused = false } = {}) {
    this.paused = paused;
    this.held = new Set();
    this.requests = [];
    this.pending = [];
  }
  request(name, options, callback) {
    const entry = { name, options };
    this.requests.push(entry);
    entry.finished = (async () => {
      await Promise.resolve();
      if (this.paused) await new Promise(resolve => this.pending.push(resolve));
      const lock = this.held.has(name) ? null : { name, mode: options.mode || 'exclusive' };
      if (lock) this.held.add(name);
      else assert.equal(options.ifAvailable, true, 'Competing tabs must receive a denied lease promptly');
      try { return await callback(lock); }
      finally { if (lock) this.held.delete(name); }
    })();
    return entry.finished;
  }
  allowPending() {
    this.paused = false;
    for (const resolve of this.pending.splice(0)) resolve();
  }
}

const ok = result => { assert.equal(result.ok, true, result.reason); return result; };
const records = storage => [...storage.data.entries()];
function durable(state) {
  const saved = JSON.parse(sim.serialize(state));
  return Object.fromEntries(['resources', 'citizens', 'buildings', 'discovery', 'frontier', 'research', 'pressure', 'events', 'nextEventId', 'day', 'time', 'elapsed', 'subsecond', 'builderTarget', 'population', 'stats'].map(key => [key, saved[key]]));
}
function busyTown() {
  const state = sim.createGame();
  ok(sim.build(state, 'cottage', -2, 2, 0));
  ok(sim.build(state, 'garden', 2, 0, 0));
  ok(sendFieldworker(state, 'waystone', 'survey', 'c2', sim.frontierContext(state)));
  sim.refreshTown(state);
  sim.tick(state, 3.5);
  assert.ok(sim.restore(sim.serialize(state)), 'The test fixture is a valid mid-project save');
  return state;
}
function opened(state = sim.createGame()) {
  const raw = sim.serialize(state);
  const storage = new MemoryStorage([[HOME_SAVE_KEY, raw]]);
  const store = createCompanionStore({ storage });
  const home = store.loadHome();
  assert.ok(home);
  return { storage, store, home, raw };
}
function paired(state = sim.createGame()) {
  const setup = opened(state);
  ok(setup.store.create({ homeName: 'Wildhaven', companionName: 'Foxglove' }, setup.home));
  const homeId = setup.store.activeId;
  const companionId = setup.store.info().towns.find(town => town.id !== homeId)?.id;
  assert.ok(companionId, 'Creation supplies a distinct companion town');
  return { ...setup, homeId, companionId };
}
function offerFromHome(setup, give = { wood: 10 }, request = { stone: 5 }) {
  const proposal = ok(setup.store.proposeOffer({ give, request }, setup.home));
  assert.ok(proposal.offerId);
  const recipient = ok(setup.store.switchTown(setup.companionId, setup.home)).state;
  assert.ok(recipient);
  return { offerId: proposal.offerId, recipient };
}

test('the companion store opens the existing v4 home without opting in or writing storage', () => {
  assert.equal(HOME_SAVE_KEY, 'wildhaven.v4');
  assert.equal(COMPANION_SAVE_KEY, 'wildhaven.companions.v1');
  const { storage, store, home, raw } = opened(busyTown());
  assert.equal(store.info().enabled, false);
  assert.equal(storage.getItem(HOME_SAVE_KEY), raw);
  assert.equal(storage.getItem(COMPANION_SAVE_KEY), null);
  assert.deepEqual(storage.writes, []);
  assert.deepEqual(durable(home), durable(sim.restore(raw)));
});

test('companion switches and autosaves keep the original home snapshot in wildhaven.v4', () => {
  const { storage, store, home, homeId, companionId } = paired(busyTown());
  const original = storage.getItem(HOME_SAVE_KEY);
  const homeBefore = durable(home);
  let companion = ok(store.switchTown(companionId, home)).state;
  assert.equal(companion.population, 6);
  assert.equal(companion.frontier.units.length, 0);
  assert.equal(sim.constructionQueue(companion).length, 0);
  sim.tick(companion, 7.5);
  companion.resources.wood -= 9;
  ok(store.save(companion));
  assert.equal(storage.getItem(HOME_SAVE_KEY), original, 'A companion autosave must never replace the home save');
  const returned = ok(store.switchTown(homeId, companion)).state;
  assert.deepEqual(durable(returned), homeBefore);
  assert.equal(storage.getItem(HOME_SAVE_KEY), original);
  companion = ok(store.switchTown(companionId, returned)).state;
  assert.equal(companion.elapsed, 7.5);
  assert.notEqual(companion.resources.wood, home.resources.wood);
  assert.equal(storage.getItem(HOME_SAVE_KEY), original);
});

test('both town snapshots retain fieldwork, queue escrow, citizen identities, and fractional time across reload', () => {
  const setup = paired(busyTown());
  const { storage, store, home, homeId, companionId } = setup;
  let companion = ok(store.switchTown(companionId, home)).state;
  ok(sim.build(companion, 'cottage', -2, 2, 0));
  ok(sendFieldworker(companion, 'spring', 'survey', 'c4', sim.frontierContext(companion)));
  sim.refreshTown(companion);
  sim.tick(companion, 4.25);
  const homeBefore = durable(home), companionBefore = durable(companion);
  ok(store.save(companion));
  const reloaded = createCompanionStore({ storage });
  const homeAgain = reloaded.loadHome();
  assert.deepEqual(durable(homeAgain), homeBefore);
  companion = ok(reloaded.switchTown(companionId, homeAgain)).state;
  assert.deepEqual(durable(companion), companionBefore);
  const back = ok(reloaded.switchTown(homeId, companion)).state;
  assert.deepEqual(durable(back), homeBefore);
  assert.deepEqual(back.citizens.map(person => [person.id, person.name, person.experience]), home.citizens.map(person => [person.id, person.name, person.experience]));
  assert.equal(back.frontier.units[0].citizenId, 'c2');
  assert.equal(companion.frontier.units[0].citizenId, 'c4');
  assert.equal(sim.constructionQueue(back).length, 2);
  assert.equal(back.subsecond, .5);
  assert.equal(companion.subsecond, .25);
});

test('offers move no goods until the receiving town explicitly accepts in management mode', () => {
  const setup = paired(), { store, storage, home, homeId, companionId } = setup;
  const homeBefore = { ...home.resources };
  const proposal = ok(store.proposeOffer({ give: { wood: 10 }, request: { stone: 5 } }, home));
  assert.deepEqual(home.resources, homeBefore);
  assert.deepEqual(sim.restore(storage.getItem(HOME_SAVE_KEY)).resources, homeBefore);
  assert.equal(store.acceptOffer(proposal.offerId, home).ok, false, 'The proposer cannot consent for the recipient');
  const visit = ok(store.switchTown(companionId, home, { visit: true })).state;
  const visitBefore = sim.serialize(visit), storedBefore = records(storage);
  assert.equal(store.readOnly, true);
  assert.equal(store.acceptOffer(proposal.offerId, visit).ok, false);
  assert.equal(store.proposeOffer({ give: { wood: 2 }, request: { stone: 1 } }, visit).ok, false);
  assert.equal(store.closeOffer(proposal.offerId, visit).ok, false);
  assert.equal(store.renameTown(companionId, 'Changed while visiting', visit).ok, false);
  assert.equal(store.create({ homeName: 'New home', companionName: 'New town' }, visit).ok, false);
  const skipped = ok(store.save(visit));
  assert.equal(skipped.skipped, true);
  assert.equal(sim.serialize(visit), visitBefore);
  assert.deepEqual(records(storage), storedBefore);
  visit.resources.wood = 1;
  sim.tick(visit, 2.5);
  assert.equal(ok(store.save(visit)).skipped, true);
  assert.deepEqual(records(storage), storedBefore, 'Even an accidentally changed visit state cannot be persisted');
  const returned = ok(store.switchTown(homeId, visit)).state;
  assert.deepEqual(returned.resources, homeBefore);
  const recipient = ok(store.switchTown(companionId, returned)).state;
  assert.equal(store.readOnly, false);
  assert.equal(recipient.elapsed, 0);
  assert.equal(recipient.resources.wood, 100);
  const recipientBefore = { ...recipient.resources };
  const accepted = ok(store.acceptOffer(proposal.offerId, recipient)).state;
  assert.equal(accepted.resources.wood, recipientBefore.wood + 10);
  assert.equal(accepted.resources.stone, recipientBefore.stone - 5);
  assert.deepEqual(recipient.resources, recipientBefore, 'Transactions return a new state without changing their input');
});

test('a one-way gift still requires recipient consent and transfers its offered goods once', () => {
  const setup = paired(), { store, storage } = setup;
  const { offerId, recipient } = offerFromHome(setup, { food: 7 }, {});
  const before = { ...recipient.resources };
  const accepted = ok(store.acceptOffer(offerId, recipient)).state;
  assert.equal(accepted.resources.food, before.food + 7);
  assert.equal(sim.restore(storage.getItem(HOME_SAVE_KEY)).resources.food, setup.home.resources.food - 7);
  for (const resource of sim.RESOURCE_NAMES.filter(key => key !== 'food')) assert.equal(accepted.resources[resource], before[resource]);
  assert.equal(store.acceptOffer(offerId, accepted).ok, false);
});

test('a trade commits both bags exactly once, survives reload, and cannot replay after switching', () => {
  const setup = paired(), { store, storage, homeId, companionId } = setup;
  const { offerId, recipient } = offerFromHome(setup);
  const homeBefore = { ...setup.home.resources }, recipientBefore = { ...recipient.resources };
  const accepted = ok(store.acceptOffer(offerId, recipient)).state;
  const updatedHome = sim.restore(storage.getItem(HOME_SAVE_KEY));
  assert.equal(updatedHome.resources.wood, homeBefore.wood - 10);
  assert.equal(updatedHome.resources.stone, homeBefore.stone + 5);
  for (const resource of sim.RESOURCE_NAMES) assert.equal(updatedHome.resources[resource] + accepted.resources[resource], homeBefore[resource] + recipientBefore[resource], `${resource} must be conserved`);
  const committed = records(storage);
  assert.equal(store.acceptOffer(offerId, accepted).ok, false);
  assert.deepEqual(records(storage), committed);
  const reloaded = createCompanionStore({ storage });
  const homeAgain = reloaded.loadHome();
  assert.deepEqual(homeAgain.resources, updatedHome.resources);
  const recipientAgain = ok(reloaded.switchTown(companionId, homeAgain)).state;
  assert.deepEqual(recipientAgain.resources, accepted.resources);
  const beforeReplay = records(storage);
  assert.equal(reloaded.acceptOffer(offerId, recipientAgain).ok, false);
  assert.deepEqual(records(storage), beforeReplay);
  const back = ok(reloaded.switchTown(homeId, recipientAgain)).state;
  assert.deepEqual(back.resources, updatedHome.resources);
});

test('an offer sent by the companion updates the home mirror only after home accepts', () => {
  const { store, storage, home, homeId, companionId } = paired(busyTown());
  const companion = ok(store.switchTown(companionId, home)).state;
  const { offerId } = ok(store.proposeOffer({ give: { food: 8 }, request: { wood: 3 } }, companion));
  const before = storage.getItem(HOME_SAVE_KEY);
  assert.equal(store.acceptOffer(offerId, companion).ok, false);
  assert.equal(storage.getItem(HOME_SAVE_KEY), before);
  const recipient = ok(store.switchTown(homeId, companion)).state;
  const accepted = ok(store.acceptOffer(offerId, recipient)).state;
  assert.equal(accepted.resources.food, recipient.resources.food + 8);
  assert.equal(accepted.resources.wood, recipient.resources.wood - 3);
  assert.deepEqual(durable(sim.restore(storage.getItem(HOME_SAVE_KEY))), durable(accepted));
  assert.deepEqual(accepted.discovery, home.discovery);
  assert.deepEqual(accepted.frontier, home.frontier);
  assert.deepEqual(accepted.events, home.events);
});

test('closing an offer prevents later acceptance and never changes either stockpile', () => {
  const setup = paired(), { store, home, companionId } = setup;
  const homeBefore = { ...home.resources };
  const { offerId } = ok(store.proposeOffer({ give: { wood: 10 }, request: { stone: 5 } }, home));
  ok(store.closeOffer(offerId, home));
  const recipient = ok(store.switchTown(companionId, home)).state;
  const recipientBefore = { ...recipient.resources };
  assert.equal(store.acceptOffer(offerId, recipient).ok, false);
  assert.deepEqual(home.resources, homeBefore);
  assert.deepEqual(recipient.resources, recipientBefore);
});

test('invalid resource bags cannot create offers or change either town', () => {
  const { store, storage, home } = paired();
  const invalid = [{ wood: 0 }, { wood: -1 }, { wood: .5 }, { wood: NaN }, { wood: Infinity }, { unknown: 1 }, { knowledge: 1 }, { constructor: 1 }, JSON.parse('{"__proto__":1}'), null, []];
  for (const bag of invalid) for (const side of ['give', 'request']) {
    const before = records(storage), stateBefore = sim.serialize(home);
    const proposal = { give: { wood: 2 }, request: { stone: 1 }, [side]: bag };
    assert.equal(store.proposeOffer(proposal, home).ok, false, `${side}: ${JSON.stringify(bag)}`);
    assert.deepEqual(records(storage), before);
    assert.equal(sim.serialize(home), stateBefore);
  }
});

test('insufficient goods or either receiving capacity reject the entire exchange without partial debits', () => {
  for (const scenario of ['recipient-unfunded', 'source-unfunded', 'recipient-full', 'source-full']) {
    const setup = paired(), { store, storage, homeId, companionId } = setup;
    const { offerId, recipient: initialRecipient } = offerFromHome(setup);
    let recipient = initialRecipient;
    if (scenario.startsWith('source')) {
      const source = ok(store.switchTown(homeId, recipient)).state;
      if (scenario === 'source-unfunded') source.resources.wood = 0;
      else source.resources.stone = sim.storageCapacity(source).stone;
      ok(store.save(source));
      recipient = ok(store.switchTown(companionId, source)).state;
    } else if (scenario === 'recipient-unfunded') recipient.resources.stone = 0;
    else recipient.resources.wood = sim.storageCapacity(recipient).wood;
    const before = records(storage), stateBefore = sim.serialize(recipient);
    assert.equal(store.acceptOffer(offerId, recipient).ok, false, scenario);
    assert.deepEqual(records(storage), before, scenario);
    assert.equal(sim.serialize(recipient), stateBefore, scenario);
  }
});

test('an exchange preserves unrelated overflow and resource precision while reducing offered overflow', () => {
  const home = sim.createGame();
  home.resources.wood = sim.storageCapacity(home).wood + 20.123456789;
  home.resources.food = sim.storageCapacity(home).food + 37.123456789;
  home.resources.gold = 12.123456789;
  const setup = paired(home), { store, storage } = setup;
  const { offerId, recipient } = offerFromHome(setup);
  recipient.resources.stone = sim.storageCapacity(recipient).stone + 20.987654321;
  recipient.resources.iron = sim.storageCapacity(recipient).iron + 3.765432198;
  recipient.resources.gold = 9.987654321;
  const sourceBefore = { ...setup.home.resources }, recipientBefore = { ...recipient.resources };
  const accepted = ok(store.acceptOffer(offerId, recipient)).state;
  const source = sim.restore(storage.getItem(HOME_SAVE_KEY));
  assert.equal(source.resources.wood, sourceBefore.wood - 10);
  assert.equal(source.resources.stone, sourceBefore.stone + 5);
  assert.equal(accepted.resources.wood, recipientBefore.wood + 10);
  assert.equal(accepted.resources.stone, recipientBefore.stone - 5);
  for (const resource of sim.RESOURCE_NAMES.filter(key => !['wood', 'stone'].includes(key))) {
    assert.equal(source.resources[resource], sourceBefore[resource], `Source ${resource} must not be clipped or rounded`);
    assert.equal(accepted.resources[resource], recipientBefore[resource], `Recipient ${resource} must not be clipped or rounded`);
  }
});

test('malformed companion data is preserved and blocks writes while the original home still opens', () => {
  for (const corrupt of ['{broken json', '{}', 'null', '[]']) {
    const home = busyTown(), homeRaw = sim.serialize(home);
    const storage = new MemoryStorage([[HOME_SAVE_KEY, homeRaw], [COMPANION_SAVE_KEY, corrupt]]);
    const store = createCompanionStore({ storage });
    const restored = store.loadHome();
    assert.deepEqual(durable(restored), durable(sim.restore(homeRaw)));
    assert.equal(store.info().blocked, true);
    assert.ok(store.info().reason);
    const before = records(storage);
    assert.equal(store.save(restored).ok, false);
    assert.equal(store.create({ homeName: 'Home', companionName: 'Another' }, restored).ok, false);
    assert.deepEqual(records(storage), before);
    assert.deepEqual(storage.writes, []);
  }
});

test('invalid embedded towns and forged offer records cannot bypass companion save validation', () => {
  const setup = paired(busyTown());
  ok(setup.store.proposeOffer({ give: { wood: 10 }, request: { stone: 5 } }, setup.home));
  const originalEnvelope = setup.storage.getItem(COMPANION_SAVE_KEY);
  const originalHome = setup.storage.getItem(HOME_SAVE_KEY);
  const corruptions = [
    record => { record.revision = -1; },
    record => { delete record.towns[setup.companionId]; },
    record => { record.towns[setup.companionId] = '{corrupt snapshot'; },
    record => { const town = JSON.parse(record.towns[setup.companionId]); town.resources.wood = -1; record.towns[setup.companionId] = JSON.stringify(town); },
    record => { record.offers[0].status = 'pending-again'; },
    record => { record.offers[0].to = record.offers[0].from; },
    record => { record.offers[0].give = { knowledge: 1 }; },
    record => { record.offers[0].give = { wood: .5 }; },
    record => { record.offers.push({ ...record.offers[0] }); },
    record => { record.nextOfferId = 1; },
  ];
  for (const corrupt of corruptions) {
    const envelope = JSON.parse(originalEnvelope);
    corrupt(envelope);
    const raw = JSON.stringify(envelope);
    const storage = new MemoryStorage([[HOME_SAVE_KEY, originalHome], [COMPANION_SAVE_KEY, raw]]);
    const store = createCompanionStore({ storage });
    const home = store.loadHome();
    assert.equal(store.info().blocked, true);
    assert.deepEqual(durable(home), durable(sim.restore(originalHome)));
    assert.equal(store.save(home).ok, false);
    assert.equal(storage.getItem(COMPANION_SAVE_KEY), raw);
    assert.deepEqual(storage.writes, []);
  }
});

test('a conflicting external home found at startup is preserved alongside the companion record', () => {
  const setup = paired(busyTown());
  const external = sim.restore(setup.storage.getItem(HOME_SAVE_KEY));
  sim.tick(external, 4.5);
  setup.storage.setItem(HOME_SAVE_KEY, sim.serialize(external));
  const before = records(setup.storage);
  const store = createCompanionStore({ storage: setup.storage });
  const recovered = store.loadHome();
  assert.equal(store.info().blocked, true);
  assert.deepEqual(durable(recovered), durable(external));
  assert.equal(store.save(recovered).ok, false);
  assert.deepEqual(records(setup.storage), before);
});

test('storage read failures return a usable fallback and block mutation without destroying data', () => {
  const storage = new MemoryStorage(), fallback = busyTown();
  storage.failReads.add(COMPANION_SAVE_KEY);
  const store = createCompanionStore({ storage });
  const loaded = store.loadHome(fallback);
  assert.ok(loaded);
  assert.deepEqual(durable(loaded), durable(fallback));
  assert.equal(store.info().blocked, true);
  assert.equal(store.save(loaded).ok, false);
  assert.deepEqual(storage.writes, []);
});

test('quota failure during opt-in leaves the original home and input state intact', () => {
  const { storage, store, home, raw } = opened(busyTown());
  storage.failWrites.add(COMPANION_SAVE_KEY);
  const before = sim.serialize(home);
  assert.equal(store.create({ homeName: 'Home', companionName: 'Foxglove' }, home).ok, false);
  assert.equal(storage.getItem(HOME_SAVE_KEY), raw);
  assert.equal(storage.getItem(COMPANION_SAVE_KEY), null);
  assert.equal(sim.serialize(home), before);
  assert.deepEqual(storage.writes, []);
});

test('quota failure during autosave or switching preserves the last durable snapshot and active town', () => {
  for (const action of ['save', 'switchTown']) {
    const { storage, store, home, companionId } = paired(busyTown());
    const companion = ok(store.switchTown(companionId, home)).state;
    sim.tick(companion, 2.25);
    storage.failWrites.add(COMPANION_SAVE_KEY);
    const before = records(storage), stateBefore = sim.serialize(companion), activeBefore = store.activeId;
    const result = action === 'save' ? store.save(companion) : store.switchTown(store.info().towns.find(town => town.id !== companionId).id, companion);
    assert.equal(result.ok, false, action);
    assert.deepEqual(records(storage), before, action);
    assert.equal(store.activeId, activeBefore, action);
    assert.equal(sim.serialize(companion), stateBefore, action);
  }
});

test('quota failure cannot debit one town or consume an uncommitted offer', () => {
  const setup = paired(), { storage, store } = setup;
  const { offerId, recipient } = offerFromHome(setup);
  storage.failWrites.add(COMPANION_SAVE_KEY);
  const before = records(storage), inputBefore = sim.serialize(recipient);
  assert.equal(store.acceptOffer(offerId, recipient).ok, false);
  assert.deepEqual(records(storage), before);
  assert.equal(sim.serialize(recipient), inputBefore);
  storage.failWrites.clear();
  const reloaded = createCompanionStore({ storage });
  const home = reloaded.loadHome();
  const recipientAgain = ok(reloaded.switchTown(setup.companionId, home)).state;
  const accepted = ok(reloaded.acceptOffer(offerId, recipientAgain)).state;
  assert.equal(accepted.resources.wood, recipient.resources.wood + 10);
  assert.equal(accepted.resources.stone, recipient.resources.stone - 5);
});

test('a failed home mirror after an atomic trade recovers from the registry and cannot duplicate goods', () => {
  const setup = paired(), { storage, store, companionId } = setup;
  const { offerId, recipient } = offerFromHome(setup);
  const homeRaw = storage.getItem(HOME_SAVE_KEY), homeBefore = sim.restore(homeRaw);
  storage.failWrites.add(HOME_SAVE_KEY);
  const result = ok(store.acceptOffer(offerId, recipient));
  assert.equal(storage.getItem(HOME_SAVE_KEY), homeRaw);
  storage.failWrites.clear();
  const reloaded = createCompanionStore({ storage });
  const recovered = reloaded.loadHome();
  assert.equal(recovered.resources.wood, homeBefore.resources.wood - 10);
  assert.equal(recovered.resources.stone, homeBefore.resources.stone + 5);
  assert.deepEqual(sim.restore(storage.getItem(HOME_SAVE_KEY)).resources, recovered.resources);
  const recipientAgain = ok(reloaded.switchTown(companionId, recovered)).state;
  assert.deepEqual(recipientAgain.resources, result.state.resources);
  assert.equal(reloaded.acceptOffer(offerId, recipientAgain).ok, false);
  assert.ok(result.warning || /mirror|recover|original|backup/i.test(result.reason), 'The committed transaction should disclose the delayed home mirror');
});

test('a stale second tab cannot overwrite a newer registry or switch using its old state', () => {
  for (const action of ['save', 'switchTown']) {
    const { storage, store, home, companionId } = paired();
    const second = createCompanionStore({ storage }), secondHome = second.loadHome();
    sim.tick(home, 3.25);
    ok(store.save(home));
    const before = records(storage), secondBefore = sim.serialize(secondHome), activeBefore = second.activeId;
    const result = action === 'save' ? second.save(secondHome) : second.switchTown(companionId, secondHome);
    assert.equal(result.ok, false, action);
    assert.equal(second.info().blocked, true);
    assert.deepEqual(records(storage), before);
    assert.equal(second.activeId, activeBefore);
    assert.equal(sim.serialize(secondHome), secondBefore);
  }
});

test('two tabs accepting one offer can commit only one transfer', () => {
  const { storage, store, home, homeId, companionId } = paired();
  const companion = ok(store.switchTown(companionId, home)).state;
  const { offerId } = ok(store.proposeOffer({ give: { wood: 10 }, request: { stone: 5 } }, companion));
  const recipient = ok(store.switchTown(homeId, companion)).state;
  const second = createCompanionStore({ storage }), staleRecipient = second.loadHome();
  const accepted = ok(store.acceptOffer(offerId, recipient)).state;
  const committed = records(storage), staleBefore = sim.serialize(staleRecipient);
  assert.equal(second.acceptOffer(offerId, staleRecipient).ok, false);
  assert.equal(second.info().blocked, true);
  assert.deepEqual(records(storage), committed);
  assert.equal(sim.serialize(staleRecipient), staleBefore);
  assert.equal(accepted.resources.wood, recipient.resources.wood + 10);
  const reloaded = createCompanionStore({ storage });
  const homeAgain = reloaded.loadHome();
  assert.deepEqual(homeAgain.resources, accepted.resources);
  assert.equal(reloaded.acceptOffer(offerId, homeAgain).ok, false);
});

test('an external change to the original home key blocks stale companion autosaves', () => {
  const { storage, store, home, companionId } = paired();
  const companion = ok(store.switchTown(companionId, home)).state;
  const externalHome = sim.restore(storage.getItem(HOME_SAVE_KEY));
  sim.tick(externalHome, 4.5);
  storage.setItem(HOME_SAVE_KEY, sim.serialize(externalHome));
  const before = records(storage), inputBefore = sim.serialize(companion);
  assert.equal(store.save(companion).ok, false);
  assert.equal(store.info().blocked, true);
  assert.deepEqual(records(storage), before);
  assert.equal(sim.serialize(companion), inputBefore);
});

test('an exclusive browser writer lease blocks the second tab and release admits a fresh writer', async () => {
  const home = busyTown(), storage = new MemoryStorage([[HOME_SAVE_KEY, sim.serialize(home)]]), locks = new FakeLocks();
  const first = createCompanionStore({ storage, locks, requireLock: true });
  await first.ready;
  assert.equal(first.info().blocked, false);
  assert.equal(locks.requests[0].name, 'wildhaven.local-towns.writer');
  assert.equal(locks.requests[0].options.mode, 'exclusive');
  assert.equal(locks.requests[0].options.ifAvailable, true);
  const firstHome = first.loadHome();
  ok(first.create({ homeName: 'Home', companionName: 'Foxglove' }, firstHome));
  const before = records(storage);
  const second = createCompanionStore({ storage, locks, requireLock: true });
  await second.ready;
  assert.equal(second.info().blocked, true);
  assert.equal(second.save(home).ok, false);
  assert.equal(second.create({ homeName: 'Replacement', companionName: 'Replacement' }, home).ok, false);
  assert.deepEqual(records(storage), before);
  await first.release();
  await locks.requests[0].finished;
  assert.equal(first.save(firstHome).ok, false, 'A released store cannot continue to write');
  const third = createCompanionStore({ storage, locks, requireLock: true });
  await third.ready;
  assert.equal(third.info().blocked, false);
  const resumedHome = third.loadHome();
  assert.deepEqual(durable(resumedHome), durable(firstHome));
  sim.tick(resumedHome, 1.25);
  ok(third.save(resumedHome));
  assert.deepEqual(durable(sim.restore(storage.getItem(HOME_SAVE_KEY))), durable(resumedHome));
  await third.release();
  await locks.requests[2].finished;
  assert.equal(locks.held.size, 0);
});

test('missing required Web Locks block all mutations and preserve both stored records', async () => {
  const setup = paired(busyTown()), before = records(setup.storage);
  const writesBefore = setup.storage.writes.length;
  const store = createCompanionStore({ storage: setup.storage, locks: null, requireLock: true });
  await store.ready;
  assert.equal(store.info().blocked, true);
  assert.ok(store.info().reason);
  assert.equal(store.save(setup.home).ok, false);
  assert.equal(store.create({ homeName: 'Home', companionName: 'Other' }, setup.home).ok, false);
  assert.equal(store.switchTown(setup.companionId, setup.home).ok, false);
  assert.equal(store.renameTown(setup.homeId, 'Renamed', setup.home).ok, false);
  assert.equal(store.proposeOffer({ give: { wood: 1 }, request: {} }, setup.home).ok, false);
  assert.equal(store.acceptOffer('o1', setup.home).ok, false);
  assert.equal(store.closeOffer('o1', setup.home).ok, false);
  assert.deepEqual(records(setup.storage), before);
  assert.equal(setup.storage.writes.length, writesBefore);
});

test('a rejected Web Locks request settles ready as blocked without storage writes', async () => {
  const raw = sim.serialize(busyTown()), storage = new MemoryStorage([[HOME_SAVE_KEY, raw]]);
  const locks = { request() { return Promise.reject(new Error('Web Locks denied')); } };
  const store = createCompanionStore({ storage, locks, requireLock: true });
  await store.ready;
  assert.equal(store.info().blocked, true);
  assert.equal(store.save(busyTown()).ok, false);
  assert.deepEqual(records(storage), [[HOME_SAVE_KEY, raw]]);
  assert.deepEqual(storage.writes, []);
});

test('pending lease acquisition cannot repair a mirror or write until ready resolves', async () => {
  const setup = paired(), { storage, store: unlocked } = setup;
  const { offerId, recipient } = offerFromHome(setup);
  storage.failWrites.add(HOME_SAVE_KEY);
  const accepted = ok(unlocked.acceptOffer(offerId, recipient)).state;
  assert.ok(accepted);
  storage.failWrites.clear();
  const before = records(storage), writesBefore = storage.writes.length;
  const locks = new FakeLocks({ paused: true });
  const store = createCompanionStore({ storage, locks, requireLock: true });
  let settled = false;
  store.ready.then(() => { settled = true; });
  await Promise.resolve();
  assert.equal(settled, false);
  assert.equal(store.save(setup.home).ok, false);
  assert.equal(store.create({ homeName: 'New home', companionName: 'New town' }, setup.home).ok, false);
  store.loadHome(setup.home);
  assert.deepEqual(records(storage), before);
  assert.equal(storage.writes.length, writesBefore);
  locks.allowPending();
  await store.ready;
  assert.equal(store.info().blocked, false);
  const recovered = store.loadHome();
  assert.equal(recovered.resources.wood, setup.home.resources.wood - 10);
  assert.deepEqual(durable(sim.restore(storage.getItem(HOME_SAVE_KEY))), durable(recovered));
  ok(store.save(recovered));
  await store.release();
  await locks.requests[0].finished;
});

test('releasing a store while its lease request is pending cannot leave a later writer locked out', async () => {
  const home = sim.createGame(), raw = sim.serialize(home);
  const storage = new MemoryStorage([[HOME_SAVE_KEY, raw]]), locks = new FakeLocks({ paused: true });
  const released = createCompanionStore({ storage, locks, requireLock: true });
  await Promise.resolve();
  released.release();
  locks.allowPending();
  await released.ready;
  await Promise.resolve();
  assert.equal(released.info().blocked, true);
  assert.equal(released.save(home).ok, false);
  assert.equal(locks.held.size, 0, 'A released store must not retain a lease granted afterward');
  const next = createCompanionStore({ storage, locks, requireLock: true });
  await next.ready;
  assert.equal(next.info().blocked, false);
  ok(next.save(next.loadHome()));
  await next.release();
  await locks.requests[1].finished;
});
