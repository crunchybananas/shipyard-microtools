import * as THREE from 'three';
import { FOREST_PROFILES } from './forest-profile.js';
import { MAX_TIDE } from './world.js';
import { addCollider } from './terrain.js';

// Weathering belongs to a rock's actual triangles. The former lichen instances
// guessed a height above a bounding sphere and sometimes hung metres in the air.
export function applyRockCrust(material) {
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec3 vRockGrain;\nvarying float vRockUp;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vRockGrain=position*2.3;
      #ifdef USE_INSTANCING
        vRockGrain+=instanceMatrix[3].xyz*.37;
      #endif
      vRockUp=dot(normalize(transformedNormal),viewMatrix[1].xyz);`);
    shader.fragmentShader = `varying vec3 vRockGrain;varying float vRockUp;
      float crustHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      float crustNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(mix(crustHash(i),crustHash(i+vec3(1,0,0)),f.x),mix(crustHash(i+vec3(0,1,0)),crustHash(i+vec3(1,1,0)),f.x),f.y),
          mix(mix(crustHash(i+vec3(0,0,1)),crustHash(i+vec3(1,0,1)),f.x),mix(crustHash(i+vec3(0,1,1)),crustHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float crust=crustNoise(vRockGrain*2.2)*.72+crustNoise(vRockGrain*9.1)*.28;
      float coverage=smoothstep(.56,.68,crust)*smoothstep(.18,.66,vRockUp);
      vec3 salt=mix(vec3(.31,.29,.13),vec3(.30,.36,.24),step(.43,crustNoise(vRockGrain*.41)));
      diffuseColor.rgb=mix(diffuseColor.rgb,salt,coverage*.62);`);
    material.userData.crustShader = shader;
  };
  material.customProgramCacheKey=()=> 'rock-attached-lichen-v1';
}

function meshGeometry(library, name) {
  const source = library.getObjectByName(name);
  if (!source?.isMesh) throw new Error(`Missing Blender working-coast mesh: ${name}`);
  source.updateWorldMatrix(true, false);
  return source.geometry.clone().applyMatrix4(source.matrixWorld);
}

export function forestCrowns(library) {
  return FOREST_PROFILES.map((profile, index) => {
    const geometry = detail => {
      const g = meshGeometry(library, `forest${index}${detail}`);
      if (!g.attributes.uv) throw new Error('Blender canopy lost its wind weights');
      g.setAttribute('aRim', new THREE.Float32BufferAttribute(
        Array.from({length:g.attributes.uv.count}, (_,i) => g.attributes.uv.getX(i)), 1));
      g.userData.authoring = 'Blender working_coast.py';
      g.userData.closedNeedleVolumes = true;
      g.computeBoundingSphere();
      return g;
    };
    return {...profile, geo:geometry('Near'), farGeo:geometry('Far'), modelGeo:geometry('Model')};
  });
}

export function attachWorkingStudy(core, library) {
  const group = new THREE.Group();
  group.name = 'workingStudy';
  group.position.copy(core.getObjectByName('study').position);
  core.add(group);
  const angle=221*Math.PI/180;
  // The shallow ledge occupies the wall, while the existing central route stays open.
  for(const side of [-.44,0,.44])addCollider(group.position.x+Math.sin(angle)*4.2+Math.cos(angle)*side,
    group.position.z+Math.cos(angle)*4.2-Math.sin(angle)*side,.25);
  const timber = new THREE.MeshStandardMaterial({vertexColors:true, roughness:.87});
  timber.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec3 vTimber;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvTimber=position;');
    shader.fragmentShader = 'varying vec3 vTimber;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec3 axis=abs(normalize(cross(dFdx(vTimber),dFdy(vTimber))));
      float along=axis.y>.6?vTimber.z:vTimber.y;
      float across=axis.y>.6?vTimber.x:vTimber.x+vTimber.z;
      float fiber=sin(across*216.0+sin(along*2.1)*1.2)+.4*sin(across*471.0+sin(along*4.7));
      float fine=1.0-smoothstep(.008,.035,length(fwidth(vTimber)));
      diffuseColor.rgb *= 1.0 + .025*fiber*fine;
      float floorWear=exp(-dot(vTimber.xz,vTimber.xz)*.065);
      diffuseColor.rgb *= .84+.16*smoothstep(.04,.6,vTimber.y)+.12*floorWear;
      if(vTimber.y<.13){
        float shade=exp(-dot(vTimber.xz,vTimber.xz)*.42)*.20;
        for(int ix=0;ix<2;ix++)for(int iz=0;iz<2;iz++){
          vec2 foot=vTimber.xz-vec2(float(ix)*2.0-1.0,float(iz)*2.0-1.0);
          shade+=exp(-dot(foot,foot)*18.0)*.26;
        }
        diffuseColor.rgb *= 1.0-min(.50,shade);
      }`);
  };
  timber.customProgramCacheKey = () => 'working-study-timber-v1';
  const plaster = new THREE.MeshStandardMaterial({vertexColors:true,roughness:.99,side:THREE.DoubleSide});
  plaster.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec3 vPlaster;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvPlaster=position;');
    shader.fragmentShader = 'varying vec3 vPlaster;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float lime=sin(dot(vPlaster,vec3(113.3,159.1,107.7)))*sin(dot(vPlaster,vec3(43.7,177.1,241.3)));
      float dry=1.0-smoothstep(.015,.055,length(fwidth(vPlaster)));
      float wash=.95+.04*sin(vPlaster.y*.82+vPlaster.x*.31);
      diffuseColor.rgb *= wash+lime*.018*dry;`);
  };
  plaster.customProgramCacheKey = () => 'working-study-lime-v1';
  for (const name of ['studyPlaster','studyTimber','studyFittings']) {
    const mesh = new THREE.Mesh(meshGeometry(library,name), name==='studyPlaster'?plaster:timber);
    mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  }

  // A stilling tube makes the wheel's water level visible at the player's hand.
  // The float and sea both follow W.tide, including its thirteen-second travel.
  // The instrument must contain even the deepest shared-water draft (2.65),
  // not only the 0–1 range of the surface wheel.
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(.061,.061,1.89,14,1,true),
    new THREE.MeshStandardMaterial({color:0xa0c2b7,roughness:.24,metalness:.12,transparent:true,opacity:.22,depthWrite:false}));
  glass.position.set(4.01,1.315,-.65);glass.name='tideGaugeGlass';group.add(glass);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(.049,.049,1,12),
    new THREE.MeshStandardMaterial({color:0x367e7b,roughness:.31,metalness:.2}));
  water.position.set(4.01,.40,-.65);water.name='tideGaugeWater';group.add(water);
  const float = new THREE.Mesh(new THREE.CylinderGeometry(.053,.053,.049,12),
    new THREE.MeshStandardMaterial({color:0xb48c45,roughness:.5,metalness:.65}));
  float.name='tideGaugeFloat';float.position.set(4.01,.40,-.65);group.add(float);
  // Readable marks are part of the instrument, with zero new asset requests.
  const cv=document.createElement('canvas');cv.width=128;cv.height=512;
  const ctx=cv.getContext('2d');ctx.fillStyle='#cad1ba';ctx.font='24px Georgia';
  ctx.textAlign='right';
  for(let i=0;i<=2;i++)ctx.fillText(String(i),100,466-i*192);
  const face=new THREE.Mesh(new THREE.PlaneGeometry(.19,1.62),
    new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(cv),transparent:true,depthWrite:false}));
  face.position.set(3.81,1.21,-.689);group.add(face);
  return {
    tick(tide) {
      const level=Math.max(0,Math.min(MAX_TIDE,tide));
      const height=.06+level*.64;
      water.scale.y=height;water.position.y=.385+height/2;
      float.position.y=.385+height;
      group.userData.tide=level;
    },
  };
}
