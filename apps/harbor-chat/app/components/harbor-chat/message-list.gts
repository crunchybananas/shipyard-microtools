import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { inject as service } from "@ember/service";
import { fn } from "@ember/helper";
import { on } from "@ember/modifier";
import { modifier } from "ember-modifier";
import type MessageStoreService from "harbor-chat/services/message-store";
import type WorkspaceStoreService from "harbor-chat/services/workspace-store";
import type PresenceService from "harbor-chat/services/presence-service";
import type { Channel, Message } from "harbor-chat/harbor-chat/types";
import { renderMarkdown, extractImageUrls } from "harbor-chat/harbor-chat/markdown";
import EmojiPicker from "./emoji-picker";
import MessageCard from "./message-card";

interface MessageListSignature {
  Args: {
    channel: Channel;
  };
}

export default class MessageList extends Component<MessageListSignature> {
  @service declare messageStore: MessageStoreService;
  @service declare workspaceStore: WorkspaceStoreService;
  @service declare presenceService: PresenceService;

  @tracked emojiPickerMessageId: string | null = null;

  scrollToBottom = modifier((element: HTMLElement) => {
    const observer = new MutationObserver(() => {
      element.scrollTop = element.scrollHeight;
    });
    observer.observe(element, { childList: true, subtree: true });
    element.scrollTop = element.scrollHeight;
    return () => observer.disconnect();
  });

  get messages(): Message[] {
    return this.messageStore.messagesForChannel(this.args.channel.id);
  }

  get typingUsers(): string[] {
    const userIds = this.messageStore.typingUsersForChannel(
      this.args.channel.id,
    );
    return userIds
      .map((id) => this.workspaceStore.getUserById(id)?.displayName ?? "")
      .filter(Boolean);
  }

  formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return "Today";
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString([], {
      weekday: "long",
      month: "long",
      day: "numeric",
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

  isNewDay = (msg: Message, index: number): boolean => {
    if (index === 0) return true;
    const prev = this.messages[index - 1];
    if (!prev) return true;
    return (
      new Date(msg.timestamp).toDateString() !==
      new Date(prev.timestamp).toDateString()
    );
  };

  /**
   * Message grouping: if same author as previous message
   * and within 5 minutes, collapse the avatar/name.
   */
  isGrouped = (msg: Message, index: number): boolean => {
    if (index === 0) return false;
    const prev = this.messages[index - 1];
    if (!prev) return false;
    if (prev.authorId !== msg.authorId) return false;
    if (msg.timestamp - prev.timestamp > 5 * 60 * 1000) return false;
    if (this.isNewDay(msg, index)) return false;
    return true;
  };

  messageHtml = (content: string): string => {
    return renderMarkdown(content);
  };

  messageImages = (content: string): string[] => {
    return extractImageUrls(content);
  };

  hasImages = (content: string): boolean => {
    return extractImageUrls(content).length > 0;
  };

  isDeleted = (msg: Message): boolean => {
    return msg.deleted === true;
  };

  isStructured = (msg: Message): boolean => {
    return !!msg.messageType && msg.messageType !== "text";
  };

  isBot = (authorId: string): boolean => {
    const user = this.workspaceStore.getUserById(authorId);
    return user?.isBot === true;
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
    this.messageStore.toggleReaction(messageId, emoji);
    this.emojiPickerMessageId = null;
  };

  toggleEmojiPicker = (messageId: string) => {
    this.emojiPickerMessageId =
      this.emojiPickerMessageId === messageId ? null : messageId;
  };

  closeEmojiPicker = () => {
    this.emojiPickerMessageId = null;
  };

  isEmojiOpen = (messageId: string): boolean => {
    return this.emojiPickerMessageId === messageId;
  };

  openThread = async (messageId: string) => {
    const threadId = await this.messageStore.openThreadForMessage(messageId);
    this.messageStore.activeThreadId = threadId;
  };

  viewProfile = (userId: string) => {
    this.presenceService.viewUserProfile(userId);
  };

  <template>
    <div class="message-list" {{this.scrollToBottom}}>
      {{#if this.messages.length}}
        {{#each this.messages as |msg index|}}
          {{#if (this.isNewDay msg index)}}
            <div class="date-divider">
              <span>{{this.formatDate msg.timestamp}}</span>
            </div>
          {{/if}}

          {{#if (this.isDeleted msg)}}
            <div class="message message-deleted">
              <div class="message-deleted-text">This message was deleted</div>
            </div>
          {{else if (this.isGrouped msg index)}}
            <div class="message message-grouped">
              <span class="grouped-time">{{this.formatTime msg.timestamp}}</span>
              <div class="message-body">
                <div class="message-content">{{{this.messageHtml msg.content}}}</div>
                {{#if (this.hasImages msg.content)}}
                  <div class="message-images">
                    {{#each (this.messageImages msg.content) as |imgUrl|}}
                      <img class="message-image-preview" src={{imgUrl}} alt="shared image" loading="lazy" />
                    {{/each}}
                  </div>
                {{/if}}
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
                <div class="message-actions">
                  <button class="action-btn" title="Reply in thread" {{on "click" (fn this.openThread msg.id)}}>
                    💬 {{if msg.replyCount msg.replyCount ""}}
                  </button>
                  <button class="action-btn" title="React" {{on "click" (fn this.toggleEmojiPicker msg.id)}}>
                    😀
                  </button>
                  {{#if (this.isEmojiOpen msg.id)}}
                    <EmojiPicker
                      @onSelect={{fn this.handleReaction msg.id}}
                      @onClose={{this.closeEmojiPicker}}
                    />
                  {{/if}}
                </div>
              </div>
            </div>
          {{else}}
            <div class="message">
              <button class="message-avatar status-{{this.authorStatus msg.authorId}}" {{on "click" (fn this.viewProfile msg.authorId)}}>
                {{this.authorInitial msg.authorId}}
              </button>
              <div class="message-body">
                <div class="message-header">
                  <button class="message-author" {{on "click" (fn this.viewProfile msg.authorId)}}>
                    {{this.authorName msg.authorId}}
                  </button>
                  <span class="message-time">{{this.formatTime msg.timestamp}}</span>
                  {{#if msg.encrypted}}
                    <span class="encrypted-icon" title="Encrypted">🔒</span>
                  {{/if}}
                  {{#if (this.isBot msg.authorId)}}
                    <span class="bot-badge">🤖 BOT</span>
                  {{/if}}
                  {{#if msg.editedAt}}
                    <span class="edited-label">(edited)</span>
                  {{/if}}
                </div>
                {{#if (this.isStructured msg)}}
                  <MessageCard @message={{msg}} />
                {{else}}
                  <div class="message-content">{{{this.messageHtml msg.content}}}</div>
                {{/if}}
                {{#if (this.hasImages msg.content)}}
                  <div class="message-images">
                    {{#each (this.messageImages msg.content) as |imgUrl|}}
                      <img class="message-image-preview" src={{imgUrl}} alt="shared image" loading="lazy" />
                    {{/each}}
                  </div>
                {{/if}}
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
                <div class="message-actions">
                  <button class="action-btn" title="Reply in thread" {{on "click" (fn this.openThread msg.id)}}>
                    💬 {{if msg.replyCount msg.replyCount ""}}
                  </button>
                  <button class="action-btn" title="React" {{on "click" (fn this.toggleEmojiPicker msg.id)}}>
                    😀
                  </button>
                  {{#if (this.isEmojiOpen msg.id)}}
                    <EmojiPicker
                      @onSelect={{fn this.handleReaction msg.id}}
                      @onClose={{this.closeEmojiPicker}}
                    />
                  {{/if}}
                </div>
              </div>
            </div>
          {{/if}}
        {{/each}}
      {{else}}
        <div class="empty-channel">
          <div class="empty-channel-icon">💬</div>
          <h3>No messages yet</h3>
          <p>Be the first to send a message in this channel.</p>
        </div>
      {{/if}}

      {{#if this.typingUsers.length}}
        <div class="typing-indicator">
          <span class="typing-dots">
            <span></span><span></span><span></span>
          </span>
          {{#each this.typingUsers as |name|}}
            <span class="typing-user">{{name}}</span>
          {{/each}}
          is typing...
        </div>
      {{/if}}
    </div>
  </template>
}
