import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { register } from 'node:module';
import { foliageTone, SEASON_PALETTES } from '../js/season-palette.js';
const threeURL = new URL('../../vendor/three/three.module.js', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(specifier, context, next) { if (specifier === 'three') return { url: ${JSON.stringify(threeURL)}, shortCircuit: true }; return next(specifier, context); }`));
const THREE = await import('three');
const { VillageWorld, CELL } = await import('../js/world.js');
const { createGame } = await import('../js/sim.js');

// Read the shipping GLB's actual vertex attributes, without loading a renderer.
const file = await readFile(new URL('../assets/village-kit.glb', import.meta.url));
const jsonLength = file.readUInt32LE(12), gltf = JSON.parse(file.subarray(20, 20 + jsonLength)), binary = file.subarray(28 + jsonLength);
function authoredTreeColors(name) {
  const root = gltf.nodes.find(node => node.name === name), meshNode = gltf.nodes[root.children[0]], primitive = gltf.meshes[meshNode.mesh].primitives[0];
  const accessor = gltf.accessors[primitive.attributes.COLOR_0], view = gltf.bufferViews[accessor.bufferView], offset = (view.byteOffset || 0) + (accessor.byteOffset || 0), stride = view.byteStride || 12;
  assert.equal(accessor.componentType, 5126); assert.equal(accessor.type, 'VEC3');
  const colors = new Float32Array(accessor.count * 3);
  for (let i = 0; i < accessor.count; i++) for (let channel = 0; channel < 3; channel++) colors[i * 3 + channel] = binary.readFloatLE(offset + i * stride + channel * 4);
  return colors;
}
const authored = { broadleaf: authoredTreeColors('broadleaf'), cypress: authoredTreeColors('cypress') };
function date(world, calendarDay) { world.state.day = 1 + (calendarDay - 1) * 4; world.state.time = world.state.subsecond = 0; }
function fixture() {
  const world = Object.create(VillageWorld.prototype), sharedMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff' }), land = new THREE.BufferGeometry();
  // Inland, inland shade, and the fully sandy coastal band.
  land.setAttribute('position', new THREE.Float32BufferAttribute([0, .8, 0, 4 * CELL, .8, 2 * CELL, -4 * CELL, .2, 8 * CELL], 3));
  land.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(9), 3));
  Object.assign(world, { state: createGame(), scene: new THREE.Scene(), land: new THREE.Mesh(land, sharedMaterial), skyLight: new THREE.HemisphereLight(),
    seasonalTrees: [], flowers: new THREE.InstancedMesh(new THREE.ConeGeometry(), new THREE.MeshStandardMaterial(), 20), flowerCount: 20,
    buildings: new Map(), actors: [], landmarks: [], water: new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial({ color: '#124c49' })) });
  for (const [type, source] of Object.entries(authored)) {
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('color', new THREE.Float32BufferAttribute(source.slice(), 3));
    world.seasonalTrees.push({ type, mesh: new THREE.Mesh(geometry, sharedMaterial), originalColors: source.slice() });
  }
  return { world, sharedMaterial };
}

// The same clay material is used for tree trunks, roofs, skin and the rest of
// the asset pack; palette matching must operate on verified foliage only.
test('every authored forest vertex is either verified foliage or the unchanged brown trunk', () => {
  const trunk = new THREE.Color('#94633e');
  for (const [type, colors] of Object.entries(authored)) {
    let leafCount = 0, trunkCount = 0;
    for (let i = 0; i < colors.length; i += 3) {
      const r = colors[i], g = colors[i + 1], b = colors[i + 2];
      if (foliageTone(r, g, b) >= 0) leafCount++;
      else { assert.ok(Math.abs(r - trunk.r) < .0001 && Math.abs(g - trunk.g) < .0001 && Math.abs(b - trunk.b) < .0001, `${type}: unclassified authored color`); trunkCount++; }
    }
    assert.ok(leafCount > 500 && trunkCount > 400);
  }
  assert.equal(foliageTone(1, 0, 0), -1, 'Unrecognized colors are not globally tinted');
});

test('all seasons recolor only cloned foliage, leaving original GLB colors and the shared material untouched', () => {
  const { world, sharedMaterial } = fixture(), originalMaterial = sharedMaterial.color.clone();
  for (const [seasonIndex, season] of Object.keys(SEASON_PALETTES).entries()) {
    date(world, 1 + seasonIndex * 3); const beforeState = JSON.stringify(world.state); world.syncSeasonVisuals();
    assert.equal(world.seasonSignature, season); assert.equal(JSON.stringify(world.state), beforeState);
    for (const { type, mesh, originalColors } of world.seasonalTrees) {
      assert.deepEqual(originalColors, authored[type]); let changedLeaves = 0;
      for (let i = 0; i < originalColors.length; i += 3) {
        const leaf = foliageTone(...originalColors.slice(i, i + 3)) >= 0, actual = mesh.geometry.attributes.color.array.slice(i, i + 3);
        if (leaf) { if (actual.some((value, j) => value !== originalColors[i + j])) changedLeaves++; }
        else assert.deepEqual(actual, originalColors.slice(i, i + 3), `${season}: trunk changed`);
      }
      assert.ok(changedLeaves > 500);
    }
    assert.ok(sharedMaterial.color.equals(originalMaterial));
  }
});

test('a full year restores identical spring colors without accumulated tint or geometry changes', () => {
  const { world } = fixture(), positions = world.land.geometry.attributes.position.array.slice();
  world.syncSeasonVisuals(); const spring = world.seasonalTrees.map(tree => tree.mesh.geometry.attributes.color.array.slice());
  const terrain = world.land.geometry.attributes.color.array.slice();
  for (const day of [4, 7, 10, 13]) { date(world, day); world.syncSeasonVisuals(); }
  world.seasonalTrees.forEach((tree, i) => assert.deepEqual(tree.mesh.geometry.attributes.color.array, spring[i]));
  assert.deepEqual(world.land.geometry.attributes.color.array, terrain); assert.deepEqual(world.land.geometry.attributes.position.array, positions);
});

test('seasonal grass changes while the sandy coastal band and water remain unchanged', () => {
  const { world } = fixture(), water = world.water.material.color.clone(), inland = new Set(); let sand;
  for (const day of [1, 4, 7, 10]) {
    date(world, day); world.syncSeasonVisuals(); const colors = world.land.geometry.attributes.color.array;
    inland.add([...colors.slice(0, 3)].join(','));
    if (sand) assert.deepEqual(colors.slice(6, 9), sand); else sand = colors.slice(6, 9);
    assert.ok(world.water.material.color.equals(water));
  }
  assert.equal(inland.size, 4);
});

test('winter keeps green cypress tones and restrained seed heads, then restores the spring flowers', () => {
  const { world } = fixture(); date(world, 10); world.syncSeasonVisuals();
  assert.equal(world.flowers.count, 5);
  const palette = SEASON_PALETTES.winter;
  assert.ok(palette.evergreen.every(hex => { const c = new THREE.Color(hex); return c.g >= c.r && c.g > c.b; }));
  assert.ok(palette.foliage.every(hex => Math.max(...new THREE.Color(hex).toArray()) < .75), 'Frost avoids white-out colors');
  date(world, 13); world.syncSeasonVisuals(); assert.equal(world.flowers.count, 20);
});

test('unchanged seasons do not rebuild meshes or upload foliage and terrain colors again', () => {
  const { world } = fixture(); world.syncSeasonVisuals();
  const attributes = [world.land.geometry.attributes.color, ...world.seasonalTrees.map(tree => tree.mesh.geometry.attributes.color), world.flowers.instanceColor], versions = attributes.map(a => a.version), children = [...world.scene.children];
  for (let i = 0; i < 10; i++) world.syncSeasonVisuals();
  assert.deepEqual(attributes.map(a => a.version), versions); assert.deepEqual(world.scene.children, children);
});

test('festival bunting appears only during the saved benefit, reuses geometry, and stays outside picking/navigation lists', () => {
  const { world } = fixture(); date(world, 7);
  world.state.seasons = { lastFestivalYear: 1, festival: { year: 1, startedAt: 2160 } };
  const before = JSON.stringify(world.state); world.syncSeasonVisuals();
  const bunting = world.festivalBunting; assert.ok(bunting.visible); assert.equal(bunting.children.length, 2);
  const geometries = bunting.children.map(child => child.geometry), hearth = world.state.buildings.find(b => b.type === 'hearth');
  assert.equal(bunting.position.x, hearth.x * CELL); assert.equal(bunting.position.z, hearth.z * CELL);
  assert.equal(JSON.stringify(world.state), before); assert.equal(world.landmarks.includes(bunting), false); assert.equal(world.buildings.size, 0);
  date(world, 8); world.syncSeasonVisuals(); assert.equal(bunting.visible, false);
  date(world, 19); world.state.seasons = { lastFestivalYear: 2, festival: { year: 2, startedAt: 6480 } }; world.syncSeasonVisuals();
  assert.strictEqual(world.festivalBunting, bunting); assert.ok(bunting.visible); assert.deepEqual(bunting.children.map(child => child.geometry), geometries);
  assert.equal(world.scene.children.filter(child => child.name === 'harvest-festival-bunting').length, 1);
});
