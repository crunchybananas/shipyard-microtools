export const VERSION = 1;
export const DURATION = 8000;
export const MAX_HANDS = 6;
export const COLORS = ['#456acc', '#bd616e', '#54897b', '#a58138', '#9566a1', '#538ca8'];
export const NAMES = ['Your first hand', 'Your second hand', 'Your third hand', 'Your fourth hand', 'Your fifth hand', 'Your sixth hand'];
export const NOTES = [
  { x: 270, y: 350, midi: 62, name: 'D', word: 'begin' },
  { x: 385, y: 151, midi: 66, name: 'F♯', word: 'remember' },
  { x: 615, y: 151, midi: 69, name: 'A', word: 'reach' },
  { x: 730, y: 350, midi: 71, name: 'B', word: 'return' },
  { x: 615, y: 549, midi: 74, name: 'D', word: 'linger' },
  { x: 385, y: 549, midi: 76, name: 'E', word: 'release' },
  { x: 500, y: 350, midi: 78, name: 'F♯', word: 'meet' },
];
export const STUDIES = [
  { id: 'company', title: 'A little company', subtitle: 'One hand becomes two.',
    instruction: 'Leave a hand on the left bell. Then hold the right bell yourself.',
    hint: 'Choose “Leave a hand”, press the left bell, and release. It will remember where you were.',
    targets: [0, 3], hold: 1200, reward: 'The first time you were in two places at once.' },
  { id: 'impossible', title: 'A small impossibility', subtitle: 'Be in three places at once.',
    instruction: 'Leave hands on the three marked bells. Hold all three together.',
    hint: 'Record a still hand on each marked bell. Your live hand counts, too.',
    targets: [0, 2, 4], hold: 1600, reward: 'An impossible chord, played by one person.' },
  { id: 'round', title: 'What goes around', subtitle: 'Give a memory somewhere to go.',
    instruction: 'Let a recorded hand ring the six outer bells clockwise, starting at the left.',
    hint: 'Choose “Leave a hand”. Slowly draw through the six outer bells in order, then release. Watch the replay.',
    targets: [0, 1, 2, 3, 4, 5], hold: 0, reward: 'A thought that learned to find its way home.' },
  { id: 'contrary', title: 'Meet yourself halfway', subtitle: 'Two memories. Opposite directions.',
    instruction: 'Draw across the middle bell. Make a twin of that hand, then turn one backward.',
    hint: 'A slow left-to-right stroke works well. Two moving echoes must meet at the middle bell, travelling opposite ways.',
    targets: [6], hold: 0, reward: 'For a moment, your past came to meet you.' },
  { id: 'open', title: 'The hours are yours', subtitle: 'An instrument for your past selves.',
    instruction: 'Draw a phrase. Leave it here. Play something new alongside it.',
    hint: 'Six hands, seven bells, eight seconds. Try twins, reverse time, or shift a hand by a beat. Save a score when it feels like you.',
    targets: [], hold: 0, reward: '' },
];

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
export const mod = (n, size) => ((n % size) + size) % size;
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function blankScore(study = 'company') {
  return { v: VERSION, study, title: 'A little borrowed time', duration: DURATION, hands: [] };
}

export function samplePath(points, time) {
  if (time <= points[0].t) return { ...points[0] };
  const last = points.at(-1);
  if (time >= last.t) return { ...last };
  let lo = 0, hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid].t <= time) lo = mid;
    else hi = mid;
  }
  const a = points[lo], b = points[hi];
  const f = (time - a.t) / (b.t - a.t);
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, t: time };
}

export function handAt(hand, time, duration = DURATION) {
  let phase = mod(time + hand.offset, duration);
  if (hand.reverse) phase = Math.max(0, hand.span - phase);
  const point = samplePath(hand.points, phase);
  const other = samplePath(hand.points, clamp(phase + (hand.reverse ? -25 : 25), 0, duration));
  return { ...point, id: hand.id, color: hand.color, echo: true, reverse: hand.reverse,
    vx: (other.x - point.x) / 25, vy: (other.y - point.y) / 25 };
}

export function actorsAt(score, time, live = null) {
  const actors = score.hands.filter(h => !h.muted).map(h => handAt(h, time, score.duration));
  if (live) actors.push({ ...live, id: 'now', color: '#263b53', echo: false });
  return actors;
}

export function occupiedNotes(actors) {
  return NOTES.map(note => actors.filter(actor => distance(actor, note) <= 44));
}

// A hand can occupy at most one bell. Require distinct actors explicitly as well,
// so future changes to the instrument layout cannot trivialize a study.
export function separateHands(occupancy, targets) {
  const visit = (i, used) => i === targets.length || occupancy[targets[i]].some(actor => {
    if (used.has(actor.id)) return false;
    return visit(i + 1, new Set([...used, actor.id]));
  });
  return visit(0, new Set());
}

export function newProgress() {
  return { held: 0, sequence: 0, complete: false, previous: [], lap: -1, fraction: 0, sequenceHand: null };
}

