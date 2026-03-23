/**
 * Export as React Component (JSX + Tailwind)
 *
 * Generates a React functional component with Tailwind CSS classes.
 * Includes useState hooks for interactive elements.
 */

import type { DesignElement } from "atelier/services/design-store";
import type TokenRegistryService from "atelier/services/token-registry";

interface ElementNode {
  element: DesignElement;
  children: ElementNode[];
}

type LayoutKind = "absolute" | "flex-row" | "flex-col" | "grid";

interface LayoutInfo {
  kind: LayoutKind;
  gap: number;
  columns?: number;
  alignItems?: string;
  justifyContent?: string;
}

// ---- Shared helpers (duplicated to keep modules independent) ----

function sanitizeComponentName(fileName: string): string {
  const cleaned = fileName.replace(/[^a-zA-Z0-9\s-_]/g, "").trim() || "AtelierDesign";
  return cleaned.split(/[\s\-_]+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("");
}

function escapeJsx(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/{/g, "&#123;").replace(/}/g, "&#125;");
}

function buildElementTree(elements: DesignElement[]): ElementNode[] {
  const visible = elements.filter((el) => el.visible);
  const nodeMap = new Map<string, ElementNode>();
  for (const el of visible) nodeMap.set(el.id, { element: el, children: [] });
  const roots: ElementNode[] = [];
  for (const el of visible) {
    const node = nodeMap.get(el.id)!;
    if (el.parentId && nodeMap.has(el.parentId)) nodeMap.get(el.parentId)!.children.push(node);
    else roots.push(node);
  }
  return roots;
}

function computeOffset(elements: DesignElement[]): { offsetX: number; offsetY: number } {
  const visible = elements.filter((el) => el.visible);
  if (visible.length === 0) return { offsetX: 0, offsetY: 0 };
  return { offsetX: Math.min(...visible.map((e) => e.x)), offsetY: Math.min(...visible.map((e) => e.y)) };
}

function computeBounds(elements: DesignElement[]): { width: number; height: number } {
  const visible = elements.filter((el) => el.visible);
  if (visible.length === 0) return { width: 800, height: 600 };
  const minX = Math.min(...visible.map((e) => e.x));
  const minY = Math.min(...visible.map((e) => e.y));
  const maxX = Math.max(...visible.map((e) => e.x + e.width));
  const maxY = Math.max(...visible.map((e) => e.y + e.height));
  return { width: maxX - minX, height: maxY - minY };
}

// ---- Layout detection (simplified re-use) ----

const POS_TOL = 8;

function detectLayout(children: ElementNode[]): LayoutInfo {
  if (children.length < 2) return { kind: "absolute", gap: 0 };
  const els = children.map((n) => n.element);

  // Row
  const yCs = els.map((e) => e.y + e.height / 2);
  const avgY = yCs.reduce((a, b) => a + b, 0) / yCs.length;
  const maxYDev = Math.max(...yCs.map((c) => Math.abs(c - avgY)));
  const maxH = Math.max(...els.map((e) => e.height));
  if (maxYDev <= Math.max(POS_TOL, maxH * 0.4)) {
    const sorted = [...els].sort((a, b) => a.x - b.x);
    const gaps = sorted.slice(1).map((e, i) => e.x - (sorted[i]!.x + sorted[i]!.width));
    if (!gaps.some((g) => g < -POS_TOL)) {
      const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      const tops = els.map((e) => e.y), bots = els.map((e) => e.y + e.height);
      const minTop = Math.min(...tops), maxBot = Math.max(...bots);
      let ai = "items-start";
      if (tops.every((t) => Math.abs(t - minTop) <= POS_TOL) && bots.every((b) => Math.abs(b - maxBot) <= POS_TOL)) ai = "items-stretch";
      else if (maxYDev <= POS_TOL) ai = "items-center";
      else if (bots.every((b) => Math.abs(b - maxBot) <= POS_TOL)) ai = "items-end";
      return { kind: "flex-row", gap: Math.max(0, Math.round(avg)), alignItems: ai };
    }
  }

  // Column
  const xCs = els.map((e) => e.x + e.width / 2);
  const avgX = xCs.reduce((a, b) => a + b, 0) / xCs.length;
  const maxXDev = Math.max(...xCs.map((c) => Math.abs(c - avgX)));
  const maxW = Math.max(...els.map((e) => e.width));
  const lefts = els.map((e) => e.x);
  const minLeft = Math.min(...lefts);
  if (maxXDev <= Math.max(POS_TOL, maxW * 0.4) || lefts.every((l) => Math.abs(l - minLeft) <= POS_TOL)) {
    const sorted = [...els].sort((a, b) => a.y - b.y);
    const gaps = sorted.slice(1).map((e, i) => e.y - (sorted[i]!.y + sorted[i]!.height));
    if (!gaps.some((g) => g < -POS_TOL)) {
      const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      return { kind: "flex-col", gap: Math.max(0, Math.round(avg)), alignItems: "items-start" };
    }
  }

  // Grid
  if (els.length >= 4) {
    const sorted = [...els].sort((a, b) => a.y - b.y || a.x - b.x);
    const rows: DesignElement[][] = [[sorted[0]!]];
    for (let i = 1; i < sorted.length; i++) {
      const prev = rows[rows.length - 1]![0]!;
      const curr = sorted[i]!;
      if (Math.abs((curr.y + curr.height / 2) - (prev.y + prev.height / 2)) <= Math.max(POS_TOL, prev.height * 0.4)) {
        rows[rows.length - 1]!.push(curr);
      } else {
        rows.push([curr]);
      }
    }
    if (rows.length >= 2) {
      const cols = rows[0]!.length;
      if (cols >= 2 && rows.every((r) => r.length === cols)) {
        const rowGaps = rows.slice(1).map((r, i) => Math.min(...r.map((e) => e.y)) - Math.max(...rows[i]!.map((e) => e.y + e.height)));
        const colGaps = [...rows[0]!].sort((a, b) => a.x - b.x).slice(1).map((e, i) => e.x - (rows[0]![i]!.x + rows[0]![i]!.width));
        const gap = Math.round((rowGaps.reduce((a, b) => a + b, 0) / rowGaps.length + colGaps.reduce((a, b) => a + b, 0) / colGaps.length) / 2);
        return { kind: "grid", gap: Math.max(0, gap), columns: cols };
      }
    }
  }

  return { kind: "absolute", gap: 0 };
}

