#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join, dirname, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { ensureServer } from '../_serve.mjs';
import { exportGroundedGLB } from './export-glb.mjs';
import { FOUNDER_DIRECTIONS, FOUNDER_TIERS, FOUNDER_ANCHOR, FOUNDER_STRIDE, FOUNDER_VIEW_HEIGHT } from './contract.js';
import { FOUNDER_ACTIONS, actionTiers } from './actions.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const out=resolve(root,process.argv.includes('--out')?process.argv[process.argv.indexOf('--out')+1]:'assets/sprites/founder');
const fromBlender=process.argv.includes('--from-blender');
const modelPath=fromBlender?'assets/sprites/founder/source/blender-actions.glb':'assets/sprites/founder/source/rogue.glb';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const server=await ensureServer();
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  await mkdir(out,{recursive:true});
  await mkdir(join(out,'runtime'),{recursive:true});
  const page=await browser.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${server.origin}/scripts/founder-sprites/bake.html`);
  await page.waitForFunction(()=>window.ready,null,{timeout:30000});
  const modelSource=await readFile(join(root,modelPath));
  const modelJSON=JSON.parse(modelSource.subarray(20,20+modelSource.readUInt32LE(12)).toString());
  const library={},outputs=[],actionReports={};
  for(const [id,action] of Object.entries(FOUNDER_ACTIONS)){
    const tiers=actionTiers(id,FOUNDER_TIERS);
    const bundle=await page.evaluate(async({directions,action,tiers,nodeNames,modelPath,fromBlender})=>{
      const {createFounderRig}=await import('./rig.js');
      const {dressFounderForSettlement,lightFounderBake}=await import('./settlement-materials.js');
      const actor=await createFounderRig({width:384,height:504,modelURL:`/${modelPath}`,applyGrounding:!fromBlender,clipName:fromBlender?'Realm_Grounded_Walk':'Walking_B'});
      dressFounderForSettlement(actor.model,actor.renderer);
      const disposeEnvironment=lightFounderBake(actor);
      const name=fromBlender?action.clip:action.source,frames=action.frames;
      const planes=tiers.map(tier=>{const canvas=document.createElement('canvas');canvas.width=tier.frameW*frames;canvas.height=tier.frameH*directions.length;return{tier,canvas,ctx:canvas.getContext('2d',{willReadFrequently:true})};});
      const proof=document.createElement('canvas');proof.width=8*160;proof.height=190;
      const proofCtx=proof.getContext('2d');proofCtx.fillStyle='#293c40';proofCtx.fillRect(0,0,proof.width,proof.height);
      const records=[],samples=[];
      for(let frame=0;frame<=frames;frame++){
        actor.pose(name,frame/frames,0);
        samples.push(Object.fromEntries(nodeNames.map(name=>{
          const o=actor.model.getObjectByName(actor.THREE.PropertyBinding.sanitizeNodeName(name));
          if(!o)throw new Error(`Missing source node ${name}`);
          return[name,{translation:o.position.toArray(),rotation:o.quaternion.toArray(),scale:o.scale.toArray()}];
        })));
      }
      let firstPNG;
      for(let row=0;row<directions.length;row++)for(let frame=0;frame<frames;frame++){
        const phase=frame/frames;
        actor.pose(name,phase,row*Math.PI/4);actor.render();
        const landmarks=actor.landmarks();
        for(const {tier,ctx} of planes)ctx.drawImage(actor.renderer.domElement,frame*tier.frameW,row*tier.frameH,tier.frameW,tier.frameH);
        if(frame===(action.source==='Walking_B'?0:action.beats[2][0])){proofCtx.drawImage(actor.renderer.domElement,row*160+16,0,128,168);proofCtx.fillStyle='#dce5df';proofCtx.font='14px system-ui';proofCtx.textAlign='center';proofCtx.fillText(directions[row].toUpperCase(),row*160+80,181);}
        if(row===0&&frame===0)firstPNG=actor.renderer.domElement.toDataURL();
        records.push({direction:directions[row],frame,phase,landmarks});
      }
      actor.pose(name,0,0);actor.render();
      const repeatExact=firstPNG===actor.renderer.domElement.toDataURL();
      const metrics=planes.map(({tier,ctx})=>{
        const rows=[];
        for(let r=0;r<directions.length;r++)for(let f=0;f<frames;f++){
          const pixels=ctx.getImageData(f*tier.frameW,r*tier.frameH,tier.frameW,tier.frameH).data;
          let x0=tier.frameW,y0=tier.frameH,x1=-1,y1=-1,alphaPixels=0,edgePixels=0;
          for(let y=0;y<tier.frameH;y++)for(let x=0;x<tier.frameW;x++)if(pixels[(y*tier.frameW+x)*4+3]>16){
            alphaPixels++;x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);
            if(x<2||y<2||x>=tier.frameW-2||y>=tier.frameH-2)edgePixels++;
          }
          rows.push({direction:directions[r],frame:f,bounds:[x0,y0,x1,y1],alphaPixels,edgePixels});
        }
        return{tier:tier.key,frames:rows};
      });
      const images=planes.map(({tier,canvas})=>({file:tier.file,png:canvas.toDataURL()}));
      // Close zoom needs only one facing, not an eight-view 71 MiB image.
      // Copy exact RGBA rows without resampling; authoring sheets stay intact.
      for(const {tier,canvas,ctx} of planes)if(tier.frameW>64){
        const strip=document.createElement('canvas');strip.width=canvas.width;strip.height=tier.frameH;
        const pen=strip.getContext('2d');
        for(let row=0;row<directions.length;row++){
          pen.putImageData(ctx.getImageData(0,row*tier.frameH,canvas.width,tier.frameH),0,0);
          images.push({file:`runtime/${tier.file.replace('.png','')}-${directions[row]}.png`,png:strip.toDataURL()});
        }
      }
      disposeEnvironment();actor.renderer.dispose();
      return{images,proof:proof.toDataURL(),records,metrics,repeatExact,samples};
    },{directions:FOUNDER_DIRECTIONS,action,tiers,nodeNames:modelJSON.nodes.map(n=>n.name),modelPath,fromBlender});
    assert.deepEqual(errors,[],'Browser errors');
    assert.equal(bundle.repeatExact,true,'Pose must not depend on prior frames or direction');
    for(const tier of bundle.metrics)for(const frame of tier.frames){assert.ok(frame.alphaPixels>100,`Blank ${id}/${tier.tier}/${frame.direction}/${frame.frame}`);assert.equal(frame.edgePixels,0,`Clipped ${id}/${tier.tier}/${frame.direction}/${frame.frame}`);}
    library[id]={name:action.clip,samples:bundle.samples,duration:action.duration};
    for(const {file,png} of bundle.images){const bytes=Buffer.from(png.split(',')[1],'base64');await writeFile(join(out,file),bytes);outputs.push({file,sha256:hash(bytes),bytes:bytes.length});}
    await writeFile(join(out,id==='walk'?'directions.png':`${id}-directions.png`),Buffer.from(bundle.proof.split(',')[1],'base64'));
    await writeFile(join(out,id==='walk'?'landmarks.json':`${id}-landmarks.json`),JSON.stringify(bundle.records)+'\n');
    await writeFile(join(out,id==='walk'?'quality.json':`${id}-quality.json`),JSON.stringify(bundle.metrics)+'\n');
    actionReports[id]={...action,tiers,repeatExact:bundle.repeatExact};
    console.log(`[founder bake] ${id}: 8 views × ${action.frames} poses × 3 sizes; no blanks or clipping`);
  }
  for(const [file,clips] of [['founder-actions.glb',library],['founder-walk.glb',{walk:library.walk}]]){
    const glb=exportGroundedGLB(modelSource,clips);
    await writeFile(join(out,file),glb);outputs.push({file,sha256:hash(glb),bytes:glb.length});
  }
  const sourceFiles=[modelPath,'scripts/founder-sprites/rig.js','scripts/founder-sprites/actions.js','scripts/founder-sprites/bake.mjs','scripts/founder-sprites/materials.js','scripts/founder-sprites/settlement-materials.js','scripts/founder-sprites/export-glb.mjs','scripts/founder-sprites/contract.js','vendor/three/three.module.js','vendor/three/three.core.js','vendor/three/GLTFLoader.js','vendor/three/BufferGeometryUtils.js'];
  if(fromBlender)sourceFiles.push('assets/sprites/founder/founder-actions.blend','scripts/founder-sprites/export_blender.py','scripts/founder-sprites/rebuild-from-blender.mjs');
  const sources=await Promise.all(sourceFiles.map(async file=>({file,sha256:hash(await readFile(join(root,file)))})));
  const manifest={version:2,character:'The Founder',authoring:'Kay Lousberg / KayKit Rogue; Realm grounded walk and standing gestures',license:'CC0-1.0',sourceRevision:'672074b73ba276876a19e8816ecdc5241817ab47',sourceURL:'https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0',frames:24,directions:FOUNDER_DIRECTIONS,anchor:FOUNDER_ANCHOR,stride:FOUNDER_STRIDE,duration:FOUNDER_ACTIONS.walk.duration,viewHeight:FOUNDER_VIEW_HEIGHT,tiers:FOUNDER_TIERS,actions:actionReports,sources,outputs,repeatExact:true,sourceMode:fromBlender?'blender-scene':'grounded-rig-bootstrap'};
  manifest.renderStyle={profile:'settlement-v2',physicalMaterials:true,normalMaps:true,selfShadows:true,samples:[384,504]};
  manifest.anatomy=modelJSON.nodes.find(n=>n.extras?.realm_anatomy)?.extras.realm_anatomy||'kaykit-original';
  manifest.runtimeRows={sizes:[128,192],views:8,pattern:'runtime/{action}-{size}-{direction}.png'};
  await writeFile(join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
}finally{await browser.close();await server.stop();}
