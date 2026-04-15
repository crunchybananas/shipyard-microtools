/**
 * Export as standalone HTML
 *
 * Converts Atelier DesignElement[] into a single self-contained HTML file
 * with Tailwind CSS via CDN. No framework dependencies — just open in a browser.
 *
 * Reuses the same layout detection, element tree building, and semantic role
 * logic from export-ember-component.ts.
 */

import type { DesignElement } from "atelier/services/design-store";

// ============================================================
// Types (mirrored from export-ember-component.ts)
// ============================================================

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

// ============================================================
// Utilities
// ============================================================

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildElementTree(elements: DesignElement[]): ElementNode[] {
  const visible = elements.filter((el) => el.visible);
  const nodeMap = new Map<string, ElementNode>();

  for (const el of visible) {
    nodeMap.set(el.id, { element: el, children: [] });
  }

  const roots: ElementNode[] = [];

  for (const el of visible) {
    const node = nodeMap.get(el.id)!;
    if (el.parentId && nodeMap.has(el.parentId)) {
      nodeMap.get(el.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function computeOffset(elements: DesignElement[]): { offsetX: number; offsetY: number } {
  const visible = elements.filter((el) => el.visible);
  if (visible.length === 0) return { offsetX: 0, offsetY: 0 };

  let minX = Infinity;
  let minY = Infinity;
  for (const el of visible) {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
  }
  return { offsetX: minX, offsetY: minY };
}

function computeBounds(elements: DesignElement[]): { width: number; height: number } {
  const visible = elements.filter((el) => el.visible);
  if (visible.length === 0) return { width: 800, height: 600 };

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const el of visible) {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + el.width);
    maxY = Math.max(maxY, el.y + el.height);
  }
  return { width: maxX - minX, height: maxY - minY };
}

// ============================================================
// Smart Layout Detection (same algorithm as export-ember-component.ts)
// ============================================================

const POSITION_TOLERANCE = 8;
const GAP_TOLERANCE = 6;

function detectLayout(children: ElementNode[], parentHeight: number): LayoutInfo {
  if (children.length < 2) {
    return { kind: "absolute", gap: 0 };
  }

  const els = children.map((n) => n.element);

  const rowResult = detectFlexRow(els, parentHeight);
  if (rowResult) return rowResult;

  const colResult = detectFlexColumn(els);
  if (colResult) return colResult;

  const gridResult = detectGrid(els);
  if (gridResult) return gridResult;

  return { kind: "absolute", gap: 0 };
}

function detectFlexRow(els: DesignElement[], parentHeight: number): LayoutInfo | null {
  const centers = els.map((el) => el.y + el.height / 2);
  const avgCenter = centers.reduce((a, b) => a + b, 0) / centers.length;
  const maxDeviation = Math.max(...centers.map((c) => Math.abs(c - avgCenter)));

  const maxHeight = Math.max(...els.map((el) => el.height));
  const tolerance = Math.max(POSITION_TOLERANCE, maxHeight * 0.4);

  if (maxDeviation > tolerance) return null;

  const sorted = [...els].sort((a, b) => a.x - b.x);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i]!.x - (sorted[i - 1]!.x + sorted[i - 1]!.width);
    gaps.push(gap);
  }

  if (gaps.some((g) => g < -POSITION_TOLERANCE)) return null;

  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const gapConsistent = gaps.every((g) => Math.abs(g - avgGap) <= GAP_TOLERANCE);
  const gap = Math.round(avgGap);

  const tops = els.map((el) => el.y);
  const bottoms = els.map((el) => el.y + el.height);
  const minTop = Math.min(...tops);
  const maxBottom = Math.max(...bottoms);

  let alignItems = "items-start";
  const allSameTop = tops.every((t) => Math.abs(t - minTop) <= POSITION_TOLERANCE);
  const allSameBottom = bottoms.every((b) => Math.abs(b - maxBottom) <= POSITION_TOLERANCE);
  const allCentered = maxDeviation <= POSITION_TOLERANCE;

  if (allSameTop && allSameBottom) {
    alignItems = "items-stretch";
  } else if (allCentered) {
    alignItems = "items-center";
  } else if (allSameBottom) {
    alignItems = "items-end";
  }

  let justifyContent = "";
  if (parentHeight > 0 && sorted.length >= 3 && gapConsistent) {
    const firstStart = sorted[0]!.x;
    const lastEnd = sorted[sorted.length - 1]!.x + sorted[sorted.length - 1]!.width;
    const span = lastEnd - firstStart;
    if (span > parentHeight * 0.7) {
      justifyContent = "justify-between";
    }
  }

  return {
    kind: "flex-row",
    gap: Math.max(0, gap),
    alignItems,
    justifyContent,
  };
}

