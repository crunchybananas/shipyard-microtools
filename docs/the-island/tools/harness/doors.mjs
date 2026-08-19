// doors.mjs — every door leaf stays inside the building it is hung in.
//
// The owner's bug: the study door's closed angle was derived from the doorway's
// RADIUS (`jambAz - 90°`) when a hinged leaf must lie along the doorway's CHORD.
// The leaf pointed straight out of the tower, and the 52° "ajar" swing carried its
// far edge to r 5.81 — past the wall's outer face (5.35) and into the stone cheek
// beside the opening. From outside you watched a door pass through masonry.
//
// It survived every existing check because nothing in the gate looks at where props
// END UP; the walk proves you can get through the doorway, not that the door in it
// is inside the wall. So this asserts the one invariant that makes that impossible:
//
//   A LEAF NEVER SWINGS OUTWARD PAST ITS OWN HINGE RADIUS.
//
// Both of these doors open inward, so the far edge must stay at or inside the radius
// its hinge sits at, through the WHOLE swing — not just at the two poses the game
// happens to render. Sampling the arc is the point: the bug was an orientation
// error, and an orientation error is invisible at any single frame you pick.

const DOORS = [
  { name: 'studyDoor', width: 0.98, note: 'the beach door into the study — the reported bug' },
  { name: 'innerDoor', width: 1.5, note: 'the annex door; had the same defect, unreported' },
];

export default async function (h) {
  const R = { pass: [], fail: [] };
  const ok = (name, cond, extra) => (cond ? R.pass : R.fail).push(name + (cond ? '' : ' :: ' + JSON.stringify(extra)));
  const URL = 'http://127.0.0.1:' + (process.env.SERVE_PORT || 8642) + '/the-island/?mute';

  const ready = async () => {
    for (let i = 0; i < 40; i++) {
      if (await h.evaluate(`typeof ABYME !== 'undefined' && !!document.getElementById('btn-begin')`).catch(() => false)) return;
      await h.wait(1);
    }
    throw new Error('app never booted');
  };

  await h.navigate(URL); await ready();
  await h.evaluate(`localStorage.setItem('abyme-muted','1'); 1`);
  await h.evaluate(`document.getElementById('btn-begin').click(); 1`);
  await h.wait(2);
  await h.evaluate(`ABYME.setIntroT(99); 1`);
  await h.wait(2.5);

  // Sweep each leaf through its full range and record the worst radius it reaches.
  // THE MODEL-CLONE GOTCHA: the chart table carries a 1:240 copy of the whole island
  // and its doors share these names, so filter by world scale or you measure a door
  // the size of a fingernail and call the island proved.
  const swept = await h.evaluate(`(() => {
    const root = ABYME.scene || (ABYME.game && ABYME.game.scene);
    if (!root) return { err: 'no scene' };
    const LX = -85, LZ = -40;                     // the lighthouse axis
    const spec = ${JSON.stringify(DOORS)};
    const out = [];
    for (const s of spec) {
      let d = null;
      root.traverse((o) => {
        if (o.name !== s.name) return;
        o.updateWorldMatrix(true, false);
        const e = o.matrixWorld.elements;
        if (Math.hypot(e[0], e[1], e[2]) > 0.5) d = o;   // the full-scale one
      });
      if (!d) { out.push({ name: s.name, err: 'not found' }); continue; }
      const keep = d.rotation.y;
      const rAt = (t) => {
        d.rotation.y = t;
        d.updateWorldMatrix(true, false);
        const e = d.matrixWorld.elements;
        const hx = e[12], hz = e[14];
        const tx = e[0] * s.width + hx, tz = e[2] * s.width + hz;
        return { hinge: Math.hypot(hx - LX, hz - LZ), tip: Math.hypot(tx - LX, tz - LZ) };
      };
      // the arc the leaf can actually be driven through: closed, to fully open
      const closed = (d.userData && d.userData.closedY != null) ? d.userData.closedY : keep;
      const swing = (d.userData && d.userData.swingY != null) ? d.userData.swingY : (keep - closed);
      let worst = -1, worstAt = 0, hinge = 0;
      for (let i = 0; i <= 24; i++) {
        const t = closed + swing * (i / 24);
        const m = rAt(t);
        hinge = m.hinge;
        if (m.tip > worst) { worst = m.tip; worstAt = t; }
      }
      d.rotation.y = keep; d.updateWorldMatrix(true, false);
      out.push({ name: s.name, hinge: +hinge.toFixed(3), worstTip: +worst.toFixed(3),
                 worstAtDeg: +(worstAt * 180 / Math.PI).toFixed(1),
                 closedDeg: +(closed * 180 / Math.PI).toFixed(1),
                 swingDeg: +(swing * 180 / Math.PI).toFixed(1) });
    }
    return out;
  })()`);

  if (swept && swept.err) { console.log('DOORS 0 / 0 :: ' + swept.err); process.exitCode = 1; return; }

  for (const d of swept) {
    ok(`${d.name}: found in the world at full scale`, !d.err, d);
    if (d.err) continue;
    // 0.05m of slack: a closed leaf legitimately sits a few cm proud of its hinge
    // arc (it is a flat plank spanning a curve), but no more than that.
    ok(`${d.name}: never swings outward past its hinge radius`, d.worstTip <= d.hinge + 0.05, d);
    ok(`${d.name}: actually swings (a door that cannot move is not a door)`, Math.abs(d.swingDeg) > 5, d);
  }

  console.log(`DOORS ${R.pass.length} / ${R.pass.length + R.fail.length}`);
  if (R.fail.length) { console.log('FAILURES: ' + JSON.stringify(R.fail)); process.exitCode = 1; }
  for (const d of swept) console.log('  ' + JSON.stringify(d));
}
