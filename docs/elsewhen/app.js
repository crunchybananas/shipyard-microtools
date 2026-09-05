import { NOTES, STUDIES, COLORS, NAMES, MAX_HANDS, DURATION, blankScore, makeHand,
  actorsAt, occupiedNotes, newProgress, evaluateStudy, validateScore, packScore, unpackScore,
  visitorScore, mod, clamp, distance } from './engine.mjs';
import { Instrument } from './audio.js';
import { Renderer, scoreSVG } from './render.js';

const $ = id => document.getElementById(id);
const STORAGE = 'waggle-elsewhen-v1';
const instrument = new Instrument();
let current = 0, score = blankScore(), time = 0, speed = 1, paused = false;
let armed = false, recording = null, live = null, pointerId = null, heldKey = null, animationFrame = null;
let progress = newProgress(), visitor = null, lastFrame = 0, frameCount = 0;
let soundWanted = true, soundAttempt = null, noticeTimer, nextId = 0;
let previousOccupancy = new Set(), previousBeat = -1, lastRing = NOTES.map(() => -Infinity);
let undoStack = [];
const completed = new Set();
const scores = new Map();

function notice(message) {
  $('notice').textContent = message;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { $('notice').textContent = ''; }, 4800);
}

function save() {
  if (visitor) return;
  scores.set(STUDIES[current].id, score);
  try {
    localStorage.setItem(STORAGE, JSON.stringify({ v: 1, current, completed: [...completed], scores: Object.fromEntries(scores) }));
    $('save-status').textContent = 'Your studies stay in this browser.';
  } catch {
    $('save-status').textContent = 'Browser storage is unavailable. Save a recording to keep your hands.';
  }
}

function restore() {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (!raw) return;
    if (raw.length > 500000) throw new Error('Storage too large');
    const stored = JSON.parse(raw);
    if (stored.v !== 1 || !stored.scores || typeof stored.scores !== 'object') throw new Error('Unknown save');
    for (const study of STUDIES) {
      if (stored.scores[study.id]) {
        const restored = validateScore(stored.scores[study.id]);
        if (restored.study !== study.id) throw new Error('Mismatched study');
        scores.set(study.id, restored);
      }
    }
    if (Array.isArray(stored.completed)) for (const id of stored.completed) {
      if (STUDIES.some(s => s.id === id && s.id !== 'open')) completed.add(id);
    }
    current = Number.isInteger(stored.current) ? clamp(stored.current, 0, STUDIES.length - 1) : 0;
    score = scores.get(STUDIES[current].id) || blankScore(STUDIES[current].id);
  } catch {
    notice('A saved study could not be read. You can start a new one or open an exported recording.');
    scores.clear(); completed.clear(); current = 0; score = blankScore();
  }
}

function checkpoint() {
  undoStack.push(JSON.stringify(score));
  if (undoStack.length > 20) undoStack.shift();
}

function resetClock() {
  time = 0; lastFrame = 0; previousBeat = -1; previousOccupancy.clear(); lastRing.fill(-Infinity);
  progress = newProgress();
  if (!visitor && completed.has(STUDIES[current].id)) progress = { ...progress, complete: true, fraction: 1 };
}

async function beginSound() {
  if (!soundWanted || document.hidden) return;
  if (soundAttempt) return soundAttempt;
  soundAttempt = instrument.enable().then(enabled => {
    $('sound').setAttribute('aria-pressed', String(enabled));
    $('sound-label').textContent = enabled ? 'Sound on' : 'Sound unavailable';
  }).catch(() => { $('sound-label').textContent = 'Try sound again'; }).finally(() => { soundAttempt = null; });
  return soundAttempt;
}

const bellButtons = NOTES.map((note, index) => {
  const button = document.createElement('button');
  button.className = 'bell'; button.dataset.note = index;
  button.setAttribute('aria-label', `${note.name} bell, ${note.word}, key ${index + 1}`);
  button.setAttribute('aria-pressed', 'false');
  $('bells').append(button);
  return button;
});
const renderer = new Renderer($('instrument'), $('stage'), bellButtons);

