// Beacon — a lighthouse watch, rendered in WebGL.
//
// The 2D build drew the sea as sine lines and faked perspective by squashing a
// circular field (FIELD_KY). That hand-rolled projection is gone: a real camera
// does it correctly, and the sea is now the island's open-ocean shader, which
// carries its own facets, sky-mirror Fresnel, fog lane and moon glitter road.
//
// The GAME did not need porting. Ships were always polar — (angle, distance)
// around the lantern — so they map straight to world space as
// (cos a * d, 0, sin a * d). The beam test, the wreck radius and the wave logic
// below are unchanged from the canvas build.

import * as THREE from 'three';
import { makeFarSeaMaterial, makeBeamMaterial } from './sea.js';

// ── Ship definitions ──────────────────────────────────────
// The outlines are the canvas build's own silhouettes, reused as extruded hulls so
// the fleet keeps its drawn identity instead of being replaced with primitives.
const HULLS = {
  cargo:     [[-30,10],[-28,-8],[-10,-8],[-8,-18],[5,-18],[7,-8],[15,-8],[15,-14],[22,-14],[22,-8],[30,-5],[28,10]],
  passenger: [[-35,8],[-30,-5],[-25,-10],[20,-10],[25,-5],[35,2],[30,8]],
  military:  [[-28,6],[-24,-4],[-5,-4],[-3,-14],[3,-14],[5,-4],[28,2],[25,6]],
  fishing:   [[-18,8],[-14,-2],[2,-2],[4,-16],[6,-16],[6,-2],[18,4],[15,8]],
  pirate:    [[-25,10],[-20,-2],[-3,-2],[-2,-22],[2,-22],[2,-2],[25,6],[20,10]],
};

const SHIP_TYPES = {
  cargo:     { name:'Cargo',     signal:['green','green'],         hue:0x8b6914 },
  passenger: { name:'Passenger', signal:['green'],                 hue:0x3b82f6 },
  military:  { name:'Military',  signal:['white','white'],         hue:0x64748b },
  fishing:   { name:'Fishing',   signal:['white'],                 hue:0x0d9488 },
  pirate:    { name:'Pirate',    signal:['red','red','red'],       hue:0x7f1d1d },
};
const TYPE_KEYS = Object.keys(SHIP_TYPES);

// ── World scale ───────────────────────────────────────────
// Metres, lantern at the origin. Ships appear at SPAWN and are lost on the rocks
// at SAFE — the same 0.27 ratio the canvas build used.
const SPAWN = 150, SAFE = 40;
const R = SPAWN, SPAWN_R = 1, SAFE_R = SAFE / SPAWN;

// ── Game state (unchanged from the canvas build) ──────────
let beam = { angle: 0, speed: 0.012, width: 0.28 };
let ships = [];
let signalQueue = [];
let signalFlashTimer = 0;
let signalFlashColor = null;
let score = 0, saved = 0, wrecks = 0, maxWrecks = 5, wave = 1;
let spawnTimer = 0, spawnInterval = 180;
let running = false, gameOver = false;
let time = 0;

// ── Resize ────────────────────────────────────────────────
// Ships whose mesh must leave the scene on the next sync.
const removed = [];

function spawnShip() {
  const typeIdx = Math.floor(Math.random() * Math.min(TYPE_KEYS.length, 2 + Math.floor(wave / 2)));
  const typeKey = TYPE_KEYS[typeIdx];
  const type = SHIP_TYPES[typeKey];
  const angle = Math.random() * Math.PI * 2;
  ships.push({
    typeKey, type,
    angle,
    distance: R * SPAWN_R,
    speed: (0.15 + Math.random() * 0.15 + wave * 0.02) * (R / 405),   // keep crossing time constant as the field grows
    lit: 0, // how visible (0-1, decays)
    signaled: false,
    wrecked: false,
    safeDistance: R * SAFE_R,
    seen: false,        // has the beam ever identified this ship?
    opacity: 1,
  });
}


