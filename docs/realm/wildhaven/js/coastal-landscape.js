// The sea samples a small stationary chart. Bays and outlying headlands use
// the same distance field as the playable land, even far from the home port.
import * as THREE from '../../vendor/three/three.module.js';
import { coastDistance, ISLAND_BOUNDS } from './island.js';

export function createSeaMaterial(cellSize) {
  const margin = 24;
  const left = ISLAND_BOUNDS.minX - margin, top = ISLAND_BOUNDS.minZ - margin;
  const spanX = ISLAND_BOUNDS.maxX + margin - left;
  const spanZ = ISLAND_BOUNDS.maxZ + margin - top;
  const width = 320, height = 288;
  const chart = new Uint8Array(width * height);
  for (let z = 0; z < height; z++) {
    for (let x = 0; x < width; x++) {
      const depth = -coastDistance(left + (x + .5) / width * spanX, top + (z + .5) / height * spanZ);
      chart[z * width + x] = Math.round(THREE.MathUtils.clamp((depth + 2) / 14, 0, 1) * 255);
    }
  }
  const texture = new THREE.DataTexture(chart, width, height, THREE.RedFormat);
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, chart: { value: texture },
      origin: { value: new THREE.Vector2(left * cellSize, top * cellSize) },
      span: { value: new THREE.Vector2(spanX * cellSize, spanZ * cellSize) },
    },
    vertexShader: `
      varying vec2 sea;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.);
        sea = world.xz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: `
      uniform sampler2D chart;
      uniform vec2 origin, span;
      uniform float uTime;
      varying vec2 sea;
      float hash21(vec2 p) {
        vec3 q = fract(vec3(p.xyx)*vec3(.1031,.11369,.13787));
        q += dot(q,q.yzx+19.19);
        return fract((q.x+q.y)*q.z);
      }
      float noise(vec2 p) {
        vec2 cell = floor(p), f = fract(p);
        f = f*f*(3.-2.*f);
        return mix(mix(hash21(cell),hash21(cell+vec2(1,0)),f.x),
                   mix(hash21(cell+vec2(0,1)),hash21(cell+1.),f.x),f.y);
      }
      void main() {
        float depth = texture2D(chart, (sea-origin)/span).r * 14. - 2.;
        float tide = .5 + .5 * sin(sea.x*.85 + sea.y*.47 + sin(sea.y*1.4) - uTime*.7);
        float inlet = noise(sea*.27);
        float bank = depth + inlet*.35;
        vec3 sand = vec3(.36,.55,.34), lagoon = vec3(.041,.32,.27), channel = vec3(.018,.137,.168);
        vec3 water = mix(sand, lagoon, smoothstep(-.1,1.5,bank));
        water = mix(water, channel, smoothstep(1.,6.4,bank));
        float shoal = (1.-smoothstep(.9,3.9,depth))*smoothstep(.2,.85,inlet);
        water *= 1.-.19*shoal;
        // Two intermittent breakers. The outer one breaks in shorter pieces.
        float surf = 1.-smoothstep(.03,.15,abs(depth-.24-.10*tide));
        float outer = 1.-smoothstep(.02,.095,abs(depth-.69-.16*tide));
        float foam = surf*(.2+.52*inlet+.13*tide) + outer*smoothstep(.45,.83,inlet)*tide*.49;
        water = mix(water, vec3(.70,.80,.65), clamp(foam,0.,.79));
        vec2 wind = vec2(sea.x*.57+sea.y*.2, sea.y*3.6-sea.x*.83);
        float bend = noise(sea*.69)*4.3 + inlet*7.;
        float crest = sin(wind.y+bend-uTime*.82);
        float glint = noise(vec2(wind.x,wind.y*.22)+vec2(uTime*.10,0.));
        float fade = 1.-smoothstep(.35,1.4,fwidth(wind.y));
        water += vec3(.029,.049,.044)*smoothstep(.85,.995,crest)
          *smoothstep(.54,.84,glint)*fade;
        gl_FragColor = vec4(water,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// Blend a worn track into the meadow beneath the stepping stones. Keep the
// grid walkability and all foundation heights in the simulation unchanged.
const soil = new THREE.Color('#97744d');
const dune = new THREE.Color('#bfaa72');
const clamp = THREE.MathUtils.clamp;
export function groundTint(color, x, z, grass, shade, sand) {
  const broad = Math.sin(x*.71+Math.sin(z*.43)) * Math.cos(z*.62+x*.26);
  const patches = Math.sin(x*1.46+z*.35+Math.cos(z*1.12));
  const meadow = clamp(.48 + broad*.42 + patches*.11, 0, 1);
  const coast = coastDistance(x,z);
  color.copy(grass).lerp(shade,meadow*.87);
  color.lerp(dune,clamp(1.45-coast+patches*.12,0,1)*.78);
  color.lerp(sand,clamp((.86-coast)/.64,0,1));
  if (Math.abs(x-1)<3 && z>-6.5 && z<9) {
    const main = Math.hypot(x,z-clamp(z,-5,6));
    const corner = Math.hypot(x-clamp(x,0,2),z-6);
    const jetty = Math.hypot(x-2,z-clamp(z,6,8.1));
    const verge = clamp((.58 + .045*patches - Math.min(main,corner,jetty))/.30,0,1);
    color.lerp(soil,verge*.83);
  }
  return color.multiplyScalar(1 + .037*patches);
}

// A low split slab with a light mineral seam on the exposed shoulder.
export function quarryStoneGeometry() {
  const footprint = [[.63,.09],[.39,.51],[-.06,.56],[-.48,.32],[-.62,-.09],[-.32,-.49],[.29,-.43]];
  const topHeights = [.22,.31,.43,.47,.38,.29,.19];
  const ring = (scale, xShift, height) => footprint.map(([x,z],i) =>
    [x*scale+xShift, height(i), z*scale]);
  const rings = [
    ring(.82,0,()=>-.30),
    ring(1,0,i=>topHeights[i]*.39-.08),
    ring(.90,-.015,i=>topHeights[i]*.58),
    ring(.87,-.021,i=>topHeights[i]*.58+.036),
    ring(.64,-.075,i=>topHeights[i]),
  ];
  const vertices=[], colors=[];
  function face(a,b,c,hex) {
    vertices.push(...a,...b,...c);
    const tint = new THREE.Color(hex);
    for(let i=0;i<3;i++) colors.push(tint.r,tint.g,tint.b);
  }
  const tones=['#576263','#737c7a','#b7b29d','#8d9791'];
  for(let i=0;i<footprint.length;i++){
    const j=(i+1)%footprint.length;
    for(let k=0;k<rings.length-1;k++){
      const low=rings[k], high=rings[k+1];
      const tint = k===2 && i>3 ? '#8b9087' : tones[k];
      face(low[i],high[i],high[j],tint);
      face(low[i],high[j],low[j],tint);
    }
    const top=rings[rings.length-1];
    face(top[j],top[i],[-.12,.375,.04],i%3===0?'#a4a590':'#9ba49c');
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();
  return geometry;
}

export function meadowTuftGeometry() {
  const vertices=[], colors=[];
  function blade(a,b,c,tint) {
    vertices.push(...a,...b,...c);
    const color=new THREE.Color(tint);
    for(let i=0;i<3;i++) colors.push(color.r,color.g,color.b);
  }
  for(let i=0;i<5;i++) {
    const a=i*2.4, x=Math.cos(a), z=Math.sin(a), h=.16+.07*(i%3);
    blade([x*.06-z*.035,0,z*.06+x*.035],[x*.06+z*.035,0,z*.06-x*.035],
      [x*.19,h,z*.19],i%2?'#729058':'#8aa267');
  }
  for(const [x,z,h] of [[-.11,.04,.23],[.10,-.12,.29]]) {
    blade([x-.027,0,z],[x+.027,0,z],[x,h,z+.02],'#637952');
    for(let i=0;i<5;i++){
      const a=i*Math.PI*2/5, b=(i+1)*Math.PI*2/5;
      blade([x,h-.028,z],[x+Math.sin(a)*.069,h,z+Math.cos(a)*.069],
        [x+Math.sin(b)*.069,h,z+Math.cos(b)*.069],'#fff5d8');
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();
  return geometry;
}
