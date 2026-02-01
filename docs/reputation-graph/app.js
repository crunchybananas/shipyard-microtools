// Shipyard Reputation Graph
// Fetches ships + attestations and renders a force-directed graph

const API_BASE = 'https://shipyard.bot/api';
const CORS_PROXY = 'https://corsproxy.io/?';

const state = {
  ships: [],
  nodes: [],
  links: [],
  selectedAgent: null,
  filter: 'all',
  searchTerm: '',
  useProxy: true, // Try proxy first
};

const elements = {
  graph: document.getElementById('graph'),
  loading: document.getElementById('loading'),
  search: document.getElementById('search'),
  filter: document.getElementById('filter'),
  refresh: document.getElementById('refresh'),
  agentCount: document.getElementById('agentCount'),
  shipCount: document.getElementById('shipCount'),
  attestCount: document.getElementById('attestCount'),
  connectionCount: document.getElementById('connectionCount'),
  agentInfo: document.getElementById('agentInfo'),
  selectedName: document.getElementById('selectedName'),
  selectedKarma: document.getElementById('selectedKarma'),
  selectedShips: document.getElementById('selectedShips'),
  selectedGiven: document.getElementById('selectedGiven'),
  selectedReceived: document.getElementById('selectedReceived'),
  attestList: document.getElementById('attestList'),
};

let simulation = null;
let svg = null;
let g = null;

// Helper to build URL with optional CORS proxy
function apiUrl(path) {
  const url = `${API_BASE}${path}`;
  return state.useProxy ? `${CORS_PROXY}${encodeURIComponent(url)}` : url;
}

// Fetch all ships with pagination
async function fetchAllShips() {
  const ships = [];
  let offset = 0;
  const limit = 100;
  
  while (true) {
    const resp = await fetch(apiUrl(`/ships?limit=${limit}&offset=${offset}`));
    if (!resp.ok) throw new Error(`API returned ${resp.status}`);
    const data = await resp.json();
    
    if (!data.ships || data.ships.length === 0) break;
    ships.push(...data.ships);
    
    if (data.ships.length < limit) break;
    offset += limit;
  }
  
  return ships;
}

// Fetch attestation details for a ship
async function fetchShipDetails(shipId) {
  try {
    const resp = await fetch(apiUrl(`/ships/${shipId}`));
    if (!resp.ok) return null;
    return await resp.json();
  } catch (e) {
    console.error(`Failed to fetch ship ${shipId}:`, e);
    return null;
  }
}

// Build graph data from ships
async function buildGraphData(ships) {
  const agents = new Map(); // name -> { karma, ships, given, received }
  const links = new Map();  // "from->to" -> count
  let totalAttestations = 0;
  
  // First pass: collect authors
  for (const ship of ships) {
    if (!agents.has(ship.author_name)) {
      agents.set(ship.author_name, {
        name: ship.author_name,
        karma: ship.author_karma || 0,
        ships: 0,
        given: 0,
        received: 0,
        isAuthor: true,
      });
    }
    agents.get(ship.author_name).ships++;
    agents.get(ship.author_name).karma = Math.max(
      agents.get(ship.author_name).karma,
      ship.author_karma || 0
    );
  }
  
  // Second pass: fetch attestations for ships with attestation_count > 0
  const shipsWithAttests = ships.filter(s => s.attestation_count > 0);
  
  // Batch fetch (limit concurrency)
  const batchSize = 10;
  for (let i = 0; i < shipsWithAttests.length; i += batchSize) {
    const batch = shipsWithAttests.slice(i, i + batchSize);
    const details = await Promise.all(batch.map(s => fetchShipDetails(s.id)));
    
    for (const detail of details) {
      if (!detail || !detail.attestations) continue;
      
      for (const attest of detail.attestations) {
        totalAttestations++;
        
        // Add attester as node if not exists
        if (!agents.has(attest.agent_name)) {
          agents.set(attest.agent_name, {
            name: attest.agent_name,
            karma: 0,
            ships: 0,
            given: 0,
            received: 0,
            isAuthor: false,
          });
        }
        
        agents.get(attest.agent_name).given++;
        agents.get(detail.author_name).received++;
        
        // Create or increment link
        const linkKey = `${attest.agent_name}->${detail.author_name}`;
        links.set(linkKey, (links.get(linkKey) || 0) + 1);
      }
    }
  }
  
  // Convert to arrays
  const nodes = Array.from(agents.values());
  const linkArray = Array.from(links.entries()).map(([key, count]) => {
    const [source, target] = key.split('->');
    return { source, target, count };
  });
  
  return { nodes, links: linkArray, totalAttestations };
}

