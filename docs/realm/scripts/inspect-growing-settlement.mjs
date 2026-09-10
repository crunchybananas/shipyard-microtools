#!/usr/bin/env node
// Reproducible browser playtest: build a dense town in stages and retain the
// actual traffic failure state. Fixtures run in an isolated browser context.
import {chromium} from '@playwright/test';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {ensureServer} from './_serve.mjs';
const argument=(name,fallback)=>process.argv.includes(name)?process.argv[process.argv.indexOf(name)+1]:fallback;
const label=argument('--label','inspection'),seed=argument('--seed','Worn roads');
const ticks=Number(argument('--ticks','14400'));
const inspectMotion=process.argv.includes('--motion');
const out=new URL(`../tmp/graphics-world/${label}/`,import.meta.url);await mkdir(out,{recursive:true});
const server=await ensureServer(),browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1440,height:950},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 const control=argument('--citizens-control',null);
 if(control){
  const source=await readFile(control,'utf8');
  await page.route(/\/js\/citizens\.js\?realm=\d+$/,route=>route.fulfill({status:200,contentType:'text/javascript',body:source}));
 }
 await page.goto(server.gameUrl);await page.waitForFunction(()=>typeof startNewGame==='function');
 await page.locator('#kingdom-name-input').fill(seed);
 await page.evaluate(()=>{startNewGame();setSpeed(0);});
 await page.getByRole('button',{name:'Skip tutorial',exact:true}).click();
 await page.evaluate(async inspectMotion=>{
  const {TILE}=await import('./js/state.js?realm=198');
  const {TECHS}=await import('./js/tech.js?realm=198');
  window.growthSave=await import('./js/save-state.js?realm=198');
  window.growthUI=await import('./js/ui.js?realm=198');
  window.growthRenderer=await import('./js/render.js?realm=198');
  window.growthMotionCache=await import('./js/citizen-render-cache.js?realm=198');
  if(G.gameTick!==0)throw new Error(`Growth fixture must start at tick zero, got ${G.gameTick}`);
  G.debug.disableEvents=true;G.nextRaidDay=9999;
  Object.assign(G.resources,{wood:10000,stone:10000,gold:10000,iron:1000,planks:1000,tools:1000});
  for(const tech of Object.keys(TECHS))G.researchedTechs.add(tech);
  // Control sites, not actors or routes. Construction, staffing, meals,
  // deliveries and population growth continue through real core behavior.
  for(let y=31;y<=49;y++)for(let x=31;x<=49;x++){
   if(!G.buildingGrid[y][x])G.map[y][x]=TILE.GRASS;
   G.fog[y][x]=true;
  }
  G.obstacleEpoch++;
  G.camera.x=0;G.camera.y=1280;G.camera.zoom=1.65;
  window.growth={placed:[],marks:[],episodes:[],tracks:new Map(),worst:null,trace:[],maxWait:0};
  growth.motion=inspectMotion?{renderSamples:0,actorSamples:0,stationarySamples:0,stationaryPhaseChanges:0,examples:[],tracks:new Map()}:null;
  growth.plan=['farm','house','farm','house','granary','house','farm','house','market','house','windmill','bakery','house','tavern','house','farm','house','school','house','well'];
 },inspectMotion);
 const schedule=180;
 for(let end=600;end<=ticks;end+=600){
  const result=await page.evaluate(({end,schedule})=>{
   const state=growth;
   while(G.gameTick<end){
    if(G.gameTick%schedule===0&&state.placed.length<state.plan.length){
     const type=state.plan[state.placed.length],spots=[];
     for(let y=33;y<=47;y++)for(let x=33;x<=47;x++)spots.push({x,y,score:Math.abs(x-40)+Math.abs(y-40)});
     spots.sort((a,b)=>a.score-b.score||a.y-b.y||a.x-b.x);
     const site=spots.find(({x,y})=>G.debug.dispatch({type:'PLACE_BUILDING',building:type,x,y}).ok);
     if(site)state.placed.push({type,...site,tick:G.gameTick});
    }
    G.debug.step(1);
    if(state.motion&&G.gameTick%6===0){
     G._renderAlpha=1;growthRenderer.render();state.motion.renderSamples++;
     for(const record of growthMotionCache.inspectCitizenRenderCache()){
      const m=record.motion;
      if(!m||m.tick!==G.gameTick+1)continue;
      state.motion.actorSamples++;
      const old=state.motion.tracks.get(record.actorId);
      // Entering a building or leaving the viewport ends the observation.
      // A later reappearance can start on a new contact pose; it is not a
      // continuously visible stationary character playing a walk cycle.
      const stationary=old&&old.tick===G.gameTick-6&&m.deltaTicks>0&&Math.hypot(m.x-old.x,m.y-old.y)<.00001;
      const stoppedFor=stationary?old.stoppedFor+6:0;
      if(stoppedFor>=12){
       state.motion.stationarySamples++;
       if(Math.abs(m.phase-old.phase)>1e-8){
        state.motion.stationaryPhaseChanges++;
        if(state.motion.examples.length<12)state.motion.examples.push({tick:G.gameTick,id:record.actorId,old,now:m});
       }
      }
      state.motion.tracks.set(record.actorId,{x:m.x,y:m.y,phase:m.phase,stoppedFor,tick:G.gameTick});
     }
    }
    for(const c of G.citizens){
     if(!c.path||c.pathIdx>=c.path.length) {state.tracks.delete(c.actorId);continue;}
     const wp=c.path[c.pathIdx],goal=`${c._requestedTx},${c._requestedTy}:${wp.x},${wp.y}`;
     const old=state.tracks.get(c.actorId);
     const track=!old||old.goal!==goal||Math.hypot(old.x-c.x,old.y-c.y)>.4
      ?{goal,x:c.x,y:c.y,tick:G.gameTick}:old;
     state.tracks.set(c.actorId,track);
     const age=G.gameTick-track.tick;
     state.maxWait=Math.max(state.maxWait,age);
     if(age>=(state.worst?.age||179)+120){
      const neighbors=G.citizens.filter(o=>o!==c&&Math.hypot(o.x-c.x,o.y-c.y)<1.5);
      const describe=o=>({id:o.actorId,name:o.identity.name,x:o.x,y:o.y,activity:o.activity.kind,work:o.assignment?.building?.type,goal:o._pathGoal,path:o.path,index:o.pathIdx,wait:o._stuckTicks});
      const event={tick:G.gameTick,age,citizen:describe(c),neighbors:neighbors.map(describe)};
      state.worst=event;state.episodes.push(event);state.failureSave=growthSave.serializeGame();
     }
    }
    if(G.gameTick%30===0){state.trace.push({tick:G.gameTick,citizens:G.citizens.map(c=>({id:c.actorId,x:c.x,y:c.y,activity:c.activity.kind,wait:c._stuckTicks,goal:c._pathGoal,index:c.pathIdx}))});if(state.trace.length>200)state.trace.shift();}
   }
   const mark={tick:G.gameTick,population:G.population,food:G.resources.food,buildings:G.buildings.length,completed:G.buildings.filter(b=>b.buildProgress>=1).length,active:G.citizens.filter(c=>c.path&&c.pathIdx<c.path.length).length,maxWait:state.maxWait};
   state.marks.push(mark);growthUI.updateUI();forceRender();return mark;
  },{end,schedule});
  console.log(`[growth ${label}] ${JSON.stringify(result)}`);
  if(end===3600||end===7200||end===ticks)await page.screenshot({path:new URL(`town-${end}.png`,out).pathname});
 }
 const report=await page.evaluate(()=>({placed:growth.placed,marks:growth.marks,episodes:growth.episodes,worst:growth.worst,trace:growth.trace,maxWait:growth.maxWait,motion:growth.motion?{...growth.motion,tracks:undefined}:null,finalSave:growthSave.serializeGame(),failureSave:growth.failureSave}));
 const {finalSave,failureSave,...metrics}=report;
 await writeFile(new URL('inspection.json',out),JSON.stringify({seed,errors,...metrics},null,2)+'\n');
 await writeFile(new URL('final-save.json',out),JSON.stringify(finalSave)+'\n');
 if(failureSave)await writeFile(new URL('failure-save.json',out),JSON.stringify(failureSave)+'\n');
 console.log(`[growth ${label}] worst ${JSON.stringify(report.worst)}`);
 if(report.motion)console.log(`[growth ${label}] motion ${JSON.stringify(report.motion)}`);
 if(errors.length)throw new Error(errors.join('\n'));
 if(report.motion?.stationaryPhaseChanges)throw new Error('Stationary citizens advanced their gait during town growth');
}finally{await browser.close();await server.stop();}
