/**
 * Export as Ember Component
 *
 * Converts Atelier DesignElement[] into a valid Glimmer .gts component file
 * that can be dropped directly into an Ember application.
 */

import type { DesignElement } from "atelier/services/design-store";
import type TokenRegistryService from "atelier/services/token-registry";

interface ElementNode {
  element: DesignElement;
  children: ElementNode[];
}

/**
 * Sanitize an element name into a valid CSS class name.
 * "Rectangle 1" → "rectangle-1"
 */
function sanitizeClassName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "element";
}

/**
 * Deduplicate class names by appending numeric suffixes.
 */
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

/**
 * Convert file name to PascalCase component name.
 * "my-landing-page" → "MyLandingPage"
 */
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

/**
 * Build a tree from flat elements using parentId relationships.
 */
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

/**
 * Compute the bounding box offset so the top-left of all elements = (0, 0).
 */
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

/**
 * Compute the total bounding box dimensions.
 */
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

/**
 * Build inline style string for an element.
 */
function buildInlineStyle(el: DesignElement, offsetX: number, offsetY: number): string {
  const styles: string[] = [];

  styles.push("position: absolute");
  styles.push(`left: ${Math.round(el.x - offsetX)}px`);
  styles.push(`top: ${Math.round(el.y - offsetY)}px`);
  styles.push(`width: ${Math.round(el.width)}px`);
  styles.push(`height: ${Math.round(el.height)}px`);

  // Background / fill
  if (el.type !== "text" && el.type !== "line") {
    if (el.fill && el.fill !== "transparent") {
      styles.push(`background-color: ${el.fill}`);
    }
  }

  // Border / stroke
  if (el.stroke && el.stroke !== "transparent" && el.strokeWidth > 0) {
    styles.push(`border: ${el.strokeWidth}px solid ${el.stroke}`);
  }

  // Border radius
  if (el.type === "ellipse") {
    styles.push("border-radius: 50%");
  } else if (el.cornerRadius > 0) {
    styles.push(`border-radius: ${el.cornerRadius}px`);
  }

  // Opacity
  if (el.opacity < 1) {
    styles.push(`opacity: ${el.opacity}`);
  }

  // Rotation
  if (el.rotation !== 0) {
    styles.push(`transform: rotate(${el.rotation}deg)`);
  }

  // Shadow
  if (el.shadowColor && el.shadowBlur) {
    const sx = el.shadowOffsetX ?? 0;
    const sy = el.shadowOffsetY ?? 0;
    styles.push(`box-shadow: ${sx}px ${sy}px ${el.shadowBlur}px ${el.shadowColor}`);
  }

  // Text-specific
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

/**
 * Pick semantic HTML tag for text based on font size.
 */
function textTag(fontSize: number | undefined): string {
  const size = fontSize ?? 16;
  if (size >= 32) return "h1";
  if (size >= 24) return "h2";
  if (size >= 20) return "h3";
  if (size >= 16) return "p";
  return "span";
}

/**
 * Escape HTML content.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Generate HTML for a single element node (recursive for frames).
 */
function elementToHTML(
  node: ElementNode,
  classNames: Map<string, string>,
  offsetX: number,
  offsetY: number,
  indent: number,
): string {
  const el = node.element;
  const pad = "      " + "  ".repeat(indent);
  const className = classNames.get(el.id) ?? "element";
  const style = buildInlineStyle(el, offsetX, offsetY);

  switch (el.type) {
    case "frame": {
      const lines = [`${pad}<div class="${className}" style="${style}">`];
      for (const child of node.children) {
        lines.push(elementToHTML(child, classNames, el.x, el.y, indent + 1));
      }
      lines.push(`${pad}</div>`);
      return lines.join("\n");
    }
    case "text": {
      const tag = textTag(el.fontSize);
      const content = escapeHtml(el.text ?? "");
      return `${pad}<${tag} class="${className}" style="${style}">${content}</${tag}>`;
    }
    case "line": {
      const lineColor = el.stroke !== "transparent" ? el.stroke : el.fill;
      const lineStyle = `position: absolute; left: ${Math.round(el.x - offsetX)}px; top: ${Math.round(el.y - offsetY)}px; width: ${Math.round(el.width)}px; border: none; border-top: ${el.strokeWidth || 2}px ${el.lineType === "dashed" ? "dashed" : "solid"} ${lineColor}`;
      return `${pad}<hr class="${className}" style="${lineStyle}" />`;
    }
    case "image": {
      return `${pad}<img class="${className}" style="${style}" src="" alt="${escapeHtml(el.name)}" />`;
    }
    default: {
      // rectangle, ellipse — rendered as div
      if (node.children.length > 0) {
        const lines = [`${pad}<div class="${className}" style="${style}">`];
        for (const child of node.children) {
          lines.push(elementToHTML(child, classNames, el.x, el.y, indent + 1));
        }
        lines.push(`${pad}</div>`);
        return lines.join("\n");
      }
      return `${pad}<div class="${className}" style="${style}"></div>`;
    }
  }
}

/**
 * Generate a complete Ember Glimmer component (.gts) from design elements.
 */
export function generateEmberComponent(
  elements: DesignElement[],
  fileName: string,
): string {
  const visible = elements.filter((el) => el.visible);

  if (visible.length === 0) {
    const componentName = sanitizeComponentName(fileName);
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

  const componentName = sanitizeComponentName(fileName);
  const rootClass = sanitizeClassName(fileName);
  const classNames = deduplicateClassNames(visible);
  const { offsetX, offsetY } = computeOffset(visible);
  const { width, height } = computeBounds(visible);
  const tree = buildElementTree(elements);

  const htmlLines: string[] = [];
  for (const node of tree) {
    htmlLines.push(elementToHTML(node, classNames, offsetX, offsetY, 0));
  }

  const html = htmlLines.join("\n");

  return `import Component from '@glimmer/component';

/**
 * Generated by Atelier — design-to-code export.
 * Elements use absolute positioning to preserve design fidelity.
 * Refactor to flex/grid layout as needed for production use.
 */
export default class ${componentName} extends Component {
  <template>
    <div class="${rootClass}" style="position: relative; width: ${Math.round(width)}px; height: ${Math.round(height)}px;">
${html}
    </div>
  </template>
}
`;
}

// ============================================================
// Tailwind Export
// ============================================================

/**
 * Build Tailwind class string for an element.
 * Uses named classes where possible, arbitrary values as fallback.
 */
function buildTailwindClasses(
  el: DesignElement,
  offsetX: number,
  offsetY: number,
  registry: TokenRegistryService,
): string {
  const classes: string[] = [];

  // Position & dimensions — always arbitrary values (design-specific)
  classes.push("absolute");
  classes.push(`left-[${Math.round(el.x - offsetX)}px]`);
  classes.push(`top-[${Math.round(el.y - offsetY)}px]`);
  classes.push(`w-[${Math.round(el.width)}px]`);
  classes.push(`h-[${Math.round(el.height)}px]`);

  // Background / fill
  if (el.type !== "text" && el.type !== "line") {
    const bgClass = registry.resolveColor(el.fill, "bg");
    if (bgClass) classes.push(bgClass);
  }

  // Border / stroke
  if (el.stroke && el.stroke !== "transparent" && el.strokeWidth > 0) {
    classes.push(registry.resolveBorderWidth(el.strokeWidth));
    classes.push("border-solid");
    const borderColor = registry.resolveColor(el.stroke, "border");
    if (borderColor) classes.push(borderColor);
  }

  // Border radius
  if (el.type === "ellipse") {
    classes.push("rounded-full");
  } else if (el.cornerRadius > 0) {
    classes.push(registry.resolveBorderRadius(el.cornerRadius));
  }

  // Opacity
  const opacityClass = registry.resolveOpacity(el.opacity);
  if (opacityClass) classes.push(opacityClass);

  // Rotation
  if (el.rotation !== 0) {
    classes.push(`rotate-[${el.rotation}deg]`);
  }

  // Shadow
  if (el.shadowColor && el.shadowBlur) {
    const sx = el.shadowOffsetX ?? 0;
    const sy = el.shadowOffsetY ?? 0;
    classes.push(`shadow-[${sx}px_${sy}px_${el.shadowBlur}px_${el.shadowColor.replace(/ /g, "_")}]`);
  }

  // Text-specific
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

/**
 * Generate HTML for a single element node using Tailwind classes (recursive).
 */
function elementToTailwindHTML(
  node: ElementNode,
  offsetX: number,
  offsetY: number,
  indent: number,
  registry: TokenRegistryService,
): string {
  const el = node.element;
  const pad = "      " + "  ".repeat(indent);
  const tw = buildTailwindClasses(el, offsetX, offsetY, registry);

  switch (el.type) {
    case "frame": {
      const lines = [`${pad}<div class="${tw}">`];
      for (const child of node.children) {
        lines.push(elementToTailwindHTML(child, el.x, el.y, indent + 1, registry));
      }
      lines.push(`${pad}</div>`);
      return lines.join("\n");
    }
    case "text": {
      const tag = textTag(el.fontSize);
      const content = escapeHtml(el.text ?? "");
      return `${pad}<${tag} class="${tw}">${content}</${tag}>`;
    }
    case "line": {
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
    case "image": {
      return `${pad}<img class="${tw}" src="" alt="${escapeHtml(el.name)}" />`;
    }
    default: {
      if (node.children.length > 0) {
        const lines = [`${pad}<div class="${tw}">`];
        for (const child of node.children) {
          lines.push(elementToTailwindHTML(child, el.x, el.y, indent + 1, registry));
        }
        lines.push(`${pad}</div>`);
        return lines.join("\n");
      }
      return `${pad}<div class="${tw}"></div>`;
    }
  }
}

/**
 * Generate an Ember Glimmer component (.gts) using Tailwind utility classes.
 */
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

  const htmlLines: string[] = [];
  for (const node of tree) {
    htmlLines.push(elementToTailwindHTML(node, offsetX, offsetY, 0, registry));
  }

  const html = htmlLines.join("\n");

  return `import Component from '@glimmer/component';

/**
 * Generated by Atelier — design-to-code export with Tailwind CSS.
 * Tailwind utility classes are used where possible. Arbitrary values
 * (e.g., w-[200px]) are used for design-specific measurements.
 * Import your Tailwind config into Atelier to use your custom classes.
 */
export default class ${componentName} extends Component {
  <template>
    <div class="relative w-[${Math.round(width)}px] h-[${Math.round(height)}px]">
${html}
    </div>
  </template>
}
`;
}
