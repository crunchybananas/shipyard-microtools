import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import { htmlSafe } from "@ember/template";

type SafeString = ReturnType<typeof htmlSafe>;

function syntaxHighlight(json: string): string {
  const escaped = json
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = "number";
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? "key" : "string";
      } else if (/true|false/.test(match)) {
        cls = "boolean";
      } else if (/null/.test(match)) {
        cls = "null";
      }
      return `<span class="${cls}">${match}</span>`;
    },
  );
}

function childPathFor(parent: string, key: string | number): string {
  const base = parent || "$";
  if (typeof key === "number") return `${base}[${key}]`;
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)) return `${base}.${key}`;
  return `${base}[${JSON.stringify(key)}]`;
}

// ── TypeScript type generator ──────────────────────────────────

type TypeNode =
  | { kind: "null" }
  | { kind: "boolean" }
  | { kind: "number" }
  | { kind: "string" }
  | { kind: "unknown" }
  | { kind: "array"; element: TypeNode }
  | { kind: "object"; fields: TypeField[] }
  | { kind: "union"; variants: TypeNode[] };

interface TypeField {
  key: string;
  type: TypeNode;
  optional: boolean;
}

function inferType(value: unknown): TypeNode {
  if (value === null) return { kind: "null" };
  if (typeof value === "boolean") return { kind: "boolean" };
  if (typeof value === "number") return { kind: "number" };
  if (typeof value === "string") return { kind: "string" };
  if (Array.isArray(value)) {
    if (value.length === 0)
      return { kind: "array", element: { kind: "unknown" } };
    const elementTypes = value.map((v) => inferType(v));
    return { kind: "array", element: mergeTypes(elementTypes) };
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const fields: TypeField[] = [];
    for (const [k, v] of Object.entries(obj)) {
      fields.push({ key: k, type: inferType(v), optional: false });
    }
    return { kind: "object", fields };
  }
  return { kind: "unknown" };
}

function typeKey(node: TypeNode): string {
  switch (node.kind) {
    case "array":
      return `array<${typeKey(node.element)}>`;
    case "object":
      return `{${node.fields.map((f) => `${f.key}${f.optional ? "?" : ""}:${typeKey(f.type)}`).join(",")}}`;
    case "union":
      return `(${[...new Set(node.variants.map(typeKey))].sort().join("|")})`;
    default:
      return node.kind;
  }
}

function mergeTypes(types: TypeNode[]): TypeNode {
  if (types.length === 0) return { kind: "unknown" };
  if (types.length === 1) return types[0]!;
  const allObjects = types.every((t) => t.kind === "object");
  if (allObjects) {
    const objects = types as Array<{ kind: "object"; fields: TypeField[] }>;
    const fieldTypes = new Map<string, { types: TypeNode[]; presence: number }>();
    for (const o of objects) {
      for (const f of o.fields) {
        const entry =
          fieldTypes.get(f.key) ?? { types: [], presence: 0 };
        entry.types.push(f.type);
        entry.presence++;
        fieldTypes.set(f.key, entry);
      }
    }
    const merged: TypeField[] = [];
    for (const [key, entry] of fieldTypes) {
      merged.push({
        key,
        type: mergeTypes(entry.types),
        optional: entry.presence < objects.length,
      });
    }
    return { kind: "object", fields: merged };
  }
  const allArrays = types.every((t) => t.kind === "array");
  if (allArrays) {
    const arrs = types as Array<{ kind: "array"; element: TypeNode }>;
    return { kind: "array", element: mergeTypes(arrs.map((a) => a.element)) };
  }
  // Deduplicate scalar kinds
  const seen = new Set<string>();
  const variants: TypeNode[] = [];
  for (const t of types) {
    const key = typeKey(t);
    if (!seen.has(key)) {
      seen.add(key);
      variants.push(t);
    }
  }
  if (variants.length === 1) return variants[0]!;
  return { kind: "union", variants };
}

function renderTypeNode(node: TypeNode, indent: number): string {
  const pad = "  ".repeat(indent);
  switch (node.kind) {
    case "null":
      return "null";
    case "boolean":
      return "boolean";
    case "number":
      return "number";
    case "string":
      return "string";
    case "unknown":
      return "unknown";
    case "array": {
      const inner = renderTypeNode(node.element, indent);
      // Wrap unions and objects in parens so `[]` binds correctly
      if (node.element.kind === "union") return `Array<${inner}>`;
      if (node.element.kind === "object") return `Array<${inner}>`;
      return `${inner}[]`;
    }
    case "object": {
      if (node.fields.length === 0) return "{}";
      const lines: string[] = ["{"];
      for (const f of node.fields) {
        const safeKey = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(f.key)
          ? f.key
          : JSON.stringify(f.key);
        lines.push(
          `${pad}  ${safeKey}${f.optional ? "?" : ""}: ${renderTypeNode(f.type, indent + 1)};`,
        );
      }
      lines.push(`${pad}}`);
      return lines.join("\n");
    }
    case "union":
      return node.variants.map((v) => renderTypeNode(v, indent)).join(" | ");
  }
}

function generateTypeScript(value: unknown, rootName = "Root"): string {
  const node = inferType(value);
  if (node.kind === "object") {
    return `export interface ${rootName} ${renderTypeNode(node, 0)}`;
  }
  return `export type ${rootName} = ${renderTypeNode(node, 0)};`;
}

// ── Zod schema generator ───────────────────────────────────────

function renderZodNode(node: TypeNode, indent: number): string {
  const pad = "  ".repeat(indent);
  switch (node.kind) {
    case "null":
      return "z.null()";
    case "boolean":
      return "z.boolean()";
    case "number":
      return "z.number()";
    case "string":
      return "z.string()";
    case "unknown":
      return "z.unknown()";
    case "array":
      return `z.array(${renderZodNode(node.element, indent)})`;
    case "object": {
      if (node.fields.length === 0) return "z.object({})";
      const lines: string[] = ["z.object({"];
      for (const f of node.fields) {
        const safeKey = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(f.key)
          ? f.key
          : JSON.stringify(f.key);
        const inner = renderZodNode(f.type, indent + 1);
        const optional = f.optional ? ".optional()" : "";
        lines.push(`${pad}  ${safeKey}: ${inner}${optional},`);
      }
      lines.push(`${pad}})`);
      return lines.join("\n");
    }
    case "union":
      return `z.union([${node.variants.map((v) => renderZodNode(v, indent)).join(", ")}])`;
  }
}

