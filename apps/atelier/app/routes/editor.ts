import Route from "@ember/routing/route";
import { inject as service } from "@ember/service";
import type DesignStoreService from "atelier/services/design-store";
import type ProjectStoreService from "atelier/services/project-store";
import type AuthService from "atelier/services/auth-service";
import type AiServiceService from "atelier/services/ai-service";

export default class EditorRoute extends Route {
  @service declare designStore: DesignStoreService;
  @service declare projectStore: ProjectStoreService;
  @service declare authService: AuthService;
  @service declare aiService: AiServiceService;

  async model(params: { project_id: string }) {
    const projectId = params.project_id;

    // Wait for auth to settle before loading
    await this.authService.authReady;

    // Load the project elements into the design store
    await this.designStore.loadProject(projectId);

    // Check if this project was created from a template
    const templateKey = `atelier-template-${projectId}`;
    const templateType = localStorage.getItem(templateKey);
    if (templateType && this.designStore.elements.length === 0) {
      localStorage.removeItem(templateKey);
      // Map template card types to AI service template names
      const templateMap: Record<string, string> = {
        "landing": "landing page",
        "mobile": "mobile app",
        "dashboard": "dashboard",
        "pricing": "pricing page",
        "signup": "signup",
        "ecommerce": "ecommerce",
        "blog": "blog",
      };
      const prompt = templateMap[templateType] ?? templateType;
      // Generate using the template system (not Claude API)
      void this.aiService.generateFromPrompt(prompt);
    }

    return projectId;
  }

  deactivate(): void {
    this.designStore.unloadProject();
  }
}
