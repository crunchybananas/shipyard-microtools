import Route from "@ember/routing/route";
import { inject as service } from "@ember/service";
import type OrgService from "atelier/services/org-service";
import type AuthService from "atelier/services/auth-service";

export default class OrgSettingsRoute extends Route {
  @service declare orgService: OrgService;
  @service declare authService: AuthService;

  async model(params: { org_id: string }) {
    await this.authService.authReady;

    if (!this.authService.isAuthenticated) {
      window.location.hash = "#/";
      return null;
    }

    // Ensure orgs are loaded
    if (this.orgService.organizations.length === 0) {
      await this.orgService.loadOrganizations();
    }

    // Load members and invites
    await this.orgService.getMembers(params.org_id);
    await this.orgService.getInvites(params.org_id);

    return params.org_id;
  }
}