function generateZod(value: unknown, rootName = "Root"): string {
  const node = inferType(value);
  const schemaName = rootName + "Schema";
  return `import { z } from "zod";\n\nexport const ${schemaName} = ${renderZodNode(node, 0)};\n\nexport type ${rootName} = z.infer<typeof ${schemaName}>;`;
}

// ── Structural diff ────────────────────────────────────────────

type DiffChange = "added" | "removed" | "changed";

interface DiffEntry {
  path: string;
  change: DiffChange;
  leftValue?: unknown;
  rightValue?: unknown;
}

function structurallyEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const arrB = b as unknown[];
    if (a.length !== arrB.length) return false;
    return a.every((v, i) => structurallyEqual(v, arrB[i]));
  }
  const objA = a as Record<string, unknown>;
  const objB = b as Record<string, unknown>;
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k) => structurallyEqual(objA[k], objB[k]));
}

function formatDiffValue(value: unknown): string {
  if (value === undefined) return "";
  try {
    const s = JSON.stringify(value);
    if (s.length > 120) return s.slice(0, 117) + "…";
    return s;
  } catch {
    return String(value);
  }
}

// ── Mini JSON Schema validator ─────────────────────────────────

type SchemaTypeName =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "null"
  | "array"
  | "object";

interface JsonSchemaNode {
  type?: SchemaTypeName | SchemaTypeName[];
  required?: string[];
  properties?: Record<string, JsonSchemaNode>;
  items?: JsonSchemaNode;
  enum?: unknown[];
  const?: unknown;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  format?: "email" | "url" | "uri" | "date-time" | "date" | "uuid" | "ipv4";
  pattern?: string;
  minItems?: number;
  maxItems?: number;
  description?: string;
}

interface SchemaError {
  path: string;
  message: string;
}

function actualType(value: unknown): SchemaTypeName | "undefined" {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (value === undefined) return "undefined";
  const t = typeof value;
  if (t === "object") return "object";
  if (t === "string") return "string";
  if (t === "number") return "number";
  if (t === "boolean") return "boolean";
  return "object";
}

function valueMatchesType(value: unknown, type: SchemaTypeName): boolean {
  switch (type) {
    case "null":
      return value === null;
    case "boolean":
      return typeof value === "boolean";
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "number":
      return typeof value === "number" && !Number.isNaN(value);
    case "string":
      return typeof value === "string";
    case "array":
      return Array.isArray(value);
    case "object":
      return (
        typeof value === "object" && value !== null && !Array.isArray(value)
      );
  }
}

function checkFormat(value: string, format: string): boolean {
  switch (format) {
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    case "url":
    case "uri":
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    case "date-time":
      return !Number.isNaN(Date.parse(value));
    case "date":
      return /^\d{4}-\d{2}-\d{2}$/.test(value);
    case "uuid":
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      );
    case "ipv4":
      return /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(
        value,
      );
    default:
      return true;
  }
}

function validateAgainstSchema(
  value: unknown,
  schema: JsonSchemaNode,
  path = "$",
): SchemaError[] {
  const errors: SchemaError[] = [];

  // Type
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => valueMatchesType(value, t))) {
      errors.push({
        path,
        message: `Expected type ${types.join(" | ")}, got ${actualType(value)}`,
      });
      // Stop deeper validation; would just produce noise.
      return errors;
    }
  }

  // const
  if (schema.const !== undefined && !structurallyEqual(value, schema.const)) {
    errors.push({
      path,
      message: `Must equal ${JSON.stringify(schema.const)}`,
    });
  }

  // enum
  if (Array.isArray(schema.enum)) {
    if (!schema.enum.some((e) => structurallyEqual(e, value))) {
      const opts = schema.enum.map((e) => JSON.stringify(e)).join(", ");
      errors.push({ path, message: `Must be one of: ${opts}` });
    }
  }

  // String constraints
  if (typeof value === "string") {
    if (
      typeof schema.minLength === "number" &&
      value.length < schema.minLength
    ) {
      errors.push({
        path,
        message: `String shorter than minLength ${schema.minLength} (got ${value.length})`,
      });
    }
    if (
      typeof schema.maxLength === "number" &&
      value.length > schema.maxLength
    ) {
      errors.push({
        path,
        message: `String longer than maxLength ${schema.maxLength} (got ${value.length})`,
      });
    }
    if (schema.format && !checkFormat(value, schema.format)) {
      errors.push({ path, message: `Invalid ${schema.format} format` });
    }
    if (schema.pattern) {
      try {
        if (!new RegExp(schema.pattern).test(value)) {
          errors.push({
            path,
            message: `Does not match pattern /${schema.pattern}/`,
          });
        }
      } catch {
        errors.push({ path, message: `Invalid pattern in schema` });
      }
    }
  }

  // Number constraints
  if (typeof value === "number") {
    if (typeof schema.minimum === "number" && value < schema.minimum) {
      errors.push({
        path,
        message: `Below minimum ${schema.minimum} (got ${value})`,
      });
    }
    if (typeof schema.maximum === "number" && value > schema.maximum) {
      errors.push({
        path,
        message: `Above maximum ${schema.maximum} (got ${value})`,
      });
    }
  }

  // Object: required + properties
  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  ) {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (!(key in obj)) {
          errors.push({
            path,
            message: `Missing required property: ${key}`,
          });
        }
      }
    }
    if (schema.properties) {
      for (const [key, sub] of Object.entries(schema.properties)) {
        if (key in obj) {
          errors.push(
            ...validateAgainstSchema(obj[key], sub, childPathFor(path, key)),
          );
        }
      }
    }
  }

  // Array: items
  if (Array.isArray(value)) {
    if (typeof schema.minItems === "number" && value.length < schema.minItems) {
      errors.push({
        path,
        message: `Too few items: ${value.length} < ${schema.minItems}`,
      });
    }
    if (typeof schema.maxItems === "number" && value.length > schema.maxItems) {
      errors.push({
        path,
        message: `Too many items: ${value.length} > ${schema.maxItems}`,
      });
    }
    if (schema.items) {
      value.forEach((item, i) => {
        errors.push(
          ...validateAgainstSchema(item, schema.items!, childPathFor(path, i)),
        );
      });
    }
  }

  return errors;
}

