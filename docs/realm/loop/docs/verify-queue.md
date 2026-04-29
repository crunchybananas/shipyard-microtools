# verify-queue.md

**Status:** Created tick 215. Maintained by subsequent loops.

This doc lists every chrome-unverified ship since chrome went
offline (~tick 180). When chrome returns, this is the work-list
for the verify-batch.

## why this exists

Per 213 the-skeptic finding 3: untested infrastructure
compounding. By tick 215 the loop has shipped ~14 chrome-
unverified code paths plus ~22 visual artifacts. Without
explicit tracking, the verify-batch grows silently and becomes
intractable.

Per the visual-verification feedback memory: every tick MUST
attempt `tabs_context_mcp`. If chrome is offline, that tick's
visual-touching work is queued here.

## how to update

When a tick ships chrome-untested work, append an entry below
in the appropriate section. Format:

```
- [TICK]: <one-line summary> — <test instruction>
```

When chrome returns, work the list. Mark each entry done with
**VERIFIED → TICK** when confirmed in chrome.

## logic correctness queue (math/state-checkable in chrome console)

These are verifiable without rendering — open chrome console,
run the test, check the result.

- [192]: G.realmEnded after-callback — fire realm_fell beat
  (`G.population = 0; G.day = 5; checkStoryBeats()`); verify
  `G.realmEnded === true`.
- [197]: save persistence 2-path defensive load — set
  `G.realmEnded = true`, save, reload, verify
  `G.realmEnded === true`. Also test legacy: clear
  `state.realmEnded` from save JSON, set `state.storyFlags.realm_fell = true`,
  reload, verify derive path works.
- [201]: bard +5 happiness baseline — build church (triggers
  ensureBard); read happiness pre/post; verify +5 in mid-range.
- [206]: rival +10% raid count — build barracks (triggers
  ensureRival); trigger raid in deep-game state (day 50+,
  baseCount 12); verify raider count +1-2.
- [209]: rival +5 gold per raider slain — let raiders die with
  rival named; verify gold delta = +5 per kill.
- [211]: G.lastRaidDay tracker — trigger raid; verify
  `G.lastRaidDay === G.day`. Verify save+load preserves the
  field.
- [211]: sustained_peace_known beat — set `G.lastRaidDay`
  60 days in past + raidsSurvived ≥ 1; advance to dawn;
  verify chronicle entry.
- [212]: first_sigh_seen beat — fresh realm; advance to summer
  day 12; verify chronicle entry (misc tag).
- [214]: founder-conditional offering item — fresh realm with
  named founders + stone + happyPeak + day 30+; force offering
  fire; verify ~14% of kingdoms get the founder1 carved-wood
  variant.

## visual verification queue (chrome render-checkable)

These need actual rendering — chrome tab open, frame
inspection, screenshot capture.

### SVG sprites (11 shipped 161-182)

All 11 sprites need verification at 4 zoom levels in
`docs/realm/svg-test/index.html` sandbox:

- [161] granary
- [162] castle
- [164] church
- [167] windmill
- [170] tower
- [173] house
- [175] tavern
- [176] blacksmith
- [179] market
- [180] bakery
- [182] barracks

Plus: multi-instance paint cost stress test; photo-mode
5× zoom crispness check (per 187 visual-debt log).

### 3D meshes (11 shipped 163-187)

**RETIRED at tick 215** — see render-layers.md "Loop 215
update — 3D axis explicitly RETIRED for the loop." 11
meshes live in `docs/realm/3d/3d.js` as standalone-prototype
reference; not integrated into live game; not part of any
verify-batch unless integration plan revives them.

### Visual-shipping narrative beats

Beats themselves are prose; they don't render visually but
their FIRING needs chrome verification (does the chronicle
panel show them? does the toast appear?):

- [196] first_long_evening (year-1 summer day ≤14)
- [199] first_cold_morning (autumn day 15+, same-day pair
  with constellation_named)
- [207] fields_know_realm (year-1 summer day 10+)
- [211] sustained_peace_known (year-2+ peaceful realm)
- [212] first_sigh_seen (year-1 summer day 12+)
- [214] founder-conditional offering item (~14% of realms)

### Phase B integration (BLOCKED on chrome)

When chrome returns, Phase B is the FIRST priority before
any further graphics work:

- [171 plan / pending] Phase B step 1: scaffolding
  (`_USE_SVG_SPRITES` flag + sprite-loader)
- [171 plan / pending] Phase B step 2: day/night tint
  composition
- [171 plan / pending] Phase B step 3: winter-cap composition
- [171 plan / pending] Phase B step 4: hover halo + fog
- [171 plan / pending] Phase B step 5: per-instance variation
- [171 plan / pending] Phase B step 6: live-game enable

Phase B unblocks the SVG sprite work shipped 161-182. Without
it, the sprites never reach the player.

## when chrome returns

Suggested sequence (high → low priority):

1. **Verify Phase B is unblocked** — sanity-check the existing
   game still runs. Check console for errors.
2. **Work the logic-correctness queue** — chrome console tests.
   ~9 items at tick 215. Estimated 1-2 ticks.
3. **Ship Phase B step 1 (scaffolding)** — unblock the SVG
   integration sprint. Then proceed through steps 2-6 over
   3-5 ticks per 171 plan.
4. **After Phase B integration ships**, work the visual-
   shipping narrative-beat queue and SVG sprite multi-zoom
   audit.
5. **Re-evaluate 3D** — only after Phase B ships and stabilizes.
   May stay retired indefinitely.

## related loop references

- 213 the-skeptic: filed verify-queue creation per HIGH
  finding 3 (untested-infrastructure compounding).
- 215 the-meta (this doc): created verify-queue.md;
  retired 3D axis explicitly.
- 171 strategic plan: original 3-phase SVG plan; Phase A
  complete, Phase B blocked.
- 187: visual-debt log first established.
- feedback memory `feedback_realm_loop_visual_verification.md`:
  per-tick chrome-attempt discipline; this doc supports it.
