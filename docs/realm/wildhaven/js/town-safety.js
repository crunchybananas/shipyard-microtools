import { frontierOptions } from './frontier.js';
import { pressureOptions } from './pressure.js';
import { duration, until } from './calendar.js';

/** Read-only status spanning the independent coastal and frontier systems. */
export function townSafety(state) {
  const frontier = frontierOptions(state), coast = pressureOptions(state).active;
  const descriptions = [];
  if (frontier.raidActive) descriptions.push('A raid is underway. Open Frontier to see the attackers.');
  else if (frontier.activeBattles) descriptions.push(`${frontier.activeBattles} hostile troops are on the island. Open Frontier to inspect them.`);
  if (frontier.warning) descriptions.push(`${frontier.warning.amount} raiders arrive in ${duration(frontier.warning.attackAt - frontier.clock)} at 1×. Open Frontier.`);
  if (coast) descriptions.push(`${coast.title}: arrival in ${until(state, coast.deadline)} at 1×. Open Town → Watch.`);
  const active = frontier.raidActive || frontier.activeBattles > 0;
  return {
    level: active ? 'active' : descriptions.length ? 'approaching' : 'calm',
    label: frontier.raidActive ? 'Raid underway' : frontier.activeBattles ? 'Hostile troops on the island' : frontier.warning ? `Raid in ${duration(frontier.warning.attackAt - frontier.clock)}` : coast ? `Sails in ${until(state, coast.deadline)}` : 'Island calm',
    secondary: [active && frontier.warning ? `Raid in ${duration(frontier.warning.attackAt - frontier.clock)}` : '', coast && (active || frontier.warning) ? `Sails in ${until(state, coast.deadline)}` : ''].filter(Boolean).join(' · '),
    destination: active || frontier.warning ? 'frontier' : 'watch',
    description: descriptions.join(' ') || 'No active coastal warning, arriving raid, or hostile troops on the island.',
  };
}
