// walk.mjs — the FULL-GAME regression walk: wake-up → surface chain → dive → L2/L3/L4 →
// twist → embrace → climb-out → both terminals. Real hotspot paths wherever possible.
// The release gate: every assertion must hold, zero console errors.
export default async function (h) {
  const R = { pass: [], fail: [] };
  const ok = (name, cond) => (cond ? R.pass : R.fail).push(name);

  const ready = async () => {
    for (let i = 0; i < 40; i++) {
      const okb = await h.evaluate(`typeof ABYME !== 'undefined' && !!document.getElementById('btn-begin')`).catch(() => false);
      if (okb) return;
      await h.wait(1);
    }
    throw new Error('app never booted');
  };
  await h.navigate('http://127.0.0.1:' + (process.env.SERVE_PORT || 8642) + '/the-island/?debug&mute');
  await ready();
  await h.evaluate(`localStorage.setItem('abyme-muted', '1'); localStorage.removeItem('abyme-save-v1'); 1`);
  await h.navigate('http://127.0.0.1:' + (process.env.SERVE_PORT || 8642) + '/the-island/?debug&mute');
  await ready();
  await h.evaluate(`window.__errs = []; addEventListener('error', (e) => window.__errs.push(e.message)); document.getElementById('btn-begin').click(); 1`);
  await h.wait(2);
  await h.evaluate(`ABYME.setIntroT(99); 1`);
  await h.wait(2.5);

  // fire 35: the undefined-visible leak — on a FRESH save the island-scale figure
  // must be STRICTLY hidden (visible === false), and the model companion too
  const uv = await h.evaluate(`(() => {
    ABYME.game.tick(0.05, 0.5);
    return { island: ABYME.refs.tinyFigure.visible === false,
             comp: ABYME.game.modelRefs.tinyCompanion ? ABYME.game.modelRefs.tinyCompanion.visible === false : true };
  })()`);
  ok('P0.noBeachFigure(undefined-visible fix)', uv.island && uv.comp);

  const p1 = await h.evaluate(`(() => {
    const W = ABYME.W, g = ABYME.game, hs = (id) => g.interact.hotspots.find((s) => s.id === id);
    const r = {};
    r.boot = W.level === 1 && W.flags.introDone;
    W.timeDrift = 0;
    hs('valve').onClick(); W.tide = W.tideTarget;
    r.valve = W.flags.valveTurned && W.tideTarget === 0;
    hs('chest').onClick(); hs('chest').onClick();
    r.ruler = W.flags.chestOpen && W.flags.rulerTaken && W.inventory.includes('ruler');
    r.crackWhen = hs('crack').when();
    hs('crack').onClick();
    r.bridge = W.flags.rulerPlaced && !W.inventory.includes('ruler');
    hs('musicBox').onClick();
    r.box = W.flags.heardBox;
    for (const i of [2, 3, 4, 3, 0]) g._touchStone(i);
    r.stones = W.flags.birdSolved;
    hs('lensItem').onClick();
    r.lens = W.flags.lensTaken;
    hs('lensSlot').onClick();
    r.lensPlaced = W.lensPlaced;
    W.time = 22;
    for (let i = 0; i < 4; i++) g.tick(0.05, i * 0.05);
    r.lamp = W.lampLit;
    W.beamAngle = Math.atan2(57.5 - (-85), 50 - (-40));
    ABYME.tp(40, 38, 0, 0);
    for (let i = 0; i < 6; i++) g.tick(0.05, 1 + i * 0.05);
    r.glyphs = W.flags.glyphsSeen;
    W.time = 17.8;
    hs('shimmer').onClick();
    r.shadow = W.flags.shadowRevealed;
    W.dials = [3, 7, 1, 4];
    hs('dial3').onClick();
    r.hatch = W.flags.hatchOpen;
    hs('plumb').onClick(); hs('hook').onClick();
    r.plumb = W.flags.plumbHung;
    r.stems = W.stems;
    return r;
  })()`);
  for (const [k, v] of Object.entries(p1)) ok('P1.' + k, k === 'stems' ? v === 5 : v === true);

  // #139: the power budget is an assertion, not a habit — one full composer frame
  // at the surface pose must stay inside the ceilings (generous over the observed
  // 94-215 draws / 219-316k tris so real regressions trip it, noise doesn't)
  const bud = await h.evaluate(`(() => {
    ABYME.renderer.info.reset();
    ABYME.composer.render();
    const i = ABYME.renderer.info.render;
    return { calls: i.calls, tris: i.triangles };
  })()`);
  ok('P1.budget(draws<340,tris<460k)', bud.calls < 340 && bud.tris < 460000);
  console.log(`  power budget ${bud.calls} draws · ${bud.tris} triangles`);

  await h.evaluate(`(() => {
    const g = ABYME.game, hs = (id) => g.interact.hotspots.find((s) => s.id === id);
    const p = ABYME.refs.deskPlate.position;
    ABYME.tp(p.x, p.z, 0, 0);
    hs('plate').onClick();
    hs('plate').onClick();
    return 1;
  })()`);
  await h.wait(30);   // 21s cinematic + cold-profile first-compile margin
  const p2 = await h.evaluate(`(() => ({ level: ABYME.W.level, dove: ABYME.W.flags.dove }))()`);
  ok('P2.realDive→L2', p2.level === 2 && p2.dove);
  // #135: the arrival vista fired once and released (the 30s wait spans the 2.4s hold)
  const vz = await h.evaluate(`(() => ({ v2: ABYME.W.onceKeys.includes('vista2'), unlocked: !ABYME.player.locked }))()`);
  ok('P2.vista(#135 held+released)', vz.v2 && vz.unlocked);

  const p3 = await h.evaluate(`(() => {
    const W = ABYME.W, g = ABYME.game, hs = (id) => g.interact.hotspots.find((s) => s.id === id);
    const r = {};
    r.slateWhen = hs('kelpSlate').when();
    hs('kelpSlate').onClick();
    r.reader = !document.getElementById('reader').classList.contains('hidden');
    ABYME.UI.closeReader();
    ABYME.tideFigure();
    return r;
  })()`);
  await h.evaluate(`(() => { for (let i = 0; i < 70; i++) ABYME.game.tick(0.05, i * 0.05); return 1; })()`);
  const p3b = await h.evaluate(`(() => ({ seen: ABYME.W.flags.tideFigureSeen }))()`);
  ok('P3.kelpSlate', p3.slateWhen && p3.reader);
  ok('P3.tideFigure(realRegard)', p3b.seen);

  // #129: the era threshold — the reframe fires once, ~8s of L2 time in
  await h.evaluate(`(() => { for (let i = 0; i < 110; i++) ABYME.game.tick(0.05, 4 + i * 0.05); return 1; })()`);
  const pe = await h.evaluate(`(async () => ({
    once: ABYME.W.onceKeys.includes('eraThreshold'),
    j: ABYME.W.journal.some((x) => x.text.includes('it drowns in order')),
    eraKey: (await import('/the-island/js/world.js')).LEVELS[2].era.key,
  }))()`);
  ok('P3.eraThreshold(once+journal+key)', pe.once && pe.j && pe.eraKey === 'arrival');

  // #130 L2 era event: the climbers' rope — present, swinging, and a keepable read
  const pr = await h.evaluate(`(() => {
    const g = ABYME.game, hs = (id) => g.interact.hotspots.find((s) => s.id === id);
    const rope = ABYME.refs.climberRope;
    const rot0 = rope ? Math.abs(rope.children[2].rotation.x) : -1;
    hs('climberRope').onClick();
    return { rope: !!rope, when: hs('climberRope').when(),
             j: ABYME.W.journal.some((x) => x.text.includes('still swinging')) };
  })()`);
  ok('P3.ropeEvent(#130)', pr.rope && pr.when && pr.j);

  // #131 round 1/4 — MOOR (L2): unlocked by the era threshold, keeps its journal
  const rm = await h.evaluate(`(() => {
    const g = ABYME.game, hs = (id) => g.interact.hotspots.find((s) => s.id === id);
    const when = hs('roundMoor').when();
    hs('roundMoor').onClick();
    for (let i = 0; i < 20; i++) g.tick(0.05, 10 + i * 0.05);
    return { when, flag: ABYME.W.flags.roundMoor,
             j: ABYME.W.journal.some((x) => x.text.includes('made his line fast')) };
  })()`);
  ok('P3.roundMoor(#131)', rm.when && rm.flag && rm.j);

  // #132 FILE flow: read the commendation, take it, file it in the cabinet
  const rf = await h.evaluate(`(() => {
    const W = ABYME.W, g = ABYME.game, hs = (id) => g.interact.hotspots.find((s) => s.id === id);
    const hc = hs('lore_commendation_copy');
    hc.onClick(); ABYME.UI.closeReader();
    hc.onClick();
    const carried = W.recDisp.commendation_copy === 'carried';
    const cabWhen = hs('recordCabinet').when();
    hs('recordCabinet').onClick();
    g.tick(0.05, 20);
    return { carried, cabWhen, filed: W.recDisp.commendation_copy === 'filed',
             j: W.journal.some((x) => x.text.includes('filed his record')),
             stack: ABYME.refs.recordCabinet.getObjectByName('cabinetStack').visible };
  })()`);
  ok('P3.recordFile(#132)', rf.carried && rf.cabWhen && rf.filed && rf.j && rf.stack);

  await h.evaluate(`(() => { ABYME.dive(true); ABYME.watcher('spawn'); return 1; })()`);
  await h.evaluate(`(() => { for (let i = 0; i < 70; i++) ABYME.game.tick(0.05, i * 0.05); return 1; })()`);
  const p4 = await h.evaluate(`(() => ({ level: ABYME.W.level, seen: ABYME.W.flags.watcherSeen }))()`);
  ok('P4.L3', p4.level === 3);
  ok('P4.watcher(realRegard)', p4.seen);

  // #130 L3 era event: the capitals breach — mid-rise after 3.5s, at rest + kept by 10.5s
  const pb = await h.evaluate(`(() => {
    const midY = ABYME.refs.drownedGallery.position.y;
    for (let i = 0; i < 140; i++) ABYME.game.tick(0.05, 4 + i * 0.05);
    return { midY, endY: ABYME.refs.drownedGallery.position.y,
             once: ABYME.W.onceKeys.includes('capitalsBreached'),
             j: ABYME.W.journal.some((x) => x.text.includes('give the capitals back')) };
  })()`);
  ok('P4.breach(#130 mid+rest+journal)', pb.midY > 0.95 && pb.midY < 2.55 && pb.endY === 2.6 && pb.once && pb.j);

  // #131 round 2/4 — LOG (L3)
  const rl = await h.evaluate(`(() => {
    const g = ABYME.game, hs = (id) => g.interact.hotspots.find((s) => s.id === id);
    const when = hs('roundLog').when();
    hs('roundLog').onClick();
    for (let i = 0; i < 20; i++) g.tick(0.05, 12 + i * 0.05);
    return { when, flag: ABYME.W.flags.roundLog,
             j: ABYME.W.journal.some((x) => x.text.includes('signed the day’s return')) };
  })()`);
  ok('P4.roundLog(#131)', rl.when && rl.flag && rl.j);

  const p5 = await h.evaluate(`(() => {
    ABYME.dive(true);
    const W = ABYME.W, g = ABYME.game, hs = (id) => g.interact.hotspots.find((s) => s.id === id);
    ABYME.tp(-75.5, -74.6, 0, -0.4);
    for (let i = 0; i < 4; i++) g.tick(0.05, i * 0.05);
    const r = { level: W.level, phialWhen: hs('poolPhial').when() };
    hs('poolPhial').onClick();
    r.phial = W.flags.phialTaken;
    ABYME.bottom();
    return r;
  })()`);
  await h.evaluate(`(() => { for (let i = 0; i < 30; i++) ABYME.game.tick(0.05, i * 0.05); return 1; })()`);
  await h.wait(7.5);
  const p5b = await h.evaluate(`(() => ({ rose: ABYME.W.flags.keeperRose, unlocked: !ABYME.player.locked }))()`);
  ok('P5.L4+phial', p5.level === 4 && p5.phialWhen && p5.phial);
  ok('P5.keeperTwist(realProximity)', p5b.rose && p5b.unlocked);

  // #130 L4 era event: the beam's farewell — one full pass at night, then dark for the stratum
  const pf = await h.evaluate(`(() => {
    ABYME.W.time = 23; ABYME.W.timeDrift = 0;
    for (let i = 0; i < 300; i++) ABYME.game.tick(0.05, 8 + i * 0.05);
    return { done: ABYME.W.flags.beamFarewell, doused: !ABYME.W.lampLit,
             j: ABYME.W.journal.some((x) => x.text.includes('stopped performing')) };
  })()`);
  ok('P5.beamFarewell(#130 pass+dark+journal)', pf.done && pf.doused && pf.j);

  // #131 round 3/4 — LIGHT (L4): lantern lit and STAYS lit after the tableau
  const rg = await h.evaluate(`(() => {
    const g = ABYME.game, hs = (id) => g.interact.hotspots.find((s) => s.id === id);
    const when = hs('roundLight').when();
    hs('roundLight').onClick();
    for (let i = 0; i < 240; i++) g.tick(0.05, 25 + i * 0.05);   // through the 10s tableau
    const lg = ABYME.refs.cotLantern.getObjectByName('cotLanternGlass');
    return { when, flag: ABYME.W.flags.roundLight, lit: lg.material.emissiveIntensity > 0.5,
             j: ABYME.W.journal.some((x) => x.text.includes('lit his small lamp')) };
  })()`);
  ok('P5.roundLight(#131 lit+stays)', rg.when && rg.flag && rg.lit && rg.j);

  // #132 KEEP flow: read the closure notice at the source, take it, leave it with him
  const rk = await h.evaluate(`(() => {
    const W = ABYME.W, g = ABYME.game, hs = (id) => g.interact.hotspots.find((s) => s.id === id);
    const ho = hs('lore_closure_notice');
    ho.onClick(); ABYME.UI.closeReader();
    ho.onClick();
    const carried = W.recDisp.closure_notice === 'carried';
    const restWhen = hs('sourceRest').when();
    hs('sourceRest').onClick();
    g.tick(0.05, 45);
    return { carried, restWhen, kept: W.recDisp.closure_notice === 'kept',
             j: W.journal.some((x) => x.text.includes('left it with him at the source')),
             pile: ABYME.refs.sourceRest.getObjectByName('sourceRestPile').visible };
  })()`);
  ok('P5.recordKeep(#132)', rk.carried && rk.restWhen && rk.kept && rk.j && rk.pile);

  // #133: with L4 seen, all three shore pieces sit in their drowned poses
  const sl = await h.evaluate(`(() => {
    ABYME.game.tick(0.05, 60);
    return { arm: ABYME.refs.jettyArm.position.y, bench: ABYME.refs.shoreBench.position.y,
             skiff: ABYME.refs.shoreSkiff.position.y };
  })()`);
  ok('P5.shoreLost(#133 all sunk)', sl.arm < -1 && sl.bench < 0 && sl.skiff < 0);

  await h.evaluate(`(() => {
    const g = ABYME.game, hs = (id) => g.interact.hotspots.find((s) => s.id === id);
    const p = ABYME.refs.deskPlate.position;
    ABYME.tp(p.x, p.z, 0, 0);
    for (let i = 0; i < 3; i++) g.tick(0.05, i * 0.05);
    hs('plate').onClick();
    hs('plate').onClick();
    return 1;
  })()`);
  await h.wait(30);
  const p6 = await h.evaluate(`(() => ({ level: ABYME.W.level, carried: ABYME.W.flags.carried, climbing: ABYME.W.flags.climbing }))()`);
  ok('P6.embrace+realAscent→L3', p6.level === 3 && p6.carried && p6.climbing);

  await h.evaluate(`ABYME.ascend(true); ABYME.ascend(true); 1`);
  await h.evaluate(`(() => { ABYME.tp(-83, -41, 2.2, 0); for (let i = 0; i < 30; i++) ABYME.game.tick(0.05, i * 0.05); return 1; })()`);
  const p7 = await h.evaluate(`(() => {
    const W = ABYME.W, g = ABYME.game, hs = (id) => g.interact.hotspots.find((s) => s.id === id);
    const r = { level: W.level, returned: W.flags.returned, climbing: W.flags.climbing, dried: W.flags.phialDried };
    hs('phialDesk').onClick();
    r.reader = !document.getElementById('reader').classList.contains('hidden');
    ABYME.UI.closeReader();
    r.snapshot = localStorage.getItem('abyme-save-v1');
    return r;
  })()`);
  ok('P7.returned', p7.level === 1 && p7.returned && !p7.climbing);
  ok('P7.phialDried+read', p7.dried && p7.reader);

  // #131 round 4/4 — WIND (the box, back on the surface) + the completion journal
  const rw = await h.evaluate(`(() => {
    const g = ABYME.game, hs = (id) => g.interact.hotspots.find((s) => s.id === id);
    hs('musicBox').onClick();
    for (let i = 0; i < 30; i++) g.tick(0.05, 40 + i * 0.05);
    return { flag: ABYME.W.flags.roundWind,
             jw: ABYME.W.journal.some((x) => x.text.includes('wound the music box')),
             all: ABYME.W.journal.some((x) => x.text.includes('Four rounds, kept')) };
  })()`);
  ok('P7.roundWind+all(#131)', rw.flag && rw.jw && rw.all);

  // #133: the walk home — pass each drowned piece, hear it named, keep the sum
  const sh2 = await h.evaluate(`(() => {
    const g = ABYME.game;
    for (const [x, z] of [[-18, -117], [24, -101], [-44, -110]]) {
      ABYME.tp(x, z, 0, 0);
      for (let i = 0; i < 4; i++) g.tick(0.05, 50 + i * 0.05);
    }
    return { keys: ['loss_arm', 'loss_bench', 'loss_skiff'].every((k) => ABYME.W.onceKeys.includes(k)),
             j: ABYME.W.journal.some((x) => x.text.includes('gave up while I was down')) };
  })()`);
  ok('P7.shoreNamed(#133)', sh2.keys && sh2.j);

  await h.evaluate(`(() => {
    const g = ABYME.game, hs = (id) => g.interact.hotspots.find((s) => s.id === id);
    ABYME.tp(-26, -102, 1.2, 0);
    for (let i = 0; i < 3; i++) g.tick(0.05, i * 0.05);
    hs('oar').onClick(); hs('oar').onClick();
    return 1;
  })()`);
  await h.wait(19);
  const p8 = await h.evaluate(`(() => ({ fin: ABYME.getFinale && ABYME.getFinale() }))()`);
  ok('P8.oarFinale', p8.fin && p8.fin.kind === 'oar' && p8.fin.shown);

  // #134: the leave-coda reads back THIS walk (4 rounds, 1 filed, 1 kept, shore named)
  const c8 = await h.evaluate(`document.querySelector('#finale .fin-coda').textContent`);
  ok('P8.oarCoda(#134)', c8.includes('kept whole') && c8.includes('filed') && c8.includes('the arm'));

  await h.evaluate(`localStorage.setItem('abyme-save-v1', \`${'${SNAP}'}\`); 1`.replace("`${SNAP}`", JSON.stringify(p7.snapshot)));
  await h.navigate('http://127.0.0.1:' + (process.env.SERVE_PORT || 8642) + '/the-island/?debug&mute');
  await ready();
  await h.evaluate(`window.__errs = window.__errs || []; document.getElementById('btn-continue').click(); 1`);
  await h.wait(2);
  const p9 = await h.evaluate(`(() => {
    const W = ABYME.W, g = ABYME.game, hs = (id) => g.interact.hotspots.find((s) => s.id === id);
    ABYME.goLevel(2);
    for (let i = 0; i < 3; i++) g.tick(0.05, i * 0.05);
    const r = { bellWhen: hs('bell').when() };
    hs('bell').onClick();
    r.rung = W.flags.bellRung;
    return r;
  })()`);
  await h.wait(15);
  const p9b = await h.evaluate(`(() => ({ fin: ABYME.getFinale && ABYME.getFinale(), errs: window.__errs || [] }))()`);
  ok('P9.bellFinale', p9.bellWhen && p9.rung && p9b.fin && p9b.fin.kind === 'bell' && p9b.fin.shown);
  // #134: the stay-coda on the restored snapshot (3 rounds at that point)
  const c9 = await h.evaluate(`document.querySelector('#finale .fin-coda').textContent`);
  ok('P9.bellCoda(#134)', c9.includes('three of his rounds') && c9.includes('the shore in the model'));
  ok('P9.zeroErrors', (p9b.errs || []).length === 0);

  console.log('WALK PASS', R.pass.length, '/', R.pass.length + R.fail.length);
  if (R.fail.length) console.log('FAILURES:', JSON.stringify(R.fail));
}
