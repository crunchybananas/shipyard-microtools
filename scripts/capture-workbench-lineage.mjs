#!/usr/bin/env node
// Rebuild each recorded revision from Git, drive its real UI, and photograph it.
// Published stories are immutable; choose a fresh output directory to recapture.
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jsonExample, originalText, modifiedText } from './workbench-fixture.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const archive = resolve(root, 'docs/before-after');
const destination = process.env.CAPTURE_OUTPUT_DIR;
const stories = process.argv.slice(2);
if (!stories.length || stories.some(slug => !/^[a-z0-9-]+$/.test(slug))) throw new Error('Pass story slugs, for example json-workbench-astra text-diff-astra.');
const scratch = await mkdtemp(resolve(tmpdir(), 'workbench-capture-'));
const git = args => execFileSync('git', args, { cwd: root, env: { ...process.env, GIT_WORK_TREE: root }, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024 });
const server = createServer(async (request, response) => {
  try {
    let path = resolve(scratch, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
    if (!path.startsWith(scratch + sep)) { response.writeHead(403).end(); return; }
    if ((await stat(path)).isDirectory()) path = resolve(path, 'index.html');
    response.setHeader('Content-Type', ({ '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json' })[extname(path)] || 'application/octet-stream');
    response.end(await readFile(path));
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
try {
  for (const slug of stories) {
    const story = JSON.parse(await readFile(resolve(archive, 'stories', `${slug}.json`), 'utf8'));
    if (story.status === 'published' && !destination) throw new Error('Use CAPTURE_OUTPUT_DIR to avoid overwriting published evidence.');
    const directory = destination ? resolve(destination, slug) : resolve(archive, 'assets', slug);
    await mkdir(directory, { recursive: true });
    const receipts = [];
    for (const version of story.lineage) {
      const commit = git(['rev-parse', `${version.commit}^{commit}`]).toString().trim();
      const snapshot = resolve(scratch, `${slug}-${version.id}`); await mkdir(snapshot, { recursive: true });
      const paths = [`docs/${story.appSlug}`];
      try { git(['cat-file', '-e', `${commit}:docs/shared`]); paths.push('docs/shared'); } catch {}
      execFileSync('tar', ['-x', '-C', snapshot], { input: git(['archive', commit, ...paths]) });
      for (const scene of story.comparisons) {
        const page = await browser.newPage({ viewport: scene.viewport, deviceScaleFactor: 1, colorScheme: 'dark', reducedMotion: 'reduce' });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`${base}/${slug}-${version.id}/docs/${story.appSlug}/`, { waitUntil: 'networkidle' });
        if (story.appSlug === 'json-formatter') {
          await page.locator('#jsonInput').fill(jsonExample); await page.locator('#formatBtn').click();
          if (await page.locator('#treeViewBtn').count()) await page.locator('#treeViewBtn').click();
          if (version.id === 'astra') await page.getByRole('button', { name: 'Inspect /coordinates/latitude, number', exact: true }).click();
        } else {
          await page.locator('#textA').fill(originalText); await page.locator('#textB').fill(modifiedText); await page.locator('#diffBtn').click();
          if (version.id === 'astra') await page.waitForFunction(() => document.getElementById('status').textContent.includes('5 change groups'));
          const toggle = scene.id === 'mobile' ? '#unifiedViewBtn' : '#splitViewBtn';
          if (await page.locator(toggle).count()) await page.locator(toggle).click();
        }
        await page.evaluate(() => document.fonts.ready);
        // Early builds show a transient success banner that changes the layout.
        // Record the settled working state, not that temporary banner.
        await page.waitForTimeout(3200);
        await page.mouse.move(0, 0);
        await page.locator('textarea').evaluateAll(fields => fields.forEach(field => { field.scrollTop = 0; field.scrollLeft = 0; }));
        // Desktop records the entire initial viewport. Mobile aligns the working
        // result near the top, so a reader can compare the tool at readable scale.
        if (scene.id === 'mobile') {
          const selector = story.appSlug === 'json-formatter' ? version.id === 'astra' ? '.inspect-panel' : '.output-section' : '#results';
          await page.locator(selector).evaluate(node => window.scrollTo(0, Math.max(0, node.getBoundingClientRect().top + window.scrollY - 20)));
        } else await page.evaluate(() => window.scrollTo(0, 0));
        await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
        await page.waitForTimeout(120);
        const filename = `${version.id}-${scene.id}.jpg`;
        const bytes = await page.screenshot({ path: resolve(directory, filename), type: 'jpeg', quality: 92, animations: 'disabled' });
        const state = await page.evaluate(() => ({ scrollX, scrollY, title: document.title, sourceScroll: document.querySelector('textarea')?.scrollTop || 0 }));
        if (errors.length) throw new Error(`${slug}/${version.id}: ${errors.join('; ')}`);
        receipts.push({ version: version.id, commit, scene: scene.id, filename, viewport: scene.viewport, deviceScaleFactor: 1, browser: browser.version(), sha256: createHash('sha256').update(bytes).digest('hex'), ...state });
        await page.close();
      }
    }
    await writeFile(resolve(directory, 'capture-receipt.json'), JSON.stringify({ capturedAt: new Date().toISOString(), fixture: 'scripts/workbench-fixture.mjs', captures: receipts }, null, 2) + '\n');
    console.log(`${slug}: captured ${receipts.length} real screens from ${story.lineage.length} pinned revisions.`);
  }
} finally {
  await browser.close(); await new Promise(resolve => server.close(resolve)); await rm(scratch, { recursive: true, force: true });
}
