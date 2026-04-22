// ════════════════════════════════════════════════════════════
// Trade — Named foreign partners and resource exchange
// ════════════════════════════════════════════════════════════

import { G } from './state.js';

export const TRADE_PARTNERS = [
  { id: 'albion',   name: '🏰 Albion',   import: 'wood',  export: 'gold', rate: 2   },  // 1 wood → 2 gold
  { id: 'orisk',    name: '⚔️ Orisk',    import: 'food',  export: 'iron', rate: 0.3 },  // 1 food → 0.3 iron
  { id: 'thalos',   name: '🏛️ Thalos',  import: 'stone', export: 'gold', rate: 1.5 },
  { id: 'meridian', name: '🐟 Meridian', import: 'gold',  export: 'food', rate: 3   },
];

export function executeTrade(partnerId, resourceKey, amount) {
  const p = TRADE_PARTNERS.find(x => x.id === partnerId);
  if (!p) return false;
  if (resourceKey !== p.import) return false;
  if ((G.resources[resourceKey] || 0) < amount) return false;
  G.resources[resourceKey] -= amount;
  // Loop 102 (the-fixer, 101 sibling): named merchant gives +5% trade
  // return. Mirrors 101's teacher research-bonus pattern. Graduates
  // 034's merchant intro from decoration to mechanic. No UI indicator —
  // player will notice larger haul across many trades if they track it.
  const merchantMult = G.namedCharacters?.merchant ? 1.05 : 1;
  const received = Math.round(amount * p.rate * merchantMult);
  G.resources[p.export] = (G.resources[p.export] || 0) + received;
  return { given: amount, received, export: p.export };
}
