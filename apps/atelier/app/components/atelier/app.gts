import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import { fn } from "@ember/helper";
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
import { generateHTML } from "atelier/utils/export-html";
import { analyzeEmberApp } from "atelier/utils/import-ember-app";
import type { EmberAppInfo } from "atelier/utils/import-ember-app";

export default class AtelierApp extends Component {
  @service declare designStore: DesignStoreService;
  @service declare aiService: AiServiceService;
  @service declare commandPalette: CommandPaletteService;

  @tracked toastMessage: string | null = null;
  @tracked conversationMode: boolean = false;
  @tracked convPreviewMode: "canvas" | "html" = "canvas";
  @tracked showShortcutsOverlay: boolean = false;
  @tracked importedAppInfo: EmberAppInfo | null = null;
  @tracked showImportPanel: boolean = false;

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

    if (e.key === "?" && e.shiftKey) {
      this.showShortcutsOverlay = !this.showShortcutsOverlay;
      return;
    }

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
        case "j": e.preventDefault(); this.toggleConversationMode(); return;
        case "e":
          if (e.shiftKey) {
            e.preventDefault();
            this.aiService.extractComponents();
          }
          return;
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
      if (this.aiService.showComponentPanel) { this.aiService.closeComponentPanel(); return; }
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
    this.designStore.exportFormat = "svg";
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

  toggleGrid = () => {
    this.designStore.showGrid = !this.designStore.showGrid;
  };

  toggleSnap = () => {
    this.designStore.snapToGrid = !this.designStore.snapToGrid;
  };

  toggleCanvas2D = () => {
    this.designStore.useCanvas2D = !this.designStore.useCanvas2D;
  };

  toggleConversationMode = () => {
    this.conversationMode = !this.conversationMode;
  };

  highlightComponent = (suggestion: import("atelier/services/ai-service").ComponentSuggestion) => {
    this.aiService.highlightComponent(suggestion);
  };

  closeComponentPanel = () => {
    this.aiService.closeComponentPanel();
  };

  setConvPreview = (mode: "canvas" | "html") => {
    this.convPreviewMode = mode;
  };

  get liveHtmlPreview(): string {
    return generateHTML(this.designStore.elements, this.designStore.fileName);
  }

  isCanvasPreview = (): boolean => {
    return this.convPreviewMode === "canvas";
  };

  isHtmlPreview = (): boolean => {
    return this.convPreviewMode === "html";
  };

  closeShortcuts = () => {
    this.showShortcutsOverlay = false;
  };

  importApp = async () => {
    // Open file picker for .json files (package.json from project dir)
    // In a real implementation, this would accept a zip or folder
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.multiple = true;
    input.webkitdirectory = true;

    input.onchange = async () => {
      if (!input.files?.length) return;

      const files: Record<string, string> = {};
      for (const file of Array.from(input.files)) {
        // webkitRelativePath gives us the relative path within the directory
        const path = file.webkitRelativePath.split("/").slice(1).join("/");
        if (path && (path.endsWith(".ts") || path.endsWith(".js") || path.endsWith(".gts") || path.endsWith(".gjs") || path.endsWith(".hbs") || path.endsWith(".json") || path.endsWith(".css"))) {
          try {
            const content = await file.text();
            files[path] = content;
          } catch {
            // Skip unreadable files
          }
        }
      }

      if (Object.keys(files).length === 0) {
        this.showToast("No Ember project files found");
        return;
      }

      this.importedAppInfo = analyzeEmberApp(files);
      this.showImportPanel = true;
      this.showToast(`Analyzed ${this.importedAppInfo.name} — ${this.importedAppInfo.issues.length} issues found`);
    };

    input.click();
  };

  closeImportPanel = () => {
    this.showImportPanel = false;
  };

  stopPropagation = (e: MouseEvent) => {
    e.stopPropagation();
  };

