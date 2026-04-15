// ════════════════════════════════════════════════════════════
// Realm 3D — standalone WebGL2 prototype
// Clean slate: procedural terrain, procedural meshes, proper lighting
// ════════════════════════════════════════════════════════════

// ── Config ─────────────────────────────────────────────────
const MAP_SIZE = 40;  // 40x40 grid for now (smaller than game, faster iteration)

const TILE = { WATER:0, SAND:1, GRASS:2, FOREST:3, STONE:4, MOUNTAIN:5 };

const TILE_COLOR = {
  [TILE.WATER]:    [0.12, 0.38, 0.72],
  [TILE.SAND]:     [0.92, 0.82, 0.55],
  [TILE.GRASS]:    [0.36, 0.68, 0.35],
  [TILE.FOREST]:   [0.22, 0.52, 0.24],
  [TILE.STONE]:    [0.60, 0.58, 0.55],
  [TILE.MOUNTAIN]: [0.48, 0.45, 0.48],
};

const TILE_HEIGHT = {
  [TILE.WATER]:    0.0,
  [TILE.SAND]:     0.3,
  [TILE.GRASS]:    0.8,
  [TILE.FOREST]:   0.8,
  [TILE.STONE]:    1.4,
  [TILE.MOUNTAIN]: 3.0,
};

// ── Procedural world generation ────────────────────────────
function hash2(x, y) {
  let n = x * 374761393 + y * 668265263;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) & 0x7fffffff) / 0x7fffffff;
}

function noise2(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return a + (b - a) * sx + (c - a + (a - b - c + d) * sx) * sy;
}

function fbm(x, y, octaves) {
  let v = 0, a = 1, f = 1, t = 0;
  for (let i = 0; i < octaves; i++) {
    v += noise2(x * f, y * f) * a;
    t += a;
    a *= 0.5;
    f *= 2;
  }
  return v / t;
}

function generateMap() {
  const map = [];
  const cx = MAP_SIZE / 2, cy = MAP_SIZE / 2;
  for (let y = 0; y < MAP_SIZE; y++) {
    map[y] = [];
    for (let x = 0; x < MAP_SIZE; x++) {
      const dx = (x - cx) / cx, dy = (y - cy) / cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const n = fbm(x * 0.15, y * 0.15, 3);
      const h = n - dist * 1.0;
      if (h < 0.05) map[y][x] = TILE.WATER;
      else if (h < 0.12) map[y][x] = TILE.SAND;
      else if (h < 0.32) map[y][x] = TILE.GRASS;
      else if (h < 0.45) map[y][x] = Math.random() < 0.6 ? TILE.FOREST : TILE.GRASS;
      else if (h < 0.55) map[y][x] = TILE.STONE;
      else map[y][x] = TILE.MOUNTAIN;
    }
  }
  return map;
}

// Place a few buildings on the CENTER grass tile area
function placeSampleBuildings(map) {
  const buildings = [];
  const cx = Math.floor(MAP_SIZE / 2), cy = Math.floor(MAP_SIZE / 2);
  // Force center tiles to grass and place buildings there
  const positions = [
    ['castle', 0, 0],
    ['house', -2, -1],
    ['house', 2, -1],
    ['house', -2, 2],
    ['tower', 4, 0],
    ['church', -4, 0],
    ['barn', 0, 3],
  ];
  for (const [type, dx, dy] of positions) {
    const x = cx + dx, y = cy + dy;
    if (x >= 0 && x < MAP_SIZE && y >= 0 && y < MAP_SIZE) {
      map[y][x] = TILE.GRASS; // ensure grass
      buildings.push({ type, x, y });
    }
  }
  return buildings;
}

