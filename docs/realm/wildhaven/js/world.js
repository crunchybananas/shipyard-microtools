import { visibleSurfaceHit } from './world-picking.js';
import { wheelZoom, pinchZoom } from './camera-input.js';
import { TREE_SITES, treeState, SAPLING_SECONDS, woodlandOccupancy } from './woodland.js';
import { DISCOVERIES, isFieldworker } from './discovery.js';
import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/GLTFLoader.js';
import { mergeGeometries } from '../../vendor/three/BufferGeometryUtils.js';
import { buildingEntrance } from './sim.js';
import { groundHeight, terrainAt, isLand, listTiles, hasNaturalObstacle, isNeighborCompoundCell, coastDistance, ISLAND_BOUNDS, ISLAND_REGIONS, ISLAND_NEIGHBORS } from './island.js';
import { blocksFortification, frontierPath, gateTransition, DEFEND_RADIUS } from './frontier.js';
import { BUILDINGS, JOBS, getBuildingSpec } from './catalog.js';
import { serviceReach, residentCue } from './world-cues.js';
import { seasonInfo, festivalStatus } from './seasons.js';
import { seasonPalette, foliageTone } from './season-palette.js';

export const CELL = 1.8;
const TAU = Math.PI * 2;
const MAP_WIDTH=(ISLAND_BOUNDS.maxX-ISLAND_BOUNDS.minX)*CELL,MAP_DEPTH=(ISLAND_BOUNDS.maxZ-ISLAND_BOUNDS.minZ)*CELL;
const MAP_ZOOM=Math.max(MAP_WIDTH,MAP_DEPTH)*1.3;
const FRONTIER_ICONS=['wall','gate','tower','outpost','spearman','archer'];
const rand = (x, z, seed = 1) => { const v = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453; return v - Math.floor(v); };
const material = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });
const matrix = new THREE.Matrix4();
const quaternion = new THREE.Quaternion();
const scale = new THREE.Vector3();
const position = new THREE.Vector3();
const cueMaterial = (color, opacity = 1, extra = {}) => new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, ...extra });
const ownedCueMesh = (geometry, color, opacity = 1, extra = {}) => {
  const mesh = new THREE.Mesh(geometry, cueMaterial(color, opacity, extra));
  mesh.userData.ownsGeometry = mesh.userData.ownsMaterial = true; return mesh;
};
const cueGeometry = positions => { const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); return geometry; };
const JOB_GLYPHS = Object.freeze({builder:'hammer',lumberjack:'axe',quarryworker:'pick',miner:'pick',smith:'hammer',carpenter:'saw',farmer:'leaf',forager:'basket',miller:'grain',baker:'grain',weaver:'cloth',brewer:'mug',trader:'coin',scholar:'book',medic:'cross',chaplain:'star',guard:'spear',steward:'box'});
const buildingPresentation = b => `${b.type}:${b.level}:${b.status}:${b.constructionKind}:${b.restored}:${b.x}:${b.z}:${b.rotation||0}`;
const JOB_TOOLS = Object.freeze({builder:'tool_hammer',lumberjack:'tool_axe',quarryworker:'tool_pick',miner:'tool_pick',farmer:'tool_hoe',forager:'tool_basket',medic:'tool_basket',scholar:'tool_book',chaplain:'tool_book',steward:'tool_book',guard:'tool_spear',smith:'tool_hammer',carpenter:'tool_hammer',trader:'tool_basket',baker:'tool_basket',weaver:'tool_basket',miller:'tool_basket',brewer:'tool_basket'});
const DELIVERY_JOBS = new Set(['lumberjack','quarryworker','miner','farmer','smith','carpenter','trader','baker','weaver','miller','brewer']);
// Feet positions beside the authored work surfaces. The metadata supplies the
// actual tool/hand target; these small clear spaces supply the worker's stance.
const WORK_STANCES = Object.freeze({lumber:[-.44,0,1.00],quarry:[.13,0,.94],garden:[-.23,0,.94],orchard:[.35,0,.91],windmill:[.57,0,.97],farm:[.13,0,.94],bakery:[.52,0,1.10],sawmill:[.13,.15,.72],mine:[.13,0,1.05],smith:[.40,.11,.71],market:[.13,.12,.83],school:[-.42,0,1.09],clinic:[.69,0,.98],barracks:[.56,0,1.05],warehouse:[.13,0,1.08],cottage:[-.07,0,1.04],hearth:[.13,0,1.00]});
const VILLAGE_WORK_TARGETS = Object.freeze({lumber:[-.58,.38,.64],quarry:[0,.34,.44],garden:[-.36,.32,.47],orchard:[.22,.28,.47],windmill:[.44,.40,.26],hearth:[0,.50,.15],cottage:[-.20,.60,.57]});
// Alternate access still uses real authored surfaces: chopping block, crop
// rows, workbench ends, anvil horn, ore cart, and the clinic's herb planters.
const SIDE_WORK_STATIONS=Object.freeze({
  lumber:[{stance:[-1.06,0,.55],target:[-.58,.38,.64]}],
  quarry:[{stance:[-1.10,0,-.10],target:[-.63,.37,-.15]},{stance:[.93,0,.48],target:[.53,.24,.37]}],
  orchard:[{stance:[1.04,0,-.04],target:[.53,.61,-.18]},{stance:[-1.04,0,-.04],target:[-.49,.65,-.17]}],
  garden:[{stance:[1.03,0,.16],target:[.54,.32,.16]},{stance:[-1.03,0,.16],target:[-.54,.32,.16]},{stance:[-.28,0,-1.02],target:[-.36,.32,-.47]}],
  farm:[{stance:[1.04,0,.05],target:[.53,.37,.05]},{stance:[-1.04,0,.05],target:[-.53,.37,.05]},{stance:[0,0,-1.02],target:[0,.37,-.46]}],
  sawmill:[{stance:[.79,.15,.25],target:[.43,.67,.25]},{stance:[-.79,.15,.25],target:[-.43,.67,.25]}],
  smith:[{stance:[.72,.11,.06],target:[.27,.72,.28]},{stance:[-.47,.11,.17],target:[-.09,.73,.28]}],
  mine:[{stance:[.65,0,.60],target:[.18,.46,.53]},{stance:[-.65,0,.60],target:[-.18,.46,.53]}],
  market:[{stance:[1.04,.12,.38],target:[.61,.61,.38]},{stance:[-1.04,.12,.38],target:[-.61,.61,.38]}],
  clinic:[{stance:[1.04,0,.48],target:[.58,.36,.51]},{stance:[1.04,0,-.31],target:[.60,.36,-.32]}],
  barracks:[{stance:[1.05,0,.08],target:[1.5,.65,.08],outward:true},{stance:[-1.05,0,.08],target:[-1.5,.65,.08],outward:true},{stance:[0,0,-1.05],target:[0,.65,-1.5],outward:true}],
});
const SMITH_STATIONS=Object.freeze([
  {stance:[.21,.11,.74],target:[.23,.545,.36],surface:'face'},
  {stance:[-.28,.11,.42],target:[-.06,.521579,.28],surface:'horn'},
  {stance:[.84,.11,.50],target:[.46,.545,.36],surface:'face'},
  {stance:[.72,.11,.06],target:[.44,.545,.25],surface:'face'},
]);

