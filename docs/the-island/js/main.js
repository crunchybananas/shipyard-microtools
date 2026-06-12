// main.js — boot, light, loop. ABYME: an island within an island.

import * as THREE from 'three';
import { W, save, load, hasSave, wipe, gradeAt, sunDir, moonDir, sunElevation, isNight, isDawn, mistTargetAt, waterY, wavePhase, SCALE_MODEL } from './world.js';
import { SPOTS, heightAt, walkableY } from './terrain.js';
import { buildWorld, instantiateModel, collectRefs } from './props.js';
import { makeSkyMaterial, makeGlowPoints } from './shaders.js';
import { Player } from './player.js';
import { Interactions } from './interact.js';
import { Game } from './puzzles.js';
import { UI } from './ui.js';
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
const BASE_DPR = Math.min(devicePixelRatio || 1, 1.75);
renderer.setPixelRatio(BASE_DPR);
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

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------------- world ----------------
const { core, waterMat, modelAnchor, biolume, fireflies, motes } = buildWorld();
const modelRoot = instantiateModel(core, modelAnchor);
const nestedGlint = modelRoot.getObjectByName('nestedGlint');
const _glintV = new THREE.Vector3();
const refs = collectRefs(core);
const modelRefs = collectRefs(modelRoot);
// the clone captured pre-clone children only; nothing model-side needs Points

const diveGroup = new THREE.Group();
diveGroup.add(core, biolume, fireflies, motes);
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

// ---------------- gulls ----------------
const gulls = [];
{
  const wingMat = new THREE.MeshStandardMaterial({ color: 0xe8e4da, flatShading: true, side: THREE.DoubleSide });
  for (let i = 0; i < 2; i++) {
    const g = new THREE.Group();
    const l = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.4), wingMat);
    l.position.x = -0.7;
    const r = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.4), wingMat);
    r.position.x = 0.7;
    g.add(l, r);
    g.userData = { phase: i * 2.4, radius: 24 + i * 9, h: 32 + i * 6, speed: 0.14 + i * 0.03, l, r };
    scene.add(g);
    gulls.push(g);
  }
}

// ---------------- actors ----------------
const player = new Player(camera, canvas);
const interact = new Interactions(camera, player, canvas);
const game = new Game({
  refs, modelRefs, modelAnchor, interact, player,
  onDive: startDive,
  onFinale: startFinale,
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
  if (hasSave()) { wipe(); sessionStorage.setItem('abyme-autostart', '1'); location.reload(); return; }
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
  beginIntro();
}

function beginIntro() {
  A.init();
  // let the title hold a breath over the first seconds of sea
  setTimeout(() => titleEl.classList.add('fading'), 1400);
  UI.cinematic(true);
  UI.fadeIn();
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
  player.spawn(new THREE.Vector3(4, 0, -104), 2.19, 0.05);
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
  A.diveSweep(21);
  dprNow = Math.min(BASE_DPR, 1.0);
  renderer.setPixelRatio(dprNow);
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
    W.level = 2;
    save(player.pos);
    player.spawn(new THREE.Vector3(4, 0, -104), 2.19, 0.02);
  }
  if (f >= 1) {
    dive = null;
    MODE = 'play';
    dprNow = BASE_DPR;
    renderer.setPixelRatio(dprNow);
    farSea.visible = true;
    player.locked = false;
    interact.enabled = true;
    UI.cinematic(false);
    UI.fadeIn(false);
    setTimeout(() => document.getElementById('curtain').classList.remove('white'), 800);
    UI.whisper('The same sand. The same sky.');
    setTimeout(() => UI.whisper('Somewhere above, a door stands open now.'), 6000);
  }
}

// ---------------- the finale ----------------
function startFinale() {
  MODE = 'finale';
  player.locked = true;
  interact.enabled = false;
  UI.cinematic(true);
  A.bellToll();
  finale = { t: 0, camStart: camera.position.clone(), quatStart: camera.quaternion.clone() };
}

