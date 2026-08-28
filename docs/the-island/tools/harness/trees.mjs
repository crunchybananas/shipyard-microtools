// trees.mjs — the canopy's detail is carried by things that fail SILENTLY.
//
// The trees are the owner's standing example of the quality bar, and what makes them read
// as trees rather than folded paper is not geometry any more — it is an attribute and a
// shader patch, and both die quietly:
//
//   aRim (0 at the trunk → 1 at the frond tips) is a CUSTOM attribute on the canopy
//   geometry. mergeGeometries carries position/normal/color and, until it was told
//   otherwise, dropped everything else on the floor. A missing attribute reads as 0 in
//   GLSL, so vRim is 0 everywhere, so the fringe never frays and the tips never sway —
//   and nothing anywhere reports a problem.
//
//   The fray, the needle grain and the clump bump are string replacements into three.js's
//   shader chunks. A replace that matches nothing is a no-op with no error (the same trap
//   the bloom clamp carries a warning for).
//
// So this checks the mechanism is actually present, on all four canopy geometries — near
// and far LOD, both silhouettes — because the far pair is easy to forget.

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
  await h.evaluate(`ABYME.setIntroT(99); 1`); await h.wait(3);

  const m = await h.evaluate(`(() => {
    const geos = [], mats = new Set();
    ABYME.scene.traverse((o) => {
      if (!o.isInstancedMesh || !o.geometry) return;
      // BY PARENT, not by material shape. "instanced + vertex colours + a patched shader"
      // also describes the needle litter, which turned up as a ninth canopy the moment it
      // existed. The canopies live in one group now, so ask that.
      if (!o.parent || o.parent.name !== 'canopies') return;
      // the 1:240 chart-table clone carries its OWN four, on the same material — filter by
      // world scale, the way every other probe in this harness does
      if (Math.hypot(o.matrixWorld.elements[0], o.matrixWorld.elements[1], o.matrixWorld.elements[2]) < 0.5) return;
      geos.push({ verts: o.geometry.attributes.position.count,
                  rim: !!o.geometry.attributes.aRim,
                  rimMax: o.geometry.attributes.aRim
                    ? Math.max(...Array.from(o.geometry.attributes.aRim.array)) : null });
      mats.add(o.material);
    });
    const mat = [...mats][0];
    const sh = mat && mat.userData.shader;
    return JSON.stringify({
      canopies: geos,
      frag: sh ? {
        fray: sh.fragmentShader.includes('float frayN'),
        needle: sh.fragmentShader.includes('float ndl'),
        bump: sh.fragmentShader.includes('float nH'),
        newGrowth: sh.fragmentShader.includes('smoothstep(0.55, 1.0, vRim)'),
      } : null,
      vert: sh ? { rimAttr: sh.vertexShader.includes('attribute float aRim'),
                   tipSway: sh.vertexShader.includes('(0.35 + aRim)') } : null,
      fringe: sh && sh.uniforms.uFringe ? sh.uniforms.uFringe.value : null,
      variants: ABYME.core.userData.canopyVariants,
      trunkVerts: (() => { let n = null; ABYME.scene.traverse((o) => {
        if (o.isInstancedMesh && o.name === 'trunks' && n === null) n = o.geometry.attributes.position.count; }); return n; })(),
    });
  })()`).then(JSON.parse);

  // one NEAR and one FAR geometry per silhouette. Derived from the table rather than
  // written down, or the gate quietly stops covering the newest tree shape.
  ok('every silhouette has both its LOD geometries', m.canopies.length === m.variants * 2,
    { found: m.canopies.length, variants: m.variants, expected: m.variants * 2 });
  ok('the stand has real silhouette variety', m.variants >= 4, { variants: m.variants });
  ok('every canopy carries aRim', m.canopies.length > 0 && m.canopies.every((g) => g.rim), m.canopies);
  // a dropped attribute reads as 0 in GLSL, so "present but all zero" is the same failure
  ok('aRim actually reaches the frond tips', m.canopies.every((g) => g.rimMax > 0.9), m.canopies.map((g) => g.rimMax));
  ok('the vertex patch landed (rim attribute + tip-weighted sway)', !!m.vert && m.vert.rimAttr && m.vert.tipSway, m.vert);
  ok('the fragment patch landed (fray, needle grain, clump bump, new growth)',
    !!m.frag && m.frag.fray && m.frag.needle && m.frag.bump && m.frag.newGrowth, m.frag);
  ok('the fringe is actually turned on', m.fringe > 0.2, { uFringe: m.fringe });
  ok('the trunk carries enough vertices for its root flare', m.trunkVerts >= 100, { trunkVerts: m.trunkVerts });

  // THE NEEDLE LITTER, which the terrain draws rather than an instanced disc — owner:
  // "the needles should be more like a texture on the ground. this is like a plane that
  // doesn't align with the ground." A flat disc on a slope cannot align; a mask the
  // TERRAIN samples cannot misalign.
  //
  // And it must be checked BOTH WAYS. CanvasTexture flips Y by default, which mirrors the
  // whole mask in z: every blob is still perfectly formed, the average is unchanged, and
  // the litter lands the same distance the wrong side of each stand — brown pools in
  // empty grass and bare ground under every tree, with nothing to report it. Measuring
  // only "is it strong under the trunks" would pass a mask that is strong SOMEWHERE.
  const lit = await h.evaluate(`(() => {
    let t = null;
    ABYME.scene.traverse((o) => { if (!t && o.name === 'terrain'
      && Math.hypot(o.matrixWorld.elements[0], o.matrixWorld.elements[1], o.matrixWorld.elements[2]) > 0.5) t = o; });
    const sh = t && t.material.userData && t.material.userData.shader;
    if (!sh || !sh.uniforms.uLitter) return JSON.stringify({ err: 'no litter uniform' });
    if (sh.uniforms.uLitterOn.value < 0.5) return JSON.stringify({ err: 'litter mask is off' });
    const tex = sh.uniforms.uLitter.value, R = sh.uniforms.uLitterRect.value;
    const cv = document.createElement('canvas'); cv.width = tex.image.width; cv.height = tex.image.height;
    const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(tex.image, 0, 0);
    const at = (x, z) => {                       // flipY is off, so v runs down the canvas
      const px = Math.round(((x - R.x) / R.z + 0.5) * cv.width);
      const py = Math.round(((z - R.y) / R.z + 0.5) * cv.height);
      if (px < 0 || py < 0 || px >= cv.width || py >= cv.height) return null;
      return g.getImageData(px, py, 1, 1).data[0] / 255;
    };
    const T = ABYME.THREE, m = new T.Matrix4(), v = new T.Vector3(), trees = [];
    ABYME.scene.traverse((o) => {
      if (!o.isInstancedMesh || o.name !== 'trunks') return;
      if (Math.hypot(o.matrixWorld.elements[0], o.matrixWorld.elements[1], o.matrixWorld.elements[2]) < 0.5) return;
      for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m); v.setFromMatrixPosition(m); trees.push([v.x, v.z]); }
    });
    const on = trees.map(([x, z]) => at(x, z)).filter((n) => n !== null);
    const off = trees.map(([x, z]) => at(x + 26, z + 19)).filter((n) => n !== null);
    const mean = (a) => (a.length ? a.reduce((s, n) => s + n, 0) / a.length : 0);
    return JSON.stringify({ trees: trees.length, res: cv.width, flipY: tex.flipY,
      onTrunk: +mean(on).toFixed(3), away: +mean(off).toFixed(3),
      covered: on.filter((n) => n > 0.5).length });
  })()`).then(JSON.parse);
  ok('the litter mask exists and is switched on', !lit.err, lit);
  if (!lit.err) {
    ok('every trunk stands in litter', lit.covered === lit.trees && lit.trees > 0, lit);
    ok('open ground 30 m off is clear of it', lit.away < 0.20, lit);
    // ...AND IT IS SAMPLED THE WAY IT WAS STAMPED. The two checks above read the CANVAS,
    // which flipY does not touch — it changes how the GPU samples the image, not the image.
    // So they are blind to the exact bug they were written for: I reinstated the flip and
    // they reported 0.974 at the trunk and passed, on a world where every patch of litter
    // is the wrong side of its tree. The flag itself is the invariant.
    ok('the mask is sampled unflipped', lit.flipY === false, { flipY: lit.flipY });
  }

  console.log(`TREES ${R.pass.length} / ${R.pass.length + R.fail.length}`);
  console.log(`  litter mask ${lit.res || '?'}px · ${lit.onTrunk} at the trunk · ${lit.away} away`);
  console.log(`  ${m.variants} silhouettes · ${m.canopies.length} geometries · ${m.canopies.map((g) => g.verts).join('/')} verts · trunk ${m.trunkVerts} · fringe ${m.fringe}`);
  if (R.fail.length) { console.log('FAILURES: ' + JSON.stringify(R.fail)); process.exitCode = 1; }
}
