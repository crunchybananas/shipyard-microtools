import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {register} from 'node:module';
import * as THREE from '../../vendor/three/three.module.js';
const url=new URL('../../vendor/three/three.module.js',import.meta.url).href;
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(url)},shortCircuit:true};return n(s,c);}`));
const {GLTFLoader}=await import('../../vendor/three/GLTFLoader.js');
const {VillageWorld}=await import('../js/world.js');
const bytes=await readFile(new URL('../assets/husbandry-kit.glb',import.meta.url));
const kit=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');

test('authored shelters and their upgraded models fit one tile with one painted static mesh',()=>{
 for(const name of ['pasture','henhouse','assay','pasture_upgrade','henhouse_upgrade','assay_upgrade']){
  const model=kit.scene.getObjectByName(name);assert.ok(model,name);let meshes=0;model.traverse(o=>{if(o.isMesh){meshes++;assert.ok(o.geometry.attributes.color);}});assert.equal(meshes,1);
  const bounds=new THREE.Box3().setFromObject(model);assert.ok(bounds.max.x<=.90&&bounds.min.x>=-.90&&bounds.max.z<=.90&&bounds.min.z>=-.90,name);
 }
});
test('farm animals animate their pivots, keep the pause pose, grow in scale, and disappear when sold',()=>{
 const world=Object.create(VillageWorld.prototype),b={id:'pen',type:'pasture',level:1,status:'ready'},root=new THREE.Group(),model=new THREE.Group();root.add(model);root.userData.model=model;
 Object.assign(world,{templates:new Map(kit.scene.children.map(o=>[o.name,o])),buildings:new Map([['pen',root]]),state:{buildings:[b],livestock:{pens:{pen:{animals:[{id:1,age:720},{id:2,age:0}],condition:1,breeding:true,birthProgress:0}}}}});
 world.updateLivestock(.1,1);const adult=root.userData.animals.get(1),young=root.userData.animals.get(2);assert.equal(adult.userData.legs.length,4);assert.equal(adult.userData.head.isMesh,undefined);assert.ok(young.scale.x<adult.scale.x);
 const pose=()=>[...adult.position.toArray(),...adult.rotation.toArray(),...adult.userData.head.rotation.toArray()];const before=pose();world.updateLivestock(.1,0);assert.deepEqual(pose(),before);world.updateLivestock(.1,1);assert.notDeepEqual(pose(),before);
 world.state.livestock.pens.pen.animals.pop();world.updateLivestock(0,0);assert.equal(root.userData.animals.size,1);assert.equal(young.parent,null);
});
