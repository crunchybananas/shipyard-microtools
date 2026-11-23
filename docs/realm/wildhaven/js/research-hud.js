import { RESEARCH } from './progression.js';
import { researchFunding } from './research-projects.js';

export function researchHUD(state, paused = false) {
  const active = state.research?.active, spec = active && RESEARCH[active.id];
  if (!spec) {
    const complete = Object.keys(RESEARCH).every(id => state.research?.completed?.includes(id));
    return complete ? { title: 'Research complete', detail: `${Object.keys(RESEARCH).length} discoveries learned`, progress: 1, status: 'complete', id: null }
      : { title: 'Research', detail: 'Choose a project', progress: 0, status: 'idle', id: null };
  }
  const funding = researchFunding(state, { id: active.id, ...spec });
  const working = state.buildings.some(b => ['school','assay'].includes(b.type) && b.status === 'ready' && !b.paused && b.production?.efficiency > 0);
  const status = funding.paused ? 'paused' : paused ? 'time' : !funding.funded ? 'supplies' : !working ? 'workers' : 'working';
  const progress = Math.max(0, Math.min(1, active.progress / active.duration));
  const detail = ({ paused: 'Project paused', supplies: active.allocation ? `Allocating ${active.allocation}%` : 'Needs supplies', workers: 'Needs staffed, supplied scholars', time: 'Time paused', working: `Stage ${funding.stage + 1} of 3` })[status];
  return { title: spec.name, detail, progress, status, id: active.id };
}
export function mountResearchHUD({ getState, isPaused, open }) {
  const button = document.createElement('button'); button.id = 'research-hud'; button.type = 'button'; button.setAttribute('aria-controls', 'town-book');
  const name = document.createElement('strong'), status = document.createElement('span'), percent = document.createElement('span'), meter = document.createElement('span'), fill = document.createElement('span');
  name.className = 'research-hud-name'; status.className = 'research-hud-status'; percent.className = 'research-hud-percent'; meter.className = 'research-hud-meter';
  meter.setAttribute('role', 'progressbar'); meter.setAttribute('aria-label', 'Research completion'); meter.setAttribute('aria-valuemin', '0'); meter.setAttribute('aria-valuemax', '100');
  meter.append(fill); button.append(name, status, percent, meter); document.querySelector('.supplies').after(button);
  button.onclick = () => open(getState().research?.active?.id);
  function update() {
    const model = researchHUD(getState(), isPaused()), value = Math.floor(model.progress * 100);
    name.textContent = model.title; status.textContent = model.detail; percent.textContent = model.id ? `${value}%` : '›';
    fill.style.width = `${model.progress * 100}%`; meter.setAttribute('aria-valuenow', String(value)); meter.hidden = !model.id;
    button.dataset.status = model.status; button.setAttribute('aria-label', `${model.title}. ${model.detail}${model.id ? `. ${value}% complete` : ''}. Open research.`);
    button.title = `${model.title} · ${model.detail}`;
  }
  update(); return { update };
}
