import Component from "@glimmer/component";
import { on } from "@ember/modifier";
import { fn } from "@ember/helper";
import { service } from "@ember/service";
import { modifier } from "ember-modifier";

import type { NodeTypeRef, FlowNode } from "flowforge/types/flow";
import type { NodeTypeDefinition } from "flowforge/types/node-types";
import type FlowEngineService from "flowforge/services/flow-engine";

export interface SidebarSignature {
  Element: HTMLDivElement;
  Args: {
    nodeTypes: NodeTypeRef[];
    selectedNode: FlowNode | null;
    onAddNode: (typeId: string, x: number, y: number) => void;
    onFieldChange: (nodeId: string, fieldName: string, value: string) => void;
  };
}

// Modifier to sync input value without losing focus
const syncValue = modifier((element: HTMLInputElement | HTMLTextAreaElement, [value]: [string]) => {
  // Only update if the element is not focused (user isn't typing)
  if (document.activeElement !== element && element.value !== value) {
    element.value = value ?? "";
  }
});

export default class Sidebar extends Component<SidebarSignature> {
  @service declare flowEngine: FlowEngineService;

  handleDragStart = (typeId: string, event: DragEvent) => {
    event.dataTransfer?.setData("nodeType", typeId);
  };

  handleFieldInput = (fieldName: string, event: Event) => {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    if (this.args.selectedNode) {
      this.args.onFieldChange(this.args.selectedNode.id, fieldName, target.value);
    }
  };

  get selectedNodeDef(): NodeTypeDefinition | null {
    if (!this.args.selectedNode) return null;
    return this.flowEngine.getNodeType(this.args.selectedNode.type) ?? null;
  }

  get groupedNodeTypes() {
    const groups: Record<string, NodeTypeRef[]> = {
      input: [],
      transform: [],
      logic: [],
      output: [],
    };
    for (const nt of this.args.nodeTypes) {
      groups[nt.category]?.push(nt);
    }
    return groups;
  }

  <template>
    <div class="sidebar" ...attributes>
      <div class="sidebar-section">
        <h3 class="section-title">Nodes</h3>
        <div class="node-palette">
          {{#each-in this.groupedNodeTypes as |category nodes|}}
            <div class="category-group">
              <span class="category-label">{{category}}</span>
              <div class="palette-nodes">
                {{#each nodes as |nodeType|}}
                  <div
                    class="palette-node"
                    draggable="true"
                    {{on "dragstart" (fn this.handleDragStart nodeType.id)}}
                  >
                    <span class="node-label">{{nodeType.title}}</span>
                  </div>
                {{/each}}
              </div>
            </div>
          {{/each-in}}
        </div>
      </div>

      {{#if @selectedNode}}
        <div class="sidebar-section">
          <h3 class="section-title">Properties</h3>
          <div class="properties-panel">
            <div class="property-row">
              <label>Type</label>
              <span class="property-value">
                {{#if this.selectedNodeDef}}
                  {{this.selectedNodeDef.icon}} {{this.selectedNodeDef.title}}
                {{else}}
                  {{@selectedNode.type}}
                {{/if}}
              </span>
            </div>

            {{#if this.selectedNodeDef}}
              {{#each this.selectedNodeDef.fields as |field|}}
                <div class="property-row">
                  <label>{{field.name}}</label>
                  {{#if (eq field.type "textarea")}}
                    <textarea
                      class="field-input field-textarea"
                      placeholder={{field.placeholder}}
                      {{syncValue (get @selectedNode.fields field.name)}}
                      {{on "input" (fn this.handleFieldInput field.name)}}
                    ></textarea>
                  {{else if (eq field.type "select")}}
                    <select
                      class="field-input field-select"
                      {{on "change" (fn this.handleFieldInput field.name)}}
                    >
                      {{#each field.options as |opt|}}
                        <option
                          value={{opt}}
                          selected={{eq opt (get @selectedNode.fields field.name)}}
                        >
                          {{opt}}
                        </option>
                      {{/each}}
                    </select>
                  {{else}}
                    <input
                      type={{if (eq field.type "number") "number" "text"}}
                      class="field-input"
                      placeholder={{field.placeholder}}
                      {{syncValue (get @selectedNode.fields field.name)}}
                      {{on "input" (fn this.handleFieldInput field.name)}}
                    />
                  {{/if}}
                </div>
              {{/each}}
            {{/if}}

            <div class="property-row">
              <label>ID</label>
              <span class="property-value id">{{@selectedNode.id}}</span>
            </div>
          </div>
        </div>
      {{/if}}
    </div>

  </template>
}

function eq(a: unknown, b: unknown): boolean {
  return a === b;
}

function get<T extends Record<string, unknown>, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
