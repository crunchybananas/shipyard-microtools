/**
 * Export as SwiftUI View
 *
 * Generates a SwiftUI view file from Atelier design elements.
 * Uses HStack, VStack, LazyVGrid for detected layouts.
 * Maps colors, fonts, and corner radii to SwiftUI modifiers.
 */

import type { DesignElement } from "atelier/services/design-store";

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
}

// ---- Helpers ----

function sanitizeViewName(fileName: string): string {
  const cleaned = fileName.replace(/[^a-zA-Z0-9\s-_]/g, "").trim() || "AtelierView";
  return cleaned.split(/[\s\-_]+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("");
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

// ---- Layout detection ----

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
      let ai = "top";
      if (maxYDev <= POS_TOL) ai = "center";
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
      let ai = "leading";
      if (maxXDev <= POS_TOL) ai = "center";
      return { kind: "flex-col", gap: Math.max(0, Math.round(avg)), alignItems: ai };
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
        const avg = rowGaps.reduce((a, b) => a + b, 0) / rowGaps.length;
        return { kind: "grid", gap: Math.max(0, Math.round(avg)), columns: cols };
      }
    }
  }

  return { kind: "absolute", gap: 0 };
}

// ---- Color conversion ----

function hexToSwiftColor(hex: string): string {
  if (!hex || hex === "transparent") return "Color.clear";
  hex = hex.replace("#", "");
  if (hex.length !== 6) return `Color.gray`;

  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Map to named SwiftUI colors for common values
  if (r === 255 && g === 255 && b === 255) return "Color.white";
  if (r === 0 && g === 0 && b === 0) return "Color.black";

  return `Color(red: ${(r / 255).toFixed(3)}, green: ${(g / 255).toFixed(3)}, blue: ${(b / 255).toFixed(3)})`;
}

function fontWeight(w: string | undefined): string {
  switch (w) {
    case "300": return ".light";
    case "500": return ".medium";
    case "600": return ".semibold";
    case "700": return ".bold";
    case "800": return ".heavy";
    case "900": return ".black";
    default: return ".regular";
  }
}

function textAlignment(align: string | undefined): string {
  switch (align) {
    case "center": return ".center";
    case "right": return ".trailing";
    default: return ".leading";
  }
}

// ---- SwiftUI view generation ----

type Role = NonNullable<DesignElement["elementRole"]>;

function getRole(el: DesignElement): Role {
  if (el.elementRole && el.elementRole !== "auto") return el.elementRole;
  if (el.type === "text" && (el.fontSize ?? 16) >= 20) return "heading";
  if (el.type === "image") return "image";
  return "auto";
}

function modifiers(el: DesignElement, isFlex: boolean, ox: number, oy: number): string[] {
  const m: string[] = [];

  m.push(`.frame(width: ${Math.round(el.width)}, height: ${Math.round(el.height)})`);

  if (el.type !== "text" && el.type !== "line" && el.fill && el.fill !== "transparent") {
    m.push(`.background(${hexToSwiftColor(el.fill)})`);
  }

  if (el.type === "ellipse") {
    m.push(`.clipShape(Circle())`);
  } else if (el.cornerRadius > 0) {
    m.push(`.cornerRadius(${Math.round(el.cornerRadius)})`);
  }

  if (el.stroke && el.stroke !== "transparent" && el.strokeWidth > 0) {
    m.push(`.overlay(RoundedRectangle(cornerRadius: ${el.cornerRadius || 0}).stroke(${hexToSwiftColor(el.stroke)}, lineWidth: ${el.strokeWidth}))`);
  }

  if (el.opacity < 1) {
    m.push(`.opacity(${el.opacity})`);
  }

  if (el.rotation !== 0) {
    m.push(`.rotationEffect(.degrees(${el.rotation}))`);
  }

  if (el.shadowColor && el.shadowBlur) {
    m.push(`.shadow(color: ${hexToSwiftColor(el.shadowColor)}, radius: ${el.shadowBlur}, x: ${el.shadowOffsetX ?? 0}, y: ${el.shadowOffsetY ?? 0})`);
  }

  if (!isFlex) {
    m.push(`.offset(x: ${Math.round(el.x - ox)}, y: ${Math.round(el.y - oy)})`);
  }

  return m;
}

