// puzzles.js — the chain: tide → ruler → birdsong → shadows → beam → dive.
// One Game instance owns all hotspots and applies WorldState to BOTH island
// instances every frame.

import * as THREE from 'three';
import {
  W, save, isNight, isDawn, isGolden, sunAzimuth, sunElevation, SCALE_MODEL,
  MAX_DEPTH, waterY, LEVELS, actForFlag, recordAct, recordWriting, writings,
  handId, draft, evidence, upstreamEvents, hands, MAX_TIDE, effectiveTideAt,
} from './world.js';
import { SPOTS, heightAt, walkableY } from './terrain.js';
import {
  BIRD_MELODY, BOX_MELODY, STONE_NOTES, HATCH_CODE, BEAM_GLYPHS,
  updateSandWriting,
} from './props.js';
import { Interactions } from './interact.js';
import { UI } from './ui.js';
import A from './audio.js';
import { clamp, lerp, lerpAngle, TAU } from './util.js';
import { UpstreamHand } from './upstream-hand.js';
import {
  NOTE_IDS, PROGRESSION, advanceDecimalDial, advanceLowerHandRegard, canAttemptStoneSong,
  canOpenChest, canRevealShimmer, hatchCodeMatches, nextPlateAction,
} from './progression.js';
import {
  LAMPBLACK, LAMPBLACK_CLOSE, HAND_MARKS, CLIMBERS, CLIMBERS_CLOSE,
  CONGREGATION, CONGREGATION_CLOSE, LORE, T,
} from './content.js';
import { resetPuzzleRuntimeState } from './puzzle-runtime.js';
import { nextRefugeAction } from './refuge.js';
import { DISPOSITION_IDS, dispositionOperation, nextDisposition } from './dispositions.js';

// #132: the inspector's record — every LORE entry flagged record:true participates
// in the FILE-or-KEEP economy (read → take → cabinet or source).
const REC_IDS = Object.keys(LORE).filter((id) => LORE[id].record);

// The tide gauge's top ring — cut by the keeper above every waterline the descent
// has, "measured, not yet met". Under THE STACK it is the one mark in the world that
// accumulated displacement can reach and a single player's work cannot. Mirrored from
// props.js (the gauge's `top.position.y`); keep them together if either moves.
const GAUGE_FIFTH_Y = 4.83;

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

export class Game {
  constructor({ refs, modelRefs, modelRoot, modelAnchor, interact, player, notebook, onDive, onAscend, onEnding, onClimb }) {
    if (!notebook || typeof notebook.record !== 'function' || typeof notebook.has !== 'function') {
      throw new TypeError('Game requires a Notebook instance');
    }
    for (const [name, callback] of Object.entries({ onDive, onAscend, onEnding, onClimb })) {
      if (typeof callback !== 'function') throw new TypeError(`Game requires an ${name} callback`);
    }
    this.refs = refs;
    this.modelRefs = modelRefs;
    this.player = player;
    this.interact = interact;
    this.notebook = notebook;
    this.progression = PROGRESSION;
    this.onDive = onDive;
    this.onAscend = onAscend;
    this.onEnding = onEnding;
    this.onClimb = onClimb;     // hub Phase B: ascend/descend the lamp-room stair (up = true/false)

    // The chart-table half has to be built after instantiateModel(), while its
    // architectural half already has an L2-only root in regions/l2_shallows.js.
    // One owner drives both so the 1:240 break can never desynchronise.
    this.upstreamHand = refs.upstreamHand && modelRoot ? new UpstreamHand({
      worldRoot: refs.upstreamHand,
      modelRoot,
      modelWheel: modelRefs.valveWheel,
      waterY,
      reducedMotion: () => W.reduceMotion,
    }) : null;

    W.dials = Array.isArray(W.dials) && W.dials.length === HATCH_CODE.length
      ? W.dials.map((n) => ((Math.trunc(Number(n)) || 0) % 10 + 10) % 10)
      : HATCH_CODE.map(() => 0);

    this._runtimeTimers = new Set();
    this._mlOwnMat = false;
    this._encounterStarts = new Map(Game.ENCOUNTERS.flatMap((spec) => {
      const fig = refs[spec.ref];
      if (!fig) return [];
      return [[spec.ref, {
        position: fig.position.clone(), quaternion: fig.quaternion.clone(),
        scale: fig.scale.clone(), visible: fig.visible,
        opacities: (fig.userData.mats || []).map((material) => material.opacity),
      }]];
    }));
    this.resetRuntime();

    this._buildHotspots(modelAnchor);
  }

  _scheduleRuntime(callback, delayMs) {
    const timer = setTimeout(() => {
      this._runtimeTimers.delete(timer);
      callback();
    }, delayMs);
    this._runtimeTimers.add(timer);
    return timer;
  }

  // The one lifecycle boundary for state that is intentionally absent from saves.
  // A run reset must be able to happen halfway through any note pattern, encounter,
  // delayed era beat, or borrowed tableau without letting the old run speak again.
  resetRuntime() {
    for (const timer of this._runtimeTimers) clearTimeout(timer);
    this._runtimeTimers.clear();

    this._upstreamAudioStop?.();
    this._upstreamAudioStop = null;
    this.upstreamHand?.cancel();
    A.valveRush(false);
    A.duckAmbient(false);
    A.duckAmbient(false, 'upstreamHand');

    for (const [ref, start] of this._encounterStarts) {
      const fig = this.refs[ref];
      if (!fig) continue;
      fig.position.copy(start.position);
      fig.quaternion.copy(start.quaternion);
      fig.scale.copy(start.scale);
      fig.visible = start.visible;
      (fig.userData.mats || []).forEach((material, i) => {
        if (start.opacities[i] !== undefined) material.opacity = start.opacities[i];
      });
    }

    const lanternGlass = this.refs.cotLantern?.getObjectByName('cotLanternGlass');
    if (lanternGlass?.material) lanternGlass.material.emissiveIntensity = 0;
    if (this.modelRefs?.lampLens?.material) this.modelRefs.lampLens.material.emissiveIntensity = 0.25;
    if (this.refs.handMarks) this.refs.handMarks.count = 0;

    resetPuzzleRuntimeState(this);
  }

