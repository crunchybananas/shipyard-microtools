import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import { fn } from "@ember/helper";
import { inject as service } from "@ember/service";
import { modifier } from "ember-modifier";
import type DesignStoreService from "atelier/services/design-store";
import type { DesignElement, ToolType, Point } from "atelier/services/design-store";
import {
  IconRect,
  IconEllipse,
  IconText,
  IconLine,
  IconFrame,
  IconSparkles,
} from "atelier/components/atelier/icons";

export interface CanvasSignature {
  Args: {
    showOnboarding: boolean;
    onDismissOnboarding: () => void;
    onStartWithAi: () => void;
  };
  Blocks: {
    default: [];
  };
}

export default class AtelierCanvas extends Component<CanvasSignature> {
  @service declare designStore: DesignStoreService;

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
  @tracked editingTextId: string | null = null;

  private canvasEl: SVGSVGElement | null = null;

  setupCanvas = modifier((element: Element) => {
    this.canvasEl = element as unknown as SVGSVGElement;
    this.designStore.pushHistory();

    const handleWheel = (e: WheelEvent) => this.onWheel(e);
    element.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
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

  // ---- Canvas mouse events ----

  onCanvasMouseDown = (e: MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && this.designStore.activeTool === "hand")) {
      this.isPanning = true;
      this.panStart = { x: e.clientX, y: e.clientY };
      this.panStartOffset = { x: this.designStore.panX, y: this.designStore.panY };
      e.preventDefault();
      return;
    }

    this.designStore.contextMenuPos = null;

    const pt = this.screenToCanvas(e.clientX, e.clientY);
    const tool = this.designStore.activeTool;

    if (this.editingTextId) {
      const hit = this.hitTest(pt);
      if (!hit || hit.id !== this.editingTextId) {
        this.finishTextEdit();
      } else {
        return;
      }
    }

    if (tool === "select") {
      const hitElement = this.hitTest(pt);
      if (hitElement) {
        if (hitElement.locked) return;
        if (e.shiftKey) {
          this.designStore.selectElement(hitElement.id, true);
        } else if (!this.designStore.selectedIds.includes(hitElement.id)) {
          this.designStore.selectElement(hitElement.id);
        }
        this.designStore.isDragging = true;
        this.designStore.dragStartPoint = pt;
        this.dragOffset = this.designStore.selectedElements.map((el) => ({
          dx: el.x - pt.x,
          dy: el.y - pt.y,
        }));
      } else {
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
      this.designStore.panX = this.panStartOffset.x + (e.clientX - this.panStart.x);
      this.designStore.panY = this.panStartOffset.y + (e.clientY - this.panStart.y);
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

    if (this.designStore.activeTool === "select") {
      const hit = this.hitTest(pt);
      this.designStore.hoveredElementId = hit?.id ?? null;
    }
  };

  onCanvasMouseUp = (_e: MouseEvent) => {
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

  // ---- Inline text editing on canvas ----

  onCanvasDoubleClick = (e: MouseEvent) => {
    this.designStore.isDragging = false;
    this.designStore.dragStartPoint = null;

    const pt = this.screenToCanvas(e.clientX, e.clientY);
    const hit = this.hitTest(pt);
    if (hit && hit.type === "text" && !hit.locked) {
      this.editingTextId = hit.id;
      this.designStore.selectElement(hit.id);
      setTimeout(() => {
        const input = document.querySelector('.canvas-text-input') as HTMLInputElement;
        if (input) {
          input.focus();
          input.select();
        }
      }, 50);
      e.preventDefault();
      e.stopPropagation();
    }
  };

  isEditingText = (id: string): boolean => {
    return this.editingTextId === id;
  };

  onCanvasTextBlur = (id: string, e: Event) => {
    const value = (e.target as HTMLInputElement).value;
    if (this.editingTextId === id) {
      this.designStore.pushHistory();
      this.designStore.updateElement(id, { text: value });
      this.editingTextId = null;
    }
  };

  onCanvasTextKeydown = (id: string, e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const value = (e.target as HTMLInputElement).value;
      this.designStore.pushHistory();
      this.designStore.updateElement(id, { text: value });
      this.editingTextId = null;
    } else if (e.key === "Escape") {
      e.preventDefault();
      this.editingTextId = null;
    }
    e.stopPropagation();
  };

  finishTextEdit = () => {
    if (this.editingTextId) {
      const input = document.querySelector('.canvas-text-input') as HTMLInputElement;
      const id = this.editingTextId;
      if (input) {
        this.designStore.updateElement(id, { text: input.value });
      }
      this.designStore.pushHistory();
      // Schedule after render to avoid Glimmer auto-tracking assertion
      Promise.resolve().then(() => {
        this.editingTextId = null;
      });
    }
  };

  textEditWidth = (el: DesignElement): number => {
    return Math.max(el.width, 100);
  };

  textEditHeight = (el: DesignElement): number => {
    return Math.max(el.height, (el.fontSize || 24) + 12);
  };

  textEditStyle = (el: DesignElement): string => {
    return `width:100%;height:100%;border:none;outline:2px solid #818cf8;background:rgba(0,0,0,0.3);color:${el.fill};font-size:${el.fontSize || 24}px;font-weight:${el.fontWeight || '400'};font-family:${el.fontFamily || 'Inter, system-ui, sans-serif'};padding:2px 4px;border-radius:4px;box-sizing:border-box;`;
  };

  // ---- Hit testing ----

  hitTest(pt: Point): DesignElement | null {
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

  // ---- Wheel zoom/pan ----

  onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.1, Math.min(10, this.designStore.zoom * delta));

      if (this.canvasEl) {
        const rect = this.canvasEl.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        this.designStore.panX = mx - (mx - this.designStore.panX) * (newZoom / this.designStore.zoom);
        this.designStore.panY = my - (my - this.designStore.panY) * (newZoom / this.designStore.zoom);
      }
      this.designStore.zoom = newZoom;
    } else {
      this.designStore.panX -= e.deltaX;
      this.designStore.panY -= e.deltaY;
    }
  };

