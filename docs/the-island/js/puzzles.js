// puzzles.js — the chain: tide → ruler → birdsong → shadows → beam → dive.
// One Game instance owns all hotspots and applies WorldState to BOTH island
// instances every frame.

import * as THREE from 'three';
import { W, save, isNight, isDawn, isGolden, sunAzimuth, sunElevation, SCALE_MODEL } from './world.js';
import { SPOTS, heightAt } from './terrain.js';
import { BIRD_MELODY, BOX_MELODY, STONE_NOTES, GLYPH_CODE, GLYPHS } from './props.js';
import { Interactions } from './interact.js';
import { UI } from './ui.js';
import A from './audio.js';
import { clamp, lerp, lerpAngle, TAU } from './util.js';

const GLYPH_CHARS = ['◉', '△', '〜', '꩜', '♆', '☾', '◫', '✦'];
const LH = new THREE.Vector3(-85, 13.5, -40);
const CLIFF = new THREE.Vector3(57.5, 14, 50);
const CLIFF_AZ = Math.atan2(CLIFF.x - LH.x, CLIFF.z - LH.z);

export class Game {
  constructor({ refs, modelRefs, modelAnchor, interact, player, onDive, onFinale }) {
    this.refs = refs;
    this.modelRefs = modelRefs;
    this.player = player;
    this.interact = interact;
    this.onDive = onDive;
    this.onFinale = onFinale;

    W.dials = W.dials || [0, 0, 0, 0];

    // eased animation values
    this.anim = {
      chest: 0, vault: 0, hatch: 0, boxLid: 0, innerDoor: 0,
      beamI: 0, shaft: 0, valveSpin: 0, stoneGlow: [0, 0, 0, 0, 0],
      shimmer: 0,
    };
    this.stoneSeq = [];
    this.birdTimer = 8; // sing soon after dawn arrives
    this.boxPlaying = false;

    this._buildHotspots(modelAnchor);
  }

  flag(name, value = true) {
    if (W.flags[name] === value) return false;
    W.flags[name] = value;
    save(this.player.pos);
    return true;
  }

  // one-time beats, persisted so reloads don't replay cinematics
  once(key, fn) {
    W.onceKeys = W.onceKeys || [];
    if (W.onceKeys.includes(key)) return;
    W.onceKeys.push(key);
    save(this.player.pos);
    fn();
  }

