#!/usr/bin/env node
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {launchGraphicsBrowser, graphicsBrowserSuffix} from './_graphics-browser.mjs';
import {ensureServer} from './_serve.mjs';

const output=new URL(`../tmp/graphics-world/landscape-gate${graphicsBrowserSuffix}/`,import.meta.url);
await mkdir(output,{recursive:true});
const server=await ensureServer();
const browser=await launchGraphicsBrowser();
const page=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:2});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
await page.addInitScript(()=>{
  const getContext=HTMLCanvasElement.prototype.getContext;
  window.landscapeTestContexts=[];
  HTMLCanvasElement.prototype.getContext=function(type,...args){
    const result=getContext.call(this,type,...args);
    if(type==='webgl2'&&result&&!landscapeTestContexts.includes(result))landscapeTestContexts.push(result);
    return result;
  };
});
try{
  await page.goto(server.gameUrl);
  await page.waitForFunction(()=>typeof startNewGame==='function');
  await page.evaluate(()=>{startNewGame();setSpeed(0);G.debug.pauseRendering=true;});
  const result=await page.evaluate(async()=>{
    const {drawLandscape,landscapeDiagnostics}=await import('./js/landscape.js?realm=198');
    const {MAP_W,MAP_H,TILE}=await import('./js/state.js?realm=198');
    G.map=Array.from({length:MAP_H},()=>Array(MAP_W).fill(TILE.GRASS));
    G.fog=Array.from({length:MAP_H},()=>Array(MAP_W).fill(true));
    G.buildingGrid=Array.from({length:MAP_H},()=>Array(MAP_W).fill(null));
    G.tileWear=Array.from({length:MAP_H},()=>Array(MAP_W).fill(0));
    G.gameTick=100;G.season='spring';
    const canvas=document.createElement('canvas');canvas.width=640;canvas.height=400;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    const frame=(pan=0)=>{
      ctx.setTransform(1,0,0,1,320-pan,200-1280);
      if(!drawLandscape(ctx,{width:640,height:400,daylight:1}))throw new Error('Landscape did not render');
      return ctx.getImageData(0,0,640,400).data;
    };
    const difference=(a,b)=>a.reduce((sum,value,index)=>sum+Math.abs(value-b[index]),0)/a.length;
    const first=frame(),initial=landscapeDiagnostics();
    const repeat=frame(),paused=landscapeDiagnostics();
    const shifted=frame(32);
    let panError=0,samples=0,variation=0;
    for(let y=30;y<370;y++)for(let x=40;x<550;x++)for(let k=0;k<3;k++){
      panError+=Math.abs(shifted[(y*640+x)*4+k]-first[(y*640+x+32)*4+k]);samples++;
      variation+=Math.abs(first[(y*640+x)*4+k]-first[((y+16)*640+x+32)*4+k]);
    }
    frame();G.tileWear[40][40]=400;
    const worn=frame(),wearChanged=difference(worn,first);
    G.tileWear[40][40]=0;G.season='winter';
    const winter=frame(),seasonChanged=difference(winter,first);
    G.season='spring';
    // Undiscovered terrain must not disclose which resources are underneath.
    G.fog=G.fog.map(row=>row.map(()=>false));
    const hiddenGrass=frame();
    G.map=G.map.map(row=>row.map(()=>TILE.IRON));
    const hiddenIron=frame(),hiddenDifference=difference(hiddenGrass,hiddenIron);
    G.fog=G.fog.map((row,y)=>row.map(()=>y>=40));
    G.map=G.map.map((row,y)=>row.map(()=>y>=40?TILE.GRASS:TILE.IRON));
    const ironBoundary=frame();
    G.map=G.map.map((row,y)=>row.map(()=>y>=40?TILE.GRASS:TILE.FOREST));
    const forestBoundary=frame(),boundaryDisclosure=difference(ironBoundary,forestBoundary);
    G.fog=G.fog.map(row=>row.map(()=>true));
    G.map=G.map.map(row=>row.map(()=>TILE.WATER));
    const waterA=frame();G.gameTick+=90;const waterB=frame();
    // The source surface has a bounded backing even on a high-DPI canvas.
    canvas.width=1920;canvas.height=1200;ctx.setTransform(3,0,0,3,960,-3240);
    drawLandscape(ctx,{width:640,height:400,daylight:1});
    const density=landscapeDiagnostics();
    const gl=landscapeTestContexts.find(context=>{
      const program=context.getParameter(context.CURRENT_PROGRAM);
      return program&&context.getUniformLocation(program,'u_tiles')!==null;
    });
    if(!gl)throw new Error('Missing actual landscape graphics context');
    window.landscapeTestExtension=gl.getExtension('WEBGL_lose_context');
    if(!landscapeTestExtension)throw new Error('Context loss test extension unavailable');
    landscapeTestExtension.loseContext();
    return {initial,paused,repeatDifference:difference(first,repeat),panError:panError/samples,
      neighboringTileDifference:variation/samples,wearChanged,seasonChanged,hiddenDifference,boundaryDisclosure,
      waterAnimation:difference(waterA,waterB),density};
  });
  assert.equal(result.repeatDifference,0,'paused ground must not crawl or flicker');
  assert.equal(result.paused.draws,result.initial.draws,'unchanged paused surface must reuse its frame');
  assert.equal(result.paused.uploads,result.initial.uploads,'unchanged map must not be reuploaded');
  assert.ok(result.panError<.1,`surface must remain attached to world coordinates (${result.panError})`);
  assert.ok(result.neighboringTileDifference>1,'neighboring grass tiles must not repeat the same pixels');
  assert.ok(result.wearChanged>.005,'actual citizen wear must alter the rendered earth');
  assert.ok(result.seasonChanged>10,'winter must visibly alter the surface');
  assert.equal(result.hiddenDifference,0,'fog must conceal resource type');
  assert.equal(result.boundaryDisclosure,0,'hidden neighbors must not tint the discovered side of the fog boundary');
  assert.ok(result.waterAnimation>.1,'water must animate continuously');
  assert.equal(result.density.width,960);assert.equal(result.density.height,600);
  await page.waitForFunction(()=>__realm.landscape().state==='lost');
  const fallback=await page.evaluate(async()=>{
    const {drawLandscape}=await import('./js/landscape.js?realm=198');
    const canvas=document.createElement('canvas');canvas.width=100;canvas.height=100;
    return drawLandscape(canvas.getContext('2d'),{width:100,height:100,daylight:1});
  });
  assert.equal(fallback,false,'lost WebGL context must leave the Canvas fallback available');
  await page.evaluate(()=>landscapeTestExtension.restoreContext());
  await page.waitForFunction(()=>__realm.landscape().state==='uninitialized');
  await page.evaluate(()=>forceRender());
  await page.waitForFunction(()=>__realm.landscape().state==='ready');
  const depth=await page.evaluate(async()=>{
    const {render}=await import('./js/render.js?realm=198');
    const {TILE}=await import('./js/state.js?realm=198');
    G.citizens=[];G.buildings=[];G.animals=[];G.enemies=[];G.walkers=[];G.soldiers=[];G.caravans=[];
    G._followAvatar=false;G._renderAlpha=1;G.camera.x=0;G.camera.y=1280;G.camera.zoom=2;
    const ctx=document.getElementById('game').getContext('2d'),original=ctx.drawImage;
    const records=[];
    for(const type of [TILE.FOREST,TILE.STONE,TILE.IRON,TILE.MOUNTAIN]){
      G.map[40][40]=type;
      for(const offset of [-.65,.65]){
        Object.assign(G.avatar,{x:40+offset,y:40+offset,_px:40+offset,_py:40+offset,path:null,pathIdx:0,vx:0,vy:0});
        const calls=[];
        ctx.drawImage=function(image,...args){
          if(image.src?.includes('nature-atlas'))calls.push('nature');
          if(image.src?.includes('/founder/'))calls.push('founder');
          return original.call(this,image,...args);
        };
        try{render();}finally{ctx.drawImage=original;}
        records.push({type,offset,calls});
      }
    }
    return records;
  });
  for(const record of depth){
    assert.ok(record.calls.includes('nature')&&record.calls.includes('founder'),JSON.stringify(record));
    assert.equal(record.calls.indexOf('founder')<record.calls.indexOf('nature'),record.offset<0,
      `scenery must occlude the Founder only while he is behind it: ${JSON.stringify(record)}`);
  }
  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:3});
  mobile.on('pageerror',error=>errors.push(error.message));
  await mobile.goto(server.gameUrl);
  await mobile.waitForFunction(()=>typeof startNewGame==='function');
  await mobile.locator('#title-screen .title-btn.primary').tap();
  await mobile.getByRole('button',{name:'Skip tutorial',exact:true}).tap();
  await mobile.getByRole('button',{name:'Pause',exact:true}).tap();
  await mobile.waitForFunction(()=>__realm.landscape().state==='ready'&&G.camera.zoom===1.3);
  await mobile.locator('#btn-founder').tap();
  const phone=await mobile.evaluate(()=>({
    width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
    landscape:__realm.landscape(),paused:G.speed===0,
    founder:document.getElementById('btn-founder').getAttribute('aria-pressed'),
    mapBottom:document.getElementById('minimap').getBoundingClientRect().bottom,
    buildTop:document.getElementById('build-bar').getBoundingClientRect().top,
  }));
  assert.ok(phone.scrollWidth<=phone.width,'phone game must fit the viewport');
  assert.equal(phone.paused,true);assert.equal(phone.founder,'true');
  assert.ok(phone.mapBottom<=phone.buildTop-8,'phone minimap must clear the build controls');
  assert.equal(phone.landscape.width,585);assert.equal(phone.landscape.height,1266);
  await mobile.screenshot({path:new URL('phone.png',output).pathname});
  const fallbackPage=await browser.newPage({viewport:{width:1000,height:760}});
  fallbackPage.on('pageerror',error=>errors.push(error.message));
  await fallbackPage.addInitScript(()=>{
    const getContext=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:getContext.call(this,type,...args);};
  });
  await fallbackPage.goto(server.gameUrl);
  await fallbackPage.waitForFunction(()=>typeof startNewGame==='function');
  await fallbackPage.evaluate(()=>{startNewGame();setSpeed(0);});
  await fallbackPage.waitForFunction(()=>__realm.landscape().state==='unavailable'&&G.camera.zoom===1.3);
  await fallbackPage.getByRole('button',{name:'Skip tutorial',exact:true}).click();
  const fallbackPixels=await fallbackPage.evaluate(()=>{
    forceRender();const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data,colors=new Set();
    for(let i=0;i<pixels.length;i+=64)colors.add(`${pixels[i]},${pixels[i+1]},${pixels[i+2]}`);
    return colors.size;
  });
  assert.ok(fallbackPixels>200,'Canvas fallback must draw a visible settlement when WebGL2 is unavailable');
  await fallbackPage.screenshot({path:new URL('fallback.png',output).pathname});
  assert.deepEqual(errors,[]);
  await writeFile(new URL('report.json',output),JSON.stringify({browser:browser.version(),errors,...result,depth,phone,fallbackPixels},null,2)+'\n');
  console.log(`[landscape] PASS: world coordinates, nonrepeating pixels, wear, seasons, fog, water, pause reuse, bounded density, context recovery, 8 scenery crossings, phone touch, and Canvas fallback; pan error ${result.panError.toFixed(5)}`);
}finally{await browser.close();await server.stop();}
