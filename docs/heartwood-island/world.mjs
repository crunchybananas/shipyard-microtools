import * as THREE from './vendor/three.module.js';
import { mergeGeometries } from './vendor/addons/utils/BufferGeometryUtils.js';

// A miniature built from shared geometry and batched natural details. No external art.
export function createWorld(scene) {
 const root=new THREE.Group();root.name='Heartwood island';scene.add(root);
 let seed=12345;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 const mat=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.87,...extra});
 const grass=mat('#7b9d60'),sand=mat('#d8c99a'),earth=mat('#665548'),stone=mat('#7a8980'),wood=mat('#725341'),woodLight=mat('#ac8157'),cream=mat('#d1bd88'),roof=mat('#536b68'),metal=mat('#344b48'),gold=mat('#e3b963',{metalness:.3,roughness:.55}),glow=mat('#ffd185',{emissive:'#ffac52',emissiveIntensity:.6});
 const lanternFrame=new THREE.MeshBasicMaterial({color:'#344b48',wireframe:true});
 const sphere=new THREE.IcosahedronGeometry(1,1),round=new THREE.SphereGeometry(1,14,10),cylinder=new THREE.CylinderGeometry(1,1,1,10),box=new THREE.BoxGeometry(1,1,1);
 function mesh(geo,material,x=0,y=0,z=0,sx=1,sy=sx,sz=sx,parent=root){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 function beam(a,b,r,material=wood,parent=root){const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),m=mesh(cylinder,material,0,0,0,r,from.distanceTo(to),r,parent);m.position.copy(from.add(to).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),to.sub(new THREE.Vector3(...a)).normalize());return m;}
 function batch(geo,material,placements,name){if(placements.some(p=>p.c)){material=material.clone();material.color.set('#ffffff');}const m=new THREE.InstancedMesh(geo,material,placements.length);m.name=name;const d=new THREE.Object3D();placements.forEach((p,i)=>{d.position.set(...p.p);d.scale.set(...p.s);d.rotation.set(...(p.r||[0,0,0]));d.updateMatrix();m.setMatrixAt(i,d.matrix);if(p.c)m.setColorAt(i,new THREE.Color(p.c));});m.castShadow=true;m.receiveShadow=true;m.instanceMatrix.needsUpdate=true;root.add(m);return m;}
 const colliders=[{x:5,z:-5,radius:1.6}];
 // Cliff strata, shore and lawn. Keeping the walk plane at y=0 makes controls predictable.
 mesh(new THREE.CylinderGeometry(12.45,10.65,2.4,64),earth,0,-1.25,0);
 mesh(new THREE.CylinderGeometry(12.75,12.25,.24,64),sand,0,-.15,0);
 mesh(new THREE.CylinderGeometry(12.35,12.6,.16,64),grass,0,-.065,0);
 const rim=[];for(let i=0;i<58;i++){const a=i/58*Math.PI*2,r=12.2+rand()*.4;rim.push({p:[Math.cos(a)*r,-.5-rand()*.35,Math.sin(a)*r],s:[.55+rand()*.45,.55+rand()*.6,.6+rand()*.3],r:[rand(),a,rand()],c:['#827b65','#9b9379','#737b6d'][i%3]});}batch(sphere,stone,rim,'weathered island edge');
 // Water uses restrained graphic highlights rather than expensive reflection passes.
 const waterMaterial=(deep,shallow)=>new THREE.ShaderMaterial({uniforms:{uTime:{value:0},uDeep:{value:new THREE.Color(deep)},uShallow:{value:new THREE.Color(shallow)}},vertexShader:`varying vec3 vP; void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform float uTime;uniform vec3 uDeep,uShallow;varying vec3 vP;void main(){float a=sin(vP.x*1.7+vP.y*.9+sin(vP.y*.7)*1.4+uTime*.42);float b=sin(vP.x*.31-vP.y*.73-uTime*.18);float wave=smoothstep(.95,1.,a)*smoothstep(.1,.9,b)*.17;float sweep=sin(vP.x*.4+vP.y*.7+uTime*.12)*.09;gl_FragColor=vec4(mix(uDeep,uShallow,.35+sweep+wave),1.);}`});
 const oceanMat=waterMaterial('#487f89','#8bbcb4'),pondMat=waterMaterial('#285f61','#89c8a9');
 const ocean=mesh(new THREE.PlaneGeometry(240,240),oceanMat,0,-1.9,0);ocean.rotation.x=-Math.PI/2;ocean.castShadow=false;ocean.receiveShadow=false;
 const pond=mesh(new THREE.CircleGeometry(3.08,64),pondMat,-3,.035,-1);pond.rotation.x=-Math.PI/2;pond.castShadow=false;
 const bank=[];for(let i=0;i<24;i++){const a=i/24*Math.PI*2;bank.push({p:[-3+Math.cos(a)*3.12,.1,-1+Math.sin(a)*3.12],s:[.24+rand()*.2,.12+rand()*.13,.25+rand()*.15],r:[0,a,0],c:i%3?'#a4ad82':'#c1b795'});}batch(sphere,stone,bank,'pond stones');
 // Lily pads, a lotus and ripples.
 const pads=[];const padMat=mat('#659875');for(let i=0;i<13;i++){const a=rand()*6.28,r=Math.sqrt(rand())*2.6;const m=mesh(new THREE.CircleGeometry(.2+rand()*.16,12,0,Math.PI*1.85),padMat,-3+Math.cos(a)*r,.055,-1+Math.sin(a)*r);m.rotation.set(-Math.PI/2,0,rand()*6);m.castShadow=false;pads.push(m);}
 const petalMat=mat('#dfbaa8');for(let i=0;i<7;i++){const a=i/7*Math.PI*2;mesh(round,petalMat,-4.15+Math.cos(a)*.14,.12,-.7+Math.sin(a)*.14,.1,.08,.18).rotation.y=-a;}mesh(round,gold,-4.15,.18,-.7,.09,.06,.09);
 // Warm curving paths are made of flattened, uneven pavers, not a grid.
 const pavers=[];for(let i=0;i<25;i++){const t=i/24,x=4+Math.sin(t*3.5)*.6,z=7-t*10;pavers.push({p:[x+(rand()-.5)*.15,.025,z],s:[.3+rand()*.16,.025,.23+rand()*.09],r:[0,rand()*3,0],c:i%3===0?'#bec19b':'#a8b58a'});}for(let i=0;i<23;i++){const t=i/22;pavers.push({p:[4-t*10,.024,4.1+Math.sin(t*4)*.6],s:[.23,.023,.19],r:[0,rand()*3,0],c:'#b5bb95'});}batch(sphere,stone,pavers,'footpaths');
 // Short timber pier on the pond's east bank, clearly separated from walkable ground.
 for(let i=0;i<8;i++)mesh(box,woodLight,.2-i*.22,.12,-1.1,.2,.13,1.12);
 for(const z of [-1.72,-.48])for(const x of [-1.25,.2]){mesh(cylinder,wood,x,.11,z,.07,.7,.07);mesh(round,gold,x,.48,z,.1,.035,.1);}
 // Cottage: ten-sided limewashed walls with hand-hewn ribs and an overhanging curved roof.
 const cottage=new THREE.Group();cottage.position.set(5,0,-5);root.add(cottage);
 mesh(new THREE.CylinderGeometry(1.46,1.6,1.7,12),cream,0,.86,0,1,1,1,cottage);
 mesh(new THREE.CylinderGeometry(1.62,1.66,.25,12),stone,0,.13,0,1,1,1,cottage);
 for(let i=0;i<12;i++){const a=i/12*6.283;beam([Math.sin(a)*1.49,.22,Math.cos(a)*1.49],[Math.sin(a)*1.4,1.68,Math.cos(a)*1.4],.055,wood,cottage);}
 const roofProfile=[new THREE.Vector2(0,3.25),new THREE.Vector2(.15,3.2),new THREE.Vector2(.32,2.94),new THREE.Vector2(.62,2.6),new THREE.Vector2(1.02,2.24),new THREE.Vector2(1.5,1.95),new THREE.Vector2(1.95,1.83),new THREE.Vector2(2.02,1.85)];
 mesh(new THREE.LatheGeometry(roofProfile.reverse(),24),roof,0,0,0,1,1,1,cottage);
 // Visible scalloped courses give the silhouette a carved woodland-roof character.
 for(const [y,r] of [[1.89,1.91],[2.12,1.25],[2.39,.88],[2.7,.53]]){const ring=mesh(new THREE.TorusGeometry(r,.045,5,32),wood,0,y,0,1,1,1,cottage);ring.rotation.x=Math.PI/2;}
 mesh(round,gold,0,3.27,0,.12,.13,.12,cottage);
 // Door and round glowing window face the arriving traveler.
 const arch=new THREE.Shape();arch.moveTo(-.38,0);arch.lineTo(.38,0);arch.lineTo(.38,.75);arch.absarc(0,.75,.38,0,Math.PI,false);arch.lineTo(-.38,0);
 mesh(new THREE.ExtrudeGeometry(arch,{depth:.08,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:1,steps:1}),wood,0,.2,1.43,1,1,1,cottage);
 const window=mesh(new THREE.CircleGeometry(.23,24),glow,0,1.08,1.535,1,1,1,cottage);window.castShadow=false;
 mesh(new THREE.TorusGeometry(.25,.035,7,24),woodLight,0,1.08,1.55,1,1,1,cottage);
 beam([-.23,1.08,1.57],[.23,1.08,1.57],.019,wood,cottage);beam([0,.85,1.57],[0,1.31,1.57],.019,wood,cottage);
 mesh(round,gold,.25,.59,1.56,.045,.045,.045,cottage);
 // Side window, sill and herb planter.
 const sideWindow=mesh(new THREE.CircleGeometry(.31,24),glow,1.49,1.03,.15,1,1,1,cottage);sideWindow.rotation.y=Math.PI/2;sideWindow.castShadow=false;
 const sideFrame=mesh(new THREE.TorusGeometry(.34,.045,7,24),woodLight,1.51,1.03,.15,1,1,1,cottage);sideFrame.rotation.y=Math.PI/2;
 mesh(box,wood,1.58,.59,.15,.34,.23,.82,cottage);for(let i=0;i<5;i++)mesh(sphere,grass,1.61,.77,-.15+i*.15,.16,.2,.13,cottage);
 // Stone chimney, a soft column of drifting smoke and a tiny vane.
 mesh(box,stone,-.8,2.7,-.6,.4,1.45,.45,cottage);mesh(box,wood,-.8,3.42,-.6,.52,.12,.55,cottage);
 const smoke=[];const smokeMat=new THREE.MeshBasicMaterial({color:'#d6d4bd',transparent:true,opacity:.16,depthWrite:false});for(let i=0;i<5;i++){const puff=mesh(round,smokeMat,4.2,3.6+i*.3,-5.6,.18+i*.07);puff.castShadow=false;smoke.push(puff);}
 // Front deck, rails, curved lantern arm.
 mesh(box,wood,5,.09,-2.92,3,.14,1.2);for(let i=0;i<10;i++)mesh(box,woodLight,3.65+i*.3,.17,-2.92,.275,.07,1.2);
 for(const x of [3.45,6.55]){beam([x,.1,-3.35],[x,.85,-3.35],.06);beam([x,.1,-2.5],[x,.65,-2.5],.06);beam([x,.64,-2.5],[x,.84,-3.35],.04);}
 mesh(box,stone,5,.04,-2.12,1.25,.08,.43);
 function lantern(x,z,height=1.2){beam([x,0,z],[x,height,z],.045);beam([x,height,z],[x+.25,height+.08,z],.035);mesh(box,lanternFrame,x+.25,height-.12,z,.22,.32,.22);const light=mesh(box,glow,x+.25,height-.1,z,.16,.23,.16);light.castShadow=false;mesh(new THREE.ConeGeometry(.2,.18,4),metal,x+.25,height+.12,z);return light;}
 const lanterns=[lantern(6.6,-2.4,1.9),lantern(4.7,3),lantern(-5.9,5.4),lantern(-8.1,-4.2),lantern(.3,-7.9)];
 // Brewing station, bottles, candle and stools.
 mesh(new THREE.LatheGeometry([new THREE.Vector2(.12,.14),new THREE.Vector2(.32,.2),new THREE.Vector2(.43,.4),new THREE.Vector2(.35,.55)],24),metal,2.65,0,-3.2);
 const potion=mesh(new THREE.CircleGeometry(.34,24),mat('#99d1af',{emissive:'#6aa487',emissiveIntensity:.3}),2.65,.55,-3.2);potion.rotation.x=-Math.PI/2;
 for(let i=0;i<3;i++){const a=i/3*6.28;beam([2.65+Math.cos(a)*.28,0,-3.2+Math.sin(a)*.28],[2.65+Math.cos(a)*.31,.35,-3.2+Math.sin(a)*.31],.05,metal);}
 const potRim=mesh(new THREE.TorusGeometry(.35,.035,6,24),gold,2.65,.56,-3.2);potRim.rotation.x=Math.PI/2;
 const tableX=7.2,tableZ=-3.6;mesh(box,woodLight,tableX,.73,tableZ,1.25,.12,.66);for(const x of [-.48,.48])for(const z of [-.22,.22])beam([tableX+x,0,tableZ+z],[tableX+x,.7,tableZ+z],.045);
 const bottleMats=[mat('#70a497',{metalness:.1,roughness:.3}),mat('#ab8b94',{metalness:.1,roughness:.3}),mat('#b7bb79',{metalness:.1,roughness:.3})];for(let i=0;i<4;i++){const x=6.8+i*.26,z=-3.6+(i%2)*.12;mesh(round,bottleMats[i%3],x,.94,z,.11,.16,.11);mesh(cylinder,bottleMats[i%3],x,1.1,z,.045,.16,.045);mesh(cylinder,woodLight,x,1.2,z,.048,.05,.048);}
 mesh(cylinder,wood,7.3,.18,-2.5,.29,.36,.29);mesh(cylinder,woodLight,7.3,.39,-2.5,.34,.08,.34);
 // Trees have distinct trunks, branching crowns, and a few tall fir silhouettes at the back.
 const trunks=[],crowns=[],firCrowns=[],branches=[];
 const treeSpots=[[-10,-6],[-9,-8],[-6,-10],[-3,-10],[0,-10],[3,-10],[7,-9],[9,-7],[10,-4],[10,0],[-11,-2],[-10,2],[-10,6],[-6,9],[0,10],[8,7],[10,4]];
 for(let i=0;i<treeSpots.length;i++){const [x,z]=treeSpots[i],h=(2.5+rand()*1.3)*(z>4?.74:1),r=.16+rand()*.09;trunks.push({p:[x,h*.45,z],s:[r,h*.9,r],r:[0,rand()*3,.03]});colliders.push({x,z,radius:.45});if(i%4===0){for(let j=0;j<3;j++)firCrowns.push({p:[x,h*.7+j*.65,z],s:[1.1-j*.2,1.2,z>4?.7:1.1-j*.2],c:['#3e6551','#50745a','#648064'][j]});}else{for(let j=0;j<4;j++){const a=j/4*6.28;crowns.push({p:[x+Math.cos(a)*.45,h+Math.sin(a)*.25,z+Math.sin(a)*.45],s:[.9+rand()*.3,.75+rand()*.3,.85+rand()*.3],r:[rand(),rand()*3,0],c:['#68864e','#7c9357','#597b51','#8a9e61'][(i+j)%4]});}branches.push({p:[x+.3,h*.65,z],s:[.075,h*.45,.075],r:[0,0,-.7]});}}
 batch(cylinder,wood,trunks,'trunks');batch(cylinder,wood,branches,'branches');batch(sphere,grass,crowns,'leafy crowns');batch(new THREE.ConeGeometry(1,1.8,9),grass,firCrowns,'tiered fir crowns');
 // Vegetation and rock scatter exclude all play spaces and the pond.
 const grasses=[],flowers=[],pebbles=[],mushrooms=[],caps=[];const flowerMat=mat('#d5c9a4'),red=mat('#ba826b');
 function clear(x,z){return Math.hypot(x+3,z+1)<3.6||Math.hypot(x-5,z+5)<2.8||Math.abs(x-4)<1.2||[[-7,-5],[-7,5],[1,-7],[4,5]].some(([a,b])=>Math.hypot(x-a,z-b)<1.5);}
 for(let i=0;i<480;i++){const a=rand()*6.28,r=Math.sqrt(rand())*11.9,x=Math.cos(a)*r,z=Math.sin(a)*r;if(clear(x,z))continue;const h=.14+rand()*.3;grasses.push({p:[x,h*.45,z],s:[.08,h,.09],r:[0,rand()*6,.2],c:['#95a76c','#7e985e','#a1ae76'][i%3]});if(i%6===0)flowers.push({p:[x,h,z],s:[.065,.045,.065],c:i%2?'#e5d6a1':'#b7aec8'});if(i%15===0)pebbles.push({p:[x,.1,z],s:[.24+rand()*.16,.12+rand()*.16,.2],r:[rand(),rand(),rand()]});if(i%32===0){mushrooms.push({p:[x+.2,.12,z],s:[.035,.24,.035]});caps.push({p:[x+.2,.27,z],s:[.14,.08,.14]});}}
 batch(new THREE.ConeGeometry(.5,1,3),grass,grasses,'grass tufts');const meadowFlowers=batch(round,flowerMat,flowers,'meadow flowers');meadowFlowers.material.emissive.set('#f7d993');meadowFlowers.material.emissiveIntensity=0;batch(sphere,stone,pebbles,'scattered rocks');batch(cylinder,cream,mushrooms,'mushroom stems');batch(round,red,caps,'mushroom caps');
 // Twilight mountain silhouettes sit beyond the sea, framing rather than enclosing the island.
 const farMats=['#6d9190','#7d9f99','#91aaa1'].map(c=>mat(c));for(let i=0;i<13;i++){const a=Math.PI+(i/12)*Math.PI,r=35+rand()*13;const m=mesh(new THREE.SphereGeometry(1,18,10),farMats[i%3],Math.cos(a)*r,-2,Math.sin(a)*r-8,8+rand()*6,5+rand()*4,7+rand()*4);m.rotation.y=rand();m.castShadow=false;}
 // Water ribbons spill over the miniature's western cliff.
 const falls=[];const fallMat=new THREE.MeshBasicMaterial({color:'#b0d8ce',transparent:true,opacity:.55,side:THREE.DoubleSide,depthWrite:false});for(let i=0;i<3;i++){const a=2.6+i*.055,x=Math.cos(a)*12.6,z=Math.sin(a)*12.6;const fall=mesh(new THREE.PlaneGeometry(.15,.95,1,6),fallMat,x,-1.12,z);fall.rotation.y=-a+Math.PI/2;fall.castShadow=false;falls.push(fall);}
 // One GPU points draw for ambient motes, gently moving only the buffer.
 const motePositions=new Float32Array(90*3),moteBase=[];for(let i=0;i<90;i++){const a=rand()*6.28,r=rand()*10;const p=[Math.cos(a)*r,.5+rand()*2.2,Math.sin(a)*r];motePositions.set(p,i*3);moteBase.push(p);}
 const moteGeo=new THREE.BufferGeometry();moteGeo.setAttribute('position',new THREE.BufferAttribute(motePositions,3));const moteMat=new THREE.PointsMaterial({color:'#f5dba0',size:.055,transparent:true,opacity:.75,depthWrite:false});const motes=new THREE.Points(moteGeo,moteMat);root.add(motes);
 // Bake only immutable meshes. Preserve animated objects, instancing, material identity,
 // shadow flags, and local-to-root transforms so batching does not change the scene.
 const dynamic=new Set([ocean,pond,...pads,...smoke,...lanterns,...falls]);
 root.updateWorldMatrix(true,true);
 const rootInverse=root.matrixWorld.clone().invert(), buckets=new Map();
 root.traverse(object=>{
  if(!object.isMesh||object.isInstancedMesh||dynamic.has(object)||Array.isArray(object.material))return;
  const key=`${object.material.uuid}:${object.castShadow}:${object.receiveShadow}`;
  if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(object);
 });
 for(const objects of buckets.values()) {
  if(objects.length<2)continue;
  const geometries=objects.map(object=>{
   const geometry=object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone();
   for(const attribute of Object.keys(geometry.attributes))if(attribute!=='position'&&attribute!=='normal')geometry.deleteAttribute(attribute);
   geometry.clearGroups();geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(rootInverse,object.matrixWorld));
   return geometry;
  });
  const geometry=mergeGeometries(geometries,false);
  if(geometry){const merged=new THREE.Mesh(geometry,objects[0].material);merged.name=`Batched ${objects.length} static details`;merged.castShadow=objects[0].castShadow;merged.receiveShadow=objects[0].receiveShadow;objects.forEach(object=>object.removeFromParent());root.add(merged);}
  geometries.forEach(geometry=>geometry.dispose());
 }
 // Baked contact shadows retain grounding on the automatic mobile no-shadow preset.
 const contact=new THREE.InstancedMesh(new THREE.CircleGeometry(1,16),new THREE.MeshBasicMaterial({color:'#29442f',transparent:true,opacity:.16,depthWrite:false}),colliders.length);
 const contactTransform=new THREE.Object3D();colliders.forEach((c,i)=>{contactTransform.position.set(c.x,.027,c.z);contactTransform.rotation.set(-Math.PI/2,0,0);contactTransform.scale.set(c.radius*1.7,c.radius*1.2,1);contactTransform.updateMatrix();contact.setMatrixAt(i,contactTransform.matrix);});root.add(contact);
 let victoryBlend=0;
 return {root,colliders,interactables:[],update(time,dt,completed=false){
  oceanMat.uniforms.uTime.value=time;pondMat.uniforms.uTime.value=time;
  victoryBlend=THREE.MathUtils.damp(victoryBlend,completed?1:0,1.2,dt);glow.emissiveIntensity=.55+victoryBlend*.65;meadowFlowers.material.emissiveIntensity=victoryBlend*.5;moteMat.size=.055+victoryBlend*.025;
  pads.forEach((p,i)=>{p.position.y=.055+Math.sin(time*.65+i)*.008;});
  smoke.forEach((p,i)=>{const t=(time*.17+i*.2)%1;p.position.set(4.2+Math.sin(t*3+i)*.18,3.55+t*1.8,-5.6+t*.3);p.scale.setScalar(.18+t*.35);});
  falls.forEach((p,i)=>{p.scale.x=.8+Math.sin(time*2+i)*.15;});
  for(let i=0;i<90;i++){motePositions[i*3]=moteBase[i][0]+Math.sin(time*.25+i)*.2;motePositions[i*3+1]=moteBase[i][1]+Math.sin(time*.45+i*2)*.12;motePositions[i*3+2]=moteBase[i][2]+Math.cos(time*.25+i)*.2;}moteGeo.attributes.position.needsUpdate=true;
  lanterns.forEach((p,i)=>{p.scale.y=.23*(1+Math.sin(time*1.8+i)*.025);});
 }};
}
