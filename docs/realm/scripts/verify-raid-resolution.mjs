#!/usr/bin/env node

import assert from 'node:assert/strict';
import { G, createResourceStock, setSeed } from '../js/state.js?realm=197';
import { generateWorld } from '../js/world.js?realm=197';
import { checkRaids } from '../js/economy.js?realm=197';
import { updateRaidSummary } from '../js/raid-summary.js?realm=197';

setSeed(48117);
generateWorld();
Object.assign(G, {
  day: 8,
  dayPhase: 0,
  nextRaidDay: 8,
  raidInterval: 8,
  era: 1,
  difficulty: 'normal',
  enemies: [],
  particles: [],
  projectiles: [],
  resources: createResourceStock({ wood: 40, food: 20, gold: 10 }),
  buildings: [{
    type: 'barracks', x: 40, y: 40, hp: 100, active: true,
    buildProgress: 1, buildTotal: 1, level: 1,
  }],
  stats: {
    buildingsBuilt: 1, buildingsLost: 0, raidsFaced: 0,
    citizensBorn: 0, citizensDied: 0, raidsSurvived: 0,
    enemiesKilled: 0, goldEarned: 0, daysLived: 0,
    housesEvolved: 0, scenariosWon: [], everHadBuilding: { barracks: true },
  },
  storyState: { lastProverbSeason: null, raid: null },
  _raidSide: 0,
  _raidSpawnCount: 0,
  _raidStolen: null,
  _raidWarningGiven: false,
});

checkRaids();
assert.equal(G.stats.raidsFaced, 1, 'spawned raid was not recorded');
assert.ok(G.enemies.length > 0, 'raid did not spawn enemies');
assert.equal(G.stats.raidsSurvived, 0, 'raid was credited before combat resolved');

updateRaidSummary();
assert.ok(G.storyState.raid, 'raid resolution tracker did not start');
G.enemies = [];
updateRaidSummary();
assert.equal(G.stats.raidsSurvived, 1, 'resolved raid with survivors was not credited');
updateRaidSummary();
assert.equal(G.stats.raidsSurvived, 1, 'resolved raid was credited twice');

G.storyState.raid = {
  day: G.day,
  killsStart: G.stats.enemiesKilled,
  deathsStart: G.stats.citizensDied,
};
G.citizens = [];
updateRaidSummary();
assert.equal(G.stats.raidsSurvived, 1, 'a razed realm was credited with survival');

console.log('[raid-resolution] PASS — survival is awarded once at battle resolution, never at spawn or after a wipe');
