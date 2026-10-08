import { chromium } from '/Users/coryloken/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import * as sim from '../../js/sim.js';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const url = process.env.WILDHAVEN_URL || 'http://127.0.0.1:14730/realm/wildhaven/';
const out = process.env.WILDHAVEN_EVIDENCE || new URL('./short-reading-local/', import.meta.url).pathname;
await fs.mkdir(out, { recursive: true });
const fixture = sim.createGame(); let site;
for (const tile of sim.listTiles()) if (sim.canBuild(fixture, 'cottage', tile.x, tile.z).ok) { site = sim.build(fixture, 'cottage', tile.x, tile.z).building; break; }
assert.ok(site);
const report = { url, method: 'Initial fixture uses normal build/cost APIs. Isolated browser storage; actual touch controls. No state mutation or injected time after loading.', cases: [], errors: [], failed: [] };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
let page;
const click = async selector => { const n = page.locator(selector); await n.scrollIntoViewIfNeeded(); await n.tap(); };
const snapshot = () => page.evaluate(() => Wildhaven.getSnapshot());
const geometry = () => page.evaluate(() => {
  const rect = n => { const r = n.getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:r.height, bottom:r.bottom, right:r.right }; };
  const notice = document.getElementById('reading-pause'), tabs = document.getElementById('town-tabs');
  return { parent:notice.parentElement.id, notice:rect(notice), tabs:rect(tabs), resume:rect(document.getElementById('keep-running')),
    overflow:document.documentElement.scrollWidth>innerWidth,
    tabsReachable:[...tabs.children].every(n => { const b=n.getBoundingClientRect(); return [[3,3],[b.width-3,3],[3,b.height-3],[b.width-3,b.height-3]].every(([x,y])=>n.contains(document.elementFromPoint(b.x+x,b.y+y))); }) };
});
try {
  for (const [width,height] of [[667,375],[568,320],[1024,600],[1024,768],[768,1024],[390,844]]) {
    const context = await browser.newContext({ viewport:{width,height}, hasTouch:true, isMobile:true });
    await context.addInitScript(raw => { if(!sessionStorage.seeded) { localStorage.setItem('wildhaven.v4',raw); sessionStorage.seeded='1'; } },sim.serialize(fixture));
    page = await context.newPage(); page.on('pageerror',e=>report.errors.push(e.message)); page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))report.failed.push({url:r.url(),status:r.status()});});
    await page.goto(url); await page.locator('#continue').waitFor({state:'visible'}); await click('#continue');
    await click('#stores-toggle'); await click('[data-action-id="resource-tools"]'); await page.waitForTimeout(150);
    const bounds = await geometry(), inline = height<=600&&width>=521;
    assert.equal(bounds.parent,inline?'town-book':''); assert.equal(bounds.overflow,false);
    assert.ok(bounds.resume.width>=44&&bounds.resume.height>=44); assert.ok(bounds.tabsReachable,'Every corner of each Town tab remains reachable');
    if(inline) assert.ok(bounds.notice.bottom<=bounds.tabs.y,'Pause strip has its own row above tabs');
    await page.screenshot({path:out+`/tools-${width}x${height}.png`});
    const before=(await snapshot()).buildings.find(b=>b.id===site.id).progress;
    await click('#keep-running'); await page.waitForTimeout(1300);
    assert.ok((await snapshot()).buildings.find(b=>b.id===site.id).progress>before);
    for (const tab of ['workforce','construction','stores','council','trade','watch']) await click(`#town-tabs [data-town-tab="${tab}"]`);
    await click('#close-town-book'); await click('#stores-toggle'); await page.waitForTimeout(150);
    assert.match(await page.locator('#keep-running').innerText(),/Run while open/);
    const held=(await snapshot()).buildings.find(b=>b.id===site.id).progress; await page.waitForTimeout(1100);
    assert.equal((await snapshot()).buildings.find(b=>b.id===site.id).progress,held);
    await page.locator('#keep-running').focus(); await page.setViewportSize({width:390,height:844}); await page.waitForTimeout(150);
    assert.equal(await page.locator('#keep-running').evaluate(n=>n===document.activeElement),true);
    assert.equal(await page.locator('#reading-pause').evaluate(n=>n.parentElement.classList.contains('hud-notifications')),true);
    await page.setViewportSize({width:667,height:375}); await page.waitForTimeout(150);
    assert.equal((await geometry()).parent,'town-book'); assert.ok((await geometry()).tabsReachable);
    assert.equal(await page.locator('#keep-running').evaluate(n=>n===document.activeElement),true);
    await click('#keep-running');
    await page.waitForFunction(({id,progress})=>Wildhaven.getSnapshot().buildings.find(b=>b.id===id).progress>progress,{id:site.id,progress:held},{timeout:3000});
    await click('#close-town-book'); await page.waitForTimeout(100);
    assert.equal(await page.locator('#reading-pause').evaluate(n=>n.parentElement.classList.contains('hud-notifications')),true);
    report.cases.push({width,height,bounds,allTabsTapped:true,resumeAdvancedConstruction:true,readingHoldAndRotationFocus:true});
    await context.close();
  }
  assert.deepEqual(report.errors,[]); assert.deepEqual(report.failed,[]); report.passed=true;
  console.log(JSON.stringify(report));
} catch(error) {report.failure=error.stack;await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});throw error;}
finally {await fs.writeFile(out+'/receipt.json',JSON.stringify(report,null,2));await browser.close();}
