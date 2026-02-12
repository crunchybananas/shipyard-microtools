// ═══════════════════════════════════════════════════════════════════
// AetherEngine — Real-time GPU Fluid Dynamics (Navier-Stokes)
//
// Pipeline per frame:
//   1. Splat (inject velocity + dye at pointer)
//   2. Curl → Vorticity confinement (amplify small eddies)
//   3. Advection of velocity field
//   4. Divergence of velocity
//   5. Pressure solve (Jacobi iteration, ~20 passes)
//   6. Gradient subtraction → divergence-free velocity
//   7. Advection of dye field
//   8. Display
// ═══════════════════════════════════════════════════════════════════

// ── Shader sources ───────────────────────────────────────────────

const BASE_VERT = `
  attribute vec2 aPosition;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform vec2 texelSize;
  void main() {
    vUv = aPosition * 0.5 + 0.5;
    vL = vUv - vec2(texelSize.x, 0.0);
    vR = vUv + vec2(texelSize.x, 0.0);
    vT = vUv + vec2(0.0, texelSize.y);
    vB = vUv - vec2(0.0, texelSize.y);
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;

const SPLAT_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTarget;
  uniform float aspectRatio;
  uniform vec3 color;
  uniform vec2 point;
  uniform float radius;
  void main() {
    vec2 p = vUv - point;
    p.x *= aspectRatio;
    vec3 splat = exp(-dot(p, p) / radius) * color;
    vec3 base = texture2D(uTarget, vUv).xyz;
    gl_FragColor = vec4(base + splat, 1.0);
  }
`;

const ADVECTION_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uVelocity;
  uniform sampler2D uSource;
  uniform vec2 texelSize;
  uniform float dt;
  uniform float dissipation;
  void main() {
    vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
    vec4 result = texture2D(uSource, coord);
    float decay = 1.0 + dissipation * dt;
    gl_FragColor = result / decay;
  }
`;

const DIVERGENCE_FRAG = `
  precision mediump float;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform sampler2D uVelocity;
  void main() {
    float L = texture2D(uVelocity, vL).x;
    float R = texture2D(uVelocity, vR).x;
    float T = texture2D(uVelocity, vT).y;
    float B = texture2D(uVelocity, vB).y;
    float div = 0.5 * (R - L + T - B);
    gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
  }
`;

const CURL_FRAG = `
  precision mediump float;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform sampler2D uVelocity;
  void main() {
    float L = texture2D(uVelocity, vL).y;
    float R = texture2D(uVelocity, vR).y;
    float T = texture2D(uVelocity, vT).x;
    float B = texture2D(uVelocity, vB).x;
    float vorticity = R - L - T + B;
    gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
  }
`;

const VORTICITY_FRAG = `
  precision highp float;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform sampler2D uVelocity;
  uniform sampler2D uCurl;
  uniform float curl;
  uniform float dt;
  void main() {
    float L = texture2D(uCurl, vL).x;
    float R = texture2D(uCurl, vR).x;
    float T = texture2D(uCurl, vT).x;
    float B = texture2D(uCurl, vB).x;
    float C = texture2D(uCurl, vUv).x;
    vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
    force /= length(force) + 0.0001;
    force *= curl * C;
    force.y *= -1.0;
    vec2 velocity = texture2D(uVelocity, vUv).xy;
    velocity += force * dt;
    gl_FragColor = vec4(velocity, 0.0, 1.0);
  }
`;

const PRESSURE_FRAG = `
  precision mediump float;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform sampler2D uPressure;
  uniform sampler2D uDivergence;
  void main() {
    float L = texture2D(uPressure, vL).x;
    float R = texture2D(uPressure, vR).x;
    float T = texture2D(uPressure, vT).x;
    float B = texture2D(uPressure, vB).x;
    float divergence = texture2D(uDivergence, vUv).x;
    float pressure = (L + R + B + T - divergence) * 0.25;
    gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
  }
