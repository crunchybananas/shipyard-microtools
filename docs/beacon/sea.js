// Sea, sky and beam shaders for Beacon.
//
// VENDORED from docs/the-island/js/shaders.js — the three materials there that carry
// no dependency on the island's terrain or asset pipeline:
//
//   makeFarSeaMaterial  open ocean: drifting facets, sky-mirror Fresnel, an exp2 fog
//                       lane into the horizon, and a glitter road for sun AND moon
//   makeSkyMaterial     gradient dome with sun/moon discs and a night term
//   makeBeamMaterial    additive volumetric shaft for the lantern
//
// The island's OTHER water material (makeWaterMaterial) is deliberately not here: it
// samples a terrain heightmap and foam/ripple textures to blend a shoreline, and
// Beacon is all open water with no shore. Copied rather than imported because the two
// apps are independent deployables — Beacon must not break when the island changes.
// If a third app ever needs these, promote this file to docs/shared/ instead.

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

// #31: the water burned ~32 hash21 calls per pixel in fbm2 on the largest surface on
// screen. Bake the same 4-octave value-noise character ONCE into a 256² RG tile (two
// independent fields — the ripple pair decorrelates even better than two samples of
// one field) and fetch twice. Octave frequencies are integer cells per tile (4/8/16/32)
// so it wraps seamlessly; gain 0.5 matches fbm2's amplitude ladder (range ~0..0.9375).

