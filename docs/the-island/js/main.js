// main.js — boot, light, loop. ABYME: an island within an island.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { W, save, load, hasSave, wipe, gradeAt, sunDir, moonDir, sunElevation, isNight, isDawn, isGolden, mistTargetAt, waterY, wavePhase, SCALE_MODEL, MAX_DEPTH, LEVELS, TIDE_DROP, HAND, ledger, draft, tideAt, hands, evidence, clearStack, disposeStack, syncStack, isShared, handId } from './world.js';
import { SPOTS, heightAt, walkableY, wallBlocked, colliders, GATES, syncGates } from './terrain.js';
import { buildWorld, instantiateModel, collectRefs, NAMES } from './props.js';
import { makeSkyMaterial, makeGlowPoints, makeFarSeaMaterial } from './shaders.js';
import { Player } from './player.js';
import { Interactions } from './interact.js';
import { Game } from './puzzles.js';
import { UI } from './ui.js';
import { KEEPER, T, finaleCoda } from './content.js';
import A from './audio.js';
import { Baker, mergeGeometries, clamp, lerp, easeInOut, smoothstep, TAU, mulberry32, SEED, addDrive, runDrives } from './util.js';

const canvas = document.getElementById('scene');
const DEBUG = new URLSearchParams(location.search).has('debug');

// ?diag — surface render/shader errors + the GPU string ON-SCREEN, so a machine that renders black
// can be diagnosed without ever opening the dev console (the black-screen box couldn't be reproduced
// headless). Installed before any rendering so it catches shader-compile errors (THREE.WebGLProgram).
if (new URLSearchParams(location.search).has('diag')) {
  const lines = [];
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:0;right:0;bottom:0;max-height:48vh;z-index:99999;background:rgba(0,0,0,.9);color:#9fe8c5;font:11px/1.45 monospace;padding:10px;overflow:auto;white-space:pre-wrap;-webkit-user-select:text;user-select:text';
  const show = () => { box.textContent = '[ABYME ?diag — read this to Claude]\n' + lines.join('\n'); if (!box.parentNode && document.body) document.body.appendChild(box); };
  const push = (tag, parts) => { lines.push(tag + ' ' + parts.map((x) => { try { return typeof x === 'string' ? x : JSON.stringify(x); } catch (e) { return String(x); } }).join(' ')); if (lines.length > 120) lines.shift(); show(); };
  const oe = console.error.bind(console), ow = console.warn.bind(console);
  console.error = (...a) => { push('ERR', a); oe(...a); };
  console.warn = (...a) => { push('WARN', a); ow(...a); };
  addEventListener('error', (e) => push('UNCAUGHT', [e.message, (e.filename || '') + ':' + e.lineno]));
  try {
    const c = document.createElement('canvas'), gl = c.getContext('webgl2') || c.getContext('webgl');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    push('GPU', [ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'n/a', '· webgl2=' + !!(c.getContext('webgl2'))]);
  } catch (e) { push('GPU-ERR', [String(e)]); }
  push('UA', [navigator.userAgent]);
  push('—', ['waiting for render… (errors will appear below)']);
}

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
// stats we can trust: with autoReset, every composer pass resets renderer.info, so the debug
// panel always read the LAST pass — 1 draw, 1 triangle. Reset manually once per tick instead
// (in the animation loop), so draws/tris cover the whole frame: scene + shadow + bloom passes.
renderer.info.autoReset = false;

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
const bloomPass = new UnrealBloomPass(BLOOM_RES(), 0.68, 0.68, 1.05); // strength, radius, threshold (only bright things bloom) — WOW pass: softer, dreamier glow on the lamp/sun-sparkle/highlights.
// threshold runs on the LINEAR pre-tonemap buffer: at 0.85 the noon sun on pale brass
// (the valve wheel — the hub's main interactable) blew past it and the whole prop
// torched white. 1.05 returns sunlit brass to brass. (#54 verification catch.)
//
// DO NOT RAISE THIS to fix something looking blown out. I tried, for the sunlit chart
// paper, and measured my way back: the ceiling is 1.25 (the quarters lamp bulb sits at
// 1.311 and the tiny figure's glow at 1.251, and both must keep blooming), and at
// every value up to 1.25 the paper clipped exactly as hard — 12.1% of the crop above
// 245 at 1.05, 1.20 AND 1.25. Those pixels are already white BEFORE the bloom pass;
// bloom was only adding the halo around them. A surface that reads as blown is an
// ALBEDO problem, not a threshold problem — fix the material. tools/harness/bloom.mjs
// pins the 1.25 ceiling so this cannot be quietly raised past the glows later.
composer.addPass(bloomPass);
composer.addPass(new OutputPass());
// Post-processing safety net: some browser/GPU combos render the bloom composer's half-float
// buffers as solid black while a direct render is perfect — a foreground-only black screen with
// NO js error. `?safe` forces a direct (no-bloom) render; the loop also SELF-TESTS this once
// (below) and auto-falls-back if the composer comes back black, so the game is never stuck black.
if (new URLSearchParams(location.search).has('safe')) { bloomPass.enabled = false; bloomPass.dead = true; }   // dead: settings (#59) must never re-enable it

// #32: the black-composer check is a ONE-SHOT deterministic probe at boot now — a bright
// synthetic quad through a throwaway composer with the same bloom recipe, read once. The
// old in-loop self-test double-rendered the scene with a readPixels stall for up to 200
// frames on dark starts (a night-save Continue opened with ~3.3s of jank). The title
// overlay covers the canvas at boot, so the probe frame is never seen.
function probeBloomOnce() {
  if (bloomPass.dead) return;                       // ?safe already decided
  try {
    const ps = new THREE.Scene();
    const pq = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    ps.add(pq);
    const pc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const tc = new EffectComposer(renderer);
    tc.addPass(new RenderPass(ps, pc));
    tc.addPass(new UnrealBloomPass(new THREE.Vector2(32, 32), 0.68, 0.68, 1.05));
    tc.addPass(new OutputPass());
    tc.render();
    const gl2 = renderer.getContext();
    const px = new Uint8Array(4);
    gl2.readPixels(renderer.domElement.width >> 1, renderer.domElement.height >> 1, 1, 1, gl2.RGBA, gl2.UNSIGNED_BYTE, px);
    tc.dispose();
    pq.geometry.dispose(); pq.material.dispose();
    if (px[0] + px[1] + px[2] < 60) {               // a white quad came back dark: no half-float composer here
      bloomPass.enabled = false;
      bloomPass.dead = true;
      console.warn('[ABYME] post-processing probe returned a dark frame — bloom disabled, rendering direct.');
    }
  } catch (e) {
    bloomPass.enabled = false;
    bloomPass.dead = true;
    console.warn('[ABYME] post-processing probe failed — bloom disabled, rendering direct.', e);
  }
}
probeBloomOnce();

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
// #70: the registry assert — every NAMES entry must resolve on the ISLAND instance at
// boot (the model legitimately prunes). collectRefs backfills typos with silent nulls;
// this makes them loud, in the console and (via ?diag) on-screen.
{
  const missing = NAMES.filter((n) => !refs[n]);
  if (missing.length) console.error('[ABYME] prop-registry assert: unresolved island refs → ' + missing.join(', '));
}
// #73: per-entity drives register HERE, beside the wiring, and self-gate on W —
// applyAtmosphere goes back to being about atmosphere. The scheduler runs them each frame.
addDrive((w) => w.atTop, (dt, elapsed) => {
  // the foreshadow ring — the NEXT level's waterline, breathing like a premonition
  // the foreshadow ring shows the NEXT rung's real waterline — including the draft
  // your own work on this one has already put there. The vista from the top is the
  // first place the law is visible: you can see what you are about to leave someone.
  const nextTide = tideAt(Math.min(W.level + 1, MAX_DEPTH));
  foreshadow.position.y = -TIDE_DROP * (1 - nextTide) + 0.06;
  foreshadow.material.opacity = 0.30 + Math.sin(elapsed * 0.9) * 0.08;
});
addDrive(null, () => { foreshadow.visible = W.atTop; });
addDrive((w) => w.level === 2 && !!refs.fishShadows, (dt, elapsed) => {
  // L2 fish-shadows: dark silhouettes gliding over the kelp floor in slow circles (#143)
  for (const f of refs.fishShadows.children) {
    const u = f.userData;
    const a = elapsed * u.spd + u.ph;
    f.position.x = u.cx + Math.cos(a) * u.r;
    f.position.z = u.cz + Math.sin(a) * u.r;
    f.position.y = u.y + Math.sin(elapsed * 0.5 + u.ph) * 0.12;
    f.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a));
  }
});
addDrive(null, (dt, elapsed) => {
  // the jetty globe blooms as night falls — a light left for a return that may never come (#24)
  const night = clamp((-sunElevation(W.time) - 0.02) / 0.18, 0, 1);
  const flick = 1 + 0.10 * Math.sin(elapsed * 4.7) + 0.05 * Math.sin(elapsed * 11.3);
  if (refs.jettyHalo) {
    refs.jettyHalo.material.opacity = lerp(0.12, 0.92, night) * flick;
    refs.jettyHalo.scale.setScalar(lerp(1.2, 2.5, night) * flick);
  }
  if (refs.jettyLantern) refs.jettyLantern.material.emissiveIntensity = lerp(1.0, 2.8, night) * flick;
});

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

