// props.js — every structure on the island, generated from primitives.
// Static pieces are baked into merged meshes (a few draw calls); anything
// that moves or glows is a named object so world.js state can drive it —
// in BOTH instances of the island (real and chart-table model).

import * as THREE from 'three';
import { Baker, mulberry32, SEED, vary, clamp, lerp, TAU } from './util.js';
import { heightAt, SPOTS, DOMAIN, buildTerrain, buildHeightTexture, addCollider } from './terrain.js';
import { makeWaterMaterial, makeBeamMaterial, makeGlowPoints } from './shaders.js';
import { SCALE_MODEL, MAX_DEPTH } from './world.js';
import { applyRelief, getTexture } from './assets.js';

export const GLYPHS = 8;
export const GLYPH_CODE = [3, 7, 1, 5];
export const STONE_NOTES = [261.63, 293.66, 329.63, 392.0, 440.0]; // C4 D4 E4 G4 A4
export const BOX_MELODY = [2, 3, 4, 1, 0];   // stone indices: E G A D C
export const BIRD_MELODY = [2, 3, 4, 3, 0];  // E G A G C — the bird corrects one note

// ---- shared materials -------------------------------------------------------
export const matStone = new THREE.MeshStandardMaterial({
  vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0.0, side: THREE.DoubleSide,
});
applyRelief(matStone, 'stone', { normalScale: 0.85, strength: 2.4 });   // granite over the lighthouse/
                                    // study/stones — multiplies the vertex colours (bone walls → granite,
                                    // the copper band stays coppery) + a derived normal map so the mortar
                                    // lines and block faces catch the raking sun and the keeper's lamp
export const matBrass = new THREE.MeshStandardMaterial({
  vertexColors: true, flatShading: true, roughness: 0.38, metalness: 0.85, side: THREE.DoubleSide,
});
const matBrassSolid = new THREE.MeshStandardMaterial({
  color: 0xb08d4f, flatShading: true, roughness: 0.35, metalness: 0.9,
});
const matWood = new THREE.MeshStandardMaterial({
  color: 0x8f7a5c, flatShading: true, roughness: 0.85, metalness: 0.0,  // lightened so the wood grain reads
});
applyRelief(matWood, 'wood', { normalScale: 0.55, strength: 1.8 });   // the interior wood grain — doors,
                                  // the music box, the tables, the plate ring — now with grain-channel relief
const matGlass = new THREE.MeshStandardMaterial({
  color: 0xcfe8ea, transparent: true, opacity: 0.16, roughness: 0.08, metalness: 0.1,
  side: THREE.DoubleSide, depthWrite: false,
});
const matLamp = new THREE.MeshStandardMaterial({
  color: 0xffb454, emissive: 0xffb454, emissiveIntensity: 1.6, roughness: 0.4,
});
const matLens = new THREE.MeshStandardMaterial({
  color: 0xbfe8e2, emissive: 0x58f2c2, emissiveIntensity: 0.25,
  transparent: true, opacity: 0.85, roughness: 0.05, metalness: 0.2, flatShading: true,
});

// colors
const C = {
  bone: new THREE.Color(0xcfc8b8), boneDark: new THREE.Color(0xa9a08c),
  copper: new THREE.Color(0x4e9e88), copperDark: new THREE.Color(0x3e7a6a),
  brass: new THREE.Color(0xb08d4f), brassDark: new THREE.Color(0x8a6c3a),
  wood: new THREE.Color(0x6b4a2f), woodDark: new THREE.Color(0x4a3018),
  stoneOld: new THREE.Color(0x9b9484), ink: new THREE.Color(0x20242c),
  cloth: new THREE.Color(0x355560),
};

// ---- glyph atlas (canvas → texture) ----------------------------------------
export function makeGlyphAtlas() {
  const cell = 128;
  const cv = document.createElement('canvas');
  cv.width = cell * GLYPHS; cv.height = cell;
  const g = cv.getContext('2d');
  g.clearRect(0, 0, cv.width, cv.height);
  g.strokeStyle = '#fff'; g.fillStyle = '#fff';
  g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round';

  const draw = [
    (x, y, s) => { g.beginPath(); g.arc(x, y, s * 0.32, 0, TAU); g.stroke(); g.beginPath(); g.arc(x, y, s * 0.07, 0, TAU); g.fill(); },                                  // 0 sun-eye
    (x, y, s) => { g.beginPath(); g.moveTo(x, y - s * 0.36); g.lineTo(x + s * 0.34, y + s * 0.3); g.lineTo(x - s * 0.34, y + s * 0.3); g.closePath(); g.stroke(); },      // 1 mountain
    (x, y, s) => { g.beginPath(); for (let i = 0; i <= 24; i++) { const t = i / 24; const px = x - s * 0.38 + t * s * 0.76; const py = y + Math.sin(t * TAU) * s * 0.18; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); }, // 2 wave
    (x, y, s) => { g.beginPath(); for (let i = 0; i <= 40; i++) { const t = i / 40 * 2.4 * TAU; const r = s * 0.05 + t * s * 0.022; i ? g.lineTo(x + Math.cos(t) * r, y + Math.sin(t) * r) : g.moveTo(x + r, y); } g.stroke(); }, // 3 spiral
    (x, y, s) => { g.beginPath(); g.moveTo(x, y - s * 0.38); g.lineTo(x, y + s * 0.38); g.moveTo(x - s * 0.3, y - s * 0.1); g.lineTo(x, y - s * 0.38); g.lineTo(x + s * 0.3, y - s * 0.1); g.stroke(); },                       // 4 trident-up
    (x, y, s) => { g.beginPath(); g.arc(x + s * 0.1, y, s * 0.32, Math.PI * 0.5, Math.PI * 1.5); g.arc(x - s * 0.08, y, s * 0.24, Math.PI * 1.5, Math.PI * 0.5, true); g.stroke(); },                                          // 5 crescent
    (x, y, s) => { g.beginPath(); g.rect(x - s * 0.26, y - s * 0.26, s * 0.52, s * 0.52); g.moveTo(x - s * 0.26, y); g.lineTo(x + s * 0.26, y); g.stroke(); },             // 6 split square
    (x, y, s) => { g.beginPath(); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; g.moveTo(x, y); g.lineTo(x + Math.cos(a) * s * 0.36, y + Math.sin(a) * s * 0.36); } g.stroke(); g.beginPath(); g.arc(x, y, s * 0.14, 0, TAU); g.stroke(); }, // 7 star-cross
  ];
  for (let i = 0; i < GLYPHS; i++) draw[i](cell * i + cell / 2, cell / 2, cell);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function glyphSprite(atlas, index, color, size = 1) {
  const tex = atlas.clone();
  tex.needsUpdate = true;
  tex.repeat.set(1 / GLYPHS, 1);
  tex.offset.set(index / GLYPHS, 0);
  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, color, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  return m;
}

// a soft round glow, code-generated once and shared — for billboarded halos
// (additive). A Sprite, never a Points: instantiateModel strips Points from core.
let _glowTex = null;
function radialGlowTex() {
  if (_glowTex) return _glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.5)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  _glowTex = new THREE.CanvasTexture(c);
  return _glowTex;
}

