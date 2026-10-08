import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import * as THREE from '../../vendor/three/three.module.js';
import { groundHeight, isLand } from '../js/island.js';

const threeURL = new URL('../../vendor/three/three.module.js', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(specifier, context, next) { if (specifier === 'three') return { url: ${JSON.stringify(threeURL)}, shortCircuit: true }; return next(specifier, context); }`));
const { VillageWorld, CELL } = await import('../js/world.js');

function village() {
  const world = Object.create(VillageWorld.prototype);
  Object.assign(world, { clock: 0, actors: [], buildings: new Map(), state: { buildings: [], frontier: { fortifications: [] } }, emitSound() {} });
  return world;
}
function resident(world, x, z, index = world.actors.length) {
  const root = new THREE.Group(); root.position.set(x * CELL, groundHeight(x, z), z * CELL);
  const actor = { root, limbs: {}, index, path: [], phase: 0, wait: 1e6, workTime: 0, parcel: { visible: false }, citizen: { id: `c${index}`, job: 'guard' }, workplace: null };
  world.actors.push(actor); return actor;
}
function watchHouse(world, x = 2, z = 4) {
  const building = { id: 'watch', type: 'barracks', status: 'ready', x, z, rotation: 0, workerIds: world.actors.map(a => a.citizen.id) };
  world.state.buildings.push(building);
  // Small deterministic model for the real workstation solver; no renderer,
  // authored asset changes, economic ticks or browser save are involved.
  const shown = new THREE.Group(), model = new THREE.Group();
  shown.position.set(x * CELL, groundHeight(x, z), z * CELL); shown.add(model);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1, 1.6), new THREE.MeshBasicMaterial()); wall.position.y = .5; model.add(wall);
  shown.userData = { signature: 'watch:ready', model }; world.buildings.set(building.id, shown);
  for (const actor of world.actors) { actor.workplace = building.id; actor.citizen.workplace = building.id; }
  world.updatePaths(); return building;
}
function advance(world, seconds, inspect = () => {}) {
  for (let i = 0; i < seconds / .05; i++) { world.clock += .05; world.updateActors(.05); inspect(); }
}
function legalGround(world, actor) {
  const { x, z } = actor.root.position;
  assert.ok(isLand(x / CELL + .13, z / CELL + .13) && isLand(x / CELL - .13, z / CELL - .13), 'Resident stays on dry land');
  assert.ok(world.actorWaypointValid({ x: x / CELL, z: z / CELL, stationBuilding: actor.station?.buildingId }), 'Resident stays outside blocked tiles');
}

test('a guard leaves an occupied starting tile without insisting on its center', () => {
  const world = village(), guard = resident(world, -.39, 3), neighbor = resident(world, 0, 3);
  watchHouse(world); neighbor.workplace = neighbor.citizen.workplace = null; neighbor.citizen.job = 'idle'; neighbor.wait = 1e6; neighbor.publicSpot = { x: 0, z: 3 };
  world.routeActor(guard);
  assert.ok(guard.path.length); assert.notDeepEqual(guard.path[0], { x: 0, z: 3, exact: true });
  advance(world, 16, () => legalGround(world, guard));
  assert.equal(guard.path.length, 0); assert.equal(guard.root.userData.workState, 'watching');
  assert.ok(guard.root.position.distanceTo(neighbor.root.position) > 2);
});

test('an already stalled route recovers through real routing and reaches the watch house', () => {
  const world = village(), guard = resident(world, -.39, 3), neighbor = resident(world, 0, 3);
  watchHouse(world); neighbor.workplace = neighbor.citizen.workplace = null; neighbor.citizen.job = 'idle'; neighbor.wait = 1e6; neighbor.publicSpot = { x: 0, z: 3 };
  guard.path = [{ x: 0, z: 3, exact: true }, { x: 0, z: 4 }]; guard.activity = 'work';
  advance(world, 20, () => legalGround(world, guard));
  assert.equal(guard.path.length, 0); assert.equal(guard.root.userData.workState, 'watching');
  assert.ok(guard.blockedWaypoint, 'A route with no net progress was actually invalidated');
});

test('opposing guards pass on the real southern shoreline without entering water or overlapping', () => {
  const world = village(), east = resident(world, -3, 8), west = resident(world, 3, 8);
  east.path = world.findPath({ x: -3, z: 8 }, { x: 3, z: 8 }); west.path = world.findPath({ x: 3, z: 8 }, { x: -3, z: 8 });
  east.activity = west.activity = 'patrol';
  const starts = world.actors.map(a => a.root.position.clone()); let closest = Infinity;
  advance(world, 24, () => {
    for (const actor of world.actors) legalGround(world, actor);
    closest = Math.min(closest, Math.hypot(east.root.position.x - west.root.position.x, east.root.position.z - west.root.position.z));
  });
  assert.equal(east.path.length, 0); assert.equal(west.path.length, 0);
  assert.ok(east.root.position.x > 2.7 * CELL && west.root.position.x < -2.7 * CELL);
  assert.ok(closest >= .43, `Closest separation: ${closest}`);
  assert.ok(world.actors.every((a, i) => a.root.position.distanceTo(starts[i]) > 9), 'Both guards travel, rather than merely stop animating');
});

test('a changed gate cancels the first approach and isolated residents wait without teleporting', () => {
  const world = village(), guard = resident(world, 0, 5);
  // A closed fence line divides this deliberately bounded passage. World
  // routing, gate transitions, body motion and recovery are still real methods.
  const originalWalkable = world.walkable.bind(world);
  world.walkable = (x, z) => x === 0 && z >= 3 && z <= 6 && originalWalkable(x, z);
  const gate = { id: 'gate', type: 'gate', x: 0, z: 4, status: 'ready', open: true, rotation: 0 };
  world.state.frontier.fortifications.push(gate); world.updatePaths();
  guard.path = world.findPath({ x: 0, z: 5 }, { x: 0, z: 3 }); const position = guard.root.position.clone();
  gate.open = false; world.updatePaths();
  assert.equal(guard.path.length, 0); assert.ok(guard.root.position.equals(position));
  assert.deepEqual(world.findPath({ x: 0, z: 5 }, { x: 0, z: 3 }), []);
  assert.deepEqual(world.nearestWalkable(0, 5, false), { x: 0, z: 5 });
  guard.wait = 1e6; advance(world, 4); assert.ok(guard.root.position.equals(position));
  gate.open = true; world.updatePaths(); guard.wait = 1e6; guard.path = world.findPath({ x: 0, z: 5 }, { x: 0, z: 3 });
  advance(world, 7, () => legalGround(world, guard));
  assert.equal(guard.path.length, 0); assert.ok(guard.root.position.z < 3.2 * CELL);
});

test('an open gate still blocks sideways station approaches and diagonal corner cutting', () => {
  const world = village(), guard = resident(world, -.49, 4);
  world.state.frontier.fortifications.push({ id: 'gate', type: 'gate', x: 0, z: 4, status: 'ready', open: true, rotation: 0 });
  guard.root.position.x = -.51 * CELL;
  assert.deepEqual(world.crowdStep(guard, .02 * CELL, 0, .02 * CELL, { x: 1, z: 4, stationBuilding: 'watch' }), { x: 0, z: 0 });
  guard.root.position.set(-.51 * CELL, 0, 3.49 * CELL);
  assert.deepEqual(world.crowdStep(guard, .02 * CELL, .02 * CELL, Math.hypot(.02 * CELL, .02 * CELL), { x: 1, z: 5, stationBuilding: 'watch' }), { x: 0, z: 0 });
});

test('new construction and changed workstation models discard stale routes and return to work', () => {
  const world = village(), guard = resident(world, -2, 3); const house = watchHouse(world);
  world.routeActor(guard); const oldPath = guard.path;
  const next = oldPath.find(point => !point.stationBuilding && !(point.x === -2 && point.z === 3));
  assert.ok(next);
  world.state.buildings.push({ id: 'new', type: 'cottage', x: next.x, z: next.z }); world.updatePaths();
  assert.equal(guard.path.length, 0);
  const shown = world.buildings.get(house.id); shown.userData.signature = 'watch:upgraded';
  advance(world, 24, () => legalGround(world, guard));
  assert.equal(guard.path.length, 0); assert.equal(guard.root.userData.workState, 'watching');
  assert.equal(guard.station.signature, 'watch:upgraded');
  assert.notStrictEqual(guard.path, oldPath);
});

test('an unreachable workplace reports a blocked approach and retries after the fence opens', () => {
  const world = village(), guard = resident(world, 0, 3); watchHouse(world, 0, 6);
  for (let x = -3; x <= 3; x++) world.state.frontier.fortifications.push({ id: `f${x}`, type: 'wall', x, z: 4, status: 'ready' });
  const originalWalkable = world.walkable.bind(world); world.walkable = (x, z) => x >= -3 && x <= 3 && z >= 2 && z <= 8 && originalWalkable(x, z);
  world.updatePaths(); world.routeActor(guard); advance(world, 10);
  assert.equal(guard.path.length, 0); assert.equal(guard.activity, 'waiting'); assert.match(guard.root.userData.workReason, /clear, connected approach/);
  world.state.frontier.fortifications.find(f => f.x === 0).status = 'ruined'; world.updatePaths();
  advance(world, 20, () => legalGround(world, guard));
  assert.equal(guard.path.length, 0); assert.equal(guard.root.userData.workState, 'watching');
});

test('two guards approaching a shore watch house reserve separate entrance ports', () => {
  const world = village(), first = resident(world, -.3, 8, 0), second = resident(world, 1, 8, 2);
  const house = watchHouse(world, 0, 6); house.workerIds = [first.citizen.id, 'middle-shift', second.citizen.id];
  world.routeActor(first); world.routeActor(second);
  assert.ok(first.station && second.station);
  const a = first.station.approach, b = second.station.approach;
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) * CELL >= .445, 'Clamped approach lanes must not overlap, even when the work stances do not');
  advance(world, 18, () => { for (const actor of world.actors) legalGround(world, actor); });
  assert.equal(first.path.length, 0); assert.equal(second.path.length, 0);
  assert.equal(first.root.userData.workState, 'watching'); assert.equal(second.root.userData.workState, 'watching');
  assert.ok(Math.hypot(first.root.position.x - second.root.position.x, first.root.position.z - second.root.position.z) >= .43);
});
