# GitHub Copilot Instructions for shipyard-microtools

## Agent Skills (modern patterns)
- Reference: https://github.com/NullVoxPopuli/agent-skills
- Prefer modern Ember + Embroider patterns over classic Ember CLI.
- Default to TypeScript + Glimmer components (`.gts`) and colocated styles.
- Use services for app/game state; keep rendering logic inside components.
- Avoid legacy patterns (classic components, computed properties, `EmberObject.extend`).

## Ember Build + Routing
- Ember version: 6.10 (Embroider + Vite).
- `config/environment.js` should use:
  - `locationType: "hash"`
  - `rootURL: "./"`
- Each app must include `app/config/environment.js` using `@embroider/config-meta-loader`.
- Vite build output: `../../docs/ember/<app-name>` and `base: "./"`.

## Repo Conventions
- 2-space indentation.
- Keep edits minimal and align with existing style.
- For new Ember apps, update `docs/index.html` with Vanilla + Ember links.
