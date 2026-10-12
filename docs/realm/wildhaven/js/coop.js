import { coopId, ensureCoop, roomSeat, reserveDelivery, settleDelivery, claimStorehouse, validTownName, validId } from './coop-state.js';
import { createCoopAuth, createCoopTransport } from './coop-transport.js';

export function createCoop({ config, storage, getState, canUse, save, onChange = () => {}, auth: suppliedAuth, remote: suppliedRemote }) {
  const auth = suppliedAuth || createCoopAuth(config, storage), remote = suppliedRemote || createCoopTransport(config, auth);
  let room = null, roomId = null, busy = false, checking = false, checkTask = null, message = '', connected = false, lastChecked = 0, recovery = null;
  function current(s) { return canUse() && getState() === s; }
  function persist(s, run) {
    if (!current(s)) throw new Error('Return to your home town to continue.');
    const before = structuredClone(s.coop); run();
    const result = save(s); if (!result.ok) { s.coop = before; throw new Error(result.reason); }
    onChange();
  }
  async function run(fn) {
    if (busy) return;
    busy = true; message = ''; onChange();
    try { if (checkTask) await checkTask; await fn(); }
    catch (error) { message = error.message; connected = false; }
    finally { busy = false; onChange(); }
  }
  async function refresh() {
    if (!auth.user || !canUse()) return;
    const s = getState(), c = ensureCoop(s);
    const profile = await remote.profile();
    if (!current(s)) return;
    recovery = null;
    if (profile && profile.data.townId !== c.townId) {
      const previous = await remote.room(profile.data.roomId);
      if (!current(s)) return;
      if (!previous?.closed) {
        recovery = 'This account is linked to a town saved on another device. Import its latest town backup here, or sign in with a different account. Playing the same town on two devices at once is not supported.';
        room = null; connected = true; lastChecked = Date.now(); return;
      }
    }
    if (profile?.data.townId === c.townId && (!c.link || c.draft)) {
      const found = await remote.room(profile.data.roomId);
      if (!current(s)) return;
      if (found && (!found.closed || c.draft?.roomId === profile.data.roomId)) {
        const seat = roomSeat(found, auth.user.uid, c.townId);
        persist(s, () => { c.link = { uid: auth.user.uid, roomId: profile.data.roomId, name: found[`${seat}Name`] }; c.draft = null; });
      }
    }
    if (c.link && c.link.uid !== auth.user.uid) { recovery = 'Sign in with the account that linked this town. Your town save has been kept.'; return; }
    if (c.link) {
      if (c.pending) {
        const receipt = await remote.deliver(c.link.roomId, c.townId, c.pending);
        if (!current(s)) return;
        const result = settleDelivery(s, receipt, save); if (!result.ok) throw new Error(result.reason);
      }
      const next = await remote.room(c.link.roomId); if (!current(s)) return;
      if (!roomSeat(next, auth.user.uid, c.townId)) throw new Error('This town no longer matches the shared record. Keep this save and reconnect.');
      room = next; roomId = c.link.roomId;
      const seat = roomSeat(room, auth.user.uid, c.townId);
      if (room.sequence[seat] !== c.sequence) recovery = 'This town save is older than its latest online delivery. Restore the latest town backup before sending more supplies.';
      const result = claimStorehouse(s, room, auth.user.uid, save); if (!result.ok) throw new Error(result.reason);
    } else { room = null; roomId = null; }
    connected = true; lastChecked = Date.now();
  }
  async function draft() {
    const s = getState(), c = ensureCoop(s), d = c.draft;
    if (!d || !current(s)) return;
    await refresh(); // Recover an already-committed create/join before retrying it.
    if (!current(s) || !c.draft) return;
    if (recovery) throw new Error(recovery);
    if (d.uid !== auth.user.uid) throw new Error('Sign in with the account that started this invitation.');
    const result = await remote[d.kind]({ ...d, townId: c.townId });
    if (!current(s)) return;
    persist(s, () => { c.link = { uid: d.uid, roomId: d.roomId, name: d.name }; c.draft = null; c.sequence = 0; });
    room = result; roomId = d.roomId; await refresh();
  }
  async function begin(kind, name, invitation) {
    if (!canUse() || !auth.user) throw new Error('Open your home town and sign in first.');
    if (!validTownName(name)) throw new Error('Use a town name with 1–40 characters.');
    const s = getState(), c = ensureCoop(s);
    if (c.link || c.pending || c.draft) throw new Error('Finish the existing partnership action first.');
    let id = coopId(), invite = coopId();
    if (kind === 'join') {
      const parsed = parseInvitation(invitation); if (!parsed) throw new Error('Paste the full invitation link or code.');
      id = parsed.roomId; invite = parsed.invite;
    }
    persist(s, () => { c.draft = { kind, roomId: id, invite, uid: auth.user.uid, name: name.trim() }; });
    await draft();
  }
  function info() {
    const c = getState().coop;
    return { configured: !!config.apiKey, user: auth.user, room: roomId === c?.link?.roomId ? room : null,
      busy: busy || checking, message, connected, lastChecked, recovery, local: c, available: canUse() };
  }
  return {
    info, signIn: (email, password, create) => run(async () => { await auth.signIn(email, password, create); await refresh(); }),
    reset: email => run(async () => { await auth.reset(email); message = 'If this email has an account, a password reset link will arrive shortly.'; }),
    signOut: () => run(async () => { if (getState().coop?.pending || getState().coop?.draft) throw new Error('Reconnect and finish the pending action before signing out.'); auth.signOut(); room = null; roomId = null; connected = false; recovery = null; }),
    create: name => run(() => begin('create', name)), join: (name, invitation) => run(() => begin('join', name, invitation)),
    reconnect: () => run(async () => { await refresh(); if (getState().coop?.draft) await draft(); }),
    cancelDraft: () => run(async () => {
      await refresh(); const s = getState(); if (s.coop?.draft) persist(s, () => { s.coop.draft = null; });
    }),
    contribute: cargo => run(async () => {
      await refresh();
      const s = getState();
      if (!current(s) || recovery || !room || room.closed || !room.guest || room.completed) throw new Error(recovery || 'Wait for both towns to join an unfinished project.');
      const result = reserveDelivery(s, cargo, save); if (!result.ok) throw new Error(result.reason);
      onChange(); await refresh(); message = 'Delivery confirmed. Both towns see the updated supplies.';
    }),
    changeInvitation: revoke => run(async () => { const s = getState(); if (!current(s) || !s.coop?.link) return;
      const next = await remote.invitation(s.coop.link.roomId, revoke ? '' : coopId()); if (current(s)) { room = next; connected = true; message = revoke ? 'Invitation revoked.' : 'New invitation ready. Previous links no longer work.'; } }),
    closePartnership: () => run(async () => {
      await refresh(); const s = getState(), c = s.coop; if (!current(s) || !c?.link || c.pending) return;
      const next = await remote.close(c.link.roomId); if (!current(s)) return;
      const result = claimStorehouse(s, next, auth.user.uid, save); if (!result.ok) throw new Error(result.reason);
      room = next; message = 'Partnership ended. Confirmed progress and earned storage are kept.';
    }),
    unlink: () => run(async () => { await refresh(); const s = getState(); if (!current(s) || !room?.closed || s.coop.pending) return;
      persist(s, () => { s.coop.link = null; s.coop.sequence = 0; }); room = null; roomId = null;
    }),
    async tick() {
      if (busy || checking || !canUse() || !auth.user || Date.now() - lastChecked < 15000 || document.hidden) return;
      checking = true;
      checkTask = (async () => {
        try { await refresh(); message = ''; } catch (error) { connected = false; message = error.message; }
        finally { lastChecked = Date.now(); checking = false; onChange(); }
      })();
      await checkTask; checkTask = null;
    }
  };
}
export function parseInvitation(text) {
  if (typeof text !== 'string') return null;
  let value = text.trim();
  try { if (value.includes('://')) value = new URLSearchParams(new URL(value).hash.slice(1)).get('join') || ''; } catch { return null; }
  const [roomId, invite, extra] = value.split('.'); return !extra && validId(roomId) && validId(invite) ? { roomId, invite } : null;
}
