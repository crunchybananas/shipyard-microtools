import Service, { inject as service } from "@ember/service";
import { tracked } from "@glimmer/tracking";
import type ProjectStoreService from "atelier/services/project-store";
import type AuthService from "atelier/services/auth-service";

export interface Point {
  x: number;
  y: number;
}

export interface DesignElement {
  id: string;
  type: "rectangle" | "ellipse" | "line" | "text" | "frame" | "image";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  cornerRadius: number;
  visible: boolean;
  locked: boolean;
  name: string;
  parentId: string | null;
  // text-specific
  text?: string;
  fontSize?: number;
  fontWeight?: string;
  fontFamily?: string;
  textAlign?: "left" | "center" | "right";
  // line-specific
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  lineType?: "solid" | "dashed" | "arrow" | "arrow-both";
  // image-specific
  imageUrl?: string;
  // shadow
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
}

export type ToolType =
  | "select"
  | "frame"
  | "rectangle"
  | "ellipse"
  | "line"
  | "text"
  | "hand"
  | "pen";

interface HistoryEntry {
  elements: DesignElement[];
  selectedIds: string[];
}

let _idCounter = 0;
function generateId(): string {
  return `el_${Date.now()}_${_idCounter++}`;
}

export default class DesignStoreService extends Service {
  @service declare projectStore: ProjectStoreService;
  @service declare authService: AuthService;

  @tracked elements: DesignElement[] = [];
  @tracked selectedIds: string[] = [];
  @tracked activeTool: ToolType = "select";
  @tracked zoom: number = 1;
  @tracked panX: number = 0;
  @tracked panY: number = 0;
  @tracked showGrid: boolean = true;
  @tracked snapToGrid: boolean = true;
  @tracked gridSize: number = 20;
  @tracked showAiModal: boolean = false;
  @tracked aiGenerating: boolean = false;
  @tracked clipboard: DesignElement[] = [];
  @tracked isDragging: boolean = false;
  @tracked isResizing: boolean = false;
  @tracked isDrawing: boolean = false;
  @tracked showExportModal: boolean = false;
  @tracked showShareModal: boolean = false;
  @tracked fileName: string = "Untitled";
  @tracked showColorPicker: boolean = false;
  @tracked colorPickerTarget: "fill" | "stroke" = "fill";
  @tracked colorPickerAnchorY: number = 200;
  @tracked contextMenuPos: Point | null = null;
  @tracked hoveredElementId: string | null = null;
  @tracked dragStartPoint: Point | null = null;
  @tracked showOnboarding: boolean = true;
  @tracked currentProjectId: string | null = null;

  private history: HistoryEntry[] = [];
  private historyIndex: number = -1;
  private maxHistory = 100;
  private _saveTimer: ReturnType<typeof setTimeout> | null = null;
  private _isSaving = false;

  // --- Auto-save ---

