// main.js — boot, light, loop. ABYME: an island within an island.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { W, save, load, hasSave, wipe, gradeAt, sunDir, moonDir, sunElevation, isNight, isDawn, isGolden, mistTargetAt, waterY, wavePhase, SCALE_MODEL, MAX_DEPTH, LEVELS } from './world.js';
import { SPOTS, heightAt, walkableY } from './terrain.js';
import { buildWorld, instantiateModel, collectRefs } from './props.js';
import { makeSkyMaterial, makeGlowPoints } from './shaders.js';
import { Player } from './player.js';
import { Interactions } from './interact.js';
import { Game } from './puzzles.js';
import { UI } from './ui.js';
import { KEEPER } from './content.js';
import A from './audio.js';
import { clamp, lerp, easeInOut, smoothstep, TAU, mulberry32, SEED } from './util.js';

const canvas = document.getElementById('scene');
const DEBUG = new URLSearchParams(location.search).has('debug');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  if (!renderer.capabilities.isWebGL2) throw new Error('webgl2');
} catch (e) {
  document.getElementById('webgl-fail').classList.remove('hidden');
  throw e;
}
// one fixed pixel ratio for the whole session — reactive setPixelRatio()
// reallocates the drawing buffer (a per-call frame hitch), so the old
// move/rest DPR thrash read as stutter. 1.5 cuts motion-state pixels vs
// the prior 1.75 and stays crisp at rest; the 60fps cap + 1024 shadows
// remain the power levers (issues #1, #2).
const BASE_DPR = Math.min(devicePixelRatio || 1, 1.5);
renderer.setPixelRatio(BASE_DPR);
let gpuTimer = null; // Power Ledger (#1): real GPU-frame-ms; created in DEBUG only (declared early so the debug block can set it without a TDZ)
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xcfe3e8, 0.003);

// a tiny procedural environment so metals have something to be —
// gradient sphere + a hot sun patch, baked through PMREM once at boot
{
  const envScene = new THREE.Scene();
  const sphereGeo = new THREE.SphereGeometry(50, 24, 12);
  const cols = new Float32Array(sphereGeo.attributes.position.count * 3);
  const cTop = new THREE.Color(0x7fb2d9), cHor = new THREE.Color(0xf2e3c2), cGnd = new THREE.Color(0x5a5038);
  const tmp = new THREE.Color();
  for (let i = 0; i < sphereGeo.attributes.position.count; i++) {
    const y = sphereGeo.attributes.position.getY(i) / 50;
    if (y >= 0) tmp.lerpColors(cHor, cTop, Math.pow(y, 0.6));
    else tmp.lerpColors(cHor, cGnd, Math.pow(-y, 0.7));
    cols[i * 3] = tmp.r; cols[i * 3 + 1] = tmp.g; cols[i * 3 + 2] = tmp.b;
  }
  sphereGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  envScene.add(new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const hot = new THREE.Mesh(new THREE.SphereGeometry(4, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff2d0 }));
  hot.position.set(18, 28, 10);
  envScene.add(hot);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(envScene, 0.04).texture;
  scene.environmentIntensity = 0.35;
  pmrem.dispose();
}

const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.08, 12000);

// ---- post: a gentle bloom so the lit things actually GLOW ----
// EffectComposer is a BUILT-IN three addon (examples/jsm — same three@0.180.0 package,
// no new dependency). RenderPass → UnrealBloomPass → OutputPass; OutputPass applies the
// renderer's tone mapping + sRGB at the end of the chain (correct order for post). The
// bloom THRESHOLD is high so only the truly bright things bleed — the lamp, the beam, the
// bioluminescence, the jetty beacon, emissive glints — never the broad daylight beach.
// The blur runs at HALF resolution — bloom is soft by nature, so half-res looks identical
// and costs ~a quarter of the fill rate (full-res measured +4.1ms; half-res ~+1ms — the
// power policy: a graphics win must HOLD or cut load). setPixelRatio + setSize are called
// BEFORE the passes are added, so the bloom keeps its half-res; resize re-asserts it.
const BLOOM_RES = () => new THREE.Vector2(Math.max(1, innerWidth >> 1), Math.max(1, innerHeight >> 1));
const composer = new EffectComposer(renderer);
composer.setPixelRatio(BASE_DPR);
composer.setSize(innerWidth, innerHeight);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(BLOOM_RES(), 0.68, 0.68, 0.85); // strength, radius, threshold (only bright things bloom) — WOW pass: softer, dreamier glow on the lamp/sun-sparkle/highlights
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);   // re-sizes RenderPass + OutputPass (full res)...
  const r = BLOOM_RES();
  bloomPass.setSize(r.x, r.y);                  // ...then re-assert the bloom's half-res
});

// ---------------- world ----------------
const { core, waterMat, modelAnchor, biolume, fireflies, motes, galleryGlow, l3motes, vaultDrips } = buildWorld();
const modelRoot = instantiateModel(core, modelAnchor);
const nestedGlint = modelRoot.getObjectByName('nestedGlint');
const _glintV = new THREE.Vector3();
const youMarker = modelRoot.getObjectByName('youMarker');
const _youV = new THREE.Vector3();
// the coat on its annex hook (level 2): annex azimuth 15°, baseR+2.2 out
// (built from SPOTS — LH isn't declared until the lighting section)
const COAT_POS = (() => {
  const aa = 15 * Math.PI / 180;
  return new THREE.Vector3(
    SPOTS.lighthouse.x + Math.sin(aa) * 7.4 - 1.9,
    13.5 + 1.2,
    SPOTS.lighthouse.y + Math.cos(aa) * 7.4 + 0.6);
})();
const refs = collectRefs(core);
const modelRefs = collectRefs(modelRoot);
// terrain material (shared by island + model clone) — its aerial-haze uniform
// tracks the active grade's fog colour each frame (set in applyAtmosphere)
const terrainMat = core.getObjectByName('terrain')?.material;
// the clone captured pre-clone children only; nothing model-side needs Points

const diveGroup = new THREE.Group();
diveGroup.add(core, biolume, fireflies, motes, galleryGlow, l3motes);
scene.add(diveGroup);

// sky + far sea (outside the dive group: they are the "outside" of the world)
const skyMat = makeSkyMaterial();
const sky = new THREE.Mesh(new THREE.SphereGeometry(7000, 32, 16), skyMat);
// the credits constellation: five stars in the stones' own arc, waiting
// dark until the finale lights them note by note
for (let i = 0; i < 5; i++) {
  // due-north arc: the finale camera rises in the NE and gazes north-west
  const az = (350 + i * 4) * Math.PI / 180;
  const el = (36 + [0, 2, 3.5, 2, 0][i]) * Math.PI / 180;
  skyMat.uniforms.uConstelDir.value[i].set(
    Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
}
sky.frustumCulled = false;
scene.add(sky);

const farSea = new THREE.Mesh(
  new THREE.RingGeometry(280, 9000, 48),
  new THREE.MeshBasicMaterial({ color: 0x15454f }));
farSea.rotation.x = -Math.PI / 2;
scene.add(farSea);

// ---------------- lights ----------------
const sun = new THREE.DirectionalLight(0xfff4e0, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024); // power directive: half the map, look verified per-grade
sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
sun.shadow.camera.near = 20; sun.shadow.camera.far = 420;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.5;
scene.add(sun, sun.target);

const hemi = new THREE.HemisphereLight(0x9ec7e0, 0x6a6048, 0.55);
scene.add(hemi);

const LH = new THREE.Vector3(SPOTS.lighthouse.x, 13.5, SPOTS.lighthouse.y);
const studyLight = new THREE.PointLight(0xffb454, 14, 16, 1.8);
studyLight.position.set(LH.x, LH.y + 3.6, LH.z);
scene.add(studyLight);

const lampSpill = new THREE.PointLight(0xffe2a8, 0, 700, 1.6);
lampSpill.position.set(LH.x, LH.y + 22.6, LH.z);
scene.add(lampSpill);

const cellarLight = new THREE.PointLight(0xffb454, 0, 18, 1.6);
cellarLight.position.set(SPOTS.hatch.x, 21.6, SPOTS.hatch.y - 12);
scene.add(cellarLight);

// cool fill on the carve wall — separates the room from the shaft's warmth
const cellarFill = new THREE.PointLight(0x7fd9c0, 0, 13, 1.7);
cellarFill.position.set(SPOTS.hatch.x, 21.0, SPOTS.hatch.y - 15.5);
scene.add(cellarFill);

// the keeper's lamp — the one warm light in the annex (the Keeper's Quarters,
// #15). Lit only one level down, it burns against the cold deep grade: a hearth
// the descent threatens, not a black frame. Position matches the hung globe in
// props.js (annex at azimuth 15°, baseR+2.2 = 7.4 out; globe local 0.05,2.28,0.55).
const _annexAA = 15 * Math.PI / 180;
const keeperLamp = new THREE.PointLight(0xffb45a, 0, 12, 1.7);
keeperLamp.position.set(
  LH.x + Math.sin(_annexAA) * 7.4 + 0.19,
  LH.y + 2.28,
  LH.z + Math.cos(_annexAA) * 7.4 + 0.52);
scene.add(keeperLamp);

// the jetty lantern — a small shore beacon at the end of the pier (#24); warm
// always, brightening into the dark like a light left for a return. Position
// matches the hung globe in props.js (jetty at x-18; globe local 0.33,3.66,-115.4).
const jettyLamp = new THREE.PointLight(0xffc06a, 0, 16, 1.6);
jettyLamp.position.set(-17.67, 3.66, -115.4);
scene.add(jettyLamp);

// the Vault Beneath's cold base glow (#17) — a waterShallow-toned light low in
// the cavern, lighting the inverted lighthouse's lamp + black water against the
// dark. Lit only with the cellar open. Position matches the vault lamp in props.
const vaultGlow = new THREE.PointLight(0x7fc0d0, 0, 64, 1.25);
vaultGlow.position.set(SPOTS.hatch.x + 30, 19.2, SPOTS.hatch.y - 13.6);
scene.add(vaultGlow);
// a dim higher fill so the inverted tower rims out of the dark before its top is lost
const vaultFill = new THREE.PointLight(0x4f8a9c, 0, 44, 1.6);
vaultFill.position.set(SPOTS.hatch.x + 22, 30, SPOTS.hatch.y - 13.6);
scene.add(vaultFill);
// The Room That Disagrees (#18) — a warm study light west of the cellar (the
// uncanny twin of the study above), so it reads warm against the cold vault.
const disagreeLight = new THREE.PointLight(0xffc98a, 0, 16, 1.7);
disagreeLight.position.set(SPOTS.hatch.x - 9, 20.6, SPOTS.hatch.y - 13.6);
scene.add(disagreeLight);

// ---------------- gulls ----------------
const gulls = [];
{
  const wingMat = new THREE.MeshStandardMaterial({ color: 0xe8e4da, flatShading: true, side: THREE.DoubleSide });
  // a WHEELING FLOCK over the island (loop: life). Varied radius/height/speed (some negative =
  // counter-wheeling) so it reads as a living gyre, not identical circles — and several fly LOW + CLOSE
  // so you actually see gulls pass overhead, not two specks at 50 m. gulls[0] still leaves the gyre to
  // perch on the gallery rail at dawn (the keeper's-view beat). +0 model-clone cost (added to scene, not core).
  const FLOCK = [
    { radius: 24, h: 32, speed:  0.14, phase: 0.0 },   // [0] the dawn percher — keep first
    { radius: 33, h: 38, speed:  0.17, phase: 2.4 },
    { radius: 17, h: 15, speed:  0.25, phase: 1.1 },   // low + tight, passes close overhead
    { radius: 47, h: 25, speed: -0.11, phase: 3.7 },   // wide, counter-wheeling
    { radius: 21, h: 18, speed: -0.20, phase: 5.0 },   // low, counter
    { radius: 62, h: 29, speed:  0.09, phase: 0.8 },   // sweeping the whole island
    { radius: 13, h: 12, speed:  0.29, phase: 4.2 },   // lowest/closest — clear life near the ground
    { radius: 39, h: 44, speed: -0.13, phase: 2.0 },   // high counter
  ];
  for (const f of FLOCK) {
    const g = new THREE.Group();
    const l = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.4), wingMat);
    l.position.x = -0.7;
    const r = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.4), wingMat);
    r.position.x = 0.7;
    // a body between the wings — songbird recipe, gull proportions —
    // so the dawn percher reads as a bird up close, not two cards
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.6, 6), wingMat);
    body.rotation.x = Math.PI / 2.15;   // nose forward, tail riding up
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), wingMat);
    head.position.set(0, 0.07, 0.33);
    g.add(l, r, body, head);
    g.userData = { phase: f.phase, radius: f.radius, h: f.h, speed: f.speed, l, r };
    scene.add(g);
    gulls.push(g);
  }
}

