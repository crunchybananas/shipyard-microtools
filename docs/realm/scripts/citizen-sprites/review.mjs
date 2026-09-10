#!/usr/bin/env node
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,relative,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
import {ensureServer} from '../_serve.mjs';
import {normalizeBlenderTiming} from '../founder-sprites/export-glb.mjs';
import {BUILDER_ACTIONS} from './contract.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const source=resolve(root,process.argv[2]||'tmp/citizen-sprites/builder-212/builder.glb');
const output=resolve(root,process.argv[3]||'tmp/citizen-sprites/builder-212/review');
assert.ok(source.startsWith(resolve(root,'tmp')+'/'),'Review a staged source');
await mkdir(output,{recursive:true});
await writeFile(source,normalizeBlenderTiming(await readFile(source),Object.fromEntries(Object.values(BUILDER_ACTIONS).map(a=>[a.clip,a.duration]))));
const server=await ensureServer();
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${server.origin}/scripts/citizen-sprites/bake.html`);
  await page.waitForFunction(()=>window.ready);
  const result=await page.evaluate(async({source,actions})=>{
    const {createFounderRig}=await import('../founder-sprites/rig.js');
    const {lightFounderBake}=await import('../founder-sprites/settlement-materials.js');
    const {dressBuilder}=await import('./materials.js');
    const actor=await createFounderRig({width:384,height:504,modelURL:`/${source}`,applyGrounding:false,clipName:actions.walk.clip});
    const wardrobe=dressBuilder(actor.model,actor.renderer),dispose=lightFounderBake(actor),images=[],joints={};
    for(const [id,action] of Object.entries(actions)){
      const c=document.createElement('canvas');c.width=8*192;c.height=3*270;
      const ctx=c.getContext('2d');ctx.fillStyle='#303d3c';ctx.fillRect(0,0,c.width,c.height);
      const phases=id==='work'?[0,.27,.48]:[0,.375,.625];
      for(let row=0;row<3;row++)for(let d=0;d<8;d++){
        actor.pose(action.clip,phases[row],d*Math.PI/4);actor.render();
        ctx.drawImage(actor.renderer.domElement,d*192,row*270,192,252);
        ctx.fillStyle='#d2d4c7';ctx.font='12px system-ui';ctx.fillText(`${['S','SE','E','NE','N','NW','W','SW'][d]} · ${phases[row]}`,d*192+20,row*270+264);
      }
      images.push({id,png:c.toDataURL()});
      actor.pose(action.clip,0,0);joints[id]=actor.landmarks();
    }
    for(const [id,phase] of [['idle',0],['work',.27],['work',.48],['carry',0]]){
      actor.camera.zoom=1.3;actor.camera.updateProjectionMatrix();
      actor.pose(actions[id].clip,phase,Math.PI/4);actor.render();
      images.push({id:`${id}-${phase}-close`,png:actor.renderer.domElement.toDataURL()});
    }
    actor.camera.zoom=4;actor.camera.position.y+=.63;actor.camera.updateProjectionMatrix();
    actor.pose(actions.idle.clip,0,Math.PI/8);actor.render();
    images.push({id:'portrait',png:actor.renderer.domElement.toDataURL()});
    const stats=wardrobe.stats;dispose();actor.renderer.dispose();return {images,stats,joints};
  },{source:relative(root,source),actions:BUILDER_ACTIONS});
  assert.deepEqual(errors,[]);
  for(const {id,png} of result.images)await writeFile(resolve(output,`${id}.png`),Buffer.from(png.split(',')[1],'base64'));
  await writeFile(resolve(output,'report.json'),JSON.stringify({...result,images:result.images.map(i=>i.id),errors},null,2)+'\n');
  console.log(JSON.stringify({output,stats:result.stats,errors}));
}finally{await browser.close();await server.stop();}
