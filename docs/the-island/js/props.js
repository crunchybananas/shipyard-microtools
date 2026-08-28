// props.js — every structure on the island, generated from primitives.
// Static pieces are baked into merged meshes (a few draw calls); anything
// that moves or glows is a named object so world.js state can drive it —
// in BOTH instances of the island (real and chart-table model).

import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { Baker, mergeGeometries, mulberry32, SEED, vary, vnoise, clamp, lerp, smoothstep, TAU } from './util.js';
import { heightAt, SPOTS, DOMAIN, buildTerrain, buildHeightTexture, addCollider } from './terrain.js';
import { makeWaterMaterial, makeBeamMaterial, makeGlowPoints } from './shaders.js';
import { SCALE_MODEL, MAX_DEPTH } from './world.js';
import { buildRegions } from './regions/index.js';
import { applyRelief, getTexture } from './assets.js';
import { LORE, SHELF_TITLES, SHELF_DECOYS } from './content.js';

export const GLYPHS = 8;
export const GLYPH_CODE = [3, 7, 1, 5];
export const STONE_NOTES = [261.63, 293.66, 329.63, 392.0, 440.0, 493.88]; // C4 D4 E4 G4 A4 — and B4, the fallen sixth (#49; never in BOX/BIRD)
export const BOX_MELODY = [2, 3, 4, 1, 0];   // stone indices: E G A D C
export const BIRD_MELODY = [2, 3, 4, 3, 0];  // E G A G C — the bird corrects one note

// ---- shared materials -------------------------------------------------------
// flatShading OFF on the curved-surface materials (owner: "polygons are low"): the Baker
// preserves each primitive's SOURCE normals, so cylinders/spheres/domes shade smooth and
// round while boxes (steps, shelves, books) keep their hard face normals — the tower stops
// banding into vertical facets without costing a single extra triangle.
export const matStone = new THREE.MeshStandardMaterial({
  vertexColors: true, flatShading: false, roughness: 0.92, metalness: 0.0, side: THREE.DoubleSide,
});
applyRelief(matStone, 'stone', { normalScale: 0.85, strength: 2.4 });   // granite over the lighthouse/
                                    // study/stones — multiplies the vertex colours (bone walls → granite,
                                    // the copper band stays coppery) + a derived normal map so the mortar
                                    // lines and block faces catch the raking sun and the keeper's lamp
// MEGALITH — raw quarried granite, for stone nobody coursed. The standing stones
// wore `matStone`, which is the LIGHTHOUSE's masonry: block faces and mortar lines.
// So the five stones you must stare at for the whole music puzzle read as brickwork
// — a tower's wall standing upright in a field. The manifest already carries the
// answer and says so out loud: `rock` is "NATURAL cracked granite (no masonry seams,
// unlike the lighthouse 'stone')".
//
// Relief ONLY (`colorMap: false`) and a big texel (repeat 0.35, larger than the
// boulders' 0.6): the house rule is normal maps yes, tiled colour never — a tiled
// albedo is what pixelates at arm's length, and on a 5 m monolith a small texel would
// tile visibly along the whole face. Vertex colours still carry the hue, so the
// bone-toward-the-crown gradient and the per-stone variation survive untouched.
// The study's JOINERY AND BINDINGS — the wall shelves and every book on them. They
// were baked into `stone` and therefore wore matStone, which is the LIGHTHOUSE's
// coursed masonry: the keeper's library had brick courses and mortar lines running
// across the spines of its books, and the shelf boards were made of wall. It is the
// same bug the rockwork split already fixed for boulders, one room further in — it
// simply hid longer, because every book was the same teal and you cannot see a mortar
// line on a slab of one colour. A cloth weave at low relief reads as binding on a
// spine and as grain on a board, and the batch costs one more draw group.
export const matJoinery = new THREE.MeshStandardMaterial({
  vertexColors: true, flatShading: false, roughness: 0.94, metalness: 0.0,
});
applyRelief(matJoinery, 'cloth', { normalScale: 0.35, strength: 1.2, colorMap: false, repeat: [1.6, 1.6] });


// THE SPINE ATLAS — every piece of lettering in the keeper's library, on one canvas.
//
// It rides on matJoinery as an EMISSIVE map, which solves three problems at once and is
// worth spelling out because none of them is obvious:
//
//   Why emissive and not a colour map. A colour map MULTIPLIES, and gilt has to be
//   brighter than the cloth under it — you cannot multiply a dark blue buckram up to
//   gold. Emissive ADDS, over whatever vertex colour the book already has, so one atlas
//   letters a plum spine and a near-black one identically. It is also how gilt actually
//   behaves: it is the thing in a dark room that catches the lamp.
//   Why channel 1. Baker's uvs are box-projected in WORLD METRES so the cloth relief
//   holds one scale across the whole bake — right for a tiling normal map, useless for
//   an atlas cell. uv1 carries the cells; uv keeps the projection. Nothing moves.
//   Why no new batch. The shelves, the books, the door boards and the jambs all share
//   matJoinery. Everything that asks for no cell lands on cell 0, which is black, which
//   adds nothing — so the whole batch can carry the map for the cost of the map.
//
// 128x256 cells: a spine is ~9cm wide and ~40cm tall, about 80 screen pixels across at
// reading distance, so 128 texels across it is already generous and 256 along it is the
// honest limit of what a title can be. The lettering is CONDENSED to fit, which is what
// a real binder does with a long title on a narrow spine.
const SPINE_COLS = 8, SPINE_ROWS = 8, SPINE_CW = 128, SPINE_CH = 256, SPINE_PAD = 3;
const SPINE_AW = SPINE_COLS * SPINE_CW, SPINE_AH = SPINE_ROWS * SPINE_CH;
// cell 0 is BLANK and is the Baker's default. Its uv is the cell's inset rect and the
// pieces that use it sample its centre — a uv of exactly (0,0) sits on the atlas edge,
// where mipmapping bleeds in from whatever is beside it.
export const spineCell = (i) => {
  const col = i % SPINE_COLS, row = Math.floor(i / SPINE_COLS);
  return [
    (col * SPINE_CW + SPINE_PAD) / SPINE_AW,
    1 - ((row + 1) * SPINE_CH - SPINE_PAD) / SPINE_AH,
    ((col + 1) * SPINE_CW - SPINE_PAD) / SPINE_AW,
    1 - (row * SPINE_CH + SPINE_PAD) / SPINE_AH,
  ];
};
export const SPINE_TITLE0 = 1;                                // cells 1..18: the message
export const SPINE_DECOY0 = 1 + SHELF_TITLES.length;          // cells 19..63: everything else
// 1 blank + 18 + 45 = 64, which is the 8x8 grid exactly

// WHERE EACH LETTERED VOLUME ACTUALLY LANDED. The acrostic is the one thing on this
// shelf that no other check can see: the geometry is fine, the texture is fine, the
// draw call is fine, and the message is scrambled. One line in the placement loop is
// enough to do it — I shipped it bottom-up and mirrored on the first pass. So the
// build records its own reading order and tools/harness/spines.mjs spells it back.
export const SHELF_MARKS = [];
// how many volumes were built and how many got a title. Every standing volume is meant
// to be lettered now — the key is the doubled rule, and a shelf with blank spines on it
// hands the puzzle away by making the lettered ones the answer.
export const SHELF_STATS = { books: 0, lettered: 0, stacks: 0 };
// what the gilt sits at normally, and what hovering the shelf lifts it to. Every gilt
// letter in the study is the only thing on matJoinery reading a non-blank atlas cell,
// so this one number moves the LETTERING and leaves the boards, doors and jambs alone.
export const GILT_REST = 0.45, GILT_HOVER = 0.75;

let _spineTex = null;
export function spineAtlas() {
  if (_spineTex) return _spineTex;
  const cv = document.createElement('canvas');
  cv.width = SPINE_AW; cv.height = SPINE_AH;
  const g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, SPINE_AW, SPINE_AH);   // cell 0, and every unused cell
  const at = (i) => [(i % SPINE_COLS) * SPINE_CW, Math.floor(i / SPINE_COLS) * SPINE_CH];

  // THE TOOLING IS THE PUZZLE. A volume in the message is struck with a DOUBLED rule —
  // two lines above the title and two below — and every other volume on every shelf in
  // the tower carries a single rule above and below. Nothing else distinguishes them:
  // same binder's hand, same boards, same gilt, same kind of title.
  //
  // The inset still varies a little per volume, because a shelf where every rule starts
  // at the same millimetre reads as printed rather than tooled. What must NOT vary is
  // the count, so that is the one thing here that is not jittered.
  const tooling = (x, y, style, keyed) => {
    const inset = Math.round(SPINE_CW * (0.16 + 0.04 * (style % 3)));
    g.fillStyle = '#fff';
    const rule = (f, th) => g.fillRect(x + inset, y + Math.round(SPINE_CH * f), SPINE_CW - inset * 2, th);
    if (keyed) { rule(0.118, 3); rule(0.148, 2); rule(0.840, 2); rule(0.870, 3); }
    else       { rule(0.133, 3); /*             */ rule(0.855, 3); }
  };
  // the label reads BOTTOM TO TOP, which is the British convention and the one a
  // District of Lights binder would have used
  const label = (x, y, title) => {
    g.save();
    g.translate(x + SPINE_CW / 2, y + SPINE_CH / 2);
    g.rotate(-Math.PI / 2);
    const px = Math.round(SPINE_CW * 0.42);
    g.font = `600 ${px}px Georgia, 'Times New Roman', serif`;
    if ('letterSpacing' in g) g.letterSpacing = `${Math.round(px * 0.09)}px`;
    const avail = SPINE_CH * 0.60;
    const w = g.measureText(title).width;
    if (w > avail) g.scale(avail / w, 1);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#fff';
    g.fillText(title, 0, 0);
    g.restore();
  };

  // gilt WEARS. A shelf where all eighteen titles are struck at identical brightness
  // reads as printed, not stamped; a few rubbed-back ones are what makes the rest look
  // like metal. Deterministic per cell so the shelf is the same shelf every session.
  SHELF_TITLES.forEach((t, n) => {
    const [x, y] = at(SPINE_TITLE0 + n);
    g.globalAlpha = 0.68 + 0.32 * (((n * 37) % 11) / 10);
    tooling(x, y, n, true); label(x, y, t);
    g.globalAlpha = 1;
  });
  SHELF_DECOYS.forEach((t, n) => {
    const [x, y] = at(SPINE_DECOY0 + n);
    g.globalAlpha = 0.68 + 0.32 * (((n * 23) % 11) / 10);
    tooling(x, y, n, false); label(x, y, t);
    g.globalAlpha = 1;
  });

  const tex = new THREE.CanvasTexture(cv);
  tex.channel = 1;                       // read uv1, not the world-projected uv
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  _spineTex = tex;
  return tex;
}

export const matMegalith = new THREE.MeshStandardMaterial({
  vertexColors: true, flatShading: false, roughness: 0.96, metalness: 0.0, side: THREE.DoubleSide,
});
// normalScale/strength are deliberately MODEST. At 0.95/2.9 the derived relief was so
// aggressive that it stopped reading as stone: the strata self-shadowed into parallel
// dark streaks (wood grain, not granite), and because a strong normal swings each face
// hard between the warm sun and the cool sky, one stone of five came out sandstone-tan
// while its siblings went charcoal — from the same quarry, in the same light. Relief
// should describe the surface, not repaint it.
applyRelief(matMegalith, 'rock', {
  normalScale: 0.5, strength: 1.8, colorMap: false, repeat: [0.32, 0.32], normalFrom: 'rock_height',
});

// THE BAKED BRASS — the gallery ring and its posts and rails, the finial, the lamp
// pedestal, the valve pedestal, the bell stand, the weather vane. Polished, at 0.38.
//
// I raised this to 0.55 once, to fix #147, and it worked and it was wrong. The glare is
// real (see matBrassRail) but this material is most of the visible metal in the game, and
// dulling all of it to cure one rail flattened the gallery, the rails and the finial into
// painted tan. Owner: "metal is flat, not sure what happened." Measured, isolating the
// two changes in that commit: the bloom clamp does not touch the brass at all, and the
// roughness alone is the whole difference.
export const matBrass = new THREE.MeshStandardMaterial({
  vertexColors: true, flatShading: false, roughness: 0.38, metalness: 0.85, side: THREE.DoubleSide,
});
// ...and the ONE piece that cannot be polished: the chart table's rim.
//
// At 0.38/0.85 it is very nearly a mirror, it is a long flat rail, and what it mirrors is
// a 3.5-intensity sun straight through the study window. That puts a whole STRIP of
// pixels an order of magnitude above anything else in the game, and bloom's five-mip blur
// at radius 0.68 spreads the strip across the near half of the table: vellum, logbook,
// the day's return and the model's sea all go white.
//
// It has to be the material, and it has to be roughness. Measured on the owner's frame,
// hot pixels at 2.86% broken and 0.24% fixed: clamping the bloom high-pass to 2.0 gets
// 2.61% and to 1.6 gets 2.58%, and TIGHTENING the bloom radius makes it worse (3.04% at
// 0.35, 3.09% at 0.22) because it concentrates the same energy. None of them work because
// the problem is not one blinding pixel, it is the AREA of the strip — and roughness is
// the only knob that shrinks it. 0.55 costs one draw call and nothing else.
export const matBrassRail = new THREE.MeshStandardMaterial({
  vertexColors: true, flatShading: false, roughness: 0.55, metalness: 0.85, side: THREE.DoubleSide,
});
const matBrassSolid = new THREE.MeshStandardMaterial({
  color: 0xb08d4f, flatShading: false, roughness: 0.35, metalness: 0.9,
});
const matWood = new THREE.MeshStandardMaterial({
  color: 0x8f7a5c, flatShading: true, roughness: 0.85, metalness: 0.0,  // lightened so the wood grain reads
});
applyRelief(matWood, 'wood', { normalScale: 0.55, strength: 1.8 });   // the interior wood grain — doors,
                                  // the music box, the tables, the plate ring — now with grain-channel relief
