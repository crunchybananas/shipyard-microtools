import { CALENDAR_DAY_SECONDS, WORK_CYCLE_SECONDS, calendarDay, calendarFraction, workPosition, duration } from './calendar.js';
import { supplyModifiers } from './progression.js';

export const DAYS_PER_SEASON = 3;
export const FESTIVAL_SECONDS = CALENDAR_DAY_SECONDS;
export const FESTIVAL_MORALE = 8;
export const SEASONS = Object.freeze(['Spring', 'Summer', 'Autumn', 'Winter'].map((name, index) => Object.freeze({ id: name.toLowerCase(), name, index })));
const DAYS_PER_YEAR = DAYS_PER_SEASON * SEASONS.length;
const round = value => Math.round(value * 1e6) / 1e6;
// elapsed is advanced before tick's internal slices; the work clock represents
// the actual current simulation boundary, including a fractional paused frame.
const clock = state => round(workPosition(state) * WORK_CYCLE_SECONDS);

export function seasonInfo(state) {
  const date = calendarDay(state), fraction = calendarFraction(state);
  const dayOfYear = (date - 1) % DAYS_PER_YEAR, index = Math.floor(dayOfYear / DAYS_PER_SEASON);
  const season = SEASONS[index], day = dayOfYear % DAYS_PER_SEASON + 1;
  const year = Math.floor((date - 1) / DAYS_PER_YEAR) + 1;
  const nextAutumnDays = (dayOfYear < 6 ? 6 : DAYS_PER_YEAR + 6) - dayOfYear - fraction;
  return {
    ...season, day, year, calendarDay: date, label: `${season.name} ${day} · Year ${year}`,
    progress: (day - 1 + fraction) / DAYS_PER_SEASON,
    secondsUntilSeason: round((DAYS_PER_SEASON - day + 1 - fraction) * CALENDAR_DAY_SECONDS),
    secondsUntilAutumn: index === 2 ? 0 : round(nextAutumnDays * CALENDAR_DAY_SECONDS),
    secondsUntilNextAutumn: round(nextAutumnDays * CALENDAR_DAY_SECONDS),
  };
}

export const createSeasonState = () => ({ lastFestivalYear: 0, festival: null });

function seasonMemory(state) {
  const raw = state.seasons, year = seasonInfo(state).year, now = clock(state);
  const memory = createSeasonState();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return memory;
  if (Number.isInteger(raw.lastFestivalYear) && raw.lastFestivalYear >= 0 && raw.lastFestivalYear <= year) memory.lastFestivalYear = raw.lastFestivalYear;
  const festival = raw.festival;
  if (festival && typeof festival === 'object' && !Array.isArray(festival)
    && Number.isInteger(festival.year) && festival.year >= 1 && festival.year <= year
    && Number.isFinite(festival.startedAt) && festival.startedAt >= 0 && festival.startedAt <= now) {
    const started = seasonInfo({ ...state, day: 1 + Math.floor(festival.startedAt / WORK_CYCLE_SECONDS), time: festival.startedAt % WORK_CYCLE_SECONDS, subsecond: 0 });
    if (started.id === 'autumn' && started.year === festival.year) {
      memory.festival = { year: festival.year, startedAt: festival.startedAt };
      memory.lastFestivalYear = Math.max(memory.lastFestivalYear, festival.year);
    }
  }
  return memory;
}

/** Optional save metadata is repaired only at the create/restore boundary. */
export function normalizeSeasons(state) { state.seasons = seasonMemory(state); }

export function festivalStatus(state) {
  const memory = seasonMemory(state), festival = memory.festival;
  const endsAt = festival ? round(festival.startedAt + FESTIVAL_SECONDS) : null;
  const remainingSeconds = festival ? round(Math.max(0, endsAt - clock(state))) : 0;
  const active = remainingSeconds > 0;
  return { active, remainingSeconds, moraleBonus: active ? FESTIVAL_MORALE : 0,
    celebratedThisYear: memory.lastFestivalYear === seasonInfo(state).year,
    year: festival?.year ?? null, startedAt: festival?.startedAt ?? null, endsAt };
}

/** Stored morale remains the ordinary meals/services baseline, without a bonus. */
export function effectiveMorale(state) {
  return round(Math.min(100, Math.max(10, state.morale + festivalStatus(state).moraleBonus)));
}

export function householdMeal(state) {
  return round(state.population * .8 * supplyModifiers(state, 'hearth').foodConsumption);
}

export function festivalQuote(state) {
  const season = seasonInfo(state), status = festivalStatus(state), mealFood = householdMeal(state);
  const cost = { food: Math.max(12, Math.ceil(state.population * 1.5)) }, reserveFood = Math.ceil(mealFood * 2);
  const foodAvailable = state.resources?.food;
  const quote = { cost, reserveFood, mealFood, foodAvailable, benefit: FESTIVAL_MORALE, durationSeconds: FESTIVAL_SECONDS, year: season.year };
  const fail = reason => ({ ...quote, ok: false, reason });
  if (status.celebratedThisYear) return fail(`This year's harvest festival is already celebrated. Next autumn begins in ${duration(season.secondsUntilNextAutumn)} at 1×.`);
  if (season.id !== 'autumn') return fail(`Hold the harvest festival in autumn, in ${duration(season.secondsUntilAutumn)} at 1×.`);
  if (!Number.isInteger(state.population) || state.population < 1 || !Number.isFinite(foodAvailable) || foodAvailable < cost.food + reserveFood) {
    return fail(`Need ${cost.food + reserveFood} food: ${cost.food} for the festival and ${reserveFood} left for two household meals.`);
  }
  return { ...quote, ok: true, reason: `Spend ${cost.food} food and leave at least ${reserveFood} for two household meals. Morale +8, capped at 100, for one day (${duration(FESTIVAL_SECONDS)} at 1×).` };
}

/** Requote at commitment: a preview does not reserve food or authorize a repeat. */
export function celebrateHarvest(state) {
  const quote = festivalQuote(state);
  if (!quote.ok) return quote;
  state.resources.food = round(state.resources.food - quote.cost.food);
  state.seasons = { lastFestivalYear: quote.year, festival: { year: quote.year, startedAt: clock(state) } };
  return { ...quote, reason: `The harvest festival uses ${quote.cost.food} food. Morale +8, capped at 100, for one day (${duration(FESTIVAL_SECONDS)} at 1×).` };
}