function computeDiff(left: unknown, right: unknown, path = "$"): DiffEntry[] {
  if (structurallyEqual(left, right)) return [];
  const leftIsObj =
    left !== null && typeof left === "object" && !Array.isArray(left);
  const rightIsObj =
    right !== null && typeof right === "object" && !Array.isArray(right);
  const leftIsArr = Array.isArray(left);
  const rightIsArr = Array.isArray(right);

  if ((leftIsObj && rightIsObj) || (leftIsArr && rightIsArr)) {
    const entries: DiffEntry[] = [];
    if (leftIsArr) {
      const arrL = left as unknown[];
      const arrR = right as unknown[];
      const maxLen = Math.max(arrL.length, arrR.length);
      for (let i = 0; i < maxLen; i++) {
        const subPath = childPathFor(path, i);
        if (i >= arrL.length) {
          entries.push({ path: subPath, change: "added", rightValue: arrR[i] });
        } else if (i >= arrR.length) {
          entries.push({ path: subPath, change: "removed", leftValue: arrL[i] });
        } else {
          entries.push(...computeDiff(arrL[i], arrR[i], subPath));
        }
      }
      return entries;
    }
    const objL = left as Record<string, unknown>;
    const objR = right as Record<string, unknown>;
    const keys = new Set([...Object.keys(objL), ...Object.keys(objR)]);
    for (const key of keys) {
      const subPath = childPathFor(path, key);
      if (!(key in objL)) {
        entries.push({ path: subPath, change: "added", rightValue: objR[key] });
      } else if (!(key in objR)) {
        entries.push({ path: subPath, change: "removed", leftValue: objL[key] });
      } else {
        entries.push(...computeDiff(objL[key], objR[key], subPath));
      }
    }
    return entries;
  }

  return [{ path, change: "changed", leftValue: left, rightValue: right }];
}

// ── Hand-rolled JSON error locator ─────────────────────────────

interface LocatedError {
  pos: number;
  line: number;
  col: number;
  message: string;
}

function findJsonParseError(src: string): LocatedError | null {
  let i = 0;
  const len = src.length;
  let line = 1;
  let col = 1;

  const advance = (n = 1) => {
    for (let k = 0; k < n && i < len; k++) {
      if (src[i] === "\n") {
        line++;
        col = 1;
      } else {
        col++;
      }
      i++;
    }
  };

  const at = (msg: string): LocatedError => ({ pos: i, line, col, message: msg });

  const skipWs = () => {
    while (i < len) {
      const c = src[i]!;
      if (c === " " || c === "\t" || c === "\n" || c === "\r") advance();
      else break;
    }
  };

  const parseString = (): LocatedError | null => {
    advance(); // opening quote
    while (i < len) {
      const c = src[i]!;
      if (c === "\\") {
        if (i + 1 >= len) return at("Unterminated string");
        advance(2);
        continue;
      }
      if (c === '"') {
        advance();
        return null;
      }
      if (c === "\n") return at("Unterminated string (newline in string)");
      advance();
    }
    return at("Unterminated string");
  };

  const parseNumber = (): LocatedError | null => {
    const m = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(
      src.slice(i),
    );
    if (!m) return at("Invalid number");
    advance(m[0].length);
    return null;
  };

  const parseValue = (): LocatedError | null => {
    skipWs();
    if (i >= len) return at("Unexpected end of input");
    const c = src[i]!;
    if (c === "{") return parseObject();
    if (c === "[") return parseArray();
    if (c === '"') return parseString();
    if (c === "-" || (c >= "0" && c <= "9")) return parseNumber();
    if (src.slice(i, i + 4) === "true") {
      advance(4);
      return null;
    }
    if (src.slice(i, i + 5) === "false") {
      advance(5);
      return null;
    }
    if (src.slice(i, i + 4) === "null") {
      advance(4);
      return null;
    }
    return at(`Unexpected token '${c}'`);
  };

  const parseObject = (): LocatedError | null => {
    advance(); // {
    skipWs();
    if (src[i] === "}") {
      advance();
      return null;
    }
    while (true) {
      skipWs();
      if (src[i] !== '"') {
        return at(
          `Expected string key, got '${src[i] ?? "end of input"}'`,
        );
      }
      const keyErr = parseString();
      if (keyErr) return keyErr;
      skipWs();
      if (src[i] !== ":") {
        return at(
          `Expected ':' after key, got '${src[i] ?? "end of input"}'`,
        );
      }
      advance();
      const valErr = parseValue();
      if (valErr) return valErr;
      skipWs();
      if (src[i] === ",") {
        advance();
        skipWs();
        if (src[i] === "}")
          return at("Trailing comma before '}' — JSON does not allow this");
        continue;
      }
      if (src[i] === "}") {
        advance();
        return null;
      }
      return at(
        `Expected ',' or '}' in object, got '${src[i] ?? "end of input"}'`,
      );
    }
  };

  const parseArray = (): LocatedError | null => {
    advance(); // [
    skipWs();
    if (src[i] === "]") {
      advance();
      return null;
    }
    while (true) {
      const valErr = parseValue();
      if (valErr) return valErr;
      skipWs();
      if (src[i] === ",") {
        advance();
        skipWs();
        if (src[i] === "]")
          return at("Trailing comma before ']' — JSON does not allow this");
        continue;
      }
      if (src[i] === "]") {
        advance();
        return null;
      }
      return at(
        `Expected ',' or ']' in array, got '${src[i] ?? "end of input"}'`,
      );
    }
  };

  const topErr = parseValue();
  if (topErr) return topErr;
  skipWs();
  if (i < len) return at(`Unexpected trailing character '${src[i]}'`);
  return null;
}

type TreeEntry = {
  key: string | number;
  value: unknown;
  path: string;
  isLast: boolean;
};

interface TreeNodeSignature {
  Args: {
    value: unknown;
    nodeKey?: string | number;
    path: string;
    isLast?: boolean;
    expandedPaths: Set<string>;
    toggleExpanded: (path: string) => void;
    copyPath: (path: string) => void;
    matchedPaths: Set<string> | null;
    ancestorPaths: Set<string> | null;
  };
}

class TreeNode extends Component<TreeNodeSignature> {
  get isArray() {
    return Array.isArray(this.args.value);
  }

  get isObject() {
    return (
      this.args.value !== null &&
      typeof this.args.value === "object" &&
      !Array.isArray(this.args.value)
    );
  }