// the horizon sea (#37): a real shader on the annulus — glitter road, sky mirror, fog —
// sharing the near water's uniform objects so applyAtmosphere drives both. Inner radius
// meets the world sea, which the water shader circles at r=310 (no more double-draw band).
const farSea = new THREE.Mesh(
  new THREE.RingGeometry(310, 9000, 64),
  makeFarSeaMaterial(waterMat.uniforms));
farSea.rotation.x = -Math.PI / 2;
scene.add(farSea);

// hub Phase B — the FORESHADOW: from the lamp-room gallery you glimpse the line the NEXT level's
// tide means to rise to. A faint luminous ring lying flat at that higher water height, encircling
// the island; shown ONLY while atTop, its height + glow driven in applyAtmosphere by W.level.
const foreshadow = new THREE.Mesh(
  new THREE.TorusGeometry(118, 0.45, 6, 96),
  new THREE.MeshBasicMaterial({ color: 0x9fe4ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
foreshadow.rotation.x = -Math.PI / 2;
foreshadow.position.set(0, 1.5, -40);   // centred on the island (x0,z-40); y driven to the next tide's waterline
foreshadow.renderOrder = 3;
foreshadow.visible = false;
foreshadow.name = 'foreshadow';
scene.add(foreshadow);

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

// #27: the biggest per-pixel power lever left — a light at intensity 0 still costs its
// slot in EVERY MeshStandardMaterial's fragment light loop. Gate the nine by .visible
// (driven each frame from the intensity applyAtmosphere just computed): the whole
// surface chapter runs 2-4 active point lights instead of 9. Distinct visible-light
// COUNTS mean distinct shader programs — the 9-light variant is warmed by a boot-time
// renderer.compile() below (today's shipped program), and each smaller count compiles
// once, almost always inside a cinematic beat (hatch, lamplit, dive). Never ADD a
// tenth light: 9 stays the fragility ceiling (the black-screen budget).
const POINT_LIGHTS = [studyLight, lampSpill, cellarLight, cellarFill, keeperLamp, jettyLamp, vaultGlow, vaultFill, disagreeLight];
renderer.compile(scene, camera);         // #27: warm the full 9-light program (today's shipped shader) before gating begins
renderer.shadowMap.autoUpdate = false;   // #28: the shadow pass redraws only when applyAtmosphere marks it dirty
renderer.shadowMap.needsUpdate = true;   // …starting with one honest first draw

// ---------------- gulls ----------------
const gulls = [];
{
  // A gull is not a white shape — it is a WHITE BIRD WITH A GREY MANTLE AND BLACK
  // WINGTIPS, and that contrast is the entire silhouette at any distance. The flock
  // was one flat off-white on every surface, which is why it read as ovoids drifting
  // over the island rather than as birds. Vertex colours fix it for zero extra draws
  // and zero extra material state (the flock is still 3 meshes each).
  const wingMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: false, side: THREE.DoubleSide });
  const C_BODY = new THREE.Color(0xf2efe6);   // white, faintly warm
  const C_MANTLE = new THREE.Color(0x9aa6ae); // the grey back
  const C_TIP = new THREE.Color(0x2b2f36);    // the black primaries

  // paint a wing root→tip. The two wings sit at x = ∓0.7 from one centred plane, so
  // the tip is at local −x on the left and +x on the right — mirrored, which is why
  // this needs a geometry per side. Still one mesh per wing, so draws are unchanged.
  const mkWing = (tipAtNegX) => {
    const g = new THREE.PlaneGeometry(1.4, 0.4, 6, 1);
    const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      // 0 at the body, 1 at the tip
      const t = tipAtNegX ? (0.7 - p.getX(i)) / 1.4 : (p.getX(i) + 0.7) / 1.4;
      c.copy(C_BODY).lerp(C_MANTLE, Math.min(1, t * 1.5)).lerp(C_TIP, Math.max(0, (t - 0.72) / 0.28));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  };
  const wingGeoL = mkWing(true), wingGeoR = mkWing(false);

  const bodyCone = new THREE.ConeGeometry(0.13, 0.6, 8);
  bodyCone.rotateX(Math.PI / 2.15);                       // nose forward, tail riding up
  const headBall = new THREE.SphereGeometry(0.09, 8, 6);
  headBall.translate(0, 0.07, 0.33);
  const gullBodyGeo = mergeGeometries([bodyCone, headBall]);
  bodyCone.dispose(); headBall.dispose();
  {
    // the body is white underneath and grey along the back — the same read as the
    // wings, so a gull seen from below is pale and from above is a grey shape on the sea
    const p = gullBodyGeo.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      c.copy(C_BODY).lerp(C_MANTLE, Math.max(0, Math.min(1, (p.getY(i) + 0.02) / 0.14)) * 0.85);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    gullBodyGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
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
    const l = new THREE.Mesh(wingGeoL, wingMat);
    l.position.x = -0.7;
    const r = new THREE.Mesh(wingGeoR, wingMat);
    r.position.x = 0.7;
    // a body between the wings — songbird recipe, gull proportions —
    // so the dawn percher reads as a bird up close, not two cards
    g.add(l, r, new THREE.Mesh(gullBodyGeo, wingMat));
    g.userData = { phase: f.phase, radius: f.radius, h: f.h, speed: f.speed, l, r };
    scene.add(g);
    gulls.push(g);
  }
}

// ---------------- bird wings (perched gulls + crows) ----------------
// A resting bird shows FOLDED wings (the grey/dark mantle); when it FLUSHES it needs real ones. One
// pivoted wing per side: swept back along the body at rest, spread + flapping on takeoff (driven by
// u.flush in tickPerched). Shared geometry + material across all birds — cheap, scene-only (no clone).
const _wingGeo = (side) => {
  const geo = new THREE.PlaneGeometry(0.52, 0.24, 1, 1);
  geo.translate(side * 0.26, 0, 0);                                   // shoulder at x0, tip at x=side*0.52
  const pa = geo.attributes.position;
  for (let v = 0; v < pa.count; v++) if (side * pa.getX(v) > 0.42) pa.setY(v, pa.getY(v) * 0.28); // pointed tip
  geo.rotateX(-Math.PI / 2);                                          // lie flat (span x, chord z)
  geo.computeVertexNormals();
  return geo;
};
const WING_GEO_L = _wingGeo(-1), WING_GEO_R = _wingGeo(1);
// wing grey matched to the baked mantle so a folded wing reads as the bird's grey back,
// not a stuck-on pale board (#46)
const gullWingMat = new THREE.MeshStandardMaterial({ color: 0xa9a69b, flatShading: true, roughness: 0.82, side: THREE.DoubleSide });
const crowWingMat = new THREE.MeshStandardMaterial({ color: 0x24262b, flatShading: true, roughness: 0.7, metalness: 0.1, side: THREE.DoubleSide });
// the FOLDED pose (#46): swept back AND rolled down the flank with the chord tucked
// short, so the wing hugs the body like real folded primaries — the old pose left both
// wings sticking out horizontally at shoulder height, the last blob-tell on the shore
// gulls. tickPerched lerps from these exact constants on takeoff.
const FOLD_Y = 1.42, FOLD_Z = 0.45, FOLD_CHORD = 0.72;
const addWings = (g, mat) => {
  const lw = new THREE.Group(), rw = new THREE.Group();
  lw.position.set(-0.05, 0.25, 0.03); rw.position.set(0.05, 0.25, 0.03);
  lw.rotation.set(0, -FOLD_Y, FOLD_Z); rw.rotation.set(0, FOLD_Y, -FOLD_Z);
  lw.scale.z = rw.scale.z = FOLD_CHORD;
  lw.add(new THREE.Mesh(WING_GEO_L, mat)); rw.add(new THREE.Mesh(WING_GEO_R, mat));
  g.add(lw, rw); g.lw = lw; g.rw = rw;
};

// ---------------- perched-bird bodies ----------------
// One merged, vertex-coloured geometry per species (via the Baker): the resting body was five
// meshes across three materials PER BIRD — 45 draw calls of tiny 7×6-segment spheres that read
// visibly faceted at flush distance. Now each bird is 1 smooth body draw (+2 wings), and both
// species share one material. Part sizes/poses match the old builders exactly.
const birdBodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.06 });
const bakeBirdGeo = (parts) => {
  const b = new Baker();
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3();
  for (const [geo, col, x, y, z, rx = 0, sx = 1, sy = 1, sz = 1] of parts) {
    b.add(geo, M.compose(V.set(x, y, z), Q.setFromEuler(E.set(rx, 0, 0)), S.set(sx, sy, sz)), col);
    geo.dispose();
  }
  return b.build();
};
const gullGeo = (() => {
  // mantle darkened a step (#46): the old 0x95938b washed to white in warm light and the
  // whole bird read as one pale blob — now the grey back/folded-wing mass reads at range
  const white = new THREE.Color(0xe7e3d8), grey = new THREE.Color(0x8d8b81), beak = new THREE.Color(0xd6a233);
  return bakeBirdGeo([
    [new THREE.SphereGeometry(0.16, 10, 8), white, 0, 0.17, 0, 0, 1, 0.86, 1.62],          // body
    [new THREE.SphereGeometry(0.155, 10, 7), grey, 0, 0.25, -0.02, 0, 0.92, 0.46, 1.5],    // mantle (folded wings / back)
    [new THREE.ConeGeometry(0.085, 0.26, 6), grey, 0, 0.18, -0.32, -1.95],                 // tail
    [new THREE.SphereGeometry(0.097, 10, 8), white, 0, 0.36, 0.25],                        // head
    [new THREE.ConeGeometry(0.028, 0.12, 6), beak, 0, 0.355, 0.38, Math.PI / 2],           // beak
  ]);
})();
const crowGeo = (() => {
  const blk = new THREE.Color(0x2e3035), blkD = new THREE.Color(0x1c1e22);
  return bakeBirdGeo([
    [new THREE.SphereGeometry(0.15, 10, 8), blk, 0, 0.16, 0, 0, 0.92, 0.8, 1.9],           // sleeker body
    [new THREE.SphereGeometry(0.145, 10, 7), blkD, 0, 0.24, -0.04, 0, 0.88, 0.42, 1.6],    // mantle
    [new THREE.ConeGeometry(0.075, 0.4, 6), blkD, 0, 0.16, -0.44, -1.72],                  // longer tail
    [new THREE.SphereGeometry(0.092, 10, 8), blk, 0, 0.34, 0.27],                          // head
    [new THREE.ConeGeometry(0.03, 0.17, 6), blkD, 0, 0.335, 0.44, Math.PI / 2],            // longer beak
  ]);
})();

