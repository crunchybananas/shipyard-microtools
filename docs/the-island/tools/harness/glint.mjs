// glint.mjs — the hover highlight must mark a prop, not replace it.
//
// The glint used to be a binary step to a full-body amber wash, and it failed in two
// directions at once. It was JARRING (instant on, instant off — the one hard cut in a
// UI that eases everything else, and a strobe when the crosshair swept a bookshelf),
// and it was DESTRUCTIVE: the rosewood music box became a featureless cream block with
// its brass escutcheon gone, the brass valve wheel lost every bit of specular shading
// and read as a flat cutout, and the small white notice on the desk crossed the bloom
// threshold and flared across the whole floor like a dropped flare. That last one is
// #147 ("the music box banding unreadable") re-created on purpose, by the highlight.
//
// So this gates the two properties that keep it honest:
//   IT EASES  — nothing is written on the frame the hover is set, and the ramp is
//               still climbing a frame later.
//   IT IS A MARK, NOT A LIGHT — the emissive the glint writes stays far below the
//               bloom threshold, so hovering can never manufacture a light source.
// Plus: it fully restores, INCLUDING after a re-hover that lands mid-fade, which is
// the one way an eased highlight can leave a prop permanently half-lit.
//
// SHOT_DIR also photographs each style (off/wash/pulse/rim) on the same prop from the
// same camera — the comparison that chose the rim in the first place.
//   SHOT_DIR=/tmp/g TARGETS=musicBox,valveWheel STYLES=off,wash,rim one.sh glint.mjs

const PROBES = ['musicBox', 'valveWheel', 'logbook', 'lore_closure_notice'];

