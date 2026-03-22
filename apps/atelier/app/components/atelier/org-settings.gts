import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import { fn } from "@ember/helper";
import { inject as service } from "@ember/service";
import type OrgService from "atelier/services/org-service";
import type AuthService from "atelier/services/auth-service";
import type RouterService from "@ember/routing/router-service";
import type { FirestoreOrgMember, FirestoreInvite } from "atelier/utils/firestore-adapter";

const IconSparkles = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z"/><path d="M19 15l.5 2 2 .5-2 .5-.5 2-.5-2-2-.5 2-.5.5-2z"/></svg></template>;
const IconArrowLeft = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></template>;
const IconTrash = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></template>;
const IconUserPlus = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg></template>;
const IconX = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></template>;

export default class AtelierOrgSettings extends Component {
  @service declare orgService: OrgService;
  @service declare authService: AuthService;
  @service declare router: RouterService;

  @tracked inviteEmail: string = "";
  @tracked inviteRole: "editor" | "viewer" = "editor";
  @tracked isEditingName: boolean = false;
  @tracked editedName: string = "";
  @tracked showDeleteConfirm: boolean = false;

  get orgId(): string {
    // Extract org_id from URL hash
    const hash = window.location.hash;
    const match = hash.match(/\/org\/([^/]+)\/settings/);
    return match?.[1] ?? "";
  }

  get org() {
    return this.orgService.organizations.find((o) => o.id === this.orgId);
  }

  get isOwner(): boolean {
    return this.orgService.isOrgOwner(this.orgId);
  }

  get members(): FirestoreOrgMember[] {
    return this.orgService.members;
  }

  get invites(): FirestoreInvite[] {
    return this.orgService.invites;
  }

  get pendingInvites(): FirestoreInvite[] {
    return this.invites.filter((i) => i.status === "pending");
  }

  goBack = () => {
    window.location.hash = "#/";
  };

  // Name editing
  startEditName = () => {
    this.editedName = this.org?.name ?? "";
    this.isEditingName = true;
  };

  onNameInput = (e: Event) => {
    this.editedName = (e.target as HTMLInputElement).value;
  };

  saveName = async () => {
    if (this.editedName.trim() && this.orgId) {
      await this.orgService.updateOrganization(this.orgId, this.editedName.trim());
    }
    this.isEditingName = false;
  };

  cancelEditName = () => {
    this.isEditingName = false;
  };

