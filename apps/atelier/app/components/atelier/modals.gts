import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import { fn } from "@ember/helper";
import { inject as service } from "@ember/service";
import { modifier } from "ember-modifier";
import type DesignStoreService from "atelier/services/design-store";
import type AiServiceService from "atelier/services/ai-service";
import type CommandPaletteService from "atelier/services/command-palette";
import type ProjectStoreService from "atelier/services/project-store";
import type { DesignElement } from "atelier/services/design-store";
import {
  IconSparkles,
  IconX,
  IconDownload,
} from "atelier/components/atelier/icons";

const IconCopy = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></template>;
const IconUserPlus = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg></template>;
const IconTrash = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></template>;

const PRESET_COLORS = [
  "#ffffff", "#000000", "#f87171", "#fb923c", "#fbbf24", "#a3e635",
  "#4ade80", "#22d3ee", "#818cf8", "#a78bfa", "#c084fc", "#f472b6",
  "#1e1e2e", "#2a2a4a", "#374151", "#64748b", "#94a3b8", "#e2e8f0",
  "#0f172a", "#1e293b", "#334155", "#475569", "#6b7280", "#d1d5db",
  "#312e81", "#1e3a5f", "#1e3a3a", "#3a1e3a", "#422006", "#052e16",
  "#7c2d12", "#831843", "#172554", "#064e3b", "#365314", "#713f12",
];

export interface ModalsSignature {
  Args: {
    onShowToast: (message: string) => void;
  };
}

export default class AtelierModals extends Component<ModalsSignature> {
  @service declare designStore: DesignStoreService;
  @service declare aiService: AiServiceService;
  @service declare commandPalette: CommandPaletteService;
  @service declare projectStore: ProjectStoreService;

  @tracked aiPrompt: string = "";
  @tracked shareEmail: string = "";
  @tracked shareRole: string = "editor";
  @tracked shareCollaborators: string[] = [];
  @tracked isShareLoading: boolean = false;

  // Auto-focus modifier for command palette
  autoFocus = modifier((element: Element) => {
    (element as HTMLInputElement).focus();
  });

  // ---- AI Modal ----

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

  get isAiDisabled(): boolean {
    return !this.aiPrompt.trim();
  }