// ---------------- perched shore gulls ----------------
// gulls resting on the south shingle — the first life you meet at the wake-up beach. They startle and
// flush off when you come close, and settle back once you've moved on. Static when perched (verifiable);
// added to `scene` (not core) → no 1:240 model clone. Surface + day only.
const perched = [];
{
  const white = new THREE.MeshStandardMaterial({ color: 0xe7e3d8, flatShading: true, roughness: 0.82 });
  const grey  = new THREE.MeshStandardMaterial({ color: 0x95938b, flatShading: true, roughness: 0.85 });
  const beakM = new THREE.MeshStandardMaterial({ color: 0xd6a233, flatShading: true, roughness: 0.7 });
  const mk = () => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 7, 6), white); body.scale.set(1, 0.86, 1.62); body.position.y = 0.17; g.add(body);
    const mantle = new THREE.Mesh(new THREE.SphereGeometry(0.155, 7, 5), grey); mantle.scale.set(0.92, 0.46, 1.5); mantle.position.set(0, 0.25, -0.02); g.add(mantle);   // folded wings / back
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.26, 4), grey); tail.rotation.x = -1.95; tail.position.set(0, 0.18, -0.32); g.add(tail);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.097, 7, 6), white); head.position.set(0, 0.36, 0.25); g.add(head);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.12, 4), beakM); beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.355, 0.38); g.add(beak);
    return g;
  };
  const rngP = mulberry32(SEED ^ 0x9c0f);   // own rng — world scatter byte-unchanged
  let placed = 0;
  for (let i = 0; i < 80 && placed < 5; i++) {
    const x = -22 + rngP() * 52;            // south shingle span
    const z = -98 - rngP() * 22;
    const h = heightAt(x, z);
    if (h < 0.25 || h > 2.2) continue;       // dry shingle above the waterline only
    const g = mk();
    g.position.set(x, h, z);
    g.rotation.y = (rngP() - 0.5) * 1.7;     // facing roughly seaward (yaw 0 = −z), spread
    g.userData = { px: x, py: h, pz: z, yaw: g.rotation.y, ph: rngP() * TAU, flush: 0, cool: 0 };
    scene.add(g);
    perched.push(g);
    placed++;
  }
}

// ---------------- crows ----------------
// a few crows inland on the dune / tree line — a darker, warier bird; the lone caw of an island gone
// quiet (life persisting in the keeper's absence). Reuses the perched-bird model with dark plumage +
// a sleeker body / longer tail + beak, and the same `perched` idle+flush logic. scene-only (no clone).
{
  const blk  = new THREE.MeshStandardMaterial({ color: 0x2e3035, flatShading: true, roughness: 0.68, metalness: 0.12 });
  const blkD = new THREE.MeshStandardMaterial({ color: 0x1c1e22, flatShading: true, roughness: 0.72, metalness: 0.12 });
  const mkCrow = () => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.15, 7, 6), blk); body.scale.set(0.92, 0.8, 1.9); body.position.y = 0.16; g.add(body);
    const mantle = new THREE.Mesh(new THREE.SphereGeometry(0.145, 7, 5), blkD); mantle.scale.set(0.88, 0.42, 1.6); mantle.position.set(0, 0.24, -0.04); g.add(mantle);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.4, 4), blkD); tail.rotation.x = -1.72; tail.position.set(0, 0.16, -0.44); g.add(tail);     // longer tail
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.092, 7, 6), blk); head.position.set(0, 0.34, 0.27); g.add(head);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.17, 4), blkD); beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.335, 0.44); g.add(beak);  // longer beak
    return g;
  };
  const rngC = mulberry32(SEED ^ 0x4c0a);
  let pc = 0;
  for (let i = 0; i < 100 && pc < 4; i++) {
    const a = rngC() * TAU, d = 24 + rngC() * 110;
    const x = SPOTS.mainCenter.x + Math.sin(a) * d, z = SPOTS.mainCenter.y + Math.cos(a) * d;
    const h = heightAt(x, z);
    if (h < 2.0 || h > 12) continue;                                          // inland dune / tree line, dry
    if (Math.hypot(x - SPOTS.lighthouse.x, z - SPOTS.lighthouse.y) < 14) continue;
    const g = mkCrow();
    g.position.set(x, h, z);
    g.rotation.y = rngC() * TAU;
    g.userData = { px: x, py: h, pz: z, yaw: g.rotation.y, ph: rngC() * TAU, flush: 0, cool: 0 };
    scene.add(g);
    perched.push(g);
    pc++;
  }
}

// ---------------- actors ----------------
const player = new Player(camera, canvas);
const interact = new Interactions(camera, player, canvas);
const game = new Game({
  refs, modelRefs, modelAnchor, interact, player,
  onDive: startDive,
  onAscend: () => startAscent(false),  // #12 stage 2: the in-play way UP
  onFinale: startFinale,               // the bell — descent terminal (at the bottom)
  onLeave: startOarFinale,             // the oar — integration terminal (at the surface, #22)
});

UI.init();

// ---------------- modes ----------------
let MODE = 'title';
let intro = null;
let dive = null;
let finale = null;

const titleEl = document.getElementById('title-screen');
const btnBegin = document.getElementById('btn-begin');
const btnContinue = document.getElementById('btn-continue');

if (hasSave()) btnContinue.classList.remove('hidden');

btnBegin.addEventListener('click', () => {
  // a fresh start discards any old save. W is still at its defaults on the title screen, so
  // begin IN PLACE — the old wipe()+reload bounced the page and flashed the title back up for
  // a beat ("a second window that just says Begin, then fades"); no reload is needed here.
  if (hasSave()) wipe();
  beginIntro();
});
btnContinue.addEventListener('click', () => {
  A.init();
  if (load()) {
    // stems restore from the flags that earned them, not a counter
    const STEM_FLAGS = { 1: 'valveTurned', 2: 'rulerPlaced', 3: 'birdSolved', 4: 'hatchOpen', 5: 'glyphsSeen' };
    for (const [n, f] of Object.entries(STEM_FLAGS)) if (W.flags[f]) A.addStem(+n);
    titleEl.classList.add('fading');
    const pos = W.playerPos || new THREE.Vector3(4, 0, -104);
    // a save written below the drained-tide line predates the basin rim
    // block — those spots have no walkable exit; the tide returns you
    if (heightAt(pos.x, pos.z) < -2.2) pos.set(4, 0, -104);
    player.spawn(pos, 2.72);
    player.locked = false;
    interact.enabled = true;
    MODE = 'play';
    UI.fadeIn();
    UI.showHint();
  }
});

if (sessionStorage.getItem('abyme-autostart')) {
  sessionStorage.removeItem('abyme-autostart');
  titleEl.style.display = 'none';   // a replay reload ('begin again') must not flash the title
  beginIntro(true);
}

function beginIntro(instant = false) {
  A.init();
  // let the title hold a breath over the first seconds of sea (skipped on a replay reload,
  // where the title is already hidden — no second "Begin" flash)
  if (!instant) setTimeout(() => titleEl.classList.add('fading'), 1400);
  UI.cinematic(true);
  UI.fadeIn();
  setIntroLanding();        // aim the approach to land exactly on the standing frame
  MODE = 'intro';
  intro = { t: 0, dur: 19 };
  const skip = () => { if (intro) intro.t = intro.dur; canvas.removeEventListener('pointerdown', skip); };
  setTimeout(() => canvas.addEventListener('pointerdown', skip), 1500);
}

function endIntro() {
  intro = null;
  MODE = 'play';
  scene.remove(spray);
  UI.cinematic(false);
  player.spawn(SPAWN_POS, SPAWN_YAW, SPAWN_PITCH); // == the flight's final frame: no cut
  player.locked = false;
  interact.enabled = true;
  UI.whisper('The tide brought you back.');
  UI.showHint();
  W.flags.introDone = true;
  save(player.pos);
}

// ---------------- the dive ----------------
function startDive() {
  MODE = 'dive';
  player.locked = true;
  interact.enabled = false;
  UI.cinematic(true);
  A.duckAmbient(false); // the held breath releases — the sea swells back as you fall
  A.diveSweep(21);
  renderer.setPixelRatio(Math.min(BASE_DPR, 1.0)); // one-time drop for the 240x zoom
  farSea.visible = false;

  // pivot: the model's beach, in world space
  const local = new THREE.Vector3(SPOTS.beach.x, heightAt(SPOTS.beach.x, SPOTS.beach.y), SPOTS.beach.y);
  modelRoot.updateWorldMatrix(true, false);
  const pivot = local.applyMatrix4(modelRoot.matrixWorld);

  dive = {
    t: 0, dur: 21, pivot,
    startQuat: camera.quaternion.clone(),
    snapDone: false,
  };
  UI.whisper('Down is the only direction left.');
}

