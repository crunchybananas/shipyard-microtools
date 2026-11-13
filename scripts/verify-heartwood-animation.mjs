import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../docs/heartwood-island/vendor/three.module.js';
import {GLTFLoader} from '../docs/heartwood-island/vendor/addons/loaders/GLTFLoader.js';
import {buildFrogRig,createFrogAnimator,sampleHop} from '../docs/heartwood-island/frog-animation.mjs';
const bytes=await readFile('docs/heartwood-island/assets/frog-alchemist.glb');
const model=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const rig=buildFrogRig(model.scene),original=new T.Box3().setFromObject(model.scene),actual=new T.Box3().setFromObject(rig.root);
for(const edge of ['min','max'])assert.ok(original[edge].distanceTo(actual[edge])<1e-6,'neutral silhouette unchanged');
const triangles=root=>{let n=0;root.traverse(o=>{if(o.isMesh)n+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});return n;};
assert.equal(triangles(rig.root),triangles(model.scene));assert.ok(rig.meshCount<=32);
let integral=0;for(let i=0;i<10000;i++)integral+=sampleHop((i+.5)/10000).travel/10000;assert.ok(Math.abs(integral-1)<.001);
assert.equal(sampleHop(.1).travel,0);assert.ok(Math.abs(sampleHop(.18-1e-6).crouch-sampleHop(.18+1e-6).crouch)<.001);
const anim=createFrogAnimator(rig),states=new Set();let height=0,blink=0,pose;
for(let i=0;i<600;i++){pose=anim.update(1/60,{moving:i<240});states.add(pose.state);height=Math.max(height,pose.height);blink=Math.max(blink,pose.blink||0);if(i>=240)assert.equal(pose.travel,0,'input release stops travel');}
for(const s of ['crouching','airborne','landing','idle'])assert.ok(states.has(s));assert.ok(height>.29);assert.ok(blink>.8);assert.equal(pose.height,0);
anim.celebrate();assert.equal(anim.update(.016).state,'celebrating');
assert.equal(anim.update(.016,{motion:false,moving:true}).travel,1);assert.equal(rig.root.position.y,0);
for(const p of Object.values(rig.parts)){assert.deepEqual(p.scale.toArray(),[1,1,1]);assert.deepEqual(p.rotation.toArray().slice(0,3),[0,0,0]);}
console.log(`PASS original bounds/triangles, ${rig.meshCount} batches, continuous crouch, hop travel, input release, landing, blink, celebration, reduced motion`);
