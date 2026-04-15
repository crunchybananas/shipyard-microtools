import Service from "@ember/service";
import { inject as service } from "@ember/service";
import { tracked } from "@glimmer/tracking";
import type { Message, Thread } from "harbor-chat/harbor-chat/types";
import type WorkspaceStoreService from "./workspace-store";
import { generateId } from "harbor-chat/harbor-chat/mock-data";
import {
  subscribeToMessages,
  sendMessage as fsSendMessage,
  toggleReaction as fsToggleReaction,
  subscribeToThreadMessages,
  sendThreadReply as fsSendThreadReply,
  getOrCreateThread,
  subscribeToTyping,
  setTyping,
  updateLastRead,
  getUnreadCounts,
  editMessage as fsEditMessage,
  deleteMessage as fsDeleteMessage,
  pinMessage as fsPinMessage,
} from "harbor-chat/utils/firestore-adapter";

/**
 * Manages messages, threads, typing indicators, and unread state.
 * All data flows through Firestore onSnapshot for real-time updates.
 */
export default class MessageStoreService extends Service {
  @service declare workspaceStore: WorkspaceStoreService;

  @tracked messages: Message[] = [];
  @tracked threads: Thread[] = [];
  @tracked threadMessages: Message[] = [];
  @tracked typingUserIds: string[] = [];
  @tracked unreadCounts: Record<string, number> = {};
  @tracked activeThreadId: string | null = null;

  private _channelUnsub: (() => void) | null = null;
  private _threadUnsub: (() => void) | null = null;
  private _typingUnsub: (() => void) | null = null;
  private _activeChannelId: string | null = null;
  private _typingTimeout: ReturnType<typeof setTimeout> | null = null;
  private _isTyping = false;

  get useMock(): boolean {
    return this.workspaceStore.useMock;
  }

  willDestroy(): void {
    super.willDestroy();
    this._channelUnsub?.();
    this._threadUnsub?.();
    this._typingUnsub?.();
  }

  /**
   * Subscribe to real-time messages for a channel.
   * Called when the channel route activates.
   */
  subscribeChannel(channelId: string): void {
    if (this._activeChannelId === channelId) return;

    // Tear down previous
    this._channelUnsub?.();
    this._typingUnsub?.();
    this._clearTyping();
    this._activeChannelId = channelId;

    if (this.useMock) return;

    this._channelUnsub = subscribeToMessages(channelId, (msgs) => {
      // Replace messages for this channel, keep others
      this.messages = [
        ...this.messages.filter((m) => m.channelId !== channelId),
        ...msgs,
      ];
    });

    this._typingUnsub = subscribeToTyping(channelId, (userIds) => {
      // Filter out self
      this.typingUserIds = userIds.filter(
        (id) => id !== this.workspaceStore.currentUserId,
      );
    });
  }

  /**
   * Load unread counts for all channels the user is in.
   */
  async loadUnreadCounts(channelIds: string[]): Promise<void> {
    if (this.useMock) return;
    const uid = this.workspaceStore.currentUserId;
    if (!uid) return;
    const counts = await getUnreadCounts(channelIds, uid);
    this.unreadCounts = counts;
  }

  closeThread(): void {
    this._threadUnsub?.();
    this._threadUnsub = null;
    this.activeThreadId = null;
  }

