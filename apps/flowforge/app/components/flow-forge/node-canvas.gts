import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import { concat, fn } from "@ember/helper";
import { modifier } from "ember-modifier";
import { service } from "@ember/service";
import style from "flowforge/helpers/style";

import type { FlowNode, Connection } from "flowforge/types/flow";
import type { ExecutionResult, NodeTypeDefinition } from "flowforge/types/node-types";
import type FlowEngineService from "flowforge/services/flow-engine";

export interface NodeCanvasSignature {
  Element: HTMLDivElement;
  Args: {
    nodes: FlowNode[];
    connections: Connection[];
    selectedNodeId: string | null;
    executionResults: Map<string, ExecutionResult>;
    onNodeMove: (nodeId: string, x: number, y: number) => void;
    onNodeSelect: (nodeId: string | null) => void;
    onNodeDelete: (nodeId: string) => void;
    onConnect: (
      sourceNodeId: string,
      sourcePort: string,
      targetNodeId: string,
      targetPort: string
    ) => void;
    onDisconnect: (connectionId: string) => void;
    onAddNode: (typeId: string, x: number, y: number) => void;
    onFieldChange: (nodeId: string, fieldName: string, value: string) => void;
  };
}

interface DragState {
  nodeId: string;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
}

interface PendingConnection {
  nodeId: string;
  portName: string;
  portType: string;
  isOutput: boolean;
  startX: number;
  startY: number;
}

interface PanState {
  startX: number;
  startY: number;
  startOffsetX: number;
  startOffsetY: number;
}

// Modifier to sync input value without losing focus
const syncValue = modifier((element: HTMLInputElement | HTMLTextAreaElement, [value]: [string]) => {
  // Only update if the element is not focused (user isn't typing)
  if (document.activeElement !== element && element.value !== value) {
    element.value = value ?? "";
  }
});

export default class NodeCanvas extends Component<NodeCanvasSignature> {
  @service declare flowEngine: FlowEngineService;

  @tracked dragState: DragState | null = null;
  @tracked pendingConnection: PendingConnection | null = null;
  @tracked mousePos = { x: 0, y: 0 };
  @tracked viewOffset = { x: 0, y: 0 };
  @tracked viewScale = 1;
  @tracked panState: PanState | null = null;
  @tracked isSpacePressed = false;

  canvasElement: HTMLElement | null = null;