function tickFinale(dt) {
  finale.t += dt;
  const f = clamp(finale.t / 18, 0, 1);
  W.time = (W.time + dt * 1.6) % 24;
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
  // the constellation ignites note by note as the day wheels into night
  for (let i = 0; i < 5; i++) {
    skyMat.uniforms.uConstelGlow.value[i] = clamp((finale.t - (6 + i * 0.9)) / 1.2, 0, 1);
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
  sun.intensity = (night > 0.6 ? 0.5 * night : g.sunInt * 2.6 * clamp((el + 0.06) / 0.2, 0.05, 1)) * (1 - mistCur * 0.3);

  hemi.color.copy(g.hemiSky);
  hemi.groundColor.copy(g.hemiGnd);
  hemi.intensity = lerp(0.55, 0.18, night);
  scene.environmentIntensity = lerp(0.38, 0.08, night);

  scene.fog.color.copy(g.fog);
  scene.fog.density = g.fogDen * (MODE === 'dive' ? 0.5 : 1) * (1 + mistCur * 2.4);

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

  const su = skyMat.uniforms;
  su.uTime.value = elapsed;
  su.uSunDir.value.copy(_sunV);
  su.uMoonDir.value.copy(_moonV);
  su.uSunCol.value.copy(g.sunCol);
  su.uTop.value.copy(g.skyTop);
  su.uHorizon.value.copy(g.skyHorizon);
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

  // study glow: warm by night, faint by day
  studyLight.intensity = lerp(4, 16, night);
  lampSpill.intensity = W.lampLit ? 220 : 0;
  cellarLight.intensity = W.flags.hatchOpen ? 9 : 0;
  cellarFill.intensity = W.flags.hatchOpen ? 3.4 : 0;

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
    g.rotation.y = -a - Math.PI / 2;
    let flapAmp = 0.5;
    if (g === gulls[0] && settle > 0) {
      g.position.lerp(GULL_PERCH, settle);
      g.position.y += Math.sin(elapsed * 2.2) * 0.02 * settle;   // breathing
      g.rotation.y = lerp(g.rotation.y, -Math.PI / 2, settle);   // face the dawn
      flapAmp = 0.5 * (1 - settle);                              // fold
      u.l.rotation.x = u.r.rotation.x = -0.12 * settle;          // wings tucked
    }
    const flap = Math.sin(elapsed * 6 + u.phase) * flapAmp;
    u.l.rotation.z = flap + 0.16 * (g === gulls[0] ? settle : 0);
    u.r.rotation.z = -flap - 0.16 * (g === gulls[0] ? settle : 0);
  }
}

// ---------------- footsteps ----------------
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
  buildDebugPanel();
  window.ABYME = { player, W, camera, scene, core, refs, modelRefs, renderer, game, THREE,
    tp: (x, z, yaw = 0, pitch = 0) => player.spawn(new THREE.Vector3(x, 0, z), yaw, pitch),
    setIntroT: (t) => { if (intro) intro.t = t; },
    setPerch: (t) => { perchT = clamp(t, 0, 1); },
    setMist: (m) => { mistCur = clamp(m, 0, 1); },
    getMist: () => mistCur,
    setFinaleT: (t) => { if (finale) finale.t = t; } };
}
function buildDebugPanel() {
  const el = document.createElement('div');
  el.id = 'debug-panel';
  el.innerHTML = `
    <label>time <input type="range" id="dbg-time" min="0" max="24" step="0.05"><span id="dbg-time-v"></span></label>
    <div class="row">
      <button data-act="tide">tide</button>
      <button data-act="beach">beach</button><button data-act="study">study</button>
      <button data-act="stones">stones</button><button data-act="bluff">bluff</button>
      <button data-act="ruler">+ruler</button><button data-act="bird">bird✓</button>
      <button data-act="lens">+lens</button><button data-act="shadow">shadow✓</button>
      <button data-act="code">code✓</button><button data-act="plumb">+plumb✓</button>
      <button data-act="L2">level2</button>
    </div>
    <div id="dbg-fps"></div>`;
  document.body.appendChild(el);
  const slider = el.querySelector('#dbg-time');
  slider.value = W.time;
  slider.addEventListener('input', () => { W.time = parseFloat(slider.value); });
  el.addEventListener('click', (e) => {
    const act = e.target?.dataset?.act;
    if (!act) return;
    const tp = (x, z, yaw = 0) => player.spawn(new THREE.Vector3(x, 0, z), yaw);
    ({
      tide: () => { W.tideTarget = W.tideTarget > 0.5 ? 0 : 1; },
      beach: () => tp(4, -104, 2.19),
      study: () => tp(LH.x + 3, LH.z - 2.5, 2.6),
      stones: () => tp(SPOTS.stones.x, SPOTS.stones.y - 12, 0),
      bluff: () => tp(SPOTS.hatch.x - 4, SPOTS.hatch.y + 4, Math.PI),
      ruler: () => { W.flags.rulerTaken = true; W.inventory.push('ruler'); },
      bird: () => { W.flags.heardBox = W.flags.heardBird = W.flags.birdSolved = true; },
      lens: () => { W.flags.lensTaken = true; W.inventory.push('lens'); },
      shadow: () => { W.flags.shadowRevealed = true; },
      code: () => { W.dials = [...[3, 7, 1, 5]]; W.flags.shadowRevealed = true; W.flags.hatchOpen = true; },
      plumb: () => { W.flags.plumbTaken = true; W.flags.plumbHung = true; },
      L2: () => { W.level = 2; },
    })[act]?.();
  });
  setInterval(() => {
    el.querySelector('#dbg-time-v').textContent = W.time.toFixed(1) + 'h';
    el.querySelector('#dbg-fps').textContent = `${fps.toFixed(0)} fps · draws ${renderer.info.render.calls} · tris ${(renderer.info.render.triangles / 1000).toFixed(0)}k`;
    slider.value = W.time;
  }, 400);
}

