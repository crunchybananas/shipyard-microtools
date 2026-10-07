import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root=fileURLToPath(new URL('../../../', import.meta.url));
const label=process.argv[2]||'before',base=process.argv[3]||'http://127.0.0.1:14721/realm/wildhaven/';
const out=root+'review/clarity-companions/';mkdirSync(out,{recursive:true});
const sha=x=>createHash('sha256').update(x).digest('hex');
const report={label,base,at:new Date().toISOString(),scenes:[],errors:[],failed:[],fixture:'Existing independently earned campaign-services-lanes and campaign-pressure saves; paused presentation only, no generated resources or clock advances.'};
const browser=await chromium.launch({channel:'chrome',headless:true});
let context,page;
async function load(fixture,viewport={width:1440,height:960}){
 if(context)await context.close();context=await browser.newContext({viewport});page=await context.newPage();
 page.on('pageerror',e=>report.errors.push(e.message));page.on('requestfailed',r=>{report.failed.push({url:r.url(),error:r.failure()});console.error('requestfailed',r.url(),r.failure())});page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))report.failed.push({url:r.url(),status:r.status()})});
 if(fixture){const raw=readFileSync(root+'review/'+fixture,'utf8');await page.addInitScript(raw=>localStorage.setItem('wildhaven.v4',raw),raw);}
 await page.goto(base+'?review');await page.waitForFunction(()=>window.__wildhaven,undefined,{timeout:60000});await page.locator(fixture?'#continue':'#start').click();
 if(await page.locator('#pause').getAttribute('aria-label')==='Pause')await page.locator('#pause').click();
}
async function shot(id){await page.evaluate(()=>__wildhaven.world.updateCamera(3));await page.screenshot({path:out+label+'-'+id+'.png'});const state=await page.evaluate(()=>__wildhaven.snapshot());report.scenes.push({id,viewport:page.viewportSize(),worldHash:sha(JSON.stringify(state)),file:label+'-'+id+'.png',camera:await page.evaluate(()=>{const w=__wildhaven.world;return {position:w.camera.position.toArray(),quaternion:w.camera.quaternion.toArray(),zoom:w.zoom,targetZoom:w.targetZoom,pan:w.pan.toArray(),azimuth:w.azimuth,canvas:[w.canvas.width,w.canvas.height]}}),renderer:await page.evaluate(()=>({calls:__wildhaven.world.renderer?.info.render.calls,triangles:__wildhaven.world.renderer?.info.render.triangles,geometries:__wildhaven.world.renderer?.info.memory.geometries,textures:__wildhaven.world.renderer?.info.memory.textures}))});writeFileSync(out+label+'-'+id+'-state.json',JSON.stringify(state));}
async function focus(x,z,zoom=18){await page.evaluate(({x,z,zoom})=>{__wildhaven.world.focusWorld(x,z,zoom);__wildhaven.world.updateCamera(3)},{x,z,zoom});}
async function inspectType(type){const b=await page.evaluate(type=>__wildhaven.state.buildings.find(x=>x.type===type),type);if(!b)throw new Error('Missing '+type);await focus(b.x,b.z,18);const p=await page.evaluate(b=>{const w=__wildhaven.world,p=w.project(b.x,b.z);for(let dy=-45;dy<25;dy+=4)for(let dx=-35;dx<35;dx+=4){const x=p.x+dx,y=p.y+dy;if(document.elementFromPoint(x,y)?.id==='world'&&(()=>{const hit=w.pick(x,y);return hit&&!hit.citizen&&hit.x===b.x&&hit.z===b.z})())return{x,y};}return null},b);if(!p)throw new Error('No visible click point '+type);await page.mouse.click(p.x,p.y);await page.locator('#inspector').waitFor({state:'visible'});}
try{
 await load(null);await page.locator('[data-build="cottage"]').click();await focus(0,0,19);const p=await page.evaluate(()=>__wildhaven.world.project(-2,0));await page.mouse.move(p.x,p.y);await shot('placement');
 await load('campaign-services-lanes-save.json');await inspectType('well');await shot('well-selected');await page.keyboard.press('Escape');await page.locator('[data-build="well"]').click();const q=await page.evaluate(()=>{const w=__wildhaven.world;return w.project(0,1)});await page.mouse.move(q.x,q.y);await shot('well-placement');
 await page.keyboard.press('Escape');await inspectType('windmill');await shot('windmill');await page.keyboard.press('Escape');await page.locator('#town-tools [data-town-tab="council"]').click();await shot('council');
 await page.setViewportSize({width:390,height:667});await page.locator('#town-tabs [data-town-tab="trade"]').click();await shot('phone-trade');
 await load('campaign-pressure-save.json');await focus(0,0,30);await page.locator('#town-tools [data-town-tab="watch"]').click();await shot('watch');if(label.startsWith('after')){await load('campaign-services-lanes-save.json',{width:1200,height:630});await inspectType('well');await shot('social');}
}finally{writeFileSync(out+label+'-capture-report.json',JSON.stringify(report,null,2));await browser.close()}
console.log(JSON.stringify({scenes:report.scenes.length,errors:report.errors,failed:report.failed}));
