export const ATMOSPHERE_FRAG = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 fragColor;

uniform vec2 uResolution;
uniform float uAltitude; // 0 = space, 1 = surface
uniform float uDensity;
uniform float uHue;
uniform vec3 uStarColor;
uniform float uTime;
uniform float uPlanetRadius;

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
  vec2 ndc = uv * 2.0 - 1.0;
  ndc.x *= uResolution.x / uResolution.y;
  float distFromCenter = length(ndc);

  // Sky color from hue
  float hRad = uHue / 360.0;
  vec3 skyZenith = vec3(
    0.5 + 0.5 * cos(6.28318 * (hRad + 0.0)),
    0.5 + 0.5 * cos(6.28318 * (hRad + 0.333)),
    0.5 + 0.5 * cos(6.28318 * (hRad + 0.667))
  ) * 0.5;

  vec3 skyHorizon = mix(skyZenith * 1.5, uStarColor * 0.7, 0.3);

  // How much sky vs space
  float skyAlpha = uAltitude * uDensity;

  // Planet curvature: shows planet rim from orbit, then opens to sky
  float limb = 1.0;
  if (uAltitude < 0.7) {
    float horizonRadius = mix(0.3, 2.5, uAltitude);
    limb = smoothstep(horizonRadius + 0.15, horizonRadius - 0.1, distFromCenter);
  }

  // Simulate looking down at planet → horizon → sky transition
  // At low altitude, lower portion = planet surface, upper = sky
  float horizonLine = mix(-0.5, 0.3, uAltitude);
  float skyGradient = smoothstep(horizonLine - 0.3, horizonLine + 0.5, ndc.y);

  // Atmosphere gradient
  vec3 atmosphere = mix(skyHorizon, skyZenith, sqrt(max(skyGradient, 0.0)));

  // Horizon glow (warm band near horizon line)
  float horizonDist = abs(ndc.y - horizonLine);
  float horizonGlow = exp(-horizonDist * horizonDist * 8.0) * uDensity;
  atmosphere += uStarColor * horizonGlow * 0.3;

  atmosphere *= limb;

  // Stars visible through thin atmosphere
  float starVisibility = (1.0 - skyAlpha) * smoothstep(horizonLine, horizonLine + 0.5, ndc.y);
  vec2 starUV = uv * uResolution / 3.0;
  vec2 cell = floor(starUV);
  float starHash = hash(cell);
  float starBrightness = 0.0;
  if (starHash > 0.985) {
    vec2 starPos = (cell + vec2(hash(cell + 1.0), hash(cell + 2.0))) / (uResolution / 3.0);
    float d = length(uv - starPos) * uResolution.x / 3.0;
    starBrightness = 0.3 * smoothstep(1.5, 0.0, d) * starVisibility;
  }

  // Cloud layers visible from above during descent
  float cloudAlpha = 0.0;
  if (uDensity > 0.2 && uAltitude > 0.2) {
    vec2 cloudUV = uv * 6.0 + vec2(uTime * 0.015, uTime * 0.008);
    float clouds = cloudFBM(cloudUV);
    // Clouds visible below horizon when looking down from orbit
    float cloudBand = smoothstep(horizonLine + 0.1, horizonLine - 0.3, ndc.y);
    cloudAlpha = smoothstep(0.4, 0.65, clouds) * uDensity * cloudBand * 0.6;

    // Cloud shadow / lighting
    float cloudLit = cloudFBM(cloudUV + vec2(0.03, 0.02));
    vec3 cloudColor = mix(vec3(0.6), vec3(1.0, 0.98, 0.95), smoothstep(0.5, 0.4, cloudLit));
    atmosphere = mix(atmosphere, cloudColor, cloudAlpha);
  }

  // Entry heat effect at high speed (low altitude, high density)
  if (uAltitude > 0.4 && uAltitude < 0.8) {
    float entryIntensity = smoothstep(0.4, 0.6, uAltitude) * smoothstep(0.8, 0.6, uAltitude);
    float edgeGlow = smoothstep(0.7, 1.2, distFromCenter) * entryIntensity;
    atmosphere += vec3(1.0, 0.4, 0.1) * edgeGlow * 0.3 * uDensity;
  }

  vec3 finalColor = atmosphere * skyAlpha + vec3(starBrightness);

  float alpha = max(skyAlpha * limb, starBrightness);
  alpha = max(alpha, cloudAlpha);

  fragColor = vec4(finalColor, clamp(alpha, 0.0, 1.0));
}`;