  messagesForChannel(channelId: string): Message[] {
    return this.messages
      .filter((m) => m.channelId === channelId && !m.threadId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  messagesForThread(threadId: string): Message[] {
    return this.threadMessages
      .filter((m) => m.threadId === threadId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  threadRootMessage(threadId: string): Message | undefined {
    const thread = this.threads.find((t) => t.id === threadId);
    if (!thread) return undefined;
    return this.messages.find((m) => m.id === thread.rootMessageId);
  }

  typingUsersForChannel(channelId: string): string[] {
    if (this._activeChannelId !== channelId) return [];
    return this.typingUserIds;
  }

  unreadCount(channelId: string): number {
    return this.unreadCounts[channelId] ?? 0;
  }

  markRead(channelId: string): void {
    // Update local state immediately
    const counts = { ...this.unreadCounts };
    delete counts[channelId];
    this.unreadCounts = counts;

    // Persist to Firestore
    if (!this.useMock) {
      const uid = this.workspaceStore.currentUserId;
      if (uid) {
        updateLastRead(channelId, uid);
      }
    }
  }

  // ---- Typing indicators ----

  /**
   * Called from the composer on keypress. Debounced — sets typing
   * in Firestore, auto-clears after 3 seconds of inactivity.
   */
  notifyTyping(channelId: string): void {
    if (this.useMock) return;
    const uid = this.workspaceStore.currentUserId;
    if (!uid) return;

    if (!this._isTyping) {
      this._isTyping = true;
      setTyping(channelId, uid, true);
    }

    // Reset the clear timer
    if (this._typingTimeout) clearTimeout(this._typingTimeout);
    this._typingTimeout = setTimeout(() => {
      this._clearTyping();
    }, 3000);
  }

  /**
   * Called on send or blur to immediately clear typing.
   */
  clearTyping(channelId: string): void {
    if (this.useMock || !this._isTyping) return;
    const uid = this.workspaceStore.currentUserId;
    if (!uid) return;
    this._clearTyping();
    setTyping(channelId, uid, false);
  }

  private _clearTyping(): void {
    this._isTyping = false;
    if (this._typingTimeout) {
      clearTimeout(this._typingTimeout);
      this._typingTimeout = null;
    }
  }

  // ---- Send messages ----

  async sendMessage(
    channelId: string,
    content: string,
    threadId?: string,
  ): Promise<void> {
    const channel = this.workspaceStore.getChannelById(channelId);
    const currentUserId = this.workspaceStore.currentUserId;

    // Clear typing indicator on send
    this.clearTyping(channelId);

    if (!this.useMock) {
      try {
        if (threadId) {
          await fsSendThreadReply(channelId, threadId, {
            authorId: currentUserId,
            content,
            encrypted: channel?.isPrivate ?? false,
          });
        } else {
          await fsSendMessage(channelId, {
            authorId: currentUserId,
            content,
            encrypted: channel?.isPrivate ?? false,
          });
        }
      } catch (e) {
        console.error("Failed to send message:", e);
      }
      // onSnapshot will deliver the message back to us
      return;
    }

    // Mock fallback (local dev only)
    const newMsg: Message = {
      id: `m-${generateId()}`,
      channelId,
      authorId: currentUserId,
      content,
      timestamp: Date.now(),
      replyCount: 0,
      reactions: {},
      attachments: [],
      encrypted: channel?.isPrivate ?? false,
      threadId,
    };

    if (threadId) {
      this.threadMessages = [...this.threadMessages, newMsg];
    } else {
      this.messages = [...this.messages, newMsg];
    }
  }

  async openThreadForMessage(messageId: string): Promise<string | null> {
    const channelId = this._activeChannelId;
    if (!channelId) return null;

    if (!this.useMock) {
      const threadId = await getOrCreateThread(
        channelId,
        messageId,
        this.workspaceStore.currentUserId,
      );

      // Track thread locally so threadRootMessage() works
      const existingThread = this.threads.find((t) => t.id === threadId);
      if (!existingThread) {
        this.threads = [
          ...this.threads,
          {
            id: threadId,
            channelId,
            rootMessageId: messageId,
            participantIds: [this.workspaceStore.currentUserId],
            lastReplyAt: Date.now(),
            replyCount: 0,
          },
        ];
      }

      // Subscribe to thread messages
      this._threadUnsub?.();
      this._threadUnsub = subscribeToThreadMessages(
        channelId,
        threadId,
        (msgs) => {
          this.threadMessages = [
            ...this.threadMessages.filter((m) => m.threadId !== threadId),
            ...msgs,
          ];
        },
      );

      return threadId;
    }

    // Mock fallback
    let thread = this.threads.find((t) => t.rootMessageId === messageId);
    if (!thread) {
      thread = {
        id: `t-${generateId()}`,
        channelId,
        rootMessageId: messageId,
        participantIds: [this.workspaceStore.currentUserId],
        lastReplyAt: Date.now(),
        replyCount: 0,
      };
      this.threads = [...this.threads, thread];
    }
    return thread.id;
  }

  toggleReaction(messageId: string, emoji: string, inThread = false): void {
    const currentUserId = this.workspaceStore.currentUserId;

    if (!this.useMock && this._activeChannelId) {
      const msg = inThread
        ? this.threadMessages.find((m) => m.id === messageId)
        : this.messages.find((m) => m.id === messageId);
      const hasReacted =
        msg?.reactions[emoji]?.includes(currentUserId) ?? false;

      // Optimistic update
      const updateMsg = (m: Message): Message => {
        if (m.id !== messageId) return m;
        const reactions = { ...m.reactions };
        const users = reactions[emoji] ? [...reactions[emoji]] : [];
        if (hasReacted) {
          const idx = users.indexOf(currentUserId);
          if (idx >= 0) users.splice(idx, 1);
          if (users.length === 0) delete reactions[emoji];
          else reactions[emoji] = users;
        } else {
          reactions[emoji] = [...users, currentUserId];
        }
        return { ...m, reactions };
      };

      if (inThread) {
        this.threadMessages = this.threadMessages.map(updateMsg);
      } else {
        this.messages = this.messages.map(updateMsg);
      }

      // Write to Firestore (onSnapshot will confirm)
      fsToggleReaction(
        this._activeChannelId,
        messageId,
        emoji,
        currentUserId,
        !hasReacted,
      );
      return;
    }

    // Mock fallback
    const updateMsg = (m: Message): Message => {
      if (m.id !== messageId) return m;
      const reactions = { ...m.reactions };
      const users = reactions[emoji] ? [...reactions[emoji]] : [];
      const idx = users.indexOf(currentUserId);
      if (idx >= 0) {
        users.splice(idx, 1);
        if (users.length === 0) delete reactions[emoji];
        else reactions[emoji] = users;
      } else {
        reactions[emoji] = [...users, currentUserId];
      }
      return { ...m, reactions };
    };

    if (inThread) {
      this.threadMessages = this.threadMessages.map(updateMsg);
    } else {
      this.messages = this.messages.map(updateMsg);
    }
  }

  // ---- Edit / Delete / Pin ----

  async editMessage(messageId: string, newContent: string): Promise<void> {
    const channelId = this._activeChannelId;
    if (!channelId) return;

    if (!this.useMock) {
      // Optimistic update
      this.messages = this.messages.map((m) =>
        m.id === messageId
          ? { ...m, content: newContent, editedAt: Date.now() }
          : m,
      );
      try { await fsEditMessage(channelId, messageId, newContent); } catch (e) { console.error("Edit failed:", e); }
      return;
    }

    this.messages = this.messages.map((m) =>
      m.id === messageId
        ? { ...m, content: newContent, editedAt: Date.now() }
        : m,
    );
  }

  async deleteMessage(messageId: string): Promise<void> {
    const channelId = this._activeChannelId;
    if (!channelId) return;

    if (!this.useMock) {
      // Optimistic update
      this.messages = this.messages.map((m) =>
        m.id === messageId
          ? { ...m, content: "", deleted: true } as Message & { deleted: boolean }
          : m,
      );
      try { await fsDeleteMessage(channelId, messageId); } catch (e) { console.error("Delete failed:", e); }
      return;
    }

    this.messages = this.messages.filter((m) => m.id !== messageId);
  }

  async pinMessage(messageId: string, pinned: boolean): Promise<void> {
    const channelId = this._activeChannelId;
    if (!channelId) return;

    if (!this.useMock) {
      this.messages = this.messages.map((m) =>
        m.id === messageId ? { ...m, pinned } as Message & { pinned: boolean } : m,
      );
      try { await fsPinMessage(channelId, messageId, pinned); } catch (e) { console.error("Pin failed:", e); }
      return;
    }

    this.messages = this.messages.map((m) =>
      m.id === messageId ? { ...m, pinned } as Message & { pinned: boolean } : m,
    );
  }

  isOwnMessage(messageId: string): boolean {
    const msg = this.messages.find((m) => m.id === messageId);
    return msg?.authorId === this.workspaceStore.currentUserId;
  }
}
