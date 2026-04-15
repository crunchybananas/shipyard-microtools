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
let isWebGL2 = false;

// Uniform locations
let uViewProjLoc = null;
let uLightDirLoc = null;

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
  [TILE.GRASS]:    [0.30, 0.66, 0.33],
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
out vec3 vNormal;
out vec3 vColor;
out vec3 vWorldPos;
void main() {
  gl_Position = uViewProj * vec4(aPos, 1.0);
  vNormal = aNormal;
  vColor = aColor;
  vWorldPos = aPos;
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
  vec3 ambient = vColor * 0.35;
  vec3 diffuse = vColor * NdotL * 0.8;
  fragColor = vec4(ambient + diffuse, 1.0);
}`;

// WebGL1 fallback shaders
const VS_SRC_100 = `
attribute vec3 aPos;
attribute vec3 aNormal;
attribute vec3 aColor;
uniform mat4 uViewProj;
varying vec3 vNormal;
varying vec3 vColor;
varying vec3 vWorldPos;
void main() {
  gl_Position = uViewProj * vec4(aPos, 1.0);
  vNormal = aNormal;
  vColor = aColor;
  vWorldPos = aPos;
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
  vec3 ambient = vColor * 0.35;
  vec3 diffuse = vColor * NdotL * 0.8;
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

export function buildTerrainMesh() {
  if (!gl) return;

  const verts = [];   // will become Float32Array
  const indices = []; // will become Uint32Array

  for (let row = 0; row < MAP_H; row++) {
    for (let col = 0; col < MAP_W; col++) {
      const tileType = (G.map[row] && G.map[row][col] !== undefined) ? G.map[row][col] : TILE.GRASS;
      const h = TILE_HEIGHT[tileType] !== undefined ? TILE_HEIGHT[tileType] : 0.5;
      const color = TILE_COLOR_3D[tileType] || [0.5, 0.5, 0.5];

      const x0 = col;
      const x1 = col + 1;
      const z0 = row;
      const z1 = row + 1;
      const y  = h;    // top face at height h
      const yb = 0.0;  // bottom (sea level)

      // Top face (normal up: 0,1,0)
      pushFace(verts, indices,
        [ [x0,y,z0], [x1,y,z0], [x1,y,z1], [x0,y,z1] ],
        [0, 1, 0],
        color
      );

      // Only draw side faces if tile is elevated
      if (h > 0.0) {
        // Slightly darker sides to distinguish faces under flat lighting
        const sideColor = [color[0]*0.75, color[1]*0.75, color[2]*0.75];

        // Front face  (+Z, normal 0,0,1)
        pushFace(verts, indices,
          [ [x0,yb,z1], [x1,yb,z1], [x1,y,z1], [x0,y,z1] ],
          [0, 0, 1],
          sideColor
        );
        // Back face   (-Z, normal 0,0,-1)
        pushFace(verts, indices,
          [ [x1,yb,z0], [x0,yb,z0], [x0,y,z0], [x1,y,z0] ],
          [0, 0, -1],
          sideColor
        );
        // Right face  (+X, normal 1,0,0)
        pushFace(verts, indices,
          [ [x1,yb,z1], [x1,yb,z0], [x1,y,z0], [x1,y,z1] ],
          [1, 0, 0],
          sideColor
        );
        // Left face   (-X, normal -1,0,0)
        pushFace(verts, indices,
          [ [x0,yb,z0], [x0,yb,z1], [x0,y,z1], [x0,y,z0] ],
          [-1, 0, 0],
          sideColor
        );
      }
    }
  }

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

// ── Camera / VP matrix ─────────────────────────────────────
function buildViewProjection() {
  const zoom = (G.camera && G.camera.zoom) ? G.camera.zoom : 1.3;
  const orthoSize = 40 / zoom;

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

  // Create VAO
  if (isWebGL2) {
    vao = gl.createVertexArray();
  } else if (oeVao) {
    vao = oeVao.createVertexArrayOES();
  }

  // Create GPU buffers
  vertexBuf = gl.createBuffer();
  indexBuf  = gl.createBuffer();

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

  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.useProgram(program);

  // View-projection matrix
  const vp = buildViewProjection();
  gl.uniformMatrix4fv(uViewProjLoc, false, vp);

  // Directional light: from upper-left-front (normalized)
  // In world space: light comes from (+X, +Y, -Z) direction → points toward origin
  const lx = 0.6, ly = 0.8, lz = -0.2;
  const len = Math.sqrt(lx*lx + ly*ly + lz*lz);
  gl.uniform3f(uLightDirLoc, lx/len, ly/len, lz/len);

  // Bind VAO and draw
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

  gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_INT, 0);

  if (isWebGL2) {
    gl.bindVertexArray(null);
  } else if (oeVao) {
    oeVao.bindVertexArrayOES(null);
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