function updateStudy() {
  const study = visitor ? STUDIES[4] : STUDIES[current];
  $('study-number').textContent = visitor ? 'A visitor’s recording' : current === 4 ? 'Free time' : `Study ${current + 1} of 4`;
  $('study-title').textContent = visitor ? 'Someone was here' : study.title;
  $('instruction').textContent = visitor ? 'Three gestures, still keeping each other company. Touch a bell to play alongside them.' : study.instruction;
  $('hint').textContent = study.hint;
  $('study-progress').hidden = visitor || current === 4 || progress.complete;
  $('completion').hidden = visitor || !progress.complete || current === 4;
  $('reward').textContent = study.reward;
  $('next-study').innerHTML = current === 3 ? 'Make something of your own <span aria-hidden="true">↗</span>' : 'Next study <span aria-hidden="true">↗</span>';
  $('visitor').innerHTML = visitor ? '<span aria-hidden="true">↶</span> Return to your study' : '<span aria-hidden="true">▷</span> Hear a visitor’s hands';
  const labels = ['Two bells. Two versions of you.', 'An extra hand is only a memory away.',
    'The left bell begins the circle.', 'A forward hand. A backward hand. One meeting.', ''];
  $('progress-label').textContent = labels[current];
  $('studies').replaceChildren(...STUDIES.map((s, i) => {
    const button = document.createElement('button');
    button.className = 'study-tab'; button.dataset.study = i;
    button.setAttribute('aria-current', String(!visitor && current === i));
    button.innerHTML = `<span class="tab-number">${i < 4 ? `Study ${i + 1}` : 'Free time'}${completed.has(s.id) ? '<b aria-label="complete">✓</b>' : ''}</span><span class="tab-title">${s.title}</span><span class="tab-subtitle">${s.subtitle}</span>`;
    return button;
  }));
}

function updateHands() {
  $('hand-count').textContent = `${score.hands.length} / ${MAX_HANDS}`;
  $('empty-hands').hidden = score.hands.length > 0;
  $('hands').replaceChildren(...score.hands.map((hand, index) => {
    const item = document.createElement('li');
    item.className = `hand${hand.muted ? ' is-muted' : ''}`;
    item.style.setProperty('--hand-color', hand.color); item.dataset.hand = hand.id;
    const heading = document.createElement('div'); heading.className = 'hand-heading';
    const dot = document.createElement('span'); dot.className = 'hand-dot'; dot.setAttribute('aria-hidden', 'true');
    const name = document.createElement('span'); name.className = 'hand-name'; name.textContent = NAMES[index];
    heading.append(dot, name);
    const remove = document.createElement('button'); remove.className = 'hand-remove'; remove.dataset.action = 'remove';
    remove.textContent = '×'; remove.setAttribute('aria-label', `Remove hand ${index + 1}`); remove.disabled = Boolean(visitor);
    heading.append(remove);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 160 30'); svg.classList.add('hand-path'); svg.setAttribute('aria-hidden', 'true');
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    poly.setAttribute('points', hand.points.filter((_, i) => i % 2 === 0).map(p => `${p.t / DURATION * 160},${4 + p.y / 720 * 22}`).join(' '));
    poly.setAttribute('fill', 'none'); poly.setAttribute('stroke', hand.color); poly.setAttribute('stroke-width', '1.2');
    if (hand.reverse) poly.setAttribute('stroke-dasharray', '3 3');
    svg.append(poly);
    const actions = document.createElement('div'); actions.className = 'hand-actions';
    const options = [
      ['reverse', hand.reverse ? 'Backward' : 'Forward', `Play hand ${index + 1} backward`, hand.reverse],
      ['twin', 'Twin', `Make a twin of hand ${index + 1}`, null],
      ['shift', hand.offset ? `+${hand.offset / 1000} beat` : '+ Beat', `Shift hand ${index + 1} one beat ahead`, null],
      ['mute', hand.muted ? 'Wake' : 'Rest', `Rest hand ${index + 1}`, hand.muted],
    ];
    for (const [action, text, label, pressed] of options) {
      const b = document.createElement('button'); b.textContent = text; b.dataset.action = action; b.setAttribute('aria-label', label);
      if (pressed !== null) b.setAttribute('aria-pressed', String(pressed));
      b.disabled = Boolean(visitor) || (action === 'twin' && score.hands.length >= MAX_HANDS);
      actions.append(b);
    }
    item.append(heading, svg, actions);
    return item;
  }));
  $('undo').disabled = !undoStack.length || Boolean(visitor);
}

