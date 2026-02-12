// ═══════════════════════════════════════════════════════════════════
// Cascade — 2048 × GPU Fluid Dynamics
//
// Every tile merge triggers a real Navier-Stokes fluid splat on the
// WebGL canvas behind the game grid, creating evolving fluid art
// as you play. The game literally paints as you play.
// ═══════════════════════════════════════════════════════════════════

// ── Tile color palette (value → [r, g, b] for fluid splats) ────

const TILE_COLORS: Record<number, [number, number, number]> = {
  2:    [0.45, 0.75, 0.85],  // sky blue
  4:    [0.48, 0.78, 0.50],  // green
  8:    [0.95, 0.70, 0.47],  // orange
  16:   [0.96, 0.58, 0.39],  // deep orange
  32:   [0.96, 0.49, 0.37],  // red-orange
  64:   [0.96, 0.37, 0.23],  // red
  128:  [0.93, 0.81, 0.45],  // gold
  256:  [0.93, 0.80, 0.38],  // bright gold
  512:  [0.93, 0.78, 0.31],  // deep gold
  1024: [0.93, 0.77, 0.25],  // amber
  2048: [0.93, 0.76, 0.18],  // brilliant gold
};

const TILE_CSS: Record<number, string> = {
  2:    "bg-2",
  4:    "bg-4",
  8:    "bg-8",
  16:   "bg-16",
  32:   "bg-32",
  64:   "bg-64",
  128:  "bg-128",
  256:  "bg-256",
  512:  "bg-512",
  1024: "bg-1024",
  2048: "bg-2048",
};

export interface CascadeCallbacks {
  onScoreUpdate: (score: number, best: number) => void;
  onMessage: (text: string, visible: boolean) => void;
}