// ── Matrix math (column-major 4x4) ─────────────────────────
function mat4Identity() {
  return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
}
function mat4Multiply(a, b) {
  const r = new Float32Array(16);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k];
      r[i * 4 + j] = s;
    }
  }
  return r;
}
function mat4Ortho(l, r, b, t, n, f) {
  const m = new Float32Array(16);
  m[0] = 2 / (r - l);
  m[5] = 2 / (t - b);
  m[10] = -2 / (f - n);
  m[12] = -(r + l) / (r - l);
  m[13] = -(t + b) / (t - b);
  m[14] = -(f + n) / (f - n);
  m[15] = 1;
  return m;
}
function mat4RotateX(rad) {
  const c = Math.cos(rad), s = Math.sin(rad);
  const m = mat4Identity();
  m[5] = c;  m[6] = s;
  m[9] = -s; m[10] = c;
  return m;
}
function mat4RotateY(rad) {
  const c = Math.cos(rad), s = Math.sin(rad);
  const m = mat4Identity();
  m[0] = c;  m[2] = -s;
  m[8] = s;  m[10] = c;
  return m;
}
function mat4Translate(x, y, z) {
  const m = mat4Identity();
  m[12] = x; m[13] = y; m[14] = z;
  return m;
}

// ── Mesh builder ───────────────────────────────────────────
// Vertex layout: [x, y, z, nx, ny, nz, r, g, b] = 9 floats
class Mesh {
  constructor() {
    this.verts = [];
    this.indices = [];
  }
  pushVertex(x, y, z, nx, ny, nz, r, g, b) {
    this.verts.push(x, y, z, nx, ny, nz, r, g, b);
  }
  pushQuad(p0, p1, p2, p3, n, c) {
    const base = this.verts.length / 9;
    for (const p of [p0, p1, p2, p3]) {
      this.pushVertex(p[0], p[1], p[2], n[0], n[1], n[2], c[0], c[1], c[2]);
    }
    this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  pushTri(p0, p1, p2, n, c) {
    const base = this.verts.length / 9;
    for (const p of [p0, p1, p2]) {
      this.pushVertex(p[0], p[1], p[2], n[0], n[1], n[2], c[0], c[1], c[2]);
    }
    this.indices.push(base, base + 1, base + 2);
  }
  pushBox(x0, y0, z0, x1, y1, z1, c, darkenSides = true) {
    const dark = darkenSides ? [c[0] * 0.75, c[1] * 0.75, c[2] * 0.75] : c;
    // Top (+Y)
    this.pushQuad([x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1], [0,1,0], c);
    // Bottom (-Y) — skip for most geometry (saves verts)
    // Front (+Z)
    this.pushQuad([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1], [0,0,1], dark);
    // Back (-Z)
    this.pushQuad([x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0], [0,0,-1], dark);
    // Right (+X)
    this.pushQuad([x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1], [1,0,0], dark);
    // Left (-X)
    this.pushQuad([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0], [-1,0,0], dark);
  }
  pushPyramid(cx, cz, baseY, topY, halfW, c) {
    const darkSide = [c[0] * 0.75, c[1] * 0.75, c[2] * 0.75];
    const apex = [cx, topY, cz];
    const p = [
      [cx - halfW, baseY, cz + halfW],
      [cx + halfW, baseY, cz + halfW],
      [cx + halfW, baseY, cz - halfW],
      [cx - halfW, baseY, cz - halfW],
    ];
    this.pushTri(p[0], p[1], apex, [0, 0.4, 1], c);
    this.pushTri(p[1], p[2], apex, [1, 0.4, 0], darkSide);
    this.pushTri(p[2], p[3], apex, [0, 0.4, -1], c);
    this.pushTri(p[3], p[0], apex, [-1, 0.4, 0], darkSide);
  }
}

// ── Build terrain mesh ─────────────────────────────────────
function buildTerrainMesh(map) {
  const mesh = new Mesh();
  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      const t = map[y][x];
      const baseH = TILE_HEIGHT[t];
      const baseColor = TILE_COLOR[t];
      // Per-tile noise for organic variation
      const nh = (hash2(x * 37, y * 41) - 0.5) * 0.08;
      const nc = (hash2(x * 73, y * 31) - 0.5) * 0.15;
      const h = t === TILE.WATER ? 0 : baseH + nh;
      const color = [
        Math.max(0, Math.min(1, baseColor[0] * (1 + nc))),
        Math.max(0, Math.min(1, baseColor[1] * (1 + nc))),
        Math.max(0, Math.min(1, baseColor[2] * (1 + nc))),
      ];
      const x0 = x, x1 = x + 1, z0 = y, z1 = y + 1;
      // Top face
      mesh.pushQuad([x0, h, z0], [x1, h, z0], [x1, h, z1], [x0, h, z1], [0, 1, 0], color);
      // Water doesn't need side faces
      if (t === TILE.WATER) continue;
      // Side faces
      const yb = -0.5;
      const dark = [color[0] * 0.7, color[1] * 0.7, color[2] * 0.7];
      mesh.pushQuad([x0, yb, z1], [x1, yb, z1], [x1, h, z1], [x0, h, z1], [0, 0, 1], dark);
      mesh.pushQuad([x1, yb, z0], [x0, yb, z0], [x0, h, z0], [x1, h, z0], [0, 0, -1], dark);
      mesh.pushQuad([x1, yb, z1], [x1, yb, z0], [x1, h, z0], [x1, h, z1], [1, 0, 0], dark);
      mesh.pushQuad([x0, yb, z0], [x0, yb, z1], [x0, h, z1], [x0, h, z0], [-1, 0, 0], dark);
    }
  }
  return mesh;
}

