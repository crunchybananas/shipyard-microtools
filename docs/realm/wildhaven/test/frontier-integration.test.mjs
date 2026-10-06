import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as sim from '../js/sim.js';
import * as frontier from '../js/frontier.js';

const earned = readFileSync(new URL('../review/campaign-forge-save.json', import.meta.url), 'utf8');
function town() { const state = sim.restore(earned); assert.ok(state); return state; }
function act(state, result) { assert.equal(result.ok, true, result.reason); sim.refreshTown(state); return result; }
const ctx = state => sim.frontierContext(state);
function conserved(state) {
  const used = new Set();
  for (const b of state.buildings) for (const id of b.workerIds) { assert.ok(!used.has(id), `${id} works twice`); used.add(id); }
  for (const a of frontier.frontierAssignments(state)) {
    assert.ok(!used.has(a.citizenId), `${a.citizenId} serves while working in town`); used.add(a.citizenId);
    const person = state.citizens.find(c => c.id === a.citizenId); assert.equal(person.job, a.job); assert.equal(person.workplace, a.workplace);
  }
  assert.equal(used.size, sim.workforce(state).assigned);
  assert.equal(state.population, state.citizens.length);
  for (const c of state.citizens) assert.equal(used.has(c.id), c.job !== 'idle');
  for (const n of Object.values(state.resources)) assert.ok(Number.isFinite(n) && n >= 0);
}
function stepUntil(state, predicate, max = 250) {
  for (let i = 0; i < max && !predicate(); i++) { sim.tick(state, 1); conserved(state); }
  assert.ok(predicate(), `Condition did not complete within ${max} simulated seconds`);
}

test('v2 migration starts an untouched frontier, preserves the earned economy, and stays quiet without contact', () => {
  const before = JSON.parse(earned), state = town();
  assert.equal(state.version, 4); assert.equal(state.migratedFromVersion, 2);
  assert.deepEqual(state.resources, before.resources); assert.equal(state.population, before.population);
  assert.deepEqual(state.frontier.claims, ['home']); assert.equal(state.frontier.units.length, 0);
  sim.tick(state, 600); assert.equal(state.frontier.warning, null); assert.equal(state.frontier.raidActive, false);
  assert.equal(state.frontier.units.length, 0); conserved(state);
  const corrupt = JSON.parse(sim.serialize(state)); delete corrupt.frontier; assert.equal(sim.restore(corrupt), null);
});

test('military training spends exact equipment, removes real civilian labor, and resumes deterministically', () => {
  const state = town(), before = {...state.resources};
  assert.ok(ctx(state).defenseMultiplier > ctx(sim.createGame()).defenseMultiplier, 'Actual earned watch research reaches combat context');
  const unit = act(state, frontier.recruitTroop(state, 'spearman', null, ctx(state))).unit;
  for (const [key, cost] of Object.entries(frontier.TROOPS.spearman.cost)) assert.equal(state.resources[key], before[key] - cost);
  conserved(state); assert.equal(state.citizens.find(c => c.id === unit.citizenId).job, 'spearman');
  assert.equal(frontier.recruitTroop(state, 'archer', unit.citizenId, ctx(state)).ok, false);
  sim.tick(state, 17.5); const resumed = sim.restore(sim.serialize(state)); assert.ok(resumed); conserved(resumed);
  sim.tick(state, 31.5); for (let i = 0; i < 126; i++) sim.tick(resumed, .25);
  assert.deepEqual(resumed.frontier, state.frontier); assert.deepEqual(resumed.resources, state.resources);
  assert.equal(unit.status, 'active'); conserved(state); conserved(resumed);
});

test('a paid engineer walks to a wall, builds with exclusive labor, and returns to civilian work', () => {
  const state = town(), options = sim.listTiles().filter(t => t.regionId === 'home' && t.buildable).sort((a,b) => Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z));
  const spot = options.find(t => frontier.canPlaceFortification(state,'wall',t.x,t.z,0,ctx(state)).ok); assert.ok(spot);
  const before = {...state.resources}, fort = act(state,frontier.placeFortification(state,'wall',spot.x,spot.z,0,ctx(state))).fortification;
  assert.equal(fort.progress,0); assert.ok(Math.abs(state.resources.stone-(before.stone-frontier.FORTIFICATIONS.wall.cost.stone))<1e-6);
  const engineer = state.frontier.units.find(u=>u.kind==='engineer'); assert.ok(engineer); conserved(state);
  const early = sim.restore(sim.serialize(state)); assert.ok(early); assert.equal(early.frontier.fortifications.find(f=>f.id===fort.id).progress,0);
  stepUntil(state,()=>fort.status==='ready'); assert.equal(fort.hp,fort.maxHp);
  stepUntil(state,()=>!frontier.reservedCitizenIds(state).includes(engineer.citizenId));
  assert.notEqual(state.citizens.find(c=>c.id===engineer.citizenId).job,'engineer');
  assert.equal(sim.canBuild(state,'cottage',spot.x,spot.z).ok,false); assert.ok(sim.restore(sim.serialize(state)));
});

