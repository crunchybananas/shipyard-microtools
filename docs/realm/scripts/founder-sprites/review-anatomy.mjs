#!/usr/bin/env node
// Review a staged saved-scene export before promoting or baking production maps.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
import {ensureServer} from '../_serve.mjs';
import {normalizeBlenderTiming} from './export-glb.mjs';
import {FOUNDER_ACTIONS} from './actions.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const source=resolve(root,process.argv[2]||'tmp/founder-sprites/anatomy-206/founder-anatomy.glb');
const output=resolve(root,process.argv[3]||'tmp/founder-sprites/anatomy-206/review');
assert.ok(source.startsWith(resolve(root,'tmp')+'/'),'Use a staged export');
await mkdir(output,{recursive:true});
await writeFile(source,normalizeBlenderTiming(await readFile(source),Object.fromEntries(Object.values(FOUNDER_ACTIONS).map(a=>[a.clip,a.duration]))));
const server=await ensureServer();
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${server.origin}/scripts/founder-sprites/bake.html`);
  await page.waitForFunction(()=>window.ready);
  const report=await page.evaluate(async({modelPath,actions})=>{
    const {createFounderRig}=await import('./rig.js');
    const {dressFounderForSettlement,lightFounderBake}=await import('./settlement-materials.js');
    const actor=await createFounderRig({width:384,height:504,modelURL:`/${modelPath}`,applyGrounding:false,clipName:'Realm_Grounded_Walk'});
    const wardrobe=dressFounderForSettlement(actor.model,actor.renderer);
    const dispose=lightFounderBake(actor),images=[];
    for(const [id,action] of Object.entries(actions)){
      const canvas=document.createElement('canvas');canvas.width=8*192;canvas.height=3*270;
      const ctx=canvas.getContext('2d');ctx.fillStyle='#263538';ctx.fillRect(0,0,canvas.width,canvas.height);
      for(let row=0;row<3;row++)for(let dir=0;dir<8;dir++){
        actor.pose(action.clip,row===0?0:row===1?.375:.625,dir*Math.PI/4);actor.render();
        ctx.drawImage(actor.renderer.domElement,dir*192,row*270,192,252);
        ctx.fillStyle='#d1d4c9';ctx.font='12px system-ui';ctx.fillText(`${['S','SE','E','NE','N','NW','W','SW'][dir]} · ${row===0?'ready':row===1?'hold':'recover'}`,dir*192+20,row*270+263);
      }
      images.push({id,png:canvas.toDataURL()});
    }
    // A close view reveals sleeve contact and facial proportions at the held point.
    actor.camera.zoom=1.5;actor.camera.updateProjectionMatrix();
    actor.pose(actions.point.clip,.375,Math.PI/4);actor.render();
    images.push({id:'point-close',png:actor.renderer.domElement.toDataURL()});
    dispose();actor.renderer.dispose();
    return {images,stats:wardrobe.stats};
  },{modelPath:relative(root,source),actions:FOUNDER_ACTIONS});
  assert.deepEqual(errors,[]);
  for(const {id,png} of report.images)await writeFile(resolve(output,`${id}.png`),Buffer.from(png.split(',')[1],'base64'));
  console.log(JSON.stringify({source,output,stats:report.stats,errors}));
}finally{await browser.close();await server.stop();}