function tickDive(dt) {
  dive.t += dt;
  const f = clamp(dive.t / dive.dur, 0, 1);
  if (!dive.snapDone) {
    const s = Math.exp(easeInOut(f) * Math.log(1 / SCALE_MODEL));
    diveGroup.scale.setScalar(s);
    diveGroup.position.set(
      dive.pivot.x * (1 - s),
      dive.pivot.y * (1 - s),
      dive.pivot.z * (1 - s));

    // camera: gaze down into the model, then lift to the growing horizon
    const lookDown = Math.sin(Math.min(f * 2.4, 1) * Math.PI) * 0.9;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-lookDown, player.yaw + f * 0.4, 0, 'YXZ'));
    camera.quaternion.slerpQuaternions(dive.startQuat, q, Math.min(1, f * 5));
  }

  if (f > 0.86 && !dive.fading) {
    dive.fading = true;
    UI.fadeOut(true, true);
  }
  if (f > 0.95 && !dive.snapDone) {
    dive.snapDone = true;
    diveGroup.scale.setScalar(1);
    diveGroup.position.set(0, 0, 0);
    W.level = Math.min(W.level + 1, MAX_DEPTH); // one recursion deeper each dive
    // SEA-STRATA: drop into THIS level's place — its spawn + raised tide (the same island, drowned further)
    const L = LEVELS[W.level];
    if (W.level > 1) W.tide = W.tideTarget = L.tide;
    if (W.level >= 2) W.regions.l2seen = true;
    if (W.level >= 3) W.regions.l3seen = true;
    if (W.level >= 4) W.regions.l4seen = true;
    save(player.pos);
    player.spawn(new THREE.Vector3(L.spawn.pos[0], 0, L.spawn.pos[2]), L.spawn.yaw, L.spawn.pitch);
  }
  if (f >= 1) {
    dive = null;
    MODE = 'play';
    renderer.setPixelRatio(BASE_DPR);
    farSea.visible = true;
    player.locked = false;
    interact.enabled = true;
    UI.cinematic(false);
    UI.fadeIn(false);
    setTimeout(() => document.getElementById('curtain').classList.remove('white'), 800);
    // the same island, more drowned each time — the sameness is the wound
    UI.whisper({
      2: 'The same sand. The same sky.',
      3: 'The same sand — the colour going out of it.',
      4: 'The same room, gone cold and far. Below it, a light still burns.',
    }[W.level] || 'Down, and down.');
    if (W.level === 2) setTimeout(() => UI.whisper('Somewhere above, a door stands open now.'), 6000);
    // from level 3 down, the keeper answers your arrival — the first 'I' in the
    // game: a drowned voice under the floor, his words in quotes (#14)
    if (W.level >= 3) setTimeout(() => {
      A.say(W.level >= 4 ? 'keeper_arrive_deep' : 'keeper_arrive_shallow', W.level >= 4 ? 'resigned' : 'curious');
      UI.whisper(W.level >= 4 ? KEEPER.arrive.deep : KEEPER.arrive.shallow);
      // the journal fills with a hand that isn't yours — the keeper's, blurring
      // into your own field notes the deeper you go (#21)
      UI.addJournal(W.level >= 4
        ? 'You are deeper than I ever went — or I am writing this through you now. I can no longer tell which of us holds the pen.'
        : 'I drew the bay drained so the sea could not take her twice. The model does not lie; it only hopes. (This is not my handwriting. And yet I know it.)',
        '', 'keeper');
    }, 3600);
  }
}

// ---------------- the ascent (the dive run backward — #12, the fork-neutral keystone) ----
// Run the swell BACKWARD: the whole world shrinks 240x around you until it is the model
// on a chart table one level up, and you rise OUT into the level above. The mirror of the
// dive; W.level DECREMENTS (clamped at 1, the surface). Stage 1 = the mechanic + the state
// settle, started from a debug hook (ABYME.ascend). The owner's ending forks (ring-vs-climb,
// who-you-are, the final camera) layer ON TOP later — none of them are decided here.
let ascent = null;
let keeperFarewell = false;   // transient: the arrival names the keeper's silence (#12 stage 3)
let keeperCarried = false;    // transient: the arrival names that he rose WITH you (the twist, #item4)
function startAscent(instant = false) {
  if (W.level <= 1) { if (!instant) UI.whisper('There is no level above the surface. Not yet.'); return false; }
  if (instant) { landAscent(); return true; } // debug/verify: skip the cinematic AND the mode-gate
  if (MODE !== 'play') return false;
  MODE = 'ascend';
  player.locked = true;
  interact.enabled = false;
  UI.cinematic(true);
  renderer.setPixelRatio(Math.min(BASE_DPR, 1.0)); // one-time drop for the 240x zoom
  farSea.visible = false;
  keeperFarewell = false;          // reset; landAscent sets one of these on the silencing ascent
  keeperCarried = false;
  A.duckAmbient(true);             // the world draws quiet as you rise — the held silence (#12 s3)
  // pivot: the chart table in THIS world — the world collapses toward the very place its
  // own model stands, becoming that model one level up
  const pivot = new THREE.Vector3(SPOTS.lighthouse.x, 14.5, SPOTS.lighthouse.y);
  // the climb is heavier than the dive — a third longer (28s vs the dive's 21): the dive is
  // a surrender (you fall); the ascent is an EFFORT (you heave the world up by inches).
  // Panel #4 gap #3 — give the climb weight, so it isn't the dive with the sign flipped.
  ascent = { t: 0, dur: 28, pivot, startQuat: camera.quaternion.clone(), snapDone: false, fading: false };
  UI.whisper('You run the mechanism backward. It fights you — the world comes up by inches.');
  return true;
}
function landAscent() {
  // the snap: the shrunk world becomes the model above; you stand at its chart table
  diveGroup.scale.setScalar(1);
  diveGroup.position.set(0, 0, 0);
  const wasLevel = W.level;
  W.level = Math.max(W.level - 1, 1); // one recursion shallower — clamp at the surface
  if (W.level <= 1) {
    W.flags.climbing = false; // back at the surface — a new descent is possible
    // THE RETURN LEAVES A MARK (#12, Panel #4 #2): you climbed all the way out. The world is
    // as you left it; only you are different — and the chart-table tally stays full (the
    // fingerprint, driven in puzzles _apply by W.flags.returned). Fork-neutral; not an ending.
    if (!W.flags.returned) {
      W.flags.returned = true;
      if (W.flags.carried) {
        UI.whisper('Back at the surface — and you did not come up alone. The door, the coat, the jetty, all as you left them. You are not.');
        UI.addJournal('I have been all the way down and all the way back, and I did not come up empty-handed. The hand that writes this is mine again — both of them mine. The light is lit, below and above, and nothing is left burning alone. There is the dory on the beach, and an oar I have never used. The only thing left undone is to go.', '', 'self');
      } else {
        UI.whisper('Back at the surface. The door, the coat, the jetty — all as you left them. Only you are different.');
        UI.addJournal('I have been all the way down and all the way back. The same beach, the same light — but the hand that writes this is mine again, and I left his still burning below. I did not put it out. I did not stay. There is the dory on the beach, and an oar — the one thing here I have never used. The light is lit; the only thing left undone is to go.', '', 'self');
      }
      // POINT THE WAY OUT: the climb-out terminal (#22) is the dory, ~80 m south on the wake-up
      // beach. Name it, or a player re-dives / rings the bell and never finds the choice the
      // whole fork exists to offer. (The oar also glints on hover once armed; this draws them to it.)
      setTimeout(() => { if (W.level <= 1 && MODE === 'play') UI.whisper('Down on the beach, the beached dory waits — and its oar, the last thing here you have not touched.'); }, 6800);
    }
  }
  // the keeper falls silent behind you (#12 stage 3): the first time you turn back from the
  // depths, his voice gives one last fading line — then the floor below goes quiet for good.
  // You leave him where he chose to stay, and you leave the light BURNING (integration, not
  // abandonment). The arrival (tickAscent f>=1) names the silence.
  if (!W.flags.keeperSilenced && wasLevel >= 3) {
    W.flags.keeperSilenced = true;
    if (W.flags.carried) {
      // THE TWIST (#item4): you turned him around and rose CARRYING him — his voice is no longer
      // BELOW you but at your shoulder. No farewell; he is not left behind. (Wordless: the held
      // breath of two climbing as one — the arrival names it.)
      keeperCarried = true;
      UI.addJournal('I did not leave him. I turned him around at the bottom and we started up together — the lost thing I came all this way to find was the one still carrying the lamp. Two lights now, lit at both ends of the same stair, and both of them climbing.', '', 'self');
    } else {
      // the climb-out without the embrace: he stays below, tending the light; you leave it BURNING
      A.say('keeper_farewell', 'resigned');
      UI.whisper(KEEPER.farewell);
      keeperFarewell = true;
      UI.addJournal('I went all the way down — to the smallest room, the coldest light — and found him still there, still tending it. I could not bring myself to put it out. So I have started back up the stairs, and I am carrying what I found at the bottom. The light is still burning behind me. Let it.', '', 'self');
    }
  }
  // SEA-STRATA: arriving a level shallower, the sea recedes to that level's tide (surface = 1)
  W.tide = W.tideTarget = (W.level > 1 ? LEVELS[W.level].tide : 1);
  save(player.pos);
  // rise out at the study / chart table of the level above (canon: you climb to the chart table)
  player.spawn(new THREE.Vector3(SPOTS.lighthouse.x + 2.2, 0, SPOTS.lighthouse.y - 1.4), 2.19, 0.02);
}
function tickAscent(dt) {
  ascent.t += dt;
  const f = clamp(ascent.t / ascent.dur, 0, 1);
  if (!ascent.snapDone) {
    // inverse of the dive: scale DOWN from 1 to SCALE_MODEL (the world becomes a model)
    const s = Math.exp(easeInOut(f) * Math.log(SCALE_MODEL));
    diveGroup.scale.setScalar(s);
    diveGroup.position.set(
      ascent.pivot.x * (1 - s),
      ascent.pivot.y * (1 - s),
      ascent.pivot.z * (1 - s));
    // camera: lift away from the world drawing in below you
    const lookUp = Math.sin(Math.min(f * 2.4, 1) * Math.PI) * 0.6;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(lookUp, player.yaw - f * 0.4, 0, 'YXZ'));
    camera.quaternion.slerpQuaternions(ascent.startQuat, q, Math.min(1, f * 5));
  }
  if (f > 0.86 && !ascent.fading) {
    ascent.fading = true;
    UI.fadeOut(true, true);
  }
  if (f > 0.95 && !ascent.snapDone) {
    ascent.snapDone = true;
    landAscent();
  }
  if (f >= 1) {
    ascent = null;
    MODE = 'play';
    renderer.setPixelRatio(BASE_DPR);
    farSea.visible = true;
    player.locked = false;
    interact.enabled = true;
    UI.cinematic(false);
    UI.fadeIn(false);
    setTimeout(() => document.getElementById('curtain').classList.remove('white'), 800);
    A.duckAmbient(false);  // the surface sounds return — the held silence releases (#12 s3)
    // up, and the colour comes back — the inverse of the dive's curdle
    UI.whisper({
      1: 'The surface. The sea you woke beside — and the door you came in by.',
      2: 'One level up. The colour creeps back into things.',
      3: 'Up, and the room warms by a degree.',
    }[W.level] || 'Up. And up.');
    // name it, the once it happens — the integration beat
    if (keeperCarried) {
      keeperCarried = false;
      setTimeout(() => UI.whisper('His voice is beside you now, not below. You did not put the light out — you carried it up.'), 5200);
    } else if (keeperFarewell) {
      keeperFarewell = false;
      setTimeout(() => UI.whisper('Below you, the voice has stopped. The light still burns — you did not put it out.'), 5200);
    }
  }
}

// ---------------- the finale ----------------
function startFinale() {
  MODE = 'finale';
  player.locked = true;
  interact.enabled = false;
  A.musicStop();   // the bell finale owns the soundscape (the era bed fades out)
  UI.cinematic(true);
  // the resolution must land warm, never inheriting the descent's curdle (#22)
  W._finaleWarm = true;
  // fork the TONE by depth: level 2 keeps the loved golden parade (constellation
  // + gathered stems); ringing deeper WITHHOLDS — the bottom sounds like the
  // bottom, a held bittersweet golden hour the stars never reach
  const deep = W.level >= 3;
  A.bellToll(deep);
  if (deep) setTimeout(() => A.keeperVoice('resigned'), 4200); // the keeper, still below
  const line1 = document.querySelector('#finale .fin-line1');
  if (line1) line1.textContent = deep ? 'you keep the light now' : 'the tide brought you back';
  finale = { kind: 'bell', t: 0, deep, camStart: camera.position.clone(), quatStart: camera.quaternion.clone() };
}