  // ---- Export Modal ----

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
    this.args.onShowToast("Exported SVG");
  };

  copySVG = () => {
    const svg = this.designStore.exportSVG();
    navigator.clipboard.writeText(svg);
    this.args.onShowToast("SVG copied to clipboard");
  };

  get svgContent(): string {
    return this.designStore.exportSVG();
  }

  // ---- Share Modal ----

  get showShareModal(): boolean {
    return this.designStore.showShareModal ?? false;
  }

  closeShareModal = () => {
    this.designStore.showShareModal = false;
  };

  onShareEmailInput = (e: Event) => {
    this.shareEmail = (e.target as HTMLInputElement).value;
  };

  onShareRoleChange = (e: Event) => {
    this.shareRole = (e.target as HTMLSelectElement).value;
  };

  shareProject = async (e: Event) => {
    e.preventDefault();
    if (!this.shareEmail.trim() || !this.designStore.currentProjectId) return;

    this.isShareLoading = true;
    try {
      await this.projectStore.shareProject(this.designStore.currentProjectId, this.shareEmail.trim());
      this.shareCollaborators = [...this.shareCollaborators, this.shareEmail.trim()];
      this.shareEmail = "";
      this.args.onShowToast("Project shared successfully");
    } catch (e) {
      console.error("Failed to share:", e);
    } finally {
      this.isShareLoading = false;
    }
  };

  removeCollaborator = async (email: string) => {
    if (!this.designStore.currentProjectId) return;
    try {
      await this.projectStore.unshareProject(this.designStore.currentProjectId, email);
      this.shareCollaborators = this.shareCollaborators.filter((e) => e !== email);
      this.args.onShowToast("Collaborator removed");
    } catch (e) {
      console.error("Failed to remove collaborator:", e);
    }
  };

  copyProjectLink = () => {
    const projectId = this.designStore.currentProjectId;
    if (!projectId) return;
    const url = `${window.location.origin}${window.location.pathname}#/editor/${projectId}`;
    navigator.clipboard.writeText(url);
    this.args.onShowToast("Link copied to clipboard");
  };

  loadShareCollaborators = async () => {
    if (!this.designStore.currentProjectId) return;
    try {
      this.shareCollaborators = await this.projectStore.getProjectCollaborators(this.designStore.currentProjectId);
    } catch {
      this.shareCollaborators = [];
    }
  };

  getCollaboratorInitial = (email: string): string => {
    return (email[0] ?? "?").toUpperCase();
  };

  // ---- Color Picker ----

  get selectedElement(): DesignElement | null {
    return this.designStore.singleSelection;
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

  get colorPickerPosition(): string {
    const anchorY = this.designStore.colorPickerAnchorY ?? 200;
    // Clamp so the picker (approx 360px tall) doesn't overflow the viewport
    const maxY = Math.max(60, Math.min(anchorY, window.innerHeight - 380));
    return `top: ${maxY}px;`;
  }

  get presetColors(): string[] {
    return PRESET_COLORS;
  }

  closeColorPicker = () => {
    this.designStore.showColorPicker = false;
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

  updateColor = (prop: string, color: string) => {
    const el = this.designStore.singleSelection;
    if (!el) return;
    this.designStore.pushHistory();
    this.designStore.updateElement(el.id, { [prop]: color });
  };

  isColorActive = (color: string): boolean => {
    return this.currentPickerColor === color;
  };

  swatchStyle = (color: string): string => {
    return `background-color: ${color}`;
  };

  // ---- Context Menu ----

  get contextMenuStyle(): string {
    const pos = this.designStore.contextMenuPos;
    if (!pos) return "";
    return `top: ${pos.y}px; left: ${pos.x}px; z-index: 1001;`;
  }

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

  get hasMultiSelection(): boolean {
    return this.designStore.selectedIds.length > 1;
  }

  // ---- Command Palette ----

  onPaletteInput = (e: Event) => {
    this.commandPalette.query = (e.target as HTMLInputElement).value;
    this.commandPalette.selectedIndex = 0;
  };

  onPaletteKeydown = (e: KeyboardEvent) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      this.commandPalette.moveUp();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      this.commandPalette.moveDown();
    } else if (e.key === "Enter") {
      e.preventDefault();
      this.commandPalette.executeSelected();
    } else if (e.key === "Escape") {
      e.preventDefault();
      this.commandPalette.close();
    }
  };

  closePalette = () => {
    this.commandPalette.close();
  };

  executeCommand = (id: string) => {
    this.commandPalette.execute(id);
  };

  isPaletteItemIndex = (cmd: { id: string }): boolean => {
    const allFiltered = this.commandPalette.filteredCommands;
    const idx = allFiltered.findIndex((c) => c.id === cmd.id);
    return idx === this.commandPalette.selectedIndex;
  };

  // ---- Helpers ----

  stopPropagation = (e: MouseEvent) => {
    e.stopPropagation();
  };

  <template>
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
            <button class="ai-modal-close" type="button" {{on "click" this.closeExport}}>
              <IconX />
            </button>
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

    {{! ---- Share Modal ---- }}
    {{#if this.showShareModal}}
      <div class="modal-overlay" role="button" {{on "click" this.closeShareModal}}>
        <div class="share-modal" role="dialog" {{on "click" this.stopPropagation}}>
          <div class="share-modal-header">
            <div class="share-modal-title">Share Project</div>
            <button class="ai-modal-close" type="button" {{on "click" this.closeShareModal}}>
              <IconX />
            </button>
          </div>

          <div class="share-modal-body">
            <form class="share-invite-form" {{on "submit" this.shareProject}}>
              <input
                class="share-email-input"
                type="email"
                placeholder="Enter email address"
                value={{this.shareEmail}}
                {{on "input" this.onShareEmailInput}}
              />
              <select class="share-role-select" {{on "change" this.onShareRoleChange}}>
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <button class="share-invite-btn" type="submit" disabled={{this.isShareLoading}}>
                <IconUserPlus />
                Share
              </button>
            </form>

            {{#if this.shareCollaborators.length}}
              <div class="share-collaborators">
                <div class="share-collaborators-title">Collaborators</div>
                {{#each this.shareCollaborators as |email|}}
                  <div class="share-collaborator-row">
                    <div class="share-collaborator-avatar">
                      {{this.getCollaboratorInitial email}}
                    </div>
                    <div class="share-collaborator-email">{{email}}</div>
                    <button
                      class="share-collaborator-remove"
                      type="button"
                      title="Remove"
                      {{on "click" (fn this.removeCollaborator email)}}
                    >
                      <IconTrash />
                    </button>
                  </div>
                {{/each}}
              </div>
            {{/if}}
          </div>

          <div class="share-modal-footer">
            <button class="share-copy-link" type="button" {{on "click" this.copyProjectLink}}>
              <IconCopy />
              Copy Link
            </button>
          </div>
        </div>
      </div>
    {{/if}}

    {{! ---- Command Palette ---- }}
    {{#if this.commandPalette.isOpen}}
      <div class="cmd-overlay" role="button" {{on "click" this.closePalette}}></div>
      <div class="cmd-palette">
        <div class="cmd-search">
          <svg class="cmd-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            class="cmd-input"
            type="text"
            placeholder="Type a command..."
            value={{this.commandPalette.query}}
            {{this.autoFocus}}
            {{on "input" this.onPaletteInput}}
            {{on "keydown" this.onPaletteKeydown}}
          />
          <span class="cmd-shortcut-badge">esc</span>
        </div>
        <div class="cmd-results">
          {{#each this.commandPalette.groupedCommands as |group|}}
            <div class="cmd-group">
              <div class="cmd-group-label">{{group.category}}</div>
              {{#each group.commands as |cmd|}}
                <button
                  class="cmd-item {{if (this.isPaletteItemIndex cmd) 'selected'}}"
                  type="button"
                  {{on "click" (fn this.executeCommand cmd.id)}}
                >
                  <span class="cmd-item-label">{{cmd.label}}</span>
                  {{#if cmd.shortcut}}
                    <span class="cmd-item-shortcut">{{cmd.shortcut}}</span>
                  {{/if}}
                </button>
              {{/each}}
            </div>
          {{/each}}
          {{#unless this.commandPalette.filteredCommands.length}}
            <div class="cmd-empty">No commands found</div>
          {{/unless}}
        </div>
      </div>
    {{/if}}
  </template>
}
