import { beginPlay } from './play-ready.mjs';
// surfaces.mjs — what the player hears underfoot and around them, decided in the real game.
//
// audio.mjs proves each sound offline; this proves the game asks for the right one. It
// teleports through the island and fires the player's own footstep path (player.onFootstep →
// surfaceAt → A.footstep), intercepted at the audio module, so a wrong floor height, a missed
// deck or a mis-scoped room shows up as the wrong surface. It also checks the two things the
// sound world reads from main.js: where "inside" ends (the lantern gallery is open air over
// the study's circle) and that the island's one wind reaches every swaying shader.

export default async function (h) {
  const R = { pass: [], fail: [] };
  const ok = (n, c, x) => (c ? R.pass : R.fail).push(n + (c ? '' : ' :: ' + JSON.stringify(x)));
  const URL = 'http://127.0.0.1:' + (process.env.SERVE_PORT || 8642) + '/the-island/?debug&mute&localstack';
  await h.navigate(URL);
  for (let i = 0; i < 40; i++) {
    if (await h.evaluate(`typeof ABYME !== 'undefined' && !!document.getElementById('btn-begin')`).catch(() => false)) break;
    await h.wait(1);
  }
  await beginPlay(h);
  await h.evaluate(`(async () => {
    const A = (await import('/the-island/js/audio.js')).default;
    window.__steps = [];
    const orig = A.footstep.bind(A);
    A.footstep = (k) => { window.__steps.push(k); return orig(k); };
    window.__T = await import('/the-island/js/terrain.js');
    window.__C = await import('/the-island/js/tower-course.js');
    return 1;
  })()`);

  // a beach, a meadow and the shallows, found from the terrain itself (away from the landing)
  const spots = await h.evaluate(`(() => {
    const { heightAt, SPOTS } = window.__T;
    let sand = null, grass = null, wade = null;
    for (let z = -60; z < 120 && !(sand && grass && wade); z += 3) for (let x = -120; x < 120; x += 3) {
      const hh = heightAt(x, z);
      if (!sand && hh > 0.6 && hh < 1.8 && z > -95) sand = [x, z];
      if (!grass && hh > 6 && hh < 14 && Math.hypot(x - SPOTS.lighthouse.x, z - SPOTS.lighthouse.y) > 20) grass = [x, z];
      if (!wade && hh < -0.35 && hh > -0.8 && z > -95) wade = [x, z];
    }
    return { sand, grass, wade, lighthouse: [SPOTS.lighthouse.x, SPOTS.lighthouse.y] };
  })()`);
  const walk = [
    ['the landing shingle', [4, -104], 'pebble'],
    ['the jetty deck', [-18, -110.5], 'deck'],
    ['a sand beach', spots.sand, 'sand'],
    ['the meadow', spots.grass, 'grass'],
    ['the shallows', spots.wade, 'water'],
    ['the study floor', [spots.lighthouse[0] + 1.5, spots.lighthouse[1]], 'wood'],
  ];
  for (const [name, at, want] of walk) {
    if (!at) { ok(`${name} is underfoot as ${want}`, false, 'no such place found'); continue; }
    const r = await h.evaluate(`(async () => {
      ABYME.tp(${at[0]}, ${at[1]});
      await new Promise((r) => setTimeout(r, 400));
      window.__steps.length = 0;
      ABYME.player.onFootstep('probe', ABYME.player.pos);
      return { got: window.__steps[0], y: +ABYME.player.pos.y.toFixed(2) };
    })()`);
    ok(`${name} is underfoot as ${want}`, r.got === want, r);
  }
  // the tower's floors and the buried rooms, by position (a fresh run has them shut)
  const up = await h.evaluate(`(() => {
    const { TOWER, TOWER_TOP } = window.__C, H = window.__T.heightAt, P = ABYME.player;
    const probe = (x, y, z) => { window.__steps.length = 0; P.onFootstep('probe', { x, y, z }); return window.__steps[0]; };
    // interior() reads the player's own position: set it, ask, put it back before a frame runs
    const saved = P.pos.clone();
    const inside = (x, y, z) => { P.pos.set(x, y, z); const v = P.interior(); P.pos.copy(saved); return v; };
    return {
      stair: probe(TOWER.x + 2.5, TOWER.base + 3, TOWER.z),
      gallery: probe(TOWER.x + 3.2, TOWER_TOP, TOWER.z),
      buried: probe(10, H(10, -60) - 3, -60),
      galleryInside: inside(TOWER.x + 3.2, TOWER_TOP, TOWER.z),
      lanternInside: inside(TOWER.x + 1.0, TOWER_TOP, TOWER.z),
      studyInside: inside(TOWER.x + 2.0, TOWER.base, TOWER.z),
    };
  })()`);
  ok('the stair treads are wood', up.stair === 'wood', up);
  ok('the lantern gallery is iron', up.gallery === 'iron', up);
  ok('a buried room is stone', up.buried === 'stone', up);
  ok('the gallery is open air; the lantern and the study are rooms', !up.galleryInside && up.lanternInside && up.studyInside, up);

  // the one wind: hold a hard gust and read it back off every swaying shader
  const wind = await h.evaluate(`(async () => {
    ABYME.tp(${spots.grass[0]}, ${spots.grass[1]});
    const calm = ABYME.wind(0.05);
    await new Promise((r) => setTimeout(r, 300));
    const read = () => {
      const out = {};
      const crowns = ABYME.scene.getObjectByName('canopies');
      const m = crowns && (crowns.material || crowns.children[0]?.material);
      out.crowns = m?.userData.shader?.uniforms.uWind?.value ?? null;
      const g = ABYME.scene.getObjectByName('grass');
      const gm = g && (g.material || g.children[0]?.material);
      out.grass = gm?.userData.shader?.uniforms.uWind?.value ?? null;
      let turf = null;
      ABYME.scene.traverse((o) => { if (turf === null && /turf/i.test(o.name) && o.material?.userData?.shader?.uniforms?.uWind) turf = o.material.userData.shader.uniforms.uWind.value; });
      out.turf = turf;
      return out;
    };
    const before = read();
    const hard = ABYME.wind(1);
    await new Promise((r) => setTimeout(r, 300));
    return { calm, hard, before, after: read() };
  })()`);
  const rose = (k) => wind.after[k] != null && wind.before[k] != null && wind.after[k] - wind.before[k] > 0.9;
  ok('a gust reaches the crowns, the grass and the turf together', rose('crowns') && rose('grass') && rose('turf'), wind);

  console.log(`SURFACES ${R.pass.length} / ${R.pass.length + R.fail.length}`);
  if (R.fail.length) { console.log('FAILURES: ' + JSON.stringify(R.fail, null, 1)); process.exitCode = 1; }
}
