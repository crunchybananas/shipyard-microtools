/**
 * Export as Ember Component
 *
 * Converts Atelier DesignElement[] into a valid Glimmer .gts component file
 * that can be dropped directly into an Ember application.
 *
 * Features:
 * - Smart layout detection: flex rows, columns, and CSS grid from element positions
 * - Semantic HTML: element roles generate proper tags with Glimmer event handlers
 * - Tailwind-first: uses utility classes with token registry resolution
 */

import type { DesignElement } from "atelier/services/design-store";
import type TokenRegistryService from "atelier/services/token-registry";

// ============================================================
// Types
// ============================================================

interface ElementNode {
  element: DesignElement;
  children: ElementNode[];
}

type LayoutKind = "absolute" | "flex-row" | "flex-col" | "grid";

interface LayoutInfo {
  kind: LayoutKind;
  gap: number;
  columns?: number; // for grid
  alignItems?: string; // flex cross-axis alignment
  justifyContent?: string; // flex main-axis distribution
  wrap?: boolean;
}

// ============================================================
// Utilities
// ============================================================

function sanitizeClassName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "element";
}

function deduplicateClassNames(elements: DesignElement[]): Map<string, string> {
  const nameMap = new Map<string, string>();
  const counts = new Map<string, number>();

  for (const el of elements) {
    let className = sanitizeClassName(el.name);
    const count = counts.get(className) ?? 0;
    counts.set(className, count + 1);
    if (count > 0) {
      className = `${className}-${count + 1}`;
    }
    nameMap.set(el.id, className);
  }

  return nameMap;
}

