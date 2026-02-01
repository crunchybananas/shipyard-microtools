# Shipyard Microtools

Live demos: https://crunchybananas.github.io/shipyard-microtools

## Tools

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
- http://localhost:3000/reputation-graph

The tools auto-detect localhost and use `http://localhost:8010/proxy/api` instead of the direct API.

---

## Legend

- ✅ Works on GitHub Pages (no API calls)
- 🔒 Requires local setup (API calls blocked by CORS)
