// harbor.js — authored Blender rooms and the small boat's playable homecoming.
// Fictional objects only. No source biography or private narrative is bundled.
import * as THREE from 'three';
import { heightAt } from './terrain.js';

export function attachHarborRooms(core, library) {
  const q = core.getObjectByName('quarters');
  if (!q) throw new Error('The harbor room requires the east-room shell');
  const part = (name) => {
    const src = library.getObjectByName(name);
    if (!src) throw new Error(`Missing authored harbor part: ${name}`);
    const obj = src.clone(true);
    obj.name = name;
    obj.traverse((mesh) => {
      if (!mesh.isMesh) return;
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.material.side = THREE.DoubleSide;
    });
    return obj;
  };
  for (const name of ['legacyCot', 'legacyStove', 'legacyRoomSketch']) q.getObjectByName(name)?.removeFromParent();
  for (const name of ['roomStructure', 'roomCloth', 'roomCeramics']) q.add(part(name));
  const chair = part('spareChair'); q.add(chair);
  const mobile = part('listeningMobile'); mobile.position.set(-.7, 0, .15); q.add(mobile);
  const boat = part('keepsakeBoat'); boat.position.z = -.22; q.add(boat);
  const bench = part('tideBench');
  // The dry end of the wade-line, on existing walkable ground. No new collider.
  bench.position.set(9.5, heightAt(9.5, -94), -94); bench.rotation.y = -.4;
  core.getObjectByName('region2').add(bench);
  const cradle = part('sourceCradle');
  cradle.position.set(-82.8, heightAt(-82.8, -42.8), -42.8); cradle.rotation.y = .2;
  core.getObjectByName('region4').add(cradle);

  let sailing, miniature, getWaterY;
  const boatLocal = new THREE.Vector3(.33, .74, 1.82);
  return {
    bind({ W, interact, player, notebook, UI, save, A, modelRefs, modelRoot, waterY }) {
      getWaterY = waterY;
      // The toy moves into the existing model sea. The same geometry appears at
      // world scale offshore, keeping the game's one-state / two-scales contract.
      const hull = part('keepsakeBoat');
      // glTF may retain a Blender-to-Y-up node rotation. Bake it before
      // translating in game coordinates; otherwise the hull floats metres high.
      hull.updateMatrix();
      hull.geometry = hull.geometry.clone().applyMatrix4(hull.matrix);
      hull.geometry.translate(-boatLocal.x, -boatLocal.y, -boatLocal.z);
      hull.position.set(0, 0, 0); hull.quaternion.identity(); hull.scale.setScalar(1);
      sailing = new THREE.Group(); sailing.name = 'releasedBoat'; hull.scale.setScalar(36); sailing.add(hull); core.add(sailing);
      miniature = sailing.clone(true); miniature.name = 'releasedBoatModel'; modelRoot.add(miniature);
      interact.add({ id: 'spareChair', targets: [chair], label: () => W.flags.placeMade ? 'the note under the spare chair' : 'pull out the spare chair', maxDist: 2.8,
        when: () => W.level === 1,
        onClick: () => {
          if (!W.flags.placeMade) { W.flags.placeMade = true; notebook.record('event.place-made'); A.crankTick(); }
          UI.openReader('spare_place'); save(player);
        },
      });
      interact.add({ id: 'keepsakeBoat', targets: [boat], label: () => W.flags.returned ? 'take the little boat to the model sea' : 'the stitched boat', maxDist: 2.8,
        when: () => W.level === 1 && !W.flags.boatCarried && !W.flags.boatLaunched,
        onClick: () => {
          if (!W.flags.returned) { UI.whisperNow('Blue thread through a split in the wood. The little boat is waiting beside the cups.'); return; }
          W.flags.boatCarried = true; A.chime();
          UI.whisperNow('It fits in your hand. There is water in the model bay, through the study door.'); save(player);
        },
      });
      interact.add({ id: 'launchBoat', targets: [modelRefs.water], label: 'set the little boat in the model sea', maxDist: 3.8,
        when: () => W.level === 1 && W.flags.returned && W.flags.boatCarried && !W.flags.boatLaunched,
        onClick: () => {
          if (W.level !== 1 || !W.flags.returned || !W.flags.boatCarried || W.flags.boatLaunched) return;
          // One persisted transition owns both scales and survives Continue.
          W.flags.boatCarried = false; W.flags.boatLaunched = true;
          notebook.record('event.boat-launched');
          A.chime(); UI.whisperNow('One end sits low. It floats. Outside the window, a blue-stitched hull moves across the bay.'); save(player);
        },
      });
      interact.add({ id: 'boatAfterword', targets: [miniature], label: 'the little boat, afloat', maxDist: 3.8,
        when: () => W.level === 1 && W.flags.boatLaunched,
        onClick: () => UI.openReader('boat_return'),
      });
      interact.add({ id: 'tideBench', targets: [bench], label: 'the dry end of the bench', maxDist: 2.8,
        when: () => W.level === 2,
        onClick: () => UI.openReader('kelp_slate'),
      });
      interact.add({ id: 'sourceCradle', targets: [cradle], label: 'the unfinished boat on the bench', maxDist: 2.8,
        when: () => W.level === 4,
        onClick: () => UI.openReader('source_note'),
      });
    },
    tick(W, dt, elapsed) {
      const target = W.flags.placeMade ? -.42 : 0;
      chair.position.z += (target - chair.position.z) * (W.reduceMotion ? 1 : 1 - Math.exp(-dt * 5));
      mobile.rotation.y = W.reduceMotion ? 0 : Math.sin(elapsed * .24) * .032;
      boat.visible = !W.flags.boatCarried && !W.flags.boatLaunched;
      if (!sailing) return;
      sailing.visible = miniature.visible = W.flags.boatLaunched && W.level === 1;
      const phase = W.reduceMotion ? 0 : elapsed * .23;
      sailing.position.set(28 + Math.sin(phase * .16) * 4, getWaterY() - .30 + Math.sin(phase) * .05, -165);
      sailing.rotation.set(Math.sin(phase * .8) * .025, .45, Math.cos(phase) * .018);
      miniature.position.copy(sailing.position); miniature.quaternion.copy(sailing.quaternion);
    },
  };
}