function detectFlexColumn(els: DesignElement[]): LayoutInfo | null {
  const centers = els.map((el) => el.x + el.width / 2);
  const avgCenter = centers.reduce((a, b) => a + b, 0) / centers.length;
  const maxDeviation = Math.max(...centers.map((c) => Math.abs(c - avgCenter)));

  const maxWidth = Math.max(...els.map((el) => el.width));
  const tolerance = Math.max(POSITION_TOLERANCE, maxWidth * 0.4);

  if (maxDeviation > tolerance) {
    const lefts = els.map((el) => el.x);
    const minLeft = Math.min(...lefts);
    const allLeftAligned = lefts.every((l) => Math.abs(l - minLeft) <= POSITION_TOLERANCE);
    if (!allLeftAligned) return null;
  }

  const sorted = [...els].sort((a, b) => a.y - b.y);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i]!.y - (sorted[i - 1]!.y + sorted[i - 1]!.height);
    gaps.push(gap);
  }

  if (gaps.some((g) => g < -POSITION_TOLERANCE)) return null;

  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const gap = Math.round(avgGap);

  const lefts = els.map((el) => el.x);
  const rights = els.map((el) => el.x + el.width);
  const minLeft = Math.min(...lefts);
  const maxRight = Math.max(...rights);

  let alignItems = "items-start";
  const allSameLeft = lefts.every((l) => Math.abs(l - minLeft) <= POSITION_TOLERANCE);
  const allSameRight = rights.every((r) => Math.abs(r - maxRight) <= POSITION_TOLERANCE);
  const xCenters = els.map((el) => el.x + el.width / 2);
  const avgXCenter = xCenters.reduce((a, b) => a + b, 0) / xCenters.length;
  const allXCentered = xCenters.every((c) => Math.abs(c - avgXCenter) <= POSITION_TOLERANCE);

  if (allSameLeft && allSameRight) {
    alignItems = "items-stretch";
  } else if (allXCentered) {
    alignItems = "items-center";
  } else if (allSameRight) {
    alignItems = "items-end";
  }

  return {
    kind: "flex-col",
    gap: Math.max(0, gap),
    alignItems,
  };
}

function detectGrid(els: DesignElement[]): LayoutInfo | null {
  if (els.length < 4) return null;

  const sorted = [...els].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: DesignElement[][] = [];
  let currentRow: DesignElement[] = [sorted[0]!];

  for (let i = 1; i < sorted.length; i++) {
    const prev = currentRow[0]!;
    const curr = sorted[i]!;
    const prevCenter = prev.y + prev.height / 2;
    const currCenter = curr.y + curr.height / 2;
    if (Math.abs(currCenter - prevCenter) <= Math.max(POSITION_TOLERANCE, prev.height * 0.4)) {
      currentRow.push(curr);
    } else {
      rows.push(currentRow);
      currentRow = [curr];
    }
  }
  rows.push(currentRow);

  if (rows.length < 2) return null;

  const colCount = rows[0]!.length;
  if (colCount < 2) return null;
  if (!rows.every((r) => r.length === colCount)) return null;

  const rowGaps: number[] = [];
  for (let i = 1; i < rows.length; i++) {
    const prevBottom = Math.max(...rows[i - 1]!.map((el) => el.y + el.height));
    const currTop = Math.min(...rows[i]!.map((el) => el.y));
    rowGaps.push(currTop - prevBottom);
  }
  const avgRowGap = rowGaps.reduce((a, b) => a + b, 0) / rowGaps.length;

  const firstRow = [...rows[0]!].sort((a, b) => a.x - b.x);
  const colGaps: number[] = [];
  for (let i = 1; i < firstRow.length; i++) {
    colGaps.push(firstRow[i]!.x - (firstRow[i - 1]!.x + firstRow[i - 1]!.width));
  }
  const avgColGap = colGaps.reduce((a, b) => a + b, 0) / colGaps.length;

  const gap = Math.round((avgRowGap + avgColGap) / 2);

  return {
    kind: "grid",
    gap: Math.max(0, gap),
    columns: colCount,
  };
}

