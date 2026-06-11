// terrain.js — the island is a single analytic height function.
// Geometry, player collision, water depth and foam all read the same math.

import * as THREE from 'three';
import { fbm, ridged, clamp, lerp, smoothstep, mulberry32, SEED, vary } from './util.js';
import { W } from './world.js';

export const DOMAIN = 620;            // metres, square, centered on origin
export const SEA_FLOOR = -13;

// landmarks (north = +z, east = +x)
export const SPOTS = {
  mainCenter: new THREE.Vector2(-30, 40),
  lighthouse: new THREE.Vector2(-85, -40),   // coastal headland; flattened pad, h = 13.5
  beach: new THREE.Vector2(4, -98),
  bluff: new THREE.Vector2(85, 25),
  hatch: new THREE.Vector2(97, 32),          // flattened pad, h = 23.5
  islet: new THREE.Vector2(135, -150),
  stones: new THREE.Vector2(135, -146),      // flattened pad, h = 8.8
  chest: new THREE.Vector2(118, -176),
  causewayA: new THREE.Vector2(48, -78),
  causewayB: new THREE.Vector2(112, -132),
  chasmBridgeZ: 25,                          // bridge crosses the chasm at this z
};

const LIGHTHOUSE_H = 13.5;
const STONES_H = 8.8;
const HATCH_H = 23.5;
export const BRIDGE_DECK = 18.45;
const BRIDGE_W = new THREE.Vector2(36, 25);
const BRIDGE_E = new THREE.Vector2(58, 25);

function distSeg(px, pz, ax, az, bx, bz) {
  const abx = bx - ax, abz = bz - az;
  const t = clamp(((px - ax) * abx + (pz - az) * abz) / (abx * abx + abz * abz), 0, 1);
  const dx = px - (ax + abx * t), dz = pz - (az + abz * t);
  return Math.sqrt(dx * dx + dz * dz);
}

function smax(a, b, k = 4) { // smooth max
  const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1);
  return lerp(a, b, h) + k * h * (1 - h);
}

export function heightAt(x, z) {
  // sea floor with gentle dunes
  let h = SEA_FLOOR + fbm(x * 0.013 + 7, z * 0.013 - 3, 3) * 2.5;

  // ---- main island ----
  {
    const dx = x - SPOTS.mainCenter.x, dz = z - SPOTS.mainCenter.y;
    const d = Math.sqrt(dx * dx + dz * dz) / 165;
    const m = 1 - smoothstep(0.45, 1.0, d);
    if (m > 0) {
      const ridge = ridged(x * 0.011 + 2.3, z * 0.011 + 5.1, 4);
      const detail = fbm(x * 0.03, z * 0.03, 4);
      const hh = Math.pow(m, 1.35) * 15 + ridge * m * 6.5 + detail * m * 3 - 2;
      h = smax(h, hh, 3);
    }
  }

  // ---- east bluff (steep plateau, cliff on its west flank) ----
  {
    const dx = x - SPOTS.bluff.x, dz = z - SPOTS.bluff.y;
    const d = Math.sqrt(dx * dx + dz * dz * 0.8) / 64;
    const m = 1 - smoothstep(0.52, 0.95, d);
    if (m > 0) {
      const strata = fbm(x * 0.05, z * 0.05, 3) * 2;
      const hh = Math.pow(m, 0.6) * 25 + strata * m - 2;
      h = smax(h, hh, 2.5);
    }
  }

  // ---- islet ----
  {
    const dx = x - SPOTS.islet.x, dz = z - SPOTS.islet.y;
    const d = Math.sqrt(dx * dx + dz * dz) / 50;
    const m = 1 - smoothstep(0.4, 1.0, d);
    if (m > 0) {
      const hh = Math.pow(m, 1.25) * 10.5 + fbm(x * 0.04 + 9, z * 0.04, 3) * m * 2 - 1.5;
      h = smax(h, hh, 2.5);
    }
  }

  // ---- causeway: a drowned ridge, exposed only at low tide ----
  {
    const d = distSeg(x, z, SPOTS.causewayA.x, SPOTS.causewayA.y, SPOTS.causewayB.x, SPOTS.causewayB.y);
    const crest = -1.6 + Math.sin(x * 0.11 + z * 0.07) * 0.25;
    const ridgeH = crest - Math.pow(d / 10, 2) * 6;
    h = smax(h, ridgeH, 1.5);
  }

  // ---- the chasm: a crack splitting bluff from main island ----
  {
    const d = distSeg(x, z, 46, -28, 47, 84);
    const wobble = fbm(z * 0.04, x * 0.04, 2) * 3;
    const mask = 1 - smoothstep(4 + wobble, 11 + wobble, d);
    if (mask > 0) h = lerp(h, Math.min(h, -8.5), Math.pow(mask, 1.3));
  }

  // ---- flattened pads for structures ----
  h = padFlatten(h, x, z, SPOTS.lighthouse, 11, LIGHTHOUSE_H);
  h = padFlatten(h, x, z, SPOTS.stones, 13, STONES_H);
  h = padFlatten(h, x, z, SPOTS.hatch, 8, HATCH_H);
  // bridge approach pads on either rim of the chasm
  h = padFlatten(h, x, z, BRIDGE_W, 7, BRIDGE_DECK - 0.45);
  h = padFlatten(h, x, z, BRIDGE_E, 7, BRIDGE_DECK - 0.45);

  // ---- beach: soften everything low near the south shore, keep it dry sand ----
  {
    const beachiness = 1 - smoothstep(0, 90, Math.hypot(x - SPOTS.beach.x, z - SPOTS.beach.y));
    // taper influence smoothly to zero by h=5 so no terrace ring forms
    const w = beachiness * 0.85 * (1 - smoothstep(2.8, 5.0, h)) * smoothstep(-1.2, -0.4, h);
    if (w > 0) h = lerp(h, 1.5 + (h * 0.3), w);
  }

  return h;
}

