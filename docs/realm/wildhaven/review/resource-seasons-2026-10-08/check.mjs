import { chromium } from '/Users/coryloken/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='/tmp/wildhaven-season-review', base='http://127.0.0.1:14726/realm/wildhaven/?review';
const browser=await chromium.launch({channel:'chrome',headless:true});
const report={fixture:'Isolated new towns. Seasonal dates/stocks are explicitly staged for boundary and interaction checks, not claimed as earned play.',viewports:[],errors:[]};
try {
 for(const [name,width,height,touch] of [['ipad-landscape',1180,820,true],['ipad-portrait',820,1180,true],['phone',390,844,true],['desktop',1440,900,false]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:touch,deviceScaleFactor:1});const page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(`${name}: ${e.message}`));page.on('response',r=>{if(r.status()>=400)report.errors.push(`${name}: ${r.status()} ${r.url()}`);});
  const click=async selector=>{const node=page.locator(selector);await node.scrollIntoViewIfNeeded();await node[touch?'tap':'click']();};
  const action=async id=>click(`[data-action-id="${id}"]`);
  await page.goto(base);await page.locator('#start').waitFor({state:'visible',timeout:60000});await click('#start');await click('#pause');
  const result={name,width,height,resources:[]};report.viewports.push(result);
  const before=await page.evaluate(()=>JSON.stringify(__wildhaven.snapshot()));
  for(const key of ['wood','stone','food']){
   await click(`[data-hud-resource="${key}"]`);await page.locator(`[data-resource-detail="${key}"]`).waitFor();
   assert.equal(await page.locator(`[data-hud-resource="${key}"]`).getAttribute('aria-expanded'),'true');
   await action('all-resources');assert.equal(await page.locator('.resource-row').count(),14);
   await action(`resource-${key}`);assert.equal(await page.locator(`[data-resource-detail="${key}"]`).count(),1);result.resources.push(key);
  }
  assert.equal(await page.evaluate(()=>JSON.stringify(__wildhaven.snapshot())),before,'Pure resource navigation changes no save');
  assert.match(await page.locator('#town-book-content').innerText(),/Pantry alone covers/);
  await page.screenshot({path:`${out}/${name}-food.png`});
  assert.equal(await page.locator('#season').isVisible(),true);
  if(name==='ipad-landscape'){
   const quick=await page.locator('[data-action-id="resource-manage-food"]').boundingBox();const panel=await page.locator('#town-book').boundingBox();assert.ok(quick.y+quick.height<panel.y+panel.height,'Food action visible above fold');
   await action('resource-manage-food');assert.match(await page.locator('#town-book-title').innerText(),/People/);
   await click('[data-hud-resource="food"]');await action('resource-more-food');assert.equal(await page.locator('[data-disclosure="resource-food-plans"]').getAttribute('open'),'');
   assert.match(await page.locator('[data-disclosure="resource-food-plans"]').innerText(),/timber|wood/i);
  }
  await click('#people-details');assert.match(await page.locator('#town-book-title').innerText(),/People/);
  await click('#calendar-toggle');assert.equal(await page.locator('#season-calendar').getAttribute('open'),'');
  assert.match(await page.locator('#season-calendar').innerText(),/Spring 1/);assert.equal(await page.locator('[data-action-id="festival-preview"]').isDisabled(),true);
  await page.screenshot({path:`${out}/${name}-calendar.png`});
  result.layout=await page.evaluate(()=>{const ids=['calendar-toggle','stores-toggle','people-details','town-book'];return {overflow:document.documentElement.scrollWidth>innerWidth,boxes:Object.fromEntries(ids.map(id=>{const r=document.getElementById(id).getBoundingClientRect();return[id,{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}];})),headerBottom:document.querySelector('#hud header').getBoundingClientRect().bottom};});
  assert.equal(result.layout.overflow,false);for(const [id,r] of Object.entries(result.layout.boxes)){assert.ok(r.width>=44&&r.height>=44,`${name} ${id} target size`);assert.ok(r.x>=0&&r.right<=width+.5&&r.bottom<=height+.5,`${name} ${id} bounds ${JSON.stringify(r)}`);}
  if(name==='ipad-landscape'){
   // Exercise every stored resource through real controls in a paused, isolated town.
   await click('#stores-toggle');const keys=await page.locator('.resource-row').evaluateAll(nodes=>nodes.map(n=>n.dataset.resource));
   for(const key of keys){await action(`resource-${key}`);assert.equal(await page.locator(`[data-resource-detail="${key}"]`).count(),1);await action('all-resources');}
   result.allResources=keys;
   await click('[data-hud-resource="food"]');await action('resource-source-manage-hearth');assert.match(await page.locator('#town-book-title').innerText(),/People/);
   await click('[data-hud-resource="food"]');await action('resource-import-food');assert.match(await page.locator('#town-book-title').innerText(),/landing|Trade/i);assert.ok(await page.locator('.market-quote').count());
   await click('#calendar-toggle');
   await page.evaluate(()=>{const s=__wildhaven.state;s.day=25;s.time=0;s.subsecond=0;s.elapsed=2160;s.resources.food=100;s.morale=70;__wildhaven.sync();});
   assert.match(await page.locator('#day').innerText(),/Autumn 1/);assert.equal(await page.locator('[data-action-id="festival-preview"]').isDisabled(),false);
   const previewBefore=await page.evaluate(()=>JSON.stringify(__wildhaven.snapshot()));await action('festival-preview');assert.equal(await page.evaluate(()=>JSON.stringify(__wildhaven.snapshot())),previewBefore);
   await action('festival-cancel');assert.equal(await page.evaluate(()=>JSON.stringify(__wildhaven.snapshot())),previewBefore);
   await action('festival-preview');await action('festival-confirm');
   const festival=await page.evaluate(async()=>{const m=await import('./js/seasons.js?v=20261008-seasons-1');return {food:__wildhaven.state.resources.food,baseline:__wildhaven.state.morale,status:m.festivalStatus(__wildhaven.state),morale:m.effectiveMorale(__wildhaven.state),events:__wildhaven.state.events.filter(e=>e.type==='festival')};});
   assert.equal(festival.food,88);assert.equal(festival.baseline,70);assert.equal(festival.morale,78);assert.equal(festival.events.length,1);assert.equal(festival.status.active,true);assert.equal(await page.locator('[data-action-id="festival-preview"]').isDisabled(),true);result.festival=festival;
   await page.screenshot({path:`${out}/festival-confirmed.png`});await click('#close-town-book');await page.screenshot({path:`${out}/autumn-celebration.png`});
   await page.reload();await page.locator('#continue').waitFor({state:'visible',timeout:60000});await click('#continue');await click('#calendar-toggle');assert.match(await page.locator('#season-calendar').innerText(),/Celebrating/);assert.equal(await page.locator('[data-action-id="festival-preview"]').isDisabled(),true);result.reloadPreserved=true;
   await page.locator('#season-calendar summary').focus();await page.evaluate(()=>{__wildhaven.advance(.1);__wildhaven.sync();});await page.waitForTimeout(350);
   assert.equal(await page.locator('#season-calendar summary').evaluate(el=>el===document.activeElement),true);result.calendarFocus=true;
   const clock=await page.evaluate(()=>({day:__wildhaven.state.day,time:__wildhaven.state.time,subsecond:__wildhaven.state.subsecond}));await page.waitForTimeout(450);assert.deepEqual(await page.evaluate(()=>({day:__wildhaven.state.day,time:__wildhaven.state.time,subsecond:__wildhaven.state.subsecond})),clock);result.pausePreserved=true;
   await page.evaluate(()=>{__wildhaven.advance(359.9);__wildhaven.sync();});assert.doesNotMatch(await page.locator('#season-calendar').innerText(),/Celebrating ·/);const expired=await page.evaluate(async()=>{const m=await import('./js/seasons.js?v=20261008-seasons-1');return{status:m.festivalStatus(__wildhaven.state),baseline:__wildhaven.state.morale,morale:m.effectiveMorale(__wildhaven.state)};});assert.equal(expired.status.active,false);assert.equal(expired.morale,expired.baseline);result.expired=expired;
   await click('#close-town-book');
   for(const [season,day] of [['spring',1],['summer',13],['autumn',25],['winter',37]]){
    await page.evaluate(day=>{const s=__wildhaven.state;s.day=day;s.time=0;s.subsecond=0;s.seasons={lastFestivalYear:0,festival:null};__wildhaven.sync();},day);await page.waitForTimeout(60);await page.screenshot({path:`${out}/season-${season}.png`});
   }
   result.seasons=['spring','summer','autumn','winter'];
  }
  if(name==='desktop'){
   await click('#close-town-book');await page.locator('[data-hud-resource="food"]').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('[data-resource-detail="food"]').count(),1);await page.keyboard.press('Escape');assert.equal(await page.locator('[data-hud-resource="food"]').evaluate(el=>el===document.activeElement),true);result.keyboardReturn=true;
  }
  await context.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;console.log(JSON.stringify(report));
}catch(error){report.failure=error.stack;throw error;}finally{await fs.writeFile(`${out}/receipt.json`,JSON.stringify(report,null,2));await browser.close();}