// ---------------- perched shore gulls ----------------
// gulls resting on the south shingle — the first life you meet at the wake-up beach. They startle and
// flush off when you come close, and settle back once you've moved on. Static when perched (verifiable);
// added to `scene` (not core) → no 1:240 model clone. Surface + day only.
const perched = [];
{
  const mk = () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(gullGeo, birdBodyMat));
    addWings(g, gullWingMat);
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
    g.userData = { px: x, py: h, pz: z, yaw: g.rotation.y, ph: rngP() * TAU, flush: 0, cool: 0, species: 'gull' };
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
  const mkCrow = () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(crowGeo, birdBodyMat));
    addWings(g, crowWingMat);
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
    g.userData = { px: x, py: h, pz: z, yaw: g.rotation.y, ph: rngC() * TAU, flush: 0, cool: 0, species: 'crow' };
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
  onClimb: (up) => startClimb(up),     // hub Phase B: the lamp-room climb
});

UI.init();

// ---------------- settings (#59): the keeper's instruments, adjusted ----------------
// Device preferences, not save state (like abyme-muted): look speed, invert-Y, volume,
// and DRIFTWOOD mode — a net power cut (no bloom pass + capped DPR) for warm laps and
// old machines. Persisted as one JSON blob; applied on boot and on every change.
{
  const KEY = 'abyme-settings';
  const defs = { sens: 1, invertY: false, vol: 1, drift: false, pace: 1, textScale: 1, calmFlash: false };   // #143: reading pace, letter size, calm flashes
  let cfg = defs;
  try { cfg = { ...defs, ...(JSON.parse(localStorage.getItem(KEY)) || {}) }; } catch (_) {}
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (_) {} };
  const apply = () => {
    player.sens = cfg.sens;
    player.invertY = !!cfg.invertY;
    A.setVolume(cfg.vol);
    bloomPass.enabled = !cfg.drift && !bloomPass.dead;               // driftwood: render direct (never resurrect a dead composer)
    // #143 accessibility: whispers hold longer, letters grow, bright moments soften
    UI.setReadPace(cfg.pace || 1);
    document.documentElement.style.setProperty('--text-scale', String(cfg.textScale || 1));
    document.documentElement.classList.toggle('calm-flash', !!cfg.calmFlash);
    bloomPass.strength = cfg.calmFlash ? 0.42 : 0.68;
    renderer.setPixelRatio(cfg.drift ? Math.min(BASE_DPR, 1.0) : BASE_DPR);
    composer.setPixelRatio(cfg.drift ? Math.min(BASE_DPR, 1.0) : BASE_DPR);
    composer.setSize(innerWidth, innerHeight);
    const r = BLOOM_RES();
    bloomPass.setSize(r.x, r.y);                                     // keep the half-res blur on toggle
  };
  const tab = document.getElementById('settings-tab');
  const panel = document.getElementById('settings');
  const sens = document.getElementById('set-sens');
  const inv = document.getElementById('set-invert');
  const vol = document.getElementById('set-vol');
  const drift = document.getElementById('set-drift');
  const pace = document.getElementById('set-pace');
  const txt = document.getElementById('set-text');
  const calm = document.getElementById('set-calm');
  if (tab && panel) {
    sens.value = cfg.sens; inv.checked = !!cfg.invertY; vol.value = cfg.vol; drift.checked = !!cfg.drift;
    pace.value = cfg.pace; txt.value = cfg.textScale; calm.checked = !!cfg.calmFlash;
    tab.addEventListener('click', () => panel.classList.toggle('hidden'));
    sens.addEventListener('input', () => { cfg.sens = +sens.value; apply(); persist(); });
    inv.addEventListener('change', () => { cfg.invertY = inv.checked; apply(); persist(); });
    vol.addEventListener('input', () => { cfg.vol = +vol.value; apply(); persist(); });
    drift.addEventListener('change', () => { cfg.drift = drift.checked; apply(); persist(); });
    pace.addEventListener('input', () => { cfg.pace = +pace.value; apply(); persist(); });
    txt.addEventListener('input', () => { cfg.textScale = +txt.value; apply(); persist(); });
    calm.addEventListener('change', () => { cfg.calmFlash = calm.checked; apply(); persist(); });
  }
  apply();
  window.ABYME_SETTINGS = { get: () => ({ ...cfg }), set: (k, v) => { cfg[k] = v; apply(); persist(); } };
}

// ---------------- modes ----------------
let MODE = 'title';
let intro = null;
let dive = null;
let finale = null;

const titleEl = document.getElementById('title-screen');
const btnBegin = document.getElementById('btn-begin');
const btnContinue = document.getElementById('btn-continue');
const titleActions = document.getElementById('title-actions');
const beginConfirm = document.getElementById('begin-confirm');

if (hasSave()) btnContinue.classList.remove('hidden');

btnBegin.addEventListener('click', () => {
  // a fresh start discards any old save — and Begin sits one pixel from Continue, so that
  // is never a single click (#56): with a save present, swap the menu row for a confirm
  // beat first. The eventual wipe() stashes the outgoing payload one slot deep
  // (SAVE_KEY_PREV) as a last-resort undo.
  if (hasSave()) {
    titleActions.classList.add('hidden');
    beginConfirm.classList.remove('hidden');
    return;
  }
  beginIntro();
});
document.getElementById('btn-begin-back').addEventListener('click', () => {
  beginConfirm.classList.add('hidden');
  titleActions.classList.remove('hidden');
});
document.getElementById('btn-begin-confirm').addEventListener('click', () => {
  // W is still at its defaults on the title screen, so begin IN PLACE — the old
  // wipe()+reload bounced the page and flashed the title back up for a beat ("a second
  // window that just says Begin, then fades"); no reload is needed here.
  wipe();        // world.js stashes the outgoing save under SAVE_KEY_PREV before clearing
  beginIntro();
});
btnContinue.addEventListener('click', () => {
  A.init();
  if (load()) {
    // stems restore from the flags that earned them, not a counter
    const STEM_FLAGS = { 1: 'valveTurned', 2: 'rulerPlaced', 3: 'birdSolved', 4: 'hatchOpen', 5: 'glyphsSeen', 6: 'keeperSong' };
    for (const [n, f] of Object.entries(STEM_FLAGS)) if (W.flags[f]) A.addStem(+n);
    titleEl.classList.add('fading');
    const pos = W.playerPos || new THREE.Vector3(4, 0, -104);
    // the facing persists too (#58): [yaw, pitch] from the save, falling back
    // to the historical hardcoded beach facing for pre-v3 saves.
    let [yaw, pitch] = W.playerLook || [2.72, 0];
    // a save written below the drained-tide line predates the basin rim
    // block — those spots have no walkable exit; the tide returns you
    // (and the saved facing is meaningless at the fallback spot)
    if (heightAt(pos.x, pos.z) < -2.2) { pos.set(4, 0, -104); yaw = 2.72; pitch = 0; }
    player.spawn(pos, yaw, pitch);
    player.locked = false;
    interact.enabled = true;
    MODE = 'play';
    UI.fadeIn();
    UI.showHint();
  }
});

