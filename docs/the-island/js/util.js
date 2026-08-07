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
    this.uvs = [];
    this.ranges = [];   // #34: per-add() vertex ranges + anchor, so buildChunks can bucket regionally
  }

  // geo: BufferGeometry, matrix: Matrix4, color: THREE.Color | (y01, worldPos)=>Color
  // (the callback's 2nd arg is the WORLD-space vertex — contact-AO bakes key off it, #43)
  add(geo, matrix, color) {
    const src = geo.index ? geo.toNonIndexed() : geo;
    const pos = src.attributes.position;
    // #34: remember where this piece lands in the flat arrays + where it stands in the
    // world (its matrix translation) — every attribute below appends in lockstep, so a
    // range slices back out cleanly for the regional build.
    this.ranges.push({ start: this.positions.length / 3, count: pos.count, x: matrix.elements[12], z: matrix.elements[14] });
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

    const wp = new Float32Array(pos.count * 3);   // world positions, kept for the uv pass below
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(matrix);
      n.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize();
      wp[i * 3] = v.x; wp[i * 3 + 1] = v.y; wp[i * 3 + 2] = v.z;
      this.positions.push(v.x, v.y, v.z);
      this.normals.push(n.x, n.y, n.z);
      const c = typeof color === 'function' ? color((pos.getY(i) - minY) / span, v) : color;
      this.colors.push(c.r, c.g, c.b);
    }

    // UVs: box-projected in WORLD METERS, dominant axis per triangle (bake-time triplanar).
    // The merged mesh had no uv at all, so matStone's granite albedo+normal sampled ONE texel —
    // the headline "tower is flat" bug. We deliberately do NOT copy source uvs: primitives carry
    // parametric 0..1 uvs per surface, so a 17 m wall arc and the 2.5 m lintel above its own door
    // would tile ~7x apart. Projecting world x/y/z instead gives ONE continuous masonry scale
    // across the whole bake, matching the standing stones' read (~1 uv unit per metre — their
    // BoxGeometry maps 0..1 across a ~1.1 m face). v = world y on every side face, so the ashlar
    // mortar courses stay level and continuous around corners; the axis-switch seams land on the
    // 45° diagonals where the stochastic granite hides them.
    for (let i = 0; i + 2 < pos.count; i += 3) {
      const ax = wp[i * 3], ay = wp[i * 3 + 1], az = wp[i * 3 + 2];
      const e1x = wp[i * 3 + 3] - ax, e1y = wp[i * 3 + 4] - ay, e1z = wp[i * 3 + 5] - az;
      const e2x = wp[i * 3 + 6] - ax, e2y = wp[i * 3 + 7] - ay, e2z = wp[i * 3 + 8] - az;
      const fx = Math.abs(e1y * e2z - e1z * e2y);   // |face normal| components
      const fy = Math.abs(e1z * e2x - e1x * e2z);
      const fz = Math.abs(e1x * e2y - e1y * e2x);
      for (let k = 0; k < 3; k++) {
        const px = wp[(i + k) * 3], py = wp[(i + k) * 3 + 1], pz = wp[(i + k) * 3 + 2];
        if (fy >= fx && fy >= fz) this.uvs.push(px, pz);        // up/down faces: floor plan
        else if (fx >= fz) this.uvs.push(pz, py);               // ±x faces: v = height
        else this.uvs.push(px, py);                             // ±z faces: v = height
      }
    }
    if (src !== geo) src.dispose();
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    return g;
  }

  // #34: the regional build — the same bake, bucketed by each piece's world anchor into
  // grid cells so the merged statics can frustum-cull. Every vertex is byte-identical to
  // build()'s output; only which mesh it lives in changes. Returns one geometry per
  // non-empty cell.
  buildChunks(cell = 120) {
    const buckets = new Map();
    for (const r of this.ranges) {
      const k = Math.floor((r.x + 240) / cell) * 64 + Math.floor((r.z + 240) / cell);
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(r);
    }
    const out = [];
    for (const list of buckets.values()) {
      let total = 0;
      for (const r of list) total += r.count;
      const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3);
      const col = new Float32Array(total * 3), uv = new Float32Array(total * 2);
      let off = 0;
      for (const r of list) {
        for (let i = 0; i < r.count * 3; i++) {
          pos[off * 3 + i] = this.positions[r.start * 3 + i];
          nor[off * 3 + i] = this.normals[r.start * 3 + i];
          col[off * 3 + i] = this.colors[r.start * 3 + i];
        }
        for (let i = 0; i < r.count * 2; i++) uv[off * 2 + i] = this.uvs[r.start * 2 + i];
        off += r.count;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.computeBoundingSphere();
      out.push(g);
    }
    return out;
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


// ---------------------------------------------------------------------------
// #73: the minimal update scheduler. Per-entity animation kept accreting into
// applyAtmosphere/Game.tick; content now registers a drive BESIDE its build code
// and self-gates via when(W). main runs the list once per frame.
export const DRIVES = [];
export function addDrive(when, update) { DRIVES.push({ when, update }); }
export function runDrives(W, dt, elapsed, ctx) {
  for (const d of DRIVES) if (!d.when || d.when(W)) d.update(dt, elapsed, ctx);
}
