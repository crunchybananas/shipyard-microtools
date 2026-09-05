#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { NOTES, STUDIES, COLORS, DURATION, blankScore, samplePath, makeHand, handAt, actorsAt,
  occupiedNotes, newProgress, evaluateStudy, validateScore, packScore, unpackScore, visitorScore } from '../docs/elsewhen/engine.mjs';
import { scoreSVG } from '../docs/elsewhen/render.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const docs = resolve(root, 'docs');
let checks = 0;
const check = (name, fn) => { fn(); checks++; console.log(`PASS ${name}`); };
const still = (index, id) => makeHand([{ ...NOTES[index], t: 0 }], id, COLORS[index % 6]);
const sweep = (id, reversed = false) => ({ ...makeHand([
  { x: 270, y: 350, t: 0 }, { x: 730, y: 350, t: 2400 },
], id, COLORS[0]), reverse: reversed });

check('Recorded timing interpolates, holds, and wraps without creating a sweeping return stroke', () => {
  const hand = sweep('a');
  assert.equal(handAt(hand, 1200).x, 500);
  assert.equal(handAt(hand, 7000).x, 730);
  assert.equal(handAt(hand, DURATION).x, 270);
  assert.equal(samplePath(hand.points, 0).x, 270);
});
check('Short reversed gestures meet their forward twins while both are moving', () => {
  const a = handAt(sweep('a'), 1200), b = handAt(sweep('b', true), 1200);
  assert.equal(a.x, b.x); assert.ok(a.vx > 0 && b.vx < 0);
  assert.equal(handAt(sweep('b', true), 7000).x, 270);
  assert.ok(evaluateStudy(STUDIES[3], newProgress(), [a, b], 1200, 16).complete);
});
check('Still hands and same-direction twins cannot fake the contrary-motion study', () => {
  const a = still(6, 'a'), b = { ...still(6, 'b'), reverse: true };
  assert.equal(evaluateStudy(STUDIES[3], newProgress(), [handAt(a, 100), handAt(b, 100)], 100, 16).complete, false);
  assert.equal(evaluateStudy(STUDIES[3], newProgress(), [handAt(sweep('a'), 1200), handAt(sweep('b'), 1200)], 1200, 16).complete, false);
});
check('A live hand needs a distinct echo, and uninterrupted overlap, to finish a study', () => {
  const score = blankScore(); score.hands = [still(0, 'a')];
  let p = newProgress();
  p = evaluateStudy(STUDIES[0], p, actorsAt(score, 0, NOTES[3]), 0, 700);
  assert.equal(p.complete, false);
  p = evaluateStudy(STUDIES[0], p, actorsAt(score, 700), 700, 100);
  assert.equal(p.held, 0);
  p = evaluateStudy(STUDIES[0], p, actorsAt(score, 800, NOTES[3]), 800, 1200);
  assert.equal(p.complete, true);
  score.hands[0].muted = true;
  assert.equal(occupiedNotes(actorsAt(score, 0, NOTES[3]))[0].length, 0);
});
check('The third study requires one echo to play the entire ordered phrase in a lap', () => {
  let p = newProgress();
  for (let i = 0; i < 6; i++) p = evaluateStudy(STUDIES[2], p, [{ ...NOTES[i], id: 'a', echo: true }], i * 800, 16);
  assert.equal(p.complete, true);
  p = evaluateStudy(STUDIES[2], newProgress(), [{ ...NOTES[0], id: 'a', echo: true }], 1, 16);
  p = evaluateStudy(STUDIES[2], p, [{ ...NOTES[1], id: 'b', echo: true }], 400, 16);
  assert.equal(p.sequence, 1);
  p = evaluateStudy(STUDIES[2], p, [], 8001, 16);
  assert.equal(p.sequence, 0);
});
check('Share and recording round-trips preserve bounded timing, reverse, mute, and offsets', () => {
  const score = visitorScore(); score.title = 'A thought / 手 / 🫧';
  score.hands[0].reverse = true; score.hands[0].offset = 3000; score.hands[1].muted = true;
  assert.deepEqual(validateScore(JSON.parse(JSON.stringify(score))), score);
  const restored = unpackScore(packScore(score));
  assert.equal(restored.title, score.title); assert.equal(restored.hands[0].offset, 3000);
  assert.equal(restored.hands[0].reverse, true); assert.equal(restored.hands[1].muted, true);
  assert.ok(Math.abs(handAt(restored.hands[2], 1234).x - handAt(score.hands[2], 1234).x) < 2);
});
check('Malformed imports cannot inject positions, IDs, colors, oversized paths, or unknown versions', () => {
  const original = visitorScore();
  const mutate = fn => { const s = structuredClone(original); fn(s); assert.throws(() => validateScore(s)); };
  mutate(s => { s.v = 999; }); mutate(s => { s.hands[0].points[0].x = NaN; });
  mutate(s => { s.hands[0].points[1].t = 0; }); mutate(s => { s.hands[0].points[0].y = -1; });
  mutate(s => { s.hands[0].points = Array(402).fill(s.hands[0].points[0]); });
  mutate(s => { s.hands[1].id = s.hands[0].id; }); mutate(s => { s.hands[0].span = Infinity; });
  mutate(s => { s.hands[0].id = '<script>'; }); mutate(s => { s.hands.push(...s.hands, s.hands[0]); });
  assert.throws(() => unpackScore({ v: 1, h: [[1, 2]] }));
  const custom = structuredClone(original); custom.hands[0].color = 'url(javascript:x)';
  assert.equal(validateScore(custom).hands[0].color, COLORS[0]);
});
check('Printable scores escape user titles and preserve real recorded geometry', () => {
  const score = visitorScore(); score.title = '</text><script>alert(1)</script>&';
  const svg = scoreSVG(score);
  assert.ok(!svg.includes('<script>')); assert.ok(svg.includes('&lt;script&gt;'));
  assert.ok(svg.includes('<polyline')); assert.ok(svg.includes('8 seconds'));
});

