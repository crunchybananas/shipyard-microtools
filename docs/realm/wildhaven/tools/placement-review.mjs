/** Offscreen placement review: isolated saves, real controls, no live browser access. */
import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
const root=new URL('../',import.meta.url).pathname;
const out=new URL('../review/placement-2026-10-14/',import.meta.url).pathname;
await fs.mkdir(out,{recursive:true});
const base=path.resolve(root,'..');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.webp':'image/webp','.png':'image/png'};
const server=http.createServer(async(req,res)=>{try{let file=path.resolve(base,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(base+'/'))throw Error('bad path');if((await fs.stat(file)).isDirectory())file+='/index.html';const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:"chrome",headless:true});
const report={scope:'Isolated local browser contexts. Prepared five-cottage village for visual layout; actual pointer/touch placement controls. No Safari profile or user save accessed.',checks:[],errors:[]};
const sim=await import(root+'js/sim.js');
const fixture=sim.createGame();fixture.resources.wood=300;fixture.resources.stone=200;fixture.resources.food=200;
for(const [x,z] of [[-3,2],[-3,0],[-1,0],[3,0],[-1,4]]) { const result=sim.build(fixture,'cottage',x,z,0); assert.ok(result.ok,JSON.stringify(result)); }
for(let i=0;i<300;i++)sim.tick(fixture,1);
const raw=sim.serialize(fixture);
const overlap=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
async function setup(viewport,touch){
 const context=await browser.newContext({viewport,hasTouch:touch,isMobile:touch});const page=await context.newPage();
 page.on('pageerror',e=>{report.errors.push(e.message);console.log('PAGE ERROR',e.message)});page.on('requestfailed',r=>console.log('REQUEST FAILED',r.url(),r.failure()));
 await page.addInitScript(raw=>localStorage.setItem('wildhaven.v4',raw),raw);
 await page.goto(`http://127.0.0.1:${server.address().port}/wildhaven/?review`);await page.waitForFunction(()=>window.__wildhaven,undefined,{timeout:45000}).catch(async e=>{await page.screenshot({path:out+'load-failure.png'});console.log(await page.locator('body').innerText());throw e});
 await page.locator('#continue').click();await page.locator('#toast').waitFor({state:'hidden'});
 await page.evaluate(()=>{__wildhaven.world.focusWorld(0,0,27);__wildhaven.world.updateCamera(3)});
 await page.locator('#tablet-build-toggle').click();await page.locator('[data-build="well"]').click();
 return {context,page};
}
async function site(page){return page.evaluate(()=>{
 const w=__wildhaven.world,options=[];
 for(let z=-4;z<=5;z++)for(let x=-5;x<=5;x++){
  if(!__wildhaven.canBuild('well',x,z).ok)continue;const p=w.project(x,z),h=w.pick(p.x,p.y);
  if(p.y<innerHeight*.3||p.y>innerHeight*.62||p.x<innerWidth*.2||p.x>innerWidth*.7)continue;
  if(document.elementFromPoint(p.x,p.y)?.id==='world'&&h?.x===x&&h?.z===z)options.push({...p,cell:{x,z},score:Math.hypot(p.x-innerWidth*.45,p.y-innerHeight*.45)});
 }
 return options.sort((a,b)=>a.score-b.score)[0];
});}
try{
 for(const [name,viewport,touch] of [['desktop',{width:1440,height:900},false],['tablet',{width:1024,height:768},true],['phone',{width:390,height:844},true],['landscape',{width:844,height:390},true],['small-landscape',{width:667,height:375},true]]){
  if(process.env.PLACEMENT_VIEW&&!process.env.PLACEMENT_VIEW.split(',').includes(name))continue;console.log('Checking',name);const {context,page}=await setup(viewport,touch);const before=await page.evaluate(()=>__wildhaven.snapshot());
  const point=await site(page);assert.ok(point,'Visible legal well site '+name);
  if(touch)await page.touchscreen.tap(point.x,point.y);else await page.mouse.move(point.x,point.y);
  await expect(page.locator('#placement-context')).toContainText('homes in reach');
  await page.waitForTimeout(150);
  const box=await page.locator('#placement').boundingBox(),info=await page.locator('#placement-info').boundingBox();
  if(viewport.height<600){const camera=await page.locator('.camera-tools').boundingBox();assert.equal(overlap(box,camera),false,'Placement tray clears camera controls');}
  const preview=await page.evaluate(()=>__wildhaven.world.previewScreenBounds());
  assert.ok(box.x>=0&&box.x+box.width<=viewport.width&&box.y>=0&&box.y+box.height<=viewport.height);
  assert.ok(info.x>=box.x&&info.y>=box.y&&info.x+info.width<=box.x+box.width+1&&info.y+info.height<=box.y+box.height+1);
  assert.equal(overlap(box,{x:preview.left,y:preview.top,width:preview.right-preview.left,height:preview.bottom-preview.top}),false,'Placement tray clears preview '+name);
  assert.equal(await page.evaluate(()=>__wildhaven.world.entranceLabel.visible||__wildhaven.world.serviceArea.userData.label.visible),false);
  assert.equal(await page.evaluate(()=>__wildhaven.world.entranceMark.visible&&__wildhaven.world.entranceLane.visible&&__wildhaven.world.serviceArea.visible),true);
  const position=await page.locator('#rotate-building').boundingBox();
  if(touch)await page.locator('#rotate-building').tap();else await page.locator('#rotate-building').click();await page.waitForTimeout(100);assert.deepEqual(await page.locator('#rotate-building').boundingBox(),position,'Rotation controls stay still');assert.equal(await page.evaluate(()=>__wildhaven.world.highlight.visible),true);
  if(name==='desktop')await page.screenshot({path:out+'desktop-rotated.png'});
  for(let turn=0;turn<3;turn++){if(touch)await page.locator('#rotate-building').tap();else await page.locator('#rotate-building').click();}
  await expect(page.locator('#placement')).not.toHaveClass(/invalid/);
  await page.screenshot({path:out+name+'.png'});
  report.checks.push({name,box,info,preview,instruction:await page.locator('#placement-detail').innerText(),coverage:await page.locator('#placement-context').innerText()});
  if(touch){assert.deepEqual((await page.evaluate(()=>__wildhaven.snapshot())).resources,before.resources);await expect(page.locator('#confirm-building')).toBeEnabled();await page.locator('#confirm-building').tap();await expect(page.locator('#confirm-building')).toBeDisabled();}
  else {await page.mouse.click(point.x,point.y);}
  assert.equal((await page.evaluate(()=>__wildhaven.snapshot())).buildings.length,before.buildings.length+1);
  const placed=await page.evaluate(()=>__wildhaven.snapshot());
  if(touch){await page.touchscreen.tap(point.x,point.y);await expect(page.locator('#confirm-building')).toBeDisabled();}else await page.mouse.click(point.x,point.y);
  await expect(page.locator('#placement')).toHaveClass(/invalid/);assert.deepEqual((await page.evaluate(()=>__wildhaven.snapshot())).resources,placed.resources);assert.equal((await page.evaluate(()=>__wildhaven.snapshot())).buildings.length,placed.buildings.length);
  await page.locator('#cancel-building').click();await expect(page.locator('#placement')).toBeHidden();
  assert.equal(await page.evaluate(()=>__wildhaven.world.entranceMark.visible||__wildhaven.world.serviceArea.visible),false);
  await context.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.error=e.stack;process.exitCode=1;}finally{await fs.writeFile(out+(process.env.PLACEMENT_VIEW?process.env.PLACEMENT_VIEW+'-report.json':'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));server.close();await browser.close();}
