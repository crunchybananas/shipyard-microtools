import Component from "@glimmer/component";
import { on } from "@ember/modifier";
import { fn } from "@ember/helper";
import { inject as service } from "@ember/service";
import type DesignStoreService from "atelier/services/design-store";
import type { DesignElement } from "atelier/services/design-store";
import {
  IconCursor,
  IconCopy,
  IconTrash,
  IconChevronUp,
  IconChevronDown,
  IconAlignLeft,
  IconAlignCenter,
  IconAlignRight,
  IconAlignTop,
  IconAlignMiddle,
  IconAlignBottom,
} from "atelier/components/atelier/icons";

export default class AtelierPropertiesPanel extends Component {
  @service declare designStore: DesignStoreService;

  get selectedElement(): DesignElement | null {
    return this.designStore.singleSelection;
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

  // ---- Properties ----

  get isLine(): boolean {
    return this.selectedElement?.type === "line";
  }

  get isNotLine(): boolean {
    return this.selectedElement?.type !== "line";
  }

  isLineType = (type: string): boolean => {
    return (this.selectedElement?.lineType || "solid") === type;
  };

  updateProp = (prop: string, e: Event) => {
    const el = this.designStore.singleSelection;
    if (!el) return;
    const target = e.target as HTMLInputElement;
    let value: string | number = target.value;

    if (["x", "y", "width", "height", "cornerRadius", "strokeWidth", "fontSize", "rotation", "x1", "y1", "x2", "y2"].includes(prop)) {
      value = parseFloat(value) || 0;
    }
    if (prop === "opacity") {
      value = parseFloat(value) || 0;
    }

    this.designStore.pushHistory();
    this.designStore.updateElement(el.id, { [prop]: value });
  };

  // ---- Color picker ----

  openColorPicker = (target: "fill" | "stroke", e?: MouseEvent) => {
    const sameTarget = this.designStore.colorPickerTarget === target;
    if (this.designStore.showColorPicker && sameTarget) {
      this.designStore.showColorPicker = false;
    } else {
      this.designStore.colorPickerTarget = target;
      this.designStore.showColorPicker = true;
      if (e) {
        const btn = (e.currentTarget as HTMLElement);
        const rect = btn.getBoundingClientRect();
        this.designStore.colorPickerAnchorY = rect.top;
      }
    }
  };

  // ---- Actions ----

  duplicateElement = () => {
    this.designStore.duplicateSelected();
  };

  align = (direction: "left" | "center" | "right" | "top" | "middle" | "bottom") => {
    this.designStore.alignSelected(direction);
  };

  // ---- Helpers ----

  isType = (el: DesignElement, type: string): boolean => {
    return el.type === type;
  };

  isFontWeight = (weight: string): boolean => {
    return this.selectedElement?.fontWeight === weight;
  };

  isTextAlign = (align: string): boolean => {
    return this.selectedElement?.textAlign === align;
  };

  <template>
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
          {{#if this.isNotLine}}
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
          {{/if}}
        </div>

        {{! Line properties }}
        {{#if this.isLine}}
          <div class="props-section">
            <div class="props-section-title">Line</div>
            <div class="props-row">
              <span class="props-label">Type</span>
              <select
                class="props-select"
                {{on "change" (fn this.updateProp "lineType")}}
              >
                <option value="solid" selected={{this.isLineType "solid"}}>Solid</option>
                <option value="dashed" selected={{this.isLineType "dashed"}}>Dashed</option>
                <option value="arrow" selected={{this.isLineType "arrow"}}>Arrow</option>
                <option value="arrow-both" selected={{this.isLineType "arrow-both"}}>Double Arrow</option>
              </select>
            </div>
            <div class="props-row">
              <span class="props-label">X1</span>
              <input
                class="props-input"
                type="number"
                value={{this.selectedElement.x1}}
                {{on "change" (fn this.updateProp "x1")}}
              />
              <span class="props-label">Y1</span>
              <input
                class="props-input"
                type="number"
                value={{this.selectedElement.y1}}
                {{on "change" (fn this.updateProp "y1")}}
              />
            </div>
            <div class="props-row">
              <span class="props-label">X2</span>
              <input
                class="props-input"
                type="number"
                value={{this.selectedElement.x2}}
                {{on "change" (fn this.updateProp "x2")}}
              />
              <span class="props-label">Y2</span>
              <input
                class="props-input"
                type="number"
                value={{this.selectedElement.y2}}
                {{on "change" (fn this.updateProp "y2")}}
              />
            </div>
          </div>
        {{/if}}

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
  </template>
}
