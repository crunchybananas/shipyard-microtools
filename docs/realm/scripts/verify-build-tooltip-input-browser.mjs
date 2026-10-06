import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
import {ensureServer} from './_serve.mjs';
const server=await ensureServer();
const browser=await chromium.launch({headless:process.env.HEADED!=='1'});
const proof=fileURLToPath(new URL('../tmp/build-tooltip-input/',import.meta.url));await mkdir(proof,{recursive:true});
try {
 for (const touch of [false,true]) {
  const context=await browser.newContext({viewport:touch?{width:390,height:844}:{width:1440,height:900},hasTouch:touch,isMobile:touch});
  try {
   const page=await context.newPage();await page.goto(server.gameUrl);await page.waitForFunction(()=>window.startNewGame);await page.locator('#title-screen .title-btn.primary').click();await page.waitForTimeout(650);
   const house=page.locator('[data-build-key="house"]');
   if(touch) {
    await house.tap();
    assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('#tooltip')).display),'none','touch left a hover tooltip over the play area');
    await page.locator('[data-build-key="farm"]').tap();
    assert.equal(await page.evaluate(()=>window.G.selectedBuild),'farm');
    assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('#tooltip')).display),'none');
   } else {
    await house.hover();await page.waitForFunction(()=>document.querySelector('#tooltip').style.display==='block');
    assert.match(await page.locator('#tooltip').textContent(),/House/);
    await house.click();
    await page.mouse.move(700,450);assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('#tooltip')).display),'none','rebuilding a clicked hover card left its tooltip behind');
   }
   await page.screenshot({path:proof+(touch?'phone-touch.png':'desktop-hover-exit.png')});
  } finally {await context.close()}
 }
 console.log('[build-tooltip-input-browser] PASS — mouse hover retained; real touch selection leaves no sticky tooltip');
} finally {await browser.close();await server.stop()}
