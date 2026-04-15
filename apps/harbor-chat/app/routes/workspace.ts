import Route from "@ember/routing/route";
import { inject as service } from "@ember/service";
import type RouterService from "@ember/routing/router-service";
import type WorkspaceStoreService from "harbor-chat/services/workspace-store";
import type MessageStoreService from "harbor-chat/services/message-store";
import type AuthService from "harbor-chat/services/auth-service";
import type { Workspace, Channel, User } from "harbor-chat/harbor-chat/types";

export interface WorkspaceModel {
  workspace: Workspace;
  channels: Channel[];
  dms: Channel[];
  members: User[];
}

/**
 * Workspace route loads workspace-level data into the model.
 * If the workspace ID in the URL is stale/invalid, redirects
 * to the index route which picks the first valid workspace.
 */
export default class WorkspaceRoute extends Route {
  @service declare router: RouterService;
  @service declare workspaceStore: WorkspaceStoreService;
  @service declare messageStore: MessageStoreService;
  @service declare authService: AuthService;

  async model(params: { workspace_id: string }): Promise<WorkspaceModel> {
    await this.workspaceStore.initialize();

    const workspace = this.workspaceStore.getWorkspaceById(
      params.workspace_id,
    );

    // Stale URL (e.g. mock ID "w1") — redirect to first real workspace
    if (!workspace) {
      const firstWs = this.workspaceStore.workspaces[0];
      if (firstWs) {
        const firstCh = this.workspaceStore.channelsForWorkspace(firstWs.id)[0];
        if (firstCh) {
          this.router.transitionTo("workspace.channel", firstWs.id, firstCh.id);
        } else {
          this.router.transitionTo("workspace", firstWs.id);
        }
      } else {
        this.router.transitionTo("index");
      }
      return {
        workspace: {} as Workspace,
        channels: [],
        dms: [],
        members: [],
      };
    }

    const channels = this.workspaceStore.channelsForWorkspace(workspace.id);
    const dms = this.workspaceStore.dmsForWorkspace(workspace.id);

    // Load unread counts for all channels (non-blocking)
    const allChannelIds = [...channels, ...dms].map((c) => c.id);
    this.messageStore.loadUnreadCounts(allChannelIds);

    return {
      workspace,
      channels,
      dms,
      members: this.workspaceStore.membersForWorkspace(workspace.id),
    };
  }
}
