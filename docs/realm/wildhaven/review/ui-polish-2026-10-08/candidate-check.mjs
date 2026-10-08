const { chromium } = await import(process.env.WILDHAVEN_PLAYWRIGHT || 'playwright');
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
const URL='http://127.0.0.1:14725/candidate/realm/wildhaven/?review';
const dock=['tablet-build-toggle','tablet-town-toggle','landing-button','journal-button','frontier-toggle','fieldbook-toggle','companion-toggle'];
const report={viewports:[],errors:[]};
try {
 for(const [name,width,height,touch] of [['ipad-landscape',1180,820,true],['ipad-portrait',820,1180,true],['phone',390,844,true],['desktop',1440,900,false]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:touch,deviceScaleFactor:1});const page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(`${name}: ${e.message}`));
  page.on('response',r=>{if(r.status()>=400)report.errors.push(`${name}: ${r.status()} ${r.url()}`);});
  const click=async id=>{const node=page.locator('#'+id);await node.scrollIntoViewIfNeeded();await node[touch?'tap':'click']();};
  const active=()=>page.evaluate(()=>{
   const ids=['town-book','journal','frontier-panel','fieldbook','companion-panel'];const visible=ids.filter(id=>!document.getElementById(id).hidden);
   if(document.body.classList.contains('tablet-build-open'))visible.push('build');
   return {visible,title:document.getElementById('town-book-title').textContent};
  });
  const assertOpen=async id=>{const a=await active();const expected={'tablet-build-toggle':'build','tablet-town-toggle':'town-book','landing-button':'town-book','journal-button':'journal','frontier-toggle':'frontier-panel','fieldbook-toggle':'fieldbook','companion-toggle':'companion-panel'}[id];assert.deepEqual(a.visible,[expected],`${name} ${id}: ${JSON.stringify(a)}`);if(id==='landing-button')assert.match(a.title,/Trade|Landing|Coast/i);};
  await page.goto(URL);await page.locator('#start').waitFor({state:'visible',timeout:60000});await click('start');await click('pause');
  const item={name,width,height,transitions:0,refreshClicks:0};
  await page.screenshot({path:`/tmp/wildhaven-ui-review/${name}-objectives.png`});
  if(name==='ipad-landscape'||name==='desktop'){
   for(const from of dock)for(const to of dock){
    await page.keyboard.press('Escape');await click(from);await assertOpen(from);await click(to);
    if(from===to)assert.deepEqual((await active()).visible,[],`${name} same-button ${to}`);else await assertOpen(to);
    item.transitions++;
   }
  } else {
   for(const from of dock){await page.keyboard.press('Escape');await click(from);await assertOpen(from);await click('journal-button');if(from!=='journal-button')await assertOpen('journal-button');item.transitions++;}
  }
  await page.keyboard.press('Escape');await click('stores-toggle');
  assert.equal((await active()).visible[0],'town-book');assert.match((await active()).title,/stores/i);
  assert.match(await page.locator('#town-book-content').innerText(),/Flax field → Weaver → Cloth/);
  await page.locator('#town-tabs [data-town-tab="council"]')[touch?'tap':'click']();
  assert.match(await page.locator('#town-book-title').innerText(),/Research/);
  await page.locator('[data-action-id="council-jump-map"]')[touch?'tap':'click']();const researchCount=await page.locator('.research-node').count();assert.equal(researchCount,15);item.researchNodes=researchCount;
  await page.screenshot({path:`/tmp/wildhaven-ui-review/${name}-research.png`});await page.locator('.research-node').first()[touch?'tap':'click']();assert.ok(await page.locator('.research-card').count());
  await page.keyboard.press('Escape');
  const before=await page.evaluate(()=>__wildhaven.world.targetZoom);await page.mouse.move(width*.6,height*.52);await page.mouse.wheel(0,-100);await page.waitForTimeout(350);
  item.zoom={before,...await page.evaluate(()=>({target:__wildhaven.world.targetZoom,actual:__wildhaven.world.zoom}))};
  await click('tablet-build-toggle');await page.locator('[data-build="cottage"]')[touch?'tap':'click']();
  const site=await page.evaluate(({width,height})=>{for(let z=-4;z<=6;z++)for(let x=-6;x<=6;x++){if(__wildhaven.canBuild('cottage',x,z).ok){const p=__wildhaven.project(x,z);if(p.x>width*.28&&p.x<width*.7&&p.y>height*.4&&p.y<height*.7)return{tile:{x,z},screen:p};}}},{width,height});assert.ok(site,'Buildable visible site');
  const stock=await page.evaluate(()=>JSON.stringify(__wildhaven.snapshot().resources));
  if(touch)await page.touchscreen.tap(site.screen.x,site.screen.y);else await page.mouse.move(site.screen.x,site.screen.y);
  await page.waitForTimeout(120);await page.keyboard.press('r');await page.waitForTimeout(120);
  item.placement=await page.evaluate(()=>{const c=document.getElementById('placement-info'),b=c.getBoundingClientRect(),r=__wildhaven.world.previewScreenBounds(),a=document.getElementById('placement').getBoundingClientRect();return{card:{left:b.left,right:b.right,top:b.top,bottom:b.bottom},roof:r,side:c.dataset.side,visible:getComputedStyle(c).visibility,rotation:__wildhaven.world.previewMesh?.rotation.y,keyboardHint:getComputedStyle(document.querySelector('#rotate-building kbd')).display,actions:{top:a.top,bottom:a.bottom},confirmVisible:!document.getElementById('confirm-building').hidden};});
  const {card:c,roof:r}=item.placement;assert.ok(r,'Preview visible');assert.equal(item.placement.visible,'visible');assert.ok(c.bottom<=r.top||c.top>=r.bottom||c.right<=r.left||c.left>=r.right,`${name}: preview covered`);assert.ok(c.left>=0&&c.right<=width&&c.top>=0&&c.bottom<=height);assert.equal(item.placement.keyboardHint,'inline-block');assert.ok(Math.abs(item.placement.rotation-Math.PI/2)<.001);if(touch)assert.equal(item.placement.confirmVisible,true);
  await page.screenshot({path:`/tmp/wildhaven-ui-review/${name}-placement.png`});await click('cancel-building');assert.equal(await page.evaluate(()=>JSON.stringify(__wildhaven.snapshot().resources)),stock,'Preview/cancel preserves resources');
  if(name==='ipad-landscape'){
   for(const id of [...dock,'stores-toggle']){
    await page.reload();await page.locator('#continue').waitFor({state:'visible',timeout:60000});await click('continue');
    await click(id);if(id==='stores-toggle')assert.match((await active()).title,/stores/i);else await assertOpen(id);item.refreshClicks++;
   }
   await page.keyboard.press('Escape');await page.locator('[data-speed="1"]').tap();await click('tablet-town-toggle');await page.waitForTimeout(180);
   assert.equal(await page.locator('#reading-pause').isVisible(),true);const paused=await page.evaluate(()=>(__wildhaven.state.elapsed + __wildhaven.state.subsecond));await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>(__wildhaven.state.elapsed + __wildhaven.state.subsecond)),paused);
   await click('journal-button');await page.waitForTimeout(180);assert.equal(await page.evaluate(()=>(__wildhaven.state.elapsed + __wildhaven.state.subsecond)),paused);await page.keyboard.press('Escape');await page.waitForTimeout(180);assert.ok((await page.evaluate(()=>(__wildhaven.state.elapsed + __wildhaven.state.subsecond)))>paused);await click('pause');item.readingPause=true;
  }
  report.viewports.push(item);console.log(JSON.stringify(item));await context.close();
 }
 assert.deepEqual(report.errors,[]);
} catch(e){report.failure=e.stack;throw e;}finally{await fs.writeFile('/tmp/wildhaven-ui-review/candidate.json',JSON.stringify(report,null,2));await browser.close();}
