// ============================================
// FLOWFORGE - Visual Node-Based Programming
// ============================================

// ============================================
// NODE TYPE DEFINITIONS
// ============================================

const NODE_TYPES = {
  'json-input': {
    icon: '📥',
    title: 'JSON Input',
    category: 'input',
    inputs: [],
    outputs: [{ name: 'out', type: 'any' }],
    fields: [
      { name: 'value', type: 'textarea', default: '[\n  { "name": "Alice", "age": 25 },\n  { "name": "Bob", "age": 30 }\n]' }
    ],
    execute: (inputs, fields) => {
      try {
        return { out: JSON.parse(fields.value) };
      } catch (e) {
        throw new Error('Invalid JSON: ' + e.message);
      }
    }
  },
  
  'text-input': {
    icon: '📥',
    title: 'Text Input',
    category: 'input',
    inputs: [],
    outputs: [{ name: 'out', type: 'string' }],
    fields: [
      { name: 'value', type: 'text', default: 'Hello World' }
    ],
    execute: (inputs, fields) => ({ out: fields.value })
  },
  
  'number-input': {
    icon: '📥',
    title: 'Number',
    category: 'input',
    inputs: [],
    outputs: [{ name: 'out', type: 'number' }],
    fields: [
      { name: 'value', type: 'number', default: '42' }
    ],
    execute: (inputs, fields) => ({ out: parseFloat(fields.value) || 0 })
  },
  
  'http-input': {
    icon: '🌐',
    title: 'HTTP Request',
    category: 'input',
    inputs: [],
    outputs: [{ name: 'response', type: 'any' }],
    fields: [
      { name: 'url', type: 'text', default: 'https://jsonplaceholder.typicode.com/users/1' },
      { name: 'method', type: 'select', options: ['GET', 'POST'], default: 'GET' }
    ],
    execute: async (inputs, fields) => {
      const res = await fetch(fields.url, { method: fields.method });
      const data = await res.json();
      return { response: data };
    }
  },
  
  'map': {
    icon: '🔄',
    title: 'Map',
    category: 'transform',
    inputs: [{ name: 'array', type: 'array' }],
    outputs: [{ name: 'result', type: 'array' }],
    fields: [
      { name: 'expression', type: 'text', default: 'item', placeholder: 'e.g. item.name or item * 2' }
    ],
    execute: (inputs, fields) => {
      const arr = Array.isArray(inputs.array) ? inputs.array : [inputs.array];
      const expr = fields.expression.trim();
      let fn;
      try {
        fn = new Function('item', 'index', `return ${expr}`);
      } catch (e) {
        throw new Error(`Invalid expression "${expr}": ${e.message}`);
      }
      const result = arr.map((item, index) => {
        try {
          return fn(item, index);
        } catch (e) {
          throw new Error(`Expression "${expr}" failed at index ${index}: ${e.message}`);
        }
      });
      return { result };
    }
  },
  
  'filter': {
    icon: '🔄',
    title: 'Filter',
    category: 'transform',
    inputs: [{ name: 'array', type: 'array' }],
    outputs: [{ name: 'result', type: 'array' }],
    fields: [
      { name: 'condition', type: 'text', default: 'item.age > 18', placeholder: 'e.g. item > 5 or item.active' }
    ],
    execute: (inputs, fields) => {
      const arr = Array.isArray(inputs.array) ? inputs.array : [inputs.array];
      const cond = fields.condition.trim();
      let fn;
      try {
        fn = new Function('item', 'index', `return ${cond}`);
      } catch (e) {
        throw new Error(`Invalid condition "${cond}": ${e.message}`);
      }
      const result = arr.filter((item, index) => {
        try {
          return fn(item, index);
        } catch (e) {
          throw new Error(`Condition "${cond}" failed at index ${index}: ${e.message}`);
        }
      });
      return { result };
    }
  },
  
  'jsonpath': {
    icon: '🔄',
    title: 'JSONPath',
    category: 'transform',
    inputs: [{ name: 'json', type: 'any' }],
    outputs: [{ name: 'result', type: 'any' }],
    fields: [
      { name: 'path', type: 'text', default: 'items', placeholder: 'data.items[0]' }
    ],
    execute: (inputs, fields) => {
      const path = fields.path.trim();
      let result = inputs.json;
      const parts = path.split(/\.|\[|\]/).filter(Boolean);
      for (const part of parts) {
        if (result == null) break;
        result = result[part];
      }
      return { result };
    }
  },
  
  'merge': {
    icon: '🔀',
    title: 'Merge',
    category: 'transform',
    inputs: [
      { name: 'a', type: 'any' },
      { name: 'b', type: 'any' }
    ],
    outputs: [{ name: 'result', type: 'any' }],
    fields: [],
    execute: (inputs) => {
      if (Array.isArray(inputs.a) && Array.isArray(inputs.b)) {
        return { result: [...inputs.a, ...inputs.b] };
      }
      if (typeof inputs.a === 'object' && typeof inputs.b === 'object') {
        return { result: { ...inputs.a, ...inputs.b } };
      }
      return { result: [inputs.a, inputs.b] };
    }
  },
  
  'if-else': {
    icon: '❓',
    title: 'If/Else',
    category: 'logic',
    inputs: [
      { name: 'condition', type: 'boolean' },
      { name: 'value', type: 'any' }
    ],
    outputs: [
      { name: 'true', type: 'any' },
      { name: 'false', type: 'any' }
    ],
    fields: [],
    execute: (inputs) => {
      if (inputs.condition) {
        return { true: inputs.value, false: undefined };
      }
      return { true: undefined, false: inputs.value };
    }
  },
  
  'switch': {
    icon: '🔀',
    title: 'Switch',
    category: 'logic',
    inputs: [{ name: 'value', type: 'any' }],
    outputs: [
      { name: 'case1', type: 'any' },
      { name: 'case2', type: 'any' },
      { name: 'default', type: 'any' }
    ],
    fields: [
      { name: 'case1', type: 'text', default: 'a' },
      { name: 'case2', type: 'text', default: 'b' }
    ],
    execute: (inputs, fields) => {
      const val = String(inputs.value);
      if (val === fields.case1) return { case1: inputs.value, case2: undefined, default: undefined };
      if (val === fields.case2) return { case1: undefined, case2: inputs.value, default: undefined };
      return { case1: undefined, case2: undefined, default: inputs.value };
    }
  },
  
  'math': {
    icon: '➕',
    title: 'Math',
    category: 'logic',
    inputs: [
      { name: 'a', type: 'number' },
      { name: 'b', type: 'number' }
    ],
    outputs: [{ name: 'result', type: 'number' }],
    fields: [
      { name: 'op', type: 'select', options: ['+', '-', '*', '/', '%', '^'], default: '+' }
    ],
    execute: (inputs, fields) => {
      const a = parseFloat(inputs.a) || 0;
      const b = parseFloat(inputs.b) || 0;
      let result;
      switch (fields.op) {
        case '+': result = a + b; break;
        case '-': result = a - b; break;
        case '*': result = a * b; break;
        case '/': result = b !== 0 ? a / b : 0; break;
        case '%': result = a % b; break;
        case '^': result = Math.pow(a, b); break;
        default: result = a + b;
      }
      return { result };
    }
  },
  
  'compare': {
    icon: '⚖️',
    title: 'Compare',
    category: 'logic',
    inputs: [
      { name: 'a', type: 'any' },
      { name: 'b', type: 'any' }
    ],
    outputs: [{ name: 'result', type: 'boolean' }],
    fields: [
      { name: 'op', type: 'select', options: ['==', '!=', '>', '<', '>=', '<='], default: '==' }
    ],
    execute: (inputs, fields) => {
      const a = inputs.a;
      const b = inputs.b;
      let result;
      switch (fields.op) {
        case '==': result = a == b; break;
        case '!=': result = a != b; break;
        case '>': result = a > b; break;
        case '<': result = a < b; break;
        case '>=': result = a >= b; break;
        case '<=': result = a <= b; break;
        default: result = a == b;
      }
      return { result };
    }
  },
  
  'display': {
    icon: '📤',
    title: 'Display',
    category: 'output',
    inputs: [{ name: 'data', type: 'any' }],
    outputs: [],
    fields: [],
    execute: (inputs) => {
      console.log('Display:', inputs.data);
      return { _display: inputs.data };
    }
  },
  
  'console': {
    icon: '📤',
    title: 'Console Log',
    category: 'output',
    inputs: [{ name: 'data', type: 'any' }],
    outputs: [],
    fields: [
      { name: 'label', type: 'text', default: 'Output' }
    ],
    execute: (inputs, fields) => {
      console.log(`[${fields.label}]`, inputs.data);
      return { _display: inputs.data };
    }
  },
  
  'download': {
    icon: '💾',
    title: 'Download',
    category: 'output',
    inputs: [{ name: 'data', type: 'any' }],
    outputs: [],
    fields: [
      { name: 'filename', type: 'text', default: 'output.json' }
    ],
    execute: (inputs, fields) => {
      const content = typeof inputs.data === 'string' 
        ? inputs.data 
        : JSON.stringify(inputs.data, null, 2);
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fields.filename;
      a.click();
      URL.revokeObjectURL(url);
      return { _display: `Downloaded: ${fields.filename}` };
    }
  }
};

