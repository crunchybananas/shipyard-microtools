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
    hs('valve').onClick();                 // valve   — the sea moved
    hs('crank').onDrag ? hs('crank').onDrag(0.5) : g.flag('crankUsed');
    W.tide = W.tideTarget = 0;
    hs('chest').onClick(); hs('chest').onClick();   // chest + ruler
    hs('crack').onClick();                 // ruler laid → the bridge
    g.flag('birdSolved');                  // stones
    hs('lensItem') && hs('lensItem').onClick();
    hs('lensSlot') && hs('lensSlot').onClick();     // lens set in the model
    g.flag('shadowRevealed'); g.flag('hatchOpen');  // hatch
    hs('plumb') && hs('plumb').onClick();
    hs('hook') && hs('hook').onClick();    // plumb hung
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

  const errs = await h.evaluate(`window.__errs || []`);
  ok('no console errors', Array.isArray(errs) && errs.length === 0, errs);

  for (const p of R.pass) console.log('  ok   ' + p);
  for (const f of R.fail) console.log('  FAIL ' + f);
  console.log(`STACKWALK ${R.pass.length} / ${R.pass.length + R.fail.length}`);
  if (R.fail.length) process.exitCode = 1;
  return R;
}
