import {G,MAP_H,MAP_W,TILE,setSeed} from '../js/state.js?realm=198';
import {findPath} from '../js/pathfinding.js?realm=198';
import {updateCitizens} from '../js/citizens.js?realm=198';
import {writeFile,mkdir} from 'node:fs/promises';
const out=new URL('../tmp/graphics-world/',import.meta.url);await mkdir(out,{recursive:true});
const label=process.argv[2]||'before';
const records=[];
for(const perArm of [1,3,6])for(const width of [1,3]){
 G.map=Array.from({length:MAP_H},()=>Array(MAP_W).fill(TILE.GRASS));
 G.fog=Array.from({length:MAP_H},()=>Array(MAP_W).fill(true));
 G.buildingGrid=Array.from({length:MAP_H},()=>Array(MAP_W).fill(null));
 G.buildings=[];G.citizens=[];G.soldiers=[];G.enemies=[];G.particles=[];G.tileWear=null;
 G.resources={wood:0,stone:0,food:100,gold:0,iron:0,wheat:0,flour:0,planks:0,tools:0};
 G.population=0;G.nextActorId=1;G.day=1;G.dayLength=3600;G.dayPhase=1800;G.gameTick=0;G.speed=1;G.season='spring';G.weather='clear';G.obstacleEpoch=1;
 G.eventModifiers={foodProd:1,goldProd:1,happinessOffset:0,speedMult:1};setSeed(1);
 // Four building blocks leave a real narrow crossroads. Entrances open
 // into a wider square so completed actors can be passed.
 for(let y=17;y<=23;y++)for(let x=17;x<=23;x++)if(Math.abs(x-20)>width/2&&Math.abs(y-20)>width/2)G.map[y][x]=TILE.MOUNTAIN;
 for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])for(let n=0;n<perArm;n++){
  const actorId=G.nextActorId++,x=20-dx*(4+n),y=20-dy*(4+n),tx=20+dx*(4+n),ty=20+dy*(4+n);
  const path=findPath(x,y,tx,ty);
  G.citizens.push({actorId,identity:{name:`Person ${actorId}`,appearanceId:'identity-01'},profession:{kind:'settler',sinceTick:0,reason:'spawn-settler'},assignment:null,
   activity:{kind:'idle',sinceTick:0,reason:'spawn-idle'},activityTimer:9999,x,y,tx,ty,faceX:dx,faceZ:dy,speed:.03,hunger:0,rest:100,needs:{joy:55,faith:55},path,pathIdx:0,
   _requestedTx:tx,_requestedTy:ty,_pathEpoch:1,_pathStartedAt:0,_hb:actorId,carrying:null,carryAmount:0});
 }
 G.population=G.citizens.length;
 const completed=new Set(),trace=[];let maxWait=0,minDistance=Infinity;
 for(let tick=1;tick<=1800;tick++){
  G.gameTick=tick;updateCitizens();
  for(const c of G.citizens){
   if(Math.hypot(c.x-c._requestedTx,c.y-c._requestedTy)<.55)completed.add(c.actorId);
   maxWait=Math.max(maxWait,c._stuckTicks||0);
  }
  for(let i=0;i<G.citizens.length;i++)for(let j=i+1;j<G.citizens.length;j++)minDistance=Math.min(minDistance,Math.hypot(G.citizens[i].x-G.citizens[j].x,G.citizens[i].y-G.citizens[j].y));
  if(tick%15===0)trace.push({tick,actors:G.citizens.map(c=>({id:c.actorId,x:c.x,y:c.y,wait:c._stuckTicks,index:c.pathIdx,path:c.path}))});
  if(completed.size===G.population)break;
 }
 const result={perArm,width,population:G.population,completed:completed.size,ticks:G.gameTick,maxWait,minDistance,
  unresolved:G.citizens.filter(c=>!completed.has(c.actorId)).map(c=>({id:c.actorId,x:c.x,y:c.y,goal:c._pathGoal||{x:c.tx,y:c.ty},wait:c._stuckTicks,index:c.pathIdx,path:c.path})),trace};
 records.push(result);const {trace:_,...summary}=result;console.log(JSON.stringify(summary));
}
await writeFile(new URL(`crossing-${label}.json`,out),JSON.stringify(records,null,2)+'\n');