// ============================================================
// Semantic HTML tags
// ============================================================

type ElementRole = NonNullable<DesignElement["elementRole"]>;

function getEffectiveRole(el: DesignElement): ElementRole {
  if (el.elementRole && el.elementRole !== "auto") return el.elementRole;
  if (el.type === "text") {
    const size = el.fontSize ?? 16;
    if (size >= 20) return "heading";
  }
  if (el.type === "image") return "image";
  return "auto";
}

function textTag(fontSize: number | undefined): string {
  const size = fontSize ?? 16;
  if (size >= 32) return "h1";
  if (size >= 24) return "h2";
  if (size >= 20) return "h3";
  if (size >= 16) return "p";
  return "span";
}

function semanticTag(el: DesignElement): string {
  const role = getEffectiveRole(el);
  switch (role) {
    case "button": return "button";
    case "link": return "a";
    case "input": return "input";
    case "heading": return textTag(el.fontSize);
    case "container": return "section";
    case "image": return "img";
    default:
      if (el.type === "text") return textTag(el.fontSize);
      if (el.type === "frame") return "section";
      return "div";
  }
}

function semanticAttributes(el: DesignElement): string {
  const role = getEffectiveRole(el);
  switch (role) {
    case "button": return ' type="button"';
    case "link": return ' href="#"';
    case "input": return ` type="text" placeholder="${escapeHtml(el.text ?? "")}"`;
    case "image": return ` src="" alt="${escapeHtml(el.name)}"`;
    default: return "";
  }
}

// ============================================================
// Tailwind class building (standalone — no token registry needed)
// ============================================================

const TAILWIND_COLORS: Record<string, string> = {
  "#000000": "black", "#ffffff": "white",
  "#f87171": "red-400", "#ef4444": "red-500", "#dc2626": "red-600", "#b91c1c": "red-700",
  "#fb923c": "orange-400", "#f97316": "orange-500", "#ea580c": "orange-600",
  "#fbbf24": "amber-400", "#f59e0b": "amber-500", "#d97706": "amber-600",
  "#a3e635": "lime-400", "#84cc16": "lime-500", "#65a30d": "lime-600",
  "#4ade80": "green-400", "#22c55e": "green-500", "#16a34a": "green-600",
  "#34d399": "emerald-400", "#10b981": "emerald-500", "#059669": "emerald-600",
  "#2dd4bf": "teal-400", "#14b8a6": "teal-500", "#0d9488": "teal-600",
  "#22d3ee": "cyan-400", "#06b6d4": "cyan-500", "#0891b2": "cyan-600",
  "#38bdf8": "sky-400", "#0ea5e9": "sky-500", "#0284c7": "sky-600",
  "#60a5fa": "blue-400", "#3b82f6": "blue-500", "#2563eb": "blue-600", "#1d4ed8": "blue-700",
  "#818cf8": "indigo-400", "#6366f1": "indigo-500", "#4f46e5": "indigo-600",
  "#a78bfa": "violet-400", "#8b5cf6": "violet-500", "#7c3aed": "violet-600",
  "#c084fc": "purple-400", "#a855f7": "purple-500", "#9333ea": "purple-600",
  "#e879f9": "fuchsia-400", "#d946ef": "fuchsia-500", "#c026d3": "fuchsia-600",
  "#f472b6": "pink-400", "#ec4899": "pink-500", "#db2777": "pink-600",
  "#f43f5e": "rose-500", "#e11d48": "rose-600",
  // Grays
  "#f9fafb": "gray-50", "#f3f4f6": "gray-100", "#e5e7eb": "gray-200",
  "#d1d5db": "gray-300", "#9ca3af": "gray-400", "#6b7280": "gray-500",
  "#4b5563": "gray-600", "#374151": "gray-700", "#1f2937": "gray-800",
  "#111827": "gray-900",
  // Slate
  "#f8fafc": "slate-50", "#f1f5f9": "slate-100", "#e2e8f0": "slate-200",
  "#cbd5e1": "slate-300", "#94a3b8": "slate-400", "#64748b": "slate-500",
  "#475569": "slate-600", "#334155": "slate-700", "#1e293b": "slate-800",
  "#0f172a": "slate-900",
  // Zinc
  "#fafafa": "zinc-50", "#f4f4f5": "zinc-100", "#e4e4e7": "zinc-200",
  "#d4d4d8": "zinc-300", "#a1a1aa": "zinc-400", "#71717a": "zinc-500",
  "#52525b": "zinc-600", "#3f3f46": "zinc-700", "#27272a": "zinc-800",
  "#18181b": "zinc-900",
};

