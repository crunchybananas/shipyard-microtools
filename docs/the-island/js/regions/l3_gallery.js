// L3 — THE GALLERY BLUFF (#71): region3's content, the middle drowned stratum. The
// keeper's cairn vantage over the drowned hall and the listing bell-buoy that marks
// the flooded channel. No rng streams in use yet — new L3 content takes its own
// mulberry32(SEED ^ salt); never touch another site's stream.
import * as THREE from 'three';
import { heightAt } from '../terrain.js';

export function build({ region3 }) {
  // SEA-STRATA L3 hidden fragment (loop #134): a small cairn on the bluff (90,30) — the keeper's
  // high dry vantage over the drowned hall, and a diegetic hint for the Watcher (don't run, don't
  // look away). region3's FIRST content; region3-only → clone-pruned with its parent; read at L3.
  {
    const cairn = new THREE.Group();
    cairn.name = 'bluffCairn';
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6a6e70, roughness: 0.95, flatShading: true });
    const sizes = [[0.7, 0.28], [0.55, 0.24], [0.4, 0.2]];   // [radius, height], stacked bottom→top
    let yy = 0;
    for (let si = 0; si < sizes.length; si++) {
      const [rad, h] = sizes[si];
      const st = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.82, rad, h, 7), stoneMat);
      st.position.set(si % 2 ? 0.06 : -0.05, yy + h / 2, si % 2 ? -0.04 : 0.05);
      st.rotation.y = si * 0.9; st.scale.y = 0.82 + si * 0.05;
      st.castShadow = true; cairn.add(st);
      yy += h * 0.86;
    }
    // a faint cold ring scratched into the top stone — the keeper's sign, just bright enough to
    // find in the deep dark (kept dim, well under the bloom threshold)
    const mark = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.018, 6, 12),
      new THREE.MeshStandardMaterial({ color: 0x9fcfe0, emissive: 0x2a5a66, emissiveIntensity: 0.5, roughness: 1 }));
    mark.position.set(0, yy + 0.02, 0.1); mark.rotation.x = -1.15;
    cairn.add(mark);
    const cx = 91.5, cz = 31.5;
    cairn.position.set(cx, (Number.isFinite(heightAt(cx, cz)) ? heightAt(cx, cz) : 0), cz);
    cairn.receiveShadow = false;
    region3.add(cairn);
  }

  // SEA-STRATA L3 bell-buoy (#52): region3's open-water LANDMARK — an iron channel
  // marker listing in the flooded gap between the bluff and the island, visible from the
  // L3 bluff spawn and passed on the ramp descent. It tolls untended on the swell
  // (puzzles _tickBuoy: damped, distance-faded — L3's sound-led nav) and lands a journal
  // beat when first approached. The channel it marked is under all of this now.
  {
    const buoy = new THREE.Group();
    buoy.name = 'bellBuoy';
    const rust = new THREE.MeshStandardMaterial({ color: 0x8a4b32, roughness: 0.92, flatShading: true });
    const iron = new THREE.MeshStandardMaterial({ color: 0x2e3134, roughness: 0.85, flatShading: true });
    const bronze = new THREE.MeshStandardMaterial({ color: 0x7a6a3c, roughness: 0.6, metalness: 0.35, flatShading: true });
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.78, 0.52, 8), rust);
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.5, 0.4, 8), iron);   // the waterline underbody
    skirt.position.y = -0.42;
    const cage = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.05, 4, 1, true), iron);    // 4-sided open frame tower
    cage.position.y = 0.75;
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 0.22, 8), bronze);
    bell.position.y = 0.62;
    buoy.add(skirt, hull, cage, bell);
    buoy.rotation.set(0.07, 0.6, 0.30);            // listing — long untended
    // floats at the L3 waterline (+2.73; region3 only shows at L3), half-sunk by the list
    buoy.position.set(52, 2.5, 12);
    region3.add(buoy);
  }
}