  onNameKeydown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      void this.saveName();
    } else if (e.key === "Escape") {
      this.cancelEditName();
    }
  };

  // Invites
  onInviteEmailInput = (e: Event) => {
    this.inviteEmail = (e.target as HTMLInputElement).value;
  };

  onInviteRoleChange = (e: Event) => {
    this.inviteRole = (e.target as HTMLSelectElement).value as "editor" | "viewer";
  };

  sendInvite = async (e: Event) => {
    e.preventDefault();
    if (!this.inviteEmail.trim() || !this.orgId) return;
    await this.orgService.inviteMember(this.orgId, this.inviteEmail.trim(), this.inviteRole);
    this.inviteEmail = "";
  };

  removeMember = async (userId: string) => {
    if (!this.orgId) return;
    await this.orgService.removeMember(this.orgId, userId);
  };

  deleteInvite = async (inviteId: string) => {
    if (!this.orgId) return;
    await this.orgService.deleteInvite(this.orgId, inviteId);
  };

  // Delete org
  toggleDeleteConfirm = () => {
    this.showDeleteConfirm = !this.showDeleteConfirm;
  };

  confirmDelete = async () => {
    if (!this.orgId) return;
    await this.orgService.deleteOrganization(this.orgId);
    window.location.hash = "#/";
  };

  getRoleBadgeClass = (role: string): string => {
    if (role === "owner") return "os-role-badge os-role-owner";
    if (role === "editor") return "os-role-badge os-role-editor";
    return "os-role-badge os-role-viewer";
  };

  getInitials = (email: string): string => {
    if (!email) return "?";
    const parts = email.split("@");
    const name = parts[0] ?? "";
    if (name.includes(".")) {
      const nameParts = name.split(".");
      return ((nameParts[0]?.[0] ?? "") + (nameParts[1]?.[0] ?? "")).toUpperCase();
    }
    return (name[0] ?? "?").toUpperCase();
  };

  <template>
    <div class="org-settings-page">
      <nav class="os-nav">
        <div class="os-nav-left">
          <button class="os-back-btn" type="button" {{on "click" this.goBack}}>
            <IconArrowLeft />
          </button>
          <div class="os-nav-logo">
            <div class="os-nav-logo-icon">
              <IconSparkles />
            </div>
            <span>Atelier</span>
          </div>
        </div>
      </nav>

      <div class="os-content">
        {{#if this.org}}
          <div class="os-header">
            <div class="os-org-avatar">
              {{this.getInitials this.org.name}}
            </div>
            <div class="os-header-info">
              {{#if this.isEditingName}}
                <div class="os-name-edit">
                  <input
                    class="os-name-input"
                    type="text"
                    value={{this.editedName}}
                    {{on "input" this.onNameInput}}
                    {{on "keydown" this.onNameKeydown}}
                  />
                  <button class="os-name-save" type="button" {{on "click" this.saveName}}>Save</button>
                  <button class="os-name-cancel" type="button" {{on "click" this.cancelEditName}}>
                    <IconX />
                  </button>
                </div>
              {{else}}
                <h1 class="os-org-name" role="button" {{on "click" this.startEditName}}>
                  {{this.org.name}}
                  {{#if this.isOwner}}
                    <span class="os-edit-hint">Click to edit</span>
                  {{/if}}
                </h1>
              {{/if}}
              <p class="os-org-meta">Organization Settings</p>
            </div>
          </div>

          {{! Members Section }}
          <div class="os-section">
            <div class="os-section-header">
              <h2 class="os-section-title">Members</h2>
              <span class="os-section-count">{{this.members.length}} {{if this.isSingleMember "member" "members"}}</span>
            </div>

            <div class="os-members-list">
              {{#each this.members as |member|}}
                <div class="os-member-row">
                  <div class="os-member-avatar">
                    {{this.getInitials member.email}}
                  </div>
                  <div class="os-member-info">
                    <div class="os-member-email">{{member.email}}</div>
                    <div class="os-member-joined">Joined {{this.formatJoinedDate member.joinedAt}}</div>
                  </div>
                  <span class={{this.getRoleBadgeClass member.role}}>{{member.role}}</span>
                  {{#if this.isOwner}}
                    {{#unless (this.isCurrentUser member.userId)}}
                      <button
                        class="os-member-remove"
                        type="button"
                        title="Remove member"
                        {{on "click" (fn this.removeMember member.userId)}}
                      >
                        <IconX />
                      </button>
                    {{/unless}}
                  {{/if}}
                </div>
              {{/each}}
            </div>
          </div>

          {{! Invite Section }}
          {{#if this.isOwner}}
            <div class="os-section">
              <div class="os-section-header">
                <h2 class="os-section-title">Invite Member</h2>
              </div>

              <form class="os-invite-form" {{on "submit" this.sendInvite}}>
                <div class="os-invite-row">
                  <input
                    class="os-invite-email"
                    type="email"
                    placeholder="Email address"
                    value={{this.inviteEmail}}
                    {{on "input" this.onInviteEmailInput}}
                  />
                  <select
                    class="os-invite-role-select"
                    {{on "change" this.onInviteRoleChange}}
                  >
                    <option value="editor" selected={{this.isEditorRole}}>Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button class="os-invite-btn" type="submit">
                    <IconUserPlus />
                    Invite
                  </button>
                </div>
              </form>

              {{#if this.pendingInvites.length}}
                <div class="os-pending-section">
                  <h3 class="os-pending-title">Pending Invites</h3>
                  {{#each this.pendingInvites as |invite|}}
                    <div class="os-invite-row-item">
                      <div class="os-invite-email-text">{{invite.email}}</div>
                      <span class={{this.getRoleBadgeClass invite.role}}>{{invite.role}}</span>
                      <span class="os-invite-status">Pending</span>
                      <button
                        class="os-invite-delete"
                        type="button"
                        title="Cancel invite"
                        {{on "click" (fn this.deleteInvite invite.id)}}
                      >
                        <IconX />
                      </button>
                    </div>
                  {{/each}}
                </div>
              {{/if}}
            </div>
          {{/if}}

          {{! Danger Zone }}
          {{#if this.isOwner}}
            <div class="os-section os-danger-section">
              <div class="os-section-header">
                <h2 class="os-section-title os-danger-title">Danger Zone</h2>
              </div>

              {{#if this.showDeleteConfirm}}
                <div class="os-delete-confirm">
                  <p class="os-delete-warning">
                    Are you sure? This will permanently delete the organization, all members, and all invites.
                    Projects in this organization will become personal projects.
                  </p>
                  <div class="os-delete-actions">
                    <button class="os-delete-cancel" type="button" {{on "click" this.toggleDeleteConfirm}}>
                      Cancel
                    </button>
                    <button class="os-delete-confirm-btn" type="button" {{on "click" this.confirmDelete}}>
                      <IconTrash />
                      Delete Organization
                    </button>
                  </div>
                </div>
              {{else}}
                <button class="os-delete-org-btn" type="button" {{on "click" this.toggleDeleteConfirm}}>
                  <IconTrash />
                  Delete Organization
                </button>
              {{/if}}
            </div>
          {{/if}}
        {{else}}
          <div class="os-not-found">
            <p>Organization not found or you don't have access.</p>
            <button class="os-back-link" type="button" {{on "click" this.goBack}}>Go back to projects</button>
          </div>
        {{/if}}
      </div>
    </div>
  </template>

  isCurrentUser = (userId: string): boolean => {
    return this.authService.uid === userId;
  };

  get isEditorRole(): boolean {
    return this.inviteRole === "editor";
  }

  get isSingleMember(): boolean {
    return this.members.length === 1;
  }

  formatJoinedDate = (dateStr: string): string => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };
}
