import Component from "@glimmer/component";
import { inject as service } from "@ember/service";
import { fn } from "@ember/helper";
import { on } from "@ember/modifier";
import { modifier } from "ember-modifier";
import type MessageStoreService from "harbor-chat/services/message-store";
import type WorkspaceStoreService from "harbor-chat/services/workspace-store";
import type { Channel, Message } from "harbor-chat/harbor-chat/types";
import MessageComposer from "./message-composer";

interface ThreadPanelSignature {
  Args: {
    channelId: string;
    channel: Channel;
  };
}

export default class ThreadPanel extends Component<ThreadPanelSignature> {
  @service declare messageStore: MessageStoreService;
  @service declare workspaceStore: WorkspaceStoreService;

  scrollToBottom = modifier((element: HTMLElement) => {
    const observer = new MutationObserver(() => {
      element.scrollTop = element.scrollHeight;
    });
    observer.observe(element, { childList: true, subtree: true });
    element.scrollTop = element.scrollHeight;
    return () => observer.disconnect();
  });

  get activeThreadId(): string | null {
    return this.messageStore.activeThreadId;
  }

  get threadRoot(): Message | undefined {
    if (!this.activeThreadId) return undefined;
    return this.messageStore.threadRootMessage(this.activeThreadId);
  }

  get threadReplies(): Message[] {
    if (!this.activeThreadId) return [];
    return this.messageStore.messagesForThread(this.activeThreadId);
  }

  formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  authorName = (authorId: string): string => {
    return this.workspaceStore.getUserById(authorId)?.displayName ?? "Unknown";
  };

  authorInitial = (authorId: string): string => {
    return this.authorName(authorId).charAt(0).toUpperCase();
  };

  authorStatus = (authorId: string): string => {
    return this.workspaceStore.getUserById(authorId)?.status ?? "offline";
  };

  reactionEntries = (reactions: Record<string, string[]>): Array<{ emoji: string; users: string[] }> => {
    return Object.entries(reactions).map(([emoji, users]) => ({
      emoji,
      users,
    }));
  };

  hasReactions = (reactions: Record<string, string[]>): boolean => {
    return Object.keys(reactions).length > 0;
  };

  hasReacted = (users: string[]): boolean => {
    return users.includes(this.workspaceStore.currentUserId);
  };

  handleReaction = (messageId: string, emoji: string) => {
    this.messageStore.toggleReaction(messageId, emoji, true);
  };

  closeThread = () => {
    this.messageStore.closeThread();
  };

  <template>
    {{#if this.activeThreadId}}
      <aside class="thread-panel">
        <div class="thread-header">
          <h3>Thread</h3>
          <button class="close-btn" {{on "click" this.closeThread}}>&times;</button>
        </div>

        <div class="thread-messages" {{this.scrollToBottom}}>
          {{#if this.threadRoot}}
            <div class="message thread-root">
              <div class="message-avatar status-{{this.authorStatus this.threadRoot.authorId}}">
                {{this.authorInitial this.threadRoot.authorId}}
              </div>
              <div class="message-body">
                <div class="message-header">
                  <span class="message-author">{{this.authorName this.threadRoot.authorId}}</span>
                  <span class="message-time">{{this.formatTime this.threadRoot.timestamp}}</span>
                </div>
                <div class="message-content">{{this.threadRoot.content}}</div>
              </div>
            </div>
            <div class="thread-divider">
              <span>{{this.threadReplies.length}} replies</span>
            </div>
          {{/if}}

          {{#each this.threadReplies as |msg|}}
            <div class="message">
              <div class="message-avatar status-{{this.authorStatus msg.authorId}}">
                {{this.authorInitial msg.authorId}}
              </div>
              <div class="message-body">
                <div class="message-header">
                  <span class="message-author">{{this.authorName msg.authorId}}</span>
                  <span class="message-time">{{this.formatTime msg.timestamp}}</span>
                </div>
                <div class="message-content">{{msg.content}}</div>
                {{#if (this.hasReactions msg.reactions)}}
                  <div class="message-reactions">
                    {{#each (this.reactionEntries msg.reactions) as |reaction|}}
                      <button
                        class="reaction-chip {{if (this.hasReacted reaction.users) 'reacted'}}"
                        {{on "click" (fn this.handleReaction msg.id reaction.emoji)}}
                      >
                        {{reaction.emoji}} {{reaction.users.length}}
                      </button>
                    {{/each}}
                  </div>
                {{/if}}
              </div>
            </div>
          {{/each}}
        </div>

        <MessageComposer
          @channel={{@channel}}
          @threadId={{this.activeThreadId}}
          @placeholder="Reply..."
          @buttonLabel="Reply"
        />
      </aside>
    {{/if}}
  </template>
}
