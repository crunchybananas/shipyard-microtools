import type { DesignElement } from "atelier/services/design-store";

export interface RenderOptions {
  zoom: number;
  panX: number;
  panY: number;
  selectedIds: string[];
  hoveredId: string | null;
  showGrid: boolean;
  gridSize: number;
  marquee: { x: number; y: number; width: number; height: number } | null;
  drawingElement: Partial<DesignElement> | null;
}

const SELECTION_COLOR = "#818cf8";
const HOVER_COLOR = "#818cf8";
const HANDLE_SIZE = 8;
const HANDLE_FILL = "#ffffff";
const HANDLE_STROKE = SELECTION_COLOR;
const GRID_COLOR_SMALL = "rgba(255,255,255,0.04)";
const GRID_COLOR_LARGE = "rgba(255,255,255,0.08)";
const MARQUEE_FILL = "rgba(129,140,248,0.08)";
const MARQUEE_STROKE = "rgba(129,140,248,0.5)";
const DRAW_PREVIEW_FILL = "rgba(129,140,248,0.15)";
const DRAW_PREVIEW_STROKE = "rgba(129,140,248,0.6)";
const FRAME_LABEL_COLOR = "rgba(255,255,255,0.4)";
const LINE_ENDPOINT_RADIUS = 6;

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr: number;
  private dirty = true;
  private rafId: number | null = null;
  private gridCache: OffscreenCanvas | null = null;
  private gridCacheKey = "";
  private imageCache = new Map<string, HTMLImageElement>();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Failed to get 2D context");
    this.ctx = ctx;
    this.dpr = window.devicePixelRatio || 1;
    this.setupHighDPI();
  }

  // --- Public API ---

  /**
   * Mark the canvas as needing a re-render. The actual render
   * happens on the next animation frame.
   */
  markDirty(): void {
    if (this.dirty) return;
    this.dirty = true;
    this.scheduleFrame();
  }

  /**
   * Render immediately (synchronous). Prefer markDirty() for
   * batched rendering, but this is useful for the initial paint.
   */
  render(elements: DesignElement[], options: RenderOptions): void {
    this.dirty = false;
    const { ctx, dpr } = this;
    const width = this.canvas.width / dpr;
    const height = this.canvas.height / dpr;

    ctx.save();
    // Clear to dark background
    ctx.fillStyle = "#18181b";
    ctx.fillRect(0, 0, width, height);

    // Apply pan and zoom
    ctx.translate(options.panX, options.panY);
    ctx.scale(options.zoom, options.zoom);

    // Grid
    if (options.showGrid) {
      this.renderGrid(options, width, height);
    }

    // Elements
    for (const el of elements) {
      if (!el.visible) continue;
      this.renderElement(ctx, el);
    }

    // Hover highlight (only if not selected)
    if (options.hoveredId && !options.selectedIds.includes(options.hoveredId)) {
      const hovered = elements.find((e) => e.id === options.hoveredId);
      if (hovered) this.renderHover(ctx, hovered);
    }

    // Selection outlines
    const selectedEls = elements.filter((e) =>
      options.selectedIds.includes(e.id),
    );
    for (const el of selectedEls) {
      this.renderSelectionOutline(ctx, el);
    }

    // Resize / endpoint handles for single selection
    if (selectedEls.length === 1) {
      this.renderHandles(ctx, selectedEls[0]!);
    }

    // Drawing preview
    if (options.drawingElement) {
      this.renderDrawingPreview(ctx, options.drawingElement);
    }

    // Marquee
    if (options.marquee) {
      this.renderMarquee(ctx, options.marquee);
    }

    ctx.restore();
  }

  /**
   * Call when the canvas element resizes or DPR changes.
   */
  resize(): void {
    this.dpr = window.devicePixelRatio || 1;
    this.setupHighDPI();
    this.invalidateGridCache();
    this.markDirty();
  }

  /**
   * Dispose of the renderer, cancelling any pending frame.
   */
  destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.gridCache = null;
    this.imageCache.clear();
  }

  // --- High-DPI setup ---

  private setupHighDPI(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = this.dpr;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    // Smooth text
    this.ctx.textRendering = "optimizeLegibility" as CanvasTextRendering;
    (this.ctx as unknown as Record<string, string>).fontSmoothing = "antialiased";
  }

  // --- Animation frame scheduling ---

  private scheduleFrame(): void {
    if (this.rafId !== null) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      // The caller is responsible for calling render() with up-to-date data.
      // This is a no-op sentinel so external code can hook into it.
    });
  }

  // Expose for the component to drive the render loop
  get needsRender(): boolean {
    return this.dirty;
  }

  // --- Grid ---

  private renderGrid(
    options: RenderOptions,
    viewWidth: number,
    viewHeight: number,
  ): void {
    const { zoom, panX, panY, gridSize } = options;
    const largeGridSize = gridSize * 5;

    // Compute visible canvas-space bounds
    const left = -panX / zoom;
    const top = -panY / zoom;
    const right = left + viewWidth / zoom;
    const bottom = top + viewHeight / zoom;

    // Snap to grid lines
    const startX = Math.floor(left / gridSize) * gridSize;
    const startY = Math.floor(top / gridSize) * gridSize;
    const endX = Math.ceil(right / gridSize) * gridSize;
    const endY = Math.ceil(bottom / gridSize) * gridSize;

    const cacheKey = `${gridSize}:${startX}:${startY}:${endX}:${endY}:${zoom}`;
    if (this.gridCache && this.gridCacheKey === cacheKey) {
      // Draw from cache — the cache is in canvas-space coordinates
      this.ctx.drawImage(this.gridCache, startX, startY);
      return;
    }

    const cacheW = endX - startX;
    const cacheH = endY - startY;

    // Skip cache for very large grids to avoid memory issues
    const maxCacheDim = 4000;
    if (cacheW > maxCacheDim || cacheH > maxCacheDim) {
      this.drawGridLines(this.ctx, gridSize, largeGridSize, startX, startY, endX, endY);
      return;
    }

    try {
      this.gridCache = new OffscreenCanvas(cacheW, cacheH);
      this.gridCacheKey = cacheKey;
      const offCtx = this.gridCache.getContext("2d")!;
      // Translate so drawing is relative to startX/startY
      offCtx.translate(-startX, -startY);
      this.drawGridLines(offCtx, gridSize, largeGridSize, startX, startY, endX, endY);
      offCtx.translate(startX, startY);
      this.ctx.drawImage(this.gridCache, startX, startY);
    } catch {
      // OffscreenCanvas may not be supported everywhere, fall back
      this.gridCache = null;
      this.drawGridLines(this.ctx, gridSize, largeGridSize, startX, startY, endX, endY);
    }
  }

  private drawGridLines(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    gridSize: number,
    largeGridSize: number,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ): void {
    // Small grid
    ctx.beginPath();
    ctx.strokeStyle = GRID_COLOR_SMALL;
    ctx.lineWidth = 0.5;
    for (let x = startX; x <= endX; x += gridSize) {
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += gridSize) {
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }
    ctx.stroke();

    // Large grid
    ctx.beginPath();
    ctx.strokeStyle = GRID_COLOR_LARGE;
    ctx.lineWidth = 0.5;
    const lgStartX = Math.floor(startX / largeGridSize) * largeGridSize;
    const lgStartY = Math.floor(startY / largeGridSize) * largeGridSize;
    for (let x = lgStartX; x <= endX; x += largeGridSize) {
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
    }
    for (let y = lgStartY; y <= endY; y += largeGridSize) {
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }
    ctx.stroke();
  }

  invalidateGridCache(): void {
    this.gridCache = null;
    this.gridCacheKey = "";
  }

  // --- Element rendering ---

  private renderElement(
    ctx: CanvasRenderingContext2D,
    el: DesignElement,
  ): void {
    ctx.save();

    // Rotation
    if (el.rotation) {
      const cx = el.x + el.width / 2;
      const cy = el.y + el.height / 2;
      ctx.translate(cx, cy);
      ctx.rotate((el.rotation * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }

    // Global opacity
    ctx.globalAlpha = el.opacity ?? 1;

    // Shadow
    if (el.shadowColor && el.shadowBlur) {
      ctx.shadowColor = el.shadowColor;
      ctx.shadowBlur = el.shadowBlur;
      ctx.shadowOffsetX = el.shadowOffsetX ?? 0;
      ctx.shadowOffsetY = el.shadowOffsetY ?? 0;
    }

    switch (el.type) {
      case "rectangle":
        this.drawRectangle(ctx, el);
        break;
      case "frame":
        this.drawFrame(ctx, el);
        break;
      case "ellipse":
        this.drawEllipse(ctx, el);
        break;
      case "text":
        this.drawText(ctx, el);
        break;
      case "line":
        this.drawLine(ctx, el);
        break;
      case "image":
        this.drawImage(ctx, el);
        break;
    }

    ctx.restore();
  }

  private drawRectangle(ctx: CanvasRenderingContext2D, el: DesignElement): void {
    const path = this.roundRectPath(el.x, el.y, el.width, el.height, el.cornerRadius);

    if (el.fill && el.fill !== "transparent") {
      ctx.fillStyle = el.fill;
      ctx.fill(path);
    }
    if (el.stroke && el.stroke !== "transparent" && el.strokeWidth > 0) {
      ctx.strokeStyle = el.stroke;
      ctx.lineWidth = el.strokeWidth;
      ctx.stroke(path);
    }
  }

  private drawFrame(ctx: CanvasRenderingContext2D, el: DesignElement): void {
    // Frame is the same as rectangle but also shows a label above
    this.drawRectangle(ctx, el);

    // Clear shadow before drawing label
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;

    // Frame name label
    ctx.fillStyle = FRAME_LABEL_COLOR;
    ctx.font = "11px Inter, system-ui, sans-serif";
    ctx.textBaseline = "bottom";
    ctx.textAlign = "left";
    ctx.fillText(el.name, el.x, el.y - 6);
  }

  private drawEllipse(ctx: CanvasRenderingContext2D, el: DesignElement): void {
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    const rx = el.width / 2;
    const ry = el.height / 2;

    const path = new Path2D();
    path.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);

    if (el.fill && el.fill !== "transparent") {
      ctx.fillStyle = el.fill;
      ctx.fill(path);
    }
    if (el.stroke && el.stroke !== "transparent" && el.strokeWidth > 0) {
      ctx.strokeStyle = el.stroke;
      ctx.lineWidth = el.strokeWidth;
      ctx.stroke(path);
    }
  }

  private drawText(ctx: CanvasRenderingContext2D, el: DesignElement): void {
    const fontSize = el.fontSize || 16;
    const fontWeight = el.fontWeight || "400";
    const fontFamily = el.fontFamily || "Inter, system-ui, sans-serif";
    const textAlign = el.textAlign || "left";
    const fill = el.fill || "#e4e4e7";
    const text = el.text || "";

    ctx.fillStyle = fill;
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    ctx.textBaseline = "top";
    ctx.textAlign = textAlign;

    const lineHeight = fontSize * 1.4;
    const maxWidth = el.width;

    // Compute text x based on alignment
    let textX = el.x;
    if (textAlign === "center") {
      textX = el.x + el.width / 2;
    } else if (textAlign === "right") {
      textX = el.x + el.width;
    }

    // Word-wrap
    const lines = this.wrapText(ctx, text, maxWidth);
    const maxLines = Math.max(
      1,
      Math.floor(Math.max(el.height, fontSize * 1.6) / lineHeight),
    );

    for (let i = 0; i < Math.min(lines.length, maxLines); i++) {
      ctx.fillText(lines[i]!, textX, el.y + i * lineHeight);
    }
  }

  private drawLine(ctx: CanvasRenderingContext2D, el: DesignElement): void {
    const x1 = el.x1 ?? el.x;
    const y1 = el.y1 ?? el.y;
    const x2 = el.x2 ?? el.x + el.width;
    const y2 = el.y2 ?? el.y + el.height;
    const strokeColor =
      el.stroke === "transparent" ? el.fill : el.stroke;
    const strokeWidth = el.strokeWidth || 2;

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;

    // Dashed
    if (el.lineType === "dashed") {
      ctx.setLineDash([8, 4]);
    } else {
      ctx.setLineDash([]);
    }

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Arrowheads
    const hasEndArrow =
      el.lineType === "arrow" || el.lineType === "arrow-both";
    const hasStartArrow = el.lineType === "arrow-both";

    if (hasEndArrow) {
      this.drawArrowhead(ctx, x1, y1, x2, y2, strokeWidth, strokeColor);
    }
    if (hasStartArrow) {
      this.drawArrowhead(ctx, x2, y2, x1, y1, strokeWidth, strokeColor);
    }

    ctx.setLineDash([]);
  }

  private drawArrowhead(
    ctx: CanvasRenderingContext2D,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    strokeWidth: number,
    color: string,
  ): void {
    const headLen = 10 * strokeWidth;
    const angle = Math.atan2(toY - fromY, toX - fromX);

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(
      toX - headLen * Math.cos(angle - Math.PI / 6),
      toY - headLen * Math.sin(angle - Math.PI / 6),
    );
    ctx.lineTo(
      toX - headLen * Math.cos(angle + Math.PI / 6),
      toY - headLen * Math.sin(angle + Math.PI / 6),
    );
    ctx.closePath();
    ctx.fill();
  }

  private drawImage(ctx: CanvasRenderingContext2D, el: DesignElement): void {
    if (!el.imageUrl) {
      // Placeholder
      this.drawRectangle(ctx, el);
      return;
    }

    let img = this.imageCache.get(el.imageUrl);
    if (!img) {
      img = new Image();
      img.src = el.imageUrl;
      this.imageCache.set(el.imageUrl, img);
      img.onload = () => this.markDirty();
    }

    if (img.complete && img.naturalWidth > 0) {
      // Clip to rounded rect if needed
      if (el.cornerRadius > 0) {
        ctx.save();
        const path = this.roundRectPath(el.x, el.y, el.width, el.height, el.cornerRadius);
        ctx.clip(path);
        ctx.drawImage(img, el.x, el.y, el.width, el.height);
        ctx.restore();
      } else {
        ctx.drawImage(img, el.x, el.y, el.width, el.height);
      }

      // Stroke on top
      if (el.stroke && el.stroke !== "transparent" && el.strokeWidth > 0) {
        const path = this.roundRectPath(el.x, el.y, el.width, el.height, el.cornerRadius);
        ctx.strokeStyle = el.stroke;
        ctx.lineWidth = el.strokeWidth;
        ctx.stroke(path);
      }
    } else {
      // Still loading — draw placeholder
      this.drawRectangle(ctx, el);
    }
  }

  // --- Selection / hover overlays ---

  private renderHover(ctx: CanvasRenderingContext2D, el: DesignElement): void {
    ctx.save();
    ctx.strokeStyle = HOVER_COLOR;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);

    if (el.type === "line") {
      const x1 = el.x1 ?? el.x;
      const y1 = el.y1 ?? el.y;
      const x2 = el.x2 ?? el.x + el.width;
      const y2 = el.y2 ?? el.y + el.height;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    } else {
      const path = this.roundRectPath(el.x, el.y, el.width, el.height, el.cornerRadius);
      ctx.stroke(path);
    }

    ctx.restore();
  }

  private renderSelectionOutline(
    ctx: CanvasRenderingContext2D,
    el: DesignElement,
  ): void {
    ctx.save();
    ctx.strokeStyle = SELECTION_COLOR;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);

    if (el.type === "line") {
      const x1 = el.x1 ?? el.x;
      const y1 = el.y1 ?? el.y;
      const x2 = el.x2 ?? el.x + el.width;
      const y2 = el.y2 ?? el.y + el.height;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    } else {
      ctx.strokeRect(el.x, el.y, el.width, el.height);
    }

    ctx.restore();
  }

  private renderHandles(
    ctx: CanvasRenderingContext2D,
    el: DesignElement,
  ): void {
    ctx.save();

    if (el.type === "line") {
      // Line endpoint circles
      const x1 = el.x1 ?? el.x;
      const y1 = el.y1 ?? el.y;
      const x2 = el.x2 ?? el.x + el.width;
      const y2 = el.y2 ?? el.y + el.height;

      for (const [px, py] of [[x1, y1], [x2, y2]] as const) {
        ctx.beginPath();
        ctx.arc(px, py, LINE_ENDPOINT_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = HANDLE_FILL;
        ctx.fill();
        ctx.strokeStyle = HANDLE_STROKE;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    } else {
      // 8 resize handles: corners + edge midpoints
      const positions = [
        { x: el.x, y: el.y },                                      // top-left
        { x: el.x + el.width, y: el.y },                           // top-right
        { x: el.x, y: el.y + el.height },                          // bottom-left
        { x: el.x + el.width, y: el.y + el.height },               // bottom-right
        { x: el.x + el.width / 2, y: el.y },                       // top
        { x: el.x + el.width / 2, y: el.y + el.height },           // bottom
        { x: el.x, y: el.y + el.height / 2 },                      // left
        { x: el.x + el.width, y: el.y + el.height / 2 },           // right
      ];

      const half = HANDLE_SIZE / 2;
      ctx.fillStyle = HANDLE_FILL;
      ctx.strokeStyle = HANDLE_STROKE;
      ctx.lineWidth = 1.5;

      for (const pos of positions) {
        const path = this.roundRectPath(
          pos.x - half,
          pos.y - half,
          HANDLE_SIZE,
          HANDLE_SIZE,
          1,
        );
        ctx.fill(path);
        ctx.stroke(path);
      }
    }

    ctx.restore();
  }

  // --- Drawing preview ---

  private renderDrawingPreview(
    ctx: CanvasRenderingContext2D,
    el: Partial<DesignElement>,
  ): void {
    ctx.save();
    ctx.fillStyle = DRAW_PREVIEW_FILL;
    ctx.strokeStyle = DRAW_PREVIEW_STROKE;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);

    const x = el.x ?? 0;
    const y = el.y ?? 0;
    const w = el.width ?? 0;
    const h = el.height ?? 0;

    if (el.type === "line") {
      const x1 = el.x1 ?? x;
      const y1 = el.y1 ?? y;
      const x2 = el.x2 ?? x + w;
      const y2 = el.y2 ?? y + h;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    } else if (el.type === "ellipse") {
      const cx = x + w / 2;
      const cy = y + h / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
    }

    ctx.setLineDash([]);
    ctx.restore();
  }

  // --- Marquee ---

  private renderMarquee(
    ctx: CanvasRenderingContext2D,
    rect: { x: number; y: number; width: number; height: number },
  ): void {
    ctx.save();
    ctx.fillStyle = MARQUEE_FILL;
    ctx.strokeStyle = MARQUEE_STROKE;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    ctx.setLineDash([]);
    ctx.restore();
  }

  // --- Helpers ---

  private roundRectPath(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): Path2D {
    const path = new Path2D();
    const radius = Math.min(r, w / 2, h / 2);
    if (radius <= 0) {
      path.rect(x, y, w, h);
    } else {
      path.roundRect(x, y, w, h, radius);
    }
    return path;
  }

  private wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
  ): string[] {
    if (maxWidth <= 0) return [text];

    const words = text.split(/\s+/);
    const lines: string[] = [];
    let current = "";

    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      const metrics = ctx.measureText(test);
      if (metrics.width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    if (lines.length === 0) lines.push("");

    return lines;
  }
}
