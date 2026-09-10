import * as THREE from 'three';
import {surfaceMaps} from '../founder-sprites/materials.js';

// Detail stays in bind-space UVs and follows the saved skin. The glTF carries
// the authored pigments; no hue classifier can turn a face into a glove.
export function dressBuilder(model,renderer){
  const recipes=Object.fromEntries(['cloth','leather','wood','metal'].map(kind=>[kind,surfaceMaps(kind)]));
  const materials=[],stats={triangles:0,regions:{}};
  model.traverse(o=>{
    if(!o.isMesh)return;
    const source=o.material;
    const kind=source.name.replace(/^Builder /,'');
    const recipe=['cloth','linen','trouser','thread'].includes(kind)?'cloth':
      ['leather','boot'].includes(kind)?'leather':['wood','woodedge','hair','grey'].includes(kind)?'wood':kind==='metal'?'metal':null;
    const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();
    const pigmentUV=kind==='face'?g.attributes.uv.clone():null;
    const pos=g.attributes.position,norm=g.attributes.normal,uv=new Float32Array(pos.count*2);
    for(let i=0;i<pos.count;i+=3){
      const nx=Math.abs(norm.getX(i)),ny=Math.abs(norm.getY(i)),nz=Math.abs(norm.getZ(i));
      const axis=nx>ny&&nx>nz?0:ny>nz?1:2;
      const density=recipe==='cloth'?3.3:recipe==='wood'?2.4:3;
      for(let j=i;j<i+3;j++){
        uv[j*2]=(axis===0?pos.getZ(j):pos.getX(j))*density;
        uv[j*2+1]=(axis===1?pos.getZ(j):pos.getY(j))*density;
      }
    }
    g.setAttribute('uv',new THREE.BufferAttribute(uv,2));
    const m=new THREE.MeshPhysicalMaterial({name:source.name,color:source.color,map:source.map,side:THREE.DoubleSide,
      roughness:kind==='iris'?.45:kind==='skin'?.82:kind==='metal'?.57:.92,
      metalness:kind==='metal'?.62:0,sheen:recipe==='cloth'?.2:0,sheenRoughness:.9,
      sheenColor:new THREE.Color('#a19882')});
    if(recipe){
      const maps=recipes[recipe];
      m.normalMap=maps.normal;m.roughnessMap=maps.roughness;m.map=maps.color;
      m.normalScale.setScalar(kind==='hair'?.10:recipe==='cloth'?.29:recipe==='wood'?.22:.25);
    }
    if(pigmentUV)g.setAttribute('uv',pigmentUV);
    m.userData.kind=kind;o.geometry=g;o.material=m;o.castShadow=true;o.receiveShadow=true;
    materials.push(m);stats.regions[kind]=(stats.regions[kind]||0)+pos.count/3;stats.triangles+=pos.count/3;
  });
  for(const maps of Object.values(recipes))for(const texture of Object.values(maps))texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  return {materials,stats};
}
