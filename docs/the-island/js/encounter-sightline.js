// Regard means the figure is actually in view, with no stone or wall in between.
import * as THREE from 'three';
import { heightAt } from './terrain.js';

export function makeEncounterSightline(core) {
  const solids=[];
  const names=new Set(['rocks','erratics','staticRock','staticStone','towerShaft','towerShaftFar','headlandArch','studyPlaster','vaultWalls','trunks']);
  function gather(o){if(o.name==='modelAnchor')return;if(o.isMesh&&(names.has(o.name)||o.parent?.name==='canopies'))solids.push(o);for(const c of o.children)gather(c);}
  gather(core);
  const ray=new THREE.Raycaster(), eye=new THREE.Vector3(), head=new THREE.Vector3(), screen=new THREE.Vector3();
  const from=new THREE.Vector3(), to=new THREE.Vector3();
  return (player,figure)=>{
    player.camera.updateMatrixWorld(true);figure.updateWorldMatrix(true,false);
    player.camera.getWorldPosition(eye);
    head.set(0,1.48,0);figure.localToWorld(head);
    screen.copy(head).project(player.camera);
    if(Math.abs(screen.x)>1||Math.abs(screen.y)>1||screen.z< -1||screen.z>1)return false;
    from.copy(eye);to.copy(head);core.worldToLocal(from);core.worldToLocal(to);
    const distance=eye.distanceTo(head),steps=Math.ceil(from.distanceTo(to)/.6);
    for(let i=1;i<steps;i++){
      const t=i/steps,x=from.x+(to.x-from.x)*t,z=from.z+(to.z-from.z)*t;
      if(heightAt(x,z)>from.y+(to.y-from.y)*t-.04)return false;
    }
    ray.set(eye,head.sub(eye).normalize());ray.far=Math.max(0,distance-.12);
    for(const mesh of solids){
      let shown=true;for(let p=mesh;p&&p!==core;p=p.parent)if(!p.visible){shown=false;break;}
      if(!shown)continue;
      const hits=ray.intersectObject(mesh,false);
      if(!hits.length)continue;
      // The crowns are alpha-tested needle cards: a card quad is mostly air between twigs,
      // and air does not hide a figure. Read the card's coverage at the hit, the way the
      // GPU does, and count only hits that land on needles. (Any other solid blocks outright.)
      if(!mesh.material.alphaMap)return false;
      for(const hit of hits)if(hit.uv&&coverageAt(mesh.material,hit.uv)>=mesh.material.alphaTest)return false;
    }
    return true;
  };
}

// Coverage lookup on an alphaMap, cached per texture as 8-bit samples. Before the image has
// decoded the card is treated as solid (the conservative answer for a regard test).
const _coverage=new WeakMap();
function coverageAt(material,uv){
  const tex=material.alphaMap;
  let c=_coverage.get(tex);
  if(!c){
    const img=tex.image;
    if(!img||!img.width)return 1;
    const cv=document.createElement('canvas');cv.width=img.width;cv.height=img.height;
    const g=cv.getContext('2d',{willReadFrequently:true});g.drawImage(img,0,0);
    c={w:img.width,h:img.height,data:g.getImageData(0,0,img.width,img.height).data};
    _coverage.set(tex,c);
  }
  const u=Math.min(1,Math.max(0,uv.x)),v=tex.flipY?1-Math.min(1,Math.max(0,uv.y)):Math.min(1,Math.max(0,uv.y));
  const x=Math.min(c.w-1,Math.floor(u*c.w)),y=Math.min(c.h-1,Math.floor(v*c.h));
  return c.data[(y*c.w+x)*4+1]/255;   // three.js reads alphaMap from the GREEN channel
}