export class CascadeEngine {
  private destroyFn: (() => void) | null = null;
  private startGameFn: (() => void) | null = null;
  private moveFn: ((dir: "up" | "down" | "left" | "right") => boolean) | null = null;
  private splatFn: ((x: number, y: number, dx: number, dy: number, color: [number, number, number]) => void) | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private gridEl: HTMLDivElement,
    private callbacks: CascadeCallbacks,
  ) {}

  start() {
    const canvas = this.canvas;
    const gridEl = this.gridEl;
    const callbacks = this.callbacks;

    // ════════════════════════════════════════════════════════════════
    // PART 1 — WebGL Fluid Simulation (simplified from Aether)
    // ════════════════════════════════════════════════════════════════

    const params = { alpha: true, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false };
    const gl = (canvas.getContext("webgl2", params) || canvas.getContext("webgl", params)) as WebGLRenderingContext | null;
    if (!gl) return;

    const isWebGL2 = gl instanceof WebGL2RenderingContext;
    const halfFloat = gl.getExtension("OES_texture_half_float");
    gl.getExtension("OES_texture_half_float_linear");
    gl.getExtension("OES_texture_float");
    gl.getExtension("OES_texture_float_linear");
    if (isWebGL2) {
      gl.getExtension("EXT_color_buffer_float");
      gl.getExtension("EXT_color_buffer_half_float");
    }

    const HALF_FLOAT = isWebGL2 ? (gl as WebGL2RenderingContext).HALF_FLOAT : (halfFloat ? halfFloat.HALF_FLOAT_OES : gl.FLOAT);
    const RGBA_INTERNAL = isWebGL2 ? (gl as WebGL2RenderingContext).RGBA16F : gl.RGBA;

    let SIM_W = 128;
    let SIM_H = 128;
    let DYE_W = 512;
    let DYE_H = 512;

    const fluidConfig = {
      splatRadius: 0.35,
      splatForce: 6000,
      curl: 25,
      pressureIterations: 16,
      velocityDissipation: 0.15,
      dyeDissipation: 0.6,
    };

    // ── Shaders ──────────────────────────────────────────────────

    const baseVert = `
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

    const splatFrag = `
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

    const advectionFrag = `
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

    const divergenceFrag = `
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

    const curlFragSrc = `
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

    const vorticityFrag = `
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

    const pressureFrag = `
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

    const gradientSubFrag = `
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

    const clearFrag = `
      precision mediump float;
      varying vec2 vUv;
      uniform sampler2D uTexture;
      uniform float value;
      void main() {
        gl_FragColor = value * texture2D(uTexture, vUv);
      }
    `;

    const displayFrag = `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D uTexture;
      void main() {
        vec3 c = texture2D(uTexture, vUv).rgb;
        c = pow(c, vec3(0.8));
        gl_FragColor = vec4(c, 1.0);
      }
    `;

    // ── GL helpers ───────────────────────────────────────────────

    function compileShader(type: number, source: string): WebGLShader {
      const s = gl!.createShader(type)!;
      gl!.shaderSource(s, source);
      gl!.compileShader(s);
      return s;
    }

    interface Prog {
      program: WebGLProgram;
      uniforms: Record<string, WebGLUniformLocation>;
      bind: () => void;
    }

    function createProgram(vs: string, fs: string, names: string[]): Prog {
      const p = gl!.createProgram()!;
      gl!.attachShader(p, compileShader(gl!.VERTEX_SHADER, vs));
      gl!.attachShader(p, compileShader(gl!.FRAGMENT_SHADER, fs));
      gl!.linkProgram(p);
      const u: Record<string, WebGLUniformLocation> = {};
      for (const n of names) u[n] = gl!.getUniformLocation(p, n)!;
      return { program: p, uniforms: u, bind() { gl!.useProgram(p); } };
    }

    const splatProg = createProgram(baseVert, splatFrag, ["uTarget", "aspectRatio", "color", "point", "radius", "texelSize"]);
    const advProg = createProgram(baseVert, advectionFrag, ["uVelocity", "uSource", "texelSize", "dt", "dissipation"]);
    const divProg = createProgram(baseVert, divergenceFrag, ["uVelocity", "texelSize"]);
    const curlProg = createProgram(baseVert, curlFragSrc, ["uVelocity", "texelSize"]);
    const vortProg = createProgram(baseVert, vorticityFrag, ["uVelocity", "uCurl", "curl", "dt", "texelSize"]);
    const presProg = createProgram(baseVert, pressureFrag, ["uPressure", "uDivergence", "texelSize"]);
    const gradProg = createProgram(baseVert, gradientSubFrag, ["uPressure", "uVelocity", "texelSize"]);
    const clearProg = createProgram(baseVert, clearFrag, ["uTexture", "value", "texelSize"]);
    const dispProg = createProgram(baseVert, displayFrag, ["uTexture", "texelSize"]);

    const quadBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
    const idxBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);

    function blit(target: WebGLFramebuffer | null) {
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, target);
      gl!.drawElements(gl!.TRIANGLES, 6, gl!.UNSIGNED_SHORT, 0);
    }

    function bindVA(prog: Prog) {
      const loc = gl!.getAttribLocation(prog.program, "aPosition");
      gl!.bindBuffer(gl!.ARRAY_BUFFER, quadBuf);
      gl!.enableVertexAttribArray(loc);
      gl!.vertexAttribPointer(loc, 2, gl!.FLOAT, false, 0, 0);
      gl!.bindBuffer(gl!.ELEMENT_ARRAY_BUFFER, idxBuf);
    }

    // ── FBO ──────────────────────────────────────────────────────

    interface FBO {
      texture: WebGLTexture;
      fbo: WebGLFramebuffer;
      width: number;
      height: number;
      attach: (u: number) => number;
    }

    interface DFBO {
      width: number; height: number;
      texelSizeX: number; texelSizeY: number;
      read: FBO; write: FBO;
      swap: () => void;
    }

    function createFBO(w: number, h: number, intFmt: number, fmt: number, type: number, filter: number): FBO {
      const tex = gl!.createTexture()!;
      gl!.activeTexture(gl!.TEXTURE0);
      gl!.bindTexture(gl!.TEXTURE_2D, tex);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, filter);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, filter);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
      gl!.texImage2D(gl!.TEXTURE_2D, 0, intFmt, w, h, 0, fmt, type, null);
      const fb = gl!.createFramebuffer()!;
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, fb);
      gl!.framebufferTexture2D(gl!.FRAMEBUFFER, gl!.COLOR_ATTACHMENT0, gl!.TEXTURE_2D, tex, 0);
      gl!.viewport(0, 0, w, h);
      gl!.clear(gl!.COLOR_BUFFER_BIT);
      return { texture: tex, fbo: fb, width: w, height: h, attach(u: number) { gl!.activeTexture(gl!.TEXTURE0 + u); gl!.bindTexture(gl!.TEXTURE_2D, tex); return u; } };
    }

    function createDFBO(w: number, h: number, intFmt: number, fmt: number, type: number, filter: number): DFBO {
      let a = createFBO(w, h, intFmt, fmt, type, filter);
      let b = createFBO(w, h, intFmt, fmt, type, filter);
      return {
        width: w, height: h, texelSizeX: 1 / w, texelSizeY: 1 / h,
        get read() { return a; }, set read(v) { a = v; },
        get write() { return b; }, set write(v) { b = v; },
        swap() { const t = a; a = b; b = t; },
      };
    }

    const texFilter = gl.LINEAR;
    let velocity: DFBO;
    let dye: DFBO;
    let curlFBO: FBO;
    let divergenceFBO: FBO;
    let pressureFBO: DFBO;

    function initFBOs() {
      velocity = createDFBO(SIM_W, SIM_H, RGBA_INTERNAL, gl!.RGBA, HALF_FLOAT, texFilter);
      dye = createDFBO(DYE_W, DYE_H, RGBA_INTERNAL, gl!.RGBA, HALF_FLOAT, texFilter);
      curlFBO = createFBO(SIM_W, SIM_H, RGBA_INTERNAL, gl!.RGBA, HALF_FLOAT, gl!.NEAREST);
      divergenceFBO = createFBO(SIM_W, SIM_H, RGBA_INTERNAL, gl!.RGBA, HALF_FLOAT, gl!.NEAREST);
      pressureFBO = createDFBO(SIM_W, SIM_H, RGBA_INTERNAL, gl!.RGBA, HALF_FLOAT, texFilter);
    }

    function resizeCanvas() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas!.clientWidth;
      const h = canvas!.clientHeight;
      if (canvas!.width !== w * dpr || canvas!.height !== h * dpr) {
        canvas!.width = w * dpr;
        canvas!.height = h * dpr;
      }
      const aspect = w / h;
      SIM_W = Math.round(128 * (aspect >= 1 ? aspect : 1));
      SIM_H = Math.round(128 * (aspect < 1 ? 1 / aspect : 1));
      DYE_W = Math.round(512 * (aspect >= 1 ? aspect : 1));
      DYE_H = Math.round(512 * (aspect < 1 ? 1 / aspect : 1));
      initFBOs();
    }

    // ── Fluid sim core ──────────────────────────────────────────

    function splat(x: number, y: number, dx: number, dy: number, color: [number, number, number]) {
      const aspect = canvas!.clientWidth / canvas!.clientHeight;
      const cr = (fluidConfig.splatRadius / 100) * (aspect > 1 ? aspect : 1);

      splatProg.bind(); bindVA(splatProg);
      gl!.uniform1i(splatProg.uniforms["uTarget"]!, velocity.read.attach(0));
      gl!.uniform1f(splatProg.uniforms["aspectRatio"]!, aspect);
      gl!.uniform2f(splatProg.uniforms["point"]!, x, y);
      gl!.uniform3f(splatProg.uniforms["color"]!, dx * fluidConfig.splatForce, dy * fluidConfig.splatForce, 0);
      gl!.uniform1f(splatProg.uniforms["radius"]!, cr);
      gl!.uniform2f(splatProg.uniforms["texelSize"]!, velocity.texelSizeX, velocity.texelSizeY);
      gl!.viewport(0, 0, velocity.width, velocity.height);
      blit(velocity.write.fbo); velocity.swap();

      gl!.uniform1i(splatProg.uniforms["uTarget"]!, dye.read.attach(0));
      gl!.uniform3f(splatProg.uniforms["color"]!, color[0]!, color[1]!, color[2]!);
      gl!.uniform2f(splatProg.uniforms["texelSize"]!, dye.texelSizeX, dye.texelSizeY);
      gl!.viewport(0, 0, dye.width, dye.height);
      blit(dye.write.fbo); dye.swap();
    }

    function fluidStep(dt: number) {
      gl!.disable(gl!.BLEND);

      curlProg.bind(); bindVA(curlProg);
      gl!.uniform2f(curlProg.uniforms["texelSize"]!, velocity.texelSizeX, velocity.texelSizeY);
      gl!.uniform1i(curlProg.uniforms["uVelocity"]!, velocity.read.attach(0));
      gl!.viewport(0, 0, curlFBO.width, curlFBO.height);
      blit(curlFBO.fbo);

      vortProg.bind(); bindVA(vortProg);
      gl!.uniform2f(vortProg.uniforms["texelSize"]!, velocity.texelSizeX, velocity.texelSizeY);
      gl!.uniform1i(vortProg.uniforms["uVelocity"]!, velocity.read.attach(0));
      gl!.uniform1i(vortProg.uniforms["uCurl"]!, curlFBO.attach(1));
      gl!.uniform1f(vortProg.uniforms["curl"]!, fluidConfig.curl);
      gl!.uniform1f(vortProg.uniforms["dt"]!, dt);
      gl!.viewport(0, 0, velocity.width, velocity.height);
      blit(velocity.write.fbo); velocity.swap();

      advProg.bind(); bindVA(advProg);
      gl!.uniform2f(advProg.uniforms["texelSize"]!, velocity.texelSizeX, velocity.texelSizeY);
      gl!.uniform1i(advProg.uniforms["uVelocity"]!, velocity.read.attach(0));
      gl!.uniform1i(advProg.uniforms["uSource"]!, velocity.read.attach(0));
      gl!.uniform1f(advProg.uniforms["dt"]!, dt);
      gl!.uniform1f(advProg.uniforms["dissipation"]!, fluidConfig.velocityDissipation);
      gl!.viewport(0, 0, velocity.width, velocity.height);
      blit(velocity.write.fbo); velocity.swap();

      gl!.uniform2f(advProg.uniforms["texelSize"]!, dye.texelSizeX, dye.texelSizeY);
      gl!.uniform1i(advProg.uniforms["uVelocity"]!, velocity.read.attach(0));
      gl!.uniform1i(advProg.uniforms["uSource"]!, dye.read.attach(1));
      gl!.uniform1f(advProg.uniforms["dissipation"]!, fluidConfig.dyeDissipation);
      gl!.viewport(0, 0, dye.width, dye.height);
      blit(dye.write.fbo); dye.swap();

      divProg.bind(); bindVA(divProg);
      gl!.uniform2f(divProg.uniforms["texelSize"]!, velocity.texelSizeX, velocity.texelSizeY);
      gl!.uniform1i(divProg.uniforms["uVelocity"]!, velocity.read.attach(0));
      gl!.viewport(0, 0, SIM_W, SIM_H);
      blit(divergenceFBO.fbo);

      clearProg.bind(); bindVA(clearProg);
      gl!.uniform1i(clearProg.uniforms["uTexture"]!, pressureFBO.read.attach(0));
      gl!.uniform1f(clearProg.uniforms["value"]!, 0.8);
      gl!.uniform2f(clearProg.uniforms["texelSize"]!, pressureFBO.texelSizeX, pressureFBO.texelSizeY);
      gl!.viewport(0, 0, pressureFBO.width, pressureFBO.height);
      blit(pressureFBO.write.fbo); pressureFBO.swap();

      presProg.bind(); bindVA(presProg);
      gl!.uniform2f(presProg.uniforms["texelSize"]!, velocity.texelSizeX, velocity.texelSizeY);
      gl!.uniform1i(presProg.uniforms["uDivergence"]!, divergenceFBO.attach(0));
      for (let i = 0; i < fluidConfig.pressureIterations; i++) {
        gl!.uniform1i(presProg.uniforms["uPressure"]!, pressureFBO.read.attach(1));
        gl!.viewport(0, 0, pressureFBO.width, pressureFBO.height);
        blit(pressureFBO.write.fbo); pressureFBO.swap();
      }

      gradProg.bind(); bindVA(gradProg);
      gl!.uniform2f(gradProg.uniforms["texelSize"]!, velocity.texelSizeX, velocity.texelSizeY);
      gl!.uniform1i(gradProg.uniforms["uPressure"]!, pressureFBO.read.attach(0));
      gl!.uniform1i(gradProg.uniforms["uVelocity"]!, velocity.read.attach(1));
      gl!.viewport(0, 0, velocity.width, velocity.height);
      blit(velocity.write.fbo); velocity.swap();
    }

    function renderFluid() {
      dispProg.bind(); bindVA(dispProg);
      gl!.uniform2f(dispProg.uniforms["texelSize"]!, 1 / canvas!.width, 1 / canvas!.height);
      gl!.uniform1i(dispProg.uniforms["uTexture"]!, dye.read.attach(0));
      gl!.viewport(0, 0, canvas!.width, canvas!.height);
      blit(null);
    }

    // ════════════════════════════════════════════════════════════════
    // PART 2 — 2048 Game Logic (with animated tile sliding)
    // ════════════════════════════════════════════════════════════════

    const ANIM_DURATION = 120; // ms for slide
    let animating = false;
    let tileIdCounter = 0;

    interface Tile {
      id: number;
      value: number;
      row: number;
      col: number;
      el: HTMLDivElement;
      mergedFrom?: boolean; // tile that will be removed after merge
    }

    let tiles: Tile[] = [];
    let score = 0;
    let best = parseInt(localStorage.getItem("cascade-best") || "0");
    let gameOver = false;
    let won = false;
    let keepPlaying = false;

    // Render 16 background cells once
    function renderCells() {
      gridEl!.innerHTML = "";
      for (let i = 0; i < 16; i++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        gridEl!.appendChild(cell);
      }
    }

    function createTileEl(tile: Tile): HTMLDivElement {
      const el = document.createElement("div");
      const cssClass = TILE_CSS[tile.value] || "bg-super";
      el.className = `tile ${cssClass}`;
      el.textContent = String(tile.value);
      if (tile.value >= 1024) el.classList.add("small-text");
      positionTileEl(el, tile.row, tile.col);
      gridEl!.appendChild(el);
      return el;
    }

    function positionTileEl(el: HTMLDivElement, row: number, col: number) {
      el.style.setProperty("--col", String(col));
      el.style.setProperty("--row", String(row));
    }

    function emptyPositions(): [number, number][] {
      const occupied = new Set(tiles.filter(t => !t.mergedFrom).map(t => `${t.row},${t.col}`));
      const positions: [number, number][] = [];
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          if (!occupied.has(`${r},${c}`)) positions.push([r, c]);
        }
      }
      return positions;
    }

    function spawnTile() {
      const empty = emptyPositions();
      if (empty.length === 0) return;
      const [r, c] = empty[Math.floor(Math.random() * empty.length)]!;
      const value = Math.random() < 0.9 ? 2 : 4;
      const tile: Tile = { id: tileIdCounter++, value, row: r!, col: c!, el: null! };
      tile.el = createTileEl(tile);
      tile.el.classList.add("tile-new");
      tiles.push(tile);

      // Small celebratory splat for new tile
      const pos = tileToCanvas(r!, c!);
      const color = TILE_COLORS[value] || [0.5, 0.5, 0.5];
      const angle = Math.random() * Math.PI * 2;
      splat(pos[0], pos[1], Math.cos(angle) * 0.0003, Math.sin(angle) * 0.0003, [color[0]! * 0.3, color[1]! * 0.3, color[2]! * 0.3]);
    }

    function tileToCanvas(row: number, col: number): [number, number] {
      const gridRect = gridEl!.getBoundingClientRect();
      const canvasRect = canvas!.getBoundingClientRect();
      const cellSize = gridRect.width / 4;
      const tileX = gridRect.left - canvasRect.left + col * cellSize + cellSize / 2;
      const tileY = gridRect.top - canvasRect.top + row * cellSize + cellSize / 2;
      return [tileX / canvasRect.width, 1.0 - tileY / canvasRect.height];
    }

    // Build a lookup grid from tiles
    function buildGrid(): (Tile | null)[][] {
      const g: (Tile | null)[][] = Array.from({ length: 4 }, () => Array(4).fill(null));
      for (const t of tiles) {
        if (!t.mergedFrom) g[t.row]![t.col] = t;
      }
      return g;
    }

    interface MergeEvent { row: number; col: number; value: number; }

    function move(direction: "up" | "down" | "left" | "right"): boolean {
      if (animating || (gameOver && !keepPlaying)) return false;

      const g = buildGrid();
      let moved = false;
      const merges: MergeEvent[] = [];
      const toMergeAfterAnim: { winner: Tile; loser: Tile; newVal: number }[] = [];

      // Process rows or columns depending on direction
      const isHoriz = direction === "left" || direction === "right";
      const isReverse = direction === "right" || direction === "down";

      for (let major = 0; major < 4; major++) {
        // Extract the line of tiles
        const line: (Tile | null)[] = [];
        for (let minor = 0; minor < 4; minor++) {
          const r = isHoriz ? major : minor;
          const c = isHoriz ? minor : major;
          line.push(g[r]![c]);
        }

        if (isReverse) line.reverse();

        // Slide + merge logic
        const compacted: Tile[] = [];
        const nonNull = line.filter(t => t !== null) as Tile[];
        let i = 0;
        while (i < nonNull.length) {
          if (i + 1 < nonNull.length && nonNull[i]!.value === nonNull[i + 1]!.value) {
            // Merge: keep first, remove second
            const winner = nonNull[i]!;
            const loser = nonNull[i + 1]!;
            const newVal = winner.value * 2;
            compacted.push(winner);
            toMergeAfterAnim.push({ winner, loser, newVal });

            // Track loser — it slides to winner's destination, then gets removed
            loser.mergedFrom = true;

            const destIdx = compacted.length - 1;
            const destMinor = isReverse ? 3 - destIdx : destIdx;
            const destR = isHoriz ? major : destMinor;
            const destC = isHoriz ? destMinor : major;
            merges.push({ row: destR, col: destC, value: newVal });

            i += 2;
          } else {
            compacted.push(nonNull[i]!);
            i++;
          }
        }

        // Assign new positions
        for (let idx = 0; idx < compacted.length; idx++) {
          const tile = compacted[idx]!;
          const destMinor = isReverse ? 3 - idx : idx;
          const destR = isHoriz ? major : destMinor;
          const destC = isHoriz ? destMinor : major;

          if (tile.row !== destR || tile.col !== destC) moved = true;
          tile.row = destR;
          tile.col = destC;
        }

        // Also slide losers to winner's destination
        for (const m of toMergeAfterAnim) {
          if (m.loser.row !== m.winner.row || m.loser.col !== m.winner.col) {
            moved = true;
            m.loser.row = m.winner.row;
            m.loser.col = m.winner.col;
          }
        }
      }

      if (!moved) return false;

      animating = true;

      // Apply slide transitions
      for (const t of tiles) {
        t.el.classList.add("sliding");
        positionTileEl(t.el, t.row, t.col);
      }

      // After animations complete
      setTimeout(() => {
        // Process merges
        for (const m of toMergeAfterAnim) {
          // Remove loser element
          m.loser.el.remove();
          tiles = tiles.filter(t => t !== m.loser);

          // Update winner
          m.winner.value = m.newVal;
          m.winner.el.textContent = String(m.newVal);
          m.winner.el.className = `tile ${TILE_CSS[m.newVal] || "bg-super"}`;
          if (m.newVal >= 1024) m.winner.el.classList.add("small-text");
          m.winner.el.classList.add("tile-merge");
          m.winner.mergedFrom = false;

          score += m.newVal;

          // Fluid splat!
          const pos = tileToCanvas(m.winner.row, m.winner.col);
          const color = TILE_COLORS[m.newVal] || [0.5, 0.5, 0.5];
          const intensity = Math.min(Math.log2(m.newVal) / 11, 1);
          const radius = 0.2 + intensity * 0.6;
          const burst = Math.ceil(1 + intensity * 4);
          for (let i = 0; i < burst; i++) {
            const angle = (i / burst) * Math.PI * 2 + Math.random() * 0.5;
            const force = 0.001 + intensity * 0.004;
            splat(pos[0], pos[1], Math.cos(angle) * force, Math.sin(angle) * force,
              [color[0]! * radius, color[1]! * radius, color[2]! * radius]);
          }

          if (m.newVal === 2048 && !won) {
            won = true;
            callbacks.onMessage("🎉 You win!", true);
            setTimeout(() => { keepPlaying = true; callbacks.onMessage("", false); }, 2000);
          }
        }

        // Remove slide class, add new tile
        for (const t of tiles) t.el.classList.remove("sliding");

        spawnTile();

        if (score > best) {
          best = score;
          localStorage.setItem("cascade-best", String(best));
        }
        callbacks.onScoreUpdate(score, best);

        if (!canMove()) {
          gameOver = true;
          callbacks.onMessage("Game Over", true);
        }

        // Clean up merge animation class after it finishes
        setTimeout(() => {
          for (const t of tiles) t.el.classList.remove("tile-merge");
        }, 150);

        animating = false;
      }, ANIM_DURATION);

      return true;
    }

    function canMove(): boolean {
      const g = buildGrid();
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          if (!g[r]![c]) return true;
          const v = g[r]![c]!.value;
          if (c < 3 && g[r]![c + 1]?.value === v) return true;
          if (r < 3 && g[r + 1]![c]?.value === v) return true;
        }
      }
      return false;
    }

    function startGame() {
      // Remove all tile elements
      for (const t of tiles) t.el.remove();
      tiles = [];
      tileIdCounter = 0;
      score = 0;
      gameOver = false;
      won = false;
      keepPlaying = false;
      animating = false;
      callbacks.onMessage("", false);
      callbacks.onScoreUpdate(0, best);
      spawnTile();
      spawnTile();
      initFBOs(); // Clear the fluid canvas too
    }

    // ── Main loop ────────────────────────────────────────────────

    let lastTime = performance.now();
    let animId = 0;

    function loop() {
      const now = performance.now();
      let dt = (now - lastTime) / 1000;
      lastTime = now;
      dt = Math.min(dt, 0.016666);

      fluidStep(dt);
      renderFluid();

      animId = requestAnimationFrame(loop);
    }

    // ── Boot ─────────────────────────────────────────────────────

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    renderCells();
    startGame();
    animId = requestAnimationFrame(loop);

    // Store refs for class API
    this.startGameFn = startGame;
    this.moveFn = move;
    this.splatFn = splat;
    this.destroyFn = () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resizeCanvas);
    };
  }

  startGame() {
    this.startGameFn?.();
  }

  move(direction: "up" | "down" | "left" | "right") {
    this.moveFn?.(direction);
  }

  paint(x: number, y: number, dx: number, dy: number) {
    if (!this.splatFn) return;
    const hue = (performance.now() * 0.0002) % 1;
    const color = hsvToRgb(hue, 0.8, 0.5);
    this.splatFn(x, y, dx, dy, color);
  }

  destroy() {
    this.destroyFn?.();
  }
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
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