export default async function (h) {
  const R = { pass: [], fail: [] };
  const ok = (n, c, x) => (c ? R.pass : R.fail).push(n + (c ? '' : ' :: ' + JSON.stringify(x)));
  const URL = 'http://127.0.0.1:' + (process.env.SERVE_PORT || 8642) + '/the-island/?debug&mute&localstack';
  const SHOT_DIR = process.env.SHOT_DIR || '';

  const ready = async () => {
    for (let i = 0; i < 40; i++) {
      if (await h.evaluate(`typeof ABYME!=='undefined' && !!document.getElementById('btn-begin')`).catch(() => false)) return;
      await h.wait(1);
    }
    throw new Error('app never booted');
  };
  await h.navigate(URL); await ready();
  await h.evaluate(`localStorage.setItem('abyme-muted','1'); localStorage.removeItem('abyme-save'); 1`);
  await h.navigate(URL); await ready();
  // three reports a failed shader through console.error, and a rim patch that does not
  // compile would otherwise show up only as a prop that quietly stops being drawn
  await h.evaluate(`window.__err = []; const ce = console.error.bind(console);
    console.error = (...a) => { window.__err.push(a.map(String).join(' ').slice(0, 300)); ce(...a); }; 1`);
  await h.evaluate(`document.getElementById('btn-begin').click(); 1`); await h.wait(2);
  await h.evaluate(`ABYME.setIntroT(99); 1`); await h.wait(2.5);
  await h.evaluate(`ABYME.W.time = 11; ABYME.W.sunFrozen = true; 1`);   // DAYLIGHT is the hard case
  await h.wait(1.2);

  // stand where the crosshair lands on a prop: back OUTWARD from the room's axis for
  // anything inside the chart table's reach (the table is centred on the axis, so
  // "toward the centre" walks the camera onto the tabletop), inward for anything past it
  const CX = -85, CZ = -40;
  const aim = async (name) => {
    const p = await h.evaluate(`(() => {
      let o = null;
      ABYME.scene.traverse((n) => {
        if (o || n.name !== ${'${JSON.stringify(name)}'}) return;
        n.updateWorldMatrix(true, false);
        const e = n.matrixWorld.elements;
        if (Math.hypot(e[0], e[1], e[2]) < 0.5) return;        // the 1:240 chart-table clone
        o = n;
      });
      if (!o) return null;
      const T = ABYME.THREE, sp = new T.Sphere();
      new T.Box3().setFromObject(o).getBoundingSphere(sp);
      const e = o.matrixWorld.elements;
      return JSON.stringify({ x: e[12], y: e[13], z: e[14], r: sp.radius });
    })()`.replace('${JSON.stringify(name)}', JSON.stringify(name)));
    if (!p) return null;
    const q = JSON.parse(p);
    const rProp = Math.hypot(q.x - CX, q.z - CZ);
    let ux = (q.x - CX) / (rProp || 1), uz = (q.z - CZ) / (rProp || 1);
    if (rProp < 0.05) { ux = 1; uz = 0; }
    const dist = Math.min(2.2, Math.max(0.85, (q.r || 0.5) * 3.2));
    let camR = rProp + (rProp < 2.8 ? 1 : -1) * dist;
    if (camR > 4.6) camR = 4.6;                                 // do not stand in the masonry
    const cx = CX + ux * camR, cz = CZ + uz * camR;
    const yaw = Math.atan2(cx - q.x, cz - q.z);
    await h.evaluate(`ABYME.tp(${cx}, ${cz}, ${yaw}, 0); 1`); await h.wait(0.6);
    const eyeY = await h.evaluate(`ABYME.camera.position.y`);
    const pitch = -Math.atan2(eyeY - q.y, Math.hypot(cx - q.x, cz - q.z));
    await h.evaluate(`ABYME.tp(${cx}, ${cz}, ${yaw}, ${pitch}); 1`); await h.wait(0.8);
    return q;
  };

  // read every material the live glint owns, plus the base it promised to restore to
  const readLive = `(() => {
    const I = ABYME.interact, g = I._live;
    if (!g) return JSON.stringify({ live: false, hovered: I.hovered ? (I.hovered.id || '?') : null });
    const mats = [];
    for (const [m, base] of g.mats) {
      const e = m.emissive;
      mats.push({ lum: +((0.2126 * e.r + 0.7152 * e.g + 0.0722 * e.b) * (m.emissiveIntensity ?? 1)).toFixed(4),
                  i: +(m.emissiveIntensity ?? 1).toFixed(4), bi: base.intensity, bh: base.hex,
                  rim: m.userData._rimU ? +m.userData._rimU.value.toFixed(3) : null });
    }
    return JSON.stringify({ live: true, t: g.t, hovered: I.hovered ? (I.hovered.id || '?') : null, mats });
  })()`;

  const seen = [];
  for (const name of PROBES) {
    const q = await aim(name);
    if (!q) { ok(`probe ${name} exists`, false, 'not in scene'); continue; }
    await h.evaluate(`ABYME.interact.mouse.set(0.9, -0.9); 1`); await h.wait(0.8);

    // THE BASELINE MUST NOT COME FROM THE CODE UNDER TEST. Checking each material
    // against its own userData._glintBase is circular: the bug being hunted is
    // _glintBase itself being re-captured from a half-lit value, and a corrupted base
    // matches the corrupted material perfectly. I reinstated exactly that bug and the
    // check went green. So snapshot the prop here, before anything has been hovered,
    // and compare against THAT. (Traverse order is stable, and the per-mesh material
    // clone that the first hover makes does not move anything, so index alignment
    // holds. These four probes are not puzzle-driven, so their emissives are static.)
    const snap = `(() => { let root = null; const out = [];
      ABYME.scene.traverse((n) => { if (root || n.name !== ${'${NM}'}) return;
        n.updateWorldMatrix(true, false); const e = n.matrixWorld.elements;
        if (Math.hypot(e[0], e[1], e[2]) < 0.5) return; root = n; });
      if (!root) return '[]';
      root.traverse((o) => { if (o.material && o.material.emissive !== undefined)
        out.push({ n: o.name || '?', hex: o.material.emissive.getHex(),
                   i: +(o.material.emissiveIntensity ?? 1).toFixed(6),
                   rim: o.material.userData._rimU ? o.material.userData._rimU.value : 0 }); });
      return JSON.stringify(out); })()`.replace('${NM}', JSON.stringify(name));
    const before = await h.evaluate(snap).then(JSON.parse);

    // (1) IT EASES, and this has to be measured by WATCHING THE RAMP, not by checking
    // that update() defers to tickGlint. My first version asserted only that nothing is
    // applied on the frame the hover is set — which is true of a step too, because a
    // step also applies on the following frame. I reinstated the step to check, and it
    // went green. What a step cannot do is produce an INTERMEDIATE value: it goes 0 to
    // 1 with nothing between, at any frame rate. So sample every frame until it settles
    // and count the samples strictly inside (0,1). Ramp: ~11 of them at 60fps. Step: 0.
    const ramp = await h.evaluate(`(() => new Promise((res) => {
      const I = ABYME.interact;
      I.mouse.set(0.9, -0.9); I.update();
      I.mouse.set(0, 0); I.update();
      const t0 = performance.now(); const seen = []; let n = 0;
      const step = () => {
        const g = I._live;
        if (!g) return res(JSON.stringify({ mid: -1, ms: -1, note: 'nothing hovered' }));
        seen.push(+g.t.toFixed(3));
        if (g.t >= 1 || ++n > 240) {
          return res(JSON.stringify({ mid: seen.filter((v) => v > 0 && v < 1).length,
                                      ms: Math.round(performance.now() - t0), seen: seen.slice(0, 6) }));
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }))()`).then(JSON.parse);
    await h.wait(1.3);
    const settled = await h.evaluate(readLive).then(JSON.parse);
    if (!settled.live) { ok(`${name}: crosshair finds a hotspot`, false, settled); continue; }
    ok(`${name}: the glint RAMPS (intermediate values exist; a step has none)`, ramp.mid >= 1, ramp);
    ok(`${name}: the glint settles`, settled.t === 1, { t: settled.t });
    ok(`${name}: the glint does something`, settled.mats.some((m) => m.lum > (m.bh < 0x030303 ? 0.001 : 0) || m.rim > 0.5), settled.mats.slice(0, 3));

    // (2) IT IS A MARK, NOT A LIGHT. The old wash put 0.58 of emissive luminance on a
    // white notice and it crossed the bloom threshold and flared. 0.25 is comfortably
    // above what a rim writes (~0.065) and comfortably below anything that blooms.
    const worst = settled.mats.reduce((a, m) => Math.max(a, m.lum), 0);
    ok(`${name}: hovering cannot manufacture a light source`, worst <= 0.25, { worst, threshold: 0.25 });
    seen.push({ name, worst, t: settled.t, mats: settled.mats.length });

    // (3) IT RESTORES — including from mid-fade. Leaving and re-entering before the
    // decay finishes is the one way an eased highlight can capture its own half-lit
    // value as "normal" and strand the prop permanently bright.
    await h.evaluate(`ABYME.interact.mouse.set(0.9, -0.9); 1`); await h.wait(0.08);
    await h.evaluate(`ABYME.interact.mouse.set(0, 0); 1`); await h.wait(0.9);
    await h.evaluate(`ABYME.interact.mouse.set(0.9, -0.9); 1`); await h.wait(1.4);
    const after = await h.evaluate(snap).then(JSON.parse);
    const drift = before.map((b, i) => [b, after[i]])
      .filter(([b, a]) => !a || a.hex !== b.hex || Math.abs(a.i - b.i) > 1e-6 || a.rim !== b.rim)
      .slice(0, 4).map(([b, a]) => ({ n: b.n, was: [b.hex, b.i, b.rim], now: a ? [a.hex, a.i, a.rim] : null }));
    const idle = await h.evaluate(`JSON.stringify({ fading: ABYME.interact._fading.length,
      live: ABYME.interact.hovered ? (ABYME.interact.hovered.id || '?') : null })`).then(JSON.parse);
    ok(`${name}: every material returns to base after a mid-fade re-hover`, drift.length === 0, { drift, ...idle });
    // NOT "nothing is hovered": that assumed the screen corner this looks away to points
    // at empty space, which is a fact about the room and not about the glint. Moving the
    // folded notice to a new spot on the chart table put a different hotspot behind that
    // corner and the check failed on a system that was working correctly. What matters
    // is that the fades have DRAINED and this prop is no longer the live one.
    ok(`${name}: the fades drain and this prop is released`,
      idle.fading === 0 && idle.live !== settled.hovered, idle);
  }

  const errs = await h.evaluate(`JSON.stringify(window.__err.filter(s => /shader|GLSL|program|WebGL/i.test(s)).slice(0, 3))`).then(JSON.parse);
  ok('the rim patch compiles (no shader errors)', errs.length === 0, errs);

  if (SHOT_DIR) {
    const { mkdirSync } = await import('node:fs');
    mkdirSync(SHOT_DIR, { recursive: true });
    await h.send('Emulation.setDeviceMetricsOverride', { width: 1100, height: 760, deviceScaleFactor: 2, mobile: false });
    const STYLES = (process.env.STYLES || 'off,wash,pulse,rim').split(',');
    for (const name of (process.env.TARGETS || PROBES.join(',')).split(',').filter(Boolean)) {
      if (!(await aim(name))) continue;
      for (const style of STYLES) {
        // 'off' looks away from the SAME camera — comparing a glint against a different
        // frame is how a highlight gets credited with the lighting
        if (style === 'off') await h.evaluate(`ABYME.interact.mouse.set(0.9, -0.9); 1`);
        else await h.evaluate(`ABYME.glintStyle(${JSON.stringify(style)}); ABYME.interact.mouse.set(0, 0); 1`);
        await h.wait(1.1);
        await h.screenshot(`${SHOT_DIR}/${name}-${style}.png`);
      }
      await h.evaluate(`ABYME.glintStyle('rim'); ABYME.interact.mouse.set(0.9, -0.9); 1`); await h.wait(0.5);
    }
    console.log(`  shots -> ${SHOT_DIR}`);
  }

  console.log(`GLINT ${R.pass.length} / ${R.pass.length + R.fail.length}`);
  for (const s of seen) console.log(`  ${s.name.padEnd(20)} ${s.mats} mats · peak emissive lum ${s.worst}`);
  if (R.fail.length) { console.log('FAILURES: ' + JSON.stringify(R.fail)); process.exitCode = 1; }
}
