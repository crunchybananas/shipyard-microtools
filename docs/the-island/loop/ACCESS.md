# ABYME — accessibility notes (#143, AAA-C5)

## The Instruments (settings tab)

- **reading pace** — ×1 / ×1.5 / ×2 on every whisper's hold time. The journal keeps
  everything permanently regardless; pace only changes how long the moment lingers.
- **letter size** — three steps scaling the whisper, the reading surface, and the
  journal entries (`--text-scale`; layout is relative, nothing clips).
- **calm the flashes** — bloom strength capped (0.68 → 0.42) and the white curtain
  transition floor-limited to 1.4s even on its fast path (dive splash, terminals).
- **reduce motion** — pre-existing: honors OS `prefers-reduced-motion` by default,
  in-game toggle overrides (head-bob + intro sway/bank damping).
- **driftwood mode** — pre-existing power/comfort cut: no bloom pass, capped DPR.

All device preferences persist locally (`abyme-settings`), never in the save.

## Photosensitivity audit (the bright moments)

| Moment | Behavior | Verdict |
|---|---|---|
| dive splash (white curtain) | single fade, ≥0.45s; ≥1.4s under calm-flash | no strobe; calm option |
| terminal fades | single long fades | fine |
| the beam / farewell sweep | slow rotation, no flicker; farewell ENDS in dark | fine |
| capitals breach | 9s ease, water rush; no luminance snap | fine |
| lamp glint (hover) | size-aware cap (glint-from-dark tuning, #44) | fine |
| bloom generally | threshold 1.05 (nothing sunlit torches); 0.42 strength under calm-flash | fine |

**No strobing or repeated-flash effects exist anywhere.** The worst case is a single
white fade at dive time, and calm-flash slows it further.

## Colorblind pass (every glint/glyph read)

- **Hotspot glints** — luminance-based (white-ish emissive), never hue-coded ✓.
- **Hatch glyphs / beam code** — SHAPE-coded symbols read by form, luminance-lit ✓.
- **Era grades (#136)** — dark values deliberately spread (0.93/0.80/0.66) so the
  eras separate in pure grayscale luminance ✓.
- **Lamp/brass reads** — brightness + geometry redundancy, no red/green channel
  dependence anywhere in a puzzle-critical read ✓.

## The no-timer guarantee

Nothing in ABYME is timed against the player. Encounters resolve by REGARD and
STILLNESS (holding attention, not reflexes); the tide rises only when a dive is
chosen; every readable waits forever; the era-threshold line and vistas hold, they
never race. The only clocks are the sun's (scrubbable) and the tableaux's
(non-interactive, ≤20s, skippable). This is a standing design rule, not a current
coincidence: anything timed-against-the-player needs a canon argument first.
