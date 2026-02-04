import Component from "@glimmer/component";

export interface PreviewPanelSignature {
  Element: HTMLDivElement;
  Args: {
    outputs: Array<{ nodeId: string; data: unknown }>;
    selectedNode: { id: string; type: string } | null;
    selectedNodeTitle: string | null;
    executionResults: Map<
      string,
      { outputs?: Record<string, unknown>; error?: string }
    >;
  };
}

export default class PreviewPanel extends Component<PreviewPanelSignature> {
  formatValue = (value: unknown) => {
    if (value === undefined) return "undefined";
    if (value === null) return "null";
    if (typeof value === "string") return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  };

  get selectedResult() {
    if (!this.args.selectedNode) return null;
    return this.args.executionResults.get(this.args.selectedNode.id) ?? null;
  }

  get selectedOutputEntries() {
    const outputs = this.selectedResult?.outputs;
    if (!outputs) return [];
    return Object.entries(outputs)
      .filter(([key]) => !key.startsWith("_") && key !== "_display")
      .map(([key, value]) => ({ key, value }));
  }

  <template>
    <div class="preview-panel" ...attributes>
      <div class="preview-header">
        <span>DATA PREVIEW</span>
      </div>
      <div class="preview-content">
        {{#if @selectedNode}}
          <div class="preview-node-name">
            {{@selectedNodeTitle}}
          </div>
          {{#if this.selectedResult}}
            {{#if this.selectedResult.error}}
              <div class="preview-section">
                <div class="preview-label">Error</div>
                <pre class="preview-data">{{this.selectedResult.error}}</pre>
              </div>
            {{else if this.selectedResult.outputs._display}}
              <div class="preview-section">
                <div class="preview-label">Output</div>
                <pre class="preview-data">{{this.formatValue
                    this.selectedResult.outputs._display
                  }}</pre>
              </div>
            {{else}}
              {{#each this.selectedOutputEntries as |entry|}}
                <div class="preview-section">
                  <div class="preview-label">{{entry.key}}</div>
                  <pre class="preview-data">{{this.formatValue
                      entry.value
                    }}</pre>
                </div>
              {{/each}}
              {{#unless this.selectedOutputEntries.length}}
                <div class="preview-empty">Run the flow to see output</div>
              {{/unless}}
            {{/if}}
          {{else}}
            <div class="preview-empty">Run the flow to see output</div>
          {{/if}}
        {{else if @outputs.length}}
          {{#each @outputs as |output|}}
            <div class="preview-section">
              <div class="preview-node-name">{{output.nodeId}}</div>
              <div class="preview-label">Output</div>
              <pre class="preview-data">{{this.formatValue output.data}}</pre>
            </div>
          {{/each}}
        {{else}}
          <div class="preview-empty">Run your flow to see outputs</div>
        {{/if}}
      </div>
    </div>
  </template>
}
