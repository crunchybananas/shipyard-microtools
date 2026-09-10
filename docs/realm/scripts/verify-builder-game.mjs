#!/usr/bin/env node
// Exercise the ordinary game draw, image failures, real construction and the
// shared crowd cache. Fixtures live in separate browser storage contexts.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {ensureServer} from './_serve.mjs';
import {launchGraphicsBrowser,graphicsBrowserSuffix} from './_graphics-browser.mjs';
const server=await ensureServer(),browser=await launchGraphicsBrowser();
const out=new URL(`../tmp/graphics-world/builder-game-gate${graphicsBrowserSuffix}/`,import.meta.url);await mkdir(out,{recursive:true});
const report={browser:browser.version(),errors:[],hud:[]};
const headings=[[1,1,'s'],[1,0,'se'],[1,-1,'e'],[0,-1,'ne'],[-1,-1,'n'],[-1,0,'nw'],[-1,1,'w'],[0,1,'sw']];
async function start(page){
  page.on('pageerror',e=>report.errors.push(e.message));
  // The atomic-family case intentionally holds a PNG request open. Waiting
  // for window.load here can wait on the very image that the test releases
  // only after it has exercised the fallback.
  await page.goto(server.gameUrl,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>typeof startNewGame==='function');
  await page.locator('#kingdom-name-input').fill('The craftsperson');
  await page.evaluate(()=>{startNewGame();setSpeed(0);});
  await page.getByRole('button',{name:'Skip tutorial',exact:true}).click();
  await page.waitForFunction(()=>G.camera.zoom===1.3);
  const hud=await page.evaluate(()=>({width:innerWidth,resources:['wood','stone','food','gold'].map(name=>{
    const value=document.getElementById(`r-${name}`),rect=value.getBoundingClientRect();
    const hit=document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2);
    return{name,visible:rect.width>0&&rect.left>=0&&rect.right<=innerWidth&&value.closest('.res').contains(hit)};
  })}));
  assert.ok(hud.resources.every(resource=>resource.visible),`Covered resource counters: ${JSON.stringify(hud)}`);
  report.hud.push(hud);
}
try{
  const page=await browser.newPage({viewport:{width:1360,height:980},deviceScaleFactor:2});
  await start(page);
  await page.waitForFunction(()=>__realm.builderSprites().small.length===4&&__realm.builderSprites().small.every(a=>a.state==='ready'));
  await page.evaluate(async()=>{
    window.builderRender=await import('./js/render.js?realm=198');
    window.builderCache=await import('./js/citizen-render-cache.js?realm=198');
    window.builderView=await import('./js/builder-presentation.js?realm=198');
    window.builderOwnership=await import('./js/citizen-ownership.js?realm=198');
    window.builderSave=await import('./js/save-state.js?realm=198');
    const {TILE}=await import('./js/state.js?realm=198');
    G.debug.pauseRendering=true;G._followAvatar=false;G._renderAlpha=1;
    Object.assign(G.avatar,{x:2,y:2,_px:2,_py:2,path:null,pathIdx:0});
    while(G.citizens.length>1)builderOwnership.removeCitizenFromWorld(G.citizens.at(-1),'citizen-removed');
    G.population=1;G.animals=[];G.enemies=[];G.soldiers=[];G.walkers=[];G.caravans=[];
    G.selectedBuild=null;G.selectedBuilding=null;G.hoveredTile=null;
    for(let y=36;y<48;y++)for(let x=36;x<48;x++)if(!G.buildingGrid[y][x]){G.map[y][x]=TILE.GRASS;G.fog[y][x]=true;}
    G.camera={x:32,y:1360,zoom:2.7};
    Object.assign(G.citizens[0],{x:43,y:42,_px:43,_py:42,tx:43,ty:42,path:null,pathIdx:0,carrying:null,carryAmount:0,faceX:1,faceZ:1});
    builderCache.resetCitizenRenderCache();builderRender.render();
  });
  report.motion=await page.evaluate(headings=>{
    const c=G.citizens[0],ctx=document.getElementById('game').getContext('2d'),original=ctx.drawImage;
    const observations=[];
    function paint(label){
      const calls=[];
      ctx.drawImage=function(image,...args){
        if(image.src?.includes('/citizens/builder/')&&args.length===8)calls.push({source:image.src,args});
        return original.call(this,image,...args);
      };
      try{builderRender.render();}finally{ctx.drawImage=original;}
      if(calls.length!==1)throw new Error(`${label}: expected one new citizen draw, got ${calls.length}`);
      const state=builderCache.inspectCitizenRenderCache()[0],draw=state.builder.drawn,s=builderRender.toScreen(c.x,c.y),a=calls[0].args;
      const item={label,...draw,anchorError:Math.hypot(a[4]+a[6]/2-s.x,a[5]+a[7]*.86-s.y)};
      observations.push(item);return item;
    }
    for(const [dx,dy,expected] of headings){
      builderCache.resetCitizenRenderCache();
      c.faceX=dx;c.faceZ=dy;c.path=null;c.carrying=null;c.carryAmount=0;
      builderOwnership.transitionCitizenActivity(c,'idle','idle-wait');
      for(let f=0;f<12;f++){
        G.gameTick++;c._px=c.x;c._py=c.y;c.x+=dx*.018;c.y+=dy*.018;
        paint(`walk-${expected}`);
      }
    }
    // A live path with no displacement must hold the feet, then settle.
    c.path=[{x:46,y:45}];c.pathIdx=0;c._px=c.x;c._py=c.y;
    const wait=[];for(let n=0;n<35;n++){G.gameTick++;c._movedAt=G.gameTick;wait.push(paint('blocked'));}
    c.carrying='wood';c.carryAmount=3;
    const cargo=[];for(let n=0;n<30;n++){G.gameTick++;cargo.push(paint('held-cargo'));}
    const paused=[];for(let n=0;n<20;n++){G.camera.x+=.2;paused.push(paint('paused-camera'));}
    const before=JSON.stringify(builderSave.serializeGame());for(let n=0;n<10;n++)builderRender.render();
    const after=JSON.stringify(builderSave.serializeGame());
    builderOwnership.transitionCitizenActivity(c,'eating','eat-food');c.carrying=null;c.carryAmount=0;c.path=null;
    G.gameTick++; // Ordinary activity/cargo snapshots advance at the tick boundary.
    const eating=paint('eating');
    return{observations,wait,cargo,paused,saveUnchanged:before===after,eating};
  },headings);
  await writeFile(new URL('motion.json',out),JSON.stringify(report.motion,null,2)+'\n');
  for(const [,,dir] of headings){const rows=report.motion.observations.filter(r=>r.label===`walk-${dir}`);assert.ok(rows.every(r=>r.direction===dir&&r.action==='walk'),JSON.stringify(rows.filter(r=>r.direction!==dir||r.action!=='walk').slice(0,3)));assert.ok(new Set(rows.map(r=>r.frame)).size>=4);}
  assert.ok(report.motion.observations.every(r=>r.anchorError<1e-7));
  assert.ok(report.motion.wait.slice(7).every(r=>r.action==='idle'));
  assert.equal(new Set(report.motion.cargo.map(r=>r.frame)).size,1);
  assert.ok(report.motion.paused.every(r=>r.frame===report.motion.cargo.at(-1).frame));
  assert.ok(report.motion.saveUnchanged);assert.equal(report.motion.eating.action,'idle');

  // Load every detailed action/facing while retaining at most twelve rows;
  // then request all 32 visible poses repeatedly. They must not churn.
  report.cache=await page.evaluate(async()=>{
    const ctx=document.createElement('canvas').getContext('2d');ctx.setTransform(4,0,0,4,0,0);
    const requests=[];
    for(const action of ['walk','idle','work','carry'])for(let d=0;d<8;d++)requests.push({action,motion:{phase:.25},continuity:{},faceScreenX:Math.sin(d*Math.PI/4),faceScreenY:Math.cos(d*Math.PI/4)/2,x:10,y:30});
    for(const request of requests){
      builderView.beginBuilderSpritesFrame();builderView.beginBuilderSpritesFrame();builderView.beginBuilderSpritesFrame();
      for(let retry=0;retry<120;retry++){
        builderView.drawBuilder(ctx,request);
        if(request.continuity.builder.drawn.size===128)break;
        await new Promise(requestAnimationFrame);
      }
      if(request.continuity.builder.drawn.size!==128)throw new Error('Detail row did not load');
    }
    for(let f=0;f<120;f++){
      builderView.beginBuilderSpritesFrame();for(const request of requests)builderView.drawBuilder(ctx,request);
      await new Promise(requestAnimationFrame);
      if(f>=3&&builderView.inspectBuilderSprites().detail.every(e=>e.state!=='loading'))break;
    }
    const before=performance.getEntriesByType('resource').filter(e=>e.name.includes('/citizens/builder/runtime/')).length;
    for(let f=0;f<12;f++){
      builderView.beginBuilderSpritesFrame();for(const request of requests)builderView.drawBuilder(ctx,request);
      await new Promise(requestAnimationFrame);
    }
    const after=performance.getEntriesByType('resource').filter(e=>e.name.includes('/citizens/builder/runtime/')).length;
    return{...builderView.inspectBuilderSprites(),warmAdditionalRequests:after-before};
  });
  assert.ok(report.cache.detail.length<=12);assert.ok(report.cache.decodedBytes<=42*1024*1024);
  assert.equal(report.cache.warmAdditionalRequests,0,'Visible facings churn the shared cache');
  await page.close();

  // Actual commands and ticks take a settler to a new construction site.
  const play=await browser.newPage({viewport:{width:1360,height:980},deviceScaleFactor:2});await start(play);
  await play.waitForFunction(()=>__realm.builderSprites().small.every(a=>a.state==='ready')&&__realm.builderSprites().small.length===4);
  report.construction=await play.evaluate(async()=>{
    const {TILE}=await import('./js/state.js?realm=198');
    const {render}=await import('./js/render.js?realm=198');
    const {inspectCitizenRenderCache}=await import('./js/citizen-render-cache.js?realm=198');
    G.debug.pauseRendering=true;G._followAvatar=false;G._renderAlpha=1;G.debug.disableEvents=true;
    Object.assign(G.resources,{wood:1000,stone:1000,gold:1000});
    for(let y=38;y<47;y++)for(let x=38;x<48;x++)if(!G.buildingGrid[y][x]){G.map[y][x]=TILE.GRASS;G.fog[y][x]=true;}
    const c=G.citizens[0];
    const placed=G.debug.dispatch({type:'PLACE_BUILDING',building:'house',x:43,y:42});
    const assigned=G.debug.dispatch({type:'ASSIGN_CITIZEN',actorId:c.actorId,x:43,y:42});
    const seen=[];let proof=null;
    G.camera={x:32,y:1320,zoom:2.5};
    for(let tick=0;tick<1800;tick++){
      G.debug.step(1);render();
      const pose=inspectCitizenRenderCache().find(r=>r.actorId===c.actorId)?.builder?.drawn;
      if(pose)seen.push({tick:G.gameTick,activity:c.activity.kind,progress:G.buildingGrid[42][43].buildProgress,...pose});
      if(!proof&&pose?.action==='work'&&pose.frame>=5&&pose.frame<=8)proof=document.getElementById('game').toDataURL();
      if(G.buildingGrid[42][43].buildProgress>=1)break;
    }
    window.constructionReview={c,render};
    return{placed,assigned,seen,proof,completed:G.buildingGrid[42][43].buildProgress>=1,profession:c.profession.kind};
  });
  assert.ok(report.construction.placed.ok&&report.construction.assigned.ok&&report.construction.completed);
  assert.ok(report.construction.seen.some(r=>r.action==='walk')&&report.construction.seen.some(r=>r.action==='work'));
  if(report.construction.proof)await writeFile(new URL('construction.png',out),Buffer.from(report.construction.proof.split(',')[1],'base64'));
  delete report.construction.proof;
  await play.close();

  const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await start(mobile);
  await mobile.waitForFunction(()=>__realm.builderSprites().small.length===4&&__realm.builderSprites().small.every(a=>a.state==='ready'));
  const target=await mobile.evaluate(async()=>{
    const {render,toScreen}=await import('./js/render.js?realm=198');
    const {TILE}=await import('./js/state.js?realm=198');
    G.debug.pauseRendering=true;G._followAvatar=false;G._renderAlpha=1;G.selectedBuild=null;
    const c=G.citizens[0];
    Object.assign(c,{x:43,y:42,_px:43,_py:42,tx:43,ty:42,path:null,pathIdx:0,faceX:1,faceZ:1});
    G.map[42][43]=TILE.GRASS;G.fog[42][43]=true;
    G.gameTick++;
    const s=toScreen(c.x,c.y);G.camera={x:s.x,y:s.y-12,zoom:2.6};render();
    const canvas=document.getElementById('game'),r=canvas.getBoundingClientRect();
    return {actorId:c.actorId,x:r.left+(s.x-G.camera.x)*G.camera.zoom+r.width/2,
      y:r.top+(s.y-10-G.camera.y)*G.camera.zoom+r.height/2};
  });
  await mobile.touchscreen.tap(target.x,target.y);
  await mobile.waitForFunction(id=>G.selectedCitizenId===id,target.actorId);
  await mobile.waitForFunction(()=>getComputedStyle(document.getElementById('info-panel')).opacity==='1');
  await mobile.evaluate(()=>forceRender());
  report.mobile=await mobile.evaluate(()=>{
    const panel=document.getElementById('info-panel'),rect=panel.getBoundingClientRect(),dock=document.getElementById('build-bar').getBoundingClientRect();
    return{width:innerWidth,noOverflow:document.documentElement.scrollWidth<=innerWidth,selected:G.selectedCitizenId,
      maps:__realm.builderSprites().small.filter(a=>a.state==='ready').length,panelGap:dock.top-rect.bottom,
      readable:getComputedStyle(panel).opacity==='1',rawReasonShown:panel.textContent.includes('spawn-idle')};
  });
  assert.ok(report.mobile.noOverflow);assert.equal(report.mobile.maps,4);
  assert.ok(report.mobile.panelGap>=4&&report.mobile.readable&&!report.mobile.rawReasonShown);
  await mobile.screenshot({path:new URL('mobile.png',out).pathname});
  await mobile.close();

  // Delaying one action must hold the entire legacy family. A failed image
  // cannot reveal a new body for idle and an old body for work/carry.
  const delayed=await browser.newPage();let release;const gate=new Promise(resolve=>release=resolve);
  await delayed.route('**/citizens/builder/work-64.png',async route=>{await gate;await route.continue();});
  await start(delayed);
  await delayed.waitForFunction(()=>__realm.builderSprites().small.filter(a=>a.state==='ready').length===3);
  const capture=async p=>p.evaluate(async()=>{
    const {render}=await import('./js/render.js?realm=198'),ctx=document.getElementById('game').getContext('2d'),original=ctx.drawImage;
    const calls=[];ctx.drawImage=function(image,...args){if(/actors-atlas|\/citizens\/builder\//.test(image.src||''))calls.push(image.src);return original.call(this,image,...args);};
    try{render();}finally{ctx.drawImage=original;}return calls;
  });
  const waiting=await capture(delayed);assert.ok(waiting.length&&waiting.every(src=>!src.includes('/citizens/builder/')));
  release();await delayed.waitForFunction(()=>__realm.builderSprites().small.every(a=>a.state==='ready'));
  const ready=await capture(delayed);assert.ok(ready.length&&ready.every(src=>src.includes('/citizens/builder/')));
  await delayed.close();
  const failed=await browser.newPage();await failed.route('**/citizens/builder/carry-64.png',route=>route.abort());await start(failed);
  await failed.waitForFunction(()=>__realm.builderSprites().small.some(a=>a.state==='failed'));
  const fallback=await capture(failed);assert.ok(fallback.length&&fallback.every(src=>!src.includes('/citizens/builder/')));
  report.atomicLoading={waiting:waiting.length,ready:ready.length,failedFallback:fallback.length};
  assert.deepEqual(report.errors,[]);
  await writeFile(new URL('report.json',out),JSON.stringify(report,null,2)+'\n');
  console.log(`[builder game] PASS ${report.browser}: eight directions, real construction, held traffic/cargo/pause, unchanged saves, atomic loading, bounded crowd cache and 390px touch selection`);
}finally{await browser.close();await server.stop();}
