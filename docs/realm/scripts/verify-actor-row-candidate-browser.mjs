#!/usr/bin/env node

// Prove that Sprite Lab reflects the current v2 slots and that the ordinary
// game never requests candidate files. Candidate mutation semantics are
// exercised in the isolated Python gate; the checked production manifest may
// legitimately contain zero candidates after an atomic family promotion.

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
    document.body.dataset.spriteReviewSource === 'accepted'
    && document.body.dataset.spriteRuntimeSource === 'accepted'
    && document.body.dataset.spriteCandidateFile === undefined
    && document.querySelectorAll('#sl-list .sl-source-badge.candidate').length === 0
    && document.querySelectorAll('#sl-list .sl-source-badge.accepted').length === 201
  ));

  const idle = await page.evaluate(async () => {
    const response = await fetch(
      `assets/sprites/actor-rows/manifest.json?browserVerify=${Date.now()}`,
      { cache: 'no-store' },
    );
    const manifest = await response.json();
    const records = Object.values(manifest.rows);
    const candidates = records.filter((slots) => slots.candidate);
    const production = records.filter((slots) => slots.production);
    const guardProduction = Object.entries(manifest.rows).filter(
      ([key, slots]) => key.startsWith('guard/') && slots.production,
    );
    const farmerProduction = Object.entries(manifest.rows).filter(
      ([key, slots]) => key.startsWith('farmer/') && slots.production,
    );
    const key = 'guard/idle/down';
    const item = manifest.rows[key].production;
    const bytes = await fetch(`assets/sprites/actor-rows/${item.file}`).then(
      (asset) => asset.arrayBuffer(),
    );
    const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('');
    return {
      version: manifest.version,
      candidateCount: candidates.length,
      productionCount: production.length,
      guardProductionCount: guardProduction.length,
      farmerProductionCount: farmerProduction.length,
      productionHash: item.sha256,
      fetchedProductionHash: digest,
      reviewSource: document.body.dataset.spriteReviewSource,
      runtimeSource: document.body.dataset.spriteRuntimeSource,
      candidateFile: document.body.dataset.spriteCandidateFile || null,
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
  assert.equal(idle.candidateCount, 0);
  assert.equal(idle.productionCount, 201);
  assert.equal(idle.guardProductionCount, 16);
  assert.equal(idle.farmerProductionCount, 16);
  assert.equal(idle.candidateBadges, 0);
  assert.equal(idle.reviewSource, 'accepted');
  assert.equal(idle.runtimeSource, 'accepted');
  assert.equal(idle.candidateFile, null);
  assert.equal(idle.fetchedProductionHash, idle.productionHash);
  assert.match(idle.provenance, /LOCKED/);
  assert.match(idle.provenance, /a5-modular-guard-actions/);

  await page.selectOption('#sl-action', 'carry');
  await page.selectOption('#sl-dir', 'down');
  await page.waitForFunction(() => (
    document.body.dataset.spriteReviewSource === 'accepted'
    && document.body.dataset.spriteRuntimeSource === 'accepted'
    && document.body.dataset.spriteCandidateFile === undefined
  ));
  const carry = await page.evaluate(() => ({
    reviewSource: document.body.dataset.spriteReviewSource,
    runtimeSource: document.body.dataset.spriteRuntimeSource,
    candidateFile: document.body.dataset.spriteCandidateFile || null,
    provenance: document.querySelector('#sl-provenance')?.textContent || '',
  }));
  assert.equal(carry.reviewSource, 'accepted');
  assert.equal(carry.runtimeSource, 'accepted');
  assert.equal(carry.candidateFile, null);
  assert.match(carry.provenance, /LOCKED/);
  assert.match(carry.provenance, /a5-modular-guard-actions/);
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
    schema: 'realm.actor-row-candidate-browser-report.v2',
    manifest: {
      version: idle.version,
      candidates: idle.candidateCount,
      production: idle.productionCount,
      guardProduction: idle.guardProductionCount,
      farmerProduction: idle.farmerProductionCount,
    },
    idle,
    carry,
    ordinary: ordinaryState,
    screenshot: screenshotPath,
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    '[actor-row-candidate-browser] PASS — 201 production rows and 0 candidates; '
    + 'all guard and farmer rows are LOCKED and ordinary game loads no candidate assets',
  );
} finally {
  await browser.close();
  await server.stop();
}
