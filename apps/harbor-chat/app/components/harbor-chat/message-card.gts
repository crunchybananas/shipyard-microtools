import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { inject as service } from "@ember/service";
import { on } from "@ember/modifier";
import type MessageStoreService from "harbor-chat/services/message-store";
import type { Message, MessageMetadata } from "harbor-chat/harbor-chat/types";

interface MessageCardSignature {
  Args: {
    message: Message;
  };
}

/**
 * Renders structured message cards for agent-native messaging.
 * Each message type gets a specialized visual treatment.
 */
export default class MessageCard extends Component<MessageCardSignature> {
  @service declare messageStore: MessageStoreService;

  get meta(): MessageMetadata {
    return this.args.message.metadata ?? {};
  }

  get messageType(): string {
    return this.args.message.messageType ?? "text";
  }

  get isTask(): boolean {
    return this.messageType === "task";
  }

  get isCodeReview(): boolean {
    return this.messageType === "code-review";
  }

  get isDeploy(): boolean {
    return this.messageType === "deploy";
  }

  get isAlert(): boolean {
    return this.messageType === "alert";
  }

  get isAgentUpdate(): boolean {
    return this.messageType === "agent-update";
  }

  get isPrSummary(): boolean {
    return this.messageType === "pr-summary";
  }

  get taskStatusIcon(): string {
    const status = this.meta.taskStatus ?? "todo";
    const icons: Record<string, string> = {
      todo: "⬜",
      "in-progress": "🔄",
      done: "✅",
      blocked: "🚫",
    };
    return icons[status] ?? "⬜";
  }

  get deployStatusClass(): string {
    return `deploy-${this.meta.deployStatus ?? "pending"}`;
  }

  get alertClass(): string {
    return `alert-${this.meta.alertLevel ?? "info"}`;
  }

  get prStatusIcon(): string {
    const status = this.meta.prStatus ?? "open";
    const icons: Record<string, string> = {
      open: "🟢",
      merged: "🟣",
      closed: "🔴",
    };
    return icons[status] ?? "⚪";
  }

  toggleTaskStatus = () => {
    // Cycle through: todo → in-progress → done
    const current = this.meta.taskStatus ?? "todo";
    const next =
      current === "todo"
        ? "in-progress"
        : current === "in-progress"
          ? "done"
          : "todo";

    // Update via Firestore (optimistic)
    const msg = this.args.message;
    const newMeta = { ...this.meta, taskStatus: next };
    this.messageStore.editMessage(
      msg.id,
      JSON.stringify({ ...JSON.parse(msg.content || "{}"), taskStatus: next }),
    );
    // Local optimistic update happens via onSnapshot
  };

  <template>
    {{#if this.isTask}}
      <div class="msg-card msg-card-task">
        <div class="msg-card-header">
          <span class="msg-card-type-badge task">Task</span>
          {{#if this.meta.taskAssignee}}
            <span class="msg-card-assignee">→ {{this.meta.taskAssignee}}</span>
          {{/if}}
        </div>
        <div class="msg-card-body">
          <button class="task-status-btn" {{on "click" this.toggleTaskStatus}}>
            {{this.taskStatusIcon}}
          </button>
          <span class="task-title {{if this.isDone 'task-done'}}">
            {{this.meta.taskTitle}}
          </span>
        </div>
        {{#if this.meta.description}}
          <div class="msg-card-desc">{{this.meta.description}}</div>
        {{/if}}
      </div>

    {{else if this.isCodeReview}}
      <div class="msg-card msg-card-pr">
        <div class="msg-card-header">
          <span class="msg-card-type-badge pr">{{this.prStatusIcon}} Pull Request</span>
        </div>
        <div class="msg-card-body">
          {{#if this.meta.prUrl}}
            <a class="pr-title-link" href={{this.meta.prUrl}} target="_blank" rel="noopener noreferrer">
              {{this.meta.prTitle}}
            </a>
          {{else}}
            <span class="pr-title">{{this.meta.prTitle}}</span>
          {{/if}}
        </div>
        {{#if this.meta.filesChanged}}
          <div class="pr-stats">
            <span class="pr-files">{{this.meta.filesChanged}} files</span>
            {{#if this.meta.additions}}
              <span class="pr-additions">+{{this.meta.additions}}</span>
            {{/if}}
            {{#if this.meta.deletions}}
              <span class="pr-deletions">-{{this.meta.deletions}}</span>
            {{/if}}
          </div>
        {{/if}}
      </div>

    {{else if this.isDeploy}}
      <div class="msg-card msg-card-deploy {{this.deployStatusClass}}">
        <div class="msg-card-header">
          <span class="msg-card-type-badge deploy">Deploy</span>
          <span class="deploy-env">{{this.meta.deployEnv}}</span>
          <span class="deploy-status-pill">{{this.meta.deployStatus}}</span>
        </div>
        {{#if this.meta.deployCommit}}
          <div class="msg-card-body">
            <code class="deploy-commit">{{this.meta.deployCommit}}</code>
          </div>
        {{/if}}
        {{#if this.meta.deployUrl}}
          <div class="msg-card-footer">
            <a href={{this.meta.deployUrl}} target="_blank" rel="noopener noreferrer">View deploy →</a>
          </div>
        {{/if}}
      </div>

    {{else if this.isAlert}}
      <div class="msg-card msg-card-alert {{this.alertClass}}">
        <div class="msg-card-header">
          <span class="msg-card-type-badge alert">
            {{#if (this.isLevel "critical")}}🚨{{else if (this.isLevel "error")}}❌{{else if (this.isLevel "warning")}}⚠️{{else}}ℹ️{{/if}}
            {{this.meta.alertLevel}}
          </span>
        </div>
        {{#if this.meta.title}}
          <div class="alert-title">{{this.meta.title}}</div>
        {{/if}}
        {{#if this.meta.description}}
          <div class="msg-card-desc">{{this.meta.description}}</div>
        {{/if}}
      </div>

    {{else if this.isAgentUpdate}}
      <div class="msg-card msg-card-agent">
        <div class="msg-card-header">
          <span class="msg-card-type-badge agent">🤖 Agent Update</span>
        </div>
        {{#if this.meta.title}}
          <div class="agent-title">{{this.meta.title}}</div>
        {{/if}}
        {{#if this.meta.description}}
          <div class="msg-card-desc">{{this.meta.description}}</div>
        {{/if}}
        {{#if this.meta.url}}
          <div class="msg-card-footer">
            <a href={{this.meta.url}} target="_blank" rel="noopener noreferrer">View details →</a>
          </div>
        {{/if}}
      </div>
    {{/if}}
  </template>

  get isDone(): boolean {
    return this.meta.taskStatus === "done";
  }

  isLevel = (level: string): boolean => {
    return this.meta.alertLevel === level;
  };
}