  // ---------------------------------------------------------------- hotspots
  _buildHotspots(modelAnchor) {
    const I = this.interact;
    const R = this.refs;

    // brass valve — the tide
    I.add({
      id: 'valve', targets: [R.valveWheel], label: 'the brass valve',
      onClick: () => {
        W.tideTarget = W.tideTarget > 0.5 ? 0 : 1;
        A.chime();
        if (this.flag('valveTurned')) {
          A.addStem(1); W.stems = Math.max(W.stems, 1);
          UI.whisper('Below the window, the sea obeys.');
          UI.addJournal('A valve beside the chart table. When I turn it, the basin drains — and so does the bay.');
        }
        save(this.player.pos);
      },
    });

    // sun crank
    I.add({
      id: 'crank', targets: [R.crankHandle], label: 'the sun crank', type: 'drag',
      onDrag: (dx) => {
        W.time = ((W.time + dx * 0.011) % 24 + 24) % 24;
        this._crankAcc = (this._crankAcc || 0) + Math.abs(dx);
        if (this._crankAcc > 26) { this._crankAcc = 0; A.crankTick(); }
        if (this.flag('crankUsed')) {
          UI.whisper('The little lamp drags the real sun with it.');
          UI.addJournal('A crank turns the orrery lamp around the model — and the sky outside follows it. I hold the hours.');
        }
      },
    });

    // music box
    I.add({
      id: 'musicBox', targets: [R.musicBoxLid.parent], label: 'the music box',
      onClick: () => {
        if (this.boxPlaying) return;
        this.boxPlaying = true;
        BOX_MELODY.forEach((stoneIdx, n) => {
          setTimeout(() => {
            A.pluck(STONE_NOTES[stoneIdx] * 2, 0, 0.4);
            if (n === BOX_MELODY.length - 1) setTimeout(() => { this.boxPlaying = false; }, 900);
          }, n * 620);
        });
        if (this.flag('heardBox')) {
          UI.addJournal('The music box turns five notes: E · G · A · D · C. Someone wound it often.');
        }
      },
    });

    // standing stones
    for (let i = 0; i < 5; i++) {
      I.add({
        id: `stone${i}`, targets: [R[`stone${i}`]], label: 'a humming stone', maxDist: 5.5,
        onClick: () => this._touchStone(i),
      });
    }

    // chest + ruler
    I.add({
      id: 'chest', targets: [R.chestLid.parent], label: 'a half-buried chest',
      when: () => !W.flags.rulerTaken,
      onClick: () => {
        if (!W.flags.chestOpen) {
          this.flag('chestOpen'); A.chime();
          UI.whisper('The hinges remember how.');
        } else if (!W.flags.rulerTaken) {
          this.flag('rulerTaken');
          W.inventory.push('ruler');
          A.chime();
          UI.whisper('A cartographer’s brass rule. Fifteen centimetres of certainty.');
          UI.addJournal('Took a small brass ruler from a chest the tide gave up. It wants to measure something.');
          save(this.player.pos);
        }
      },
    });

    // ---- model hotspots: act small, change big ----
    const proxy = (x, y, z, r) => {
      const p = Interactions.proxy(r * SCALE_MODEL); // radius given in island metres
      p.position.set(x * SCALE_MODEL, y * SCALE_MODEL, z * SCALE_MODEL);
      modelAnchor.add(p);
      return p;
    };

    // the crack in the model (the real chasm)
    const crackProxy = proxy(46.5, 10.5, SPOTS.chasmBridgeZ, 22);
    I.add({
      id: 'crack', targets: [crackProxy], label: 'a crack in the model', maxDist: 3.2, noGlint: true,
      when: () => W.flags.rulerTaken && !W.flags.rulerPlaced,
      onClick: () => {
        this.flag('rulerPlaced');
        W.inventory = W.inventory.filter((s) => s !== 'ruler');
        A.addStem(2); W.stems = Math.max(W.stems, 2);
        A.chime();
        UI.cinematic(true);
        setTimeout(() => UI.cinematic(false), 5200);
        UI.whisper('Across the island, something vast settles into place.');
        UI.addJournal('Laid the ruler over the crack in the model. Out east, a brass bridge now spans the chasm — etched with centimetre marks the size of doors.');
        save(this.player.pos);
      },
    });

    // the model lighthouse: lens slot, then beam aim
    const lampProxy = proxy(LH.x, LH.y + 22.5, LH.z, 26);
    I.add({
      id: 'lensSlot', targets: [lampProxy], label: 'the model lighthouse', maxDist: 3.2, noGlint: true,
      when: () => W.flags.lensTaken && !W.lensPlaced,
      onClick: () => {
        W.lensPlaced = true;
        W.inventory = W.inventory.filter((s) => s !== 'lens');
        A.chime();
        UI.whisper('Far above, glass settles into brass.');
        UI.addJournal('Set the small lens into the model’s lamp room. The real lighthouse has its eye back. It will want the dark.');
        save(this.player.pos);
      },
    });
    I.add({
      id: 'beamAim', targets: [lampProxy], label: 'the model lamp housing', type: 'drag', maxDist: 3.2, noGlint: true,
      when: () => W.lensPlaced,
      onDrag: (dx) => {
        W.beamAngle = (W.beamAngle + dx * 0.006) % TAU;
        this._crankAcc2 = (this._crankAcc2 || 0) + Math.abs(dx);
        if (this._crankAcc2 > 40) { this._crankAcc2 = 0; A.crankTick(); }
      },
    });

    // vault lens item
    I.add({
      id: 'lensItem', targets: [R.lensItem], label: 'the first lens',
      when: () => W.flags.birdSolved && !W.flags.lensTaken,
      onClick: () => {
        this.flag('lensTaken');
        W.inventory.push('lens');
        A.chime();
        UI.whisper('Cold as seawater, clear as morning.');
        save(this.player.pos);
      },
    });

    // hatch shimmer + dials
    I.add({
      id: 'shimmer', targets: [R.hatchShimmer], label: 'troubled sand', maxDist: 6, noGlint: true,
      when: () => isGolden() && !W.flags.shadowRevealed,
      onClick: () => {
        this.flag('shadowRevealed');
        A.chime();
        UI.whisper('The sand slides from a brass door, dialled shut.');
        UI.addJournal('At golden hour the stones’ shadows leaned together, all pointing across the water — to a hatch buried on the bluff. Four glyph dials seal it.');
        save(this.player.pos);
      },
    });
    for (let i = 0; i < 4; i++) {
      I.add({
        id: `dial${i}`, targets: [R[`dial${i}`]], label: 'a glyph dial', maxDist: 4,
        when: () => W.flags.shadowRevealed && !W.flags.hatchOpen,
        onClick: () => {
          W.dials[i] = (W.dials[i] + 1) % GLYPHS;
          A.crankTick();
          if (W.dials.every((d, n) => d === GLYPH_CODE[n])) {
            this.flag('hatchOpen');
            A.chime();
            A.addStem(4); W.stems = Math.max(W.stems, 4);
            UI.whisper('Stone breath, long held, sighs out.');
          }
          save(this.player.pos);
        },
      });
    }

    // plumb bob in the cellar
    I.add({
      id: 'plumb', targets: [R.plumbBob], label: 'a plumb bob',
      when: () => !W.flags.plumbTaken,
      onClick: () => {
        this.flag('plumbTaken');
        W.inventory.push('plumb');
        A.chime();
        UI.whisper('Heavier than it looks. Truer, too.');
        UI.addJournal('In the cellar: a brass plumb bob on a pedestal, and a carving of it hanging over a little island. The chart table has a hook.');
        save(this.player.pos);
      },
    });

    // the hook above the chart table (plus a fat invisible proxy — the torus is tiny)
    const hookProxy = Interactions.proxy(0.45);
    hookProxy.position.copy(R.plumbHook.position);
    R.plumbHook.parent.add(hookProxy);
    I.add({
      id: 'hook', targets: [R.plumbHook, hookProxy], label: 'the plumb hook', maxDist: 6,
      when: () => W.flags.plumbTaken && !W.flags.plumbHung,
      onClick: () => {
        this.flag('plumbHung');
        W.inventory = W.inventory.filter((s) => s !== 'plumb');
        A.chime();
        UI.whisper('It hangs dead-centre over the model. Over the beach where you woke.');
        UI.addJournal('Hung the plumb line. It points at the model’s beach — at a brass plate on the floor, big enough to stand on.');
        save(this.player.pos);
      },
    });

    // the brass floor plate — THE DIVE
    I.add({
      id: 'plate', targets: [R.deskPlate], label: 'the brass plate', maxDist: 3.5,
      when: () => W.flags.plumbHung && !W.flags.dove,
      onClick: () => {
        const d = Math.hypot(this.player.pos.x - R.deskPlate.position.x, this.player.pos.z - R.deskPlate.position.z);
        if (d > 1.0) { UI.whisper('Stand on it.'); return; }
        this.flag('dove');
        this.onDive();
      },
    });

    // the bell — the end
    I.add({
      id: 'bell', targets: [R.bell], label: 'a small bright bell', maxDist: 2.2,
      when: () => W.level >= 2,
      onClick: () => {
        // session-local guard: a reload during the finale must allow re-ringing
        if (this._bellBusy) return;
        this._bellBusy = true;
        this.flag('bellRung');
        this.onFinale();
      },
    });
  }

