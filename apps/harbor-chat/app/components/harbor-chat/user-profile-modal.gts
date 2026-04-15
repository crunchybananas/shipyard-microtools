import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { inject as service } from "@ember/service";
import { fn } from "@ember/helper";
import { on } from "@ember/modifier";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "harbor-chat/utils/firebase";
import type WorkspaceStoreService from "harbor-chat/services/workspace-store";
import type PresenceService from "harbor-chat/services/presence-service";
import type { User } from "harbor-chat/harbor-chat/types";

const STATUS_PRESETS = [
  "In a meeting",
  "Commuting",
  "Out sick",
  "Vacationing",
  "Working remotely",
];

export default class UserProfileModal extends Component {
  @service declare workspaceStore: WorkspaceStoreService;
  @service declare presenceService: PresenceService;

  @tracked isEditing = false;
  @tracked editDisplayName = "";
  @tracked editStatusMessage = "";
  @tracked isSaving = false;

  get user(): User | undefined {
    if (!this.presenceService.showUserProfile) return undefined;
    return this.workspaceStore.getUserById(
      this.presenceService.showUserProfile,
    );
  }

  get isCurrentUser(): boolean {
    return (
      this.presenceService.showUserProfile ===
      this.workspaceStore.currentUserId
    );
  }

  get statusLabel(): string {
    const labels: Record<string, string> = {
      online: "Online",
      away: "Away",
      dnd: "Do Not Disturb",
      offline: "Offline",
    };
    return labels[this.user?.status ?? "offline"] ?? "Offline";
  }

  get statusPresets(): string[] {
    return STATUS_PRESETS;
  }

  get initial(): string {
    return this.user?.displayName.charAt(0).toUpperCase() ?? "?";
  }

  close = () => {
    this.isEditing = false;
    this.presenceService.viewUserProfile(null);
  };

  setStatus = (status: User["status"]) => {
    this.workspaceStore.updateStatus(status);
  };

  stopProp = (event: Event) => {
    event.stopPropagation();
  };

  startEditing = () => {
    this.editDisplayName = this.user?.displayName ?? "";
    this.editStatusMessage = this.user?.statusMessage ?? "";
    this.isEditing = true;
  };

  cancelEditing = () => {
    this.isEditing = false;
  };

  onDisplayNameInput = (event: Event) => {
    this.editDisplayName = (event.target as HTMLInputElement).value;
  };

  onStatusMessageInput = (event: Event) => {
    this.editStatusMessage = (event.target as HTMLInputElement).value;
  };

  applyPreset = (preset: string) => {
    this.editStatusMessage = preset;
  };

  saveProfile = async () => {
    const uid = this.workspaceStore.currentUserId;
    if (!uid) return;

    this.isSaving = true;
    try {
      await updateDoc(doc(db, "users", uid), {
        displayName: this.editDisplayName,
        statusMessage: this.editStatusMessage,
      });
      await this.workspaceStore.reload();
      this.isEditing = false;
    } finally {
      this.isSaving = false;
    }
  };

  <template>
    {{#if this.user}}
      <div class="modal-backdrop" {{on "click" this.close}}>
        <div class="modal-content profile-modal" {{on "click" this.stopProp}}>
          <button class="close-btn modal-close" {{on "click" this.close}}>&times;</button>

          <div class="profile-header">
            <div class="profile-avatar-lg status-{{this.user.status}}">
              {{this.initial}}
            </div>

            {{#if this.isEditing}}
              <div style="width: 100%; margin-top: 0.5rem;">
                <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">Display Name</label>
                <input
                  type="text"
                  class="chat-input"
                  value={{this.editDisplayName}}
                  {{on "input" this.onDisplayNameInput}}
                  style="width: 100%; margin-bottom: 0.75rem;"
                />

                <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">Status Message</label>
                <input
                  type="text"
                  class="chat-input"
                  value={{this.editStatusMessage}}
                  placeholder="What's your status?"
                  {{on "input" this.onStatusMessageInput}}
                  style="width: 100%; margin-bottom: 0.5rem;"
                />

                <div style="display: flex; flex-wrap: wrap; gap: 0.25rem; margin-bottom: 0.75rem;">
                  {{#each this.statusPresets as |preset|}}
                    <button
                      class="status-btn"
                      style="font-size: 0.75rem; padding: 0.2rem 0.5rem;"
                      {{on "click" (fn this.applyPreset preset)}}
                    >
                      {{preset}}
                    </button>
                  {{/each}}
                </div>

                <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                  <button class="status-btn" {{on "click" this.cancelEditing}}>Cancel</button>
                  <button
                    class="status-btn"
                    style="background: var(--accent); color: #fff;"
                    disabled={{this.isSaving}}
                    {{on "click" this.saveProfile}}
                  >
                    {{if this.isSaving "Saving…" "Save"}}
                  </button>
                </div>
              </div>
            {{else}}
              <h2 class="profile-name">{{this.user.displayName}}</h2>
              <span class="profile-status-badge status-{{this.user.status}}">
                {{this.statusLabel}}
              </span>
              {{#if this.user.statusMessage}}
                <p class="profile-status-msg">{{this.user.statusMessage}}</p>
              {{/if}}
              {{#if this.isCurrentUser}}
                <button
                  class="status-btn"
                  style="margin-top: 0.5rem; font-size: 0.75rem;"
                  {{on "click" this.startEditing}}
                >
                  ✏️ Edit Profile
                </button>
              {{/if}}
            {{/if}}
          </div>

          <div class="profile-details">
            <div class="profile-field">
              <label>Email</label>
              <span>{{this.user.email}}</span>
            </div>
            {{#if this.user.publicKey}}
              <div class="profile-field">
                <label>Encryption</label>
                <span class="encryption-active">🔐 Keys registered</span>
              </div>
            {{/if}}
          </div>

          {{#if this.isCurrentUser}}
            <div class="profile-actions">
              <h4>Set Status</h4>
              <div class="status-options">
                <button class="status-btn" {{on "click" (fn this.setStatus "online")}}>
                  <span class="presence-dot-sm status-online"></span> Online
                </button>
                <button class="status-btn" {{on "click" (fn this.setStatus "away")}}>
                  <span class="presence-dot-sm status-away"></span> Away
                </button>
                <button class="status-btn" {{on "click" (fn this.setStatus "dnd")}}>
                  <span class="presence-dot-sm status-dnd"></span> Do Not Disturb
                </button>
              </div>
            </div>
          {{/if}}
        </div>
      </div>
    {{/if}}
  </template>
}
