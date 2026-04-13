// ════════════════════════════════════════════════════════════
// WebGL Post-Processing — bloom, color grading, film grain
// ════════════════════════════════════════════════════════════

let gl, program, vao, texture, enabled = false;
let postCanvas;
let texReady = false;

const VERT = `#version 300 es
precision highp float;
const vec2 pos[3] = vec2[3](vec2(-1,-1), vec2(3,-1), vec2(-1,3));
const vec2 uv[3] = vec2[3](vec2(0,0), vec2(2,0), vec2(0,2));
out vec2 vUV;
void main() {
  vUV = uv[gl_VertexID];
  gl_Position = vec4(pos[gl_VertexID], 0, 1);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 fragColor;

uniform sampler2D u_scene;
uniform float u_time;
uniform float u_daylight;
uniform float u_season;
uniform vec2 u_resolution;

void main() {
  vec2 uv = vUV;
  vec4 color = texture(u_scene, uv);

  // ── Bloom: 9-tap soft glow on bright pixels ──
  vec2 texel = 1.0 / u_resolution;
  float bloomRadius = 3.0;
  vec3 bloomSum = vec3(0.0);
  float bloomWeight = 0.0;
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      vec2 offset = vec2(float(x), float(y)) * texel * bloomRadius;
      vec3 s = texture(u_scene, uv + offset).rgb;
      float bright = dot(s, vec3(0.2126, 0.7152, 0.0722));
      float mask = smoothstep(0.55, 1.0, bright);
      bloomSum += s * mask;
      bloomWeight += 1.0;
    }
  }
  // Extra bloom taps at wider radius
  for (int x = -2; x <= 2; x += 2) {
    for (int y = -2; y <= 2; y += 2) {
      if (x == 0 && y == 0) continue;
      vec2 offset = vec2(float(x), float(y)) * texel * bloomRadius * 2.0;
      vec3 s = texture(u_scene, uv + offset).rgb;
      float bright = dot(s, vec3(0.2126, 0.7152, 0.0722));
      float mask = smoothstep(0.55, 1.0, bright);
      bloomSum += s * mask * 0.5; // half weight for outer ring
      bloomWeight += 0.5;
    }
  }
  vec3 bloom = bloomSum / bloomWeight;
  // Bloom stronger at night
  float bloomIntensity = mix(0.15, 0.4, 1.0 - smoothstep(0.55, 1.0, u_daylight));
  color.rgb += bloom * bloomIntensity;

  // ── Color Grading: warm day / cool night ──
  vec3 warmGrade = color.rgb * vec3(1.06, 1.02, 0.94);
  float desat = dot(color.rgb, vec3(0.3, 0.5, 0.2));
  vec3 coolGrade = mix(vec3(desat), color.rgb * vec3(0.85, 0.92, 1.18), 0.7);
  color.rgb = mix(coolGrade, warmGrade, smoothstep(0.55, 0.9, u_daylight));

  // Season color adjustments
  if (u_season < 0.5) {
    // Spring — fresh green boost
    color.rgb *= vec3(0.98, 1.04, 0.96);
  } else if (u_season < 1.5) {
    // Summer — warm golden
    color.rgb *= vec3(1.05, 1.02, 0.92);
  } else if (u_season < 2.5) {
    // Autumn — amber warmth
    color.rgb *= vec3(1.08, 0.98, 0.88);
  } else {
    // Winter — cool blue, desaturated
    float lum = dot(color.rgb, vec3(0.3, 0.5, 0.2));
    color.rgb = mix(vec3(lum), color.rgb * vec3(0.92, 0.95, 1.08), 0.8);
  }

  // Sunrise/sunset glow
  float dawnDusk = 0.0;
  if (u_daylight > 0.55 && u_daylight < 0.75) {
    dawnDusk = 1.0 - abs(u_daylight - 0.65) / 0.1;
  }
  if (dawnDusk > 0.0) {
    float horizonFade = smoothstep(0.3, 0.7, uv.y); // stronger in bottom half
    vec3 sunColor = mix(vec3(1.0, 0.4, 0.15), vec3(1.0, 0.7, 0.3), horizonFade);
    color.rgb = mix(color.rgb, color.rgb + sunColor * 0.15, dawnDusk * horizonFade * 0.5);
  }

  // ── Vignette ──
  float dist = length(uv - 0.5) * 1.6;
  float vig = 1.0 - smoothstep(0.4, 1.2, dist);
  color.rgb *= mix(0.6, 1.0, vig);

  // ── Film Grain (subtle) ──
  float grain = fract(sin(dot(uv * u_resolution + u_time * 100.0, vec2(12.9898, 78.233))) * 43758.5453);
  float grainIntensity = mix(0.02, 0.05, 1.0 - u_daylight);
  color.rgb += (grain - 0.5) * grainIntensity;

  // ── Edge darkening (pseudo-AO) ──
  float step2 = 1.5 / u_resolution.y;
  float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  float lumN = dot(texture(u_scene, uv + vec2(0, step2)).rgb, vec3(0.299,0.587,0.114));
  float lumS = dot(texture(u_scene, uv - vec2(0, step2)).rgb, vec3(0.299,0.587,0.114));
  float lumE = dot(texture(u_scene, uv + vec2(step2, 0)).rgb, vec3(0.299,0.587,0.114));
  float lumW = dot(texture(u_scene, uv - vec2(step2, 0)).rgb, vec3(0.299,0.587,0.114));
  float edge = abs(lumN + lumS + lumE + lumW - 4.0 * lum);
  float ao = 1.0 - smoothstep(0.0, 0.12, edge) * 0.15;
  color.rgb *= ao;

  fragColor = vec4(clamp(color.rgb, 0.0, 1.0), 1.0);
}`;

