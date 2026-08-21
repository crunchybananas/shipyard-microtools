// shell.mjs — the lighthouse is a BUILDING. You should not see sky through its walls.
//
// Two holes have shipped in the study's shell and nothing in the gate could catch
// either, because every other check tests BEHAVIOUR — can you walk there, does the
// puzzle fire — and none asks whether the room is enclosed:
//
//   1. The annex doorway's wall gap spans az 3-27 while its throat jambs stand at 6.5
//      and 23.5, so 3.5 degrees of wall was absent either side of the keeper's door.
//   2. The lintels over all three gaps were straight cylinders at a constant radius
//      inside a wall that TAPERS 5.35 at the foot to 5.20 at the head. A straight
//      lintel sits up to 4.2 cm inside the wall face, and where its arc ends against
//      the neighbouring full-height arc the two surfaces are at different radii — a
//      slit you can see daylight through. The owner found it by looking up in the
//      study and pressing F8: "There is a small tear in the all."
//
// HOW THIS IS MEASURED, AND WHY IT IS NOT A SWEEP FROM THE ROOM'S AXIS.
// The obvious test — stand on the axis, fire rays out in every direction, flag any
// that escape — DOES NOT WORK. I wrote it, then reinstated the bug on purpose, and
// watched it pass. A seam slit is a radial STEP between two shells: it opens only
// along the narrow band of directions that graze the step, so an axis sweep either
// misses it or lands exactly on the seam angle, where a hit is a coin-flip of
// floating point. Dodging those coin-flips (offsetting the sweep off seam angles) is
// precisely what makes the real hole invisible. I did that too, and it went green.
//
// What actually detects it is casting from the EYE POSITION IT WAS REPORTED FROM,
// across the whole view. Measured against the real bug from the owner's own camera:
// 4 of 2640 rays reached the sky with straight lintels, 0 with tapered ones. So the
// poses below ARE the test, and adding a reported one is how this grows.

const POSES = [
  // The owner's exact camera from the F8 report, 2026-08-21 — looking up past the
  // annex door at the lintel band. This is the frame the tear was found in.
  { name: 'up past the annex door (the reported frame)', at: [-81.95, -38.37], yaw: 3.006, pitch: 0.312, allowSky: false },
  { name: 'the window wall lintel band', at: [-83.5, -41.5], yaw: 1.05, pitch: 0.30, allowSky: false },
  { name: 'the beach door lintel band', at: [-84.0, -38.0], yaw: 3.30, pitch: 0.34, allowSky: false },
  // …and one that SHOULD see sky, so a test that never finds anything cannot pass by
  // being blind. Straight out of the beach doorway.
  // yaw = atan2(camX - targetX, camZ - targetZ); the engine's forward is
  // (-sin yaw, -cos yaw), and getting that backwards aims at the opposite wall — the
  // same sign error that once framed three "verification" shots at empty landscape.
  { name: 'out through the beach door', at: [-84.2, -41.0], yaw: -0.136, pitch: -0.02, allowSky: true },
];

export default async function (h) {
  const R = { pass: [], fail: [] };
  const ok = (n, c, x) => (c ? R.pass : R.fail).push(n + (c ? '' : ' :: ' + JSON.stringify(x)));
  const URL = 'http://127.0.0.1:' + (process.env.SERVE_PORT || 8642) + '/the-island/?mute';

  await h.navigate(URL);
  for (let i = 0; i < 40; i++) {
    if (await h.evaluate(`typeof ABYME !== 'undefined' && !!document.getElementById('btn-begin')`).catch(() => false)) break;
    await h.wait(1);
  }
  await h.evaluate(`localStorage.setItem('abyme-muted','1'); 1`);
  await h.evaluate(`document.getElementById('btn-begin').click(); 1`);
  await h.wait(2);
  await h.evaluate(`ABYME.setIntroT(99); 1`);
  await h.wait(2.5);
  await h.evaluate(`ABYME.W.time = 8.03; ABYME.W.sunFrozen = true; 1`);
  await h.wait(0.8);

  const results = [];
  for (const p of POSES) {
    await h.evaluate(`ABYME.tp(${p.at[0]}, ${p.at[1]}, ${p.yaw}, ${p.pitch}); 1`);
    await h.wait(1.0);
    const r = await h.evaluate(`(() => {
      const T = ABYME.THREE, cam = ABYME.camera, rc = new T.Raycaster();
      rc.far = 400;
      // Only the shell and what is bolted to it can be a wall. NOTE: do NOT cull these
      // by the mesh's own origin — the masonry is baked into merged chunks whose
      // vertices are already world-space and whose object origin is (0,0,0), so an
      // "is it near the tower" test on the origin throws the walls themselves out and
      // then every ray escapes and the building appears to have no walls at all.
      const solids = [];
      ABYME.scene.traverse((o) => {
        if (!o.isMesh || o.isInstancedMesh) return;
        if (!o.visible || !o.geometry || !o.geometry.attributes || !o.geometry.attributes.position) return;
        let q = o, keep = false;
        while (q) { if (q.name === 'staticStone' || q.name === 'staticJoinery' || q.name === 'lighthouse') { keep = true; break; } q = q.parent; }
        if (keep) solids.push(o);
      });
      let sky = 0, tot = 0;
      const where = [];
      for (let gx = -0.6; gx <= 0.6; gx += 0.01) {
        for (let gy = -0.2; gy <= 0.9; gy += 0.05) {
          rc.setFromCamera(new T.Vector2(gx, gy), cam);
          const hit = rc.intersectObjects(solids, true).filter((i) => i.distance > 0.3);
          tot++;
          if (!hit.length || hit[0].distance > 30) {
            sky++;
            if (where.length < 4) where.push([+gx.toFixed(2), +gy.toFixed(2)]);
          }
        }
      }
      return JSON.stringify({ sky, tot, where, solids: solids.length });
    })()`).then(JSON.parse);
    results.push({ pose: p.name, allowSky: p.allowSky, ...r });
  }

  for (const r of results) {
    if (r.allowSky) {
      ok(`${r.pose}: sees sky (proves this test is not simply blind)`, r.sky > 0, r);
    } else {
      ok(`${r.pose}: no sky through the shell`, r.sky === 0, r);
    }
  }

  console.log(`SHELL ${R.pass.length} / ${R.pass.length + R.fail.length}`);
  for (const r of results) {
    console.log(`  ${String(r.sky).padStart(3)} / ${r.tot} sky-rays${r.allowSky ? '  (expected)' : ''} — ${r.pose}`);
  }
  if (R.fail.length) { console.log('FAILURES: ' + JSON.stringify(R.fail)); process.exitCode = 1; }
}
