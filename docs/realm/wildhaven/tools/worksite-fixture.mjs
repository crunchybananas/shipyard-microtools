/** Deliberately prepared renderer fixture, not earned gameplay or a saved town. */
import { createGame, isLand, hasNaturalObstacle, buildingEntrance, listTiles } from '../js/sim.js';
import { BUILDINGS } from '../js/catalog.js';

export function createOpenWorksiteState({ types = ['smith','lumber','sawmill','quarry','bakery','farm','clinic','mine','market','barracks','school','garden','orchard','windmill','chapel','manor'], workersPerSite = 2 } = {}) {
  const state=createGame();state.citizens=[];state.population=0;state.builderTarget=0;
  const occupied=()=>new Set(state.buildings.map(b=>`${b.x},${b.z}`));
  const connected=()=>{const blocked=occupied(),open=(x,z)=>isLand(x+.2,z+.2)&&isLand(x-.2,z-.2)&&!hasNaturalObstacle(x,z)&&!blocked.has(`${x},${z}`),seen=new Set(['0,3']),queue=[{x:0,z:3}];for(let i=0;i<queue.length;i++)for(const[dx,dz]of[[1,0],[-1,0],[0,1],[0,-1]]){const x=queue[i].x+dx,z=queue[i].z+dz,key=`${x},${z}`;if(!seen.has(key)&&open(x,z)){seen.add(key);queue.push({x,z});}}return seen;};
  const plots=listTiles().filter(p=>isLand(p.x+.4,p.z+.4)&&isLand(p.x-.4,p.z-.4)&&!hasNaturalObstacle(p.x,p.z)).sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z));
  for(const[typeIndex,type]of types.entries()){
    let placed=null;
    for(const p of plots){
      if(state.buildings.some(b=>Math.max(Math.abs(b.x-p.x),Math.abs(b.z-p.z))<2))continue;
      for(let turn=0;turn<4;turn++){
        const rotation=(typeIndex+turn)%4,b={id:`fixture-${type}`,type,x:p.x,z:p.z,rotation,level:1,status:'ready',workerIds:[],production:{efficiency:1},desiredWorkers:workersPerSite},front=buildingEntrance(b);
        if(hasNaturalObstacle(front.x,front.z)||!isLand(front.x+.2,front.z+.2)||!isLand(front.x-.2,front.z-.2))continue;
        state.buildings.push(b);const reachable=connected();
        if(state.buildings.every(existing=>{const entry=buildingEntrance(existing);return existing.type==='bell'||reachable.has(`${entry.x},${entry.z}`);})){placed=b;break;}
        state.buildings.pop();
      }
      if(placed)break;
    }
    if(!placed)throw new Error(`No connected fixture plot for ${type}`);
    for(let n=0;n<workersPerSite;n++){const citizen={id:`${placed.id}-worker-${n+1}`,name:`${BUILDINGS[type].name} ${n+1}`,job:BUILDINGS[type].job,workplace:placed.id,experience:{}};state.citizens.push(citizen);placed.workerIds.push(citizen.id);}
  }
  state.population=state.citizens.length;
  state.fixture='Prepared renderer review: open connected work entrances, assigned actors, production efficiency1. No simulation progression or saved town is claimed.';
  return state;
}