  <template>
    <div class="atelier-app {{if this.conversationMode 'conversation-mode'}}" {{this.setupKeyboard}}>
      {{#unless this.conversationMode}}
        <AtelierToolbar />
      {{/unless}}

      <AtelierTopbar
        @onOpenExport={{this.openExport}}
        @onOpenAiModal={{this.openAiModal}}
        @onOpenShareModal={{this.openShareModal}}
        @onToggleConversationMode={{this.toggleConversationMode}}
        @onImportApp={{this.importApp}}
        @conversationMode={{this.conversationMode}}
      />

      {{#if this.conversationMode}}
        {{! ---- Conversation Mode: AI chat primary, canvas as preview ---- }}
        <div class="conv-layout">
          <div class="conv-chat-panel">
            <div class="conv-chat-header">
              <span class="conv-chat-title">Design with AI</span>
              <span class="conv-chat-subtitle">Describe what you want — Atelier builds it</span>
            </div>
            <div class="conv-chat-history">
              {{#each this.aiService.conversationHistory as |msg|}}
                <div class="conv-msg conv-msg-{{msg.role}}">
                  <div class="conv-msg-bubble">{{msg.content}}</div>
                </div>
              {{/each}}
              {{#if this.designStore.aiGenerating}}
                <div class="conv-msg conv-msg-assistant">
                  <div class="conv-msg-bubble conv-msg-thinking">
                    <div class="conv-thinking-dots"><span></span><span></span><span></span></div>
                  </div>
                </div>
              {{/if}}
            </div>
            <AtelierPromptBar @showOnboarding={{false}} />
          </div>
          <div class="conv-preview-panel">
            <div class="conv-preview-header">
              <span class="conv-preview-label">LIVE PREVIEW</span>
              <span class="conv-preview-count">{{this.designStore.elements.length}} elements</span>
              <div class="conv-preview-tabs">
                <button
                  class="conv-preview-tab {{if (this.isCanvasPreview) 'active'}}"
                  type="button"
                  {{on "click" (fn this.setConvPreview "canvas")}}
                >Canvas</button>
                <button
                  class="conv-preview-tab {{if (this.isHtmlPreview) 'active'}}"
                  type="button"
                  {{on "click" (fn this.setConvPreview "html")}}
                >HTML</button>
              </div>
            </div>
            {{#if (this.isHtmlPreview)}}
              <iframe
                class="conv-html-preview"
                srcdoc={{this.liveHtmlPreview}}
                sandbox="allow-scripts"
                title="Live HTML preview"
              ></iframe>
            {{else}}
              <AtelierCanvas
                @showOnboarding={{false}}
                @onDismissOnboarding={{this.dismissOnboarding}}
                @onStartWithAi={{this.startWithAi}}
              />
            {{/if}}
          </div>
        </div>
      {{else}}
        {{! ---- Standard Mode: full canvas with panels ---- }}
        <AtelierLayersPanel />

        <AtelierCanvas
          @showOnboarding={{this.showOnboarding}}
          @onDismissOnboarding={{this.dismissOnboarding}}
          @onStartWithAi={{this.startWithAi}}
        >
          <AtelierPromptBar @showOnboarding={{this.showOnboarding}} />
        </AtelierCanvas>

        <AtelierPropertiesPanel />

        {{! ---- Component Extraction Panel ---- }}
        {{#if this.aiService.showComponentPanel}}
          <div class="component-panel">
            <div class="component-panel-header">
              <div class="component-panel-title-row">
                <span class="component-panel-title">Components</span>
                <span class="component-panel-count">{{this.aiService.componentSuggestions.length}} found</span>
              </div>
              <button class="component-panel-close" type="button" {{on "click" this.closeComponentPanel}}>
                &times;
              </button>
            </div>
            {{#if this.aiService.componentSuggestions.length}}
              <div class="component-panel-list">
                {{#each this.aiService.componentSuggestions as |suggestion|}}
                  <div class="component-card" role="button" {{on "click" (fn this.highlightComponent suggestion)}}>
                    <div class="component-card-header">
                      <span class="component-card-name">{{suggestion.name}}</span>
                      {{#if suggestion.isRepeated}}
                        <span class="component-card-badge">{{suggestion.instanceCount}}x</span>
                      {{/if}}
                    </div>
                    <div class="component-card-desc">{{suggestion.description}}</div>
                    <div class="component-card-meta">
                      <span class="component-card-file">{{suggestion.kebabName}}.gts</span>
                      <span class="component-card-els">{{suggestion.elementIds.length}} elements</span>
                    </div>
                    {{#if suggestion.props.length}}
                      <div class="component-card-props">
                        {{#each suggestion.props as |prop|}}
                          <span class="component-card-prop">@{{prop}}</span>
                        {{/each}}
                      </div>
                    {{/if}}
                  </div>
                {{/each}}
              </div>
            {{else}}
              <div class="component-panel-empty">
                <span class="component-panel-empty-icon">&#9881;</span>
                <p>No components detected.</p>
                <p class="component-panel-empty-hint">Add more elements or use frames to group related elements into components.</p>
              </div>
            {{/if}}
          </div>
        {{/if}}
      {{/if}}

      {{! ---- Status Bar ---- }}
      <div class="status-bar">
        <div class="status-left">
          <span class="status-item status-elements">
            <span class="status-dot"></span>
            {{this.designStore.elements.length}} elements
          </span>
          {{#if this.designStore.hasSelection}}
            <span class="status-divider"></span>
            <span class="status-item status-selection">{{this.designStore.selectedIds.length}} selected</span>
          {{/if}}
          <span class="status-divider"></span>
          <span class="status-item status-toggle {{if this.designStore.showGrid 'active'}}" role="button" {{on "click" this.toggleGrid}}>
            Grid
          </span>
          <span class="status-item status-toggle {{if this.designStore.snapToGrid 'active'}}" role="button" {{on "click" this.toggleSnap}}>
            Snap
          </span>
          <span class="status-item status-toggle {{if this.designStore.useCanvas2D 'active'}}" role="button" {{on "click" this.toggleCanvas2D}}>
            Canvas2D
          </span>
          {{#if this.aiService.estimatedCost}}
            <span class="status-divider"></span>
            <span class="status-item status-cost">
              Last gen: {{this.aiService.estimatedCost}}
            </span>
          {{/if}}
        </div>
        <div class="status-right">
          <span class="status-item status-shortcut">
            <kbd>Cmd+J</kbd> Chat
          </span>
          <span class="status-item status-shortcut">
            <kbd>Cmd+K</kbd> Commands
          </span>
          <span class="status-item status-shortcut">
            <kbd>Cmd+Shift+E</kbd> Extract
          </span>
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

      {{! ---- Import Analysis Panel ---- }}
      {{#if this.showImportPanel}}
        <div class="shortcuts-overlay" role="button" {{on "click" this.closeImportPanel}}>
          <div class="import-panel" role="dialog" {{on "click" this.stopPropagation}}>
            {{#if this.importedAppInfo}}
              <h2 class="shortcuts-title">
                {{this.importedAppInfo.name}}
                <span class="import-version">Ember {{this.importedAppInfo.version}}</span>
              </h2>

              <div class="import-badges">
                {{#if this.importedAppInfo.isOctane}}
                  <span class="import-badge good">Octane</span>
                {{else}}
                  <span class="import-badge bad">Pre-Octane</span>
                {{/if}}
                {{#if this.importedAppInfo.isEmbroider}}
                  <span class="import-badge good">Embroider</span>
                {{/if}}
                {{#if this.importedAppInfo.usesVite}}
                  <span class="import-badge good">Vite</span>
                {{/if}}
                {{#if this.importedAppInfo.usesTailwind}}
                  <span class="import-badge good">Tailwind</span>
                {{/if}}
              </div>

              <div class="import-stats">
                <div class="import-stat">
                  <span class="import-stat-num">{{this.importedAppInfo.components.length}}</span>
                  <span class="import-stat-label">Components</span>
                </div>
                <div class="import-stat">
                  <span class="import-stat-num">{{this.importedAppInfo.routes.length}}</span>
                  <span class="import-stat-label">Routes</span>
                </div>
                <div class="import-stat">
                  <span class="import-stat-num">{{this.importedAppInfo.services.length}}</span>
                  <span class="import-stat-label">Services</span>
                </div>
                <div class="import-stat">
                  <span class="import-stat-num">{{this.importedAppInfo.issues.length}}</span>
                  <span class="import-stat-label">Issues</span>
                </div>
              </div>

              {{#if this.importedAppInfo.issues.length}}
                <h3 class="import-section-title">Upgrade Issues</h3>
                <div class="import-issues">
                  {{#each this.importedAppInfo.issues as |issue|}}
                    <div class="import-issue import-issue-{{issue.severity}}">
                      <span class="import-issue-badge">{{issue.severity}}</span>
                      <div class="import-issue-content">
                        <span class="import-issue-msg">{{issue.message}}</span>
                        {{#if issue.fix}}
                          <span class="import-issue-fix">{{issue.fix}}</span>
                        {{/if}}
                      </div>
                    </div>
                  {{/each}}
                </div>
              {{/if}}
            {{/if}}
          </div>
        </div>
      {{/if}}

      {{! ---- Keyboard Shortcuts Overlay ---- }}
      {{#if this.showShortcutsOverlay}}
        <div class="shortcuts-overlay" role="button" {{on "click" this.closeShortcuts}}>
          <div class="shortcuts-modal" role="dialog" {{on "click" this.stopPropagation}}>
            <h2 class="shortcuts-title">Keyboard Shortcuts</h2>
            <div class="shortcuts-grid">
              <div class="shortcuts-section">
                <h3 class="shortcuts-section-title">Tools</h3>
                <div class="shortcut-row"><kbd>V</kbd> <span>Select</span></div>
                <div class="shortcut-row"><kbd>R</kbd> <span>Rectangle</span></div>
                <div class="shortcut-row"><kbd>O</kbd> <span>Ellipse</span></div>
                <div class="shortcut-row"><kbd>L</kbd> <span>Line</span></div>
                <div class="shortcut-row"><kbd>T</kbd> <span>Text</span></div>
                <div class="shortcut-row"><kbd>F</kbd> <span>Frame</span></div>
                <div class="shortcut-row"><kbd>P</kbd> <span>Pen</span></div>
                <div class="shortcut-row"><kbd>H</kbd> <span>Hand / Pan</span></div>
                <div class="shortcut-row"><kbd>G</kbd> <span>Toggle Grid</span></div>
                <div class="shortcut-row"><kbd>Space</kbd> <span>Hand (hold)</span></div>
              </div>
              <div class="shortcuts-section">
                <h3 class="shortcuts-section-title">Edit</h3>
                <div class="shortcut-row"><kbd>Cmd+Z</kbd> <span>Undo</span></div>
                <div class="shortcut-row"><kbd>Cmd+Shift+Z</kbd> <span>Redo</span></div>
                <div class="shortcut-row"><kbd>Cmd+C</kbd> <span>Copy</span></div>
                <div class="shortcut-row"><kbd>Cmd+V</kbd> <span>Paste</span></div>
                <div class="shortcut-row"><kbd>Cmd+D</kbd> <span>Duplicate</span></div>
                <div class="shortcut-row"><kbd>Cmd+A</kbd> <span>Select All</span></div>
                <div class="shortcut-row"><kbd>Del</kbd> <span>Delete</span></div>
                <div class="shortcut-row"><kbd>Arrows</kbd> <span>Move (1px)</span></div>
                <div class="shortcut-row"><kbd>Shift+Arrows</kbd> <span>Move (10px)</span></div>
              </div>
              <div class="shortcuts-section">
                <h3 class="shortcuts-section-title">AI & Features</h3>
                <div class="shortcut-row"><kbd>Cmd+J</kbd> <span>Chat Mode</span></div>
                <div class="shortcut-row"><kbd>Cmd+K</kbd> <span>Command Palette</span></div>
                <div class="shortcut-row"><kbd>Cmd+Shift+E</kbd> <span>Extract Components</span></div>
                <div class="shortcut-row"><kbd>Shift+?</kbd> <span>This help</span></div>
              </div>
              <div class="shortcuts-section">
                <h3 class="shortcuts-section-title">View</h3>
                <div class="shortcut-row"><kbd>Cmd+=</kbd> <span>Zoom In</span></div>
                <div class="shortcut-row"><kbd>Cmd+-</kbd> <span>Zoom Out</span></div>
                <div class="shortcut-row"><kbd>Cmd+0</kbd> <span>Zoom to Fit</span></div>
                <div class="shortcut-row"><kbd>Esc</kbd> <span>Deselect / Close</span></div>
              </div>
            </div>
          </div>
        </div>
      {{/if}}
    </div>
  </template>
}
