// Original Blender landing-beach kit. The imagegen timber has one manifest owner.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getTexture, applyRelief } from './assets.js';
import { heightAt, addCollider } from './terrain.js';

export const SHORE_RACK = Object.freeze({ x: -29, z: -96, yaw: -.24 });
export const SHORE_ROCKS = Object.freeze([
  { x: -32.5, z: -101, scale: 1.15, yaw: .3 },
]);

export function attachShoreDetails(core, modelRoot, library) {
  const geometry = new Map();
  function source(name) {
    if (!geometry.has(name)) {
      const part = library.getObjectByName(name);
      if (!part?.isMesh) throw Error('Missing shore detail: ' + name);
      part.updateMatrix();
      geometry.set(name, part.geometry.clone().applyMatrix4(part.matrix));
    }
    return geometry.get(name);
  }
  const palette = new THREE.MeshStandardMaterial({vertexColors: true, roughness: .88, side: THREE.DoubleSide});
  const timber = new THREE.MeshStandardMaterial({color: 0xd0c9b9, roughness: .94, side: THREE.DoubleSide});
  // This is an albedo, not a height source. Grain direction is authored per board.
  timber.map = getTexture('shore_timber');
  const stone = palette.clone();
  applyRelief(stone, 'rock_height', {colorMap: false, normalScale: .22, repeat: [1.6,1.6]});
  const pool = new THREE.MeshStandardMaterial({color: 0x344b46, roughness: .23, metalness: .15, side: THREE.DoubleSide});
  function part(name, material, shadow = false) {
    const mesh = new THREE.Mesh(source(name), material);
    mesh.name = name; mesh.castShadow = shadow; mesh.receiveShadow = true;
    return mesh;
  }
  const root = new THREE.Group(); root.name = 'shoreDetails'; core.add(root);
  const {x,z,yaw} = SHORE_RACK;
  // The long feet are deliberately buried slightly; no corner floats over the sand.
  const y = heightAt(x,z) - .04;
  const rack = new THREE.LOD();rack.name = 'shoreRack';rack.position.set(x,y,z);rack.rotation.y = yaw;
  const near = new THREE.Group();near.name = 'shoreRackNear';
  near.add(part('shoreTimber',timber,true),part('shoreGear',palette,true));
  rack.addLevel(near,0);rack.addLevel(part('shoreMini',palette),42,.12);root.add(rack);
  // Three compact blockers follow the actual rack and creel, leaving its approaches open.
  for (const [lx,lz,r] of [[-.35,.05,.82],[.9,.05,.55],[1.93,-.4,.58]]) {
    addCollider(x+Math.cos(yaw)*lx+Math.sin(yaw)*lz,z-Math.sin(yaw)*lx+Math.cos(yaw)*lz,r);
  }
  const mini = part('shoreMini',palette);mini.name = 'shoreRackMini';
  mini.position.copy(rack.position);mini.rotation.copy(rack.rotation);mini.receiveShadow = false;
  modelRoot.add(mini);
  // The single west-shore cluster batches by material: three draws total, no per-shell objects.
  const instances = SHORE_ROCKS.map(p => {
    const transform = new THREE.Matrix4().compose(new THREE.Vector3(p.x,heightAt(p.x,p.z)-.02,p.z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),p.yaw),new THREE.Vector3(p.scale,p.scale,p.scale));
    addCollider(p.x,p.z,p.scale*.78);
    return transform;
  });
  for (const [name,material,shadow] of [['shoreRock',stone,true],['shoreLife',palette,false],['shorePool',pool,false]]) {
    const copies = instances.map(m=>source(name).clone().applyMatrix4(m));
    const mesh = new THREE.Mesh(mergeGeometries(copies,false),material);
    for(const copy of copies)copy.dispose();
    mesh.name = name;mesh.castShadow = shadow;mesh.receiveShadow = true;root.add(mesh);
  }
  root.userData.authoring = 'Blender shore_details.py';
  root.userData.texture = 'shore_timber';
  root.userData.noPointLights = true;
  return root;
}
