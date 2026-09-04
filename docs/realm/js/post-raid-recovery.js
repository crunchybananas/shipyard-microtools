// Post-raid recovery doctrine — a deterministic, reward-free player choice
// that turns the First Muster victory into one concrete follow-up action.

import { G, BUILDINGS, MAP_H, MAP_W } from './state.js?realm=198';
import { isBuildingComplete, isBuildingOperational } from './building-operation.js?realm=198';
import { isFirstMusterComplete } from './first-muster.js?realm=198';
import {
  citizenAtResidencePortal,
  citizenHasValidResidence,
  residentsForHouse,
} from './residences.js?realm=198';

export const POST_RAID_RECOVERY_ID = 'post_raid_recovery';
export const POST_RAID_DOCTRINE_PATH = 'storyFlags.postRaidDoctrine';
export const POST_RAID_DOCTRINES = Object.freeze(['rebuild', 'fortify', 'explore']);
export const STABILIZE_HOUSEHOLD_ID = 'stabilize_household';

const DOCTRINE_SET = new Set(POST_RAID_DOCTRINES);
const FOOD_WORKPLACES = new Set(['farm', 'fisherman', 'chickencoop', 'cowpen', 'bakery']);
const DEFENSIVE_BUILDINGS = new Set(['wall', 'tower']);
const APPROACH_LABELS = Object.freeze(['north', 'east', 'south', 'west']);

const DOCTRINE_CARDS = Object.freeze({
  rebuild: Object.freeze({
    id: 'rebuild',
    title: 'Rebuild',
    summary: 'Put food production back on its feet.',
    objectiveId: 'restore_food_workplace',
    objective: 'Restore an operational food workplace',
    detail: 'After choosing Rebuild, staff one more completed food workplace and keep it operating.',
    focus: 'food-workplace',
    action: 'manage-workforce',
  }),
  fortify: Object.freeze({
    id: 'fortify',
    title: 'Fortify',
    summary: 'Turn the raiders\' route into a defended frontier.',
    objectiveId: 'fortify_approach',
    objective: 'Complete a new Wall or Tower on the raiders\' approach',
    detail: 'Complete one more Wall or Tower after choosing Fortify.',
    focus: 'defensive-building',
    action: 'build-defense',
  }),
  explore: Object.freeze({
    id: 'explore',
    title: 'Explore',
    summary: 'Use the breathing room to chart what lies beyond the frontier.',
    objectiveId: 'chart_new_find',
    objective: 'Chart one new Founder scouting find',
    detail: 'Send the Founder back into the fog and uncover one find after choosing Explore.',
    focus: 'founder',
    action: 'follow-founder',
  }),
});

function validApproach(value) {
  return Number.isSafeInteger(value) && value >= 0 && value < APPROACH_LABELS.length;
}

function selectedDoctrine(state) {
  const value = state.storyFlags?.postRaidDoctrine;
  return DOCTRINE_SET.has(value) ? value : null;
}

