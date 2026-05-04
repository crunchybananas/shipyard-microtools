// Tiny factory for the lazy-loaded image-atlas pattern used by the
// renderer and enhancements. Each loader owns one URL, returns the
// HTMLImageElement once decoded, returns null while idle/loading/failed.
// `.state` and `.url` are exposed for the debug surface in render.js.

export function makeAtlasLoader(url) {
  let img = null;
  let state = 'idle';
  function load() {
    if (state === 'ready') return img;
    if (state === 'loading' || state === 'failed') return null;
    state = 'loading';
    const i = new Image();
    i.decoding = 'async';
    i.onload = () => { img = i; state = 'ready'; };
    i.onerror = () => { img = null; state = 'failed'; };
    i.src = url;
    return null;
  }
  Object.defineProperty(load, 'state', { get: () => state });
  load.url = url;
  return load;
}