// ---- REHYDRATE FROM A REPORT ------------------------------------------------
// ?report=last  ·  ?report=<the report's ISO t>  ·  ?report=<index into the ring>
//
// Land straight back in a reported bug: same save, same level, same spot, same
// facing, no title and no intro. It survives a REFRESH, which is the whole point —
// the owner keeps hunting while a fix is being written, then reloads the same URL to
// check whether the thing they reported is gone. Sending a note stamps the URL for
// you (history.replaceState below), so F8 → send → refresh already works.
//
// Addressed by TIMESTAMP rather than position in the ring, because the ring is a
// last-10 and keeps moving: `last` is convenient, `t` is stable, and a stable handle
// is what makes "reload and check" mean the same thing an hour later.
function rehydrateFromReport() {
  const q = new URLSearchParams(location.search).get('report');
  if (!q) return false;
  let ring = [];
  try { ring = JSON.parse(localStorage.getItem('abyme-reports') || '[]'); } catch (_) { ring = []; }
  const rep = !ring.length ? null
    : (q === 'last' ? ring[ring.length - 1]
      : (/^\d+$/.test(q) ? ring[+q] : ring.find((r) => r.t === q || (r.t || '').startsWith(q))));
  if (!rep) {
    // LOUD, not a console warning nobody reads. Silently showing the title screen is
    // indistinguishable from a broken link, and that is exactly how it read.
    offerImport(q, ring.length);
    return false;
  }
  // `A` in this module is the AUDIO import, not the game API — A.init() really is
  // "start audio" (which the Begin and Continue paths both call), but the game's own
  // surface lives on window.ABYME and is not assigned until the debug block near the
  // bottom of this file. Calling A.applyReport() threw during module evaluation and
  // took window.ABYME down with it, so `?report=` produced a page with no game on it
  // at all. Hence: audio through A, everything else through the real API, and this
  // runs AFTER that assignment (see the call site at the end of the module).
  const G = window.ABYME;
  if (!G || !G.applyReport) { console.warn('[abyme] ?report= ran before the game was ready'); return false; }
  titleEl.style.display = 'none';        // no title flash, no Begin gate
  A.init();                              // audio
  UI.fadeIn();
  const out = G.applyReport(rep);        // save, stems, level, pose — all of it
  UI.showHint();
  if (rep.state && rep.state.time !== undefined) W.time = rep.state.time;
  console.log('[abyme] rehydrated report', rep.t, out);
  if (rep.note) setTimeout(() => UI.whisper('Back at: ' + rep.note), 900);
  return true;
}

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
  // #61: on a replay ('begin again') the viewer has seen the approach — arm the skip
  // instantly; a first-time viewer still gets a 1.5s guard against an accidental tap
  setTimeout(() => canvas.addEventListener('pointerdown', skip), instant ? 0 : 1500);
  // #61: the skip was undiscoverable — say it once, early, in the whisper voice
  setTimeout(() => { if (intro && intro.t < intro.dur - 4) UI.whisper(T.click_and_the_sea); }, 4000);
}

function endIntro() {
  intro = null;
  MODE = 'play';
  scene.remove(spray);
  UI.cinematic(false);
  player.spawn(SPAWN_POS, SPAWN_YAW, SPAWN_PITCH); // == the flight's final frame: no cut
  player.locked = false;
  interact.enabled = true;
  UI.whisper(T.the_tide_brought_you);
  UI.showHint();
  W.flags.introDone = true;
  save(player);
}

// shared scratch for the cinematic ticks — they run every frame through the dive/ascent/
// finale, so they must not allocate (GC pauses read as stutter mid-cinematic)
const _cinE = new THREE.Euler(0, 0, 0, 'YXZ');
const _cinQ = new THREE.Quaternion();
const _cinM = new THREE.Matrix4();
const _cinUp = new THREE.Vector3(0, 1, 0);
const _cinV = new THREE.Vector3();

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
  UI.whisper(T.down_is_the_only);
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
    _cinQ.setFromEuler(_cinE.set(-lookDown, player.yaw + f * 0.4, 0));
    camera.quaternion.slerpQuaternions(dive.startQuat, _cinQ, Math.min(1, f * 5));
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
    // Pull whoever is above this rung (a no-op offline, and never awaited — the
    // draft and the evidence re-read the ledger, so strangers appear when they land)
    syncStack(W.level);
    // THE DRAFT (STACK.md §3.2): the rung's authored waterline PLUS everything the
    // rungs above displaced onto it. Solve the surface efficiently and you land in
    // a puddle; brute-force the whole chain and they inherit a flood — same island,
    // same puzzles, less of it above water.
    if (W.level > 1) W.tide = W.tideTarget = tideAt(W.level);
    if (W.level >= 2) W.regions.l2seen = true;
    if (W.level >= 3) W.regions.l3seen = true;
    if (W.level >= 4) W.regions.l4seen = true;
    save(player);
    player.spawn(spawnAboveWater(new THREE.Vector3(L.spawn.pos[0], 0, L.spawn.pos[2])), L.spawn.yaw, L.spawn.pitch);
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
    beginVista(W.level);   // #135: the first sighting holds (re-locks briefly; skippable)
    // the same island, more drowned each time — the sameness is the wound
    UI.whisper({
      2: 'The same sand. The same sky.',
      3: 'The same sand — the colour going out of it.',
      4: 'The same room, gone cold and far. Below it, a light still burns.',
    }[W.level] || 'Down, and down.');
    if (W.level === 2) setTimeout(() => UI.whisper(T.somewhere_above_a_door), 6000);
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
  if (W.level <= 1) { if (!instant) UI.whisper(T.there_is_no_level); return false; }
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
  UI.whisper(T.you_run_the_mechanism);
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
        UI.whisper(T.back_at_the_surface_2);
        UI.addJournal(T.i_have_been_all, '', 'self');
      } else {
        UI.whisper(T.back_at_the_surface_3);
        UI.addJournal(T.i_have_been_all_2, '', 'self');
      }
      // POINT THE WAY OUT: the climb-out terminal (#22) is the dory, ~80 m south on the wake-up
      // beach. Name it, or a player re-dives / rings the bell and never finds the choice the
      // whole fork exists to offer. (The oar also glints on hover once armed; this draws them to it.)
      setTimeout(() => { if (W.level <= 1 && MODE === 'play') UI.whisper(T.down_on_the_beach); }, 6800);
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
      UI.addJournal(T.i_did_not_leave, '', 'self');
    } else {
      // the climb-out without the embrace: he stays below, tending the light; you leave it BURNING
      A.say('keeper_farewell', 'resigned');
      UI.whisper(KEEPER.farewell);
      keeperFarewell = true;
      UI.addJournal(T.i_went_all_the, '', 'self');
    }
  }
  // SEA-STRATA: arriving a level shallower, the sea recedes to that level's tide (surface = 1)
  W.tide = W.tideTarget = (W.level > 1 ? tideAt(W.level) : 1);
  save(player);
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
    _cinQ.setFromEuler(_cinE.set(lookUp, player.yaw - f * 0.4, 0));
    camera.quaternion.slerpQuaternions(ascent.startQuat, _cinQ, Math.min(1, f * 5));
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
      setTimeout(() => UI.whisper(T.his_voice_is_beside), 5200);
    } else if (keeperFarewell) {
      keeperFarewell = false;
      setTimeout(() => UI.whisper(T.below_you_the_voice), 5200);
    }
  }
}

// ---------------- the climb (hub Phase B) ----------------
// The lamp-room stair as a committed fade-crossing up to the gallery and back. The tower is too
// narrow to wind a free-walked multi-turn floor through, so the climb lands you on the walkable
// balcony (W.atTop drives the gallery floor + rail in terrain.js and the foreshadow ring in
// applyAtmosphere). You arrive looking seaward, the whole island open below — and out past the
// shallows, the line the next tide means to rise to. Gated on W.lampLit (you earn it by lighting
// the lamp). Set atTop BEFORE spawn so syncCamera snaps to the gallery height, not the study floor.
function startClimb(up) {
  if (MODE !== 'play') return;
  player.locked = true;
  interact.enabled = false;
  UI.fadeOut(false, false);
  A.duckAmbient(true);
  setTimeout(() => {
    if (up) {
      W.atTop = true;
      player.spawn(new THREE.Vector3(SPOTS.lighthouse.x + 1.6, 0, SPOTS.lighthouse.y - 1.9), 5.59, -0.10);
    } else {
      W.atTop = false;
      player.spawn(new THREE.Vector3(SPOTS.lighthouse.x - 0.8, 0, SPOTS.lighthouse.y - 2.0), 3.49, 0);
    }
    UI.fadeIn(true);
    player.locked = false;
    interact.enabled = true;
    A.duckAmbient(false);
    UI.whisper(up
      ? 'You climb the long stair to the lamp. From up here the whole island lies open — and out past the shallows, the sea shows you the line it means to rise to.'
      : 'Down the stair, back to the working room.');
  }, 850);
}


// #134: assemble THIS player's walk for the ending's read-back coda, then let it
// surface late and quiet (after the terminal's own line has had its beat)
function revealFinaleCoda(kind, delayMs) {
  const s = {
    rounds: ['roundMoor', 'roundLog', 'roundLight', 'roundWind'].filter((k) => W.flags[k]).length,
    filed: Object.values(W.recDisp || {}).filter((d) => d === 'filed').length,
    kept: Object.values(W.recDisp || {}).filter((d) => d === 'kept').length,
    lossesNamed: ['loss_arm', 'loss_bench', 'loss_skiff'].filter((k) => W.onceKeys?.includes(k)).length,
  };
  const el = document.querySelector('#finale .fin-coda');
  if (!el) return;
  el.innerHTML = finaleCoda(kind, s).map((l) => `<div>${l}</div>`).join('');
  setTimeout(() => el.classList.add('show'), delayMs);
}

