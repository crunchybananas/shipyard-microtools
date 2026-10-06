/** Prepared open worksite pose fixture. This is not earned gameplay or a traffic test. */
import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const sources = ['js/world.js', 'js/sim.js', 'js/catalog.js', 'assets/village-kit.glb', 'assets/town-kit.glb', 'assets/town-kit.json', 'tools/worksite-fixture.mjs', 'tools/town-artisan-review.mjs'];
const hashes = async () => Object.fromEntries(await Promise.all(sources.map(async path => [path, createHash('sha256').update(await readFile(new URL('../' + path, import.meta.url))).digest('hex')])));
const sourceHashesAtStart = await hashes();
const raw = await readFile(new URL('../review/campaign-forge-save.json', import.meta.url), 'utf8');
const browser = await chromium.launch({ headless: true }), page = await browser.newPage({ viewport: { width: 1100, height: 850 } }), errors = [];
page.on('pageerror', error => errors.push(error.stack));
await page.addInitScript(raw => localStorage.setItem('wildhaven.v2', raw), raw);
await page.goto('http://127.0.0.1:4751/wildhaven/?review', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__wildhaven);
await page.locator('#continue').click();
await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
await page.waitForTimeout(100);
await page.evaluate(async () => {
  const { createOpenWorksiteState } = await import('./tools/worksite-fixture.mjs');
  const THREE = await import('../vendor/three/three.module.js');
  const w = __wildhaven.world;
  w.sync(createOpenWorksiteState({ types: ['smith', 'lumber', 'sawmill'], workersPerSite: 1 }));
  document.body.classList.add('photo');
  const actors = {};
  // Remove incidental spawn crowding before reserving the actual authored stations.
  for (const a of w.actors) { a.root.position.set(-100, 0, -100); a.station = null; }
  for (const a of w.actors) {
    const b = w.state.buildings.find(b => b.id === a.workplace), station = w.workStation(a, b);
    if (!station) throw Error('No real station for ' + b.type);
    a.station = station; a.path = []; a.activity = 'work'; a.wait = 1000; a.workTime = 0; a.parcel.visible = false; a.tool.visible = true;
    a.root.position.set(station.point.x * 1.8, station.point.y, station.point.z * 1.8); a.root.rotation.y = station.yaw;
    actors[b.type] = a;
  }
  const modelOf = a => w.buildings.get(a.workplace).userData.model;
  function sample(a) {
    a.root.updateWorldMatrix(true, true);
    const model = modelOf(a), head = a.tool.localToWorld(new THREE.Vector3(0, .18, 0)), localHead = model.worldToLocal(head.clone());
    const vertices = [];
    a.tool.traverse(mesh => { if (!mesh.isMesh) return; const p = mesh.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const local = new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld); const toolLocal = a.tool.worldToLocal(local.clone()); if (toolLocal.y > .13) vertices.push(model.worldToLocal(local)); } });
    // Authored anvil face occupies x .05..49, z .16..40; top y .545 (bevel .01).
    const within = a.citizen.job === 'smith' ? vertices.filter(p => p.x >= .05 && p.x <= .49 && p.z >= .16 && p.z <= .40) : [];
    return { phase: a.phase, arm: a.limbs.right_arm.rotation.x, lean: a.root.rotation.x, headWorld: head.toArray(), headModel: localHead.toArray(), headBounds: new THREE.Box3().setFromPoints(vertices).min.toArray().concat(new THREE.Box3().setFromPoints(vertices).max.toArray()), headVerticesOverAnvil: within.length, lowestOverAnvil: within.length ? Math.min(...within.map(p => p.y)) : null, nearestVerticalGapToAnvil: within.length ? Math.min(...within.map(p => Math.abs(p.y - .545))) : null };
  }
  function camera(a, azimuth) {
    const head = a.tool.localToWorld(new THREE.Vector3(0, .18, 0)), target = a.station.target.clone().lerp(a.root.position.clone().add(new THREE.Vector3(0, .55, 0)), .5);
    w.azimuth = w.targetAzimuth = azimuth; w.zoom = w.targetZoom = 3.5; w.pan.set(target.x, 0, target.z); w.target.copy(target); w.updateCamera(1);
    // Diagnostic camera aims at the actual raised workstation, not the game's ground-height pan plane.
    w.camera.position.set(target.x + Math.sin(azimuth) * 43, target.y + 36, target.z + Math.cos(azimuth) * 43); w.camera.lookAt(target); w.camera.updateMatrixWorld();
    const ray = new THREE.Raycaster(), direction = head.clone().sub(w.camera.position), distance = direction.length();
    ray.set(w.camera.position, direction.normalize()); ray.far = distance - .015;
    const hits = ray.intersectObjects([...w.buildings.values()], true);
    return { azimuth, degrees: azimuth * 180 / Math.PI, hammerOccludedByBuilding: !!hits.length, firstHit: hits[0]?.object.name || null };
  }
  window.__artisan = { w, actors, sample, camera, THREE };
});
const measurements = await page.evaluate(() => {
  const { w, actors, sample, camera } = __artisan, result = {};
  for (const [type, a] of Object.entries(actors)) {
    for (let i = 0; i < 120; i++) w.jobPose(a, true, 1 / 60);
    const poses = [];
    for (let i = 0; i < 120; i++) { w.jobPose(a, true, 1 / 60); poses.push(sample(a)); }
    const b = w.state.buildings.find(b => b.id === a.workplace), cameras = [-90, -60, -45, -20, 0, 20, 45, 60, 90].map(deg => camera(a, deg * Math.PI / 180 + b.rotation * Math.PI / 2));
    result[type] = { citizen: a.citizen, building: b, station: { point: a.station.point, target: a.station.target.toArray(), access: a.station.access, yaw: a.station.yaw }, cameras, poses };
  }
  return result;
});
const captures = [];
for (const degrees of [-60, -30, 0, 30, 60]) {
  await page.evaluate(degrees => { const { w, actors, camera } = __artisan; camera(actors.smith, degrees * Math.PI / 180); w.renderer.render(w.scene, w.camera); }, degrees);
  await page.screenshot({ path: new URL(`../review/town-artisan-smith-camera-${degrees}.png`, import.meta.url).pathname });
}
for (const type of ['smith', 'lumber', 'sawmill']) {
  // The near side of the open facade exposes the right-hand swing while preserving the roof.
  const degrees = type === 'smith' ? Number(process.env.WILDHAVEN_SMITH_CAMERA || -30) : -45;
  for (let pose = 0; pose < 3; pose++) {
    const measured = await page.evaluate(({ type, degrees, pose }) => {
      const { w, actors, sample, camera } = __artisan, a = actors[type], b = w.state.buildings.find(b => b.id === a.workplace);
      // Continuous real jobPose sampling; no limb values or tool transforms are fabricated.
      if (type === 'smith') {
        let found = false;
        for (let i = 0; i < 300; i++) {
          w.jobPose(a, true, 1 / 60); const s = sample(a);
          if (pose === 0 ? s.lowestOverAnvil !== null && s.lowestOverAnvil <= .545 : pose === 1 ? s.headBounds[1] > .71 : s.headBounds[1] < .655 && s.headBounds[1] > .60) { found = true; break; }
        }
        if (!found) throw Error('Could not capture requested smith impact/recovery/descent pose');
      } else {
        const nextPhase = a.phase + Math.PI * 2 / 3;
        for (let i = 0; i < 300 && a.phase < nextPhase; i++) w.jobPose(a, true, 1 / 60);
      }
      const cam = camera(a, degrees * Math.PI / 180 + b.rotation * Math.PI / 2);
      w.renderer.render(w.scene, w.camera);
      return { type, pose, stage: type === 'smith' ? ['impact', 'raised recovery', 'descending'][pose] : 'continuous motion', camera: cam, measurement: sample(a) };
    }, { type, degrees, pose });
    const filename = `town-artisan-${type}-pose-${pose}.png`;
    await page.screenshot({ path: new URL('../review/' + filename, import.meta.url).pathname });
    captures.push({ filename, ...measured });
  }
}
const sourceHashesAtEnd = await hashes();
const report = { at: new Date().toISOString(), scope: 'Prepared open smith, lumber and carpenter worksite fixture using real current GLBs, real workStation placement and jobPose motion. Starting browser storage is an isolated earned Forge save, then renderer state is replaced by the labeled fixture. Actors placed at their valid stations to separate pose review from traffic. No user save, production code or asset is changed. Camera zoom is diagnostic close-up, below normal gameplay zoom. Anvil measurements use actual transformed hammer-head vertices against authored face bounds.', sourceHashesAtStart, sourceHashesAtEnd, sourcesStable: JSON.stringify(sourceHashesAtStart) === JSON.stringify(sourceHashesAtEnd), errors, measurements, captures };
await writeFile(new URL('../review/town-artisan-report.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
await browser.close();
console.log(JSON.stringify({ errors, sourcesStable: report.sourcesStable, cameras: Object.fromEntries(Object.entries(measurements).map(([type, m]) => [type, m.cameras])), contact: Object.fromEntries(Object.entries(measurements).map(([type, m]) => [type, { minGap: Math.min(...m.poses.filter(p => p.nearestVerticalGapToAnvil !== null).map(p => p.nearestVerticalGapToAnvil)), armRange: [Math.min(...m.poses.map(p => p.arm)), Math.max(...m.poses.map(p => p.arm))], overFaceFrames: m.poses.filter(p => p.headVerticesOverAnvil > 0).length }])) }, null, 2));
if (errors.length || !report.sourcesStable) process.exitCode = 1;
