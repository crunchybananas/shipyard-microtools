import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
const threeURL = new URL('../../vendor/three/three.module.js',import.meta.url).href;
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(threeURL)},shortCircuit:true};return n(s,c);}`));
const THREE=await import('three');
const {VillageWorld}=await import('../js/world.js');
function setup(){
 const w=Object.create(VillageWorld.prototype),scene=new THREE.Scene();
 Object.assign(w,{scene,canvas:{getBoundingClientRect:()=>({left:0,top:0,width:200,height:200})},pointer:new THREE.Vector2(),raycaster:new THREE.Raycaster(),camera:new THREE.OrthographicCamera(-2,2,2,-2,.1,50),actors:[],buildings:new Map(),landmarks:[],discoveryModels:new Map(),fortifications:new Map(),troops:new Map(),neighborModels:new Map(),decor:new Map()});
 w.camera.position.set(0,0,10);w.camera.lookAt(0,0,0);w.camera.updateMatrixWorld();
 w.land=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.MeshStandardMaterial({side:THREE.DoubleSide}));w.land.position.z=-5;scene.add(w.land);
 const add=(kind,z=0,child=false)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,.5),new THREE.MeshStandardMaterial());let o=mesh;if(child){o=new THREE.Group();o.add(mesh);}o.position.z=z;
   if(kind==='citizen'){o.userData.citizen={id:'Ada'};w.actors.push({root:o});}
   else if(kind==='building'){o.userData.building={id:'home',x:2,z:1};w.buildings.set('home',o);}
   else if(kind==='scenery')w.decor.set('0,0',[{meshes:[o],index:0}]);
   else if(kind==='unit'){o.userData.unit={id:'guard',x:0,z:0,status:'ready',faction:'player'};w.troops.set('guard',o);}
   scene.add(o);return {o,mesh};};
 const pick=()=>{scene.updateMatrixWorld(true);return w.pick(100,100);};return {w,add,pick};
}
const cases=[
 ['visible resident',({add})=>add('citizen'),v=>v.citizen?.id==='Ada'],
 ['visible roof wins over resident behind',({add})=>{add('building',2);add('citizen');},v=>v.x===2&&!v.citizen],
 ['visible resident in front of roof',({add})=>{add('building');add('citizen',2);},v=>!!v.citizen],
 ['invisible citizen root is ignored',({add})=>{add('citizen',2).o.visible=false;add('building');},v=>v.x===2&&!v.citizen],
 ['invisible descendant cannot intercept',({add})=>{add('citizen',2,true).mesh.visible=false;add('building');},v=>v.x===2&&!v.citizen],
 ['invisible intermediate ancestor cannot intercept',({add})=>{const {o,mesh}=add('citizen',2,true),g=new THREE.Group();g.visible=false;o.add(g);g.add(mesh);add('building');},v=>v.x===2&&!v.citizen],
 ['trees block residents behind them',({add})=>{add('scenery',2);add('citizen');},v=>v.scenery&&!v.citizen],
 ['rocks block houses behind them',({add})=>{add('scenery',2);add('building');},v=>v.scenery&&!v.citizen],
 ['transparent cues do not steal a click',({add})=>{add('citizen',2).mesh.material.opacity=0;add('building');},v=>v.x===2&&!v.citizen],
 ['non-depth-writing overlays do not steal a click',({add})=>{add('citizen',2).mesh.material.depthWrite=false;add('building');},v=>v.x===2&&!v.citizen],
 ['invisible materials do not steal a click',({add})=>{add('citizen',2).mesh.material.visible=false;add('building');},v=>v.x===2&&!v.citizen],
 ['clipped construction geometry is ignored',({add})=>{add('building',2).mesh.material.clippingPlanes=[new THREE.Plane(new THREE.Vector3(0,-1,0),-1)];add('citizen');},v=>!!v.citizen],
 ['terrain occludes underground residents',({add})=>add('citizen',-7),v=>!v.citizen&&v.point.z===-5],
 ['dead units do not steal a click',({add})=>{add('unit',2).o.userData.unit.status='dead';add('building');},v=>v.x===2&&!v.unit],
 ['visible units still select',({add})=>add('unit'),v=>v.unit?.id==='guard'],
 ['empty ground remains ground',()=>{},v=>!v.citizen&&!v.unit&&!v.tree&&v.point.z===-5],
];
for(const [name,arrange,check] of cases)test(name,()=>{const c=setup();arrange(c);assert.ok(check(c.pick()),name);});
test('instanced tree identity follows the exact visible tree rather than a hidden resident',()=>{
 const {w,add,pick}=setup();add('citizen');
 const tree=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial(),1),site={id:'tree-1',tile:{x:4,z:3}};
 tree.setMatrixAt(0,new THREE.Matrix4().makeTranslation(0,0,2));tree.userData.treeSites=[site];w.decor.set('tree',[{meshes:[tree]}]);w.scene.add(tree);
 assert.equal(pick().tree,site);
});
