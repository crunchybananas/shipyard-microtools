// turf.js — the meadow's short grass, dense where the player stands.
//
// The island's tall tufts are a whole-island scatter (props.js), about four and a half
// thousand of them over a 150 m disc, so each stands metres from the next and the ground
// between them read as suede: the largest surface in the game with nothing on it (player
// walk, October 2026). More scatter would cost the whole island everywhere. Turf only has to
// exist where it can be seen, so this is ONE instanced field that follows the camera:
//
//   * two fixed squares of cells around the eye — a dense ring under foot and a sparser,
//     shorter ring out to 30 m that cross-fades into it — each snapped to its world grid, so every tuft is
//     owned by a world cell and is placed, sized and turned by that cell's hash — the grass
//     never swims as you walk; cells are reused as the square slides with you;
//   * height and colour come from TERRAIN_GRID (terrain.js), the same 257² vertices and the
//     same meadow tone the ground under it was built from, so the blades are the ground's
//     own colour and stand on its own surface;
//   * a density mask decides where turf may grow: not on sand or rock faces, not in the
//     buildings' keep-outs, thin on the keeper's worn paths and bare under the conifers'
//     needle litter — the paths read MORE clearly through grass than they ever did on suede;
//   * density and height fade out toward the edge of the field, and nothing grows below the
//     live waterline, so the drowned strata keep their bare shores;
//   * a few drifts of coastal flowers — thrift, tormentil, eyebright — clustered by a slow
//     noise so each drift is mostly one colour, never confetti.
//
// Two draws, five and three triangles a tuft, no shadow casting, no texture beyond two small data
// maps. Hidden on the title, in the dive, and at the last winter's bare floor (main.js).
import * as THREE from 'three';
import { TERRAIN_GRID, LITTER } from './terrain.js';


const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// the litter/path mask is a canvas the terrain samples; read it once on the CPU
function litterReader() {
  const img = LITTER.tex && LITTER.tex.image;
  if (!img || !img.getContext) return () => [0, 0];
  const w = img.width, h = img.height;
  const data = img.getContext('2d').getImageData(0, 0, w, h).data;
  return (x, z) => {
    const u = (x - LITTER.cx) / LITTER.size + 0.5, v = (z - LITTER.cz) / LITTER.size + 0.5;
    if (u < 0 || v < 0 || u >= 1 || v >= 1) return [0, 0];
    const i = (Math.floor(v * h) * w + Math.floor(u * w)) * 4;
    return [data[i] / 255, data[i + 1] / 255];
  };
}

