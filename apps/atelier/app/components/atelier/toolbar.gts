import Component from "@glimmer/component";
import { on } from "@ember/modifier";
import { fn } from "@ember/helper";
import { inject as service } from "@ember/service";
import type DesignStoreService from "atelier/services/design-store";
import type { ToolType } from "atelier/services/design-store";
import {
  IconCursor,
  IconFrame,
  IconRect,
  IconEllipse,
  IconLine,
  IconText,
  IconPen,
  IconHand,
} from "atelier/components/atelier/icons";

export default class AtelierToolbar extends Component {
  @service declare designStore: DesignStoreService;

  setTool = (tool: ToolType) => {
    this.designStore.activeTool = tool;
    if (tool !== "select") {
      this.designStore.deselectAll();
    }
  };

  isToolActive = (tool: string): boolean => {
    return this.designStore.activeTool === tool;
  };

  <template>
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
  </template>
}
