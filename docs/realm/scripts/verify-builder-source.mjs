#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {ensureServer} from './_serve.mjs';
import {launchGraphicsBrowser,graphicsBrowserSuffix} from './_graphics-browser.mjs';
import {BUILDER_ACTIONS as ACTIONS,BUILDER_DIRECTIONS as DIRS} from './citizen-sprites/contract.js';
import {founderContact} from './founder-sprites/contract.js';
const root=new URL('../',import.meta.url),asset=new URL('assets/sprites/citizens/builder/',root);
const json=async file=>JSON.parse(await readFile(file));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest=await json(new URL('manifest.json',asset)),witness=await json(new URL('source/joints.json',asset));
for(const source of manifest.sources)assert.equal(hash(await readFile(new URL(source.file,root))),source.sha256,`Stale source ${source.file}`);
for(const output of manifest.outputs)assert.equal(hash(await readFile(new URL(output.file,asset))),output.sha256,`Stale output ${output.file}`);
assert.equal(manifest.sourceMode,'saved-blender-scene');assert.deepEqual(manifest.directions,DIRS);
assert.equal(witness.anatomy.profile,'adult-craftsperson-v1');
assert.ok(witness.anatomy.headHeight/witness.anatomy.height<.16,'Oversized head');
assert.ok(witness.anatomy.legLength/witness.anatomy.height>.42,'Shortened adult legs');
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const report={anatomy:witness.anatomy,actions:{},errors:[]};
for(const [id,action] of Object.entries(ACTIONS)){
  assert.equal(manifest.actions[id].frames,action.frames);assert.equal(witness[id].frames,action.frames);
  const poses=await json(new URL(`${id}-landmarks.json`,asset));
  assert.equal(poses.length,24*8);
  let maxWitnessError=0,maxStandingDrift=0,maxWristBend=0,minToeDrop=Infinity,maxToeDrop=-Infinity;
  for(const pose of poses){
    const row=DIRS.indexOf(pose.direction),yaw=row*Math.PI/4;
    for(const [name,joint] of Object.entries(pose.landmarks)){
      const p=witness[id].samples[pose.frame][name];assert.ok(p,`No independent Blender joint ${name}`);
      const target=[p[0]*Math.cos(yaw)+p[2]*Math.sin(yaw),p[1],-p[0]*Math.sin(yaw)+p[2]*Math.cos(yaw)];
      maxWitnessError=Math.max(maxWitnessError,distance(joint.world,target));
    }
    for(const side of ['l','r']){
      const foot=pose.landmarks[`foot.${side}`].world,toe=pose.landmarks[`toes.${side}`].world;
      const planted=['idle','work'].includes(id)||founderContact(pose.phase,side==='l'?'left':'right');
      if(planted){minToeDrop=Math.min(minToeDrop,foot[1]-toe[1]);maxToeDrop=Math.max(maxToeDrop,foot[1]-toe[1]);}
      if(['idle','work'].includes(id))maxStandingDrift=Math.max(maxStandingDrift,distance(foot,poses[row*24].landmarks[`foot.${side}`].world));
      const elbow=pose.landmarks[`lowerarm.${side}`].world,wrist=pose.landmarks[`wrist.${side}`].world,hand=pose.landmarks[`hand.${side}`].world;
      const a=wrist.map((v,i)=>v-elbow[i]),b=hand.map((v,i)=>v-wrist[i]);
      const cosine=a.reduce((sum,v,i)=>sum+v*b[i],0)/(distance(elbow,wrist)*distance(wrist,hand));
      maxWristBend=Math.max(maxWristBend,Math.acos(Math.max(-1,Math.min(1,cosine)))*180/Math.PI);
    }
  }
  assert.ok(maxWitnessError<.00003,`${id} differs from saved Blender: ${maxWitnessError}`);
  assert.ok(maxStandingDrift<.00003,`${id} standing feet slide`);
  assert.ok(minToeDrop>.118&&maxToeDrop<.120,`${id} toe orientation changed`);
  assert.ok(maxWristBend<50,`${id} folds a wrist beyond its reviewed grip: ${maxWristBend}`);
  if(['walk','carry'].includes(id))for(let f=0;f<25;f++)for(const side of ['l','r'])assert.ok(distance(witness.walk.samples[f][`foot.${side}`],witness.carry.samples[f][`foot.${side}`])<.000003,'Carrying changed the grounded gait');
  const quality=await json(new URL(`${id}-quality.json`,asset));
  for(const tier of quality)for(const frame of tier.frames){assert.ok(frame.alphaPixels>100);assert.equal(frame.edgePixels,0);}
  report.actions[id]={maxWitnessError,maxStandingDrift,maxWristBend,minToeDrop,maxToeDrop};
}
const output=new URL(`tmp/graphics-world/builder-source-gate${graphicsBrowserSuffix}/`,root);await mkdir(output,{recursive:true});
const server=await ensureServer(),browser=await launchGraphicsBrowser();
try{
  const page=await browser.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(`${server.origin}/scripts/citizen-sprites/bake.html`);
  report.pixels=await page.evaluate(async({actions,dirs})=>{
    const load=async src=>{const i=new Image();i.src=src;await i.decode();return i;};
    const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
    const rows=[];let cells=0;
    for(const [id,action] of Object.entries(actions))for(const size of [64,128]){
      const h=size*84/64,image=await load(`/assets/sprites/citizens/builder/${id}-${size}.png`);
      if(image.width!==size*action.frames||image.height!==8*h)throw new Error('Wrong atlas dimensions');
      canvas.width=image.width;canvas.height=h;
      for(let d=0;d<8;d++){
        ctx.clearRect(0,0,canvas.width,h);ctx.drawImage(image,0,d*h,canvas.width,h,0,0,canvas.width,h);
        const expected=ctx.getImageData(0,0,canvas.width,h).data;
        if(size===128){
          const strip=await load(`/assets/sprites/citizens/builder/runtime/${id}-128-${dirs[d]}.png`);
          if(strip.width!==canvas.width||strip.height!==h)throw new Error('Wrong runtime row dimensions');
          ctx.clearRect(0,0,canvas.width,h);ctx.drawImage(strip,0,0);
          const actual=ctx.getImageData(0,0,canvas.width,h).data;
          if(expected.some((v,i)=>v!==actual[i]))throw new Error(`Runtime strip changes source pixels: ${id}/${dirs[d]}`);
        }
        const hashes=[];
        for(let f=0;f<action.frames;f++){
          const pixels=ctx.getImageData(f*size,0,size,h).data;
          let alpha=0,edge=0;
          for(let y=0;y<h;y++)for(let x=0;x<size;x++)if(pixels[(y*size+x)*4+3]>16){alpha++;if(x<2||y<2||x>=size-2||y>=h-2)edge++;}
          if(alpha<100||edge)throw new Error(`Blank or clipped ${id}/${size}/${dirs[d]}/${f}`);
          hashes.push(Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',pixels))).join(','));cells++;
        }
        rows.push({action:id,size,direction:dirs[d],distinct:new Set(hashes).size});
      }
    }
    return {cells,exactRuntimeRows:32,rows};
  },{actions:ACTIONS,dirs:DIRS});
  assert.equal(report.pixels.cells,1536);assert.deepEqual(report.errors,[]);
  for(const row of report.pixels.rows)assert.ok(row.distinct>=20,`${row.action}/${row.direction} repeats too many frames (${row.distinct})`);
  report.browser=browser.version();await writeFile(new URL('report.json',output),JSON.stringify(report,null,2)+'\n');
  console.log(`[builder source] PASS ${report.browser}: 1,536 cells, 32 exact runtime strips, adult anatomy, saved-pose agreement, level toes and natural wrist limits`);
}finally{await browser.close();await server.stop();}
