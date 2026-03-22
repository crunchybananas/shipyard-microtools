import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import { inject as service } from "@ember/service";
import type DesignStoreService from "atelier/services/design-store";
import type AuthService from "atelier/services/auth-service";
import {
  IconSparkles,
  IconUndo,
  IconRedo,
  IconGrid,
  IconMagnet,
  IconExport,
} from "atelier/components/atelier/icons";

const IconSignOut = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></template>;

export interface TopbarSignature {
  Args: {
    onOpenExport: () => void;
    onOpenAiModal: () => void;
  };
}

export default class AtelierTopbar extends Component<TopbarSignature> {
  @service declare designStore: DesignStoreService;
  @service declare authService: AuthService;

  @tracked showUserDropdown: boolean = false;

  onFileNameChange = (e: Event) => {
    this.designStore.fileName = (e.target as HTMLInputElement).value || "Untitled";
  };

  toggleGrid = () => {
    this.designStore.showGrid = !this.designStore.showGrid;
  };

  toggleSnap = () => {
    this.designStore.snapToGrid = !this.designStore.snapToGrid;
  };

  toggleUserDropdown = () => {
    this.showUserDropdown = !this.showUserDropdown;
  };

  signOut = async () => {
    this.showUserDropdown = false;
    await this.authService.signOut();
    window.location.hash = "#/";
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

        {{#if this.authService.isAuthenticated}}
          <div class="topbar-separator"></div>
          <div class="topbar-user-wrapper">
            <button class="topbar-user-btn" type="button" {{on "click" this.toggleUserDropdown}}>
              {{#if this.authService.photoURL}}
                <img class="topbar-user-avatar" src={{this.authService.photoURL}} alt="avatar" />
              {{else}}
                <span class="topbar-user-initials">{{this.authService.initials}}</span>
              {{/if}}
            </button>
            {{#if this.showUserDropdown}}
              <div class="topbar-user-dropdown">
                <div class="topbar-user-dropdown-header">
                  <div class="topbar-user-dropdown-name">{{this.authService.displayName}}</div>
                  <div class="topbar-user-dropdown-email">{{this.authService.email}}</div>
                </div>
                <div class="topbar-user-dropdown-divider"></div>
                <button class="topbar-user-dropdown-item" type="button" {{on "click" this.signOut}}>
                  <IconSignOut />
                  Sign out
                </button>
              </div>
            {{/if}}
          </div>
        {{/if}}
      </div>
    </div>
  </template>
}
