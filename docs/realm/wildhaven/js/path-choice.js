import { RESEARCH } from './progression.js';

/** The next unfinished prerequisite that can actually be studied. Reads only. */
export function nextPathResearch(state) {
  if (!state.research?.completed?.includes('town_charter') && RESEARCH[state.research?.active?.id]) return state.research.active.id;
  const completed = new Set(state.research?.completed || []), available = [];
  function visit(id) {
    if (completed.has(id)) return;
    const missing = RESEARCH[id].prerequisites.filter(required => !completed.has(required));
    if (!missing.length) { if (!available.includes(id)) available.push(id); return; }
    missing.forEach(visit);
  }
  visit('town_charter');
  return available.find(id => id === state.research?.active?.id) || available[0] || null;
}

/** School setup takes precedence while the charter is still locked. */
export function pathRequirement(state) {
  const researchId = nextPathResearch(state);
  if (!researchId) return null;
  const schools = (state.buildings || []).filter(b => b.type === 'school');
  const working = schools.some(b => b.status === 'ready' && !b.paused && b.production?.efficiency > 0);
  if (!working) {
    const school = schools.find(b => b.status === 'ready') || schools[0];
    return school ? { kind: 'school', buildingId: school.id, building: school.status !== 'ready' } : { kind: 'build' };
  }
  return { kind: 'research', researchId, active: state.research?.active?.id === researchId };
}
