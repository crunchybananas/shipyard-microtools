// ledger-firebase.js — the HTTP source (STACK.md §8): the rung above you stops
// being a recording of yourself and becomes other people.
//
// This is a SOURCE, the same shape as localSource() in ledger.js, and that is the
// whole design: every consumer above it — the draft, the evidence, the eras, the
// dispositions — already reads through that interface, so nothing else in the game
// changes when strangers arrive.
//
// THERE IS NO NETCODE HERE ON PURPOSE. Nobody is ever in your world at the same
// time as you; clients never reconcile. A mark is a fact that already happened, so
// a 400 ms round trip is invisible and there is no tick rate, no interpolation and
// no lag compensation. This is Dark Souls bloodstains, not a shooter.
//
// RULES ARE THE ONLY SERVER. There is no backend code — Firestore security rules
// are the entire trust boundary, and they mirror the sanitation contract in
// ledger.js field for field (see firestore.rules). The client sanitizes on the way
// IN as well, because a rule can be updated and a cached client cannot: both ends
// distrust the wire.
//
// OFFLINE IS NOT A FALLBACK, IT IS THE FLOOR. Every read is wrapped so the game
// NEVER blocks on the network and never gets worse without it: if Firebase is
// slow, unreachable, unconfigured, or blocked by an extension, you get the local
// stack and play on. The island must be complete with the wire cut.

import { emptyLedger, sanitizeLedger, packLedger, LEDGER_KEY, HAND_KEY, MAX_MARKS_PER_RUNG } from './ledger.js';

// The one place the shared world is named. Everybody's rung 2 is the SAME pool —
// one ocean, which is the thesis. Bump this to fork a fresh stack (a new season,
// a playtest cohort) without touching a line of game code.
export const STACK_ID = 'v1';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';
const FETCH_TIMEOUT_MS = 4000;
const MAX_RUNG = 64;

// Never let a hung request hold the game. Anything slow is treated as offline.
function withTimeout(promise, ms = FETCH_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('stack: timeout')), ms)),
  ]);
}

// Load the SDK only if a config exists. The game ships the same either way, so a
// build with no Firebase config never pays a byte or a DNS lookup for it.
async function connect(config) {
  const [{ initializeApp }, auth, store] = await Promise.all([
    import(/* @vite-ignore */ `${SDK}/firebase-app.js`),
    import(/* @vite-ignore */ `${SDK}/firebase-auth.js`),
    import(/* @vite-ignore */ `${SDK}/firebase-firestore.js`),
  ]);
  const app = initializeApp(config);
  const a = auth.getAuth(app);
  // ANONYMOUS auth, and nothing more. The uid becomes the hand id: unique per
  // player, survives a cleared localStorage, and carries no identity whatsoever —
  // we never ask for, store, or transmit anything about who anyone is.
  const cred = await auth.signInAnonymously(a);
  return { store, db: store.getFirestore(app), uid: cred.user.uid };
}

