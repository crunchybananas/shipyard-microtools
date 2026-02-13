export const NEBULA_FRAG = `#version 300 es
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