// ============================================
// STATE
// ============================================

let nodes = [];
let connections = [];
let selectedNode = null;
let draggedNode = null;
let dragOffset = { x: 0, y: 0 };
let isPanning = false;
let panStart = { x: 0, y: 0 };
let canvasOffset = { x: 0, y: 0 };
let canvasScale = 1;
let nodeIdCounter = 1;

// Connection dragging
let isDraggingConnection = false;
let connectionStart = null; // { nodeId, portName, isOutput }
let tempConnectionEnd = { x: 0, y: 0 };

// Execution results
let executionResults = new Map();

// ============================================
// DOM ELEMENTS
// ============================================

const canvas = document.getElementById('canvas');
const canvasContainer = document.getElementById('canvas-container');
const connectionsEl = document.getElementById('connections');
const previewContent = document.getElementById('preview-content');

// ============================================
// NODE CREATION
// ============================================

function createNode(type, x, y) {
  const nodeDef = NODE_TYPES[type];
  if (!nodeDef) return null;
  
  const node = {
    id: `node-${nodeIdCounter++}`,
    type,
    x,
    y,
    fields: {}
  };
  
  // Initialize field values
  nodeDef.fields.forEach(f => {
    node.fields[f.name] = f.default || '';
  });
  
  nodes.push(node);
  renderNode(node);
  updateConnections();
  updateMinimap();
  
  return node;
}

