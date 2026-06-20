// shaders.js — hand-written GLSL: ocean, sky, light beams, bioluminescence.
// One water material is shared by the real sea and the chart-table sea:
// everything is computed in object space, so the 1:240 clone displaces
// 1:240 waves for free.

import * as THREE from 'three';

const GLSL_NOISE = /* glsl */`
  float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i), b = hash21(i + vec2(1, 0));
    float c = hash21(i + vec2(0, 1)), d = hash21(i + vec2(1, 1));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float fbm2(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; }
    return s;
  }
`;

// ---------------------------------------------------------------- water -----
export function makeWaterMaterial(heightTex, domain) {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    extensions: { derivatives: true }, // fwidth on WebGL1 fallbacks
    uniforms: {
      uTime: { value: 0 },
      uWaterY: { value: 0 },
      uHeightTex: { value: heightTex },
      uDomain: { value: domain },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunCol: { value: new THREE.Color(0xfff4e0) },
      uDeep: { value: new THREE.Color(0x15454f) },
      uShallow: { value: new THREE.Color(0x4fae9d) },
      uSkyCol: { value: new THREE.Color(0xbfe0ee) },
      uFogColor: { value: new THREE.Color(0xcfe3e8) },
      uFogDen: { value: 0.003 },
      uNight: { value: 0 },
    },
    vertexShader: /* glsl */`
      uniform float uTime;
      uniform float uWaterY;
      varying vec3 vLocal;     // object-space position after waves
      varying vec3 vWorld;
      varying vec3 vNorm;

      // three gerstner-ish waves, object space
      vec3 wave(vec2 p, float t) {
        float h = 0.0;
        vec2 d1 = normalize(vec2(1.0, 0.4));
        vec2 d2 = normalize(vec2(-0.6, 1.0));
        vec2 d3 = normalize(vec2(0.3, -1.0));
        h += 0.22 * sin(dot(p, d1) * 0.10 + t * 1.00);
        h += 0.14 * sin(dot(p, d2) * 0.19 + t * 1.45);
        h += 0.07 * sin(dot(p, d3) * 0.37 + t * 2.1);
        return vec3(0.0, h, 0.0);
      }

      void main() {
        vec3 p = position;
        p.y += uWaterY;
        p += wave(position.xz, uTime);
        // cheap analytic-ish normal from neighbours
        float e = 2.0;
        float hx = wave(position.xz + vec2(e, 0.0), uTime).y - wave(position.xz - vec2(e, 0.0), uTime).y;
        float hz = wave(position.xz + vec2(0.0, e), uTime).y - wave(position.xz - vec2(0.0, e), uTime).y;
        vNorm = normalize(vec3(-hx / (2.0 * e), 1.0, -hz / (2.0 * e)));
        vLocal = p;
        vec4 w = modelMatrix * vec4(p, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D uHeightTex;
      uniform float uDomain;
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uSunCol;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uSkyCol;
      uniform vec3 uFogColor;
      uniform float uFogDen;
      uniform float uNight;
      varying vec3 vLocal;
      varying vec3 vWorld;
      varying vec3 vNorm;
      ${GLSL_NOISE}

      void main() {
        // vertex-registered data: remap so texel centers land on grid points
        vec2 uv = (vLocal.xz / uDomain + 0.5) * (255.0 / 256.0) + 0.5 / 256.0;
        float terrainH = texture2D(uHeightTex, uv).r;
        float depth = vLocal.y - terrainH;
        if (depth < 0.02) discard;

        // instance scale, sensed per-pixel from the world/object derivative
        // ratio: ~1.0 on the sea, ~1/240 on the chart-table model. The
        // material is shared by design — this is how the model gets calmer
        // water without a clone. View-independent, so the world's grazing
        // glitter path keeps its full sparkle at any distance.
        float scl = (fwidth(vWorld.x) + fwidth(vWorld.z)) / max(fwidth(vLocal.x) + fwidth(vLocal.z), 1e-6);
        float mini = 1.0 - smoothstep(0.05, 0.5, scl);

        // ripple normal detail — gentled at 1:240 where it reads as chalk
        vec2 rp = vLocal.xz * 0.35 + vec2(uTime * 0.07, -uTime * 0.05);
        float r1 = fbm2(rp);
        float r2 = fbm2(rp * 1.7 + 19.0 + vec2(-uTime * 0.06, uTime * 0.04));
        vec3 N = normalize(vNorm + vec3(r1 - 0.5, 0.0, r2 - 0.5) * 0.45 * mix(1.0, 0.55, mini));

        vec3 V = normalize(cameraPosition - vWorld);
        float fresnel = pow(1.0 - max(dot(V, N), 0.0), 3.0);

        // body color by depth
        float dfac = 1.0 - exp(-depth * 0.32);
        vec3 body = mix(uShallow, uDeep, dfac);

        // sky reflection
        vec3 col = mix(body, uSkyCol, fresnel * 0.75);

        // sun glitter — damped to a sheen on the model, full at sea
        vec3 R = reflect(-normalize(uSunDir), N);
        float spec = pow(max(dot(R, V), 0.0), 220.0) * smoothstep(-0.05, 0.12, uSunDir.y);
        col += uSunCol * spec * 2.4 * mix(1.0, 0.16, mini);
        // moon-glitter at night
        col += vec3(0.55, 0.65, 0.8) * pow(max(dot(R, V), 0.0), 350.0) * uNight * 1.2 * mix(1.0, 0.16, mini);

        // shoreline foam
        float foamBand = 1.0 - smoothstep(0.0, 0.85, depth + (r1 - 0.5) * 0.4);
        float foamPulse = 0.65 + 0.35 * sin(uTime * 1.3 + vLocal.x * 0.18 + vLocal.z * 0.13);
        float foam = foamBand * foamPulse;
        col = mix(col, vec3(0.93, 0.96, 0.94), clamp(foam, 0.0, 1.0) * 0.85);

        // alpha: clear at the very shore, solid over depth
        float alpha = clamp(0.55 + dfac * 0.45 + fresnel * 0.2 + foam * 0.4, 0.0, 0.96);
        alpha *= smoothstep(0.02, 0.3, depth);

        // manual exp2 fog (world space)
        float fogF = 1.0 - exp(-pow(length(cameraPosition - vWorld) * uFogDen, 2.0));
        col = mix(col, uFogColor, fogF);

        gl_FragColor = vec4(col, alpha);
        #include <colorspace_fragment>
      }
    `,
  });
  mat.name = 'waterMat';
  return mat;
}

