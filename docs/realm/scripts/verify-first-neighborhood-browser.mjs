// Real controls and wall-clock play: no terrain, resources, citizens, or ticks
// are injected. Inspecting the map only locates visible legal click targets.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { ensureServer } from './_serve.mjs';

const server = await ensureServer();
const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });
const proof = fileURLToPath(new URL('../tmp/first-neighborhood/', import.meta.url));
await mkdir(proof, { recursive: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const guide = text => page.waitForFunction(value => document.querySelector('#tutorial-tip')?.innerText.includes(value), text);
const pause = () => page.getByRole('button', { name: 'Pause', exact: true }).click();
const play = () => page.getByRole('button', { name: 'Very fast, 4 times', exact: true }).click();
async function place(type, terrain, near = 'storehouse') {
  await page.locator(`[data-build-key="${type}"]`).click();
  const target = await page.evaluate(({ terrain, near }) => {
    const g = window.G, canvas = document.querySelector('#game'), rect = canvas.getBoundingClientRect();
    const anchor = g.buildings.find(b => b.type === near), candidates = [];
    for (let y = 0; y < g.map.length; y++) for (let x = 0; x < g.map[y].length; x++) {
      if (g.map[y][x] !== terrain || !g.fog[y][x] || g.buildingGrid[y][x]) continue;
      const cx = rect.left + ((x - y) * 32 - g.camera.x) * g.camera.zoom + rect.width / 2;
      const cy = rect.top + ((x + y) * 16 - g.camera.y) * g.camera.zoom + rect.height / 2;
      if (cx < 270 || cx > rect.right - 260 || cy < 250 || cy > rect.bottom - 180 || document.elementFromPoint(cx, cy) !== canvas) continue;
      candidates.push({ x, y, cx, cy, distance: Math.abs(x - anchor.x) + Math.abs(y - anchor.y) });
    }
    return candidates.sort((a, b) => a.distance - b.distance)[0];
  }, { terrain, near });
  assert.ok(target, `no visible legal ${type} site`);
  await page.mouse.click(target.cx, target.cy);
  await page.waitForFunction(({ type, target }) => window.G.buildings.some(b => b.type === type && b.x === target.x && b.y === target.y), { type, target });
  await page.keyboard.press('Escape');
}
try {
  await page.goto(server.gameUrl);
  await page.waitForFunction(() => window.startNewGame && window.G);
  await page.locator('#kingdom-name-input').fill('A Place Worth Building');
  await page.locator('#title-new-game').click();
  await pause();
  await page.locator('.tut-next').click();
  await place('farm', 2);
  await place('lumber', 3);
  await guide('Give your settlers a home');
  await place('house', 2);
  await guide('Resume time to let your builders finish');
  await page.screenshot({ path: proof + 'first-home-building.png' });
  await play();
  await page.waitForFunction(() => window.G.buildings.some(b => b.type === 'house' && b.buildProgress >= 1), null, { timeout: 45000 });
  await guide('Open the Research panel');
  await pause();
  assert.equal(await page.locator('#btn-research.tut-highlight').count(), 1, 'Research should be highlighted');
  assert.equal(await page.locator('#btn-founder.tut-highlight').count(), 0, 'Founder must not masquerade as Research');
  await page.screenshot({ path: proof + 'first-discovery-ready.png' });
  await page.locator('#btn-research').click();
  await guide('Choose an available Research button');
  await page.locator('.tech-card').filter({ has: page.locator('.tc-name', { hasText: 'Masonry' }) }).getByRole('button', { name: 'Research', exact: true }).click();
  await guide('Resume time to finish your discovery');
  await page.locator('#research-panel .rp-close').click();
  await page.screenshot({ path: proof + 'research-paused.png' });
  await play();
  await guide('place it beside your House');
  await pause();
  await place('well', 2, 'house');
  await guide('Resume time, then inspect your House');
  assert.equal(await page.locator('#tutorial-tip').isVisible(), true, 'guidance vanished at the fourth player building');
  await play();
  await page.waitForFunction(() => window.G.buildings.some(b => b.type === 'house' && b.level >= 2), null, { timeout: 45000 });
  await pause();
  await guide('neighborhood is taking shape');
  await page.screenshot({ path: proof + 'first-cottage.png' });
  const affordability = await page.evaluate(async () => {
    const { canAfford } = await import('./js/economy.js?realm=198');
    return [...document.querySelectorAll('[data-build-key]')].map(card => ({ type: card.dataset.buildKey, expected: canAfford(card.dataset.buildKey), enabled: !card.classList.contains('disabled') }));
  });
  for (const card of affordability) assert.equal(card.enabled, card.expected, `${card.type} affordability is stale`);
  const outcome = await page.evaluate(() => ({ day: G.day, population: G.population, happiness: G.happiness, resources: G.resources, buildings: G.buildings.map(b => ({ type: b.type, level: b.level, completed: b.buildProgress >= 1 })), guidance: document.querySelector('#tutorial-tip').innerText }));
  await page.locator('#btn-save').click();
  const savedTick = await page.evaluate(() => G.gameTick);
  await page.reload();
  await page.locator('#title-load').click();
  await page.waitForFunction(tick => G.gameTick === tick, savedTick);
  assert.equal(await page.evaluate(() => G.buildings.some(b => b.type === 'house' && b.level >= 2)), true);
  assert.deepEqual(errors, []);
  await writeFile(proof + 'report.json', JSON.stringify({ outcome, savedTick, errors }, null, 2));
  console.log('[first-neighborhood] PASS — real Farm → Lumber → completed home → Masonry → Cottage → Save/Continue', JSON.stringify(outcome));
} finally {
  await browser.close();
  await server.stop();
}
