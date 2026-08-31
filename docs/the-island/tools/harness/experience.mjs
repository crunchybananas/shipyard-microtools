// experience.mjs — player-facing quality checks the state-machine walk cannot see.
//
// The walk proves that every flag can be earned. This pass proves that authored
// arrivals actually show their landmark, that the first-use copy is readable, and
// that story cues opened from a reader wait until the player can see them.
export default async function (h) {
  const R = { pass: [], fail: [] };
  const ok = (name, cond) => (cond ? R.pass : R.fail).push(name);
  const port = process.env.SERVE_PORT || 8642;

  const ready = async () => {
    for (let i = 0; i < 40; i++) {
      if (await h.evaluate(`typeof ABYME !== 'undefined' && !!document.getElementById('btn-begin')`).catch(() => false)) return;
      await h.wait(1);
    }
    throw new Error('app never booted');
  };

  await h.send('Emulation.setDeviceMetricsOverride',
    { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await h.navigate(`http://127.0.0.1:${port}/the-island/?debug&mute&localstack`);
  await ready();
  await h.evaluate(`localStorage.setItem('abyme-muted','1');
    ['abyme-save-v1','abyme-ledger-v1'].forEach(k => localStorage.removeItem(k)); 1`);
  await h.navigate(`http://127.0.0.1:${port}/the-island/?debug&mute&localstack`);
  await ready();
  await h.evaluate(`document.getElementById('btn-begin').click(); 1`);
  await h.wait(2);
  await h.evaluate(`ABYME.setIntroT(99); 1`);
  await h.wait(2.5);

  const hint = await h.evaluate(`(() => {
    const el = document.getElementById('controls-hint'), r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { left:r.left, right:r.right, top:r.top, bottom:r.bottom,
      width:r.width, height:r.height, size:parseFloat(cs.fontSize), opacity:parseFloat(cs.opacity) };
  })()`);
  ok('UX.controlsHint(on-screen)', hint.left >= 16 && hint.right <= 1264 && hint.bottom <= 704);
  ok('UX.controlsHint(readable)', hint.size >= 13 && hint.height <= 46 && hint.opacity >= 0.88);

  const arrivals = await h.evaluate(`(() => {
    const out = {};
    const sample = (level, targets, points = {}) => {
      ABYME.goLevel(level);
      ABYME.game.tick(0.05, level);
      ABYME.camera.updateMatrixWorld(true);
      const projectPoint = (p, visible = true) => {
        const d = p.distanceTo(ABYME.camera.position);
        p.project(ABYME.camera);
        return { x:+p.x.toFixed(3), y:+p.y.toFixed(3), z:+p.z.toFixed(3), d:+d.toFixed(2), visible };
      };
      const project = (o) => {
        if (!o) return null;
        const p = new ABYME.THREE.Vector3(); o.getWorldPosition(p);
        return projectPoint(p, o.visible);
      };
      const lineClear = (target) => {
        const from = ABYME.camera.position;
        for (let i = 1; i < 20; i++) {
          const t = i / 20;
          const x = from.x + (target[0] - from.x) * t;
          const y = from.y + (target[1] - from.y) * t;
          const z = from.z + (target[2] - from.z) * t;
          if (ABYME.terrain.heightAt(x, z) > y - 0.2) return false;
        }
        return true;
      };
      return {
        pos:[+ABYME.player.pos.x.toFixed(2), +ABYME.player.pos.y.toFixed(2), +ABYME.player.pos.z.toFixed(2)],
        yaw:+ABYME.player.yaw.toFixed(3), pitch:+ABYME.player.pitch.toFixed(3),
        water:+ABYME.state().waterY.toFixed(2),
        targets:Object.fromEntries([
          ...targets.map(n => [n, project(ABYME.refs[n] || ABYME.scene.getObjectByName(n))]),
          ...Object.entries(points).map(([n, xyz]) => [n, projectPoint(new ABYME.THREE.Vector3(...xyz))]),
        ]),
        clear:Object.fromEntries(Object.entries(points).map(([n, xyz]) => [n, lineClear(xyz)])),
      };
    };
    out.l2 = sample(2, ['lighthouse','climberRope','kelpSlate']);
    const kelp = ABYME.scene.getObjectByName('kelp');
    if (kelp) {
      const m = new ABYME.THREE.Matrix4(), p = new ABYME.THREE.Vector3(), s = new ABYME.THREE.Vector3();
      const P = ABYME.player.pos, yaw = ABYME.player.yaw;
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      let near = 0, corridor = 0, maxTop = -99;
      for (let i = 0; i < kelp.count; i++) {
        kelp.getMatrixAt(i, m); p.setFromMatrixPosition(m); s.setFromMatrixScale(m);
        const dx = p.x - P.x, dz = p.z - P.z;
        const ahead = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
        if (Math.hypot(dx, dz) < 4.2) near++;
        if (ahead > -1.5 && ahead < 27 && side < 3.2) corridor++;
        maxTop = Math.max(maxTop, p.y + 4.2 * s.y);
      }
      out.l2.kelp = { count:kelp.count, near, corridor, maxTop:+maxTop.toFixed(2) };
    }
    // The group's origin is inland at (0,0), while the instanced hall itself is
    // centred at z=-113. Project a real crown, not an empty transform origin.
    out.l3 = sample(3, ['bellBuoy','bluffCairn'], { hallCrown:[4,4.15,-113] });
    out.l4 = sample(4, ['modelAnchor','sourceNote','deskPlate']);
    return out;
  })()`);
  console.log('ARRIVALS', JSON.stringify(arrivals));

  // A hero target counts only when it is in front of the camera and inside the
  // central 80% of the frame. Tiny/occluded is a visual review concern; off-screen
  // is an objective authoring failure this gate can prevent.
  const framed = (p) => p && p.visible && p.z > -1 && p.z < 1 && Math.abs(p.x) < 0.8 && Math.abs(p.y) < 0.8;
  ok('VISTA.L2(lighthouse framed)', framed(arrivals.l2.targets.lighthouse));
  ok('VISTA.L2(kelp below water)', arrivals.l2.kelp && arrivals.l2.kelp.count >= 300
    && arrivals.l2.kelp.near === 0 && arrivals.l2.kelp.corridor === 0
    && arrivals.l2.kelp.maxTop <= arrivals.l2.water + 0.05);
  ok('VISTA.L3(drowned hall framed)', framed(arrivals.l3.targets.hallCrown) && arrivals.l3.clear.hallCrown);
  ok('VISTA.L4(model framed)', framed(arrivals.l4.targets.modelAnchor));

  // This arrival line names a visible event: the hall's capitals rise through
  // the water in front of the player, rather than animating behind a whole island.
  const hallBreach = await h.evaluate(`(() => {
    ABYME.goLevel(3); ABYME.game.tick(0.05, 1);
    const hall = ABYME.refs.drownedGallery;
    const before = hall.position.y;
    for (let i = 0; i < 20; i++) ABYME.game.tick(0.5, 1 + i * 0.5);
    return { before:+before.toFixed(2), after:+hall.position.y.toFixed(2),
      kept:ABYME.W.onceKeys.includes('capitalsBreached') };
  })()`);
  ok('STORY.L3Hall(emerges in view)', hallBreach.before <= 1.0 && hallBreach.after >= 2.55 && hallBreach.kept);

  // A deep-reading acknowledgement must wait behind the parchment. Before this
  // guard, its entire hold elapsed while the player was still reading page seven.
  await h.evaluate(`(() => {
    ABYME.goLevel(3);
    const U = ABYME.UI;
    clearTimeout(U._whisperTimer); U._whisperTimer = null; U._whisperQueue.length = 0;
    U.whisperEl.classList.remove('show'); U.whisperEl.textContent = '';
    U.openReader('keeper_logbook'); U.whisper('EXPERIENCE_READER_CUE', 500);
    return 1;
  })()`);
  await h.wait(0.75);
  const behind = await h.evaluate(`(() => ({ show:ABYME.UI.whisperEl.classList.contains('show'),
    queued:ABYME.UI._whisperQueue.some(w => w.text === 'EXPERIENCE_READER_CUE') }))()`);
  await h.evaluate(`ABYME.UI.closeReader(); 1`);
  await h.wait(0.4);
  const after = await h.evaluate(`(() => ({ show:ABYME.UI.whisperEl.classList.contains('show'),
    text:ABYME.UI.whisperEl.textContent }))()`);
  ok('STORY.readerCue(waits)', !behind.show && behind.queued && after.show && after.text === 'EXPERIENCE_READER_CUE');

  const bearings = await h.evaluate(`(() => {
    const F = ABYME.W.flags;
    ABYME.W.level = 1; F.enteredStudy = false; F.valveTurned = false; F.rulerTaken = false;
    ABYME.UI.renderJournal(); const shore = document.getElementById('journal-bearing').textContent;
    F.enteredStudy = true; F.valveTurned = true; ABYME.W.tideTarget = 0; ABYME.UI.renderJournal();
    const flats = document.getElementById('journal-bearing').textContent;
    return { shore, flats };
  })()`);
  ok('GAMEPLAY.journalBearing(stateful)', bearings.shore.includes('lighthouse')
    && bearings.flats.includes('drained flats') && bearings.shore !== bearings.flats);

  // The crossing remains the same authored curve, but a deliberate second input
  // opts into acceleration instead of holding the player for twenty-one seconds.
  await h.evaluate(`(() => {
    clearTimeout(ABYME.UI._whisperTimer); ABYME.UI._whisperTimer = null;
    ABYME.UI._whisperQueue.length = 0; ABYME.UI.whisperEl.classList.remove('show');
    ABYME.goLevel(1); ABYME.dive(false); return 1;
  })()`);
  await h.wait(1.4);
  const hurryShown = await h.evaluate(`document.getElementById('cinematic-hint').classList.contains('show')`);
  await h.evaluate(`document.getElementById('scene').dispatchEvent(new PointerEvent('pointerdown', { bubbles:true, button:0 })); 1`);
  await h.wait(0.25);
  const hurried = await h.evaluate(`(() => ({ dive:ABYME.getDive(),
    hint:document.getElementById('cinematic-hint').classList.contains('show') }))()`);
  ok('MECHANIC.crossingHurry(opt-in)', hurryShown && hurried.dive?.hurry === true && !hurried.hint);

  await h.wait(7.0); // accelerated crossing + the short first-arrival vista
  const diveLanded = await h.evaluate(`(() => ({ dive:ABYME.getDive(), level:ABYME.W.level,
    hint:document.getElementById('cinematic-hint').classList.contains('show'), locked:ABYME.player.locked }))()`);
  ok('MECHANIC.crossingHurry(lands cleanly)', !diveLanded.dive && diveLanded.level === 2
    && !diveLanded.hint && !diveLanded.locked);

  await h.evaluate(`ABYME.ascend(false); 1`);
  await h.wait(1.4);
  const climbHint = await h.evaluate(`document.getElementById('cinematic-hint').classList.contains('show')`);
  await h.evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code:'Space', key:' ', bubbles:true })); 1`);
  await h.wait(0.2);
  const climbHurried = await h.evaluate(`ABYME.getAscent()`);
  ok('MECHANIC.climbHurry(opt-in)', climbHint && climbHurried?.hurry === true);
  await h.wait(6.7);
  const climbLanded = await h.evaluate(`(() => ({ ascent:ABYME.getAscent(), level:ABYME.W.level,
    hint:document.getElementById('cinematic-hint').classList.contains('show'), locked:ABYME.player.locked }))()`);
  ok('MECHANIC.climbHurry(lands cleanly)', !climbLanded.ascent && climbLanded.level === 1
    && !climbLanded.hint && !climbLanded.locked);

  console.log('EXPERIENCE PASS', R.pass.length, '/', R.pass.length + R.fail.length);
  if (R.fail.length) {
    console.log('FAILURES:', JSON.stringify(R.fail));
    process.exitCode = 1;
  }
}
