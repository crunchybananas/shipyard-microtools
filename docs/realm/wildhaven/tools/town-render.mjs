/** Render review from the independently earned campaign save; no visual fixture claims human play. */
import {chromium} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const sources=['js/main.js','js/world.js','js/town-ui.js','js/sim.js','js/catalog.js','js/progression.js','js/pressure.js','style.css','assets/town-kit.glb'];
const hashes=async()=>Object.fromEntries(await Promise.all(sources.map(async p=>[p,createHash('sha256').update(await readFile(new URL(`../${p}`,import.meta.url))).digest('hex')])));
const sourceHashesAtStart=await hashes();
const sourceSave = process.env.WILDHAVEN_RENDER_SAVE || 'campaign-services-lanes-save.json';
const raw=await readFile(new URL(`../review/${sourceSave}`,import.meta.url),'utf8');
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.stack));
await page.addInitScript(raw=>localStorage.setItem('wildhaven.v2',raw),raw);
await page.goto('http://127.0.0.1:4751/wildhaven/?review',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__wildhaven);await page.locator('#continue').click();await page.locator('#collapse-objective').click();
await page.evaluate(async()=>{const sim=await import('./js/sim.js'),{getBuildingSpec}=await import('./js/catalog.js');for(const b of __wildhaven.state.buildings){if(b.status==='ready'&&getBuildingSpec(b.type,b.level).workers)sim.setWorkers(__wildhaven.state,b.id,getBuildingSpec(b.type,b.level).workers);}__wildhaven.sync();const w=__wildhaven.world;w.home();for(let i=0;i<1200;i++){w.clock+=.1;w.updateActors(.1);}});
await page.waitForTimeout(800);
const shot=async name=>page.screenshot({path:new URL(`../review/${name}.png`,import.meta.url).pathname});
await shot('town-07-grown-port');
const workers=await page.evaluate(()=>{const w=__wildhaven.world;return w.actors.map(a=>({id:a.citizen.id,job:a.citizen.job,workplace:a.workplace,activity:a.activity,state:a.root.userData.workState,position:a.root.position.toArray(),tool:a.toolType}));});
const actor=workers.find(a=>a.job==='smith'&&a.state==='working')||workers.find(a=>a.state==='working');
if(actor){await page.evaluate(id=>{const w=__wildhaven.world,a=w.actors.find(a=>a.citizen.id===id);w.pan.set(a.root.position.x,0,a.root.position.z);w.targetZoom=8;w.updateCamera(2);document.body.classList.add('photo');},actor.id);await page.waitForTimeout(700);
 for(let i=0;i<4;i++){await page.evaluate(()=>{const w=__wildhaven.world;for(let j=0;j<5;j++){w.clock+=.1;w.updateActors(.1);}});await shot(`town-08-artisan-pose-${i}`);}}
await page.evaluate(()=>{const w=__wildhaven.world,b=__wildhaven.state.buildings.find(b=>b.type==='well');document.body.classList.remove('photo');w.home();w.showServiceArea(b.type,b,b.level);});await page.waitForTimeout(700);await shot('town-09-service-reach');
await page.evaluate(()=>{const w=__wildhaven.world;w.showServiceArea(null,null);for(let i=0;i<10&&!__wildhaven.state.pressure.active;i++)__wildhaven.advance(90);__wildhaven.sync();w.pan.set(3,0,4);w.targetZoom=37;});await page.locator('#town-tools [data-town-tab="watch"]').click();await page.waitForTimeout(800);await shot('town-10-coastal-warning');
const sourceHashesAtEnd=await hashes(),sourcesStable=JSON.stringify(sourceHashesAtStart)===JSON.stringify(sourceHashesAtEnd);
await writeFile(new URL('../review/town-render-report.json',import.meta.url),JSON.stringify({at:new Date().toISOString(),sourceSave,sourceHashesAtStart,sourceHashesAtEnd,sourcesStable,workingActorFound:!!actor,scope:'Isolated browser loaded the named earned campaign checkpoint. Public staffing actions requested full workplaces for pose review. Worker motion advanced only presentation; coastal warning uses real simulation clock. Camera placed for inspection. Finding a working actor does not replace human/model inspection of the captured poses. Headless rendering is not hardware performance evidence.',actor,workers,errors,diagnostics:await page.evaluate(()=>Wildhaven.getDiagnostics())},null,2));
await browser.close();console.log(JSON.stringify({errors,actor,workers:workers.length,sourceSave}));if(errors.length || !actor)process.exitCode=1;
