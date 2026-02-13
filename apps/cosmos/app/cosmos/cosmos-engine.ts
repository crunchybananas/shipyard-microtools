// Cosmos WebGL2 Rendering Engine
// Instanced particle rendering for galaxies and stars with bloom post-processing

// ─── Shader Sources ──────────────────────────────────────────────────────────

const FULLSCREEN_VERT = `#version 300 es
precision highp float;
out vec2 vUV;
void main() {
  float x = float((gl_VertexID & 1) << 2);
  float y = float((gl_VertexID & 2) << 1);
  vUV = vec2(x * 0.5, y * 0.5);
  gl_Position = vec4(x - 1.0, y - 1.0, 0.0, 1.0);
}`;

const BACKGROUND_FRAG = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 fragColor;
uniform vec2 uResolution;
uniform float uTime;

// Simple hash for background star twinkle
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 center = vec2(0.5);
  float dist = length(vUV - center);

  // Deep space gradient
  vec3 core = vec3(0.04, 0.04, 0.1);
  vec3 mid = vec3(0.02, 0.02, 0.06);
  vec3 edge = vec3(0.0, 0.0, 0.02);

  vec3 color = mix(core, mid, smoothstep(0.0, 0.5, dist));
  color = mix(color, edge, smoothstep(0.5, 1.0, dist));

  // Fixed background stars
  vec2 gridSize = uResolution / 3.0;
  vec2 cell = floor(vUV * gridSize);
  float starHash = hash(cell);

  if (starHash > 0.985) {
    vec2 starPos = (cell + vec2(hash(cell + 1.0), hash(cell + 2.0))) / gridSize;
    float d = length(vUV - starPos) * gridSize.x;
    float brightness = 0.3 + 0.15 * sin(uTime * (1.0 + starHash * 2.0) + starHash * 6.28);
    float star = brightness * smoothstep(1.5, 0.0, d);
    color += vec3(star);
  }

  fragColor = vec4(color, 1.0);
}`;

const PARTICLE_VERT = `#version 300 es
precision highp float;

// Per-vertex (shared quad)
in vec2 aQuadPos;

// Per-instance
in vec2 aPosition;
in float aSize;
in vec4 aColor;
in float aGlow;

uniform vec2 uResolution;
uniform vec2 uCameraPos;
uniform float uZoom;

out vec4 vColor;
out vec2 vQuadUV;
out float vGlow;

void main() {
  // World → screen transform
  vec2 screenPos = (aPosition - uCameraPos) * uZoom + uResolution * 0.5;

  // Scale quad by particle size
  float pixelSize = max(aSize * uZoom, 0.5);
  vec2 pos = screenPos + aQuadPos * pixelSize;

  // Clip to NDC
  vec2 ndc = (pos / uResolution) * 2.0 - 1.0;
  ndc.y = -ndc.y; // Flip Y for screen coords

  gl_Position = vec4(ndc, 0.0, 1.0);
  vColor = aColor;
  vQuadUV = aQuadPos;
  vGlow = aGlow;
}`;

const PARTICLE_FRAG = `#version 300 es
precision highp float;
in vec4 vColor;
in vec2 vQuadUV;
in float vGlow;
out vec4 fragColor;

void main() {
  float dist = length(vQuadUV);

  // Core: bright white center
  float core = smoothstep(0.5, 0.0, dist);

  // Body: colored middle
  float body = smoothstep(1.0, 0.2, dist);

  // Glow: soft outer halo (controlled by vGlow)
  float glow = exp(-dist * dist * 2.0) * vGlow;

  vec3 white = vec3(1.0);
  vec3 color = mix(vColor.rgb, white, core * 0.8);
  float alpha = max(body * vColor.a, glow * vColor.a * 0.5);

  // Discard fully transparent fragments
  if (alpha < 0.005) discard;

  fragColor = vec4(color, alpha);
}`;

const BLOOM_BRIGHT_FRAG = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 fragColor;
uniform sampler2D uScene;
uniform float uThreshold;

void main() {
  vec4 color = texture(uScene, vUV);
  float brightness = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
  fragColor = brightness > uThreshold ? color : vec4(0.0);
}`;

const BLOOM_BLUR_FRAG = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 fragColor;
uniform sampler2D uTexture;
uniform vec2 uDirection;
uniform vec2 uResolution;

void main() {
  vec2 texelSize = 1.0 / uResolution;
  vec3 result = vec3(0.0);

  // 9-tap Gaussian
  float weights[5] = float[](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);

  result += texture(uTexture, vUV).rgb * weights[0];
  for (int i = 1; i < 5; i++) {
    vec2 offset = uDirection * texelSize * float(i) * 2.0;
    result += texture(uTexture, vUV + offset).rgb * weights[i];
    result += texture(uTexture, vUV - offset).rgb * weights[i];
  }

  fragColor = vec4(result, 1.0);
}`;

const BLOOM_COMPOSITE_FRAG = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 fragColor;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uBloomStrength;

void main() {
  vec3 scene = texture(uScene, vUV).rgb;
  vec3 bloom = texture(uBloom, vUV).rgb;
  fragColor = vec4(scene + bloom * uBloomStrength, 1.0);
}`;

const PLANET_VERT = `#version 300 es
precision highp float;
in vec2 aPosition;
out vec2 vUV;

uniform vec2 uCenter;
uniform float uRadius;
uniform vec2 uResolution;

void main() {
  vec2 pos = uCenter + aPosition * uRadius;
  vec2 ndc = (pos / uResolution) * 2.0 - 1.0;
  ndc.y = -ndc.y;
  gl_Position = vec4(ndc, 0.0, 1.0);
  vUV = aPosition; // -1..1
}`;

const PLANET_FRAG = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 fragColor;

uniform vec3 uColor;
uniform vec3 uLightDir;
uniform float uHasAtmosphere;
uniform vec3 uAtmosphereColor;
uniform float uPlanetType; // 0=rocky,1=gas,2=earth,3=ocean,4=lava,5=ice,6=desert,7=ice_giant
uniform float uSeed;
uniform float uTime;

