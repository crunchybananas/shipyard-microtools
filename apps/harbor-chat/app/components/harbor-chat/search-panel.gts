import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { inject as service } from "@ember/service";
import { fn } from "@ember/helper";
import { on } from "@ember/modifier";
import { modifier } from "ember-modifier";
import type MessageStoreService from "harbor-chat/services/message-store";
import type WorkspaceStoreService from "harbor-chat/services/workspace-store";
import type { Message } from "harbor-chat/harbor-chat/types";

interface SearchPanelSignature {
  Args: {
    isOpen: boolean;
    onClose: () => void;
    channelId: string;
  };
}

interface SearchResult {
  message: Message;
  authorName: string;
  timestamp: string;
}

export default class SearchPanel extends Component<SearchPanelSignature> {
  @service declare messageStore: MessageStoreService;
  @service declare workspaceStore: WorkspaceStoreService;

  @tracked searchQuery = "";
  @tracked debouncedQuery = "";

  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;

  autoFocus = modifier((element: HTMLElement) => {
    requestAnimationFrame(() => {
      (element as HTMLInputElement).focus();
    });
  });

  get results(): SearchResult[] {
    const query = this.debouncedQuery.trim().toLowerCase();
    if (!query) return [];

    return this.messageStore.messages
      .filter(
        (msg) =>
          msg.channelId === this.args.channelId &&
          msg.content.toLowerCase().includes(query),
      )
      .sort((a, b) => b.timestamp - a.timestamp)
      .map((msg) => ({
        message: msg,
        authorName:
          this.workspaceStore.getUserById(msg.authorId)?.displayName ??
          "Unknown",
        timestamp: this.formatTime(msg.timestamp),
      }));
  }

  get resultCountLabel(): string {
    const count = this.results.length;
    const noun = count === 1 ? "result" : "results";
    return `${count} ${noun} for '${this.debouncedQuery}'`;
  }

  formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const time = date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    if (isToday) return time;

    const dateStr = date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });
    return `${dateStr}, ${time}`;
  };

  handleSearch = (event: Event) => {
    this.searchQuery = (event.target as HTMLInputElement).value;

    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }

    this._debounceTimer = setTimeout(() => {
      this.debouncedQuery = this.searchQuery;
      this._debounceTimer = null;
    }, 300);
  };

  handleKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      this.clearAndClose();
    }
  };

  handleResultClick = (result: SearchResult) => {
    this.clearAndClose();
  };

  clearAndClose = () => {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
    this.searchQuery = "";
    this.debouncedQuery = "";
    this.args.onClose();
  };

  highlightedContent = (result: SearchResult): string => {
    const query = this.debouncedQuery.trim();
    if (!query) return this.escapeHtml(result.message.content);

    const content = result.message.content;
    const escaped = this.escapeHtml(content);
    const escapedQuery = this.escapeHtml(query);

    const regex = new RegExp(
      `(${escapedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
      "gi",
    );
    return escaped.replace(regex, "<mark>$1</mark>");
  };

  private escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  <template>
    {{#if @isOpen}}
      <aside class="search-panel" {{on "keydown" this.handleKeydown}}>
        <div class="search-panel-header">
          <h3>🔍 Search Messages</h3>
          <button class="close-btn" {{on "click" this.clearAndClose}}>&times;</button>
        </div>

        <div class="search-panel-input-wrap">
          <input
            class="search-panel-input"
            type="text"
            placeholder="Search messages..."
            value={{this.searchQuery}}
            {{on "input" this.handleSearch}}
            {{this.autoFocus}}
          />
        </div>

        <div class="search-panel-results">
          {{#if this.debouncedQuery}}
            {{#if this.results.length}}
              <div class="search-panel-count">
                {{this.resultCountLabel}}
              </div>
              {{#each this.results as |result|}}
                <button
                  class="search-result-item"
                  {{on "click" (fn this.handleResultClick result)}}
                >
                  <div class="search-result-author">{{result.authorName}}</div>
                  <div class="search-result-content">
                    {{{this.highlightedContent result}}}
                  </div>
                  <div class="search-result-time">{{result.timestamp}}</div>
                </button>
              {{/each}}
            {{else}}
              <div class="search-panel-empty">
                <span class="search-panel-empty-icon">🔎</span>
                <p>No messages found</p>
              </div>
            {{/if}}
          {{else}}
            <div class="search-panel-empty">
              <span class="search-panel-empty-icon">💬</span>
              <p>Search messages in this channel</p>
            </div>
          {{/if}}
        </div>
      </aside>
    {{/if}}
  </template>
}
