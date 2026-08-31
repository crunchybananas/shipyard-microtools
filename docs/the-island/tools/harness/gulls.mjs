// gulls.mjs — the dawn percher must not fly through the lighthouse.
//
// At dawn gulls[0] leaves the wheeling gyre and settles on the gallery rail. It used to
// get there by lerping its CARTESIAN position from the gyre (radius 24, 32 m up) to the
// rail (radius 3.05, 21.95 m up) — a straight line that passes through the lantern and
// the dome. At mid-settle it parks the bird inside them, and the owner caught it exactly
// there: "seems like a bird caught in the tower?".
//
// It interpolates in the gyre's polar frame now, so the radius only ever shrinks toward
// the rail and the bird stays outside by construction. This walks the whole transition
// and checks that, because "it looks fine at settle 1" is not the question — the bug
// lives entirely in the middle.
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

  // THE TRANSITION IS THE TEST, and by the time a probe gets here it is already over —
  // the settle ramp takes 4.5 s and the harness spends longer than that booting. So drive
  // the bird back OUT to the gyre first (out of dawn, the ramp falls in 3 s), then put
  // dawn back and watch the whole descent. Sampling only the settled state measures the
  // one moment the bug was never in: reinstating the straight lerp scored identically.
  await h.evaluate(`ABYME.W.time = 12; ABYME.W.sunFrozen = true; 1`);
  await h.wait(4.2);
  await h.evaluate(`ABYME.W.time = 7.2; 1`);
  const m = await h.evaluate(`(() => new Promise((res) => {
    // SPOTS entries are 2D map points: .x and .y are WORLD X AND Z. The tower's heights
    // are measured from the ground under it, which is heightAt — subtracting .y from a
    // world height is subtracting a z coordinate, and it silently reports huge clearances.
    const LH = ABYME.terrain.SPOTS.lighthouse;
    const BASE = ABYME.terrain.heightAt(LH.x, LH.y);
    // the tower's own radius at a height, from its build: shaft 4.05->2.45 over 4.6..20.5,
    // the lantern 2.06 to 23.3, the dome 2.55 falling to nothing at 25.6. Take the widest
    // thing present at each height — a bird must clear ALL of it.
    const towerR = (y) => {
      const t = y - BASE;
      if (t < 4.6) return 5.35;                       // the drum
      if (t < 20.5) return 4.05 + (2.45 - 4.05) * (t - 4.6) / 15.9;
      if (t < 21.0) return 3.35;                      // the gallery deck
      if (t < 23.3) return 2.12;                      // the lantern
      if (t < 25.7) return 2.55 * Math.sqrt(Math.max(0, 1 - ((t - 23.3) / 2.3) ** 2));
      return 0.45;                                    // the vent
    };
    let worst = 1e9, worstAt = null, n = 0;
    const step = () => {
      const g = ABYME.gulls && ABYME.gulls[0];
      if (g && g.visible) {
        const rr = Math.hypot(g.position.x - LH.x, g.position.z - LH.y);
        const clear = rr - towerR(g.position.y);
        if (clear < worst) { worst = clear; worstAt = [+rr.toFixed(2), +g.position.y.toFixed(2)]; }
      }
      if (++n > 420) return res(JSON.stringify({ worstClearance: +worst.toFixed(2), worstAt, frames: n }));
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }))()`).then(JSON.parse);

  // THE WINGSPAN IS THE POINT. This measures the bird's ORIGIN against the tower, and a
  // gull is 2.64 m across — so an origin clearance of 0.98 m, which the straight lerp
  // achieves, still buries a third of a metre of wing in the copper. That is precisely
  // what the owner photographed. The bar is the half-span, not zero.
  const HALF_SPAN = 1.32;
  ok('no part of the dawn percher enters the tower', m.worstClearance > HALF_SPAN, { ...m, HALF_SPAN });
  const anatomy = await h.evaluate(`(() => {
    const gull=ABYME.perched.find(b=>b.userData.species==='gull');
    const body=gull.children.find(o=>o.isMesh), p=body.geometry.attributes.position, c=body.geometry.attributes.color;
    let eyes=0,feet=0,beak=0;
    for(let i=0;i<p.count;i++){
      const r=c.getX(i),g=c.getY(i),b=c.getZ(i),y=p.getY(i),z=p.getZ(i),lum=r*.299+g*.587+b*.114;
      if(lum<.08&&y>.42&&z>.23)eyes++;
      const ochre=r>.3&&r>g*1.25&&b<g*.45;
      if(ochre&&y<.16)feet++; if(ochre&&y>.34&&z>.28)beak++;
    }
    const wing=gull.lw.children[0].geometry, wc=wing.attributes.color;
    return JSON.stringify({bodyVerts:p.count,eyes,feet,beak,wingVerts:wing.attributes.position.count,
      wingColour:!!wc,tip:wc?Math.min(...Array.from(wc.array)):null,minY:body.geometry.boundingBox?.min.y??null});
  })()`).then(JSON.parse);
  ok('a grounded gull has eyes, beak, legs and feet in its one body draw', anatomy.eyes>0&&anatomy.feet>0&&anatomy.beak>0, anatomy);
  ok('flush wings have an elbow, swept hand and dark primaries', anatomy.wingVerts>=10&&anatomy.wingColour&&anatomy.tip<.5, anatomy);
  console.log(`GULLS ${R.pass.length} / ${R.pass.length + R.fail.length}`);
  console.log(`  closest approach ${m.worstClearance} m clear, at radius ${m.worstAt && m.worstAt[0]} / y ${m.worstAt && m.worstAt[1]}`);
  console.log(`  grounded anatomy ${anatomy.bodyVerts} verts · eyes ${anatomy.eyes} · feet ${anatomy.feet} · wing ${anatomy.wingVerts} verts`);
  if (R.fail.length) { console.log('FAILURES: ' + JSON.stringify(R.fail)); process.exitCode = 1; }
}
