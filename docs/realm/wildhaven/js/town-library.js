import { createCompanionStore, HOME_SAVE_KEY, COMPANION_SAVE_KEY } from './companion-store.js';
import { createGame, serialize, restore } from './sim.js';
import { ensureCoop, validTownName } from './coop-state.js';
import { calendarDay } from './calendar.js';

export const TOWN_LIBRARY_KEY = 'wildhaven.towns.v1';
const LEGACY_KEYS = [HOME_SAVE_KEY, COMPANION_SAVE_KEY, 'wildhaven.v3', 'wildhaven.v2', 'wildhaven.v1'];
const fail = reason => ({ ok: false, reason });
const clone = value => JSON.parse(JSON.stringify(value));
const empty = () => ({ version: 1, revision: 0, nextId: 1, active: null, slots: [] });
const dataStore = data => ({ getItem: key => data[key] ?? null, setItem: (key, value) => { data[key] = value; } });
const memberRaw = (slot, id) => id === 'companion' ? JSON.parse(slot.data[COMPANION_SAVE_KEY]).towns.companion
  : slot.data[COMPANION_SAVE_KEY] ? JSON.parse(slot.data[COMPANION_SAVE_KEY]).towns.home : slot.data[HOME_SAVE_KEY];

/** One durable library, including each companion pair's atomic trade journal.
 * Old localStorage keys are never removed or rewritten. A single browser lease
 * also excludes older clients, which use the same lock name. */