export class VillageWorld {
  constructor(canvas, { onHover, onTap, onCamera, onSound } = {}) {
    this.onSound=onSound;this.discoveryModels=new Map();this.soundEnabled=false;this.canvas = canvas; this.onHover = onHover; this.onTap = onTap; this.onCamera = onCamera;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    this.renderer.localClippingEnabled = true;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.22;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#75acac');
    this.camera = new THREE.OrthographicCamera(-20, 20, 15, -15, 0.1, 420);
    this.target = new THREE.Vector3(0, 0.65, 0); this.pan = new THREE.Vector3();
    this.azimuth = this.targetAzimuth = Math.PI / 4;
    this.zoom = this.targetZoom = 32;
    this.raycaster = new THREE.Raycaster(); this.pointer = new THREE.Vector2();
    this.buildings = new Map(); this.templates = new Map(); this.actors = []; this.decor = new Map();
    this.fortifications=new Map();this.troops=new Map();this.neighborModels=new Map();this.projectileModels=new Map();this.frontierSelection={unitIds:[]};
    this.clock = 0; this.wind = []; this.birds = []; this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.skyLight=new THREE.HemisphereLight('#dbe9d4', '#7a8060', 2.35);this.scene.add(this.skyLight);
    this.sun = new THREE.DirectionalLight('#fff0cf', 3.7);
    this.sun.position.set(-23, 34, 15); this.sun.castShadow = true;
    Object.assign(this.sun.shadow.camera, { left: -29, right: 29, top: 29, bottom: -29, near: 1, far: 85 });
    this.sun.shadow.mapSize.set(2048, 2048); this.sun.shadow.normalBias = 0.04; this.sun.shadow.bias = -0.00015;
    this.scene.add(this.sun,this.sun.target);
    this.landmarks=[]; this.terrain(); this.nature(); this.dock(); this.createPreview(); this.bindInput(); this.resize();
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(canvas);
  }
  async load() {
    const gltf = await new GLTFLoader().loadAsync('./assets/village-kit.glb');
    for (const name of ['cottage', 'lumber', 'quarry', 'orchard', 'windmill', 'garden', 'bell', 'hearth', 'villager', 'boat', 'broadleaf', 'cypress']) {
      const root = gltf.scene.getObjectByName(name);
      if (!root) throw new Error(`Missing village model: ${name}`);
      root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      this.templates.set(name, root);
    }
    const [town,townMetadata]=await Promise.all([new GLTFLoader().loadAsync('./assets/town-kit.glb'),fetch('./assets/town-kit.json').then(response=>{if(!response.ok)throw new Error('Town workstation metadata could not be loaded.');return response.json();})]);
    this.assetMetadata=townMetadata.assets;
    for(const root of town.scene.children){root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});this.templates.set(root.name,root);}
    const frontier=await new GLTFLoader().loadAsync('./assets/frontier-kit.glb');
    for(const root of frontier.scene.children){root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});this.templates.set(root.name,root);}
    const living=await new GLTFLoader().loadAsync('./assets/living-kit.glb');
    for(const root of living.scene.children){root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});this.templates.set(root.name,root);}
    this.replaceTrees();
    this.boat = this.clone('boat'); this.boat.position.set(17, -0.1, 22); this.boat.rotation.y = -0.15; this.scene.add(this.boat);
    return this.icons();
  }
  clone(type,level=1) { const name=type==='cottage'&&level>1?'upgrade_cottage':BUILDINGS[type]?.model||type;const template=this.templates.get(name);if(!template)throw new Error(`Missing runtime model: ${name}`);return template.clone(true); }
  terrain() {
    // Clip a bounded grid against the canonical coastline. Unlike a radial fan,
    // this follows the western and eastern headlands and their concave bays.
    const vertices=[],colors=[],shore=[],step=.30,grass=new THREE.Color('#91aa61'),sand=new THREE.Color('#d4c291'),darkGrass=new THREE.Color('#779458');
    const vertex=(x,z)=>({x,z,land:isLand(x,z)});
    const cross=(a,b)=>{let lo=a.land?a:b,hi=a.land?b:a;for(let n=0;n<13;n++){const m=vertex((lo.x+hi.x)/2,(lo.z+hi.z)/2);if(m.land)lo=m;else hi=m;}return{...lo,shore:true};};
    const emit=p=>{vertices.push(p.x*CELL,groundHeight(p.x,p.z),p.z*CELL);const c=grass.clone().lerp(darkGrass,Math.max(0,Math.sin(p.x*.4+p.z*.7))*.35);c.lerp(sand,THREE.MathUtils.clamp((1.02-coastDistance(p.x,p.z))/.78,0,1));c.multiplyScalar(.97+rand(p.x,p.z)*.055);colors.push(c.r,c.g,c.b);};
    const triangle=points=>{const clipped=[];for(let i=0;i<3;i++){const a=points[i],b=points[(i+1)%3];if(a.land)clipped.push(a);if(a.land!==b.land)clipped.push(cross(a,b));}if(clipped.length<3)return;for(let i=1;i<clipped.length-1;i++)[clipped[0],clipped[i],clipped[i+1]].forEach(emit);const edge=clipped.filter(p=>p.shore);if(edge.length===2)shore.push(edge);};
    const columns=Math.ceil((ISLAND_BOUNDS.maxX-ISLAND_BOUNDS.minX)/step),rows=Math.ceil((ISLAND_BOUNDS.maxZ-ISLAND_BOUNDS.minZ)/step),grid=[];
    for(let z=0;z<=rows;z++){const row=[];for(let x=0;x<=columns;x++)row.push(vertex(ISLAND_BOUNDS.minX+x/columns*(ISLAND_BOUNDS.maxX-ISLAND_BOUNDS.minX),ISLAND_BOUNDS.minZ+z/rows*(ISLAND_BOUNDS.maxZ-ISLAND_BOUNDS.minZ)));grid.push(row);}
    for(let z=0;z<rows;z++)for(let x=0;x<columns;x++){const a=grid[z][x],b=grid[z][x+1],c=grid[z+1][x+1],d=grid[z+1][x];triangle([a,c,b]);triangle([a,d,c]);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
    this.land=new THREE.Mesh(geo,material('#ffffff',{vertexColors:true}));this.land.receiveShadow=true;this.scene.add(this.land);
    const beachPositions=[];
    for(const edge of shore){const pairs=edge.map(p=>{const dx=coastDistance(p.x+.01,p.z)-coastDistance(p.x-.01,p.z),dz=coastDistance(p.x,p.z+.01)-coastDistance(p.x,p.z-.01),length=Math.hypot(dx,dz)||1;return[[p.x*CELL,groundHeight(p.x,p.z)-.008,p.z*CELL],[(p.x-dx/length*.20)*CELL,-.14,(p.z-dz/length*.20)*CELL]];});const[a,b]=pairs;for(const v of[a[0],a[1],b[0],b[0],a[1],b[1]])beachPositions.push(...v);}
    const beachGeo=new THREE.BufferGeometry();beachGeo.setAttribute('position',new THREE.Float32BufferAttribute(beachPositions,3));beachGeo.computeVertexNormals();this.scene.add(new THREE.Mesh(beachGeo,material('#c7bd8c',{side:THREE.DoubleSide})));
    const waterMat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, vertexShader: `varying vec3 p; void main(){ p=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`, fragmentShader: `varying vec3 p; uniform float uTime; void main(){ float r=length(p.xy/vec2(1.15,1.0)); float wave=sin(p.x*1.6+p.y*.8+uTime*.55)*sin(p.y*2.4-p.x*.35-uTime*.3); float streak=smoothstep(.88,1.0,wave)*.018; vec3 shallow=vec3(.09,.37,.34); vec3 deep=vec3(.045,.22,.24); vec3 c=mix(shallow,deep,smoothstep(16.,40.,r)); c+=streak; gl_FragColor=vec4(c,1.); #include <tonemapping_fragment> #include <colorspace_fragment> }`.replace(/ #include/g, '\n#include') });
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(MAP_ZOOM*4, MAP_ZOOM*4), waterMat); this.water.rotation.x = -Math.PI / 2; this.water.position.y = -.075; this.scene.add(this.water);
    // The old footpath leads from the landing to the bell, and anchors the new village.
    this.pathMaterial = material('#c7b98a');
    const stones = [];
    const pathPoints = [[0,-5],[0,6],[2,6],[2,8.1]];
    for (let segment = 0; segment < pathPoints.length - 1; segment++) {
      const [ax,az] = pathPoints[segment], [bx,bz] = pathPoints[segment+1];
      const steps = Math.ceil(Math.hypot(bx-ax,bz-az)/.3);
      for (let step = 0; step <= steps; step++) {
        const f=step/steps, x=ax+(bx-ax)*f, z=az+(bz-az)*f;
        const g=new THREE.CylinderGeometry(.29+rand(z,x)*.07,.30,.045,7);
        g.rotateY(rand(z,x+3)*3); g.scale(1,1,.78); g.translate(x*CELL,groundHeight(x,z)+.018,z*CELL);stones.push(g);
      }
    }
    for(const tile of listTiles())if(tile.kind==='path'&&tile.regionId!=='home'&&!isNeighborCompoundCell(tile.x,tile.z))for(let j=0;j<4;j++){const x=tile.x+(rand(tile.x,j)-.5)*.55,z=tile.z+(rand(tile.z,j+2)-.5)*.6;const g=new THREE.CylinderGeometry(.21,.23,.04,7);g.scale(1,1,.78);g.rotateY(rand(x,z)*TAU);g.translate(x*CELL,groundHeight(x,z)+.019,z*CELL);stones.push(g);}
    const path = new THREE.Mesh(mergeGeometries(stones), this.pathMaterial); path.receiveShadow = true; this.scene.add(path);
  }
  nature() {
    const trunkGeo = new THREE.CylinderGeometry(.07, .12, 1.2, 7); trunkGeo.translate(0, .6, 0);
    const crownGeo = new THREE.IcosahedronGeometry(.65, 1);
    const treePieces = [];
    for (const [x,y,z,s] of [[0,1.7,0,1],[-.42,1.35,.03,.73],[.43,1.38,-.1,.8],[.03,1.36,.4,.7],[.1,2.08,0,.68]]) { const g = crownGeo.clone(); g.scale(s, s * .84, s); g.translate(x,y,z); treePieces.push(g); }
    const canopyGeo = mergeGeometries(treePieces);
    const trunkMat = material('#785c3f'), canopyMat = material('#ffffff');
    const treeSites = TREE_SITES;
    this.treeSites=treeSites;
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeSites.length);
    const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, treeSites.length);
    const shades = ['#628967','#6e905e','#829860','#8e9e5a','#4e8471'];
    treeSites.forEach((t, i) => {
      this.setInstance(trunks,i,t.x * CELL,groundHeight(t.x,t.z),t.z * CELL,t.s,t.s,t.s,rand(t.x,t.z)*6);
      canopies.setMatrixAt(i,matrix); canopies.setColorAt(i,new THREE.Color(shades[Math.floor(rand(t.x,t.z,6)*shades.length)]));
      const key = `${t.tile.x},${t.tile.z}`; if (!this.decor.has(key)) this.decor.set(key,[]); this.decor.get(key).push({meshes:[trunks,canopies],index:i,matrix:matrix.clone(),treeId:t.id});
    });
    trunks.userData.treeSites=canopies.userData.treeSites=treeSites;
    this.oldTreeMeshes=[trunks,canopies];
    for (const mesh of [trunks,canopies]) { mesh.castShadow = true; mesh.receiveShadow = true; this.scene.add(mesh); }
    const rockSites = listTiles().filter(t => t.kind === 'rock'&&hasNaturalObstacle(t.x,t.z));
    const rockMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.6,0),material('#86938a'),rockSites.length * 3);
    rockSites.forEach((t,i)=>{ for(let j=0;j<3;j++) {
      const x=t.x+(rand(t.x,j)-.5)*.7, z=t.z+(rand(j,t.z)-.5)*.7, s=.35+rand(i,j)*.75;
      this.setInstance(rockMesh,i*3+j,x*CELL,groundHeight(x,z)+s*.2,z*CELL,s,s*.75,s*1.25,rand(i,j)*6);
      const key=`${t.x},${t.z}`; if(!this.decor.has(key)) this.decor.set(key,[]); this.decor.get(key).push({meshes:[rockMesh],index:i*3+j,matrix:matrix.clone()});
    }});
    rockMesh.userData.rockSites=rockSites;
    rockMesh.castShadow=true; rockMesh.receiveShadow=true; this.scene.add(rockMesh);
    const flowerSites=[];
    for(let i=0;i<3200;i++) { const x=ISLAND_BOUNDS.minX+rand(i,0)*(ISLAND_BOUNDS.maxX-ISLAND_BOUNDS.minX),z=ISLAND_BOUNDS.minZ+rand(i,1)*(ISLAND_BOUNDS.maxZ-ISLAND_BOUNDS.minZ); if(terrainAt(x,z).kind==='grass'&&Math.abs(x)>.9&&isLand(x+.7,z+.7)&&isLand(x-.7,z-.7)) flowerSites.push({x,z}); }
    const flowerGeo=new THREE.ConeGeometry(.045,.14,4); flowerGeo.rotateX(.12);
    const flowers=new THREE.InstancedMesh(flowerGeo,material('#d8d99b'),flowerSites.length);
    flowerSites.forEach((p,i)=>{this.setInstance(flowers,i,p.x*CELL,groundHeight(p.x,p.z)+.06,p.z*CELL,1,1,1,rand(i,5)*6);flowers.setColorAt(i,new THREE.Color(['#e8d89b','#c5cc7a','#d6bca4','#749558'][i%4]));}); this.scene.add(flowers);this.flowers=flowers;this.flowerCount=flowerSites.length;
    // A few distant birds belong to the world; nothing floats over the interface.
    const wingGeo = new THREE.BufferGeometry(); wingGeo.setAttribute('position',new THREE.Float32BufferAttribute([-.24,0,.02,0,.04,0,0,.04,0,.24,0,.02],3));
    for(let i=0;i<3;i++) { const bird=new THREE.LineSegments(wingGeo,new THREE.LineBasicMaterial({color:'#f2e7ce'})); this.scene.add(bird);this.birds.push(bird); }
  }
  replaceTrees(){
    for(const mesh of this.oldTreeMeshes)this.scene.remove(mesh);
    for(const [key,pieces]of this.decor){const keep=pieces.filter(p=>!p.meshes.some(m=>this.oldTreeMeshes.includes(m)));if(keep.length)this.decor.set(key,keep);else this.decor.delete(key);}
    this.stumps=new THREE.InstancedMesh(new THREE.CylinderGeometry(.12,.17,.22,7),material('#9a744a'),this.treeSites.length);
    this.stumps.userData.treeSites=this.treeSites; this.stumps.castShadow=true;this.stumps.receiveShadow=true;this.scene.add(this.stumps);
    this.seasonalTrees=[];this.seasonSignature=null;
    for(const type of ['broadleaf','cypress']){
      const template=this.templates.get(type);template.updateWorldMatrix(true,true);let source;template.traverse(n=>{if(n.isMesh)source=n;});
      const geo=source.geometry.clone().applyMatrix4(source.matrixWorld);
      const sites=this.treeSites.filter(t=>(rand(t.x,t.z,31)>.73?'cypress':'broadleaf')===type);
      const trees=new THREE.InstancedMesh(geo,source.material,sites.length);
      sites.forEach((t,i)=>{const size=t.s*(type==='broadleaf'?.83:.92);this.setInstance(trees,i,t.x*CELL,groundHeight(t.x,t.z),t.z*CELL,size,size,size,rand(t.x,t.z)*6);trees.setColorAt(i,new THREE.Color().setRGB(.90+rand(t.x,t.z,2)*.1,.92+rand(t.x,t.z,7)*.08,.87+rand(t.x,t.z,8)*.13));const key=`${t.tile.x},${t.tile.z}`;if(!this.decor.has(key))this.decor.set(key,[]);this.decor.get(key).push({meshes:[trees],index:i,matrix:matrix.clone(),treeId:t.id});});
      trees.userData.treeSites=sites; trees.castShadow=true;trees.receiveShadow=true;this.scene.add(trees);
      this.seasonalTrees.push({type,mesh:trees,originalColors:geo.attributes.color.array.slice()});
    }
  }
  syncSeasonVisuals(){
    if(!this.state||!this.land?.geometry?.attributes.color)return;
    const season=seasonInfo(this.state),festival=festivalStatus(this.state),hearth=this.state.buildings.find(b=>b.type==='hearth');
    if(this.seasonSignature!==season.id){
      this.seasonSignature=season.id;this.seasonColors=seasonPalette(season.id);
      const palette=this.seasonColors,grass=new THREE.Color(palette.grass),shade=new THREE.Color(palette.shade),sand=new THREE.Color('#d4c291'),color=new THREE.Color();
      const {position, color:colors}=this.land.geometry.attributes;
      for(let i=0;i<position.count;i++){
        const x=position.getX(i)/CELL,z=position.getZ(i)/CELL;
        color.copy(grass).lerp(shade,Math.max(0,Math.sin(x*.4+z*.7))*.35);
        color.lerp(sand,THREE.MathUtils.clamp((1.02-coastDistance(x,z))/.78,0,1)).multiplyScalar(.97+rand(x,z)*.055);
        colors.setXYZ(i,color.r,color.g,color.b);
      }
      colors.needsUpdate=true;
      for(const {type,mesh,originalColors}of this.seasonalTrees||[]){
        const colors=mesh.geometry.attributes.color,tones=(type==='cypress'?palette.evergreen:palette.foliage).map(hex=>new THREE.Color(hex));
        for(let i=0;i<colors.count;i++){
          const offset=i*3,r=originalColors[offset],g=originalColors[offset+1],b=originalColors[offset+2],tone=foliageTone(r,g,b);
          if(tone<0)colors.setXYZ(i,r,g,b);else colors.setXYZ(i,tones[tone].r,tones[tone].g,tones[tone].b);
        }
        colors.needsUpdate=true;
      }
      if(this.flowers){const tones=palette.flowers.map(hex=>new THREE.Color(hex));for(let i=0;i<this.flowerCount;i++)this.flowers.setColorAt(i,tones[i%tones.length]);this.flowers.count=Math.floor(this.flowerCount*palette.flowerDensity);this.flowers.instanceColor.needsUpdate=true;}
      this.skyLight?.color.set(palette.skyLight);this.skyLight?.groundColor.set(palette.groundLight);
    }
    if(festival.active&&hearth){
      if(!this.festivalBunting)this.createFestivalBunting();
      this.festivalBunting.visible=true;this.festivalBunting.position.set(hearth.x*CELL,groundHeight(hearth.x,hearth.z),hearth.z*CELL);
    }else if(this.festivalBunting)this.festivalBunting.visible=false;
  }
  createFestivalBunting(){
    // A small, reusable piece of scenery behind the hearth's work apron. It
    // belongs to neither collision/navigation nor the selectable-object lists.
    const group=new THREE.Group(),timber=[];
    for(const x of[-1.38,1.38]){const post=new THREE.CylinderGeometry(.025,.035,1.48,5);post.translate(x,.74,-.75);timber.push(post);}
    const points=Array.from({length:9},(_,i)=>{const t=i/8;return new THREE.Vector3(-1.38+t*2.76,1.46-Math.sin(t*Math.PI)*.17,-.75);});
    for(let i=1;i<points.length;i++){const from=points[i-1],to=points[i],direction=to.clone().sub(from),rope=new THREE.CylinderGeometry(.009,.009,direction.length(),4);rope.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().normalize()));rope.translate(...from.clone().add(to).multiplyScalar(.5).toArray());timber.push(rope);}
    const frame=new THREE.Mesh(mergeGeometries(timber),material('#a68b64'));timber.forEach(geometry=>geometry.dispose());group.add(frame);
    const vertices=[],colors=[],tones=['#d99765','#b66650','#e3c681','#789b83'].map(hex=>new THREE.Color(hex));
    for(let i=0;i<8;i++){const x=-1.2+i*(2.4/7),y=1.46-Math.sin((x+1.38)/2.76*Math.PI)*.17,color=tones[i%tones.length];vertices.push(x-.105,y,-.75,x+.105,y,-.75,x,y-.24,-.75);for(let j=0;j<3;j++)colors.push(color.r,color.g,color.b);}
    const cloth=new THREE.BufferGeometry();cloth.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));cloth.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));cloth.computeVertexNormals();
    group.add(new THREE.Mesh(cloth,material('#ffffff',{vertexColors:true,side:THREE.DoubleSide})));group.name='harvest-festival-bunting';this.festivalBunting=group;this.scene.add(group);
  }
  syncWoodland(){
    if(!this.stumps||!this.state)return;
    const signature=JSON.stringify(this.state.woodland?.trees||{});if(signature===this.woodlandSignature)return;this.woodlandSignature=signature;
    const hidden=new THREE.Matrix4().makeScale(0,0,0),growthMatrix=new THREE.Matrix4();
    for(const [key,pieces]of this.decor)for(const piece of pieces)if(piece.treeId){
      const tree=treeState(this.state,piece.treeId),size=tree.growth<0?0:tree.growth===SAPLING_SECONDS?1:.18+.82*tree.growth/SAPLING_SECONDS;
      const m=this.occupiedDecor?.has(key)||!size?hidden:growthMatrix.copy(piece.matrix).scale(new THREE.Vector3(size,size,size));
      for(const mesh of piece.meshes){mesh.setMatrixAt(piece.index,m);mesh.instanceMatrix.needsUpdate=true;}
    }
    this.treeSites.forEach((site,i)=>{const tree=treeState(this.state,site.id);if(tree.growth!==-1||this.occupiedDecor?.has(`${site.tile.x},${site.tile.z}`))this.stumps.setMatrixAt(i,hidden);else this.setInstance(this.stumps,i,site.x*CELL,groundHeight(site.x,site.z)+.11,site.z*CELL,site.s,site.s,site.s);});
    this.stumps.instanceMatrix.needsUpdate=true;this.stumps.computeBoundingSphere();
  }
  setInstance(mesh,i,x,y,z,sx,sy,sz,ry=0) { position.set(x,y,z);quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),ry);scale.set(sx,sy,sz);matrix.compose(position,quaternion,scale);mesh.setMatrixAt(i,matrix); }
  dock() {
    const pieces=[],posts=[],wood=material('#927852'),postMat=material('#655b44');
    for(let i=0;i<16;i++){const z=13.5+i*.28,y=Math.max(.20,groundHeight(2,z/CELL)+.09);const g=new THREE.BoxGeometry(1.9,.11,.25);g.translate(3.6,y,z);pieces.push(g);}
    for(let i=0;i<4;i++)for(const side of [-1,1]){const g=new THREE.CylinderGeometry(.075,.1,.95,7);g.translate(3.6+side*.83,-.03,13.7+i*1.25);posts.push(g);}
    for(const [geos,mat] of [[pieces,wood],[posts,postMat]]){const m=new THREE.Mesh(mergeGeometries(geos),mat);m.castShadow=true;m.receiveShadow=true;m.userData.landmark='landing';this.landmarks.push(m);this.scene.add(m);}
    const crates=new THREE.Group();const crate=new THREE.Mesh(new THREE.BoxGeometry(.48,.38,.44),material('#aa8250'));crate.position.set(4.12,.44,16.9);crate.castShadow=true;crates.add(crate);for(const x of[-.18,.18]){const strap=new THREE.Mesh(new THREE.BoxGeometry(.045,.4,.46),material('#6e6749'));strap.position.set(4.12+x,.44,16.9);crates.add(strap);}crates.userData.landmark='landing';this.landmarks.push(crates);this.scene.add(crates);
  }
  createPreview() {
    this.highlight=new THREE.Group();
    const geo=new THREE.RingGeometry(1.07,1.12,48);geo.rotateX(-Math.PI/2);
    this.selectionRing=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:'#f8dda0',transparent:true,opacity:.9,depthWrite:false}));this.selectionRing.visible=false;this.scene.add(this.selectionRing);
    const border=new THREE.RingGeometry((CELL-.22)/Math.SQRT2,CELL/Math.SQRT2,4,1,Math.PI/4);border.rotateX(-Math.PI/2);
    this.previewBorder=ownedCueMesh(border,'#e6efbe',1,{depthTest:false});this.previewBorder.renderOrder=11;this.highlight.add(this.previewBorder);this.highlight.visible=false;this.scene.add(this.highlight);
    const entranceGeometry=new THREE.BufferGeometry();entranceGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(21),3));entranceGeometry.setIndex([0,1,2,3,4,5,3,5,6]);
    this.entranceMark=new THREE.Mesh(entranceGeometry,cueMaterial('#fff0a5',1,{depthTest:false}));this.entranceMark.renderOrder=12;this.entranceMark.visible=false;this.scene.add(this.entranceMark);
    this.entranceLane=ownedCueMesh(cueGeometry(new Float32Array(72)),'#ffe5a0',.85,{depthTest:false});this.entranceLane.renderOrder=11;this.entranceLane.visible=false;this.scene.add(this.entranceLane);
    this.entranceLabel=this.makeCueLabel(180,51);if(this.entranceLabel){this.entranceLabel.visible=false;this.scene.add(this.entranceLabel);}
  }
  showPreview(type,tile,valid,rotation=0,{entranceLabel=true}={}) {
    if(!type||!tile){this.highlight.visible=false;this.showEntrance(this.selectedBuilding);return;}
    if(this.previewType!==type){if(this.previewMesh)this.disposePresentation(this.previewMesh);this.previewType=type;this.previewMesh=this.clone(type);this.previewMesh.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.userData.ownsMaterial=true;o.material.transparent=true;o.material.opacity=.58;o.material.depthWrite=false;o.castShadow=false;}});this.highlight.add(this.previewMesh);}
    this.highlight.visible=true;this.highlight.position.set(tile.x*CELL,groundHeight(tile.x,tile.z)+.04,tile.z*CELL);this.previewMesh.rotation.y=rotation*Math.PI/2;
    this.previewBounds ||= new THREE.Box3(); this.previewBounds.setFromObject(this.previewMesh);
    const color=valid?'#e9f5b2':'#ed8c76';this.previewBorder.material.color.set(color);this.previewMesh.traverse(o=>{if(o.isMesh)o.material.emissive?.set(valid?'#173b13':'#642018');});
    this.showEntrance({...tile,type,rotation},valid,entranceLabel);
  }
  showEntrance(building,valid=true,preview=false){
    const visible=!!building&&!!BUILDINGS[building.type];this.entranceMark.visible=visible;this.entranceLane.visible=visible;if(this.entranceLabel)this.entranceLabel.visible=visible&&preview;if(!visible)return;
    const entrance=buildingEntrance(building),fx=entrance.x-building.x,fz=entrance.z-building.z;
    const clear=this.walkable(entrance.x,entrance.z),color=valid&&clear?'#fff0a5':'#ff9b7d';
    const toWorld=([x,z])=>{const wx=building.x*CELL+fx*z+fz*x,wz=building.z*CELL+fz*z-fx*x;return[wx,groundHeight(wx/CELL,wz/CELL)+.045,wz];};
    // A broad arrow points into the authored +Z door. The framed neighboring
    // cell is the walking lane reserved by the simulation, in every rotation.
    const points=[[0,1.14],[-.53,1.76],[.53,1.76],[-.18,1.67],[.18,1.67],[.18,2.36],[-.18,2.36]],attribute=this.entranceMark.geometry.attributes.position;
    points.forEach((point,i)=>attribute.setXYZ(i,...toWorld(point)));attribute.needsUpdate=true;this.entranceMark.geometry.computeBoundingSphere();this.entranceMark.material.color.set(color);
    const vertices=[],w=.79,near=CELL-.79,far=CELL+.79,t=.055;
    for(const[x1,z1,x2,z2]of[[-w,near,w,near+t],[-w,far-t,w,far],[-w,near,-w+t,far],[w-t,near,w,far]])for(const point of[[x1,z1],[x2,z1],[x2,z2],[x1,z1],[x2,z2],[x1,z2]])vertices.push(...toWorld(point));
    this.entranceLane.geometry.attributes.position.array.set(vertices);this.entranceLane.geometry.attributes.position.needsUpdate=true;this.entranceLane.geometry.computeBoundingSphere();this.entranceLane.material.color.set(color);
    if(this.entranceLabel){this.setCueLabel(this.entranceLabel,['ENTRANCE',clear?'Keep this lane clear':'Blocked lane · rotate'],color);const p=toWorld([0,2.90]);this.entranceLabel.position.set(p[0],p[1]+.18,p[2]);this.entranceLabel.userData.preview=preview;}
  }
  select(building) { this.selectedId=building?.id;this.selectedBuilding=building;this.selectedCitizenId=null;this.selectionRing.visible=!!building;if(building)this.selectionRing.position.set(building.x*CELL,groundHeight(building.x,building.z)+.055,building.z*CELL);if(!this.highlight.visible)this.showEntrance(building); }
  showServiceArea(type,tile,level=1,{label:showLabel=true}={}){
    if(tile?.id)level=this.state?.buildings.find(b=>b.id===tile.id)?.level||level;
    const service=getBuildingSpec(type,level)?.service;
    if(!service||!tile){if(this.serviceArea)this.serviceArea.visible=false;this.serviceAreaRequest=null;return null;}
    this.serviceAreaRequest={type,tile:{id:tile.id,x:tile.x,z:tile.z},level,label:showLabel};
    const coverage=serviceReach(this.state,type,tile,level);if(!coverage)return null;
    const {homes}=coverage,signature=[type,tile.id||'preview',tile.x,tile.z,level,...homes.map(b=>`${b.id}:${b.x}:${b.z}:${b.beds}`)].join('|');
    if(this.serviceArea?.userData.signature===signature){this.serviceArea.visible=true;this.serviceArea.userData.coverage=coverage;if(this.serviceArea.userData.label)this.serviceArea.userData.label.visible=showLabel;this.updateServiceLabel();return coverage;}
    if(this.serviceArea)this.disposePresentation(this.serviceArea);
    const group=new THREE.Group(),tint={water:'#91e2df',health:'#bce191',faith:'#dbb8ee',leisure:'#f1ca80',civic:'#d9ddb5',security:'#efd09b'}[service.kind]||'#bfcda4';
    const add=(vertices,color,opacity=1,order=3)=>{if(!vertices.length)return;const mesh=ownedCueMesh(cueGeometry(vertices),color,opacity);mesh.renderOrder=order;group.add(mesh);};
    const point=(radius,angle,height=.045)=>{const x=tile.x+Math.cos(angle)*radius,z=tile.z+Math.sin(angle)*radius;return[x*CELL,groundHeight(x,z)+height,z*CELL];};
    const append=(vertices,triangle)=>{if(triangle.every(p=>isLand(p[0]/CELL,p[2]/CELL))&&isLand(triangle.reduce((s,p)=>s+p[0],0)/3/CELL,triangle.reduce((s,p)=>s+p[2],0)/3/CELL))vertices.push(...triangle.flat());};
    // Filled reach and a continuous double boundary conform to the island.
    // Geometry is batched; the number of draw calls does not grow with homes.
    const fill=[],outline=[],edge=[],segments=128,rings=Math.ceil(service.radius/.30);
    for(let ring=0;ring<rings;ring++)for(let i=0;i<segments;i++){const a=i/segments*TAU,b=(i+1)/segments*TAU,near=ring/rings*service.radius,far=(ring+1)/rings*service.radius,p=point(near,a,.026),q=point(far,a,.026),r=point(far,b,.026),s=point(near,b,.026);append(fill,[p,q,r]);if(ring)append(fill,[p,r,s]);}
    for(let i=0;i<segments;i++){const a=i/segments*TAU,b=(i+1)/segments*TAU;for(const[vertices,width,height]of[[outline,.080,.040],[edge,.036,.048]]){const p=point(service.radius-width,a,height),q=point(service.radius+width,a,height),r=point(service.radius+width,b,height),s=point(service.radius-width,b,height);append(vertices,[p,q,r]);append(vertices,[p,r,s]);}}
    add(fill,tint,.16,2);add(outline,'#244b4b',.9);add(edge,tint,1,4);
    const markerGroups=[];
    for(const inRange of[true,false]){
      const matching=homes.filter(home=>home.inRange===inRange),corners=[];
      for(const home of matching)for(const sx of[-1,1])for(const sz of[-1,1])for(const axis of[0,1]){const length=.44,width=.09,cx=home.x*CELL+sx*.90,cz=home.z*CELL+sz*.90;const x=cx-(axis===0?sx*length/2:0),z=cz-(axis===1?sz*length/2:0);const g=new THREE.BoxGeometry(axis===0?length:width,.024,axis===1?length:width);g.translate(x,groundHeight(x/CELL,z/CELL)+.055,z);corners.push(g);}
      if(corners.length){const mesh=ownedCueMesh(mergeGeometries(corners),inRange?tint:'#ebad90',1);mesh.renderOrder=4;group.add(mesh);corners.forEach(g=>g.dispose());}
      if(matching.length){const markers=this.makeCueInstances(matching.length,inRange?'check':'minus',inRange?'#327f79':'#8a5141');if(markers){markers.userData.homes=matching;group.add(markers);markerGroups.push(markers);}}
    }
    const label=this.makeCueLabel(236,65);if(label){label.visible=showLabel;const height=this.buildings.get(tile.id)?.userData.height||1.5;label.position.set(tile.x*CELL,groundHeight(tile.x,tile.z)+height+.55,tile.z*CELL);group.add(label);}
    group.userData={signature,coverage,markerGroups,label,tint};
    this.serviceArea=group;this.scene.add(group);this.updateServiceLabel();return coverage;
  }
  makeCueLabel(width,height){
    if(typeof document==='undefined')return null;
    const canvas=document.createElement('canvas');canvas.width=640;canvas.height=176;
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false,toneMapped:false}));
    sprite.center.set(.5,0);sprite.renderOrder=25;sprite.userData={canvas,cuePixels:[width,height],ownsMaterial:true,ownsTexture:true};return sprite;
  }
  setCueLabel(sprite,lines,color='#fff0a5'){
    if(!sprite)return;const signature=JSON.stringify([lines,color]);if(sprite.userData.signature===signature)return;sprite.userData.signature=signature;
    const canvas=sprite.userData.canvas,ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='rgba(24,49,47,.96)';ctx.beginPath();ctx.roundRect(3,3,634,156,22);ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=4;ctx.stroke();
    ctx.beginPath();ctx.moveTo(308,159);ctx.lineTo(320,175);ctx.lineTo(332,159);ctx.fill();
    const fit=(text,max)=>{let value=String(text);while(ctx.measureText(value).width>max&&value.length>1)value=value.slice(0,-2)+'…';return value;};
    ctx.textAlign='center';ctx.textBaseline='middle';
    lines.forEach((line,i)=>{ctx.font=`${i===0?'700':'500'} ${lines.length===3?(i===0?35:30):(i===0?44:38)}px system-ui, sans-serif`;ctx.fillStyle=i===0?(sprite.userData.titleColor||color):'#fff9e8';ctx.fillText(fit(line,594),320,lines.length===3?34+i*49:49+i*67);});
    sprite.material.map.needsUpdate=true;
  }
  makeCueInstances(count,glyph,color){
    if(typeof document==='undefined')return null;
    const canvas=document.createElement('canvas');canvas.width=canvas.height=80;const ctx=canvas.getContext('2d');
    ctx.beginPath();ctx.arc(40,40,35,0,TAU);ctx.fillStyle='#203d39';ctx.fill();ctx.beginPath();ctx.arc(40,40,30,0,TAU);ctx.fillStyle=color;ctx.fill();
    ctx.strokeStyle='#fff8df';ctx.fillStyle='#fff8df';ctx.lineWidth=5;ctx.lineJoin='round';ctx.lineCap='round';
    const path=(points,close=false)=>{ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));if(close)ctx.closePath();ctx.stroke();};
    if(glyph==='check')path([[23,40],[35,51],[56,28]]);
    else if(glyph==='minus')path([[25,40],[55,40]]);
    else if(glyph==='cross'){path([[40,24],[40,56]]);path([[24,40],[56,40]]);}
    else if(glyph==='book'){path([[40,28],[25,24],[23,50],[40,55],[56,50],[55,24],[40,28],[40,55]]);}
    else if(glyph==='leaf'){ctx.beginPath();ctx.ellipse(40,38,12,20,.65,0,TAU);ctx.stroke();path([[29,56],[48,28]]);}
    else if(glyph==='hammer'){path([[30,56],[46,31]]);path([[34,24],[55,36],[49,44],[29,31]],true);}
    else if(glyph==='axe'){path([[29,57],[47,25]]);path([[42,28],[26,26],[25,40],[36,45]],true);}
    else if(glyph==='pick'){path([[32,57],[46,29]]);path([[25,32],[39,25],[51,29],[59,42]]);}
    else if(glyph==='basket'){path([[23,34],[28,54],[53,54],[58,34]],true);path([[31,32],[35,23],[46,23],[51,32]]);}
    else if(glyph==='grain'){path([[39,57],[41,22]]);for(const y of[30,40,50]){path([[40,y],[29,y-8]]);path([[41,y-5],[52,y-13]]);}}
    else if(glyph==='mug'){path([[25,25],[25,55],[49,55],[49,25]],true);path([[49,31],[58,31],[58,46],[49,46]]);}
    else if(glyph==='cloth'){path([[24,28],[51,24],[56,52],[29,56]],true);path([[32,35],[48,33]]);path([[34,44],[50,42]]);}
    else if(glyph==='saw'){path([[21,49],[45,26],[59,37],[36,58]],true);path([[25,48],[33,47],[34,55]]);}
    else if(glyph==='spear'){path([[28,57],[49,25]]);path([[42,25],[57,18],[54,34]],true);}
    else if(glyph==='star'){path([[40,20],[45,34],[60,39],[45,44],[40,60],[35,44],[20,39],[35,34]],true);}
    else if(glyph==='coin'){ctx.beginPath();ctx.arc(40,40,17,0,TAU);ctx.stroke();path([[40,30],[40,50]]);path([[33,34],[47,34]]);}
    else{path([[24,29],[55,29],[55,53],[24,53]],true);path([[40,30],[40,52]]);}
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const mesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),cueMaterial('#ffffff',1,{map:texture,transparent:true,alphaTest:.02,depthTest:false}),count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.renderOrder=18;mesh.userData={ownsGeometry:true,ownsMaterial:true,ownsTexture:true};return mesh;
  }
  updateServiceLabel(){
    const data=this.serviceArea?.userData;if(!data)return;const c=data.coverage;
    const capacity=c.isPreview?`${Math.round(c.potentialCapacity)} beds when ready`:`${Math.round(c.allocatedBeds||0)} / ${Math.round(c.capacity)} supplied beds used`;
    this.setCueLabel(data.label,[`${c.kind.toUpperCase()} · ${c.radius}-SPACE REACH`,`${c.inRangeHomes} homes in reach · ${c.outsideHomes} outside`,capacity],data.tint);
  }
  selectCitizen(id){this.selectedCitizenId=id||null;if(id){this.selectedId=null;this.selectedBuilding=null;this.selectionRing.visible=false;this.showEntrance(null);}this.updateWorkerCues();}
  hoverCitizen(id){this.hoveredCitizenId=id||null;}
  citizenCue(id){return residentCue(this.actors.find(actor=>actor.citizen.id===id),this.state,this.cuesPaused!==false);}
  syncWorkerBadges(){
    if(typeof document==='undefined')return;
    const signature=this.actors.map(a=>`${a.root.uuid}:${a.citizen.job}`).join('|');if(signature===this.workerBadgeSignature)return;
    this.workerBadgeSignature=signature;if(this.workerBadges)this.disposePresentation(this.workerBadges);
    this.workerBadges=new THREE.Group();const jobs=new Set(this.actors.map(a=>a.citizen.job));
    for(const job of jobs){if(job==='idle')continue;const actors=this.actors.filter(a=>a.citizen.job===job),mesh=this.makeCueInstances(actors.length,JOB_GLYPHS[job]||'box',JOBS[job]?.color||'#688e80');mesh.userData.actors=actors;this.workerBadges.add(mesh);}this.scene.add(this.workerBadges);
  }
  updateWorkerCues(){
    if(!this.camera||!this.height)return;
    const actor=this.actors.find(a=>a.citizen.id===this.hoveredCitizenId)||this.actors.find(a=>a.citizen.id===this.selectedCitizenId);
    if(actor&&!this.workerLabel){this.workerLabel=this.makeCueLabel(252,69);if(this.workerLabel){this.workerLabel.userData.titleColor='#fff0cc';this.scene.add(this.workerLabel);}this.workerRing=this.frontierGroundRing(.35,'#fff0a5',.055);this.workerRing.material.depthTest=false;this.workerRing.renderOrder=14;this.scene.add(this.workerRing);}
    if(this.workerLabel){this.workerLabel.visible=!!actor;if(actor){const cue=this.citizenCue(actor.citizen.id);this.setCueLabel(this.workerLabel,[`${cue.name} · ${cue.job}`,cue.action,cue.paused?'PAUSED · resume time to continue':cue.workplace||'A neighbor of your village'],cue.color);this.workerLabel.position.copy(actor.root.position);this.workerLabel.position.y+=1.03;}}
    if(this.workerRing){this.workerRing.visible=!!actor;if(actor)this.workerRing.position.set(actor.root.position.x,groundHeight(actor.root.position.x/CELL,actor.root.position.z/CELL)+.07,actor.root.position.z);}
    if(!this.workerBadges)return;
    this.workerBadges.visible=this.zoom<=38&&!this.highlight?.visible&&!this.serviceArea?.visible;
    if(!this.workerBadges.visible)return;
    let visible=0;const size=this.zoom/this.height*18;
    for(const mesh of this.workerBadges.children){let count=0;for(const a of mesh.userData.actors){if(visible>=28||a===actor)continue;position.copy(a.root.position);position.y+=.94;const screen=position.clone().project(this.camera);if(Math.abs(screen.x)>1.03||Math.abs(screen.y)>1.03)continue;matrix.compose(position,this.camera.quaternion,scale.setScalar(size));mesh.setMatrixAt(count++,matrix);visible++;}mesh.count=count;mesh.instanceMatrix.needsUpdate=true;}
  }
  updateWorldCues(){
    const unitsPerPixel=this.zoom/this.height;
    for(const label of[this.entranceLabel,this.serviceArea?.userData.label,this.workerLabel,...(this.frontierSelectionGroup?.children.filter(child=>child.userData.cuePixels)||[])])if(label?.visible){const[w,h]=label.userData.cuePixels;label.scale.set(w*unitsPerPixel,h*unitsPerPixel,1);}
    if(this.serviceArea?.visible)for(const mesh of this.serviceArea.userData.markerGroups){mesh.userData.homes.forEach((home,i)=>{const height=this.buildings.get(home.id)?.userData.height||1.6;position.set(home.x*CELL,groundHeight(home.x,home.z)+height+.23,home.z*CELL);matrix.compose(position,this.camera.quaternion,scale.setScalar(24*unitsPerPixel));mesh.setMatrixAt(i,matrix);});mesh.instanceMatrix.needsUpdate=true;}
  }
  createPressureBoat(){
    const ship=new THREE.Group(),hull=this.clone('boat');
    hull.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.color.set('#b09b70');o.userData.ownsMaterial=true;}});ship.add(hull);
    const mast=new THREE.Mesh(new THREE.CylinderGeometry(.027,.04,1.67,7),material('#65583a'));mast.position.set(0,1.08,-.09);mast.castShadow=true;ship.add(mast);
    const vertices=[],indices=[],rows=4,columns=4;
    for(let y=0;y<=rows;y++)for(let x=0;x<=columns;x++){const u=x/columns,v=y/rows;vertices.push((u-.5)*1.06*(.78+v*.22),.69+v*1.04,-.08+Math.sin(u*Math.PI)*Math.sin(v*Math.PI)*.20);if(x<columns&&y<rows){const n=y*(columns+1)+x;indices.push(n,n+1,n+columns+1,n+1,n+columns+2,n+columns+1);}}
    const cloth=new THREE.BufferGeometry();cloth.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));cloth.setIndex(indices);cloth.computeVertexNormals();
    const sail=new THREE.Mesh(cloth,material('#a77837',{side:THREE.DoubleSide}));sail.castShadow=true;ship.add(sail);
    const boom=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,1.19,7),material('#65583a'));boom.rotation.z=Math.PI/2;boom.position.set(0,1.73,-.08);ship.add(boom);
    for(const x of[-.16,.16]){const cargo=new THREE.Mesh(new THREE.BoxGeometry(.22,.23,.27),material('#6c654a'));cargo.position.set(x,.35,-.49);cargo.castShadow=true;ship.add(cargo);}
    ship.scale.setScalar(1.35);ship.visible=false;ship.userData.pressure=true;this.scene.add(ship);this.pressureBoat=ship;
    const flag=new THREE.Group(),post=new THREE.Mesh(new THREE.CylinderGeometry(.035,.05,1.56,7),material('#76664b'));post.position.y=.78;post.castShadow=true;flag.add(post);
    const pennantGeo=new THREE.BufferGeometry();pennantGeo.setAttribute('position',new THREE.Float32BufferAttribute([0,1.46,0,.53,1.25,.035,0,1.05,0],3));pennantGeo.computeVertexNormals();
    const pennant=new THREE.Mesh(pennantGeo,material('#b5793f',{side:THREE.DoubleSide}));flag.add(pennant);flag.position.set(4.77,Math.max(.2,groundHeight(4.77/CELL,13.6/CELL)),13.6);flag.visible=false;this.scene.add(flag);this.pressureFlag=flag;
    const angle=.72,direction={x:Math.cos(angle),z:Math.sin(angle)};let lo=0,hi=18;for(let i=0;i<22;i++){const mid=(lo+hi)/2;if(isLand(direction.x*mid,direction.z*mid))lo=mid;else hi=mid;}this.pressureCourse={...direction,coast:hi};
  }
  updatePressure(){
    const active=this.state?.pressure?.active;if(!active){if(this.pressureBoat)this.pressureBoat.visible=false;if(this.pressureFlag)this.pressureFlag.visible=false;return;}
    if(!this.pressureBoat)this.createPressureBoat();
    const course=this.pressureCourse,progress=THREE.MathUtils.clamp((this.state.day-active.announcedDay+(this.state.time||0)/90)/Math.max(1,active.deadline-active.announcedDay),0,1);
    let radius=course.coast+1.55+(1-progress)*3.5;
    // Keep the whole hull offshore, including its bow at the deadline.
    while(isLand(course.x*(radius-1),course.z*(radius-1)))radius+=.2;
    this.pressureBoat.position.set(course.x*radius*CELL,-.105+(this.reduced?0:Math.sin(this.clock*1.1)*.035),course.z*radius*CELL);
    this.pressureBoat.rotation.set(0,Math.atan2(-course.x,-course.z),this.reduced?0:Math.sin(this.clock*.7)*.018);
    this.pressureBoat.visible=true;this.pressureBoat.userData.approach=progress;this.pressureBoat.userData.incident=active.id;this.pressureFlag.visible=true;
  }
  disposePresentation(root){
    root.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownsGeometry)o.geometry?.dispose();if(o.userData.ownsTexture)o.material?.map?.dispose();if(o.userData.ownsMaterial)o.material?.dispose();});
    root.removeFromParent();
  }
  makeBuilding(b){
    const root=new THREE.Group(),model=this.clone(b.type,b.level||1),center=groundHeight(b.x,b.z);
    const corners=[[-.44,-.44],[-.44,.44],[.44,-.44],[.44,.44]].map(([x,z])=>groundHeight(b.x+x,b.z+z));
    const top=Math.max(center,...corners),bottom=Math.min(center,...corners)-.07,depth=top-bottom;
    model.position.y=top-center;
    if(b.level>1&&b.type!=='cottage')model.scale.y=1+(b.level-1)*.11;
    root.add(model);
    const active=b.status&&b.status!=='ready';
    const bounds=new THREE.Box3().setFromObject(model),height=bounds.max.y;
    const plane=new THREE.Plane(new THREE.Vector3(0,-1,0),top);
    if(active&&b.constructionKind!=='upgrade')model.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.clippingPlanes=[plane];o.material.clipShadows=true;o.userData.ownsMaterial=true;}});
    if(b.type==='bell'&&!b.restored)model.traverse(o=>{if(o.isMesh){if(!o.userData.ownsMaterial)o.material=o.material.clone();o.material.color.lerp(new THREE.Color('#7e8573'),.45);o.userData.ownsMaterial=true;}});
    let scaffold;
    if(active){scaffold=this.clone('construction');scaffold.position.y=top-center;root.add(scaffold);}
    if((depth>.1||active)&&b.type!=='hearth'){
      const foundation=new THREE.Mesh(new THREE.BoxGeometry(1.51,Math.max(.1,depth),1.49),material('#a8aa8d'));
      foundation.position.y=(top+bottom)/2-center;foundation.castShadow=true;foundation.receiveShadow=true;foundation.userData.ownsGeometry=true;foundation.userData.ownsMaterial=true;root.add(foundation);
    }
    if(b.level>1){
      const plaque=new THREE.Mesh(new THREE.BoxGeometry(.28,.12,.045),material(b.level===3?'#c6963c':'#658b83'));
      plaque.position.set(.36,top-center+.59,.84);plaque.userData.ownsGeometry=true;plaque.userData.ownsMaterial=true;root.add(plaque);
    }
    root.position.set(b.x*CELL,center,b.z*CELL);root.rotation.y=(b.rotation||0)*Math.PI/2;
    root.userData={building:b,model,scaffold,plane,height,top,signature:buildingPresentation(b)};
    this.scene.add(root);return root;
  }
  frontierWallShape(f){
    const neighbors=(this.state?.frontier?.fortifications||[]).filter(n=>n.id!==f.id&&n.status!=='ruined'&&['wall','gate','tower'].includes(n.type)&&Math.abs(n.x-f.x)+Math.abs(n.z-f.z)===1);
    const directions=neighbors.map(n=>({x:n.x-f.x,z:n.z-f.z}));
    if(directions.length===1)return{type:'wall_end',yaw:Math.atan2(-directions[0].z,directions[0].x)};
    if(directions.length===2&&(directions[0].x+directions[1].x!==0||directions[0].z+directions[1].z!==0)){for(let q=0;q<4;q++){const a=q*Math.PI/2,x=Math.round(Math.cos(a)),z=Math.round(-Math.sin(a));if(directions.some(d=>d.x===x&&d.z===z)&&directions.some(d=>d.x===z&&d.z===-x))return{type:'wall_corner',yaw:a};}}
    if(directions.length>=3)return{type:'wall',yaw:0,cross:true};
    return{type:'wall',yaw:directions.length?directions[0].x?0:Math.PI/2:(f.rotation||0)*Math.PI/2};
  }
  makeFortification(f){
    const root=new THREE.Group(),shape=f.type==='wall'?this.frontierWallShape(f):{type:f.type,yaw:(f.rotation||0)*Math.PI/2};
    const model=this.clone(f.status==='ruined'?'wall_rubble':shape.type);model.rotation.y=shape.yaw;root.add(model);
    if(shape.cross&&f.status!=='ruined'){const cross=this.clone('wall');cross.rotation.y=Math.PI/2;root.add(cross);}
    const top=groundHeight(f.x,f.z),plane=new THREE.Plane(new THREE.Vector3(0,-1,0),top),height=new THREE.Box3().setFromObject(root).max.y;
    root.traverse(o=>{if(o.name.endsWith('_gate_left'))o.rotation.y=f.open?-Math.PI/2:0;if(o.name.endsWith('_gate_right'))o.rotation.y=f.open?Math.PI/2:0;if(o.isMesh){o.material=o.material.clone();o.userData.ownsMaterial=true;if(f.status==='building'){o.material.clippingPlanes=[plane];o.material.clipShadows=true;}}});
    let scaffold;if(f.status==='building'){scaffold=this.clone('construction');scaffold.scale.set(.94,Math.min(1,height/1.5),.70);root.add(scaffold);}
    root.position.set(f.x*CELL,top,f.z*CELL);root.userData={fortification:f,model,plane,height,scaffold};this.scene.add(root);return root;
  }
  makeTroop(unit){
    const civil=['engineer','envoy','explorer','restorer'].includes(unit.kind),type=civil?'villager':unit.kind==='archer'&&unit.faction!=='player'?'enemy_archer':['spearman','archer','raider'].includes(unit.kind)?unit.kind:'raider';
    const root=this.clone(type),limbs={},weapons={};root.rotation.order='YXZ';root.position.set(unit.x*CELL,groundHeight(unit.x,unit.z),unit.z*CELL);root.rotation.y=unit.yaw||0;
    root.traverse(o=>{for(const name of['left_arm','right_arm','left_leg','right_leg'])if(o.name===name||o.name.endsWith('_'+name))limbs[name]=o;for(const side of['left','right'])if(o.name.endsWith('_'+side+'_weapon'))weapons[side]=o;if(o.isMesh){o.material=o.material.clone();o.userData.ownsMaterial=true;}});
    if(civil){this.colorCitizen(root,unit.kind);if(unit.kind==='explorer'){const pack=this.clone('cargo_grain');pack.scale.setScalar(.60);pack.position.set(0,.26,-.16);root.add(pack);}const prop=this.clone(['engineer','restorer'].includes(unit.kind)?'tool_hammer':'tool_book');prop.position.set(.04,-.17,.04);prop.rotation.x=['engineer','restorer'].includes(unit.kind)?Math.PI/2:0;limbs[['engineer','restorer'].includes(unit.kind)?'right_arm':'left_arm']?.add(prop);}
    root.userData.unit=unit;this.scene.add(root);return{root,limbs,weapons,unit,phase:0,lastX:root.position.x,lastZ:root.position.z};
  }
  syncFrontier(){
    this.fortifications??=new Map();this.troops??=new Map();this.neighborModels??=new Map();this.projectileModels??=new Map();this.frontierSelection??={unitIds:[]};
    if(!this.templates.has('wall'))return;
    const frontier=this.state?.frontier,forts=frontier?.fortifications||[],units=frontier?.units||[];
    const present=new Set(forts.filter(f=>f.faction==='player'||!f.faction).map(f=>f.id));
    for(const[id,root]of this.fortifications)if(!present.has(id)){this.disposePresentation(root);this.fortifications.delete(id);}
    for(const f of forts){if(f.faction&&f.faction!=='player')continue;const shape=f.type==='wall'?this.frontierWallShape(f):null,signature=JSON.stringify([f.type,f.status,f.x,f.z,f.rotation,shape]);let root=this.fortifications.get(f.id);if(root&&root.userData.signature!==signature){this.disposePresentation(root);root=null;}if(!root){root=this.makeFortification(f);root.userData.signature=signature;this.fortifications.set(f.id,root);}root.userData.fortification=f;}
    for(const spec of ISLAND_NEIGHBORS){
      let root=this.neighborModels.get(spec.id);const neighbor=frontier?.neighbors?.find(n=>n.id===spec.id)||{...spec,discovered:false},fort=forts.find(f=>f.faction===spec.id&&f.type==='outpost'),ruined=fort?.status==='ruined';
      if(root&&root.userData.ruined!==ruined){this.disposePresentation(root);root=null;}
      if(!root){
        root=new THREE.Group();const model=this.clone(ruined?'wall_rubble':{reedbank:'neighbor_harbor',stonehaven:'neighbor_fort',blackthorn:'neighbor_camp'}[spec.id]),heights=[[-1.39,-1.39],[-1.39,1.39],[1.39,-1.39],[1.39,1.39],[0,0]].map(([x,z])=>groundHeight(spec.x+x,spec.z+z)),top=Math.max(...heights)+.045,bottom=Math.min(...heights)-.08;
        root.add(model);root.position.set(spec.x*CELL,top,spec.z*CELL);const foundation=new THREE.Mesh(new THREE.BoxGeometry(4.98,top-bottom,4.98),material('#9eaa89'));foundation.position.y=-(top-bottom)/2;foundation.userData.ownsGeometry=true;root.add(foundation);
        root.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.userData.ownsMaterial=true;o.receiveShadow=true;}});this.scene.add(root);this.neighborModels.set(spec.id,root);
      }
      root.userData={neighbor,fortification:fort,ruined};
    }
    const live=new Set(units.filter(u=>u.status!=='released').map(u=>u.id));for(const[id,a]of this.troops)if(!live.has(id)){this.disposePresentation(a.root);this.troops.delete(id);}
    for(const unit of units){if(unit.status==='released')continue;let actor=this.troops.get(unit.id);if(actor&&actor.unit.kind!==unit.kind){this.disposePresentation(actor.root);actor=null;}if(!actor){actor=this.makeTroop(unit);this.troops.set(unit.id,actor);}actor.unit=unit;actor.root.userData.unit=unit;}
    this.selectFrontier(this.frontierSelection);
  }
  frontierGroundRing(radius,color,thickness=.035){
    const geometry=new THREE.RingGeometry(radius-thickness,radius,48);geometry.rotateX(-Math.PI/2);const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.85,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2}));mesh.userData.ownsGeometry=true;mesh.userData.ownsMaterial=true;return mesh;
  }
  selectFrontier(selection={}){
    this.frontierSelection={unitIds:[...(selection.unitIds||[])],fortId:selection.fortId||null,neighborId:selection.neighborId||null,regionId:selection.regionId||null};
    const chosen=new Set(this.frontierSelection.unitIds),units=(this.state?.frontier?.units||[]).filter(u=>chosen.has(u.id)&&!['dead','released'].includes(u.status));
    const signature=JSON.stringify([this.frontierSelection,units.map(u=>[u.id,u.order])]);if(this.frontierSelectionGroup?.userData.signature===signature)return;
    if(this.frontierSelectionGroup)this.disposePresentation(this.frontierSelectionGroup);
    const group=new THREE.Group();group.userData.signature=signature;
    for(const id of this.frontierSelection.unitIds){const ring=this.frontierGroundRing(.40,'#efda95',.045);ring.userData.unitId=id;group.add(ring);}
    const defended=new Set();
    for(const unit of units){
      const order=unit.order;
      if(!['move','retreat','defend'].includes(order?.type)||!Number.isFinite(order.x)||!Number.isFinite(order.z))continue;
      const ring=this.frontierGroundRing(.30,order.type==='defend'?'#9cd3be':'#efda95',.04);
      ring.position.set(order.x*CELL,groundHeight(order.x,order.z)+.055,order.z*CELL);group.add(ring);
      if(order.type!=='defend'||!order.anchor)continue;
      const anchor=order.anchor,key=`${anchor.x},${anchor.z}`;if(defended.has(key))continue;defended.add(key);
      const points=Array.from({length:65},(_,i)=>{const angle=i/64*TAU,x=anchor.x+Math.cos(angle)*DEFEND_RADIUS,z=anchor.z+Math.sin(angle)*DEFEND_RADIUS;return new THREE.Vector3(x*CELL,groundHeight(x,z)+.07,z*CELL);});
      const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:'#9cd3be',transparent:true,opacity:.75,depthWrite:false}));
      line.userData.ownsGeometry=line.userData.ownsMaterial=true;group.add(line);
      const label=this.makeCueLabel(192,48);if(label){this.setCueLabel(label,['DEFEND TOWN',`${DEFEND_RADIUS}-tile home area`],'#9cd3be');label.position.set(anchor.x*CELL,groundHeight(anchor.x,anchor.z)+.8,anchor.z*CELL);group.add(label);}
    }
    const fort=(this.state?.frontier?.fortifications||[]).find(f=>f.id===selection.fortId),neighbor=ISLAND_NEIGHBORS.find(n=>n.id===selection.neighborId),region=ISLAND_REGIONS.find(r=>r.id===selection.regionId);
    for(const[item,radius,color]of[[fort,1.15,'#eadba7'],[neighbor,2.10,'#e0c184']])if(item){const ring=this.frontierGroundRing(radius,color);ring.position.set(item.x*CELL,groundHeight(item.x,item.z)+.055,item.z*CELL);group.add(ring);}
    if(region){const points=[];for(let i=0;i<150;i++){const angle=i/150*TAU,x=region.x+Math.cos(angle)*region.radius,z=region.z+Math.sin(angle)*region.radius;if(!isLand(x,z)||terrainAt(x,z).regionId!==region.id)continue;const g=new THREE.CylinderGeometry(.07,.095,.035,5);g.translate(x*CELL,groundHeight(x,z)+.025,z*CELL);points.push(g);}if(points.length){const mesh=new THREE.Mesh(mergeGeometries(points),material('#dbc593'));mesh.userData.ownsGeometry=true;mesh.userData.ownsMaterial=true;group.add(mesh);points.forEach(g=>g.dispose());}}
    this.frontierSelectionGroup=group;this.scene.add(group);
  }
  showFrontierPreview(type,tile,valid,rotation=0){this.showFrontierCommand(type&&tile?{kind:'fortification',type,rotation,cells:[tile],valid}:null);}
  showOrderPreview(unitIds,point,path=[]){this.showFrontierCommand(point?{kind:'move',unitIds,target:point,path,valid:true}:null);}
  showFrontierCommand(preview){
    const signature=JSON.stringify(preview);if(this.frontierCommandGroup?.userData.signature===signature)return;
    if(this.frontierCommandGroup)this.disposePresentation(this.frontierCommandGroup);this.frontierCommandGroup=null;if(!preview||!this.templates.has('wall'))return;
    const group=new THREE.Group(),valid=preview.valid!==false,color=valid?'#d9edb3':'#df886e';group.userData.signature=signature;
    if(preview.kind==='fortification'||preview.kind==='wall-line'){
      let cells=preview.cells||[];if(!cells.length&&preview.end)cells=[preview.end];if(!cells.length&&preview.target)cells=[preview.target];
      for(const cell of cells){const root=this.clone(preview.type||'wall');root.position.set(cell.x*CELL,groundHeight(cell.x,cell.z)+.035,cell.z*CELL);root.rotation.y=(cell.rotation??preview.rotation??0)*Math.PI/2;root.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.userData.ownsMaterial=true;o.material.transparent=true;o.material.opacity=.48;o.material.depthWrite=false;o.material.emissive?.set(valid?'#244414':'#681f15');o.castShadow=false;}});group.add(root);const ring=this.frontierGroundRing(.94,color,.045);ring.position.copy(root.position);ring.position.y+=.025;group.add(ring);}
    }else{
      const target=preview.target||preview.end;if(target){const ring=this.frontierGroundRing(preview.kind==='attack'?.52:.36,preview.kind==='attack'?'#d98c6d':color,.06);ring.position.set(target.x*CELL,groundHeight(target.x,target.z)+.055,target.z*CELL);group.add(ring);}
      const chosen=(preview.unitIds||this.frontierSelection.unitIds||[]).slice(0,6);
      const paths=preview.path?.length?[preview.path]:chosen.map(id=>{const unit=this.troops.get(id)?.unit;if(!unit)return[];if(!target)return unit.path||[];const end=this.walkable(target.x,target.z)?target:this.nearestWalkable(target.x,target.z);return frontierPath(this.state,unit,end,{bounds:ISLAND_BOUNDS,isLand,isWalkable:(x,z)=>this.walkable(x,z)});});
      for(const path of paths){const pieces=[];for(const p of path){if(!isLand(p.x,p.z))continue;const g=new THREE.CylinderGeometry(.08,.08,.02,5);g.translate(p.x*CELL,groundHeight(p.x,p.z)+.045,p.z*CELL);pieces.push(g);}if(pieces.length){const mesh=new THREE.Mesh(mergeGeometries(pieces),material(color));mesh.userData.ownsGeometry=true;mesh.userData.ownsMaterial=true;group.add(mesh);pieces.forEach(g=>g.dispose());}}
    }
    this.frontierCommandGroup=group;this.scene.add(group);
  }
  // Public camera coordinates are grid cells, consistently with simulation orders.
  focusWorld(x,z,zoom=16){this.pan.set(x*CELL,0,z*CELL);this.targetZoom=THREE.MathUtils.clamp(zoom,10,MAP_ZOOM);}
  focusDiscovery(id){const spec=DISCOVERIES.find(d=>d.id===id);if(!spec)return;this.focusWorld(spec.x,spec.z,10);const approach=[[0,1],[1,0],[0,-1],[-1,0]].find(([dx,dz])=>!hasNaturalObstacle(spec.x+dx,spec.z+dz))||[1,1];let angle=Math.atan2(approach[0],approach[1])+.24;while(angle-this.azimuth>Math.PI)angle-=TAU;while(angle-this.azimuth< -Math.PI)angle+=TAU;this.targetAzimuth=angle;}
  focusRegion(id){const region=ISLAND_REGIONS.find(r=>r.id===id);if(region)this.focusWorld(region.x,region.z,region.radius*CELL*2.3);}
  focusIsland(){this.focusWorld((ISLAND_BOUNDS.minX+ISLAND_BOUNDS.maxX)/2,(ISLAND_BOUNDS.minZ+ISLAND_BOUNDS.maxZ)/2,Math.max(MAP_WIDTH,MAP_DEPTH)*.86);}
  makeProjectile(){
    const root=new THREE.Group(),shaft=new THREE.Mesh(new THREE.CylinderGeometry(.009,.009,.48,5),material('#7a593c'));shaft.rotation.x=Math.PI/2;root.add(shaft);
    const tip=new THREE.Mesh(new THREE.ConeGeometry(.024,.09,4),material('#b3c1ba'));tip.rotation.x=Math.PI/2;tip.position.z=.285;root.add(tip);
    const feather=new THREE.Mesh(new THREE.BoxGeometry(.09,.018,.12),material('#e7ddbd'));feather.position.z=-.19;root.add(feather);root.traverse(o=>{if(o.isMesh){o.userData.ownsGeometry=true;o.userData.ownsMaterial=true;}});this.scene.add(root);return root;
  }
  updateFrontier(dt,playing=true){
    const frontier=this.state?.frontier;if(!frontier)return;const time=(frontier.clock||0)+(frontier.subsecond||0);
    for(const root of this.fortifications.values()){
      const f=root.userData.fortification;if(root.userData.soundOpen!==undefined&&root.userData.soundOpen!==f.open&&f.type==='gate')this.emitSound('gate',root.position,.8);root.userData.soundOpen=f.open;if(f.status==='building'){const ratio=THREE.MathUtils.clamp((f.progress||0)/Math.max(1,f.work||1),.03,1);root.userData.plane.constant=root.position.y+root.userData.height*ratio;}
      root.traverse(o=>{if(o.name.endsWith('_gate_left'))o.rotation.y+=((f.open?-Math.PI/2:0)-o.rotation.y)*Math.min(1,dt*8);if(o.name.endsWith('_gate_right'))o.rotation.y+=((f.open?Math.PI/2:0)-o.rotation.y)*Math.min(1,dt*8);if(o.isMesh&&o.userData.ownsMaterial)o.material.emissive?.setRGB(f.damageAt!=null&&time-f.damageAt<.25?.18:0,0,0);});
    }
    for(const root of this.neighborModels.values()){const fort=root.userData.fortification;root.traverse(o=>{if(o.isMesh&&o.userData.ownsMaterial)o.material.emissive?.setRGB(fort?.damageAt!=null&&time-fort.damageAt<.25?.15:0,0,0);});}
    for(const actor of this.troops.values()){
      const {root,unit:u,limbs}=actor,p=root.position,dead=u.status==='dead',age=time-(u.deathAt??time);root.visible=!dead||age<4;
      if(!root.visible)continue;
      const tx=u.x*CELL,tz=u.z*CELL,distance=Math.hypot(tx-p.x,tz-p.z),blend=!playing||distance>3?1:Math.min(1,dt*14),oldX=p.x,oldZ=p.z;p.x+=(tx-p.x)*blend;p.z+=(tz-p.z)*blend;const moved=Math.hypot(p.x-oldX,p.z-oldZ);const priorPhase=actor.phase;actor.phase+=moved*10;if(playing&&moved<.8&&Math.floor(priorPhase/Math.PI)!==Math.floor(actor.phase/Math.PI))this.emitSound('step',p,.4);
      let yaw=(u.yaw||0)-root.rotation.y;while(yaw>Math.PI)yaw-=TAU;while(yaw<-Math.PI)yaw+=TAU;root.rotation.y+=yaw*Math.min(1,dt*12);
      const gait=moved>.0004?Math.sin(actor.phase)*.51:0,attackAge=u.attackAt==null?Infinity:time-u.attackAt,attacking=!dead&&attackAge>=0&&attackAge<.62,archer=u.kind==='archer',wave=Math.sin(Math.min(1,attackAge/.5)*Math.PI);
      let right=-gait*.7,left=gait*.7;if(attacking){if(archer){left=-Math.PI/2;right=-1.05+wave*.6;}else if(u.kind==='spearman'){right=-Math.PI/2+wave*.24;left=-.20;}else{right=-2.15+wave*2.1;left=-.23;}}
      if(u.kind==='engineer'&&u.order?.type==='build'&&!u.path?.length){right=-1.1+Math.sin(time*4.5)*.65;left=-.25;}
      if(u.kind==='envoy'||u.kind==='explorer')left=-.7;
      if(isFieldworker(u)&&u.missionStage==='working'&&u.status==='active'){right=u.kind==='restorer'?-1.1+Math.sin(time*4.5)*.65:-.9+Math.sin(time*2)*.12;root.rotation.x=.05;}
      if(playing){if(u.attackAt!==null&&u.attackAt!==actor.lastAttack&&time-u.attackAt<.7)this.emitSound(archer?'bow':'impact',p,.9);if(u.damageAt!==null&&u.damageAt!==actor.lastDamage&&time-u.damageAt<.7)this.emitSound('impact',p,.6);const strike=Math.floor((time*4.5-Math.PI/2)/TAU);if(strike!==actor.lastStrike&&((u.kind==='engineer'&&u.order?.type==='build'&&!u.path.length)||(u.kind==='restorer'&&u.missionStage==='working')))this.emitSound('hammer',p,.7);actor.lastStrike=strike;}actor.lastAttack=u.attackAt;actor.lastDamage=u.damageAt;
      if(limbs.right_arm){limbs.right_arm.rotation.x=right;limbs.right_arm.rotation.z=attacking&&archer?-.72:0;}if(limbs.left_arm)limbs.left_arm.rotation.x=left;if(limbs.left_leg)limbs.left_leg.rotation.x=gait;if(limbs.right_leg)limbs.right_leg.rotation.x=-gait;
      if(actor.weapons.left)actor.weapons.left.rotation.x=attacking?-left:0;
      if(actor.weapons.right)actor.weapons.right.rotation.x=attacking?(u.kind==='spearman'?Math.PI/2-right:1.05*wave*wave-right):0;
      root.rotation.z=dead?Math.min(Math.PI/2,Math.max(0,age)*3):u.status==='wounded'?.13:0;root.rotation.x=attacking&&!archer?.07*wave:0;
      p.y=groundHeight(p.x/CELL,p.z/CELL)+(dead?.11:moved>.0004?Math.abs(Math.sin(actor.phase))*.016:0);
      root.traverse(o=>{if(o.isMesh&&o.userData.ownsMaterial)o.material.emissive?.setRGB(u.damageAt!=null&&time-u.damageAt<.22?.26:0,0,0);});root.userData.motion={moving:moved>.0004,attacking,attackAge,fieldwork:isFieldworker(u)?u.missionStage:null};
    }
    if(this.frontierSelectionGroup)for(const ring of this.frontierSelectionGroup.children)if(ring.userData.unitId){const a=this.troops.get(ring.userData.unitId);ring.visible=!!a&&a.root.visible&&a.unit.status!=='dead';if(a)ring.position.set(a.root.position.x,groundHeight(a.root.position.x/CELL,a.root.position.z/CELL)+.047,a.root.position.z);}
    const projectiles=frontier.projectiles||[],ids=new Set(projectiles.map(p=>p.id));for(const[id,root]of this.projectileModels)if(!ids.has(id)){this.disposePresentation(root);this.projectileModels.delete(id);}
    for(const projectile of projectiles){let root=this.projectileModels.get(projectile.id);if(!root){root=this.makeProjectile();this.projectileModels.set(projectile.id,root);}const f=THREE.MathUtils.clamp((time-projectile.startAt)/Math.max(.01,projectile.hitAt-projectile.startAt),0,1),start=projectile.from,end=projectile.to,tower=(frontier.fortifications||[]).find(v=>v.type==='tower'&&Math.hypot(v.x-start.x,v.z-start.z)<.2),y0=groundHeight(start.x,start.z)+(tower?1.9:.68),y1=groundHeight(end.x,end.z)+.48,arc=.5+Math.hypot(end.x-start.x,end.z-start.z)*.07;
      root.position.set(THREE.MathUtils.lerp(start.x,end.x,f)*CELL,THREE.MathUtils.lerp(y0,y1,f)+Math.sin(f*Math.PI)*arc,THREE.MathUtils.lerp(start.z,end.z,f)*CELL);root.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3((end.x-start.x)*CELL,y1-y0+Math.cos(f*Math.PI)*Math.PI*arc,(end.z-start.z)*CELL).normalize());root.visible=f<1;
    }
  }
  sync(state) {
    if(this.state&&this.state!==state){
      // Separate local towns deliberately reuse citizen/building IDs. A newly
      // restored snapshot must never inherit another town's visual routes.
      for(const actor of this.actors)this.disposePresentation(actor.root);
      this.actors=[];this.layoutSignature=null;this.publicSpots=null;
      this.selectedId=this.selectedBuilding=this.selectedCitizenId=this.hoveredCitizenId=null;
      this.serviceAreaRequest=null;this.frontierSelection={unitIds:[]};
      for(const overlay of[this.highlight,this.selectionRing,this.entranceMark,this.entranceLane,this.entranceLabel,this.serviceArea,this.workerLabel,this.workerRing])if(overlay)overlay.visible=false;
      this.showFrontierCommand(null);
    }
    this.state=state;
    this.syncFrontier();this.syncDiscoveries();
    const layout=state.buildings.map(b=>`${b.id}:${b.x}:${b.z}:${b.rotation||0}`).join('|')+';'+(state.frontier?.fortifications||[]).map(f=>`${f.id}:${f.x}:${f.z}:${f.type}:${f.status}:${f.open}:${f.rotation}`).join('|');
    const changed=layout!==this.layoutSignature;this.layoutSignature=layout;
    if(changed)this.publicSpots=null;
    const present=new Set(state.buildings.map(b=>b.id));
    for(const [id,o] of this.buildings)if(!present.has(id)){this.disposePresentation(o);this.buildings.delete(id);}
    for(const b of state.buildings){
      let o=this.buildings.get(b.id);
      const signature=buildingPresentation(b);
      if(o&&o.userData.signature!==signature){this.disposePresentation(o);this.buildings.delete(b.id);o=null;}
      if(!o){o=this.makeBuilding(b);this.buildings.set(b.id,o);}
      o.userData.building=b;
    }
    if(changed){
      const occupied=woodlandOccupancy(state);
      this.occupiedDecor=occupied; this.woodlandSignature=null;
      for(const [key,pieces]of this.decor)for(const p of pieces)if(!p.treeId){const m=occupied.has(key)?new THREE.Matrix4().makeScale(0,0,0):p.matrix;for(const mesh of p.meshes){mesh.setMatrixAt(p.index,m);mesh.instanceMatrix.needsUpdate=true;}}
      this.updatePaths();
    }
    this.syncWoodland();this.syncSeasonVisuals();
    const reserved=new Set((state.frontier?.units||[]).filter(u=>!['dead','released'].includes(u.status)&&u.citizenId).map(u=>u.citizenId));
    const citizens=(state.citizens||Array.from({length:state.population},(_,i)=>({id:`preview-${i}`,name:`Islander ${i+1}`,job:'idle',workplace:null}))).filter(c=>!reserved.has(c.id));
    const ids=new Set(citizens.map(c=>c.id));
    this.actors=this.actors.filter(a=>{if(ids.has(a.citizen.id))return true;this.disposePresentation(a.root);return false;});
    for(const citizen of citizens){let actor=this.actors.find(a=>a.citizen.id===citizen.id);if(!actor){actor=this.addActor(this.actors.length,citizen);}else if(actor.citizen.job!==citizen.job||actor.toolType!==this.jobTool(citizen)||actor.parcel.userData.cargo!==this.cargoKind(citizen)){const point=actor.root.position.clone(),heading=actor.root.rotation.y,station=actor.station;this.disposePresentation(actor.root);this.actors.splice(this.actors.indexOf(actor),1);actor=this.addActor(actor.index,citizen);actor.root.position.copy(point);actor.root.rotation.y=heading;actor.station=station;actor.wait=0;}if(actor.workplace!==citizen.workplace){actor.path=[];actor.wait=0;actor.activity=null;actor.workTime=0;}actor.citizen={...citizen};actor.workplace=citizen.workplace;actor.root.userData.citizen=actor.citizen;}
    this.syncWorkerBadges();
    if(changed)this.villagePaths();
    if(this.serviceAreaRequest){const {type,tile,level,label}=this.serviceAreaRequest;this.showServiceArea(type,tile,level,{label});}
  }
  syncDiscoveries(){
    this.discoveryModels??=new Map();
    if(!this.templates.has('discovery_waystone'))return;
    for(const spec of DISCOVERIES){const site=this.state.discovery?.sites.find(s=>s.id===spec.id),status=site?.status||'rumor',signature=status==='restored'?'restored':status==='salvaged'?'salvaged':'original';let root=this.discoveryModels.get(spec.id);
      if(root&&root.userData.signature!==signature){this.disposePresentation(root);root=null;}
      if(!root){root=this.clone('discovery_'+spec.id+(status==='restored'?'_restored':''));root.position.set(spec.x*CELL,groundHeight(spec.x,spec.z),spec.z*CELL);if(status==='salvaged')root.scale.y=.42;root.userData={discovery:spec,signature};this.scene.add(root);this.discoveryModels.set(spec.id,root);}
    }
  }
  emitSound(kind,position,level=1){
    if(!kind||!this.soundEnabled||!this.onSound)return;
    const distance=Math.hypot(position.x-this.target.x,position.z-this.target.z),gain=Math.max(0,1-distance/23)**2*Math.min(1,23/this.zoom)*level;if(gain<.025)return;
    const screen=position.clone().project(this.camera);if(Math.abs(screen.x)>1.15||Math.abs(screen.y)>1.15)return;
    this.onSound(kind,{gain,pan:THREE.MathUtils.clamp(screen.x,-.9,.9)});
  }
  colorCitizen(root,job){
    const originalShirt=new THREE.Color('#de6548'),shirtColor=new THREE.Color(JOBS[job]?.color||'#5b8d9c');
    root.traverse(o=>{if(!o.isMesh||!o.geometry.attributes.color)return;const source=o.geometry.attributes.color;let matches=false;for(let i=0;i<source.count;i++)if(Math.abs(source.getX(i)-originalShirt.r)<.012&&Math.abs(source.getY(i)-originalShirt.g)<.012&&Math.abs(source.getZ(i)-originalShirt.b)<.012){matches=true;break;}if(!matches)return;o.geometry=o.geometry.clone();o.userData.ownsGeometry=true;const colors=o.geometry.attributes.color;for(let i=0;i<colors.count;i++)if(Math.abs(colors.getX(i)-originalShirt.r)<.012&&Math.abs(colors.getY(i)-originalShirt.g)<.012&&Math.abs(colors.getZ(i)-originalShirt.b)<.012)colors.setXYZ(i,shirtColor.r,shirtColor.g,shirtColor.b);colors.needsUpdate=true;});
  }
  cargoKind(citizen){const type=this.state?.buildings.find(b=>b.id===citizen.workplace)?.type;return ({lumber:'logs',quarry:'stone',mine:'ore',sawmill:'planks',smith:'iron',toolmaker:'tools',bakery:'bread',orchard:'fruit',garden:'vegetables',farm:'grain',windmill:'flour',flaxfield:'flax',weaver:'cloth',brewery:'ale',market:'fruit'})[type]||'grain';}
  jobTool(citizen){const workplace=this.state?.buildings.find(b=>b.id===citizen.workplace);return citizen.job==='farmer'&&workplace?.type==='orchard'?'tool_basket':JOB_TOOLS[citizen.job]||null;}
  addActor(index,citizen={id:`preview-${index}`,name:'Islander',job:'idle',workplace:null}){
    const workplace=this.state?.buildings.find(b=>b.id===citizen.workplace),homes=this.state?.buildings.filter(b=>(getBuildingSpec(b.type,b.level||1)?.housing||0)>0)||[];
    const anchor=workplace||homes[index%Math.max(1,homes.length)]||{x:1,z:2},angle=(anchor.rotation||0)*Math.PI/2;
    const root=this.clone('villager'),start=this.nearestWalkable(anchor.x+Math.round(Math.sin(angle)),anchor.z+Math.round(Math.cos(angle)));
    root.position.set(start.x*CELL,groundHeight(start.x,start.z),start.z*CELL);root.scale.setScalar(.9+(index%3)*.055);
    const arrival=this.publicDestination({index,citizen,root},start,4);
    if(arrival)root.position.set(arrival.point.x*CELL,groundHeight(arrival.point.x,arrival.point.z),arrival.point.z*CELL);
    const limbs={};root.traverse(o=>{for(const name of ['left_arm','right_arm','left_leg','right_leg'])if(o.name===name||o.name.endsWith('_'+name))limbs[name]=o;});
    root.rotation.order='YXZ';
    this.colorCitizen(root,citizen.job);
    const toolType=this.jobTool(citizen),supportTool=toolType==='tool_basket'||toolType==='tool_book',toolArm=supportTool?'left_arm':'right_arm';
    let tool;if(toolType&&limbs[toolArm]){tool=this.clone(toolType);tool.position.set(supportTool?-.04:.04,-.17,.04);if(!supportTool&&toolType!=='tool_spear')tool.rotation.x=Math.PI/2;if(toolType==='tool_axe')tool.rotation.y=-Math.PI/2;limbs[toolArm].add(tool);}
    const cargo=this.cargoKind(citizen);const parcel=this.clone('cargo_'+cargo);parcel.position.set(0,.27,.25);parcel.visible=false;parcel.userData.cargo=cargo;root.add(parcel);
    root.userData.citizen={...citizen};this.scene.add(root);
    const actor={root,limbs,parcel,tool,toolType,toolArm,path:[],index,wait:index*.2,phase:index*2,goal:null,station:null,activity:null,workTime:0,lastCell:start,citizen:{...citizen},workplace:citizen.workplace};this.actors.push(actor);return actor;
  }
  walkable(x,z) { if(!isLand(x,z)||!isLand(x+.2,z+.2)||!isLand(x-.2,z-.2))return false;return !hasNaturalObstacle(x,z)&&!isNeighborCompoundCell(x,z)&&!this.state?.buildings.some(b=>b.x===x&&b.z===z)&&!(this.state?.frontier?.fortifications||[]).some(f=>f.x===x&&f.z===z&&blocksFortification(f)); }
  walkableEdge(ax,az,bx,bz){if(!this.state?.frontier)return true;return gateTransition(this.state,{x:ax,z:az},{x:bx,z:bz});}
  nearestWalkable(x,z,connected=true){
    x=Math.round(x);z=Math.round(z);const valid=(a,b)=>this.walkable(a,b)&&(!connected||!this.reachable||this.reachable.has(`${a},${b}`));
    if(valid(x,z))return{x,z};
    let best=null,score=Infinity;
    for(let tx=ISLAND_BOUNDS.minX;tx<=ISLAND_BOUNDS.maxX;tx++)for(let tz=ISLAND_BOUNDS.minZ;tz<=ISLAND_BOUNDS.maxZ;tz++){const d=(tx-x)**2+(tz-z)**2;if(d<score&&valid(tx,tz)){best={x:tx,z:tz};score=d;}}
    return best||{x:0,z:3};
  }
  findPath(start,end,avoid=null){
    const key=p=>`${p.x},${p.z}`,q=[start],from=new Map([[key(start),null]]);let head=0;
    while(head<q.length){const p=q[head++];if(p.x===end.x&&p.z===end.z){const out=[];let current=p;while(current){out.unshift(current);current=from.get(key(current));}return out.slice(1);}
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const n={x:p.x+dx,z:p.z+dz};if(avoid&&n.x===avoid.x&&n.z===avoid.z&&(n.x!==end.x||n.z!==end.z))continue;if(!from.has(key(n))&&this.walkable(n.x,n.z)&&this.walkableEdge(p.x,p.z,n.x,n.z)){from.set(key(n),p);q.push(n);}}
    }return[];
  }
  updatePaths(){
    this.publicSpots=null;
    const queue=[{x:0,z:3}];this.reachable=new Set(['0,3']);
    for(let i=0;i<queue.length;i++)for(const [dx,dz]of[[1,0],[-1,0],[0,1],[0,-1]]){const x=queue[i].x+dx,z=queue[i].z+dz,key=`${x},${z}`;if(!this.reachable.has(key)&&this.walkable(x,z)&&this.walkableEdge(queue[i].x,queue[i].z,x,z)){this.reachable.add(key);queue.push({x,z});}}
    for(const a of this.actors){
      const cx=Math.round(a.root.position.x/CELL),cz=Math.round(a.root.position.z/CELL);
      const approachId=a.path[0]?.stationBuilding,atStation=this.state.buildings.some(b=>(b.id===approachId||b.id===a.station?.buildingId)&&b.x===cx&&b.z===cz)&&(approachId||this.walkable(a.station.exit.x,a.station.exit.z));
      // A changed entrance, gate or neighboring footprint also invalidates
      // the approach to the *first* waypoint. Replan from the actual position.
      // A closed gate may isolate a valid tile; it must not teleport its people.
      this.resetActorRoute(a);a.blockedWaypoint=null;
      if(!this.walkable(cx,cz)&&!atStation){
        const p=this.nearestWalkable(cx,cz,false);a.root.position.set(p.x*CELL,groundHeight(p.x,p.z),p.z*CELL);a.station=null;
      }
    }
  }
  villagePaths(){
    if(this.lanes){this.scene.remove(this.lanes);this.lanes.geometry.dispose();}
    const cells=new Map();
    for(const b of this.state.buildings){
      if(['hearth','bell'].includes(b.type))continue;
      const start=this.nearestWalkable(b.x,b.z+1),end={x:0,z:3};
      for(const p of [start,...this.findPath(start,end)])if(terrainAt(p.x,p.z).kind!=='path')cells.set(`${p.x},${p.z}`,p);
    }
    if(!cells.size)return;
    const pieces=[];
    for(const p of cells.values())for(let j=0;j<3;j++){
      const x=p.x+(rand(p.x,j)-.5)*.35,z=p.z+(rand(p.z,j+2)-.5)*.45;
      const g=new THREE.CylinderGeometry(.22,.24,.025,7);g.scale(1,1,.75);g.rotateY(rand(x,z)*6);g.translate(x*CELL,groundHeight(x,z)+.02,z*CELL);pieces.push(g);
    }
    this.lanes=new THREE.Mesh(mergeGeometries(pieces),this.pathMaterial);this.lanes.receiveShadow=true;this.scene.add(this.lanes);
  }
  actorWaypointValid(point){
    const x=Math.round(point.x),z=Math.round(point.z);
    if(point.stationBuilding){const owner=this.state.buildings.find(b=>b.id===point.stationBuilding);if(owner&&owner.x===x&&owner.z===z)return isLand(point.x,point.z);}
    return this.walkable(x,z);
  }
  resetActorRoute(a,blocked=null){
    if(blocked)a.blockedWaypoint={...blocked,expires:this.clock+8};
    a.path=[];a.routeProgress=null;a.wait=0;a.workTime=0;a.activity=null;a.publicSpot=null;a.yieldUntil=0;
    a.parcel.visible=false;a.root.userData.workState='waiting';
    if(blocked)a.root.userData.workReason='Finding a clear approach to the workplace.';
  }
  actorStepClear(a,x,z,waypoint){
    const p=a.root.position,steps=Math.max(1,Math.ceil(Math.hypot(x-p.x,z-p.z)/.12));
    const allowed=(cx,cz)=>this.walkable(cx,cz)||(waypoint.stationBuilding&&this.state.buildings.some(b=>b.id===waypoint.stationBuilding&&b.x===cx&&b.z===cz));
    let previous={x:Math.round(p.x/CELL),z:Math.round(p.z/CELL)};
    for(let i=1;i<=steps;i++){
      const px=p.x+(x-p.x)*i/steps,pz=p.z+(z-p.z)*i/steps,next={x:Math.round(px/CELL),z:Math.round(pz/CELL)};
      if(!allowed(next.x,next.z)||!this.walkableEdge(previous.x,previous.z,next.x,next.z))return false;
      if(previous.x!==next.x&&previous.z!==next.z&&(!allowed(previous.x,next.z)||!allowed(next.x,previous.z)||!this.walkableEdge(previous.x,previous.z,previous.x,next.z)||!this.walkableEdge(previous.x,next.z,next.x,next.z)||!this.walkableEdge(previous.x,previous.z,next.x,previous.z)||!this.walkableEdge(next.x,previous.z,next.x,next.z)))return false;
      if(!waypoint.stationBuilding&&!this.crowdPositionClear(px,pz))return false;
      previous=next;
    }
    return true;
  }
  publicDestination(a,center,radius=3){
    if(!this.publicSpots){
      const cells=this.reachable?[...this.reachable].map(key=>{const[x,z]=key.split(',').map(Number);return{x,z};}):listTiles().filter(p=>this.walkable(p.x,p.z));
      this.publicSpots=[];
      for(const p of cells)if(this.walkable(p.x,p.z)&&!(this.state.frontier?.fortifications||[]).some(f=>f.status!=='ruined'&&f.x===p.x&&f.z===p.z))for(const[dx,dz]of[[-.38,-.38],[.38,-.38],[-.38,.38],[.38,.38]]){
        const point={x:p.x+dx,z:p.z+dz,exact:true,public:true};
        const workApron=this.state.buildings.some(b=>{if(!BUILDINGS[b.type]?.job)return false;const angle=(b.rotation||0)*Math.PI/2,rx=(point.x-b.x)*CELL,rz=(point.z-b.z)*CELL,x=rx*Math.cos(angle)-rz*Math.sin(angle),z=rx*Math.sin(angle)+rz*Math.cos(angle);return Math.abs(x)<1.02&&z>.75&&z<1.55;});
        if(workApron)continue;
        if(this.crowdPositionClear(point.x*CELL,point.z*CELL))this.publicSpots.push({x:p.x,z:p.z,point});
      }
    }
    let best=null,bestScore=Infinity;
    for(let i=0;i<this.publicSpots.length;i++){
      const spot=this.publicSpots[i],distance=Math.hypot(spot.point.x-center.x,spot.point.z-center.z);
      if(distance>radius)continue;
      if(a.blockedWaypoint?.expires>this.clock&&Math.hypot(spot.point.x-a.blockedWaypoint.x,spot.point.z-a.blockedWaypoint.z)*CELL<.5)continue;
      const x=spot.point.x*CELL,z=spot.point.z*CELL;
      let density=0,reserved=false;
      for(const other of this.actors){if(other===a)continue;const target=other.publicSpot||other.station?.point;
        if(target&&Math.hypot(x-target.x*CELL,z-target.z*CELL)<.67){reserved=true;break;}
        const separation=Math.hypot(x-other.root.position.x,z-other.root.position.z);
        if(separation<.63){reserved=true;break;}if(separation<1.3)density+=1;
      }
      if(reserved)continue;
      const score=distance*.40+density*1.9+rand(a.index,i,17+(a.outings||0))*1.65;
      if(score<bestScore){best=spot;bestScore=score;}
    }
    return best;
  }
  crowdPositionClear(x,z){
    const gx=x/CELL,gz=z/CELL,cx=Math.round(gx),cz=Math.round(gz);
    if(!this.walkable(cx,cz)||!isLand(gx+.13,gz+.13)||!isLand(gx-.13,gz-.13))return false;
    for(const f of this.state.frontier?.fortifications||[])if(f.type==='gate'&&f.status!=='ruined'&&f.open){const a=(f.rotation||0)*Math.PI/2,dx=x-f.x*CELL,dz=z-f.z*CELL,lx=dx*Math.cos(a)-dz*Math.sin(a),lz=dx*Math.sin(a)+dz*Math.cos(a);if(Math.abs(lz)<.58&&Math.abs(lx)>.30&&Math.abs(lx)<1.15)return false;}
    return !this.state.buildings.some(b=>Math.abs(x-b.x*CELL)<1.05&&Math.abs(z-b.z*CELL)<1.05);
  }
  separateCrowd(){
    // Resolve body discs, keeping staffed work positions fixed. Corrections
    // stay on clear ground; they cannot push citizens into a house or a tree.
    const diameter=.445,bucketSize=.7;
    for(let pass=0;pass<6;pass++){
      const buckets=new Map();
      for(let i=0;i<this.actors.length;i++){const p=this.actors[i].root.position,key=`${Math.floor(p.x/bucketSize)},${Math.floor(p.z/bucketSize)}`;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(i);}
      for(let i=0;i<this.actors.length;i++){
        const a=this.actors[i],p=a.root.position,bx=Math.floor(p.x/bucketSize),bz=Math.floor(p.z/bucketSize);
        for(let ox=-1;ox<=1;ox++)for(let oz=-1;oz<=1;oz++)for(const j of buckets.get(`${bx+ox},${bz+oz}`)||[]){
          if(j<=i)continue;const b=this.actors[j],q=b.root.position;let dx=p.x-q.x,dz=p.z-q.z,d=Math.hypot(dx,dz);if(d>=diameter)continue;
          if(d<.0001){const angle=rand(i,j,47)*TAU;dx=Math.cos(angle);dz=Math.sin(angle);d=1;}else{dx/=d;dz/=d;}
          const penetration=diameter-Math.hypot(p.x-q.x,p.z-q.z)+.002;
          const fixedA=!!(a.station||a.publicSpot)&&!a.path.length,fixedB=!!(b.station||b.publicSpot)&&!b.path.length;
          const shift=(actor,x,z)=>{if(!this.crowdPositionClear(x,z))return false;actor.root.position.x=x;actor.root.position.z=z;if(!actor.station)actor.root.position.y=groundHeight(x/CELL,z/CELL);return true;};
          let movedA=false,movedB=false;
          if(!fixedA)movedA=shift(a,p.x+dx*penetration*(fixedB?1:.5),p.z+dz*penetration*(fixedB?1:.5));
          if(!fixedB)movedB=shift(b,q.x-dx*penetration*(fixedA?1:.5),q.z-dz*penetration*(fixedA?1:.5));
          if(!movedA&&!fixedB&&movedB)shift(b,q.x-dx*penetration*.5,q.z-dz*penetration*.5);
          if(!movedB&&!fixedA&&movedA)shift(a,p.x+dx*penetration*.5,p.z+dz*penetration*.5);
        }
      }
    }
  }
  crowdStep(a,dx,dz,step,waypoint){
    const p=a.root.position,d=Math.hypot(dx,dz);if(d<.0001||step<=0)return{x:0,z:0};
    let ux=dx/d,uz=dz/d;const near=this.actors.filter(other=>other!==a&&Math.abs(other.root.position.x-p.x)<1&&Math.abs(other.root.position.z-p.z)<1);
    if(waypoint.stationBuilding)return this.actorStepClear(a,p.x+ux*step,p.z+uz*step,waypoint)?{x:ux*step,z:uz*step}:{x:0,z:0};
    if(!near.length&&this.actorStepClear(a,p.x+ux*step,p.z+uz*step,waypoint))return{x:ux*step,z:uz*step};
    if(a.yieldUntil>this.clock){ux=a.yieldX;uz=a.yieldZ;}
    let best=null,bestScore=Infinity;
    for(const angle of[0,.78,-.78,1.35,-1.35,2.1,-2.1,Math.PI]){
      const vx=(ux*Math.cos(angle)-uz*Math.sin(angle))*step,vz=(ux*Math.sin(angle)+uz*Math.cos(angle))*step,x=p.x+vx,z=p.z+vz;
      if(!this.actorStepClear(a,x,z,waypoint))continue;
      let penalty=0,blocked=false;
      for(const other of near){const q=other.root.position,before=Math.hypot(p.x-q.x,p.z-q.z),after=Math.hypot(x-q.x,z-q.z);if(after<.43&&after<before-.001){blocked=true;break;}penalty+=Math.max(0,.50-after)*1.5;}
      if(blocked)continue;const score=Math.hypot(ux*step-vx,uz*step-vz)+penalty+(angle<0?.002:0);
      if(score<bestScore){best={x:vx,z:vz,angle};bestScore=score;}
    }
    // A crowded junction must permit a short backwards yield. Holding that
    // direction briefly prevents two opposing walkers from oscillating in
    // place while everyone behind them waits forever.
    if(best&&Math.abs(best.angle)>1.4&&!(a.yieldUntil>this.clock)){a.yieldX=best.x/step;a.yieldZ=best.z/step;a.yieldUntil=this.clock+.75;}
    return best||{x:0,z:0};
  }
  clearStationApproach(building,entry,point){
    const model=this.buildings.get(building.id)?.userData.model;if(!model)return false;
    const from=new THREE.Vector3(entry.x*CELL,entry.y??groundHeight(entry.x,entry.z),entry.z*CELL);
    const to=new THREE.Vector3(point.x*CELL,point.y??groundHeight(point.x,point.z),point.z*CELL);
    const length=Math.hypot(to.x-from.x,to.z-from.z),steps=Math.max(1,Math.ceil(length/.12));
    // The only occupied tile this final approach may enter is its own station.
    // Everything else retains the island's land, scenery, and building rules.
    for(let i=0;i<=steps;i++){
      const t=i/steps,x=THREE.MathUtils.lerp(from.x,to.x,t),z=THREE.MathUtils.lerp(from.z,to.z,t),cx=Math.round(x/CELL),cz=Math.round(z/CELL);
      if(!isLand(x/CELL+.2,z/CELL+.2)||!isLand(x/CELL-.2,z/CELL-.2))return false;
      if((cx!==building.x||cz!==building.z)&&!this.walkable(cx,cz))return false;
      if(this.state.buildings.some(b=>b.id!==building.id&&Math.abs(x-b.x*CELL)<1.01&&Math.abs(z-b.z*CELL)<1.01))return false;
    }
    if(length<.001)return true;
    model.updateWorldMatrix(true,true);
    const direction=to.clone().sub(from),side=new THREE.Vector3(-direction.z,0,direction.x).normalize(),ray=new THREE.Raycaster();
    // Sweep the worker's width at ankle, chest, and head height. A route to a
    // forge's open bench is allowed; a shortcut through a cottage wall is not.
    for(const height of [.12,.43,.71])for(const offset of [-.14,0,.14]){
      const origin=from.clone().addScaledVector(side,offset);origin.y+=height;
      const end=to.clone().addScaledVector(side,offset);end.y+=height;
      const delta=end.sub(origin),distance=delta.length();ray.set(origin,delta.normalize());ray.near=.015;ray.far=distance+.12;
      if(ray.intersectObject(model,true).some(hit=>hit.object.visible))return false;
    }
    return true;
  }
  workStation(a,building){
    const shown=this.buildings.get(building.id);if(!shown)return null;
    const modelName=BUILDINGS[building.type]?.model||building.type,model=shown.userData.model;
    const targetData=modelName==='clinic'?[.58,.36,.51]:this.assetMetadata?.[modelName]?.work_target_three||VILLAGE_WORK_TARGETS[modelName]||[0,.52,.65];
    const workerIndex=Math.max(0,(building.workerIds||[]).indexOf(a.citizen.id)),builder=a.citizen.job==='builder';
    const directions=[[0,1],[1,0],[0,-1],[-1,0]],candidates=[];
    if(builder){for(let j=0;j<4;j++){const side=directions[(workerIndex+j)%4];candidates.push({stance:[side[0]*1.03,0,side[1]*1.03],target:[side[0]*.65,.54,side[1]*.65],side});}}
    else if(modelName==='smith'){
      for(let j=0;j<SMITH_STATIONS.length;j++)candidates.push({...SMITH_STATIONS[(workerIndex+j)%SMITH_STATIONS.length],side:[0,1],alternate:j>0});
    }else{
      const stance=WORK_STANCES[modelName]||[.13,0,1.05],lanes=[0,-.46,.46];
      const spread={smith:.35,sawmill:.8,market:.8,farm:.85,garden:.8,lumber:.5,quarry:.55,orchard:.3}[modelName]||.12;
      for(let j=0;j<lanes.length;j++){const shift=lanes[(workerIndex+j)%lanes.length];candidates.push({stance:[stance[0]+shift,stance[1],stance[2]],target:[targetData[0]+shift*spread,targetData[1],targetData[2]],side:[0,1]});}
      for(const alternative of SIDE_WORK_STATIONS[modelName]||[])candidates.push({...alternative,alternate:true});
    }
    shown.updateWorldMatrix(true,true);
    for(const candidate of candidates){
      for(const entrance of builder?[candidate.side]:directions){
      const side=new THREE.Vector3(entrance[0],0,entrance[1]).applyAxisAngle(new THREE.Vector3(0,1,0),shown.rotation.y);
      const entry={x:building.x+Math.round(side.x),z:building.z+Math.round(side.z),exact:true};
      if(!this.walkable(entry.x,entry.z)||!this.reachable?.has(`${entry.x},${entry.z}`))continue;
      // Facing workplaces can share a street cell. Give each worker a port
      // on its own side of that cell, rather than a shared exact center point.
      const location=model.localToWorld(new THREE.Vector3(...candidate.stance));
      location.y=Math.max(location.y,groundHeight(location.x/CELL,location.z/CELL));
      const lane=THREE.MathUtils.clamp((location.x-building.x*CELL)*side.z-(location.z-building.z*CELL)*side.x,-.75,.75);
      const approach={x:entry.x+(-side.x*.15+side.z*lane)/CELL,z:entry.z+(-side.z*.15-side.x*lane)/CELL,exact:true,stationBuilding:building.id,stationEntry:true};
      approach.y=groundHeight(approach.x,approach.z);
      if(a.blockedWaypoint?.expires>this.clock&&a.blockedWaypoint.stationBuilding===building.id&&Math.hypot(approach.x-a.blockedWaypoint.x,approach.z-a.blockedWaypoint.z)*CELL<.445)continue;
      // Different guard stances can clamp to almost the same entrance port.
      // Reserve the port until its walker passes it, as well as reserving the
      // final work position, so two arrivals cannot pin each other in place.
      if(this.actors.some(other=>other!==a&&other.station?.approach&&other.path.some(p=>p.stationEntry)&&Math.hypot(other.station.approach.x-approach.x,other.station.approach.z-approach.z)*CELL<.445))continue;
      if(this.actors.some(other=>other!==a&&other.station&&other.activity==='work'&&other.station.buildingId===building.id&&Math.hypot(other.station.point.x*CELL-location.x,other.station.point.z*CELL-location.z)<.445))continue;
      if(this.actors.some(other=>other!==a&&((other.publicSpot&&Math.hypot(other.publicSpot.x*CELL-location.x,other.publicSpot.z*CELL-location.z)<.445)||(!other.path.length&&Math.hypot(other.root.position.x-location.x,other.root.position.z-location.z)<.445))))continue;
      const point={x:location.x/CELL,z:location.z/CELL,y:location.y,exact:true,stationBuilding:building.id};
      if(a.blockedWaypoint?.expires>this.clock&&a.blockedWaypoint.stationBuilding===building.id&&Math.hypot(point.x-a.blockedWaypoint.x,point.z-a.blockedWaypoint.z)*CELL<.5)continue;
      if(!this.clearStationApproach(building,approach,point))continue;
      const target=model.localToWorld(new THREE.Vector3(...candidate.target));
      return{buildingId:building.id,point,target,approach,exit:{...entry,y:groundHeight(entry.x,entry.z),stationBuilding:building.id},signature:shown.userData.signature,smithSurface:candidate.surface,access:candidate.alternate||entrance[0]||entrance[1]<0?'side':'front',yaw:a.citizen.job==='guard'&&!candidate.outward?shown.rotation.y:Math.atan2(target.x-location.x,target.z-location.z)-(modelName==='smith'?Math.PI/2:0)};
      }
    }
    return null;
  }
  turnActor(a,angle,dt){let diff=angle-a.root.rotation.y;while(diff>Math.PI)diff-=TAU;while(diff<-Math.PI)diff+=TAU;a.root.rotation.y+=diff*Math.min(1,dt*9);}
  routeActor(a){
    const hearth=this.state.buildings.find(b=>b.type==='hearth'),workplace=this.state.buildings.find(b=>b.id===a.workplace),job=a.citizen.job;
    const previous=a.station;let choose=workplace||hearth,activity='work',goal=null,station=null,publicSpot=null,dwell=38+rand(a.index,this.clock)*26;
    if(workplace&&job==='forager'){
      if(a.activity==='gather'){choose=workplace;activity='deliver';dwell=3.5;}
      else{
        const spots=listTiles().filter(p=>{const d=Math.hypot(p.x-workplace.x,p.z-workplace.z);return d>1.7&&d<5.5&&p.kind!=='path'&&this.walkable(p.x,p.z)&&this.reachable?.has(`${p.x},${p.z}`);});
        if(spots.length){goal=spots[Math.floor(rand(a.index,this.clock,8)*spots.length)];activity='gather';dwell=7+rand(a.index,this.clock)*4;}
      }
    }else if(workplace&&a.activity==='work'){
      if(job==='guard'){const sides=[[2,0],[0,2],[-2,0],[0,-2]],side=sides[(a.index+(a.patrolCount=(a.patrolCount||0)+1))%4];goal=this.nearestWalkable(workplace.x+side[0],workplace.z+side[1]);activity='patrol';dwell=5;}
      else if(job!=='builder'&&DELIVERY_JOBS.has(job)&&a.workTime>2){
        const stores=this.state.buildings.filter(b=>b.type==='warehouse'&&(!b.status||b.status==='ready')),places=stores.length?stores:[hearth];
        const deliveries=b=>this.actors.filter(other=>other!==a&&other.activity==='deliver'&&other.goal?.id===b?.id).length;
        choose=places.filter(b=>b&&deliveries(b)<4).sort((left,right)=>Math.hypot(left.x-workplace.x,left.z-workplace.z)+deliveries(left)*3-Math.hypot(right.x-workplace.x,right.z-workplace.z)-deliveries(right)*3)[0];
        // Keep making goods while a store's small unloading yard is busy.
        // This only schedules visible trips; simulation output is untouched.
        if(!choose){a.wait=12+rand(a.index,this.clock)*10;a.workTime=0;return;}
        activity='deliver';dwell=3.5;
      }
      else if(job!=='builder'&&previous&&previous.signature===this.buildings.get(workplace.id)?.userData.signature&&(a.shifts=(a.shifts||0)+1)%3!==0){a.wait=dwell;a.workTime=0;return;}
      else if(job!=='builder'&&!DELIVERY_JOBS.has(job)){choose=hearth;activity='break';dwell=5;}
    }
    if(!workplace){const homes=this.state.buildings.filter(b=>(getBuildingSpec(b.type,b.level||1)?.housing||0)>0&&(!b.status||b.status==='ready')),publicPlaces=this.state.buildings.filter(b=>['market','well','school','chapel','hearth','manor'].includes(b.type)&&(!b.status||b.status==='ready'));a.outings=(a.outings||0)+1;const places=a.outings%4===0&&publicPlaces.length?publicPlaces:homes;choose=places.length?places[a.index%places.length]:hearth;activity='rest';dwell=32+rand(a.index,this.clock)*35;}
    if(!choose&&!goal)return;
    if(activity==='work'&&workplace){
      const supplied=this.actorCanWork(a);station=supplied?this.workStation(a,workplace):null;
      if(station){goal=station.exit;a.root.userData.workReason=null;}
      else{activity='waiting';dwell=6+rand(a.index,this.clock)*5;a.root.userData.workReason=supplied?'The workplace needs a clear, connected approach.':'Waiting for workplace supplies or an active assignment.';
        // An inaccessible workplace is an honest wait. Recheck from the same
        // safe place instead of sending every blocked worker around the coast.
        if(a.activity==='waiting'&&a.publicSpot&&!a.path.length){a.wait=dwell;return;}
        const p=a.root.position;
        if(this.crowdPositionClear(p.x,p.z)){a.station=null;a.path=[];a.publicSpot={x:p.x/CELL,z:p.z/CELL,exact:true,public:true};a.goal=workplace;a.activity='waiting';a.wait=dwell;a.workTime=0;return;}
      }
    }
    if(!station&&activity!=='gather'&&activity!=='patrol'){
      const nearby=activity==='rest'||activity==='waiting'?{x:a.root.position.x/CELL,z:a.root.position.z/CELL}:choose;
      const destination=this.publicDestination(a,nearby,activity==='rest'?3.5:2.5)||this.publicDestination(a,nearby,12);
      if(destination){goal={x:destination.x,z:destination.z};publicSpot={...destination.point};}
    }
    if(!goal){const rotation=(choose.rotation||0)*Math.PI/2;goal=this.nearestWalkable(choose.x+Math.round(Math.sin(rotation)),choose.z+Math.round(Math.cos(rotation)));}
    const cx=Math.round(a.root.position.x/CELL),cz=Math.round(a.root.position.z/CELL),previousBuilding=previous&&this.state.buildings.find(b=>b.id===previous.buildingId);
    // A destination is reserved before arrival. Only retreat via its entrance
    // when the actor actually reached that station, never across the map.
    const nearPrevious=previousBuilding&&((cx===previousBuilding.x&&cz===previousBuilding.z)||(cx===previous.exit.x&&cz===previous.exit.z&&Math.hypot(a.root.position.x-previous.point.x*CELL,a.root.position.z-previous.point.z*CELL)<1.35));
    const canExit=nearPrevious&&this.walkable(previous.exit.x,previous.exit.z);
    const start=canExit?previous.exit:this.nearestWalkable(a.root.position.x/CELL,a.root.position.z/CELL,false),path=[];
    const departure=canExit?(previous.approach||start):start;
    // Open ground does not need a trip back to its tile center. Another
    // resident can occupy that center while the onward route is perfectly free.
    if(canExit&&Math.hypot(a.root.position.x-departure.x*CELL,a.root.position.z-departure.z*CELL)>.03)path.push({...departure,exact:true});
    const avoided=a.blockedWaypoint?.expires>this.clock&&!a.blockedWaypoint.stationBuilding?{x:Math.round(a.blockedWaypoint.x),z:Math.round(a.blockedWaypoint.z)}:null;
    const gridPath=this.findPath(start,goal,avoided);
    if((start.x!==goal.x||start.z!==goal.z)&&!gridPath.length){a.path=[];a.routeProgress=null;a.wait=2;a.activity='waiting';a.parcel.visible=false;a.root.userData.workReason='The workplace needs a clear, connected approach.';return;}
    if(station&&gridPath.length)gridPath.pop();
    path.push(...gridPath);
    if(station){path.push({...station.approach});path.push({...station.point});}
    else if(publicSpot)path.push(publicSpot);
    a.path=path;a.routeProgress=null;a.station=station;a.publicSpot=publicSpot;a.goal=choose;a.activity=activity;a.wait=dwell;a.workTime=0;
    a.parcel.visible=activity==='deliver'&&DELIVERY_JOBS.has(job);
    if(a.tool)a.tool.visible=!a.parcel.visible;
  }
  actorCanWork(a){
    const b=this.state.buildings.find(b=>b.id===a.workplace);if(!b||b.paused)return false;
    if(a.citizen.job==='builder')return b.status==='building';
    return(!b.status||b.status==='ready')&&(!b.production||b.production.efficiency>0);
  }
  smithPose(a){
    const arm=a.limbs.right_arm,tool=a.tool,model=this.buildings.get(a.station.buildingId)?.userData.model;
    if(!arm||!tool||!model)return;
    // Two physical links: shoulder to the existing hand grip, then the
    // hammer handle to its metal head. Neither link changes length.
    if(!a.hammerPoints){
      tool.updateWorldMatrix(true,true);const points=new Map();
      tool.traverse(mesh=>{if(!mesh.isMesh)return;const p=mesh.geometry.attributes.position,c=mesh.geometry.attributes.color,index=mesh.geometry.index;
        for(let i=0;i<(index?.count||p.count);i+=3){const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j);if(!ids.every(id=>p.getY(id)>.13&&(!c||c.getX(id)<.3)))continue;
          const triangle=ids.map(id=>tool.worldToLocal(new THREE.Vector3().fromBufferAttribute(p,id).applyMatrix4(mesh.matrixWorld)));
          for(const v of [...triangle,...triangle.map((v,j)=>v.clone().lerp(triangle[(j+1)%3],.5))])points.set(v.toArray().map(n=>n.toFixed(5)).join(','),v);
        }
      });a.hammerPoints=[...points.values()];
    }
    a.root.updateWorldMatrix(true,true);model.updateWorldMatrix(true,true);
    const grip=tool.position.clone(),length=grip.length(),headLength=.18,shoulder=arm.getWorldPosition(new THREE.Vector3());
    const rise=Math.max(0,((1-Math.cos(a.phase))*.5-.16)/.84),target=a.station.target.clone();
    target.x=THREE.MathUtils.lerp(target.x,shoulder.x,rise*.55);target.z=THREE.MathUtils.lerp(target.z,shoulder.z,rise*.55);target.y+=(.055+rise*.20)*model.scale.y;
    const parentInverse=arm.parent.matrixWorld.clone().invert(),down=new THREE.Vector3(0,-1,0).transformDirection(parentInverse);
    const solve=()=>{
      const end=target.clone().applyMatrix4(parentInverse).sub(arm.position),distance=Math.min(length+headLength-.0001,Math.max(.001,end.length())),direction=end.normalize();
      const along=(length*length-headLength*headLength+distance*distance)/(2*distance),bend=down.clone().addScaledVector(direction,-down.dot(direction));
      if(bend.lengthSq()<.001)bend.set(0,0,1).addScaledVector(direction,-direction.z);bend.normalize();
      const hand=direction.clone().multiplyScalar(along).addScaledVector(bend,Math.sqrt(Math.max(0,length*length-along*along)));
      arm.quaternion.setFromUnitVectors(grip.clone().normalize(),hand.clone().normalize());arm.updateWorldMatrix(true,true);
      const actualEnd=arm.position.clone().addScaledVector(direction,distance).applyMatrix4(arm.parent.matrixWorld),worldHand=tool.getWorldPosition(new THREE.Vector3());
      const y=actualEnd.sub(worldHand).normalize(),x=new THREE.Vector3(0,-1,0).addScaledVector(y,y.y).normalize();
      if(x.lengthSq()<.001)x.set(1,0,0);const z=new THREE.Vector3().crossVectors(x,y).normalize();x.crossVectors(y,z).normalize();
      const rotation=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z));
      tool.quaternion.copy(arm.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));tool.updateWorldMatrix(true,true);
    };
    // Calibrate the stroke against the authored metal surface, including the
    // horn's slope. The tiny contact compression keeps a real triangle impact
    // while the rest of the stroke lifts clear of the anvil.
    const modelInverse=model.matrixWorld.clone().invert(),toolToModel=new THREE.Matrix4(),sample=new THREE.Vector3();
    for(let pass=0;pass<4;pass++){
      solve();toolToModel.copy(modelInverse).multiply(tool.matrixWorld);let gap=Infinity;
      for(const p of a.hammerPoints){const v=sample.copy(p).applyMatrix4(toolToModel);let height=.545,inside=v.x>=.06&&v.x<=.48&&v.z>=.17&&v.z<=.39;
        if(a.station.smithSurface==='horn'){const t=(v.x+.15)/.19;height=.505+t*.035;inside=t>=0&&t<=1&&Math.abs(v.z-.28)<=t*.11;}
        if(inside)gap=Math.min(gap,v.y-height);
      }
      if(!Number.isFinite(gap))break;
      target.y+=(rise*.20-.002-gap)*model.scale.y;
    }
    solve();
  }
  jobPose(a,working,dt){
    let right=0,left=0,lean=0;
    if(a.toolType==='tool_basket')left=-.10;
    if(a.toolType==='tool_book')left=-.75;
    if(working){
      const job=a.citizen.job,rate={builder:4.6,lumberjack:3.6,quarryworker:3.9,miner:3.8,smith:4.4,carpenter:3.4,farmer:2.5,forager:2.1,medic:2.2,scholar:2.3}[job]||2.4;
      const previous=a.phase;a.phase+=dt*rate;const wave=Math.sin(a.phase);const impactPhase=job==='smith'?0:Math.PI/2;if(Math.floor((previous-impactPhase)/TAU)!==Math.floor((a.phase-impactPhase)/TAU))this.emitSound(({builder:'hammer',lumberjack:'axe',quarryworker:'chisel',miner:'chisel',smith:'anvil',carpenter:'saw',farmer:'rustle',forager:'rustle',weaver:'cloth',baker:'cargo',scholar:'page'})[job],a.root.position,.65);
      if(['builder','lumberjack','quarryworker','miner','smith'].includes(job)){right=-1.15+wave*.62;left=-.35;lean=.045+Math.max(0,wave)*.045;}
      else if(job==='carpenter'){right=-1.02+wave*.20;left=-.68+wave*.12;lean=.10;}
      else if(job==='farmer'&&a.toolType==='tool_hoe'){right=.12+wave*.42;left=-.20;lean=.17+wave*.025;}
      else if(job==='forager'||job==='farmer'){right=-.12+wave*.40;left=-.12;lean=.12+Math.max(0,wave)*.08;}
      else if(['scholar','chaplain','steward'].includes(job)){left=-.86;right=-1.00+wave*.12;lean=.04;}
      else if(job==='medic'){left=-.16;right=-.77+wave*.22;lean=.09;}
      else if(job==='guard'){right=-.04;left=0;}
      else{left=-.20;right=-.78+wave*.25;lean=.075;}
    }
    if(a.parcel.visible){right=-.8;left=-.8;}
    for(const [name,limb]of Object.entries(a.limbs)){const target=name==='right_arm'?right:name==='left_arm'?left:0;limb.rotation.x+=(target-limb.rotation.x)*Math.min(1,dt*10);limb.rotation.y=0;limb.rotation.z=0;}
    a.root.rotation.x+=(lean-a.root.rotation.x)*Math.min(1,dt*7);
    if(a.citizen.job==='smith'&&a.tool){if(working&&a.station)this.smithPose(a);else a.tool.rotation.set(Math.PI/2,0,0);}
  }
  updateActors(dt){
    for(const a of this.actors){const p=a.root.position;
      if(a.station&&!a.station.invalidated&&a.station.signature!==this.buildings.get(a.station.buildingId)?.userData.signature){this.resetActorRoute(a);a.station.invalidated=true;}
      if(a.path.length){
        const n=a.path[0];if(!this.actorWaypointValid(n)){this.resetActorRoute(a);continue;}
        if(!n.exact&&n.laneX===undefined){const vx=n.x*CELL-p.x,vz=n.z*CELL-p.z;n.laneX=Math.abs(vz)>Math.abs(vx)?-Math.sign(vz)*.235:0;n.laneZ=Math.abs(vx)>=Math.abs(vz)?Math.sign(vx)*.235:0;}
        const tx=n.x*CELL+(n.exact?0:n.laneX),tz=n.z*CELL+(n.exact?0:n.laneZ),dx=tx-p.x,dz=tz-p.z,d=Math.hypot(dx,dz),step=Math.min(d,dt*(.95+(a.index%4)*.05));
        if(n.stationBuilding){n.startY??=p.y;n.startDistance??=Math.max(.001,d);}
        const motion=this.crowdStep(a,dx,dz,step,n),moved=Math.hypot(motion.x,motion.z);
        if(moved>.001){p.x+=motion.x;p.z+=motion.z;this.turnActor(a,Math.atan2(motion.x,motion.z),dt);const previous=a.phase;a.phase+=moved*10;if(Math.floor(previous/Math.PI)!==Math.floor(a.phase/Math.PI))this.emitSound('step',p,.32);}
        const floor=n.stationBuilding?THREE.MathUtils.lerp(n.startY,n.y??groundHeight(n.x,n.z),1-Math.min(1,Math.max(0,d-step)/n.startDistance)):groundHeight(p.x/CELL,p.z/CELL);
        p.y=floor+Math.abs(Math.sin(a.phase))*.022;
        // Street centers are transit gates, not positions that every citizen
        // must occupy exactly. Two separated bodies must be able to pass the
        // same gate without both stopping just outside its arrival radius.
        const remaining=Math.hypot(tx-p.x,tz-p.z),arrival=n.stationBuilding?.025:n.public?.04:.34;
        if(remaining<arrival){if(n.stationBuilding||n.public){p.x=tx;p.z=tz;}a.lastCell=n;a.path.shift();}
        for(const [name,limb]of Object.entries(a.limbs)){const sign=name.startsWith('left')?1:-1;limb.rotation.set(Math.sin(a.phase)*.46*sign*(name.includes('arm')?-1:1),0,0);if(name===a.toolArm&&(a.toolType==='tool_basket'||a.toolType==='tool_book'))limb.rotation.x=a.toolType==='tool_book'?-.65:-.10;if(a.parcel.visible&&name.includes('arm'))limb.rotation.x=-.8;}
        if(a.citizen.job==='smith'&&a.tool)a.tool.rotation.set(Math.PI/2,0,0);
        a.root.rotation.x*=Math.max(0,1-dt*9);a.root.userData.workState='walking';
      }else{
        a.wait-=dt;if(a.wait<=0){this.routeActor(a);if(a.path.length)continue;}
        const working=(a.activity==='work'&&!!a.station||a.activity==='gather')&&this.actorCanWork(a);
        if(working)a.workTime+=dt;
        if(a.station)this.turnActor(a,a.station.yaw+(a.citizen.job==='guard'?Math.sin(this.clock*.4+a.index)*.12:0),dt);
        else if(a.goal&&a.activity!=='gather')this.turnActor(a,Math.atan2(a.goal.x*CELL-p.x,a.goal.z*CELL-p.z),dt);
        if(a.activity==='deliver'&&a.wait<1.1&&a.parcel.visible){this.emitSound('cargo',p,.6);a.parcel.visible=false;}
        if(a.tool)a.tool.visible=!a.parcel.visible;
        this.jobPose(a,working,dt);
        p.y=a.station?.point.y??groundHeight(p.x/CELL,p.z/CELL);
        a.root.userData.workState=working?(a.activity==='gather'?'foraging':a.citizen.job==='guard'?'watching':'working'):a.activity==='deliver'?'unloading':'waiting';
      }
    }
    this.separateCrowd();
    // Measure net progress after crowd separation, not attempted foot motion.
    // Repeated yielding or an occupied port must eventually release the old
    // reservation and try a different route/station, even without a map edit.
    for(const a of this.actors){
      const n=a.path[0];if(!n){a.routeProgress=null;continue;}
      const distance=Math.hypot(n.x*CELL+(n.exact?0:n.laneX||0)-a.root.position.x,n.z*CELL+(n.exact?0:n.laneZ||0)-a.root.position.z);
      if(a.routeProgress?.waypoint!==n||distance<a.routeProgress.best-.10)a.routeProgress={waypoint:n,best:distance,stalled:0};
      else if((a.routeProgress.stalled+=dt)>=3)this.resetActorRoute(a,n);
    }
  }
  icons(){
    const result={};const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.setSize(160,144);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
    const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight('#fff0d8','#75856f',3));const sun=new THREE.DirectionalLight('#fff3da',3);sun.position.set(-3,6,4);scene.add(sun);
    const cam=new THREE.OrthographicCamera(-1.45,1.45,1.4,-1.4,.1,30);cam.position.set(4,3.4,5);cam.lookAt(0,.75,0);
    for(const type of [...Object.keys(BUILDINGS),'boat',...FRONTIER_ICONS,...DISCOVERIES.flatMap(d=>['discovery_'+d.id,'discovery_'+d.id+'_restored'])]){const o=this.clone(type);const box=new THREE.Box3().setFromObject(o);const size=box.getSize(new THREE.Vector3());const s=2.1/Math.max(size.x,size.y,size.z);o.scale.setScalar(s);o.position.y=-.1;scene.add(o);renderer.render(scene,cam);result[type]=renderer.domElement.toDataURL();scene.remove(o);}
    renderer.dispose();return result;
  }
  resize(){const w=this.canvas.clientWidth,h=this.canvas.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h,false);this.width=w;this.height=h;this.updateCamera(1);}
  updateCamera(dt){const a=1-Math.exp(-dt*9);this.azimuth+=(this.targetAzimuth-this.azimuth)*a;this.zoom+=(this.targetZoom-this.zoom)*(1-Math.exp(-dt*14));this.target.lerp(new THREE.Vector3(this.pan.x,Math.max(.65,groundHeight(this.pan.x/CELL,this.pan.z/CELL)),this.pan.z),a);const radius=Math.max(43,this.zoom*1.1);this.camera.position.set(this.target.x+Math.sin(this.azimuth)*radius,this.target.y+radius*36/43,this.target.z+Math.cos(this.azimuth)*radius);this.sun.position.set(this.target.x-23,this.target.y+34,this.target.z+15);this.sun.target.position.copy(this.target);const shadowSpan=Math.max(29,Math.min(78,this.zoom*.72));Object.assign(this.sun.shadow.camera,{left:-shadowSpan,right:shadowSpan,top:shadowSpan,bottom:-shadowSpan,far:180});this.sun.shadow.camera.updateProjectionMatrix();this.camera.lookAt(this.target);const aspect=this.width/this.height;this.camera.left=-this.zoom*aspect/2;this.camera.right=this.zoom*aspect/2;this.camera.top=this.zoom/2;this.camera.bottom=-this.zoom/2;this.camera.updateProjectionMatrix();}
  rotate(amount){this.targetAzimuth+=amount*Math.PI/4;this.onCamera?.();}
  zoomBy(amount){this.targetZoom=THREE.MathUtils.clamp(this.targetZoom+amount,10,MAP_ZOOM);this.onCamera?.();}
  home(){this.pan.set(0,0,0);this.targetZoom=this.width<700?43:32;this.targetAzimuth=Math.PI/4;}
  focus(b){this.pan.set(b.x*CELL,0,b.z*CELL);this.targetZoom=16;}
  moveCamera(dx,dz){const angle=this.azimuth;this.pan.x+=dx*Math.cos(angle)+dz*Math.sin(angle);this.pan.z+=-dx*Math.sin(angle)+dz*Math.cos(angle);this.pan.x=THREE.MathUtils.clamp(this.pan.x,ISLAND_BOUNDS.minX*CELL,ISLAND_BOUNDS.maxX*CELL);this.pan.z=THREE.MathUtils.clamp(this.pan.z,ISLAND_BOUNDS.minZ*CELL,ISLAND_BOUNDS.maxZ*CELL);}
  pick(clientX,clientY){
    const rect=this.canvas.getBoundingClientRect();this.pointer.set((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1);this.raycaster.setFromCamera(this.pointer,this.camera);
    const objects=[...this.actors.map(a=>a.root),...this.buildings.values(),...this.landmarks,...this.discoveryModels.values(),...this.fortifications.values(),...this.troops.values()].map(o=>o.root||o);
    objects.push(...[...this.neighborModels.values()].filter(o=>o.userData.neighbor.discovered));
    const scenery=new Set([...this.decor.values()].flatMap(pieces=>pieces.flatMap(p=>p.meshes)));
    if(this.stumps)scenery.add(this.stumps);
    const hit=visibleSurfaceHit(this.raycaster.intersectObjects([...objects,...scenery,this.land],true));
    if(!hit)return null;
    const point=hit.point,x=Math.round(point.x/CELL),z=Math.round(point.z/CELL);
    const tree=hit.object.userData.treeSites?.[hit.instanceId];
    if(tree)return{x:tree.tile.x,z:tree.tile.z,tree,point};
    if(scenery.has(hit.object))return{x,z,scenery:true,point};
    let root=hit.object;while(root&&!root.userData.citizen&&!root.userData.building&&!root.userData.landmark&&!root.userData.unit&&!root.userData.fortification&&!root.userData.neighbor&&!root.userData.discovery)root=root.parent;
    if(root){
      const data=root.userData;
      if(data.discovery)return{...data.discovery,discovery:data.discovery,point};
      if(data.unit){const u=data.unit;return{x:Math.round(u.x),z:Math.round(u.z),troop:u,unit:u,enemy:u.faction!=='player'?u:null,point};}
      if(data.neighbor)return{x:data.neighbor.x,z:data.neighbor.z,neighbor:data.neighbor,fortification:data.fortification,point};
      if(data.fortification)return{x:data.fortification.x,z:data.fortification.z,fortification:data.fortification,point};
      if(data.citizen)return{citizen:data.citizen,x:Math.round(root.position.x/CELL),z:Math.round(root.position.z/CELL),point};
      if(data.landmark)return{x:2,z:8,landmark:'landing',point};
      if(data.building)return{x:data.building.x,z:data.building.z,point};
    }
    return{x,z,point,regionId:terrainAt(x,z).regionId};
  }

  previewScreenBounds(){
    if(!this.highlight.visible||!this.previewBounds)return null;
    const box=this.previewBounds,point=new THREE.Vector3(),bounds={left:Infinity,top:Infinity,right:-Infinity,bottom:-Infinity};
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
      point.set(x,y,z).project(this.camera);const sx=(point.x+1)*this.width/2,sy=(1-point.y)*this.height/2;
      bounds.left=Math.min(bounds.left,sx);bounds.right=Math.max(bounds.right,sx);bounds.top=Math.min(bounds.top,sy);bounds.bottom=Math.max(bounds.bottom,sy);
    }
    return bounds;
  }
  project(x,z){const p=new THREE.Vector3(x*CELL,groundHeight(x,z)+.2,z*CELL).project(this.camera);return{x:(p.x+1)*this.width/2,y:(1-p.y)*this.height/2};}
  bindInput(){
    const c=this.canvas;this.pointers=new Map();let drag=null,pinch=0;
    c.addEventListener('pointerdown',e=>{c.setPointerCapture(e.pointerId);this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(this.pointers.size===2){const [a,b]=[...this.pointers.values()];pinch=Math.hypot(a.x-b.x,a.y-b.y);if(drag)drag.moved=true;return;}drag={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,button:e.button,moved:false};});
    c.addEventListener('pointermove',e=>{
      if(this.pointers.has(e.pointerId))this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(this.pointers.size===2){const [a,b]=[...this.pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y);this.targetZoom=pinchZoom(this.targetZoom,pinch,distance,10,MAP_ZOOM);this.onCamera?.();pinch=distance;return;}
      if(drag){const dx=e.clientX-drag.lastX,dy=e.clientY-drag.lastY;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>5)drag.moved=true;if(drag.moved){if(drag.button===2)this.targetAzimuth-=dx*.008;else this.moveCamera(-dx*this.zoom/this.height,-dy*this.zoom/this.height*1.4);this.onCamera?.();}drag.lastX=e.clientX;drag.lastY=e.clientY;}
      if(!drag?.moved)this.onHover?.(this.pick(e.clientX,e.clientY),{x:e.clientX,y:e.clientY,pointerType:e.pointerType});
    });
    c.addEventListener('pointerup',e=>{
      const wasPinching=this.pointers.size===2;this.pointers.delete(e.pointerId);
      if(wasPinching&&this.pointers.size===1){
        // Either finger can remain after a pinch. Continue from its current
        // position, keeping the whole gesture ineligible for a placement tap.
        const remaining=this.pointers.values().next().value;
        drag={...drag,x:remaining.x,y:remaining.y,lastX:remaining.x,lastY:remaining.y,moved:true};pinch=0;
      }
      if(drag&&!drag.moved&&e.button===0&&this.pointers.size===0)this.onTap?.(this.pick(e.clientX,e.clientY),{pointerType:e.pointerType,shiftKey:e.shiftKey});
      if(!this.pointers.size)drag=null;
    });
    const endGesture=()=>{this.pointers.clear();drag=null;pinch=0;};
    c.addEventListener('pointercancel',endGesture);
    // Normal pointerup already removed this pointer. Unexpected capture loss
    // cancels the entire gesture, so a later release cannot become a build tap.
    c.addEventListener('lostpointercapture',e=>{if(this.pointers.has(e.pointerId))endGesture();});
    c.addEventListener('pointerleave',e=>{if(!drag)this.onHover?.(null,{pointerType:e.pointerType});});c.addEventListener('contextmenu',e=>e.preventDefault());
    c.addEventListener('wheel',e=>{e.preventDefault();this.targetZoom=wheelZoom(this.targetZoom,e.deltaY,e.deltaMode,this.height,10,MAP_ZOOM);this.onCamera?.();},{passive:false});
  }
  render(dt,{speed=1,playing=true,dayTime=.25,won=false}={}){
    this.soundEnabled=playing&&speed>0;this.cuesPaused=!playing||speed<=0;this.clock+=dt;this.updateCamera(dt);
    if(!this.reduced){this.water.material.uniforms.uTime.value=this.clock;this.birds.forEach((b,i)=>{const a=this.clock*.045+i*2;b.position.set(Math.cos(a)*24,5+Math.sin(a*2+i)*.4,Math.sin(a)*16);b.rotation.y=-a;b.rotation.z=Math.sin(this.clock*3+i)*.15;});}
    for(const o of this.buildings.values()){
      const b=o.userData.building;
      if(b.status&&b.status!=='ready'){
        const ratio=Math.min(1,(b.progress||0)/Math.max(1,b.workRequired||1));
        o.userData.model.visible=b.constructionKind==='upgrade'||ratio>.12;
        o.userData.plane.constant=o.position.y+o.userData.height*Math.max(.04,ratio);
        if(o.userData.scaffold)o.userData.scaffold.visible=true;
      }
      if(b.type==='windmill'&&playing&&(!b.status||b.status==='ready')&&!b.paused){o.traverse(n=>{if(n.name==='rotor')n.rotation.z-=dt*.48*speed;});}
      if(b.type==='bell'&&b.restored&&!this.reduced){o.traverse(n=>{if(n.name==='bell_body')n.rotation.x=Math.sin(this.clock*2)*.1;});}
    }
    if(playing&&speed>0)this.updateActors(Math.min(.1,dt)*Math.min(speed,2));
    this.updateWorkerCues();this.updateWorldCues();
    this.updateFrontier(dt,playing&&speed>0);
    this.updatePressure();
    if(this.boat){const gx=won?5.45:17,gz=won?17.3:22;this.boat.position.x+=(gx-this.boat.position.x)*Math.min(1,dt*.18);this.boat.position.z+=(gz-this.boat.position.z)*Math.min(1,dt*.18);this.boat.position.y=-.10+(this.reduced?0:Math.sin(this.clock*1.2)*.045);this.boat.rotation.z=this.reduced?0:Math.sin(this.clock*.9)*.025;}
    // Daylight stays readable; a gentle late-afternoon warmth replaces a black night.
    const warmth=Math.max(0,Math.sin(dayTime*Math.PI)),sun=this.seasonColors?.sun||[1,.94,.85];this.sun.color.setRGB(sun[0],sun[1]-warmth*.035,sun[2]-warmth*.065);
    if(this.state && Math.floor(this.clock*2)!==this.lastWoodlandFrame){this.lastWoodlandFrame=Math.floor(this.clock*2);this.syncWoodland();this.syncSeasonVisuals();}
    this.renderer.render(this.scene,this.camera);
  }
  diagnostics(){return{drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,actors:this.actors.length,buildings:this.buildings.size,troops:this.troops.size,fortifications:this.fortifications.size,neighbors:this.neighborModels.size,pixelRatio:this.renderer.getPixelRatio(),webgl:this.renderer.capabilities.isWebGL2};}
}
