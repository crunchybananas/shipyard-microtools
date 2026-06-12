// props.js — every structure on the island, generated from primitives.
// Static pieces are baked into merged meshes (a few draw calls); anything
// that moves or glows is a named object so world.js state can drive it —
// in BOTH instances of the island (real and chart-table model).

import * as THREE from 'three';
import { Baker, mulberry32, SEED, vary, clamp, lerp, TAU } from './util.js';
import { heightAt, SPOTS, DOMAIN, buildTerrain, buildHeightTexture } from './terrain.js';
import { makeWaterMaterial, makeBeamMaterial, makeGlowPoints } from './shaders.js';
import { SCALE_MODEL } from './world.js';

export const GLYPHS = 8;
export const GLYPH_CODE = [3, 7, 1, 5];
export const STONE_NOTES = [261.63, 293.66, 329.63, 392.0, 440.0]; // C4 D4 E4 G4 A4
export const BOX_MELODY = [2, 3, 4, 1, 0];   // stone indices: E G A D C
export const BIRD_MELODY = [2, 3, 4, 3, 0];  // E G A G C — the bird corrects one note

// ---- shared materials -------------------------------------------------------
export const matStone = new THREE.MeshStandardMaterial({
  vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0.0, side: THREE.DoubleSide,
});
export const matBrass = new THREE.MeshStandardMaterial({
  vertexColors: true, flatShading: true, roughness: 0.38, metalness: 0.85, side: THREE.DoubleSide,
});
const matBrassSolid = new THREE.MeshStandardMaterial({
  color: 0xb08d4f, flatShading: true, roughness: 0.35, metalness: 0.9,
});
const matWood = new THREE.MeshStandardMaterial({
  color: 0x5e4127, flatShading: true, roughness: 0.85, metalness: 0.0,
});
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
  // the model sits here (filled in later with the clone)
  const modelAnchor = new THREE.Group();
  modelAnchor.name = 'modelAnchor';
  modelAnchor.position.set(LH.x, LH.y + 1.01, LH.z);
  core.add(modelAnchor);

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
    const coatBody = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.5, 8), new THREE.MeshStandardMaterial({ color: 0x355560, flatShading: true, roughness: 0.9 }));
    coatBody.position.set(ax - 1.9, LH.y + 1.2, az + 0.6);
    coat.add(coatBody);
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

      // carved music glyph: i dots
      const gl = glyphSprite(atlas, [0, 4, 2, 1, 7][i], 0x9adfca, 0.55);
      gl.position.set(0, 0.4, -0.42);
      gl.material.opacity = 0.5;
      m.add(gl);
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
    const room = new THREE.Mesh(new THREE.BoxGeometry(9.4, 4.45, 8.4), cm);
    room.position.set(hx, hy - 3.03, hz - 13.6);
    cellar.add(room);
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
    // wall carving: the plumb-line diagram (a hint, drawn in glyphs)
    const carve = glyphSprite(atlas, 4, 0x9adfca, 1.4);
    carve.position.set(hx, hy - 3.4, hz - 17.2);
    cellar.add(carve);
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

  // =================== TINY FIGURE (level 2: you, on the model) =============
  {
    // exaggerated ~3x so it reads as a luminous speck at 1:240
    const fig = new THREE.Group();
    fig.name = 'tinyFigure';
    fig.visible = false;
    const fy = heightAt(SPOTS.beach.x, SPOTS.beach.y);
    const fb = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 3.4, 6),
      new THREE.MeshStandardMaterial({ color: 0x355560, emissive: 0x58f2c2, emissiveIntensity: 1.6, flatShading: true }));
    fb.position.set(SPOTS.beach.x, fy + 1.7, SPOTS.beach.y);
    fig.add(fb);
    const fh = new THREE.Mesh(new THREE.SphereGeometry(0.55, 6, 5),
      new THREE.MeshStandardMaterial({ color: 0xd9c9a8, emissive: 0xffe2a8, emissiveIntensity: 0.8, flatShading: true }));
    fh.position.set(SPOTS.beach.x, fy + 3.9, SPOTS.beach.y);
    fig.add(fh);
    core.add(fig);
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

  return { core, waterMat, modelAnchor, biolume, fireflies, atlas };
}