// ---- Tailwind class builder ----

function twClasses(el: DesignElement, ox: number, oy: number, reg: TokenRegistryService, isFlex: boolean): string {
  const c: string[] = [];
  if (!isFlex) {
    c.push("absolute", `left-[${Math.round(el.x - ox)}px]`, `top-[${Math.round(el.y - oy)}px]`);
  }
  c.push(`w-[${Math.round(el.width)}px]`, `h-[${Math.round(el.height)}px]`);

  if (el.type !== "text" && el.type !== "line") {
    const bg = reg.resolveColor(el.fill, "bg");
    if (bg) c.push(bg);
  }
  if (el.stroke && el.stroke !== "transparent" && el.strokeWidth > 0) {
    c.push(reg.resolveBorderWidth(el.strokeWidth), "border-solid");
    const bc = reg.resolveColor(el.stroke, "border");
    if (bc) c.push(bc);
  }
  if (el.type === "ellipse") c.push("rounded-full");
  else if (el.cornerRadius > 0) c.push(reg.resolveBorderRadius(el.cornerRadius));
  const op = reg.resolveOpacity(el.opacity);
  if (op) c.push(op);
  if (el.rotation !== 0) c.push(`rotate-[${el.rotation}deg]`);
  if (el.shadowColor && el.shadowBlur) {
    c.push(`shadow-[${el.shadowOffsetX ?? 0}px_${el.shadowOffsetY ?? 0}px_${el.shadowBlur}px_${el.shadowColor.replace(/ /g, "_")}]`);
  }
  if (el.type === "text") {
    const tc = reg.resolveColor(el.fill, "text");
    if (tc) c.push(tc);
    if (el.fontSize) c.push(reg.resolveFontSize(el.fontSize));
    if (el.fontWeight && el.fontWeight !== "400") c.push(reg.resolveFontWeight(el.fontWeight));
    if (el.textAlign === "center") c.push("text-center");
    if (el.textAlign === "right") c.push("text-right");
  }
  return c.join(" ");
}

function layoutTw(layout: LayoutInfo): string {
  const c: string[] = [];
  const gapMap: Record<number, string> = { 0: "gap-0", 4: "gap-1", 8: "gap-2", 12: "gap-3", 16: "gap-4", 20: "gap-5", 24: "gap-6", 32: "gap-8", 40: "gap-10", 48: "gap-12" };
  const gapCls = gapMap[layout.gap] ?? `gap-[${layout.gap}px]`;
  switch (layout.kind) {
    case "flex-row": c.push("flex flex-row", gapCls); if (layout.alignItems) c.push(layout.alignItems); break;
    case "flex-col": c.push("flex flex-col", gapCls); if (layout.alignItems) c.push(layout.alignItems); break;
    case "grid": {
      const colMap: Record<number, string> = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4", 5: "grid-cols-5", 6: "grid-cols-6" };
      c.push("grid", colMap[layout.columns ?? 1] ?? `grid-cols-[repeat(${layout.columns},1fr)]`, gapCls);
      break;
    }
  }
  return c.join(" ");
}

// ---- HTML generation ----

type Role = NonNullable<DesignElement["elementRole"]>;

function getRole(el: DesignElement): Role {
  if (el.elementRole && el.elementRole !== "auto") return el.elementRole;
  if (el.type === "text" && (el.fontSize ?? 16) >= 20) return "heading";
  if (el.type === "image") return "image";
  return "auto";
}

