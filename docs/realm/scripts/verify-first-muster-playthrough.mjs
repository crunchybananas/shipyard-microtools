#!/usr/bin/env node

// A deterministic, end-to-end mechanical playthrough of Rise of the Sword.
// Terrain is normalized only to provide known legal build sites; construction,
// staffing, physical food, recruitment, scouting, raid scheduling/combat, and
// recovery all run through production commands and core ticks.

import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { ensureServer } from './_serve.mjs';

const server = await ensureServer();
const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
page.on('console', message => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});

try {
  await page.goto(`${server.gameUrl}?v=first-muster-playthrough-193`);
  await page.waitForFunction(() => typeof window.startNewGame === 'function');
  await page.evaluate(() => {
    window.setDifficulty('normal');
    window.setScenario('military_rise');
  });
  await page.locator('#kingdom-name-input').fill('Muster Playthrough');
  await page.locator('#title-screen .title-btn.primary').click();
  await page.waitForFunction(() => !document.body.classList.contains('title-active'));
  await page.evaluate(() => window.setSpeed(0));

  const report = await page.evaluate(async () => {
    const state = await import('./js/state.js?realm=195');
    const economy = await import('./js/economy.js?realm=195');
    const firstMuster = await import('./js/first-muster.js?realm=195');
    const military = await import('./js/military.js?realm=195');
    const recovery = await import('./js/post-raid-recovery.js?realm=195');
    const scenarios = await import('./js/scenarios.js?realm=195');
    const ui = await import('./js/ui.js?realm=195');
    const g = window.G;
    g.debug.disableEvents = true;
    const requireCondition = (condition, message) => {
      if (!condition) throw new Error(message);
    };
    const requireEqual = (actual, expected, message) => {
      if (actual !== expected) throw new Error(`${message}: expected ${expected}, received ${actual}`);
    };

    const marks = [];
    const mark = id => marks.push({
      id,
      tick: g.gameTick,
      day: g.day,
      food: g.resources.food,
      population: g.population,
      soldiers: g.soldiers.length,
      chapterStep: g.storyFlags.firstMusterStep || 0,
    });
    const stepUntil = (label, predicate, limit) => {
      for (let ticks = 1; ticks <= limit; ticks++) {
        g.debug.step(1);
        if (predicate()) return ticks;
      }
      throw new Error(`${label} did not settle within ${limit} core ticks: ${JSON.stringify({
        tick: g.gameTick,
        day: g.day,
        population: g.population,
        soldiers: g.soldiers.length,
        enemies: g.enemies.length,
        chapter: firstMuster.getFirstMusterReport(g).primary?.id || 'complete',
      })}`);
    };
    const dispatch = command => {
      const result = g.debug.dispatch(command);
      if (!result.ok) throw new Error(`${command.type} failed: ${result.reason}`);
      return result;
    };

    // Give the playthrough a deterministic legal settlement clearing while
    // preserving the generated world and fog beyond it for real scouting.
    for (let y = 30; y <= 50; y++) {
      for (let x = 30; x <= 50; x++) {
        if (!g.buildingGrid[y][x]) g.map[y][x] = state.TILE.GRASS;
        g.fog[y][x] = true;
      }
    }
    g.obstacleEpoch += 1;

    const claimedSites = new Set();
    const findSite = (type, predicate = () => true) => {
      const candidates = [];
      for (let y = 30; y <= 50; y++) {
        for (let x = 30; x <= 50; x++) {
          if (claimedSites.has(`${x},${y}`) || !predicate(x, y)) continue;
          if (!economy.canPlace(type, x, y)) continue;
          candidates.push({ x, y, distance: Math.abs(x - 40) + Math.abs(y - 40) });
        }
      }
      candidates.sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x);
      const site = candidates[0];
      if (!site) throw new Error(`No legal ${type} site in the normalized clearing.`);
      claimedSites.add(`${site.x},${site.y}`);
      return site;
    };
    const place = (type, predicate) => {
      const site = findSite(type, predicate);
      dispatch({ type: 'PLACE_BUILDING', building: type, x: site.x, y: site.y });
      return g.buildingGrid[site.y][site.x];
    };

    mark('opening');
    requireEqual(g.resources.food, 18, 'military opening did not start with the authored ration runway');

    const farm = place('farm');
    stepUntil(
      'operational food source',
      () => firstMuster.getFirstMusterReport(g).currentIndex >= 1,
      3_600,
    );
    requireCondition(farm.buildProgress >= 1, 'food objective advanced before Farm completion');
    requireCondition(
      g.citizens.some(citizen => citizen.assignment?.building === farm && citizen.activity.kind === 'working'),
      'food objective advanced without a visible active farmer',
    );
    mark('food-operating');

    const house = place('house');
    stepUntil(
      'commissioned House',
      () => firstMuster.getFirstMusterReport(g).currentIndex >= 2,
      3_600,
    );
    requireCondition(house.buildProgress >= 1, 'House objective advanced before completion');
    requireEqual(g.population, 4, 'commissioned House did not add its first resident');
    mark('house-commissioned');

    const barracks = place('barracks');
    stepUntil(
      'operational Barracks',
      () => firstMuster.getFirstMusterReport(g).currentIndex >= 3,
      5_400,
    );
    requireCondition(barracks.buildProgress >= 1, 'Barracks objective advanced before completion');
    mark('barracks-operating');

    const recruitedNames = [];
    for (let company = 1; company <= 3; company++) {
      const status = military.recruitmentStatus(barracks);
      requireEqual(status.ok, true, `company order ${company} unavailable: ${status.reason}`);
      const result = dispatch({ type: 'RECRUIT_UNIT', x: barracks.x, y: barracks.y });
      recruitedNames.push(result.name);
      stepUntil(
        `recruit ${company} drill`,
        () => g.soldiers.length >= company && !barracks.recruitType,
        military.RECRUITMENT.barracks.duration + 60,
      );
      mark(`soldier-${company}`);
    }
    requireEqual(new Set(recruitedNames).size, 3, 'company lost named-citizen identity');
    stepUntil(
      'muster chapter transition',
      () => firstMuster.getFirstMusterReport(g).primary?.id === 'scout_approach',
      180,
    );

    // Issue the new orders through their production UI surfaces. Guard is
    // attached to a real building panel; Explore turns the same company into
    // a Founder escort without direct unit steering.
    g.selectedBuilding = barracks;
    ui.showInfoPanel(barracks);
    const guardButton = [...document.querySelectorAll('#info-panel button')]
      .find(button => button.textContent.includes('Guard this building'));
    requireCondition(guardButton, 'Barracks panel did not expose the Guard order');
    guardButton.click();
    requireEqual(g.armyStance, 'guard', 'building panel did not issue Guard');
    requireEqual(g.armyGuardPoint?.x, barracks.x, 'Guard lost its building x coordinate');
    requireEqual(g.armyGuardPoint?.y, barracks.y, 'Guard lost its building y coordinate');
    window.setArmyStance('explore');
    requireEqual(g.armyStance, 'explore', 'Explore HUD order did not engage');

    // Walk the production Founder into reachable generated fog. Repeated
    // targets allow a partially revealed fringe to contribute less than one
    // find without weakening the physical exploration requirement.
    const scoutingStart = g.avatar.scoutingFinds;
    const targets = [];
    for (let y = 1; y < state.MAP_H - 1; y++) {
      for (let x = 1; x < state.MAP_W - 1; x++) {
        if (g.fog[y][x]) continue;
        if (g.map[y][x] === state.TILE.WATER || g.map[y][x] === state.TILE.MOUNTAIN) continue;
        targets.push({ x, y, distance: Math.abs(x - g.avatar.x) + Math.abs(y - g.avatar.y) });
      }
    }
    targets.sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x);
    for (const target of targets) {
      if (g.avatar.scoutingFinds > scoutingStart) break;
      const result = g.debug.dispatch({ type: 'AVATAR_GOTO', x: target.x, y: target.y });
      if (!result.ok) continue;
      stepUntil(
        `Founder scouting toward ${target.x},${target.y}`,
        () => g.avatar.scoutingFinds > scoutingStart || (!g.avatar.path && !g.avatar.vx && !g.avatar.vy),
        2_400,
      );
    }
    requireCondition(g.avatar.scoutingFinds > scoutingStart, 'Founder never converted physical exploration into intelligence');
    requireCondition(
      g.soldiers.every(soldier => Math.hypot(soldier.tx - g.avatar.x, soldier.ty - g.avatar.y) <= 3),
      'Explore order did not keep company targets around the Founder',
    );
    stepUntil(
      'scouting chapter transition',
      () => firstMuster.getFirstMusterReport(g).primary?.id === 'plant_rally',
      180,
    );
    mark('approach-scouted');

    const approach = g.storyFlags.firstRaidApproach;
    requireCondition(Number.isSafeInteger(approach) && approach >= 0 && approach <= 3, 'scouting did not produce a valid raid approach');
    const rallyByApproach = [
      { x: 40, y: 31 },
      { x: 49, y: 40 },
      { x: 40, y: 49 },
      { x: 31, y: 40 },
    ];
    const rally = rallyByApproach[approach];
    dispatch({ type: 'SET_RALLY', x: rally.x, y: rally.y });
    stepUntil(
      'rally chapter transition',
      () => firstMuster.getFirstMusterReport(g).primary?.id === 'survive_raid',
      180,
    );
    mark('rally-planted');

    stepUntil('first raid spawn', () => g.stats.raidsFaced >= 1 && g.enemies.length > 0, g.dayLength * 9);
    mark('raid-started');
    stepUntil(
      'first raid resolution',
      () => g.stats.raidsSurvived >= 1 && g.enemies.length === 0,
      7_200,
    );
    requireCondition(g.soldiers.length > 0, 'the authored first battle erased the entire company');
    stepUntil('First Muster completion', () => firstMuster.isFirstMusterComplete(g), 180);
    mark('raid-survived');

    const chosen = dispatch({ type: 'CHOOSE_RECOVERY_DOCTRINE', doctrine: 'fortify' });
    requireEqual(chosen.doctrine, 'fortify', 'recovery choice did not latch');
    dispatch({ type: 'SET_WORKFORCE_PRIORITY', x: barracks.x, y: barracks.y, priority: 'off' });
    const approachPredicate = [
      (_x, y) => y <= state.MAP_H / 2 - 5,
      (x, _y) => x >= state.MAP_W / 2 + 5,
      (_x, y) => y >= state.MAP_H / 2 + 5,
      (x, _y) => x <= state.MAP_W / 2 - 5,
    ][approach];
    const wall = place('wall', approachPredicate);
    stepUntil(
      'post-raid fortification',
      () => recovery.isPostRaidRecoveryComplete(g),
      3_600,
    );
    requireCondition(wall.buildProgress >= 1, 'Fortify completed before the Wall');
    stepUntil('scenario victory', () => g._scenarioWon === true && scenarios.checkScenarioComplete(), 180);
    mark('frontier-fortified');

    const buildingPanels = {};
    for (const structure of [farm, house, barracks, wall]) {
      ui.showInfoPanel(structure);
      const rows = [...document.querySelectorAll('#info-panel .ip-row')].map(row => ({
        label: row.querySelector('.ip-label')?.textContent?.trim() || '',
        value: row.querySelector('.ip-val')?.textContent?.trim() || '',
      }));
      const grounded = Object.fromEntries(rows
        .filter(row => ['People', 'Activity', 'Why it matters'].includes(row.label))
        .map(row => [row.label, row.value]));
      requireEqual(Object.keys(grounded).length, 3, `${structure.type} panel omitted grounded use rows`);
      requireCondition(Object.values(grounded).every(Boolean), `${structure.type} panel exposed an empty grounded use row`);
      buildingPanels[structure.type] = grounded;
    }

    return {
      marks,
      totalTicks: g.gameTick,
      realTimeMinutesAt1x: Number((g.gameTick / 60 / 60).toFixed(2)),
      openingFood: marks[0].food,
      foodAtMuster: marks.find(entry => entry.id === 'soldier-3')?.food,
      finalPopulation: g.population,
      survivingSoldiers: g.soldiers.length,
      recruitedNames,
      approach: ['north', 'east', 'south', 'west'][approach],
      raidsSurvived: g.stats.raidsSurvived,
      doctrine: recovery.getPostRaidRecoveryReport(g).selected,
      scenarioWon: g._scenarioWon,
      ordersExercised: ['guard', 'explore', 'rally'],
      buildingPanels,
    };
  });

  assert.equal(report.openingFood, 18);
  assert.equal(report.recruitedNames.length, 3);
  assert.equal(report.raidsSurvived, 1);
  assert.equal(report.doctrine, 'fortify');
  assert.equal(report.scenarioWon, true);
  assert.deepEqual(report.ordersExercised, ['guard', 'explore', 'rally']);
  assert.deepEqual(Object.keys(report.buildingPanels), ['farm', 'house', 'barracks', 'wall']);
  assert.ok(report.totalTicks <= 36_000, `mechanical vertical slice exceeded ten 1x minutes: ${report.totalTicks} ticks`);
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileArmy = await page.locator('#army-stance').evaluate(element => ({
    label: element.querySelector('#army-order-label')?.textContent?.trim(),
    controls: [...element.querySelectorAll('.stance-btn')].map(button => {
      const box = button.getBoundingClientRect();
      return { width: box.width, height: box.height, label: button.getAttribute('aria-label') };
    }),
  }));
  assert.equal(mobileArmy.controls.length, 5);
  assert.ok(mobileArmy.label, 'mobile army controls omitted the current-order label');
  for (const control of mobileArmy.controls) {
    assert.ok(control.width >= 44 && control.height >= 44, `${control.label} touch target is ${control.width}x${control.height}`);
  }
  assert.deepEqual(errors, [], `browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify(report, null, 2));
  console.log(`[first-muster-playthrough] PASS — real construction-to-recovery slice in ${report.realTimeMinutesAt1x} 1x minutes`);
} finally {
  await browser.close();
  await server.stop();
}
