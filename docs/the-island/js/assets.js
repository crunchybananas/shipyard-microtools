// assets.js — the single front door for every generated ASSET file (textures,
// voice, music, meshes). One MANIFEST is the one place that knows each asset's
// file, byte size, LICENSE and provenance (which model + prompt made it); one
// loader applies the right settings and CACHES, so nothing loads twice and an
// async load can never race a material clone (the iter-82 bug).
//
// Why this exists: ABYME pivoted from "everything is math" to a rich, asset-driven
// world (the tag abyme-pure-math-v1 marks the old era). As asset volume grows we
// need (a) honest license/provenance tracking and (b) a lazy, race-free loader.
// The first asset (driftwood) used to be hand-loaded inline in props.js; it now
// lives here as the first manifest row. Style guide + budgets: ASSETS.md.

import * as THREE from 'three';

const BASE = 'assets/';

// Every shippable asset is declared here ONCE.
//   kind:    'texture' | 'voice' | 'music' | 'mesh'
//   license + source + prompt: the provenance ledger (drives the asset-honesty
//            line and any future credits; `prompt` is the abstract, no-biography
//            generation prompt — see ASSETS.md).
//   texture rows carry their sampler settings (wrap/repeat/colorSpace/anisotropy).
export const MANIFEST = {
  driftwood: {
    kind: 'texture', file: 'driftwood.jpg', bytes: 58012,
    license: 'Apache-2.0', source: 'Bender · FLUX.1-schnell',
    prompt: 'seamless tileable weathered driftwood plank grain, grey-brown, soft daylight, top-down',
    wrap: 'repeat', repeat: [1.4, 1.4], colorSpace: 'srgb', anisotropy: 4,
  },
  // the interior wood — every wooden prop's grain (doors, the music box, the tables, the plate
  // ring). Worn pine floorboards reused as a generic wood grain; base tint kept warm so the pale
  // texture multiplies to a mid weathered wood. Shared via matWood (props.js).
  wood: {
    kind: 'texture', file: 'wood.jpg', bytes: 85684,
    license: 'Apache-2.0', source: 'Bender · FLUX.1-schnell',
    prompt: 'seamless tileable aged oiled oak plank wood, deep grain channels, worn varnish, knots — warm honey oak (richer than the old pale pine), top-down',
    wrap: 'repeat', repeat: [1.5, 1.5], colorSpace: 'srgb', anisotropy: 4,
  },
  // the keeper's coat (and its clone on the model) — coarse weathered burlap weave.
  cloth: {
    kind: 'texture', file: 'cloth.jpg', bytes: 166206,
    license: 'Apache-2.0', source: 'Bender · FLUX.1-schnell',
    prompt: 'seamless tileable coarse weathered burlap weave, oatmeal, soft daylight, top-down',
    wrap: 'repeat', repeat: [2, 2], colorSpace: 'srgb', anisotropy: 4,
  },
  // the island's STONE — lighthouse, study walls, floor, the standing stones (the shared matStone
  // Baker, vertexColors:true, so the granite MULTIPLIES the existing bone/grey vertex colors and the
  // copper band stays coppery — no de-merge needed). Achromatic granite; the grades still color it.
  stone: {
    kind: 'texture', file: 'study_stone.jpg', bytes: 162296,
    license: 'Apache-2.0', source: 'Bender · FLUX.1-schnell',
    prompt: 'seamless tileable weathered granite ashlar masonry, deep recessed mortar lines, lichen and salt-weathering flecks, high micro-contrast, top-down — bolder relief source for the derived normal map',
    wrap: 'repeat', repeat: [3, 3], colorSpace: 'srgb', anisotropy: 4,
  },
  // the chart-table surface — a sheet of aged vellum the model sits on (a thin plane in props.js).
  chart_vellum: {
    kind: 'texture', file: 'chart_vellum.jpg', bytes: 21786,
    license: 'Apache-2.0', source: 'Bender · FLUX.1-schnell',
    prompt: 'seamless tileable aged blank vellum chart paper, faint creases, soft daylight, top-down',
    wrap: 'repeat', repeat: [1, 1], colorSpace: 'srgb', anisotropy: 4,
  },
  // the pines' bark — on the shared trunkMat (buildVegetation), via applyRelief (albedo+derived
  // normal). repeat [1,3] wraps once around the 6-gon barrel and tiles ~3x up the 2.6m trunk.
  bark: {
    kind: 'texture', file: 'bark.jpg', bytes: 173161,
    license: 'Apache-2.0', source: 'Bender · FLUX.1-schnell',
    prompt: 'seamless tileable aged conifer bark, deep vertical grooves, weathered grey-brown, top-down',
    wrap: 'repeat', repeat: [1, 3], colorSpace: 'srgb', anisotropy: 4,
  },
  // the tree-top canopy — a STYLIZED painterly foliage, sampled object-space in the canopy shader
  // (no UVs) as a subtle luminance multiply to break the flat uniform green. Kept low-detail.
  foliage: {
    kind: 'texture', file: 'foliage.jpg', bytes: 150591,
    license: 'Apache-2.0', source: 'Bender · FLUX.1-schnell',
    prompt: 'seamless tileable stylized painterly pine canopy foliage, soft dabbed needle clusters, gentle value variation, low detail',
    wrap: 'repeat', repeat: [1, 1], colorSpace: 'srgb', anisotropy: 2,
  },

  // the keeper's voice — bm_george (Kokoro-82M), generated on Bender, transcoded to
  // mono 24 kHz mp3, played through the drowned bus (audio.js say()). `prompt` is the
  // spoken line (provenance). Lazy-loaded by id when the keeper first speaks at depth.
  keeper_arrive_shallow: { kind: 'voice', file: 'voice/keeper_arrive_shallow.mp3', bytes: 20205, license: 'Apache-2.0', source: 'Bender · Kokoro-82M · bm_george', prompt: 'Oh. You came down too.' },
  keeper_arrive_deep:    { kind: 'voice', file: 'voice/keeper_arrive_deep.mp3',    bytes: 22125, license: 'Apache-2.0', source: 'Bender · Kokoro-82M · bm_george', prompt: 'There is no bottom. I looked.' },
  keeper_look_3:         { kind: 'voice', file: 'voice/keeper_look_3.mp3',         bytes: 15981, license: 'Apache-2.0', source: 'Bender · Kokoro-82M · bm_george', prompt: 'Oh. Not again.' },
  keeper_look_4:         { kind: 'voice', file: 'voice/keeper_look_4.mp3',         bytes: 28269, license: 'Apache-2.0', source: 'Bender · Kokoro-82M · bm_george', prompt: "You're faster than I was. Don't be proud of it." },
  keeper_farewell:       { kind: 'voice', file: 'voice/keeper_farewell.mp3',       bytes: 32685, license: 'Apache-2.0', source: 'Bender · Kokoro-82M · bm_george', prompt: "Go on up. Don't leave the light on for me. I never could." },
  keeper_there_you_are:  { kind: 'voice', file: 'voice/keeper_there_you_are.mp3',  bytes: 26733, license: 'Apache-2.0', source: 'Bender · Kokoro-82M · bm_george', prompt: "There you are. I've been coming down for you." },

  // the era music — five looping DARK ambient stems, one per descent level (the color-psychology
  // arc made HEARD, now lower + heavier per owner note: "much longer + darker tone"). Each is an
  // EVOLVING ~20s bed: two distinct ACE-Step clips A→B crossfaded (the model caps a single gen at
  // 12s, so we stitch for length + variation), motif E-G-A-D-C. Crossfaded by W.level in audio.js,
  // decoded lazily (current + adjacent) via keepOnlyAudio. mono 32kHz mp3.
  music_l1: { kind: 'music', file: 'music/music_l1.mp3', bytes: 240669, license: 'Apache-2.0', source: 'Bender · ACE-Step-v1-3.5B', prompt: 'slow dark ambient, low cello + sub-bass, distant piano motif & foghorn, melancholy dusk — the surface (L1)' },
  music_l2: { kind: 'music', file: 'music/music_l2.mp3', bytes: 240669, license: 'Apache-2.0', source: 'Bender · ACE-Step-v1-3.5B', prompt: 'uneasy detuned dark ambient, bent low strings, sodium-lamp false warmth turning cold (L2)' },
  music_l3: { kind: 'music', file: 'music/music_l3.mp3', bytes: 240669, license: 'Apache-2.0', source: 'Bender · ACE-Step-v1-3.5B', prompt: 'submerged queasy dark ambient, muffled groaning hull + whale-low brass, airless (L3)' },
  music_l4: { kind: 'music', file: 'music/music_l4.mp3', bytes: 240669, license: 'Apache-2.0', source: 'Bender · ACE-Step-v1-3.5B', prompt: 'cold lonely abyssal ambient, vast sub-bass drone + rare sonar ping, isolation (L4)' },
  music_l5: { kind: 'music', file: 'music/music_l5.mp3', bytes: 240669, license: 'Apache-2.0', source: 'Bender · ACE-Step-v1-3.5B', prompt: 'desolate near-silent ambient, one low note in immense quiet, the bottom of grief (L5)' },
};

