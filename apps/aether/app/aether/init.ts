// ═══════════════════════════════════════════════════════════════════
// Aether — Real-time GPU Fluid Dynamics (Navier-Stokes)
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

export function initialize(container: HTMLElement) {
  const canvas = container.querySelector<HTMLCanvasElement>("#aether-canvas");
  if (!canvas) return;

  // ── WebGL setup ──────────────────────────────────────────────────────

  const params = { alpha: false, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false };
  const gl = (canvas.getContext("webgl2", params) || canvas.getContext("webgl", params)) as WebGLRenderingContext | null;
  if (!gl) { container.innerHTML = "<p style='color:#f87171;text-align:center;margin-top:4rem'>WebGL not supported</p>"; return; }

  const isWebGL2 = gl instanceof WebGL2RenderingContext;

  // Extension for float textures
  const halfFloat = gl.getExtension("OES_texture_half_float");
  const halfFloatLinear = gl.getExtension("OES_texture_half_float_linear");
  gl.getExtension("OES_texture_float");
  gl.getExtension("OES_texture_float_linear");
  if (isWebGL2) {
    gl.getExtension("EXT_color_buffer_float");
    gl.getExtension("EXT_color_buffer_half_float");
  }

  const HALF_FLOAT = isWebGL2 ? (gl as WebGL2RenderingContext).HALF_FLOAT : (halfFloat ? halfFloat.HALF_FLOAT_OES : gl.FLOAT);
  const RGBA_INTERNAL = isWebGL2 ? (gl as WebGL2RenderingContext).RGBA16F : gl.RGBA;

  // Check filtering support
  const supportLinear = isWebGL2 || halfFloatLinear;

  // Simulation resolution (lower = faster, higher = more detail)
  let SIM_W = 256;
  let SIM_H = 256;
  let DYE_W = 1024;
  let DYE_H = 1024;

  // ── Config ───────────────────────────────────────────────────

  const config = {
    splatRadius: 0.25,
    splatForce: 6000,
    curl: 30,
    pressureIterations: 20,
    velocityDissipation: 0.1,
    dyeDissipation: 0.3,
    paused: false,
  };

  // ── Shader sources ───────────────────────────────────────────

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

  const curlFrag = `
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
      c = pow(c, vec3(0.85));
      gl_FragColor = vec4(c, 1.0);
    }
  `;

  // ── Compile helpers ──────────────────────────────────────────

  function compileShader(type: number, source: string): WebGLShader {
    const shader = gl!.createShader(type)!;
    gl!.shaderSource(shader, source);
    gl!.compileShader(shader);
    if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) {
      console.error("Shader compile error:", gl!.getShaderInfoLog(shader));
    }
    return shader;
  }

  interface Program {
    program: WebGLProgram;
    uniforms: Record<string, WebGLUniformLocation>;
    bind: () => void;
  }

  function createProgram(vertSrc: string, fragSrc: string, uniformNames: string[]): Program {
    const prog = gl!.createProgram()!;
    gl!.attachShader(prog, compileShader(gl!.VERTEX_SHADER, vertSrc));
    gl!.attachShader(prog, compileShader(gl!.FRAGMENT_SHADER, fragSrc));
    gl!.linkProgram(prog);
    if (!gl!.getProgramParameter(prog, gl!.LINK_STATUS)) {
      console.error("Program link error:", gl!.getProgramInfoLog(prog));
    }
    const uniforms: Record<string, WebGLUniformLocation> = {};
    for (const name of uniformNames) {
      uniforms[name] = gl!.getUniformLocation(prog, name)!;
    }
    return {
      program: prog,
      uniforms,
      bind() { gl!.useProgram(prog); },
    };
  }

  // ── Programs ─────────────────────────────────────────────────

  const splatProgram = createProgram(baseVert, splatFrag, ["uTarget", "aspectRatio", "color", "point", "radius", "texelSize"]);
  const advectionProgram = createProgram(baseVert, advectionFrag, ["uVelocity", "uSource", "texelSize", "dt", "dissipation"]);
  const divergenceProgram = createProgram(baseVert, divergenceFrag, ["uVelocity", "texelSize"]);
  const curlProgram = createProgram(baseVert, curlFrag, ["uVelocity", "texelSize"]);
  const vorticityProgram = createProgram(baseVert, vorticityFrag, ["uVelocity", "uCurl", "curl", "dt", "texelSize"]);
  const pressureProgram = createProgram(baseVert, pressureFrag, ["uPressure", "uDivergence", "texelSize"]);
  const gradientProgram = createProgram(baseVert, gradientSubFrag, ["uPressure", "uVelocity", "texelSize"]);
  const clearProgram = createProgram(baseVert, clearFrag, ["uTexture", "value", "texelSize"]);
  const displayProgram = createProgram(baseVert, displayFrag, ["uTexture", "texelSize"]);

  // ── Full-screen quad ─────────────────────────────────────────

  const quadBuf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
  const indexBuf = gl.createBuffer()!;
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuf);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);

  function blit(target: WebGLFramebuffer | null) {
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, target);
    gl!.drawElements(gl!.TRIANGLES, 6, gl!.UNSIGNED_SHORT, 0);
  }

  function bindVertexAttribs(prog: Program) {
    const loc = gl!.getAttribLocation(prog.program, "aPosition");
    gl!.bindBuffer(gl!.ARRAY_BUFFER, quadBuf);
    gl!.enableVertexAttribArray(loc);
    gl!.vertexAttribPointer(loc, 2, gl!.FLOAT, false, 0, 0);
    gl!.bindBuffer(gl!.ELEMENT_ARRAY_BUFFER, indexBuf);
  }

  // ── Framebuffer objects ──────────────────────────────────────

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

  function createFBO(w: number, h: number, internalFormat: number, format: number, type: number, texFilter: number): FBO {
    const texture = gl!.createTexture()!;
    gl!.activeTexture(gl!.TEXTURE0);
    gl!.bindTexture(gl!.TEXTURE_2D, texture);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, texFilter);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, texFilter);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
    gl!.texImage2D(gl!.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);

    const fbo = gl!.createFramebuffer()!;
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, fbo);
    gl!.framebufferTexture2D(gl!.FRAMEBUFFER, gl!.COLOR_ATTACHMENT0, gl!.TEXTURE_2D, texture, 0);

    const status = gl!.checkFramebufferStatus(gl!.FRAMEBUFFER);
    if (status !== gl!.FRAMEBUFFER_COMPLETE) {
      console.warn("Aether: FBO incomplete", status);
    }

    gl!.viewport(0, 0, w, h);
    gl!.clear(gl!.COLOR_BUFFER_BIT);

    return {
      texture,
      fbo,
      width: w,
      height: h,
      attach(unit: number) {
        gl!.activeTexture(gl!.TEXTURE0 + unit);
        gl!.bindTexture(gl!.TEXTURE_2D, texture);
        return unit;
      },
    };
  }

  function createDoubleFBO(w: number, h: number, internalFormat: number, format: number, type: number, texFilter: number): DoubleFBO {
    let fbo1 = createFBO(w, h, internalFormat, format, type, texFilter);
    let fbo2 = createFBO(w, h, internalFormat, format, type, texFilter);
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

  // ── Init FBOs ────────────────────────────────────────────────

  const texFilter = supportLinear ? gl.LINEAR : gl.NEAREST;

  let velocity: DoubleFBO;
  let dye: DoubleFBO;
  let curlFBO: FBO;
  let divergenceFBO: FBO;
  let pressureFBO: DoubleFBO;

  function initFBOs() {
    velocity = createDoubleFBO(SIM_W, SIM_H, RGBA_INTERNAL, gl!.RGBA, HALF_FLOAT, texFilter);
    dye = createDoubleFBO(DYE_W, DYE_H, RGBA_INTERNAL, gl!.RGBA, HALF_FLOAT, texFilter);
    curlFBO = createFBO(SIM_W, SIM_H, RGBA_INTERNAL, gl!.RGBA, HALF_FLOAT, gl!.NEAREST);
    divergenceFBO = createFBO(SIM_W, SIM_H, RGBA_INTERNAL, gl!.RGBA, HALF_FLOAT, gl!.NEAREST);
    pressureFBO = createDoubleFBO(SIM_W, SIM_H, RGBA_INTERNAL, gl!.RGBA, HALF_FLOAT, texFilter);
  }

  // ── Resize ───────────────────────────────────────────────────

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas!.clientWidth;
    const h = canvas!.clientHeight;
    if (canvas!.width !== w * dpr || canvas!.height !== h * dpr) {
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
    }

    const aspect = w / h;
    SIM_W = Math.round(256 * (aspect >= 1 ? aspect : 1));
    SIM_H = Math.round(256 * (aspect < 1 ? 1 / aspect : 1));
    DYE_W = Math.round(1024 * (aspect >= 1 ? aspect : 1));
    DYE_H = Math.round(1024 * (aspect < 1 ? 1 / aspect : 1));

    initFBOs();
  }

  // ── Colors ───────────────────────────────────────────────────

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

  let colorHue = Math.random();
  function generateColor(): [number, number, number] {
    colorHue += 0.618033988749895; // golden ratio
    colorHue %= 1;
    const [r, g, b] = hsvToRgb(colorHue, 0.8, 1.0);
    return [r * 0.5, g * 0.5, b * 0.5];
  }

  // ── Pointer tracking ────────────────────────────────────────

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

  const pointers: Pointer[] = [{
    id: -1,
    texcoordX: 0, texcoordY: 0,
    prevTexcoordX: 0, prevTexcoordY: 0,
    deltaX: 0, deltaY: 0,
    down: false, moved: false,
    color: generateColor(),
  }];

  function updatePointerDownData(pointer: Pointer, id: number, x: number, y: number) {
    pointer.id = id;
    pointer.down = true;
    pointer.moved = false;
    pointer.texcoordX = x / canvas!.clientWidth;
    pointer.texcoordY = 1.0 - y / canvas!.clientHeight;
    pointer.prevTexcoordX = pointer.texcoordX;
    pointer.prevTexcoordY = pointer.texcoordY;
    pointer.deltaX = 0;
    pointer.deltaY = 0;
    pointer.color = generateColor();
  }

  function updatePointerMoveData(pointer: Pointer, x: number, y: number) {
    pointer.prevTexcoordX = pointer.texcoordX;
    pointer.prevTexcoordY = pointer.texcoordY;
    pointer.texcoordX = x / canvas!.clientWidth;
    pointer.texcoordY = 1.0 - y / canvas!.clientHeight;
    pointer.deltaX = correctDeltaX(pointer.texcoordX - pointer.prevTexcoordX);
    pointer.deltaY = correctDeltaY(pointer.texcoordY - pointer.prevTexcoordY);
    pointer.moved = Math.abs(pointer.deltaX) > 0 || Math.abs(pointer.deltaY) > 0;
  }

  function correctDeltaX(delta: number) {
    const aspect = canvas!.clientWidth / canvas!.clientHeight;
    return aspect < 1 ? delta * aspect : delta;
  }

  function correctDeltaY(delta: number) {
    const aspect = canvas!.clientWidth / canvas!.clientHeight;
    return aspect > 1 ? delta / aspect : delta;
  }

  // ── Event handlers ───────────────────────────────────────────

  canvas.addEventListener("mousedown", (e) => {
    const target = e.target as HTMLElement;
    if (target.closest(".controls-panel")) return;
    updatePointerDownData(pointers[0]!, e.offsetX, e.offsetY);
  });

  canvas.addEventListener("mousemove", (e) => {
    updatePointerMoveData(pointers[0]!, e.offsetX, e.offsetY);
    pointers[0]!.down = e.buttons > 0;
  });

  canvas.addEventListener("mouseup", () => {
    pointers[0]!.down = false;
  });

  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    for (let i = 0; i < e.targetTouches.length; i++) {
      const t = e.targetTouches[i]!;
      const rect = canvas!.getBoundingClientRect();
      if (i >= pointers.length) {
        pointers.push({
          id: -1, texcoordX: 0, texcoordY: 0,
          prevTexcoordX: 0, prevTexcoordY: 0,
          deltaX: 0, deltaY: 0,
          down: false, moved: false,
          color: generateColor(),
        });
      }
      updatePointerDownData(pointers[i]!, t.identifier, t.clientX - rect.left, t.clientY - rect.top);
    }
  }, { passive: false });

  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    for (let i = 0; i < e.targetTouches.length; i++) {
      const t = e.targetTouches[i]!;
      const rect = canvas!.getBoundingClientRect();
      const p = pointers.find(pp => pp.id === t.identifier);
      if (p) updatePointerMoveData(p, t.clientX - rect.left, t.clientY - rect.top);
    }
  }, { passive: false });

  canvas.addEventListener("touchend", (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i]!;
      const p = pointers.find(pp => pp.id === t.identifier);
      if (p) p.down = false;
    }
  });

  // ── Simulation steps ────────────────────────────────────────

  function splat(x: number, y: number, dx: number, dy: number, color: [number, number, number]) {
    const aspect = canvas!.clientWidth / canvas!.clientHeight;

    // Velocity splat
    splatProgram.bind();
    bindVertexAttribs(splatProgram);
    gl!.uniform1i(splatProgram.uniforms["uTarget"]!, velocity.read.attach(0));
    gl!.uniform1f(splatProgram.uniforms["aspectRatio"]!, aspect);
    gl!.uniform2f(splatProgram.uniforms["point"]!, x, y);
    gl!.uniform3f(splatProgram.uniforms["color"]!, dx * config.splatForce, dy * config.splatForce, 0.0);
    gl!.uniform1f(splatProgram.uniforms["radius"]!, correctRadius(config.splatRadius / 100));
    gl!.uniform2f(splatProgram.uniforms["texelSize"]!, velocity.texelSizeX, velocity.texelSizeY);
    gl!.viewport(0, 0, velocity.width, velocity.height);
    blit(velocity.write.fbo);
    velocity.swap();

    // Dye splat
    gl!.uniform1i(splatProgram.uniforms["uTarget"]!, dye.read.attach(0));
    gl!.uniform3f(splatProgram.uniforms["color"]!, color[0], color[1], color[2]);
    gl!.uniform2f(splatProgram.uniforms["texelSize"]!, dye.texelSizeX, dye.texelSizeY);
    gl!.viewport(0, 0, dye.width, dye.height);
    blit(dye.write.fbo);
    dye.swap();
  }

  function correctRadius(r: number) {
    const aspect = canvas!.clientWidth / canvas!.clientHeight;
    return aspect > 1 ? r * aspect : r;
  }

  function step(dt: number) {
    gl!.disable(gl!.BLEND);

    // Curl
    curlProgram.bind();
    bindVertexAttribs(curlProgram);
    gl!.uniform2f(curlProgram.uniforms["texelSize"]!, velocity.texelSizeX, velocity.texelSizeY);
    gl!.uniform1i(curlProgram.uniforms["uVelocity"]!, velocity.read.attach(0));
    gl!.viewport(0, 0, curlFBO.width, curlFBO.height);
    blit(curlFBO.fbo);

    // Vorticity confinement
    vorticityProgram.bind();
    bindVertexAttribs(vorticityProgram);
    gl!.uniform2f(vorticityProgram.uniforms["texelSize"]!, velocity.texelSizeX, velocity.texelSizeY);
    gl!.uniform1i(vorticityProgram.uniforms["uVelocity"]!, velocity.read.attach(0));
    gl!.uniform1i(vorticityProgram.uniforms["uCurl"]!, curlFBO.attach(1));
    gl!.uniform1f(vorticityProgram.uniforms["curl"]!, config.curl);
    gl!.uniform1f(vorticityProgram.uniforms["dt"]!, dt);
    gl!.viewport(0, 0, velocity.width, velocity.height);
    blit(velocity.write.fbo);
    velocity.swap();

    // Advect velocity
    advectionProgram.bind();
    bindVertexAttribs(advectionProgram);
    gl!.uniform2f(advectionProgram.uniforms["texelSize"]!, velocity.texelSizeX, velocity.texelSizeY);
    gl!.uniform1i(advectionProgram.uniforms["uVelocity"]!, velocity.read.attach(0));
    gl!.uniform1i(advectionProgram.uniforms["uSource"]!, velocity.read.attach(0));
    gl!.uniform1f(advectionProgram.uniforms["dt"]!, dt);
    gl!.uniform1f(advectionProgram.uniforms["dissipation"]!, config.velocityDissipation);
    gl!.viewport(0, 0, velocity.width, velocity.height);
    blit(velocity.write.fbo);
    velocity.swap();

    // Advect dye
    gl!.uniform2f(advectionProgram.uniforms["texelSize"]!, dye.texelSizeX, dye.texelSizeY);
    gl!.uniform1i(advectionProgram.uniforms["uVelocity"]!, velocity.read.attach(0));
    gl!.uniform1i(advectionProgram.uniforms["uSource"]!, dye.read.attach(1));
    gl!.uniform1f(advectionProgram.uniforms["dissipation"]!, config.dyeDissipation);
    gl!.viewport(0, 0, dye.width, dye.height);
    blit(dye.write.fbo);
    dye.swap();

    // Divergence
    divergenceProgram.bind();
    bindVertexAttribs(divergenceProgram);
    gl!.uniform2f(divergenceProgram.uniforms["texelSize"]!, velocity.texelSizeX, velocity.texelSizeY);
    gl!.uniform1i(divergenceProgram.uniforms["uVelocity"]!, velocity.read.attach(0));
    gl!.viewport(0, 0, SIM_W, SIM_H);
    blit(divergenceFBO.fbo);

    // Clear pressure
    clearProgram.bind();
    bindVertexAttribs(clearProgram);
    gl!.uniform1i(clearProgram.uniforms["uTexture"]!, pressureFBO.read.attach(0));
    gl!.uniform1f(clearProgram.uniforms["value"]!, 0.8);
    gl!.uniform2f(clearProgram.uniforms["texelSize"]!, pressureFBO.texelSizeX, pressureFBO.texelSizeY);
    gl!.viewport(0, 0, pressureFBO.width, pressureFBO.height);
    blit(pressureFBO.write.fbo);
    pressureFBO.swap();

    // Pressure solve (Jacobi iteration)
    pressureProgram.bind();
    bindVertexAttribs(pressureProgram);
    gl!.uniform2f(pressureProgram.uniforms["texelSize"]!, velocity.texelSizeX, velocity.texelSizeY);
    gl!.uniform1i(pressureProgram.uniforms["uDivergence"]!, divergenceFBO.attach(0));
    for (let i = 0; i < config.pressureIterations; i++) {
      gl!.uniform1i(pressureProgram.uniforms["uPressure"]!, pressureFBO.read.attach(1));
      gl!.viewport(0, 0, pressureFBO.width, pressureFBO.height);
      blit(pressureFBO.write.fbo);
      pressureFBO.swap();
    }

    // Gradient subtraction → divergence-free
    gradientProgram.bind();
    bindVertexAttribs(gradientProgram);
    gl!.uniform2f(gradientProgram.uniforms["texelSize"]!, velocity.texelSizeX, velocity.texelSizeY);
    gl!.uniform1i(gradientProgram.uniforms["uPressure"]!, pressureFBO.read.attach(0));
    gl!.uniform1i(gradientProgram.uniforms["uVelocity"]!, velocity.read.attach(1));
    gl!.viewport(0, 0, velocity.width, velocity.height);
    blit(velocity.write.fbo);
    velocity.swap();
  }

  // ── Display ──────────────────────────────────────────────────

  function render() {
    displayProgram.bind();
    bindVertexAttribs(displayProgram);
    gl!.uniform2f(displayProgram.uniforms["texelSize"]!, 1.0 / canvas!.width, 1.0 / canvas!.height);
    gl!.uniform1i(displayProgram.uniforms["uTexture"]!, dye.read.attach(0));
    gl!.viewport(0, 0, canvas!.width, canvas!.height);
    blit(null);
  }

  // ── Auto-splats (ambient motion) ────────────────────────────

  let autoSplatTimer = 0;
  function autoSplat(dt: number) {
    autoSplatTimer += dt;
    if (autoSplatTimer > 0.4) {
      autoSplatTimer = 0;
      const x = Math.random();
      const y = Math.random();
      const angle = Math.random() * Math.PI * 2;
      const dx = Math.cos(angle) * 0.001;
      const dy = Math.sin(angle) * 0.001;
      splat(x, y, dx, dy, generateColor());
    }
  }

  // ── Main loop ────────────────────────────────────────────────

  let lastTime = performance.now();
  let animId = 0;

  function loop() {
    const now = performance.now();
    let dt = (now - lastTime) / 1000;
    lastTime = now;
    dt = Math.min(dt, 0.016666);

    if (!config.paused) {
      for (const p of pointers) {
        if (p.moved) {
          p.moved = false;
          const color = p.down ? p.color : generateColor();
          splat(p.texcoordX, p.texcoordY, p.deltaX, p.deltaY, color);
        }
      }
      autoSplat(dt);
      step(dt);
    }

    render();
    animId = requestAnimationFrame(loop);
  }

  // ── Wire controls ────────────────────────────────────────────

  function wireControls() {
    const curlSlider = container.querySelector<HTMLInputElement>("#curlAmount");
    const splatSlider = container.querySelector<HTMLInputElement>("#splatSize");
    const velDissSlider = container.querySelector<HTMLInputElement>("#velDissipation");
    const dyeDissSlider = container.querySelector<HTMLInputElement>("#dyeDissipation");
    const pressSlider = container.querySelector<HTMLInputElement>("#pressureIter");
    const resetBtn = container.querySelector<HTMLButtonElement>("#resetBtn");
    const exportBtn = container.querySelector<HTMLButtonElement>("#exportBtn");
    const randomBtn = container.querySelector<HTMLButtonElement>("#randomSplat");
    const toggleBtn = container.querySelector<HTMLButtonElement>("#toggleControls");
    const panel = container.querySelector<HTMLDivElement>("#controls");

    curlSlider?.addEventListener("input", () => {
      config.curl = parseFloat(curlSlider.value);
      container.querySelector<HTMLSpanElement>("#curlVal")!.textContent = String(config.curl);
    });

    splatSlider?.addEventListener("input", () => {
      config.splatRadius = parseFloat(splatSlider.value) / 100;
      container.querySelector<HTMLSpanElement>("#splatVal")!.textContent = parseFloat(splatSlider.value).toFixed(1);
    });

    velDissSlider?.addEventListener("input", () => {
      config.velocityDissipation = parseFloat(velDissSlider.value);
      container.querySelector<HTMLSpanElement>("#velDissVal")!.textContent = config.velocityDissipation.toFixed(2);
    });

    dyeDissSlider?.addEventListener("input", () => {
      config.dyeDissipation = parseFloat(dyeDissSlider.value);
      container.querySelector<HTMLSpanElement>("#dyeDissVal")!.textContent = config.dyeDissipation.toFixed(2);
    });

    pressSlider?.addEventListener("input", () => {
      config.pressureIterations = parseInt(pressSlider.value);
      container.querySelector<HTMLSpanElement>("#pressVal")!.textContent = String(config.pressureIterations);
    });

    resetBtn?.addEventListener("click", () => {
      initFBOs();
    });

    exportBtn?.addEventListener("click", () => {
      render();
      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = canvas!.width;
      exportCanvas.height = canvas!.height;
      const ectx = exportCanvas.getContext("2d")!;
      ectx.drawImage(canvas!, 0, 0);
      const link = document.createElement("a");
      link.download = `aether-${Date.now()}.png`;
      link.href = exportCanvas.toDataURL("image/png");
      link.click();
    });

    randomBtn?.addEventListener("click", () => {
      for (let i = 0; i < 8; i++) {
        const x = Math.random();
        const y = Math.random();
        const angle = Math.random() * Math.PI * 2;
        const dx = Math.cos(angle) * 0.003;
        const dy = Math.sin(angle) * 0.003;
        splat(x, y, dx, dy, generateColor());
      }
    });

    toggleBtn?.addEventListener("click", () => {
      panel?.classList.toggle("collapsed");
    });
  }

  // ── Boot ─────────────────────────────────────────────────────

  resize();
  window.addEventListener("resize", resize);
  wireControls();

  // Initial burst
  setTimeout(() => {
    for (let i = 0; i < 5; i++) {
      const x = 0.2 + Math.random() * 0.6;
      const y = 0.2 + Math.random() * 0.6;
      const angle = Math.random() * Math.PI * 2;
      const dx = Math.cos(angle) * 0.001;
      const dy = Math.sin(angle) * 0.001;
      splat(x, y, dx, dy, generateColor());
    }
  }, 100);

  animId = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(animId);
    window.removeEventListener("resize", resize);
  };
}