const matGlass = new THREE.MeshStandardMaterial({
  color: 0xcfe8ea, transparent: true, opacity: 0.16, roughness: 0.08, metalness: 0.1,
  side: THREE.DoubleSide, depthWrite: false,
});
// #44: fresnel alpha — face-on the lamp-room glass stays near-clear (the beam must read
// through it), but edge-on the pane GLINTS into existence instead of vanishing to a hole.
matGlass.onBeforeCompile = (sh) => {
  sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
    float glFres = pow(1.0 - abs(dot(normalize(vViewPosition), normalize(vNormal))), 3.0);
    gl_FragColor.a = min(0.85, gl_FragColor.a + glFres * 0.5);
  `);
};
// the STUDY WINDOW glaze — distinct from the lamp-room glass (matGlass, which must stay near-clear so
// the beam reads). At 0.16 opacity the window looked like an open HOLE (owner-flagged); this pane has
// real presence: ~0.46 opacity + a cool tint so it's visibly glazed, and roughness 0.05 so the low sun
// throws a specular GLINT across it — the cue that sells "glass". depthWrite off (transparent sort).
const matWinGlass = new THREE.MeshStandardMaterial({
  color: 0xaecdd6, transparent: true, opacity: 0.46, roughness: 0.05, metalness: 0.0,
  side: THREE.DoubleSide, depthWrite: false,
});
const matWinFrame = new THREE.MeshStandardMaterial({ color: 0x2c2824, roughness: 0.7, metalness: 0.05 }); // dark painted glazing bars
const matLamp = new THREE.MeshStandardMaterial({
  color: 0xffb454, emissive: 0xffb454, emissiveIntensity: 1.6, roughness: 0.4,
});
const matLens = new THREE.MeshStandardMaterial({
  color: 0xbfe8e2, emissive: 0x58f2c2, emissiveIntensity: 0.25,
  transparent: true, opacity: 0.85, roughness: 0.05, metalness: 0.2, flatShading: true,
});

// colors
const C = {
  bone: new THREE.Color(0xcfc8b8), boneDark: new THREE.Color(0xa9a08c),
  copper: new THREE.Color(0x4e9e88), copperDark: new THREE.Color(0x3e7a6a),
  brass: new THREE.Color(0xb08d4f), brassDark: new THREE.Color(0x8a6c3a),
  wood: new THREE.Color(0x6b4a2f), woodDark: new THREE.Color(0x4a3018),
  stoneOld: new THREE.Color(0x9b9484), ink: new THREE.Color(0x20242c),
  cloth: new THREE.Color(0x355560),
};

// ---- glyph atlas (canvas → texture) ----------------------------------------
export function makeGlyphAtlas() {
  const cell = 128;
  const cv = document.createElement('canvas');
  cv.width = cell * GLYPHS; cv.height = cell;
  const g = cv.getContext('2d');
  g.clearRect(0, 0, cv.width, cv.height);
  g.strokeStyle = '#fff'; g.fillStyle = '#fff';
  g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round';

  const draw = [
    (x, y, s) => { g.beginPath(); g.arc(x, y, s * 0.32, 0, TAU); g.stroke(); g.beginPath(); g.arc(x, y, s * 0.07, 0, TAU); g.fill(); },                                  // 0 sun-eye
    (x, y, s) => { g.beginPath(); g.moveTo(x, y - s * 0.36); g.lineTo(x + s * 0.34, y + s * 0.3); g.lineTo(x - s * 0.34, y + s * 0.3); g.closePath(); g.stroke(); },      // 1 mountain
    (x, y, s) => { g.beginPath(); for (let i = 0; i <= 24; i++) { const t = i / 24; const px = x - s * 0.38 + t * s * 0.76; const py = y + Math.sin(t * TAU) * s * 0.18; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); }, // 2 wave
    (x, y, s) => { g.beginPath(); for (let i = 0; i <= 40; i++) { const t = i / 40 * 2.4 * TAU; const r = s * 0.05 + t * s * 0.022; i ? g.lineTo(x + Math.cos(t) * r, y + Math.sin(t) * r) : g.moveTo(x + r, y); } g.stroke(); }, // 3 spiral
    (x, y, s) => { g.beginPath(); g.moveTo(x, y - s * 0.38); g.lineTo(x, y + s * 0.38); g.moveTo(x - s * 0.3, y - s * 0.1); g.lineTo(x, y - s * 0.38); g.lineTo(x + s * 0.3, y - s * 0.1); g.stroke(); },                       // 4 trident-up
    (x, y, s) => { g.beginPath(); g.arc(x + s * 0.1, y, s * 0.32, Math.PI * 0.5, Math.PI * 1.5); g.arc(x - s * 0.08, y, s * 0.24, Math.PI * 1.5, Math.PI * 0.5, true); g.stroke(); },                                          // 5 crescent
    (x, y, s) => { g.beginPath(); g.rect(x - s * 0.26, y - s * 0.26, s * 0.52, s * 0.52); g.moveTo(x - s * 0.26, y); g.lineTo(x + s * 0.26, y); g.stroke(); },             // 6 split square
    (x, y, s) => { g.beginPath(); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; g.moveTo(x, y); g.lineTo(x + Math.cos(a) * s * 0.36, y + Math.sin(a) * s * 0.36); } g.stroke(); g.beginPath(); g.arc(x, y, s * 0.14, 0, TAU); g.stroke(); }, // 7 star-cross
  ];
  for (let i = 0; i < GLYPHS; i++) draw[i](cell * i + cell / 2, cell / 2, cell);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function glyphSprite(atlas, index, color, size = 1) {
  const tex = atlas.clone();
  tex.needsUpdate = true;
  tex.repeat.set(1 / GLYPHS, 1);
  tex.offset.set(index / GLYPHS, 0);
  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, color, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  return m;
}

// a soft round glow, code-generated once and shared — for billboarded halos
// (additive). A Sprite, never a Points: instantiateModel strips Points from core.
let _glowTex = null;
function radialGlowTex() {
  if (_glowTex) return _glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.5)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  _glowTex = new THREE.CanvasTexture(c);
  return _glowTex;
}

// the keeper's stoppered phial (#49 tide-pool round trip) — a corked glass tube with a
// rolled note inside, built twice: floating in the flooded high pool at L4 (poolPhial)
// and lying dried-out on the chart table after the return (phialDesk). Lies on its side.
function phialProp(name) {
  const p = new THREE.Group();
  p.name = name;
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 0.17, 8),
    new THREE.MeshStandardMaterial({ color: 0xbfd8d4, transparent: true, opacity: 0.42, roughness: 0.1, metalness: 0 }));
  p.add(body);
  const note = new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.026, 0.13, 6),
    new THREE.MeshStandardMaterial({ color: 0xd8cbb0, roughness: 0.95 }));
  p.add(note);
  const cork = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.034, 0.045, 6),
    new THREE.MeshStandardMaterial({ color: 0x8a6b4a, roughness: 0.9 }));
  cork.position.y = 0.1;
  p.add(cork);
  p.rotation.z = Math.PI / 2 - 0.06;   // afloat / at rest on its side
  return p;
}

// =============================================================================
// build the whole world. Returns { core, refs, modelRefs, hotspots, ... }
// =============================================================================
export function buildWorld() {
  const r = mulberry32(SEED ^ 0xbeef);
  const core = new THREE.Group();
  core.name = 'islandCore';

  const atlas = makeGlyphAtlas();

  // ---------- terrain + water ----------
  const terrain = buildTerrain();
  const heightTex = buildHeightTexture();
  core.add(terrain);

  // SEA-STRATA regions (loop #117, Phase 0): one content shell per drowned level, built
  // once and shown one-at-a-time by W.level in puzzles _apply (region<N>.visible). Empty
  // until each level is authored. Pruned from the 1:240 clone (the model is the surface
  // island only). Named so collectRefs() finds them on the island instance.
  const region2 = new THREE.Group(); region2.name = 'region2'; region2.visible = false; core.add(region2);
  const region3 = new THREE.Group(); region3.name = 'region3'; region3.visible = false; core.add(region3);
  const region4 = new THREE.Group(); region4.name = 'region4'; region4.visible = false; core.add(region4);
  // SEA-STRATA region content lives in js/regions/ (#71): one build(ctx) module per
  // drowned level-area, each on its own SEED^salt rng stream so no region can shift
  // the world scatter (or another region). The seam new level-area content lands in.
  buildRegions({ region2, region3, region4 });

  const waterMat = makeWaterMaterial(heightTex, DOMAIN);
  // 96 segments (was 120): the longest wave in the vertex shader is ~63m, so a 6.5m grid
  // still oversamples it 10x — indistinguishable, and ~20k fewer tris with the model clone
  const water = new THREE.Mesh(new THREE.PlaneGeometry(DOMAIN, DOMAIN, 96, 96), waterMat);
  water.geometry.rotateX(-Math.PI / 2);
  water.name = 'water';
  water.renderOrder = 2;
  water.frustumCulled = false;
  core.add(water);

  // ---------- bakers for merged statics ----------
  const stone = new Baker();
  // NATURAL rock, batched apart from the masonry. The vault outcrop and the pool's
  // rim rocks were baked into `stone`, which is built with matStone — the LIGHTHOUSE's
  // coursed-block relief — so a boulder beside the standing stones wore mortar lines.
  // Its own batch costs one draw group and lets it be granite.
  const rockwork = new Baker();
  // shelves + books: wood and cloth, not masonry (see matJoinery). uv1 carries the
  // spine atlas; everything that asks for no cell lands on cell 0, which is black.
  const joinery = new Baker({ uv1: true, blank: spineCell(0) });
  const brass = new Baker();
  const rail = new Baker();          // the chart table's rim alone: see matBrassRail
  const M = new THREE.Matrix4();
  const Q = new THREE.Quaternion();
  const V = new THREE.Vector3();
  const S = new THREE.Vector3();
  const place = (px, py, pz, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) => {
    Q.setFromEuler(new THREE.Euler(rx, ry, rz));
    return M.compose(V.set(px, py, pz), Q, S.set(sx, sy, sz));
  };
  const grad = (a, b) => (t) => a.clone().lerp(b, t);

  // MOTTLE — granite is not one colour, and ours was.
  //
  // The relief map gives these stones their grain, but their ALBEDO was a single smooth
  // top-to-bottom gradient, so a 3.4 m monolith read as a shape with a texture on it
  // rather than as a rock. Owner: "Rocks are non-textured." They were, in the way that
  // matters: nothing in the colour ever varied across a face.
  //
  // This is NOT a tiled albedo, and it must not become one — the house rule here is
  // normal maps yes, tiled colour never, because a repeating albedo is exactly what
  // pixelates into a visible grid at arm's length (it is why the rock relief is
  // colorMap: false in the first place). Value noise on the WORLD position has no tile
  // to find: two scales, broad patches at ~5 m so neighbouring stones differ from each
  // other, and a finer grain at ~60 cm across a single face. y is folded into both, or a
  // vertical face — which is most of a standing stone — would come out uniform.
  //
  // Baked into the vertex colours, so it costs one multiply at build time and nothing at
  // all per frame: no texture, no draw call, no shader change.
  const speck = (x, y, z) => {
    const n = vnoise(x * 0.22 + y * 0.31, z * 0.22 - y * 0.27) - 0.5;        // broad, ~5 m
    const f = vnoise(x * 1.6 + y * 0.9 + 13.7, z * 1.6 - y * 1.1 - 5.3) - 0.5;  // grain, ~60 cm
    return 1 + n * 0.26 + f * 0.15;
  };
  const mottle = (a, b) => (t, p) => a.clone().lerp(b, t).multiplyScalar(speck(p.x, p.y, p.z));

  // hangDoor — hang a leaf in a doorway cut through a CURVED wall.
  //
  // A door group's origin is its hinge and the leaf extends along local +x, so the
  // closed leaf must lie along the doorway's CHORD. Deriving that angle from the
  // RADIUS instead is the bug the owner hit ("the door goes through the wall"): a
  // leaf hinged at az 170.5° and rotated `az - 90°` points straight out of the
  // tower, and swinging it 52° put its far edge at r 5.81 — half a metre beyond the
  // wall's outer face (5.35) and buried in the stone cheek beside the opening.
  //
  // The derivation, once, here: the chord from jamb `ah` to jamb `af` (same radius)
  // runs along ±(cos m, -sin m) where m is the doorway's mid-azimuth, and three.js
  // Ry(t) maps local +x to (cos t, -sin t). So the closed angle is m when the leaf
  // reaches anticlockwise and m + PI when it reaches clockwise — and `ajar` then
  // swings toward the wall's own axis (inward) for either hand.
  //
  // Returns LH-LOCAL x/z: lhGroup is translated to LH, and the callers that build in
  // world space add LH themselves.
  const hangDoor = (ah, af, r, ajar = 0) => {
    const m = (ah + af) / 2;
    return {
      x: Math.sin(ah) * r,
      z: Math.cos(ah) * r,
      closed: af > ah ? m : m + Math.PI,
      rotY: (af > ah ? m : m + Math.PI) + Math.sign(af - ah) * ajar,
      swing: Math.sign(af - ah),
    };
  };

  // =================== THE LIGHTHOUSE =======================================
  const LH = new THREE.Vector3(SPOTS.lighthouse.x, 13.5, SPOTS.lighthouse.y);
  const lhGroup = new THREE.Group();
  lhGroup.position.copy(LH);
  lhGroup.name = 'lighthouse';
  core.add(lhGroup);

  const deg = (d) => d * Math.PI / 180;
  // wall arcs: full circle minus the beach door (az 165±14), the window (az 110±15,
  // overlooks the cove and causeway), and the ANNEX DOORWAY (az 15±12 — Phase A: a real
  // walkable opening through to the keeper's quarters, where before the wall was solid).
  const gaps = [[deg(151), deg(179)], [deg(95), deg(125)], [deg(3), deg(27)]];
  const arcs = [[deg(179), deg(3) + TAU], [deg(27), deg(95)], [deg(125), deg(151)]]; // complementary
  const baseR = 5.2, baseH = 4.6, wallT = 0.5;
  for (const [a0, a1] of arcs) {
    const len = a1 - a0;
    const geo = new THREE.CylinderGeometry(baseR, baseR + 0.15, baseH, Math.max(10, Math.round(len * 16)), 1, true, a0, len);
    stone.add(geo, place(0, baseH / 2, 0).clone().premultiply(new THREE.Matrix4().makeTranslation(LH.x, LH.y, LH.z)), grad(C.boneDark, C.bone));
    geo.dispose();
  }
  // partial wall pieces must sit ON the wall's own taper (radius at height y), or their
  // open arc ends step off the neighbouring full-height arcs as visible seam slits
  const wallRAt = (y) => baseR + 0.15 * (1 - y / baseH);
  // lintels over the gaps.
  //
  // THESE WERE STRAIGHT CYLINDERS IN A BATTERED WALL — the one thing the comment
  // directly above says not to do. The drum tapers 5.35 at the foot to 5.20 at the
  // head; a lintel built at a constant baseR therefore sits up to 4.2 cm INSIDE the
  // wall face at the bottom of its band, and since these are open-ended shells the
  // 4.2 cm between the two surfaces is nothing at all. At the seam where the lintel
  // meets the neighbouring full-height arc that nothing becomes a vertical slit you
  // can see daylight through, standing in the study looking up past the annex door.
  // Owner, by F8: "There is a small tear in the all."
  //
  // Every other partial piece here already rides wallRAt — the infills, the window
  // sill and header. The lintels were simply missed. Segment count matched to the
  // wall's own formula too, so the facets line up either side of the seam.
  for (const [a0, a1] of gaps) {
    const len = a1 - a0;
    const y0 = baseH - 1.3, y1 = baseH;
    const geo = new THREE.CylinderGeometry(wallRAt(y1), wallRAt(y0), 1.3, Math.max(8, Math.round(len * 16)), 1, true, a0, len);
    stone.add(geo, new THREE.Matrix4().makeTranslation(LH.x, LH.y + baseH - 0.65, LH.z), grad(C.bone, C.bone));
    geo.dispose();
  }
  // the window gets a sill and a header — it is a window, not a breach
  {
    const [w0, w1] = gaps[1];
    const len = w1 - w0;
    const sill = new THREE.CylinderGeometry(wallRAt(1.15), wallRAt(0), 1.15, 8, 1, true, w0, len);
    stone.add(sill, new THREE.Matrix4().makeTranslation(LH.x, LH.y + 0.575, LH.z), grad(C.boneDark, C.bone));
    sill.dispose();
    const header = new THREE.CylinderGeometry(wallRAt(3.375), wallRAt(2.825), 0.55, 8, 1, true, w0, len);
    stone.add(header, new THREE.Matrix4().makeTranslation(LH.x, LH.y + 3.1, LH.z), grad(C.bone, C.bone));
    header.dispose();
  }
  // OPENINGS RIGHT-SIZED (owner: "the door and glass look awkward"): the door and window
  // wall gaps are ~2.3-2.7m breaches — storefront-scale on a small keeper's drum. Curved
  // stone INFILL segments (the wall's own recipe, taper-matched) narrow each to a human
  // opening; the door also gets a transom band so the doorway is ~1.1 x 2.55m.
  {
    const infill = (a0deg, a1deg, y0, y1) => {
      const a0 = deg(a0deg), len = deg(a1deg - a0deg);
      const geo = new THREE.CylinderGeometry(wallRAt(y1), wallRAt(y0), y1 - y0, Math.max(6, Math.round(len * 16)), 1, true, a0, len);
      stone.add(geo, place(0, (y0 + y1) / 2, 0).clone().premultiply(new THREE.Matrix4().makeTranslation(LH.x, LH.y, LH.z)), grad(C.boneDark, C.bone));
      geo.dispose();
    };
    infill(151, 159.5, 0, baseH - 1.3);            // beach door: side cheeks…
    infill(170.5, 179, 0, baseH - 1.3);
    infill(159.5, 170.5, 2.62, baseH - 1.3);       // …and the transom over the leaf
    infill(95, 103.5, 1.15, 2.825);                // window: side cheeks between sill and header
    infill(116.5, 125, 1.15, 2.825);
    // ANNEX DOORWAY: the wall gap is az 3-27, but the throat's jambs only stand at
    // 6.5 and 23.5 — so 3.5° of wall was simply missing either side of them, and from
    // the study you saw daylight and sand through two slots beside the keeper's door.
    // Cheek them in to the jambs, same recipe, so the throat is the only way through.
    infill(3, 6.5, 0, baseH - 1.3);
    infill(23.5, 27, 0, baseH - 1.3);
  }
  // floor + ceiling ring (oculus for the light shaft)
  {
    const floor = new THREE.CylinderGeometry(baseR + 0.2, baseR + 0.2, 0.3, 28);
    stone.add(floor, new THREE.Matrix4().makeTranslation(LH.x, LH.y - 0.07, LH.z), grad(C.stoneOld, C.boneDark));
    floor.dispose();
    // CONTACT AO (#43): the room players study longest had a gradient floor under
    // shadowless point lights — table legs and shelves visibly floated. The cylinder cap
    // is a vertex FAN (centre + rim only), so pools can't bake into it; lay a finely
    // tessellated ring 5mm proud as the walk surface and darken it by proximity to the
    // known furniture footprints. CPU-only, +0 draws (same stone bake), clone inherits.
    {
      const FEET = [
        [0, 0, 1.9, 0.14],                                              // chart table's soft under-shadow
        [-1.0, -1.0, 0.4, 0.42], [1.0, -1.0, 0.4, 0.42],                // its four legs
        [-1.0, 1.0, 0.4, 0.42], [1.0, 1.0, 0.4, 0.42],                  // (these two were left at 1.25)
        [2.3, 1.1, 0.36, 0.4],                                          // valve pedestal
        [2.2, -1.4, 0.78, 0.2],                                         // brass plate, seated
        [Math.sin(deg(285)) * 4.4, Math.cos(deg(285)) * 4.4, 1.2, 0.26],  // bookshelf bays
        [Math.sin(deg(323)) * 4.4, Math.cos(deg(323)) * 4.4, 1.2, 0.26],
        [-3.6, -2.6, 0.8, 0.2],                                         // music-box shelf
      ];
      const floorTop = new THREE.RingGeometry(0.02, baseR + 0.2, 56, 24);
      floorTop.rotateX(-Math.PI / 2);
      stone.add(floorTop, new THREE.Matrix4().makeTranslation(LH.x, LH.y + 0.085, LH.z), (t, wv) => {
        let ao = 0;
        for (const [fx, fz, fr, fs] of FEET) {
          const d = Math.hypot(wv.x - (LH.x + fx), wv.z - (LH.z + fz));
          ao += fs * (1 - smoothstep(fr * 0.4, fr, d));
        }
        return C.boneDark.clone().multiplyScalar(1 - Math.min(0.52, ao));
      });
      floorTop.dispose();
    }
    const ceil = new THREE.RingGeometry(1.25, baseR + 0.1, 28);
    ceil.rotateX(Math.PI / 2);
    stone.add(ceil, new THREE.Matrix4().makeTranslation(LH.x, LH.y + baseH, LH.z), grad(C.boneDark, C.boneDark));
    ceil.dispose();
  }
  // tower (tapered) + gallery + lamp room + dome
  {
    // A DAYMARK. A lighthouse is painted so it can be IDENTIFIED by day — that is half
    // its job, and this tower was one uniform tan cone from footing to gallery with a
    // single dark band buried at 55-72% that nothing read at any distance. It is a
    // District of Lights granite tower now: bare stone up to the string course, limewashed
    // white above it, and a dark collar under the gallery. From the far meadow it finally
    // reads as a lighthouse rather than as a chimney.
    //
    // 32 height segments, not 4. With five vertex rings there is nowhere to PUT a paint
    // line — the band the old code asked for could only ever be a quarter of the tower
    // smeared into its neighbours. +1,120 triangles on the one baked drum.
    // OVER 1.0 ON PURPOSE. matStone carries a tan granite ALBEDO, and vertex colour
    // multiplies it — so a white vertex colour gives tan stone, which is why the first
    // pass painted the tower and nothing changed. Pushing the colour past 1 washes the
    // map toward white while KEEPING its grain, which is exactly what limewash on
    // masonry looks like: you can still see the stone through it.
    const cPaint = new THREE.Color(0xe7e1d2).multiplyScalar(1.62);   // limewash, warm and chalky
    const cCollar = new THREE.Color(0x39423e);         // the dark collar under the gallery
    const tower = new THREE.CylinderGeometry(2.45, 4.05, 15.9, 28, 32, true);
    stone.add(tower, new THREE.Matrix4().makeTranslation(LH.x, LH.y + baseH + 7.95, LH.z), (t, wp) => {
      const ang = Math.atan2(wp.z - LH.z, wp.x - LH.x);
      const granite = C.bone.clone().lerp(C.boneDark, 1 - t);
      // the paint line WANDERS and is worn thin — a ruler-straight edge at one height is
      // the thing that would make this read as a decal rather than as paint on stone
      const wob = (vnoise(ang * 2.3, 11.4) - 0.5) * 0.055;
      const c = granite.lerp(cPaint, smoothstep(0.40 + wob, 0.46 + wob, t));
      // salt and rainwater streak DOWN from the gallery. Vertical, per-azimuth, strongest
      // just under the deck and fading out before the string course — the single thing
      // that stops a painted tower reading as a plastic tube.
      const streak = (vnoise(ang * 6.1, 3.3) - 0.42) * 1.5;
      c.multiplyScalar(1 - Math.max(0, streak) * 0.16 * smoothstep(0.46, 0.95, t));
      // and the collar
      return c.lerp(cCollar, smoothstep(0.878, 0.898, t) * (1 - smoothstep(0.966, 0.982, t)));
    });
    tower.dispose();
    // STRING COURSE + PLINTH. A masonry tower is not a smooth taper: it has projecting
    // courses, and they are what give a silhouette its joints. One at the paint line, one
    // where the shaft meets the drum. Cheap rings, and they catch a hard shadow.
    for (const [ty, over, hh, cc] of [[0.43, 0.16, 0.34, C.bone], [0.0, 0.26, 0.5, C.boneDark]]) {
      const yy = baseH + ty * 15.9;
      const r = 4.05 + (2.45 - 4.05) * ty;
      const band = new THREE.CylinderGeometry(r + over * 0.8, r + over, hh, 28, 1, true);
      stone.add(band, new THREE.Matrix4().makeTranslation(LH.x, LH.y + yy + hh / 2, LH.z), grad(cc.clone().multiplyScalar(0.82), cc));
      band.dispose();
    }
    // THE STAIR LIGHTS. A lighthouse shaft is not blind — a spiral stair climbs it and
    // every turn or so there is a small window to see the steps by. Six of them, winding
    // round as the stair does, and they do two jobs at once: they say a person walks up
    // there, and they give the tower a SCALE. A featureless taper could be six metres or
    // sixty; put a human-sized opening on it and the eye knows instantly.
    for (let i = 0; i < 6; i++) {
      const ty = 0.085 + i * 0.148;
      const yy = baseH + ty * 15.9;
      const rr = 4.05 + (2.45 - 4.05) * ty;
      const aa = deg(34) + i * 1.24;                    // each light is one turn of the stair on
      const painted = ty > 0.44;
      const dressing = painted ? cPaint.clone() : C.bone.clone();
      // the opening, recessed into the shell so it reads as a hole and not a sticker
      const op = new THREE.BoxGeometry(0.46, 0.80, 0.16);
      stone.add(op, place(LH.x + Math.sin(aa) * (rr - 0.10), LH.y + yy, LH.z + Math.cos(aa) * (rr - 0.10), aa),
        () => new THREE.Color(0x15171b));
      op.dispose();
      // sill and head, proud of the wall — dressed stone around a rubble shaft
      for (const [dy, hh, ww, dd] of [[-0.47, 0.15, 0.74, 0.26], [0.46, 0.12, 0.64, 0.22]]) {
        const b = new THREE.BoxGeometry(ww, hh, dd);
        stone.add(b, place(LH.x + Math.sin(aa) * (rr + 0.02), LH.y + yy + dy, LH.z + Math.cos(aa) * (rr + 0.02), aa),
          grad(dressing.clone().multiplyScalar(0.60), dressing.clone().multiplyScalar(0.88)));
        b.dispose();
      }
    }
    // CORBELS. The gallery deck was a brass disc floating off the stone with nothing
    // holding it up. Every real one is carried on a ring of stone brackets, and their
    // shadow is most of what reads as "lighthouse" in a silhouette.
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU;
      // TAPERED, or they read as battlements. A corbel is a bracket: it carries the deck
      // above and dies back into the wall below, so it is wider at the top than the
      // bottom. A four-sided cylinder is a square frustum; turn it 45 degrees so a flat
      // face points out at the viewer rather than an edge.
      const cb = new THREE.CylinderGeometry(0.26, 0.14, 0.58, 4);
      cb.rotateY(Math.PI / 4);
      const rr = 2.60;
      // under the limewash, so they carry it too — at bare-stone tone they read as a
      // checkerboard collar rather than as brackets
      stone.add(cb, place(LH.x + Math.sin(a) * rr, LH.y + 20.18, LH.z + Math.cos(a) * rr, a),
        grad(cPaint.clone().multiplyScalar(0.72), cPaint.clone().multiplyScalar(0.92)));
      cb.dispose();
    }
    const gallery = new THREE.CylinderGeometry(3.3, 3.3, 0.35, 24);
    brass.add(gallery, new THREE.Matrix4().makeTranslation(LH.x, LH.y + 20.6, LH.z), grad(C.brassDark, C.brass));
    gallery.dispose();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      const post = new THREE.CylinderGeometry(0.05, 0.05, 1.0, 5);
      brass.add(post, new THREE.Matrix4().makeTranslation(LH.x + Math.sin(a) * 3.1, LH.y + 21.3, LH.z + Math.cos(a) * 3.1), grad(C.brassDark, C.brass));
      post.dispose();
    }
    const rail = new THREE.TorusGeometry(3.1, 0.05, 8, 48);
    rail.rotateX(Math.PI / 2);
    brass.add(rail, new THREE.Matrix4().makeTranslation(LH.x, LH.y + 21.8, LH.z), grad(C.brass, C.brass));
    rail.dispose();
    // THE LANTERN ROOM. Six posts around a glass tube is a gazebo. A real lantern is a
    // CAGE — a dense ring of astragals with horizontal glazing bars crossing them, sat on
    // a solid parapet, and it is the most recognisable thing on the whole building.
    //
    // the murette: the low solid band the glazing stands on. Without it the glass runs
    // straight into the deck and the room has no foot.
    {
      const mur = new THREE.CylinderGeometry(2.12, 2.16, 0.46, 24, 1, true);
      stone.add(mur, new THREE.Matrix4().makeTranslation(LH.x, LH.y + 21.05, LH.z),
        grad(cPaint.clone().multiplyScalar(0.55), cPaint.clone().multiplyScalar(0.78)));
      mur.dispose();
    }
    // astragals: 12, not 6 — at six you count them and it reads as scaffolding
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      const post = new THREE.BoxGeometry(0.085, 1.95, 0.11);
      brass.add(post, place(LH.x + Math.sin(a) * 2.06, LH.y + 22.26, LH.z + Math.cos(a) * 2.06, a), grad(C.brassDark, C.brass));
      post.dispose();
    }
    // and the horizontal bars that make it a cage rather than a comb
    for (const gy of [21.55, 22.30, 23.02]) {
      const ring = new THREE.TorusGeometry(2.06, 0.045, 6, 36);
      ring.rotateX(Math.PI / 2);
      brass.add(ring, new THREE.Matrix4().makeTranslation(LH.x, LH.y + gy, LH.z), grad(C.brassDark, C.brass));
      ring.dispose();
    }
    // a true curved cupola (was a 12-gon cone that read as a paper hat): hemisphere squashed
    // to the cone's exact height/footprint, base at 23.3 → apex 25.6, eaves overhang kept
    // STANDING SEAMS. A copper dome is sheet metal folded into panels, and the raised
    // seams between them run apex to eaves — it is the reason a real cupola reads as
    // METAL rather than as a painted shell. Baked into the vertex colours off the world
    // azimuth: no ribs to model, no draw calls, and the seams sit exactly where the
    // panels would. 48 segments so a seam is a line and not a facet.
    const dome = new THREE.SphereGeometry(2.55, 48, 14, 0, TAU, 0, Math.PI / 2);
    stone.add(dome, place(LH.x, LH.y + 23.3, LH.z, 0, 1, 2.3 / 2.55, 1), (t, wp) => {
      const ang = Math.atan2(wp.z - LH.z, wp.x - LH.x);
      const u = ((ang / TAU) * 12 % 1 + 1) % 1;           // 12 panels
      const seam = Math.abs(u - 0.5) * 2;                 // 1 mid-panel → 0 on the seam
      const c = C.copperDark.clone().lerp(C.copper, t);
      // verdigris does not weather evenly: it streaks down from the apex where the rain
      // runs, and it sits heaviest in the folds
      c.lerp(C.copper, (vnoise(ang * 3.1, t * 4.2) - 0.5) * 0.5 + 0.5 * (1 - t) * 0.25);
      return c.multiplyScalar(1 - (1 - smoothstep(0, 0.16, seam)) * 0.34);
    });
    dome.dispose();
    // THE VENTILATOR, not a doorknob. A lantern burns and has to breathe: every real one
    // is capped by a cowl over a vent stack, with the lightning conductor above it. A
    // plain sphere on the apex was the one part of the silhouette that said "toy".
    {
      const neck = new THREE.CylinderGeometry(0.17, 0.21, 0.55, 10);
      brass.add(neck, new THREE.Matrix4().makeTranslation(LH.x, LH.y + 25.72, LH.z), grad(C.brassDark, C.brass));
      neck.dispose();
      const cowl = new THREE.CylinderGeometry(0.40, 0.13, 0.34, 12);
      brass.add(cowl, new THREE.Matrix4().makeTranslation(LH.x, LH.y + 26.14, LH.z), grad(C.brass, C.brassDark));
      cowl.dispose();
      const ball = new THREE.SphereGeometry(0.13, 10, 7);
      brass.add(ball, new THREE.Matrix4().makeTranslation(LH.x, LH.y + 26.42, LH.z), grad(C.brass, C.brass));
      ball.dispose();
      const rod = new THREE.CylinderGeometry(0.025, 0.025, 0.7, 5);
      brass.add(rod, new THREE.Matrix4().makeTranslation(LH.x, LH.y + 26.85, LH.z), grad(C.brass, C.brass));
      rod.dispose();
    }
  }
  // glass for lamp room + window
  {
    const lampGlass = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.05, 2.4, 24, 1, true), matGlass);
    lampGlass.position.set(0, 22.05, 0);
    lhGroup.add(lampGlass);
    // the study window, right-sized (owner fix): the old 2.6m flat sheet chorded the whole
    // curved 30° breach — its edges sank into the wall and it read as a shopfront. The
    // infills narrow the opening to ~13°; this is now a keeper's window: a wooden frame
    // box, a centred four-pane glazing cross, and a pane whose 13° chord deviates from
    // the wall by under 4cm — no more seams cutting the stone.
    const winGroup = new THREE.Group();
    const wa = deg(110);
    winGroup.position.set(Math.sin(wa) * (baseR - 0.02), 1.99, Math.cos(wa) * (baseR - 0.02));
    winGroup.rotation.y = wa;
    winGroup.name = 'studyWindow';
    const winGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.16, 1.58), matWinGlass);
    winGroup.add(winGlass);
    // frame box: jambs, head and stool in weathered wood, proud of the glass
    const frame = (w, h, x, y) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.14), matWood);
      b.position.set(x, y, 0.03); winGroup.add(b);
    };
    frame(0.09, 1.74, -0.62, 0); frame(0.09, 1.74, 0.62, 0);   // jambs
    frame(1.33, 0.09, 0, 0.83); frame(1.33, 0.11, 0, -0.84);   // head + stool
    const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.055, 1.6, 0.08), matWinFrame); vBar.position.z = 0.045; winGroup.add(vBar);
    const hBar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.055, 0.08), matWinFrame); hBar.position.z = 0.045; winGroup.add(hBar);
    lhGroup.add(winGroup);
  }
  // the study door, forever ajar — right-sized (owner fix): the old leaf was a 1.9x3.4m
  // unframed slab filling a floor-to-lintel breach. The infills narrow the doorway to
  // ~1.1 x 2.55m; this is a battened keeper's door in a wooden frame, hinged at the
  // north jamb, standing open into the study.
  {
    const da0 = deg(159.5), da1 = deg(170.5);      // the narrowed doorway's edges
    // frame: jambs against the stone cheeks + a lintel board under the transom
    // THE JAMBS MUST STRADDLE THE WALL, not float inside it. These were 12 cm deep at
    // r 5.18, so they spanned r 5.12-5.24 — while the wall shell over their height runs
    // r 5.267 (at the head) to 5.350 (at the foot). The frame therefore stopped 3-11 cm
    // short of the masonry and you could see daylight PAST it, between post and stone,
    // at eye height beside the door. Owner, by F8: "I can see behind the frame."
    //
    // The drum is a single zero-thickness shell, so there is no reveal for a slim frame
    // to sit in: the jamb IS the reveal, and it has to cross the shell at every height
    // it spans. 0.37 deep centred at r 5.235 does that with margin at both ends (5.05
    // to 5.42), and reads correctly — a deep stone-wall reveal is what this doorway is.
    const jamb = (az) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.37, 2.55, 0.18), matWood);
      b.position.set(Math.sin(az) * 5.235, 1.275, Math.cos(az) * 5.235);
      b.rotation.y = az + Math.PI / 2;   // local x is RADIAL under this rotation, local z tangential
      lhGroup.add(b);
    };
    jamb(da0); jamb(da1);
    // same reasoning as the jambs: at y 2.58 the shell is at r 5.266 and a 0.2-deep board
    // at r 5.18 reached only 5.28 — sealing by 14 mm, which is not sealing, it is luck.
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.12, 0.37), matWood);
    const mid = (da0 + da1) / 2;
    lintel.position.set(Math.sin(mid) * 5.235, 2.58, Math.cos(mid) * 5.235);
    lintel.rotation.y = mid;
    lhGroup.add(lintel);
    // the leaf: planked door + three battens + a brass pull, hinged at the north jamb
    const hingeOff = new THREE.Group();
    const hung = hangDoor(da1, da0, baseR - 0.05, deg(52));   // hinged at the da1 jamb, ajar into the study
    hingeOff.position.set(hung.x, 1.26, hung.z);
    hingeOff.rotation.y = hung.rotY;
    // Declared so the gate can sweep the whole arc this leaf occupies. This one never
    // moves in play — it stands forever ajar — but the bug WAS an orientation error,
    // and an orientation error hides at whatever single pose you happen to check.
    hingeOff.userData.closedY = hung.closed;
    hingeOff.userData.swingY = hung.swing * deg(52);
    hingeOff.name = 'studyDoor';
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.98, 2.44, 0.085), matWood);
    door.position.x = 0.49;
    hingeOff.add(door);
    for (const by of [-0.82, 0, 0.82]) {           // battens
      const bat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.11, 0.03), matWood);
      bat.position.set(0.49, by, 0.06);
      hingeOff.add(bat);
    }
    const pull = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.016, 6, 12), matBrassSolid);
    pull.position.set(0.88, -0.06, 0.07);
    hingeOff.add(pull);
    lhGroup.add(hingeOff);
  }

  // ---- lamp assembly: pedestal, lens, beam ----
  {
    const ped = new THREE.CylinderGeometry(0.5, 0.7, 1.1, 8);
    brass.add(ped, new THREE.Matrix4().makeTranslation(LH.x, LH.y + 21.4, LH.z), grad(C.brassDark, C.brass));
    ped.dispose();
    // THE CARRIAGE. The lantern held a pedestal and, once the player has found and fitted
    // the lens, a floating gem — and between them, nothing. A lighthouse lamp is a piece
    // of ENGINEERING: a brass carriage of rings and ribs that the optic is bolted into and
    // that turns it. Building it (and only it — the optic itself stays exactly as it was,
    // gated on W.lensPlaced) means the lantern reads as an apparatus with its heart
    // missing, which is a better statement of the puzzle than an empty room was.
    {
      for (const [ry, rr, rt] of [[21.98, 0.86, 0.05], [22.52, 0.92, 0.045], [23.06, 0.74, 0.05]]) {
        const ring = new THREE.TorusGeometry(rr, rt, 6, 24);
        ring.rotateX(Math.PI / 2);
        brass.add(ring, new THREE.Matrix4().makeTranslation(LH.x, LH.y + ry, LH.z), grad(C.brassDark, C.brass));
        ring.dispose();
      }
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        const rib = new THREE.BoxGeometry(0.055, 1.14, 0.075);
        brass.add(rib, place(LH.x + Math.sin(a) * 0.88, LH.y + 22.52, LH.z + Math.cos(a) * 0.88, a), grad(C.brassDark, C.brass));
        rib.dispose();
      }
    }
    const lens = new THREE.Mesh(new THREE.OctahedronGeometry(0.62, 0), matLens.clone());
    lens.position.set(0, 22.5, 0);
    lens.scale.y = 1.35;
    lens.name = 'lampLens';
    lens.visible = false;
    lhGroup.add(lens);

    const beamPivot = new THREE.Group();
    beamPivot.position.set(0, 22.5, 0);
    beamPivot.rotation.order = 'YXZ'; // yaw first, then pitch in the yawed frame
    beamPivot.rotation.x = 0.125;     // pitched down: the keeper aimed at the water — and the cliff
    beamPivot.name = 'beamPivot';
    const beamGeo = new THREE.CylinderGeometry(7.5, 0.35, 210, 12, 1, true);
    beamGeo.rotateX(Math.PI / 2);           // axis → z
    beamGeo.translate(0, 0, 105);
    const beam = new THREE.Mesh(beamGeo, makeBeamMaterial());
    beam.name = 'beamCone';
    beam.frustumCulled = false;
    // hot inner shell — same material instance, so it follows uIntensity
    // for free; fills the cone's body so it reads as light, not two walls
    const beamInnerGeo = new THREE.CylinderGeometry(4.0, 0.22, 208, 10, 1, true);
    beamInnerGeo.rotateX(Math.PI / 2);
    beamInnerGeo.translate(0, 0, 104);
    const beamInner = new THREE.Mesh(beamInnerGeo, beam.material);
    beamInner.frustumCulled = false;
    beam.add(beamInner);
    beamPivot.add(beam);
    lhGroup.add(beamPivot);

    // interior light shaft, lamp → chart table, through the oculus
    const shaftGeo = new THREE.CylinderGeometry(0.9, 1.4, 21.3, 10, 1, true);
    const shaftMat = makeBeamMaterial(0xffe2a8);
    shaftMat.uniforms.uFlip.value = 1; // lit from the lamp above
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    shaft.position.set(0, 11.6, 0);
    shaft.name = 'shaftBeam';
    lhGroup.add(shaft);
  }

  // =================== THE CLIMB (hub Phase B) ==============================
  // A wooden spiral stair winds up the tower interior, around the light shaft, from just above
  // the study oculus to the lamp-room gallery. You earn the climb by lighting the lamp; until
  // then a rope hangs across its foot. Reaching the top opens the whole island — and a foreshadow
  // of where the next tide means to rise (the vista). The ascent itself is a committed crossing
  // (puzzles.js), not free-walked: the tower is too narrow to wind a multi-turn floor through.
  {
    const startAng = deg(200);
    const N = 34, yB = LH.y + baseH, yTop = LH.y + 19.4;   // study-ceiling level -> just under the gallery (LH.y+20.6)
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const ang = startAng + i * (2.5 * TAU / N);          // ~2.5 turns
      const rad = 2.5 - t * 0.5;                            // spiral inward as it rises (2.5 -> 2.0)
      const yy = yB + 0.6 + t * (yTop - yB - 0.6);
      const step = new THREE.BoxGeometry(0.82, 0.13, 0.56);
      stone.add(step, place(LH.x + Math.sin(ang) * rad, yy, LH.z + Math.cos(ang) * rad, ang), grad(C.woodDark, C.wood));
      step.dispose();
    }
    // the FOOT — a bottom step + a brass newel in the study, under the oculus, where you step on.
    // lhGroup is ALREADY positioned at LH, so these three anchors use lhGroup-LOCAL coords —
    // they were built LH-absolute and rendered at DOUBLE the offset (~-170,27,-81): the whole
    // hub-Phase-B trio (climb foot, rope gate, descend ring) floated unreachable off-shore.
    const footAng = startAng, footR = 1.95;
    const flx = Math.sin(footAng) * footR, flz = Math.cos(footAng) * footR;
    const foot = new THREE.Group(); foot.name = 'stairFoot'; foot.position.set(flx, 0.02, flz);
    const fstep = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.16, 0.7), matWood); fstep.position.y = 0.08; foot.add(fstep);
    const newel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 1.15, 8), matBrassSolid); newel.position.set(0.42, 0.6, 0.28); foot.add(newel);
    lhGroup.add(foot);
    // the rope across the foot — the gate; hangs until the lamp is lit (puzzles _apply).
    // It WAS a half-torus: a rigid semicircular hoop, hexagonal in section, standing up
    // off the step like a croquet wicket. Owner: "the rope thing seems weird". A rope
    // does one thing that reads instantly as rope, and a torus cannot do it — it HANGS.
    // So: a catenary strung between two eyes, sagging under its own weight, swept as a
    // tube along the curve. Cheap (one mesh, ~200 tris) and it finally reads as a line
    // slung across a stair rather than a piece of hardware bolted to it.
    {
      const HALF = 0.45, TOPY = 1.02, SAG = 0.19, RZ = 0.28;   // to the newel's z
      const pts = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8, x = -HALF + t * (HALF * 2);
        // a real catenary, normalised so the ends sit exactly on the eyes
        const a = 1.9, k = (Math.cosh(a * (t * 2 - 1)) - 1) / (Math.cosh(a) - 1);
        pts.push(new THREE.Vector3(x, TOPY - SAG * (1 - k), RZ));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const rope = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 20, 0.019, 5, false),
        new THREE.MeshStandardMaterial({ color: 0x8a7a52, roughness: 1 }),   // hemp, not bitumen
      );
      rope.name = 'stairRope';
      rope.position.set(flx, 0.02, flz);
      lhGroup.add(rope);
      // the two eyes it is made off to, so the ends terminate on something
      for (const ex of [-HALF, HALF]) {
        const eye = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.008, 5, 10), matBrassSolid);
        eye.position.set(flx + ex, 0.02 + TOPY, flz + RZ);
        eye.rotation.y = Math.PI / 2;
        lhGroup.add(eye);
      }
    }
    // the DESCEND point — a brass trap-ring on the gallery, where the stair tops out
    const topAng = startAng + (N - 1) * (2.5 * TAU / N);
    const hatch = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 6, 16), matBrassSolid);
    hatch.rotation.x = Math.PI / 2;
    hatch.position.set(Math.sin(topAng) * 2.0, 20.55, Math.cos(topAng) * 2.0);
    hatch.name = 'galleryHatch';
    lhGroup.add(hatch);
  }

  // =================== THE STUDY ============================================
  const study = new THREE.Group();
  study.name = 'study';
  study.position.copy(LH);
  core.add(study);

  // chart table: brass-rimmed basin holding the model.
  //
  // BROUGHT IN FROM 3.1 m TO 2.5. At 3.1 the table half-extent was 1.55 and the stair
  // foot stands at r 1.95 with its step reaching 1.6 — they overlapped by a centimetre,
  // so the newel rose through the table's near rail and the room read as furniture
  // crammed into a tube. Owner: "This stair seems out of place… Do we need to take a
  // big swing and resize the tower or shrink the table?" The tower is load-bearing —
  // its radius sets the wall gaps, the annex throat, the gallery and the whole exterior
  // silhouette — and the table is one prop with one job. So: the table. Half-extent
  // 1.25 now, which gives the stair 0.35 m of daylight.
  {
    const topG = new THREE.BoxGeometry(2.5, 0.14, 2.5);
    stone.add(topG, place(LH.x, LH.y + 0.88, LH.z), grad(C.woodDark, C.wood));
    topG.dispose();
    for (const [lx, lz] of [[-1.0, -1.0], [1.0, -1.0], [-1.0, 1.0], [1.0, 1.0]]) {
      const leg = new THREE.BoxGeometry(0.18, 0.9, 0.18);
      stone.add(leg, place(LH.x + lx, LH.y + 0.45, LH.z + lz), grad(C.woodDark, C.wood));
      leg.dispose();
    }
    // brass rim — it also hides the cut edge where the model's terrain is clipped.
    // Its OWN batch (matBrassRail), because it is the one piece of brass in the game that
    // must not be polished — see the material. One extra draw call for four boxes.
    const rim = new THREE.BoxGeometry(2.7, 0.18, 0.12);
    for (const [dx, dz, ry] of [[0, 1.28, 0], [0, -1.28, 0], [1.28, 0, Math.PI / 2], [-1.28, 0, Math.PI / 2]]) {
      rail.add(rim, place(LH.x + dx, LH.y + 0.97, LH.z + dz, ry), grad(C.brassDark, C.brass));
    }
    rim.dispose();
  }
  // the chart-table surface is a sheet of aged vellum — the cartographer's chart, with the
  // island's own 1:240 model standing on it. A thin plane just above the table top, inside the
  // brass rim and below the model, so the chart paper shows in the border around the model.
  {
    // 0xd2ccbe was a near-white sheet 2.95m across lying flat under the study window.
    // It clipped to pure white in sun, and because it is the whole background the chart
    // model and the logbook sit on, everything ON it lost contrast — the day's return
    // beside the book stopped reading as a document at all. Chart vellum is a warm buff,
    // not typing paper; this keeps its fibre relief and gives the props something to
    // read against. (Measured, not guessed: the clipping was identical at every bloom
    // threshold up to the 1.25 ceiling, so it was never the bloom pass.)
    // PAPER IS LAMBERTIAN, and that is the whole fix. MeshStandardMaterial keeps a 4%
    // dielectric specular lobe even at roughness 1, so a flat sheet under the study sun
    // mirrors it straight into the camera and clips to pure white — which is what the
    // owner saw as "a white box next to the book". Measured: swapping these two paper
    // surfaces to Lambert took the clipped-white pixels in that view from 11.3% to 0.0%
    // and the ruled form on the return became readable for the first time. It was never
    // the bloom threshold (identical clipping at 1.05, 1.20 and 1.25) and never really
    // the albedo. Lambert also costs less to shade than Standard.
    const sheetMat = new THREE.MeshLambertMaterial({ color: 0xb3a888, flatShading: true });
    applyRelief(sheetMat, 'chart_vellum', { normalScale: 0.3, strength: 1.2 });   // faint paper-fibre relief
    // 2.44, not 2.35: the rim's inner face is at 1.22 and the vellum stopped at 1.175,
    // leaving a 4.5 cm strip of bare wood for no reason. The chart runs to the rim now,
    // which is where a chart runs to, and the 4.5 cm goes into the WORKING MARGIN —
    // the band of clear paper outside the model where his logbook and the day's return
    // actually lie. See CROP in instantiateModel: margin = 1.22 - CROP.
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(2.44, 2.44), sheetMat);
    sheet.rotation.x = -Math.PI / 2;
    sheet.position.set(LH.x, LH.y + 0.953, LH.z);
    sheet.name = 'chartSheet';
    core.add(sheet);
  }
  // the keeper's logbook, left closed on the clear west margin of the chart table — the
  // first readable fragment (the reading surface). Click it to open and read his account:
  // the lens-grinding, the rising sea, the model built to hold one whole day back.
  {
    // THE LOGBOOK. Owner, by F8: "This wood box seems to be a log book? not sure wht I
    // am looking at." It was a wood box. The cover was 0.30 x 0.072 x 0.42 and the page
    // block 0.272 x 0.052 x 0.392 sitting INSIDE it on every axis — so the pages were
    // never visible from anywhere and the prop rendered as one solid brown slab.
    //
    // A closed book is legible from across a room because of three things, none of
    // which it had: boards that OVERHANG the page block (the squares), a page block
    // showing as a pale stripe along the fore-edge and the head and tail, and a spine
    // standing proud on the bound side. Built that way now, and matte — Lambert, for
    // the same reason the chart paper is: a specular lobe on pale paper under the study
    // window clips it to white and the detail disappears again.
    const book = new THREE.Group();
    book.name = 'logbook';
    // 0.21 x 0.29, down from 0.30 x 0.42. That was a folio ledger 42 cm long, and when
    // the table came down from 3.1 m to 2.5 m it stopped fitting on the clear margin at
    // all: at dx -1.40 it hung right off the near edge, BELOW the brass rim, which is
    // what the owner saw — "The journal still looks like it is inside the table." It was
    // not inside the table, it was past it. A keeper's log is an 8x11 volume anyway.
    const W = 0.21, D = 0.29, H = 0.055, BOARD = 0.007, SQUARE = 0.006;
    const leather = new THREE.MeshLambertMaterial({ color: 0x5a4632 });
    const paper = new THREE.MeshLambertMaterial({ color: 0xc9bda0 });
    for (const sy of [-1, 1]) {                       // the two boards
      const bd = new THREE.Mesh(new THREE.BoxGeometry(W, BOARD, D), leather);
      bd.position.y = sy * (H / 2 - BOARD / 2);
      book.add(bd);
    }
    // the page block: flush at the spine, inset everywhere else so it reads as paper
    // held between boards rather than as the boards themselves
    const leaves = new THREE.Mesh(
      new THREE.BoxGeometry(W - SQUARE, H - BOARD * 2 - 0.004, D - SQUARE * 2), paper);
    leaves.position.x = -SQUARE / 2;
    book.add(leaves);
    // the spine, standing proud of the boards, with the two raised cords of a sewn binding
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.02, H, D), leather);
    spine.position.x = -(W / 2) - 0.004;
    book.add(spine);
    for (const cz of [-D * 0.26, D * 0.26]) {          // relative, so the book can be resized
      const cord = new THREE.Mesh(new THREE.BoxGeometry(0.026, H * 0.86, 0.022), leather);
      cord.position.set(-(W / 2) - 0.005, 0, cz);
      book.add(cord);
    }
    // a label pasted on the upper board — enough to say "this is a book that is written
    // in" without pretending to legible type at 4 cm
    const label = new THREE.Mesh(new THREE.BoxGeometry(W * 0.50, 0.002, D * 0.214),
      new THREE.MeshLambertMaterial({ color: 0xbfb49a }));
    label.position.y = H / 2 + 0.001;
    book.add(label);
    for (const ly of [-D * 0.043, 0, D * 0.043]) {   // three ruled strokes of a written title
      const ink = new THREE.Mesh(new THREE.BoxGeometry(W * 0.30 - Math.abs(ly) * 1.6, 0.001, D * 0.014),
        new THREE.MeshLambertMaterial({ color: 0x4a3b28 }));
      ink.position.set(-W * 0.033, H / 2 + 0.0025, ly);
      book.add(ink);
    }
    // ON the working margin: clear of the model's footprint on the inside and inside the
    // vellum on the outside. tools/harness/tabletop.mjs holds both ends of that.
    book.position.set(LH.x - 1.04, LH.y + 0.953 + H / 2, LH.z + 0.55);
    book.rotation.y = 0.06;
    core.add(book);
  }
  // a line of the keeper's lampblack on the chart margin, too fine to read by eye — INVISIBLE
  // until you hold his reading glass (the found-lens reveal; opacity driven by F.readGlass in
  // puzzles _apply, then it's a readable hotspot → lens_mark_study).
  {
    const mk = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x6f5630, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    mk.rotation.x = -Math.PI / 2;
    mk.rotation.z = Math.PI / 2;                       // its 34 cm runs ALONG the margin
    mk.position.set(LH.x - 1.06, LH.y + 0.957, LH.z - 0.35);
    mk.name = 'lensMarkStudy';
    core.add(mk);
  }

  // ===================== THE OTHER HAND'S MARKS (STACK.md §3.1) ===============
  // Where a hand one rung up did something that cost you, they left a scuff: a
  // patch of ground worn by somebody standing in one place long enough to work.
  // Nothing labelled, nothing glowing — you find them the way you find anything
  // on this island, by walking somewhere and looking down.
  //
  // ONE InstancedMesh, capacity 24, placed from world.evidence() on every level
  // change (puzzles _apply). Capacity is well under the ledger's 64-per-rung cap
  // on purpose: an old rung would otherwise carpet the island in stains, which
  // reads as decoration instead of evidence — and costs draw calls for the
  // privilege. Whichever 24 arrive first are the ones you meet.
  {
    // a soft radial smudge — a hard-edged quad reads as a sticker, and this has to
    // read as wear. 64px is plenty for something you only ever see at grazing angle.
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const g2 = cv.getContext('2d');
    const rg = g2.createRadialGradient(32, 32, 2, 32, 32, 31);
    rg.addColorStop(0, 'rgba(255,255,255,0.85)');
    rg.addColorStop(0.55, 'rgba(255,255,255,0.32)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g2.fillStyle = rg;
    g2.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(cv);
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);                     // lie flat; per-instance matrices only translate/scale/spin
    // PALE, not dark. The first pass used a dark smudge, which was invisible: the
    // study flagstones are already near-black, so a dark patch on them is nothing at
    // all. Wear is grime rubbed OFF — a path worn through a floor is the pale stone
    // under the dirt, and a patch of trodden grass is the bare ground under it. A
    // light patch reads on every surface this island has, and it reads as use rather
    // than as a stain someone dropped on the world.
    const mat = new THREE.MeshBasicMaterial({
      map: tex, color: 0xd8cdb4, transparent: true, opacity: 0.34, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,   // never z-fight the ground
    });
    const im = new THREE.InstancedMesh(geo, mat, 24);
    im.name = 'handMarks';
    im.count = 0;                                  // nothing until a rung inherits something
    im.frustumCulled = false;                      // instances move on level change, not per frame
    core.add(im);
  }
  // the phial from the high pool, set out to dry on the chart table's west margin after
  // the climb back out (#49 round trip) — appears once its sodden note has dried
  // (W.flags.phialDried, driven in puzzles _apply); click to finally read what he sealed.
  {
    const dp = phialProp('phialDesk');
    dp.position.set(LH.x - 1.05, LH.y + 0.985, LH.z + 0.90);
    dp.rotation.y = 1.35;                              // lying along the margin, not across it
    dp.visible = false;
    core.add(dp);
  }

  // the model sits here (filled in later with the clone)
  const modelAnchor = new THREE.Group();
  modelAnchor.name = 'modelAnchor';
  modelAnchor.position.set(LH.x, LH.y + 1.01, LH.z);
  core.add(modelAnchor);

  // the cartographer annotated their own model: small burnished marks on
  // the table margin by each station — a tide glyph by the valve, a sun
  // glyph by the crank, the plumb diagram facing the model's beach (the
  // same hand as the cellar carve), and a tiny paired maker's mark tucked
  // in the south-east corner. No words anywhere; the same hand, everywhere.
  {
    const mark = (gi, x, z, s, rz, op) => {
      const g = glyphSprite(atlas, gi, 0xc08a3e, s);
      g.rotation.x = -Math.PI / 2;
      g.rotation.z = rz;
      g.position.set(x, LH.y + 0.956, z);
      g.material.opacity = op;
      core.add(g);
    };
    // the margin band is only 25 cm wide (model water sheet edge 1.29 to
    // rim inner face 1.54) — marks must fit inside it or duck under the sheet
    mark(2, LH.x + 1.405, LH.z + 1.02, 0.2, 0.4, 0.65);   // tide, by the valve
    mark(7, LH.x - 1.405, LH.z - 1.02, 0.2, -1.1, 0.65);  // sun, by the crank
    mark(4, LH.x - 0.02, LH.z - 1.405, 0.2, 0.05, 0.7);   // plumb, facing the model's beach
    mark(1, LH.x + 1.33, LH.z - 1.38, 0.17, 0.3, 0.55);   // the maker's pair
    mark(0, LH.x + 1.46, LH.z - 1.35, 0.13, -0.2, 0.55);
  }

  // the count of descents, raw-scratched into the clear east margin — one stroke
  // per dive, in a cruder hand than the burnished glyphs around it. The table
  // keeps a tally of how many times you have gone down; and because the model
  // carries every mark its island does, the count recurses inward, table within
  // table. Hidden until you descend (driven by W.level in puzzles `_apply`), so
  // it accrues in-play. SPINE "Borrowed from the 90s": the house remembers.
  {
    const tally = new THREE.Group();
    tally.name = 'chartTally';
    const tMat = new THREE.MeshBasicMaterial({
      color: 0xceae6a, transparent: true, opacity: 0.62,
      depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    // small hand jitter per stroke (dx, rotZ, length) — scratched, not printed
    const JIT = [[-0.004, 0.07, 0.158], [0.006, -0.06, 0.172], [-0.002, 0.03, 0.149]];
    for (let i = 0; i < MAX_DEPTH - 1; i++) {
      const [dx, rz, len] = JIT[i % JIT.length];
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.026), tMat);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = rz;
      // 1.06, not 1.43: the east margin runs 0.90..1.22 now and the strokes were
      // scratched out past the rim entirely (tools/harness/tabletop.mjs found this one)
      m.position.set(LH.x + 1.06 + dx, LH.y + 0.9575, LH.z - 0.18 + i * 0.18);
      m.visible = false;       // revealed one-per-descent by _apply
      tally.add(m);
    }
    core.add(tally);
  }

  // valve pedestal + wheel (tide)
  {
    const ped = new THREE.CylinderGeometry(0.14, 0.2, 1.0, 8);
    brass.add(ped, place(LH.x + 2.3, LH.y + 0.5, LH.z + 1.1), grad(C.brassDark, C.brass));
    ped.dispose();
    const wheel = new THREE.Group();
    wheel.position.set(LH.x + 2.3, LH.y + 1.1, LH.z + 1.1);
    wheel.rotation.x = -0.5;
    wheel.name = 'valveWheel';
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.05, 6, 18), matBrassSolid);
    wheel.add(ring);
    for (let i = 0; i < 4; i++) {
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.76, 5), matBrassSolid);
      spoke.rotation.z = (i / 4) * TAU + Math.PI / 4;
      wheel.add(spoke);
    }
    core.add(wheel);
  }

  // orrery: brass arm + sun-lamp orbiting the model (drives/displays the sky)
  {
    const orrery = new THREE.Group();
    orrery.position.set(LH.x, LH.y + 1.02, LH.z);
    orrery.name = 'orreryPivot';
    const tilt = new THREE.Group();
    tilt.name = 'orreryTilt';
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 1.75, 6), matBrassSolid);
    arm.rotation.z = Math.PI / 2;
    arm.position.x = 0.875;
    tilt.add(arm);
    const lampBall = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), matLamp);
    lampBall.position.x = 1.75;
    lampBall.name = 'orreryLamp';
    tilt.add(lampBall);
    orrery.add(tilt);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.16, 8), matBrassSolid);
    orrery.add(hub);
    core.add(orrery);

    // crank handle on the table edge — the player's grip on the sun
    const crank = new THREE.Group();
    crank.position.set(LH.x - 1.7, LH.y + 0.95, LH.z - 1.1);
    crank.name = 'crankHandle';
    const crankAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 6), matBrassSolid);
    crankAxle.rotation.z = Math.PI / 2;
    crank.add(crankAxle);
    const crankArm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.06), matBrassSolid);
    crankArm.position.set(0.18, 0.12, 0);
    crank.add(crankArm);
    const crankKnob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), matWood);
    crankKnob.position.set(0.18, 0.28, 0);
    crank.add(crankKnob);
    core.add(crank);
  }

  // music box on a wall shelf
  {
    const shelf = new THREE.BoxGeometry(1.2, 0.08, 0.5);
    // joinery, not masonry — this board was baked into `stone` with the books and read
    // as a near-black slab of wall with mortar courses on it
    joinery.add(shelf, place(LH.x - 3.6, LH.y + 1.25, LH.z - 2.6, deg(35)), grad(C.woodDark, C.wood));
    shelf.dispose();
    const box = new THREE.Group();
    box.position.set(LH.x - 3.6, LH.y + 1.42, LH.z - 2.6);
    box.rotation.y = deg(35);
    box.name = 'musicBox';
    // THE MUSIC BOX carries the five-note tune the whole stones puzzle turns on, and it
    // was a featureless cream box with one tan rectangle stuck to the front — the most
    // story-laden object in the room and the least made. A music box is a CASE: a
    // plinth, banded corners, a wound key, and a mechanism you can see once it is open.
    const caseW = 0.42, caseD = 0.3, caseH = 0.17;
    const body = new THREE.Mesh(new THREE.BoxGeometry(caseW, caseH, caseD), matWood);
    body.position.y = -0.015;
    box.add(body);
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(caseW + 0.035, 0.022, caseD + 0.035), matWood);
    plinth.position.y = -0.11;
    box.add(plinth);
    // brass banding at the four uprights, the way a travelling case is protected
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.018, caseH + 0.01, 0.018), matBrassSolid);
      band.position.set(sx * (caseW / 2 - 0.009), -0.015, sz * (caseD / 2 - 0.009));
      box.add(band);
    }
    // the escutcheon, and the key still in it
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.008), matBrassSolid);
    plate.position.set(0.0, -0.02, caseD / 2 + 0.002);
    box.add(plate);
    const keyShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.05, 6), matBrassSolid);
    keyShaft.rotation.x = Math.PI / 2;
    keyShaft.position.set(0, -0.02, caseD / 2 + 0.03);
    box.add(keyShaft);
    const keyWing = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.016, 0.006), matBrassSolid);
    keyWing.position.set(0, -0.02, caseD / 2 + 0.055);
    box.add(keyWing);
    // THE LID, HINGED AT ITS BACK EDGE. It was a plank whose pivot sat at its own
    // centre, so `rotation.x` swung half the lid down THROUGH the case — the same
    // mistake as the tower doors, in miniature: a hinge is an edge, not a middle.
    const lid = new THREE.Group();
    lid.position.set(0, caseH / 2 - 0.015, -caseD / 2);
    lid.name = 'musicBoxLid';
    const lidPlank = new THREE.Mesh(new THREE.BoxGeometry(caseW, 0.028, caseD), matWood);
    lidPlank.position.z = caseD / 2;
    lid.add(lidPlank);
    const lidInlay = new THREE.Mesh(new THREE.BoxGeometry(caseW - 0.09, 0.004, caseD - 0.09), matBrassSolid);
    lidInlay.position.set(0, 0.016, caseD / 2);
    lid.add(lidInlay);
    box.add(lid);
    // the mechanism under it: the pinned cylinder and the comb it plucks. Only ever
    // seen once the lid is up, which is the point of opening it.
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.22, 10), matBrassSolid);
    drum.rotation.z = Math.PI / 2;
    drum.position.set(-0.04, 0.03, 0.01);
    box.add(drum);
    const comb = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.006, 0.05), matBrassSolid);
    comb.position.set(-0.04, 0.045, 0.08);
    box.add(comb);
    core.add(box);

    // a folded note resting on the shelf beside the music box — a readable fragment (music_note)
    // tying the box's five-note tune to the keeper's grief. Separate mesh (NOT a child of the box,
    // whose hotspot raycasts its children) so it's its own hotspot.
    const note = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.14),
      new THREE.MeshStandardMaterial({ color: 0xded3ba, roughness: 0.95, flatShading: true }));
    note.position.set(LH.x - 3.78, LH.y + 1.34, LH.z - 2.78);
    note.rotation.set(0, deg(35) + 0.4, 0.04);
    note.name = 'musicNote';
    core.add(note);
  }

  // bookshelves (baked)
  {
    const PER_SHELF = SHELF_TITLES.length / 3;   // 18 volumes over the message bay's three boards
    let titled = 0;
    SHELF_MARKS.length = 0;
    SHELF_STATS.books = SHELF_STATS.lettered = SHELF_STATS.stacks = 0;
    // EVERY standing volume gets a title, in both bays — the key is the doubled rule, not
    // the lettering. Walk a seeded shuffle of the decoy library cyclically so no two
    // neighbours carry the same title and the whole library is used before any volume
    // comes round again; with ~75 standing books and 45 titles a few repeat, which is
    // what a shelf holding two copies of the tide tables actually looks like.
    const deck = SHELF_DECOYS.map((_, i) => i);
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    let deckN = 0;
    for (let s = 0; s < 2; s++) {
      const a0 = deg(285 + s * 38);
      const lettered = s === 0;                  // the near bay carries the message
      for (let sh = 0; sh < 3; sh++) {
        const shelf = new THREE.BoxGeometry(2.0, 0.07, 0.45);
        joinery.add(shelf, place(LH.x + Math.sin(a0) * 4.4, LH.y + 0.6 + sh * 0.62, LH.z + Math.cos(a0) * 4.4, a0), grad(C.woodDark, C.wood));
        shelf.dispose();
        // THE SHELVES. Every book used to be an upright box of identical depth drawn
        // from ONE of two colours, so a whole wall of them read as a single teal slab —
        // the "basic geometry" tell. A real shelf is legible from across a room because
        // of what is IRREGULAR about it: bindings from different decades, volumes shoved
        // back or left proud, a gap where something was taken out, the neighbours leaning
        // into it, and a few laid flat because they were too tall to stand. All of that
        // is per-book arithmetic on geometry that was already here — same one baked
        // batch, same draw call, no new material.
        const SPINES = [
          0x355560,   // the old cloth blue that used to be half the wall
          0x3e7a6a,   // faded green board
          0x6e3630,   // oxblood
          0x7d6740,   // tan calf
          0x2f3a44,   // near-black buckram
          0x8a7250,   // vellum, sun-bleached
          0x4a3a52,   // dull plum
        ];
        const shelfY = LH.y + 0.64 + sh * 0.62;
        // unit vectors along the shelf (tangent) and into the wall (radial)
        const tx = Math.cos(a0), tz = -Math.sin(a0);
        const nx = Math.sin(a0), nz = Math.cos(a0);
        const at = (bx, by, depth) => [
          LH.x + nx * (4.4 + depth) + tx * bx, by, LH.z + nz * (4.4 + depth) + tz * bx,
        ];

        // PLAN THE SHELF BEFORE PLACING IT. The eighteen doubled-rule volumes have to
        // land in acrostic order, evenly spread so the message is not bunched at one end
        // — and you cannot choose positions in a list you are still generating. So the
        // first pass decides what stands where and the second pass builds it. Both bays
        // are fully lettered; bay 0 is the one the message runs across, and bay 1 is
        // where things got shoved, which is why the flat stacks live there.
        const plan = [];
        let bx = -0.85;
        while (bx < 0.85) {
          // a gap: something was borrowed and never came back
          if (r() < 0.07) { bx += 0.03 + r() * 0.05; continue; }

          // a flat stack, for the volumes too tall to stand up in a keeper's shelf
          if (r() < (lettered ? 0.03 : 0.12) && bx < 0.6) {
            const sw = 0.20 + r() * 0.12;
            const n = 2 + Math.floor(r() * 2);
            const lay = [];
            for (let k = 0; k < n; k++) {
              lay.push({ th: 0.035 + r() * 0.03, d: 0.26 + r() * 0.05,
                c: vary(new THREE.Color(SPINES[Math.floor(r() * SPINES.length)]), r, 0.05, 0.18, 0.14),
                jx: (r() - 0.5) * 0.02, jz: (r() - 0.5) * 0.04, ja: (r() - 0.5) * 0.09 });
            }
            plan.push({ k: 'stack', bx, sw, lay });
            bx += sw + 0.02;
            continue;
          }

          const bw = 0.055 + r() * 0.10, bh = 0.28 + r() * 0.24;
          // a lean, tipped into the gap its neighbour left. Rotating about the box's
          // centre lifts the low corner off the shelf, so drop it back by the sagitta.
          const lean = r() < 0.13 ? (r() - 0.5) * 0.5 : 0;
          plan.push({ k: 'book', bx, bw, bh, lean, d: 0.24 + r() * 0.09,
            depth: -0.03 + r() * 0.07,                 // shoved back, or left proud
            c: vary(new THREE.Color(SPINES[Math.floor(r() * SPINES.length)]), r, 0.05, 0.20, 0.16),
            cell: SPINE_DECOY0 + deck[deckN++ % deck.length] });
          bx += bw * Math.cos(lean) + 0.012;
        }

        if (lettered) {
          // READ IT THE WAY A SHELF IS READ: top board down, left to right. Neither axis
          // runs that way on its own. `sh` counts UPWARD from the floor, and bx runs along
          // the tangent (cos a0, -sin a0), which from inside the room looking at the wall
          // runs right to left on screen. Placed naively the message came out bottom-up
          // and mirrored — every letter present, in an order nobody would ever try.
          const stand = plan.map((b, i) => (b.k === 'book' ? i : -1)).filter((i) => i >= 0);
          const want = Math.min(PER_SHELF, stand.length);
          const base = (2 - sh) * PER_SHELF;                    // top board carries the first six
          for (let k = 0; k < want; k++) {
            const slot = stand[Math.round((k * (stand.length - 1)) / (want - 1 || 1))];
            const n = base + (want - 1 - k);
            plan[slot].cell = SPINE_TITLE0 + n;
            SHELF_MARKS.push({ n, shelf: sh, bx: plan[slot].bx });
            titled++;
          }
        }

        for (const b of plan) {
          if (b.k === 'book') { SHELF_STATS.books++; if (b.cell) SHELF_STATS.lettered++; }
          else SHELF_STATS.stacks++;
          if (b.k === 'stack') {
            let sy = shelfY;
            for (const l of b.lay) {
              const lay = new THREE.BoxGeometry(b.sw, l.th, l.d);
              // each one shoved a little out of true with the one under it
              joinery.add(lay, place(...at(b.bx + b.sw / 2 + l.jx, sy + l.th / 2, -0.02 + l.jz), a0 + l.ja), () => l.c);
              lay.dispose();
              sy += l.th;
            }
            continue;
          }
          const book = new THREE.BoxGeometry(b.bw, b.bh, b.d);
          const drop = b.lean ? (b.bh / 2) * (1 - Math.cos(b.lean)) + (b.bw / 2) * Math.abs(Math.sin(b.lean)) : 0;
          // the SPINE is the -z face: `place` turns local +z onto the outward radial, and
          // the shelf stands against the wall, so -z is the face looking into the room.
          const rect = b.cell ? spineCell(b.cell) : null;
          joinery.add(book, place(...at(b.bx + b.bw / 2, shelfY + b.bh / 2 - drop, b.depth),
            a0, 1, 1, 1, 0, b.lean), () => b.c, rect && ((_nx, _ny, nz) => (nz < -0.5 ? rect : null)));
          book.dispose();
        }
      }
    }
    // A READER FOR THE BAY. The proxy is built HERE rather than by the fragment factory
    // because its placement is derived from the same LH and a0 the boards are, and a
    // hand-copied position in content.js would drift the first time a shelf moves.
    // content.js still owns everything a writer owns — the label, the reach, the pages.
    {
      const a0 = deg(285);
      const rr = 4.15;                                    // just in front of the spines
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.95, 1.95, 0.34),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      box.position.set(LH.x + Math.sin(a0) * rr, LH.y + 1.5, LH.z + Math.cos(a0) * rr);
      box.rotation.y = a0;
      box.name = 'lore_lettered_shelf';
      defineProp('lore_lettered_shelf');
      core.add(box);
    }

    // the lettering itself, and the gilt it is struck in
    const atlas = spineAtlas();
    matJoinery.emissiveMap = atlas;
    matJoinery.emissive = new THREE.Color(0xd8b26a);
    matJoinery.emissiveIntensity = GILT_REST;
    matJoinery.needsUpdate = true;
    if (titled !== SHELF_TITLES.length) console.warn('shelf: only', titled, 'of', SHELF_TITLES.length, 'titles placed');
  }

  // plumb mechanism over the table + brass floor plate (the dive spot)
  {
    const pulley = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 10), matBrassSolid);
    pulley.rotation.x = Math.PI / 2;
    pulley.position.set(LH.x, LH.y + 4.4, LH.z);
    core.add(pulley);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.02, 5, 10, Math.PI * 1.4), matBrassSolid);
    hook.position.set(LH.x, LH.y + 4.2, LH.z);
    hook.name = 'plumbHook';
    core.add(hook);
    // hung plumb line + bob (hidden until hung)
    const hung = new THREE.Group();
    hung.name = 'plumbHung';
    hung.visible = false;
    // it hangs over the model's BEACH — where you woke, where you will land
    const bx = LH.x + 4 * SCALE_MODEL, bz = LH.z + (-104) * SCALE_MODEL;
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 2.9, 4), matBrassSolid);
    line.position.set(bx, LH.y + 2.72, bz);
    line.rotation.x = 0.13; // slight lean from the centred hook
    hung.add(line);
    const bob = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 8), matBrassSolid);
    bob.rotation.x = Math.PI;
    bob.position.set(bx, LH.y + 1.22, bz - 0.18);
    hung.add(bob);
    core.add(hung);

    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.05, 18), matBrassSolid);
    plate.position.set(LH.x + 2.2, LH.y + 0.03, LH.z - 1.4);
    plate.name = 'deskPlate';
    core.add(plate);
    const plateRing = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.02, 5, 24), matWood);
    plateRing.rotation.x = Math.PI / 2;
    plateRing.position.set(LH.x + 2.2, LH.y + 0.06, LH.z - 1.4);
    core.add(plateRing);

    // THE SETTING (STACK.md §6) — a small brass index sunk in the floor beside the
    // plate, with four positions. It is how the player DECLARES what happens to
    // what they displaced, before they take an ending; the plate then performs it.
    // Deliberately an instrument and not a menu: everything else in this game is
    // touched, and the last decision should be too. Hidden until the bottom, where
    // it is the only thing left to decide.
    {
      const dial = new THREE.Group();
      dial.name = 'dispDial';
      const face = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.03, 16), matBrassSolid);
      dial.add(face);
      // four notches around the rim — the positions, readable as a count before the
      // player knows what any of them mean
      for (let i = 0; i < 4; i++) {
        const n = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.035, 0.06), matBrassSolid);
        n.position.set(Math.sin(i * Math.PI / 2) * 0.13, 0.02, Math.cos(i * Math.PI / 2) * 0.13);
        dial.add(n);
      }
      // the pointer — rotated to the selected disposition in puzzles _apply
      const ptr = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.02, 0.15), matWood);
      ptr.position.set(0, 0.035, 0.055);
      ptr.name = 'dispPointer';
      dial.add(ptr);
      dial.position.set(LH.x + 2.2, LH.y + 0.04, LH.z - 2.25);   // floor-side of the plate
      dial.visible = false;
      core.add(dial);
    }
    // a soft amber glow that wakes on the plate ONLY at the bottom (Panel #4 #1, the visual
    // half of discoverability): when there is nowhere further down, the way back GLINTS, so a
    // player who came to ring the bell still sees the plate is live. A Sprite (clone-safe; a
    // Points here would crash instantiateModel); driven by W.level in puzzles _apply.
    const plateGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: radialGlowTex(), color: 0xffb45a, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    plateGlow.position.set(LH.x + 2.2, LH.y + 0.14, LH.z - 1.4);
    plateGlow.scale.setScalar(1.7);
    plateGlow.name = 'plateGlow';
    core.add(plateGlow);
  }

  // =================== THE ANNEX (locked until one level down) ==============
  {
    const aa = deg(15); // north-ish attachment
    // Phase A bones: pushed clear of the drum (centre baseR+2.9 → near edge r5.3 > drum r5.2, killing
    // the wall-in-wall z-fight the owner flagged), and the wall opening RE-AIMED to face the study
    // (gap centred az195° from the annex, thetaStart aa+220) so the inner door stands in a true
    // doorway and you look straight in at the keeper's room instead of obliquely past a solid wall.
    const ax = LH.x + Math.sin(aa) * (baseR + 2.9), az = LH.z + Math.cos(aa) * (baseR + 2.9);
    const wall = new THREE.CylinderGeometry(2.7, 2.8, 3.4, 20, 1, true, aa + deg(220), deg(280));
    stone.add(wall, new THREE.Matrix4().makeTranslation(ax, LH.y + 1.7, az), grad(C.boneDark, C.bone));
    wall.dispose();
    const roof = new THREE.ConeGeometry(3.0, 1.4, 18);
    stone.add(roof, new THREE.Matrix4().makeTranslation(ax, LH.y + 4.1, az), grad(C.copperDark, C.copper));
    roof.dispose();
    const afloor = new THREE.CylinderGeometry(2.8, 2.8, 0.2, 16);
    stone.add(afloor, new THREE.Matrix4().makeTranslation(ax, LH.y - 0.03, az), grad(C.stoneOld, C.boneDark));
    afloor.dispose();

    // the threshold throat — a short stone doorway bridging the drum wall (r5.2) and the annex
    // (r5.3) so the two read as ONE connected structure, not two buildings kissing. Baked into
    // `stone` (clone-safe); the jambs sit inside the drum's az-15° gap so nothing z-fights.
    const hw = deg(8.5);                         // doorway half-width (~0.8m of clear opening here)
    {
      for (const s of [-1, 1]) {                 // two radial jamb slabs flanking the opening
        const ja = aa + s * hw;
        const jamb = new THREE.BoxGeometry(0.22, 3.4, 0.95);
        stone.add(jamb, place(LH.x + Math.sin(ja) * 5.3, LH.y + 1.7, LH.z + Math.cos(ja) * 5.3, ja), grad(C.boneDark, C.bone));
        jamb.dispose();
      }
      const lintel = new THREE.BoxGeometry(2.0, 0.4, 0.95);   // a lintel across the top of the throat
      stone.add(lintel, place(LH.x + Math.sin(aa) * 5.3, LH.y + 3.5, LH.z + Math.cos(aa) * 5.3, aa), grad(C.bone, C.bone));
      lintel.dispose();
    }

    // inner door between study and annex — hung in the THROAT above, on the same
    // chord derivation as the study door. It had the same defect: the leaf sat at
    // rotation.y = 0 (axis-aligned with world +x) while its doorway runs at az 15°,
    // so its far edge stood ~0.39m out of line and pushed into the jamb. The old
    // position carried a bare `- 0.8` world-x nudge hand-tuned to land near the
    // jamb; hangDoor puts it exactly on it.
    const innerDoor = new THREE.Group();
    const ihung = hangDoor(aa - hw, aa + hw, 5.3, 0);   // hinged at the near jamb of the throat
    innerDoor.position.set(LH.x + ihung.x, LH.y + 1.55, LH.z + ihung.z);
    innerDoor.rotation.y = ihung.rotY;
    // puzzles.js swings this one open; give it the closed baseline to swing FROM,
    // and the hand to swing toward, instead of overwriting rotation.y from zero.
    innerDoor.userData.closedY = ihung.closed;
    innerDoor.userData.swingY = ihung.swing * 1.5;
    innerDoor.name = 'innerDoor';
    const idoor = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3.1, 0.1), matWood);
    idoor.position.x = 0.75;
    innerDoor.add(idoor);
    core.add(innerDoor);

    // contents: coat on a hook, footprints, the bell — and a second, smaller desk
    const hookM = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.25, 5), matBrassSolid);
    hookM.rotation.x = Math.PI / 3;
    hookM.position.set(ax - 1.9, LH.y + 1.9, az + 0.6);
    core.add(hookM);
    const coat = new THREE.Group();
    coat.name = 'coat';
    const coatMat = new THREE.MeshStandardMaterial({ color: 0x6a6f74, flatShading: true, roughness: 0.9 }); // lightened so the weave reads
    applyRelief(coatMat, 'cloth', { normalScale: 0.6, strength: 2.0 });   // the keeper's coat — a coarse
                                      // weathered burlap weave, now with woven-thread relief under the lamp
    const coatBody = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.5, 8), coatMat);
    coatBody.position.set(ax - 1.9, LH.y + 1.2, az + 0.6);
    coat.add(coatBody);
    // the maker's pair once more, stitched small at the hem — the same
    // hand that signed the table and the bell wore this coat
    const stitch = (gi, ox, oy, s, rz) => {
      const g = glyphSprite(atlas, gi, 0xc08a3e, s);
      const dir = Math.atan2(1.9, -0.6); // outward, toward the annex room
      g.position.set(ax - 1.9 + Math.sin(dir) * 0.34 + ox, LH.y + oy, az + 0.6 + Math.cos(dir) * 0.34);
      g.rotation.y = dir;
      g.rotation.z = rz;
      g.material.opacity = 0.45;
      coat.add(g);
    };
    stitch(1, -0.02, 0.78, 0.11, 0.25);
    stitch(0, 0.09, 0.72, 0.085, -0.1);
    core.add(coat);

    const prints = new THREE.Group();
    prints.name = 'footprints';
    const printMat = new THREE.MeshBasicMaterial({ color: 0x141009, transparent: true, opacity: 0.5 });
    for (let i = 0; i < 7; i++) {
      const p = new THREE.Mesh(new THREE.CircleGeometry(0.09, 8), printMat);
      p.rotation.x = -Math.PI / 2;
      p.scale.y = 1.8;
      const t = i / 6;
      p.position.set(
        lerp(LH.x + Math.sin(aa) * 4.5, ax + 0.4, t) + (i % 2 ? 0.16 : -0.16),
        LH.y + 0.02,
        lerp(LH.z + Math.cos(aa) * 4.5, az + 0.4, t));
      prints.add(p);
    }
    core.add(prints);

    const bellStand = new THREE.CylinderGeometry(0.1, 0.16, 1.1, 8);
    brass.add(bellStand, place(ax + 1.0, LH.y + 0.55, az - 0.4), grad(C.brassDark, C.brass));
    bellStand.dispose();
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8, 0, TAU, 0, Math.PI * 0.55), matBrassSolid);
    bell.position.set(ax + 1.0, LH.y + 1.35, az - 0.4);
    bell.name = 'bell';
    core.add(bell);

    // the maker's pair once more, small on the floor by the bell stand —
    // the hand that signed the chart table also built the way out
    const sig = (gi, x, z, s, rz) => {
      const g = glyphSprite(atlas, gi, 0xc08a3e, s);
      g.rotation.x = -Math.PI / 2;
      g.rotation.z = rz;
      g.position.set(x, LH.y + 0.078, z);
      g.material.opacity = 0.5;
      core.add(g);
    };
    sig(1, ax + 0.6, az - 0.06, 0.17, 0.4);
    sig(0, ax + 0.76, az + 0.07, 0.13, -0.15);
  }

  // =================== THE KEEPER'S QUARTERS (#15) =========================
  // The annex IS the keeper's room — furnish it into a life left mid-sentence:
  // a cot, a cold dead stove, and on the far wall the recursion drawn in his own
  // hand, nested islands shrinking to a single lit dot. The one WARM lamp (its
  // point-light lives in main.js, gated to depth) is the hearth the cold descent
  // threatens — darkness defined by a light, not a black frame. He KNEW where it
  // led and drew himself down it anyway. Static geometry: hidden behind the
  // closed inner door at the surface, revealed when you go one level down.
  {
    const aa = deg(15);
    const ax = LH.x + Math.sin(aa) * (baseR + 2.9), az = LH.z + Math.cos(aa) * (baseR + 2.9);  // matches the pushed-out annex shell
    const q = new THREE.Group();
    q.name = 'quarters';
    q.position.set(ax, LH.y, az);
    q.rotation.y = aa;                       // local +z → far wall, +x → along it
    core.add(q);
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a4632, flatShading: false, roughness: 0.92 });
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x20242a, flatShading: false, roughness: 0.8, metalness: 0.3 });

    // the cot — against the far-left wall, the blanket cold and unmade
    const cot = new THREE.Group(); cot.position.set(-0.95, 0, 1.35);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.34, 0.78), woodMat); frame.position.y = 0.21; cot.add(frame);
    const blanket = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.18, 0.64),
      new THREE.MeshStandardMaterial({ color: 0x3a4654, flatShading: true, roughness: 0.95 }));
    blanket.position.y = 0.45; cot.add(blanket);
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.56),
      new THREE.MeshStandardMaterial({ color: 0x756b5c, flatShading: true, roughness: 1 }));
    pillow.position.set(-0.62, 0.51, 0); cot.add(pillow);
    q.add(cot);

    // the cold stove — fire long dead, its mouth a black hole; the contrast the
    // warm lamp needs
    const stove = new THREE.Group(); stove.position.set(1.4, 0, 1.2);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.82, 10), ironMat); body.position.y = 0.41; stove.add(body);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 10), ironMat); lid.position.y = 0.85; stove.add(lid);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 2.5, 8), ironMat); pipe.position.y = 2.05; stove.add(pipe);
    const mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.26), new THREE.MeshBasicMaterial({ color: 0x070504 })); mouth.position.set(0, 0.41, 0.401); stove.add(mouth);
    q.add(stove);

    // the wound: the recursion drawn by his own hand — nested islands receding
    // to a single warm dot, pinned to the far wall (echoes the nestedGlint)
    const sketch = new THREE.Group(); sketch.position.set(-0.15, 1.75, 2.32); sketch.rotation.y = Math.PI;
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.9),
      new THREE.MeshStandardMaterial({ color: 0xc9bd9e, roughness: 1, side: THREE.DoubleSide }));
    sketch.add(paper);
    const inkMat = new THREE.MeshBasicMaterial({ color: 0x241b12 });
    for (let i = 0; i < 7; i++) {
      const rr = 0.4 - i * 0.052;
      const ring = new THREE.Mesh(new THREE.RingGeometry(rr - 0.014, rr, 22), inkMat);
      ring.position.set(-0.022 * i, -0.022 * i, 0.006 + i * 0.0012);
      ring.scale.y = 0.82;                   // islands, not circles
      sketch.add(ring);
    }
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.02, 10), new THREE.MeshBasicMaterial({ color: 0xffd98a }));
    dot.position.set(-0.022 * 6, -0.022 * 6, 0.02);
    sketch.add(dot);
    q.add(sketch);

    // the warm lamp source, hung over the room (the point-light is in main.js)
    const lamp = new THREE.Group(); lamp.position.set(0.05, 0, 0.55);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 5), matBrassSolid); rod.position.y = 2.78; lamp.add(rod);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.16, 8), matBrassSolid); cap.position.y = 2.42; lamp.add(cap);
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xffe6b0, emissive: 0xffb45a, emissiveIntensity: 2.4, flatShading: true }));
    globe.position.y = 2.28; lamp.add(globe);
    q.add(lamp);

    // the keeper's PRIVATE journal, left on the cot by the pillow — the intimate counterpart to
    // the chart-table logbook (the reading surface). Found only here, behind the inner door, one
    // level down; its deep page turns toward the descent. A worn dark book; click to read it.
    const jbook = new THREE.Group(); jbook.name = 'quartersJournal';
    const jcover = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.06, 0.36), woodMat);
    jbook.add(jcover);
    const jleaves = new THREE.Mesh(new THREE.BoxGeometry(0.235, 0.045, 0.335),
      new THREE.MeshStandardMaterial({ color: 0xded3ba, roughness: 0.95, flatShading: true }));
    jleaves.position.y = 0.005; jbook.add(jleaves);
    jbook.position.set(-1.2, 0.57, 1.32);     // on the cot blanket, near the pillow
    jbook.rotation.y = -0.5;
    q.add(jbook);
  }

  // =================== THE DROWNED GALLERY (#16 — sealed vista) =============
  // The sea you woke beside hides a drowned colonnade. At high tide only its
  // capitals break the surface off the beach; turn the valve and as the water
  // falls a sunken hall stands revealed on the exposed flats, at the lip of the
  // deep shelf. Draining is not safe — it OPENS things below; descent, not the
  // 240x gimmick, is the real direction. A SEALED VISTA: seen plainly from the
  // wake-up beach looking seaward, the walkable sunless interior the follow-up.
  // Static decorative geometry on the tidal shelf (no collision/walkability
  // change); the existing water hides it and draining reveals it.
  let galleryGlow = null;
  {
    const drownedMat = new THREE.MeshStandardMaterial({ color: 0x39424a, flatShading: false, roughness: 0.55, metalness: 0.15 });
    const ROWS = [0, 8];                              // two colonnades flanking a seaward aisle
    const ZS = [-108, -111.5, -115, -118.5];
    const gallery = new THREE.Group(); gallery.name = 'drownedGallery';
    // the colonnade is many identical single-material pieces — instance it so the
    // whole hall (and its model clone) costs 3 draw calls, not 18 (perf, loop #47)
    const gm4 = new THREE.Matrix4();
    const nCol = ZS.length * ROWS.length;
    const colInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.62, 0.82, 7.6, 9), drownedMat, nCol);
    const capInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1.9, 0.4, 1.9), drownedMat, nCol);
    let ci = 0;
    for (const z of ZS) {
      for (const x of ROWS) {
        gm4.makeTranslation(x, -2.2, z); colInst.setMatrixAt(ci, gm4);  // rooted at -6, top +1.6
        gm4.makeTranslation(x, 1.45, z); capInst.setMatrixAt(ci, gm4);
        addCollider(x, z, 0.75);                                        // solid when the hall is drained + walkable
        ci++;
      }
    }
    const lintelInst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.62, 12.5), drownedMat, ROWS.length);
    ROWS.forEach((x, i) => { gm4.makeTranslation(x, 1.55, -113.25); lintelInst.setMatrixAt(i, gm4); });
    for (const inst of [colInst, capInst, lintelInst]) inst.computeBoundingSphere();
    gallery.add(colInst, capInst, lintelInst);
    core.add(gallery);
    // cold drowned-light over the flooded floor — the sunless luminance, exposed
    // as the tide falls. Kept OUT of core: it's a Points, and instantiateModel
    // strips Points mid-traverse while cloning core (which chokes). Added to
    // diveGroup in main, like biolume; driven there (shows as the tide falls).
    const glintPos = [];
    for (let i = 0; i < 44; i++) glintPos.push(-2 + r() * 12, -3.6 + r() * 0.6, -106 - r() * 15);
    galleryGlow = makeGlowPoints(glintPos, 0x4fd8d0, 0.34);
    galleryGlow.name = 'galleryGlow';
  }

  // SEA-STRATA L3 'midwater' (loop #124): a field of cold bioluminal motes drifting over the
  // drowned island — the only kind light in the lightless deep, by which you navigate at L3.
  // A Points (1 draw), kept OUT of core like galleryGlow (core.clone chokes on Points); added to
  // diveGroup + shown only at W.level>=3. Own rng so it never shifts the world scatter.
  const l3motePos = [];
  {
    const mr = mulberry32(SEED ^ 0x3c0d);
    for (let i = 0; i < 150; i++) {
      l3motePos.push(-55 + mr() * 190, 1.4 + mr() * 3.6, -130 + mr() * 180);   // around/above the L3 water (~+2.7)
    }
  }
  const l3motes = makeGlowPoints(l3motePos, 0x66cfe6, 0.5);
  l3motes.name = 'l3motes';

  // =================== THE THRESHOLD (#24 — jetty + dory) ===================
  // The way out, made physical: a little jetty reaching off the wake-up beach
  // into the sea, and a beached dory on the sand beside it. They do nothing for
  // most of the game — a standing promise that this island CAN be left (the
  // owner's question, answered in space). Additive decorative geometry, no
  // collision/walkability change, set west of the drowned colonnade.
  {
    // silvered driftwood, not mud (#45): the old 0x8a7050 base multiplied the grain to a
    // near-black slab in any backlight — the pier read as unfinished blockout against the
    // golden sea. Lifted toward weathered bone-grey; the dory + shore scatter share the
    // lift, so the whole driftwood language silvers together.
    const weather = new THREE.MeshStandardMaterial({ color: 0xa2937c, flatShading: false, roughness: 0.95 });
    // weathered driftwood grain on the jetty + dory — the first Bender asset, loaded through
    // the asset manifest (assets.js). The 1:240 model clone shares it (the grain is
    // invisible at that scale).
    applyRelief(weather, 'driftwood', { normalScale: 0.7, strength: 2.2 });   // cracked-plank relief on the jetty + dory
    const jx = -18;
    const jetty = new THREE.Group(); jetty.name = 'jetty';
    const jm4 = new THREE.Matrix4();
    const jQ = new THREE.Quaternion(), jV = new THREE.Vector3(), jS = new THREE.Vector3(1, 1, 1), jE = new THREE.Euler();
    // per-piece timber tone (#45): every run carries instanceColor jitter — sun-bleached
    // warm to salt-cooled grey — so the pier reads as hand-laid boards, not one extrusion
    const jRng = mulberry32(SEED ^ 0x7e77);
    const _jc = new THREE.Color();
    const timberTone = (inst, i) => {
      const t = jRng(), v = 0.86 + jRng() * 0.24;
      inst.setColorAt(i, _jc.setRGB(v * (0.96 + t * 0.06), v * (0.93 + t * 0.03), v * (0.88 + t * 0.02)));
    };
    // the deck: four LENGTHWISE boards with tiny lay/height jitter in place of the old
    // single 2.4x12 slab — the walk surface reads as planking from every angle. UVs
    // repeat 4x along the run so the grain reads at board scale, not one 12m smear.
    const deckGeo = new THREE.BoxGeometry(0.55, 0.14, 12.1);
    { const du = deckGeo.attributes.uv; for (let v = 0; v < du.count; v++) du.setY(v, du.getY(v) * 4); }
    const deckInst = new THREE.InstancedMesh(deckGeo, weather, 4);
    [-0.9, -0.3, 0.3, 0.9].forEach((ox, i) => {
      jm4.compose(jV.set(jx + ox, 1.05 + (jRng() - 0.5) * 0.02, -110.5 + (jRng() - 0.5) * 0.08),
        jQ.setFromEuler(jE.set(0, (jRng() - 0.5) * 0.012, 0)), jS);
      deckInst.setMatrixAt(i, jm4); timberTone(deckInst, i);
    });
    const plankInst = new THREE.InstancedMesh(new THREE.BoxGeometry(2.5, 0.06, 0.5), weather, 7);
    for (let i = 0; i < 7; i++) {
      jm4.compose(jV.set(jx + (jRng() - 0.5) * 0.06, 1.16, -105 - i * 1.85),
        jQ.setFromEuler(jE.set(0, (jRng() - 0.5) * 0.03, 0)), jS);
      plankInst.setMatrixAt(i, jm4); timberTone(plankInst, i);
    }
    // posts wear the sea (#45): a baked tide-stain ring — dark algae-cooled band through
    // the waterline (world y -0.25..0.45), weed-green murk below — as VERTEX colour on the
    // shared cylinder (all instances stand at the same depth, so one bake serves ten).
    const postGeo = new THREE.CylinderGeometry(0.13, 0.16, 4.4, 6);
    {
      const pp = postGeo.attributes.position, pc = new Float32Array(pp.count * 3);
      for (let v = 0; v < pp.count; v++) {
        const wy = pp.getY(v) - 1.1;                       // instance centre y = -1.1
        const stain = smoothstep(0.75, 0.30, wy);          // darkening toward the line
        const soak = smoothstep(0.05, -0.9, wy);           // always-under murk
        let rr = 1 - stain * 0.34 - soak * 0.12;
        let gg = 1 - stain * 0.26 - soak * 0.04;
        let bb = 1 - stain * 0.28 - soak * 0.10;
        pc[v * 3] = rr; pc[v * 3 + 1] = gg; pc[v * 3 + 2] = bb;
      }
      postGeo.setAttribute('color', new THREE.BufferAttribute(pc, 3));
    }
    const postMat = weather.clone();                       // same grain, + the stain bake
    postMat.vertexColors = true;
    const postInst = new THREE.InstancedMesh(postGeo, postMat, 10);
    let pj = 0;
    for (let i = 0; i < 5; i++) {                       // posts to the seabed
      const z = -105.5 - i * 2.6;
      for (const px of [jx - 1.05, jx + 1.05]) {
        jm4.compose(jV.set(px, -1.1, z), jQ.setFromEuler(jE.set(0, jRng() * Math.PI, (jRng() - 0.5) * 0.02)), jS);
        postInst.setMatrixAt(pj, jm4); timberTone(postInst, pj); pj++;
      }
    }
    const bollardInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.18, 1.5, 6), weather, 2);
    [jx - 1.0, jx + 1.0].forEach((px, i) => {
      jm4.makeTranslation(px, 1.75, -116.2); bollardInst.setMatrixAt(i, jm4); timberTone(bollardInst, i);
    });
    for (const inst of [deckInst, plankInst, postInst, bollardInst]) inst.computeBoundingSphere();
    jetty.add(deckInst, plankInst, postInst, bollardInst);
    // a lantern on a post at the jetty's end — the way out, kept lit. Someone
    // leaves a light for a return that may never come (the point-light is in
    // main.js, warm and brightening at night, like a small shore beacon).
    const lpost = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.8, 6), weather);
    lpost.position.set(jx + 0.9, 2.45, -115.4); jetty.add(lpost);
    const larm = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.08), weather);
    larm.position.set(jx + 0.62, 3.75, -115.4); jetty.add(larm);
    const lglobe = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xffe6b0, emissive: 0xffc06a, emissiveIntensity: 1.5, flatShading: true }));
    lglobe.position.set(jx + 0.33, 3.66, -115.4); lglobe.name = 'jettyLantern'; jetty.add(lglobe);
    // a soft halo that blooms around the globe at night — the beacon read as light,
    // not just an emissive dot (driven by `night` in main.js applyAtmosphere). A
    // billboarded Sprite (clone-safe; a Points here would crash instantiateModel).
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: radialGlowTex(), color: 0xffc483, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    halo.position.copy(lglobe.position);
    halo.scale.setScalar(1.4);
    halo.name = 'jettyHalo';
    jetty.add(halo);
    core.add(jetty);

    // a low standing stone at the foot of the jetty, where a body would wash up — its face
    // cut with words worn soft by the sea (the stone_inscription fragment). Granite, like the
    // islet's standing stones; click to read what those who went down left for whoever arrives.
    {
      const ix = jx + 2.0, iz = -103.2;
      const ig = new THREE.BoxGeometry(1.25, 1.7, 0.34);
      const ipa = ig.attributes.position;
      for (let v = 0; v < ipa.count; v++) {                 // taper the crown, like the standing stones
        if (ipa.getY(v) > 0) { ipa.setX(v, ipa.getX(v) * 0.78); ipa.setZ(v, ipa.getZ(v) * 0.8); }
      }
      ig.computeVertexNormals();
      const icols = new Float32Array(ipa.count * 3);
      const iBase = vary(C.stoneOld, r, 0.02, 0.05, 0.06);
      for (let v = 0; v < ipa.count; v++) {
        const t = (ipa.getY(v) / 1.7) + 0.5;
        const cc = iBase.clone().lerp(C.bone, t * 0.35);
        icols[v * 3] = cc.r; icols[v * 3 + 1] = cc.g; icols[v * 3 + 2] = cc.b;
      }
      ig.setAttribute('color', new THREE.BufferAttribute(icols, 3));
      const slab = new THREE.Mesh(ig, matMegalith);   // a carved standing slab, not a course of the tower
      slab.name = 'inscribedStone';
      slab.position.set(ix, heightAt(ix, iz) + 0.62, iz);
      slab.rotation.y = -0.6;       // face turned toward the jetty / the one arriving
      slab.castShadow = true;
      // the keeper measured the rising sea on this stone (keeper_logbook: "I marked the old line on
      // the third step, and the new one has gone over it"). Two chalk tide-lines on the low face —
      // an old, faded one and a newer, brighter one risen above it — environmental storytelling of
      // the flood, in the lower (near-waterline) band of the slab. (loop #147) (children → ride the
      // slab's transform + clone to the chart-table model; 3 tiny transparent quads, no shadow.)
      {
        // LAMPBLACK, not chalk — the keeper marks true things in lampblack (per the lore), and dark
        // marks read on the PALE granite where pale chalk would vanish. The new line darker/heavier.
        const mark = (op) => new THREE.MeshBasicMaterial({ color: 0x241f18, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false });
        const line = (ly, w, op) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.04), mark(op)); m.position.set(0, ly, 0.185); return m; };
        // the stone's base is buried ~0.23 below the beach (center y = ground+0.62, half-height 0.85),
        // so keep both lines in the lower-MID face (local y > -0.62) to stay above the sand.
        slab.add(line(-0.52, 0.82, 0.5));    // the OLD line, faded, lower — last season's reach
        slab.add(line(-0.28, 0.78, 0.82));    // the NEW line, heavier — "the new one has gone over it"
        const tick = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.14), mark(0.72));   // a tally scratch by the new line
        tick.position.set(0.30, -0.28, 0.185); slab.add(tick);
      }
      core.add(slab);
    }

    // a corked bottle half-buried at the wake-up beach — the FIRST readable fragment most
    // players meet (the reading surface, surface tier): a note washed up in the sand, an
    // invitation. A curl of paper shows through the green sea-glass; click to read it.
    {
      const bx = 6.5, bz = -101;
      const bottle = new THREE.Group();
      bottle.name = 'messageBottle';
      const glass = new THREE.MeshStandardMaterial({ color: 0x4a7a5e, transparent: true, opacity: 0.5, roughness: 0.22, metalness: 0 });
      bottle.add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.46, 10), glass));
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.07, 0.2, 8), glass);
      neck.position.y = 0.32; bottle.add(neck);
      const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.08, 8),
        new THREE.MeshStandardMaterial({ color: 0x8a6b3e, roughness: 1 }));
      cork.position.y = 0.45; bottle.add(cork);
      const note = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.34, 6),
        new THREE.MeshBasicMaterial({ color: 0xe8dcc0 }));    // the curl of paper inside
      note.rotation.z = 0.2; bottle.add(note);
      bottle.position.set(bx, heightAt(bx, bz) + 0.08, bz);
      bottle.rotation.z = Math.PI / 2 - 0.22;                 // lying tilted, half-buried
      bottle.rotation.y = 0.6;
      core.add(bottle);
    }

    // the dory — beached on the dry sand, bow toward the water, keeled over
    const dory = new THREE.Group(); dory.name = 'dory';
    dory.position.set(-26, heightAt(-26, -102) + 0.3, -102);
    addCollider(-26, -102, 1.5);   // the beached boat is solid (was walk-through)
    dory.rotation.y = 0.7; dory.rotation.z = 0.13;
    const hg = new THREE.BoxGeometry(1.3, 0.52, 3.1, 1, 1, 5);
    const pa = hg.attributes.position;
    for (let v = 0; v < pa.count; v++) {
      const y = pa.getY(v), z = pa.getZ(v);
      let nx = pa.getX(v);
      nx *= 1 - Math.min(Math.abs(z) / 1.55, 1) * 0.86;   // pinch bow & stern
      if (y < 0) nx *= 0.55;                              // narrow the keel
      pa.setX(v, nx);
    }
    hg.computeVertexNormals();
    const hull = new THREE.Mesh(hg, weather); hull.name = 'doryHull'; dory.add(hull);
    for (const tz of [-0.7, 0.7]) {                      // thwarts (seat planks)
      const thwart = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.07, 0.22), weather);
      thwart.position.set(0, 0.16, tz); dory.add(thwart);
    }
    const oar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 2.5, 6), weather);
    oar.position.set(0.25, 0.28, -0.2); oar.rotation.x = 0.45; oar.rotation.z = 0.5;
    oar.name = 'doryOar'; dory.add(oar);
    core.add(dory);

    // weathered DRIFTWOOD on the bare shore — sea-worn logs the tide left, half-buried in the shingle.
    // Density against the empty beach (the world rang flat). One InstancedMesh (+1 draw); own rng so the
    // world scatter stays byte-identical; reuses the jetty/dory driftwood material + relief.
    {
      const driftInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.15, 1.5, 6), weather, 12);
      const rngW = mulberry32(SEED ^ 0xd71f);
      const dm = new THREE.Matrix4(), dq = new THREE.Quaternion(), de = new THREE.Euler(), dv = new THREE.Vector3();
      let dn = 0;
      for (let i = 0; i < 140 && dn < 12; i++) {
        const x = -46 + rngW() * 78, z = -90 - rngW() * 34;        // south wake-up shore span
        const h = heightAt(x, z);
        if (h < -0.4 || h > 2.6) continue;                          // the shore band (shingle → low sand)
        if (Math.hypot(x + 18, z + 110) < 3.5) continue;            // clear of the jetty footprint
        const s = 0.7 + rngW() * 0.95;
        de.set((rngW() - 0.5) * 0.22, rngW() * TAU, Math.PI / 2 + (rngW() - 0.5) * 0.28);  // lying flat, random yaw + slight tilt
        dq.setFromEuler(de);
        dv.set(x, h - 0.06, z);                                     // half-buried
        dm.compose(dv, dq, new THREE.Vector3(s, s * (0.8 + rngW() * 0.5), s));
        driftInst.setMatrixAt(dn++, dm);
      }
      driftInst.count = dn;
      driftInst.computeBoundingSphere();
      driftInst.name = 'driftwood';
      driftInst.castShadow = true; driftInst.receiveShadow = true;
      core.add(driftInst);
    }

    // TIDELINE WRACK: dark-olive seaweed/kelp clumps the tide cast up along the south waterline. Colour
    // contrast on the pale sand (the world rang tan/green-monotone) + real-shore detail. One InstancedMesh
    // (+1 draw); own rng so the world scatter is byte-identical; flat lumpy clumps laid on the wet sand
    // (naturally flat — no card artifact). Canon: the sea leaves wrack on a shore no one tends.
    {
      // #48: the clumps were flat dark polygons — a subdivided dome + WET specular (the
      // tide just left them) makes them read as heaped weed, not spilled paint
      const wrackMat = new THREE.MeshStandardMaterial({ color: 0x3a4a2e, roughness: 0.32, metalness: 0.0, flatShading: true });
      const wrackInst = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.34, 1), wrackMat, 18);
      const rngK = mulberry32(SEED ^ 0x5eac);
      const km = new THREE.Matrix4(), kq = new THREE.Quaternion(), ke = new THREE.Euler(), kc = new THREE.Color();
      let kn = 0;
      for (let i = 0; i < 220 && kn < 18; i++) {
        const x = -40 + rngK() * 66, z = -98 - rngK() * 22;        // south waterline band
        const h = heightAt(x, z);
        if (h < -0.7 || h > 0.9) continue;                          // the WET tideline (low shingle → waterline)
        const sx = 0.6 + rngK() * 1.0, sz = 0.6 + rngK() * 1.3;
        ke.set(0, rngK() * TAU, 0); kq.setFromEuler(ke);
        km.compose(new THREE.Vector3(x, h - 0.03, z), kq, new THREE.Vector3(sx, 0.16 + rngK() * 0.08, sz));   // flat clump
        wrackInst.setMatrixAt(kn, km);
        kc.setHSL(0.18 + rngK() * 0.12, 0.22 + rngK() * 0.22, 0.14 + rngK() * 0.12);   // dark olive → muddy kelp-brown
        wrackInst.setColorAt(kn, kc);
        kn++;
      }
      wrackInst.count = kn;
      wrackInst.computeBoundingSphere();
      wrackInst.name = 'wrack';
      wrackInst.receiveShadow = true;
      core.add(wrackInst);
    }

    // a wet-PEBBLE apron draped over the south wake-up-beach waterline — the shingle where the sea
    // meets the sand (the campaign's shoreline detail). A thin PlaneGeometry strip y-conformed to
    // the terrain so it never floats/z-fights; the seaward edge sits under the shallow water (wet
    // pebbles), the landward edge on the wet sand. Decorative, no collision. ONE mesh.
    {
      const cx = -8, cz = -102.5, w = 48, d = 8, nx = 40, nz = 10;   // band: waterline (z~-106.5) up the beach (z~-98.5), room for pebbles to gradient into sand
      const ag = new THREE.PlaneGeometry(w, d, nx, nz);
      ag.rotateX(-Math.PI / 2);
      const ap = ag.attributes.position;
      for (let v = 0; v < ap.count; v++) {
        const wx = ap.getX(v) + cx, wz = ap.getZ(v) + cz;
        ap.setX(v, wx); ap.setZ(v, wz);
        ap.setY(v, heightAt(wx, wz) + 0.04);                      // drape on the shore
      }
      ag.computeVertexNormals();
      const apronMat = new THREE.MeshStandardMaterial({ color: 0xb9b3a6, roughness: 0.9, flatShading: true });
      applyRelief(apronMat, 'pebble', { normalScale: 0.5, strength: 2.0 });
      // DE-TILE the pebbles + GRADIENT-BLEND the shingle into the sand (no hard line anywhere).
      //  - de-tile: warp the albedo sample coord with low-freq value-noise so the [53,12] column
      //    lattice dissolves. Compile-safe: sample a warped LOCAL, never mutate the read-only vMapUv.
      //  - blend: pebble DENSITY is full at the waterline and thins to nothing up the beach over a
      //    ~6.5m band, gated by a per-pebble value-noise threshold so the thinning SCATTERS (stray
      //    pebbles strand out on the de-tiled sand beneath) rather than ending on a boundary. The
      //    seaward lip + x-ends are softened too. Early discard, +0 texture fetches (pure ALU noise).
      apronMat.onBeforeCompile = (sh) => {
        // carry world XZ to the fragment stage (geometry positions are baked world coords)
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec2 vApW;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vApW = position.xz;');
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\n' +
            'varying vec2 vApW;\n' +
            'float apHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\n' +
            'float apVN(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);\n' +
            '  float a=apHash(i),b=apHash(i+vec2(1.0,0.0)),c=apHash(i+vec2(0.0,1.0)),d=apHash(i+vec2(1.0,1.0));\n' +
            '  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y); }')
          // shingle->sand density gradient (vApW.y = world z; seaward ~-106, landward ~-96):
          .replace('#include <clipping_planes_fragment>',
            '#include <clipping_planes_fragment>\n' +
            '  float apDens = 1.0 - smoothstep(-104.5, -99.0, vApW.y);            // full at the water, ->0 up the beach\n' +
            '  apDens *= smoothstep(-106.5, -105.3, vApW.y);                      // soften the seaward lip into the water\n' +
            '  apDens *= smoothstep(-32.0, -29.5, vApW.x) * smoothstep(16.0, 13.5, vApW.x);  // soften the two ends\n' +
            '  if (apDens < apVN(vApW * 1.3)) discard;                            // noisy threshold -> scattered thinning\n')
          .replace('#include <map_fragment>',
            '#ifdef USE_MAP\n' +
            '  vec2 apWarp = (vec2(apVN(vMapUv * 0.4), apVN(vMapUv * 0.4 + 19.7)) - 0.5) * 0.7;\n' +
            '  vec4 sampledDiffuseColor = texture2D( map, vMapUv + apWarp );\n' +
            '  diffuseColor *= sampledDiffuseColor;\n' +
            '#endif');
      };
      apronMat.needsUpdate = true;
      const apron = new THREE.Mesh(ag, apronMat);
      apron.name = 'pebbleApron';
      apron.receiveShadow = false;   // flat open-shore pebbles barely catch shadows; skipping the PCF
                                     // sample per fragment cuts the deep strip's grazing-angle GPU cost
      core.add(apron);
    }
  }

  // =================== STANDING STONES (the islet) ==========================
  const stonesGroup = new THREE.Group();
  stonesGroup.name = 'stonesGroup';
  core.add(stonesGroup);
  {
    const SC = new THREE.Vector3(SPOTS.stones.x, 8.8, SPOTS.stones.y);
    for (let i = 0; i < 5; i++) {
      const a = deg(-50 + i * 25); // arc opening north
      const px = SC.x + Math.sin(a) * 6.5, pz = SC.z + Math.cos(a) * 6.5;
      const h = 3.4 + (i % 2) * 0.7 + r() * 0.4;
      const g = new THREE.BoxGeometry(1.1, h, 0.7);
      // taper the top by editing verts
      const pa = g.attributes.position;
      for (let v = 0; v < pa.count; v++) {
        if (pa.getY(v) > 0) {
          pa.setX(v, pa.getX(v) * 0.6);
          pa.setZ(v, pa.getZ(v) * 0.7);
          pa.setY(v, pa.getY(v) + (r() - 0.5) * 0.2);
        }
      }
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, matMegalith);   // raw quarried granite, never coursed
      // vertex colors for the stone material
      const cols = new Float32Array(pa.count * 3);
      const cBase = vary(C.stoneOld, r, 0.02, 0.05, 0.06);
      for (let v = 0; v < pa.count; v++) {
        const t = (pa.getY(v) / h) + 0.5;
        const cc = cBase.clone().lerp(C.bone, t * 0.4);
        // the same mottle the baked granite gets — world position, so neighbouring
        // stones differ from each other and not just within themselves
        cc.multiplyScalar(speck(px + pa.getX(v), pa.getY(v), pz + pa.getZ(v)));
        cols[v * 3] = cc.r; cols[v * 3 + 1] = cc.g; cols[v * 3 + 2] = cc.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      m.position.set(px, heightAt(px, pz) + h / 2 - 0.25, pz);
      addCollider(px, pz, 0.7);   // the standing stones are solid (you played through them)
      m.rotation.y = a + Math.PI + (r() - 0.5) * 0.2;
      m.castShadow = true;
      m.name = `stone${i}`;
      stonesGroup.add(m);

      // glow shell — hums when its tone plays
      const shell = new THREE.Mesh(g.clone(), new THREE.MeshBasicMaterial({
        color: 0x58f2c2, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      shell.scale.setScalar(1.06);
      shell.name = `stoneGlow${i}`;
      m.add(shell);

      // carved music glyph: i dots — etched to read as the clue it is
      // (cellar-carve treatment: bigger, brighter, soft halo), named so
      // _apply can pulse it while the stone's tone sings, and on the
      // INNER face: local +z points at the arc center where the player
      // stands to play — the old -z placement faced the open sea
      const gl = glyphSprite(atlas, [0, 4, 2, 1, 7][i], 0x9adfca, 0.78);
      gl.position.set(0, 0.4, 0.42);
      gl.material.opacity = 0.78;
      gl.name = `stoneMark${i}`;
      m.add(gl);
      const halo = glyphSprite(atlas, [0, 4, 2, 1, 7][i], 0x9adfca, 1.25);
      halo.position.set(0, 0.4, 0.43);
      halo.material.opacity = 0.12;
      m.add(halo);

      // hair-fine letters scratched high on ONE stone's inner face — invisible to the naked
      // eye, revealed only once you hold the reading glass (found-lens reveal → lens_mark_stone).
      if (i === 4) {
        const lm = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.14),
          new THREE.MeshBasicMaterial({ color: 0x6f5630, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
        lm.position.set(0, 1.35, 0.37);
        lm.name = 'lensMarkStone';
        m.add(lm);
      }
    }

    // THE SIXTH STONE (#49 chain: the hidden sixth note) — fallen, lying face-down at the
    // arc's south edge, half-buried in the pad. The five standing stones hum C D E G A; this
    // one knocks dead — its note has "gone somewhere below the tide line" — until the L2
    // Tide-Figure has been WITNESSED (it lays a single B across the water; the water carries
    // it home). Then the fallen stone hums B (STONE_NOTES[5]) and its glyph surfaces, and the
    // keeper's own refused song (E G A D C) can finally finish on it. Same taper-box recipe
    // as the standing five so it reads as kin; clones to the 1:240 model like the rest.
    {
      // east edge of the arc (100°), continuing the circle past stone4 — clear of the
      // drain chamber under the pad's south (its walkable box ends at x≈136) and of the
      // reading-glass islet scatter to the north-east
      const fa = deg(100);
      const fx = SC.x + Math.sin(fa) * 6.5, fz = SC.z + Math.cos(fa) * 6.5;
      const h = 3.1;
      const g = new THREE.BoxGeometry(1.1, h, 0.7);
      const pa = g.attributes.position;
      for (let v = 0; v < pa.count; v++) {
        if (pa.getY(v) > 0) {
          pa.setX(v, pa.getX(v) * 0.6);
          pa.setZ(v, pa.getZ(v) * 0.7);
          pa.setY(v, pa.getY(v) + (r() - 0.5) * 0.2);
        }
      }
      g.computeVertexNormals();
      const cols = new Float32Array(pa.count * 3);
      // a shade darker and mossier than the standing five — it fell long ago
      const cBase = vary(C.stoneOld, r, 0.02, 0.05, 0.06).multiplyScalar(0.82);
      for (let v = 0; v < pa.count; v++) {
        const t = (pa.getY(v) / h) + 0.5;
        const cc = cBase.clone().lerp(C.bone, t * 0.25);
        cols[v * 3] = cc.r; cols[v * 3 + 1] = cc.g; cols[v * 3 + 2] = cc.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      const m = new THREE.Mesh(g, matMegalith);   // the fallen sixth — same quarry as its five siblings
      // lying on its side, crown pointing out of the arc, sunk into the pad
      m.position.set(fx, heightAt(fx, fz) + 0.34, fz);
      m.rotation.set(0, fa + Math.PI + 0.3, Math.PI / 2 - 0.12);
      m.castShadow = true;
      m.name = 'stone5';
      addCollider(fx, fz, 0.9);
      stonesGroup.add(m);
      const shell = new THREE.Mesh(g.clone(), new THREE.MeshBasicMaterial({
        color: 0x58f2c2, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      shell.scale.setScalar(1.06);
      shell.name = 'stoneGlow5';
      m.add(shell);
      // its glyph (the unused sixth figure) — hidden until the note comes home
      // (opacity driven in puzzles _apply off W.flags.tideFigureSeen)
      const gl = glyphSprite(atlas, 6, 0x9adfca, 0.78);
      gl.position.set(0, 0.4, 0.42);
      gl.material.opacity = 0;
      gl.name = 'stoneMark5';
      m.add(gl);
    }

    // the song bird, visible at dawn, perched on stone 2 — the dawn-clue ACTOR deserves
    // better than a cone and a sphere (#44): the same merged vertex-coloured recipe as
    // the shore gulls, songbird proportions — slate-blue mantle, warm breast, real tail
    // and beak. One draw, clones to the model like the rest of the stones.
    const bird = new THREE.Group();
    bird.name = 'songBird';
    {
      const bb = new Baker();
      const M4 = new THREE.Matrix4(), Q4 = new THREE.Quaternion(), E4 = new THREE.Euler(), V4 = new THREE.Vector3(), S4 = new THREE.Vector3();
      const part = (geo, col, x, y, z, rx = 0, sx = 1, sy = 1, sz = 1) => {
        bb.add(geo, M4.compose(V4.set(x, y, z), Q4.setFromEuler(E4.set(rx, 0, 0)), S4.set(sx, sy, sz)), col);
        geo.dispose();
      };
      const slate = new THREE.Color(0x3a4e63), breast = new THREE.Color(0xb98a58),
        dark = new THREE.Color(0x27364a), beakC = new THREE.Color(0x3c444e);
      part(new THREE.SphereGeometry(0.095, 10, 8), breast, 0, 0.10, 0.02, 0, 1, 0.85, 1.4);   // body, breast forward
      part(new THREE.SphereGeometry(0.09, 10, 7), slate, 0, 0.15, -0.02, 0, 0.94, 0.55, 1.32); // mantle / folded wings
      part(new THREE.ConeGeometry(0.05, 0.19, 6), dark, 0, 0.10, -0.2, -1.8);                  // tail, cocked up
      part(new THREE.SphereGeometry(0.062, 10, 8), slate, 0, 0.21, 0.11);                      // head
      part(new THREE.ConeGeometry(0.017, 0.07, 6), beakC, 0, 0.205, 0.18, Math.PI / 2);        // beak
      bird.add(new THREE.Mesh(bb.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.05 })));
    }
    const s2 = stonesGroup.getObjectByName('stone2');
    bird.position.copy(s2.position).add(new THREE.Vector3(0, 2.6, 0));
    bird.rotation.y = 0.6;   // quartering toward the arc's centre, where the listener stands
    stonesGroup.add(bird);

    // THE READING GLASS — a hidden found-item half-buried on the islet among the stones. Take it
    // and the keeper's lampblack marks (lens_mark_*), invisible to the naked eye, reveal across
    // the world. A brass loupe catching the light; hotspot in puzzles.js sets W.flags.readGlass.
    const gx = SPOTS.stones.x + 3.2, gz = SPOTS.stones.y + 5.0;
    const glass = new THREE.Group(); glass.name = 'readGlass';
    const gring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 8, 18), matBrassSolid);
    glass.add(gring);
    const gdisc = new THREE.Mesh(new THREE.CircleGeometry(0.15, 18),
      new THREE.MeshStandardMaterial({ color: 0xcfe8ea, transparent: true, opacity: 0.32, roughness: 0.08, metalness: 0, side: THREE.DoubleSide }));
    gdisc.position.z = 0.004; glass.add(gdisc);
    const ghandle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.34, 6), matBrassSolid);
    ghandle.position.set(0, -0.32, 0); glass.add(ghandle);
    glass.position.set(gx, heightAt(gx, gz) + 0.13, gz);
    glass.rotation.set(Math.PI / 2 - 0.5, 0.4, 0.7);   // tilted, half-buried, catching the light
    glass.castShadow = true;
    core.add(glass);
  }

  // =================== VAULT OF THE LENS (in the stones pad) ================
  {
    const SC = SPOTS.stones;
    const ox = SC.x - 11, oz = SC.y - 4;
    const oy = heightAt(ox, oz);
    // rock outcrop
    const rock = new THREE.IcosahedronGeometry(3.2, 2);
    rockwork.add(rock, place(ox, oy + 1.2, oz, 0.7, 1.3, 0.9, 1.1), mottle(C.stoneOld, C.boneDark));
    rock.dispose();
    // sliding slab door (faces the stones)
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.2, 0.3), matMegalith);   // cut from the outcrop, facing the stones
    const scols = new Float32Array(slab.geometry.attributes.position.count * 3);
    for (let v = 0; v < scols.length / 3; v++) { scols[v * 3] = C.boneDark.r; scols[v * 3 + 1] = C.boneDark.g; scols[v * 3 + 2] = C.boneDark.b; }
    slab.geometry.setAttribute('color', new THREE.BufferAttribute(scols, 3));
    slab.position.set(ox + 2.6, oy + 1.0, oz + 0.4);
    slab.rotation.y = deg(105);
    slab.name = 'vaultDoor';
    core.add(slab);
    // niche + pedestal + the lens
    const ped = new THREE.CylinderGeometry(0.18, 0.26, 0.9, 8);
    stone.add(ped, place(ox + 2.0, oy + 0.45, oz + 0.2), grad(C.stoneOld, C.bone));
    ped.dispose();
    const lensItem = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), matLens.clone());
    lensItem.scale.y = 1.3;
    lensItem.position.set(ox + 2.0, oy + 1.1, oz + 0.2);
    lensItem.name = 'lensItem';
    lensItem.visible = false; // revealed behind the slab; toggled visible when door opens
    core.add(lensItem);
  }

  // =================== THE CHEST (tide-exposed, holds the ruler) ============
  {
    const cx = SPOTS.chest.x, cz = SPOTS.chest.y;
    const cy = heightAt(cx, cz);
    const chest = new THREE.Group();
    chest.name = 'chest';
    chest.position.set(cx, cy + 0.1, cz);
    chest.rotation.y = 0.7;
    chest.rotation.z = 0.08;
    const cbody = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.55, 0.6), matWood);
    chest.add(cbody);
    const lid = new THREE.Group();
    lid.position.set(0, 0.27, -0.3);
    lid.name = 'chestLid';
    const lidM = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.6), matWood);
    lidM.position.set(0, 0.07, 0.3);
    lid.add(lidM);
    chest.add(lid);
    for (const dx of [-0.4, 0.4]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 0.64), matBrassSolid);
      band.position.set(dx, 0, 0);
      chest.add(band);
    }
    // the desk ruler inside
    const rulerItem = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.025, 0.09), matBrassSolid);
    rulerItem.position.set(0, 0.12, 0.05);
    rulerItem.rotation.y = 0.3;
    rulerItem.name = 'rulerItem';
    chest.add(rulerItem);
    core.add(chest);
  }

  // =================== THE DRAIN (hub Phase C — the first tunnel) ===========
  // A collapsed drain on the south of the standing-stones pad drops to a small buried chamber —
  // the first reach of the network the lighthouse cellar will one day join. It FLOODS as you carry
  // the grief deeper: dry at the surface, drowned at the bottom (the flood plane rises with
  // W.level, driven in main.js). One line of the keeper's hand is carved on the wall. The chamber
  // floor sits at y4.0 — above waterY-0.5 at every depth, so it stays walkable while it floods.
  {
    const cx = 132, cz = -150, fy = 4.0, ceilY = 8.5, hw = 4.2;   // chamber under the stones pad (surface 8.8)
    const drain = new THREE.Group(); drain.name = 'drain'; core.add(drain);
    // self-lit stone (emissive) instead of a dynamic light: the scene already runs 9 point lights,
    // and a 10th globally recompiles every material's shader — which overflows the fragment-uniform
    // budget on tighter GPUs and renders the WHOLE scene black (no JS error). Emissive adds no light.
    const dMat = new THREE.MeshStandardMaterial({ color: 0x6f695c, emissive: 0x46423a, emissiveIntensity: 1.0, flatShading: true, roughness: 1, side: THREE.DoubleSide });
    const dp = (w, h, x, y, z, rx, ry) => {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), dMat);
      p.position.set(x, y, z); if (rx) p.rotation.x = rx; if (ry) p.rotation.y = ry;
      drain.add(p);
    };
    const my = (fy + ceilY) / 2, rh = ceilY - fy;
    dp(8.4, 8.4, cx, fy, cz, -Math.PI / 2, 0);              // floor
    dp(8.4, 8.4, cx, ceilY, cz, -Math.PI / 2, 0);           // ceiling
    dp(8.4, rh, cx - hw, my, cz, 0, Math.PI / 2);           // west wall (carries the carved line)
    dp(8.4, rh, cx, my, cz - hw, 0, 0);                     // south wall
    dp(8.4, rh, cx, my, cz + hw, 0, 0);                     // north wall
    dp(2.7, rh, cx + hw, my, cz + 2.85, 0, Math.PI / 2);    // east wall — north of the ramp opening
    dp(2.7, rh, cx + hw, my, cz - 2.85, 0, Math.PI / 2);    // east wall — south of the ramp opening
    // the ramp tunnel up to the surface mouth (walkable floor lives in terrain.js)
    const rx0 = cx + hw, rx1 = 142;
    // 4.85 tall centred at 6.32, NOT 5.4 at 6.6. These are the INSIDE of a buried ramp
    // and they used to top out at y 9.30 while the meadow over them is dead flat at 8.80
    // for the whole 5.8 m run — so half a metre of interior wall stood up out of the
    // grass, and from anywhere near the standing stones it read as a long flat grey slab
    // floating above the field. They tuck 5 cm under the surface now.
    for (const zs of [cz - 1.5, cz + 1.5]) {                // ramp side walls
      const w = new THREE.Mesh(new THREE.PlaneGeometry(rx1 - rx0, 4.85), dMat);
      w.rotation.y = Math.PI / 2; w.position.set((rx0 + rx1) / 2, 6.32, zs);
      drain.add(w);
    }
    const rim = new THREE.TorusGeometry(1.9, 0.3, 8, 18);   // a stone lip around the surface mouth
    rim.rotateX(Math.PI / 2);
    stone.add(rim, place(rx1, 8.85, cz), grad(C.stoneOld, C.boneDark));
    rim.dispose();
    // a dark disc inside the lip so the mouth reads as a shadowed opening from above (not bare sand)
    const throat = new THREE.Mesh(new THREE.CircleGeometry(1.65, 18),
      new THREE.MeshBasicMaterial({ color: 0x0d0c09 }));
    throat.rotation.x = -Math.PI / 2; throat.position.set(rx1, 8.82, cz); drain.add(throat);
    // a shaft of daylight down the mouth (a glowing mesh, NOT a dynamic light — see dMat note)
    const shaftMat = makeBeamMaterial(0xdfeaf0); shaftMat.uniforms.uFlip.value = 1;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.5, 5.2, 10, 1, true), shaftMat);
    shaft.rotation.z = 0.72; shaft.position.set(rx0 + 0.6, 6.4, cz); drain.add(shaft);   // a slanted shaft of it
    // the flood — a plane that rises with the tide-by-depth (driven in main.js by W.level)
    const flood = new THREE.Mesh(new THREE.PlaneGeometry(8.2, 8.2),
      new THREE.MeshStandardMaterial({ color: 0x223a3c, transparent: true, opacity: 0.72, roughness: 0.3, metalness: 0.2, side: THREE.DoubleSide }));
    flood.rotation.x = -Math.PI / 2; flood.position.set(cx, 3.5, cz); flood.name = 'drainFlood';
    drain.add(flood);
    // the one line, carved on the west wall — a mark you read (puzzles.js)
    const mark = glyphSprite(atlas, 4, 0x9adfca, 1.3);
    mark.position.set(cx - hw + 0.12, my, cz); mark.name = 'drainMark';
    drain.add(mark);
    // #55: the INSPECTOR'S TIDE LEDGER — water-swollen, wedged where the west wall meets
    // the floor. The district's official record of the rising sea, filed to a cabinet
    // that floods: the drainFlood plane rises past this shelf with depth, so the ledger
    // drowns as you carry the grief deeper — the tide countersigning it, literally.
    {
      const ledger = new THREE.Group();
      ledger.name = 'drainLedger';
      const cover = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.11, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x3c4448, roughness: 0.95, flatShading: true }));
      ledger.add(cover);
      const leaves = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.085, 0.47),
        new THREE.MeshStandardMaterial({ color: 0xb9b2a0, roughness: 1, flatShading: true }));
      leaves.position.set(0.012, 0.014, 0);
      leaves.rotation.z = 0.1;                       // swollen, the block sprung open
      ledger.add(leaves);
      ledger.position.set(cx - hw + 0.34, fy + 0.09, cz - 1.35);
      ledger.rotation.set(0, 0.35, 0.16);           // wedged, not shelved
      drain.add(ledger);
    }
  }

  // =================== THE GIANT RULER (bridges the chasm) ==================
  {
    const deck = new THREE.Group();
    deck.name = 'rulerWorld';
    deck.visible = false;
    const big = new THREE.Mesh(new THREE.BoxGeometry(28, 1.0, 4.4), matBrassSolid);
    big.position.set(47, 17.95, SPOTS.chasmBridgeZ);
    big.castShadow = true;
    deck.add(big);
    // etched centimetre marks, door-sized
    const markMat = new THREE.MeshBasicMaterial({ color: 0x4a3a1c });
    for (let i = 0; i <= 16; i++) {
      const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.18, i % 2 ? 1.0 : 1.9), markMat);
      mark.rotation.x = -Math.PI / 2;
      mark.position.set(34.2 + i * 1.6, 18.47, SPOTS.chasmBridgeZ - 1.2 + (i % 2 ? 0.4 : 0.85));
      deck.add(mark);
    }
    core.add(deck);
  }

  // =================== THE HATCH + CELLAR VAULT (bluff) ======================
  let cellarMotes = null;
  let vaultDrips = null;
  {
    const hx = SPOTS.hatch.x, hz = SPOTS.hatch.y, hy = 23.5;
    // stone ring + brass lid + four glyph dials
    const ring = new THREE.TorusGeometry(1.5, 0.22, 8, 20);
    ring.rotateX(Math.PI / 2);
    stone.add(ring, new THREE.Matrix4().makeTranslation(hx, hy + 0.1, hz), grad(C.stoneOld, C.boneDark));
    ring.dispose();
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(1.28, 1.28, 0.16, 20), matBrassSolid);
    lid.position.set(hx, hy + 0.14, hz);
    lid.name = 'hatchLid';
    core.add(lid);

    for (let i = 0; i < 4; i++) {
      const a = deg(45 + i * 90);
      const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.18, 10), matBrassSolid.clone());
      dial.position.set(hx + Math.sin(a) * 1.95, hy + 0.16, hz + Math.cos(a) * 1.95);
      dial.name = `dial${i}`;
      dial.userData.glyphIndex = 0;
      core.add(dial);
      // glyph shown on top of the dial
      const gl = glyphSprite(atlas, 0, 0xffd9a0, 0.42);
      gl.rotation.x = -Math.PI / 2;
      gl.position.y = 0.1;
      gl.name = `dialGlyph${i}`;
      dial.add(gl);
    }

    // sunshadow shimmer marker (revealed at golden hour)
    const shimmer = new THREE.Mesh(
      new THREE.CircleGeometry(2.2, 24),
      new THREE.MeshBasicMaterial({ color: 0xffc37a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    shimmer.rotation.x = -Math.PI / 2;
    shimmer.position.set(hx, hy + 0.25, hz);
    shimmer.name = 'hatchShimmer';
    core.add(shimmer);

    // the cellar: stair shaft + room, fully enclosed under the bluff
    const cellar = new THREE.Group();
    cellar.name = 'cellar';
    const cm = new THREE.MeshStandardMaterial({ color: 0x6e685c, flatShading: true, roughness: 0.95, side: THREE.BackSide });
    // stair shaft: under the hatch hole, descending southward
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(3.6, 5.4, 11.4), cm);
    shaft.position.set(hx, hy - 2.8, hz - 3.9);
    cellar.add(shaft);
    // the room — rebuilt from panels (was a closed box) so its EAST wall can
    // open onto the Vault Beneath (#17). Floor / ceiling / south(carve) / west
    // kept; north split to flank the shaft doorway; EAST omitted (the opening).
    // The player stays contained by the unchanged walkableY room region; beyond
    // the opening is solid-bluff walkableY, so they look in but cannot walk out.
    const roomMat = new THREE.MeshStandardMaterial({ color: 0x6e685c, flatShading: true, roughness: 0.95, side: THREE.DoubleSide });
    const cy = hy - 3.03, cz = hz - 13.6;          // room centre (20.47, 18.4)
    const yTop = cy + 2.225, yBot = cy - 2.225;
    const panel = (w, h, x, y, z, rx, ry) => {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), roomMat);
      p.position.set(x, y, z); if (rx) p.rotation.x = rx; if (ry) p.rotation.y = ry;
      cellar.add(p);
    };
    panel(9.4, 8.4, hx, yBot, cz, -Math.PI / 2, 0);            // floor
    panel(9.4, 8.4, hx, yTop, cz, -Math.PI / 2, 0);            // ceiling
    panel(9.4, 4.45, hx, cy, hz - 17.8, 0, 0);                 // south (carve wall)
    // WEST wall: a framed window onto The Room That Disagrees (#18) — mirrors east
    panel(8.4, 0.75, hx - 4.7, yTop - 0.375, cz, 0, Math.PI / 2);       // top lintel
    panel(1.7, 3.7, hx - 4.7, cy - 0.35, hz - 10.15, 0, Math.PI / 2);   // north jamb
    panel(1.9, 3.7, hx - 4.7, cy - 0.35, hz - 16.95, 0, Math.PI / 2);   // south jamb
    panel(2.7, 4.45, hx - 3.35, cy, hz - 9.4, 0, 0);           // north — west of the doorway
    panel(2.7, 4.45, hx + 3.35, cy, hz - 9.4, 0, 0);           // north — east of the doorway
    // EAST wall: a framed window onto the vault — a lintel + two jambs seal the
    // corners; the frame crops the inverted tower's top (the rest lost in dark)
    panel(8.4, 0.75, hx + 4.7, yTop - 0.375, cz, 0, Math.PI / 2);       // top lintel
    panel(1.7, 3.7, hx + 4.7, cy - 0.35, hz - 10.15, 0, Math.PI / 2);   // north jamb
    panel(1.9, 3.7, hx + 4.7, cy - 0.35, hz - 16.95, 0, Math.PI / 2);   // south jamb

    // ----- THE VAULT BENEATH (#17): the sublime abyss ------------------------
    // East of the cellar opens a vast dark cavern; a full-size lighthouse hangs
    // INVERTED from its roof, tapering DOWN to a cold lamp still lit far out over
    // black water — the recursion seen as ARCHITECTURE, not a teleport cut. Seen
    // from the cellar ledge, never entered. (cold base glow: vaultGlow in main.js)
    // the vault-vista DECOR (cavern, black water, the inverted lighthouse) — seen ONLY
    // through the cellar window in the full island; pure decoration, nothing state-driven.
    // Wrapped + named so instantiateModel PRUNES it from the 1:240 model clone, where the
    // big BackSide cavern box otherwise pokes up as a black box on the model island (#67).
    const vaultVista = new THREE.Group(); vaultVista.name = 'vaultVista';
    const vaultMat = new THREE.MeshStandardMaterial({ color: 0x12171c, flatShading: true, roughness: 1, side: THREE.BackSide });
    const cavern = new THREE.Mesh(new THREE.BoxGeometry(56, 44, 50), vaultMat);
    cavern.position.set(hx + 4.7 + 28, 26, cz);    // west face flush with the opening
    vaultVista.add(cavern);
    const vwater = new THREE.Mesh(new THREE.PlaneGeometry(54, 48),
      new THREE.MeshStandardMaterial({ color: 0x070b0e, roughness: 0.35, metalness: 0.25, side: THREE.DoubleSide }));
    vwater.rotation.x = -Math.PI / 2; vwater.position.set(hx + 30, 13.5, cz); vaultVista.add(vwater);
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x3a444e, flatShading: false, roughness: 0.85 });
    const ilx = hx + 30, ilz = cz;                  // the inverted lighthouse, across the void
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 1.1, 24, 16), towerMat);
    tower.position.set(ilx, 34, ilz);               // wide top at the roof (y46), narrow at y22
    vaultVista.add(tower);
    const gallery = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 1.4, 12), towerMat);
    gallery.position.set(ilx, 21.4, ilz); vaultVista.add(gallery);
    const lampDome = new THREE.Mesh(new THREE.ConeGeometry(1.3, 1.6, 12), towerMat);
    lampDome.rotation.x = Math.PI; lampDome.position.set(ilx, 20.0, ilz); vaultVista.add(lampDome);
    const vlamp = new THREE.Mesh(new THREE.SphereGeometry(0.72, 12, 9),
      new THREE.MeshStandardMaterial({ color: 0xdcf3f6, emissive: 0x9fdce8, emissiveIntensity: 6, flatShading: true }));
    vlamp.position.set(ilx, 18.9, ilz); vlamp.name = 'vaultLamp'; vaultVista.add(vlamp);   // a bare ember below the dome tip, still lit
    cellar.add(vaultVista);
    // slow drips falling the full height of the void — scale cues; you read how
    // deep the vault is by how long they fall (SPINE). Returned + animated in main.
    vaultDrips = new THREE.Group(); vaultDrips.name = 'vaultDrips';
    const dripMat = new THREE.MeshStandardMaterial({ color: 0xeaf8fb, emissive: 0x9fdcec, emissiveIntensity: 3, flatShading: true });
    for (let i = 0; i < 11; i++) {
      const drop = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.14, 0.8, 5), dripMat);
      // kept within the window's sightline (z near the opening) so they READ as
      // falling through the void, fanned across its depth in x
      drop.userData = { x: hx + 12 + r() * 34, z: cz + (r() - 0.5) * 8.5, phase: r(), speed: 0.34 + r() * 0.16 };
      drop.position.set(drop.userData.x, 45, drop.userData.z);
      vaultDrips.add(drop);
    }
    cellar.add(vaultDrips);

    // ----- THE ROOM THAT DISAGREES (#18, framed static slice) ----------------
    // West of the cellar, a second study like the one above — but the model on
    // its chart table shows a world this one is NOT in: the sea drained that you
    // never drained, a lamp lit that you never lit, and a window onto weather
    // that isn't yours. The whole game taught you the model tells the truth about
    // the world; this room breaks that. (Frozen for the slice; live ghostState +
    // the contradiction deepening are the follow-up.)
    const dgx = hx - 4.7 - 6;        // study centre, west of the framed window
    const dgMat = new THREE.MeshStandardMaterial({ color: 0x6a6456, flatShading: true, roughness: 0.95, side: THREE.BackSide });
    const study2 = new THREE.Mesh(new THREE.BoxGeometry(12, 5, 11), dgMat);
    study2.position.set(dgx, 20.0, cz); cellar.add(study2);                       // east face flush with the window
    const dgWin = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.7),              // a window onto contradicting weather (static)
      new THREE.MeshStandardMaterial({ color: 0xaebfd2, emissive: 0x718aa6, emissiveIntensity: 0.8, flatShading: true, side: THREE.DoubleSide }));
    dgWin.rotation.y = Math.PI / 2; dgWin.position.set(dgx - 5.92, 20.5, cz); cellar.add(dgWin);
    const dgTable = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.22, 2.6), matWood);
    dgTable.position.set(dgx, 18.75, cz); cellar.add(dgTable);
    for (const lx of [-1.5, 1.5]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.4, 2.4), matWood);
      leg.position.set(dgx + lx, 17.95, cz); cellar.add(leg);
    }
    // the contradicting model: an island whose SEA IS DRAINED (dark exposed
    // seabed, no blue), its little lighthouse LAMP LIT
    const dgIsland = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.55, 0.16, 16),
      new THREE.MeshStandardMaterial({ color: 0xb8ad8e, flatShading: true }));
    dgIsland.position.set(dgx, 18.97, cz); cellar.add(dgIsland);
    const dgSeabed = new THREE.Mesh(new THREE.RingGeometry(1.4, 2.3, 22),
      new THREE.MeshStandardMaterial({ color: 0x2c2820, roughness: 1, side: THREE.DoubleSide }));
    dgSeabed.rotation.x = -Math.PI / 2; dgSeabed.position.set(dgx, 18.9, cz); cellar.add(dgSeabed);
    // a flooded sea over the seabed, faded in INVERSELY to the real tide (#18 live
    // ghostState, driven in puzzles._apply): drained when the real sea is full,
    // flooded when you drain it — the model always shows the opposite
    const dgSea = new THREE.Mesh(new THREE.RingGeometry(1.35, 2.35, 22),
      new THREE.MeshStandardMaterial({ color: 0x2f6f74, transparent: true, opacity: 0, roughness: 0.4, metalness: 0.2, side: THREE.DoubleSide }));
    dgSea.rotation.x = -Math.PI / 2; dgSea.position.set(dgx, 18.95, cz); dgSea.name = 'disagreeSea'; cellar.add(dgSea);
    const dgTower = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.7, 8),
      new THREE.MeshStandardMaterial({ color: 0xd8d2c4, flatShading: true }));
    dgTower.position.set(dgx + 0.35, 19.4, cz - 0.25); cellar.add(dgTower);
    const dgLamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xffe6b0, emissive: 0xffc060, emissiveIntensity: 4.5, flatShading: true }));
    dgLamp.position.set(dgx + 0.35, 19.78, cz - 0.25); dgLamp.name = 'disagreeLamp'; cellar.add(dgLamp);
    // stairs (visual steps) — match the walkable ramp from inside the hole
    for (let i = 0; i < 10; i++) {
      const st = new THREE.BoxGeometry(3.0, 0.35, 0.95);
      stone.add(st, place(hx, hy - 0.45 - i * 0.53, hz + 0.4 - i * 0.92), grad(C.stoneOld, C.boneDark));
      st.dispose();
    }
    // pedestal + plumb bob
    const ped = new THREE.CylinderGeometry(0.22, 0.3, 1.0, 8);
    stone.add(ped, place(hx, hy - 4.7, hz - 13.5), grad(C.stoneOld, C.bone));
    ped.dispose();
    const bobG = new THREE.Group();
    bobG.name = 'plumbBob';
    const bob = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 8), matBrassSolid);
    bob.rotation.x = Math.PI;
    bob.position.set(hx, hy - 4.0, hz - 13.5);
    bobG.add(bob);
    const bobRing = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.015, 5, 10), matBrassSolid);
    bobRing.position.set(hx, hy - 3.8, hz - 13.5);
    bobG.add(bobRing);
    cellar.add(bobG);
    // wall carving: the plumb-line diagram (a hint, drawn in glyphs) —
    // sized to read across the room, with a faint halo so the wall holds it
    const carve = glyphSprite(atlas, 4, 0x9adfca, 1.9);
    carve.position.set(hx, hy - 3.4, hz - 17.2);
    cellar.add(carve);
    const carveHalo = glyphSprite(atlas, 4, 0x9adfca, 3.1);
    carveHalo.material.opacity = 0.16;
    carveHalo.position.set(hx, hy - 3.4, hz - 17.25);
    cellar.add(carveHalo);

    // daylight spills down the open hatch: a dusty shaft of it on the stairs
    const cellarShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 1.7, 5.4, 10, 1, true),
      makeBeamMaterial(0xffe2a8));
    cellarShaft.material.uniforms.uFlip.value = 1;
    cellarShaft.position.set(hx, hy - 2.6, hz);
    cellarShaft.name = 'cellarShaft';
    cellar.add(cellarShaft);

    // dust motes hanging in the spill — through the shaft AND the room
    // (two overlapping interior boxes; both volumes need their floaters)
    const moteR = mulberry32(SEED ^ 0xd057);
    const motePos = [];
    for (let i = 0; i < 64; i++) {
      const inRoom = i % 2;
      motePos.push(
        hx + (moteR() - 0.5) * (inRoom ? 7.8 : 2.6),
        hy - 4.9 + moteR() * (inRoom ? 3.6 : 4.9),
        inRoom ? hz - 10.2 - moteR() * 6.6 : hz - 0.4 - moteR() * 8.6);
    }
    cellarMotes = makeGlowPoints(motePos, 0xffe2a8, 0.22);
    cellarMotes.material.uniforms.uDrift.value = 1;
    cellarMotes.name = 'cellarMotes';
    core.add(cellar);
  }

  // =================== THE CLIFF GLYPHS (beam projection) ====================
  {
    const gp = new THREE.Group();
    gp.name = 'glyphPlane';
    gp.visible = false;
    // hug the bluff's west face: raycast the real terrain mesh eastward at
    // eye height and sit each glyph just proud of the rendered rock
    const baseY = 15, baseZ = 42;
    const rc = new THREE.Raycaster();
    for (let i = 0; i < 4; i++) {
      const z = baseZ + i * 4.4;
      rc.set(new THREE.Vector3(30, baseY, z), new THREE.Vector3(1, 0, 0));
      rc.far = 50;
      const hit = rc.intersectObject(terrain, false)[0];
      const xFace = hit ? hit.point.x : 60;
      const gl = glyphSprite(atlas, GLYPH_CODE[i], 0xffe2a8, 3.4);
      gl.position.set(xFace - 1.4, baseY, z);
      gl.rotation.y = -Math.PI / 2; // facing west, toward the lighthouse
      gp.add(gl);
    }
    core.add(gp);
  }

  // =================== THE HALL GLYPHS (#49: the beam turned to face the deep) =========
  // The cot-journal's deep page promises it: "Tomorrow I will turn it to face the deep."
  // Aim the beam at the drowned hall and — ONLY at L3, when the risen capitals break the
  // surface to catch the light — the same four figures the keeper wrote on the cliff hang
  // in the beam over the seaward aisle. Readable from the L3 shoreline ridge (~25 m north;
  // sightline probed clear). A second, non-linear route to the hatch code. Visibility is
  // driven in puzzles tick (hallLit: lamp + aim + level 3); pruned from the model clone
  // (its parent colonnade is pruned too — the glyphs must not float over nothing).
  {
    const hp = new THREE.Group();
    hp.name = 'hallGlyphs';
    hp.visible = false;
    const XS = [-2, 2, 6, 10];                 // spread ACROSS the hall's width — the ridge reads
    for (let i = 0; i < 4; i++) {              // them as a row; collinear-with-the-aisle they stack
      const gl = glyphSprite(atlas, GLYPH_CODE[i], 0xffe2a8, 3.6);
      gl.position.set(XS[i], 4.9, -111);       // above the risen lintel line, mid-hall
      hp.add(gl);                               // default plane faces +z — toward the north ridge
    }
    core.add(hp);
  }

  // =================== VEGETATION ===========================================
  buildVegetation(core, r);

  // =================== TINY FIGURE (the keeper, on the model) ===============
  // The second person — the keeper one level down, standing on the model's
  // beach. The group sits AT the figure's feet so it can turn and tip in place
  // when it "looks back" (#14); children are local offsets. Exaggerated ~3x so
  // it reads as a luminous speck at 1:240.
  {
    const fig = new THREE.Group();
    fig.name = 'tinyFigure';
    fig.visible = false;
    const fy = heightAt(SPOTS.beach.x, SPOTS.beach.y);
    fig.position.set(SPOTS.beach.x, fy, SPOTS.beach.y);
    fig.userData.baseY = fy;   // the twist's rise (puzzles _apply) lifts from here
    const fb = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 3.4, 6),
      new THREE.MeshStandardMaterial({ color: 0x355560, emissive: 0x58f2c2, emissiveIntensity: 1.8, flatShading: true }));
    fb.position.y = 1.7;
    fig.add(fb);
    const fh = new THREE.Mesh(new THREE.SphereGeometry(0.55, 6, 5),
      new THREE.MeshStandardMaterial({ color: 0xd9c9a8, emissive: 0xffe2a8, emissiveIntensity: 1.0, flatShading: true }));
    fh.position.y = 3.9;
    fig.add(fh);
    // a small brow gives the figure a FRONT (+z) so it visibly turns to face you
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.26, 0.34),
      new THREE.MeshStandardMaterial({ color: 0x1a2730, emissive: 0x0a1a24, emissiveIntensity: 0.5, flatShading: true }));
    brow.position.set(0, 3.98, 0.5);
    fig.add(brow);
    core.add(fig);

    // THE SECOND FIGURE (#53): after the embrace, the model's beach holds TWO — the
    // keeper's cyan speck and a warm amber one beside it, standing together, neither
    // searching. Visible only on the model, only once W.flags.carried (puzzles _apply).
    // Warm where he is cold: your lamp, next to his.
    const comp = new THREE.Group();
    comp.name = 'tinyCompanion';
    comp.visible = false;
    const cy2 = heightAt(SPOTS.beach.x + 1.4, SPOTS.beach.y + 1.1);
    comp.position.set(SPOTS.beach.x + 1.4, cy2, SPOTS.beach.y + 1.1);
    const cb = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.8, 3.0, 6),
      new THREE.MeshStandardMaterial({ color: 0x5c4a30, emissive: 0xffb454, emissiveIntensity: 1.5, flatShading: true }));
    cb.position.y = 1.5;
    comp.add(cb);
    const ch = new THREE.Mesh(new THREE.SphereGeometry(0.5, 6, 5),
      new THREE.MeshStandardMaterial({ color: 0xd9c9a8, emissive: 0xffe2a8, emissiveIntensity: 1.0, flatShading: true }));
    ch.position.y = 3.5;
    comp.add(ch);
    comp.rotation.y = Math.atan2(fig.position.x - comp.position.x, fig.position.z - comp.position.z);   // facing him
    core.add(comp);
  }

  // =================== THE WATCHER (grief given form) =======================
  // The owner's "goblins, and a lot more" — an abstract presence, NOT a monster and
  // NEVER literal biography. A dark hooded figure that only walks the shore once you
  // have gone deep (W.level>=3): it DRIFTS toward you when unobserved and FREEZES when
  // watched, and is resolved NOT by flight or force but by REGARD — look at it steadily
  // and it lifts its head, lets go, and dissolves into a cold rising light. Integration:
  // some of what waits in the deep only wants to be seen. Driven in puzzles _tickWatcher;
  // full-scale, real island only (pruned from the model). Starts hidden + inactive.
  {
    const wfig = new THREE.Group();
    wfig.name = 'watcher';
    wfig.visible = false;
    const wmat = new THREE.MeshStandardMaterial({ color: 0x28323a, emissive: 0x13212a, emissiveIntensity: 0.6, flatShading: true, roughness: 1 });
    const wbody = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.52, 1.5, 7), wmat);
    wbody.position.y = 0.75; wfig.add(wbody);
    const whood = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.62), wmat);
    whood.position.y = 1.5; whood.scale.set(1, 1.3, 1); wfig.add(whood);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x9fe8e0 });   // two cold pinpoints, barely there
    for (const ex of [-0.09, 0.09]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.026, 5, 4), eyeMat);
      eye.position.set(ex, 1.46, 0.26); wfig.add(eye);   // local +z = the figure's FRONT (lookAt aims +z at you)
    }
    const wx = 24, wz = -88;
    wfig.position.set(wx, heightAt(wx, wz), wz);
    core.add(wfig);
  }

  // =================== THE HIGH POOL (#49: the tide-pool round trip) ==================
  // A dry stone pool perched ABOVE the sea on the beach→study walk (ground ~3.6 m), a
  // brass-stoppered phial glinting unreachable in its floor crack. The SEA-STRATA
  // inversion IS the puzzle: descending RAISES the sea — only at L4 (+3.78) does water
  // find the basin (floor 3.42) and float the phial free. Carried up, it dries on the
  // chart table and reads at the surface: see → take (bottom) → read (surface).
  // The basin bakes into staticStone; its rim ROCKS bake into staticRock (granite,
  // not masonry). Only the driven bits are named.
  {
    const PX = -75.5, PZ = -77.0;
    const FLOOR = 3.42;                       // basin floor: below L4 water, above L3's
    // the basin bowl — a squat ring wall + floor disc, sunk so the rocks seat the rim
    // (the wall stays low: its bare top edge read as a floating arc in the first pass)
    const wall = new THREE.CylinderGeometry(1.12, 1.3, 0.4, 12, 1, true);
    stone.add(wall, place(PX, FLOOR + 0.12, PZ), grad(C.stoneOld, C.boneDark));
    wall.dispose();
    // sun-bleached dry floor — a pale basin that catches light, not a dark hole
    const floor = new THREE.CylinderGeometry(1.12, 1.12, 0.08, 12);
    stone.add(floor, place(PX, FLOOR, PZ), grad(C.bone, C.boneDark));
    floor.dispose();
    // weathered rim rocks, a closed ring leaning outward — the pool the sea abandoned
    const pr = mulberry32(SEED ^ 0x9001);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + pr() * 0.35;
      const rx = PX + Math.sin(a) * 1.38, rz = PZ + Math.cos(a) * 1.38;
      const rock = new THREE.IcosahedronGeometry(0.36 + pr() * 0.2, 1);
      rockwork.add(rock, place(rx, heightAt(rx, rz) + 0.16, rz, pr() * TAU, 1, 0.75 + pr() * 0.4, 1), mottle(C.stoneOld, C.bone));
      rock.dispose();
    }
    addCollider(PX, PZ - 1.4, 0.5);           // solid enough to lean on, open on the south side
    addCollider(PX - 1.4, PZ, 0.5);
    addCollider(PX + 1.4, PZ, 0.5);
    // the water that only the descent brings — y snaps to the live waterline in _apply,
    // shown only when the sea stands above the basin floor (L4)
    const pw = new THREE.Mesh(new THREE.CircleGeometry(1.1, 18),
      new THREE.MeshBasicMaterial({ color: 0x2a6a72, transparent: true, opacity: 0.78, depthWrite: false }));
    pw.rotation.x = -Math.PI / 2;
    pw.position.set(PX, FLOOR + 0.1, PZ);
    pw.name = 'poolWater';
    pw.visible = false;
    core.add(pw);
    // the glint in the crack (L1–L3): the phial seen but not reached — brass catching light
    const glint = new THREE.Group();
    glint.name = 'poolGlint';
    const gb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5),
      new THREE.MeshStandardMaterial({ color: 0xd8b25a, emissive: 0xffc36b, emissiveIntensity: 1.6, roughness: 0.3, metalness: 0.8 }));
    glint.add(gb);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: radialGlowTex(), color: 0xffd9a0, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.setScalar(0.7);
    glint.add(halo);
    glint.position.set(PX + 0.35, FLOOR + 0.12, PZ - 0.45);   // far half of the floor — in view
    // from the open south approach (the near half hides behind the front rim rocks)
    core.add(glint);
    // the phial afloat (L4 only): the raised sea lifts it within reach
    const phial = phialProp('poolPhial');
    phial.position.set(PX + 0.2, FLOOR + 0.3, PZ - 0.15);
    phial.visible = false;
    core.add(phial);
  }

  // =================== THE SHRINKING SHORE (#133, AAA-A5) =============================
  // Three pieces of shore the island gives up while you are down in the years — built
  // here in their PRE-LOSS poses; puzzles _apply moves each to its drowned pose as the
  // descent's milestones pass (dove → the jetty's outer arm, L3 → the bench, L4 → the
  // skiff). Decorative, no colliders — loss is the game's grammar, never its penalty.
  // NOT model-pruned: the study's 1:240 model shows the shore shrinking while you are
  // still below, which is how the island tells you before the walk home does.
  {
    const silvered = new THREE.MeshStandardMaterial({ color: 0xa2937c, roughness: 0.95, flatShading: true });
    // the jetty's outer arm — a further reach of the pier, two boards and three posts
    {
      const arm = new THREE.Group();
      arm.name = 'jettyArm';
      const deck = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.13, 5.4), silvered);
      deck.position.set(0, 1.03, 0); deck.castShadow = true; arm.add(deck);
      for (const [px, pz] of [[-0.8, -2.3], [0.8, -2.3], [0, 2.4]]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 3.1, 6), silvered);
        post.position.set(px, -0.5, pz); arm.add(post);
      }
      arm.position.set(-18, 0, -119.4);  // continues the pier seaward (the pier's jx = -18)
      defineProp('jettyArm');
      core.add(arm);
    }
    // the south-shallows bench — two stump legs and a plank, facing the water
    {
      const bench = new THREE.Group();
      bench.name = 'shoreBench';
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.09, 0.42), silvered);
      seat.position.y = 0.46; seat.castShadow = true; bench.add(seat);
      for (const lx of [-0.62, 0.62]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.44, 6), silvered);
        leg.position.set(lx, 0.22, 0); bench.add(leg);
      }
      const bh = heightAt(24, -99);
      bench.position.set(24, Number.isFinite(bh) ? bh : 0.4, -99);
      bench.rotation.y = Math.PI;        // facing the sea
      defineProp('shoreBench');
      core.add(bench);
    }
    // the skiff on its blocks — the OTHER boat, hauled past the tideline long ago
    {
      const skiff = new THREE.Group();
      skiff.name = 'shoreSkiff';
      const hull = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.36, 2.3, 1, 1, 3), silvered);
      const hp = hull.geometry.attributes.position;
      for (let vi = 0; vi < hp.count; vi++) {           // pinch the ends into a hull
        const z = hp.getZ(vi), k = 1 - Math.min(Math.abs(z) / 1.15, 1) * 0.42;
        hp.setX(vi, hp.getX(vi) * k);
      }
      hull.geometry.computeVertexNormals();
      hull.position.y = 0.34; hull.rotation.z = Math.PI; // overturned
      hull.castShadow = true; skiff.add(hull);
      for (const bz of [-0.7, 0.7]) {
        const block = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.2), silvered);
        block.position.set(0, 0.09, bz); skiff.add(block);
      }
      const sh = heightAt(-40, -99.5);
      skiff.position.set(-40, Number.isFinite(sh) ? sh : 0.5, -99.5);
      skiff.rotation.y = 0.5;
      defineProp('shoreSkiff');
      core.add(skiff);
    }
  }

  // =================== HIS ROUNDS (#131, AAA-A3) ======================================
  // The furniture of the keeper's day, findable and performable — one act per era.
  // The acts themselves are wired in puzzles (hotspots + tableaux); these are the
  // three props that did not exist yet: the mooring cleat (the first thing he ever
  // did here), the day's return unsigned (the inspection years' daily line), and
  // the cot lantern (the small light he lit when the great one was done).
  {
    const dory = core.getObjectByName('dory');
    if (dory) {
      const cleat = new THREE.Group();
      cleat.name = 'mooringCleat';
      const iron = new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.8, metalness: 0.35, flatShading: true });
      const hemp = new THREE.MeshStandardMaterial({ color: 0x9a8a62, roughness: 1 });
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.16, 6), iron);
      post.position.y = 0.08; cleat.add(post);
      const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.34, 6), iron);
      horn.rotation.z = Math.PI / 2; horn.position.y = 0.15; cleat.add(horn);
      // the coiled line, figure-eighted over the horns — his turns, still holding
      for (let ci = 0; ci < 3; ci++) {
        const coil = new THREE.Mesh(new THREE.TorusGeometry(0.085 - ci * 0.012, 0.016, 5, 10), hemp);
        coil.rotation.x = Math.PI / 2 + 0.12; coil.position.y = 0.16 + ci * 0.026; cleat.add(coil);
      }
      cleat.position.set(0.42, 0.32, 1.35);
      defineProp('mooringCleat');
      dory.add(cleat);
    }
    const book = core.getObjectByName('logbook');
    if (book) {
      // THE DAY'S RETURN. This was a zero-thickness plane in near-white with no map:
      // lying flat under the sun it clipped to pure white and read, in the owner's
      // words, as "a white box next to the book" — a placeholder, not a document. Two
      // things were wrong. A sheet of paper has an EDGE (a plane has none, so nothing
      // ever catches its thickness and it reads as a decal), and a blank pale rectangle
      // has nothing for the eye to land on, so it renders as the brightest, emptiest
      // thing on the table. Now it is a thin slab carrying the actual printed return:
      // column rules, ruled rows, his hand in the filled ones — and the last line left
      // clean, which is the whole point of the prop ("the day's return, unsigned").
      const sheetTex = (() => {
        const W = 200, H = 262;                       // 0.26 x 0.34 at ~770px/m
        const cv = document.createElement('canvas');
        cv.width = W; cv.height = H;
        const g2 = cv.getContext('2d');
        // NOT near-white. Sun through the study window puts a 0.6-luminance surface
        // clean past the display range — it clips to 255 before bloom is even in the
        // picture. Aged manila sits under it and still reads unmistakably as paper.
        g2.fillStyle = '#a89a78'; g2.fillRect(0, 0, W, H);
        // a little unevenness so it is not a flat swatch — old paper is never one tone
        for (let i = 0; i < 90; i++) {
          const r = 8 + Math.random() * 26;
          g2.fillStyle = `rgba(${Math.random() < 0.5 ? '150,138,110' : '214,205,178'},0.05)`;
          g2.beginPath(); g2.arc(Math.random() * W, Math.random() * H, r, 0, 6.283); g2.fill();
        }
        const ink = 'rgba(58,46,32,';
        g2.strokeStyle = ink + '0.55)'; g2.lineWidth = 1.5;
        g2.strokeRect(11, 11, W - 22, H - 22);                       // the form's border
        g2.beginPath(); g2.moveTo(11, 46); g2.lineTo(W - 11, 46); g2.stroke();   // heading rule
        g2.beginPath(); g2.moveTo(W - 62, 46); g2.lineTo(W - 62, H - 46); g2.stroke(); // value column
        // the heading, and the ruled rows beneath it
        g2.fillStyle = ink + '0.5)';
        g2.fillRect(24, 26, 96, 5); g2.fillRect(W - 54, 26, 30, 5);
        g2.strokeStyle = ink + '0.28)'; g2.lineWidth = 1;
        for (let r = 0; r < 8; r++) {
          const y = 68 + r * 20;
          g2.beginPath(); g2.moveTo(16, y); g2.lineTo(W - 16, y); g2.stroke();
        }
        // his hand: short ink strokes on the filled rows, and a reading in the column.
        // Abstract marks, not letters — at this size real glyphs turn to mush, and a
        // suggestion of a steady hand reads truer than unreadable type.
        g2.strokeStyle = ink + '0.8)'; g2.lineWidth = 2;
        for (let r = 0; r < 6; r++) {
          const y = 68 + r * 20 - 5;
          let x = 22;
          const words = 2 + ((r * 7) % 3);
          for (let w = 0; w < words; w++) {
            const len = 14 + ((r * 13 + w * 29) % 26);
            g2.beginPath(); g2.moveTo(x, y);
            g2.bezierCurveTo(x + len * 0.3, y - 4, x + len * 0.7, y + 3, x + len, y - 1);
            g2.stroke();
            x += len + 7;
            if (x > W - 76) break;
          }
          const v = 16 + ((r * 11) % 14);              // the reading, in the column
          g2.beginPath(); g2.moveTo(W - 54, y); g2.lineTo(W - 54 + v, y - 1); g2.stroke();
        }
        // the signature line: ruled, and EMPTY
        g2.strokeStyle = ink + '0.5)'; g2.lineWidth = 1.5;
        g2.beginPath(); g2.moveTo(24, H - 34); g2.lineTo(W - 70, H - 34); g2.stroke();
        const t = new THREE.CanvasTexture(cv);
        // A COLOUR map must declare sRGB. three defaults a CanvasTexture to linear, so
        // an sRGB-authored image is read as if already linearised and comes out washed
        // out and far too bright — which is exactly how this sheet kept reappearing as
        // a white slab after the material was already correct. Every other colour map
        // in this project sets it (assets.js, `colorSpace: 'srgb'`); this one didn't.
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
        return t;
      })();
      const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.004, 0.29),
        new THREE.MeshLambertMaterial({ map: sheetTex }));   // matte paper: no specular lobe
      sheet.rotation.y = -0.10;                       // laid down slightly askew, as dropped
      // BESIDE the book along the margin, not 0.4 m across it. Offset in local +x it
      // used to land back over the model's sea the moment the book moved inward.
      sheet.position.set(0, 0.032 - 0.010, -0.40);
      sheet.name = 'returnSheet';
      defineProp('returnSheet');
      book.add(sheet);
    }
    const q = core.getObjectByName('quarters');
    if (q) {
      // #132: the records cabinet — a squat iron drawer-chest by the cot's foot, where
      // the District could always have come and found a life added up. FILED artifacts
      // stack inside (the stack mesh scales with the count, driven in puzzles _apply).
      const cab = new THREE.Group();
      cab.name = 'recordCabinet';
      const ironc = new THREE.MeshStandardMaterial({ color: 0x2e3236, roughness: 0.75, metalness: 0.35, flatShading: true });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 0.42), ironc);
      body.position.y = 0.25; cab.add(body);
      const drawer = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.15, 0.4), ironc);
      drawer.position.set(0, 0.33, 0.06);   // the top drawer, pulled a hand's width open
      cab.add(drawer);
      const pull = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.007, 5, 10),
        new THREE.MeshStandardMaterial({ color: 0x7a6a3c, roughness: 0.5, metalness: 0.4 }));
      pull.position.set(0, 0.33, 0.27); cab.add(pull);
      const stack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 0.3),
        new THREE.MeshStandardMaterial({ color: 0xd6cdb2, roughness: 0.95 }));
      stack.name = 'cabinetStack';
      stack.position.set(0, 0.42, 0.06);
      stack.visible = false;
      cab.add(stack);
      cab.position.set(0.1, 0, 1.62);        // by the cot's foot, against the far wall
      cab.rotation.y = -0.15;
      defineProp('recordCabinet');
      q.add(cab);

      const lant = new THREE.Group();
      lant.name = 'cotLantern';
      const tin = new THREE.MeshStandardMaterial({ color: 0x3b3f44, roughness: 0.7, metalness: 0.3, flatShading: true });
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.085, 0.05, 8), tin);
      base.position.y = 0.025; lant.add(base);
      const glass = new THREE.Mesh(new THREE.SphereGeometry(0.062, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0xcfd8d2, roughness: 0.35, transparent: true, opacity: 0.5,
          emissive: 0xffb45a, emissiveIntensity: 0.0 }));
      glass.name = 'cotLanternGlass';
      glass.position.y = 0.1; glass.scale.y = 1.25; lant.add(glass);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.05, 8), tin);
      cap.position.y = 0.2; lant.add(cap);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 5, 10), tin);
      handle.position.y = 0.23; handle.rotation.x = 0.2; lant.add(handle);
      lant.position.set(-1.7, 0, 1.62);   // the floor by the cot's head, where his hand could find it in the dark
      defineProp('cotLantern');
      q.add(lant);
    }
  }

  // =================== THE TIDE GAUGE (#52: region4's landmark) =======================
  // A graduated staff on the lower foreshore, ringed at the EXACT absolute waterlines of
  // the descent — 0 (L1 high water), +1.47 (L2), +2.73 (L3), +3.78 (L4) — and one ring
  // above them all, fresh-cut and pale, for the level that does not exist yet. At L1 the
  // rings climb into air no tide should own (a quiet mystery, like the high pool); each
  // dive the water meets the next ring to the inch; at L4 one dry ring remains. The
  // keeper's logbook line ("I marked the old line on the third step, and the new one has
  // gone over it") made monumental. Visible from the beach walk and the L4 pool ridge
  // (~19m); the shaft is the named click target (a look-read, maxDist ~34 in puzzles).
  {
    const GX = -64, GZ = -93;
    const gy = heightAt(GX, GZ);
    const rootY = gy - 0.5, topY = 5.65;   // rooted below the sand, crown above the unmet ring
    // the shaft — named + clickable (kept OUT of the bakers); weathered iron-dark
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.13, topY - rootY, 8),
      new THREE.MeshStandardMaterial({ color: 0x4a4640, roughness: 0.85, metalness: 0.25, flatShading: true }));
    shaft.position.set(GX, (rootY + topY) / 2, GZ);
    shaft.name = 'tideGauge';
    shaft.castShadow = true;
    core.add(shaft);
    // the four met waterline rings — brass-dark collars at ABSOLUTE heights
    const ringGeo = new THREE.TorusGeometry(0.21, 0.045, 6, 14);
    for (const ry of [0, 1.47, 2.73, 3.78]) {
      const rg = ringGeo.clone(); rg.rotateX(Math.PI / 2);
      brass.add(rg, place(GX, ry, GZ), grad(C.brassDark, C.brassDark));
      rg.dispose();
    }
    // the fifth ring — fresh-cut, pale, set above everything; measured, not yet met
    const top = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.045, 6, 14),
      new THREE.MeshStandardMaterial({ color: 0xd8d2c2, roughness: 0.55, metalness: 0.15, flatShading: true }));
    top.rotation.x = Math.PI / 2;
    top.position.set(GX, 4.83, GZ);
    top.name = 'gaugeTop';
    core.add(top);
    // a small crossbar vane at the crown, seaward — it reads as an instrument, not a post
    const vane = new THREE.BoxGeometry(0.5, 0.05, 0.05);
    brass.add(vane, place(GX, 5.5, GZ, 0.9), grad(C.brassDark, C.brass));
    vane.dispose();
  }

  // ---------- merge static bakers ----------
  // #34: REGIONAL bakes — one island-spanning mesh could never frustum-cull, so every
  // viewpoint drew (and shadow-passed) the whole built world. buildChunks buckets the
  // same bake by each piece's anchor into 120m cells: byte-identical vertices, a handful
  // of meshes sharing the one material, each culling on its own bounds.
  const mkStatic = (baker, mat, name, receive) => {
    const grp = new THREE.Group();
    grp.name = name;
    for (const g of baker.buildChunks(120)) {
      const m = new THREE.Mesh(g, mat);
      m.castShadow = true;
      m.receiveShadow = receive;
      grp.add(m);
    }
    core.add(grp);
    return grp;
  };
  mkStatic(stone, matStone, 'staticStone', true);
  mkStatic(rockwork, matMegalith, 'staticRock', true);   // the outcrop + pool rim: granite, not masonry
  mkStatic(joinery, matJoinery, 'staticJoinery', true); // the study's shelves + books: cloth and board, not wall
  mkStatic(brass, matBrass, 'staticBrass', false);
  mkStatic(rail, matBrassRail, 'staticRail', false);   // the chart rim: the one brass that cannot be a mirror

  // =================== glow particles (NOT cloned into the model) ===========
  // bioluminescent pools along the drowned causeway
  const bioPos = [];
  {
    const A = SPOTS.causewayA, B = SPOTS.causewayB;
    for (let i = 0; i < 900; i++) {
      const t = r();
      const x = lerp(A.x, B.x, t) + (r() - 0.5) * 26;
      const z = lerp(A.y, B.y, t) + (r() - 0.5) * 26;
      const h = heightAt(x, z);
      if (h < -0.3 && h > -7) bioPos.push(x, h + 0.15, z);
    }
  }
  const biolume = makeGlowPoints(bioPos, 0x58f2c2, 0.5);
  biolume.name = 'biolume';

  // fireflies among the trees at night
  const flyPos = [];
  for (let i = 0; i < 240; i++) {
    const a = r() * TAU, d = 30 + r() * 110;
    const x = SPOTS.mainCenter.x + Math.sin(a) * d, z = SPOTS.mainCenter.y + Math.cos(a) * d;
    const h = heightAt(x, z);
    if (h > 2 && h < 16) flyPos.push(x, h + 0.8 + r() * 2.2, z);
  }
  const fireflies = makeGlowPoints(flyPos, 0xffc36b, 0.35);
  fireflies.material.uniforms.uDrift.value = 1;
  fireflies.name = 'fireflies';

  // ---- the lampblack micro-marks (#54): nine more lines, written small on the working
  // things of his life. Attached LAST — every anchor exists now — as CHILDREN of named
  // props so they ride whatever the prop does (the wheel spins, the buoy lists, the bell
  // swings). Same sepia-ink recipe as the two LORE marks; opacity 0 until the glass is
  // held (driven in puzzles _apply). Geometry only — words in content.js LAMPBLACK.
  const LAMPBLACK_SITES = [
    { id: 'lmValve', anchor: 'valveWheel',   pos: [0, 0, 0.075],        rot: [0, 0, 0],            size: [0.24, 0.075] },
    { id: 'lmBox',   anchor: 'musicBox',     pos: [0, -0.02, 0.155],    rot: [0, 0, 0],            size: [0.24, 0.07] },
    { id: 'lmChest', anchor: 'chest',        pos: [0, 0.05, 0.305],     rot: [0, 0, 0],            size: [0.26, 0.08] },
    { id: 'lmDory',  anchor: 'doryHull',     pos: [-0.62, 0.24, 0.2],   rot: [0, -Math.PI / 2, 0], size: [0.3, 0.1] },
    { id: 'lmJetty', anchor: 'jettyLantern', pos: [0.57, -1.46, 0.1],   rot: [0, 0, 0],            size: [0.13, 0.07] },  // on the post below the arm
    { id: 'lmStair', anchor: 'stairFoot',    pos: [0, 0.08, 0.36],      rot: [0, 0, 0],            size: [0.26, 0.08] },  // the bottom step's riser
    { id: 'lmBell',  anchor: 'bell',         pos: [0, -0.12, -0.38],    rot: [0, Math.PI, 0],      size: [0.2, 0.07] },   // outside the dome radius
    { id: 'lmBuoy',  anchor: 'bellBuoy',     pos: [0, 0.15, 0.57],      rot: [0, 0, 0],            size: [0.6, 0.2] },
    { id: 'lmDrain', anchor: 'drainMark',    pos: [-0.2, -0.6, 0.002],  rot: [0, 0, 0],            size: [0.3, 0.1] },    // under the carved line, clear of the wall corner
  ];
  for (const s of LAMPBLACK_SITES) {
    const a = core.getObjectByName(s.anchor);
    if (!a) continue;
    const mk = new THREE.Mesh(new THREE.PlaneGeometry(s.size[0], s.size[1]),
      new THREE.MeshBasicMaterial({ color: 0x6f5630, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    mk.position.set(...s.pos);
    mk.rotation.set(...s.rot);
    mk.name = s.id;
    a.add(mk);
  }

  // =================== THE OTHER HANDS (#50) ==========================================
  // Three written presences the keeper's own text promised: the CLIMBERS' five scratch
  // marks down the descent's spine (glass-revealed, like all small true things), the
  // CONGREGATION's three carved lines on the drowned hall (physical, monumental — you
  // can SEE the bands; reading them needs L3's risen capitals + the glass across the
  // water), and the INSPECTOR's two further papers (the ambiguity engine: real, or the
  // keeper's invented witness — every artifact must survive both readings).
  {
    const scratchMat = () => new THREE.MeshBasicMaterial({ color: 0x8f8676, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    const scratch = (name, w, h) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), scratchMat());
      m.name = name;
      return m;
    };
    // cmTallies — under the hair-fine letters on stone4 (exactly where the deep page says)
    const s4 = core.getObjectByName('stone4');
    if (s4) {
      const t = scratch('cmTallies', 0.4, 0.16);
      t.position.set(0, 0.92, 0.385);
      s4.add(t);
    }
    // cmFormal — low on the tower wall behind the stair foot (the descent's threshold)
    {
      const aa = 200 * Math.PI / 180;
      const t = scratch('cmFormal', 0.5, 0.12);
      t.position.set(LH.x + Math.sin(aa) * 2.72, LH.y + 0.55, LH.z + Math.cos(aa) * 2.72);
      t.rotation.y = aa + Math.PI;   // facing back into the room
      core.add(t);
    }
    // cmPlain — a half-buried slate near the kelp slate (region2: exists only at L2)
    {
      const px = 10.5, pz = -99.5;
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x4c5350, roughness: 1, flatShading: true }));
      base.position.set(px, (Number.isFinite(heightAt(px, pz)) ? heightAt(px, pz) : 0) + 0.1, pz);
      base.rotation.y = 0.7;
      region2.add(base);
      const t = scratch('cmPlain', 0.42, 0.12);
      t.position.set(0, 0.17, 0.0);
      t.rotation.x = -Math.PI / 2;
      base.add(t);
    }
    // cmUnfinished — low against the cairn on the L3 bluff (region3)
    {
      const t = scratch('cmUnfinished', 0.46, 0.12);
      const cy = Number.isFinite(heightAt(92.2, 31.9)) ? heightAt(92.2, 31.9) : 0;
      t.position.set(92.2, cy + 0.34, 31.9);
      t.rotation.y = Math.atan2(92.2 - 91.5, 31.9 - 31.5);   // facing away from the cairn's heart
      region3.add(t);
    }
    // cmChild — small letters close to the cold floor of the source, near his last note (region4)
    {
      const t = scratch('cmChild', 0.34, 0.12);
      const cy = Number.isFinite(heightAt(-84.6, -42.7)) ? heightAt(-84.6, -42.7) : 13.5;
      t.position.set(-84.6, cy + 0.02, -42.7);
      t.rotation.x = -Math.PI / 2;
      t.rotation.z = 0.4;
      region4.add(t);
    }
    // the congregation's three carved bands — physical, always visible, on the capitals'
    // north faces (toward the ridge a reader stands on at L3); children of the gallery so
    // they rise with it and prune from the model with it
    {
      const gallery = core.getObjectByName('drownedGallery');
      if (gallery) {
        const bandMat = new THREE.MeshBasicMaterial({ color: 0x232a30, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
        const sites = [['cgRoof', 0, -108], ['cgCount', 8, -111.5], ['cgLight', 0, -115]];
        for (const [nm, bx, bz] of sites) {
          const band = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.32), bandMat.clone());
          band.position.set(bx, 1.45, bz + 0.97);
          band.name = nm;
          gallery.add(band);
        }
      }
    }
    // (the inspector's two papers build through the #69 fragment factory below)
  }

  // #69: THE FRAGMENT FACTORY — a LORE entry carrying `place` becomes a world object
  // here and a reader hotspot in puzzles with NO further engineering: content is
  // writing again, not plumbing. Stock props by style; names register through the
  // #70 seam so the boot assert covers them.
  {
    const STOCK = {
      sheet: () => new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.32),
        new THREE.MeshStandardMaterial({ color: 0xd9d2bc, roughness: 0.95, side: THREE.DoubleSide })),
      fold: () => new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.14),
        new THREE.MeshStandardMaterial({ color: 0xcfc7ae, roughness: 0.95 })),
    };
    for (const [id, lore] of Object.entries(LORE)) {
      const pl = lore.place;
      if (!pl) continue;
      // prop 'none': the object is built where its geometry is derived (the lettered
      // shelf's proxy comes off the same LH and a0 as the boards). The entry still gets
      // its reader hotspot from puzzles' half of the factory.
      if (pl.prop === 'none') continue;
      const mesh = (STOCK[pl.prop] || STOCK.sheet)();
      mesh.position.set(pl.pos[0], pl.pos[1], pl.pos[2]);
      if (pl.rx) mesh.rotation.x = pl.rx;
      if (pl.ry) mesh.rotation.y = pl.ry;
      if (pl.rz) mesh.rotation.z = pl.rz;
      mesh.name = 'lore_' + id;
      defineProp('lore_' + id);
      ((pl.parent && core.getObjectByName(pl.parent)) || core).add(mesh);
    }
  }

  return { core, waterMat, modelAnchor, biolume, fireflies, motes: cellarMotes, galleryGlow, l3motes, vaultDrips };
}

// ---------------------------------------------------------------------------
function buildVegetation(core, r) {
  // keep-outs: floors the scatter must respect. Discs match the structures
  // built in buildWorld — lighthouse base (r 5.2 + wall + apron) and the
  // annex (attached at azimuth 15°, baseR + 2.2 from the tower, r 2.8).
  const LHX = SPOTS.lighthouse.x, LHZ = SPOTS.lighthouse.y;
  const aa = 15 * Math.PI / 180;
  const ANX = LHX + Math.sin(aa) * 7.4, ANZ = LHZ + Math.cos(aa) * 7.4;
  const KEEPOUT = [
    [LHX, LHZ, 7.2], [ANX, ANZ, 4.6],
    [SPOTS.stones.x, SPOTS.stones.y, 9.0],  // pad + stone arc: the dance floor stays bare
    [SPOTS.stones.x - 11, SPOTS.stones.y - 4, 5.0], // vault outcrop + slab swing
    [SPOTS.chest.x, SPOTS.chest.y, 3.0],
  ];
  const open = (x, z) => {
    for (const [kx, kz, kr] of KEEPOUT) if (Math.hypot(x - kx, z - kz) < kr) return false;
    return true;
  };
  // grass can't grip a cliff: gradient ~1.0 is already steeper than any
  // walkable meadow (player limit 1.35); the chasm and sea cliffs are >2
  const grade = (x, z) => {
    const e = 0.7;
    return Math.hypot(heightAt(x + e, z) - heightAt(x - e, z),
                      heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
  };
  // --- pines, wind-bent ---
  // A TRUNK, not a lathe-turned pole. It was a perfect cylinder meeting the grass at a
  // hard circular edge, which is the giveaway on every tree in the stand at once: real
  // trunks flare into buttress roots at the base, are not round in section, and do not
  // stand plumb. 12 radial segments (from 10) and 3 height rings give the flare something
  // to shape; that is +28 triangles on a geometry shared by every instance.
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.26, 2.6, 12, 3);
  trunkGeo.translate(0, 1.3, 0);
  {
    const tp = trunkGeo.attributes.position;
    for (let v = 0; v < tp.count; v++) {
      const x = tp.getX(v), y = tp.getY(v), z = tp.getZ(v);
      const rad = Math.hypot(x, z);
      if (rad < 1e-4) continue;                       // the cap centres
      const ang = Math.atan2(z, x);
      // buttress roots: the bottom 55 cm swells, and unevenly — five soft ribs, so the
      // base spreads into the ground instead of being stamped out of it
      const flare = 1 + Math.max(0, 1 - y / 0.55) ** 1.6 * (0.30 + 0.34 * Math.cos(ang * 5 + 1.1));
      // out of round, and gently bowed — no two sides of a trunk are the same width
      const wob = 1 + (vnoise(ang * 1.7, y * 0.9) - 0.5) * 0.17;
      const bow = Math.sin(y * 0.8 + 0.6) * 0.055;
      tp.setX(v, x * flare * wob + bow);
      tp.setZ(v, z * flare * wob);
    }
    trunkGeo.computeVertexNormals();
  }
  // A conifer, not a stack of smooth cones (loop #125): OVERLAPPING tiers whose base rims are
  // jagged + drooped, so the silhouette reads as ragged frond-skirts instead of clean geometry.
  // Factored (loop #139) so TWO silhouettes can share the builder — a broad fir and a slim spruce.
  // Fidelity pass (owner: "polygons are low"): 16 radial segments + a jittered mid ring (was 9
  // flat facets), SMOOTH normals, and baked per-vertex shading — dark toward the trunk, bright at
  // the frond tips — so each tier has interior depth before the foliage texture even lands.
  // (Tree POSITIONS are untouched: the scatter draws from the shared r() stream, not jr().)
  // A WHORL, not a surface of revolution (owner: "get the trees to look a lot more
  // natural"). The tiers were cones with a jagged base rim, which is why the read at any
  // distance was folded paper: a cone's sides are big flat panels, and every panel on
  // every tree caught the light as one flat value. Three things change that, all of them
  // baked once at build time and free at runtime:
  //
  //   LOBES. A conifer's tier is a WHORL of branches radiating from the trunk, so its
  //   plan is a rosette and not a circle. Modulating the radius by cos(angle * branches)
  //   scallops each tier into distinct branch arms with real gaps between them — the
  //   single biggest change to the silhouette, and it costs nothing but a cosine.
  //   NOISE. Every vertex is then pushed by smooth value noise, so no tier is a clean
  //   surface of anything and the panels stop being planar.
  //   DROOP BY REACH. The old droop was uniform random; a real branch bends more the
  //   further out it reaches, so it now scales with radius and the arms sag at the tips.
  //
  // aRim (0 at the axis → 1 at the frond tips) rides along as a custom attribute for the
  // fragment shader — it is what lets the rim dissolve raggedly without turning the whole
  // canopy to lace. mergeGeometries has to be told to carry it (see util.js).
  const makeCanopy = ({ n, baseR, taperK, tierH, spacing, lean, jag, droop, seedXor, seg = 16, hseg = 2 }) => {
    const jr = mulberry32(SEED ^ seedXor);
    const parts = [];
    const lobes = 5 + Math.floor(jr() * 4);                 // branch arms per whorl
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const radius = baseR * (1 - t * taperK);              // wide skirt → narrow crown
      const cone = new THREE.ConeGeometry(radius, tierH, seg, hseg, true);   // openEnded (DoubleSide mat)
      const p = cone.attributes.position;
      const shade = new Float32Array(p.count * 3);
      const rim = new Float32Array(p.count);
      const phase = jr() * TAU;                             // each tier's arms point elsewhere
      // a coarser lobe count on the far LOD, or 6 radial segments cannot resolve the arms
      // and the scallop turns into a wobble
      const lb = seg >= 12 ? lobes : Math.min(lobes, 3);
      for (let v = 0; v < p.count; v++) {
        const y = p.getY(v);
        const x0 = p.getX(v), z0 = p.getZ(v);
        const ang = Math.atan2(z0, x0);
        // the whorl: arms out, gaps between them. Full strength at the rim, fading to
        // nothing at the crown so the tier still meets the trunk.
        const rTier = Math.hypot(x0, z0) / Math.max(radius, 1e-3);
        const lobe = 1 + Math.cos(ang * lb + phase) * 0.20 * rTier;
        p.setX(v, x0 * lobe); p.setZ(v, z0 * lobe);
        if (y < -tierH / 2 + 0.02) {                        // base-rim vertices → frond tips
          const x = p.getX(v), z = p.getZ(v);
          const f = 1 + (jr() - 0.5) * jag;                 // radial jag
          p.setX(v, x * f); p.setZ(v, z * f);
          // a branch bends further the further it reaches — droop scaled by the arm's
          // own length, so the long arms sag and the short ones hold
          p.setY(v, y - jr() * droop * (0.45 + 0.85 * lobe));
        } else if (Math.abs(y) < tierH * 0.26) {            // mid ring → gentle organic bulge
          const f = 1 + (jr() - 0.5) * jag * 0.45;
          p.setX(v, p.getX(v) * f); p.setZ(v, p.getZ(v) * f);
        }
        // and break the panels: smooth noise on the vertex itself, so no face is planar
        const nx = p.getX(v), ny = p.getY(v), nz = p.getZ(v);
        const d = (vnoise(nx * 1.9 + ny * 0.7, nz * 1.9 - ny * 0.5) - 0.5) * 0.22 * radius;
        p.setX(v, nx + d); p.setZ(v, nz + d * 0.8);
        p.setY(v, ny + (vnoise(nz * 2.3, nx * 2.3) - 0.5) * 0.10 * tierH);

        // baked canopy depth: luminance by distance from the axis (≈1.0 mean, so the
        // per-instance HSL tones keep their tuned brightness)
        const rr = Math.min(Math.hypot(p.getX(v), p.getZ(v)) / Math.max(radius, 1e-3), 1.15);
        const s = 0.68 + rr * 0.55;
        // and a warm/cool split across that depth: needle tips catch the sun and read
        // yellow-green, the shaded interior reads blue-green. Grey shading is what made
        // the canopy one flat colour no matter how the per-tree tone was varied.
        shade[v * 3] = s * (0.96 + rr * 0.10);
        shade[v * 3 + 1] = s;
        shade[v * 3 + 2] = s * (1.08 - rr * 0.14);
        rim[v] = Math.min(rr, 1);
      }
      cone.setAttribute('color', new THREE.BufferAttribute(shade, 3));
      cone.setAttribute('aRim', new THREE.BufferAttribute(rim, 1));
      cone.rotateY(i * 1.1);                                 // de-align facets/jags between tiers
      cone.translate(lean * i, 1.85 + i * spacing, 0);       // overlapping stack, gentle lee-lean
      cone.computeVertexNormals();
      parts.push(cone);
    }
    const g = mergeGeometries(parts, ['aRim']);
    for (const p of parts) p.dispose();
    return g;
  };
  // A: the broad fir (byte-identical to the loop-#125 canopy — same seed + params, so existing
  // trees don't move). B: a slimmer, taller spruce — narrower skirt, tighter taper, one more tier.
  // FOUR silhouettes, not two. A stand of two shapes plus a scale multiplier still reads
  // as a grove of clones, because the eye reads OUTLINE first and there were only two
  // outlines in the entire forest. The two new ones are not more of the same: a young
  // tree is a different PROPORTION (dense, tight tiers, no bare trunk), and an old
  // storm-worked one is a different HABIT (leaning hard downwind, tiers spaced apart so
  // the sky shows between them the way a thinning crown does).
  //
  // `weight` is how much of the stand wears it, and `scale` is baked into the instance
  // matrix so a sapling is genuinely a sapling and not a full-grown tree drawn small.
  const CANOPY = [
    { name: 'broad fir',  weight: 0.30, scale: 1.00, p: { n: 5, baseR: 1.75, taperK: 0.82, tierH: 1.55, spacing: 0.86, lean: 0.26, jag: 0.50, droop: 0.40, seedXor: 0x7a3c } },
    { name: 'slim spruce', weight: 0.28, scale: 1.00, p: { n: 6, baseR: 1.28, taperK: 0.90, tierH: 1.50, spacing: 0.96, lean: 0.16, jag: 0.42, droop: 0.34, seedXor: 0x3b71 } },
    { name: 'sapling',    weight: 0.24, scale: 0.52, p: { n: 4, baseR: 1.05, taperK: 0.62, tierH: 1.15, spacing: 0.62, lean: 0.08, jag: 0.58, droop: 0.24, seedXor: 0x21c9 } },
    // lean is applied PER TIER (lean * i), so it compounds: 0.62 threw this one's crown
    // 3.1 units sideways over six tiers and it read as falling over, not wind-worked
    { name: 'storm elder', weight: 0.18, scale: 1.14, p: { n: 6, baseR: 1.62, taperK: 0.90, tierH: 1.70, spacing: 1.16, lean: 0.30, jag: 0.64, droop: 0.56, seedXor: 0x6f04 } },
  ];
  for (const c of CANOPY) {
    c.geo = makeCanopy(c.p);
    // #6: the FAR silhouette — same builder, same tier stack, 6 radials x 1 ring
    c.farGeo = makeCanopy({ ...c.p, seg: 6, hseg: 1 });
  }
  const canopyGeoA = CANOPY[0].geo;   // kept as names for the comments below
  const canopyGeoB = CANOPY[1].geo;
  // the FAR pair is built from the same table above (6 radials x 1 ring, ~63% fewer
  // canopy verts). The swap lives at 120-130m, inside the haze melt (120→300m), where a
  // facet is a dozen hazed pixels — the silhouette carries, the cost doesn't.

  const spots = [];
  for (let i = 0; i < 600 && spots.length < 130; i++) {
    const a = r() * TAU, d = 25 + r() * 130;
    const x = SPOTS.mainCenter.x + Math.sin(a) * d;
    const z = SPOTS.mainCenter.y + Math.cos(a) * d;
    const h = heightAt(x, z);
    if (h < 3.5 || h > 15) continue;
    if (Math.hypot(x - SPOTS.lighthouse.x, z - SPOTS.lighthouse.y) < 16) continue;
    spots.push([x, h - 0.2, z]);
  }
  // a few on the islet
  for (let i = 0; i < 40 && spots.length < 140; i++) {
    const a = r() * TAU, d = r() * 30;
    const x = SPOTS.islet.x + Math.sin(a) * d, z = SPOTS.islet.y + Math.cos(a) * d;
    const h = heightAt(x, z);
    if (h > 2.5 && h < 8 && Math.hypot(x - SPOTS.stones.x, z - SPOTS.stones.y) > 14) spots.push([x, h - 0.2, z]);
  }

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6b48, flatShading: false, roughness: 0.9 }); // base lightened so the bark albedo multiplies to bark, not mud
  applyRelief(trunkMat, 'bark', { normalScale: 0.85, strength: 2.0, roughness: 0.95, normalFrom: 'bark_height' });   // #138: TRUE furrow relief (Bender heightmap), bark albedo unchanged
  // smooth-shaded + vertexColors: the baked tier shading (dark core → bright frond tips)
  // multiplies under the per-instance HSL tone and the foliage-texture dapple
  const canopyMat = new THREE.MeshStandardMaterial({ flatShading: false, roughness: 0.85, vertexColors: true, side: THREE.DoubleSide });
  canopyMat.color = new THREE.Color(0x6d7a3e);
  // wind sway via shader patch
  canopyMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = { value: 0 };
    sh.uniforms.uHaze = { value: new THREE.Color(0xcfe3e8) };
    sh.uniforms.uFoliage = { value: getTexture('foliage') };   // stylized canopy texture (no UVs → object-space sample)
    sh.uniforms.uFolAmt = { value: 0.25 };   // was 0.5 — the asset is a painterly STARBURST motif and at half strength it read as fireworks up close; the procedural needle grain below carries the fine detail now
    sh.uniforms.uFolScale = { value: 1.0 };
    sh.uniforms.uFringe = { value: 0.92 };   // how much of the frond TIPS frays away (a gradient — see the fray block)
    canopyMat.userData.shader = sh;
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vLPos = position;                       // object-space coords for the foliage sample (pre-wind)
      vRim = aRim;                            // 0 at the trunk -> 1 at the frond tips
      #ifdef USE_INSTANCING
        float windSeed = instanceMatrix[3].x * 0.13 + instanceMatrix[3].z * 0.17;
        // the TIPS move most: a branch is a cantilever, so sway scales with how far out
        // the vertex sits as well as how high. A whole canopy sliding sideways as one
        // rigid lump is what made the old wind read as a wobble rather than a breeze.
        float gust = sin(uTime * 1.4 + windSeed) + 0.35 * sin(uTime * 2.7 + windSeed * 1.9);
        transformed.x += gust * 0.11 * (0.35 + aRim) * smoothstep(1.0, 5.5, transformed.y);
        transformed.z += sin(uTime * 1.1 + windSeed * 2.3) * 0.06 * (0.35 + aRim) * smoothstep(1.0, 5.5, transformed.y);
      #endif
    `).replace('void main() {', 'uniform float uTime;\nattribute float aRim;\nvarying vec3 vLPos;\nvarying float vRim;\nvoid main() {');
    // (1) a STYLIZED foliage texture breaks the flat uniform green — sampled object-space (the
    // cones have no UVs) as a LUMINANCE multiply so each canopy keeps its hue + low-poly silhouette
    // but gains dappled value variation. (2) distant canopies melt toward the grade's haze before
    // global fog reaches them — softens the hard low-poly pop at the tree line. Fragment-only.
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', `uniform vec3 uHaze;
        uniform sampler2D uFoliage; uniform float uFolAmt; uniform float uFolScale;
        uniform float uFringe;
        varying vec3 vLPos; varying float vRim;
        float chash(vec2 p){p=fract(p*vec2(234.34,435.345));p+=dot(p,p+34.23);return fract(p.x*p.y);}
        float cnoise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.0-2.0*f);
          float a=chash(i),b=chash(i+vec2(1,0)),c=chash(i+vec2(0,1)),d=chash(i+vec2(1,1));
          return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);}
        void main() {`)
      // THE RAGGED EDGE, and it is the whole reason a low-poly conifer reads as folded
      // paper. A tier's outline is a POLYGON — straight segments between vertices — and no
      // amount of shading hides a straight edge against the sky. A real conifer's outline
      // is needles, so it has no edge at all, it has a fringe.
      //
      // So the outer band of every tier DISSOLVES: high-frequency object-space noise, and
      // fragments below the cut are discarded. Gated hard on vRim (0 at the trunk, 1 at the
      // frond tips) so only the last quarter of each arm frays — without that gate the
      // whole canopy turns to lace and you can see the sky through the middle of the tree.
      // Costs one noise per canopy fragment and no geometry at all.
      .replace('#include <clipping_planes_fragment>', `
        #include <clipping_planes_fragment>
        // A GRADIENT, not a band. The first version cut on a fixed threshold across the
        // outer quarter of the arm, which speckled holes through solid foliage and read as
        // moth-eaten rather than needled. What an edge of needles actually does is DISSOLVE:
        // nearly solid a little way in, almost nothing at the very tip. So the cut rises
        // steeply with vRim and the fringe fades out instead of being punched through.
        float frayN = cnoise(vec2(vLPos.x + vLPos.y * 0.41, vLPos.z - vLPos.y * 0.33) * 64.0)
                    * 0.55 + cnoise(vec2(vLPos.z - vLPos.y * 0.2, vLPos.x) * 148.0) * 0.45;
        float fray = smoothstep(0.80, 1.04, vRim);
        if (frayN < fray * fray * uFringe) discard;
      `)
      // AND THE PANELS THEMSELVES. Fraying fixed the outline; the interior of each tier was
      // still a large flat facet, and a flat facet has ONE normal, so it takes one value of
      // light across its whole area however nicely it is tinted. That is the entire reason
      // low-poly foliage reads as folded paper.
      //
      // So the same needle noise that grains the albedo also perturbs the NORMAL — a
      // tangent-free derivative bump (Mikkelsen), the same trick the terrain uses for its
      // sand ripples. The panels stop being planar to the lighting and start catching it in
      // clumps. Faded out with distance so the far stand cannot shimmer, and skipped on the
      // 1:240 chart-table clone where a tree is four pixels.
      .replace('#include <normal_fragment_begin>', `
        #include <normal_fragment_begin>
        // CLUMP scale, not needle scale, and gently. At 11/27 cycles with amplitude 0.55
        // this read as dark fur — the same failure the terrain's own comment warns about
        // ("high-freq grain in the NORMAL reads as a harsh per-pixel dapple, looks scaly").
        // The fine grain belongs in the albedo; the bump only has to stop the panel being
        // ONE flat value, and a branch clump is a ~30 cm thing.
        float nH = cnoise(vec2(vLPos.x * 1.3 + vLPos.y * 0.35, vLPos.z * 1.3 - vLPos.y * 0.3) * 3.4) * 0.66
                 + cnoise(vec2(vLPos.z - vLPos.y * 0.2, vLPos.x) * 8.5) * 0.34;
        float nAmt = 0.16 * (1.0 - smoothstep(18.0, 70.0, length(vViewPosition)));
        vec2 nD = vec2(dFdx(nH), dFdy(nH)) * nAmt;
        vec3 nSx = dFdx(-vViewPosition), nSy = dFdy(-vViewPosition);
        vec3 nR1 = cross(nSy, normal), nR2 = cross(normal, nSx);
        float nDet = dot(nSx, nR1);
        vec3 nGrad = sign(nDet) * (nD.x * nR1 + nD.y * nR2);
        normal = normalize(abs(nDet) * normal - nGrad);
      `)
      .replace('#include <color_fragment>', `
        #include <color_fragment>
        // oblique projection (#44): xz alone stretches to VERTICAL STREAKS on the cone's
        // sides (height never varies the sample there) — shearing y into both axes at
        // different rates tilts the projection so every face gets true 2D dapple
        vec2 folUv = vec2(vLPos.x + vLPos.y * 0.37, vLPos.z + vLPos.y * 0.61) * uFolScale;
        float folL = dot(texture2D(uFoliage, folUv).rgb, vec3(0.299, 0.587, 0.114));
        diffuseColor.rgb *= mix(1.0, folL * 1.9, uFolAmt);
        // NEEDLE GRAIN. The dapple above is a soft painterly wash at ~1 m; needles are a
        // centimetre thing, and without them a flat panel is still a flat panel however
        // nicely it is tinted. Two octaves of fine object-space noise, sheared the same way,
        // biased so the clusters read as sprays catching light rather than dirt.
        float ndl = cnoise(vec2(vLPos.x * 1.7 + vLPos.y, vLPos.z * 1.7 - vLPos.y) * 9.0) * 0.6
                  + cnoise(vec2(vLPos.z - vLPos.y * 0.6, vLPos.x + vLPos.y * 0.4) * 23.0) * 0.4;
        diffuseColor.rgb *= 0.80 + 0.42 * ndl;
        // and the tips are NEW GROWTH: lighter, yellower, the year's candles. Real conifers
        // are two greens — this one was one.
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.26, 1.20, 0.72),
                               smoothstep(0.55, 1.0, vRim) * 0.5 * (0.45 + 0.55 * ndl));
      `)
      .replace('#include <fog_fragment>', `
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uHaze,
          smoothstep(120.0, 300.0, length(vViewPosition)) * 0.45);
        #include <fog_fragment>
      `);
  };

  // NEEDLE LITTER. A trunk used to meet the grass at a hard cylinder edge with meadow
  // running right up to it, which is the one thing no forest floor does: under a conifer
  // there is a skirt of dropped needles where nothing much grows. Without it the trees
  // read as PLACED — models standing on a lawn — however good the trees themselves are.
  //
  // A jagged disc per tree, domed slightly so it sits on a gentle slope without its rim
  // digging in, and its edge DISSOLVES with the same fray the canopy uses. That matters:
  // an opaque disc would just trade a hard trunk edge for a hard litter edge.
  const litterGeo = (() => {
    const SEG = 14, g = new THREE.BufferGeometry();
    const lr = mulberry32(SEED ^ 0x1d7a);
    const pos = [], col = [], rim = [];
    // MUCH lighter than the first attempt. At 0x4a3a24 the patch read as a black plank
    // laid on the grass — a flat decal already collapses to a bar at eye height, and a
    // near-black one reads as a hole in the world rather than as ground.
    const c0 = new THREE.Color(0x8d7a4e), c1 = new THREE.Color(0xa2955f);   // damp core → dry edge, both close to the turf
    const ring = [];
    for (let i = 0; i < SEG; i++) {
      const a = (i / SEG) * TAU;
      const rad = 0.60 + lr() * 0.42;                      // ragged, never a circle — and tight to the trunk
      ring.push([Math.cos(a) * rad, 0.030, Math.sin(a) * rad, rad]);   // rim clear of the turf
    }
    for (let i = 0; i < SEG; i++) {
      const a = ring[i], b = ring[(i + 1) % SEG];
      pos.push(0, 0.040, 0, a[0], a[1], a[2], b[0], b[1], b[2]);   // barely domed — enough to clear a slope, not enough to show a side
      col.push(c0.r, c0.g, c0.b, c1.r, c1.g, c1.b, c1.r, c1.g, c1.b);
      rim.push(0, 1, 1);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('aRim', new THREE.Float32BufferAttribute(rim, 1));
    g.computeVertexNormals();
    return g;
  })();
  const litterMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: false });
  litterMat.onBeforeCompile = (sh) => {
    litterMat.userData.shader = sh;
    sh.vertexShader = sh.vertexShader
      .replace('void main() {', 'attribute float aRim;\nvarying vec3 vLP;\nvarying float vR;\nvoid main() {')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vLP = position; vR = aRim;');
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', `varying vec3 vLP; varying float vR;
        float lhash(vec2 p){p=fract(p*vec2(234.34,435.345));p+=dot(p,p+34.23);return fract(p.x*p.y);}
        float lnoise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.0-2.0*f);
          float a=lhash(i),b=lhash(i+vec2(1,0)),c=lhash(i+vec2(0,1)),d=lhash(i+vec2(1,1));
          return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);}
        void main() {`)
      .replace('#include <clipping_planes_fragment>', `
        #include <clipping_planes_fragment>
        float ln = lnoise(vLP.xz * 34.0) * 0.6 + lnoise(vLP.zx * 87.0) * 0.4;
        // the inner half stays SOLID and only the outer edge scatters. At 0.30 the cut
        // started almost at the centre, and since a disc's area is mostly its outer ring
        // that discarded nearly the whole patch — the litter was there and invisible.
        if (ln < smoothstep(0.34, 1.04, vR) * 0.94) discard;   // strewn needles, not a mat
      `)
      .replace('#include <color_fragment>', `
        #include <color_fragment>
        diffuseColor.rgb *= 0.82 + 0.36 * lnoise(vLP.xz * 19.0);   // needles, not mud
      `);
  };
  const litter = new THREE.InstancedMesh(litterGeo, litterMat, spots.length);
  litter.receiveShadow = true;
  litter.name = 'needleLitter';

  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
  // per-spot canopy SHAPE variant (loop #139). A SEPARATE rng picks the silhouette so the shared
  // r() stream — and thus every tree's POSITION, scale, lean and tone — is byte-unchanged; only
  // which of the two shapes a tree wears differs. ~55% broad fir (A), ~45% slim spruce (B).
  const vr = mulberry32(SEED ^ 0x5eed);
  const br = mulberry32(SEED ^ 0xba24);   // per-trunk bark tone (loop #141): separate rng so the shared r() (positions + canopy tones) stays byte-unchanged
  const cw = CANOPY.reduce((a, c) => a + c.weight, 0);
  const variant = spots.map(() => { let u = vr() * cw; for (let i = 0; i < CANOPY.length; i++) { u -= CANOPY[i].weight; if (u < 0) return i; } return 0; });
  const vCount = CANOPY.map((_, i) => variant.reduce((a, v) => a + (v === i ? 1 : 0), 0));
  // #6 LOD: a near/far instanced PAIR per silhouette, all of them on the one swaying
  // canopyMat. Each is allocated at its variant's capacity; a 0.35s repartition (main.js)
  // moves trees between near and far by camera distance with hysteresis.
  //
  // ARRAYS, not four named meshes. This was canopiesA/B/FarA/FarB spelled out in four
  // places — the constructor, the partition's ternaries, the count assignment and the
  // name/visibility list — so adding a silhouette meant editing all four and the L4
  // surface-strip in puzzles.js, and forgetting any one of them fails silently.
  const nearMesh = CANOPY.map((c, i) => new THREE.InstancedMesh(c.geo, canopyMat, vCount[i]));
  const farMesh = CANOPY.map((c, i) => new THREE.InstancedMesh(c.farGeo, canopyMat, vCount[i]));
  // ONE group, so everything that needs "the canopies" gets them all forever: swayMats
  // (main.js) reads the shared material off the first child, and the L4 surface-strip
  // (puzzles.js) hides the group instead of listing meshes it will one day not know about.
  const canopyGroup = new THREE.Group();
  canopyGroup.name = 'canopies';
  for (const m of nearMesh) { m.castShadow = true; canopyGroup.add(m); }
  for (const m of farMesh) canopyGroup.add(m);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const _lm = new THREE.Matrix4(), _lq = new THREE.Quaternion(), _le = new THREE.Euler();
  const _lv = new THREE.Vector3(), _lv2 = new THREE.Vector3();
  const col = new THREE.Color(), bark = new THREE.Color();
  const TREES = [];
  for (let i = 0; i < spots.length; i++) {
    const [x, y, z] = spots[i];
    const s = 0.8 + r() * 0.8;
    e.set((r() - 0.5) * 0.12, r() * TAU, 0.1 + r() * 0.12); // lean
    q.setFromEuler(e);
    // the silhouette's own scale (a sapling is SMALL, a storm elder is big) and a squash
    // across the trunk axis, both from vr() — the variant rng — so the shared r() stream
    // that every other scatter on the island draws from is not shifted by a tree tweak
    const vs = CANOPY[variant[i]].scale;
    const squash = 0.86 + vr() * 0.3;
    m4.compose(new THREE.Vector3(x, y, z), q,
      new THREE.Vector3(s * vs * squash, s * vs * (0.9 + r() * 0.4), s * vs * (1.86 - squash)));
    trunks.setMatrixAt(i, m4);
    // the litter lies FLAT on the ground: the trunk's lean must not tip it, so it takes
    // only the position and a yaw of its own
    _lq.setFromEuler(_le.set(0, vr() * TAU, 0));
    // heightAt, NOT the spot's y. A tree spot is deliberately SUNK below the surface so
    // the trunk's foot never floats on a slope — here that put the whole litter patch
    // 18 cm underground, where it rendered as a thin dark line and nothing else.
    _lm.compose(_lv.set(x, heightAt(x, z) + 0.03, z), _lq, _lv2.set(s * 1.5, 1, s * 1.5));
    litter.setMatrixAt(i, _lm);
    // per-trunk bark tone (loop #141): warm browns, light↔dark, so the trunks aren't 131 identical
    // poles; multiplies the shared bark albedo. Uses the separate br() rng (canopy tone unchanged).
    bark.setHSL(0.055 + br() * 0.05, 0.28 + br() * 0.24, 0.40 + br() * 0.2);
    trunks.setColorAt(i, bark);
    addCollider(x, z, 0.3 * s * CANOPY[variant[i]].scale);   // the trunk is solid — you walked through every tree in the forest
    // per-tree foliage tone (loop #133): widen hue (warm yellow-green ↔ cool blue-green), saturation
    // AND value so the stand reads as individuals — sunlit crowns, shadowed elders — not a clone.
    const tv = r();
    col.setHSL(
      0.19 + r() * 0.13,                          // 68°(yellow-green) → 115°(cool green)
      0.30 + r() * 0.26,                          // dusty → vivid
      0.24 + tv * tv * 0.30                        // tv² skews most trees darker, a few crowns bright
    );
    TREES.push({ x, z, v: variant[i], m: m4.clone(), c: col.clone(), far: false });
  }
  // the repartition: enter-near under 120m, leave over 130m (hysteresis inside the haze
  // melt, so a swap is a dozen hazed pixels). Counts shrink to the live split each call.
  const _nearN = new Array(CANOPY.length).fill(0), _farN = new Array(CANOPY.length).fill(0);
  const treePartition = (px, pz) => {
    _nearN.fill(0); _farN.fill(0);
    for (const t of TREES) {
      const d2 = (t.x - px) * (t.x - px) + (t.z - pz) * (t.z - pz);
      t.far = t.far ? d2 > 14400 : d2 > 16900;
      const mesh = t.far ? farMesh[t.v] : nearMesh[t.v];
      const idx = t.far ? _farN[t.v]++ : _nearN[t.v]++;
      mesh.setMatrixAt(idx, t.m);
      mesh.setColorAt(idx, t.c);
    }
    for (let i = 0; i < CANOPY.length; i++) { nearMesh[i].count = _nearN[i]; farMesh[i].count = _farN[i]; }
    for (const m of canopyGroup.children) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere();
    }
  };
  treePartition(4, -104);   // boot split from the wake-up beach; main re-aims it at the player
  core.userData.treeLod = treePartition;
  core.userData.canopyVariants = CANOPY.length;   // so tools/harness/trees.mjs cannot drift from the table
  trunks.castShadow = true;
  // 'canopies' is the GROUP swayMats (main.js) finds — it reads the shared material off the
  // first child — and the one thing the L4 surface-strip (_apply) has to hide.
  trunks.name = 'trunks';
  core.add(trunks, canopyGroup, litter);

  // FOREST-FLOOR detail: fallen logs + cut stumps among the trees — the bare tree-line given a real
  // woodland floor (the world rang flat). Two InstancedMeshes (+2 draws); own rng so the world scatter
  // stays byte-identical; reuses the bark material with darker, mossier per-instance tones (decaying wood).
  {
    const ffr = mulberry32(SEED ^ 0xf07e);
    const logInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.22, 2.4, 6), trunkMat, 9);
    const stumpInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.36, 0.6, 7), trunkMat, 6);
    const fm = new THREE.Matrix4(), fq = new THREE.Quaternion(), fe = new THREE.Euler(), fc = new THREE.Color();
    let li = 0, si = 0;
    for (let k = 0; k < 240 && (li < 9 || si < 6); k++) {
      const sp = spots[(ffr() * spots.length) | 0];                 // near a tree, offset onto the floor
      const ang = ffr() * TAU, off = 2 + ffr() * 5;
      const x = sp[0] + Math.sin(ang) * off, z = sp[2] + Math.cos(ang) * off;
      const h = heightAt(x, z);
      if (h < 3.0 || h > 15) continue;
      if (ffr() < 0.6 && li < 9) {
        const s = 0.7 + ffr() * 0.7;                                // fallen log, lying flat
        fe.set(Math.PI / 2 + (ffr() - 0.5) * 0.2, ffr() * TAU, (ffr() - 0.5) * 0.3); fq.setFromEuler(fe);
        fm.compose(new THREE.Vector3(x, h + 0.12 * s, z), fq, new THREE.Vector3(s, s * (0.8 + ffr() * 0.6), s));
        logInst.setMatrixAt(li, fm);
        fc.setHSL(0.07 + ffr() * 0.05, 0.24 + ffr() * 0.14, 0.32 + ffr() * 0.14); logInst.setColorAt(li, fc);   // weathered brown, not near-black
        li++;
      } else if (si < 6) {
        const s = 0.7 + ffr() * 0.6;                                // cut stump, short + vertical
        fe.set((ffr() - 0.5) * 0.1, ffr() * TAU, (ffr() - 0.5) * 0.1); fq.setFromEuler(fe);
        fm.compose(new THREE.Vector3(x, h + 0.28 * s, z), fq, new THREE.Vector3(s, s, s));
        stumpInst.setMatrixAt(si, fm);
        fc.setHSL(0.08 + ffr() * 0.05, 0.26 + ffr() * 0.12, 0.36 + ffr() * 0.12); stumpInst.setColorAt(si, fc);   // weathered brown, readable in shade
        si++;
      }
    }
    logInst.count = li; stumpInst.count = si;
    logInst.computeBoundingSphere(); stumpInst.computeBoundingSphere();
    logInst.castShadow = logInst.receiveShadow = true; logInst.name = 'fallenLogs';
    stumpInst.castShadow = stumpInst.receiveShadow = true; stumpInst.name = 'stumps';
    core.add(logInst, stumpInst);
  }

  // FOREST UNDERGROWTH: low moss + scrub patches among the trees — green on the bare forest floor (the
  // world rang tan-monotone). One InstancedMesh (+1 draw); own rng so the world scatter stays byte-
  // identical; flat lumpy mounds with per-instance mossy-to-ferny green tones. Canon: a wood reclaiming
  // a place no one tends.
  {
    const mossMat = new THREE.MeshStandardMaterial({ color: 0x4c5a30, roughness: 0.95, flatShading: true });
    const mossInst = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.42, 0), mossMat, 24);
    const mr = mulberry32(SEED ^ 0x6a55);
    const mm = new THREE.Matrix4(), mq = new THREE.Quaternion(), me2 = new THREE.Euler(), mc = new THREE.Color();
    let mn = 0;
    for (let k = 0; k < 280 && mn < 24; k++) {
      const sp = spots[(mr() * spots.length) | 0];
      const ang = mr() * TAU, off = 1.5 + mr() * 6;
      const x = sp[0] + Math.sin(ang) * off, z = sp[2] + Math.cos(ang) * off;
      const h = heightAt(x, z);
      if (h < 3.0 || h > 15) continue;
      const sx = 0.7 + mr() * 1.3, sz = 0.7 + mr() * 1.4;
      me2.set(0, mr() * TAU, 0); mq.setFromEuler(me2);
      mm.compose(new THREE.Vector3(x, h - 0.08, z), mq, new THREE.Vector3(sx, 0.22 + mr() * 0.18, sz));   // flat mossy mound
      mossInst.setMatrixAt(mn, mm);
      mc.setHSL(0.22 + mr() * 0.12, 0.30 + mr() * 0.22, 0.24 + mr() * 0.13);   // mossy → ferny green, varied (lit + shade readable)
      mossInst.setColorAt(mn, mc);
      mn++;
    }
    mossInst.count = mn;
    mossInst.computeBoundingSphere();
    mossInst.name = 'undergrowth';
    mossInst.receiveShadow = true;
    core.add(mossInst);
  }

  // --- grass: a TUFT of curved blades (loop #122). The old single straight cross-blade read as
  // a spike in the ground; a clump of blades that arc OUTWARD and droop at the tips reads as grass.
  const bladeGeo = (() => {
    // one curved, tapered blade rooted at y=0, arcing forward (+z) and drooping toward the tip
    const makeBlade = (h, w, bend) => {
      const g = new THREE.PlaneGeometry(w, h, 1, 3);
      g.translate(0, h / 2, 0);                       // base at y=0
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        const t = Math.max(0, Math.min(1, y / h));    // 0 root → 1 tip
        p.setX(i, p.getX(i) * (1 - t * 0.82));        // taper toward the tip
        p.setZ(i, p.getZ(i) + bend * t * t * h);      // arc forward, accelerating to the tip
        p.setY(i, y - bend * 0.4 * t * t * h);        // droop the arcing tip down
      }
      g.computeVertexNormals();
      return g.toNonIndexed();
    };
    // fan 5 blades around the base at varied yaw / height / arc — a fountain-shaped clump
    const blades = [];
    const N = 5;
    for (let i = 0; i < N; i++) {
      const yaw = (i / N) * TAU + i * 1.3;
      const h = 0.4 + (i % 3) * 0.08;                 // 0.40 .. 0.56
      const w = 0.055 + (i % 2) * 0.02;
      const bend = 0.45 + (i % 4) * 0.14;             // varied droop so it isn't a uniform spray
      const b = makeBlade(h, w, bend);
      b.rotateY(yaw);
      b.translate(Math.cos(yaw) * 0.03, 0, Math.sin(yaw) * 0.03);  // slight base spread
      blades.push(b);
    }
    const g = mergeGeometries(blades);
    for (const b of blades) b.dispose();
    return g;
  })();
  const grassMat = new THREE.MeshStandardMaterial({
    color: 0xc2a75f, flatShading: true, roughness: 0.9, side: THREE.DoubleSide,
  });
  // The meadow's shading recipe, shared: a two-axis sway weighted to the tips, and the
  // up-normal relight. Factored out because the heath below needs exactly the same
  // treatment for exactly the same reasons, and a second hand-copied shader patch is a
  // second thing to forget to fix.
  const meadowSway = (mat, amp = 1, fray = 0) => (sh) => {
    sh.uniforms.uTime = { value: 0 };
    mat.userData.shader = sh;
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vGUp = normalMatrix * vec3(0.0, 1.0, 0.0);              // the meadow-floor normal, in view space
      #ifdef USE_INSTANCING
        float gw = instanceMatrix[3].x * 0.31 + instanceMatrix[3].z * 0.23;
        float gt = pow(max(position.y, 0.0), 1.5);            // tips drift most, roots stay put
        transformed.x += sin(uTime * 1.5 + gw) * ${(0.32 * amp).toFixed(3)} * gt;   // gentle two-axis wave (not a rigid waggle)
        transformed.z += cos(uTime * 1.2 + gw * 1.4) * ${(0.18 * amp).toFixed(3)} * gt;
      #endif
    `).replace('void main() {', 'uniform float uTime;\nvarying vec3 vGUp;\nvoid main() {');
    // light every blade with the ground's UP normal (the classic grass trick): a thin vertical
    // card's own normal faces the horizon, so the sun/hemi lit it near-black — and DoubleSide
    // back-faces went fully dark. With the meadow-floor normal the tufts take the same light as
    // the terrain they grow from, from every side, and still dim correctly at night.
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', 'varying vec3 vGUp;\nvoid main() {')
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n  normal = normalize(vGUp);');
    // A SPRIG IS NOT A CARD. Scaled up big enough to read across the meadow, the heath's
    // flat tapered planes showed exactly what they are — hard straight edges against the
    // sky, the same folded-paper tell the canopy had. Fray the tips with the same
    // dissolve, keyed on the sprig's own root→tip coordinate.
    if (fray > 0) {
      sh.vertexShader = sh.vertexShader
        .replace('void main() {', 'attribute float aRim;\nvarying float vMR;\nvarying vec3 vMP;\nvoid main() {')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n vMR = aRim; vMP = position;');
      sh.fragmentShader = sh.fragmentShader
        .replace('void main() {', `varying float vMR; varying vec3 vMP;
          float mhash(vec2 p){p=fract(p*vec2(234.34,435.345));p+=dot(p,p+34.23);return fract(p.x*p.y);}
          float mnoise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.0-2.0*f);
            float a=mhash(i),b=mhash(i+vec2(1,0)),c=mhash(i+vec2(0,1)),d=mhash(i+vec2(1,1));
            return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);}
          void main() {`)
        .replace('#include <clipping_planes_fragment>', `
          #include <clipping_planes_fragment>
          float mn = mnoise(vMP.xy * 42.0) * 0.6 + mnoise(vMP.zy * 97.0) * 0.4;
          if (mn < smoothstep(0.45, 1.05, vMR) * ${fray.toFixed(2)}) discard;
        `);
    }
  };
  grassMat.onBeforeCompile = meadowSway(grassMat, 1);

  const G_MAIN = 3800, G_ISLET = 650;   // fewer instances — each is now a full 5-blade tuft, not one blade
  // #30: one island-spanning InstancedMesh could never frustum-cull — every view paid all
  // ~4,450 animated tufts. BUFFER the placements (the r() call order is untouched, so the
  // scatter stays byte-identical), then bucket into spatial CHUNKS that cull independently.
  const gPlaced = [];
  let gi = 0;
  const gcol = new THREE.Color();
  const plant = (x, h, z) => {
    const s = 0.7 + r() * 0.9;
    m4.compose(
      new THREE.Vector3(x, h - 0.06, z),
      q.setFromEuler(e.set(0, r() * TAU, (r() - 0.5) * 0.25)),
      new THREE.Vector3(s, s * (0.7 + r() * 0.7), s));
    // per-tuft tone (loop #144): the old hue was locked to gold (.14-.21) → one flat dry dune. Widen
    // toward green with a gv² skew so MOST tufts stay sun-bleached gold but some are lush olive-green,
    // plus more value range — a living coastal meadow, not uniform dead brush. (× the 0xc2a75f base;
    // lifted with the up-normal relight so the meadow reads sunlit, not scorched.)
    const gv = r();
    gcol.setHSL(0.13 + gv * gv * 0.18, 0.36 + r() * 0.26, 0.33 + r() * 0.22);
    gPlaced.push({ m: m4.clone(), c: gcol.clone(), x, z });
    gi++;
  };
  for (let i = 0; i < G_MAIN * 4 && gi < G_MAIN; i++) {
    const a = r() * TAU, d = 15 + Math.sqrt(r()) * 150;
    const x = SPOTS.mainCenter.x + Math.sin(a) * d;
    const z = SPOTS.mainCenter.y + Math.cos(a) * d;
    const h = heightAt(x, z);
    if (h < 2.2 || h > 16) continue;
    if (!open(x, z) || grade(x, z) > 1.0) continue;
    plant(x, h, z);
  }
  // the islet was bald — and players study it through the whole music
  // sequence. Same gates; its own band: the pad (8.8) sits in a shallow
  // bowl whose shoulder rises to ~10.5 before falling to the beach.
  for (let i = 0; i < G_ISLET * 6 && gi < G_MAIN + G_ISLET; i++) {
    const a = r() * TAU, d = Math.sqrt(r()) * 28;
    const x = SPOTS.islet.x + Math.sin(a) * d;
    const z = SPOTS.islet.y + Math.cos(a) * d;
    const h = heightAt(x, z);
    if (h < 2.2 || h > 11.2) continue;
    if (!open(x, z) || grade(x, z) > 1.0) continue;
    plant(x, h, z);
  }
  // bucket into a 150m grid (~5 non-empty chunks), each its own culling volume; the
  // group keeps the 'grass' name so refs / the L4 strip / the model cap see one thing
  const grass = new THREE.Group();
  grass.name = 'grass';
  {
    const buckets = new Map();
    for (const p of gPlaced) {
      const k = Math.floor((p.x + 225) / 150) * 8 + Math.floor((p.z + 225) / 150);
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(p);
    }
    for (const list of buckets.values()) {
      const chunk = new THREE.InstancedMesh(bladeGeo, grassMat, list.length);
      list.forEach((p, i) => { chunk.setMatrixAt(i, p.m); chunk.setColorAt(i, p.c); });
      chunk.computeBoundingSphere();
      grass.add(chunk);
    }
  }
  core.add(grass);

  // --- HEATH: low clumps across the open ground ------------------------------
  // The meadow is the largest surface in the game and there was NOTHING on it — grass
  // tufts and, every fifty metres, a tree. From any vantage on the island the middle of
  // the frame was an empty field, which is the "rings flat" read more than any single
  // material is. Heather and gorse are what actually grows on a windswept coastal heath,
  // and a clump has something a blade does not: MASS. It holds a shadow, it breaks the
  // ground plane, and it reads at a hundred metres where a 40 cm blade does not.
  //
  // Its own rng (hr), NOT the shared r(): scattering a few hundred bushes must not shift
  // the stream that every placement after it draws from.
  {
    const hr = mulberry32(SEED ^ 0x4e17);
    const heathGeo = (() => {
      const sprigs = [];
      const N = 14;                                   // denser: a bush, not a starburst
      for (let i = 0; i < N; i++) {
        const yaw = (i / N) * TAU + hr() * 0.8;
        const lean = 0.55 + hr() * 0.5;                 // out and up: a dome, not a fan
        const len = 0.32 + hr() * 0.30;
        const g = new THREE.PlaneGeometry(0.085, len, 1, 2);
        g.translate(0, len / 2, 0);
        const pp = g.attributes.position;
        for (let v = 0; v < pp.count; v++) {
          const t = Math.max(0, Math.min(1, pp.getY(v) / len));
          pp.setX(v, pp.getX(v) * (1 - t * 0.72));      // taper
          pp.setZ(v, pp.getZ(v) + t * t * len * 0.5);   // curl outward
        }
        g.computeVertexNormals();
        const rim = new Float32Array(pp.count);
        for (let v = 0; v < pp.count; v++) rim[v] = Math.max(0, Math.min(1, pp.getY(v) / len));
        g.setAttribute('aRim', new THREE.BufferAttribute(rim, 1));
        const nb = g.toNonIndexed(); g.dispose();
        nb.rotateX(lean);                                // splay away from the crown
        nb.rotateY(yaw);
        nb.translate(Math.cos(yaw) * 0.11, 0.03, Math.sin(yaw) * 0.11);
        sprigs.push(nb);
      }
      const g = mergeGeometries(sprigs, ['aRim']);
      for (const b of sprigs) b.dispose();
      return g;
    })();
    const heathMat = new THREE.MeshStandardMaterial({
      color: 0x8a8770, flatShading: true, roughness: 0.95, side: THREE.DoubleSide,
    });
    heathMat.onBeforeCompile = meadowSway(heathMat, 0.45, 0.80);   // a woody clump barely moves; its tips fray
    const placed = [];
    const hcol = new THREE.Color();
    const hm = new THREE.Matrix4(), hq = new THREE.Quaternion(), he = new THREE.Euler();
    // IN PATCHES, not scattered evenly. 520 clumps spread uniformly over a 170 m disc is
    // one per 175 square metres — statistically present and visually invisible, which is
    // exactly how the first attempt looked. Heath grows in stands: pick a hundred-odd
    // centres and crowd each one, and the same budget reads as ground cover instead of
    // as speckle.
    const CLUSTERS = 115, PER = 16;
    for (let c = 0; c < CLUSTERS; c++) {
      const ca = hr() * TAU, cd = 18 + Math.sqrt(hr()) * 152;
      const ccx = SPOTS.mainCenter.x + Math.sin(ca) * cd;
      const ccz = SPOTS.mainCenter.y + Math.cos(ca) * cd;
      const crad = 3.5 + hr() * 6.5;
      for (let j = 0; j < PER * 3 && placed.length < CLUSTERS * PER; j++) {
      const a = hr() * TAU, d = Math.sqrt(hr()) * crad;
      const x = ccx + Math.sin(a) * d;
      const z = ccz + Math.cos(a) * d;
      const hh = heightAt(x, z);
      if (hh < 2.6 || hh > 17) continue;               // off the beach, off the cliff tops
      if (!open(x, z) || grade(x, z) > 0.85) continue;
      const sc = 0.85 + hr() * 0.95;
      hm.compose(new THREE.Vector3(x, hh - 0.04, z),
        hq.setFromEuler(he.set((hr() - 0.5) * 0.16, hr() * TAU, (hr() - 0.5) * 0.16)),
        new THREE.Vector3(sc, sc * (0.7 + hr() * 0.6), sc));
      // heather runs from a dusty sage through olive to a dull mauve where it flowers —
      // the mauve is what stops the clumps reading as more grass
      const hv = hr();
      hcol.setHSL(hv < 0.20 ? 0.90 + hr() * 0.05 : 0.17 + hr() * 0.14,
        0.10 + hr() * 0.18, 0.26 + hr() * 0.20);   // dusty, not plummy
      placed.push({ m: hm.clone(), c: hcol.clone(), x, z });
      if (placed.length % PER === 0) break;            // this stand is full; move on
      }
    }
    // bucketed like the grass (#30) so it frustum-culls instead of every view paying for
    // every clump on the island
    const heath = new THREE.Group();
    heath.name = 'heath';
    const buckets = new Map();
    for (const p2 of placed) {
      const k = Math.floor((p2.x + 225) / 150) * 8 + Math.floor((p2.z + 225) / 150);
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(p2);
    }
    for (const list of buckets.values()) {
      const chunk = new THREE.InstancedMesh(heathGeo, heathMat, list.length);
      list.forEach((p2, i) => { chunk.setMatrixAt(i, p2.m); chunk.setColorAt(i, p2.c); });
      chunk.castShadow = true;
      chunk.computeBoundingSphere();
      heath.add(chunk);
    }
    core.add(heath);
  }

  // --- shore rocks: irregular weathered boulders, not regular faceted balls (loop #128) ---
  // Fidelity pass (owner: "polygons are low"): detail-2 icosahedron (320 faces, was 80) with the
  // duplicated verts WELDED so smooth normals flow over the whole boulder, displaced by two
  // octaves of triplanar-blended value noise — continuous everywhere (no seam, no shattering):
  // broad geologic lumps + small weathered knuckles. The derived crack relief rides on top.
  const makeRock = (seed) => {
    const g = mergeVertices(new THREE.IcosahedronGeometry(1, 2));
    const p = g.attributes.position, v = new THREE.Vector3();
    const s1 = (seed % 97) * 0.71, s2 = (seed % 61) * 1.13;   // per-type shape offsets
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const ax = Math.abs(v.x), ay = Math.abs(v.y), az = Math.abs(v.z);
      const wsum = ax + ay + az;
      const tri = (f, o) => (
        vnoise(v.y * f + s1 + o, v.z * f - s2) * ax +
        vnoise(v.z * f + s2 + o, v.x * f + s1) * ay +
        vnoise(v.x * f - s1 + o, v.y * f + s2) * az) / wsum;
      const lump = tri(1.6, 0) * 0.42 + tri(4.3, 7.3) * 0.15;
      v.multiplyScalar(0.76 + lump);                    // ≈ 0.76 .. 1.33, weathered lumps
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  };
  const rockVariants = [makeRock(SEED ^ 0x2b91), makeRock(SEED ^ 0x5d17), makeRock(SEED ^ 0x8c3f)];
  // three stone types so the shore isn't 70 copies of one granite — split into 3 InstancedMeshes
  // (granite / basalt / limestone), each its own albedo + derived relief. The per-instance random
  // rotation already hides UV-orientation repeat, so distinct albedos read as natural variety (+2 draws).
  const rockDefs = [
    { id: 'rock', color: 0xa89e8c },       // weathered granite — quieter, carried by the relief now
    { id: 'basalt', color: 0x8a8f98 },     // dark volcanic
    { id: 'limestone', color: 0xc7bda6 },  // pale eroded
  ];
  const rockMeshes = rockDefs.map((d, idx) => {
    const mat = new THREE.MeshStandardMaterial({ color: d.color, flatShading: false, roughness: 0.95 });
    // #48: RELIEF-ONLY stone — the tiled albedo pixelated at arm's length and read as
    // cracked mud (screenshot 08-dory-shore). The derived normal keeps every fracture
    // catching light; the colour is a quiet flat base; texels enlarged (repeat 0.6) so
    // features read as geology up close, not texture grid. (The Bender house rule made
    // material: normal maps yes, tiled colour never.)
    applyRelief(mat, d.id, { normalScale: 0.8, strength: 2.6, colorMap: false, repeat: [0.6, 0.6], normalFrom: 'rock_height' });   // #138: strata bedding relief (Bender heightmap; 0.8 keeps it geology, not zebra, at grazing light)
    const im = new THREE.InstancedMesh(rockVariants[idx], mat, 70);
    im.castShadow = true; im.name = 'rocks';
    return im;
  });
  const riCount = [0, 0, 0];
  const boulders = [];   // substantial rocks captured for the lichen pass below
  let ri = 0;
  for (let i = 0; i < 400 && ri < 70; i++) {
    const a = r() * TAU, d = 120 + r() * 90;
    const x = SPOTS.mainCenter.x + Math.sin(a) * d;
    const z = SPOTS.mainCenter.y + Math.cos(a) * d;
    const h = heightAt(x, z);
    if (h < -1.5 || h > 4) continue;
    const s = 0.5 + r() * 2.2;
    m4.compose(
      new THREE.Vector3(x, h + s * 0.2, z),
      q.setFromEuler(e.set(r() * TAU, r() * TAU, r() * TAU)),
      new THREE.Vector3(s, s * (0.6 + r() * 0.5), s));
    // route to a stone bucket by a POSITIONAL hash (NOT r() — keeps the scatter RNG draw-order
    // identical so positions + colliders are byte-unchanged): ~50% granite / 28% basalt / 22% limestone
    const hv = (Math.abs(Math.sin(x * 12.9898 + z * 78.233)) * 43758.5453) % 1;
    const bucket = hv < 0.5 ? 0 : hv < 0.78 ? 1 : 2;
    rockMeshes[bucket].setMatrixAt(riCount[bucket]++, m4);
    // make the substantial boulders SOLID (you walked through them) — register a collider
    // footprint; small pebbles (s<0.9) stay passable so you don't bump invisible nubs
    if (s >= 0.9) { addCollider(x, z, s * 0.82); boulders.push([x, h, z, s]); }
    ri++;
  }
  rockMeshes.forEach((im, b) => { im.count = riCount[b]; core.add(im); });   // trim each to its filled count

  // LICHEN on the shore boulders — sage-grey and rust crusty patches weathering the bare granite (the
  // rocks rang plain grey; this gives them coastal character + a touch of colour). One InstancedMesh
  // (+1 draw); own rng so the world scatter stays byte-identical; placed on the upper boulder surfaces.
  // Canon: weathering on stone no one has cleaned.
  {
    const lichMat = new THREE.MeshStandardMaterial({ color: 0x8a9476, roughness: 1.0, flatShading: true });
    const lichInst = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.3, 0), lichMat, boulders.length * 2 + 1);
    const lr = mulberry32(SEED ^ 0x71c4);
    const lm = new THREE.Matrix4(), lq = new THREE.Quaternion(), le = new THREE.Euler(), lc = new THREE.Color();
    let ln = 0;
    for (const [bx, bh, bz, bs] of boulders) {
      const npatch = 1 + (lr() < 0.55 ? 1 : 0);
      for (let p = 0; p < npatch; p++) {
        const ang = lr() * TAU, rad = bs * (0.25 + lr() * 0.45);
        const px = bx + Math.cos(ang) * rad, pz = bz + Math.sin(ang) * rad;
        const py = bh + bs * (0.35 + lr() * 0.6);                        // crusting the upper boulder
        const psc = bs * (0.16 + lr() * 0.2);
        le.set((lr() - 0.5) * 0.7, lr() * TAU, (lr() - 0.5) * 0.7); lq.setFromEuler(le);
        lm.compose(new THREE.Vector3(px, py, pz), lq, new THREE.Vector3(psc, psc * 0.32, psc));   // flat crust
        lichInst.setMatrixAt(ln, lm);
        const rust = lr() < 0.4;                                          // ~40% rust/ochre for colour pops on grey
        lc.setHSL(rust ? 0.07 + lr() * 0.05 : 0.21 + lr() * 0.12, rust ? 0.42 + lr() * 0.18 : 0.16 + lr() * 0.16, 0.42 + lr() * 0.16);
        lichInst.setColorAt(ln, lc);
        ln++;
      }
    }
    lichInst.count = ln;
    lichInst.computeBoundingSphere();
    lichInst.name = 'lichen';
    lichInst.receiveShadow = true;
    core.add(lichInst);
  }
}