function padFlatten(h, x, z, spot, r, target) {
  const d = Math.hypot(x - spot.x, z - spot.y);
  if (d > r * 1.8) return h;
  return lerp(target, h, smoothstep(r * 0.55, r * 1.8, d));
}

// ----------------------------------------------------------------------------
// Walkable height: terrain + structures the player can stand on.
// refs is filled in by props.js (bridge deck, interior floors, vault).
export const walkable = { bridge: null, vault: null };

export function walkableY(x, z) {
  // lighthouse interior: flat disc
  const dl = Math.hypot(x - SPOTS.lighthouse.x, z - SPOTS.lighthouse.y);
  if (dl < 5.4) return LIGHTHOUSE_H;

  // ruler bridge across the chasm
  if (W.flags.rulerPlaced) {
    const bz = SPOTS.chasmBridgeZ;
    if (Math.abs(z - bz) < 2.1 && x > 35 && x < 59) {
      return BRIDGE_DECK; // deck height, rim-to-rim
    }
  }

  // the vault under the bluff (stairs + room)
  if (W.flags.hatchOpen) {
    const hx = SPOTS.hatch.x, hz = SPOTS.hatch.y;
    const lx = x - hx, lz = z - hz;
    // stair shaft: descends southward from the hatch
    if (lx > -1.6 && lx < 1.6 && lz < -1.2 && lz > -9.5) {
      const t = clamp((-lz - 1.2) / 7.2, 0, 1);
      return HATCH_H - t * 5.2;
    }
    // room
    if (lx > -4.5 && lx < 4.5 && lz < -9.5 && lz > -17) {
      return HATCH_H - 5.2;
    }
  }

  return heightAt(x, z);
}

// Wall collision: the lighthouse and annex are rings with door gaps.
const LHX = SPOTS.lighthouse.x, LHZ = SPOTS.lighthouse.y;
const ANX = LHX + Math.sin(0.2618) * 7.4, ANZ = LHZ + Math.cos(0.2618) * 7.4;
const deg = (d) => d * Math.PI / 180;

