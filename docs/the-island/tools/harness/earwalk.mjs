// earwalk.mjs — record what the real game sounds like on a short scripted walk. A listening
// tool, not a gate stage: the master bus is tapped into a MediaRecorder while the player stands
// and walks through the landing, the jetty, the densest grove (a breeze, then a held hard
// gust), the study and the lantern gallery. Writes OUT/earwalk.webm and OUT/earwalk-marks.json
// (segment start times).
//
//   OUT=/tmp/ear SERVE_PORT=8663 CDP_PORT=9263 tools/harness/one.sh earwalk.mjs
//
// audio.mjs proves each voice offline, against a scripted bed; this hears them in the mix the
// game actually makes. It found the jetty's steps drowned by the surf (October 2026), which no
// offline sheet had put over the surf at the jetty's distance.
import { writeFileSync, mkdirSync } from 'node:fs';
const OUT = process.env.OUT || '/tmp/abyme-earwalk';
export default async function (h) {
  mkdirSync(OUT, { recursive: true });
  const port = process.env.SERVE_PORT;
  await h.send('Emulation.setDeviceMetricsOverride', { width: 960, height: 600, deviceScaleFactor: 1, mobile: false });
  await h.send('Page.addScriptToEvaluateOnNewDocument', { source: `try{localStorage.setItem('abyme-muted','0');localStorage.removeItem('abyme-save');}catch(e){}` });
  await h.navigate(`http://127.0.0.1:${port}/the-island/?debug&localstack`);
  for (let i = 0; i < 60; i++) { if (await h.evaluate(`typeof ABYME !== 'undefined' && !!document.getElementById('btn-begin')`).catch(() => false)) break; await h.wait(0.5); }
  await h.evaluate(`document.getElementById('btn-begin').click(); const bc=document.getElementById('begin-confirm'); if(bc&&!bc.classList.contains('hidden')) document.getElementById('btn-begin-confirm').click(); 1`);
  await h.wait(2); await h.evaluate('ABYME.setIntroT(99)'); await h.wait(2);
  const st = await h.evaluate(`(async () => {
    const A = (await import('/the-island/js/audio.js')).default;
    if (!A.ready) A.init();
    const ctx = A.master.context;
    await ctx.resume().catch(() => {});
    const dest = ctx.createMediaStreamDestination();
    A.diveFilter.connect(dest);
    window.__chunks = [];
    const rec = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 192000 });
    rec.ondataavailable = (e) => window.__chunks.push(e.data);
    rec.start(1000);
    window.__rec = rec; window.__t0 = performance.now();
    window.__marks = [];
    window.__mark = (n) => window.__marks.push([n, +((performance.now() - window.__t0) / 1000).toFixed(2)]);
    return { state: ctx.state, muted: A.muted, master: A.master.gain.value };
  })()`);
  console.log('audio', JSON.stringify(st));
  const key = async (down, code = 'KeyW', k = 'w', vk = 87) => h.send('Input.dispatchKeyEvent', { type: down ? 'keyDown' : 'keyUp', key: k, code, windowsVirtualKeyCode: vk });
  const walkFor = async (s) => { await key(true); await h.wait(s); await key(false); };
  const mark = (n) => h.evaluate(`window.__mark(${JSON.stringify(n)}); 1`);
  const A2 = Math.atan2;

  // 1. the landing: stand facing the sea, then walk the shingle
  await h.evaluate(`ABYME.W.time = 10; ABYME.wind(0.3); ABYME.tp(4, -104, ${A2(0, 1)}, 0); 1`);
  await h.wait(1); await mark('landing: standing'); await h.wait(7);
  await mark('landing: walking the shingle'); await walkFor(5);
  // 2. the jetty
  await h.evaluate(`ABYME.tp(-18, -104.2, ${A2(0, 1)}, 0); 1`); await h.wait(0.6);
  await mark('jetty: walking out'); await walkFor(4); await h.wait(2);
  // 3. a grove: the densest stand of crowns
  const g = await h.evaluate(`(() => { const S = ABYME.core.userData.treeSpots; let best = null, bn = 0;
    for (const [x, , z] of S) { let n = 0; for (const [a, , b] of S) if (Math.hypot(a - x, b - z) < 14) n++; if (n > bn) { bn = n; best = [x, z]; } }
    return { at: best, n: bn }; })()`);
  console.log('grove', JSON.stringify(g));
  await h.evaluate(`ABYME.wind(0.1); ABYME.tp(${g.at[0] + 4}, ${g.at[1] + 4}, 0.8, 0); 1`); await h.wait(1);
  await mark('grove: breeze'); await h.wait(5);
  await h.evaluate(`ABYME.wind(1); 1`); await mark('grove: hard gust'); await h.wait(6);
  await mark('grove: walking on grass'); await walkFor(4);
  // 4. the study
  await h.evaluate(`ABYME.wind(0.3); ABYME.tp(-85 + 2.5, -40, ${A2(-1, 0)}, 0); 1`); await h.wait(1);
  await mark('study: standing'); await h.wait(4);
  await mark('study: walking the boards'); await walkFor(2.5);
  // 5. the gallery (set onto its floor; the next frame keeps the floor it is on)
  await h.evaluate(`(async () => { const C = await import('/the-island/js/tower-course.js'); ABYME.player.pos.set(C.TOWER.x + 3.2, C.TOWER_TOP, C.TOWER.z); ABYME.wind(0.2); return 1; })()`);
  await h.wait(1); await mark('gallery: breeze'); await h.wait(4);
  await h.evaluate(`ABYME.wind(1); 1`); await mark('gallery: hard gust'); await h.wait(6);
  const where = await h.evaluate(`ABYME.player.pos.toArray().map(v => +v.toFixed(2))`);
  console.log('gallery pos', JSON.stringify(where));
  await mark('end');
  const n = await h.evaluate(`new Promise((res) => { window.__rec.onstop = async () => {
      const b = new Blob(window.__chunks, { type: 'audio/webm' });
      const buf = new Uint8Array(await b.arrayBuffer()); let s = '';
      for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
      window.__b64 = btoa(s); res(window.__b64.length); };
    window.__rec.stop(); })`);
  let b64 = '';
  for (let i = 0; i < n; i += 1 << 20) b64 += await h.evaluate(`window.__b64.slice(${i}, ${i + (1 << 20)})`);
  writeFileSync(`${OUT}/earwalk.webm`, Buffer.from(b64, 'base64'));
  const marks = await h.evaluate('window.__marks');
  writeFileSync(`${OUT}/earwalk-marks.json`, JSON.stringify(marks, null, 1));
  console.log('marks', JSON.stringify(marks));
  console.log('errors', JSON.stringify(await h.evaluate('window.__errs || []')));
}