export function createTownLibrary({ storage, locks = globalThis.navigator?.locks, requireLock = typeof window !== 'undefined', now = Date.now } = {}) {
  let record = empty(), expected = null, legacy = {}, backend, blocked = false, reason = '', pending = true, releaseLease;
  const block = message => { blocked = true; reason = message; return fail(message); };
  const slotById = id => record.slots.find(slot => slot.id === id);
  function check() {
    if (blocked) return fail(reason);
    if (pending) return fail('Waiting for the town save lock.');
    try {
      if (storage.getItem(TOWN_LIBRARY_KEY) !== expected || LEGACY_KEYS.some(key => storage.getItem(key) !== legacy[key]))
        return block('Another tab changed a save. Close the other game tab and reload. No stored town was replaced.');
      return { ok: true };
    } catch { return fail('Device storage is unavailable. Keep this tab open; the change has not been saved.'); }
  }
  function commit(next) {
    const checked = check(); if (!checked.ok) return checked;
    next.revision = record.revision + 1;
    const raw = JSON.stringify(next);
    if (raw.length > 4500000 || !Number.isSafeInteger(next.revision)) return fail('Town storage is full. Download backups; the existing towns are unchanged.');
    try { storage.setItem(TOWN_LIBRARY_KEY, raw); }
    catch { return fail('There is not enough writable device storage. Your existing towns are unchanged; keep this tab open.'); }
    record = next; expected = raw; return { ok: true };
  }
  function makeBackend(id) {
    return createCompanionStore({ requireLock: false, storage: {
      getItem: key => slotById(id)?.data[key] ?? null,
      setItem: (key, value) => {
        const next = clone(record), slot = next.slots.find(slot => slot.id === id);
        if (!slot) throw Error('Create a town first.');
        slot.data[key] = value; slot.updatedAt = now();
        const result = commit(next); if (!result.ok) throw Error(result.reason);
      },
    } });
  }
  function validate(value) {
    if (!value || value.version !== 1 || !Number.isSafeInteger(value.revision) || value.revision < 1
      || !Number.isSafeInteger(value.nextId) || value.nextId < 1 || !Array.isArray(value.slots) || !value.slots.length) return false;
    const ids = new Set();
    for (const slot of value.slots) {
      if (!/^s[1-9]\d*$/.test(slot?.id) || Number(slot.id.slice(1)) >= value.nextId || ids.has(slot.id)
        || !validTownName(slot.name) || !Number.isFinite(slot.updatedAt) || !Number.isFinite(slot.createdAt)
        || !slot.data || Object.keys(slot.data).some(key => ![HOME_SAVE_KEY, COMPANION_SAVE_KEY].includes(key))) return false;
      ids.add(slot.id);
      const probe = createCompanionStore({ storage: dataStore(clone(slot.data)), requireLock: false });
      if (probe.blocked || !probe.loadHome()) return false;
    }
    const selected = value.slots.find(slot => slot.id === value.active?.slotId);
    return !!selected && ['home', 'companion'].includes(value.active.townId)
      && (value.active.townId === 'home' || !!selected.data[COMPANION_SAVE_KEY]);
  }
  function initialize() {
    pending = false;
    try {
      expected = storage.getItem(TOWN_LIBRARY_KEY);
      legacy = Object.fromEntries(LEGACY_KEYS.map(key => [key, storage.getItem(key)]));
      if (expected !== null) {
        if (expected.length > 4500000) throw Error('oversize');
        const parsed = JSON.parse(expected); if (!validate(parsed)) throw Error('invalid library');
        record = parsed;
      } else {
        const data = {};
        if (legacy[COMPANION_SAVE_KEY] !== null) data[COMPANION_SAVE_KEY] = legacy[COMPANION_SAVE_KEY];
        const original = legacy[HOME_SAVE_KEY] ?? legacy['wildhaven.v3'] ?? legacy['wildhaven.v2'] ?? legacy['wildhaven.v1'];
        if (original !== null) data[HOME_SAVE_KEY] = original;
        if (Object.keys(data).length) {
          const probe = createCompanionStore({ storage: dataStore(clone(data)), requireLock: false });
          if (probe.blocked || !probe.loadHome()) throw Error('invalid original');
          // Keep exact original bytes, including a recoverable companion mirror.
          const next = empty(); next.nextId = 2; next.active = { slotId: 's1', townId: 'home' };
          next.slots.push({ id: 's1', name: 'Your town', data, createdAt: now(), updatedAt: now() });
          const migrated = commit(next); if (!migrated.ok) { block(migrated.reason); return; }
        }
      }
      backend = makeBackend(record.active?.slotId);
      if (record.active) backend.loadTown(record.active.townId);
    } catch { block('The saved towns could not be safely opened. The original records are untouched. Keep a backup before trying recovery.'); }
  }
  let ready;
  if (!requireLock) { initialize(); ready = Promise.resolve(); }
  else if (!locks?.request) { pending = false; block('This browser cannot safely lock town saves. Existing towns are untouched. Use a current browser with Web Locks support.'); ready = Promise.resolve(); }
  else ready = new Promise(resolve => {
    try {
      Promise.resolve(locks.request('wildhaven.local-towns.writer', { mode: 'exclusive', ifAvailable: true }, lock => {
        if (!lock) { pending = false; block('Your towns are open in another tab. Close that game tab, then reload this one.'); resolve(); return; }
        initialize(); resolve(); return new Promise(release => { releaseLease = release; });
      })).catch(() => { pending = false; block('The town save lock is unavailable. Existing saves are untouched; reload to retry.'); resolve(); });
    } catch { pending = false; block('The town save lock is unavailable. Existing saves are untouched; reload to retry.'); resolve(); }
  });
  function saveCurrent(state) {
    const checked = check(); if (!checked.ok) return checked;
    return state && record.active ? backend.save(state) : { ok: true };
  }
  function select(slotId, townId, currentState = null, { visit = false } = {}) {
    const saved = saveCurrent(currentState); if (!saved.ok) return saved;
    const slot = slotById(slotId);
    if (visit && slotId !== record.active?.slotId) return fail('Read-only visits stay within the local companion pair.');
    if (!slot || !['home', 'companion'].includes(townId) || (townId === 'companion' && !slot.data[COMPANION_SAVE_KEY])) return fail('That town could not be found.');
    const nextBackend = makeBackend(slotId), state = nextBackend.loadTown(townId, { visit });
    if (!state) return fail('That town could not be read. Your current town is still open.');
    const next = clone(record); next.active = { slotId, townId };
    if (!visit) { const result = commit(next); if (!result.ok) return result; }
    backend = nextBackend;
    return { ok: true, state, reason: visit ? 'Visiting this town. Time and building are paused.' : 'Town opened. Time is paused until you resume.' };
  }
  function add(name, state, currentState) {
    if (!validTownName(name)) return fail('Use a town name of 1–40 characters, without angle brackets.');
    const saved = saveCurrent(currentState); if (!saved.ok) return saved;
    const raw = serialize(state); if (!restore(raw)) return fail('This town could not be safely saved.');
    const next = clone(record), id = `s${next.nextId++}`;
    next.slots.push({ id, name: name.trim(), data: { [HOME_SAVE_KEY]: raw }, createdAt: now(), updatedAt: now() });
    // Creating or copying never changes the active town until Continue is chosen.
    next.active ||= { slotId: id, townId: 'home' };
    const result = commit(next);
    if (result.ok && !backend?.loadHome) backend = makeBackend(id);
    // An empty library has a backend with no selected slot yet.
    if (result.ok && record.slots.length === 1) backend = makeBackend(id);
    return result.ok ? { ok: true, id, townId: 'home' } : result;
  }
  function duplicate(slotId, townId, name, currentState = null) {
    const saved = saveCurrent(currentState); if (!saved.ok) return saved;
    const slot = slotById(slotId); if (!slot || !['home', 'companion'].includes(townId) || (townId === 'companion' && !slot.data[COMPANION_SAVE_KEY])) return fail('That town could not be found.');
    const copy = restore(memberRaw(slot, townId)); if (!copy) return fail('That town could not be copied.');
    const storehouse = !!copy.coop?.storehouse;
    delete copy.coop; ensureCoop(copy).storehouse = storehouse;
    return add(name, copy, null);
  }
  function rename(slotId, townId, name, currentState = null) {
    if (!validTownName(name)) return fail('Use a town name of 1–40 characters, without angle brackets.');
    const saved = saveCurrent(currentState); if (!saved.ok) return saved;
    const next = clone(record), slot = next.slots.find(slot => slot.id === slotId);
    if (!slot || !['home','companion'].includes(townId) || (townId === 'companion' && !slot.data[COMPANION_SAVE_KEY])) return fail('That town could not be found.');
    if (slot.data[COMPANION_SAVE_KEY]) { const pair = JSON.parse(slot.data[COMPANION_SAVE_KEY]); pair.names[townId] = name.trim(); pair.revision++; slot.data[COMPANION_SAVE_KEY] = JSON.stringify(pair); }
    else slot.name = name.trim();
    const result = commit(next);
    if (result.ok && record.active.slotId === slotId) { const visit = backend.readOnly; backend = makeBackend(slotId); backend.loadTown(record.active.townId, { visit }); }
    return result;
  }
  function list() {
    return record.slots.flatMap(slot => {
      const pair = slot.data[COMPANION_SAVE_KEY] && JSON.parse(slot.data[COMPANION_SAVE_KEY]);
      return (pair ? ['home','companion'] : ['home']).map(townId => {
        const state = JSON.parse(memberRaw(slot, townId));
        return { slotId: slot.id, townId, name: pair ? pair.names[townId] : slot.name, day: calendarDay(state), population: state.population,
          active: record.active?.slotId === slot.id && backend?.activeId === townId, paired: !!pair, linked: !!state.coop?.link,
          updatedAt: slot.updatedAt, state };
      });
    });
  }
  const writeMethods = new Set(['save','create','renameTown','proposeOffer','acceptOffer','closeOffer']);
  const companions = new Proxy({}, { get(_, key) {
    if (key === 'ready') return ready;
    if (key === 'blocked') return blocked || !!backend?.blocked;
    if (key === 'reason') return reason || backend?.reason || '';
    if (key === 'canManage') return !pending && !blocked && !!backend?.canManage;
    if (key === 'lockPending') return pending;
    if (key === 'loadHome') return () => record.active ? backend?.loadTown(record.active.townId) : null;
    if (key === 'switchTown') return (id, state, options) => select(record.active?.slotId, id, state, options);
    if (key === 'release') return () => { block('This tab released its save lock. Reload before changing a town.'); releaseLease?.(); };
    if (writeMethods.has(key)) return (...args) => { const checked = check(); return checked.ok ? backend[key](...args) : checked; };
    if (key === 'info' && !backend) return () => ({ enabled: false, activeId: 'home', mode: 'manage', blocked: true, reason, towns: [], offers: [], revision: 0 });
    const value = backend?.[key]; return typeof value === 'function' ? value.bind(backend) : value;
  } });
  return { ready, companions, list, select, duplicate, rename, saveCurrent, create: (name, state = null) => add(name, createGame(), state),
    get reason() { return reason; }, get blocked() { return blocked; },
    get activeName() { const slot = slotById(record.active?.slotId); return slot?.data[COMPANION_SAVE_KEY] ? backend.info().towns.find(t => t.id === backend.activeId)?.name : slot?.name; },
    exportTown(slotId, townId) { const slot = slotById(slotId); return slot && ['home','companion'].includes(townId) && (townId === 'home' || slot.data[COMPANION_SAVE_KEY]) ? memberRaw(slot, townId) : null; },
  };
}
