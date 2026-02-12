import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import { fn } from "@ember/helper";
import TextPanel from "./text-panel";
import FilePanel from "./file-panel";
import StatusMessage from "./status-message";

// ── Tab definitions (data-driven) ──────────────────────────────

const TABS = [
  { id: "text", label: "Text" },
  { id: "file", label: "File/Image" },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ── Component ──────────────────────────────────────────────────

export default class Base64ToolsApp extends Component {
  @tracked activeTab: TabId = "text";
  @tracked statusText = "";
  @tracked statusType: "success" | "error" | "" = "";

  private statusTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Computed ─────────────────────────────────────────────────

  get isTextTab() {
    return this.activeTab === "text";
  }

  get isFileTab() {
    return this.activeTab === "file";
  }

  // ── Event handlers (fat arrows) ──────────────────────────────

  switchTab = (tabId: TabId) => {
    this.activeTab = tabId;
  };

  showStatus = (message: string, type: "success" | "error") => {
    if (this.statusTimer) clearTimeout(this.statusTimer);
    this.statusText = message;
    this.statusType = type;
    this.statusTimer = setTimeout(() => {
      this.statusText = "";
      this.statusType = "";
    }, 3000);
  };

  tabClass = (tabId: TabId) => {
    return this.activeTab === tabId ? "tab active" : "tab";
  };

  // ── Template ─────────────────────────────────────────────────

  <template>
    <div class="container">
      <header>
        <a href="../../" class="back">← All Tools</a>
        <h1>🔐 Base64 Tools</h1>
        <p class="subtitle">Encode and decode text, files, and images to/from
          Base64.</p>
      </header>

      <main>
        <div class="tabs">
          {{#each TABS as |tab|}}
            <button
              class={{this.tabClass tab.id}}
              type="button"
              {{on "click" (fn this.switchTab tab.id)}}
            >{{tab.label}}</button>
          {{/each}}
        </div>

        {{#if this.isTextTab}}
          <TextPanel @onStatus={{this.showStatus}} />
        {{/if}}

        {{#if this.isFileTab}}
          <FilePanel @onStatus={{this.showStatus}} />
        {{/if}}

        <StatusMessage @text={{this.statusText}} @type={{this.statusType}} />
      </main>

      <footer>
        <p class="footer-credit">
          Made with 🧡 by
          <a
            href="https://crunchybananas.github.io"
            target="_blank"
            rel="noopener noreferrer"
          >Cory Loken & Chiron</a>
          using
          <a
            href="https://emberjs.com"
            target="_blank"
            rel="noopener noreferrer"
          >Ember</a>
        </p>
      </footer>
    </div>
  </template>
}
