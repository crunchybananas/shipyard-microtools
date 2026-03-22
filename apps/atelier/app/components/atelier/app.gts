import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import { inject as service } from "@ember/service";
import { modifier } from "ember-modifier";
import type DesignStoreService from "atelier/services/design-store";
import type AiServiceService from "atelier/services/ai-service";
import type CommandPaletteService from "atelier/services/command-palette";
import type { ToolType } from "atelier/services/design-store";
import { IconZoomFit } from "atelier/components/atelier/icons";
import AtelierToolbar from "atelier/components/atelier/toolbar";
import AtelierTopbar from "atelier/components/atelier/topbar";
import AtelierCanvas from "atelier/components/atelier/canvas";
import AtelierPromptBar from "atelier/components/atelier/prompt-bar";
import AtelierLayersPanel from "atelier/components/atelier/layers-panel";
import AtelierPropertiesPanel from "atelier/components/atelier/properties-panel";
import AtelierModals from "atelier/components/atelier/modals";

export default class AtelierApp extends Component {
  @service declare designStore: DesignStoreService;
  @service declare aiService: AiServiceService;
  @service declare commandPalette: CommandPaletteService;

  @tracked toastMessage: string | null = null;

  // Global keyboard handler - set up once on the canvas area
  setupKeyboard = modifier((element: Element) => {
    const handleKeyDown = (e: KeyboardEvent) => this.onKeyDown(e);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  });

  // ---- Tool selection (for keyboard shortcuts) ----

  setTool = (tool: ToolType) => {
    this.designStore.activeTool = tool;
    if (tool !== "select") {
      this.designStore.deselectAll();
    }
  };

  // ---- Keyboard shortcuts ----

  onKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const cmd = e.metaKey || e.ctrlKey;

    if (cmd && e.key === "k") {
      e.preventDefault();
      this.commandPalette.toggle();
      return;
    }

    if (this.commandPalette.isOpen) {
      if (e.key === "Escape") {
        e.preventDefault();
        this.commandPalette.close();
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        this.commandPalette.moveUp();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        this.commandPalette.moveDown();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        this.commandPalette.executeSelected();
        return;
      }
      return;
    }

    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

    if (!cmd && !e.shiftKey) {
      switch (e.key) {
        case "v": case "V": this.setTool("select"); return;
        case "r": case "R": this.setTool("rectangle"); return;
        case "o": case "O": this.setTool("ellipse"); return;
        case "l": case "L": this.setTool("line"); return;
        case "t": case "T": this.setTool("text"); return;
        case "f": case "F": this.setTool("frame"); return;
        case "h": case "H": this.setTool("hand"); return;
        case "p": case "P": this.setTool("pen"); return;
        case "g": case "G":
          this.designStore.showGrid = !this.designStore.showGrid;
          return;
      }
    }

    if (e.key === "Delete" || e.key === "Backspace") {
      if (this.designStore.hasSelection) {
        e.preventDefault();
        this.designStore.deleteSelected();
      }
      return;
    }

    if (cmd) {
      switch (e.key) {
        case "z":
          e.preventDefault();
          if (e.shiftKey) { this.designStore.redo(); } else { this.designStore.undo(); }
          return;
        case "c": e.preventDefault(); this.designStore.copySelected(); this.showToast("Copied to clipboard"); return;
        case "v": e.preventDefault(); this.designStore.paste(); return;
        case "d": e.preventDefault(); this.designStore.duplicateSelected(); return;
        case "a": e.preventDefault(); this.designStore.selectAll(); return;
        case "0": e.preventDefault(); this.designStore.zoomToFit(); return;
        case "=": e.preventDefault(); this.designStore.zoomIn(); return;
        case "-": e.preventDefault(); this.designStore.zoomOut(); return;
      }
    }

    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      if (!this.designStore.hasSelection) return;
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const dx = e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0;
      const dy = e.key === "ArrowDown" ? step : e.key === "ArrowUp" ? -step : 0;
      for (const el of this.designStore.selectedElements) {
        this.designStore.updateElement(el.id, { x: el.x + dx, y: el.y + dy });
      }
    }

    if (e.key === "Escape") {
      if (this.commandPalette.isOpen) { this.commandPalette.close(); return; }
      this.designStore.deselectAll();
      this.designStore.activeTool = "select";
      this.designStore.showAiModal = false;
      this.designStore.showExportModal = false;
      this.designStore.contextMenuPos = null;
      this.designStore.showColorPicker = false;
    }

    if (e.key === " ") {
      e.preventDefault();
      this.setTool("hand");
    }
  };

  // ---- Onboarding ----

  get showOnboarding(): boolean {
    return this.designStore.showOnboarding && this.designStore.elements.length === 0;
  }

  dismissOnboarding = () => {
    this.designStore.showOnboarding = false;
  };

  startWithAi = () => {
    this.designStore.showOnboarding = false;
    this.designStore.showAiModal = true;
  };

  // ---- Export / AI modal openers ----

  openExport = () => {
    this.designStore.showExportModal = true;
  };

  openAiModal = () => {
    this.designStore.showAiModal = true;
  };

  openShareModal = () => {
    this.designStore.showShareModal = true;
  };

  // ---- Toast ----

  showToast = (message: string) => {
    this.toastMessage = message;
    setTimeout(() => {
      this.toastMessage = null;
    }, 2000);
  };

  // ---- Computed ----

  get zoomPercent(): string {
    return `${Math.round(this.designStore.zoom * 100)}%`;
  }

  <template>
    <div class="atelier-app" {{this.setupKeyboard}}>
      <AtelierToolbar />

      <AtelierTopbar
        @onOpenExport={{this.openExport}}
        @onOpenAiModal={{this.openAiModal}}
        @onOpenShareModal={{this.openShareModal}}
      />

      <AtelierLayersPanel />

      <AtelierCanvas
        @showOnboarding={{this.showOnboarding}}
        @onDismissOnboarding={{this.dismissOnboarding}}
        @onStartWithAi={{this.startWithAi}}
      >
        <AtelierPromptBar @showOnboarding={{this.showOnboarding}} />
      </AtelierCanvas>

      <AtelierPropertiesPanel />

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

      <AtelierModals @onShowToast={{this.showToast}} />

      {{! ---- Toast ---- }}
      {{#if this.toastMessage}}
        <div class="toast">{{this.toastMessage}}</div>
      {{/if}}
    </div>
  </template>
}
