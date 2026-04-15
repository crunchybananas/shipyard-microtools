import Route from "@ember/routing/route";
import { inject as service } from "@ember/service";
import type RouterService from "@ember/routing/router-service";
import type AuthService from "harbor-chat/services/auth-service";
import type WorkspaceStoreService from "harbor-chat/services/workspace-store";
import {
  getInviteById,
  acceptInvite,
  type WorkspaceInvite,
} from "harbor-chat/utils/firestore-adapter";

export interface InviteModel {
  invite: WorkspaceInvite | null;
  error: string | null;
}

/**
 * Invite route — loads an invite by ID from the URL.
 * If the user is already authenticated, auto-accepts and redirects
 * to the workspace. If not, shows a sign-up/sign-in screen with
 * the invite context.
 */
export default class InviteRoute extends Route {
  @service declare router: RouterService;
  @service declare authService: AuthService;
  @service declare workspaceStore: WorkspaceStoreService;

  async model(params: { invite_id: string }): Promise<InviteModel> {
    try {
      const invite = await getInviteById(params.invite_id);

      if (!invite) {
        return { invite: null, error: "This invite link is invalid or has expired." };
      }

      if (invite.status !== "pending") {
        return { invite, error: "This invite has already been used." };
      }

      // If already authenticated, accept the invite and redirect
      await this.authService.authReady;
      if (this.authService.isAuthenticated && this.authService.uid) {
        await acceptInvite(invite.id, invite.workspaceId, this.authService.uid);
        // Reload workspace data then redirect
        await this.workspaceStore.reload();
        this.router.transitionTo("workspace", invite.workspaceId);
        return { invite, error: null };
      }

      return { invite, error: null };
    } catch (e) {
      return { invite: null, error: "Failed to load invite." };
    }
  }
}