  _touchStone(i) {
    A.stoneTone(i);
    this.anim.stoneGlow[i] = 1;
    if (W.flags.birdSolved) return;
    this.stoneSeq.push(i);
    const target = BIRD_MELODY;
    const n = this.stoneSeq.length;
    if (this.stoneSeq[n - 1] !== target[n - 1]) {
      // wrong — was it the music box's version they tried?
      const boxPrefix = BOX_MELODY.slice(0, n).join(',') === this.stoneSeq.join(',');
      this.stoneSeq = [];
      setTimeout(() => {
        A.deny();
        if (boxPrefix && W.flags.heardBox) UI.whisper('The stones refuse the box’s song. Something out here sings it differently.');
      }, 700);
    } else if (n === target.length) {
      this.stoneSeq = [];
      this.flag('birdSolved');
      A.addStem(3); W.stems = Math.max(W.stems, 3);
      setTimeout(() => A.chime(), 800);
      UI.whisper('The outcrop opens like a held breath.');
      UI.addJournal('The stones accepted the bird’s correction. A vault in the outcrop holds a small, perfect lens.');
      save(this.player.pos);
    }
  }

  _birdSing() {
    const stonesPos = new THREE.Vector3(SPOTS.stones.x, 9, SPOTS.stones.y);
    const d = this.player.pos.distanceTo(stonesPos);
    if (d > 38) return;
    BIRD_MELODY.forEach((stoneIdx, n) => {
      setTimeout(() => {
        A.chirp(STONE_NOTES[stoneIdx]);
        this.anim.stoneGlow[stoneIdx] = Math.max(this.anim.stoneGlow[stoneIdx], 0.5);
      }, n * 650);
    });
    if (d < 30 && this.flag('heardBird')) {
      UI.addJournal('At dawn a bird on the stones sang the box’s tune — but it bends the fourth note up: E · G · A · G · C. The bird corrects the box.');
      UI.whisper('The bird sings the box’s song. Almost.');
    }
  }

