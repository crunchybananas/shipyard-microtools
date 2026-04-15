import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { inject as service } from "@ember/service";
import { on } from "@ember/modifier";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "harbor-chat/utils/firebase";
import type WorkspaceStoreService from "harbor-chat/services/workspace-store";
import type AuthService from "harbor-chat/services/auth-service";
import type { Workspace, User } from "harbor-chat/harbor-chat/types";

interface WorkspaceSettingsSignature {
  Args: {
    isOpen: boolean;
    onClose: () => void;
    workspaceId: string;
  };
}

export default class WorkspaceSettings extends Component<WorkspaceSettingsSignature> {
  @service declare workspaceStore: WorkspaceStoreService;
  @service declare authService: AuthService;

  @tracked editingName = false;
  @tracked editingIcon = false;
  @tracked nameValue = "";
  @tracked iconValue = "";
  @tracked isSaving = false;
  @tracked error = "";

  get workspace(): Workspace | undefined {
    return this.workspaceStore.getWorkspaceById(this.args.workspaceId);
  }

  get members(): User[] {
    return this.workspaceStore.membersForWorkspace(this.args.workspaceId);
  }

  get isOwner(): boolean {
    return this.workspace?.ownerId === this.workspaceStore.currentUserId;
  }

  get ownerName(): string {
    if (!this.workspace) return "";
    const owner = this.workspaceStore.getUserById(this.workspace.ownerId);
    return owner?.displayName ?? "Unknown";
  }

  handleBackdropClick = () => {
    this.resetEditing();
    this.args.onClose();
  };

  stopProp = (event: Event) => {
    event.stopPropagation();
  };

  handleKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      this.resetEditing();
      this.args.onClose();
    }
  };

  startEditingName = () => {
    if (!this.isOwner) return;
    this.nameValue = this.workspace?.name ?? "";
    this.editingName = true;
  };

  updateNameValue = (event: Event) => {
    this.nameValue = (event.target as HTMLInputElement).value;
  };

  saveName = async () => {
    const trimmed = this.nameValue.trim();
    if (!trimmed || !this.workspace) return;

    this.isSaving = true;
    this.error = "";
    try {
      const ref = doc(db, "workspaces", this.workspace.id);
      await updateDoc(ref, { name: trimmed });
      await this.workspaceStore.reload();
      this.editingName = false;
    } catch (e) {
      this.error = e instanceof Error ? e.message : "Failed to update name.";
    } finally {
      this.isSaving = false;
    }
  };

  cancelEditName = () => {
    this.editingName = false;
    this.nameValue = "";
    this.error = "";
  };

  startEditingIcon = () => {
    if (!this.isOwner) return;
    this.iconValue = this.workspace?.icon ?? "";
    this.editingIcon = true;
  };

  updateIconValue = (event: Event) => {
    this.iconValue = (event.target as HTMLInputElement).value;
  };

  saveIcon = async () => {
    const trimmed = this.iconValue.trim();
    if (!trimmed || !this.workspace) return;

    this.isSaving = true;
    this.error = "";
    try {
      const ref = doc(db, "workspaces", this.workspace.id);
      await updateDoc(ref, { icon: trimmed });
      await this.workspaceStore.reload();
      this.editingIcon = false;
    } catch (e) {
      this.error = e instanceof Error ? e.message : "Failed to update icon.";
    } finally {
      this.isSaving = false;
    }
  };

  cancelEditIcon = () => {
    this.editingIcon = false;
    this.iconValue = "";
    this.error = "";
  };

  signOut = async () => {
    await this.authService.signOut();
  };

  roleForMember = (member: User): string => {
    return this.workspace?.ownerId === member.id ? "Owner" : "Member";
  };

  private resetEditing(): void {
    this.editingName = false;
    this.editingIcon = false;
    this.nameValue = "";
    this.iconValue = "";
    this.error = "";
  }

  <template>
    {{#if @isOpen}}
      <div
        class="modal-backdrop"
        {{on "click" this.handleBackdropClick}}
        {{on "keydown" this.handleKeydown}}
      >
        <div class="modal-content workspace-settings-modal" {{on "click" this.stopProp}}>
          <button class="close-btn modal-close" {{on "click" this.handleBackdropClick}}>&times;</button>

          {{#if this.workspace}}
            <div class="ws-settings-header">
              <div class="ws-settings-icon">{{this.workspace.icon}}</div>
              <h2 class="profile-name">{{this.workspace.name}}</h2>
            </div>

            {{! ---- General Section ---- }}
            <div class="ws-settings-section">
              <h3 class="ws-settings-section-title">General</h3>

              <div class="ws-settings-field">
                <label class="ws-settings-label">Workspace name</label>
                {{#if this.editingName}}
                  <div class="ws-settings-edit-row">
                    <input
                      class="modal-form-input"
                      type="text"
                      value={{this.nameValue}}
                      {{on "input" this.updateNameValue}}
                      autocomplete="off"
                    />
                    <div class="ws-settings-edit-actions">
                      <button
                        class="ws-settings-save-btn"
                        disabled={{this.isSaving}}
                        {{on "click" this.saveName}}
                      >
                        {{if this.isSaving "Saving..." "Save"}}
                      </button>
                      <button class="ws-settings-cancel-btn" {{on "click" this.cancelEditName}}>
                        Cancel
                      </button>
                    </div>
                  </div>
                {{else}}
                  <div class="ws-settings-value-row">
                    <span class="ws-settings-value">{{this.workspace.name}}</span>
                    {{#if this.isOwner}}
                      <button class="ws-settings-edit-btn" {{on "click" this.startEditingName}}>
                        ✏️ Edit
                      </button>
                    {{/if}}
                  </div>
                {{/if}}
              </div>

              <div class="ws-settings-field">
                <label class="ws-settings-label">Icon</label>
                {{#if this.editingIcon}}
                  <div class="ws-settings-edit-row">
                    <input
                      class="modal-form-input ws-settings-icon-input"
                      type="text"
                      value={{this.iconValue}}
                      {{on "input" this.updateIconValue}}
                      autocomplete="off"
                    />
                    <div class="ws-settings-edit-actions">
                      <button
                        class="ws-settings-save-btn"
                        disabled={{this.isSaving}}
                        {{on "click" this.saveIcon}}
                      >
                        {{if this.isSaving "Saving..." "Save"}}
                      </button>
                      <button class="ws-settings-cancel-btn" {{on "click" this.cancelEditIcon}}>
                        Cancel
                      </button>
                    </div>
                  </div>
                {{else}}
                  <div class="ws-settings-value-row">
                    <span class="ws-settings-value ws-settings-icon-preview">{{this.workspace.icon}}</span>
                    {{#if this.isOwner}}
                      <button class="ws-settings-edit-btn" {{on "click" this.startEditingIcon}}>
                        ✏️ Edit
                      </button>
                    {{/if}}
                  </div>
                {{/if}}
              </div>

              {{#if this.error}}
                <div class="ws-settings-error">{{this.error}}</div>
              {{/if}}
            </div>

            {{! ---- Members Section ---- }}
            <div class="ws-settings-section">
              <h3 class="ws-settings-section-title">Members <span class="ws-settings-count">{{this.members.length}}</span></h3>

              <ul class="ws-settings-members">
                {{#each this.members as |member|}}
                  <li class="ws-settings-member">
                    <div class="ws-settings-member-avatar">
                      {{member.displayName}}
                    </div>
                    <div class="ws-settings-member-info">
                      <span class="ws-settings-member-name">{{member.displayName}}</span>
                      <span class="ws-settings-member-email">{{member.email}}</span>
                    </div>
                    <span class="ws-settings-member-role {{if (this.roleForMember member) 'owner'}}">
                      {{this.roleForMember member}}
                    </span>
                  </li>
                {{/each}}
              </ul>
            </div>

            {{! ---- Sign Out Section ---- }}
            <div class="ws-settings-section ws-settings-signout-section">
              <button class="ws-settings-signout-btn" {{on "click" this.signOut}}>
                🚪 Sign out
              </button>
              <span class="ws-settings-signout-hint">
                Signed in as {{this.authService.displayName}} ({{this.authService.email}})
              </span>
            </div>
          {{/if}}
        </div>
      </div>
    {{/if}}
  </template>
}
