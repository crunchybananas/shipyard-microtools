// tabletop.mjs — everything that lies on the chart table has to lie ON the chart table.
//
// The table came down from 3.1 m to 2.5 m and nothing standing on it moved. The keeper's
// logbook sat at dx -1.40 while the tabletop now ended at 1.25 and the brass rim ran
// 1.22-1.34, so the book hung off the near edge BELOW the rim. The owner found it by
// eye — "The journal still looks like it is inside the table" — and it was not inside the
// table, it was past it. The lampblack mark, the phial and the folded notice were all
// out there with it, and two of the four leg shadow decals were still painted at the old
// 1.25 while the legs had moved to 1.0.
//
// Every one of those is the same mechanical fact: a prop's footprint versus the surface
// it is supposed to rest on. Nothing else in the gate looks at that — the walk proves you
// can reach the logbook, not that it is on the table — so this does, in both directions:
//
//   INSIDE the vellum   — or it is off the chart, hanging in the air past the rim.
//   OUTSIDE the model   — or it is standing in the sea, or worse, on the island.
//
// and it pins the WORKING MARGIN those two leave between them, because the margin is
// what the whole arrangement runs on: shrink the table or grow the model and the props
// stop fitting again, silently, exactly as they did here.

const MIN_MARGIN = 0.30;   // metres of clear vellum outside the model, all round

export default async function (h) {
  const R = { pass: [], fail: [] };
  const ok = (n, c, x) => (c ? R.pass : R.fail).push(n + (c ? '' : ' :: ' + JSON.stringify(x)));
  const PAGE = 'http://127.0.0.1:' + (process.env.SERVE_PORT || 8642) + '/the-island/?mute';

  const ready = async () => {
    for (let i = 0; i < 40; i++) {
      if (await h.evaluate(`typeof ABYME !== 'undefined' && !!document.getElementById('btn-begin')`).catch(() => false)) return;
      await h.wait(1);
    }
    throw new Error('app never booted');
  };
  // run.sh drives every gate through one browser; a save left by the gate before this
  // one restores at another level and the study is not built the same way
  await h.navigate(PAGE); await ready();
  await h.evaluate(`localStorage.removeItem('abyme-save-v1'); localStorage.setItem('abyme-muted','1'); 1`);
  await h.navigate(PAGE); await ready();
  await h.evaluate(`document.getElementById('btn-begin').click(); 1`); await h.wait(2);
  await h.evaluate(`ABYME.setIntroT(99); 1`); await h.wait(2.5);

  const m = await h.evaluate(`(() => {
    const T = ABYME.THREE, LHX = -85, LHZ = -40;
    const find = (nm, small) => {
      let hit = null;
      ABYME.scene.traverse((n) => {
        if (hit || n.name !== nm) return;
        const s = Math.hypot(n.matrixWorld.elements[0], n.matrixWorld.elements[1], n.matrixWorld.elements[2]);
        if (small ? s > 0.5 : s < 0.5) return;    // the 1:240 clone shares every prop NAME
        hit = n;
      });
      return hit;
    };
    const box = (o) => { const b = new T.Box3().setFromObject(o); return {
      x: [b.min.x - LHX, b.max.x - LHX], z: [b.min.z - LHZ, b.max.z - LHZ], y: [b.min.y, b.max.y] }; };

    const vellum = find('chartSheet', false), sea = find('water', true);
    if (!vellum || !sea) return JSON.stringify({ err: 'no chartSheet / no model water' });
    const V = box(vellum), M = box(sea);
    const vHalf = Math.min(-V.x[0], V.x[1], -V.z[0], V.z[1]);
    const mHalf = Math.max(-M.x[0], M.x[1], -M.z[0], M.z[1]);
    const surfaceY = V.y[1];

    // WHAT COUNTS AS ON THE TABLE: its underside sits at the vellum. That is what
    // separates the papers from the things that merely reach across the table — the
    // orrery boom, the crank arm, the valve on its own pedestal, all of which span a
    // metre of height and start at the floor.
    const on = [];
    ABYME.scene.traverse((o) => {
      if (!o.name || o.name === 'chartSheet' || o.name === 'modelAnchor') return;
      const s = Math.hypot(o.matrixWorld.elements[0], o.matrixWorld.elements[1], o.matrixWorld.elements[2]);
      if (s < 0.5) return;                                     // the model's own contents
      let q = o.parent, inModel = false;
      while (q) { if (q.name === 'modelAnchor') { inModel = true; break; } q = q.parent; }
      if (inModel) return;
      const b = box(o);
      if (b.y[0] < surfaceY - 0.03 || b.y[0] > surfaceY + 0.08) return;   // not resting on the chart
      if (Math.max(Math.abs(b.x[0]), Math.abs(b.x[1]), Math.abs(b.z[0]), Math.abs(b.z[1])) > 2.0) return;
      if (b.y[1] - b.y[0] > 0.5) return;                       // a tall thing that happens to start here
      on.push({ n: o.name, x: b.x.map((v) => +v.toFixed(3)), z: b.z.map((v) => +v.toFixed(3)),
                yLo: +b.y[0].toFixed(3) });
    });
    return JSON.stringify({ vHalf: +vHalf.toFixed(3), mHalf: +mHalf.toFixed(3), surfaceY: +surfaceY.toFixed(3), on });
  })()`).then(JSON.parse);

  if (m.err) { console.log('TABLETOP 0 / 1'); console.log('FAILURES: ' + JSON.stringify([m.err])); process.exitCode = 1; return; }

  ok('the model sits inside the chart', m.mHalf < m.vHalf, { model: m.mHalf, vellum: m.vHalf });
  ok(`the working margin is at least ${MIN_MARGIN} m`, m.vHalf - m.mHalf >= MIN_MARGIN - 1e-6,
    { margin: +(m.vHalf - m.mHalf).toFixed(3), need: MIN_MARGIN });
  ok('the table is not bare — the papers are still on it', m.on.length >= 3, m.on.map((o) => o.n));

  for (const o of m.on) {
    const out = Math.max(Math.abs(o.x[0]), Math.abs(o.x[1]), Math.abs(o.z[0]), Math.abs(o.z[1]));
    ok(`${o.n}: lies inside the chart`, out <= m.vHalf + 1e-3, { reaches: +out.toFixed(3), vellum: m.vHalf });
    // clear of the model's square footprint: separated on x OR on z
    const clear = o.x[1] < -m.mHalf || o.x[0] > m.mHalf || o.z[1] < -m.mHalf || o.z[0] > m.mHalf;
    ok(`${o.n}: clear of the model's footprint`, clear, { x: o.x, z: o.z, model: m.mHalf });
  }

  console.log(`TABLETOP ${R.pass.length} / ${R.pass.length + R.fail.length}`);
  console.log(`  chart ±${m.vHalf} · model ±${m.mHalf} · working margin ${(m.vHalf - m.mHalf).toFixed(3)} m`);
  for (const o of m.on) console.log(`  ${o.n.padEnd(22)} x ${String(o.x[0]).padStart(7)}..${String(o.x[1]).padEnd(7)} z ${String(o.z[0]).padStart(7)}..${o.z[1]}`);
  // a COUNT is the wrong thing for run.sh to grep here: two assertions run per prop on
  // the table, so adding one paper changes the total and the gate starts passing by
  // accident. It says whether it passed instead.
  if (R.fail.length) { console.log('FAILURES: ' + JSON.stringify(R.fail)); console.log('TABLETOP FAILED'); process.exitCode = 1; }
  else console.log('TABLETOP OK');
}
