import * as THREE from 'three';
import { PLOT_STEP, plotBounds, wildernessAt, SCOUT_RADIUS, routePoint } from './observed-state.js';
import { terrainAt, hasNaturalObstacle } from './island.js';
const mat=color=>new THREE.MeshStandardMaterial({color,roughness:1});
const CELL=1.8;
function wallShape(f,forts){
  const directions=forts.filter(n=>n.id!==f.id&&n.status!=='ruined'&&['wall','gate','tower'].includes(n.type)&&Math.abs(n.x-f.x)+Math.abs(n.z-f.z)===1).map(n=>({x:n.x-f.x,z:n.z-f.z}));
  if(directions.length===1)return{model:'wall_end',yaw:Math.atan2(-directions[0].z,directions[0].x)};
  if(directions.length===2&&(directions[0].x+directions[1].x!==0||directions[0].z+directions[1].z!==0))for(let q=0;q<4;q++){const a=q*Math.PI/2,x=Math.round(Math.cos(a)),z=Math.round(-Math.sin(a));if(directions.some(d=>d.x===x&&d.z===z)&&directions.some(d=>d.x===z&&d.z===-x))return{model:'wall_corner',yaw:a};}
  return{model:'wall',yaw:directions.length?directions[0].x?0:Math.PI/2:f.rotation*Math.PI/2,cross:directions.length>=3};
}

