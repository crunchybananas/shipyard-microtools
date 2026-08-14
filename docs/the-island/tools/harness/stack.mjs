// stack.mjs — the STACK regression: the ledger, the draft, and their persistence
// (loop/STACK.md slices 1–2). Runs in the gate alongside walk.mjs.
// Plays the real surface chain through the real hotspots, then asserts the ledger
// recorded it and that rung 2 inherits the draft.
export default async function (h) {
  const R = { pass: [], fail: [] };
  const ok = (name, cond, extra) => (cond ? R.pass : R.fail).push(name + (cond ? '' : ' :: ' + JSON.stringify(extra)));
  const URL = 'http://127.0.0.1:' + (process.env.SERVE_PORT || 8642) + '/the-island/?debug&mute';

  const ready = async () => {
    for (let i = 0; i < 40; i++) {
      if (await h.evaluate(`typeof ABYME !== 'undefined' && !!document.getElementById('btn-begin')`).catch(() => false)) return;
      await h.wait(1);
    }
    throw new Error('app never booted');
  };

  await h.navigate(URL); await ready();
  // clean slate: no save AND no stack — this run must build the ledger from zero
  await h.evaluate(`localStorage.setItem('abyme-muted','1');
    ['abyme-save-v1','abyme-ledger-v1','abyme-hand-v1'].forEach(k => localStorage.removeItem(k)); 1`);
  await h.navigate(URL); await ready();
  await h.evaluate(`window.__errs=[]; addEventListener('error', e => window.__errs.push(e.message));
    document.getElementById('btn-begin').click(); 1`);
  await h.wait(2);
  await h.evaluate(`ABYME.setIntroT(99); 1`);
  await h.wait(2.5);

  const fresh = await h.evaluate(`(() => ABYME.state().stack)()`);
  ok('fresh run: surface is dry, no marks', fresh.draft === 0 && fresh.marks === 0, fresh);
  ok('fresh run: a hand id was minted', /^[0-9a-f]{8}$/.test(fresh.hand), fresh);

  // play the real surface chain through real hotspots
  const played = await h.evaluate(`(() => {
    const W = ABYME.W, g = ABYME.game, hs = (id) => g.interact.hotspots.find(s => s.id === id);
    W.timeDrift = 0;
    // WALK to each instrument before touching it. A mark records where the PLAYER
    // stood, so invoking hotspots remotely from the spawn files the whole chain at
    // the wake-up beach — which is under water one rung down, so every scuff would
    // be skipped and slice 4 would look broken while being correct.
    const at = (x, z) => ABYME.tp(x, z, 0, 0);
    at(-82.7, -38.9); hs('valve').onClick();        // the sea moved
    at(-86.7, -41.1); hs('crank').onDrag ? hs('crank').onDrag(0.5) : g.flag('crankUsed');
    W.tide = W.tideTarget = 0;
    at(118, -176);    hs('chest').onClick(); hs('chest').onClick();   // chest + ruler
    at(-85, -40);     hs('crack').onClick();        // ruler laid → the bridge
    at(135, -146);    g.flag('birdSolved');         // the stones' five notes
    at(124, -150);    hs('lensItem') && hs('lensItem').onClick();
    at(-85, -40);     hs('lensSlot') && hs('lensSlot').onClick();     // lens set in the model
    at(97, 32);       g.flag('shadowRevealed'); g.flag('hatchOpen');
    at(97, 19.5);     hs('plumb') && hs('plumb').onClick();
    at(-85, -40);     hs('hook') && hs('hook').onClick();             // plumb hung
    return ABYME.state().stack;
  })()`);
  ok('the chain recorded marks', played.marks >= 7, played);
  ok('surface itself stays dry (nobody is upstream of rung 1)', played.draft === 0, played);

  const inherited = await h.evaluate(`(() => {
    const s = { l1: ABYME.draft(1), l2: ABYME.draft(2), l3: ABYME.draft(3),
                tide1: ABYME.tideAt(1), tide2: ABYME.tideAt(2), ev2: ABYME.evidence(2).length };
    return s;
  })()`);
  ok('rung 2 inherits a real draft', inherited.l2 > 0.08 && inherited.l2 < 0.3, inherited);
  ok('draft accumulates downward', inherited.l3 >= inherited.l2 && inherited.l2 > inherited.l1, inherited);
  ok('rung 2 tide = baseline 1.35 + draft', Math.abs(inherited.tide2 - (1.35 + inherited.l2)) < 1e-6, inherited);
  ok('rung 2 has evidence to render', inherited.ev2 >= 5, inherited);

  // the ledger must OUTLIVE the save — "Begin again" wipes the run, not the stack
  const after = await h.evaluate(`(() => { ABYME.W.level = 1; localStorage.removeItem('abyme-save-v1');
    return { save: localStorage.getItem('abyme-save-v1'), led: JSON.parse(localStorage.getItem('abyme-ledger-v1')||'null') }; })()`);
  ok('the stack survives a wiped save', after.save === null && after.led && after.led.marks.length >= 7, after);

  // and it must survive a real reload
  await h.navigate(URL); await ready();
  await h.evaluate(`document.getElementById('btn-begin').click(); 1`);
  await h.wait(2);
  await h.evaluate(`ABYME.setIntroT(99); 1`);
  await h.wait(2);
  const reloaded = await h.evaluate(`(() => ({ stack: ABYME.state().stack, d2: ABYME.draft(2), hand: ABYME.state().stack.hand }))()`);
  ok('the stack reloads from storage', reloaded.d2 > 0.08, reloaded);
  ok('the same hand persists across runs', reloaded.hand === fresh.hand, { a: fresh.hand, b: reloaded.hand });

  // --- slice 3: the draft is FELT — the arrival tide carries it ----------------
  const felt = await h.evaluate(`(() => {
    const W = ABYME.W;
    const base = 1.35, d = ABYME.draft(2);
    ABYME.goLevel(2);
    const withDraft = W.tide;
    // …and with a clean stack the same rung sits exactly at its authored ring
    localStorage.removeItem('abyme-ledger-v1');
    return { d: +d.toFixed(4), withDraft: +withDraft.toFixed(4), base, level: W.level };
  })()`);
  ok('arriving at rung 2 lands on baseline + draft',
    Math.abs(felt.withDraft - (felt.base + felt.d)) < 1e-6, felt);
  ok('the draft actually raises the water (not a no-op)', felt.withDraft > felt.base + 0.05, felt);

  // a clean stack must still land EXACTLY on the authored waterline — the feature
  // must not drift the authored game for a first-time player
  await h.navigate(URL); await ready();
  await h.evaluate(`document.getElementById('btn-begin').click(); 1`);
  await h.wait(2);
  await h.evaluate(`ABYME.setIntroT(99); 1`);
  await h.wait(2);
  const clean = await h.evaluate(`(() => { ABYME.goLevel(3); return { tide: +ABYME.W.tide.toFixed(4), draft: ABYME.draft(3) }; })()`);
  ok('a clean stack lands exactly on the authored tide', clean.tide === 1.65 && clean.draft === 0, clean);

  // --- the arrival must never spawn the camera underwater ----------------------
  // The draft raises the sea; the authored spawns were tuned to the authored sea.
  // At L2 the eye clears the surface by ~27 cm, so half a metre of inherited water
  // put the camera UNDER it, in a game with no swimming. Every rung, worst case.
  const dry = await h.evaluate(`(() => {
    const W = ABYME.W, P = ABYME.player, out = [];
    // same rule as above: WALK to each instrument, or the whole chain files at the
    // beach and slice 4 has nothing above water to show
    const chain = () => { const g = ABYME.game, hs = (id) => g.interact.hotspots.find(s => s.id === id);
      const at = (x, z) => ABYME.tp(x, z, 0, 0);
      at(-82.7, -38.9); hs('valve')?.onClick(); at(-86.7, -41.1); g.flag('crankUsed');
      W.tide = W.tideTarget = 0;
      at(118, -176); hs('chest')?.onClick(); hs('chest')?.onClick();
      at(-85, -40); hs('crack')?.onClick();
      at(135, -146); g.flag('birdSolved');
      at(124, -150); hs('lensItem')?.onClick();
      at(-85, -40); hs('lensSlot')?.onClick();
      at(97, 32); g.flag('shadowRevealed'); g.flag('hatchOpen');
      at(97, 19.5); hs('plumb')?.onClick();
      at(-85, -40); hs('hook')?.onClick(); };
    ABYME.clearStack(); ABYME.goLevel(1); chain();       // one full hand's worth of displacement
    for (const n of [2, 3, 4]) {
      ABYME.goLevel(n);
      const eye = P.pos.y + P.eye, sea = -4.2 * (1 - W.tide);
      out.push({ n, clearance: +(eye - sea).toFixed(3), draft: +ABYME.draft(n).toFixed(3) });
    }
    return out;
  })()`);
  for (const r of dry) ok(`rung ${r.n} arrival keeps the eye above water (draft ${r.draft})`, r.clearance > 0.25, r);

  // --- slice 4: the inherited marks are IN THE WORLD --------------------------
  // _apply (which lays the marks out) runs in the rAF loop, NOT in game.tick — so
  // change the rung, then let real frames happen before measuring.
  await h.evaluate(`(() => { ABYME.goLevel(2); return 1; })()`);
  await h.wait(1.2);
  const seen = await h.evaluate(`(() => {
    const W = ABYME.W, THREE = ABYME.THREE;
    const im = ABYME.refs.handMarks;
    if (!im) return { err: 'no handMarks mesh' };
    const ev = ABYME.evidence(2).filter((m) => m.at);
    // every instance must sit ON the ground at a recorded position
    const m4 = new THREE.Matrix4(), v = new THREE.Vector3();
    let onGround = 0;
    for (let i = 0; i < im.count; i++) {
      im.getMatrixAt(i, m4); v.setFromMatrixPosition(m4);
      const g = ABYME.terrain.walkableY(v.x, v.z);
      if (Math.abs(v.y - (g + 0.06)) < 0.05) onGround++;
    }
    const wy = -4.2 * (1 - W.tide);
    let dry = 0;
    for (let i = 0; i < im.count; i++) { im.getMatrixAt(i, m4); v.setFromMatrixPosition(m4); if (v.y > wy) dry++; }
    return { count: im.count, evidence: ev.length, onGround, dry, cap: im.instanceMatrix.count,
             pruned: !ABYME.scene.getObjectByName('modelIsland')?.getObjectByName('handMarks') };
  })()`);
  // count <= evidence, not ==: marks that fall under this rung's waterline are
  // skipped on purpose (evidence you cannot find is not evidence)
  ok('the inherited marks are placed in the world', seen.count > 0 && seen.count <= Math.min(seen.evidence, seen.cap), seen);
  ok('every mark sits on the ground', seen.onGround === seen.count, seen);
  ok('marks are pruned from the 1:240 model clone', seen.pruned === true, seen);
  ok('no mark is drawn under the waterline', seen.dry === seen.count, seen);

  // --- slice 5: THE DRIFT — the dead wheel, then the sea moves anyway -----------
  const armed = await h.evaluate(`(() => {
    const W = ABYME.W, g = ABYME.game;
    const hs = (id) => g.interact.hotspots.find(s => s.id === id);
    W.onceKeys = (W.onceKeys || []).filter((k) => k !== 'drift');
    g._driftT = null;
    const before = +W.tideTarget.toFixed(4);
    hs('valve').onClick();                       // dead down here — but it arms the drift
    const armedNow = g._driftT === 0;
    g.tick(3.0, 1); const midway = +W.tideTarget.toFixed(4);   // still nothing at 3s
    g.tick(1.5, 1); const after = +W.tideTarget.toFixed(4);    // …and now the sea moves
    return { before, midway, after, armedNow, draft: +ABYME.draft().toFixed(3),
             once: W.onceKeys.includes('drift') };
  })()`);
  ok('the dead wheel arms the drift when a hand is really above you', armed.armedNow, armed);
  ok('the drift WAITS — nothing moves while you are still watching', armed.midway === armed.before, armed);
  ok('then the sea rises with nobody at the wheel', armed.after > armed.before, armed);
  ok('the drift fires once per game', armed.once === true, armed);

  // and it must NOT fire on a clean stack — the beat has to be true, not atmospheric
  const quiet = await h.evaluate(`(() => {
    const W = ABYME.W, g = ABYME.game;
    ABYME.clearStack(); ABYME.goLevel(2);
    W.onceKeys = (W.onceKeys || []).filter((k) => k !== 'drift');
    g._driftT = null;
    g.interact.hotspots.find(s => s.id === 'valve').onClick();
    return { armed: g._driftT !== null, draft: ABYME.draft() };
  })()`);
  ok('no drift when nobody is upstream of you', quiet.armed === false && quiet.draft === 0, quiet);

  // --- THE FIFTH RING: a goal one hand's work cannot reach ---------------------
  const ring = await h.evaluate(`(() => {
    const W = ABYME.W, g = ABYME.game, FIFTH = 4.83;
    const wy = () => -4.2 * (1 - W.tide);
    // one hand, whole chain, deepest rung: must fall SHORT of the ring
    ABYME.goLevel(4);
    const solo = { tide: +W.tide.toFixed(3), waterY: +wy().toFixed(3), draft: +ABYME.draft(4).toFixed(3) };
    const soloReaches = wy() >= FIFTH;
    // now stack a second hand's worth of marks on top of rung 1..3 and try again
    const led = ABYME.ledger();
    for (const kind of ['valve','crank','ruler','lens','chest','hatch','stones','plumb','dive']) {
      led.marks.push({ k: kind, r: 1, h: 'otherhand', n: 0, at: null });
      led.marks.push({ k: kind, r: 2, h: 'thirdhand', n: 0, at: null });
    }
    ABYME.goLevel(4);
    W.onceKeys = (W.onceKeys || []).filter((k) => k !== 'fifthRing');
    g.tick(0.05, 1);
    return { solo, soloReaches, stacked: { tide: +W.tide.toFixed(3), waterY: +wy().toFixed(3),
             draft: +ABYME.draft(4).toFixed(3) }, met: W.onceKeys.includes('fifthRing') };
  })()`);
  ok('one hand alone cannot reach the fifth ring', ring.soloReaches === false, ring);
  ok('accumulated hands DO reach it', ring.stacked.waterY >= 4.83, ring);
  ok('reaching it fires the beat', ring.met === true, ring);

  // --- slice 6: THE ERAS ARE RULESETS — obeys / lags / audited / refuses --------
  const eras = await h.evaluate(`(() => {
    const W = ABYME.W, g = ABYME.game;
    const crank = g.interact.hotspots.find(s => s.id === 'crank');
    const out = {};
    const run = (lvl) => {
      ABYME.goLevel(lvl);
      W.onceKeys = (W.onceKeys || []).filter((k) => !['crankLag','crankDead'].includes(k));
      g._pendHour = 0; g._pendHold = 0;
      const t0 = W.time;
      crank.onDrag(60);
      const immediate = +(W.time - t0).toFixed(4);
      g.tick(1.4, 1);                        // past the L2 hold
      const settled = +(W.time - t0).toFixed(4);
      return { immediate, settled };
    };
    out.l1 = run(1);   // obeys: moves at once
    out.l2 = run(2);   // lags: nothing now, everything a beat later
    out.l3 = run(3);   // heavy but immediate
    out.l4 = run(4);   // refuses: never moves
    return out;
  })()`);
  ok('L1 the model obeys — the hour moves at once', eras.l1.immediate !== 0, eras);
  ok('L2 the model LAGS — nothing now…', eras.l2.immediate === 0, eras);
  ok('…and the hour arrives a beat later', Math.abs(eras.l2.settled) > 0, eras);
  ok('L3 still answers, heavier', eras.l3.immediate !== 0 && Math.abs(eras.l3.immediate) < Math.abs(eras.l1.immediate), eras);
  ok('L4 the model REFUSES — only the plate is left', eras.l4.immediate === 0 && eras.l4.settled === 0, eras);

  // L3's register reads the ledger, not the world
  const reg = await h.evaluate(`(() => {
    const W = ABYME.W, g = ABYME.game;
    ABYME.goLevel(3);
    W.onceKeys = (W.onceKeys || []).filter((k) => k !== 'register');
    g._regT = 0;
    ABYME.tp(-86.4, -39.3, 0, 0);
    g.tick(1.0, 1); const early = W.onceKeys.includes('register');
    g.tick(1.0, 1); const late = W.onceKeys.includes('register');
    return { early, late, hands: ABYME.hands(3) };
  })()`);
  ok('L3 register waits for you to settle at the table', reg.early === false, reg);
  ok('L3 register then reads the ledger', reg.late === true && reg.hands >= 1, reg);

  // --- slice 7: THE DISPOSITIONS — the endings write to the ledger --------------
  const disp = await h.evaluate(`(() => {
    const W = ABYME.W, g = ABYME.game;
    const set = (kind) => { W.disposition = kind; W._dispDone = false; };
    const seed = () => {
      ABYME.clearStack(); ABYME.goLevel(1);
      // flag() early-returns when the flag is ALREADY set, and by this point in the
      // run they all are — so clearing the ledger without clearing the flags seeds
      // nothing at all. Reset the three we are about to use.
      W.flags.valveTurned = false; W.flags.birdSolved = false; W.flags.hatchOpen = false;
      const hs = (id) => g.interact.hotspots.find(s => s.id === id);
      ABYME.tp(-82.7, -38.9, 0, 0); hs('valve').onClick();
      ABYME.tp(-85, -40, 0, 0); g.flag('birdSolved'); g.flag('hatchOpen');
    };
    const out = {};
    // TEND leaves it alone
    seed(); set('tend');
    const beforeTend = ABYME.draft(2);
    ABYME.ring();
    out.tend = { before: +beforeTend.toFixed(4), after: +ABYME.draft(2).toFixed(4) };
    // CARRY takes your marks back out
    seed(); set('carry');
    const beforeCarry = ABYME.draft(2);
    ABYME.ring();
    out.carry = { before: +beforeCarry.toFixed(4), after: +ABYME.draft(2).toFixed(4),
                  marks: ABYME.ledger().marks.length };
    // CLOSE seals the way down
    seed(); set('close'); W.level = 2;
    ABYME.ring();
    out.close = { sealed: ABYME.ledger().sealed.slice(), draft3: +ABYME.draft(3).toFixed(4) };
    // and it is applied ONCE, however many times a terminal is poked
    seed(); set('carry');
    ABYME.ring(); const once1 = ABYME.ledger().marks.length;
    ABYME.ring(); const once2 = ABYME.ledger().marks.length;
    out.once = { once1, once2 };
    return out;
  })()`);
  ok('TEND changes nothing for the rung below', disp.tend.after === disp.tend.before, disp);
  ok('CARRY takes your own marks back out', disp.carry.after < disp.carry.before && disp.carry.marks === 0, disp);
  ok('CLOSE seals the rung — nothing reaches deeper', disp.close.sealed.includes(2) && disp.close.draft3 === 0, disp);
  ok('a disposition is performed exactly once', disp.once.once1 === disp.once.once2, disp);

  // the index only exists once the question does
  const dial = await h.evaluate(`(() => {
    const W = ABYME.W, g = ABYME.game;
    const spot = g.interact.hotspots.find(s => s.id === 'dispSet');
    ABYME.goLevel(2); W.flags.keeperRose = false;
    const shallow = spot.when();
    ABYME.goLevel(4); const deepNoTwist = spot.when();
    W.flags.keeperRose = true; const deepTwist = spot.when();
    W.disposition = 'tend'; spot.onClick(); const stepped = W.disposition;
    return { shallow, deepNoTwist, deepTwist, stepped };
  })()`);
  ok('the index is absent before the bottom', dial.shallow === false, dial);
  ok('…and before the twist has asked the question', dial.deepNoTwist === false, dial);
  ok('…and present once both are true', dial.deepTwist === true, dial);
  ok('touching it turns it one position', dial.stepped === 'carry', dial);

  const errs = await h.evaluate(`window.__errs || []`);
  ok('no console errors', Array.isArray(errs) && errs.length === 0, errs);

  for (const p of R.pass) console.log('  ok   ' + p);
  for (const f of R.fail) console.log('  FAIL ' + f);
  console.log(`STACKWALK ${R.pass.length} / ${R.pass.length + R.fail.length}`);
  if (R.fail.length) process.exitCode = 1;
  return R;
}