function updateTransport() {
  $('record').classList.toggle('is-armed', armed);
  $('record-label').textContent = recording ? 'Finish this hand' : armed ? 'Cancel recording' : 'Leave a hand';
  $('record').setAttribute('aria-pressed', String(armed));
  $('record').disabled = !armed && score.hands.length >= MAX_HANDS && !visitor;
  $('stage').classList.toggle('is-armed', armed);
  $('record-count').hidden = !recording;
  $('mode-label').textContent = recording ? 'Recording. Release to leave this hand behind.'
    : armed ? 'Ready. Press a bell or draw a path to begin.'
      : paused ? 'Time is resting.' : score.hands.length ? 'Join the hands you left behind.' : 'Touch a bell. It remembers a sound.';
  $('gesture-hint').textContent = armed ? 'Press, move, release. Up to eight seconds.' : 'Every hand you leave repeats on an eight-second clock.';
  $('play').textContent = paused ? '▷' : 'Ⅱ';
  $('play').setAttribute('aria-label', paused ? 'Resume time' : 'Pause time');
  $('play').setAttribute('aria-pressed', String(paused));
  $('speed').textContent = `${speed}×`;
  $('speed').setAttribute('aria-label', `Playback speed: ${speed} times`);
}

function updateAll() { updateStudy(); updateHands(); updateTransport(); }

function returnFromVisitor() {
  if (!visitor) return;
  ({ score, progress, time, paused, undoStack } = visitor);
  visitor = null; live = null; previousOccupancy.clear(); previousBeat = -1; lastRing.fill(-Infinity); lastFrame = 0;
  updateAll();
}

function selectStudy(index) {
  cancelRecording(false); returnFromVisitor(); save();
  current = index; score = scores.get(STUDIES[index].id) || blankScore(STUDIES[index].id);
  undoStack = []; paused = false; live = null; heldKey = null; resetClock();
  $('hint').hidden = true; $('hint-toggle').setAttribute('aria-expanded', 'false');
  updateAll(); save();
}

function armRecording() {
  if (recording) { finishRecording(); return; }
  if (armed) { cancelRecording(); return; }
  returnFromVisitor();
  if (score.hands.length >= MAX_HANDS) { notice('All six hands are here. Remove one to leave another.'); return; }
  beginSound(); paused = false; armed = true; live = null; heldKey = null;
  updateTransport();
}

function startRecording(point) {
  if (!armed || recording) return;
  checkpoint(); resetClock();
  recording = { points: [{ x: point.x, y: point.y, t: 0 }], elapsed: 0 };
  updateTransport();
}

function finishRecording() {
  if (!recording) return;
  const usedColors = new Set(score.hands.map(h => h.color));
  const color = COLORS.find(c => !usedColors.has(c)) || COLORS[score.hands.length];
  score.hands.push(makeHand(recording.points, `hand-${Date.now().toString(36)}-${nextId++}`, color));
  recording = null; armed = false; live = null; heldKey = null; pointerId = null;
  resetClock(); updateAll(); save();
  notice(score.hands.length === 1 ? 'There you are. Your hand will keep going. Join it with your own.' : 'Another version of you, keeping time.');
}

function cancelRecording(announce = true) {
  if (recording) undoStack.pop();
  const hadRecording = armed;
  recording = null; armed = false; live = null; pointerId = null; heldKey = null;
  updateTransport();
  if (announce && hadRecording) notice('That moment is gone. Your saved hands are still here.');
}

function press(point) {
  beginSound();
  if (paused) { paused = false; lastFrame = 0; updateTransport(); }
  live = { ...point };
  startRecording(point);
}