// ---------------- the oar — the integration terminal (#22, owner fork: choice + The Oar) ----
// The climb-out's missing last breath. Reached only after climbing all the way out
// (W.flags.returned, at the surface): you row off the wake-up beach, the camera swings
// to the only look-BACK shot in the game, and the whole world shrinks 240x toward the
// island's heart until it is a tiny lit model floating on the dark sea — the recursion
// seen once more, chosen and warm. Held golden hour, no stars (those belong to the bell's
// 'stay'). The bell is struck at the bottom; the oar is rowed at the top. Reuses the
// finale's cinematic spine (re-aimed low-and-back) + the ascent's inverse-swell scale math.
let oarSea = null;   // a dark water disc filling the farSea ring's centre hole under the model
function startOarFinale() {
  if (MODE === 'finale') return;   // idempotent: never stack a second terminal / sea disc
  MODE = 'finale';
  player.locked = true;
  interact.enabled = false;
  A.musicStop();   // leaving owns the soundscape from here
  UI.cinematic(true);
  W._finaleWarm = true;            // the clean warm grade, exempt from the descent curdle (#22)
  A.duckAmbient(true);             // the shore draws quiet as you push off
  farSea.visible = false;          // the oarSea disc replaces it — no double-shaded overlap (power)
  // the look-back shot: start low beside the dory, drift seaward and rise a touch,
  // always gazing back at the island as it shrinks to a model on the water
  const camStartPos = new THREE.Vector3(-26, 2.6, -116);
  const pivot = new THREE.Vector3(2, 0.9, -64); // the island's heart — the model collapses here
  camera.position.copy(camStartPos);
  // a dark sea under the model: farSea is a RingGeometry(280,9000) with a 280-unit hole at
  // the origin that the full-size island normally fills; once the island shrinks away the
  // model would float over a void, so lay a flat dark disc across the gap for the terminal.
  oarSea = new THREE.Mesh(new THREE.CircleGeometry(1400, 48),
    new THREE.MeshBasicMaterial({ color: 0x10333c }));
  oarSea.rotation.x = -Math.PI / 2;
  oarSea.position.set(pivot.x, 0.03, pivot.z);
  scene.add(oarSea);
  // the low sea-level look-back exposes interior-only shells the island was never built to
  // be seen-from-the-sea with (the vault vista's inverted lighthouse, the drowned gallery,
  // the annex/cellar innards — backstage that only reads from inside). Hide them for the
  // terminal; the game ends here, so nothing needs restoring.
  for (const nm of ['vaultVista', 'vaultDrips', 'drownedGallery', 'quarters']) {
    core.traverse((o) => { if (o.name === nm) o.visible = false; });
  }
  const lookAt = pivot.clone().add(new THREE.Vector3(0, 2, 0)); // aim a touch high so the model rides just below frame-centre
  finale = {
    kind: 'oar', t: 0, pivot, lookAt,
    camStart: camStartPos.clone(),
    camEnd: new THREE.Vector3(-30, 9.5, -178),  // drift seaward (south) and rise a little: the long look back
    quatStart: camera.quaternion.clone(),
  };
  const line1 = document.querySelector('#finale .fin-line1');
  if (line1) line1.textContent = 'you left the light on';
  // the rower's own realization, at peace, fades in as you pull away — NOT the keeper (no
  // keeper styling, no leading ellipsis, so it doesn't re-read as his voice after his silence)
  setTimeout(() => { if (finale && finale.kind === 'oar') UI.whisper('The way out was the way in. It always was.'); }, 4400);
  // one warm bell-partial as the island becomes a model (the withheld, leitmotif-warm toll)
  setTimeout(() => { if (finale && finale.kind === 'oar') A.bellToll(true); }, 9500);
}

function tickOarFinale(dt) {
  const e = easeInOut(clamp(finale.t / 16, 0, 1));
  // hold a bittersweet golden hour — the night, and its stars, never come
  W.time = lerp(W.time, 17.6, 1 - Math.exp(-dt * 0.5));
  for (let i = 0; i < 5; i++) skyMat.uniforms.uConstelGlow.value[i] = 0;
  // camera: rise and drift seaward off the beach, always looking back at the island
  camera.position.lerpVectors(finale.camStart, finale.camEnd, e);
  const look = new THREE.Matrix4().lookAt(camera.position, finale.lookAt, new THREE.Vector3(0, 1, 0));
  const q = new THREE.Quaternion().setFromRotationMatrix(look);
  camera.quaternion.slerpQuaternions(finale.quatStart, q, Math.min(1, finale.t * 0.3));
  // the whole world shrinks toward the island's heart, becoming a tiny lit model floating on
  // the dark sea (the inverse-swell, run one last time) — clamped to a readable model size
  // (1/48), not the dive's vanishing 1/240 speck: the held final image must stay legible.
  const sf = clamp((finale.t - 4.5) / 8, 0, 1);
  const s = Math.exp(easeInOut(sf) * Math.log(1 / 48));
  diveGroup.scale.setScalar(s);
  diveGroup.position.set(
    finale.pivot.x * (1 - s),
    finale.pivot.y * (1 - s),
    finale.pivot.z * (1 - s));
  // the card rises (held shot, no fade): 'you left the light on'
  if (finale.t > 13 && !finale.shown) {
    finale.shown = true;
    document.getElementById('finale').classList.remove('hidden');
    requestAnimationFrame(() => document.getElementById('finale').classList.add('show'));
    document.getElementById('btn-again').addEventListener('click', () => {
      wipe();
      sessionStorage.setItem('abyme-autostart', '1');
      location.reload();
    });
  }
}

function tickFinale(dt) {
  finale.t += dt;
  if (finale.kind === 'oar') { tickOarFinale(dt); return; }
  const f = clamp(finale.t / 18, 0, 1);
  // surface (level 2): wheel the day into night so the constellation can land.
  // deep: hold a bittersweet golden hour — the night, and its stars, never come.
  if (finale.deep) W.time = lerp(W.time, 17.6, 1 - Math.exp(-dt * 0.5));
  else W.time = (W.time + dt * 1.6) % 24;
  // rise above the island, gaze back down at the lighthouse
  const e = easeInOut(f);
  camera.position.set(
    lerp(finale.camStart.x, LH.x + 60, e),
    lerp(finale.camStart.y, LH.y + 90, e),
    lerp(finale.camStart.z, LH.z - 110, e));
  // gaze down at the lighthouse, then lift to the north sky as the
  // credits land — that's where the constellation waits
  const lookY = lerp(LH.y + 8, LH.y + 260, easeInOut(clamp((finale.t - 8) / 6, 0, 1)));
  const look = new THREE.Matrix4().lookAt(camera.position, new THREE.Vector3(LH.x, lookY, LH.z), new THREE.Vector3(0, 1, 0));
  const q = new THREE.Quaternion().setFromRotationMatrix(look);
  camera.quaternion.slerpQuaternions(finale.quatStart, q, Math.min(1, f * 4));
  // the constellation ignites note by note as the day wheels into night — but
  // the deep ending withholds it: no night comes, so the stars never gather
  for (let i = 0; i < 5; i++) {
    skyMat.uniforms.uConstelGlow.value[i] = finale.deep ? 0 : clamp((finale.t - (6 + i * 0.9)) / 1.2, 0, 1);
  }
  if (finale.t > 9 && !finale.shown) {
    finale.shown = true;
    document.getElementById('finale').classList.remove('hidden');
    requestAnimationFrame(() => document.getElementById('finale').classList.add('show'));
    document.getElementById('btn-again').addEventListener('click', () => {
      wipe();
      sessionStorage.setItem('abyme-autostart', '1');
      location.reload();
    });
  }
}

// ---------------- per-frame: grade → everything ----------------
const _sunV = new THREE.Vector3();
const _moonV = new THREE.Vector3();
const MOONLIGHT = new THREE.Color(0x9fb8d9);
const swayMats = ['grass', 'canopies']
  .map((n) => core.children.find((o) => o.name === n)?.material)
  .concat(core.getObjectByName('kelp')?.material)   // kelp lives in region2 (pruned from clone, so unique)
  .filter(Boolean);
let flash = 0, prevEl = sunElevation(W.time);

// the approach: fall from the high sea, skim the swell, rise to the beach
const INTRO_PATH = new THREE.CatmullRomCurve3([
  new THREE.Vector3(170, 16, -260),
  new THREE.Vector3(96, 2.3, -192),
  new THREE.Vector3(40, 2.5, -142),
  new THREE.Vector3(10, 4.0, -118),
], false, 'catmullrom', 0.5);
const INTRO_LOOK = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-20, 10, 20),
  new THREE.Vector3(20, 4, -80),
  new THREE.Vector3(4, 3.2, -98),
  new THREE.Vector3(LH.x, LH.y + 12, LH.z),
], false, 'catmullrom', 0.5);
const _introLookV = new THREE.Vector3();

// the play-start frame — one source of truth, so the approach can LAND on it: the
// flythrough decelerates into exactly where (and how) the player will stand, and
// endIntro hands over with no cut. Before, the flight ended high over the water and
// then SNAPPED to standing on the beach — that jump is what read as a pause.
const SPAWN_POS = new THREE.Vector3(4, 0, -104);
const SPAWN_YAW = 2.19, SPAWN_PITCH = 0.05;
function setIntroLanding() {
  // place the camera exactly at the standing frame, then aim the approach curves'
  // final points at it so the glide eases seamlessly into gameplay
  player.spawn(SPAWN_POS, SPAWN_YAW, SPAWN_PITCH);
  const eye = camera.position.clone();
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  INTRO_PATH.points[INTRO_PATH.points.length - 1].copy(eye);
  INTRO_LOOK.points[INTRO_LOOK.points.length - 1].copy(eye).addScaledVector(fwd, 40);
  player.locked = true; // the approach owns the camera until endIntro hands it back
}

// spume blown off the swell along the skim leg — alive only mid-approach
const spray = (() => {
  const r = mulberry32(SEED ^ 0x5947);
  const pts = [];
  for (let i = 0; i < 72; i++) {
    const t = r();
    pts.push(
      lerp(96, 40, t) + (r() - 0.5) * 10,
      0.5 + r() * 2.3,
      lerp(-192, -142, t) + (r() - 0.5) * 10);
  }
  const p = makeGlowPoints(pts, 0xf2faff, 0.7);
  p.material.uniforms.uDrift.value = 1;
  p.material.uniforms.uFlare.value = 8;
  p.name = 'introSpray';
  return p;
})();
scene.add(spray);
let saveTimer = 0;