export function buildTurf(keepOut) {
  const G = TERRAIN_GRID;
  if (!G.h) throw new Error('buildTurf: the terrain grid has not been built');
  const N1 = G.N + 1, cell = G.size / G.N;

  // heights at the grid vertices (half float: linear filtering is core WebGL2)
  const hData = new Uint16Array(N1 * N1);
  for (let i = 0; i < hData.length; i++) hData[i] = THREE.DataUtils.toHalfFloat(G.h[i]);
  const heightTex = new THREE.DataTexture(hData, N1, N1, THREE.RedFormat, THREE.HalfFloatType);
  heightTex.magFilter = heightTex.minFilter = THREE.LinearFilter;
  heightTex.wrapS = heightTex.wrapT = THREE.ClampToEdgeWrapping;
  heightTex.needsUpdate = true;

  // tone (rgb, linear) + density (a)
  const litter = litterReader();
  const mData = new Uint8Array(N1 * N1 * 4);
  let grown = 0;
  for (let iy = 0; iy < N1; iy++) {
    for (let ix = 0; ix < N1; ix++) {
      const i = iy * N1 + ix, x = -G.size / 2 + ix * cell, z = -G.size / 2 + iy * cell;
      const h = G.h[i], sl = G.slope[i];
      // the meadow colour's own weight decides (not a second guess at slope and height): turf
      // grows only where the ground under it is painted as meadow, never on sand or rock
      let d = smooth(0.35, 0.8, G.grass[i]) * smooth(2.4, 3.4, h) * (1 - smooth(19, 21, h)) * (1 - smooth(0.45, 0.6, sl));
      for (const [kx, kz, kr] of keepOut) d *= smooth(kr, kr + 1.5, Math.hypot(x - kx, z - kz));
      if (d > 0) {
        const [lit, path] = litter(x, z);
        d *= 1 - smooth(0.08, 0.35, lit);             // needle litter under the conifers: bare
        d *= 1 - 0.8 * smooth(0.06, 0.5, path);        // the keeper's worn routes: thin
      }
      if (d > 0.02) grown++;
      mData[i * 4] = Math.round(Math.min(1, G.tone[i * 3]) * 255);
      mData[i * 4 + 1] = Math.round(Math.min(1, G.tone[i * 3 + 1]) * 255);
      mData[i * 4 + 2] = Math.round(Math.min(1, G.tone[i * 3 + 2]) * 255);
      mData[i * 4 + 3] = Math.round(d * 255);
    }
  }
  const maskTex = new THREE.DataTexture(mData, N1, N1, THREE.RGBAFormat, THREE.UnsignedByteType);
  maskTex.magFilter = maskTex.minFilter = THREE.LinearFilter;
  maskTex.wrapS = maskTex.wrapT = THREE.ClampToEdgeWrapping;
  maskTex.needsUpdate = true;

  // a tuft: `blades` blades, one triangle each; base vertices in metres, tip xz as a fraction
  // of the blade's height (the shader scales it), y 0 at the root and 1 at the tip
  const tuft = (blades) => {
    const pos = [];
    for (let b = 0; b < blades; b++) {
      const yaw = b * (6.2832 / blades) + (b % 2 ? 0.35 : -0.25);
      const sx = Math.cos(yaw), sz = Math.sin(yaw);             // across the blade
      const lx = -sz, lz = sx;                                  // its lean, out of its plane
      const ox = lx * 0.03, oz = lz * 0.03, w = 0.026 + 0.008 * (b % 3);
      const lean = 0.22 + 0.16 * ((b * 7) % 3) / 2;
      pos.push(ox - sx * w, 0, oz - sz * w, ox + sx * w, 0, oz + sz * w, lx * lean, 1, lz * lean);
    }
    return pos;
  };
  const rings = [
    { name: 'turfNear', cell: 0.2, inner: 0, radius: 10, blades: 5 },   // dense under foot
    { name: 'turfFar', cell: 0.42, inner: 8, radius: 30, blades: 3 },   // thinner, shorter, to the fuzz line
  ];
  const group = new THREE.Group();
  group.name = 'turf';
  const all = [];
  for (const R of rings) {
    const pos = tuft(R.blades);
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, k) => (k % 3 === 1 ? 1 : 0)), 3));
    const n = Math.ceil((R.radius * 2) / R.cell);
    const cells = new Float32Array(n * n * 2);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      cells[(j * n + i) * 2] = (i - n / 2) * R.cell;
      cells[(j * n + i) * 2 + 1] = (j - n / 2) * R.cell;
    }
    geo.setAttribute('aCell', new THREE.InstancedBufferAttribute(cells, 2));
    geo.instanceCount = n * n;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    const U = {
      uTurfH: { value: heightTex }, uTurfMask: { value: maskTex },
      uOrigin: { value: new THREE.Vector2() }, uCam: { value: new THREE.Vector3() },
      uTime: { value: 0 }, uWaterY: { value: -100 }, uWind: { value: 1 },
      uRadius: { value: R.radius }, uInner: { value: R.inner }, uCell: { value: R.cell },
      uDomain: { value: G.size }, uGridN: { value: N1 },
    };
    const mat = makeMaterial(U);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = R.name;
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.userData.instances = n * n;
    group.add(mesh);
    all.push({ U, cell: R.cell });
  }
  group.userData.grownTexels = grown;
  // per frame (main.js): slide each square with the eye; the world grid owns each tuft
  group.userData.follow = (cam, waterY, time, wind = 1) => {
    for (const { U, cell } of all) {
      U.uOrigin.value.set(Math.round(cam.x / cell) * cell, Math.round(cam.z / cell) * cell);
      U.uCam.value.copy(cam);
      U.uWaterY.value = waterY;
      U.uTime.value = time;
      U.uWind.value = wind;           // the island's one wind (main.js): a gust lays the turf over
    }
  };
  return group;
}