export function evaluateStudy(study, progress, actors, time, dt, duration = DURATION) {
  if (progress.complete || study.id === 'open') return progress;
  const p = { ...progress };
  const occupancy = occupiedNotes(actors);
  if (study.hold) {
    const ready = separateHands(occupancy, study.targets) && actors.some(a => a.echo);
    p.held = ready ? p.held + dt : 0;
    p.fraction = clamp(p.held / study.hold, 0, 1);
    p.complete = p.held >= study.hold;
  } else if (study.id === 'round') {
    const lap = Math.floor(time / duration);
    if (lap !== p.lap) { p.sequence = 0; p.lap = lap; p.sequenceHand = null; p.previous = []; }
    const target = study.targets[p.sequence];
    const arrived = occupancy[target]?.find(a => a.echo && (!p.sequenceHand || a.id === p.sequenceHand)
      && !p.previous.includes(`${a.id}:${target}`));
    if (arrived) { p.sequenceHand = arrived.id; p.sequence++; }
    p.fraction = p.sequence / study.targets.length;
    p.complete = p.sequence === study.targets.length;
    p.previous = occupancy.flatMap((list, n) => list.map(a => `${a.id}:${n}`));
  } else if (study.id === 'contrary') {
    const center = occupancy[6].filter(a => a.echo);
    const meeting = center.some(a => center.some(b => a.id !== b.id && a.reverse !== b.reverse
      && Math.hypot(a.vx, a.vy) > .025 && Math.hypot(b.vx, b.vy) > .025
      && (a.vx * b.vx + a.vy * b.vy) < -.0005 && distance(a, b) < 64));
    p.complete = meeting;
    p.fraction = meeting ? 1 : 0;
  }
  return p;
}

export function makeHand(points, id, color, duration = DURATION) {
  const raw = points.map(p => ({ t: p.t, x: p.x, y: p.y }));
  const end = raw.at(-1);
  if (end.t < duration) raw.push({ ...end, t: duration });
  // Fixed-size sampling bounds persistence and share links independently of FPS.
  const samples = Array.from({ length: 161 }, (_, i) => samplePath(raw, i * duration / 160));
  return { id, color, reverse: false, muted: false, offset: 0, span: end.t, points: samples };
}

export function validateScore(value) {
  const bad = () => { throw new Error('This is not an Elsewhen recording. Choose a .elsewhen.json file saved by this app.'); };
  if (!value || value.v !== VERSION || !STUDIES.some(s => s.id === value.study)
    || value.duration !== DURATION || !Array.isArray(value.hands) || value.hands.length > MAX_HANDS) bad();
  const ids = new Set();
  const hands = value.hands.map((hand, index) => {
    if (!hand || typeof hand.id !== 'string' || !/^[a-zA-Z0-9_-]{1,40}$/.test(hand.id)
      || ids.has(hand.id) || !Array.isArray(hand.points) || hand.points.length < 2 || hand.points.length > 401
      || !Number.isFinite(hand.offset) || hand.offset < 0 || hand.offset >= DURATION
      || !Number.isFinite(hand.span) || hand.span < 0 || hand.span > DURATION
      || typeof hand.reverse !== 'boolean' || typeof hand.muted !== 'boolean') bad();
    ids.add(hand.id);
    let last = -1;
    const points = hand.points.map(p => {
      if (!p || ![p.t, p.x, p.y].every(Number.isFinite) || p.t <= last || p.t < 0 || p.t > DURATION
        || p.x < 0 || p.x > 1000 || p.y < 0 || p.y > 720) bad();
      last = p.t;
      return { t: p.t, x: p.x, y: p.y };
    });
    if (points[0].t !== 0 || points.at(-1).t !== DURATION) bad();
    return { id: hand.id, color: COLORS.includes(hand.color) ? hand.color : COLORS[index],
      offset: hand.offset, span: hand.span, reverse: hand.reverse, muted: hand.muted, points };
  });
  return { v: VERSION, duration: DURATION, study: value.study,
    title: typeof value.title === 'string' ? value.title.slice(0, 80) : 'A little borrowed time', hands };
}

export function packScore(score) {
  return { v: 1, s: score.study, n: score.title, h: score.hands.map(h => [h.color, h.reverse ? 1 : 0,
    h.muted ? 1 : 0, h.offset, Math.round(h.span), ...Array.from({ length: 81 }, (_, i) => {
      const p = samplePath(h.points, i * DURATION / 80);
      return [Math.round(p.x), Math.round(p.y)];
    }).flat()]) };
}

export function unpackScore(packed) {
  if (!packed || packed.v !== 1 || !Array.isArray(packed.h) || packed.h.length > MAX_HANDS) {
    throw new Error('This replay link is incomplete or uses an unsupported format.');
  }
  const score = blankScore(packed.s);
  score.title = packed.n;
  score.hands = packed.h.map((h, index) => {
    if (!Array.isArray(h) || h.length !== 167 || ![0, 1].includes(h[1]) || ![0, 1].includes(h[2])) {
      throw new Error('This replay link contains an unreadable hand.');
    }
    return { id: `shared-${index}`, color: h[0], reverse: Boolean(h[1]), muted: Boolean(h[2]), offset: h[3], span: h[4],
      points: Array.from({ length: 81 }, (_, i) => ({ t: i * DURATION / 80, x: h[5 + i * 2], y: h[6 + i * 2] })) };
  });
  return validateScore(score);
}

export function visitorScore() {
  const score = blankScore('open');
  score.title = 'Someone was here before you';
  for (let h = 0; h < 3; h++) {
    const points = Array.from({ length: 161 }, (_, i) => {
      const t = i * DURATION / 160;
      const angle = Math.PI + t / DURATION * Math.PI * 2 + h * Math.PI * 2 / 3;
      const r = 230 + Math.sin(t / DURATION * Math.PI * 4 + h) * 34;
      return { t, x: 500 + Math.cos(angle) * r, y: 350 + Math.sin(angle) * r };
    });
    score.hands.push(makeHand(points, `visitor-${h}`, COLORS[h]));
  }
  return score;
}
