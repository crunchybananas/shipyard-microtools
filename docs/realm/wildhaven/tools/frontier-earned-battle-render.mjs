/** Final earned battle capture from a content-addressed, immutable checkpoint copy. */
import {chromium} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const hash=buffer=>createHash('sha256').update(buffer).digest('hex');
const file=p=>new URL('../'+p,import.meta.url);
const sources=['js/world.js','js/island.js','js/frontier.js','js/sim.js','js/main.js','assets/frontier-kit.glb','assets/frontier-kit.json','tools/frontier-earned-battle-render.mjs'];
const hashes=async()=>Object.fromEntries(await Promise.all(sources.map(async p=>[p,hash(await readFile(file(p)))])));
const original='review/frontier-campaign-battle-start-save.json',raw=await readFile(file(original),'utf8'),checkpointHash=hash(raw);
const snapshot=`review/frontier-render-input-battle-${checkpointHash.slice(0,12)}.json`;
try{await writeFile(file(snapshot),raw,{flag:'wx'});}catch(error){if(error.code!=='EEXIST'||hash(await readFile(file(snapshot)))!==checkpointHash)throw error;}
if(process.env.FRONTIER_PREPARE_ONLY==='1'){console.log(JSON.stringify({original,snapshot,sha256:checkpointHash}));process.exit(0);}

const sourceHashesAtStart=await hashes(),errors=[],captures=[],samples=[];
const browser=await chromium.launch({headless:true});
let orders,diagnostics;
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.stack));
 await page.addInitScript(raw=>localStorage.setItem('wildhaven.v3',raw),raw);
 await page.goto('http://127.0.0.1:4751/wildhaven/?review',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>window.__wildhaven);await page.locator('#continue').click();
 if(await page.locator('#pause').getAttribute('aria-label')!=='Resume')throw new Error('Checkpoint did not resume paused');
 await page.evaluate(()=>{document.body.classList.add('photo');const w=__wildhaven.world;w.focusWorld(1,-27.6,14);w.targetAzimuth=Math.PI/5;w.updateCamera(2);});
 const shot=async name=>{await page.screenshot({path:file('review/'+name+'.png').pathname});captures.push(name);};
 await shot('frontier-earned-final-battle-orders');
 orders=await page.evaluate(async()=>{const api=await import('./js/frontier.js'),s=__wildhaven.state,ids=s.frontier.units.filter(u=>u.faction==='player'&&u.status==='active'&&u.kind!=='engineer'&&u.kind!=='envoy').map(u=>u.id),enemy=s.frontier.units.find(u=>u.faction==='blackthorn'&&u.status==='active');return enemy?api.commandTroops(s,ids,{type:'attack',targetId:enemy.id},__wildhaven.frontierContext()):null;});
 if(!orders?.ok)throw new Error('Earned battle public attack order failed');
 let shots=0,lastShot=-100;
 for(let i=0;i<480;i++){
  const sample=await page.evaluate(()=>{__wildhaven.advance(.1);const w=__wildhaven.world,s=__wildhaven.state;w.updateFrontier(.1,false);return{time:s.frontier.clock,projectiles:s.frontier.projectiles.length,attacking:[...w.troops.values()].filter(a=>a.root.userData.motion?.attacking).map(a=>({id:a.unit.id,kind:a.unit.kind,x:a.unit.x,z:a.unit.z,hp:a.unit.hp,attackAt:a.unit.attackAt})),enemyHp:s.frontier.units.filter(u=>u.faction==='blackthorn').map(u=>({id:u.id,hp:u.hp,status:u.status}))};});
  samples.push(sample);
  if(sample.attacking.some(u=>u.kind!=='archer')&&shots<4&&i>lastShot+3){lastShot=i;await shot('frontier-earned-final-fight-'+shots++);}
  if(shots>=4&&i>120)break;
 }
 if(shots!==4)throw new Error(`Only ${shots} earned melee frames captured`);
 diagnostics=await page.evaluate(()=>Wildhaven.getDiagnostics());
 await context.close();
}catch(error){errors.push(error.stack);}finally{await browser.close();}
const sourceHashesAtEnd=await hashes(),sourcesStable=JSON.stringify(sourceHashesAtStart)===JSON.stringify(sourceHashesAtEnd);
const originalHashAtEnd=hash(await readFile(file(original))),snapshotHashAtEnd=hash(await readFile(file(snapshot)));
const checkpoint={original,snapshot,sha256:checkpointHash,originalHashAtEnd,snapshotHashAtEnd,checkpointStable:originalHashAtEnd===checkpointHash,snapshotStable:snapshotHashAtEnd===checkpointHash};
await writeFile(file('review/frontier-earned-battle-render-report.json'),JSON.stringify({scope:'Final earned public-action campaign battle checkpoint, copied to a content-addressed immutable input and loaded into fresh isolated browser storage. Uses only a public attack order and actual simulation ticks; no resources, HP, positions, entities or claims inserted. Rendered frames require separate visual inspection. Headless diagnostics are not hardware performance claims.',checkedAt:new Date().toISOString(),sourceHashesAtStart,sourceHashesAtEnd,sourcesStable,checkpoint,orders,samples,diagnostics,captures,errors},null,2));
console.log(JSON.stringify({sourcesStable,checkpoint,captures,errors}));
if(errors.length||!sourcesStable||!checkpoint.checkpointStable||!checkpoint.snapshotStable)process.exitCode=1;
