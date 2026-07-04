# Sprite repaint queue — batch-consistency offenders

Measured 2026-07-03 by `scripts/audit-sprite-registration.mjs` + the size
audit (content height / pixel area vs each role's WALK rows, the canonical
art). Runtime normalization (`js/actor-registration.js`, applied in
`drawActorAtlasFrame`) hides the feet-pop and blends the bulk gap, but the
work/carry batches for the roles below are visibly a DIFFERENT CHARACTER
(bulk, hat size, palette) than their walk/idle batches. The real fix is a
repaint matching the walk-era character sheet per role.

Rules for the repaint (per owner direction + sprite-source contract):
- Match the role's WALK rows: same character, same palette, same body mass
  (target pixel area within ±20% of walk median; feet baseline 79).
- Keep intentional effects (soil scatter on farmer work strikes is ART).
- After any repaint: `node scripts/audit-sprite-registration.mjs --write`
  to regenerate runtime registration, then run the audit suite.

Queue, worst first (area delta vs own walk rows):

| role | rows | area vs walk | notes |
|---|---|---|---|
| builder | work ×4 | +35…+82% | bulkiest break in the cast |
| blacksmith | work ×4 | +39…+72% | |
| miner | work ×4 | +17…+72% | also 12-16% frame wobble in loop |
| guard | work ×4 | +29…+58% | 16% frame wobble on side rows |
| farmer | work ×4, carry ×4 | +27…+54% | the owner-reported example |
| guard | carry/down, idle/down | +27% | spot-check whole sheet while in there |
| lumber | work/down | −13%, 11% wobble | opposite direction: thinner than walk |

Everything not listed measured within tolerance (walk/idle rows across the
cast are consistent at baseline 79 — use them as the reference art).
