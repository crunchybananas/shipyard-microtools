export const BACKGROUND_FRAG = `#version 300 es
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