  // ------------------------------------------------------------------- tick
  tick(dt, elapsed) {
    const an = this.anim;
    const F = W.flags;

    // tide easing + valve sound
    const dTide = W.tideTarget - W.tide;
    if (Math.abs(dTide) > 0.0004) {
      W.tide = clamp(W.tide + Math.sign(dTide) * dt / 13, 0, 1);
      an.valveSpin += dt * 4 * Math.sign(dTide);
      A.valveRush(true);
      if (!this._causewayNoted && W.tide < 0.25) {
        this._causewayNoted = true;
        this.once('causeway', () => UI.whisper('The bay gives up a road of wet stone.'));
      }
    } else {
      A.valveRush(false);
    }

    // eased anims
    const ease = (k, target, rate = 2.2) => { an[k] = lerp(an[k], target, 1 - Math.exp(-rate * dt)); };
    ease('chest', W.flags.chestOpen ? 1 : 0);
    ease('vault', F.birdSolved ? 1 : 0, 0.9);
    ease('hatch', F.hatchOpen ? 1 : 0, 1.2);
    ease('boxLid', this.boxPlaying ? 1 : 0, 3);
    ease('innerDoor', W.level >= 2 ? 1 : 0, 1.0);

    // lamp + beam
    W.lampLit = W.lensPlaced && isNight();
    if (W.lampLit && !this._lampLitOnce) {
      this._lampLitOnce = true;
      this.once('lamplit', () => {
        UI.cinematic(true);
        setTimeout(() => UI.cinematic(false), 5000);
        UI.whisper('The lighthouse remembers its eye. Light pours down the tower’s throat onto the model — whose own small lamp is burning.');
        UI.addJournal('At night the lamp burns. A shaft of it falls through the tower onto the model — and the model’s lighthouse glows back. Turning the model’s lamp housing turns the real beam.');
      });
    }
    ease('beamI', W.lampLit ? 1 : 0, 1.5);
    ease('shaft', W.lampLit ? 0.5 : 0, 1.5);

    // golden-hour shimmer on the buried hatch
    const shimmerOn = isGolden() && !F.shadowRevealed;
    ease('shimmer', shimmerOn ? 0.5 + 0.3 * Math.sin(elapsed * 2.5) : 0, 3);

    // stones glow decay
    for (let i = 0; i < 5; i++) an.stoneGlow[i] = Math.max(0, an.stoneGlow[i] - dt * 0.8);

    // the dawn bird
    if (isDawn()) {
      this.birdTimer -= dt;
      if (this.birdTimer <= 0) {
        this.birdTimer = 21 + Math.random() * 8;
        this._birdSing();
      }
    }

    // glyph alignment + reading
    const aligned = Math.abs(angleDiff(W.beamAngle, CLIFF_AZ)) < 0.055;
    this.glyphsLit = W.lampLit && aligned;
    if (this.glyphsLit && !F.glyphsSeen) {
      const d = this.player.pos.distanceTo(CLIFF);
      if (d < 70) {
        this.flag('glyphsSeen');
        A.addStem(5); W.stems = Math.max(W.stems, 5);
        A.chime();
        UI.whisper('The beam writes on the cliff in someone’s patient hand.');
        UI.addJournal(`The lighthouse beam, aimed at the cliff, projects four glyphs:`,
          GLYPH_CODE.map((g) => GLYPH_CHARS[g]).join('  '));
      }
    }

    // ---- proximity one-times ----
    const p = this.player.pos;
    if (!F.enteredStudy && Math.hypot(p.x - LH.x, p.z - LH.z) < 4.8) {
      this.flag('enteredStudy');
      this.once('study', () => {
        UI.whisper('A chart table. And on it — this island. This lighthouse. This room.');
        UI.addJournal('The study holds a living model of the island, 1:240, sea and all. The window looks over the same bay the basin holds.');
      });
    }
    if (F.rulerPlaced && !this._walkedBridge && Math.abs(p.z - SPOTS.chasmBridgeZ) < 3 && p.x > 30 && p.x < 63) {
      this._walkedBridge = true;
      this.once('bridge', () => UI.whisper('Centimetre marks underfoot, tall as doorways.'));
    }
    if (W.level >= 2 && !this._level2Study && Math.hypot(p.x - LH.x, p.z - LH.z) < 4.8) {
      this._level2Study = true;
      this.once('level2study', () => {
        UI.whisper('The inner door stands open. A coat, still warm. Footprints — your size.');
        UI.addJournal('One level down, the study is the same study. The model on its table shows a tiny figure standing on the beach. The annex holds a bell.');
      });
    }

    // apply to both islands
    this._apply(this.refs, false, elapsed);
    this._apply(this.modelRefs, true, elapsed);
  }