function release() {
  if (recording) finishRecording();
  live = null; pointerId = null; heldKey = null;
}

$('stage').addEventListener('pointerdown', event => {
  if (event.button !== 0 || pointerId !== null) return;
  event.preventDefault();
  pointerId = event.pointerId;
  $('stage').setPointerCapture(pointerId);
  // A bell's touch target is deliberately bigger on a phone. Snap to its center.
  const bell = event.target.closest('[data-note]');
  press(bell ? NOTES[Number(bell.dataset.note)] : renderer.point(event.clientX, event.clientY));
});
$('stage').addEventListener('pointermove', event => {
  if (event.pointerId !== pointerId) return;
  live = renderer.point(event.clientX, event.clientY);
});
$('stage').addEventListener('pointerup', event => { if (event.pointerId === pointerId) release(); });
$('stage').addEventListener('pointercancel', () => { cancelRecording(); });
$('stage').addEventListener('lostpointercapture', () => { if (pointerId !== null) release(); });
// Assistive-technology generated clicks and keyboard activation of a bell.
bellButtons.forEach((button, index) => button.addEventListener('click', event => {
  if (event.detail !== 0 || heldKey !== null) return;
  beginSound();
  if (armed) { press(NOTES[index]); finishRecording(); }
  else { instrument.ring(NOTES[index].midi, (NOTES[index].x - 500) / 300); renderer.flash(index); }
}));

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && armed) { event.preventDefault(); cancelRecording(); return; }
  if (document.querySelector('dialog[open]') || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
  if (event.repeat) return;
  if (event.code === 'Space' && event.target.tagName !== 'BUTTON' && event.target.tagName !== 'A') {
    event.preventDefault(); armRecording(); return;
  }
  if (/^[1-7]$/.test(event.key) && heldKey === null && pointerId === null) {
    event.preventDefault(); heldKey = event.key; press(NOTES[Number(event.key) - 1]);
  }
});
document.addEventListener('keyup', event => { if (event.key === heldKey) release(); });
window.addEventListener('blur', () => {
  if (recording) cancelRecording();
  live = null; heldKey = null; pointerId = null;
});

$('record').addEventListener('click', armRecording);
$('play').addEventListener('click', () => {
  if (recording) finishRecording();
  paused = !paused; lastFrame = 0; live = null; heldKey = null;
  $('time-fill').style.width = `${mod(time, DURATION) / DURATION * 100}%`;
  if (!paused) beginSound();
  updateTransport();
});
$('speed').addEventListener('click', () => {
  if (recording) { notice('Finish this hand before changing the clock.'); return; }
  speed = speed === 1 ? .5 : speed === .5 ? 1.5 : 1;
  updateTransport();
});
$('restart').addEventListener('click', () => {
  if (recording) cancelRecording(false);
  resetClock(); updateStudy(); beginSound();
});
$('sound').addEventListener('click', async () => {
  if (instrument.enabled) {
    soundWanted = false; instrument.mute(); $('sound').setAttribute('aria-pressed', 'false'); $('sound-label').textContent = 'Sound off';
  } else { soundWanted = true; await beginSound(); }
});
$('hint-toggle').addEventListener('click', () => {
  $('hint').hidden = !$('hint').hidden;
  $('hint-toggle').setAttribute('aria-expanded', String(!$('hint').hidden));
});
$('studies').addEventListener('click', event => {
  const button = event.target.closest('[data-study]');
  if (button) selectStudy(Number(button.dataset.study));
});
$('next-study').addEventListener('click', () => selectStudy(Math.min(4, current + 1)));
$('hands').addEventListener('click', event => {
  const action = event.target.closest('[data-action]');
  if (!action || visitor || recording) return;
  const hand = score.hands.find(h => h.id === action.closest('[data-hand]').dataset.hand);
  if (!hand) return;
  if (action.dataset.action === 'twin' && score.hands.length >= MAX_HANDS) return;
  checkpoint();
  switch (action.dataset.action) {
    case 'remove': score.hands = score.hands.filter(h => h !== hand); break;
    case 'reverse': hand.reverse = !hand.reverse; break;
    case 'mute': hand.muted = !hand.muted; break;
    case 'shift': hand.offset = mod(hand.offset + 1000, DURATION); break;
    case 'twin': {
      const twin = structuredClone(hand);
      twin.id = `hand-${Date.now().toString(36)}-${nextId++}`;
      twin.color = COLORS.find(c => !score.hands.some(h => h.color === c)) || COLORS[score.hands.length];
      score.hands.push(twin); break;
    }
  }
  resetClock(); updateAll(); save();
  // Restore focus to the affected row after rendering it.
  const row = [...$('hands').children].find(el => el.dataset.hand === hand.id);
  row?.querySelector(`[data-action="${action.dataset.action}"]`)?.focus({ preventScroll: true });
});
$('undo').addEventListener('click', () => {
  if (!undoStack.length || visitor) return;
  cancelRecording(false);
  score = validateScore(JSON.parse(undoStack.pop()));
  resetClock(); updateAll(); save(); notice('Your previous hands are back.');
});
$('visitor').addEventListener('click', () => {
  if (visitor) { returnFromVisitor(); return; }
  cancelRecording(false); save(); beginSound();
  visitor = { score, progress, time, paused, undoStack };
  score = visitorScore(); progress = newProgress(); time = 0; paused = false; undoStack = [];
  previousOccupancy.clear(); lastRing.fill(-Infinity); previousBeat = -1; lastFrame = 0;
  updateAll();
});

