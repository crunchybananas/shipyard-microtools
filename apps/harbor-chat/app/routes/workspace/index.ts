import Route from "@ember/routing/route";
import type RouterService from "@ember/routing/router-service";
import { inject as service } from "@ember/service";
import type WorkspaceStoreService from "harbor-chat/services/workspace-store";
import type { WorkspaceModel } from "harbor-chat/routes/workspace";

/**
 * When visiting /workspace/:id without a channel,
 * redirect to the first channel in that workspace.
 */
export default class WorkspaceIndexRoute extends Route {
  @service declare router: RouterService;
  @service declare workspaceStore: WorkspaceStoreService;

  beforeModel() {
    const parentModel = this.modelFor("workspace") as WorkspaceModel;
    const firstChannel = parentModel.channels[0];
    if (firstChannel) {
      this.router.transitionTo(
        "workspace.channel",
        parentModel.workspace.id,
        firstChannel.id,
      );
    }
  }
}