if (!process.argv.includes('--logic')) await browserChecks();
console.log(`\nElsewhen: ${checks} checks passed.`);

async function browserChecks() {
  const require = createRequire(import.meta.url);
  const { chromium, expect } = require('@playwright/test');
  const server = createServer(async (request, response) => {
    try {
      let pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (pathname.endsWith('/')) pathname += 'index.html';
      const path = resolve(docs, `.${pathname}`);
      if (!path.startsWith(docs + sep)) { response.writeHead(403).end(); return; }
      await stat(path);
      const mime = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml' };
      response.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream' });
      response.end(await readFile(path));
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  const pass = name => { checks++; console.log(`PASS ${name}`); };
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1512, height: 982 }, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`${origin}/elsewhen/`);
    await expect(page.locator('.bell')).toHaveCount(7);
    await expect(page.locator('#study-title')).toHaveText('A little company');
    if (process.env.ELSEWHEN_EVIDENCE) {
      await mkdir(process.env.ELSEWHEN_EVIDENCE, { recursive: true });
      await page.screenshot({ path: resolve(process.env.ELSEWHEN_EVIDENCE, 'desktop-first.png'), fullPage: true });
    }
    const recordKey = async key => {
      await page.locator('#record').click();
      await page.keyboard.down(key); await page.waitForTimeout(160); await page.keyboard.up(key);
    };
    await recordKey('1');
    await expect(page.locator('.hand')).toHaveCount(1);
    await page.keyboard.down('4');
    await expect(page.locator('#completion')).toBeVisible({ timeout: 5000 });
    await page.keyboard.up('4');
    pass('Study 1: a real recorded hand and a live keyboard hand complete simultaneous presence');

    await page.locator('#next-study').click();
    await recordKey('1'); await recordKey('3');
    await page.keyboard.down('5');
    await expect(page.locator('#completion')).toBeVisible({ timeout: 5000 });
    await page.keyboard.up('5');
    pass('Study 2: three distinct hands complete the impossible chord');

    await page.locator('#next-study').click();
    const centerOf = async index => { const box = await page.locator(`[data-note="${index}"]`).boundingBox(); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; };
    const travel = async (a, b, count = 20) => {
      for (let step = 1; step <= count; step++) {
        await page.mouse.move(a.x + (b.x - a.x) * step / count, a.y + (b.y - a.y) * step / count);
        await page.waitForTimeout(16);
      }
    };
    await page.locator('#record').click();
    let start = await centerOf(0);
    await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.waitForTimeout(80);
    for (const index of [1, 2, 3, 4, 5]) {
      const end = await centerOf(index); await travel(start, end); start = end; await page.waitForTimeout(55);
    }
    await page.mouse.up();
    await expect(page.locator('#completion')).toBeVisible({ timeout: 14000 });
    pass('Study 3: a drawn path replays the entire ordered phrase');

    await page.locator('#next-study').click();
    await page.locator('#record').click();
    start = await centerOf(0); const end = await centerOf(3);
    await page.mouse.move(start.x, start.y); await page.mouse.down(); await travel(start, end, 70); await page.mouse.up();
    await page.getByRole('button', { name: 'Make a twin of hand 1', exact: true }).click();
    await page.getByRole('button', { name: 'Play hand 2 backward', exact: true }).click();
    await expect(page.locator('#completion')).toBeVisible({ timeout: 12000 });
    pass('Study 4: one drawn gesture meets its reversed twin at the middle bell');

    await page.reload();
    await expect(page.locator('#completion')).toBeVisible();
    await expect(page.locator('.hand')).toHaveCount(2);
    assert.equal(await page.locator('.tab-number b').count(), 4);
    await page.locator('[data-study="0"]').click();
    await expect(page.locator('.hand')).toHaveCount(1);
    await page.locator('[data-study="3"]').click();
    pass('Reload preserves every study, its independent recording, and all four earned completions');

    await page.getByRole('button', { name: 'Shift hand 1 one beat ahead', exact: true }).click();
    await expect(page.locator('.hand').first().locator('[data-action="shift"]')).toHaveText('+1 beat');
    await page.getByRole('button', { name: 'Rest hand 1', exact: true }).click();
    await expect(page.locator('.hand').first()).toHaveClass(/is-muted/);
    await page.locator('#undo').click();
    await expect(page.locator('.hand').first()).not.toHaveClass(/is-muted/);
    await page.getByRole('button', { name: 'Remove hand 2', exact: true }).click();
    await expect(page.locator('.hand')).toHaveCount(1);
    await page.locator('#undo').click(); await expect(page.locator('.hand')).toHaveCount(2);
    pass('Editing shifts, rests, removes, and restores the actual recorded hands');

    await page.locator('#visitor').click(); await expect(page.locator('.hand')).toHaveCount(3);
    await page.locator('#visitor').click(); await expect(page.locator('.hand')).toHaveCount(2);
    await page.locator('#keepsake').click();
    await page.locator('#score-name').fill('Two selves / 手');
    let downloading = page.waitForEvent('download'); await page.locator('#save-score').click();
    let download = await downloading; const svg = await readFile(await download.path(), 'utf8');
    assert.ok(svg.includes('Two selves / 手')); assert.ok(svg.includes('<polyline'));
    downloading = page.waitForEvent('download'); await page.locator('#save-recording').click();
    download = await downloading; const savedPath = await download.path();
    const saved = validateScore(JSON.parse(await readFile(savedPath, 'utf8')));
    assert.equal(saved.hands.length, 2);
    await page.locator('#share').click();
    const share = await page.evaluate(() => navigator.clipboard.readText());
    assert.ok(share.includes('#score='));
    const linked = await context.newPage(); await linked.goto(share);
    await expect(linked.locator('.hand')).toHaveCount(2);
    await linked.locator('#keepsake').click(); await expect(linked.locator('#score-name')).toHaveValue('Two selves / 手');
    await linked.close();
    await page.locator('#import').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"v":99}') });
    await expect(page.locator('#dialog-status')).toContainText('not an Elsewhen recording');
    await expect(page.locator('.hand')).toHaveCount(2);
    await page.locator('#import').setInputFiles({ name: 'saved.elsewhen.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(saved)) });
    await expect(page.locator('#keepsake-dialog')).not.toBeVisible();
    pass('Visitor isolation, printable SVG, JSON reimport, replay links, Unicode, and rejected malformed files work');

    await page.locator('[data-study="4"]').click();
    await recordKey('1');
    for (let i = 1; i < 6; i++) await page.getByRole('button', { name: 'Make a twin of hand 1', exact: true }).click();
    await expect(page.locator('.hand')).toHaveCount(6);
    await expect(page.locator('#record')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Make a twin of hand 1', exact: true })).toBeDisabled();
    pass('Six-hand limit is enforced by recording and duplication controls');

    await page.locator('#visitor').click();
    await page.waitForTimeout(1200);
    await expect(page.locator('#notice')).toHaveText('', { timeout: 6000 });
    if (process.env.ELSEWHEN_EVIDENCE) await page.screenshot({ path: resolve(process.env.ELSEWHEN_EVIDENCE, 'desktop-playing.png'), fullPage: true });
    await page.locator('#visitor').click();
    await page.locator('#play').click();
    const before = await page.locator('#time-fill').getAttribute('style'); await page.waitForTimeout(200);
    assert.equal(await page.locator('#time-fill').getAttribute('style'), before);
    pass('Pausing freezes transport');

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, reducedMotion: 'reduce' });
    const phone = await mobile.newPage();
    phone.on('pageerror', e => errors.push(e.message));
    await phone.goto(`${origin}/elsewhen/`);
    await phone.locator('#record').tap(); await phone.locator('[data-note="0"]').tap();
    await expect(phone.locator('.hand')).toHaveCount(1);
    const cdp = await mobile.newCDPSession(phone);
    const box = await phone.locator('[data-note="3"]').boundingBox();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
    await expect(phone.locator('#completion')).toBeVisible({ timeout: 5000 });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.equal(overflow, 0);
    await phone.locator('#visitor').tap();
    await expect(phone.locator('#notice')).toHaveText('', { timeout: 6000 });
    if (process.env.ELSEWHEN_EVIDENCE) await phone.screenshot({ path: resolve(process.env.ELSEWHEN_EVIDENCE, 'mobile.png'), fullPage: true });
    await phone.locator('#visitor').tap();
    await phone.locator('#record').tap();
    const first = await phone.locator('[data-note="0"]').boundingBox();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: first.x + first.width / 2, y: first.y + first.height / 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await expect(phone.locator('#record-label')).toHaveText('Leave a hand');
    await expect(phone.locator('.hand')).toHaveCount(1);
    pass('Mobile touch completes a study without overflow, and interrupted touches discard incomplete recordings');

    const blocked = await browser.newContext();
    await blocked.addInitScript(() => {
      Storage.prototype.setItem = () => { throw new DOMException('Storage blocked', 'SecurityError'); };
    });
    const blockedPage = await blocked.newPage();
    await blockedPage.goto(`${origin}/elsewhen/#score=bad-link`);
    await blockedPage.locator('#record').click();
    await blockedPage.keyboard.down('1'); await blockedPage.waitForTimeout(60); await blockedPage.keyboard.up('1');
    await expect(blockedPage.locator('.hand')).toHaveCount(1);
    await expect(blockedPage.locator('#save-status')).toContainText('Browser storage is unavailable');
    pass('Bad replay links and blocked storage leave the instrument playable with export guidance');
    assert.deepEqual(errors, []);
    pass('Desktop and mobile interaction flows produce no browser errors');
    await context.close(); await mobile.close(); await blocked.close();
  } finally {
    await browser?.close();
    await new Promise(resolveClose => server.close(resolveClose));
  }
}
