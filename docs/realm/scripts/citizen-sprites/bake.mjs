#!/usr/bin/env node
// Bake the saved builder scene. Runtime PNGs share the exact same skeleton,
// pose, camera and material pass; no bitmap scaling corrects a drifting body.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
import {ensureServer} from '../_serve.mjs';
import {BUILDER_ACTIONS as ACTIONS,BUILDER_DIRECTIONS as DIRECTIONS,BUILDER_TIERS as TIERS,BUILDER_ANCHOR as ANCHOR} from './contract.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const out=resolve(root,process.argv[2]||'assets/sprites/citizens/builder');
const source=resolve(root,process.argv[3]||'assets/sprites/citizens/builder/source/builder.glb');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
await mkdir(join(out,'runtime'),{recursive:true});
const server=await ensureServer(),browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${server.origin}/scripts/citizen-sprites/bake.html`);await page.waitForFunction(()=>window.ready);
  await page.evaluate(async({source,clip})=>{
    const {createFounderRig}=await import('../founder-sprites/rig.js');
    const {lightFounderBake}=await import('../founder-sprites/settlement-materials.js');
    const {dressBuilder}=await import('./materials.js');
    window.builder=await createFounderRig({width:384,height:504,modelURL:`/${source}`,applyGrounding:false,clipName:clip});
    window.wardrobe=dressBuilder(builder.model,builder.renderer);window.disposeLight=lightFounderBake(builder);
  },{source:relative(root,source),clip:ACTIONS.walk.clip});
  const outputs=[],actions={};
  for(const [id,action] of Object.entries(ACTIONS)){
    console.log(`[builder bake] ${id}: rendering 192 authored poses`);
    const bundle=await page.evaluate(({id,action,directions,tiers})=>{
      const planes=tiers.map(tier=>{const canvas=document.createElement('canvas');canvas.width=action.frames*tier.size;canvas.height=8*tier.height;return{tier,canvas,ctx:canvas.getContext('2d',{willReadFrequently:true})};});
      const proof=document.createElement('canvas');proof.width=8*160;proof.height=190;
      const ctx=proof.getContext('2d');ctx.fillStyle='#303d3c';ctx.fillRect(0,0,proof.width,proof.height);
      const records=[];let firstPNG;
      for(let row=0;row<8;row++)for(let frame=0;frame<action.frames;frame++){
        builder.pose(action.clip,frame/action.frames,row*Math.PI/4);builder.render();
        const landmarks=builder.landmarks();
        for(const {tier,ctx} of planes)ctx.drawImage(builder.renderer.domElement,frame*tier.size,row*tier.height,tier.size,tier.height);
        if(frame===(id==='work'?7:0)){
          ctx.drawImage(builder.renderer.domElement,row*160+16,0,128,168);
          ctx.fillStyle='#d8d8c8';ctx.font='13px system-ui';ctx.fillText(directions[row].toUpperCase(),row*160+72,182);
        }
        if(row===0&&frame===0)firstPNG=builder.renderer.domElement.toDataURL();
        records.push({direction:directions[row],frame,phase:frame/action.frames,landmarks});
      }
      builder.pose(action.clip,0,0);builder.render();
      const repeatExact=firstPNG===builder.renderer.domElement.toDataURL();
      const metrics=planes.map(({tier,ctx})=>{
        const frames=[];
        for(let row=0;row<8;row++)for(let frame=0;frame<action.frames;frame++){
          const d=ctx.getImageData(frame*tier.size,row*tier.height,tier.size,tier.height).data;
          let x0=tier.size,y0=tier.height,x1=-1,y1=-1,alphaPixels=0,edgePixels=0;
          for(let y=0;y<tier.height;y++)for(let x=0;x<tier.size;x++)if(d[(y*tier.size+x)*4+3]>16){
            alphaPixels++;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
            if(x<2||y<2||x>=tier.size-2||y>=tier.height-2)edgePixels++;
          }
          frames.push({direction:directions[row],frame,bounds:[x0,y0,x1,y1],alphaPixels,edgePixels});
        }
        return{size:tier.size,frames};
      });
      const images=planes.map(({tier,canvas})=>({file:`${id}-${tier.size}.png`,png:canvas.toDataURL()}));
      for(const {tier,canvas,ctx} of planes)if(tier.size===128){
        const rowCanvas=document.createElement('canvas');rowCanvas.width=canvas.width;rowCanvas.height=tier.height;
        const pen=rowCanvas.getContext('2d');
        for(let row=0;row<8;row++){
          pen.putImageData(ctx.getImageData(0,row*tier.height,canvas.width,tier.height),0,0);
          images.push({file:`runtime/${id}-128-${directions[row]}.png`,png:rowCanvas.toDataURL()});
        }
        rowCanvas.width=0;
      }
      for(const {canvas} of planes)canvas.width=0;
      return{records,metrics,images,proof:proof.toDataURL(),repeatExact};
    },{id,action,directions:DIRECTIONS,tiers:TIERS});
    assert.deepEqual(errors,[]);assert.equal(bundle.repeatExact,true,`${id} depends on pose history`);
    for(const tier of bundle.metrics)for(const f of tier.frames){
      assert.ok(f.alphaPixels>100,`Blank ${id}/${tier.size}/${f.direction}/${f.frame}`);
      assert.equal(f.edgePixels,0,`Clipped ${id}/${tier.size}/${f.direction}/${f.frame}`);
    }
    for(const {file,png} of bundle.images){
      const bytes=Buffer.from(png.split(',')[1],'base64');await writeFile(join(out,file),bytes);
      outputs.push({file,bytes:bytes.length,sha256:hash(bytes)});
    }
    for(const [file,bytes] of [[`${id}-directions.png`,Buffer.from(bundle.proof.split(',')[1],'base64')],
      [`${id}-landmarks.json`,Buffer.from(JSON.stringify(bundle.records)+'\n')],
      [`${id}-quality.json`,Buffer.from(JSON.stringify(bundle.metrics)+'\n')]]){
      await writeFile(join(out,file),bytes);outputs.push({file,bytes:bytes.length,sha256:hash(bytes)});
    }
    actions[id]={...action,repeatExact:bundle.repeatExact};
    console.log(`[builder bake] ${id}: 384 cells pass blank/clipping and repeated-pose checks`);
  }
  const files=[relative(root,source),relative(root,join(dirname(source),'builder.blend')),relative(root,join(dirname(source),'joints.json')),
    'scripts/citizen-sprites/author_builder.py','scripts/citizen-sprites/export_blender.py','scripts/citizen-sprites/materials.js',
    'scripts/citizen-sprites/contract.js','scripts/citizen-sprites/bake.mjs',
    'scripts/founder-sprites/rig.js','scripts/founder-sprites/materials.js','scripts/founder-sprites/settlement-materials.js',
    'scripts/founder-sprites/export-glb.mjs','scripts/founder-sprites/contract.js',
    'vendor/three/three.module.js','vendor/three/three.core.js','vendor/three/GLTFLoader.js','vendor/three/BufferGeometryUtils.js'];
  const sources=await Promise.all(files.map(async file=>({file,sha256:hash(await readFile(join(root,file)))})));
  const stats=await page.evaluate(()=>{const stats=wardrobe.stats;disposeLight();builder.renderer.dispose();return stats;});
  await writeFile(join(out,'manifest.json'),JSON.stringify({version:1,character:'builder',sourceMode:'saved-blender-scene',
    anatomy:'adult-craftsperson-v1',authoring:'Realm builder geometry and actions; KayKit CC0 derived skeleton',license:'CC0-1.0',
    directions:DIRECTIONS,actions,tiers:TIERS,anchor:ANCHOR,viewHeight:2.6,sourceAnchor:{x:.5,y:.86},
    runtime:{cellHeight:44,baseMaps:4,detailSize:128,maxDetailRows:12,maxConcurrentDetailLoads:2,bakedCargo:true},
    render:{samples:[384,504],profile:'settlement-v2',normalMaps:true,roughnessMaps:true,selfShadows:true,...stats},sources,outputs},null,2)+'\n');
  console.log(`[builder bake] complete: ${outputs.length} files; ${stats.triangles} source triangles`);
}finally{await browser.close();await server.stop();}
