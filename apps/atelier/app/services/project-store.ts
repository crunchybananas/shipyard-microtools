import Service, { inject as service } from "@ember/service";
import { tracked } from "@glimmer/tracking";
import type AuthService from "atelier/services/auth-service";
import type OrgService from "atelier/services/org-service";
import type { DesignElement } from "atelier/services/design-store";
import {
  listProjects as fsListProjects,
  listSharedProjects as fsListSharedProjects,
  getProject as fsGetProject,
  createProject as fsCreateProject,
  saveProject as fsSaveProject,
  deleteProject as fsDeleteProject,
  shareProject as fsShareProject,
  unshareProject as fsUnshareProject,
  getProjectCollaborators as fsGetProjectCollaborators,
} from "atelier/utils/firestore-adapter";

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  elementCount: number;
  orgId?: string | null;
  ownerId?: string;
  collaboratorEmails?: string[];
}

const STORAGE_KEY = "atelier-projects";
const ELEMENTS_KEY_PREFIX = "atelier-elements-";

const SEED_PROJECTS: Project[] = [
  {
    id: "example-landing-page",
    name: "Landing Page",
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    elementCount: 46,
  },
  {
    id: "example-mobile-app",
    name: "Mobile App",
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    elementCount: 38,
  },
  {
    id: "example-dashboard",
    name: "Dashboard",
    createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    elementCount: 52,
  },
];

export default class ProjectStoreService extends Service {
  @service declare authService: AuthService;
  @service declare orgService: OrgService;

  @tracked projects: Project[] = [];
  @tracked sharedProjects: Project[] = [];
  @tracked currentProjectId: string | null = null;
  @tracked isSyncing: boolean = false;
  @tracked isInitialLoading: boolean = true;
  @tracked activeTab: "my" | "shared" = "my";

  private _migrated = false;

  constructor(properties: object | undefined) {
    super(properties);
    this.loadLocalProjects();
  }

  // --- localStorage helpers ---

  private loadLocalProjects(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.projects = JSON.parse(raw);
      } else {
        this.projects = [...SEED_PROJECTS];
        this.saveLocal();
      }
    } catch {
      this.projects = [...SEED_PROJECTS];
      this.saveLocal();
    }
  }

  private saveLocal(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.projects));
    } catch {
      // ignore storage errors
    }
  }

  private getLocalElements(projectId: string): DesignElement[] {
    try {
      const raw = localStorage.getItem(ELEMENTS_KEY_PREFIX + projectId);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private setLocalElements(projectId: string, elements: DesignElement[]): void {
    try {
      localStorage.setItem(ELEMENTS_KEY_PREFIX + projectId, JSON.stringify(elements));
    } catch {
      // ignore
    }
  }

  // --- Public API ---

  async loadProjects(): Promise<void> {
    if (this.authService.isAuthenticated && this.authService.uid) {
      this.isSyncing = true;
      try {
        // Migrate localStorage projects on first sign-in
        if (!this._migrated) {
          await this.migrateLocalToFirestore();
          this._migrated = true;
        }

        const orgId = this.orgService.activeOrgId;
        const firestoreProjects = await fsListProjects(this.authService.uid, orgId);
        this.projects = firestoreProjects;
      } catch (e) {
        console.error("Failed to load projects from Firestore:", e);
        // Fall back to local
        this.loadLocalProjects();
      } finally {
        this.isSyncing = false;
        this.isInitialLoading = false;
      }
    } else {
      this.loadLocalProjects();
      this.isInitialLoading = false;
    }
  }

  async loadSharedProjects(): Promise<void> {
    if (!this.authService.isAuthenticated || !this.authService.email) {
      this.sharedProjects = [];
      return;
    }

    try {
      const shared = await fsListSharedProjects(this.authService.email);
      this.sharedProjects = shared;
    } catch (e) {
      console.error("Failed to load shared projects:", e);
      this.sharedProjects = [];
    }
  }

  async createProject(name?: string): Promise<Project> {
    const projectName = name || "Untitled Project";

    if (this.authService.isAuthenticated && this.authService.uid) {
      this.isSyncing = true;
      try {
        const orgId = this.orgService.activeOrgId;
        const id = await fsCreateProject(this.authService.uid, projectName, [], orgId);
        const project: Project = {
          id,
          name: projectName,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          elementCount: 0,
          orgId,
        };
        this.projects = [project, ...this.projects];
        return project;
      } finally {
        this.isSyncing = false;
      }
    } else {
      const project: Project = {
        id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: projectName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        elementCount: 0,
      };
      this.projects = [project, ...this.projects];
      this.saveLocal();
      return project;
    }
  }

  listProjects(): Project[] {
    return this.projects;
  }

  async deleteProject(id: string): Promise<void> {
    if (this.authService.isAuthenticated) {
      try {
        await fsDeleteProject(id);
      } catch (e) {
        console.error("Failed to delete project from Firestore:", e);
      }
    } else {
      try {
        localStorage.removeItem(ELEMENTS_KEY_PREFIX + id);
      } catch {
        // ignore
      }
    }
    this.projects = this.projects.filter((p) => p.id !== id);
    this.saveLocal();
  }

  getProject(id: string): Project | undefined {
    return this.projects.find((p) => p.id === id) ?? this.sharedProjects.find((p) => p.id === id);
  }

  updateProject(id: string, updates: Partial<Project>): void {
    this.projects = this.projects.map((p) =>
      p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p,
    );
    if (!this.authService.isAuthenticated) {
      this.saveLocal();
    }
  }

  async loadProject(id: string): Promise<DesignElement[]> {
    if (this.authService.isAuthenticated) {
      try {
        const result = await fsGetProject(id);
        if (result) return result.elements;
        return [];
      } catch (e) {
        console.error("Failed to load project from Firestore:", e);
        return this.getLocalElements(id);
      }
    } else {
      return this.getLocalElements(id);
    }
  }

  async saveProject(id: string, elements: DesignElement[]): Promise<void> {
    // Update local project metadata
    this.updateProject(id, { elementCount: elements.length });

    if (this.authService.isAuthenticated) {
      try {
        await fsSaveProject(id, elements);
      } catch (e) {
        console.error("Failed to save project to Firestore:", e);
        // Fall back to local save
        this.setLocalElements(id, elements);
      }
    } else {
      this.setLocalElements(id, elements);
    }
  }

  // --- Sharing ---

  async shareProject(projectId: string, email: string): Promise<void> {
    try {
      await fsShareProject(projectId, email);
    } catch (e) {
      console.error("Failed to share project:", e);
    }
  }

  async unshareProject(projectId: string, email: string): Promise<void> {
    try {
      await fsUnshareProject(projectId, email);
    } catch (e) {
      console.error("Failed to unshare project:", e);
    }
  }

  async getProjectCollaborators(projectId: string): Promise<string[]> {
    try {
      return await fsGetProjectCollaborators(projectId);
    } catch (e) {
      console.error("Failed to get collaborators:", e);
      return [];
    }
  }

  // --- Migration ---

  private async migrateLocalToFirestore(): Promise<void> {
    if (!this.authService.uid) return;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const localProjects: Project[] = JSON.parse(raw);
      if (localProjects.length === 0) return;

      // Check if user already has Firestore projects
      const existing = await fsListProjects(this.authService.uid);
      if (existing.length > 0) return; // Already has projects, skip migration

      for (const project of localProjects) {
        const elements = this.getLocalElements(project.id);
        await fsCreateProject(this.authService.uid, project.name, elements);
      }
    } catch (e) {
      console.error("Migration failed:", e);
    }
  }
}
