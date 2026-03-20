import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import { fn } from "@ember/helper";
import { inject as service } from "@ember/service";
import type DesignStoreService from "atelier/services/design-store";
import type AiServiceService from "atelier/services/ai-service";
import type { DesignElement } from "atelier/services/design-store";
import type { ConversationMessage } from "atelier/services/ai-service";
import {
  IconRect,
  IconEllipse,
  IconText,
  IconLine,
  IconFrame,
  IconEye,
  IconEyeOff,
  IconLayers,
  IconSparkles,
} from "atelier/components/atelier/icons";

export default class AtelierLayersPanel extends Component {
  @service declare designStore: DesignStoreService;
  @service declare aiService: AiServiceService;

  @tracked showLayersView: boolean = true;
  @tracked editingLayerId: string | null = null;

  get reversedElements(): DesignElement[] {
    return [...this.designStore.elements].reverse();
  }

  // ---- Layers/Chat toggle ----

  toggleLayersView = () => {
    this.showLayersView = true;
    this.aiService.showConversation = false;
  };

  toggleChatView = () => {
    this.showLayersView = false;
    this.aiService.showConversation = true;
  };

  // ---- Layer interactions ----

  onLayerClick = (id: string, e: MouseEvent) => {
    this.designStore.selectElement(id, e.shiftKey);
  };

  onLayerDoubleClick = (id: string) => {
    this.editingLayerId = id;
  };

  onLayerNameChange = (id: string, e: Event) => {
    const name = (e.target as HTMLInputElement).value;
    this.designStore.updateElement(id, { name });
    this.editingLayerId = null;
  };

  onLayerNameKeydown = (id: string, e: KeyboardEvent) => {
    if (e.key === "Enter") {
      this.onLayerNameChange(id, e);
    } else if (e.key === "Escape") {
      this.editingLayerId = null;
    }
  };

  toggleVisibility = (id: string, e: MouseEvent) => {
    e.stopPropagation();
    const el = this.designStore.elements.find((el) => el.id === id);
    if (el) {
      this.designStore.updateElement(id, { visible: !el.visible });
    }
  };

  // ---- Helpers ----

  isSelected = (id: string): boolean => {
    return this.designStore.selectedIds.includes(id);
  };

  isHovered = (id: string): boolean => {
    return this.designStore.hoveredElementId === id;
  };

  isEditing = (id: string): boolean => {
    return this.editingLayerId === id;
  };

  isType = (el: DesignElement, type: string): boolean => {
    return el.type === type;
  };

  isUserMessage = (msg: ConversationMessage): boolean => {
    return msg.role === "user";
  };

  formatTimestamp = (date: Date): string => {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  <template>
    <div class="layers-panel">
      <div class="panel-header">
        <div class="panel-tabs">
          <button
            class="panel-tab {{if this.showLayersView 'active'}}"
            type="button"
            {{on "click" this.toggleLayersView}}
          >Layers</button>
          <button
            class="panel-tab {{unless this.showLayersView 'active'}}"
            type="button"
            {{on "click" this.toggleChatView}}
          >AI Chat</button>
        </div>
        <div class="panel-actions">
          {{#if this.showLayersView}}
            <button class="panel-action-btn" type="button" title="Select All" {{on "click" this.designStore.selectAll}}>
              <IconLayers />
            </button>
          {{/if}}
        </div>
      </div>

      {{#if this.showLayersView}}
        <div class="layers-list">
          {{#if this.designStore.elements.length}}
            {{#each this.reversedElements as |el|}}
              <div
                class="layer-item
                  {{if (this.isSelected el.id) 'selected'}}
                  {{if (this.isHovered el.id) 'hovered'}}"
                role="button"
                {{on "click" (fn this.onLayerClick el.id)}}
                {{on "dblclick" (fn this.onLayerDoubleClick el.id)}}
              >
                <span class="layer-icon">
                  {{#if (this.isType el "rectangle")}}
                    <IconRect />
                  {{else if (this.isType el "ellipse")}}
                    <IconEllipse />
                  {{else if (this.isType el "text")}}
                    <IconText />
                  {{else if (this.isType el "line")}}
                    <IconLine />
                  {{else if (this.isType el "frame")}}
                    <IconFrame />
                  {{else}}
                    <IconRect />
                  {{/if}}
                </span>

                {{#if (this.isEditing el.id)}}
                  <input
                    class="layer-name-input"
                    type="text"
                    value={{el.name}}
                    {{on "change" (fn this.onLayerNameChange el.id)}}
                    {{on "keydown" (fn this.onLayerNameKeydown el.id)}}
                    {{on "blur" (fn this.onLayerNameChange el.id)}}
                  />
                {{else}}
                  <span class="layer-name">{{el.name}}</span>
                {{/if}}

                <button
                  class="layer-visibility {{unless el.visible 'hidden'}}"
                  type="button"
                  {{on "click" (fn this.toggleVisibility el.id)}}
                >
                  {{#if el.visible}}
                    <IconEye />
                  {{else}}
                    <IconEyeOff />
                  {{/if}}
                </button>
              </div>
            {{/each}}
          {{else}}
            <div class="layers-empty">
              <IconLayers />
              <span class="layers-empty-text">No layers yet.<br/>Draw something on the canvas<br/>or use AI Generate.</span>
            </div>
          {{/if}}
        </div>
      {{else}}
        {{! AI Conversation View }}
        <div class="chat-list">
          {{#if this.aiService.conversationHistory.length}}
            {{#each this.aiService.conversationHistory as |msg|}}
              <div class="chat-message {{if (this.isUserMessage msg) 'chat-user' 'chat-assistant'}}">
                <div class="chat-avatar">
                  {{#if (this.isUserMessage msg)}}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  {{else}}
                    <IconSparkles />
                  {{/if}}
                </div>
                <div class="chat-bubble">
                  <div class="chat-content">{{msg.content}}</div>
                  <div class="chat-time">{{this.formatTimestamp msg.timestamp}}</div>
                </div>
              </div>
            {{/each}}
          {{else}}
            <div class="chat-empty">
              <IconSparkles />
              <span class="chat-empty-text">No conversations yet.<br/>Generate a design with AI<br/>to start a conversation.</span>
            </div>
          {{/if}}
        </div>
      {{/if}}
    </div>
  </template>
}
