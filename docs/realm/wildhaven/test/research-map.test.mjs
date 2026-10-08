import test from 'node:test';
import assert from 'node:assert/strict';
import { RESEARCH } from '../js/progression.js';
import { researchGraph } from '../js/research-map.js';

const edgeKey = edge => `${edge.from}->${edge.to}`;
const sorted = values => [...values].sort();
const indexed = graph => Object.fromEntries(graph.nodes.map(node => [node.id, node]));

test('research map includes every named discovery and exactly its real prerequisite links', () => {
  const graph = researchGraph({});
  assert.deepEqual(sorted(graph.nodes.map(node => node.id)), sorted(Object.keys(RESEARCH)));
  for (const node of graph.nodes) assert.equal(node.name, RESEARCH[node.id].name);
  const expectedEdges = Object.entries(RESEARCH).flatMap(([id, spec]) =>
    spec.prerequisites.map(required => `${required}->${id}`));
  assert.deepEqual(sorted(graph.edges.map(edgeKey)), sorted(expectedEdges));
  assert.equal(graph.selectedId, null);
  assert.ok(graph.nodes.every(node => !node.selected && !node.ancestor && !node.next));
  assert.ok(graph.edges.every(edge => !edge.highlighted));
});

test('research columns follow prerequisite depth, including navigation after other tier-three research', () => {
  const graph = researchGraph({}), nodes = indexed(graph);
  const expectedColumns = [
    ['cultivation', 'joinery', 'barter', 'civic_order'],
    ['milling', 'textiles', 'metallurgy', 'logistics', 'watchkeeping'],
    ['brewing', 'public_health', 'coastal_routes', 'mastercraft', 'town_charter'],
    ['navigation'],
  ];
  for (const [column, ids] of expectedColumns.entries()) {
    for (const id of ids) assert.equal(nodes[id].column, column, id);
  }
  assert.deepEqual(graph.columns.map(sorted), expectedColumns.map(sorted));
  assert.equal(RESEARCH.coastal_routes.tier, RESEARCH.navigation.tier);
  assert.ok(nodes.navigation.column > nodes.coastal_routes.column);
});

test('research nodes fit the canvas without collisions and every prerequisite link travels right', () => {
  const graph = researchGraph({}), nodes = indexed(graph);
  assert.ok(Number.isFinite(graph.width) && graph.width > 0);
  assert.ok(Number.isFinite(graph.height) && graph.height > 0);
  for (const node of graph.nodes) {
    for (const field of ['x', 'y', 'width', 'height']) assert.ok(Number.isFinite(node[field]), `${node.id}.${field}`);
    assert.ok(Number.isInteger(node.row) && node.row >= 0, `${node.id} row`);
    assert.ok(node.width > 0 && node.height > 0, `${node.id} dimensions`);
    assert.ok(node.x >= 0 && node.y >= 0, `${node.id} origin`);
    assert.ok(node.x + node.width <= graph.width && node.y + node.height <= graph.height, `${node.id} bounds`);
  }
  for (let i = 0; i < graph.nodes.length; i++) {
    for (const b of graph.nodes.slice(i + 1)) {
      const a = graph.nodes[i];
      assert.ok(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y,
        `${a.id} overlaps ${b.id}`);
    }
  }
  for (const edge of graph.edges) {
    assert.ok(nodes[edge.from].column < nodes[edge.to].column, edgeKey(edge));
    assert.ok(nodes[edge.from].x + nodes[edge.from].width <= nodes[edge.to].x, edgeKey(edge));
  }
});

test('research status distinguishes learned, studying, prerequisite-ready and locked regardless of cost', () => {
  const empty = researchGraph();
  assert.deepEqual(empty, researchGraph({}));
  for (const node of empty.nodes) {
    assert.equal(node.status, RESEARCH[node.id].prerequisites.length ? 'locked' : 'ready', node.id);
  }
  const state = {
    research: { completed: ['cultivation', 'joinery'], active: { id: 'milling', progress: 12 } },
    resources: { knowledge: 0, gold: 0, tools: 0 },
  };
  const nodes = indexed(researchGraph(state));
  assert.equal(nodes.cultivation.status, 'learned');
  assert.equal(nodes.joinery.status, 'learned');
  assert.equal(nodes.milling.status, 'studying');
  assert.equal(nodes.textiles.status, 'ready');
  assert.equal(nodes.metallurgy.status, 'ready');
  assert.equal(nodes.barter.status, 'ready');
  assert.equal(nodes.logistics.status, 'locked');
  const funded = researchGraph({ ...state, resources: { knowledge: 1000, gold: 1000, tools: 1000 } });
  assert.deepEqual(funded.nodes.map(node => [node.id, node.status]), Object.values(nodes).map(node => [node.id, node.status]));
});

