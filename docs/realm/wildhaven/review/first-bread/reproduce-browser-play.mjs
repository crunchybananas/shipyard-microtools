import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
import fs from 'node:fs';import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../../', import.meta.url));
const out=root+'review/first-bread/';fs.mkdirSync(out,{recursive:true});
const report={method:'Actual touch controls and normal 3x clock in installed Chrome, isolated browser storage. Started at the genuine earned Day5 bell save. Read-only snapshot, guide and projection helpers; no simulation advance, resource injection or simulator mutations.',started:new Date().toISOString(),actions:[],checks:[],errors:[],failed:[]};
const browser=await chromium.launch({channel:'chrome',headless:true});let page,context;
const snap=()=>page.evaluate(()=>__wildhaven.snapshot());
async function pause(){if(await page.locator('#pause').getAttribute('aria-label')==='Pause')await page.locator('#pause').tap();}
async function run(){await page.locator('[data-speed="3"]').tap();}
async function guide(){return page.evaluate(async()=>{const {firstBreadStep}=await import('./js/bread-guide.js');const {rates}=await import('./js/sim.js');return firstBreadStep(__wildhaven.state,{paused:document.getElementById('pause').getAttribute('aria-label')==='Resume',daily:rates(__wildhaven.state)});});}
async function shot(name){await page.screenshot({path:out+name+'.png'});}
async function place(type){
 await pause();await page.locator('#objective-action').tap();assert.equal(await page.locator('#placement').isVisible(),true);
 await page.evaluate(()=>{__wildhaven.world.focusWorld(0,0,27);__wildhaven.world.updateCamera(3)});
 const point=await page.evaluate(type=>{const w=__wildhaven.world;const cells=[];for(let z=-10;z<=10;z++)for(let x=-10;x<=10;x++)cells.push({x,z});cells.sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z));for(const c of cells){if(!__wildhaven.canBuild(type,c.x,c.z).ok)continue;const p=w.project(c.x,c.z),hit=w.pick(p.x,p.y);if(document.elementFromPoint(p.x,p.y)?.id==='world'&&hit?.x===c.x&&hit?.z===c.z)return{...p,cell:c}}},type);
 assert.ok(point,'visible legal site for '+type);await page.touchscreen.tap(point.x,point.y);const before=await snap();await page.locator('#confirm-building').tap();const after=await snap();assert.equal(after.buildings.length,before.buildings.length+1);await page.locator('#cancel-building').tap();report.actions.push({action:'place',type,cell:point.cell,day:after.day});console.log('Placed',type,'day',after.day);await run();
}
try{
 context=await browser.newContext({viewport:{width:1024,height:768},hasTouch:true,isMobile:true});page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('requestfailed',r=>report.failed.push({url:r.url(),error:r.failure()}));page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))report.failed.push({url:r.url(),status:r.status()})});
 const raw=fs.readFileSync(out+'sim-authentic-day5-save.json','utf8');
 await page.addInitScript(raw=>{if(!sessionStorage.seeded){localStorage.setItem('wildhaven.v4',raw);sessionStorage.seeded='1'}},raw);
 await page.goto(process.env.WILDHAVEN_REVIEW_URL || 'http://127.0.0.1:14724/realm/wildhaven/?review');await page.waitForFunction(()=>window.__wildhaven,undefined,{timeout:60000});await page.locator('#continue').tap();
 const initial=await snap();assert.equal(initial.won,true);report.initial={day:initial.day,elapsed:initial.elapsed,population:initial.population};
 if(!initial.guidance?.goal){await page.locator('#tablet-town-toggle').tap();await page.locator('[data-action-id="goal-first-bread"]').tap();}
 assert.equal(await page.locator('#town-book').isVisible(),false);assert.equal(await page.locator('#objective-action').isVisible(),true);assert.equal(await page.locator('#objective-action').evaluate(n=>document.activeElement===n),true);assert.deepEqual((await snap()).resources,initial.resources);assert.equal((await snap()).policies.charter,initial.policies.charter);report.checks.push('Free goal closes Council, expands tablet objective, focuses next action, spends nothing and grants no charter');await shot('ipad-goal-handoff');
 await page.reload();await page.waitForFunction(()=>window.__wildhaven);await page.locator('#continue').tap();assert.equal((await snap()).guidance.goal,'first_bread');report.checks.push('Goal survives actual browser reload');
 // The compact landscape objective is intentionally collapsed on entry.
 if(!await page.locator('#objective-action').isVisible())await page.locator('#collapse-objective').tap();
 const start=Date.now();let last='',mapChecked=false;
 while(!(await snap()).guidance.firstBread && Date.now()-start<600000){
  if(!await page.locator('#objective-action').isVisible())await page.locator('#collapse-objective').tap();
  const next=await guide();assert.ok(next);if(next.title!==last){const s=await snap();report.actions.push({action:'guide',title:next.title,label:next.label,day:s.day,elapsed:s.elapsed});console.log(next.title,'—',next.label);last=next.title;}
  if(next.type){await place(next.type);continue;}
  if(next.researchId && !(await snap()).research.active){
   await pause();await page.locator('#objective-action').tap();const button=page.locator(`[data-action-id="research-${next.researchId}"]`);await button.tap();assert.equal((await snap()).research.active.id,next.researchId);report.actions.push({action:'study',id:next.researchId,day:(await snap()).day});
   if(!mapChecked){await page.locator('[data-action-id="council-jump-map"]').tap();assert.equal(await page.locator('.research-node.bread-route').count(),3);await shot('ipad-bread-research-route');await page.setViewportSize({width:768,height:1024});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await shot('ipad-portrait-bread-research-route');await page.setViewportSize({width:1024,height:768});mapChecked=true;report.checks.push('Three bread discoveries marked in landscape and portrait research map');}
   await page.locator('#close-town-book').tap();await run();continue;
  }
  if(next.workforceId){throw Error('Actual staffing intervention required: '+JSON.stringify(next));}
  if(next.resume){await page.locator('#objective-action').tap();await run();}
  else if(await page.locator('#pause').getAttribute('aria-label')==='Resume')await run();
  await page.waitForTimeout(1000);
 }
 await pause();const final=await snap();assert.ok(final.guidance.firstBread,'First bread within bounded real-clock play');assert.equal(final.policies.charter,initial.policies.charter);assert.equal(final.events.filter(e=>e.type==='milestone'&&e.text.includes('first bread')).length,1);
 report.final={day:final.day,elapsed:final.elapsed,population:final.population,firstBread:final.guidance.firstBread,realSeconds:(Date.now()-start)/1000};await shot('ipad-first-bread-made');fs.writeFileSync(out+'browser-earned-first-bread-save.json',JSON.stringify(final,null,2));
 await page.reload();await page.waitForFunction(()=>window.__wildhaven);await page.locator('#continue').tap();assert.deepEqual((await snap()).guidance,final.guidance);assert.deepEqual((await snap()).events,final.events);if(!await page.locator('#objective-action').isVisible())await page.locator('#collapse-objective').tap();assert.match(await page.locator('#objective-title').innerText(),/first bread/);await page.locator('#objective-action').tap();assert.equal((await snap()).guidance.goal,null);assert.deepEqual((await snap()).guidance.firstBread,final.guidance.firstBread);report.checks.push('Actual bakery production earns one milestone; reload preserves it; return to town goals keeps proof');
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.failed,[]);report.passed=true;console.log(JSON.stringify(report.final));
}catch(error){report.error=error.stack;console.error(error);if(page){await shot('browser-attempt-failure').catch(()=>{});fs.writeFileSync(out+'browser-resume-save.json',JSON.stringify(await snap().catch(()=>null),null,2));}process.exitCode=1;}finally{report.finished=new Date().toISOString();fs.writeFileSync(out+'browser-play.json',JSON.stringify(report,null,2));await browser.close();}
