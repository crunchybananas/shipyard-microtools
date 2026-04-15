import Route from "@ember/routing/route";
import type RouterService from "@ember/routing/router-service";
import { inject as service } from "@ember/service";
import type WorkspaceStoreService from "harbor-chat/services/workspace-store";

/**
 * Index route initializes data then redirects to the
 * first workspace's first channel.
 */
export default class IndexRoute extends Route {
  @service declare router: RouterService;
  @service declare workspaceStore: WorkspaceStoreService;

  async beforeModel() {
    await this.workspaceStore.initialize();

    const firstWorkspace = this.workspaceStore.workspaces[0];
    if (firstWorkspace) {
      const firstChannel = this.workspaceStore.channelsForWorkspace(
        firstWorkspace.id,
      )[0];
      if (firstChannel) {
        this.router.transitionTo(
          "workspace.channel",
          firstWorkspace.id,
          firstChannel.id,
        );
        return;
      }
      this.router.transitionTo("workspace", firstWorkspace.id);
    }
  }
}
