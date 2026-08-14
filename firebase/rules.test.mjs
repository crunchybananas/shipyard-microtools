// rules.test.mjs — the security rules ARE the server, so they get tested like one.
//
// Run against the Firestore emulator (no project, no billing, no network):
//   cd shipyard-microtools/firebase
//   npm i --no-save @firebase/rules-unit-testing firebase
//   firebase emulators:exec --only firestore "node --test rules.test.mjs"
//
// Every test below is an ATTACK the game's trust model depends on failing. If one
// of these starts passing, a stranger can drown somebody's island, forge somebody
// else's hand, or erase history — and no amount of client-side care would help,
// because the client is a text editor in the hands of whoever runs it.

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment, assertFails, assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';

let env;
const STACK = 'v1';
const markPath = (uid, r, k) => `stacks/${STACK}/marks/${uid}_${r}_${k}`;
const goodMark = (uid, over = {}) => ({ k: 'valve', r: 1, h: uid, n: 0, at: [1, 2, 3], ...over });

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'abyme-rules-test',
    firestore: { rules: readFileSync(new URL('./firestore.rules', import.meta.url), 'utf8') },
  });
});
after(async () => { if (env) await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

// ---------------- the happy path ----------------------------------------------

test('a signed-in hand may append its own mark', async () => {
  const db = env.authenticatedContext('handA').firestore();
  await assertSucceeds(setDoc(doc(db, markPath('handA', 1, 'valve')), goodMark('handA')));
});

test('anyone signed in may READ the shared stack', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), markPath('handA', 1, 'valve')), goodMark('handA'));
  });
  const db = env.authenticatedContext('handB').firestore();
  await assertSucceeds(getDocs(collection(db, `stacks/${STACK}/marks`)));
});

test('a mark with no place is legal — it simply cannot be found', async () => {
  const db = env.authenticatedContext('handA').firestore();
  await assertSucceeds(setDoc(doc(db, markPath('handA', 2, 'crank')), goodMark('handA', { r: 2, k: 'crank', at: null })));
});

// ---------------- IMPERSONATION -------------------------------------------------

test('a hand cannot write a mark as somebody else', async () => {
  const db = env.authenticatedContext('attacker').firestore();
  await assertFails(setDoc(doc(db, markPath('victim', 1, 'valve')), goodMark('victim')));
});

test('…nor claim another hand in the body while using its own id', async () => {
  const db = env.authenticatedContext('attacker').firestore();
  await assertFails(setDoc(doc(db, markPath('attacker', 1, 'valve')), goodMark('victim')));
});

test('an unauthenticated client can do nothing at all', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(setDoc(doc(db, markPath('nobody', 1, 'valve')), goodMark('nobody')));
  await assertFails(getDocs(collection(db, `stacks/${STACK}/marks`)));
});

// ---------------- DROWNING ------------------------------------------------------

test('an unknown kind is refused — it would have no draft and no meaning', async () => {
  const db = env.authenticatedContext('handA').firestore();
  await assertFails(setDoc(doc(db, markPath('handA', 1, 'flood')), goodMark('handA', { k: 'flood' })));
});

test('an absurd rung is refused', async () => {
  const db = env.authenticatedContext('handA').firestore();
  for (const r of [0, -1, 65, 999999]) {
    await assertFails(setDoc(doc(db, markPath('handA', r, 'valve')), goodMark('handA', { r })));
  }
});

test('a non-integer rung is refused', async () => {
  const db = env.authenticatedContext('handA').firestore();
  await assertFails(setDoc(doc(db, markPath('handA', 1, 'valve')), goodMark('handA', { r: 1.5 })));
});

// ---------------- GEOMETRY ------------------------------------------------------

test('coordinates outside the island are refused', async () => {
  const db = env.authenticatedContext('handA').firestore();
  for (const at of [[1e9, 0, 0], [0, 1e6, 0], [0, 0, -1e9], [401, 0, 0], [0, 121, 0]]) {
    await assertFails(setDoc(doc(db, markPath('handA', 1, 'valve')), goodMark('handA', { at })));
  }
});

test('a malformed position is refused', async () => {
  const db = env.authenticatedContext('handA').firestore();
  for (const at of [[1, 2], [1, 2, 3, 4], ['a', 'b', 'c'], 'here', 42]) {
    await assertFails(setDoc(doc(db, markPath('handA', 1, 'valve')), goodMark('handA', { at })));
  }
});

// ---------------- ERASURE -------------------------------------------------------

test('history cannot be rewritten, even by its author', async () => {
  const db = env.authenticatedContext('handA').firestore();
  await assertSucceeds(setDoc(doc(db, markPath('handA', 1, 'valve')), goodMark('handA')));
  await assertFails(setDoc(doc(db, markPath('handA', 1, 'valve')), goodMark('handA', { at: [9, 9, 9] })));
});

test('history cannot be deleted, by its author or anyone else', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), markPath('handA', 1, 'valve')), goodMark('handA'));
  });
  await assertFails(deleteDoc(doc(env.authenticatedContext('handA').firestore(), markPath('handA', 1, 'valve'))));
  await assertFails(deleteDoc(doc(env.authenticatedContext('handB').firestore(), markPath('handA', 1, 'valve'))));
});

test('a CARRY disposition cannot reach across and erase the shared record', async () => {
  // CARRY removes your marks from YOUR view of the stack. It must not be able to
  // delete them from the world — that is a local reading of the ledger, not a
  // licence to rewrite what other people have already inherited.
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), markPath('handA', 1, 'dive')), goodMark('handA', { k: 'dive' }));
  });
  const db = env.authenticatedContext('handA').firestore();
  await assertFails(deleteDoc(doc(db, markPath('handA', 1, 'dive'))));
});

// ---------------- SHAPE / COST --------------------------------------------------

test('extra fields are refused — the document shape is closed', async () => {
  const db = env.authenticatedContext('handA').firestore();
  await assertFails(setDoc(doc(db, markPath('handA', 1, 'valve')),
    { ...goodMark('handA'), payload: 'x'.repeat(10000) }));
});

test('a missing required field is refused', async () => {
  const db = env.authenticatedContext('handA').firestore();
  const m = goodMark('handA'); delete m.k;
  await assertFails(setDoc(doc(db, `stacks/${STACK}/marks/handA_1_valve`), m));
});

test('the document id must match the mark — one doc per hand+rung+kind', async () => {
  const db = env.authenticatedContext('handA').firestore();
  // right mark, wrong id: this is the cap that stops one hand writing unboundedly
  await assertFails(setDoc(doc(db, `stacks/${STACK}/marks/anything-i-like`), goodMark('handA')));
  await assertFails(setDoc(doc(db, markPath('handA', 2, 'valve')), goodMark('handA', { r: 1 })));
});

test('nothing outside the marks collection is reachable', async () => {
  const db = env.authenticatedContext('handA').firestore();
  await assertFails(setDoc(doc(db, 'secrets/whatever'), { a: 1 }));
  await assertFails(getDoc(doc(db, 'secrets/whatever')));
  await assertFails(setDoc(doc(db, `stacks/${STACK}`), { a: 1 }));
});
