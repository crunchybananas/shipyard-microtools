import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import { fn } from "@ember/helper";

import { codemirror } from "harbor-api/modifiers/codemirror";

import type { RequestTab, KeyValuePair, HttpMethod } from "harbor-api/types/api";
import { HTTP_METHODS, METHOD_COLORS } from "harbor-api/types/api";

export interface RequestPanelSignature {
  Element: HTMLDivElement;
  Args: {
    tab: RequestTab;
    isLoading: boolean;
    onMethodChange: (event: Event) => void;
    onUrlChange: (event: Event) => void;
    onSend: () => void;
    onBodyTypeChange: (bodyType: "none" | "json" | "text" | "form") => void;
    onBodyChange: (body: string) => void;
    onAuthTypeChange: (authType: "none" | "bearer" | "basic") => void;
    onAuthTokenChange: (event: Event) => void;
    onAddHeader: () => void;
    onUpdateHeader: (id: string, field: "key" | "value", value: string) => void;
    onToggleHeader: (id: string) => void;
    onRemoveHeader: (id: string) => void;
    onAddParam: () => void;
    onUpdateParam: (id: string, field: "key" | "value", value: string) => void;
    onToggleParam: (id: string) => void;
    onRemoveParam: (id: string) => void;
  };
}

export default class RequestPanel extends Component<RequestPanelSignature> {
  @tracked activeSection: "params" | "headers" | "body" | "auth" = "params";

  setSection = (section: "params" | "headers" | "body" | "auth") => {
    this.activeSection = section;
  };