function sanitizeComponentName(fileName: string): string {
  const cleaned = fileName
    .replace(/[^a-zA-Z0-9\s-_]/g, "")
    .trim()
    || "AtelierDesign";

  return cleaned
    .split(/[\s\-_]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");
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

function textTag(fontSize: number | undefined): string {
  const size = fontSize ?? 16;
  if (size >= 32) return "h1";
  if (size >= 24) return "h2";
  if (size >= 20) return "h3";
  if (size >= 16) return "p";
  return "span";
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ============================================================
// Smart Layout Detection
// ============================================================

const POSITION_TOLERANCE = 8; // px tolerance for "same row/column"
const GAP_TOLERANCE = 6; // px tolerance for consistent gaps

/**
 * Detect whether a set of sibling elements form a row, column, grid,
 * or need absolute positioning.
 */
function detectLayout(children: ElementNode[], parentHeight: number): LayoutInfo {
  if (children.length < 2) {
    return { kind: "absolute", gap: 0 };
  }

  const els = children.map((n) => n.element);

  // Try row detection first (most common in UI)
  const rowResult = detectFlexRow(els, parentHeight);
  if (rowResult) return rowResult;

  // Try column detection
  const colResult = detectFlexColumn(els);
  if (colResult) return colResult;

  // Try grid detection (multiple rows of items)
  const gridResult = detectGrid(els);
  if (gridResult) return gridResult;

  return { kind: "absolute", gap: 0 };
}

/**
 * Check if elements form a horizontal row.
 * Elements should share similar Y centers and be ordered by X.
 */
function detectFlexRow(els: DesignElement[], parentHeight: number): LayoutInfo | null {
  // Check if all elements have similar vertical center
  const centers = els.map((el) => el.y + el.height / 2);
  const avgCenter = centers.reduce((a, b) => a + b, 0) / centers.length;
  const maxDeviation = Math.max(...centers.map((c) => Math.abs(c - avgCenter)));

  // Allow tolerance proportional to the tallest element
  const maxHeight = Math.max(...els.map((el) => el.height));
  const tolerance = Math.max(POSITION_TOLERANCE, maxHeight * 0.4);

  if (maxDeviation > tolerance) return null;

  // Sort by X position and check for consistent gaps
  const sorted = [...els].sort((a, b) => a.x - b.x);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i]!.x - (sorted[i - 1]!.x + sorted[i - 1]!.width);
    gaps.push(gap);
  }

  // Check for overlapping elements (negative gaps indicate non-flex layout)
  if (gaps.some((g) => g < -POSITION_TOLERANCE)) return null;

  // Detect consistent gap
  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const gapConsistent = gaps.every((g) => Math.abs(g - avgGap) <= GAP_TOLERANCE);
  const gap = gapConsistent ? Math.round(avgGap) : Math.round(avgGap);

  // Detect cross-axis alignment
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

  // Detect main-axis distribution
  let justifyContent = "";

  // Check if items are evenly distributed across the parent
  if (parentHeight > 0 && sorted.length >= 3 && gapConsistent) {
    const firstStart = sorted[0]!.x;
    const lastEnd = sorted[sorted.length - 1]!.x + sorted[sorted.length - 1]!.width;
    const span = lastEnd - firstStart;
    // If items span most of parent width with even gaps, likely justify-between
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

/**
 * Check if elements form a vertical column.
 */
function detectFlexColumn(els: DesignElement[]): LayoutInfo | null {
  // Check if all elements have similar horizontal center
  const centers = els.map((el) => el.x + el.width / 2);
  const avgCenter = centers.reduce((a, b) => a + b, 0) / centers.length;
  const maxDeviation = Math.max(...centers.map((c) => Math.abs(c - avgCenter)));

  const maxWidth = Math.max(...els.map((el) => el.width));
  const tolerance = Math.max(POSITION_TOLERANCE, maxWidth * 0.4);

  if (maxDeviation > tolerance) {
    // Also try: all elements left-aligned or all same width (stretch)
    const lefts = els.map((el) => el.x);
    const minLeft = Math.min(...lefts);
    const allLeftAligned = lefts.every((l) => Math.abs(l - minLeft) <= POSITION_TOLERANCE);

    if (!allLeftAligned) return null;
  }

  // Sort by Y position and check gaps
  const sorted = [...els].sort((a, b) => a.y - b.y);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i]!.y - (sorted[i - 1]!.y + sorted[i - 1]!.height);
    gaps.push(gap);
  }

  if (gaps.some((g) => g < -POSITION_TOLERANCE)) return null;

  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const gap = Math.round(avgGap);

  // Detect cross-axis alignment
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

/**
 * Detect a grid layout: multiple rows with the same number of columns.
 */
function detectGrid(els: DesignElement[]): LayoutInfo | null {
  if (els.length < 4) return null;

  // Group elements into rows by Y position
  const sorted = [...els].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: DesignElement[][] = [];
  let currentRow: DesignElement[] = [sorted[0]!];

  for (let i = 1; i < sorted.length; i++) {
    const prev = currentRow[0]!;
    const curr = sorted[i]!;
    // Same row if Y centers are close
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

  // Check if all rows have the same number of columns
  const colCount = rows[0]!.length;
  if (colCount < 2) return null;
  if (!rows.every((r) => r.length === colCount)) return null;

  // Detect row gap
  const rowGaps: number[] = [];
  for (let i = 1; i < rows.length; i++) {
    const prevBottom = Math.max(...rows[i - 1]!.map((el) => el.y + el.height));
    const currTop = Math.min(...rows[i]!.map((el) => el.y));
    rowGaps.push(currTop - prevBottom);
  }
  const avgRowGap = rowGaps.reduce((a, b) => a + b, 0) / rowGaps.length;

  // Detect column gap from first row
  const firstRow = [...rows[0]!].sort((a, b) => a.x - b.x);
  const colGaps: number[] = [];
  for (let i = 1; i < firstRow.length; i++) {
    colGaps.push(firstRow[i]!.x - (firstRow[i - 1]!.x + firstRow[i - 1]!.width));
  }
  const avgColGap = colGaps.reduce((a, b) => a + b, 0) / colGaps.length;

  // Use the average of row and column gaps
  const gap = Math.round((avgRowGap + avgColGap) / 2);

  return {
    kind: "grid",
    gap: Math.max(0, gap),
    columns: colCount,
  };
}

// ============================================================
// Semantic HTML + Element Roles
// ============================================================

type ElementRole = NonNullable<DesignElement["elementRole"]>;

function getEffectiveRole(el: DesignElement): ElementRole {
  if (el.elementRole && el.elementRole !== "auto") return el.elementRole;
  // Auto-detect from element properties
  if (el.type === "text") {
    const size = el.fontSize ?? 16;
    if (size >= 20) return "heading";
  }
  if (el.type === "image") return "image";
  return "auto";
}

/**
 * Get the semantic HTML tag for an element based on its role.
 */
function roleTag(el: DesignElement): string {
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
      return "div";
  }
}

/**
 * Get additional HTML attributes for a role.
 */
function roleAttributes(el: DesignElement): string {
  const role = getEffectiveRole(el);
  switch (role) {
    case "button": return ' type="button" {{on "click" this.handleClick}}';
    case "link": return ' href="#" {{on "click" this.handleClick}}';
    case "input": return ` type="text" placeholder="${escapeHtml(el.text ?? "")}" value={{this.inputValue}} {{on "input" this.onInput}}`;
    case "image": return ` src="" alt="${escapeHtml(el.name)}"`;
    default: return "";
  }
}

/**
 * Check if any element in the tree uses interactive roles that need state.
 */
function needsInteractiveState(elements: DesignElement[]): { needsClick: boolean; needsInput: boolean } {
  let needsClick = false;
  let needsInput = false;
  for (const el of elements) {
    const role = getEffectiveRole(el);
    if (role === "button" || role === "link") needsClick = true;
    if (role === "input") needsInput = true;
  }
  return { needsClick, needsInput };
}

// ============================================================
// Inline Style Export (with layout detection)
// ============================================================

function buildInlineStyle(el: DesignElement, offsetX: number, offsetY: number, isFlexChild: boolean): string {
  const styles: string[] = [];

  if (!isFlexChild) {
    styles.push("position: absolute");
    styles.push(`left: ${Math.round(el.x - offsetX)}px`);
    styles.push(`top: ${Math.round(el.y - offsetY)}px`);
  }
  styles.push(`width: ${Math.round(el.width)}px`);
  styles.push(`height: ${Math.round(el.height)}px`);

  if (el.type !== "text" && el.type !== "line") {
    if (el.fill && el.fill !== "transparent") {
      styles.push(`background-color: ${el.fill}`);
    }
  }

  if (el.stroke && el.stroke !== "transparent" && el.strokeWidth > 0) {
    styles.push(`border: ${el.strokeWidth}px solid ${el.stroke}`);
  }

  if (el.type === "ellipse") {
    styles.push("border-radius: 50%");
  } else if (el.cornerRadius > 0) {
    styles.push(`border-radius: ${el.cornerRadius}px`);
  }

  if (el.opacity < 1) {
    styles.push(`opacity: ${el.opacity}`);
  }

  if (el.rotation !== 0) {
    styles.push(`transform: rotate(${el.rotation}deg)`);
  }

  if (el.shadowColor && el.shadowBlur) {
    const sx = el.shadowOffsetX ?? 0;
    const sy = el.shadowOffsetY ?? 0;
    styles.push(`box-shadow: ${sx}px ${sy}px ${el.shadowBlur}px ${el.shadowColor}`);
  }

  if (el.type === "text") {
    if (el.fill && el.fill !== "transparent") {
      styles.push(`color: ${el.fill}`);
    }
    if (el.fontSize) styles.push(`font-size: ${el.fontSize}px`);
    if (el.fontWeight && el.fontWeight !== "400") styles.push(`font-weight: ${el.fontWeight}`);
    if (el.fontFamily) styles.push(`font-family: ${el.fontFamily}`);
    if (el.textAlign && el.textAlign !== "left") styles.push(`text-align: ${el.textAlign}`);
  }

  return styles.join("; ");
}

function layoutStyleInline(layout: LayoutInfo): string {
  const parts: string[] = [];
  switch (layout.kind) {
    case "flex-row":
      parts.push("display: flex");
      parts.push("flex-direction: row");
      if (layout.gap > 0) parts.push(`gap: ${layout.gap}px`);
      if (layout.alignItems) {
        const map: Record<string, string> = {
          "items-start": "flex-start", "items-center": "center",
          "items-end": "flex-end", "items-stretch": "stretch",
        };
        parts.push(`align-items: ${map[layout.alignItems] ?? "flex-start"}`);
      }
      if (layout.justifyContent === "justify-between") parts.push("justify-content: space-between");
      break;
    case "flex-col":
      parts.push("display: flex");
      parts.push("flex-direction: column");
      if (layout.gap > 0) parts.push(`gap: ${layout.gap}px`);
      if (layout.alignItems) {
        const map: Record<string, string> = {
          "items-start": "flex-start", "items-center": "center",
          "items-end": "flex-end", "items-stretch": "stretch",
        };
        parts.push(`align-items: ${map[layout.alignItems] ?? "flex-start"}`);
      }
      break;
    case "grid":
      parts.push("display: grid");
      parts.push(`grid-template-columns: repeat(${layout.columns}, 1fr)`);
      if (layout.gap > 0) parts.push(`gap: ${layout.gap}px`);
      break;
  }
  return parts.join("; ");
}

function elementToHTML(
  node: ElementNode,
  classNames: Map<string, string>,
  offsetX: number,
  offsetY: number,
  indent: number,
  isFlexChild: boolean,
): string {
  const el = node.element;
  const pad = "      " + "  ".repeat(indent);
  const className = classNames.get(el.id) ?? "element";
  const tag = roleTag(el);
  const attrs = roleAttributes(el);
  const role = getEffectiveRole(el);

  if (el.type === "line") {
    const lineColor = el.stroke !== "transparent" ? el.stroke : el.fill;
    const lineStyle = `position: absolute; left: ${Math.round(el.x - offsetX)}px; top: ${Math.round(el.y - offsetY)}px; width: ${Math.round(el.width)}px; border: none; border-top: ${el.strokeWidth || 2}px ${el.lineType === "dashed" ? "dashed" : "solid"} ${lineColor}`;
    return `${pad}<hr class="${className}" style="${lineStyle}" />`;
  }

  if (role === "input") {
    const style = buildInlineStyle(el, offsetX, offsetY, isFlexChild);
    return `${pad}<${tag} class="${className}" style="${style}"${attrs} />`;
  }

  if (role === "image" || el.type === "image") {
    const style = buildInlineStyle(el, offsetX, offsetY, isFlexChild);
    return `${pad}<img class="${className}" style="${style}" src="" alt="${escapeHtml(el.name)}" />`;
  }

  const hasChildren = node.children.length > 0;
  const layout = hasChildren ? detectLayout(node.children, el.height) : null;

  // Build the style: element styles + layout styles for container
  let style = buildInlineStyle(el, offsetX, offsetY, isFlexChild);
  if (layout && layout.kind !== "absolute") {
    const layoutCSS = layoutStyleInline(layout);
    if (layoutCSS) style = style + "; " + layoutCSS;
  }

  const isChildFlex = layout !== null && layout.kind !== "absolute";

  if (el.type === "text" || role === "heading") {
    const content = escapeHtml(el.text ?? "");
    return `${pad}<${tag} class="${className}" style="${style}"${attrs}>${content}</${tag}>`;
  }

  if (hasChildren) {
    const lines = [`${pad}<${tag} class="${className}" style="${style}"${attrs}>`];
    for (const child of node.children) {
      lines.push(elementToHTML(child, classNames, el.x, el.y, indent + 1, isChildFlex));
    }
    lines.push(`${pad}</${tag}>`);
    return lines.join("\n");
  }

  return `${pad}<${tag} class="${className}" style="${style}"${attrs}></${tag}>`;
}

export function generateEmberComponent(
  elements: DesignElement[],
  fileName: string,
): string {
  const visible = elements.filter((el) => el.visible);
  const componentName = sanitizeComponentName(fileName);

  if (visible.length === 0) {
    return `import Component from '@glimmer/component';

export default class ${componentName} extends Component {
  <template>
    <div class="${sanitizeClassName(fileName)}">
      {{! No design elements to export }}
    </div>
  </template>
}
`;
  }

  const rootClass = sanitizeClassName(fileName);
  const classNames = deduplicateClassNames(visible);
  const { offsetX, offsetY } = computeOffset(visible);
  const { width, height } = computeBounds(visible);
  const tree = buildElementTree(elements);

  // Detect layout for root-level children
  const rootLayout = detectLayout(tree, height);
  const isRootFlex = rootLayout.kind !== "absolute";

  const htmlLines: string[] = [];
  for (const node of tree) {
    htmlLines.push(elementToHTML(node, classNames, offsetX, offsetY, 0, isRootFlex));
  }

  const html = htmlLines.join("\n");

  // Build root container style
  let rootStyle = `position: relative; width: ${Math.round(width)}px; height: ${Math.round(height)}px`;
  if (isRootFlex) {
    rootStyle = `width: ${Math.round(width)}px; ${layoutStyleInline(rootLayout)}`;
  }

  // Generate state/handlers for interactive elements
  const { needsClick, needsInput } = needsInteractiveState(visible);
  const imports = ["import Component from '@glimmer/component';"];
  const classBody: string[] = [];

  if (needsClick || needsInput) {
    imports.push("import { tracked } from '@glimmer/tracking';");
    imports.push("import { on } from '@ember/modifier';");
  }

  if (needsClick) {
    classBody.push("  handleClick = (e: Event) => {\n    // TODO: implement click handler\n  };");
  }
  if (needsInput) {
    classBody.push("  @tracked inputValue = '';");
    classBody.push("  onInput = (e: Event) => {\n    this.inputValue = (e.target as HTMLInputElement).value;\n  };");
  }

  const stateBlock = classBody.length > 0 ? "\n" + classBody.join("\n\n") + "\n" : "";

  return `${imports.join("\n")}

/**
 * Generated by Atelier — design-to-code export.
 * Smart layout detection applied: ${rootLayout.kind}.
 */
export default class ${componentName} extends Component {${stateBlock}
  <template>
    <div class="${rootClass}" style="${rootStyle}">
${html}
    </div>
  </template>
}
`;
}

// ============================================================
// Tailwind Export (with layout detection)
// ============================================================

function buildTailwindClasses(
  el: DesignElement,
  offsetX: number,
  offsetY: number,
  registry: TokenRegistryService,
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
    const bgClass = registry.resolveColor(el.fill, "bg");
    if (bgClass) classes.push(bgClass);
  }

  if (el.stroke && el.stroke !== "transparent" && el.strokeWidth > 0) {
    classes.push(registry.resolveBorderWidth(el.strokeWidth));
    classes.push("border-solid");
    const borderColor = registry.resolveColor(el.stroke, "border");
    if (borderColor) classes.push(borderColor);
  }

  if (el.type === "ellipse") {
    classes.push("rounded-full");
  } else if (el.cornerRadius > 0) {
    classes.push(registry.resolveBorderRadius(el.cornerRadius));
  }

  const opacityClass = registry.resolveOpacity(el.opacity);
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
    const textColor = registry.resolveColor(el.fill, "text");
    if (textColor) classes.push(textColor);
    if (el.fontSize) classes.push(registry.resolveFontSize(el.fontSize));
    if (el.fontWeight && el.fontWeight !== "400") classes.push(registry.resolveFontWeight(el.fontWeight));
    if (el.fontFamily) classes.push(`font-[${el.fontFamily.split(",")[0]!.trim().replace(/ /g, "_")}]`);
    if (el.textAlign === "center") classes.push("text-center");
    if (el.textAlign === "right") classes.push("text-right");
  }

  return classes.join(" ");
}

