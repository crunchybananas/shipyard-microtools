import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import { fn } from "@ember/helper";
import { service } from "@ember/service";
import { modifier } from "ember-modifier";

import RequestPanel from "harbor-api/components/harbor-api/request-panel";
import ResponsePanel from "harbor-api/components/harbor-api/response-panel";
import Sidebar from "harbor-api/components/harbor-api/sidebar";
import TabBar from "harbor-api/components/harbor-api/tab-bar";
import TimingChart from "harbor-api/components/harbor-api/timing-chart";

import type HttpClientService from "harbor-api/services/http-client";
import type { RequestTab, ResponseData, HttpMethod } from "harbor-api/types/api";
import { createRequestTab, createKeyValuePair, METHOD_COLORS } from "harbor-api/types/api";

interface HarborApiAppSignature {
  Element: HTMLDivElement;
  Args: {};
}

export default class HarborApiApp extends Component<HarborApiAppSignature> {
  @service declare httpClient: HttpClientService;

  @tracked tabs: RequestTab[] = [createRequestTab("My Request")];
  @tracked activeTabId: string = this.tabs[0]?.id ?? "";
  @tracked response: ResponseData | null = null;
  @tracked sidebarSection: "history" | "environments" = "history";
  @tracked showSidebar = true;

  storageKey = "harbor-api-tabs";

  setup = modifier(() => {
    this.loadTabs();
  });

  get activeTab(): RequestTab | undefined {
    return this.tabs.find((t) => t.id === this.activeTabId);
  }

  get methodColor(): string {
    return METHOD_COLORS[this.activeTab?.method ?? "GET"];
  }

  // --- Tab management ---

  addTab = () => {
    const tab = createRequestTab(`Request ${this.tabs.length + 1}`);
    this.tabs = [...this.tabs, tab];
    this.activeTabId = tab.id;
    this.response = null;
    this.saveTabs();
  };

  closeTab = (tabId: string) => {
    if (this.tabs.length <= 1) return;
    this.tabs = this.tabs.filter((t) => t.id !== tabId);
    if (this.activeTabId === tabId) {
      this.activeTabId = this.tabs[0]?.id ?? "";
      this.response = null;
    }
    this.saveTabs();
  };

  selectTab = (tabId: string) => {
    this.activeTabId = tabId;
    this.response = null;
  };

  // --- Request field updates ---

  updateMethod = (event: Event) => {
    const method = (event.target as HTMLSelectElement).value as HttpMethod;
    this.updateActiveTab({ method });
  };

  updateUrl = (event: Event) => {
    const url = (event.target as HTMLInputElement).value;
    this.updateActiveTab({ url });
  };

  updateBodyType = (bodyType: "none" | "json" | "text" | "form") => {
    this.updateActiveTab({ bodyType });
  };

  updateBody = (body: string) => {
    this.updateActiveTab({ body });
  };

  updateAuthType = (authType: "none" | "bearer" | "basic") => {
    this.updateActiveTab({ authType });
  };

  updateAuthToken = (event: Event) => {
    const authToken = (event.target as HTMLInputElement).value;
    this.updateActiveTab({ authToken });
  };

  addHeader = () => {
    const tab = this.activeTab;
    if (!tab) return;
    this.updateActiveTab({
      headers: [...tab.headers, createKeyValuePair()],
    });
  };

  updateHeader = (headerId: string, field: "key" | "value", newValue: string) => {
    const tab = this.activeTab;
    if (!tab) return;
    this.updateActiveTab({
      headers: tab.headers.map((h) =>
        h.id === headerId ? { ...h, [field]: newValue } : h,
      ),
    });
  };

  toggleHeader = (headerId: string) => {
    const tab = this.activeTab;
    if (!tab) return;
    this.updateActiveTab({
      headers: tab.headers.map((h) =>
        h.id === headerId ? { ...h, enabled: !h.enabled } : h,
      ),
    });
  };

  removeHeader = (headerId: string) => {
    const tab = this.activeTab;
    if (!tab) return;
    this.updateActiveTab({
      headers: tab.headers.filter((h) => h.id !== headerId),
    });
  };

  addParam = () => {
    const tab = this.activeTab;
    if (!tab) return;
    this.updateActiveTab({
      params: [...tab.params, createKeyValuePair()],
    });
  };

  updateParam = (paramId: string, field: "key" | "value", newValue: string) => {
    const tab = this.activeTab;
    if (!tab) return;
    this.updateActiveTab({
      params: tab.params.map((p) =>
        p.id === paramId ? { ...p, [field]: newValue } : p,
      ),
    });
  };

  toggleParam = (paramId: string) => {
    const tab = this.activeTab;
    if (!tab) return;
    this.updateActiveTab({
      params: tab.params.map((p) =>
        p.id === paramId ? { ...p, enabled: !p.enabled } : p,
      ),
    });
  };

  removeParam = (paramId: string) => {
    const tab = this.activeTab;
    if (!tab) return;
    this.updateActiveTab({
      params: tab.params.filter((p) => p.id !== paramId),
    });
  };

  // --- Send request ---

  sendRequest = async () => {
    const tab = this.activeTab;
    if (!tab) return;
    this.response = await this.httpClient.sendRequest(tab);
  };