function renderNode(node) {
  const def = NODE_TYPES[node.type];
  
  const el = document.createElement('div');
  el.className = 'node';
  el.id = node.id;
  el.tabIndex = 0;
  el.setAttribute('role', 'group');
  el.setAttribute('aria-label', `${def.title} node`);
  el.style.left = `${node.x}px`;
  el.style.top = `${node.y}px`;
  
  // Header
  const header = document.createElement('div');
  header.className = 'node-header';
  header.innerHTML = `
    <span class="node-icon">${def.icon}</span>
    <span class="node-title">${def.title}</span>
  `;
  el.appendChild(header);
  
  // Body with fields
  if (def.fields.length > 0) {
    const body = document.createElement('div');
    body.className = 'node-body';
    
    def.fields.forEach(field => {
      const fieldEl = document.createElement('div');
      fieldEl.className = 'node-field';
      
      let input;
      if (field.type === 'textarea') {
        input = document.createElement('textarea');
        input.value = node.fields[field.name];
      } else if (field.type === 'select') {
        input = document.createElement('select');
        field.options.forEach(opt => {
          const option = document.createElement('option');
          option.value = opt;
          option.textContent = opt;
          if (opt === node.fields[field.name]) option.selected = true;
          input.appendChild(option);
        });
      } else {
        input = document.createElement('input');
        input.type = field.type === 'number' ? 'number' : 'text';
        input.value = node.fields[field.name];
        if (field.placeholder) input.placeholder = field.placeholder;
      }

      const fieldId = `${node.id}-field-${field.name.replace(/[^a-z0-9_-]/gi, '-')}`;
      input.id = fieldId;
      input.setAttribute('aria-label', `${def.title}: ${field.name}`);
      
      input.dataset.field = field.name;
      input.addEventListener('input', (e) => {
        node.fields[field.name] = e.target.value;
      });
      input.addEventListener('mousedown', e => e.stopPropagation());
      
      if (field.name !== 'value' && field.name !== 'op') {
        const label = document.createElement('label');
        label.textContent = field.name;
        label.htmlFor = fieldId;
        fieldEl.appendChild(label);
      }
      fieldEl.appendChild(input);
      body.appendChild(fieldEl);
    });
    
    el.appendChild(body);
  }
  
  // Ports
  const ports = document.createElement('div');
  ports.className = 'node-ports';
  
  // Input ports
  const portsIn = document.createElement('div');
  portsIn.className = 'ports-in';
  def.inputs.forEach(input => {
    const port = document.createElement('div');
    port.className = 'port';
    port.dataset.nodeId = node.id;
    port.dataset.portName = input.name;
    port.dataset.portType = input.type;
    port.dataset.isOutput = 'false';
    port.innerHTML = `<div class="port-dot ${input.type}"></div><span>${input.name}</span>`;
    portsIn.appendChild(port);
  });
  ports.appendChild(portsIn);
  
  // Output ports
  const portsOut = document.createElement('div');
  portsOut.className = 'ports-out';
  def.outputs.forEach(output => {
    const port = document.createElement('div');
    port.className = 'port';
    port.dataset.nodeId = node.id;
    port.dataset.portName = output.name;
    port.dataset.portType = output.type;
    port.dataset.isOutput = 'true';
    port.innerHTML = `<span>${output.name}</span><div class="port-dot ${output.type}"></div>`;
    portsOut.appendChild(port);
  });
  ports.appendChild(portsOut);
  
  el.appendChild(ports);
  
  // Event listeners
  header.addEventListener('mousedown', (e) => startDragNode(e, node));
  el.addEventListener('click', () => selectNode(node));
  el.addEventListener('keydown', (e) => {
    if (e.target === el && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      selectNode(node);
    }
  });
  el.addEventListener('contextmenu', (e) => showContextMenu(e, node));
  
  // Port events
  el.querySelectorAll('.port').forEach(port => {
    port.addEventListener('mousedown', (e) => startConnectionDrag(e, port));
  });
  
  canvas.appendChild(el);
}

// ============================================
// NODE INTERACTIONS
// ============================================

function selectNode(node) {
  // Deselect previous
  document.querySelectorAll('.node.selected').forEach(el => el.classList.remove('selected'));
  
  selectedNode = node;
  
  if (node) {
    document.getElementById(node.id)?.classList.add('selected');
    showNodePreview(node);
  }
}

function startDragNode(e, node) {
  if (e.button !== 0) return;
  e.stopPropagation();
  
  draggedNode = node;
  const el = document.getElementById(node.id);
  const rect = el.getBoundingClientRect();
  const canvasRect = canvasContainer.getBoundingClientRect();
  
  dragOffset = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
  
  selectNode(node);
}

function showContextMenu(e, node) {
  e.preventDefault();
  const menu = document.getElementById('context-menu');
  menu.style.left = `${e.clientX}px`;
  menu.style.top = `${e.clientY}px`;
  menu.classList.remove('hidden');
  menu.dataset.nodeId = node.id;
}

function hideContextMenu() {
  document.getElementById('context-menu').classList.add('hidden');
}

function deleteNode(nodeId) {
  const idx = nodes.findIndex(n => n.id === nodeId);
  if (idx === -1) return;
  
  nodes.splice(idx, 1);
  document.getElementById(nodeId)?.remove();
  
  // Remove connections
  connections = connections.filter(c => c.from.nodeId !== nodeId && c.to.nodeId !== nodeId);
  updateConnections();
  updateMinimap();
  
  if (selectedNode?.id === nodeId) {
    selectedNode = null;
    previewContent.innerHTML = '<div class="preview-empty">Select a node or run the flow to see data</div>';
  }
}

function duplicateNode(nodeId) {
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return;
  
  const newNode = createNode(node.type, node.x + 30, node.y + 30);
  if (newNode) {
    newNode.fields = { ...node.fields };
    // Re-render to update fields
    document.getElementById(newNode.id)?.remove();
    renderNode(newNode);
  }
}

// ============================================
// CONNECTIONS
// ============================================

function startConnectionDrag(e, portEl) {
  e.stopPropagation();
  e.preventDefault();
  
  isDraggingConnection = true;
  connectionStart = {
    nodeId: portEl.dataset.nodeId,
    portName: portEl.dataset.portName,
    portType: portEl.dataset.portType,
    isOutput: portEl.dataset.isOutput === 'true'
  };
  
  const rect = portEl.querySelector('.port-dot').getBoundingClientRect();
  const canvasRect = canvasContainer.getBoundingClientRect();
  
  tempConnectionEnd = {
    x: (rect.left + rect.width / 2 - canvasRect.left + canvasContainer.scrollLeft) / canvasScale - canvasOffset.x,
    y: (rect.top + rect.height / 2 - canvasRect.top + canvasContainer.scrollTop) / canvasScale - canvasOffset.y
  };
  
  // Create temp connection line
  const tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  tempLine.id = 'temp-connection';
  connectionsEl.appendChild(tempLine);
}

function updateTempConnection(e) {
  const tempLine = document.getElementById('temp-connection');
  if (!tempLine || !connectionStart) return;
  
  const canvasRect = canvasContainer.getBoundingClientRect();
  const endX = (e.clientX - canvasRect.left + canvasContainer.scrollLeft) / canvasScale - canvasOffset.x;
  const endY = (e.clientY - canvasRect.top + canvasContainer.scrollTop) / canvasScale - canvasOffset.y;
  
  const startPort = getPortPosition(connectionStart.nodeId, connectionStart.portName, connectionStart.isOutput);
  
  if (connectionStart.isOutput) {
    tempLine.setAttribute('d', createBezierPath(startPort.x, startPort.y, endX, endY));
  } else {
    tempLine.setAttribute('d', createBezierPath(endX, endY, startPort.x, startPort.y));
  }
}

