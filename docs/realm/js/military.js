// Player-authored military recruitment. Barracks and ranges provide a
// training place; they never mint troops or spend resources on their own.

import { G } from './state.js?realm=196';
import { emit } from './bus.js?realm=196';
import {
  activeStaffingCount,
  isBuildingComplete,
  isBuildingOperational,
} from './building-operation.js?realm=196';
import { removeCitizenFromWorld } from './citizen-ownership.js?realm=196';
import { nearestWalkableTile } from './pathfinding.js?realm=196';
import { withdrawFoodFromStores } from './building-inventory.js?realm=196';

export const RECRUITMENT = Object.freeze({
  barracks: Object.freeze({
    type: 'swordsman',
    label: 'Swordsman',
    icon: '⚔️',
    cap: 4,
    duration: 360,
    cost: Object.freeze({ iron: 1, food: 2 }),
    hp: 75,
  }),
  archery: Object.freeze({
    type: 'archer',
    label: 'Archer',
    icon: '🏹',
    cap: 3,
    duration: 480,
    cost: Object.freeze({ wood: 2, food: 2 }),
    hp: 30,
  }),
});

export function recruitmentForBuilding(building) {
  return RECRUITMENT[building?.type] || null;
}

export function recruitmentCount(building) {
  return G.soldiers.filter(soldier => soldier.homeBuilding === building).length;
}

function protectedRecruitmentNames() {
  const names = new Set();
  for (const character of Object.values(G.namedCharacters || {})) {
    if (typeof character?.name === 'string') names.add(character.name);
  }
  for (const key of ['founder1', 'founder2', 'founder3']) {
    const name = G.storyFlags?.[key];
    if (typeof name === 'string') names.add(name);
  }
  return names;
}

export function isCitizenProtectedFromRecruitment(citizen) {
  return !!citizen?.identity
    && protectedRecruitmentNames().has(citizen.identity.name);
}

function recruitmentCandidateRank(citizen, building, protectedNames) {
  if (!citizen?.identity || protectedNames.has(citizen.identity.name)) return null;
  const assignment = citizen.assignment;
  if (!assignment) return 0;
  if (assignment.reason === 'player-command') return null;
  if (assignment.building !== building) return 1;

  // A yard hand may enlist only when a real instructor remains on the drill
  // floor. An off-duty yard hand does not reduce the active count when they
  // leave, but still requires somebody else to be actively teaching.
  const candidateIsActive = citizen.activity?.kind === 'working';
  const instructorsAfterEnlistment = activeStaffingCount(building)
    - (candidateIsActive ? 1 : 0);
  return instructorsAfterEnlistment >= 1 ? 2 : null;
}

function selectRecruitmentCandidate(building) {
  const protectedNames = protectedRecruitmentNames();
  return G.citizens
    .map(citizen => ({
      citizen,
      rank: recruitmentCandidateRank(citizen, building, protectedNames),
    }))
    .filter(candidate => candidate.rank !== null)
    .sort((a, b) => (
      a.rank - b.rank
      || a.citizen.actorId - b.citizen.actorId
    ))[0]?.citizen || null;
}

function candidatePreview(citizen, building) {
  if (!citizen) return null;
  const workplace = citizen.assignment?.building || null;
  return Object.freeze({
    actorId: citizen.actorId,
    name: citizen.identity.name,
    profession: citizen.profession.kind,
    source: citizen.assignment ? 'ai-worker' : 'unassigned',
    workplace: workplace ? Object.freeze({
      type: workplace.type,
      x: workplace.x,
      y: workplace.y,
    }) : null,
    sameYard: workplace === building,
  });
}

export function recruitmentCandidatePreview(building) {
  if (!building || !G.buildings.includes(building) || !recruitmentForBuilding(building)) return null;
  return candidatePreview(selectRecruitmentCandidate(building), building);
}

