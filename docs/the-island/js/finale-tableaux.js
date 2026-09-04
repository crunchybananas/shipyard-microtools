// finale-tableaux.js — four equal endings, four different physical readings.
//
// This module owns no THREE objects and touches no world state.  It describes the
// camera, waterline, threshold and existing lights as plain data so the ending
// remains deterministic, directly testable, and honest under reduced motion.

export const FINALE_KINDS = Object.freeze(['tend', 'carry', 'open', 'close']);

const COMMON_START = Object.freeze([1.2, 1.7, 4.0]);
const COMMON_LOOK = Object.freeze([2.1, 2.3, 7.2]);
const COMMON_TIMING = Object.freeze({ duration: 15, revealAt: 9, codaAt: 10.4 });

const v = (x, y, z) => Object.freeze([x, y, z]);
const freezePath = (start, control, end) => Object.freeze({ start, control, end });
const freezeTableau = (spec) => Object.freeze({
  ...spec,
  timing: COMMON_TIMING,
  camera: freezePath(COMMON_START, spec.camera.control, spec.camera.end),
  look: freezePath(COMMON_LOOK, spec.look.control, spec.look.end),
  tide: Object.freeze(spec.tide),
  door: Object.freeze(spec.door),
  lights: Object.freeze(spec.lights),
  constellation: Object.freeze(spec.constellation),
});

// Every offset is relative to the lighthouse study centre.  All four paths begin
// at the dry east-room threshold, then leave it in a different physical direction.
export const FINALE_TABLEAUX = Object.freeze({
  tend: freezeTableau({
    id: 'tend',
    line: 'you remain with what was left',
    hour: 17.25,
    camera: { control: v(-9, 18, -25), end: v(-19, 31.5, -71) },
    look: { control: v(2, 4, -8), end: v(13, -4.5, -27) },
    tide: { from: 1, to: 1, begin: 0, end: 1 },
    door: { from: 1, to: 1 },
    lights: { sun: 0.86, hemi: 0.82, study: 0.78, beacon: 1.18, refuge: 1.28, jetty: 0.9 },
    exposure: 0.78,
    fog: 0.68,
    constellation: [0, 0, 0, 0, 0],
  }),
  carry: freezeTableau({
    id: 'carry',
    line: 'you take your weight back',
    hour: 7.15,
    camera: { control: v(48, 15, -8), end: v(92, 4.5, -40) },
    look: { control: v(58, -4, -36), end: v(88, -13.5, -73) },
    tide: { from: 1.45, to: 0.04, begin: 0.12, end: 0.72 },
    door: { from: 1, to: 1 },
    lights: { sun: 1.02, hemi: 0.94, study: 0.55, beacon: 0.62, refuge: 0.92, jetty: 1.45 },
    exposure: 0.88,
    fog: 0.52,
    constellation: [0, 0, 0, 0, 0],
  }),
  open: freezeTableau({
    id: 'open',
    line: 'the water runs both ways',
    hour: 19.1,
    camera: { control: v(-15, 24, -75), end: v(100, -6.5, -86) },
    look: { control: v(28, -8, -64), end: v(88, -12.5, -62) },
    tide: { from: 0.04, to: 1.55, begin: 0.1, end: 0.72 },
    door: { from: 1, to: 1 },
    lights: { sun: 0.72, hemi: 0.72, study: 0.62, beacon: 1.08, refuge: 1.08, jetty: 1.5 },
    exposure: 0.76,
    fog: 0.58,
    constellation: [0.08, 0.12, 0.16, 0.12, 0.08],
  }),
  close: freezeTableau({
    id: 'close',
    line: 'the boundary holds',
    hour: 18.2,
    camera: { control: v(-0.8, 2.4, 3), end: v(-3.2, 2.5, 1.6) },
    look: { control: v(2.1, 2.1, 6.8), end: v(1.8, 1.2, 5.8) },
    tide: { from: 1.45, to: 1.45, begin: 0, end: 1 },
    door: { from: 1, to: 0 },
    lights: { sun: 0.68, hemi: 0.7, study: 0.36, beacon: 0.16, refuge: 1.85, jetty: 0.3 },
    exposure: 0.84,
    fog: 0.54,
    constellation: [0, 0, 0, 0, 0],
  }),
});

const clamp01 = (n) => Math.max(0, Math.min(1, Number(n) || 0));
const smooth = (n) => {
  const x = clamp01(n);
  return x * x * (3 - 2 * x);
};
const windowed = (n, begin, end) => smooth((n - begin) / Math.max(1e-6, end - begin));
const mix = (a, b, n) => a + (b - a) * n;
const quadratic = (path, n) => {
  const a = 1 - n;
  return path.start.map((value, i) =>
    a * a * value + 2 * a * n * path.control[i] + n * n * path.end[i]);
};

export function finaleTableau(kind) {
  return FINALE_TABLEAUX[kind] || FINALE_TABLEAUX.tend;
}

export function sampleFinaleTableau(kind, progress, { reducedMotion = false } = {}) {
  const spec = finaleTableau(kind);
  const p = clamp01(progress);
  // Motion reduction is not a generic freeze on the common opening shot: it lands
  // directly on this choice's final physical result and holds that distinct image.
  const travel = reducedMotion ? 1 : windowed(p, 0.11, 0.78);
  const tideTravel = reducedMotion ? 1 : windowed(p, spec.tide.begin, spec.tide.end);
  const doorTravel = reducedMotion ? 1 : windowed(p, 0.08, 0.5);
  return {
    kind: spec.id,
    camera: quadratic(spec.camera, travel),
    look: quadratic(spec.look, travel),
    tide: mix(spec.tide.from, spec.tide.to, tideTravel),
    door: mix(spec.door.from, spec.door.to, doorTravel),
    hour: spec.hour,
    lights: { ...spec.lights },
    exposure: spec.exposure,
    fog: spec.fog,
    constellation: [...spec.constellation],
  };
}
