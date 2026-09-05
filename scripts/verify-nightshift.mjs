#!/usr/bin/env node
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "@playwright/test"
);
const root = resolve(dirname(fileURLToPath(import.meta.url)), ".."),
  docs = resolve(root, "docs");
const output = process.env.NIGHTSHIFT_REPORT_DIR;
if (output) await mkdir(output, { recursive: true });
const server = createServer(async (req, res) => {
  try {
    let path = resolve(
      docs,
      "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname),
    );
    if (!path.startsWith(docs + sep) && path !== docs) {
      res.writeHead(403).end();
      return;
    }
    if ((await stat(path)).isDirectory()) path = resolve(path, "index.html");
    res.setHeader(
      "Content-Type",
      {
        ".html": "text/html",
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
      }[extname(path)] || "application/octet-stream",
    );
    res.end(await readFile(path));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
let checks = 0;
const errors = [];
const check = (value, message) => {
  assert.ok(value, message);
  checks++;
};
async function downloadBytes(download) {
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}
async function importProject(page, project) {
  await page.locator("#project-menu").click();
  await page
    .locator("#project-file")
    .setInputFiles({
      name: "session.nightshift.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(project)),
    });
  await page.waitForFunction(
    () => !document.querySelector("#project-dialog").open,
  );
}
async function state(page) {
  return page.evaluate(() => Nightshift.snapshot());
}
try {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${base}/synth-studio/`);
    await page.waitForFunction(() => window.Nightshift);
    check(
      (await state(page)).audioState === "uninitialized",
      "No audio starts before a user gesture",
    );
    check(
      (await page.locator(".step").count()) === 96,
      "All six tracks expose sixteen steps",
    );
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "Instrument fits its viewport",
    );
    if (output)
      await page.screenshot({
        path: resolve(output, `nightshift-${viewport.width}.png`),
        fullPage: true,
      });
    await page.locator("#play").click();
    await page.waitForFunction(() => Nightshift.snapshot().step >= 3);
    let snapshot = await state(page);
    check(
      snapshot.playing && snapshot.audioState === "running",
      "Gesture starts actual audio-clock playback",
    );
    check(
      snapshot.activeSources > 0 && snapshot.activeSources < 180,
      "Live polyphony is active and bounded",
    );
    await page.locator('[data-scene="2"]').click();
    await page.waitForFunction(() => Nightshift.snapshot().scene === 2);
    snapshot = await state(page);
    const transition = snapshot.recentFrames.find((f) => f.scene === 2);
    check(
      transition?.step === 0,
      "A launched scene begins exactly on the next bar",
    );
    check(snapshot.mode === "loop", "Launched scene keeps looping");
    await page.locator("#motion-pad").focus();
    await page.keyboard.press("Shift+ArrowRight");
    check(
      (await state(page)).project.scenes[2].color > 0.4,
      "Keyboard can shape the performance pad",
    );
    await page.locator("#capture-motion").click();
    await page.waitForFunction(() =>
      document
        .querySelector("#capture-motion")
        .textContent.includes("Capturing "),
    );
    const rect = await page.locator("#motion-pad").boundingBox();
    await page.mouse.move(rect.x + 15, rect.y + rect.height - 20);
    await page.mouse.down();
    for (let i = 0; i < 9; i++) {
      await page.mouse.move(
        rect.x + 15 + ((rect.width - 30) * i) / 8,
        rect.y + rect.height - 20 - ((rect.height - 40) * i) / 8,
      );
      await page.waitForTimeout(110);
    }
    await page.mouse.up();
    await page.waitForFunction(
      () => Nightshift.snapshot().project.scenes[2].motionEnabled,
    );
    snapshot = await state(page);
    check(
      snapshot.project.scenes[2].motion.every(Boolean),
      "Motion capture records all sixteen steps",
    );
    check(
      new Set(snapshot.project.scenes[2].motion.map((p) => p.x.toFixed(2)))
        .size >= 4,
      "Captured motion contains the performed path",
    );
    await page.locator("#play").click();
    check(!(await state(page)).playing, "Stop halts the transport");
    await page.getByRole("button", { name: "Mute Bass", exact: true }).click();
    check(
      (await state(page)).project.tracks[3].muted,
      "Track mute changes the score mix",
    );
    await page.getByRole("button", { name: "Mute Bass", exact: true }).click();
    await page.getByRole("button", { name: "Solo Arp", exact: true }).click();
    check((await state(page)).project.tracks[5].solo, "Track solo is stored");
    await page.getByRole("button", { name: "Solo Arp", exact: true }).click();
    await page.locator('.step[data-track="3"][data-step="1"]').click();
    check(
      (await state(page)).project.scenes[2].patterns[3][1].v > 0,
      "A step edit changes the actual pattern",
    );
    await page.getByRole("button", { name: "Edit Bass", exact: true }).click();
    await page.locator('.piano-cell[data-note="9"][data-step="1"]').click();
    check(
      (await state(page)).project.scenes[2].patterns[3][1].n === 9,
      "Piano roll changes the exported note",
    );
    await page.locator("#voice-close").click();
    await page.waitForTimeout(300);
    const beforeReload = (await state(page)).project;
    await page.reload();
    await page.waitForFunction(() => window.Nightshift);
    assert.deepEqual((await state(page)).project, beforeReload);
    checks++;
    check(
      (await state(page)).audioState === "uninitialized",
      "Reload restores work without starting audio",
    );
    await page.locator("#session").selectOption("1");
    check(
      (await state(page)).project.title === "Glasshouse",
      "An alternate authored session loads",
    );
    await page.locator("#project-menu").click();
    await page.locator("#undo-project").click();
    assert.deepEqual((await state(page)).project, beforeReload);
    checks++;
    const projectDownload = page.waitForEvent("download");
    await page.locator("#save-project").click();
    const projectFile = await projectDownload;
    const saved = JSON.parse((await downloadBytes(projectFile)).toString());
    assert.deepEqual(saved, beforeReload);
    checks++;
    await page.getByRole("button", { name: "Close project dialog" }).click();
    const imported = structuredClone(saved);
    imported.title = "My night";
    imported.arrangement = [
      { scene: 2, bars: 2 },
      { scene: 1, bars: 1 },
    ];
    await importProject(page, imported);
    assert.deepEqual((await state(page)).project, imported);
    checks++;
    await page.locator("#project-menu").click();
    await page
      .locator("#project-file")
      .setInputFiles({
        name: "bad.json",
        mimeType: "application/json",
        buffer: Buffer.from('{"format":"nightshift","version":99}'),
      });
    await page.waitForFunction(() =>
      document
        .querySelector("#toast")
        .textContent.includes("Open a Nightshift"),
    );
    assert.deepEqual((await state(page)).project, imported);
    checks++;
    await page.getByRole("button", { name: "Close project dialog" }).click();
    await page.locator("#export-open").click();
    await page.locator("#export-mode").selectOption("loop");
    const wavDownload = page.waitForEvent("download");
    await page.locator("#render-wav").click();
    const wavFile = await wavDownload,
      wav = await downloadBytes(wavFile);
    check(
      wav.toString("ascii", 0, 4) === "RIFF" &&
        wav.toString("ascii", 8, 12) === "WAVE",
      "Export downloads a real WAV container",
    );
    check(
      wav.readUInt32LE(24) === 44100 &&
        wav.readUInt16LE(22) === 2 &&
        wav.readUInt16LE(34) === 16,
      "WAV is 44.1 kHz 16-bit stereo",
    );
    const expected = Math.ceil(((4 * 240) / imported.bpm + 6) * 44100);
    check(
      wav.length === 44 + expected * 4,
      "Selected-scene WAV has exactly four bars plus its effect tail",
    );
    let peak = 0,
      sum = 0,
      clips = 0;
    for (let i = 44; i < wav.length; i += 2) {
      const v = wav.readInt16LE(i) / 32768;
      peak = Math.max(peak, Math.abs(v));
      sum += v * v;
      if (Math.abs(v) > 0.999) clips++;
    }
    check(
      Math.sqrt(sum / ((wav.length - 44) / 2)) > 0.008,
      "Export contains actual musical audio",
    );
    check(peak < 1 && clips === 0, "Export has no clipped samples");
    if (output && viewport.width === 1440)
      await writeFile(resolve(output, "performed-scene.wav"), wav);
    await page.getByRole("button", { name: "Close export dialog" }).click();
    // Short song proves completion uses its arrangement and permits the tail to finish.
    const short = structuredClone(imported);
    short.bpm = 160;
    short.arrangement = [{ scene: 1, bars: 1 }];
    await importProject(page, short);
    await page.locator("#play").click();
    await page.waitForFunction(() =>
      document
        .querySelector("#transport-status")
        .textContent.includes("echoes settle"),
    );
    check((await state(page)).playing, "Song lets its effect tail finish");
    await page.waitForFunction(
      () => !Nightshift.snapshot().playing,
      {},
      { timeout: 12000 },
    );
    check(
      (await state(page)).recentFrames.filter((f) => f.scene === 1).length >=
        16,
      "Song plays a complete bar",
    );
    // Malicious text remains literal; project imports never become markup.
    const literal = structuredClone(short);
    literal.title = "<b>my night</b>";
    literal.scenes[0].name = "<svg onload=alert(1)>";
    await importProject(page, literal);
    check(
      (await page.locator("#scenes svg").count()) === 0,
      "Imported titles and scene names cannot inject HTML",
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.locator("#session").selectOption("0");
    await page.locator("#play").click();
    await page.waitForFunction(() => Nightshift.snapshot().step >= 2);
    check(
      (await state(page)).playing,
      "Reduced motion preserves the music and controls",
    );
    await page.locator("#play").click();
    await page.goto(`${base}/synth-studio/classic/`);
    check(
      (await page.locator("#preset-select").count()) === 1,
      "Original synth rack remains available",
    );
    check(
      (await page.locator('a[href="../"]').count()) >= 1,
      "Classic rack links back to Nightshift",
    );
    await context.close();
    console.log(
      `${viewport.width}px: interaction, persistence, scene timing, capture, export, and Classic rack passed.`,
    );
  }
  // Offline sound checks use real browser DSP, with the same score and renderer as playback.
  const page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}/synth-studio/`);
  const audio = await page.evaluate(async () => {
    const { createProject, clone } = await import("./score.mjs");
    const { renderAudio, SoundEngine } = await import("./audio.mjs");
    const stats = (buffer) => {
      const data = buffer.getChannelData(0);
      let peak = 0,
        power = 0,
        tail = 0,
        finite = true;
      for (const v of data) {
        peak = Math.max(peak, Math.abs(v));
        power += v * v;
        finite &&= Number.isFinite(v);
      }
      for (let i = data.length - 44100; i < data.length; i++)
        tail += data[i] * data[i];
      return {
        peak,
        rms: Math.sqrt(power / data.length),
        tail: Math.sqrt(tail / 44100),
        finite,
      };
    };
    const summaries = [];
    for (let preset = 0; preset < 3; preset++) {
      const p = createProject(preset);
      p.arrangement = [{ scene: 1, bars: 2 }];
      summaries.push(stats((await renderAudio(p)).buffer));
    }
    const p = createProject();
    p.arrangement = [{ scene: 1, bars: 1 }];
    const full = (await renderAudio(p)).buffer;
    const duplicate = (await renderAudio(p)).buffer;
    let repeatMaxDelta = 0,
      repeatPower = 0;
    const a = full.getChannelData(0),
      b = duplicate.getChannelData(0);
    for (let i = 0; i < a.length; i++) {
      const d = a[i] - b[i];
      repeatMaxDelta = Math.max(repeatMaxDelta, Math.abs(d));
      repeatPower += d * d;
    }
    const repeatRms = Math.sqrt(repeatPower / a.length);
    p.tracks.forEach((t) => (t.muted = true));
    const silence = stats((await renderAudio(p)).buffer);
    const changes = createProject();
    changes.arrangement = [{ scene: 1, bars: 1 }];
    changes.scenes[1].motionEnabled = true;
    changes.scenes[1].motion = Array.from({ length: 16 }, (_, i) => ({
      x: i / 15,
      y: 1 - i / 15,
    }));
    const moved = (await renderAudio(changes)).buffer;
    let delta = 0;
    for (let i = 0; i < a.length; i++)
      delta += Math.abs(a[i] - moved.getChannelData(0)[i]);
    const dense = createProject();
    dense.bpm = 160;
    dense.master = 1;
    dense.arrangement = [{ scene: 1, bars: 1 }];
    dense.tracks.forEach((t) => {
      t.level = 1;
      t.tone = 1;
    });
    dense.scenes[1].patterns.forEach((row) =>
      row.forEach((cell) => (cell.v = 1)),
    );
    const denseStats = stats((await renderAudio(dense)).buffer);
    const context = new AudioContext();
    await context.resume();
    const engine = new SoundEngine(context, createProject());
    engine.trigger(
      { track: 4, velocity: 0.8, notes: [50, 53, 57, 60], duration: 1 },
      context.currentTime,
    );
    const activeBefore = engine.nodes.size;
    engine.stop();
    await new Promise((r) => setTimeout(r, 200));
    const activeAfter = engine.nodes.size;
    await context.close();
    return {
      summaries,
      repeatMaxDelta,
      repeatRms,
      silence,
      delta,
      denseStats,
      activeBefore,
      activeAfter,
    };
  });
  console.log("Audio evidence", JSON.stringify(audio));
  for (const [i, stats] of audio.summaries.entries()) {
    check(
      stats.finite && stats.rms > 0.02 && stats.peak < 1,
      `Preset ${i + 1} renders finite audible unclipped samples`,
    );
    check(stats.tail < 0.00001, `Preset ${i + 1} finishes with a silent tail`);
  }
  check(
    audio.repeatRms < 0.000001 && audio.repeatMaxDelta < 0.00001,
    "Repeated render agrees within browser DSP floating-point tolerance",
  );
  check(audio.silence.peak === 0, "Muted export is silent");
  check(audio.delta > 1, "Captured motion changes the rendered samples");
  check(
    audio.denseStats.finite && audio.denseStats.peak < 1,
    "Dense maximum-volume score remains unclipped",
  );
  check(
    audio.activeBefore > 0 && audio.activeAfter === 0,
    "Stop retires the actual audio sources",
  );
  if (output)
    await writeFile(
      resolve(output, "audio-report.json"),
      JSON.stringify(audio, null, 2),
    );
  check(errors.length === 0, `No page errors: ${errors.join("; ")}`);
  console.log(
    `Nightshift: ${checks} checks passed. Three authored sessions, real DSP, desktop/mobile interactions, and WAV export verified.`,
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
