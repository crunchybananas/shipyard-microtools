const { chromium } = await import(process.env.WILDHAVEN_PLAYWRIGHT || 'playwright');
import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});const report={fixture:'Engineering UI fixtures based on the historical earned campaign-foundation save: tools/cloth removed and later milestones cleared to expose requirements; synthetic overlapping threat clocks.',errors:[]};
try{
 const raw=await fs.readFile('docs/realm/wildhaven/review/campaign-foundation-save.json','utf8');
 const context=await browser.newContext({viewport:{width:1180,height:820},hasTouch:true,deviceScaleFactor:1});await context.addInitScript(raw=>{const fixture=JSON.parse(raw);fixture.milestones=['chapter_0','chapter_1','chapter_2','chapter_3','chapter_4','chapter_5'];fixture.resources.tools=0;fixture.resources.cloth=0;localStorage.setItem('wildhaven.v4',JSON.stringify(fixture));},raw);const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('http://127.0.0.1:14725/candidate/realm/wildhaven/?review');await page.locator('#continue').waitFor({state:'visible',timeout:60000});await page.locator('#continue').tap();await page.locator('#collapse-objective').tap();
 report.objective=await page.locator('#ambition').innerText();assert.match(report.objective,/requirements complete/);assert.ok(await page.locator('#objective-checklist li').count()>1);await page.screenshot({path:'/tmp/wildhaven-ui-review/mature-checklist.png'});
 await page.locator('#stores-toggle').tap();const cloth=page.locator('#town-book-content [data-resource="cloth"]');
 // The game's resource jump uses resource-* IDs; inspect exact row text.
 report.cloth=await cloth.innerText();assert.match(report.cloth,/Flax field → Weaver → Cloth/);
 const target=page.locator('[data-action-id="cloth-weaver"]');await target.tap();report.clothAction={inspector:await page.locator('#inspector').isVisible(),research:await page.locator('#town-book-title').innerText()};assert.ok(report.clothAction.inspector||/Research/.test(report.clothAction.research));
 if(report.clothAction.inspector){
  await page.locator('[data-speed="1"]').tap();const worker=page.locator('#inspect-management [data-action-id$="-less"]').first();const actionId=await worker.getAttribute('data-action-id');const id=actionId.slice('inspect-staff-'.length,-'-less'.length);const before=await page.evaluate(id=>__wildhaven.state.buildings.find(b=>b.id===id).desiredWorkers,id);const box=await worker.boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.waitForTimeout(1200);await page.mouse.up();const after=await page.evaluate(id=>__wildhaven.state.buildings.find(b=>b.id===id).desiredWorkers,id);assert.equal(after,before-1);report.inspectorPress={before,after};await page.locator('#pause').tap();
 }

 await page.keyboard.press('Escape');
 report.threat=await page.evaluate(async()=>{const q=__wildhaven;const {dailyPressure}=await import('./js/pressure.js');q.state.won=true;q.state.population=Math.max(20,q.state.population);dailyPressure(q.state);q.state.day+=2;dailyPressure(q.state);q.state.frontier.warning={amount:3,attackAt:q.state.frontier.clock+60};q.sync();return document.getElementById('island-safety-status').textContent;});
 assert.match(report.threat,/Raid in 1m/);assert.match(report.threat,/Sails in/);await page.locator('#island-safety-status').tap();assert.equal(await page.locator('#frontier-panel').isVisible(),true);await page.keyboard.press('Escape');
 await page.evaluate(()=>{__wildhaven.state.frontier.raidActive=true;__wildhaven.sync();});assert.match(await page.locator('#island-safety-status').innerText(),/Raid underway/);await page.screenshot({path:'/tmp/wildhaven-ui-review/active-threat.png'});
 // Phone orientation/gesture check uses an isolated resized touch viewport.
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(120);await page.locator('#tablet-build-toggle').tap();await page.locator('[data-build="cottage"]').tap();
 const site=await page.evaluate(()=>{for(let z=-4;z<7;z++)for(let x=-6;x<7;x++)if(__wildhaven.canBuild('cottage',x,z).ok){const p=__wildhaven.project(x,z);if(p.x>75&&p.x<270&&p.y>300&&p.y<590)return p;}});
 if(site){await page.touchscreen.tap(site.x,site.y);await page.waitForTimeout(100);await page.screenshot({path:'/tmp/wildhaven-ui-review/phone-placement-final.png'});}
 assert.deepEqual(report.errors,[]);console.log(JSON.stringify(report));
}catch(e){report.failure=e.stack;throw e;}finally{await fs.writeFile('/tmp/wildhaven-ui-review/advanced.json',JSON.stringify(report,null,2));await browser.close();}
