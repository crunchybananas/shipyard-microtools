const { chromium } = await import(process.env.WILDHAVEN_PLAYWRIGHT || 'playwright');
import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});const report={};
try{
 const context=await browser.newContext({viewport:{width:1180,height:820},hasTouch:true,deviceScaleFactor:1});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:14725/candidate/realm/wildhaven/?review');await page.locator('#start').waitFor({state:'visible',timeout:60000});await page.locator('#start').tap();
 await page.locator('#tablet-town-toggle').tap();await page.locator('#keep-running').tap();
 const builderBefore=await page.evaluate(()=>__wildhaven.state.builderTarget);const more=page.locator('[data-action-id="builders-more"]');await more.scrollIntoViewIfNeeded();const box=await more.boundingBox();
 await page.evaluate(()=>window.heldButton=document.querySelector('[data-action-id="builders-more"]'));await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.waitForTimeout(1200);const connected=await page.evaluate(()=>heldButton.isConnected);await page.mouse.up();
 report.heldPress={connected,before:builderBefore,after:await page.evaluate(()=>__wildhaven.state.builderTarget)};
 assert.equal(connected,true);assert.equal(report.heldPress.after,builderBefore+1);
 const cancelBox=await more.boundingBox();await page.mouse.move(cancelBox.x+cancelBox.width/2,cancelBox.y+cancelBox.height/2);await page.mouse.down();await page.waitForTimeout(650);await page.mouse.move(400,650);await page.mouse.up();assert.equal(await page.evaluate(()=>__wildhaven.state.builderTarget),builderBefore+1);report.cancelledPress=true;
 await page.locator('#fieldbook-toggle').tap();if(await page.locator('#keep-running').isVisible())await page.locator('#keep-running').tap();const place=page.locator('[data-field-action^="place-"]').nth(1);const placeId=await place.getAttribute('data-field-action');const placeBox=await place.boundingBox();await page.mouse.move(placeBox.x+placeBox.width/2,placeBox.y+placeBox.height/2);await page.mouse.down();await page.evaluate(()=>{__wildhaven.advance(25);__wildhaven.sync();});await page.waitForTimeout(650);await page.mouse.up();assert.equal(await page.locator(`[data-field-action="${placeId}"]`).getAttribute('aria-pressed'),'true');report.fieldbookPress=true;

 await page.keyboard.press('Escape');await page.locator('#pause').tap();await page.locator('#stores-toggle').tap();await page.locator('#town-tabs [data-town-tab="council"]').tap();await page.locator('[data-action-id="council-jump-map"]').tap();
 report.mapNodes=await page.locator('.research-node').count();assert.equal(report.mapNodes,15);
 await page.locator('.research-node').first().tap();assert.ok(await page.locator('.research-card').count());report.researchDetails=await page.locator('#town-book-title').innerText();
 await page.screenshot({path:'/tmp/wildhaven-ui-review/research-detail.png'});
 await page.keyboard.press('Escape');await page.locator('#island-safety-status').tap();assert.match(await page.locator('#town-book-title').innerText(),/watch/i);report.safetyLink=true;
 await page.locator('#companion-toggle').tap();await page.getByRole('button',{name:'Create the companion town',exact:true}).tap();await page.locator('[data-companion-action="visit-companion"]').tap();
 await page.locator('#companion-toggle').tap();const snapshot=await page.evaluate(()=>JSON.stringify(__wildhaven.snapshot()));const persisted=await page.evaluate(()=>localStorage.getItem('wildhaven.companions.v1'));
 const visitButtons=['tablet-town-toggle','landing-button','journal-button','frontier-toggle','fieldbook-toggle','stores-toggle'];
 for(const id of visitButtons){await page.locator('#'+id).tap();assert.equal(await page.evaluate(()=>JSON.stringify(__wildhaven.snapshot())),snapshot,`Visit ${id} mutated snapshot`);}
 assert.equal(await page.locator('#tablet-build-toggle').isDisabled(),true);await page.waitForTimeout(700);assert.equal(await page.evaluate(()=>localStorage.getItem('wildhaven.companions.v1')),persisted);report.visitNavigation=visitButtons.length;
 await page.screenshot({path:'/tmp/wildhaven-ui-review/visit-reading.png'});
 assert.deepEqual(errors,[]);report.errors=errors;console.log(JSON.stringify(report));
}catch(e){report.failure=e.stack;throw e;}finally{await fs.writeFile('/tmp/wildhaven-ui-review/focused.json',JSON.stringify(report,null,2));await browser.close();}
