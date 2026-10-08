import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {register} from 'node:module';
const threeURL=new URL('../../vendor/three/three.module.js',import.meta.url).href;
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(threeURL)},shortCircuit:true};return n(s,c);}`));
const THREE=await import('three');
const {GLTFLoader}=await import('../../vendor/three/GLTFLoader.js');
const {VillageWorld}=await import('../js/world.js');
async function asset(name){const b=await readFile(new URL('../assets/'+name,import.meta.url));return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
test('authored axe keeps its handle in the grip and cutting edge in the vertical swing plane',async()=>{
 const w=Object.create(VillageWorld.prototype),yard={id:'yard',type:'lumber',x:0,z:0,rotation:0};
 Object.assign(w,{state:{buildings:[yard]},actors:[],scene:new THREE.Scene(),templates:new Map(),nearestWalkable:()=>({x:0,z:1}),publicDestination:()=>null,emitSound:()=>{}});
 for(const file of ['village-kit.glb','town-kit.glb','living-kit.glb']){const gltf=await asset(file);gltf.scene.traverse(n=>{if(['villager','tool_axe','cargo_logs'].includes(n.name))w.templates.set(n.name,n);});}
 const a=w.addActor(0,{id:'c1',job:'lumberjack',workplace:'yard'}),grip=a.tool.position.clone();
 for(let step=0;step<120;step++){
   w.jobPose(a,true,1/60);a.root.updateMatrixWorld(true);
   const edge=new THREE.Vector3(1,0,0).applyQuaternion(a.tool.getWorldQuaternion(new THREE.Quaternion()));
   const shaft=new THREE.Vector3(0,1,0).applyQuaternion(a.tool.getWorldQuaternion(new THREE.Quaternion()));
   assert.ok(Math.abs(edge.x)<1e-6,'The blade must not point sideways across the chop');
   assert.ok(Math.abs(shaft.x)<1e-6,'Turning the head must not rotate the handle sideways');
   assert.ok(Math.abs(edge.dot(shaft))<1e-6,'Blade remains perpendicular to its handle');
   assert.ok(a.tool.position.distanceTo(grip)<1e-8,'The grip stays in the hand');
   if(Math.sin(a.phase)>.95)assert.ok(edge.y<-.75,'At impact the cutting edge leads downward');
 }
});
