export const PARTICLE_VERT = `#version 300 es
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