export function makeFarSeaMaterial(wu) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: wu.uTime,
      uSunDir: wu.uSunDir,
      uSunCol: wu.uSunCol,
      uDeep: wu.uDeep,
      uSkyCol: wu.uSkyCol,
      uSkyTop: wu.uSkyTop,
      uFogColor: wu.uFogColor,
      uFogDen: wu.uFogDen,
      uNight: wu.uNight,
    },
    vertexShader: /* glsl */`
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uSunCol;
      uniform vec3 uDeep;
      uniform vec3 uSkyCol;
      uniform vec3 uSkyTop;
      uniform vec3 uFogColor;
      uniform float uFogDen;
      uniform float uNight;
      varying vec3 vWorld;
      ${GLSL_NOISE}

      void main() {
        vec3 V = normalize(cameraPosition - vWorld);
        float d = length(cameraPosition - vWorld);
        // drifting facets, two coarse scales (the near shader's fine facets alias out
        // here); modulation depth fades with range so the horizon lane stays smooth
        float att = 1.0 - smoothstep(500.0, 1800.0, d);
        float gph = uTime * 1.1;
        vec2 gp = vWorld.xz;
        float f1 = sin(gp.x * 0.055 + gph)        * sin(gp.y * 0.050 - gph * 0.90);
        float f2 = sin(gp.x * 0.021 - gph * 0.70) * sin(gp.y * 0.024 + gph * 0.80);
        vec3 N = normalize(vec3(f1 * 0.10 * att + f2 * 0.05, 1.0, f2 * 0.10 * att + f1 * 0.05));
        // sky mirror, graded by the reflection ray's elevation (matches the near #42 look)
        vec3 R = reflect(-V, N);
        float refUp = sqrt(clamp(R.y, 0.0, 1.0));
        float fres = pow(1.0 - max(V.y, 0.0), 3.0);
        vec3 col = mix(uDeep, mix(uSkyCol, uSkyTop, refUp), clamp(0.30 + fres * 0.60, 0.0, 1.0));
        // the glitter road, restored to the horizon: broad lobe + a hot core near the mirror
        vec3 Rs = reflect(-normalize(uSunDir), N);
        float sunUp = smoothstep(-0.05, 0.12, uSunDir.y);
        float road = pow(max(dot(Rs, V), 0.0), 42.0);
        col += uSunCol * road * (0.50 + 0.55 * smoothstep(0.70, 0.97, road)) * sunUp;
        // moon road at night — same facet mirror, cool and dim (the near shader's trick)
        col += vec3(0.50, 0.62, 0.80) * pow(max(dot(Rs, V), 0.0), 60.0) * uNight * 0.55;
        // same manual exp2 fog as the near water: the outer ring settles into the haze
        float fogF = 1.0 - exp(-pow(d * uFogDen, 2.0));
        col = mix(col, uFogColor, fogF);
        col += (hash21(gl_FragCoord.xy) - 0.5) / 255.0;   // dither the long smooth lanes
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  mat.name = 'farSeaMat';
  return mat;
}

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
      uHorizonHaze: { value: new THREE.Color(0xcfe3e8) },   // the fog colour the far terrain hazes into
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
      uniform vec3 uHorizonHaze;
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

        // base gradient — three bands: horizon → mid sky → a deepened zenith (more air, more depth)
        vec3 col = mix(uHorizon, uTop, pow(up, 0.55));
        col = mix(col, uTop * 0.82, pow(up, 2.2));
        // horizon-haze fuse: the lowest sky band settles toward the FOG colour the far terrain
        // hazes into, so the seam where the untextured distance meets the sky dissolves
        col = mix(col, uHorizonHaze, (1.0 - smoothstep(0.0, 0.085, up)) * 0.6);
        // below the horizon: deep sea haze
        col = mix(col, uHorizon * 0.55, smoothstep(0.0, -0.25, d.y));

        float sunDot = dot(d, normalize(uSunDir));

        // wide warm sun-side scatter — the air glows toward the sun; taken FROM uSunCol so it
        // desaturates WITH the descent eras instead of being a hardcoded warmth
        col += uSunCol * pow(max(sunDot, 0.0), 3.0) * 0.12 * smoothstep(-0.1, 0.2, uSunDir.y);
        // faked crepuscular rays near the sun — the half-res bloom amplifies them into shafts;
        // hard-gated on pow(sunDot,6) + elevation so they only live beside the sun and vanish at night
        float rayAng = atan(d.x - uSunDir.x, d.z - uSunDir.z);
        float rays = (0.5 + 0.5 * sin(rayAng * 14.0 + uTime * 0.05)) * pow(max(sunDot, 0.0), 6.0);
        col += uSunCol * rays * 0.07 * (1.0 - uNight) * smoothstep(0.0, 0.25, uSunDir.y);

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

        // drifting clouds — ONE noise field (power-neutral vs the old cirrus) but SHAPED by density
        // and sun-lighting so they read as volumetric form: thick lit cores, feathered shadowed edges,
        // brighter on the sun-facing side. Tint from uHorizon/uSunCol so they warm at dusk and
        // desaturate with the descent eras; horizon-bunched projection; day only.
        float cl = fbm2(d.xz / (up + 0.2) * 2.6 + vec2(uTime * 0.005, uTime * 0.002));
        float cover = smoothstep(0.52, 0.82, cl) * smoothstep(0.015, 0.18, up) * (1.0 - uNight * 0.93);
        float cdens = smoothstep(0.52, 0.95, cl);                              // thick cores vs feathered edges
        float clit  = 0.5 + 0.5 * smoothstep(-0.25, 0.65, sunDot);            // sun-facing side brighter
        vec3 cloudCol = mix(mix(uHorizon, uTop, 0.22) * 0.9, mix(vec3(1.0), uSunCol, 0.5) * 1.12, clit);
        cloudCol = mix(cloudCol * 0.78, cloudCol, cdens);                      // shadowed undersides in the cores
        cloudCol *= (1.0 - uNight * 0.62);                                     // clouds darken + thin at night so the starfield reads
        col = mix(col, cloudCol, cover * (0.4 + 0.5 * cdens));

        // sea fret: mist lifts a pale band off the horizon, veiling stars
        // and blue alike — the sky finally agrees with the fogged ground
        float fret = uMist * (1.0 - smoothstep(0.0, 0.4 + uMist * 0.25, d.y));
        col = mix(col, mix(uHorizon, vec3(0.78, 0.81, 0.83), 0.4) * mix(1.0, 0.35, uNight), fret * 0.85);

        col += (hash21(gl_FragCoord.xy) - 0.5) / 255.0; // dither: break 8-bit mach banding in the smooth gradients
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
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
      uMist: { value: 0 }, // #44: mist is scattering medium — the shaft brightens in fog (the lighthouse-in-fog image)
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
      uniform float uMist;
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vW;
      ${GLSL_NOISE}
      void main() {
        // t: normalized distance from the light source along the volume
        float t = mix(vUv.y, 1.0 - vUv.y, uFlip);
        float along = pow(1.0 - t, 1.4);
        float shimmer = 0.85 + 0.15 * sin(uTime * 3.0 + vUv.y * 40.0);
        // glancing fragments fade: the open cone's silhouette walls were
        // reading as two hard streaks — face-on light fills the body
        float facing = smoothstep(0.02, 0.32, abs(dot(normalize(vN), normalize(cameraPosition - vW))));
        float a = along * uIntensity * shimmer * 0.5 * facing * (1.0 + uMist * 0.55);
        a += (hash21(gl_FragCoord.xy) - 0.5) / 255.0; // dither the additive ramp: kills the beam's banded rings at night
        gl_FragColor = vec4(uColor, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

// ----------------------------------------------------- glowing particles ----
// Used for bioluminescent pools (teal, flare near footsteps) and fireflies.
