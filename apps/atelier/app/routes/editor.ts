import Route from "@ember/routing/route";
import { inject as service } from "@ember/service";
import type DesignStoreService from "atelier/services/design-store";
import type ProjectStoreService from "atelier/services/project-store";
import type AuthService from "atelier/services/auth-service";

export default class EditorRoute extends Route {
  @service declare designStore: DesignStoreService;
  @service declare projectStore: ProjectStoreService;
  @service declare authService: AuthService;

  async model(params: { project_id: string }) {
    const projectId = params.project_id;

    // Wait for auth to settle before loading
    await this.authService.authReady;

    // Load the project elements into the design store
    await this.designStore.loadProject(projectId);

    return projectId;
  }

  deactivate(): void {
    this.designStore.unloadProject();
  }
}
