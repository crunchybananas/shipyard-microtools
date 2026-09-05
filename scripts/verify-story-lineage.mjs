#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat, mkdir, cp, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const docs = resolve(root, 'docs');
const archive = resolve(docs, 'before-after');
const manifest = JSON.parse(await readFile(resolve(archive, 'manifest.json'), 'utf8'));
const directory = process.env.LINEAGE_REPORT_DIR;
if (directory) await mkdir(directory, { recursive: true });
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };

// Exercise invalid records in an isolated copy. The real archive is never edited.
const scratch = await mkdtemp(resolve(tmpdir(), 'lineage-negative-'));
try {
  await mkdir(resolve(scratch, 'docs'), { recursive: true }); await mkdir(resolve(scratch, 'scripts'));
  await cp(archive, resolve(scratch, 'docs/before-after'), { recursive: true });
  await cp(resolve(root, 'scripts/verify-before-after.mjs'), resolve(scratch, 'scripts/verify-before-after.mjs'));
  const gitDir = execFileSync('git', ['rev-parse', '--absolute-git-dir'], { cwd: root, encoding: 'utf8' }).trim();
  const env = { ...process.env, GIT_DIR: gitDir, GIT_WORK_TREE: root };
  const name = manifest.stories.find(record => record.slug === 'json-workbench-astra').data;
  const path = resolve(scratch, 'docs/before-after', name);
  const original = JSON.parse(await readFile(path, 'utf8'));
  const mutations = [
    [story => { story.lineage[0].provenance.model = 'Unverifiable Model'; }, 'cannot attribute an unrecorded model'],
    [story => { story.lineage[1].provenance.evidence.quote = 'Co-Authored-By: Claude Fable 5 <invented@example.com>'; }, 'exact repository trailer'],
    [story => { delete story.comparisons[0].frames.fable; }, 'frames must exactly cover'],
    [story => { story.comparisons[0].viewport.width = 1400; }, 'capture dimensions must match'],
    [story => { story.comparisons[0].frames.original.src = story.comparisons[0].frames.astra.src; }, 'capture filename must match'],
    [story => { story.lineage[1].commit = story.lineage[0].commit; }, 'ancestry']
  ];
  for (const [mutate, expected] of mutations) {
    const story = structuredClone(original); mutate(story); await writeFile(path, JSON.stringify(story));
    const result = spawnSync(process.execPath, ['scripts/verify-before-after.mjs'], { cwd: scratch, env, encoding: 'utf8' });
    check(result.status === 1 && result.stderr.includes(expected), `Invalid evidence rejected: ${expected}`);
  }
} finally { await rm(scratch, { recursive: true, force: true }); }

const server = createServer(async (request, response) => {
  try {
    let path = resolve(docs, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
    if (!path.startsWith(docs + sep) && path !== docs) { response.writeHead(403).end(); return; }
    if ((await stat(path)).isDirectory()) path = resolve(path, 'index.html');
    response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' })[extname(path)] || 'application/octet-stream');
    response.end(await readFile(path));
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    for (const record of manifest.stories) {
      const story = JSON.parse(await readFile(resolve(archive, record.data), 'utf8'));
      await page.goto(`${base}/before-after/${record.slug}/`);
      await page.locator('.story-title').waitFor();
      check(await page.locator('.story-title').textContent() === record.title, `${record.slug} stable route resolves`);
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), `${record.slug} fits ${viewport.width}px`);
      if (story.schemaVersion === 2) {
        check(await page.locator('.revision-button').count() === story.lineage.length, 'All recorded revisions are selectable');
        await page.locator('.revision-button').first().click();
        await page.locator('.revision-button').first().press('End');
        check(await page.locator('.revision-button').last().getAttribute('aria-pressed') === 'true', 'Keyboard navigation selects Astra');
        await page.getByRole('button', { name: 'Wipe', exact: true }).click();
        await page.getByLabel('Left revision', { exact: true }).selectOption('fable');
        await page.getByLabel('Right revision', { exact: true }).selectOption('astra');
        check(new URL(page.url()).searchParams.get('from') === 'fable', 'Share URL records its comparison pair');
        await page.reload(); await page.locator('.lineage-pair').waitFor();
        check(await page.getByLabel('Left revision', { exact: true }).inputValue() === 'fable', 'A shared pair survives reload');
        await page.getByLabel('Capture size', { exact: true }).selectOption('1');
        const ratio = await page.locator('.comparison-stage').evaluate(node => getComputedStyle(node).aspectRatio);
        check(ratio === '390 / 844', 'Mobile wipe keeps the real capture aspect ratio');
        await page.locator('.comparison-range').evaluate(node => { node.value = '100'; node.dispatchEvent(new Event('input', { bubbles: true })); });
        check(await page.locator('.comparison-range').inputValue() === '100', 'Wipe supports direct range adjustment');
        await page.getByRole('button', { name: 'Side by side', exact: true }).click();
        check(await page.locator('.lineage-panel--side img').count() === 2, 'Two complete frames can be compared');
        await page.getByRole('button', { name: 'One revision', exact: true }).click();
        await page.getByLabel('Capture size', { exact: true }).selectOption(viewport.width < 600 ? '1' : '0');
        await page.locator('.lineage-panel img').evaluate(image => image.decode());
        if (directory) {
          await page.locator('#comparison').scrollIntoViewIfNeeded();
          await page.screenshot({ path: resolve(directory, `${record.slug}-${viewport.width}.png`) });
        }
      } else {
        const scene = story.comparisons.at(-1);
        await page.locator('.scene-tab').last().click();
        check(new URL(page.url()).hash === `#${scene.id}`, `${record.slug} legacy scene hash is preserved`);
        await page.getByRole('button', { name: 'Before', exact: true }).click();
        check(await page.locator('.comparison-range').inputValue() === '100', 'Legacy Before button still selects the original');
        await page.getByRole('button', { name: 'After', exact: true }).click();
        check(await page.locator('.comparison-range').inputValue() === '0', 'Legacy After button still selects the update');
      }
      check(await page.locator('.error-block').count() === 0, 'Story has no loading error');
    }
    await page.goto(`${base}/before-after/`); await page.locator('.feature-title').waitFor();
    check((await page.locator('.feature-title').textContent()) === manifest.stories.slice().sort((a,b) => String(b.updatedAt || b.publishedAt || '').localeCompare(String(a.updatedAt || a.publishedAt || '')))[0].title, 'Latest review is visible on the archive landing page');
    check(await page.locator('.story-row').count() === manifest.stories.length, 'Every historical story remains indexed');
    await page.goto(base); await page.locator('.demo-card').first().waitFor();
    check(await page.locator('.demo-card').count() === 32, 'Hub retains all 32 existing apps');
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), 'Hub remains responsive');
    await context.close();
  }
  check(errors.length === 0, `Page/console errors: ${errors.join('; ')}`);
  console.log(`Story lineage: ${checks} checks passed, including invalid evidence, all ${manifest.stories.length} routes, legacy scene controls, desktop/mobile comparison, and the hub.`);
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
