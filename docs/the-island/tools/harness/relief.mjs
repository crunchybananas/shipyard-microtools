// relief.mjs — every surface that asked for relief has to actually get it.
//
// The owner stood on the beach and said "This lost texture ... it 100% used to have a
// texture on it that looked like a rocky surface." It did, and it had been gone for a
// while, and nothing could see it: the material was there, the file was on disk, the
// loader worked, no error was thrown, and the surface was simply flat.
//
// The cause was a dropped callback. getTexture cached by id and, on a cache HIT, only
// ran your callback if the image had already decoded — so the FIRST consumer of an asset
// got a real load callback and every consumer that arrived while that load was still in
// flight got nothing at all. applyRelief does all its work in that callback, so being
// second to ask for a heightmap meant no normalMap, silently. The shore is built from
// three stone types that all derive relief from rock_height; two came out bare. The
// The old terrain Bender sand map (uSandOn) could fail for the same reason. Terrain
// relief is now continuous analytic slope, so this gate pins that independent path too.
//
// It was also TIMING-dependent, which is why it came and went and why no screenshot
// comparison could pin it. So this counts instead: relief asked for vs relief applied.

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
  await h.evaluate(`ABYME.setIntroT(99); 1`); await h.wait(4);   // decodes + Sobel passes finish

  const led = await h.evaluate(`JSON.stringify(ABYME.RELIEF ? { asked: ABYME.RELIEF.asked, applied: ABYME.RELIEF.applied } : null)`).then(JSON.parse);
  ok('the relief ledger is reachable', !!led, led);
  if (led) {
    ok('something asked for relief at all', led.asked >= 8, led);
    ok('every relief that was asked for landed', led.applied === led.asked, led);
  }

  // and the surfaces themselves, because a ledger can be right while a material is not
  const surf = await h.evaluate(`(() => {
    const want = ['rocks', 'staticStone', 'staticRock', 'staticJoinery'];
    const out = {};
    ABYME.scene.traverse((o) => {
      let q = o, grp = null;
      while (q) { if (want.includes(q.name)) { grp = q.name; break; } q = q.parent; }
      if (!grp || !o.isMesh || !o.material || out[grp] !== undefined) return;
      out[grp] = !!o.material.normalMap;
    });
    // terrain sand is intentionally independent of the asynchronous asset ledger now:
    // it must declare and compile its continuous analytic relief contract
    let t = null;
    ABYME.scene.traverse((o) => { if (!t && o.name === 'terrain' && Math.hypot(...o.matrixWorld.elements.slice(0,3)) > 0.5) t = o; });
    const sh = t && t.material.userData && t.material.userData.shader;
    out._sandContract = t?.material?.userData?.sandRelief || null;
    out._sandCompiled = !!(sh?.fragmentShader && /sandTurnField/.test(sh.fragmentShader)
      && /sandSlope/.test(sh.fragmentShader) && !/uSandH|uSandSlope/.test(sh.fragmentShader));
    return JSON.stringify(out);
  })()`).then(JSON.parse);

  for (const g of ['rocks', 'staticStone', 'staticRock', 'staticJoinery']) {
    ok(`${g}: carries its normal map`, surf[g] === true, { [g]: surf[g] });
  }
  ok('the terrain’s continuous sand relief is compiled', surf._sandCompiled === true
    && surf._sandContract?.encoding === 'analytic-slope' && surf._sandContract?.textureSamples === 0,
    { compiled: surf._sandCompiled, contract: surf._sandContract });

  console.log(`RELIEF ${R.pass.length} / ${R.pass.length + R.fail.length}`);
  console.log(`  ${led ? led.applied + '/' + led.asked : '?'} reliefs applied · sand ripples ${surf._sandCompiled ? 'analytic' : 'OFF'}`);
  if (R.fail.length) { console.log('FAILURES: ' + JSON.stringify(R.fail)); process.exitCode = 1; }
}
