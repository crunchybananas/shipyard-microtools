// puzzles.js — the chain: tide → ruler → birdsong → shadows → beam → dive.
// One Game instance owns all hotspots and applies WorldState to BOTH island
// instances every frame.

import * as THREE from 'three';
import { W, save, isNight, isDawn, isGolden, sunAzimuth, sunElevation, SCALE_MODEL, MAX_DEPTH } from './world.js';
import { SPOTS, heightAt } from './terrain.js';
import { BIRD_MELODY, BOX_MELODY, STONE_NOTES, GLYPH_CODE, GLYPHS } from './props.js';
import { Interactions } from './interact.js';
import { UI } from './ui.js';
import A from './audio.js';
import { clamp, lerp, lerpAngle, TAU } from './util.js';
import { KEEPER } from './content.js';

const GLYPH_CHARS = ['◉', '△', '〜', '꩜', '♆', '☾', '◫', '✦'];
const LH = new THREE.Vector3(-85, 13.5, -40);
const CLIFF = new THREE.Vector3(57.5, 14, 50);
const CLIFF_AZ = Math.atan2(CLIFF.x - LH.x, CLIFF.z - LH.z);
const _kv = new THREE.Vector3();
const _ov = new THREE.Vector3();   // scratch for the oar's world position (nested in the dory group)

// the keeper's words (KEEPER.look) live in content.js now, alongside his arrival and
// farewell lines — one place for the voice layer and the twist to re-point (#14).