  get isContainer() {
    return this.isArray || this.isObject;
  }

  get isExpanded() {
    return this.args.expandedPaths.has(this.args.path);
  }

  get caretClass() {
    return this.isExpanded ? "tn-caret open" : "tn-caret";
  }

  get entries(): TreeEntry[] {
    const parent = this.args.path;
    if (this.isArray) {
      const arr = this.args.value as unknown[];
      return arr.map((v, i) => ({
        key: i,
        value: v,
        path: childPathFor(parent, i),
        isLast: i === arr.length - 1,
      }));
    }
    if (this.isObject) {
      const obj = this.args.value as Record<string, unknown>;
      const keys = Object.keys(obj);
      return keys.map((k, i) => ({
        key: k,
        value: obj[k],
        path: childPathFor(parent, k),
        isLast: i === keys.length - 1,
      }));
    }
    return [];
  }

  get childCount() {
    return this.entries.length;
  }

  get summary() {
    if (this.isArray) return `Array(${this.childCount})`;
    if (this.isObject) return `Object(${this.childCount})`;
    return "";
  }

  get openBrace() {
    return this.isArray ? "[" : "{";
  }

  get closeBrace() {
    return this.isArray ? "]" : "}";
  }

  get isLast() {
    return this.args.isLast ?? true;
  }

  get filterClass(): string {
    if (!this.args.matchedPaths) return "";
    if (this.args.matchedPaths.has(this.args.path)) return "matched";
    if (this.args.ancestorPaths?.has(this.args.path)) return "match-ancestor";
    return "dimmed";
  }

  get hasKey() {
    return this.args.nodeKey !== undefined;
  }

  get keyDisplay() {
    if (this.args.nodeKey === undefined) return "";
    if (typeof this.args.nodeKey === "number") return String(this.args.nodeKey);
    return `"${this.args.nodeKey}"`;
  }

  get valueClass() {
    const v = this.args.value;
    if (v === null) return "tn-value null";
    const t = typeof v;
    if (t === "string") return "tn-value string";
    if (t === "number") return "tn-value number";
    if (t === "boolean") return "tn-value boolean";
    return "tn-value";
  }

  get valueDisplay() {
    const v = this.args.value;
    if (v === null) return "null";
    if (typeof v === "string") return JSON.stringify(v);
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    return String(v);
  }

  toggle = () => {
    this.args.toggleExpanded(this.args.path);
  };

  copy = (e: Event) => {
    e.stopPropagation();
    this.args.copyPath(this.args.path);
  };

