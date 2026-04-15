import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { inject as service } from "@ember/service";
import { on } from "@ember/modifier";
import type WorkspaceStoreService from "harbor-chat/services/workspace-store";
import type AuthService from "harbor-chat/services/auth-service";
import {
  createInvite,
  createLinkInvite,
  listInvitesForWorkspace,
  type WorkspaceInvite,
} from "harbor-chat/utils/firestore-adapter";

interface InvitePanelSignature {
  Args: {
    workspaceId: string;
    workspaceName: string;
  };
}

export default class InvitePanel extends Component<InvitePanelSignature> {
  @service declare workspaceStore: WorkspaceStoreService;
  @service declare authService: AuthService;

  @tracked emailInput = "";
  @tracked isSubmitting = false;
  @tracked successMessage = "";
  @tracked errorMessage = "";
  @tracked invites: WorkspaceInvite[] = [];
  @tracked isOpen = false;
  @tracked inviteLink = "";
  @tracked linkCopied = false;

  toggle = async () => {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      await this.loadInvites();
    }
  };

  loadInvites = async () => {
    try {
      this.invites = await listInvitesForWorkspace(this.args.workspaceId);
    } catch {
      // ignore
    }
  };

  handleEmail = (e: Event) => {
    this.emailInput = (e.target as HTMLInputElement).value;
    this.successMessage = "";
    this.errorMessage = "";
  };

  sendInvite = async (e: Event) => {
    e.preventDefault();
    const email = this.emailInput.trim().toLowerCase();
    if (!email) return;

    this.isSubmitting = true;
    this.errorMessage = "";
    this.successMessage = "";

    try {
      await createInvite({
        workspaceId: this.args.workspaceId,
        workspaceName: this.args.workspaceName,
        email,
        invitedBy: this.authService.uid ?? "",
        invitedByName: this.authService.displayName ?? this.authService.email ?? "Someone",
      });
      this.successMessage = `Invite sent to ${email}`;
      this.emailInput = "";
      await this.loadInvites();
    } catch (err: unknown) {
      const error = err as { message?: string };
      this.errorMessage = error.message ?? "Failed to send invite.";
    }

    this.isSubmitting = false;
  };

  generateLink = async () => {
    this.linkCopied = false;
    try {
      const inviteId = await createLinkInvite({
        workspaceId: this.args.workspaceId,
        workspaceName: this.args.workspaceName,
        invitedBy: this.authService.uid ?? "",
        invitedByName: this.authService.displayName ?? this.authService.email ?? "Someone",
      });
      const baseUrl = window.location.origin + window.location.pathname;
      this.inviteLink = `${baseUrl}#/invite/${inviteId}`;

      // Copy to clipboard
      await navigator.clipboard.writeText(this.inviteLink);
      this.linkCopied = true;
      setTimeout(() => { this.linkCopied = false; }, 3000);

      await this.loadInvites();
    } catch {
      this.errorMessage = "Failed to generate invite link.";
    }
  };

  get pendingInvites(): WorkspaceInvite[] {
    return this.invites.filter((i) => i.status === "pending");
  }

  get acceptedInvites(): WorkspaceInvite[] {
    return this.invites.filter((i) => i.status === "accepted");
  }

  <template>
    <div class="invite-section">
      <button class="section-header" {{on "click" this.toggle}}>
        <span class="section-caret {{if this.isOpen '' 'collapsed'}}">&#9662;</span>
        <span>Invite People</span>
      </button>

      {{#if this.isOpen}}
        <div style="padding: 0 16px 12px;">

          {{!-- Invite link --}}
          <button class="invite-link-btn" {{on "click" this.generateLink}}>
            {{if this.linkCopied "✅ Link copied!" "🔗 Copy invite link"}}
          </button>

          {{#if this.inviteLink}}
            <div class="invite-link-display">
              <code>{{this.inviteLink}}</code>
            </div>
          {{/if}}

          <div class="invite-divider">
            <span>or invite by email</span>
          </div>

          {{!-- Email invite --}}
          <form class="invite-form" {{on "submit" this.sendInvite}}>
            <input
              class="invite-input"
              type="email"
              placeholder="name@email.com"
              value={{this.emailInput}}
              {{on "input" this.handleEmail}}
            />
            <button class="invite-btn" type="submit" disabled={{this.isSubmitting}}>
              {{if this.isSubmitting "..." "Invite"}}
            </button>
          </form>

          {{#if this.successMessage}}
            <div class="invite-success">{{this.successMessage}}</div>
          {{/if}}
          {{#if this.errorMessage}}
            <div class="invite-error">{{this.errorMessage}}</div>
          {{/if}}

          {{#if this.pendingInvites.length}}
            <div class="pending-invites">
              <div class="pending-invites-label">Pending</div>
              {{#each this.pendingInvites as |invite|}}
                <div class="pending-invite-item">
                  <span class="pending-invite-email">{{if invite.email invite.email "link invite"}}</span>
                  <span class="pending-invite-status">pending</span>
                </div>
              {{/each}}
            </div>
          {{/if}}

          {{#if this.acceptedInvites.length}}
            <div class="pending-invites">
              <div class="pending-invites-label">Joined</div>
              {{#each this.acceptedInvites as |invite|}}
                <div class="pending-invite-item">
                  <span class="pending-invite-email">{{if invite.email invite.email "link invite"}}</span>
                  <span class="pending-invite-status joined">joined</span>
                </div>
              {{/each}}
            </div>
          {{/if}}
        </div>
      {{/if}}
    </div>
  </template>
}
