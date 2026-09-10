#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
import {ensureServer} from './_serve.mjs';
import {FOUNDER_ACTIONS as ACTIONS} from './founder-sprites/actions.js';
import {FOUNDER_DIRECTIONS as DIRS,founderContact} from './founder-sprites/contract.js';
const root=new URL('../',import.meta.url),asset=new URL('assets/sprites/founder/',root);
const readJSON=async url=>JSON.parse(await readFile(url));
const manifest=await readJSON(new URL('manifest.json',asset));
const hash=b=>createHash('sha256').update(b).digest('hex');
for(const source of manifest.sources)assert.equal(hash(await readFile(new URL(source.file,root))),source.sha256,`Stale source ${source.file}`);
for(const output of manifest.outputs)assert.equal(hash(await readFile(new URL(output.file,asset))),output.sha256,`Stale output ${output.file}`);
const witnesses=await readJSON(new URL('blender-actions-validation.json',asset));
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const cleanRebuild=process.argv.includes('--clean-rebuild');
if(cleanRebuild)for(const f of manifest.outputs)assert.equal(hash(await readFile(new URL(`tmp/founder-sprites/clean-rebuild/${f.file}`,root))),f.sha256,`Non-repeatable output ${f.file}`);
const report={cleanRebuild,actions:{},errors:[]};
assert.equal(manifest.anatomy,'adult-traveler-v1');
assert.equal(witnesses.anatomy.profile,manifest.anatomy);
assert.ok(witnesses.anatomy.headHeight/witnesses.anatomy.height<.20,'Head proportions reverted to the original chibi mesh');
assert.ok(witnesses.anatomy.legLength/witnesses.anatomy.height>.40,'Adult leg proportions did not reach the saved source');
for(const name of ['Founder fitted sleeve l','Founder fitted sleeve r','Founder fitted survey strap','Founder bronze cloak clasp'])assert.ok(witnesses.anatomy.meshes.includes(name),`Missing authored wardrobe mesh: ${name}`);
report.anatomy=witnesses.anatomy;
const allPoses={};
for(const [id,action] of Object.entries(ACTIONS)){
  const poses=await readJSON(new URL(id==='walk'?'landmarks.json':`${id}-landmarks.json`,asset));allPoses[id]=poses;
  assert.equal(poses.length,8*action.frames);assert.equal(witnesses[id].frames,action.frames);assert.ok(Math.abs(witnesses[id].duration-action.duration)<1e-6,`${id} Blender duration differs from actions.js`);
  let maxDrift=0,maxWitnessError=0,minToeDrop=Infinity,maxToeDrop=-Infinity,minToeUp=Infinity;
  for(const pose of poses){
    const row=DIRS.indexOf(pose.direction),yaw=row*Math.PI/4;
    for(const side of ['l','r']){
      const foot=pose.landmarks[`foot.${side}`].world,toe=pose.landmarks[`toes.${side}`].world;
      const planted=id!=='walk'||founderContact(pose.phase,side==='l'?'left':'right');
      if(planted){const drop=foot[1]-toe[1];minToeDrop=Math.min(minToeDrop,drop);maxToeDrop=Math.max(maxToeDrop,drop);const [x,y,z,w]=pose.landmarks[`toes.${side}`].rotation;minToeUp=Math.min(minToeUp,2*(y*z-w*x));}
      if(id!=='walk')maxDrift=Math.max(maxDrift,distance(foot,poses[row*action.frames].landmarks[`foot.${side}`].world));
    }
    for(const [name,joint] of Object.entries(pose.landmarks)){
      const p=witnesses[id].samples[pose.frame][name];assert.ok(p,`Missing Blender witness ${name}`);
      const rotated=[p[0]*Math.cos(yaw)+p[2]*Math.sin(yaw),p[1],-p[0]*Math.sin(yaw)+p[2]*Math.cos(yaw)];
      maxWitnessError=Math.max(maxWitnessError,distance(joint.world,rotated));
    }
  }
  assert.ok(maxWitnessError<.00003,`${id} differs from saved Blender poses: ${maxWitnessError}`);
  if(id!=='walk')assert.ok(maxDrift<.00003,`${id} standing feet slide: ${maxDrift}`);
  // In the neutral boot, the toe joint is .119247 below the ankle. The old
  // heel-contact orientation gave only .04574 and visibly lifted the toes.
  assert.ok(minToeDrop>.118 && maxToeDrop<.120,`${id} sole tilt: ${minToeDrop}..${maxToeDrop}`);
  assert.ok(minToeUp>.99999,`${id} toe bends away from its flat sole: ${minToeUp}`);
  let maxWristBend=0,maxArmExtension=0;
  if(id==='point')for(const pose of poses.slice(0,action.frames)){
    const elbow=pose.landmarks['lowerarm.r'].world,wrist=pose.landmarks['wrist.r'].world,hand=pose.landmarks['hand.r'].world;
    const forearm=wrist.map((x,i)=>x-elbow[i]),palm=hand.map((x,i)=>x-wrist[i]);
    const cosine=forearm.reduce((sum,x,i)=>sum+x*palm[i],0)/(distance(wrist,elbow)*distance(hand,wrist));
    maxWristBend=Math.max(maxWristBend,Math.acos(Math.max(-1,Math.min(1,cosine)))*180/Math.PI);
    const shoulder=pose.landmarks['upperarm.r'].world;
    maxArmExtension=Math.max(maxArmExtension,distance(shoulder,wrist)/(distance(shoulder,elbow)+distance(elbow,wrist)));
  }
  assert.ok(maxWristBend<8,`Pointing glove folds into the cuff: ${maxWristBend} degrees`);
  assert.ok(maxArmExtension<.94,`Pointing shoulder reaches the arm's limit: ${maxArmExtension}`);
  const first=poses[0].landmarks;
  let handExcursion=0;
  for(const pose of poses.slice(0,action.frames))handExcursion=Math.max(handExcursion,distance(first['hand.r'].world,pose.landmarks['hand.r'].world));
  if(id==='point'||id==='beckon')assert.ok(handExcursion>.35,`${id} gesture did not export`);
  const end=witnesses[id].samples.at(-1);
  for(const [name,p] of Object.entries(witnesses[id].samples[0]))assert.ok(distance(p,end[name])<.00004,`${id} loop does not close: ${name}`);
  report.actions[id]={frames:action.frames,views:8,tiers:3,maxWitnessError,maxStandingFootDrift:maxDrift,minToeDrop,maxToeDrop,minToeUp,maxWristBend,maxArmExtension,handExcursion};
}
// Every standing clip shares the same ready pose; action selection is stable.
for(const id of ['point','beckon'])for(const [name,joint] of Object.entries(allPoses.idle[0].landmarks))assert.ok(distance(joint.world,allPoses[id][0].landmarks[name].world)<.00003,`${id} changes the ready pose: ${name}`);
const server=await ensureServer(),browser=await chromium.launch(process.env.FOUNDER_BROWSER==='chrome'?{headless:true,channel:'chrome'}:{headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const output=new URL('tmp/founder-sprites/',root);await mkdir(output,{recursive:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}});
  page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
  await page.goto(`${server.origin}/walk-studio.html`);await page.waitForFunction(()=>window.__walkStudio?.ready);
  await page.locator('[data-mode="cycle"]').click();
  for(const [id,a] of Object.entries(ACTIONS)){
    await page.locator(`[data-action="${id}"]`).click();await page.locator('#play').click();
    for(let f=0;f<a.frames;f++){
      await page.locator('#phase').fill(String(f));await page.waitForFunction(({f,frames})=>document.getElementById('pose-label').textContent===`Pose ${f+1} / ${frames}`,{f,frames:a.frames});
    }
    for(const [f,label] of a.beats){await page.locator('#beats').getByRole('button',{name:label,exact:true}).click();await page.waitForFunction(f=>document.getElementById('phase').value===String(f),f);}
    const phase=await page.evaluate(()=>__walkStudio.state.phase);
    for(const dir of ['north','northeast','east','southeast','south','southwest','west','northwest']){await page.getByRole('button',{name:`Face ${dir}`,exact:true}).click();assert.equal(await page.evaluate(()=>__walkStudio.state.phase),phase);}
    assert.ok((await page.locator('#download-map').getAttribute('href')).endsWith(`${id}-128.png`));
  }
  const pixels=await page.evaluate(async({actions,directions})=>{
    const result={};
    for(const [id,a] of Object.entries(actions)){
      result[id]=[];
      for(const size of [64,128,192]){
        const h=size*84/64,img=new Image();img.src=`assets/sprites/founder/${id}-${size}.png`;await img.decode();
        if(img.width!==size*a.frames||img.height!==h*8)throw new Error(`Wrong dimensions ${id}/${size}`);
        const canvas=document.createElement('canvas');canvas.width=size;canvas.height=h;const ctx=canvas.getContext('2d',{willReadFrequently:true});
        for(let row=0;row<8;row++){
          if(size>64){
            const strip=new Image();strip.src=`assets/sprites/founder/runtime/${id}-${size}-${directions[row]}.png`;await strip.decode();
            if(strip.width!==img.width||strip.height!==h)throw new Error(`Wrong runtime row dimensions ${id}/${size}/${row}`);
            const rowCanvas=document.createElement('canvas');rowCanvas.width=img.width;rowCanvas.height=h;
            const rowCtx=rowCanvas.getContext('2d',{willReadFrequently:true});
            rowCtx.drawImage(img,0,row*h,img.width,h,0,0,img.width,h);
            const expected=rowCtx.getImageData(0,0,img.width,h).data;
            rowCtx.clearRect(0,0,img.width,h);rowCtx.drawImage(strip,0,0);
            const actual=rowCtx.getImageData(0,0,img.width,h).data;
            for(let p=0;p<expected.length;p++)if(expected[p]!==actual[p])throw new Error(`Runtime row changes atlas pixels ${id}/${size}/${row} at byte ${p}`);
            rowCanvas.width=0;strip.src='';
          }
          const hashes=[];
          for(let f=0;f<a.frames;f++){
            ctx.clearRect(0,0,size,h);ctx.drawImage(img,f*size,row*h,size,h,0,0,size,h);
            const d=ctx.getImageData(0,0,size,h).data;let alpha=0,edge=0;
            for(let y=0;y<h;y++)for(let x=0;x<size;x++)if(d[(y*size+x)*4+3]>16){alpha++;if(x<2||y<2||x>=size-2||y>=h-2)edge++;}
            if(alpha<100||edge)throw new Error(`Blank/clipped ${id}/${size}/${row}/${f}`);
            hashes.push(Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',d))).join(','));
          }
          result[id].push({size,row,distinct:new Set(hashes).size});
        }
      }
    }
    return result;
  },{actions:ACTIONS,directions:DIRS});
  for(const [id,rows] of Object.entries(pixels))assert.ok(rows.every(r=>r.distinct>ACTIONS[id].frames*.85),`${id} lost motion`);
  report.pixels=pixels;report.runtimeRows={count:64,exactDecodedRGBA:true};
  await page.locator('[data-mode="source"]').click();await page.waitForFunction(()=>__walkStudio.sourceReady);
  await page.getByRole('button',{name:'Face southeast',exact:true}).click();
  for(const [id,a] of Object.entries(ACTIONS)){
    const frame=a.beats[2][0];
    await page.locator(`[data-action="${id}"]`).click();await page.locator('#phase').fill(String(frame));
    await page.waitForFunction(({id,phase})=>__walkStudio.rendered?.action===id&&__walkStudio.rendered.phase===phase&&__walkStudio.rendered.mode==='source',{id,phase:frame/a.frames});
    const live=await page.evaluate(()=>__walkStudio.sourceLandmarks),expected=allPoses[id][a.frames+frame].landmarks;
    for(const [name,p] of Object.entries(expected))assert.ok(distance(p.world,live[name].world)<.00003,`${id} 3D source differs from its sprite: ${name}`);
  }
  for(const mode of ['cycle','compare','roam']){
    await page.locator(`[data-mode="${mode}"]`).click();
    assert.equal(await page.locator('.source-canvas').isVisible(),false,`3D canvas covers ${mode}`);
  }
  await page.locator('[data-mode="cycle"]').click();await page.locator('[data-action="point"]').click();await page.locator('#turns').check();
  const initialDirection=await page.evaluate(()=>__walkStudio.state.direction);
  await page.waitForFunction(()=>__walkStudio.state.phase>.3&&__walkStudio.state.phase<.7);
  assert.equal(await page.evaluate(()=>__walkStudio.state.direction),initialDirection,'Automatic view changes during a gesture');
  await page.waitForFunction(dir=>__walkStudio.state.direction!==dir,initialDirection);
  assert.ok(await page.evaluate(()=>__walkStudio.state.phase<.2),'Automatic turn waits for the loop boundary');
  await page.getByRole('button',{name:'Face southeast',exact:true}).click();await page.locator('#phase').fill('22');
  await page.screenshot({path:new URL('actions-desktop.png',output).pathname,fullPage:true});
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:new URL('actions-mobile.png',output).pathname,fullPage:true});
  const reduced=await browser.newPage({reducedMotion:'reduce'});await reduced.goto(`${server.origin}/walk-studio.html`);await reduced.waitForFunction(()=>window.__walkStudio?.ready);
  await reduced.locator('[data-action="beckon"]').click();assert.equal(await reduced.evaluate(()=>__walkStudio.state.playing),false);await reduced.close();
  assert.deepEqual(report.errors,[]);
  await writeFile(new URL('actions-validation.json',output),JSON.stringify(report,null,2)+'\n');
  console.log('[founder actions] PASS — 4,032 rendered cells; 64 runtime rows match decoded atlas pixels exactly; all action beats and angles; level toes; planted standing feet; saved Blender agreement; closed loops; 3D and mobile');
}finally{await browser.close();await server.stop();}
