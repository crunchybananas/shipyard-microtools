#!/usr/bin/env node
// Export a single choreographed candidate. The normal rebuild reads Blender.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
import {ensureServer} from '../_serve.mjs';
import {exportGroundedGLB} from './export-glb.mjs';
import {FOUNDER_ACTIONS} from './actions.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const id=process.argv[2],out=process.argv[3];
if(!FOUNDER_ACTIONS[id]||!out||!resolve(out).startsWith(resolve(root,'tmp')+'/'))throw new Error('Usage: export-authored-action.mjs <action> tmp/<candidate>.glb');
const source=await readFile(resolve(root,'assets/sprites/founder/source/rogue.glb'));
const doc=JSON.parse(source.subarray(20,20+source.readUInt32LE(12)).toString());
const server=await ensureServer(),browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage();await page.goto(`${server.origin}/scripts/founder-sprites/bake.html`);await page.waitForFunction(()=>window.ready);
 const action=FOUNDER_ACTIONS[id];
 const samples=await page.evaluate(({action,names})=>Array.from({length:action.frames+1},(_,f)=>{
  rig.pose(action.source,f/action.frames,0);
  return Object.fromEntries(names.map(name=>{const o=rig.model.getObjectByName(rig.THREE.PropertyBinding.sanitizeNodeName(name));return[name,{translation:o.position.toArray(),rotation:o.quaternion.toArray(),scale:o.scale.toArray()}];}));
 }),{action,names:doc.nodes.map(n=>n.name)});
 await mkdir(dirname(resolve(out)),{recursive:true});
 await writeFile(out,exportGroundedGLB(source,{[id]:{name:action.clip,duration:action.duration,samples}}));
 console.log(`Exported ${id} candidate: ${out}`);
}finally{await browser.close();await server.stop();}
