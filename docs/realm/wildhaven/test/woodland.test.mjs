import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, build, tick, serialize, restore, pauseBuilding, rates, canBuild, listTiles } from '../js/sim.js';
import { TREE_SITES, TREE_TIMBER, SAPLING_SECONDS, PLANTING_WORK, groveFor, treeState, woodlandStatus, harvestWood, tickWoodland, restoreWoodland } from '../js/woodland.js';
function town() {
  const s = createGame();
  const site = listTiles().sort((a,b)=>Math.hypot(a.x+5,a.z+1)-Math.hypot(b.x+5,b.z+1)).flatMap(t=>[0,1,2,3].map(rotation=>({...t,rotation}))).find(t=>canBuild(s,'lumber',t.x,t.z,t.rotation).ok);
  const result = build(s, 'lumber', site.x, site.z, site.rotation);
  assert.equal(result.ok, true, result.reason);
  tick(s, 20);
  pauseBuilding(s, 'hearth', true);
  assert.equal(result.building.status, 'ready');
  return [s, result.building];
}
test('timber production draws down real shared trees and exposes their next harvest', () => {
  const [s, b] = town(), start = woodlandStatus(s, b).available, wood = s.resources.wood;
  tick(s, 20);
  assert.ok(s.resources.wood > wood);
  assert.ok(Math.abs((start-woodlandStatus(s,b).available)-(s.resources.wood-wood)) < .0001);
  assert.equal(new Set(TREE_SITES.map(t=>t.id)).size, TREE_SITES.length);
});
test('overlapping yards cannot duplicate timber or harvest a stump', () => {
  const [s, b] = town(), copy = {...b,id:'other'}, before = woodlandStatus(s,b).available;
  assert.ok(Math.abs(harvestWood(s,b,1000)-before)<1e-7);
  assert.equal(harvestWood(s,copy,1000),0);
  assert.equal(woodlandStatus(s,b).stumps,12);
  const stored=s.resources.wood;
  tick(s,1);
  assert.equal(s.resources.wood,stored);
  assert.match(rates(s).buildings[b.id].blockedReason,/woodland/);
});
test('felling, staffed replanting, independent growth and mature stock form a complete cycle', () => {
  const [s,b]=town(), site=groveFor(b)[0], remaining=treeState(s,site.id).wood;
  harvestWood(s,b,remaining); assert.equal(treeState(s,site.id).growth,-1);
  b.paused=true;tickWoodland(s,30);assert.equal(treeState(s,site.id).growth,-1);
  b.paused=false;b.workerIds=[];tickWoodland(s,30);assert.equal(treeState(s,site.id).growth,-1);
  b.workerIds=['c1'];tickWoodland(s,PLANTING_WORK-1);assert.equal(treeState(s,site.id).growth,-1);
  tickWoodland(s,1);assert.equal(treeState(s,site.id).growth,0);assert.equal(s.woodland.planted,1);
  b.paused=true;tickWoodland(s,SAPLING_SECONDS-1);assert.equal(treeState(s,site.id).wood,0);
  tickWoodland(s,1);assert.equal(treeState(s,site.id).wood,TREE_TIMBER);
});
test('save reload preserves partial cutting and planting; older saves gain mature woodland', () => {
  const [s,b]=town();harvestWood(s,b,10);tickWoodland(s,2);
  const loaded=restore(serialize(s));assert.ok(loaded);assert.deepEqual(loaded.woodland,s.woodland);
  const old=JSON.parse(serialize(s));delete old.woodland;
  const migrated=restore(old);assert.ok(migrated);assert.equal(migrated.resources.wood,s.resources.wood);assert.equal(migrated.day,s.day);assert.deepEqual(migrated.woodland,{trees:{},felled:0,planted:0});
});
test('untrusted saves cannot inject trees, negative growth or timber in a sapling', () => {
  const id=TREE_SITES[0].id;
  for(const tree of [{wood:9,growth:180,planting:0},{wood:8,growth:0,planting:0},{wood:0,growth:-.5,planting:0},{wood:0,growth:-1,planting:12}]) assert.throws(()=>restoreWoodland({trees:{[id]:tree},felled:0,planted:0}));
  assert.throws(()=>restoreWoodland({trees:{fake:{wood:1,growth:180,planting:0}},felled:0,planted:0}));
  const s=createGame();s.woodland.trees[id]={wood:1,growth:Infinity,planting:0};assert.equal(restore(serialize(s)),null);
});
test('storage saturation does not fell trees and paused yards cannot harvest', () => {
  const [s,b]=town();s.resources.wood=200;
  const before=woodlandStatus(s,b).available;tick(s,20);assert.equal(woodlandStatus(s,b).available,before);
  s.resources.wood=0;pauseBuilding(s,b.id,true);tick(s,20);assert.equal(s.resources.wood,0);
});