// ------------------------------------------------------------------ sky -----
export function makeSkyMaterial() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
      uSunCol: { value: new THREE.Color(0xfff4e0) },
      uTop: { value: new THREE.Color(0x3a7ab8) },
      uHorizon: { value: new THREE.Color(0xbfe0ee) },
      uNight: { value: 0 },
      uFlash: { value: 0 },
      uMist: { value: 0 },
      // the credits constellation: five stars that learn to burn, one per
      // note of the leitmotif (lit by the finale; zero cost while dark)
      uConstelDir: { value: [
        new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(),
        new THREE.Vector3(), new THREE.Vector3()] },
      uConstelGlow: { value: new Float32Array(5) },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 w = modelMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewMatrix * w;
        gl_Position.z = gl_Position.w; // pin to far plane
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uMoonDir;
      uniform vec3 uSunCol;
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform float uNight;
      uniform float uFlash;
      uniform float uMist;
      uniform vec3 uConstelDir[5];
      uniform float uConstelGlow[5];
      varying vec3 vDir;
      ${GLSL_NOISE}

      void main() {
        vec3 d = normalize(vDir);
        float up = max(d.y, 0.0);

        // base gradient
        vec3 col = mix(uHorizon, uTop, pow(up, 0.55));
        // below the horizon: deep sea haze
        col = mix(col, uHorizon * 0.55, smoothstep(0.0, -0.25, d.y));

        float sunDot = dot(d, normalize(uSunDir));

        // sun disc + halo
        float disc = smoothstep(0.9996, 0.99985, sunDot);
        float halo = pow(max(sunDot, 0.0), 24.0) * 0.5 + pow(max(sunDot, 0.0), 220.0) * 0.8;
        col += uSunCol * (disc * 2.6 + halo) * smoothstep(-0.18, 0.0, uSunDir.y + 0.06);

        // the green flash: a narrow emerald sliver when the sun kisses the sea
        col += vec3(0.1, 1.0, 0.55) * uFlash * pow(max(sunDot, 0.0), 700.0) * 3.0;

        // moon: small disc with lambert phase shading
        vec3 md = normalize(uMoonDir);
        float moonDot = dot(d, md);
        if (moonDot > 0.9997 && md.y > -0.1) {
          // fake sphere normal at this point of the disc
          vec3 t1 = normalize(cross(md, vec3(0.0, 1.0, 0.0)));
          vec3 t2 = cross(md, t1);
          float px = dot(d - md, t1) / 0.025, py = dot(d - md, t2) / 0.025;
          float rr = px * px + py * py;
          if (rr < 1.0) {
            vec3 mn = normalize(t1 * px + t2 * py + md * sqrt(1.0 - rr));
            float lit = max(dot(mn, normalize(uSunDir)) * -1.0, 0.04);
            float crater = 0.85 + 0.15 * vnoise(vec2(px, py) * 5.0);
            col = mix(col, vec3(0.86, 0.88, 0.92) * lit * crater + uHorizon * 0.05, 0.95);
          }
        }

        // stars + milky way
        if (uNight > 0.01 && d.y > -0.1) {
          vec2 sp = d.xz / (d.y + 0.4);
          vec2 sg = sp * 280.0;
          vec2 cid = floor(sg);
          float sh = hash21(cid);
          // a small round star jittered inside its cell — lighting the WHOLE cell (the old
          // step()) made the stars square and lattice-aligned, reading as a grid
          vec2 jit = 0.25 + 0.5 * vec2(hash21(cid + 3.7), hash21(cid + 9.1));
          float star = step(0.9965, sh) * smoothstep(0.12, 0.0, length(fract(sg) - jit));
          float tw = 0.6 + 0.4 * sin(uTime * 2.0 + sh * 40.0);
          // milky way band: distance to a tilted great circle
          vec3 mwN = normalize(vec3(0.6, 0.25, 0.76));
          float band = 1.0 - smoothstep(0.0, 0.5, abs(dot(d, mwN)));
          float wisps = fbm2(sp * 6.0) * band;
          col += vec3(0.8, 0.85, 1.0) * star * tw * uNight * smoothstep(0.0, 0.15, d.y);
          col += vec3(0.45, 0.5, 0.72) * wisps * wisps * uNight * 0.5;

          // the credits constellation — five stars in the stones' arc,
          // each igniting on its note of the leitmotif
          for (int i = 0; i < 5; i++) {
            float g = uConstelGlow[i];
            if (g > 0.001) {
              float a = max(dot(d, uConstelDir[i]), 0.0);
              col += vec3(1.0, 0.94, 0.8) * (pow(a, 60000.0) * 1.7 + pow(a, 9000.0) * 0.22) * g * uNight;
            }
          }
        }

        // drifting cirrus, tinted by the sun
        float cl = fbm2(d.xz / (up + 0.25) * 2.2 + vec2(uTime * 0.004, 0.0));
        float cirrus = smoothstep(0.55, 0.85, cl) * smoothstep(0.02, 0.2, up) * (1.0 - uNight * 0.85);
        col = mix(col, mix(uHorizon, uSunCol, 0.45) * 1.06, cirrus * 0.5);

        // sea fret: mist lifts a pale band off the horizon, veiling stars
        // and blue alike — the sky finally agrees with the fogged ground
        float fret = uMist * (1.0 - smoothstep(0.0, 0.4 + uMist * 0.25, d.y));
        col = mix(col, mix(uHorizon, vec3(0.78, 0.81, 0.83), 0.4) * mix(1.0, 0.35, uNight), fret * 0.85);

        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  mat.name = 'skyMat';
  return mat;
}

