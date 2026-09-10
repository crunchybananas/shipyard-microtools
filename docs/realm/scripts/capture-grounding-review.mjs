#!/usr/bin/env node
// The actual building renderer on a neutral field, plus a current saved town.
// No source pixels are retouched; these are browser screenshots of production.
import {chromium} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {ensureServer} from './_serve.mjs';
const label=process.argv[2]||'grounding-review';
const output=new URL(`../tmp/graphics-world/${label}/`,import.meta.url);
await mkdir(output,{recursive:true});
const server=await ensureServer(),browser=await chromium.launch({headless:true,channel:'chrome'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1080},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(server.gameUrl);await page.waitForFunction(()=>typeof startNewGame==='function');
 await page.evaluate(()=>{startNewGame();setSpeed(0);});
 await page.getByRole('button',{name:'Skip tutorial',exact:true}).click();
 await page.waitForFunction(()=>G.camera.zoom===1.3);
 await page.waitForFunction(()=>__realm.rasterAtlas().state==='ready'&&__realm.supportAtlas().state==='ready');
 await page.evaluate(async()=>{
  const {renderBuildingIsolated}=await import('./js/render.js?realm=198');
  G.debug.pauseRendering=true;
  const gallery=document.createElement('div');gallery.id='grounding-review';
  Object.assign(gallery.style,{position:'fixed',inset:'0',zIndex:'100000',background:'#20251f',display:'grid',gridTemplateColumns:'repeat(5,1fr)',gridTemplateRows:'repeat(3,1fr)',padding:'18px',gap:'12px',boxSizing:'border-box'});
  const types=['granary','house','tavern','castle','church','windmill','well','blacksmith','market','bakery','lumber','quarry','mine','fisherman','farm'];
  for(const type of types){
   const card=document.createElement('div');Object.assign(card.style,{background:'#505640',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'});
   const canvas=renderBuildingIsolated(type,{width:110,height:125,bgColor:'#505640',applyTint:false});
   Object.assign(canvas.style,{width:'220px',height:'250px',imageRendering:'auto'});
   const name=document.createElement('div');name.textContent=type;Object.assign(name.style,{font:'12px system-ui',color:'#e2dcc9',letterSpacing:'.1em'});
   card.append(canvas,name);gallery.append(card);
  }
  document.body.append(gallery);
 });
 await page.screenshot({path:new URL('buildings.png',output).pathname});
 await page.evaluate(()=>document.getElementById('grounding-review').remove());
 const save=await readFile(new URL('../tmp/graphics-world/growth-207/final-save.json',import.meta.url),'utf8');
 await page.evaluate(async save=>{
  const state=await import('./js/save-state.js?realm=198'),ui=await import('./js/ui.js?realm=198');
  const prepared=state.prepareSave(save);if(!prepared.ok)throw new Error(JSON.stringify(prepared.error));
  const loaded=state.commitGameLoad(prepared.value);if(!loaded.ok)throw new Error(JSON.stringify(loaded.error));
  setSpeed(0);G.dayPhase=G.dayLength*.5;G._followAvatar=false;
  G.camera.x=0;G.camera.y=1280;G.camera.zoom=2.7;
  ui.updateUI();ui.renderBuildBar();ui.renderMissions();forceRender();
 },save);
 await page.evaluate(async()=>{for(let i=0;i<5;i++)await new Promise(requestAnimationFrame);});
 await page.screenshot({path:new URL('town.png',output).pathname});
 await writeFile(new URL('report.json',output),JSON.stringify({errors},null,2)+'\n');
 if(errors.length)throw new Error(errors.join('\n'));
 console.log(`[grounding review] ${label}: fifteen building previews and grown town captured without page errors`);
}finally{await browser.close();await server.stop();}