// ── Build decorations (trees) ──────────────────────────────
function buildDecorMesh(map) {
  const mesh = new Mesh();
  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      if (map[y][x] !== TILE.FOREST) continue;
      const nh = (hash2(x * 37, y * 41) - 0.5) * 0.08;
      const groundY = TILE_HEIGHT[TILE.FOREST] + nh;
      // Tree trunk
      const cx = x + 0.5, cz = y + 0.5;
      const trunkColor = [0.38, 0.24, 0.12];
      const trunkH = 0.6;
      const trunkW = 0.09;
      mesh.pushBox(cx - trunkW, groundY, cz - trunkW,
                   cx + trunkW, groundY + trunkH, cz + trunkW,
                   trunkColor);
      // Tree canopy (multi-level pyramid for that cartoon pine look)
      const canopyColor = [0.20, 0.54, 0.24];
      mesh.pushPyramid(cx, cz, groundY + trunkH - 0.05, groundY + trunkH + 1.2, 0.55, canopyColor);
      mesh.pushPyramid(cx, cz, groundY + trunkH + 0.4, groundY + trunkH + 1.7, 0.40, canopyColor);
      mesh.pushPyramid(cx, cz, groundY + trunkH + 0.9, groundY + trunkH + 2.0, 0.25, canopyColor);
    }
  }
  return mesh;
}

