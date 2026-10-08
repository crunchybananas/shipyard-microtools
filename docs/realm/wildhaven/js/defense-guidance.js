import { duration } from './calendar.js';
import { coastalReadiness, pressureOptions } from './pressure.js';
import { BUILDINGS, RESOURCES, getBuildingSpec } from './catalog.js';
import { RESEARCH } from './progression.js';
const costText = cost => Object.entries(cost).filter(([, amount]) => amount > 0).map(([resource, amount]) => `${amount} ${RESOURCES[resource].name.toLowerCase()}`).join(', ');

/** Read-only next steps for cargo defense. Company commands remain in Frontier. */
export function coastalDefenseGuidance(state) {
  const pressure = pressureOptions(state), incident = pressure.active, watch = coastalReadiness(state);
  const learned = new Set(state.research?.completed || []);
  const houses = (state.buildings || []).filter(b => b.type === 'barracks');
  const ready = houses.filter(b => b.status === 'ready'), working = ready.filter(b => !b.paused);
  const first = working[0] || ready[0] || houses[0];
  const inspectWatch = first ? { kind: 'inspect', buildingId: first.id } : { kind: 'build', type: 'barracks' };
  const hasWatchkeeping = learned.has('watchkeeping') || houses.length > 0;
  const enoughWatch = incident ? watch.readiness + 1e-6 >= incident.requiredReadiness : watch.readiness > 0;
  const assigned = building => (state.citizens || []).filter(c => c.workplace === building.id && c.job === 'guard').length;
  const vacant = working.find(b => assigned(b) < getBuildingSpec(b.type, b.level || 1).workers);
  const paused = ready.find(b => b.paused), unfinished = houses.find(b => b.status !== 'ready');
  const foodBlocked = working.length > 0 && (!(state.resources?.food > 0) || working.some(b => b.production?.blockedReason === 'Needs food'));
  let staffingAction = inspectWatch;
  let staffingDetail = 'Assign civilian guards in the watch-house inspector. Recruiting these residents into the company takes them away from the watch.';
  if (foodBlocked) {
    staffingAction = { kind: 'town', tab: 'stores', resource: 'food' };
    staffingDetail = 'Watch guards need more food to stay supplied. Food in storage can still be too low to supply every workplace.';
  } else if (vacant) {
    const requested = vacant.desiredWorkers ?? getBuildingSpec(vacant.type, vacant.level || 1).workers;
    staffingAction = requested > assigned(vacant) ? { kind: 'town', tab: 'workforce' } : { kind: 'inspect', buildingId: vacant.id };
    staffingDetail = requested > assigned(vacant) ? 'The watch has vacant requested posts. Free civilian workers in People & jobs; builders, other workplaces and the recruited company share those residents.' : 'This watch house has open posts. Increase its requested civilian guards and keep food supplied.';
  } else if (paused) {
    staffingAction = { kind: 'inspect', buildingId: paused.id }; staffingDetail = 'Resume this paused watch house to make its guard posts available.';
  } else if (unfinished) {
    staffingAction = { kind: 'inspect', buildingId: unfinished.id }; staffingDetail = 'Finish the planned watch house, then staff and supply its new guard posts.';
  } else if (ready.length && !enoughWatch) {
    staffingAction = { kind: 'build', type: 'barracks' }; staffingDetail = 'The current guard posts are full. Add a watch house or upgrade an existing one for more capacity, then staff and supply it.';
  }
  const steps = [
    { id: 'common-ground', label: 'Research Common ground', complete: learned.has('civic_order') || hasWatchkeeping,
      detail: 'A supplied school studies this prerequisite for A standing watch.', kind: 'research', researchId: 'civic_order' },
    { id: 'standing-watch', label: 'Research A standing watch', complete: hasWatchkeeping,
      detail: `Unlock watch houses. Research costs ${costText(RESEARCH.watchkeeping.cost)}.`, kind: 'research', researchId: 'watchkeeping' },
    { id: 'watch-house', label: ready.length ? 'Finish a watch house' : houses.length ? 'Finish the planned watch house' : 'Build a watch house', complete: ready.length > 0,
      detail: `A new watch house needs ${costText(BUILDINGS.barracks.cost)}, then builders to finish it.`, ...inspectWatch },
    { id: 'supplied-guards', label: incident ? `${watch.readiness.toFixed(1)} / ${incident.requiredReadiness} supplied watch readiness` : 'Staff and supply civilian watch guards', complete: enoughWatch,
      detail: staffingDetail, ...staffingAction },
  ];
  if (incident) steps.push({ id: 'patrol', label: `Complete the patrol · ${Math.floor(incident.preparedness * 100)}%`, complete: incident.preparedness + 1e-8 >= 1,
    detail: incident.patrolSecondsRemaining === null ? 'Patrol work stops without supplied civilian guards.' : incident.patrolSecondsRemaining === 0 ? 'Patrol work is complete. Keep enough guards supplied until the incident ends.' : `${duration(incident.patrolSecondsRemaining)} remains at the current supplied readiness, at 1×. A full-strength patrol takes 90 seconds; extra guards cannot skip that work.`, kind: 'wait' });
  const minimumPatrolSeconds = incident ? Math.max(0, incident.watchRequired - incident.watchProgress) / incident.requiredReadiness : null;
  const tooLate = incident && minimumPatrolSeconds > incident.secondsLeft + 1e-6;
  const nextStep = incident?.canDefend ? { id: 'repel', label: 'Repel the cargo crew', kind: 'pressure', action: 'defend' }
    : tooLate && incident.canPay ? { id: 'pay', label: 'Pay the cargo demand', detail: incident.payReason, kind: 'pressure', action: 'pay' }
    : tooLate && incident.canShelter ? { id: 'shelter', label: 'Shelter the cargo', detail: incident.shelterReason, kind: 'pressure', action: 'shelter' }
    : steps.find(step => !step.complete) || null;
  return {
    active: !!incident, title: 'Protect coastal cargo', steps, nextStep,
    distinction: 'Civilian watch-house guards handle coastal cargo demands. Recruited company soldiers, walls and towers handle physical enemies on the island; their orders do not add watch readiness.',
    explanation: 'Paying ends a cargo incident immediately. Shelter reduces possible cargo loss by 40% but does not end the warning. A supplied watch needs both the required readiness and completed patrol work.',
    preparedness: incident?.preparedness ?? null, readiness: watch.readiness, requiredReadiness: incident?.requiredReadiness ?? null,
    secondsLeft: incident?.secondsLeft ?? null, patrolSecondsRemaining: incident?.patrolSecondsRemaining ?? null,
    canPrepareInTime: incident?.canPrepareInTime ?? null,
    timeWarning: tooLate ? 'Even a full-strength watch would miss the deadline for the remaining patrol. Consider paying the demand or sheltering stores to reduce the loss.' : '',
  };
}