  flag(name, value = true) {
    if (W.flags[name] === value) return false;
    W.flags[name] = value;
    // THE LAW (STACK.md §2): the acts that reach through the model and change the
    // world are displaced downward, never dissolved. recordAct is a no-op for the
    // flags that cost nobody anything, which is most of them.
    if (value) {
      const act = actForFlag(name);
      if (act) recordAct(act, this.player);
    }
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

  _recordEvidence(id, args) {
    return this.notebook.record(id, args);
  }

  _plateBlocked(action) {
    A.deny();
    const missing = new Set(action.missing || []);
    if (action.gate === 'surfaceFirst') {
      UI.whisper(missing.has('refugeLit')
        ? 'The plate is cold. The open east room has a lamp and dry floor.'
        : 'The plate answers three unfinished lines: basin, sky, and crossing.');
    } else if (action.gate === 'surfaceDeep') {
      UI.whisper(missing.has('plumbHung')
        ? 'The first crossing is still in the brass. A deeper line has not reached the hook.'
        : 'The plate has no complete line through the lighthouse yet.');
    } else if (action.gate === 'level2') {
      UI.whisper(missing.has('upstreamHandWitnessed')
        ? 'The plate answers the water, but the dead valve has not yet shown what moves it.'
        : 'The plate answers, then stills. Something in the kelp remains unwitnessed.');
    } else if (action.gate === 'level3') {
      UI.whisper(missing.has('registerRead')
        ? 'The plate waits on the study register. Its measure has not settled.'
        : 'The plate catches a cold reflection from the shore. It will not deepen yet.');
    } else if (action.gate === 'level4') {
      UI.whisper(missing.has('lowerHandRegarded')
        ? 'The plate is warm, but the small figure below has not held your regard.'
        : 'The brass index has not been set.');
    } else if (action.gate === 'refuge-return') {
      UI.whisper('The plate is still. The small lamp in the east room is burning.');
    } else {
      UI.whisper('The plate has no crossing to offer.');
    }
  }

  // #131: perform one of HIS ROUNDS — flag it, keep it, stage its tableau (tick owns
  // the timers). kind ∈ Moor|Log|Light|Wind; the Wind round rides the music box.
  _doRound(kind, whisper) {
    if (W.flags['round' + kind]) return;
    W.flags['round' + kind] = true;
    UI.whisper(whisper);
    this._recordEvidence(`event.round.${kind.toLowerCase()}`);
    A.themeRound(kind);                        // #137: the round's instrument states the theme
    this['_tab' + kind] = 0;                   // arm the tableau clock
    save(this.player);
    if (W.flags.roundMoor && W.flags.roundLog && W.flags.roundLight && W.flags.roundWind) {
      this.once('roundsAll', () => this._recordEvidence('event.rounds-complete'));
    }
  }

  // ---------------------------------------------------------------- hotspots
  _buildHotspots(modelAnchor) {
    const I = this.interact;
    const R = this.refs;

    // THE GENEROUS MARK. Every other ledger verb makes the next rung harder.
    // This one line travels through the same append-only source at zero draft,
    // and the shore renderer gives it back weathered below.
    const hasOwnWriting = () => {
      const h = String(handId()).slice(0, 16);
      return writings(W.level).some((m) => m.r === W.level && String(m.h).slice(0, 16) === h);
    };
    if (R.sandStylus) I.add({
      id: 'sandWriting', targets: [R.sandStylus], label: 'a driftwood stylus', maxDist: 5.5,
      when: () => !W.writing && !hasOwnWriting(),
      onClick: () => {
        const wasLocked = this.player.locked;
        this.player.locked = true;
        const opened = UI.openSandWriter({
          onCommit: (line) => {
            const mark = recordWriting(line, this.player);
            if (!mark) return false;
            this._writingFor = null;                    // redraw the fresh hand next frame
            UI.whisper('The line holds. One rung down, the tide will read it.', 4200);
            return mark;
          },
          onClose: () => { this.player.locked = wasLocked; },
        });
        if (!opened) this.player.locked = wasLocked;
      },
    });

    // brass valve — the tide
    I.add({
      id: 'valve', targets: [R.valveWheel], label: 'the brass valve',
      onClick: () => {
        // SEA-STRATA: below the surface the tide is the descent's, not yours — the wheel goes dead.
        if (W.level > 1) {
          UI.whisper(T.the_sea_no_longer);
          this._recordEvidence('evidence.dead-wheel');
          // THE UPSTREAM HAND. At the first drowned level an inherited valve mark
          // crosses the model's 1:240 boundary. Exact provenance matters: an
          // unrelated pile of costly marks must never make this wheel answer.
          if (W.level === 2) this._armUpstreamHand();
          return;
        }
        W.tideTarget = W.tideTarget > 0.5 ? 0 : 1;
        if (this.flag('valveTurned')) {
          A.leitStrum();   // the first turn earns a stem — the island's own figure answers (#65)
          A.addStem(1); W.stems = Math.max(W.stems, 1);
          UI.whisper(T.below_the_window_the);
          this._recordEvidence('evidence.valve');
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
        // THE ERAS ARE RULESETS (STACK.md §3.4). The strata were a colour grade; each
        // one now changes what kind of place this is to hold an instrument in. The
        // crank is the model verb that still reaches you at depth, so it carries the
        // arc:  L1 obeys → L2 lags → L3 is audited → L4 refuses.
        //
        // L4, the last winter: the model refuses outright. The plate is the only
        // instrument left, which is exactly the shape of that era.
        if (W.level >= MAX_DEPTH) {
          this.once('crankDead', () => UI.whisper(T.the_hour_will_not));
          return;
        }
        // SEA-STRATA depth response (#51): the hours drag heavy below the surface — the
        // same pull moves less sky the deeper you carry it
        const drag = W.level > 1 ? 1 / (1 + 0.5 * (W.level - 1)) : 1;
        const delta = dx * 0.011 * drag;
        // L2, the arrival years: the model's edits land LATE. You pull, the sky does
        // not move, and a moment after you stop it goes where you put it — the cost
        // arriving after you caused it, which is the whole law in miniature.
        if (W.level === 2) {
          this._pendHour = (this._pendHour || 0) + delta;
          this._pendHold = 0;
          this._crankAcc = (this._crankAcc || 0) + Math.abs(dx);
          if (this._crankAcc > 26) { this._crankAcc = 0; A.crankTick(); }
          this.once('crankLag', () => UI.whisper(T.the_wheel_turns_and));
          return;
        }
        W.time = ((W.time + delta) % 24 + 24) % 24;
        this._crankAcc = (this._crankAcc || 0) + Math.abs(dx);
        if (this._crankAcc > 26) { this._crankAcc = 0; A.crankTick(); }
        if (W.level > 1) this.once('crankDeep', () => UI.whisper(T.the_crank_resists_as));
        if (this.flag('crankUsed')) {
          UI.whisper(T.the_little_lamp_drags);
          this._recordEvidence('evidence.crank');
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
          this._scheduleRuntime(() => {
            const missing = W.level >= 4 && n === 3;
            if (!missing) A.pluck(STONE_NOTES[stoneIdx] * 2 * det, 0, depth ? 0.3 : 0.4, depth ? 2.1 : 1.4);
            else this.once('boxMissingNote', () => UI.whisper(T.the_fourth_note_does));
            if (n === BOX_MELODY.length - 1) this._scheduleRuntime(() => { this.boxPlaying = false; }, 900 + depth * 250);
          }, n * gap);
        });
        if (depth) this.once('boxDeep', () => UI.whisper(T.the_song_comes_up));
        if (this.flag('heardBox')) {
          this._recordEvidence('evidence.music-box');
        }
        // #131 the WIND round rides the box: at the surface, once the strata are years,
        // winding it IS one of his rounds — once more than needed, for no one there
        if (W.level === 1 && W.onceKeys?.includes('eraThreshold') && !W.flags.roundWind) {
          this._doRound('Wind', T.wound_the_way_he);
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
            this._recordEvidence('evidence.fallen-stone');
          });
          return;
        }
        this.once('fallenStoneWakes', () => {
          UI.whisper(T.the_fallen_stone_hums);
          this._recordEvidence('evidence.fallen-stone', { awake: true });
        });
        this._touchStone(5);
      },
    });