function endConnectionDrag(e) {
  document.getElementById('temp-connection')?.remove();
  
  if (!connectionStart) return;
  
  // Find port under cursor
  const portEl = document.elementFromPoint(e.clientX, e.clientY)?.closest('.port');
  
  if (portEl) {
    const endPort = {
      nodeId: portEl.dataset.nodeId,
      portName: portEl.dataset.portName,
      portType: portEl.dataset.portType,
      isOutput: portEl.dataset.isOutput === 'true'
    };
    
    // Validate connection
    if (connectionStart.nodeId !== endPort.nodeId &&
        connectionStart.isOutput !== endPort.isOutput) {

      const from = connectionStart.isOutput ? connectionStart : endPort;
      const to = connectionStart.isOutput ? endPort : connectionStart;

      if (wouldCreateCycle(from.nodeId, to.nodeId)) {
        showToast('Connection rejected: it would create a cycle', 'error');
      } else {
        // Remove existing connection to this input
        connections = connections.filter(c =>
          !(c.to.nodeId === to.nodeId && c.to.portName === to.portName)
        );

        connections.push({ from, to });
        updateConnections();
      }
    }
  }
  
  isDraggingConnection = false;
  connectionStart = null;
}

// A new edge from -> to creates a cycle if `from` is already reachable
// downstream of `to`
function wouldCreateCycle(fromNodeId, toNodeId) {
  const stack = [toNodeId];
  const visited = new Set();
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === fromNodeId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    connections.forEach(c => {
      if (c.from.nodeId === current) stack.push(c.to.nodeId);
    });
  }
  return false;
}

function getPortPosition(nodeId, portName, isOutput) {
  const node = nodes.find(n => n.id === nodeId);
  const nodeEl = document.getElementById(nodeId);
  if (!node || !nodeEl) return { x: 0, y: 0 };
  
  const portEl = nodeEl.querySelector(`.port[data-port-name="${portName}"][data-is-output="${isOutput}"]`);
  if (!portEl) return { x: node.x, y: node.y };
  
  const dotEl = portEl.querySelector('.port-dot');
  const nodeRect = nodeEl.getBoundingClientRect();
  const dotRect = dotEl.getBoundingClientRect();
  
  // Rect offsets are in screen pixels; convert to canvas space
  return {
    x: node.x + (dotRect.left - nodeRect.left + dotRect.width / 2) / canvasScale,
    y: node.y + (dotRect.top - nodeRect.top + dotRect.height / 2) / canvasScale
  };
}

function createBezierPath(x1, y1, x2, y2) {
  const midX = (x1 + x2) / 2;
  const dx = Math.abs(x2 - x1);
  const controlOffset = Math.min(dx * 0.5, 100);
  
  return `M ${x1} ${y1} C ${x1 + controlOffset} ${y1}, ${x2 - controlOffset} ${y2}, ${x2} ${y2}`;
}

function updateConnections() {
  // Clear existing paths (except temp)
  connectionsEl.querySelectorAll('path:not(#temp-connection)').forEach(p => p.remove());
  
  connections.forEach(conn => {
    const fromPos = getPortPosition(conn.from.nodeId, conn.from.portName, true);
    const toPos = getPortPosition(conn.to.nodeId, conn.to.portName, false);
    
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', createBezierPath(fromPos.x, fromPos.y, toPos.x, toPos.y));
    
    // Color based on port type
    const typeColors = {
      string: '#4ade80',
      number: '#60a5fa',
      boolean: '#f472b6',
      array: '#c084fc',
      object: '#fb923c',
      any: '#94a3b8'
    };
    path.setAttribute('stroke', typeColors[conn.from.portType] || typeColors.any);
    
    path.dataset.from = `${conn.from.nodeId}:${conn.from.portName}`;
    path.dataset.to = `${conn.to.nodeId}:${conn.to.portName}`;
    
    path.addEventListener('click', () => {
      connections = connections.filter(c => 
        !(c.from.nodeId === conn.from.nodeId && 
          c.from.portName === conn.from.portName &&
          c.to.nodeId === conn.to.nodeId &&
          c.to.portName === conn.to.portName)
      );
      updateConnections();
    });
    
    path.style.cursor = 'pointer';
    path.style.pointerEvents = 'stroke';
    
    connectionsEl.appendChild(path);
  });
  
  // Update port connected states
  document.querySelectorAll('.port-dot').forEach(dot => {
    dot.classList.remove('connected');
  });
  
  connections.forEach(conn => {
    const fromPort = document.querySelector(`#${conn.from.nodeId} .port[data-port-name="${conn.from.portName}"][data-is-output="true"] .port-dot`);
    const toPort = document.querySelector(`#${conn.to.nodeId} .port[data-port-name="${conn.to.portName}"][data-is-output="false"] .port-dot`);
    fromPort?.classList.add('connected');
    toPort?.classList.add('connected');
  });
}

// ============================================
// CANVAS PANNING
// ============================================

canvasContainer.addEventListener('mousedown', (e) => {
  if (e.target === canvasContainer || e.target === canvas) {
    isPanning = true;
    panStart = { x: e.clientX + canvasContainer.scrollLeft, y: e.clientY + canvasContainer.scrollTop };
    canvasContainer.style.cursor = 'grabbing';
    hideContextMenu();
    selectNode(null);
  }
});

document.addEventListener('mousemove', (e) => {
  if (draggedNode) {
    const canvasRect = canvasContainer.getBoundingClientRect();
    draggedNode.x = (e.clientX - canvasRect.left + canvasContainer.scrollLeft - dragOffset.x) / canvasScale;
    draggedNode.y = (e.clientY - canvasRect.top + canvasContainer.scrollTop - dragOffset.y) / canvasScale;
    
    const el = document.getElementById(draggedNode.id);
    el.style.left = `${draggedNode.x}px`;
    el.style.top = `${draggedNode.y}px`;
    
    updateConnections();
    updateMinimap();
  }
  
  if (isPanning) {
    canvasContainer.scrollLeft = panStart.x - e.clientX;
    canvasContainer.scrollTop = panStart.y - e.clientY;
    updateMinimap();
  }
  
  if (isDraggingConnection) {
    updateTempConnection(e);
  }
});

