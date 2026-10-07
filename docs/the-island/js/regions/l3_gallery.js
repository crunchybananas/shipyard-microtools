// L3 — THE GALLERY BLUFF (#71): region3's content, the middle drowned stratum. The
// keeper's cairn vantage over the drowned hall and the listing bell-buoy that marks
// the flooded channel. No rng streams in use yet — new L3 content takes its own
// mulberry32(SEED ^ salt); never touch another site's stream.
import * as THREE from 'three';
import { heightAt } from '../terrain.js';
import { mergeGeometries } from '../util.js';

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
  //
  // Built as a real channel buoy (player walk, October 2026 — it was a red block with a
  // black fin): a flat-decked float with a skirt and rubbing strake, a four-post lattice
  // tower with cross-braces, the bell hung under a cap with its clapper, a lamp cage on
  // top, and the mooring chain going down into the dark. Vertex colours carry the rust
  // bleeding down from every fitting; one merged geometry, one material, one draw.
  {
    const buoy = new THREE.Group();
    buoy.name = 'bellBuoy';
    const parts = [];
    const tint = new THREE.Color(), tmp = new THREE.Color();
    const RED = new THREE.Color(0x8e3a26), RUST = new THREE.Color(0x5a2e1a), IRON = new THREE.Color(0x2a2d31), BRONZE = new THREE.Color(0x7a6a3c), WEED = new THREE.Color(0x3a4a34);
    const add = (geo, m4, colorAt) => {
      geo.applyMatrix4(m4);
      const pos = geo.attributes.position, cols = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        colorAt(pos.getX(i), pos.getY(i), pos.getZ(i), tint);
        cols[i * 3] = tint.r; cols[i * 3 + 1] = tint.g; cols[i * 3 + 2] = tint.b;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      parts.push(geo);
    };
    const M = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
    // paint that has streaked: red above the waterline fading to rust where water runs, weed and
    // dark iron below it. Keyed on local height; the streaks on azimuth.
    const paint = (x, y, z, c) => {
      const az = Math.atan2(x, z);
      const streak = 0.5 + 0.5 * Math.sin(az * 7.0 + Math.sin(az * 3.0) * 1.7);
      const below = THREE.MathUtils.smoothstep(-y, -0.05, 0.25);
      c.copy(RED).lerp(RUST, 0.25 + 0.55 * streak * THREE.MathUtils.smoothstep(1.1 - y, 0.2, 1.0));
      c.lerp(IRON, below * 0.7).lerp(WEED, below * THREE.MathUtils.smoothstep(-y, 0.2, 0.6) * 0.6);
    };
    const iron = (x, y, z, c) => { const az = Math.atan2(x, z); c.copy(IRON).lerp(RUST, 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(az * 9.0 + y * 4.0))); };
    // the float: a drum with a flared skirt below and a shallow cone deck above
    add(new THREE.CylinderGeometry(0.72, 0.62, 0.42, 14), M(0, 0.0, 0), paint);
    add(new THREE.CylinderGeometry(0.62, 0.34, 0.5, 14), M(0, -0.46, 0), paint);       // skirt into the water
    add(new THREE.CylinderGeometry(0.12, 0.72, 0.16, 14), M(0, 0.29, 0), paint);        // the deck cone
    add(new THREE.TorusGeometry(0.73, 0.045, 6, 20), M(0, 0.14, 0, Math.PI / 2), iron);  // rubbing strake
    // the lattice tower: four raked posts, three courses of horizontal bars, diagonals
    const footR = 0.44, topR = 0.19, H = 1.55, base = 0.36;
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + Math.PI / 4;
      const fx = Math.sin(a) * footR, fz = Math.cos(a) * footR, tx = Math.sin(a) * topR, tz = Math.cos(a) * topR;
      const dx = tx - fx, dz = tz - fz, len = Math.hypot(dx, H, dz);
      const mid = new THREE.Vector3((fx + tx) / 2, base + H / 2, (fz + tz) / 2);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, H, dz).normalize());
      add(new THREE.BoxGeometry(0.055, len, 0.055), new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)), iron);
    }
    for (const [h, t] of [[0.42, 0.04], [0.95, 0.38], [1.48, 0.72]]) {
      const r = footR + (topR - footR) * t, y = base + h;
      for (let k = 0; k < 4; k++) {
        const a0 = k * Math.PI / 2 + Math.PI / 4, a1 = a0 + Math.PI / 2;
        const p0 = new THREE.Vector3(Math.sin(a0) * r, y, Math.cos(a0) * r), p1 = new THREE.Vector3(Math.sin(a1) * r, y, Math.cos(a1) * r);
        const mid = p0.clone().add(p1).multiplyScalar(0.5), d = p1.clone().sub(p0);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
        add(new THREE.BoxGeometry(0.035, d.length(), 0.035), new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)), iron);
        if (h < 1.2) {   // a diagonal across each lower bay
          const r2 = footR + (topR - footR) * (t + 0.34), y2 = y + 0.53;
          const p2 = new THREE.Vector3(Math.sin(a1) * r2, y2, Math.cos(a1) * r2), dd = p2.clone().sub(p0);
          const q2 = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dd.clone().normalize());
          add(new THREE.BoxGeometry(0.028, dd.length(), 0.028), new THREE.Matrix4().compose(p0.clone().add(p2).multiplyScalar(0.5), q2, new THREE.Vector3(1, 1, 1)), iron);
        }
      }
    }
    // the bell, hung under a cap in the middle bay, with its clapper and a flat tongue plate
    const bronze = (x, y, z, c) => c.copy(BRONZE).lerp(WEED, 0.35 * (0.5 + 0.5 * Math.sin(x * 23.0 + z * 17.0))).lerp(RUST, 0.15);
    add(new THREE.CylinderGeometry(0.17, 0.19, 0.04, 10), M(0, base + 1.22, 0), iron);                    // cap plate
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 6), M(0, base + 1.14, 0), iron);                     // hanger
    add(new THREE.CylinderGeometry(0.11, 0.21, 0.26, 12), M(0, base + 0.95, 0), bronze);                   // the bell
    add(new THREE.CylinderGeometry(0.03, 0.045, 0.2, 6), M(0.03, base + 0.86, 0.02, 0, 0, 0.18), bronze);  // clapper, swung a little
    // the lamp cage on top and the lamp itself (dead; the cage is what survives)
    add(new THREE.CylinderGeometry(topR + 0.02, topR + 0.02, 0.05, 8), M(0, base + H + 0.02, 0), iron);
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; add(new THREE.BoxGeometry(0.025, 0.34, 0.025), M(Math.sin(a) * 0.12, base + H + 0.22, Math.cos(a) * 0.12), iron); }
    add(new THREE.CylinderGeometry(0.15, 0.13, 0.05, 8), M(0, base + H + 0.41, 0), iron);
    add(new THREE.CylinderGeometry(0.07, 0.07, 0.2, 8), M(0, base + H + 0.22, 0), (x, y, z, c) => c.setHex(0x2d3a3c));   // the dark lamp glass
    // the mooring chain: links down from the skirt into the water
    for (let i = 0; i < 9; i++) {
      const y = -0.6 - i * 0.26, sway = Math.sin(i * 0.9) * 0.05;
      add(new THREE.TorusGeometry(0.075, 0.018, 5, 10), M(0.18 + sway, y, -0.12, i % 2 ? Math.PI / 2 : 0, i % 2 ? 0 : Math.PI / 2), iron);
    }
    const geo = mergeGeometries(parts.map((g) => g.index ? g.toNonIndexed() : g));
    for (const g of parts) g.dispose();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.28, flatShading: false });
    const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; mesh.receiveShadow = true;
    buoy.add(mesh);
    buoy.rotation.set(0.07, 0.6, 0.30);            // listing — long untended
    // floats at the L3 waterline (+2.73; region3 only shows at L3), half-sunk by the list
    buoy.position.set(52, 2.5, 12);
    region3.add(buoy);
  }
}
