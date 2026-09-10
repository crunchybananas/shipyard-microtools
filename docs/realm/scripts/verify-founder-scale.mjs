#!/usr/bin/env node
// Compare actual renderer output against existing people. Equal atlas-cell
// sizes are not equal body sizes; that omission let the giant Founder pass.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {ensureServer} from './_serve.mjs';
const server=await ensureServer(),browser=await chromium.launch(process.env.FOUNDER_BROWSER==='chrome'?{headless:true,channel:'chrome'}:{headless:true});
const output=new URL('../tmp/founder-sprites/',import.meta.url);await mkdir(output,{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 await page.goto(server.gameUrl);await page.waitForFunction(()=>typeof startNewGame==='function');
 await page.locator('#title-screen .title-btn.primary').click();await page.evaluate(()=>setSpeed(0));
 await page.evaluate(async()=>{
  window.scaleRenderer=await import('./js/render.js?realm=198');
  window.scaleFounder=await import('./js/founder-presentation.js?realm=198');
  window.scaleBuilder=await import('./js/builder-presentation.js?realm=198');
  scaleBuilder.prepareBuilderSprites();
 });
 await page.waitForFunction(()=>__realm.actorAtlas().tiers.some(t=>t.state==='ready'));
 const result=await page.evaluate(async()=>{
  const {G}=window,{drawFounder}=scaleFounder,{drawBuilder}=scaleBuilder;
  const directions=[[1,1,'down'],[1,0,'right'],[1,-1,'right'],[0,-1,'up'],[-1,-1,'up'],[-1,0,'left'],[-1,1,'left'],[0,1,'down']];
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;const ctx=canvas.getContext('2d',{willReadFrequently:true});
  G._followAvatar=false;
  const bounds=()=>{const p=ctx.getImageData(0,0,512,512).data;let x0=512,y0=512,x1=-1,y1=-1;for(let y=0;y<512;y++)for(let x=0;x<512;x++)if(p[(y*512+x)*4+3]>64){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}return{x:x0,y:y0,width:x1-x0+1,height:y1-y0+1,bottom:y1+1};};
  const clear=()=>{ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,512,512);};
  const records=[];
  const proof=document.createElement('canvas');proof.width=960;proof.height=8*112;const pen=proof.getContext('2d');pen.fillStyle='#29392f';pen.fillRect(0,0,proof.width,proof.height);
  for(const dpr of [1,2])for(const zoom of [.65,1,1.3,2.25,3])for(const [index,[faceX,faceZ,dir]] of directions.entries()){
   const scale=dpr*zoom;G.camera.zoom=zoom;
   const paint=async(which)=>{
    for(let attempt=0;attempt<100;attempt++){
     clear();ctx.setTransform(scale,0,0,scale,256,384);
     scaleBuilder.beginBuilderSpritesFrame();
     // The Founder draws contact fills inside drawFounder; citizen contact is
     // outside drawBuilder. Suppress only path fills so both measurements
     // contain the actual bitmap body with the same alpha threshold.
     const fill=ctx.fill;ctx.fill=()=>{};
     let ready;
     try{ready=which==='founder'?drawFounder(ctx,{x:20,y:20,faceX,faceZ},{x:20,y:20},{x:0,y:0},1):drawBuilder(ctx,{action:'idle',motion:{phase:0},continuity:{},faceScreenX:faceX-faceZ,faceScreenY:(faceX+faceZ)/2,x:0,y:0});}
     finally{ctx.fill=fill;}
     const diagnostics=scaleFounder.founderPresentationDiagnostics();
     const correctTier=which!=='founder'||diagnostics.pose?.size===(diagnostics.cellHeight*scale>168?192:diagnostics.cellHeight*scale>84?128:64);
     if(ready&&correctTier)return bounds();
     await new Promise(requestAnimationFrame);
    }
    throw new Error(`Atlas did not decode: ${which}`);
   };
   const settler=await paint('settler');
   if(dpr===2&&zoom===1.3)pen.drawImage(canvas,208,280,96,120,100,index*112,77,96);
   const founder=await paint('founder');
   if(dpr===2&&zoom===1.3){pen.drawImage(canvas,208,280,96,120,270,index*112,77,96);pen.fillStyle='#eadbb7';pen.font='14px system-ui';pen.fillText(['S','SE','E','NE','N','NW','W','SW'][index],20,index*112+48);pen.fillText('Settler',105,index*112+108);pen.fillText('Founder',273,index*112+108);pen.fillStyle='#9ca99d';pen.fillText(`Visible height: ${(founder.height/scale).toFixed(1)} / ${(settler.height/scale).toFixed(1)} world px`,425,index*112+48);pen.fillText(`Feet difference: ${((founder.bottom-settler.bottom)/scale).toFixed(2)} px`,425,index*112+72);}
   records.push({dpr,zoom,direction:index,settler,founder,heightRatio:founder.height/settler.height,widthRatio:founder.width/settler.width,groundDifference:(founder.bottom-settler.bottom)/scale,tier:scaleFounder.founderPresentationDiagnostics().pose.size});
  }
  return{records,proof:proof.toDataURL()};
 });
 await writeFile(new URL('scale-validation.json',output),JSON.stringify(result.records,null,2)+'\n');
 await writeFile(new URL('scale-comparison.png',output),Buffer.from(result.proof.split(',')[1],'base64'));
 for(const r of result.records){
  // Allow one physical raster pixel at a thresholded silhouette boundary;
  // at the smallest zoom that pixel is 5.6% of the complete citizen height.
  assert.ok(r.founder.height>=r.settler.height*.82-1&&r.founder.height<=r.settler.height*1.03+1,`Founder stature mismatch: ${JSON.stringify(r)}`);
  assert.ok(r.founder.width<=r.settler.width*1.85+1,`Founder mass overwhelms settlers: ${JSON.stringify(r)}`);
  assert.ok(Math.abs(r.groundDifference)<=2,`Founder floats or sinks: ${JSON.stringify(r)}`);
 }
 assert.ok(new Set(result.records.map(r=>r.tier)).size===3,'Did not cross both source-resolution boundaries');
 console.log(`[founder scale] PASS — ${result.records.length} rendered comparisons; eight headings, five zooms, 1x/2x displays; matching stature and ground baseline`);
}finally{await browser.close();await server.stop();}
