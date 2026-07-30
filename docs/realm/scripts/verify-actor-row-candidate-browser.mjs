#!/usr/bin/env node

// Prove that Sprite Lab reviews v2 candidates while the ordinary game remains
// on compiled production/base art. This is the browser half of the actor-row
// manifest isolation contract.

import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { ensureServer } from './_serve.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = join(root, 'tmp', 'actor-row-manifest-v2');
const screenshotPath = join(outputDir, 'sprite-lab.png');
const reportPath = join(outputDir, 'report.json');
const server = await ensureServer();
const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });

try {
  await mkdir(outputDir, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`[console] ${message.text()}`);
  });

  await page.goto(
    `${server.gameUrl}?spritelab=1&role=guard&action=idle&dir=down`
    + `&verifyCandidate=${Date.now()}`,
  );
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => (
    document.body.dataset.spriteReviewSource === 'candidate'
    && document.body.dataset.spriteRuntimeSource === 'accepted'
    && document.body.dataset.spriteCandidateFile === 'candidates/guard/idle-down.png'
    && document.querySelectorAll('#sl-list .sl-source-badge.candidate').length === 16
    && performance.getEntriesByType('resource').some(
      (entry) => entry.name.includes('/actor-rows/candidates/guard/idle-down.png'),
    )
  ));

  const idle = await page.evaluate(async () => {
    const response = await fetch(
      `assets/sprites/actor-rows/manifest.json?browserVerify=${Date.now()}`,
      { cache: 'no-store' },
    );
    const manifest = await response.json();
    const records = Object.values(manifest.rows);
    const candidates = records.filter((slots) => slots.candidate);
    const coexist = candidates.filter((slots) => slots.production);
    const runtimeBase = candidates.filter((slots) => !slots.production);
    const key = 'guard/idle/down';
    const item = manifest.rows[key].candidate;
    const bytes = await fetch(`assets/sprites/actor-rows/${item.file}`).then(
      (asset) => asset.arrayBuffer(),
    );
    const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('');
    return {
      version: manifest.version,
      candidateCount: candidates.length,
      coexistCount: coexist.length,
      runtimeBaseCount: runtimeBase.length,
      productionHash: manifest.rows[key].production.sha256,
      candidateHash: item.sha256,
      fetchedCandidateHash: digest,
      reviewSource: document.body.dataset.spriteReviewSource,
      runtimeSource: document.body.dataset.spriteRuntimeSource,
      candidateFile: document.body.dataset.spriteCandidateFile,
      provenance: document.querySelector('#sl-provenance')?.textContent || '',
      candidateBadges: document.querySelectorAll(
        '#sl-list .sl-source-badge.candidate',
      ).length,
      resources: performance.getEntriesByType('resource')
        .map((entry) => entry.name)
        .filter((name) => name.includes('/actor-rows/')),
    };
  });

  assert.equal(idle.version, 2);
  assert.equal(idle.candidateCount, 16);
  assert.equal(idle.coexistCount, 12);
  assert.equal(idle.runtimeBaseCount, 4);
  assert.equal(idle.candidateBadges, 16);
  assert.equal(idle.reviewSource, 'candidate');
  assert.equal(idle.runtimeSource, 'accepted');
  assert.equal(idle.candidateFile, 'candidates/guard/idle-down.png');
  assert.notEqual(idle.productionHash, idle.candidateHash);
  assert.equal(idle.fetchedCandidateHash, idle.candidateHash);
  assert.match(idle.provenance, /CANDIDATE/);
  assert.match(idle.provenance, /runtime LOCKED/);

  await page.selectOption('#sl-action', 'carry');
  await page.selectOption('#sl-dir', 'down');
  await page.waitForFunction(() => (
    document.body.dataset.spriteReviewSource === 'candidate'
    && document.body.dataset.spriteRuntimeSource === 'base'
    && document.body.dataset.spriteCandidateFile === 'candidates/guard/carry-down.png'
    && performance.getEntriesByType('resource').some(
      (entry) => entry.name.includes('/actor-rows/candidates/guard/carry-down.png'),
    )
  ));
  const carry = await page.evaluate(() => ({
    reviewSource: document.body.dataset.spriteReviewSource,
    runtimeSource: document.body.dataset.spriteRuntimeSource,
    candidateFile: document.body.dataset.spriteCandidateFile,
    provenance: document.querySelector('#sl-provenance')?.textContent || '',
  }));
  assert.equal(carry.reviewSource, 'candidate');
  assert.equal(carry.runtimeSource, 'base');
  assert.equal(carry.candidateFile, 'candidates/guard/carry-down.png');
  assert.match(carry.provenance, /runtime BASE/);
  assert.equal(errors.length, 0, errors.join('\n'));
  await page.screenshot({ path: screenshotPath, fullPage: false });

  const ordinary = await context.newPage();
  const ordinaryErrors = [];
  ordinary.on('pageerror', (error) => ordinaryErrors.push(error.message));
  ordinary.on('console', (message) => {
    if (message.type() === 'error') ordinaryErrors.push(`[console] ${message.text()}`);
  });
  await ordinary.goto(`${server.gameUrl}?verifyOrdinary=${Date.now()}`);
  await ordinary.waitForLoadState('domcontentloaded');
  await ordinary.waitForFunction(() => typeof window.startNewGame === 'function');
  await ordinary.evaluate(() => window.startNewGame());
  await ordinary.waitForFunction(() => window.__realm?.actorAtlas?.().active);
  await ordinary.waitForTimeout(250);
  const ordinaryState = await ordinary.evaluate(() => ({
    candidateResources: performance.getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((name) => name.includes('/actor-rows/candidates/')),
    atlas: window.__realm.actorAtlas(),
  }));
  assert.deepEqual(ordinaryState.candidateResources, []);
  assert.ok(ordinaryState.atlas.active, 'ordinary runtime did not activate an actor atlas');
  assert.equal(ordinaryErrors.length, 0, ordinaryErrors.join('\n'));

  const report = {
    schema: 'realm.actor-row-candidate-browser-report.v1',
    manifest: {
      version: idle.version,
      candidates: idle.candidateCount,
      coexistWithProduction: idle.coexistCount,
      runtimeBase: idle.runtimeBaseCount,
    },
    idle,
    carry,
    ordinary: ordinaryState,
    screenshot: screenshotPath,
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    '[actor-row-candidate-browser] PASS — 16 candidates visible in Sprite Lab; '
    + '12 coexist with LOCKED rows, 4 retain BASE runtime, ordinary game loads none',
  );
} finally {
  await browser.close();
  await server.stop();
}