// Simplex-like noise
float hash31(vec3 p) {
  p = fract(p * vec3(443.8975, 397.2973, 491.1871));
  p += dot(p, p.yzx + 19.19);
  return fract((p.x + p.y) * p.z);
}

float noise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float a = hash31(i);
  float b = hash31(i + vec3(1,0,0));
  float c = hash31(i + vec3(0,1,0));
  float d = hash31(i + vec3(1,1,0));
  float e = hash31(i + vec3(0,0,1));
  float f_ = hash31(i + vec3(1,0,1));
  float g = hash31(i + vec3(0,1,1));
  float h = hash31(i + vec3(1,1,1));

  float x1 = mix(a, b, f.x);
  float x2 = mix(c, d, f.x);
  float x3 = mix(e, f_, f.x);
  float x4 = mix(g, h, f.x);

  float y1 = mix(x1, x2, f.y);
  float y2 = mix(x3, x4, f.y);

  return mix(y1, y2, f.z);
}

float fbm(vec3 p) {
  float val = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    val += noise3(p) * amp;
    p *= 2.1;
    amp *= 0.5;
  }
  return val;
}

void main() {
  float dist = length(vUV);
  if (dist > 1.0) discard;

  // Sphere normal from UV
  vec3 normal = vec3(vUV, sqrt(1.0 - dist * dist));

  // Spherical coordinates for texture mapping
  float theta = atan(normal.z, normal.x) + uSeed;
  float phi = asin(normal.y);
  vec3 samplePos = vec3(theta * 2.0, phi * 3.0, uSeed * 0.1);

  // Base diffuse lighting
  float diffuse = max(dot(normal, normalize(uLightDir)), 0.0);
  float ambient = 0.08;
  float light = ambient + diffuse * 0.92;

  vec3 color = uColor;

  // Planet type-specific surface
  float n = fbm(samplePos * 3.0);

  if (uPlanetType < 0.5) {
    // Rocky: craters and ridges
    float craters = smoothstep(0.45, 0.5, n) * 0.3;
    color = mix(color, color * 0.6, craters);
    color = mix(color, color * (0.7 + n * 0.6), 1.0);
  } else if (uPlanetType < 1.5) {
    // Gas giant: horizontal bands
    float bands = sin(phi * 12.0 + fbm(samplePos * 2.0) * 2.0) * 0.5 + 0.5;
    vec3 bandColor = mix(color * 0.7, color * 1.3, bands);
    // Storm eye
    float storm = smoothstep(0.3, 0.0, length(vec2(theta - uSeed, phi) - vec2(1.0, 0.2)));
    bandColor = mix(bandColor, color * 1.5, storm * 0.4);
    color = bandColor;
  } else if (uPlanetType < 2.5) {
    // Earth-like: continents and oceans
    float land = smoothstep(0.42, 0.52, n);
    vec3 ocean = vec3(0.05, 0.15, 0.5);
    vec3 landColor = vec3(0.1, 0.4, 0.1);
    vec3 mountains = vec3(0.45, 0.35, 0.25);
    float height = fbm(samplePos * 6.0);
    landColor = mix(landColor, mountains, smoothstep(0.5, 0.7, height));
    // Polar ice caps
    float polar = smoothstep(0.7, 0.9, abs(phi) / 1.57);
    vec3 ice = vec3(0.9, 0.95, 1.0);
    color = mix(ocean, landColor, land);
    color = mix(color, ice, polar);
    // Clouds
    float clouds = fbm(samplePos * 4.0 + uTime * 0.01);
    color = mix(color, vec3(1.0), smoothstep(0.5, 0.7, clouds) * 0.4);
  } else if (uPlanetType < 3.5) {
    // Ocean: deep water with wave patterns
    float depth = n * 0.5 + 0.25;
    color = mix(vec3(0.0, 0.05, 0.15), vec3(0.05, 0.2, 0.5), depth);
    // Specular highlight (water sheen)
    vec3 viewDir = vec3(0.0, 0.0, 1.0);
    vec3 halfDir = normalize(normalize(uLightDir) + viewDir);
    float spec = pow(max(dot(normal, halfDir), 0.0), 64.0);
    color += vec3(spec * 0.5);
  } else if (uPlanetType < 4.5) {
    // Lava: dark crust with glowing cracks
    float cracks = 1.0 - smoothstep(0.0, 0.08, abs(n - 0.5));
    vec3 crust = vec3(0.15, 0.08, 0.05);
    vec3 lavaColor = vec3(1.0, 0.3, 0.0);
    color = mix(crust, lavaColor, cracks);
    // Emissive glow ignores lighting
    light = mix(light, 1.0, cracks * 0.8);
  } else if (uPlanetType < 5.5) {
    // Ice: glacial patterns
    float crevasse = smoothstep(0.48, 0.5, n) * 0.5;
    color = mix(vec3(0.7, 0.85, 0.95), vec3(0.4, 0.5, 0.65), n);
    color = mix(color, vec3(0.2, 0.3, 0.4), crevasse);
    // Specular
    vec3 viewDir = vec3(0.0, 0.0, 1.0);
    vec3 halfDir = normalize(normalize(uLightDir) + viewDir);
    float spec = pow(max(dot(normal, halfDir), 0.0), 32.0);
    color += vec3(spec * 0.3);
  } else if (uPlanetType < 6.5) {
    // Desert: dunes
    float dunes = sin(theta * 20.0 + n * 5.0) * 0.5 + 0.5;
    color = mix(color * 0.8, color * 1.2, dunes);
    color = mix(color, color * (0.7 + n * 0.6), 1.0);
  } else {
    // Ice giant: smooth bands with subtle storms
    float bands = sin(phi * 8.0 + fbm(samplePos * 1.5) * 1.5) * 0.5 + 0.5;
    color = mix(color * 0.8, color * 1.2, bands);
  }

  color *= light;

  // Atmosphere rim glow
  if (uHasAtmosphere > 0.5) {
    float rim = 1.0 - dot(normal, vec3(0.0, 0.0, 1.0));
    rim = pow(rim, 3.0);
    color += uAtmosphereColor * rim * 0.8;
  }

  // Terminator softening
  float terminator = smoothstep(-0.1, 0.15, dot(normal, normalize(uLightDir)));
  color *= terminator + (1.0 - terminator) * 0.05;

  fragColor = vec4(color, 1.0);
}`;

// ─── Nebula Shader ───────────────────────────────────────────────────────────

const NEBULA_FRAG = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 fragColor;

uniform vec2 uResolution;
uniform vec2 uCameraPos;
uniform float uZoom;
uniform float uTime;
uniform float uIntensity;

// Noise functions
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float a = hash(i);
  float b = hash(i + vec2(1, 0));
  float c = hash(i + vec2(0, 1));
  float d = hash(i + vec2(1, 1));

  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 6; i++) {
    v += noise(p) * a;
    p = rot * p * 2.1;
    a *= 0.5;
  }
  return v;
}

void main() {
  // World-space coordinates
  vec2 worldPos = (vUV - 0.5) * uResolution / uZoom + uCameraPos;

  // Multiple nebula layers at different scales
  float nebulaScale = 0.005;
  vec2 np = worldPos * nebulaScale;

  // Layer 1: Large nebula structure (emission nebula - red/pink)
  float n1 = fbm(np * 1.0 + vec2(uTime * 0.001, 0.0));
  float n2 = fbm(np * 1.5 + vec2(0.0, uTime * 0.0008) + 100.0);

  // Nebula density with wispy tendrils
  float density1 = smoothstep(0.35, 0.65, n1) * smoothstep(0.3, 0.6, n2);

  // Layer 2: Reflection nebula (blue)
  float n3 = fbm(np * 2.0 + 200.0);
  float density2 = smoothstep(0.4, 0.7, n3) * 0.6;

  // Layer 3: Dark nebula (absorption)
  float n4 = fbm(np * 0.8 + 300.0);
  float darkness = smoothstep(0.5, 0.7, n4) * 0.4;

  // Color mixing
  vec3 emission = vec3(0.8, 0.15, 0.2) * density1 * 0.4; // H-alpha red
  vec3 reflection = vec3(0.15, 0.25, 0.7) * density2 * 0.3; // Scattered blue
  vec3 green = vec3(0.1, 0.6, 0.15) * smoothstep(0.55, 0.7, n1 * n2) * 0.2; // OIII green

  vec3 color = emission + reflection + green;

  // Dark nebula absorption
  color *= (1.0 - darkness);

  // Intensity control (fades based on zoom/era)
  float alpha = length(color) * uIntensity;
  alpha = clamp(alpha, 0.0, 0.7);

  fragColor = vec4(color, alpha);
}`;

