import Component from "@glimmer/component";
import { on } from "@ember/modifier";
import { inject as service } from "@ember/service";
import type DesignStoreService from "atelier/services/design-store";
import {
  IconSparkles,
  IconUndo,
  IconRedo,
  IconGrid,
  IconMagnet,
  IconExport,
} from "atelier/components/atelier/icons";

export interface TopbarSignature {
  Args: {
    onOpenExport: () => void;
    onOpenAiModal: () => void;
  };
}

export default class AtelierTopbar extends Component<TopbarSignature> {
  @service declare designStore: DesignStoreService;

  onFileNameChange = (e: Event) => {
    this.designStore.fileName = (e.target as HTMLInputElement).value || "Untitled";
  };

  toggleGrid = () => {
    this.designStore.showGrid = !this.designStore.showGrid;
  };

  toggleSnap = () => {
    this.designStore.snapToGrid = !this.designStore.snapToGrid;
  };

  <template>
    <div class="topbar">
      <a href="#/" class="topbar-back" title="All Projects">
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

        <button class="topbar-btn" type="button" {{on "click" @onOpenExport}}>
          <IconExport />
          Export
        </button>

        <button class="topbar-btn ai-btn" type="button" {{on "click" @onOpenAiModal}}>
          <IconSparkles />
          AI Generate
        </button>
      </div>
    </div>
  </template>
}
