// ════════════════════════════════════════════════════════════
// WebGL 3D Terrain Renderer — isometric settlement-builder
// Parallel 3D renderer using the same tile grid as real 3D
// geometry with directional lighting.
// ════════════════════════════════════════════════════════════

import { G, TILE, MAP_W, MAP_H } from './state.js';

// ── Module-level GL state ──────────────────────────────────
let gl = null;
let program = null;
let vao = null;          // WebGL2 VAO (or null for WebGL1)
let vertexBuf = null;
let indexBuf = null;
let indexCount = 0;
let terrainIndexCount = 0;
let treeIndexCount = 0;
let isWebGL2 = false;

// Buildings mesh state
let buildingsVao = null;
let buildingsVertexBuf = null;
let buildingsIndexBuf = null;
let buildingsIndexCount = 0;
let lastBuildingRebuild = 0;

// Uniform locations
let uViewProjLoc = null;
let uLightDirLoc = null;
let uTimeLoc = null;

// Extension for VAO in WebGL1
let oeVao = null;

// ── Tile heights ───────────────────────────────────────────
const TILE_HEIGHT = {
  [TILE.WATER]:    0.0,
  [TILE.SAND]:     0.4,
  [TILE.GRASS]:    0.8,
  [TILE.FOREST]:   0.8,
  [TILE.STONE]:    1.3,
  [TILE.IRON]:     1.3,
  [TILE.MOUNTAIN]: 3.5,
};

// ── Tile colors (RGB 0–1 matching existing palette) ────────
const TILE_COLOR_3D = {
  [TILE.WATER]:    [0.10, 0.40, 0.75],
  [TILE.SAND]:     [0.91, 0.78, 0.49],
  [TILE.GRASS]:    [0.40, 0.78, 0.42],
  [TILE.FOREST]:   [0.18, 0.48, 0.21],
  [TILE.STONE]:    [0.60, 0.58, 0.56],
  [TILE.IRON]:     [0.35, 0.52, 0.72],
  [TILE.MOUNTAIN]: [0.42, 0.42, 0.48],
};

// ── Shader sources ─────────────────────────────────────────
const VS_SRC_300 = `#version 300 es
in vec3 aPos;
in vec3 aNormal;
in vec3 aColor;
uniform mat4 uViewProj;
uniform float uTime;
out vec3 vNormal;
out vec3 vColor;
out vec3 vWorldPos;
void main() {
  vec3 pos = aPos;
  // Water animation: tiles where color is water blue get wave displacement
  bool isWater = aColor.b > 0.6 && aColor.r < 0.2;
  if (isWater && aPos.y < 0.01) {
    float wave = sin(aPos.x * 0.8 + uTime * 1.5) * 0.08
               + cos(aPos.z * 0.8 + uTime * 1.2) * 0.06;
    pos.y += wave;
  }
  gl_Position = uViewProj * vec4(pos, 1.0);
  vNormal = aNormal;
  vColor = aColor;
  vWorldPos = pos;
}`;