// ── Scene ─────────────────────────────────────────────────
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setClearColor(0x03060f, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.62;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, 1, 0.5, 6000);
// Behind and above the lantern, looking out to sea. High enough that vessels on
// every bearing stay in frame — the beam still sweeps a full circle.
camera.position.set(0, 58, 176);
camera.lookAt(0, 40, -70);

// Sprites need a map. Without one THREE draws an opaque square, which is exactly
// what the first WebGL pass put over the sea and on every running light.
const GLOW_TEX = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d').createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0.00, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(1.00, 'rgba(255,255,255,0)');
  const ctx2 = c.getContext('2d');
  ctx2.fillStyle = g; ctx2.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();

const MOON_DIR = new THREE.Vector3(0.42, 0.26, -0.87).normalize();

// Shared uniform bundle: sea and sky read the same night, so they cannot disagree
// about where the moon is or how thick the air is.
const wu = {
  uTime:     { value: 0 },
  uSunDir:   { value: MOON_DIR.clone() },
  uSunCol:   { value: new THREE.Color(0x8ea6d8) },   // moonlight is the only source here
  uDeep:     { value: new THREE.Color(0x061726) },
  uShallow:  { value: new THREE.Color(0x113347) },
  uSkyCol:   { value: new THREE.Color(0x1b3554) },   // what grazing reflections see
  uSkyTop:   { value: new THREE.Color(0x0a1730) },
  uFogColor: { value: new THREE.Color(0x0c1a2c) },
  uFogDen:   { value: 0.0011 },
  uNight:    { value: 1 },
};

const sea = new THREE.Mesh(new THREE.PlaneGeometry(5200, 5200, 1, 1), makeFarSeaMaterial(wu));
sea.rotation.x = -Math.PI / 2;
scene.add(sea);

// Sky. The island's sky shader is built around a day cycle with a sun disc and a
// warm horizon lobe; driven to night it still painted a tan sun-glow band across
// the top. Beacon only ever needs one sky, so it gets a night gradient it owns
// outright rather than a day shader argued down to darkness.
{
  const skyGeo = new THREE.SphereGeometry(2600, 32, 24);
  const nightSky = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uTop:     { value: new THREE.Color(0x05080f) },
      uHorizon: { value: new THREE.Color(0x1b3554) },
      uMoonDir: { value: MOON_DIR.clone() },
      uMoonCol: { value: new THREE.Color(0x8fa8d6) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uTop, uHorizon, uMoonDir, uMoonCol;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, 0.0, 1.0);
        vec3 col = mix(uHorizon, uTop, pow(h, 0.55));
        // A cool lobe around the moon — the only warmth a night sky is allowed.
        float lobe = pow(max(dot(d, normalize(uMoonDir)), 0.0), 22.0);
        col += uMoonCol * lobe * 0.55;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  scene.add(new THREE.Mesh(skyGeo, nightSky));
}

// Stars — a real point field, thinned towards the horizon haze.
{
  const N = 1400, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const u = Math.random() * Math.PI * 2;
    const v = Math.acos(1 - Math.random() * 0.82);        // upper dome only
    const r = 2400;
    pos[i*3]   = Math.sin(v) * Math.cos(u) * r;
    pos[i*3+1] = Math.cos(v) * r + 60;
    pos[i*3+2] = Math.sin(v) * Math.sin(u) * r;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({
    color: 0xfff4e2, size: 5.5, sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false,
  })));
}

// Moon
{
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(52, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xe6ecff, fog: false }),
  );
  m.position.copy(MOON_DIR).multiplyScalar(2100);
  scene.add(m);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: GLOW_TEX, color: 0xaec4f5, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  halo.position.copy(m.position); halo.scale.setScalar(520);
  scene.add(halo);
}

scene.add(new THREE.HemisphereLight(0x3a557f, 0x070f1c, 1.1));
// Directional moonlight, so hulls and the tower have a lit side and a shadow side
// instead of reading as flat cut-outs the way they did in the canvas build.
const moonlight = new THREE.DirectionalLight(0xbcd0ff, 0.85);
moonlight.position.copy(MOON_DIR).multiplyScalar(400);
scene.add(moonlight);
const lamplight = new THREE.PointLight(0xffe9b0, 26000, 520, 2);
lamplight.position.set(0, 30, 0);
scene.add(lamplight);