test('dependency lines remain inside the map and never cross an unrelated discovery card', () => {
  const graph = researchGraph();
  for (const edge of graph.edges) {
    for (const [x, y] of edge.points) assert.ok(x >= 0 && y >= 0 && x <= graph.width && y <= graph.height, edgeKey(edge));
    for (let segment = 1; segment < edge.points.length; segment++) {
      const [x1, y1] = edge.points[segment - 1], [x2, y2] = edge.points[segment];
      assert.ok(x1 === x2 || y1 === y2, 'Routes use straight gutters');
      for (const node of graph.nodes.filter(node => ![edge.from, edge.to].includes(node.id))) {
        const crosses = x1 === x2
          ? x1 > node.x && x1 < node.x + node.width && Math.max(y1, y2) > node.y && Math.min(y1, y2) < node.y + node.height
          : y1 > node.y && y1 < node.y + node.height && Math.max(x1, x2) > node.x && Math.min(x1, x2) < node.x + node.width;
        assert.equal(crosses, false, `${edgeKey(edge)} crosses ${node.id}`);
      }
    }
  }
});

test('selection marks transitive ancestors and direct next discoveries without unrelated branches', () => {
  const graph = researchGraph({}, { selectedId: 'coastal_routes' });
  assert.equal(graph.selectedId, 'coastal_routes');
  assert.deepEqual(graph.nodes.filter(node => node.selected).map(node => node.id), ['coastal_routes']);
  assert.deepEqual(sorted(graph.nodes.filter(node => node.ancestor).map(node => node.id)), ['barter', 'joinery', 'logistics']);
  assert.deepEqual(graph.nodes.filter(node => node.next).map(node => node.id), ['navigation']);
  assert.deepEqual(sorted(graph.edges.filter(edge => edge.highlighted).map(edgeKey)), sorted([
    'barter->logistics', 'joinery->logistics', 'logistics->coastal_routes', 'coastal_routes->navigation',
  ]));
  const logistics = researchGraph({}, { selectedId: 'logistics' });
  assert.deepEqual(sorted(logistics.nodes.filter(node => node.next).map(node => node.id)),
    ['coastal_routes', 'public_health', 'town_charter']);
  assert.equal(indexed(logistics).navigation.next, false);
});

test('building and selecting a research map preserves frozen town state and the research catalog', () => {
  const freeze = value => {
    if (value && typeof value === 'object') {
      for (const child of Object.values(value)) freeze(child);
      Object.freeze(value);
    }
    return value;
  };
  const state = freeze({
    research: { completed: ['joinery', 'barter'], active: { id: 'logistics', progress: 15, duration: 120 } },
    resources: { knowledge: 3, gold: 9, tools: 2 },
  });
  const before = JSON.stringify(state), catalogBefore = JSON.stringify(RESEARCH);
  researchGraph(state);
  researchGraph(state, { selectedId: 'navigation' });
  assert.equal(JSON.stringify(state), before);
  assert.equal(JSON.stringify(RESEARCH), catalogBefore);
  assert.deepEqual(researchGraph(state), researchGraph(state));
});

test('a remembered bread goal marks only its actual research route without filtering other discoveries', () => {
  const graph = researchGraph({ guidance: { goal: 'first_bread' }, research: { completed: [] } });
  assert.deepEqual(graph.nodes.filter(node => node.route).map(node => node.id).sort(), ['cultivation', 'joinery', 'milling']);
  assert.equal(graph.nodes.length, Object.keys(RESEARCH).length);
  assert.equal(researchGraph({ guidance: { goal: null } }).nodes.some(node => node.route), false);
});