// ─── Terrain Shaders ─────────────────────────────────────────────────────────

const TERRAIN_FRAG = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 fragColor;

uniform vec2 uResolution;
uniform vec2 uCameraPos;
uniform float uZoom;
uniform float uSeed;
uniform float uTime;
uniform vec3 uBaseColor;
uniform vec3 uAccentColor;
uniform float uWaterLevel;
uniform vec3 uWaterColor;
uniform float uHasVegetation;
uniform vec3 uVegetationColor;
uniform float uRoughness;
uniform vec3 uLightDir;
uniform float uAtmosphereDensity;
uniform float uAtmosphereHue;

// 3D value noise
float hash31(vec3 p) {
  p = fract(p * vec3(443.8975, 397.2973, 491.1871));
  p += dot(p, p.yzx + 19.19);
  return fract((p.x + p.y) * p.z);
}

float noise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float a = hash31(i);
  float b = hash31(i + vec3(1,0,0));
  float c = hash31(i + vec3(0,1,0));
  float d = hash31(i + vec3(1,1,0));
  float e = hash31(i + vec3(0,0,1));
  float ff = hash31(i + vec3(1,0,1));
  float g = hash31(i + vec3(0,1,1));
  float h = hash31(i + vec3(1,1,1));

  return mix(
    mix(mix(a, b, f.x), mix(c, d, f.x), f.y),
    mix(mix(e, ff, f.x), mix(g, h, f.x), f.y),
    f.z
  );
}

float fbm(vec3 p, float roughness) {
  float val = 0.0;
  float amp = 0.5;
  float freq = 1.0;
  for (int i = 0; i < 8; i++) {
    val += noise3(p * freq) * amp;
    freq *= 2.1;
    amp *= 0.5 * (0.5 + roughness * 0.5);
  }
  return val;
}