// The beam is a LIGHT, not just a shaft of geometry. A spot bound to the same
// bearing means a hull inside the wedge is genuinely illuminated by it — the
// game's one mechanic ("the beam reveals them") made physical rather than a
// number multiplying an alpha.
const beamLight = new THREE.SpotLight(0xfff0c0, 900000, SPAWN * 1.45, 0.30, 0.55, 2);
beamLight.position.set(0, 39.8, 0);
const beamTarget = new THREE.Object3D();
scene.add(beamTarget);
beamLight.target = beamTarget;
scene.add(beamLight);

// ── Lighthouse ────────────────────────────────────────────
const lighthouse = new THREE.Group();
{
  const white = new THREE.MeshStandardMaterial({ color: 0xd7dde8, roughness: 0.85, metalness: 0.02 });
  const dark  = new THREE.MeshStandardMaterial({ color: 0x2b3240, roughness: 0.9 });
  const band  = new THREE.MeshStandardMaterial({ color: 0x9e3b34, roughness: 0.85 });

  const rock = new THREE.Mesh(new THREE.CylinderGeometry(17, 25, 8, 12, 1), new THREE.MeshStandardMaterial({ color: 0x232a36, roughness: 1, flatShading: true }));
  rock.position.y = 2; lighthouse.add(rock);

  const tower = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 8.4, 30, 20, 1), white);
  tower.position.y = 20; lighthouse.add(tower);
  for (const [y, r] of [[12, 7.6], [24, 5.9]]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.01, r * 1.03, 3.4, 20, 1), band);
    b.position.y = y; lighthouse.add(b);
  }
  const gallery = new THREE.Mesh(new THREE.CylinderGeometry(7.6, 7.6, 1.4, 20, 1), dark);
  gallery.position.y = 35.4; lighthouse.add(gallery);
  const rail = new THREE.Mesh(new THREE.TorusGeometry(7.2, 0.28, 6, 24), dark);
  rail.rotation.x = Math.PI / 2; rail.position.y = 38.2; lighthouse.add(rail);

  const glass = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 7.2, 16, 1),
    new THREE.MeshBasicMaterial({ color: 0xfff3cf, transparent: true, opacity: 0.55 }));
  glass.position.y = 39.8; lighthouse.add(glass);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(6.2, 5.2, 16), dark);
  roof.position.y = 46; lighthouse.add(roof);

  const bloom = new THREE.Sprite(new THREE.SpriteMaterial({
    map: GLOW_TEX, color: 0xffe6ac, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  bloom.position.y = 39.8; bloom.scale.setScalar(74);
  lighthouse.add(bloom);
}
scene.add(lighthouse);

// ── Beam ──────────────────────────────────────────────────
// A cone laid on its side with its apex at the lantern. The island's shaft shader
// reads uv.y along the cone, so uFlip puts the source at the narrow end.
const beamMat = makeBeamMaterial(0xfff0c0);
beamMat.uniforms.uIntensity.value = 1;
if (beamMat.uniforms.uFlip) beamMat.uniforms.uFlip.value = 1;
if (beamMat.uniforms.uMist) beamMat.uniforms.uMist.value = 0.55;
const BEAM_LEN = SPAWN * 1.25;
const beamMesh = new THREE.Mesh(new THREE.ConeGeometry(BEAM_LEN * 0.21, BEAM_LEN, 30, 1, true), beamMat);
beamMesh.geometry.translate(0, -BEAM_LEN / 2, 0);   // apex at the origin
beamMesh.rotation.x = Math.PI / 2;                   // lay it flat, pointing -Z
const beamPivot = new THREE.Group();
beamPivot.position.set(0, 39.8, 0);
beamPivot.add(beamMesh);
// Aim the shaft so its axis meets the sea out at the spawn ring. Tipped only
// slightly, the beam left the lantern at 40m and was still ~30m above the water
// where the ships are — a wedge of light floating over the scene, touching nothing.
beamMesh.rotation.x = Math.PI / 2 - Math.atan(39.8 / (SPAWN * 0.92));
scene.add(beamPivot);

// ── Ship meshes ───────────────────────────────────────────
const HULL_GEO = {};
for (const [key, pts] of Object.entries(HULLS)) {
  const shape = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? shape.lineTo(x * 0.46, -y * 0.46) : shape.moveTo(x * 0.46, -y * 0.46)));
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 6.4, bevelEnabled: true, bevelSize: 0.5, bevelThickness: 0.5, bevelSegments: 1 });
  geo.center();
  geo.rotateY(Math.PI / 2);          // beam-on to the lantern
  HULL_GEO[key] = geo;
}