export class Game {
  constructor({ refs, modelRefs, modelAnchor, interact, player, onDive, onAscend, onFinale, onLeave, onClimb }) {
    this.refs = refs;
    this.modelRefs = modelRefs;
    this.player = player;
    this.interact = interact;
    this.onDive = onDive;
    this.onAscend = onAscend;
    this.onFinale = onFinale;
    this.onLeave = onLeave;     // the climb-out terminal: row off the wake-up beach (#22, The Oar)
    this.onClimb = onClimb;     // hub Phase B: ascend/descend the lamp-room stair (up = true/false)

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
    this._keeperLook = 0;        // eased 0..1: the figure turning to face you
    this._keeperLookTarget = 0;
    this._keeperRise = 0;        // eased 0..1: the twist — the figure rising to meet your eye
    this._embraceBrink = false;  // the embrace's OWN two-touch (never shares the plate's _brink)
    this._leftStudy = false;     // armed once you wander off, for the return beat

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
        // SEA-STRATA: below the surface the tide is the descent's, not yours — the wheel goes dead.
        if (W.level > 1) { UI.whisper('The sea no longer answers the wheel down here.'); return; }
        W.tideTarget = W.tideTarget > 0.5 ? 0 : 1;
        A.chime();
        if (this.flag('valveTurned')) {
          A.addStem(1); W.stems = Math.max(W.stems, 1);
          UI.whisper('Below the window, the sea obeys.');
          UI.addJournal('A valve beside the chart table. Turn it, and the basin drains — and so does the bay. Someone built a machine to make the sea go back, and must have turned it, and turned it. As if, on some one day, holding the water back was the only thing left worth wanting.');
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
        id: `stone${i}`, targets: [R[`stone${i}`]], label: 'a humming stone', maxDist: 13,
        // reach the WHOLE arc (radius 6.5) from one vantage where you can see all five — it's a
        // sequence you play by ear, so standing back and touching them in order must work (was 5.5,
        // which forced walking up to each stone and broke the rhythm)
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
        // promote the grief-rhyme out of the optional journal into the in-the-moment whisper
        // layer (Panel #4 act-two gap): the measuring as a thing to do with grieving hands
        UI.whisper('You do not need a ruler for a distance you already know by heart.');
        UI.addJournal('Laid the ruler over the crack in the model. Out east, a brass bridge now spans the chasm — etched with centimetre marks the size of doors. He measured this rift a hundred times, I think — you do not need a ruler for a distance you already know by heart. You measure it to have something to do with your hands.');
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
        UI.addJournal('Set the small lens into the model’s lamp room. The real lighthouse has its eye back. Whoever kept this light must have ground and polished that glass a thousand nights, so it could see a way home for someone out on the water. It will want the dark now.');
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
        UI.whisper('Cold as seawater, clear as morning — a lamp’s eye, far too fine for a pocket.');
        // forward thread: the stones puzzle dead-ended here for testers — say where the glass wants to go.
        UI.addJournal('Took the first lens from the stones’ vault. It is a lighthouse lamp’s eye, ground and polished thin — and back in the study, the model on the chart table stands eyeless in its little lamp room. Glass like this only ever wants to be put back.');
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
        UI.addJournal('At golden hour the stones’ shadows leaned together, all pointing across the water — to a hatch buried on the bluff. Four glyph dials seal it. He must have read this same hour off these same stones, day on day; some hours you set your whole life by, and they arrive whether or not you are ready.');
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
        UI.addJournal('Hung the plumb line. It hangs dead-centre over the model’s beach — over a brass plate in the floor, big enough to stand on. The weight knows the depth before it drops. Whoever hung it first already knew how far down this goes.');
        save(this.player.pos);
      },
    });

    // the brass floor plate — THE DIVE, and then THE CLIMB. A committed crossing,
    // not a slide: the first touch brings you to the brink (the world goes quiet,
    // the cost is named); a second, deliberate touch commits. Step off and it lets
    // go. You descend, one level deeper each time, until the bottom — and there the
    // plate's only direction left is UP. Once you turn back you cannot dive again
    // (W.flags.climbing, one-way) until you reach the surface: the only way out is
    // down first, then up — the integration arc made mechanical (#12 stage 2).
    I.add({
      id: 'plate', targets: [R.deskPlate], label: 'the brass plate', maxDist: 3.5,
      when: () => W.flags.plumbHung,
      onClick: () => {
        const d = Math.hypot(this.player.pos.x - R.deskPlate.position.x, this.player.pos.z - R.deskPlate.position.z);
        if (d > 1.0) { UI.whisper('Stand on it.'); return; }
        // direction: descend while there's deeper to go and you haven't turned back;
        // otherwise (at the bottom, or already climbing) the plate is the way up
        const goingUp = W.flags.climbing || W.level >= MAX_DEPTH;
        if (!goingUp) {
          // ---- DESCEND ----
          if (!this._brink) {
            this._brink = true;
            A.duckAmbient(true);
            UI.whisper(W.flags.dove
              ? 'The way back closes behind the light. Touch the plate again to go under.'
              : 'The journal will not follow you down. Touch the plate again to descend — there is no climbing back.');
            return;
          }
          this._brink = false;
          this.flag('dove');
          this.onDive();
          return;
        }
        // ---- ASCEND (the bottom turns you back, or you are already climbing) ----
        if (W.level <= 1) { UI.whisper('You are at the surface. There is nowhere above to rise to.'); return; }
        // THE EMBRACE (item 4): once the keeper has RISEN to meet you (keeperRose, at the bottom,
        // not yet climbing), this committed plate-touch IS the integration — you turn him around
        // and rise CARRYING him. The active verb is yours: the rising is your CHOICE, the only
        // thing that separates integration from being rescued. It gets its OWN two-touch brink so a
        // stale plate-brink can never collapse it into one tap, and the embrace line always shows.
        if (W.flags.keeperRose && !W.flags.climbing) {
          if (!this._embraceBrink) {
            this._embraceBrink = true;
            A.duckAmbient(true);
            UI.whisper('He is here, at the foot of the stairs, looking up. Stand, and rise — and take him with you. Touch again.');
            return;
          }
          this._embraceBrink = false;
          this.flag('carried');   // the twist: you did not leave him at the bottom
          UI.addJournal('I turned him around. Whatever I came down all this way looking for, it was him — it was me — and I would not leave him at the bottom. We go up together: one lamp, lit at both ends of the staircase.', '', 'self');
          this.flag('climbing');
          if (this.onAscend) this.onAscend();
          return;
        }
        // ---- the plain climb (no keeper risen, or already climbing through the levels) ----
        if (!this._brink) {
          this._brink = true;
          A.duckAmbient(true);
          UI.whisper(W.flags.climbing
            ? 'Touch the plate again to rise another level. What lies below will not let you down again.'
            : 'There is nowhere further down. Touch the plate again to begin the long climb up — and carry what you found here.');
          return;
        }
        this._brink = false;
        this.flag('climbing');   // one-way: from here the plate only rises, until the surface
        if (this.onAscend) this.onAscend();
      },
    });

    // ---- THE CLIMB (hub Phase B) — earn the way up by lighting the lamp ----
    // the foot of the tower stair: when the lamp is lit, climb to the lamp-room gallery + the vista.
    I.add({
      id: 'climbStair', targets: [R.stairFoot], label: 'the stair to the lamp', maxDist: 2.8,
      when: () => W.lampLit && !W.atTop,
      onClick: () => { if (this.onClimb) this.onClimb(true); },
    });
    // the rope across the foot, before the lamp is lit — names what lighting it opens
    I.add({
      id: 'stairRope', targets: [R.stairRope, R.stairFoot], label: 'a rope across the stair', maxDist: 2.8,
      when: () => !W.lampLit && !W.atTop,
      onClick: () => UI.whisper('The stair is roped off and dark. Light the lamp, and the way up opens.'),
    });
    // the descend ring on the gallery — the way back down to the working room
    I.add({
      id: 'galleryHatch', targets: [R.galleryHatch], label: 'the way down', maxDist: 3.0,
      when: () => W.atTop,
      onClick: () => { if (this.onClimb) this.onClimb(false); },
    });

    // hub Phase C — the drain's one carved line (the first tunnel's lore beat)
    I.add({
      id: 'drainMark', targets: [R.drainMark], label: 'a line carved in the wall', maxDist: 2.6,
      when: () => true,
      onClick: () => UI.whisper('A line cut low into the wet stone, in the keeper’s hand: “what you bury, the tide still finds.”'),
    });

    // the bell — the END at the bottom (descent / accept the loop). Struck below, it
    // withholds; struck at the surface it keeps the golden parade. The OTHER terminal
    // is the oar, at the top (below).
    I.add({
      id: 'bell', targets: [R.bell], label: 'a small bright bell', maxDist: 2.2,
      when: () => W.level >= 2,
      onClick: () => {
        // session-local guard: a reload during the finale must allow re-ringing
        if (this._bellBusy) return;
        // the bottom is the keeper's: you may not toll the deep bell until you have met him
        // rising (the twist is the MANDATORY bottom beat, never skippable — SPINE lock). Nudge
        // toward the chart table; once he has risen, ringing here is a real choice (you stay below).
        if (W.level >= MAX_DEPTH && !W.flags.keeperRose) {
          UI.whisper('Not yet. Something at the chart table has lifted its head, and is looking up at you.');
          return;
        }
        this._bellBusy = true;
        this.flag('bellRung');
        this.onFinale();
      },
    });

    // the oar — the END at the top (#22, owner fork: choice + The Oar). The beached
    // dory has been a standing promise since loop #39; it arms ONLY once you have gone
    // all the way down and climbed all the way back out (W.flags.returned at the
    // surface). The bell is a thing you STRIKE at the bottom (you must stay below to
    // keep it lit — the loop accepted); the oar is a thing you ROW at the top (the
    // light kept AND left — you leave, changed). A committed crossing, like the plate:
    // one touch to weigh it, a second to push off. There is no rowing back.
    I.add({
      id: 'oar', targets: [R.doryOar, R.doryHull], label: 'the oar', maxDist: 3.2,
      when: () => W.level <= 1 && W.flags.returned,
      onClick: () => {
        if (this._oarBusy) return;               // session guard: the leave is underway
        if (!this._oarBrink) {
          this._oarBrink = true;
          UI.whisper('The oar is light in your hands now. The water is calm, and the light is lit behind you. Touch it again to push off — there is no rowing back.');
          return;
        }
        this._oarBrink = false;
        this._oarBusy = true;
        UI.addJournal('I have left the light on, and I have left. The boat is small and the water is calm. The island is behind me now — and getting smaller, the way a thing does when you finally stop being inside it.', '', 'self');
        if (this.onLeave) this.onLeave();
      },
    });

    // ---- the reading surface: fragments of the keeper's life, found in any order ----
    // Books, letters, inscriptions you OPEN and READ; the story assembles non-linearly as you
    // explore (Meow-Wolf). Each opens UI.openReader(loreId), which marks W.readKeys + drops a
    // journal line on first read. The logbook says MORE the deeper you've gone (LORE.deepFrom).
    if (R.logbook) I.add({
      id: 'logbook', targets: [R.logbook], label: 'the keeper’s logbook', maxDist: 2.8,
      onClick: () => UI.openReader('keeper_logbook'),
    });
    if (R.coat) I.add({
      id: 'coatLetter', targets: [R.coat], label: 'a letter in the coat', maxDist: 2.8,
      when: () => W.level >= 2,                 // the folded letter surfaces once you've begun to descend
      onClick: () => UI.openReader('coat_letter'),
    });
    if (R.inscribedStone) I.add({
      id: 'inscription', targets: [R.inscribedStone], label: 'words cut in the stone', maxDist: 5.5,
      onClick: () => UI.openReader('stone_inscription'),
    });
    if (R.musicNote) I.add({
      id: 'musicNote', targets: [R.musicNote], label: 'a folded note', maxDist: 2.8,
      onClick: () => UI.openReader('music_note'),
    });
    if (R.messageBottle) I.add({
      id: 'bottle', targets: [R.messageBottle], label: 'a bottle in the sand', maxDist: 2.6,
      onClick: () => UI.openReader('bottle_note'),
    });
    if (R.kelpSlate) I.add({
      id: 'kelpSlate', targets: [R.kelpSlate], label: 'a wax slate in the kelp', maxDist: 2.8,
      when: () => W.level === 2,               // exists only in the L2 shallows (region2)
      onClick: () => UI.openReader('kelp_slate'),
    });
    if (R.bluffCairn) I.add({
      id: 'bluffCairn', targets: [R.bluffCairn], label: 'a cairn, a mark scratched in the stone', maxDist: 3.2,
      when: () => W.level === 3,               // exists only on the L3 bluff (region3)
      onClick: () => UI.openReader('bluff_cairn'),
    });
    if (R.sourceNote) I.add({
      id: 'sourceNote', targets: [R.sourceNote], label: 'a note weighted with a stone', maxDist: 2.6,
      when: () => W.level === 4,               // exists only at the L4 source (region4)
      onClick: () => UI.openReader('source_note'),
    });
    if (R.quartersJournal) I.add({
      id: 'quartersJournal', targets: [R.quartersJournal], label: 'a journal on the cot', maxDist: 2.6,
      when: () => W.level >= 1,                 // the quarters open one level down
      onClick: () => UI.openReader('quarters_journal'),
    });

    // ---- the found-lens reveal: take the keeper's reading glass and his lampblack marks appear ----
    if (R.readGlass) I.add({
      id: 'readGlass', targets: [R.readGlass], label: 'a brass reading glass', maxDist: 3.4,
      when: () => !W.flags.readGlass,
      onClick: () => {
        this.flag('readGlass');
        if (!W.inventory.includes('readglass')) W.inventory.push('readglass');
        UI.whisper('A keeper’s reading glass. Through it, the faint marks resolve — there is writing everywhere you did not see.');
        UI.addJournal('Found the keeper’s reading glass on the islet. He wrote the true things small, in lampblack; with the glass, they surface. There is more here than the eye admits.', '', 'self');
      },
    });
    if (R.lensMarkStudy) I.add({
      id: 'lensMarkStudy', targets: [R.lensMarkStudy], label: 'lampblack, resolved by the glass', maxDist: 2.8,
      when: () => W.flags.readGlass,
      onClick: () => UI.openReader('lens_mark_study'),
    });
    if (R.lensMarkStone) I.add({
      id: 'lensMarkStone', targets: [R.lensMarkStone], label: 'hair-fine letters', maxDist: 4.5,
      when: () => W.flags.readGlass,
      onClick: () => UI.openReader('lens_mark_stone'),
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
      // promote the grief-rhyme out of the optional journal into the in-the-moment whisper
      // layer (Panel #4 act-two gap): the correction that came a lifetime too late
      UI.whisper('Some corrections only ever arrive too late.');
      UI.addJournal('The stones accepted the bird’s correction. A vault in the outcrop holds a small, perfect lens. The box always bent that fourth note wrong; the bird sings it true. He must have heard it right a thousand mornings and never could make his own hands play it — some corrections only ever arrive too late.');
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
      W.tide = clamp(W.tide + Math.sign(dTide) * dt / 13, 0, 2); // [0,2]: tide>1 RAISES the sea for SEA-STRATA depths
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
    // hub Phase B: the stair is roped off until the lamp is lit — lighting it opens the climb
    if (R.stairRope) R.stairRope.visible = !W.lampLit;

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
    // the oar terminal (#22) is undiscoverable on text alone — so when a player who has come
    // all the way back (returned, at the surface) wanders near the dory, name the way out
    // unmissably, the moment they are AT it. Session-local (no save flag); the hover-glint
    // then confirms the oar is live.
    if (W.flags.returned && W.level <= 1 && !this._sawOarNudge && Math.hypot(p.x - (-26), p.z - (-102)) < 9) {
      this._sawOarNudge = true;
      UI.whisper('The dory, and its one unused oar. You went down and climbed back; this is the way out, when you are ready to take it.');
    }
    if (W.level >= 2 && !this._level2Study && Math.hypot(p.x - LH.x, p.z - LH.z) < 4.8) {
      this._level2Study = true;
      this.once('level2study', () => {
        UI.whisper('The inner door stands open. A coat, still warm. Footprints — your size.');
        UI.addJournal('One level down, the study is the same study. The model on its table shows a tiny figure standing on the beach. The annex holds a bell.');
      });
    }
    // discoverability of the climb (Panel #4 #1): at the bottom, in the study (near both
    // the plate AND the bell), make sure the player learns the plate turns back — the one
    // true payoff must not be missable behind a guess. Fork-NEUTRAL: it names the EXISTENCE
    // of the way up, never a choice; the bell finale is untouched. Fires once.
    if (W.level >= MAX_DEPTH && !W.flags.climbing && Math.hypot(p.x - LH.x, p.z - LH.z) < 4.8) {
      this.once('climbHint', () => {
        UI.whisper('Nowhere deeper. The plate that brought you down only ever went one way — try it again.');
        UI.addJournal('There is no further down — I have stood at the bottom of my own making. The plate is the only door left, and it is under my feet. If it only goes one way, then the way on is the way back up.', '', 'self');
      });
    }
    // the house remembers (#7thGuest "remembers the player across visits"): wander
    // off, return, and the study is exactly as you left it — too exactly. The grief
    // reading the SPINE canonises: time does not pass inside the model. Fires once,
    // on the first return (the chain always sends you out to the bridge/stones/cliff).
    if (F.enteredStudy) {
      const dStudy = Math.hypot(p.x - LH.x, p.z - LH.z);
      if (dStudy > 12) this._leftStudy = true;
      if (dStudy < 4.6 && this._leftStudy) {
        this.once('studyReturns', () => {
          UI.whisper('You have stood here before. The room is exactly as you left it — too exactly.');
          UI.addJournal('I keep leaving this study and coming back to find it untouched: the same chair, the same cold cup, the same hour held on the glass. Either no time passes here, or I have stopped being the one who disturbs it.', '', W.level >= 2 ? 'keeper' : 'self');
        });
      }
    }
    // the keeper looks back (#14): lean over the chart-table model at depth and
    // the figure on it turns, tips its head up to your giant eye, and speaks —
    // the world hushing for a breath. Once per level; the figure's turn is eased
    // toward the player in _apply while you stay near.
    if (W.level >= 3 && this.modelRefs.tinyFigure) {
      this.modelRefs.tinyFigure.getWorldPosition(_kv);
      const near = this.player.pos.distanceTo(_kv) < 2.4;
      this._keeperLookTarget = near ? 1 : 0;
      if (near && W.level >= MAX_DEPTH) {
        // THE TWIST (item 4) — at the bottom, the figure does not just look back: it TURNS and
        // walks UP to you. You were never the searcher; you are the one it has been descending
        // toward. BODY BEFORE LINE: the weary recognition, then it RISES (W.flags.keeperRose +
        // the pitch inverts), then — at eye-level, the water thinned — the line CONFIRMS it.
        this.once('keeperTwist', () => {
          // persist the revelation IMMEDIATELY (atomic with the once-key) so a mid-beat reload can
          // never strand you in a twist-less bottom; this also arms the embrace AND the visual rise.
          this.flag('keeperRose');
          // hold the player (like the dive/ascent) so the rise and the eye-level line always land
          // with the figure in view — never blasted into an empty room behind your back.
          this.player.locked = true;
          A.duckAmbient(true);
          A.keeperRise();                                     // the pitch inverts to RISE as he climbs
          A.say('keeper_look_4', 'resigned');                 // costly love: he is spent ("faster than I was")
          UI.whisper(KEEPER.look[4]);
          setTimeout(() => {                                   // body before line: after he has risen
            A.say('keeper_there_you_are', 'resigned', true);  // eye-level: clear, close, no longer below
            UI.whisper('There you are. I’ve been coming down for you.');
          }, 3800);
          setTimeout(() => { this.player.locked = false; A.duckAmbient(false); }, 6000);   // release the held breath
        });
      } else if (near) {
        this.once('keeperLook' + W.level, () => {
          A.duckAmbient(true);
          A.say(W.level === 3 ? 'keeper_look_3' : 'keeper_look_4', W.level >= 4 ? 'resigned' : 'pleading');
          UI.whisper(KEEPER.look[Math.min(W.level, 4)] || KEEPER.look[4]);
          setTimeout(() => A.duckAmbient(false), 2700);
        });
      }
    } else {
      this._keeperLookTarget = 0;
    }
    this._keeperLook = lerp(this._keeperLook, this._keeperLookTarget, 1 - Math.exp(-4 * dt));
    // the rise eases in only at the bottom, after the revelation, while the choice is still open:
    // it relaxes as you climb away, once you have CARRIED him out (don't silently re-raise the mute
    // figure on a re-descent), or the moment you ring the bell instead (you turned away from him).
    const risen = W.flags.keeperRose && W.level >= MAX_DEPTH && !W.flags.carried && !W.flags.bellRung;
    this._keeperRise = lerp(this._keeperRise, risen ? 1 : 0, 1 - Math.exp(-1.6 * dt));

    // The Room That Disagrees (#18): in the cellar, drawn to the west window, the
    // player sees a model that contradicts the world — name the unease, once
    if (W.flags.hatchOpen && !this._roomDisagrees && p.y < 19.6 && p.y > 17
        && Math.abs(p.z - (SPOTS.hatch.y - 13.6)) < 4.6 && p.x > SPOTS.hatch.x - 6 && p.x < SPOTS.hatch.x - 2.5) {
      this._roomDisagrees = true;
      this.once('roomDisagrees', () => {
        UI.whisper('Another study, west of this one. On its table: a sea you never drained, a lamp you never lit. Which of you is the copy?');
        UI.addJournal('A second study faces mine across the dark. Its model shows an island I never made — the bay drained, the light burning. I have trusted the model to tell the truth about the world. Here, one of them is lying.');
      });
    }

    // the brink lets go if you step off the plate — a felt drawing-back
    if (this._brink) {
      const plate = this.refs.deskPlate;
      if (!plate || Math.hypot(p.x - plate.position.x, p.z - plate.position.z) > 1.25) {
        this._brink = false;
        A.duckAmbient(false);
        UI.whisper('You step back from the edge. The sea comes back.');
      }
    }
    // the EMBRACE's brink lets go the same way — step off the plate and the offer waits, so the
    // turn-and-rise is always a fresh, deliberate two-touch (never a stale single tap)
    if (this._embraceBrink) {
      const plate = this.refs.deskPlate;
      if (!plate || Math.hypot(p.x - plate.position.x, p.z - plate.position.z) > 1.25) {
        this._embraceBrink = false;
        A.duckAmbient(false);
        UI.whisper('You step back. He waits at the foot of the stairs, looking up.');
      }
    }
    // the OAR's brink lets go the same way — walk away from the dory and it resets, so leaving
    // is always a deliberate two-touch and never fires on a single touch with a stale brink
    // (the oar sits in the dory group, so use its WORLD position, not its local .position)
    if (this._oarBrink) {
      const oar = this.refs.doryOar;
      if (!oar || (oar.getWorldPosition(_ov), Math.hypot(p.x - _ov.x, p.z - _ov.z) > 3.6)) {
        this._oarBrink = false;
        UI.whisper('You set the oar back down. The boat waits.');
      }
    }

    this._tickWatcher(dt);
    this._tickTideFigure(dt);

    // apply to both islands
    this._apply(this.refs, false, elapsed);
    this._apply(this.modelRefs, true, elapsed);
  }

  // THE WATCHER — grief given form (the owner's "goblins"). Active only deep (W.level>=3) and
  // once per game (W.flags.watcherSeen). It DRIFTS toward you when you are not looking at it and
  // FREEZES when you are; resolved by REGARD, not flight or force — hold its gaze and it lifts its
  // head, lets go, and dissolves into a cold rising light (integration: faced, grief becomes
  // bearable). Full-scale, real island only. Runs in tick() so it has dt + the player.
  _tickWatcher(dt) {
    const w = this.refs.watcher;
    if (!w) return;
    const active = W.level >= 3 && !W.flags.watcherSeen;
    if (!active) {
      // resolution: once seen, it shrinks and rises out of being, then stays gone
      if (W.flags.watcherSeen && w.visible) {
        w.scale.multiplyScalar(Math.max(0, 1 - dt * 1.6));
        w.position.y += dt * 0.5;
        if (w.scale.x < 0.05) w.visible = false;
      } else if (!W.flags.watcherSeen) {
        w.visible = false;                 // not deep enough yet
      }
      return;
    }
    w.visible = true;
    const p = this.player.pos;
    const dx = w.position.x - p.x, dz = w.position.z - p.z;
    const dist = Math.hypot(dx, dz) || 1e-3;
    w.lookAt(p.x, w.position.y, p.z);      // always turns its face (+z) toward you
    const fx = -Math.sin(this.player.yaw), fz = -Math.cos(this.player.yaw);   // player forward (horizontal)
    const looked = (fx * dx + fz * dz) / dist > 0.82 && dist < 70;            // watcher within ~35° of, and in front of, your gaze
    if (looked) {
      this._watcherRegard = Math.min((this._watcherRegard || 0) + dt, 3);
      if (this._watcherRegard >= 2.6 && this.flag('watcherSeen')) {
        UI.whisper('You did not run. You looked, and kept looking, until the shape stopped being a threat and was only what it had always been — something of yours, come back to be carried up.');
        UI.addJournal('On the deep shore a figure walked — toward me when I looked away, still when I looked at it. I did not run. I held its gaze until it lifted its head, let go, and dissolved into a small cold light that rose. Not everything down here wants to keep you. Some of it only wants to be seen.', '', 'self');
      }
    } else {
      this._watcherRegard = Math.max((this._watcherRegard || 0) - dt * 1.5, 0);
      if (dist > 2.4) {                    // drift toward you when unwatched, but it waits at arm's length to be seen
        const step = 1.5 * dt;
        w.position.x -= (dx / dist) * step;
        w.position.z -= (dz / dist) * step;
        const gy = heightAt(w.position.x, w.position.z);
        if (Number.isFinite(gy)) w.position.y = gy;
      }
    }
  }

  // THE TIDE-FIGURE — the L2 (shallows) encounter, grief that will not be CAUGHT, only WITNESSED.
  // Active at W.level===2 only. Inverse of the Watcher: it does NOT approach — when you WADE for it
  // it disperses and reforms a few metres on, keeping the kelp between you; resolved by STILLNESS —
  // stop chasing, stand and watch ~2.6s and it settles, lays one bell-note, and sinks. (#121)
  _tickTideFigure(dt) {
    const f = this.refs.tideFigure;
    if (!f) return;
    const active = W.level === 2 && !W.flags.tideFigureSeen;
    if (!active) {
      if (W.flags.tideFigureSeen && f.visible) {        // resolved: settle, sink, fade, stay gone
        f.position.y -= dt * 0.5;
        f.scale.multiplyScalar(Math.max(0, 1 - dt * 1.1));
        for (const m of (f.userData.mats || [])) m.opacity = Math.max(0, m.opacity - dt * 0.6);
        if (f.scale.x < 0.06) f.visible = false;
      } else if (!W.flags.tideFigureSeen) {
        f.visible = false;                              // wrong level: hidden
      }
      return;
    }
    f.visible = true;
    const p = this.player.pos;
    // player speed from position delta (robust — player.vel semantics vary)
    const prev = this._tfPrev || { x: p.x, z: p.z };
    const speed = dt > 0 ? Math.hypot(p.x - prev.x, p.z - prev.z) / dt : 0;
    this._tfPrev = { x: p.x, z: p.z };
    const dx = f.position.x - p.x, dz = f.position.z - p.z;
    const dist = Math.hypot(dx, dz) || 1e-3;
    f.lookAt(p.x, f.position.y, p.z);
    const fx = -Math.sin(this.player.yaw), fz = -Math.cos(this.player.yaw);
    const looking = (fx * dx + fz * dz) / dist > 0.66 && dist < 42;
    if (looking && speed > 1.3 && dist < 16) {
      // you wade for it → it disperses: back off + drift laterally to keep the kelp between
      this._tideRegard = 0;
      const ax = dx / dist, az = dz / dist;
      f.position.x += (ax - az * 0.55) * dt * 2.6;
      f.position.z += (az + ax * 0.55) * dt * 2.6;
      const gy = heightAt(f.position.x, f.position.z);
      if (Number.isFinite(gy)) f.position.y = gy;
    } else if (looking && speed < 0.6 && dist > 2.2 && dist < 34) {
      // you stop chasing and only watch → it settles, and lets go
      this._tideRegard = Math.min((this._tideRegard || 0) + dt, 3);
      if (this._tideRegard >= 2.6 && this.flag('tideFigureSeen')) {
        A.chime();   // one bell-note across the water
        UI.whisper('You stop wading for it. You only watch. It settles, surfaces — and lays a single note across the water before it sinks.');
        UI.addJournal('A shape stood in the kelp and slipped off whenever I waded toward it. So I stopped, and stood, and only watched. It settled then, and surfaced, and laid one bell-note across the bay before the water took it. Some things will not be chased down — only witnessed. And that is enough to let them go.', '', 'self');
      }
    } else {
      this._tideRegard = Math.max((this._tideRegard || 0) - dt, 0);
    }
  }

  // the player is poised on the plate, one touch from a committed descent —
  // the main loop pauses autosave here (the journal won't follow you down)
  atBrink() { return !!this._brink; }

  // ---------------------------------------------------- state → scene graph
  _apply(R, isModel, elapsed) {
    if (!R.water) return;
    const an = this.anim;
    const F = W.flags;

    // SEA-STRATA (loop #117): show exactly the active level's region shell. Driven from
    // W.level every frame (not imperatively at dive time) so a reload restores the right
    // register. Guarded — the regions are pruned from the clone, so this no-ops on isModel.
    if (R.region2) R.region2.visible = W.level === 2;
    if (R.region3) R.region3.visible = W.level === 3;
    if (R.region4) R.region4.visible = W.level === 4;
    // L3 'midwater': the drowned colonnade rises ~2.6m so its capitals + upper columns break the
    // raised surface (a drowned cathedral); at L1 it sits low (only capitals breaking high tide).
    if (R.drownedGallery) R.drownedGallery.position.y = (W.level === 3 ? 2.6 : 0);
    // L4 'source': strip the surface forest + grass on the REAL island (a cold bare floor at the
    // bottom of the recursion) — the 1:240 chart-table CLONE keeps them (it's the surface island model).
    if (!isModel) {
      const surfaceUp = W.level !== 4;
      if (R.trunks) R.trunks.visible = surfaceUp;
      if (R.canopies) R.canopies.visible = surfaceUp;     // fir silhouette
      if (R.canopies2) R.canopies2.visible = surfaceUp;   // spruce silhouette (loop #139)
      if (R.grass) R.grass.visible = surfaceUp;
    }

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

    // the found-lens reveal — the reading glass vanishes when taken; the keeper's lampblack
    // marks fade up once you hold it (legible only through the glass). Opacity lerped on the
    // real island; the marks become readable hotspots once visible.
    if (R.readGlass) { R.readGlass.visible = !F.readGlass; R.readGlass.rotation.y = 0.4 + elapsed * 0.5; }
    for (const id of ['lensMarkStudy', 'lensMarkStone']) {
      const mk = R[id];
      if (!mk) continue;
      if (!isModel) {
        const t = F.readGlass ? 0.88 : 0;        // sepia ink resolving (normal blend, won't bloom)
        mk.material.opacity += (t - mk.material.opacity) * 0.05;
      }
      mk.visible = mk.material.opacity > 0.02;
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
    // gate the volumetric beams (#3 power-cut): additive transparent overdraw still costs
    // fill at ~0 intensity, and they're dormant most of the game (lamp/hatch off). Hide them
    // when dark. Visibility driven on BOTH instances so the model beam mirrors the island lamp;
    // the uIntensity uniform stays island-only (the model beam isn't separately animated).
    if (R.beamCone) { R.beamCone.visible = an.beamI > 0.004; if (!isModel) R.beamCone.material.uniforms.uIntensity.value = an.beamI; }
    if (R.shaftBeam) { R.shaftBeam.visible = an.shaft > 0.004; if (!isModel) R.shaftBeam.material.uniforms.uIntensity.value = an.shaft; }
    if (R.cellarShaft) { R.cellarShaft.visible = an.hatch > 0.004; if (!isModel) R.cellarShaft.material.uniforms.uIntensity.value = an.hatch * 0.9; }
    if (R.glyphPlane) R.glyphPlane.visible = this.glyphsLit;

    if (R.plumbHung) R.plumbHung.visible = F.plumbHung;
    if (R.plumbBob) R.plumbBob.visible = !F.plumbTaken;

    if (R.songBird) R.songBird.visible = isDawn();
    // the keeper's coat fades with the descent (#13): on its hook at level 2,
    // slumped to the floor at level 3, gone below — the keeper more absent the
    // deeper you go (translation-only, so the stitched marginalia stays with it)
    if (R.coat) {
      // present at every depth — the coat is the climb-out reveal (it is yours);
      // it slumps from the hook to the floor as you descend, but never vanishes
      R.coat.visible = W.level >= 2;
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
    if (R.tinyFigure) {
      const fig = R.tinyFigure;
      fig.visible = W.level >= 2 && isModel;
      if (fig.visible) {
        const look = this._keeperLook;
        const rise = this._keeperRise;   // the twist: it climbs up to meet your eye at the bottom
        // turn to face the player and tip the brow up toward the giant eye
        fig.getWorldPosition(_kv);
        const wantYaw = Math.atan2(this.player.pos.x - _kv.x, this.player.pos.z - _kv.z);
        fig.rotation.y = lerpAngle(fig.rotation.y, wantYaw, Math.max(look, rise));
        fig.rotation.x = -0.6 * look - 0.5 * rise;                              // brow fully up as it rises
        fig.position.y = (fig.userData.baseY ?? fig.position.y) + rise * 1.8;   // lifts toward you
        fig.scale.setScalar(1 + rise * 1.6);                                    // and looms larger, coming up
        // breathing — a notice-flare as it looks back, then a steady glow as it rises to you
        const body = fig.children[0];
        if (body?.material) body.material.emissiveIntensity = 1.8 * (1 + 0.12 * Math.sin(elapsed * 1.5)) + 1.7 * look + 1.4 * rise;
        const head = fig.children[1];
        if (head?.material) head.material.emissiveIntensity = 1.0 + 1.3 * look + 1.6 * rise;
      }
    }

    // The Room That Disagrees (#18 live ghostState): the model on its table always
    // shows the OPPOSITE of the world — its sea floods as you drain the real one,
    // its lamp burns while yours is dark. The disagreement shifts as you act.
    if (R.disagreeSea) {
      const flood = 1 - W.tide;                 // flooded when the real sea is drained
      R.disagreeSea.material.opacity = flood;
      R.disagreeSea.visible = flood > 0.02;
    }
    if (R.disagreeLamp) R.disagreeLamp.material.emissiveIntensity = W.lampLit ? 0.35 : 4.5;

    // the descent tally (#7thGuest "the house remembers"): one margin stroke
    // revealed per level descended. Accrues in-play as you dive (W.level grows
    // since iter 33), and — driven on BOTH island and model — the count recurses
    // table-within-table. Surface (level 1) shows none: the normal game is untouched.
    // the brass plate glints amber ONLY at the bottom (Panel #4 #1, visual discoverability):
    // when there is nowhere further down, the way back wakes — so a player who came to ring
    // the bell still sees the plate is live. Off at every other depth and while climbing.
    if (R.plateGlow) {
      const atBottom = W.level >= MAX_DEPTH && !W.flags.climbing;
      R.plateGlow.visible = atBottom;
      if (atBottom) R.plateGlow.material.opacity = 0.34 + 0.22 * Math.sin(elapsed * 2.0);
    }
    if (R.chartTally) {
      // grows one mark per level descended; once you have climbed all the way back the
      // record STAYS full at the surface — the fingerprint that you went down and returned (#12)
      const n = W.flags.returned ? (MAX_DEPTH - 1) : (W.level | 0) - 1;
      const kids = R.chartTally.children;
      for (let i = 0; i < kids.length; i++) kids[i].visible = i < n;
    }
  }
}

function angleDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
