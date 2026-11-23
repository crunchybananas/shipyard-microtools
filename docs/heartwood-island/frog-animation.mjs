import * as THREE from './vendor/three.module.js';
import {mergeGeometries} from './vendor/addons/utils/BufferGeometryUtils.js';

// Preserve every original vertex/material, but batch by articulated region instead of
// flattening the entire frog. The neutral pose is exactly the approved sculpture.
export function buildFrogRig(source) {
 source.updateMatrixWorld(true);
 const root=new THREE.Group();root.name='Frog animation root';
 const definitions={
  body:{at:[0,.43,0]}, head:{at:[0,.77,.02],parent:'body'},
  hat:{at:[0,1.09,0],parent:'head'}, cape:{at:[0,.72,-.02],parent:'body'},
  eyeL:{at:[-.215,1.02,.23],parent:'head'},eyeR:{at:[.215,1.02,.23],parent:'head'},
  armL:{at:[-.24,.62,.03],parent:'body'},armR:{at:[.26,.62,.02],parent:'body'},
  legL:{at:[-.29,.29,0]},legR:{at:[.29,.29,0]},
  footL:{at:[-.30,.08,.17]},footR:{at:[.30,.08,.17]},
 };
 const parts={};
 for(const [name,def]of Object.entries(definitions)){const group=new THREE.Group();group.name=name;const parent=def.parent?parts[def.parent]:root,p=def.parent?definitions[def.parent].at:[0,0,0];group.position.set(...def.at.map((n,i)=>n-p[i]));parent.add(group);parts[name]=group;}
 const batches=new Map();
 source.traverse(object=>{if(!object.isMesh)return;const name=object.name.replaceAll('_',' ');let part='body';
  if(/Ivory eye|Pupil|Catchlight/.test(name))part=/ -1/.test(name)?'eyeL':'eyeR';
  else if(/hat|Hatband/i.test(name))part='hat';
  else if(/Draped|Cape front|Cape hem/.test(name))part='cape';
  else if(/Eye mound|Broad frog|Soft lower jaw|Nostril|mouth|Cheek/.test(name))part='head';
  else if(/Thinking|Finger at chin/.test(name))part='armL';
  else if(/Supporting right|Open right|Flask supporting|flask|Bottle|Cork|Golden remedy/.test(name))part='armR';
  else if(/Folded haunch/.test(name))part=/ -1/.test(name)?'legL':'legR';
  else if(/Heel|Toe pad|Webbed foot/.test(name))part=/ -1/.test(name)?'footL':'footR';
  const geometry=object.geometry.clone().applyMatrix4(object.matrixWorld),pivot=definitions[part].at;
  geometry.translate(-pivot[0],-pivot[1],-pivot[2]);for(const attr of Object.keys(geometry.attributes))if(!['position','normal'].includes(attr))geometry.deleteAttribute(attr);
  const key=part+object.material.uuid,batch=batches.get(key)||{part,material:object.material,geometries:[]};batch.geometries.push(geometry);batches.set(key,batch);
 });
 for(const batch of batches.values()){const geometry=mergeGeometries(batch.geometries);if(!geometry)throw Error('Could not prepare articulated frog');const mesh=new THREE.Mesh(geometry,batch.material);mesh.castShadow=true;mesh.receiveShadow=true;parts[batch.part].add(mesh);batch.geometries.forEach(g=>g.dispose());}
 return {root,parts,meshCount:batches.size};
}
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
export function sampleHop(phase) {
 const p=clamp(phase),flight=clamp((p-.18)/.60),height=p>.18&&p<.78?Math.sin(Math.PI*flight)*.30:0;
 const crouch=p<.18?Math.sin(p/.18*Math.PI/2):p>.78?Math.sin((p-.78)/.22*Math.PI)*.72:Math.max(0,1-flight/.15);
 return {height,crouch,flight,travel:p>=.18&&p<.78?1/.60:0,airborne:height>.001};
}
export function createFrogAnimator(rig) {
 const {root,parts:p}=rig;let time=0,phase=0,hopping=false,celebration=0,hatLag=0,capeLag=0,previousPitch=0;
 const base={};for(const[name,part]of Object.entries(p))base[name]=part.position.clone();
 function neutral(){root.position.y=0;root.rotation.x=0;root.rotation.z=0;for(const[name,part]of Object.entries(p)){part.position.copy(base[name]);part.rotation.set(0,0,0);part.scale.set(1,1,1);}hatLag=0;capeLag=0;previousPitch=0;}
 return {
  celebrate(){celebration=1.8;},
  update(dt,{moving=false,motion=true,turn=0,attention=0}={}){
   dt=clamp(dt,0,.08);time+=dt;
   if(!motion){phase=0;hopping=false;celebration=0;neutral();return {travel:1,phase:0,height:0,state:moving?'moving-reduced':'idle-reduced'};}
   if(moving&&!hopping){hopping=true;phase=0;}
   if(hopping){phase+=dt/.63;if(phase>=1){phase%=1;if(!moving){hopping=false;phase=0;}}}
   if(celebration>0)celebration=Math.max(0,celebration-dt);
   const hop=hopping?sampleHop(phase):{height:0,crouch:0,flight:0,travel:0,airborne:false};
   const breathing=Math.sin(time*2.15)*.008,idle=hopping?0:1;
   const cheer=celebration>0?Math.sin((1.8-celebration)/1.8*Math.PI):0;
   root.position.y=hop.height+(cheer?Math.abs(Math.sin((1.8-celebration)*7))*.08*cheer:0);
   p.body.scale.set(1+hop.crouch*.065,1-hop.crouch*.13+breathing,1+hop.crouch*.035);
   p.body.position.y=base.body.y-hop.crouch*.045;
   const pitch=hopping?Math.sin(hop.flight*Math.PI*2)*.095:-.015+Math.sin(time*.9)*.012;
   p.body.rotation.x=pitch;p.body.rotation.z=-clamp(turn,-1,1)*.045;
   p.head.rotation.x=-pitch*.35+idle*Math.sin(time*.75)*.025-cheer*.06;
   p.head.rotation.y=idle*Math.sin(time*.52)*.055+clamp(attention,-1,1)*.08;
   p.head.rotation.z=idle*Math.sin(time*.37)*.025;
   // Hat and cape react with different lag, rather than moving as one solid statue.
   hatLag=THREE.MathUtils.damp(hatLag,-pitch*.65-(pitch-previousPitch)*1.8,10,dt);
   capeLag=THREE.MathUtils.damp(capeLag,hop.airborne?.12+Math.sin(hop.flight*Math.PI)*.08:-.03,7,dt);
   p.hat.rotation.x=hatLag;p.hat.rotation.z=Math.sin(time*1.7)*.012+clamp(turn,-1,1)*.025;
   p.cape.rotation.x=capeLag;p.cape.rotation.z=Math.sin(time*2)*.018;
   p.legL.rotation.x=p.legR.rotation.x=hop.airborne?-.28*Math.sin(Math.PI*hop.flight):hop.crouch*.16;
   p.legL.rotation.z=-hop.crouch*.06;p.legR.rotation.z=hop.crouch*.06;
   p.footL.rotation.x=p.footR.rotation.x=hop.airborne?.30*Math.sin(Math.PI*hop.flight):-hop.crouch*.08;
   p.footL.position.y=p.footR.position.y=base.footL.y+(hop.airborne?.035*Math.sin(Math.PI*hop.flight):0);
   p.armL.rotation.z=idle*Math.sin(time*.8)*.018-pitch*.25;
   p.armR.rotation.z=cheer*.15+idle*Math.sin(time*.65)*.025;
   p.armR.rotation.x=-pitch*.75-cheer*.08; // Palm and flask are one articulated unit.
   // Eyes retract into the unchanged green mounds, like a real frog blink.
   const blinkPhase=time%5.7;
   const blink=Math.max(1-Math.abs(blinkPhase-4.55)/.11, .65*(1-Math.abs(blinkPhase-4.86)/.09),0);
   p.eyeL.scale.y=1-blink*.88;p.eyeR.scale.y=1-blink*.88;
   p.eyeL.position.z=base.eyeL.z-blink*.18;p.eyeR.position.z=base.eyeR.z-blink*.18;
   previousPitch=pitch;
   return {travel:moving?hop.travel:0,phase:phase,height:root.position.y,state:celebration?'celebrating':hopping?(hop.airborne?'airborne':phase<.18?'crouching':'landing'):'idle',blink};
  },
 };
}
