import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { inject as service } from "@ember/service";
import { fn } from "@ember/helper";
import { on } from "@ember/modifier";
import type MessageStoreService from "harbor-chat/services/message-store";
import type WorkspaceStoreService from "harbor-chat/services/workspace-store";
import type { Channel, User } from "harbor-chat/harbor-chat/types";
import {
  parseSlashCommand,
  matchSlashCommands,
  SLASH_COMMANDS,
  type SlashCommand,
} from "harbor-chat/harbor-chat/slash-commands";
import {
  sendMessage as fsSendMessage,
} from "harbor-chat/utils/firestore-adapter";

interface MessageComposerSignature {
  Args: {
    channel: Channel;
    threadId?: string;
    placeholder?: string;
    buttonLabel?: string;
  };
}

export default class MessageComposer extends Component<MessageComposerSignature> {
  @service declare messageStore: MessageStoreService;
  @service declare workspaceStore: WorkspaceStoreService;

  @tracked message = "";
  @tracked slashSuggestions: SlashCommand[] = [];
  @tracked selectedSuggestionIndex = 0;
  @tracked showCommandRef = false;
  @tracked mentionSuggestions: User[] = [];
  @tracked selectedMentionIndex = 0;
  @tracked showMentionMenu = false;

  get placeholder(): string {
    if (this.args.placeholder) return this.args.placeholder;
    const ch = this.args.channel;
    if (!ch || !ch.name) return "Message... (type / for commands)";
    if (ch.kind === "dm" || ch.kind === "group") {
      return `Message ${this.workspaceStore.getDmDisplayName(ch)}`;
    }
    return `Message #${ch.name} — type / for commands`;
  }

  get isEncrypted(): boolean {
    return this.args.channel?.isPrivate ?? false;
  }

  get isEmpty(): boolean {
    return !this.message;
  }

  get sendLabel(): string {
    return this.args.buttonLabel ?? "Send";
  }

  get showSlashMenu(): boolean {
    return this.slashSuggestions.length > 0;
  }

  get allCommands(): SlashCommand[] {
    return SLASH_COMMANDS;
  }

  // ---- @mention detection ----

  private _getMentionQuery(): string | null {
    const text = this.message;
    // Find the last @ that isn't preceded by a non-space char
    const match = text.match(/@(\w*)$/);
    if (!match) return null;
    return match[1] ?? "";
  }

  private _updateMentionSuggestions(): void {
    const query = this._getMentionQuery();
    if (query === null) {
      this.showMentionMenu = false;
      this.mentionSuggestions = [];
      return;
    }

    const members = this.workspaceStore.users.filter(
      (u) =>
        u.id !== this.workspaceStore.currentUserId &&
        !u.isBot &&
        u.displayName.toLowerCase().includes(query.toLowerCase()),
    );
    this.mentionSuggestions = members.slice(0, 8);
    this.showMentionMenu = members.length > 0;
    this.selectedMentionIndex = 0;
  }

  selectMention = (user: User) => {
    // Replace the @query with @displayName
    const match = this.message.match(/@(\w*)$/);
    if (match) {
      this.message =
        this.message.slice(0, match.index) + `@${user.displayName} `;
    }
    this.showMentionMenu = false;
    this.mentionSuggestions = [];
  };

  isMentionSelected = (index: number): boolean => {
    return index === this.selectedMentionIndex;
  };

  memberInitial = (name: string): string => {
    return name.charAt(0).toUpperCase();
  };

  // ---- Input handling ----

  handleInput = (event: Event) => {
    this.message = (event.target as HTMLTextAreaElement).value;

    // Slash command autocomplete
    if (this.message.startsWith("/") && !this.message.includes(" ")) {
      this.slashSuggestions = matchSlashCommands(this.message);
      this.selectedSuggestionIndex = 0;
      this.showMentionMenu = false;
    } else {
      this.slashSuggestions = [];
      // @mention autocomplete
      this._updateMentionSuggestions();
    }

    // Notify typing
    if (this.message && this.args.channel?.id && !this.message.startsWith("/")) {
      this.messageStore.notifyTyping(this.args.channel.id);
    }
  };

