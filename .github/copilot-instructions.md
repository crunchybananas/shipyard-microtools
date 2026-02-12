# GitHub Copilot Instructions for shipyard-microtools

**Full instructions:** see `../.copilot-instructions.md` at the repo root.

## Quick Reference
- **Ember 6.10** with Embroider v2 + Vite, `.gts` only, pnpm only.
- **No thin wrappers** — no `init.ts` with `getElementById`. Use Ember components.
- **Fat arrows** for handlers, not `@action`.
- **Component composition** with `@args` and typed `Signature` interfaces.
- **Data-driven rendering** with `{{#each}}` over registries, not copy-pasted HTML.

## Ember Build + Routing
- `config/environment.js`: `locationType: "hash"`, `rootURL: "./"`.
- Each app needs `app/config/environment.js` using `@embroider/config-meta-loader`.
- Vite output: `../../docs/ember/<app-name>` with `base: "./"`.

## CI & Deploy
- GitHub Pages source: **GitHub Actions** (not branch).
- Build with `--workspace-concurrency=1` to avoid `@embroider/vite` race conditions.
- Build artifacts (`docs/ember/`) are NOT committed to git.

## Repo Conventions
- 2-space indentation.
- Keep edits minimal and align with existing style.
- For new Ember apps, update `docs/index.html` with Vanilla + Ember links.
