import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import { fn } from "@ember/helper";
import { inject as service } from "@ember/service";
import { modifier } from "ember-modifier";
import type DesignStoreService from "atelier/services/design-store";
import type AiServiceService from "atelier/services/ai-service";
import type { DesignElement, ToolType, Point } from "atelier/services/design-store";

// SVG icon helpers as inline template-only components
const IconCursor = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4l7 17 2.5-6.5L20 12z"/></svg></template>;
const IconFrame = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg></template>;
const IconRect = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="1"/></svg></template>;
const IconEllipse = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="12" rx="9" ry="9"/></svg></template>;
const IconLine = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="20" x2="20" y2="4"/></svg></template>;
const IconText = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="8" y1="20" x2="16" y2="20"/></svg></template>;
const IconHand = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 11V6a2 2 0 0 0-4 0v1M14 10V4a2 2 0 0 0-4 0v6m4 0V4m-4 6V4M6 10v1a2 2 0 0 0 4 0V8a2 2 0 0 0-4 0z"/><path d="M18 11a4 4 0 0 1 4 4v1a8 8 0 0 1-8 8h-2c-2.5 0-4.5-1-6.5-3L2 17.5"/></svg></template>;
const IconPen = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg></template>;
const IconStar = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></template>;
const IconEye = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></template>;
const IconEyeOff = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg></template>;
const IconPlus = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></template>;
const IconMinus = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg></template>;
const IconGrid = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg></template>;
const IconExport = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></template>;
const IconUndo = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg></template>;
const IconRedo = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg></template>;
const IconTrash = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></template>;
const IconCopy = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></template>;
const IconLayers = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg></template>;
const IconX = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></template>;
const IconAlignLeft = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="3" x2="3" y2="21"/><rect x="7" y="6" width="14" height="5" rx="1"/><rect x="7" y="14" width="8" height="5" rx="1"/></svg></template>;
const IconAlignCenter = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="3" x2="12" y2="21"/><rect x="5" y="6" width="14" height="5" rx="1"/><rect x="8" y="14" width="8" height="5" rx="1"/></svg></template>;
const IconAlignRight = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="21" y1="3" x2="21" y2="21"/><rect x="3" y="6" width="14" height="5" rx="1"/><rect x="9" y="14" width="8" height="5" rx="1"/></svg></template>;
const IconAlignTop = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="3" x2="21" y2="3"/><rect x="6" y="7" width="5" height="14" rx="1"/><rect x="14" y="7" width="5" height="8" rx="1"/></svg></template>;
const IconAlignMiddle = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><rect x="6" y="5" width="5" height="14" rx="1"/><rect x="14" y="8" width="5" height="8" rx="1"/></svg></template>;
const IconAlignBottom = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="21" x2="21" y2="21"/><rect x="6" y="3" width="5" height="14" rx="1"/><rect x="14" y="9" width="5" height="8" rx="1"/></svg></template>;
const IconSparkles = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z"/><path d="M19 15l.5 2 2 .5-2 .5-.5 2-.5-2-2-.5 2-.5.5-2z"/></svg></template>;
const IconDownload = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></template>;
const IconZoomFit = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg></template>;
const IconMagnet = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2v6a6 6 0 0 0 12 0V2M6 2H2v6a10 10 0 0 0 20 0V2h-4"/></svg></template>;
const IconChevronUp = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg></template>;
const IconChevronDown = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></template>;

const PRESET_COLORS = [
  "#ffffff", "#000000", "#f87171", "#fb923c", "#fbbf24", "#a3e635",
  "#4ade80", "#22d3ee", "#818cf8", "#a78bfa", "#c084fc", "#f472b6",
  "#1e1e2e", "#2a2a4a", "#374151", "#64748b", "#94a3b8", "#e2e8f0",
  "#0f172a", "#1e293b", "#334155", "#475569", "#6b7280", "#d1d5db",
  "#312e81", "#1e3a5f", "#1e3a3a", "#3a1e3a", "#422006", "#052e16",
  "#7c2d12", "#831843", "#172554", "#064e3b", "#365314", "#713f12",
];

export default class AtelierApp extends Component {
  @service declare designStore: DesignStoreService;
  @service declare aiService: AiServiceService;

  @tracked drawStart: Point | null = null;
  @tracked drawCurrent: Point | null = null;
  @tracked dragOffset: { dx: number; dy: number }[] = [];
  @tracked resizeHandle: string | null = null;
  @tracked resizeStart: { x: number; y: number; el: DesignElement } | null = null;
  @tracked isPanning: boolean = false;
  @tracked panStart: Point | null = null;
  @tracked panStartOffset: Point | null = null;
  @tracked marqueeStart: Point | null = null;
  @tracked marqueeCurrent: Point | null = null;
  @tracked editingLayerId: string | null = null;
  @tracked editingTextId: string | null = null;
  @tracked toastMessage: string | null = null;
  @tracked aiPrompt: string = "";

  // Canvas element ref
  private canvasEl: SVGSVGElement | null = null;

