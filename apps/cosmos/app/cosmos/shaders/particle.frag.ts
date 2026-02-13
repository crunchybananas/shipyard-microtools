export const PARTICLE_FRAG = `#version 300 es
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
