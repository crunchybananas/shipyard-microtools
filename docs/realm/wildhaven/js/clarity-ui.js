import { RESOURCES } from './catalog.js';
import { buildingFacts } from './clarity.js';
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const amount = n => Math.round(n * 10) / 10;
export function resourceChips(resources, { state = null, cost = false } = {}) {
  const row = el('span', 'resource-chips');
  for (const [id, n] of Object.entries(resources || {}).filter(([, n]) => n > 0)) {
    const short = cost && state && state.resources[id] < n;
    const chip = el('span', `resource-chip${short ? ' missing' : ''}`, `${amount(n)} ${RESOURCES[id].name.toLowerCase()}`);
    if (short) chip.append(el('small', '', ` · ${amount(state.resources[id])} held`));
    row.append(chip);
  }
  return row;
}
export function buildingPurpose(type, level = 1) {
  const facts = buildingFacts(type, level), card = el('section', 'building-purpose');
  card.setAttribute('aria-label', 'Building purpose');
  const flow = el('div', 'purpose-flow');
  if (facts.input.length) {
    flow.append(resourceChips(Object.fromEntries(facts.input.map(r => [r.id, r.amount]))), el('b', 'flow-arrow', '→'));
  }
  if (facts.output.length) flow.append(resourceChips(Object.fromEntries(facts.output.map(r => [r.id, r.amount]))));
  if (!facts.output.length || facts.housing) {
    const output = facts.housing ? `${facts.housing} beds` : facts.storage ? `+${facts.storage} storage / good` : facts.service ? `${facts.service.name} for ${facts.service.capacity} beds` : 'First town milestone';
    flow.append(el('span', 'purpose-benefit', output));
  }
  card.append(flow, el('small', 'purpose-staff', `${facts.staffing}${facts.input.length || facts.output.length ? ' · base / day when fully supplied' : ''}`), el('span', 'purpose-short-use', facts.next), el('span', 'purpose-next', facts.payoff));
  return card;
}
