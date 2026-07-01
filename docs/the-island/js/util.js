// util.js — seeded randomness, value noise, easing, tiny geometry baker.
// Everything in ABYME is deterministic: one seed births the whole island.

import * as THREE from 'three';

export const SEED = 19847;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rng = mulberry32(SEED);

// ---- 2D value noise with a seeded permutation ----
const PERM = new Uint8Array(512);
{
  const r = mulberry32(SEED ^ 0x9e3779b9);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
}

function hash2(ix, iz) {
  return PERM[(PERM[ix & 255] + iz) & 255] / 255;
}

function fade(t) { return t * t * (3 - 2 * t); }

export function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const a = hash2(ix, iz), b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  const u = fade(fx), v = fade(fz);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x, z, octaves = 4, lacunarity = 2.02, gain = 0.5) {
  let amp = 0.5, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * vnoise(x * freq, z * freq);
    norm += amp;
    amp *= gain; freq *= lacunarity;
  }
  return sum / norm; // 0..1
}

export function ridged(x, z, octaves = 4) {
  let amp = 0.5, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(vnoise(x * freq, z * freq) * 2 - 1);
    sum += amp * n * n;
    norm += amp;
    amp *= 0.5; freq *= 2.1;
  }
  return sum / norm; // 0..1, creased ridges
}

// ---- math ----
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const easeInOut = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
export const TAU = Math.PI * 2;

export function lerpColor(out, a, b, t) {
  out.r = lerp(a.r, b.r, t);
  out.g = lerp(a.g, b.g, t);
  out.b = lerp(a.b, b.b, t);
  return out;
}

// Shortest-arc lerp for angles in radians
export function lerpAngle(a, b, t) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return a + d * t;
}

// ---- geometry baker ----
// Collects transformed, vertex-colored copies of primitive geometries and
// merges them into one BufferGeometry per material bucket. This is how the
// whole static island ends up in a handful of draw calls.
export class Baker {
  constructor() {
    this.positions = [];
    this.normals = [];
    this.colors = [];
  }

  // geo: BufferGeometry, matrix: Matrix4, color: THREE.Color | (y01)=>Color
  add(geo, matrix, color) {
    const src = geo.index ? geo.toNonIndexed() : geo;
    const pos = src.attributes.position;
    const nor = src.attributes.normal;
    const nm = new THREE.Matrix3().getNormalMatrix(matrix);
    const v = new THREE.Vector3(), n = new THREE.Vector3();

    // color shading by source-local height for cheap gradient richness
    let minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const span = Math.max(1e-5, maxY - minY);

    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(matrix);
      n.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize();
      this.positions.push(v.x, v.y, v.z);
      this.normals.push(n.x, n.y, n.z);
      const c = typeof color === 'function' ? color((pos.getY(i) - minY) / span) : color;
      this.colors.push(c.r, c.g, c.b);
    }
    if (src !== geo) src.dispose();
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    return g;
  }
}

// Merge BufferGeometries into one non-indexed geometry (position + normal, and
// color when every part carries it). The de-duplicated twin of Baker: Baker bakes
// matrices + gradient colors for the big static world merge; this concatenates
// already-posed parts (canopy tiers, grass blades, bird bodies) as-is.
export function mergeGeometries(geos) {
  const flats = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  let total = 0;
  for (const g of flats) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3);
  const hasCol = flats.every((g) => g.attributes.color);
  const col = hasCol ? new Float32Array(total * 3) : null;
  let off = 0;
  for (let i = 0; i < flats.length; i++) {
    const g = flats[i];
    pos.set(g.attributes.position.array, off * 3);
    nor.set(g.attributes.normal.array, off * 3);
    if (col) col.set(g.attributes.color.array, off * 3);
    off += g.attributes.position.count;
    if (g !== geos[i]) g.dispose();   // dispose the toNonIndexed intermediates
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (col) out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}

// Vary a color: returns a fresh THREE.Color jittered in HSL
export function vary(color, r, dh = 0.015, ds = 0.06, dl = 0.05) {
  const c = color.clone();
  const hsl = {};
  c.getHSL(hsl);
  c.setHSL(
    (hsl.h + (r() - 0.5) * dh + 1) % 1,
    clamp(hsl.s + (r() - 0.5) * ds, 0, 1),
    clamp(hsl.l + (r() - 0.5) * dl, 0, 1)
  );
  return c;
}
