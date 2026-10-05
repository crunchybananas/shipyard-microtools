/** Real API UI review. Imports a separately earned town; this is not an earned frontier campaign. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium, expect } from '@playwright/test';
const root = new URL('../', import.meta.url), review = new URL('../review/', import.meta.url);
const url = process.env.WILDHAVEN_URL || 'http://127.0.0.1:4751/wildhaven/?review';
const mode = process.env.FRONTIER_UI_MODE || 'all';
const paths = ['js/frontier-ui.js','frontier.css','js/frontier.js','js/island.js','js/main.js','js/sim.js','js/world.js','js/catalog.js','index.html','style.css','assets/frontier-kit.glb','assets/town-kit.glb','assets/village-kit.glb'];
const hash = text => createHash('sha256').update(text).digest('hex');
const hashes = async () => Object.fromEntries(await Promise.all(paths.map(async path => [path, hash(await readFile(new URL(path, root)))])));
const checkpoint = await readFile(new URL('campaign-services-lanes-save.json', review), 'utf8');
const report = { startedAt: new Date().toISOString(), mode, scope: 'Actual UI actions against real frontier/simulation APIs. Isolated browser imports a previously earned village checkpoint; public workforce changes and clock skips prepare this review. No stock, population, diplomacy or unlock injection. This does not claim an earned frontier campaign or physical-device play.', checkpoint: mode === 'outpost' ? null : { file: 'campaign-services-lanes-save.json', sha256: hash(checkpoint) }, sourcesAtStart: await hashes(), checks: [], errors: [], screenshots: [], fixture: {} };
await mkdir(review, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, hasTouch: true });
let page = await context.newPage();
page.on('pageerror', error => report.errors.push(error.message));
page.on('console', entry => { if (entry.type() === 'error') report.errors.push(entry.text()); });
const selector = id => `[data-frontier-action="${id}"]`;
const click = id => page.locator(selector(id)).click();
const state = () => page.evaluate(() => window.__wildhaven.snapshot());
const advance = seconds => page.evaluate(seconds => { window.__wildhaven.advance(seconds); window.__wildhaven.sync(); }, seconds);
const open = async tab => { if (!(await page.locator('#frontier-panel').isVisible())) await click('toggle'); await click(`tab-${tab}`); };
const shot = async name => { await page.screenshot({ path: new URL(`${name}.png`, review).pathname }); report.screenshots.push(`${name}.png`); };
const exact = (before, after, cost, reward = {}) => { for (const key of new Set([...Object.keys(cost || {}), ...Object.keys(reward || {})])) assert.ok(Math.abs(after[key] - before[key] + (cost[key] || 0) - (reward[key] || 0)) < 1e-4, `${key}: expected ${before[key] - (cost[key] || 0) + (reward[key] || 0)}, got ${after[key]}`); };
async function check(name, task, critical = false) { try { const detail = await task(); report.checks.push({ name, passed: true, ...(detail ? { detail } : {}) }); console.log(`PASS ${name}`); } catch (error) { report.checks.push({ name, passed: false, error: error.message }); console.error(`FAIL ${name}: ${error.message}`); if (critical) throw error; } }
async function mapClick(point, { touch = false, neighborId = null } = {}) {
  await page.evaluate(p => window.__wildhaven.world.focusWorld(p.x,p.z,14), point);
  await page.waitForFunction(() => { const w=window.__wildhaven.world; return Math.abs(w.zoom-w.targetZoom)<.003 && Math.hypot(w.target.x-w.pan.x,w.target.z-w.pan.z)<.003 && Math.abs(w.azimuth-w.targetAzimuth)<.003; }, null, {timeout:30000});
  await page.evaluate(() => { if(window.__frontierClickAudit)return;window.__frontierClickAudit=[];document.getElementById('world').addEventListener('pointerup',event=>{const w=window.__wildhaven.world,pick=w.pick(event.clientX,event.clientY);window.__frontierClickAudit.push({pointer:event.pointerType,x:pick?.x,z:pick?.z,neighborId:pick?.neighbor?.id,fortificationId:pick?.fortification?.id,troopId:pick?.troop?.id,cameraGap:Math.hypot(w.target.x-w.pan.x,w.target.z-w.pan.z),zoomGap:Math.abs(w.zoom-w.targetZoom)});},true); });
  const screen = await page.evaluate(({point,neighborId}) => {
    const a=window.__wildhaven, p=a.project(point.x,point.z), offsets=[0,-6,6,-12,12,-20,20];
    for(const dy of offsets)for(const dx of offsets){const q={x:p.x+dx,y:p.y+dy},hit=a.world.pick(q.x,q.y);if(document.elementFromPoint(q.x,q.y)?.id==='world' && (neighborId ? hit?.neighbor?.id===neighborId : hit?.x===point.x&&hit?.z===point.z))return q;}
    return null;
  }, { point, neighborId });
  assert.ok(screen, `No unobstructed screen target for ${JSON.stringify(point)}`);
  if(touch)await page.touchscreen.tap(screen.x,screen.y);else await page.mouse.click(screen.x,screen.y);
  const actual=await page.evaluate(()=>window.__frontierClickAudit.at(-1));(report.worldClicks ||= []).push({requested:point,screen,actual});
  if(neighborId)assert.equal(actual.neighborId,neighborId,'Actual pointer-up must hit the requested settlement');else assert.ok(actual.x===point.x&&actual.z===point.z,`Actual pointer-up ${actual.x},${actual.z} must hit the sampled tile ${point.x},${point.z} after the camera settles`);
}
let unitId, citizenId;
try {
  if (mode !== 'outpost') {
  await page.addInitScript(raw => { if (!sessionStorage.getItem('frontier-ui-checkpoint')) { localStorage.setItem('wildhaven.v2', raw); localStorage.removeItem('wildhaven.v3'); sessionStorage.setItem('frontier-ui-checkpoint', 'loaded'); } }, checkpoint);
  await page.goto(url, { waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__wildhaven?.frontierUI, { timeout: 45000 });
  await page.locator('#continue').click();
  await check('V3 migration opens the earned town and preserves its V2 source save', async () => {
    const evidence = await page.evaluate(() => ({ old: localStorage.getItem('wildhaven.v2'), current: JSON.parse(localStorage.getItem('wildhaven.v3')), snapshot: window.__wildhaven.snapshot() }));
    assert.equal(evidence.old, checkpoint); assert.equal(evidence.current.version, 3); assert.equal(evidence.snapshot.population, 76);
    await expect(page.locator('#pause')).toHaveAttribute('aria-label', 'Resume');
    report.fixture.preparation = await page.evaluate(async () => {
      const sim = await import('./js/sim.js'), { getBuildingSpec } = await import('./js/catalog.js'), s = window.__wildhaven.state, assignments = [];
      for (const b of s.buildings.filter(b => ['orchard','farm','windmill','bakery','lumber','quarry','sawmill','smith','toolmaker'].includes(b.type) && b.status === 'ready')) {
        const count = ['sawmill','smith','toolmaker'].includes(b.type) ? 0 : getBuildingSpec(b.type,b.level).workers;
        const result = sim.setWorkers(s,b.id,count); if (!result.ok) throw new Error(result.reason); assignments.push({ id:b.id,type:b.type,count });
      }
      window.__wildhaven.sync(); return { method: 'Public setWorkers restores food/timber/stone production and rests plank-consuming craft workers before time skips.', assignments };
    });
  }, true);
  await check('Frontier exposes real quotes, region prerequisites and an interactive coastline', async () => {
    await open('neighbors'); await expect(page.locator('.frontier-chart')).toBeVisible();
    await expect(page.locator('#frontier-content')).toContainText('Pineward');
    await expect(page.locator(selector('claim-pineward'))).toBeDisabled();
    await expect(page.locator('#frontier-content')).toContainText('survey');
    await shot('frontier-ui-01-island-chart');
    await open('defenses'); await expect(page.locator('#frontier-content')).toContainText('7 stone');
    assert.equal(await page.locator('[data-frontier-action^="inspect-fort-settlement-"]').count(), 0);
  }, true);
  await check('Named recruitment spends the exact quote and reserves a real resident through training', async () => {
    await open('company');
    const before = await state(), option = await page.evaluate(async () => (await import('./js/frontier.js')).troopOptions(window.__wildhaven.state).find(o => o.id === 'spearman'));
    assert.equal(option.ok,true,option.reason); citizenId = option.availableCitizens.find(c => ['scholar','available'].includes(c.job))?.id || option.availableCitizens.at(-1).id;
    await page.locator(selector('resident-spearman')).selectOption(citizenId); await click('recruit-spearman');
    const after = await state(), unit = after.frontier.units.find(u => u.citizenId === citizenId); unitId = unit.id;
    exact(before.resources,after.resources,option.cost); assert.equal(unit.status,'training');
    assert.equal(after.citizens.find(c => c.id === citizenId).job,'spearman');
    await click(`unit-${unitId}`); await expect(page.locator(selector('move'))).toBeDisabled();
    await advance(12); assert.equal((await state()).frontier.units.find(u => u.id === unitId).trainingRemaining,24);
    await expect(page.locator('#frontier-content')).toContainText('24 seconds of training remain');
    await advance(25); await expect(page.locator(selector('move'))).toBeEnabled(); await shot('frontier-ui-02-trained-company');
    return { unitId, citizenId, name:unit.name, cost:option.cost };
  }, true);
  await check('Frontier units and named labor survive save/reload without altering the V2 save', async () => {
    const before = await state(); await page.reload({ waitUntil:'networkidle' }); await page.waitForFunction(() => window.__wildhaven?.frontierUI); await page.locator('#continue').click();
    const after = await state(); assert.deepEqual(after.frontier.units.find(u => u.id === unitId), before.frontier.units.find(u => u.id === unitId));
    assert.equal(await page.evaluate(() => localStorage.getItem('wildhaven.v2')),checkpoint);
    await open('company'); await click(`unit-${unitId}`); await click('hold'); assert.equal((await state()).frontier.units.find(u => u.id === unitId).order.type,'hold');
  }, true);
  await check('Accidental recruitment can cancel training at home, releasing labor without an equipment refund', async () => {
    await open('company'); const before=await state(); await click('recruit-spearman'); const recruited=await state();
    const extra=recruited.frontier.units.find(u=>u.kind==='spearman'&&!before.frontier.units.some(old=>old.id===u.id));assert.ok(extra);assert.equal(extra.status,'training');
    if(await page.locator(selector('clear-units')).count())await click('clear-units');await click(`unit-${extra.id}`);
    await expect(page.locator(selector(`dismiss-${extra.id}`))).toHaveText('Cancel training');await expect(page.locator('#frontier-content')).toContainText('not refunded');
    await click(`dismiss-${extra.id}`);const after=await state();assert.deepEqual(after.resources,recruited.resources);assert.ok(!after.frontier.units.some(u=>u.id===extra.id&&u.status!=='released'));assert.notEqual(after.citizens.find(c=>c.id===extra.citizenId).job,'spearman');
    return {citizenId:extra.citizenId,refund:{}};
  }, true);
  await check('An envoy spends real provisions, walks to first contact, and releases their town job on return', async () => {
    await open('neighbors'); await click('neighbor-reedbank');
    const before = await state(), offer = await page.evaluate(async () => (await import('./js/frontier.js')).neighborOptions(window.__wildhaven.state).find(n => n.id === 'reedbank').envoy);
    assert.equal(offer.ok,true,offer.reason); await click('envoy-reedbank'); const after = await state(); exact(before.resources,after.resources,offer.cost);
    const envoy = after.frontier.units.find(u => u.kind === 'envoy' && u.missionNeighborId === 'reedbank'); assert.ok(envoy?.citizenId);
    await advance(8); const traveling = (await state()).frontier.units.find(u => u.id === envoy.id); assert.ok(traveling && Math.hypot(traveling.x-envoy.x,traveling.z-envoy.z) > .5);
    let elapsed = 8; while (elapsed < 220 && (await state()).frontier.units.some(u => u.id === envoy.id)) { await advance(10); elapsed += 10; }
    const finished = await state(); assert.equal(finished.frontier.neighbors.find(n => n.id === 'reedbank').discovered,true); assert.ok(!finished.frontier.units.some(u => u.id === envoy.id));
    assert.notEqual(finished.citizens.find(c => c.id === envoy.citizenId).job,'envoy'); await shot('frontier-ui-03-first-contact');
    return { citizenId:envoy.citizenId, name:envoy.name, elapsed, cost:offer.cost };
  }, true);
  await check('Neighbor trade, deliberate war, and a priced truce use their actual action quotes', async () => {
    if(mode==='all') { if(await page.locator('#frontier-panel').isVisible())await click('close'); await mapClick({x:18,z:-13},{neighborId:'reedbank'});assert.equal(await page.evaluate(()=>window.__wildhaven.frontierUI.activeTab),'neighbors');await expect(page.locator(selector('war-reedbank'))).toBeVisible(); }
    else { await open('neighbors'); await click('neighbor-reedbank'); }
    const readNeighbor = () => page.evaluate(async () => (await import('./js/frontier.js')).neighborOptions(window.__wildhaven.state).find(n => n.id === 'reedbank'));
    const trade = (await readNeighbor()).trade, before = await state(); assert.equal(trade.ok,true,trade.reason); await click('trade-reedbank'); exact(before.resources,(await state()).resources,trade.cost,trade.reward);
    await click('war-reedbank'); assert.notEqual((await state()).frontier.neighbors.find(n => n.id === 'reedbank').status,'war');
    await expect(page.locator('[aria-label="Confirm consequences"]')).toBeInViewport(); await click('confirm-war-reedbank');
    const war = await state(); assert.equal(war.frontier.neighbors.find(n => n.id === 'reedbank').status,'war'); assert.ok(war.frontier.units.some(u => u.faction === 'reedbank')); await expect(page.locator(selector('trade-reedbank'))).toBeDisabled();
    if(mode==='all') {
      await open('company');
      if(await page.locator(selector('move')).count()===0)await click(`unit-${unitId}`);
      const destination=await page.evaluate(async id=>{const f=await import('./js/frontier.js'),a=window.__wildhaven,u=a.state.frontier.units.find(u=>u.id===id),c=a.frontierContext();for(let z=0;z<=7;z++)for(let x=-4;x<=4;x++){if(Math.hypot(x-u.x,z-u.z)>1.8&&c.isWalkable(x,z)&&f.frontierPath(a.state,u,{x,z},c).length)return{x,z};}},unitId);
      assert.ok(destination);await click('move');await expect(page.locator('#frontier-panel')).toBeHidden();await mapClick(destination);
      assert.equal((await state()).frontier.units.find(u=>u.id===unitId).order.type,'move');await expect(page.locator('#frontier-panel')).toBeVisible();
      await click('attack');await mapClick({x:18,z:-13},{neighborId:'reedbank'});assert.equal((await state()).frontier.units.find(u=>u.id===unitId).order.targetId,'settlement-reedbank');
      await click('retreat');assert.equal((await state()).frontier.units.find(u=>u.id===unitId).order.type,'retreat');
      await page.setViewportSize({width:390,height:844});await click('move');await mapClick(destination,{touch:true});assert.equal((await state()).frontier.units.find(u=>u.id===unitId).order.type,'move');
      await click('attack');await mapClick({x:18,z:-13},{touch:true,neighborId:'reedbank'});assert.equal((await state()).frontier.units.find(u=>u.id===unitId).order.targetId,'settlement-reedbank');
      await click('retreat');await shot('frontier-ui-touch-company');await page.setViewportSize({width:1440,height:1000});await open('neighbors');await click('neighbor-reedbank');
      report.checks.push({name:'Mouse and touch company Move/Attack target actual world picks; Retreat keeps an explicit order',passed:true,detail:{destination,attackTarget:'settlement-reedbank'}});
    }
    const truce = (await readNeighbor()).truce; assert.equal(truce.ok,true,truce.reason); await click('truce-reedbank');
    const peaceful = await state(); exact(war.resources,peaceful.resources,truce.cost); assert.equal(peaceful.frontier.neighbors.find(n => n.id === 'reedbank').status,'truce'); await shot('frontier-ui-04-truce');
    return { trade:{cost:trade.cost,reward:trade.reward}, truceCost:truce.cost, note:'Paused after declaration; verifies real war state/garrison and withdrawal, not a won battle.' };
  }, true);
  if (mode === 'all') {
    await check('World targeting queues a paid wall line, named engineering completes it, and a gate opens/closes', async () => {
      const plan = await page.evaluate(async () => { const f=await import('./js/frontier.js'), {state:s,frontierContext}=window.__wildhaven,c=frontierContext(); for(let z=-8;z<=7;z++)for(let x=-8;x<=7;x++){const from={x,z},to={x:x+1,z},p=f.planWallLine(s,'wall',from,to,c);if(p.ok)return{from,to,cost:p.cost};} }); assert.ok(plan,'No legal affordable two-wall site');
      await open('defenses'); await click('line-wall');
      await mapClick(plan.from); const before=await state(); await mapClick(plan.to); assert.deepEqual((await state()).resources,before.resources); await click('commit-wall-line'); const queued=await state(); exact(before.resources,queued.resources,plan.cost);
      const walls=queued.frontier.fortifications.filter(f=>f.faction==='player'&&f.type==='wall'&&!before.frontier.fortifications.some(old=>old.id===f.id)); assert.equal(walls.length,2); assert.ok(queued.frontier.units.some(u=>u.kind==='engineer'&&u.citizenId));
      for(let n=0;n<18&&(await state()).frontier.fortifications.some(f=>walls.some(w=>w.id===f.id)&&f.status!=='ready');n++)await advance(10);
      assert.ok((await state()).frontier.fortifications.filter(f=>walls.some(w=>w.id===f.id)).every(f=>f.status==='ready'));
      const gate=await page.evaluate(async()=>{const f=await import('./js/frontier.js'),a=window.__wildhaven;for(let z=-7;z<=7;z++)for(let x=-7;x<=7;x++){const p=f.canPlaceFortification(a.state,'gate',x,z,0,a.frontierContext());if(p.ok&&f.canPlaceFortification(a.state,'wall',x,z,0,a.frontierContext()).ok)return{x,z,cost:p.cost};}});assert.ok(gate,'No affordable gate site');
      await open('defenses');await click('place-gate');const beforeGate=await state();await mapClick(gate);const gateState=await state();exact(beforeGate.resources,gateState.resources,gate.cost);const placed=gateState.frontier.fortifications.find(f=>f.faction==='player'&&f.type==='gate'&&!beforeGate.frontier.fortifications.some(old=>old.id===f.id));assert.ok(placed);
      for(let n=0;n<12&&(await state()).frontier.fortifications.find(f=>f.id===placed.id).status!=='ready';n++)await advance(10);
      await open('defenses');await click(`inspect-fort-${placed.id}`);await click(`gate-${placed.id}`);assert.equal((await state()).frontier.fortifications.find(f=>f.id===placed.id).open,false);await click(`gate-${placed.id}`);assert.equal((await state()).frontier.fortifications.find(f=>f.id===placed.id).open,true);await shot('frontier-ui-05-real-gate');
      const salvage=await page.evaluate(async id=>(await import('./js/frontier.js')).salvageOffer(window.__wildhaven.state,id,window.__wildhaven.frontierContext()),walls[0].id);assert.equal(salvage.ok,true,salvage.reason);
      await click(`inspect-fort-${walls[0].id}`);const beforeSalvage=await state();await click(`salvage-${walls[0].id}`);const afterSalvage=await state();exact(beforeSalvage.resources,afterSalvage.resources,{},salvage.refund);assert.ok(!afterSalvage.frontier.fortifications.some(f=>f.id===walls[0].id));
      report.checks.push({name:'A completed wall can be salvaged through its inspector for the exact visible refund',passed:true,detail:{id:walls[0].id,refund:salvage.refund}});
      await page.setViewportSize({width:390,height:844});
      const touchPlan=await page.evaluate(async()=>{const f=await import('./js/frontier.js'),a=window.__wildhaven,c=a.frontierContext();for(let z=-7;z<=7;z++)for(let x=-7;x<=6;x++){const from={x,z},to={x:x+1,z},p=f.planWallLine(a.state,'wall',from,to,c);if(p.ok)return{from,to,cost:p.cost};}});assert.ok(touchPlan);
      await open('defenses');await click('line-wall');await mapClick(touchPlan.from,{touch:true});const touchBefore=await state();await mapClick(touchPlan.to,{touch:true});assert.deepEqual((await state()).resources,touchBefore.resources);await page.locator(selector('commit-wall-line')).tap();exact(touchBefore.resources,(await state()).resources,touchPlan.cost);await expect(page.locator('#frontier-panel')).toBeVisible();
      const touchGate=await page.evaluate(async()=>{const f=await import('./js/frontier.js'),a=window.__wildhaven;for(let z=-7;z<=7;z++)for(let x=-7;x<=7;x++){const p=f.canPlaceFortification(a.state,'gate',x,z,0,a.frontierContext());if(p.ok&&f.canPlaceFortification(a.state,'wall',x,z,0,a.frontierContext()).ok)return{x,z,cost:p.cost};}});assert.ok(touchGate);
      await click('place-gate');const touchGateBefore=await state();await mapClick(touchGate,{touch:true});exact(touchGateBefore.resources,(await state()).resources,touchGate.cost);await expect(page.locator('#frontier-panel')).toBeVisible();await shot('frontier-ui-07-touch-fortifications');
      return { walls:walls.map(f=>f.id),wallCost:plan.cost,gate:placed.id,gateCost:gate.cost,touchWallCost:touchPlan.cost,touchGateCost:touchGate.cost };
    });
  }
  await check('Island chart and management controls fit a 390px phone viewport without hiding action text', async () => {
    await page.setViewportSize({width:390,height:844});
    if (await page.locator('#frontier-panel').isVisible()) await click('close');
    await expect(page.locator('#frontier-toggle')).toBeVisible(); await click('toggle');
    await expect(page.locator('#frontier-panel')).toBeVisible();
    for(const tab of ['neighbors','company','defenses']) { await open(tab); const bad=await page.evaluate(()=>[...document.querySelectorAll('#frontier-panel,#frontier-toggle,.frontier-tabs button,.frontier-actions button,.frontier-chart,.frontier-choice select')].flatMap(n=>{const r=n.getBoundingClientRect();return r.left< -1||r.right>innerWidth+1?[n.textContent]:[];}));assert.deepEqual(bad,[]); }
    await open('neighbors');await shot('frontier-ui-06-mobile-chart');
  });
  }
  if(mode==='all'||mode==='outpost') await check('An earned outpost can be removed and rebuilt through the UI; claim loss blocks new buildings and preserves existing homes', async () => {
    const raw=await readFile(new URL('frontier-campaign-complete-save.json',review),'utf8');report.fixture.claimCheckpoint={file:'frontier-campaign-complete-save.json',sha256:hash(raw),label:'Separately earned completed frontier checkpoint with hostiles defeated, imported into an isolated browser context.'};
    await context.close();const claimsContext=await browser.newContext({viewport:{width:1440,height:1000},hasTouch:true});page=await claimsContext.newPage();page.on('pageerror',e=>report.errors.push(`claims: ${e.message}`));page.on('console',e=>{if(e.type()==='error')report.errors.push(`claims: ${e.text()}`);});
    await page.addInitScript(raw=>localStorage.setItem('wildhaven.v3',raw),raw);await page.goto(url,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__wildhaven?.frontierUI);await page.locator('#continue').click();
    const target=await page.evaluate(async()=>{const a=window.__wildhaven,f=await import('./js/frontier.js'),sim=await import('./js/sim.js'),island=await import('./js/island.js'),fort=a.state.frontier.fortifications.find(f=>f.regionId==='highmeadow');let site=null;for(let z=-26;z<=-10&&!site;z++)for(let x=-11;x<=7&&!site;x++)for(let rotation=0;rotation<4;rotation++){if(island.regionAt(x,z)?.id==='highmeadow'&&sim.canBuild(a.state,'cottage',x,z,rotation).ok){site={x,z,rotation};break;}}return{fort,offer:f.salvageOffer(a.state,fort.id,a.frontierContext()),site,homes:a.state.buildings.filter(b=>island.regionAt(b.x,b.z)?.id==='highmeadow').map(b=>b.id)};});
    assert.ok(target.site,'Need a legal empty Highmeadow cottage site before claim loss');assert.ok(target.homes.length,'Earned expansion should contain an existing building to preserve');assert.equal(target.offer.ok,true,target.offer.reason);
    await open('defenses');await click(`inspect-fort-${target.fort.id}`);const before=await state();await click(`salvage-${target.fort.id}`);await expect(page.locator('[aria-label="Confirm consequences"]')).toBeInViewport();await expect(page.locator('[aria-label="Confirm consequences"]')).toContainText('Existing homes and workshops stay');assert.ok((await state()).frontier.claims.includes('highmeadow'));await shot('frontier-ui-08-outpost-consequences');
    await click(`confirm-salvage-${target.fort.id}`);const removed=await state();exact(before.resources,removed.resources,{},target.offer.refund);assert.ok(!removed.frontier.claims.includes('highmeadow'));for(const id of target.homes)assert.ok(removed.buildings.some(b=>b.id===id));
    const blocked=await page.evaluate(async site=>(await import('./js/sim.js')).canBuild(window.__wildhaven.state,'cottage',site.x,site.z,site.rotation),target.site);assert.equal(blocked.ok,false);assert.match(blocked.reason,/claim|outpost/i);
    await open('neighbors');const offer=await page.evaluate(async()=>(await import('./js/frontier.js')).claimOptions(window.__wildhaven.state,window.__wildhaven.frontierContext()).find(r=>r.id==='highmeadow'));assert.equal(offer.ok,true,offer.reason);const beforeClaim=await state();await click('claim-highmeadow');const queued=await state();exact(beforeClaim.resources,queued.resources,offer.cost);assert.ok(!queued.frontier.claims.includes('highmeadow'));
    let seconds=0;while(seconds<180&&!(await state()).frontier.claims.includes('highmeadow')){await advance(10);seconds+=10;}assert.ok((await state()).frontier.claims.includes('highmeadow'),'The named engineer must complete the claiming outpost');
    const allowed=await page.evaluate(async site=>(await import('./js/sim.js')).canBuild(window.__wildhaven.state,'cottage',site.x,site.z,site.rotation),target.site);assert.equal(allowed.ok,true,allowed.reason);await shot('frontier-ui-09-claim-restored');
    return {region:'highmeadow',preservedBuildings:target.homes,refund:target.offer.refund,reclaimCost:offer.cost,constructionSecondsSkipped:seconds};
  });
  await check('No browser or application errors during actual frontier control checks',async()=>assert.deepEqual(report.errors,[]));
} catch (error) { report.fatal=error.message; await shot('frontier-ui-failure').catch(()=>{}); }
finally { await browser.close(); report.finishedAt=new Date().toISOString();report.sourcesAtEnd=await hashes();report.sourceChanges=paths.filter(path=>report.sourcesAtStart[path]!==report.sourcesAtEnd[path]);report.passed=!report.fatal&&report.checks.every(c=>c.passed)&&report.errors.length===0&&report.sourceChanges.length===0;await writeFile(new URL(`frontier-ui-${mode}-report.json`,review),JSON.stringify(report,null,2)+'\n'); }
if(!report.passed)process.exitCode=1;
