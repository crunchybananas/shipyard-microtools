// Blender-authored anatomy and deliberate, asynchronous wildlife gestures.
import * as THREE from 'three';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {clamp, smoothstep, lerp} from './util.js';
const q=new THREE.Quaternion(), e=new THREE.Euler();
const cameras=new WeakMap(), birdPosition=new THREE.Vector3(), birdScale=new THREE.Vector3();
export function birdFactory(library,camera) {
  const source=library.getObjectByName('BirdRig');
  if(!source)throw Error('Missing authored BirdRig');
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.82,side:THREE.DoubleSide});
  return function make(species='gull') {
    const root=new THREE.Group();root.name=species+'Actor';
    const rig=cloneSkeleton(source),remove=[],bones={};let mesh,farMesh;
    rig.traverse(o=>{
      if(o.isSkinnedMesh){
        if(o.name!==species&&o.name!==species+'Far')remove.push(o);
        else{if(o.name===species)mesh=o;else farMesh=o;o.material=material;o.castShadow=o.name===species;o.receiveShadow=true;}
      }
      if(o.isBone)bones[o.name]={node:o,rotation:o.quaternion.clone(),position:o.position.clone(),scale:o.scale.clone()};
    });
    for(const o of remove)o.removeFromParent();
    if(!mesh||!farMesh)throw Error('Missing bird species: '+species);
    root.add(rig);root.updateMatrixWorld(true);mesh.skeleton.update();mesh.computeBoundingBox();
    // Bounds cover spread wings and all head/foot poses, rather than the bind frame.
    mesh.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,.30,0),1.35);
    farMesh.boundingSphere=mesh.boundingSphere.clone();farMesh.visible=false;
    const sole=-mesh.boundingBox.min.y;
    root.userData={species,rig,bones,mesh,farMesh,sole,detail:'near',authoring:'Blender island_life.py',behavior:'watch',callUntil:0};
    if(camera)cameras.set(root,camera);
    root.lw=bones.wingL.node;root.rw=bones.wingR.node;
    poseBird(root,0,{phase:0});return root;
  };
}
function turn(b,x=0,y=0,z=0) {q.setFromEuler(e.set(x,y,z,'ZYX'));b.node.quaternion.copy(b.rotation).multiply(q);}
export function poseBird(g,time,{flight=0,phase=0,alert=0,look=0,landing=0,calling=false}={}) {
  const u=g.userData,b=u.bones;
  for(const v of Object.values(b)){v.node.position.copy(v.position);v.node.scale.copy(v.scale);v.node.quaternion.copy(v.rotation);}
  const cycle=(time*.62+phase*3.3)%17;
  let peck=0,preen=0,scan=.25*Math.sin(time*.71+phase);
  if(alert<.1&&flight<.1){
    if(cycle>7&&cycle<10){const t=(cycle-7)/3;peck=Math.sin(t*Math.PI)**2*(.78+.22*Math.sin(t*Math.PI*6)**2);}
    if(cycle>12&&cycle<15.2)preen=Math.sin((cycle-12)/3.2*Math.PI)**2;
  }
  u.behavior=flight>.1?(landing>.2?'landing':'flight'):alert>.1?'watching-you':preen>.1?'preen':peck>.1?'forage':'watch';
  const breath=Math.sin(time*1.7+phase)*.008*(1-flight);
  turn(b.body,peck*.18,0,0);b.body.node.position.y-=peck*.04;
  turn(b.head,peck*1.38+preen*.22-flight*.20,lerp(scan,clamp(look,-.86,.86),alert)-preen*2.0,preen*.16);
  b.head.node.position.y-=peck*.085;b.head.node.position.z+=peck*.03;
  const blink=(time+phase*2.3)%5.9;
  b.eyes.node.scale.y=blink<.14?.12:1;
  turn(b.jaw,calling?(.11+.08*Math.sin(time*29)):peck*.06,0,0);
  turn(b.tail,-.03+breath+landing*.20,Math.sin(time*.61+phase)*.025,0);
  // Most circling is gliding. Short asynchronous wingbeats supply work, then rest.
  const burst=smoothstep(.58,.76,.5+.5*Math.sin(time*.73+phase));
  const flap=.08+Math.sin(time*(landing>.1?11:8.7)+phase)*(landing>.1?.52:.09+burst*.42);
  const stretch=(cycle>3.8&&cycle<5.5&&alert<.1)?Math.sin((cycle-3.8)/1.7*Math.PI)**2*.22:0;
  const spread=clamp(flight+stretch,0,1);
  turn(b.wingL,0,lerp(-1.33,0,spread),lerp(-.55-breath,-flap,spread));
  turn(b.wingR,0,lerp(1.33,0,spread),lerp(.55+breath,flap,spread));
  for(const name of ['wingL','wingR']){b[name].node.scale.x=lerp(.68,1,spread);b[name].node.scale.z=lerp(.63,1,spread);}
  turn(b.handL,0,lerp(-.12,.06*Math.sin(time*8.7+phase-.7),spread),-flight*.045);
  turn(b.handR,0,lerp(.12,-.06*Math.sin(time*8.7+phase-.7),spread),flight*.045);
  for(const name of ['footL','footR'])turn(b[name],flight*(1-landing)*-.9+landing*.12,0,0);
  u.pose={peck,preen,flight,alert,landing,blink:blink<.14};
  const camera=cameras.get(g);
  if(camera){
    // Distance follows apparent size, so the 1:240 clue always uses its silhouette.
    g.getWorldPosition(birdPosition);g.getWorldScale(birdScale);
    const distance=birdPosition.distanceTo(camera.position)/Math.max(.0001,birdScale.x);
    const detailed=distance<(u.detail==='near'?22:18);
    u.detail=detailed?'near':'far';u.mesh.visible=detailed;u.farMesh.visible=!detailed;
  }
}

