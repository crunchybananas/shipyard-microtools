#!/usr/bin/env node
// Orbital Strike control gate.
//
// verify-demos.mjs loads every demo page and fails on console errors, but it only ever
// sees the briefing screen. The mission has to actually START before the game loop runs,
// so a crash inside update() — which is where the controls live — passed that check
// silently. That is exactly how the `playerPos` ReferenceError shipped: it threw on the
// first frame, before requestAnimationFrame was re-armed, so the loop died after one
// frame and every control went dead while the page still "loaded clean".
//
// This gate starts the mission and drives it through a REAL requestAnimationFrame loop
// with REAL key events, then asserts the loop is still advancing at the end. Any throw
// inside update() stops the clock, so the clock is the thing worth asserting on.

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const docsRoot = resolve(repoRoot, 'docs');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
};

function startServer() {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      let pathname = decodeURIComponent(url.pathname);
      if (pathname.endsWith('/')) pathname += 'index.html';
      // Contain traversal: resolve, then require the result to stay under docsRoot.
      const target = normalize(join(docsRoot, pathname));
      if (target !== docsRoot && !target.startsWith(docsRoot + sep)) {
        response.writeHead(403).end('Forbidden');
        return;
      }
      const info = await stat(target);
      if (!info.isFile()) {
        response.writeHead(404).end('Not found');
        return;
      }
      response.writeHead(200, {
        'content-type': MIME[extname(target).toLowerCase()] ?? 'application/octet-stream',
        'content-length': info.size,
      });
      createReadStream(target).on('error', () => response.destroy()).pipe(response);
    } catch (error) {
      const status = error?.code === 'ENOENT' || error?.code === 'ENOTDIR' ? 404 : 500;
      response.writeHead(status).end(status === 404 ? 'Not found' : 'Server error');
    }
  });
  return new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', () => resolveListen(server));
  });
}

const checks = [];
const record = (name, pass, detail = '') => {
  checks.push({ name, pass, detail });
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const server = await startServer();
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const pageErrors = [];
const consoleErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));
page.on('console', message => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});

try {
  await page.goto(`${base}/orbital-strike/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.game !== 'undefined', null, { timeout: 10_000 });

  // Start the mission through the real button, as a player would.
  await page.click('#startBtn');
  await page.waitForTimeout(400);
  record('mission starts', await page.evaluate(() => window.game.gameState === 'playing'));

  // THE regression check: a real rAF loop must keep advancing the clock. A throw
  // anywhere in update() leaves requestAnimationFrame un-armed and freezes this.
  const clockAdvance = await page.evaluate(async () => {
    const before = window.game.clockTime;
    await new Promise(r => setTimeout(r, 1000));
    return window.game.clockTime - before;
  });
  record('game loop keeps running (rAF re-armed)', clockAdvance > 0.3,
    `clock advanced ${clockAdvance.toFixed(2)}s in 1s`);

  // Movement — real key events through the real handlers.
  const moved = await page.evaluate(() => ({ x: window.game.player.x, z: window.game.player.z }));
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(450);
  await page.keyboard.up('KeyW');
  const afterW = await page.evaluate(() => ({ x: window.game.player.x, z: window.game.player.z }));
  record('W moves the player', Math.hypot(afterW.x - moved.x, afterW.z - moved.z) > 0.2,
    `moved ${Math.hypot(afterW.x - moved.x, afterW.z - moved.z).toFixed(2)}m`);

  await page.keyboard.down('KeyD');
  await page.waitForTimeout(450);
  await page.keyboard.up('KeyD');
  const afterD = await page.evaluate(() => ({ x: window.game.player.x, z: window.game.player.z }));
  record('D strafes the player', Math.hypot(afterD.x - afterW.x, afterD.z - afterW.z) > 0.2);

  // Q cycles the weapon.
  const weaponBefore = await page.evaluate(() => window.game.currentWeapon);
  await page.keyboard.press('KeyQ');
  await page.waitForTimeout(120);
  const weaponAfter = await page.evaluate(() => window.game.currentWeapon);
  record('Q cycles weapons', weaponBefore !== weaponAfter);

  // Space fires and spends ammo.
  const ammoSpent = await page.evaluate(async () => {
    const w = () => window.game.weapons[window.game.currentWeapon].ammo;
    const before = w();
    window.game.lastShot = 0;
    window.game.shoot();
    return before - w();
  });
  record('firing spends ammo', ammoSpent > 0);

  // R runs the orbital strike once charged.
  const strike = await page.evaluate(async () => {
    window.game.strike.charge = window.game.strike.maxCharge;
    window.game.requestOrbitalStrike();
    const locked = window.game.strike.state;
    await new Promise(r => setTimeout(r, 2500));
    return { locked, settled: window.game.strike.state };
  });
  record('R runs an orbital strike', strike.locked === 'locking',
    `state went ${strike.locked} -> ${strike.settled}`);

  // P pauses and resumes.
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(150);
  const paused = await page.evaluate(() => window.game.gameState);
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(150);
  const resumed = await page.evaluate(() => window.game.gameState);
  record('P pauses and resumes', paused === 'paused' && resumed === 'playing',
    `${paused} -> ${resumed}`);

  // E recovers a station log when stood at a terminal.
  const interact = await page.evaluate(() => {
    const t = window.game.terminals[0];
    window.game.player.x = t.position.x;
    window.game.player.z = t.position.z + 1.2;
    window.game.syncPlayerPos();
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', bubbles: true }));
    const opened = window.game.gameState;
    if (opened === 'terminal') window.game.closeTerminal();
    return opened;
  });
  record('E opens a station terminal', interact === 'terminal');

  // After all that, the loop must STILL be alive — this catches a throw introduced by
  // any of the interactions above, not just by the first frame.
  const stillAlive = await page.evaluate(async () => {
    const before = window.game.clockTime;
    await new Promise(r => setTimeout(r, 800));
    return window.game.clockTime - before;
  });
  record('loop still alive after all input', stillAlive > 0.2,
    `clock advanced ${stillAlive.toFixed(2)}s`);

  record('no uncaught page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  record('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
  await new Promise(done => server.close(done));
}

const failed = checks.filter(c => !c.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
if (failed.length) {
  console.error(`\nFAILED: ${failed.map(c => c.name).join(', ')}`);
  process.exit(1);
}
console.log('Orbital Strike controls verified.');