function openDialog(id) {
  if (recording) finishRecording();
  live = null; heldKey = null;
  $(id).showModal();
}
$('help').addEventListener('click', () => openDialog('help-dialog'));
$('keepsake').addEventListener('click', () => {
  $('score-name').value = score.title;
  $('dialog-status').textContent = ''; $('share-fallback').hidden = true;
  openDialog('keepsake-dialog');
});
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
}));
$('score-name').addEventListener('input', () => { score.title = $('score-name').value.slice(0, 80); save(); });

function download(content, type, name) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
$('save-score').addEventListener('click', () => {
  download(scoreSVG(score), 'image/svg+xml', 'elsewhen-score.svg');
  $('dialog-status').textContent = 'Your drawing is ready to print, or open in any browser.';
});
$('save-recording').addEventListener('click', () => {
  download(JSON.stringify(score), 'application/json', 'my-hands.elsewhen.json');
  $('dialog-status').textContent = 'Open this recording here whenever you want these hands back.';
});
$('share').addEventListener('click', async () => {
  try {
    const bytes = new TextEncoder().encode(JSON.stringify(packScore(score)));
    const encoded = btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
    const url = new URL(location.href); url.hash = `score=${encoded}`;
    if (url.href.length > 16000) throw new Error('This recording is too long for a replay link. Save the recording instead.');
    try {
      await navigator.clipboard.writeText(url.href);
      $('dialog-status').textContent = 'Replay link copied. Anyone with the link can play these gestures.';
    } catch {
      $('share-fallback').hidden = false; $('share-url').value = url.href; $('share-url').focus(); $('share-url').select();
      $('dialog-status').textContent = 'Select and copy the link above to share these gestures.';
    }
  } catch (error) { $('dialog-status').textContent = error.message; }
});

function installScore(imported) {
  cancelRecording(false); returnFromVisitor(); save();
  const index = STUDIES.findIndex(s => s.id === imported.study);
  current = index; score = scores.get(imported.study) || blankScore(imported.study);
  undoStack = []; checkpoint(); score = imported;
  paused = false; resetClock(); updateAll(); save();
}
$('import').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 160000) throw new Error('That file is too large. Choose an Elsewhen recording under 160 KB.');
    const imported = validateScore(JSON.parse(await file.text()));
    installScore(imported); $('keepsake-dialog').close();
    notice('These hands are here again. Undo will bring back your previous recording.');
  } catch (error) {
    $('dialog-status').textContent = error instanceof SyntaxError ? 'That file is not readable JSON. Choose an exported Elsewhen recording.' : error.message;
  } finally { event.target.value = ''; }
});

