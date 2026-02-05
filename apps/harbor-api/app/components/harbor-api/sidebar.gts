import Component from "@glimmer/component";
import { on } from "@ember/modifier";
import { fn } from "@ember/helper";

import type { HistoryEntry, Environment } from "harbor-api/types/api";
import { METHOD_COLORS, formatDuration } from "harbor-api/types/api";

export interface SidebarSignature {
  Element: HTMLDivElement;
  Args: {
    section: "history" | "environments";
    history: HistoryEntry[];
    environments: Environment[];
    activeEnvironmentId: string;
    onLoadFromHistory: (method: string, url: string) => void;
    onClearHistory: () => void;
    onSetActiveEnvironment: (envId: string) => void;
    onAddEnvironment: (name: string) => void;
    onAddVariable: (envId: string) => void;
    onUpdateVariable: (envId: string, varId: string, field: "key" | "value", value: string) => void;
  };
}

export default class Sidebar extends Component<SidebarSignature> {
  handleAddEnv = () => {
    const name = prompt("Environment name:");
    if (name?.trim()) {
      this.args.onAddEnvironment(name.trim());
    }
  };

  handleEnvSelect = (event: Event) => {
    this.args.onSetActiveEnvironment((event.target as HTMLSelectElement).value);
  };

  handleVarKeyInput = (envId: string, varId: string, event: Event) => {
    this.args.onUpdateVariable(envId, varId, "key", (event.target as HTMLInputElement).value);
  };

  handleVarValueInput = (envId: string, varId: string, event: Event) => {
    this.args.onUpdateVariable(envId, varId, "value", (event.target as HTMLInputElement).value);
  };

  get activeEnv(): Environment | undefined {
    return this.args.environments.find((e) => e.id === this.args.activeEnvironmentId);
  }

  <template>
    <aside class="sidebar" ...attributes>
      {{#if (eq @section "history")}}
        <div class="sidebar-header">
          <h3>📜 History</h3>
          {{#if (gt @history.length 0)}}
            <button class="btn btn-ghost btn-sm" type="button" {{on "click" @onClearHistory}}>
              Clear
            </button>
          {{/if}}
        </div>
        <div class="sidebar-content">
          {{#if (eq @history.length 0)}}
            <p class="sidebar-empty">No requests yet</p>
          {{else}}
            {{#each @history as |entry|}}
              <button
                class="history-item"
                type="button"
                {{on "click" (fn @onLoadFromHistory entry.method entry.url)}}
              >
                <div class="history-top">
                  <span
                    class="history-method"
                    style="color: {{methodColor entry.method}}"
                  >{{entry.method}}</span>
                  <span class="history-status {{statusClass entry.status}}">
                    {{entry.status}}
                  </span>
                </div>
                <span class="history-url">{{truncateUrl entry.url}}</span>
                <div class="history-meta">
                  <span>{{formatDur entry.duration}}</span>
                  <span>{{timeAgo entry.timestamp}}</span>
                </div>
              </button>
            {{/each}}
          {{/if}}
        </div>
      {{/if}}

      {{#if (eq @section "environments")}}
        <div class="sidebar-header">
          <h3>🌍 Environments</h3>
          <button class="btn btn-ghost btn-sm" type="button" {{on "click" this.handleAddEnv}}>
            + New
          </button>
        </div>
        <div class="sidebar-content">
          <div class="env-selector">
            <select class="env-select" {{on "change" this.handleEnvSelect}}>
              {{#each @environments as |env|}}
                <option value={{env.id}} selected={{eq env.id @activeEnvironmentId}}>
                  {{env.name}}
                </option>
              {{/each}}
            </select>
          </div>

          {{#if this.activeEnv}}
            <div class="env-variables">
              <div class="env-vars-header">
                <span class="env-vars-title">Variables</span>
                <button
                  class="btn btn-ghost btn-sm"
                  type="button"
                  {{on "click" (fn @onAddVariable this.activeEnv.id)}}
                >+ Add</button>
              </div>
              {{#each this.activeEnv.variables as |variable|}}
                <div class="env-var-row">
                  <input
                    class="env-var-key"
                    type="text"
                    value={{variable.key}}
                    placeholder="KEY"
                    {{on "input" (fn this.handleVarKeyInput this.activeEnv.id variable.id)}}
                  />
                  <input
                    class="env-var-value"
                    type="text"
                    value={{variable.value}}
                    placeholder="value"
                    {{on "input" (fn this.handleVarValueInput this.activeEnv.id variable.id)}}
                  />
                </div>
              {{/each}}
              <p class="env-hint">Use <code>{{"{{KEY}}"}}</code> in URLs, headers, and body</p>
            </div>
          {{/if}}
        </div>
      {{/if}}
    </aside>
  </template>
}

// --- Template helpers ---

function eq(a: unknown, b: unknown): boolean {
  return a === b;
}

function gt(a: number, b: number): boolean {
  return a > b;
}

function methodColor(method: string): string {
  return METHOD_COLORS[method as keyof typeof METHOD_COLORS] ?? "#8888aa";
}

function statusClass(status: number): string {
  if (status >= 200 && status < 300) return "status-success";
  if (status >= 300 && status < 400) return "status-redirect";
  if (status >= 400) return "status-error";
  return "";
}

function truncateUrl(url: string): string {
  const clean = url.replace(/^https?:\/\//, "");
  if (clean.length > 35) return clean.slice(0, 35) + "…";
  return clean;
}

function formatDur(ms: number): string {
  return formatDuration(ms);
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
