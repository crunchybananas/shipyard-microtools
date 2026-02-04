// Node Type Definitions for FlowForge

export interface PortDefinition {
  name: string;
  type: "any" | "array" | "number" | "string" | "boolean" | "object";
}

export interface FieldDefinition {
  name: string;
  type: "text" | "textarea" | "number" | "select";
  default: string;
  placeholder?: string;
  options?: string[];
}

export interface NodeTypeDefinition {
  id: string;
  icon: string;
  title: string;
  category: "input" | "transform" | "logic" | "output";
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  fields: FieldDefinition[];
  execute: (
    inputs: Record<string, unknown>,
    fields: Record<string, string>,
  ) => Promise<Record<string, unknown>> | Record<string, unknown>;
}

export interface ExecutionResult {
  nodeId: string;
  status: "pending" | "running" | "success" | "error";
  outputs?: Record<string, unknown>;
  error?: string;
  duration?: number;
}

// Category colors for styling
export const CATEGORY_COLORS: Record<string, string> = {
  input: "#3fb950",
  transform: "#58a6ff",
  logic: "#d29922",
  output: "#f85149",
};

// All node type definitions matching the vanilla app
export const NODE_TYPES: Record<string, NodeTypeDefinition> = {
  "json-input": {
    id: "json-input",
    icon: "📥",
    title: "JSON Input",
    category: "input",
    inputs: [],
    outputs: [{ name: "out", type: "any" }],
    fields: [
      {
        name: "value",
        type: "textarea",
        default:
          '[\n  { "name": "Alice", "age": 25 },\n  { "name": "Bob", "age": 30 }\n]',
      },
    ],
    execute: (_inputs, fields) => {
      try {
        return { out: JSON.parse(fields.value ?? "null") };
      } catch (e) {
        throw new Error("Invalid JSON: " + (e as Error).message);
      }
    },
  },

  "text-input": {
    id: "text-input",
    icon: "📝",
    title: "Text Input",
    category: "input",
    inputs: [],
    outputs: [{ name: "out", type: "string" }],
    fields: [{ name: "value", type: "text", default: "Hello World" }],
    execute: (_inputs, fields) => ({ out: fields.value ?? "" }),
  },

  "number-input": {
    id: "number-input",
    icon: "🔢",
    title: "Number",
    category: "input",
    inputs: [],
    outputs: [{ name: "out", type: "number" }],
    fields: [{ name: "value", type: "number", default: "42" }],
    execute: (_inputs, fields) => ({
      out: parseFloat(fields.value ?? "0") || 0,
    }),
  },

  "http-input": {
    id: "http-input",
    icon: "🌐",
    title: "HTTP Request",
    category: "input",
    inputs: [],
    outputs: [{ name: "response", type: "any" }],
    fields: [
      {
        name: "url",
        type: "text",
        default: "https://jsonplaceholder.typicode.com/users/1",
      },
      {
        name: "method",
        type: "select",
        options: ["GET", "POST"],
        default: "GET",
      },
    ],
    execute: async (_inputs, fields) => {
      const res = await fetch(fields.url ?? "", {
        method: fields.method ?? "GET",
      });
      const data = await res.json();
      return { response: data };
    },
  },

  map: {
    id: "map",
    icon: "🔄",
    title: "Map",
    category: "transform",
    inputs: [{ name: "array", type: "array" }],
    outputs: [{ name: "result", type: "array" }],
    fields: [
      {
        name: "expression",
        type: "text",
        default: "item",
        placeholder: "e.g. item.name or item * 2",
      },
    ],
    execute: (inputs, fields) => {
      const arr = Array.isArray(inputs.array) ? inputs.array : [inputs.array];
      const expr = (fields.expression ?? "item").trim();
      const result = arr.map((item) => {
        try {
          return new Function("item", "index", `return ${expr}`)(item);
        } catch {
          return item;
        }
      });
      return { result };
    },
  },

  filter: {
    id: "filter",
    icon: "🔍",
    title: "Filter",
    category: "transform",
    inputs: [{ name: "array", type: "array" }],
    outputs: [{ name: "result", type: "array" }],
    fields: [
      {
        name: "condition",
        type: "text",
        default: "item.age > 18",
        placeholder: "e.g. item > 5 or item.active",
      },
    ],
    execute: (inputs, fields) => {
      const arr = Array.isArray(inputs.array) ? inputs.array : [inputs.array];
      const cond = (fields.condition ?? "true").trim();
      const result = arr.filter((item) => {
        try {
          return new Function("item", "index", `return ${cond}`)(item);
        } catch {
          return true;
        }
      });
      return { result };
    },
  },

  jsonpath: {
    id: "jsonpath",
    icon: "📍",
    title: "JSONPath",
    category: "transform",
    inputs: [{ name: "json", type: "any" }],
    outputs: [{ name: "result", type: "any" }],
    fields: [
      {
        name: "path",
        type: "text",
        default: "items",
        placeholder: "data.items[0]",
      },
    ],
    execute: (inputs, fields) => {
      const path = (fields.path ?? "").trim();
      let result = inputs.json;
      const parts = path.split(/\.|\[|\]/).filter(Boolean);
      for (const part of parts) {
        if (result == null) break;
        result = (result as Record<string, unknown>)[part];
      }
      return { result };
    },
  },

  merge: {
    id: "merge",
    icon: "🔀",
    title: "Merge",
    category: "transform",
    inputs: [
      { name: "a", type: "any" },
      { name: "b", type: "any" },
    ],
    outputs: [{ name: "result", type: "any" }],
    fields: [],
    execute: (inputs) => {
      if (Array.isArray(inputs.a) && Array.isArray(inputs.b)) {
        return { result: [...inputs.a, ...inputs.b] };
      }
      if (
        typeof inputs.a === "object" &&
        inputs.a !== null &&
        typeof inputs.b === "object" &&
        inputs.b !== null
      ) {
        return {
          result: {
            ...(inputs.a as Record<string, unknown>),
            ...(inputs.b as Record<string, unknown>),
          },
        };
      }
      return { result: [inputs.a, inputs.b] };
    },
  },

  "if-else": {
    id: "if-else",
    icon: "❓",
    title: "If/Else",
    category: "logic",
    inputs: [
      { name: "condition", type: "boolean" },
      { name: "value", type: "any" },
    ],
    outputs: [
      { name: "true", type: "any" },
      { name: "false", type: "any" },
    ],
    fields: [],
    execute: (inputs) => {
      if (inputs.condition) {
        return { true: inputs.value, false: undefined };
      }
      return { true: undefined, false: inputs.value };
    },
  },

  switch: {
    id: "switch",
    icon: "🔀",
    title: "Switch",
    category: "logic",
    inputs: [{ name: "value", type: "any" }],
    outputs: [
      { name: "case1", type: "any" },
      { name: "case2", type: "any" },
      { name: "default", type: "any" },
    ],
    fields: [
      { name: "case1", type: "text", default: "a" },
      { name: "case2", type: "text", default: "b" },
    ],
    execute: (inputs, fields) => {
      const val = String(inputs.value);
      if (val === fields.case1)
        return { case1: inputs.value, case2: undefined, default: undefined };
      if (val === fields.case2)
        return { case1: undefined, case2: inputs.value, default: undefined };
      return { case1: undefined, case2: undefined, default: inputs.value };
    },
  },

  math: {
    id: "math",
    icon: "➕",
    title: "Math",
    category: "logic",
    inputs: [
      { name: "a", type: "number" },
      { name: "b", type: "number" },
    ],
    outputs: [{ name: "result", type: "number" }],
    fields: [
      {
        name: "op",
        type: "select",
        options: ["+", "-", "*", "/", "%", "^"],
        default: "+",
      },
    ],
    execute: (inputs, fields) => {
      const a = parseFloat(String(inputs.a)) || 0;
      const b = parseFloat(String(inputs.b)) || 0;
      let result: number;
      switch (fields.op) {
        case "+":
          result = a + b;
          break;
        case "-":
          result = a - b;
          break;
        case "*":
          result = a * b;
          break;
        case "/":
          result = b !== 0 ? a / b : 0;
          break;
        case "%":
          result = a % b;
          break;
        case "^":
          result = Math.pow(a, b);
          break;
        default:
          result = a + b;
      }
      return { result };
    },
  },

  compare: {
    id: "compare",
    icon: "⚖️",
    title: "Compare",
    category: "logic",
    inputs: [
      { name: "a", type: "any" },
      { name: "b", type: "any" },
    ],
    outputs: [{ name: "result", type: "boolean" }],
    fields: [
      {
        name: "op",
        type: "select",
        options: ["==", "!=", ">", "<", ">=", "<="],
        default: "==",
      },
    ],
    execute: (inputs, fields) => {
      const a = inputs.a;
      const b = inputs.b;
      let result: boolean;
      switch (fields.op) {
        case "==":
          result = a == b;
          break;
        case "!=":
          result = a != b;
          break;
        case ">":
          result = (a as number) > (b as number);
          break;
        case "<":
          result = (a as number) < (b as number);
          break;
        case ">=":
          result = (a as number) >= (b as number);
          break;
        case "<=":
          result = (a as number) <= (b as number);
          break;
        default:
          result = a == b;
      }
      return { result };
    },
  },

  display: {
    id: "display",
    icon: "📤",
    title: "Display",
    category: "output",
    inputs: [{ name: "data", type: "any" }],
    outputs: [],
    fields: [],
    execute: (inputs) => {
      console.log("Display:", inputs.data);
      return { _display: inputs.data };
    },
  },

  console: {
    id: "console",
    icon: "🖥️",
    title: "Console Log",
    category: "output",
    inputs: [{ name: "data", type: "any" }],
    outputs: [],
    fields: [{ name: "label", type: "text", default: "Output" }],
    execute: (inputs, fields) => {
      console.log(`[${fields.label ?? "Output"}]`, inputs.data);
      return { _display: inputs.data };
    },
  },

  download: {
    id: "download",
    icon: "💾",
    title: "Download",
    category: "output",
    inputs: [{ name: "data", type: "any" }],
    outputs: [],
    fields: [{ name: "filename", type: "text", default: "output.json" }],
    execute: (inputs, fields) => {
      const content =
        typeof inputs.data === "string"
          ? inputs.data
          : JSON.stringify(inputs.data, null, 2);
      const blob = new Blob([content], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fields.filename ?? "output.json";
      a.click();
      URL.revokeObjectURL(url);
      return { _display: `Downloaded: ${fields.filename}` };
    },
  },
};

// Helper to get all node types as array sorted by category
export function getNodeTypesList(): NodeTypeDefinition[] {
  return Object.values(NODE_TYPES);
}

// Get node types grouped by category
export function getNodeTypesByCategory(): Record<string, NodeTypeDefinition[]> {
  const grouped: Record<string, NodeTypeDefinition[]> = {
    input: [],
    transform: [],
    logic: [],
    output: [],
  };

  for (const nodeDef of Object.values(NODE_TYPES)) {
    grouped[nodeDef.category]?.push(nodeDef);
  }

  return grouped;
}