/** A separate, read-only scene. Remote objects never enter VillageWorld or its save. */
export class ObservedView {
  constructor(canvas,{cloneModel,onMove,onSelect}) {
    this.canvas=canvas;this.cloneModel=cloneModel;this.onMove=onMove;this.onSelect=onSelect;this.models=new Map();this.labels=[];this.lastMap='';this.clock=0;this.zoomFactor=.6;
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#7fa29e');this.scene.add(new THREE.HemisphereLight('#ffefd4','#47645a',2.6));const sun=new THREE.DirectionalLight('#fff0cb',3);sun.position.set(-60,150,90);this.scene.add(sun);
    this.camera=new THREE.OrthographicCamera(-100,100,100,-100,.1,2000);this.focus=new THREE.Vector3();this.zoom=200;this.desiredZoom=200;
    this.map=new THREE.Group();this.content=new THREE.Group();this.scene.add(this.map,this.content);
    this.ray=new THREE.Raycaster();this.pointer=new THREE.Vector2();this.plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
    this.scout=this.cloneModel('villager');this.scout.scale.setScalar(1.05);this.scene.add(this.scout);this.scout.visible=false;
    const ring=new THREE.Mesh(new THREE.RingGeometry(.9,1.15,32),new THREE.MeshBasicMaterial({color:'#ffe29c',side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.025;this.scout.add(ring);
    this.onPointer=e=>{if(this.dragged)return;const r=canvas.getBoundingClientRect();this.pointer.set((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2);this.ray.setFromCamera(this.pointer,this.camera);const p=new THREE.Vector3();if(!this.ray.ray.intersectPlane(this.plane,p))return;
      const v=this.info?.visit;if(v?.phase==='observing')this.onMove(p.x/CELL-v.target.gx*PLOT_STEP,p.z/CELL-v.target.gz*PLOT_STEP);
      else{const hit=this.info?.claims.find(c=>{const b=plotBounds(c);return p.x/CELL>=b.minX&&p.x/CELL<=b.maxX&&p.z/CELL>=b.minZ&&p.z/CELL<=b.maxZ;});if(hit)this.onSelect(hit.uid);}};
    canvas.addEventListener('click',this.onPointer);this.onWheel=e=>{e.preventDefault();this.setZoom(e.deltaY>0?1.12:.89);};canvas.addEventListener('wheel',this.onWheel,{passive:false});
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas);this.resize();
  }
  resize(){const r=this.canvas.getBoundingClientRect();if(!r.width||!r.height)return;this.renderer.setSize(r.width,r.height,false);this.aspect=r.width/r.height;}
  clear(group){while(group.children.length){const o=group.children[0];group.remove(o);o.traverse(n=>{if(n.userData.owned){if(n.isInstancedMesh)n.dispose();n.geometry?.dispose();n.material?.dispose();}});}}
  own(mesh){mesh.userData.owned=true;return mesh;}
  buildMap(info) {
    const c=info.center||info.link||{gx:0,gz:0},claims=info.claims.filter(p=>Math.abs(p.gx-c.gx)<=3&&Math.abs(p.gz-c.gz)<=3);
    const signature=JSON.stringify([c,claims.map(p=>[p.uid,p.gx,p.gz])]);if(signature===this.lastMap)return;this.lastMap=signature;this.clear(this.map);
    this.land=new THREE.Mesh(new THREE.PlaneGeometry(800*CELL,800*CELL),mat('#83996a'));this.land.rotation.x=-Math.PI/2;this.land.position.set(c.gx*PLOT_STEP*CELL,-.04,c.gz*PLOT_STEP*CELL-25);this.map.add(this.own(this.land));
    // The wilderness is regenerated only outside registered bounds. An offline plot
    // must never accidentally regenerate the trees its owner has already felled.
    const trees=[],rocks=[];
    for(let z=c.gz*PLOT_STEP-230;z<c.gz*PLOT_STEP+190;z+=5)for(let x=c.gx*PLOT_STEP-230;x<c.gx*PLOT_STEP+230;x+=5){const spec=wildernessAt(info.link?.seed||0,x,z,claims);if(spec?.kind==='tree')trees.push({x,z,...spec});else if(spec?.kind==='rock')rocks.push({x,z,...spec});}
    const addInstances=(entries,geometry,color,y)=>{const material=mat(color),mesh=new THREE.InstancedMesh(geometry,material,entries.length),matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion();entries.forEach((t,i)=>{rotation.setFromAxisAngle(new THREE.Vector3(0,1,0),t.turn);matrix.compose(new THREE.Vector3(t.x*CELL,y*t.scale,t.z*CELL),rotation,new THREE.Vector3(t.scale,t.scale,t.scale));mesh.setMatrixAt(i,matrix);});this.map.add(this.own(mesh));};
    addInstances(trees,new THREE.CylinderGeometry(.17,.3,2.6,5),'#765e45',1.3);addInstances(trees,new THREE.ConeGeometry(1.4,4.1,6),'#426f59',3.2);addInstances(rocks,new THREE.DodecahedronGeometry(1.1,0),'#8b9288',.65);
    this.plots=new Map();
    for(const claim of claims){const b=plotBounds(claim),width=(b.maxX-b.minX)*CELL,height=(b.maxZ-b.minZ)*CELL;
      const fog=new THREE.ShaderMaterial({uniforms:{scout:{value:new THREE.Vector2(-9999,-9999)},sight:{value:0}},vertexShader:'varying vec3 worldPosition;void main(){worldPosition=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(worldPosition,1.);}',fragmentShader:'varying vec3 worldPosition;uniform vec2 scout;uniform float sight;void main(){float d=distance(worldPosition.xz,scout);float seen=1.-smoothstep(sight-1.5,sight,d);vec3 hidden=vec3(.43,.55,.54);vec3 ground=vec3(.52,.62,.39);gl_FragColor=vec4(mix(hidden,ground,seen),1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});
      const tile=new THREE.Mesh(new THREE.PlaneGeometry(width,height),fog);tile.rotation.x=-Math.PI/2;tile.position.set((b.minX+b.maxX)/2*CELL,.02,(b.minZ+b.maxZ)/2*CELL);this.map.add(this.own(tile));this.plots.set(claim.uid,tile);
      const pts=[[b.minX,b.minZ],[b.maxX,b.minZ],[b.maxX,b.maxZ],[b.minX,b.maxZ],[b.minX,b.minZ]].map(([x,z])=>new THREE.Vector3(x*CELL,.08,z*CELL));
      const border=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineDashedMaterial({color:claim.uid===info.user?.uid?'#ffe19a':'#d7e4d4',dashSize:2,gapSize:1.2}));border.computeLineDistances();this.map.add(this.own(border));
    }
  }
  update(info) {
    this.info=info;this.buildMap(info);const visit=info.visit,view=info.view;
    for(const tile of this.plots?.values()||[])tile.material.uniforms.sight.value=0;
    if(visit&&view){const t=visit.target,plot=this.plots.get(t.uid);if(plot){plot.material.uniforms.scout.value.set((t.gx*PLOT_STEP+view.scout.x)*CELL,(t.gz*PLOT_STEP+view.scout.z)*CELL);plot.material.uniforms.sight.value=SCOUT_RADIUS*CELL;}}
    const signature=visit&&view?`${visit.target.uid}:${view.seq}`:'fog';if(signature===this.lastView)return;this.lastView=signature;
    if(!view||!visit){this.clear(this.content);this.models.clear();return;}
    const ox=visit.target.gx*PLOT_STEP*CELL,oz=visit.target.gz*PLOT_STEP*CELL;
    const terrain=[];
    for(let z=Math.ceil(view.scout.z-view.radius);z<=Math.floor(view.scout.z+view.radius);z++)for(let x=Math.ceil(view.scout.x-view.radius);x<=Math.floor(view.scout.x+view.radius);x++)if(Math.hypot(x-view.scout.x,z-view.scout.z)<=view.radius-1){
      const tile=terrainAt(x,z);if(['water','path','rock','sand'].includes(tile.kind))terrain.push({x,z,key:`ground:${x}:${z}`,model:'ground',kind:tile.kind,signature:`ground:${tile.kind}`});
      if(tile.kind==='rock'&&hasNaturalObstacle(x,z))terrain.push({x,z,key:`rock:${x}:${z}`,model:'rock',signature:'rock'});
    }
    const forts=view.forts.map(f=>{const shape=f.type==='wall'?wallShape(f,view.forts):{model:f.type,yaw:f.rotation*Math.PI/2};return{...f,...shape,model:f.status==='ruined'?'wall_rubble':shape.model,key:`f:${f.id}`,signature:`fort:${f.type}:${f.status}:${shape.model}:${shape.yaw}:${!!shape.cross}`};});
    const entries=[...terrain,...forts,...view.buildings.map(b=>({...b,key:`b:${b.id}`,model:b.type,signature:`${b.type}:${b.level}:${b.status}`})),...view.trees.map(t=>({...t,key:`t:${t.id}`,model:t.growth<0?'stump':'broadleaf',signature:t.growth<0?'stump':'tree'})),...view.people.map(p=>({...p,key:`p:${p.id}`,model:'villager',signature:`person:${p.job}`}))];
    const present=new Set(entries.map(e=>e.key));for(const[key,root]of this.models)if(!present.has(key)){this.content.remove(root);root.traverse(n=>{if(n.userData.owned){n.geometry?.dispose();n.material?.dispose();}});this.models.delete(key);}
    for(const entry of entries){let root=this.models.get(entry.key);if(root?.userData.signature!==entry.signature){if(root){this.content.remove(root);root.traverse(n=>{if(n.userData.owned){n.geometry?.dispose();n.material?.dispose();}});}root=null;}
      if(!root){if(entry.model==='ground'){root=this.own(new THREE.Mesh(new THREE.PlaneGeometry(CELL+.02,CELL+.02),mat({water:'#668e95',path:'#b8ac81',rock:'#92968b',sand:'#c2b992'}[entry.kind])));root.rotation.x=-Math.PI/2;}
        else if(entry.model==='rock')root=this.own(new THREE.Mesh(new THREE.IcosahedronGeometry(.7,0),mat('#86938a')));
        else if(entry.model==='stump'){root=this.own(new THREE.Mesh(new THREE.CylinderGeometry(.16,.23,.24,7),mat('#9b805c')));root.position.y=.12;}
        else root=this.cloneModel(entry.model,entry.level||1);
        if(entry.key.startsWith('f:')&&entry.cross&&entry.status!=='ruined'){const cross=this.cloneModel('wall');cross.rotation.y=Math.PI/2;root.add(cross);}
        if(entry.key.startsWith('p:')){const toolName={builder:'tool_hammer',lumberjack:'tool_axe',quarryworker:'tool_pick',miner:'tool_pick',farmer:'tool_hoe',scholar:'tool_book'}[entry.job];const arm=root.getObjectByName(toolName==='tool_book'?'left_arm':'right_arm');if(toolName&&arm){const tool=this.cloneModel(toolName);tool.position.set(.04,-.17,.04);tool.rotation.x=Math.PI/2;if(toolName==='tool_axe')tool.rotation.y=-Math.PI/2;arm.add(tool);}}
      root.userData.signature=entry.signature;this.models.set(entry.key,root);this.content.add(root);}
      if(entry.key.startsWith('p:')&&root.userData.target){root.userData.target.set(ox+entry.x*CELL,.04,oz+entry.z*CELL);}else{root.position.x=ox+entry.x*CELL;root.position.z=oz+entry.z*CELL;if(entry.key.startsWith('p:'))root.userData.target=new THREE.Vector3(root.position.x,.04,root.position.z);}root.position.y=entry.model==='stump'?.12:entry.model==='rock'?.35:entry.model==='ground'?.025:.04;
      if(entry.key.startsWith('f:')){root.rotation.y=entry.yaw;root.scale.y=entry.status==='building'?Math.max(.1,entry.progress):1;root.traverse(o=>{if(o.name.endsWith('_gate_left'))o.rotation.y=entry.open?-Math.PI/2:0;if(o.name.endsWith('_gate_right'))o.rotation.y=entry.open?Math.PI/2:0;});}
      if(entry.key.startsWith('b:')){root.rotation.y=(entry.rotation||0)*Math.PI/2;root.scale.y=entry.status==='ready'?1:.25+Math.min(.65,(entry.progress||0)/120);}
      if(entry.key.startsWith('t:')&&entry.growth>=0)root.scale.setScalar(entry.scale*(.18+.82*entry.growth));
      if(entry.key.startsWith('p:')){root.rotation.y=entry.heading;root.userData.person=entry;}
    }
  }
  render(dt){this.clock+=dt;const info=this.info;if(!info)return;const visit=info.visit,c=info.center||info.link||{gx:0,gz:0};let target=new THREE.Vector3(c.gx*PLOT_STEP*CELL,0,(c.gz*PLOT_STEP-20)*CELL);this.desiredZoom=140*CELL;
    this.scout.visible=!!visit;
    if(visit){const home=info.link,t=visit.target;let x=t.gx*PLOT_STEP,z=t.gz*PLOT_STEP+8;
      if(visit.phase==='travelling'){const p=routePoint(visit.route,visit.progress);x=p.x;z=p.z;target.set(x*CELL,0,z*CELL);this.desiredZoom=80*CELL;}
      else{const s=info.view?.scout||{x:0,z:13};x+=s.x;z=t.gz*PLOT_STEP+s.z;target.set(x*CELL,0,z*CELL);this.desiredZoom=18*CELL*this.zoomFactor;}
      this.scout.position.set(x*CELL,.12,z*CELL);
    }
    const blend=1-Math.exp(-dt*5);this.focus.lerp(target,blend);this.zoom+=(this.desiredZoom-this.zoom)*blend;const aspect=this.aspect||1;this.camera.left=-this.zoom*aspect;this.camera.right=this.zoom*aspect;this.camera.top=this.zoom;this.camera.bottom=-this.zoom;this.camera.position.copy(this.focus).add(new THREE.Vector3(180,240,200));this.camera.lookAt(this.focus);this.camera.updateProjectionMatrix();
    for(const root of this.models.values())if(root.userData.person){const p=root.userData.person;root.position.lerp(root.userData.target,1-Math.exp(-dt*8));['left_arm','right_arm','left_leg','right_leg'].forEach((name,i)=>{const limb=root.getObjectByName(name);if(limb&&p.pose)limb.rotation.set(...p.pose[i]);});}
    this.renderer.render(this.scene,this.camera);
  }
  setZoom(factor){this.zoomFactor=Math.min(1.8,Math.max(.35,this.zoomFactor*factor));}
  overview(){this.lastView=null;}
  dispose(){this.resizeObserver.disconnect();this.canvas.removeEventListener('click',this.onPointer);this.canvas.removeEventListener('wheel',this.onWheel);this.clear(this.map);this.clear(this.content);this.renderer.dispose();}
}