  scheduleSave(): void {
    if (!this.currentProjectId) return;
    if (!this.authService.isAuthenticated) return;

    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
    }
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      void this._performSave();
    }, 1000);
  }

  private async _performSave(): Promise<void> {
    if (this._isSaving) return;
    if (!this.currentProjectId) return;

    this._isSaving = true;
    try {
      await this.projectStore.saveProject(
        this.currentProjectId,
        JSON.parse(JSON.stringify(this.elements)),
      );
    } catch (e) {
      console.error("Auto-save failed:", e);
    } finally {
      this._isSaving = false;
    }
  }

  async loadProject(projectId: string): Promise<void> {
    this.currentProjectId = projectId;
    const elements = await this.projectStore.loadProject(projectId);
    this.elements = elements;
    this.selectedIds = [];
    this.history = [];
    this.historyIndex = -1;
    this.pushHistory();

    const project = this.projectStore.getProject(projectId);
    if (project) {
      this.fileName = project.name;
    }
  }

  unloadProject(): void {
    // Flush any pending save
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
      if (this.currentProjectId && this.authService.isAuthenticated) {
        void this._performSave();
      }
    }
    this.currentProjectId = null;
  }

  get selectedElements(): DesignElement[] {
    return this.elements.filter((el) => this.selectedIds.includes(el.id));
  }

  get hasSelection(): boolean {
    return this.selectedIds.length > 0;
  }

  get singleSelection(): DesignElement | null {
    if (this.selectedIds.length === 1) {
      return this.elements.find((el) => el.id === this.selectedIds[0]) ?? null;
    }
    return null;
  }

  get canUndo(): boolean {
    return this.historyIndex > 0;
  }

  get canRedo(): boolean {
    return this.historyIndex < this.history.length - 1;
  }

  get selectionBounds(): {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null {
    const selected = this.selectedElements;
    if (selected.length === 0) return null;

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const el of selected) {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + el.width);
      maxY = Math.max(maxY, el.y + el.height);
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  pushHistory(): void {
    const entry: HistoryEntry = {
      elements: JSON.parse(JSON.stringify(this.elements)),
      selectedIds: [...this.selectedIds],
    };

    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    this.history.push(entry);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
    this.historyIndex = this.history.length - 1;
  }

  undo(): void {
    if (!this.canUndo) return;
    this.historyIndex--;
    const entry = this.history[this.historyIndex]!;
    this.elements = JSON.parse(JSON.stringify(entry.elements));
    this.selectedIds = [...entry.selectedIds];
    this.scheduleSave();
  }

  redo(): void {
    if (!this.canRedo) return;
    this.historyIndex++;
    const entry = this.history[this.historyIndex]!;
    this.elements = JSON.parse(JSON.stringify(entry.elements));
    this.selectedIds = [...entry.selectedIds];
    this.scheduleSave();
  }

  createElement(
    type: DesignElement["type"],
    overrides: Partial<DesignElement> = {},
  ): DesignElement {
    const id = generateId();
    const names: Record<string, string> = {
      rectangle: "Rectangle",
      ellipse: "Ellipse",
      line: "Line",
      text: "Text",
      frame: "Frame",
      image: "Image",
    };
    const count = this.elements.filter((el) => el.type === type).length + 1;

    const lineDefaults = type === "line"
      ? {
          x1: overrides.x1 ?? 100,
          y1: overrides.y1 ?? 100,
          x2: overrides.x2 ?? 300,
          y2: overrides.y2 ?? 100,
          lineType: overrides.lineType ?? ("solid" as const),
        }
      : {};

    // For lines, derive bounding box from endpoints
    const lineX1 = lineDefaults.x1 ?? 100;
    const lineY1 = lineDefaults.y1 ?? 100;
    const lineX2 = lineDefaults.x2 ?? 300;
    const lineY2 = lineDefaults.y2 ?? 100;

    const element: DesignElement = {
      id,
      type,
      x: type === "line" ? Math.min(lineX1, lineX2) : 100,
      y: type === "line" ? Math.min(lineY1, lineY2) : 100,
      width: type === "line" ? Math.abs(lineX2 - lineX1) || 1 : 200,
      height: type === "line" ? Math.abs(lineY2 - lineY1) || 1 : 150,
      rotation: 0,
      fill: type === "frame" ? "#ffffff" : type === "text" ? "#e4e4e7" : "#818cf8",
      stroke: type === "frame" ? "#e4e4e7" : type === "line" ? "#818cf8" : "transparent",
      strokeWidth: type === "frame" ? 1 : type === "line" ? 2 : 0,
      opacity: 1,
      cornerRadius: 0,
      visible: true,
      locked: false,
      name: `${names[type] || "Element"} ${count}`,
      parentId: null,
      ...(type === "text"
        ? {
            text: "Type something",
            fontSize: 24,
            fontWeight: "400",
            fontFamily: "Inter, system-ui, sans-serif",
            textAlign: "left" as const,
          }
        : {}),
      ...lineDefaults,
      ...overrides,
      // Re-derive bounding box after overrides for lines
      ...(type === "line"
        ? {
            x: Math.min(overrides.x1 ?? lineX1, overrides.x2 ?? lineX2),
            y: Math.min(overrides.y1 ?? lineY1, overrides.y2 ?? lineY2),
            width: Math.abs((overrides.x2 ?? lineX2) - (overrides.x1 ?? lineX1)) || 1,
            height: Math.abs((overrides.y2 ?? lineY2) - (overrides.y1 ?? lineY1)) || 1,
          }
        : {}),
    };

    this.elements = [...this.elements, element];
    this.scheduleSave();
    return element;
  }

  addElement(element: DesignElement): void {
    this.elements = [...this.elements, element];
    this.scheduleSave();
  }

  updateElement(id: string, updates: Partial<DesignElement>): void {
    this.elements = this.elements.map((el) => {
      if (el.id !== id) return el;
      const updated = { ...el, ...updates };
      // Re-derive bounding box for lines when endpoints change
      if (updated.type === "line" && updated.x1 != null && updated.y1 != null && updated.x2 != null && updated.y2 != null) {
        updated.x = Math.min(updated.x1, updated.x2);
        updated.y = Math.min(updated.y1, updated.y2);
        updated.width = Math.abs(updated.x2 - updated.x1) || 1;
        updated.height = Math.abs(updated.y2 - updated.y1) || 1;
      }
      return updated;
    });
    this.scheduleSave();
  }

  deleteSelected(): void {
    if (!this.hasSelection) return;
    this.pushHistory();
    this.elements = this.elements.filter(
      (el) => !this.selectedIds.includes(el.id),
    );
    this.selectedIds = [];
    this.scheduleSave();
  }

  selectElement(id: string, addToSelection: boolean = false): void {
    if (addToSelection) {
      if (this.selectedIds.includes(id)) {
        this.selectedIds = this.selectedIds.filter((sid) => sid !== id);
      } else {
        this.selectedIds = [...this.selectedIds, id];
      }
    } else {
      this.selectedIds = [id];
    }
  }

  selectAll(): void {
    this.selectedIds = this.elements.map((el) => el.id);
  }

  deselectAll(): void {
    this.selectedIds = [];
  }

  selectInRect(
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    const rx = Math.min(x, x + width);
    const ry = Math.min(y, y + height);
    const rw = Math.abs(width);
    const rh = Math.abs(height);

    this.selectedIds = this.elements
      .filter((el) => {
        return (
          el.x < rx + rw &&
          el.x + el.width > rx &&
          el.y < ry + rh &&
          el.y + el.height > ry
        );
      })
      .map((el) => el.id);
  }

  copySelected(): void {
    this.clipboard = JSON.parse(JSON.stringify(this.selectedElements));
  }

  paste(): void {
    if (this.clipboard.length === 0) return;
    this.pushHistory();
    const newIds: string[] = [];
    const pasted = this.clipboard.map((el) => {
      const newId = generateId();
      newIds.push(newId);
      const pasted: DesignElement = { ...el, id: newId, x: el.x + 20, y: el.y + 20 };
      if (pasted.type === "line") {
        if (pasted.x1 != null) pasted.x1 += 20;
        if (pasted.y1 != null) pasted.y1 += 20;
        if (pasted.x2 != null) pasted.x2 += 20;
        if (pasted.y2 != null) pasted.y2 += 20;
      }
      return pasted;
    });
    this.elements = [...this.elements, ...pasted];
    this.selectedIds = newIds;
    this.clipboard = JSON.parse(JSON.stringify(pasted));
    this.scheduleSave();
  }

  duplicateSelected(): void {
    this.copySelected();
    this.paste();
  }

  bringToFront(): void {
    if (!this.hasSelection) return;
    this.pushHistory();
    const selected = this.elements.filter((el) =>
      this.selectedIds.includes(el.id),
    );
    const rest = this.elements.filter(
      (el) => !this.selectedIds.includes(el.id),
    );
    this.elements = [...rest, ...selected];
    this.scheduleSave();
  }

  sendToBack(): void {
    if (!this.hasSelection) return;
    this.pushHistory();
    const selected = this.elements.filter((el) =>
      this.selectedIds.includes(el.id),
    );
    const rest = this.elements.filter(
      (el) => !this.selectedIds.includes(el.id),
    );
    this.elements = [...selected, ...rest];
    this.scheduleSave();
  }

  moveUp(id: string): void {
    const idx = this.elements.findIndex((el) => el.id === id);
    if (idx < this.elements.length - 1) {
      this.pushHistory();
      const newElements = [...this.elements];
      [newElements[idx], newElements[idx + 1]] = [
        newElements[idx + 1]!,
        newElements[idx]!,
      ];
      this.elements = newElements;
      this.scheduleSave();
    }
  }

  moveDown(id: string): void {
    const idx = this.elements.findIndex((el) => el.id === id);
    if (idx > 0) {
      this.pushHistory();
      const newElements = [...this.elements];
      [newElements[idx], newElements[idx - 1]] = [
        newElements[idx - 1]!,
        newElements[idx]!,
      ];
      this.elements = newElements;
      this.scheduleSave();
    }
  }

  alignSelected(
    alignment: "left" | "center" | "right" | "top" | "middle" | "bottom",
  ): void {
    const bounds = this.selectionBounds;
    if (!bounds || this.selectedElements.length < 2) return;
    this.pushHistory();

    this.elements = this.elements.map((el) => {
      if (!this.selectedIds.includes(el.id)) return el;
      switch (alignment) {
        case "left":
          return { ...el, x: bounds.x };
        case "center":
          return { ...el, x: bounds.x + bounds.width / 2 - el.width / 2 };
        case "right":
          return { ...el, x: bounds.x + bounds.width - el.width };
        case "top":
          return { ...el, y: bounds.y };
        case "middle":
          return { ...el, y: bounds.y + bounds.height / 2 - el.height / 2 };
        case "bottom":
          return { ...el, y: bounds.y + bounds.height - el.height };
        default:
          return el;
      }
    });
    this.scheduleSave();
  }

  distributeSelected(direction: "horizontal" | "vertical"): void {
    if (this.selectedElements.length < 3) return;
    this.pushHistory();

    const sorted = [...this.selectedElements].sort((a, b) =>
      direction === "horizontal" ? a.x - b.x : a.y - b.y,
    );

    const first = sorted[0]!;
    const last = sorted[sorted.length - 1]!;

    if (direction === "horizontal") {
      const totalSpace =
        last.x + last.width - first.x -
        sorted.reduce((sum, el) => sum + el.width, 0);
      const gap = totalSpace / (sorted.length - 1);
      let currentX = first.x + first.width + gap;

      for (let i = 1; i < sorted.length - 1; i++) {
        this.updateElement(sorted[i]!.id, { x: currentX });
        currentX += sorted[i]!.width + gap;
      }
    } else {
      const totalSpace =
        last.y + last.height - first.y -
        sorted.reduce((sum, el) => sum + el.height, 0);
      const gap = totalSpace / (sorted.length - 1);
      let currentY = first.y + first.height + gap;

      for (let i = 1; i < sorted.length - 1; i++) {
        this.updateElement(sorted[i]!.id, { y: currentY });
        currentY += sorted[i]!.height + gap;
      }
    }
    this.scheduleSave();
  }

  snapValue(value: number): number {
    if (!this.snapToGrid) return value;
    return Math.round(value / this.gridSize) * this.gridSize;
  }

  zoomIn(): void {
    this.zoom = Math.min(this.zoom * 1.2, 10);
  }

  zoomOut(): void {
    this.zoom = Math.max(this.zoom / 1.2, 0.1);
  }

  zoomToFit(): void {
    if (this.elements.length === 0) {
      this.zoom = 1;
      this.panX = 0;
      this.panY = 0;
      return;
    }

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const el of this.elements) {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + el.width);
      maxY = Math.max(maxY, el.y + el.height);
    }

    const contentWidth = maxX - minX + 100;
    const contentHeight = maxY - minY + 100;
    const viewportWidth = window.innerWidth - 560;
    const viewportHeight = window.innerHeight - 48;

    this.zoom = Math.min(
      viewportWidth / contentWidth,
      viewportHeight / contentHeight,
      2,
    );
    this.panX = -(minX - 50) * this.zoom + (viewportWidth - contentWidth * this.zoom) / 2;
    this.panY = -(minY - 50) * this.zoom + (viewportHeight - contentHeight * this.zoom) / 2;
  }

  exportSVG(): string {
    let minX = 0,
      minY = 0,
      maxX = 800,
      maxY = 600;
    if (this.elements.length > 0) {
      minX = Math.min(...this.elements.map((el) => el.x)) - 20;
      minY = Math.min(...this.elements.map((el) => el.y)) - 20;
      maxX = Math.max(...this.elements.map((el) => el.x + el.width)) + 20;
      maxY = Math.max(...this.elements.map((el) => el.y + el.height)) + 20;
    }

    const width = maxX - minX;
    const height = maxY - minY;

    const hasArrows = this.elements.some((el) => el.type === "line" && (el.lineType === "arrow" || el.lineType === "arrow-both"));

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" width="${width}" height="${height}">\n`;

    if (hasArrows) {
      svg += `  <defs>\n`;
      svg += `    <marker id="arrowhead-export" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto" markerUnits="strokeWidth">\n`;
      svg += `      <polygon points="0 0, 10 3.5, 0 7" fill="context-stroke" />\n`;
      svg += `    </marker>\n`;
      svg += `    <marker id="arrowhead-start-export" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto" markerUnits="strokeWidth">\n`;
      svg += `      <polygon points="10 0, 0 3.5, 10 7" fill="context-stroke" />\n`;
      svg += `    </marker>\n`;
      svg += `  </defs>\n`;
    }

    for (const el of this.elements) {
      if (!el.visible) continue;
      const style = `fill:${el.fill};stroke:${el.stroke};stroke-width:${el.strokeWidth};opacity:${el.opacity}`;

      switch (el.type) {
        case "rectangle":
        case "frame":
          svg += `  <rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" rx="${el.cornerRadius}" style="${style}" />\n`;
          break;
        case "ellipse":
          svg += `  <ellipse cx="${el.x + el.width / 2}" cy="${el.y + el.height / 2}" rx="${el.width / 2}" ry="${el.height / 2}" style="${style}" />\n`;
          break;
        case "text":
          svg += `  <text x="${el.x}" y="${el.y + (el.fontSize || 24)}" font-size="${el.fontSize}" font-family="${el.fontFamily}" font-weight="${el.fontWeight}" fill="${el.fill}" opacity="${el.opacity}">${el.text}</text>\n`;
          break;
        case "line": {
          const lx1 = el.x1 ?? el.x;
          const ly1 = el.y1 ?? el.y;
          const lx2 = el.x2 ?? el.x + el.width;
          const ly2 = el.y2 ?? el.y + el.height;
          const lineColor = el.stroke !== "transparent" ? el.stroke : el.fill;
          const sw = el.strokeWidth || 2;
          const dash = el.lineType === "dashed" ? ` stroke-dasharray="8 4"` : "";
          let markers = "";
          if (el.lineType === "arrow") {
            markers = ` marker-end="url(#arrowhead-export)"`;
          } else if (el.lineType === "arrow-both") {
            markers = ` marker-start="url(#arrowhead-start-export)" marker-end="url(#arrowhead-export)"`;
          }
          svg += `  <line x1="${lx1}" y1="${ly1}" x2="${lx2}" y2="${ly2}" stroke="${lineColor}" stroke-width="${sw}" opacity="${el.opacity}"${dash}${markers} />\n`;
          break;
        }
      }
    }

    svg += "</svg>";
    return svg;
  }

  clearCanvas(): void {
    this.pushHistory();
    this.elements = [];
    this.selectedIds = [];
    this.scheduleSave();
  }

  groupSelected(): void {
    if (this.selectedElements.length < 2) return;
    const bounds = this.selectionBounds;
    if (!bounds) return;

    this.pushHistory();
    const frame = this.createElement("frame", {
      x: bounds.x - 10,
      y: bounds.y - 10,
      width: bounds.width + 20,
      height: bounds.height + 20,
      name: `Group ${this.elements.filter((el) => el.type === "frame").length}`,
    });

    this.elements = this.elements.map((el) =>
      this.selectedIds.includes(el.id) && el.id !== frame.id
        ? { ...el, parentId: frame.id }
        : el,
    );

    this.selectedIds = [frame.id];
    this.scheduleSave();
  }
}
