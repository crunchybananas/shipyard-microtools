import Component from "@glimmer/component";
import { on } from "@ember/modifier";
import { fn } from "@ember/helper";

import type { RequestTab } from "harbor-api/types/api";
import { METHOD_COLORS } from "harbor-api/types/api";

export interface TabBarSignature {
  Element: HTMLDivElement;
  Args: {
    tabs: RequestTab[];
    activeTabId: string;
    onSelect: (tabId: string) => void;
    onClose: (tabId: string) => void;
    onAdd: () => void;
  };
}

export default class TabBar extends Component<TabBarSignature> {
  get canClose(): boolean {
    return this.args.tabs.length > 1;
  }

  <template>
    <div class="tab-bar" ...attributes>
      <div class="tabs-scroll">
        {{#each @tabs as |tab|}}
          <button
            class="tab {{if (eq tab.id @activeTabId) 'active'}}"
            type="button"
            {{on "click" (fn @onSelect tab.id)}}
          >
            <span
              class="tab-method"
              style="color: {{methodColor tab.method}}"
            >{{tab.method}}</span>
            <span class="tab-name">{{truncate tab.url 30}}</span>
            {{#if this.canClose}}
              <button
                class="tab-close"
                type="button"
                {{on "click" (fn @onClose tab.id)}}
              >×</button>
            {{/if}}
          </button>
        {{/each}}
      </div>
      <button class="tab-add" type="button" {{on "click" @onAdd}}>
        + New
      </button>
    </div>
  </template>
}

function eq(a: unknown, b: unknown): boolean {
  return a === b;
}

function methodColor(method: string): string {
  return METHOD_COLORS[method as keyof typeof METHOD_COLORS] ?? "#8888aa";
}

function truncate(str: string, len: number): string {
  if (!str) return "Untitled";
  // Remove protocol for display
  const clean = str.replace(/^https?:\/\//, "");
  if (clean.length <= len) return clean;
  return clean.slice(0, len) + "…";
}