function resolveColor(hex: string, prefix: "bg" | "text" | "border"): string | null {
  if (!hex || hex === "transparent") return null;
  const lower = hex.toLowerCase();
  const name = TAILWIND_COLORS[lower];
  if (name) return `${prefix}-${name}`;
  // Arbitrary value fallback
  return `${prefix}-[${lower}]`;
}

function resolveFontSize(size: number): string {
  const map: Record<number, string> = {
    12: "text-xs", 14: "text-sm", 16: "text-base", 18: "text-lg",
    20: "text-xl", 24: "text-2xl", 30: "text-3xl", 36: "text-4xl",
    48: "text-5xl", 60: "text-6xl", 72: "text-7xl", 96: "text-8xl",
  };
  return map[size] ?? `text-[${size}px]`;
}

function resolveFontWeight(weight: string): string {
  const map: Record<string, string> = {
    "100": "font-thin", "200": "font-extralight", "300": "font-light",
    "400": "font-normal", "500": "font-medium", "600": "font-semibold",
    "700": "font-bold", "800": "font-extrabold", "900": "font-black",
    "bold": "font-bold", "normal": "font-normal",
  };
  return map[weight] ?? `font-[${weight}]`;
}

function resolveBorderRadius(radius: number): string {
  const map: Record<number, string> = {
    2: "rounded-sm", 4: "rounded", 6: "rounded-md", 8: "rounded-lg",
    12: "rounded-xl", 16: "rounded-2xl", 24: "rounded-3xl",
  };
  if (radius >= 9999) return "rounded-full";
  return map[radius] ?? `rounded-[${radius}px]`;
}

function resolveOpacity(opacity: number): string | null {
  if (opacity >= 1) return null;
  const pct = Math.round(opacity * 100);
  const map: Record<number, string> = {
    0: "opacity-0", 5: "opacity-5", 10: "opacity-10", 15: "opacity-15",
    20: "opacity-20", 25: "opacity-25", 30: "opacity-30", 35: "opacity-35",
    40: "opacity-40", 45: "opacity-45", 50: "opacity-50", 55: "opacity-55",
    60: "opacity-60", 65: "opacity-65", 70: "opacity-70", 75: "opacity-75",
    80: "opacity-80", 85: "opacity-85", 90: "opacity-90", 95: "opacity-95",
  };
  return map[pct] ?? `opacity-[${opacity}]`;
}

// ============================================================
// Tailwind class generation per element
// ============================================================

