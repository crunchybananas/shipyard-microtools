export const PLANET_FRAG = `#version 300 es
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
    vec3 ocean = vec3(0.04, 0.12, 0.45);
    vec3 shallowOcean = vec3(0.06, 0.22, 0.5);
    vec3 landColor = vec3(0.1, 0.4, 0.1);
    vec3 mountains = vec3(0.45, 0.35, 0.25);
    float height = fbm(samplePos * 6.0);
    landColor = mix(landColor, mountains, smoothstep(0.5, 0.7, height));
    // Polar ice caps
    float polar = smoothstep(0.7, 0.9, abs(phi) / 1.57);
    vec3 ice = vec3(0.9, 0.95, 1.0);
    // Ocean depth variation
    float oceanDepth = fbm(samplePos * 2.5 + 30.0);
    vec3 oceanColor = mix(ocean, shallowOcean, smoothstep(0.35, 0.55, oceanDepth));
    color = mix(oceanColor, landColor, land);
    color = mix(color, ice, polar);
    // Clouds
    float clouds = fbm(samplePos * 4.0 + uTime * 0.01);
    color = mix(color, vec3(1.0), smoothstep(0.5, 0.7, clouds) * 0.4);
    // Ocean specular (only on water)
    if (land < 0.5) {
      vec3 viewDir = vec3(0.0, 0.0, 1.0);
      vec3 halfDir = normalize(normalize(uLightDir) + viewDir);
      float spec = pow(max(dot(normal, halfDir), 0.0), 128.0);
      float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(normal, viewDir), 0.0), 5.0);
      color += vec3(1.0, 0.97, 0.9) * spec * 0.6 * (1.0 - land * 2.0);
      // Subtle sky reflection on ocean
      vec3 skyTint = vec3(0.4, 0.5, 0.7);
      color = mix(color, skyTint, fresnel * 0.2 * (1.0 - land * 2.0));
    }
  } else if (uPlanetType < 3.5) {
    // Ocean: realistic water planet with animated waves
    // ─── Multi-layer depth coloring ────────────────────────────────
    float depthNoise = fbm(samplePos * 3.0);
    float trenchNoise = fbm(samplePos * 1.5 + 50.0);
    float depth = depthNoise * 0.6 + 0.2;

    // Deep trenches → mid ocean → shallow ridges
    vec3 abyssColor = vec3(0.0, 0.02, 0.08);       // near-black deep
    vec3 deepColor = vec3(0.01, 0.06, 0.22);        // dark blue
    vec3 midColor = vec3(0.03, 0.14, 0.4);          // mid blue
    vec3 shallowColor = vec3(0.06, 0.28, 0.52);     // bright blue
    vec3 shoalColor = vec3(0.08, 0.42, 0.55);       // cyan-teal shallows

    float depthGrade = clamp(depth + trenchNoise * 0.15, 0.0, 1.0);
    color = mix(abyssColor, deepColor, smoothstep(0.0, 0.25, depthGrade));
    color = mix(color, midColor, smoothstep(0.25, 0.45, depthGrade));
    color = mix(color, shallowColor, smoothstep(0.45, 0.65, depthGrade));
    color = mix(color, shoalColor, smoothstep(0.65, 0.85, depthGrade));

    // ─── Animated wave displacement ────────────────────────────────
    // Gerstner-style wave normals on the sphere
    vec3 waveSample = samplePos * 8.0;
    float t = uTime * 0.015;

    // Multiple wave directions for choppy realism
    float w1 = sin(waveSample.x * 3.0 + waveSample.y * 1.5 + t * 2.3) * 0.5 + 0.5;
    float w2 = sin(waveSample.x * 1.7 - waveSample.y * 2.8 + t * 1.7) * 0.5 + 0.5;
    float w3 = sin(waveSample.x * 4.5 + waveSample.y * 0.8 - t * 3.1) * 0.5 + 0.5;
    float w4 = sin(waveSample.y * 5.2 + waveSample.x * 2.1 + t * 1.2) * 0.5 + 0.5;

    // Perturb the normal with wave heights
    float waveScale = 0.06;
    vec3 waveNormal = normalize(normal + vec3(
      (w1 - 0.5 + w3 * 0.3) * waveScale,
      (w2 - 0.5 + w4 * 0.3) * waveScale,
      0.0
    ));

    // ─── Subsurface scattering ─────────────────────────────────────
    // Light passing through thin crests near the terminator
    float NdotL = dot(waveNormal, normalize(uLightDir));
    float scatter = pow(max(0.0, -NdotL * 0.5 + 0.5), 2.0);
    float waveHeight = (w1 + w2 + w3 + w4) * 0.25;
    vec3 sssColor = vec3(0.0, 0.6, 0.45) * scatter * waveHeight * 0.4;
    color += sssColor;

    // ─── Fresnel reflection ────────────────────────────────────────
    vec3 viewDir = vec3(0.0, 0.0, 1.0);
    float NdotV = max(dot(waveNormal, viewDir), 0.0);
    // Schlick approximation (water IOR ~1.33, F0 ≈ 0.02)
    float fresnel = 0.02 + 0.98 * pow(1.0 - NdotV, 5.0);

    // Reflected sky approximation
    vec3 refl = reflect(-viewDir, waveNormal);
    float skyGrad = refl.y * 0.5 + 0.5;
    vec3 skyReflection = mix(vec3(0.3, 0.35, 0.5), vec3(0.5, 0.65, 0.9), skyGrad);
    if (uHasAtmosphere > 0.5) {
      skyReflection = mix(skyReflection, uAtmosphereColor * 0.8, 0.3);
    }
    color = mix(color, skyReflection, fresnel * 0.7);

    // ─── Specular highlights ───────────────────────────────────────
    vec3 halfDir = normalize(normalize(uLightDir) + viewDir);
    // Sharp sun glint
    float specHard = pow(max(dot(waveNormal, halfDir), 0.0), 256.0);
    // Soft sun path
    float specSoft = pow(max(dot(waveNormal, halfDir), 0.0), 32.0);
    color += vec3(1.0, 0.97, 0.9) * specHard * 1.2;
    color += vec3(1.0, 0.9, 0.7) * specSoft * 0.15;

    // ─── Sun path glitter ──────────────────────────────────────────
    // Sparkling micro-reflections along the sun path
    float glitterNoise = fbm(samplePos * 40.0 + uTime * 0.05);
    float sunPath = pow(max(dot(reflect(-viewDir, normal), normalize(uLightDir)), 0.0), 16.0);
    float glitter = step(0.72, glitterNoise) * sunPath * 0.6;
    color += vec3(1.0, 0.95, 0.85) * glitter;

    // ─── Foam / whitecaps ──────────────────────────────────────────
    // Foam appears on wave peaks in shallow areas
    float foamNoise = fbm(samplePos * 12.0 + vec3(uTime * 0.02, 0.0, 0.0));
    float foamMask = smoothstep(0.58, 0.72, foamNoise) * smoothstep(0.55, 0.75, depthGrade);
    color = mix(color, vec3(0.85, 0.9, 0.95), foamMask * 0.5);

    // ─── Polar ice caps ────────────────────────────────────────────
    float polar = smoothstep(0.7, 0.95, abs(phi) / 1.57);
    vec3 iceColor = vec3(0.85, 0.92, 1.0);
    float iceEdgeNoise = fbm(samplePos * 6.0);
    float iceEdge = smoothstep(0.35, 0.65, iceEdgeNoise);
    color = mix(color, iceColor, polar * iceEdge);

    // Use wave-perturbed normal for lighting (use normal for non-water bits)
    normal = mix(waveNormal, normal, polar);
    diffuse = max(dot(normal, normalize(uLightDir)), 0.0);
    light = ambient + diffuse * 0.92;
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
