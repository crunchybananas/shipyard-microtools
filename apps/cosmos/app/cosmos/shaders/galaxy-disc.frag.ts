export const GALAXY_DISC_FRAG = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 fragColor;

uniform vec2 uResolution;
uniform vec2 uCenterPx;   // galaxy center in pixel coords
uniform float uRadiusPx;  // galaxy radius in pixels
uniform float uRotation;
uniform float uTilt;
uniform float uArmCount;
uniform float uArmDef;     // arm definition 0..1
uniform float uBrightness;
uniform float uSeed;
uniform float uGalaxyType; // 0=spiral, 1=elliptical, 2=irregular

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
  for (int i = 0; i < 5; i++) {
    v += noise(p) * a;
    p = rot * p * 2.1;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 fragCoord = vUV * uResolution;
  vec2 delta = fragCoord - uCenterPx;

  // Undo tilt (squash Y)
  delta.y /= uTilt;

  float dist = length(delta);
  if (dist > uRadiusPx * 1.3) discard;

  // Normalize to 0..1 from center
  float r = dist / uRadiusPx;

  // Polar angle
  float angle = atan(delta.y, delta.x) - uRotation;

  // Radial falloff: soft fade to zero at edges
  float radialFade = 1.0 - smoothstep(0.6, 1.2, r);

  float density = 0.0;

  if (uGalaxyType < 0.5) {
    // Spiral galaxy
    float arms = uArmCount;
    float spiral = angle * arms / 6.28318 - r * 3.0 * uArmDef;
    float armPattern = 0.5 + 0.5 * cos(spiral * 6.28318);
    armPattern = pow(armPattern, 1.5);

    // Add noise for dust lanes
    float dustNoise = fbm(vec2(angle * 3.0 + uSeed, r * 8.0 + uSeed * 0.7));
    armPattern *= 0.7 + dustNoise * 0.6;

    // Core concentration
    float core = exp(-r * r * 8.0);

    // Disc density
    float disc = (1.0 - smoothstep(0.0, 1.0, r)) * 0.3;

    density = max(armPattern * (1.0 - r * 0.5), disc) * radialFade + core * 0.8;
  } else if (uGalaxyType < 1.5) {
    // Elliptical galaxy: smooth Sersic-like profile
    float sersic = exp(-3.67 * (pow(r, 0.25) - 1.0));
    float noise1 = fbm(vec2(angle * 2.0 + uSeed, r * 4.0)) * 0.15;
    density = sersic * radialFade * (0.85 + noise1);
  } else {
    // Irregular galaxy: noisy clumps
    float clumps = fbm(vec2(angle * 2.0 + uSeed * 3.0, r * 5.0 + uSeed));
    float core = exp(-r * r * 4.0);
    density = (clumps * 0.5 + core * 0.5) * radialFade;
  }

  // Color: warm core → blue arms
  vec3 coreColor = vec3(1.0, 0.92, 0.7);
  vec3 armColor = vec3(0.5, 0.6, 1.0);
  vec3 color = mix(armColor, coreColor, exp(-r * r * 4.0));

  // Dust reddening in arms
  float dust = fbm(vec2(angle * 4.0 + uSeed * 1.3, r * 10.0));
  color = mix(color, vec3(0.9, 0.4, 0.3), dust * 0.15 * (1.0 - exp(-r * 3.0)));

  float alpha = density * uBrightness * 0.4;
  alpha = clamp(alpha, 0.0, 0.5);

  if (alpha < 0.002) discard;

  fragColor = vec4(color * alpha, alpha);
}`;