const _texCache = new Map();   // id -> THREE.Texture (shared)
const _normCache = new Map();  // id -> THREE.DataTexture (a normal map DERIVED from the albedo, shared)
const _bufCache = new Map();   // id -> Promise<AudioBuffer>
const _loader = new THREE.TextureLoader();

const COLORSPACE = { srgb: THREE.SRGBColorSpace, linear: THREE.LinearSRGBColorSpace };
const WRAP = { repeat: THREE.RepeatWrapping, clamp: THREE.ClampToEdgeWrapping };

export function assetPath(id) {
  const a = MANIFEST[id];
  if (!a) throw new Error(`asset "${id}" is not in the manifest`);
  return BASE + a.file;
}

// Get a texture by manifest id — lazily loaded, cached, configured from the row.
// Returns the Texture synchronously; the image fills in async (pass onLoad to
// react). Safe to call from material construction: the SAME shared Texture comes
// back every time, so the island and its 1:240 model clone share one upload.
export function getTexture(id, onLoad) {
  if (_texCache.has(id)) {
    const t = _texCache.get(id);
    if (onLoad && t.image) onLoad(t);
    return t;
  }
  const a = MANIFEST[id];
  if (!a || a.kind !== 'texture') throw new Error(`asset "${id}" is not a texture in the manifest`);
  const tex = _loader.load(assetPath(id), (t) => { t.needsUpdate = true; onLoad?.(t); });
  if (a.wrap) tex.wrapS = tex.wrapT = WRAP[a.wrap] ?? THREE.RepeatWrapping;
  if (a.repeat) tex.repeat.set(a.repeat[0], a.repeat[1]);
  tex.colorSpace = COLORSPACE[a.colorSpace] ?? THREE.SRGBColorSpace;
  if (a.anisotropy) tex.anisotropy = a.anisotropy;
  _texCache.set(id, tex);
  return tex;
}