  handleKeyDown = (event: KeyboardEvent) => {
    // Mention menu navigation
    if (this.showMentionMenu) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        this.selectedMentionIndex = Math.min(
          this.selectedMentionIndex + 1,
          this.mentionSuggestions.length - 1,
        );
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        this.selectedMentionIndex = Math.max(
          this.selectedMentionIndex - 1,
          0,
        );
        return;
      }
      if (event.key === "Tab" || event.key === "Enter") {
        event.preventDefault();
        const user = this.mentionSuggestions[this.selectedMentionIndex];
        if (user) this.selectMention(user);
        return;
      }
      if (event.key === "Escape") {
        this.showMentionMenu = false;
        return;
      }
    }

    // Slash menu navigation
    if (this.showSlashMenu) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        this.selectedSuggestionIndex = Math.min(
          this.selectedSuggestionIndex + 1,
          this.slashSuggestions.length - 1,
        );
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        this.selectedSuggestionIndex = Math.max(
          this.selectedSuggestionIndex - 1,
          0,
        );
        return;
      }
      if (event.key === "Tab" || event.key === "Enter") {
        event.preventDefault();
        const cmd = this.slashSuggestions[this.selectedSuggestionIndex];
        if (cmd) {
          this.message = cmd.name + " ";
          this.slashSuggestions = [];
        }
        return;
      }
      if (event.key === "Escape") {
        this.slashSuggestions = [];
        return;
      }
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  };

  selectSlashCommand = (cmd: SlashCommand) => {
    this.message = cmd.name + " ";
    this.slashSuggestions = [];
  };

  isSelected = (index: number): boolean => {
    return index === this.selectedSuggestionIndex;
  };

  // ---- Toolbar actions ----

  toggleCommandRef = () => {
    this.showCommandRef = !this.showCommandRef;
  };

  private _getTextarea(): HTMLTextAreaElement | null {
    return document.querySelector(".message-composer .composer-input") as HTMLTextAreaElement | null;
  }

  private _insertText(text: string) {
    const ta = this._getTextarea();
    if (ta) {
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const before = ta.value.substring(0, start);
      const after = ta.value.substring(end);
      ta.value = before + text + after;
      ta.selectionStart = ta.selectionEnd = start + text.length;
      ta.focus();
      this.message = ta.value;
    } else {
      this.message = this.message + text;
    }
  }

  private _wrapSelection(before: string, after: string) {
    const ta = this._getTextarea();
    if (ta) {
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const selected = ta.value.substring(start, end);
      const prefix = ta.value.substring(0, start);
      const suffix = ta.value.substring(end);
      ta.value = prefix + before + selected + after + suffix;
      // Place cursor inside the wrapper
      if (selected) {
        ta.selectionStart = start + before.length;
        ta.selectionEnd = end + before.length;
      } else {
        ta.selectionStart = ta.selectionEnd = start + before.length;
      }
      ta.focus();
      this.message = ta.value;
    }
  }

  insertSlash = () => {
    const ta = this._getTextarea();
    if (ta) {
      ta.value = "/";
      ta.focus();
      this.message = "/";
    }
    this.slashSuggestions = matchSlashCommands("/");
    this.selectedSuggestionIndex = 0;
    this.showCommandRef = false;
  };

  insertMention = () => {
    this._insertText("@");
    this._updateMentionSuggestions();
  };

  wrapBold = () => {
    this._wrapSelection("**", "**");
  };

  wrapCode = () => {
    this._wrapSelection("`", "`");
  };

  wrapCodeBlock = () => {
    this._insertText("```\n\n```");
    // Move cursor between the fences
    const ta = this._getTextarea();
    if (ta) {
      ta.selectionStart = ta.selectionEnd = ta.value.length - 4;
    }
  };

  // ---- Send ----

  send = async () => {
    const content = this.message.trim();
    if (!content) return;

    // Check for slash commands
    const parsed = parseSlashCommand(content);
    if (parsed && !this.workspaceStore.useMock) {
      try {
        const channelId = this.args.channel.id;
        await fsSendMessage(channelId, {
          authorId: this.workspaceStore.currentUserId,
          content: parsed.content,
          encrypted: this.args.channel?.isPrivate ?? false,
          messageType: parsed.messageType,
          metadata: parsed.metadata as Record<string, unknown>,
        });
      } catch (e) {
        console.error("Failed to send command:", e);
      }
      this.message = "";
      this.slashSuggestions = [];
      return;
    }

    this.messageStore.sendMessage(
      this.args.channel.id,
      content,
      this.args.threadId,
    );
    this.message = "";
    this.slashSuggestions = [];
    this.showMentionMenu = false;
  };

  <template>
    <div class="message-composer">
      {{!-- Slash command autocomplete --}}
      {{#if this.showSlashMenu}}
        <div class="slash-menu">
          {{#each this.slashSuggestions as |cmd index|}}
            <button
              class="slash-menu-item {{if (this.isSelected index) 'active'}}"
              {{on "click" (fn this.selectSlashCommand cmd)}}
            >
              <span class="slash-menu-icon">{{cmd.icon}}</span>
              <div class="slash-menu-info">
                <span class="slash-menu-name">{{cmd.name}}</span>
                <span class="slash-menu-desc">{{cmd.description}}</span>
              </div>
              <span class="slash-menu-usage">{{cmd.usage}}</span>
            </button>
          {{/each}}
        </div>
      {{/if}}

      {{!-- @mention autocomplete --}}
      {{#if this.showMentionMenu}}
        <div class="mention-menu">
          {{#each this.mentionSuggestions as |user index|}}
            <button
              class="mention-menu-item {{if (this.isMentionSelected index) 'active'}}"
              {{on "click" (fn this.selectMention user)}}
            >
              <span class="mention-avatar">{{this.memberInitial user.displayName}}</span>
              <span class="mention-name">{{user.displayName}}</span>
              <span class="mention-email">{{user.email}}</span>
            </button>
          {{/each}}
        </div>
      {{/if}}

      {{!-- Command reference panel --}}
      {{#if this.showCommandRef}}
        <div class="command-ref">
          <div class="command-ref-header">
            <span class="command-ref-title">Commands</span>
            <button class="close-btn" {{on "click" this.toggleCommandRef}}>&times;</button>
          </div>
          <div class="command-ref-list">
            {{#each this.allCommands as |cmd|}}
              <button class="command-ref-item" {{on "click" (fn this.selectSlashCommand cmd)}}>
                <span class="command-ref-icon">{{cmd.icon}}</span>
                <div class="command-ref-info">
                  <span class="command-ref-name">{{cmd.name}}</span>
                  <span class="command-ref-desc">{{cmd.description}}</span>
                </div>
                <code class="command-ref-usage">{{cmd.usage}}</code>
              </button>
            {{/each}}
          </div>
        </div>
      {{/if}}

      {{!-- Toolbar --}}
      <div class="composer-toolbar">
        <button class="toolbar-btn" title="Commands (/)" {{on "click" this.insertSlash}}>
          <span class="toolbar-icon">/</span>
        </button>
        <button class="toolbar-btn" title="Mention someone (@)" {{on "click" this.insertMention}}>
          <span class="toolbar-icon">@</span>
        </button>
        <button class="toolbar-btn" title="Bold (Cmd+B)" {{on "click" this.wrapBold}}>
          <span class="toolbar-icon toolbar-bold">B</span>
        </button>
        <button class="toolbar-btn" title="Code" {{on "click" this.wrapCode}}>
          <span class="toolbar-icon toolbar-code">&lt;/&gt;</span>
        </button>
        <button class="toolbar-btn" title="Code block" {{on "click" this.wrapCodeBlock}}>
          <span class="toolbar-icon toolbar-code-block">{}</span>
        </button>
        <div class="toolbar-spacer"></div>
        <button class="toolbar-btn toolbar-help" title="Command reference" {{on "click" this.toggleCommandRef}}>
          <span class="toolbar-icon">?</span>
        </button>
      </div>

      {{!-- Input area --}}
      <div class="composer-input-row">
        {{#if this.isEncrypted}}
          <span class="composer-lock" title="This message will be encrypted">🔒</span>
        {{/if}}
        <textarea
          class="composer-input"
          placeholder={{this.placeholder}}
          rows="1"
          value={{this.message}}
          {{on "input" this.handleInput}}
          {{on "keydown" this.handleKeyDown}}
        ></textarea>
        <button
          class="composer-send {{if this.message 'active'}}"
          disabled={{this.isEmpty}}
          {{on "click" this.send}}
        >
          {{this.sendLabel}}
        </button>
      </div>
    </div>
  </template>
}
