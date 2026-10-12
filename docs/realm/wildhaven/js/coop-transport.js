import { deliveryChange, newRoom, validId, validTownName } from './coop-state.js';

export class CoopError extends Error {
  constructor(message, code = 'OFFLINE') { super(message); this.code = code; }
}
async function request(url, options = {}) {
  let response;
  try { response = await fetch(url, { ...options, signal: AbortSignal.timeout(12000) }); }
  catch { throw new CoopError('Connection interrupted. Reserved supplies will be checked again when you reconnect.'); }
  let body; try { body = await response.json(); } catch { throw new CoopError('The service response was incomplete. Reconnect to check progress.'); }
  if (!response.ok) {
    const code = body.error?.status || body.error?.message || String(response.status);
    const descriptions = { EMAIL_EXISTS: 'That email already has an account. Choose Sign in.', INVALID_LOGIN_CREDENTIALS: 'Check your email and password.',
      INVALID_PASSWORD: 'Check your email and password.', EMAIL_NOT_FOUND: 'Check your email and password.', INVALID_EMAIL: 'Enter a valid email address.',
      TOO_MANY_ATTEMPTS_TRY_LATER: 'Too many attempts. Wait a moment before trying again.', PERMISSION_DENIED: 'This action is no longer available. Check the invitation or sign in again.',
      UNAUTHENTICATED: 'Sign in again to reconnect. Your town and reserved supplies are safe.', RESOURCE_EXHAUSTED: 'The shared service is busy. Your town can keep playing; try reconnecting later.' };
    throw new CoopError(descriptions[code] || (String(code).startsWith('WEAK_PASSWORD') ? 'Use a password with at least 10 characters.' : 'The online action could not be confirmed. Reconnect to check it.'), code);
  }
  return body;
}
const json = value => ({ 'Content-Type': 'application/json', ...value });
const AUTH_KEY = 'island-town.coop.account.v1';
export function createCoopAuth(config, storage) {
  let session = null, refreshing = null;
  try { const saved = JSON.parse(storage.getItem(AUTH_KEY)); if (validId(saved?.uid) && typeof saved.refreshToken === 'string') session = saved; } catch {}
  function keep(s) { storage.setItem(AUTH_KEY, JSON.stringify(s)); session = s; return s; }
  async function signIn(email, password, create = false) {
    if (!config.apiKey) throw new CoopError('Online play is not configured in this build.', 'UNCONFIGURED');
    const body = await request(`https://identitytoolkit.googleapis.com/v1/accounts:${create ? 'signUp' : 'signInWithPassword'}?key=${config.apiKey}`, {
      method: 'POST', headers: json(), body: JSON.stringify({ email: email.trim(), password, returnSecureToken: true }) });
    return keep({ uid: body.localId, email: body.email, idToken: body.idToken, refreshToken: body.refreshToken, expiresAt: Date.now() + Number(body.expiresIn) * 1000 - 60000 });
  }
  async function token() {
    if (!session) throw new CoopError('Sign in to play together.', 'UNAUTHENTICATED');
    if (session.expiresAt > Date.now()) return session.idToken;
    if (!refreshing) refreshing = request(`https://securetoken.googleapis.com/v1/token?key=${config.apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: session.refreshToken }).toString()
    }).then(body => keep({ ...session, uid: body.user_id, idToken: body.id_token, refreshToken: body.refresh_token, expiresAt: Date.now() + Number(body.expires_in) * 1000 - 60000 })).finally(() => { refreshing = null; });
    return (await refreshing).idToken;
  }
  async function reset(email) {
    await request(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${config.apiKey}`, { method: 'POST', headers: json(), body: JSON.stringify({ requestType: 'PASSWORD_RESET', email: email.trim() }) });
  }
  return { signIn, token, reset, signOut() { storage.removeItem(AUTH_KEY); session = null; }, get user() { return session && { uid: session.uid, email: session.email }; } };
}

