const { chromium } = await import(process.env.WILDHAVEN_PLAYWRIGHT || 'playwright');
import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const context=await browser.newContext({viewport:{width:1180,height:820},hasTouch:true,deviceScaleFactor:1});
 const page=await context.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:14725/baseline/realm/wildhaven/?review');
 await page.locator('#start').waitFor({state:'visible',timeout:60000}); await page.locator('#start').tap();
 await page.locator('#pause').tap();
 await page.locator('#tablet-town-toggle').tap(); await page.locator('#journal-button').tap();
 const journal=await page.evaluate(()=>({townHidden:document.querySelector('#town-book').hidden,journalHidden:document.querySelector('#journal').hidden,townZ:getComputedStyle(document.querySelector('#town-book')).zIndex,journalZ:getComputedStyle(document.querySelector('#journal')).zIndex}));
 await page.screenshot({path:'/tmp/wildhaven-ui-review/baseline-journal.png'});
 await page.locator('#close-town-book').tap(); await page.locator('#close-journal').tap();
 const zoomBefore=await page.evaluate(()=>__wildhaven.world.targetZoom); await page.mouse.move(600,430); await page.mouse.wheel(0,-100); await page.waitForTimeout(350); const zoomAfter=await page.evaluate(()=>({target:__wildhaven.world.targetZoom,actual:__wildhaven.world.zoom}));
 await page.locator('#tablet-build-toggle').tap(); await page.locator('.build-choice').first().tap();
 const site=await page.evaluate(()=>{for(let z=-4;z<=6;z++)for(let x=-5;x<=5;x++){if(__wildhaven.canBuild('cottage',x,z).ok){const p=__wildhaven.project(x,z);if(p.x>300&&p.x<850&&p.y>350&&p.y<650)return{x,z,...p};}}});
 if(site)await page.touchscreen.tap(site.x,site.y);
 const placement=await page.locator('#placement').boundingBox(); await page.screenshot({path:'/tmp/wildhaven-ui-review/baseline-placement.png'});
 const report={journal,zoomBefore,zoomAfter,site,placement,errors}; await fs.writeFile('/tmp/wildhaven-ui-review/baseline.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
} finally {await browser.close();}
