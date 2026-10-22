// Blender-authored anatomy and deliberate, asynchronous wildlife gestures.
import * as THREE from 'three';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {heightAt} from './terrain.js';
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
    // THEY CAME OUT OF THE SEA. At 2 m the figures read as mannequins: one matte finish
    // (roughness .96 is felt) on a smooth body. Oilskin is waxed cloth — it shines, and it
    // shines more wet. The coat gets fine vertical creases, a darker soaked band below an
    // uneven tide line with salt dried pale along it, and slow glossy runnels of water
    // running down; the skin is wet too. Object space, so it rides the cloth sway.
    material.onBeforeCompile=shader=>{
      shader.uniforms.uFigureTime={value:0};material.userData.shader=shader;
      shader.vertexShader='uniform float uFigureTime;\nvarying vec3 vFigP;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        float cloth=smoothstep(.08,.4,position.y)*(1.0-smoothstep(1.30,1.50,position.y));
        transformed.z+=sin(uFigureTime*.8+position.y*3.0)*.006*cloth;
        vFigP=position;`);
      shader.fragmentShader=`uniform float uFigureTime;
        varying vec3 vFigP;
        float figH(vec2 p){p=fract(p*vec2(234.34,435.345));p+=dot(p,p+34.23);return fract(p.x*p.y);}
        float figN(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.0-2.0*f);
          return mix(mix(figH(i),figH(i+vec2(1,0)),u.x),mix(figH(i+vec2(0,1)),figH(i+vec2(1,1)),u.x),u.y);}
        float figWet;float figRun;float figSkin;
        `+shader.fragmentShader
        .replace('#include <color_fragment>',`#include <color_fragment>
          // around the body: the angle about the figure's axis, so creases run down it
          float ang=atan(vFigP.x,vFigP.z);
          float crease=figN(vec2(ang*9.0,vFigP.y*2.2))*.65+figN(vec2(ang*23.0,vFigP.y*5.0))*.35;
          figSkin=smoothstep(.11,.15,vColor.g)*(1.0-smoothstep(.3,.4,vColor.g));
          float tide=.52+.07*figN(vec2(ang*3.0,1.7))+.03*sin(ang*5.0);
          figWet=1.0-smoothstep(tide-.035,tide+.035,vFigP.y);
          figRun=smoothstep(.78,.95,figN(vec2(ang*14.0,vFigP.y*1.4+uFigureTime*.22)))*smoothstep(1.45,1.1,vFigP.y);
          vec3 c=diffuseColor.rgb*(.8+.4*crease*(1.0-figSkin));
          c*=mix(1.0,.48,figWet*(1.0-figSkin));
          // salt dried along the line: a thin, broken, low crust — never a painted trim
          float salt=(1.0-smoothstep(.0,.022,abs(vFigP.y-tide-.03)))*smoothstep(.45,.75,figN(vec2(ang*11.0,vFigP.y*24.0)))*(1.0-figSkin);
          diffuseColor.rgb=mix(c,c*1.9+vec3(.035),salt*.6);
          // the bare head (the hooded one has none): hair, soaked flat over the crown and the
          // back of the skull in dark strands, a hairline across the brow, the face (+z, under
          // y 1.655) left clear — a person, not a dome
          float hairline=1.655+.012*sin(vFigP.x*40.0);
          float hair=figSkin*smoothstep(1.535,1.575,vFigP.y)*max(1.0-smoothstep(.07,.125,vFigP.z),smoothstep(hairline-.01,hairline+.01,vFigP.y));
          vec3 strands=vec3(.03,.034,.033)*(.7+.6*figN(vec2(ang*30.0,vFigP.y*8.0)));
          diffuseColor.rgb=mix(diffuseColor.rgb,strands,hair);
          figWet=max(figWet,hair);`)
        .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
          roughnessFactor=mix(.58,.3,max(figWet,figRun))+.1*figSkin*(1.0-figWet);`);
    };
    material.customProgramCacheKey=()=> 'coastal-figure-cloth-v5';
    const mesh=new THREE.Mesh(geometry,material);mesh.name=asset;mesh.userData.authoring='Blender island_life.py';anchor.add(mesh);
    anchor.userData.mats=[material];anchor.userData.authoring='Blender island_life.py';materials.push(material);
  }
  return time=>{for(const m of materials)if(m.userData.shader)m.userData.shader.uniforms.uFigureTime.value=time;};
}

// A planted miniature, with a real head turn and palms that settle on its table.
// Kept outside userData because Three clones userData through JSON.
const lowerKeepers=new WeakMap();
export function attachLowerKeeper(modelRoot,library){
  const anchor=modelRoot.getObjectByName('tinyFigure'),source=library.getObjectByName('KeeperRig');
  if(!anchor||!source)throw Error('Missing authored lower keeper');
  anchor.clear();
  const scale=2.65,rig=cloneSkeleton(source),bones={};let skin;
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.97,emissive:0x668f80,emissiveIntensity:.14});
  rig.traverse(o=>{
    if(o.isBone)bones[o.name]={node:o,rotation:o.quaternion.clone(),position:o.position.clone(),scale:o.scale.clone()};
    if(o.isSkinnedMesh){skin=o;o.material=material;o.frustumCulled=false;}
  });
  if(!skin)throw Error('Lower keeper has no articulated mesh');
  const benchSource=library.getObjectByName('keeperBenchCraft');benchSource.updateWorldMatrix(true,false);
  const bench=new THREE.Mesh(benchSource.geometry.clone().applyMatrix4(benchSource.matrixWorld),
    new THREE.MeshStandardMaterial({vertexColors:true,roughness:.94,emissive:0x4c4635,emissiveIntensity:.06}));
  bench.name='keeperBenchCraft';bench.scale.setScalar(scale);rig.scale.setScalar(scale);
  // Fit the four feet to this actual slope; leave the level top and hand contact
  // in authored coordinates. Only vertices at the bottoms of the legs move.
  const feet=bench.geometry.attributes.position;
  for(let i=0;i<feet.count;i++)if(feet.getY(i)<.001){
    feet.setY(i,(heightAt(anchor.position.x+feet.getX(i)*scale,anchor.position.z+feet.getZ(i)*scale)-anchor.position.y)/scale);
  }
  feet.needsUpdate=true;bench.geometry.computeVertexNormals();bench.geometry.computeBoundingSphere();
  anchor.add(rig,bench);lowerKeepers.set(anchor,{bones,material,skin});
  anchor.userData.authoring='Blender island_life.py';anchor.userData.figureScale=scale;
  poseLowerKeeper(anchor,0,0,0,0);
}
export function poseLowerKeeper(anchor,time,look,rest,yaw){
  const keeper=lowerKeepers.get(anchor);if(!keeper)return;
  const {bones:b,material}=keeper;
  const turnTo=clamp(Math.atan2(Math.sin(yaw),Math.cos(yaw)),-1.15,1.15);
  turn(b.keeperHead,-.32*look,turnTo*look,Math.sin(time*.8)*.018*(1-look));
  // The rest pose was authored with both palms exactly 2 mm above the boards.
  // Relaxing rotates the elbows down; returning to bind space restores contact.
  const settle=smoothstep(0,1,rest);
  for(const side of ['L','R']){
    turn(b['keeperUpper'+side],.20*(1-settle),0,0);
    turn(b['keeperFore'+side],.90*(1-settle),0,0);
    turn(b['keeperPalm'+side],0,0,0);
  }
  material.emissiveIntensity=.14+.10*look;
  anchor.userData.gesture=settle>.98?'hands-resting':settle>.01?'settling-hands':'working';
}
