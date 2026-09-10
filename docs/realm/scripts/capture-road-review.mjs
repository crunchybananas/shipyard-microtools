#!/usr/bin/env node
// A real construction/traffic slice with a known road network for material QA.
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {ensureServer} from './_serve.mjs';
const label=process.argv[2]||'roads-209';
const expanded=process.argv.includes('--expanded-buildings');
const winter=process.argv.includes('--winter-presentation');
const output=new URL(`../tmp/graphics-world/${label}/`,import.meta.url);
await mkdir(output,{recursive:true});
const server=await ensureServer(),browser=await chromium.launch({headless:true,channel:'chrome'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1050},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(server.gameUrl);await page.waitForFunction(()=>typeof startNewGame==='function');
 await page.locator('#kingdom-name-input').fill('Weathered ways');
 await page.evaluate(()=>{startNewGame();setSpeed(0);});
 await page.getByRole('button',{name:'Skip tutorial',exact:true}).click();
 await page.waitForFunction(()=>G.camera.zoom===1.3);
 await page.evaluate(()=>{const state=__realm.landscape();if(state.state!=='ready')throw new Error(JSON.stringify(state));});
 await page.evaluate(async({expanded,winter})=>{
  const {TILE,getDaylight,getSeasonIndex}=await import('./js/state.js?realm=198'),{TECHS}=await import('./js/tech.js?realm=198');
  const {applyPostFX}=await import('./js/postfx.js?realm=198');
  const {renderMinimap}=await import('./js/minimap.js?realm=198');
  const ui=await import('./js/ui.js?realm=198');
  window.roadReviewRender=await import('./js/render.js?realm=198');
  window.roadReviewCache=await import('./js/citizen-render-cache.js?realm=198');
  G.debug.disableEvents=true;G.debug.pauseRendering=true;G.nextRaidDay=9999;G._followAvatar=false;
  Object.assign(G.resources,{wood:10000,stone:10000,gold:10000,iron:1000,planks:1000,tools:1000});
  for(const tech of Object.keys(TECHS))G.researchedTechs.add(tech);
  for(let y=34;y<52;y++)for(let x=34;x<52;x++){
   if(!G.buildingGrid[y][x])G.map[y][x]=TILE.GRASS;
   G.fog[y][x]=true;
  }
  G.obstacleEpoch++;
  const sites=[['house',41,41],['house',45,42],['house',45,44],['house',42,45],['granary',42,42],['market',46,41],['farm',45,40],['well',41,42]];
  if(expanded)sites.push(['school',42,40],['cowpen',46,44],['chickencoop',43,45],['townhall',47,42],['barracks',47,44]);
  const roads=new Map();const add=(x,y)=>roads.set(`${x},${y}`,['road',x,y]);
  for(let x=38;x<=48;x++)add(x,43);
  for(let y=36;y<=49;y++)add(44,y);
  for(let y=39;y<=43;y++)add(39,y);
  for(let x=39;x<=44;x++)add(x,39);
  for(const [type,x,y] of [...sites,...roads.values()]){
   const result=G.debug.dispatch({type:'PLACE_BUILDING',building:type,x,y});
   if(!result.ok)throw new Error(`${type} at ${x},${y}: ${JSON.stringify(result)}`);
  }
  G.camera.x=0;G.camera.y=1376;G.camera.zoom=2.1;
  window.roadReview={samples:0,postProcessedFrames:0,stationary:0,cycling:0,tracks:new Map(),maxWait:0,waits:new Map(),marks:[],displaySeason:winter?'winter':null};
  window.roadReviewFrame=()=>{
   const season=G.season;
   if(roadReview.displaySeason)G.season=roadReview.displaySeason;
   try{
    roadReviewRender.render();
    applyPostFX(document.getElementById('game'),G.gameTick,getDaylight(),getSeasonIndex());
    roadReview.postProcessedFrames++;
   }finally{G.season=season;}
  };
  window.roadReviewMinimap=renderMinimap;
  window.roadReviewPresent=()=>{
   const season=G.season;if(roadReview.displaySeason)G.season=roadReview.displaySeason;
   try{ui.updateUI();ui.renderBuildBar();ui.renderMissions();roadReviewFrame();renderMinimap();}
   finally{G.season=season;}
  };
 },{expanded,winter});
 for(let end=600;end<=7200;end+=600){
  const mark=await page.evaluate(end=>{
   const review=roadReview;
   while(G.gameTick<end){
    G.debug.step(1);
    for(const citizen of G.citizens){
     if(!citizen.path||citizen.pathIdx>=citizen.path.length){review.waits.delete(citizen.actorId);continue;}
     const target=citizen.path[citizen.pathIdx],key=`${target.x},${target.y}`;
     let prior=review.waits.get(citizen.actorId);
     if(!prior||prior.key!==key||Math.hypot(prior.x-citizen.x,prior.y-citizen.y)>.4){prior={x:citizen.x,y:citizen.y,key,tick:G.gameTick};review.waits.set(citizen.actorId,prior);}
     review.maxWait=Math.max(review.maxWait,G.gameTick-prior.tick);
    }
    if(G.gameTick%6===0){
     G._renderAlpha=1;roadReviewFrame();review.samples++;
     for(const record of roadReviewCache.inspectCitizenRenderCache()){
      const m=record.motion;if(!m||m.tick!==G.gameTick+1)continue;
      const old=review.tracks.get(record.actorId),held=old&&old.tick===G.gameTick-6&&m.deltaTicks>0&&Math.hypot(m.x-old.x,m.y-old.y)<.00001;
      const duration=held?old.duration+6:0;
      if(duration>=12){review.stationary++;if(Math.abs(m.phase-old.phase)>1e-8)review.cycling++;}
      review.tracks.set(record.actorId,{x:m.x,y:m.y,phase:m.phase,tick:G.gameTick,duration});
     }
    }
   }
   const mark={tick:G.gameTick,population:G.population,complete:G.buildings.filter(b=>b.buildProgress>=1).length,total:G.buildings.length,roads:G.buildings.filter(b=>b.type==='road'&&b.buildProgress>=1).length,maxWait:review.maxWait};
   review.marks.push(mark);return mark;
  },end);
  console.log(`[road construction] ${JSON.stringify(mark)}`);
  if(end===1800){
   await page.evaluate(()=>roadReviewPresent());
   await page.screenshot({path:new URL('construction.png',output).pathname});
  }
 }
 const report=await page.evaluate(async()=>{
  const {serializeGame}=await import('./js/save-state.js?realm=198'),ui=await import('./js/ui.js?realm=198');
  const save=serializeGame();G.dayPhase=G.dayLength*.5;G.season=roadReview.displaySeason||'spring';G.camera.zoom=2.1;
  ui.updateUI();ui.renderBuildBar();ui.renderMissions();roadReviewFrame();roadReviewMinimap();
  return {samples:roadReview.samples,postProcessedFrames:roadReview.postProcessedFrames,stationary:roadReview.stationary,cycling:roadReview.cycling,marks:roadReview.marks,displaySeason:roadReview.displaySeason,landscape:__realm.landscape(),buildingSurfaces:__realm.buildingSurfaces?.(),save};
 });
 await page.screenshot({path:new URL('settlement.png',output).pathname});
 await page.evaluate(()=>{G.camera.zoom=3.3;G.camera.x=0;G.camera.y=1376;roadReviewFrame();roadReviewMinimap();});
 await page.screenshot({path:new URL('close.png',output).pathname});
 const {save,...metrics}=report;
 await writeFile(new URL('report.json',output),JSON.stringify({errors,...metrics},null,2)+'\n');
 await writeFile(new URL('save.json',output),JSON.stringify(save)+'\n');
 const final=report.marks.at(-1);
 if(errors.length||report.cycling||final.complete!==(expanded?46:41)||final.roads!==32||final.maxWait>90) {
  throw new Error(JSON.stringify({errors,cycling:report.cycling,final}));
 }
 console.log(`[road review] ${report.samples} renders; ${report.stationary} stationary observations; ${report.cycling} unwanted gait changes`);
}finally{await browser.close();await server.stop();}