function applyAtmosphere(elapsed, dt) {
  const g = gradeAt(W.time);
  renderer.toneMappingExposure = g.exposure; // per-grade tone (#2): noon airy, night crushed
  sunDir(W.time, _sunV);
  moonDir(W.time, _moonV);
  const el = sunElevation(W.time);
  const night = clamp((-el - 0.02) / 0.18, 0, 1);

  // green flash: the sun crossing the sea while time is being wound
  if (Math.sign(el) !== Math.sign(prevEl) && Math.abs(el - prevEl) > 0.00012) flash = 1;
  prevEl = el;
  flash = Math.max(0, flash - dt * 0.6);

  // the moon stands in for the sun at night so shadows never die
  const moonUp = _moonV.y > 0.05;
  const lightDir = night > 0.6 && moonUp ? _moonV : _sunV;
  sun.position.copy(camera.position).addScaledVector(lightDir, 220);
  sun.target.position.copy(camera.position);
  sun.color.copy(night > 0.6 ? MOONLIGHT : g.sunCol);
  // mist rolls in and out on its own slow weather clock
  mistCur = lerp(mistCur, mistTargetAt(W.time), 1 - Math.exp(-dt / 16));
  // WOW pass (anti-flat): a stronger directional KEY + a lower ambient FILL = sculptural chiaroscuro
  // instead of flat even light. Keeps the per-grade COLOUR identity (only contrast changes), so the
  // melancholy reads as depth, not washout.
  sun.intensity = (night > 0.6 ? 0.5 * night : g.sunInt * 2.95 * clamp((el + 0.06) / 0.2, 0.05, 1)) * (1 - mistCur * 0.3);

  hemi.color.copy(g.hemiSky);
  hemi.groundColor.copy(g.hemiGnd);
  hemi.intensity = lerp(0.44, 0.15, night);
  scene.environmentIntensity = lerp(0.38, 0.08, night);

  scene.fog.color.copy(g.fog);
  scene.fog.density = g.fogDen * (MODE === 'dive' ? 0.5 : 1) * (1 + mistCur * 2.4);
  skyMat.uniforms.uMist.value = mistCur;

  // the coat remembers its keeper — one quiet line, up close, once
  if (MODE === 'play' && game && W.level >= 2) {
    if (camera.position.distanceTo(COAT_POS) < 1.7) {
      game.once('coatScent', () => UI.whisper('Salt and lamp oil, still.'));
    }
  }

  // the secret pinprick on the model's model — alive only at night, and
  // leaning all the way in earns the whisper exactly once per save
  if (nestedGlint) {
    const nf = isNight() ? 1 : 0;
    nestedGlint.material.opacity = nf * (0.55 + 0.25 * Math.sin(elapsed * 1.7));
    if (nf && MODE === 'play' && game) {
      nestedGlint.getWorldPosition(_glintV);
      if (camera.position.distanceTo(_glintV) < 1.5) {
        game.once('nestedLight', () => UI.whisper('Far down, a light is still lit.'));
      }
    }
  }

  // "you are here": the cool speck on the chart-table model tracks where you
  // actually stand on the island — the abyme made literal. Shown once you're in
  // the world; leaning over the table to find yourself earns one quiet line.
  if (youMarker) {
    const show = W.flags.introDone;
    youMarker.visible = show;
    if (show) {
      youMarker.position.set(player.pos.x, player.pos.y + 0.5, player.pos.z);
      const spark = youMarker.children[1];
      if (spark) spark.material.opacity = 0.55 + 0.35 * Math.sin(elapsed * 2.2);
      if (MODE === 'play' && game) {
        youMarker.getWorldPosition(_youV);
        if (camera.position.distanceTo(_youV) < 2.2) {
          game.once('youOnModel', () => {
            UI.whisper('There you are — a speck on your own map.');
            // the discovery lands in the journal, not just the air — and names the abyme
            // without naming who you are (fork-neutral: self-recognition, not identity).
            UI.addJournal('A mark has appeared on the model where I stand — a little light that moves when I move. I have bent over this map for days, trusting it to show me the island truly. It was showing me ON it the whole time. You can study a place a long while before you notice you are also a figure in it.', '', 'self');
          });
        }
      }
    }
  }

  const su = skyMat.uniforms;
  su.uTime.value = elapsed;
  su.uSunDir.value.copy(_sunV);
  su.uMoonDir.value.copy(_moonV);
  su.uSunCol.value.copy(g.sunCol);
  su.uTop.value.copy(g.skyTop);
  su.uHorizon.value.copy(g.skyHorizon);
  su.uHorizonHaze.value.copy(g.fog);          // match the terrain's aerial-perspective haze so the horizon seam dissolves
  su.uNight.value = night;
  su.uFlash.value = flash;

  const wu = waterMat.uniforms;
  wu.uTime.value = elapsed;
  wu.uWaterY.value = waterY();
  wu.uSunDir.value.copy(_sunV);
  wu.uSunCol.value.copy(g.sunCol);
  wu.uDeep.value.copy(g.water);
  wu.uShallow.value.copy(g.waterShallow);
  wu.uSkyCol.value.copy(g.skyHorizon);
  wu.uFogColor.value.copy(g.fog);
  wu.uFogDen.value = g.fogDen;
  wu.uNight.value = night;

  farSea.material.color.copy(g.water).lerp(g.fog, 0.35);
  farSea.position.y = waterY() - 0.15;

  // study glow: warm by night, faint by day — and the partner's warm window
  // goes dark the deeper you descend (one prop change per level, #13)
  const windowFade = Math.max(1 - 0.42 * Math.max(0, W.level - 2), 0.12);
  studyLight.intensity = lerp(4, 16, night) * windowFade;
  lampSpill.intensity = W.lampLit ? 220 : 0;
  cellarLight.intensity = W.flags.hatchOpen ? 9 : 0;
  cellarFill.intensity = W.flags.hatchOpen ? 3.4 : 0;
  // the vault's cold lamp, with a slow drowned pulse — lit only with the cellar open
  vaultGlow.intensity = W.flags.hatchOpen ? 42 * (1 + 0.07 * Math.sin(elapsed * 1.3)) : 0;
  vaultFill.intensity = W.flags.hatchOpen ? 12 : 0;
  disagreeLight.intensity = W.flags.hatchOpen ? 13 : 0;
  // slow drips falling the height of the void — scale cues (vanish at the water,
  // reappear at the roof); only while the vault is open
  if (vaultDrips) {
    // hidden during any finale: the oar terminal's sea look-back would otherwise expose this
    // cellar backstage (a returned player has hatchOpen=true, so this drive re-shows it)
    vaultDrips.visible = W.flags.hatchOpen && MODE !== 'finale';
    if (W.flags.hatchOpen) for (const d of vaultDrips.children) {
      const u = d.userData;
      u.phase = (u.phase + dt * u.speed) % 1;
      d.position.y = lerp(45, 13.9, u.phase);
      d.scale.setScalar(clamp(Math.min(u.phase / 0.07, (1 - u.phase) / 0.07), 0, 1));
    }
  }
  // the keeper's lamp burns one level down, with a faint lamp-oil flicker
  keeperLamp.intensity = (W.level >= 2 ? 26 : 0) * (1 + 0.05 * Math.sin(elapsed * 6.3));
  // the jetty beacon: a low warm glow by day, a real beacon by night
  jettyLamp.intensity = lerp(3, 20, night) * (1 + 0.07 * Math.sin(elapsed * 4.7));
  // the globe blooms a soft halo and burns brighter as night falls — a light
  // left for a return that may never come (the Threshold, #24)
  {
    const flick = 1 + 0.10 * Math.sin(elapsed * 4.7) + 0.05 * Math.sin(elapsed * 11.3);
    if (refs.jettyHalo) {
      refs.jettyHalo.material.opacity = lerp(0.12, 0.92, night) * flick;
      refs.jettyHalo.scale.setScalar(lerp(1.2, 2.5, night) * flick);
    }
    if (refs.jettyLantern) refs.jettyLantern.material.emissiveIntensity = lerp(1.0, 2.8, night) * flick;
  }

  // iris cursor only exists while playing
  document.getElementById('iris').classList.toggle('gone', MODE !== 'play');

  // glow particles
  const bu = biolume.material.uniforms;
  bu.uTime.value = elapsed;
  bu.uPlayer.value.copy(camera.position);
  bu.uGlobal.value = (1 - W.tide) * lerp(0.25, 1, night);
  const fu = fireflies.material.uniforms;
  fu.uTime.value = elapsed;
  fu.uPlayer.value.copy(camera.position);
  fu.uGlobal.value = night;
  // the drowned gallery's cold light in the chasm, exposed as the tide falls (#16)
  if (galleryGlow) {
    const gg = galleryGlow.material.uniforms;
    gg.uTime.value = elapsed;
    gg.uPlayer.value.copy(camera.position);
    gg.uGlobal.value = Math.max(1 - W.tide, W.level >= 3 ? 0.9 : 0);   // tide-drained at L1, + the drowned hall glows in the deep
  }
  if (l3motes) {                                  // SEA-STRATA L3: cold bioluminal midwater motes
    const lm = l3motes.material.uniforms;
    lm.uTime.value = elapsed;
    lm.uPlayer.value.copy(camera.position);
    lm.uGlobal.value = W.level >= 3 ? 1 : 0;
  }
  const mu = motes.material.uniforms;
  mu.uTime.value = elapsed;
  mu.uPlayer.value.copy(camera.position);
  mu.uGlobal.value = W.flags.hatchOpen ? 0.8 : 0;

  // beams + sway
  for (const r of [refs.beamCone, refs.shaftBeam]) {
    if (r?.material?.uniforms) r.material.uniforms.uTime.value = elapsed;
  }
  for (const m of swayMats) {
    const sh = m.userData.shader;
    if (sh) {
      sh.uniforms.uTime.value = elapsed;
      if (sh.uniforms.uHaze) sh.uniforms.uHaze.value.copy(scene.fog.color);
    }
  }
  // terrain aerial perspective (#5a): far land melts toward the grade's haze
  if (terrainMat?.userData.shader?.uniforms.uHaze) {
    terrainMat.userData.shader.uniforms.uHaze.value.copy(scene.fog.color);
  }

  // L2 fish-shadows: dark silhouettes gliding over the kelp floor in slow circles (#143).
  // Driven from elapsed (no accumulation); only at L2, where region2 shows them.
  if (refs.fishShadows && W.level === 2) {
    for (const f of refs.fishShadows.children) {
      const u = f.userData;
      const a = elapsed * u.spd + u.ph;
      f.position.x = u.cx + Math.cos(a) * u.r;
      f.position.z = u.cz + Math.sin(a) * u.r;
      f.position.y = u.y + Math.sin(elapsed * 0.5 + u.ph) * 0.12;   // gentle rise and fall
      f.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a));        // face the direction of travel
    }
  }

  // sky follows the camera
  sky.position.set(camera.position.x, 0, camera.position.z);
}

// ---------------- gulls ----------------
// at dawn the first gull leaves the gyre and takes the gallery rail,
// east side, facing the sun — wings folded, riding the keeper's view
const GULL_PERCH = new THREE.Vector3(LH.x + 3.05, LH.y + 21.95, LH.z);
let perchT = 0;