// #135 (AAA-B1): the VISTA — a stratum's first sighting is a composed, HELD frame:
// cinematic bars + locked control for 2.4s (any input skips), so the arrival lands
// before movement does. The spawn pose IS the composition (LEVELS rows carry it);
// this holds the shot exactly once per stratum. L1's vista is the intro itself.
let vistaT = null;
function releaseVista() {
  if (vistaT == null) return;
  vistaT = null;
  player.locked = false;
  interact.enabled = true;
  UI.cinematic(false);
}
function beginVista(lv) {
  if (lv < 2 || MODE !== 'play' || W.onceKeys?.includes('vista' + lv)) return;
  (W.onceKeys = W.onceKeys || []).push('vista' + lv);
  save(player);
  player.locked = true;
  interact.enabled = false;
  UI.cinematic(true);
  vistaT = 0;
  addEventListener('pointerdown', releaseVista, { once: true });
  addEventListener('keydown', releaseVista, { once: true });
}
addDrive(() => vistaT != null, (dt) => { vistaT += dt; if (vistaT > 2.4) releaseVista(); });

// ---------------- the finale ----------------
// THE DISPOSITION IS PERFORMED HERE (STACK.md §6). Both terminals route through
// this: whatever the player set on the brass index is applied to the LEDGER at the
// moment they take an ending, and the coda says what actually happened using the
// real numbers. Applied once — an ending is terminal, but a double-fire would
// double-seal or double-count the marks it took back.
function performDisposition() {
  if (W._dispDone) return null;
  W._dispDone = true;
  const kind = W.disposition || 'tend';
  const res = disposeStack(kind);
  const line = T['coda_' + kind];
  if (line) UI.addJournal(line.replace('{n}', String(res && res.removed != null ? res.removed : 0)), '', 'self');
  return res;
}

function startFinale() {
  MODE = 'finale';
  performDisposition();
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
  revealFinaleCoda('bell', 5200);
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
  performDisposition();
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
  // a dark sea under the model: farSea is a RingGeometry(310,9000) with a 310-unit hole at
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
  setTimeout(() => { if (finale && finale.kind === 'oar') UI.whisper(T.the_way_out_was); }, 4400);
  // one warm bell-partial as the island becomes a model (the withheld, leitmotif-warm toll)
  setTimeout(() => { if (finale && finale.kind === 'oar') A.bellToll(true); }, 9500);
  revealFinaleCoda('oar', 7000);   // #134: the look-back reads back this player's walk
}

function tickOarFinale(dt) {
  const e = easeInOut(clamp(finale.t / 16, 0, 1));
  // hold a bittersweet golden hour — the night, and its stars, never come
  W.time = lerp(W.time, 17.6, 1 - Math.exp(-dt * 0.5));
  for (let i = 0; i < 5; i++) skyMat.uniforms.uConstelGlow.value[i] = 0;
  // camera: rise and drift seaward off the beach, always looking back at the island
  camera.position.lerpVectors(finale.camStart, finale.camEnd, e);
  _cinQ.setFromRotationMatrix(_cinM.lookAt(camera.position, finale.lookAt, _cinUp));
  camera.quaternion.slerpQuaternions(finale.quatStart, _cinQ, Math.min(1, finale.t * 0.3));
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
  _cinQ.setFromRotationMatrix(_cinM.lookAt(camera.position, _cinV.set(LH.x, lookY, LH.z), _cinUp));
  camera.quaternion.slerpQuaternions(finale.quatStart, _cinQ, Math.min(1, f * 4));
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
// #28 shadow-freeze state: where the map was last drawn from
const _shadowAt = new THREE.Vector3(1e9, 0, 0);
const _shadowSun = new THREE.Vector3(0, 1, 0);
let _shadowHatch = null, _shadowLevel = null, _shadowTop = null;
const MOONLIGHT = new THREE.Color(0x9fb8d9);
const swayMats = ['grass', 'canopies']
  // #30: grass is a GROUP of culling chunks now — the shared material lives on its children
  .map((n) => { const o = core.children.find((c) => c.name === n); return o?.material || o?.children?.[0]?.material; })
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
// Land the player where the water ACTUALLY is (STACK.md §3.2).
//
// Every LEVELS spawn was authored against that level's authored waterline, and the
// L2 arrival is tuned fine: your eye clears the surface by about 27 cm, so you wade
// in ankle-deep and can see. Under the DRAFT the sea can stand higher than the
// author planned — and 0.56 m of inherited water was enough to spawn the camera
// UNDERWATER, in a game with no swimming. (Found by playtesting the frame, not by
// any assertion: the numbers were all correct.)
//
// Capping the draft would make the law toothless, so instead the arrival moves:
// search outward from the authored point for the nearest gently-sloped, walkable
// spot whose EYE clears the surface. With an empty stack the authored point already
// qualifies and is returned untouched — a first-time player's arrival is unchanged.
// It is also the right image: the more water you displaced, the further up the
// shore the tide sets you down.
function spawnAboveWater(pos, eye = 1.65) {
  const clears = (x, z) => walkableY(x, z) + eye > waterY() + 0.3;
  if (clears(pos.x, pos.z)) return pos;
  const e = 0.7;
  const gentle = (x, z) => Math.hypot(
    heightAt(x + e, z) - heightAt(x - e, z),
    heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e) < 0.9;
  for (let R = 1.5; R <= 40; R += 1.5) {
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const x = pos.x + Math.cos(a) * R, z = pos.z + Math.sin(a) * R;
      if (clears(x, z) && gentle(x, z)) return new THREE.Vector3(x, 0, z);
    }
  }
  return pos;   // nowhere dry within 40 m: keep the authored point rather than teleport wildly
}

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

// #58: the 12s autosave used to be the ONLY writer, so closing the tab could
// throw away up to 12s of play (and, before v3, the facing never persisted at
// all). Flush a save when the page goes away — pagehide for real closes and
// navigations, visibilitychange→hidden for tab switches and the mobile-Safari
// cases where pagehide never fires. Same guard as the timer: only mid-play,
// never poised on the brink of a dive (the journal will not follow you down).
const flushSave = () => { if (MODE === 'play' && !game.atBrink()) save(player); };
addEventListener('pagehide', flushSave);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushSave(); });

