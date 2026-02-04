# FlowForge Ember Conversion Plan

## Overview
Convert the vanilla JavaScript FlowForge visual node editor to a modern Ember 6.10 app with TypeScript, GTS components, and Embroider/Vite.

---

## 🎯 Current Progress (Updated: Feb 3, 2026)

### ✅ COMPLETED

#### Phase 1: Core Data Models & Services
- [x] `app/types/node-types.ts` - All 15 node types with execute functions, port/field definitions
- [x] `app/types/flow.ts` - FlowNode, Connection, NodeTypeRef interfaces  
- [x] `app/services/flow-engine.ts` - Topological sort, async execution, createNode with defaults

#### Phase 2: Application Shell & Components
- [x] `app/components/flow-forge-editor.gts` - Main editor with state management
- [x] `app/components/flow-forge/toolbar.gts` - Header with Run/Clear/Examples buttons
- [x] `app/components/flow-forge/sidebar.gts` - Node palette (draggable) + properties panel
- [x] `app/components/flow-forge/node-canvas.gts` - Canvas with nodes, ports, connections
- [x] `app/components/flow-forge/preview-panel.gts` - Output display panel

#### Phase 3: Core Functionality
- [x] Drag nodes from palette to canvas
- [x] Node rendering with icons, titles, colored headers by category
- [x] Node dragging/repositioning on canvas
- [x] Node selection and properties panel
- [x] Example flows loading (json-transform, filter-adults, math-calc, http-fetch)
- [x] Flow execution with topological sort
- [x] Execution status indicators (success/error/running)
- [x] Display output in preview panel

### 🔧 IN PROGRESS

#### Connection System (Phase 4)
- [x] Connection path rendering (bezier curves)
- [x] Port elements with data attributes
- [x] Pending connection state tracking
- [x] **FIX**: Port mousedown → drag → mouseup to create connections
- [x] **FIX**: Connection paths not aligning to actual port positions
- [x] Delete connections (click to select, then delete)

### ❌ NOT STARTED

#### Phase 5: Polish & Advanced Features
- [x] Canvas pan & zoom
- [ ] Minimap
- [x] localStorage persistence (save/load flows)
- [x] Inline field editing on nodes
- [ ] Step-through execution
- [ ] Undo/redo (stretch goal)

---

## 🐛 Known Issues to Fix

### 1. Connection Dragging (RESOLVED)
**Fix**: Pointer events + window tracking for drag lifecycle.

### 2. Connection Paths Misaligned (RESOLVED)  
**Fix**: DOM-based port position lookup via `getBoundingClientRect()`.

### 3. Style Binding Warning (FIXED)
**Problem**: "Binding style attributes may introduce XSS vulnerabilities"
**Solution**: Use `htmlSafe()` from `@ember/template` for dynamic style attributes. ✅

---

## 📁 Current File Structure

```
apps/flowforge/
├── app/
│   ├── components/
│   │   ├── flow-forge-editor.gts      # Main editor (state, handlers)
│   │   └── flow-forge/
│   │       ├── node-canvas.gts        # Canvas, nodes, connections
│   │       ├── sidebar.gts            # Palette + properties
│   │       ├── toolbar.gts            # Header buttons
│   │       └── preview-panel.gts      # Output display
│   ├── services/
│   │   └── flow-engine.ts             # Execution engine
│   ├── types/
│   │   ├── flow.ts                    # FlowNode, Connection types
│   │   └── node-types.ts              # Node definitions
│   └── styles/
│       └── app.css                    # Global styles (CSS vars)
├── CONVERSION-PLAN.md                 # This file

shipyard-microtools/
└── .copilot-instructions.md           # Ember/GTS best practices for all Ember apps
```

---

## 🔑 Key Implementation Details

### Arrow Functions (tio-front-end convention)
All component methods use arrow functions instead of `@action` decorators:
```typescript
// ✅ Correct
handleClick = (event: MouseEvent) => {
  this.doSomething();
};

// ❌ Wrong
@action
handleClick(event: MouseEvent) {
  this.doSomething();
}
```

