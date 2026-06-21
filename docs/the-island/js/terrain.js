// terrain.js — the island is a single analytic height function.
// Geometry, player collision, water depth and foam all read the same math.

import * as THREE from 'three';
import { fbm, ridged, clamp, lerp, smoothstep, mulberry32, SEED } from './util.js';
import { W } from './world.js';
import { getTexture } from './assets.js';

export const DOMAIN = 620;            // metres, square, centered on origin
const SEA_FLOOR = -13;

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
const BRIDGE_DECK = 18.45;
const BRIDGE_W = new THREE.Vector2(35, 25);
const BRIDGE_E = new THREE.Vector2(59, 25);

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
  // edges deliberately steeper than the 1.35 climb limit: the only way up
  // is the carved bridge pad. The ruler IS the route.
  {
    const dx = x - SPOTS.bluff.x, dz = z - SPOTS.bluff.y;
    const d = Math.sqrt(dx * dx + dz * dz * 0.8) / 64;
    const m = 1 - smoothstep(0.58, 0.76, d);
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
  // long enough that both ends drown below the lowest tide; walls steeper
  // than the climb limit — without the ruler there is no crossing
  {
    const d = distSeg(x, z, 46, -55, 47, 112);
    const wobble = fbm(z * 0.04, x * 0.04, 2) * 3;
    const mask = 1 - smoothstep(4 + wobble, 9 + wobble, d);
    if (mask > 0) h = lerp(h, Math.min(h, -8.5), Math.pow(mask, 1.3));
  }

  // ---- flattened pads for structures ----
  h = padFlatten(h, x, z, SPOTS.lighthouse, 11, LIGHTHOUSE_H);
  h = padFlatten(h, x, z, SPOTS.stones, 13, STONES_H);
  h = padFlatten(h, x, z, SPOTS.hatch, 8, HATCH_H);
  // bridge approach pads: small radius so their skirts never refill the
  // chasm floor between them (influence ends ~9m out; the crack is ~11m away)
  h = padFlatten(h, x, z, BRIDGE_W, 5, BRIDGE_DECK - 0.45);
  h = padFlatten(h, x, z, BRIDGE_E, 5, BRIDGE_DECK - 0.45);

  // ramp corridor: the one walkable way up from the bridge onto the plateau
  {
    const ax = 59, az = 25, bx = 80, bz = 29;
    const d = distSeg(x, z, ax, az, bx, bz);
    if (d < 8) {
      const t = clamp(((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2), 0, 1);
      const rampH = (BRIDGE_DECK - 0.45) + t * (24.2 - (BRIDGE_DECK - 0.45));
      h = lerp(rampH, h, smoothstep(2.5, 8, d));
    }
  }

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
// ---- solid colliders + the jetty deck ----
// Circular footprints props register (shore rocks, …) so the player can't walk THROUGH solid
// scatter. props.js pushes via addCollider during buildWorld; wallBlocked() reads them.
const COLLIDERS = [];
export function addCollider(x, z, r) { COLLIDERS.push({ x, z, r }); }
export function clearColliders() { COLLIDERS.length = 0; }
// the jetty deck — a walkable plank surface standing over the water off the wake-up beach
// (mesh in props.js: centre jx=-18, z=-110.5, 2.4×12, plank top ~1.16). Mirror it here so
// you stand ON it instead of falling through to the seabed.
const JETTY = { x: -18, z: -110.5, hx: 1.3, hz: 6.1, y: 1.16 };

export function walkableY(x, z) {
  // the jetty deck: a real surface over the water (was a fall-through)
  if (Math.abs(x - JETTY.x) < JETTY.hx && Math.abs(z - JETTY.z) < JETTY.hz) return JETTY.y;

  // lighthouse interior: flat disc
  const dl = Math.hypot(x - SPOTS.lighthouse.x, z - SPOTS.lighthouse.y);
  if (dl < 5.4) return LIGHTHOUSE_H;

  // ruler bridge across the chasm
  if (W.flags.rulerPlaced) {
    const bz = SPOTS.chasmBridgeZ;
    if (Math.abs(z - bz) < 2.1 && x > 34 && x < 60) {
      return BRIDGE_DECK; // deck height, rim-to-rim
    }
  }

  // the vault under the bluff: enter THROUGH the open hole, stairs run south
  if (W.flags.hatchOpen) {
    const hx = SPOTS.hatch.x, hz = SPOTS.hatch.y;
    const lx = x - hx, lz = z - hz;
    // stair ramp: top inside the hole's north half, descending southward
    if (lx > -1.6 && lx < 1.6 && lz < 1.0 && lz > -8.6) {
      const t = clamp((1.0 - lz) / 7.0, 0, 1);
      return HATCH_H - 0.1 - t * 5.1;
    }
    // remainder of the open hole is a pit, not invisible ground
    if (Math.hypot(lx, lz) < 1.25) return HATCH_H - 5.2;
    // room
    if (lx > -4.5 && lx < 4.5 && lz < -8.6 && lz > -17) {
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
  // solid scatter (shore rocks, …) — block stepping INTO a registered collider circle (the
  // player._step slide-resolves along x/z, so you brush past instead of sticking)
  for (let i = 0; i < COLLIDERS.length; i++) {
    const c = COLLIDERS[i];
    if ((x1 - c.x) * (x1 - c.x) + (z1 - c.z) * (z1 - c.z) < c.r * c.r) return true;
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

  // ---- ambient occlusion bake (#4) ----------------------------------------
  // A vertex sunk below its surroundings — the chasm, the drained basin, the
  // folds at a cliff's foot — catches less skylight. Read the eight neighbours
  // straight from the finished height grid (FREE: no extra heightAt, so load
  // stays snappy) and darken by how far below the ring average each point sits;
  // convex ridges are untouched. Power-neutral by construction (vertex colours →
  // +0 draws / +0 runtime) and grade-safe (multiplies the base, so the contact
  // shadow reads in every light).
  const W1 = N + 1;            // 257 vertices per side
  const R = 3;                 // ~7.3 m ring (DOMAIN/N ≈ 2.42 m / cell)
  const clamp01 = (n) => (n < 0 ? 0 : n > N ? N : n);
  const yAt = (c, rw) => pos.getY(clamp01(c) + clamp01(rw) * W1);
  for (let i = 0; i < pos.count; i++) {
    const c = i % W1, rw = (i / W1) | 0;
    const ring = (yAt(c + R, rw) + yAt(c - R, rw) + yAt(c, rw + R) + yAt(c, rw - R) +
      yAt(c + R, rw + R) + yAt(c - R, rw + R) + yAt(c + R, rw - R) + yAt(c - R, rw - R)) * 0.125;
    const concave = ring - pos.getY(i);            // > 0 in cavities
    if (concave > 0) {
      const ao = 1 - Math.min(0.3, concave * 0.05); // up to 30% darker in deep folds
      colors[i * 3] *= ao; colors[i * 3 + 1] *= ao; colors[i * 3 + 2] *= ao;
    }
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.95,
    metalness: 0.0,
    side: THREE.DoubleSide, // chasm/valley walls + the underside read solid, never see-through
  });
  // cut the hatch hole into the heightfield (local space, so the model
  // island inherits the same hole — recursion demands it)
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uHaze = { value: new THREE.Color(0xcfe3e8) };
    sh.uniforms.uSand = { value: getTexture('sand') };        // beach grain (low band)
    sh.uniforms.uGrass = { value: getTexture('dunegrass') };  // dune scrub (high band)
    sh.uniforms.uTexAmt = { value: 0.7 };
    sh.uniforms.uTexScale = { value: 0.85 };                  // fine tiling so the sand grain/ripples read underfoot
    mat.userData.shader = sh; // so main.js can track uHaze to the active grade's fog
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vLXZ;\nvarying vec3 vWPos;\nvarying float vTerH;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vLXZ = position.xz;
        vTerH = position.y;                                   // baked height (the band key)
        vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 uHaze; uniform sampler2D uSand; uniform sampler2D uGrass;
        uniform float uTexAmt; uniform float uTexScale;
        varying vec2 vLXZ; varying vec3 vWPos; varying float vTerH;`)
      .replace('#include <clipping_planes_fragment>',
        `if (distance(vLXZ, vec2(${SPOTS.hatch.x.toFixed(1)}, ${SPOTS.hatch.y.toFixed(1)})) < 1.22) discard;\n#include <clipping_planes_fragment>`)
      // ground DETAIL: sand (low/beach) → dune-grass (high), sampled object-space and multiplied as
      // LUMINANCE so the vertex-coloured bands keep their hue but gain grain/tufts. Land-masked above
      // the waterline; FADED on the 1:240 clone via the water shader's fwidth `mini` trick so the
      // dense-tiled model never moirés. Appended after color_fragment; +0 draws.
      .replace('#include <color_fragment>', `
        #include <color_fragment>
        float gScl = (fwidth(vWPos.x) + fwidth(vWPos.z)) / max(fwidth(vLXZ.x) + fwidth(vLXZ.y), 1e-6);
        float mini = 1.0 - smoothstep(0.05, 0.5, gScl);
        vec3 detT = mix(texture2D(uSand, vLXZ * uTexScale).rgb,
                        texture2D(uGrass, vLXZ * uTexScale * 0.8).rgb,
                        smoothstep(2.2, 3.4, vTerH));
        float detL = dot(detT, vec3(0.299, 0.587, 0.114));
        float land = smoothstep(0.3, 1.1, vTerH);             // off the seabed / waterline
        diffuseColor.rgb *= mix(1.0, detL * 1.85, uTexAmt * land * (1.0 - mini * 0.85));
      `)
      // aerial perspective (#5a): the FAR land melts toward the grade's haze before
      // global fog reaches it — depth + vastness without washing the near/mid ground
      // (gentle, begins at 170 m); fragment-only, +0 draws. Matches the canopy haze.
      .replace('#include <fog_fragment>', `
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uHaze, smoothstep(170.0, 520.0, length(vViewPosition)) * 0.3);
        #include <fog_fragment>`);
  };

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'terrain';
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  return mesh;
}

// height texture for the water shader (depth → color/foam)
export function buildHeightTexture() {
  // half-float: linear filtering of fp16 is core WebGL2; fp32 linear is not
  const N = 256;
  const data = new Uint16Array(N * N);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x = (i / (N - 1) - 0.5) * DOMAIN;
      const z = (j / (N - 1) - 0.5) * DOMAIN;
      data[j * N + i] = THREE.DataUtils.toHalfFloat(heightAt(x, z));
    }
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RedFormat, THREE.HalfFloatType);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}
