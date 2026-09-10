#!/usr/bin/env node
// Click actual raster destinations. Do not derive test clicks from the same
// world-to-pointer formula as the input code: that hid the Retina regression.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {ensureServer} from './_serve.mjs';
import {launchGraphicsBrowser,graphicsBrowserSuffix} from './_graphics-browser.mjs';
const server=await ensureServer(),browser=await launchGraphicsBrowser();
const out=new URL(`../tmp/graphics-world/retina-picking-212${graphicsBrowserSuffix}/`,import.meta.url);
await mkdir(out,{recursive:true});
const report={browser:browser.version(),cases:[],errors:[]};
try{
  for(const dpr of [1,2]){
    const page=await browser.newPage({viewport:{width:1277,height:900},deviceScaleFactor:dpr});
    page.on('pageerror',e=>report.errors.push(e.message));
    await page.goto(server.gameUrl);await page.waitForFunction(()=>typeof startNewGame==='function');
    await page.locator('#kingdom-name-input').fill('True screen positions');
    await page.evaluate(()=>{startNewGame();setSpeed(0);});
    await page.getByRole('button',{name:'Skip tutorial',exact:true}).click();
    await page.waitForFunction(()=>G.camera.zoom===1.3&&__realm.builderSprites().small.length===4&&__realm.builderSprites().small.every(a=>a.state==='ready'));
    for(const zoom of [1.3,2.5]){
      const targets=await page.evaluate(async zoom=>{
        const {render}=await import('./js/render.js?realm=198');
        const {inspectCitizenRenderCache}=await import('./js/citizen-render-cache.js?realm=198');
        G.camera.zoom=zoom;
        const canvas=document.getElementById('game'),rect=canvas.getBoundingClientRect();
        const ctx=canvas.getContext('2d'),original=ctx.drawImage,draws=[];
        ctx.drawImage=function(image,...args){
          const src=image.src||'';
          const kind=src.includes('/citizens/builder/')?'citizen':image.dataset?.realmBuildingComposite||src.includes('buildings-atlas-painted')||src.includes('support-atlas')?'building':null;
          if(kind){
            const dest=args.length===8?args.slice(4):args.slice(0);
            const [x,y,w,h]=dest,t=this.getTransform();
            const px=x+w/2,py=y+h*(kind==='citizen'?.55:.7);
            draws.push({kind,x:rect.left+(t.a*px+t.c*py+t.e)*rect.width/canvas.width,
              y:rect.top+(t.b*px+t.d*py+t.f)*rect.height/canvas.height,
              anchorX:x+w/2,anchorY:y+h*.86});
          }
          return original.call(this,image,...args);
        };
        try{render();}finally{ctx.drawImage=original;}
        const cache=inspectCitizenRenderCache();
        for(const draw of draws)if(draw.kind==='citizen'){
          draw.actorId=cache.find(record=>record.builder?.drawn&&Math.hypot(record.builder.drawn.x-draw.anchorX,record.builder.drawn.y-draw.anchorY)<1e-6)?.actorId;
          if(!draw.actorId)throw new Error('No identity for a rendered citizen');
        }
        return {draws,buildingId:G.buildings[0].id,buildingType:G.buildings[0].type};
      },zoom);
      const citizens=targets.draws.filter(draw=>draw.kind==='citizen');
      assert.equal(citizens.length,3,'Opening citizens did not render');
      for(const target of citizens){
        await page.mouse.click(target.x,target.y);
        const selected=await page.evaluate(()=>G.selectedCitizenId);
        assert.equal(selected,target.actorId,`DPR ${dpr}, zoom ${zoom}: visible citizen missed at ${target.x},${target.y}`);
        report.cases.push({dpr,zoom,kind:'citizen',actorId:selected,x:target.x,y:target.y});
      }
      const building=targets.draws.find(draw=>draw.kind==='building');
      assert.ok(building,'Opening building did not render');
      await page.mouse.click(building.x,building.y);
      const selected=await page.evaluate(()=>({type:G.selectedBuilding?.type,citizen:G.selectedCitizenId}));
      assert.equal(selected.type,targets.buildingType,`DPR ${dpr}, zoom ${zoom}: visible building missed`);
      assert.equal(selected.citizen,null);
      report.cases.push({dpr,zoom,kind:'building',type:selected.type,x:building.x,y:building.y});
    }
    await page.close();
  }
  assert.deepEqual(report.errors,[]);
  await writeFile(new URL('report.json',out),JSON.stringify(report,null,2)+'\n');
  console.log(`[world picking] PASS ${report.browser}: ${report.cases.length} actual citizen/building draw targets at DPR 1/2 and two zooms`);
}finally{await browser.close();await server.stop();}