// ---------------- main loop ----------------
const clock = new THREE.Clock();
let elapsed = 0, fps = 60;

// power policy (owner directive): the island only needs 60 — on 120 Hz
// displays skip excess vsync ticks; and full resolution only while the
// hand is on the world, easing to a calmer ratio at rest
let lastTickMs = 0;
let dprNow = BASE_DPR, restUntil = 0;
const REST_DPR = Math.min(BASE_DPR, 1.3);
let mistCur = 0;

renderer.setAnimationLoop((tMs) => {
  const nowMs = tMs ?? performance.now();
  if (nowMs - lastTickMs < 15.5) return; // ~64 fps ceiling, no-op at 60 Hz
  lastTickMs = nowMs;
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  fps = lerp(fps, 1 / Math.max(dt, 1e-4), 0.05);

  const active = player.keys.size > 0 || player.dragging || player.dragCaptured || MODE !== 'play';
  if (active) restUntil = elapsed + 1.2;
  if (MODE !== 'dive') {
    const want = elapsed < restUntil ? BASE_DPR : REST_DPR;
    if (want !== dprNow) { dprNow = want; renderer.setPixelRatio(dprNow); }
  }

  // idle drift of the sun — barely perceptible, but the island lives
  if (MODE === 'play') W.time = (W.time + W.timeDrift * dt) % 24;

  if (MODE === 'intro' && intro) {
    intro.t += dt;
    const f = clamp(intro.t / intro.dur, 0, 1);
    const e = easeInOut(f);
    INTRO_PATH.getPoint(e, camera.position);
    // the lower the flight, the more the swell owns the camera
    const lowness = clamp(1 - (camera.position.y - 1.6) / 12, 0, 1);
    camera.position.y += Math.sin(elapsed * 0.9) * lerp(0.12, 0.55, lowness) * (1 - f * f);
    INTRO_LOOK.getPoint(e * e, _introLookV);
    camera.lookAt(_introLookV);
    camera.rotation.z += Math.sin(elapsed * 0.55 + 1.7) * 0.022 * lowness; // banking
    const su = spray.material.uniforms;
    su.uGlobal.value = smoothstep(0.18, 0.38, e) * (1 - smoothstep(0.72, 0.9, e));
    su.uTime.value = elapsed;
    su.uPlayer.value.copy(camera.position);
    if (f >= 1) endIntro();
  }

  if (MODE === 'dive' && dive) tickDive(dt);
  if (MODE === 'finale' && finale) tickFinale(dt);

  player.update(dt);
  game.tick(dt, elapsed);
  interact.update();
  applyAtmosphere(elapsed, dt);
  tickGulls(elapsed, dt);

  A.update(dt, {
    wavePhase: clamp(wavePhase(elapsed), 0, 1),
    shoreDist: Math.max(0, heightAt(player.pos.x, player.pos.z)) * 13 + (player.interior() ? 60 : 0),
    tideNear: lerp(0.45, 1, W.tide),
    altitude: player.pos.y,
    interior: player.interior(),
    night: isNight() ? 1 : 0,
    mist: mistCur,
  });

  if (MODE === 'play') {
    saveTimer += dt;
    if (saveTimer > 12) { saveTimer = 0; save(player.pos); }
  }

  renderer.render(scene, camera);
});