const FS_SRC_300 = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vColor;
in vec3 vWorldPos;
out vec4 fragColor;
uniform vec3 uLightDir;
void main() {
  vec3 N = normalize(vNormal);
  float NdotL = max(0.0, dot(N, uLightDir));
  vec3 ambient = vColor * 0.25;
  vec3 diffuse = vColor * NdotL * 1.1;
  fragColor = vec4(ambient + diffuse, 1.0);
}`;

// WebGL1 fallback shaders
const VS_SRC_100 = `
attribute vec3 aPos;
attribute vec3 aNormal;
attribute vec3 aColor;
uniform mat4 uViewProj;
uniform float uTime;
varying vec3 vNormal;
varying vec3 vColor;
varying vec3 vWorldPos;
void main() {
  vec3 pos = aPos;
  bool isWater = aColor.b > 0.6 && aColor.r < 0.2;
  if (isWater && aPos.y < 0.01) {
    float wave = sin(aPos.x * 0.8 + uTime * 1.5) * 0.08
               + cos(aPos.z * 0.8 + uTime * 1.2) * 0.06;
    pos.y += wave;
  }
  gl_Position = uViewProj * vec4(pos, 1.0);
  vNormal = aNormal;
  vColor = aColor;
  vWorldPos = pos;
}`;

const FS_SRC_100 = `
precision highp float;
varying vec3 vNormal;
varying vec3 vColor;
varying vec3 vWorldPos;
uniform vec3 uLightDir;
void main() {
  vec3 N = normalize(vNormal);
  float NdotL = max(0.0, dot(N, uLightDir));
  vec3 ambient = vColor * 0.25;
  vec3 diffuse = vColor * NdotL * 1.1;
  gl_FragColor = vec4(ambient + diffuse, 1.0);
}`;

// ── Matrix math ────────────────────────────────────────────
function mat4Identity() {
  return new Float32Array([
    1,0,0,0,
    0,1,0,0,
    0,0,1,0,
    0,0,0,1,
  ]);
}

function mat4Multiply(a, b) {
  const out = new Float32Array(16);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += a[r + k*4] * b[k + c*4];
      }
      out[r + c*4] = sum;
    }
  }
  return out;
}

function mat4Ortho(left, right, bottom, top, near, far) {
  const out = new Float32Array(16);
  const rl = right - left;
  const tb = top - bottom;
  const fn = far - near;
  out[0]  =  2 / rl;
  out[5]  =  2 / tb;
  out[10] = -2 / fn;
  out[12] = -(right + left) / rl;
  out[13] = -(top + bottom) / tb;
  out[14] = -(far + near) / fn;
  out[15] = 1;
  return out;
}

function mat4RotateX(rad) {
  const c = Math.cos(rad), s = Math.sin(rad);
  return new Float32Array([
    1, 0,  0, 0,
    0, c,  s, 0,
    0,-s,  c, 0,
    0, 0,  0, 1,
  ]);
}

function mat4RotateY(rad) {
  const c = Math.cos(rad), s = Math.sin(rad);
  return new Float32Array([
     c, 0,-s, 0,
     0, 1, 0, 0,
     s, 0, c, 0,
     0, 0, 0, 1,
  ]);
}

function mat4Translate(tx, ty, tz) {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    tx, ty, tz, 1,
  ]);
}

// ── Shader compilation helpers ─────────────────────────────
function compileShader(glCtx, type, src) {
  const sh = glCtx.createShader(type);
  glCtx.shaderSource(sh, src);
  glCtx.compileShader(sh);
  if (!glCtx.getShaderParameter(sh, glCtx.COMPILE_STATUS)) {
    const log = glCtx.getShaderInfoLog(sh);
    glCtx.deleteShader(sh);
    throw new Error('Shader compile error: ' + log);
  }
  return sh;
}

function createProgram(glCtx, vsSrc, fsSrc) {
  const vs = compileShader(glCtx, glCtx.VERTEX_SHADER, vsSrc);
  const fs = compileShader(glCtx, glCtx.FRAGMENT_SHADER, fsSrc);
  const prog = glCtx.createProgram();
  glCtx.attachShader(prog, vs);
  glCtx.attachShader(prog, fs);
  glCtx.linkProgram(prog);
  if (!glCtx.getProgramParameter(prog, glCtx.LINK_STATUS)) {
    const log = glCtx.getProgramInfoLog(prog);
    glCtx.deleteProgram(prog);
    throw new Error('Program link error: ' + log);
  }
  glCtx.deleteShader(vs);
  glCtx.deleteShader(fs);
  return prog;
}

// ── Mesh geometry helpers ──────────────────────────────────
// We build a flat array:  [x,y,z, nx,ny,nz, r,g,b]  per vertex
// and a separate Uint32Array of indices.

function pushFace(verts, indices, positions, normal, color) {
  // positions: array of 4 [x,y,z], normal: [nx,ny,nz], color: [r,g,b]
  const base = verts.length / 9;  // 9 floats per vertex
  for (const p of positions) {
    verts.push(p[0], p[1], p[2], normal[0], normal[1], normal[2], color[0], color[1], color[2]);
  }
  // Two triangles: base+0,1,2 and base+0,2,3
  indices.push(base, base+1, base+2, base, base+2, base+3);
}

// Per-vertex normals variant — for height-field top faces
function pushFaceNormals(verts, indices, positions, normals, color) {
  const base = verts.length / 9;
  for (let i = 0; i < 4; i++) {
    const p = positions[i], n = normals[i];
    verts.push(p[0], p[1], p[2], n[0], n[1], n[2], color[0], color[1], color[2]);
  }
  indices.push(base, base+1, base+2, base, base+2, base+3);
}

function pushTri(verts, indices, p0, p1, p2, normal, color) {
  const base = verts.length / 9;
  for (const p of [p0, p1, p2]) {
    verts.push(p[0], p[1], p[2], normal[0], normal[1], normal[2], color[0], color[1], color[2]);
  }
  indices.push(base, base+1, base+2);
}

function pushBox(verts, indices, x0, y0, z0, x1, y1, z1, color) {
  // Top
  pushFace(verts, indices, [[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1]], [0,1,0], color);
  // Bottom
  pushFace(verts, indices, [[x0,y0,z0],[x0,y0,z1],[x1,y0,z1],[x1,y0,z0]], [0,-1,0], color);
  // Front (+Z)
  pushFace(verts, indices, [[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]], [0,0,1], color);
  // Back (-Z)
  pushFace(verts, indices, [[x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0]], [0,0,-1], color);
  // Right (+X)
  pushFace(verts, indices, [[x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1]], [1,0,0], color);
  // Left (-X)
  pushFace(verts, indices, [[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0]], [-1,0,0], color);
}

// ── Tree geometry ──────────────────────────────────────────
function addTree(verts, indices, cx, cz, groundY) {
  const baseY = groundY;
  const S = 2.8; // scale up trees so they're clearly visible 3D landmarks
  // Canopy only — no trunk box, keeps forest floor readable
  const trunkH = 0.3 * S;  // canopy base height above ground
  const canopyColor     = [0.22, 0.82, 0.28];
  const canopyColorDark = [0.14, 0.55, 0.18];
  const topY = baseY + trunkH + 1.6 * S;
  const midY = baseY + trunkH;
  const cw = 0.6 * S;
  const apex = [cx, topY, cz];
  // Front
  pushTri(verts, indices,
    [cx-cw, midY, cz+cw], [cx+cw, midY, cz+cw], apex,
    [0, 0.3, 1], canopyColor
  );
  // Right
  pushTri(verts, indices,
    [cx+cw, midY, cz+cw], [cx+cw, midY, cz-cw], apex,
    [1, 0.3, 0], canopyColorDark
  );
  // Back
  pushTri(verts, indices,
    [cx+cw, midY, cz-cw], [cx-cw, midY, cz-cw], apex,
    [0, 0.3, -1], canopyColor
  );
  // Left
  pushTri(verts, indices,
    [cx-cw, midY, cz-cw], [cx-cw, midY, cz+cw], apex,
    [-1, 0.3, 0], canopyColorDark
  );
}

// ── Building geometry helpers ──────────────────────────────

function addBuildingMesh(verts, indices, b, groundY) {
  const cx = b.x + 0.5;
  const cz = b.y + 0.5;
  const gy = groundY;
  const type = b.type;
  const S = 3.5; // global building size multiplier for visibility

  // Record vertex count before building; we'll scale them at the end
  const vertStart = verts.length;
  if (type === 'house') {
    // Base box
    const baseColor = [0.82, 0.62, 0.38];
    const hw = 0.4;
    const bh = 0.6;
    pushBox(verts, indices, cx-hw, gy, cz-hw, cx+hw, gy+bh, cz+hw, baseColor);
    // Pyramid roof
    const roofColor = [0.78, 0.22, 0.18];
    const roofBase = gy + bh;
    const roofApex = roofBase + 0.5;
    const rw = 0.42;
    const apex = [cx, roofApex, cz];
    pushTri(verts, indices, [cx-rw,roofBase,cz+rw], [cx+rw,roofBase,cz+rw], apex, [0,0.3,1], roofColor);
    pushTri(verts, indices, [cx+rw,roofBase,cz+rw], [cx+rw,roofBase,cz-rw], apex, [1,0.3,0], roofColor);
    pushTri(verts, indices, [cx+rw,roofBase,cz-rw], [cx-rw,roofBase,cz-rw], apex, [0,0.3,-1], roofColor);
    pushTri(verts, indices, [cx-rw,roofBase,cz-rw], [cx-rw,roofBase,cz+rw], apex, [-1,0.3,0], roofColor);

  } else if (type === 'farm') {
    // Flat wooden platform
    const platformColor = [0.72, 0.55, 0.30];
    pushBox(verts, indices, cx-0.48, gy, cz-0.48, cx+0.48, gy+0.05, cz+0.48, platformColor);
    // 4 crop boxes in 2x2 grid
    const cropColor = [0.35, 0.22, 0.10];
    const offsets = [[-0.2,-0.2],[0.2,-0.2],[-0.2,0.2],[0.2,0.2]];
    for (const [ox, oz] of offsets) {
      pushBox(verts, indices, cx+ox-0.08, gy+0.05, cz+oz-0.08, cx+ox+0.08, gy+0.18, cz+oz+0.08, cropColor);
    }

  } else if (type === 'tower') {
    // Tall thin box
    const towerColor = [0.55, 0.55, 0.60];
    pushBox(verts, indices, cx-0.2, gy, cz-0.2, cx+0.2, gy+1.4, cz+0.2, towerColor);
    // Turret on top
    const turretColor = [0.40, 0.40, 0.45];
    pushBox(verts, indices, cx-0.25, gy+1.4, cz-0.25, cx+0.25, gy+1.65, cz+0.25, turretColor);

  } else if (type === 'church') {
    // Wide base
    const stoneColor = [0.87, 0.82, 0.74];
    pushBox(verts, indices, cx-0.45, gy, cz-0.45, cx+0.45, gy+0.7, cz+0.45, stoneColor);
    // Steeple tower on +X side
    const steepleColor = [0.80, 0.75, 0.68];
    pushBox(verts, indices, cx+0.15, gy, cz-0.15, cx+0.45, gy+1.4, cz+0.15, steepleColor);
    // Steeple apex
    const apexY = gy + 1.4 + 0.4;
    const sc = 0.15;
    const sa = [cx+0.3, apexY, cz];
    pushTri(verts, indices, [cx+0.15,gy+1.4,cz+sc],[cx+0.45,gy+1.4,cz+sc], sa, [0,0.3,1], steepleColor);
    pushTri(verts, indices, [cx+0.45,gy+1.4,cz+sc],[cx+0.45,gy+1.4,cz-sc], sa, [1,0.3,0], steepleColor);
    pushTri(verts, indices, [cx+0.45,gy+1.4,cz-sc],[cx+0.15,gy+1.4,cz-sc], sa, [0,0.3,-1], steepleColor);
    pushTri(verts, indices, [cx+0.15,gy+1.4,cz-sc],[cx+0.15,gy+1.4,cz+sc], sa, [-1,0.3,0], steepleColor);

  } else if (type === 'barracks') {
    // Grey stone, wide and lower
    const barColor = [0.42, 0.45, 0.52];
    pushBox(verts, indices, cx-0.48, gy, cz-0.38, cx+0.48, gy+0.55, cz+0.38, barColor);
    // Flag stick (thin dark red box on top)
    const flagColor = [0.55, 0.10, 0.10];
    pushBox(verts, indices, cx+0.35, gy+0.55, cz-0.03, cx+0.42, gy+0.9, cz+0.03, flagColor);

  } else if (type === 'market') {
    // Low open platform
    const platColor = [0.80, 0.72, 0.55];
    pushBox(verts, indices, cx-0.48, gy, cz-0.48, cx+0.48, gy+0.2, cz+0.48, platColor);
    // Red awning
    const awningColor = [0.85, 0.22, 0.18];
    pushBox(verts, indices, cx-0.4, gy+0.2, cz-0.4, cx+0.4, gy+0.35, cz+0.4, awningColor);

  } else if (type === 'castle') {
    // Main keep
    const castleColor = [0.65, 0.62, 0.60];
    pushBox(verts, indices, cx-0.35, gy, cz-0.35, cx+0.35, gy+1.3, cz+0.35, castleColor);
    // Corner towers
    const towerColor2 = [0.58, 0.55, 0.52];
    pushBox(verts, indices, cx-0.48, gy, cz-0.48, cx-0.22, gy+1.0, cz-0.22, towerColor2);
    pushBox(verts, indices, cx+0.22, gy, cz+0.22, cx+0.48, gy+1.0, cz+0.48, towerColor2);

  } else if (type === 'well') {
    // Stone ring base
    const wellColor = [0.62, 0.58, 0.55];
    pushBox(verts, indices, cx-0.22, gy, cz-0.22, cx+0.22, gy+0.25, cz+0.22, wellColor);
    // Hollow out the top by just leaving a platform (visual approximation)
    // Wooden crossbar
    const woodColor = [0.55, 0.38, 0.18];
    pushBox(verts, indices, cx-0.25, gy+0.25, cz-0.04, cx+0.25, gy+0.32, cz+0.04, woodColor);

  } else if (type === 'tavern') {
    // Warmer wood color, similar to house
    const tavColor = [0.72, 0.48, 0.25];
    pushBox(verts, indices, cx-0.42, gy, cz-0.42, cx+0.42, gy+0.65, cz+0.42, tavColor);
    // Roof
    const roofColor = [0.55, 0.30, 0.15];
    const rb = gy + 0.65;
    const ra = rb + 0.45;
    const rw = 0.44;
    const rapex = [cx, ra, cz];
    pushTri(verts, indices, [cx-rw,rb,cz+rw],[cx+rw,rb,cz+rw], rapex, [0,0.3,1], roofColor);
    pushTri(verts, indices, [cx+rw,rb,cz+rw],[cx+rw,rb,cz-rw], rapex, [1,0.3,0], roofColor);
    pushTri(verts, indices, [cx+rw,rb,cz-rw],[cx-rw,rb,cz-rw], rapex, [0,0.3,-1], roofColor);
    pushTri(verts, indices, [cx-rw,rb,cz-rw],[cx-rw,rb,cz+rw], rapex, [-1,0.3,0], roofColor);
    // Chimney
    const chimneyColor = [0.50, 0.45, 0.42];
    pushBox(verts, indices, cx+0.2, gy+0.65, cz-0.08, cx+0.30, gy+0.95, cz+0.08, chimneyColor);

  } else if (type === 'blacksmith') {
    // Dark grey box
    const smithColor = [0.35, 0.35, 0.40];
    pushBox(verts, indices, cx-0.38, gy, cz-0.38, cx+0.38, gy+0.6, cz+0.38, smithColor);
    // Chimney
    const chimneyColor = [0.28, 0.28, 0.32];
    pushBox(verts, indices, cx+0.18, gy+0.6, cz-0.08, cx+0.28, gy+0.95, cz+0.08, chimneyColor);

  } else if (type === 'windmill') {
    // Tall body
    const wmColor = [0.78, 0.72, 0.62];
    pushBox(verts, indices, cx-0.2, gy, cz-0.2, cx+0.2, gy+1.1, cz+0.2, wmColor);
    // Cross blades (2 overlapping flat boxes)
    const bladeColor = [0.90, 0.85, 0.70];
    pushBox(verts, indices, cx-0.55, gy+0.85, cz-0.04, cx+0.55, gy+0.96, cz+0.04, bladeColor);
    pushBox(verts, indices, cx-0.04, gy+0.55, cz-0.04, cx+0.04, gy+1.25, cz+0.04, bladeColor);

  } else {
    // Generic grey box for all others (quarry, mine, lumber, granary, etc.)
    const genericColor = [0.55, 0.55, 0.55];
    pushBox(verts, indices, cx-0.35, gy, cz-0.35, cx+0.35, gy+0.55, cz+0.35, genericColor);
  }

  // Scale all vertices of this building by S around (cx, gy, cz)
  // Vertex layout is [x,y,z, nx,ny,nz, r,g,b] — 9 floats per vertex
  for (let i = vertStart; i < verts.length; i += 9) {
    verts[i]   = cx + (verts[i]   - cx) * S;
    verts[i+1] = gy + (verts[i+1] - gy) * S;
    verts[i+2] = cz + (verts[i+2] - cz) * S;
  }
}

// ── Upload a mesh to a VAO/buffer pair ─────────────────────
function uploadMesh(targetVao, targetVertBuf, targetIdxBuf, verts, indices) {
  const vertData = new Float32Array(verts);
  const idxData  = new Uint32Array(indices);
  const STRIDE   = 9 * 4;

  if (isWebGL2) {
    gl.bindVertexArray(targetVao);
  } else if (oeVao) {
    oeVao.bindVertexArrayOES(targetVao);
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, targetVertBuf);
  gl.bufferData(gl.ARRAY_BUFFER, vertData, gl.DYNAMIC_DRAW);

  const aPosLoc    = gl.getAttribLocation(program, 'aPos');
  const aNormalLoc = gl.getAttribLocation(program, 'aNormal');
  const aColorLoc  = gl.getAttribLocation(program, 'aColor');

  gl.enableVertexAttribArray(aPosLoc);
  gl.vertexAttribPointer(aPosLoc,    3, gl.FLOAT, false, STRIDE, 0);

  gl.enableVertexAttribArray(aNormalLoc);
  gl.vertexAttribPointer(aNormalLoc, 3, gl.FLOAT, false, STRIDE, 3*4);

  gl.enableVertexAttribArray(aColorLoc);
  gl.vertexAttribPointer(aColorLoc,  3, gl.FLOAT, false, STRIDE, 6*4);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, targetIdxBuf);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idxData, gl.DYNAMIC_DRAW);

  if (isWebGL2) {
    gl.bindVertexArray(null);
  } else if (oeVao) {
    oeVao.bindVertexArrayOES(null);
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  return idxData.length;
}

export function buildTerrainMesh() {
  if (!gl) return;

  const verts = [];
  const indices = [];
  const treeTiles = []; // collected during terrain loop, drawn after terrain

  // Base height of a tile — used for side-face culling (only draw when neighbor is lower)
  const tileBaseH = (r, c) => {
    const tr = Math.max(0, Math.min(MAP_H - 1, r));
    const tc = Math.max(0, Math.min(MAP_W - 1, c));
    const tt = (G.map[tr] && G.map[tr][tc] !== undefined) ? G.map[tr][tc] : TILE.GRASS;
    return TILE_HEIGHT[tt] !== undefined ? TILE_HEIGHT[tt] : 0.5;
  };

  // Noisy height for slope-normal computation only (not for geometry)
  const tileH = (r, c) => {
    const tr = Math.max(0, Math.min(MAP_H - 1, r));
    const tc = Math.max(0, Math.min(MAP_W - 1, c));
    const tt = (G.map[tr] && G.map[tr][tc] !== undefined) ? G.map[tr][tc] : TILE.GRASS;
    const bh = TILE_HEIGHT[tt] !== undefined ? TILE_HEIGHT[tt] : 0.5;
    if (tt === TILE.WATER) return bh;
    const s = (tc * 374761 + tr * 668265) >>> 0;
    return bh + ((s & 0xff) / 255 - 0.5) * 0.12;
  };

  // Compute smooth normal for a top-face vertex at (row, col) using Sobel-filter on heights
  const vertNormal = (r, c) => {
    const dx = (tileH(r, c + 1) - tileH(r, c - 1)) * 0.4; // moderate slope factor
    const dz = (tileH(r + 1, c) - tileH(r - 1, c)) * 0.4;
    const nx = -dx, ny = 1.0, nz = -dz;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    return [nx / len, ny / len, nz / len];
  };

  for (let row = 0; row < MAP_H; row++) {
    for (let col = 0; col < MAP_W; col++) {
      const tileType = (G.map[row] && G.map[row][col] !== undefined) ? G.map[row][col] : TILE.GRASS;
      const baseH = TILE_HEIGHT[tileType] !== undefined ? TILE_HEIGHT[tileType] : 0.5;
      const baseColor = TILE_COLOR_3D[tileType] || [0.5, 0.5, 0.5];

      // Per-tile deterministic noise for variety (breaks up the uniform-square look)
      const seed = (col * 374761 + row * 668265) >>> 0;
      const noise1 = ((seed & 0xff) / 255 - 0.5); // -0.5..0.5
      const noise2 = (((seed >>> 8) & 0xff) / 255 - 0.5);

      // Flat geometry within each biome — eliminates tile-edge ledges and triangle grid.
      // tileH() still uses noise for slope normal computation (subtle shading variation).
      const h = baseH;

      // No per-tile color variation — solid biome colors let slope normals read cleanly
      const cv = 0;
      const color = [
        Math.max(0, Math.min(1, baseColor[0] * (1 + cv))),
        Math.max(0, Math.min(1, baseColor[1] * (1 + cv))),
        Math.max(0, Math.min(1, baseColor[2] * (1 + cv))),
      ];

      const x0 = col;
      const x1 = col + 1;
      const z0 = row;
      const z1 = row + 1;
      const y  = h;    // top face at height h
      const yb = -0.5;  // bottom goes below sea so no gaps

      // Top face normal: flat for water (no grid), slope-based for land
      let tileNormal;
      if (tileType === TILE.WATER) {
        tileNormal = [0, 1, 0];
      } else {
        const dx3 = (tileH(row, col + 1) - tileH(row, col - 1)) * 0.4;
        const dz3 = (tileH(row + 1, col) - tileH(row - 1, col)) * 0.4;
        const tnx = -dx3, tny = 1.0, tnz = -dz3;
        const tlen = Math.sqrt(tnx * tnx + tny * tny + tnz * tnz);
        tileNormal = [tnx / tlen, tny / tlen, tnz / tlen];
      }
      pushFace(verts, indices,
        [ [x0,y,z0], [x1,y,z0], [x1,y,z1], [x0,y,z1] ],
        tileNormal,
        color
      );

      // Skip water side faces entirely — water is a flat plane
      if (tileType === TILE.WATER) continue;

      // Only draw a side face when the neighbor on that side is lower — avoids
      // same-height tile walls that create the triangle grid within flat biomes
      if (h > 0.0) {
        const sideColor = color;
        if (tileBaseH(row + 1, col) < h) {
          pushFace(verts, indices,
            [ [x0,yb,z1], [x1,yb,z1], [x1,y,z1], [x0,y,z1] ],
            [0, 0, 1], sideColor
          );
        }
        if (tileBaseH(row - 1, col) < h) {
          pushFace(verts, indices,
            [ [x1,yb,z0], [x0,yb,z0], [x0,y,z0], [x1,y,z0] ],
            [0, 0, -1], sideColor
          );
        }
        if (tileBaseH(row, col + 1) < h) {
          pushFace(verts, indices,
            [ [x1,yb,z1], [x1,yb,z0], [x1,y,z0], [x1,y,z1] ],
            [1, 0, 0], sideColor
          );
        }
        if (tileBaseH(row, col - 1) < h) {
          pushFace(verts, indices,
            [ [x0,yb,z0], [x0,yb,z1], [x0,y,z1], [x0,y,z0] ],
            [-1, 0, 0], sideColor
          );
        }
      }

      // ~40% of FOREST tiles get a tree — lets forest floor show through
      if (tileType === TILE.FOREST) {
        const treeSeed = (col * 4517 + row * 2971) >>> 0;
        if ((treeSeed % 10) < 4) {
          treeTiles.push([col + 0.5, row + 0.5, h]);
        }
      }
    }
  }

  // Record terrain-only index count, then append tree geometry
  terrainIndexCount = indices.length;
  for (const [cx, cz, groundY] of treeTiles) {
    addTree(verts, indices, cx, cz, groundY);
  }
  treeIndexCount = indices.length - terrainIndexCount;

  const vertData = new Float32Array(verts);
  const idxData  = new Uint32Array(indices);
  indexCount = idxData.length;

  const STRIDE = 9 * 4; // 9 floats × 4 bytes

  if (isWebGL2) {
    // Bind VAO then upload buffers
    gl.bindVertexArray(vao);
  } else if (oeVao) {
    oeVao.bindVertexArrayOES(vao);
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuf);
  gl.bufferData(gl.ARRAY_BUFFER, vertData, gl.STATIC_DRAW);

  const aPosLoc    = gl.getAttribLocation(program, 'aPos');
  const aNormalLoc = gl.getAttribLocation(program, 'aNormal');
  const aColorLoc  = gl.getAttribLocation(program, 'aColor');

  gl.enableVertexAttribArray(aPosLoc);
  gl.vertexAttribPointer(aPosLoc,    3, gl.FLOAT, false, STRIDE, 0);

  gl.enableVertexAttribArray(aNormalLoc);
  gl.vertexAttribPointer(aNormalLoc, 3, gl.FLOAT, false, STRIDE, 3*4);

  gl.enableVertexAttribArray(aColorLoc);
  gl.vertexAttribPointer(aColorLoc,  3, gl.FLOAT, false, STRIDE, 6*4);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuf);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idxData, gl.STATIC_DRAW);

  if (isWebGL2) {
    gl.bindVertexArray(null);
  } else if (oeVao) {
    oeVao.bindVertexArrayOES(null);
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, null);
}

// ── Buildings mesh ─────────────────────────────────────────
export function buildBuildingsMesh() {
  if (!gl || !program) return;

  const verts   = [];
  const indices = [];

  if (!G.buildings || G.buildings.length === 0) {
    buildingsIndexCount = 0;
    lastBuildingRebuild = performance.now();
    console.log('[gl3d] No buildings to render');
    return;
  }
  console.log(`[gl3d] Building mesh for ${G.buildings.length} buildings`);

  for (const b of G.buildings) {
    // Skip non-structural types that have no visual presence worth rendering
    if (b.type === 'road' || b.type === 'wall') continue;

    const row = b.y;
    const col = b.x;
    const tileType = (G.map[row] && G.map[row][col] !== undefined)
      ? G.map[row][col]
      : TILE.GRASS;
    const baseH = TILE_HEIGHT[tileType] !== undefined ? TILE_HEIGHT[tileType] : 0.8;
    const seed = (col * 374761 + row * 668265) >>> 0;
    const noise1 = ((seed & 0xff) / 255 - 0.5);
    const groundY = baseH + (tileType === TILE.WATER ? 0 : noise1 * 0.12) + 0.02;

    addBuildingMesh(verts, indices, b, groundY);
  }

  if (indices.length === 0) {
    buildingsIndexCount = 0;
    lastBuildingRebuild = performance.now();
    return;
  }

  buildingsIndexCount = uploadMesh(buildingsVao, buildingsVertexBuf, buildingsIndexBuf, verts, indices);
  lastBuildingRebuild = performance.now();
  console.log(`[gl3d] Buildings mesh uploaded: ${verts.length/9} verts, ${indices.length} indices`);
}

// ── Camera / VP matrix ─────────────────────────────────────
function buildViewProjection() {
  const zoom = (G.camera && G.camera.zoom) ? G.camera.zoom : 1.3;
  const orthoSize = 26 / zoom;

  const aspect = (gl.drawingBufferWidth || 800) / (gl.drawingBufferHeight || 600);
  const hw = orthoSize * aspect;
  const hh = orthoSize;

  const ortho = mat4Ortho(-hw, hw, -hh, hh, -300, 300);

  // Pitch: arctan(1/sqrt(2)) ≈ 35.264° (true isometric)
  const pitchRad = -Math.atan(1 / Math.sqrt(2));
  const yawRad   = -Math.PI / 4; // -45°

  const rx = mat4RotateX(pitchRad);
  const ry = mat4RotateY(yawRad);

  // Camera target: center of map at ground level
  const cx = MAP_W / 2;
  const cy = 0;
  const cz = MAP_H / 2;
  const tr = mat4Translate(-cx, -cy, -cz);

  // VP = ortho * rotateX * rotateY * translate
  const vp = mat4Multiply(ortho, mat4Multiply(rx, mat4Multiply(ry, tr)));
  return vp;
}

// ── Public API ─────────────────────────────────────────────

export function initGL3D(canvas) {
  if (!canvas) {
    console.warn('initGL3D: no canvas provided');
    return false;
  }

  // Try WebGL2 first, fall back to WebGL1
  gl = canvas.getContext('webgl2', { antialias: true, depth: true });
  if (gl) {
    isWebGL2 = true;
  } else {
    gl = canvas.getContext('webgl', { antialias: true, depth: true }) ||
         canvas.getContext('experimental-webgl', { antialias: true, depth: true });
    isWebGL2 = false;
    if (!gl) {
      console.error('WebGL not supported');
      return false;
    }
    // Check for VAO extension in WebGL1
    oeVao = gl.getExtension('OES_vertex_array_object');
  }

  // Compile shaders
  try {
    if (isWebGL2) {
      program = createProgram(gl, VS_SRC_300, FS_SRC_300);
    } else {
      program = createProgram(gl, VS_SRC_100, FS_SRC_100);
    }
  } catch (e) {
    console.error('WebGL3D shader error:', e);
    return false;
  }

  // Get uniform locations
  uViewProjLoc = gl.getUniformLocation(program, 'uViewProj');
  uLightDirLoc = gl.getUniformLocation(program, 'uLightDir');
  uTimeLoc     = gl.getUniformLocation(program, 'uTime');

  // Create terrain VAO
  if (isWebGL2) {
    vao = gl.createVertexArray();
  } else if (oeVao) {
    vao = oeVao.createVertexArrayOES();
  }

  // Create terrain GPU buffers
  vertexBuf = gl.createBuffer();
  indexBuf  = gl.createBuffer();

  // Create buildings VAO
  if (isWebGL2) {
    buildingsVao = gl.createVertexArray();
  } else if (oeVao) {
    buildingsVao = oeVao.createVertexArrayOES();
  }

  // Create buildings GPU buffers
  buildingsVertexBuf = gl.createBuffer();
  buildingsIndexBuf  = gl.createBuffer();

  // GL state
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
  gl.clearColor(0.08, 0.10, 0.18, 1.0);

  // Size canvas to match display
  resize3D();

  console.log(`WebGL3D initialized (WebGL${isWebGL2 ? '2' : '1'})`);
  return true;
}

export function render3D() {
  if (!gl || !program || indexCount === 0) return;

  // Throttled buildings mesh rebuild (~500ms)
  const now = performance.now();
  if (now - lastBuildingRebuild > 500) {
    buildBuildingsMesh();
  }

  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.useProgram(program);

  // View-projection matrix
  const vp = buildViewProjection();
  gl.uniformMatrix4fv(uViewProjLoc, false, vp);

  // Directional light: from upper-left-front (normalized)
  const lx = 0.6, ly = 0.8, lz = -0.2;
  const len = Math.sqrt(lx*lx + ly*ly + lz*lz);
  gl.uniform3f(uLightDirLoc, lx/len, ly/len, lz/len);

  // Time uniform for water animation
  if (uTimeLoc) gl.uniform1f(uTimeLoc, performance.now() * 0.001);

  // ── Draw terrain (includes trees) ──────────────────────────
  if (isWebGL2) {
    gl.bindVertexArray(vao);
  } else if (oeVao) {
    oeVao.bindVertexArrayOES(vao);
  } else {
    // No VAO support: re-bind attributes manually
    const STRIDE = 9 * 4;
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuf);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuf);
    const aPosLoc    = gl.getAttribLocation(program, 'aPos');
    const aNormalLoc = gl.getAttribLocation(program, 'aNormal');
    const aColorLoc  = gl.getAttribLocation(program, 'aColor');
    gl.enableVertexAttribArray(aPosLoc);
    gl.vertexAttribPointer(aPosLoc,    3, gl.FLOAT, false, STRIDE, 0);
    gl.enableVertexAttribArray(aNormalLoc);
    gl.vertexAttribPointer(aNormalLoc, 3, gl.FLOAT, false, STRIDE, 3*4);
    gl.enableVertexAttribArray(aColorLoc);
    gl.vertexAttribPointer(aColorLoc,  3, gl.FLOAT, false, STRIDE, 6*4);
  }

  gl.drawElements(gl.TRIANGLES, terrainIndexCount, gl.UNSIGNED_INT, 0);

  if (isWebGL2) {
    gl.bindVertexArray(null);
  } else if (oeVao) {
    oeVao.bindVertexArrayOES(null);
  }

  // ── Draw trees — after terrain, depth ALWAYS so they appear above their tiles ──
  if (treeIndexCount > 0) {
    if (isWebGL2) {
      gl.bindVertexArray(vao);
    } else if (oeVao) {
      oeVao.bindVertexArrayOES(vao);
    } else {
      const STRIDE = 9 * 4;
      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuf);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuf);
      const aPosLoc2    = gl.getAttribLocation(program, 'aPos');
      const aNormalLoc2 = gl.getAttribLocation(program, 'aNormal');
      const aColorLoc2  = gl.getAttribLocation(program, 'aColor');
      gl.enableVertexAttribArray(aPosLoc2);
      gl.vertexAttribPointer(aPosLoc2,    3, gl.FLOAT, false, STRIDE, 0);
      gl.enableVertexAttribArray(aNormalLoc2);
      gl.vertexAttribPointer(aNormalLoc2, 3, gl.FLOAT, false, STRIDE, 3*4);
      gl.enableVertexAttribArray(aColorLoc2);
      gl.vertexAttribPointer(aColorLoc2,  3, gl.FLOAT, false, STRIDE, 6*4);
    }
    gl.depthFunc(gl.ALWAYS);
    gl.drawElements(gl.TRIANGLES, treeIndexCount, gl.UNSIGNED_INT, terrainIndexCount * 4);
    gl.depthFunc(gl.LEQUAL);
    if (isWebGL2) {
      gl.bindVertexArray(null);
    } else if (oeVao) {
      oeVao.bindVertexArrayOES(null);
    }
  }

  // ── Draw buildings ──────────────────────────────────────────
  if (buildingsIndexCount > 0) {
    if (isWebGL2) {
      gl.bindVertexArray(buildingsVao);
    } else if (oeVao) {
      oeVao.bindVertexArrayOES(buildingsVao);
    } else {
      const STRIDE = 9 * 4;
      gl.bindBuffer(gl.ARRAY_BUFFER, buildingsVertexBuf);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buildingsIndexBuf);
      const aPosLoc    = gl.getAttribLocation(program, 'aPos');
      const aNormalLoc = gl.getAttribLocation(program, 'aNormal');
      const aColorLoc  = gl.getAttribLocation(program, 'aColor');
      gl.enableVertexAttribArray(aPosLoc);
      gl.vertexAttribPointer(aPosLoc,    3, gl.FLOAT, false, STRIDE, 0);
      gl.enableVertexAttribArray(aNormalLoc);
      gl.vertexAttribPointer(aNormalLoc, 3, gl.FLOAT, false, STRIDE, 3*4);
      gl.enableVertexAttribArray(aColorLoc);
      gl.vertexAttribPointer(aColorLoc,  3, gl.FLOAT, false, STRIDE, 6*4);
    }

    gl.depthFunc(gl.ALWAYS);
    gl.drawElements(gl.TRIANGLES, buildingsIndexCount, gl.UNSIGNED_INT, 0);
    gl.depthFunc(gl.LEQUAL);

    if (isWebGL2) {
      gl.bindVertexArray(null);
    } else if (oeVao) {
      oeVao.bindVertexArrayOES(null);
    }
  }
}

export function resize3D() {
  if (!gl) return;
  const canvas = gl.canvas;
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width  = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width  = w + 'px';
  canvas.style.height = h + 'px';
}
