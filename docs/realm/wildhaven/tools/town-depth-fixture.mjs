/** Prepared supplies and unlocks for UI review. This is not an earned campaign. */
import {writeFile,mkdir} from 'node:fs/promises';
import * as sim from '../js/sim.js';
import {RESEARCH} from '../js/progression.js';
import {buyLivestock,herdFor} from '../js/livestock.js';
import {CALENDAR_DAY_SECONDS} from '../js/calendar.js';
const s=sim.createGame();s.research.completed=Object.keys(RESEARCH);
const stock=()=>{for(const k of Object.keys(s.resources))s.resources[k]=150;};
stock();sim.pauseBuilding(s,'hearth',true);
const plots=sim.listTiles().filter(t=>t.buildable&&!sim.hasNaturalObstacle(t.x,t.z)).sort((a,b)=>Math.hypot(a.x,a.z-2)-Math.hypot(b.x,b.z-2));
for(const type of ['pasture','henhouse','assay','school','quarry','mine']){
 stock();const p=plots.find(p=>s.buildings.every(b=>Math.max(Math.abs(b.x-p.x),Math.abs(b.z-p.z))>=2)&&sim.canBuild(s,type,p.x,p.z).ok);if(!p)throw Error('No plot '+type);
 const r=sim.build(s,type,p.x,p.z);for(let i=0;i<300&&r.building.status!=='ready';i++){stock();sim.tick(s,1);}if(r.building.status!=='ready')throw Error('Unfinished '+type);
 sim.setWorkers(s,r.building.id,0);
}
for(const b of s.buildings){if(['pasture','henhouse'].includes(b.type)){for(let i=0;i<3;i++)buyLivestock(s,b);herdFor(s,b).animals[2].age=CALENDAR_DAY_SECONDS/2;}sim.setWorkers(s,b.id,b.type==='school'?2:b.type==='pasture'?2:b.type==='henhouse'?1:b.type==='assay'?1:0);}
s.research.completed=s.research.completed.filter(id=>id!=='husbandry_care');stock();s.resources.cloth=1;s.resources.grain=7;sim.refreshTown(s);
if(!sim.restore(sim.serialize(s)))throw Error('Invalid fixture');
await mkdir(new URL('../review/town-depth/',import.meta.url),{recursive:true});
await writeFile(new URL('../review/town-depth/prepared-save.json',import.meta.url),sim.serialize(s));
console.log(s.buildings.map(b=>({id:b.id,type:b.type,x:b.x,z:b.z})));