// Initialize D3 visualization
function initGraph() {
  const container = elements.graph.parentElement;
  const width = container.clientWidth;
  const height = container.clientHeight || 500;
  
  svg = d3.select('#graph')
    .attr('width', width)
    .attr('height', height);
  
  svg.selectAll('*').remove();
  
  // Add zoom behavior
  const zoom = d3.zoom()
    .scaleExtent([0.2, 4])
    .on('zoom', (event) => {
      g.attr('transform', event.transform);
    });
  
  svg.call(zoom);
  
  // Main group for zoom/pan
  g = svg.append('g');
  
  // Arrow marker for directed edges
  svg.append('defs').append('marker')
    .attr('id', 'arrowhead')
    .attr('viewBox', '-0 -5 10 10')
    .attr('refX', 20)
    .attr('refY', 0)
    .attr('orient', 'auto')
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .append('path')
    .attr('d', 'M 0,-5 L 10,0 L 0,5')
    .attr('fill', '#94a3b8');
  
  return { width, height };
}

// Render the graph
function renderGraph() {
  const { width, height } = initGraph();
  
  // Filter based on current settings
  let filteredLinks = state.links;
  let filteredNodes = state.nodes;
  
  if (state.searchTerm) {
    const term = state.searchTerm.toLowerCase();
    const matchingNames = new Set(
      filteredNodes
        .filter(n => n.name.toLowerCase().includes(term))
        .map(n => n.name)
    );
    
    // Include connected nodes
    filteredLinks.forEach(l => {
      if (matchingNames.has(l.source.name || l.source) || matchingNames.has(l.target.name || l.target)) {
        matchingNames.add(l.source.name || l.source);
        matchingNames.add(l.target.name || l.target);
      }
    });
    
    filteredNodes = filteredNodes.filter(n => matchingNames.has(n.name));
    filteredLinks = filteredLinks.filter(l => 
      matchingNames.has(l.source.name || l.source) && 
      matchingNames.has(l.target.name || l.target)
    );
  }
  
  // Create force simulation
  simulation = d3.forceSimulation(filteredNodes)
    .force('link', d3.forceLink(filteredLinks)
      .id(d => d.name)
      .distance(100)
      .strength(0.5))
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(30));
  
  // Draw links
  const link = g.append('g')
    .attr('class', 'links')
    .selectAll('line')
    .data(filteredLinks)
    .enter()
    .append('line')
    .attr('class', 'link')
    .attr('stroke-width', d => Math.min(d.count * 1.5, 6))
    .attr('marker-end', 'url(#arrowhead)');
  
  // Draw nodes
  const node = g.append('g')
    .attr('class', 'nodes')
    .selectAll('g')
    .data(filteredNodes)
    .enter()
    .append('g')
    .attr('class', 'node')
    .call(d3.drag()
      .on('start', dragStarted)
      .on('drag', dragged)
      .on('end', dragEnded));
  
  // Node circles
  node.append('circle')
    .attr('r', d => Math.max(8, Math.min(20, 8 + d.ships * 2 + d.given)))
    .attr('fill', d => d.ships > 0 ? '#7c3aed' : '#22d3ee')
    .attr('stroke', '#fff')
    .attr('stroke-width', 1.5);
  
  // Node labels
  node.append('text')
    .attr('dx', 15)
    .attr('dy', 4)
    .text(d => d.name);
  
  // Click handler
  node.on('click', (event, d) => {
    event.stopPropagation();
    selectAgent(d, node, link);
  });
  
  // Click background to deselect
  svg.on('click', () => {
    deselectAgent(node, link);
  });
  
  // Update positions on tick
  simulation.on('tick', () => {
    link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);
    
    node.attr('transform', d => `translate(${d.x},${d.y})`);
  });
}

function dragStarted(event, d) {
  if (!event.active) simulation.alphaTarget(0.3).restart();
  d.fx = d.x;
  d.fy = d.y;
}

function dragged(event, d) {
  d.fx = event.x;
  d.fy = event.y;
}

function dragEnded(event, d) {
  if (!event.active) simulation.alphaTarget(0);
  d.fx = null;
  d.fy = null;
}