function makeShipMesh(typeKey) {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(HULL_GEO[typeKey], new THREE.MeshStandardMaterial({
    color: 0x9fa8ba, roughness: 0.72, metalness: 0.05,
  }));
  hull.position.y = 3.4;
  g.add(hull);
  // Running lights: red to port, green to starboard, white at the masthead. The
  // canvas build shipped none, in a game whose only verb is signalling with light.
  const lamp = (x, y, z, col) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: GLOW_TEX, color: col, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    s.position.set(x, y, z); s.scale.setScalar(3.2); g.add(s);
    return s;
  };
  g.userData.lamps = [
    lamp(0, 4.2, 9.0, 0xff4444),
    lamp(0, 4.2, -9.0, 0x44ff88),
    lamp(0, 11.5, 0, 0xfff6dd),
  ];
  g.userData.hull = hull;
  return g;
}

const audio = (() => {
  let ctx = null, master = null;
  const ensure = () => {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.4; master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  };
  const tone = (type, f0, f1, start, dur, amp) => {
    const t = ctx.currentTime + start;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  };
  return {
    unlock() { ensure(); }, // call from a user gesture so cues can play later
    rescue() { // bright rising chime
      if (!ensure()) return;
      tone('sine', 523, 659, 0, 0.18, 0.25);
      tone('sine', 784, 1047, 0.09, 0.3, 0.2);
    },
    danger() { // low groaning descent
      if (!ctx) return;
      tone('sawtooth', 130, 55, 0, 0.7, 0.18);
      tone('sine', 65, 40, 0, 0.9, 0.25);
    },
  };
})();

// ── Signal ────────────────────────────────────────────────
function flashSignal(color) {
  signalQueue.push(color);
  signalFlashColor = color;
  signalFlashTimer = 12;
  const btn = document.getElementById('btn-' + color[0]);
  btn.classList.add('flash');
  setTimeout(() => btn.classList.remove('flash'), 200);
  checkSignals();
}

function checkSignals() {
  // Try to match the signal queue against the nearest unserved ship
  const nearestUnsignaled = ships
    .filter(s => !s.signaled && !s.wrecked && s.lit > 0.1)
    .sort((a, b) => a.distance - b.distance)[0];
  if (!nearestUnsignaled) return;

  const required = nearestUnsignaled.type.signal;
  if (signalQueue.length < required.length) return;

  const tail = signalQueue.slice(-required.length);
  const match = required.every((c, i) => tail[i] === c);
  if (match) {
    nearestUnsignaled.signaled = true;
    score += 100 * wave;
    saved++;
    signalQueue = [];
    audio.rescue();
    updateHUD();
    // First successful rescue: the instruction has been understood, so retire it.
    const guide = document.getElementById('guide');
    if (guide && guide.style.opacity !== '0') guide.style.opacity = '0';
  } else if (signalQueue.length >= required.length + 2) {
    // Too many wrong signals — clear and penalize
    signalQueue = [];
  }
}

