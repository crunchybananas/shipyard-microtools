#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { ensureServer } from './_serve.mjs';

const contract = JSON.parse(await readFile(new URL('../runtime-contract.json', import.meta.url), 'utf8'));
assert.equal(contract.moduleRevision, 198, 'Update this gate together with current browser module URLs');

const server = await ensureServer();
const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });

async function assertRealmStarted(page, label) {
  await page.waitForFunction(() => !document.body.classList.contains('title-active'));
  const state = await page.evaluate(() => ({
    citizens: window.G?.citizens?.length,
    speed: window.G?.speed,
    titleDisplay: getComputedStyle(document.getElementById('title-screen')).display,
  }));
  assert.equal(state.citizens, 3, `${label}: fresh realm did not create its settlers`);
  assert.equal(state.speed, 1, `${label}: fresh realm did not begin moving`);
}

async function queuedClickScenario() {
  const context = await browser.newContext({ viewport: { width: 1000, height: 760 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });

  let releaseMain;
  const mainGate = new Promise(resolve => { releaseMain = resolve; });
  await page.route(`**/js/main.js?realm=${contract.moduleRevision}`, async route => {
    await mainGate;
    await route.continue();
  });

  try {
    await page.goto(`${server.gameUrl}?startup-gate=queued-${contract.moduleRevision}`, { waitUntil: 'commit' });
    const button = page.locator('#title-new-game');
    await button.waitFor({ state: 'visible' });
    await button.click();
    assert.equal(await button.isDisabled(), true, 'early New Game click was not latched during module loading');
    assert.match(await page.locator('#title-startup-status').innerText(), /Preparing your realm/i);

    releaseMain();
    await assertRealmStarted(page, 'queued click');
    assert.deepEqual(errors, [], errors.join(' | '));
  } finally {
    releaseMain();
    await context.close();
  }
}

async function rejectedWorkerScenario() {
  const context = await browser.newContext({ viewport: { width: 1000, height: 760 } });
  await context.addInitScript(() => {
    Object.defineProperty(globalThis, 'Worker', {
      configurable: true,
      value: class RejectedWorker {
        constructor() {
          throw new DOMException('Worker denied by test policy', 'SecurityError');
        }
      },
    });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });

  try {
    await page.goto(`${server.gameUrl}?startup-gate=worker-${contract.moduleRevision}`);
    await page.waitForFunction(() => typeof window.startNewGame === 'function');
    await page.locator('#title-new-game').click();
    await assertRealmStarted(page, 'Worker fallback');
    assert.deepEqual(errors, [], errors.join(' | '));
  } finally {
    await context.close();
  }
}

try {
  await queuedClickScenario();
  await rejectedWorkerScenario();
  console.log(`[startup-shell-browser] VERIFIED queued New Game click and rejected-Worker fallback on realm${contract.moduleRevision}`);
} finally {
  await browser.close();
  await server.stop();
}