void main() {
  // World coordinates from screen
  vec2 worldPos = (gl_FragCoord.xy - uResolution * 0.5) / uZoom + uCameraPos;
  vec3 samplePos = vec3(worldPos * 800.0, uSeed * 0.1);

  // Height from FBM
  float height = fbm(samplePos, uRoughness);

  // Compute normal via height differences for lighting
  float eps = 0.001;
  float hx = fbm(vec3(samplePos.x + eps, samplePos.yz), uRoughness);
  float hy = fbm(vec3(samplePos.x, samplePos.y + eps, samplePos.z), uRoughness);
  vec3 normal = normalize(vec3(height - hx, height - hy, eps * 2.0));

  vec3 color;

  if (height < uWaterLevel) {
    // Water
    float depth = 1.0 - height / max(uWaterLevel, 0.001);
    color = uWaterColor * (1.0 - depth * 0.3);

    // Water specular
    vec3 viewDir = vec3(0.0, 0.0, 1.0);
    vec3 halfDir = normalize(normalize(uLightDir) + viewDir);
    float spec = pow(max(dot(vec3(0.0, 0.0, 1.0), halfDir), 0.0), 64.0);
    color += vec3(spec * 0.3);

    // Animated caustics
    float caustic = noise3(samplePos * 40.0 + vec3(uTime * 0.3, uTime * 0.2, 0.0));
    color += vec3(caustic * 0.05);
  } else {
    // Terrain
    float normalizedH = (height - uWaterLevel) / max(1.0 - uWaterLevel, 0.001);
    color = mix(uBaseColor, uAccentColor, normalizedH);

    // Vegetation band
    if (uHasVegetation > 0.5 && normalizedH > 0.05 && normalizedH < 0.4) {
      float vegStrength = 1.0 - abs(normalizedH - 0.2) / 0.2;
      color = mix(color, uVegetationColor, vegStrength * 0.7);
    }

    // Snow caps
    if (normalizedH > 0.75) {
      float snow = (normalizedH - 0.75) / 0.25;
      color = mix(color, vec3(0.95, 0.97, 1.0), snow);
    }

    // Lighting
    float diffuse = max(dot(normal, normalize(uLightDir)), 0.0);
    color *= 0.15 + diffuse * 0.85;

    // Shoreline foam
    float edgeDist = (height - uWaterLevel) / max(1.0 - uWaterLevel, 0.001);
    if (edgeDist < 0.02 && uWaterLevel > 0.01) {
      float foam = smoothstep(0.02, 0.0, edgeDist);
      float foamPattern = noise3(samplePos * 100.0 + vec3(uTime * 0.5, 0.0, 0.0));
      color = mix(color, vec3(0.9, 0.95, 1.0), foam * foamPattern * 0.6);
    }
  }

  // Atmospheric haze (distance-based fade)
  float distFromCenter = length(gl_FragCoord.xy / uResolution - 0.5) * 2.0;
  float haze = smoothstep(0.6, 1.2, distFromCenter) * uAtmosphereDensity;
  float hRad = uAtmosphereHue / 360.0;
  vec3 hazeColor = vec3(
    0.5 + 0.5 * cos(6.28318 * (hRad + 0.0)),
    0.5 + 0.5 * cos(6.28318 * (hRad + 0.333)),
    0.5 + 0.5 * cos(6.28318 * (hRad + 0.667))
  ) * 0.6;
  color = mix(color, hazeColor, haze * 0.4);

  fragColor = vec4(color, 1.0);
}`;

const ATMOSPHERE_FRAG = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 fragColor;

uniform vec2 uResolution;
uniform float uAltitude; // 0 = space, 1 = surface
uniform float uDensity;
uniform float uHue;
uniform vec3 uStarColor;
uniform float uTime;
uniform float uPlanetRadius; // visual radius in screen pixels (normalized)

// Simple cloud noise
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1, 0));
  float c = hash(i + vec2(0, 1));
  float d = hash(i + vec2(1, 1));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float cloudFBM(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += vnoise(p) * a;
    p *= 2.1;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 center = vec2(0.5);
  float distFromCenter = length(uv - center) * 2.0;

  // Sky color from hue
  float hRad = uHue / 360.0;
  vec3 skyColor = vec3(
    0.5 + 0.5 * cos(6.28318 * (hRad + 0.0)),
    0.5 + 0.5 * cos(6.28318 * (hRad + 0.333)),
    0.5 + 0.5 * cos(6.28318 * (hRad + 0.667))
  ) * 0.5;

  // How much sky vs space
  float skyAlpha = uAltitude * uDensity;

  // Planet curvature: limb darkening at edges when altitude < 1
  float limbDist = distFromCenter;
  float limb = 1.0;
  if (uAltitude < 0.7) {
    // Show planet horizon as curved rim
    float horizonRadius = mix(0.3, 1.5, uAltitude);
    limb = smoothstep(horizonRadius + 0.2, horizonRadius - 0.1, limbDist);
  }

  // Rayleigh scattering gradient (blue zenith, orange/red horizon)
  float horizonGlow = pow(max(distFromCenter - 0.3, 0.0), 2.0);
  vec3 horizonColor = mix(skyColor, uStarColor * 0.8, 0.4);

  vec3 atmosphere = mix(skyColor, horizonColor, horizonGlow);
  atmosphere *= limb;

  // Stars visible through thin atmosphere
  float starVisibility = 1.0 - skyAlpha;
  vec2 starUV = uv * uResolution / 3.0;
  vec2 cell = floor(starUV);
  float starHash = hash(cell);
  float starBrightness = 0.0;
  if (starHash > 0.985) {
    vec2 starPos = (cell + vec2(hash(cell + 1.0), hash(cell + 2.0))) / (uResolution / 3.0);
    float d = length(uv - starPos) * uResolution.x / 3.0;
    starBrightness = 0.3 * smoothstep(1.5, 0.0, d) * starVisibility;
  }

  // Cloud layer (when entering atmosphere)
  float cloudAlpha = 0.0;
  if (uDensity > 0.2 && uAltitude > 0.3) {
    vec2 cloudUV = uv * 8.0 + vec2(uTime * 0.02, uTime * 0.01);
    float clouds = cloudFBM(cloudUV);
    cloudAlpha = smoothstep(0.4, 0.7, clouds) * uAltitude * uDensity * 0.5;
  }

  vec3 finalColor = atmosphere * skyAlpha + vec3(starBrightness);
  finalColor = mix(finalColor, vec3(0.95, 0.97, 1.0), cloudAlpha);

  // Black space behind planet limb
  float alpha = max(skyAlpha * limb, starBrightness + cloudAlpha);

  fragColor = vec4(finalColor, clamp(alpha, 0.0, 1.0));
}`;

// ─── WebGL Helpers ───────────────────────────────────────────────────────────

interface ShaderProgram {
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
  attribs: Record<string, number>;
}

interface FBO {
  framebuffer: WebGLFramebuffer;
  texture: WebGLTexture;
  width: number;
  height: number;
}

interface ParticleData {
  positions: Float32Array;
  sizes: Float32Array;
  colors: Float32Array;
  glows: Float32Array;
  count: number;
}

