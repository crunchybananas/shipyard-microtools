#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, webkit } from '@playwright/test';
import { ensureServer } from './_serve.mjs';
import { sampleFounder } from '../js/founder-presentation.js?realm=198';

const headings = [[1,1,'s'],[1,0,'se'],[1,-1,'e'],[0,-1,'ne'],[-1,-1,'n'],[-1,0,'nw'],[-1,1,'w'],[0,1,'sw']];
for (const [dx,dy,direction] of headings) {
  const a = { x: 20, y: 20, faceX: 0, faceZ: 1 };
  sampleFounder(a,a,10);
  const pose = sampleFounder(a,{x:20+dx*.05,y:20+dy*.05},11);
  assert.equal(pose.action,'walk'); assert.equal(pose.direction,direction);
  assert.ok(Math.abs(pose.phase-Math.hypot(dx*.05,dy*.05)/1.6)<1e-10);
  assert.deepEqual(sampleFounder(a,{x:20+dx*.05,y:20+dy*.05},11),pose,'pause changed the pose');
  assert.equal(sampleFounder(a,{x:20+dx*.05,y:20+dy*.05},12).action,'idle','blocked movement marched in place');
}
const server = await ensureServer();
const engine = process.env.FOUNDER_BROWSER === 'webkit' ? webkit : chromium;
const browser = await engine.launch(process.env.FOUNDER_BROWSER === 'chrome' ? {headless:true,channel:'chrome'} : {headless:true});
const output = new URL('../tmp/founder-sprites/',import.meta.url); await mkdir(output,{recursive:true});
const report = {browser:browser.version(),checks:[],errors:[]};
const check = text => {report.checks.push(text);console.log(`  ✓ ${text}`);};
check('Eight world headings, distance-driven gait, pause and blocked movement');
try {
  const page = await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:2});
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('response', r => {if(r.status()>=400) report.errors.push(`${r.status()} ${r.url()}`);});
  await page.goto(`${server.gameUrl}?founder-review=1`);
  await page.waitForFunction(()=>typeof window.startNewGame==='function');
  await page.locator('#kingdom-name-input').fill('The Founder Returns');
  await page.locator('#title-screen .title-btn.primary').click();
  await page.evaluate(()=>window.setSpeed(0));
  await page.evaluate(async()=>{
    window.founderView=await import('./js/founder-presentation.js?realm=198');
    window.renderModule=await import('./js/render.js?realm=198');
  });
  await page.locator('#btn-founder').click();
  await page.waitForFunction(()=>window.founderView.founderPresentationDiagnostics().pose?.size===128);
  assert.equal(await page.locator('#btn-founder').getAttribute('aria-pressed'),'true');
  await page.screenshot({path:new URL('founder-in-game.png',output).pathname});
  check('New game uses the authored Founder; existing Founder button selects and follows him');

  // The founding camera move owns zoom for its first 1.5 seconds. The slimmer
  // source decodes its first enlarged row earlier; wait before setting the
  // controlled maximum-zoom fixture so the intro cannot overwrite it.
  await page.waitForFunction(()=>G.camera.zoom===1.3);

  const result = await page.evaluate(async headings=>{
    const {G,TILE}=await import('./js/state.js?realm=198');
    const {render}=window.renderModule;
    const diagnostics=()=>window.founderView.founderPresentationDiagnostics();
    const a=G.avatar;
    // A controlled clearing exercises the real movement/collision/command
    // path. Fixture writes never become application behavior.
    for(let y=20;y<=36;y++)for(let x=20;x<=36;x++){G.map[y][x]=TILE.GRASS;G.fog[y][x]=true;}
    Object.assign(a,{x:28,y:28,_px:28,_py:28,path:null,pathIdx:0,vx:0,vy:0});
    G.camera.x=0;G.camera.y=28*32;G.camera.zoom=3;
    G._renderAlpha=1;render();
    const beforeKeys=Object.keys(a).sort();
    const seen=[];
    for(const [dx,dy,expected] of headings){
      Object.assign(a,{x:28,y:28,_px:28,_py:28});
      G.debug.dispatch({type:'AVATAR_MOVE',dx,dy});
      for(let f=0;f<8;f++){G.debug.step(1);G._renderAlpha=1;render();}
      for(let retry=0;retry<180&&diagnostics().pose.size!==192;retry++)await new Promise(requestAnimationFrame);
      seen.push({expected,pose:diagnostics().pose,atlases:diagnostics().atlases});
      G.debug.dispatch({type:'AVATAR_MOVE',dx:0,dy:0});
      G.debug.step(1);render();
    }
    const afterKeys=Object.keys(a).sort();
    const rejected=G.debug.dispatch({type:'PLACE_BUILDING',building:'house',x:-1,y:-1});
    render();const rejectedPose=diagnostics().pose.action;
    Object.assign(G.resources,{wood:100,stone:100,gold:100});
    const placed=G.debug.dispatch({type:'PLACE_BUILDING',building:'house',x:31,y:28});
    G.debug.step(68);G._renderAlpha=1;render();
    return {seen,beforeKeys,afterKeys,rejected,rejectedPose,placed,point:diagnostics().pose};
  },headings);
  for(const {expected,pose,atlases} of result.seen){
    assert.equal(pose.action,'walk');assert.equal(pose.direction,expected);assert.equal(pose.size,192);
    assert.ok(atlases.filter(a=>a.size>64).length<=2,'Turns accumulate enlarged direction rows');
  }
  assert.deepEqual(result.beforeKeys,result.afterKeys,'render state leaked onto the saved avatar');
  assert.equal(result.rejected.ok,false);assert.equal(result.rejectedPose,'idle');
  assert.equal(result.placed.ok,true);assert.equal(result.point.direction,'se');
  await page.waitForFunction(()=>founderView.founderPresentationDiagnostics().pose.action==='point' && founderView.founderPresentationDiagnostics().pose.size===192);
  await page.screenshot({path:new URL('founder-work-order.png',output).pathname});
  check('Real movement renders all eight directions; successful construction points toward its site; rejected orders stay idle');

  const transitions = await page.evaluate(()=>{
    const {G}=window,{render}=renderModule;
    const pose=()=>founderView.founderPresentationDiagnostics().pose;
    const held=pose();render();render();const paused=pose();
    G.debug.dispatch({type:'AVATAR_MOVE',dx:1,dy:0});G.debug.step(2);G._renderAlpha=1;render();const interrupt=pose();
    G.debug.dispatch({type:'AVATAR_MOVE',dx:0,dy:0});G.debug.step(1);render();const stopped=pose();
    const rally=G.debug.dispatch({type:'SET_RALLY',x:27,y:31});
    G.debug.step(70);render();const beckon=pose();
    return {held,paused,interrupt,stopped,rally,beckon};
  });
  assert.deepEqual(transitions.held,transitions.paused,'paused rendering advanced a gesture');
  assert.equal(transitions.interrupt.action,'walk');assert.equal(transitions.stopped.action,'idle');
  assert.equal(transitions.rally.ok,true);
  await page.waitForFunction(()=>founderView.founderPresentationDiagnostics().pose.action==='beckon' && founderView.founderPresentationDiagnostics().pose.size===192);
  transitions.beckon=await page.evaluate(()=>founderView.founderPresentationDiagnostics().pose);
  const largestCache=await page.evaluate(()=>founderView.founderPresentationDiagnostics().atlases);
  assert.ok(largestCache.filter(a=>a.size>64).length<=2);
  const decodedBytes=largestCache.reduce((sum,a)=>sum+a.decodedBytes,0);
  assert.ok(decodedBytes<40*1024*1024,`Retained decoded atlases exceed 40 MiB: ${decodedBytes}`);
  report.largestTierCache={atlases:largestCache,decodedBytes};
  transitions.recovered=await page.evaluate(()=>{G.debug.step(130);renderModule.render();return founderView.founderPresentationDiagnostics().pose;});
  assert.equal(transitions.recovered.action,'idle');
  check('Pause freezes gestures; walking interrupts immediately; rally beckons once and returns to idle');
  check('Maximum zoom loads all eight 192px walk rows; work/rally transitions retain fewer than 40 MiB of decoded atlas references');

  const saved = await page.evaluate(async()=>{
    const {serializeGame,prepareSave}=await import('./js/save-state.js?realm=198');
    const payload=serializeGame({savedAt:198});
    const valid=prepareSave(payload);
    return {ok:valid.ok,failure:valid.error,avatarKeys:Object.keys(G.avatar)};
  });
  assert.equal(saved.ok,true,JSON.stringify(saved.failure));
  assert.ok(!saved.avatarKeys.some(k=>/phase|gesture|sprite|animation/i.test(k)));
  await page.locator('#btn-save').click();
  const avatarBefore = await page.evaluate(()=>({x:G.avatar.x,y:G.avatar.y,name:G.avatar.name}));
  await page.reload();await page.waitForFunction(()=>typeof window.startNewGame==='function');
  await page.locator('#title-load').click();
  await page.evaluate(async()=>{window.founderView=await import('./js/founder-presentation.js?realm=198');});
  await page.waitForFunction(()=>founderView.founderPresentationDiagnostics().pose);
  assert.deepEqual(await page.evaluate(()=>({x:G.avatar.x,y:G.avatar.y,name:G.avatar.name})),avatarBefore);
  assert.equal(await page.evaluate(()=>founderView.founderPresentationDiagnostics().pose.action),'idle');
  check('Save/Continue preserves the existing Founder and never persists animation or stale orders');

  for(const [label,offset] of [['behind',-.55],['in-front',.55]]) {
    const order=await page.evaluate(async offset=>{
      const {render}=await import('./js/render.js?realm=198');
      const a=G.avatar,b=G.buildingGrid[28][31];
      b.buildProgress=1;b.completeTick=G.gameTick;
      G._followAvatar=false;G.camera.zoom=2.2;G.camera.x=96;G.camera.y=944;
      Object.assign(a,{x:31+offset,y:28+offset,_px:31+offset,_py:28+offset,path:null,vx:0,vy:0});
      G._renderAlpha=1;
      const ctx=document.getElementById('game').getContext('2d'),original=ctx.drawImage,calls=[];
      ctx.drawImage=function(img,...args){
        if(img.src?.includes('/founder/'))calls.push('founder');
        if(img.src?.includes('buildings-atlas-painted'))calls.push('house');
        return original.call(this,img,...args);
      };
      try{render();}finally{ctx.drawImage=original;}
      return calls;
    },offset);
    assert.ok(order.includes('house') && order.includes('founder'),`Missing actual canvas draws: ${order}`);
    assert.equal(order.indexOf('founder')<order.indexOf('house'),offset<0,'Founder bypassed world occlusion');
    await page.screenshot({path:new URL(`founder-${label}-house.png`,output).pathname});
  }
  check('Actual canvas draw order puts the Founder behind or in front of a house at the correct ground depth');

  const mobile = await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  await mobile.goto(server.gameUrl);await mobile.waitForFunction(()=>typeof window.startNewGame==='function');
  await mobile.locator('#title-screen .title-btn.primary').tap();await mobile.locator('#btn-founder').tap();
  assert.equal(await mobile.locator('#btn-founder').getAttribute('aria-pressed'),'true');
  const origin=await mobile.evaluate(()=>({x:G.avatar.x,y:G.avatar.y}));
  await mobile.locator('#game').tap({position:{x:250,y:455}});
  await mobile.waitForFunction(({x,y})=>Math.hypot(G.avatar.x-x,G.avatar.y-y)>.05,origin);
  await mobile.screenshot({path:new URL('founder-in-game-mobile.png',output).pathname});
  assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  check('390px touch: Founder selection and ground tap move the character without page overflow');
  const manifest=JSON.parse(await readFile(new URL('../assets/sprites/founder/manifest.json',import.meta.url)));
  assert.deepEqual(manifest.directions,headings.map(h=>h[2]));
  const contract=await page.evaluate(()=>founderView.founderPresentationDiagnostics());
  assert.equal(contract.strideTiles,1.6);
  for(const [id,clip] of Object.entries(contract.clips)){
    assert.equal(clip.frames,manifest.actions[id].frames,`${id}: runtime frame contract drift`);
    assert.ok(Math.abs(clip.duration-manifest.actions[id].duration)<1e-6,`${id}: runtime duration drift`);
  }
  assert.ok(contract.atlases.filter(a=>a.size>64).length<=2);
  assert.ok(contract.atlases.reduce((sum,a)=>sum+a.decodedBytes,0)<40*1024*1024);
  report.motion=result.seen;report.transitions=transitions;
  assert.deepEqual(report.errors,[]);
  await writeFile(new URL(`game-validation-${process.env.FOUNDER_BROWSER||'chromium'}.json`,output),JSON.stringify(report,null,2)+'\n');
  console.log(`[founder game] PASS — ${report.checks.length} checks`);
} finally {await browser.close();await server.stop();}
