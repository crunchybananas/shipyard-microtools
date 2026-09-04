#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { resolve, extname, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const docs = resolve(root, 'docs');
const output = process.env.WORKBENCH_REPORT_DIR;
if (output) await mkdir(output, { recursive: true });
const server = createServer(async (request, response) => {
  try {
    let path = resolve(docs, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
    if (!path.startsWith(docs + sep) && path !== docs) { response.writeHead(403).end(); return; }
    if ((await stat(path)).isDirectory()) path = resolve(path, 'index.html');
    const types = { '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.html': 'text/html', '.jpg': 'image/jpeg', '.png': 'image/png' };
    response.setHeader('Content-Type', types[extname(path)] || 'application/octet-stream');
    response.end(await readFile(path));
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const errors = [];
let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks++; };
async function ready(page, pattern) { await page.waitForFunction(pattern => new RegExp(pattern).test(document.getElementById('status').textContent), pattern); }
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`${base}/json-formatter/`);
    await page.locator('#sampleBtn').click();
    await ready(page, 'Valid JSON');
    check(await page.locator('.tree-row').count() > 8, 'JSON example renders its structure');
    await page.locator('#search').fill('latitude');
    await page.getByRole('button', { name: 'Inspect /coordinates/latitude, number', exact: true }).click();
    check(await page.locator('#selectedValue').textContent() === '44.65', 'Selecting a search result inspects the exact value');
    await page.locator('#copyPathBtn').click();
    check(await page.evaluate(() => navigator.clipboard.readText()) === '/coordinates/latitude', 'Pointer copies correctly');
    await page.locator('#jsonInput').fill('{"a/b":{"~key":90071992547409931234},"same":1,"same":2}');
    await page.locator('#minifyBtn').click();
    check((await page.locator('#output').textContent()).includes('90071992547409931234'), 'Large number stays exact');
    check((await page.locator('#status').textContent()).includes('duplicate'), 'Duplicate keys are disclosed');
    const downloadPromise = page.waitForEvent('download'); await page.locator('#downloadBtn').click();
    const download = await downloadPromise; const stream = await download.createReadStream(); let saved = ''; for await (const chunk of stream) saved += chunk;
    check(saved === '{"a/b":{"~key":90071992547409931234},"same":1,"same":2}', 'Downloaded JSON preserves duplicate keys and precision');
    await page.locator('#jsonInput').fill('{\n  "bad": 1,\n}'); await page.locator('#validateBtn').click();
    check((await page.locator('#status').textContent()).includes('Line 3, column 1'), 'Invalid JSON has a source location');
    check(await page.locator('#copyBtn').isDisabled(), 'Invalid source cannot copy stale output');
    check(await page.locator('#jsonInput').evaluate(node => node.selectionStart) === 14, 'Go to error selects the offending character');
    await page.locator('#fileInput').setInputFiles({ name: 'fixture.json', mimeType: 'application/json', buffer: Buffer.from('{"message":"<img src=x onerror=alert(1)>"}') });
    await ready(page, 'Valid JSON'); await page.locator('#textViewBtn').click();
    check(await page.locator('#output img').count() === 0, 'Source strings cannot introduce HTML');
    await page.locator('#sampleBtn').click();
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), 'JSON fits the viewport');
    if (output) await page.screenshot({ path: resolve(output, `json-${viewport.width}.png`), fullPage: true });

    await page.goto(`${base}/text-diff/`); await page.locator('#sampleBtn').click(); await ready(page, '5 change groups');
    check(await page.locator('mark').count() >= 8, 'Changed words are highlighted');
    await page.locator('#nextBtn').click(); check(await page.locator('#changePosition').textContent() === '2 of 5 changes', 'Change navigation updates the selection');
    await page.locator('#unifiedViewBtn').click(); check(await page.locator('.diff-row.unified').count() > 5, 'Unified review works');
    await page.locator('#splitViewBtn').click(); check(await page.locator('.diff-row.split').count() > 5, 'Split review works');
    const patchPromise = page.waitForEvent('download'); await page.locator('#downloadBtn').click();
    check((await patchPromise).suggestedFilename() === 'changes.patch', 'Patch export downloads');
    await page.locator('#textA').fill('value'); await page.locator('#textB').fill('value\n'); await page.locator('#diffBtn').click(); await ready(page, '1 change group');
    check(await page.locator('.no-newline').count() === 1, 'A changed final newline is visible');
    await page.locator('#textA').fill('  value\n'); await page.locator('#textB').fill('value\n'); await page.locator('#ignoreWhitespace').check(); await page.locator('#diffBtn').click(); await ready(page, '0 change groups');
    check(await page.locator('#downloadBtn').isDisabled(), 'Filtered comparisons cannot export misleading patches');
    await page.locator('#ignoreWhitespace').uncheck();
    const many = Array.from({ length: 20000 }, (_, i) => `line ${i}`).join('\n');
    await page.locator('#fileA').setInputFiles({ name: 'large.txt', mimeType: 'text/plain', buffer: Buffer.from(many) }); await ready(page, 'File loaded');
    await page.locator('#fileB').setInputFiles({ name: 'large.txt', mimeType: 'text/plain', buffer: Buffer.from(many.replace('line 10000\n', 'changed\n')) }); await ready(page, 'File loaded');
    await page.locator('#diffBtn').click(); await ready(page, '1 change group');
    check(await page.locator('.diff-row').count() < 20, 'Focused large review renders bounded context');
    await page.locator('#contextOnly').uncheck(); check(await page.locator('.diff-row').count() <= 400, 'Full review renders at most one page of lines');
    await page.locator('#nextBtn').click(); check(await page.locator('.current-change').count() === 1, 'Navigation can reach an off-page change');
    await page.locator('#contextOnly').check();
    await page.locator('#textB').fill('Changed again'); check(await page.locator('#downloadBtn').isDisabled(), 'Edited inputs immediately invalidate the previous patch');
    await page.route('**/worker.mjs', async route => { await new Promise(resolve => setTimeout(resolve, 350)); await route.continue().catch(() => {}); });
    await page.locator('#diffBtn').click(); await page.locator('#cancelBtn').click(); await page.waitForTimeout(450);
    check((await page.locator('#status').textContent()).includes('cancelled'), 'Cancelled worker cannot restore a stale result');
    await page.unroute('**/worker.mjs');
    await page.locator('#sampleBtn').click(); await ready(page, '5 change groups');
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), 'Text Diff fits the viewport');
    if (output) await page.screenshot({ path: resolve(output, `diff-${viewport.width}.png`), fullPage: true });
    await context.close();
  }
  check(errors.length === 0, `Console/page errors: ${errors.join('; ')}`);
  console.log(`Workbenches: ${checks} browser checks passed at 1440×900 and 390×844. No console or page errors.`);
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