`;

const GRADIENT_SUB_FRAG = `
  precision mediump float;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform sampler2D uPressure;
  uniform sampler2D uVelocity;
  void main() {
    float L = texture2D(uPressure, vL).x;
    float R = texture2D(uPressure, vR).x;
    float T = texture2D(uPressure, vT).x;
    float B = texture2D(uPressure, vB).x;
    vec2 velocity = texture2D(uVelocity, vUv).xy;
    velocity.xy -= vec2(R - L, T - B);
    gl_FragColor = vec4(velocity, 0.0, 1.0);
  }
`;

const CLEAR_FRAG = `
  precision mediump float;
  varying vec2 vUv;
  uniform sampler2D uTexture;
  uniform float value;
  void main() {
    gl_FragColor = value * texture2D(uTexture, vUv);
  }
`;

const DISPLAY_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTexture;
  void main() {
    vec3 c = texture2D(uTexture, vUv).rgb;
    c = pow(c, vec3(0.85));
    gl_FragColor = vec4(c, 1.0);
  }
`;

// ── Internal types ────────────────────────────────────────────

interface Program {
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation>;
  bind: () => void;
}

interface FBO {
  texture: WebGLTexture;
  fbo: WebGLFramebuffer;
  width: number;
  height: number;
  attach: (unit: number) => number;
}

interface DoubleFBO {
  width: number;
  height: number;
  texelSizeX: number;
  texelSizeY: number;
  read: FBO;
  write: FBO;
  swap: () => void;
}

interface Pointer {
  id: number;
  texcoordX: number;
  texcoordY: number;
  prevTexcoordX: number;
  prevTexcoordY: number;
  deltaX: number;
  deltaY: number;
  down: boolean;
  moved: boolean;
  color: [number, number, number];
}

// ── Engine ────────────────────────────────────────────────────

export class AetherEngine {
  private canvas: HTMLCanvasElement;
  private gl!: WebGLRenderingContext;
  private isWebGL2 = false;
  private HALF_FLOAT!: number;
  private RGBA_INTERNAL!: number;
  private supportLinear = false;

  // Simulation resolution
  private SIM_W = 256;
  private SIM_H = 256;
  private DYE_W = 1024;
  private DYE_H = 1024;

  // Config — mutated by component via setters
  private curl = 30;
  private splatRadius = 0.25;
  private splatForce = 6000;
  private pressureIterations = 20;
  private velocityDissipation = 0.1;
  private dyeDissipation = 0.3;
  private paused = false;

  // Programs
  private splatProgram!: Program;
  private advectionProgram!: Program;
  private divergenceProgram!: Program;
  private curlProgram!: Program;
  private vorticityProgram!: Program;
  private pressureProgram!: Program;
  private gradientProgram!: Program;
  private clearProgram!: Program;
  private displayProgram!: Program;

  // Quad buffers
  private quadBuf!: WebGLBuffer;
  private indexBuf!: WebGLBuffer;

  // FBOs
  private velocity!: DoubleFBO;
  private dye!: DoubleFBO;
  private curlFBO!: FBO;
  private divergenceFBO!: FBO;
  private pressureFBO!: DoubleFBO;
  private texFilter!: number;

  // Pointers
  private pointers: Pointer[] = [];

  // Animation
  private animId = 0;
  private lastTime = 0;
  private autoSplatTimer = 0;
  private colorHue = Math.random();

  // Bound listeners (for cleanup)
  private onResize: () => void;
  private onMouseDown: (e: MouseEvent) => void;
  private onMouseMove: (e: MouseEvent) => void;
  private onMouseUp: () => void;
  private onTouchStart: (e: TouchEvent) => void;
  private onTouchMove: (e: TouchEvent) => void;
  private onTouchEnd: (e: TouchEvent) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    // Bind listeners
    this.onResize = () => this.resize();
    this.onMouseDown = (e) => this.handleMouseDown(e);
    this.onMouseMove = (e) => this.handleMouseMove(e);
    this.onMouseUp = () => this.handleMouseUp();
    this.onTouchStart = (e) => this.handleTouchStart(e);
    this.onTouchMove = (e) => this.handleTouchMove(e);
    this.onTouchEnd = (e) => this.handleTouchEnd(e);

