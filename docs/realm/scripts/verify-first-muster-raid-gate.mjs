#!/usr/bin/env node

import assert from 'node:assert/strict';
import { G, MAP_H, createResourceStock, setSeed } from '../js/state.js?realm=198';
import { generateWorld } from '../js/world.js?realm=198';
import { checkRaids, getRaidCountdown } from '../js/economy.js?realm=198';

setSeed(189_061);
generateWorld();
Object.assign(G, {
  scenario: 'military_rise',
  day: 8,
  dayPhase: 0,
  nextRaidDay: 8,
  raidInterval: 8,
  era: 2,
  difficulty: 'normal',
  enemies: [],
  particles: [],
  projectiles: [],
  buildings: [{
    type: 'barracks', x: 40, y: 40, hp: 100, active: true,
    buildProgress: 1, buildTotal: 1, level: 1,
  }],
  resources: createResourceStock({ wood: 40, food: 80, gold: 10 }),
  storyFlags: { firstMusterStep: 5, firstRaidApproach: 2 },
  stats: {
    buildingsBuilt: 1, buildingsLost: 0, raidsFaced: 0,
    citizensBorn: 0, citizensDied: 0, raidsSurvived: 0,
    enemiesKilled: 0, goldEarned: 0, daysLived: 0,
    housesEvolved: 0, scenariosWon: [], everHadBuilding: { barracks: true },
  },
  _raidSide: 2,
  _raidSpawnCount: 0,
  _raidStolen: null,
  _raidWarningGiven: false,
});

checkRaids();
assert.equal(G.enemies.length, 0, 'first raid spawned before rally placement');
assert.equal(G.stats.raidsFaced, 0);
assert.equal(G.nextRaidDay, 11, 'blocked raid did not preserve a warning runway');
assert.equal(G._raidSide, 2, 'blocked raid discarded Founder intelligence');
assert.equal(getRaidCountdown(), null, 'unready chapter advertised a moving three-day countdown');

G.day = 9;
checkRaids();
assert.equal(G.nextRaidDay, 12, 'unready chapter calendar stopped moving forward');
assert.equal(G.enemies.length, 0);

// Rally is now latched. Day 10 is exactly two dawns before the deferred wave:
// it may warn, but it may not spawn combat early.
G.storyFlags.firstMusterStep = 6;
G.day = 10;
checkRaids();
assert.equal(G.enemies.length, 0, 'ready chapter skipped its two-day warning');
assert.equal(G.nextRaidDay, 12);
assert.equal(G._raidSide, 2);
assert.equal(getRaidCountdown(), 2, 'ready chapter did not begin its real warning countdown');

G.day = 11;
checkRaids();
assert.equal(G.enemies.length, 0, 'ready chapter spawned on the one-day warning');
assert.equal(G._raidWarningGiven, true);

G.day = 12;
checkRaids();
assert.ok(G.enemies.length > 0, 'deferred first raid never spawned');
assert.equal(G.stats.raidsFaced, 1);
assert.ok(G.enemies.every(enemy => enemy.y === MAP_H - 1), 'wave ignored the Founder\'s south approach');
assert.equal(G.storyFlags.firstRaidApproach, 2, 'spawn consumed durable scouting intelligence');
assert.equal(G._raidSide, 2, 'live raid did not retain its scouted approach for deterministic retargeting');

console.log('[first-muster-raid-gate] PASS — no pre-rally wave, two-warning-day runway, and scouted approach persists through the live raid');
