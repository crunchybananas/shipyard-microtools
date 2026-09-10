import {readFile,writeFile} from 'node:fs/promises';
import {G} from '../js/state.js?realm=198';
import {coreTick} from '../js/sim.js?realm=198';
import {prepareSave,commitGameLoad} from '../js/save-state.js?realm=198';
const label=process.argv[2]||'before';
const save=await readFile(new URL('../tmp/graphics-world/before/failure-save.json',import.meta.url),'utf8');
const prepared=prepareSave(save);if(!prepared.ok)throw new Error(JSON.stringify(prepared.error));
const committed=commitGameLoad(prepared.value);if(!committed.ok)throw new Error(JSON.stringify(committed.error));
const citizen=G.citizens.find(c=>c.actorId===18),start={x:citizen.x,y:citizen.y},trace=[];
let escapedAt=null;
for(let t=0;t<900;t++){
 coreTick();
 if(escapedAt===null&&Math.hypot(citizen.x-start.x,citizen.y-start.y)>.8)escapedAt=t+1;
 if(t%5===0)trace.push({t,x:citizen.x,y:citizen.y,wait:citizen._stuckTicks,path:citizen.path,index:citizen.pathIdx,activity:citizen.activity.kind});
}
const result={escapedAt,start,end:{x:citizen.x,y:citizen.y},trace};
await writeFile(new URL(`../tmp/graphics-world/resume-${label}.json`,import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({label,escapedAt,start,end:result.end,trace:trace.slice(0,12)}));