document.addEventListener('mouseup', (e) => {
  if (draggedNode) {
    draggedNode = null;
  }
  
  if (isPanning) {
    isPanning = false;
    canvasContainer.style.cursor = '';
  }
  
  if (isDraggingConnection) {
    endConnectionDrag(e);
  }
});

let touchPan = null;

canvasContainer.addEventListener('touchstart', (e) => {
  if (e.touches.length !== 1 || (e.target !== canvasContainer && e.target !== canvas)) return;
  const touch = e.touches[0];
  touchPan = {
    id: touch.identifier,
    x: touch.clientX + canvasContainer.scrollLeft,
    y: touch.clientY + canvasContainer.scrollTop
  };
  hideContextMenu();
  selectNode(null);
}, { passive: true });

canvasContainer.addEventListener('touchmove', (e) => {
  if (!touchPan) return;
  const touch = [...e.touches].find(item => item.identifier === touchPan.id);
  if (!touch) return;
  e.preventDefault();
  canvasContainer.scrollLeft = touchPan.x - touch.clientX;
  canvasContainer.scrollTop = touchPan.y - touch.clientY;
  updateMinimap();
}, { passive: false });

const endTouchPan = () => {
  touchPan = null;
};

canvasContainer.addEventListener('touchend', endTouchPan);
canvasContainer.addEventListener('touchcancel', endTouchPan);

// ============================================
// CANVAS ZOOM
// ============================================

const MIN_SCALE = 0.25;
const MAX_SCALE = 2;

canvasContainer.addEventListener('wheel', (e) => {
  // Let node fields scroll normally
  if (e.target.closest('input, textarea, select')) return;
  e.preventDefault();

  const canvasRect = canvasContainer.getBoundingClientRect();
  const mouseX = e.clientX - canvasRect.left;
  const mouseY = e.clientY - canvasRect.top;

  // Canvas-space point under the cursor before zooming
  const worldX = (mouseX + canvasContainer.scrollLeft) / canvasScale;
  const worldY = (mouseY + canvasContainer.scrollTop) / canvasScale;

  const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
  const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, canvasScale * factor));
  if (newScale === canvasScale) return;
  canvasScale = newScale;

  canvas.style.transform = `scale(${canvasScale})`;
  connectionsEl.style.transform = `scale(${canvasScale})`;

  // Keep that point under the cursor after zooming
  canvasContainer.scrollLeft = worldX * canvasScale - mouseX;
  canvasContainer.scrollTop = worldY * canvasScale - mouseY;

  updateMinimap();
}, { passive: false });

// Hide context menu on click elsewhere
document.addEventListener('click', (e) => {
  if (!e.target.closest('#context-menu')) {
    hideContextMenu();
  }
});

// Context menu actions
document.getElementById('context-menu').addEventListener('click', (e) => {
  const action = e.target.dataset.action;
  const nodeId = document.getElementById('context-menu').dataset.nodeId;
  
  if (action === 'delete') {
    deleteNode(nodeId);
  } else if (action === 'duplicate') {
    duplicateNode(nodeId);
  } else if (action === 'disconnect') {
    connections = connections.filter(c => c.from.nodeId !== nodeId && c.to.nodeId !== nodeId);
    updateConnections();
  }
  
  hideContextMenu();
});

document.querySelectorAll('#context-menu [role="menuitem"]').forEach(item => {
  item.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      item.click();
    }
  });
});

// ============================================
// PALETTE DRAG & DROP
// ============================================

function placePaletteNode(paletteNode) {
  const type = paletteNode.dataset.type;
  const centerX = (canvasContainer.scrollLeft + canvasContainer.clientWidth / 2) / canvasScale;
  const centerY = (canvasContainer.scrollTop + canvasContainer.clientHeight / 2) / canvasScale;
  const node = createNode(type, centerX - 90, centerY - 50);
  if (node) selectNode(node);
}

document.querySelectorAll('.palette-node').forEach(paletteNode => {
  paletteNode.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('nodeType', paletteNode.dataset.type);
  });
  
  paletteNode.setAttribute('draggable', true);
  
  // Also support click to add
  paletteNode.addEventListener('dblclick', () => {
    if (!window.matchMedia('(pointer: coarse)').matches) {
      placePaletteNode(paletteNode);
    }
  });

  paletteNode.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      placePaletteNode(paletteNode);
    }
  });

  paletteNode.addEventListener('click', () => {
    if (window.matchMedia('(pointer: coarse)').matches) {
      placePaletteNode(paletteNode);
    }
  });
});

canvasContainer.addEventListener('dragover', (e) => {
  e.preventDefault();
});

canvasContainer.addEventListener('drop', (e) => {
  e.preventDefault();
  const type = e.dataTransfer.getData('nodeType');
  if (!type) return;
  
  const canvasRect = canvasContainer.getBoundingClientRect();
  const x = (e.clientX - canvasRect.left + canvasContainer.scrollLeft) / canvasScale - 90;
  const y = (e.clientY - canvasRect.top + canvasContainer.scrollTop) / canvasScale - 30;
  
  createNode(type, x, y);
});

// ============================================
// EXECUTION
// ============================================

let stepState = null; // { sorted, index, failedNodes } while stepping through a flow

function resetRunState() {
  executionResults.clear();
  document.querySelectorAll('.node').forEach(el => {
    el.classList.remove('running', 'success', 'error');
    el.querySelector('.node-result')?.remove();
    el.querySelector('.node-error-msg')?.remove();
  });
}

function markNodeError(el, message) {
  el.classList.add('error');

  const badge = document.createElement('div');
  badge.className = 'node-result error';
  badge.textContent = '!';
  badge.title = message;
  el.appendChild(badge);

  const msg = document.createElement('div');
  msg.className = 'node-error-msg';
  msg.textContent = message;
  el.appendChild(msg);
}