// WebGL1 fallback shaders (no #version, no in/out)
const VERT_V1 = `
attribute vec2 aPos;
varying vec2 vUV;
void main() {
  vUV = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0, 1);
}`;

const FRAG_V1 = `
precision highp float;
varying vec2 vUV;
uniform sampler2D u_scene;
uniform float u_time;
uniform float u_daylight;
uniform vec2 u_resolution;
void main() {
  vec2 uv = vUV;
  vec4 color = texture2D(u_scene, uv);
  // Simplified: just color grading + vignette for WebGL1
  vec3 warmGrade = color.rgb * vec3(1.06, 1.02, 0.94);
  float desat = dot(color.rgb, vec3(0.3, 0.5, 0.2));
  vec3 coolGrade = mix(vec3(desat), color.rgb * vec3(0.85, 0.92, 1.18), 0.7);
  color.rgb = mix(coolGrade, warmGrade, smoothstep(0.55, 0.9, u_daylight));
  float dist = length(uv - 0.5) * 1.6;
  float vig = 1.0 - smoothstep(0.4, 1.2, dist);
  color.rgb *= mix(0.6, 1.0, vig);
  gl_FragColor = vec4(clamp(color.rgb, 0.0, 1.0), 1.0);
}`;

function compileShader(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.warn('PostFX shader error:', gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
}

export function initPostFX(sourceCanvas) {
  postCanvas = document.createElement('canvas');
  postCanvas.id = 'postfx';
  postCanvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:1;';
  sourceCanvas.parentElement.insertBefore(postCanvas, sourceCanvas.nextSibling);

  // Try WebGL2 first, fall back to WebGL1
  let isWebGL2 = true;
  gl = postCanvas.getContext('webgl2', { alpha: false, premultipliedAlpha: false });
  if (!gl) {
    gl = postCanvas.getContext('webgl', { alpha: false, premultipliedAlpha: false });
    isWebGL2 = false;
  }
  if (!gl) { console.warn('PostFX: WebGL not available'); return; }

  // Compile shaders
  const vs = compileShader(gl, gl.VERTEX_SHADER, isWebGL2 ? VERT : VERT_V1);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, isWebGL2 ? FRAG : FRAG_V1);
  if (!vs || !fs) { console.warn('PostFX: shader compilation failed'); return; }

  program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn('PostFX link error:', gl.getProgramInfoLog(program));
    return;
  }

  // Fullscreen triangle (WebGL2 uses gl_VertexID, no VBO needed)
  if (isWebGL2) {
    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
  } else {
    // WebGL1: need a VBO for the fullscreen quad
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  }

  // Create texture
  texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  resizePostFX();
  enabled = true;
}

export function resizePostFX() {
  if (!gl) return;
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  postCanvas.width = w * dpr;
  postCanvas.height = h * dpr;
  postCanvas.style.width = w + 'px';
  postCanvas.style.height = h + 'px';
  gl.viewport(0, 0, postCanvas.width, postCanvas.height);
  texReady = false; // force texImage2D on next frame
}

export function applyPostFX(sourceCanvas, gameTick, daylight, season = 0) {
  if (!enabled || !gl || !program) return;

  gl.useProgram(program);

  // Upload canvas as texture
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  if (!texReady) {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);
    texReady = true;
  } else {
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);
  }

  // Set uniforms
  gl.uniform1i(gl.getUniformLocation(program, 'u_scene'), 0);
  gl.uniform1f(gl.getUniformLocation(program, 'u_time'), gameTick / 60.0);
  gl.uniform1f(gl.getUniformLocation(program, 'u_daylight'), daylight);
  gl.uniform1f(gl.getUniformLocation(program, 'u_season'), season);
  gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), postCanvas.width, postCanvas.height);

  // Draw
  if (vao) gl.bindVertexArray(vao);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
