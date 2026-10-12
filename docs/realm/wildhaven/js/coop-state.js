// The paid-delivery journal lives inside the town save, alongside its inventory.
// No credential or other player's town is stored here.
export const COOP_COST = Object.freeze({ wood: 60, stone: 40, food: 40 });
export const COOP_KEYS = Object.freeze(Object.keys(COOP_COST));
export const emptyCargo = () => ({ wood: 0, stone: 0, food: 0 });
export const coopId = () => crypto.randomUUID().replaceAll('-', '');
export const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{20,128}$/.test(value);
export const validTownName = value => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 40 && !/[<>\x00-\x1f\x7f]/.test(value);
export const validCargo = bag => bag && typeof bag === 'object' && !Array.isArray(bag) && Object.keys(bag).length === 3 && COOP_KEYS.every(k => Number.isInteger(bag[k]) && bag[k] >= 0 && bag[k] <= COOP_COST[k]);
export const totalCargo = bag => COOP_KEYS.reduce((n, k) => n + bag[k], 0);
export const completeCargo = bag => COOP_KEYS.every(k => bag[k] === COOP_COST[k]);

export function restoreCoop(value) {
  if (value === undefined) return undefined;
  if (!value || value.version !== 1 || !validId(value.townId) || typeof value.storehouse !== 'boolean'
    || !Number.isInteger(value.sequence) || value.sequence < 0 || value.sequence > 10000) throw new Error('Invalid co-op save');
  const link = value.link;
  if (link !== null && (!link || !validId(link.roomId) || !validId(link.uid) || !validTownName(link.name))) throw new Error('Invalid co-op link');
  const p = value.pending;
  if (p !== null && (!p || !link || !validId(p.id) || !validCargo(p.requested) || totalCargo(p.requested) === 0
    || p.sequence !== value.sequence + 1)) throw new Error('Invalid pending delivery');
  const draft = value.draft;
  if (draft !== null && (!draft || link || !validId(draft.roomId) || !validId(draft.invite) || !validId(draft.uid)
    || !validTownName(draft.name) || !['create','join'].includes(draft.kind))) throw new Error('Invalid co-op draft');
  return { version: 1, townId: value.townId, storehouse: value.storehouse, sequence: value.sequence,
    link: link && { roomId: link.roomId, uid: link.uid, name: link.name },
    pending: p && { id: p.id, requested: { ...p.requested }, sequence: p.sequence }, draft: draft && { ...draft } };
}
export function ensureCoop(state) {
  return state.coop ||= { version: 1, townId: coopId(), storehouse: false, sequence: 0, link: null, pending: null, draft: null };
}
export function roomSeat(room, uid, townId) {
  if (room?.owner === uid && room.ownerTown === townId) return 'owner';
  if (room?.guest === uid && room.guestTown === townId) return 'guest';
  return null;
}
export function newRoom({ uid, townId, name, invite, now = Date.now() }) {
  return { version: 1, owner: uid, guest: '', ownerTown: townId, guestTown: '', ownerName: name.trim(), guestName: '',
    invite, inviteExpires: new Date(now + 7 * 86400000), joinProof: '', closed: false,
    totals: emptyCargo(), supplied: { owner: emptyCargo(), guest: emptyCargo() }, sequence: { owner: 0, guest: 0 },
    completed: false, revision: 0, lastOperation: '', lastActor: '', updatedAt: new Date(now) };
}
export function deliveryChange(room, uid, townId, pending) {
  const seat = roomSeat(room, uid, townId);
  if (!seat) throw new Error('This town is not a member of that partnership.');
  if (!validCargo(pending.requested) || totalCargo(pending.requested) === 0) throw new Error('Choose a whole amount of supplies.');
  if (room.sequence[seat] + 1 !== pending.sequence) throw new Error('This town save is older than its last online delivery. Restore the latest town backup before sending more.');
  const accepted = Object.fromEntries(COOP_KEYS.map(k => [k, room.closed || !room.guest ? 0 : Math.min(pending.requested[k], COOP_COST[k] - room.totals[k])]));
  const next = structuredClone(room);
  for (const k of COOP_KEYS) { next.totals[k] += accepted[k]; next.supplied[seat][k] += accepted[k]; }
  next.sequence[seat]++; next.revision++; next.lastOperation = pending.id; next.lastActor = uid;
  next.completed = completeCargo(next.totals);
  const receipt = { uid, townId, id: pending.id, requested: { ...pending.requested }, accepted, sequence: pending.sequence, revision: next.revision };
  return { room: next, receipt };
}

// save() must synchronously persist this exact state through the existing writer
// lease. Roll back in memory if the durable reservation cannot be written.
export function reserveDelivery(state, requested, save, id = coopId()) {
  const coop = ensureCoop(state);
  if (!coop.link || coop.pending) return { ok: false, reason: 'Finish reconnecting the previous delivery first.' };
  if (!validCargo(requested) || !totalCargo(requested)) return { ok: false, reason: 'Choose whole amounts of timber, stone or food.' };
  if (COOP_KEYS.some(k => state.resources[k] < requested[k])) return { ok: false, reason: 'Your town does not have those supplies.' };
  const before = { ...state.resources };
  for (const k of COOP_KEYS) state.resources[k] -= requested[k];
  coop.pending = { id, requested: { ...requested }, sequence: coop.sequence + 1 };
  const result = save(state);
  if (!result.ok) { state.resources = before; coop.pending = null; }
  return result;
}
export function settleDelivery(state, receipt, save) {
  const c = state.coop, p = c?.pending;
  if (!p) return { ok: true, skipped: true };
  if (!receipt || receipt.id !== p.id || receipt.uid !== c.link.uid || receipt.townId !== c.townId || receipt.sequence !== p.sequence
    || !validCargo(receipt.accepted) || !validCargo(receipt.requested)
    || COOP_KEYS.some(k => receipt.requested[k] !== p.requested[k] || receipt.accepted[k] > p.requested[k])) return { ok: false, reason: 'The delivery receipt could not be verified. Your reserved supplies are kept for recovery.' };
  const before = { ...state.resources }, sequence = c.sequence;
  // Refunds may temporarily exceed storage. Production waits; no goods vanish.
  for (const k of COOP_KEYS) state.resources[k] += p.requested[k] - receipt.accepted[k];
  c.sequence = p.sequence; c.pending = null;
  const result = save(state);
  if (!result.ok) { state.resources = before; c.sequence = sequence; c.pending = p; }
  return result;
}
export function claimStorehouse(state, room, uid, save) {
  const c = state.coop;
  if (!c?.link || !roomSeat(room, uid, c.townId) || !room.completed || c.storehouse) return { ok: true, skipped: true };
  c.storehouse = true;
  const result = save(state); if (!result.ok) c.storehouse = false;
  return result;
}

// A newer confirmed backup can recover an obsolete reservation from a second
// device. Keep the old save export; never discard a journal for an unrelated town.
export function canImportCoop(current, replacement) {
  const c = current.coop, next = replacement.coop;
  if (c?.draft) return { ok: false, reason: 'Reconnect and finish the pending invitation before importing a backup.' };
  if (c?.pending && !(next?.townId === c.townId && next.link?.roomId === c.link.roomId
      && next.link?.uid === c.link.uid && !next.pending && !next.draft && next.sequence >= c.pending.sequence)) {
    return { ok: false, reason: 'Finish the reserved delivery first, or import a newer confirmed backup of this same town.' };
  }
  if (c?.link && next?.townId !== c.townId) return { ok: false, reason: 'End and unlink the current partnership before replacing this town.' };
  return { ok: true };
}
