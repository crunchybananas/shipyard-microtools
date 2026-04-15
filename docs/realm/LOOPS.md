# Realm — Autonomous Improvement Loops (3-agent pattern)

## Pattern per loop
1. **Validator** — sees current state (screenshot + brief), reports weaknesses, no prescriptions
2. **Divergent thinker** — sees current state + "things tried" list, proposes 3 BOLD ideas (not incremental polish)
3. **Implementer** — tight spec from main agent, just executes

## Things tried (avoid re-proposing)
- WebGL 3D prototype (worked for terrain, not buildings)
- WebGL post-processing (shipped: bloom, color grading, AO, film grain)
- Mountain scaling + 4 tree variants (shipped)
- Cinematic lighting (god rays, cloud shadows, directional building shadows)
- Fireflies + dust motes + pollen particles
- Hero castle with stone texture, pennants, arch
- Transparency fix (buildings now fully opaque, multiply-blend night overlay)
- Ground details (boulders, clover, mushrooms, tree stumps, lily pads)
- Seasonal weather (rain, snow particles)
- Citizen directional facing (eyes, mouth, hair)

## Rules
- Divergent thinker gets sparse context (NOT the full project history). Just: screenshots + "things tried" + "propose 3 non-incremental ideas"
- Validator gets ONLY the new screenshot. No context about what was attempted.
- Main agent picks one idea per loop, commits, updates log.
- If divergent thinker proposes something already tried, reject and re-ask.

## Loop log
(Each loop appends here with: validator findings | ideas proposed | chosen | commit hash)
