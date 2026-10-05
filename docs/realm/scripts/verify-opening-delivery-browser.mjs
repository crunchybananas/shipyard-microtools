// Real player clicks create the production route; bounded core ticks advance
// waiting, without terrain, inventory, worker or save fixture injection.
import {chromium} from '@playwright/test';
import {ensureServer} from './_serve.mjs';
import {mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const server=await ensureServer();
const proof=fileURLToPath(new URL('../tmp/opening-delivery/',import.meta.url));
mkdirSync(proof,{recursive:true});
import assert from 'node:assert/strict';import {writeFileSync} from 'node:fs';
const browser=await chromium.launch({headless:process.env.HEADED!=='1'});const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
await page.goto(server.gameUrl);await page.waitForFunction(()=>window.G?.debug?.step);await page.locator('#kingdom-name-input').fill('Recovery Delivery');await page.locator('#title-screen .title-btn.primary').click();await page.locator('.tut-next').click();await page.waitForTimeout(650);await page.evaluate(()=>window.setSpeed(0));
const latencies=[];
for(const type of ['farm','granary']) {
 const t=Date.now();await page.locator(`[data-build-key="${type}"]`).click();await page.waitForFunction(k=>window.G.selectedBuild===k,type);latencies.push({type,selectionMs:Date.now()-t});
 const tile=await page.evaluate(()=>{const g=window.G,c=document.querySelector('#game'),r=c.getBoundingClientRect(),a=[];for(let y=0;y<g.map.length;y++)for(let x=0;x<g.map[y].length;x++){if(g.map[y][x]!==2||!g.fog[y][x]||g.buildingGrid[y][x])continue;const cx=((x-y)*32-g.camera.x)*g.camera.zoom+r.width/2,cy=((x+y)*16-g.camera.y)*g.camera.zoom+r.height/2;if(cx<270||cx>r.width-260||cy<220||cy>r.height-170||document.elementFromPoint(cx,cy)!==c)continue;const stock=g.buildings.find(b=>b.founderStockpile);a.push({x,y,cx,cy,d:Math.abs(x-stock.x)+Math.abs(y-stock.y)})}return a.sort((a,b)=>a.d-b.d)[0]});assert.ok(tile);await page.mouse.click(tile.cx,tile.cy);await page.waitForFunction(k=>window.G.buildings.some(b=>b.type===k),type);await page.keyboard.press('Escape');
}
let delivered=false,report;
for(let batch=0;batch<120;batch++) {
 report=await page.evaluate(async()=>{window.G.debug.step(60);const inv=await import('./js/building-inventory.js?realm=198');const g=window.G;return {tick:g.gameTick,food:g.buildings.filter(b=>b.type==='granary').reduce((s,b)=>s+inv.storedFood(b),0),buildings:g.buildings.map(b=>({type:b.type,construction:b.construction,workers:b.workers,inventory:b.inventory})),workers:g.citizens.map(c=>({id:c.id,state:c.state,activity:c.activity,cargo:c.cargo,assignment:c.assignment}))}});
 if(report.food>0){delivered=true;break}
 await page.waitForTimeout(16);
}
writeFileSync(proof+'report.json',JSON.stringify({delivered,latencies,report,errors},null,2));console.log(JSON.stringify({delivered,latencies,report,errors}));await page.screenshot({path:proof+'first-delivery.png'});assert.ok(delivered,'Farm produced no physical food delivery to the player-built granary');
await page.locator('#btn-save').click();const before=await page.evaluate(()=>({tick:window.G.gameTick,raw:localStorage.getItem('realm-engine-v2-save')}));assert.ok(before.raw);await page.reload();await page.locator('#title-load').click();await page.waitForFunction(t=>window.G.gameTick===t,before.tick);await page.evaluate(()=>window.setSpeed(0));await page.screenshot({path:proof+'continued-delivery.png'});assert.deepEqual(errors,[]);console.log('DELIVERY_AND_CONTINUE_PASS');
}finally{await browser.close();await server.stop()}