// Execute a single node. Returns true on success, false on error or skip.
async function executeNode(node, failedNodes) {
  const el = document.getElementById(node.id);
  if (!el) return false;

  // Don't run nodes downstream of a failure
  const blocked = connections.some(c => c.to.nodeId === node.id && failedNodes.has(c.from.nodeId));
  if (blocked) {
    failedNodes.add(node.id);
    executionResults.set(node.id, { _error: 'Skipped: upstream node failed' });
    markNodeError(el, 'Skipped: upstream node failed');
    return false;
  }

  el.classList.add('running');

  try {
    const def = NODE_TYPES[node.type];

    // Gather inputs
    const inputs = {};
    def.inputs.forEach(input => {
      const conn = connections.find(c => c.to.nodeId === node.id && c.to.portName === input.name);
      if (conn) {
        const sourceResult = executionResults.get(conn.from.nodeId);
        if (sourceResult) {
          inputs[input.name] = sourceResult[conn.from.portName];
        }
      }
    });

    // Execute
    const result = await def.execute(inputs, node.fields);
    executionResults.set(node.id, result);

    el.classList.remove('running');
    el.classList.add('success');

    // Add success badge
    const badge = document.createElement('div');
    badge.className = 'node-result';
    badge.textContent = '✓';
    el.appendChild(badge);

    return true;
  } catch (err) {
    el.classList.remove('running');
    failedNodes.add(node.id);
    executionResults.set(node.id, { _error: err.message });
    markNodeError(el, err.message);
    showToast(`Error in ${NODE_TYPES[node.type].title}: ${err.message}`, 'error');
    return false;
  }
}

async function executeFlow() {
  stepState = null;
  resetRunState();

  // Topological sort
  const sorted = topologicalSort();
  const failedNodes = new Set();

  for (const node of sorted) {
    await executeNode(node, failedNodes);

    // Small delay for visual effect
    await new Promise(r => setTimeout(r, 100));
  }

  // Show results in preview
  showExecutionResults();
}

async function stepFlow() {
  // Start (or restart) a stepping session
  if (!stepState || stepState.index >= stepState.sorted.length) {
    const sorted = topologicalSort();
    if (sorted.length === 0) {
      showToast('Add nodes to step through');
      return;
    }
    resetRunState();
    stepState = { sorted, index: 0, failedNodes: new Set() };
  }

  // Skip nodes removed since the session started (delete, load, examples)
  let node = null;
  while (stepState.index < stepState.sorted.length) {
    const candidate = stepState.sorted[stepState.index++];
    if (nodes.includes(candidate)) {
      node = candidate;
      break;
    }
  }
  if (!node) {
    stepState = null;
    showExecutionResults();
    return;
  }

  const ok = await executeNode(node, stepState.failedNodes);
  if (!stepState) return; // Run or Clear happened mid-step
  selectNode(node);

  if (stepState.index >= stepState.sorted.length) {
    stepState = null;
    showExecutionResults();
    if (ok) showToast('Step complete: end of flow', 'success');
  } else if (ok) {
    showToast(`Step ${stepState.index}/${stepState.sorted.length}: ${NODE_TYPES[node.type].title}`);
  }
}

function topologicalSort() {
  const visited = new Set();
  const result = [];
  
  function visit(nodeId) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    
    // Visit dependencies first
    connections
      .filter(c => c.to.nodeId === nodeId)
      .forEach(c => visit(c.from.nodeId));
    
    const node = nodes.find(n => n.id === nodeId);
    if (node) result.push(node);
  }
  
  nodes.forEach(n => visit(n.id));
  return result;
}

function clearResults() {
  stepState = null;
  resetRunState();
  previewContent.innerHTML = '<div class="preview-empty">Select a node or run the flow to see data</div>';
}

// ============================================
// PREVIEW PANEL
// ============================================

function showNodePreview(node) {
  const def = NODE_TYPES[node.type];
  const result = executionResults.get(node.id);
  
  let html = `<div class="preview-node-name">${def.icon} ${def.title}</div>`;
  
  if (result) {
    if (result._error) {
      html += `
        <div class="preview-section">
          <div class="preview-label">Error</div>
          <div class="preview-data" style="color: var(--error)">${escapeHtml(result._error)}</div>
        </div>
      `;
    } else if (result._display !== undefined) {
      html += `
        <div class="preview-section">
          <div class="preview-label">Output</div>
          <div class="preview-data">${formatValue(result._display)}</div>
        </div>
      `;
    } else {
      Object.entries(result).forEach(([key, value]) => {
        if (!key.startsWith('_')) {
          html += `
            <div class="preview-section">
              <div class="preview-label">${key}</div>
              <div class="preview-data">${formatValue(value)}</div>
            </div>
          `;
        }
      });
    }
  } else {
    html += '<div class="preview-empty">Run the flow to see output</div>';
  }
  
  previewContent.innerHTML = html;
}

function showExecutionResults() {
  // Find output nodes and display their results
  const outputNodes = nodes.filter(n => NODE_TYPES[n.type].category === 'output');
  
  if (outputNodes.length === 0) {
    previewContent.innerHTML = '<div class="preview-empty">Add an output node to see results</div>';
    return;
  }
  
  let html = '';
  outputNodes.forEach(node => {
    const def = NODE_TYPES[node.type];
    const result = executionResults.get(node.id);
    
    html += `<div class="preview-node-name">${def.icon} ${def.title}</div>`;
    
    if (result?._display !== undefined) {
      html += `
        <div class="preview-section">
          <div class="preview-data">${formatValue(result._display)}</div>
        </div>
      `;
    } else if (result?._error) {
      html += `
        <div class="preview-section">
          <div class="preview-data" style="color: var(--error)">${escapeHtml(result._error)}</div>
        </div>
      `;
    }
  });
  
  previewContent.innerHTML = html || '<div class="preview-empty">No output</div>';
}

function formatValue(value) {
  if (value === undefined) return '<span style="color: var(--text-dim)">undefined</span>';
  if (value === null) return '<span style="color: var(--text-dim)">null</span>';
  if (typeof value === 'string') return escapeHtml(value);
  return escapeHtml(JSON.stringify(value, null, 2));
}

function escapeHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(str).replace(/[&<>"']/g, ch => map[ch]);
}

// ============================================
// MINIMAP
// ============================================

const minimapCanvas = document.getElementById('minimap-canvas');
const minimapCtx = minimapCanvas.getContext('2d');

function updateMinimap() {
  const scale = 0.03;
  minimapCanvas.width = 150;
  minimapCanvas.height = 100;
  
  minimapCtx.fillStyle = '#052b45';
  minimapCtx.fillRect(0, 0, 150, 100);
  
  // Draw nodes
  minimapCtx.fillStyle = '#f1b84a';
  nodes.forEach(node => {
    minimapCtx.fillRect(
      node.x * scale,
      node.y * scale,
      180 * scale,
      80 * scale
    );
  });
  
  // Draw viewport
  minimapCtx.strokeStyle = 'rgba(119, 217, 232, 0.8)';
  minimapCtx.lineWidth = 1;
  minimapCtx.strokeRect(
    canvasContainer.scrollLeft / canvasScale * scale,
    canvasContainer.scrollTop / canvasScale * scale,
    canvasContainer.clientWidth / canvasScale * scale,
    canvasContainer.clientHeight / canvasScale * scale
  );
}

// ============================================
// SAVE / LOAD
// ============================================

function saveFlow() {
  const name = document.getElementById('save-name').value || 'Untitled Flow';
  
  const flow = {
    name,
    timestamp: Date.now(),
    nodes: nodes.map(n => ({
      id: n.id,
      type: n.type,
      x: n.x,
      y: n.y,
      fields: n.fields
    })),
    connections: connections.map(c => ({
      from: { nodeId: c.from.nodeId, portName: c.from.portName },
      to: { nodeId: c.to.nodeId, portName: c.to.portName }
    }))
  };
  
  const saved = JSON.parse(localStorage.getItem('flowforge_flows') || '[]');
  saved.push(flow);
  localStorage.setItem('flowforge_flows', JSON.stringify(saved));
  
  document.getElementById('save-modal').classList.add('hidden');
  showToast(`Saved: ${name}`, 'success');
}

function loadFlow(flow) {
  // Clear current
  nodes.forEach(n => document.getElementById(n.id)?.remove());
  nodes = [];
  connections = [];
  nodeIdCounter = 1;
  
  // Load nodes
  flow.nodes.forEach(n => {
    const node = {
      id: n.id,
      type: n.type,
      x: n.x,
      y: n.y,
      fields: n.fields
    };
    nodes.push(node);
    renderNode(node);
    
    // Update nodeIdCounter
    const num = parseInt(n.id.replace('node-', ''));
    if (num >= nodeIdCounter) nodeIdCounter = num + 1;
  });
  
  // Load connections
  flow.connections.forEach(c => {
    const fromNode = nodes.find(n => n.id === c.from.nodeId);
    const toNode = nodes.find(n => n.id === c.to.nodeId);
    if (fromNode && toNode) {
      const fromDef = NODE_TYPES[fromNode.type];
      const toDef = NODE_TYPES[toNode.type];
      const fromPort = fromDef.outputs.find(o => o.name === c.from.portName);
      const toPort = toDef.inputs.find(i => i.name === c.to.portName);
      
      if (fromPort && toPort) {
        connections.push({
          from: { nodeId: c.from.nodeId, portName: c.from.portName, portType: fromPort.type, isOutput: true },
          to: { nodeId: c.to.nodeId, portName: c.to.portName, portType: toPort.type, isOutput: false }
        });
      }
    }
  });
  
  updateConnections();
  updateMinimap();
  
  document.getElementById('load-modal').classList.add('hidden');
  showToast(`Loaded: ${flow.name}`, 'success');
}

function showLoadModal() {
  const saved = JSON.parse(localStorage.getItem('flowforge_flows') || '[]');
  const container = document.getElementById('saved-flows');
  
  if (saved.length === 0) {
    container.innerHTML = '<div class="preview-empty">No saved flows</div>';
  } else {
    container.innerHTML = saved.map((flow, i) => `
      <div class="saved-flow-item" data-index="${i}" role="button" tabindex="0" aria-label="Load ${escapeHtml(flow.name)}">
        <div>
          <div class="saved-flow-name">${escapeHtml(flow.name)}</div>
          <div class="saved-flow-date">${new Date(flow.timestamp).toLocaleDateString()}</div>
        </div>
        <button type="button" class="saved-flow-delete" data-index="${i}" aria-label="Delete ${escapeHtml(flow.name)}">×</button>
      </div>
    `).join('');
    
    container.querySelectorAll('.saved-flow-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('saved-flow-delete')) {
          e.stopPropagation();
          const idx = parseInt(e.target.dataset.index);
          saved.splice(idx, 1);
          localStorage.setItem('flowforge_flows', JSON.stringify(saved));
          showLoadModal();
          return;
        }
        
        const idx = parseInt(item.dataset.index);
        loadFlow(saved[idx]);
      });

      item.addEventListener('keydown', (e) => {
        if (e.target === item && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          loadFlow(saved[parseInt(item.dataset.index)]);
        }
      });
    });
  }
  
  document.getElementById('load-modal').classList.remove('hidden');
}

// ============================================
// EXAMPLES
// ============================================

// Helper to create a node and update its fields without relying on global array indices
function createExampleNode(type, x, y, fieldOverrides = {}) {
  const node = createNode(type, x, y);
  if (fieldOverrides && Object.keys(fieldOverrides).length > 0) {
    Object.assign(node.fields, fieldOverrides);
    document.getElementById(node.id)?.remove();
    renderNode(node);
  }
  return node;
}

// Helper to connect two nodes by reference
function connectNodes(fromNode, fromPort, toNode, toPort) {
  connections.push({
    from: { nodeId: fromNode.id, portName: fromPort, portType: 'any', isOutput: true },
    to: { nodeId: toNode.id, portName: toPort, portType: 'any', isOutput: false }
  });
}

