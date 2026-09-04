#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { ensureServer } from './_serve.mjs';

const contract = JSON.parse(await readFile(new URL('../runtime-contract.json', import.meta.url), 'utf8'));
assert.ok(Number.isSafeInteger(contract.moduleRevision) && contract.moduleRevision > 0, 'Runtime contract lacks a module revision');

const desktopScreenshot = '/tmp/realm-supply-ledger-desktop.png';
const mobileScreenshot = '/tmp/realm-supply-ledger-mobile-390x844.png';
const server = await ensureServer();
const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });

function captureErrors(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}

async function startSupplyFixture(page, label) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${server.gameUrl}?v=supply-ledger-${contract.moduleRevision}-${label}`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => (
    typeof window.startNewGame === 'function'
    && typeof window.G?.debug?.dispatch === 'function'
  ));
  await page.evaluate(() => window.setScenario('industrial'));
  await page.locator('#kingdom-name-input').fill(`Supply Ledger ${label}`);
  await page.locator('#title-screen .title-btn.primary').click();
  await page.waitForFunction(() => (
    !document.body.classList.contains('title-active')
    && window.G?.citizens?.length >= 2
    && window.G?.buildings?.some(building => building.founderStockpile === true)
  ));
  await page.evaluate(() => {
    window.setSpeed(0);
    window.dismissTutorial?.();
  });

  const fixture = await page.evaluate(async () => {
    const [economy, inventory, logistics, ownership, state, tech, ui] = await Promise.all([
      import('./js/economy.js?realm=198'),
      import('./js/building-inventory.js?realm=198'),
      import('./js/logistics.js?realm=198'),
      import('./js/citizen-ownership.js?realm=198'),
      import('./js/state.js?realm=198'),
      import('./js/tech.js?realm=198'),
      import('./js/ui.js?realm=198'),
    ]);
    const g = window.G;
    const requireCondition = (condition, message) => {
      if (!condition) throw new Error(message);
    };
    requireCondition(state.G === g, 'Dynamic modules did not share the live canonical state');
    requireCondition(g.speed === 0, 'Supply ledger fixture was not paused');

    const research = g.debug.dispatch({ type: 'START_RESEARCH', tech: 'baking' });
    requireCondition(research.ok, `Baking research failed: ${research.reason}`);
    const researchLimit = tech.TECHS.baking.time + 2;
    for (let updates = 0; g.currentResearch && updates < researchLimit; updates++) {
      tech.updateResearch();
    }
    requireCondition(g.researchedTechs.has('baking'), 'Baking research did not complete through research authority');

    let site = null;
    for (let y = 0; y < g.map.length && !site; y++) {
      for (let x = 0; x < g.map[y].length; x++) {
        if (economy.canPlace('windmill', x, y)) {
          site = { x, y };
          break;
        }
      }
    }
    requireCondition(site, 'No visible valid Windmill site was available');
    const placed = g.debug.dispatch({ type: 'PLACE_BUILDING', building: 'windmill', ...site });
    requireCondition(placed.ok, `Windmill placement failed: ${placed.reason}`);
    const windmill = g.buildingGrid[site.y][site.x];
    requireCondition(windmill?.type === 'windmill', 'Placement authority did not create the Windmill');

    const worker = g.citizens[0];
    ownership.releaseCitizenAssignment(worker, 'player-command');
    requireCondition(
      ownership.claimCitizenAssignment(worker, windmill, { reason: 'player-command' }),
      'Builder assignment was not claimed',
    );
    worker.x = windmill.x + 1;
    worker.y = windmill.y;
    worker.tx = worker.x;
    worker.ty = worker.y;
    ownership.transitionCitizenActivity(worker, 'working', 'arrived-at-work');

    const constructionLimit = windmill.buildTotal + 2;
    for (let updates = 0; windmill.buildProgress < 1 && updates < constructionLimit; updates++) {
      economy.updateProduction();
    }
    requireCondition(windmill.buildProgress === 1, 'Windmill did not complete through production authority');
    requireCondition(worker.assignment === null, 'Construction completion retained its temporary assignment');

    requireCondition(
      ownership.claimCitizenAssignment(worker, windmill, { reason: 'player-command' }),
      'Active Windmill worker assignment was not claimed',
    );
    ownership.transitionCitizenActivity(worker, 'working', 'arrived-at-work');
    worker.activityTimer = 10_000;

    const input = state.BUILDINGS.windmill.convert.from;
    const output = state.BUILDINGS.windmill.convert.to;
    requireCondition(input === 'wheat' && output === 'flour', 'Windmill production-chain contract changed unexpectedly');
    const localDeposit = inventory.depositResource(windmill, input, 4, g);
    requireCondition(localDeposit.accepted === 4 && localDeposit.remainder === 0, 'Local wheat deposit failed');
    const founder = g.buildings.find(building => building.founderStockpile === true);
    requireCondition(founder, 'Fresh realm lacked its founder Storehouse');
    const remoteDeposit = inventory.depositResource(founder, input, 11, g);
    requireCondition(remoteDeposit.accepted === 11 && remoteDeposit.remainder === 0, 'Comparison wheat deposit failed');

    const carrier = g.citizens[1];
    ownership.releaseCitizenAssignment(carrier, 'player-command');
    carrier.carrying = input;
    carrier.carryAmount = 3;
    carrier.x = windmill.x + 4;
    carrier.y = windmill.y;
    carrier.tx = windmill.x;
    carrier.ty = windmill.y;
    carrier.path = null;
    carrier.pathIdx = 0;
    const plan = logistics.planResourceDelivery(carrier, input, {
      state: g,
      isBlacklisted: building => building !== windmill,
      findRoute: (_sx, _sy, ex, ey) => [{ x: ex, y: ey }],
    });
    requireCondition(plan?.building === windmill, 'Logistics broker did not reserve the Windmill destination');
    carrier._deliveryTarget = plan.building;
    ownership.transitionCitizenActivity(carrier, 'walk_to_deliver', 'route-to-delivery');
    carrier.activityTimer = 10_000;

    windmill.produced = { [output]: 2 };
    const flow = logistics.resourceFlowReport(windmill, g);
    const capacity = inventory.resourceCapacity(windmill, input);
    requireCondition(flow.status === 'operational', `Windmill flow status was ${flow.status}`);
    requireCondition(flow.resources[input].stored === 4, 'Flow report lost local wheat');
    requireCondition(flow.resources[input].inbound === 3, 'Flow report lost reserved inbound wheat');
    requireCondition(g.resources[input] === 15, 'Comparison fixture did not establish a distinct global wheat total');
    requireCondition(inventory.resourceConservationReport(input, g).conserved, 'Physical wheat mirror is not conserved');

    g.selectedBuilding = windmill;
    ui.showInfoPanel(windmill);
    window.forceRender?.();
    return {
      input,
      output,
      capacity,
      stored: flow.resources[input].stored,
      inbound: flow.resources[input].inbound,
      global: g.resources[input],
      outputWaiting: windmill.produced[output],
      workerActorId: worker.actorId,
      carrierActorId: carrier.actorId,
      paused: g.speed === 0,
    };
  });

  await page.locator('.supply-ledger').waitFor({ state: 'visible' });
  await page.locator('.supply-ledger').evaluate(element => element.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(250);
  return fixture;
}

async function assertSupplyLedger(page, fixture, label) {
  const ledger = page.locator('.supply-ledger');
  assert.equal(await ledger.count(), 1, `${label}: expected one supply ledger`);
  assert.equal(fixture.paused, true, `${label}: real game did not remain paused`);
  assert.notEqual(fixture.global, fixture.stored, `${label}: global/local comparison fixture is ambiguous`);

  const heading = (await ledger.locator('.supply-ledger-head > span').innerText()).trim();
  const state = (await ledger.locator('.supply-ledger-head > strong').innerText()).trim();
  const ledgerText = (await ledger.innerText()).replace(/\s+/g, ' ').trim();
  assert.equal(heading, 'Supply ledger', `${label}: ledger heading is not player-readable`);
  assert.equal(state, `Ready to use ${fixture.input}`, `${label}: operational input state is wrong`);

  const inputRow = ledger.locator('.supply-flow-row', { hasText: fixture.input });
  assert.equal(await inputRow.count(), 1, `${label}: missing ${fixture.input} flow row`);
  const inputText = (await inputRow.innerText()).replace(/\s+/g, ' ').trim();
  assert.match(inputText, new RegExp(`\\b${fixture.input}\\b`, 'i'), `${label}: input resource label is missing`);
  assert.match(inputText, /\binput\b/i, `${label}: converter role is missing`);
  assert.match(inputText, new RegExp(`${fixture.stored}/${fixture.capacity}`), `${label}: local storage value is wrong`);
  assert.match(inputText, new RegExp(`\\+${fixture.inbound} en route`), `${label}: inbound reservation is missing`);
  assert.equal(
    ledgerText.includes(`${fixture.global}/${fixture.capacity}`),
    false,
    `${label}: ledger presented the global grain wallet as local Windmill stock`,
  );

  const output = ledger.locator('.supply-ledger-output');
  assert.equal(await output.count(), 1, `${label}: buffered ${fixture.output} output is missing`);
  const outputText = (await output.innerText()).replace(/\s+/g, ' ').trim();
  assert.match(outputText, /Output waiting/i, `${label}: output buffer label is missing`);
  assert.match(outputText, new RegExp(`\\b${fixture.outputWaiting}\\b`), `${label}: output buffer amount is wrong`);

  const meter = ledger.getByRole('meter', { name: `${fixture.input} stored` });
  assert.equal(await meter.count(), 1, `${label}: accessible ${fixture.input} meter is missing`);
  assert.equal(await meter.getAttribute('aria-valuemin'), '0', `${label}: meter minimum is wrong`);
  assert.equal(await meter.getAttribute('aria-valuemax'), String(fixture.capacity), `${label}: meter capacity is wrong`);
  assert.equal(await meter.getAttribute('aria-valuenow'), String(fixture.stored), `${label}: meter local value is wrong`);

  const layout = await ledger.evaluate(element => {
    const panel = element.closest('#info-panel');
    const panelRect = panel.getBoundingClientRect();
    const ledgerRect = element.getBoundingClientRect();
    const style = getComputedStyle(panel);
    const textElements = [
      ...element.querySelectorAll('.supply-ledger-head span, .supply-ledger-head strong, .supply-flow-label span, .supply-flow-label small, .supply-flow-value, .supply-ledger-output, .supply-ledger p'),
    ].filter(node => node.textContent.trim());
    const fontSizes = textElements.map(node => Number.parseFloat(getComputedStyle(node).fontSize));
    const rowMetrics = [...element.querySelectorAll('.supply-flow-row')].map(row => ({
      clientWidth: row.clientWidth,
      scrollWidth: row.scrollWidth,
      text: row.textContent.replace(/\s+/g, ' ').trim(),
    }));
    const rowOverflow = rowMetrics.some(row => row.scrollWidth > row.clientWidth + 1);
    const visibleTop = Math.max(0, panelRect.top);
    const visibleBottom = Math.min(innerHeight, panelRect.bottom);
    return {
      viewport: { width: innerWidth, height: innerHeight },
      panel: {
        left: panelRect.left,
        top: panelRect.top,
        right: panelRect.right,
        bottom: panelRect.bottom,
        clientHeight: panel.clientHeight,
        scrollHeight: panel.scrollHeight,
        overflowY: style.overflowY,
        horizontalOverflow: panel.scrollWidth > panel.clientWidth + 1,
      },
      ledger: {
        top: ledgerRect.top,
        bottom: ledgerRect.bottom,
        width: ledgerRect.width,
        visibleWithinPanel: ledgerRect.top >= visibleTop - 1 && ledgerRect.bottom <= visibleBottom + 1,
        rowOverflow,
        rowMetrics,
      },
      minFontSize: Math.min(...fontSizes),
    };
  });

  assert.ok(
    layout.panel.left >= -1 && layout.panel.right <= layout.viewport.width + 1,
    `${label}: panel escapes viewport horizontally: ${JSON.stringify(layout.panel)}`,
  );
  assert.ok(
    layout.panel.top >= -1 && layout.panel.bottom <= layout.viewport.height + 1,
    `${label}: panel escapes viewport vertically: ${JSON.stringify(layout.panel)}`,
  );
  assert.match(layout.panel.overflowY, /auto|scroll/, `${label}: panel has no overflow scrolling`);
  assert.equal(layout.panel.horizontalOverflow, false, `${label}: panel requires horizontal scrolling`);
  assert.equal(layout.ledger.visibleWithinPanel, true, `${label}: supply ledger cannot be brought into the visible panel viewport`);
  assert.equal(
    layout.ledger.rowOverflow,
    false,
    `${label}: supply row text is clipped: ${JSON.stringify(layout.ledger.rowMetrics)}`,
  );
  assert.ok(layout.minFontSize >= 7.5, `${label}: smallest ledger text is ${layout.minFontSize}px`);
  return { heading, state, inputText, outputText, layout };
}

let desktopContext;
let mobileContext;
try {
  desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const desktop = await desktopContext.newPage();
  const desktopErrors = captureErrors(desktop);
  const desktopFixture = await startSupplyFixture(desktop, 'Desktop');
  const desktopProof = await assertSupplyLedger(desktop, desktopFixture, 'desktop');
  await desktop.screenshot({ path: desktopScreenshot, fullPage: false });
  assert.deepEqual(desktopErrors, [], `desktop browser errors: ${desktopErrors.join(' | ')}`);

  mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
  });
  const mobile = await mobileContext.newPage();
  const mobileErrors = captureErrors(mobile);
  const mobileFixture = await startSupplyFixture(mobile, 'Mobile');
  const mobileProof = await assertSupplyLedger(mobile, mobileFixture, 'mobile');
  assert.deepEqual(mobileProof.layout.viewport, { width: 390, height: 844 }, 'mobile viewport changed');
  await mobile.screenshot({ path: mobileScreenshot, fullPage: false });
  assert.deepEqual(mobileErrors, [], `mobile browser errors: ${mobileErrors.join(' | ')}`);

  console.log(JSON.stringify({
    gate: 'supply-ledger-browser',
    revision: contract.moduleRevision,
    fixture: desktopFixture,
    desktop: { screenshot: desktopScreenshot, layout: desktopProof.layout },
    mobile: { screenshot: mobileScreenshot, layout: mobileProof.layout },
  }, null, 2));
  console.log('[supply-ledger-browser] PASS — local stock, reserved inbound cargo, active input role, buffered output, ARIA meter, and responsive panel are truthful');
} finally {
  await mobileContext?.close();
  await desktopContext?.close();
  await browser.close();
  await server.stop();
}
