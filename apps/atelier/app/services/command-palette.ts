import Service from "@ember/service";
import { inject as service } from "@ember/service";
import { tracked } from "@glimmer/tracking";
import type RouterService from "@ember/routing/router-service";
import type DesignStoreService from "./design-store";
import type AiServiceService from "./ai-service";

export interface Command {
  id: string;
  label: string;
  shortcut?: string;
  category: string;
  action: () => void;
}

export default class CommandPaletteService extends Service {
  @service declare designStore: DesignStoreService;
  @service declare router: RouterService;
  @service declare aiService: AiServiceService;

  @tracked isOpen: boolean = false;
  @tracked query: string = "";
  @tracked selectedIndex: number = 0;
  @tracked recentCommandIds: string[] = [];

  get commands(): Command[] {
    return [
      // Tools
      { id: "tool-select", label: "Select Tool", shortcut: "V", category: "Tools", action: () => { this.designStore.activeTool = "select"; } },
      { id: "tool-rectangle", label: "Rectangle Tool", shortcut: "R", category: "Tools", action: () => { this.designStore.activeTool = "rectangle"; } },
      { id: "tool-ellipse", label: "Ellipse Tool", shortcut: "O", category: "Tools", action: () => { this.designStore.activeTool = "ellipse"; } },
      { id: "tool-line", label: "Line Tool", shortcut: "L", category: "Tools", action: () => { this.designStore.activeTool = "line"; } },
      { id: "tool-text", label: "Text Tool", shortcut: "T", category: "Tools", action: () => { this.designStore.activeTool = "text"; } },
      { id: "tool-frame", label: "Frame Tool", shortcut: "F", category: "Tools", action: () => { this.designStore.activeTool = "frame"; } },
      { id: "tool-hand", label: "Hand / Pan Tool", shortcut: "H", category: "Tools", action: () => { this.designStore.activeTool = "hand"; } },
      { id: "tool-pen", label: "Pen Tool", shortcut: "P", category: "Tools", action: () => { this.designStore.activeTool = "pen"; } },
      // View
      { id: "view-grid", label: "Toggle Grid", shortcut: "G", category: "View", action: () => { this.designStore.showGrid = !this.designStore.showGrid; } },
      { id: "view-snap", label: "Toggle Snap to Grid", shortcut: "", category: "View", action: () => { this.designStore.snapToGrid = !this.designStore.snapToGrid; } },
      { id: "view-zoom-in", label: "Zoom In", shortcut: "Cmd+=", category: "View", action: () => { this.designStore.zoomIn(); } },
      { id: "view-zoom-out", label: "Zoom Out", shortcut: "Cmd+-", category: "View", action: () => { this.designStore.zoomOut(); } },
      { id: "view-zoom-fit", label: "Zoom to Fit", shortcut: "Cmd+0", category: "View", action: () => { this.designStore.zoomToFit(); } },
      // Edit
      { id: "edit-undo", label: "Undo", shortcut: "Cmd+Z", category: "Edit", action: () => { this.designStore.undo(); } },
      { id: "edit-redo", label: "Redo", shortcut: "Cmd+Shift+Z", category: "Edit", action: () => { this.designStore.redo(); } },
      { id: "edit-copy", label: "Copy", shortcut: "Cmd+C", category: "Edit", action: () => { this.designStore.copySelected(); } },
      { id: "edit-paste", label: "Paste", shortcut: "Cmd+V", category: "Edit", action: () => { this.designStore.paste(); } },
      { id: "edit-duplicate", label: "Duplicate", shortcut: "Cmd+D", category: "Edit", action: () => { this.designStore.duplicateSelected(); } },
      { id: "edit-delete", label: "Delete Selected", shortcut: "Del", category: "Edit", action: () => { this.designStore.deleteSelected(); } },
      { id: "edit-select-all", label: "Select All", shortcut: "Cmd+A", category: "Edit", action: () => { this.designStore.selectAll(); } },
      { id: "edit-deselect", label: "Deselect All", shortcut: "Esc", category: "Edit", action: () => { this.designStore.deselectAll(); } },
      // Arrange
      { id: "arrange-front", label: "Bring to Front", shortcut: "", category: "Arrange", action: () => { this.designStore.bringToFront(); } },
      { id: "arrange-back", label: "Send to Back", shortcut: "", category: "Arrange", action: () => { this.designStore.sendToBack(); } },
      { id: "arrange-group", label: "Group Selection", shortcut: "", category: "Arrange", action: () => { this.designStore.groupSelected(); } },
      // AI
      { id: "ai-generate", label: "AI Generate Design", shortcut: "", category: "AI", action: () => { this.designStore.showAiModal = true; } },
      { id: "ai-landing", label: "AI: Generate Landing Page", shortcut: "", category: "AI", action: () => { this.aiService.generateFromPrompt("Design a multi-page SaaS app with Home, Features, and Pricing routes"); } },
      { id: "ai-dashboard", label: "AI: Generate Dashboard", shortcut: "", category: "AI", action: () => { this.aiService.generateFromPrompt("Build a dashboard with sidebar nav, stats cards, data table, and chart area"); } },
      { id: "ai-mobile", label: "AI: Generate Mobile App", shortcut: "", category: "AI", action: () => { this.aiService.generateFromPrompt("Create a mobile app with tab navigation — Home, Search, Profile screens"); } },
      { id: "ai-extract", label: "Extract Ember Components", shortcut: "Cmd+Shift+E", category: "AI", action: () => { this.aiService.extractComponents(); } },
      // Export
      { id: "file-export", label: "Export as SVG", shortcut: "", category: "Export", action: () => { this.designStore.exportFormat = "svg"; this.designStore.showExportModal = true; } },
      { id: "file-export-ember", label: "Export as Ember Component (.gts)", shortcut: "", category: "Export", action: () => { this.designStore.exportFormat = "ember"; this.designStore.showExportModal = true; } },
      { id: "file-export-tailwind", label: "Export with Tailwind (.gts)", shortcut: "", category: "Export", action: () => { this.designStore.exportFormat = "tailwind"; this.designStore.showExportModal = true; } },
      { id: "file-export-html", label: "Export as HTML", shortcut: "", category: "Export", action: () => { this.designStore.exportFormat = "html"; this.designStore.showExportModal = true; } },
      { id: "file-export-react", label: "Export as React (.tsx)", shortcut: "", category: "Export", action: () => { this.designStore.exportFormat = "react"; this.designStore.showExportModal = true; } },
      { id: "file-export-app", label: "Download Ember App (.zip)", shortcut: "", category: "Export", action: () => { this.designStore.exportFormat = "ember-app"; this.designStore.showExportModal = true; } },
      // File
      { id: "file-clear", label: "Clear Canvas", shortcut: "", category: "File", action: () => { this.designStore.clearCanvas(); } },
      { id: "file-home", label: "Back to Projects", shortcut: "", category: "File", action: () => { this.router.transitionTo('index'); } },
    ];
  }

