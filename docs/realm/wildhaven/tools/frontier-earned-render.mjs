/** Render only earned checkpoints in fresh isolated browser contexts. No prepared resources or entities. */
import {chromium} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const sources=['js/world.js','js/island.js','js/frontier.js','js/sim.js','js/main.js','assets/frontier-kit.glb','assets/frontier-kit.json','tools/frontier-earned-render.mjs'];
const hash=buffer=>createHash('sha256').update(buffer).digest('hex');const hashes=async()=>Object.fromEntries(await Promise.all(sources.map(async p=>[p,hash(await readFile(new URL('../'+p,import.meta.url)))])));
const sourceHashesAtStart=await hashes(),browser=await chromium.launch({headless:true}),errors=[],captures=[],checkpoints={};
const openCheckpoint=async name=>{const raw=await readFile(new URL('../review/frontier-campaign-'+name+'-save.json',import.meta.url),'utf8');checkpoints[name]={sha256:hash(raw)};const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.stack));await page.addInitScript(raw=>localStorage.setItem('wildhaven.v3',raw),raw);await page.goto('http://127.0.0.1:4751/wildhaven/?review',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__wildhaven);await page.locator('#continue').click();if(await page.locator('#pause').getAttribute('aria-label')!=='Resume')throw new Error('Checkpoint did not resume paused');await page.evaluate(()=>document.body.classList.add('photo'));return{context,page};};
const shot=async(page,name)=>{await page.screenshot({path:new URL('../review/'+name+'.png',import.meta.url).pathname});captures.push(name);};
{
 const{context,page}=await openCheckpoint('walls');
 await page.evaluate(()=>{const w=__wildhaven.world;w.focusWorld(-1,-17.7,18);w.targetAzimuth=Math.PI/5;w.updateCamera(2);w.updateFrontier(1,false);});await page.waitForTimeout(200);await shot(page,'frontier-earned-01-walls-company');
 const before=await page.evaluate(()=>JSON.stringify(__wildhaven.state));
 for(const[id,x,z]of[['reedbank',18,-13],['stonehaven',-18,-14],['blackthorn',2,-28]]){await page.evaluate(({x,z})=>{const w=__wildhaven.world;w.focusWorld(x,z,12);w.targetAzimuth=Math.PI/5;w.updateCamera(2);},{x,z});await page.waitForTimeout(150);await shot(page,'frontier-earned-02-'+id);}
 await page.evaluate(()=>{const w=__wildhaven.world;w.focusIsland();w.updateCamera(2);});await page.waitForTimeout(150);await shot(page,'frontier-earned-03-island');
 const after=await page.evaluate(()=>JSON.stringify(__wildhaven.state));checkpoints.walls.presentationReadOnly=before===after;checkpoints.walls.diagnostics=await page.evaluate(()=>Wildhaven.getDiagnostics());await context.close();
}
if(process.env.FRONTIER_CAPTURE_BATTLE!=='0'){
 const{context,page}=await openCheckpoint('battle-start');
 await page.evaluate(()=>{const w=__wildhaven.world;w.focusWorld(1,-27.6,14);w.targetAzimuth=Math.PI/5;w.updateCamera(2);});await shot(page,'frontier-earned-04-battle-orders');
 // Issue a public attack order and follow real saved units; no entity positions are changed.
 const orders=await page.evaluate(async()=>{const api=await import('./js/frontier.js'),s=__wildhaven.state,ids=s.frontier.units.filter(u=>u.faction==='player'&&u.status==='active'&&u.kind!=='engineer'&&u.kind!=='envoy').map(u=>u.id),enemy=s.frontier.units.find(u=>u.faction==='blackthorn'&&u.status==='active');return enemy?api.commandTroops(s,ids,{type:'attack',targetId:enemy.id},__wildhaven.frontierContext()):null;});
 const samples=[];let shots=0;
 for(let i=0;i<360;i++){
  const sample=await page.evaluate(()=>{__wildhaven.advance(.1);const w=__wildhaven.world,s=__wildhaven.state;w.updateFrontier(.1,false);return{time:s.frontier.clock,projectiles:s.frontier.projectiles.length,attacking:[...w.troops.values()].filter(a=>a.root.userData.motion?.attacking).map(a=>({id:a.unit.id,kind:a.unit.kind,x:a.unit.x,z:a.unit.z,hp:a.unit.hp,attackAt:a.unit.attackAt})),enemyHp:s.frontier.units.filter(u=>u.faction==='blackthorn').map(u=>({id:u.id,hp:u.hp,status:u.status}))};});samples.push(sample);
  if(sample.attacking.some(u=>u.kind!=='archer')&&shots<4&&(shots===0||i>samples.lastShot+3)){samples.lastShot=i;await shot(page,'frontier-earned-05-fight-'+shots++);}
  if(shots>=4&&i>120)break;
 }
 checkpoints['battle-start'].orders=orders;checkpoints['battle-start'].samples=samples;checkpoints['battle-start'].diagnostics=await page.evaluate(()=>Wildhaven.getDiagnostics());await context.close();
}
const sourceHashesAtEnd=await hashes(),sourcesStable=JSON.stringify(sourceHashesAtStart)===JSON.stringify(sourceHashesAtEnd);for(const[name,entry]of Object.entries(checkpoints)){entry.sha256AtEnd=hash(await readFile(new URL('../review/frontier-campaign-'+name+'-save.json',import.meta.url)));entry.checkpointStable=entry.sha256===entry.sha256AtEnd;}
await writeFile(new URL('../review/frontier-earned-render-report.json',import.meta.url),JSON.stringify({scope:'Earned public-action campaign checkpoints loaded into isolated browser storage. Wall/company/hamlet/island shots change only presentation. Battle shots continue saved units through public attack order and actual simulation ticks; no resources, HP, positions, entities or claims are inserted. Screens require separate visual inspection. Headless diagnostics are not hardware performance claims.',checkedAt:new Date().toISOString(),sourceHashesAtStart,sourceHashesAtEnd,sourcesStable,checkpoints,captures,errors},null,2));await browser.close();console.log(JSON.stringify({errors,sourcesStable,captures}));if(errors.length)process.exitCode=1;
