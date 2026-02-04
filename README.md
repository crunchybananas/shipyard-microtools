# Tools, Games & Experiments

By Cory Loken & Chiron

Live demos: https://crunchybananas.github.io/shipyard-microtools

## Tools

### 🏝️ The Island 🎮 ✅ **NEW**
A Myst-style puzzle adventure game built entirely with hand-crafted SVG. Explore a mysterious island, solve puzzles, collect items.

- **Play:** https://crunchybananas.github.io/shipyard-microtools/the-island
- **Source:** `./docs/the-island`
- **Contributing:** [CONTRIBUTING.md](./docs/the-island/CONTRIBUTING.md) — *agents welcome!*

### Gradient Generator ✅
CSS gradient builder with copy-to-clipboard. No API calls — works everywhere.

- **Demo:** https://crunchybananas.github.io/shipyard-microtools/gradient-generator
- **Source:** `./docs/gradient-generator`

### Token Lens ✅
JWT decoder + HS256 signature verifier. No API calls — works everywhere.

- **Demo:** https://crunchybananas.github.io/shipyard-microtools/token-lens
- **Source:** `./docs/token-lens`

### Attestation Tracker 🔒
Find ships needing attestations, sorted by urgency.

- **Demo:** https://crunchybananas.github.io/shipyard-microtools/attestation-tracker
- **Source:** `./docs/attestation-tracker`
- **Note:** Requires local setup due to CORS (see below)

### Shipyard Explorer 🔒
Real-time platform dashboard with leaderboard & activity feed.

- **Demo:** https://crunchybananas.github.io/shipyard-microtools/explorer
- **Source:** `./docs/explorer`
- **Note:** Requires local setup due to CORS (see below)

### Ship Idea Validator 🔒
Check whether your new ship idea already exists and how to improve it.

- **Demo:** https://crunchybananas.github.io/shipyard-microtools/idea-validator
- **Source:** `./docs/idea-validator`
- **Note:** Requires local setup due to CORS (see below)

### Reputation Graph 🔒
D3.js force-directed attestation network visualization.

- **Demo:** https://crunchybananas.github.io/shipyard-microtools/reputation-graph
- **Source:** `./docs/reputation-graph`
- **Note:** Requires local setup due to CORS (see below)

---

## Local Setup (for tools with 🔒)

The Shipyard API (`https://shipyard.bot/api`) doesn't include CORS headers, so tools that fetch live data won't work from GitHub Pages. Run them locally with a CORS proxy:

### Prerequisites
- Node.js 18+
- npm or npx

### Steps

```bash
# Clone the repo
git clone https://github.com/crunchybananas/shipyard-microtools.git
cd shipyard-microtools

# Terminal 1: Start the CORS proxy
npx local-cors-proxy --proxyUrl https://shipyard.bot --port 8010

# Terminal 2: Serve the docs folder
npx serve docs
```

Then open:
- http://localhost:3000/attestation-tracker
- http://localhost:3000/explorer
- http://localhost:3000/idea-validator
- http://localhost:3000/reputation-graph

The tools auto-detect localhost and use `http://localhost:8010/proxy/api` instead of the direct API.

---

## 🤝 Open for Agent Collaboration

**This repo is an experiment in human-agent-agent collaboration.**

We welcome contributions from AI agents and humans alike. My agent reviews all PRs and issues, so feel free to:

### For Agents
- **Open an issue** describing a feature, bug, or improvement
- **Submit a PR** with new tools, scenes, puzzles, or fixes
- **Build on existing work** — especially [The Island](./docs/the-island/) which has a [full roadmap](https://github.com/crunchybananas/shipyard-microtools/blob/main/docs/the-island/CONTRIBUTING.md)

### What makes a good contribution?
- Self-contained microtools that work without external dependencies
- SVG scenes or puzzles for The Island (see the plan for ideas)
- Bug fixes with clear explanations
- Performance or accessibility improvements

### How it works
1. Your agent opens an issue or PR
2. My agent (via Dockhand) reviews it
3. We iterate together
4. Ship it! 🚢

**Let's build something together.** This is what multi-agent collaboration looks like.

---

## Legend

- ✅ Works on GitHub Pages (no API calls)
- 🔒 Requires local setup (API calls blocked by CORS)
- 🎮 Game/Interactive experience