function readLink() {
  if (!location.hash.startsWith('#score=')) return;
  try {
    const hash = location.hash.slice(7);
    if (hash.length > 16000 || !/^[A-Za-z0-9_-]+$/.test(hash)) throw new Error('This replay link is incomplete. Your saved hands are still here.');
    const bytes = Uint8Array.from(atob(hash.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
    const imported = unpackScore(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
    installScore(imported);
    // Clearing the fragment prevents reload from overwriting later edits.
    history.replaceState(null, '', location.pathname + location.search);
    notice('A few seconds from someone else. These hands are yours to play with.');
  } catch {
    notice('This replay link could not be read. Your saved hands are still here.');
  }
}
window.addEventListener('hashchange', readLink);

function tick(now) {
  if (document.hidden) { lastFrame = 0; return; }
  const elapsed = lastFrame ? Math.min(now - lastFrame, 80) : 0;
  lastFrame = now;
  const dt = paused ? 0 : elapsed * speed;
  time += dt;
  if (recording && live) {
    recording.elapsed += dt;
    const t = Math.min(DURATION, recording.elapsed);
    if (t > recording.points.at(-1).t) recording.points.push({ x: live.x, y: live.y, t });
    $('record-seconds').textContent = Math.max(0, (DURATION - t) / 1000).toFixed(1);
    if (t >= DURATION) finishRecording();
  }
  const actors = actorsAt(score, time, live);
  const occupancy = occupiedNotes(actors);
  const beat = Math.floor(time / 1000);
  const present = new Set();
  occupancy.forEach((sources, index) => {
    let entered = false;
    for (const source of sources) {
      const key = `${source.id}:${index}`; present.add(key);
      if (!previousOccupancy.has(key)) entered = true;
    }
    const pulse = sources.length && beat !== previousBeat;
    if (!paused && (entered || pulse) && time - lastRing[index] > 85) {
      instrument.ring(NOTES[index].midi, (NOTES[index].x - 500) / 310, entered ? 1 : .5);
      renderer.flash(index); lastRing[index] = time;
    }
    if (frameCount % 8 === 0) bellButtons[index].setAttribute('aria-pressed', String(sources.length > 0));
  });
  previousOccupancy = present; previousBeat = beat;
  if (!paused && !visitor && !recording) {
    const wasComplete = progress.complete;
    progress = evaluateStudy(STUDIES[current], progress, actors, time, dt);
    if (progress.complete && !wasComplete) {
      completed.add(STUDIES[current].id); save(); updateStudy(); instrument.celebrate();
      notice(`${STUDIES[current].title}, complete. ${STUDIES[current].reward}`);
    }
  }
  renderer.draw({ score, time, actors, study: visitor ? STUDIES[4] : STUDIES[current], progress,
    recording, armed, live, paused, visitor: Boolean(visitor) });
  if (frameCount % 3 === 0) {
    $('time-fill').style.width = `${mod(time, DURATION) / DURATION * 100}%`;
    $('progress-fill').style.width = `${progress.fraction * 100}%`;
    if (frameCount % 15 === 0) $('study-progress').querySelector('[role="progressbar"]').setAttribute('aria-valuenow', String(Math.round(progress.fraction * 100)));
    if (current === 2 && !visitor && !progress.complete) $('progress-label').textContent = progress.sequence ? `${progress.sequence} of 6 bells remembered in order.` : 'The left bell begins the circle.';
  }
  frameCount++;
  animationFrame = requestAnimationFrame(tick);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelAnimationFrame(animationFrame);
    if (recording) cancelRecording();
    live = null; heldKey = null; pointerId = null; save(); instrument.suspend();
  } else {
    lastFrame = 0;
    if (soundWanted && instrument.context) beginSound();
    animationFrame = requestAnimationFrame(tick);
  }
});
window.addEventListener('pagehide', save);

restore(); resetClock(); updateAll(); readLink();
animationFrame = requestAnimationFrame(tick);