  <template>
    {{#if this.isContainer}}
      <div class="tn {{this.filterClass}}">
        <div class="tn-row" role="button" {{on "click" this.toggle}}>
          <span class={{this.caretClass}}>▸</span>
          {{#if this.hasKey}}
            <span
              class="tn-key clickable"
              title="Click to copy JSONPath"
              {{on "click" this.copy}}
            >{{this.keyDisplay}}</span>
            <span class="tn-colon">:</span>
          {{/if}}
          <span class="tn-brace">{{this.openBrace}}</span>
          {{#unless this.isExpanded}}
            <span class="tn-summary">{{this.summary}}</span>
            <span class="tn-brace">{{this.closeBrace}}</span>
            {{#unless this.isLast}}<span class="tn-comma">,</span>{{/unless}}
          {{/unless}}
        </div>
        {{#if this.isExpanded}}
          <div class="tn-children">
            {{#each this.entries as |entry|}}
              <TreeNode
                @value={{entry.value}}
                @nodeKey={{entry.key}}
                @path={{entry.path}}
                @isLast={{entry.isLast}}
                @expandedPaths={{@expandedPaths}}
                @toggleExpanded={{@toggleExpanded}}
                @copyPath={{@copyPath}}
                @matchedPaths={{@matchedPaths}}
                @ancestorPaths={{@ancestorPaths}}
              />
            {{/each}}
          </div>
          <div class="tn-row tn-close">
            <span class="tn-caret-spacer"></span>
            <span class="tn-brace">{{this.closeBrace}}</span>
            {{#unless this.isLast}}<span class="tn-comma">,</span>{{/unless}}
          </div>
        {{/if}}
      </div>
    {{else}}
      <div class="tn tn-leaf {{this.filterClass}}">
        <div class="tn-row">
          <span class="tn-caret-spacer"></span>
          {{#if this.hasKey}}
            <span
              class="tn-key clickable"
              title="Click to copy JSONPath"
              {{on "click" this.copy}}
            >{{this.keyDisplay}}</span>
            <span class="tn-colon">:</span>
          {{/if}}
          <span
            class="{{this.valueClass}} clickable"
            title="Click to copy JSONPath"
            {{on "click" this.copy}}
          >{{this.valueDisplay}}</span>
          {{#unless this.isLast}}<span class="tn-comma">,</span>{{/unless}}
        </div>
      </div>
    {{/if}}
  </template>
}

interface ParseError {
  message: string;
  line: number;
  col: number;
  pos: number;
}

interface HashState {
  i?: string;
  v?: "tree" | "raw" | "ts" | "zod" | "diff" | "validate";
  q?: string;
  c?: string;
}

function encodeHashState(state: HashState): string {
  try {
    const json = JSON.stringify(state);
    // UTF-8 safe base64
    const bytes = new TextEncoder().encode(json);
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/=+$/, "");
  } catch {
    return "";
  }
}

function decodeHashState(encoded: string): HashState | null {
  if (!encoded) return null;
  try {
    const padded = encoded + "=".repeat((4 - (encoded.length % 4)) % 4);
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json);
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed as HashState;
  } catch {
    return null;
  }
}

function readHashState(): HashState | null {
  if (typeof location === "undefined") return null;
  const hash = location.hash.replace(/^#/, "");
  if (!hash) return null;
  return decodeHashState(hash);
}

export default class JsonFormatterApp extends Component {
  @tracked input = "";
  @tracked parsed: unknown = undefined;
  @tracked hasParsed = false;
  @tracked rawFormatted = "";
  @tracked statsText = "";
  @tracked statusText = "";
  @tracked statusType: "success" | "error" | "" = "";
  @tracked viewMode: "tree" | "raw" | "ts" | "zod" | "diff" | "validate" = "tree";
  @tracked compareInput = "";
  @tracked schemaInput = "";
  @tracked expandedPaths: Set<string> = new Set(["$"]);
  @tracked parseError: ParseError | null = null;
  @tracked filterQuery = "";
  @tracked shareNotice = "";

  private statusTimer: ReturnType<typeof setTimeout> | null = null;
  private textareaEl: HTMLTextAreaElement | null = null;
  private hashWriteTimer: ReturnType<typeof setTimeout> | null = null;
  private suppressHashWrite = false;

  constructor(...args: ConstructorParameters<typeof Component>) {
    super(...args);
    const initial = readHashState();
    if (initial) {
      if (typeof initial.i === "string") this.input = initial.i;
      const viewFromHash =
        initial.v === "tree" ||
        initial.v === "raw" ||
        initial.v === "ts" ||
        initial.v === "zod" ||
        initial.v === "diff" ||
        initial.v === "validate"
          ? initial.v
          : null;
      if (viewFromHash) this.viewMode = viewFromHash;
      if (typeof initial.q === "string") this.filterQuery = initial.q;
      if (typeof initial.c === "string") this.compareInput = initial.c;
      // Auto-format on hydration; re-apply the saved view since format() resets it.
      if (this.input) {
        queueMicrotask(() => {
          this.format();
          if (viewFromHash) this.viewMode = viewFromHash;
        });
      }
    }
    if (typeof window !== "undefined") {
      window.addEventListener("hashchange", this.onHashChange);
    }
  }

  willDestroy() {
    super.willDestroy();
    if (typeof window !== "undefined") {
      window.removeEventListener("hashchange", this.onHashChange);
    }
    if (this.hashWriteTimer) clearTimeout(this.hashWriteTimer);
  }

  private onHashChange = () => {
    if (this.suppressHashWrite) return;
    const state = readHashState();
    if (!state) return;
    if (typeof state.i === "string" && state.i !== this.input) {
      this.input = state.i;
      if (state.i) queueMicrotask(() => this.format());
    }
    if (state.v && state.v !== this.viewMode) this.viewMode = state.v;
    if (typeof state.q === "string") this.filterQuery = state.q;
    if (typeof state.c === "string") this.compareInput = state.c;
  };

  private scheduleHashWrite() {
    if (this.hashWriteTimer) clearTimeout(this.hashWriteTimer);
    this.hashWriteTimer = setTimeout(() => this.writeHash(), 250);
  }

  private writeHash() {
    if (typeof window === "undefined") return;
    const state: HashState = {};
    if (this.input) state.i = this.input;
    if (this.viewMode !== "tree") state.v = this.viewMode;
    if (this.filterQuery) state.q = this.filterQuery;
    if (this.compareInput) state.c = this.compareInput;
    const encoded = Object.keys(state).length ? encodeHashState(state) : "";
    const nextHash = encoded ? `#${encoded}` : "";
    if (location.hash === nextHash) return;
    this.suppressHashWrite = true;
    history.replaceState(null, "", location.pathname + location.search + nextHash);
    // Reset flag on next tick so external hashchange events still work.
    setTimeout(() => {
      this.suppressHashWrite = false;
    }, 0);
  }

  get statusClass() {
    if (!this.statusType) return "status hidden";
    return `status ${this.statusType}`;
  }

  get safeRawHtml(): SafeString {
    return htmlSafe(syntaxHighlight(this.rawFormatted));
  }

  get isTreeView() {
    return this.viewMode === "tree";
  }

  get isRawView() {
    return this.viewMode === "raw";
  }

  get treeBtnClass() {
    return this.isTreeView ? "view-btn active" : "view-btn";
  }

  get rawBtnClass() {
    return this.isRawView ? "view-btn active" : "view-btn";
  }

  get isTsView() {
    return this.viewMode === "ts";
  }

  get isZodView() {
    return this.viewMode === "zod";
  }

  get isDiffView() {
    return this.viewMode === "diff";
  }

  get isValidateView() {
    return this.viewMode === "validate";
  }

  get diffBtnClass() {
    return this.isDiffView ? "view-btn active" : "view-btn";
  }

  get validateBtnClass() {
    return this.isValidateView ? "view-btn active" : "view-btn";
  }

  get schemaParseError(): string | null {
    const raw = this.schemaInput.trim();
    if (!raw) return null;
    try {
      JSON.parse(raw);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "Invalid schema JSON";
    }
  }

  get schemaErrors(): SchemaError[] {
    if (!this.hasParsed) return [];
    const raw = this.schemaInput.trim();
    if (!raw) return [];
    try {
      const schema = JSON.parse(raw) as JsonSchemaNode;
      return validateAgainstSchema(this.parsed, schema);
    } catch {
      return [];
    }
  }

  get validateSummary(): string {
    if (!this.hasParsed) return "Format some JSON first to validate against a schema.";
    const raw = this.schemaInput.trim();
    if (!raw) return "Paste a JSON Schema above to validate.";
    if (this.schemaParseError) return `Schema parse error: ${this.schemaParseError}`;
    const errs = this.schemaErrors;
    if (errs.length === 0) return "✓ Valid against schema";
    return `${errs.length} validation issue${errs.length === 1 ? "" : "s"}`;
  }

  get validateOk(): boolean {
    return (
      this.hasParsed &&
      !!this.schemaInput.trim() &&
      !this.schemaParseError &&
      this.schemaErrors.length === 0
    );
  }

  get compareParseError(): string | null {
    const raw = this.compareInput.trim();
    if (!raw) return null;
    try {
      JSON.parse(raw);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "Invalid JSON";
    }
  }

  get diffEntries(): DiffEntry[] {
    if (!this.hasParsed) return [];
    const raw = this.compareInput.trim();
    if (!raw) return [];
    try {
      const other = JSON.parse(raw);
      return computeDiff(this.parsed, other);
    } catch {
      return [];
    }
  }

  get diffView(): Array<{
    path: string;
    cls: string;
    symbol: string;
    leftText: string;
    rightText: string;
  }> {
    return this.diffEntries.map((e) => ({
      path: e.path,
      cls: `diff-row diff-${e.change}`,
      symbol: e.change === "added" ? "+" : e.change === "removed" ? "−" : "~",
      leftText: formatDiffValue(e.leftValue),
      rightText: formatDiffValue(e.rightValue),
    }));
  }

  get diffSummary(): string {
    const entries = this.diffEntries;
    if (entries.length === 0) {
      return this.compareInput.trim()
        ? "✓ No differences"
        : "Paste JSON to compare";
    }
    const added = entries.filter((e) => e.change === "added").length;
    const removed = entries.filter((e) => e.change === "removed").length;
    const changed = entries.filter((e) => e.change === "changed").length;
    return `${added} added · ${removed} removed · ${changed} changed`;
  }

  get tsBtnClass() {
    return this.isTsView ? "view-btn active" : "view-btn";
  }

  get zodBtnClass() {
    return this.isZodView ? "view-btn active" : "view-btn";
  }

  get tsOutput(): string {
    if (!this.hasParsed) return "";
    return generateTypeScript(this.parsed, "Root");
  }

  get zodOutput(): string {
    if (!this.hasParsed) return "";
    return generateZod(this.parsed, "Root");
  }

  showStatus = (message: string, type: "success" | "error") => {
    if (this.statusTimer) clearTimeout(this.statusTimer);
    this.statusText = message;
    this.statusType = type;
    this.statusTimer = setTimeout(() => {
      this.statusText = "";
      this.statusType = "";
    }, 3000);
  };

  onInput = (e: Event) => {
    this.textareaEl = e.target as HTMLTextAreaElement;
    this.input = this.textareaEl.value;
    // Clear the error badge while the user edits
    if (this.parseError) this.parseError = null;
    this.scheduleHashWrite();
  };

  onPaste = () => {
    setTimeout(() => this.format(), 50);
  };

  private recordParseError(raw: string, err: unknown) {
    const source = this.input;
    // Our hand-rolled locator operates on the full input (with leading
    // whitespace) so pos/line/col line up with the textarea selection.
    const located = findJsonParseError(source);
    if (located) {
      this.parseError = located;
      return;
    }
    // Fallback: use JSON.parse's message and attempt to read a position hint.
    const msg = err instanceof Error ? err.message : "Unknown error";
    const posMatch = msg.match(/(?:at position |column )(\d+)/);
    const pos = posMatch ? parseInt(posMatch[1]!, 10) : 0;
    const safePos = Math.min(pos, source.length);
    let line = 1;
    let col = 1;
    for (let i = 0; i < safePos; i++) {
      if (source[i] === "\n") {
        line++;
        col = 1;
      } else {
        col++;
      }
    }
    this.parseError = { message: msg, line, col, pos: safePos };
    void raw;
  }

  jumpToError = () => {
    if (!this.parseError || !this.textareaEl) return;
    const el = this.textareaEl;
    el.focus();
    el.setSelectionRange(this.parseError.pos, this.parseError.pos + 1);
    // Scroll caret into view by nudging
    const before = el.value.slice(0, this.parseError.pos);
    const lineCount = before.split("\n").length;
    const approxLineHeight = parseFloat(
      getComputedStyle(el).lineHeight || "18",
    );
    el.scrollTop = Math.max(0, (lineCount - 3) * approxLineHeight);
  };

  get parseErrorDetail(): string {
    if (!this.parseError) return "";
    return `Line ${this.parseError.line}, col ${this.parseError.col}: ${this.parseError.message}`;
  }

  onFilterInput = (e: Event) => {
    this.filterQuery = (e.target as HTMLInputElement).value;
    this.scheduleHashWrite();
  };

  clearFilter = () => {
    this.filterQuery = "";
    this.scheduleHashWrite();
  };

  private buildAllPaths(value: unknown, path: string, out: string[]): void {
    out.push(path);
    if (value === null || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((v, i) => this.buildAllPaths(v, childPathFor(path, i), out));
      return;
    }
    Object.entries(value as Record<string, unknown>).forEach(([k, v]) =>
      this.buildAllPaths(v, childPathFor(path, k), out),
    );
  }

  private queryToRegex(query: string): RegExp {
    const parts = query.split("*");
    const escaped = parts
      .map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
      .join("[^.\\[\\]]*");
    if (query.startsWith("$")) {
      return new RegExp("^" + escaped + "(?:$|[.\\[])");
    }
    return new RegExp(escaped);
  }

  get matchedPaths(): Set<string> | null {
    const q = this.filterQuery.trim();
    if (!q || !this.hasParsed) return null;
    const all: string[] = [];
    this.buildAllPaths(this.parsed, "$", all);
    try {
      const re = this.queryToRegex(q);
      return new Set(all.filter((p) => re.test(p)));
    } catch {
      return new Set();
    }
  }

  get ancestorPaths(): Set<string> | null {
    const matches = this.matchedPaths;
    if (!matches) return null;
    const ancestors = new Set<string>();
    for (const path of matches) {
      let cur = "";
      let i = 0;
      while (i < path.length) {
        if (path[i] === "$") {
          cur = "$";
          i++;
        } else if (path[i] === ".") {
          let end = i + 1;
          while (end < path.length && path[end] !== "." && path[end] !== "[") end++;
          cur += path.slice(i, end);
          i = end;
        } else if (path[i] === "[") {
          const end = path.indexOf("]", i) + 1;
          cur += path.slice(i, end);
          i = end;
        } else {
          i++;
        }
        if (cur && cur !== path) ancestors.add(cur);
      }
    }
    return ancestors;
  }

  get autoExpandedPaths(): Set<string> {
    const ancestors = this.ancestorPaths;
    if (!ancestors) return this.expandedPaths;
    const combined = new Set(this.expandedPaths);
    ancestors.forEach((p) => combined.add(p));
    // Also expand matched paths themselves (to reveal their children if containers)
    this.matchedPaths?.forEach((p) => combined.add(p));
    return combined;
  }

  get filterStatus(): string {
    const matches = this.matchedPaths;
    if (!matches) return "";
    return `${matches.size} match${matches.size === 1 ? "" : "es"}`;
  }

  get isFiltering(): boolean {
    return !!this.matchedPaths;
  }

  format = () => {
    const raw = this.input.trim();
    if (!raw) {
      this.showStatus("Please enter some JSON", "error");
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      this.parsed = parsed;
      this.hasParsed = true;
      this.parseError = null;
      this.rawFormatted = JSON.stringify(parsed, null, 2);
      this.expandedPaths = new Set(this.collectInitialExpanded(parsed, "$", 2));
      this.viewMode = "tree";
      this.updateStats(this.rawFormatted);
      this.showStatus("✓ Formatted successfully", "success");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      this.hasParsed = false;
      this.rawFormatted = "";
      this.recordParseError(raw, error);
      this.showStatus(`Invalid JSON: ${msg}`, "error");
    }
  };

  minify = () => {
    const raw = this.input.trim();
    if (!raw) {
      this.showStatus("Please enter some JSON", "error");
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      this.parsed = parsed;
      this.hasParsed = true;
      this.parseError = null;
      const minified = JSON.stringify(parsed);
      this.rawFormatted = minified;
      this.viewMode = "raw";
      this.updateStats(minified);
      this.showStatus(
        `✓ Minified: ${raw.length} → ${minified.length} chars`,
        "success",
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      this.hasParsed = false;
      this.rawFormatted = "";
      this.recordParseError(raw, error);
      this.showStatus(`Invalid JSON: ${msg}`, "error");
    }
  };

  validate = () => {
    const raw = this.input.trim();
    if (!raw) {
      this.showStatus("Please enter some JSON", "error");
      return;
    }
    try {
      JSON.parse(raw);
      this.parseError = null;
      this.showStatus("✓ Valid JSON!", "success");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      this.recordParseError(raw, error);
      this.showStatus(`✗ Invalid: ${msg}`, "error");
    }
  };

  copy = async () => {
    const text = this.rawFormatted;
    if (!text) {
      this.showStatus("Nothing to copy", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      this.showStatus("✓ Copied to clipboard", "success");
    } catch {
      this.showStatus("Failed to copy", "error");
    }
  };

  showTree = () => {
    this.viewMode = "tree";
    this.scheduleHashWrite();
  };

  showRaw = () => {
    this.viewMode = "raw";
    this.scheduleHashWrite();
  };

  showTs = () => {
    this.viewMode = "ts";
    this.scheduleHashWrite();
  };

  showZod = () => {
    this.viewMode = "zod";
    this.scheduleHashWrite();
  };

  showDiff = () => {
    this.viewMode = "diff";
    this.scheduleHashWrite();
  };

  showValidate = () => {
    this.viewMode = "validate";
  };

  onCompareInput = (e: Event) => {
    this.compareInput = (e.target as HTMLTextAreaElement).value;
    this.scheduleHashWrite();
  };

  onSchemaInput = (e: Event) => {
    this.schemaInput = (e.target as HTMLTextAreaElement).value;
  };

  loadExampleSchema = () => {
    this.schemaInput = JSON.stringify(
      {
        type: "object",
        required: ["id", "name", "email"],
        properties: {
          id: { type: "integer", minimum: 1 },
          name: { type: "string", minLength: 1 },
          email: { type: "string", format: "email" },
          tags: { type: "array", items: { type: "string" } },
          age: { type: "integer", minimum: 0, maximum: 130 },
        },
      },
      null,
      2,
    );
  };

  sharePermalink = async () => {
    this.writeHash();
    try {
      await navigator.clipboard.writeText(location.href);
      this.showStatus("✓ Permalink copied", "success");
    } catch {
      this.showStatus("Failed to copy URL", "error");
    }
  };

  copyTs = async () => {
    const text = this.tsOutput;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.showStatus("✓ Copied TypeScript type", "success");
    } catch {
      this.showStatus("Failed to copy", "error");
    }
  };

  copyZod = async () => {
    const text = this.zodOutput;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.showStatus("✓ Copied Zod schema", "success");
    } catch {
      this.showStatus("Failed to copy", "error");
    }
  };

  toggleExpanded = (path: string) => {
    const next = new Set(this.expandedPaths);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    this.expandedPaths = next;
  };

  copyPath = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      this.showStatus(`✓ Copied path: ${path}`, "success");
    } catch {
      this.showStatus("Failed to copy path", "error");
    }
  };

  expandAll = () => {
    if (!this.hasParsed) return;
    const all: string[] = [];
    this.collectAllPaths(this.parsed, "$", all);
    this.expandedPaths = new Set(all);
  };

  collapseAll = () => {
    this.expandedPaths = new Set(["$"]);
  };

  private collectAllPaths(
    value: unknown,
    path: string,
    out: string[],
  ): void {
    if (value === null || typeof value !== "object") return;
    out.push(path);
    if (Array.isArray(value)) {
      value.forEach((v, i) => {
        this.collectAllPaths(v, childPathFor(path, i), out);
      });
      return;
    }
    Object.entries(value as Record<string, unknown>).forEach(([k, v]) => {
      this.collectAllPaths(v, childPathFor(path, k), out);
    });
  }

  private collectInitialExpanded(
    value: unknown,
    path: string,
    depth: number,
  ): string[] {
    if (value === null || typeof value !== "object") return [path];
    if (depth <= 0) return [];
    const paths: string[] = [path];
    if (Array.isArray(value)) {
      value.forEach((v, i) => {
        paths.push(
          ...this.collectInitialExpanded(v, childPathFor(path, i), depth - 1),
        );
      });
      return paths;
    }
    Object.entries(value as Record<string, unknown>).forEach(([k, v]) => {
      paths.push(
        ...this.collectInitialExpanded(v, childPathFor(path, k), depth - 1),
      );
    });
    return paths;
  }

  private updateStats(json: string) {
    try {
      const parsed = JSON.parse(json);
      const keys = JSON.stringify(parsed).match(/"[^"]+"\s*:/g) || [];
      this.statsText = `${keys.length} keys · ${json.length.toLocaleString()} chars`;
    } catch {
      this.statsText = "";
    }
  }

  <template>
    <div class="container">
      <header>
        <a href="../../" class="back">← All Tools</a>
        <h1>📋 JSON Formatter</h1>
        <p class="subtitle">Format, validate, and explore JSON with a clickable tree.</p>
      </header>

      <main>
        <div class="input-section">
          <label>Paste JSON</label>
          <textarea
            rows="12"
            placeholder='{"name": "example", "value": 42}'
            {{on "input" this.onInput}}
            {{on "paste" this.onPaste}}
          >{{this.input}}</textarea>

          {{#if this.parseError}}
            <div class="parse-error">
              <span class="parse-error-badge">⚠ Line {{this.parseError.line}}, col {{this.parseError.col}}</span>
              <span class="parse-error-msg">{{this.parseError.message}}</span>
              <button type="button" class="parse-error-jump" {{on "click" this.jumpToError}}>Jump to error</button>
            </div>
          {{/if}}

          <div class="button-row">
            <button class="primary-btn" type="button" {{on "click" this.format}}>✨ Format</button>
            <button class="secondary-btn" type="button" {{on "click" this.minify}}>📦 Minify</button>
            <button class="secondary-btn" type="button" {{on "click" this.validate}}>✅ Validate</button>
            <button class="secondary-btn" type="button" {{on "click" this.copy}}>📋 Copy</button>
            <button class="secondary-btn" type="button" title="Copy a shareable permalink" {{on "click" this.sharePermalink}}>🔗 Share</button>
          </div>
        </div>

        <div class={{this.statusClass}}>{{this.statusText}}</div>

        {{#if this.hasParsed}}
          <div class="output-section">
            <div class="output-header">
              <label>Output</label>
              <div class="view-toggle">
                <button
                  class={{this.treeBtnClass}}
                  type="button"
                  {{on "click" this.showTree}}
                >🌳 Tree</button>
                <button
                  class={{this.rawBtnClass}}
                  type="button"
                  {{on "click" this.showRaw}}
                >📝 Raw</button>
                <button
                  class={{this.tsBtnClass}}
                  type="button"
                  {{on "click" this.showTs}}
                >📐 TS</button>
                <button
                  class={{this.zodBtnClass}}
                  type="button"
                  {{on "click" this.showZod}}
                >🛡 Zod</button>
                <button
                  class={{this.diffBtnClass}}
                  type="button"
                  {{on "click" this.showDiff}}
                >📊 Diff</button>
                <button
                  class={{this.validateBtnClass}}
                  type="button"
                  {{on "click" this.showValidate}}
                >✓ Validate</button>
              </div>
              {{#if this.statsText}}
                <span class="stats">{{this.statsText}}</span>
              {{/if}}
            </div>

            {{#if this.isTreeView}}
              <div class="tree-toolbar">
                <button class="ghost-btn" type="button" {{on "click" this.expandAll}}>Expand all</button>
                <button class="ghost-btn" type="button" {{on "click" this.collapseAll}}>Collapse all</button>
                <span class="tree-hint">Click any key or value to copy its JSONPath</span>
              </div>
              <div class="query-bar">
                <span class="query-prefix">🔎</span>
                <input
                  type="text"
                  class="query-input"
                  placeholder='Filter: $.user.name  •  $..id  •  $.items[*].price  •  name'
                  value={{this.filterQuery}}
                  {{on "input" this.onFilterInput}}
                />
                {{#if this.isFiltering}}
                  <span class="query-status">{{this.filterStatus}}</span>
                  <button type="button" class="ghost-btn" {{on "click" this.clearFilter}}>Clear</button>
                {{/if}}
              </div>
              <div class="tree {{if this.isFiltering 'filtering'}}">
                <TreeNode
                  @value={{this.parsed}}
                  @path="$"
                  @expandedPaths={{this.autoExpandedPaths}}
                  @toggleExpanded={{this.toggleExpanded}}
                  @copyPath={{this.copyPath}}
                  @matchedPaths={{this.matchedPaths}}
                  @ancestorPaths={{this.ancestorPaths}}
                />
              </div>
            {{else if this.isRawView}}
              <pre class="output">{{{this.safeRawHtml}}}</pre>
            {{else if this.isTsView}}
              <div class="ts-toolbar">
                <span class="ts-hint">Generated TypeScript interface</span>
                <button class="ghost-btn" type="button" {{on "click" this.copyTs}}>Copy</button>
              </div>
              <pre class="output ts-output">{{this.tsOutput}}</pre>
            {{else if this.isZodView}}
              <div class="ts-toolbar">
                <span class="ts-hint">Generated Zod schema</span>
                <button class="ghost-btn" type="button" {{on "click" this.copyZod}}>Copy</button>
              </div>
              <pre class="output ts-output">{{this.zodOutput}}</pre>
            {{else if this.isDiffView}}
              <div class="diff-panel">
                <label class="diff-label">Compare against</label>
                <textarea
                  rows="6"
                  class="diff-textarea"
                  placeholder='Paste the other JSON here…'
                  {{on "input" this.onCompareInput}}
                >{{this.compareInput}}</textarea>
                <div class="diff-summary">{{this.diffSummary}}</div>
                {{#if this.diffView.length}}
                  <div class="diff-list">
                    {{#each this.diffView as |row|}}
                      <div class={{row.cls}}>
                        <span class="diff-symbol">{{row.symbol}}</span>
                        <span class="diff-path">{{row.path}}</span>
                        {{#if row.leftText}}
                          <span class="diff-left">{{row.leftText}}</span>
                        {{/if}}
                        {{#if row.rightText}}
                          <span class="diff-arrow">→</span>
                          <span class="diff-right">{{row.rightText}}</span>
                        {{/if}}
                      </div>
                    {{/each}}
                  </div>
                {{/if}}
              </div>
            {{else}}
              <div class="diff-panel">
                <div class="ts-toolbar">
                  <label class="diff-label">JSON Schema</label>
                  <button class="ghost-btn" type="button" {{on "click" this.loadExampleSchema}}>Load example</button>
                </div>
                <textarea
                  rows="8"
                  class="diff-textarea"
                  placeholder='{"type":"object","required":["id"],"properties":{"id":{"type":"integer","minimum":1}}}'
                  {{on "input" this.onSchemaInput}}
                >{{this.schemaInput}}</textarea>
                <div class="diff-summary {{if this.validateOk 'validate-ok'}}">{{this.validateSummary}}</div>
                {{#if this.schemaErrors.length}}
                  <div class="diff-list">
                    {{#each this.schemaErrors as |err|}}
                      <div class="diff-row diff-changed">
                        <span class="diff-symbol">!</span>
                        <span class="diff-path">{{err.path}}</span>
                        <span class="diff-right">{{err.message}}</span>
                      </div>
                    {{/each}}
                  </div>
                {{/if}}
              </div>
            {{/if}}
          </div>
        {{/if}}
      </main>

      <footer>
        <p class="footer-credit">
          Made with 🧡 by
          <a
            href="https://crunchybananas.github.io"
            target="_blank" rel="noopener noreferrer"
          >Cory Loken & Chiron</a>
          using
          <a href="https://emberjs.com" target="_blank" rel="noopener noreferrer">Ember</a>
        </p>
      </footer>
    </div>
  </template>
}
