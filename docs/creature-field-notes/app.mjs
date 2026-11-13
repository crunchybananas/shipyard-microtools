import { initExploration } from './exploration.mjs';
import { INGREDIENTS, freshSave, validateSave, evaluate } from './model.mjs';
import { openStore, readSave, writeSave } from './storage.mjs';
import { initAnimation, syncAnimation, animateIngredient, celebrate } from './animation.mjs';
const $ = selector => document.querySelector(selector);
let save = freshSave();
let db;
let pendingWrite = Promise.resolve();
let replaying = false;
let audio;
let confirmAction = null;
let importing = false;
let expedition;
let expeditionReady = false;
const ingredientButtons = new Map();
for (const image of document.querySelectorAll('img')) {
  image.addEventListener('error', () => { image.hidden = true; $('#art-status').hidden = false; });
  if (image.complete && image.naturalWidth === 0) { image.hidden = true; $('#art-status').hidden = false; }
}
function say(message) { $('#feedback').textContent = message; }
function persist() {
  const snapshot = structuredClone(save);
  if (!db) { $('#save-status').textContent = 'Playing without local storage. Export your journal before leaving.'; return; }
  pendingWrite = pendingWrite.then(() => writeSave(db, snapshot)).then(() => {
    $('#save-status').textContent = 'Saved in this browser. Export a copy to take it with you.';
  }).catch(() => { $('#save-status').textContent = 'Could not save in this browser. Export your journal to keep this progress.'; });
}
function tone(success = false) {
  if (!save.sound) return;
  try {
    const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Audio) throw Error('Audio unavailable');
    audio ||= new Audio();
    void audio.resume().catch(() => {});
    const notes = success ? [392, 493.88, 587.33] : [440];
    notes.forEach((frequency, index) => {
      const oscillator = audio.createOscillator(), gain = audio.createGain();
      const start = audio.currentTime + index * .12;
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(.07, start + .015);
      gain.gain.exponentialRampToValueAtTime(.001, start + .4);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(start); oscillator.stop(start + .45);
    });
  } catch { save.sound = false; render(); persist(); }
}
function render() {
  for (const ingredient of INGREDIENTS) {
    const button = ingredientButtons.get(ingredient.id);
    const collected = save.collected.includes(ingredient.id), selected = save.mixture.includes(ingredient.id);
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
    button.setAttribute('aria-label', `${ingredient.name}. ${ingredient.clue} ${selected ? 'Already in the pot.' : collected ? 'Tap once to add to the pot.' : 'Find this on the pond trail.'}`);
    button.querySelector('.ingredient-state').textContent = selected ? 'In the pot ✓' : collected ? 'Add to pot' : 'Find on trail';
    button.disabled = !collected || selected;
  }
  $('#mixture').replaceChildren(...Array.from({ length: 3 }, (_, index) => {
    const li = document.createElement('li'), id = save.mixture[index];
    if (id) {
      const ingredient = INGREDIENTS.find(item => item.id === id);
      const button = document.createElement('button');
      button.textContent = `${index + 1}. ${ingredient.name} ×`;
      button.setAttribute('aria-label', `Remove ${ingredient.name} from position ${index + 1}`);
      button.addEventListener('click', () => { save.mixture.splice(index, 1); render(); persist(); ingredientButtons.get(id).focus(); say(`${ingredient.name} returned to your basket.`); });
      li.append(button);
    } else { const span = document.createElement('span'); span.className = 'empty'; span.textContent = `${index + 1}. Empty`; li.append(span); }
    return li;
  }));
  $('.pot').dataset.level = String(save.mixture.length);
  $('.living-plate').dataset.level = String(save.mixture.length);
  $('#brew').disabled = save.mixture.length !== 3 || !expeditionReady;
  $('#clear').disabled = save.mixture.length === 0;
  $('#reward').hidden = !save.completed || replaying;
  $('#journal-count').textContent = save.completed ? '1/1' : '0/1';
  $('#entry').hidden = !save.completed;
  $('#empty-journal').hidden = save.completed;
  $('#journal-intro').textContent = save.completed ? 'One encounter, one small kindness. Your first field note is complete.' : 'Your first page is waiting at the pond.';
  $('#start').textContent = save.completed ? 'Return to the pond' : 'Visit the alchemist';
  $('.living-plate').classList.toggle('lantern-lit', save.completed);
  $('.trail-art').classList.toggle('trail-lit', save.completed);
  $('#sound').textContent = save.sound ? 'Sound on' : 'Sound off';
  $('#sound').setAttribute('aria-pressed', String(save.sound));
}
function gather(id) {
  const ingredient = INGREDIENTS.find(item => item.id === id);
  if (!save.collected.includes(id) || save.mixture.includes(id)) return;
  if (save.mixture.length < 3) {
    save.mixture.push(id); animateIngredient(ingredientButtons.get(id), ingredient.shape, ingredient.color); say(`${ingredient.name} added in position ${save.mixture.length}.`);
  } else { say('The pot has three ingredients. Tap one in the pot to remove it, or empty the pot.'); return; }
  tone(); render(); persist();
}
for (const ingredient of INGREDIENTS) {
  const button = document.createElement('button');
  button.hidden = ['berry','acorn'].includes(ingredient.id);
  button.type = 'button'; button.className = 'ingredient'; button.dataset.ingredient = ingredient.id;
  button.style.setProperty('--ingredient-color', ingredient.color);
  const symbol = document.createElement('span'); symbol.className = 'ingredient-symbol'; symbol.textContent = ingredient.shape; symbol.setAttribute('aria-hidden', 'true');
  const name = document.createElement('span'); name.textContent = ingredient.name;
  const state = document.createElement('span'); state.className = 'ingredient-state';
  button.append(symbol, name, state); button.addEventListener('click', () => gather(ingredient.id));
  ingredientButtons.set(ingredient.id, button); $('#ingredients').append(button);
}
function route(moveFocus = false) {
  const valid = ['trail', 'pond', 'journal'];
  let destination = location.hash.slice(1);
  if (!valid.includes(destination)) { destination = 'trail'; history.replaceState(null, '', '#trail'); }
  for (const name of valid) $(`#${name}`).hidden = name !== destination;
  document.querySelectorAll('[data-nav]').forEach(link => {
    if (link.dataset.nav === destination) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
  syncAnimation();
  if (moveFocus) { $('#main').focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' }); }
}
let transition;
$('.skip-link').addEventListener('click', event => { event.preventDefault(); $('#main').focus(); });
window.addEventListener('hashchange', () => {
  transition?.skipTransition();
  if (document.startViewTransition && document.documentElement.classList.contains('motion-on') && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    transition = document.startViewTransition(() => route(true));
    transition.finished.catch(() => {});
  } else route(true);
});
$('#clear').addEventListener('click', () => { save.mixture = []; render(); persist(); say('A clean pot. All your ingredients are still in the basket.'); });
$('#brew').addEventListener('click', () => {
  if (!expeditionReady) return;
  const result = evaluate(save.mixture); say(result.message);
  if (result.success) { celebrate(); save.completed = true; replaying = false; render(); persist(); tone(true); $('#reward').scrollIntoView({ block: 'nearest', behavior: 'instant' }); }
  else tone();
});
$('#replay').addEventListener('click', () => { replaying = true; save.mixture = []; expeditionReady = false; $('#brewing-stage').hidden = true; expedition?.reset(); render(); persist(); $('#exploration').scrollIntoView({block:'start'}); });
$('#sound').addEventListener('click', () => { save.sound = !save.sound; render(); tone(); persist(); });
$('#export').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'heartwood-trail-journal.json'; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
});
function confirmChange({ title, text, accept, action }) {
  $('#confirm-title').textContent = title; $('#confirm-text').textContent = text; $('#accept-confirm').textContent = accept;
  confirmAction = action; $('#confirm-dialog').showModal(); $('#cancel-confirm').focus();
}
$('#cancel-confirm').addEventListener('click', () => $('#confirm-dialog').close());
$('#confirm-dialog').addEventListener('close', () => { confirmAction = null; });
$('#accept-confirm').addEventListener('click', () => { const action = confirmAction; confirmAction = null; $('#confirm-dialog').close(); action?.(); });
$('#reset').addEventListener('click', () => confirmChange({ title: 'Start a fresh journal?', text: 'This clears only your Heartwood Trail progress in this browser. Export a copy first if you’d like to keep it.', accept: 'Start fresh', action: () => { save = freshSave(); replaying = false; expeditionReady = false; $('#brewing-stage').hidden = true; expedition?.reset(); render(); persist(); say('A new visit to the pond.'); } }));
$('#import').addEventListener('click', () => $('#import-file').click());
$('#import-file').addEventListener('change', async event => {
  const file = event.target.files[0]; event.target.value = '';
  if (!file || importing) return;
  importing = true;
  $('#import-status').textContent = '';
  try {
    if (file.size > 100000) throw Error('This file is too large to be a Heartwood journal.');
    const imported = validateSave(JSON.parse(await file.text()));
    confirmChange({ title: 'Replace this journal?', text: 'This will replace your Heartwood Trail progress with the imported journal. Other games are not affected.', accept: 'Use imported journal', action: () => { save = imported; replaying = false; expedition?.reset(); render(); persist(); say('Your imported journal is ready.'); } });
  } catch (error) { $('#import-status').textContent = `Could not import. ${error instanceof SyntaxError ? 'Choose a valid journal JSON file.' : error.message} Your current journal is unchanged.`; }
  finally { importing = false; }
});
// Disable interactions only during initial restore; a failed save never blocks play.
const controls = [...document.querySelectorAll('button')];
controls.forEach(button => button.disabled = true);
try { db = await openStore(); save = await readSave(db); $('#save-status').textContent = 'Saved in this browser. Export a copy to take it with you.'; }
catch { $('#save-status').textContent = 'Local progress could not be loaded. You can still play and export your journal.'; }
controls.forEach(button => button.disabled = false);
render(); route(); initAnimation();
expedition = initExploration({
  onReset() { expeditionReady = false; $('#brewing-stage').hidden = true; save.mixture = []; render(); persist(); },
  onCollect(id) { if (!save.collected.includes(id)) save.collected.push(id); render(); persist(); tone(); },
  onComplete() { expeditionReady = true; $('#brewing-stage').hidden = false; render(); say('The lantern trail is safe. Now use the riddle to mix the remedy. One tap adds an ingredient; remove it using its named slot.'); celebrate(); },
});

const neighbors = [
 ['frog-alchemist', 'Frog Alchemist', true], ['woodland-robot', 'Woodland Robot', false],
 ['blue-ridge-night-creature', 'Blue Ridge Night Creature', false],
 ['mushroom-cartographer', 'Mushroom Cartographer', false], ['creek-salamander-stargazer', 'Creek Salamander Stargazer', false],
];
for (const [id, name, playable] of neighbors) {
 const card = document.createElement(playable ? 'a' : 'div'); card.className = 'neighbor'; if (playable) card.href = '#pond';
 const image = document.createElement('img'); image.src = `assets/${id}.svg`; image.alt = name; image.width = 180; image.height = 180;
 const label = document.createElement('span'); label.textContent = name;
 const status = document.createElement('small'); status.textContent = playable ? 'Visit the pond' : 'A future encounter';
 card.append(image, label, status); $('#neighbors').append(card);
}
