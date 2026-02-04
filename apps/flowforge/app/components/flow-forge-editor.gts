import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { service } from "@ember/service";
import type Owner from "@ember/owner";

import NodeCanvas from "./flow-forge/node-canvas";
import Sidebar from "./flow-forge/sidebar";
import Toolbar from "./flow-forge/toolbar";
import PreviewPanel from "./flow-forge/preview-panel";

import type FlowEngineService from "flowforge/services/flow-engine";
import type { FlowNode, Connection, NodeTypeRef } from "flowforge/types/flow";
import { toNodeTypeRef } from "flowforge/types/flow";

export interface FlowForgeEditorSignature {
  Element: HTMLDivElement;
  Args: Record<string, never>;
}

export default class FlowForgeEditor extends Component<FlowForgeEditorSignature> {
  @service declare flowEngine: FlowEngineService;

  @tracked nodes: FlowNode[] = [];
  @tracked connections: Connection[] = [];
  @tracked selectedNodeId: string | null = null;

  storageKey = "flowforge-state";

  constructor(owner: Owner, args: FlowForgeEditorSignature["Args"]) {
    super(owner, args);
    this.loadFromStorage();
  }

  get nodeTypesForPalette(): NodeTypeRef[] {
    return this.flowEngine.nodeTypes.map(toNodeTypeRef);
  }

  get selectedNode() {
    return this.nodes.find((n) => n.id === this.selectedNodeId) ?? null;
  }

  get selectedNodeTitle() {
    if (!this.selectedNode) return null;
    return this.flowEngine.getNodeType(this.selectedNode.type)?.title ?? this.selectedNode.type;
  }

  get executionResults() {
    return this.flowEngine.executionResults;
  }

  get displayOutputs() {
    return this.flowEngine.displayOutputs;
  }

  get isRunning() {
    return this.flowEngine.isRunning;
  }

  addNode = (typeId: string, x: number, y: number) => {
    const newNode = this.flowEngine.createNode(typeId, x, y);
    if (newNode) {
      this.nodes = [...this.nodes, newNode];
      this.saveToStorage();
    }
  };

  updateNodePosition = (nodeId: string, x: number, y: number) => {
    this.nodes = this.nodes.map((node) =>
      node.id === nodeId ? { ...node, x, y } : node
    );
    this.saveToStorage();
  };

  updateNodeField = (nodeId: string, fieldName: string, value: string) => {
    this.nodes = this.nodes.map((node) =>
      node.id === nodeId
        ? { ...node, fields: { ...node.fields, [fieldName]: value } }
        : node
    );
    this.saveToStorage();
  };

  selectNode = (nodeId: string | null) => {
    this.selectedNodeId = nodeId;
  };

  deleteNode = (nodeId: string) => {
    this.nodes = this.nodes.filter((n) => n.id !== nodeId);
    this.connections = this.connections.filter(
      (c) => c.sourceNodeId !== nodeId && c.targetNodeId !== nodeId
    );
    if (this.selectedNodeId === nodeId) {
      this.selectedNodeId = null;
    }
    this.saveToStorage();
  };

  addConnection = (
    sourceNodeId: string,
    sourcePort: string,
    targetNodeId: string,
    targetPort: string
  ) => {
    console.debug("[flowforge] addConnection", {
      sourceNodeId,
      sourcePort,
      targetNodeId,
      targetPort,
    });
    const withoutTarget = this.connections.filter(
      (c) => !(c.targetNodeId === targetNodeId && c.targetPort === targetPort)
    );

    const newConnection: Connection = {
      id: `conn-${Date.now()}`,
      sourceNodeId,
      sourcePort,
      targetNodeId,
      targetPort,
    };
    this.connections = [...withoutTarget, newConnection];
    this.saveToStorage();
  };

  deleteConnection = (connectionId: string) => {
    this.connections = this.connections.filter((c) => c.id !== connectionId);
    this.saveToStorage();
  };

  runFlow = async () => {
    console.debug("[flowforge] runFlow clicked", {
      nodes: this.nodes.map((node) => ({ id: node.id, type: node.type })),
      connections: this.connections.map((connection) => ({
        id: connection.id,
        sourceNodeId: connection.sourceNodeId,
        sourcePort: connection.sourcePort,
        targetNodeId: connection.targetNodeId,
        targetPort: connection.targetPort,
      })),
    });
    await this.flowEngine.runFlow(this.nodes, this.connections);
  };

  clearAll = () => {
    this.nodes = [];
    this.connections = [];
    this.selectedNodeId = null;
    this.flowEngine.clearResults();
    this.saveToStorage();
  };

  loadExample = (exampleId: string) => {
    const example = EXAMPLES[exampleId];
    if (example) {
      this.nodes = structuredClone(example.nodes);
      this.connections = structuredClone(example.connections);
      this.selectedNodeId = null;
      this.flowEngine.clearResults();
      this.saveToStorage();
    }
  };

  saveToStorage = () => {
    if (typeof window === "undefined") return;
    const payload = {
      nodes: this.nodes,
      connections: this.connections,
    };
    window.localStorage.setItem(this.storageKey, JSON.stringify(payload));
  };