// firestoreSource(config, io) — a drop-in for localSource(io).
//
// `io` is the same storage shim, used for the OFFLINE MIRROR: every remote read is
// cached locally so a second launch without a network still shows the stack you
// last saw, and every local write is kept so nothing you did is lost to a failed
// push. The mirror is what makes the online build degrade to exactly the offline
// build instead of to an empty island.
export function firestoreSource(config, io) {
  let led = null;
  let conn = null;
  let connecting = null;
  let flushing = false;   // one flush at a time, or a burst of acts double-writes
  const pending = [];

  const readMirror = () => {
    let raw = null;
    try { raw = JSON.parse(io.get(LEDGER_KEY) || 'null'); } catch (_) { raw = null; }
    return sanitizeLedger(raw);
  };
  const writeMirror = () => {
    try { io.set(LEDGER_KEY, JSON.stringify(packLedger(led || emptyLedger()))); } catch (_) { /* private mode */ }
  };

  const ensure = () => {
    if (conn) return Promise.resolve(conn);
    if (!connecting) {
      connecting = withTimeout(connect(config))
        .then((c) => { conn = c; return c; })
        .catch((e) => { connecting = null; throw e; });
    }
    return connecting;
  };

  // CONNECT EAGERLY. The uid IS the hand id, and an act recorded before auth
  // resolves gets filed locally under the offline id while flush() stamps the real
  // uid on the server — the same act under two identities, which double-counts its
  // draft on the next merge and makes CARRY unable to find its own marks. Rung 1
  // never syncs (the surface inherits nothing), so waiting for a read to force the
  // connection meant the ENTIRE surface chain was recorded under the wrong hand.
  // Caught by playing the deployed build, not by any assertion.
  ensure().then(() => reconcileHand()).catch(() => { /* offline: the local id stands */ });

  // Any mark already recorded under the offline id belongs to this uid — it was the
  // same person, the same session, seconds ago. Rewrite them once the uid lands.
  function reconcileHand() {
    if (!conn || !led) return;
    const local = io.get(HAND_KEY);
    if (!local || local === conn.uid) return;
    let changed = 0;
    for (const m of led.marks) if (m.h === local) { m.h = conn.uid; changed++; }
    if (changed) writeMirror();
  }

  return {
    // The hand id, once we have one. Null only in the moments before auth resolves
    // (or forever, offline), and world.js falls back to the local id there.
    uid: () => (conn ? conn.uid : null),

    // Synchronous: returns the mirror immediately so the game can start rendering.
    // The network fills in behind it via sync().
    load() {
      if (!led) led = readMirror();
      return led;
    },

    // Pull the marks for the rungs ABOVE `rung` — the only ones that can affect you.
    // Never throws: a failure leaves the mirror in place and the caller none the wiser.
    async sync(rung) {
      const top = Math.max(1, Math.min(rung | 0, MAX_RUNG));
      if (top <= 1) return this.load();          // the surface inherits nothing; save the read
      try {
        const { store, db } = await ensure();
        const { collection, query, where, orderBy, limit, getDocs } = store;
        const q = query(
          collection(db, 'stacks', STACK_ID, 'marks'),
          where('r', '<', top),
          orderBy('r'),
          limit(MAX_MARKS_PER_RUNG * 4),          // a hard read cap: cost is bounded per rung
        );
        const snap = await withTimeout(getDocs(q));
        const remote = [];
        snap.forEach((d) => { const m = d.data(); remote.push({ k: m.k, r: m.r, h: m.h, n: m.n || 0, at: m.at || null }); });
        // MERGE, never replace: your own marks are authoritative for you and may not
        // have reached the server yet. Sanitize the union — the remote half is
        // untrusted even though the rules already vetted it.
        const local = (led || readMirror()).marks;
        const merged = sanitizeLedger({
          marks: [...local, ...remote],
          sealed: (led || {}).sealed || [],
          open: (led || {}).open || [],
        });
        led = merged;
        writeMirror();
      } catch (_) {
        // offline, unconfigured, blocked, or slow — the island does not care
        if (!led) led = readMirror();
      }
      return led;
    },

    // Record locally FIRST (so the game is never waiting on a socket to feel the
    // consequence of an act), then push. A failed push is queued and retried on the
    // next successful call rather than lost.
    push(mark) {
      if (!mark) return;
      writeMirror();
      pending.push(mark);
      this.flush();
    },

    async flush() {
      if (!pending.length || flushing) return;
      flushing = true;
      try {
        const { store, db, uid } = await ensure();
        const { doc, setDoc } = store;
        while (pending.length) {
          const m = pending[0];
          // DETERMINISTIC id, and the rules require exactly this shape. It is what
          // makes "turning the valve forty times is one displacement" true on the
          // SERVER as well as in the client, and it caps how many documents any one
          // hand can ever create (kinds × rungs) without a rate limiter.
          const id = `${uid}_${m.r | 0}_${m.k}`;
          try {
            await withTimeout(setDoc(doc(db, 'stacks', STACK_ID, 'marks', id), {
              k: m.k, r: m.r | 0, h: uid, n: m.n | 0,
              at: Array.isArray(m.at) ? m.at.map(Number) : null,
            }));
            pending.shift();                     // only drop it once it is really there
          } catch (err) {
            // A DENIAL IS PERMANENT and must not be retried forever: the rules
            // forbid update, so this means the mark is already on the server (the
            // idempotent case — nothing to do) or it is invalid and always will be.
            // Either way, drop it. A network/timeout error is different: keep it
            // queued and try again on the next act.
            if (String(err && err.code) === 'permission-denied') { pending.shift(); continue; }
            break;
          }
        }
      } catch (_) {
        /* not connected — everything stays queued */
      } finally {
        flushing = false;
        // never let an unreachable server grow the queue without bound
        if (pending.length > 256) pending.splice(0, pending.length - 256);
      }
    },

    clear() {
      led = emptyLedger();
      writeMirror();
      // NOTE: deliberately local-only. Clearing YOUR view of the stack must never
      // delete other people's marks from the shared world — there is no client path
      // to destroying anyone else's record, and the rules forbid it besides.
    },
  };
}
