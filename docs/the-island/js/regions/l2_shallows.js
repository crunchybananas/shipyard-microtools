// L2 — THE SHALLOWS (#71): region2's content, the first drowned stratum. A kelp
// avenue over the sunk causeway, fish-shadow life, the Tide-Figure encounter, and the
// keeper's kelp slate. rng streams in use here: kelp SEED^0x4e19, fish SEED^0xf15a
// (exact salts preserved from the buildWorld blocks — the scatter is byte-identical).
// New L2 content takes its own fresh salt; never touch another site's stream.
import * as THREE from 'three';
import { mulberry32, SEED, TAU, addDrive } from '../util.js';
import { heightAt } from '../terrain.js';
import { defineProp } from '../props.js';

export function build({ region2 }) {
  // ERA EVENT L2 (#130, AAA-A2): a climber's rope on the wade-line, tied off by a hand
  // that meant to come back — and STILL SWINGING when you arrive. Motion where nothing
  // should move: the arrival years have not finished happening. The swing decays over
  // ~a minute of being watched and never resets to full; it is never explained.
  {
    const post = new THREE.Group();
    post.name = 'climberRope';
    const wood = new THREE.MeshStandardMaterial({ color: 0x4a3a26, roughness: 1 });
    const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.075, 2.4, 6), wood);
    stake.position.y = 1.2; stake.castShadow = true; post.add(stake);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.7, 6), wood);
    arm.rotation.z = Math.PI / 2; arm.position.set(0.32, 2.28, 0); arm.castShadow = true; post.add(arm);
    // the rope: five chained segments under a pivot at the arm's tip, tip kissing the
    // L2 waterline (~+1.47) so the swing writes rings on the surface
    const pivot = new THREE.Group();
    pivot.position.set(0.62, 2.26, 0);
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0x8a7a58, roughness: 1 });
    let py = 0;
    for (let si = 0; si < 5; si++) {
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.02, 0.26, 5), ropeMat);
      seg.position.set(Math.sin(si * 0.5) * 0.015, py - 0.13, 0);
      pivot.add(seg);
      py -= 0.25;
    }
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), ropeMat);
    knot.position.y = py; pivot.add(knot);
    post.add(pivot);
    const rx = 6.5, rz = -97.5;
    post.position.set(rx, Number.isFinite(heightAt(rx, rz)) ? heightAt(rx, rz) : 0, rz);
    post.rotation.y = -0.4;
    defineProp('climberRope');
    region2.add(post);
    // the swing, registered beside what it drives (#73 scheduler): pendulum with a slow
    // decay clock that only runs while the player is IN the arrival years
    let watched = 0;
    addDrive((w) => w.level === 2, (dt, elapsed) => {
      watched += dt;
      const amp = 0.5 * Math.exp(-watched / 45) + 0.02;   // never fully still — the era idles
      pivot.rotation.x = amp * Math.sin(elapsed * 1.85);
      pivot.rotation.z = amp * 0.35 * Math.cos(elapsed * 1.31);
    });
  }

  // SEA-STRATA L2 "shallows" (loop #119): a kelp forest along the sunk causeway + south-shore
  // shallows — submerged at the raised L2 tide, so diving here wades a drowned kelp avenue, not the
  // dry beach. One InstancedMesh (1 draw), swaying on the wave clock (main.js drives uTime on the
  // named 'kelp' material). region2-only (pruned from the clone). Own rng so it never shifts the
  // world scatter.
  {
    const kr = mulberry32(SEED ^ 0x4e19);
    const frond = new THREE.PlaneGeometry(0.55, 4.2, 1, 5);
    frond.translate(0, 2.1, 0);                       // base at y=0, rises up
    const kelpMat = new THREE.MeshStandardMaterial({ color: 0x3c5a3e, roughness: 0.8, side: THREE.DoubleSide });
    kelpMat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = { value: 0 };
      kelpMat.userData.shader = sh;
      sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        #ifdef USE_INSTANCING
          float kw = instanceMatrix[3].x * 0.21 + instanceMatrix[3].z * 0.17;   // per-frond phase
          // position.y is metres (0..4.2), not a 0..1 bend weight. Raising it
          // to 1.6 used to turn 55 cm of sway into FIVE metres at the tip: the
          // shallows arrived as giant black blades crossing the whole frame.
          float kh = pow(clamp(position.y / 4.2, 0.0, 1.0), 1.6);               // tips sway most
          transformed.x += sin(uTime * 0.7 + kw) * 0.42 * kh;                   // slow languid underwater drift
          transformed.z += cos(uTime * 0.55 + kw * 1.3) * 0.30 * kh;
        #endif
      `).replace('void main() {', 'uniform float uTime;\nvoid main() {');
    };
    const KN = 420;
    const kelp = new THREE.InstancedMesh(frond, kelpMat, KN);
    kelp.name = 'kelp'; kelp.castShadow = false; kelp.receiveShadow = false;
    const km = new THREE.Matrix4(), kq = new THREE.Quaternion(), ke = new THREE.Euler(), kc = new THREE.Color();
    let ki = 0;
    const plantKelp = (x, z) => {
      const h = heightAt(x, z);
      const L2_WATER = 1.47;
      if (!Number.isFinite(h)) return;
      const room = L2_WATER - h - 0.18;
      if (room < 0.55) return;                          // enough water for a real submerged frond

      // The arrival is a composed sightline, not a roulette wheel. Keep a wading
      // pocket around the actual rescued spawn and a narrow view corridor toward
      // the lighthouse; fronds remain on both sides to frame it.
      const sx = 1.9, sz = -104.1, yaw = 2.19;
      const dx = x - sx, dz = z - sz;
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      const ahead = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      if (Math.hypot(dx, dz) < 4.2 || (ahead > -1.5 && ahead < 27 && side < 3.2)) return;

      // Kelp belongs UNDER this waterline. The old independent y-scale could
      // make an 11 m frond in 1.5 m of water, which read as a land-sized fence.
      const stalkH = Math.min(room, 0.8 + kr() * 1.45);
      const s = 0.62 + kr() * 0.56;
      km.compose(new THREE.Vector3(x, h, z),
        kq.setFromEuler(ke.set((kr() - 0.5) * 0.22, kr() * TAU, (kr() - 0.5) * 0.22)),
        new THREE.Vector3(s, stalkH / 4.2, s));
      kelp.setMatrixAt(ki, km);
      kc.setHSL(0.32 + kr() * 0.07, 0.32 + kr() * 0.18, 0.2 + kr() * 0.13);
      kelp.setColorAt(ki, kc); ki++;
    };
    for (let i = 0; i < KN * 5 && ki < KN; i++) {
      let x, z;
      if (kr() < 0.6) { x = -38 + kr() * 96; z = -98 - kr() * 16; }                 // south-shore shallows band
      else { const t = kr(); x = 48 + 64 * t + (kr() - 0.5) * 10; z = -78 - 54 * t + (kr() - 0.5) * 10; }  // sunk causeway A→B
      plantKelp(x, z);
    }
    kelp.count = ki; kelp.instanceMatrix.needsUpdate = true;
    if (kelp.instanceColor) kelp.instanceColor.needsUpdate = true;
    region2.add(kelp);
  }

  // SEA-STRATA L2 LIFE (loop #143): a few fish-shadows gliding over the kelp floor — dark, flat,
  // unlit silhouettes that drift in slow circles (driven in main.js updateEnv by elapsed). region2
  // only → pruned from the clone. Power: 7 tiny transparent meshes sharing one geo+mat, no shadow.
  {
    const fishShadows = new THREE.Group();
    fishShadows.name = 'fishShadows';
    // a flat fish silhouette, baked flat in XZ with the nose toward +x (so per-fish needs only a Y-heading)
    const fs = new THREE.Shape();
    fs.moveTo(0.52, 0);
    fs.quadraticCurveTo(0.0, 0.17, -0.44, 0.12);
    fs.lineTo(-0.72, 0.24);
    fs.lineTo(-0.58, 0);
    fs.lineTo(-0.72, -0.24);
    fs.lineTo(-0.44, -0.12);
    fs.quadraticCurveTo(0.0, -0.17, 0.52, 0);
    const fishGeo = new THREE.ShapeGeometry(fs);   // VERTICAL body (XY plane, nose +x): a fish swims upright,
    // so its broad side profile reads from the wading player's eye-level view; only rotation.y (heading) is set.
    const fishMat = new THREE.MeshBasicMaterial({ color: 0x0a1a1c, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
    const fr = mulberry32(SEED ^ 0xf15a);
    let placed = 0;
    for (let i = 0; i < 90 && placed < 7; i++) {
      const cx = 2 + fr() * 26, cz = -113 + fr() * 13;     // over the FLOODED south-shore kelp shelf (z -113..-100), near spawn
      const h = heightAt(cx, cz);
      if (!Number.isFinite(h) || h > 0.3) continue;          // only the genuinely-drowned floor, so fish sit ABOVE it
      const fish = new THREE.Mesh(fishGeo, fishMat);
      fish.scale.setScalar(0.9 + fr() * 0.8);
      // suspend them in the UPPER water — above the kelp (so they read as dark silhouettes, not lost
      // on the floor) yet always under the L2 surface (~+1.47).
      const baseY = 0.7 + fr() * 0.45;
      fish.userData = { cx, cz, r: 1.8 + fr() * 3.0, y: baseY, spd: 0.12 + fr() * 0.16, ph: fr() * TAU };
      fish.position.set(cx, baseY, cz);
      fishShadows.add(fish);
      placed++;
    }
    region2.add(fishShadows);
  }

  // SEA-STRATA L2 encounter: the TIDE-FIGURE — a soft dark humanoid waist-deep in the kelp.
  // It disperses when you wade for it; it settles when you stand still and watch. Driven in
  // puzzles _tickEncounters. region2-only (pruned from the clone). Starts hidden + inactive.
  {
    const tf = new THREE.Group();
    tf.name = 'tideFigure'; tf.visible = false;
    const tmat = new THREE.MeshStandardMaterial({ color: 0x182a2c, emissive: 0x081416, emissiveIntensity: 0.45,
      transparent: true, opacity: 0.8, roughness: 1, flatShading: true });
    tf.userData.mats = [tmat];
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.62, 1.7, 7), tmat);
    body.position.y = 0.85; tf.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), tmat);
    head.position.y = 1.78; head.scale.set(1, 1.12, 1); tf.add(head);
    const tfx = 12, tfz = -100;
    tf.position.set(tfx, Number.isFinite(heightAt(tfx, tfz)) ? heightAt(tfx, tfz) : 0, tfz);
    tf.castShadow = false; tf.receiveShadow = false;
    region2.add(tf);
  }

  // SEA-STRATA L2 hidden fragment (loop #132): a wax slate tangled in the kelp — the keeper's
  // note from his FIRST shallow descent, and a diegetic hint for the Tide-Figure (wade at it and
  // it scatters; be still and it resolves). Placed on the wade-line between the L2 spawn (4,-104)
  // and the figure (12,-100), so you find the hint, then look up and see what it describes.
  // region2-only → pruned from the clone with its parent; read only at L2 (puzzles when-guard).
  {
    const slate = new THREE.Group();
    slate.name = 'kelpSlate';
    // a driftwood stake driven into the kelp bed — so the slate breaks the raised L2 surface
    // (water sits ~+1.5 here; a floor-level note would drown). A marker, where he first went down.
    const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, 1.7, 6),
      new THREE.MeshStandardMaterial({ color: 0x4a3a26, roughness: 1 }));
    stake.position.y = 0.85; stake.castShadow = true; slate.add(stake);
    // the slate mounted near the top, leaning, face toward the one wading out
    const head = new THREE.Group();
    head.position.y = 1.5; head.rotation.set(-0.16, 2.4, 0.1);
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.54, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x5c4a30, roughness: 0.95 }));        // driftwood backing
    board.castShadow = true;
    const wax = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.44, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x241f18, roughness: 0.85 }));        // dark wax face
    wax.position.z = 0.02; head.add(board, wax);
    // a few hair-fine incised lines, paler where the stylus cut the wax (close-up detail)
    const inkMat = new THREE.MeshStandardMaterial({ color: 0x9a8f72, roughness: 1, emissive: 0x14110b, emissiveIntensity: 0.2 });
    for (let li = 0; li < 4; li++) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.22 - (li % 2) * 0.05, 0.012, 0.01), inkMat);
      line.position.set(-0.02 + (li % 2) * 0.02, 0.14 - li * 0.09, 0.055);
      head.add(line);
    }
    slate.add(head);
    const sx = 8, sz = -101;
    slate.position.set(sx, (Number.isFinite(heightAt(sx, sz)) ? heightAt(sx, sz) : 0), sz);
    slate.receiveShadow = false;
    region2.add(slate);
  }
}