function ringBlocked(x0, z0, x1, z1, cx, cz, r, doorA0, doorA1) {
  const d0 = Math.hypot(x0 - cx, z0 - cz), d1 = Math.hypot(x1 - cx, z1 - cz);
  if ((d0 - r) * (d1 - r) >= 0) return false;        // not crossing the ring
  let az = Math.atan2(x1 - cx, z1 - cz);
  if (az < 0) az += Math.PI * 2;
  const inDoor = doorA0 < doorA1
    ? (az > doorA0 && az < doorA1)
    : (az > doorA0 || az < doorA1);
  return !inDoor;
}

export function wallBlocked(x0, z0, x1, z1) {
  // lighthouse wall: door gap az 153..177°
  if (ringBlocked(x0, z0, x1, z1, LHX, LHZ, 5.2, deg(153), deg(177))) return true;
  // annex wall: door faces the study (az ~187..207 from annex centre), locked until level 2
  if (W.level >= 2) {
    if (ringBlocked(x0, z0, x1, z1, ANX, ANZ, 2.65, deg(185), deg(212))) return true;
  } else if (Math.hypot(x1 - ANX, z1 - ANZ) < 2.65) {
    return true;
  }
  return false;
}

// ----------------------------------------------------------------------------
// Geometry
export function buildTerrain() {
  const N = 256; // segments
  const geo = new THREE.PlaneGeometry(DOMAIN, DOMAIN, N, N);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const r = mulberry32(SEED ^ 0x51ab);

  const cSand = new THREE.Color(0xe3d2a4);
  const cSandWet = new THREE.Color(0x9d8d6b);
  const cGrass = new THREE.Color(0xc2a45c);
  const cGrassOlive = new THREE.Color(0x8d8a4a);
  const cRock = new THREE.Color(0xcfc8b8);
  const cRockDark = new THREE.Color(0x8e887b);
  const cSeabed = new THREE.Color(0x33514e);
  const cSeabedDeep = new THREE.Color(0x16313c);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);

    // slope estimate
    const e = 1.5;
    const sx = heightAt(x + e, z) - heightAt(x - e, z);
    const sz = heightAt(x, z + e) - heightAt(x, z - e);
    const slope = Math.min(1, Math.hypot(sx, sz) / (2 * e) * 1.6);

    const n = fbm(x * 0.05 + 31, z * 0.05 + 17, 3);

    if (h < -2.5) {
      tmp.lerpColors(cSeabedDeep, cSeabed, smoothstep(-9, -2.5, h));
    } else if (h < 0.8) {
      tmp.lerpColors(cSeabed, cSandWet, smoothstep(-2.5, 0.4, h));
    } else if (h < 2.6 && slope < 0.45) {
      tmp.lerpColors(cSandWet, cSand, smoothstep(0.8, 2.0, h));
    } else if (slope > 0.62) {
      tmp.lerpColors(cRock, cRockDark, smoothstep(0.6, 1.0, slope));
      // limestone strata bands
      tmp.offsetHSL(0, 0, Math.sin(h * 1.7) * 0.03);
    } else {
      tmp.lerpColors(cGrass, cGrassOlive, n);
      tmp.offsetHSL(0, 0, (slope - 0.2) * -0.12);
    }
    // global gentle noise so nothing is flat-colored
    tmp.offsetHSL((r() - 0.5) * 0.012, (r() - 0.5) * 0.03, (n - 0.5) * 0.05);

    colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.95,
    metalness: 0.0,
  });
  // cut the hatch hole into the heightfield (local space, so the model
  // island inherits the same hole — recursion demands it)
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vLXZ;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLXZ = position.xz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vLXZ;')
      .replace('#include <clipping_planes_fragment>',
        `if (distance(vLXZ, vec2(${SPOTS.hatch.x.toFixed(1)}, ${SPOTS.hatch.y.toFixed(1)})) < 1.22) discard;\n#include <clipping_planes_fragment>`);
  };

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'terrain';
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  return mesh;
}

// height texture for the water shader (depth → color/foam)
export function buildHeightTexture() {
  const N = 256;
  const data = new Float32Array(N * N);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x = (i / (N - 1) - 0.5) * DOMAIN;
      const z = (j / (N - 1) - 0.5) * DOMAIN;
      data[j * N + i] = heightAt(x, z);
    }
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RedFormat, THREE.FloatType);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}
