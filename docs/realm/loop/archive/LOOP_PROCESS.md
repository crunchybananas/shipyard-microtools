# Realm — Self-Improving Game Loop

## Philosophy
The main agent is the **orchestrator** — it has Chrome access (ground truth) and makes decisions. Sub-agents are **specialists** with intentionally limited context so they bring fresh perspective rather than confirming existing biases.

## The Loop (one iteration)

### Step 1: Observe (main agent, Chrome)
- Reload the game in Chrome
- Play for a bit: build something, advance time, click around
- Take 2-3 screenshots (different game states: early game, mid-game, different times of day)
- Note any bugs, visual glitches, or UX friction encountered during play

### Step 2: Validate (sub-agent, fresh eyes)
- Spawn a validator agent with ONLY: screenshot(s) + one-line game description
- NO code context, NO history of what was tried
- Ask: "What are the 3 weakest things in this screenshot? Be brutally honest."
- Validator returns pure visual/UX critique

### Step 3: Ideate (sub-agent, fresh perspective)  
- Spawn a divergent thinker with: screenshot(s) + validator's critique + "things tried" list
- Ask: "Propose 3 bold improvements that address the validator's top complaint. Not incremental polish — meaningful changes."
- Reject anything already in "things tried"

### Step 4: Decide (main agent)
- Pick one idea that best addresses the validator's #1 complaint
- Write a tight implementation spec (which files, what to change, constraints)

### Step 5: Implement (sub-agent)
- Spawn implementer with: the spec + relevant file contents
- One focused task, one commit
- Must pass `node --check` before committing

### Step 6: Verify (main agent, Chrome)
- Reload game in Chrome
- Test the specific change
- If broken: spawn a fix agent with the screenshot + error description
- If working: log the loop, update "things tried"

### Step 7: Log
- Append to LOOPS.md with: loop number, validator findings, chosen idea, result, commit hash
- Update "things tried" list

## Rules
- Validator NEVER sees code or history — only screenshots
- Divergent thinker NEVER sees full codebase — only screenshots + critique + things-tried
- Implementer gets tight scope — specific files, specific changes
- Main agent ALWAYS verifies in Chrome before moving on
- One feature per loop, one commit per loop
- If Chrome shows a regression, fix it before starting next loop

## Priority Stack (what to focus on, in order)
1. Bugs visible in Chrome (broken rendering, JS errors, interaction failures)
2. UX friction (confusing flows, missing feedback, dead clicks)  
3. Gameplay depth (progression feel, balance, meaningful choices)
4. Story/narrative (events that make the world feel alive)
5. Audio (ambient layers, SFX, music)
6. Visual polish (only after everything above is solid)

## Resuming
Any new conversation can pick this up by:
1. Reading this file + LOOPS.md (for history)
2. Opening Chrome to the game
3. Starting at Step 1
