import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, webkit, expect } = require('@playwright/test');
const root = resolve('docs/creature-field-notes');
const engine = process.env.HEARTWOOD_BROWSER === 'webkit' ? webkit : chromium;
const server = createServer(async (request,response) => {
  const path = new URL(request.url,'http://localhost').pathname;
  if (path === '/favicon.ico') { response.writeHead(204).end(); return; }
  if (!path.startsWith('/creature-field-notes/')) { response.writeHead(404).end(); return; }
  const file = path === '/creature-field-notes/' ? 'index.html' : path.replace(/^\/creature-field-notes\//,'');
  if (file.includes('..') || !/^[a-z0-9/._-]+$/i.test(file)) { response.writeHead(404).end(); return; }
  const filePath=resolve(root,file);
  if (!filePath.startsWith(root+sep)) { response.writeHead(404).end(); return; }
  try { const content=await readFile(filePath); const type=file.endsWith('.mjs')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':'text/html'; response.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'}).end(content); }
  catch { response.writeHead(404).end(); }
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
let browser;
const errors=[], external=[];
const evidence=process.env.HEARTWOOD_EVIDENCE;
try {
 browser=await engine.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1365,height:1000},reducedMotion:'reduce'});
 await context.route('**/*',route=> { if(route.request().url().startsWith(origin)||route.request().url().startsWith('blob:')||route.request().url().startsWith('data:')) return route.continue(); external.push(route.request().url()); return route.abort(); });
 const page=await context.newPage(); page.on('pageerror',e=>errors.push(e.message)); page.on('response',response=>{if(response.status()>=400) errors.push(`HTTP ${response.status()}: ${response.url()}`);}); page.on('requestfailed',request=>errors.push(`Request failed: ${request.url()}`)); page.setDefaultTimeout(6000);
 await page.goto(`${origin}/creature-field-notes/`);
 await expect(page.locator('#start')).toHaveText('Visit the alchemist');
 await expect(page.locator('.neighbor img')).toHaveCount(5);
 await expect.poll(()=>page.locator('.neighbor img').evaluateAll(images=>images.every(image=>image.complete&&image.naturalWidth>0))).toBe(true);
 await page.evaluate(()=>localStorage.setItem('unrelated-game-save','keep'));
 await page.locator('#start').click(); await expect(page.locator('#pond')).toBeVisible();
 await expect.poll(()=>page.locator('#frog-art').evaluate(image=>image.complete&&image.naturalWidth>0)).toBe(true);
 await page.locator('.skip-link').focus(); await page.keyboard.press('Enter'); await expect(page).toHaveURL(/#pond$/); await expect(page.locator('#main')).toBeFocused();
 const ingredient=id=>page.locator(`[data-ingredient="${id}"]`);
 for(const id of ['berry','acorn','dew']) { await ingredient(id).click(); await ingredient(id).click(); }
 await page.locator('#brew').click(); await expect(page.locator('#feedback')).toContainText('lovely soup'); await expect(page.locator('#reward')).toBeHidden();
 await page.locator('#clear').click(); await expect(page.locator('#brew')).toBeDisabled();
 for(const id of ['moss','moonflower']) { await ingredient(id).click(); await ingredient(id).click(); } await ingredient('dew').click();
 await page.locator('#brew').click(); await expect(page.locator('#feedback')).toContainText('different order');
 await page.locator('#clear').click();
 for(const id of ['moonflower','moss','dew']) await ingredient(id).click();
 await page.locator('#brew').click(); await page.locator('#brew').click(); await expect(page.locator('#journal-count')).toHaveText('1/1');
 await expect(page.locator('#reward')).toBeVisible();
 await page.locator('#reward a').click(); await expect(page.locator('#entry')).toBeVisible(); await expect(page.locator('#save-status')).toContainText('Saved');
 if(evidence) { await mkdir(evidence,{recursive:true}); await page.screenshot({path:resolve(evidence,'journal-desktop.png'),fullPage:true}); }
 await page.reload(); await expect(page.locator('#entry')).toBeVisible(); await expect(page.locator('#journal-count')).toHaveText('1/1');
 await page.locator('#reset').click(); await expect(page.locator('#confirm-dialog')).toBeVisible(); await page.keyboard.press('Escape'); await expect(page.locator('#entry')).toBeVisible();
 const download=page.waitForEvent('download'); await page.locator('#export').click(); const exported=await download; const path=await exported.path(); const saved=JSON.parse(await readFile(path,'utf8')); assert.equal(saved.completed,true);
 await page.locator('#reset').click(); await page.locator('#accept-confirm').click(); await expect(page.locator('#journal-count')).toHaveText('0/1'); await expect(page.locator('#entry')).toBeHidden();
 await page.locator('#import-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{')}); await expect(page.locator('#import-status')).toContainText('Could not import');
 await page.locator('#import-file').setInputFiles({name:'journal.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))}); await expect(page.locator('#confirm-dialog')).toBeVisible(); await page.locator('#cancel-confirm').click(); await expect(page.locator('#journal-count')).toHaveText('0/1');
 await page.locator('#import-file').setInputFiles({name:'journal.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))}); await page.locator('#accept-confirm').click(); await expect(page.locator('#journal-count')).toHaveText('1/1');
 await page.locator('[data-nav="pond"]').click(); await page.locator('#replay').click(); await expect(page.locator('#reward')).toBeHidden(); await expect(page.locator('#journal-count')).toHaveText('1/1');
 await page.locator('[data-nav="trail"]').click(); await page.goBack(); await expect(page.locator('#pond')).toBeVisible(); await page.goForward(); await expect(page.locator('#trail')).toBeVisible();
 await page.locator('[data-nav="pond"]').click(); await expect(page.locator('[data-nav="pond"]')).toHaveAttribute('aria-current','page'); await ingredient('moonflower').focus(); await page.keyboard.press('Enter'); await expect(page.locator('#mixture')).toContainText('Moonflower');
 assert.equal(await page.evaluate(()=>localStorage.getItem('unrelated-game-save')),'keep');
 if(evidence) await page.screenshot({path:resolve(evidence,'pond-desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844}); await expect(page.locator('#pond')).toBeVisible();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No mobile horizontal overflow');
 if(evidence) await page.screenshot({path:resolve(evidence,'pond-mobile.png'),fullPage:true});
 await page.locator('[data-nav="trail"]').click(); if(evidence) await page.screenshot({path:resolve(evidence,'trail-mobile.png'),fullPage:true});
 // Full-motion path: native transitions must start/stop the canvas on the current route.
 const animated=await browser.newContext({viewport:{width:1365,height:1000},reducedMotion:'no-preference'});
 await animated.addInitScript(()=>{ window.__arcs=0; const original=CanvasRenderingContext2D.prototype.arc; CanvasRenderingContext2D.prototype.arc=function(...args){window.__arcs++;return original.apply(this,args);}; });
 const moving=await animated.newPage(); moving.on('pageerror',e=>errors.push(e.message));
 await moving.goto(`${origin}/creature-field-notes/`); await expect(moving.locator('#motion')).toHaveText('Motion on');
 await moving.locator('#start').click(); await expect(moving.locator('#pond')).toBeVisible();
 await expect.poll(()=>moving.evaluate(()=>window.__arcs)).toBeGreaterThan(0);
 await moving.locator('[data-nav="trail"]').click(); await expect(moving.locator('#trail')).toBeVisible();
 const stopped=await moving.evaluate(()=>window.__arcs); await moving.waitForTimeout(160); assert.equal(await moving.evaluate(()=>window.__arcs),stopped,'Canvas stops away from pond');
 await moving.locator('[data-nav="pond"]').click(); await expect(moving.locator('#pond')).toBeVisible();
 await moving.locator('#motion').click(); await expect(moving.locator('#motion')).toHaveText('Motion off');
 const paused=await moving.evaluate(()=>window.__arcs); await moving.waitForTimeout(160); assert.equal(await moving.evaluate(()=>window.__arcs),paused,'Motion control stops canvas');
 await animated.close();
 // A new isolated browser profile with storage denied must remain playable.
 const fallback=await browser.newContext({viewport:{width:390,height:844}});
 await fallback.addInitScript(()=>Object.defineProperty(window,'indexedDB',{get(){throw Error('Storage disabled');}}));
 const other=await fallback.newPage(); await other.goto(`${origin}/creature-field-notes/#pond`); await expect(other.locator('[data-ingredient="moonflower"]')).toBeEnabled(); await expect(other.locator('#save-status')).toContainText('could not be loaded');
 assert.deepEqual(errors,[]); assert.deepEqual(external,[]);
 console.log('PASS browser: wrong ingredients/order, completion, repeat taps, replay, reload, Back/Forward, keyboard, export, malformed import, import/reset cancel+confirm, unrelated save, mobile layout, storage unavailable, no runtime errors/external requests');
 await fallback.close(); await context.close();
} finally { await browser?.close(); await new Promise(resolve=>server.close(resolve)); }
