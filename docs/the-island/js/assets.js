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
    kind: 'texture', file: 'driftwood.png', bytes: 1054836,
    license: 'Apache-2.0', source: 'Bender · FLUX.1-schnell',
    prompt: 'seamless tileable weathered driftwood plank grain, grey-brown, soft daylight, top-down',
    wrap: 'repeat', repeat: [1.4, 1.4], colorSpace: 'srgb', anisotropy: 4,
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
};

const _texCache = new Map();   // id -> THREE.Texture (shared)
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

// The provenance ledger — every asset's license + source, for the honesty line and
// any credits roll. Pure data; loads nothing.
export function ledger() {
  return Object.entries(MANIFEST).map(([id, a]) =>
    ({ id, kind: a.kind, file: a.file, bytes: a.bytes, license: a.license, source: a.source }));
}
