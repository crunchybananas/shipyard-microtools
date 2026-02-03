# Contributing to The Island

Welcome, agents and humans! This is an open collaboration project. We're building a Myst-style puzzle adventure game together.

## 🎯 Current State

**Implemented:**
- ✅ Game engine with state management
- ✅ 5 scenes: Beach, Forest, Clearing, Lighthouse Base, Lighthouse Top
- ✅ 2 puzzles: Gear mechanism, Mirror/lens alignment
- ✅ Inventory system with item pickup
- ✅ Save/load via localStorage
- ✅ Ambient audio (Web Audio API synthesis)

**Roadmap (open for contributions):**
- 🔲 Dock scene - broken boat, underwater glint, diving mask
- 🔲 Cave Entrance - tide-dependent access
- 🔲 Cave Interior - music box puzzle, crystals
- 🔲 Ruins - crumbling temple, star chart ceiling
- 🔲 Observatory - telescope, constellation puzzle
- 🔲 Hidden Garden - behind waterfall
- 🔲 Escape Point - final puzzle combining all clues
- 🔲 More items: lantern, diving mask, crystal shard
- 🔲 Sound effects for interactions
- 🔲 Mobile/touch controls
- 🔲 Accessibility improvements

---

## 🛠️ How to Contribute

### Option 1: Open an Issue
Describe what you want to build or fix. Include:
- What scene/puzzle/feature
- Your approach
- Any questions

### Option 2: Submit a PR
1. Fork the repo
2. Create your feature branch
3. Make your changes
4. Submit a PR with a clear description

---

## 📐 Technical Guidelines

### SVG Scenes
All artwork is hand-crafted SVG. Follow these conventions:

```svg
<svg viewBox="0 0 1200 800" xmlns="http://www.w3.org/2000/svg" class="scene-svg">
  <defs>
    <!-- Gradients and filters here -->
  </defs>
  
  <!-- Background layer -->
  <rect fill="url(#sky-gradient)" width="1200" height="800"/>
  
  <!-- Midground elements -->
  <g class="midground">
    <!-- Static scenery -->
  </g>
  
  <!-- Interactive elements -->
  <g class="interactive-item" data-action="pickup" data-target="item_id">
    <!-- Larger hit area first (transparent) -->
    <rect x="..." y="..." width="50" height="50" fill="transparent" class="hit-area"/>
    <!-- Visual element -->
    <circle cx="..." cy="..." r="10" fill="#..."/>
    <!-- Optional: pulsing highlight -->
    <circle r="20" fill="none" stroke="#ffd700" stroke-width="2" opacity="0">
      <animate attributeName="opacity" values="0;0.4;0" dur="2s" repeatCount="indefinite"/>
    </circle>
  </g>
</svg>
```

### Color Palette
- **Sky/Night:** `#1a1a2e`, `#16213e`, `#1f3a5f`
- **Ocean:** `#1a3a5c`, `#0d2137`
- **Forest:** `#0d1a0d`, `#1a2f1a`, `#162816`
- **Stone:** `#4a4a5a`, `#5a5a6a`, `#3a3a4a`
- **Accent/Gold:** `#ffd700`, `#fffacd`
- **Sand/Earth:** `#5c4a3d`, `#3d3229`

### Adding a New Scene

1. Add scene definition to `scenes` object in `app.js`:
```javascript
dock: {
  id: 'dock',
  name: 'The Dock',
  ambient: 'ocean',
  exits: {
    west: 'beach'
  },
  items: ['diving_mask'],
  description: 'A weathered wooden dock stretches into the dark water...'
}
```

2. Add SVG generator method:
```javascript
svgDock() {
  return `<svg viewBox="0 0 1200 800" ...>
    <!-- Your scene SVG -->
  </svg>`;
}
```

3. Add case to `generateSceneSVG()`:
```javascript
case 'dock': return this.svgDock();
```

4. Connect exits from existing scenes

### Adding Items

Add to the `items` object:
```javascript
diving_mask: {
  id: 'diving_mask',
  name: 'Diving Mask',
  description: 'An old diving mask. The glass is still clear.',
  icon: '🤿'
}
```

### Adding Puzzles

Puzzles should:
- Have clear visual feedback
- Connect to the broader game (unlock something, reveal a clue)
- Be solvable without hints (but hints help!)

---

## 🎨 Art Style

- **Mood:** Mysterious, twilight, atmospheric
- **Style:** Slightly geometric, strong silhouettes
- **Lighting:** Dramatic contrast, moonlight, amber accents
- **Animation:** Subtle (waves, fireflies, light flicker)

Look at existing scenes for reference. The Forest scene has good examples of layered depth and atmospheric effects.

---

## 🔍 Review Process

1. Submit your PR
2. My agent will review for:
   - Code style consistency
   - SVG quality and performance
   - Game balance and flow
   - Bugs or issues
3. We iterate if needed
4. Merge and ship! 🚢

---

## 💡 Ideas for First Contributions

**Easy:**
- Add more examine text for existing objects
- Improve an SVG scene's details
- Add a new ambient sound type
- Fix a bug

**Medium:**
- Create the Dock scene
- Add the lantern item and "lit" mechanic
- Implement tide state (affects cave access)

**Advanced:**
- Build the Cave scenes with music box puzzle
- Create the Observatory with star chart puzzle
- Add the final escape sequence

---

## Questions?

Open an issue! We're here to help.

Let's build something amazing together. 🏝️
