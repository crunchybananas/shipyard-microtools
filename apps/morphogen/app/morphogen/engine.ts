// ═══════════════════════════════════════════════════════════════════
// MorphogenEngine — Real-time Turing Pattern Synthesis (Gray-Scott)
//
// Reaction-diffusion system originally described by Alan Turing in
// "The Chemical Basis of Morphogenesis" (1952), which explained how
// living organisms develop spots, stripes, and labyrinthine patterns
// from two interacting chemical species.
//
// ∂A/∂t = Da∇²A − AB² + F(1−A)       feed activator precursor
// ∂B/∂t = Db∇²B + AB² − (F+k)B       autocatalytic activator
//
// Pipeline per frame:
//   1. Process pending paint splats
//   2. Run N simulation steps (ping-pong framebuffers)
//   3. Render display pass with colour mapping
// ═══════════════════════════════════════════════════════════════════

// ── Preset definitions ───────────────────────────────────────────

export interface RDPreset {
  name: string;
  emoji: string;
  F: number;
  k: number;
  desc: string;
}

export const PRESETS: RDPreset[] = [
  { name: "Fingerprint", emoji: "🔍", F: 0.037, k: 0.060, desc: "Labyrinthine ridges" },
  { name: "Leopard",     emoji: "🐆", F: 0.025, k: 0.056, desc: "Scattered spots" },
  { name: "Coral",       emoji: "🪸", F: 0.054, k: 0.063, desc: "Branching coral" },
  { name: "Mitosis",     emoji: "🔬", F: 0.028, k: 0.053, desc: "Dividing cells" },
  { name: "Worms",       emoji: "🪱", F: 0.039, k: 0.058, desc: "Writhing worms" },
  { name: "Spirals",     emoji: "🌀", F: 0.018, k: 0.051, desc: "Rotating spirals" },
];

// ── Palette definitions ──────────────────────────────────────────

export interface RDPalette {
  name: string;
  glsl: string; // body of vec3 mapColor(float b) function
}

export const PALETTES: RDPalette[] = [
  {
    name: "Ocean",
    glsl: `
      vec3 dark   = vec3(0.02, 0.04, 0.12);
      vec3 mid    = vec3(0.00, 0.38, 0.82);
      vec3 bright = vec3(0.55, 0.98, 1.00);
      float t = clamp(b * 1.4, 0.0, 1.0);
      if (t < 0.5) return mix(dark, mid, t * 2.0);
      return mix(mid, bright, (t - 0.5) * 2.0);
    `,
  },
  {
    name: "Magma",
    glsl: `
      vec3 black  = vec3(0.03, 0.02, 0.04);
      vec3 red    = vec3(0.50, 0.05, 0.02);
      vec3 orange = vec3(1.00, 0.35, 0.00);
      vec3 yellow = vec3(1.00, 0.95, 0.65);
      float t = clamp(b * 1.4, 0.0, 1.0);
      if (t < 0.33) return mix(black, red, t * 3.03);
      if (t < 0.66) return mix(red, orange, (t - 0.33) * 3.03);
      return mix(orange, yellow, (t - 0.66) * 3.03);
    `,
  },
  {
    name: "Verdant",
    glsl: `
      vec3 soil   = vec3(0.04, 0.08, 0.02);
      vec3 mid    = vec3(0.08, 0.48, 0.08);
      vec3 bright = vec3(0.40, 1.00, 0.18);
      float t = clamp(b * 1.4, 0.0, 1.0);
      if (t < 0.5) return mix(soil, mid, t * 2.0);
      return mix(mid, bright, (t - 0.5) * 2.0);
    `,
  },
  {
    name: "Void",
    glsl: `
      vec3 dark   = vec3(0.03, 0.01, 0.07);
      vec3 violet = vec3(0.42, 0.04, 0.92);
      vec3 white  = vec3(0.90, 0.75, 1.00);
      float t = clamp(b * 1.4, 0.0, 1.0);
      if (t < 0.5) return mix(dark, violet, t * 2.0);
      return mix(violet, white, (t - 0.5) * 2.0);
    `,
  },
];

// ── Shader sources ───────────────────────────────────────────────

const VERT = `
  attribute vec2 aPos;
  varying vec2 vUv;
  void main() {
    vUv = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
  }
`;

