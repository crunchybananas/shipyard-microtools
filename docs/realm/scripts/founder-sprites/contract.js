// A dedicated eight-view authoring pilot. Existing citizen families keep
// their own contract; no direction is synthesized by flipping a bitmap.
export const FOUNDER_DIRECTIONS = Object.freeze(['s', 'se', 'e', 'ne', 'n', 'nw', 'w', 'sw']);
export const FOUNDER_FRAMES = 24;
export const FOUNDER_VIEW_HEIGHT = 2.6;
export const FOUNDER_ANCHOR = Object.freeze({ x: 0.5, y: 0.86 });
export const FOUNDER_STRIDE = 0.64;
export const FOUNDER_DURATION = 1.0666667222976685;
export const FOUNDER_TIERS = Object.freeze([
  { key: 'game', file: 'walk-64.png', frameW: 64, frameH: 84 },
  { key: 'retina', file: 'walk-128.png', frameW: 128, frameH: 168 },
  { key: 'studio', file: 'walk-192.png', frameW: 192, frameH: 252 },
]);

// Screen-space vectors are unprojected before quantizing. Realm's isometric
// ground has a 2:1 ratio, so its diagonals are +/-26.565 degrees on screen.
export function founderDirection(x, y, fallback = 's') {
  if (!Number.isFinite(x) || !Number.isFinite(y) || Math.hypot(x, y) < 1e-7) return fallback;
  const sector = Math.round(Math.atan2(x, y * 2) / (Math.PI / 4));
  return FOUNDER_DIRECTIONS[(sector + 8) % 8];
}

export function founderFrameRect(direction, phase, tier = FOUNDER_TIERS[0], frames = FOUNDER_FRAMES) {
  const row = FOUNDER_DIRECTIONS.indexOf(direction);
  if (row < 0 || !Number.isFinite(phase)) throw new Error('Invalid Founder pose');
  const cycle = phase - Math.floor(phase);
  const frame = Math.floor(cycle * frames + 1e-9) % frames;
  return { x: frame * tier.frameW, y: row * tier.frameH, w: tier.frameW, h: tier.frameH, frame, row };
}

export function founderContact(phase, side) {
  const p = ((phase + (side === 'right' ? 0.5 : 0)) % 1 + 1) % 1;
  return p <= 0.6;
}
