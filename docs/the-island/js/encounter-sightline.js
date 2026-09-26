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
      if(shown&&ray.intersectObject(mesh,false).length)return false;
    }
    return true;
  };
}
