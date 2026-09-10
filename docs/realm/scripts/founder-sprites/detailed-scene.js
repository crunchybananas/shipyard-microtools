import * as THREE from 'three';
import {createFounderRig} from './rig.js';
import {surfaceMaps} from './materials.js';
import {dressFounderForSettlement} from './settlement-materials.js';

const clamp=THREE.MathUtils.clamp;
export async function createDetailedScene({modelURL,onStatus,onContextLost}){
  const rig=await createFounderRig({width:800,height:600,modelURL,applyGrounding:false,clipName:'Realm_Grounded_Walk'});
  const {renderer,scene,model}=rig;
  renderer.domElement.className='detail-canvas';renderer.domElement.setAttribute('aria-label','Live Founder in a textured stone courtyard');
  renderer.setClearColor(0x263c43,1);renderer.toneMappingExposure=1.05;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  scene.children.filter(o=>o.isLight).forEach(o=>scene.remove(o));
  scene.fog=new THREE.FogExp2(0x263c43,.068);
  const wardrobe=dressFounderForSettlement(model,renderer);
  const camera=new THREE.PerspectiveCamera(32,4/3,.1,45),target=new THREE.Vector3(0,.78,0);
  let width=800,height=600,zoom=1,lightAngle=-35,lighting='day',detail=true,quality='auto',pixelRatio=1.5,time=0,frameCount=0,frameSum=0,lastStats=0;
  let lost=false,firstStatus=true;
  const sky=new THREE.HemisphereLight(0xc8e5ed,0x746547,2.0);scene.add(sky);
  const sun=new THREE.DirectionalLight(0xffdfac,3.1);scene.add(sun);sun.target.position.set(0,.6,0);scene.add(sun.target);
  sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-4;sun.shadow.camera.right=4;sun.shadow.camera.top=4;sun.shadow.camera.bottom=-4;sun.shadow.camera.near=.1;sun.shadow.camera.far=18;sun.shadow.bias=-.00025;sun.shadow.normalBias=.025;sun.shadow.radius=3;
  const rim=new THREE.DirectionalLight(0x8fbeca,1.7);rim.position.set(3,3,-4);scene.add(rim);
  const fire=new THREE.PointLight(0xffaa53,0,4,2);fire.position.set(-1.24,.54,.75);scene.add(fire);

  // A small, prefiltered environment supplies broad reflections on buckles.
  // It is generated once, with ordinary WebGL2 render targets.
  const envScene=new THREE.Scene();envScene.background=new THREE.Color(0x697b80);
  for(const [position,color,scale] of [[[-3,4,3],0xffe1b0,[5,5,1]],[[4,2,-2],0x9ad2e3,[4,6,1]],[[0,-3,0],0x3b3023,[10,1,10]]]){
    const panel=new THREE.Mesh(new THREE.BoxGeometry(...scale),new THREE.MeshBasicMaterial({color}));panel.position.set(...position);envScene.add(panel);
  }
  let environment;
  function refreshEnvironment(){const pmrem=new THREE.PMREMGenerator(renderer);environment?.dispose();environment=pmrem.fromScene(envScene,0,.1,30);scene.environment=environment.texture;pmrem.dispose();}
  refreshEnvironment();scene.environmentIntensity=.65;

  const stoneMaps=surfaceMaps('stone'),woodMaps=surfaceMaps('wood');
  const limestone=await new THREE.TextureLoader().loadAsync(new URL('../../assets/sprites/founder/materials/limestone-albedo.png',import.meta.url).href);
  limestone.colorSpace=THREE.SRGBColorSpace;limestone.wrapS=limestone.wrapT=THREE.RepeatWrapping;limestone.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  const stone=new THREE.MeshStandardMaterial({color:0x92958a,map:limestone,normalMap:stoneMaps.normal,normalScale:new THREE.Vector2(.38,.38),roughnessMap:stoneMaps.roughness,roughness:.95});
  const wood=new THREE.MeshStandardMaterial({color:0x62432c,map:woodMaps.color,normalMap:woodMaps.normal,normalScale:new THREE.Vector2(.35,.35),roughnessMap:woodMaps.roughness});
  const brass=new THREE.MeshStandardMaterial({color:0xad8750,metalness:.75,roughness:.42});
  const iron=new THREE.MeshStandardMaterial({color:0x313d3c,metalness:.6,roughness:.58});
  const add=(geometry,material,position,rotation)=>{const mesh=new THREE.Mesh(geometry,material);if(position)mesh.position.set(...position);if(rotation)mesh.rotation.set(...rotation);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);return mesh;};
  const box=(size,mat,pos,rotation)=>add(new THREE.BoxGeometry(...size),mat,pos,rotation);
  add(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:0x334b48,roughness:1}),[0,-.26,0],[-Math.PI/2,0,0]);
  add(new THREE.CylinderGeometry(2.43,2.52,.2,80),stone,[0,-.15,0]);
  add(new THREE.CylinderGeometry(2.36,2.4,.05,80),stone,[0,-.025,0]);
  // Individual paving joints are geometry, so their occlusion survives relighting.
  for(let i=-2;i<=2;i++)for(let j=-2;j<=2;j++){
    if(Math.hypot(i*.79,j*.79)>1.95)continue;
    const p=box([.777,.016,.777],stone,[i*.79,.003,j*.79]);p.rotation.y=(i+j)*.004;
    const vertices=p.geometry.attributes.position,uv=p.geometry.attributes.uv,normals=p.geometry.attributes.normal;
    for(let v=0;v<vertices.count;v++){const x=vertices.getX(v)+i*.79,y=vertices.getY(v),z=vertices.getZ(v)+j*.79;uv.setXY(v,(Math.abs(normals.getX(v))>.5?z:x)*.47+.5,(Math.abs(normals.getY(v))>.5?z:y)*.47+.5);}uv.needsUpdate=true;
  }
  const ring=add(new THREE.TorusGeometry(2.14,.012,5,96),brass,[0,.024,0],[Math.PI/2,0,0]);ring.castShadow=false;
  for(let i=0;i<32;i++){const a=i*Math.PI/16;box([.014,.012,i%4===0?.14:.055],brass,[Math.sin(a)*2.14,.025,Math.cos(a)*2.14],[0,a,0]);}
  // Soft, local contact shading keeps the planted feet readable at low quality.
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;const sc=shadowCanvas.getContext('2d'),gradient=sc.createRadialGradient(64,64,4,64,64,62);gradient.addColorStop(0,'#0b1b1bec');gradient.addColorStop(.4,'#0b1b1b6a');gradient.addColorStop(1,'#0b1b1b00');sc.fillStyle=gradient;sc.fillRect(0,0,128,128);
  const contactTexture=new THREE.CanvasTexture(shadowCanvas);
  const contact=add(new THREE.PlaneGeometry(1.15,.8),new THREE.MeshBasicMaterial({map:contactTexture,transparent:true,opacity:.45,depthWrite:false}),[0,.026,.02],[-Math.PI/2,0,0]);contact.castShadow=false;
  const footRings=['l','r'].map(()=>{const r=add(new THREE.RingGeometry(.065,.079,24),new THREE.MeshBasicMaterial({color:0xc5f1b4,side:THREE.DoubleSide,depthTest:false}),[0,.03,0],[-Math.PI/2,0,0]);r.castShadow=false;r.renderOrder=10;r.visible=false;return r;});

  // The Founder has a place to direct: a survey table and the first camp stores.
  const table=new THREE.Group();table.position.set(1.30,0,-.72);table.rotation.y=-.18;scene.add(table);
  const part=(size,mat,pos)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(...size),mat);m.position.set(...pos);m.castShadow=m.receiveShadow=true;table.add(m);return m;};
  part([1.02,.085,.64],wood,[0,.79,0]);for(const x of [-.39,.39])for(const z of [-.22,.22])part([.065,.77,.065],wood,[x,.385,z]);
  part([.88,.07,.05],wood,[0,.26,-.21]);
  const chart=document.createElement('canvas');chart.width=512;chart.height=320;const pen=chart.getContext('2d');pen.fillStyle='#cbbf91';pen.fillRect(0,0,512,320);pen.strokeStyle='#7f917b';pen.lineWidth=2;
  for(let i=0;i<9;i++){pen.beginPath();for(let x=0;x<512;x+=4){const y=35+i*34+Math.sin(x*.018+i)*12+Math.sin(x*.04)*5;x?pen.lineTo(x,y):pen.moveTo(x,y);}pen.stroke();}
  pen.strokeStyle='#435f69';pen.lineWidth=10;pen.beginPath();pen.moveTo(370,0);pen.bezierCurveTo(180,90,490,230,280,320);pen.stroke();pen.strokeStyle='#75583c';pen.lineWidth=2;
  for(const [x,y] of [[140,100],[170,102],[130,145],[195,160],[230,110]])pen.strokeRect(x,y,21,18);
  pen.beginPath();pen.arc(162,137,70,0,Math.PI*2);pen.stroke();pen.fillStyle='#695434';pen.font='italic 19px Georgia';pen.fillText('The first settlement',24,292);
  const chartMap=new THREE.CanvasTexture(chart);chartMap.colorSpace=THREE.SRGBColorSpace;
  const map=new THREE.Mesh(new THREE.PlaneGeometry(.85,.52),new THREE.MeshStandardMaterial({map:chartMap,roughness:1,side:THREE.DoubleSide}));map.rotation.x=-Math.PI/2;map.rotation.z=.07;map.position.set(0,.838,0);table.add(map);
  part([.26,.014,.018],brass,[.20,.854,.18]).rotation.y=.5;
  for(const [x,z] of [[-.9,-1.32],[-1.5,-1.05]]){
    box([.46,.40,.46],wood,[x,.21,z],[0,.12,0]);
    for(const y of [.05,.35])box([.48,.045,.48],iron,[x,y,z],[0,.12,0]);
  }
  // Small lantern with actual warm illumination in the evening preset.
  const lx=-1.24,lz=.75;
  add(new THREE.CylinderGeometry(.145,.16,.06,8),iron,[lx,.09,lz]);
  add(new THREE.CylinderGeometry(.08,.19,.12,8),iron,[lx,.57,lz]);
  for(const x of [-.105,.105])for(const z of [-.105,.105])box([.016,.38,.016],iron,[lx+x,.32,lz+z]);
  const glass=add(new THREE.CylinderGeometry(.11,.11,.32,8),new THREE.MeshStandardMaterial({color:0xffd498,emissive:0xff9e3d,emissiveIntensity:.7,transparent:true,opacity:.4,roughness:.35,depthWrite:false}),[lx,.32,lz]);glass.castShadow=false;
  const flame=add(new THREE.SphereGeometry(.045,10,8),new THREE.MeshBasicMaterial({color:0xffd782}),[lx,.31,lz]);flame.scale.y=2.2;flame.castShadow=false;
  add(new THREE.TorusGeometry(.065,.011,6,20),iron,[lx,.68,lz]);

  const pole=add(new THREE.CylinderGeometry(.018,.025,2.35,8),wood,[-1.60,1.18,-.82]);
  add(new THREE.SphereGeometry(.042,8,6),brass,[-1.60,2.39,-.82]);
  const flagGeo=new THREE.PlaneGeometry(.49,.69,12,18),fp=flagGeo.attributes.position;
  for(let i=0;i<fp.count;i++){const x=fp.getX(i);fp.setZ(i,.045*Math.sin(x*16));}flagGeo.computeVertexNormals();
  const cloth=surfaceMaps('cloth'),flagMat=new THREE.MeshPhysicalMaterial({color:0x366960,side:THREE.DoubleSide,normalMap:cloth.normal,normalScale:new THREE.Vector2(.45,.45),roughness:1,sheen:.4,sheenColor:new THREE.Color(0x81a698)});
  const banner=add(flagGeo,flagMat,[-1.335,1.94,-.81]);
  const emblem=add(new THREE.RingGeometry(.064,.08,5),brass,[-1.32,1.96,-.752]);emblem.castShadow=false;
  box([.55,.025,.025],wood,[-1.335,2.29,-.81]);

  const grasses=new THREE.InstancedMesh(new THREE.ConeGeometry(.024,.19,3),new THREE.MeshStandardMaterial({color:0x788665,roughness:1}),180);
  const dummy=new THREE.Object3D();for(let i=0;i<180;i++){const a=i*2.399963,r=2.37+(Math.sin(i*13.7)*.5+.5)*.7;dummy.position.set(Math.sin(a)*r,-.15,Math.cos(a)*r);dummy.rotation.set(Math.sin(i)*.2,a,.2*Math.cos(i));dummy.scale.setScalar(.6+(Math.sin(i*53)+1)*.35);dummy.updateMatrix();grasses.setMatrixAt(i,dummy.matrix);}scene.add(grasses);
  const pebbles=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(.09,0),stone,36);
  for(let i=0;i<36;i++){const a=i*2.399963,r=2.55+(Math.sin(i*3.7)*.5+.5)*.7;dummy.position.set(Math.sin(a)*r,-.16,Math.cos(a)*r);dummy.rotation.set(i*.8,i*.3,i);dummy.scale.set(.7+i%3*.25,.5,.8);dummy.updateMatrix();pebbles.setMatrixAt(i,dummy.matrix);}pebbles.receiveShadow=true;scene.add(pebbles);

  function resize(w,h){width=w;height=h;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setPixelRatio(pixelRatio);renderer.setSize(w,h,false);updateCamera();}
  function updateCamera(){target.y=.78+(zoom-1)*.75;const distance=(width<500?7.5:7.0)/zoom;camera.position.set(0,target.y+distance*.43,distance*.902);camera.lookAt(target);}
  function setLight(preset=lighting,angle=lightAngle){lighting=preset;lightAngle=angle;const a=angle*Math.PI/180;sun.position.set(Math.sin(a)*5,lighting==='dusk'?2.3:5,Math.cos(a)*5);
    const dusk=lighting==='dusk',overcast=lighting==='overcast';sun.color.set(dusk?0xffb260:overcast?0xe2eff5:0xffdfac);sun.intensity=dusk?1.5:overcast?1.15:3.1;
    sky.intensity=dusk?.6:overcast?2.8:2;sky.color.set(dusk?0x8bafd5:0xc8e5ed);rim.intensity=dusk?2.0:1.7;fire.intensity=dusk?3.0:.15;glass.material.emissiveIntensity=dusk?2:.6;
    scene.fog.color.set(dusk?0x202f43:0x263c43);renderer.setClearColor(scene.fog.color,1);scene.environmentIntensity=dusk?.35:.65;
  }
  function setQuality(value){quality=value;pixelRatio=Math.min(devicePixelRatio||1,value==='low'?1:value==='high'?2:1.5);const size=value==='low'?1024:2048;if(sun.shadow.mapSize.x!==size){sun.shadow.mapSize.set(size,size);sun.shadow.map?.dispose();sun.shadow.map=null;}resize(width,height);}
  function setDetail(on){detail=on;wardrobe.setDetail(on);stone.normalMap=on?stoneMaps.normal:null;wood.normalMap=on?woodMaps.normal:null;flagMat.normalMap=on?cloth.normal:null;stone.needsUpdate=wood.needsUpdate=flagMat.needsUpdate=true;}
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;onContextLost?.();});
  renderer.domElement.addEventListener('webglcontextrestored',()=>{refreshEnvironment();lost=false;onStatus?.('Graphics restored');});
  setQuality('auto');setLight();
  function render(clip,phase,yaw,dt=0,playing=false,showContacts=false){
    if(lost)return;
    if(playing)time+=dt;
    rig.pose(clip,phase,yaw);
    const feet=showContacts?rig.landmarks():null;
    footRings.forEach((ring,i)=>{ring.visible=showContacts;if(feet){const p=feet[`foot.${i?'r':'l'}`].world;ring.position.set(p[0],.03,p[2]);const stance=clip!=='Realm_Grounded_Walk'||(phase+(i?.5:0))%1<=.6;ring.material.color.set(stance?0xc5f1b4:0xffc775);}});
    banner.rotation.y=Math.sin(time*.8)*.035;flame.scale.y=2.2+Math.sin(time*9)*.13;
    renderer.render(scene,camera);
    if(dt>0&&dt<2){frameSum+=dt;frameCount++;}
    if(firstStatus||frameSum-lastStats>=1){const fps=frameCount/frameSum;onStatus?.(`${frameSum>=1?`${Math.round(fps)} fps · `:''}${renderer.info.render.triangles.toLocaleString()} triangles · WebGL2`);lastStats=frameSum;firstStatus=false;}
    // A single downward adjustment avoids quality oscillation. This is observed
    // frame pacing, not a GPU benchmark; high quality remains an explicit choice.
    if(quality==='auto'&&frameCount>=180&&frameCount/frameSum<42&&pixelRatio>1){pixelRatio=1;resize(width,height);}
  }
  return{render,resize,canvas:renderer.domElement,landmarks:rig.landmarks,model,renderer,setLight,setQuality,setDetail,
    setZoom(value){zoom=clamp(value,1,1.85);updateCamera();},setWireframe:on=>wardrobe.setWireframe(on),
    get diagnostics(){return{api:'WebGL2',lighting,lightAngle,detail,quality,pixelRatio,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,textures:renderer.info.memory.textures,geometryCount:renderer.info.memory.geometries,frameCount,observedFPS:frameSum?frameCount/frameSum:0,contextLost:lost,wardrobe:wardrobe.stats};}
  };
}
