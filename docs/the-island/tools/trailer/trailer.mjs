// trailer.mjs (#142, AAA-C4) — the 90-second trailer, captured by the harness.
// Deterministic frame-stepping: every frame is tick(1/24) + composer.render() +
// captureScreenshot, so the dolly never misses a mark and the result re-renders
// identically from this script. No twist, no endings, no model-recursion imagery —
// the draft closes on the night beam (the issue's oar-out is ending imagery; the
// owner's shot-list gate decides).
//
//   node ../harness/cdp.mjs ./trailer.mjs     (server on 8642, chrome on 9223)
//   bash assemble.sh                          (frames → master.mp4 via ffmpeg)
import { mkdirSync, writeFileSync } from 'node:fs';

const FPS = 24;
const OUT = new URL('./frames/', import.meta.url).pathname;

export default async function (h) {
  const ready = async () => {
    for (let i = 0; i < 40; i++) {
      const ok = await h.evaluate(`typeof ABYME !== 'undefined' && !!document.getElementById('btn-begin')`).catch(() => false);
      if (ok) return;
      await h.wait(1);
    }
    throw new Error('no boot');
  };
  await h.navigate('http://127.0.0.1:' + (process.env.SERVE_PORT || 8642) + '/the-island/?debug&mute');
  await ready();
  await h.evaluate(`localStorage.removeItem('abyme-save-v1'); 1`);
  await h.navigate('http://127.0.0.1:' + (process.env.SERVE_PORT || 8642) + '/the-island/?debug&mute');
  await ready();
  await h.evaluate(`document.getElementById('btn-begin').click(); 1`);
  await h.wait(2);
  await h.evaluate(`ABYME.setIntroT(99); 1`);
  await h.wait(3);
  // hide every HUD element — the frame is the island only
  await h.evaluate(`(() => {
    for (const id of ['debug-panel', 'controls-hint', 'whisper', 'journal-tab', 'settings-tab', 'sound-tab', 'motion-tab', 'hotlabel']) {
      const el = document.getElementById(id); if (el) el.style.display = 'none';
    }
    document.querySelectorAll('.hud, .mobile-ui, #touch-ui').forEach((el) => { el.style.display = 'none'; });
    return 1;
  })()`);

  // one captured frame = one deterministic 1/24s step
  const step = async (shotDir, n) => {
    await h.evaluate(`(() => { ABYME.UI.cinematic(false); ABYME.player.locked = false; ABYME.game.tick(1 / ${FPS}, performance.now() / 1000); ABYME.composer.render(); return 1; })()`);
    const r = await h.send('Page.captureScreenshot', { format: 'jpeg', quality: 90 });
    writeFileSync(`${shotDir}/f${String(n).padStart(4, '0')}.jpg`, Buffer.from(r.result.data, 'base64'));
  };

  // pose + per-frame camera drive; drives run via manual pump so vistas don't lock
  const pose = (x, z, yaw, pitch, time, level = null) => h.evaluate(`(() => {
    ${'' /* level jumps use goLevel but strip its vista lock for the shoot */}
    if (${level} !== null && ABYME.W.level !== ${level}) { ABYME.goLevel(${level}); ABYME.player.locked = false; ABYME.UI.cinematic(false); }
    ABYME.W.time = ${time}; ABYME.W.timeDrift = 0;
    ABYME.tp(${x}, ${z}, 0, 0);
    const p = ABYME.player; p.yaw = ${yaw}; p.pitch = ${pitch}; p.locked = false;
    for (let i = 0; i < 6; i++) ABYME.game.tick(0.05, i * 0.05);
    return 1;
  })()`);
  const drive = (js) => h.evaluate(`(() => { const p = ABYME.player; ${js}; return 1; })()`);

  const SHOTS = [
    // [name, seconds, setup, perFrameJS(i, n)]
    ['01_beach_gold', 9, () => pose(1.5, -105.5, 2.19, 0.03, 17.6, 1),
      (i, n) => drive(`p.yaw = 2.19 + ${i / n} * 0.55; p.pitch = 0.03`)],
    ['02_stones_noon', 7, () => pose(24, -92, 0.6, 0.06, 10.5, 1),
      (i, n) => drive(`p.yaw = 0.6 - ${i / n} * 0.4; p.pos.x = 24 - ${i / n} * 2.2`)],
    ['03_gauge_dawn', 7, () => pose(-58, -96, 1.9, 0.1, 7.4, 1),
      (i, n) => drive(`p.yaw = 1.9 + ${i / n} * 0.25; p.pitch = 0.1 + ${i / n} * 0.1`)],
    ['04_kelp_arrival', 9, () => pose(1.5, -105.5, 2.19, 0.03, 10.5, 2),
      (i, n) => drive(`p.pos.x = 1.5 + ${i / n} * 3.5; p.pos.z = -105.5 + ${i / n} * 4.5; p.yaw = 2.19 + ${i / n} * 0.3`)],
    ['05_rope_still', 7, () => pose(6.5, -101, 0.35, 0.05, 10.5, 2),
      (i, n) => drive(`p.pos.z = -101 + ${i / n} * 1.6; p.pitch = 0.05 + ${i / n} * 0.06`)],
    ['06_steel_channel', 8, () => pose(90, 30, 1.32, -0.07, 10.5, 3),
      (i, n) => drive(`p.yaw = 1.32 + Math.sin(${i / n} * 1.2) * 0.12`)],
    ['07_breach', 10, async () => {
      await pose(2, -93, 0, -0.12, 10.5, 3);
      await h.evaluate(`(() => { ABYME.W.onceKeys = ABYME.W.onceKeys.filter((k) => k !== 'capitalsBreach' && k !== 'capitalsBreached'); ABYME.game._breachT = null; return 1; })()`);
    }, (i, n) => drive(`p.pos.z = -93 - ${i / n} * 1.2; p.pitch = -0.12 + ${i / n} * 0.03`)],
    ['08_lantern_round', 9, async () => {
      await pose(-84.2, -37.5, 2.7, 0.02, 10.5, 4);
      await h.evaluate(`(() => { ABYME.W.flags.roundLight = false; const g = ABYME.game; g.interact.hotspots.find((s) => s.id === 'roundLight')?.onClick(); return 1; })()`);
    }, (i, n) => drive(`p.yaw = 2.7 + ${i / n} * 0.2`)],
    ['09_night_beam', 10, async () => {
      await pose(-45, -75, 2.29, 0.18, 22.5, 1);
      await h.evaluate(`(() => { ABYME.W.lensPlaced = true; for (let i = 0; i < 34; i++) ABYME.game.tick(0.05, i * 0.05); return 1; })()`);
    }, (i, n) => drive(`p.yaw = 2.29 + ${i / n} * 0.12; p.pitch = 0.18 - ${i / n} * 0.02`)],
  ];

  for (const [name, secs, setup, perFrame] of SHOTS) {
    const dir = OUT + name;
    mkdirSync(dir, { recursive: true });
    await setup();
    await h.wait(1.2);
    const n = secs * FPS;
    for (let i = 0; i < n; i++) {
      if (perFrame) await perFrame(i, n);
      await step(dir, i);
    }
    console.log(`shot ${name}: ${n} frames`);
  }
  // the title card IS the game's title screen, buttons hidden
  await h.evaluate(`localStorage.removeItem('abyme-save-v1'); 1`);
  await h.navigate('http://127.0.0.1:' + (process.env.SERVE_PORT || 8642) + '/the-island/');
  await ready();
  await h.evaluate(`(() => {
    for (const sel of ['#title-actions', '#begin-confirm', '#btn-begin', '#btn-continue']) {
      const el = document.querySelector(sel); if (el) el.style.display = 'none';
    }
    return 1;
  })()`);
  await h.wait(2);
  const tc = await h.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(new URL('./title.png', import.meta.url).pathname, Buffer.from(tc.result.data, 'base64'));
  console.log('CAPTURE DONE → run assemble.sh');
}
