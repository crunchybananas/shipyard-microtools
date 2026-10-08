/** Calendar presentation is independent of the original 90-second economy cycle.
 * Keep that cycle and its saved deadlines intact: changing the sky must not
 * change production, meals, migration, trade, troop speed or attack intervals.
 */
export const WORK_CYCLE_SECONDS = 90;
export const CALENDAR_DAY_SECONDS = 360;
const SCALE = CALENDAR_DAY_SECONDS / WORK_CYCLE_SECONDS;
export const workPosition = state => Math.max(0, (state.day - 1) + ((state.time || 0) + (state.subsecond || 0)) / WORK_CYCLE_SECONDS);
function calendarPosition(state, cycle) {
  const position = cycle === undefined ? workPosition(state) : Math.max(0, cycle - 1);
  const epoch = state.calendarEpoch ?? 0;
  // Dates before an existing village's upgrade retain their original numbering.
  return position <= epoch ? position : epoch + (position - epoch) / SCALE;
}
export const calendarDay = (state, cycle) => 1 + Math.floor(calendarPosition(state, cycle) + 1e-9);
export function calendarFraction(state) {
  const position = calendarPosition(state);
  return Math.max(0, position - Math.floor(position + 1e-9));
}
export const perMinute = value => value * 60 / WORK_CYCLE_SECONDS;
export const perMinuteGoods = bag => Object.fromEntries(Object.entries(bag || {}).map(([key, value]) => [key, perMinute(value)]));
export const secondsUntil = (state, cycle) => Math.max(0, (cycle - 1 - workPosition(state)) * WORK_CYCLE_SECONDS);
export function duration(seconds) {
  const total = Math.max(0, Math.ceil(seconds - 1e-6)), minutes = Math.floor(total / 60), rest = total % 60;
  return minutes ? `${minutes}m${rest ? ` ${rest}s` : ''}` : `${rest}s`;
}
export const until = (state, cycle) => duration(secondsUntil(state, cycle));
export const cycleDuration = cycles => duration(cycles * WORK_CYCLE_SECONDS);