export function recruitmentStatus(building) {
  const spec = recruitmentForBuilding(building);
  if (!spec) return { ok: false, reason: 'not-recruiting-building', spec: null };
  const count = recruitmentCount(building);
  if (!isBuildingComplete(building)) return { ok: false, reason: 'under-construction', spec, count };
  if (building.recruitType) return { ok: false, reason: 'queue-busy', spec, count };
  if (count >= spec.cap) return { ok: false, reason: 'unit-cap', spec, count };
  // Keep one civilian in the realm. This deliberately still allows the
  // authored First Muster to enlist from four citizens down to one, while
  // making the final civilian a hard, visible workforce floor thereafter.
  if (G.population <= 1) {
    return { ok: false, reason: 'minimum-civilian', spec, count, candidate: null };
  }
  if (!isBuildingOperational(building)) return { ok: false, reason: 'needs-workers', spec, count };
  const candidate = recruitmentCandidatePreview(building);
  if (!candidate) return { ok: false, reason: 'no-candidate', spec, count, candidate: null };
  const missing = Object.entries(spec.cost)
    .filter(([resource, amount]) => (G.resources[resource] || 0) < amount)
    .map(([resource]) => resource);
  if (missing.length) return { ok: false, reason: 'insufficient-resources', spec, count, candidate, missing };
  return { ok: true, spec, count, candidate, lastLevy: G.population === 2 };
}

export function queueRecruit(building) {
  if (!building || !G.buildings.includes(building)) return { ok: false, reason: 'no-building' };
  const status = recruitmentStatus(building);
  if (!status.ok) return status;
  const candidate = selectRecruitmentCandidate(building);
  if (!candidate || candidate.actorId !== status.candidate.actorId) {
    return { ok: false, reason: 'no-candidate', spec: status.spec, count: status.count, candidate: null };
  }

  // Enlistment is immediate: the named civilian leaves population, housing,
  // and any AI-owned workforce slot through the central ownership authority.
  // Only after that transition succeeds do we commit the one-time material
  // cost and queue record.
  const recruitName = candidate.identity.name;
  const foodCost = status.spec.cost.food || 0;
  if (foodCost > 0) {
    const paid = withdrawFoodFromStores(foodCost, { origin: building, state: G });
    if (paid.taken !== foodCost) throw new Error('Recruitment food wallet disagrees with physical stores.');
  }
  removeCitizenFromWorld(candidate, 'military-recruitment');
  for (const [resource, amount] of Object.entries(status.spec.cost)) {
    if (resource !== 'food') G.resources[resource] -= amount;
  }
  building.recruitType = status.spec.type;
  building.recruitName = recruitName;
  building.trainTimer = 0;
  return {
    ok: true,
    name: building.recruitName,
    candidate: status.candidate,
    unit: status.spec.type,
    duration: status.spec.duration,
    lastLevy: status.lastLevy,
  };
}

export function updateRecruitment(building) {
  const spec = recruitmentForBuilding(building);
  if (
    !spec
    || !building.recruitType
    || !isBuildingComplete(building)
    || activeStaffingCount(building) < 1
  ) return false;
  // A save with mismatched queue data fails closed instead of spawning the
  // wrong unit from the wrong training building.
  if (building.recruitType !== spec.type) return false;
  building.trainTimer = (building.trainTimer || 0) + 1;
  if (building.trainTimer < spec.duration) return false;

  const muster = nearestWalkableTile(building.x, building.y, 3) || { x: building.x, y: building.y };
  const soldier = {
    x: muster.x, y: muster.y,
    tx: muster.x, ty: muster.y,
    homeBuilding: building,
    name: building.recruitName,
    type: spec.type,
    hp: spec.hp, maxHp: spec.hp,
    state: 'patrol', stateTimer: 0,
  };
  G.soldiers.push(soldier);
  delete building.recruitType;
  delete building.recruitName;
  building.trainTimer = 0;
  emit('unit-mustered', {
    name: soldier.name,
    unit: spec.type,
    label: spec.label,
    x: soldier.x,
    y: soldier.y,
  });
  return true;
}
