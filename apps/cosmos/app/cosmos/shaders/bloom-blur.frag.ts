export const BLOOM_BLUR_FRAG = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 fragColor;
uniform sampler2D uTexture;
uniform vec2 uDirection;
uniform vec2 uResolution;

void main() {
  vec2 texelSize = 1.0 / uResolution;
  vec3 result = vec3(0.0);

  // 9-tap Gaussian
  float weights[5] = float[](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);

  result += texture(uTexture, vUV).rgb * weights[0];
  for (int i = 1; i < 5; i++) {
    vec2 offset = uDirection * texelSize * float(i) * 2.0;
    result += texture(uTexture, vUV + offset).rgb * weights[i];
    result += texture(uTexture, vUV - offset).rgb * weights[i];
  }

  fragColor = vec4(result, 1.0);
}`;