function buildTailwindClasses(
  el: DesignElement,
  offsetX: number,
  offsetY: number,
  isFlexChild: boolean,
): string {
  const classes: string[] = [];

  if (!isFlexChild) {
    classes.push("absolute");
    classes.push(`left-[${Math.round(el.x - offsetX)}px]`);
    classes.push(`top-[${Math.round(el.y - offsetY)}px]`);
  }
  classes.push(`w-[${Math.round(el.width)}px]`);
  classes.push(`h-[${Math.round(el.height)}px]`);

  if (el.type !== "text" && el.type !== "line") {
    const bgClass = resolveColor(el.fill, "bg");
    if (bgClass) classes.push(bgClass);
  }

  if (el.stroke && el.stroke !== "transparent" && el.strokeWidth > 0) {
    classes.push(`border-[${el.strokeWidth}px]`);
    classes.push("border-solid");
    const borderColor = resolveColor(el.stroke, "border");
    if (borderColor) classes.push(borderColor);
  }

  if (el.type === "ellipse") {
    classes.push("rounded-full");
  } else if (el.cornerRadius > 0) {
    classes.push(resolveBorderRadius(el.cornerRadius));
  }

  const opacityClass = resolveOpacity(el.opacity);
  if (opacityClass) classes.push(opacityClass);

  if (el.rotation !== 0) {
    classes.push(`rotate-[${el.rotation}deg]`);
  }

  if (el.shadowColor && el.shadowBlur) {
    const sx = el.shadowOffsetX ?? 0;
    const sy = el.shadowOffsetY ?? 0;
    classes.push(`shadow-[${sx}px_${sy}px_${el.shadowBlur}px_${el.shadowColor.replace(/ /g, "_")}]`);
  }

  if (el.type === "text") {
    const textColor = resolveColor(el.fill, "text");
    if (textColor) classes.push(textColor);
    if (el.fontSize) classes.push(resolveFontSize(el.fontSize));
    if (el.fontWeight && el.fontWeight !== "400") classes.push(resolveFontWeight(el.fontWeight));
    if (el.fontFamily) classes.push(`font-[${el.fontFamily.split(",")[0]!.trim().replace(/ /g, "_")}]`);
    if (el.textAlign === "center") classes.push("text-center");
    if (el.textAlign === "right") classes.push("text-right");
  }

  return classes.join(" ");
}

function layoutClassesTailwind(layout: LayoutInfo): string {
  const classes: string[] = [];
  const gapMap: Record<number, string> = {
    0: "gap-0", 1: "gap-px", 2: "gap-0.5", 4: "gap-1", 6: "gap-1.5",
    8: "gap-2", 10: "gap-2.5", 12: "gap-3", 14: "gap-3.5", 16: "gap-4",
    20: "gap-5", 24: "gap-6", 28: "gap-7", 32: "gap-8", 36: "gap-9",
    40: "gap-10", 48: "gap-12", 56: "gap-14", 64: "gap-16",
  };

  switch (layout.kind) {
    case "flex-row":
      classes.push("flex", "flex-row");
      if (layout.gap > 0) classes.push(gapMap[layout.gap] ?? `gap-[${layout.gap}px]`);
      if (layout.alignItems) classes.push(layout.alignItems);
      if (layout.justifyContent) classes.push(layout.justifyContent);
      break;
    case "flex-col":
      classes.push("flex", "flex-col");
      if (layout.gap > 0) classes.push(gapMap[layout.gap] ?? `gap-[${layout.gap}px]`);
      if (layout.alignItems) classes.push(layout.alignItems);
      break;
    case "grid": {
      classes.push("grid");
      const colMap: Record<number, string> = {
        1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3",
        4: "grid-cols-4", 5: "grid-cols-5", 6: "grid-cols-6",
      };
      classes.push(colMap[layout.columns ?? 1] ?? `grid-cols-[repeat(${layout.columns},1fr)]`);
      if (layout.gap > 0) classes.push(gapMap[layout.gap] ?? `gap-[${layout.gap}px]`);
      break;
    }
  }
  return classes.join(" ");
}

// ============================================================
// Element-to-HTML rendering
// ============================================================

