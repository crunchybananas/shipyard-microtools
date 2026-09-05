// Blender-authored architecture shares the live island, miniature and stair course.
import * as THREE from 'three';
import { TOWER, TOWER_TOP, stairPose } from './tower-course.js';
import { heightAt, addCollider } from './terrain.js';
import { getTexture } from './assets.js';

export function attachLandfall(core, library) {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .88, side: THREE.DoubleSide });
  // Fine mineral grain survives close inspection without tiling masonry over wood.
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec3 vGrain;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGrain = position;');
    shader.fragmentShader = 'varying vec3 vGrain;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float grain = sin(dot(vGrain, vec3(117.1,231.7,157.3))) * sin(dot(vGrain,vec3(263.1,93.7,71.9)));
      float coverage = 1.0 - smoothstep(.008, .035, length(fwidth(vGrain)));
      diffuseColor.rgb *= 1.0 + .018 * grain * coverage;`);
  };
  material.customProgramCacheKey = () => 'landfall-grain-v1';
  const mineral = material.clone();
  mineral.onBeforeCompile = shader => {
    material.onBeforeCompile(shader);
    shader.uniforms.uMineral = { value: getTexture('rock_height') };
    shader.fragmentShader = 'uniform sampler2D uMineral;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec3 blend = pow(abs(normalize(cross(dFdx(vGrain), dFdy(vGrain)))),vec3(4.0));
      blend /= max(.001,blend.x+blend.y+blend.z);
      vec3 mineral = texture2D(uMineral,vGrain.yz*.23).rgb*blend.x
                   + texture2D(uMineral,vGrain.xz*.23).rgb*blend.y
                   + texture2D(uMineral,vGrain.xy*.23).rgb*blend.z;
      float detail = dot(mineral,vec3(.3,.59,.11));
      diffuseColor.rgb *= .82 + detail*.4;`);
  };
  mineral.customProgramCacheKey = () => 'landfall-mineral-v3';
  const shaftMaterial = material.clone();
  shaftMaterial.onBeforeCompile = shader => {
    material.onBeforeCompile(shader);
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float row = floor(vGrain.y*2.4);
      vec2 joint = vec2(atan(vGrain.x,vGrain.z)*5.0 + mod(row,2.0)*.5,vGrain.y*2.4);
      vec2 edge = min(fract(joint),1.0-fract(joint));
      float mortar = 1.0-smoothstep(.012,.028,min(edge.x,edge.y));
      diffuseColor.rgb *= 1.0 - mortar*.22;
      float stain = sin(atan(vGrain.x,vGrain.z)*71.0)*.018 + sin(vGrain.y*.61)*.022;
      diffuseColor.rgb *= 1.0 + stain;`);
  };
  shaftMaterial.customProgramCacheKey = () => 'landfall-masonry-v2';
  const geometry = new Map();
  function part(name) {
    if (!geometry.has(name)) {
      const src = library.getObjectByName(name);
      if (!src?.isMesh) throw Error('Missing Landfall mesh: ' + name);
      src.updateMatrix();
      geometry.set(name, src.geometry.clone().applyMatrix4(src.matrix));
    }
    const mesh = new THREE.Mesh(geometry.get(name), name.startsWith('towerShaft') ? shaftMaterial : /basalt|Arch|vaultRib/.test(name) ? mineral : material);
    mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  }
  for (const name of ['towerShaft', 'towerStair', 'towerRails']) {
    const mesh = part(name); core.getObjectByName('lighthouse').add(mesh);
  }
  const foot = core.getObjectByName('stairFoot'), top = core.getObjectByName('galleryHatch'), rope = core.getObjectByName('stairRope');
  const bottom = stairPose(0), end = stairPose(1);
  foot.position.set(bottom.x - TOWER.x, .03, bottom.z - TOWER.z);
  top.position.set(end.x - TOWER.x, TOWER.rise + .03, end.z - TOWER.z);
  for (const [anchor, length] of [[foot, 1.05], [top, .8]]) {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(length, .07, .24), new THREE.MeshStandardMaterial({ color: 0x668e7a, metalness: .65, roughness: .45 }));
    anchor.add(edge);
  }
  foot.rotation.y = bottom.angle; top.rotation.y = end.angle;
  rope.position.copy(foot.position); rope.rotation.y = bottom.angle;
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,1.15,6),new THREE.MeshStandardMaterial({color:0xa6936b}));
  cord.rotation.z=Math.PI/2;cord.position.y=.9;rope.add(cord);
  // Landing from the stair through the open lantern doorway to the outside gallery.
  const landing = new THREE.Mesh(new THREE.BoxGeometry(1.16,.13,1.86),new THREE.MeshStandardMaterial({color:0x746d50,roughness:.7,metalness:.35}));
  landing.name='towerLanding';landing.position.set(TOWER.x+Math.sin(end.angle)*2.15,TOWER_TOP-.065,TOWER.z+Math.cos(end.angle)*2.15);landing.rotation.y=end.angle;core.add(landing);
  const log = new THREE.Group();log.name='towerLog';
  const lectern=new THREE.Mesh(new THREE.BoxGeometry(.46,.12,.36),new THREE.MeshStandardMaterial({color:0x665943,roughness:.85}));
  const page=new THREE.Mesh(new THREE.BoxGeometry(.31,.025,.26),new THREE.MeshStandardMaterial({color:0xdadac2,roughness:.95}));page.position.y=.08;log.add(lectern,page);
  const stand=new THREE.Mesh(new THREE.CylinderGeometry(.035,.055,.9,8),new THREE.MeshStandardMaterial({color:0x344d49,roughness:.7}));stand.position.y=-.5;log.add(stand);
  log.position.set(TOWER.x-2.8,TOWER_TOP+1,TOWER.z-.7);log.rotation.y=-Math.PI/2;core.add(log);
  const ribs = new THREE.Group(); ribs.name='vaultRibs';core.add(ribs);
  for (const x of [128.6,132,135.4]) {const rib=part('vaultRib');rib.position.set(x,4,-150);rib.rotation.y=Math.PI/2;ribs.add(rib);}
  for (const x of [93.4,97,100.6]) {const rib=part('vaultRib');rib.position.set(x,18.3,18.4);rib.rotation.y=Math.PI/2;ribs.add(rib);}
  for (const x of [81.3,86.2,90.7]) {const rib=part('vaultRib');rib.position.set(x,17.5,18.4);rib.rotation.y=Math.PI/2;rib.scale.x=1.25;ribs.add(rib);}
  // Recessed limewash: mortar follows world metres, and damp gathers by the floor.
  // The low emissive floor keeps the unlit drain readable without a tenth light.
  const limewash = new THREE.MeshStandardMaterial({ color: 0x707c76, roughness: .97,
    emissive: 0x35443e, emissiveIntensity: .32, side: THREE.DoubleSide });
  limewash.onBeforeCompile = s => {
    s.vertexShader = 'varying vec3 vRoom;\n' + s.vertexShader;
    s.vertexShader = s.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvRoom = (modelMatrix * vec4(transformed,1.0)).xyz;');
    s.fragmentShader = `varying vec3 vRoom;
      float roomHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float roomNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(roomHash(i),roomHash(i+vec2(1,0)),f.x),mix(roomHash(i+vec2(0,1)),roomHash(i+vec2(1,1)),f.x),f.y);}
    ` + s.fragmentShader;
    s.fragmentShader = s.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec3 axis=abs(normalize(cross(dFdx(vRoom),dFdy(vRoom))));
      vec2 uv=axis.y>.6?vRoom.xz:axis.x>.6?vRoom.zy:vRoom.xy;
      vec2 courses=uv*vec2(.75,2.2);courses.x+=mod(floor(courses.y),2.0)*.5;
      vec2 edge=min(fract(courses),1.0-fract(courses));
      float seam=1.0-smoothstep(.014,.034,min(edge.x,edge.y));
      float plaster=roomNoise(uv*3.1)*.65+roomNoise(uv*13.7)*.35;
      float floorY=vRoom.z< -100.0?4.0:17.5;
      float damp=1.0-smoothstep(floorY+.15,floorY+1.7+roomNoise(uv*.9)*.6,vRoom.y);
      diffuseColor.rgb *= (.88+plaster*.18)*(1.0-seam*.21)*(1.0-damp*.20);
      totalEmissiveRadiance *= .7+plaster*.3;
    `);
  };
  limewash.customProgramCacheKey = () => 'landfall-limewash-v1';
  for (const root of [core.getObjectByName('drain'), core.getObjectByName('cellar')]) {
    root?.traverse(o => { if(o.isMesh){
      o.receiveShadow=true;o.castShadow=true;
      if(o.parent?.name==='vaultVista')return;
      if(o.geometry.type==='PlaneGeometry' && !o.material.transparent && !o.name && !o.material.emissive?.getHex())o.material=limewash;
      // The drain shell's former flat emissive material also belongs to the walls.
      if(o.geometry.type==='PlaneGeometry' && o.material.emissive?.getHex()===0x46423a)o.material=limewash;
    } });
  }
  const vault = core.getObjectByName('vaultVista');
  if (vault) {
    const oldTower=vault.children.find(o=>o.geometry?.parameters?.height===24);
    oldTower?.removeFromParent();
    vault.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.fog=false;}});
    const inverted=part('towerShaft');inverted.material=shaftMaterial.clone();inverted.material.onBeforeCompile=shaftMaterial.onBeforeCompile;inverted.material.customProgramCacheKey=shaftMaterial.customProgramCacheKey;inverted.material.color.set(0x596f76);inverted.material.fog=false;inverted.position.set(127,46,18.4);inverted.rotation.z=Math.PI;inverted.scale.setScalar(1.2);inverted.castShadow=false;vault.add(inverted);
    for (const [x,z,s] of [[110,8,1.3],[115,29,1.8],[134,7,2],[147,25,1.6]]) {
      const pillar=part('basaltA');pillar.material=mineral.clone();pillar.material.onBeforeCompile=mineral.onBeforeCompile;pillar.material.customProgramCacheKey=mineral.customProgramCacheKey;pillar.material.color.set(0x35474d);pillar.material.vertexColors=false;pillar.material.fog=false;pillar.position.set(x,12,z);pillar.scale.set(2.4*s,10,2.7*s);pillar.castShadow=false;vault.add(pillar);
    }
  }
  const archive=part('archiveFurniture');archive.position.set(86.3,17.5,22);core.add(archive);
  const tin = new THREE.Group();tin.name='archiveTin';tin.position.set(88.4,18.87,21.41);
  const lid=new THREE.Mesh(new THREE.BoxGeometry(.60,.035,.30),new THREE.MeshStandardMaterial({color:0x537b71,metalness:.6,roughness:.58}));lid.position.z=.15;tin.add(lid);core.add(tin);
  // Actual stone thresholds bridge the cellar and lower western room.
  for (const [x,y] of [[92.2,18.0],[91.7,17.75]]) {
    const step=new THREE.Mesh(new THREE.BoxGeometry(.5,.25,4.6),new THREE.MeshStandardMaterial({color:0x696e61,roughness:.95}));step.position.set(x,y-.125,18.4);ribs.add(step);
  }
  // Sculpted headland: a sea arch west of the arrival, with real open space below it.
  const arch=part('headlandArch');arch.position.set(-105,heightAt(-105,-86)-.4,-86);arch.rotation.y=-.62;core.add(arch);
  for(const side of [-1,1]){const q=new THREE.Vector3(side*6.5,0,0).applyAxisAngle(new THREE.Vector3(0,1,0),-.62);addCollider(-105+q.x,-86+q.z,2.15);}
  for(const [x,z,s,yaw] of [[-112,-71,2.7,.4],[-106,-79,2.2,-.2],[-96,-89,2.5,1.2],[-53,-79,1.4,.8],[-31,-95,1.1,-.1],[148,-168,2.4,.3],[151,-164,1.7,-.8]]){
    const rock=part(x%2?'basaltA':'basaltB');rock.position.set(x,heightAt(x,z)-s*.13,z);rock.scale.set(s,s*.8,s*.8);rock.rotation.y=yaw;core.add(rock);addCollider(x,z,s*.73);
  }
  const pines=new THREE.Group();pines.name='coastalPines';core.add(pines);
  for(const [x,z,s,a] of [[-57,-73,1.1,-.3],[-49,-82,.9,.15],[-105,-51,1.2,-.2]]){
    const lod=new THREE.LOD();const near=new THREE.Group();near.add(part('windPineWood'),part('windPineNeedles'));
    const far=part('windPineFar');far.castShadow=false;
    lod.addLevel(near,0);lod.addLevel(far,52);lod.position.set(x,heightAt(x,z),z);lod.rotation.y=a;lod.scale.setScalar(s);pines.add(lod);addCollider(x,z,.32*s);
  }
  let state, notebook, ui, saved, player;
  return {
    bind({W,notebook:notes,UI,save,player:p,interact,modelRoot}) {
      const mini=part('towerShaftFar');mini.position.set(TOWER.x,TOWER.base,TOWER.z);mini.castShadow=false;modelRoot.add(mini);
      state=W;notebook=notes;ui=UI;saved=save;player=p;
      interact.add({id:'towerLog',targets:[log],label:'the watch book',maxDist:2.5,when:()=>W.atTop,onClick:()=>UI.openReader('watch_book')});
      interact.add({id:'archiveTin',targets:[lid],label:()=>W.flags.archiveTinOpened?'papers in the bread tin':'open the bread tin',maxDist:2.7,
        when:()=>W.flags.hatchOpen&&p.pos.y<19,onClick:()=>{W.flags.archiveTinOpened=true;notebook.record('event.archive-opened');UI.openReader('drying_papers');save(p);}});
    },
    tick() {
      if(!state)return;
      tin.rotation.x=state.flags.archiveTinOpened ? -1.7 : 0;
      if(state.atTop&&!state.flags.towerVisited){state.flags.towerVisited=true;notebook.record('place.lamp-gallery');ui.whisperNow('From here you can see the water on both sides of the causeway.');saved(player);}
    },
  };
}
