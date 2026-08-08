// puzzles.js — the chain: tide → ruler → birdsong → shadows → beam → dive.
// One Game instance owns all hotspots and applies WorldState to BOTH island
// instances every frame.

import * as THREE from 'three';
import { W, save, isNight, isDawn, isGolden, sunAzimuth, sunElevation, SCALE_MODEL, MAX_DEPTH, waterY, LEVELS } from './world.js';
import { SPOTS, heightAt } from './terrain.js';
import { BIRD_MELODY, BOX_MELODY, STONE_NOTES, GLYPH_CODE, GLYPHS } from './props.js';
import { Interactions } from './interact.js';
import { UI } from './ui.js';
import A from './audio.js';
import { clamp, lerp, lerpAngle, TAU } from './util.js';

// #132: the inspector's record — every LORE entry flagged record:true participates
// in the FILE-or-KEEP economy (read → take → cabinet or source).
const REC_IDS = Object.keys(LORE).filter((id) => LORE[id].record);
import { KEEPER, LAMPBLACK, CLIMBERS, CLIMBERS_CLOSE, CONGREGATION, CONGREGATION_CLOSE, LORE, T } from './content.js';

const GLYPH_CHARS = ['◉', '△', '〜', '꩜', '♆', '☾', '◫', '✦'];
const LH = new THREE.Vector3(-85, 13.5, -40);
const CLIFF = new THREE.Vector3(57.5, 14, 50);
const CLIFF_AZ = Math.atan2(CLIFF.x - LH.x, CLIFF.z - LH.z);
// #49: the beam turned to face the deep — the drowned hall's aisle centre. The default
// beamAngle (2.2) sits just OUTSIDE the 0.05 window (Δ0.059): the find is never free.
const HALL = new THREE.Vector3(4, 3, -113.25);
const HALL_AZ = Math.atan2(HALL.x - LH.x, HALL.z - LH.z);
// #49: the keeper's own song, finally allowed to finish — BOX_MELODY + the fallen B
const KEEPER_SONG = [...BOX_MELODY, 5];
// #49: the high pool's basin floor (matches props) — the water shows above it only at L4
const POOL = { x: -75.5, z: -77.0, floor: 3.42 };
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
      beamI: 0, shaft: 0, valveSpin: 0, stoneGlow: [0, 0, 0, 0, 0, 0],
      shimmer: 0,
    };
    this.stoneSeq = [];
    this.songSeq = [];   // #49: rolling window for the keeper's song (E G A D C + the fallen B)
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
    save(this.player);
    return true;
  }

  // one-time beats, persisted so reloads don't replay cinematics
  once(key, fn) {
    W.onceKeys = W.onceKeys || [];
    if (W.onceKeys.includes(key)) return;
    W.onceKeys.push(key);
    save(this.player);
    fn();
  }

  // #131: perform one of HIS ROUNDS — flag it, keep it, stage its tableau (tick owns
  // the timers). kind ∈ Moor|Log|Light|Wind; the Wind round rides the music box.
  _doRound(kind, whisper, journal) {
    if (W.flags['round' + kind]) return;
    W.flags['round' + kind] = true;
    UI.whisper(whisper);
    UI.addJournal(journal, '', 'self');
    this['_tab' + kind] = 0;                   // arm the tableau clock
    save(this.player);
    if (W.flags.roundMoor && W.flags.roundLog && W.flags.roundLight && W.flags.roundWind) {
      this.once('roundsAll', () => UI.addJournal(T.four_rounds_kept_the, '', 'self'));
    }
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
        if (W.level > 1) { UI.whisper(T.the_sea_no_longer); return; }
        W.tideTarget = W.tideTarget > 0.5 ? 0 : 1;
        if (this.flag('valveTurned')) {
          A.leitStrum();   // the first turn earns a stem — the island's own figure answers (#65)
          A.addStem(1); W.stems = Math.max(W.stems, 1);
          UI.whisper(T.below_the_window_the);
          UI.addJournal(T.a_valve_beside_the);
        } else {
          A.chime();       // later toggles keep the plain chime
        }
        save(this.player);
      },
    });

    // sun crank
    I.add({
      id: 'crank', targets: [R.crankHandle], label: 'the sun crank', type: 'drag',
      onDrag: (dx) => {
        // SEA-STRATA depth response (#51): the hours drag heavy below the surface — the
        // same pull moves less sky the deeper you carry it
        const drag = W.level > 1 ? 1 / (1 + 0.5 * (W.level - 1)) : 1;
        W.time = ((W.time + dx * 0.011 * drag) % 24 + 24) % 24;
        this._crankAcc = (this._crankAcc || 0) + Math.abs(dx);
        if (this._crankAcc > 26) { this._crankAcc = 0; A.crankTick(); }
        if (W.level > 1) this.once('crankDeep', () => UI.whisper(T.the_crank_resists_as));
        if (this.flag('crankUsed')) {
          UI.whisper(T.the_little_lamp_drags);
          UI.addJournal(T.a_crank_turns_the);
        }
      },
    });

    // music box
    I.add({
      id: 'musicBox', targets: [R.musicBoxLid.parent], label: 'the music box',
      onClick: () => {
        if (this.boxPlaying) return;
        this.boxPlaying = true;
        // SEA-STRATA depth response (#51): under a drowned sky the box is waterlogged —
        // flat, slowed, muffled-long; and at the source the FOURTH note (the one he never
        // could make his hands play true) does not come at all.
        const depth = Math.max(0, W.level - 1);
        const det = depth ? 0.945 - 0.015 * depth : 1;     // sinks further flat per level
        const gap = 620 + depth * 130;                     // the mechanism drags
        BOX_MELODY.forEach((stoneIdx, n) => {
          setTimeout(() => {
            const missing = W.level >= 4 && n === 3;
            if (!missing) A.pluck(STONE_NOTES[stoneIdx] * 2 * det, 0, depth ? 0.3 : 0.4, depth ? 2.1 : 1.4);
            else this.once('boxMissingNote', () => UI.whisper(T.the_fourth_note_does));
            if (n === BOX_MELODY.length - 1) setTimeout(() => { this.boxPlaying = false; }, 900 + depth * 250);
          }, n * gap);
        });
        if (depth) this.once('boxDeep', () => UI.whisper(T.the_song_comes_up));
        if (this.flag('heardBox')) {
          UI.addJournal(T.the_music_box_turns);
        }
        // #131 the WIND round rides the box: at the surface, once the strata are years,
        // winding it IS one of his rounds — once more than needed, for no one there
        if (W.level === 1 && W.onceKeys?.includes('eraThreshold') && !W.flags.roundWind) {
          this._doRound('Wind', T.wound_the_way_he, T.i_wound_the_music);
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
    // the fallen sixth stone (#49): dead until the Tide-Figure's bell-note has been
    // witnessed at L2 — the note it lost, laid back across the water. Then it hums B,
    // and the keeper's refused song (E G A D C) can finally land its last note here.
    if (R.stone5) I.add({
      id: 'stoneFallen', targets: [R.stone5], label: 'a fallen stone', maxDist: 13,
      onClick: () => {
        if (!W.flags.tideFigureSeen) {
          A.stoneDead();
          this.once('fallenStone', () => {
            UI.whisper(T.fallen_and_long_silent);
            UI.addJournal(T.a_sixth_stone_lies);
          });
          return;
        }
        this.once('fallenStoneWakes', () => {
          UI.whisper(T.the_fallen_stone_hums);
          UI.addJournal(T.the_fallen_stone_has, '', 'self');
        });
        this._touchStone(5);
      },
    });

    // chest + ruler
    I.add({
      id: 'chest', targets: [R.chestLid.parent], label: 'a half-buried chest',
      when: () => !W.flags.rulerTaken,
      onClick: () => {
        if (!W.flags.chestOpen) {
          this.flag('chestOpen'); A.chime();
          UI.whisper(T.the_hinges_remember_how);
        } else if (!W.flags.rulerTaken) {
          this.flag('rulerTaken');
          W.inventory.push('ruler');
          A.chime();
          UI.whisper(T.a_cartographer_s_brass);
          UI.addJournal(T.took_a_small_brass);
          save(this.player);
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
        A.leitStrum();   // stem-earning solve: the leitmotif, not the chime (#65)
        UI.cinematic(true);
        setTimeout(() => UI.cinematic(false), 5200);
        UI.whisper(T.across_the_island_something);
        // promote the grief-rhyme out of the optional journal into the in-the-moment whisper
        // layer (Panel #4 act-two gap): the measuring as a thing to do with grieving hands
        UI.whisper(T.you_do_not_need);
        UI.addJournal(T.laid_the_ruler_over);
        save(this.player);
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
        UI.whisper(T.far_above_glass_settles);
        UI.addJournal(T.set_the_small_lens);
        save(this.player);
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

    // ---- the model's micro-finds (#53): the game's signature object finally holds its
    // own secrets. Lean ALL the way in — three need the reading glass (at 1:240 nothing
    // reads without it); the fourth appears only once you have carried him up.
    const marginProxy = proxy(LH.x - 1.4, LH.y + 1.2, LH.z, 2.2);
    I.add({
      id: 'modelMargin', targets: [marginProxy], label: 'the model’s chart margin', maxDist: 2.6, noGlint: true,
      when: () => W.flags.readGlass,
      onClick: () => UI.openReader('model_margin'),
    });
    const mBottleProxy = proxy(6.5, 1.2, -101, 2.0);
    I.add({
      id: 'modelBottle', targets: [mBottleProxy], label: 'a bottle, grain-of-rice small', maxDist: 2.6, noGlint: true,
      when: () => W.flags.readGlass,
      onClick: () => {
        A.pluck(1567.98, 0, 0.1, 1.4);
        UI.whisper(T.on_the_model_s);
        this.once('modelBottle', () => UI.addJournal(T.leaning_into_the_model, '', 'self'));
      },
    });
    const mGaugeProxy = proxy(-64, 2.5, -93, 2.2);
    I.add({
      id: 'modelGauge', targets: [mGaugeProxy], label: 'a staff the height of an eyelash', maxDist: 2.6, noGlint: true,
      when: () => W.flags.readGlass,
      onClick: () => {
        A.crankTick();
        UI.whisper(T.even_here_a_staff);
        this.once('modelGauge', () => UI.addJournal(T.the_model_has_its, '', 'self'));
      },
    });
    const mPairProxy = proxy(SPOTS.beach.x + 0.7, 1.8, SPOTS.beach.y + 0.5, 2.4);
    I.add({
      id: 'modelPair', targets: [mPairProxy], label: 'two small figures', maxDist: 2.8, noGlint: true,
      when: () => W.flags.carried,
      onClick: () => {
        A.chime();
        UI.whisper(T.two_figures_stand_on);
        this.once('modelPair', () => UI.addJournal(T.there_are_two_figures, '', 'self'));
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
        UI.whisper(T.cold_as_seawater_clear);
        // forward thread: the stones puzzle dead-ended here for testers — say where the glass wants to go.
        UI.addJournal(T.took_the_first_lens);
        save(this.player);
      },
    });

    // hatch shimmer + dials
    I.add({
      id: 'shimmer', targets: [R.hatchShimmer], label: 'troubled sand', maxDist: 6, noGlint: true,
      when: () => isGolden() && !W.flags.shadowRevealed,
      onClick: () => {
        this.flag('shadowRevealed');
        A.chime();
        UI.whisper(T.the_sand_slides_from);
        UI.addJournal(T.at_golden_hour_the);
        save(this.player);
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
            A.leitStrum();   // stem-earning solve: the leitmotif, not the chime (#65)
            A.addStem(4); W.stems = Math.max(W.stems, 4);
            UI.whisper(T.stone_breath_long_held);
          }
          save(this.player);
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
        UI.whisper(T.heavier_than_it_looks);
        UI.addJournal(T.in_the_cellar_a);
        save(this.player);
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
        UI.whisper(T.it_hangs_dead_centre);
        UI.addJournal(T.hung_the_plumb_line);
        save(this.player);
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
        if (d > 1.0) { UI.whisper(T.stand_on_it); return; }
        // direction: descend while there's deeper to go and you haven't turned back;
        // otherwise (at the bottom, or already climbing) the plate is the way up
        const goingUp = W.flags.climbing || W.level >= MAX_DEPTH;
        if (!goingUp) {
          // ---- DESCEND ----
          // #124: the L3 arrival lands on the bluff, and the flooded channel's only
          // crossing is the ruler bridge — a diver who never measured the crack would
          // strand there. The plate itself refuses, in the keeper's terms: the ruler
          // IS the route east (terrain.js has said so all along).
          if (W.level === 2 && !W.flags.rulerPlaced) {
            UI.whisper(T.the_plate_hums_and);
            this.once('diveNeedsRuler', () => UI.addJournal(T.the_plate_would_not));
            return;
          }
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
        if (W.level <= 1) { UI.whisper(T.you_are_at_the); return; }
        // THE EMBRACE (item 4): once the keeper has RISEN to meet you (keeperRose, at the bottom,
        // not yet climbing), this committed plate-touch IS the integration — you turn him around
        // and rise CARRYING him. The active verb is yours: the rising is your CHOICE, the only
        // thing that separates integration from being rescued. It gets its OWN two-touch brink so a
        // stale plate-brink can never collapse it into one tap, and the embrace line always shows.
        if (W.flags.keeperRose && !W.flags.climbing) {
          if (!this._embraceBrink) {
            this._embraceBrink = true;
            A.duckAmbient(true);
            UI.whisper(T.he_is_here_at);
            return;
          }
          this._embraceBrink = false;
          this.flag('carried');   // the twist: you did not leave him at the bottom
          UI.addJournal(T.i_turned_him_around, '', 'self');
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
      onClick: () => UI.whisper(T.the_stair_is_roped),
    });
    // the descend ring on the gallery — the way back down to the working room
    I.add({
      id: 'galleryHatch', targets: [R.galleryHatch], label: 'the way down', maxDist: 3.0,
      when: () => W.atTop,
      onClick: () => { if (this.onClimb) this.onClimb(false); },
    });

    // #52 — the tide gauge: a look-read landmark. Clicking names the CURRENT ring;
    // the first read journals the whole instrument (he surveyed these heights).
    if (R.tideGauge) I.add({
      id: 'tideGauge', targets: [R.tideGauge, R.gaugeTop].filter(Boolean), label: 'a graduated staff', maxDist: 36,
      onClick: () => {
        A.crankTick();
        UI.whisper({
          1: 'Five rings. The lowest sits at the old high-water. The rest climb into air no tide should own — and the top ring is fresh-cut, still pale.',
          2: 'The water stands at the second ring, exact as a promise kept.',
          3: 'The third ring, to the inch. Whoever set these knew.',
          4: 'The fourth ring. One remains above the water — fresh-cut, pale, and waiting.',
        }[Math.min(W.level, 4)] || 'The rings keep their count.');
        this.once('tideGauge', () => UI.addJournal(T.off_the_low_shore, '', 'self'));
      },
    });

    // hub Phase C — the drain's one carved line (the first tunnel's lore beat)
    I.add({
      id: 'drainMark', targets: [R.drainMark], label: 'a line carved in the wall', maxDist: 2.6,
      when: () => true,
      onClick: () => UI.whisper(T.a_line_cut_low),
    });
    // #55 — the inspector's tide ledger, wedged where the wall meets the floor: the
    // DISTRICT's voice, its official hand cracking; it drowns as you descend (the
    // drainFlood rises past its shelf — filed to a cabinet that floods).
    if (R.drainLedger) I.add({
      id: 'drainLedger', targets: [R.drainLedger],
      label: () => (W.readKeys.includes('drain_ledger') ? 'a water-swollen ledger — take it' : 'a water-swollen ledger'),
      maxDist: 2.6,
      when: () => !W.recDisp.drain_ledger,       // #132: a record — gone once carried
      onClick: () => {
        if (W.readKeys.includes('drain_ledger')) {
          W.recDisp.drain_ledger = 'carried';
          UI.whisper(T.folded_into_my_coat);
          save(this.player);
        } else UI.openReader('drain_ledger');
      },
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
          UI.whisper(T.not_yet_something_at);
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
          UI.whisper(T.the_oar_is_light);
          return;
        }
        this._oarBrink = false;
        this._oarBusy = true;
        UI.addJournal(T.i_have_left_the, '', 'self');
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
      // surfaces once you've begun to descend — and stays readable after the return
      // (the quarters keep their door; what you earned below is not re-sealed above)
      when: () => W.level >= 2 || W.flags.returned,
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
    // #130 era event L2: the climbers' rope, still swinging — a look-read, no reader
    if (R.climberRope) I.add({
      id: 'climberRope', targets: [R.climberRope], label: 'a rope, still swinging', maxDist: 6,
      when: () => W.level === 2,
      onClick: () => this.once('climberRope', () => {
        UI.whisper(T.the_rope_is_still);
        UI.addJournal(T.a_climber_s_rope, '', 'self');
      }),
    });

    // #131 HIS ROUNDS (AAA-A3): the keeper's day, findable and performable — one act
    // per era, unlocked once the strata are understood as years (the era threshold).
    // Each performance sets its flag, keeps a journal line, and arms a short NON-VERBAL
    // tableau in tick (figures act, never speak). Completing all four is read back by
    // the endings (A6).
    const roundsOn = () => W.onceKeys?.includes('eraThreshold');
    if (R.mooringCleat) I.add({
      id: 'roundMoor', targets: [R.mooringCleat], label: 'his line, made fast — take the turns', maxDist: 3.2,
      when: () => roundsOn() && W.level === 2 && !W.flags.roundMoor,
      onClick: () => this._doRound('Moor', T.the_line_takes_the, T.i_made_his_line),
    });
    if (R.returnSheet) I.add({
      id: 'roundLog', targets: [R.returnSheet], label: 'the day’s return, unsigned', maxDist: 2.6,
      when: () => roundsOn() && W.level === 3 && !W.flags.roundLog,
      onClick: () => this._doRound('Log', T.one_true_line_signed, T.i_signed_the_day),
    });
    if (R.cotLantern) I.add({
      id: 'roundLight', targets: [R.cotLantern], label: 'his small lamp, cold', maxDist: 2.6,
      when: () => roundsOn() && W.level === 4 && !W.flags.roundLight,
      onClick: () => this._doRound('Light', T.the_small_flame_takes, T.i_lit_his_small),
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
    // the annex door, LOCKED at the surface pre-descent (owner: "the chamber next to the
    // tower doesn't let me walk in" — it is designed to open one level down, but a shut
    // door with no answer reads as a bug). Clicking the closed leaf now says so, in the
    // keeper's terms; the door opens at L2+ and stays open once returned (gameplay pass).
    if (R.innerDoor) I.add({
      id: 'innerDoorLocked', targets: [R.innerDoor], label: 'a shut door', maxDist: 3.0,
      when: () => W.level < 2 && !W.flags.returned,
      onClick: () => {
        UI.whisper(T.locked_not_from_this);
        this.once('annexLocked', () => UI.addJournal(T.a_door_off_the));
      },
    });
    if (R.quartersJournal) I.add({
      id: 'quartersJournal', targets: [R.quartersJournal], label: 'a journal on the cot', maxDist: 2.6,
      // the quarters open one level down (the old `>= 1` gate was a no-op that let the
      // journal be clicked through the sealed doorway at L1); readable again post-return
      when: () => W.level >= 2 || W.flags.returned,
      onClick: () => UI.openReader('quarters_journal'),
    });

    // ---- the high pool (#49): see it dry, take it at the bottom, read it at the surface ----
    // the glint in the crack — the phial seen but unreachable while the pool stands dry
    if (R.poolGlint) I.add({
      id: 'poolGlint', targets: [R.poolGlint], label: 'something bright, wedged deep', maxDist: 3.4,
      when: () => W.level < MAX_DEPTH && !W.flags.phialTaken,
      onClick: () => {
        UI.whisper(T.glass_and_brass_wedged);
        this.once('poolGlint', () => UI.addJournal(T.high_on_the_walk, '', 'self'));
      },
    });
    // the phial afloat at L4 — the raised sea lifts it within reach
    if (R.poolPhial) I.add({
      id: 'poolPhial', targets: [R.poolPhial], label: 'a phial, afloat', maxDist: 3.2,
      when: () => W.level >= MAX_DEPTH && !W.flags.phialTaken,
      onClick: () => {
        this.flag('phialTaken');
        if (!W.inventory.includes('phial')) W.inventory.push('phial');
        A.chime();
        UI.whisper(T.the_bottom_of_the);
        UI.addJournal(T.at_the_bottom_the, '', 'self');
        save(this.player);
      },
    });
    // the dried phial on the chart table (placed by the return beat in tick)
    if (R.phialDesk) I.add({
      id: 'phialDesk', targets: [R.phialDesk], label: 'the dried phial', maxDist: 2.8,
      when: () => W.flags.phialDried,
      onClick: () => UI.openReader('pool_phial'),
    });

    // ---- THE OTHER HANDS (#50) ----
    // B: the climbers' five scratch marks — glass-revealed, one per depth. Re-clickable
    // (the whisper always answers); only the first read tallies; all five close the arc.
    const CM_GATES = {
      cmPlain: () => W.level === 2,
      cmUnfinished: () => W.level === 3,
      cmChild: () => W.level >= 4,
    };
    for (const c of CLIMBERS) {
      if (!R[c.id]) continue;
      const gate = CM_GATES[c.id];
      I.add({
        id: c.id, targets: [R[c.id]], label: 'scratches, in another hand', maxDist: c.id === 'cmTallies' ? 4.5 : 3.2,
        when: () => W.flags.readGlass && (!gate || gate()),
        onClick: () => {
          A.pluck(1174.7, 0, 0.12, 1.2);
          UI.whisper(c.whisper);
          const key = 'cm_' + c.id;
          if (W.readKeys.includes(key)) return;
          W.readKeys.push(key);
          UI.addJournal(c.journal, '', 'self');
          if (CLIMBERS.every((x) => W.readKeys.includes('cm_' + x.id))) {
            this.once('climbersAll', () => {
              UI.whisper(CLIMBERS_CLOSE.whisper);
              UI.addJournal(CLIMBERS_CLOSE.journal, '', 'self');
            });
          }
          save(this.player);
        },
      });
    }
    // C: the congregation's three carved lines — physical bands on the drowned hall,
    // readable only at L3 (the capitals risen) across the water, through the glass.
    for (const c of CONGREGATION) {
      if (!R[c.id]) continue;
      I.add({
        id: c.id, targets: [R[c.id]], label: 'a carved line, across the water', maxDist: 38, noGlint: true,
        when: () => W.level === 3 && W.flags.readGlass,
        onClick: () => {
          A.pluck(659.26, 0, 0.14, 2.2);
          UI.whisper(`Through the glass, the carved line resolves: “${c.line}”`);
          const key = 'cg_' + c.id;
          if (W.readKeys.includes(key)) return;
          W.readKeys.push(key);
          UI.addJournal(c.journal, '', 'self');
          if (CONGREGATION.every((x) => W.readKeys.includes('cg_' + x.id))) {
            this.once('congregationAll', () => {
              UI.whisper(CONGREGATION_CLOSE.whisper);
              UI.addJournal(CONGREGATION_CLOSE.journal, '', 'self');
            });
          }
          save(this.player);
        },
      });
    }
    // #69: FACTORY fragments — every LORE entry carrying `place` gets its reader
    // hotspot here automatically; a new readable is a content.js entry, nothing else.
    const LORE_GATES = { quarters: () => W.level >= 2 || W.flags.returned, l3: () => W.level === 3 };
    for (const [id, lore] of Object.entries(LORE)) {
      const pl = lore.place;
      if (!pl || !R['lore_' + id]) continue;
      const gate = pl.gate ? LORE_GATES[pl.gate] : null;
      I.add({
        id: 'lore_' + id, targets: [R['lore_' + id]],
        // #132: a record artifact grows a second phase — read it, then TAKE it
        label: lore.record
          ? () => (W.readKeys.includes(id) ? (pl.label || lore.title) + ' — take it' : pl.label || lore.title)
          : pl.label || lore.title,
        maxDist: pl.maxDist ?? 2.8,
        when: () => (!gate || gate()) && !W.recDisp[id],
        onClick: () => {
          if (lore.record && W.readKeys.includes(id)) {
            W.recDisp[id] = 'carried';
            UI.whisper(T.folded_into_my_coat);
            save(this.player);
          } else UI.openReader(id);
        },
      });
    }
    // #132 THE INSPECTION, PLAYABLE: what the player does with the record of a life.
    // FILE it — the cabinet by the cot, the drawer the District could always have
    // opened — or KEEP it: carry it down and leave it with him at the source.
    // Neither is scored; both are read back (codex header + the A6 codas).
    const recCarried = () => REC_IDS.filter((rid) => W.recDisp[rid] === 'carried');
    if (R.recordCabinet) I.add({
      id: 'recordCabinet', targets: [R.recordCabinet], label: 'the records cabinet — file what I carry', maxDist: 2.8,
      when: () => (W.level >= 2 || W.flags.returned) && recCarried().length > 0,
      onClick: () => {
        for (const rid of recCarried()) W.recDisp[rid] = 'filed';
        UI.whisper(T.the_drawer_takes_it);
        this.once('firstFile', () => UI.addJournal(T.i_filed_his_record, '', 'self'));
        save(this.player);
      },
    });
    if (R.sourceRest) I.add({
      id: 'sourceRest', targets: [R.sourceRest], label: 'the slab by his note — leave what I carry', maxDist: 2.8,
      when: () => W.level === 4 && recCarried().length > 0,
      onClick: () => {
        for (const rid of recCarried()) W.recDisp[rid] = 'kept';
        UI.whisper(T.left_with_him_at);
        this.once('firstKeep', () => UI.addJournal(T.i_did_not_file, '', 'self'));
        save(this.player);
      },
    });

    // ---- the found-lens reveal: take the keeper's reading glass and his lampblack marks appear ----
    if (R.readGlass) I.add({
      id: 'readGlass', targets: [R.readGlass], label: 'a brass reading glass', maxDist: 3.4,
      when: () => !W.flags.readGlass,
      onClick: () => {
        this.flag('readGlass');
        if (!W.inventory.includes('readglass')) W.inventory.push('readglass');
        UI.whisper(T.a_keeper_s_reading);
        UI.addJournal(T.found_the_keeper_s, '', 'self');
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
    // #54 — the lampblack micro-marks: nine one-line finds tallied in the journal.
    // Re-clickable (the line always whispers again); only the FIRST read tallies.
    // Level-keyed gates: the bell needs the annex open, the buoy exists only at L3
    // (region3) and is read across the water — the glass is a glass, after all.
    const LM_GATES = {
      lmBell: { when: () => W.level >= 2 || W.flags.returned },
      lmBuoy: { when: () => W.level === 3, maxDist: 30 },
    };
    const LM_ORD = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth'];
    for (const m of LAMPBLACK) {
      if (!R[m.id]) continue;
      const gate = LM_GATES[m.id] || {};
      I.add({
        id: m.id, targets: [R[m.id]], label: 'lampblack, written small', maxDist: gate.maxDist ?? 3.2,
        when: () => W.flags.readGlass && (!gate.when || gate.when()),
        onClick: () => {
          A.pluck(1244.5, 0, 0.13, 1.2); A.pluck(1661.2, 0.06, 0.07, 1.5);   // a soft ink-resolve
          UI.whisper(`In lampblack, small: “${m.line}”`);
          const key = 'lm_' + m.id;
          if (W.readKeys.includes(key)) return;
          W.readKeys.push(key);
          const n = W.readKeys.filter((k) => k.startsWith('lm_')).length;
          UI.addJournal(`Lampblack, under the glass — on ${m.place}, the ${LM_ORD[n - 1]} of his small true things: “${m.line}”`, '', 'self');
          if (n === LAMPBLACK.length) {
            this.once('lampblackAll', () => {
              UI.whisper(T.that_is_all_of);
              UI.addJournal(T.i_have_found_the, '', 'self');
            });
          }
          save(this.player);
        },
      });
    }
  }

  _touchStone(i) {
    // SEA-STRATA depth response (#51): the deep air carries the hum damped — darker,
    // a shade flat, longer — and says so once
    const damp = W.level > 1 ? Math.min(1, 0.45 + 0.2 * (W.level - 2)) : 0;
    // #63: the hum comes FROM its stone — play the arc by ear and the ear can find it
    const st = this.refs[`stone${i}`];
    if (st) { st.getWorldPosition(_kv); A.stoneTone(i, 0.4, damp, { x: _kv.x, z: _kv.z, ref: 16 }); }
    else A.stoneTone(i, 0.4, damp);
    if (damp) this.once('stonesDeep', () => UI.whisper(T.the_stones_hum_lower));
    this.anim.stoneGlow[i] = 1;
    if (W.flags.birdSolved) {
      // #49: after the main solve the stones stay an instrument — and once the fallen
      // sixth is awake, the keeper's own refused song (E G A D C, the box's way) can
      // finally land its missing last note on the B. Rolling window, no refusal:
      // free play never punishes, the song simply completes when it completes.
      if (W.flags.tideFigureSeen && !W.flags.keeperSong) {
        this.songSeq.push(i);
        if (this.songSeq.length > KEEPER_SONG.length) this.songSeq.shift();
        if (this.songSeq.length === KEEPER_SONG.length && this.songSeq.every((v, n) => v === KEEPER_SONG[n])) {
          this.songSeq = [];
          this.flag('keeperSong');
          A.addStem(6); W.stems = Math.max(W.stems, 6);
          setTimeout(() => { A.leitStrum(); A.pluck(493.88, 0.5, 0.22, 4.5); }, 800);
          UI.whisper(T.e_g_a_d);
          UI.addJournal(T.i_played_his_song, '', 'self');
          save(this.player);
        }
      }
      return;
    }
    if (i === 5) return;   // the fallen stone is no part of the bird's five-note lesson
    this.stoneSeq.push(i);
    const target = BIRD_MELODY;
    const n = this.stoneSeq.length;
    if (this.stoneSeq[n - 1] !== target[n - 1]) {
      // wrong — was it the music box's version they tried?
      const boxPrefix = BOX_MELODY.slice(0, n).join(',') === this.stoneSeq.join(',');
      this.stoneSeq = [];
      setTimeout(() => {
        A.deny();
        if (boxPrefix && W.flags.heardBox) UI.whisper(T.the_stones_refuse_the);
      }, 700);
    } else if (n === target.length) {
      this.stoneSeq = [];
      this.flag('birdSolved');
      A.addStem(3); W.stems = Math.max(W.stems, 3);
      setTimeout(() => A.leitStrum(), 800);   // stem-earning solve: the leitmotif, not the chime (#65)
      UI.whisper(T.the_outcrop_opens_like);
      // promote the grief-rhyme out of the optional journal into the in-the-moment whisper
      // layer (Panel #4 act-two gap): the correction that came a lifetime too late
      UI.whisper(T.some_corrections_only_ever);
      UI.addJournal(T.the_stones_accepted_the);
      save(this.player);
    }
  }

  _birdSing() {
    const stonesPos = new THREE.Vector3(SPOTS.stones.x, 9, SPOTS.stones.y);
    const d = this.player.pos.distanceTo(stonesPos);
    if (d > 38) return;
    BIRD_MELODY.forEach((stoneIdx, n) => {
      setTimeout(() => {
        A.chirp(STONE_NOTES[stoneIdx], 0, 0.35, { x: stonesPos.x, z: stonesPos.z, ref: 24 });   // #63: from the arc
        this.anim.stoneGlow[stoneIdx] = Math.max(this.anim.stoneGlow[stoneIdx], 0.5);
      }, n * 650);
    });
    if (d < 30 && this.flag('heardBird')) {
      UI.addJournal(T.at_dawn_a_bird);
      UI.whisper(T.the_bird_sings_the);
    }
  }

  // ------------------------------------------------------------------- tick
  tick(dt, elapsed) {
    const an = this.anim;
    const F = W.flags;

    // #129: the era threshold — the reframe said out loud exactly ONCE in the game,
    // in the first minute of the first descent (8s after splashdown, so the keeper's
    // arrival line has had its beat). Depth becomes time from here on.
    if (W.level === 2 && !W.onceKeys?.includes('eraThreshold')) {
      this._eraLineT = (this._eraLineT || 0) + dt;
      if (this._eraLineT > 8) this.once('eraThreshold', () => {
        UI.whisper(T.everything_down_here_is);
        UI.addJournal(T.the_water_is_higher, '', 'self');
      });
    }

    // #130 era event L3: the CAPITALS BREACH — the only time the sea gives something
    // back. On first arrival the drowned hall's crowns push up through the waterline
    // over ~9s (gallery y animated in _apply while _breachT runs); water rushes, then
    // the journal keeps it.
    if (W.level === 3 && this._breachT == null && !W.onceKeys?.includes('capitalsBreached')) {
      this.once('capitalsBreach', () => { UI.whisper(T.the_water_over_the); A.valveRush(true); });
      this._breachT = 0;
    }
    if (this._breachT != null) {
      if (W.level !== 3) { this._breachT = null; A.valveRush(false); }   // dove away mid-breach
      else {
        this._breachT += dt;
        if (this._breachT > 2.6) A.valveRush(false);
        if (this._breachT > 9) {
          this.once('capitalsBreached', () => UI.addJournal(T.i_watched_the_sea, '', 'self'));
          this._breachT = null;
        }
      }
    }

    // #130 era event L4: the BEAM'S FAREWELL — the first time the lit beam shows itself
    // at the bottom, it makes ONE full pass beneath the sea, shore to shore, and goes
    // out for the rest of the stratum (the lampLit derivation carries the exception).
    // The island stops performing; what is left down here is only the true things.
    if (W.level === 4 && W.lampLit && this._farewellT == null && !W.flags.beamFarewell) {
      this.once('beamFarewell', () => UI.whisper(T.the_light_passes_under));
      this._farewellT = 0;
      this._farewellA0 = W.beamAngle;
    }
    if (this._farewellT != null) {
      this._farewellT += dt;
      const ft = Math.min(this._farewellT / 12, 1);
      W.beamAngle = this._farewellA0 + TAU * (ft * ft * (3 - 2 * ft));   // one smooth full turn
      if (ft >= 1) {
        W.beamAngle = this._farewellA0;
        W.flags.beamFarewell = true;                     // douses the lamp below (derived off this)
        A.pluck(82.4, 0, 0.4, 6);                        // low E — the theme's root, last thing heard
        this.once('beamFarewell2', () => UI.addJournal(T.at_the_bottom_of, '', 'self'));
        this._farewellT = null;
        save(this.player);
      }
    }

    // #133: the walk home names what the water holds now — one whisper per drowned
    // piece as you pass it, and the journal keeps the sum once all three are seen.
    if (W.flags.returned) {
      const P = this.player.pos;
      const near = (x, z, r) => Math.hypot(P.x - x, P.z - z) < r;
      if (near(-18, -119.4, 13)) this.once('loss_arm', () => UI.whisper(T.the_jetty_s_outer));
      if (near(24, -103.4, 12)) this.once('loss_bench', () => UI.whisper(T.the_bench_faces_the));
      if (near(-45, -112, 13)) this.once('loss_skiff', () => UI.whisper(T.the_skiff_is_off));
      if (['loss_arm', 'loss_bench', 'loss_skiff'].every((k) => W.onceKeys?.includes(k))) {
        this.once('lossAll', () => UI.addJournal(T.three_things_the_island, '', 'self'));
      }
    }

    // #131 HIS ROUNDS tableaux — brief non-verbal stagings; figures act, never speak.
    // Each clock runs once after its round; meshes borrowed are restored exactly.
    const RF = this.refs;
    if (this._tabMoor != null) {           // the one who waited, at the tideline (8s)
      const t = (this._tabMoor += dt), tf = RF.tideFigure;
      if (tf && F.tideFigureSeen) {
        if (!this._tabMoorSaved) { this._tabMoorSaved = { pos: tf.position.clone(), rot: tf.rotation.y, vis: tf.visible, op: tf.userData.mats[0].opacity }; }
        tf.position.set(-19, waterY() - 1.1, -111);      // off the jetty's end, waist-deep
        tf.rotation.y = 2.8;                             // facing in, toward the pier
        tf.visible = true;
        tf.userData.mats.forEach((m) => { m.opacity = 0.38 * Math.sin(Math.min(t / 8, 1) * Math.PI); });
        if (t >= 8) { const s = this._tabMoorSaved; tf.position.copy(s.pos); tf.rotation.y = s.rot; tf.visible = s.vis; tf.userData.mats.forEach((m) => { m.opacity = s.op; }); this._tabMoorSaved = null; }
      }
      if (t >= 8) this._tabMoor = null;
    }
    if (this._tabLog != null) {            // the reader of returns, at the threshold (6s)
      const t = (this._tabLog += dt), wa = RF.watcher;
      if (wa && F.watcherSeen && RF.innerDoor) {
        if (!this._tabLogSaved) { this._tabLogSaved = { pos: wa.position.clone(), vis: wa.visible }; RF.innerDoor.getWorldPosition(this._tabLogP = this._tabLogP || new THREE.Vector3()); }
        wa.position.set(this._tabLogP.x, this._tabLogP.y - 1.0, this._tabLogP.z);
        wa.visible = t > 0.8 && t < 5.2;                 // there when you glance, gone when you look
        if (t >= 6) { const s = this._tabLogSaved; wa.position.copy(s.pos); wa.visible = s.vis; this._tabLogSaved = null; }
      }
      if (t >= 6) this._tabLog = null;
    }
    if (this._tabLight != null) {          // one light remembering another (10s)
      const t = (this._tabLight += dt);
      const glass = RF.cotLantern?.getObjectByName('cotLanternGlass');
      if (glass) glass.material.emissiveIntensity = 1.15 * Math.min(t / 1.5, 1) * (1 + 0.06 * Math.sin(elapsed * 7));
      const ml = this.modelRefs?.lampLens;
      if (ml) {
        if (!this._mlOwnMat) { ml.material = ml.material.clone(); this._mlOwnMat = true; }   // island lens shares the mat otherwise
        ml.material.emissiveIntensity = 0.25 + 2.0 * Math.sin(Math.min(t / 10, 1) * Math.PI);
      }
      if (t >= 10) { if (ml) ml.material.emissiveIntensity = 0.25; this._tabLight = null; }  // lantern STAYS lit — see _apply
    }
    if (this._tabWind != null) {           // the bird comes to listen (10s; visibility override in _apply)
      const t = (this._tabWind += dt);
      if (t > 4 && !this._tabWindChirped) { this._tabWindChirped = true; A.chirp(1318.5, 0, 0.3); }
      if (t >= 10) { this._tabWind = null; this._tabWindChirped = false; }
    }

    // tide easing + valve sound
    const dTide = W.tideTarget - W.tide;
    if (Math.abs(dTide) > 0.0004) {
      W.tide = clamp(W.tide + Math.sign(dTide) * dt / 13, 0, 2); // [0,2]: tide>1 RAISES the sea for SEA-STRATA depths
      an.valveSpin += dt * 4 * Math.sign(dTide);
      A.valveRush(true);
      if (!this._causewayNoted && W.tide < 0.25) {
        this._causewayNoted = true;
        this.once('causeway', () => UI.whisper(T.the_bay_gives_up));
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
    ease('innerDoor', (W.level >= 2 || W.flags.returned) ? 1 : 0, 1.0);   // stays open once returned

    // lamp + beam
    // #130: after the beam's farewell pass the light stays out for the rest of the
    // stratum — the island has stopped performing. The exception lives HERE, in the
    // derivation, so nothing can fight it; climbing out of L4 restores the derivation.
    W.lampLit = W.lensPlaced && isNight() && !(W.flags.beamFarewell && W.level === 4);
    if (W.lampLit && !this._lampLitOnce) {
      this._lampLitOnce = true;
      this.once('lamplit', () => {
        UI.cinematic(true);
        setTimeout(() => UI.cinematic(false), 5000);
        UI.whisper(T.the_lighthouse_remembers_its);
        UI.addJournal(T.at_night_the_lamp);
      });
    }
    ease('beamI', W.lampLit ? 1 : 0, 1.5);
    ease('shaft', W.lampLit ? 0.5 : 0, 1.5);
    // hub Phase B: the stair is roped off until the lamp is lit — lighting it opens the climb
    // (this is `tick`, not `_apply` — refs are reached via this.refs here, NOT the `R` param)
    if (this.refs.stairRope) this.refs.stairRope.visible = !W.lampLit;

    // golden-hour shimmer on the buried hatch
    const shimmerOn = isGolden() && !F.shadowRevealed;
    ease('shimmer', shimmerOn ? 0.5 + 0.3 * Math.sin(elapsed * 2.5) : 0, 3);

    // stones glow decay (six now — the fallen stone glows like its standing kin, #49)
    for (let i = 0; i < 6; i++) an.stoneGlow[i] = Math.max(0, an.stoneGlow[i] - dt * 0.8);

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
        A.leitStrum();   // stem-earning solve: the leitmotif, not the chime (#65)
        UI.whisper(T.the_beam_writes_on);
        UI.addJournal(`The lighthouse beam, aimed at the cliff, projects four glyphs:`,
          GLYPH_CODE.map((g) => GLYPH_CHARS[g]).join('  '));
      }
    }

    // #49: the beam turned to face the deep — the cot journal's promise, kept. Only at L3,
    // with the drowned hall's capitals risen through the surface, is there anything out
    // there to CATCH the light; aim the beam down the seaward aisle and the keeper's four
    // figures hang over the water, readable from the shoreline ridge above the old beach.
    const hallAligned = Math.abs(angleDiff(W.beamAngle, HALL_AZ)) < 0.05;
    this.hallLit = W.lampLit && hallAligned && W.level === 3;
    if (this.hallLit && !F.beamDeepSeen) {
      const dh = Math.hypot(this.player.pos.x - HALL.x, this.player.pos.z - HALL.z);
      if (dh < 60) {
        this.flag('beamDeepSeen');
        A.chime();
        UI.whisper(T.the_risen_capitals_catch);
        UI.addJournal(`He wrote that he would turn the light to face the deep — and he did. With the sea risen to the hall’s shoulders, the beam finds the drowned colonnade and writes on it: the same four figures as the cliff — ${GLYPH_CODE.map((g) => GLYPH_CHARS[g]).join('  ')}. One message, sent up the island and down it, to whoever would read it from either side of the water. The bluff’s brass dials answer to these figures; now the deep has said so itself.`, '', 'self');
      } else {
        // aimed true from the chart table but not yet walked to — name what the beam found
        this.once('beamDeepAim', () => UI.whisper(T.far_out_on_the));
      }
    }

    // ---- proximity one-times ----
    const p = this.player.pos;
    if (!F.enteredStudy && Math.hypot(p.x - LH.x, p.z - LH.z) < 4.8) {
      this.flag('enteredStudy');
      this.once('study', () => {
        UI.whisper(T.a_chart_table_and);
        UI.addJournal(T.the_study_holds_a);
      });
    }
    if (F.rulerPlaced && !this._walkedBridge && Math.abs(p.z - SPOTS.chasmBridgeZ) < 3 && p.x > 30 && p.x < 63) {
      this._walkedBridge = true;
      this.once('bridge', () => UI.whisper(T.centimetre_marks_underfoot_tall));
    }
    // the oar terminal (#22) is undiscoverable on text alone — so when a player who has come
    // all the way back (returned, at the surface) wanders near the dory, name the way out
    // unmissably, the moment they are AT it. Session-local (no save flag); the hover-glint
    // then confirms the oar is live.
    if (W.flags.returned && W.level <= 1 && !this._sawOarNudge && Math.hypot(p.x - (-26), p.z - (-102)) < 9) {
      this._sawOarNudge = true;
      UI.whisper(T.the_dory_and_its);
    }
    // #49 round trip closes: back at the surface with the pool phial, the study's dry
    // air loosens the sodden note — the phial appears on the chart table, readable at last
    if (F.phialTaken && !F.phialDried && W.level <= 1 && Math.hypot(p.x - LH.x, p.z - LH.z) < 4.8) {
      this.once('phialDry', () => {
        this.flag('phialDried');
        W.inventory = W.inventory.filter((s) => s !== 'phial');
        UI.whisper(T.you_set_the_phial);
        UI.addJournal(T.back_at_the_surface, '', 'self');
      });
    }
    if (W.level >= 2 && !this._level2Study && Math.hypot(p.x - LH.x, p.z - LH.z) < 4.8) {
      this._level2Study = true;
      this.once('level2study', () => {
        UI.whisper(T.the_inner_door_stands);
        UI.addJournal(T.one_level_down_the);
      });
    }
    // discoverability of the climb (Panel #4 #1): at the bottom, in the study (near both
    // the plate AND the bell), make sure the player learns the plate turns back — the one
    // true payoff must not be missable behind a guess. Fork-NEUTRAL: it names the EXISTENCE
    // of the way up, never a choice; the bell finale is untouched. Fires once.
    if (W.level >= MAX_DEPTH && !W.flags.climbing && Math.hypot(p.x - LH.x, p.z - LH.z) < 4.8) {
      this.once('climbHint', () => {
        UI.whisper(T.nowhere_deeper_the_plate);
        UI.addJournal(T.there_is_no_further, '', 'self');
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
          UI.whisper(T.you_have_stood_here);
          UI.addJournal(T.i_keep_leaving_this, '', W.level >= 2 ? 'keeper' : 'self');
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
            UI.whisper(T.there_you_are_i);
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
        UI.whisper(T.another_study_west_of);
        UI.addJournal(T.a_second_study_faces);
      });
    }

    // the brink lets go if you step off the plate — a felt drawing-back
    if (this._brink) {
      const plate = this.refs.deskPlate;
      if (!plate || Math.hypot(p.x - plate.position.x, p.z - plate.position.z) > 1.25) {
        this._brink = false;
        A.duckAmbient(false);
        UI.whisper(T.you_step_back_from);
      }
    }
    // the EMBRACE's brink lets go the same way — step off the plate and the offer waits, so the
    // turn-and-rise is always a fresh, deliberate two-touch (never a stale single tap)
    if (this._embraceBrink) {
      const plate = this.refs.deskPlate;
      if (!plate || Math.hypot(p.x - plate.position.x, p.z - plate.position.z) > 1.25) {
        this._embraceBrink = false;
        A.duckAmbient(false);
        UI.whisper(T.you_step_back_he);
      }
    }
    // the OAR's brink lets go the same way — walk away from the dory and it resets, so leaving
    // is always a deliberate two-touch and never fires on a single touch with a stale brink
    // (the oar sits in the dory group, so use its WORLD position, not its local .position)
    if (this._oarBrink) {
      const oar = this.refs.doryOar;
      if (!oar || (oar.getWorldPosition(_ov), Math.hypot(p.x - _ov.x, p.z - _ov.z) > 3.6)) {
        this._oarBrink = false;
        UI.whisper(T.you_set_the_oar);
      }
    }

    this._tickEncounters(dt);
    this._tickBuoy(dt);

    // apply to both islands
    this._apply(this.refs, false, elapsed);
    this._apply(this.modelRefs, true, elapsed);
  }

  // SEA-STRATA L3 bell-buoy (#52): the drowned channel's marker still keeps its watch.
  // An untended toll on an uneven swell clock — damped-long like everything down here,
  // fading with distance but never quite gone (L3's sound-led nav cue) — and a journal
  // beat the first time you come near it (the ramp descent passes ~15m away).
  _tickBuoy(dt) {
    if (!this.refs.bellBuoy || W.level !== 3) return;
    this._buoyT = (this._buoyT || 0) + dt;
    const period = 13 + 3.5 * Math.sin((this._buoyRing || 0) * 2.7);
    if (this._buoyT > period) {
      this._buoyT = 0; this._buoyRing = (this._buoyRing || 0) + 1;
      const d = Math.hypot(this.player.pos.x - 52, this.player.pos.z - 12);
      const vol = Math.max(0.06, 0.34 * (1 - d / 160));
      A.pluck(174.6, 0, vol, 3.6, { x: 52.3, z: 12.5, ref: 60 });           // F3 — a sea-bell's low toll, from the channel (#63)
      A.pluck(352.8, 0.03, vol * 0.35, 2.4, { x: 52.3, z: 12.5, ref: 60 });   // detuned octave shimmer over it
    }
    if (Math.hypot(this.player.pos.x - 52, this.player.pos.z - 12) < 26) {
      this.once('bellBuoySeen', () => {
        UI.whisper(T.a_bell_buoy_listing);
        UI.addJournal(T.a_bell_buoy_lists, '', 'self');
      });
    }
  }

  // THE ENCOUNTER ENGINE (#72) — the Watcher and the Tide-Figure were near-identical
  // one-shot scripts; they are ONE engine now, keyed off LEVELS[].encounter (the field
  // debug tooling alone used to read), with per-figure STANCE and RESOLUTION strategies.
  // Every number is the shipped, walk-verified behavior; the debug handles keep their
  // exact state names (_watcherRegard / _tideRegard / _tfPrev). After resolution each
  // figure leaves a rare, quiet ECHO — an inhabitant's trace, not an event's absence.
  static ENCOUNTERS = [
    {
      id: 'watcher', ref: 'watcher', flag: 'watcherSeen', regardKey: '_watcherRegard',
      stance: 'approach-unwatched',                 // drifts toward you unwatched; freezes when seen
      lookDot: 0.82, lookMax: 70, still: null,
      driftRate: 1.5, driftMin: 2.4, regardDecay: 1.5,
      dissolve: (w, dt) => {                        // resolved: shrink and RISE out of being
        w.scale.multiplyScalar(Math.max(0, 1 - dt * 1.6));
        w.position.y += dt * 0.5;
        return w.scale.x < 0.05;
      },
      onResolve() {
        UI.whisper(T.you_did_not_run);
        UI.addJournal(T.on_the_deep_shore, '', 'self');
      },
      // the echo: a far cold pinprick that stands a moment at the shore and goes —
      // never approaching, never twice in a row. What was seen stays seen.
      echo(game) {
        const a = Math.random() * TAU, d = 46 + Math.random() * 24;
        const x = game.player.pos.x + Math.sin(a) * d, z = game.player.pos.z + Math.cos(a) * d;
        A.pluck(1318.5, 0, 0.045, 3.2, { x, z, ref: 50 });   // the cold light's one high note, far off
        game.once('watcherEcho', () => UI.whisper(T.far_along_the_shore));
      },
      echoEveryS: [110, 190],
    },
    {
      id: 'tideFigure', ref: 'tideFigure', flag: 'tideFigureSeen', regardKey: '_tideRegard',
      stance: 'evade-chase',                        // disperses when waded at; settles for stillness
      lookDot: 0.66, lookMax: 42,
      chase: { speed: 1.3, dist: 16, back: 2.6, lateral: 0.55 },
      still: { speed: 0.6, min: 2.2, max: 34 },
      regardDecay: 1.0,
      dissolve: (f, dt) => {                        // resolved: settle, sink, fade
        f.position.y -= dt * 0.5;
        f.scale.multiplyScalar(Math.max(0, 1 - dt * 1.1));
        for (const m of (f.userData.mats || [])) m.opacity = Math.max(0, m.opacity - dt * 0.6);
        return f.scale.x < 0.06;
      },
      onResolve(game, f) {
        // one bell-note across the water — a real note (#49): B, the one the
        // pentatonic never had. The fallen stone at the arc is listening for it.
        A.pluck(493.88, 0, 0.42, 3.6, { x: f.position.x, z: f.position.z, ref: 30 });
        A.pluck(987.77, 0.07, 0.16, 4.6, { x: f.position.x, z: f.position.z, ref: 30 });
        UI.whisper(T.you_stop_wading_for);
        UI.addJournal(T.a_shape_stood_in, '', 'self');
      },
      // the echo: the laid note still crosses the water sometimes, faint, from the kelp
      echo(game) {
        A.pluck(493.88, 0, 0.05, 4.5, { x: 8, z: -101, ref: 40 });
        game.once('tideEcho', () => UI.whisper(T.faint_from_the_kelp));
      },
      echoEveryS: [130, 220],
    },
  ];

  _tickEncounters(dt) {
    const active = LEVELS[W.level]?.encounter;
    for (const spec of Game.ENCOUNTERS) {
      const fig = this.refs[spec.ref];
      if (!fig) continue;
      const seen = W.flags[spec.flag];
      const live = spec.id === active && !seen;
      if (!live) {
        if (seen && fig.visible) {                       // resolution animation, then gone for good
          if (spec.dissolve(fig, dt)) fig.visible = false;
        } else if (!seen) {
          fig.visible = false;                           // wrong level: hidden
        }
        // the ECHO: only on the figure's own level, only after resolution, rare
        if (seen && spec.id === active) {
          const key = spec.id + 'EchoT';
          this[key] = (this[key] ?? spec.echoEveryS[0] * (0.5 + Math.random() * 0.5)) - dt;
          if (this[key] <= 0) {
            this[key] = spec.echoEveryS[0] + Math.random() * (spec.echoEveryS[1] - spec.echoEveryS[0]);
            spec.echo(this);
          }
        }
        continue;
      }
      fig.visible = true;
      const p = this.player.pos;
      const dx = fig.position.x - p.x, dz = fig.position.z - p.z;
      const dist = Math.hypot(dx, dz) || 1e-3;
      fig.lookAt(p.x, fig.position.y, p.z);
      const fx = -Math.sin(this.player.yaw), fz = -Math.cos(this.player.yaw);
      const looked = (fx * dx + fz * dz) / dist > spec.lookDot && dist < spec.lookMax;
      if (spec.stance === 'approach-unwatched') {
        if (looked) {
          this[spec.regardKey] = Math.min((this[spec.regardKey] || 0) + dt, 3);
          if (this[spec.regardKey] >= 2.6 && this.flag(spec.flag)) spec.onResolve(this, fig);
        } else {
          this[spec.regardKey] = Math.max((this[spec.regardKey] || 0) - dt * spec.regardDecay, 0);
          if (dist > spec.driftMin) {                    // drifts toward you when unwatched
            const step = spec.driftRate * dt;
            fig.position.x -= (dx / dist) * step;
            fig.position.z -= (dz / dist) * step;
            const gy = heightAt(fig.position.x, fig.position.z);
            if (Number.isFinite(gy)) fig.position.y = gy;
          }
        }
      } else {                                           // 'evade-chase' — stillness resolves
        const prev = this._tfPrev || { x: p.x, z: p.z };
        const speed = dt > 0 ? Math.hypot(p.x - prev.x, p.z - prev.z) / dt : 0;
        this._tfPrev = { x: p.x, z: p.z };
        if (looked && speed > spec.chase.speed && dist < spec.chase.dist) {
          this[spec.regardKey] = 0;                      // waded at → disperse, keep the kelp between
          const ax = dx / dist, az = dz / dist;
          fig.position.x += (ax - az * spec.chase.lateral) * dt * spec.chase.back;
          fig.position.z += (az + ax * spec.chase.lateral) * dt * spec.chase.back;
          const gy = heightAt(fig.position.x, fig.position.z);
          if (Number.isFinite(gy)) fig.position.y = gy;
        } else if (looked && speed < spec.still.speed && dist > spec.still.min && dist < spec.still.max) {
          this[spec.regardKey] = Math.min((this[spec.regardKey] || 0) + dt, 3);
          if (this[spec.regardKey] >= 2.6 && this.flag(spec.flag)) spec.onResolve(this, fig);
        } else {
          this[spec.regardKey] = Math.max((this[spec.regardKey] || 0) - dt * spec.regardDecay, 0);
        }
      }
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
    if (R.drownedGallery) {
      let gy = (W.level === 3 ? 2.6 : 0);
      // #130: during the breach event the crowns push up through the waterline —
      // ease the last 1.7m over ~9s (island instance only; the model is surface-only)
      if (!isModel && W.level === 3 && this._breachT != null) {
        const bt = Math.min(this._breachT / 9, 1);
        gy = 0.9 + 1.7 * (bt * bt * (3 - 2 * bt));
      }
      R.drownedGallery.position.y = gy;
    }
    // L4 'source': strip the surface forest + grass on the REAL island (a cold bare floor at the
    // bottom of the recursion) — the 1:240 chart-table CLONE keeps them (it's the surface island model).
    if (!isModel) {
      const surfaceUp = W.level !== 4;
      if (R.trunks) R.trunks.visible = surfaceUp;
      if (R.canopies) R.canopies.visible = surfaceUp;     // fir silhouette
      if (R.canopies2) R.canopies2.visible = surfaceUp;   // spruce silhouette (loop #139)
      if (R.canopiesFar) R.canopiesFar.visible = surfaceUp;     // #6: the far LOD pair strips too
      if (R.canopiesFar2) R.canopiesFar2.visible = surfaceUp;
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
    for (const id of ['lensMarkStudy', 'lensMarkStone',
      'lmValve', 'lmBox', 'lmChest', 'lmDory', 'lmJetty', 'lmStair', 'lmBell', 'lmBuoy', 'lmDrain',     // #54: the nine micro-marks fade with the two LORE marks
      'cmTallies', 'cmFormal', 'cmPlain', 'cmUnfinished', 'cmChild']) {                                  // #50: the climbers' scratches surface the same way
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

    for (let i = 0; i < 6; i++) {
      const shell = R[`stoneGlow${i}`];
      if (shell && !isModel) shell.material.opacity = an.stoneGlow[i] * 0.55;
      const mk = R[`stoneMark${i}`];
      // the fallen stone's glyph stays dark until its note comes home (#49)
      if (mk && !isModel) mk.material.opacity = (i === 5 && !F.tideFigureSeen) ? 0 : 0.78 + an.stoneGlow[i] * 0.22;
    }

    // #49 — the high pool: water only the descent brings; the glint while it's dry;
    // the phial afloat at the bottom; the dried phial on the chart table after.
    if (R.poolWater) {
      const wy = waterY();
      R.poolWater.visible = wy > 3.46;                             // POOL.floor + a film
      R.poolWater.position.y = Math.min(wy, 3.42 + 0.62);          // never above the rim
      if (!isModel) R.poolWater.material.opacity = 0.7 + 0.08 * Math.sin(elapsed * 1.1);
    }
    if (R.poolGlint) {
      R.poolGlint.visible = !F.phialTaken && W.level < MAX_DEPTH;
      const halo = R.poolGlint.children[1];
      if (halo && !isModel) halo.material.opacity = 0.3 + 0.22 * Math.sin(elapsed * 2.3);
    }
    if (R.poolPhial) {
      R.poolPhial.visible = !F.phialTaken && W.level >= MAX_DEPTH;
      if (R.poolPhial.visible) {
        R.poolPhial.position.y = Math.min(waterY(), 3.42 + 0.62) + 0.04 + Math.sin(elapsed * 0.9) * 0.015;
        R.poolPhial.rotation.y = elapsed * 0.22;
      }
    }
    if (R.phialDesk) R.phialDesk.visible = !!F.phialDried;
    // #49 — the hall glyphs hang in the beam only while it holds the drowned hall (L3)
    if (R.hallGlyphs) R.hallGlyphs.visible = !!this.hallLit;

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

    if (R.songBird) R.songBird.visible = isDawn() || (!isModel && this._tabWind != null);   // #131: the bird comes to listen
    // #131: once lit, his small lamp STAYS lit (the tableau owns it while its clock runs)
    if (R.cotLantern && this._tabLight == null) {
      const lg = R.cotLantern.getObjectByName('cotLanternGlass');
      if (lg) lg.material.emissiveIntensity = W.flags.roundLight ? 1.05 : 0;
    }
    // #133 THE SHRINKING SHORE: three pieces in pre-loss or drowned pose, keyed to the
    // descent's milestones (dove → the arm, L3 → the bench, L4 → the skiff). Hard-set
    // each frame from persisted state, so saves and the model clone can never drift.
    {
      const lost = W.regions.l4seen ? 3 : W.regions.l3seen ? 2 : W.flags.dove ? 1 : 0;
      const pose = (m, isLost, y, rx, rz, px, pz, ry) => {
        if (!m) return;
        if (!m.userData.pre) m.userData.pre = { p: m.position.clone(), rx: m.rotation.x, ry: m.rotation.y, rz: m.rotation.z };
        const pre = m.userData.pre;
        if (isLost) {
          m.position.set(px ?? pre.p.x, y, pz ?? pre.p.z);
          m.rotation.set(rx, ry ?? pre.ry, rz);
        } else {
          m.position.copy(pre.p);
          m.rotation.set(pre.rx, pre.ry, pre.rz);
        }
      };
      pose(R.jettyArm, lost >= 1, -1.35, 0.12, 0.06);
      pose(R.shoreBench, lost >= 2, -0.42, -0.06, 0.04, 24, -103.4, Math.PI + 0.15);
      pose(R.shoreSkiff, lost >= 3, -0.28, 0.02, 0.18, -45, -112, 1.2);
    }
    // #132: the record's dispositions — a carried artifact leaves the world; the
    // cabinet's filed stack and the source's kept pile grow with their counts
    for (const rid of REC_IDS) {
      const rm = R['lore_' + rid] || (rid === 'drain_ledger' ? R.drainLedger : null);
      if (rm) rm.visible = !W.recDisp[rid];
    }
    {
      const filedN = REC_IDS.filter((rid) => W.recDisp[rid] === 'filed').length;
      const keptN = REC_IDS.filter((rid) => W.recDisp[rid] === 'kept').length;
      const cst = R.recordCabinet?.getObjectByName('cabinetStack');
      if (cst) { cst.visible = filedN > 0; cst.scale.y = Math.max(filedN, 0.001); }
      const spl = R.sourceRest?.getObjectByName('sourceRestPile');
      if (spl) { spl.visible = keptN > 0; spl.scale.y = Math.max(keptN, 0.001); }
    }
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
      // #53: once CARRIED, the pair stands on the model's beach at every depth — the
      // keeper no longer vanishes at the surface; the reunion is what the model holds now
      // STRICT boolean (fire 35 bugfix): `(false || undefined) && x` leaks undefined,
      // and three.js only culls on visible === false — the island-scale figure stood
      // glowing on the wake-up beach for every fresh save since #53. Never again.
      fig.visible = !!((W.level >= 2 || F.carried) && isModel);
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

    // #53: the second figure — warm beside his cold — exists only once carried
    if (R.tinyCompanion) R.tinyCompanion.visible = !!(isModel && F.carried);   // same undefined-leak: the companion showed on the model PRE-carry (twist spoiler)

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
