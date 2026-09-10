#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { chromium } from '@playwright/test';
import { ensureServer } from './_serve.mjs';
import { FOUNDER_DIRECTIONS as DIRS, FOUNDER_FRAMES as FRAMES, FOUNDER_STRIDE as STRIDE, FOUNDER_TIERS as TIERS, founderDirection, founderFrameRect, founderContact } from './founder-sprites/contract.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const asset=join(root,'assets/sprites/founder');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest=JSON.parse(await readFile(join(asset,'manifest.json')));
for(const source of manifest.sources)assert.equal(hash(await readFile(join(root,source.file))),source.sha256,`Changed source ${source.file}; rebuild the sprites`);
for(const output of manifest.outputs)assert.equal(hash(await readFile(join(asset,output.file))),output.sha256,`Changed baked output ${output.file}`);
assert.deepEqual(manifest.directions,DIRS);assert.equal(manifest.frames,FRAMES);
for(const [i,vector] of [[0,[0,1]],[1,[1,.5]],[2,[1,0]],[3,[1,-.5]],[4,[0,-1]],[5,[-1,-.5]],[6,[-1,0]],[7,[-1,.5]]])assert.equal(founderDirection(...vector),DIRS[i]);
assert.equal(founderDirection(0,0,'nw'),'nw');
assert.equal(founderDirection(NaN,1,'e'),'e');
for(const direction of DIRS)for(let f=0;f<FRAMES;f++){
  const rect=founderFrameRect(direction,f/FRAMES);
  assert.equal(rect.frame,f,`Scrubbing pose ${f} must select itself`);
  assert.equal(founderFrameRect(direction,1+f/FRAMES).frame,f);
}
assert.equal(founderFrameRect('s',-1/FRAMES).frame,23);
const poses=JSON.parse(await readFile(join(asset,'landmarks.json')));
assert.equal(poses.length,DIRS.length*FRAMES);
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
let maxStanceError=0,maxBoneLengthDrift=0;
const lengths={};
for(const pose of poses){
  const yaw=DIRS.indexOf(pose.direction)*Math.PI/4;
  for(const [side,suffix,offset] of [['left','l',0],['right','r',.5]]){
    const foot=pose.landmarks[`foot.${suffix}`].world;
    if(founderContact(pose.phase,side)){
      const p=(pose.phase+offset)%1;
      const localZ=foot[0]*Math.sin(yaw)+foot[2]*Math.cos(yaw);
      maxStanceError=Math.max(maxStanceError,Math.abs(localZ+STRIDE*p-STRIDE*.6/2),Math.abs(foot[1]-.1463245));
    }
    for(const [a,b] of [[`upperleg.${suffix}`,`lowerleg.${suffix}`],[`lowerleg.${suffix}`,`foot.${suffix}`]]){
      const length=distance(pose.landmarks[a].world,pose.landmarks[b].world),key=`${a}/${b}`;
      lengths[key]??=length;maxBoneLengthDrift=Math.max(maxBoneLengthDrift,Math.abs(length-lengths[key]));
    }
  }
}
assert.ok(maxStanceError<2e-6,`Foot slides during stance: ${maxStanceError}`);
assert.ok(maxBoneLengthDrift<2e-6,`Changing limb length: ${maxBoneLengthDrift}`);
assert.ok(poses[7].landmarks['foot.r'].world[1]>.24);
assert.ok(poses[19].landmarks['foot.l'].world[1]>.24);
// The earlier blender-validation.json belongs to the preserved walking study.
// Compare this generation against witnesses exported from the current scene.
const savedWalk=JSON.parse(await readFile(join(asset,'blender-actions-validation.json'))).walk;
assert.equal(savedWalk.frames,24);assert.equal(savedWalk.samples.length,25);
let maxWorldError=0;
for(const pose of poses.slice(0,FRAMES))for(const [name,joint] of Object.entries(pose.landmarks))maxWorldError=Math.max(maxWorldError,distance(joint.world,savedWalk.samples[pose.frame][name]));
assert.ok(maxWorldError<2e-5,`Walk differs from the current saved Blender scene: ${maxWorldError}`);
const blender={frames:savedWalk.frames,maxWorldError,actionFrames:[[1,savedWalk.frames+1]]};
const clean=process.argv.includes('--clean-rebuild');
if(clean)for(const output of manifest.outputs)assert.equal(hash(await readFile(join(root,'tmp/founder-sprites/clean-rebuild',output.file))),output.sha256,`Non-repeatable bake ${output.file}`);

