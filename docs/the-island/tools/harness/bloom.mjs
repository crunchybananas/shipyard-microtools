// bloom.mjs — the bloom threshold must sit BELOW every intended emissive.
//
// Bloom is supposed to mark light SOURCES. The threshold runs on the linear
// pre-tonemap buffer, so it is a single number holding two failure modes apart:
//
//   too LOW  — ordinary lit surfaces cross it and glow like lamps. This has now
//              happened twice. At 0.85 the noon sun on the brass valve wheel torched
//              the whole prop white. At 1.05 the sun through the study window did the
//              same to the chart sheets and the day's return, and the owner read the
//              result as "a book with a white box next to it" — the document was
//              there all along, buried under its own glare.
//   too HIGH — the things that are ACTUALLY light stop glowing, and the lamp, the
//              beam and the glows go flat. That failure is silent and much easier to
//              ship, because nothing looks broken; it just looks dead.
//
// Raising the threshold to fix the first failure walks toward the second, so this
// pins the invariant: threshold < the dimmest emissive in the world. The comment in
// main.js has claimed "emissives run 1.4-4.5" for a long time; this checks it is
// still true rather than trusting a comment nobody re-measures.

export default async function (h) {
  const R = { pass: [], fail: [] };
  const ok = (n, c, x) => (c ? R.pass : R.fail).push(n + (c ? '' : ' :: ' + JSON.stringify(x)));
  const URL = 'http://127.0.0.1:' + (process.env.SERVE_PORT || 8642) + '/the-island/?mute';

  for (let i = 0; i < 3; i++) {
    await h.navigate(URL);
    let up = false;
    for (let j = 0; j < 40; j++) {
      if (await h.evaluate(`typeof ABYME!=='undefined' && !!document.getElementById('btn-begin')`).catch(() => false)) { up = true; break; }
      await h.wait(1);
    }
    if (up) break;
    if (i === 2) throw new Error('app never booted');
  }
  await h.evaluate(`document.getElementById('btn-begin').click(); 1`);
  await h.wait(2);
  await h.evaluate(`ABYME.setIntroT(99); 1`);
  await h.wait(2.5);

  const m = await h.evaluate(`(() => {
    const seen = new Map();
    ABYME.scene.traverse((o) => {
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const mt of mats) {
        if (!mt || !mt.emissive) continue;
        const k = (mt.emissiveIntensity == null ? 1 : mt.emissiveIntensity);
        const e = mt.emissive;
        // linear luminance of what this material ADDS on its own, which is what the
        // bloom prefilter sees where the surface is otherwise unlit
        const lum = (0.2126 * e.r + 0.7152 * e.g + 0.0722 * e.b) * k;
        if (lum <= 0.05) continue;                        // not an emissive at all
        const id = (o.name || (o.parent && o.parent.name) || '?');
        if (!seen.has(id) || seen.get(id).lum > lum) seen.set(id, { id, lum: +lum.toFixed(3) });
      }
    });
    return JSON.stringify({ threshold: ABYME.bloomPass.threshold,
                            strength: ABYME.bloomPass.strength,
                            emissives: [...seen.values()].sort((a, b) => a.lum - b.lum) });
  })()`).then(JSON.parse);

  // The ones that RELY on blooming — a faint tint at 0.06 was never going to glow and
  // is not evidence of anything. Everything at/above 1.0 is meant to read as light.
  const bloomers = m.emissives.filter((e) => e.lum >= 1.0);
  const dimmest = bloomers[0];
  ok('the world still has emissives that are meant to glow', bloomers.length >= 2, m.emissives);
  if (dimmest) {
    // THE CEILING. Raising the threshold is the tempting fix whenever something looks
    // blown out, and it silently kills the dimmest real light sources first — here the
    // keeper's quarters lamp (1.311) and the tiny figure's glow (1.251). It is also
    // never the right fix: a surface that clips does so before this pass runs.
    ok('bloom threshold stays below the dimmest light that must glow',
      m.threshold < dimmest.lum, { threshold: m.threshold, dimmest, bloomers });
  }
  ok('bloom still has something to do (threshold under the top emissive)',
    m.threshold < m.emissives[m.emissives.length - 1].lum, { threshold: m.threshold });

  console.log(`BLOOM ${R.pass.length} / ${R.pass.length + R.fail.length}`);
  console.log(`  threshold ${m.threshold} · dimmest that must glow ${dimmest ? dimmest.lum + ' (' + dimmest.id + ')' : 'none'} · ${m.emissives.length} emissive materials`);
  if (R.fail.length) { console.log('FAILURES: ' + JSON.stringify(R.fail)); process.exitCode = 1; }
}
