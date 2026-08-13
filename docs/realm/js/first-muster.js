// The First Muster — one deterministic, sequential opening chapter for the
// military frontier. The compact step cursor lives in storyFlags so existing
// saves can address it without adding another root-state surface.

import { G, BUILDINGS, rngInt } from './state.js?realm=193';
import { isBuildingComplete } from './building-operation.js?realm=193';
import { staffingCount } from './citizen-ownership.js?realm=193';
import { emit } from './bus.js?realm=193';

export const FIRST_MUSTER_CHAPTER_ID = 'first_muster';
export const FIRST_MUSTER_STATE_PATH = 'storyFlags.firstMusterStep';

const FOOD_SOURCE_TYPES = new Set([
  'farm', 'fisherman', 'chickencoop', 'cowpen', 'bakery',
]);
const RAID_DIRECTIONS = Object.freeze(['north', 'east', 'south', 'west']);

export const FIRST_MUSTER_STEPS = Object.freeze([
  Object.freeze({
    id: 'food_source',
    text: 'Complete a food source',
    detail: 'Finish a Farm, Fisherman\'s Hut, Chicken Coop, Cow Pen, or Bakery.',
    focus: 'build-food',
  }),
  Object.freeze({
    id: 'house',
    text: 'Complete a House',
    detail: 'Raise a finished home before asking settlers to defend the frontier.',
    focus: 'build-house',
  }),
  Object.freeze({
    id: 'staff_barracks',
    text: 'Complete and staff a Barracks',
    detail: 'A finished Barracks needs its full crew before it can drill recruits.',
    focus: 'build-barracks',
  }),
  Object.freeze({
    id: 'muster_three',
    text: 'Muster 3 defenders',
    detail: 'Order three named swordsmen from a staffed Barracks.',
    focus: 'barracks',
  }),
  Object.freeze({
    id: 'scout_approach',
    text: 'Scout with the Founder to locate the raiders\' approach',
    detail: 'Follow the Founder into the fog until one scouting find is charted.',
    focus: 'founder',
    action: 'follow-founder',
  }),
  Object.freeze({
    id: 'plant_rally',
    text: 'Plant a rally flag',
    detail: 'Commit the defenders to the approach your Founder located.',
    focus: 'rally',
    action: 'place-rally',
  }),
  Object.freeze({
    id: 'survive_raid',
    text: 'Survive the first raid',
    detail: 'Keep the realm alive until the first warband has left the field.',
    focus: 'raid',
  }),
]);

function completedBuildingCount(state, predicate) {
  let count = 0;
  for (const building of state.buildings || []) {
    if (predicate(building) && isBuildingComplete(building)) count++;
  }
  return count;
}

function staffedBarracksProgress(state) {
  const needed = BUILDINGS.barracks.workers || 0;
  let best = 0;
  for (const building of state.buildings || []) {
    if (building.type !== 'barracks' || !isBuildingComplete(building)) continue;
    best = Math.max(best, Math.min(needed, staffingCount(building)));
  }
  return [best, needed];
}

const STEP_PROGRESS = Object.freeze([
  state => [Math.min(1, completedBuildingCount(state, building => FOOD_SOURCE_TYPES.has(building.type))), 1],
  state => [Math.min(1, completedBuildingCount(state, building => building.type === 'house')), 1],
  staffedBarracksProgress,
  state => [Math.min(3, state.soldiers?.length || 0), 3],
  state => [Math.min(1, state.avatar?.scoutingFinds || 0), 1],
  state => [state.rallyPoint ? 1 : 0, 1],
  state => [
    (state.stats?.raidsSurvived || 0) >= 1
      && (state.enemies?.length || 0) === 0
      ? 1 : 0,
    1,
  ],
]);

function chapterStep(state) {
  const value = state.storyFlags?.firstMusterStep;
  if (!Number.isSafeInteger(value) || value < 0) return 0;
  return Math.min(value, FIRST_MUSTER_STEPS.length);
}

