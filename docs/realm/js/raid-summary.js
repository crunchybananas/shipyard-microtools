// Deterministic raid narrative state. Raid tracking used to live in the
// browser-only enhancements module, so reloading mid-raid reset its counters
// and changed the chronicle. The core owns the counters; the bus-backed log
// functions keep presentation in the shell.

import { G } from './state.js?realm=181';
import { announce, chronicle } from './log.js?realm=181';

const RAID_PROSE = Object.freeze({
  razed: Object.freeze([
    day => `Raid on day ${day}: the village was razed. None remain to tell it.`,
    day => `Raid on day ${day}: the realm fell silent. The fires went out one by one.`,
    day => `Raid on day ${day}: the realm did not survive the night. There is no one left to bury the dead.`,
    day => `Raid on day ${day}: the raiders left only smoke and stone.`,
  ]),
  lossesOnly: Object.freeze([
    (day, _kills, losses) => `Raid on day ${day}: ${losses} fell, no foe answered. The survivors bury their own.`,
    (day, _kills, losses) => `Raid on day ${day}: ${losses} lost; no raider met their end. The realm grieves without retort.`,
    (day, _kills, losses) => `Raid on day ${day}: the raiders took ${losses} and left without a scratch. The graves are dug at dusk.`,
    (day, _kills, losses) => `Raid on day ${day}: ${losses} dead. The raiders escaped clean into the trees.`,
  ]),
  mixed: Object.freeze([
    (day, kills, losses) => `Raid on day ${day} turned back at a cost: ${losses} lost, ${kills} foes slain.`,
    (day, kills, losses) => `Raid on day ${day}: ${losses} fell, but ${kills} raiders did not return home.`,
    (day, kills, losses) => `Raid on day ${day}: bought back at the price of ${losses} — ${kills} raiders on the field.`,
    (day, kills, losses) => `Raid on day ${day}: ${losses} of ours, ${kills} of theirs. The cost was counted at dawn.`,
  ]),
  victory: Object.freeze([
    (day, kills) => `Raid on day ${day} repelled — ${kills} foes slain, none of ours lost.`,
    (day, kills) => `Raid on day ${day}: ${kills} raiders cut down at the gate. The village slept untroubled.`,
    (day, kills) => `Raid on day ${day}: the raiders broke at first light. ${kills} of them never made it home.`,
    (day, kills) => `Raid on day ${day}: ${kills} foes ran into the realm's sword and stayed. We took no losses.`,
  ]),
  bloodless: Object.freeze([
    day => `Raid on day ${day}: the raiders withdrew before either side struck a blow.`,
    day => `Raid on day ${day}: the raiders thought better of it and slipped back into the trees.`,
    day => `Raid on day ${day}: a raid that found nothing. The watch held its breath all night.`,
    day => `Raid on day ${day}: the raiders came and the raiders went. Not a blade was drawn.`,
  ]),
});

export function pickRaidProse(day, kills, losses, populationAlive) {
  let pool;
  if (populationAlive === 0) pool = RAID_PROSE.razed;
  else if (losses > 0 && kills === 0) pool = RAID_PROSE.lossesOnly;
  else if (losses > 0 && kills > 0) pool = RAID_PROSE.mixed;
  else if (kills > 0) pool = RAID_PROSE.victory;
  else pool = RAID_PROSE.bloodless;
  const index = ((day % pool.length) + pool.length) % pool.length;
  return pool[index](day, kills, losses);
}

export function updateRaidSummary() {
  if (!G.stats || !G.storyState) return;
  const active = G.storyState.raid;
  if (G.enemies.length > 0 && (!active || active.day !== G.day)) {
    G.storyState.raid = {
      day: G.day,
      killsStart: G.stats.enemiesKilled || 0,
      deathsStart: G.stats.citizensDied || 0,
    };
    return;
  }
  if (G.enemies.length > 0 || !active) return;

  if (active.day === G.day || active.day === G.day - 1) {
    const kills = (G.stats.enemiesKilled || 0) - active.killsStart;
    const losses = (G.stats.citizensDied || 0) - active.deathsStart;
    const populationAlive = G.citizens.length;
    const message = pickRaidProse(active.day, kills, losses, populationAlive);
    chronicle(message, 'raid');
    announce(message, populationAlive === 0 ? 'danger' : 'event', { chronicle: false });
  }
  G.storyState.raid = null;
}
