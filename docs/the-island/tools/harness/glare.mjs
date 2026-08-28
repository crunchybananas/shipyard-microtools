// glare.mjs — nothing in the study may clip to white under the window sun.
//
// "The study props wash out under window sun" has now been reported three times (#147,
// and twice by F8), and nothing in the gate could see it: every other check asks about
// geometry, state or logic, and this is a question about PIXELS. So this one counts them.
//
// The cause each time was different, which is exactly why the gate measures the SYMPTOM
// rather than any one cause. It has been: a near-white albedo on the chart sheet; a
// specular lobe on paper that MeshStandardMaterial keeps even at roughness 1 (fixed by
// going Lambert); and finally the chart table's brass rim at roughness 0.38 with
// metalness 0.85 — a mirror pointed at a 3.5-intensity sun, whose reflected strip the
// bloom's radius-0.68 blur then spread across half the table. Raising the threshold was
// never the answer to any of them (see the ceiling pinned in bloom.mjs).
//
// HOW THE PIXELS ARE READ. The renderer runs without preserveDrawingBuffer, so the
// drawing buffer is gone by the time anything else can look at it. Rendering and
// reading in the SAME evaluate call is what makes it legal — the same trick
// ABYME.report() already uses to attach a screenshot to an F8 note.
//
// The same-call rule is not only about the buffer. The rAF loop re-drives the sun and
// the exposure every frame (applyAtmosphere), so ANY render setting changed from one
// evaluate is already back to normal by the next one — I spent two runs "darkening" a
// frame that never got darker. Set it, render it and read it in one call, or measure
// something the loop does not own.

// WHAT TO COUNT, and the first metric I chose being wrong.
//
// The obvious measure is pixels clipped to white — all three channels at 250+. I wrote
// that, put the mirror rim back, and it reported 0.00% against a frame that is visibly a
// white-out. The glare is not WHITE. It is the reflection of a warm sun off amber brass,
// so it saturates red and green while blue trails, and a neutrality test never fires.
//
// Measured both ways, on the owner's frame, fixed rim vs mirror rim:
//     all three channels >= 250     0.00%  ->  0.00%   (blind)
//     any channel clipped           0.30%  ->  1.99%   (6.6x)
//     luma >= 230                   1.14%  ->  4.03%   (3.5x)
//     luma >= 245                   0.15%  ->  2.12%   (14x)  <- the separator
//     mean luma                      95.2  ->  125.3   (1.3x)
// So it counts pixels at near-maximum LUMINANCE, of any hue, and pixels with any single
// channel clipped. The ceilings sit ~4x above the good frame and ~2.5x below the bad one.
const FRAMES = [
  { name: 'the chart table, sun through the study window',
    at: [-86.85, -39.22], yaw: 5.002, pitch: -0.631, time: 11, maxHot: 0.8, maxClip: 1.0 },
  // A LOOSER BUDGET HERE, AND IT IS EARNED: at 9.5 the low sun throws a real shaft of
  // window-light across the table and the floor, and that shaft is most of this frame's
  // hot pixels. Checked by eye before widening the ceiling rather than after — a
  // threshold moved to make a red check go green is not a gate. The separation still
  // holds: 1.37% with the rim fixed, 3.63% with it a mirror.
  { name: 'the west margin, low and close',
    at: [-86.3, -38.6], yaw: 4.6, pitch: -0.45, time: 9.5, maxHot: 2.2, maxClip: 2.0 },
];

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
  await h.navigate(PAGE); await ready();
  await h.evaluate(`localStorage.removeItem('abyme-save-v1'); localStorage.setItem('abyme-muted','1'); 1`);
  await h.navigate(PAGE); await ready();
  await h.evaluate(`document.getElementById('btn-begin').click(); 1`); await h.wait(2);
  await h.evaluate(`ABYME.setIntroT(99); 1`); await h.wait(2.5);

  const measure = `(() => {
    const r = ABYME.renderer, cvs = r.domElement;
    // render and read IN THE SAME CALL — no preserveDrawingBuffer
    if (ABYME.bloomPass.enabled) ABYME.composer.render(); else r.render(ABYME.scene, ABYME.camera);
    const W = 320, H = Math.max(1, Math.round(W * cvs.height / cvs.width));
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(cvs, 0, 0, W, H);
    const d = g.getImageData(0, 0, W, H).data, n = d.length / 4;
    let hot = 0, clip = 0, sum = 0;
    for (let i = 0; i < d.length; i += 4) {
      const R = d[i], G = d[i + 1], B = d[i + 2];
      const L = 0.2126 * R + 0.7152 * G + 0.0722 * B;
      if (L >= 245) hot++;
      if (R >= 252 || G >= 252 || B >= 252) clip++;
      sum += L;
    }
    return JSON.stringify({ hotPct: +((hot / n) * 100).toFixed(2), clipPct: +((clip / n) * 100).toFixed(2),
                            meanLuma: +(sum / n).toFixed(1), px: n });
  })()`;

  const seen = [];
  for (const f of FRAMES) {
    await h.evaluate(`ABYME.W.time = ${f.time}; ABYME.W.sunFrozen = true; 1`);
    await h.evaluate(`ABYME.tp(${f.at[0]}, ${f.at[1]}, ${f.yaw}, ${f.pitch}); 1`);
    await h.wait(1.2);
    const m = await h.evaluate(measure).then(JSON.parse);
    seen.push({ ...f, ...m });
    ok(`${f.name}: not washed out`, m.hotPct <= f.maxHot, { hotPct: m.hotPct, max: f.maxHot });
    ok(`${f.name}: nothing is clipping`, m.clipPct <= f.maxClip, { clipPct: m.clipPct, max: f.maxClip });
    // and it must not be DARK instead — a frame fixed by turning the lights off is not
    // fixed, and every metric above is happiest in a black room
    ok(`${f.name}: is still a lit room`, m.meanLuma > 55, { meanLuma: m.meanLuma });
  }

  // AND YOU MAY NOT FIX IT BY DULLING ALL THE METAL. That is how I fixed it the first
  // time — matBrass from 0.38 to 0.55 — and it worked on the pixels and flattened the
  // gallery, the rails and the finial into painted tan across the whole game. Owner:
  // "metal is flat, not sure what happened." The rail that causes the glare is one long
  // flat face at one window and it has its own material now; the rest stays polished.
  const brass = await h.evaluate(`(() => {
    const out = {};
    ABYME.scene.traverse((o) => {
      let q = o, grp = null;
      while (q) { if (q.name === 'staticBrass' || q.name === 'staticRail') { grp = q.name; break; } q = q.parent; }
      if (!grp || !o.isMesh || !o.material || out[grp] !== undefined) return;
      out[grp] = o.material.roughness;
    });
    return JSON.stringify(out);
  })()`).then(JSON.parse);
  ok('the tower\u2019s brass is still polished', brass.staticBrass !== undefined && brass.staticBrass <= 0.45, brass);
  ok('the chart rail is the dulled one', brass.staticRail !== undefined && brass.staticRail >= 0.5, brass);

  console.log(`GLARE ${R.pass.length} / ${R.pass.length + R.fail.length}`);
  console.log(`  brass ${brass.staticBrass} · chart rail ${brass.staticRail}`);
  for (const s of seen) console.log(`  hot ${String(s.hotPct).padStart(5)}%  clipped ${String(s.clipPct).padStart(5)}%  mean luma ${String(s.meanLuma).padStart(5)}  — ${s.name}`);
  if (R.fail.length) { console.log('FAILURES: ' + JSON.stringify(R.fail)); process.exitCode = 1; }
}