// ── Build buildings mesh ───────────────────────────────────
function buildBuildingsMesh(buildings, map) {
  const mesh = new Mesh();
  for (const b of buildings) {
    const tileType = map[b.y][b.x];
    const nh = (hash2(b.x * 37, b.y * 41) - 0.5) * 0.08;
    const gy = TILE_HEIGHT[tileType] + nh + 0.02;
    const cx = b.x + 0.5, cz = b.y + 0.5;

    // Record vertex count so we can scale this building's verts after
    const vertStart = mesh.verts.length;
    const S = 2.5;  // building scale multiplier — makes them stand out

    if (b.type === 'castle') {
      // Big central keep
      const stone = [0.72, 0.70, 0.68];
      const stoneDark = [0.55, 0.53, 0.52];
      // Main keep
      mesh.pushBox(cx - 0.7, gy, cz - 0.7, cx + 0.7, gy + 2.2, cz + 0.7, stone);
      // Corner towers
      for (const [dx, dz] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) {
        mesh.pushBox(cx + dx - 0.25, gy, cz + dz - 0.25,
                     cx + dx + 0.25, gy + 2.8, cz + dz + 0.25,
                     stoneDark);
        // Tower cap cone
        mesh.pushPyramid(cx + dx, cz + dz, gy + 2.8, gy + 3.3, 0.30, [0.65, 0.25, 0.20]);
      }
      // Central keep roof
      mesh.pushPyramid(cx, cz, gy + 2.2, gy + 3.0, 0.80, [0.65, 0.25, 0.20]);
    }
    else if (b.type === 'house') {
      // Base walls
      const wallColor = [0.88, 0.78, 0.58];
      mesh.pushBox(cx - 0.4, gy, cz - 0.4, cx + 0.4, gy + 0.7, cz + 0.4, wallColor);
      // Pyramid roof
      mesh.pushPyramid(cx, cz, gy + 0.7, gy + 1.3, 0.45, [0.75, 0.30, 0.22]);
      // Door
      mesh.pushBox(cx - 0.08, gy, cz + 0.38, cx + 0.08, gy + 0.4, cz + 0.42, [0.30, 0.18, 0.10]);
      // Chimney
      mesh.pushBox(cx + 0.2, gy + 1.0, cz - 0.05, cx + 0.3, gy + 1.45, cz + 0.05, [0.45, 0.40, 0.40]);
    }
    else if (b.type === 'tower') {
      const stone = [0.60, 0.58, 0.58];
      // Tall tower body
      mesh.pushBox(cx - 0.28, gy, cz - 0.28, cx + 0.28, gy + 1.8, cz + 0.28, stone);
      // Wider parapet on top
      mesh.pushBox(cx - 0.35, gy + 1.8, cz - 0.35, cx + 0.35, gy + 2.0, cz + 0.35, [0.50, 0.48, 0.48]);
      // Cone roof
      mesh.pushPyramid(cx, cz, gy + 2.0, gy + 2.6, 0.35, [0.65, 0.25, 0.20]);
    }
    else if (b.type === 'barn') {
      const barnColor = [0.65, 0.30, 0.20];
      mesh.pushBox(cx - 0.5, gy, cz - 0.35, cx + 0.5, gy + 0.55, cz + 0.35, barnColor);
      // Triangular prism roof — use two tris + 2 end tris
      const roofH = 0.5;
      const roofTopY = gy + 0.55 + roofH;
      const roofColor = [0.30, 0.20, 0.12];
      // Two long roof slopes
      mesh.pushQuad(
        [cx - 0.5, gy + 0.55, cz + 0.35],
        [cx + 0.5, gy + 0.55, cz + 0.35],
        [cx + 0.5, roofTopY, cz],
        [cx - 0.5, roofTopY, cz],
        [0, 0.6, 0.8], roofColor);
      mesh.pushQuad(
        [cx + 0.5, gy + 0.55, cz - 0.35],
        [cx - 0.5, gy + 0.55, cz - 0.35],
        [cx - 0.5, roofTopY, cz],
        [cx + 0.5, roofTopY, cz],
        [0, 0.6, -0.8], roofColor);
      // Two end triangles
      mesh.pushTri(
        [cx - 0.5, gy + 0.55, cz - 0.35],
        [cx - 0.5, gy + 0.55, cz + 0.35],
        [cx - 0.5, roofTopY, cz],
        [-1, 0, 0], [0.55, 0.25, 0.18]);
      mesh.pushTri(
        [cx + 0.5, gy + 0.55, cz + 0.35],
        [cx + 0.5, gy + 0.55, cz - 0.35],
        [cx + 0.5, roofTopY, cz],
        [1, 0, 0], [0.55, 0.25, 0.18]);
    }
    else if (b.type === 'church') {
      const stone = [0.88, 0.85, 0.78];
      // Nave
      mesh.pushBox(cx - 0.5, gy, cz - 0.3, cx + 0.5, gy + 0.9, cz + 0.3, stone);
      // Nave pitched roof
      mesh.pushQuad(
        [cx - 0.5, gy + 0.9, cz + 0.3],
        [cx + 0.5, gy + 0.9, cz + 0.3],
        [cx + 0.5, gy + 1.4, cz],
        [cx - 0.5, gy + 1.4, cz],
        [0, 0.7, 0.7], [0.45, 0.25, 0.18]);
      mesh.pushQuad(
        [cx + 0.5, gy + 0.9, cz - 0.3],
        [cx - 0.5, gy + 0.9, cz - 0.3],
        [cx - 0.5, gy + 1.4, cz],
        [cx + 0.5, gy + 1.4, cz],
        [0, 0.7, -0.7], [0.45, 0.25, 0.18]);
      mesh.pushTri([cx - 0.5, gy + 0.9, cz - 0.3], [cx - 0.5, gy + 0.9, cz + 0.3], [cx - 0.5, gy + 1.4, cz], [-1, 0, 0], stone);
      mesh.pushTri([cx + 0.5, gy + 0.9, cz + 0.3], [cx + 0.5, gy + 0.9, cz - 0.3], [cx + 0.5, gy + 1.4, cz], [1, 0, 0], stone);
      // Steeple on one end
      mesh.pushBox(cx + 0.35, gy, cz - 0.15, cx + 0.55, gy + 1.8, cz + 0.15, stone);
      mesh.pushPyramid(cx + 0.45, cz, gy + 1.8, gy + 2.4, 0.18, [0.45, 0.25, 0.18]);
      // Cross on steeple
      mesh.pushBox(cx + 0.44, gy + 2.4, cz - 0.02, cx + 0.46, gy + 2.65, cz + 0.02, [0.85, 0.72, 0.30]);
      mesh.pushBox(cx + 0.43, gy + 2.52, cz - 0.08, cx + 0.47, gy + 2.56, cz + 0.08, [0.85, 0.72, 0.30]);
    }

    // Scale this building's vertices around (cx, gy, cz)
    // Vertex layout is 9 floats per vertex — only scale position (indices 0, 1, 2)
    for (let i = vertStart; i < mesh.verts.length; i += 9) {
      mesh.verts[i]     = cx + (mesh.verts[i]     - cx) * S;
      mesh.verts[i + 1] = gy + (mesh.verts[i + 1] - gy) * S;
      mesh.verts[i + 2] = cz + (mesh.verts[i + 2] - cz) * S;
    }
  }
  return mesh;
}

