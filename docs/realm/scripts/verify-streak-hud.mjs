// 233 verifier: peace-streak + life-streak HUD indicators.
// Inject state into a running realm and confirm the HUD text updates.

import { chromium } from '/Users/cloken/code/peel/admin/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ensureServer } from './_serve.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REALM_ROOT = join(__dirname, '..');
const server = await ensureServer();
const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', e => errs.push(e.message));

await page.goto(`${server.origin}/index.html`);
await page.waitForLoadState('domcontentloaded');
await page.waitForTimeout(1500);

const easy = await page.$('.diff-btn'); if (easy) await easy.click();
const start = await page.$('button:has-text("New Game"), #start-game-btn');
if (start) await start.click();
await page.waitForTimeout(1500);

// Inject conditions for both streak indicators + force a UI tick.
const result = await page.evaluate(async () => {
  const ui = await import('./js/ui.js');
  window.G.stats = window.G.stats || {};
  window.G.stats.raidsSurvived = 1;
  window.G.lastRaidDay = 5;
  window.G.day = 36;
  window.G.stats.citizensDied = 1;
  window.G.lastDeathDay = 5;
  ui.updateUI();
  return document.getElementById('day-display').innerHTML;
});

console.log('[streak-hud] day-display HTML:');
console.log(' ', result);

const hasPeace = /☮️\d+d/.test(result);
const hasLife = /🕯️\d+d/.test(result);
console.log(`[streak-hud] peace ☮️ indicator: ${hasPeace ? '✓' : '✗'}`);
console.log(`[streak-hud] life 🕯️ indicator:  ${hasLife ? '✓' : '✗'}`);

const realErrs = errs.filter(e => !/favicon/i.test(e));
if (realErrs.length) console.log('[streak-hud] errors:', realErrs);

await browser.close();
await server.stop();
process.exit(hasPeace && hasLife && realErrs.length === 0 ? 0 : 1);