// ─── Engine Class ────────────────────────────────────────────────────────────

export class CosmosEngine {
  private gl: WebGL2RenderingContext | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private animationId: number | null = null;

  // Shader programs
  private bgProgram: ShaderProgram | null = null;
  private particleProgram: ShaderProgram | null = null;
  private bloomBrightProgram: ShaderProgram | null = null;
  private bloomBlurProgram: ShaderProgram | null = null;
  private bloomCompositeProgram: ShaderProgram | null = null;
  private planetProgram: ShaderProgram | null = null;
  private terrainProgram: ShaderProgram | null = null;
  private atmosphereProgram: ShaderProgram | null = null;
  private nebulaProgram: ShaderProgram | null = null;

  // Geometry
  private quadVAO: WebGLVertexArrayObject | null = null;
  private particleVAO: WebGLVertexArrayObject | null = null;
  private planetVAO: WebGLVertexArrayObject | null = null;

  // Instance buffers
  private positionBuffer: WebGLBuffer | null = null;
  private sizeBuffer: WebGLBuffer | null = null;
  private colorBuffer: WebGLBuffer | null = null;
  private glowBuffer: WebGLBuffer | null = null;

  // FBOs for bloom
  private sceneFBO: FBO | null = null;
  private brightFBO: FBO | null = null;
  private blurFBOs: FBO[] = [];

  // State
  private width = 0;
  private height = 0;
  private time = 0;
  private bloomEnabled = true;
  private bloomStrength = 0.35;
  private bloomThreshold = 0.4;
  private canRenderToFloat = false;

  // Max particles we can render in one draw call
  private maxParticles = 200000;

  // ─── Public API ──────────────────────────────────────────────────────────

