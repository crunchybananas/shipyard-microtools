// L4 — THE SEABED SOURCE (#71): region4's content, the deepest stratum. The keeper's
// last instruction, weighted with a stone by the chart table. (The tide gauge is
// region4's NARRATIVE landmark but lives in props.js — it is core-parented, visible
// from L1 as the quiet mystery of rings in the air.) No rng streams in use yet —
// new L4 content takes its own mulberry32(SEED ^ salt); never touch another's stream.
import * as THREE from 'three';
import { heightAt } from '../terrain.js';
import { defineProp } from '../props.js';

export function build({ region4 }) {
  // #132: the SOURCE REST — a flat slab beside his last note, where a carried record
  // can be left WITH him instead of filed for the office. The kept pile grows on it
  // (scaled in puzzles _apply by the kept count).
  {
    const rest = new THREE.Group();
    rest.name = 'sourceRest';
    const slab = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.07, 0.44),
      new THREE.MeshStandardMaterial({ color: 0x474b4c, roughness: 1, flatShading: true }));
    slab.position.y = 0.035; rest.add(slab);
    const pile = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.22),
      new THREE.MeshStandardMaterial({ color: 0xcfc7ae, roughness: 0.95 }));
    pile.name = 'sourceRestPile';
    pile.position.y = 0.08; pile.rotation.y = 0.2;
    pile.visible = false;
    rest.add(pile);
    const rx = -84.35, rz = -41.55;
    rest.position.set(rx, (Number.isFinite(heightAt(rx, rz)) ? heightAt(rx, rz) : 13.5) + 0.01, rz);
    rest.rotation.y = 0.3;
    defineProp('sourceRest');
    region4.add(rest);
  }

  // SEA-STRATA L4 'source' hidden fragment (loop #135): a folded note weighted with a stone, left
  // on the study floor by the chart table — the keeper's last instruction, a diegetic frame for the
  // look-back + carry-up. region4's FIRST content; region4-only → clone-pruned with parent; read at L4.
  {
    const note = new THREE.Group();
    note.name = 'sourceNote';
    const paperMat = new THREE.MeshStandardMaterial({ color: 0xd8cca8, roughness: 0.9, side: THREE.DoubleSide, emissive: 0x1a1408, emissiveIntensity: 0.15 });
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.46), paperMat);
    paper.rotation.set(-Math.PI / 2 + 0.16, 0.3, 0); paper.position.y = 0.012;
    const curl = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.16), paperMat);   // a half-curled top edge
    curl.rotation.set(-Math.PI / 2 - 0.5, 0.3, 0); curl.position.set(0.0, 0.06, -0.2);
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.08, 0),
      new THREE.MeshStandardMaterial({ color: 0x3a3d3e, roughness: 1, flatShading: true }));
    stone.position.set(0.03, 0.05, 0.05); stone.scale.set(1, 0.7, 1.15);
    note.add(paper, curl, stone);
    note.children.forEach((c) => { c.castShadow = true; });
    const nx = -83.8, nz = -41.8;
    note.position.set(nx, (Number.isFinite(heightAt(nx, nz)) ? heightAt(nx, nz) : 0) + 0.02, nz);
    note.rotation.y = 0.5;
    region4.add(note);
  }
}