  loadFromStorage = () => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(this.storageKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "nodes" in parsed &&
        "connections" in parsed
      ) {
        const payload = parsed as { nodes: FlowNode[]; connections: Connection[] };
        this.nodes = payload.nodes;
        this.connections = payload.connections;
      }
    } catch (error) {
      // Ignore invalid localStorage
    }
  };

  <template>
    <div class="flow-forge-editor" ...attributes>
      <Toolbar
        @onRun={{this.runFlow}}
        @onClear={{this.clearAll}}
        @onLoadExample={{this.loadExample}}
        @isRunning={{this.isRunning}}
      />
      <div class="editor-main">
        <Sidebar
          @nodeTypes={{this.nodeTypesForPalette}}
          @selectedNode={{this.selectedNode}}
          @onAddNode={{this.addNode}}
          @onFieldChange={{this.updateNodeField}}
        />
        <NodeCanvas
          @nodes={{this.nodes}}
          @connections={{this.connections}}
          @selectedNodeId={{this.selectedNodeId}}
          @executionResults={{this.executionResults}}
          @onNodeMove={{this.updateNodePosition}}
          @onNodeSelect={{this.selectNode}}
          @onNodeDelete={{this.deleteNode}}
          @onConnect={{this.addConnection}}
          @onDisconnect={{this.deleteConnection}}
          @onAddNode={{this.addNode}}
          @onFieldChange={{this.updateNodeField}}
        />
        <PreviewPanel
          @outputs={{this.displayOutputs}}
          @selectedNode={{this.selectedNode}}
          @selectedNodeTitle={{this.selectedNodeTitle}}
          @executionResults={{this.executionResults}}
        />
      </div>
      <footer class="app-footer">
        <p>Part of <a href="https://crunchybananas.github.io/shipyard-microtools/">Shipyard Microtools</a></p>
        <p class="footer-credit">
          Made with 🧡 by
          <a href="https://crunchybananas.com" target="_blank" rel="noopener">Crunchy Bananas</a>
          using <a href="https://emberjs.com" target="_blank" rel="noopener">Ember</a>
        </p>
      </footer>
    </div>
  </template>
}

// Example flows
const EXAMPLES: Record<string, { nodes: FlowNode[]; connections: Connection[] }> = {
  "json-transform": {
    nodes: [
      {
        id: "input-1",
        type: "json-input",
        x: 80,
        y: 100,
        fields: {
          value:
            '[\n  { "name": "Alice", "age": 25 },\n  { "name": "Bob", "age": 30 },\n  { "name": "Charlie", "age": 17 }\n]',
        },
      },
      {
        id: "filter-1",
        type: "filter",
        x: 340,
        y: 100,
        fields: { condition: "item.age >= 18" },
      },
      {
        id: "map-1",
        type: "map",
        x: 600,
        y: 100,
        fields: { expression: "item.name.toUpperCase()" },
      },
      {
        id: "display-1",
        type: "display",
        x: 860,
        y: 100,
        fields: {},
      },
    ],
    connections: [
      {
        id: "conn-1",
        sourceNodeId: "input-1",
        sourcePort: "out",
        targetNodeId: "filter-1",
        targetPort: "array",
      },
      {
        id: "conn-2",
        sourceNodeId: "filter-1",
        sourcePort: "result",
        targetNodeId: "map-1",
        targetPort: "array",
      },
      {
        id: "conn-3",
        sourceNodeId: "map-1",
        sourcePort: "result",
        targetNodeId: "display-1",
        targetPort: "data",
      },
    ],
  },
  "math-calc": {
    nodes: [
      {
        id: "num-1",
        type: "number-input",
        x: 80,
        y: 80,
        fields: { value: "10" },
      },
      {
        id: "num-2",
        type: "number-input",
        x: 80,
        y: 220,
        fields: { value: "5" },
      },
      {
        id: "math-1",
        type: "math",
        x: 340,
        y: 140,
        fields: { op: "*" },
      },
      {
        id: "display-1",
        type: "display",
        x: 600,
        y: 140,
        fields: {},
      },
    ],
    connections: [
      {
        id: "conn-1",
        sourceNodeId: "num-1",
        sourcePort: "out",
        targetNodeId: "math-1",
        targetPort: "a",
      },
      {
        id: "conn-2",
        sourceNodeId: "num-2",
        sourcePort: "out",
        targetNodeId: "math-1",
        targetPort: "b",
      },
      {
        id: "conn-3",
        sourceNodeId: "math-1",
        sourcePort: "result",
        targetNodeId: "display-1",
        targetPort: "data",
      },
    ],
  },
  "http-fetch": {
    nodes: [
      {
        id: "http-1",
        type: "http-input",
        x: 80,
        y: 100,
        fields: {
          url: "https://jsonplaceholder.typicode.com/users",
          method: "GET",
        },
      },
      {
        id: "map-1",
        type: "map",
        x: 380,
        y: 100,
        fields: { expression: "item.name" },
      },
      {
        id: "display-1",
        type: "display",
        x: 640,
        y: 100,
        fields: {},
      },
    ],
    connections: [
      {
        id: "conn-1",
        sourceNodeId: "http-1",
        sourcePort: "response",
        targetNodeId: "map-1",
        targetPort: "array",
      },
      {
        id: "conn-2",
        sourceNodeId: "map-1",
        sourcePort: "result",
        targetNodeId: "display-1",
        targetPort: "data",
      },
    ],
  },
};