  setupCanvas = modifier((element: Element) => {
    this.canvasEl = element as unknown as SVGSVGElement;
    this.designStore.pushHistory();

    const handleKeyDown = (e: KeyboardEvent) => this.onKeyDown(e);
    const handleWheel = (e: WheelEvent) => this.onWheel(e);

    document.addEventListener("keydown", handleKeyDown);
    element.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      element.removeEventListener("wheel", handleWheel as EventListener);
    };
  });

  // ---- Coordinate conversion ----

  screenToCanvas(screenX: number, screenY: number): Point {
    if (!this.canvasEl) return { x: screenX, y: screenY };
    const rect = this.canvasEl.getBoundingClientRect();
    return {
      x: (screenX - rect.left - this.designStore.panX) / this.designStore.zoom,
      y: (screenY - rect.top - this.designStore.panY) / this.designStore.zoom,
    };
  }

  // ---- Tool selection ----

  setTool = (tool: ToolType) => {
    this.designStore.activeTool = tool;
    if (tool !== "select") {
      this.designStore.deselectAll();
    }
  };

  // ---- Canvas mouse events ----

  onCanvasMouseDown = (e: MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && this.designStore.activeTool === "hand")) {
      this.isPanning = true;
      this.panStart = { x: e.clientX, y: e.clientY };
      this.panStartOffset = { x: this.designStore.panX, y: this.designStore.panY };
      e.preventDefault();
      return;
    }

    // Close context menu
    this.designStore.contextMenuPos = null;

    const pt = this.screenToCanvas(e.clientX, e.clientY);
    const tool = this.designStore.activeTool;

    if (tool === "select") {
      // Check if clicked on an element
      const hitElement = this.hitTest(pt);
      if (hitElement) {
        if (hitElement.locked) return;
        if (e.shiftKey) {
          this.designStore.selectElement(hitElement.id, true);
        } else if (!this.designStore.selectedIds.includes(hitElement.id)) {
          this.designStore.selectElement(hitElement.id);
        }
        // Start drag
        this.designStore.isDragging = true;
        this.designStore.dragStartPoint = pt;
        this.dragOffset = this.designStore.selectedElements.map((el) => ({
          dx: el.x - pt.x,
          dy: el.y - pt.y,
        }));
      } else {
        // Start marquee
        if (!e.shiftKey) this.designStore.deselectAll();
        this.marqueeStart = pt;
        this.marqueeCurrent = pt;
      }
    } else if (
      tool === "rectangle" ||
      tool === "ellipse" ||
      tool === "frame" ||
      tool === "line" ||
      tool === "text"
    ) {
      this.drawStart = pt;
      this.drawCurrent = pt;
      this.designStore.isDrawing = true;
    }
  };

  onCanvasMouseMove = (e: MouseEvent) => {
    const pt = this.screenToCanvas(e.clientX, e.clientY);

    if (this.isPanning && this.panStart && this.panStartOffset) {
      this.designStore.panX =
        this.panStartOffset.x + (e.clientX - this.panStart.x);
      this.designStore.panY =
        this.panStartOffset.y + (e.clientY - this.panStart.y);
      return;
    }

    if (this.resizeHandle && this.resizeStart) {
      this.handleResize(pt);
      return;
    }

    if (this.designStore.isDragging && this.designStore.dragStartPoint) {
      const selected = this.designStore.selectedElements;
      for (let i = 0; i < selected.length; i++) {
        const el = selected[i]!;
        const offset = this.dragOffset[i]!;
        this.designStore.updateElement(el.id, {
          x: this.designStore.snapValue(pt.x + offset.dx),
          y: this.designStore.snapValue(pt.y + offset.dy),
        });
      }
      return;
    }

    if (this.marqueeStart) {
      this.marqueeCurrent = pt;
      return;
    }

    if (this.drawStart) {
      this.drawCurrent = pt;
      return;
    }

    // Hover detection
    if (this.designStore.activeTool === "select") {
      const hit = this.hitTest(pt);
      this.designStore.hoveredElementId = hit?.id ?? null;
    }
  };

  onCanvasMouseUp = (e: MouseEvent) => {
    if (this.isPanning) {
      this.isPanning = false;
      this.panStart = null;
      this.panStartOffset = null;
      return;
    }

    if (this.resizeHandle) {
      this.resizeHandle = null;
      this.resizeStart = null;
      return;
    }

    if (this.designStore.isDragging) {
      this.designStore.pushHistory();
      this.designStore.isDragging = false;
      this.designStore.dragStartPoint = null;
      return;
    }

    if (this.marqueeStart && this.marqueeCurrent) {
      const x = Math.min(this.marqueeStart.x, this.marqueeCurrent.x);
      const y = Math.min(this.marqueeStart.y, this.marqueeCurrent.y);
      const w = Math.abs(this.marqueeCurrent.x - this.marqueeStart.x);
      const h = Math.abs(this.marqueeCurrent.y - this.marqueeStart.y);
      if (w > 3 || h > 3) {
        this.designStore.selectInRect(x, y, w, h);
      }
      this.marqueeStart = null;
      this.marqueeCurrent = null;
      return;
    }

    if (this.drawStart && this.drawCurrent) {
      this.finishDrawing();
      return;
    }
  };

  onCanvasContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    const pt = this.screenToCanvas(e.clientX, e.clientY);
    const hit = this.hitTest(pt);
    if (hit && !this.designStore.selectedIds.includes(hit.id)) {
      this.designStore.selectElement(hit.id);
    }
    this.designStore.contextMenuPos = { x: e.clientX, y: e.clientY };
  };

  // ---- Hit testing ----

  hitTest(pt: Point): DesignElement | null {
    // Iterate in reverse (top-most first)
    for (let i = this.designStore.elements.length - 1; i >= 0; i--) {
      const el = this.designStore.elements[i]!;
      if (!el.visible) continue;
      if (
        pt.x >= el.x &&
        pt.x <= el.x + el.width &&
        pt.y >= el.y &&
        pt.y <= el.y + el.height
      ) {
        return el;
      }
    }
    return null;
  }

  // ---- Drawing ----

  finishDrawing(): void {
    if (!this.drawStart || !this.drawCurrent) return;
    const tool = this.designStore.activeTool;

    let x = Math.min(this.drawStart.x, this.drawCurrent.x);
    let y = Math.min(this.drawStart.y, this.drawCurrent.y);
    let w = Math.abs(this.drawCurrent.x - this.drawStart.x);
    let h = Math.abs(this.drawCurrent.y - this.drawStart.y);

    // Minimum size
    if (w < 5 && h < 5) {
      w = tool === "text" ? 200 : 100;
      h = tool === "text" ? 40 : 100;
    }

    x = this.designStore.snapValue(x);
    y = this.designStore.snapValue(y);
    w = this.designStore.snapValue(w);
    h = this.designStore.snapValue(h);

    this.designStore.pushHistory();

    const type = tool === "rectangle"
      ? "rectangle"
      : tool === "ellipse"
        ? "ellipse"
        : tool === "line"
          ? "line"
          : tool === "frame"
            ? "frame"
            : "text";

    const el = this.designStore.createElement(type as DesignElement["type"], {
      x,
      y,
      width: w,
      height: h,
      ...(tool === "line"
        ? { x2: this.drawCurrent.x, y2: this.drawCurrent.y }
        : {}),
    });

    this.designStore.selectElement(el.id);
    this.designStore.activeTool = "select";
    this.drawStart = null;
    this.drawCurrent = null;
    this.designStore.isDrawing = false;
  }

  // ---- Resize ----

  onResizeHandleDown = (handle: string, e: MouseEvent) => {
    e.stopPropagation();
    const el = this.designStore.singleSelection;
    if (!el) return;
    this.resizeHandle = handle;
    this.resizeStart = {
      x: e.clientX,
      y: e.clientY,
      el: { ...el },
    };
  };

  handleResize(pt: Point): void {
    if (!this.resizeStart || !this.resizeHandle) return;
    const orig = this.resizeStart.el;
    const el = this.designStore.singleSelection;
    if (!el) return;

    const handle = this.resizeHandle;
    let x = orig.x,
      y = orig.y,
      w = orig.width,
      h = orig.height;

    if (handle.includes("right")) {
      w = Math.max(10, pt.x - orig.x);
    }
    if (handle.includes("bottom")) {
      h = Math.max(10, pt.y - orig.y);
    }
    if (handle.includes("left")) {
      const newX = Math.min(pt.x, orig.x + orig.width - 10);
      w = orig.x + orig.width - newX;
      x = newX;
    }
    if (handle.includes("top")) {
      const newY = Math.min(pt.y, orig.y + orig.height - 10);
      h = orig.y + orig.height - newY;
      y = newY;
    }

    this.designStore.updateElement(el.id, {
      x: this.designStore.snapValue(x),
      y: this.designStore.snapValue(y),
      width: this.designStore.snapValue(w),
      height: this.designStore.snapValue(h),
    });
  }

  // ---- Keyboard shortcuts ----

  onKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

    const cmd = e.metaKey || e.ctrlKey;

    // Tool shortcuts
    if (!cmd && !e.shiftKey) {
      switch (e.key) {
        case "v":
        case "V":
          this.setTool("select");
          return;
        case "r":
        case "R":
          this.setTool("rectangle");
          return;
        case "o":
        case "O":
          this.setTool("ellipse");
          return;
        case "l":
        case "L":
          this.setTool("line");
          return;
        case "t":
        case "T":
          this.setTool("text");
          return;
        case "f":
        case "F":
          this.setTool("frame");
          return;
        case "h":
        case "H":
          this.setTool("hand");
          return;
        case "p":
        case "P":
          this.setTool("pen");
          return;
        case "g":
        case "G":
          this.designStore.showGrid = !this.designStore.showGrid;
          return;
      }
    }

    // Deletion
    if (e.key === "Delete" || e.key === "Backspace") {
      if (this.designStore.hasSelection) {
        e.preventDefault();
        this.designStore.deleteSelected();
      }
      return;
    }

    // Cmd shortcuts
    if (cmd) {
      switch (e.key) {
        case "z":
          e.preventDefault();
          if (e.shiftKey) {
            this.designStore.redo();
          } else {
            this.designStore.undo();
          }
          return;
        case "c":
          e.preventDefault();
          this.designStore.copySelected();
          this.showToast("Copied to clipboard");
          return;
        case "v":
          e.preventDefault();
          this.designStore.paste();
          return;
        case "d":
          e.preventDefault();
          this.designStore.duplicateSelected();
          return;
        case "a":
          e.preventDefault();
          this.designStore.selectAll();
          return;
        case "0":
          e.preventDefault();
          this.designStore.zoomToFit();
          return;
        case "=":
          e.preventDefault();
          this.designStore.zoomIn();
          return;
        case "-":
          e.preventDefault();
          this.designStore.zoomOut();
          return;
      }
    }

    // Arrow keys for nudging
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      if (!this.designStore.hasSelection) return;
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const dx = e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0;
      const dy = e.key === "ArrowDown" ? step : e.key === "ArrowUp" ? -step : 0;
      for (const el of this.designStore.selectedElements) {
        this.designStore.updateElement(el.id, {
          x: el.x + dx,
          y: el.y + dy,
        });
      }
    }

    // Escape
    if (e.key === "Escape") {
      this.designStore.deselectAll();
      this.designStore.activeTool = "select";
      this.designStore.showAiModal = false;
      this.designStore.showExportModal = false;
      this.designStore.contextMenuPos = null;
      this.designStore.showColorPicker = false;
      this.editingLayerId = null;
      this.editingTextId = null;
    }

    // Space for hand tool (temporary)
    if (e.key === " " && !this.isPanning) {
      e.preventDefault();
      this.setTool("hand");
    }
  };

  onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Zoom
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.1, Math.min(10, this.designStore.zoom * delta));

      // Zoom towards cursor
      if (this.canvasEl) {
        const rect = this.canvasEl.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        this.designStore.panX = mx - (mx - this.designStore.panX) * (newZoom / this.designStore.zoom);
        this.designStore.panY = my - (my - this.designStore.panY) * (newZoom / this.designStore.zoom);
      }
      this.designStore.zoom = newZoom;
    } else {
      // Pan
      this.designStore.panX -= e.deltaX;
      this.designStore.panY -= e.deltaY;
    }
  };

  // ---- Properties ----

  updateProp = (prop: string, e: Event) => {
    const el = this.designStore.singleSelection;
    if (!el) return;
    const target = e.target as HTMLInputElement;
    let value: string | number = target.value;

    if (["x", "y", "width", "height", "cornerRadius", "strokeWidth", "fontSize", "rotation"].includes(prop)) {
      value = parseFloat(value) || 0;
    }
    if (prop === "opacity") {
      value = parseFloat(value) || 0;
    }

    this.designStore.pushHistory();
    this.designStore.updateElement(el.id, { [prop]: value });
  };

  updateColor = (prop: string, color: string) => {
    const el = this.designStore.singleSelection;
    if (!el) return;
    this.designStore.pushHistory();
    this.designStore.updateElement(el.id, { [prop]: color });
  };

  // ---- Color picker ----

  openColorPicker = (target: "fill" | "stroke") => {
    this.designStore.colorPickerTarget = target;
    this.designStore.showColorPicker = !this.designStore.showColorPicker ||
      this.designStore.colorPickerTarget !== target;
  };

  onColorPickerInput = (e: Event) => {
    const color = (e.target as HTMLInputElement).value;
    this.updateColor(this.designStore.colorPickerTarget, color);
  };

  selectPresetColor = (color: string) => {
    this.updateColor(this.designStore.colorPickerTarget, color);
  };

  onColorHexInput = (e: Event) => {
    let hex = (e.target as HTMLInputElement).value;
    if (!hex.startsWith("#")) hex = "#" + hex;
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
      this.updateColor(this.designStore.colorPickerTarget, hex);
    }
  };

  // ---- Layers ----

  onLayerClick = (id: string, e: MouseEvent) => {
    this.designStore.selectElement(id, e.shiftKey);
  };

  onLayerDoubleClick = (id: string) => {
    this.editingLayerId = id;
  };

  onLayerNameChange = (id: string, e: Event) => {
    const name = (e.target as HTMLInputElement).value;
    this.designStore.updateElement(id, { name });
    this.editingLayerId = null;
  };

  onLayerNameKeydown = (id: string, e: KeyboardEvent) => {
    if (e.key === "Enter") {
      this.onLayerNameChange(id, e);
    } else if (e.key === "Escape") {
      this.editingLayerId = null;
    }
  };

  toggleVisibility = (id: string, e: MouseEvent) => {
    e.stopPropagation();
    const el = this.designStore.elements.find((el) => el.id === id);
    if (el) {
      this.designStore.updateElement(id, { visible: !el.visible });
    }
  };

  // ---- AI ----

  openAiModal = () => {
    this.designStore.showAiModal = true;
    this.aiPrompt = "";
  };

  closeAiModal = () => {
    this.designStore.showAiModal = false;
  };

  onAiPromptInput = (e: Event) => {
    this.aiPrompt = (e.target as HTMLTextAreaElement).value;
  };

  setAiSuggestion = (text: string) => {
    this.aiPrompt = text;
  };

  generateDesign = async () => {
    if (!this.aiPrompt.trim()) return;
    await this.aiService.generateFromPrompt(this.aiPrompt);
  };

  // ---- Export ----

  openExport = () => {
    this.designStore.showExportModal = true;
  };

  closeExport = () => {
    this.designStore.showExportModal = false;
  };

  downloadSVG = () => {
    const svg = this.designStore.exportSVG();
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${this.designStore.fileName}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    this.designStore.showExportModal = false;
    this.showToast("Exported SVG");
  };

  copySVG = () => {
    const svg = this.designStore.exportSVG();
    navigator.clipboard.writeText(svg);
    this.showToast("SVG copied to clipboard");
  };

  // ---- Context menu ----

  closeContextMenu = () => {
    this.designStore.contextMenuPos = null;
  };

  contextAction = (action: string) => {
    switch (action) {
      case "copy":
        this.designStore.copySelected();
        break;
      case "paste":
        this.designStore.paste();
        break;
      case "duplicate":
        this.designStore.duplicateSelected();
        break;
      case "delete":
        this.designStore.deleteSelected();
        break;
      case "bring-front":
        this.designStore.bringToFront();
        break;
      case "send-back":
        this.designStore.sendToBack();
        break;
      case "group":
        this.designStore.groupSelected();
        break;
      case "lock":
        if (this.designStore.singleSelection) {
          this.designStore.updateElement(this.designStore.singleSelection.id, {
            locked: !this.designStore.singleSelection.locked,
          });
        }
        break;
    }
    this.designStore.contextMenuPos = null;
  };

  // ---- File name ----

  onFileNameChange = (e: Event) => {
    this.designStore.fileName = (e.target as HTMLInputElement).value || "Untitled";
  };

  // ---- Onboarding ----

  dismissOnboarding = () => {
    this.designStore.showOnboarding = false;
  };

  startWithAi = () => {
    this.designStore.showOnboarding = false;
    this.openAiModal();
  };

  // ---- Inline prompt bar ----

  @tracked designFormat: "web" | "app" = "web";

  get isWebFormat(): boolean {
    return this.designFormat === "web";
  }

  get isAppFormat(): boolean {
    return this.designFormat === "app";
  }

  setFormat = (format: "web" | "app") => {
    this.designFormat = format;
  };

  onInlinePromptInput = (e: Event) => {
    this.aiPrompt = (e.target as HTMLInputElement).value;
  };

  onInlinePromptKeydown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && this.aiPrompt.trim()) {
      e.preventDefault();
      this.generateDesign();
    }
  };

  quickGenerate = async (prompt: string) => {
    this.aiPrompt = prompt;
    await this.aiService.generateFromPrompt(prompt);
  };

  // ---- Toast ----

  showToast(message: string): void {
    this.toastMessage = message;
    setTimeout(() => {
      this.toastMessage = null;
    }, 2000);
  }

  // ---- Computed ----

  get canvasClass(): string {
    const tool = this.designStore.activeTool;
    let cls = "canvas-area";
    cls += ` tool-${tool}`;
    if (this.isPanning) cls += " panning";
    return cls;
  }

  get zoomPercent(): string {
    return `${Math.round(this.designStore.zoom * 100)}%`;
  }

  get canvasTransform(): string {
    return `translate(${this.designStore.panX}, ${this.designStore.panY}) scale(${this.designStore.zoom})`;
  }

  get drawPreview(): { x: number; y: number; width: number; height: number } | null {
    if (!this.drawStart || !this.drawCurrent) return null;
    return {
      x: Math.min(this.drawStart.x, this.drawCurrent.x),
      y: Math.min(this.drawStart.y, this.drawCurrent.y),
      width: Math.abs(this.drawCurrent.x - this.drawStart.x),
      height: Math.abs(this.drawCurrent.y - this.drawStart.y),
    };
  }

  get marqueeRect(): { x: number; y: number; width: number; height: number } | null {
    if (!this.marqueeStart || !this.marqueeCurrent) return null;
    return {
      x: Math.min(this.marqueeStart.x, this.marqueeCurrent.x),
      y: Math.min(this.marqueeStart.y, this.marqueeCurrent.y),
      width: Math.abs(this.marqueeCurrent.x - this.marqueeStart.x),
      height: Math.abs(this.marqueeCurrent.y - this.marqueeStart.y),
    };
  }

  get reversedElements(): DesignElement[] {
    return [...this.designStore.elements].reverse();
  }

  get selectedElement(): DesignElement | null {
    return this.designStore.singleSelection;
  }

  get svgContent(): string {
    return this.designStore.exportSVG();
  }

  // ---- Layer icon helper ----
  layerIconType = (type: string): string => {
    const icons: Record<string, string> = {
      rectangle: "rect",
      ellipse: "ellipse",
      text: "text",
      line: "line",
      frame: "frame",
      image: "image",
    };
    return icons[type] || "rect";
  };

  <template>
    <div class="atelier-app">
      {{! ---- Toolbar ---- }}
      <div class="toolbar">
        <button
          class="tool-btn {{if (this.isToolActive 'select') 'active'}}"
          type="button"
          {{on "click" (fn this.setTool "select")}}
        >
          <IconCursor />
          <span class="tool-tooltip">Select<span class="tool-shortcut">V</span></span>
        </button>
        <button
          class="tool-btn {{if (this.isToolActive 'frame') 'active'}}"
          type="button"
          {{on "click" (fn this.setTool "frame")}}
        >
          <IconFrame />
          <span class="tool-tooltip">Frame<span class="tool-shortcut">F</span></span>
        </button>

        <div class="toolbar-divider"></div>

        <button
          class="tool-btn {{if (this.isToolActive 'rectangle') 'active'}}"
          type="button"
          {{on "click" (fn this.setTool "rectangle")}}
        >
          <IconRect />
          <span class="tool-tooltip">Rectangle<span class="tool-shortcut">R</span></span>
        </button>
        <button
          class="tool-btn {{if (this.isToolActive 'ellipse') 'active'}}"
          type="button"
          {{on "click" (fn this.setTool "ellipse")}}
        >
          <IconEllipse />
          <span class="tool-tooltip">Ellipse<span class="tool-shortcut">O</span></span>
        </button>
        <button
          class="tool-btn {{if (this.isToolActive 'line') 'active'}}"
          type="button"
          {{on "click" (fn this.setTool "line")}}
        >
          <IconLine />
          <span class="tool-tooltip">Line<span class="tool-shortcut">L</span></span>
        </button>

        <div class="toolbar-divider"></div>

        <button
          class="tool-btn {{if (this.isToolActive 'text') 'active'}}"
          type="button"
          {{on "click" (fn this.setTool "text")}}
        >
          <IconText />
          <span class="tool-tooltip">Text<span class="tool-shortcut">T</span></span>
        </button>
        <button
          class="tool-btn {{if (this.isToolActive 'pen') 'active'}}"
          type="button"
          {{on "click" (fn this.setTool "pen")}}
        >
          <IconPen />
          <span class="tool-tooltip">Pen<span class="tool-shortcut">P</span></span>
        </button>

        <div class="toolbar-divider"></div>

        <button
          class="tool-btn {{if (this.isToolActive 'hand') 'active'}}"
          type="button"
          {{on "click" (fn this.setTool "hand")}}
        >
          <IconHand />
          <span class="tool-tooltip">Hand<span class="tool-shortcut">H</span></span>
        </button>
      </div>

      {{! ---- Top Bar ---- }}
      <div class="topbar">
        <a href="../../" class="topbar-back" title="All Tools">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        </a>
        <div class="topbar-logo">
          <IconSparkles />
          Atelier
        </div>

        <input
          class="topbar-filename"
          type="text"
          value={{this.designStore.fileName}}
          {{on "change" this.onFileNameChange}}
        />

        <div class="topbar-separator"></div>

        <button
          class="topbar-btn {{if this.designStore.canUndo '' 'disabled'}}"
          type="button"
          title="Undo (Cmd+Z)"
          {{on "click" this.designStore.undo}}
        >
          <IconUndo />
        </button>
        <button
          class="topbar-btn"
          type="button"
          title="Redo (Cmd+Shift+Z)"
          {{on "click" this.designStore.redo}}
        >
          <IconRedo />
        </button>

        <div class="topbar-actions">
          <button
            class="topbar-btn {{if this.designStore.showGrid 'active'}}"
            type="button"
            {{on "click" this.toggleGrid}}
          >
            <IconGrid />
            Grid
          </button>
          <button
            class="topbar-btn {{if this.designStore.snapToGrid 'active'}}"
            type="button"
            {{on "click" this.toggleSnap}}
          >
            <IconMagnet />
            Snap
          </button>

          <div class="topbar-separator"></div>

          <button class="topbar-btn" type="button" {{on "click" this.openExport}}>
            <IconExport />
            Export
          </button>

          <button class="topbar-btn ai-btn" type="button" {{on "click" this.openAiModal}}>
            <IconSparkles />
            AI Generate
          </button>
        </div>
      </div>

      {{! ---- Layers Panel ---- }}
      <div class="layers-panel">
        <div class="panel-header">
          <span class="panel-title">Layers</span>
          <div class="panel-actions">
            <button class="panel-action-btn" type="button" title="Select All" {{on "click" this.designStore.selectAll}}>
              <IconLayers />
            </button>
          </div>
        </div>
        <div class="layers-list">
          {{#if this.designStore.elements.length}}
            {{#each this.reversedElements as |el|}}
              <div
                class="layer-item
                  {{if (this.isSelected el.id) 'selected'}}
                  {{if (this.isHovered el.id) 'hovered'}}"
                role="button"
                {{on "click" (fn this.onLayerClick el.id)}}
                {{on "dblclick" (fn this.onLayerDoubleClick el.id)}}
              >
                <span class="layer-icon">
                  {{#if (this.isType el "rectangle")}}
                    <IconRect />
                  {{else if (this.isType el "ellipse")}}
                    <IconEllipse />
                  {{else if (this.isType el "text")}}
                    <IconText />
                  {{else if (this.isType el "line")}}
                    <IconLine />
                  {{else if (this.isType el "frame")}}
                    <IconFrame />
                  {{else}}
                    <IconRect />
                  {{/if}}
                </span>

                {{#if (this.isEditing el.id)}}
                  <input
                    class="layer-name-input"
                    type="text"
                    value={{el.name}}
                    {{on "change" (fn this.onLayerNameChange el.id)}}
                    {{on "keydown" (fn this.onLayerNameKeydown el.id)}}
                    {{on "blur" (fn this.onLayerNameChange el.id)}}
                  />
                {{else}}
                  <span class="layer-name">{{el.name}}</span>
                {{/if}}

                <button
                  class="layer-visibility {{unless el.visible 'hidden'}}"
                  type="button"
                  {{on "click" (fn this.toggleVisibility el.id)}}
                >
                  {{#if el.visible}}
                    <IconEye />
                  {{else}}
                    <IconEyeOff />
                  {{/if}}
                </button>
              </div>
            {{/each}}
          {{else}}
            <div class="layers-empty">
              <IconLayers />
              <span class="layers-empty-text">No layers yet.<br/>Draw something on the canvas<br/>or use AI Generate.</span>
            </div>
          {{/if}}
        </div>
      </div>

      {{! ---- Canvas ---- }}
      <div class={{this.canvasClass}}>
        {{! Onboarding }}
        {{#if this.showOnboarding}}
          <div class="onboarding-overlay">
            <div class="onboarding-card">
              <div class="onboarding-icon">
                <IconSparkles />
              </div>
              <h2 class="onboarding-title">Welcome to Atelier</h2>
              <p class="onboarding-desc">
                A design studio for crafting beautiful interfaces.
                Draw shapes, arrange layouts, and let AI generate
                entire designs from a text prompt.
              </p>
              <div class="onboarding-actions">
                <button class="onboarding-btn" type="button" {{on "click" this.dismissOnboarding}}>
                  Start from Scratch
                </button>
                <button class="onboarding-btn primary" type="button" {{on "click" this.startWithAi}}>
                  <IconSparkles />
                  Generate with AI
                </button>
              </div>
              <div class="onboarding-shortcuts">
                <span class="shortcut-item"><span class="shortcut-key">V</span> Select</span>
                <span class="shortcut-item"><span class="shortcut-key">R</span> Rectangle</span>
                <span class="shortcut-item"><span class="shortcut-key">O</span> Ellipse</span>
                <span class="shortcut-item"><span class="shortcut-key">T</span> Text</span>
                <span class="shortcut-item"><span class="shortcut-key">L</span> Line</span>
                <span class="shortcut-item"><span class="shortcut-key">F</span> Frame</span>
                <span class="shortcut-item"><span class="shortcut-key">H</span> Hand/Pan</span>
                <span class="shortcut-item"><span class="shortcut-key">G</span> Toggle Grid</span>
              </div>
            </div>
          </div>
        {{/if}}

        <svg
          class="canvas-svg"
          {{this.setupCanvas}}
          {{on "mousedown" this.onCanvasMouseDown}}
          {{on "mousemove" this.onCanvasMouseMove}}
          {{on "mouseup" this.onCanvasMouseUp}}
          {{on "contextmenu" this.onCanvasContextMenu}}
        >
          <g transform={{this.canvasTransform}}>
            {{! Grid }}
            {{#if this.designStore.showGrid}}
              <defs>
                <pattern id="grid-small" width={{this.designStore.gridSize}} height={{this.designStore.gridSize}} patternUnits="userSpaceOnUse">
                  <path d="M {{this.designStore.gridSize}} 0 L 0 0 0 {{this.designStore.gridSize}}" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="0.5"/>
                </pattern>
                <pattern id="grid-large" width={{this.largeGridSize}} height={{this.largeGridSize}} patternUnits="userSpaceOnUse">
                  <rect width={{this.largeGridSize}} height={{this.largeGridSize}} fill="url(#grid-small)"/>
                  <path d="M {{this.largeGridSize}} 0 L 0 0 0 {{this.largeGridSize}}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="0.5"/>
                </pattern>
              </defs>
              <rect x="-10000" y="-10000" width="20000" height="20000" fill="url(#grid-large)" class="grid-pattern"/>
            {{/if}}

            {{! Elements }}
            {{#each this.designStore.elements as |el|}}
              {{#if el.visible}}
                {{#if (this.isType el "rectangle")}}
                  <rect
                    class="design-element {{if el.locked 'locked'}}"
                    x={{el.x}}
                    y={{el.y}}
                    width={{el.width}}
                    height={{el.height}}
                    rx={{el.cornerRadius}}
                    fill={{el.fill}}
                    stroke={{el.stroke}}
                    stroke-width={{el.strokeWidth}}
                    opacity={{el.opacity}}
                    transform={{this.elementTransform el}}
                  />
                {{else if (this.isType el "frame")}}
                  <rect
                    class="design-element {{if el.locked 'locked'}}"
                    x={{el.x}}
                    y={{el.y}}
                    width={{el.width}}
                    height={{el.height}}
                    rx={{el.cornerRadius}}
                    fill={{el.fill}}
                    stroke={{el.stroke}}
                    stroke-width={{el.strokeWidth}}
                    opacity={{el.opacity}}
                    transform={{this.elementTransform el}}
                  />
                  <text
                    x={{el.x}}
                    y={{this.frameNameY el}}
                    font-size="11"
                    fill="rgba(255,255,255,0.4)"
                    font-family="Inter, system-ui, sans-serif"
                    pointer-events="none"
                  >{{el.name}}</text>
                {{else if (this.isType el "ellipse")}}
                  <ellipse
                    class="design-element {{if el.locked 'locked'}}"
                    cx={{this.centerX el}}
                    cy={{this.centerY el}}
                    rx={{this.halfWidth el}}
                    ry={{this.halfHeight el}}
                    fill={{el.fill}}
                    stroke={{el.stroke}}
                    stroke-width={{el.strokeWidth}}
                    opacity={{el.opacity}}
                    transform={{this.elementTransform el}}
                  />
                {{else if (this.isType el "text")}}
                  <text
                    class="design-element {{if el.locked 'locked'}}"
                    x={{el.x}}
                    y={{this.textBaselineY el}}
                    font-size={{el.fontSize}}
                    font-weight={{el.fontWeight}}
                    font-family={{el.fontFamily}}
                    fill={{el.fill}}
                    opacity={{el.opacity}}
                    transform={{this.elementTransform el}}
                  >{{el.text}}</text>
                  {{! Invisible hit area for text }}
                  <rect
                    x={{el.x}}
                    y={{el.y}}
                    width={{el.width}}
                    height={{el.height}}
                    fill="transparent"
                    class="design-element"
                  />
                {{else if (this.isType el "line")}}
                  <line
                    class="design-element {{if el.locked 'locked'}}"
                    x1={{el.x}}
                    y1={{el.y}}
                    x2={{this.lineX2 el}}
                    y2={{this.lineY2 el}}
                    stroke={{this.lineStroke el}}
                    stroke-width={{this.lineStrokeWidth el}}
                    opacity={{el.opacity}}
                  />
                  {{! Hit area for line }}
                  <line
                    x1={{el.x}}
                    y1={{el.y}}
                    x2={{this.lineX2 el}}
                    y2={{this.lineY2 el}}
                    stroke="transparent"
                    stroke-width="10"
                    class="design-element"
                  />
                {{/if}}
              {{/if}}
            {{/each}}

            {{! Hover outline }}
            {{#if this.hoverElement}}
              {{#unless (this.isSelected this.hoverElement.id)}}
                <rect
                  class="hover-outline"
                  x={{this.hoverElement.x}}
                  y={{this.hoverElement.y}}
                  width={{this.hoverElement.width}}
                  height={{this.hoverElement.height}}
                  rx={{this.hoverElement.cornerRadius}}
                />
              {{/unless}}
            {{/if}}

            {{! Selection boxes and handles }}
            {{#each this.designStore.selectedElements as |el|}}
              <rect
                class="selection-box"
                x={{el.x}}
                y={{el.y}}
                width={{el.width}}
                height={{el.height}}
              />
            {{/each}}

            {{! Resize handles for single selection }}
            {{#if this.selectedElement}}
              {{! Corner handles }}
              <rect
                class="selection-handle top-left"
                x={{this.handleX this.selectedElement "left"}}
                y={{this.handleY this.selectedElement "top"}}
                width="8"
                height="8"
                rx="1"
                {{on "mousedown" (fn this.onResizeHandleDown "top-left")}}
              />
              <rect
                class="selection-handle top-right"
                x={{this.handleX this.selectedElement "right"}}
                y={{this.handleY this.selectedElement "top"}}
                width="8"
                height="8"
                rx="1"
                {{on "mousedown" (fn this.onResizeHandleDown "top-right")}}
              />
              <rect
                class="selection-handle bottom-left"
                x={{this.handleX this.selectedElement "left"}}
                y={{this.handleY this.selectedElement "bottom"}}
                width="8"
                height="8"
                rx="1"
                {{on "mousedown" (fn this.onResizeHandleDown "bottom-left")}}
              />
              <rect
                class="selection-handle bottom-right"
                x={{this.handleX this.selectedElement "right"}}
                y={{this.handleY this.selectedElement "bottom"}}
                width="8"
                height="8"
                rx="1"
                {{on "mousedown" (fn this.onResizeHandleDown "bottom-right")}}
              />
              {{! Edge handles }}
              <rect
                class="selection-handle top"
                x={{this.handleX this.selectedElement "center"}}
                y={{this.handleY this.selectedElement "top"}}
                width="8"
                height="8"
                rx="1"
                {{on "mousedown" (fn this.onResizeHandleDown "top")}}
              />
              <rect
                class="selection-handle bottom"
                x={{this.handleX this.selectedElement "center"}}
                y={{this.handleY this.selectedElement "bottom"}}
                width="8"
                height="8"
                rx="1"
                {{on "mousedown" (fn this.onResizeHandleDown "bottom")}}
              />
              <rect
                class="selection-handle left"
                x={{this.handleX this.selectedElement "left"}}
                y={{this.handleY this.selectedElement "middle"}}
                width="8"
                height="8"
                rx="1"
                {{on "mousedown" (fn this.onResizeHandleDown "left")}}
              />
              <rect
                class="selection-handle right"
                x={{this.handleX this.selectedElement "right"}}
                y={{this.handleY this.selectedElement "middle"}}
                width="8"
                height="8"
                rx="1"
                {{on "mousedown" (fn this.onResizeHandleDown "right")}}
              />
            {{/if}}

            {{! Draw preview }}
            {{#if this.drawPreview}}
              {{#if (this.isDrawingEllipse)}}
                <ellipse
                  class="draw-preview"
                  cx={{this.drawPreviewCX}}
                  cy={{this.drawPreviewCY}}
                  rx={{this.drawPreviewRX}}
                  ry={{this.drawPreviewRY}}
                />
              {{else}}
                <rect
                  class="draw-preview"
                  x={{this.drawPreview.x}}
                  y={{this.drawPreview.y}}
                  width={{this.drawPreview.width}}
                  height={{this.drawPreview.height}}
                />
              {{/if}}
            {{/if}}

            {{! Marquee selection }}
            {{#if this.marqueeRect}}
              <rect
                class="marquee-rect"
                x={{this.marqueeRect.x}}
                y={{this.marqueeRect.y}}
                width={{this.marqueeRect.width}}
                height={{this.marqueeRect.height}}
              />
            {{/if}}
          </g>
        </svg>

        {{! ---- Inline AI Prompt Bar ---- }}
        {{#if this.designStore.aiGenerating}}
          <div class="ai-generating-overlay">
            <div class="ai-generating-dot"></div>
            <div class="ai-generating-dot"></div>
            <div class="ai-generating-dot"></div>
            <span class="ai-generating-text">Generating your design...</span>
          </div>
        {{else}}
          {{#unless this.showOnboarding}}
            <div class="ai-prompt-bar">
              <div class="ai-prompt-bar-chips">
                <button class="ai-prompt-chip" type="button" {{on "click" (fn this.quickGenerate "A modern SaaS landing page with hero, features, and stats")}}>Landing Page</button>
                <button class="ai-prompt-chip" type="button" {{on "click" (fn this.quickGenerate "A mobile banking app with balance card and transactions")}}>Mobile App</button>
                <button class="ai-prompt-chip" type="button" {{on "click" (fn this.quickGenerate "An analytics dashboard with charts, stats cards, and data table")}}>Dashboard</button>
              </div>
              <div class="ai-prompt-bar-inner">
                <div class="ai-prompt-format-toggle">
                  <button class="format-toggle-btn {{if this.isWebFormat 'active'}}" type="button" {{on "click" (fn this.setFormat "web")}}>
                    <IconFrame />
                    Web
                  </button>
                  <button class="format-toggle-btn {{if this.isAppFormat 'active'}}" type="button" {{on "click" (fn this.setFormat "app")}}>
                    <IconRect />
                    App
                  </button>
                </div>
                <input
                  class="ai-prompt-input"
                  type="text"
                  placeholder="Describe a UI to generate..."
                  value={{this.aiPrompt}}
                  {{on "input" this.onInlinePromptInput}}
                  {{on "keydown" this.onInlinePromptKeydown}}
                />
                <button
                  class="ai-prompt-send"
                  type="button"
                  disabled={{this.isAiDisabled}}
                  {{on "click" this.generateDesign}}
                >
                  <IconSparkles />
                </button>
              </div>
            </div>
          {{/unless}}
        {{/if}}
      </div>

      {{! ---- Properties Panel ---- }}
      <div class="properties-panel">
        {{#if this.selectedElement}}
          {{! Position & Size }}
          <div class="props-section">
            <div class="props-section-title">Position & Size</div>
            <div class="props-row">
              <span class="props-label">X</span>
              <input
                class="props-input"
                type="number"
                value={{this.selectedElement.x}}
                {{on "change" (fn this.updateProp "x")}}
              />
              <span class="props-label">Y</span>
              <input
                class="props-input"
                type="number"
                value={{this.selectedElement.y}}
                {{on "change" (fn this.updateProp "y")}}
              />
            </div>
            <div class="props-row">
              <span class="props-label">W</span>
              <input
                class="props-input"
                type="number"
                value={{this.selectedElement.width}}
                {{on "change" (fn this.updateProp "width")}}
              />
              <span class="props-label">H</span>
              <input
                class="props-input"
                type="number"
                value={{this.selectedElement.height}}
                {{on "change" (fn this.updateProp "height")}}
              />
            </div>
            <div class="props-row">
              <span class="props-label">R</span>
              <input
                class="props-input"
                type="number"
                value={{this.selectedElement.rotation}}
                {{on "change" (fn this.updateProp "rotation")}}
              />
              <span class="props-label"></span>
              <input
                class="props-input"
                type="number"
                value={{this.selectedElement.cornerRadius}}
                placeholder="Radius"
                {{on "change" (fn this.updateProp "cornerRadius")}}
              />
            </div>
          </div>

          {{! Appearance }}
          <div class="props-section">
            <div class="props-section-title">Appearance</div>
            <div class="props-row">
              <span class="props-label">Fill</span>
              <button
                class="props-color-swatch"
                type="button"
                style={{this.fillSwatchStyle}}
                {{on "click" (fn this.openColorPicker "fill")}}
              ></button>
              <input
                class="props-input"
                type="text"
                value={{this.selectedElement.fill}}
                {{on "change" (fn this.updateProp "fill")}}
              />
            </div>
            <div class="props-row">
              <span class="props-label">Stroke</span>
              <button
                class="props-color-swatch"
                type="button"
                style={{this.strokeSwatchStyle}}
                {{on "click" (fn this.openColorPicker "stroke")}}
              ></button>
              <input
                class="props-input"
                type="text"
                value={{this.selectedElement.stroke}}
                {{on "change" (fn this.updateProp "stroke")}}
              />
            </div>
            <div class="props-row">
              <span class="props-label">SW</span>
              <input
                class="props-input props-input-sm"
                type="number"
                value={{this.selectedElement.strokeWidth}}
                min="0"
                {{on "change" (fn this.updateProp "strokeWidth")}}
              />
            </div>
            <div class="props-row">
              <span class="props-label">Op</span>
              <input
                class="props-slider"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={{this.selectedElement.opacity}}
                {{on "input" (fn this.updateProp "opacity")}}
              />
              <span class="props-slider-value">{{this.opacityPercent}}</span>
            </div>
          </div>

          {{! Text properties }}
          {{#if (this.isType this.selectedElement "text")}}
            <div class="props-section">
              <div class="props-section-title">Typography</div>
              <div class="props-row">
                <span class="props-label">Txt</span>
                <input
                  class="props-input"
                  type="text"
                  value={{this.selectedElement.text}}
                  {{on "input" (fn this.updateProp "text")}}
                />
              </div>
              <div class="props-row">
                <span class="props-label">Sz</span>
                <input
                  class="props-input props-input-sm"
                  type="number"
                  value={{this.selectedElement.fontSize}}
                  min="1"
                  {{on "change" (fn this.updateProp "fontSize")}}
                />
                <span class="props-label">Wt</span>
                <select
                  class="props-select"
                  {{on "change" (fn this.updateProp "fontWeight")}}
                >
                  <option value="300" selected={{this.isFontWeight "300"}}>Light</option>
                  <option value="400" selected={{this.isFontWeight "400"}}>Regular</option>
                  <option value="500" selected={{this.isFontWeight "500"}}>Medium</option>
                  <option value="600" selected={{this.isFontWeight "600"}}>Semibold</option>
                  <option value="700" selected={{this.isFontWeight "700"}}>Bold</option>
                  <option value="800" selected={{this.isFontWeight "800"}}>Extra Bold</option>
                </select>
              </div>
              <div class="props-row">
                <span class="props-label">Align</span>
                <select
                  class="props-select"
                  {{on "change" (fn this.updateProp "textAlign")}}
                >
                  <option value="left" selected={{this.isTextAlign "left"}}>Left</option>
                  <option value="center" selected={{this.isTextAlign "center"}}>Center</option>
                  <option value="right" selected={{this.isTextAlign "right"}}>Right</option>
                </select>
              </div>
            </div>
          {{/if}}

          {{! Alignment }}
          {{#if this.showAlignment}}
            <div class="props-section">
              <div class="props-section-title">Alignment</div>
              <div class="props-row">
                <div class="align-buttons">
                  <button class="align-btn" type="button" title="Align Left" {{on "click" (fn this.align "left")}}><IconAlignLeft /></button>
                  <button class="align-btn" type="button" title="Align Center" {{on "click" (fn this.align "center")}}><IconAlignCenter /></button>
                  <button class="align-btn" type="button" title="Align Right" {{on "click" (fn this.align "right")}}><IconAlignRight /></button>
                  <button class="align-btn" type="button" title="Align Top" {{on "click" (fn this.align "top")}}><IconAlignTop /></button>
                  <button class="align-btn" type="button" title="Align Middle" {{on "click" (fn this.align "middle")}}><IconAlignMiddle /></button>
                  <button class="align-btn" type="button" title="Align Bottom" {{on "click" (fn this.align "bottom")}}><IconAlignBottom /></button>
                </div>
              </div>
            </div>
          {{/if}}

          {{! Actions }}
          <div class="props-section">
            <div class="props-section-title">Actions</div>
            <div class="props-btn-row">
              <button class="props-btn" type="button" {{on "click" this.designStore.bringToFront}}>
                <IconChevronUp /> Front
              </button>
              <button class="props-btn" type="button" {{on "click" this.designStore.sendToBack}}>
                <IconChevronDown /> Back
              </button>
            </div>
            <div class="props-btn-row">
              <button class="props-btn" type="button" {{on "click" this.duplicateElement}}>
                <IconCopy /> Duplicate
              </button>
              <button class="props-btn danger" type="button" {{on "click" this.designStore.deleteSelected}}>
                <IconTrash /> Delete
              </button>
            </div>
          </div>

        {{else if this.hasMultiSelection}}
          <div class="props-section">
            <div class="multi-selection-info">
              <div class="multi-count">{{this.designStore.selectedIds.length}} elements selected</div>
              <div class="multi-hint">Edit properties of individual elements by selecting one.</div>
            </div>
          </div>
          <div class="props-section">
            <div class="props-section-title">Alignment</div>
            <div class="props-row">
              <div class="align-buttons">
                <button class="align-btn" type="button" title="Align Left" {{on "click" (fn this.align "left")}}><IconAlignLeft /></button>
                <button class="align-btn" type="button" title="Align Center" {{on "click" (fn this.align "center")}}><IconAlignCenter /></button>
                <button class="align-btn" type="button" title="Align Right" {{on "click" (fn this.align "right")}}><IconAlignRight /></button>
                <button class="align-btn" type="button" title="Align Top" {{on "click" (fn this.align "top")}}><IconAlignTop /></button>
                <button class="align-btn" type="button" title="Align Middle" {{on "click" (fn this.align "middle")}}><IconAlignMiddle /></button>
                <button class="align-btn" type="button" title="Align Bottom" {{on "click" (fn this.align "bottom")}}><IconAlignBottom /></button>
              </div>
            </div>
            <div class="props-btn-row">
              <button class="props-btn" type="button" {{on "click" this.designStore.deleteSelected}}>
                Delete All
              </button>
              <button class="props-btn" type="button" {{on "click" this.designStore.groupSelected}}>
                Group
              </button>
            </div>
          </div>
        {{else}}
          <div class="props-empty">
            <IconCursor />
            <span>Select an element to<br/>edit its properties</span>
          </div>
        {{/if}}
      </div>

      {{! ---- Status Bar ---- }}
      <div class="status-bar">
        <div class="status-left">
          <span class="status-item">{{this.designStore.elements.length}} elements</span>
          {{#if this.designStore.hasSelection}}
            <span class="status-item">{{this.designStore.selectedIds.length}} selected</span>
          {{/if}}
        </div>
        <div class="status-right">
          <div class="zoom-controls">
            <button class="zoom-btn" type="button" {{on "click" this.designStore.zoomOut}}>-</button>
            <span class="zoom-value" role="button" {{on "click" this.designStore.zoomToFit}}>{{this.zoomPercent}}</span>
            <button class="zoom-btn" type="button" {{on "click" this.designStore.zoomIn}}>+</button>
            <button class="zoom-btn" type="button" title="Zoom to Fit (Cmd+0)" {{on "click" this.designStore.zoomToFit}}>
              <IconZoomFit />
            </button>
          </div>
        </div>
      </div>

      {{! ---- Color Picker ---- }}
      {{#if this.showColorPickerForSelection}}
        <div class="color-picker-popup" style={{this.colorPickerPosition}}>
          <div class="color-picker-header">
            <span class="color-picker-title">{{this.designStore.colorPickerTarget}}</span>
            <button class="panel-action-btn" type="button" {{on "click" this.closeColorPicker}}>
              <IconX />
            </button>
          </div>
          <input
            class="color-picker-native"
            type="color"
            value={{this.currentPickerColor}}
            {{on "input" this.onColorPickerInput}}
          />
          <div class="color-swatches">
            {{#each this.presetColors as |color|}}
              <button
                class="color-swatch {{if (this.isColorActive color) 'active'}}"
                type="button"
                style={{this.swatchStyle color}}
                {{on "click" (fn this.selectPresetColor color)}}
              ></button>
            {{/each}}
          </div>
          <input
            class="color-hex-input"
            type="text"
            value={{this.currentPickerColor}}
            placeholder="#000000"
            {{on "change" this.onColorHexInput}}
          />
        </div>
      {{/if}}

      {{! ---- Context Menu ---- }}
      {{#if this.designStore.contextMenuPos}}
        <div class="context-menu" style={{this.contextMenuStyle}}>
          <button class="context-menu-item" type="button" {{on "click" (fn this.contextAction "copy")}}>
            Copy <span class="context-menu-shortcut">Cmd+C</span>
          </button>
          <button class="context-menu-item" type="button" {{on "click" (fn this.contextAction "paste")}}>
            Paste <span class="context-menu-shortcut">Cmd+V</span>
          </button>
          <button class="context-menu-item" type="button" {{on "click" (fn this.contextAction "duplicate")}}>
            Duplicate <span class="context-menu-shortcut">Cmd+D</span>
          </button>
          <div class="context-menu-divider"></div>
          <button class="context-menu-item" type="button" {{on "click" (fn this.contextAction "bring-front")}}>
            Bring to Front
          </button>
          <button class="context-menu-item" type="button" {{on "click" (fn this.contextAction "send-back")}}>
            Send to Back
          </button>
          <div class="context-menu-divider"></div>
          {{#if this.designStore.singleSelection}}
            <button class="context-menu-item" type="button" {{on "click" (fn this.contextAction "lock")}}>
              {{if this.designStore.singleSelection.locked "Unlock" "Lock"}}
            </button>
          {{/if}}
          {{#if this.hasMultiSelection}}
            <button class="context-menu-item" type="button" {{on "click" (fn this.contextAction "group")}}>
              Group
            </button>
          {{/if}}
          <div class="context-menu-divider"></div>
          <button class="context-menu-item danger" type="button" {{on "click" (fn this.contextAction "delete")}}>
            Delete <span class="context-menu-shortcut">Del</span>
          </button>
        </div>
        {{! Backdrop to close context menu }}
        <div
          style="position:fixed;inset:0;z-index:999;"
          role="button"
          {{on "click" this.closeContextMenu}}
          {{on "contextmenu" this.closeContextMenu}}
        ></div>
      {{/if}}

      {{! ---- AI Modal ---- }}
      {{#if this.designStore.showAiModal}}
        <div class="modal-overlay" role="button" {{on "click" this.closeAiModal}}>
          {{#if this.designStore.aiGenerating}}
            <div class="ai-modal" role="dialog" {{on "click" this.stopPropagation}}>
              <div class="ai-loading">
                <div class="ai-loading-spinner"></div>
                <span class="ai-loading-text">Generating your design...</span>
              </div>
            </div>
          {{else}}
            <div class="ai-modal" role="dialog" {{on "click" this.stopPropagation}}>
              <div class="ai-modal-header">
                <div class="ai-modal-icon">
                  <IconSparkles />
                </div>
                <div>
                  <div class="ai-modal-title">AI Design Generator</div>
                  <div class="ai-modal-subtitle">Describe what you want to create</div>
                </div>
                <button class="ai-modal-close" type="button" {{on "click" this.closeAiModal}}>
                  <IconX />
                </button>
              </div>
              <div class="ai-modal-body">
                <textarea
                  class="ai-textarea"
                  placeholder="Describe the interface you want to design...

Example: A modern SaaS landing page with hero section, feature cards, and pricing table"
                  value={{this.aiPrompt}}
                  {{on "input" this.onAiPromptInput}}
                ></textarea>
                <div class="ai-suggestions">
                  <button class="ai-suggestion" type="button" {{on "click" (fn this.setAiSuggestion "A modern SaaS landing page with hero, features, and stats")}}>
                    Landing Page
                  </button>
                  <button class="ai-suggestion" type="button" {{on "click" (fn this.setAiSuggestion "A mobile banking app with balance card and transactions")}}>
                    Mobile App
                  </button>
                  <button class="ai-suggestion" type="button" {{on "click" (fn this.setAiSuggestion "An analytics dashboard with charts, stats cards, and data table")}}>
                    Dashboard
                  </button>
                </div>
              </div>
              <div class="ai-modal-footer">
                <span class="ai-footer-hint">AI will generate a complete layout on your canvas</span>
                <button
                  class="ai-generate-btn"
                  type="button"
                  disabled={{this.isAiDisabled}}
                  {{on "click" this.generateDesign}}
                >
                  <IconSparkles />
                  Generate
                </button>
              </div>
            </div>
          {{/if}}
        </div>
      {{/if}}

      {{! ---- Export Modal ---- }}
      {{#if this.designStore.showExportModal}}
        <div class="modal-overlay" role="button" {{on "click" this.closeExport}}>
          <div class="export-modal" role="dialog" {{on "click" this.stopPropagation}}>
            <div class="export-modal-header">
              <div class="export-modal-title">Export Design</div>
            </div>
            <div class="export-preview">
              <pre>{{this.svgContent}}</pre>
            </div>
            <div class="export-modal-footer">
              <button class="export-btn" type="button" {{on "click" this.closeExport}}>Cancel</button>
              <button class="export-btn" type="button" {{on "click" this.copySVG}}>Copy SVG</button>
              <button class="export-btn primary" type="button" {{on "click" this.downloadSVG}}>
                <IconDownload /> Download SVG
              </button>
            </div>
          </div>
        </div>
      {{/if}}

      {{! ---- Toast ---- }}
      {{#if this.toastMessage}}
        <div class="toast">{{this.toastMessage}}</div>
      {{/if}}
    </div>
  </template>

  // ---- Helper methods for template ----

  isToolActive = (tool: string): boolean => {
    return this.designStore.activeTool === tool;
  };

  isSelected = (id: string): boolean => {
    return this.designStore.selectedIds.includes(id);
  };

  isHovered = (id: string): boolean => {
    return this.designStore.hoveredElementId === id;
  };

  isEditing = (id: string): boolean => {
    return this.editingLayerId === id;
  };

  isType = (el: DesignElement, type: string): boolean => {
    return el.type === type;
  };

  get showOnboarding(): boolean {
    return this.designStore.showOnboarding && this.designStore.elements.length === 0;
  }

  get hasMultiSelection(): boolean {
    return this.designStore.selectedIds.length > 1;
  }

  get showAlignment(): boolean {
    return this.designStore.selectedIds.length >= 2;
  }

  get opacityPercent(): string {
    const el = this.selectedElement;
    if (!el) return "100%";
    return `${Math.round(el.opacity * 100)}%`;
  }

  get fillSwatchStyle(): string {
    const el = this.selectedElement;
    return `background-color: ${el?.fill || "#000"}`;
  }

  get strokeSwatchStyle(): string {
    const el = this.selectedElement;
    return `background-color: ${el?.stroke || "transparent"}`;
  }

  get hoverElement(): DesignElement | null {
    if (!this.designStore.hoveredElementId) return null;
    return (
      this.designStore.elements.find(
        (el) => el.id === this.designStore.hoveredElementId,
      ) ?? null
    );
  }

  get largeGridSize(): number {
    return this.designStore.gridSize * 5;
  }

  get isAiDisabled(): boolean {
    return !this.aiPrompt.trim();
  }

  get presetColors(): string[] {
    return PRESET_COLORS;
  }

  get showColorPickerForSelection(): boolean {
    return this.designStore.showColorPicker && !!this.selectedElement;
  }

  get currentPickerColor(): string {
    const el = this.selectedElement;
    if (!el) return "#000000";
    const target = this.designStore.colorPickerTarget;
    const color = target === "fill" ? el.fill : el.stroke;
    return color === "transparent" ? "#000000" : color;
  }

  get contextMenuStyle(): string {
    const pos = this.designStore.contextMenuPos;
    if (!pos) return "";
    return `top: ${pos.y}px; left: ${pos.x}px; z-index: 1001;`;
  }

  get colorPickerPosition(): string {
    return "top: 200px;";
  }

  // SVG element helpers
  centerX = (el: DesignElement): number => el.x + el.width / 2;
  centerY = (el: DesignElement): number => el.y + el.height / 2;
  halfWidth = (el: DesignElement): number => el.width / 2;
  halfHeight = (el: DesignElement): number => el.height / 2;
  textBaselineY = (el: DesignElement): number => el.y + (el.fontSize || 24);
  frameNameY = (el: DesignElement): number => el.y - 6;
  lineX2 = (el: DesignElement): number => el.x2 ?? el.x + el.width;
  lineY2 = (el: DesignElement): number => el.y2 ?? el.y + el.height;
  lineStroke = (el: DesignElement): string => el.stroke === "transparent" ? el.fill : el.stroke;
  lineStrokeWidth = (el: DesignElement): number => el.strokeWidth || 2;

  elementTransform = (el: DesignElement): string => {
    if (!el.rotation) return "";
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    return `rotate(${el.rotation}, ${cx}, ${cy})`;
  };

  // Handle position helpers
  handleX = (el: DesignElement, pos: string): number => {
    switch (pos) {
      case "left":
        return el.x - 4;
      case "right":
        return el.x + el.width - 4;
      case "center":
        return el.x + el.width / 2 - 4;
      default:
        return el.x;
    }
  };

  handleY = (el: DesignElement, pos: string): number => {
    switch (pos) {
      case "top":
        return el.y - 4;
      case "bottom":
        return el.y + el.height - 4;
      case "middle":
        return el.y + el.height / 2 - 4;
      default:
        return el.y;
    }
  };

  get isDrawingEllipse(): boolean {
    return this.designStore.activeTool === "ellipse";
  }

  get drawPreviewCX(): number {
    const p = this.drawPreview;
    return p ? p.x + p.width / 2 : 0;
  }

  get drawPreviewCY(): number {
    const p = this.drawPreview;
    return p ? p.y + p.height / 2 : 0;
  }

  get drawPreviewRX(): number {
    const p = this.drawPreview;
    return p ? p.width / 2 : 0;
  }

  get drawPreviewRY(): number {
    const p = this.drawPreview;
    return p ? p.height / 2 : 0;
  }

  isFontWeight = (weight: string): boolean => {
    return this.selectedElement?.fontWeight === weight;
  };

  isTextAlign = (align: string): boolean => {
    return this.selectedElement?.textAlign === align;
  };

  isColorActive = (color: string): boolean => {
    return this.currentPickerColor === color;
  };

  swatchStyle = (color: string): string => {
    return `background-color: ${color}`;
  };

  // Actions
  toggleGrid = () => {
    this.designStore.showGrid = !this.designStore.showGrid;
  };

  toggleSnap = () => {
    this.designStore.snapToGrid = !this.designStore.snapToGrid;
  };

  closeColorPicker = () => {
    this.designStore.showColorPicker = false;
  };

  duplicateElement = () => {
    this.designStore.duplicateSelected();
  };

  align = (direction: "left" | "center" | "right" | "top" | "middle" | "bottom") => {
    this.designStore.alignSelected(direction);
  };

  stopPropagation = (e: MouseEvent) => {
    e.stopPropagation();
  };
}
