export const PLANET_VERT = `#version 300 es
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