function makeMaterial(U) {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    mat.userData.shader = sh;
    sh.vertexShader = sh.vertexShader
      .replace('void main() {', `attribute vec2 aCell;
        uniform sampler2D uTurfH; uniform sampler2D uTurfMask;
        uniform vec2 uOrigin; uniform vec3 uCam; uniform float uTime; uniform float uWaterY; uniform float uWind;
        uniform float uRadius; uniform float uInner; uniform float uCell; uniform float uDomain; uniform float uGridN;
        varying vec3 vTurfTone; varying float vTurfT; varying vec4 vTurfFlower;
        float thash(vec2 p){p=fract(p*vec2(234.34,435.345));p+=dot(p,p+34.23);return fract(p.x*p.y);}
        float tnoise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.0-2.0*f);
          return mix(mix(thash(i),thash(i+vec2(1,0)),u.x),mix(thash(i+vec2(0,1)),thash(i+vec2(1,1)),u.x),u.y);}
        void main() {`)
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nobjectNormal = vec3(0.0, 1.0, 0.0);   // the meadow floor\'s light, from every side')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec2 tKey = floor((uOrigin + aCell) / uCell + 0.5);              // the world cell that owns this tuft
        float r1 = thash(tKey), r2 = thash(tKey + vec2(17.31, 3.7));
        float r3 = thash(tKey + vec2(5.13, 41.7)), r4 = thash(tKey + vec2(29.9, 11.3));
        vec2 wxz = tKey * uCell + (vec2(r1, r2) - 0.5) * uCell * 0.95;
        vec2 guv = (wxz / uDomain + 0.5) * ((uGridN - 1.0) / uGridN) + 0.5 / uGridN;
        float gy = texture2D(uTurfH, guv).r;
        vec4 tm = texture2D(uTurfMask, guv);
        float dist = length(vec3(wxz.x - uCam.x, gy - uCam.y, wxz.y - uCam.z));
        // the two rings cross-fade over the inner ring's last two metres; the far ring thins
        // and shortens toward its edge until a tuft is a few pixels of fuzz
        float fade = (1.0 - smoothstep(uRadius * 0.6, uRadius, dist)) * smoothstep(uInner - 2.0, uInner, dist);
        // patchiness: the meadow is clumped, not mown — a slow noise thins and thickens it
        float clump = 0.55 + 0.45 * smoothstep(0.25, 0.75, tnoise(wxz * 0.21 + 7.0));
        float alive = step(r3, tm.a * fade * clump) * step(uWaterY + 0.08, gy);
        // flowers: drifts, not confetti — a slow patch noise, one species per drift
        float drift = smoothstep(0.55, 0.78, tnoise(wxz * 0.08 + 3.1));
        float bloom = step(r2, 0.22 * drift) * step(0.5, tm.a);
        float ht = mix(0.16, 0.42, r4) * (0.6 + 0.4 * tm.a) * (0.5 + 0.5 * fade) * mix(1.0, 0.62, bloom);
        float tip = position.y;
        vec2 lxz = position.xz * mix(1.0, ht, tip) * mix(1.0, 1.6, bloom);
        float ang = r1 * 6.2831853 + r2 * 3.0, ca = cos(ang), sa = sin(ang);
        lxz = vec2(ca * lxz.x - sa * lxz.y, sa * lxz.x + ca * lxz.y);
        float gw = wxz.x * 0.31 + wxz.y * 0.23;
        lxz += (vec2(sin(uTime * 1.5 + gw), 0.6 * cos(uTime * 1.2 + gw * 1.4)) * uWind + vec2(max(uWind - 1.0, 0.0) * 0.8, 0.0)) * 0.11 * tip * ht;
        transformed = vec3(wxz.x + lxz.x * alive, gy - 0.04 + tip * ht * alive, wxz.y + lxz.y * alive);
        vTurfTone = tm.rgb * (0.82 + 0.3 * r4); vTurfT = tip;
        float sp = tnoise(wxz * 0.03 + 11.0);
        // sea thrift (pink) most, tormentil (yellow) some, eyebright (white) rarely
        vec3 fc = sp < 0.55 ? vec3(0.78, 0.30, 0.48) : sp < 0.82 ? vec3(0.95, 0.72, 0.10) : vec3(0.88, 0.86, 0.80);
        vTurfFlower = vec4(fc, bloom);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', 'varying vec3 vTurfTone; varying float vTurfT; varying vec4 vTurfFlower;\nvoid main() {')
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize(vNormal);   // never flipped on the back face')
      .replace('#include <color_fragment>', `#include <color_fragment>
        // dark in the sward, the ground's own colour at mid-blade, a little lighter at the tip
        diffuseColor.rgb *= vTurfTone * vec3(0.94, 1.06, 0.86) * mix(0.42, 1.04, vTurfT);
        diffuseColor.rgb = mix(diffuseColor.rgb, vTurfFlower.rgb, vTurfFlower.a * smoothstep(0.5, 0.82, vTurfT));`);
  };
  mat.customProgramCacheKey = () => 'meadow-turf-v4';
  return mat;

}
