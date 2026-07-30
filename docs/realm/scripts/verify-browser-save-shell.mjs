// Focused browser gate for the Engine v2 save/shell boundary. This deliberately
// exercises the same title-screen entrypoints a player uses: New Game, pause,
// fast-forward, save, reload, and Continue.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { ensureServer } from './_serve.mjs';

const contract = JSON.parse(await readFile(new URL('../runtime-contract.json', import.meta.url), 'utf8'));
const REVISION = contract.moduleRevision;
assert.equal(REVISION, 176, 'Update this gate\'s literal browser module URLs for the new runtime revision');
const SAVE_KEY = contract.saveKey;
const FAST_FORWARD_DAYS = 200;
const PRESENTATION_QUEUE_LIMIT = 1_024;
const COMFORTABLE_SAVE_LIMIT_BYTES = 1_000_000;
const CONSERVATIVE_LOCAL_STORAGE_QUOTA_BYTES = 5 * 1024 * 1024;

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

// This runs inside the page. It intentionally derives the exclusion surface
// from STATE_OWNERSHIP instead of maintaining a second hand-written list.
async function captureAuthoritativeState() {
  const stateModule = await import('./js/state.js?realm=176');
  const missionModule = await import('./js/missions.js?realm=176');
  const g = window.G;
  const collections = [
    ['building', 'buildings'],
    ['citizen', 'citizens'],
    ['soldier', 'soldiers'],
    ['enemy', 'enemies'],
    ['projectile', 'projectiles'],
    ['walker', 'walkers'],
    ['caravan', 'caravans'],
  ];
  const references = new Map();
  for (const [kind, key] of collections) {
    (g[key] || []).forEach((entity, index) => references.set(entity, `${kind}:${index}`));
  }
  if (g.avatar) references.set(g.avatar, 'avatar:0');

  const presentationEntityFields = Object.fromEntries(
    Object.entries(stateModule.STATE_OWNERSHIP.resettablePresentationEntity)
      .map(([kind, fields]) => [kind, new Set(fields)]),
  );
  const normalize = (value, entityRoot = null, entityKind = null, ancestors = new Set()) => {
    if (value === undefined) return { $undefined: true };
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      if (!Number.isFinite(value) || Object.is(value, -0)) {
        throw new TypeError('Invalid authoritative number');
      }
      return value;
    }
    if (references.has(value) && value !== entityRoot) return { $ref: references.get(value) };
    if (ancestors.has(value)) throw new TypeError('Unresolved authoritative cycle');
    const next = new Set(ancestors);
    next.add(value);
    if (value instanceof Set) {
      const entries = [...value].map(item => normalize(item, null, null, next));
      entries.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
      return { $set: entries };
    }
    if (ArrayBuffer.isView(value)) {
      return { $typed: value.constructor.name, values: [...value] };
    }
    if (Array.isArray(value)) {
      const items = [];
      for (let index = 0; index < value.length; index++) {
        items.push(Object.prototype.hasOwnProperty.call(value, index)
          ? normalize(value[index], null, null, next)
          : { $hole: true });
      }
      const properties = {};
      for (const key of Object.keys(value).filter(key => !/^(0|[1-9]\d*)$/.test(key)).sort()) {
        properties[key] = normalize(value[key], null, null, next);
      }
      return Object.keys(properties).length ? { $array: items, $properties: properties } : items;
    }
    if (typeof value !== 'object') throw new TypeError(`Unsupported authoritative value: ${typeof value}`);
    const output = {};
    const excluded = presentationEntityFields[entityKind] || new Set();
    for (const key of Object.keys(value).sort()) {
      if (excluded.has(key)) continue;
      output[key] = normalize(value[key], null, null, next);
    }
    return output;
  };

  const ownership = stateModule.STATE_OWNERSHIP;
  const excludedRoot = new Set([
    ...ownership.processLocalRoot,
    ...ownership.resettablePresentationRoot,
    ...ownership.durableNonAuthoritativeRoot,
    ...ownership.replayProvenanceRoot,
    'debug',
  ]);
  const collectionKinds = new Map(collections.map(([kind, key]) => [key, kind]));
  const snapshot = {};
  for (const key of Object.keys(g).filter(key => !excludedRoot.has(key)).sort()) {
    const value = g[key];
    if (collectionKinds.has(key)) {
      const kind = collectionKinds.get(key);
      snapshot[key] = (value || []).map(entity => normalize(entity, entity, kind));
    } else if (key === 'avatar' && value) {
      snapshot.avatar = normalize(value, value, 'avatar');
    } else {
      snapshot[key] = normalize(value);
    }
  }
  snapshot.debug = { disableEvents: g.debug?.disableEvents === true };
  snapshot.rngSeed = stateModule.getSeed();
  snapshot.missions = missionModule.missions.map(mission => ({
    id: mission.id,
    done: mission.done,
    celebratedTick: mission._celebratedTick ?? null,
  }));
  return JSON.stringify(snapshot);
}

