#!/usr/bin/env node
import {chromium} from '@playwright/test';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {ensureServer} from './_serve.mjs';
const label=process.argv[2]||'roads-209-material';
const output=new URL(`../tmp/graphics-world/${label}/`,import.meta.url);await mkdir(output,{recursive:true});
const save=await readFile(new URL('../tmp/graphics-world/roads-209-before/save.json',import.meta.url),'utf8');
const server=await ensureServer(),browser=await chromium.launch({headless:true,channel:'chrome'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1050},deviceScaleFactor:2});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(server.gameUrl);await page.waitForFunction(()=>typeof startNewGame==='function');
 await page.evaluate(()=>{startNewGame();setSpeed(0);});
 await page.getByRole('button',{name:'Skip tutorial',exact:true}).click();
 await page.waitForFunction(()=>G.camera.zoom===1.3);
 await page.evaluate(async save=>{
  const boundary=await import('./js/save-state.js?realm=198'),ui=await import('./js/ui.js?realm=198');
  const prepared=boundary.prepareSave(save);if(!prepared.ok)throw new Error(JSON.stringify(prepared.error));
  const loaded=boundary.commitGameLoad(prepared.value);if(!loaded.ok)throw new Error(JSON.stringify(loaded.error));
  setSpeed(0);G._followAvatar=false;G._renderAlpha=1;G.dayPhase=G.dayLength*.5;
  G.camera.x=0;G.camera.y=1376;G.camera.zoom=2.1;G.season='spring';
  ui.updateUI();ui.renderBuildBar();ui.renderMissions();forceRender();
 },save);
 await page.evaluate(async()=>{for(let i=0;i<5;i++)await new Promise(requestAnimationFrame);});
 await page.screenshot({path:new URL('settlement.png',output).pathname});
 await page.evaluate(()=>{G.photoMode=true;document.body.classList.add('photo-mode');G.camera.zoom=3.3;forceRender();});
 for(const season of ['spring','autumn','winter']){
  await page.evaluate(season=>{G.season=season;forceRender();},season);
  await page.screenshot({path:new URL(`${season}.png`,output).pathname});
 }
 const diagnostics=await page.evaluate(()=>__realm.landscape());
 await writeFile(new URL('report.json',output),JSON.stringify({errors,diagnostics},null,2)+'\n');
 if(errors.length||diagnostics.state!=='ready')throw new Error(JSON.stringify({errors,diagnostics}));
 console.log(JSON.stringify({errors,diagnostics}));
}finally{await browser.close();await server.stop();}
