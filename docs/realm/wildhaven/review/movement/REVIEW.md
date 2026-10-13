# Company movement — October 12, 2026

Branch: `codex/observed-world`. Asset release: `20261012-company-motion-1`.

## Changes

Military movement previously eased toward a new authoritative position every 250 ms. Each update caused a burst of speed followed by deceleration. It now interpolates between the last two completed simulation positions. This adds at most one simulation step of presentation delay (250 ms at 1×, about 83 ms at 3×), without changing travel speed, pathfinding cadence, combat, healing or the calendar. It does not extrapolate or round corners across blocked tiles.

Motion history lives in a WeakMap, outside saves and unit data. New units, restored saves, explicit relocations and barracks deployments reset that history. Pausing holds the current rendered position and stride. Walking is distance-driven; legs settle when a resident waits in a crowd or a soldier stops. Turns use the short arc and time-based damping. Soldiers have different starting stride phases.

The browser comparison also exposed a medic waiting north of a wall while its company stood south of it. The old follow rule chose the nearest free cell behind the leader, even when a wall separated that cell from the company. Medics now choose a reachable nearby spot with sight of the leader and keep their own valid waiting place. Ordinary paths, gate restrictions, hostile-unit avoidance, finite dressings and treatment rules still apply.

## Evidence

- `node --test docs/realm/wildhaven/test/*.test.mjs`: **434 passed**, no failures. Output: [game-tests.txt](game-tests.txt).
- After the final initial-pose adjustment, **40 focused tests passed**; output: [focused-tests.txt](focused-tests.txt).
- Focused coverage includes steady interpolation at multiple frame rates and both speeds; wall/corner constraints; pause/resume; save restoration, garrison exit and relocation; deterministic simulation; and a medic crossing the gate, settling, then treating an injury.
- Background Codex browser MCP, isolated localhost origins 4785/4786. No desktop/Screen Sharing control and no real saves or accounts. The fixture uses the actual island, authored models, `VillageWorld`, and frontier orders. Its resources/buildings are explicitly funded test setup, not an earned campaign.
- At 1×, recorded the same gate march using the previous renderer and the new renderer. At 3×, checked the final medic fix, formation arrival, pause/resume, and return of all four units inside barracks. Inspected rendered frame sequences as well as the on-screen unit readout.
- Started a fresh town through the normal game UI with the versioned asset map; no browser errors or warnings.

Recordings:

- [Previous rendering, 1×](before-1x.webm)
- [Interpolated rendering, 1×](after-1x.webm) — captured before the additional medic-follow fix; the medic remains across the wall in this recording.
- [Final rendering and medic follow, 3×](after-3x.webm)
- [Final company arrival](company-arrival.png)

Run a static server from `docs/realm`, then open `/wildhaven/review/movement/`. The fixture never reads or writes game saves. Its controls issue real move, hold and retreat orders, and its recording button captures the game canvas.

## Scope

This is desktop/background-browser evidence, not a physical iPad or simulator acceptance test. Issue #183 stays open for device acceptance and the network scout/observed-town animation pass. Those views still receive sparse observations and need their own path-aware presentation; no unverified network interpolation was added here. This branch has not been merged or deployed to Pages. No backend changes were necessary for this pass.
