#!/usr/bin/env node
// Verify rendered contact against source alpha, depth ordering, and warm-cache
// behavior. This exercises actual game draws at cached and direct zooms.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {ensureServer} from './_serve.mjs';
const output=new URL('../tmp/graphics-world/grounding-208-validation/',import.meta.url);
await mkdir(output,{recursive:true});
const server=await ensureServer(),browser=await chromium.launch({headless:true,channel:'chrome'});
try{
 const page=await browser.newPage({viewport:{width:1280,height:920},deviceScaleFactor:2});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(server.gameUrl);await page.waitForFunction(()=>typeof startNewGame==='function');
 await page.evaluate(()=>{startNewGame();setSpeed(0);});
 await page.getByRole('button',{name:'Skip tutorial',exact:true}).click();
 await page.waitForFunction(()=>G.camera.zoom===1.3);
 await page.waitForFunction(()=>__realm.rasterAtlas().state==='ready'&&__realm.supportAtlas().state==='ready'&&__realm.actorAtlas().tiers.some(t=>t.state==='ready'));
 const result=await page.evaluate(async()=>{
  const {render}=await import('./js/render.js?realm=198');
  const {TILE,BUILDINGS}=await import('./js/state.js?realm=198');
  G.debug.pauseRendering=true;G.speed=0;G.photoMode=true;
  G._followAvatar=false;G._renderAlpha=1;G.dayPhase=G.dayLength*.5;
  G.avatar=null;G.animals=[];G.enemies=[];G.walkers=[];G.soldiers=[];G.caravans=[];
  G.map=G.map.map(row=>row.map(()=>TILE.GRASS));G.fog=G.map.map(row=>row.map(()=>true));
  G.buildingGrid=G.map.map(row=>row.map(()=>null));G.buildings=[];
  G.selectedBuilding=null;G.selectedBuild=null;G.hoveredTile=null;
  const citizen=G.citizens[0];G.citizens=[citizen];
  Object.assign(citizen,{x:39.35,y:39.35,_px:39.35,_py:39.35,tx:39.35,ty:39.35,path:null,pathIdx:0,carrying:null,carryAmount:0});
  G.camera.x=0;G.camera.y=1280;G.camera.zoom=1.3;
  const ctx=document.getElementById('game').getContext('2d'),original=ctx.drawImage;
  const composites=new Map(),records=[];
  function inspect(type,level,zoom,phase=.5){
   const b={type,level,x:40,y:40,buildProgress:1,hp:100,maxHp:100,productionTimer:0,lastProduced:0};
   G.buildings=[b];G.buildingGrid[40][40]=b;G.camera.zoom=zoom;G.dayPhase=G.dayLength*phase;
   const events=[];
   ctx.drawImage=function(image,...args){
    const source=image.src||'';
    const kind=image.dataset?.realmGroundContact?'contact'
     :image.dataset?.realmBuildingComposite?'building-cache'
     :source.includes('buildings-atlas-painted')||source.includes('support-atlas')?'building-source'
     :source.includes('actors-atlas')||source.includes('/citizens/builder/')?'citizen':null;
    if(kind){
     const t=this.getTransform();
     const [sx,sy,sw,sh,dx,dy,dw,dh]=args.length===8?args:[0,0,image.width,image.height,...args];
     const event={kind,x:t.a*(dx+dw/2)+t.c*(dy+dh/2)+t.e,y:t.b*(dx+dw/2)+t.d*(dy+dh/2)+t.f,width:dw*t.a,height:dh*t.d};
     if(kind.startsWith('building')){
      const probe=document.createElement('canvas');probe.width=sw;probe.height=sh;
      const pctx=probe.getContext('2d',{willReadFrequently:true});pctx.drawImage(image,sx,sy,sw,sh,0,0,sw,sh);
      const pixels=pctx.getImageData(0,0,sw,sh).data;
      let bottom=0;
      for(let y=0;y<sh;y++)for(let x=0;x<sw;x++)if(pixels[(y*sw+x)*4+3]>16)bottom=y+1;
      event.front=t.b*dx+t.d*(dy+dh*bottom/sh)+t.f;
      if(kind==='building-cache'){
       const key=`${type}/${level}`;
       if(!composites.has(key))composites.set(key,new Set());composites.get(key).add(image);
      }
     }
     events.push(event);
    }
    return original.call(this,image,...args);
   };
   try{render();}finally{ctx.drawImage=original;}
   const contact=events.find(e=>e.kind==='contact'),body=events.find(e=>e.kind.startsWith('building'));
   if(!contact||!body)throw new Error(`Missing contact/body for ${type}: ${JSON.stringify(events)}`);
   records.push({type,level,zoom,phase,events,centerAhead:(contact.y-body.front)/zoom/2});
  }
  // Houses now use source-cast shadows; verify-house-game checks their own
  // layered draws. The painted-contact heuristic still owns the other types.
  const types=Object.keys(BUILDINGS).filter(type=>type!=='road'&&type!=='wall'&&type!=='house');
  for(const type of types)for(const zoom of [1.3,2.8])inspect(type,1,zoom);
  for(let phase=.02;phase<1;phase+=.06)inspect('granary',1,1.3,phase);
  inspect('granary',1,.8);inspect('granary',1,1.3);
  // All visible images and their ground edges are now warm. Draws must reuse
  // those measurements; reading back game pixels every frame would stall GPUs.
  let warmReadbacks=0;
  const proto=CanvasRenderingContext2D.prototype,read=proto.getImageData;
  proto.getImageData=function(...args){warmReadbacks++;return read.apply(this,args);};
  try{for(let i=0;i<30;i++)render();}finally{proto.getImageData=read;}
  G.buildings=[];G.buildingGrid[40][40]=null;G.citizens=[];
  const scenery=[];
  for(const tile of [TILE.FOREST,TILE.STONE,TILE.IRON,TILE.MOUNTAIN]){
   G.map[40][40]=tile;G.camera.zoom=2.8;
   let contact=null,front=null;const calls=[];
   ctx.drawImage=function(image,...args){
    const t=this.getTransform();
    if(image.dataset?.realmGroundContact){const [x,y,w,h]=args;contact={y:t.d*(y+h/2)+t.f,rx:w/2,ry:h/2};calls.push('contact');}
    // The same atlas also supplies flat meadow flowers in its bottom-right
    // cell. Inspect the one tall scenery object, not those ground details.
    if(image.src?.includes('nature-atlas')&&(args[0]<384||args[1]<128)){
     const [sx,sy,sw,sh,dx,dy,dw,dh]=args;
     const probe=document.createElement('canvas');probe.width=sw;probe.height=sh;
     const pctx=probe.getContext('2d');pctx.drawImage(image,sx,sy,sw,sh,0,0,sw,sh);
     const pixels=pctx.getImageData(0,0,sw,sh).data;let bottom=0;
     for(let y=0;y<sh;y++)for(let x=0;x<sw;x++)if(pixels[(y*sw+x)*4+3]>16)bottom=y+1;
     front=t.d*(dy+dh*bottom/sh)+t.f;calls.push('nature');
    }
    return original.call(this,image,...args);
   };
   try{render();}finally{ctx.drawImage=original;}
   scenery.push({tile,contact,front,calls});
  }
  return {records,scenery,warmReadbacks,compositeCopies:[...composites].map(([key,images])=>({key,copies:images.size}))};
 });
 assert.ok(result.records.length>=65);
 for(const record of result.records){
  assert.ok(record.centerAhead<.6,`Ground contact floats ahead of ${record.type}: ${record.centerAhead}px`);
  assert.equal(record.events.filter(e=>e.kind==='contact').length,1,`${record.type} duplicates contact in its body cache`);
  assert.ok(record.events.findIndex(e=>e.kind==='contact')<record.events.findIndex(e=>e.kind.startsWith('building')),'Contact is above the building body');
  const citizen=record.events.findIndex(e=>e.kind==='citizen');
  assert.ok(citizen>=0&&record.events.findIndex(e=>e.kind==='contact')<citizen,'Building contact paints over a citizen');
 }
 for(const record of result.scenery){
  assert.ok(record.contact&&Number.isFinite(record.front));
  assert.ok(record.contact.y<=record.front+.5,'Scenery shadow is detached from its painted base');
  assert.deepEqual(record.calls,['contact','nature']);
 }
 assert.equal(result.warmReadbacks,0,'Warm rendering reads back pixels for ground contact');
 assert.ok(result.compositeCopies.every(c=>c.copies===1),'Lighting or normal zoom duplicates a building body cache');
 assert.deepEqual(errors,[]);
 await page.screenshot({path:new URL('scenery.png',output).pathname});
 await writeFile(new URL('report.json',output),JSON.stringify({errors,...result},null,2)+'\n');
 console.log(`[ground contacts] PASS — ${result.records.length} rendered building cases, four scenery types, ground-before-actor order, stable body caches and zero warm readbacks`);
}finally{await browser.close();await server.stop();}