    this.initWebGL();
    this.initPointers();
  }

  // ── Public API (called by component) ────────────────────────

  setCurl(v: number) { this.curl = v; }
  setSplatRadius(v: number) { this.splatRadius = v / 100; }
  setVelocityDissipation(v: number) { this.velocityDissipation = v; }
  setDyeDissipation(v: number) { this.dyeDissipation = v; }
  setPressureIterations(v: number) { this.pressureIterations = v; }

  reset() { this.initFBOs(); }

  randomBurst() {
    for (let i = 0; i < 8; i++) {
      const x = Math.random();
      const y = Math.random();
      const angle = Math.random() * Math.PI * 2;
      const dx = Math.cos(angle) * 0.003;
      const dy = Math.sin(angle) * 0.003;
      this.splat(x, y, dx, dy, this.generateColor());
    }
  }

  exportImage() {
    this.render();
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = this.canvas.width;
    exportCanvas.height = this.canvas.height;
    const ectx = exportCanvas.getContext("2d")!;
    ectx.drawImage(this.canvas, 0, 0);
    const link = document.createElement("a");
    link.download = `aether-${Date.now()}.png`;
    link.href = exportCanvas.toDataURL("image/png");
    link.click();
  }

  start() {
    this.resize();
    window.addEventListener("resize", this.onResize);

    this.canvas.addEventListener("mousedown", this.onMouseDown);
    this.canvas.addEventListener("mousemove", this.onMouseMove);
    this.canvas.addEventListener("mouseup", this.onMouseUp);
    this.canvas.addEventListener("touchstart", this.onTouchStart, { passive: false });
    this.canvas.addEventListener("touchmove", this.onTouchMove, { passive: false });
    this.canvas.addEventListener("touchend", this.onTouchEnd);

    // Initial burst
    setTimeout(() => {
      for (let i = 0; i < 5; i++) {
        const x = 0.2 + Math.random() * 0.6;
        const y = 0.2 + Math.random() * 0.6;
        const angle = Math.random() * Math.PI * 2;
        const dx = Math.cos(angle) * 0.001;
        const dy = Math.sin(angle) * 0.001;
        this.splat(x, y, dx, dy, this.generateColor());
      }
    }, 100);

    this.lastTime = performance.now();
    this.animId = requestAnimationFrame(() => this.loop());
  }

  destroy() {
    cancelAnimationFrame(this.animId);
    window.removeEventListener("resize", this.onResize);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    this.canvas.removeEventListener("mousemove", this.onMouseMove);
    this.canvas.removeEventListener("mouseup", this.onMouseUp);
    this.canvas.removeEventListener("touchstart", this.onTouchStart);
    this.canvas.removeEventListener("touchmove", this.onTouchMove);
    this.canvas.removeEventListener("touchend", this.onTouchEnd);
  }

  // ── WebGL bootstrap ─────────────────────────────────────────

  private initWebGL() {
    const params = { alpha: false, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false };
    const gl = (this.canvas.getContext("webgl2", params) || this.canvas.getContext("webgl", params)) as WebGLRenderingContext | null;
    if (!gl) throw new Error("WebGL not supported");
    this.gl = gl;

    this.isWebGL2 = gl instanceof WebGL2RenderingContext;

    const halfFloat = gl.getExtension("OES_texture_half_float");
    const halfFloatLinear = gl.getExtension("OES_texture_half_float_linear");
    gl.getExtension("OES_texture_float");
    gl.getExtension("OES_texture_float_linear");
    if (this.isWebGL2) {
      gl.getExtension("EXT_color_buffer_float");
      gl.getExtension("EXT_color_buffer_half_float");
    }

    this.HALF_FLOAT = this.isWebGL2
      ? (gl as WebGL2RenderingContext).HALF_FLOAT
      : (halfFloat ? halfFloat.HALF_FLOAT_OES : gl.FLOAT);
    this.RGBA_INTERNAL = this.isWebGL2
      ? (gl as WebGL2RenderingContext).RGBA16F
      : gl.RGBA;
    this.supportLinear = !!(this.isWebGL2 || halfFloatLinear);
    this.texFilter = this.supportLinear ? gl.LINEAR : gl.NEAREST;

    // Compile programs
    this.splatProgram = this.createProgram(BASE_VERT, SPLAT_FRAG, ["uTarget", "aspectRatio", "color", "point", "radius", "texelSize"]);
    this.advectionProgram = this.createProgram(BASE_VERT, ADVECTION_FRAG, ["uVelocity", "uSource", "texelSize", "dt", "dissipation"]);
    this.divergenceProgram = this.createProgram(BASE_VERT, DIVERGENCE_FRAG, ["uVelocity", "texelSize"]);
    this.curlProgram = this.createProgram(BASE_VERT, CURL_FRAG, ["uVelocity", "texelSize"]);
    this.vorticityProgram = this.createProgram(BASE_VERT, VORTICITY_FRAG, ["uVelocity", "uCurl", "curl", "dt", "texelSize"]);
    this.pressureProgram = this.createProgram(BASE_VERT, PRESSURE_FRAG, ["uPressure", "uDivergence", "texelSize"]);
    this.gradientProgram = this.createProgram(BASE_VERT, GRADIENT_SUB_FRAG, ["uPressure", "uVelocity", "texelSize"]);
    this.clearProgram = this.createProgram(BASE_VERT, CLEAR_FRAG, ["uTexture", "value", "texelSize"]);
    this.displayProgram = this.createProgram(BASE_VERT, DISPLAY_FRAG, ["uTexture", "texelSize"]);

    // Full-screen quad
    this.quadBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
    this.indexBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
  }

  // ── Compile helpers ─────────────────────────────────────────

  private compileShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("Shader compile error:", gl.getShaderInfoLog(shader));
    }
    return shader;
  }

  private createProgram(vertSrc: string, fragSrc: string, uniformNames: string[]): Program {
    const gl = this.gl;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, this.compileShader(gl.VERTEX_SHADER, vertSrc));
    gl.attachShader(prog, this.compileShader(gl.FRAGMENT_SHADER, fragSrc));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(prog));
    }
    const uniforms: Record<string, WebGLUniformLocation> = {};
    for (const name of uniformNames) {
      uniforms[name] = gl.getUniformLocation(prog, name)!;
    }
    return {
      program: prog,
      uniforms,
      bind() { gl.useProgram(prog); },
    };
  }

  // ── FBOs ────────────────────────────────────────────────────

  private createFBO(w: number, h: number, internalFormat: number, format: number, type: number, texFilter: number): FBO {
    const gl = this.gl;
    const texture = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, texFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, texFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);

    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT);

    return {
      texture,
      fbo,
      width: w,
      height: h,
      attach(unit: number) {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        return unit;
      },
    };
  }

  private createDoubleFBO(w: number, h: number, internalFormat: number, format: number, type: number, texFilter: number): DoubleFBO {
    const gl = this.gl;
    let fbo1 = this.createFBO(w, h, internalFormat, format, type, texFilter);
    let fbo2 = this.createFBO(w, h, internalFormat, format, type, texFilter);
    return {
      width: w,
      height: h,
      texelSizeX: 1.0 / w,
      texelSizeY: 1.0 / h,
      get read() { return fbo1; },
      set read(v) { fbo1 = v; },
      get write() { return fbo2; },
      set write(v) { fbo2 = v; },
      swap() { const t = fbo1; fbo1 = fbo2; fbo2 = t; },
    };
  }

  private initFBOs() {
    const gl = this.gl;
    this.velocity = this.createDoubleFBO(this.SIM_W, this.SIM_H, this.RGBA_INTERNAL, gl.RGBA, this.HALF_FLOAT, this.texFilter);
    this.dye = this.createDoubleFBO(this.DYE_W, this.DYE_H, this.RGBA_INTERNAL, gl.RGBA, this.HALF_FLOAT, this.texFilter);
    this.curlFBO = this.createFBO(this.SIM_W, this.SIM_H, this.RGBA_INTERNAL, gl.RGBA, this.HALF_FLOAT, gl.NEAREST);
    this.divergenceFBO = this.createFBO(this.SIM_W, this.SIM_H, this.RGBA_INTERNAL, gl.RGBA, this.HALF_FLOAT, gl.NEAREST);
    this.pressureFBO = this.createDoubleFBO(this.SIM_W, this.SIM_H, this.RGBA_INTERNAL, gl.RGBA, this.HALF_FLOAT, this.texFilter);
  }

  // ── Rendering helpers ───────────────────────────────────────

  private blit(target: WebGLFramebuffer | null) {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, target);
    this.gl.drawElements(this.gl.TRIANGLES, 6, this.gl.UNSIGNED_SHORT, 0);
  }

  private bindVertexAttribs(prog: Program) {
    const gl = this.gl;
    const loc = gl.getAttribLocation(prog.program, "aPosition");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuf);
  }

  // ── Resize ──────────────────────────────────────────────────

  private resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (this.canvas.width !== w * dpr || this.canvas.height !== h * dpr) {
      this.canvas.width = w * dpr;
      this.canvas.height = h * dpr;
    }

    const aspect = w / h;
    this.SIM_W = Math.round(256 * (aspect >= 1 ? aspect : 1));
    this.SIM_H = Math.round(256 * (aspect < 1 ? 1 / aspect : 1));
    this.DYE_W = Math.round(1024 * (aspect >= 1 ? aspect : 1));
    this.DYE_H = Math.round(1024 * (aspect < 1 ? 1 / aspect : 1));

    this.initFBOs();
  }

  // ── Colors ──────────────────────────────────────────────────

  private hsvToRgb(h: number, s: number, v: number): [number, number, number] {
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    switch (i % 6) {
      case 0: return [v, t, p];
      case 1: return [q, v, p];
      case 2: return [p, v, t];
      case 3: return [p, q, v];
      case 4: return [t, p, v];
      default: return [v, p, q];
    }
  }

  private generateColor(): [number, number, number] {
    this.colorHue += 0.618033988749895;
    this.colorHue %= 1;
    const [r, g, b] = this.hsvToRgb(this.colorHue, 0.8, 1.0);
    return [r * 0.5, g * 0.5, b * 0.5];
  }

  // ── Pointer tracking ────────────────────────────────────────

  private initPointers() {
    this.pointers = [{
      id: -1,
      texcoordX: 0, texcoordY: 0,
      prevTexcoordX: 0, prevTexcoordY: 0,
      deltaX: 0, deltaY: 0,
      down: false, moved: false,
      color: this.generateColor(),
    }];
  }

  private updatePointerDownData(pointer: Pointer, id: number, x: number, y: number) {
    pointer.id = id;
    pointer.down = true;
    pointer.moved = false;
    pointer.texcoordX = x / this.canvas.clientWidth;
    pointer.texcoordY = 1.0 - y / this.canvas.clientHeight;
    pointer.prevTexcoordX = pointer.texcoordX;
    pointer.prevTexcoordY = pointer.texcoordY;
    pointer.deltaX = 0;
    pointer.deltaY = 0;
    pointer.color = this.generateColor();
  }

  private updatePointerMoveData(pointer: Pointer, x: number, y: number) {
    pointer.prevTexcoordX = pointer.texcoordX;
    pointer.prevTexcoordY = pointer.texcoordY;
    pointer.texcoordX = x / this.canvas.clientWidth;
    pointer.texcoordY = 1.0 - y / this.canvas.clientHeight;
    pointer.deltaX = this.correctDeltaX(pointer.texcoordX - pointer.prevTexcoordX);
    pointer.deltaY = this.correctDeltaY(pointer.texcoordY - pointer.prevTexcoordY);
    pointer.moved = Math.abs(pointer.deltaX) > 0 || Math.abs(pointer.deltaY) > 0;
  }

  private correctDeltaX(delta: number) {
    const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
    return aspect < 1 ? delta * aspect : delta;
  }

  private correctDeltaY(delta: number) {
    const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
    return aspect > 1 ? delta / aspect : delta;
  }

  // ── Mouse/touch handlers ────────────────────────────────────

  private handleMouseDown(e: MouseEvent) {
    this.updatePointerDownData(this.pointers[0]!, e.offsetX, e.offsetY);
  }

  private handleMouseMove(e: MouseEvent) {
    this.updatePointerMoveData(this.pointers[0]!, e.offsetX, e.offsetY);
    this.pointers[0]!.down = e.buttons > 0;
  }

  private handleMouseUp() {
    this.pointers[0]!.down = false;
  }

  private handleTouchStart(e: TouchEvent) {
    e.preventDefault();
    for (let i = 0; i < e.targetTouches.length; i++) {
      const t = e.targetTouches[i]!;
      const rect = this.canvas.getBoundingClientRect();
      if (i >= this.pointers.length) {
        this.pointers.push({
          id: -1, texcoordX: 0, texcoordY: 0,
          prevTexcoordX: 0, prevTexcoordY: 0,
          deltaX: 0, deltaY: 0,
          down: false, moved: false,
          color: this.generateColor(),
        });
      }
      this.updatePointerDownData(this.pointers[i]!, t.identifier, t.clientX - rect.left, t.clientY - rect.top);
    }
  }

  private handleTouchMove(e: TouchEvent) {
    e.preventDefault();
    for (let i = 0; i < e.targetTouches.length; i++) {
      const t = e.targetTouches[i]!;
      const rect = this.canvas.getBoundingClientRect();
      const p = this.pointers.find(pp => pp.id === t.identifier);
      if (p) this.updatePointerMoveData(p, t.clientX - rect.left, t.clientY - rect.top);
    }
  }

  private handleTouchEnd(e: TouchEvent) {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i]!;
      const p = this.pointers.find(pp => pp.id === t.identifier);
      if (p) p.down = false;
    }
  }

  // ── Simulation ──────────────────────────────────────────────

  private splat(x: number, y: number, dx: number, dy: number, color: [number, number, number]) {
    const gl = this.gl;
    const aspect = this.canvas.clientWidth / this.canvas.clientHeight;

    // Velocity splat
    this.splatProgram.bind();
    this.bindVertexAttribs(this.splatProgram);
    gl.uniform1i(this.splatProgram.uniforms["uTarget"]!, this.velocity.read.attach(0));
    gl.uniform1f(this.splatProgram.uniforms["aspectRatio"]!, aspect);
    gl.uniform2f(this.splatProgram.uniforms["point"]!, x, y);
    gl.uniform3f(this.splatProgram.uniforms["color"]!, dx * this.splatForce, dy * this.splatForce, 0.0);
    gl.uniform1f(this.splatProgram.uniforms["radius"]!, this.correctRadius(this.splatRadius));
    gl.uniform2f(this.splatProgram.uniforms["texelSize"]!, this.velocity.texelSizeX, this.velocity.texelSizeY);
    gl.viewport(0, 0, this.velocity.width, this.velocity.height);
    this.blit(this.velocity.write.fbo);
    this.velocity.swap();

    // Dye splat
    gl.uniform1i(this.splatProgram.uniforms["uTarget"]!, this.dye.read.attach(0));
    gl.uniform3f(this.splatProgram.uniforms["color"]!, color[0], color[1], color[2]);
    gl.uniform2f(this.splatProgram.uniforms["texelSize"]!, this.dye.texelSizeX, this.dye.texelSizeY);
    gl.viewport(0, 0, this.dye.width, this.dye.height);
    this.blit(this.dye.write.fbo);
    this.dye.swap();
  }

  private correctRadius(r: number) {
    const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
    return aspect > 1 ? r * aspect : r;
  }

  private step(dt: number) {
    const gl = this.gl;
    gl.disable(gl.BLEND);

    // Curl
    this.curlProgram.bind();
    this.bindVertexAttribs(this.curlProgram);
    gl.uniform2f(this.curlProgram.uniforms["texelSize"]!, this.velocity.texelSizeX, this.velocity.texelSizeY);
    gl.uniform1i(this.curlProgram.uniforms["uVelocity"]!, this.velocity.read.attach(0));
    gl.viewport(0, 0, this.curlFBO.width, this.curlFBO.height);
    this.blit(this.curlFBO.fbo);

    // Vorticity confinement
    this.vorticityProgram.bind();
    this.bindVertexAttribs(this.vorticityProgram);
    gl.uniform2f(this.vorticityProgram.uniforms["texelSize"]!, this.velocity.texelSizeX, this.velocity.texelSizeY);
    gl.uniform1i(this.vorticityProgram.uniforms["uVelocity"]!, this.velocity.read.attach(0));
    gl.uniform1i(this.vorticityProgram.uniforms["uCurl"]!, this.curlFBO.attach(1));
    gl.uniform1f(this.vorticityProgram.uniforms["curl"]!, this.curl);
    gl.uniform1f(this.vorticityProgram.uniforms["dt"]!, dt);
    gl.viewport(0, 0, this.velocity.width, this.velocity.height);
    this.blit(this.velocity.write.fbo);
    this.velocity.swap();

    // Advect velocity
    this.advectionProgram.bind();
    this.bindVertexAttribs(this.advectionProgram);
    gl.uniform2f(this.advectionProgram.uniforms["texelSize"]!, this.velocity.texelSizeX, this.velocity.texelSizeY);
    gl.uniform1i(this.advectionProgram.uniforms["uVelocity"]!, this.velocity.read.attach(0));
    gl.uniform1i(this.advectionProgram.uniforms["uSource"]!, this.velocity.read.attach(0));
    gl.uniform1f(this.advectionProgram.uniforms["dt"]!, dt);
    gl.uniform1f(this.advectionProgram.uniforms["dissipation"]!, this.velocityDissipation);
    gl.viewport(0, 0, this.velocity.width, this.velocity.height);
    this.blit(this.velocity.write.fbo);
    this.velocity.swap();

    // Advect dye
    gl.uniform2f(this.advectionProgram.uniforms["texelSize"]!, this.dye.texelSizeX, this.dye.texelSizeY);
    gl.uniform1i(this.advectionProgram.uniforms["uVelocity"]!, this.velocity.read.attach(0));
    gl.uniform1i(this.advectionProgram.uniforms["uSource"]!, this.dye.read.attach(1));
    gl.uniform1f(this.advectionProgram.uniforms["dissipation"]!, this.dyeDissipation);
    gl.viewport(0, 0, this.dye.width, this.dye.height);
    this.blit(this.dye.write.fbo);
    this.dye.swap();

    // Divergence
    this.divergenceProgram.bind();
    this.bindVertexAttribs(this.divergenceProgram);
    gl.uniform2f(this.divergenceProgram.uniforms["texelSize"]!, this.velocity.texelSizeX, this.velocity.texelSizeY);
    gl.uniform1i(this.divergenceProgram.uniforms["uVelocity"]!, this.velocity.read.attach(0));
    gl.viewport(0, 0, this.SIM_W, this.SIM_H);
    this.blit(this.divergenceFBO.fbo);

    // Clear pressure
    this.clearProgram.bind();
    this.bindVertexAttribs(this.clearProgram);
    gl.uniform1i(this.clearProgram.uniforms["uTexture"]!, this.pressureFBO.read.attach(0));
    gl.uniform1f(this.clearProgram.uniforms["value"]!, 0.8);
    gl.uniform2f(this.clearProgram.uniforms["texelSize"]!, this.pressureFBO.texelSizeX, this.pressureFBO.texelSizeY);
    gl.viewport(0, 0, this.pressureFBO.width, this.pressureFBO.height);
    this.blit(this.pressureFBO.write.fbo);
    this.pressureFBO.swap();

    // Pressure solve (Jacobi iteration)
    this.pressureProgram.bind();
    this.bindVertexAttribs(this.pressureProgram);
    gl.uniform2f(this.pressureProgram.uniforms["texelSize"]!, this.velocity.texelSizeX, this.velocity.texelSizeY);
    gl.uniform1i(this.pressureProgram.uniforms["uDivergence"]!, this.divergenceFBO.attach(0));
    for (let i = 0; i < this.pressureIterations; i++) {
      gl.uniform1i(this.pressureProgram.uniforms["uPressure"]!, this.pressureFBO.read.attach(1));
      gl.viewport(0, 0, this.pressureFBO.width, this.pressureFBO.height);
      this.blit(this.pressureFBO.write.fbo);
      this.pressureFBO.swap();
    }

    // Gradient subtraction → divergence-free
    this.gradientProgram.bind();
    this.bindVertexAttribs(this.gradientProgram);
    gl.uniform2f(this.gradientProgram.uniforms["texelSize"]!, this.velocity.texelSizeX, this.velocity.texelSizeY);
    gl.uniform1i(this.gradientProgram.uniforms["uPressure"]!, this.pressureFBO.read.attach(0));
    gl.uniform1i(this.gradientProgram.uniforms["uVelocity"]!, this.velocity.read.attach(1));
    gl.viewport(0, 0, this.velocity.width, this.velocity.height);
    this.blit(this.velocity.write.fbo);
    this.velocity.swap();
  }

  // ── Display ─────────────────────────────────────────────────

  private render() {
    const gl = this.gl;
    this.displayProgram.bind();
    this.bindVertexAttribs(this.displayProgram);
    gl.uniform2f(this.displayProgram.uniforms["texelSize"]!, 1.0 / this.canvas.width, 1.0 / this.canvas.height);
    gl.uniform1i(this.displayProgram.uniforms["uTexture"]!, this.dye.read.attach(0));
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.blit(null);
  }

  // ── Auto-splats ─────────────────────────────────────────────

  private autoSplat(dt: number) {
    this.autoSplatTimer += dt;
    if (this.autoSplatTimer > 0.4) {
      this.autoSplatTimer = 0;
      const x = Math.random();
      const y = Math.random();
      const angle = Math.random() * Math.PI * 2;
      const dx = Math.cos(angle) * 0.001;
      const dy = Math.sin(angle) * 0.001;
      this.splat(x, y, dx, dy, this.generateColor());
    }
  }

  // ── Main loop ───────────────────────────────────────────────

  private loop() {
    const now = performance.now();
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    dt = Math.min(dt, 0.016666);

    if (!this.paused) {
      for (const p of this.pointers) {
        if (p.moved) {
          p.moved = false;
          const color = p.down ? p.color : this.generateColor();
          this.splat(p.texcoordX, p.texcoordY, p.deltaX, p.deltaY, color);
        }
      }
      this.autoSplat(dt);
      this.step(dt);
    }

    this.render();
    this.animId = requestAnimationFrame(() => this.loop());
  }
}