  // --- Load from history ---

  loadFromHistory = (method: string, url: string) => {
    const tab = createRequestTab(url.split("/").pop() ?? "Request");
    tab.method = method as HttpMethod;
    tab.url = url;
    this.tabs = [...this.tabs, tab];
    this.activeTabId = tab.id;
    this.response = null;
    this.saveTabs();
  };

  // --- Sidebar ---

  toggleSidebar = () => {
    this.showSidebar = !this.showSidebar;
  };

  setSidebarSection = (section: "history" | "environments") => {
    this.sidebarSection = section;
    this.showSidebar = true;
  };

  // --- Helpers ---

  private updateActiveTab(patch: Partial<RequestTab>) {
    this.tabs = this.tabs.map((t) =>
      t.id === this.activeTabId ? { ...t, ...patch } : t,
    );
    this.saveTabs();
  }

  private saveTabs() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.tabs));
    } catch {
      // Ignore
    }
  }

  private loadTabs() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        const tabs = JSON.parse(raw) as RequestTab[];
        if (tabs.length > 0) {
          this.tabs = tabs;
          this.activeTabId = tabs[0]?.id ?? "";
        }
      }
    } catch {
      // Ignore
    }
  }

  <template>
    <div class="harbor-api" {{this.setup}} ...attributes>
      <header class="app-header">
        <div class="header-brand">
          <span class="brand-icon">⚓</span>
          <span class="brand-text">Harbor API</span>
          <span class="brand-badge">Ember × Zero Wrappers</span>
        </div>
        <div class="header-actions">
          <button
            class="btn btn-ghost"
            type="button"
            {{on "click" (fn this.setSidebarSection "history")}}
          >
            📜 History
          </button>
          <button
            class="btn btn-ghost"
            type="button"
            {{on "click" (fn this.setSidebarSection "environments")}}
          >
            🌍 Envs
          </button>
          <button
            class="btn btn-ghost"
            type="button"
            {{on "click" this.toggleSidebar}}
          >
            {{if this.showSidebar "◀" "▶"}}
          </button>
        </div>
      </header>

      <TabBar
        @tabs={{this.tabs}}
        @activeTabId={{this.activeTabId}}
        @onSelect={{this.selectTab}}
        @onClose={{this.closeTab}}
        @onAdd={{this.addTab}}
      />

      <div class="main-content">
        <div class="panels">
          {{#if this.activeTab}}
            <RequestPanel
              @tab={{this.activeTab}}
              @isLoading={{this.httpClient.isLoading}}
              @onMethodChange={{this.updateMethod}}
              @onUrlChange={{this.updateUrl}}
              @onSend={{this.sendRequest}}
              @onBodyTypeChange={{this.updateBodyType}}
              @onBodyChange={{this.updateBody}}
              @onAuthTypeChange={{this.updateAuthType}}
              @onAuthTokenChange={{this.updateAuthToken}}
              @onAddHeader={{this.addHeader}}
              @onUpdateHeader={{this.updateHeader}}
              @onToggleHeader={{this.toggleHeader}}
              @onRemoveHeader={{this.removeHeader}}
              @onAddParam={{this.addParam}}
              @onUpdateParam={{this.updateParam}}
              @onToggleParam={{this.toggleParam}}
              @onRemoveParam={{this.removeParam}}
            />

            <div class="response-area">
              {{#if this.response}}
                <ResponsePanel @response={{this.response}} />
              {{else}}
                <div class="empty-response">
                  <div class="empty-icon">⚓</div>
                  <p class="empty-title">Ready to sail</p>
                  <p class="empty-subtitle">Send a request to see the response here</p>
                  <div class="empty-hint">
                    <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to send
                  </div>
                </div>
              {{/if}}

              {{#if (gt this.httpClient.responseTimes.length 1)}}
                <TimingChart @data={{this.httpClient.responseTimes}} />
              {{/if}}
            </div>
          {{/if}}
        </div>

        {{#if this.showSidebar}}
          <Sidebar
            @section={{this.sidebarSection}}
            @history={{this.httpClient.history}}
            @environments={{this.httpClient.environments}}
            @activeEnvironmentId={{this.httpClient.activeEnvironmentId}}
            @onLoadFromHistory={{this.loadFromHistory}}
            @onClearHistory={{this.httpClient.clearHistory}}
            @onSetActiveEnvironment={{this.httpClient.setActiveEnvironment}}
            @onAddEnvironment={{this.httpClient.addEnvironment}}
            @onAddVariable={{this.httpClient.addEnvironmentVariable}}
            @onUpdateVariable={{this.httpClient.updateEnvironmentVariable}}
          />
        {{/if}}
      </div>

      <footer class="app-footer">
        <p class="footer-credit">
          Made with 🧡 by
          <a href="https://crunchybananas.github.io" target="_blank" rel="noopener noreferrer">Cory Loken &amp; Chiron</a>
          using
          <a href="https://emberjs.com" target="_blank" rel="noopener noreferrer">Ember</a>
          ·
          <span class="footer-tech">CodeMirror 6 + Chart.js via modifiers — zero wrapper addons</span>
        </p>
      </footer>
    </div>
  </template>
}

function gt(a: number, b: number): boolean {
  return a > b;
}
