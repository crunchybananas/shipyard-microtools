import {chromium} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {ensureServer} from './_serve.mjs';
const label=process.argv[2]||'landscape';
const out=new URL(`../tmp/graphics-world/${label}/`,import.meta.url);await mkdir(out,{recursive:true});
const server=await ensureServer(),browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1440,height:950},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(server.gameUrl);await page.waitForFunction(()=>typeof startNewGame==='function');
 await page.locator('#kingdom-name-input').fill('Worn roads');await page.locator('#title-screen .title-btn.primary').click();
 await page.evaluate(()=>setSpeed(0));await page.getByRole('button',{name:'Skip tutorial',exact:true}).click();
 await page.waitForFunction(()=>getComputedStyle(document.getElementById('title-screen')).display==='none');
 await page.waitForFunction(()=>__realm.landscape?.().state==='ready');
 // The 1.5-second opening camera move owns zoom until it has completed.
 await page.waitForFunction(()=>G.camera.zoom===1.3);
 await page.evaluate(()=>{G.camera.zoom=1.3;G.dayPhase=G.dayLength*.5;forceRender();});
 await page.screenshot({path:new URL('opening.png',out).pathname});
 const save=await readFile(new URL('../tmp/graphics-world/growth-205/final-save.json',import.meta.url),'utf8');
 await page.evaluate(async save=>{
  const state=await import('./js/save-state.js?realm=198'),ui=await import('./js/ui.js?realm=198');
  const prepared=state.prepareSave(save);if(!prepared.ok)throw new Error(JSON.stringify(prepared.error));
  const committed=state.commitGameLoad(prepared.value);if(!committed.ok)throw new Error(JSON.stringify(committed.error));
  setSpeed(0);G.camera.x=0;G.camera.y=1280;G.camera.zoom=1.65;
  ui.updateUI();ui.renderBuildBar();ui.renderMissions();
 },save);
 for(const [name,phase,zoom] of [['day',.5,1.65],['dusk',.76,1.65],['close',.5,2.8]]){
  await page.evaluate(async({phase,zoom})=>{G.dayPhase=G.dayLength*phase;G.camera.zoom=zoom;const ui=await import('./js/ui.js?realm=198');ui.updateUI();forceRender();},{phase,zoom});
  await page.evaluate(async()=>{for(let i=0;i<4;i++)await new Promise(requestAnimationFrame);});
  await page.screenshot({path:new URL(`${name}.png`,out).pathname});
 }
 const stats=await page.evaluate(async()=>{
  const render=await import('./js/render.js?realm=198');render.setRenderProfiling(true);
  for(let i=0;i<45;i++){G.gameTick++;render.render();await new Promise(requestAnimationFrame);}
  render.setRenderProfiling(false);
  return {landscape:__realm.landscape(),profile:render.getRenderProfile()};
 });
 await writeFile(new URL('render-report.json',out),JSON.stringify({errors,...stats},null,2)+'\n');
 console.log(JSON.stringify({errors,landscape:stats.landscape}));
 if(errors.length)throw new Error(errors.join('\n'));
}finally{await browser.close();await server.stop();}