### Multi-arg Event Handlers
For handlers needing multiple arguments, use custom `fn` helpers:
```typescript
// In component class
function fn5<T1, T2, T3, T4, E extends Event>(
  handler: (a1: T1, a2: T2, a3: T3, a4: T4, event: E) => void,
  a1: T1, a2: T2, a3: T3, a4: T4
): (event: E) => void {
  return (event: E) => handler(a1, a2, a3, a4, event);
}

// In template
{{on "mousedown" (fn5 this.handlePortMouseDown node.id port.name true index)}}
```

### htmlSafe for Dynamic Styles
```typescript
import { htmlSafe } from "@ember/template";

getNodeStyle = (node: FlowNode) => {
  return htmlSafe(`left: ${node.x}px; top: ${node.y}px`);
};
```

### Connection Path Calculation
```typescript
createBezierPath = (x1: number, y1: number, x2: number, y2: number) => {
  const dx = Math.abs(x2 - x1);
  const controlOffset = Math.min(dx * 0.5, 100);
  return `M ${x1} ${y1} C ${x1 + controlOffset} ${y1}, ${x2 - controlOffset} ${y2}, ${x2} ${y2}`;
};
```

---

## 📋 Next Steps (Priority Order)

1. **Debug connection dragging** - Add console logs to verify `handlePortMouseDown` is called
2. **Fix port position calculation** - Match CSS layout or use DOM queries
3. **Test connection creation end-to-end** - Port click → drag → release on target port
4. **Add connection deletion** - Click connection to select, keyboard delete
5. **Inline field editing** - Edit node fields directly on the node (not just in properties panel)

---

## ✅ Continuation Plan (Detailed)

### Phase 4.1: Port Dragging (Connection Creation)
- [x] Track `pointerdown` → `pointermove` → `pointerup` across the window
- [x] Switch to Pointer Events for drag (unify mouse + trackpad)
- [x] Validate `pendingConnection` state shape and cleanup on cancel
- [x] Implement connection creation on valid target port (input only)
- [x] Reject invalid connections (same node, input→input, output→output)

### Phase 4.2: Port Position Accuracy
- [x] Add DOM lookup in `getPortPosition` (query by `data-node-id`, `data-port`)
- [x] Use `getBoundingClientRect()` relative to canvas
- [ ] Cache port DOM positions and update on drag/scroll/resize
- [ ] Align CSS constants (`headerHeight`, port spacing) with actual styles

### Phase 4.3: Interaction Cleanup
- [x] Connection hover styling (thicker stroke)
- [x] Connection selection state (store `selectedConnectionId`)
- [x] Delete selected connection on Backspace/Delete
- [x] ESC cancels pending connection drag

### Phase 5: Canvas Polish
- [x] Pan (spacebar + drag or middle mouse)
- [x] Zoom (trackpad pinch or ctrl+scroll)
- [ ] Minimap (optional, start with read-only view)

### Phase 6: Persistence & Editing
- [x] Save flow to `localStorage` on change
- [x] Load on startup with fallback to example
- [x] Inline field editing (node body inputs)
- [ ] Undo/redo (if time permits)

### Phase 7: QA & Parity
- [ ] Compare behavior with vanilla app for edge cases
- [ ] Stress test with 50+ nodes
- [ ] Validate keyboard focus + accessibility
 - [ ] Align preview panel messaging with vanilla (e.g., "Add an output node to see results")

---

## 🧭 Repo Hygiene
- [ ] Move `.copilot-instructions.md` to `shipyard-microtools/.copilot-instructions.md` so it applies to all Ember apps
- [ ] Keep app-specific overrides in `apps/flowforge/.copilot-instructions.md` only if needed

---

## 🏗️ Original Phase Plan (Reference)

### Phase 1: Core Data Models & Services ✅
### Phase 2: Application Shell ✅
### Phase 3: Canvas & Node Rendering ✅
### Phase 4: Drag, Drop & Connect 🔧 (80% complete)
### Phase 5: Flow Execution ✅
### Phase 6: Persistence & Examples (Examples ✅, Persistence ❌)

---

## 📚 Reference: Vanilla App

- `docs/flowforge/index.html` - HTML structure
- `docs/flowforge/styles.css` - All styles  
- `docs/flowforge/app.js` - All logic (1419 lines)

Key vanilla functions to reference:
- `startConnectionDrag()` - Line ~567
- `endConnectionDrag()` - Line ~613
- `getPortPosition()` - Line ~647
- `createBezierPath()` - Line ~662
- `updateConnections()` - Line ~667