test('survey and a completed outpost actually unlock civilian building on the larger island', () => {
  const state = town(), unit = act(state,frontier.recruitTroop(state,'spearman',null,ctx(state))).unit;
  sim.tick(state,37); act(state,frontier.commandTroops(state,[unit.id],{type:'move',x:-2,z:-18},ctx(state)));
  stepUntil(state,()=>unit.order.type==='hold'); assert.ok(Math.hypot(unit.x+2,unit.z+18)<.13);
  const before = sim.listTiles().filter(t=>t.regionId==='highmeadow'&&t.buildable).map(t=>sim.canBuild(state,'cottage',t.x,t.z));
  assert.ok(before.every(v=>!v.ok)); assert.ok(before.some(v=>/outpost/.test(v.reason)));
  // Move off the outpost site before the resident arrives to build it.
  act(state,frontier.commandTroops(state,[unit.id],{type:'move',x:-1,z:-18},ctx(state))); sim.tick(state,3);
  const claim=act(state,frontier.claimRegion(state,'highmeadow',ctx(state))); assert.equal(state.frontier.claims.includes('highmeadow'),false);
  stepUntil(state,()=>claim.fortification.status==='ready'); assert.ok(state.frontier.claims.includes('highmeadow'));
  const site=sim.listTiles().filter(t=>t.regionId==='highmeadow').flatMap(t=>[0,1,2,3].map(rotation=>({...t,rotation}))).find(t=>sim.canBuild(state,'cottage',t.x,t.z,t.rotation).ok); assert.ok(site);
  act(state,sim.build(state,'cottage',site.x,site.z,site.rotation));
  const saved=sim.restore(sim.serialize(state)); assert.ok(saved); assert.ok(saved.buildings.some(b=>b.x===site.x&&b.z===site.z)); conserved(saved);
});

test('a named envoy makes physical contact, gains relations and releases labor only after returning', () => {
  const state=town(), cost=frontier.TROOPS.envoy.cost, before={...state.resources};
  const unit=act(state,frontier.sendEnvoy(state,'reedbank',null,ctx(state))).unit;
  for(const[key,n]of Object.entries(cost))assert.equal(state.resources[key],before[key]-n);
  const n=state.frontier.neighbors.find(n=>n.id==='reedbank'); assert.equal(n.discovered,false);
  sim.tick(state,3); assert.equal(n.envoys,0);assert.ok(frontier.reservedCitizenIds(state).includes(unit.citizenId));
  stepUntil(state,()=>n.envoys===1);assert.equal(n.discovered,true);assert.ok(n.relation>=22);assert.equal(unit.missionStage,'returning');assert.ok(Math.hypot(unit.x-n.x,unit.z-n.z)<3.4,'Arrival was within 2.1 cells, followed by at most one second of return movement');
  const saved=sim.restore(sim.serialize(state));assert.ok(saved);assert.ok(frontier.reservedCitizenIds(saved).includes(unit.citizenId));
  stepUntil(state,()=>!frontier.reservedCitizenIds(state).includes(unit.citizenId));assert.equal(n.envoys,1);conserved(state);
});

test('civilian construction and demolition invalidate troop paths and preserve move/retreat destinations', () => {
  const state = town(), troop = act(state, frontier.recruitTroop(state, 'spearman', null, ctx(state))).unit;
  sim.tick(state, 37);
  const site = sim.listTiles().filter(t => t.regionId === 'home' && ctx(state).isWalkable(t.x, t.z))
    .flatMap(t => [0,1,2,3].map(rotation => ({ ...t, rotation })))
    .find(t => Math.hypot(t.x - troop.x, t.z - troop.z) > 4 && sim.canBuild(state, 'garden', t.x, t.z, t.rotation).ok);
  assert.ok(site, 'The earned town has an accessible, otherwise buildable garden site');
  act(state, frontier.commandTroops(state, [troop.id], { type: 'move', x: site.x, z: site.z }, ctx(state)));
  const reserved = sim.canBuild(state, 'garden', site.x, site.z, site.rotation);
  assert.equal(reserved.ok, false); assert.match(reserved.reason, /ordered destination/);
  act(state, frontier.commandTroops(state, [troop.id], { type: 'move', x: -2, z: -18 }, ctx(state)));
  sim.tick(state, .25); assert.ok(troop.path.length > 0, 'A real route exists before the building action');
  const garden = act(state, sim.build(state, 'garden', site.x, site.z, site.rotation)).building;
  assert.deepEqual(troop.path, []); assert.equal(troop.routeAt, -10);
  assert.ok(sim.restore(sim.serialize(state)), 'Saving immediately after changing town occupancy is safe');
  stepUntil(state, () => garden.status === 'ready', 90);
  assert.ok(troop.path.length > 0, 'The troop has replanned while builders complete the garden');
  act(state, sim.demolish(state, garden.id));
  assert.deepEqual(troop.path, []); assert.equal(troop.routeAt, -10);
  assert.ok(sim.restore(sim.serialize(state)), 'Saving immediately after demolition is safe');
  stepUntil(state, () => troop.order.type === 'hold', 90);
  assert.ok(Math.hypot(troop.x + 2, troop.z + 18) < .025, 'The original move completes after both reroutes');
  act(state, frontier.commandTroops(state, [troop.id], { type: 'retreat' }, ctx(state)));
  assert.equal(troop.order.type, 'retreat');
  const retreatSite = sim.canBuild(state, 'garden', troop.order.x, troop.order.z);
  assert.equal(retreatSite.ok, false); assert.match(retreatSite.reason, /ordered destination/);
  conserved(state);
});