const server=await ensureServer();
const browser=await chromium.launch(process.env.FOUNDER_BROWSER==='chrome'?{headless:true,channel:'chrome'}:{headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const output=join(root,'tmp/founder-sprites');await mkdir(output,{recursive:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1080},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const responses=[];page.on('response',r=>{if(r.status()>=400)responses.push(`${r.status()} ${r.url()}`);});
  await page.goto(`${server.origin}/walk-studio.html`);
  await page.waitForFunction(()=>window.__walkStudio?.ready);
  await page.locator('[data-mode="cycle"]').click();
  await page.locator('[data-action="walk"]').click();
  await page.locator('#play').click();
  for(let frame=0;frame<FRAMES;frame++){
    await page.locator('#phase').fill(String(frame));
    await page.waitForFunction(f=>document.getElementById('pose-label').textContent===`Pose ${f+1} / 24`,frame);
  }
  const held=await page.evaluate(()=>__walkStudio.state.phase);
  for(const dir of ['North','Northeast','East','Southeast','South','Southwest','West','Northwest']){
    const button=page.getByRole('button',{name:`Face ${dir.toLowerCase()}`,exact:true});await button.click();
    assert.equal(await button.getAttribute('aria-pressed'),'true');
    assert.equal(await page.evaluate(()=>__walkStudio.state.phase),held,'Turning resets gait');
  }
  await page.getByRole('button',{name:'Left contact',exact:true}).click();
  await page.locator('#contacts').check();await page.locator('#onion').check();
  await page.getByRole('button',{name:'Face southeast',exact:true}).click();
  await page.screenshot({path:join(output,'studio-desktop.png'),fullPage:true});

  // Inspect actual decoded pixels, independent of the bake's quality report.
  const pixels=await page.evaluate(async({tiers,dirs,frames})=>{
    const result=[];
    for(const tier of tiers){
      const img=new Image();img.src=`assets/sprites/founder/${tier.file}`;await img.decode();
      if(img.width!==tier.frameW*frames||img.height!==tier.frameH*dirs.length)throw new Error(`Wrong sheet size ${tier.key}`);
      const canvas=document.createElement('canvas');canvas.width=tier.frameW;canvas.height=tier.frameH;const ctx=canvas.getContext('2d',{willReadFrequently:true});
      for(let row=0;row<dirs.length;row++){
        const hashes=[];
        for(let f=0;f<frames;f++){
          ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,f*tier.frameW,row*tier.frameH,tier.frameW,tier.frameH,0,0,tier.frameW,tier.frameH);
          const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;let alpha=0,edges=0;
          for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(data[(y*canvas.width+x)*4+3]>16){alpha++;if(x<2||y<2||x>=canvas.width-2||y>=canvas.height-2)edges++;}
          if(alpha<100||edges)throw new Error(`Blank/clipped ${tier.key}/${dirs[row]}/${f}`);
          const digest=await crypto.subtle.digest('SHA-256',data);hashes.push(Array.from(new Uint8Array(digest)).join(','));
        }
        result.push({tier:tier.key,direction:dirs[row],distinctFrames:new Set(hashes).size});
      }
    }
    return result;
  },{tiers:TIERS,dirs:DIRS,frames:FRAMES});
  assert.ok(pixels.every(row=>row.distinctFrames===24),'Duplicate walk poses');
  await page.locator('[data-mode="roam"]').click();
  await page.locator('#stage').focus();const start=await page.evaluate(()=>({...__walkStudio.state.position,travel:__walkStudio.state.travel,phase:__walkStudio.state.phase}));
  await page.keyboard.down('d');await page.waitForFunction(t=>__walkStudio.state.travel>t+.18,start.travel);await page.keyboard.up('d');
  const moved=await page.evaluate(()=>({...__walkStudio.state.position,travel:__walkStudio.state.travel,phase:__walkStudio.state.phase,direction:__walkStudio.state.direction}));
  assert.ok(moved.x>start.x+.17);assert.equal(moved.direction,'e');
  await page.waitForFunction(()=>!__walkStudio.state.settling);
  const stopped=await page.evaluate(()=>__walkStudio.state.phase);
  assert.ok(founderContact(stopped,'left')&&founderContact(stopped,'right'),'Stop with both feet planted');
  await page.locator('[data-mode="compare"]').click();await page.locator('#onion').uncheck();
  await page.locator('[data-mode="source"]').click();await page.waitForFunction(()=>__walkStudio.sourceReady);
  const bounds=await page.locator('#stage').boundingBox();const beforeYaw=await page.evaluate(()=>__walkStudio.sourceYaw);
  await page.mouse.move(bounds.x+bounds.width*.5,bounds.y+bounds.height*.5);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width*.7,bounds.y+bounds.height*.5,{steps:8});await page.mouse.up();
  assert.notEqual(await page.evaluate(()=>__walkStudio.sourceYaw),beforeYaw,'3D drag does not turn');
  await page.locator('[data-mode="cycle"]').click();await page.getByRole('button',{name:'Face southeast',exact:true}).click();
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile horizontal overflow');
  await page.screenshot({path:join(output,'studio-mobile.png'),fullPage:true});
  const reduced=await browser.newPage({reducedMotion:'reduce'});await reduced.goto(`${server.origin}/walk-studio.html`);await reduced.waitForFunction(()=>window.__walkStudio?.ready);assert.equal(await reduced.evaluate(()=>__walkStudio.state.playing),false,'Reduced motion starts paused');await reduced.close();
  await page.goto(server.gameUrl);await page.getByRole('button',{name:'Character Workshop',exact:true}).click();await page.waitForURL('**/walk-studio.html');
  assert.deepEqual(errors,[]);assert.deepEqual(responses,[]);
  const report={directions:8,posesPerDirection:24,tiers:3,distinctFrames:pixels,maxStanceError,maxBoneLengthDrift,blender,cleanRebuild:clean,browserChecks:['all 24 scrub positions','eight directions preserve phase','contact and neighboring-pose guides','keyboard movement','grounded stop','3D source loads and turns','390px layout','reduced motion','ordinary title-screen entry'],errors};
  await writeFile(join(output,'validation.json'),JSON.stringify(report,null,2)+'\n');
  console.log(`[founder walk] PASS — 576 nonblank, distinct, unclipped frames; stance error ${maxStanceError.toExponential(2)}; fixed limb lengths; Blender pose agreement; studio controls and mobile layout`);
}finally{await browser.close();await server.stop();}
