// probe.mjs — the PLAYTEST probe: walks the world the way a player does and
// reports collision anomalies the walk gate can't see.
//
// walk.mjs proves the CHAIN works (hotspots fire, flags set, endings land). It
// says nothing about whether the ground under the player is honest. This probe
// is the other half: it drives the real Player._step / walkableY and hunts the
// two failure classes an owner actually hits —
//
//   PHANTOM WALL  — dry, flat, open-looking ground the player cannot cross
//   FALL-THROUGH  — a legal step that drops the player off an interior floor
//
// It is a REPORT, not a pass/fail gate by default: run it with STRICT=1 to make
// any anomaly exit non-zero. Deterministic (no timing), so it is cheap to run
// after every slice.

export default async function (h) {
  const URL = 'http://127.0.0.1:' + (process.env.SERVE_PORT || 8642) + '/the-island/?debug&mute';
  const ready = async () => {
    for (let i = 0; i < 40; i++) {
      if (await h.evaluate(`typeof ABYME !== 'undefined' && !!document.getElementById('btn-begin')`).catch(() => false)) return;
      await h.wait(1);
    }
    throw new Error('app never booted');
  };

  await h.navigate(URL); await ready();
  await h.evaluate(`localStorage.setItem('abyme-muted','1');
    ['abyme-save-v1','abyme-ledger-v1'].forEach(k => localStorage.removeItem(k)); 1`);
  await h.navigate(URL); await ready();
  await h.evaluate(`document.getElementById('btn-begin').click(); 1`);
  await h.wait(2);
  await h.evaluate(`ABYME.setIntroT(99); 1`);
  await h.wait(2.5);

  // Shared in-page helpers. walkableY is not exported onto ABYME, but syncCamera()
  // resolves pos.y THROUGH it — so we borrow the player as the oracle, and always
  // restore its pose afterwards.
  const HELPERS = `
    const P = ABYME.player, TR = ABYME.terrain;
    const save = () => ({ x: P.pos.x, y: P.pos.y, z: P.pos.z });
    const rest = (s) => { P.pos.set(s.x, s.y, s.z); };
    const wY = (x, z) => TR.walkableY(x, z);
    const step = (x0, z0, x1, z1) => { const s = save(); P.pos.set(x0, wY(x0, z0), z0); const r = P._step(x1, z1); rest(s); return r; };
    // WHY did that step fail? Mirrors Player._step's rules in order, so a phantom
    // wall can be blamed on the exact rule instead of guessed at.
    const blame = (x0, z0, x1, z1) => {
      const hereY = wY(x0, z0), thereY = wY(x1, z1);
      if (thereY - hereY > 1.05) return 'step-up>1.05';
      if (hereY - thereY > 2.2) return 'drop>2.2';
      const tHere = TR.heightAt(x0, z0), tThere = TR.heightAt(x1, z1);
      const structural = Math.abs(hereY - tHere) > 0.4 || Math.abs(thereY - tThere) > 0.4;
      if (!structural) {
        const stride = Math.max(Math.hypot(x1 - x0, z1 - z0), 1e-4), LOOK = 0.7;
        const tAhead = TR.heightAt(x0 + (x1 - x0) / stride * LOOK, z0 + (z1 - z0) / stride * LOOK);
        if ((tAhead - tHere) / LOOK > 1.35) return 'slope-lookahead>1.35';
        if (tThere < -2.2 && tThere <= tHere + 0.02) return 'basin<-2.2';
      }
      const wy = -4.2 * (1 - ABYME.W.tide);
      if (thereY < wy - 0.5) {
        if (hereY >= wy - 0.45) return 'sea-refuses';
        if (thereY < hereY - 0.05) return 'submerged-downslope';
      }
      if (TR.wallBlocked(x0, z0, x1, z1)) {
        for (const c of TR.colliders()) {
          if ((x1 - c.x) ** 2 + (z1 - c.z) ** 2 < c.r * c.r) return 'collider r=' + c.r.toFixed(2);
        }
        return 'wall-ring';
      }
      return 'passes(?)';
    };
  `;

  const out = [];
  const anomalies = [];
  const say = (s) => { out.push(s); console.log(s); };
  const bad = (s) => { anomalies.push(s); console.log('  ANOMALY  ' + s); };

  // ---- 1. interior seal: does any interior FLOOR extend past its WALL? --------
  // A floor disc wider than its wall ring leaves an annulus where the player is
  // standing on the room's floor but already outside the room's collision — the
  // next step outward is unopposed and drops them to raw terrain. That is the
  // "fell through the world" class, and it is invisible from inside.
  say('== 1. interior seal (floor disc vs wall ring) ==');
  const seal = await h.evaluate(`(() => {${HELPERS}
    const LH = { x: -85, z: -40, name: 'study drum' };
    const AN = { x: -85 + Math.sin(0.2618) * 8.1, z: -40 + Math.cos(0.2618) * 8.1, name: 'keeper annex' };
    const FLOOR = 13.5;
    const res = [];
    for (const C of [LH, AN]) {
      const leaks = []; let minR = 99, maxR = 0;
      for (let i = 0; i < 720; i++) {
        const a = (i / 720) * Math.PI * 2;
        // PER-ANGLE floor edge: the outermost radius on this heading that is still
        // the interior floor AND is contiguous with it (stop at the first gap, so a
        // neighbouring room's disc further out can't inflate this heading's edge).
        let edge = 0;
        for (let r = 1.0; r < 12.0; r += 0.02) {
          const x = C.x + Math.sin(a) * r, z = C.z + Math.cos(a) * r;
          if (Math.abs(wY(x, z) - FLOOR) < 0.01) edge = r; else if (edge > 0) break;
        }
        if (!edge) continue;
        if (edge < minR) minR = edge;
        if (edge > maxR) maxR = edge;
        // from just inside this heading's floor edge, walk straight out
        const x0 = C.x + Math.sin(a) * (edge - 0.05), z0 = C.z + Math.cos(a) * (edge - 0.05);
        const x1 = C.x + Math.sin(a) * (edge + 0.35), z1 = C.z + Math.cos(a) * (edge + 0.35);
        const drop = wY(x0, z0) - wY(x1, z1);
        if (step(x0, z0, x1, z1) && drop > 1.0) {
          leaks.push({ deg: +(a * 180 / Math.PI).toFixed(1), r: +edge.toFixed(2), drop: +drop.toFixed(2),
                       at: [+x0.toFixed(2), +z0.toFixed(2)] });
        }
      }
      res.push({ name: C.name, minR: +minR.toFixed(2), maxR: +maxR.toFixed(2),
                 leaks, leakDegs: leaks.map((l) => l.deg) });
    }
    return res;
  })()`);
  for (const r of seal) {
    say(`  ${r.name}: floor edge r=${r.minR}..${r.maxR}  ·  ${r.leaks.length} leak heading(s)`);
    if (r.leaks.length) {
      const s = r.leaks[0];
      bad(`${r.name}: ${r.leaks.length} headings walk straight off the floor edge (first ${s.deg}°, r=${s.r}, drop ${s.drop}m) — floor extends past the wall`);
      say(`     headings: ${r.leakDegs.slice(0, 12).join('°, ')}°${r.leaks.length > 12 ? ' …' : ''}`);
    }
  }

  // ---- 2. drained-bay traversal: phantom walls on dry, flat ground -----------
  // The reported bug: after turning the valve you meet walls that are not there.
  // Sample the exposed seabed the drain reveals and flag any cell that is DRY,
  // FLAT and adjacent to walkable ground yet refuses every approach.
  say('== 2. drained bay: phantom walls on dry flat ground ==');
  await h.evaluate(`(() => { ABYME.W.tide = ABYME.W.tideTarget = 0; ABYME.W.timeDrift = 0; return 1; })()`);
  const phantom = await h.evaluate(`(() => {${HELPERS}
    const waterY = -4.2 * (1 - ABYME.W.tide);
    const hits = [];
    let dry = 0;
    // the drained routes the player is invited onto: beach → chest, and the causeway
    // the WHOLE seabed the drain exposes — the player is invited onto all of it
    const boxes = [
      { name: 'drained seabed', x0: -140, x1: 160, z0: -200, z1: -60 },
    ];
    for (const b of boxes) {
      for (let x = b.x0; x <= b.x1; x += 2) {
        for (let z = b.z0; z <= b.z1; z += 2) {
          const y = wY(x, z);
          if (y < waterY + 0.3) continue;                 // still submerged: not our claim
          // walkable-looking? the game's OWN slope limit is 1.35 over a 0.7 m look —
          // anything gentler than that reads to the player as ground they may cross
          const n = [wY(x + 2, z), wY(x - 2, z), wY(x, z + 2), wY(x, z - 2)];
          const gentle = Math.max(...n.map((v) => Math.abs(v - y))) < 1.35;
          if (!gentle) continue;
          dry++;
          // can we reach it from ANY of the four dry, flat neighbours?
          let reachable = false;
          const dirs = [[2, 0], [-2, 0], [0, 2], [0, -2]];
          for (const [dx, dz] of dirs) {
            const sx = x + dx, sz = z + dz;
            if (wY(sx, sz) < waterY + 0.3) continue;
            if (step(sx, sz, x, z)) { reachable = true; break; }
          }
          if (!reachable) {
            // blame the closest dry neighbour's refusal
            let why = '?';
            for (const [dx, dz] of dirs) {
              const sx = x + dx, sz = z + dz;
              if (wY(sx, sz) < waterY + 0.3) continue;
              why = blame(sx, sz, x, z); break;
            }
            hits.push({ at: [x, z], y: +y.toFixed(2), why });
          }
        }
      }
    }
    return { dry, hits: hits.slice(0, 400), total: hits.length };
  })()`);
  say(`  sampled ${phantom.dry} dry+flat cells · ${phantom.total} unreachable from every dry neighbour`);
  if (phantom.total > 0) {
    bad(`drained bay: ${phantom.total} dry, flat cells the player cannot step onto (phantom wall)`);
    const tally = {};
    for (const hh of phantom.hits) tally[hh.why] = (tally[hh.why] || 0) + 1;
    say(`     blame: ${Object.entries(tally).map(([k, v]) => `${k} ×${v}`).join(' · ')}`);
    for (const hh of phantom.hits.slice(0, 10)) say(`       (${hh.at[0]}, ${hh.at[1]}) y=${hh.y}  ← ${hh.why}`);
  }

  // ---- 3. fall-through sweep from the interactive spots ----------------------
  // From each place the game asks the player to stand, walk every heading and
  // flag any LEGAL step that drops them more than 1.5 m. A legal step off a
  // floor is the exact shape of "I fell through the world."
  say('== 3. fall-through sweep from the interactive spots ==');
  const falls = await h.evaluate(`(() => {${HELPERS}
    const SPOTS = [
      ['music box',    -88.6, -42.6], ['chart table',  -82.7, -38.9],
      ['sun crank',    -86.7, -41.1], ['brass plate',  -82.8, -41.4],
      ['study centre', -85.0, -40.0], ['annex',        -82.9, -32.2],
      ['wake beach',     4.0, -104.0], ['jetty',       -18.0, -110.5],
      ['stones',       135.0, -146.0], ['islet',        138.0, -141.0],
    ];
    const res = [];
    for (const [name, sx, sz] of SPOTS) {
      const y0 = wY(sx, sz);
      for (let i = 0; i < 72; i++) {
        const a = (i / 72) * Math.PI * 2;
        // creep outward in player-sized strides, like a walk
        let cx = sx, cz = sz;
        for (let s = 0; s < 24; s++) {
          const nx = cx + Math.sin(a) * 0.25, nz = cz + Math.cos(a) * 0.25;
          if (!step(cx, cz, nx, nz)) break;
          const drop = wY(cx, cz) - wY(nx, nz);
          if (drop > 1.5) {
            res.push({ name, deg: +(a * 180 / Math.PI).toFixed(0), at: [+cx.toFixed(2), +cz.toFixed(2)],
                       drop: +drop.toFixed(2), from: +wY(cx, cz).toFixed(2), to: +wY(nx, nz).toFixed(2) });
            break;
          }
          cx = nx; cz = nz;
        }
      }
    }
    return res;
  })()`);
  const byName = {};
  for (const f of falls) (byName[f.name] = byName[f.name] || []).push(f);
  for (const [name, list] of Object.entries(byName)) {
    bad(`${name}: ${list.length} heading(s) walk off a ${list[0].from}m floor down to ${list[0].to}m (drop ${list[0].drop}m)`);
    say(`     first at (${list[0].at[0]}, ${list[0].at[1]}) heading ${list[0].deg}°`);
  }
  if (!falls.length) say('  no legal step drops the player more than 1.5 m — clean');

  // ---- 4. orphan colliders: solid where nothing is drawn ---------------------
  // The "walls that don't exist" class, answered definitively: for every collider,
  // find the nearest RENDERED instance (real-scale only — the 1:240 chart-table
  // clone duplicates every name). A collider with no geometry near it is an
  // invisible wall, full stop.
  say('== 4. orphan colliders (solid with nothing drawn) ==');
  const orphans = await h.evaluate(`(() => {
    const TR = ABYME.terrain, THREE = ABYME.THREE;
    // every real-scale InstancedMesh instance position in the world
    const pts = [];
    const s = new THREE.Vector3(), p = new THREE.Vector3(), m = new THREE.Matrix4();
    ABYME.scene.traverse((o) => {
      o.updateWorldMatrix?.(true, false);
      if (o.matrixWorld) { s.setFromMatrixScale(o.matrixWorld); if (s.x < 0.5) return; }  // skip the model clone
      if (o.isInstancedMesh) {
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, m); p.setFromMatrixPosition(m).applyMatrix4(o.matrixWorld);
          pts.push([p.x, p.z, o.name || 'inst']);
        }
      }
    });
    // Merged/batched meshes have one origin far from the geometry they contain, so
    // origin-distance alone reports false orphans. Keep their world BOUNDING BOXES
    // and count a collider as covered if it falls inside one.
    const boxes = [];
    const bb = new THREE.Box3();
    ABYME.scene.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || !o.visible || !o.geometry) return;
      o.updateWorldMatrix?.(true, false);
      s.setFromMatrixScale(o.matrixWorld); if (s.x < 0.5) return;      // skip the model clone
      o.geometry.computeBoundingBox?.();
      if (!o.geometry.boundingBox) return;
      bb.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
      boxes.push([bb.min.x, bb.min.z, bb.max.x, bb.max.z, o.name || 'mesh']);
      p.setFromMatrixPosition(o.matrixWorld); pts.push([p.x, p.z, o.name || 'mesh']);
    });
    const res = [];
    for (const c of TR.colliders()) {
      let best = 1e9, what = '—';
      for (const q of pts) {
        const d = Math.hypot(q[0] - c.x, q[1] - c.z);
        if (d < best) { best = d; what = q[2]; }
      }
      // inside any real mesh's footprint? then it is not an orphan
      let covered = false;
      for (const b of boxes) {
        if (c.x >= b[0] - 0.3 && c.x <= b[2] + 0.3 && c.z >= b[1] - 0.3 && c.z <= b[3] + 0.3) {
          // only trust a SNUG box — a whole-island batch would swallow everything
          if ((b[2] - b[0]) < 12 && (b[3] - b[1]) < 12) { covered = true; what = b[4] + ' (bbox)'; break; }
        }
      }
      if (covered) continue;
      // a real prop sits within its own footprint; anything further is orphaned
      if (best > c.r + 0.6) res.push({ at: [+c.x.toFixed(1), +c.z.toFixed(1)], r: +c.r.toFixed(2),
                                       nearest: +best.toFixed(2), what });
    }
    return { total: TR.colliders().length, instances: pts.length, orphans: res };
  })()`);
  say(`  ${orphans.total} colliders vs ${orphans.instances} drawn objects · ${orphans.orphans.length} orphaned`);
  if (orphans.orphans.length) {
    bad(`${orphans.orphans.length} colliders are solid with NO geometry inside them (invisible walls)`);
    for (const o of orphans.orphans.slice(0, 12)) {
      say(`     (${o.at[0]}, ${o.at[1]}) r=${o.r} — nearest drawn thing is ${o.nearest}m away (${o.what})`);
    }
  }

  // ---- 5. sub-floor rooms: can you get back out? -----------------------------
  // Wherever a structure carves a floor BELOW the terrain (the drain chamber under
  // the stones pad, the hatch pit, the vault), a player who ends up down there must
  // have a way back up. This is the "got stuck in a room" class.
  say('== 5. sub-floor rooms: escapability ==');
  // the hatch pit and vault only EXIST once the hatch is open
  await h.evaluate(`(() => { ABYME.W.flags.hatchOpen = true; ABYME.terrain.GATES.hatchOpen = true; return 1; })()`);
  const pits = await h.evaluate(`(() => {${HELPERS}
    // flood-fill the walkable surface from a seed, honouring the real step rule,
    // and report whether the fill ever reaches open terrain again
    const canEscape = (sx, sz) => {
      const K = (x, z) => (x | 0) + ':' + (z | 0);
      const seen = new Set([K(sx, sz)]);
      let frontier = [[sx, sz]];
      for (let iter = 0; iter < 60 && frontier.length; iter++) {
        const next = [];
        for (const [x, z] of frontier) {
          for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
            const nx = x + dx, nz = z + dz;
            if (seen.has(K(nx, nz))) continue;
            if (!step(x, z, nx, nz)) continue;
            seen.add(K(nx, nz));
            // escaped once the walkable surface agrees with the terrain again
            if (Math.abs(wY(nx, nz) - TR.heightAt(nx, nz)) < 0.5) return { out: true, at: [nx, nz] };
            next.push([nx, nz]);
          }
        }
        frontier = next;
      }
      return { out: false, reached: seen.size };
    };
    const ROOMS = [
      ['drain chamber (stones pad)', 131, -150],
      ['drain chamber, far corner',  129, -153],
      ['hatch pit',                   97,  32],
      ['vault room',                  97,  20],
    ];
    return ROOMS.map(([name, x, z]) => {
      const y = wY(x, z), t = TR.heightAt(x, z);
      return { name, at: [x, z], y: +y.toFixed(2), terrain: +t.toFixed(2),
               subFloor: (t - y) > 0.5, esc: canEscape(x, z) };
    });
  })()`);
  for (const p of pits) {
    if (!p.subFloor) { say(`  ${p.name}: not a sub-floor here (y=${p.y}, terrain=${p.terrain}) — skipped`); continue; }
    if (p.esc.out) say(`  ${p.name}: y=${p.y} under terrain ${p.terrain} — ESCAPABLE (reaches open ground)`);
    else bad(`${p.name} at (${p.at[0]}, ${p.at[1]}): floor ${p.y} under terrain ${p.terrain}, ${p.esc.reached} cells reachable and NONE lead out — the player is stuck`);
  }

  // ---- 6. the wedge rescue must not drop you into a sub-floor room ------------
  say('== 6. wedge rescue soundness ==');
  const rescue = await h.evaluate(`(() => {${HELPERS}
    // drive the REAL _escapeWedge from a grid of origins and check where it lands
    const bad = [];
    for (let x = -140; x <= 160; x += 12) {
      for (let z = -200; z <= 60; z += 12) {
        const s = save();
        P.pos.set(x, wY(x, z), z);
        P._escapeWedge();
        const lx = P.pos.x, lz = P.pos.z;
        const gap = TR.heightAt(lx, lz) - wY(lx, lz);
        if (gap > 0.5) bad.push({ from: [x, z], to: [+lx.toFixed(1), +lz.toFixed(1)], gap: +gap.toFixed(2) });
        rest(s);
      }
    }
    return bad;
  })()`);
  if (rescue.length) {
    bad(`the wedge rescue lands in a sub-floor room from ${rescue.length} origin(s) — e.g. (${rescue[0].from}) → (${rescue[0].to}), ${rescue[0].gap}m below the terrain`);
  } else say('  the rescue always lands on open terrain — clean');

  // …and prove the guard is load-bearing: run the PRE-FIX candidate rule (judge on
  // terrain only) over the same origins and count how many would have dropped the
  // player into a sub-floor room. A guard that never fires is dead code.
  const wouldHave = await h.evaluate(`(() => {${HELPERS}
    const grad = (x, z) => { const e = 0.7; return Math.hypot(
      TR.heightAt(x + e, z) - TR.heightAt(x - e, z), TR.heightAt(x, z + e) - TR.heightAt(x, z - e)) / (2 * e); };
    const wy = -4.2 * (1 - ABYME.W.tide);
    let hits = 0, sample = null;
    for (let ox = -140; ox <= 160; ox += 12) {
      for (let oz = -200; oz <= 60; oz += 12) {
        outer: for (let R = 3; R <= 60; R += 1.5) {
          for (let i = 0; i < 24; i++) {
            const a = (i / 24) * Math.PI * 2;
            const x = ox + Math.cos(a) * R, z = oz + Math.sin(a) * R;
            if (TR.heightAt(x, z) > wy + 0.4 && grad(x, z) < 0.9) {     // the OLD test
              const gap = TR.heightAt(x, z) - wY(x, z);
              if (gap > 0.5) { hits++; if (!sample) sample = { from: [ox, oz], to: [+x.toFixed(1), +z.toFixed(1)], gap: +gap.toFixed(2) }; }
              break outer;
            }
          }
        }
      }
    }
    return { hits, sample };
  })()`);
  say(`  pre-fix rule would have dropped the player into a sub-floor room from ${wouldHave.hits} origin(s)` +
    (wouldHave.sample ? ` — e.g. (${wouldHave.sample.from}) → (${wouldHave.sample.to}), ${wouldHave.sample.gap}m under the terrain` : ''));

  // ---- 7. the WANDER: drive the real player and see where it ends up ---------
  // Tests 1-6 interrogate the rules. This one just plays: it walks from every
  // interactive spot in every direction with the engine's own slide-resolution
  // (try both axes, then x only, then z only — exactly what update() does), which
  // is how a player actually squeezes into places nobody designed. It reports two
  // things an owner would call bugs in the same words they used:
  //   FELL THROUGH — ended under the terrain, inside a carved sub-floor
  //   STUCK        — no heading of 16 will move you, and the wedge net can't help
  say('== 7. the wander (real movement, real slide-resolution) ==');
  const wander = await h.evaluate(`(() => {${HELPERS}
    const STRIDE = 0.07;             // ~one frame of walking at 4 m/s
    const SEEDS = [
      ['study',        -85, -40], ['music box',   -88.6, -42.6], ['chart table', -82.7, -38.9],
      ['annex',       -82.9, -32.2], ['plate',     -82.8, -41.4], ['lh outside',  -79, -46],
      ['wake beach',     4, -104], ['jetty',       -18, -110.5], ['dory',         -26, -102],
      ['stones',       135, -146], ['islet',       138, -141],   ['stones pad W', 130, -148],
      ['drain mouth',  139, -150], ['chest',       118, -176],   ['causeway A',    48, -78],
      ['causeway B',   112, -132], ['bluff',        97,  32],    ['bridge W',      36,  25],
      ['cliff',       57.5,  50], ['forest',       -30,  40],
    ];
    const fell = [], stuck = [];
    const seenFell = new Set(), seenStuck = new Set();
    for (const [name, sx, sz] of SEEDS) {
      for (let hdg = 0; hdg < 16; hdg++) {
        const a = (hdg / 16) * Math.PI * 2;
        const dx = Math.sin(a) * STRIDE, dz = Math.cos(a) * STRIDE;
        let x = sx, z = sz, prevY = wY(sx, sz);
        for (let s = 0; s < 500; s++) {
          const nx = x + dx, nz = z + dz;
          // the engine's slide-resolution, verbatim in spirit
          let mx = x, mz = z;
          if (step(x, z, nx, nz)) { mx = nx; mz = nz; }
          else if (step(x, z, nx, z)) { mx = nx; }
          else if (step(x, z, x, nz)) { mz = nz; }
          else {
            // pinned — is ANY heading open? (the engine's wedge ring test)
            let out = false;
            for (let i = 0; i < 16 && !out; i++) {
              const b = (i / 16) * Math.PI * 2;
              if (step(x, z, x + Math.cos(b) * 0.5, z + Math.sin(b) * 0.5)) out = true;
            }
            // only a spot the player WALKED to counts; a seed placed inside a
            // collider or a locked room is an artefact of the probe, not a bug
            // (and the engine's wedge net would rescue a real player anyway)
            if (!out && s > 2) {
              const k = (x | 0) + ':' + (z | 0);
              if (!seenStuck.has(k)) { seenStuck.add(k); stuck.push({ from: name, at: [+x.toFixed(1), +z.toFixed(1)], y: +wY(x, z).toFixed(2) }); }
            }
            break;
          }
          x = mx; z = mz;
          // A FALL is a DISCONTINUITY, not a low place: walking down the drain ramp
          // or the hatch stair puts you under the terrain on purpose. What must never
          // happen is the floor dropping out from under one 7 cm stride.
          const curY = wY(x, z, prevY);
          const drop = prevY - curY;
          if (drop > 1.0) {
            const k = (x | 0) + ':' + (z | 0);
            if (!seenFell.has(k)) {
              seenFell.add(k);
              fell.push({ from: name, at: [+x.toFixed(1), +z.toFixed(1)],
                          floor: +curY.toFixed(2), terrain: +TR.heightAt(x, z).toFixed(2), gap: +drop.toFixed(2) });
            }
            break;
          }
          prevY = curY;
        }
      }
    }
    return { fell, stuck };
  })()`);
  if (wander.fell.length) {
    bad(`the wander walked UNDER the terrain at ${wander.fell.length} place(s) — the "fell through the world" class`);
    for (const f of wander.fell.slice(0, 8)) {
      say(`     from ${f.from}: (${f.at[0]}, ${f.at[1]}) floor ${f.floor} under terrain ${f.terrain} (${f.gap}m)`);
    }
  } else say('  never walked under the terrain — clean');
  if (wander.stuck.length) {
    bad(`the wander got fully pinned at ${wander.stuck.length} place(s) — the "got stuck" class`);
    for (const s of wander.stuck.slice(0, 8)) say(`     from ${s.from}: (${s.at[0]}, ${s.at[1]}) y=${s.y}`);
  } else say('  never fully pinned — clean');

  console.log(`PROBE ${anomalies.length} anomal${anomalies.length === 1 ? 'y' : 'ies'}`);
  if (anomalies.length && process.env.STRICT === '1') process.exitCode = 1;
  return { anomalies, out };
}
