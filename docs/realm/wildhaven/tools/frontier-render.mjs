/** Prepared frontier scene and real combat simulation; isolated browser storage, no user save changed. */
import {chromium} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const sources=['js/world.js','js/island.js','js/frontier.js','js/sim.js','js/main.js','assets/frontier-kit.glb','assets/frontier-kit.json','tools/frontier-render.mjs'];
const hashes=async()=>Object.fromEntries(await Promise.all(sources.map(async p=>[p,createHash('sha256').update(await readFile(new URL('../'+p,import.meta.url))).digest('hex')])));
const sourceHashesAtStart=await hashes(),raw=await readFile(new URL('../review/campaign-services-lanes-save.json',import.meta.url),'utf8');
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.stack));await page.addInitScript(raw=>localStorage.setItem('wildhaven.v2',raw),raw);
await page.goto('http://127.0.0.1:4751/wildhaven/?review',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__wildhaven);await page.locator('#continue').click();
const shot=async name=>page.screenshot({path:new URL('../review/'+name+'.png',import.meta.url).pathname});
await page.evaluate(()=>{const w=__wildhaven.world;document.body.classList.add('photo');w.focusIsland();w.updateCamera(2);});await page.waitForTimeout(500);await shot('frontier-01-island');
await page.evaluate(()=>{const w=__wildhaven.world;w.home();w.updateCamera(2);});await page.waitForTimeout(300);await shot('frontier-02-home-preserved');
for(const[id,x,z]of[['reedbank',18,-13],['stonehaven',-18,-14],['blackthorn',2,-28]]){await page.evaluate(({x,z})=>{const w=__wildhaven.world;w.focusWorld(x,z,10);w.updateCamera(2);},{x,z});await page.waitForTimeout(200);await shot('frontier-03-'+id);}
const setup=await page.evaluate(async()=>{
 const sim=await import('./js/sim.js'),api=await import('./js/frontier.js'),{isLand,hasNaturalObstacle}=await import('./js/island.js'),s=__wildhaven.state,w=__wildhaven.world;const ctx=()=>sim.frontierContext(s);
 // Explicit prepared battle fixture: supplies, discovery, and initial formations.
 // Recruitment, training, orders, damage, projectiles, wounds and retreat are real APIs.
 for(const r of['food','wood','stone','iron','tools','planks','gold'])s.resources[r]=Math.max(s.resources[r],300);
 const recruited=[];for(const kind of['spearman','spearman','archer']){const result=api.recruitTroop(s,kind,null,ctx());if(!result.ok)throw new Error(result.reason);recruited.push(result.unit.id);}
 for(let t=0;t<46;t+=.25)api.tickFrontier(s,.25,ctx());
 const n=s.frontier.neighbors.find(n=>n.id==='blackthorn');n.discovered=true;const war=api.declareWar(s,n.id,ctx());if(!war.ok)throw new Error(war.reason);
 const friendly=s.frontier.units.filter(u=>recruited.includes(u.id)),enemy=s.frontier.units.filter(u=>u.faction==='blackthorn');
 const positions=[[-2,-16.8],[-3,-17.0],[-2,-15.5],[-2,-18.0],[-3,-18.2],[-1,-19.2]];
 [...friendly,...enemy].forEach((u,i)=>{[u.x,u.z]=positions[i];u.path=[];u.order={type:i<3?'attack':'raid',x:-2,z:-17.5};u.yaw=i<3?Math.PI:0;if(!isLand(u.x,u.z)||hasNaturalObstacle(Math.round(u.x),Math.round(u.z)))throw new Error('Prepared formation intersects scenery '+u.id);});
 // A paid gate and wall strip on a clear meadow, instant completion is prepared art evidence only.
 s.frontier.claims=['home','highmeadow','reedmarch','pineward','crownhill'];
 const forts=[],fortAttempts=[];let strip=null;const types=['wall','wall','gate','wall','tower'];
 for(let z=-21;z<=-11&&!strip;z++)for(let x=-8;x<=8&&!strip;x++){if(Math.hypot(x+2-(-2),z-(-17.4))<5)continue;if(types.every((type,i)=>api.canPlaceFortification(s,type,x+i,z,0,ctx()).ok))strip={x,z};}
 if(!strip)throw new Error('No clear prepared wall strip');
 for(let i=0;i<types.length;i++){const result=api.placeFortification(s,types[i],strip.x+i,strip.z,0,ctx());fortAttempts.push({type:types[i],ok:result.ok,reason:result.reason});if(result.ok){const f=result.fortification;f.status='ready';f.progress=f.work;f.hp=f.maxHp;f.escrow={};f.completedAt=s.frontier.clock;forts.push(f.id);}}
 window.__frontierReviewStrip=strip;
 w.sync(s);w.focusWorld(-2,-17.4,7);w.targetAzimuth=-Math.PI/4;w.updateCamera(2);w.selectFrontier({unitIds:recruited});return{recruited,enemy:enemy.map(u=>u.id),forts,fortAttempts,strip,initialClock:s.frontier.clock};
});
await page.waitForTimeout(300);await shot('frontier-04-battle-start');
const frames=[];
for(let index=0;index<24;index++){
 const sample=await page.evaluate(async()=>{const api=await import('./js/frontier.js'),sim=await import('./js/sim.js'),s=__wildhaven.state,w=__wildhaven.world;api.tickFrontier(s,.1,sim.frontierContext(s));w.sync(s);w.updateFrontier(.1,false);w.renderer.render(w.scene,w.camera);return{clock:s.frontier.clock,subsecond:s.frontier.subsecond,projectiles:s.frontier.projectiles.length,units:s.frontier.units.filter(u=>['spearman','archer','raider'].includes(u.kind)).map(u=>({id:u.id,kind:u.kind,faction:u.faction,x:u.x,z:u.z,hp:u.hp,status:u.status,attackAt:u.attackAt,damageAt:u.damageAt})),poses:[...w.troops].map(([id,a])=>({id,motion:a.root.userData.motion,arm:a.limbs.right_arm.rotation.x,weapon:a.weapons?.right?.rotation.x}))};});
 frames.push(sample);if([1,4,7,10,13,17,22].includes(index))await shot('frontier-05-combat-'+index);
}
await page.evaluate(()=>{const w=__wildhaven.world;w.focusWorld(__frontierReviewStrip.x+2,__frontierReviewStrip.z,12);w.targetAzimuth=Math.PI/4;w.updateCamera(2);w.selectFrontier({});});await page.waitForTimeout(200);await shot('frontier-06-wall-open-gate');
await page.evaluate(()=>{const w=__wildhaven.world,g=__wildhaven.state.frontier.fortifications.find(f=>f.faction==='player'&&f.type==='gate');if(g)g.open=false;w.sync(__wildhaven.state);w.updateFrontier(1,false);});await shot('frontier-07-wall-closed-gate');
const sourceHashesAtEnd=await hashes(),sourcesStable=JSON.stringify(sourceHashesAtStart)===JSON.stringify(sourceHashesAtEnd);const report={scope:'Isolated prepared visual fixture based on an earned town; extra frontier supplies/discovery/claimed meadow/starting formations and immediate defense completion are prepared art evidence. Real public recruitment/training/war and actual simulation movement, projectiles, attack and damage then run. No user storage touched. Screens require separate visual inspection.',checkedAt:new Date().toISOString(),sourceHashesAtStart,sourceHashesAtEnd,sourcesStable,setup,frames,errors,diagnostics:await page.evaluate(()=>Wildhaven.getDiagnostics())};await writeFile(new URL('../review/frontier-render-report.json',import.meta.url),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({errors,sourcesStable,projectileFrames:frames.filter(f=>f.projectiles).length,setup}));if(errors.length)process.exitCode=1;