// ── Update ────────────────────────────────────────────────
function update() {
  time++;

  // Beam rotation
  beam.angle += beam.speed;
  if (beam.angle > Math.PI * 2) beam.angle -= Math.PI * 2;

  // Ship movement + beam intersection
  for (const ship of ships) {
    if (ship.signaled) {
      ship.opacity = Math.max(0, ship.opacity - 0.02);
      continue;
    }
    ship.distance -= ship.speed;

    // Check if in beam
    let angleDiff = ((ship.angle - beam.angle) % (Math.PI*2) + Math.PI*3) % (Math.PI*2) - Math.PI;
    if (Math.abs(angleDiff) < beam.width / 2) {
      ship.lit = Math.min(1, ship.lit + 0.15);
      // Once the beam has held a ship long enough to read its silhouette, the
      // keeper KNOWS it is out there. Before, that knowledge vanished with the
      // beam and the ship became invisible again for the rest of the sweep.
      if (ship.lit > 0.55) ship.seen = true;
    } else {
      ship.lit = Math.max(0, ship.lit - 0.008);
    }

    // Wreck check
    if (ship.distance <= ship.safeDistance && !ship.wrecked) {
      ship.wrecked = true;
      wrecks++;
      audio.danger();
      updateHUD();
      if (wrecks >= maxWrecks) endGame();
    }
  }

  // Remove faded ships
  const survivors = ships.filter(s => s.opacity > 0.01 && (!s.wrecked || s.opacity > 0));
  for (const s of ships) if (!survivors.includes(s)) removed.push(s);
  ships = survivors;
  if (ships.some(s => s.wrecked)) {
    ships = ships.map(s => s.wrecked ? {...s, opacity: Math.max(0, s.opacity - 0.015)} : s);
  }

  // Spawn
  spawnTimer++;
  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    spawnShip();
    // Wave progression — one wave per 5 ships saved, advanced once per threshold crossing
    const targetWave = Math.floor(saved / 5) + 1;
    if (targetWave > wave) {
      spawnInterval = Math.max(60, spawnInterval - 12 * (targetWave - wave));
      wave = targetWave;
      document.getElementById('hud-wave').textContent = wave;
    }
  }

  // Signal flash decay
  if (signalFlashTimer > 0) signalFlashTimer--;
  else signalFlashColor = null;
}

function updateHUD() {
  document.getElementById('hud-score').textContent = score;
  document.getElementById('hud-saved').textContent = saved;
  document.getElementById('hud-wrecks').textContent = wrecks + '/' + maxWrecks;
}

// ── Game loop ─────────────────────────────────────────────
let rafId = null;
function loop() {
  if (!running) return;
  update();
  render();
  rafId = requestAnimationFrame(loop);
}

function startGame() {
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('game-over').style.display = 'none';
  ships = []; signalQueue = []; score = 0; saved = 0; wrecks = 0; wave = 1;
  spawnTimer = 0; spawnInterval = 180; time = 0; beam.angle = 0;
  running = true; gameOver = false;
  audio.unlock();
  updateHUD();
  document.getElementById('hud-wave').textContent = '1';
  // Initial ship
  setTimeout(spawnShip, 500);
  if (rafId) cancelAnimationFrame(rafId);
  loop();
  // The guide used to fade after six seconds whether or not you had understood
  // it. Keep it until the first ship is signalled correctly — then it has done
  // its job and can get out of the way.
  document.getElementById('guide').style.opacity = '';
}

function endGame() {
  running = false;
  gameOver = true;
  document.getElementById('game-over').style.display = 'flex';
  document.getElementById('go-score').textContent = `Score: ${score}`;
  document.getElementById('go-saved').textContent = `Ships saved: ${saved}`;
  document.getElementById('go-wrecks').textContent = `Ships wrecked: ${wrecks}`;
}

// ── Input ─────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (!running) return;
  if (e.key === 'g' || e.key === 'G') flashSignal('green');
  else if (e.key === 'r' || e.key === 'R') flashSignal('red');
  else if (e.key === 'w' || e.key === 'W') flashSignal('white');
  else if (e.key === 'ArrowLeft') beam.speed = Math.max(0.004, beam.speed - 0.002);
  else if (e.key === 'ArrowRight') beam.speed = Math.min(0.03, beam.speed + 0.002);
});



