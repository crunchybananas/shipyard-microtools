import type { NodeTypeDefinition, ExecutionResult } from "./node-types";

export interface FlowNode {
  id: string;
  type: string;
  x: number;
  y: number;
  fields: Record<string, string>;
}

export interface Connection {
  id: string;
  sourceNodeId: string;
  sourcePort: string;
  targetNodeId: string;
  targetPort: string;
}

export interface Flow {
  id: string;
  name: string;
  nodes: FlowNode[];
  connections: Connection[];
  createdAt: string;
  updatedAt: string;
}

export interface FlowState {
  nodes: FlowNode[];
  connections: Connection[];
  selectedNodeId: string | null;
  executionResults: Map<string, ExecutionResult>;
  isRunning: boolean;
}

// Compact type reference for palette display
export interface NodeTypeRef {
  id: string;
  icon: string;
  title: string;
  category: string;
  color: string;
}

// Convert a NodeTypeDefinition to a palette-friendly reference
export function toNodeTypeRef(def: NodeTypeDefinition): NodeTypeRef {
  const categoryColors: Record<string, string> = {
    input: "#3fb950",
    transform: "#58a6ff",
    logic: "#d29922",
    output: "#f85149",
  };

  return {
    id: def.id,
    icon: def.icon,
    title: def.title,
    category: def.category,
    color: categoryColors[def.category] ?? "#8b949e",
  };
}
