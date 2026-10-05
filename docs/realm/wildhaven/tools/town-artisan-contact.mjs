/** Independent actual-GLB contact probe. Prepared renderer fixtures, not earned gameplay. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { register } from 'node:module';
const threeUrl = new URL('../../vendor/three/three.module.js', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(threeUrl)},shortCircuit:true};return n(s,c);}`));
const THREE = await import('three');
const { GLTFLoader } = await import('../../vendor/three/GLTFLoader.js');
const { VillageWorld, CELL } = await import('../js/world.js');
const { createGame } = await import('../js/sim.js');
const paths = ['js/discovery.js', 'assets/living-kit.glb', 'js/world.js', 'assets/village-kit.glb', 'assets/town-kit.glb', 'assets/town-kit.json', 'tools/town-artisan-contact.mjs'];
const hashes = () => Object.fromEntries(paths.map(path => [path, createHash('sha256').update(fs.readFileSync(new URL('../' + path, import.meta.url))).digest('hex')]));
const sourceHashesAtStart = hashes(), templates = new Map();
for (const name of ['village-kit', 'town-kit', 'living-kit']) {
  const raw = fs.readFileSync(new URL('../assets/' + name + '.glb', import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), '');
  for (const root of gltf.scene.children) templates.set(root.name, root);
}
const face = { minX: .06, maxX: .48, minZ: .17, maxZ: .39, y: .545 };
const v = (x, y, z) => new THREE.Vector3(x, y, z);
const surfaces = {
  face: [new THREE.Triangle(v(.06,.545,.17),v(.48,.545,.17),v(.48,.545,.39)), new THREE.Triangle(v(.06,.545,.17),v(.48,.545,.39),v(.06,.545,.39))],
  horn: [new THREE.Triangle(v(.04,.54,.17),v(.04,.54,.39),v(-.15,.505,.28))],
};
function segmentCrossesTriangle(a, b, triangle) {
  a = triangle.getBarycoord(a, new THREE.Vector3()); b = triangle.getBarycoord(b, new THREE.Vector3());
  let lo = 0, hi = 1;
  for (const axis of ['x', 'y', 'z']) {
    const min = -1e-7, max = 1 + 1e-7;
    const delta = b[axis] - a[axis];
    if (Math.abs(delta) < 1e-10) { if (a[axis] < min || a[axis] > max) return false; }
    else { let p = (min - a[axis]) / delta, q = (max - a[axis]) / delta; if (p > q) [p, q] = [q, p]; lo = Math.max(lo, p); hi = Math.min(hi, q); if (lo > hi) return false; }
  }
  return true;
}
function triangleCrossesSurface(points, triangle) {
  const plane = triangle.getPlane(new THREE.Plane());
  const crossings = [];
  for (let i = 0; i < 3; i++) {
    const a = points[i], b = points[(i + 1) % 3], ay = plane.distanceToPoint(a), by = plane.distanceToPoint(b);
    if (Math.abs(ay) < 1e-8) crossings.push(a);
    if (ay * by < 0) crossings.push(a.clone().lerp(b, ay / (ay - by)));
  }
  return crossings.some(p => triangle.containsPoint(p)) || (crossings.length >= 2 && segmentCrossesTriangle(crossings[0], crossings[1], triangle));
}
const results = [];
for (const level of [1, 2, 3]) for (let rotation = 0; rotation < 4; rotation++) {
  const w = Object.create(VillageWorld.prototype), state = createGame();
  Object.assign(w, { templates, state, scene: new THREE.Scene(), buildings: new Map(), decor: new Map(), actors: [], clock: 0, assetMetadata: JSON.parse(fs.readFileSync(new URL('../assets/town-kit.json', import.meta.url))).assets });
  const b = { id: 'contact-smith', type: 'smith', x: 3, z: 1, level, rotation, status: 'ready', workerIds: ['worker'], production: { efficiency: 1 } };
  state.buildings.push(b);
  for (const building of state.buildings) w.buildings.set(building.id, w.makeBuilding(building));
  w.updatePaths();
  const a = w.addActor(0, { id: 'worker', job: 'smith', workplace: b.id }), model = w.buildings.get(b.id).userData.model;
  model.updateWorldMatrix(true, true);
  for (const [x, expectedY] of [[.27, face.y], [-.09, .54 - .035 * (.13 / .19)]]) {
    const ray = new THREE.Raycaster(model.localToWorld(v(x,.9,.28)), v(0,-1,0));
    const hit = ray.intersectObject(model, true)[0];
    assert.ok(hit, 'Authored anvil surface is absent from the current GLB');
    assert.ok(Math.abs(model.worldToLocal(hit.point).y - expectedY) < .003, 'Probe surface constants no longer match actual GLB geometry');
  }
  a.root.position.set(-100, 0, -100);
  const stations = [];
  for (let i = 0; i < 8; i++) {
    const station = w.workStation(a, b); if (!station) break;
    stations.push(station);
    // Reserving previously selected stations exposes every remaining selectable stance.
    w.actors.push({ citizen: { id: 'reserved-' + i }, activity: 'work', station, root: { position: new THREE.Vector3(station.point.x * CELL, station.point.y, station.point.z * CELL) }, path: [] });
  }
  assert.ok(stations.length, 'Smith has no selectable station');
  for (const [stationIndex, station] of stations.entries()) for (const scale of [.9, .955, 1.01]) {
    const localTarget = model.worldToLocal(station.target.clone()), surfaceName = localTarget.x < .05 ? 'horn' : 'face', targetSurfaces = surfaces[surfaceName];
    a.root.scale.setScalar(scale); a.root.position.set(station.point.x * CELL, station.point.y, station.point.z * CELL); a.root.rotation.set(0, station.yaw, 0); a.station = station; a.parcel.visible = false; a.phase = 0;
    for (let i = 0; i < 120; i++) w.jobPose(a, true, 1 / 60);
    const triangles = [];
    a.tool.updateWorldMatrix(true, true);
    a.tool.traverse(mesh => {
      if (!mesh.isMesh) return;
      const p = mesh.geometry.attributes.position, color = mesh.geometry.attributes.color, indices = mesh.geometry.index;
      for (let i = 0; i < (indices?.count || p.count); i += 3) {
        const ids = [0, 1, 2].map(j => indices ? indices.getX(i + j) : i + j);
        // Metal head/poll: local +Y > .13 and linear red < .3 excludes the wooden shaft.
        if (ids.every(id => p.getY(id) > .13 && (!color || color.getX(id) < .3))) triangles.push({ mesh, vertices: ids.map(id => new THREE.Vector3().fromBufferAttribute(p, id)) });
      }
    });
    assert.ok(triangles.length, 'No actual hammer head triangles found');
    const poses = [];
    for (let frame = 0; frame < 180; frame++) {
      w.jobPose(a, true, 1 / 60); a.root.updateWorldMatrix(true, true); model.updateWorldMatrix(true, true);
      const transformed = triangles.map(t => t.vertices.map(p => model.worldToLocal(p.clone().applyMatrix4(t.mesh.matrixWorld))));
      const vertices = transformed.flat(), over = vertices.filter(p => targetSurfaces.some(t => t.containsPoint(t.getPlane(new THREE.Plane()).projectPoint(p, new THREE.Vector3())))), bottom = Math.min(...vertices.map(p => p.y));
      const distance = Math.min(...vertices.flatMap(p => targetSurfaces.map(t => t.closestPointToPoint(p, new THREE.Vector3()).distanceTo(p))));
      poses.push({ time: frame / 60, arm: a.limbs.right_arm.rotation.x, headCenter: model.worldToLocal(a.tool.localToWorld(new THREE.Vector3(0, .18, 0))).toArray(), impact: transformed.some(points => targetSurfaces.some(surface => triangleCrossesSurface(points, surface))), raised: bottom > face.y + .1, overFaceVertices: over.length, lowestOverFace: over.length ? Math.min(...over.map(p => p.y)) : null, nearestVertexDistance: distance });
    }
    const impacts = poses.filter(p => p.impact), recovery = poses.filter(p => p.raised), closest = poses.reduce((a, p) => a.nearestVertexDistance < p.nearestVertexDistance ? a : p);
    results.push({ level, rotation, stationIndex, access: station.access, surfaceName, stance: model.worldToLocal(new THREE.Vector3(station.point.x * CELL, station.point.y, station.point.z * CELL)).toArray(), target: localTarget.toArray(), actorScale: scale, headTriangles: triangles.length, impactFrames: impacts.length, raisedRecoveryFrames: recovery.length, maximumPenetrationBelowFace: Math.max(0, ...poses.filter(p => p.lowestOverFace !== null).map(p => face.y - p.lowestOverFace)), closest, firstImpact: impacts[0] || null, firstRecovery: recovery[0] || null, armRange: [Math.min(...poses.map(p => p.arm)), Math.max(...poses.map(p => p.arm))] });
  }
}
const sourceHashesAtEnd = hashes(), report = { at: new Date().toISOString(), scope: 'Prepared isolated smith fixtures with actual current GLBs and jobPose. No user save or runtime edits. Every reservable valid station, rotations0-3, levels1-3, and all3 actor scales are sampled for3seconds after2seconds warmup. Contact tests actual metal hammer-head triangles against the flat authored anvil interior or triangular horn top as selected by station target; raised recovery requires every head vertex at least0.1 model units above face. Numerical geometry does not substitute for captured pose review.', face, sourceHashesAtStart, sourceHashesAtEnd, sourcesStable: JSON.stringify(sourceHashesAtStart) === JSON.stringify(sourceHashesAtEnd), cases: results.length, impactCases: results.filter(r => r.impactFrames).length, recoveryCases: results.filter(r => r.raisedRecoveryFrames).length, results };
const prefix = process.env.WILDHAVEN_ARTISAN_PREFIX || 'town-artisan-contact';
assert.match(prefix, /^[a-z0-9-]+$/);
fs.writeFileSync(new URL('../review/' + prefix + '.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ cases: report.cases, impactCases: report.impactCases, recoveryCases: report.recoveryCases, sourcesStable: report.sourcesStable, example: results[0] }, null, 2));
assert.ok(report.sourcesStable);
if (process.env.WILDHAVEN_REQUIRE_SMITH_CONTACT === '1') {
  assert.equal(report.impactCases, report.cases, 'Every selectable smith station/rotation/level/size must contact its intended anvil surface');
  assert.equal(report.recoveryCases, report.cases, 'Every smith swing must recover clearly above the anvil');
}