// =============================================================================
// Clone the island into the chart-table model. Shares all geometry; disables
// shadows; swaps the nested model anchor for a tiny impostor (the model's model).
// =============================================================================
// groups whose detail is sub-pixel at 1:240 and carries no state the recursion
// shows — pruned from the model clone to save draw calls (perf, loop #49). Each is
// confirmed decorative / island-only-driven: gallery+jetty are exterior repeats,
// quarters is interior furniture, vaultDrips is driven off the island ref only.
// 'handMarks' is pruned from the 1:240 clone: a ground scuff is ~4 mm there, sub-pixel
// at every angle, and the clone would double its instance cost for nothing.
const MODEL_PRUNE = new Set(['drownedGallery', 'jetty', 'quarters', 'vaultDrips', 'vaultVista', 'watcher', 'region2', 'region3', 'region4', 'stairFoot', 'galleryHatch', 'stairRope', 'drain', 'hallGlyphs', 'handMarks']);

export function instantiateModel(core, modelAnchor) {
  const modelRoot = core.clone(true);
  modelRoot.name = 'modelIsland';
  // collect-then-remove: removing a node DURING traverse corrupts the iteration
  // (the latent cause of the Points-in-core crash). Gather here, prune after.
  const prune = [];
  modelRoot.traverse((o) => {
    o.castShadow = false;
    o.receiveShadow = false;
    // re-enable frustum culling (perf #26): the clone inherits frustumCulled=false from the
    // island's water/beam (huge surfaces that must never cull at world scale). At 1:240 the
    // whole model is a ~1m prop on the chart table — cull it like any other prop, or its
    // ~270k tris are submitted every frame from anywhere on the island.
    o.frustumCulled = true;
    if (o.isPoints || MODEL_PRUNE.has(o.name)) prune.push(o);
  });
  for (const o of prune) o.removeFromParent();
  // ---- CROP THE MODEL, do not shrink it --------------------------------------
  // Owner: "when the table is shrinked we could also show less water. It is a lot of
  // the space." They are right — the model spanned 2.58 m and the island itself is
  // barely half of that, so most of the chart table was open sea.
  //
  // The tempting fix is to scale the model down to fit the smaller table, and it is
  // the wrong one: at a fixed 1:240 a smaller table means a smaller ISLAND and exactly
  // the same proportion of water. What actually shows less water is showing LESS OF
  // THE WORLD — cropping the domain — which keeps 1:240 intact. And 1:240 has to stay:
  // it is the ratio the dive animation scales by (main.js, log(1/SCALE_MODEL)), so it
  // is mechanism, not just the line in the journal that quotes it.
  //
  // The terrain clips (MeshStandardMaterial supports clipping planes natively) and the
  // sea is a flat plane, so scaling it in x/z crops it without distorting anything. The
  // sea CANNOT be clipped the same way — it is a ShaderMaterial shared with the real
  // island's ocean, and a custom shader has to opt into the clipping chunks; cloning it
  // to add them would mean maintaining a second copy of the water shader for a prop.
  // Scaling the plane gets the same result for nothing.
  //
  // Both are cropped to the SAME extent or the seabed shows dry beyond the water line.
  {
    // 0.90, down from 0.95: the model shows a 1.8 m square of the world. The last 5 cm
    // per side is not about water, it is about the WORKING MARGIN — the band of clear
    // vellum outside the model where the logbook, the day's return and the phial lie.
    // At 0.95 that band was 0.225 m and the props on it were 0.26-0.42 m wide, so they
    // simply could not fit and had been left out past the rim entirely. It is 0.32 m now
    // (vellum 1.22 - CROP), which every one of them fits inside with slack.
    // The island survives the tighter crop: measured, land covers 5% of the square ring
    // at 220 m from the lighthouse and 3% at 240 m, so cutting at 216 m instead of 228 m
    // clips essentially the same nothing. Below ~200 m it would start slicing real
    // shoreline (20% of the ring at 200 m, 33% at 140 m) — that is the floor, not taste.
    const CROP = 0.90;                        // half-extent in metres: the model shows 1.8m
    const mw = modelRoot.getObjectByName('water');
    if (mw) {
      // MEASURE IN THE MODEL'S OWN UNITS. Box3.setFromObject here returns ISLAND units,
      // not metres: instantiateModel runs before the clone is parented under the anchor
      // that scales it by SCALE_MODEL. Dividing the metres I wanted by the island units
      // I measured scaled the sea to 1 cm and the chart table lost its ocean entirely.
      mw.geometry.computeBoundingBox();
      const bb = mw.geometry.boundingBox;
      const span = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) * (mw.scale.x || 1);
      const wantLocal = (CROP * 2) / SCALE_MODEL;      // metres -> island units
      const k = span > 0 ? wantLocal / span : 1;
      mw.scale.x *= k; mw.scale.z *= k;
      // NOTE: keep this mesh and its NAME. puzzles._apply opens with `if (!R.water)
      // return`, so a model without a ref called 'water' stops being driven at all —
      // no tide, no era, nothing. Scaling is why this is safe; replacing would not be.
    }
    const mt = modelRoot.getObjectByName('terrain');
    if (mt && mt.material) {
      // `LH` is local to buildWorld and does NOT exist in here — reaching for it threw a
      // ReferenceError and the page booted with no game on it at all. The model's own
      // anchor is the table's axis, and it is right there in the signature.
      const c = new THREE.Vector3();
      modelAnchor.getWorldPosition(c);
      const P = THREE.Plane;
      mt.material = mt.material.clone();      // shared with the real island; do not clip that
      // World-space planes around the table's axis, written out rather than derived so
      // the sign of each is obvious: keep the half-space that contains the model.
      mt.material.clippingPlanes = [
        new P(new THREE.Vector3(-1, 0, 0), c.x + CROP),
        new P(new THREE.Vector3(1, 0, 0), -(c.x - CROP)),
        new P(new THREE.Vector3(0, 0, -1), c.z + CROP),
        new P(new THREE.Vector3(0, 0, 1), -(c.z - CROP)),
      ];
      mt.material.needsUpdate = true;
    }
  }

  // the model's meadow: at 1:240 a grass blade is ~0.2 mm wide — sub-pixel even leaning all the
  // way in. Keep a light speckle for colour (the planting order is spatially random, so a prefix
  // stays spread across the island) and drop the rest: ~-115k triangles nobody could ever see.
  // (collectRefs still finds 'grass'; the L4 strip in puzzles _apply null-guards + drives both.)
  const modelGrass = modelRoot.getObjectByName('grass');
  if (modelGrass) {
    // #30: grass is a group of chunks — cap the clone's total speckle across them
    const chunks = modelGrass.isInstancedMesh ? [modelGrass] : modelGrass.children.filter((c) => c.isInstancedMesh);
    const per = Math.max(60, Math.ceil(600 / Math.max(chunks.length, 1)));
    for (const c of chunks) c.count = Math.min(c.count, per);
  }
  // the model's own model: a speck impostor on its chart table
  const nestedAnchor = modelRoot.getObjectByName('modelAnchor');
  if (nestedAnchor) {
    const impostor = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.1, 8),
      new THREE.MeshStandardMaterial({ color: 0x2a5a58, flatShading: true }));
    const peak = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.4, 5),
      new THREE.MeshStandardMaterial({ color: 0xcfc8b8, flatShading: true }));
    peak.position.y = 0.7;
    impostor.add(disc, peak);
    // the secret, for whoever leans all the way in at night: far down the
    // recursion, a light is still lit — a pinprick where the next
    // lighthouse stands (~1 mm in world space; additive, day-invisible)
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.45, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xffe2a8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    glint.position.set(-0.4, 0.5, -0.55);
    glint.name = 'nestedGlint';
    impostor.add(glint);
    impostor.scale.setScalar(SCALE_MODEL * 120);
    nestedAnchor.add(impostor);
  }
  // "you are here" — the abyme made literal. A cool pinprick (vs the world's warm
  // glints) tracks the player's real island position on the chart-table model:
  // you are a speck on your own map. A Mesh+Sprite (never Points — this is added
  // post-clone, but stay clone-safe); island-unit local coords (modelRoot scales
  // them by SCALE_MODEL). Position + pulse driven in main.js applyAtmosphere.
  // sizes are in island units; modelRoot scales them by SCALE_MODEL (~1/240), so a
  // ~30-unit pin reads as a ~0.12-world cursor on the table — visible when you lean
  // in, but clearly smaller than the table's brass instruments.
  const youMarker = new THREE.Group();
  youMarker.name = 'youMarker';
  const youPin = new THREE.Mesh(
    new THREE.ConeGeometry(2.8, 38, 5),
    new THREE.MeshBasicMaterial({ color: 0x2fccff })
  );
  youPin.position.y = 19; // base on the model surface, tip up
  const youSpark = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialGlowTex(), color: 0xc8f4ff, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  youSpark.scale.setScalar(26); // the eye-catcher at table distance
  youSpark.position.y = 42; // glow at the pin's tip
  youMarker.add(youPin, youSpark);
  youMarker.visible = false; // shown once the player is in the world (introDone)
  modelRoot.add(youMarker);
  modelRoot.scale.setScalar(SCALE_MODEL);
  modelAnchor.add(modelRoot);
  return modelRoot;
}