function tickGulls(elapsed, dt) {
  const day = 1 - clamp((-sunElevation(W.time) - 0.02) / 0.15, 0, 1);
  const wantPerch = isDawn() && MODE !== 'dive';
  perchT = clamp(perchT + (wantPerch ? dt / 4.5 : -dt / 3), 0, 1);
  const settle = easeInOut(perchT);
  for (const g of gulls) {
    g.visible = day > 0.3 && MODE !== 'dive';
    if (!g.visible) continue;
    const u = g.userData;
    const a = elapsed * u.speed + u.phase;
    g.position.set(LH.x + Math.cos(a) * u.radius, LH.y + u.h + Math.sin(a * 2.3) * 2, LH.z + Math.sin(a) * u.radius);
    g.rotation.y = -a + (u.speed < 0 ? Math.PI : 0); // nose along the flight tangent (flip for counter-wheelers)
    let flapAmp = 0.5;
    if (g === gulls[0] && settle > 0) {
      g.position.lerp(GULL_PERCH, settle);
      g.position.y += Math.sin(elapsed * 2.2) * 0.02 * settle;   // breathing
      g.rotation.y = lerp(g.rotation.y, Math.PI / 2, settle);    // face the dawn (east)
      flapAmp = 0.5 * (1 - settle);                              // fold
      u.l.rotation.x = u.r.rotation.x = -0.12 * settle;          // wings tucked
    }
    const flap = Math.sin(elapsed * 6 + u.phase) * flapAmp;
    u.l.rotation.z = flap + 0.16 * (g === gulls[0] ? settle : 0);
    u.r.rotation.z = -flap - 0.16 * (g === gulls[0] ? settle : 0);
  }
}

function tickPerched(elapsed, dt) {
  const day = 1 - clamp((-sunElevation(W.time) - 0.02) / 0.15, 0, 1);
  const active = day > 0.3 && MODE !== 'dive' && W.level === 1;
  const pp = player.pos;
  for (const g of perched) {
    const u = g.userData;
    if (!active) { g.visible = false; continue; }
    const d = Math.hypot(pp.x - u.px, pp.z - u.pz);
    if (u.flush === 0) {
      // perched + idle: a gentle bob and a slow look-around
      g.visible = true; g.rotation.x = 0;
      g.position.set(u.px, u.py + Math.sin(elapsed * 1.5 + u.ph) * 0.012, u.pz);
      g.rotation.y = u.yaw + Math.sin(elapsed * 0.45 + u.ph) * 0.18;
      if (d < 3.6) u.flush = 0.001;                        // startle → flush
    } else if (u.flush < 1) {
      // flush: a quick climb up + away (flew off)
      u.flush = Math.min(1, u.flush + dt / 0.9);
      const e = u.flush;
      const dx = u.px - pp.x, dz = u.pz - pp.z, dl = Math.hypot(dx, dz) || 1;
      g.position.set(u.px + (dx / dl) * e * 5, u.py + e * 7, u.pz + (dz / dl) * e * 5);
      g.rotation.x = -e * 0.6;                             // nose up, climbing
      g.visible = e < 0.97;
      if (e >= 1) u.cool = 14;
    } else {
      // gone: hidden; settle back once the cooldown elapses and the coast is clear
      g.visible = false;
      u.cool -= dt;
      if (u.cool <= 0 && d > 14) u.flush = 0;
    }
  }
}

// ---------------- footsteps ----------------
player.onRescue = () => UI.whisper('The ground gives you back.');
player.onFootstep = (kind, pos) => {
  A.footstep(kind);
  // wet seabed sparkles underfoot
  if ((1 - W.tide) > 0.5 && heightAt(pos.x, pos.z) < 0) {
    biolume.material.uniforms.uFlare.value = 9;
    setTimeout(() => { biolume.material.uniforms.uFlare.value = 6; }, 350);
  }
};

