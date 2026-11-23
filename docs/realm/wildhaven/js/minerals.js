import { listTiles } from './island.js';

const round=n=>Math.round(n*1e6)/1e6;
// Deposits belong to the land, not the building. Demolishing cannot refill them.
export const DEPOSITS=Object.freeze(listTiles().filter(t=>t.kind==='rock').map(t=>{
 const seed=Math.abs(Math.round(Math.sin(t.x*73.7+t.z*19.3)*10000));
 return {id:`${t.x},${t.z}`,x:t.x,z:t.z,stone:140+seed%100,ore:90+seed%80};
}));
const byId=new Map(DEPOSITS.map(d=>[d.id,d]));
const fields=new Map();
export const createMinerals=()=>({version:1,deposits:{}});
export function restoreMinerals(input){
 if(input===undefined)return createMinerals();
 if(!input||input.version!==1||!input.deposits||typeof input.deposits!=='object'||Array.isArray(input.deposits)||Object.keys(input.deposits).length>DEPOSITS.length)throw Error('Invalid mineral ledger');
 const out=createMinerals();
 for(const[id,bag]of Object.entries(input.deposits)){
  const site=byId.get(id);if(!site||!bag||typeof bag!=='object'||Array.isArray(bag))throw Error('Invalid mineral deposit');
  for(const[k,n]of Object.entries(bag))if(!['stone','ore','deepStone','deepOre'].includes(k)||!Number.isFinite(n)||n<0||n>site[k.toLowerCase().replace('deep','')])throw Error('Invalid extracted amount');
  out.deposits[id]={...bag};
 }
 return out;
}
export function depositsFor(building){
 const key=`${building.x},${building.z}`;
 if(!fields.has(key))fields.set(key,DEPOSITS.filter(d=>Math.hypot(d.x-building.x,d.z-building.z)<=5).sort((a,b)=>Math.hypot(a.x-building.x,a.z-building.z)-Math.hypot(b.x-building.x,b.z-building.z)||a.id.localeCompare(b.id)).slice(0,3));
 return fields.get(key);
}
export function mineralStatus(state,b){
 const resource=b.type==='mine'?'ore':'stone',deepKey=resource==='ore'?'deepOre':'deepStone',sites=depositsFor(b),deep=(b.level||1)>=2&&state.research?.completed?.includes('prospecting');
 const surface=sites.reduce((sum,d)=>sum+d[resource]-(state.minerals?.deposits[d.id]?.[resource]||0),0);
 const below=sites.reduce((sum,d)=>sum+d[resource]-(state.minerals?.deposits[d.id]?.[deepKey]||0),0);
 const capacity=sites.reduce((sum,d)=>sum+d[resource]*(deep?2:1),0),available=Math.max(0,round(surface+(deep?below:0)));
 return {resource,sites,deep,available,capacity,surface:Math.max(0,round(surface)),below:Math.max(0,round(below)),fraction:capacity?available/capacity:0};
}
export function extractMinerals(state,b,requested){
 if(!Number.isFinite(requested)||requested<=0)return 0;
 state.minerals||=createMinerals();const status=mineralStatus(state,b),keys=[status.resource];if(status.deep)keys.push(status.resource==='ore'?'deepOre':'deepStone');
 let left=requested;
 for(const k of keys)for(const d of status.sites){if(left<=1e-8)break;const bag=state.minerals.deposits[d.id]||={},used=bag[k]||0,taken=Math.min(left,d[status.resource]-used);bag[k]=round(used+taken);left-=taken;}
 return round(requested-Math.max(0,left));
}
export function depositFraction(state,id){
 const site=byId.get(id),used=state.minerals?.deposits[id];if(!site||!used)return 1;
 return Math.max(0,1-((used.stone||0)+(used.ore||0))/(site.stone+site.ore));
}