function progressFor(index, state) {
  const [current, target] = STEP_PROGRESS[index](state);
  return Object.freeze({ current, target });
}

export function getFirstMusterReport(state = G) {
  const currentIndex = chapterStep(state);
  const complete = currentIndex >= FIRST_MUSTER_STEPS.length;
  const steps = FIRST_MUSTER_STEPS.map((definition, index) => {
    const progress = progressFor(index, state);
    const knownApproach = RAID_DIRECTIONS[state._raidSide];
    const detail = definition.id === 'plant_rally' && knownApproach
      ? `Raiders will enter from the ${knownApproach}. Plant the flag where your defenders should gather.`
      : definition.detail;
    return Object.freeze({
      ...definition,
      detail,
      status: index < currentIndex ? 'completed' : index === currentIndex ? 'current' : 'future',
      satisfied: progress.current >= progress.target,
      progress,
    });
  });
  return Object.freeze({
    id: FIRST_MUSTER_CHAPTER_ID,
    statePath: FIRST_MUSTER_STATE_PATH,
    currentIndex,
    complete,
    primary: complete ? null : steps[currentIndex],
    steps: Object.freeze(steps),
  });
}

export function updateFirstMusterChapter(state = G) {
  if (state.scenario !== 'military_rise') return getFirstMusterReport(state);
  state.storyFlags = state.storyFlags || {};
  const before = chapterStep(state);
  state.storyFlags.firstMusterStep = before;
  if (before < FIRST_MUSTER_STEPS.length) {
    const [current, target] = STEP_PROGRESS[before](state);
    // Advance at most one step per core chapter cadence. Even when a player
    // prepared ahead, every objective remains the sole primary step for one
    // cadence instead of the chapter collapsing through several at once.
    if (current >= target) {
      // The Founder discovery is actionable military intelligence. Sample the
      // first warband's edge once, then reuse it for warnings and spawning.
      if (before === 4 && state === G && state._raidSide == null) {
        state._raidSide = rngInt(0, RAID_DIRECTIONS.length - 1);
      }
      if (before === 4 && validRaidSide(state._raidSide)) {
        state.storyFlags.firstRaidApproach = state._raidSide;
      }
      state.storyFlags.firstMusterStep = before + 1;
      if (state === G) {
        emit('first-muster-advanced', {
          completed: FIRST_MUSTER_STEPS[before],
          next: FIRST_MUSTER_STEPS[before + 1] || null,
          currentIndex: before + 1,
          total: FIRST_MUSTER_STEPS.length,
          approach: before === 4 ? RAID_DIRECTIONS[state._raidSide] : null,
        });
      }
    }
  }
  return getFirstMusterReport(state);
}

function validRaidSide(value) {
  return Number.isSafeInteger(value) && value >= 0 && value < RAID_DIRECTIONS.length;
}

export function isFirstMusterComplete(state = G) {
  return chapterStep(state) >= FIRST_MUSTER_STEPS.length;
}

// Rise of the Sword promises that the Founder locates the warband and the
// player plants a rally flag before the first battle begins. Step 6 is the
// latched survive-raid objective, reached only after rally placement.
export function isFirstMusterRaidReady(state = G) {
  return state.scenario !== 'military_rise' || chapterStep(state) >= 6;
}

// Adapter for the existing scenario panel. It intentionally returns only the
// current primary objective; the full completed/future ledger stays queryable
// through getFirstMusterReport().
export function getFirstMusterScenarioObjectives(state = G) {
  const report = getFirstMusterReport(state);
  if (report.complete) {
    return [Object.freeze({
      id: 'first_muster_complete',
      text: 'First Muster complete',
      check: () => isFirstMusterComplete(state),
      progress: () => [1, 1],
    })];
  }
  const primary = report.primary;
  return [Object.freeze({
    id: primary.id,
    text: primary.text,
    detail: primary.detail,
    focus: primary.focus,
    action: primary.action || null,
    check: () => false,
    progress: () => [primary.progress.current, primary.progress.target],
  })];
}