const EXAMPLES = {
  'json-transform': () => {
    // JSON with users -> extract users array -> map to names -> display
    const input = createExampleNode('json-input', 80, 120, {
      value: '{\n  "users": [\n    { "name": "Alice", "age": 25 },\n    { "name": "Bob", "age": 30 },\n    { "name": "Carol", "age": 22 }\n  ]\n}'
    });
    
    const extract = createExampleNode('jsonpath', 340, 120, {
      path: 'users'
    });
    
    const map = createExampleNode('map', 560, 120, {
      expression: 'item.name'
    });
    
    const display = createExampleNode('display', 780, 120);
    
    setTimeout(() => {
      connectNodes(input, 'out', extract, 'json');
      connectNodes(extract, 'result', map, 'array');
      connectNodes(map, 'result', display, 'data');
      updateConnections();
    }, 50);
  },
  
  'math-calc': () => {
    // (10 + 5) * 2 = 30
    const num1 = createExampleNode('number-input', 80, 80, { value: '10' });
    const num2 = createExampleNode('number-input', 80, 200, { value: '5' });
    const add = createExampleNode('math', 300, 120, { op: '+' });
    
    const num3 = createExampleNode('number-input', 80, 340, { value: '2' });
    const mult = createExampleNode('math', 500, 200, { op: '*' });
    
    const display = createExampleNode('display', 700, 200);
    
    setTimeout(() => {
      connectNodes(num1, 'out', add, 'a');
      connectNodes(num2, 'out', add, 'b');
      connectNodes(add, 'result', mult, 'a');
      connectNodes(num3, 'out', mult, 'b');
      connectNodes(mult, 'result', display, 'data');
      updateConnections();
    }, 50);
  },
  
  'filter-data': () => {
    // Filter numbers greater than 5
    const input = createExampleNode('json-input', 80, 120, {
      value: '[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]'
    });
    
    const filter = createExampleNode('filter', 340, 120, {
      condition: 'item > 5'
    });
    
    const display = createExampleNode('display', 580, 120);
    
    setTimeout(() => {
      connectNodes(input, 'out', filter, 'array');
      connectNodes(filter, 'result', display, 'data');
      updateConnections();
    }, 50);
  },
  
  'http-fetch': () => {
    // Fetch user from API and extract name
    const http = createExampleNode('http-input', 80, 120, {
      url: 'https://jsonplaceholder.typicode.com/users/1',
      method: 'GET'
    });
    
    const extract = createExampleNode('jsonpath', 340, 120, {
      path: 'name'
    });
    
    const display = createExampleNode('display', 560, 120);
    
    setTimeout(() => {
      connectNodes(http, 'response', extract, 'json');
      connectNodes(extract, 'result', display, 'data');
      updateConnections();
    }, 50);
  }
};

document.querySelectorAll('.example-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    // Clear all existing nodes from DOM
    document.querySelectorAll('.node').forEach(el => el.remove());
    
    // Reset state
    nodes = [];
    connections = [];
    nodeIdCounter = 1;
    executionResults.clear();
    
    // Clear SVG connections
    connectionsEl.querySelectorAll('path').forEach(p => p.remove());
    
    // Clear preview
    previewContent.innerHTML = '<div class="preview-empty">Select a node or run the flow to see data</div>';
    
    // Load example
    const exampleName = btn.dataset.example;
    if (EXAMPLES[exampleName]) {
      EXAMPLES[exampleName]();
      
      // Auto-run after connections are made
      setTimeout(() => {
        executeFlow();
      }, 150);
    }
    
    updateMinimap();
  });
});

// ============================================
// TOAST
// ============================================

function showToast(message, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = type;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
}

// ============================================
// EVENT LISTENERS
// ============================================

document.getElementById('runBtn').addEventListener('click', executeFlow);
document.getElementById('stepBtn').addEventListener('click', stepFlow);
document.getElementById('clearBtn').addEventListener('click', clearResults);

document.getElementById('newBtn').addEventListener('click', () => {
  if (nodes.length > 0 && !confirm('Clear current flow?')) return;
  nodes.forEach(n => document.getElementById(n.id)?.remove());
  nodes = [];
  connections = [];
  nodeIdCounter = 1;
  clearResults();
  updateMinimap();
});

document.getElementById('saveBtn').addEventListener('click', () => {
  document.getElementById('save-modal').classList.remove('hidden');
  document.getElementById('save-name').focus();
});

document.getElementById('loadBtn').addEventListener('click', showLoadModal);

document.getElementById('save-confirm').addEventListener('click', saveFlow);

const previewPanel = document.getElementById('preview-panel');
const closePreviewButton = document.getElementById('closePreview');
closePreviewButton.addEventListener('click', () => {
  const collapsed = previewPanel.classList.toggle('collapsed');
  closePreviewButton.setAttribute('aria-expanded', String(!collapsed));
  closePreviewButton.setAttribute('aria-label', collapsed ? 'Expand data preview' : 'Collapse data preview');
  closePreviewButton.textContent = collapsed ? '+' : '×';
});

// Modal close buttons
document.querySelectorAll('.modal .close-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.closest('.modal').classList.add('hidden');
  });
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (selectedNode && !e.target.matches('input, textarea')) {
      deleteNode(selectedNode.id);
    }
  }
  
  if (e.key === 'Escape') {
    hideContextMenu();
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
  }
  
  if (e.ctrlKey || e.metaKey) {
    if (e.key === 's') {
      e.preventDefault();
      document.getElementById('save-modal').classList.remove('hidden');
      document.getElementById('save-name').focus();
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      executeFlow();
    }
  }
});

// ============================================
// INITIALIZATION
// ============================================

// Example plans are drafted from the top-left registration marks.
canvasContainer.scrollLeft = 0;
canvasContainer.scrollTop = 0;

updateMinimap();

// Show welcome example and auto-run it
setTimeout(() => {
  EXAMPLES['json-transform']();
  showToast('Welcome! Choose Run route to execute, or try a filed plan.');
  
  // Auto-run so user sees output immediately
  setTimeout(() => executeFlow(), 150);
}, 500);
