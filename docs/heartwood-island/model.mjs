export const SHRINES=[
{id:'moon',name:'Moonflower grove',ingredient:'Moonflower',x:-7,z:-5,pattern:[0,2,0,1],story:'The moonflower opens to the song of night. Watch its four lights, then echo their order.'},
{id:'moss',name:'Mosskeeper’s stones',ingredient:'River moss',x:-7,z:5,pattern:[1,0,2,1],story:'The river remembers every footstep. Echo the four notes tucked between these stones.'},
{id:'dew',name:'The dawn well',ingredient:'Dawn dew',x:1,z:-7,pattern:[2,1,0,1,2],story:'One drop of dawn holds five notes. Play the well’s melody to fill your bottle.'}
];
export const PLATES=[
{id:'frog-alchemist',name:'Frog Alchemist',x:7,z:-7},
{id:'woodland-robot',name:'Woodland Robot',x:8,z:4},
{id:'blue-ridge-night-creature',name:'Blue Ridge Night Creature',x:-2,z:9},
{id:'mushroom-cartographer',name:'Mushroom Cartographer',x:-10,z:0},
{id:'creek-salamander-stargazer',name:'Creek Salamander Stargazer',x:0,z:-10}
];
export function freshSave(){return {version:1,shrines:[],plates:[],complete:false,sound:false};}
export function validateSave(v){if(!v||v.version!==1||!Array.isArray(v.shrines)||!Array.isArray(v.plates)||typeof v.complete!=='boolean'||typeof v.sound!=='boolean'||new Set(v.shrines).size!==v.shrines.length||new Set(v.plates).size!==v.plates.length||v.shrines.some(id=>!SHRINES.some(s=>s.id===id))||v.plates.some(id=>!PLATES.some(p=>p.id===id))||v.complete&&v.shrines.length!==3)throw Error('Invalid island save');return {version:1,shrines:[...v.shrines],plates:[...v.plates],complete:v.complete,sound:v.sound};}
let obstacles=[];
export function configureNavigation(circles){obstacles=circles.filter(o=>o.radius<1);}
export function walkable(x,z){return Number.isFinite(x)&&Number.isFinite(z)&&Math.hypot(x,z)<12&&Math.hypot(x+3,z+1)>3.5&&obstacles.every(o=>Math.hypot(x-o.x,z-o.z)>o.radius+.2)&&!(x>3.4&&x<6.7&&z<-4&&z>-7.1);}
const STEP=.65;
export function findPath(from,to){const toGrid=p=>[Math.round(p.x/STEP),Math.round(p.z/STEP)];let [sx,sz]=toGrid(from),[tx,tz]=toGrid(to);if(!walkable(tx*STEP,tz*STEP))return [];const key=(x,z)=>`${x},${z}`,start=key(sx,sz),goal=key(tx,tz),queue=[{x:sx,z:sz,g:0,f:0}],cost=new Map([[start,0]]),prev=new Map();let found=false;for(let n=0;queue.length&&n<4000;n++){queue.sort((a,b)=>a.f-b.f);const p=queue.shift(),k=key(p.x,p.z);if(k===goal){found=true;break;}for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const x=p.x+dx,z=p.z+dz;if(!walkable(x*STEP,z*STEP)||dx&&dz&&(!walkable((p.x+dx)*STEP,p.z*STEP)||!walkable(p.x*STEP,(p.z+dz)*STEP)))continue;const nk=key(x,z),g=p.g+Math.hypot(dx,dz);if(g<(cost.get(nk)??Infinity)){cost.set(nk,g);prev.set(nk,k);queue.push({x,z,g,f:g+Math.hypot(tx-x,tz-z)});}}}if(!found)return [];const path=[];let k=goal;while(k!==start){const [x,z]=k.split(',').map(Number);path.unshift({x:x*STEP,z:z*STEP});k=prev.get(k);if(!k)return [];}return path;}