function layoutClassesTailwind(layout: LayoutInfo): string {
  const classes: string[] = [];
  switch (layout.kind) {
    case "flex-row":
      classes.push("flex", "flex-row");
      if (layout.gap > 0) {
        // Use named gap if close to a Tailwind value
        const gapMap: Record<number, string> = {
          0: "gap-0", 1: "gap-px", 2: "gap-0.5", 4: "gap-1", 6: "gap-1.5",
          8: "gap-2", 10: "gap-2.5", 12: "gap-3", 14: "gap-3.5", 16: "gap-4",
          20: "gap-5", 24: "gap-6", 28: "gap-7", 32: "gap-8", 36: "gap-9",
          40: "gap-10", 48: "gap-12", 56: "gap-14", 64: "gap-16",
        };
        classes.push(gapMap[layout.gap] ?? `gap-[${layout.gap}px]`);
      }
      if (layout.alignItems) classes.push(layout.alignItems);
      if (layout.justifyContent) classes.push(layout.justifyContent);
      break;
    case "flex-col":
      classes.push("flex", "flex-col");
      if (layout.gap > 0) {
        const gapMap: Record<number, string> = {
          0: "gap-0", 1: "gap-px", 2: "gap-0.5", 4: "gap-1", 6: "gap-1.5",
          8: "gap-2", 10: "gap-2.5", 12: "gap-3", 14: "gap-3.5", 16: "gap-4",
          20: "gap-5", 24: "gap-6", 28: "gap-7", 32: "gap-8", 36: "gap-9",
          40: "gap-10", 48: "gap-12", 56: "gap-14", 64: "gap-16",
        };
        classes.push(gapMap[layout.gap] ?? `gap-[${layout.gap}px]`);
      }
      if (layout.alignItems) classes.push(layout.alignItems);
      break;
    case "grid":
      classes.push("grid");
      const colMap: Record<number, string> = {
        1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3",
        4: "grid-cols-4", 5: "grid-cols-5", 6: "grid-cols-6",
      };
      classes.push(colMap[layout.columns ?? 1] ?? `grid-cols-[repeat(${layout.columns},1fr)]`);
      if (layout.gap > 0) {
        const gapMap: Record<number, string> = {
          0: "gap-0", 4: "gap-1", 8: "gap-2", 12: "gap-3", 16: "gap-4",
          20: "gap-5", 24: "gap-6", 32: "gap-8", 40: "gap-10", 48: "gap-12",
        };
        classes.push(gapMap[layout.gap] ?? `gap-[${layout.gap}px]`);
      }
      break;
  }
  return classes.join(" ");
}

