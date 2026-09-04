// terrain.js — the island is a single analytic height function.
// Geometry, player collision, water depth and foam all read the same math.

import * as THREE from 'three';
import { fbm, ridged, clamp, lerp, smoothstep, mulberry32, SEED } from './util.js';
// #77: terrain is a DETERMINISTIC LEAF again — no live world import. The four pieces of
// world state collision depends on arrive through GATES, synced once per frame by main
// (syncGates). Headless probes drive GATES directly; nothing here reads W.
export const GATES = { atTop: false, bridgeUp: false, hatchOpen: false, annexOpen: false };
export function syncGates(W) {
  GATES.atTop = !!W.atTop;
  GATES.bridgeUp = !!W.flags.rulerPlaced;
  GATES.hatchOpen = !!W.flags.hatchOpen;
  GATES.annexOpen = W.level >= 2 || !!W.flags.returned;
}
import { getTexture } from './assets.js';

export const DOMAIN = 620;            // metres, square, centered on origin
// The lamp-room gallery is one physical contract shared by rendering and collision.
// Player centres stop a handspan inside the brass rail, matching the original 0.10 m
// inset while leaving the widened outer deck genuinely walkable rather than decorative.
export const GALLERY_RADIUS = 3.75;
export const GALLERY_RAIL_RADIUS = 3.55;
export const GALLERY_PLAYER_RADIUS = GALLERY_RAIL_RADIUS - 0.10;

// NEEDLE LITTER, as a property of the GROUND rather than as an object lying on it.
//
// It was an instanced disc per tree, and the owner named the flaw exactly: "this is like
// a plane that doesn't align with the ground". It cannot align — a flat disc on sloping
// terrain floats on the uphill side and buries on the downhill one, and no amount of
// tuning colour or size fixes a plane sitting on a curve.
//
// So the terrain draws it itself. props stamps a soft blob per tree into a mask texture
// covering the stand, and the terrain shader samples that mask and shifts its own colour
// — which follows every fold of the ground for free, because it IS the ground. The mask
// is deliberately coarse (it only has to say WHERE); the needle character comes from
// procedural grain evaluated per fragment, so the detail is sharp at any distance while
// the data behind it is a third of a megabyte.
//
// props fills this in after the trees are placed, which happens at build time — before
// the first render, and therefore before onBeforeCompile reads it.
export const LITTER = { tex: null, cx: 0, cz: 0, size: 1 };
let _blank = null;
const _blankTex = () => {
  if (!_blank) { _blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); _blank.needsUpdate = true; }
  return _blank;
};
const SEA_FLOOR = -13;

// landmarks (north = +z, east = +x)
export const SPOTS = {
  mainCenter: new THREE.Vector2(-30, 40),
  lighthouse: new THREE.Vector2(-85, -40),   // coastal headland; flattened pad, h = 13.5
  beach: new THREE.Vector2(4, -98),
  bluff: new THREE.Vector2(85, 25),
  hatch: new THREE.Vector2(97, 32),          // flattened pad, h = 23.5
  islet: new THREE.Vector2(135, -150),
  stones: new THREE.Vector2(135, -146),      // flattened pad, h = 8.8
  chest: new THREE.Vector2(118, -176),
  causewayA: new THREE.Vector2(48, -78),
  causewayB: new THREE.Vector2(112, -132),
  chasmBridgeZ: 25,                          // bridge crosses the chasm at this z
};

// One physical contract for the lens-vault outcrop. It is a sealed boulder with
// a shallow exterior reliquary, not an enterable room. props.js and collision use
// the same ellipse, facing and surface depth. The 0.28 m collision margin is the
// player's body around the camera, so the eye never clips into either rock or slab.
export const VAULT_OUTCROP = (() => {
  const x = SPOTS.stones.x - 11, z = SPOTS.stones.y - 4;
  const rotation = 0.7, radius = 3.2, scaleX = 1.3, scaleY = 0.9, scaleZ = 1.1;
  const dx = SPOTS.stones.x - x, dz = SPOTS.stones.y - z, d = Math.hypot(dx, dz);
  const faceX = dx / d, faceZ = dz / d;
  const c = Math.cos(rotation), s = Math.sin(rotation);
  const localFaceX = c * faceX - s * faceZ, localFaceZ = s * faceX + c * faceZ;
  const renderX = radius * scaleX, renderZ = radius * scaleZ;
  const faceRadius = 1 / Math.sqrt(
    (localFaceX * localFaceX) / (renderX * renderX)
      + (localFaceZ * localFaceZ) / (renderZ * renderZ));
  return Object.freeze({
    x, z, rotation, radius, scaleX, scaleY, scaleZ, renderX, renderZ,
    colliderX: renderX + 0.28,
    colliderZ: renderZ + 0.28,
    faceX, faceZ,
    faceRadius,
    doorYaw: Math.atan2(faceX, faceZ),
  });
})();

const LIGHTHOUSE_H = 13.5;
const GALLERY_H = LIGHTHOUSE_H + 20.6;   // the lamp-room balcony floor (hub Phase B, the climb)
const STONES_H = 8.8;
const HATCH_H = 23.5;
const BRIDGE_DECK = 18.45;
const BRIDGE_W = new THREE.Vector2(35, 25);
const BRIDGE_E = new THREE.Vector2(59, 25);

function distSeg(px, pz, ax, az, bx, bz) {
  const abx = bx - ax, abz = bz - az;
  const t = clamp(((px - ax) * abx + (pz - az) * abz) / (abx * abx + abz * abz), 0, 1);
  const dx = px - (ax + abx * t), dz = pz - (az + abz * t);
  return Math.sqrt(dx * dx + dz * dz);
}

function smax(a, b, k = 4) { // smooth max
  const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1);
  return lerp(a, b, h) + k * h * (1 - h);
}