  // ---- Computed ----

  get canvasClass(): string {
    const tool = this.designStore.activeTool;
    let cls = "canvas-area";
    cls += ` tool-${tool}`;
    if (this.isPanning) cls += " panning";
    return cls;
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

  get selectedElement(): DesignElement | null {
    return this.designStore.singleSelection;
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

  // SVG element helpers
  isType = (el: DesignElement, type: string): boolean => {
    return el.type === type;
  };

  isSelected = (id: string): boolean => {
    return this.designStore.selectedIds.includes(id);
  };

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

  <template>
    <div class={{this.canvasClass}}>
      {{! Onboarding }}
      {{#if @showOnboarding}}
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
              <button class="onboarding-btn" type="button" {{on "click" @onDismissOnboarding}}>
                Start from Scratch
              </button>
              <button class="onboarding-btn primary" type="button" {{on "click" @onStartWithAi}}>
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
        {{on "dblclick" this.onCanvasDoubleClick}}
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
                {{#if (this.isEditingText el.id)}}
                  <foreignObject
                    x={{el.x}}
                    y={{el.y}}
                    width={{this.textEditWidth el}}
                    height={{this.textEditHeight el}}
                  >
                    <input
                      xmlns="http://www.w3.org/1999/xhtml"
                      class="canvas-text-input"
                      type="text"
                      value={{el.text}}
                      style={{this.textEditStyle el}}
                      {{on "blur" (fn this.onCanvasTextBlur el.id)}}
                      {{on "keydown" (fn this.onCanvasTextKeydown el.id)}}
                    />
                  </foreignObject>
                {{else}}
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
                {{/if}}
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

      {{! Prompt bar and generating overlay are yielded from the parent }}
      {{yield}}
    </div>
  </template>
}