export function encode(value) {
  if (value === null) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'number') return Number.isSafeInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)])) } };
}
export function decode(value) {
  if ('nullValue' in value) return null;
  if ('timestampValue' in value) return new Date(value.timestampValue);
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('stringValue' in value) return value.stringValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decode);
  return Object.fromEntries(Object.entries(value.mapValue?.fields || {}).map(([k, v]) => [k, decode(v)]));
}
export function createCoopTransport(config, auth) {
  const base = `projects/${config.projectId}/databases/(default)/documents`;
  const endpoint = config.firestoreEndpoint || 'https://firestore.googleapis.com/v1';
  async function call(path, options = {}) {
    return request(`${endpoint}/${base}${path}`, { ...options, headers: json({ Authorization: `Bearer ${await auth.token()}` }) });
  }
  async function get(path) {
    try { const d = await call(`/${path}`); return { data: decode({ mapValue: { fields: d.fields || {} } }), updateTime: d.updateTime }; }
    catch (error) { if (error.code === 'NOT_FOUND') return null; throw error; }
  }
  function write(path, data, { fields, precondition, stamp = false } = {}) {
    const update = { name: `${base}/${path}`, fields: encode(data).mapValue.fields };
    const result = { update };
    if (fields) result.updateMask = { fieldPaths: fields };
    if (precondition) result.currentDocument = precondition;
    if (stamp) result.updateTransforms = [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }];
    return result;
  }
  const commit = writes => call(':commit', { method: 'POST', body: JSON.stringify({ writes }) });
  const profile = () => get(`players/${auth.user.uid}`);
  const profileWrite = (roomId, townId) => write(`players/${auth.user.uid}`, { roomId, townId });
  async function create({ roomId, uid, townId, name, invite }) {
    if (!validId(roomId) || !validId(invite) || !validTownName(name)) throw new CoopError('Choose a town name with 1–40 characters.', 'INVALID_ARGUMENT');
    const existing = await get(`rooms/${roomId}`).catch(error => { if (error.code === 'PERMISSION_DENIED') return null; throw error; });
    if (existing?.data.owner === uid && existing.data.ownerTown === townId) return existing.data;
    const room = newRoom({ uid, townId, name, invite });
    await commit([write(`rooms/${roomId}`, room, { precondition: { exists: false }, stamp: true }), profileWrite(roomId, townId)]);
    return (await get(`rooms/${roomId}`)).data;
  }
  async function join({ roomId, invite, townId, name }) {
    if (!validId(roomId) || !validId(invite) || !validTownName(name)) throw new CoopError('Use a complete invitation and a town name with 1–40 characters.', 'INVALID_ARGUMENT');
    const patch = { guest: auth.user.uid, guestTown: townId, guestName: name.trim(), joinProof: invite, invite: '' };
    // Joining is a blind, masked write. Only someone holding the current secret
    // can join; nonmembers cannot read a room or enumerate invitations.
    await commit([write(`rooms/${roomId}`, patch, { fields: Object.keys(patch), precondition: { exists: true }, stamp: true }), profileWrite(roomId, townId)]);
    return (await get(`rooms/${roomId}`)).data;
  }
  async function deliver(roomId, townId, pending) {
    const receiptPath = `rooms/${roomId}/receipts/${auth.user.uid}_${pending.id}`;
    for (let attempt = 0; attempt < 4; attempt++) {
      const receipt = await get(receiptPath); if (receipt) return receipt.data;
      const current = await get(`rooms/${roomId}`);
      if (!current) throw new CoopError('The shared project could not be found. Reserved supplies are kept for recovery.', 'NOT_FOUND');
      const change = deliveryChange(current.data, auth.user.uid, townId, pending);
      try {
        await commit([write(`rooms/${roomId}`, change.room, { precondition: { updateTime: current.updateTime }, stamp: true }),
          write(receiptPath, change.receipt, { precondition: { exists: false } })]);
        return change.receipt;
      } catch (error) {
        // Only retry concurrency conflicts here. A timeout leaves the same saved
        // operation pending; the next reconnect checks its receipt first.
        if (error.code === 'PERMISSION_DENIED') {
          // Rules may see the other delivery before the stale updateTime
          // precondition is evaluated. Recompute only if the room actually moved.
          const newer = await get(`rooms/${roomId}`);
          if (newer?.updateTime === current.updateTime) throw error;
        } else if (!['FAILED_PRECONDITION', 'ABORTED', 'ALREADY_EXISTS'].includes(error.code)) throw error;
      }
    }
    throw new CoopError('Both towns sent supplies together. Reconnect to check this delivery.', 'CONFLICT');
  }
  async function invitation(roomId, invite) {
    const patch = { invite, inviteExpires: new Date(Date.now() + 7 * 86400000) };
    await commit([write(`rooms/${roomId}`, patch, { fields: Object.keys(patch), stamp: true })]);
    return (await get(`rooms/${roomId}`)).data;
  }
  async function close(roomId) {
    await commit([write(`rooms/${roomId}`, { closed: true, invite: '' }, { fields: ['closed', 'invite'], stamp: true })]);
    return (await get(`rooms/${roomId}`)).data;
  }
  return { profile, create, join, deliver, invitation, close, room: async id => (await get(`rooms/${id}`))?.data,
    // Kept injectable for transport and adversarial service tests; no admin credential.
    get, write, commit };
}