// ---------------------------------------------------------------------------
function buildVegetation(core, r) {
  // keep-outs: floors the scatter must respect. Discs match the structures
  // built in buildWorld — lighthouse base (r 5.2 + wall + apron) and the
  // annex (attached at azimuth 15°, baseR + 2.2 from the tower, r 2.8).
  const LHX = SPOTS.lighthouse.x, LHZ = SPOTS.lighthouse.y;
  const aa = 15 * Math.PI / 180;
  const ANX = LHX + Math.sin(aa) * 7.4, ANZ = LHZ + Math.cos(aa) * 7.4;
  const KEEPOUT = [[LHX, LHZ, 7.2], [ANX, ANZ, 4.6]];
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
    const parts = [];
    for (let i = 0; i < 3; i++) {
      const cone = new THREE.ConeGeometry(1.6 - i * 0.42, 1.7, 7);
      cone.translate(0.35 * i, 2.2 + i * 1.05, 0); // lee-lean
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

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5e4127, flatShading: true, roughness: 0.9 });
  const canopyMat = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.85, vertexColors: false });
  canopyMat.color = new THREE.Color(0x6d7a3e);
  // wind sway via shader patch
  canopyMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = { value: 0 };
    canopyMat.userData.shader = sh;
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      #ifdef USE_INSTANCING
        float windSeed = instanceMatrix[3].x * 0.13 + instanceMatrix[3].z * 0.17;
        transformed.x += sin(uTime * 1.4 + windSeed) * 0.14 * smoothstep(1.0, 5.5, transformed.y);
      #endif
    `).replace('void main() {', 'uniform float uTime;\nvoid main() {');
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
    col.setHSL(0.21 + r() * 0.06, 0.32 + r() * 0.15, 0.3 + r() * 0.1);
    canopies.setColorAt(i, col);
  }
  trunks.castShadow = true;
  canopies.castShadow = true;
  trunks.name = 'trunks'; canopies.name = 'canopies';
  core.add(trunks, canopies);

  // --- grass: narrow tapered blades, crossed ---
  const bladeGeo = (() => {
    const g1 = new THREE.PlaneGeometry(0.13, 0.85, 1, 2);
    g1.translate(0, 0.42, 0);
    {
      // taper to a point
      const p = g1.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const t = p.getY(i) / 0.85;
        p.setX(i, p.getX(i) * (1 - t * 0.9));
      }
    }
    const g2 = g1.clone();
    g2.rotateY(Math.PI / 2);
    const a = g1.toNonIndexed(), b = g2.toNonIndexed();
    const pos = new Float32Array((a.attributes.position.count + b.attributes.position.count) * 3);
    const nor = new Float32Array(pos.length);
    pos.set(a.attributes.position.array, 0);
    pos.set(b.attributes.position.array, a.attributes.position.count * 3);
    nor.set(a.attributes.normal.array, 0);
    nor.set(b.attributes.normal.array, a.attributes.position.count * 3);
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
        transformed.x += sin(uTime * 2.1 + gw) * 0.16 * pow(max(position.y, 0.0), 2.0);
      #endif
    `).replace('void main() {', 'uniform float uTime;\nvoid main() {');
  };

  const G_COUNT = 9000;
  const grass = new THREE.InstancedMesh(bladeGeo, grassMat, G_COUNT);
  let gi = 0;
  const gcol = new THREE.Color();
  for (let i = 0; i < G_COUNT * 4 && gi < G_COUNT; i++) {
    const a = r() * TAU, d = 15 + Math.sqrt(r()) * 150;
    const x = SPOTS.mainCenter.x + Math.sin(a) * d;
    const z = SPOTS.mainCenter.y + Math.cos(a) * d;
    const h = heightAt(x, z);
    if (h < 2.2 || h > 16) continue;
    if (!open(x, z) || grade(x, z) > 1.0) continue;
    const s = 0.7 + r() * 0.9;
    m4.compose(
      new THREE.Vector3(x, h - 0.06, z),
      q.setFromEuler(e.set(0, r() * TAU, (r() - 0.5) * 0.25)),
      new THREE.Vector3(s, s * (0.7 + r() * 0.7), s));
    grass.setMatrixAt(gi, m4);
    gcol.setHSL(0.14 + r() * 0.07, 0.38 + r() * 0.2, 0.3 + r() * 0.14);
    grass.setColorAt(gi, gcol);
    gi++;
  }
  grass.count = gi;
  grass.name = 'grass';
  core.add(grass);

  // --- shore rocks ---
  const rockGeo = new THREE.IcosahedronGeometry(1, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0xa9a08c, flatShading: true, roughness: 0.95 });
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 70);
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
    rocks.setMatrixAt(ri, m4);
    ri++;
  }
  rocks.count = ri;
  rocks.castShadow = true;
  rocks.name = 'rocks';
  core.add(rocks);
}

// =============================================================================
// Clone the island into the chart-table model. Shares all geometry; disables
// shadows; swaps the nested model anchor for a tiny impostor (the model's model).
// =============================================================================
export function instantiateModel(core, modelAnchor) {
  const modelRoot = core.clone(true);
  modelRoot.name = 'modelIsland';
  modelRoot.traverse((o) => {
    o.castShadow = false;
    o.receiveShadow = false;
    if (o.isPoints) o.removeFromParent?.();
  });
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
    impostor.scale.setScalar(SCALE_MODEL * 120);
    nestedAnchor.add(impostor);
  }
  modelRoot.scale.setScalar(SCALE_MODEL);
  modelAnchor.add(modelRoot);
  return modelRoot;
}

// Collect state-driven object refs by name, for one island instance.
const NAMES = [
  'water', 'lampLens', 'beamPivot', 'beamCone', 'shaftBeam', 'valveWheel',
  'orreryPivot', 'orreryTilt', 'orreryLamp', 'crankHandle', 'musicBoxLid',
  'innerDoor', 'plumbHung', 'plumbBob', 'plumbHook', 'deskPlate', 'vaultDoor', 'lensItem', 'chestLid',
  'rulerItem', 'rulerWorld', 'hatchLid', 'hatchShimmer', 'glyphPlane',
  'tinyFigure', 'coat', 'footprints', 'songBird', 'bell',
  'dial0', 'dial1', 'dial2', 'dial3', 'dialGlyph0', 'dialGlyph1', 'dialGlyph2', 'dialGlyph3',
  'stone0', 'stone1', 'stone2', 'stone3', 'stone4',
  'stoneGlow0', 'stoneGlow1', 'stoneGlow2', 'stoneGlow3', 'stoneGlow4',
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