    // chest + ruler
    I.add({
      id: 'chest', targets: [R.chestLid.parent], label: 'a half-buried chest',
      when: () => !W.flags.rulerTaken,
      onClick: () => {
        if (!canOpenChest(W)) {
          A.deny();
          UI.whisper(W.flags.valveTurned
            ? 'Water still presses the lid into the sand.'
            : 'The tide has packed the chest shut. Its lid will not lift under water.');
          return;
        }
        if (!W.flags.chestOpen) {
          this.flag('chestOpen'); A.chime();
          UI.whisper(T.the_hinges_remember_how);
        } else if (!W.flags.rulerTaken) {
          this.flag('rulerTaken');
          W.inventory.push('ruler');
          A.chime();
          UI.whisper(T.a_cartographer_s_brass);
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
        this._scheduleRuntime(() => UI.cinematic(false), 5200);
        UI.whisper(T.across_the_island_something);
        // Keep the visible survey-grid confirmation at the action site.
        UI.whisper(T.you_do_not_need);
        this._recordEvidence('evidence.ruler');
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
        // the one act of displacement that isn't a flag (lensPlaced is top-level),
        // so it records here rather than through flag()/FLAG_MARKS
        recordAct('lens', this.player);
        W.inventory = W.inventory.filter((s) => s !== 'lens');
        A.chime();
        UI.whisper(T.far_above_glass_settles);
        this._recordEvidence('evidence.lens');
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

    // ---- the model's micro-finds: the signature object holds details that only the
    // reading glass resolves at 1:240.
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
        this.once('modelBottle', () => this._recordEvidence('evidence.model-bottle'));
      },
    });
    const mGaugeProxy = proxy(-64, 2.5, -93, 2.2);
    I.add({
      id: 'modelGauge', targets: [mGaugeProxy], label: 'a staff the height of an eyelash', maxDist: 2.6, noGlint: true,
      when: () => W.flags.readGlass,
      onClick: () => {
        A.crankTick();
        UI.whisper(T.even_here_a_staff);
        this.once('modelGauge', () => this._recordEvidence('evidence.model-gauge'));
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
        save(this.player);
      },
    });

    // hatch shimmer + dials
    I.add({
      id: 'shimmer', targets: [R.hatchShimmer], label: 'troubled sand', maxDist: 6, noGlint: true,
      when: () => canRevealShimmer(W, isGolden()) && !W.flags.shadowRevealed,
      onClick: () => {
        this.flag('shadowRevealed');
        A.chime();
        UI.whisper(T.the_sand_slides_from);
        this._recordEvidence('evidence.shadow-hatch');
        save(this.player);
      },
    });
    for (let i = 0; i < 4; i++) {
      I.add({
        id: `dial${i}`, targets: [R[`dial${i}`]], label: 'a numbered dial', maxDist: 4,
        when: () => W.flags.shadowRevealed && !W.flags.hatchOpen,
        onClick: () => {
          this._recordEvidence('evidence.hatch-numerals');
          W.dials[i] = advanceDecimalDial(W.dials[i]);
          A.crankTick();
          if (hatchCodeMatches(W.dials, HATCH_CODE)) {
            // One solved mechanical state, committed in one save. There is no
            // inferred-code waypoint and no frame where "decoded" is true while
            // the hatch remains closed.
            W.flags.hatchCodeDecoded = true;
            W.flags.hatchOpen = true;
            const act = actForFlag('hatchOpen');
            if (act) recordAct(act, this.player);
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
      when: () => W.flags.hatchOpen && !W.flags.plumbTaken,
      onClick: () => {
        this.flag('plumbTaken');
        W.inventory.push('plumb');
        A.chime();
        UI.whisper(T.heavier_than_it_looks);
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
        this._recordEvidence('evidence.plumb');
        save(this.player);
      },
    });

    // The plate is the crossing threshold in every stratum. It is live before the
    // plumb reaches it: the first, short line goes only to the receiver in L2; the
    // plumb later extends that same mechanism into the deeper stack.
    I.add({
      id: 'plate', targets: [R.deskPlate], label: 'the brass plate', maxDist: 3.5,
      when: () => true,
      onClick: () => {
        const d = Math.hypot(this.player.pos.x - R.deskPlate.position.x, this.player.pos.z - R.deskPlate.position.z);
        if (d > 1.0) { UI.whisper(T.stand_on_it); return; }
        const action = nextPlateAction({
          world: W, notebook: this.notebook, maxDepth: MAX_DEPTH, armed: !!this._brink,
        });
        if (action.kind === 'blocked') {
          this._brink = false;
          A.duckAmbient(false);
          this._plateBlocked(action);
          return;
        }
        if (action.kind.startsWith('arm-')) {
          this._brink = true;
          A.duckAmbient(true);
          UI.whisper(action.kind === 'arm-descent'
            ? (action.route === 'surfaceFirst'
              ? 'The brass reaches one level down. Touch it again to cross.'
              : 'The plumb line draws the room deeper. Touch it again to cross.')
            : action.kind === 'arm-ascent'
              ? (action.route === 'receiver-return'
                ? 'The brass pulls toward the lit room above. Touch it again to return.'
                : 'The brass draws the room upward. Touch it again to cross.')
              : 'The brass holds.');
          return;
        }
        this._brink = false;
        A.duckAmbient(false);
        if (action.kind === 'descend') {
          this.onDive();
        } else if (action.kind === 'ascend') {
          this.flag('climbing');
          this.onAscend();
        }
      },
    });

    // ---- THE CLIMB (hub Phase B) — earn the way up by lighting the lamp ----
    // the foot of the tower stair: when the lamp is lit, climb to the lamp-room gallery + the vista.
    I.add({
      id: 'climbStair', targets: [R.stairFoot], label: 'the stair to the lamp', maxDist: 2.8,
      when: () => W.lampLit && !W.atTop,
      onClick: () => this.onClimb(true),
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
      onClick: () => this.onClimb(false),
    });

    // Four factual operations, available only after the lower figure has been
    // regarded. The dial carries its own legend; this interaction replaces stale
    // queued feedback so the sentence can never disagree with the pointer.
    if (R.dispDial) I.add({
      id: 'dispSet', targets: [R.dispDial],
      label: () => {
        const operation = dispositionOperation(W.disposition);
        return W.flags.dispositionChosen
          ? `${operation.verb.toLowerCase()} — ${operation.operation}`
          : 'a brass index, four engraved operations';
      },
      maxDist: 2.6,
      when: () => W.level >= MAX_DEPTH && W.flags.lowerHandRegarded,
      onClick: () => {
        if (!W.flags.dispositionChosen) {
          W.disposition = 'tend';
          this.flag('dispositionChosen');
          this._recordEvidence('evidence.disposition');
        } else {
          W.disposition = nextDisposition(W.disposition).id;
        }
        A.crankTick();
        const operation = dispositionOperation(W.disposition);
        UI.whisperNow(`${operation.verb}: ${operation.operation}.`);
        save(this.player);
      },
    });

    // #52 — the tide gauge: a look-read landmark. Clicking names the CURRENT ring;
    // the first read records the instrument.
    if (R.tideGauge) I.add({
      id: 'tideGauge', targets: [R.tideGauge, R.gaugeTop].filter(Boolean), label: 'a graduated staff', maxDist: 36,
      onClick: () => {
        A.crankTick();
        // THE DRAFT MADE READABLE (STACK.md §3.2): the gauge was authored for a world
        // where each rung sat at exactly its ring. It doesn't any more — the rungs
        // above displace water onto this one — so the instrument is where you can
        // SEE that. The rings are the promise; the water over them is what was passed
        // down. Under a hand's breadth reads as the authored line (rounding, not a lie).
        const over = draft();
        UI.whisper(over > 0.03 ? {
          1: 'Five rings. The lowest sits at the old high-water; the top is fresh-cut, still pale.',
          2: 'The water stands over the second ring. Not by much. But the ring was cut for a promise, and the promise is under it.',
          3: 'The third ring is drowned by a hand’s width. Whoever set these knew the height — they did not know how many would come after.',
          4: 'The fourth ring is gone under. Only the fresh-cut one is still in air, and the water is climbing to meet it.',
        }[Math.min(W.level, 4)] : {
          1: 'Five rings. The lowest sits at the old high-water. The rest climb into air no tide should own — and the top ring is fresh-cut, still pale.',
          2: 'The water stands at the second ring, exact as a promise kept.',
          3: 'The third ring, to the inch. Whoever set these knew.',
          4: 'The fourth ring. One remains above the water — fresh-cut, pale, and waiting.',
        }[Math.min(W.level, 4)] || 'The rings keep their count.');
        // THE FIFTH RING (STACK.md §3.2) — the gauge is also the READOUT of the one
        // goal in the game you cannot reach alone. Its top ring sits at y4.83, which
        // needs tide 2.15; a rung's deepest authored waterline is 1.9, and ONE hand's
        // whole surface chain displaces about 0.134. So the fifth ring is only ever
        // met by accumulated work — you plus somebody else, or you across runs. Every
        // click reports the remaining gap, so the promise is legible long before it
        // can be kept, and so the player can watch their own displacement close it.
        const gap = GAUGE_FIFTH_Y - waterY();
        if (gap > 0.02) UI.whisper(T.the_top_ring_stands.replace('{gap}', gap.toFixed(2)));
        this.once('tideGauge', () => this._recordEvidence('evidence.tide-gauge', { level: W.level }));
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
      label: () => (this.notebook?.hasReadLore('drain_ledger') ? 'a water-swollen ledger — take it' : 'a water-swollen ledger'),
      maxDist: 2.6,
      when: () => !W.recDisp.drain_ledger,       // #132: a record — gone once carried
      onClick: () => {
        if (this.notebook?.hasReadLore('drain_ledger')) {
          W.recDisp.drain_ledger = 'carried';
          UI.whisper(T.folded_into_my_coat);
          save(this.player);
        } else UI.openReader('drain_ledger');
      },
    });

    // The bell remains an instrument, not a hidden ending button. It can be sounded
    // at depth without stealing the player's unfinished descent or disposition.
    I.add({
      id: 'bell', targets: [R.bell], label: 'a small bright bell', maxDist: 2.2,
      when: () => W.level >= 2,
      onClick: () => {
        A.chime();
        UI.whisper(W.level >= MAX_DEPTH
          ? 'One clear note crosses the bottom water and returns unchanged.'
          : 'The bell answers once. Nothing opens.');
      },
    });

    // The oar is part of the changed surface, not another terminal. The dry-room lamp
    // is the sole, visible place where a disposition becomes an ending.
    I.add({
      id: 'oar', targets: [R.doryOar, R.doryHull], label: 'the oar', maxDist: 3.2,
      when: () => W.level <= 1 && W.flags.returned,
      onClick: () => {
        A.crankTick();
        UI.whisper('The oar lifts freely. The dory remains beached above the new tideline.');
      },
    });

    // ---- the reading surface: fragments of the keeper's life, found in any order ----
    // Books, letters, inscriptions you OPEN and READ; the story assembles non-linearly as you
    // explore. UI records the artifact's stable surface/deep note IDs only as the
    // player reaches those pages.
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
        this._recordEvidence('evidence.climber-rope');
      }),
    });

    // #131 HIS ROUNDS (AAA-A3): the keeper's day, findable and performable — one act
    // per era, unlocked once the strata are understood as years (the era threshold).
    // Each performance sets its flag, records the act, and arms a short NON-VERBAL
    // tableau in tick (figures act, never speak). Completing all four is read back by
    // the endings (A6).
    const roundsOn = () => W.onceKeys?.includes('eraThreshold');
    if (R.mooringCleat) I.add({
      id: 'roundMoor', targets: [R.mooringCleat], label: 'his line, made fast — take the turns', maxDist: 3.2,
      when: () => roundsOn() && W.level === 2 && !W.flags.roundMoor,
      onClick: () => this._doRound('Moor', T.the_line_takes_the),
    });
    if (R.returnSheet) I.add({
      id: 'roundLog', targets: [R.returnSheet], label: 'the day’s return, unsigned', maxDist: 2.6,
      when: () => roundsOn() && W.level === 3 && !W.flags.roundLog,
      onClick: () => this._doRound('Log', T.one_true_line_signed),
    });
    if (R.cotLantern) I.add({
      id: 'refugeLamp', targets: [R.cotLantern],
      label: () => {
        if (!W.flags.refugeLit) return 'a small lamp — light it';
        if (W.flags.returned && !W.flags.endingCommitted) {
          const operation = dispositionOperation(W.disposition);
          return `the refuge lamp — ${operation.verb.toLowerCase()}`;
        }
        return 'the small lamp, burning';
      },
      maxDist: 2.6,
      when: () => W.level <= 1,
      onClick: () => {
        const action = nextRefugeAction({ world: W, armed: !!this._refugeBrink });
        if (action.kind === 'light-refuge') {
          this.flag('refugeLit');
          W.flags.roundLight = true;
          this._recordEvidence('event.refuge-lit');
          A.chime();
          UI.whisper('A dry circle of floor appears around the cot.');
          save(this.player);
        } else if (action.kind === 'arm-ending') {
          this._refugeBrink = true;
          const operation = dispositionOperation(W.disposition);
          A.duckAmbient(true);
          UI.whisperNow(`${operation.verb}: ${operation.operation}. Touch the lamp again to commit.`);
        } else if (action.kind === 'commit-ending') {
          this._refugeBrink = false;
          A.duckAmbient(false);
          this.onEnding(W.disposition || 'tend');
        } else if (action.kind === 'keep-light') {
          A.crankTick();
          UI.whisper('The wick holds. The boards inside the threshold are dry.');
        }
      },
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
      when: () => true,
      onClick: () => UI.openReader('quarters_journal'),
    });

    // ---- the high pool (#49): see it dry, take it at the bottom, read it at the surface ----
    // the glint in the crack — the phial seen but unreachable while the pool stands dry
    if (R.poolGlint) I.add({
      id: 'poolGlint', targets: [R.poolGlint], label: 'something bright, wedged deep', maxDist: 3.4,
      when: () => W.level < MAX_DEPTH && !W.flags.phialTaken,
      onClick: () => UI.whisper(T.glass_and_brass_wedged),
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
          const key = c.noteId;
          if (this.notebook?.has(key)) return;
          this._recordEvidence(key);
          if (CLIMBERS.every((x) => this.notebook?.has(x.noteId))) {
            this.once('climbersAll', () => {
              UI.whisper(CLIMBERS_CLOSE.whisper);
              this._recordEvidence(CLIMBERS_CLOSE.noteId);
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
          const key = c.noteId;
          if (this.notebook?.has(key)) return;
          this._recordEvidence(key);
          if (CONGREGATION.every((x) => this.notebook?.has(x.noteId))) {
            this.once('congregationAll', () => {
              UI.whisper(CONGREGATION_CLOSE.whisper);
              this._recordEvidence(CONGREGATION_CLOSE.noteId);
            });
          }
          save(this.player);
        },
      });
    }
    // #69: FACTORY fragments — every LORE entry carrying `place` gets its reader
    // hotspot here automatically; a new readable is a content.js entry, nothing else.
    const LORE_GATES = { quarters: () => true, l3: () => W.level === 3 };
    for (const [id, lore] of Object.entries(LORE)) {
      const pl = lore.place;
      if (!pl || !R['lore_' + id]) continue;
      const gate = pl.gate ? LORE_GATES[pl.gate] : null;
      I.add({
        id: 'lore_' + id, targets: [R['lore_' + id]],
        // #132: a record artifact grows a second phase — read it, then TAKE it
        label: lore.record
          ? () => (this.notebook?.hasReadLore(id) ? (pl.label || lore.title) + ' — take it' : pl.label || lore.title)
          : pl.label || lore.title,
        maxDist: pl.maxDist ?? 2.8,
        when: () => (!gate || gate()) && !W.recDisp[id],
        onClick: () => {
          if (lore.record && this.notebook?.hasReadLore(id)) {
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
        const records = recCarried();
        for (const rid of records) W.recDisp[rid] = 'filed';
        UI.whisper(T.the_drawer_takes_it);
        this._recordEvidence('record.filed');
        save(this.player);
      },
    });
    if (R.sourceRest) I.add({
      id: 'sourceRest', targets: [R.sourceRest], label: 'the slab by his note — leave what I carry', maxDist: 2.8,
      when: () => W.level === 4 && recCarried().length > 0,
      onClick: () => {
        const records = recCarried();
        for (const rid of records) W.recDisp[rid] = 'kept';
        UI.whisper(T.left_with_him_at);
        this._recordEvidence('record.kept');
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
        this._recordEvidence('mechanism.reading-glass');
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
    // #54 — the lampblack micro-marks: nine one-line finds tallied in field notes.
    // Re-clickable (the line always whispers again); only the FIRST read tallies.
    // Level-keyed gates: the bell needs the annex open, the buoy exists only at L3
    // (region3) and is read across the water — the glass is a glass, after all.
    const LM_GATES = {
      lmBell: { when: () => W.level >= 2 || W.flags.returned },
      lmBuoy: { when: () => W.level === 3, maxDist: 30 },
    };
    for (const m of LAMPBLACK) {
      if (!R[m.id]) continue;
      const gate = LM_GATES[m.id] || {};
      I.add({
        id: m.id, targets: [R[m.id]], label: 'lampblack, written small', maxDist: gate.maxDist ?? 3.2,
        when: () => W.flags.readGlass && (!gate.when || gate.when()),
        onClick: () => {
          A.pluck(1244.5, 0, 0.13, 1.2); A.pluck(1661.2, 0.06, 0.07, 1.5);   // a soft ink-resolve
          UI.whisper(`In lampblack, small: “${m.line}”`);
          const key = m.noteId;
          if (this.notebook?.has(key)) return;
          this._recordEvidence(key);
          const n = LAMPBLACK.filter((item) => this.notebook?.has(item.noteId)).length;
          if (n === LAMPBLACK.length) {
            this.once('lampblackAll', () => {
              UI.whisper(T.that_is_all_of);
              this._recordEvidence(LAMPBLACK_CLOSE.noteId);
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
          this._scheduleRuntime(() => { A.leitStrum(); A.pluck(493.88, 0.5, 0.22, 4.5); }, 800);
          UI.whisper(T.e_g_a_d);
          this._recordEvidence('evidence.completed-song');
          save(this.player);
        }
      }
      return;
    }
    if (!canAttemptStoneSong(W)) {
      this.stoneSeq = [];
      A.deny();
      this.once('stonesNeedBothSongs', () => UI.whisper(
        W.flags.heardBox || W.flags.heardBird
          ? 'The stones answer as separate notes. One of the island’s two songs is still missing.'
          : 'The stones answer as separate notes. There is no sequence to test yet.',
      ));
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
      this._scheduleRuntime(() => {
        A.deny();
        if (boxPrefix && W.flags.heardBox) UI.whisper(T.the_stones_refuse_the);
      }, 700);
    } else if (n === target.length) {
      this.stoneSeq = [];
      this.flag('birdSolved');
      A.addStem(3); W.stems = Math.max(W.stems, 3);
      this._scheduleRuntime(() => A.leitStrum(), 800);   // stem-earning solve: the leitmotif, not the chime (#65)
      UI.whisper(T.the_outcrop_opens_like);
      // Confirm the physical correction at the stones themselves.
      UI.whisper(T.some_corrections_only_ever);
      this._recordEvidence('mechanism.stone-vault');
      save(this.player);
    }
  }

  _birdSing() {
    const stonesPos = new THREE.Vector3(SPOTS.stones.x, 9, SPOTS.stones.y);
    const d = this.player.pos.distanceTo(stonesPos);
    if (d > 38) return;
    BIRD_MELODY.forEach((stoneIdx, n) => {
      this._scheduleRuntime(() => {
        A.chirp(STONE_NOTES[stoneIdx], 0, 0.35, { x: stonesPos.x, z: stonesPos.z, ref: 24 });   // #63: from the arc
        this.anim.stoneGlow[stoneIdx] = Math.max(this.anim.stoneGlow[stoneIdx], 0.5);
      }, n * 650);
    });
    if (d < 30 && this.flag('heardBird')) {
      this._recordEvidence('evidence.bird');
      UI.whisper(T.the_bird_sings_the);
    }
  }

  // ------------------------------------------------------------------- tick
  tick(dt, elapsed) {
    const an = this.anim;
    const F = W.flags;

    this._tickHandMarks(dt);   // the other hand's scuffs speak when you stand in them
    this._tickUpstreamHandLifecycle(); // …and the sea moves once with nobody at the wheel
    this._tickFifthRing();     // the ring he cut for a level that did not exist yet
    this._tickEraLag(dt);      // L2: the hour you asked for, arriving late
    this._tickRegister(dt);    // L3: the era that measures, measuring the hands

    // #129: the era threshold — the reframe said out loud exactly ONCE in the game,
    // in the first minute of the first descent (8s after splashdown, so the keeper's
    // arrival line has had its beat). Depth becomes time from here on.
    if (W.level === 2 && !W.onceKeys?.includes('eraThreshold')) {
      this._eraLineT = (this._eraLineT || 0) + dt;
      if (this._eraLineT > 8) this.once('eraThreshold', () => {
        UI.whisper(T.everything_down_here_is);
        this._recordEvidence('arrival.shallows');
      });
    }

    // THE LAW, said out loud exactly ONCE in the game (STACK.md §2). It waits for
    // the era line so the first descent isn't two statements in a row, and it only
    // fires when the player has actually DISPLACED something — the sentence has to
    // land on water they put there, or it is just a slogan. Whisper only, never
    // repeated, never explained. Everything after this is shown.
    // L2 earns this line from the Upstream Hand's physical reveal. L3 remains the
    // fallback for a player who never touches the dead wheel on the way down.
    if (W.level >= 3 && draft() >= 0.03 - 1e-6 && W.onceKeys?.includes('eraThreshold')) {
      this._lawT = (this._lawT || 0) + dt;
      if (this._lawT > 6) this.once('theLaw', () => UI.whisper(T.it_has_to_go_somewhere));
    }

    // #130 era event L3: the CAPITALS BREACH — the only time the sea gives something
    // back. On first arrival the drowned hall's crowns push up through the waterline
    // over ~9s (gallery y animated in _apply while _breachT runs); water rushes, then
    // the field notes keep the measurement.
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
          this.once('capitalsBreached', () => this._recordEvidence('event.capitals-breach'));
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
        this.once('beamFarewell2', () => this._recordEvidence('event.beam-farewell'));
        this._farewellT = null;
        save(this.player);
      }
    }

    // #133: the walk home names what the water holds now — one whisper per drowned
    // piece as you pass it, and one field note keeps the sum once all three are seen.
    if (W.flags.returned) {
      const P = this.player.pos;
      const near = (x, z, r) => Math.hypot(P.x - x, P.z - z) < r;
      if (near(-18, -119.4, 13)) this.once('loss_arm', () => UI.whisper(T.the_jetty_s_outer));
      if (near(24, -103.4, 12)) this.once('loss_bench', () => UI.whisper(T.the_bench_faces_the));
      if (near(-45, -112, 13)) this.once('loss_skiff', () => UI.whisper(T.the_skiff_is_off));
      if (['loss_arm', 'loss_bench', 'loss_skiff'].every((k) => W.onceKeys?.includes(k))) {
        this.once('lossAll', () => this._recordEvidence('event.returned-shore'));
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
    // Shared draft can legitimately take the deep strata past the debug slider's
    // 2.0. Ease over the full authored+ledger range and close the final fraction
    // exactly; clamping at 2 left late multiplayer arrivals rushing forever.
    W.tideTarget = clamp(Number.isFinite(W.tideTarget) ? W.tideTarget : 1, 0, MAX_TIDE);
    const dTide = W.tideTarget - W.tide;
    if (Math.abs(dTide) > 0.0004) {
      W.tide = clamp(W.tide + clamp(dTide, -dt / 13, dt / 13), 0, MAX_TIDE);
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
    ease('innerDoor', 1, 1.0);   // the refuge is offered before the machinery asks anything

    // lamp + beam
    // #130: after the beam's farewell pass the light stays out for the rest of the
    // stratum — the island has stopped performing. The exception lives HERE, in the
    // derivation, so nothing can fight it; climbing out of L4 restores the derivation.
    W.lampLit = W.lensPlaced && (isNight() || W._finaleLamp === true)
      && !(W.flags.beamFarewell && W.level === 4);
    if (W.lampLit && !this._lampLitOnce) {
      this._lampLitOnce = true;
      this.once('lamplit', () => {
        UI.cinematic(true);
        this._scheduleRuntime(() => UI.cinematic(false), 5000);
        UI.whisper(T.the_lighthouse_remembers_its);
        this._recordEvidence('mechanism.lighthouse');
      });
    }
    ease('beamI', W.lampLit ? 1 : 0, 1.5);
    ease('shaft', W.lampLit ? 0.5 : 0, 1.5);
    // hub Phase B: the stair is roped off until the lamp is lit — lighting it opens the climb
    // (this is `tick`, not `_apply` — refs are reached via this.refs here, NOT the `R` param)
    if (this.refs.stairRope) this.refs.stairRope.visible = !W.lampLit;

    // golden-hour shimmer on the buried hatch
    const shimmerOn = canRevealShimmer(W, isGolden()) && !F.shadowRevealed;
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
        this._recordEvidence(NOTE_IDS.beamGlyphs, { glyphs: [...BEAM_GLYPHS] });
        A.addStem(5); W.stems = Math.max(W.stems, 5);
        A.leitStrum();   // stem-earning solve: the leitmotif, not the chime (#65)
        UI.whisper(T.the_beam_writes_on);
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
        this._recordEvidence(NOTE_IDS.beamGlyphs, { glyphs: [...BEAM_GLYPHS] });
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
        this._recordEvidence('evidence.study-model');
      });
    }
    if (F.rulerPlaced && !this._walkedBridge && Math.abs(p.z - SPOTS.chasmBridgeZ) < 3 && p.x > 30 && p.x < 63) {
      this._walkedBridge = true;
      this.once('bridge', () => UI.whisper(T.centimetre_marks_underfoot_tall));
    }
    // Returning changes the tideline around the dory. Name the physical difference
    // once; the oar remains an ordinary instrument rather than an ending switch.
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
      });
    }
    if (W.level >= 2 && !this._level2Study && Math.hypot(p.x - LH.x, p.z - LH.z) < 4.8) {
      this._level2Study = true;
      this.once('level2study', () => {
        UI.whisper(T.the_inner_door_stands);
        this._recordEvidence('arrival.shallows');
      });
    }
    // The bottom changes the plate itself; this is an observation of the engraved
    // object, not a narrator telling the player which ending to choose.
    if (W.level >= MAX_DEPTH && !W.flags.climbing && Math.hypot(p.x - LH.x, p.z - LH.z) < 4.8) {
      this.once('climbHint', () => {
        UI.whisper('The plate’s engraved arrows point upward here. The brass index beside it has four stops.');
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
          this._recordEvidence('evidence.study-unchanged');
        });
      }
    }
    // The lower hand is not the player and never becomes a companion. At the source
    // it can only be regarded: close, directly looked at, and held in stillness for
    // 2.6 seconds. The body turns first; no identity line supplies an interpretation.
    if (W.level >= 3 && this.modelRefs.tinyFigure) {
      this.modelRefs.tinyFigure.getWorldPosition(_kv);
      const dx = _kv.x - p.x, dz = _kv.z - p.z;
      const dist = Math.hypot(dx, dz) || 1e-6;
      const fx = -Math.sin(this.player.yaw), fz = -Math.cos(this.player.yaw);
      const dot = (fx * dx + fz * dz) / dist;
      const prev = this._lowerPrev;
      const speed = prev && dt > 0 ? Math.hypot(p.x - prev.x, p.z - prev.z) / dt : Infinity;
      this._lowerPrev = { x: p.x, z: p.z };
      const regard = advanceLowerHandRegard(this._lowerRegard || 0, {
        dt,
        distance: W.level >= MAX_DEPTH ? dist : Infinity,
        lookDot: dot,
        speed,
      });
      this._lowerLookTarget = dist < 2.4 && dot > 0.5 ? 1 : 0;
      this._lowerRegard = regard.seconds;
      if (regard.complete) this.resolveLowerHand();
    } else {
      this._lowerLookTarget = 0;
      this._lowerRegard = 0;
      this._lowerPrev = null;
    }
    this._lowerLook = lerp(this._lowerLook, this._lowerLookTarget, 1 - Math.exp(-4 * dt));

    // The Room That Disagrees (#18): in the cellar, drawn to the west window, the
    // player sees a model that contradicts the world — name the unease, once
    if (W.flags.hatchOpen && !this._roomDisagrees && p.y < 19.6 && p.y > 17
        && Math.abs(p.z - (SPOTS.hatch.y - 13.6)) < 4.6 && p.x > SPOTS.hatch.x - 6 && p.x < SPOTS.hatch.x - 2.5) {
      this._roomDisagrees = true;
      this.once('roomDisagrees', () => {
        UI.whisper(T.another_study_west_of);
        this._recordEvidence('evidence.room-disagreement');
      });
    }

    // the brink lets go if you step off the plate — a felt drawing-back
    if (this._brink) {
      const plate = this.refs.deskPlate;
      if (!plate || Math.hypot(p.x - plate.position.x, p.z - plate.position.z) > 1.25) {
        this._brink = false;
        A.duckAmbient(false);
        UI.whisper('The plate’s vibration settles.');
      }
    }
    if (this._refugeBrink) {
      const lamp = this.refs.cotLantern;
      lamp?.getWorldPosition(_kv);
      if (!lamp || !W.flags.returned || Math.hypot(p.x - _kv.x, p.z - _kv.z) > 3.0) {
        this._refugeBrink = false;
        A.duckAmbient(false);
        UI.whisper('The lamp settles back to one steady flame.');
      }
    }

    this._tickEncounters(dt);
    this._tickBuoy(dt);

    // apply to both islands
    this._apply(this.refs, false, elapsed);
    this._apply(this.modelRefs, true, elapsed);

    // Last in the frame on purpose: _apply writes the shared valve animation to
    // both islands; the Upstream Hand then overrides ONLY the miniature wheel for
    // the few seconds in which the model acts before the world does.
    this.upstreamHand?.tick(dt);
  }

  // SEA-STRATA L3 bell-buoy (#52): the drowned channel's marker still keeps its watch.
  // An untended toll on an uneven swell clock — damped-long like everything down here,
  // fading with distance but never quite gone (L3's sound-led nav cue) — and a field-note
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
        this._recordEvidence('evidence.bell-buoy');
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
      onResolve(game) {
        UI.whisper(T.you_did_not_run);
        game._recordEvidence('encounter.watcher');
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
        game._recordEvidence('encounter.tide-figure');
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

  // A second touch can commit either a crossing or the chosen ending. Keep both
  // transitions outside autosave so Continue never lands in a half-confirmed state.
  atBrink() { return !!(this._brink || this._refugeBrink); }

  resolveLowerHand() {
    if (!this.flag('lowerHandRegarded')) return false;
    this._recordEvidence(NOTE_IDS.lowerHand);
    A.chime();
    UI.whisper('The small figure turns and holds one hand against the model’s flooded shore.');
    return true;
  }

  resolveEncounter(id) {
    const spec = Game.ENCOUNTERS.find((entry) => entry.id === id);
    const fig = spec && this.refs[spec.ref];
    if (!spec || !fig || !this.flag(spec.flag)) return false;
    spec.onResolve(this, fig);
    return true;
  }

  upstreamState() {
    return this.upstreamHand?.inspect() || {
      phase: 'idle', active: false, sourceHand: null, sourceKind: null,
      modelPulse: 0, wallScale: 0, worldRadius: 0, surged: false,
      reducedMotion: !!W.reduceMotion,
    };
  }

  // Crossing and terminal owners need one synchronous lifecycle boundary. Resolve
  // preserves the displaced tide, while a terminal may withhold the event's line so
  // it cannot speak across the ending that superseded it.
  resolveUpstreamHand({ reveal = true } = {}) {
    this.upstreamHand?.resolve({ reveal });
  }

  // A shared ledger pull may finish after the arrival frame. Force the two
  // ledger-backed renderers to rebuild without touching any gameplay state.
  refreshStack() {
    this._marksFor = null;
    this._writingFor = null;
  }

  // ---------------------------------------------------- state → scene graph
  // Lay the inherited marks into the world. Each becomes a worn patch of ground at
  // the spot the act was performed, sized and spun from the mark itself so two hands
  // never leave identical scuffs — and so the layout is stable across reloads (a
  // wandering stain would read as a bug, not as wear).
  _placeHandMarks(im) {
    const ev = evidence(W.level);
    this._marks = [];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
    let n = 0;
    for (const mk of ev) {
      if (n >= im.instanceMatrix.count) break;
      if (!mk.at) continue;                       // an act with no place cannot be found
      const [x, , z] = mk.at;
      const y = walkableY(x, z);
      // Evidence you cannot find is not evidence. A scuff records where somebody
      // STOOD, on dry land — and the draft their work caused is exactly what drowns
      // that spot on the rung below. So a mark under the waterline is skipped rather
      // than drawn as a pale smear on the seabed. The ones that survive are the ones
      // still above water, which is its own quiet statement about what gets kept.
      if (y < waterY() + 0.15) continue;
      // a deterministic per-mark jitter: the hand id + kind, not Math.random
      let h = 0;
      const key = mk.h + mk.k + mk.r;
      for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
      const rot = ((h % 628) / 100);
      const size = 1.5 + ((h >>> 8) % 90) / 100;  // 1.5 .. 2.4 m of worn ground
      // +0.06 clears floor-mesh thickness (0.03 buried it in the study flagstones)
      m4.compose(v.set(x, y + 0.06, z), q.setFromEuler(e.set(0, rot, 0)), s.set(size, 1, size * 0.82));
      im.setMatrixAt(n, m4);
      this._marks.push({ x, z, k: mk.k, id: key });
      n++;
    }
    im.count = n;
    im.instanceMatrix.needsUpdate = true;
  }

  // L2 (the arrival years): release the hour the player already asked for. Held until
  // their hand has been still a beat, then applied all at once — the sky catching up
  // with a decision that was made a moment ago and somewhere else.
  _tickEraLag(dt) {
    if (!this._pendHour) return;
    this._pendHold = (this._pendHold || 0) + dt;
    if (this._pendHold < 1.1) return;
    W.time = ((W.time + this._pendHour) % 24 + 24) % 24;
    this._pendHour = 0;
    this._pendHold = 0;
    A.crankTick();
    if (this.flag('crankUsed')) this._recordEvidence('evidence.crank');
  }

  // L3 (the inspection years): your ledger is READ. The era whose authority measures
  // instead of protects finally measures the thing that matters — how many hands have
  // been through here. Spoken once, at the chart table, where the counting is done.
  _tickRegister(dt) {
    if (W.level !== 3 || W.flags.registerRead) return;
    const p = this.player.pos;
    if (Math.hypot(p.x - (-86.4), p.z - (-39.3)) > 3.2) {
      this._regT = 0;
      return;
    }
    this._regT = (this._regT || 0) + dt;
    if (this._regT < 1.6) return;
    const n = hands();
    this.flag('registerRead');
    this._recordEvidence(NOTE_IDS.register, { hands: n });
    this.once('register', () => {
      UI.whisper(n <= 1 ? T.the_register_has_one : T.the_register_counts_the.replace('{n}', String(n)));
    });
  }

  // THE FIFTH RING met. Fires wherever the player is standing — it is the sea's
  // announcement, not a room's. Once per game, and it cannot be reached by one
  // hand's work, which is the entire point of putting it in the world.
  _tickFifthRing() {
    if (waterY() < GAUGE_FIFTH_Y || W.onceKeys?.includes('fifthRing')) return;
    this.once('fifthRing', () => {
      A.valveRush(true);
      UI.whisper(T.the_water_is_at);
      this._recordEvidence('event.fifth-ring');
    });
  }

  // THE UPSTREAM HAND (STACK.md §3.3) — choose an actual inherited valve mark.
  // A stranger wins when the shared stack has one; your own surface act is the
  // complete offline reading.
  _armUpstreamHand() {
    if (!this.upstreamHand || this.upstreamHand.active) return false;
    if (W.flags.upstreamHandWitnessed) return false;
    const mine = String(handId()).slice(0, 16);
    const valves = upstreamEvents(2, 'valve');
    const mark = valves.find((m) => String(m.h).slice(0, 16) !== mine) || valves[0];
    if (!mark) return false;

    return this.upstreamHand.begin(mark, {
      onModel: () => {
        A.duckAmbient(true, 'upstreamHand');
        this._upstreamAudioStop = A.upstreamHand({ x: -82.7, z: -38.9, ref: 8 });
      },
      onSurge: () => {
        // Commit the physical consequence at the instant it happens. Observation is
        // a later fact: a reload between surge and reveal may stage the evidence again,
        // but the persisted rise remains idempotent and can never be applied twice.
        W.flags.upstreamHandSurged = true;
        if (W.level === 2) W.tideTarget = Math.max(W.tideTarget, effectiveTideAt(2));
        save(this.player);
      },
      onReveal: () => {
        this.flag('upstreamHandWitnessed');
        this._recordEvidence(NOTE_IDS.upstreamHand);
        this.once('theLaw', () => UI.whisper(T.it_has_to_go_somewhere, 5200));
      },
      onComplete: () => {
        this._upstreamAudioStop?.();
        this._upstreamAudioStop = null;
        A.duckAmbient(false, 'upstreamHand');
      },
    });
  }

  // Lifecycle guard only. The authored animation itself is owned by
  // UpstreamHand.tick() after both island instances apply their state.
  _tickUpstreamHandLifecycle() {
    if (!this.upstreamHand?.active) return;
    if (W.level !== 2) this.resolveUpstreamHand();
  }

  // Say what happened here, once, when the player is close enough to be standing
  // where the other hand stood. Session-scoped (not onceKeys): hearing it again on
  // a later run is right — it is a place, not a cutscene — and it keeps the save
  // from accreting an unbounded key per stranger.
  _tickHandMarks(dt) {
    if (!this._marks || !this._marks.length) return;
    this._heardMarks = this._heardMarks || new Set();
    this._markCool = Math.max(0, (this._markCool || 0) - dt);
    if (this._markCool > 0) return;
    const p = this.player.pos;
    for (const m of this._marks) {
      if (this._heardMarks.has(m.id)) continue;
      if (Math.hypot(p.x - m.x, p.z - m.z) > 2.6) continue;
      const line = HAND_MARKS[m.k];
      if (!line) continue;
      this._heardMarks.add(m.id);
      UI.whisper(line);
      this._markCool = 9;                         // never stack two strangers at once
      break;
    }
  }

  _apply(R, isModel, elapsed) {
    if (!R.water) return;
    const an = this.anim;
    const F = W.flags;

    // SEA-STRATA (loop #117): show exactly the active level's region shell. Driven from
    // W.level every frame (not imperatively at dive time) so a reload restores the right
    // register. Guarded — the regions are pruned from the clone, so this no-ops on isModel.
    // THE OTHER HAND'S MARKS (STACK.md §3.1): lay out the scuffs this rung inherited.
    // Rebuilt on rung change, plus once when a late shared sync calls refreshStack().
    // Island instance only (the clone prunes handMarks).
    if (!isModel && R.handMarks && this._marksFor !== W.level) {
      this._marksFor = W.level;
      this._placeHandMarks(R.handMarks);
    }

    // The shore line follows the active waterline and re-renders whenever a
    // local or shared word arrives. No per-frame canvas work: the tiny signature
    // below is the only check performed until the rung, ledger, or waterline changes.
    if (!isModel && R.sandWriting) {
      const words = writings(W.level);
      const seaY = waterY();
      const shoreStep = Math.round(seaY * 20) / 20;
      const key = W.level + '|' + shoreStep + '|' + words.map((m) => [m.r, m.h, m.n, m.t].join(':')).join('|');
      if (this._writingFor !== key) {
        this._writingFor = key;
        updateSandWriting(R.sandWriting, words, W.level, seaY);
      }
    }

    // The setting becomes visible only after the lower-hand encounter. Its pointer
    // keeps the chosen disposition readable in the world.
    if (R.dispDial) {
      R.dispDial.visible = W.level >= MAX_DEPTH && !!W.flags.lowerHandRegarded;
      if (R.dispPointer) {
        const di = Math.max(0, DISPOSITION_IDS.indexOf(W.disposition || 'tend'));
        R.dispPointer.parent.rotation.y = di * Math.PI / 2;
      }
    }

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
      // one GROUP holds every silhouette at both LODs, so a new tree shape cannot be
      // forgotten here and left floating over a drowned island
      if (R.canopies) R.canopies.visible = surfaceUp;
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
    // swing FROM the closed angle props.js derived from the doorway chord. Driving
    // rotation.y from 0 ignored that baseline and swung the leaf through the jamb.
    if (R.innerDoor) {
      const ud = R.innerDoor.userData;
      R.innerDoor.rotation.y = (ud.closedY || 0) + an.innerDoor * (ud.swingY ?? 1.5);
    }

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
      if (d) d.rotation.y = (W.dials?.[i] ?? 0) / 10 * TAU;
      const n = R[`dialNumber${i}`];
      if (n && !isModel && n.material?.map) n.material.map.offset.x = (W.dials?.[i] ?? 0) / 10;
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
      if (lg) lg.material.emissiveIntensity = W.flags.refugeLit ? 1.05 : 0;
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
      // A distinct lower hand appears only in the recursively scaled model and only
      // below the surface. It turns under regard but never rises, merges, or gains a
      // companion: the encounter leaves its interpretation with the player.
      fig.visible = !!(W.level >= 2 && isModel);
      if (fig.visible) {
        const look = this._lowerLook;
        fig.getWorldPosition(_kv);
        const wantYaw = Math.atan2(this.player.pos.x - _kv.x, this.player.pos.z - _kv.z);
        fig.rotation.y = lerpAngle(fig.rotation.y, wantYaw, look);
        fig.rotation.x = -0.6 * look;
        fig.position.y = fig.userData.baseY ?? fig.position.y;
        fig.scale.setScalar(1);
        const body = fig.children[0];
        if (body?.material) body.material.emissiveIntensity = 1.8 * (1 + 0.12 * Math.sin(elapsed * 1.5)) + 1.7 * look;
        const head = fig.children[1];
        if (head?.material) head.material.emissiveIntensity = 1.0 + 1.3 * look;
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
