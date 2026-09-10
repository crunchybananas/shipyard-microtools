// Offline source renderer. The ordinary Realm game only loads baked PNGs.
import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/GLTFLoader.js';
import { FOUNDER_ANCHOR, FOUNDER_STRIDE, FOUNDER_VIEW_HEIGHT } from './contract.js';

export const MODEL_URL = new URL('../../assets/sprites/founder/source/rogue.glb', import.meta.url).href;
export const VIEW_ELEVATION = Math.PI / 6;
export const VIEW_HEIGHT = FOUNDER_VIEW_HEIGHT;

export async function createFounderRig({width=128,height=168,canvas,modelURL=MODEL_URL,applyGrounding=true,clipName='Walking_B'}={}) {
  const renderer = new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(1);
  renderer.setSize(width,height,false);
  renderer.setClearColor(0x000000,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.2;
  const scene=new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xdcebf2,0x60513f,2.25));
  const key=new THREE.DirectionalLight(0xffe3b7,3.4);
  key.position.set(-3,5,4);scene.add(key);
  const fill=new THREE.DirectionalLight(0x8db8d3,1.6);
  fill.position.set(4,3,-3);scene.add(fill);
  const camera=new THREE.OrthographicCamera(-VIEW_HEIGHT*width/height/2,VIEW_HEIGHT*width/height/2,VIEW_HEIGHT/2,-VIEW_HEIGHT/2,.1,50);
  const target=new THREE.Vector3(0,(FOUNDER_ANCHOR.y-.5)*VIEW_HEIGHT/Math.cos(VIEW_ELEVATION),0);
  camera.position.copy(target).add(new THREE.Vector3(0,Math.sin(VIEW_ELEVATION)*10,Math.cos(VIEW_ELEVATION)*10));
  camera.lookAt(target);
  const gltf=await new GLTFLoader().loadAsync(modelURL);
  const model=gltf.scene;
  const bindPose=[];
  model.traverse(o=>bindPose.push({o,p:o.position.clone(),q:o.quaternion.clone(),s:o.scale.clone()}));
  const extras=new Set(['Knife_Offhand','1H_Crossbow','2H_Crossbow','Knife','Throwable']);
  model.traverse(o=>{
    if(extras.has(o.name))o.visible=false;
    if(o.isMesh){o.frustumCulled=false;o.material.roughness=.85;}
  });
  scene.add(model);
  const cape=model.getObjectByName('Rogue_Cape');
  const capeRest=cape?.quaternion.clone();
  const mixer=new THREE.AnimationMixer(model);
  const clips=Object.fromEntries(gltf.animations.map(c=>[c.name,c]));
  if(!clips[clipName])throw new Error(`Missing walk clip ${clipName}`);
  clips.Walking_B=clips[clipName];
  const channels=new Map();
  const bones=Object.fromEntries(['upperleg.l','lowerleg.l','foot.l','upperleg.r','lowerleg.r','foot.r','toes.l','toes.r','hips','spine','chest','head','upperarm.l','lowerarm.l','wrist.l','hand.l','upperarm.r','lowerarm.r','wrist.r','hand.r'].map(n=>[n,model.getObjectByName(n.replaceAll('.',''))||model.getObjectByName(n)]));
  const footRest={},toeRest={};
  // A heel-contact key is already tilted. Level soles come from the neutral
  // skeleton, separately for each side; toe roll cannot be inherited from a
  // different gait after replacing the ankle motion.
  model.updateMatrixWorld(true);
  for(const side of ['l','r']){
    footRest[side]=bones[`foot.${side}`].getWorldQuaternion(new THREE.Quaternion());
    toeRest[side]=bones[`toes.${side}`].quaternion.clone();
  }

  const worldPosition=o=>o.getWorldPosition(new THREE.Vector3());
  function setWorldRotation(bone,q){
    const parent=bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    bone.quaternion.copy(parent.multiply(q));
    bone.updateMatrixWorld(true);
  }
  function pointBone(bone,child,target){
    const here=worldPosition(bone);
    const before=worldPosition(child).sub(here).normalize();
    const after=target.clone().sub(here).normalize();
    const turn=new THREE.Quaternion().setFromUnitVectors(before,after);
    setWorldRotation(bone,turn.multiply(bone.getWorldQuaternion(new THREE.Quaternion())));
  }
  function solveLeg(side,target){
    const hip=bones[`upperleg.${side}`],knee=bones[`lowerleg.${side}`],foot=bones[`foot.${side}`];
    const a=worldPosition(hip),b=worldPosition(knee),c=worldPosition(foot);
    const upper=a.distanceTo(b),lower=b.distanceTo(c);
    const distance=a.distanceTo(target);
    if(distance>=upper+lower)throw new Error(`Unreachable ${side} foot: ${distance} > ${upper+lower}`);
    const axis=target.clone().sub(a).normalize();
    const along=(upper*upper-lower*lower+distance*distance)/(2*distance);
    const pole=new THREE.Vector3(0,0,1).addScaledVector(axis,-axis.z).normalize();
    const bend=Math.sqrt(Math.max(0,upper*upper-along*along));
    const goal=a.clone().addScaledVector(axis,along).addScaledVector(pole,bend);
    pointBone(hip,knee,goal);
    pointBone(knee,foot,target);
  }
  function groundWalk(phase){
    // Keep the authored upper-body motion. Two-bone IK supplies an exact
    // constant-speed stance and a smooth toe-clearance arc for the same mesh.
    bones.hips.position.y=.328 + .010*Math.cos(phase*Math.PI*4);
    model.updateMatrixWorld(true);
    for(const [side,offset,sign] of [['l',0,1],['r',.5,-1]]){
      const p=(phase+offset)%1;
      const stance=p<=.6;
      const swing=Math.max(0,(p-.6)/.4);
      const travel=FOUNDER_STRIDE*.6;
      // Match tangent velocity at lift-off and landing; the Hermite swing
      // starts and ends with the same backward velocity as the planted foot.
      const s=swing;
      const z=stance ? travel/2-FOUNDER_STRIDE*p
        : (2*s*s*s-3*s*s+1)*(-travel/2)+(s*s*s-2*s*s+s)*(-FOUNDER_STRIDE*.4)
          +(-2*s*s*s+3*s*s)*(travel/2)+(s*s*s-s*s)*(-FOUNDER_STRIDE*.4);
      const y=.1463245+(stance?0:.13*Math.sin(Math.PI*s)**2);
      solveLeg(side,new THREE.Vector3(sign*.170945,y,z));
      const q=footRest[side].clone();
      if(!stance)q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-.22*Math.sin(Math.PI*s)));
      setWorldRotation(bones[`foot.${side}`],q);
      bones[`toes.${side}`].quaternion.copy(toeRest[side]);
    }
    if(cape){cape.quaternion.copy(capeRest);cape.rotation.x+=.025*Math.sin(phase*Math.PI*2-.8);cape.rotation.z+=.022*Math.sin(phase*Math.PI*2);}
  }
  const smooth=(a,b,t)=>{const x=THREE.MathUtils.clamp((t-a)/(b-a),0,1);return x*x*(3-2*x);};
  const envelope=(t,a,b,c,d)=>smooth(a,b,t)*(1-smooth(c,d,t));
  function rotateWorld(bone,axis,angle){
    setWorldRotation(bone,new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...axis),angle).multiply(bone.getWorldQuaternion(new THREE.Quaternion())));
  }
  function solveArm(side,target,pole,hinge=false){
    const shoulder=bones[`upperarm.${side}`],elbow=bones[`lowerarm.${side}`],wrist=bones[`wrist.${side}`];
    const a=worldPosition(shoulder),b=worldPosition(elbow),c=worldPosition(wrist);
    const u=a.distanceTo(b),l=b.distanceTo(c),distance=a.distanceTo(target);
    if(distance>=u+l)throw new Error(`Unreachable ${side} hand: ${distance}`);
    const axis=target.clone().sub(a).normalize();
    const along=(u*u-l*l+distance*distance)/(2*distance);
    const perpendicular=pole.clone().addScaledVector(axis,-pole.dot(axis)).normalize();
    const goal=a.clone().addScaledVector(axis,along).addScaledVector(perpendicular,Math.sqrt(Math.max(0,u*u-along*along)));
    pointBone(shoulder,elbow,goal);
    if(hinge){
      // Swivel the upper arm until the elbow's existing bend plane contains
      // the target. A second unconstrained shortest-arc turn at the elbow
      // twists the sleeve instead of flexing its hinge.
      const pivot=worldPosition(shoulder),joint=worldPosition(elbow);
      const upperAxis=joint.clone().sub(pivot).normalize();
      const current=worldPosition(wrist).sub(joint);
      const desired=target.clone().sub(joint);
      current.addScaledVector(upperAxis,-current.dot(upperAxis)).normalize();
      desired.addScaledVector(upperAxis,-desired.dot(upperAxis)).normalize();
      const swivel=Math.atan2(upperAxis.dot(current.clone().cross(desired)),current.dot(desired));
      setWorldRotation(shoulder,new THREE.Quaternion().setFromAxisAngle(upperAxis,swivel).multiply(shoulder.getWorldQuaternion(new THREE.Quaternion())));
    }
    pointBone(elbow,wrist,target);
  }
  function stand(name,phase){
    const tau=phase*Math.PI*2;
    const gesture=name!=='Founder_Idle';
    const look=gesture?envelope(phase,.025,.17,.74,.94):Math.sin(tau)*.14;
    const reach=name==='Founder_Point'?envelope(phase,.12,.35,.65,.88):name==='Founder_Beckon'?envelope(phase,.06,.23,.74,.94):0;
    bones.hips.position.set(.008*Math.sin(tau),.373+.004*(1-Math.cos(tau)),0);
    bones.hips.quaternion.identity();model.updateMatrixWorld(true);
    rotateWorld(bones.chest,[0,1,0],-.11*(gesture?look:Math.sin(tau)*.4));
    rotateWorld(bones.head,[0,1,0],gesture?-.22*look:.19*Math.sin(tau));
    rotateWorld(bones.head,[1,0,0],gesture?.055*look:.018*(1-Math.cos(tau)));
    // Feet stay still while weight and the shoulders move above them.
    for(const [side,sign] of [['l',1],['r',-1]]){
      solveLeg(side,new THREE.Vector3(sign*.21,.1463245,side==='l'?-.025:.025));
      const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),sign*.10).multiply(footRest[side]);
      setWorldRotation(bones[`foot.${side}`],q);bones[`toes.${side}`].quaternion.copy(toeRest[side]);
    }
    model.updateMatrixWorld(true);
    if(gesture){
      const wrist=bones['wrist.r'],hand=bones['hand.r'];
      const rest=worldPosition(wrist);
      let target, armWeight=reach;
      const armBones=[bones['upperarm.r'],bones['lowerarm.r']];
      const armRest=armBones.map(b=>b.quaternion.clone());
      if(name==='Founder_Point'){
        // An anticipation near the chest opens into a soft-elbow indication.
        const gather=envelope(phase,.025,.12,.17,.30);
        armWeight=Math.max(reach,gather);
        target=rest.clone().lerp(new THREE.Vector3(-.37,.99,.21),gather);
        target.lerp(new THREE.Vector3(-.38,1.03+.008*Math.sin(tau*2),.40),reach);
      }else{
        const sweep=envelope(phase,.28,.40,.43,.54)+envelope(phase,.55,.66,.69,.78);
        target=rest.clone().lerp(new THREE.Vector3(-.405,1.21+.12*sweep,.25-.18*sweep),reach);
      }
      solveArm('r',target,new THREE.Vector3(-1,-.65,0),name==='Founder_Point');
      armBones.forEach((b,i)=>b.quaternion.copy(armRest[i].slerp(b.quaternion,armWeight)));
      model.updateMatrixWorld(true);
      const restHand=bindPose.find(p=>p.o===hand).q;
      if(name==='Founder_Point'){
        // A pointing hand follows the forearm. A separate world-space aim
        // folded this thick glove through the cuff during the held pose.
        const restWrist=bindPose.find(p=>p.o===wrist).q;
        wrist.quaternion.slerp(restWrist,armWeight);
        hand.quaternion.slerp(restHand,armWeight);
      }else{
        const base=wrist.getWorldQuaternion(new THREE.Quaternion());
        const palm=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(0,1,.35).normalize());
        setWorldRotation(wrist,base.slerp(palm,reach));
        hand.quaternion.slerp(restHand,reach);
      }
    }
    if(cape){cape.quaternion.copy(capeRest);cape.rotation.x+=.014*Math.sin(tau-.4);cape.rotation.z+=.012*Math.sin(tau);}
  }
  function pose(name,phase,yaw=0){
    phase=((phase%1)+1)%1;
    // Explicit assignment is important here. AnimationMixer can skip a write
    // when a sampled source value is unchanged; IK has since changed that
    // property. Reset + sample makes reverse scrubbing and rebakes independent.
    for(const {o,p,q,s} of bindPose){o.position.copy(p);o.quaternion.copy(q);o.scale.copy(s);}
    model.rotation.y=0;
    const standing=name.startsWith('Founder_');
    const sourceName=standing?'Idle':name;
    if(!channels.has(sourceName))channels.set(sourceName,clips[sourceName].tracks.map(track=>{
      const split=track.name.lastIndexOf('.');
      const node=model.getObjectByName(track.name.slice(0,split));
      if(!node)throw new Error(`Missing animated node ${track.name}`);
      return{node,property:track.name.slice(split+1),sample:track.createInterpolant()};
    }));
    for(const {node,property,sample} of channels.get(sourceName))node[property].fromArray(sample.evaluate(phase*clips[sourceName].duration));
    model.updateMatrixWorld(true);
    if(name==='Walking_B'&&applyGrounding)groundWalk(phase);
    if(standing)stand(name,phase);
    model.rotation.y=yaw;
    model.updateMatrixWorld(true);
  }
  function render(){renderer.render(scene,camera);}
  function landmarks(){
    return Object.fromEntries(Object.entries(bones).filter(([,v])=>v).map(([name,b])=>{
      const world=b.getWorldPosition(new THREE.Vector3());
      const p=world.clone().project(camera);
      return [name,{world:world.toArray(),rotation:b.getWorldQuaternion(new THREE.Quaternion()).toArray(),pixel:[(p.x*.5+.5)*width,(-p.y*.5+.5)*height]}];
    }));
  }
  return {renderer,scene,camera,model,mixer,clips,pose,render,landmarks,THREE};
}