// ── Shaders ────────────────────────────────────────────────
const VS_SOURCE = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec3 aColor;
uniform mat4 uViewProj;
uniform float uTime;
uniform int uAnimateWater;
out vec3 vNormal;
out vec3 vColor;
out vec3 vWorldPos;
void main() {
  vec3 pos = aPos;
  // Water animation: low-elevation blue-dominant vertices get wave displacement
  bool isWater = aColor.b > 0.5 && aColor.r < 0.25 && aPos.y < 0.1;
  if (uAnimateWater == 1 && isWater) {
    float wave = sin(aPos.x * 0.7 + uTime * 1.3) * 0.05
               + cos(aPos.z * 0.8 + uTime * 1.0) * 0.04;
    pos.y += wave;
  }
  vWorldPos = pos;
  vNormal = aNormal;
  vColor = aColor;
  gl_Position = uViewProj * vec4(pos, 1.0);
}`;

const FS_SOURCE = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vColor;
in vec3 vWorldPos;
uniform vec3 uLightDir;  // points TOWARD the light source
uniform vec3 uLightColor;
uniform vec3 uAmbient;
uniform vec3 uSkyColor;
out vec4 fragColor;
void main() {
  vec3 N = normalize(vNormal);
  float NdotL = max(0.0, dot(N, uLightDir));
  // Hemisphere ambient: more from above (sky) than below
  float hemi = N.y * 0.5 + 0.5;
  vec3 ambient = mix(uAmbient, uSkyColor * 0.4, hemi);
  vec3 color = vColor * (ambient + uLightColor * NdotL);
  // Soft distance fog toward sky color for depth
  float d = length(vWorldPos.xz - vec2(20.0, 20.0));
  float fog = smoothstep(15.0, 30.0, d) * 0.25;
  color = mix(color, uSkyColor, fog);
  fragColor = vec4(color, 1.0);
}`;

// ── GL setup ───────────────────────────────────────────────
const canvas = document.getElementById('gl');
const gl = canvas.getContext('webgl2', { antialias: true, depth: true });
if (!gl) {
  document.body.innerHTML = '<div style="padding:40px;color:#f88">WebGL2 not supported by this browser.</div>';
  throw new Error('No WebGL2');
}