// Gray-Scott reaction-diffusion update
const SIM_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTex;
  uniform vec2 uTexel;
  uniform float uF;
  uniform float uK;

  void main() {
    vec4 c  = texture2D(uTex, vUv);
    vec4 l  = texture2D(uTex, vUv - vec2(uTexel.x, 0.0));
    vec4 r  = texture2D(uTex, vUv + vec2(uTexel.x, 0.0));
    vec4 t  = texture2D(uTex, vUv + vec2(0.0, uTexel.y));
    vec4 b  = texture2D(uTex, vUv - vec2(0.0, uTexel.y));

    float a  = c.r;
    float bn = c.g;

    float lapA = (l.r + r.r + t.r + b.r) - 4.0 * a;
    float lapB = (l.g + r.g + t.g + b.g) - 4.0 * bn;

    float react = a * bn * bn;
    float Da = 0.2097;
    float Db = 0.1050;

    float newA = clamp(a  + Da * lapA - react + uF * (1.0 - a),  0.0, 1.0);
    float newB = clamp(bn + Db * lapB + react - (uF + uK) * bn,  0.0, 1.0);

    gl_FragColor = vec4(newA, newB, 0.0, 1.0);
  }
`;

// Paint B chemical at a point
const SPLAT_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTex;
  uniform vec2  uPoint;
  uniform float uRadius;
  uniform float uAspect;
  uniform float uStrength;

  void main() {
    vec4 cur = texture2D(uTex, vUv);
    vec2 d   = vUv - uPoint;
    d.x     *= uAspect;
    float s  = smoothstep(uRadius, 0.0, length(d)) * uStrength;
    float newB = min(cur.g + s, 1.0);
    float newA = max(cur.r - s * 0.6, 0.0);
    gl_FragColor = vec4(newA, newB, 0.0, 1.0);
  }
`;

// Display pass: map B concentration to colour palette
const buildDisplayFrag = (paletteGlsl: string) => `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTex;

  vec3 mapColor(float b) {
    ${paletteGlsl}
  }

  void main() {
    float b = texture2D(uTex, vUv).g;
    gl_FragColor = vec4(mapColor(b), 1.0);
  }
`;

// ── WebGL helpers ────────────────────────────────────────────────

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`Shader compile error: ${gl.getShaderInfoLog(shader)}`);
  }
  return shader;
}

function buildProgram(gl: WebGLRenderingContext, vertSrc: string, fragSrc: string): WebGLProgram {
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compileShader(gl, gl.VERTEX_SHADER, vertSrc));
  gl.attachShader(prog, compileShader(gl, gl.FRAGMENT_SHADER, fragSrc));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`Program link error: ${gl.getProgramInfoLog(prog)}`);
  }
  return prog;
}

function makeFBO(gl: WebGLRenderingContext, size: number): { fbo: WebGLFramebuffer; tex: WebGLTexture } {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fbo, tex };
}

// ── Main engine class ────────────────────────────────────────────

interface Splat {
  x: number;
  y: number;
  radius: number;
  strength: number;
}

export class MorphogenEngine {
  private gl: WebGLRenderingContext;
  private size = 512;
  private rafId = 0;

  // Ping-pong buffers
  private ping: { fbo: WebGLFramebuffer; tex: WebGLTexture };
  private pong: { fbo: WebGLFramebuffer; tex: WebGLTexture };

  // Programs
  private simProg!: WebGLProgram;
  private displayProg!: WebGLProgram;
  private splatProg!: WebGLProgram;

  // Quad geometry
  private quadBuf: WebGLBuffer;

  // State
  private preset: RDPreset = PRESETS[0]!;
  private palette: RDPalette = PALETTES[0]!;
  private pendingSplats: Splat[] = [];
  private stepsPerFrame = 30;
  private brushRadius = 0.04;

  constructor(private canvas: HTMLCanvasElement) {
    const ext1 = { powerPreference: "high-performance" } as WebGLContextAttributes;
    const gl = canvas.getContext("webgl", ext1) as WebGLRenderingContext | null;
    if (!gl) throw new Error("WebGL not supported");

    // Float texture extension required for high precision
    const floatExt = gl.getExtension("OES_texture_float");
    if (!floatExt) throw new Error("OES_texture_float not supported");
    gl.getExtension("OES_texture_float_linear");

    this.gl = gl;

    // Full-screen quad [-1,1]²
    this.quadBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

    this.ping = makeFBO(gl, this.size);
    this.pong = makeFBO(gl, this.size);

    this.buildPrograms();
    this.seedInitial();

    window.addEventListener("resize", this.onResize);
    this.onResize();
  }

  // ── Public API ─────────────────────────────────────────────────

