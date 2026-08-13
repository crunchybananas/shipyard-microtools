#!/usr/bin/env node

import assert from 'node:assert/strict';
import { G, MAP_H, MAP_W, createResourceStock, setSeed } from '../js/state.js?realm=193';
import { generateWorld } from '../js/world.js?realm=193';
import { updateAvatar } from '../js/avatar.js?realm=193';

setSeed(22551);
generateWorld();
G.resources = createResourceStock({ gold: 4 });
G.totalResourcesGathered = 0;
G.fog = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(false));
G.avatar.x = 20;
G.avatar.y = 20;
G.avatar.tx = 20;
G.avatar.ty = 20;
G.avatar.path = null;
G.avatar.scoutedTiles = 0;
G.avatar.scoutingFinds = 0;

G.gameTick = 15;
updateAvatar();
assert.equal(G.avatar.scoutingFinds, 1, 'first scouting sweep did not find one cache');
assert.equal(G.resources.gold, 5, 'scouting cache did not award gold');
const firstTiles = G.avatar.scoutedTiles;
assert.ok(firstTiles >= 24, 'scouting did not count newly charted tiles');

G.gameTick = 30;
updateAvatar();
assert.equal(G.avatar.scoutedTiles, firstTiles, 'standing still charted the same terrain twice');
assert.equal(G.resources.gold, 5, 'standing still repeated a scouting reward');

G.avatar.x = 30;
G.avatar.y = 20;
G.avatar.tx = 30;
G.avatar.ty = 20;
G.gameTick = 45;
updateAvatar();
assert.ok(G.avatar.scoutingFinds >= 2, 'moving into fog did not earn another scouting find');
assert.equal(G.resources.gold, 4 + G.avatar.scoutingFinds, 'gold reward diverged from durable find count');
assert.equal(G.totalResourcesGathered, G.avatar.scoutingFinds, 'scouting reward was absent from gathered-resource stats');

console.log('[founder-scouting] PASS — newly charted terrain rewards exploration once and standing still cannot farm it');
