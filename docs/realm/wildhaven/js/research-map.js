import { RESEARCH } from './progression.js';

/** A presentation-only DAG. Columns are prerequisite depth, not the catalog tier. */
export function researchGraph(state = {}, { selectedId = null } = {}) {
  const ids = Object.keys(RESEARCH), completed = new Set(state.research?.completed || []), depths = new Map();
  const depth = id => {
    if (!depths.has(id)) depths.set(id, RESEARCH[id].prerequisites.length ? 1 + Math.max(...RESEARCH[id].prerequisites.map(depth)) : 0);
    return depths.get(id);
  };
  const columns = Array.from({ length: Math.max(...ids.map(depth)) + 1 }, () => []);
  for (const id of ids) columns[depth(id)].push(id);
  selectedId = ids.includes(selectedId) ? selectedId : null;
  const ancestors = new Set(), next = new Set();
  function visit(id) { for (const prerequisite of RESEARCH[id].prerequisites) if (!ancestors.has(prerequisite)) { ancestors.add(prerequisite); visit(prerequisite); } }
  if (selectedId) { visit(selectedId); for (const id of ids) if (RESEARCH[id].prerequisites.includes(selectedId)) next.add(id); }
  const width = 166, height = 82, gapX = 44, gapY = 18, inset = 16, top = 40;
  const nodes = ids.map(id => {
    const spec = RESEARCH[id], column = depth(id), row = columns[column].indexOf(id);
    const status = completed.has(id) ? 'learned' : state.research?.active?.id === id ? 'studying' : spec.prerequisites.every(p => completed.has(p)) ? 'ready' : 'locked';
    return { id, name: spec.name, column, row, x: inset + column * (width + gapX), y: top + row * (height + gapY), width, height, status,
      selected: id === selectedId, ancestor: ancestors.has(id), next: next.has(id) };
  });
  const edges = ids.flatMap(to => RESEARCH[to].prerequisites.map(from => ({ from, to,
    highlighted: !!selectedId && ((ancestors.has(to) || to === selectedId) && ancestors.has(from) || from === selectedId && next.has(to)),
  })));
  const bottom = top + Math.max(...columns.map(c => c.length)) * (height + gapY) - gapY;
  const byId = Object.fromEntries(nodes.map(node => [node.id, node]));
  let longLinks = 0;
  for (const edge of edges) {
    const from = byId[edge.from], to = byId[edge.to];
    const x = from.x + from.width, end = to.x - 4, y = from.y + from.height / 2, endY = to.y + to.height / 2;
    if (to.column === from.column + 1) {
      const middle = (x + end) / 2;
      edge.points = [[x, y], [middle, y], [middle, endY], [end, endY]];
    } else {
      // Longer dependencies travel below the cards, never through unrelated discoveries.
      const lane = bottom + 14 + longLinks++ * 12;
      edge.points = [[x, y], [x + 12, y], [x + 12, lane], [end - 12, lane], [end - 12, endY], [end, endY]];
    }
  }
  return { nodes, edges, columns, selectedId, width: inset * 2 + columns.length * (width + gapX) - gapX, height: bottom + inset + longLinks * 12 };
}

let mapNumber = 0;
const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
const svgEl = (tag, attributes) => { const node = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value)); return node; };
const STATUS = { learned: '✓ Learned', studying: '◷ Studying', ready: 'Prerequisites met', locked: 'Earlier research needed' };

export function createResearchMap({ state, selectedId = null, onSelect }) {
  const graph = researchGraph(state, { selectedId }), section = el('section', 'research-map');
  section.setAttribute('aria-label', 'Research map');
  const header = el('div', 'research-map-heading'); header.append(el('h3', '', 'See where a discovery leads'), el('p', '', 'Tap a discovery for its costs and unlocks. All incoming lines are required.'));
  section.append(header);
  const legend = el('div', 'research-map-legend');
  for (const key of Object.keys(STATUS)) legend.append(el('span', `map-status-${key}`, STATUS[key]));
  section.append(legend);
  const viewport = el('div', 'research-map-viewport'); viewport.dataset.scrollRegion = 'research-map'; viewport.dataset.actionId = 'research-map-viewport'; viewport.tabIndex = 0;
  viewport.setAttribute('role', 'region'); viewport.setAttribute('aria-label', 'Research dependencies. Scroll to explore the map.');
  const canvas = el('div', 'research-map-canvas'); canvas.style.width = `${graph.width}px`; canvas.style.height = `${graph.height}px`;
  const svg = svgEl('svg', { width: graph.width, height: graph.height, viewBox: `0 0 ${graph.width} ${graph.height}`, 'aria-hidden': 'true', focusable: 'false' });
  const defs = svgEl('defs', {}), markerId = `research-map-arrow-${++mapNumber}`;
  const marker = svgEl('marker', { id: markerId, markerWidth: 7, markerHeight: 7, refX: 6, refY: 3.5, orient: 'auto', markerUnits: 'userSpaceOnUse' });
  marker.append(svgEl('path', { d: 'M0 0 L7 3.5 L0 7 Z', fill: '#708265' })); defs.append(marker); svg.append(defs);
  for (const edge of graph.edges) {
    const path = svgEl('path', { d: edge.points.map(([x, y], index) => `${index ? 'L' : 'M'}${x} ${y}`).join(' '), fill: 'none', stroke: edge.highlighted ? '#94692e' : '#87977a', 'stroke-width': edge.highlighted ? 3 : 1.8, 'stroke-linejoin': 'round', 'marker-end': `url(#${markerId})`, 'data-from': edge.from, 'data-to': edge.to, class: edge.highlighted ? 'research-link highlighted' : 'research-link' });
    svg.append(path);
  }
  canvas.append(svg);
  graph.columns.forEach((_, column) => {
    const label = el('span', 'research-map-column', ['First discoveries', 'Connected crafts', 'Town ambitions', 'Farther horizons'][column] || 'Further discoveries');
    label.style.left = `${16 + column * 210}px`; canvas.append(label);
  });
  for (const node of graph.nodes) {
    const button = el('button', `research-node map-status-${node.status}${node.selected ? ' selected' : ''}${node.ancestor ? ' ancestor' : ''}${node.next ? ' next' : ''}`);
    button.type = 'button'; button.dataset.researchNode = node.id; button.dataset.actionId = `map-node-${node.id}`;
    Object.assign(button.style, { left: `${node.x}px`, top: `${node.y}px`, width: `${node.width}px`, height: `${node.height}px` });
    button.setAttribute('aria-label', `View ${node.name}. ${STATUS[node.status]}.`); button.setAttribute('aria-pressed', String(node.selected));
    button.append(el('strong', '', node.name), el('small', '', STATUS[node.status]));
    if (node.ancestor || node.next) button.append(el('span', 'research-node-relation', node.ancestor ? 'Required before this choice' : 'Leads on from this choice'));
    button.onclick = () => onSelect?.(node.id); canvas.append(button);
  }
  viewport.append(canvas); section.append(viewport);
  const note = el('p', 'research-map-note', 'Pay the quoted cost to begin one project at a time. Supplied scholars advance it.'); section.append(note);
  return section;
}