function applyAtmosphere(elapsed, dt) {
  const g = gradeAt(W.time);
  renderer.toneMappingExposure = g.exposure; // per-grade tone (#2): noon airy, night crushed
  sunDir(W.time, _sunV);
  moonDir(W.time, _moonV);
  const el = sunElevation(W.time);
  const night = clamp((-el - 0.02) / 0.18, 0, 1);

  // green flash: the sun crossing the sea while time is being wound. The upper bound
  // (#44) gates SCRUBS out: a debug-slider jump crosses the horizon by whole hours in
  // one frame and used to fire the flash absurdly — a real crank flick stays under it.
  if (Math.sign(el) !== Math.sign(prevEl) && Math.abs(el - prevEl) > 0.00012 && Math.abs(el - prevEl) < 0.2) flash = 1;
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
      game.once('coatScent', () => UI.whisper(T.salt_and_lamp_oil));
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
        game.once('nestedLight', () => UI.whisper(T.far_down_a_light));
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
            UI.whisper(T.there_you_are_a);
            // the discovery lands in the journal, not just the air — and names the abyme
            // without naming who you are (fork-neutral: self-recognition, not identity).
            UI.addJournal(T.a_mark_has_appeared, '', 'self');
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
  wu.uSkyTop.value.copy(g.skyTop);   // #42: the fresnel sky-mirror grades horizon→zenith with the reflection ray
  wu.uFogColor.value.copy(g.fog);
  wu.uFogDen.value = g.fogDen;
  wu.uNight.value = night;

  // farSea shares the water material's uniform objects — the wu.* writes above drive it
  farSea.position.y = waterY() - 0.15;

  // (the foreshadow ring is a #73 drive now, registered beside the wiring)

  // the drain's flood rises with the depth you carry (Phase C, flood-per-depth): below the chamber
  // floor (4.0) at the surface, drowning the room by the bottom. The floor stays walkable throughout.
  if (refs.drainFlood) refs.drainFlood.position.y = 3.5 + 3.5 * (W.level - 1) / (MAX_DEPTH - 1);

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
  // the Vault Beneath is INTERIOR backstage: its 44m cavern (and the black water + inverted
  // lighthouse inside) stands far taller than the low coast east of the bluff, so from the
  // west shore the whole box loomed on the horizon as a fog-grey monolith (pre-existing bug,
  // caught in this pass). It is only ever legitimately seen through the cellar's east window
  // — render it only while the player is actually down in the cellar. (The model clone prunes
  // vaultVista, so this drives the real island only.)
  const inCellar = Math.abs(player.pos.x - SPOTS.hatch.x) < 6.5 &&
    player.pos.z > SPOTS.hatch.y - 18.5 && player.pos.z < SPOTS.hatch.y + 1.5 &&
    player.pos.y < 23.2;
  if (refs.vaultVista) refs.vaultVista.visible = inCellar;
  // slow drips falling the height of the void — scale cues (vanish at the water,
  // reappear at the roof); only while the vault is open AND you're down there to see it
  // (emissive drips would otherwise hang in the open sky where the hidden cavern stood)
  if (vaultDrips) {
    // hidden during any finale: the oar terminal's sea look-back would otherwise expose this
    // cellar backstage (a returned player has hatchOpen=true, so this drive re-shows it)
    vaultDrips.visible = W.flags.hatchOpen && MODE !== 'finale' && inCellar;
    if (W.flags.hatchOpen) for (const d of vaultDrips.children) {
      const u = d.userData;
      u.phase = (u.phase + dt * u.speed) % 1;
      d.position.y = lerp(45, 13.9, u.phase);
      d.scale.setScalar(clamp(Math.min(u.phase / 0.07, (1 - u.phase) / 0.07), 0, 1));
    }
  }
  // the keeper's lamp burns one level down, with a faint lamp-oil flicker — and stays
  // warm after the return (integration relights the hearth: "two lights now")
  keeperLamp.intensity = ((W.level >= 2 || W.flags.returned) ? 26 : 0) * (1 + 0.05 * Math.sin(elapsed * 6.3));
  // the jetty beacon: a low warm glow by day, a real beacon by night
  jettyLamp.intensity = lerp(3, 20, night) * (1 + 0.07 * Math.sin(elapsed * 4.7));

  // #27: lights leave the shader entirely while dark (see POINT_LIGHTS note)
  for (const L of POINT_LIGHTS) L.visible = L.intensity > 0.01;

  // #28: freeze the 1024² shadow pass while nothing it can see has changed — no dynamic
  // object casts, so the map only needs redrawing when the shadow CAMERA moves (it rides
  // the player), the sun swings (>~0.15°), the big toggles flip, or a cinematic owns the
  // frame. Standing still reading lore no longer redraws ~110k caster tris every frame.
  const shadowDirty =
    MODE !== 'play' ||
    camera.position.distanceToSquared(_shadowAt) > 0.25 ||
    _sunV.angleTo(_shadowSun) > 0.0026 ||
    W.flags.hatchOpen !== _shadowHatch || W.level !== _shadowLevel || W.atTop !== _shadowTop;
  if (shadowDirty) {
    renderer.shadowMap.needsUpdate = true;
    _shadowAt.copy(camera.position);
    _shadowSun.copy(_sunV);
    _shadowHatch = W.flags.hatchOpen; _shadowLevel = W.level; _shadowTop = W.atTop;
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
    if (r?.material?.uniforms) {
      r.material.uniforms.uTime.value = elapsed;
      if (r.material.uniforms.uMist) r.material.uniforms.uMist.value = mistCur;   // #44: the shaft brightens in fog
    }
  }
  for (const m of swayMats) {
    const sh = m.userData.shader;
    if (sh) {
      sh.uniforms.uTime.value = elapsed;
      if (sh.uniforms.uHaze) sh.uniforms.uHaze.value.copy(scene.fog.color);
    }
  }
  // terrain aerial perspective (#5a): far land melts toward the grade's haze —
  // plus the waterline pass (#47/#38): tide line + caustics ride the live tide
  if (terrainMat?.userData.shader) {
    const tu = terrainMat.userData.shader.uniforms;
    tu.uHaze.value.copy(scene.fog.color);
    tu.uWaterY.value = waterY();
    tu.uTime.value = elapsed;
    tu.uSunUp.value = clamp((_sunV.y + 0.02) / 0.14, 0, 1);
  }


  // sky follows the camera
  sky.position.set(camera.position.x, 0, camera.position.z);
}

// ---------------- gulls ----------------
// at dawn the first gull leaves the gyre and takes the gallery rail,
// east side, facing the sun — wings folded, riding the keeper's view
const GULL_PERCH = new THREE.Vector3(LH.x + 3.05, LH.y + 21.95, LH.z);
let perchT = 0;
let perchCried = false;   // #64: one cry as the dawn percher takes the rail

function tickGulls(elapsed, dt) {
  const day = 1 - clamp((-sunElevation(W.time) - 0.02) / 0.15, 0, 1);
  const wantPerch = isDawn() && MODE !== 'dive';
  perchT = clamp(perchT + (wantPerch ? dt / 4.5 : -dt / 3), 0, 1);
  const settle = easeInOut(perchT);
  // #64: the wheeling flock finally has a voice — sparse far cries by day, surface only
  // (~one across the flock every half-minute; distance to the gyre scales the volume)
  if (day > 0.5 && MODE === 'play' && W.level === 1 && Math.random() < dt * 0.033) {
    const g = gulls[(Math.random() * gulls.length) | 0];
    const d = Math.hypot(g.position.x - player.pos.x, g.position.z - player.pos.z);
    A.gullCry(clamp(0.26 * (1 - d / 220), 0.03, 0.26), { x: g.position.x, z: g.position.z, ref: 40 });   // #63: from the bird itself
  }
  // #64: the dawn percher announces the rail (the keeper's-view beat gets its sound)
  if (settle > 0.6 && !perchCried && MODE === 'play') { perchCried = true; A.gullCry(0.18, { x: GULL_PERCH.x, z: GULL_PERCH.z, ref: 40 }); }
  if (settle < 0.2) perchCried = false;
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
      // #64: the lone caw of an island gone quiet — rare, and only within earshot
      if (u.species === 'crow' && d < 60 && Math.random() < dt * 0.008) {
        A.crowCaw(clamp(0.22 * (1 - d / 70), 0.04, 0.22), undefined, { x: u.px, z: u.pz, ref: 30 });   // #63
      }
      if (d < 3.6) {
        u.flush = 0.001;                                   // startle → flush
        // #64: the burst-up finally makes a sound — a close startled cry
        if (u.species === 'crow') A.crowCaw(0.3, true, { x: u.px, z: u.pz, ref: 20 }); else A.gullCry(0.3, { x: u.px, z: u.pz, ref: 20 });   // #63
      }
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
    // wings: swept-back/folded at rest, snap open + flap fast on takeoff (spread leads the
    // climb). Rest pose = the FOLD_* constants from addWings; chord stretches back out as
    // the wing opens.
    if (g.lw) {
      const spread = u.flush === 0 ? 0 : clamp(u.flush * 5, 0, 1);
      const flap = 0.18 + Math.sin(elapsed * 22 + u.ph) * 0.72;
      g.rw.rotation.y = lerp(FOLD_Y, 0, spread); g.rw.rotation.z = lerp(-FOLD_Z, flap, spread);
      g.lw.rotation.y = lerp(-FOLD_Y, 0, spread); g.lw.rotation.z = lerp(FOLD_Z, -flap, spread);
      g.lw.scale.z = g.rw.scale.z = lerp(FOLD_CHORD, 1, spread);
    }
  }
}

// ---------------- footsteps ----------------
player.onRescue = () => UI.whisper(T.the_ground_gives_you);
player.onFootstep = (kind, pos) => {
  A.footstep(kind);
  // wet seabed sparkles underfoot
  if ((1 - W.tide) > 0.5 && heightAt(pos.x, pos.z) < 0) {
    biolume.material.uniforms.uFlare.value = 9;
    setTimeout(() => { biolume.material.uniforms.uFlare.value = 6; }, 350);
  }
};