export function heightAt(x, z) {
  // sea floor with gentle dunes
  let h = SEA_FLOOR + fbm(x * 0.013 + 7, z * 0.013 - 3, 3) * 2.5;

  // ---- main island ----
  {
    const dx = x - SPOTS.mainCenter.x, dz = z - SPOTS.mainCenter.y;
    const d = Math.sqrt(dx * dx + dz * dz) / 165;
    const m = 1 - smoothstep(0.45, 1.0, d);
    if (m > 0) {
      const ridge = ridged(x * 0.011 + 2.3, z * 0.011 + 5.1, 4);
      const detail = fbm(x * 0.03, z * 0.03, 4);
      const hh = Math.pow(m, 1.35) * 15 + ridge * m * 6.5 + detail * m * 3 - 2;
      h = smax(h, hh, 3);
    }
  }

  // ---- east bluff (steep plateau, cliff on its west flank) ----
  // edges deliberately steeper than the 1.35 climb limit: the only way up
  // is the carved bridge pad. The ruler IS the route.
  {
    const dx = x - SPOTS.bluff.x, dz = z - SPOTS.bluff.y;
    const d = Math.sqrt(dx * dx + dz * dz * 0.8) / 64;
    const m = 1 - smoothstep(0.58, 0.76, d);
    if (m > 0) {
      const strata = fbm(x * 0.05, z * 0.05, 3) * 2;
      const hh = Math.pow(m, 0.6) * 25 + strata * m - 2;
      h = smax(h, hh, 2.5);
    }
  }

  // ---- islet ----
  {
    const dx = x - SPOTS.islet.x, dz = z - SPOTS.islet.y;
    const d = Math.sqrt(dx * dx + dz * dz) / 50;
    const m = 1 - smoothstep(0.4, 1.0, d);
    if (m > 0) {
      const hh = Math.pow(m, 1.25) * 10.5 + fbm(x * 0.04 + 9, z * 0.04, 3) * m * 2 - 1.5;
      h = smax(h, hh, 2.5);
    }
  }

  // ---- causeway: a drowned ridge, exposed only at low tide ----
  {
    const d = distSeg(x, z, SPOTS.causewayA.x, SPOTS.causewayA.y, SPOTS.causewayB.x, SPOTS.causewayB.y);
    const crest = -1.6 + Math.sin(x * 0.11 + z * 0.07) * 0.25;
    const ridgeH = crest - Math.pow(d / 10, 2) * 6;
    h = smax(h, ridgeH, 1.5);
  }

  // ---- the chasm: a crack splitting bluff from main island ----
  // long enough that both ends drown below the lowest tide; walls steeper
  // than the climb limit — without the ruler there is no crossing
  {
    const d = distSeg(x, z, 46, -55, 47, 112);
    const wobble = fbm(z * 0.04, x * 0.04, 2) * 3;
    const mask = 1 - smoothstep(4 + wobble, 9 + wobble, d);
    if (mask > 0) h = lerp(h, Math.min(h, -8.5), Math.pow(mask, 1.3));
  }

  // ---- flattened pads for structures ----
  h = padFlatten(h, x, z, SPOTS.lighthouse, 11, LIGHTHOUSE_H);
  h = padFlatten(h, x, z, SPOTS.stones, 13, STONES_H);
  h = padFlatten(h, x, z, SPOTS.hatch, 8, HATCH_H);
  // bridge approach pads: small radius so their skirts never refill the
  // chasm floor between them (influence ends ~9m out; the crack is ~11m away)
  h = padFlatten(h, x, z, BRIDGE_W, 5, BRIDGE_DECK - 0.45);
  h = padFlatten(h, x, z, BRIDGE_E, 5, BRIDGE_DECK - 0.45);

  // ramp corridor: the one walkable way up from the bridge onto the plateau
  {
    const ax = 59, az = 25, bx = 80, bz = 29;
    const d = distSeg(x, z, ax, az, bx, bz);
    if (d < 8) {
      const t = clamp(((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2), 0, 1);
      const rampH = (BRIDGE_DECK - 0.45) + t * (24.2 - (BRIDGE_DECK - 0.45));
      h = lerp(rampH, h, smoothstep(2.5, 8, d));
    }
  }

  // ---- beach: soften everything low near the south shore, keep it dry sand ----
  {
    const beachiness = 1 - smoothstep(0, 90, Math.hypot(x - SPOTS.beach.x, z - SPOTS.beach.y));
    // taper influence smoothly to zero by h=5 so no terrace ring forms
    const w = beachiness * 0.85 * (1 - smoothstep(2.8, 5.0, h)) * smoothstep(-1.2, -0.4, h);
    if (w > 0) h = lerp(h, 1.5 + (h * 0.3), w);
  }

  return h;
}

function padFlatten(h, x, z, spot, r, target) {
  const d = Math.hypot(x - spot.x, z - spot.y);
  if (d > r * 1.8) return h;
  return lerp(target, h, smoothstep(r * 0.55, r * 1.8, d));
}

// ----------------------------------------------------------------------------
// Walkable height: terrain + structures the player can stand on.
// ---- solid colliders + the jetty deck ----
// Circular footprints props register (shore rocks, …) so the player can't walk THROUGH solid
// scatter. props.js pushes via addCollider during buildWorld; wallBlocked() reads them.
const COLLIDERS = [];
// read-only view for the playtest probe (tools/harness/probe.mjs): blaming a
// phantom wall needs to know whether a collider circle owns the cell.
export const colliders = () => COLLIDERS;
export function addCollider(x, z, r) { COLLIDERS.push({ x, z, r }); }
export function clearColliders() { COLLIDERS.length = 0; }
// the jetty deck — a walkable plank surface standing over the water off the wake-up beach
// (mesh in props.js: centre jx=-18, z=-110.5, 2.4×12, plank top ~1.16). Mirror it here so
// you stand ON it instead of falling through to the seabed.
const JETTY = { x: -18, z: -110.5, hx: 1.3, hz: 6.1, y: 1.16 };

// TWO FLOORS, ONE (x,z) — why walkableY takes `fromY`.
//
// The buried spaces (the drain chamber under the standing-stones pad, the vault
// under the bluff) sit DIRECTLY BENEATH ground the player also walks on. A pure 2-D
// height field cannot express that: it has to return one number, and it was
// returning the buried one. So the centre of the standing stones — where the player
// must stand to play the five-note arc — reported the chamber floor 4.8 m down, and
// walking to the music puzzle dropped you into a sealed room. (Owner-reported; the
// wander probe reproduced it at exactly SPOTS.stones.)
//
// `fromY` is the height the caller is currently standing at. A BURIED floor is only
// chosen when the caller is already down there; otherwise the surface wins. Omit it
// — spawns, teleports, tooling, anything asking "what is the ground here" — and the
// surface always wins, which is the safe default. The CONNECTORS (the drain ramp,
// the hatch stair and its pit) are never ambiguous: they are the way between the two
// floors, so they always answer for themselves.
//
// This is what lets the hub's planned tunnel NETWORK exist at all: every future
// buried room under walkable ground is the same shape, and now it is one rule.
function buriedFloorAt(x, z) {
  // the vault under the bluff (reached by the hatch stair)
  if (GATES.hatchOpen) {
    const lx = x - SPOTS.hatch.x, lz = z - SPOTS.hatch.y;
    if (lx > -4.5 && lx < 4.5 && lz < -8.6 && lz > -17) return HATCH_H - 5.2;
  }
  // the drain chamber under the standing-stones pad
  if (x > 127.8 && x < 136.2 && z > -154.2 && z < -145.8) return 4.0;
  return null;
}

export function walkableY(x, z, fromY) {
  // the lamp-room gallery: while up top, the lighthouse footprint IS the balcony floor (the climb)
  if (GATES.atTop && Math.hypot(x - SPOTS.lighthouse.x, z - SPOTS.lighthouse.y) < GALLERY_RADIUS) return GALLERY_H;

  // the jetty deck: a real surface over the water (was a fall-through)
  if (Math.abs(x - JETTY.x) < JETTY.hx && Math.abs(z - JETTY.z) < JETTY.hz) return JETTY.y;

  // lighthouse interior: the study drum, plus the keeper's annex (now a walkable room)
  const dl = Math.hypot(x - SPOTS.lighthouse.x, z - SPOTS.lighthouse.y);
  if (dl < 5.4) return LIGHTHOUSE_H;
  if (Math.hypot(x - ANX, z - ANZ) < 2.8) return LIGHTHOUSE_H;   // annex floor (meets the drum disc at r5.4)

  // ruler bridge across the chasm
  if (GATES.bridgeUp) {
    const bz = SPOTS.chasmBridgeZ;
    if (Math.abs(z - bz) < 2.1 && x > 34 && x < 60) {
      return BRIDGE_DECK; // deck height, rim-to-rim
    }
  }

  // ---- CONNECTORS: the ways between the surface and the buried floors. These are
  // never ambiguous — standing on a stair IS being on the stair — so they answer
  // outright, before the two-floor test below.
  if (GATES.hatchOpen) {
    const lx = x - SPOTS.hatch.x, lz = z - SPOTS.hatch.y;
    // stair ramp: top inside the hole's north half, descending southward
    if (lx > -1.6 && lx < 1.6 && lz < 1.0 && lz > -8.6) {
      const t = clamp((1.0 - lz) / 7.0, 0, 1);
      return HATCH_H - 0.1 - t * 5.1;
    }
    // remainder of the open hole is a pit, not invisible ground
    if (Math.hypot(lx, lz) < 1.25) return HATCH_H - 5.2;
  }
  // the drain's throat: the ramp off the stones pad down into the chamber
  if (x >= 136.2 && x <= 142 && z > -151.5 && z < -148.5) {
    return 8.8 - clamp((142 - x) / 5.8, 0, 1) * 4.8;
  }

  // ---- TWO FLOORS: surface vs a buried room directly beneath it ----------------
  const surface = heightAt(x, z);
  const buried = buriedFloorAt(x, z);
  if (buried === null) return surface;
  // ABSOLUTE proximity, deliberately not "whichever floor is nearer": a fresh spawn
  // carries y=0, which is nearer the chamber floor (4.0) than the pad above it (8.8)
  // — nearest-of-two would drop every teleport into the basement. You are on the
  // buried floor only if you are standing essentially AT it.
  return Number.isFinite(fromY) && Math.abs(fromY - buried) < 2.0 ? buried : surface;
}

// Wall collision: the lighthouse and annex are rings with door gaps.
const LHX = SPOTS.lighthouse.x, LHZ = SPOTS.lighthouse.y;
const ANX = LHX + Math.sin(0.2618) * 8.1, ANZ = LHZ + Math.cos(0.2618) * 8.1;  // annex pushed clear of the drum
const deg = (d) => d * Math.PI / 180;

function ringBlocked(x0, z0, x1, z1, cx, cz, r, doorA0, doorA1) {
  const d0 = Math.hypot(x0 - cx, z0 - cz), d1 = Math.hypot(x1 - cx, z1 - cz);
  if ((d0 - r) * (d1 - r) >= 0) return false;        // not crossing the ring
  let az = Math.atan2(x1 - cx, z1 - cz);
  if (az < 0) az += Math.PI * 2;
  const inDoor = doorA0 < doorA1
    ? (az > doorA0 && az < doorA1)
    : (az > doorA0 || az < doorA1);
  return !inDoor;
}

// like ringBlocked but with several door gaps — block only if the wall is crossed AWAY from every gap.
function ringBlockedGaps(x0, z0, x1, z1, cx, cz, r, gaps) {
  const d0 = Math.hypot(x0 - cx, z0 - cz), d1 = Math.hypot(x1 - cx, z1 - cz);
  if ((d0 - r) * (d1 - r) >= 0) return false;        // not crossing the ring
  let az = Math.atan2(x1 - cx, z1 - cz);
  if (az < 0) az += Math.PI * 2;
  for (let i = 0; i < gaps.length; i++) {
    const a0 = gaps[i][0], a1 = gaps[i][1];
    const inDoor = a0 < a1 ? (az > a0 && az < a1) : (az > a0 || az < a1);
    if (inDoor) return false;                        // passing through a doorway
  }
  return true;                                       // crossed solid wall
}
// the drum's two openings: the beach door (az 160..170° — matches the right-sized visual
// doorway + its jambs, was 153..177 when the breach was wall-wide) and the annex doorway (az 5..25°)
// The drum's walkable openings. THE ANNEX DOORWAY IS ONLY AN OPENING WHEN THE DOOR
// IS OPEN. With it in the list unconditionally you could walk the annex gap at level 1
// — through the drum wall line at r 5.2 and on to r 5.30, which is where the SHUT inner
// door stands, so you ended up with your face inside a door the journal calls "shut
// fast" and the hotspot calls "a shut door". The only thing that stopped you was the
// annex FLOOR lock 10 cm further on, which is invisible. Owner, by F8: "I was trying
// to walk into the attached room, but walked thrugh the wall."
//
// The floor lock stays — it still guards the approach from outside, where there is no
// drum wall to stop you — but the door now stops you at the door.
const LH_GAPS_OPEN = [[deg(160), deg(170)], [deg(5), deg(25)]];
const LH_GAPS_SHUT = [[deg(160), deg(170)]];

// The vault outcrop used to be visual-only. A player could cross its surface,
// stand in its hollow backfaces, and mistake a shallow lens niche for a room.
// Keep the rock solid after the slab opens: the lens sits at arm's reach behind
// that slab. This is a destination invariant, not a stateful exception: no legal
// player step ever ends inside the rendered stone.
function vaultOutcropBlocked(x, z) {
  const V = VAULT_OUTCROP;
  const c = Math.cos(V.rotation), s = Math.sin(V.rotation);
  const dx = x - V.x, dz = z - V.z;
  const lx = c * dx - s * dz;
  const lz = s * dx + c * dz;
  return (lx * lx) / (V.colliderX * V.colliderX)
    + (lz * lz) / (V.colliderZ * V.colliderZ) < 1;
}

// EDGES. A narrow walkable structure standing above its surroundings — the jetty
// deck over the seabed, the drain's ramp trench cut into the stones pad — has SIDES,
// and the player kept walking off them: a 2 m drop inside one 7 cm stride, and in the
// jetty's case no way back up (the deck stands 2.2 m over the sand, and the climb
// limit is 1.05 m, so stepping off the side stranded you beside your own pier).
// Both are crossed lengthwise by design and never laterally, so block the long sides
// and leave the ends open. Symmetric: this also stops you falling INTO the trench
// from the pad above it.
function edgeBlocked(x0, z0, x1, z1) {
  // the jetty: walk along it (z), never off it (x)
  const onDeck = (x, z) => Math.abs(x - JETTY.x) < JETTY.hx && Math.abs(z - JETTY.z) < JETTY.hz;
  const inDeckSpan = (z) => Math.abs(z - JETTY.z) < JETTY.hz;
  if (onDeck(x0, z0) !== onDeck(x1, z1) && inDeckSpan(z0) && inDeckSpan(z1)) return true;

  // the drain ramp: enter from the pad at its east mouth, never over its long walls
  const inRamp = (x, z) => x >= 136.2 && x <= 142 && z > -151.5 && z < -148.5;
  const inRampSpan = (x) => x >= 136.2 && x <= 142;
  if (inRamp(x0, z0) !== inRamp(x1, z1) && inRampSpan(x0) && inRampSpan(x1)) return true;

  return false;
}

export function wallBlocked(x0, z0, x1, z1) {
  // up on the lamp-room gallery: the only wall is the balcony rail (keeps you from the 20m drop)
  if (GATES.atTop) return Math.hypot(x1 - LHX, z1 - LHZ) > GALLERY_PLAYER_RADIUS;

  if (edgeBlocked(x0, z0, x1, z1)) return true;

  if (vaultOutcropBlocked(x1, z1)) return true;

  // lighthouse wall: the beach door + the annex doorway
  if (ringBlockedGaps(x0, z0, x1, z1, LHX, LHZ, 5.2, GATES.annexOpen ? LH_GAPS_OPEN : LH_GAPS_SHUT)) return true;
  // annex wall: door faces the study (az ~187..207 from annex centre), locked until level 2 —
  // and it STAYS open once you have returned from the bottom ("the door, the coat — all as
  // you left them"): the surface after the descent keeps the quarters walkable.
  if (GATES.annexOpen) {
    if (ringBlocked(x0, z0, x1, z1, ANX, ANZ, 2.65, deg(185), deg(212))) return true;
  } else if (Math.hypot(x1 - ANX, z1 - ANZ) < 2.8) {
    // 2.8, not the wall's 2.65: the annex FLOOR disc is 2.8 (it has to be, to meet
    // the drum at r5.4 without a gap to fall through), so a 2.65 lock left a ring
    // of locked-room floor you could stand on at level 1. Lock the floor, not the wall.
    return true;
  }
  // solid scatter (shore rocks, …) — block stepping INTO a registered collider circle (the
  // player._step slide-resolves along x/z, so you brush past instead of sticking)
  for (let i = 0; i < COLLIDERS.length; i++) {
    const c = COLLIDERS[i];
    if ((x1 - c.x) * (x1 - c.x) + (z1 - c.z) * (z1 - c.z) < c.r * c.r) return true;
  }
  return false;
}

// ----------------------------------------------------------------------------
// Geometry
export function buildTerrain() {
  const N = 256; // segments
  let geo = new THREE.PlaneGeometry(DOMAIN, DOMAIN, N, N);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const slopes = new Float32Array(pos.count);   // baked slope → fragment rock-swap (#36)
  const r = mulberry32(SEED ^ 0x51ab);

  const cSand = new THREE.Color(0xe3d2a4);
  const cSandWet = new THREE.Color(0x9d8d6b);
  const cGrass = new THREE.Color(0xc2a45c);
  const cGrassOlive = new THREE.Color(0x8d8a4a);
  const cRock = new THREE.Color(0xc9c1ad);
  const cRockDark = new THREE.Color(0x7d7668);
  // THE MEADOW WAS ONE COLOUR. cGrass and cGrassOlive are both desaturated yellows, so
  // however they were mixed the open ground came out as a single pale field — the biggest
  // flat surface in the game and the one with the least in it. Two more anchors: a real
  // GREEN for the damp ground, and a heather brown for the dry exposed patches. A meadow
  // is not one hue, it is a patchwork, and the patches are what make it read as ground
  // rather than as a backdrop. Vertex colours, so it costs nothing at runtime.
  const cGrassGreen = new THREE.Color(0x6d7c40);
  const cHeather = new THREE.Color(0x9a7f57);
  const cSeabed = new THREE.Color(0x33514e);
  const cSeabedDeep = new THREE.Color(0x16313c);
  const tmp = new THREE.Color();
  const tSand = new THREE.Color(), tGrass = new THREE.Color(), tRock = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);

    // slope estimate
    const e = 1.5;
    const sx = heightAt(x + e, z) - heightAt(x - e, z);
    const sz = heightAt(x, z + e) - heightAt(x, z - e);
    const slope = Math.min(1, Math.hypot(sx, sz) / (2 * e) * 1.6);
    slopes[i] = slope;

    const n = fbm(x * 0.05 + 31, z * 0.05 + 17, 3);

    if (h < -2.5) {
      tmp.lerpColors(cSeabedDeep, cSeabed, smoothstep(-9, -2.5, h));
    } else if (h < 0.8) {
      tmp.lerpColors(cSeabed, cSandWet, smoothstep(-2.5, 0.4, h));
    } else {
      // land bands, edge-softened (#41): the old hard if/else at slope 0.62/0.45 and
      // h 2.6 left categorical grass/rock edges crawling along cliff tops. Same palette
      // anchors and same per-band lerps as before — only the band CHOICE changed, from a
      // categorical pick to a smoothstep mix across each threshold (CPU-only at build,
      // still plain vertex colors: zero runtime cost).
      tSand.lerpColors(cSandWet, cSand, smoothstep(0.8, 2.0, h));
      tRock.lerpColors(cRock, cRockDark, smoothstep(0.6, 1.0, slope));
      // +/-3% lightness was invisible past a few metres, which is why the sea cliffs read
      // as blank pale walls from across the meadow. Bands differ in WARMTH as well as
      // value now — real bedding is different rock, not the same rock lit differently.
      tRock.offsetHSL(Math.sin(h * 1.7 + 0.8) * 0.012, Math.sin(h * 2.3) * 0.05,
        Math.sin(h * 1.7) * 0.075);                            // limestone strata bands
      tGrass.lerpColors(cGrass, cGrassOlive, n);
      // two more noise fields, at scales the eye reads as different things: ~60 m for
      // where the ground is damp enough to be properly green, ~11 m for the drier
      // heather mottle inside it. Both continuous, so there is no tile to find — the
      // house rule that killed the old albedo grid applies to colour as much as texture.
      const nDamp = fbm(x * 0.017 - 61, z * 0.017 + 44, 3);
      const nPatch = fbm(x * 0.09 + 7, z * 0.09 - 23, 2);
      tGrass.lerp(cGrassGreen, smoothstep(0.42, 0.86, nDamp) * 0.80);
      tGrass.lerp(cHeather, smoothstep(0.60, 0.95, nPatch) * 0.40);
      tGrass.offsetHSL(0, 0, (slope - 0.2) * -0.12);
      // grass -> rock across the old slope 0.62 cut
      tmp.lerpColors(tGrass, tRock, smoothstep(0.54, 0.70, slope));
      // sand holds where the ground is BOTH low (h < 2.6) and gentle (slope < 0.45);
      // fade it out across each of those old cuts instead of snapping
      const wSand = (1 - smoothstep(2.2, 3.0, h)) * (1 - smoothstep(0.38, 0.52, slope));
      tmp.lerp(tSand, wSand);
    }
    // global gentle noise so nothing is flat-colored
    // and a wider per-vertex jitter. At hue +/-0.006 and lightness +/-0.025 this was doing
    // almost nothing; the ground needs grain at the vertex scale as well as the patch
    // scale or the patches themselves read as flat regions. Same ONE r() draw per vertex,
    // so the shared stream is not shifted.
    tmp.offsetHSL((r() - 0.5) * 0.022, (r() - 0.5) * 0.07, (n - 0.5) * 0.085);

    colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
  }

  // ---- ambient occlusion bake (#4) ----------------------------------------
  // A vertex sunk below its surroundings — the chasm, the drained basin, the
  // folds at a cliff's foot — catches less skylight. Read the eight neighbours
  // straight from the finished height grid (FREE: no extra heightAt, so load
  // stays snappy) and darken by how far below the ring average each point sits;
  // convex ridges are untouched. Power-neutral by construction (vertex colours →
  // +0 draws / +0 runtime) and grade-safe (multiplies the base, so the contact
  // shadow reads in every light).
  const W1 = N + 1;            // 257 vertices per side
  const R = 3;                 // ~7.3 m ring (DOMAIN/N ≈ 2.42 m / cell)
  const clamp01 = (n) => (n < 0 ? 0 : n > N ? N : n);
  const yAt = (c, rw) => pos.getY(clamp01(c) + clamp01(rw) * W1);
  for (let i = 0; i < pos.count; i++) {
    const c = i % W1, rw = (i / W1) | 0;
    const ring = (yAt(c + R, rw) + yAt(c - R, rw) + yAt(c, rw + R) + yAt(c, rw - R) +
      yAt(c + R, rw + R) + yAt(c - R, rw + R) + yAt(c + R, rw - R) + yAt(c - R, rw - R)) * 0.125;
    const concave = ring - pos.getY(i);            // > 0 in cavities
    if (concave > 0) {
      const ao = 1 - Math.min(0.3, concave * 0.05); // up to 30% darker in deep folds
      colors[i * 3] *= ao; colors[i * 3 + 1] *= ao; colors[i * 3 + 2] *= ao;
    }
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('aSlope', new THREE.BufferAttribute(slopes, 1));   // fragment rock-swap key (#36)
  geo.computeVertexNormals();

  // The uniform grid is intentionally affordable, but its 2.42 m cells become a
  // staircase where a tide cuts a steep shelf. Replace only the cells that cross the
  // complete story tide range with local analytic patches. Unlike a radial collar,
  // this follows the real topology through the chasm, causeway and islet; unlike an
  // overlay, it cannot z-fight or leave the coarse shelf poking through. The patch
  // boundary is locked to the old cell edges, so it remains watertight while the
  // visible surface cut is resolved at sub-metre scale. Permanently deep seabed pays
  // for that finish, so the whole terrain remains one lean mesh and one draw.
  geo = refineCoastCells(geo, N);

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    // flatShading OFF (loop #152): the hard low-poly facet seams read as flat plastic once the tiling
    // grain was removed. Smooth vertex normals (computeVertexNormals above) blend the facets; the
    // procedural detail-normal bump in onBeforeCompile supplies the surface's 3-D structure instead.
    flatShading: false,
    roughness: 0.95,
    metalness: 0.0,
    side: THREE.DoubleSide, // chasm/valley walls + the underside read solid, never see-through
  });
  // Machine-readable because a repeated height image can compile and decode perfectly
  // while still turning the beach into visible wallpaper.
  mat.userData.sandRelief = {
    textureSamples: 0, worldSpan: DOMAIN, encoding: 'analytic-slope',
    continuous: true, locallyTurning: true, repeatPeriod: 0,
  };
  mat.userData.coastRefinement = geo.userData.coastRefinement;
  // cut the hatch hole into the heightfield (local space, so the model
  // island inherits the same hole — recursion demands it)
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uHaze = { value: new THREE.Color(0xcfe3e8) };
    sh.uniforms.uTexAmt = { value: 0.7 };   // strength of the procedural sand-grain luminance detail
    // waterline pass (#47/#38): the tide line, in OBJECT space so the 1:240 clone inherits it
    sh.uniforms.uWaterY = { value: 0 };
    sh.uniforms.uTime = { value: 0 };
    sh.uniforms.uSunUp = { value: 1 };                       // daylight gate for the caustics
    sh.uniforms.uCaustic = { value: getTexture('water_ripple') };
    // a 1x1 black stand-in: a sampler2D uniform bound to null is undefined behaviour, and
    // the mask is legitimately absent on the 1:240 clone and in any build with no trees
    sh.uniforms.uLitter = { value: LITTER.tex || _blankTex() };
    sh.uniforms.uLitterOn = { value: LITTER.tex ? 1 : 0 };
    sh.uniforms.uPathAmt = { value: 0.0 };   // driven by depth in main.js — see the paths block
    sh.uniforms.uLitterRect = { value: new THREE.Vector3(LITTER.cx, LITTER.cz, LITTER.size || 1) };
    // NOTE (loop #154): the old uSand/uGrass tiling-texture samplers + uTexScale were removed when #152
    // replaced the tiled sand/dune-grass luminance (the owner-flagged GRID) with procedural grain. The
    // 3-D world no longer fetches either texture; dunegrass was deleted, while sand.jpg remains solely
    // as the CSS-native shore-writing surface (see ASSETS.md).
    mat.userData.shader = sh; // so main.js can track uHaze to the active grade's fog
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aSlope;\nvarying vec2 vLXZ;\nvarying vec3 vWPos;\nvarying float vTerH;\nvarying float vSlope;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vLXZ = position.xz;
        vTerH = position.y;                                   // baked height (the band key)
        vSlope = aSlope;                                      // baked slope (the rock-swap key, #36)
        vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 uHaze; uniform float uTexAmt;
        uniform float uWaterY; uniform float uTime; uniform float uSunUp;
        uniform sampler2D uCaustic;
        uniform sampler2D uLitter; uniform float uLitterOn; uniform vec3 uLitterRect;
        uniform float uPathAmt;
        varying vec2 vLXZ; varying vec3 vWPos; varying float vTerH; varying float vSlope;
        float gSandLee;
        float hash21(vec2 p){p=fract(p*vec2(234.34,435.345));p+=dot(p,p+34.23);return fract(p.x*p.y);}
        float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.0-2.0*f);float a=hash21(i),b=hash21(i+vec2(1,0)),c=hash21(i+vec2(0,1)),d=hash21(i+vec2(1,1));return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);}`)
      .replace('#include <clipping_planes_fragment>',
        `if (distance(vLXZ, vec2(${SPOTS.hatch.x.toFixed(1)}, ${SPOTS.hatch.y.toFixed(1)})) < 1.22) discard;\n#include <clipping_planes_fragment>`)
      // MICRO-RELIEF (loop #152, owner: "depth on meshes"): the ground was flat-lit — with the tiling
      // grain gone, the bare low-poly facets showed through. Add a tangent-free, derivative-based
      // detail-normal bump (Mikkelsen) driven by procedural sand grain + gentle wind ripples, so the
      // surface catches light with real 3-D ripple structure. Reuses `grain` for the albedo below.
      // bAmt fades the bump out with distance (no far-field shimmer) and on the 1:240 clone (`mini`).
      .replace('#include <normal_fragment_begin>', `
        #include <normal_fragment_begin>
        float gScl  = (fwidth(vWPos.x) + fwidth(vWPos.z)) / max(fwidth(vLXZ.x) + fwidth(vLXZ.y), 1e-6);
        float mini  = 1.0 - smoothstep(0.05, 0.5, gScl);      // ~1 on the dense 1:240 clone
        float land0 = smoothstep(0.3, 1.1, vTerH);            // off the seabed / waterline
        // RELIEF = gentle, LOW-frequency wind ripples only. High-freq grain in the NORMAL reads as a
        // harsh per-pixel dapple (looks scaly, not sandy) — fine grain stays in albedo; the bump just
        // gives the surface a soft 3-D roll so it isn't flat-lit. Amplitude kept low on purpose.
        float roll = vnoise(vLXZ * 1.1) - 0.5;               // soft ~0.9m undulation
        float sandW = 1.0 - smoothstep(2.2, 3.4, vTerH);
        float bDist = 1.0 - smoothstep(45.0, 130.0, length(vViewPosition));
        vec2 sandSlope = vec2(0.0);
        gSandLee = 0.0;
        // Wind relief is solved analytically in world metres rather than sampled from
        // an image. Two incommensurate macro waves turn the primary set over tens of
        // metres; two smaller phase waves bow each crest. Nothing tiles, and there are
        // no texture LOD blocks to masquerade as giant stamped squares at grazing view.
        // This coherent branch matters: most terrain pixels are meadow, cliff, the
        // miniature, or beyond the detail fade. They should not pay for invisible sand.
        if (sandW > 0.001 && bDist > 0.001 && mini < 0.999) {
          float sandTurnField =
            sin(dot(vLXZ, vec2(0.034, 0.027)) + sin(vLXZ.y * 0.021) * 1.15)
            + sin(dot(vLXZ, vec2(-0.029, 0.041)) + 1.3) * 0.53;
          float sandTurn = smoothstep(-0.24, 0.24, sandTurnField);
          vec2 sandDA = normalize(vec2(0.90, 0.44));
          vec2 sandDB = normalize(vec2(0.48, -0.88));
          float sandBendA =
            sin(dot(vLXZ, vec2(0.089, 0.053)) + 0.8) * 0.88
            + sin(dot(vLXZ, vec2(-0.047, 0.073)) - 1.1) * 0.43;
          float sandBendB =
            sin(dot(vLXZ, vec2(-0.061, 0.081)) - 0.2) * 0.76
            + sin(dot(vLXZ, vec2(0.077, 0.039)) + 2.0) * 0.38;
          float sandPA = dot(vLXZ, sandDA) * 3.35 + sandBendA;
          float sandPB = dot(vLXZ, sandDB) * 3.08 + sandBendB + 1.7;
          float sandPatch = 0.76 + 0.24 * smoothstep(-0.72, 0.72,
            sin(dot(vLXZ, vec2(0.051, -0.037)) - 0.6)
            + sin(dot(vLXZ, vec2(0.023, 0.057)) + 0.9) * 0.45);
          // Explicit slopes avoid dFdx/dFdy precision bands. Each main set has a faint
          // second harmonic to pinch its leeward edge; exchanging dominance makes real
          // bifurcations instead of one perfectly combed direction rotating forever.
          vec2 sandSlopeA = sandDA
            * (cos(sandPA) + 0.25 * cos(sandPA * 2.0 + 0.65)) * 0.138;
          vec2 sandSlopeB = sandDB
            * (cos(sandPB) + 0.22 * cos(sandPB * 2.0 - 0.35)) * 0.132;
          vec2 sandCrossD = normalize(mix(vec2(-sandDA.y, sandDA.x), vec2(-sandDB.y, sandDB.x), sandTurn));
          float sandCrossP = dot(vLXZ, sandCrossD) * 5.75
            + sin(dot(vLXZ, vec2(0.065, -0.044)) + 0.4) * 0.42;
          sandSlope = mix(sandSlopeA, sandSlopeB, sandTurn) * sandPatch
            + sandCrossD * cos(sandCrossP) * 0.028;
          // Sand is not perfectly colourless: the lee face holds slightly darker,
          // finer grains. Carry that orientation into albedo so high noon does not
          // erase every ripple. This reuses the slope we already paid for.
          vec2 sandWind = normalize(mix(sandDA, sandDB, sandTurn));
          gSandLee = clamp(dot(sandSlope, sandWind) / 0.17, -1.0, 1.0);
        }
        float Hb = roll * 0.42;
        // The old authored 512² image repeated its complete shape every 6.25 m. The
        // analytic carriers above have no common period within the 620 m island.
        // SLOPE-AWARE ROCK RELIEF (#36): above ~0.5 baked slope the bump SWAPS (never
        // stacks — same one evaluation) from wind-ripple sand to a cliff language:
        // horizontal STRATA keyed on the baked height (so the bands double as old
        // waterlines at the raised SEA-STRATA tides) + fracture chips. The low-frequency
        // strata carry far past the sand's 130m fade — the east bluff reads as bedded
        // rock from the 170m glyph-puzzle study, not a featureless wall.
        float rockW  = smoothstep(0.42, 0.62, vSlope);
        // beds: bold ~3.7m bands, phase-meandered so they undulate like real bedding, with
        // a fainter internal lamination; on a near-vertical wall the in-plane coordinates
        // are (along-wall, height), so the fracture noise samples exactly that plane —
        // sampling xz alone left it constant across the face (read as diagonal static)
        float sPhase = vnoise(vLXZ * 0.33) * 2.4;
        float strata = sin(vTerH * 1.7 + sPhase) + 0.35 * sin(vTerH * 3.9 + sPhase * 1.7);
        float chip   = vnoise(vec2(vLXZ.x + vLXZ.y, vTerH * 1.3) * 1.15) - 0.5;
        float bDistR = 1.0 - smoothstep(150.0, 460.0, length(vViewPosition));
        float Hr     = strata * 0.55 * bDistR + chip * 0.5 * bDist;
        float Hmix   = mix(Hb, Hr, rockW);
        float bAmt  = 0.20 * land0 * mix(bDist, 1.0, rockW) * (1.0 - mini);
        vec2 dHdxy  = vec2(dFdx(Hmix), dFdy(Hmix)) * bAmt;
        vec3 bSx = dFdx(-vViewPosition), bSy = dFdy(-vViewPosition);
        vec3 bR1 = cross(bSy, normal), bR2 = cross(normal, bSx);
        float bDet = dot(bSx, bR1);
        vec3 bGrad = sign(bDet) * (dHdxy.x * bR1 + dHdxy.y * bR2);
        normal = normalize(abs(bDet) * normal - bGrad);
        // Apply the analytic world-XZ derivative directly in view space.
        vec3 sandDelta = mat3(viewMatrix) * vec3(-sandSlope.x, 0.0, -sandSlope.y);
        normal = normalize(normal + sandDelta * sandW * bDist * (1.0 - mini) * (1.0 - rockW));`)
      // ground DETAIL (loop #152): the old approach TILED the uSand/uGrass texture as luminance —
      // its baked grain recurred every ~1.18m and read as a pock-mark GRID (owner-flagged); every
      // warp to hide the tile just traded the grid for a smear. Replaced with CONTINUOUS procedural
      // grain (no tile → no grid → no smear) multiplied as luminance so the vertex-coloured bands
      // keep their hue. Self-contained (the <normal_fragment_begin> block is a separate GLSL scope,
      // so we recompute here rather than share). -2 texture fetches; +0 draws.
      .replace('#include <color_fragment>', `
        #include <color_fragment>
        float cScl  = (fwidth(vWPos.x) + fwidth(vWPos.z)) / max(fwidth(vLXZ.x) + fwidth(vLXZ.y), 1e-6);
        float cMini = 1.0 - smoothstep(0.05, 0.5, cScl);
        float cLand = smoothstep(0.3, 1.1, vTerH);           // off the seabed / waterline
        float cGrain = vnoise(vLXZ * 2.6) * 0.62 + vnoise(vLXZ * 6.7 + 5.0) * 0.38;
        float macro = vnoise(vLXZ * 0.085 + 2.0);            // big soft swell (~12m), continuous
        float fine  = vnoise(vLXZ * 0.42 + 17.0);            // mid variation (NOT a per-tile grid)
        float deGrid = (0.86 + 0.26 * macro) * (0.93 + 0.14 * fine);
        float detail = mix(0.82, 1.07, cGrain) * mix(1.0, deGrid, 1.0 - cMini);
        diffuseColor.rgb *= mix(1.0, detail, uTexAmt * cLand * (1.0 - cMini * 0.85));
        float cSandW = (1.0 - smoothstep(2.2, 3.4, vTerH))
          * (1.0 - smoothstep(0.38, 0.52, vSlope));
        diffuseColor.rgb *= 1.0 + gSandLee * 0.024 * cSandW * (1.0 - cMini);
        // rock strata in ALBEDO too (#36): the normal-map beds wash out in the aerial haze
        // at the 170m glyph-puzzle study range — a gentle lightness banding survives it,
        // so the east bluff finally reads as BEDDED rock from the stones, not a blank wall
        float aPhase = vnoise(vLXZ * 0.33) * 2.4;
        float aStrata = sin(vTerH * 1.7 + aPhase) * 0.5 + 0.5;
        // gate aligned with the #41 grass->rock COLOUR transition (slope .54-.70) so the
        // lightness bands land only on rock-coloured faces, never as mow-lines on grass
        float aRockW = smoothstep(0.50, 0.66, vSlope);
        diffuseColor.rgb *= mix(1.0, 0.88 + 0.18 * aStrata, aRockW * (1.0 - cMini));
        // WATERLINE PASS — keys off uWaterY in OBJECT space (vTerH is the baked local height,
        // the sea sits at local y = uWaterY), so the band RIDES the tide at every SEA-STRATA
        // level and the 1:240 chart-table clone inherits the same tide line for free.
        float wEdge = (vnoise(vLXZ * 0.6) - 0.5) * 0.34;   // meander the line — no ruler edges
        float wDepth = uWaterY - vTerH + wEdge;             // >0 = submerged
        // wet swash band (#47): the metre above the line reads soaked — darker, cooler
        float wet = smoothstep(0.9, 0.12, -wDepth) * (1.0 - smoothstep(0.05, 0.5, wDepth));
        wet *= 1.0 - cMini * 0.4;
        diffuseColor.rgb *= mix(1.0, 0.64, wet);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.93, 0.99, 1.05), wet);
        // submerged shift (#38): light dies warm-first — the drowned floor cools with depth
        float subm = 1.0 - exp(-max(wDepth, 0.0) * 0.55);
        diffuseColor.rgb *= mix(vec3(1.0), vec3(0.55, 0.76, 0.80), subm * (1.0 - cMini * 0.5));
        // caustics (#38): two counter-scrolled dapple samples — their min makes travelling
        // bright cells. Banded to the sunlit shallows, gone by ~4.5 m and on the 1:240 clone.
        vec2 cuv1 = vLXZ * 0.100 + vec2(uTime * 0.020, -uTime * 0.016);
        vec2 cuv2 = vLXZ * 0.117 + vec2(-uTime * 0.017, uTime * 0.021);
        float cl1 = dot(texture2D(uCaustic, cuv1).rgb, vec3(0.299, 0.587, 0.114));
        float cl2 = dot(texture2D(uCaustic, cuv2).rgb, vec3(0.299, 0.587, 0.114));
        float caus = smoothstep(0.50, 0.88, min(cl1, cl2));
        float causBand = smoothstep(0.06, 0.5, wDepth) * (1.0 - smoothstep(2.6, 4.5, wDepth));
        diffuseColor.rgb *= 1.0 + caus * causBand * uSunUp * 1.1 * (1.0 - cMini);
        // NEEDLE LITTER (see LITTER above). The mask says WHERE the conifers have dropped;
        // the grain below is what makes it read as needles rather than as a stain, and it
        // is evaluated per fragment so it stays sharp however coarse the mask is.
        if (uLitterOn > 0.5) {
          vec2 lu = (vLXZ - uLitterRect.xy) / uLitterRect.z + 0.5;
          vec2 lc = clamp(lu, 0.0, 1.0);
          float inside = step(0.0, lu.x) * step(lu.x, 1.0) * step(0.0, lu.y) * step(lu.y, 1.0);
          float lm = texture2D(uLitter, lc).r * inside * cLand;
          float lgrain = vnoise(vLXZ * 5.1) * 0.58 + vnoise(vLXZ * 14.3 + 7.0) * 0.42;
          // toward an ACTUAL needle colour, not a multiply of the ground. Scaling a tan
          // meadow by (0.66,0.56,0.42) shifts it barely at all — verified by painting the
          // mask red, which showed it landing perfectly and simply not reading.
          float lamt = smoothstep(0.02, 0.34, lm) * (0.55 + 0.45 * lgrain);
          vec3 needles = vec3(0.215, 0.155, 0.088) * (0.72 + 0.58 * lgrain);
          diffuseColor.rgb = mix(diffuseColor.rgb, needles, min(0.86, lamt));
          // WORN PATHS ride in the mask's GREEN channel — same texture, same fetch. Turf
          // walked thin shows the ground through it: a little lighter, a little browner,
          // never a stripe. It takes the same grain as the litter so it breaks up like
          // ground rather than reading as paint, and uPathAmt keeps it deniable until
          // you have been down far enough to know what it is.
          float pm = texture2D(uLitter, lc).g * inside * cLand;
          // A 14% lightening was invisible at eye height, where a path is foreshortened
          // to almost nothing — measured against uPathAmt 0 and the frames were the same
          // picture. Worn turf goes to bare earth, so it shifts HUE as well as value.
          float pamt = smoothstep(0.06, 0.55, pm) * uPathAmt * (0.60 + 0.40 * lgrain);
          vec3 worn = mix(diffuseColor.rgb, vec3(0.40, 0.335, 0.225), 0.70) * (1.06 + 0.18 * lgrain);
          diffuseColor.rgb = mix(diffuseColor.rgb, worn, pamt);
        }
      `)
      // aerial perspective (#5a): the FAR land melts toward the grade's haze before
      // global fog reaches it — depth + vastness without washing the near/mid ground
      // (gentle, begins at 170 m); fragment-only, +0 draws. Matches the canopy haze.
      .replace('#include <fog_fragment>', `
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uHaze, smoothstep(170.0, 520.0, length(vViewPosition)) * 0.3);
        #include <fog_fragment>`);
  };

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'terrain';
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  return mesh;
}

