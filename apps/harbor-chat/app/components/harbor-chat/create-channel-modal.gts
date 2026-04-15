import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { inject as service } from "@ember/service";
import { on } from "@ember/modifier";
import type RouterService from "@ember/routing/router-service";
import type WorkspaceStoreService from "harbor-chat/services/workspace-store";
import type AuthService from "harbor-chat/services/auth-service";
import { createChannel } from "harbor-chat/utils/firestore-adapter";

interface CreateChannelModalSignature {
  Args: {
    isOpen: boolean;
    onClose: () => void;
    workspaceId: string;
  };
}

export default class CreateChannelModal extends Component<CreateChannelModalSignature> {
  @service declare workspaceStore: WorkspaceStoreService;
  @service declare router: RouterService;
  @service declare authService: AuthService;

  @tracked channelName = "";
  @tracked description = "";
  @tracked isPrivate = false;
  @tracked isSubmitting = false;
  @tracked error = "";

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

  updateName = (event: Event) => {
    const input = event.target as HTMLInputElement;
    this.channelName = input.value
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  };

  updateDescription = (event: Event) => {
    this.description = (event.target as HTMLTextAreaElement).value;
  };

  togglePrivate = () => {
    this.isPrivate = !this.isPrivate;
  };

  handleSubmit = async (event: Event) => {
    event.preventDefault();

    if (!this.channelName.trim()) {
      this.error = "Channel name is required.";
      return;
    }

    this.isSubmitting = true;
    this.error = "";

    try {
      const uid = this.authService.uid;
      if (!uid) throw new Error("Not authenticated");

      const channelId = await createChannel({
        workspaceId: this.args.workspaceId,
        name: this.channelName.trim(),
        description: this.description.trim(),
        kind: "channel",
        memberIds: [uid],
        isPrivate: this.isPrivate,
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
      this.error = e instanceof Error ? e.message : "Failed to create channel.";
    } finally {
      this.isSubmitting = false;
    }
  };

  private resetForm(): void {
    this.channelName = "";
    this.description = "";
    this.isPrivate = false;
    this.error = "";
  }

  <template>
    {{#if @isOpen}}
      <div
        class="modal-backdrop"
        {{on "click" this.handleBackdropClick}}
        {{on "keydown" this.handleKeydown}}
      >
        <div class="modal-content create-channel-modal" {{on "click" this.stopProp}}>
          <button class="close-btn modal-close" {{on "click" this.handleBackdropClick}}>&times;</button>

          <h2 class="profile-name">Create a channel</h2>
          <p class="create-channel-hint">
            Channels are where your team communicates. They're best organized around a topic — #marketing, #engineering, etc.
          </p>

          <form class="modal-form" {{on "submit" this.handleSubmit}}>
            <div class="modal-form-group">
              <label for="channel-name">Name</label>
              <div class="channel-name-input-wrap">
                <span class="channel-name-prefix">#</span>
                <input
                  id="channel-name"
                  class="modal-form-input channel-name-field"
                  type="text"
                  placeholder="e.g. plan-budget"
                  value={{this.channelName}}
                  {{on "input" this.updateName}}
                  autocomplete="off"
                />
              </div>
            </div>

            <div class="modal-form-group">
              <label for="channel-desc">Description <span class="create-channel-optional">(optional)</span></label>
              <textarea
                id="channel-desc"
                class="modal-form-textarea"
                placeholder="What's this channel about?"
                rows="3"
                {{on "input" this.updateDescription}}
              >{{this.description}}</textarea>
            </div>

            <div class="modal-toggle-row">
              <span class="toggle-info">
                <span class="dm-member-name">🔒 Make private</span>
                <span class="create-channel-toggle-hint">Only invited members can see this channel</span>
              </span>
              <button
                type="button"
                class="toggle-switch {{if this.isPrivate 'active'}}"
                role="switch"
                aria-checked="{{this.isPrivate}}"
                {{on "click" this.togglePrivate}}
              ></button>
            </div>

            {{#if this.error}}
              <div class="create-channel-error">{{this.error}}</div>
            {{/if}}

            <button
              type="submit"
              class="modal-submit-btn"
              disabled={{this.isSubmitting}}
            >
              {{if this.isSubmitting "Creating..." "Create Channel"}}
            </button>
          </form>
        </div>
      </div>
    {{/if}}
  </template>
}
