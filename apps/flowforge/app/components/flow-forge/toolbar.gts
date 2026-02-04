import Component from "@glimmer/component";
import { on } from "@ember/modifier";
import { fn } from "@ember/helper";

export interface ToolbarSignature {
  Element: HTMLDivElement;
  Args: {
    onRun: () => void;
    onClear: () => void;
    onLoadExample: (exampleId: string) => void;
    isRunning: boolean;
  };
}

export default class Toolbar extends Component<ToolbarSignature> {
  examples = [
    { id: "json-transform", label: "JSON Transform" },
    { id: "math-calc", label: "Math Calculator" },
    { id: "http-fetch", label: "HTTP Fetch" },
  ];

  <template>
    <div class="toolbar" ...attributes>
      <div class="toolbar-brand">
        <span class="brand-icon">⚡</span>
        <span class="brand-text">FlowForge</span>
      </div>

      <div class="toolbar-actions">
        <div class="dropdown">
          <button class="btn btn-secondary dropdown-trigger" type="button">
            Examples ▾
          </button>
          <div class="dropdown-menu">
            {{#each this.examples as |example|}}
              <button
                class="dropdown-item"
                type="button"
                {{on "click" (fn @onLoadExample example.id)}}
              >
                {{example.label}}
              </button>
            {{/each}}
          </div>
        </div>

        <button class="btn btn-secondary" type="button" {{on "click" @onClear}}>
          Clear
        </button>

        <button
          class="btn btn-primary {{if @isRunning 'running'}}"
          type="button"
          disabled={{@isRunning}}
          {{on "click" @onRun}}
        >
          {{#if @isRunning}}
            ⏳ Running...
          {{else}}
            ▶ Run
          {{/if}}
        </button>
      </div>
    </div>
  </template>
}
