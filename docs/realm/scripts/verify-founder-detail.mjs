#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
import {ensureServer} from './_serve.mjs';
import {FOUNDER_ACTIONS as ACTIONS} from './founder-sprites/actions.js';
import {FOUNDER_DIRECTIONS as DIRS} from './founder-sprites/contract.js';

const output=new URL('../tmp/founder-sprites/',import.meta.url);await mkdir(output,{recursive:true});
const provenance=JSON.parse(await readFile(new URL('../assets/sprites/founder/materials/provenance.json',import.meta.url)));
const albedo=await readFile(new URL('../assets/sprites/founder/materials/limestone-albedo.png',import.meta.url));
assert.equal(createHash('sha256').update(albedo).digest('hex'),provenance.outputs[0].sha256);
const hardware=process.env.FOUNDER_BROWSER==='chrome'||process.argv.includes('--hardware');
const server=await ensureServer(),browser=await chromium.launch({headless:true,...(process.env.FOUNDER_BROWSER==='chrome'?{channel:'chrome'}:{}),args:hardware?[]:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const report={browser:browser.version(),backend:hardware?'default ANGLE':'SwiftShader functional check',errors:[],checks:[],source:provenance.jobId};
const check=name=>{report.checks.push(name);console.log(`[detail] ${name}`);};
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
try{
  const page=await browser.newPage({viewport:{width:1440,height:1080},deviceScaleFactor:2,reducedMotion:'reduce'});
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.goto(`${server.origin}/walk-studio.html`);await page.waitForFunction(()=>window.__walkStudio?.detailReady);
  assert.equal(await page.evaluate(()=>__walkStudio.state.playing),false);assert.equal(await page.evaluate(()=>__walkStudio.largeAtlasCount),0);
  assert.equal(await page.evaluate(()=>performance.getEntriesByType('resource').some(r=>/-192\.png/.test(r.name))),false);check('Live startup does not decode large sprite atlases; reduced motion pauses animation');
  const pixels=()=>page.evaluate(()=>{const c=document.querySelector('.detail-canvas'),copy=document.createElement('canvas');copy.width=240;copy.height=180;const ctx=copy.getContext('2d');ctx.drawImage(c,0,0,240,180);return Array.from(ctx.getImageData(0,0,240,180).data);});
  const difference=(a,b)=>a.reduce((sum,v,i)=>sum+Math.abs(v-b[i]),0)/a.length;
  await page.locator('#phase').fill('18');const day=await pixels();
  await page.locator('[data-light="dusk"]').click();const dusk=await pixels();assert.ok(difference(day,dusk)>6,'Relighting must visibly change rendered pixels');
  await page.screenshot({path:new URL('living-scene-dusk.png',output).pathname,fullPage:true});
  await page.locator('[data-light="day"]').click();await page.locator('#detail-zoom').fill('1.5');
  const detail=await pixels();await page.locator('#surface-detail').uncheck();const plain=await pixels();assert.ok(difference(detail,plain)>.08,'Normal/roughness toggle must visibly change surfaces');
  await page.locator('#surface-detail').check();await page.locator('#light-angle').fill('110');assert.ok(difference(detail,await pixels())>3,'Moving light must change shading');
  await page.locator('#light-angle').fill('-35');check('Lighting presets, moving key light, and surface maps change actual rendered pixels');
  await page.screenshot({path:new URL('living-scene-close.png',output).pathname,fullPage:true});
  await page.locator('#wireframe').check();
  const meshPixels=await pixels();let changedPixels=0;
  for(let i=0;i<detail.length;i+=4)if(Math.max(...[0,1,2].map(c=>Math.abs(detail[i+c]-meshPixels[i+c])))>12)changedPixels++;
  // Count visible changed pixels: a slimmer, denser mesh covers less of the
  // courtyard, so the full-scene mean unfairly depends on body proportions.
  assert.ok(changedPixels>250,`Wireframe does not expose visible geometry: ${changedPixels} pixels`);
  await page.locator('#wireframe').uncheck();
  const restoreError=difference(detail,await pixels());
  assert.ok(restoreError<.02,`Turning wireframe off does not restore the material render: ${restoreError}`);
  report.wireframe={changedPixels,restoreError};
  await page.locator('#detail-zoom').fill('1');
  const bounds=await page.locator('#stage').boundingBox();await page.mouse.move(bounds.x+bounds.width*.45,bounds.y+bounds.height*.5);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width*.65,bounds.y+bounds.height*.5);await page.mouse.up();assert.ok(Math.abs(await page.evaluate(()=>__walkStudio.sourceYaw)-Math.PI/4)>.5);check('Drag turns the actual model; wireframe exposes the geometry');
  // The new geometry/material route must retain every authored key pose.
  for(const [id,a] of Object.entries(ACTIONS)){
    const poses=JSON.parse(await readFile(new URL(`../assets/sprites/founder/${id==='walk'?'landmarks':id+'-landmarks'}.json`,import.meta.url)));
    await page.locator(`[data-action="${id}"]`).click();
    for(const dir of DIRS){await page.getByRole('button',{name:`Face ${{s:'south',se:'southeast',e:'east',ne:'northeast',n:'north',nw:'northwest',w:'west',sw:'southwest'}[dir]}`,exact:true}).click();
      for(const [frame] of a.beats){await page.locator('#phase').fill(String(frame));const live=await page.evaluate(()=>__walkStudio.detailLandmarks),expected=poses[DIRS.indexOf(dir)*a.frames+frame].landmarks;for(const [name,joint] of Object.entries(expected))assert.ok(distance(live[name].world,joint.world)<.00003,`${id}/${dir}/${frame}/${name} moved during material conversion`);}
    }
  }check('All named key poses in all four actions and eight directions retain Blender bone positions');
  await page.locator('.render-settings summary').click();
  for(const quality of ['low','high','auto']){await page.locator('#render-quality').selectOption(quality);const d=await page.evaluate(()=>__walkStudio.detailDiagnostics);assert.equal(d.quality,quality);assert.ok(d.pixelRatio<=(quality==='low'?1:quality==='high'?2:1.5));}
  await page.locator('[data-action="point"]').click();await page.getByRole('button',{name:'Face southeast',exact:true}).click();await page.locator('#phase').fill('18');
  report.scene=await page.evaluate(()=>__walkStudio.detailDiagnostics);assert.ok(report.scene.triangles<20000);assert.ok(report.scene.textures<40);check('Bounded render density and quality controls');
  await page.locator('#contacts').check();await page.screenshot({path:new URL('living-scene-contacts.png',output).pathname,fullPage:true});await page.locator('#contacts').uncheck();
  for(const mode of ['cycle','roam','compare','source']){
    await page.locator(`[data-mode="${mode}"]`).click();assert.equal(await page.locator('.detail-canvas').isVisible(),false);if(mode==='source')await page.waitForFunction(()=>__walkStudio.sourceReady);
  }
  await page.locator('[data-mode="cycle"]').click();
  for(const id of ['point','idle','beckon']){await page.locator(`[data-action="${id}"]`).click();await page.waitForFunction(id=>__walkStudio.loadedAsset.includes(`${id}-192.png`),id);assert.equal(await page.evaluate(()=>__walkStudio.largeAtlasCount),1);}
  check('Canvas switching hides the live scene; large atlases are loaded on demand and evicted');
  await page.locator('[data-mode="detail"]').click();assert.equal(await page.locator('.source-canvas').isVisible(),false);
  // Exercise a real WebGL context loss and restoration, including its PMREM.
  await page.evaluate(()=>__walkStudio.detailRenderer.forceContextLoss());await page.waitForFunction(()=>__walkStudio.state.mode==='cycle');
  await page.evaluate(()=>__walkStudio.detailRenderer.forceContextRestore());await page.waitForFunction(()=>!__walkStudio.detailDiagnostics.contextLost);
  await page.locator('[data-mode="detail"]').click();await page.waitForFunction(()=>__walkStudio.rendered.mode==='detail');assert.equal(await page.locator('.detail-canvas').isVisible(),true);assert.ok((await pixels()).some((v,i)=>i%4!==3&&v>150));check('Context loss falls back to sprites and the restored scene renders again');
  await page.locator('[data-action="point"]').click();await page.locator('#phase').fill('18');
  await page.screenshot({path:new URL('living-scene-desktop.png',output).pathname,fullPage:true});
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:new URL('living-scene-mobile.png',output).pathname,fullPage:true});check('390px layout has no horizontal overflow');
  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,reducedMotion:'reduce'});await mobile.goto(`${server.origin}/walk-studio.html`);await mobile.waitForFunction(()=>window.__walkStudio?.detailReady);await mobile.locator('[data-light="dusk"]').tap();assert.equal(await mobile.evaluate(()=>__walkStudio.detailDiagnostics.lighting),'dusk');await mobile.locator('[data-action="beckon"]').tap();assert.equal(await mobile.evaluate(()=>__walkStudio.state.playing),false);await mobile.close();check('Mobile touch lighting/action controls work and respect reduced motion');
  assert.deepEqual(report.errors,[]);await writeFile(new URL('detail-validation.json',output),JSON.stringify(report,null,2)+'\n');console.log(`[founder detail] PASS — ${report.checks.length} checks; ${report.scene.triangles} triangles; ${report.scene.drawCalls} draws; Chromium ${report.browser}`);
}finally{await browser.close();await server.stop();}