// #70: the registration seam — new state-driven props register here (name + whether the
// 1:240 clone prunes them) instead of hand-editing two lists; the legacy NAMES entries
// below keep working unchanged. main.js asserts every name resolves at boot.
export function defineProp(name, { prune = false } = {}) {
  if (!NAMES.includes(name)) NAMES.push(name);
  if (prune) MODEL_PRUNE.add(name);
}

// Collect state-driven object refs by name, for one island instance.
export const NAMES = [
  'handMarks', 'dispDial', 'dispPointer',
  'water', 'lampLens', 'beamPivot', 'beamCone', 'shaftBeam', 'valveWheel',
  'orreryPivot', 'orreryTilt', 'orreryLamp', 'crankHandle', 'musicBoxLid',
  'innerDoor', 'plumbHung', 'plumbBob', 'plumbHook', 'deskPlate', 'vaultDoor', 'lensItem', 'chestLid', 'cellarShaft',
  'rulerItem', 'rulerWorld', 'hatchLid', 'hatchShimmer', 'glyphPlane',
  'tinyFigure', 'coat', 'footprints', 'songBird', 'bell', 'disagreeSea', 'disagreeLamp', 'chartTally', 'logbook', 'vaultVista',
  'jettyLantern', 'jettyHalo', 'plateGlow', 'doryOar', 'doryHull', 'inscribedStone', 'messageBottle', 'quartersJournal',
  'readGlass', 'lensMarkStudy', 'lensMarkStone', 'watcher', 'musicNote',
  'stairFoot', 'galleryHatch', 'stairRope',   // hub Phase B: the climb foot, descend point, and the lamp-lit gate
  'drainFlood', 'drainMark',                   // hub Phase C: the first tunnel's flood plane + carved line
  'dial0', 'dial1', 'dial2', 'dial3', 'dialGlyph0', 'dialGlyph1', 'dialGlyph2', 'dialGlyph3',
  'stone0', 'stone1', 'stone2', 'stone3', 'stone4',
  'stoneGlow0', 'stoneGlow1', 'stoneGlow2', 'stoneGlow3', 'stoneGlow4',
  'stoneMark0', 'stoneMark1', 'stoneMark2', 'stoneMark3', 'stoneMark4',
  'stone5', 'stoneGlow5', 'stoneMark5',                                   // the fallen sixth stone (#49: the hidden sixth note)
  'poolWater', 'poolPhial', 'poolGlint', 'phialDesk', 'hallGlyphs',       // #49: the high-pool round trip + the beam turned to the deep
  'lmValve', 'lmBox', 'lmChest', 'lmDory', 'lmJetty', 'lmStair', 'lmBell', 'lmBuoy', 'lmDrain',   // #54: the lampblack micro-marks
  'tideGauge', 'gaugeTop',                                                 // #52: the tide gauge — the descent's waterlines made monumental
  'tinyCompanion',                                                         // #53: the second figure on the model's beach, once carried
  'drainLedger',                                                           // #55: the inspector's tide ledger, wedged in the drain
  'cmTallies', 'cmFormal', 'cmPlain', 'cmUnfinished', 'cmChild',           // #50-B: the climbers' five hands down the descent
  'cgRoof', 'cgCount', 'cgLight',                                          // #50-C the congregation's carved lines (#50-A's papers register via the #69 factory)
  'region2', 'region3', 'region4', 'tideFigure', 'drownedGallery', 'kelpSlate', 'bluffCairn', 'sourceNote', 'fishShadows', 'bellBuoy',   // SEA-STRATA shells + L2/L3/L4 encounters, fragments, L2 fish-shadows & the L3 bell-buoy (loop #117/#121/#127/#132/#134/#135/#143, #52)
  'trunks', 'canopies', 'grass',   // SEA-STRATA L4 strip (loop #129); 'canopies' is the GROUP of every LOD/silhouette (#6)
];

export function collectRefs(root) {
  // custom DFS that does NOT descend into the nested model island —
  // plain getObjectByName would find the clone's copies first.
  const refs = {};
  const want = new Set(NAMES);
  (function walk(o) {
    if (o.name === 'modelAnchor' && o !== root) return;
    if (want.has(o.name) && !(o.name in refs)) refs[o.name] = o;
    for (const c of o.children) walk(c);
  })(root);
  for (const n of NAMES) refs[n] = refs[n] || null;
  return refs;
}