  init(canvas: HTMLCanvasElement): boolean {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    });

    if (!gl) {
      console.error('WebGL2 not supported');
      return false;
    }

    this.gl = gl;

    // Enable float framebuffer rendering if supported
    this.canRenderToFloat = !!gl.getExtension('EXT_color_buffer_float');

    this.resize();

    // Compile all shader programs
    this.bgProgram = this.createProgram(FULLSCREEN_VERT, BACKGROUND_FRAG,
      ['uResolution', 'uTime'], []);
    this.particleProgram = this.createProgram(PARTICLE_VERT, PARTICLE_FRAG,
      ['uResolution', 'uCameraPos', 'uZoom'],
      ['aQuadPos', 'aPosition', 'aSize', 'aColor', 'aGlow']);
    this.bloomBrightProgram = this.createProgram(FULLSCREEN_VERT, BLOOM_BRIGHT_FRAG,
      ['uScene', 'uThreshold'], []);
    this.bloomBlurProgram = this.createProgram(FULLSCREEN_VERT, BLOOM_BLUR_FRAG,
      ['uTexture', 'uDirection', 'uResolution'], []);
    this.bloomCompositeProgram = this.createProgram(FULLSCREEN_VERT, BLOOM_COMPOSITE_FRAG,
      ['uScene', 'uBloom', 'uBloomStrength'], []);
    this.planetProgram = this.createProgram(PLANET_VERT, PLANET_FRAG,
      ['uCenter', 'uRadius', 'uResolution', 'uColor', 'uLightDir',
        'uHasAtmosphere', 'uAtmosphereColor', 'uPlanetType', 'uSeed', 'uTime'],
      ['aPosition']);

    this.terrainProgram = this.createProgram(FULLSCREEN_VERT, TERRAIN_FRAG,
      ['uResolution', 'uCameraPos', 'uZoom', 'uSeed', 'uTime',
        'uBaseColor', 'uAccentColor', 'uWaterLevel', 'uWaterColor',
        'uHasVegetation', 'uVegetationColor', 'uRoughness', 'uLightDir',
        'uAtmosphereDensity', 'uAtmosphereHue'],
      []);

    this.atmosphereProgram = this.createProgram(FULLSCREEN_VERT, ATMOSPHERE_FRAG,
      ['uResolution', 'uAltitude', 'uDensity', 'uHue', 'uStarColor',
        'uTime', 'uPlanetRadius'],
      []);

    this.nebulaProgram = this.createProgram(FULLSCREEN_VERT, NEBULA_FRAG,
      ['uResolution', 'uCameraPos', 'uZoom', 'uTime', 'uIntensity'],
      []);

    if (!this.bgProgram || !this.particleProgram || !this.bloomBrightProgram ||
      !this.bloomBlurProgram || !this.bloomCompositeProgram || !this.planetProgram ||
      !this.terrainProgram || !this.atmosphereProgram || !this.nebulaProgram) {
      console.error('Failed to compile shaders');
      return false;
    }

    // Setup geometry and buffers
    this.setupFullscreenQuad();
    this.setupParticleBuffers();
    this.setupPlanetGeometry();

    // GL state
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    return true;
  }

  resize(): void {
    if (!this.canvas || !this.gl) return;
    const dpr = Math.min(window.devicePixelRatio, 2);
    this.width = Math.floor(this.canvas.clientWidth * dpr);
    this.height = Math.floor(this.canvas.clientHeight * dpr);
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.gl.viewport(0, 0, this.width, this.height);
    this.createFBOs();
  }

  destroy(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.deleteFBOs();
    this.gl = null;
    this.canvas = null;
  }

  setBloom(enabled: boolean, strength?: number, threshold?: number): void {
    this.bloomEnabled = enabled;
    if (strength !== undefined) this.bloomStrength = strength;
    if (threshold !== undefined) this.bloomThreshold = threshold;
  }

  // ─── Render Methods ──────────────────────────────────────────────────────

  /**
   * Render a complete frame. Called by the Ember component's render loop.
   * The component decides WHAT to render; the engine just draws it.
   */
  beginFrame(): void {
    if (!this.gl) return;
    const gl = this.gl;

    this.time += 0.016;

    // Render to scene FBO if bloom is enabled
    if (this.bloomEnabled && this.sceneFBO) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFBO.framebuffer);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    gl.viewport(0, 0, this.width, this.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  drawBackground(): void {
    if (!this.gl || !this.bgProgram) return;
    const gl = this.gl;
    const p = this.bgProgram;

    gl.useProgram(p.program);
    gl.uniform2f(p.uniforms.uResolution!, this.width, this.height);
    gl.uniform1f(p.uniforms.uTime!, this.time);

    gl.bindVertexArray(this.quadVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  drawParticles(data: ParticleData, cameraX: number, cameraY: number, zoom: number): void {
    if (!this.gl || !this.particleProgram || data.count === 0) return;
    const gl = this.gl;
    const p = this.particleProgram;

    // Switch to additive blending for stars/galaxies
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    gl.useProgram(p.program);
    gl.uniform2f(p.uniforms.uResolution!, this.width, this.height);
    gl.uniform2f(p.uniforms.uCameraPos!, cameraX, cameraY);
    gl.uniform1f(p.uniforms.uZoom!, zoom);

    // Upload instance data
    const count = Math.min(data.count, this.maxParticles);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data.positions.subarray(0, count * 2), gl.DYNAMIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.sizeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data.sizes.subarray(0, count), gl.DYNAMIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data.colors.subarray(0, count * 4), gl.DYNAMIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.glowBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data.glows.subarray(0, count), gl.DYNAMIC_DRAW);

    gl.bindVertexArray(this.particleVAO);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
    gl.bindVertexArray(null);

    // Restore normal blending
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  drawPlanetSphere(
    centerX: number, centerY: number, radius: number,
    color: [number, number, number],
    lightDir: [number, number, number],
    hasAtmosphere: boolean,
    atmosphereColor: [number, number, number],
    planetTypeIndex: number,
    seed: number,
  ): void {
    if (!this.gl || !this.planetProgram || radius < 2) return;
    const gl = this.gl;
    const p = this.planetProgram;

    gl.useProgram(p.program);
    gl.uniform2f(p.uniforms.uCenter!, centerX, centerY);
    gl.uniform1f(p.uniforms.uRadius!, radius);
    gl.uniform2f(p.uniforms.uResolution!, this.width, this.height);
    gl.uniform3f(p.uniforms.uColor!, color[0], color[1], color[2]);
    gl.uniform3f(p.uniforms.uLightDir!, lightDir[0], lightDir[1], lightDir[2]);
    gl.uniform1f(p.uniforms.uHasAtmosphere!, hasAtmosphere ? 1.0 : 0.0);
    gl.uniform3f(p.uniforms.uAtmosphereColor!, atmosphereColor[0], atmosphereColor[1], atmosphereColor[2]);
    gl.uniform1f(p.uniforms.uPlanetType!, planetTypeIndex);
    gl.uniform1f(p.uniforms.uSeed!, seed);
    gl.uniform1f(p.uniforms.uTime!, this.time);

    gl.bindVertexArray(this.planetVAO);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  drawRing(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, radius: number,
    ringColor: string, behind: boolean
  ): void {
    // Rings still use Canvas 2D overlay for simplicity
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.3);
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = radius * 0.15;
    ctx.beginPath();
    if (behind) {
      ctx.arc(0, 0, radius * 1.8, Math.PI, Math.PI * 2);
    } else {
      ctx.arc(0, 0, radius * 1.8, 0, Math.PI);
    }
    ctx.stroke();
    ctx.restore();
  }

  drawTerrain(
    cameraX: number, cameraY: number, zoom: number,
    seed: number,
    baseColor: [number, number, number],
    accentColor: [number, number, number],
    waterLevel: number,
    waterColor: [number, number, number],
    hasVegetation: boolean,
    vegetationColor: [number, number, number],
    roughness: number,
    lightDir: [number, number, number],
    atmosphereDensity: number,
    atmosphereHue: number,
  ): void {
    if (!this.gl || !this.terrainProgram) return;
    const gl = this.gl;
    const p = this.terrainProgram;

    gl.useProgram(p.program);
    gl.uniform2f(p.uniforms.uResolution!, this.width, this.height);
    gl.uniform2f(p.uniforms.uCameraPos!, cameraX, cameraY);
    gl.uniform1f(p.uniforms.uZoom!, zoom);
    gl.uniform1f(p.uniforms.uSeed!, seed);
    gl.uniform1f(p.uniforms.uTime!, this.time);
    gl.uniform3f(p.uniforms.uBaseColor!, baseColor[0], baseColor[1], baseColor[2]);
    gl.uniform3f(p.uniforms.uAccentColor!, accentColor[0], accentColor[1], accentColor[2]);
    gl.uniform1f(p.uniforms.uWaterLevel!, waterLevel);
    gl.uniform3f(p.uniforms.uWaterColor!, waterColor[0], waterColor[1], waterColor[2]);
    gl.uniform1f(p.uniforms.uHasVegetation!, hasVegetation ? 1.0 : 0.0);
    gl.uniform3f(p.uniforms.uVegetationColor!, vegetationColor[0], vegetationColor[1], vegetationColor[2]);
    gl.uniform1f(p.uniforms.uRoughness!, roughness);
    gl.uniform3f(p.uniforms.uLightDir!, lightDir[0], lightDir[1], lightDir[2]);
    gl.uniform1f(p.uniforms.uAtmosphereDensity!, atmosphereDensity);
    gl.uniform1f(p.uniforms.uAtmosphereHue!, atmosphereHue);

    gl.bindVertexArray(this.quadVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  drawAtmosphere(
    altitude: number,
    density: number,
    hue: number,
    starColor: [number, number, number],
    planetRadius: number,
  ): void {
    if (!this.gl || !this.atmosphereProgram) return;
    const gl = this.gl;
    const p = this.atmosphereProgram;

    gl.useProgram(p.program);
    gl.uniform2f(p.uniforms.uResolution!, this.width, this.height);
    gl.uniform1f(p.uniforms.uAltitude!, altitude);
    gl.uniform1f(p.uniforms.uDensity!, density);
    gl.uniform1f(p.uniforms.uHue!, hue);
    gl.uniform3f(p.uniforms.uStarColor!, starColor[0], starColor[1], starColor[2]);
    gl.uniform1f(p.uniforms.uTime!, this.time);
    gl.uniform1f(p.uniforms.uPlanetRadius!, planetRadius);

    gl.bindVertexArray(this.quadVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  drawNebula(
    cameraX: number, cameraY: number, zoom: number,
    intensity: number,
  ): void {
    if (!this.gl || !this.nebulaProgram || intensity < 0.01) return;
    const gl = this.gl;
    const p = this.nebulaProgram;

    // Additive blending for nebulae
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    gl.useProgram(p.program);
    gl.uniform2f(p.uniforms.uResolution!, this.width, this.height);
    gl.uniform2f(p.uniforms.uCameraPos!, cameraX, cameraY);
    gl.uniform1f(p.uniforms.uZoom!, zoom);
    gl.uniform1f(p.uniforms.uTime!, this.time);
    gl.uniform1f(p.uniforms.uIntensity!, intensity);

    gl.bindVertexArray(this.quadVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);

    // Restore normal blending
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  endFrame(): void {
    if (!this.gl || !this.bloomEnabled) return;
    this.applyBloom();
  }

  getTime(): number {
    return this.time;
  }

  getResolution(): [number, number] {
    return [this.width, this.height];
  }

  // ─── Private: Shader Compilation ─────────────────────────────────────────

  private compileShader(type: number, source: string): WebGLShader | null {
    const gl = this.gl!;
    const shader = gl.createShader(type);
    if (!shader) return null;

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      console.error('Shader source:', source.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n'));
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  private createProgram(
    vertSrc: string, fragSrc: string,
    uniformNames: string[], attribNames: string[]
  ): ShaderProgram | null {
    const gl = this.gl!;

    const vert = this.compileShader(gl.VERTEX_SHADER, vertSrc);
    const frag = this.compileShader(gl.FRAGMENT_SHADER, fragSrc);
    if (!vert || !frag) return null;

    const program = gl.createProgram()!;
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return null;
    }

    const uniforms: Record<string, WebGLUniformLocation | null> = {};
    for (const name of uniformNames) {
      uniforms[name] = gl.getUniformLocation(program, name);
    }

    const attribs: Record<string, number> = {};
    for (const name of attribNames) {
      attribs[name] = gl.getAttribLocation(program, name);
    }

    return { program, uniforms, attribs };
  }

  // ─── Private: Geometry Setup ─────────────────────────────────────────────

  private setupFullscreenQuad(): void {
    const gl = this.gl!;
    this.quadVAO = gl.createVertexArray();
    gl.bindVertexArray(this.quadVAO);
    // No buffers needed — vertex positions generated in shader from gl_VertexID
    gl.bindVertexArray(null);
  }

  private setupParticleBuffers(): void {
    const gl = this.gl!;
    const p = this.particleProgram!;

    this.particleVAO = gl.createVertexArray();
    gl.bindVertexArray(this.particleVAO);

    // Quad geometry (shared across all instances) — a 2x2 square
    const quadData = new Float32Array([
      -1, -1,
      1, -1,
      -1, 1,
      1, 1,
    ]);
    const quadBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadData, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(p.attribs.aQuadPos!);
    gl.vertexAttribPointer(p.attribs.aQuadPos!, 2, gl.FLOAT, false, 0, 0);

    // Instance buffers
    this.positionBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.maxParticles * 2 * 4, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(p.attribs.aPosition!);
    gl.vertexAttribPointer(p.attribs.aPosition!, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(p.attribs.aPosition!, 1);

    this.sizeBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.sizeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.maxParticles * 4, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(p.attribs.aSize!);
    gl.vertexAttribPointer(p.attribs.aSize!, 1, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(p.attribs.aSize!, 1);

    this.colorBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.maxParticles * 4 * 4, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(p.attribs.aColor!);
    gl.vertexAttribPointer(p.attribs.aColor!, 4, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(p.attribs.aColor!, 1);

    this.glowBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.glowBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.maxParticles * 4, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(p.attribs.aGlow!);
    gl.vertexAttribPointer(p.attribs.aGlow!, 1, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(p.attribs.aGlow!, 1);

    gl.bindVertexArray(null);
  }

  private setupPlanetGeometry(): void {
    const gl = this.gl!;
    const p = this.planetProgram!;

    this.planetVAO = gl.createVertexArray();
    gl.bindVertexArray(this.planetVAO);

    // A quad from -1.3 to 1.3 (slightly oversized for atmosphere)
    const quadData = new Float32Array([
      -1.3, -1.3,
      1.3, -1.3,
      -1.3, 1.3,
      1.3, 1.3,
    ]);
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, quadData, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(p.attribs.aPosition!);
    gl.vertexAttribPointer(p.attribs.aPosition!, 2, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
  }

  // ─── Private: FBO Management ─────────────────────────────────────────────

  private createFBO(width: number, height: number): FBO | null {
    const gl = this.gl!;

    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    if (this.canRenderToFloat) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const framebuffer = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      console.error('FBO creation failed:', status);
      return null;
    }

    return { framebuffer, texture, width, height };
  }

  private createFBOs(): void {
    if (!this.gl || this.width === 0 || this.height === 0) return;

    // Clean up old FBOs before creating new ones
    this.deleteFBOs();

    const halfW = Math.floor(this.width / 2);
    const halfH = Math.floor(this.height / 2);

    this.sceneFBO = this.createFBO(this.width, this.height);
    this.brightFBO = this.createFBO(halfW, halfH);
    this.blurFBOs = [];
    const blur0 = this.createFBO(halfW, halfH);
    const blur1 = this.createFBO(halfW, halfH);
    if (blur0 && blur1) {
      this.blurFBOs = [blur0, blur1];
    }
  }

  private deleteFBOs(): void {
    const gl = this.gl;
    if (!gl) return;
    const fbos = [this.sceneFBO, this.brightFBO, ...this.blurFBOs];
    for (const fbo of fbos) {
      if (fbo) {
        gl.deleteFramebuffer(fbo.framebuffer);
        gl.deleteTexture(fbo.texture);
      }
    }
    this.sceneFBO = null;
    this.brightFBO = null;
    this.blurFBOs = [];
  }

  // ─── Private: Bloom Post-Processing ──────────────────────────────────────

  private applyBloom(): void {
    const gl = this.gl!;
    if (!this.sceneFBO || !this.brightFBO || this.blurFBOs.length < 2 ||
      !this.blurFBOs[0] || !this.blurFBOs[1]) return;

    // Disable blending for all bloom passes — critical for RGBA16F FBOs
    // where accumulated particle alpha > 1.0 would create negative blend
    // factors and subtract light instead of adding it.
    gl.disable(gl.BLEND);

    // 1. Extract bright pixels
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.brightFBO.framebuffer);
    gl.viewport(0, 0, this.brightFBO.width, this.brightFBO.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.bloomBrightProgram!.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneFBO.texture);
    gl.uniform1i(this.bloomBrightProgram!.uniforms.uScene!, 0);
    gl.uniform1f(this.bloomBrightProgram!.uniforms.uThreshold!, this.bloomThreshold);
    gl.bindVertexArray(this.quadVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 2. Gaussian blur passes (horizontal then vertical, 2 iterations)
    gl.useProgram(this.bloomBlurProgram!.program);
    const blurW = this.brightFBO.width;
    const blurH = this.brightFBO.height;
    gl.uniform2f(this.bloomBlurProgram!.uniforms.uResolution!, blurW, blurH);

    let readFBO = this.brightFBO;
    for (let i = 0; i < 2; i++) {
      // Horizontal
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFBOs[0]!.framebuffer);
      gl.viewport(0, 0, blurW, blurH);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, readFBO.texture);
      gl.uniform1i(this.bloomBlurProgram!.uniforms.uTexture!, 0);
      gl.uniform2f(this.bloomBlurProgram!.uniforms.uDirection!, 1.0, 0.0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // Vertical
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFBOs[1]!.framebuffer);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.blurFBOs[0]!.texture);
      gl.uniform2f(this.bloomBlurProgram!.uniforms.uDirection!, 0.0, 1.0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      readFBO = this.blurFBOs[1]!;
    }

    // 3. Composite: scene + bloom → screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.bloomCompositeProgram!.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneFBO.texture);
    gl.uniform1i(this.bloomCompositeProgram!.uniforms.uScene!, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.blurFBOs[1]!.texture);
    gl.uniform1i(this.bloomCompositeProgram!.uniforms.uBloom!, 1);
    gl.uniform1f(this.bloomCompositeProgram!.uniforms.uBloomStrength!, this.bloomStrength);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindVertexArray(null);

    // Restore blending for next frame's scene rendering
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }
}

// ─── Particle Data Builder ───────────────────────────────────────────────────

/**
 * Pre-allocated typed arrays for building particle data.
 * Reused each frame to avoid GC pressure.
 */
export class ParticleBuilder {
  positions: Float32Array;
  sizes: Float32Array;
  colors: Float32Array;
  glows: Float32Array;
  count = 0;
  private capacity: number;

  constructor(capacity = 200000) {
    this.capacity = capacity;
    this.positions = new Float32Array(capacity * 2);
    this.sizes = new Float32Array(capacity);
    this.colors = new Float32Array(capacity * 4);
    this.glows = new Float32Array(capacity);
  }

  reset(): void {
    this.count = 0;
  }

  add(x: number, y: number, size: number, r: number, g: number, b: number, a: number, glow: number): void {
    if (this.count >= this.capacity) return;
    const i = this.count;
    this.positions[i * 2] = x;
    this.positions[i * 2 + 1] = y;
    this.sizes[i] = size;
    this.colors[i * 4] = r;
    this.colors[i * 4 + 1] = g;
    this.colors[i * 4 + 2] = b;
    this.colors[i * 4 + 3] = a;
    this.glows[i] = glow;
    this.count++;
  }

  getData(): ParticleData {
    return {
      positions: this.positions,
      sizes: this.sizes,
      colors: this.colors,
      glows: this.glows,
      count: this.count,
    };
  }
}

// ─── Color Parsing Utility ───────────────────────────────────────────────────

/** Parse a hex color (#rrggbb) to normalized [0-1] RGB tuple */
export function hexToRGB(hex: string): [number, number, number] {
  const num = parseInt(hex.replace('#', ''), 16);
  return [
    ((num >> 16) & 0xFF) / 255,
    ((num >> 8) & 0xFF) / 255,
    (num & 0xFF) / 255,
  ];
}

/** Parse an HSL/HSLA string to normalized RGB */
export function hslToRGB(hsl: string): [number, number, number] {
  const match = hsl.match(/hsla?\((\d+),\s*(\d+)%,\s*(\d+)%/);
  if (!match) return [1, 1, 1];
  const h = parseInt(match[1]!) / 360;
  const s = parseInt(match[2]!) / 100;
  const l = parseInt(match[3]!) / 100;

  if (s === 0) return [l, l, l];

  const hue2rgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    hue2rgb(p, q, h + 1 / 3),
    hue2rgb(p, q, h),
    hue2rgb(p, q, h - 1 / 3),
  ];
}

/** Map planet type string to shader index */
export function planetTypeToIndex(type: string): number {
  const map: Record<string, number> = {
    rocky: 0, gas_giant: 1, earth_like: 2, ocean: 3,
    lava: 4, ice: 5, desert: 6, ice_giant: 7,
  };
  return map[type] ?? 0;
}
