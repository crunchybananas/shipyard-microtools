/** Fresh town browser acceptance: real UI actions; review clock only skips waiting. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium, expect } from '@playwright/test';
const report={startedAt:new Date().toISOString(),scope:'Fresh opening and mobile use real controls, with review clock to skip waits. Migration uses a labeled legacy fixture. No opening resources or population are injected.',checks:[],errors:[],screenshots:[]};
const output=new URL('../review/',import.meta.url);
const prefix=process.env.WILDHAVEN_REVIEW_PREFIX||'';
if(!/^[a-z0-9-]*$/.test(prefix))throw new Error('Invalid review prefix');
const sources=['js/discovery.js','js/fieldbook-ui.js','living.css','assets/living-kit.glb','index.html','style.css','js/main.js','js/world.js','js/town-ui.js','js/sim.js','js/island.js','js/frontier.js','js/catalog.js','js/progression.js','assets/town-kit.glb'];
async function hashes(){return Object.fromEntries(await Promise.all(sources.map(async p=>[p,createHash('sha256').update(await readFile(new URL(`../${p}`,import.meta.url))).digest('hex')])));}
report.sourceHashesAtStart=await hashes();
const browser=await chromium.launch({headless:true});
async function check(name,fn){try{const details=await fn();report.checks.push({name,passed:true,details});console.log('PASS',name);}catch(e){report.checks.push({name,passed:false,error:e.stack});console.error('FAIL',name,e.message);throw e;}}
const snap=p=>p.evaluate(()=>__wildhaven.snapshot());
async function prepare(page){page.on('pageerror',e=>report.errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});await page.goto('http://127.0.0.1:4751/wildhaven/?review',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__wildhaven,{timeout:30000});}
async function start(page){await page.locator('#start').click();await page.locator('#pause').click();await page.locator('#collapse-objective').click();await page.waitForTimeout(500);}
async function shot(page,name){await page.screenshot({path:new URL(`${prefix}${name}.png`,output).pathname});report.screenshots.push(`${prefix}${name}.png`);}
async function advance(page,seconds){await page.evaluate(seconds=>{__wildhaven.advance(seconds);__wildhaven.sync();},seconds);}
async function place(page,type,x,z,touch=false){
 const before=await snap(page),choice=page.locator(`[data-build="${type}"]`);
 if(await choice.getAttribute('aria-pressed')!=='true')touch?await choice.tap():await choice.click();
 const point=await page.evaluate(({x,z})=>{const p=__wildhaven.project(x,z);return{...p,hit:document.elementFromPoint(p.x,p.y)?.id};},{x,z});
 assert.equal(point.hit,'world',`Ground ${x},${z} intercepted by ${point.hit}`);
 touch?await page.touchscreen.tap(point.x,point.y):await page.mouse.click(point.x,point.y);
 await expect.poll(async()=>(await snap(page)).buildings.length).toBe(before.buildings.length+1);
 const b=(await snap(page)).buildings.find(b=>b.x===x&&b.z===z);assert.equal(b.type,type);return b;
}
async function book(page,tab){await page.locator(`#town-tools [data-town-tab="${tab}"]`).click();await expect(page.locator('#town-book')).toBeVisible();}
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 await prepare(page);await start(page);
 let cottage,orchard;
 await check('Two actual placements reserve materials and enter one finite builder queue',async()=>{
  const before=await snap(page);
  cottage=await place(page,'cottage',-2,0);orchard=await place(page,'orchard',-3,-2);
  await page.locator('#cancel-building').click();
  const s=await snap(page);assert.ok(Math.abs(s.resources.wood-(before.resources.wood-28))<.000001);assert.ok(Math.abs(s.resources.stone-(before.resources.stone-11))<.000001);assert.equal(s.citizens.filter(c=>c.job==='builder').length,2);assert.equal(s.citizens.filter(c=>c.workplace===cottage.id).length,2);assert.equal(s.buildings.find(b=>b.id===orchard.id).progress,0);
  await book(page,'construction');await expect(page.locator('#town-book-content')).toContainText('2 builders on site');await expect(page.locator('#queue-summary')).toContainText('2 projects');
 });
 await check('Construction preview protects the neighboring front entrance',async()=>{
  await page.locator('#close-town-book').click();await page.locator('[data-build="cottage"]').click();
  const before=await snap(page),point=await page.evaluate(()=>__wildhaven.project(-2,1));await page.mouse.move(point.x,point.y);await page.mouse.click(point.x,point.y);
  await expect(page.locator('#toast')).toContainText('entrance');assert.equal((await snap(page)).buildings.length,before.buildings.length);assert.deepEqual((await snap(page)).resources,before.resources);
  await page.locator('#cancel-building').click();await book(page,'construction');
 });
 await check('Queue controls reorder and pause actual building work',async()=>{
  await page.locator(`[data-action-id="earlier-${orchard.id}"]`).click();await advance(page,4);
  let s=await snap(page);assert.ok(s.buildings.find(b=>b.id===orchard.id).progress>0);assert.equal(s.buildings.find(b=>b.id===cottage.id).progress,0);
  await page.locator(`[data-action-id="pause-${orchard.id}"]`).click();await advance(page,4);s=await snap(page);assert.ok(s.buildings.find(b=>b.id===cottage.id).progress>0);
  await shot(page,'town-03-construction-queue');
  await page.locator(`[data-action-id="pause-${cottage.id}"]`).click();let previous=s.buildings.find(b=>b.id===cottage.id).progress;await advance(page,8);s=await snap(page);assert.equal(s.buildings.find(b=>b.id===cottage.id).progress,previous);assert.equal(s.citizens.filter(c=>c.job==='builder').length,0);
  await page.locator(`[data-action-id="pause-${cottage.id}"]`).click();await page.locator(`[data-action-id="pause-${orchard.id}"]`).click();
 });
 await check('Mid-construction local save restores escrow, progress and named jobs',async()=>{
  const before=await snap(page),keys=await page.evaluate(()=>Object.keys(localStorage));assert.ok(keys.includes('wildhaven.v4'));assert.ok(!keys.includes('wildhaven.v1'));
  await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>window.__wildhaven);await page.locator('#continue').click();await expect(page.locator('#pause')).toHaveAttribute('aria-label','Resume');
  const after=await snap(page);assert.deepEqual(after.resources,before.resources);assert.deepEqual(after.citizens,before.citizens);assert.deepEqual(after.buildings,before.buildings);
  await advance(page,60);const ready=await snap(page);assert.equal(ready.buildings.find(b=>b.id===cottage.id).status,'ready');assert.equal(ready.buildings.find(b=>b.id===orchard.id).status,'ready');assert.equal(ready.citizens.filter(c=>c.job==='builder').length,0);
 });
 await check('Staffing and rest controls change production and release real people',async()=>{
  await book(page,'workforce');const before=await snap(page);assert.equal(before.citizens.filter(c=>c.workplace===orchard.id).length,2);
  await page.locator(`[data-action-id="staff-${orchard.id}-less"]`).click();let s=await snap(page);assert.equal(s.citizens.filter(c=>c.workplace===orchard.id).length,1);
  await page.locator(`[data-action-id="rest-${orchard.id}"]`).click();s=await snap(page);assert.equal(s.citizens.filter(c=>c.workplace===orchard.id).length,0);
  await page.locator(`[data-action-id="rest-${orchard.id}"]`).click();await page.locator(`[data-action-id="staff-${orchard.id}-more"]`).click();
  await page.locator(`[data-action-id="priority-${orchard.id}"]`).click();assert.equal((await snap(page)).buildings.find(b=>b.id===orchard.id).priority,0);
  await expect(page.locator(`[data-action-id="priority-${orchard.id}"]`)).toHaveText('Priority: high');
  await page.locator('#close-town-book').click();
 });
 await check('Partial cancellation returns unused escrow without duplicating materials',async()=>{
  const b=await place(page,'garden',2,0);await page.locator('#cancel-building').click();await advance(page,2);await book(page,'construction');
  const before=await snap(page),site=before.buildings.find(x=>x.id===b.id),wood=before.resources.wood;
  await page.locator(`[data-action-id="cancel-${b.id}"]`).click();const after=await snap(page);assert.ok(!after.buildings.some(x=>x.id===b.id));assert.equal(after.resources.wood,wood+Math.floor(site.escrow.wood*(1-site.progress/site.workRequired)+1e-7));
  await expect(page.locator('#queue-summary')).toHaveText('Tools at rest');await page.locator('#close-town-book').click();
 });
 await check('More workplaces compete for scarce staff; construction finishes before growth',async()=>{
  await place(page,'lumber',-4,0);await page.locator('#cancel-building').click();await advance(page,30);
  await place(page,'quarry',4,-2);await page.locator('#cancel-building').click();await advance(page,120);
  const s=await snap(page);assert.ok(s.population>6);assert.equal(new Set(s.citizens.map(c=>c.id)).size,s.population);assert.ok(s.citizens.filter(c=>c.job==='lumberjack').length>0);assert.ok(s.citizens.filter(c=>c.job==='quarryworker').length>0);assert.ok(s.resources.wood>0);
  await shot(page,'town-04-working-village');return{day:s.day,population:s.population,resources:s.resources};
 });
 await check('Person finder identifies a named citizen and their real workplace',async()=>{
  await book(page,'workforce');const c=(await snap(page)).citizens.find(c=>c.job==='lumberjack');await page.locator(`[data-action-id="person-${c.id}"]`).click();
  await expect(page.locator('#inspect-title')).toHaveText(c.name);await expect(page.locator('#inspect-kind')).toContainText('Woodcutter');await page.locator('#inspect-secondary').click();await expect(page.locator('#inspect-title')).toHaveText('Woodcutter');await page.locator('#close-inspector').click();
 });
 await check('Locked buildings explain their research path and open Council',async()=>{
  await page.locator('[data-category="harvest"]').click();await page.locator('[data-build="bakery"]').click();await expect(page.locator('#town-book-title')).toHaveText('A direction for the town');await expect(page.locator('#toast')).toContainText('Research Flour and fire first.');await page.locator('#close-town-book').click();
 });
 await check('All town panels render, scroll, and stay within the desktop viewport',async()=>{
  for(const tab of ['workforce','construction','stores','council','trade','watch']){await book(page,tab);const box=await page.locator('#town-book').boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=1440&&box.y+box.height<=1000);await page.locator('#town-book-content').evaluate(el=>el.scrollTop=el.scrollHeight);await page.locator('#close-town-book').click();}
 });
 report.desktop={snapshot:await snap(page),diagnostics:await page.evaluate(()=>Wildhaven.getDiagnostics())};await context.close();
 const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true}),mp=await mobile.newPage();await prepare(mp);await start(mp);
 await check('Touch placement and queue management work on a narrow phone',async()=>{
  // Center an accessible empty plot using the same camera controls exposed in game.
  await mp.evaluate(()=>{__wildhaven.world.focus({x:-2,z:0});});await mp.waitForTimeout(700);
  const b=await place(mp,'cottage',-2,0,true);await mp.locator('#cancel-building').tap();await mp.locator('#town-tools [data-town-tab="construction"]').tap();await expect(mp.locator(`[data-action-id="pause-${b.id}"]`)).toBeVisible();await mp.locator(`[data-action-id="pause-${b.id}"]`).tap();assert.ok((await snap(mp)).buildings.find(x=>x.id===b.id).paused);await shot(mp,'town-05-mobile-projects');
 });
 await check('Phone management tabs and scrolling have no page overflow',async()=>{
  for(const tab of ['workforce','stores','council','trade','watch']){await mp.locator(`#town-tabs [data-town-tab="${tab}"]`).tap();await mp.locator('#town-book-content').evaluate(el=>el.scrollTop=el.scrollHeight);const box=await mp.locator('#town-book').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390&&box.y+box.height<=844);}
  assert.equal(await mp.evaluate(()=>document.documentElement.scrollWidth),390);await shot(mp,'town-06-mobile-trade');
 });await mobile.close();
 const legacy={version:1,resources:{wood:60,stone:40,food:28},population:7,day:4,time:12.5,elapsed:282.5,won:false,buildings:[{id:'hearth',type:'hearth',x:0,z:2,rotation:0,builtDay:1},{id:'bell',type:'bell',x:0,z:-5,rotation:0,builtDay:1,restored:false},{id:'b1',type:'cottage',x:-2,z:2,rotation:2,builtDay:2}]};
 const migrated=await browser.newContext({viewport:{width:1280,height:900}}),lp=await migrated.newPage();await lp.addInitScript(raw=>localStorage.setItem('wildhaven.v1',raw),JSON.stringify(legacy));
 await check('Legacy browser save migrates to separate current key without rewriting original',async()=>{
  await prepare(lp);await lp.locator('#continue').click();await expect(lp.locator('#pause')).toHaveAttribute('aria-label','Resume');const s=await snap(lp);assert.equal(s.version,4);assert.equal(s.population,7);assert.equal(s.resources.wood,60);assert.equal(s.buildings[2].status,'ready');assert.equal(await lp.evaluate(()=>localStorage.getItem('wildhaven.v1')),JSON.stringify(legacy));assert.ok(await lp.evaluate(()=>localStorage.getItem('wildhaven.v4')));
 });await migrated.close();
 await check('No browser application errors in desktop, phone or migration sessions',async()=>assert.deepEqual(report.errors,[]));
}catch(error){report.failure=error.stack;process.exitCode=1;}finally{report.sourceHashesAtEnd=await hashes();report.finishedAt=new Date().toISOString();await writeFile(new URL(`${prefix}town-ui-report.json`,output),JSON.stringify(report,null,2));await browser.close();}
