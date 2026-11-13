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
const base=process.env.HEARTWOOD_URL || `${origin}/creature-field-notes/`;
const path=[35,28,21,14,7,0,1,2,1,0,7,14,15,16,23,24,25,26,19,12,5,12,19,26,33,40,47,46,45,44,43,42];
const errors=[];
try {
 browser=await engine.launch({headless:true});
 for(const mobile of [false,true]) {
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1365,height:1000},hasTouch:mobile,isMobile:mobile,reducedMotion:mobile?'reduce':'no-preference'});
  const page=await context.newPage();page.setDefaultTimeout(8000);
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.goto(base); await page.locator('#start').click();await expect(page.locator('.exp-board')).toBeVisible();
  await expect(page.locator('#brewing-stage')).toBeHidden();
  const tap=async locator=>mobile?locator.tap():locator.click();
  await tap(page.locator('[data-cell="0"]'));await expect(page.locator('#exp-feedback')).toContainText('neighboring');await expect(page.locator('#exp-steps')).toHaveText('0');
  await tap(page.locator('[data-step="up"]'));await expect(page.locator('#exp-basket')).toHaveText('1 / 3');
  await tap(page.locator('#exp-rescue'));await expect(page.locator('#exp-basket')).toHaveText('1 / 3');
  await tap(page.locator('#exp-restart'));await expect(page.locator('#exp-basket')).toHaveText('0 / 3');
  // Desktop keyboard stays local to the board and Tab can leave it.
  await page.locator('.exp-board').focus();await page.keyboard.press('ArrowUp');await expect(page.locator('#exp-steps')).toHaveText('1');await page.keyboard.press('Tab');assert.notEqual(await page.evaluate(()=>document.activeElement.className),'exp-board');
  await tap(page.locator('#exp-restart'));
  for(const cell of path)await tap(page.locator(`[data-cell="${cell}"]`));
  await expect(page.locator('#exp-lanterns')).toHaveText('3 / 3');await expect(page.locator('#brewing-stage')).toBeVisible();await expect(page.locator('#exp-feedback')).toContainText('32 steps');
  await tap(page.locator('#exp-finish'));
  const ingredient=id=>page.locator(`[data-ingredient="${id}"]`);
  await tap(ingredient('dew'));await expect(ingredient('dew')).toBeDisabled();
  // A repeated touch cannot silently remove a selected ingredient.
  const box=await ingredient('dew').boundingBox();if(mobile)await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);else await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
  await expect(page.locator('#mixture')).toContainText('Morning dew');
  await tap(ingredient('moss'));await tap(ingredient('moonflower'));await tap(page.locator('#brew'));await expect(page.locator('#feedback')).toContainText('different order');
  await tap(page.locator('#clear'));for(const id of ['moonflower','moss','dew'])await tap(ingredient(id));await tap(page.locator('#brew'));await expect(page.locator('#journal-count')).toHaveText('1/1');
  await tap(page.locator('#reward a'));await expect(page.locator('#save-status')).toContainText('Saved');await page.reload();await expect(page.locator('#entry')).toBeVisible();
  const download=page.waitForEvent('download');await page.locator('#export').click();const saved=JSON.parse(await readFile(await(await download).path(),'utf8'));assert.equal(saved.completed,true);
  await page.locator('#reset').click();await page.locator('#cancel-confirm').click();await expect(page.locator('#entry')).toBeVisible();
  await page.locator('#reset').click();await page.locator('#accept-confirm').click();await expect(page.locator('#entry')).toBeHidden();
  await page.locator('#import-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{')});await expect(page.locator('#import-status')).toContainText('Could not import');
  await page.locator('#import-file').setInputFiles({name:'save.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});await page.locator('#accept-confirm').click();await expect(page.locator('#entry')).toBeVisible();
  await page.locator('[data-nav="pond"]').click();await expect(page.locator('#brewing-stage')).toBeHidden();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
  await expect(page.locator('.exp-board')).toBeVisible();
  const sizes=await page.locator('.exp-tile').evaluateAll(elements=>elements.map(e=>{const b=e.getBoundingClientRect();return [b.width,b.height];}));assert.ok(sizes.every(([w,h])=>w>=43.9&&h>=43.9),'44px map targets '+JSON.stringify(sizes[0]));
  await page.locator('.skip-link').focus();await page.keyboard.press('Enter');await expect(page).toHaveURL(/#pond$/);
  if(process.env.HEARTWOOD_EVIDENCE){await mkdir(process.env.HEARTWOOD_EVIDENCE,{recursive:true});await page.screenshot({path:resolve(process.env.HEARTWOOD_EVIDENCE,`pond-${mobile?'mobile':'desktop'}-v2.png`),fullPage:true});}
  await context.close();console.log(`PASS ${mobile?'touch/mobile':'desktop'} exploration, invalid move, rescue, restart, keyboard escape, recipe, repeated tap, journal persistence/import/reset`);
 }
 assert.deepEqual(errors,[]);
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