export function attachLivingBoat(core,modelRoot,library) {
  const cache=new Map();
  function geometry(name){if(!cache.has(name)){const src=library.getObjectByName(name);if(!src?.isMesh)throw Error('Missing boat mesh '+name);src.updateWorldMatrix(true,false);const geo=src.geometry.clone().applyMatrix4(src.matrixWorld);geo.userData.authoring='Blender island_life.py';cache.set(name,geo);}return cache.get(name);}
  for(const root of [core,modelRoot]){
    const dory=root.children.find(o=>o.name==='dory');if(!dory)continue;
    const hull=dory.getObjectByName('doryHull'),oar=dory.getObjectByName('doryOar');
    hull.geometry=geometry('doryCraft');hull.material=hull.material.clone();hull.material.vertexColors=true;hull.material.color.set(0xffffff);hull.material.side=THREE.DoubleSide;hull.castShadow=true;hull.receiveShadow=true;
    // The exported hull includes seats and ribs; remove only the old unnamed seats.
    for(const child of [...dory.children])if(child!==hull&&child!==oar&&child.isMesh&&!child.name)child.removeFromParent();
    const cleat=dory.getObjectByName('mooringCleat');if(cleat)cleat.position.set(.49,.35,.74);
    const mark=hull.getObjectByName('lmDory');if(mark)mark.position.x=-.594;
    oar.geometry=geometry('doryOarCraft');oar.material=hull.material;
  }
}

export function attachSongbirds(refs,modelRefs,makeBird) {
  const actors=[];
  for(const pair of [refs,modelRefs]){
    const anchor=pair.songBird;
    if(!anchor)continue;
    for(const child of [...anchor.children])child.removeFromParent();
    // The old fixed 2.6 m offset left the clue hovering above its tapered stone.
    // Seat the feet on the actual crown in each island coordinate frame.
    const stone=pair.stone2;stone.updateWorldMatrix(true,false);
    const ray=new THREE.Raycaster(stone.localToWorld(new THREE.Vector3(0,10,0)),new THREE.Vector3(0,-1,0).transformDirection(stone.matrixWorld));
    const hit=ray.intersectObject(stone,false)[0];
    if(!hit)throw Error('Songbird perch has no stone surface');
    anchor.position.copy(anchor.parent.worldToLocal(hit.point.clone()));
    const actor=makeBird('songbird');actor.scale.setScalar(.56);actor.position.y=actor.userData.sole*.56;
    anchor.add(actor);anchor.userData.callUntilMs=0;actors.push({anchor,actor});
  }
  return elapsed=>{
    for(const {anchor,actor} of actors)if(anchor.visible)poseBird(actor,elapsed,{phase:2.7,alert:.4,
      look:Math.sin(elapsed*.41)*.4,calling:performance.now()<anchor.userData.callUntilMs});
  };
}

// Keep encounter behavior and reset ownership on the existing scene anchors.
export function attachCoastalFigures(core,library){
  const materials=[];
  for(const [anchorName,asset] of [['watcher','watcherCraft'],['tideFigure','tideFigureCraft']]){
    const anchor=core.getObjectByName(anchorName),source=library.getObjectByName(asset);
    if(!anchor||!source?.isMesh)throw Error('Missing authored encounter '+anchorName);
    for(const child of [...anchor.children])child.removeFromParent();
    source.updateWorldMatrix(true,false);
    const geometry=source.geometry.clone().applyMatrix4(source.matrixWorld);
    const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.96,transparent:true,opacity:anchorName==='watcher'?1:.8,emissive:0x102125,emissiveIntensity:.12});
    material.onBeforeCompile=shader=>{
      shader.uniforms.uFigureTime={value:0};material.userData.shader=shader;
      shader.vertexShader='uniform float uFigureTime;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        float cloth=smoothstep(.08,.4,position.y)*(1.0-smoothstep(1.30,1.50,position.y));
        transformed.z+=sin(uFigureTime*.8+position.y*3.0)*.006*cloth;`);
    };
    material.customProgramCacheKey=()=> 'coastal-figure-cloth-v1';
    const mesh=new THREE.Mesh(geometry,material);mesh.name=asset;mesh.userData.authoring='Blender island_life.py';anchor.add(mesh);
    anchor.userData.mats=[material];anchor.userData.authoring='Blender island_life.py';materials.push(material);
  }
  return time=>{for(const m of materials)if(m.userData.shader)m.userData.shader.uniforms.uFigureTime.value=time;};
}
