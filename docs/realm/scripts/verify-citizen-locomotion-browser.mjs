#!/usr/bin/env node
// Inspect actual atlas draws: route intent cannot animate a stationary body,
// and road presentation cannot move the sprite away from its collision point.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {ensureServer} from './_serve.mjs';
const output=new URL('../tmp/graphics-world/locomotion-207/',import.meta.url);
await mkdir(output,{recursive:true});
const server=await ensureServer(),browser=await chromium.launch({headless:true,channel:'chrome'});
try{
 const page=await browser.newPage({viewport:{width:1280,height:920},deviceScaleFactor:2});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(server.gameUrl);await page.waitForFunction(()=>typeof startNewGame==='function');
 await page.evaluate(()=>{startNewGame();setSpeed(0);});
 await page.getByRole('button',{name:'Skip tutorial',exact:true}).click();
 await page.waitForFunction(()=>G.camera.zoom===1.3);
 await page.waitForFunction(()=>__realm.actorAtlas().tiers.some(t=>t.state==='ready'));
 await page.evaluate(async()=>{
  window.motionRender=await import('./js/render.js?realm=198');
  window.motionCache=await import('./js/citizen-render-cache.js?realm=198');
  const {TILE}=await import('./js/state.js?realm=198');
  const c=G.citizens[0];G.citizens=[c];G.population=1;G._followAvatar=false;
  for(let y=37;y<47;y++)for(let x=37;x<47;x++)if(!G.buildingGrid[y][x]){G.map[y][x]=TILE.GRASS;G.fog[y][x]=true;}
  Object.assign(G.resources,{wood:500,stone:500,gold:500});
  const placed=G.debug.dispatch({type:'PLACE_BUILDING',building:'road',x:43,y:42});
  if(!placed.ok)throw new Error(JSON.stringify(placed));
  G.camera.x=32;G.camera.y=1360;G.camera.zoom=2.6;
  Object.assign(c,{x:43,y:42,_px:43,_py:42,tx:46,ty:42,path:[{x:46,y:42}],pathIdx:0,_pathStartedAt:G.gameTick,_movedAt:G.gameTick,carrying:null,carryAmount:0,faceX:1,faceZ:0});
  motionCache.resetCitizenRenderCache();G._renderAlpha=1;forceRender();
 });
 // Give any selected resolution tier one turn of the event loop to decode.
 await page.evaluate(async()=>{for(let i=0;i<8;i++)await new Promise(requestAnimationFrame);});
 const result=await page.evaluate(()=>{
  const c=G.citizens[0],base=G.gameTick+10,ctx=document.getElementById('game').getContext('2d');
  const trace=[],original=ctx.drawImage;
  function paint(tick,x,y,{cargo=false}={}){
   G.gameTick=base+tick;G._renderAlpha=1;
   c._px=c.x;c._py=c.y;c.x=x;c.y=y;c._movedAt=G.gameTick;
   c.carrying=cargo?'wood':null;c.carryAmount=cargo?1:0;
   const calls=[];
   ctx.drawImage=function(image,...args){
    const builder=image.src?.includes('/citizens/builder/');
    if((builder||image.src?.includes('actors-atlas'))&&args.length===8)calls.push({
     frame:Math.round(args[0]/args[2]),row:Math.round(args[1]/args[3]),
     centerX:args[4]+args[6]/2,groundY:builder?args[5]+args[7]*.86:args[5]+args[7]-3,
    });
    return original.call(this,image,...args);
   };
   try{motionRender.render();}finally{ctx.drawImage=original;}
   if(calls.length!==1)throw new Error(`Expected one citizen draw, got ${JSON.stringify(calls)}`);
   const draw=calls[0],screen=motionRender.toScreen(x,y);
   const state=motionCache.inspectCitizenRenderCache().find(r=>r.actorId===c.actorId);
   const sample={tick,x,y,...draw,anchorError:Math.hypot(draw.centerX-screen.x,draw.groundY-screen.y),action:state.animationKey,moving:state.motion.moving,phase:state.motion.phase};
   trace.push(sample);return sample;
  }
  // Even a perpetually refreshed movement timestamp and a live path do not
  // move these pixels. This reproduces accepted steps cancelled by separation.
  for(let tick=0;tick<=35;tick++)paint(tick,43,42);
  const blocked=trace.slice();
  const travel=[];for(let t=1;t<=35;t++)travel.push(paint(35+t,43+t*.02,42));
  const waits=[];for(let t=1;t<=30;t++)waits.push(paint(70+t,43.7,42));
  const cargo=[];for(let t=1;t<=35;t++)cargo.push(paint(100+t,43.7,42,{cargo:true}));
  const held=cargo.at(-1),paused=[];
  for(let draw=0;draw<20;draw++){G.camera.x+=.2;paused.push(paint(135,43.7,42,{cargo:true}));}
  return {blocked,travel,waits,cargo,held,paused,trace};
 });
 assert.ok(result.blocked.every(s=>!s.moving&&s.action.includes('/idle/')),'Stationary active route selects the walking row');
 assert.ok(new Set(result.travel.map(s=>s.frame)).size>=4,'Moving body does not advance its feet');
 assert.ok(result.waits.slice(7).every(s=>!s.moving&&s.action.includes('/idle/')),'A traffic wait keeps running in place');
 assert.equal(new Set(result.cargo.map(s=>s.frame)).size,1,'Stationary cargo cycles walking frames');
 assert.ok(result.paused.every(s=>s.frame===result.held.frame&&s.phase===result.held.phase),'Paused camera changes advance the gait');
 assert.ok(result.trace.every(s=>s.anchorError<1e-7),'The sprite drifts away from its accepted ground position on a road');
 await page.screenshot({path:new URL('held-cargo.png',output).pathname});
 assert.deepEqual(errors,[]);
 await writeFile(new URL('report.json',output),JSON.stringify({errors,...result},null,2)+'\n');
 console.log('[citizen locomotion browser] PASS — actual atlas frames stop in traffic, advance with travel, hold cargo/pause, and keep the physical road anchor');
}finally{await browser.close();await server.stop();}
