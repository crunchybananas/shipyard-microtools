import { chromium } from '/Users/coryloken/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='/tmp/wildhaven-defense-review', base='http://127.0.0.1:14727/realm/wildhaven/?review=1';
const seed=await fs.readFile(`${out}/authored-fixture.json`,'utf8');
const report={fixture:'Same authored interaction fixture as check.mjs; one additional staged hostile soldier for command/combat checks.',checks:[],errors:[]};
let browser,context,page;
const pass=name=>{report.checks.push(name);console.log(`PASS ${name}`);};
async function point(id){
 await page.evaluate(id=>{const u=__wildhaven.state.frontier.units.find(u=>u.id===id);__wildhaven.world.focusWorld(u.x,u.z,13);},id);await page.waitForTimeout(500);
 return page.evaluate(id=>{const w=__wildhaven.world,a=w.troops.get(id).root,canvas=document.getElementById('world');for(const h of [.25,.45,.65,.85]){const p=a.position.clone();p.y+=h;p.project(w.camera);const x=(p.x+1)*w.width/2,y=(1-p.y)*w.height/2;for(const dx of[0,-5,5])for(const dy of[0,-5,5,-10])if(document.elementFromPoint(x+dx,y+dy)===canvas&&w.pick(x+dx,y+dy)?.troop?.id===id)return{x:x+dx,y:y+dy};}return null;},id);
}
try{
 browser=await chromium.launch({channel:'chrome',headless:true});context=await browser.newContext({viewport:{width:1024,height:768},hasTouch:true,deviceScaleFactor:1});
 await context.addInitScript(seed=>localStorage.setItem('wildhaven.v4',seed),seed);page=await context.newPage();
 page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))report.errors.push(`${r.status()} ${r.url()}`);});
 const tap=async selector=>{const el=page.locator(selector);await el.scrollIntoViewIfNeeded();await el.tap();};const action=id=>tap(`[data-frontier-action="${id}"]`);
 await page.goto(base);await page.locator('#continue').waitFor({state:'visible',timeout:60000});await tap('#continue');await tap('#frontier-toggle');await action('tab-company');await action('select-ready');
 const button=page.locator('[data-frontier-action="save-squad"]');await button.scrollIntoViewIfNeeded();const b=await button.boundingBox();
 await button.evaluate(el=>window.__heldSquadButton=el);const cdp=await context.newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:b.x+b.width/2,y:b.y+b.height/2}]});
 await page.evaluate(()=>{__wildhaven.advance(.3);__wildhaven.frontierUI.update();});
 assert.equal(await button.evaluate(el=>el===window.__heldSquadButton),true);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await cdp.detach();await page.waitForTimeout(60);
 assert.equal(await page.evaluate(()=>__wildhaven.state.frontier.squads.length),0);await action('save-squad');assert.equal(await page.evaluate(()=>__wildhaven.state.frontier.squads.length),1);
 pass('Held native touch survives a live update; canceled touch saves nothing; next tap saves exactly one squad');
 await page.locator('.company-art').scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('.company-art')?.naturalWidth>0);
 const art=await page.locator('.company-art').evaluate(el=>({source:el.getAttribute('src'),alt:el.alt,loading:el.loading,height:el.getBoundingClientRect().height,naturalWidth:el.naturalWidth}));
 assert.equal(art.alt,'');assert.equal(art.loading,'lazy');assert.equal(art.naturalWidth,2172);assert.ok(art.height<=80);report.art=art;
 await page.screenshot({path:`${out}/ipad-company-art.png`});pass('Reusable ImageGen illustration loads and stays within80px at tablet size');
 const enemyId=await page.evaluate(async()=>{
  const s=__wildhaven.state,f=s.frontier,ctx=__wildhaven.frontierContext();let p;
  for(let z=-2;z<=8&&!p;z++)for(let x=-5;x<=5&&!p;x++)if(Math.hypot(x,z-3)>=3&&Math.hypot(x,z-3)<=5&&ctx.isWalkable(x,z)&&!f.units.some(u=>Math.hypot(u.x-x,u.z-z)<1))p={x,z};
  if(!p)throw Error('No legal authored enemy site');const u={...structuredClone(f.units[0]),...p,id:`unit-${f.nextId++}`,citizenId:null,name:'Review raider',kind:'raider',faction:'raiders',hp:46,maxHp:46,status:'active',trainingRemaining:0,trainingSeconds:0,recoveryRemaining:0,order:{type:'raid'},path:[],routeAt:-10,routeGoal:null,cooldown:0,attackAt:null,damageAt:null,deathAt:null,targetId:null};
  f.units.push(u);f.raidActive=true;f.raidOutcome={spawned:1,killed:0,escaped:0,cargoLost:0,uncertain:false,completed:false};const sim=await import('./js/sim.js');if(!sim.restore(sim.serialize(s)))throw Error('Invalid authored enemy fixture');__wildhaven.sync();return u.id;
 });
 await action('select-ready');const relations=await page.evaluate(()=>__wildhaven.state.frontier.neighbors.map(n=>[n.id,n.status]));await action('attack');const p=await point(enemyId);assert.ok(p);await page.touchscreen.tap(p.x,p.y);
 assert.equal(await page.locator('#frontier-command').isHidden(),true);assert.ok((await page.evaluate(()=>__wildhaven.state.frontier.units.filter(u=>u.faction==='player'&&u.citizenId).map(u=>u.order))).every(o=>o.type==='attack'&&o.targetId===enemyId));assert.deepEqual(await page.evaluate(()=>__wildhaven.state.frontier.neighbors.map(n=>[n.id,n.status])),relations);
 pass('Actual hostile raycast accepts explicit Attack without changing diplomatic relations');
 await action('defend');await action('close');await page.evaluate(()=>__wildhaven.world.focusWorld(0,3,22));await page.waitForTimeout(400);await page.screenshot({path:`${out}/defended-home-area.png`});
 const combat=await page.evaluate(async enemyId=>{const before=__wildhaven.state.frontier.units.map(u=>({id:u.id,hp:u.hp,x:u.x,z:u.z}));for(let i=0;i<160;i++)__wildhaven.advance(.25);__wildhaven.sync();const sim=await import('./js/sim.js'),s=__wildhaven.state;return{before,enemy:s.frontier.units.find(u=>u.id===enemyId),company:s.frontier.units.filter(u=>u.faction==='player'&&u.citizenId).map(u=>({id:u.id,hp:u.hp,status:u.status,x:u.x,z:u.z,order:u.order})),outcome:s.frontier.raidOutcome,valid:!!sim.restore(sim.serialize(s))};},enemyId);
 report.combat=combat;assert.equal(combat.outcome.killed,1);if(combat.enemy){assert.ok(combat.enemy.hp<46);assert.equal(combat.enemy.status,'dead');}assert.ok(combat.company.every(u=>u.status==='active'&&u.order.type==='defend'));assert.equal(combat.valid,true);assert.ok(combat.company.every(u=>Math.hypot(u.x-u.order.x,u.z-u.order.z)<.15));report.combat=combat;
 pass('Company intercepts a real simulated hostile, survives, returns to rally positions and restores from save');
 await page.screenshot({path:`${out}/defense-after-combat.png`});
 // A fully requested but unfilled watch must route to actual People & jobs.
 await page.evaluate(()=>{const s=__wildhaven.state,b=s.buildings.find(b=>b.type==='barracks');for(const c of s.citizens)if(c.workplace===b.id){c.workplace=null;c.job='idle';}b.workerIds=[];b.desiredWorkers=3;b.production={...b.production,efficiency:0,blockedReason:''};s.pressure.active=null;});
 await tap('#people-details');await tap('#town-tabs [data-town-tab="watch"]');await tap('[data-disclosure="watch-preparation"] summary');
 assert.equal(await page.locator('[data-action-id="watch-plan-supplied-guards"]').innerText(),'Manage people & jobs');await tap('[data-action-id="watch-plan-supplied-guards"]');assert.match(await page.locator('#town-book-title').innerText(),/People/);
 pass('Unfilled coastal watch action opens canonical People & jobs instead of an invalid tab');
 await page.setViewportSize({width:667,height:375});await page.reload();await page.locator('#continue').waitFor({state:'visible',timeout:60000});
 for(const id of ['start','continue']){const r=await page.locator(`#${id}`).boundingBox();assert.ok(r.y>=0&&r.y+r.height<=375&&r.height>=44);}
 await page.screenshot({path:`${out}/short-landscape-entry-fixed.png`});await tap('#continue');await tap('#frontier-toggle');await action('tab-company');
 const reading=await page.locator('#frontier-content').boundingBox();assert.ok(reading.height>=120);report.shortReadingHeight=reading.height;await page.screenshot({path:`${out}/short-landscape-top.png`});
 pass('Short landscape Start/Continue both reachable; Company has at least120px reading space');
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=error.stack;if(page)await page.screenshot({path:`${out}/edge-failure.png`}).catch(()=>{});throw error;}
finally{await fs.writeFile(`${out}/edge-receipt.json`,JSON.stringify(report,null,2));await context?.close();await browser?.close();}