// ── Scene sync ────────────────────────────────────────────
function syncScene() {
  beamPivot.rotation.y = -beam.angle;
  // Keep the spot on the same bearing as the shaft, aimed at the sea where the
  // cone meets it, and tinted by whatever signal is being flashed.
  const ba = beam.angle - Math.PI / 2;
  beamTarget.position.set(Math.cos(ba) * SPAWN * 0.92, 0, Math.sin(ba) * SPAWN * 0.92);
  beamMat.uniforms.uTime.value = time * 0.016;
  const flash = signalFlashColor;
  const beamHex = flash === 'green' ? 0x22c55e : flash === 'red' ? 0xef4444 : flash === 'white' ? 0xffffff : 0xfff0c0;
  beamMat.uniforms.uColor.value.set(beamHex);
  beamLight.color.set(beamHex);
  beamLight.intensity = 900000 * (0.85 + 0.15 * Math.sin(time * 0.08));
  wu.uTime.value = time * 0.016;
  const pulse = 0.86 + 0.14 * Math.sin(time * 0.08);
  lamplight.intensity = 2600 * pulse;

  for (const ship of ships) {
    if (!ship.mesh) {
      ship.mesh = makeShipMesh(ship.typeKey);
      scene.add(ship.mesh);
    }
    const a = ship.angle - Math.PI / 2;
    ship.mesh.position.set(Math.cos(a) * ship.distance, 0, Math.sin(a) * ship.distance);
    ship.mesh.rotation.y = -a + Math.PI / 2;          // bow towards the light
    ship.mesh.position.y = Math.sin(time * 0.04 + ship.angle * 3) * 0.5;   // ride the swell
    const seen = ship.seen && !ship.signaled && !ship.wrecked ? 0.38 : 0;
    const vis = Math.max(ship.lit, seen) * ship.opacity;
    const hull = ship.mesh.userData.hull;
    hull.material.emissive = hull.material.emissive || new THREE.Color();
    const base = ship.wrecked ? 0x7f1d1d : ship.signaled ? 0x1f7a4d : 0xb9c3d6;
    hull.material.color.setHex(base);
    if (!ship.wrecked && !ship.signaled) {
      // Warm the hull towards the lamp as the beam holds it.
      hull.material.color.lerp(new THREE.Color(0xfff0cd), ship.lit * 0.55);
    }
    hull.material.emissive.setHex(ship.signaled ? 0x0d3a24 : 0x111c2c);
    hull.material.emissiveIntensity = 0.12 + ship.lit * 0.18;
    hull.material.opacity = Math.max(0.55, vis);
    hull.material.transparent = true;
    for (const l of ship.mesh.userData.lamps) l.material.opacity = 0.35 + vis * 0.6;
  }
  for (const ship of removed) { if (ship.mesh) { scene.remove(ship.mesh); ship.mesh = null; } }
  removed.length = 0;
}

function render() {
  syncScene();
  renderer.render(scene, camera);
}

function resize() {
  const w = Math.max(320, window.innerWidth), h = Math.max(320, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// The HTML calls these directly, and a module has no global scope.
window.startGame = startGame;
window.flashSignal = flashSignal;

// ?debug exposes the watch for posed captures and playtests, the same way the
// island exposes ABYME. Screenshots were being taken at whatever moment the clock
// happened to land on, which is a poor way to photograph a rotating light.
if (new URLSearchParams(location.search).has('debug')) {
  window.BEACON = {
    get ships() { return ships; },
    beam, camera, scene, renderer, wu,
    spawnShip, render,
    // Place a vessel exactly: bearing in turns (0..1), distance in metres.
    place(typeKey, bearingTurns, distance, lit = 1) {
      spawnShip();
      const ship = ships[ships.length - 1];
      ship.typeKey = typeKey;
      ship.type = SHIP_TYPES[typeKey];
      ship.angle = bearingTurns * Math.PI * 2;
      ship.distance = distance;
      ship.lit = lit;
      ship.seen = lit > 0.5;
      if (ship.mesh) { scene.remove(ship.mesh); ship.mesh = null; }
      return ship;
    },
    clear() {
      for (const s of ships) if (s.mesh) scene.remove(s.mesh);
      ships.length = 0;
    },
    setBeam(turns) { beam.angle = turns * Math.PI * 2; },
    freeze() { running = false; },
  };
}

// Idle scene behind the title card, so the watch is already running when you arrive.
(function idle() {
  if (!running) { time++; render(); }
  requestAnimationFrame(idle);
})();