// =============================================================================
// build the whole world. Returns { core, refs, modelRefs, hotspots, ... }
// =============================================================================
export function buildWorld() {
  const r = mulberry32(SEED ^ 0xbeef);
  const core = new THREE.Group();
  core.name = 'islandCore';

  const atlas = makeGlyphAtlas();

  // ---------- terrain + water ----------
  const terrain = buildTerrain();
  const heightTex = buildHeightTexture();
  core.add(terrain);

  // SEA-STRATA regions (loop #117, Phase 0): one content shell per drowned level, built
  // once and shown one-at-a-time by W.level in puzzles _apply (region<N>.visible). Empty
  // until each level is authored. Pruned from the 1:240 clone (the model is the surface
  // island only). Named so collectRefs() finds them on the island instance.
  const region2 = new THREE.Group(); region2.name = 'region2'; region2.visible = false; core.add(region2);
  const region3 = new THREE.Group(); region3.name = 'region3'; region3.visible = false; core.add(region3);
  const region4 = new THREE.Group(); region4.name = 'region4'; region4.visible = false; core.add(region4);

  // SEA-STRATA L2 "shallows" (loop #119): a kelp forest along the sunk causeway + south-shore
  // shallows — submerged at the raised L2 tide, so diving here wades a drowned kelp avenue, not the
  // dry beach. One InstancedMesh (1 draw), swaying on the wave clock via swayMats. region2-only
  // (pruned from the clone). Own rng so it never shifts the world scatter.
  {
    const kr = mulberry32(SEED ^ 0x4e19);
    const frond = new THREE.PlaneGeometry(0.55, 4.2, 1, 5);
    frond.translate(0, 2.1, 0);                       // base at y=0, rises up
    const kelpMat = new THREE.MeshStandardMaterial({ color: 0x3c5a3e, roughness: 0.8, side: THREE.DoubleSide });
    kelpMat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = { value: 0 };
      kelpMat.userData.shader = sh;
      sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        #ifdef USE_INSTANCING
          float kw = instanceMatrix[3].x * 0.21 + instanceMatrix[3].z * 0.17;   // per-frond phase
          float kh = pow(max(position.y, 0.0), 1.6);                            // tips sway most
          transformed.x += sin(uTime * 0.7 + kw) * 0.55 * kh;                   // slow languid underwater drift
          transformed.z += cos(uTime * 0.55 + kw * 1.3) * 0.4 * kh;
        #endif
      `).replace('void main() {', 'uniform float uTime;\nvoid main() {');
    };
    const KN = 420;
    const kelp = new THREE.InstancedMesh(frond, kelpMat, KN);
    kelp.name = 'kelp'; kelp.castShadow = false; kelp.receiveShadow = false;
    const km = new THREE.Matrix4(), kq = new THREE.Quaternion(), ke = new THREE.Euler(), kc = new THREE.Color();
    let ki = 0;
    const plantKelp = (x, z) => {
      const h = heightAt(x, z);
      if (!Number.isFinite(h) || h > 1.6) return;     // only the low shore zone that the L2 tide floods
      const s = 0.7 + kr() * 0.9;
      km.compose(new THREE.Vector3(x, h, z),
        kq.setFromEuler(ke.set((kr() - 0.5) * 0.22, kr() * TAU, (kr() - 0.5) * 0.22)),
        new THREE.Vector3(s, s * (0.8 + kr() * 0.85), s));
      kelp.setMatrixAt(ki, km);
      kc.setHSL(0.32 + kr() * 0.07, 0.32 + kr() * 0.18, 0.2 + kr() * 0.13);
      kelp.setColorAt(ki, kc); ki++;
    };
    for (let i = 0; i < KN * 5 && ki < KN; i++) {
      let x, z;
      if (kr() < 0.6) { x = -38 + kr() * 96; z = -98 - kr() * 16; }                 // south-shore shallows band
      else { const t = kr(); x = 48 + 64 * t + (kr() - 0.5) * 10; z = -78 - 54 * t + (kr() - 0.5) * 10; }  // sunk causeway A→B
      plantKelp(x, z);
    }
    kelp.count = ki; kelp.instanceMatrix.needsUpdate = true;
    if (kelp.instanceColor) kelp.instanceColor.needsUpdate = true;
    region2.add(kelp);
  }

  // SEA-STRATA L2 encounter: the TIDE-FIGURE — a soft dark humanoid waist-deep in the kelp.
  // It disperses when you wade for it; it settles when you stand still and watch. Driven in
  // puzzles _tickTideFigure. region2-only (pruned from the clone). Starts hidden + inactive.
  {
    const tf = new THREE.Group();
    tf.name = 'tideFigure'; tf.visible = false;
    const tmat = new THREE.MeshStandardMaterial({ color: 0x182a2c, emissive: 0x081416, emissiveIntensity: 0.45,
      transparent: true, opacity: 0.8, roughness: 1, flatShading: true });
    tf.userData.mats = [tmat];
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.62, 1.7, 7), tmat);
    body.position.y = 0.85; tf.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), tmat);
    head.position.y = 1.78; head.scale.set(1, 1.12, 1); tf.add(head);
    const tfx = 12, tfz = -100;
    tf.position.set(tfx, Number.isFinite(heightAt(tfx, tfz)) ? heightAt(tfx, tfz) : 0, tfz);
    tf.castShadow = false; tf.receiveShadow = false;
    region2.add(tf);
  }

  const waterMat = makeWaterMaterial(heightTex, DOMAIN);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(DOMAIN, DOMAIN, 120, 120), waterMat);
  water.geometry.rotateX(-Math.PI / 2);
  water.name = 'water';
  water.renderOrder = 2;
  water.frustumCulled = false;
  core.add(water);

  // ---------- bakers for merged statics ----------
  const stone = new Baker();
  const brass = new Baker();
  const M = new THREE.Matrix4();
  const Q = new THREE.Quaternion();
  const V = new THREE.Vector3();
  const S = new THREE.Vector3();
  const place = (px, py, pz, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) => {
    Q.setFromEuler(new THREE.Euler(rx, ry, rz));
    return M.compose(V.set(px, py, pz), Q, S.set(sx, sy, sz));
  };
  const grad = (a, b) => (t) => a.clone().lerp(b, t);

  // =================== THE LIGHTHOUSE =======================================
  const LH = new THREE.Vector3(SPOTS.lighthouse.x, 13.5, SPOTS.lighthouse.y);
  const lhGroup = new THREE.Group();
  lhGroup.position.copy(LH);
  lhGroup.name = 'lighthouse';
  core.add(lhGroup);

  const deg = (d) => d * Math.PI / 180;
  // wall arcs: full circle minus door gap (az 165±14, faces the beach path)
  // and window gap (az 110±15, overlooks the cove and the causeway)
  const gaps = [[deg(151), deg(179)], [deg(95), deg(125)]];
  const arcs = [[deg(179), deg(95) + TAU], [deg(125), deg(151)]]; // complementary
  const baseR = 5.2, baseH = 4.6, wallT = 0.5;
  for (const [a0, a1] of arcs) {
    const len = a1 - a0;
    const geo = new THREE.CylinderGeometry(baseR, baseR + 0.15, baseH, Math.max(6, Math.round(len * 8)), 1, true, a0, len);
    stone.add(geo, place(0, baseH / 2, 0).clone().premultiply(new THREE.Matrix4().makeTranslation(LH.x, LH.y, LH.z)), grad(C.boneDark, C.bone));
    geo.dispose();
  }
  // lintels over the gaps
  for (const [a0, a1] of gaps) {
    const len = a1 - a0;
    const geo = new THREE.CylinderGeometry(baseR, baseR, 1.3, 8, 1, true, a0, len);
    stone.add(geo, new THREE.Matrix4().makeTranslation(LH.x, LH.y + baseH - 0.65, LH.z), grad(C.bone, C.bone));
    geo.dispose();
  }
  // the window gets a sill and a header — it is a window, not a breach
  {
    const [w0, w1] = gaps[1];
    const len = w1 - w0;
    const sill = new THREE.CylinderGeometry(baseR, baseR + 0.15, 1.15, 8, 1, true, w0, len);
    stone.add(sill, new THREE.Matrix4().makeTranslation(LH.x, LH.y + 0.575, LH.z), grad(C.boneDark, C.bone));
    sill.dispose();
    const header = new THREE.CylinderGeometry(baseR, baseR, 0.55, 8, 1, true, w0, len);
    stone.add(header, new THREE.Matrix4().makeTranslation(LH.x, LH.y + 3.1, LH.z), grad(C.bone, C.bone));
    header.dispose();
  }
  // floor + ceiling ring (oculus for the light shaft)
  {
    const floor = new THREE.CylinderGeometry(baseR + 0.2, baseR + 0.2, 0.3, 28);
    stone.add(floor, new THREE.Matrix4().makeTranslation(LH.x, LH.y - 0.07, LH.z), grad(C.stoneOld, C.boneDark));
    floor.dispose();
    const ceil = new THREE.RingGeometry(1.25, baseR + 0.1, 28);
    ceil.rotateX(Math.PI / 2);
    stone.add(ceil, new THREE.Matrix4().makeTranslation(LH.x, LH.y + baseH, LH.z), grad(C.boneDark, C.boneDark));
    ceil.dispose();
  }
  // tower (tapered) + gallery + lamp room + dome
  {
    const tower = new THREE.CylinderGeometry(2.45, 4.05, 15.9, 14, 4, true);
    stone.add(tower, new THREE.Matrix4().makeTranslation(LH.x, LH.y + baseH + 7.95, LH.z), (t) =>
      t > 0.55 && t < 0.72 ? C.copperDark.clone() : C.bone.clone().lerp(C.boneDark, 1 - t)); // painted band
    tower.dispose();
    const gallery = new THREE.CylinderGeometry(3.3, 3.3, 0.35, 16);
    brass.add(gallery, new THREE.Matrix4().makeTranslation(LH.x, LH.y + 20.6, LH.z), grad(C.brassDark, C.brass));
    gallery.dispose();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      const post = new THREE.CylinderGeometry(0.05, 0.05, 1.0, 5);
      brass.add(post, new THREE.Matrix4().makeTranslation(LH.x + Math.sin(a) * 3.1, LH.y + 21.3, LH.z + Math.cos(a) * 3.1), grad(C.brassDark, C.brass));
      post.dispose();
    }
    const rail = new THREE.TorusGeometry(3.1, 0.05, 5, 24);
    rail.rotateX(Math.PI / 2);
    brass.add(rail, new THREE.Matrix4().makeTranslation(LH.x, LH.y + 21.8, LH.z), grad(C.brass, C.brass));
    rail.dispose();
    // lamp room mullions
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      const post = new THREE.BoxGeometry(0.12, 2.5, 0.12);
      brass.add(post, new THREE.Matrix4().makeTranslation(LH.x + Math.sin(a) * 2.0, LH.y + 22.05, LH.z + Math.cos(a) * 2.0), grad(C.brassDark, C.brass));
      post.dispose();
    }
    const dome = new THREE.ConeGeometry(2.55, 2.3, 12);
    stone.add(dome, new THREE.Matrix4().makeTranslation(LH.x, LH.y + 24.45, LH.z), grad(C.copperDark, C.copper));
    dome.dispose();
    const finial = new THREE.SphereGeometry(0.22, 8, 6);
    brass.add(finial, new THREE.Matrix4().makeTranslation(LH.x, LH.y + 25.8, LH.z), grad(C.brass, C.brass));
    finial.dispose();
  }
  // glass for lamp room + window
  {
    const lampGlass = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.05, 2.4, 16, 1, true), matGlass);
    lampGlass.position.set(0, 22.05, 0);
    lhGroup.add(lampGlass);
    const winGlass = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.7), matGlass);
    const wa = deg(110);
    winGlass.position.set(Math.sin(wa) * (baseR - 0.05), 2.0, Math.cos(wa) * (baseR - 0.05));
    winGlass.rotation.y = wa;
    winGlass.name = 'studyWindow';
    lhGroup.add(winGlass);
  }
  // the study door, forever ajar
  {
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.9, 3.4, 0.12), matWood);
    const da = deg(165);
    const hingeOff = new THREE.Group();
    hingeOff.position.set(Math.sin(da - deg(10)) * baseR, 1.7, Math.cos(da - deg(10)) * baseR);
    hingeOff.rotation.y = da + deg(48); // ajar
    door.position.x = 0.95;
    hingeOff.add(door);
    hingeOff.name = 'studyDoor';
    lhGroup.add(hingeOff);
  }

  // ---- lamp assembly: pedestal, lens, beam ----
  {
    const ped = new THREE.CylinderGeometry(0.5, 0.7, 1.1, 8);
    brass.add(ped, new THREE.Matrix4().makeTranslation(LH.x, LH.y + 21.4, LH.z), grad(C.brassDark, C.brass));
    ped.dispose();
    const lens = new THREE.Mesh(new THREE.OctahedronGeometry(0.62, 0), matLens.clone());
    lens.position.set(0, 22.5, 0);
    lens.scale.y = 1.35;
    lens.name = 'lampLens';
    lens.visible = false;
    lhGroup.add(lens);

    const beamPivot = new THREE.Group();
    beamPivot.position.set(0, 22.5, 0);
    beamPivot.rotation.order = 'YXZ'; // yaw first, then pitch in the yawed frame
    beamPivot.rotation.x = 0.125;     // pitched down: the keeper aimed at the water — and the cliff
    beamPivot.name = 'beamPivot';
    const beamGeo = new THREE.CylinderGeometry(7.5, 0.35, 210, 12, 1, true);
    beamGeo.rotateX(Math.PI / 2);           // axis → z
    beamGeo.translate(0, 0, 105);
    const beam = new THREE.Mesh(beamGeo, makeBeamMaterial());
    beam.name = 'beamCone';
    beam.frustumCulled = false;
    // hot inner shell — same material instance, so it follows uIntensity
    // for free; fills the cone's body so it reads as light, not two walls
    const beamInnerGeo = new THREE.CylinderGeometry(4.0, 0.22, 208, 10, 1, true);
    beamInnerGeo.rotateX(Math.PI / 2);
    beamInnerGeo.translate(0, 0, 104);
    const beamInner = new THREE.Mesh(beamInnerGeo, beam.material);
    beamInner.frustumCulled = false;
    beam.add(beamInner);
    beamPivot.add(beam);
    lhGroup.add(beamPivot);

    // interior light shaft, lamp → chart table, through the oculus
    const shaftGeo = new THREE.CylinderGeometry(0.9, 1.4, 21.3, 10, 1, true);
    const shaftMat = makeBeamMaterial(0xffe2a8);
    shaftMat.uniforms.uFlip.value = 1; // lit from the lamp above
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    shaft.position.set(0, 11.6, 0);
    shaft.name = 'shaftBeam';
    lhGroup.add(shaft);
  }

  // =================== THE STUDY ============================================
  const study = new THREE.Group();
  study.name = 'study';
  study.position.copy(LH);
  core.add(study);

  // chart table: 3.0 × 3.0 m, brass-rimmed basin holding the model
  {
    const topG = new THREE.BoxGeometry(3.1, 0.14, 3.1);
    stone.add(topG, place(LH.x, LH.y + 0.88, LH.z), grad(C.woodDark, C.wood));
    topG.dispose();
    for (const [lx, lz] of [[-1.25, -1.25], [1.25, -1.25], [-1.25, 1.25], [1.25, 1.25]]) {
      const leg = new THREE.BoxGeometry(0.18, 0.9, 0.18);
      stone.add(leg, place(LH.x + lx, LH.y + 0.45, LH.z + lz), grad(C.woodDark, C.wood));
      leg.dispose();
    }
    // brass rim
    const rim = new THREE.BoxGeometry(3.3, 0.18, 0.12);
    for (const [dx, dz, ry] of [[0, 1.6, 0], [0, -1.6, 0], [1.6, 0, Math.PI / 2], [-1.6, 0, Math.PI / 2]]) {
      brass.add(rim, place(LH.x + dx, LH.y + 0.97, LH.z + dz, ry), grad(C.brassDark, C.brass));
    }
    rim.dispose();
  }
  // the chart-table surface is a sheet of aged vellum — the cartographer's chart, with the
  // island's own 1:240 model standing on it. A thin plane just above the table top, inside the
  // brass rim and below the model, so the chart paper shows in the border around the model.
  {
    const sheetMat = new THREE.MeshStandardMaterial({ color: 0xd2ccbe, roughness: 0.96, flatShading: true });
    applyRelief(sheetMat, 'chart_vellum', { normalScale: 0.3, strength: 1.2 });   // faint paper-fibre relief
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(2.95, 2.95), sheetMat);
    sheet.rotation.x = -Math.PI / 2;
    sheet.position.set(LH.x, LH.y + 0.953, LH.z);
    sheet.name = 'chartSheet';
    core.add(sheet);
  }
  // the keeper's logbook, left closed on the clear west margin of the chart table — the
  // first readable fragment (the reading surface). Click it to open and read his account:
  // the lens-grinding, the rising sea, the model built to hold one whole day back.
  {
    const book = new THREE.Group();
    book.name = 'logbook';
    const cover = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.072, 0.42), matWood);
    book.add(cover);
    const leaves = new THREE.Mesh(
      new THREE.BoxGeometry(0.272, 0.052, 0.392),
      new THREE.MeshStandardMaterial({ color: 0xded3ba, roughness: 0.95, flatShading: true }),
    );
    leaves.position.y = 0.006;
    book.add(leaves);
    book.position.set(LH.x - 1.40, LH.y + 0.99, LH.z + 0.66);
    book.rotation.y = 0.22;
    core.add(book);
  }
  // a line of the keeper's lampblack on the chart margin, too fine to read by eye — INVISIBLE
  // until you hold his reading glass (the found-lens reveal; opacity driven by F.readGlass in
  // puzzles _apply, then it's a readable hotspot → lens_mark_study).
  {
    const mk = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x6f5630, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    mk.rotation.x = -Math.PI / 2;
    mk.position.set(LH.x - 1.40, LH.y + 0.957, LH.z + 0.05);
    mk.name = 'lensMarkStudy';
    core.add(mk);
  }
  // the model sits here (filled in later with the clone)
  const modelAnchor = new THREE.Group();
  modelAnchor.name = 'modelAnchor';
  modelAnchor.position.set(LH.x, LH.y + 1.01, LH.z);
  core.add(modelAnchor);

  // the cartographer annotated their own model: small burnished marks on
  // the table margin by each station — a tide glyph by the valve, a sun
  // glyph by the crank, the plumb diagram facing the model's beach (the
  // same hand as the cellar carve), and a tiny paired maker's mark tucked
  // in the south-east corner. No words anywhere; the same hand, everywhere.
  {
    const mark = (gi, x, z, s, rz, op) => {
      const g = glyphSprite(atlas, gi, 0xc08a3e, s);
      g.rotation.x = -Math.PI / 2;
      g.rotation.z = rz;
      g.position.set(x, LH.y + 0.956, z);
      g.material.opacity = op;
      core.add(g);
    };
    // the margin band is only 25 cm wide (model water sheet edge 1.29 to
    // rim inner face 1.54) — marks must fit inside it or duck under the sheet
    mark(2, LH.x + 1.405, LH.z + 1.02, 0.2, 0.4, 0.65);   // tide, by the valve
    mark(7, LH.x - 1.405, LH.z - 1.02, 0.2, -1.1, 0.65);  // sun, by the crank
    mark(4, LH.x - 0.02, LH.z - 1.405, 0.2, 0.05, 0.7);   // plumb, facing the model's beach
    mark(1, LH.x + 1.33, LH.z - 1.38, 0.17, 0.3, 0.55);   // the maker's pair
    mark(0, LH.x + 1.46, LH.z - 1.35, 0.13, -0.2, 0.55);
  }

  // the count of descents, raw-scratched into the clear east margin — one stroke
  // per dive, in a cruder hand than the burnished glyphs around it. The table
  // keeps a tally of how many times you have gone down; and because the model
  // carries every mark its island does, the count recurses inward, table within
  // table. Hidden until you descend (driven by W.level in puzzles `_apply`), so
  // it accrues in-play. SPINE "Borrowed from the 90s": the house remembers.
  {
    const tally = new THREE.Group();
    tally.name = 'chartTally';
    const tMat = new THREE.MeshBasicMaterial({
      color: 0xceae6a, transparent: true, opacity: 0.62,
      depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    // small hand jitter per stroke (dx, rotZ, length) — scratched, not printed
    const JIT = [[-0.004, 0.07, 0.158], [0.006, -0.06, 0.172], [-0.002, 0.03, 0.149]];
    for (let i = 0; i < MAX_DEPTH - 1; i++) {
      const [dx, rz, len] = JIT[i % JIT.length];
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.026), tMat);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = rz;
      m.position.set(LH.x + 1.43 + dx, LH.y + 0.9575, LH.z - 0.18 + i * 0.18);
      m.visible = false;       // revealed one-per-descent by _apply
      tally.add(m);
    }
    core.add(tally);
  }

  // valve pedestal + wheel (tide)
  {
    const ped = new THREE.CylinderGeometry(0.14, 0.2, 1.0, 8);
    brass.add(ped, place(LH.x + 2.3, LH.y + 0.5, LH.z + 1.1), grad(C.brassDark, C.brass));
    ped.dispose();
    const wheel = new THREE.Group();
    wheel.position.set(LH.x + 2.3, LH.y + 1.1, LH.z + 1.1);
    wheel.rotation.x = -0.5;
    wheel.name = 'valveWheel';
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.05, 6, 18), matBrassSolid);
    wheel.add(ring);
    for (let i = 0; i < 4; i++) {
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.76, 5), matBrassSolid);
      spoke.rotation.z = (i / 4) * TAU + Math.PI / 4;
      wheel.add(spoke);
    }
    core.add(wheel);
  }

  // orrery: brass arm + sun-lamp orbiting the model (drives/displays the sky)
  {
    const orrery = new THREE.Group();
    orrery.position.set(LH.x, LH.y + 1.02, LH.z);
    orrery.name = 'orreryPivot';
    const tilt = new THREE.Group();
    tilt.name = 'orreryTilt';
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 1.75, 6), matBrassSolid);
    arm.rotation.z = Math.PI / 2;
    arm.position.x = 0.875;
    tilt.add(arm);
    const lampBall = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), matLamp);
    lampBall.position.x = 1.75;
    lampBall.name = 'orreryLamp';
    tilt.add(lampBall);
    orrery.add(tilt);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.16, 8), matBrassSolid);
    orrery.add(hub);
    core.add(orrery);

    // crank handle on the table edge — the player's grip on the sun
    const crank = new THREE.Group();
    crank.position.set(LH.x - 1.7, LH.y + 0.95, LH.z - 1.1);
    crank.name = 'crankHandle';
    const crankAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 6), matBrassSolid);
    crankAxle.rotation.z = Math.PI / 2;
    crank.add(crankAxle);
    const crankArm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.06), matBrassSolid);
    crankArm.position.set(0.18, 0.12, 0);
    crank.add(crankArm);
    const crankKnob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), matWood);
    crankKnob.position.set(0.18, 0.28, 0);
    crank.add(crankKnob);
    core.add(crank);
  }

  // music box on a wall shelf
  {
    const shelf = new THREE.BoxGeometry(1.2, 0.08, 0.5);
    stone.add(shelf, place(LH.x - 3.6, LH.y + 1.25, LH.z - 2.6, deg(35)), grad(C.woodDark, C.wood));
    shelf.dispose();
    const box = new THREE.Group();
    box.position.set(LH.x - 3.6, LH.y + 1.42, LH.z - 2.6);
    box.rotation.y = deg(35);
    box.name = 'musicBox';
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.3), matBrassSolid);
    box.add(body);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 0.3), matWood);
    lid.position.set(0, 0.12, -0.0);
    lid.name = 'musicBoxLid';
    box.add(lid);
    core.add(box);

    // a folded note resting on the shelf beside the music box — a readable fragment (music_note)
    // tying the box's five-note tune to the keeper's grief. Separate mesh (NOT a child of the box,
    // whose hotspot raycasts its children) so it's its own hotspot.
    const note = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.14),
      new THREE.MeshStandardMaterial({ color: 0xded3ba, roughness: 0.95, flatShading: true }));
    note.position.set(LH.x - 3.78, LH.y + 1.34, LH.z - 2.78);
    note.rotation.set(0, deg(35) + 0.4, 0.04);
    note.name = 'musicNote';
    core.add(note);
  }

  // bookshelves (baked)
  {
    for (let s = 0; s < 2; s++) {
      const a0 = deg(285 + s * 38);
      for (let sh = 0; sh < 3; sh++) {
        const shelf = new THREE.BoxGeometry(2.0, 0.07, 0.45);
        stone.add(shelf, place(LH.x + Math.sin(a0) * 4.4, LH.y + 0.6 + sh * 0.62, LH.z + Math.cos(a0) * 4.4, a0), grad(C.woodDark, C.wood));
        shelf.dispose();
        let bx = -0.85;
        while (bx < 0.85) {
          const bw = 0.07 + r() * 0.09, bh = 0.3 + r() * 0.22;
          const book = new THREE.BoxGeometry(bw, bh, 0.3);
          const bc = vary(r() > 0.5 ? C.cloth : C.copperDark, r, 0.1, 0.2, 0.16);
          stone.add(book, place(
            LH.x + Math.sin(a0) * 4.4 + Math.cos(a0) * bx,
            LH.y + 0.64 + sh * 0.62 + bh / 2,
            LH.z + Math.cos(a0) * 4.4 - Math.sin(a0) * bx, a0), () => bc);
          book.dispose();
          bx += bw + 0.015;
        }
      }
    }
  }

  // plumb mechanism over the table + brass floor plate (the dive spot)
  {
    const pulley = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 10), matBrassSolid);
    pulley.rotation.x = Math.PI / 2;
    pulley.position.set(LH.x, LH.y + 4.4, LH.z);
    core.add(pulley);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.02, 5, 10, Math.PI * 1.4), matBrassSolid);
    hook.position.set(LH.x, LH.y + 4.2, LH.z);
    hook.name = 'plumbHook';
    core.add(hook);
    // hung plumb line + bob (hidden until hung)
    const hung = new THREE.Group();
    hung.name = 'plumbHung';
    hung.visible = false;
    // it hangs over the model's BEACH — where you woke, where you will land
    const bx = LH.x + 4 * SCALE_MODEL, bz = LH.z + (-104) * SCALE_MODEL;
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 2.9, 4), matBrassSolid);
    line.position.set(bx, LH.y + 2.72, bz);
    line.rotation.x = 0.13; // slight lean from the centred hook
    hung.add(line);
    const bob = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 8), matBrassSolid);
    bob.rotation.x = Math.PI;
    bob.position.set(bx, LH.y + 1.22, bz - 0.18);
    hung.add(bob);
    core.add(hung);

    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.05, 18), matBrassSolid);
    plate.position.set(LH.x + 2.2, LH.y + 0.03, LH.z - 1.4);
    plate.name = 'deskPlate';
    core.add(plate);
    const plateRing = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.02, 5, 24), matWood);
    plateRing.rotation.x = Math.PI / 2;
    plateRing.position.set(LH.x + 2.2, LH.y + 0.06, LH.z - 1.4);
    core.add(plateRing);
    // a soft amber glow that wakes on the plate ONLY at the bottom (Panel #4 #1, the visual
    // half of discoverability): when there is nowhere further down, the way back GLINTS, so a
    // player who came to ring the bell still sees the plate is live. A Sprite (clone-safe; a
    // Points here would crash instantiateModel); driven by W.level in puzzles _apply.
    const plateGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: radialGlowTex(), color: 0xffb45a, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    plateGlow.position.set(LH.x + 2.2, LH.y + 0.14, LH.z - 1.4);
    plateGlow.scale.setScalar(1.7);
    plateGlow.name = 'plateGlow';
    core.add(plateGlow);
  }

  // =================== THE ANNEX (locked until one level down) ==============
  {
    const aa = deg(15); // north-ish attachment
    const ax = LH.x + Math.sin(aa) * (baseR + 2.2), az = LH.z + Math.cos(aa) * (baseR + 2.2);
    const wall = new THREE.CylinderGeometry(2.7, 2.8, 3.4, 12, 1, true, aa + deg(140), deg(280));
    stone.add(wall, new THREE.Matrix4().makeTranslation(ax, LH.y + 1.7, az), grad(C.boneDark, C.bone));
    wall.dispose();
    const roof = new THREE.ConeGeometry(3.0, 1.4, 12);
    stone.add(roof, new THREE.Matrix4().makeTranslation(ax, LH.y + 4.1, az), grad(C.copperDark, C.copper));
    roof.dispose();
    const afloor = new THREE.CylinderGeometry(2.8, 2.8, 0.2, 12);
    stone.add(afloor, new THREE.Matrix4().makeTranslation(ax, LH.y - 0.03, az), grad(C.stoneOld, C.boneDark));
    afloor.dispose();

    // inner door between study and annex
    const innerDoor = new THREE.Group();
    const da = aa + Math.PI; // facing the study
    innerDoor.position.set(ax + Math.sin(da) * 2.55 - 0.8, LH.y + 1.55, az + Math.cos(da) * 2.55);
    innerDoor.name = 'innerDoor';
    const idoor = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3.1, 0.1), matWood);
    idoor.position.x = 0.75;
    innerDoor.add(idoor);
    core.add(innerDoor);

    // contents: coat on a hook, footprints, the bell — and a second, smaller desk
    const hookM = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.25, 5), matBrassSolid);
    hookM.rotation.x = Math.PI / 3;
    hookM.position.set(ax - 1.9, LH.y + 1.9, az + 0.6);
    core.add(hookM);
    const coat = new THREE.Group();
    coat.name = 'coat';
    const coatMat = new THREE.MeshStandardMaterial({ color: 0x6a6f74, flatShading: true, roughness: 0.9 }); // lightened so the weave reads
    applyRelief(coatMat, 'cloth', { normalScale: 0.6, strength: 2.0 });   // the keeper's coat — a coarse
                                      // weathered burlap weave, now with woven-thread relief under the lamp
    const coatBody = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.5, 8), coatMat);
    coatBody.position.set(ax - 1.9, LH.y + 1.2, az + 0.6);
    coat.add(coatBody);
    // the maker's pair once more, stitched small at the hem — the same
    // hand that signed the table and the bell wore this coat
    const stitch = (gi, ox, oy, s, rz) => {
      const g = glyphSprite(atlas, gi, 0xc08a3e, s);
      const dir = Math.atan2(1.9, -0.6); // outward, toward the annex room
      g.position.set(ax - 1.9 + Math.sin(dir) * 0.34 + ox, LH.y + oy, az + 0.6 + Math.cos(dir) * 0.34);
      g.rotation.y = dir;
      g.rotation.z = rz;
      g.material.opacity = 0.45;
      coat.add(g);
    };
    stitch(1, -0.02, 0.78, 0.11, 0.25);
    stitch(0, 0.09, 0.72, 0.085, -0.1);
    core.add(coat);

    const prints = new THREE.Group();
    prints.name = 'footprints';
    const printMat = new THREE.MeshBasicMaterial({ color: 0x141009, transparent: true, opacity: 0.5 });
    for (let i = 0; i < 7; i++) {
      const p = new THREE.Mesh(new THREE.CircleGeometry(0.09, 8), printMat);
      p.rotation.x = -Math.PI / 2;
      p.scale.y = 1.8;
      const t = i / 6;
      p.position.set(
        lerp(LH.x + Math.sin(aa) * 4.5, ax + 0.4, t) + (i % 2 ? 0.16 : -0.16),
        LH.y + 0.02,
        lerp(LH.z + Math.cos(aa) * 4.5, az + 0.4, t));
      prints.add(p);
    }
    core.add(prints);

    const bellStand = new THREE.CylinderGeometry(0.1, 0.16, 1.1, 8);
    brass.add(bellStand, place(ax + 1.0, LH.y + 0.55, az - 0.4), grad(C.brassDark, C.brass));
    bellStand.dispose();
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8, 0, TAU, 0, Math.PI * 0.55), matBrassSolid);
    bell.position.set(ax + 1.0, LH.y + 1.35, az - 0.4);
    bell.name = 'bell';
    core.add(bell);

    // the maker's pair once more, small on the floor by the bell stand —
    // the hand that signed the chart table also built the way out
    const sig = (gi, x, z, s, rz) => {
      const g = glyphSprite(atlas, gi, 0xc08a3e, s);
      g.rotation.x = -Math.PI / 2;
      g.rotation.z = rz;
      g.position.set(x, LH.y + 0.078, z);
      g.material.opacity = 0.5;
      core.add(g);
    };
    sig(1, ax + 0.6, az - 0.06, 0.17, 0.4);
    sig(0, ax + 0.76, az + 0.07, 0.13, -0.15);
  }

  // =================== THE KEEPER'S QUARTERS (#15) =========================
  // The annex IS the keeper's room — furnish it into a life left mid-sentence:
  // a cot, a cold dead stove, and on the far wall the recursion drawn in his own
  // hand, nested islands shrinking to a single lit dot. The one WARM lamp (its
  // point-light lives in main.js, gated to depth) is the hearth the cold descent
  // threatens — darkness defined by a light, not a black frame. He KNEW where it
  // led and drew himself down it anyway. Static geometry: hidden behind the
  // closed inner door at the surface, revealed when you go one level down.
  {
    const aa = deg(15);
    const ax = LH.x + Math.sin(aa) * (baseR + 2.2), az = LH.z + Math.cos(aa) * (baseR + 2.2);
    const q = new THREE.Group();
    q.name = 'quarters';
    q.position.set(ax, LH.y, az);
    q.rotation.y = aa;                       // local +z → far wall, +x → along it
    core.add(q);
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a4632, flatShading: true, roughness: 0.92 });
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x20242a, flatShading: true, roughness: 0.8, metalness: 0.3 });

    // the cot — against the far-left wall, the blanket cold and unmade
    const cot = new THREE.Group(); cot.position.set(-0.95, 0, 1.35);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.34, 0.78), woodMat); frame.position.y = 0.21; cot.add(frame);
    const blanket = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.18, 0.64),
      new THREE.MeshStandardMaterial({ color: 0x3a4654, flatShading: true, roughness: 0.95 }));
    blanket.position.y = 0.45; cot.add(blanket);
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.56),
      new THREE.MeshStandardMaterial({ color: 0x756b5c, flatShading: true, roughness: 1 }));
    pillow.position.set(-0.62, 0.51, 0); cot.add(pillow);
    q.add(cot);

    // the cold stove — fire long dead, its mouth a black hole; the contrast the
    // warm lamp needs
    const stove = new THREE.Group(); stove.position.set(1.4, 0, 1.2);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.82, 10), ironMat); body.position.y = 0.41; stove.add(body);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 10), ironMat); lid.position.y = 0.85; stove.add(lid);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 2.5, 8), ironMat); pipe.position.y = 2.05; stove.add(pipe);
    const mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.26), new THREE.MeshBasicMaterial({ color: 0x070504 })); mouth.position.set(0, 0.41, 0.401); stove.add(mouth);
    q.add(stove);

    // the wound: the recursion drawn by his own hand — nested islands receding
    // to a single warm dot, pinned to the far wall (echoes the nestedGlint)
    const sketch = new THREE.Group(); sketch.position.set(-0.15, 1.75, 2.32); sketch.rotation.y = Math.PI;
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.9),
      new THREE.MeshStandardMaterial({ color: 0xc9bd9e, roughness: 1, side: THREE.DoubleSide }));
    sketch.add(paper);
    const inkMat = new THREE.MeshBasicMaterial({ color: 0x241b12 });
    for (let i = 0; i < 7; i++) {
      const rr = 0.4 - i * 0.052;
      const ring = new THREE.Mesh(new THREE.RingGeometry(rr - 0.014, rr, 22), inkMat);
      ring.position.set(-0.022 * i, -0.022 * i, 0.006 + i * 0.0012);
      ring.scale.y = 0.82;                   // islands, not circles
      sketch.add(ring);
    }
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.02, 10), new THREE.MeshBasicMaterial({ color: 0xffd98a }));
    dot.position.set(-0.022 * 6, -0.022 * 6, 0.02);
    sketch.add(dot);
    q.add(sketch);

    // the warm lamp source, hung over the room (the point-light is in main.js)
    const lamp = new THREE.Group(); lamp.position.set(0.05, 0, 0.55);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 5), matBrassSolid); rod.position.y = 2.78; lamp.add(rod);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.16, 8), matBrassSolid); cap.position.y = 2.42; lamp.add(cap);
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xffe6b0, emissive: 0xffb45a, emissiveIntensity: 2.4, flatShading: true }));
    globe.position.y = 2.28; lamp.add(globe);
    q.add(lamp);

    // the keeper's PRIVATE journal, left on the cot by the pillow — the intimate counterpart to
    // the chart-table logbook (the reading surface). Found only here, behind the inner door, one
    // level down; its deep page turns toward the descent. A worn dark book; click to read it.
    const jbook = new THREE.Group(); jbook.name = 'quartersJournal';
    const jcover = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.06, 0.36), woodMat);
    jbook.add(jcover);
    const jleaves = new THREE.Mesh(new THREE.BoxGeometry(0.235, 0.045, 0.335),
      new THREE.MeshStandardMaterial({ color: 0xded3ba, roughness: 0.95, flatShading: true }));
    jleaves.position.y = 0.005; jbook.add(jleaves);
    jbook.position.set(-1.2, 0.57, 1.32);     // on the cot blanket, near the pillow
    jbook.rotation.y = -0.5;
    q.add(jbook);
  }

  // =================== THE DROWNED GALLERY (#16 — sealed vista) =============
  // The sea you woke beside hides a drowned colonnade. At high tide only its
  // capitals break the surface off the beach; turn the valve and as the water
  // falls a sunken hall stands revealed on the exposed flats, at the lip of the
  // deep shelf. Draining is not safe — it OPENS things below; descent, not the
  // 240x gimmick, is the real direction. A SEALED VISTA: seen plainly from the
  // wake-up beach looking seaward, the walkable sunless interior the follow-up.
  // Static decorative geometry on the tidal shelf (no collision/walkability
  // change); the existing water hides it and draining reveals it.
  let galleryGlow = null;
  {
    const drownedMat = new THREE.MeshStandardMaterial({ color: 0x39424a, flatShading: true, roughness: 0.55, metalness: 0.15 });
    const ROWS = [0, 8];                              // two colonnades flanking a seaward aisle
    const ZS = [-108, -111.5, -115, -118.5];
    const gallery = new THREE.Group(); gallery.name = 'drownedGallery';
    // the colonnade is many identical single-material pieces — instance it so the
    // whole hall (and its model clone) costs 3 draw calls, not 18 (perf, loop #47)
    const gm4 = new THREE.Matrix4();
    const nCol = ZS.length * ROWS.length;
    const colInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.62, 0.82, 7.6, 9), drownedMat, nCol);
    const capInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1.9, 0.4, 1.9), drownedMat, nCol);
    let ci = 0;
    for (const z of ZS) {
      for (const x of ROWS) {
        gm4.makeTranslation(x, -2.2, z); colInst.setMatrixAt(ci, gm4);  // rooted at -6, top +1.6
        gm4.makeTranslation(x, 1.45, z); capInst.setMatrixAt(ci, gm4);
        addCollider(x, z, 0.75);                                        // solid when the hall is drained + walkable
        ci++;
      }
    }
    const lintelInst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.62, 12.5), drownedMat, ROWS.length);
    ROWS.forEach((x, i) => { gm4.makeTranslation(x, 1.55, -113.25); lintelInst.setMatrixAt(i, gm4); });
    for (const inst of [colInst, capInst, lintelInst]) inst.computeBoundingSphere();
    gallery.add(colInst, capInst, lintelInst);
    core.add(gallery);
    // cold drowned-light over the flooded floor — the sunless luminance, exposed
    // as the tide falls. Kept OUT of core: it's a Points, and instantiateModel
    // strips Points mid-traverse while cloning core (which chokes). Added to
    // diveGroup in main, like biolume; driven there (shows as the tide falls).
    const glintPos = [];
    for (let i = 0; i < 44; i++) glintPos.push(-2 + r() * 12, -3.6 + r() * 0.6, -106 - r() * 15);
    galleryGlow = makeGlowPoints(glintPos, 0x4fd8d0, 0.34);
    galleryGlow.name = 'galleryGlow';
  }

  // SEA-STRATA L3 'midwater' (loop #124): a field of cold bioluminal motes drifting over the
  // drowned island — the only kind light in the lightless deep, by which you navigate at L3.
  // A Points (1 draw), kept OUT of core like galleryGlow (core.clone chokes on Points); added to
  // diveGroup + shown only at W.level>=3. Own rng so it never shifts the world scatter.
  const l3motePos = [];
  {
    const mr = mulberry32(SEED ^ 0x3c0d);
    for (let i = 0; i < 150; i++) {
      l3motePos.push(-55 + mr() * 190, 1.4 + mr() * 3.6, -130 + mr() * 180);   // around/above the L3 water (~+2.7)
    }
  }
  const l3motes = makeGlowPoints(l3motePos, 0x66cfe6, 0.5);
  l3motes.name = 'l3motes';

  // =================== THE THRESHOLD (#24 — jetty + dory) ===================
  // The way out, made physical: a little jetty reaching off the wake-up beach
  // into the sea, and a beached dory on the sand beside it. They do nothing for
  // most of the game — a standing promise that this island CAN be left (the
  // owner's question, answered in space). Additive decorative geometry, no
  // collision/walkability change, set west of the drowned colonnade.
  {
    const weather = new THREE.MeshStandardMaterial({ color: 0x8a7050, flatShading: true, roughness: 0.95 });
    // weathered driftwood grain on the jetty + dory — the first Bender asset, loaded through
    // the asset manifest (assets.js). They are the only wood props and the only users of this
    // material; the 1:240 model clone shares it (the grain is invisible at that scale). The
    // base colour is lightened toward bone so the texture multiplies to weathered grey-brown.
    applyRelief(weather, 'driftwood', { normalScale: 0.7, strength: 2.2 });   // cracked-plank relief on the jetty + dory
    const jx = -18;
    const jetty = new THREE.Group(); jetty.name = 'jetty';
    const deck = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.16, 12), weather);
    deck.position.set(jx, 1.05, -110.5); jetty.add(deck);
    // planks/posts/bollards are identical single-material repeats — instance each
    // run so the jetty (and its model clone) costs 3 draws, not 19 (perf, loop #47)
    const jm4 = new THREE.Matrix4();
    const plankInst = new THREE.InstancedMesh(new THREE.BoxGeometry(2.5, 0.06, 0.5), weather, 7);
    for (let i = 0; i < 7; i++) { jm4.makeTranslation(jx, 1.16, -105 - i * 1.85); plankInst.setMatrixAt(i, jm4); }
    const postInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.13, 0.16, 4.4, 6), weather, 10);
    let pj = 0;
    for (let i = 0; i < 5; i++) {                       // posts to the seabed
      const z = -105.5 - i * 2.6;
      for (const px of [jx - 1.05, jx + 1.05]) { jm4.makeTranslation(px, -1.1, z); postInst.setMatrixAt(pj++, jm4); }
    }
    const bollardInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.18, 1.5, 6), weather, 2);
    [jx - 1.0, jx + 1.0].forEach((px, i) => { jm4.makeTranslation(px, 1.75, -116.2); bollardInst.setMatrixAt(i, jm4); });
    for (const inst of [plankInst, postInst, bollardInst]) inst.computeBoundingSphere();
    jetty.add(plankInst, postInst, bollardInst);
    // a lantern on a post at the jetty's end — the way out, kept lit. Someone
    // leaves a light for a return that may never come (the point-light is in
    // main.js, warm and brightening at night, like a small shore beacon).
    const lpost = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.8, 6), weather);
    lpost.position.set(jx + 0.9, 2.45, -115.4); jetty.add(lpost);
    const larm = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.08), weather);
    larm.position.set(jx + 0.62, 3.75, -115.4); jetty.add(larm);
    const lglobe = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xffe6b0, emissive: 0xffc06a, emissiveIntensity: 1.5, flatShading: true }));
    lglobe.position.set(jx + 0.33, 3.66, -115.4); lglobe.name = 'jettyLantern'; jetty.add(lglobe);
    // a soft halo that blooms around the globe at night — the beacon read as light,
    // not just an emissive dot (driven by `night` in main.js applyAtmosphere). A
    // billboarded Sprite (clone-safe; a Points here would crash instantiateModel).
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: radialGlowTex(), color: 0xffc483, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    halo.position.copy(lglobe.position);
    halo.scale.setScalar(1.4);
    halo.name = 'jettyHalo';
    jetty.add(halo);
    core.add(jetty);

    // a low standing stone at the foot of the jetty, where a body would wash up — its face
    // cut with words worn soft by the sea (the stone_inscription fragment). Granite, like the
    // islet's standing stones; click to read what those who went down left for whoever arrives.
    {
      const ix = jx + 2.0, iz = -103.2;
      const ig = new THREE.BoxGeometry(1.25, 1.7, 0.34);
      const ipa = ig.attributes.position;
      for (let v = 0; v < ipa.count; v++) {                 // taper the crown, like the standing stones
        if (ipa.getY(v) > 0) { ipa.setX(v, ipa.getX(v) * 0.78); ipa.setZ(v, ipa.getZ(v) * 0.8); }
      }
      ig.computeVertexNormals();
      const icols = new Float32Array(ipa.count * 3);
      const iBase = vary(C.stoneOld, r, 0.02, 0.05, 0.06);
      for (let v = 0; v < ipa.count; v++) {
        const t = (ipa.getY(v) / 1.7) + 0.5;
        const cc = iBase.clone().lerp(C.bone, t * 0.35);
        icols[v * 3] = cc.r; icols[v * 3 + 1] = cc.g; icols[v * 3 + 2] = cc.b;
      }
      ig.setAttribute('color', new THREE.BufferAttribute(icols, 3));
      const slab = new THREE.Mesh(ig, matStone);
      slab.name = 'inscribedStone';
      slab.position.set(ix, heightAt(ix, iz) + 0.62, iz);
      slab.rotation.y = -0.6;       // face turned toward the jetty / the one arriving
      slab.castShadow = true;
      core.add(slab);
    }

    // a corked bottle half-buried at the wake-up beach — the FIRST readable fragment most
    // players meet (the reading surface, surface tier): a note washed up in the sand, an
    // invitation. A curl of paper shows through the green sea-glass; click to read it.
    {
      const bx = 6.5, bz = -101;
      const bottle = new THREE.Group();
      bottle.name = 'messageBottle';
      const glass = new THREE.MeshStandardMaterial({ color: 0x4a7a5e, transparent: true, opacity: 0.5, roughness: 0.22, metalness: 0 });
      bottle.add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.46, 10), glass));
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.07, 0.2, 8), glass);
      neck.position.y = 0.32; bottle.add(neck);
      const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.08, 8),
        new THREE.MeshStandardMaterial({ color: 0x8a6b3e, roughness: 1 }));
      cork.position.y = 0.45; bottle.add(cork);
      const note = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.34, 6),
        new THREE.MeshBasicMaterial({ color: 0xe8dcc0 }));    // the curl of paper inside
      note.rotation.z = 0.2; bottle.add(note);
      bottle.position.set(bx, heightAt(bx, bz) + 0.08, bz);
      bottle.rotation.z = Math.PI / 2 - 0.22;                 // lying tilted, half-buried
      bottle.rotation.y = 0.6;
      core.add(bottle);
    }

    // the dory — beached on the dry sand, bow toward the water, keeled over
    const dory = new THREE.Group(); dory.name = 'dory';
    dory.position.set(-26, heightAt(-26, -102) + 0.3, -102);
    addCollider(-26, -102, 1.5);   // the beached boat is solid (was walk-through)
    dory.rotation.y = 0.7; dory.rotation.z = 0.13;
    const hg = new THREE.BoxGeometry(1.3, 0.52, 3.1, 1, 1, 5);
    const pa = hg.attributes.position;
    for (let v = 0; v < pa.count; v++) {
      const y = pa.getY(v), z = pa.getZ(v);
      let nx = pa.getX(v);
      nx *= 1 - Math.min(Math.abs(z) / 1.55, 1) * 0.86;   // pinch bow & stern
      if (y < 0) nx *= 0.55;                              // narrow the keel
      pa.setX(v, nx);
    }
    hg.computeVertexNormals();
    const hull = new THREE.Mesh(hg, weather); hull.name = 'doryHull'; dory.add(hull);
    for (const tz of [-0.7, 0.7]) {                      // thwarts (seat planks)
      const thwart = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.07, 0.22), weather);
      thwart.position.set(0, 0.16, tz); dory.add(thwart);
    }
    const oar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 2.5, 6), weather);
    oar.position.set(0.25, 0.28, -0.2); oar.rotation.x = 0.45; oar.rotation.z = 0.5;
    oar.name = 'doryOar'; dory.add(oar);
    core.add(dory);

    // a wet-PEBBLE apron draped over the south wake-up-beach waterline — the shingle where the sea
    // meets the sand (the campaign's shoreline detail). A thin PlaneGeometry strip y-conformed to
    // the terrain so it never floats/z-fights; the seaward edge sits under the shallow water (wet
    // pebbles), the landward edge on the wet sand. Decorative, no collision. ONE mesh.
    {
      const cx = -8, cz = -102.5, w = 48, d = 8, nx = 40, nz = 10;   // band: waterline (z~-106.5) up the beach (z~-98.5), room for pebbles to gradient into sand
      const ag = new THREE.PlaneGeometry(w, d, nx, nz);
      ag.rotateX(-Math.PI / 2);
      const ap = ag.attributes.position;
      for (let v = 0; v < ap.count; v++) {
        const wx = ap.getX(v) + cx, wz = ap.getZ(v) + cz;
        ap.setX(v, wx); ap.setZ(v, wz);
        ap.setY(v, heightAt(wx, wz) + 0.04);                      // drape on the shore
      }
      ag.computeVertexNormals();
      const apronMat = new THREE.MeshStandardMaterial({ color: 0xb9b3a6, roughness: 0.9, flatShading: true });
      applyRelief(apronMat, 'pebble', { normalScale: 0.5, strength: 2.0 });
      // DE-TILE the pebbles + GRADIENT-BLEND the shingle into the sand (no hard line anywhere).
      //  - de-tile: warp the albedo sample coord with low-freq value-noise so the [53,12] column
      //    lattice dissolves. Compile-safe: sample a warped LOCAL, never mutate the read-only vMapUv.
      //  - blend: pebble DENSITY is full at the waterline and thins to nothing up the beach over a
      //    ~6.5m band, gated by a per-pebble value-noise threshold so the thinning SCATTERS (stray
      //    pebbles strand out on the de-tiled sand beneath) rather than ending on a boundary. The
      //    seaward lip + x-ends are softened too. Early discard, +0 texture fetches (pure ALU noise).
      apronMat.onBeforeCompile = (sh) => {
        // carry world XZ to the fragment stage (geometry positions are baked world coords)
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec2 vApW;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vApW = position.xz;');
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\n' +
            'varying vec2 vApW;\n' +
            'float apHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\n' +
            'float apVN(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);\n' +
            '  float a=apHash(i),b=apHash(i+vec2(1.0,0.0)),c=apHash(i+vec2(0.0,1.0)),d=apHash(i+vec2(1.0,1.0));\n' +
            '  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y); }')
          // shingle->sand density gradient (vApW.y = world z; seaward ~-106, landward ~-96):
          .replace('#include <clipping_planes_fragment>',
            '#include <clipping_planes_fragment>\n' +
            '  float apDens = 1.0 - smoothstep(-104.5, -99.0, vApW.y);            // full at the water, ->0 up the beach\n' +
            '  apDens *= smoothstep(-106.5, -105.3, vApW.y);                      // soften the seaward lip into the water\n' +
            '  apDens *= smoothstep(-32.0, -29.5, vApW.x) * smoothstep(16.0, 13.5, vApW.x);  // soften the two ends\n' +
            '  if (apDens < apVN(vApW * 1.3)) discard;                            // noisy threshold -> scattered thinning\n')
          .replace('#include <map_fragment>',
            '#ifdef USE_MAP\n' +
            '  vec2 apWarp = (vec2(apVN(vMapUv * 0.4), apVN(vMapUv * 0.4 + 19.7)) - 0.5) * 0.7;\n' +
            '  vec4 sampledDiffuseColor = texture2D( map, vMapUv + apWarp );\n' +
            '  diffuseColor *= sampledDiffuseColor;\n' +
            '#endif');
      };
      apronMat.needsUpdate = true;
      const apron = new THREE.Mesh(ag, apronMat);
      apron.name = 'pebbleApron';
      apron.receiveShadow = false;   // flat open-shore pebbles barely catch shadows; skipping the PCF
                                     // sample per fragment cuts the deep strip's grazing-angle GPU cost
      core.add(apron);
    }
  }

  // =================== STANDING STONES (the islet) ==========================
  const stonesGroup = new THREE.Group();
  stonesGroup.name = 'stonesGroup';
  core.add(stonesGroup);
  {
    const SC = new THREE.Vector3(SPOTS.stones.x, 8.8, SPOTS.stones.y);
    for (let i = 0; i < 5; i++) {
      const a = deg(-50 + i * 25); // arc opening north
      const px = SC.x + Math.sin(a) * 6.5, pz = SC.z + Math.cos(a) * 6.5;
      const h = 3.4 + (i % 2) * 0.7 + r() * 0.4;
      const g = new THREE.BoxGeometry(1.1, h, 0.7);
      // taper the top by editing verts
      const pa = g.attributes.position;
      for (let v = 0; v < pa.count; v++) {
        if (pa.getY(v) > 0) {
          pa.setX(v, pa.getX(v) * 0.6);
          pa.setZ(v, pa.getZ(v) * 0.7);
          pa.setY(v, pa.getY(v) + (r() - 0.5) * 0.2);
        }
      }
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, matStone);
      // vertex colors for the stone material
      const cols = new Float32Array(pa.count * 3);
      const cBase = vary(C.stoneOld, r, 0.02, 0.05, 0.06);
      for (let v = 0; v < pa.count; v++) {
        const t = (pa.getY(v) / h) + 0.5;
        const cc = cBase.clone().lerp(C.bone, t * 0.4);
        cols[v * 3] = cc.r; cols[v * 3 + 1] = cc.g; cols[v * 3 + 2] = cc.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      m.position.set(px, heightAt(px, pz) + h / 2 - 0.25, pz);
      addCollider(px, pz, 0.7);   // the standing stones are solid (you played through them)
      m.rotation.y = a + Math.PI + (r() - 0.5) * 0.2;
      m.castShadow = true;
      m.name = `stone${i}`;
      stonesGroup.add(m);

      // glow shell — hums when its tone plays
      const shell = new THREE.Mesh(g.clone(), new THREE.MeshBasicMaterial({
        color: 0x58f2c2, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      shell.scale.setScalar(1.06);
      shell.name = `stoneGlow${i}`;
      m.add(shell);

      // carved music glyph: i dots — etched to read as the clue it is
      // (cellar-carve treatment: bigger, brighter, soft halo), named so
      // _apply can pulse it while the stone's tone sings, and on the
      // INNER face: local +z points at the arc center where the player
      // stands to play — the old -z placement faced the open sea
      const gl = glyphSprite(atlas, [0, 4, 2, 1, 7][i], 0x9adfca, 0.78);
      gl.position.set(0, 0.4, 0.42);
      gl.material.opacity = 0.78;
      gl.name = `stoneMark${i}`;
      m.add(gl);
      const halo = glyphSprite(atlas, [0, 4, 2, 1, 7][i], 0x9adfca, 1.25);
      halo.position.set(0, 0.4, 0.43);
      halo.material.opacity = 0.12;
      m.add(halo);

      // hair-fine letters scratched high on ONE stone's inner face — invisible to the naked
      // eye, revealed only once you hold the reading glass (found-lens reveal → lens_mark_stone).
      if (i === 4) {
        const lm = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.14),
          new THREE.MeshBasicMaterial({ color: 0x6f5630, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
        lm.position.set(0, 1.35, 0.37);
        lm.name = 'lensMarkStone';
        m.add(lm);
      }
    }

    // the song bird, visible at dawn, perched on stone 2
    const bird = new THREE.Group();
    bird.name = 'songBird';
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 6), new THREE.MeshStandardMaterial({ color: 0x3a4e63, flatShading: true }));
    body.rotation.x = Math.PI / 2.4;
    bird.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), new THREE.MeshStandardMaterial({ color: 0x4a6278, flatShading: true }));
    head.position.set(0, 0.12, 0.12);
    bird.add(head);
    const s2 = stonesGroup.getObjectByName('stone2');
    bird.position.copy(s2.position).add(new THREE.Vector3(0, 2.6, 0));
    stonesGroup.add(bird);

    // THE READING GLASS — a hidden found-item half-buried on the islet among the stones. Take it
    // and the keeper's lampblack marks (lens_mark_*), invisible to the naked eye, reveal across
    // the world. A brass loupe catching the light; hotspot in puzzles.js sets W.flags.readGlass.
    const gx = SPOTS.stones.x + 3.2, gz = SPOTS.stones.y + 5.0;
    const glass = new THREE.Group(); glass.name = 'readGlass';
    const gring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 8, 18), matBrassSolid);
    glass.add(gring);
    const gdisc = new THREE.Mesh(new THREE.CircleGeometry(0.15, 18),
      new THREE.MeshStandardMaterial({ color: 0xcfe8ea, transparent: true, opacity: 0.32, roughness: 0.08, metalness: 0, side: THREE.DoubleSide }));
    gdisc.position.z = 0.004; glass.add(gdisc);
    const ghandle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.34, 6), matBrassSolid);
    ghandle.position.set(0, -0.32, 0); glass.add(ghandle);
    glass.position.set(gx, heightAt(gx, gz) + 0.13, gz);
    glass.rotation.set(Math.PI / 2 - 0.5, 0.4, 0.7);   // tilted, half-buried, catching the light
    glass.castShadow = true;
    core.add(glass);
  }

  // =================== VAULT OF THE LENS (in the stones pad) ================
  {
    const SC = SPOTS.stones;
    const ox = SC.x - 11, oz = SC.y - 4;
    const oy = heightAt(ox, oz);
    // rock outcrop
    const rock = new THREE.IcosahedronGeometry(3.2, 1);
    stone.add(rock, place(ox, oy + 1.2, oz, 0.7, 1.3, 0.9, 1.1), grad(C.stoneOld, C.boneDark));
    rock.dispose();
    // sliding slab door (faces the stones)
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.2, 0.3), matStone);
    const scols = new Float32Array(slab.geometry.attributes.position.count * 3);
    for (let v = 0; v < scols.length / 3; v++) { scols[v * 3] = C.boneDark.r; scols[v * 3 + 1] = C.boneDark.g; scols[v * 3 + 2] = C.boneDark.b; }
    slab.geometry.setAttribute('color', new THREE.BufferAttribute(scols, 3));
    slab.position.set(ox + 2.6, oy + 1.0, oz + 0.4);
    slab.rotation.y = deg(105);
    slab.name = 'vaultDoor';
    core.add(slab);
    // niche + pedestal + the lens
    const ped = new THREE.CylinderGeometry(0.18, 0.26, 0.9, 8);
    stone.add(ped, place(ox + 2.0, oy + 0.45, oz + 0.2), grad(C.stoneOld, C.bone));
    ped.dispose();
    const lensItem = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), matLens.clone());
    lensItem.scale.y = 1.3;
    lensItem.position.set(ox + 2.0, oy + 1.1, oz + 0.2);
    lensItem.name = 'lensItem';
    lensItem.visible = false; // revealed behind the slab; toggled visible when door opens
    core.add(lensItem);
  }

  // =================== THE CHEST (tide-exposed, holds the ruler) ============
  {
    const cx = SPOTS.chest.x, cz = SPOTS.chest.y;
    const cy = heightAt(cx, cz);
    const chest = new THREE.Group();
    chest.name = 'chest';
    chest.position.set(cx, cy + 0.1, cz);
    chest.rotation.y = 0.7;
    chest.rotation.z = 0.08;
    const cbody = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.55, 0.6), matWood);
    chest.add(cbody);
    const lid = new THREE.Group();
    lid.position.set(0, 0.27, -0.3);
    lid.name = 'chestLid';
    const lidM = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.6), matWood);
    lidM.position.set(0, 0.07, 0.3);
    lid.add(lidM);
    chest.add(lid);
    for (const dx of [-0.4, 0.4]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 0.64), matBrassSolid);
      band.position.set(dx, 0, 0);
      chest.add(band);
    }
    // the desk ruler inside
    const rulerItem = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.025, 0.09), matBrassSolid);
    rulerItem.position.set(0, 0.12, 0.05);
    rulerItem.rotation.y = 0.3;
    rulerItem.name = 'rulerItem';
    chest.add(rulerItem);
    core.add(chest);
  }

  // =================== THE GIANT RULER (bridges the chasm) ==================
  {
    const deck = new THREE.Group();
    deck.name = 'rulerWorld';
    deck.visible = false;
    const big = new THREE.Mesh(new THREE.BoxGeometry(28, 1.0, 4.4), matBrassSolid);
    big.position.set(47, 17.95, SPOTS.chasmBridgeZ);
    big.castShadow = true;
    deck.add(big);
    // etched centimetre marks, door-sized
    const markMat = new THREE.MeshBasicMaterial({ color: 0x4a3a1c });
    for (let i = 0; i <= 16; i++) {
      const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.18, i % 2 ? 1.0 : 1.9), markMat);
      mark.rotation.x = -Math.PI / 2;
      mark.position.set(34.2 + i * 1.6, 18.47, SPOTS.chasmBridgeZ - 1.2 + (i % 2 ? 0.4 : 0.85));
      deck.add(mark);
    }
    core.add(deck);
  }

  // =================== THE HATCH + CELLAR VAULT (bluff) ======================
  let cellarMotes = null;
  let vaultDrips = null;
  {
    const hx = SPOTS.hatch.x, hz = SPOTS.hatch.y, hy = 23.5;
    // stone ring + brass lid + four glyph dials
    const ring = new THREE.TorusGeometry(1.5, 0.22, 8, 20);
    ring.rotateX(Math.PI / 2);
    stone.add(ring, new THREE.Matrix4().makeTranslation(hx, hy + 0.1, hz), grad(C.stoneOld, C.boneDark));
    ring.dispose();
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(1.28, 1.28, 0.16, 20), matBrassSolid);
    lid.position.set(hx, hy + 0.14, hz);
    lid.name = 'hatchLid';
    core.add(lid);

    for (let i = 0; i < 4; i++) {
      const a = deg(45 + i * 90);
      const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.18, 10), matBrassSolid.clone());
      dial.position.set(hx + Math.sin(a) * 1.95, hy + 0.16, hz + Math.cos(a) * 1.95);
      dial.name = `dial${i}`;
      dial.userData.glyphIndex = 0;
      core.add(dial);
      // glyph shown on top of the dial
      const gl = glyphSprite(atlas, 0, 0xffd9a0, 0.42);
      gl.rotation.x = -Math.PI / 2;
      gl.position.y = 0.1;
      gl.name = `dialGlyph${i}`;
      dial.add(gl);
    }

    // sunshadow shimmer marker (revealed at golden hour)
    const shimmer = new THREE.Mesh(
      new THREE.CircleGeometry(2.2, 24),
      new THREE.MeshBasicMaterial({ color: 0xffc37a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    shimmer.rotation.x = -Math.PI / 2;
    shimmer.position.set(hx, hy + 0.25, hz);
    shimmer.name = 'hatchShimmer';
    core.add(shimmer);

    // the cellar: stair shaft + room, fully enclosed under the bluff
    const cellar = new THREE.Group();
    cellar.name = 'cellar';
    const cm = new THREE.MeshStandardMaterial({ color: 0x6e685c, flatShading: true, roughness: 0.95, side: THREE.BackSide });
    // stair shaft: under the hatch hole, descending southward
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(3.6, 5.4, 11.4), cm);
    shaft.position.set(hx, hy - 2.8, hz - 3.9);
    cellar.add(shaft);
    // the room — rebuilt from panels (was a closed box) so its EAST wall can
    // open onto the Vault Beneath (#17). Floor / ceiling / south(carve) / west
    // kept; north split to flank the shaft doorway; EAST omitted (the opening).
    // The player stays contained by the unchanged walkableY room region; beyond
    // the opening is solid-bluff walkableY, so they look in but cannot walk out.
    const roomMat = new THREE.MeshStandardMaterial({ color: 0x6e685c, flatShading: true, roughness: 0.95, side: THREE.DoubleSide });
    const cy = hy - 3.03, cz = hz - 13.6;          // room centre (20.47, 18.4)
    const yTop = cy + 2.225, yBot = cy - 2.225;
    const panel = (w, h, x, y, z, rx, ry) => {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), roomMat);
      p.position.set(x, y, z); if (rx) p.rotation.x = rx; if (ry) p.rotation.y = ry;
      cellar.add(p);
    };
    panel(9.4, 8.4, hx, yBot, cz, -Math.PI / 2, 0);            // floor
    panel(9.4, 8.4, hx, yTop, cz, -Math.PI / 2, 0);            // ceiling
    panel(9.4, 4.45, hx, cy, hz - 17.8, 0, 0);                 // south (carve wall)
    // WEST wall: a framed window onto The Room That Disagrees (#18) — mirrors east
    panel(8.4, 0.75, hx - 4.7, yTop - 0.375, cz, 0, Math.PI / 2);       // top lintel
    panel(1.7, 3.7, hx - 4.7, cy - 0.35, hz - 10.15, 0, Math.PI / 2);   // north jamb
    panel(1.9, 3.7, hx - 4.7, cy - 0.35, hz - 16.95, 0, Math.PI / 2);   // south jamb
    panel(2.7, 4.45, hx - 3.35, cy, hz - 9.4, 0, 0);           // north — west of the doorway
    panel(2.7, 4.45, hx + 3.35, cy, hz - 9.4, 0, 0);           // north — east of the doorway
    // EAST wall: a framed window onto the vault — a lintel + two jambs seal the
    // corners; the frame crops the inverted tower's top (the rest lost in dark)
    panel(8.4, 0.75, hx + 4.7, yTop - 0.375, cz, 0, Math.PI / 2);       // top lintel
    panel(1.7, 3.7, hx + 4.7, cy - 0.35, hz - 10.15, 0, Math.PI / 2);   // north jamb
    panel(1.9, 3.7, hx + 4.7, cy - 0.35, hz - 16.95, 0, Math.PI / 2);   // south jamb

    // ----- THE VAULT BENEATH (#17): the sublime abyss ------------------------
    // East of the cellar opens a vast dark cavern; a full-size lighthouse hangs
    // INVERTED from its roof, tapering DOWN to a cold lamp still lit far out over
    // black water — the recursion seen as ARCHITECTURE, not a teleport cut. Seen
    // from the cellar ledge, never entered. (cold base glow: vaultGlow in main.js)
    // the vault-vista DECOR (cavern, black water, the inverted lighthouse) — seen ONLY
    // through the cellar window in the full island; pure decoration, nothing state-driven.
    // Wrapped + named so instantiateModel PRUNES it from the 1:240 model clone, where the
    // big BackSide cavern box otherwise pokes up as a black box on the model island (#67).
    const vaultVista = new THREE.Group(); vaultVista.name = 'vaultVista';
    const vaultMat = new THREE.MeshStandardMaterial({ color: 0x12171c, flatShading: true, roughness: 1, side: THREE.BackSide });
    const cavern = new THREE.Mesh(new THREE.BoxGeometry(56, 44, 50), vaultMat);
    cavern.position.set(hx + 4.7 + 28, 26, cz);    // west face flush with the opening
    vaultVista.add(cavern);
    const vwater = new THREE.Mesh(new THREE.PlaneGeometry(54, 48),
      new THREE.MeshStandardMaterial({ color: 0x070b0e, roughness: 0.35, metalness: 0.25, side: THREE.DoubleSide }));
    vwater.rotation.x = -Math.PI / 2; vwater.position.set(hx + 30, 13.5, cz); vaultVista.add(vwater);
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x3a444e, flatShading: true, roughness: 0.85 });
    const ilx = hx + 30, ilz = cz;                  // the inverted lighthouse, across the void
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 1.1, 24, 12), towerMat);
    tower.position.set(ilx, 34, ilz);               // wide top at the roof (y46), narrow at y22
    vaultVista.add(tower);
    const gallery = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 1.4, 12), towerMat);
    gallery.position.set(ilx, 21.4, ilz); vaultVista.add(gallery);
    const lampDome = new THREE.Mesh(new THREE.ConeGeometry(1.3, 1.6, 12), towerMat);
    lampDome.rotation.x = Math.PI; lampDome.position.set(ilx, 20.0, ilz); vaultVista.add(lampDome);
    const vlamp = new THREE.Mesh(new THREE.SphereGeometry(0.72, 12, 9),
      new THREE.MeshStandardMaterial({ color: 0xdcf3f6, emissive: 0x9fdce8, emissiveIntensity: 6, flatShading: true }));
    vlamp.position.set(ilx, 18.9, ilz); vlamp.name = 'vaultLamp'; vaultVista.add(vlamp);   // a bare ember below the dome tip, still lit
    cellar.add(vaultVista);
    // slow drips falling the full height of the void — scale cues; you read how
    // deep the vault is by how long they fall (SPINE). Returned + animated in main.
    vaultDrips = new THREE.Group(); vaultDrips.name = 'vaultDrips';
    const dripMat = new THREE.MeshStandardMaterial({ color: 0xeaf8fb, emissive: 0x9fdcec, emissiveIntensity: 3, flatShading: true });
    for (let i = 0; i < 11; i++) {
      const drop = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.14, 0.8, 5), dripMat);
      // kept within the window's sightline (z near the opening) so they READ as
      // falling through the void, fanned across its depth in x
      drop.userData = { x: hx + 12 + r() * 34, z: cz + (r() - 0.5) * 8.5, phase: r(), speed: 0.34 + r() * 0.16 };
      drop.position.set(drop.userData.x, 45, drop.userData.z);
      vaultDrips.add(drop);
    }
    cellar.add(vaultDrips);

    // ----- THE ROOM THAT DISAGREES (#18, framed static slice) ----------------
    // West of the cellar, a second study like the one above — but the model on
    // its chart table shows a world this one is NOT in: the sea drained that you
    // never drained, a lamp lit that you never lit, and a window onto weather
    // that isn't yours. The whole game taught you the model tells the truth about
    // the world; this room breaks that. (Frozen for the slice; live ghostState +
    // the contradiction deepening are the follow-up.)
    const dgx = hx - 4.7 - 6;        // study centre, west of the framed window
    const dgMat = new THREE.MeshStandardMaterial({ color: 0x6a6456, flatShading: true, roughness: 0.95, side: THREE.BackSide });
    const study2 = new THREE.Mesh(new THREE.BoxGeometry(12, 5, 11), dgMat);
    study2.position.set(dgx, 20.0, cz); cellar.add(study2);                       // east face flush with the window
    const dgWin = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.7),              // a window onto contradicting weather (static)
      new THREE.MeshStandardMaterial({ color: 0xaebfd2, emissive: 0x718aa6, emissiveIntensity: 0.8, flatShading: true, side: THREE.DoubleSide }));
    dgWin.rotation.y = Math.PI / 2; dgWin.position.set(dgx - 5.92, 20.5, cz); cellar.add(dgWin);
    const dgTable = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.22, 2.6), matWood);
    dgTable.position.set(dgx, 18.75, cz); cellar.add(dgTable);
    for (const lx of [-1.5, 1.5]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.4, 2.4), matWood);
      leg.position.set(dgx + lx, 17.95, cz); cellar.add(leg);
    }
    // the contradicting model: an island whose SEA IS DRAINED (dark exposed
    // seabed, no blue), its little lighthouse LAMP LIT
    const dgIsland = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.55, 0.16, 16),
      new THREE.MeshStandardMaterial({ color: 0xb8ad8e, flatShading: true }));
    dgIsland.position.set(dgx, 18.97, cz); cellar.add(dgIsland);
    const dgSeabed = new THREE.Mesh(new THREE.RingGeometry(1.4, 2.3, 22),
      new THREE.MeshStandardMaterial({ color: 0x2c2820, roughness: 1, side: THREE.DoubleSide }));
    dgSeabed.rotation.x = -Math.PI / 2; dgSeabed.position.set(dgx, 18.9, cz); cellar.add(dgSeabed);
    // a flooded sea over the seabed, faded in INVERSELY to the real tide (#18 live
    // ghostState, driven in puzzles._apply): drained when the real sea is full,
    // flooded when you drain it — the model always shows the opposite
    const dgSea = new THREE.Mesh(new THREE.RingGeometry(1.35, 2.35, 22),
      new THREE.MeshStandardMaterial({ color: 0x2f6f74, transparent: true, opacity: 0, roughness: 0.4, metalness: 0.2, side: THREE.DoubleSide }));
    dgSea.rotation.x = -Math.PI / 2; dgSea.position.set(dgx, 18.95, cz); dgSea.name = 'disagreeSea'; cellar.add(dgSea);
    const dgTower = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.7, 8),
      new THREE.MeshStandardMaterial({ color: 0xd8d2c4, flatShading: true }));
    dgTower.position.set(dgx + 0.35, 19.4, cz - 0.25); cellar.add(dgTower);
    const dgLamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xffe6b0, emissive: 0xffc060, emissiveIntensity: 4.5, flatShading: true }));
    dgLamp.position.set(dgx + 0.35, 19.78, cz - 0.25); dgLamp.name = 'disagreeLamp'; cellar.add(dgLamp);
    // stairs (visual steps) — match the walkable ramp from inside the hole
    for (let i = 0; i < 10; i++) {
      const st = new THREE.BoxGeometry(3.0, 0.35, 0.95);
      stone.add(st, place(hx, hy - 0.45 - i * 0.53, hz + 0.4 - i * 0.92), grad(C.stoneOld, C.boneDark));
      st.dispose();
    }
    // pedestal + plumb bob
    const ped = new THREE.CylinderGeometry(0.22, 0.3, 1.0, 8);
    stone.add(ped, place(hx, hy - 4.7, hz - 13.5), grad(C.stoneOld, C.bone));
    ped.dispose();
    const bobG = new THREE.Group();
    bobG.name = 'plumbBob';
    const bob = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 8), matBrassSolid);
    bob.rotation.x = Math.PI;
    bob.position.set(hx, hy - 4.0, hz - 13.5);
    bobG.add(bob);
    const bobRing = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.015, 5, 10), matBrassSolid);
    bobRing.position.set(hx, hy - 3.8, hz - 13.5);
    bobG.add(bobRing);
    cellar.add(bobG);
    // wall carving: the plumb-line diagram (a hint, drawn in glyphs) —
    // sized to read across the room, with a faint halo so the wall holds it
    const carve = glyphSprite(atlas, 4, 0x9adfca, 1.9);
    carve.position.set(hx, hy - 3.4, hz - 17.2);
    cellar.add(carve);
    const carveHalo = glyphSprite(atlas, 4, 0x9adfca, 3.1);
    carveHalo.material.opacity = 0.16;
    carveHalo.position.set(hx, hy - 3.4, hz - 17.25);
    cellar.add(carveHalo);

    // daylight spills down the open hatch: a dusty shaft of it on the stairs
    const cellarShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 1.7, 5.4, 10, 1, true),
      makeBeamMaterial(0xffe2a8));
    cellarShaft.material.uniforms.uFlip.value = 1;
    cellarShaft.position.set(hx, hy - 2.6, hz);
    cellarShaft.name = 'cellarShaft';
    cellar.add(cellarShaft);

    // dust motes hanging in the spill — through the shaft AND the room
    // (two overlapping interior boxes; both volumes need their floaters)
    const moteR = mulberry32(SEED ^ 0xd057);
    const motePos = [];
    for (let i = 0; i < 64; i++) {
      const inRoom = i % 2;
      motePos.push(
        hx + (moteR() - 0.5) * (inRoom ? 7.8 : 2.6),
        hy - 4.9 + moteR() * (inRoom ? 3.6 : 4.9),
        inRoom ? hz - 10.2 - moteR() * 6.6 : hz - 0.4 - moteR() * 8.6);
    }
    cellarMotes = makeGlowPoints(motePos, 0xffe2a8, 0.22);
    cellarMotes.material.uniforms.uDrift.value = 1;
    cellarMotes.name = 'cellarMotes';
    core.add(cellar);
  }

  // =================== THE CLIFF GLYPHS (beam projection) ====================
  {
    const gp = new THREE.Group();
    gp.name = 'glyphPlane';
    gp.visible = false;
    // hug the bluff's west face: raycast the real terrain mesh eastward at
    // eye height and sit each glyph just proud of the rendered rock
    const baseY = 15, baseZ = 42;
    const rc = new THREE.Raycaster();
    for (let i = 0; i < 4; i++) {
      const z = baseZ + i * 4.4;
      rc.set(new THREE.Vector3(30, baseY, z), new THREE.Vector3(1, 0, 0));
      rc.far = 50;
      const hit = rc.intersectObject(terrain, false)[0];
      const xFace = hit ? hit.point.x : 60;
      const gl = glyphSprite(atlas, GLYPH_CODE[i], 0xffe2a8, 3.4);
      gl.position.set(xFace - 1.4, baseY, z);
      gl.rotation.y = -Math.PI / 2; // facing west, toward the lighthouse
      gp.add(gl);
    }
    core.add(gp);
  }

  // =================== VEGETATION ===========================================
  buildVegetation(core, r);

  // =================== TINY FIGURE (the keeper, on the model) ===============
  // The second person — the keeper one level down, standing on the model's
  // beach. The group sits AT the figure's feet so it can turn and tip in place
  // when it "looks back" (#14); children are local offsets. Exaggerated ~3x so
  // it reads as a luminous speck at 1:240.
  {
    const fig = new THREE.Group();
    fig.name = 'tinyFigure';
    fig.visible = false;
    const fy = heightAt(SPOTS.beach.x, SPOTS.beach.y);
    fig.position.set(SPOTS.beach.x, fy, SPOTS.beach.y);
    fig.userData.baseY = fy;   // the twist's rise (puzzles _apply) lifts from here
    const fb = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 3.4, 6),
      new THREE.MeshStandardMaterial({ color: 0x355560, emissive: 0x58f2c2, emissiveIntensity: 1.8, flatShading: true }));
    fb.position.y = 1.7;
    fig.add(fb);
    const fh = new THREE.Mesh(new THREE.SphereGeometry(0.55, 6, 5),
      new THREE.MeshStandardMaterial({ color: 0xd9c9a8, emissive: 0xffe2a8, emissiveIntensity: 1.0, flatShading: true }));
    fh.position.y = 3.9;
    fig.add(fh);
    // a small brow gives the figure a FRONT (+z) so it visibly turns to face you
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.26, 0.34),
      new THREE.MeshStandardMaterial({ color: 0x1a2730, emissive: 0x0a1a24, emissiveIntensity: 0.5, flatShading: true }));
    brow.position.set(0, 3.98, 0.5);
    fig.add(brow);
    core.add(fig);
  }

  // =================== THE WATCHER (grief given form) =======================
  // The owner's "goblins, and a lot more" — an abstract presence, NOT a monster and
  // NEVER literal biography. A dark hooded figure that only walks the shore once you
  // have gone deep (W.level>=3): it DRIFTS toward you when unobserved and FREEZES when
  // watched, and is resolved NOT by flight or force but by REGARD — look at it steadily
  // and it lifts its head, lets go, and dissolves into a cold rising light. Integration:
  // some of what waits in the deep only wants to be seen. Driven in puzzles _tickWatcher;
  // full-scale, real island only (pruned from the model). Starts hidden + inactive.
  {
    const wfig = new THREE.Group();
    wfig.name = 'watcher';
    wfig.visible = false;
    const wmat = new THREE.MeshStandardMaterial({ color: 0x28323a, emissive: 0x13212a, emissiveIntensity: 0.6, flatShading: true, roughness: 1 });
    const wbody = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.52, 1.5, 7), wmat);
    wbody.position.y = 0.75; wfig.add(wbody);
    const whood = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.62), wmat);
    whood.position.y = 1.5; whood.scale.set(1, 1.3, 1); wfig.add(whood);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x9fe8e0 });   // two cold pinpoints, barely there
    for (const ex of [-0.09, 0.09]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.026, 5, 4), eyeMat);
      eye.position.set(ex, 1.46, 0.26); wfig.add(eye);   // local +z = the figure's FRONT (lookAt aims +z at you)
    }
    const wx = 24, wz = -88;
    wfig.position.set(wx, heightAt(wx, wz), wz);
    core.add(wfig);
  }

  // ---------- merge static bakers ----------
  const stoneMesh = new THREE.Mesh(stone.build(), matStone);
  stoneMesh.castShadow = true;
  stoneMesh.receiveShadow = true;
  stoneMesh.name = 'staticStone';
  core.add(stoneMesh);
  const brassMesh = new THREE.Mesh(brass.build(), matBrass);
  brassMesh.castShadow = true;
  brassMesh.name = 'staticBrass';
  core.add(brassMesh);

  // =================== glow particles (NOT cloned into the model) ===========
  // bioluminescent pools along the drowned causeway
  const bioPos = [];
  {
    const A = SPOTS.causewayA, B = SPOTS.causewayB;
    for (let i = 0; i < 900; i++) {
      const t = r();
      const x = lerp(A.x, B.x, t) + (r() - 0.5) * 26;
      const z = lerp(A.y, B.y, t) + (r() - 0.5) * 26;
      const h = heightAt(x, z);
      if (h < -0.3 && h > -7) bioPos.push(x, h + 0.15, z);
    }
  }
  const biolume = makeGlowPoints(bioPos, 0x58f2c2, 0.5);
  biolume.name = 'biolume';

  // fireflies among the trees at night
  const flyPos = [];
  for (let i = 0; i < 240; i++) {
    const a = r() * TAU, d = 30 + r() * 110;
    const x = SPOTS.mainCenter.x + Math.sin(a) * d, z = SPOTS.mainCenter.y + Math.cos(a) * d;
    const h = heightAt(x, z);
    if (h > 2 && h < 16) flyPos.push(x, h + 0.8 + r() * 2.2, z);
  }
  const fireflies = makeGlowPoints(flyPos, 0xffc36b, 0.35);
  fireflies.material.uniforms.uDrift.value = 1;
  fireflies.name = 'fireflies';

  return { core, waterMat, modelAnchor, biolume, fireflies, motes: cellarMotes, galleryGlow, l3motes, vaultDrips };
}

// ---------------------------------------------------------------------------
function buildVegetation(core, r) {
  // keep-outs: floors the scatter must respect. Discs match the structures
  // built in buildWorld — lighthouse base (r 5.2 + wall + apron) and the
  // annex (attached at azimuth 15°, baseR + 2.2 from the tower, r 2.8).
  const LHX = SPOTS.lighthouse.x, LHZ = SPOTS.lighthouse.y;
  const aa = 15 * Math.PI / 180;
  const ANX = LHX + Math.sin(aa) * 7.4, ANZ = LHZ + Math.cos(aa) * 7.4;
  const KEEPOUT = [
    [LHX, LHZ, 7.2], [ANX, ANZ, 4.6],
    [SPOTS.stones.x, SPOTS.stones.y, 9.0],  // pad + stone arc: the dance floor stays bare
    [SPOTS.stones.x - 11, SPOTS.stones.y - 4, 5.0], // vault outcrop + slab swing
    [SPOTS.chest.x, SPOTS.chest.y, 3.0],
  ];
  const open = (x, z) => {
    for (const [kx, kz, kr] of KEEPOUT) if (Math.hypot(x - kx, z - kz) < kr) return false;
    return true;
  };
  // grass can't grip a cliff: gradient ~1.0 is already steeper than any
  // walkable meadow (player limit 1.35); the chasm and sea cliffs are >2
  const grade = (x, z) => {
    const e = 0.7;
    return Math.hypot(heightAt(x + e, z) - heightAt(x - e, z),
                      heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
  };
  // --- pines, wind-bent ---
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.3, 2.6, 6);
  trunkGeo.translate(0, 1.3, 0);
  const canopyGeo = (() => {
    // A conifer, not a stack of smooth cones (loop #125): 5 OVERLAPPING tiers whose base rims are
    // jagged + drooped, so the silhouette reads as ragged frond-skirts instead of clean geometry.
    const jr = mulberry32(SEED ^ 0x7a3c);
    const parts = [];
    const N = 5;
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const radius = 1.75 * (1 - t * 0.82);                 // wide skirt → narrow crown
      const h = 1.55;
      const cone = new THREE.ConeGeometry(radius, h, 9, 1, true);   // openEnded (DoubleSide mat)
      const p = cone.attributes.position;
      for (let v = 0; v < p.count; v++) {
        if (p.getY(v) < -h / 2 + 0.02) {                    // base-rim vertices → frond tips
          const x = p.getX(v), z = p.getZ(v);
          const f = 1 + (jr() - 0.5) * 0.5;                 // ±25% radial jag
          p.setX(v, x * f); p.setZ(v, z * f);
          p.setY(v, p.getY(v) - jr() * 0.4);                // droop some fronds down
        }
      }
      cone.rotateY(i * 1.1);                                 // de-align facets/jags between tiers
      cone.translate(0.26 * i, 1.85 + i * 0.86, 0);         // overlapping stack, gentle lee-lean
      cone.computeVertexNormals();
      parts.push(cone);
    }
    // merge cones manually (convert to non-indexed FIRST, then size the arrays)
    const flats = parts.map((p) => p.index ? p.toNonIndexed() : p);
    let total = 0;
    for (const p of flats) total += p.attributes.position.count;
    const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3);
    let off = 0;
    for (const np of flats) {
      pos.set(np.attributes.position.array, off * 3);
      nor.set(np.attributes.normal.array, off * 3);
      off += np.attributes.position.count;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    return g;
  })();

  const spots = [];
  for (let i = 0; i < 600 && spots.length < 130; i++) {
    const a = r() * TAU, d = 25 + r() * 130;
    const x = SPOTS.mainCenter.x + Math.sin(a) * d;
    const z = SPOTS.mainCenter.y + Math.cos(a) * d;
    const h = heightAt(x, z);
    if (h < 3.5 || h > 15) continue;
    if (Math.hypot(x - SPOTS.lighthouse.x, z - SPOTS.lighthouse.y) < 16) continue;
    spots.push([x, h - 0.2, z]);
  }
  // a few on the islet
  for (let i = 0; i < 40 && spots.length < 140; i++) {
    const a = r() * TAU, d = r() * 30;
    const x = SPOTS.islet.x + Math.sin(a) * d, z = SPOTS.islet.y + Math.cos(a) * d;
    const h = heightAt(x, z);
    if (h > 2.5 && h < 8 && Math.hypot(x - SPOTS.stones.x, z - SPOTS.stones.y) > 14) spots.push([x, h - 0.2, z]);
  }

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6b48, flatShading: true, roughness: 0.9 }); // base lightened so the bark albedo multiplies to bark, not mud
  applyRelief(trunkMat, 'bark', { normalScale: 0.8, strength: 2.4, roughness: 0.95 });   // grooved bark + derived normal on every trunk + the model clone (shared)
  const canopyMat = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.85, vertexColors: false, side: THREE.DoubleSide });
  canopyMat.color = new THREE.Color(0x6d7a3e);
  // wind sway via shader patch
  canopyMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = { value: 0 };
    sh.uniforms.uHaze = { value: new THREE.Color(0xcfe3e8) };
    sh.uniforms.uFoliage = { value: getTexture('foliage') };   // stylized canopy texture (no UVs → object-space sample)
    sh.uniforms.uFolAmt = { value: 0.5 };
    sh.uniforms.uFolScale = { value: 1.0 };
    canopyMat.userData.shader = sh;
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vLPos = position;                       // object-space coords for the foliage sample (pre-wind)
      #ifdef USE_INSTANCING
        float windSeed = instanceMatrix[3].x * 0.13 + instanceMatrix[3].z * 0.17;
        transformed.x += sin(uTime * 1.4 + windSeed) * 0.14 * smoothstep(1.0, 5.5, transformed.y);
      #endif
    `).replace('void main() {', 'uniform float uTime;\nvarying vec3 vLPos;\nvoid main() {');
    // (1) a STYLIZED foliage texture breaks the flat uniform green — sampled object-space (the
    // cones have no UVs) as a LUMINANCE multiply so each canopy keeps its hue + low-poly silhouette
    // but gains dappled value variation. (2) distant canopies melt toward the grade's haze before
    // global fog reaches them — softens the hard low-poly pop at the tree line. Fragment-only.
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', 'uniform vec3 uHaze;\nuniform sampler2D uFoliage;\nuniform float uFolAmt;\nuniform float uFolScale;\nvarying vec3 vLPos;\nvoid main() {')
      .replace('#include <color_fragment>', `
        #include <color_fragment>
        float folL = dot(texture2D(uFoliage, vLPos.xz * uFolScale).rgb, vec3(0.299, 0.587, 0.114));
        diffuseColor.rgb *= mix(1.0, folL * 1.9, uFolAmt);
      `)
      .replace('#include <fog_fragment>', `
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uHaze,
          smoothstep(120.0, 300.0, length(vViewPosition)) * 0.45);
        #include <fog_fragment>
      `);
  };

  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, spots.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const col = new THREE.Color();
  for (let i = 0; i < spots.length; i++) {
    const [x, y, z] = spots[i];
    const s = 0.8 + r() * 0.8;
    e.set((r() - 0.5) * 0.12, r() * TAU, 0.1 + r() * 0.12); // lean
    q.setFromEuler(e);
    m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s * (0.9 + r() * 0.4), s));
    trunks.setMatrixAt(i, m4);
    canopies.setMatrixAt(i, m4);
    addCollider(x, z, 0.3 * s);   // the trunk is solid — you walked through every tree in the forest
    col.setHSL(0.21 + r() * 0.06, 0.32 + r() * 0.15, 0.3 + r() * 0.1);
    canopies.setColorAt(i, col);
  }
  trunks.castShadow = true;
  canopies.castShadow = true;
  trunks.name = 'trunks'; canopies.name = 'canopies';
  core.add(trunks, canopies);

  // --- grass: a TUFT of curved blades (loop #122). The old single straight cross-blade read as
  // a spike in the ground; a clump of blades that arc OUTWARD and droop at the tips reads as grass.
  const bladeGeo = (() => {
    // one curved, tapered blade rooted at y=0, arcing forward (+z) and drooping toward the tip
    const makeBlade = (h, w, bend) => {
      const g = new THREE.PlaneGeometry(w, h, 1, 3);
      g.translate(0, h / 2, 0);                       // base at y=0
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        const t = Math.max(0, Math.min(1, y / h));    // 0 root → 1 tip
        p.setX(i, p.getX(i) * (1 - t * 0.82));        // taper toward the tip
        p.setZ(i, p.getZ(i) + bend * t * t * h);      // arc forward, accelerating to the tip
        p.setY(i, y - bend * 0.4 * t * t * h);        // droop the arcing tip down
      }
      g.computeVertexNormals();
      return g.toNonIndexed();
    };
    // fan 5 blades around the base at varied yaw / height / arc — a fountain-shaped clump
    const blades = [];
    const N = 5;
    for (let i = 0; i < N; i++) {
      const yaw = (i / N) * TAU + i * 1.3;
      const h = 0.4 + (i % 3) * 0.08;                 // 0.40 .. 0.56
      const w = 0.055 + (i % 2) * 0.02;
      const bend = 0.45 + (i % 4) * 0.14;             // varied droop so it isn't a uniform spray
      const b = makeBlade(h, w, bend);
      b.rotateY(yaw);
      b.translate(Math.cos(yaw) * 0.03, 0, Math.sin(yaw) * 0.03);  // slight base spread
      blades.push(b);
    }
    let total = 0;
    for (const b of blades) total += b.attributes.position.count;
    const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3);
    let off = 0;
    for (const b of blades) {
      pos.set(b.attributes.position.array, off * 3);
      nor.set(b.attributes.normal.array, off * 3);
      off += b.attributes.position.count;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    return g;
  })();
  const grassMat = new THREE.MeshStandardMaterial({
    color: 0xb39a52, flatShading: true, roughness: 0.9, side: THREE.DoubleSide,
  });
  grassMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = { value: 0 };
    grassMat.userData.shader = sh;
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      #ifdef USE_INSTANCING
        float gw = instanceMatrix[3].x * 0.31 + instanceMatrix[3].z * 0.23;
        float gt = pow(max(position.y, 0.0), 1.5);            // tips drift most, roots stay put
        transformed.x += sin(uTime * 1.5 + gw) * 0.32 * gt;   // gentle two-axis wave (not a rigid waggle)
        transformed.z += cos(uTime * 1.2 + gw * 1.4) * 0.18 * gt;
      #endif
    `).replace('void main() {', 'uniform float uTime;\nvoid main() {');
  };

  const G_MAIN = 3800, G_ISLET = 650;   // fewer instances — each is now a full 5-blade tuft, not one blade
  const grass = new THREE.InstancedMesh(bladeGeo, grassMat, G_MAIN + G_ISLET);
  let gi = 0;
  const gcol = new THREE.Color();
  const plant = (x, h, z) => {
    const s = 0.7 + r() * 0.9;
    m4.compose(
      new THREE.Vector3(x, h - 0.06, z),
      q.setFromEuler(e.set(0, r() * TAU, (r() - 0.5) * 0.25)),
      new THREE.Vector3(s, s * (0.7 + r() * 0.7), s));
    grass.setMatrixAt(gi, m4);
    gcol.setHSL(0.14 + r() * 0.07, 0.38 + r() * 0.2, 0.3 + r() * 0.14);
    grass.setColorAt(gi, gcol);
    gi++;
  };
  for (let i = 0; i < G_MAIN * 4 && gi < G_MAIN; i++) {
    const a = r() * TAU, d = 15 + Math.sqrt(r()) * 150;
    const x = SPOTS.mainCenter.x + Math.sin(a) * d;
    const z = SPOTS.mainCenter.y + Math.cos(a) * d;
    const h = heightAt(x, z);
    if (h < 2.2 || h > 16) continue;
    if (!open(x, z) || grade(x, z) > 1.0) continue;
    plant(x, h, z);
  }
  // the islet was bald — and players study it through the whole music
  // sequence. Same gates; its own band: the pad (8.8) sits in a shallow
  // bowl whose shoulder rises to ~10.5 before falling to the beach.
  for (let i = 0; i < G_ISLET * 6 && gi < G_MAIN + G_ISLET; i++) {
    const a = r() * TAU, d = Math.sqrt(r()) * 28;
    const x = SPOTS.islet.x + Math.sin(a) * d;
    const z = SPOTS.islet.y + Math.cos(a) * d;
    const h = heightAt(x, z);
    if (h < 2.2 || h > 11.2) continue;
    if (!open(x, z) || grade(x, z) > 1.0) continue;
    plant(x, h, z);
  }
  grass.count = gi;
  grass.name = 'grass';
  core.add(grass);

  // --- shore rocks ---
  const rockGeo = new THREE.IcosahedronGeometry(1, 0);
  // three stone types so the shore isn't 70 copies of one granite — split into 3 InstancedMeshes
  // (granite / basalt / limestone), each its own albedo + derived relief. The per-instance random
  // rotation already hides UV-orientation repeat, so distinct albedos read as natural variety (+2 draws).
  const rockDefs = [
    { id: 'rock', color: 0xd6ccb8 },       // weathered granite (lightened so the albedo reads as stone)
    { id: 'basalt', color: 0xb8bcc4 },     // dark volcanic
    { id: 'limestone', color: 0xe6ddc8 },  // pale eroded
  ];
  const rockMeshes = rockDefs.map((d) => {
    const mat = new THREE.MeshStandardMaterial({ color: d.color, flatShading: true, roughness: 0.95 });
    applyRelief(mat, d.id, { normalScale: 0.6, strength: 2.2 });
    const im = new THREE.InstancedMesh(rockGeo, mat, 70);
    im.castShadow = true; im.name = 'rocks';
    return im;
  });
  const riCount = [0, 0, 0];
  let ri = 0;
  for (let i = 0; i < 400 && ri < 70; i++) {
    const a = r() * TAU, d = 120 + r() * 90;
    const x = SPOTS.mainCenter.x + Math.sin(a) * d;
    const z = SPOTS.mainCenter.y + Math.cos(a) * d;
    const h = heightAt(x, z);
    if (h < -1.5 || h > 4) continue;
    const s = 0.5 + r() * 2.2;
    m4.compose(
      new THREE.Vector3(x, h + s * 0.2, z),
      q.setFromEuler(e.set(r() * TAU, r() * TAU, r() * TAU)),
      new THREE.Vector3(s, s * (0.6 + r() * 0.5), s));
    // route to a stone bucket by a POSITIONAL hash (NOT r() — keeps the scatter RNG draw-order
    // identical so positions + colliders are byte-unchanged): ~50% granite / 28% basalt / 22% limestone
    const hv = (Math.abs(Math.sin(x * 12.9898 + z * 78.233)) * 43758.5453) % 1;
    const bucket = hv < 0.5 ? 0 : hv < 0.78 ? 1 : 2;
    rockMeshes[bucket].setMatrixAt(riCount[bucket]++, m4);
    // make the substantial boulders SOLID (you walked through them) — register a collider
    // footprint; small pebbles (s<0.9) stay passable so you don't bump invisible nubs
    if (s >= 0.9) addCollider(x, z, s * 0.82);
    ri++;
  }
  rockMeshes.forEach((im, b) => { im.count = riCount[b]; core.add(im); });   // trim each to its filled count
}

// =============================================================================
// Clone the island into the chart-table model. Shares all geometry; disables
// shadows; swaps the nested model anchor for a tiny impostor (the model's model).
// =============================================================================
// groups whose detail is sub-pixel at 1:240 and carries no state the recursion
// shows — pruned from the model clone to save draw calls (perf, loop #49). Each is
// confirmed decorative / island-only-driven: gallery+jetty are exterior repeats,
// quarters is interior furniture, vaultDrips is driven off the island ref only.
const MODEL_PRUNE = new Set(['drownedGallery', 'jetty', 'quarters', 'vaultDrips', 'vaultVista', 'watcher', 'region2', 'region3', 'region4']);

export function instantiateModel(core, modelAnchor) {
  const modelRoot = core.clone(true);
  modelRoot.name = 'modelIsland';
  // collect-then-remove: removing a node DURING traverse corrupts the iteration
  // (the latent cause of the Points-in-core crash). Gather here, prune after.
  const prune = [];
  modelRoot.traverse((o) => {
    o.castShadow = false;
    o.receiveShadow = false;
    if (o.isPoints || MODEL_PRUNE.has(o.name)) prune.push(o);
  });
  for (const o of prune) o.removeFromParent();
  // the model's own model: a speck impostor on its chart table
  const nestedAnchor = modelRoot.getObjectByName('modelAnchor');
  if (nestedAnchor) {
    const impostor = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.1, 8),
      new THREE.MeshStandardMaterial({ color: 0x2a5a58, flatShading: true }));
    const peak = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.4, 5),
      new THREE.MeshStandardMaterial({ color: 0xcfc8b8, flatShading: true }));
    peak.position.y = 0.7;
    impostor.add(disc, peak);
    // the secret, for whoever leans all the way in at night: far down the
    // recursion, a light is still lit — a pinprick where the next
    // lighthouse stands (~1 mm in world space; additive, day-invisible)
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.45, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xffe2a8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    glint.position.set(-0.4, 0.5, -0.55);
    glint.name = 'nestedGlint';
    impostor.add(glint);
    impostor.scale.setScalar(SCALE_MODEL * 120);
    nestedAnchor.add(impostor);
  }
  // "you are here" — the abyme made literal. A cool pinprick (vs the world's warm
  // glints) tracks the player's real island position on the chart-table model:
  // you are a speck on your own map. A Mesh+Sprite (never Points — this is added
  // post-clone, but stay clone-safe); island-unit local coords (modelRoot scales
  // them by SCALE_MODEL). Position + pulse driven in main.js applyAtmosphere.
  // sizes are in island units; modelRoot scales them by SCALE_MODEL (~1/240), so a
  // ~30-unit pin reads as a ~0.12-world cursor on the table — visible when you lean
  // in, but clearly smaller than the table's brass instruments.
  const youMarker = new THREE.Group();
  youMarker.name = 'youMarker';
  const youPin = new THREE.Mesh(
    new THREE.ConeGeometry(2.8, 38, 5),
    new THREE.MeshBasicMaterial({ color: 0x2fccff })
  );
  youPin.position.y = 19; // base on the model surface, tip up
  const youSpark = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialGlowTex(), color: 0xc8f4ff, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  youSpark.scale.setScalar(26); // the eye-catcher at table distance
  youSpark.position.y = 42; // glow at the pin's tip
  youMarker.add(youPin, youSpark);
  youMarker.visible = false; // shown once the player is in the world (introDone)
  modelRoot.add(youMarker);
  modelRoot.scale.setScalar(SCALE_MODEL);
  modelAnchor.add(modelRoot);
  return modelRoot;
}

// Collect state-driven object refs by name, for one island instance.
const NAMES = [
  'water', 'lampLens', 'beamPivot', 'beamCone', 'shaftBeam', 'valveWheel',
  'orreryPivot', 'orreryTilt', 'orreryLamp', 'crankHandle', 'musicBoxLid',
  'innerDoor', 'plumbHung', 'plumbBob', 'plumbHook', 'deskPlate', 'vaultDoor', 'lensItem', 'chestLid', 'cellarShaft',
  'rulerItem', 'rulerWorld', 'hatchLid', 'hatchShimmer', 'glyphPlane',
  'tinyFigure', 'coat', 'footprints', 'songBird', 'bell', 'disagreeSea', 'disagreeLamp', 'chartTally', 'logbook',
  'jettyLantern', 'jettyHalo', 'plateGlow', 'doryOar', 'doryHull', 'inscribedStone', 'messageBottle', 'quartersJournal',
  'readGlass', 'lensMarkStudy', 'lensMarkStone', 'watcher', 'musicNote',
  'dial0', 'dial1', 'dial2', 'dial3', 'dialGlyph0', 'dialGlyph1', 'dialGlyph2', 'dialGlyph3',
  'stone0', 'stone1', 'stone2', 'stone3', 'stone4',
  'stoneGlow0', 'stoneGlow1', 'stoneGlow2', 'stoneGlow3', 'stoneGlow4',
  'stoneMark0', 'stoneMark1', 'stoneMark2', 'stoneMark3', 'stoneMark4',
  'region2', 'region3', 'region4', 'tideFigure', 'drownedGallery',   // SEA-STRATA shells + L2 encounter + L3 colonnade (loop #117/#121/#127)
];

export function collectRefs(root) {
  // custom DFS that does NOT descend into the nested model island —
  // plain getObjectByName would find the clone's copies first.
  const refs = {};
  const want = new Set(NAMES);
  (function walk(o) {
    if (o.name === 'modelAnchor' && o !== root) return;
    if (want.has(o.name) && !(o.name in refs)) refs[o.name] = o;
    for (const c of o.children) walk(c);
  })(root);
  for (const n of NAMES) refs[n] = refs[n] || null;
  return refs;
}
