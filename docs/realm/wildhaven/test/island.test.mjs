import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as island from '../js/island.js';
import * as sim from '../js/sim.js';

test('the full island has five connected regions and three clear settlement approaches', () => {
  const tiles = island.listTiles(), land = tiles.filter(t => t.kind !== 'water');
  assert.ok(land.length > 1400, `Expanded land count ${land.length}`);
  const available = new Set(land.filter(t => !island.hasNaturalObstacle(t.x, t.z) && !island.isNeighborCompoundCell(t.x, t.z)).map(t => `${t.x},${t.z}`));
  const seen = new Set(['0,3']), queue = [{x:0,z:3}];
  for(let i=0;i<queue.length;i++) for(const [dx,dz] of [[0,1],[1,0],[0,-1],[-1,0]]) {
    const x=queue[i].x+dx,z=queue[i].z+dz,key=`${x},${z}`;
    if(available.has(key)&&!seen.has(key)){seen.add(key);queue.push({x,z});}
  }
  for(const region of island.ISLAND_REGIONS) {
    assert.ok(seen.has(`${region.x},${region.z}`), `${region.name} is reachable on foot`);
    assert.equal(island.regionAt(region.x,region.z).id,region.id);
  }
  for(const neighbor of island.ISLAND_NEIGHBORS) {
    for(const [dx,dz] of [[0,2],[2,0],[0,-2],[-2,0]]) assert.ok(seen.has(`${neighbor.x+dx},${neighbor.z+dz}`), `${neighbor.name} has a clear two-cell approach`);
    assert.equal(island.isNeighborCompoundCell(neighbor.x,neighbor.z),true);
    assert.equal(island.terrainAt(neighbor.x,neighbor.z).buildable,false);
    for(let dx=-2;dx<=2;dx++) for(let dz=-2;dz<=2;dz++) assert.equal(island.hasNaturalObstacle(neighbor.x+dx,neighbor.z+dz),false);
  }
});

test('starter terrain, the landing and original earned villages survive island expansion', async () => {
  assert.equal(island.regionAt(0,-8).id,'home');
  assert.equal(island.terrainAt(2,8).buildable,false);
  assert.equal(island.terrainAt(0,-5).buildable,false);
  assert.equal(island.isLand(2,10),false,'Original landing still opens onto water');
  for(const checkpoint of ['foundation','services-lanes','freeport','freeport-slow','forge']) {
    const raw=JSON.parse(await readFile(new URL(`../review/campaign-${checkpoint}-save.json`,import.meta.url),'utf8'));
    const state=sim.restore(raw);assert.ok(state,`${checkpoint} migrates`);
    assert.deepEqual(state.resources,raw.resources);assert.equal(state.population,raw.population);
    for(const b of state.buildings) assert.equal(island.regionAt(b.x,b.z).id,'home',`${b.id} keeps its home territory`);
  }
});

test('terrain bounds, dry building footprints and coast data agree throughout the map', () => {
  const bounds=island.ISLAND_BOUNDS;
  for(const t of island.listTiles()) {
    assert.ok(Number.isFinite(t.height)&&Number.isFinite(t.coastDistance));
    if(t.kind==='water') assert.equal(t.regionId,null);
    else assert.ok(island.ISLAND_REGIONS.some(r=>r.id===t.regionId));
    if(t.buildable) for(const dx of [-.5,.5]) for(const dz of [-.5,.5]) assert.ok(island.isLand(t.x+dx,t.z+dz));
  }
  for(const [x,z] of [[bounds.minX-1,0],[bounds.maxX+1,0],[0,bounds.minZ-1],[0,bounds.maxZ+1],[NaN,0]]) assert.equal(island.isLand(x,z),false);
});