  setupCanvas = modifier((element: HTMLElement) => {
    this.canvasElement = element;

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      const nodeType = e.dataTransfer?.getData("nodeType");
      if (nodeType) {
        const { x, y } = this.screenToWorld(e.clientX, e.clientY);
        this.args.onAddNode(nodeType, x, y);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (this.panState) {
        const dx = e.clientX - this.panState.startX;
        const dy = e.clientY - this.panState.startY;
        this.viewOffset = {
          x: this.panState.startOffsetX + dx,
          y: this.panState.startOffsetY + dy,
        };
      }
      if (!this.pendingConnection) return;
      this.mousePos = this.getCanvasPoint(e.clientX, e.clientY);
      console.debug("[flowforge] connection drag move", {
        pointerId: e.pointerId,
        mousePos: this.mousePos,
      });
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button === 1 || (e.button === 0 && this.isSpacePressed)) {
        if (e.target === element) {
          e.preventDefault();
          this.panState = {
            startX: e.clientX,
            startY: e.clientY,
            startOffsetX: this.viewOffset.x,
            startOffsetY: this.viewOffset.y,
          };
        }
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (this.panState) {
        this.panState = null;
      }
      if (!this.pendingConnection) return;

      const captureTarget = e.target as HTMLElement | null;
      if (captureTarget?.releasePointerCapture) {
        try {
          captureTarget.releasePointerCapture(e.pointerId);
        } catch {
          // Ignore if capture was not set
        }
      }

      const target = (e.target as HTMLElement | null) ?? null;
      const elementsAtPoint = document.elementsFromPoint(e.clientX, e.clientY);
      const portCandidates = elementsAtPoint
        .map((el) => (el as HTMLElement).closest(".port") as HTMLElement | null)
        .filter((el): el is HTMLElement => Boolean(el));
      const uniquePorts = Array.from(new Set(portCandidates));
      const portEl = uniquePorts.find((el) => {
        const nodeId = el.dataset.nodeId;
        const portName = el.dataset.portName;
        const isOutput = el.dataset.isOutput === "true";
        if (!nodeId || !portName) return false;
        if (nodeId === this.pendingConnection?.nodeId && portName === this.pendingConnection?.portName) {
          return false;
        }
        return isOutput !== this.pendingConnection?.isOutput;
      });

      console.debug("[flowforge] connection drag up", {
        pointerId: e.pointerId,
        clientX: e.clientX,
        clientY: e.clientY,
        targetTag: target?.tagName ?? null,
        hitPort: portEl?.dataset ?? null,
        portCandidates: uniquePorts.map((el) => el.dataset),
      });

      if (portEl) {
        const nodeId = portEl.dataset.nodeId;
        const portName = portEl.dataset.portName;
        const isOutput = portEl.dataset.isOutput === "true";

        if (
          nodeId &&
          portName &&
          nodeId !== this.pendingConnection.nodeId &&
          isOutput !== this.pendingConnection.isOutput
        ) {
          console.debug("[flowforge] connection valid", {
            from: this.pendingConnection,
            to: { nodeId, portName, isOutput },
          });
          if (this.pendingConnection.isOutput) {
            this.args.onConnect(
              this.pendingConnection.nodeId,
              this.pendingConnection.portName,
              nodeId,
              portName
            );
          } else {
            this.args.onConnect(
              nodeId,
              portName,
              this.pendingConnection.nodeId,
              this.pendingConnection.portName
            );
          }
        } else {
          console.debug("[flowforge] connection rejected", {
            from: this.pendingConnection,
            to: { nodeId, portName, isOutput },
          });
        }
      }

      this.pendingConnection = null;
    };

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = element.getBoundingClientRect();
      const worldPoint = this.screenToWorld(e.clientX, e.clientY);
      const delta = Math.max(-1, Math.min(1, e.deltaY * 0.01));
      const nextScale = clamp(this.viewScale * (1 - delta), 0.4, 2.5);
      this.viewScale = nextScale;
      this.viewOffset = {
        x: e.clientX - rect.left - worldPoint.x * nextScale,
        y: e.clientY - rect.top - worldPoint.y * nextScale,
      };
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === " ") {
        this.isSpacePressed = true;
      }
      if (e.key === "Escape" && this.pendingConnection) {
        this.pendingConnection = null;
        return;
      }
    };