const server = await ensureServer();
const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const browserErrors = [];
page.on('pageerror', error => browserErrors.push(`pageerror: ${error.message}`));
page.on('console', message => {
  if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`);
});

try {
  await page.goto(`${server.gameUrl}?v=browser-save-shell-${REVISION}`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => typeof window.startNewGame === 'function' && window.G?.debug?.fastForward);
  await page.locator('#kingdom-name-input').fill('Browser Gate Realm');
  await page.locator('#title-screen .title-btn.primary').click();
  await page.waitForFunction(() => !document.body.classList.contains('title-active') && window.G?.day >= 1);
  await page.evaluate(() => window.setSpeed(0));

  const fastForward = await page.evaluate(async ({ days }) => {
    const { STATE_OWNERSHIP } = await import('./js/state.js?realm=176');
    const g = window.G;
    const tracked = [];
    const peaks = {};
    for (const key of STATE_OWNERSHIP.resettablePresentationRoot) {
      const queue = g[key];
      if (!Array.isArray(queue)) continue;
      peaks[key] = queue.length;
      for (const method of ['push', 'unshift', 'splice']) {
        const hadOwn = Object.prototype.hasOwnProperty.call(queue, method);
        const ownValue = queue[method];
        const original = Array.prototype[method];
        Object.defineProperty(queue, method, {
          configurable: true,
          writable: true,
          value(...args) {
            const result = original.apply(this, args);
            peaks[key] = Math.max(peaks[key], this.length);
            return result;
          },
        });
        tracked.push({ queue, method, hadOwn, ownValue });
      }
    }
    let result;
    try {
      result = g.debug.fastForward(days);
    } finally {
      for (const { queue, method, hadOwn, ownValue } of tracked) {
        if (hadOwn) queue[method] = ownValue;
        else delete queue[method];
      }
    }
    const finalLengths = {};
    for (const key of STATE_OWNERSHIP.resettablePresentationRoot) {
      if (Array.isArray(g[key])) finalLengths[key] = g[key].length;
    }
    return {
      result,
      peaks,
      finalLengths,
      paused: g.speed === 0,
      tick: g.gameTick,
      day: g.day,
    };
  }, { days: FAST_FORWARD_DAYS });

  assert.equal(fastForward.paused, true, 'fast-forward must leave the game paused');
  assert.equal(fastForward.result.advancedDays, FAST_FORWARD_DAYS);
  assert.equal(fastForward.finalLengths.particles, 0, 'fast-forward must drain its presentation descriptor queue');
  const peakQueue = Object.entries(fastForward.peaks).sort((a, b) => b[1] - a[1])[0] || ['none', 0];
  assert.ok(
    peakQueue[1] <= PRESENTATION_QUEUE_LIMIT,
    `${peakQueue[0]} presentation queue peaked at ${peakQueue[1]} (limit ${PRESENTATION_QUEUE_LIMIT})`,
  );
  for (const [key, length] of Object.entries(fastForward.finalLengths)) {
    assert.ok(length <= PRESENTATION_QUEUE_LIMIT, `${key} presentation queue retained ${length} items`);
  }

  // Leave a harmless descriptor and shell selection behind. Neither may enter
  // the save, and both must be rebuilt/reset by Continue.
  await page.evaluate(() => {
    window.G.particles.push({
      type: 'text', text: 'browser-shell-reset-sentinel', tx: 40, ty: 40,
      offsetY: 0, alpha: 1, vy: 0, decay: 0,
    });
    window.G.selectedBuild = 'house';
  });

  const saved = await page.evaluate(async ({ saveKey }) => {
    const save = await import('./js/save.js?realm=176');
    const ok = save.saveGame();
    const raw = localStorage.getItem(saveKey);
    return {
      ok,
      raw,
      bytes: raw ? new TextEncoder().encode(raw).byteLength : 0,
      sentinelPresent: raw?.includes('browser-shell-reset-sentinel') || false,
      day: window.G.day,
      tick: window.G.gameTick,
    };
  }, { saveKey: SAVE_KEY });
  assert.equal(saved.ok, true, 'saveGame() must succeed in a real browser');
  assert.ok(saved.raw, `saveGame() did not write ${SAVE_KEY}`);
  assert.equal(saved.sentinelPresent, false, 'resettable presentation descriptor leaked into localStorage');
  assert.ok(
    saved.bytes < COMFORTABLE_SAVE_LIMIT_BYTES,
    `save is ${saved.bytes} bytes; expected under ${COMFORTABLE_SAVE_LIMIT_BYTES}`,
  );
  const savedEnvelope = JSON.parse(saved.raw);
  const savedStateText = JSON.stringify(savedEnvelope.state);
  const authorityBefore = await page.evaluate(captureAuthoritativeState);

  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => typeof window.loadAndStart === 'function');
  const continueButton = await page.locator('#title-load').evaluate(element => ({
    visible: getComputedStyle(element).display !== 'none',
    text: element.textContent,
  }));
  assert.equal(continueButton.visible, true, 'current save must expose Continue after reload');

  // loadAndStart, the toast/UI work, beginGame({resume:true}), the first render,
  // and re-serialization all happen in this one page task. No rAF can slip a
  // simulation tick into the exact serialized-state comparison.
  const continued = await page.evaluate(async ({ saveKey, savedAt }) => {
    const { serializeGame } = await import('./js/save-state.js?realm=176');
    const { STATE_OWNERSHIP } = await import('./js/state.js?realm=176');
    const rawBefore = localStorage.getItem(saveKey);
    const expectedState = JSON.stringify(JSON.parse(rawBefore).state);
    window.loadAndStart();
    const rawAfter = localStorage.getItem(saveKey);
    const reserialized = serializeGame({ savedAt });
    const queueLengths = {};
    for (const key of STATE_OWNERSHIP.resettablePresentationRoot) {
      if (Array.isArray(window.G[key])) queueLengths[key] = window.G[key].length;
    }
    return {
      rawUnchanged: rawAfter === rawBefore,
      stateUnchanged: JSON.stringify(reserialized.state) === expectedState,
      day: window.G.day,
      tick: window.G.gameTick,
      paused: window.G.speed === 0,
      sentinelReset: !window.G.particles.some(item => item?.text === 'browser-shell-reset-sentinel'),
      selectedBuildReset: window.G.selectedBuild === null,
      queueLengths,
      toast: document.getElementById('toast')?.textContent || '',
      feedItems: document.getElementById('activity-feed')?.children.length || 0,
      titleActive: document.body.classList.contains('title-active'),
    };
  }, { saveKey: SAVE_KEY, savedAt: savedEnvelope.savedAt });

  assert.equal(continued.rawUnchanged, true, 'Continue must not rewrite the localStorage payload');
  assert.equal(continued.stateUnchanged, true, 'welcome/UI/resume synchronously mutated serialized save state');
  assert.equal(continued.day, saved.day);
  assert.equal(continued.tick, saved.tick);
  assert.equal(continued.paused, true, 'Continue did not restore the paused speed');
  assert.equal(continued.sentinelReset, true, 'Continue revived a stale presentation descriptor');
  assert.equal(continued.selectedBuildReset, true, 'Continue revived stale shell selection');
  assert.equal(continued.queueLengths.particles, 0, 'Continue did not reset the particle queue');
  assert.match(continued.toast, /Where we left off/);
  assert.ok(continued.feedItems <= 5, `welcome feed retained ${continued.feedItems} items`);
  assert.equal(continued.titleActive, false);

  const authorityAfter = await page.evaluate(captureAuthoritativeState);
  assert.equal(authorityAfter, authorityBefore, 'STATE_OWNERSHIP authoritative projection changed across Continue');
  assert.equal(JSON.stringify(savedEnvelope.state), savedStateText, 'in-memory expected payload mutated');

  await page.evaluate(() => {
    const citizen = window.G.citizens[0];
    window.G.enemies.push({
      x: citizen.x + 0.5, y: citizen.y, tx: citizen.x, ty: citizen.y,
      hp: 30, maxHp: 30, damage: 7, plunderGoal: 35,
      type: 'raider', state: 'approach', variant: 1,
      attackCue: 12, attackTimer: 20, engaged: null,
    });
  });
  const renderAuthorityBefore = await page.evaluate(captureAuthoritativeState);
  const renderPurity = await page.evaluate(async () => {
    const { serializeGame } = await import('./js/save-state.js?realm=176');
    const state = await import('./js/state.js?realm=176');
    const enemy = window.G.enemies.at(-1);
    const before = JSON.stringify(serializeGame({ savedAt: 0 }).state);
    const tick = window.G.gameTick;
    const seed = state.getSeed();
    const cue = enemy.attackCue;
    window.forceRender();
    window.forceRender();
    window.forceRender();
    return {
      saveEqual: JSON.stringify(serializeGame({ savedAt: 0 }).state) === before,
      tickEqual: window.G.gameTick === tick,
      seedEqual: state.getSeed() === seed,
      cueBefore: cue,
      cueAfter: enemy.attackCue,
    };
  });
  const renderAuthorityAfter = await page.evaluate(captureAuthoritativeState);
  assert.equal(renderPurity.saveEqual, true, 'paused rendering changed the current save payload');
  assert.equal(renderPurity.tickEqual, true, 'paused rendering advanced simulation time');
  assert.equal(renderPurity.seedEqual, true, 'paused rendering consumed simulation RNG');
  assert.equal(renderPurity.cueAfter, renderPurity.cueBefore, 'renderer mutated an enemy attack cue');
  assert.equal(renderAuthorityAfter, renderAuthorityBefore, 'paused rendering changed authoritative state');

  const victory = await page.evaluate(async () => {
    const ui = await import('./js/ui.js?realm=176');
    window.G.wonder = {
      placed: true,
      stage: 3,
      delivered: { stone: 50, planks: 20, gold: 40 },
      completeDay: window.G.day,
    };
    window.G.won = true;
    ui.showVictoryScreen();
    const screen = document.getElementById('victory-screen');
    return {
      display: screen?.style.display,
      title: screen?.querySelector('.vic-title')?.textContent || '',
      subtitle: screen?.querySelector('.vic-subtitle')?.textContent || '',
      day: screen?.querySelector('.vic-day')?.textContent || '',
      confettiWidth: document.getElementById('vic-confetti')?.width || 0,
    };
  });
  await page.waitForTimeout(250);
  assert.equal(victory.display, 'flex');
  assert.equal(victory.title, 'The Hall of Ages Stands Eternal');
  assert.match(victory.subtitle, new RegExp(`crowned on day ${continued.day}`));
  assert.equal(victory.day, `Day ${continued.day}`);
  assert.ok(victory.confettiWidth > 0, 'victory confetti canvas was not initialized');
  assert.deepEqual(browserErrors, [], `browser errors: ${browserErrors.join(' | ')}`);

  const quotaPercent = (saved.bytes / CONSERVATIVE_LOCAL_STORAGE_QUOTA_BYTES) * 100;
  console.log(`✓ real New Game paused and fastForward(${FAST_FORWARD_DAYS}) reached day ${fastForward.day}, tick ${fastForward.tick}`);
  console.log(`✓ presentation queues bounded: peak ${peakQueue[0]}=${peakQueue[1]}, particles reset to ${fastForward.finalLengths.particles}`);
  console.log(`✓ saveGame() wrote ${saved.bytes.toLocaleString()} bytes (${quotaPercent.toFixed(2)}% of a conservative 5 MiB quota)`);
  console.log(`✓ reload/Continue preserved exact serialized state and authoritative hash ${sha256(authorityAfter).slice(0, 20)}…`);
  console.log(`✓ transient welcome rendered (${continued.feedItems} feed item${continued.feedItems === 1 ? '' : 's'}) without state mutation`);
  console.log(`✓ three paused renders preserve save payload, authoritative state, RNG, tick, and attack cue`);
  console.log(`✓ showVictoryScreen rendered a completed Hall of Ages with no page error`);
  console.log(`[browser-save-shell] OK — realm${REVISION}, ${saved.bytes} bytes`);
} finally {
  await browser.close();
  await server.stop();
}