function compileShader(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    console.error('Shader compile error:', log, '\n', src);
    throw new Error('Shader compile failed');
  }
  return s;
}

const vs = compileShader(gl.VERTEX_SHADER, VS_SOURCE);
const fs = compileShader(gl.FRAGMENT_SHADER, FS_SOURCE);
const prog = gl.createProgram();
gl.attachShader(prog, vs);
gl.attachShader(prog, fs);
gl.linkProgram(prog);
if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
  console.error('Program link error:', gl.getProgramInfoLog(prog));
  throw new Error('Program link failed');
}

const uViewProj = gl.getUniformLocation(prog, 'uViewProj');
const uTime = gl.getUniformLocation(prog, 'uTime');
const uLightDir = gl.getUniformLocation(prog, 'uLightDir');
const uLightColor = gl.getUniformLocation(prog, 'uLightColor');
const uAmbient = gl.getUniformLocation(prog, 'uAmbient');
const uSkyColor = gl.getUniformLocation(prog, 'uSkyColor');
const uAnimateWater = gl.getUniformLocation(prog, 'uAnimateWater');

gl.enable(gl.DEPTH_TEST);
// Disable backface culling to rule out winding-order issues
// gl.enable(gl.CULL_FACE);
// gl.cullFace(gl.BACK);

// ── Upload mesh to GPU ─────────────────────────────────────
function uploadMesh(mesh) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vbuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.verts), gl.STATIC_DRAW);
  const ibuf = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuf);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(mesh.indices), gl.STATIC_DRAW);
  const STRIDE = 9 * 4;
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, STRIDE, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, STRIDE, 3 * 4);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 3, gl.FLOAT, false, STRIDE, 6 * 4);
  gl.bindVertexArray(null);
  return { vao, indexCount: mesh.indices.length };
}

// ── World state ────────────────────────────────────────────
const map = generateMap();
const buildings = placeSampleBuildings(map);
const terrainMesh = buildTerrainMesh(map);
// DEBUG: add hot pink pillar directly to terrain mesh
terrainMesh.pushBox(19.5, 0, 19.5, 20.5, 8, 20.5, [1, 0, 1]);
console.log('Pink pillar added to terrain mesh');
const decorMesh = buildDecorMesh(map);
const buildingsMesh = buildBuildingsMesh(buildings, map);

console.log(`Terrain: ${terrainMesh.verts.length / 9} verts, ${terrainMesh.indices.length} tris`);
console.log(`Decor: ${decorMesh.verts.length / 9} verts`);
console.log(`Buildings: ${buildingsMesh.verts.length / 9} verts (${buildings.length} buildings)`);

const terrainGpu = uploadMesh(terrainMesh);
const decorGpu = uploadMesh(decorMesh);
const buildingsGpu = uploadMesh(buildingsMesh);

// Debug: 4 tall pink pillars at known coords to verify rendering pipeline
const debugMesh = new Mesh();
debugMesh.pushBox(19.5, 0, 19.5, 20.5, 6, 20.5, [1, 0.2, 0.8]);  // center
debugMesh.pushBox(14.5, 0, 14.5, 15.5, 6, 15.5, [1, 1, 0]);  // yellow NW
debugMesh.pushBox(24.5, 0, 24.5, 25.5, 6, 25.5, [0, 1, 1]);  // cyan SE
console.log(`Debug mesh: ${debugMesh.verts.length / 9} verts`);
const debugGpu = uploadMesh(debugMesh);

// ── Camera state ───────────────────────────────────────────
const camera = {
  target: [MAP_SIZE / 2, 0, MAP_SIZE / 2],
  yaw: -Math.PI / 4,  // 45° rotation (classic iso)
  pitch: -Math.atan(1 / Math.sqrt(2)),  // ~35.264° (true isometric)
  orthoSize: 20,
};

// ── Resize ─────────────────────────────────────────────────
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth, h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener('resize', resize);
resize();