    element.addEventListener("drop", handleDrop);
    element.addEventListener("dragover", handleDragOver);
    element.addEventListener("pointerdown", handlePointerDown);
    element.addEventListener("wheel", handleWheel, { passive: false });
    document.addEventListener("pointermove", handlePointerMove, true);
    document.addEventListener("pointerup", handlePointerUp, true);
    window.addEventListener("keydown", handleKeyDown);

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === " ") {
        this.isSpacePressed = false;
      }
    };
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      element.removeEventListener("drop", handleDrop);
      element.removeEventListener("dragover", handleDragOver);
      element.removeEventListener("pointerdown", handlePointerDown);
      element.removeEventListener("wheel", handleWheel);
      document.removeEventListener("pointermove", handlePointerMove, true);
      document.removeEventListener("pointerup", handlePointerUp, true);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      this.canvasElement = null;
    };
  });

  getNodeDef = (node: FlowNode): NodeTypeDefinition | undefined => {
    return this.flowEngine.getNodeType(node.type);
  };


  get layerTransformValue() {
    return `translate(${this.viewOffset.x}px, ${this.viewOffset.y}px) scale(${this.viewScale})`;
  }

  getNodeIcon = (node: FlowNode) => {
    return this.getNodeDef(node)?.icon ?? "📦";
  };

  getNodeTitle = (node: FlowNode) => {
    return this.getNodeDef(node)?.title ?? node.type;
  };

  getNodeInputs = (node: FlowNode) => {
    return this.getNodeDef(node)?.inputs ?? [];
  };

  getNodeOutputs = (node: FlowNode) => {
    return this.getNodeDef(node)?.outputs ?? [];
  };

  getNodeFields = (node: FlowNode) => {
    return this.getNodeDef(node)?.fields ?? [];
  };

  hasNodeFields = (node: FlowNode) => {
    return this.getNodeFields(node).length > 0;
  };

  getNodeFieldValue = (node: FlowNode, fieldName: string) => {
    return node.fields?.[fieldName] ?? "";
  };

  getExecutionStatus = (nodeId: string) => {
    return this.args.executionResults.get(nodeId)?.status ?? null;
  };

  handleCanvasClick = (event: MouseEvent) => {
    if (event.target === event.currentTarget) {
      this.args.onNodeSelect(null);
    }
  };

  handleNodeMouseDown = (nodeId: string, event: MouseEvent) => {
    // Don't start drag if clicking on a port
    const target = event.target as HTMLElement;
    if (target.closest(".port")) return;

    event.stopPropagation();
    const node = this.args.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const pointer = this.screenToWorld(event.clientX, event.clientY);
    this.dragState = {
      nodeId,
      startX: node.x,
      startY: node.y,
      offsetX: pointer.x - node.x,
      offsetY: pointer.y - node.y,
    };

    this.args.onNodeSelect(nodeId);

    const handleMouseMove = (e: MouseEvent) => {
      if (this.dragState) {
        const pointerMove = this.screenToWorld(e.clientX, e.clientY);
        const newX = pointerMove.x - this.dragState.offsetX;
        const newY = pointerMove.y - this.dragState.offsetY;
        this.args.onNodeMove(this.dragState.nodeId, newX, newY);
      }
    };

    const handleMouseUp = () => {
      this.dragState = null;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  handlePortPointerDown = (
    nodeId: string,
    portName: string,
    portType: string,
    isOutput: boolean,
    portIndex: number,
    event: PointerEvent
  ) => {
    event.stopPropagation();
    event.preventDefault();

    console.debug("[flowforge] port pointerdown", {
      nodeId,
      portName,
      portType,
      isOutput,
      portIndex,
      pointerId: event.pointerId,
    });

    const target = event.currentTarget as HTMLElement | null;
    if (target?.setPointerCapture) {
      target.setPointerCapture(event.pointerId);
    }

    const node = this.args.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    // Calculate port position
    const { x, y } = this.getPortPosition(node, isOutput, portIndex, portName);

    this.pendingConnection = {
      nodeId,
      portName,
      portType,
      isOutput,
      startX: x,
      startY: y,
    };

    this.mousePos = { x, y };
  };

  handleNodeFieldInput = (nodeId: string, fieldName: string, event: Event) => {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    this.args.onFieldChange(nodeId, fieldName, target.value);
  };

  handleConnectionClick = (connectionId: string, event: MouseEvent) => {
    event.stopPropagation();
    this.args.onDisconnect(connectionId);
  };

  getPortPosition = (
    node: FlowNode,
    isOutput: boolean,
    portIndex: number,
    portName?: string
  ) => {
    if (portName) {
      const domPos = this.getPortPositionFromDom(node.id, portName, isOutput);
      if (domPos) return domPos;
    }
    const nodeWidth = 180;
    const headerHeight = 36;
    const portSpacing = 20;
    const portOffset = 8;

    const worldX = isOutput ? node.x + nodeWidth : node.x;
    const worldY = node.y + headerHeight + portOffset + portIndex * portSpacing;
    return this.worldToScreen(worldX, worldY);
  };

  getConnectionPath = (connection: Connection) => {
    const sourceNode = this.args.nodes.find(
      (n) => n.id === connection.sourceNodeId
    );
    const targetNode = this.args.nodes.find(
      (n) => n.id === connection.targetNodeId
    );

    if (!sourceNode || !targetNode) return "";

    // Find port indices
    const sourceDef = this.getNodeDef(sourceNode);
    const targetDef = this.getNodeDef(targetNode);

    const sourcePortIndex = sourceDef?.outputs.findIndex(
      (p) => p.name === connection.sourcePort
    ) ?? 0;
    const targetPortIndex = targetDef?.inputs.findIndex(
      (p) => p.name === connection.targetPort
    ) ?? 0;

    const start = this.getPortPosition(
      sourceNode,
      true,
      sourcePortIndex,
      connection.sourcePort
    );
    const end = this.getPortPosition(
      targetNode,
      false,
      targetPortIndex,
      connection.targetPort
    );

    return this.createBezierPath(start.x, start.y, end.x, end.y);
  };

  getConnectionColor = (connection: Connection) => {
    const sourceNode = this.args.nodes.find(
      (n) => n.id === connection.sourceNodeId
    );
    if (!sourceNode) return PORT_TYPE_COLORS.any;
    const sourceDef = this.getNodeDef(sourceNode);
    const portType =
      sourceDef?.outputs.find((p) => p.name === connection.sourcePort)?.type ??
      "any";
    return PORT_TYPE_COLORS[portType] ?? PORT_TYPE_COLORS.any;
  };

  get pendingConnectionPath() {
    if (!this.pendingConnection) return "";

    const { startX, startY, isOutput } = this.pendingConnection;

    if (isOutput) {
      return this.createBezierPath(
        startX,
        startY,
        this.mousePos.x,
        this.mousePos.y
      );
    } else {
      return this.createBezierPath(
        this.mousePos.x,
        this.mousePos.y,
        startX,
        startY
      );
    }
  }

  get pendingConnectionColor() {
    if (!this.pendingConnection) return PORT_TYPE_COLORS.any;
    return PORT_TYPE_COLORS[this.pendingConnection.portType] ?? PORT_TYPE_COLORS.any;
  }

  isPortConnected = (nodeId: string, portName: string, isOutput: boolean) => {
    return this.args.connections.some((connection) => {
      if (isOutput) {
        return connection.sourceNodeId === nodeId && connection.sourcePort === portName;
      }
      return connection.targetNodeId === nodeId && connection.targetPort === portName;
    });
  };

  createBezierPath = (x1: number, y1: number, x2: number, y2: number) => {
    const dx = Math.abs(x2 - x1);
    const controlOffset = Math.min(dx * 0.5, 100);

    return `M ${x1} ${y1} C ${x1 + controlOffset} ${y1}, ${x2 - controlOffset} ${y2}, ${x2} ${y2}`;
  };

  getCanvasPoint = (clientX: number, clientY: number) => {
    if (!this.canvasElement) return { x: clientX, y: clientY };
    const rect = this.canvasElement.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  screenToWorld = (clientX: number, clientY: number) => {
    if (!this.canvasElement) return { x: clientX, y: clientY };
    const rect = this.canvasElement.getBoundingClientRect();
    return {
      x: (clientX - rect.left - this.viewOffset.x) / this.viewScale,
      y: (clientY - rect.top - this.viewOffset.y) / this.viewScale,
    };
  };

  worldToScreen = (x: number, y: number) => {
    return {
      x: x * this.viewScale + this.viewOffset.x,
      y: y * this.viewScale + this.viewOffset.y,
    };
  };

  getPortPositionFromDom = (nodeId: string, portName: string, isOutput: boolean) => {
    if (!this.canvasElement) return null;
    const escapedNodeId = cssEscape(nodeId);
    const escapedPortName = cssEscape(portName);
    const selector =
      `.port[data-node-id="${escapedNodeId}"]` +
      `[data-port-name="${escapedPortName}"]` +
      `[data-is-output="${isOutput}"] .port-dot`;
    const dot = this.canvasElement.querySelector(selector) as HTMLElement | null;
    if (!dot) return null;
    const dotRect = dot.getBoundingClientRect();
    const canvasRect = this.canvasElement.getBoundingClientRect();
    return {
      x: dotRect.left + dotRect.width / 2 - canvasRect.left,
      y: dotRect.top + dotRect.height / 2 - canvasRect.top,
    };
  };

  <template>
    <div
      class="node-canvas"
      {{this.setupCanvas}}
      {{on "click" this.handleCanvasClick}}
      ...attributes
    >
      <svg class="connections-layer">
        {{#each @connections as |connection|}}
          <path
            class="connection-path"
            d={{this.getConnectionPath connection}}
            style={{style stroke=(this.getConnectionColor connection)}}
            {{on "click" (fn this.handleConnectionClick connection.id)}}
          />
        {{/each}}
        {{#if this.pendingConnection}}
          <path
            class="connection-path pending"
            d={{this.pendingConnectionPath}}
            style={{style stroke=this.pendingConnectionColor}}
          />
        {{/if}}
      </svg>

      <div class="nodes-layer" style={{style transform=this.layerTransformValue}}>
        {{#each @nodes as |node|}}
          <div
            class="flow-node
              {{if (eq @selectedNodeId node.id) 'selected'}}
              {{if (eq (this.getExecutionStatus node.id) 'success') 'status-success'}}
              {{if (eq (this.getExecutionStatus node.id) 'error') 'status-error'}}
              {{if (eq (this.getExecutionStatus node.id) 'running') 'status-running'}}"
            style={{style left=(concat node.x "px") top=(concat node.y "px")}}
            {{on "mousedown" (fn this.handleNodeMouseDown node.id)}}
          >
            <div class="node-header">
              <span class="node-icon">{{this.getNodeIcon node}}</span>
              <span class="node-title">{{this.getNodeTitle node}}</span>
            </div>
            {{#if (this.hasNodeFields node)}}
              <div class="node-body">
                {{#each (this.getNodeFields node) as |field|}}
                  <div class="node-field">
                    <label>{{field.name}}</label>
                    {{#if (eq field.type "textarea")}}
                      <textarea
                        placeholder={{field.placeholder}}
                        {{syncValue (this.getNodeFieldValue node field.name)}}
                        {{on "input" (fn this.handleNodeFieldInput node.id field.name)}}
                      ></textarea>
                    {{else if (eq field.type "select")}}
                      <select
                        {{on "change" (fn this.handleNodeFieldInput node.id field.name)}}
                      >
                        {{#each field.options as |opt|}}
                          <option
                            value={{opt}}
                            selected={{eq opt (this.getNodeFieldValue node field.name)}}
                          >
                            {{opt}}
                          </option>
                        {{/each}}
                      </select>
                    {{else}}
                      <input
                        type={{if (eq field.type "number") "number" "text"}}
                        placeholder={{field.placeholder}}
                        {{syncValue (this.getNodeFieldValue node field.name)}}
                        {{on "input" (fn this.handleNodeFieldInput node.id field.name)}}
                      />
                    {{/if}}
                  </div>
                {{/each}}
              </div>
            {{/if}}
            <div class="node-ports">
              <div class="ports-in">
                {{#each (this.getNodeInputs node) as |port index|}}
                  <div
                    class="port"
                    data-node-id={{node.id}}
                    data-port-name={{port.name}}
                    data-port-type={{port.type}}
                    data-is-output="false"
                    {{on "pointerdown" (fn this.handlePortPointerDown node.id port.name port.type false index)}}
                  >
                    <div class="port-dot {{if (this.isPortConnected node.id port.name false) 'connected'}}"></div>
                    <span class="port-label">{{port.name}}</span>
                  </div>
                {{/each}}
              </div>
              <div class="ports-out">
                {{#each (this.getNodeOutputs node) as |port index|}}
                  <div
                    class="port"
                    data-node-id={{node.id}}
                    data-port-name={{port.name}}
                    data-port-type={{port.type}}
                    data-is-output="true"
                    {{on "pointerdown" (fn this.handlePortPointerDown node.id port.name port.type true index)}}
                  >
                    <span class="port-label">{{port.name}}</span>
                    <div class="port-dot {{if (this.isPortConnected node.id port.name true) 'connected'}}"></div>
                  </div>
                {{/each}}
              </div>
            </div>
          </div>
        {{/each}}
      </div>
    </div>
  </template>
}

function eq(a: unknown, b: unknown): boolean {
  return a === b;
}

function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/[^a-zA-Z0-9_-]/g, "\\$");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const PORT_TYPE_COLORS: Record<string, string> = {
  string: "var(--port-string)",
  number: "var(--port-number)",
  boolean: "var(--port-boolean)",
  array: "var(--port-array)",
  object: "var(--port-object)",
  any: "var(--port-any)",
};
