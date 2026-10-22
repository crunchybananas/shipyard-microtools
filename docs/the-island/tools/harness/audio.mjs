// audio.mjs — render the island's real sound world offline and check it.
//
// The browser gates all run muted, so nothing ever proved the audio is audible, unclipped,
// or that one footstep surface sounds different from another. This loads js/audio.js into an
// OfflineAudioContext (tools/harness/audio-bench.html), plays scripted "sheets" of events at
// exact times, and measures the result. With AUDIO_DIR set it also writes each sheet as a
// 16-bit WAV for listening.
//
//   footsteps   eight surfaces, four steps each       — audible, unclipped, spectrally distinct;
//               shingle, deck and grass each over the bed they are walked on
//   handling    book, pages, letter, slate, shelf, drawer, glass, rope, hatch — each audible
//   shore       outdoor beds + breaking waves         — waves land as discrete events
//   tower       wood steps and the music box indoors  — the room reverb carries a tail
//   air         the island's one wind: a gust, a grove's needles hissing
//   gallery     the iron rail singing in a hard gust
//   cellar      drips in the dark, the wind and the trees shut out
//   music       the era bed and its melody, surface and last winter
import { writeFileSync, mkdirSync } from 'node:fs';

export default async function (h) {
  const R = { pass: [], fail: [] };
  const ok = (n, c, x) => (c ? R.pass : R.fail).push(n + (c ? '' : ' :: ' + JSON.stringify(x)));
  const PAGE = 'http://127.0.0.1:' + (process.env.SERVE_PORT || 8642) + '/the-island/tools/harness/audio-bench.html';
  const OUT = process.env.AUDIO_DIR || null;
  if (OUT) mkdirSync(OUT, { recursive: true });

  const render = async (name, seconds, sheetSrc) => {
    await h.navigate(PAGE + '?r=' + Math.random());
    const res = await h.evaluate(`(async () => {
      const SR = 44100, SECONDS = ${seconds};
      // seeded: every render is the same render, so two sheets that differ only by their
      // scripted events differ only by those events (and nothing in the gate is luck)
      let seed = 0x2f6b1d3 | 0;
      Math.random = () => { seed = (seed + 0x6d2b79f5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
      const off = new OfflineAudioContext(2, Math.ceil(SR * SECONDS), SR);
      window.AudioContext = function () { return off; };
      localStorage.setItem('abyme-muted', '0');
      const A = (await import('/the-island/js/audio.js')).default;
      A.init(); A._running = () => true;
      // an offline render is 'suspended' at every scripted event, and A.update() rightly skips
      // itself while the live context is suspended; here time only moves when we say so
      Object.defineProperty(off, 'state', { get: () => 'running' });
      const events = [];
      const at = (t, fn) => events.push({ t, fn });
      const wave = (t) => 0.5 + 0.5 * Math.sin(t * 0.5) * 0.6 + 0.2 * Math.sin(t * 0.83 + 1.7);
      const marks = [];
      ${sheetSrc}
      // group by render quantum: OfflineAudioContext allows one suspend per frame block
      const Q = 128 / SR, groups = new Map();
      for (const e of events) { const k = Math.max(1, Math.round(e.t / Q)); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(e.fn); }
      for (const [k, fns] of groups) {
        if (k * Q >= SECONDS) continue;
        off.suspend(k * Q).then(() => { for (const fn of fns) { try { fn(); } catch (err) { console.error(err); } } off.resume(); });
      }
      const buf = await off.startRendering();
      const L = buf.getChannelData(0), Rr = buf.getChannelData(1), n = L.length;
      // measurements
      let peak = 0, nan = 0;
      for (let i = 0; i < n; i++) { const a = Math.abs(L[i]), b = Math.abs(Rr[i]); if (!(a < 10) || !(b < 10)) nan++; if (a > peak) peak = a; if (b > peak) peak = b; }
      const seg = (t0, t1, keepFrames = false) => {
        const i0 = Math.floor(t0 * SR), i1 = Math.min(n, Math.floor(t1 * SR));
        let e = 0, p = 0; for (let i = i0; i < i1; i++) { const m = (L[i] + Rr[i]) * 0.5; e += m * m; p = Math.max(p, Math.abs(m)); }
        // spectral centroid of the segment's energy-weighted average spectrum (2048-point FFTs
        // every 1024 samples): the whole step, not just its loudest instant (which is the thud)
        const N = 2048, acc = new Float64Array(N / 2), blockBand = [], framesLo = [];
        const fft = (re, im) => {
          for (let i = 1, j = 0; i < N; i++) { let bit = N >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
          for (let len = 2; len <= N; len <<= 1) { const ang = -2 * Math.PI / len; for (let i = 0; i < N; i += len) for (let j = 0; j < len / 2; j++) {
            const wr = Math.cos(ang * j), wi = Math.sin(ang * j), ur = re[i + j], ui = im[i + j];
            const vr = re[i + j + len / 2] * wr - im[i + j + len / 2] * wi, vi = re[i + j + len / 2] * wi + im[i + j + len / 2] * wr;
            re[i + j] = ur + vr; im[i + j] = ui + vi; re[i + j + len / 2] = ur - vr; im[i + j + len / 2] = ui - vi; } }
        };
        for (let b = i0; b + N < i1; b += 1024) {
          const re = new Float64Array(N), im = new Float64Array(N);
          for (let j = 0; j < N; j++) re[j] = (L[b + j] + Rr[b + j]) * 0.5 * (0.5 - 0.5 * Math.cos(2 * Math.PI * j / (N - 1)));
          fft(re, im);
          let bb = 0, lo = 0;
          for (let k = 1; k < N / 2; k++) { const pw = re[k] * re[k] + im[k] * im[k]; acc[k] += pw; const f = k * SR / N; if (f > 1500 && f < 6000) bb += pw; else if (f > 200 && f <= 1500) lo += pw; }
          blockBand.push(bb); framesLo.push(lo);
        }
        const frames = blockBand.slice();
        blockBand.sort((a, b) => a - b);
        const p90 = blockBand.length ? blockBand[Math.floor(blockBand.length * 0.9)] : 0;
        const re = { length: 0 };
        let num = 0, den = 0, band = 0; for (let k = 1; k < N / 2; k++) { const mag = Math.sqrt(acc[k]); num += mag * k * SR / N; den += mag; const f = k * SR / N; if (f > 1500 && f < 6000) band += acc[k]; }
        const blocks = Math.max(1, Math.floor((i1 - i0 - N) / 1024));
        // octave bands, and how tonal 0.9-1.6 kHz is (its loudest bin over the band's mean)
        const oct = {};
        for (const fc of [250, 500, 1000, 2000, 4000, 8000]) { let e = 0; for (let k = 1; k < N / 2; k++) { const f = k * SR / N; if (f >= fc / Math.SQRT2 && f < fc * Math.SQRT2) e += acc[k]; } oct[fc] = +(10 * Math.log10(e / blocks + 1e-12)).toFixed(1); }
        let tmx = 0, tsum = 0, tn = 0; for (let k = 1; k < N / 2; k++) { const f = k * SR / N; if (f > 900 && f < 1600) { tmx = Math.max(tmx, acc[k]); tsum += acc[k]; tn++; } }
        const tonalDb = +(10 * Math.log10(tmx / Math.max(1e-30, tsum / tn))).toFixed(1);
        return { rmsDb: +(10 * Math.log10(e / Math.max(1, i1 - i0) + 1e-12)).toFixed(1), peak: +p.toFixed(3), centroid: Math.round(num / Math.max(den, 1e-9)),
          bandDb: +(10 * Math.log10(band / blocks + 1e-12)).toFixed(1), bandP90Db: +(10 * Math.log10(p90 + 1e-12)).toFixed(1), oct, tonalDb, ...(keepFrames ? { frames, framesLo } : {}) };
      };
      // count wave events: peaks of a 100 ms RMS envelope that rise 6 dB over their surroundings
      const env = []; const hop = Math.floor(SR * 0.1);
      // on the first difference (a gentle high-pass): the breaks' crash sits above the surf bed's rumble
      for (let i = 1; i + hop < n; i += hop) { let e = 0; for (let j = 0; j < hop; j += 2) { const m = (L[i + j] + Rr[i + j]) - (L[i + j - 1] + Rr[i + j - 1]); e += m * m; } env.push(10 * Math.log10(e / (hop / 2) + 1e-12)); }
      let events_ = 0; for (let i = 8; i < env.length - 8; i++) { const lo = Math.min(...env.slice(i - 5, i)); if (env[i] === Math.max(...env.slice(i - 8, i + 9)) && env[i] - lo > 3) events_++; }
      const segs = marks.map((m) => ({ name: m.name, ...seg(m.t0, m.t1, !!m.frames) }));
      let wav = null;
      if (${!!OUT}) {
        const bytes = new ArrayBuffer(44 + n * 4), v = new DataView(bytes);
        const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
        w(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
        v.setUint32(24, SR, true); v.setUint32(28, SR * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 4, true);
        for (let i = 0; i < n; i++) { v.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); v.setInt16(46 + i * 4, Math.max(-1, Math.min(1, Rr[i])) * 32767, true); }
        let s = ''; const u8 = new Uint8Array(bytes); for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
        window.__wav = btoa(s); wav = window.__wav.length;
      }
      return JSON.stringify({ peak: +peak.toFixed(3), nan, total: seg(0, SECONDS), segs, waveEvents: events_, wav });
    })()`).then(JSON.parse);
    // the WAV comes back in 1 MB slices: one multi-megabyte CDP reply never arrives
    if (OUT && res.wav) {
      let b64 = '';
      for (let i = 0; i < res.wav; i += 1 << 20) b64 += await h.evaluate(`window.__wav.slice(${i}, ${i + (1 << 20)})`);
      writeFileSync(`${OUT}/${name}.wav`, Buffer.from(b64, 'base64'));
    }
    delete res.wav;
    console.log(`  ${name.padEnd(10)} peak ${res.peak}  rms ${res.total.rmsDb} dB  ` + res.segs.map((s) => `${s.name}:${s.rmsDb}dB/${s.centroid}Hz`).join('  '));
    return res;
  };

  // ---------------------------------------------------------------- footsteps
  const SURF = ['pebble', 'sand', 'grass', 'wood', 'deck', 'stone', 'iron', 'water'];
  const foot = await render('footsteps', SURF.length * 2.4 + 0.5, `
    const SURF = ${JSON.stringify(SURF)};
    at(0.01, () => A.update(0.016, { wavePhase: 0, shoreDist: 400, tideNear: 0, altitude: 0, interior: false, night: 0, dawn: 0, level: 9, px: 0, pz: 0, yaw: 0, mist: 0 }));
    at(0.02, () => A.amb.gain.setValueAtTime(0.0001, 0));   // footsteps only: silence the beds
    SURF.forEach((s, k) => { const t0 = 0.3 + k * 2.4; for (let i = 0; i < 4; i++) at(t0 + i * 0.46, () => A.footstep(s)); marks.push({ name: s, t0, t1: t0 + 2.0 }); });`);
  // and the same steps over the shore's own beds: footsteps must read through the surf. The
  // identical shore is rendered twice, with and without steps, and compared over one window.
  // Footsteps must read through the bed they are actually walked over. Seeded renders make a
  // bed rendered with and without steps identical, so frame by frame (46 ms) the steps' own
  // energy is the difference. Where a step lands (its loudest sixth of frames — six steps in
  // the window) it must stand above the bed in its own band (0.2-1.5 or 1.5-6 kHz, whichever
  // carries it): a signal over its masker in its own region is heard, not guessed at.
  const shoreBed = `for (let t = 0.05; t < 6; t += 0.05) at(t, () => A.update(0.05, { wavePhase: Math.min(1, Math.max(0, wave(t))), shoreDist: 4, tideNear: 1, altitude: 1.5,
      interior: false, night: 0, dawn: 0, level: 1, px: 4, pz: -104, yaw: 2.19, mist: 0, sea: null, underground: false, gust: 0.35 }));`;
  const groveBed = `for (let t = 0.05; t < 6; t += 0.05) at(t, () => A.update(0.05, { wavePhase: 0.3, shoreDist: 400, tideNear: 0.5, altitude: 9, interior: false,
      night: 0, dawn: 0, level: 1, px: 0, pz: 0, yaw: 0, mist: 0, underground: false, gust: 0.35, trees: { near: 1, x: 6, z: 0 } }));`;
  const sheet = (bedSrc, kind) => `${bedSrc}
    ${kind ? `for (let i = 0; i < 6; i++) at(2.5 + i * 0.46, () => A.footstep('${kind}'));` : ''}
    marks.push({ name: 'window', t0: 2.5, t1: 5.3, frames: true });`;
  const smrOf = (bed, both) => {
    const one = (B, S) => {
      const stepE = S.map((e, i) => Math.max(0, e - B[i]));
      const top = stepE.map((e, i) => i).sort((a, b) => stepE[b] - stepE[a]).slice(0, Math.max(1, Math.round(stepE.length / 6)));
      return +(10 * Math.log10(top.reduce((a, i) => a + stepE[i], 0) / Math.max(1e-12, top.reduce((a, i) => a + B[i], 0)))).toFixed(1);
    };
    return { hi: one(bed.frames, both.frames), lo: one(bed.framesLo, both.framesLo) };
  };
  const strip = (x) => { delete x.frames; delete x.framesLo; return x; };
  const sBed = (await render('shore-bed', 6, sheet(shoreBed, null))).segs[0];
  const grBed = (await render('grove-bed', 6, sheet(groveBed, null))).segs[0];
  const OVER = [['pebble', 'footsteps-shore', sBed, shoreBed, 'shingle on the landing beach'], ['deck', 'deck-shore', sBed, shoreBed, 'the jetty deck over the surf'],
    ['grass', 'grass-grove', grBed, groveBed, 'grass in a grove in a breeze']];
  for (const [kind, name, bed, bedSrc, where] of OVER) {
    const both = (await render(name, 6, sheet(bedSrc, kind))).segs[0];
    const smr = smrOf(bed, both);
    console.log(`  ${kind} over its bed: ${smr.lo} dB (0.2-1.5 kHz) / ${smr.hi} dB (1.5-6 kHz) above it where the steps land`);
    ok(`footsteps on ${where} stand above the bed where they land (> +3 dB in their band)`, Math.max(smr.lo, smr.hi) > 3, { smr, both: strip(both) });
  }
  strip(sBed); strip(grBed);
  ok('every surface is audible and unclipped', foot.nan === 0 && foot.peak < 0.95 && foot.segs.every((s) => s.rmsDb > -52), foot.segs);
  const C = Object.fromEntries(foot.segs.map((s) => [s.name, s.centroid]));
  const distinct = (a, b) => Math.abs(C[a] - C[b]) / Math.max(C[a], C[b]) > 0.08;
  ok('shingle, sand and grass sound different from each other', distinct('pebble', 'sand') && distinct('pebble', 'grass') && distinct('sand', 'grass'), C);
  ok('boards, deck, stone and iron sound different from each other', distinct('wood', 'stone') && distinct('wood', 'iron') && distinct('stone', 'iron')
    && distinct('deck', 'wood') && distinct('deck', 'stone') && distinct('deck', 'iron'), C);
  ok('wading is darker than shingle, and shingle brighter than sand', C.water < C.pebble && C.pebble > C.sand, C);

  // ---------------------------------------------------------------- handling
  const HANDLE = [['book', 'A.paper("book")'], ['page', 'A.paper("page")'], ['letter', 'A.paper("letter")'], ['inscription', 'A.paper("inscription")'],
    ['shelf', 'A.paper("shelf")'], ['close', 'A.paper("close")'], ['drawer', 'A.drawer()'], ['glass', 'A.glass()'], ['rope', 'A.rope()'], ['hatch', 'A.hatch()']];
  const hand = await render('handling', HANDLE.length * 1.6 + 0.6, `
    at(0.01, () => A.update(0.016, { wavePhase: 0, shoreDist: 400, tideNear: 0, altitude: 14, interior: true, night: 0, dawn: 0, level: 9, px: 0, pz: 0, yaw: 0, mist: 0 }));
    at(0.02, () => A.amb.gain.setValueAtTime(0.0001, 0));
    ${JSON.stringify(HANDLE)}.forEach(([name, call], k) => { const t0 = 0.3 + k * 1.6; at(t0, () => eval(call)); marks.push({ name, t0, t1: t0 + 1.4 }); });`);
  ok('every handled object makes an audible sound', hand.nan === 0 && hand.peak < 0.95 && hand.segs.every((s) => s.rmsDb > -55), hand.segs);

  // ---------------------------------------------------------------- shore
  const shore = await render('shore', 26, `
    for (let t = 0.05; t < 26; t += 0.05) at(t, () => A.update(0.05, { wavePhase: Math.min(1, Math.max(0, wave(t))), shoreDist: 4, tideNear: 1, altitude: 1.5, interior: false,
      night: 0, dawn: 0, level: 1, px: 4, pz: -104, yaw: 2.19, mist: 0, sea: { x: 14, z: -118 }, underground: false }));
    marks.push({ name: 'shore', t0: 2, t1: 26 });`);
  ok('the shore is audible and unclipped', shore.nan === 0 && shore.peak < 0.95 && shore.total.rmsDb > -40, shore.total);
  ok('waves land as discrete breaks, not a flat wash', shore.waveEvents >= 3, { waveEvents: shore.waveEvents });

  // ---------------------------------------------------------------- tower
  const tower = await render('tower', 12, `
    const IN = { wavePhase: 0.5, shoreDist: 80, tideNear: 1, altitude: 13.5, interior: true, night: 0, dawn: 0, level: 1, px: -85, pz: -40, yaw: 0, mist: 0, underground: false };
    for (let t = 0.05; t < 12; t += 0.1) at(t, () => A.update(0.1, IN));
    for (let i = 0; i < 6; i++) at(0.5 + i * 0.5, () => A.footstep('wood'));
    marks.push({ name: 'steps', t0: 0.4, t1: 3.6 });
    [0, 1, 2, 3, 4].forEach((k, i) => at(4.5 + i * 0.55, () => A.pluck([329.63, 392.0, 440.0, 293.66, 261.63][k], 0, 0.5, 1.4)));
    marks.push({ name: 'musicbox', t0: 4.4, t1: 8.0 });
    marks.push({ name: 'tail', t0: 8.4, t1: 10.4 });`);
  const tail = tower.segs.find((s) => s.name === 'tail'), box = tower.segs.find((s) => s.name === 'musicbox');
  ok('the tower room carries a reverb tail after the music box stops', tail.rmsDb > box.rmsDb - 40 && tail.rmsDb > -70, { box, tail });
  ok('indoors is audible and unclipped', tower.nan === 0 && tower.peak < 0.95, { peak: tower.peak });

  // ---------------------------------------------------------------- the wind
  // main.js owns one wind (`gust`); the same value sways the grass and the crowns. A gust
  // must be HEARD — louder and brighter — and a grove must hiss, more in a gust.
  const air = await render('air', 32, `
    const S = (o) => Object.assign({ wavePhase: 0.3, shoreDist: 400, tideNear: 0.5, altitude: 9, interior: false, underground: false, night: 0, dawn: 0,
      level: 1, px: 0, pz: 0, yaw: 0, mist: 0, gust: 0.15, trees: null, aloft: false }, o);
    const grove = { near: 1, x: 6, z: 0 };
    for (let t = 0.05; t < 32; t += 0.05) at(t, () => A.update(0.05, S(t < 8 ? {} : t < 14 ? { gust: 0.95 } : t < 18 ? {} : t < 25 ? { trees: grove } : { trees: grove, gust: 0.95 })));
    marks.push({ name: 'calm', t0: 3, t1: 7.8 }, { name: 'gust', t0: 9.5, t1: 13.8 }, { name: 'grove', t0: 20, t1: 24.8 }, { name: 'grove-gust', t0: 26.5, t1: 31.5 });`);
  const AS = Object.fromEntries(air.segs.map((x) => [x.name, x]));
  console.log(`  4 kHz octave: meadow ${AS.calm.oct[4000]}  grove ${AS.grove.oct[4000]}  grove in a gust ${AS['grove-gust'].oct[4000]} dB`);
  ok('a gust is heard arriving: louder and brighter than the breeze', AS.gust.rmsDb - AS.calm.rmsDb > 5 && AS.gust.centroid > AS.calm.centroid * 1.15, { calm: AS.calm, gust: AS.gust });
  // a breeze through a grove at least doubles the 4 kHz octave (a second source, clearly
  // there); a gust through it lifts that octave a further 6 dB
  ok('a grove hisses in the 4 kHz octave, and more in a gust', AS.grove.oct[4000] - AS.calm.oct[4000] > 3 && AS['grove-gust'].oct[4000] - AS.grove.oct[4000] > 6,
    { calm: AS.calm.oct, grove: AS.grove.oct, groveGust: AS['grove-gust'].oct });
  const gal = await render('gallery', 12, `
    const S = (g) => ({ wavePhase: 0.3, shoreDist: 400, tideNear: 0.5, altitude: 34.1, interior: false, underground: false, night: 0, dawn: 0,
      level: 1, px: -85, pz: -40, yaw: 0, mist: 0, gust: g, trees: null, aloft: true });
    for (let t = 0.05; t < 12; t += 0.05) at(t, () => A.update(0.05, S(t < 5 ? 0.15 : 0.95)));
    marks.push({ name: 'calm', t0: 2, t1: 4.8 }, { name: 'gust', t0: 7, t1: 11.8 });`);
  const GS = Object.fromEntries(gal.segs.map((x) => [x.name, x]));
  ok('the gallery rail sings in a gust (a tone stands out of 0.9-1.6 kHz)', GS.gust.tonalDb - GS.calm.tonalDb > 6 && gal.peak < 0.95, { calm: GS.calm.tonalDb, gust: GS.gust.tonalDb, peak: gal.peak });
  const cel = await render('cellar', 12, `
    const S = { wavePhase: 0.3, shoreDist: 400, tideNear: 0.5, altitude: 5, interior: false, underground: true, night: 0, dawn: 0,
      level: 1, px: 10, pz: -60, yaw: 0, mist: 0, gust: 0.6, trees: { near: 1, x: 14, z: -60 }, aloft: false };
    for (let t = 0.05; t < 12; t += 0.05) at(t, () => A.update(0.05, S));
    marks.push({ name: 'cellar', t0: 1, t1: 12 });`);
  ok('underground, water drips in the dark and the grove above is shut out', cel.waveEvents >= 4 && cel.nan === 0 && cel.peak < 0.95 && cel.segs[0].oct[8000] < AS.calm.oct[8000],
    { waveEvents: cel.waveEvents, cellar: cel.segs[0].oct, peak: cel.peak });

  // ---------------------------------------------------------------- music
  for (const [name, lv] of [['music-surface', 1], ['music-winter', 4]]) {
    const m = await render(name, 30, `
      const S = { wavePhase: 0.5, shoreDist: 400, tideNear: 0.5, altitude: 10, interior: false, night: 0, dawn: 0, level: ${lv}, px: 0, pz: 0, yaw: 0, mist: 0 };
      for (let t = 0.05; t < 30; t += 0.25) at(t, () => A.update(0.25, S));
      at(0.06, () => A.amb.gain.setValueAtTime(0.0001, 0));
      at(0.1, () => { A.musicTo(${lv}); });
      at(9, () => A._bedMelody()); at(19, () => A._bedMelody());
      marks.push({ name: 'bed', t0: 4, t1: 30 });`);
    ok(`the ${name.replace('music-', '')} bed is audible and unclipped`, m.nan === 0 && m.peak < 0.95 && m.total.rmsDb > -50, m.total);
  }

  console.log(`AUDIO ${R.pass.length} / ${R.pass.length + R.fail.length}`);
  if (R.fail.length) { console.log('FAILURES: ' + JSON.stringify(R.fail)); process.exitCode = 1; }
}
