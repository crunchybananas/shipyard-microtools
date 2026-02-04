import Service from "@ember/service";
import { tracked } from "@glimmer/tracking";

import {
  NODE_TYPES,
  getNodeTypesList,
  getNodeTypesByCategory,
  type NodeTypeDefinition,
  type ExecutionResult,
} from "flowforge/types/node-types";
import type { FlowNode, Connection } from "flowforge/types/flow";

export default class FlowEngineService extends Service {
  @tracked executionResults: Map<string, ExecutionResult> = new Map();
  @tracked isRunning = false;
  @tracked displayOutputs: Array<{ nodeId: string; data: unknown }> = [];

  get nodeTypes(): NodeTypeDefinition[] {
    return getNodeTypesList();
  }

  get nodeTypesByCategory() {
    return getNodeTypesByCategory();
  }

  getNodeType(typeId: string): NodeTypeDefinition | undefined {
    return NODE_TYPES[typeId];
  }

  createNode(typeId: string, x: number, y: number): FlowNode | null {
    const nodeDef = NODE_TYPES[typeId];
    if (!nodeDef) return null;

    const fields: Record<string, string> = {};
    for (const field of nodeDef.fields) {
      fields[field.name] = field.default;
    }

    return {
      id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: typeId,
      x,
      y,
      fields,
    };
  }

  /**
   * Build a dependency graph and return nodes in topological order.
   * Returns null if there's a cycle.
   */
  topologicalSort(nodes: FlowNode[], connections: Connection[]): FlowNode[] | null {
    // Build adjacency list (node -> nodes it depends on)
    const inDegree = new Map<string, number>();
    const dependsOn = new Map<string, Set<string>>();

    for (const node of nodes) {
      inDegree.set(node.id, 0);
      dependsOn.set(node.id, new Set());
    }

    // For each connection, target depends on source
    for (const conn of connections) {
      const targetDeps = dependsOn.get(conn.targetNodeId);
      if (targetDeps && !targetDeps.has(conn.sourceNodeId)) {
        targetDeps.add(conn.sourceNodeId);
        inDegree.set(conn.targetNodeId, (inDegree.get(conn.targetNodeId) ?? 0) + 1);
      }
    }

    // Kahn's algorithm
    const queue: FlowNode[] = [];
    const result: FlowNode[] = [];

    // Start with nodes that have no dependencies
    for (const node of nodes) {
      if (inDegree.get(node.id) === 0) {
        queue.push(node);
      }
    }

    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(node);

      // Find nodes that depend on this one
      for (const [nodeId, deps] of dependsOn.entries()) {
        if (deps.has(node.id)) {
          const newDegree = (inDegree.get(nodeId) ?? 1) - 1;
          inDegree.set(nodeId, newDegree);
          if (newDegree === 0) {
            const nextNode = nodes.find((n) => n.id === nodeId);
            if (nextNode) queue.push(nextNode);
          }
        }
      }
    }

    // If we didn't process all nodes, there's a cycle
    if (result.length !== nodes.length) {
      console.error("Cycle detected in flow graph");
      return null;
    }

    return result;
  }

  /**
   * Execute the entire flow
   */
  runFlow = async (
    nodes: FlowNode[],
    connections: Connection[]
  ) => {
    console.debug("[flowforge] runFlow start", {
      nodes: nodes.map((node) => ({ id: node.id, type: node.type })),
      connections: connections.map((connection) => ({
        id: connection.id,
        sourceNodeId: connection.sourceNodeId,
        sourcePort: connection.sourcePort,
        targetNodeId: connection.targetNodeId,
        targetPort: connection.targetPort,
      })),
    });
    this.isRunning = true;
    this.executionResults = new Map();
    this.displayOutputs = [];

    const sortedNodes = this.topologicalSort(nodes, connections);
    if (!sortedNodes) {
      console.debug("[flowforge] runFlow aborted (cycle)");
      this.isRunning = false;
      return this.executionResults;
    }

    // Stores outputs for each node
    const nodeOutputs = new Map<string, Record<string, unknown>>();

    for (const node of sortedNodes) {
      console.debug("[flowforge] execute node", { nodeId: node.id, type: node.type });
      const result = await this.executeNode(node, connections, nodeOutputs);
      this.executionResults = new Map(this.executionResults).set(node.id, result);

      if (result.outputs) {
        nodeOutputs.set(node.id, result.outputs);

        // Capture display outputs
        if (result.outputs._display !== undefined) {
          this.displayOutputs = [
            ...this.displayOutputs,
            { nodeId: node.id, data: result.outputs._display },
          ];
        }
      }

      // Stop on error
      if (result.status === "error") {
        console.debug("[flowforge] execution halted on error", {
          nodeId: node.id,
          error: result.error,
        });
        break;
      }
    }

    this.isRunning = false;
    console.debug("[flowforge] runFlow complete", {
      results: this.executionResults.size,
      displayOutputs: this.displayOutputs.length,
    });
    return this.executionResults;
  }

  /**
   * Execute a single node
   */
  private async executeNode(
    node: FlowNode,
    connections: Connection[],
    nodeOutputs: Map<string, Record<string, unknown>>
  ): Promise<ExecutionResult> {
    const nodeDef = NODE_TYPES[node.type];
    if (!nodeDef) {
      return {
        nodeId: node.id,
        status: "error",
        error: `Unknown node type: ${node.type}`,
      };
    }

    // Mark as running
    const startTime = performance.now();

    // Gather inputs from connected nodes
    const inputs: Record<string, unknown> = {};
    for (const conn of connections) {
      if (conn.targetNodeId === node.id) {
        const sourceOutputs = nodeOutputs.get(conn.sourceNodeId);
        if (sourceOutputs) {
          inputs[conn.targetPort] = sourceOutputs[conn.sourcePort];
        }
      }
    }

    console.debug("[flowforge] node inputs", {
      nodeId: node.id,
      type: node.type,
      inputs,
      fields: node.fields,
    });

    try {
      const outputs = await nodeDef.execute(inputs, node.fields);
      const duration = performance.now() - startTime;

      console.debug("[flowforge] node outputs", {
        nodeId: node.id,
        type: node.type,
        outputs,
        duration,
      });

      return {
        nodeId: node.id,
        status: "success",
        outputs,
        duration,
      };
    } catch (e) {
      const duration = performance.now() - startTime;
      console.debug("[flowforge] node error", {
        nodeId: node.id,
        type: node.type,
        error: (e as Error).message,
        duration,
      });
      return {
        nodeId: node.id,
        status: "error",
        error: (e as Error).message,
        duration,
      };
    }
  }

  clearResults = () => {
    this.executionResults = new Map();
    this.displayOutputs = [];
  };
}

declare module "@ember/service" {
  interface Registry {
    "flow-engine": FlowEngineService;
  }
}