function nodeToSwift(
  node: ElementNode, ox: number, oy: number, indent: number, isFlex: boolean,
): string {
  const el = node.element;
  const pad = "    " + "    ".repeat(indent);
  const role = getRole(el);
  const mods = modifiers(el, isFlex, ox, oy);

  if (el.type === "line") {
    const color = el.stroke !== "transparent" ? el.stroke : el.fill;
    return `${pad}Divider()\n${pad}    .frame(width: ${Math.round(el.width)})\n${pad}    .background(${hexToSwiftColor(color)})`;
  }

  if (role === "image" || el.type === "image") {
    const lines = [`${pad}Image(systemName: "photo")`];
    lines.push(...mods.map((m) => `${pad}    ${m}`));
    return lines.join("\n");
  }

  if (role === "input") {
    const lines = [`${pad}TextField("${el.text ?? ""}", text: $inputValue)`];
    lines.push(...mods.map((m) => `${pad}    ${m}`));
    return lines.join("\n");
  }

  if (role === "button") {
    const text = el.text ?? "Button";
    const lines = [`${pad}Button("${text}") {\n${pad}    // Action\n${pad}}`];
    lines.push(...mods.map((m) => `${pad}    ${m}`));
    return lines.join("\n");
  }

  if (el.type === "text" || role === "heading") {
    const text = el.text ?? "";
    const lines = [`${pad}Text("${text}")`];
    if (el.fontSize) lines.push(`${pad}    .font(.system(size: ${el.fontSize}, weight: ${fontWeight(el.fontWeight)}))`);
    if (el.fill && el.fill !== "transparent") lines.push(`${pad}    .foregroundColor(${hexToSwiftColor(el.fill)})`);
    if (el.textAlign) lines.push(`${pad}    .multilineTextAlignment(${textAlignment(el.textAlign)})`);
    // Add size/position mods minus background
    for (const m of mods) {
      if (!m.includes(".background")) lines.push(`${pad}    ${m}`);
    }
    return lines.join("\n");
  }

  // Container / rectangle / ellipse / frame
  const hasKids = node.children.length > 0;
  const layout = hasKids ? detectLayout(node.children) : null;
  const kidsFlex = layout !== null && layout.kind !== "absolute";

  if (hasKids) {
    let opener: string;
    const spacing = layout && layout.gap > 0 ? `, spacing: ${layout.gap}` : "";
    const alignment = layout?.alignItems ?? "";

    switch (layout?.kind) {
      case "flex-row": {
        const align = alignment === "center" ? ", alignment: .center" : alignment === "bottom" ? ", alignment: .bottom" : "";
        opener = `${pad}HStack(${align ? `alignment: .center${spacing}` : spacing ? `spacing: ${layout.gap}` : ""}) {`;
        break;
      }
      case "flex-col": {
        const align = alignment === "center" ? "alignment: .center" : alignment === "trailing" ? "alignment: .trailing" : "";
        opener = `${pad}VStack(${align}${align && spacing ? spacing : spacing ? `spacing: ${layout.gap}` : ""}) {`;
        break;
      }
      case "grid": {
        opener = `${pad}LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: ${layout.gap}), count: ${layout.columns}), spacing: ${layout.gap}) {`;
        break;
      }
      default:
        opener = `${pad}ZStack {`;
    }

    const lines = [opener];
    for (const child of node.children) {
      lines.push(nodeToSwift(child, el.x, el.y, indent + 1, kidsFlex));
    }
    lines.push(`${pad}}`);
    lines.push(...mods.map((m) => `${pad}${m}`));
    return lines.join("\n");
  }

  // Leaf element (empty shape)
  if (el.type === "ellipse") {
    const lines = [`${pad}Circle()`];
    lines.push(...mods.filter((m) => !m.includes("clipShape")).map((m) => `${pad}    ${m}`));
    return lines.join("\n");
  }

  const lines = [`${pad}RoundedRectangle(cornerRadius: ${el.cornerRadius || 0})`];
  lines.push(...mods.filter((m) => !m.includes("cornerRadius")).map((m) => `${pad}    ${m}`));
  return lines.join("\n");
}

// ---- Public API ----

export function generateSwiftUIView(
  elements: DesignElement[],
  fileName: string,
): string {
  const visible = elements.filter((el) => el.visible);
  const viewName = sanitizeViewName(fileName);

  if (visible.length === 0) {
    return `import SwiftUI\n\nstruct ${viewName}: View {\n    var body: some View {\n        Text("Empty design")\n    }\n}\n\n#Preview {\n    ${viewName}()\n}\n`;
  }

  const { offsetX, offsetY } = computeOffset(visible);
  const tree = buildElementTree(elements);
  const rootLayout = detectLayout(tree);
  const isRootFlex = rootLayout.kind !== "absolute";

  // Check for interactive elements
  const needsInput = visible.some((el) => getRole(el) === "input");

  const childLines: string[] = [];
  for (const node of tree) {
    childLines.push(nodeToSwift(node, offsetX, offsetY, 1, isRootFlex));
  }

  let rootOpener: string;
  const spacing = rootLayout.gap > 0 ? `spacing: ${rootLayout.gap}` : "";
  switch (rootLayout.kind) {
    case "flex-row": rootOpener = `HStack(${spacing})`; break;
    case "flex-col": rootOpener = `VStack(${spacing})`; break;
    case "grid": rootOpener = `LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: ${rootLayout.gap}), count: ${rootLayout.columns}), spacing: ${rootLayout.gap})`; break;
    default: rootOpener = "ZStack";
  }

  const stateVars = needsInput ? "\n    @State private var inputValue = \"\"\n" : "";

  return `import SwiftUI

/// Generated by Atelier — SwiftUI export.
/// Smart layout: ${rootLayout.kind}.
struct ${viewName}: View {${stateVars}
    var body: some View {
        ${rootOpener} {
${childLines.join("\n")}
        }
    }
}

#Preview {
    ${viewName}()
        .preferredColorScheme(.dark)
}
`;
}
