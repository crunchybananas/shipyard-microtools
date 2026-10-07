import { calendarDay } from './calendar.js';
import { createGame, serialize, restore, storageCapacity } from './sim.js';
import { RESOURCE_NAMES } from './catalog.js';

export const HOME_SAVE_KEY = 'wildhaven.v4';
export const COMPANION_SAVE_KEY = 'wildhaven.companions.v1';
export const TRADE_RESOURCES = Object.freeze(RESOURCE_NAMES.filter(key => key !== 'knowledge'));
const IDS = ['home', 'companion'];
const DEFAULT_NAMES = { home: 'Cory’s Wildhaven', companion: 'Melissa’s Wildhaven' };
const fail = reason => ({ ok: false, reason });
const clone = value => JSON.parse(JSON.stringify(value));
const validName = name => typeof name === 'string' && name.trim().length > 0 && name.trim().length <= 40 && !/[<>\x00-\x1f\x7f]/.test(name);
const other = id => id === 'home' ? 'companion' : 'home';
function validBag(bag, empty = false) {
  return !!bag && typeof bag === 'object' && !Array.isArray(bag)
    && (empty || Object.keys(bag).length > 0) && Object.keys(bag).length <= TRADE_RESOURCES.length
    && Object.entries(bag).every(([key, n]) => TRADE_RESOURCES.includes(key) && Number.isSafeInteger(n) && n > 0 && n <= 9999);
}
function validSnapshot(raw) {
  return typeof raw === 'string' && raw.length < 2000000 && restore(raw);
}
function readEnvelope(raw) {
  try {
    if (typeof raw !== 'string' || raw.length > 4500000) return null;
    const value = JSON.parse(raw);
    if (!value || value.version !== 1 || !Number.isSafeInteger(value.revision) || value.revision < 1
      || !Number.isSafeInteger(value.nextOfferId) || value.nextOfferId < 1
      || !IDS.every(id => validName(value.names?.[id]) && validSnapshot(value.towns?.[id]))
      || !(value.previousHome === null || typeof value.previousHome === 'string')
      || !Array.isArray(value.offers) || value.offers.length > 42) return null;
    const seen = new Set();
    for (const offer of value.offers) {
      if (!offer || !/^o[1-9]\d{0,12}$/.test(offer.id) || seen.has(offer.id)
        || Number(offer.id.slice(1)) >= value.nextOfferId || !IDS.includes(offer.from) || offer.to !== other(offer.from)
        || !['pending', 'accepted', 'declined', 'withdrawn'].includes(offer.status)
        || !validBag(offer.give) || !validBag(offer.request, true)
        || Object.keys(offer.give).some(key => Object.hasOwn(offer.request, key))
        || !Number.isSafeInteger(offer.proposedDay) || offer.proposedDay < 1 || offer.proposedDay > 1000000) return null;
      seen.add(offer.id);
    }
    if (value.offers.filter(offer => offer.status === 'pending').length > 12) return null;
    return value;
  } catch { return null; }
}

