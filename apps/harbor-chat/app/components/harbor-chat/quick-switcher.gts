import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { inject as service } from "@ember/service";
import { fn } from "@ember/helper";
import { on } from "@ember/modifier";
import { modifier } from "ember-modifier";
import type RouterService from "@ember/routing/router-service";
import type WorkspaceStoreService from "harbor-chat/services/workspace-store";
import type { Channel, Workspace } from "harbor-chat/harbor-chat/types";

interface QuickSwitcherSignature {
  Args: {};
}

interface SwitcherItem {
  channel: Channel;
  workspace: Workspace | undefined;
  label: string;
  icon: string;
  subtitle: string;
}

export default class QuickSwitcher extends Component<QuickSwitcherSignature> {
  @service declare workspaceStore: WorkspaceStoreService;
  @service declare router: RouterService;

  @tracked isOpen = false;
  @tracked searchQuery = "";
  @tracked selectedIndex = 0;

  get items(): SwitcherItem[] {
    const workspaces = this.workspaceStore.workspaces;
    const results: SwitcherItem[] = [];

    for (const ws of workspaces) {
      const channels = this.workspaceStore.channelsForWorkspace(ws.id);
      const dms = this.workspaceStore.dmsForWorkspace(ws.id);

      for (const ch of channels) {
        const icon = ch.isPrivate ? "🔒" : "#";
        results.push({
          channel: ch,
          workspace: ws,
          label: ch.name,
          icon,
          subtitle: ws.name,
        });
      }

      for (const dm of dms) {
        const displayName = this.workspaceStore.getDmDisplayName(dm);
        const otherIds = dm.memberIds.filter(
          (id) => id !== this.workspaceStore.currentUserId,
        );
        const otherUser = otherIds.length > 0
          ? this.workspaceStore.getUserById(otherIds[0])
          : undefined;
        const status = otherUser?.status ?? "offline";
        const dot = status === "online" ? "🟢" : status === "away" ? "🟡" : "⚫";
        results.push({
          channel: dm,
          workspace: ws,
          label: displayName || dm.name,
          icon: dot,
          subtitle: ws.name,
        });
      }
    }

    if (!this.searchQuery) {
      // Sort by lastMessageAt descending (recent first)
      return results.sort((a, b) => b.channel.lastMessageAt - a.channel.lastMessageAt);
    }

    const query = this.searchQuery.toLowerCase();
    return results
      .filter((item) => item.label.toLowerCase().includes(query))
      .sort((a, b) => {
        // Prefer items that start with the query
        const aStarts = a.label.toLowerCase().startsWith(query) ? 0 : 1;
        const bStarts = b.label.toLowerCase().startsWith(query) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        return a.label.localeCompare(b.label);
      });
  }

  open = () => {
    this.isOpen = true;
    this.searchQuery = "";
    this.selectedIndex = 0;
  };

  close = () => {
    this.isOpen = false;
    this.searchQuery = "";
    this.selectedIndex = 0;
  };

  handleSearch = (event: Event) => {
    this.searchQuery = (event.target as HTMLInputElement).value;
    this.selectedIndex = 0;
  };

  handleKeydown = (event: KeyboardEvent) => {
    if (!this.isOpen) return;

    if (event.key === "Escape") {
      event.preventDefault();
      this.close();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      this.selectedIndex = Math.min(
        this.selectedIndex + 1,
        this.items.length - 1,
      );
      this.scrollSelectedIntoView();
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
      this.scrollSelectedIntoView();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const item = this.items[this.selectedIndex];
      if (item) {
        this.selectItem(item);
      }
      return;
    }
  };

  scrollSelectedIntoView = () => {
    requestAnimationFrame(() => {
      const el = document.querySelector(".qs-result-item.qs-selected");
      el?.scrollIntoView({ block: "nearest" });
    });
  };

  selectItem = (item: SwitcherItem) => {
    this.close();
    this.router.transitionTo(
      "workspace.channel",
      item.channel.workspaceId,
      item.channel.id,
    );
  };

  handleBackdropClick = (event: MouseEvent) => {
    if ((event.target as HTMLElement).classList.contains("qs-backdrop")) {
      this.close();
    }
  };

  handleItemClick = (index: number) => {
    const item = this.items[index];
    if (item) {
      this.selectItem(item);
    }
  };

  isSelected = (index: number): boolean => {
    return index === this.selectedIndex;
  };

  registerKeyboardShortcut = modifier((element: Element) => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        if (this.isOpen) {
          this.close();
        } else {
          this.open();
        }
      }
    };

    document.addEventListener("keydown", handler);

    return () => {
      document.removeEventListener("keydown", handler);
    };
  });

  autoFocus = modifier((element: HTMLElement) => {
    requestAnimationFrame(() => {
      (element as HTMLInputElement).focus();
    });
  });

  <template>
    <div class="qs-anchor" {{this.registerKeyboardShortcut}}>
      {{#if this.isOpen}}
        <div
          class="qs-backdrop"
          {{on "click" this.handleBackdropClick}}
          {{on "keydown" this.handleKeydown}}
        >
          <div class="qs-modal">
            <div class="qs-search-wrap">
              <span class="qs-search-icon">🔍</span>
              <input
                class="qs-search-input"
                type="text"
                placeholder="Switch to a channel or DM..."
                value={{this.searchQuery}}
                {{on "input" this.handleSearch}}
                {{on "keydown" this.handleKeydown}}
                {{this.autoFocus}}
              />
              <kbd class="qs-kbd">esc</kbd>
            </div>

            <div class="qs-results">
              {{#if this.items.length}}
                <div class="qs-results-label">
                  {{#if this.searchQuery}}
                    Channels and DMs matching "{{this.searchQuery}}"
                  {{else}}
                    Recent
                  {{/if}}
                </div>
                <ul class="qs-results-list">
                  {{#each this.items as |item i|}}
                    <li
                      class="qs-result-item {{if (this.isSelected i) 'qs-selected'}}"
                      {{on "click" (fn this.handleItemClick i)}}
                    >
                      <span class="qs-item-icon {{if (this.isSelected i) 'qs-icon-selected'}}">{{item.icon}}</span>
                      <span class="qs-item-label">{{item.label}}</span>
                      <span class="qs-item-subtitle">{{item.subtitle}}</span>
                    </li>
                  {{/each}}
                </ul>
              {{else}}
                <div class="qs-empty">No results found</div>
              {{/if}}
            </div>

            <div class="qs-footer">
              <span class="qs-footer-hint">
                <kbd class="qs-kbd-sm">↑</kbd>
                <kbd class="qs-kbd-sm">↓</kbd>
                to navigate
              </span>
              <span class="qs-footer-hint">
                <kbd class="qs-kbd-sm">↵</kbd>
                to select
              </span>
              <span class="qs-footer-hint">
                <kbd class="qs-kbd-sm">esc</kbd>
                to close
              </span>
            </div>
          </div>
        </div>
      {{/if}}
    </div>
  </template>
}