function elementToTailwindHTML(
  node: ElementNode,
  offsetX: number,
  offsetY: number,
  indent: number,
  registry: TokenRegistryService,
  isFlexChild: boolean,
): string {
  const el = node.element;
  const pad = "      " + "  ".repeat(indent);
  const tw = buildTailwindClasses(el, offsetX, offsetY, registry, isFlexChild);
  const tag = roleTag(el);
  const attrs = roleAttributes(el);
  const role = getEffectiveRole(el);

  if (el.type === "line") {
    const lineColor = el.stroke !== "transparent" ? el.stroke : el.fill;
    const borderColor = registry.resolveColor(lineColor, "border");
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

  if (role === "input") {
    return `${pad}<${tag} class="${tw}" ${attrs.trim()} />`;
  }

  if (role === "image" || el.type === "image") {
    return `${pad}<img class="${tw}" src="" alt="${escapeHtml(el.name)}" />`;
  }

  const hasChildren = node.children.length > 0;
  const layout = hasChildren ? detectLayout(node.children, el.height) : null;
  const isChildFlex = layout !== null && layout.kind !== "absolute";

  // Add layout classes to the container
  let containerClasses = tw;
  if (layout && layout.kind !== "absolute") {
    containerClasses += " " + layoutClassesTailwind(layout);
  }

  if (el.type === "text" || role === "heading") {
    const content = escapeHtml(el.text ?? "");
    return `${pad}<${tag} class="${tw}"${attrs}>${content}</${tag}>`;
  }

  if (role === "button" || role === "link") {
    const content = el.text ? escapeHtml(el.text) : "";
    // For buttons/links with children, wrap children
    if (hasChildren) {
      const lines = [`${pad}<${tag} class="${containerClasses}"${attrs}>`];
      if (content) lines.push(`${pad}  ${content}`);
      for (const child of node.children) {
        lines.push(elementToTailwindHTML(child, el.x, el.y, indent + 1, registry, isChildFlex));
      }
      lines.push(`${pad}</${tag}>`);
      return lines.join("\n");
    }
    // Find text child to use as label (look in children of the original element tree)
    return `${pad}<${tag} class="${tw}"${attrs}>${content}</${tag}>`;
  }

  if (hasChildren) {
    const lines = [`${pad}<${tag} class="${containerClasses}"${attrs}>`];
    for (const child of node.children) {
      lines.push(elementToTailwindHTML(child, el.x, el.y, indent + 1, registry, isChildFlex));
    }
    lines.push(`${pad}</${tag}>`);
    return lines.join("\n");
  }

  return `${pad}<${tag} class="${tw}"${attrs}></${tag}>`;
}

export function generateEmberComponentTailwind(
  elements: DesignElement[],
  fileName: string,
  registry: TokenRegistryService,
): string {
  const visible = elements.filter((el) => el.visible);
  const componentName = sanitizeComponentName(fileName);

  if (visible.length === 0) {
    return `import Component from '@glimmer/component';

export default class ${componentName} extends Component {
  <template>
    <div>
      {{! No design elements to export }}
    </div>
  </template>
}
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
    htmlLines.push(elementToTailwindHTML(node, offsetX, offsetY, 0, registry, isRootFlex));
  }

  const html = htmlLines.join("\n");

  // Build root container classes
  let rootClasses = `relative w-[${Math.round(width)}px] h-[${Math.round(height)}px]`;
  if (isRootFlex) {
    rootClasses = `w-[${Math.round(width)}px] ${layoutClassesTailwind(rootLayout)}`;
  }

  // Generate state/handlers for interactive elements
  const { needsClick, needsInput } = needsInteractiveState(visible);
  const imports = ["import Component from '@glimmer/component';"];
  const classBody: string[] = [];

  if (needsClick || needsInput) {
    imports.push("import { tracked } from '@glimmer/tracking';");
    imports.push("import { on } from '@ember/modifier';");
  }

  if (needsClick) {
    classBody.push("  handleClick = (e: Event) => {\n    // TODO: implement click handler\n  };");
  }
  if (needsInput) {
    classBody.push("  @tracked inputValue = '';");
    classBody.push("  onInput = (e: Event) => {\n    this.inputValue = (e.target as HTMLInputElement).value;\n  };");
  }

  const stateBlock = classBody.length > 0 ? "\n" + classBody.join("\n\n") + "\n" : "";

  return `${imports.join("\n")}

/**
 * Generated by Atelier — design-to-code export with Tailwind CSS.
 * Smart layout: ${rootLayout.kind}${rootLayout.kind === "grid" ? ` (${rootLayout.columns} cols)` : ""}.
 * Import your Tailwind config into Atelier to use your custom classes.
 */
export default class ${componentName} extends Component {${stateBlock}
  <template>
    <div class="${rootClasses}">
${html}
    </div>
  </template>
}
`;
}
