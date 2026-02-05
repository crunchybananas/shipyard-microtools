import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import { fn } from "@ember/helper";

import { codemirrorReadonly } from "harbor-api/modifiers/codemirror";

import type { ResponseData } from "harbor-api/types/api";
import { formatBytes, formatDuration } from "harbor-api/types/api";

export interface ResponsePanelSignature {
  Element: HTMLDivElement;
  Args: {
    response: ResponseData;
  };
}

export default class ResponsePanel extends Component<ResponsePanelSignature> {
  @tracked activeView: "body" | "headers" | "raw" = "body";

  setView = (view: "body" | "headers" | "raw") => {
    this.activeView = view;
  };

  get statusClass(): string {
    const status = this.args.response.status;
    if (status === 0) return "status-error";
    if (status >= 200 && status < 300) return "status-success";
    if (status >= 300 && status < 400) return "status-redirect";
    if (status >= 400 && status < 500) return "status-client-error";
    return "status-server-error";
  }

  get formattedBody(): string {
    const { body, bodyType } = this.args.response;
    if (bodyType === "json") {
      try {
        return JSON.stringify(JSON.parse(body), null, 2);
      } catch {
        return body;
      }
    }
    return body;
  }

  get headerEntries(): Array<{ key: string; value: string }> {
    return Object.entries(this.args.response.headers).map(([key, value]) => ({
      key,
      value,
    }));
  }

  get codemirrorLang(): string {
    const bt = this.args.response.bodyType;
    if (bt === "json") return "json";
    if (bt === "xml") return "xml";
    if (bt === "html") return "html";
    return "text";
  }

  <template>
    <div class="response-panel" ...attributes>
      {{! Status bar }}
      <div class="response-status-bar">
        <span class="status-badge {{this.statusClass}}">
          {{#if (eq @response.status 0)}}
            Error
          {{else}}
            {{@response.status}} {{@response.statusText}}
          {{/if}}
        </span>
        <span class="response-meta">
          <span class="meta-item" title="Response time">
            ⏱ {{formatDur @response.duration}}
          </span>
          <span class="meta-item" title="Response size">
            📦 {{formatSize @response.size}}
          </span>
        </span>
      </div>

      {{! View tabs }}
      <div class="response-tabs">
        <button
          class="response-tab {{if (eq this.activeView 'body') 'active'}}"
          type="button"
          {{on "click" (fn this.setView "body")}}
        >Body</button>
        <button
          class="response-tab {{if (eq this.activeView 'headers') 'active'}}"
          type="button"
          {{on "click" (fn this.setView "headers")}}
        >
          Headers
          <span class="badge">{{this.headerEntries.length}}</span>
        </button>
        <button
          class="response-tab {{if (eq this.activeView 'raw') 'active'}}"
          type="button"
          {{on "click" (fn this.setView "raw")}}
        >Raw</button>
      </div>

      {{! Response content }}
      <div class="response-content">
        {{#if (eq this.activeView "body")}}
          <div class="response-body">
            <div
              class="codemirror-container response-editor"
              {{codemirrorReadonly this.formattedBody this.codemirrorLang}}
            ></div>
          </div>
        {{/if}}

        {{#if (eq this.activeView "headers")}}
          <div class="response-headers">
            <table class="headers-table">
              <thead>
                <tr>
                  <th>Header</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {{#each this.headerEntries as |entry|}}
                  <tr>
                    <td class="header-key">{{entry.key}}</td>
                    <td class="header-value">{{entry.value}}</td>
                  </tr>
                {{/each}}
              </tbody>
            </table>
          </div>
        {{/if}}

        {{#if (eq this.activeView "raw")}}
          <div class="response-raw">
            <pre class="raw-output">{{@response.body}}</pre>
          </div>
        {{/if}}
      </div>
    </div>
  </template>
}

function eq(a: unknown, b: unknown): boolean {
  return a === b;
}

function formatDur(ms: number): string {
  return formatDuration(ms);
}

function formatSize(bytes: number): string {
  return formatBytes(bytes);
}