  start() {
    const loop = () => {
      this.step();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  destroy() {
    cancelAnimationFrame(this.rafId);
    window.removeEventListener("resize", this.onResize);
  }

  setPreset(preset: RDPreset) {
    this.preset = preset;
  }

  setPalette(palette: RDPalette) {
    this.palette = palette;
    this.rebuildDisplayProgram();
  }

  setBrushRadius(r: number) {
    this.brushRadius = r;
  }

  addSplat(nx: number, ny: number) {
    this.pendingSplats.push({ x: nx, y: ny, radius: this.brushRadius, strength: 1.0 });
  }

  resetSimulation() {
    this.seedInitial();
  }

  clearCanvas() {
    const { gl, size } = this;
    const data = new Float32Array(size * size * 4);
    for (let i = 0; i < size * size; i++) {
      data[i * 4 + 0] = 1.0; // A = 1
      data[i * 4 + 1] = 0.0; // B = 0
    }
    this.uploadData(data);
  }

  // ── Internal ───────────────────────────────────────────────────

  private buildPrograms() {
    const { gl } = this;
    this.simProg = buildProgram(gl, VERT, SIM_FRAG);
    this.splatProg = buildProgram(gl, VERT, SPLAT_FRAG);
    this.rebuildDisplayProgram();
  }

  private rebuildDisplayProgram() {
    const { gl } = this;
    if (this.displayProg) gl.deleteProgram(this.displayProg);
    this.displayProg = buildProgram(gl, VERT, buildDisplayFrag(this.palette.glsl));
  }

  private uploadData(data: Float32Array) {
    const { gl, size } = this;
    [this.ping, this.pong].forEach(({ tex }) => {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.FLOAT, data);
    });
  }

  private seedInitial() {
    const { size } = this;
    const data = new Float32Array(size * size * 4);

    // Low-density noise across entire field — patterns form from chaos faster than from sparse dots
    for (let i = 0; i < size * size; i++) {
      const noise = Math.random() < 0.08 ? Math.random() * 0.9 : 0.0;
      data[i * 4 + 0] = 1.0 - noise * 0.5;
      data[i * 4 + 1] = noise;
    }

    // Also add a few dense seed patches to anchor initial structure
    const rng = (min: number, max: number) => min + Math.random() * (max - min);
    for (let i = 0; i < 20; i++) {
      const cx = Math.floor(rng(10, size - 10));
      const cy = Math.floor(rng(10, size - 10));
      const r = Math.floor(rng(3, 8));
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > r * r) continue;
          const px = (cx + dx + size) % size;
          const py = (cy + dy + size) % size;
          const idx = (py * size + px) * 4;
          data[idx + 0] = 0.0;
          data[idx + 1] = 1.0;
        }
      }
    }

    this.uploadData(data);
  }

  private bindQuad(prog: WebGLProgram) {
    const { gl } = this;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    const loc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  }

  private drawQuad() {
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }

  private setTex(prog: WebGLProgram, name: string, unit: number, tex: WebGLTexture) {
    const { gl } = this;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(gl.getUniformLocation(prog, name), unit);
  }

  private step() {
    const { gl, size } = this;
    const texelSize = 1.0 / size;

    // 1. Process splats
    for (const splat of this.pendingSplats) {
      const prog = this.splatProg;
      gl.useProgram(prog);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.pong.fbo);
      gl.viewport(0, 0, size, size);
      this.bindQuad(prog);
      this.setTex(prog, "uTex", 0, this.ping.tex);
      gl.uniform2f(gl.getUniformLocation(prog, "uPoint"), splat.x, splat.y);
      gl.uniform1f(gl.getUniformLocation(prog, "uRadius"), splat.radius);
      gl.uniform1f(gl.getUniformLocation(prog, "uAspect"), 1.0);
      gl.uniform1f(gl.getUniformLocation(prog, "uStrength"), splat.strength);
      this.drawQuad();
      [this.ping, this.pong] = [this.pong, this.ping];
    }
    this.pendingSplats = [];

    // 2. Simulation steps
    const prog = this.simProg;
    gl.useProgram(prog);
    gl.uniform2f(gl.getUniformLocation(prog, "uTexel"), texelSize, texelSize);
    gl.uniform1f(gl.getUniformLocation(prog, "uF"), this.preset.F);
    gl.uniform1f(gl.getUniformLocation(prog, "uK"), this.preset.k);
    this.bindQuad(prog);

    for (let s = 0; s < this.stepsPerFrame; s++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.pong.fbo);
      gl.viewport(0, 0, size, size);
      this.setTex(prog, "uTex", 0, this.ping.tex);
      this.drawQuad();
      [this.ping, this.pong] = [this.pong, this.ping];
    }

    // 3. Display pass
    const disp = this.displayProg;
    gl.useProgram(disp);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.bindQuad(disp);
    this.setTex(disp, "uTex", 0, this.ping.tex);
    this.drawQuad();
  }

  private onResize = () => {
    this.canvas.width = this.canvas.clientWidth * devicePixelRatio;
    this.canvas.height = this.canvas.clientHeight * devicePixelRatio;
  };
}
