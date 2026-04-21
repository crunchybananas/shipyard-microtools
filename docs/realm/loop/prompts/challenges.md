# challenges

Each iteration **must** engage with exactly one challenge.

- **accept**: do what it asks.
- **mutate**: do something meaningfully adjacent; explain the drift
  in one line.
- **reject**: don't do it this iteration; say why in one line. A
  rejection does not consume the challenge — a future Claude may
  still take it.

Record your choice as a `**Challenge:**` line at the top of your
journal entry. `grep '^\*\*Challenge:\*\*' journal/*.md` shows
prior takes. Repeats are allowed if the previous take was narrow —
say so and explain the new angle.

Each challenge is tagged:

- **`[play]`** — chrome-mcp play required. Actually load the game
  and interact as the persona. Take a screenshot. Cite specific
  moments.
- **`[code]`** — code change required. One focused commit.
- **`[review]`** — written finding only. No code. The journal
  entry IS the deliverable.

Challenges are deliberately constraining. Their job is to pull you
off the obvious path — to make you play *as someone else*, or
build *against* your instinct.

## the pool

### personas (play)

Each persona is a lens. You play realm for 3–10 minutes *as that
person*, then journal what they saw.

- **`the-gamer`** `[play]` — experienced strategy-game player. Play
  aggressively: stress the economy, pick fights, try to break
  things. What's the *weakest* moment in the first 10 minutes?
- **`the-novice`** `[play]` — pretend you've never played a
  city-builder. What's confusing in the first 90 seconds? Where
  do you stall? Which tooltip saved you?
- **`the-speedrunner`** `[play]` — try to complete the first
  mission as fast as possible. Note every piece of friction,
  every click that felt wasted, every moment the game made you
  wait.
- **`the-idle-player`** `[play]` — set speed to 4×, tab away
  mentally, come back every 60 seconds. Is there anything to
  come back to? Does the game reward patience or punish it?
- **`the-kid`** `[play]` — play like a 7-year-old: click
  everywhere, ignore the UI, chase whatever's moving. What's fun?
  What's boring? What did you click that did nothing?
- **`the-completionist`** `[play]` — try to build one of every
  building, trigger every chronicle entry, unlock every mission.
  Where does the game thin out? What felt like filler?
- **`the-screenshot-critic`** `[play]` — play to 5 different game
  states (dawn, midday, dusk, night, winter). Take a screenshot
  of each. Pick the *weakest* frame and say exactly why.
- **`the-photographer`** `[play]` — play hunting for a beautiful
  frame. What do you have to do to get it? What's ugly on the
  way there?
- **`the-30-seconds`** `[play]` — play for exactly 30 seconds,
  then stop. What happened? What did you learn? What hooked you
  or didn't?
- **`the-accessibility-reviewer`** `[play]` — try to play
  without using the mouse. Fail gracefully if impossible; report
  every missing keyboard path.
- **`the-mobile-reviewer`** `[play]` — resize Chrome to ~390×844
  (iPhone portrait). Try to play. Report what breaks.
- **`the-lore-hunter`** `[play]` — read every tooltip, chronicle
  entry, and tutorial tip you can surface. Which buildings tell
  no story? Which events are narratively flat?
- **`the-pessimist`** `[play]` — play assuming every system is
  hiding a bug. Actively try to find one. Report reproduction
  steps if you do; report that you failed if you didn't.

### code

- **`refactor-only`** `[code]` — ship no new feature. Improve the
  shape of existing code. Document *why* the shape matters in the
  journal. No user-visible change.
- **`cut-as-you-add`** `[code]` — for every new line of code you
  add, remove one existing line that's redundant or stale. Net
  LoC change must be ≤ 0.
- **`silent-module`** `[code]` — plumbing that pays rent later.
  Add machinery (a helper, a data file, a hook point) that a
  future iteration will invoke. No user-visible behavior this
  tick.
- **`constant-shift`** `[code]` — change one magic number or
  balance constant that's been the same forever. Play-test the
  change (min 2 min). Document the consequence.
- **`the-fixer`** `[code]` — pick the oldest un-done item in
  `prompts/ideas.md` tagged `[code]`, or any unresolved bug in a
  recent journal entry. Fix it and verify in Chrome. Mark the
  idea `DONE → NNN` in-place.
- **`the-name-giver`** `[code]` — rename something confusingly
  named. Grep-replace across `docs/realm/`. Justify the new name
  in the journal.
- **`the-dead-code-detective`** `[code]` — find and remove unused
  code. Prove unused via grep. Minimum 20 LoC removed or it's a
  reject.
- **`the-profiler`** `[code]` — measure something real (frame
  time, entity count, tick cost). Expose it on `window.G.debug`
  or the console. Report the numbers.

### graphics (first-class axis; see MANIFEST)

- **`the-art-director`** `[review]` — take 3 screenshots across
  different conditions (dawn/midday/night, different building
  mixes). Critique composition, silhouette readability, figure-
  ground separation, hierarchy. Name the one frame that's
  closest to *cover-art quality* and the one that isn't.
- **`the-color-eye`** `[review]` — open the game, sample the
  palette across 3 frames. Flag any pair of colors that clash or
  blur together (e.g., building roof vs grass at dusk). Cite
  file:line if you can find where the color is defined.
- **`the-pixel-critic`** `[play]` — zoom into one building at a
  time (min 5 buildings). Report sprite alignment issues,
  jaggies, half-pixel offsets, baseline drift between neighbors.
  Screenshot each offender.
- **`the-silhouette-test`** `[play]` — imagine the game rendered
  as pure black silhouettes. Which buildings are still
  recognizable? Which blur together? Suggest one silhouette
  tweak.

### review (no code, no play — pure critique)

- **`the-skeptic`** `[review]` — read the last 10 entries in
  `archive/LOOPS.md` (or the most recent journal entries, once
  enough exist). Which feature is dead weight? Flag it; propose
  a case for removal. Don't remove it.
- **`the-minimalist`** `[review]` — if you could remove *one*
  thing from realm to make it better, what and why? Argue it.
- **`the-contrarian`** `[review]` — whatever the most recent
  journal entry strongly recommended, argue against it. Be
  specific about what could go wrong.
- **`the-archivist`** `[review]` — audit `ideas.md` for stale
  items. Mark ideas done (with journal pointer) or drop ones
  that no longer fit. Report net change.
- **`the-future-you`** `[review]` — write a letter to iteration
  100 from iteration <current>. What do you hope is true by
  then? What do you fear?

### surprise

- **`unnamed-thing`** — introduce a concept without naming it.
  See if a later iteration names it. Works as `[code]` or
  `[play]`.
- **`a-scene-that-happens-once`** `[code]` — add behavior that
  fires at most once in the game's life per save, then never
  again. (There may be existing precedent in `enhancements.js` —
  check first.)
- **`time-aware`** `[code]` — something in realm that behaves
  differently depending on the real-world clock. E.g., a special
  greeting if loaded at midnight local time. Flag any ambient
  input in the journal.
- **`the-dream`** `[code]` — add a deterministic piece of content
  generated from a seed (today's date + save id). Same seed →
  same content. No persisted state.

## picking well

Good picks:

- pull a persona that hasn't been played recently
- pull a code challenge that pairs with an idea sitting in
  `ideas.md` for more than 5 iterations
- pull `the-contrarian` if the last 2 entries agreed with each
  other

Bad picks:

- the same persona twice in a row
- `refactor-only` without a specific target in mind
- `the-fixer` when the Known Issues list is empty
