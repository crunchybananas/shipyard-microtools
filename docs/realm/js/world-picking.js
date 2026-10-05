// SHELL: the completed painter frame owns input geometry. No simulation
// positions, independent actor radii, or whole-game pixel readbacks.
const MAX_MASK_BYTES = 4 * 1024 * 1024, MAX_MASKS = 256, MASK_EDGE = 192;
const ALPHA_THRESHOLD = 24;
const stamps = [], masks = new Map(), imageIds = new WeakMap();
let canvas = null, activeContext = null, owner = null, count = 0, generation = 0;
let frameWidth = 0, frameHeight = 0, nextImageId = 1;
let scratch = null, scratchContext = null, maskBytes = 0, maskReadbacks = 0, maskFailures = 0;
let pointer = null, hover = null;

export function beginWorldPickingFrame(ctx) {
  activeContext = ctx; canvas = ctx.canvas; owner = null; count = 0; generation++;
  frameWidth = canvas.width; frameHeight = canvas.height;
}

export function setWorldPickOwner(kind, entity) {owner = {kind, entity};}

export function endWorldPickingFrame() {
  stamps.length = count; activeContext = null; owner = null;
}

function stamp(ctx, target, x, y, width, height) {
  const t = ctx.getTransform(), det = t.a * t.d - t.b * t.c;
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12 || ctx.globalAlpha * 255 < ALPHA_THRESHOLD) return null;
  const record = stamps[count] || (stamps[count] = {}); count++;
  record.owner = target; record.x = x; record.y = y; record.width = width; record.height = height;
  record.ia = t.d / det; record.ib = -t.b / det; record.ic = -t.c / det; record.id = t.a / det;
  record.ie = (t.c * t.f - t.d * t.e) / det; record.if = (t.b * t.e - t.a * t.f) / det;
  const x0 = t.a * x + t.c * y + t.e, y0 = t.b * x + t.d * y + t.f;
  const xx = t.a * width, xy = t.b * width, yx = t.c * height, yy = t.d * height;
  record.left = Math.min(x0, x0 + xx, x0 + yx, x0 + xx + yx);
  record.right = Math.max(x0, x0 + xx, x0 + yx, x0 + xx + yx);
  record.top = Math.min(y0, y0 + xy, y0 + yy, y0 + xy + yy);
  record.bottom = Math.max(y0, y0 + xy, y0 + yy, y0 + xy + yy);
  record.alpha = ctx.globalAlpha; record.image = null; record.shape = null; record.clip = null;
  return record;
}

// The exact image, frame, registration and canvas transform used for the
// visible body also describe its hit shape. Offscreen previews/composites do
// not register because their context is outside the active world owner.
export function drawWorldImage(ctx, image, sx, sy, sw, sh, dx, dy, dw, dh, clip = null) {
  ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
  if (ctx !== activeContext || !owner || dw <= 0 || dh <= 0) return;
  const record = stamp(ctx, owner, dx, dy, dw, dh);
  if (!record) return;
  record.image = image; record.sx = sx; record.sy = sy; record.sw = sw; record.sh = sh; record.clip = clip;
}

// Roads and construction projects own an empty ground cell as well as their
// visible pieces. Register those before bodies, so they cannot cover a person
// or a neighboring roof in the picking order.
export function recordWorldGroundCell(ctx, entity, x, y, halfWidth, halfHeight) {
  if (ctx !== activeContext) return;
  const record = stamp(ctx, {kind: 'building', entity}, x - halfWidth, y - halfHeight, halfWidth * 2, halfHeight * 2);
  if (record) record.shape = 'diamond';
}

export function recordWorldDisc(ctx, x, y, radius) {
  if (ctx !== activeContext || !owner) return;
  const record = stamp(ctx, owner, x - radius, y - radius, radius * 2, radius * 2);
  if (record) record.shape = 'disc';
}

