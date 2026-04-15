import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { inject as service } from "@ember/service";
import { fn } from "@ember/helper";
import { on } from "@ember/modifier";
import type RouterService from "@ember/routing/router-service";
import type WorkspaceStoreService from "harbor-chat/services/workspace-store";
import type AuthService from "harbor-chat/services/auth-service";
import type { User } from "harbor-chat/harbor-chat/types";
import { createChannel } from "harbor-chat/utils/firestore-adapter";

interface StartDmModalSignature {
  Args: {
    isOpen: boolean;
    onClose: () => void;
    workspaceId: string;
    members: User[];
  };
}

export default class StartDmModal extends Component<StartDmModalSignature> {
  @service declare workspaceStore: WorkspaceStoreService;
  @service declare router: RouterService;
  @service declare authService: AuthService;

  @tracked searchQuery = "";
  @tracked selectedIds: Set<string> = new Set();
  @tracked isSubmitting = false;
  @tracked error = "";

  get currentUserId(): string | null {
    return this.authService.uid;
  }

  get filteredMembers(): User[] {
    const query = this.searchQuery.toLowerCase().trim();
    const members = this.args.members.filter(
      (m) => m.id !== this.currentUserId,
    );
    if (!query) return members;
    return members.filter(
      (m) =>
        m.displayName.toLowerCase().includes(query) ||
        m.email.toLowerCase().includes(query),
    );
  }

  get selectedCount(): number {
    return this.selectedIds.size;
  }

  get channelKind(): "dm" | "group" {
    return this.selectedIds.size > 1 ? "group" : "dm";
  }

  get selectedNames(): string {
    return [...this.selectedIds]
      .map((id) => {
        const user = this.args.members.find((m) => m.id === id);
        return user?.displayName ?? "Unknown";
      })
      .join(", ");
  }

  get submitLabel(): string {
    if (this.isSubmitting) return "Starting...";
    return this.channelKind === "group"
      ? "Start Group Chat"
      : "Start Conversation";
  }

  handleBackdropClick = () => {
    this.resetForm();
    this.args.onClose();
  };

  stopProp = (event: Event) => {
    event.stopPropagation();
  };

  handleKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      this.resetForm();
      this.args.onClose();
    }
  };

  updateSearch = (event: Event) => {
    this.searchQuery = (event.target as HTMLInputElement).value;
  };

  toggleMember = (userId: string) => {
    const next = new Set(this.selectedIds);
    if (next.has(userId)) {
      next.delete(userId);
    } else {
      next.add(userId);
    }
    this.selectedIds = next;
  };

  isSelected = (userId: string): boolean => {
    return this.selectedIds.has(userId);
  };

  memberInitial = (user: User): string => {
    return user.displayName.charAt(0).toUpperCase();
  };

  handleSubmit = async (event: Event) => {
    event.preventDefault();

    if (this.selectedIds.size === 0) {
      this.error = "Select at least one member.";
      return;
    }

    this.isSubmitting = true;
    this.error = "";

    try {
      const uid = this.currentUserId;
      if (!uid) throw new Error("Not authenticated");

      const memberIds = [uid, ...this.selectedIds];
      const kind = this.channelKind;
      const name = this.selectedNames;

      const channelId = await createChannel({
        workspaceId: this.args.workspaceId,
        name,
        description: "",
        kind,
        memberIds,
        isPrivate: true,
      });

      await this.workspaceStore.reload();
      this.resetForm();
      this.args.onClose();
      this.router.transitionTo(
        "workspace.channel",
        this.args.workspaceId,
        channelId,
      );
    } catch (e) {
      this.error =
        e instanceof Error ? e.message : "Failed to start conversation.";
    } finally {
      this.isSubmitting = false;
    }
  };

  private resetForm(): void {
    this.searchQuery = "";
    this.selectedIds = new Set();
    this.error = "";
  }

  <template>
    {{#if @isOpen}}
      <div
        class="modal-backdrop"
        {{on "click" this.handleBackdropClick}}
        {{on "keydown" this.handleKeydown}}
      >
        <div class="modal-content dm-modal" {{on "click" this.stopProp}}>
          <button class="close-btn modal-close" {{on "click" this.handleBackdropClick}}>&times;</button>

          <h2 class="profile-name">✉️ New message</h2>
          <p class="create-channel-hint">
            Select one or more members to start a conversation.
          </p>

          <form class="modal-form" {{on "submit" this.handleSubmit}}>
            <div class="modal-form-group">
              <input
                type="text"
                class="modal-form-input"
                placeholder="🔍 Search members..."
                value={{this.searchQuery}}
                {{on "input" this.updateSearch}}
                autocomplete="off"
              />
            </div>

            {{#if this.selectedCount}}
              <div class="dm-selected-summary">
                {{this.selectedCount}} selected — {{this.selectedNames}}
              </div>
            {{/if}}

            <div class="dm-member-list">
              {{#each this.filteredMembers as |member|}}
                <button
                  type="button"
                  class="dm-member-item {{if (this.isSelected member.id) 'selected'}}"
                  {{on "click" (fn this.toggleMember member.id)}}
                >
                  <span class="dm-member-check">
                    {{#if (this.isSelected member.id)}}✓{{/if}}
                  </span>
                  <span class="dm-member-avatar status-{{member.status}}">
                    {{this.memberInitial member}}
                  </span>
                  <span class="dm-member-name">{{member.displayName}}</span>
                  <span class="presence-dot-sm status-{{member.status}}"></span>
                </button>
              {{else}}
                <div class="dm-empty-state">No members found.</div>
              {{/each}}
            </div>

            {{#if this.error}}
              <div class="create-channel-error">{{this.error}}</div>
            {{/if}}

            <button
              type="submit"
              class="modal-submit-btn"
              disabled={{this.isSubmitting}}
            >
              {{this.submitLabel}}
            </button>
          </form>
        </div>
      </div>
    {{/if}}
  </template>
}