function refineCoastCells(base, N) {
  const LOW = -5.8;             // safely below the lowest authored tide (-4.2 m)
  const SURFACE_HIGH = 1.2;     // soaked shore above the surface-era high tide (0 m)
  const HIGH = 4.35;            // above the deepest story tide / debug maximum (+4.2 m)
  const MIN_RISE = 1.0;         // gentle beaches do not make a visible staircase
  const SURFACE_SUB = 4;        // 0.605 m at the owner-visible surface coastline
  const RAISED_SUB = 3;         // 0.807 m through the foggier drowned eras
  // Stable sea planes from the valve and the authored level rows. Steep cells are
  // refined throughout the range; these exact stops also catch quiet, shallow banks.
  const SURFACE_LEVELS = [-4.2, 0.0];
  const RAISED_LEVELS = [1.47, 2.73, 3.78, 4.2];
  const DEEP_BLOCKS = [16, 8, 4];
  const DEEP_CEILING = -9.5;    // always >=5.3 m underwater, even at the lowest tide
  const W = N + 1;
  const bp = base.getAttribute('position');
  const bn = base.getAttribute('normal');
  const bc = base.getAttribute('color');
  const bu = base.getAttribute('uv');
  const bs = base.getAttribute('aSlope');
  const refinement = new Uint8Array(N * N);
  const deepCovered = new Uint8Array(N * N);
  const deepOrigin = new Uint8Array(N * N);
  let refinedCells = 0, surfaceCells = 0, raisedCells = 0, addedTriangles = 0, addedVertices = 0;

  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
      const y0 = bp.getY(a), y1 = bp.getY(b), y2 = bp.getY(c), y3 = bp.getY(d);
      const lo = Math.min(y0, y1, y2, y3), hi = Math.max(y0, y1, y2, y3);
      const rise = hi - lo;
      const crosses = (levels) => levels.some((level) => lo <= level && hi >= level);
      let sub = 0;
      if (lo < SURFACE_HIGH && hi > LOW && (rise > MIN_RISE || crosses(SURFACE_LEVELS))) {
        sub = SURFACE_SUB; surfaceCells++;
      } else if (lo < HIGH && hi > SURFACE_HIGH && (rise > MIN_RISE || crosses(RAISED_LEVELS))) {
        sub = RAISED_SUB; raisedCells++;
      }
      if (!sub) continue;
      refinement[j * N + i] = sub;
      refinedCells++;
      addedTriangles += sub * sub * 2 - 2;
      addedVertices += (sub + 1) * (sub + 1);
    }
  }

  // Pay for the coast locally. The far offshore floor still carried two triangles
  // per 2.42 m cell even when it is never less than 5.3 m underwater. A descending
  // 16/8/4-cell cascade keeps every block's boundary vertices plus its original centre
  // and fans the interior. It stays watertight and keeps the authored edge; only its
  // gently varying, optically buried interior is simplified. Smaller fallbacks fill
  // safe boundary pockets the 16-cell grid cannot claim, returning the coast's entire
  // triangle cost instead of leaving a hidden power debt.
  let deepBlocks = 0, deepCells = 0, deepFanTriangles = 0, removedDeepTriangles = 0;
  const deepBlocksBySize = {};
  for (const block of DEEP_BLOCKS) {
    let count = 0;
    for (let j = 0; j < N; j += block) {
      for (let i = 0; i < N; i += block) {
        let used = false;
        for (let dz = 0; dz < block && !used; dz++) {
          for (let dx = 0; dx < block; dx++) {
            if (deepCovered[(j + dz) * N + i + dx]) { used = true; break; }
          }
        }
        if (used) continue;
        let hi = -Infinity;
        for (let dz = 0; dz <= block; dz++) {
          for (let dx = 0; dx <= block; dx++) {
            hi = Math.max(hi, bp.getY((j + dz) * W + i + dx));
          }
        }
        if (hi >= DEEP_CEILING) continue;
        deepOrigin[j * N + i] = block;
        deepBlocks++; count++; deepCells += block * block;
        deepFanTriangles += block * 4;
        removedDeepTriangles += block * block * 2 - block * 4;
        for (let dz = 0; dz < block; dz++) {
          for (let dx = 0; dx < block; dx++) deepCovered[(j + dz) * N + i + dx] = 1;
        }
      }
    }
    deepBlocksBySize[block] = count;
  }

  const vertexCount = bp.count + addedVertices;
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const slopes = new Float32Array(vertexCount);
  positions.set(bp.array); normals.set(bn.array); colors.set(bc.array);
  uvs.set(bu.array); slopes.set(bs.array);

  const ordinaryCells = N * N - refinedCells - deepCells;
  const triangleCount = ordinaryCells * 2 + refinedCells * 2 + addedTriangles + deepFanTriangles;
  const indices = new Uint32Array(triangleCount * 3);
  let q = 0, nextVertex = bp.count;

  const sample = (attr, x, z, size, out, off) => {
    const gx = clamp((x / DOMAIN + 0.5) * N, 0, N - 1e-6);
    const gz = clamp((z / DOMAIN + 0.5) * N, 0, N - 1e-6);
    const ix = Math.floor(gx), iz = Math.floor(gz), tx = gx - ix, tz = gz - iz;
    const ids = [iz * W + ix, iz * W + ix + 1, (iz + 1) * W + ix, (iz + 1) * W + ix + 1];
    for (let k = 0; k < size; k++) {
      const a = lerp(attr.array[ids[0] * size + k], attr.array[ids[1] * size + k], tx);
      const b = lerp(attr.array[ids[2] * size + k], attr.array[ids[3] * size + k], tx);
      out[off + k] = lerp(a, b, tz);
    }
  };
  const refinementAt = (i, j) => i >= 0 && i < N && j >= 0 && j < N ? refinement[j * N + i] : 0;
  const edgeHeight = (i, j, sub, ix, iz, x, z) => {
    const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
    // Only equal-resolution neighbours share analytic edge points. Every other seam
    // stays on the old straight edge: the finer side may add collinear vertices, but
    // it cannot open a T-junction crack against a coarse or differently refined side.
    // Corners always retain the original grid vertex exactly.
    if ((ix === 0 || ix === sub) && (iz === 0 || iz === sub)) {
      return bp.getY(iz === 0 ? (ix === 0 ? a : b) : (ix === 0 ? c : d));
    }
    if (iz === 0 && refinementAt(i, j - 1) !== sub) return lerp(bp.getY(a), bp.getY(b), ix / sub);
    if (iz === sub && refinementAt(i, j + 1) !== sub) return lerp(bp.getY(c), bp.getY(d), ix / sub);
    if (ix === 0 && refinementAt(i - 1, j) !== sub) return lerp(bp.getY(a), bp.getY(c), iz / sub);
    if (ix === sub && refinementAt(i + 1, j) !== sub) return lerp(bp.getY(b), bp.getY(d), iz / sub);
    return heightAt(x, z);
  };

  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const coarseA = j * W + i, coarseB = coarseA + 1;
      const coarseC = coarseA + W, coarseD = coarseC + 1;
      const sub = refinementAt(i, j);
      if (deepCovered[j * N + i]) {
        const block = deepOrigin[j * N + i];
        if (block) {
          const centre = (j + block / 2) * W + i + block / 2;
          const rim = [];
          for (let dz = 0; dz <= block; dz++) rim.push((j + dz) * W + i);
          for (let dx = 1; dx <= block; dx++) rim.push((j + block) * W + i + dx);
          for (let dz = block - 1; dz >= 0; dz--) rim.push((j + dz) * W + i + block);
          for (let dx = block - 1; dx >= 1; dx--) rim.push(j * W + i + dx);
          for (let k = 0; k < rim.length; k++) {
            indices[q++] = centre;
            indices[q++] = rim[k];
            indices[q++] = rim[(k + 1) % rim.length];
          }
        }
        continue;
      }
      if (!sub) {
        indices[q++] = coarseA; indices[q++] = coarseC; indices[q++] = coarseB;
        indices[q++] = coarseC; indices[q++] = coarseD; indices[q++] = coarseB;
        continue;
      }

      const first = nextVertex;
      const x0 = bp.getX(coarseA), x1 = bp.getX(coarseB);
      const z0 = bp.getZ(coarseA), z1 = bp.getZ(coarseC);
      for (let iz = 0; iz <= sub; iz++) {
        for (let ix = 0; ix <= sub; ix++) {
          const tx = ix / sub, tz = iz / sub;
          const x = lerp(x0, x1, tx), z = lerp(z0, z1, tz);
          const p = nextVertex++, p3 = p * 3;
          positions[p3] = x;
          positions[p3 + 1] = edgeHeight(i, j, sub, ix, iz, x, z);
          positions[p3 + 2] = z;
          sample(bn, x, z, 3, normals, p3);
          const nl = Math.hypot(normals[p3], normals[p3 + 1], normals[p3 + 2]) || 1;
          normals[p3] /= nl; normals[p3 + 1] /= nl; normals[p3 + 2] /= nl;
          sample(bc, x, z, 3, colors, p3);
          sample(bs, x, z, 1, slopes, p);
          uvs[p * 2] = x / DOMAIN + 0.5;
          uvs[p * 2 + 1] = z / DOMAIN + 0.5;
        }
      }
      for (let iz = 0; iz < sub; iz++) {
        for (let ix = 0; ix < sub; ix++) {
          const a = first + iz * (sub + 1) + ix, b = a + 1;
          const c = a + sub + 1, d = c + 1;
          indices[q++] = a; indices[q++] = c; indices[q++] = b;
          indices[q++] = c; indices[q++] = d; indices[q++] = b;
        }
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute('aSlope', new THREE.BufferAttribute(slopes, 1));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  geo.computeBoundingSphere();
  geo.userData.coastRefinement = {
    method: 'adaptive-cell-replacement', subdivisions: { surface: SURFACE_SUB, raised: RAISED_SUB },
    baseCellMetres: DOMAIN / N,
    refinedCellMetres: { surface: DOMAIN / N / SURFACE_SUB, raised: DOMAIN / N / RAISED_SUB },
    tideBand: [LOW, HIGH], minimumRise: MIN_RISE,
    stableTideLevels: [...SURFACE_LEVELS, ...RAISED_LEVELS],
    refinedCells, surfaceCells, raisedCells, addedTriangles,
    deepBlocks, deepBlockCells: DEEP_BLOCKS, deepBlocksBySize, deepCeiling: DEEP_CEILING,
    removedDeepTriangles,
    watertight: true, topologyPreserving: true,
  };
  return geo;
}

// height texture for the water shader (depth → color/foam)
export function buildHeightTexture() {
  // half-float: linear filtering of fp16 is core WebGL2; fp32 linear is not
  // 512² is still only 0.5 MiB, costs the fragment shader the same single fetch,
  // and halves the world-space step of the water's depth/foam mask. The shoreline
  // is therefore described every 1.21 m rather than every 2.42 m without
  // submitting a single extra terrain triangle.
  const N = 512;
  const data = new Uint16Array(N * N);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x = (i / (N - 1) - 0.5) * DOMAIN;
      const z = (j / (N - 1) - 0.5) * DOMAIN;
      data[j * N + i] = THREE.DataUtils.toHalfFloat(heightAt(x, z));
    }
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RedFormat, THREE.HalfFloatType);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}