  // ---------------------------------------------------- state → scene graph
  _apply(R, isModel, elapsed) {
    if (!R.water) return;
    const an = this.anim;
    const F = W.flags;

    // orrery follows the sky
    const az = sunAzimuth(W.time), el = sunElevation(W.time);
    if (R.orreryPivot) R.orreryPivot.rotation.y = az - Math.PI / 2;
    if (R.orreryTilt) R.orreryTilt.rotation.z = el;
    if (R.crankHandle) R.crankHandle.rotation.x = W.time * 1.8;
    if (R.orreryLamp) R.orreryLamp.material.emissiveIntensity = 1.0 + Math.max(0, Math.sin(el)) * 1.4;

    if (R.valveWheel) R.valveWheel.rotation.z = an.valveSpin;

    if (R.musicBoxLid) R.musicBoxLid.rotation.x = -an.boxLid * 1.1;
    if (R.innerDoor) R.innerDoor.rotation.y = an.innerDoor * 1.5;

    if (R.chestLid) R.chestLid.rotation.x = -this.anim.chest * 1.6;
    if (R.rulerItem) R.rulerItem.visible = !F.rulerTaken;
    if (R.rulerWorld) R.rulerWorld.visible = F.rulerPlaced;

    if (R.vaultDoor) {
      R.vaultDoor.position.y = (R.vaultDoor.userData.baseY ??= R.vaultDoor.position.y) - an.vault * 1.9;
      R.vaultDoor.visible = an.vault < 0.97;
    }
    if (R.lensItem) {
      R.lensItem.visible = F.birdSolved && !F.lensTaken;
      R.lensItem.rotation.y = elapsed * 0.8;
    }

    if (R.hatchLid) {
      const bx = (R.hatchLid.userData.baseX ??= R.hatchLid.position.x);
      R.hatchLid.position.x = bx + an.hatch * 2.3;
    }
    if (R.hatchShimmer) R.hatchShimmer.material.opacity = an.shimmer;

    for (let i = 0; i < 4; i++) {
      const d = R[`dial${i}`];
      if (d) d.rotation.y = (W.dials?.[i] ?? 0) / GLYPHS * TAU;
      const g = R[`dialGlyph${i}`];
      if (g && !isModel) g.material.map.offset.x = (W.dials?.[i] ?? 0) / GLYPHS;
    }

    for (let i = 0; i < 5; i++) {
      const shell = R[`stoneGlow${i}`];
      if (shell && !isModel) shell.material.opacity = an.stoneGlow[i] * 0.55;
      const mk = R[`stoneMark${i}`];
      if (mk && !isModel) mk.material.opacity = 0.78 + an.stoneGlow[i] * 0.22;
    }

    if (R.lampLens) {
      R.lampLens.visible = W.lensPlaced;
      if (!isModel) R.lampLens.material.emissiveIntensity = W.lampLit ? 2.6 : 0.25;
    }
    if (R.beamPivot) R.beamPivot.rotation.y = W.beamAngle;
    if (R.beamCone && !isModel) R.beamCone.material.uniforms.uIntensity.value = an.beamI;
    if (R.shaftBeam && !isModel) R.shaftBeam.material.uniforms.uIntensity.value = an.shaft;
    if (R.cellarShaft && !isModel) R.cellarShaft.material.uniforms.uIntensity.value = an.hatch * 0.9;
    if (R.glyphPlane) R.glyphPlane.visible = this.glyphsLit;

    if (R.plumbHung) R.plumbHung.visible = F.plumbHung;
    if (R.plumbBob) R.plumbBob.visible = !F.plumbTaken;

    if (R.songBird) R.songBird.visible = isDawn();
    // the keeper's coat fades with the descent (#13): on its hook at level 2,
    // slumped to the floor at level 3, gone below — the keeper more absent the
    // deeper you go (translation-only, so the stitched marginalia stays with it)
    if (R.coat) {
      R.coat.visible = W.level >= 2 && W.level <= 3;
      const dropped = W.level >= 3;
      R.coat.position.set(0, dropped ? -0.95 : 0, dropped ? 0.15 : 0);
    }
    if (R.footprints) {
      R.footprints.visible = W.level >= 2;
      // the keeper's trail washes away the deeper you descend (#13); prints
      // share one material, so fading the first fades the whole trail
      const fp0 = R.footprints.children[0];
      if (fp0 && fp0.material) fp0.material.opacity = 0.5 * Math.max(1 - 0.42 * Math.max(0, W.level - 2), 0.12);
    }
    // the bell stirs, faintly, the deeper you are — as if something below
    // keeps disturbing it; still at the surface, growing with the descent (#13)
    if (R.bell) R.bell.rotation.z = Math.sin(elapsed * 0.9) * 0.022 * Math.min(Math.max(0, W.level - 1), 4);
    if (R.tinyFigure) R.tinyFigure.visible = W.level >= 2 && isModel;
  }
}

function angleDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