/** Two local towns, one atomic transaction record. The original save key is only a home mirror. */
export function createCompanionStore({ storage, locks = globalThis.navigator?.locks, requireLock = typeof window !== 'undefined' } = {}) {
  let record = null, expectedRegistry = null, expectedHome = null;
  let activeId = 'home', mode = 'manage', blocked = false, reason = '', warning = '';
  let leasePending = false, releaseLease = null;
  const summaries = new Map();
  function block(message) { blocked = true; reason = message; return fail(message); }
  try {
    expectedHome = storage.getItem(HOME_SAVE_KEY);
    expectedRegistry = storage.getItem(COMPANION_SAVE_KEY);
    if (expectedRegistry !== null) {
      record = readEnvelope(expectedRegistry);
      if (!record) block('The local towns record could not be read. Its data has been kept untouched; town changes are paused.');
      else if (expectedHome !== record.towns.home && expectedHome !== record.previousHome) {
        block('The home save changed outside this local towns record. Both copies are preserved; town changes are paused.');
      }
    } else if (expectedHome !== null && !validSnapshot(expectedHome)) {
      block('The home save could not be read. It has been kept untouched; town changes are paused.');
    }
  } catch { block('Device storage is unavailable. Keep this tab open; switching towns and trade need a working local save.'); }

  // localStorage has atomic writes, not compare-and-swap. Hold one browser writer
  // for the page lifetime so two tabs cannot both pass a stale revision check.
  let ready = Promise.resolve();
  if (requireLock) {
    if (!locks?.request) block('This browser cannot safely lock local town saves. Use a current browser with Web Locks support; existing saves have been kept untouched.');
    else {
      leasePending = true;
      ready = new Promise(resolveReady => {
        try {
          Promise.resolve(locks.request('wildhaven.local-towns.writer', { mode: 'exclusive', ifAvailable: true }, lock => {
            leasePending = false;
            if (blocked) { resolveReady(); return; }
            if (!lock) { block('Wildhaven is already open in another tab. Close that tab, then reload this one to continue safely.'); resolveReady(); return; }
            resolveReady(); return new Promise(resolve => { releaseLease = resolve; });
          })).catch(() => { leasePending = false; block('A safe local save lock could not be acquired. Existing saves have been kept untouched; reload to retry.'); resolveReady(); });
        } catch { leasePending = false; block('A safe local save lock could not be acquired. Existing saves have been kept untouched; reload to retry.'); resolveReady(); }
      });
    }
  }

  function unchanged() {
    if (blocked) return fail(reason);
    if (leasePending) return fail('Waiting for the local save lock. No changes have been written yet.');
    try {
      if (storage.getItem(COMPANION_SAVE_KEY) !== expectedRegistry || storage.getItem(HOME_SAVE_KEY) !== expectedHome) {
        return block('Another tab changed a town save. Keep this tab open to preserve unsaved work, then reload it after closing the other writer. No stored town was replaced.');
      }
      return { ok: true };
    } catch { return fail('Device storage is unavailable. Keep this tab open; this change has not been saved.'); }
  }
  function mirrorHome() {
    if (!record || expectedHome === record.towns.home) return;
    try {
      storage.setItem(HOME_SAVE_KEY, record.towns.home);
      expectedHome = record.towns.home; warning = '';
    } catch {
      warning = 'Both towns are saved in the local towns record. The home save mirror will be retried when storage is available.';
    }
  }
  function commit(next) {
    const check = unchanged(); if (!check.ok) return check;
    next.revision = (record?.revision || 0) + 1;
    next.previousHome = expectedHome;
    const raw = JSON.stringify(next);
    if (raw.length > 4500000 || !Number.isSafeInteger(next.revision)) return fail('These towns exceed the safe local save limit. Keep this tab open; no stored town was replaced.');
    try { storage.setItem(COMPANION_SAVE_KEY, raw); }
    catch { return fail('There is not enough writable device storage. Nothing was transferred or switched; keep this tab open and free some storage.'); }
    // setItem is atomic. Once this succeeds, both halves of every exchange are durable.
    record = next; expectedRegistry = raw; mirrorHome();
    return { ok: true, reason: warning || 'Saved on this device.', ...(warning ? { warning } : {}) };
  }
  function snapshot(state) {
    try { const raw = serialize(state); return validSnapshot(raw) ? raw : null; }
    catch { return null; }
  }
  function draft(currentState) {
    if (blocked) return fail(reason);
    if (mode === 'visit') return fail('This is a read-only visit. Take the chair to make decisions for this local draft.');
    if (!record) return fail('Create a companion town first.');
    const raw = snapshot(currentState); if (!raw) return fail('This town could not be safely saved. Keep this tab open.');
    const next = clone(record); next.towns[activeId] = raw;
    return { ok: true, next };
  }
  function loadHome(fallbackState = null) {
    activeId = 'home'; mode = 'manage';
    if (record && !blocked) { const check = unchanged(); if (check.ok) mirrorHome(); }
    return record && !blocked ? restore(record.towns.home) : restore(expectedHome) || fallbackState;
  }
  function save(state) {
    if (mode === 'visit') return { ok: true, skipped: true, reason: 'Read-only visit · the town is paused.' };
    const check = unchanged(); if (!check.ok) return check;
    const raw = snapshot(state); if (!raw) return fail('This town could not be safely saved. Keep this tab open.');
    if (!record) {
      try { storage.setItem(HOME_SAVE_KEY, raw); expectedHome = raw; return { ok: true, reason: 'Home saved on this device.' }; }
      catch { return fail('Device storage is unavailable. Keep this tab open; your latest changes are not saved.'); }
    }
    const next = clone(record); next.towns[activeId] = raw;
    return commit(next);
  }
  function create({ homeName = DEFAULT_NAMES.home, companionName = DEFAULT_NAMES.companion } = {}, currentState) {
    if (record || expectedRegistry !== null) return fail(blocked ? reason : 'Your two local towns are already linked.');
    if (!validName(homeName) || !validName(companionName)) return fail('Use a town name of 1–40 letters, numbers or punctuation, without angle brackets.');
    const home = snapshot(currentState); if (!home) return fail('Save a valid home town before creating a companion.');
    const next = { version: 1, revision: 1, names: { home: homeName.trim(), companion: companionName.trim() },
      towns: { home, companion: serialize(createGame()) }, previousHome: expectedHome, nextOfferId: 1, offers: [] };
    const result = commit(next);
    return result.ok ? { ...result, reason: 'Two local towns are linked. The companion begins with its own six founders.' } : result;
  }
  function switchTown(id, currentState, { visit = false } = {}) {
    if (!IDS.includes(id) || (id === 'companion' && !record)) return fail('Create that local town before visiting.');
    if (blocked) return fail(reason);
    if (mode !== 'visit') { const result = save(currentState); if (!result.ok) return result; }
    else { const result = unchanged(); if (!result.ok) return result; }
    const raw = record ? record.towns[id] : expectedHome;
    const state = restore(raw); if (!state) return fail('That town could not be read. Your current town is still open.');
    activeId = id; mode = visit ? 'visit' : 'manage';
    return { ok: true, state, id, mode, reason: visit ? `Visiting ${record.names[id]}. Time and building are paused.` : `${record?.names[id] || DEFAULT_NAMES[id]} is ready. Resume when you want the town to run.` };
  }
  function renameTown(id, name, currentState) {
    if (!IDS.includes(id) || !validName(name)) return fail('Use a town name of 1–40 letters, numbers or punctuation, without angle brackets.');
    const result = draft(currentState); if (!result.ok) return result;
    result.next.names[id] = name.trim(); return commit(result.next);
  }
  function proposeOffer({ give, request = {} } = {}, currentState) {
    const result = draft(currentState); if (!result.ok) return result;
    if (!validBag(give) || !validBag(request, true)) return fail('Choose whole amounts of goods to send. Knowledge cannot be traded.');
    if (Object.keys(give).some(key => Object.hasOwn(request, key))) return fail('Offer and request different goods so the exchange is clear.');
    if (result.next.offers.filter(offer => offer.status === 'pending').length >= 12) return fail('Resolve an existing offer before opening another.');
    if (Object.entries(give).some(([key, amount]) => currentState.resources[key] < amount)) return fail('This town does not have the goods offered. Nothing has been reserved.');
    const id = `o${result.next.nextOfferId++}`;
    result.next.offers.unshift({ id, from: activeId, to: other(activeId), give: clone(give), request: clone(request), status: 'pending', proposedDay: calendarDay(currentState) });
    const saved = commit(result.next);
    return saved.ok ? { ...saved, offerId: id, reason: 'Offer saved. Pass the device and open the receiving town to review and accept it. Goods stay in their stores until then.' } : saved;
  }
  function acceptOffer(id, currentState) {
    const result = draft(currentState); if (!result.ok) return result;
    const offer = result.next.offers.find(item => item.id === id);
    if (!offer || offer.status !== 'pending') return fail('This offer is already closed or no longer exists.');
    if (offer.to !== activeId) return fail('Only the receiving town can accept. Pass the device and open that town to review this offer.');
    const from = restore(result.next.towns[offer.from]), to = restore(result.next.towns[offer.to]);
    const fromCap = storageCapacity(from), toCap = storageCapacity(to);
    for (const key of TRADE_RESOURCES) {
      const give = offer.give[key] || 0, request = offer.request[key] || 0;
      if (!give && !request) continue;
      if (from.resources[key] < give || to.resources[key] < request) return fail('One town no longer has the promised goods. Nothing was transferred.');
      if (request > give && from.resources[key] - give + request > fromCap[key] || give > request && to.resources[key] - request + give > toCap[key]) return fail('One town needs more storage room for this exchange. Nothing was transferred.');
      from.resources[key] = from.resources[key] - give + request;
      to.resources[key] = to.resources[key] - request + give;
    }
    result.next.towns[offer.from] = serialize(from); result.next.towns[offer.to] = serialize(to); offer.status = 'accepted';
    prune(result.next);
    const saved = commit(result.next);
    return saved.ok ? { ...saved, state: restore(record.towns[activeId]), reason: 'Exchange complete. Both towns’ stores were updated together.' } : saved;
  }
  function closeOffer(id, currentState) {
    const result = draft(currentState); if (!result.ok) return result;
    const offer = result.next.offers.find(item => item.id === id);
    if (!offer || offer.status !== 'pending') return fail('This offer is already closed or no longer exists.');
    offer.status = offer.from === activeId ? 'withdrawn' : 'declined'; prune(result.next);
    const saved = commit(result.next);
    return saved.ok ? { ...saved, reason: 'Offer closed. No goods changed hands.' } : saved;
  }
  function prune(next) {
    let closed = 0; next.offers = next.offers.filter(offer => offer.status === 'pending' || ++closed <= 30);
  }
  function info(currentState = null) {
    const names = record?.names || DEFAULT_NAMES;
    const towns = (record ? IDS : ['home']).map(id => {
      const raw = record?.towns[id] || expectedHome;
      let state = currentState && id === activeId ? currentState : null;
      if (!state && raw) {
        if (summaries.get(id)?.raw !== raw) {
          let value = null; try { value = JSON.parse(raw); } catch {}
          summaries.set(id, { raw, state: value });
        }
        state = summaries.get(id).state;
      }
      return { id, name: names[id], day: state ? calendarDay(state) : 1, population: state?.population || 6, resources: { ...state?.resources } };
    });
    return { enabled: !!record, activeId, mode, readOnly: mode === 'visit', blocked, reason: reason || warning,
      towns, offers: clone(record?.offers || []), revision: record?.revision || 0 };
  }
  function release() { block('This tab released its save lock. Reload it before changing a town.'); releaseLease?.(); releaseLease = null; }
  return { loadHome, save, create, switchTown, renameTown, proposeOffer, acceptOffer, closeOffer, info, ready, release,
    get activeId() { return activeId; }, get readOnly() { return mode === 'visit'; },
    get canManage() { return mode !== 'visit' && !blocked && !leasePending; },
    get blocked() { return blocked; }, get lockPending() { return leasePending; }, get reason() { return reason || warning; } };
}