  handleKeydown = (event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      this.args.onSend();
    }
  };

  handleHeaderKeyInput = (id: string, event: Event) => {
    this.args.onUpdateHeader(id, "key", (event.target as HTMLInputElement).value);
  };

  handleHeaderValueInput = (id: string, event: Event) => {
    this.args.onUpdateHeader(id, "value", (event.target as HTMLInputElement).value);
  };

  handleParamKeyInput = (id: string, event: Event) => {
    this.args.onUpdateParam(id, "key", (event.target as HTMLInputElement).value);
  };

  handleParamValueInput = (id: string, event: Event) => {
    this.args.onUpdateParam(id, "value", (event.target as HTMLInputElement).value);
  };

  handleBodyTypeChange = (event: Event) => {
    this.args.onBodyTypeChange(
      (event.target as HTMLSelectElement).value as "none" | "json" | "text" | "form",
    );
  };

  handleAuthTypeChange = (event: Event) => {
    this.args.onAuthTypeChange(
      (event.target as HTMLSelectElement).value as "none" | "bearer" | "basic",
    );
  };

  get methodColor(): string {
    return METHOD_COLORS[this.args.tab.method];
  }

  get showBody(): boolean {
    return !["GET", "HEAD", "OPTIONS"].includes(this.args.tab.method);
  }

  get headerCount(): number {
    return this.args.tab.headers.filter((h) => h.enabled && h.key.trim()).length;
  }

  get paramCount(): number {
    return this.args.tab.params.filter((p) => p.enabled && p.key.trim()).length;
  }

  <template>
    <div class="request-panel" {{on "keydown" this.handleKeydown}} ...attributes>
      {{! URL Bar }}
      <div class="url-bar">
        <select
          class="method-select"
          style="color: {{this.methodColor}}"
          {{on "change" @onMethodChange}}
        >
          {{#each methods as |method|}}
            <option
              value={{method}}
              selected={{eq method @tab.method}}
              style="color: {{methodColorFor method}}"
            >{{method}}</option>
          {{/each}}
        </select>
        <input
          class="url-input"
          type="text"
          value={{@tab.url}}
          placeholder="Enter request URL or paste cURL..."
          spellcheck="false"
          {{on "input" @onUrlChange}}
        />
        <button
          class="send-btn {{if @isLoading 'loading'}}"
          type="button"
          disabled={{@isLoading}}
          {{on "click" @onSend}}
        >
          {{#if @isLoading}}
            <span class="spinner"></span>
            Sending...
          {{else}}
            Send ⚡
          {{/if}}
        </button>
      </div>

      {{! Section tabs }}
      <div class="section-tabs">
        <button
          class="section-tab {{if (eq this.activeSection 'params') 'active'}}"
          type="button"
          {{on "click" (fn this.setSection "params")}}
        >
          Params
          {{#if (gt this.paramCount 0)}}
            <span class="badge">{{this.paramCount}}</span>
          {{/if}}
        </button>
        <button
          class="section-tab {{if (eq this.activeSection 'headers') 'active'}}"
          type="button"
          {{on "click" (fn this.setSection "headers")}}
        >
          Headers
          {{#if (gt this.headerCount 0)}}
            <span class="badge">{{this.headerCount}}</span>
          {{/if}}
        </button>
        {{#if this.showBody}}
          <button
            class="section-tab {{if (eq this.activeSection 'body') 'active'}}"
            type="button"
            {{on "click" (fn this.setSection "body")}}
          >
            Body
          </button>
        {{/if}}
        <button
          class="section-tab {{if (eq this.activeSection 'auth') 'active'}}"
          type="button"
          {{on "click" (fn this.setSection "auth")}}
        >
          Auth
        </button>
      </div>

      {{! Section content }}
      <div class="section-content">
        {{#if (eq this.activeSection "params")}}
          <KeyValueEditor
            @items={{@tab.params}}
            @onAdd={{@onAddParam}}
            @onUpdateKey={{this.handleParamKeyInput}}
            @onUpdateValue={{this.handleParamValueInput}}
            @onToggle={{@onToggleParam}}
            @onRemove={{@onRemoveParam}}
            @placeholder="query parameter"
          />
        {{/if}}

        {{#if (eq this.activeSection "headers")}}
          <KeyValueEditor
            @items={{@tab.headers}}
            @onAdd={{@onAddHeader}}
            @onUpdateKey={{this.handleHeaderKeyInput}}
            @onUpdateValue={{this.handleHeaderValueInput}}
            @onToggle={{@onToggleHeader}}
            @onRemove={{@onRemoveHeader}}
            @placeholder="header"
          />
        {{/if}}

        {{#if (eq this.activeSection "body")}}
          <div class="body-section">
            <div class="body-type-selector">
              <select class="body-type-select" {{on "change" this.handleBodyTypeChange}}>
                <option value="none" selected={{eq @tab.bodyType "none"}}>None</option>
                <option value="json" selected={{eq @tab.bodyType "json"}}>JSON</option>
                <option value="text" selected={{eq @tab.bodyType "text"}}>Text</option>
                <option value="form" selected={{eq @tab.bodyType "form"}}>Form Data</option>
              </select>
            </div>
            {{#if (neq @tab.bodyType "none")}}
              <div class="body-editor">
                <div
                  class="codemirror-container"
                  {{codemirror
                    @tab.body
                    (bodyLang @tab.bodyType)
                    false
                    onChange=@onBodyChange
                  }}
                ></div>
              </div>
            {{/if}}
          </div>
        {{/if}}

        {{#if (eq this.activeSection "auth")}}
          <div class="auth-section">
            <div class="auth-type-selector">
              <select class="auth-type-select" {{on "change" this.handleAuthTypeChange}}>
                <option value="none" selected={{eq @tab.authType "none"}}>No Auth</option>
                <option value="bearer" selected={{eq @tab.authType "bearer"}}>Bearer Token</option>
                <option value="basic" selected={{eq @tab.authType "basic"}}>Basic Auth</option>
              </select>
            </div>
            {{#if (neq @tab.authType "none")}}
              <div class="auth-input-row">
                <label class="auth-label">
                  {{#if (eq @tab.authType "bearer")}}Token{{else}}Username:Password{{/if}}
                </label>
                <input
                  class="auth-input"
                  type="text"
                  value={{@tab.authToken}}
                  placeholder={{if (eq @tab.authType "bearer") "Enter token..." "user:password"}}
                  {{on "input" @onAuthTokenChange}}
                />
              </div>
            {{/if}}
          </div>
        {{/if}}
      </div>
    </div>
  </template>
}

// --- Sub-component for key-value pair editing ---

interface KeyValueEditorSignature {
  Element: HTMLDivElement;
  Args: {
    items: KeyValuePair[];
    onAdd: () => void;
    onUpdateKey: (id: string, event: Event) => void;
    onUpdateValue: (id: string, event: Event) => void;
    onToggle: (id: string) => void;
    onRemove: (id: string) => void;
    placeholder: string;
  };
}

class KeyValueEditor extends Component<KeyValueEditorSignature> {
  <template>
    <div class="kv-editor">
      {{#each @items as |item|}}
        <div class="kv-row {{unless item.enabled 'disabled'}}">
          <button
            class="kv-toggle {{if item.enabled 'on'}}"
            type="button"
            {{on "click" (fn @onToggle item.id)}}
          >{{if item.enabled "✓" "○"}}</button>
          <input
            class="kv-key"
            type="text"
            value={{item.key}}
            placeholder="Key"
            {{on "input" (fn @onUpdateKey item.id)}}
          />
          <input
            class="kv-value"
            type="text"
            value={{item.value}}
            placeholder="Value"
            {{on "input" (fn @onUpdateValue item.id)}}
          />
          <button
            class="kv-remove"
            type="button"
            {{on "click" (fn @onRemove item.id)}}
          >×</button>
        </div>
      {{/each}}
      <button class="kv-add" type="button" {{on "click" @onAdd}}>
        + Add {{@placeholder}}
      </button>
    </div>
  </template>
}

// --- Template helpers ---

const methods = HTTP_METHODS;

function eq(a: unknown, b: unknown): boolean {
  return a === b;
}

function neq(a: unknown, b: unknown): boolean {
  return a !== b;
}

function gt(a: number, b: number): boolean {
  return a > b;
}

function methodColorFor(method: string): string {
  return METHOD_COLORS[method as HttpMethod] ?? "#8888aa";
}

function bodyLang(bodyType: string): string {
  if (bodyType === "json") return "json";
  if (bodyType === "form") return "text";
  return "text";
}