// ----------------------------------------------------------------- beam -----
export function makeBeamMaterial(color = 0xfff0c0) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uIntensity: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uTime: { value: 0 },
      uFlip: { value: 0 }, // 0: source at uv.y=0 (beam apex); 1: source at uv.y=1 (shaft top)
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vW;
      void main() {
        vUv = uv;
        vN = normalize(mat3(modelMatrix) * normal);
        vW = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uIntensity;
      uniform vec3 uColor;
      uniform float uTime;
      uniform float uFlip;
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vW;
      void main() {
        // t: normalized distance from the light source along the volume
        float t = mix(vUv.y, 1.0 - vUv.y, uFlip);
        float along = pow(1.0 - t, 1.4);
        float shimmer = 0.85 + 0.15 * sin(uTime * 3.0 + vUv.y * 40.0);
        // glancing fragments fade: the open cone's silhouette walls were
        // reading as two hard streaks — face-on light fills the body
        float facing = smoothstep(0.02, 0.32, abs(dot(normalize(vN), normalize(cameraPosition - vW))));
        float a = along * uIntensity * shimmer * 0.5 * facing;
        gl_FragColor = vec4(uColor, a);
        #include <colorspace_fragment>
      }
    `,
  });
}

// ----------------------------------------------------- glowing particles ----
// Used for bioluminescent pools (teal, flare near footsteps) and fireflies.
export function makeGlowPoints(positions, color, size = 0.5) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const seeds = new Float32Array(positions.length / 3);
  for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random() * 100;
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uPlayer: { value: new THREE.Vector3() },
      uGlobal: { value: 0 },     // overall visibility 0..1
      uFlare: { value: 6.0 },    // proximity flare radius
      uSize: { value: size },
      uDrift: { value: 0 },      // 1 = airborne drift (fireflies)
    },
    vertexShader: /* glsl */`
      attribute float aSeed;
      uniform float uTime;
      uniform vec3 uPlayer;
      uniform float uGlobal;
      uniform float uFlare;
      uniform float uSize;
      uniform float uDrift;
      varying float vA;
      void main() {
        vec3 p = position;
        p.x += sin(uTime * 0.7 + aSeed) * 0.6 * uDrift;
        p.y += sin(uTime * 0.9 + aSeed * 1.7) * 0.5 * uDrift;
        p.z += cos(uTime * 0.6 + aSeed * 0.9) * 0.6 * uDrift;
        vec4 w = modelMatrix * vec4(p, 1.0);
        float twinkle = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * (0.6 + fract(aSeed) * 1.4) + aSeed * 13.0), 2.0);
        float near = exp(-length(w.xyz - uPlayer) / uFlare);
        vA = uGlobal * twinkle * (0.25 + near * 1.6);
        vec4 mv = viewMatrix * w;
        gl_PointSize = uSize * (180.0 / -mv.z) * (0.6 + near);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      varying float vA;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        float a = smoothstep(0.5, 0.05, d) * vA;
        if (a < 0.003) discard;
        gl_FragColor = vec4(uColor, a);
        #include <colorspace_fragment>
      }
    `,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}
