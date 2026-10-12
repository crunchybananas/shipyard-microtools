import * as THREE from 'three';
import { totalCargo } from './coop-state.js';

/** A still 3D model of the joint worksite, rendered only when the panel changes. */
export function createCoopView(canvas, cloneModel) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.setClearColor('#c5ded8');
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-5.7, 5.7, 2.5, -2.5, .1, 80);
  camera.position.set(8, 7.5, 11); camera.lookAt(0, .4, 0);
  scene.add(new THREE.HemisphereLight('#fff8e3', '#587969', 2.3));
  const sun = new THREE.DirectionalLight('#ffefd1', 2.8); sun.position.set(-5, 10, 5); scene.add(sun);
  const land = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 5, .35, 48), new THREE.MeshStandardMaterial({ color: '#98b67b', roughness: 1 }));
  land.scale.z = .57; land.position.y = -.2; scene.add(land);
  const road = new THREE.Mesh(new THREE.BoxGeometry(8.2, .025, .32), new THREE.MeshStandardMaterial({ color: '#ded1aa', roughness: 1 })); road.position.set(0, 0, .6); scene.add(road);
  const left = cloneModel('cottage'), right = cloneModel('cottage'); left.position.set(-3, 0, .05); right.position.set(3, 0, .05); scene.add(left, right);
  const model = cloneModel('warehouse'), scaffold = cloneModel('construction'); scene.add(model, scaffold);
  const crates = new THREE.Group(); scene.add(crates);
  const crateGeometry = new THREE.BoxGeometry(.3, .28, .3), crateMaterial = new THREE.MeshStandardMaterial({ color: '#9c7047', roughness: 1 });
  for (let i = 0; i < 8; i++) { const c = new THREE.Mesh(crateGeometry, crateMaterial); c.position.set(-.9 + (i % 4) * .4, .14 + Math.floor(i / 4) * .3, 1.15); crates.add(c); }
  let current = null;
  function draw(room) {
    current = room;
    const rect = canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return;
    renderer.setSize(rect.width, rect.height, false);
    camera.left = -2.65 * rect.width / rect.height; camera.right = -camera.left; camera.updateProjectionMatrix();
    model.visible = !!room?.completed; scaffold.visible = !model.visible;
    right.visible = !!room?.guest;
    const progress = room ? totalCargo(room.totals) / 140 : 0;
    crates.children.forEach((c, i) => { c.visible = i < Math.ceil(progress * 8); });
    renderer.render(scene, camera);
  }
  const observer = new ResizeObserver(() => draw(current)); observer.observe(canvas);
  return { draw };
}