// Apply a manifest texture onto a material's map (or another slot) and flag it for
// update. Centralises the load-and-assign pattern so the shared material gets its
// map HERE; interact.js then clones lazily on first hover, after this has run, so
// the highlight clone can't outrun the texture (the iter-82 race, fixed at root).
export function applyTexture(material, id, slot = 'map') {
  material[slot] = getTexture(id, () => { material.needsUpdate = true; });
  material.needsUpdate = true;
  return material[slot];
}

// ---- relief: a NORMAL MAP derived from the albedo's own luminance ------------
// The de-flatten lever. Our textures are albedo-only and read as evenly-lit paper;
// real PBR relief maps weren't available from the FLUX backend (kind:"pbr" returns a
// single albedo, not a map set). So we DERIVE one: the recesses in these surfaces —
// granite mortar, wood grain, burlap weave, driftwood cracks — are exactly the dark
// pixels, so the albedo's luminance IS a usable heightfield. A wrap-aware Sobel pass
// turns it into a tangent-space normal map at load. Zero new files, stays tileable,
// no jpg-on-normals artifacts, and the engine owns the capability (no external PBR gen).
function buildNormalFromImage(img, strength) {
  let w = img.width, h = img.height;
  const cap = 512;                                   // bound cost + VRAM; normals don't need full res
  const s = Math.min(1, cap / Math.max(w, h));
  w = Math.round(w * s); h = Math.round(h * s);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  cx.drawImage(img, 0, 0, w, h);
  const src = cx.getImageData(0, 0, w, h).data;
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) lum[i] = (src[i * 4] * 0.299 + src[i * 4 + 1] * 0.587 + src[i * 4 + 2] * 0.114) / 255;
  const at = (x, y) => lum[((y % h) + h) % h * w + (((x % w) + w) % w)];   // wrap → tileable
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      let nx = -dx * strength, ny = -dy * strength, nz = 1;
      const inv = 1 / Math.hypot(nx, ny, nz);
      const i = (y * w + x) * 4;
      out[i] = (nx * inv * 0.5 + 0.5) * 255;
      out[i + 1] = (ny * inv * 0.5 + 0.5) * 255;
      out[i + 2] = (nz * inv * 0.5 + 0.5) * 255;
      out[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(out, w, h, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

// Apply an albedo AND a derived normal map (relief) to a material. Same race-free path
// as applyTexture, plus: when the albedo's image is decoded, derive its normal map ONCE
// (cached + shared, like the albedo — so the island and its 1:240 clone share one upload),
// match its repeat, and wire it. Does NOT touch flatShading — in three.js the normal map
// perturbs the (flat or smooth) base normal via derivative TBN either way, so we keep the
// material's crisp box edges and still get relief. opts: { normalScale, strength, roughness }.
export function applyRelief(material, id, opts = {}) {
  const ns = opts.normalScale ?? 0.7;
  material.normalScale = new THREE.Vector2(ns, ns);
  if (opts.roughness != null) material.roughness = opts.roughness;
  material.map = getTexture(id, (t) => {
    material.needsUpdate = true;
    if (!t.image) return;
    let nt = _normCache.get(id);
    if (!nt) {
      nt = buildNormalFromImage(t.image, opts.strength ?? 2.0);
      const a = MANIFEST[id];
      if (a?.repeat) nt.repeat.set(a.repeat[0], a.repeat[1]);
      if (a?.anisotropy) nt.anisotropy = a.anisotropy;
      _normCache.set(id, nt);
    }
    material.normalMap = nt;
    material.needsUpdate = true;
  });
  material.needsUpdate = true;
  return material;
}

// Decode an audio asset (voice/music) to an AudioBuffer via the given AudioContext.
// Cached by id — the PROMISE is cached, so concurrent callers share one fetch+decode.
// audio.js uses this for the keeper's voice and the era music stems (lazy by level).
export function loadAudioBuffer(id, ctx) {
  if (_bufCache.has(id)) return _bufCache.get(id);
  const a = MANIFEST[id];
  if (!a || (a.kind !== 'voice' && a.kind !== 'music')) throw new Error(`asset "${id}" is not audio in the manifest`);
  const p = fetch(assetPath(id))
    .then((r) => { if (!r.ok) throw new Error(`asset "${id}" → HTTP ${r.status}`); return r.arrayBuffer(); })
    .then((buf) => ctx.decodeAudioData(buf));
  _bufCache.set(id, p);
  return p;
}

// Evict a decoded audio buffer from the cache so its PCM can be GC'd once no BufferSource
// references it. Voice is one-shot + depth-gated, so audio.js drops each clip when it finishes
// playing (a rare replay just re-fetches + re-decodes — cheap). The Promise-dedupe cache itself
// stays — it is the iter-82 race fix; we only make entries evictable, never remove the cache.
export function evictAudio(id) { _bufCache.delete(id); }

// Keep ONLY the given audio ids cached, evicting the rest — for the era music stems' bounded
// working set (current level + adjacent), called at the W.level transitions. Born bounded so the
// 5 long music loops never all sit decoded at once.
export function keepOnlyAudio(ids) {
  const keep = ids instanceof Set ? ids : new Set(ids);
  for (const id of _bufCache.keys()) if (!keep.has(id)) _bufCache.delete(id);
}
