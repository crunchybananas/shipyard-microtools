export const TERRAIN_FRAG = `#version 300 es
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
uniform float uLookAngle;
uniform float uLookPitch;

// ─── Noise ──────────────────────────────────────────────────────────────────

float hash21(vec2 p) {
  p = fract(p * vec2(443.8975, 397.2973));
  p += dot(p, p + 19.19);
  return fract(p.x * p.y);
}

float hash31(vec3 p) {
  p = fract(p * vec3(443.8975, 397.2973, 491.1871));
  p += dot(p, p.yzx + 19.19);
  return fract((p.x + p.y) * p.z);
}

float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1, 0));
  float c = hash21(i + vec2(0, 1));
  float d = hash21(i + vec2(1, 1));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
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

// Terrain heightmap: position + seed → height
float terrainHeight(vec2 p) {
  vec3 sp = vec3(p, uSeed * 7.31);
  float val = 0.0;
  float amp = 0.5;
  float freq = 1.0;
  for (int i = 0; i < 10; i++) {
    val += noise3(sp * freq) * amp;
    freq *= 2.03;
    amp *= 0.5 * (0.4 + uRoughness * 0.6);
  }
  // Ridge features for mountain realism
  float ridge = 1.0 - abs(noise3(sp * 3.7 + 100.0) * 2.0 - 1.0);
  ridge *= ridge;
  val += ridge * 0.15 * uRoughness;
  return val;
}

// ─── Sky ────────────────────────────────────────────────────────────────────

vec3 getSkyColor(vec3 rd, vec3 sunDir) {
  float hRad = uAtmosphereHue / 360.0;
  vec3 skyZenith = vec3(
    0.5 + 0.5 * cos(6.28318 * (hRad + 0.0)),
    0.5 + 0.5 * cos(6.28318 * (hRad + 0.333)),
    0.5 + 0.5 * cos(6.28318 * (hRad + 0.667))
  ) * 0.55 * uAtmosphereDensity;

  vec3 skyHorizon = mix(skyZenith * 1.6, vec3(0.85, 0.75, 0.6), 0.35);

  // Vertical gradient: horizon → zenith
  float vert = max(rd.y, 0.0);
  vec3 sky = mix(skyHorizon, skyZenith, sqrt(vert));

  // Sun disc and glow
  float sunDot = max(dot(rd, sunDir), 0.0);
  // Sun disc
  sky += vec3(1.0, 0.95, 0.8) * pow(sunDot, 256.0) * 2.0;
  // Inner glow
  sky += vec3(1.0, 0.8, 0.5) * pow(sunDot, 32.0) * 0.4;
  // Outer glow
  sky += vec3(1.0, 0.6, 0.3) * pow(sunDot, 4.0) * 0.15 * uAtmosphereDensity;

  // Stars in thin atmospheres
  if (uAtmosphereDensity < 0.3) {
    float starVis = (0.3 - uAtmosphereDensity) / 0.3;
    vec2 starUV = rd.xz / (rd.y + 0.01) * 300.0;
    float star = step(0.992, hash21(floor(starUV)));
    sky += vec3(star * starVis * 0.6);
  }

  return sky;
}

// ─── Clouds ─────────────────────────────────────────────────────────────────

float cloudDensity(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  vec2 q = p;
  for (int i = 0; i < 5; i++) {
    v += noise2(q) * a;
    q = q * 2.1 + vec2(1.7, 3.2);
    a *= 0.5;
  }
  return v;
}

// ─── Main Raymarcher ────────────────────────────────────────────────────────

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 ndc = uv * 2.0 - 1.0;
  ndc.x *= uResolution.x / uResolution.y;

  // Camera setup: first-person on the terrain surface
  float camScale = 0.3;
  vec2 camWorld = uCameraPos * camScale;

  // Camera height: sample terrain below camera + eye height
  float camTerrainH = terrainHeight(camWorld);
  float eyeHeight = 0.04;
  float camY = max(camTerrainH, uWaterLevel) + eyeHeight;

  vec3 camPos = vec3(camWorld.x, camY, camWorld.y);

  // Look direction: controlled by keyboard / mouse
  float lookAngle = uLookAngle;
  vec3 forward = normalize(vec3(cos(lookAngle), uLookPitch, sin(lookAngle)));
  vec3 right = normalize(cross(forward, vec3(0, 1, 0)));
  vec3 up = cross(right, forward);

  // FOV ~75 degrees
  float fov = 1.2;
  vec3 rd = normalize(forward * fov + right * ndc.x + up * ndc.y);

  // Sun direction
  vec3 sunDir = normalize(uLightDir);
  if (sunDir.y < 0.05) sunDir.y = 0.05; // Keep sun above horizon

  // ─── Raymarching the heightfield ─────────────────────────────────────

  vec3 color = getSkyColor(rd, sunDir);
  float hitDist = -1.0;
  vec3 hitPos = vec3(0.0);

  if (rd.y < 0.3) { // Only raymarch if looking toward ground
    float t = 0.0;
    float dt = 0.005;
    bool hit = false;
    vec3 p;

    for (int i = 0; i < 200; i++) {
      p = camPos + rd * t;
      float h = terrainHeight(p.xz);

      // Water acts as a floor
      h = max(h, uWaterLevel);

      if (p.y < h) {
        // Binary search for precise intersection
        float tLo = t - dt;
        float tHi = t;
        for (int j = 0; j < 8; j++) {
          float tMid = (tLo + tHi) * 0.5;
          vec3 pm = camPos + rd * tMid;
          float hm = max(terrainHeight(pm.xz), uWaterLevel);
          if (pm.y < hm) { tHi = tMid; } else { tLo = tMid; }
        }
        t = (tLo + tHi) * 0.5;
        hitPos = camPos + rd * t;
        hitDist = t;
        hit = true;
        break;
      }

      // Adaptive step: bigger steps when far from terrain
      dt = max(0.005, (p.y - h) * 0.4);
      t += dt;
      if (t > 30.0) break;
    }

    if (hit) {
      float rawHeight = terrainHeight(hitPos.xz);
      bool isWater = rawHeight < uWaterLevel;

      // ─── Compute normal ──────────────────────────────────────────

      vec3 normal;
      float eps = 0.002;

      if (isWater) {
        // Water normals computed in the water shading section below
        normal = vec3(0.0, 1.0, 0.0); // placeholder, overridden by Gerstner waves
      } else {
        float hx = terrainHeight(hitPos.xz + vec2(eps, 0.0));
        float hz = terrainHeight(hitPos.xz + vec2(0.0, eps));
        normal = normalize(vec3(rawHeight - hx, eps, rawHeight - hz));
      }

      // ─── Shading ─────────────────────────────────────────────────

      float diffuse = max(dot(normal, sunDir), 0.0);
      float ambient = 0.12;

      if (isWater) {
        // ─── Enhanced Water Surface ────────────────────────────────
        float depth = (uWaterLevel - rawHeight) * 4.0;
        float depthClamped = clamp(depth, 0.0, 1.0);

        // ── Gerstner-style wave normals ────────────────────────────
        // Multiple wave trains at different frequencies and directions
        float t = uTime;
        vec2 wp = hitPos.xz;

        // Wave parameters: direction, frequency, amplitude, speed
        // Wave 1: primary swell
        vec2 d1 = normalize(vec2(0.8, 0.6));
        float w1f = 45.0; float w1a = 0.0035; float w1s = 0.5;
        float w1p = dot(wp, d1) * w1f + t * w1s;
        float w1 = w1a * sin(w1p);
        vec2 w1n = d1 * w1a * w1f * cos(w1p);

        // Wave 2: cross swell
        vec2 d2 = normalize(vec2(-0.4, 0.9));
        float w2f = 72.0; float w2a = 0.002; float w2s = 0.7;
        float w2p = dot(wp, d2) * w2f + t * w2s;
        float w2 = w2a * sin(w2p);
        vec2 w2n = d2 * w2a * w2f * cos(w2p);

        // Wave 3: wind chop
        vec2 d3 = normalize(vec2(0.3, -0.7));
        float w3f = 130.0; float w3a = 0.001; float w3s = 1.1;
        float w3p = dot(wp, d3) * w3f + t * w3s;
        float w3 = w3a * sin(w3p);
        vec2 w3n = d3 * w3a * w3f * cos(w3p);

        // Wave 4: ripples
        vec2 d4 = normalize(vec2(-0.6, -0.3));
        float w4f = 200.0; float w4a = 0.0006; float w4s = 1.5;
        float w4p = dot(wp, d4) * w4f + t * w4s;
        float w4 = w4a * sin(w4p);
        vec2 w4n = d4 * w4a * w4f * cos(w4p);

        // Combine wave normals
        vec2 waveGrad = w1n + w2n + w3n + w4n;
        float waveHeight = w1 + w2 + w3 + w4;
        normal = normalize(vec3(-waveGrad.x, 1.0, -waveGrad.y));

        // ── Depth-based water coloring (Beer's Law absorption) ─────
        // Light absorption: red absorbed first, blue penetrates deepest
        vec3 absorptionCoeff = vec3(0.45, 0.09, 0.06); // per-channel
        vec3 depthAbsorption = exp(-absorptionCoeff * depth * 8.0);

        // Seabed color visible in shallows
        vec3 seabedColor = uBaseColor * 0.6;
        float underwaterVis = exp(-depth * 3.0);
        vec3 seabedContrib = seabedColor * depthAbsorption * underwaterVis;

        // Water body color
        vec3 deepWater = uWaterColor * 0.35 * depthAbsorption;
        vec3 shallowWater = uWaterColor * 1.2 + vec3(0.05, 0.12, 0.06);
        color = mix(shallowWater, deepWater, depthClamped);
        color += seabedContrib * 0.5; // Blend in seabed in shallows

        // ── Subsurface scattering ──────────────────────────────────
        // Light passing through wave crests creates green-blue glow
        float NdotL = dot(normal, sunDir);
        float sssWrap = pow(clamp(-NdotL * 0.5 + 0.5, 0.0, 1.0), 2.0);
        float crestThinness = clamp(waveHeight * 80.0 + 0.5, 0.0, 1.0);
        vec3 sssColor = vec3(0.0, 0.55, 0.4) * sssWrap * crestThinness * 0.5;
        // Stronger SSS in shallows where light bounces off seabed
        sssColor *= 1.0 + underwaterVis * 0.6;
        color += sssColor;

        // ── Fresnel reflection ─────────────────────────────────────
        float NdotV = max(dot(normal, -rd), 0.0);
        // Schlick approximation (water IOR ≈ 1.33, F0 ≈ 0.02)
        float fresnel = 0.02 + 0.98 * pow(1.0 - NdotV, 5.0);
        vec3 reflected = getSkyColor(reflect(rd, normal), sunDir);
        color = mix(color, reflected, fresnel * 0.65);

        // ── Specular highlights ────────────────────────────────────
        vec3 halfDir = normalize(sunDir - rd);
        float NdotH = max(dot(normal, halfDir), 0.0);
        // Sharp sun glint (pinpoint sparkles)
        float specHard = pow(NdotH, 512.0);
        // Broader sun path glow
        float specSoft = pow(NdotH, 48.0);
        // Wide ambient sheen
        float specWide = pow(NdotH, 8.0);
        color += vec3(1.0, 0.97, 0.92) * specHard * 2.0;
        color += vec3(1.0, 0.92, 0.75) * specSoft * 0.25;
        color += vec3(1.0, 0.9, 0.7) * specWide * 0.04;

        // ── Sun path on water ──────────────────────────────────────
        float sunRefl = pow(max(dot(reflect(rd, vec3(0, 1, 0)), sunDir), 0.0), 64.0);
        color += vec3(1.0, 0.85, 0.6) * sunRefl * 0.35;

        // ── Micro-glitter along sun path ───────────────────────────
        float glitterNoise = noise2(wp * 400.0 + t * vec2(0.3, -0.2));
        float sunPathStr = pow(max(dot(reflect(rd, normal), sunDir), 0.0), 24.0);
        float glitter = step(0.82, glitterNoise) * sunPathStr;
        color += vec3(1.0, 0.95, 0.85) * glitter * 0.5;

        // ── Foam / whitecaps ───────────────────────────────────────
        // Shore foam
        float shoreFoam = 0.0;
        if (depth < 0.15) {
          float foamPattern = noise2(wp * 80.0 + t * vec2(0.15, 0.1));
          float foamPattern2 = noise2(wp * 150.0 - t * vec2(0.1, 0.2));
          shoreFoam = smoothstep(0.15, 0.0, depth)
            * (smoothstep(0.35, 0.55, foamPattern) + smoothstep(0.4, 0.6, foamPattern2) * 0.5);
          shoreFoam = clamp(shoreFoam, 0.0, 1.0);
        }

        // Open-water whitecaps on wave crests
        float crestFoam = 0.0;
        float crestNoise = noise2(wp * 60.0 + t * vec2(0.2, 0.15));
        crestFoam = smoothstep(0.6, 0.8, crestNoise) * smoothstep(0.0015, 0.003, waveHeight);

        float totalFoam = clamp(shoreFoam + crestFoam, 0.0, 1.0);
        vec3 foamColor = vec3(0.88, 0.92, 0.95);
        // Foam catches sunlight
        float foamLight = ambient + max(dot(vec3(0, 1, 0), sunDir), 0.0) * 0.85;
        color = mix(color, foamColor * foamLight, totalFoam * 0.7);

        // ── Caustics on shallow seabed ─────────────────────────────
        if (depth < 0.3) {
          // Voronoi-like caustic pattern
          vec2 cUV = wp * 100.0 + t * vec2(0.2, 0.15);
          float c1 = noise2(cUV);
          float c2 = noise2(cUV * 1.4 + 50.0);
          float caustic = pow(c1 * c2, 1.5) * 3.0;
          float causticStr = (1.0 - depthClamped * 3.3) * caustic;
          // Caustics are brightest in sunlit areas
          color += vec3(0.06, 0.1, 0.14) * causticStr * max(sunDir.y, 0.0);
        }

        color *= (ambient + max(dot(normal, sunDir), 0.0) * 0.7);
      } else {
        // ─── Land surface ──────────────────────────────────────────
        float normalizedH = (rawHeight - uWaterLevel) / max(1.0 - uWaterLevel, 0.001);
        float slope = 1.0 - normal.y; // Steepness

        // Base terrain color from height
        color = mix(uBaseColor, uAccentColor, smoothstep(0.0, 0.8, normalizedH));

        // Vegetation
        if (uHasVegetation > 0.5 && normalizedH > 0.02 && normalizedH < 0.45 && slope < 0.5) {
          float vegNoise = noise2(hitPos.xz * 30.0 + uSeed);
          float vegStrength = smoothstep(0.02, 0.15, normalizedH)
                            * smoothstep(0.45, 0.25, normalizedH)
                            * smoothstep(0.5, 0.2, slope);
          color = mix(color, uVegetationColor * (0.8 + vegNoise * 0.4), vegStrength * 0.8);
        }

        // Rocky exposed on steep slopes
        if (slope > 0.3) {
          float rockMix = smoothstep(0.3, 0.6, slope);
          vec3 rockColor = uAccentColor * 0.6;
          color = mix(color, rockColor, rockMix * 0.7);
        }

        // Snow caps
        if (normalizedH > 0.6) {
          float snowLine = smoothstep(0.6, 0.8, normalizedH);
          float snowSlope = smoothstep(0.5, 0.2, slope); // Less snow on steep faces
          float snowNoise = noise2(hitPos.xz * 50.0) * 0.3;
          color = mix(color, vec3(0.92, 0.95, 1.0), snowLine * snowSlope * (0.7 + snowNoise));
        }

        // Beach / shore
        if (uWaterLevel > 0.01 && normalizedH < 0.04) {
          float beachMix = smoothstep(0.04, 0.0, normalizedH);
          vec3 sandColor = vec3(0.82, 0.76, 0.6);
          color = mix(color, sandColor, beachMix);
        }

        // Lighting
        color *= ambient + diffuse * 0.88;

        // Shadow side gets sky color bounce
        if (diffuse < 0.1) {
          float hRad = uAtmosphereHue / 360.0;
          vec3 skyBounce = vec3(
            0.5 + 0.5 * cos(6.28318 * (hRad + 0.0)),
            0.5 + 0.5 * cos(6.28318 * (hRad + 0.333)),
            0.5 + 0.5 * cos(6.28318 * (hRad + 0.667))
          ) * 0.08 * uAtmosphereDensity;
          color += skyBounce * (1.0 - diffuse / 0.1);
        }

        // Terrain detail noise to break up flatness
        float detail = noise2(hitPos.xz * 200.0) * 0.08 - 0.04;
        color += detail;
      }

      // ─── Atmospheric fog (distance-based) ──────────────────────────

      float fogDist = hitDist / 30.0;
      float fog = 1.0 - exp(-fogDist * fogDist * 3.0 * uAtmosphereDensity);
      vec3 fogColor = getSkyColor(rd, sunDir);
      color = mix(color, fogColor, clamp(fog, 0.0, 0.95));
    }
  }

  // ─── Clouds (rendered above terrain) ─────────────────────────────────

  if (uAtmosphereDensity > 0.15 && rd.y > 0.0) {
    // Clouds at a fixed altitude above camera
    float cloudAlt = camY + 1.5;
    float tCloud = (cloudAlt - camPos.y) / rd.y;
    if (tCloud > 0.0 && (hitDist < 0.0 || tCloud < hitDist)) {
      vec3 cloudPos = camPos + rd * tCloud;
      vec2 cloudUV = cloudPos.xz * 2.0 + vec2(uTime * 0.015, uTime * 0.008);
      float density = cloudDensity(cloudUV);
      float cloudShape = smoothstep(0.42, 0.7, density);

      // Cloud lighting
      float cloudShadow = smoothstep(0.6, 0.4, cloudDensity(cloudUV + sunDir.xz * 0.05));
      vec3 cloudColor = mix(vec3(0.6, 0.6, 0.65), vec3(1.0, 0.98, 0.95), cloudShadow);

      // Sun-side illumination
      float cloudSunDot = max(dot(rd, sunDir), 0.0);
      cloudColor += vec3(1.0, 0.9, 0.7) * pow(cloudSunDot, 8.0) * 0.2;

      float cloudAlpha = cloudShape * uAtmosphereDensity * 0.7;

      // Distance fade
      float cloudDist = tCloud / 25.0;
      cloudAlpha *= exp(-cloudDist * cloudDist);

      color = mix(color, cloudColor, clamp(cloudAlpha, 0.0, 0.85));
    }
  }

  // Gamma correction
  color = pow(color, vec3(1.0 / 2.2));

  fragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}`;