// ── Input ──────────────────────────────────────────────────
let dragging = false, lastX = 0, lastY = 0;
canvas.addEventListener('mousedown', e => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
window.addEventListener('mouseup', () => { dragging = false; });
canvas.addEventListener('mousemove', e => {
  if (!dragging) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  // Pan camera target based on mouse drag
  // Account for camera rotation so drag feels natural
  const cosYaw = Math.cos(camera.yaw);
  const sinYaw = Math.sin(camera.yaw);
  const panScale = camera.orthoSize * 0.003;
  camera.target[0] -= (dx * cosYaw + dy * sinYaw) * panScale;
  camera.target[2] -= (dy * cosYaw - dx * sinYaw) * panScale;
  lastX = e.clientX;
  lastY = e.clientY;
});
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const factor = e.deltaY > 0 ? 1.1 : 0.9;
  camera.orthoSize = Math.max(5, Math.min(60, camera.orthoSize * factor));
}, { passive: false });
window.addEventListener('keydown', e => {
  if (e.key === 'q' || e.key === 'Q') camera.yaw -= 0.08;
  if (e.key === 'e' || e.key === 'E') camera.yaw += 0.08;
});

// ── Build VP matrix ────────────────────────────────────────
function buildViewProjection() {
  const aspect = canvas.width / canvas.height;
  const hw = camera.orthoSize * aspect;
  const hh = camera.orthoSize;
  const ortho = mat4Ortho(-hw, hw, -hh, hh, -200, 200);
  const rx = mat4RotateX(camera.pitch);
  const ry = mat4RotateY(camera.yaw);
  const tr = mat4Translate(-camera.target[0], -camera.target[1], -camera.target[2]);
  // vp = ortho * rx * ry * tr
  return mat4Multiply(ortho, mat4Multiply(rx, mat4Multiply(ry, tr)));
}

// ── Render loop ────────────────────────────────────────────
let lastFrame = performance.now();
let fpsFrames = 0, fpsLast = performance.now();
const fpsEl = document.getElementById('fps');

function frame(now) {
  const dt = now - lastFrame;
  lastFrame = now;
  fpsFrames++;
  if (now - fpsLast > 500) {
    fpsEl.textContent = `${Math.round(fpsFrames * 1000 / (now - fpsLast))} fps`;
    fpsFrames = 0;
    fpsLast = now;
  }

  // Sky color — varies with time of day? For now, clear sky blue
  const skyR = 0.55, skyG = 0.72, skyB = 0.90;
  gl.clearColor(skyR, skyG, skyB, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.useProgram(prog);
  const vp = buildViewProjection();
  gl.uniformMatrix4fv(uViewProj, false, vp);
  gl.uniform1f(uTime, now * 0.001);
  // Directional sun from upper-left
  const sun = [0.45, 0.85, 0.30];
  const len = Math.sqrt(sun[0]*sun[0] + sun[1]*sun[1] + sun[2]*sun[2]);
  gl.uniform3f(uLightDir, sun[0]/len, sun[1]/len, sun[2]/len);
  gl.uniform3f(uLightColor, 1.0, 0.95, 0.85);  // warm sun
  gl.uniform3f(uAmbient, 0.28, 0.30, 0.35);
  gl.uniform3f(uSkyColor, skyR, skyG, skyB);

  // Draw terrain (with water animation)
  gl.uniform1i(uAnimateWater, 1);
  gl.bindVertexArray(terrainGpu.vao);
  gl.drawElements(gl.TRIANGLES, terrainGpu.indexCount, gl.UNSIGNED_INT, 0);

  // Draw decor (trees) — no water anim
  gl.uniform1i(uAnimateWater, 0);
  gl.bindVertexArray(decorGpu.vao);
  gl.drawElements(gl.TRIANGLES, decorGpu.indexCount, gl.UNSIGNED_INT, 0);

  // Draw buildings
  gl.bindVertexArray(buildingsGpu.vao);
  gl.drawElements(gl.TRIANGLES, buildingsGpu.indexCount, gl.UNSIGNED_INT, 0);

  // Draw debug marker
  gl.bindVertexArray(debugGpu.vao);
  gl.drawElements(gl.TRIANGLES, debugGpu.indexCount, gl.UNSIGNED_INT, 0);

  gl.bindVertexArray(null);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
