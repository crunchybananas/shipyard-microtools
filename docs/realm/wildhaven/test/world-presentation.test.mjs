import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// Exercise real Three.js geometry and ownership without a browser or GPU.
const threeURL = new URL('../../vendor/three/three.module.js', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(specifier, context, next) { if (specifier === 'three') return { url: ${JSON.stringify(threeURL)}, shortCircuit: true }; return next(specifier, context); }`));
const THREE = await import('three');
const { VillageWorld, CELL } = await import('../js/world.js');
const { createGame, buildingEntrance } = await import('../js/sim.js');
const { groundHeight, isLand } = await import('../js/island.js');

function world() {
  const instance = Object.create(VillageWorld.prototype);
  const geometry = new THREE.BoxGeometry(1, 1, 1), material = new THREE.MeshStandardMaterial();
  Object.assign(instance, { scene: new THREE.Scene(), state: createGame(), buildings: new Map(), actors: [], templates: new Map(['cottage', 'well'].map(name => [name, new THREE.Mesh(geometry, material)])) });
  instance.createPreview();
  return { instance, geometry, material };
}

test('entrance arrows point from the actual reserved lane to the door in all four rotations', () => {
  const { instance } = world(), site = { x: 2, z: 1 };
  const before = JSON.stringify(instance.state);
  for (let rotation = 0; rotation < 4; rotation++) {
    instance.showPreview('cottage', site, true, rotation);
    const front = buildingEntrance({ ...site, rotation }), dx = front.x - site.x, dz = front.z - site.z;
    const arrow = instance.entranceMark.geometry.attributes.position;
    assert.ok(Math.abs(arrow.getX(0) - site.x * CELL - dx * 1.14) < 1e-6);
    assert.ok(Math.abs(arrow.getZ(0) - site.z * CELL - dz * 1.14) < 1e-6);
    for (let i = 0; i < arrow.count; i++) assert.ok(Math.abs(arrow.getY(i) - groundHeight(arrow.getX(i) / CELL, arrow.getZ(i) / CELL) - .045) < 1e-6);
    const lane = instance.entranceLane.geometry.attributes.position;
    for (let i = 0; i < lane.count; i++) {
      assert.ok(Math.abs(lane.getX(i) - front.x * CELL) <= .791);
      assert.ok(Math.abs(lane.getZ(i) - front.z * CELL) <= .791);
    }
  }
  instance.showPreview(null);
  assert.equal(instance.entranceMark.visible, false);
  assert.equal(instance.entranceLane.visible, false);
  assert.equal(JSON.stringify(instance.state), before);
});

test('replacing previews releases owned materials and keeps shared model geometry intact', () => {
  const { instance, geometry, material } = world();
  let sharedGeometryDisposals = 0, sharedMaterialDisposals = 0, previewDisposals = 0;
  geometry.addEventListener('dispose', () => sharedGeometryDisposals++);
  material.addEventListener('dispose', () => sharedMaterialDisposals++);
  instance.showPreview('cottage', { x: 2, z: 1 }, true);
  const old = instance.previewMesh;
  old.material.addEventListener('dispose', () => previewDisposals++);
  instance.showPreview('well', { x: 2, z: 1 }, true);
  assert.equal(previewDisposals, 1);
  assert.equal(old.parent, null);
  assert.equal(sharedGeometryDisposals, 0);
  assert.equal(sharedMaterialDisposals, 0);
  assert.equal(instance.highlight.children.length, 2);
});

test('touch placement leaves the entrance arrow clear and the footprint owns its visible stroke', () => {
  const { instance } = world();
  // A plain sprite exercises placement visibility without a DOM canvas/GPU.
  instance.entranceLabel = new THREE.Sprite(); instance.setCueLabel = () => {};
  instance.showPreview('cottage', { x: 2, z: 1 }, true, 0, { entranceLabel: false });
  assert.equal(instance.entranceLabel.visible, false);
  assert.equal(instance.entranceMark.visible, true); assert.equal(instance.entranceLane.visible, true);
  assert.equal(instance.previewBorder.material.depthTest, false, 'Nearby foliage must not hide the site footprint');
  instance.previewBorder.geometry.computeBoundingBox();
  const box = instance.previewBorder.geometry.boundingBox;
  assert.ok(Math.abs(box.max.x - box.min.x - CELL) < 1e-6);
  assert.ok(Math.abs(box.max.z - box.min.z - CELL) < 1e-6);
  instance.showPreview('cottage', { x: 2, z: 1 }, true);
  assert.equal(instance.entranceLabel.visible, true, 'Desktop placement retains its explanatory label');
  let geometries = 0, materials = 0;
  instance.previewBorder.geometry.addEventListener('dispose', () => geometries++);
  instance.previewBorder.material.addEventListener('dispose', () => materials++);
  instance.disposePresentation(instance.highlight);
  assert.equal(geometries, 1); assert.equal(materials, 1);
});

test('service terrain geometry stays on land and refreshes actual capacity without rebuilding reach', () => {
  const { instance } = world();
  instance.makeCueLabel = () => new THREE.Sprite(); instance.setCueLabel = () => {};
  const well = { id: 'well', type: 'well', x: 2, z: 3, level: 1, rotation: 0, status: 'ready', paused: false };
  instance.state.buildings.push(well);
  const before = JSON.stringify(instance.state);
  const initial = instance.showServiceArea('well', well, 1, { label: false }), group = instance.serviceArea;
  assert.equal(initial.capacity, 35);
  assert.equal(group.userData.label.visible, false, 'Touch inspection keeps reach geometry without a second floating label');
  assert.equal(instance.serviceAreaRequest.label, false, 'The choice persists for later simulation sync');
  assert.equal(JSON.stringify(instance.state), before);
  for (const mesh of group.children) {
    if (!mesh.isMesh) continue;
    const points = mesh.geometry.attributes.position;
    if (mesh.material.opacity === .16) for (let i = 0; i < points.count; i++) assert.ok(isLand(points.getX(i) / CELL, points.getZ(i) / CELL));
  }
  well.paused = true;
  assert.equal(instance.showServiceArea('well', well, 1, { label: false }).capacity, 0);
  assert.equal(instance.serviceArea, group, 'Supply changes refresh the label without allocating new terrain geometry');
  assert.equal(group.userData.label.visible, false);
  let disposed = 0;
  group.traverse(object => { if (object.userData.ownsGeometry) object.geometry.addEventListener('dispose', () => disposed++); });
  well.level = 2;
  assert.equal(instance.showServiceArea('well', well).radius, 5, 'Selected service picks up a completed upgrade');
  assert.notEqual(instance.serviceArea, group);
  assert.ok(disposed >= 3);
  assert.equal(group.parent, null);
});

test('removing cue sprites disposes their private texture and material', () => {
  const { instance } = world(), texture = new THREE.Texture(), material = new THREE.SpriteMaterial({ map: texture }), sprite = new THREE.Sprite(material);
  sprite.userData = { ownsMaterial: true, ownsTexture: true };
  const group = new THREE.Group(); group.add(sprite); instance.scene.add(group);
  let textures = 0, materials = 0;
  texture.addEventListener('dispose', () => textures++); material.addEventListener('dispose', () => materials++);
  instance.disposePresentation(group);
  assert.equal(textures, 1); assert.equal(materials, 1); assert.equal(group.parent, null);
});

test('replacing batched markers releases the instanced matrix buffer as well as their geometry', () => {
  const { instance } = world(), geometry = new THREE.PlaneGeometry(1, 1), material = new THREE.MeshBasicMaterial();
  const markers = new THREE.InstancedMesh(geometry, material, 20);
  markers.userData = { ownsGeometry: true, ownsMaterial: true };
  instance.scene.add(markers);
  let instances = 0, geometries = 0;
  markers.addEventListener('dispose', () => instances++); geometry.addEventListener('dispose', () => geometries++);
  instance.disposePresentation(markers);
  assert.equal(instances, 1); assert.equal(geometries, 1); assert.equal(markers.parent, null);
});

test('switching independent town snapshots with reused IDs resets model positions and resident routes', () => {
  const { instance, geometry, material } = world();
  for (const name of ['villager', 'cargo_grain']) instance.templates.set(name, new THREE.Mesh(geometry, material));
  instance.decor = new Map(); instance.pathMaterial = material;
  const first = {
    buildings: [{ id: 'b1', type: 'cottage', x: 2, z: 1, rotation: 0, level: 1, status: 'ready' }],
    citizens: [{ id: 'c1', name: 'Ada', job: 'idle', workplace: null }], population: 1,
  };
  const second = structuredClone(first); Object.assign(second.buildings[0], { x: -2, z: 0, rotation: 2 });
  const snapshots = [JSON.stringify(first), JSON.stringify(second)];
  instance.sync(first);
  const oldBuilding = instance.buildings.get('b1'), oldActor = instance.actors[0];
  oldActor.path = [{ x: 2, z: 2, exact: true }];
  oldActor.station = { buildingId: 'b1', signature: oldBuilding.userData.signature, exit: { x: 2, z: 2 } };
  instance.selectedCitizenId = 'c1'; instance.hoveredCitizenId = 'c1';
  instance.sync(second);
  const newBuilding = instance.buildings.get('b1'), newActor = instance.actors[0];
  assert.notEqual(newBuilding, oldBuilding);
  assert.equal(newBuilding.position.x, -2 * CELL); assert.equal(newBuilding.position.z, 0);
  assert.equal(newBuilding.rotation.y, Math.PI);
  assert.equal(oldBuilding.parent, null); assert.equal(oldActor.root.parent, null);
  assert.notEqual(newActor, oldActor); assert.deepEqual(newActor.path, []); assert.equal(newActor.station, null);
  assert.equal(instance.selectedCitizenId, null); assert.equal(instance.hoveredCitizenId, null);
  instance.sync(second);
  assert.equal(instance.actors[0], newActor, 'Ordinary sync retains that town’s live animation');
  assert.deepEqual([JSON.stringify(first), JSON.stringify(second)], snapshots);
});