function elementToHTML(
  node: ElementNode,
  offsetX: number,
  offsetY: number,
  indent: number,
  isFlexChild: boolean,
): string {
  const el = node.element;
  const pad = "    " + "  ".repeat(indent);
  const tw = buildTailwindClasses(el, offsetX, offsetY, isFlexChild);
  const tag = semanticTag(el);
  const attrs = semanticAttributes(el);
  const role = getEffectiveRole(el);

  // Lines
  if (el.type === "line") {
    const lineColor = el.stroke !== "transparent" ? el.stroke : el.fill;
    const borderColor = resolveColor(lineColor, "border");
    const lineClasses = [
      "absolute",
      `left-[${Math.round(el.x - offsetX)}px]`,
      `top-[${Math.round(el.y - offsetY)}px]`,
      `w-[${Math.round(el.width)}px]`,
      "border-0",
      `border-t-[${el.strokeWidth || 2}px]`,
      el.lineType === "dashed" ? "border-dashed" : "border-solid",
      borderColor ?? "",
    ].filter(Boolean).join(" ");
    return `${pad}<hr class="${lineClasses}" />`;
  }

  // Inputs (self-closing)
  if (role === "input") {
    return `${pad}<${tag} class="${tw}"${attrs} />`;
  }

  // Images (self-closing)
  if (role === "image" || el.type === "image") {
    return `${pad}<img class="${tw}" src="" alt="${escapeHtml(el.name)}" />`;
  }

  const hasChildren = node.children.length > 0;
  const layout = hasChildren ? detectLayout(node.children, el.height) : null;
  const isChildFlex = layout !== null && layout.kind !== "absolute";

  // Container classes = element classes + layout classes
  let containerClasses = tw;
  if (layout && layout.kind !== "absolute") {
    containerClasses += " " + layoutClassesTailwind(layout);
  }

  // Text elements
  if (el.type === "text" || role === "heading") {
    const content = escapeHtml(el.text ?? "");
    return `${pad}<${tag} class="${tw}"${attrs}>${content}</${tag}>`;
  }

  // Buttons and links
  if (role === "button" || role === "link") {
    const content = el.text ? escapeHtml(el.text) : "";
    if (hasChildren) {
      const lines = [`${pad}<${tag} class="${containerClasses}"${attrs}>`];
      if (content) lines.push(`${pad}  ${content}`);
      for (const child of node.children) {
        lines.push(elementToHTML(child, el.x, el.y, indent + 1, isChildFlex));
      }
      lines.push(`${pad}</${tag}>`);
      return lines.join("\n");
    }
    return `${pad}<${tag} class="${tw}"${attrs}>${content}</${tag}>`;
  }

  // Containers with children
  if (hasChildren) {
    const lines = [`${pad}<${tag} class="${containerClasses}"${attrs}>`];
    for (const child of node.children) {
      lines.push(elementToHTML(child, el.x, el.y, indent + 1, isChildFlex));
    }
    lines.push(`${pad}</${tag}>`);
    return lines.join("\n");
  }

  // Empty element
  return `${pad}<${tag} class="${tw}"${attrs}></${tag}>`;
}

// ============================================================
// Main export function
// ============================================================

export function generateHTML(
  elements: DesignElement[],
  projectName: string,
): string {
  const visible = elements.filter((el) => el.visible);

  if (visible.length === 0) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(projectName)}</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
</head>
<body class="min-h-screen bg-gray-50 flex items-center justify-center">
  <p class="text-gray-400 text-lg">No design elements to export.</p>
</body>
</html>
`;
  }

  const { offsetX, offsetY } = computeOffset(visible);
  const { width, height } = computeBounds(visible);
  const tree = buildElementTree(elements);

  // Detect layout for root-level children
  const rootLayout = detectLayout(tree, height);
  const isRootFlex = rootLayout.kind !== "absolute";

  const htmlLines: string[] = [];
  for (const node of tree) {
    htmlLines.push(elementToHTML(node, offsetX, offsetY, 0, isRootFlex));
  }

  const bodyHTML = htmlLines.join("\n");

  // Build root container classes
  let rootClasses = `relative w-[${Math.round(width)}px] h-[${Math.round(height)}px]`;
  if (isRootFlex) {
    rootClasses = `w-[${Math.round(width)}px] ${layoutClassesTailwind(rootLayout)}`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(projectName)}</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <style>
    /* Generated by Atelier — design-to-code export */
    /* Layout: ${rootLayout.kind}${rootLayout.kind === "grid" ? ` (${rootLayout.columns} cols)` : ""} */
    body {
      margin: 0;
      padding: 2rem;
      background: #f8fafc;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      min-height: 100vh;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
  </style>
</head>
<body>
  <div class="${rootClasses}">
${bodyHTML}
  </div>
</body>
</html>
`;
}
