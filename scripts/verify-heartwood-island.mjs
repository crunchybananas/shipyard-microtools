import assert from 'node:assert/strict';
import * as THREE from '../docs/heartwood-island/vendor/three.module.js';
import {createWorld} from '../docs/heartwood-island/world.mjs';
import {SHRINES,PLATES,freshSave,validateSave,walkable,findPath,configureNavigation} from '../docs/heartwood-island/model.mjs';
assert.deepEqual(validateSave(freshSave()),freshSave());assert.throws(()=>validateSave({...freshSave(),complete:true}));assert.throws(()=>validateSave({...freshSave(),plates:['bad']}));assert.throws(()=>validateSave({...freshSave(),shrines:['moon','moon']}));assert.throws(()=>validateSave({...freshSave(),version:2}));assert.equal(walkable(-3,-1),false);assert.equal(walkable(20,0),false);assert.deepEqual(findPath({x:4,z:5},{x:-3,z:-1}),[]);
const world=createWorld(new THREE.Scene());configureNavigation(world.colliders);for(const target of [...SHRINES,...PLATES]){const path=findPath({x:4,z:5},{x:target.x,z:target.z+1.3});assert.ok(path.length,`Reach ${target.id}`);assert.ok(path.every(p=>walkable(p.x,p.z)));}
const final=validateSave({...freshSave(),complete:true,shrines:SHRINES.map(s=>s.id),plates:PLATES.map(p=>p.id)});assert.equal(final.complete,true);world.update(1,.016,true);console.log('PASS island model: save validation, pond/shore collision, all 8 destinations reachable around trees, completed world update');