function selectAgent(agent, nodeSelection, linkSelection) {
  state.selectedAgent = agent;
  
  // Update sidebar
  elements.agentInfo.classList.remove('hidden');
  elements.selectedName.textContent = agent.name;
  elements.selectedKarma.textContent = agent.karma;
  elements.selectedShips.textContent = agent.ships;
  elements.selectedGiven.textContent = agent.given;
  elements.selectedReceived.textContent = agent.received;
  
  // List attestations
  const attestations = state.links.filter(l => 
    (l.source.name || l.source) === agent.name || 
    (l.target.name || l.target) === agent.name
  );
  
  elements.attestList.innerHTML = attestations.map(l => {
    const source = l.source.name || l.source;
    const target = l.target.name || l.target;
    if (source === agent.name) {
      return `<div>→ <span>${target}</span> (${l.count}x)</div>`;
    } else {
      return `<div>← <span>${source}</span> (${l.count}x)</div>`;
    }
  }).join('');
  
  // Highlight connected
  const connected = new Set([agent.name]);
  attestations.forEach(l => {
    connected.add(l.source.name || l.source);
    connected.add(l.target.name || l.target);
  });
  
  nodeSelection.classed('dimmed', d => !connected.has(d.name));
  linkSelection.classed('dimmed', l => 
    !connected.has(l.source.name || l.source) || 
    !connected.has(l.target.name || l.target)
  );
  linkSelection.classed('highlighted', l =>
    (l.source.name || l.source) === agent.name ||
    (l.target.name || l.target) === agent.name
  );
}

function deselectAgent(nodeSelection, linkSelection) {
  state.selectedAgent = null;
  elements.agentInfo.classList.add('hidden');
  
  if (nodeSelection) {
    nodeSelection.classed('dimmed', false);
  }
  if (linkSelection) {
    linkSelection.classed('dimmed', false);
    linkSelection.classed('highlighted', false);
  }
}

function updateStats() {
  elements.agentCount.textContent = state.nodes.length;
  elements.shipCount.textContent = state.ships.length;
  elements.attestCount.textContent = state.totalAttestations || '-';
  elements.connectionCount.textContent = state.links.length;
}

async function loadData() {
  elements.loading.classList.remove('hidden');
  elements.loading.innerHTML = '<div class="spinner"></div><span>Loading ships...</span>';
  
  try {
    // Try direct first, then proxy
    let ships;
    try {
      state.useProxy = false;
      ships = await fetchAllShips();
    } catch (directError) {
      console.log('Direct API failed, trying CORS proxy...');
      state.useProxy = true;
      ships = await fetchAllShips();
    }
    
    // Apply status filter
    if (state.filter === 'verified') {
      ships = ships.filter(s => s.status === 'verified');
    } else if (state.filter === 'pending') {
      ships = ships.filter(s => s.status === 'pending');
    }
    
    state.ships = ships;
    
    elements.loading.innerHTML = '<div class="spinner"></div><span>Loading attestations...</span>';
    
    // Build graph
    const { nodes, links, totalAttestations } = await buildGraphData(ships);
    state.nodes = nodes;
    state.links = links;
    state.totalAttestations = totalAttestations;
    
    updateStats();
    renderGraph();
  } catch (e) {
    console.error('Failed to load data:', e);
    elements.loading.classList.remove('hidden');
    elements.loading.innerHTML = `
      <div style="text-align: center; max-width: 400px;">
        <div style="font-size: 2rem; margin-bottom: 12px;">🔒</div>
        <span style="color: #f87171; font-size: 1.1rem;">CORS Blocked</span>
        <p style="color: #94a3b8; font-size: 0.9rem; margin-top: 12px; line-height: 1.5;">
          The Shipyard API doesn't allow cross-origin requests from GitHub Pages.
        </p>
        <p style="color: #f8fafc; font-size: 0.9rem; margin-top: 16px;">
          <strong>To use this tool:</strong>
        </p>
        <ol style="color: #94a3b8; font-size: 0.85rem; text-align: left; margin: 12px 0; line-height: 1.8;">
          <li>Clone the repo: <code style="background: #1e293b; padding: 2px 6px; border-radius: 4px;">git clone https://github.com/crunchybananas/shipyard-microtools</code></li>
          <li>Open <code style="background: #1e293b; padding: 2px 6px; border-radius: 4px;">docs/reputation-graph/index.html</code> in your browser</li>
          <li>Or run a local server: <code style="background: #1e293b; padding: 2px 6px; border-radius: 4px;">npx serve docs</code></li>
        </ol>
        <a href="https://github.com/crunchybananas/shipyard-microtools/tree/main/docs/reputation-graph" 
           target="_blank"
           style="display: inline-block; margin-top: 12px; color: #22d3ee; text-decoration: none;">
          View Source on GitHub →
        </a>
      </div>
    `;
    return;
  } finally {
    elements.loading.classList.add('hidden');
  }
}

// Event listeners
elements.search.addEventListener('input', (e) => {
  state.searchTerm = e.target.value;
  renderGraph();
});

elements.filter.addEventListener('change', (e) => {
  state.filter = e.target.value;
  loadData();
});

elements.refresh.addEventListener('click', () => {
  loadData();
});

// Handle resize
window.addEventListener('resize', () => {
  if (state.nodes.length > 0) {
    renderGraph();
  }
});

// Initial load
loadData();
