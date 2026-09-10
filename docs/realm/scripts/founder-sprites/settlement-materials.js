import * as THREE from 'three';
import {dressFounder} from './materials.js';

// Shared art direction for the live workshop and offline game frames.
// Keep the face warm and readable; soften source greens into dyed cloth.
// The palette operates in linear light after texture sampling.
export function dressFounderForSettlement(model,renderer){
  const wardrobe=dressFounder(model,renderer);
  const pigments={cloth:'#43564c',linen:'#a2977d',leather:'#624b37',hair:'#634331',metal:'#a1906b'};
  for(const material of wardrobe.materials){
    const kind=material.userData.kind;
    material.color.set(kind==='skin'?'#fff1e5':'#ffffff');
    if(!pigments[kind])continue;
    const pigment=new THREE.Color(pigments[kind]).toArray().map(v=>v.toFixed(6)).join(', ');
    material.onBeforeCompile=shader=>{
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
        float sourceLuma = ${material.userData.authoredSurface?'0.14':'dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))'};
        float dyeVariation = clamp(pow(max(0.001, sourceLuma) / 0.18, 0.38), 0.58, 1.28);
        diffuseColor.rgb = vec3(${pigment}) * dyeVariation;
      `);
    };
    material.customProgramCacheKey=()=> `realm-founder-pigment-v2-${kind}-${material.userData.authoredSurface}`;
  }
  return wardrobe;
}

export function lightFounderBake(rig){
  const {renderer,scene}=rig;
  renderer.toneMappingExposure=1.12;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  for(const light of scene.children.filter(o=>o.isLight)){
    if(light.isHemisphereLight){light.intensity=1.85;light.groundColor.set('#706143');}
    else if(light.position.x<0){
      light.intensity=3;light.castShadow=true;
      light.shadow.mapSize.set(2048,2048);
      Object.assign(light.shadow.camera,{left:-1.4,right:1.4,top:2,bottom:-1});
      light.shadow.normalBias=.015;light.shadow.bias=-.0001;
    }else light.intensity=.8;
  }
  const environment=new THREE.Scene();environment.background=new THREE.Color('#a1aaa3');
  const pmrem=new THREE.PMREMGenerator(renderer);
  const target=pmrem.fromScene(environment,0,.1,30);
  scene.environment=target.texture;scene.environmentIntensity=.5;
  pmrem.dispose();
  return ()=>target.dispose();
}