// ---------------- debug ----------------
{
  // The debug panel + ABYME hooks are built for ALL builds now (owner request: backtick (`) opens
  // debug even without ?debug — the panel just starts hidden for players). The GPU timer stays
  // DEBUG-only: its timer-query polling costs real GPU time, so players never pay for it.
  if (DEBUG) gpuTimer = makeGpuTimer(renderer); // Power Ledger: real GPU-frame-ms in the debug readout
  window.ABYME = { player, W, camera, scene, core, refs, modelRefs, renderer, game, THREE, UI, composer, bloomPass,
    bench: (t = 12) => { W.time = t; player.spawn(SPAWN_POS, SPAWN_YAW, SPAWN_PITCH); }, // fixed Power-Ledger pose
    gpuMs: () => (gpuTimer ? +gpuTimer.ms.toFixed(2) : null),
    gpuMode: () => (gpuTimer ? gpuTimer.mode : null),
    tp: (x, z, yaw = 0, pitch = 0) => player.spawn(new THREE.Vector3(x, 0, z), yaw, pitch),
    // THE STACK (STACK.md) — inspect what the rungs above displaced onto this one.
    // hand = who you are to the stack; ledger() = the raw marks; draft(n) = the
    // inherited water in tide units; tideAt(n) = baseline + draft; evidence(n) =
    // the inherited marks worth rendering (slice 4).
    hand: HAND, ledger, draft, tideAt, hands, evidence, clearStack, syncStack, isShared,
    // collision oracle for tools/harness/probe.mjs — the playtest probe hunts
    // phantom walls and fall-throughs, and blaming one needs the raw rules.
    terrain: { walkableY, wallBlocked, heightAt, colliders, GATES, SPOTS },
    // Draw every collider footprint as a red ring laid on the walkable surface.
    // The playtest question "is this wall real?" is only answerable by seeing the
    // collision and the geometry in the same frame. Debug-only, built on demand.
    showColliders: (on = true) => {
      let g = scene.getObjectByName('__colliderViz');
      if (g) { scene.remove(g); g.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); }); }
      if (!on) return 0;
      g = new THREE.Group(); g.name = '__colliderViz';
      const mat = new THREE.MeshBasicMaterial({ color: 0xff2244, wireframe: true, depthTest: false, transparent: true, opacity: 0.9 });
      for (const c of colliders()) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(c.r, c.r, 0.1, 20, 1, true), mat);
        m.position.set(c.x, walkableY(c.x, c.z) + 0.6, c.z);
        m.renderOrder = 999;
        g.add(m);
      }
      scene.add(g);
      return colliders().length;
    },
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
      syncStack(n);
      W.tide = W.tideTarget = tideAt(n);               // raised tide + inherited draft (set both: skip the 13s ease)
      if (n >= 2) W.regions.l2seen = true;
      if (n >= 3) W.regions.l3seen = true;
      if (n >= 4) W.regions.l4seen = true;
      player.spawn(spawnAboveWater(new THREE.Vector3(L.spawn.pos[0], 0, L.spawn.pos[2])), L.spawn.yaw, L.spawn.pitch);
      save(player);
      beginVista(n);   // #135: instant jumps get the held first-sighting too (once)
      return { level: n, id: L.id, region: L.region, tide: L.tide, encounter: L.encounter };
    },
    dive: (instant = false) => {                       // the missing counterpart to ascend()
      if (W.level >= MAX_DEPTH) { UI.whisper(T.already_at_the_bottom); return false; }
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
    // --- THE FIELD REPORT (debug-together, owner request 2026-08-01) ---
    // One click captures WHAT YOU SEE: exact pose, mode, the full save payload, perf
    // numbers — copied to the clipboard, downloaded as JSON (with a screenshot inside),
    // and kept in a localStorage ring (abyme-reports, last 10) so an agent driving the
    // same browser can read reports directly. applyReport() restores the whole thing:
    // paste a report and stand exactly where the reporter stood, seeing what they saw.
    report: (note = '', withShot = true) => {
      save(player);
      let shot = null;
      if (withShot) {
        try {
          if (bloomPass.enabled) composer.render(); else renderer.render(scene, camera);   // no preserveDrawingBuffer: render in the same frame
          shot = renderer.domElement.toDataURL('image/jpeg', 0.7);
        } catch (e) { shot = null; }
      }
      const rep = {
        v: 1, t: new Date().toISOString(), note,
        pos: [player.pos.x, player.pos.y, player.pos.z].map((n) => +n.toFixed(2)),
        yaw: +player.yaw.toFixed(3), pitch: +player.pitch.toFixed(3),
        mode: MODE,
        state: window.ABYME.state(),
        perf: { fps: +fps.toFixed(0), draws: renderer.info.render.calls, tris: renderer.info.render.triangles,
          gpuMs: gpuTimer ? +gpuTimer.ms.toFixed(1) : null, dpr: renderer.getPixelRatio() },
        ua: navigator.userAgent,
        save: JSON.parse(localStorage.getItem('abyme-save-v1') || 'null'),
      };
      const lean = JSON.stringify(rep);                     // the paste-to-chat blob (no screenshot)
      try { navigator.clipboard?.writeText(lean); } catch (e) {}
      try {
        const ring = JSON.parse(localStorage.getItem('abyme-reports') || '[]');
        ring.push(rep); while (ring.length > 10) ring.shift();
        localStorage.setItem('abyme-reports', JSON.stringify(ring));
      } catch (e) {}
      try {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([JSON.stringify({ ...rep, shot }, null, 1)], { type: 'application/json' }));
        a.download = `abyme-report-${rep.t.replace(/[:.]/g, '-')}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      } catch (e) {}
      UI.whisper(T.field_report_taken_copied);
      return rep;
    },
    applyReport: (rep) => {                              // stand where the reporter stood
      if (typeof rep === 'string') rep = JSON.parse(rep);
      if (rep.save) {
        localStorage.setItem('abyme-save-v1', JSON.stringify(rep.save));
        if (load()) {
          const STEM_FLAGS = { 1: 'valveTurned', 2: 'rulerPlaced', 3: 'birdSolved', 4: 'hatchOpen', 5: 'glyphsSeen', 6: 'keeperSong' };
          for (const [n, f] of Object.entries(STEM_FLAGS)) if (W.flags[f]) A.addStem(+n);
        }
      }
      if (rep.pos) player.spawn(new THREE.Vector3(rep.pos[0], 0, rep.pos[2]), rep.yaw ?? 0, rep.pitch ?? 0);
      player.locked = false; interact.enabled = true; MODE = 'play';
      return { at: rep.pos, level: W.level, note: rep.note || '' };
    },
    // Reports live in localStorage, which is scoped PER ORIGIN — one filed on the
    // deployed site is invisible on localhost and vice versa. This is the way across:
    // paste the blob F8 put on your clipboard (or the contents of the downloaded
    // JSON) and it joins this browser's ring, addressable by ?report=<t> like any
    // other. Screenshots are dropped: the ring has never stored them.
    importReport: (x) => {
      let rep = x;
      if (typeof rep === 'string') rep = JSON.parse(rep);
      if (!rep || !rep.pos || !rep.t) throw new Error('that does not look like a field report');
      delete rep.shot;
      const ring = JSON.parse(localStorage.getItem('abyme-reports') || '[]');
      if (!ring.some((r) => r.t === rep.t)) ring.push(rep);
      while (ring.length > 10) ring.shift();
      localStorage.setItem('abyme-reports', JSON.stringify(ring));
      return rep.t;
    },
    reports: () => JSON.parse(localStorage.getItem('abyme-reports') || '[]'),
    resetFlags: () => {                                 // in-world soft reset (no reload) for replaying chains
      Object.keys(W.flags).forEach((k) => { W.flags[k] = false; });
      W.level = 1; W.tide = W.tideTarget = 1; W.stems = 0;
      W.lensPlaced = false; W.beamAngle = 2.2; W.dials = [0, 0, 0, 0]; W.inventory = [];
      W.onceKeys = []; W.readKeys = [];
      W.regions = { l2seen: false, l3seen: false, l4seen: false, fragmentsFound: [] };
      save(player);
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
        // THE STACK (STACK.md §3.2): what the rungs above displaced onto this one.
        // draft is in tide units — tideAt() is the tide this rung ACTUALLY sits at,
        // its authored LEVELS baseline plus everything inherited.
        stack: {
          hand: handId(), shared: isShared(), draft: +draft().toFixed(3), tideAt: +tideAt().toFixed(3),
          hands: hands(), marks: ledger().marks.length, evidence: evidence().length,
        },
        flags: ['rulerPlaced', 'birdSolved', 'glyphsSeen', 'hatchOpen', 'plumbHung', 'dove', 'climbing', 'returned', 'keeperRose', 'carried', 'watcherSeen', 'tideFigureSeen', 'bellRung', 'readGlass', 'phialTaken', 'phialDried', 'beamDeepSeen', 'keeperSong'].filter((k) => F[k]),
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
    markLore: () => { W.readKeys = ['keeper_logbook', 'coat_letter', 'stone_inscription', 'music_note', 'bottle_note', 'quarters_journal', 'lens_mark_study', 'lens_mark_stone', 'kelp_slate', 'bluff_cairn', 'source_note', 'pool_phial', 'model_margin', 'drain_ledger', 'commendation_copy', 'closure_notice', 'field_slip', 'transfer_offer']; },
    clearLore: () => { W.readKeys.length = 0; },
    readLog: () => UI.openReader('keeper_logbook'), readQ: () => UI.openReader('quarters_journal'),
    fragAdd: () => { W.regions.fragmentsFound.push('test-' + W.regions.fragmentsFound.length); },
    fragClear: () => { W.regions.fragmentsFound.length = 0; },
    clrRegions: () => { W.regions.l2seen = W.regions.l3seen = W.regions.l4seen = false; },
    saveNow: () => save(player), wipe: () => { wipe(); location.reload(); }, reset: () => A.resetFlags(),
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
    <div id="dbg-hdr"><span id="dbg-hide" title="Hide the panel — backtick (\`) toggles it back">▾ hide</span><span class="dim"> · press \` to toggle</span><button id="dbg-report" title="Capture pose + full game state + a screenshot: copied to clipboard, downloaded, remembered (F8 works anywhere)">⚑ field report</button></div>
    <div id="dbg-state-1"></div><div id="dbg-state-2"></div>
    <label class="dbg-sl">time <input type="range" id="dbg-time" min="0" max="24" step="0.05" title="Sun clock 0–24h"><span id="dbg-time-v"></span></label>
    <label class="dbg-sl">tide <input type="range" id="dbg-tide" min="0" max="2" step="0.05" title="Sea level — 0 drained · 1 high · 2 fully raised (>1 = raised strata sea)"><span id="dbg-tide-v"></span></label>
    ${groups.map(grp).join('')}
    <div id="dbg-fps"></div>`;
  document.body.appendChild(el);
  el.style.display = DEBUG ? '' : 'none';   // players: hidden by default, revealed with backtick (`)
  // hide/show the panel (owner request): the "hide" header collapses it; backtick (`) toggles it back.
  const hideBtn = el.querySelector('#dbg-hide');
  if (hideBtn) hideBtn.addEventListener('click', () => { el.style.display = 'none'; });
  addEventListener('keydown', (e) => {
    if (e.code === 'Backquote') { e.preventDefault(); el.style.display = (el.style.display === 'none') ? '' : 'none'; }
    // the field report works from ANYWHERE, panel open or not (debug-together).
    if (e.code === 'F8') { e.preventDefault(); askNote(); }
  });
  el.querySelector('#dbg-report')?.addEventListener('click', () => askNote());
  // --- LEAVING A NOTE ---------------------------------------------------------
  // The report payload has carried a `note` field since it was written, and until now
  // NOTHING COULD FILL IT: both triggers passed a hardcoded ''. The original attempt
  // used prompt(), embedded browser panes block modal dialogs silently, and the fix
  // was to drop the note rather than replace the input — so the one field that says
  // what is actually wrong always arrived empty, and the owner reasonably could not
  // find where to type. This is that input, as a DOM overlay we own and no pane can
  // swallow.
  //
  // The screenshot is unaffected by the overlay: toDataURL reads the WebGL canvas,
  // and this is DOM on top of it. So the report can be assembled on submit and still
  // shows the world exactly as it looked when F8 was pressed.
  const noteEl = document.getElementById('note-overlay');
  const noteText = document.getElementById('note-text');
  let noteWasLocked = false;
  const closeNote = () => {
    if (!noteEl) return;
    noteEl.hidden = true;
    player.locked = noteWasLocked;          // hand movement back exactly as we found it
  };
  const askNote = () => {
    if (!noteEl || !noteText) { A.report(''); return; }   // never lose a report to a missing overlay
    if (!noteEl.hidden) return;
    noteWasLocked = player.locked;
    player.locked = true;                   // freeze the world while they type
    try { document.exitPointerLock?.(); } catch (_) {}
    noteText.value = '';
    noteEl.hidden = false;
    setTimeout(() => noteText.focus(), 0);
  };
  const sendNote = () => {
    const note = (noteText?.value || '').trim();
    closeNote();
    const rep = A.report(note);
    // stamp the URL so a plain REFRESH lands back in this exact frame. This is what
    // makes the loop work: report a bug, keep playing, and when a fix ships just
    // reload to check the same spot rather than trying to walk back to it.
    try {
      const u = new URL(location.href);
      u.searchParams.set('report', rep.t);
      history.replaceState(null, '', u);
    } catch (_) {}
  };
  noteEl?.querySelector('#note-send')?.addEventListener('click', sendNote);
  noteEl?.querySelector('#note-cancel')?.addEventListener('click', closeNote);
  noteText?.addEventListener('keydown', (e) => {
    e.stopPropagation();                    // never let W/A/S/D typed into the note walk the player
    if (e.code === 'Enter' && !e.shiftKey) { e.preventDefault(); sendNote(); }
    if (e.code === 'Escape') { e.preventDefault(); closeNote(); }
  });

  const tslider = el.querySelector('#dbg-time'); tslider.value = W.time;
  tslider.addEventListener('input', () => { W.time = parseFloat(tslider.value); });
  const dslider = el.querySelector('#dbg-tide'); dslider.value = W.tide;
  dslider.addEventListener('input', () => { W.tide = W.tideTarget = parseFloat(dslider.value); });
  el.addEventListener('click', (e) => { const act = e.target?.dataset?.act; if (act && acts[act]) acts[act](); });
  setInterval(() => {
    if (el.style.display === 'none') return;   // skip readout work while hidden (near-zero cost for players)
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

// power policy (owner directive): the island only needs 60fps. The frame governor is a
// fixed-rate ACCUMULATOR (perf #33): each rendered tick books exactly one 60Hz interval
// (nextTickMs += 16.67) and CARRIES THE REMAINDER, so every refresh rate averages 60 —
// the old flat "delta < 12.5ms" gate aliased against the display interval and gave 45fps
// on 90Hz panels and 72fps on 144Hz. TICK_SLOP absorbs rAF timestamp jitter so a true
// 60Hz display still renders every one of its frames (the very stutter the 12.5ms gate
// existed to avoid), while staying under half a 120Hz interval so high-Hz panels keep
// skipping. After a stall (hidden tab, GC) the schedule clamps to "now" — no banked debt,
// no burst of catch-up frames. Resolution is fixed (see BASE_DPR) — no per-frame
// setPixelRatio, no framebuffer-realloc hitches.
const TICK_MS = 1000 / 60;
const TICK_SLOP_MS = 4;
let nextTickMs = 0;
let mistCur = 0;

// gate the 1:240 chart-table model (perf #26): the clone costs ~270k tris yet lives INSIDE
// the tower — invisible from almost everywhere on the island. In play mode show it only when
// the player is within 30m of the lighthouse; every model interaction happens at the chart
// table (model hotspots crack/lensSlot/beamAim all maxDist ≤ 3.2m, plate demands standing on
// it), so 30m has huge slack. Non-play modes keep it visible: the dive/ascent zoom THROUGH
// the model, and the intro/finale cameras roam free. Squared x/z distance, re-checked at 4Hz
// (or immediately on a mode change) — no sqrt, no per-frame work.
const MODEL_GATE_R2 = 30 * 30;
let modelGateTimer = 0, modelGateMode = null;
let treeLodTimer = 0;   // #6: the distant-tree repartition clock
function tickModelGate(dt) {
  modelGateTimer -= dt;
  if (modelGateTimer > 0 && MODE === modelGateMode) return;
  modelGateTimer = 0.25;
  modelGateMode = MODE;
  const dx = player.pos.x - SPOTS.lighthouse.x, dz = player.pos.z - SPOTS.lighthouse.y;
  modelRoot.visible = MODE !== 'play' || (dx * dx + dz * dz < MODEL_GATE_R2);
}

renderer.setAnimationLoop((tMs) => {
  const nowMs = tMs ?? performance.now();
  if (nowMs < nextTickMs - TICK_SLOP_MS) return; // 60fps cap, remainder-carrying (see above)
  nextTickMs = Math.max(nextTickMs + TICK_MS, nowMs); // book one tick; a stall re-bases, never banks debt
  renderer.info.reset();                 // autoReset is off — one reset per tick = whole-frame stats
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  fps = lerp(fps, 1 / Math.max(dt, 1e-4), 0.05);

  // #77: collision reads GATES, not W — one unmissable sync at the top of the frame
  syncGates(W);
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
  runDrives(W, dt, elapsed);   // #73: the self-gating per-entity drives
  tickModelGate(dt);
  // #6: re-aim the tree LOD at the player every ~0.35s (hysteresis lives in the partition)
  treeLodTimer -= dt;
  if (treeLodTimer <= 0 && core.userData.treeLod) {
    treeLodTimer = 0.35;
    core.userData.treeLod(player.pos.x, player.pos.z);
  }
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
    dawn: isDawn() ? 1 : 0,     // #64: the dawn chorus window
    level: W.level,             // #64: crickets/chorus are surface life — the deep stays thinned
    px: player.pos.x, pz: player.pos.z, yaw: player.yaw,   // #63: the spatial pose — one-shots pan from this
    mist: mistCur,
  });

  // autosave — but not while poised on the brink of a dive: the journal will
  // not follow you down, so the world stops recording as you cross the threshold
  if (MODE === 'play' && !game.atBrink()) {
    saveTimer += dt;
    if (saveTimer > 12) { saveTimer = 0; save(player); }
  }

  if (gpuTimer) gpuTimer.beginFrame();
  if (bloomPass.enabled) composer.render();   // bloomPass.enabled is the on/off lever (debug + perf fallback)
  else renderer.render(scene, camera);
  if (gpuTimer) gpuTimer.endFrame();
});

// The card that comes up when ?report= finds nothing. Kept next to rehydrateFromReport
// because they are one feature: the URL either lands you in the frame, or it tells you
// precisely why it could not and hands you the way through.
function offerImport(asked, ringSize) {
  const el = document.getElementById('import-overlay');
  const ta = document.getElementById('import-text');
  const why = document.getElementById('import-why');
  if (!el || !ta) { console.warn('[abyme] ?report=' + asked + ' matched nothing'); return; }
  why.textContent = ringSize === 0
    ? `This browser has no reports at all, and ?report=${asked} asked for one. Reports are stored per site — one you filed on a different address (the deployed site vs. localhost) is not visible here.`
    : `No report here matches "${asked}". This browser holds ${ringSize}; try ?report=last, or paste the one you want.`;
  el.hidden = false;
  setTimeout(() => ta.focus(), 0);
  const close = () => { el.hidden = true; };
  const go = () => {
    const raw = (ta.value || '').trim();
    if (!raw) { close(); return; }
    try {
      const t = window.ABYME.importReport(raw);
      const u = new URL(location.href);
      u.searchParams.set('report', t);
      location.replace(u.toString());        // reload straight into it
    } catch (e) {
      why.textContent = 'That did not parse as a field report: ' + e.message;
    }
  };
  el.querySelector('#import-go').addEventListener('click', go);
  el.querySelector('#import-skip').addEventListener('click', close);
  ta.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.code === 'Enter' && !e.shiftKey) { e.preventDefault(); go(); }
    if (e.code === 'Escape') { e.preventDefault(); close(); }
  });
}

// ---- and finally: ?report= --------------------------------------------------
// Deliberately the LAST thing this module does. window.ABYME is assigned in the debug
// block above, so rehydrating any earlier means reaching for a game surface that does
// not exist yet — which is exactly how the first version of this broke the page.
rehydrateFromReport();