function textTag(fs: number | undefined): string {
  const s = fs ?? 16;
  if (s >= 32) return "h1"; if (s >= 24) return "h2"; if (s >= 20) return "h3"; if (s >= 16) return "p";
  return "span";
}

function nodeToJsx(
  node: ElementNode, ox: number, oy: number, indent: number,
  reg: TokenRegistryService, isFlex: boolean,
): string {
  const el = node.element;
  const pad = "      " + "  ".repeat(indent);
  const tw = twClasses(el, ox, oy, reg, isFlex);
  const role = getRole(el);

  if (el.type === "line") {
    const lc = el.stroke !== "transparent" ? el.stroke : el.fill;
    const bc = reg.resolveColor(lc, "border");
    const cls = [`absolute left-[${Math.round(el.x - ox)}px] top-[${Math.round(el.y - oy)}px] w-[${Math.round(el.width)}px]`, "border-0", `border-t-[${el.strokeWidth || 2}px]`, el.lineType === "dashed" ? "border-dashed" : "border-solid", bc ?? ""].filter(Boolean).join(" ");
    return `${pad}<hr className="${cls}" />`;
  }

  if (role === "input") {
    return `${pad}<input className="${tw}" type="text" placeholder="${escapeJsx(el.text ?? "")}" value={inputValue} onChange={(e) => setInputValue(e.target.value)} />`;
  }

  if (role === "image" || el.type === "image") {
    return `${pad}<img className="${tw}" src="" alt="${escapeJsx(el.name)}" />`;
  }

  const hasKids = node.children.length > 0;
  const layout = hasKids ? detectLayout(node.children) : null;
  const kidsFlex = layout !== null && layout.kind !== "absolute";
  let cls = tw;
  if (layout && layout.kind !== "absolute") cls += " " + layoutTw(layout);

  if (role === "button") {
    const content = el.text ? escapeJsx(el.text) : "";
    return `${pad}<button className="${tw}" onClick={handleClick}>${content}</button>`;
  }
  if (role === "link") {
    const content = el.text ? escapeJsx(el.text) : "";
    return `${pad}<a className="${tw}" href="#" onClick={handleClick}>${content}</a>`;
  }

  if (el.type === "text" || role === "heading") {
    const tag = textTag(el.fontSize);
    return `${pad}<${tag} className="${tw}">${escapeJsx(el.text ?? "")}</${tag}>`;
  }

  const tag = role === "container" ? "section" : "div";
  if (hasKids) {
    const lines = [`${pad}<${tag} className="${cls}">`];
    for (const child of node.children) {
      lines.push(nodeToJsx(child, el.x, el.y, indent + 1, reg, kidsFlex));
    }
    lines.push(`${pad}</${tag}>`);
    return lines.join("\n");
  }
  return `${pad}<${tag} className="${cls}"></${tag}>`;
}

// ---- Public API ----

function needsState(elements: DesignElement[]): { click: boolean; input: boolean } {
  let click = false, input = false;
  for (const el of elements) {
    const r = getRole(el);
    if (r === "button" || r === "link") click = true;
    if (r === "input") input = true;
  }
  return { click, input };
}

export function generateReactComponent(
  elements: DesignElement[],
  fileName: string,
  registry: TokenRegistryService,
): string {
  const visible = elements.filter((el) => el.visible);
  const name = sanitizeComponentName(fileName);

  if (visible.length === 0) {
    return `export default function ${name}() {\n  return <div>{/* No design elements */}</div>;\n}\n`;
  }

  const { offsetX, offsetY } = computeOffset(visible);
  const { width, height } = computeBounds(visible);
  const tree = buildElementTree(elements);
  const rootLayout = detectLayout(tree);
  const isRootFlex = rootLayout.kind !== "absolute";

  const lines: string[] = [];
  for (const node of tree) {
    lines.push(nodeToJsx(node, offsetX, offsetY, 0, registry, isRootFlex));
  }

  let rootCls = `relative w-[${Math.round(width)}px] h-[${Math.round(height)}px]`;
  if (isRootFlex) rootCls = `w-[${Math.round(width)}px] ${layoutTw(rootLayout)}`;

  const { click, input } = needsState(visible);
  const imports: string[] = [];
  const stateLines: string[] = [];

  if (click || input) {
    imports.push(`import { useState } from 'react';`);
  }
  if (click) {
    stateLines.push("  const handleClick = () => { /* TODO */ };");
  }
  if (input) {
    stateLines.push("  const [inputValue, setInputValue] = useState('');");
  }

  const importBlock = imports.length > 0 ? imports.join("\n") + "\n\n" : "";
  const stateBlock = stateLines.length > 0 ? stateLines.join("\n") + "\n\n" : "";

  return `${importBlock}/**
 * Generated by Atelier — React + Tailwind export.
 * Smart layout: ${rootLayout.kind}.
 */
export default function ${name}() {
${stateBlock}  return (
    <div className="${rootCls}">
${lines.join("\n")}
    </div>
  );
}
`;
}
