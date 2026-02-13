export const BLOOM_BRIGHT_FRAG = `#version 300 es
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