  get filteredCommands(): Command[] {
    if (!this.query.trim()) return this.commands;
    const q = this.query.toLowerCase();
    return this.commands.filter((cmd) => {
      const label = cmd.label.toLowerCase();
      const cat = cmd.category.toLowerCase();
      // Fuzzy match: check if all chars of query appear in order
      let qi = 0;
      for (let i = 0; i < label.length && qi < q.length; i++) {
        if (label[i] === q[qi]) qi++;
      }
      if (qi === q.length) return true;
      // Also match on category
      return cat.includes(q) || label.includes(q);
    });
  }

  get groupedCommands(): { category: string; commands: Command[] }[] {
    const groups: Map<string, Command[]> = new Map();
    const filtered = this.filteredCommands;

    // Show recent commands when no query
    if (!this.query.trim() && this.recentCommandIds.length > 0) {
      const recentCmds = this.recentCommandIds
        .map((id) => this.commands.find((c) => c.id === id))
        .filter((c): c is Command => c !== undefined)
        .slice(0, 4);
      if (recentCmds.length > 0) {
        groups.set("Recent", recentCmds);
      }
    }

    for (const cmd of filtered) {
      if (!groups.has(cmd.category)) {
        groups.set(cmd.category, []);
      }
      groups.get(cmd.category)!.push(cmd);
    }
    return Array.from(groups.entries()).map(([category, commands]) => ({
      category,
      commands,
    }));
  }

  open(): void {
    this.isOpen = true;
    this.query = "";
    this.selectedIndex = 0;
  }

  close(): void {
    this.isOpen = false;
    this.query = "";
    this.selectedIndex = 0;
  }

  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  execute(id: string): void {
    const cmd = this.commands.find((c) => c.id === id);
    if (cmd) {
      cmd.action();
      // Track recent commands
      this.recentCommandIds = [
        id,
        ...this.recentCommandIds.filter((r) => r !== id),
      ].slice(0, 8);
    }
    this.close();
  }

  moveUp(): void {
    if (this.selectedIndex > 0) {
      this.selectedIndex = this.selectedIndex - 1;
    }
  }

  moveDown(): void {
    if (this.selectedIndex < this.filteredCommands.length - 1) {
      this.selectedIndex = this.selectedIndex + 1;
    }
  }

  executeSelected(): void {
    const cmd = this.filteredCommands[this.selectedIndex];
    if (cmd) {
      this.execute(cmd.id);
    }
  }
}