// ---------------- debug ----------------
if (DEBUG) {
  gpuTimer = makeGpuTimer(renderer); // Power Ledger: real GPU-frame-ms in the debug readout
  window.ABYME = { player, W, camera, scene, core, refs, modelRefs, renderer, game, THREE, UI, composer, bloomPass,
    bench: (t = 12) => { W.time = t; player.spawn(SPAWN_POS, SPAWN_YAW, SPAWN_PITCH); }, // fixed Power-Ledger pose
    gpuMs: () => (gpuTimer ? +gpuTimer.ms.toFixed(2) : null),
    gpuMode: () => (gpuTimer ? gpuTimer.mode : null),
    tp: (x, z, yaw = 0, pitch = 0) => player.spawn(new THREE.Vector3(x, 0, z), yaw, pitch),
    setIntroT: (t) => { if (intro) intro.t = t; },
    setPerch: (t) => { perchT = clamp(t, 0, 1); },
    setMist: (m) => { mistCur = clamp(m, 0, 1); },
    getMist: () => mistCur,
    setFinaleT: (t) => { if (finale) finale.t = t; },
    ascend: (instant = false) => startAscent(instant),  // #12 stage 1: the dive run backward
    getAscent: () => ascent && { t: ascent.t, dur: ascent.dur, snapDone: ascent.snapDone },
    armOar: () => { W.level = 1; W.flags.returned = true; },   // #22: arm the oar terminal (the climb-out)
    leave: () => startOarFinale(),                              // #22: trigger the oar terminal (the surface end)
    ring: () => startFinale(),                                  // the bell terminal (the bottom end) — regression check
    bottom: () => {                                             // item 4: jump to the bottom, leaning over the keeper
      W.level = MAX_DEPTH; W.flags.plumbHung = true; W.flags.dove = true;
      const fp = new THREE.Vector3(); game.modelRefs.tinyFigure.getWorldPosition(fp);
      player.spawn(new THREE.Vector3(fp.x + 0.8, 0, fp.z + 0.8), Math.atan2(-0.8, -0.8), -0.5);
    },
    getTwist: () => ({ keeperRose: !!W.flags.keeperRose, carried: !!W.flags.carried,
      rise: +game._keeperRise.toFixed(2), climbing: !!W.flags.climbing, level: W.level }),
    getFinale: () => finale && { kind: finale.kind, t: finale.t, shown: !!finale.shown },
    // --- testing toolkit (loop #118): Sea-Strata level jumps + encounter/state handles ---
    goLevel: (n) => {                                  // jump to a level the RIGHT way (apply its LEVELS row)
      n = Math.max(1, Math.min(n | 0, MAX_DEPTH));
      const L = LEVELS[n];
      W.level = n;
      W.tide = W.tideTarget = L.tide;                  // raised tide (set both: skip the 13s ease)
      if (n >= 2) W.regions.l2seen = true;
      if (n >= 3) W.regions.l3seen = true;
      if (n >= 4) W.regions.l4seen = true;
      player.spawn(new THREE.Vector3(L.spawn.pos[0], 0, L.spawn.pos[2]), L.spawn.yaw, L.spawn.pitch);
      save(player.pos);
      return { level: n, id: L.id, region: L.region, tide: L.tide, encounter: L.encounter };
    },
    dive: (instant = false) => {                       // the missing counterpart to ascend()
      if (W.level >= MAX_DEPTH) { UI.whisper('Already at the bottom.'); return false; }
      W.flags.plumbHung = true;                         // arm the plate so the mechanic is valid
      if (instant) return window.ABYME.goLevel(Math.min(W.level + 1, MAX_DEPTH));
      if (MODE !== 'play') return false;
      startDive();
      return true;
    },
    watcher: (cmd) => {                                 // 'spawn' | 'resolve' | 'reset' (the L3 grief figure)
      const w = game.refs.watcher; if (!w) return null;
      if (cmd === 'resolve') { W.flags.watcherSeen = true; return 'resolved'; }
      if (cmd === 'reset') {
        W.flags.watcherSeen = false; w.visible = false; w.scale.setScalar(1);
        w.position.set(24, heightAt(24, -88) || 0, -88); game._watcherRegard = 0; return 'reset';
      }
      if (W.level < 3) W.level = 3;                      // Watcher only active at L>=3
      W.flags.watcherSeen = false;
      const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
      const wx = player.pos.x + fx * 12, wz = player.pos.z + fz * 12;
      w.scale.setScalar(1); w.visible = true;
      w.position.set(wx, heightAt(wx, wz) || 0, wz); game._watcherRegard = 0;
      return { level: W.level, at: [+wx.toFixed(1), +wz.toFixed(1)] };
    },
    resetFlags: () => {                                 // in-world soft reset (no reload) for replaying chains
      Object.keys(W.flags).forEach((k) => { W.flags[k] = false; });
      W.level = 1; W.tide = W.tideTarget = 1; W.stems = 0;
      W.lensPlaced = false; W.beamAngle = 2.2; W.dials = [0, 0, 0, 0]; W.inventory = [];
      W.onceKeys = []; W.readKeys = [];
      W.regions = { l2seen: false, l3seen: false, l4seen: false, fragmentsFound: [] };
      save(player.pos);
      return 'flags reset (in-world)';
    },
    tideFigure: () => {                                // spawn/reset the L2 Tide-Figure ~12m ahead, for testing
      if (W.level !== 2) window.ABYME.goLevel(2);
      W.flags.tideFigureSeen = false;
      const f = game.refs.tideFigure; if (!f) return null;
      const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
      const wx = player.pos.x + fx * 12, wz = player.pos.z + fz * 12;
      f.scale.setScalar(1); f.visible = true;
      for (const m of (f.userData.mats || [])) m.opacity = 0.8;
      f.position.set(wx, heightAt(wx, wz) || 0, wz);
      game._tideRegard = 0; game._tfPrev = null;
      return { level: W.level, at: [+wx.toFixed(1), +wz.toFixed(1)] };
    },
    read: (loreId) => UI.openReader(loreId),            // open any lore fragment (verify deep pages at L>=3)
    state: () => {                                      // one structured snapshot — feeds the panel readout too
      const F = W.flags, L = LEVELS[W.level] || {};
      const CLIFF_AZ = Math.atan2(57.5 - (-85), 50 - (-40));
      const bd = Math.abs(((W.beamAngle - CLIFF_AZ + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      return {
        level: W.level, levelId: L.id, region: L.region || 'none', encounter: L.encounter,
        time: +W.time.toFixed(2), window: isDawn() ? 'dawn' : isGolden() ? 'golden' : isNight() ? 'night' : 'day',
        sunFrozen: W.timeDrift === 0,
        tide: +W.tide.toFixed(2), tideTarget: +W.tideTarget.toFixed(2), waterY: +waterY().toFixed(2),
        beamDelta: +bd.toFixed(3),
        regions: { l2: W.regions.l2seen, l3: W.regions.l3seen, l4: W.regions.l4seen, fragments: W.regions.fragmentsFound.slice() },
        inventory: W.inventory.slice(), stems: W.stems, once: W.onceKeys.length,
        flags: ['rulerPlaced', 'birdSolved', 'glyphsSeen', 'hatchOpen', 'plumbHung', 'dove', 'climbing', 'returned', 'keeperRose', 'carried', 'watcherSeen', 'tideFigureSeen', 'bellRung', 'readGlass'].filter((k) => F[k]),
      };
    },
  };
  buildDebugPanel();   // AFTER window.ABYME is assigned — the panel readout + buttons reference it
}
function buildDebugPanel() {
  const A = window.ABYME;
  const tp = (x, z, yaw = 0, pitch = 0) => player.spawn(new THREE.Vector3(x, 0, z), yaw, pitch);
  const CLIFF_AZ = Math.atan2(57.5 - (-85), 50 - (-40));
  // Every control's action, keyed; fed to ONE delegated click handler. Tooltips live in `groups`.
  const acts = {
    // Teleport
    beach: () => tp(4, -104, 2.19), study: () => tp(LH.x + 3, LH.z - 2.5, 2.6),
    stones: () => tp(SPOTS.stones.x, SPOTS.stones.y - 12, 0), islet: () => tp(138, -141, 0),
    cliff: () => tp(40, 38, Math.atan2(57.5 - 40, 50 - 38)), bridge: () => tp(47, 25, 0),
    dory: () => tp(-26, -104, 1.2), bluff: () => tp(SPOTS.hatch.x - 4, SPOTS.hatch.y + 4, Math.PI),
    cellar: () => { W.flags.hatchOpen = true; tp(SPOTS.hatch.x, 20, Math.PI); },   // room center (z=20), not the surface pad
    // Time & Tide (the two sliders are above, always visible)
    dawn: () => { W.time = 6.5; W.timeDrift = 0; }, golden: () => { W.time = 17.8; W.timeDrift = 0; },
    night: () => { W.time = 22; W.timeDrift = 0; }, freezeSun: () => { W.timeDrift = W.timeDrift > 0 ? 0 : 1 / 240; },
    drain: () => { W.tide = W.tideTarget = 0; }, high: () => { W.tide = W.tideTarget = 1; },
    mist: () => A.setMist(A.getMist() > 0.5 ? 0 : 1),
    // Grant — surface chain
    ruler: () => { W.flags.chestOpen = W.flags.rulerTaken = true; if (!W.inventory.includes('ruler')) W.inventory.push('ruler'); },
    rulerPlace: () => { W.flags.chestOpen = W.flags.rulerTaken = W.flags.rulerPlaced = true; W.inventory = W.inventory.filter((i) => i !== 'ruler'); W.stems = Math.max(W.stems, 2); },
    bird: () => { W.flags.heardBox = W.flags.heardBird = W.flags.birdSolved = true; W.stems = Math.max(W.stems, 3); },
    lens: () => { W.flags.lensTaken = true; if (!W.inventory.includes('lens')) W.inventory.push('lens'); },
    beamOn: () => { W.flags.lensTaken = true; W.lensPlaced = true; if (W.time > 4.6 && W.time < 20.6) W.time = 22; W.beamAngle = CLIFF_AZ; },
    glyphs: () => { W.flags.glyphsSeen = true; W.stems = Math.max(W.stems, 5); },
    glass: () => { W.flags.readGlass = true; if (!W.inventory.includes('readglass')) W.inventory.push('readglass'); },
    allSurface: () => {
      ['valveTurned', 'crankUsed', 'chestOpen', 'rulerTaken', 'rulerPlaced', 'heardBox', 'heardBird', 'birdSolved', 'lensTaken', 'glyphsSeen', 'shadowRevealed', 'hatchOpen', 'plumbTaken', 'plumbHung'].forEach((f) => { W.flags[f] = true; });
      W.lensPlaced = true; W.dials = [3, 7, 1, 5]; W.beamAngle = CLIFF_AZ; W.stems = 5;
      W.inventory = W.inventory.filter((x) => x !== 'ruler' && x !== 'lens');
      if (!W.inventory.includes('plumb')) W.inventory.push('plumb');
    },
    // Grant — bluff / dive chain
    shadow: () => { W.flags.shadowRevealed = true; },
    hatch: () => { W.dials = [3, 7, 1, 5]; W.flags.shadowRevealed = W.flags.hatchOpen = true; W.stems = Math.max(W.stems, 4); },
    plumb: () => { W.flags.plumbTaken = true; if (!W.inventory.includes('plumb')) W.inventory.push('plumb'); },
    diveArm: () => { W.flags.plumbTaken = W.flags.plumbHung = true; if (!W.inventory.includes('plumb')) W.inventory.push('plumb'); },
    // Levels & dives (SEA-STRATA)
    L1: () => A.goLevel(1), L2: () => A.goLevel(2), L3: () => A.goLevel(3), L4: () => A.goLevel(4),
    dive: () => A.dive(false), diveI: () => A.dive(true), asc: () => A.ascend(false), ascI: () => A.ascend(true),
    bottom: () => A.bottom(),
    // Encounters
    birdSing: () => { tp(SPOTS.stones.x, SPOTS.stones.y - 12, 0); if (game._birdSing) game._birdSing(); },   // tp first — _birdSing no-ops >38m
    wSpawn: () => A.watcher('spawn'), wResolve: () => A.watcher('resolve'), wReset: () => A.watcher('reset'),
    twist: () => { A.bottom(); W.onceKeys = W.onceKeys.filter((k) => k !== 'keeperTwist'); W.flags.keeperRose = true; },
    carried: () => { W.flags.keeperRose = true; W.flags.carried = true; }, tideFig: () => A.tideFigure(),
    // Endings
    ring: () => A.ring(), oar: () => { A.armOar(); A.leave(); }, replayIntro: () => A.setIntroT(0),
    // Power & Reset
    bench: () => { W.time = 12; player.spawn(SPAWN_POS, SPAWN_YAW, SPAWN_PITCH); },
    replayCine: () => { W.onceKeys.length = 0; },
    markLore: () => { W.readKeys = ['keeper_logbook', 'coat_letter', 'stone_inscription', 'music_note', 'bottle_note', 'quarters_journal', 'lens_mark_study', 'lens_mark_stone']; },
    clearLore: () => { W.readKeys.length = 0; },
    readLog: () => UI.openReader('keeper_logbook'), readQ: () => UI.openReader('quarters_journal'),
    fragAdd: () => { W.regions.fragmentsFound.push('test-' + W.regions.fragmentsFound.length); },
    fragClear: () => { W.regions.fragmentsFound.length = 0; },
    clrRegions: () => { W.regions.l2seen = W.regions.l3seen = W.regions.l4seen = false; },
    saveNow: () => save(player.pos), wipe: () => { wipe(); location.reload(); }, reset: () => A.resetFlags(),
  };
  // [act, label, tooltip] grouped into collapsible sections.
  const groups = [
    { title: 'Teleport', open: true, items: [
      ['beach', 'beach', 'Wake-up / dive-landing beach (4,-104)'], ['study', 'study', 'Lighthouse study / chart table — the hub (valve, crank, model, plate, hook, bell)'],
      ['stones', 'stones', 'Standing-stones vantage — all 5 in view'], ['islet', 'islet', 'Reading-glass islet (138,-141) — grab the brass glass + lens-mark stone'],
      ['cliff', 'cliff', 'In front of the glyph cliff — watch the lighthouse beam write glyphs'], ['bridge', 'bridge', 'Chasm bridge deck (needs ruler✓ first, or you fall)'],
      ['dory', 'dory', 'Beached dory / oar — the surface LEAVE terminal'], ['bluff', 'bluff', 'Bluff hatch TOP (surface pad above the cellar)'],
      ['cellar', 'cellar↓', 'DOWN into the cellar/vault interior (auto-opens the hatch) — plumb, vault vista, room-that-disagrees'],
    ] },
    { title: 'Time & Tide', open: true, items: [
      ['dawn', 'dawn', 'Jump to dawn 6.5h (songbird window) + freeze the sun'], ['golden', 'golden', 'Jump to golden hour 17.8h (hatch shimmer) + freeze the sun'],
      ['night', 'night', 'Jump to night 22h (lamp/beam/glyphs) + freeze the sun'], ['freezeSun', '❄ sun', 'Freeze/unfreeze the sun drift — stops the clock creeping out of a window mid-setup'],
      ['drain', 'drain', 'Tide → 0 (drained): exposes the chest, causeway, drowned gallery'], ['high', 'high', 'Tide → 1 (normal high water)'],
      ['mist', 'mist', 'Toggle fog clear/full, independent of the hour'],
    ] },
    { title: 'Grant — surface chain', open: false, items: [
      ['ruler', 'ruler+', 'Grant the ruler item (rulerTaken + inventory, de-duped)'], ['rulerPlace', 'ruler✓ bridge', 'Place the ruler → raises the chasm bridge (rulerPlaced, stem 2)'],
      ['bird', 'bird✓', 'Solve the stones in one tap (opens the lens vault). Use Encounters→"bird sing" to actually hear it'], ['lens', 'lens+', 'Grant the first lens item (does NOT place it — use "beam on")'],
      ['beamOn', 'beam on', 'Place the lens + go to night + aim the beam at the cliff. Teleport→cliff to see the glyphs light'], ['glyphs', 'glyphs✓', 'Grant glyphsSeen (the beam endgame) + stem 5, without perfect alignment'],
      ['glass', 'glass+', 'Grant the reading glass — fades up the two lampblack lens-marks (study + stone)'], ['allSurface', 'ALL surface✓', 'Grant the ENTIRE surface→dive-armed chain + stems 1–5. Does NOT dive — leaves you at L1, plate armed'],
    ] },
    { title: 'Grant — bluff / dive chain', open: false, items: [
      ['shadow', 'shadow✓', 'Reveal the 4 hatch glyph dials (the golden-hour shimmer click)'], ['hatch', 'hatch✓ code', 'Set dials to 3·7·1·5 + open the hatch (stem 4)'],
      ['plumb', 'plumb+', 'Grant the plumb-bob item (does NOT hang it)'], ['diveArm', 'dive armed', 'Hang the plumb → the dive plate goes live (plumbHung). Adds plumb to inventory'],
    ] },
    { title: 'Levels & dives — SEA-STRATA', open: true, items: [
      ['L1', 'L1 surface', 'Jump to L1 (surface): LEVELS[1] spawn (4,-104), tide 1.0, regions cleared'], ['L2', 'L2 shallows', 'Jump to L2 (shallows): raised tide 1.35, region2 visible, marks l2seen'],
      ['L3', 'L3 midwater', 'Jump to L3 (midwater): bluff spawn, raised tide 1.65, region3 visible (Watcher active)'], ['L4', 'L4 source', 'Jump to L4 (bottom): study spawn, raised tide 1.9, region4 visible (keeper twist)'],
      ['dive', 'dive ▼', 'Run the REAL 21s dive cinematic (+1 level). Auto-arms the plate'], ['diveI', 'dive ▼ i', 'Instant dive: +1 level with LEVELS spawn/tide/region applied, no cinematic'],
      ['asc', 'ascend ▲', 'Run the REAL 28s ascent cinematic (−1 level)'], ['ascI', 'ascend ▲ i', 'Instant ascent: −1 level, no cinematic'],
      ['bottom', 'bottom', 'Jump to the bottom (L4) leaning over the keeper figure — fires the twist proximity'],
    ] },
    { title: 'Encounters', open: true, items: [
      ['birdSing', 'bird sing', 'Teleport to the stones + force the dawn songbird to sing now (set time→dawn for full audio)'], ['wSpawn', 'Watcher spawn', 'Spawn/reset the Watcher ~12m ahead (forces L≥3). Hold its gaze ~2.6s to resolve it for real'],
      ['wResolve', 'Watcher resolve', 'Force-resolve the Watcher (watcherSeen) — it lifts its head and dissolves'], ['wReset', 'Watcher reset', 'Reset the Watcher to its origin + clear watcherSeen so it can be re-tested'],
      ['twist', 'keeper twist', 'Force the bottom twist: jump to the bottom + set keeperRose (the figure has risen)'], ['carried', 'carried ✓', 'Set the "rose with you" branch (keeperRose+carried) to test the carried ending'],
      ['tideFig', 'Tide-Figure', 'Spawn the L2 Tide-Figure ~12m ahead (forces L2). Stand still and watch ~2.6s to resolve it; wade toward it and it disperses'],
    ] },
    { title: 'Endings', open: false, items: [
      ['ring', 'ring bell', 'BELL ending (accept the loop). Tone forks by depth — set the level first'], ['oar', 'row oar', 'OAR ending (leave, changed): arms + runs the look-back finale'],
      ['replayIntro', 'replay intro', 'Restart the 19s intro flight (if one is live; else wipe+reload)'],
    ] },
    { title: 'Power & Reset', open: false, items: [
      ['bench', 'bench (perf)', 'Fixed power-benchmark pose (noon + identical spawn) so the readout below is comparable run-to-run'],
      ['replayCine', 'replay cines', 'Clear onceKeys so every one-time cinematic can fire again — the #1 reason a beat "won’t replay"'],
      ['markLore', 'mark lore read', 'Mark every lore fragment read (audit the deep-reveal economy). Use "read log/Q" to actually display them'], ['clearLore', 'clear lore', 'Empty readKeys so first-read lines + deep reveals fire fresh'],
      ['readLog', 'read log', 'Open the keeper’s logbook reader (deep page at L≥3)'], ['readQ', 'read Q', 'Open the quarters journal reader (deep page at L≥3)'],
      ['fragAdd', 'frag+', 'Push a test id into regions.fragmentsFound (exercise the strata persistence)'], ['fragClear', 'frag clr', 'Empty regions.fragmentsFound'], ['clrRegions', 'clr seen', 'Clear l2/l3/l4 seen — re-test "first reach" growth'],
      ['saveNow', 'save', 'Force a save() of current state + position'], ['reset', 'reset flags', 'Soft-reset all flags/level/tide/inventory/onceKeys to defaults WITHOUT reloading'], ['wipe', 'wipe ↻', 'Wipe the save + reload for a clean first-run — the cure for stale state'],
    ] },
  ];
  const btn = ([act, label, tip]) => `<button data-act="${act}" title="${tip.replace(/"/g, '&quot;')}">${label}</button>`;
  const grp = (g) => `<details class="dbg-grp"${g.open ? ' open' : ''}><summary>${g.title}</summary><div class="dbg-row">${g.items.map(btn).join('')}</div></details>`;
  const el = document.createElement('div');
  el.id = 'debug-panel';
  el.innerHTML = `
    <div id="dbg-hdr"><span id="dbg-hide" title="Hide the panel — backtick (\`) toggles it back">▾ hide</span><span class="dim"> · press \` to toggle</span></div>
    <div id="dbg-state-1"></div><div id="dbg-state-2"></div>
    <label class="dbg-sl">time <input type="range" id="dbg-time" min="0" max="24" step="0.05" title="Sun clock 0–24h"><span id="dbg-time-v"></span></label>
    <label class="dbg-sl">tide <input type="range" id="dbg-tide" min="0" max="2" step="0.05" title="Sea level — 0 drained · 1 high · 2 fully raised (>1 = raised strata sea)"><span id="dbg-tide-v"></span></label>
    ${groups.map(grp).join('')}
    <div id="dbg-fps"></div>`;
  document.body.appendChild(el);
  // hide/show the panel (owner request): the "hide" header collapses it; backtick (`) toggles it back.
  const hideBtn = el.querySelector('#dbg-hide');
  if (hideBtn) hideBtn.addEventListener('click', () => { el.style.display = 'none'; });
  addEventListener('keydown', (e) => {
    if (e.code === 'Backquote') { e.preventDefault(); el.style.display = (el.style.display === 'none') ? '' : 'none'; }
  });
  const tslider = el.querySelector('#dbg-time'); tslider.value = W.time;
  tslider.addEventListener('input', () => { W.time = parseFloat(tslider.value); });
  const dslider = el.querySelector('#dbg-tide'); dslider.value = W.tide;
  dslider.addEventListener('input', () => { W.tide = W.tideTarget = parseFloat(dslider.value); });
  el.addEventListener('click', (e) => { const act = e.target?.dataset?.act; if (act && acts[act]) acts[act](); });
  setInterval(() => {
    const s = A.state();
    el.querySelector('#dbg-time-v').textContent = W.time.toFixed(1) + 'h';
    el.querySelector('#dbg-tide-v').textContent = W.tide.toFixed(2);
    const s1 = el.querySelector('#dbg-state-1'), s2 = el.querySelector('#dbg-state-2');
    s1.textContent = `L${s.level} ${s.levelId} · ${s.region} · ${s.encounter} · tide ${s.tide}${s.tide !== s.tideTarget ? '→' + s.tideTarget : ''} (y${s.waterY}) · ${s.window} ${s.time}h${s.sunFrozen ? ' ❄' : ''}`;
    s1.className = s.tide > 1 ? 'raised' : '';
    const seen = [s.regions.l2 && '2', s.regions.l3 && '3', s.regions.l4 && '4'].filter(Boolean).join('') || '—';
    s2.textContent = `inv:[${s.inventory.join(',') || '—'}] · stems ${s.stems} · once ${s.once} · beamΔ${s.beamDelta} · ${s.flags.join(' ') || 'no key flags'} · seen:${seen} frags:${s.regions.fragments.length}`;
    s2.className = s.flags.length ? '' : 'dim';
    const calls = renderer.info.render.calls, tris = renderer.info.render.triangles;
    const gms = gpuTimer ? gpuTimer.ms : 0;
    const fpsEl = el.querySelector('#dbg-fps');
    fpsEl.textContent = `${fps.toFixed(0)}fps · ${calls} draws · ${(tris / 1000).toFixed(0)}k tris · ${gms.toFixed(1)}ms gpu${gpuTimer && gpuTimer.mode === 'cpu' ? '(cpu~)' : ''}`;
    fpsEl.style.color = (calls >= 360 || tris >= 800000 || fps < 58) ? '#e8a0a0' : '#9fe8c5';
    tslider.value = W.time; dslider.value = W.tide;
  }, 400);
}

// GPU-frame-ms timer (Power Ledger #1). The 60fps governor caps fps, so fps reads a flat
// 60 right up until it falls off a cliff — only true GPU time can prove a graphics tick is
// power-neutral. EXT_disjoint_timer_query_webgl2 (one query in flight, polled when ready);
// CPU rAF-delta fallback, LABELLED 'cpu~' (wall-clock around render, NOT true GPU time).
// DEBUG-only — never created for players, so zero shipped cost.
function makeGpuTimer(renderer) {
  const gl = renderer.getContext();
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  let active = null, pending = null, started = false, cpuT0 = 0, lastMs = 0;
  return {
    mode: ext ? 'gpu' : 'cpu',
    beginFrame() {
      started = false;
      if (!ext) { cpuT0 = performance.now(); started = true; return; }
      if (pending !== null && gl.getQueryParameter(pending, gl.QUERY_RESULT_AVAILABLE)) {
        if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) lastMs = gl.getQueryParameter(pending, gl.QUERY_RESULT) / 1e6;
        gl.deleteQuery(pending); pending = null;
      }
      if (pending === null) { active = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, active); started = true; }
    },
    endFrame() {
      if (!started) return;
      if (!ext) { lastMs = performance.now() - cpuT0; return; }
      gl.endQuery(ext.TIME_ELAPSED_EXT); pending = active; active = null;
    },
    get ms() { return lastMs; },
  };
}

// ---------------- main loop ----------------
const clock = new THREE.Clock();
let elapsed = 0, fps = 60;

// power policy (owner directive): the island only needs 60fps. The frame
// governor skips ticks only when clearly ahead of the 60fps budget — the
// 12.5ms threshold sits safely between the 60Hz (16.7ms) and 120Hz (8.3ms)
// intervals, so a 60Hz display never drops a frame (the old 15.5ms gate
// sat against the 60Hz interval and stuttered) while a 120Hz display still
// renders every other tick. Resolution is fixed (see BASE_DPR) — no
// per-frame setPixelRatio, no framebuffer-realloc hitches.
let lastTickMs = 0;
let mistCur = 0;

renderer.setAnimationLoop((tMs) => {
  const nowMs = tMs ?? performance.now();
  if (nowMs - lastTickMs < 12.5) return; // 60fps cap; never drops a 60Hz frame
  lastTickMs = nowMs;
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  fps = lerp(fps, 1 / Math.max(dt, 1e-4), 0.05);

  // idle drift of the sun — barely perceptible, but the island lives
  if (MODE === 'play') W.time = (W.time + W.timeDrift * dt) % 24;
  if (MODE === 'play') A.musicTo(W.level);   // the era music bed follows the descent (crossfades by level)

  if (MODE === 'intro' && intro) {
    intro.t += dt;
    const f = clamp(intro.t / intro.dur, 0, 1);
    const e = easeInOut(f);
    INTRO_PATH.getPoint(e, camera.position);
    // lift gently OVER the drowned colonnade (the "docks" off the beach: columns at x=0/8,
    // z≈-108..-119, caps/lintels topping ~1.9). The descent into the beach otherwise skims
    // straight through that sunken hall. A smooth parabolic rise centred on the colonnade,
    // tapering to exactly 0 at the landing (z=-104) and seaward of it (z=-123) — so the
    // seamless handover to gameplay is untouched.
    const colz = (camera.position.z + 113.5) / 9.5;        // 0 at the colonnade's centre
    camera.position.y += Math.max(0, 1 - colz * colz) * 1.9;
    // the lower the flight, the more the swell owns the camera
    const lowness = clamp(1 - (camera.position.y - 1.6) / 12, 0, 1);
    const sway = W.reduceMotion ? 0 : 1; // reduced-motion: keep the flight, drop the sway/bank
    camera.position.y += Math.sin(elapsed * 0.9) * lerp(0.12, 0.55, lowness) * (1 - f * f) * sway;
    INTRO_LOOK.getPoint(e * e, _introLookV);
    camera.lookAt(_introLookV);
    // banking — damped to zero as we land, so the handoff has no residual roll
    camera.rotation.z += Math.sin(elapsed * 0.55 + 1.7) * 0.022 * lowness * (1 - f * f) * sway;
    const su = spray.material.uniforms;
    su.uGlobal.value = smoothstep(0.18, 0.38, e) * (1 - smoothstep(0.72, 0.9, e));
    su.uTime.value = elapsed;
    su.uPlayer.value.copy(camera.position);
    if (f >= 1) endIntro();
  }

  if (MODE === 'dive' && dive) tickDive(dt);
  if (MODE === 'ascend' && ascent) tickAscent(dt);
  if (MODE === 'finale' && finale) tickFinale(dt);

  if (!W.reading) player.update(dt);   // a fragment is open: the world holds still while you read
  game.tick(dt, elapsed);
  interact.update();
  applyAtmosphere(elapsed, dt);
  tickGulls(elapsed, dt);
  tickPerched(elapsed, dt);

  A.update(dt, {
    wavePhase: clamp(wavePhase(elapsed), 0, 1),
    shoreDist: Math.max(0, heightAt(player.pos.x, player.pos.z)) * 13 + (player.interior() ? 60 : 0),
    tideNear: lerp(0.45, 1, W.tide),
    altitude: player.pos.y,
    interior: player.interior(),
    night: isNight() ? 1 : 0,
    mist: mistCur,
  });

  // autosave — but not while poised on the brink of a dive: the journal will
  // not follow you down, so the world stops recording as you cross the threshold
  if (MODE === 'play' && !game.atBrink()) {
    saveTimer += dt;
    if (saveTimer > 12) { saveTimer = 0; save(player.pos); }
  }

  if (gpuTimer) gpuTimer.beginFrame();
  if (bloomPass.enabled) composer.render();   // bloomPass.enabled is the on/off lever (debug + perf fallback)
  else renderer.render(scene, camera);
  if (gpuTimer) gpuTimer.endFrame();
});