function choiceTick(state) {
  const value = state.storyFlags?.postRaidChoiceTick;
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function rememberedApproach(state) {
  const firstRaid = state.storyFlags?.firstRaidApproach;
  if (validApproach(firstRaid)) return firstRaid;
  return validApproach(state._raidSide) ? state._raidSide : null;
}

function unlockReason(state) {
  if (state.scenario !== 'military_rise') return 'wrong-scenario';
  if (!isFirstMusterComplete(state)) return 'first-muster-incomplete';
  if ((state.enemies?.length || 0) > 0) return 'raid-active';
  return null;
}

function scalarBaseline(state, key) {
  const value = state.storyFlags?.[key];
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function operationalFoodWorkplaces(state) {
  return (state.buildings || []).filter(building =>
    FOOD_WORKPLACES.has(building.type)
      && isBuildingComplete(building)
      && isBuildingOperational(building)
  );
}

function rebuildProgress(state) {
  const baseline = scalarBaseline(state, 'postRaidRebuildBaseline');
  const operational = operationalFoodWorkplaces(state);
  const gained = Math.max(0, operational.length - baseline);
  const building = gained > 0 ? operational[operational.length - 1] : null;
  return Object.freeze({
    current: Math.min(1, gained),
    target: 1,
    baseline,
    operational: operational.length,
    targetBuilding: building ? Object.freeze({
      type: building.type,
      name: BUILDINGS[building.type]?.name || building.type,
      x: building.x,
      y: building.y,
    }) : null,
  });
}

function onKnownApproach(building, approach) {
  const margin = 5;
  if (approach === 0) return building.y <= MAP_H / 2 - margin;
  if (approach === 1) return building.x >= MAP_W / 2 + margin;
  if (approach === 2) return building.y >= MAP_H / 2 + margin;
  if (approach === 3) return building.x <= MAP_W / 2 - margin;
  return true;
}

function fortifyProgress(state) {
  const approach = rememberedApproach(state);
  const baseline = scalarBaseline(state, 'postRaidFortifyBaseline');
  const defenses = (state.buildings || []).filter(candidate =>
    DEFENSIVE_BUILDINGS.has(candidate.type)
      && isBuildingComplete(candidate)
      && onKnownApproach(candidate, approach)
  );
  const gained = Math.max(0, defenses.length - baseline);
  const building = gained > 0 ? defenses[defenses.length - 1] : null;
  return Object.freeze({
    current: Math.min(1, gained),
    target: 1,
    baseline,
    completedDefenses: defenses.length,
    targetBuilding: building ? Object.freeze({
      type: building.type,
      name: BUILDINGS[building.type]?.name || building.type,
      x: building.x,
      y: building.y,
    }) : null,
    approach: approach === null ? null : APPROACH_LABELS[approach],
    directional: approach !== null,
  });
}

function exploreProgress(state) {
  const baselineValue = state.storyFlags?.postRaidExploreBaseline;
  const baseline = Number.isSafeInteger(baselineValue) && baselineValue >= 0 ? baselineValue : 0;
  const finds = Number.isSafeInteger(state.avatar?.scoutingFinds) ? state.avatar.scoutingFinds : 0;
  return Object.freeze({
    current: Math.min(1, Math.max(0, finds - baseline)),
    target: 1,
    baseline,
    totalFinds: finds,
  });
}

// Recovery is not complete when the chosen policy merely changes a counter.
// A survivor must make a real post-choice night: their own completed House
// must still own them, and their sleep transition must begin strictly after
// the doctrine choice. The portal check keeps a stale/outdoor `sleep` state
// from satisfying the objective.
function stabilizeHouseholdProgress(state) {
  const selectedAt = choiceTick(state);
  const buildings = state.buildings || [];
  const citizens = state.citizens || [];
  const eligibleResidents = [];
  for (const house of buildings) {
    if (!isBuildingComplete(house) || house.type !== 'house') continue;
    for (const citizen of residentsForHouse(house, citizens)) {
      if (!citizenHasValidResidence(citizen, { buildings, citizens })) continue;
      eligibleResidents.push(citizen);
    }
  }
  const sleepingResident = eligibleResidents.find(citizen => (
    citizen.activity?.kind === 'sleep'
      && Number.isSafeInteger(citizen.activity?.sinceTick)
      && citizen.activity.sinceTick > selectedAt
      && citizenAtResidencePortal(citizen, { buildings, citizens })
  ));
  return Object.freeze({
    current: sleepingResident ? 1 : 0,
    target: 1,
    choiceTick: selectedAt,
    eligibleResidents: eligibleResidents.length,
    resident: sleepingResident ? Object.freeze({
      actorId: sleepingResident.actorId,
      name: sleepingResident.identity?.name || sleepingResident.name || 'Resident',
      home: Object.freeze({ x: sleepingResident.home.x, y: sleepingResident.home.y }),
      sinceTick: sleepingResident.activity.sinceTick,
    }) : null,
  });
}

function objectiveProgress(doctrine, state) {
  if (doctrine === 'rebuild') return rebuildProgress(state);
  if (doctrine === 'fortify') return fortifyProgress(state);
  return exploreProgress(state);
}

function stabilizationObjective(state, stabilization, complete = false) {
  return Object.freeze({
    id: STABILIZE_HOUSEHOLD_ID,
    doctrine: selectedDoctrine(state),
    text: 'Stabilize one household',
    detail: 'Let a surviving resident reach their own completed House and sleep there after choosing the recovery doctrine.',
    focus: 'household',
    action: 'open-house',
    status: complete ? 'completed' : 'current',
    satisfied: complete || stabilization.current >= stabilization.target,
    progress: stabilization,
  });
}

function objectiveDetail(doctrine, state) {
  const card = DOCTRINE_CARDS[doctrine];
  if (doctrine !== 'fortify') return card.detail;
  const approach = rememberedApproach(state);
  return approach === null
    ? `${card.detail} The earlier approach was not preserved in this save, so any new Wall or Tower qualifies.`
    : `Complete one more Wall or Tower in the ${APPROACH_LABELS[approach]} approach after choosing Fortify.`;
}

export function getPostRaidRecoveryReport(state = G) {
  const selected = selectedDoctrine(state);
  const lockedReason = unlockReason(state);
  const unlocked = lockedReason === null;
  const doctrineObserved = selected ? objectiveProgress(selected, state) : null;
  const doctrineSatisfied = !!doctrineObserved && doctrineObserved.current >= doctrineObserved.target;
  const stabilization = selected ? stabilizeHouseholdProgress(state) : null;
  // Completion is a deliberate latch. The transition into this flag is
  // guarded by both doctrine progress and a qualifying physical sleep in
  // updatePostRaidRecovery; after that, waking or later damage must not make
  // the completed scenario regress.
  const complete = !!selected && state.storyFlags?.postRaidRecoveryComplete === true;
  const choices = POST_RAID_DOCTRINES.map(doctrine => {
    const card = DOCTRINE_CARDS[doctrine];
    return Object.freeze({
      ...card,
      detail: objectiveDetail(doctrine, state),
      enabled: unlocked && selected === null,
      status: selected === doctrine
        ? complete ? 'completed' : 'selected'
        : selected === null ? unlocked ? 'available' : 'locked' : 'unavailable',
    });
  });
  let primary = null;
  if (selected) {
    const card = DOCTRINE_CARDS[selected];
    const observedProgress = doctrineObserved;
    const doctrinePrimary = Object.freeze({
      id: card.objectiveId,
      doctrine: selected,
      text: card.objective,
      detail: objectiveDetail(selected, state),
      focus: card.focus,
      action: card.action,
      status: doctrineSatisfied ? 'completed' : 'current',
      satisfied: doctrineSatisfied,
      progress: observedProgress,
    });
    const latchedStabilization = complete && stabilization.current < stabilization.target
      ? Object.freeze({ ...stabilization, current: stabilization.target })
      : stabilization;
    primary = doctrineSatisfied || complete
      ? stabilizationObjective(state, latchedStabilization, complete)
      : doctrinePrimary;
  }
  const approach = rememberedApproach(state);
  return Object.freeze({
    id: POST_RAID_RECOVERY_ID,
    statePath: POST_RAID_DOCTRINE_PATH,
    unlocked,
    canChoose: unlocked && selected === null,
    lockedReason,
    selected,
    choiceTick: selected ? choiceTick(state) : null,
    complete,
    doctrine: selected ? Object.freeze({
      id: DOCTRINE_CARDS[selected].objectiveId,
      satisfied: doctrineSatisfied,
      progress: doctrineObserved,
    }) : null,
    stabilization,
    approach: approach === null ? null : Object.freeze({
      side: approach,
      label: APPROACH_LABELS[approach],
      persisted: validApproach(state.storyFlags?.firstRaidApproach),
    }),
    choices: Object.freeze(choices),
    primary,
  });
}

export function getPostRaidRecoverySnapshot(state = G) {
  return getPostRaidRecoveryReport(state);
}

export function choosePostRaidDoctrine(doctrine, state = G) {
  if (!DOCTRINE_SET.has(doctrine)) return { ok: false, reason: 'invalid-doctrine' };
  const lockedReason = unlockReason(state);
  if (lockedReason) return { ok: false, reason: lockedReason };
  if (Object.hasOwn(state.storyFlags || {}, 'postRaidDoctrine')) {
    return { ok: false, reason: 'doctrine-already-chosen' };
  }

  const selectedAt = Number.isSafeInteger(state.gameTick) && state.gameTick >= 0
    ? state.gameTick
    : 0;
  let baselineKey;
  let baseline;
  if (doctrine === 'rebuild') {
    baselineKey = 'postRaidRebuildBaseline';
    baseline = operationalFoodWorkplaces(state).length;
  } else if (doctrine === 'fortify') {
    const approach = rememberedApproach(state);
    baselineKey = 'postRaidFortifyBaseline';
    baseline = (state.buildings || []).filter(building =>
      DEFENSIVE_BUILDINGS.has(building.type)
        && isBuildingComplete(building)
        && onKnownApproach(building, approach)
    ).length;
  } else {
    baselineKey = 'postRaidExploreBaseline';
    baseline = Number.isSafeInteger(state.avatar?.scoutingFinds)
      ? state.avatar.scoutingFinds
      : 0;
  }

  state.storyFlags = state.storyFlags || {};
  state.storyFlags.postRaidDoctrine = doctrine;
  state.storyFlags.postRaidChoiceTick = selectedAt;
  state.storyFlags[baselineKey] = baseline;
  return { ok: true, doctrine, report: getPostRaidRecoveryReport(state) };
}

export function updatePostRaidRecovery(state = G) {
  if (state.scenario !== 'military_rise') return getPostRaidRecoveryReport(state);
  const report = getPostRaidRecoveryReport(state);
  if (report.complete) return report;
  const recoverySatisfied = !!report.selected
    && report.doctrine?.satisfied === true
    && report.stabilization?.current >= report.stabilization?.target;
  if (!recoverySatisfied) return report;
  state.storyFlags.postRaidRecoveryComplete = true;
  return getPostRaidRecoveryReport(state);
}

export function isPostRaidRecoveryComplete(state = G) {
  return getPostRaidRecoveryReport(state).complete;
}

export function getPostRaidRecoveryScenarioObjectives(state = G) {
  const report = getPostRaidRecoveryReport(state);
  if (!report.selected) {
    return [Object.freeze({
      id: 'choose_recovery_doctrine',
      text: 'Choose a recovery doctrine',
      detail: 'Commit the realm to Rebuild, Fortify, or Explore.',
      focus: 'recovery-doctrine',
      action: 'choose-recovery-doctrine',
      check: () => false,
      progress: () => [0, 1],
    })];
  }
  const primary = report.primary;
  return [Object.freeze({
    id: primary.id,
    text: primary.text,
    detail: primary.detail,
    focus: primary.focus,
    action: primary.action,
    check: () => getPostRaidRecoveryReport(state).complete,
    progress: () => {
      const current = getPostRaidRecoveryReport(state).primary?.progress;
      return current ? [current.current, current.target] : [0, 1];
    },
  })];
}