function sourceMask(record) {
  const {image, sx, sy, sw, sh} = record;
  let id = imageIds.get(image);
  if (!id) {id = nextImageId++; imageIds.set(image, id);}
  const key = `${id}/${image.currentSrc || image.src || ''}/${sx}/${sy}/${sw}/${sh}`;
  if (masks.has(key)) {
    const cached = masks.get(key); masks.delete(key); masks.set(key, cached); return cached;
  }
  const width = Math.max(1, Math.min(MASK_EDGE, Math.ceil(sw))), height = Math.max(1, Math.min(MASK_EDGE, Math.ceil(sh)));
  const bytes = width * height;
  while (masks.size >= MAX_MASKS || maskBytes + bytes > MAX_MASK_BYTES) {
    const oldest = masks.keys().next().value, removed = masks.get(oldest);
    maskBytes -= removed?.alpha.byteLength || 0; masks.delete(oldest);
  }
  if (!scratch) {scratch = document.createElement('canvas'); scratchContext = scratch.getContext('2d', {willReadFrequently: true});}
  scratch.width = width; scratch.height = height;
  let result = null;
  try {
    scratchContext.imageSmoothingEnabled = true; scratchContext.imageSmoothingQuality = 'high';
    scratchContext.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);
    const rgba = scratchContext.getImageData(0, 0, width, height).data, alpha = new Uint8Array(bytes);
    maskReadbacks++;
    for (let i = 0; i < bytes; i++) alpha[i] = rgba[i * 4 + 3];
    result = {width, height, alpha}; maskBytes += bytes;
  } catch {maskFailures++;}
  masks.set(key, result); return result;
}

function touches(record, x, y) {
  if (x < record.left || x >= record.right || y < record.top || y >= record.bottom) return false;
  const localX = record.ia * x + record.ic * y + record.ie, localY = record.ib * x + record.id * y + record.if;
  const u = (localX - record.x) / record.width, v = (localY - record.y) / record.height;
  if (u < 0 || u >= 1 || v < 0 || v >= 1) return false;
  if (record.shape === 'diamond') return Math.abs(u - .5) + Math.abs(v - .5) <= .5;
  if (record.shape === 'disc') return (u - .5) ** 2 + (v - .5) ** 2 <= .25;
  const clip = record.clip;
  if (clip && (localX < clip.x || localX >= clip.x + clip.width || localY < clip.y || localY >= clip.y + clip.height)) return false;
  const mask = sourceMask(record);
  return mask && mask.alpha[Math.floor(v * mask.height) * mask.width + Math.floor(u * mask.width)] * record.alpha >= ALPHA_THRESHOLD;
}

export function pickWorldAt(clientX, clientY, {touch = false, accept = null} = {}) {
  if (!canvas || canvas.width !== frameWidth || canvas.height !== frameHeight || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height || clientX < rect.left || clientX >= rect.right || clientY < rect.top || clientY >= rect.bottom) return null;
  const sx = canvas.width / rect.width, sy = canvas.height / rect.height;
  const x = (clientX - rect.left) * sx, y = (clientY - rect.top) * sy;
  const exact = (px, py) => {
    for (let i = count - 1; i >= 0; i--) {
      const record = stamps[i];
      if (touches(record, px, py) && (!accept || accept(record.owner))) return record.owner;
    }
    return null;
  };
  const direct = exact(x, y);
  if (direct) return direct;
  // A small screen-space allowance helps thin bodies at distant zoom. An
  // exact building/plot/occluder hit always wins before this allowance, and
  // each sampled neighbor must itself be visible in the completed painter.
  for (let radius = 1; radius <= (touch ? 6 : 2); radius++) {
    for (let step = 0; step < 16; step++) {
      const angle = step * Math.PI / 8, hit = exact(x + Math.cos(angle) * radius * sx, y + Math.sin(angle) * radius * sy);
      if (hit?.kind === 'citizen' || hit?.kind === 'founder') return hit;
    }
  }
  return null;
}

export function setWorldPointer(clientX, clientY) {
  pointer = Number.isFinite(clientX) && Number.isFinite(clientY) ? {x: clientX, y: clientY} : null;
  if (!pointer) hover = null;
}
export function worldPointer() {return pointer;}
export function updateWorldHover(enabled = true) {
  hover = enabled && pointer ? pickWorldAt(pointer.x, pointer.y) : null; return hover;
}
export function worldHover() {return hover;}

export function inspectWorldPicking() {
  return {generation, stamps: count, masks: masks.size, maskBytes, maskReadbacks, maskFailures,
    maxMaskBytes: MAX_MASK_BYTES, maxMasks: MAX_MASKS,
    hover: hover ? {kind: hover.kind, actorId: hover.entity?.actorId, x: hover.entity?.x, y: hover.entity?.y} : null};
}
