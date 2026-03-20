import Service from "@ember/service";
import { tracked } from "@glimmer/tracking";

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  elementCount: number;
}

const STORAGE_KEY = "atelier-projects";

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
  @tracked projects: Project[] = [];

  constructor(properties: object | undefined) {
    super(properties);
    this.loadProjects();
  }

  private loadProjects(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.projects = JSON.parse(raw);
      } else {
        this.projects = [...SEED_PROJECTS];
        this.save();
      }
    } catch {
      this.projects = [...SEED_PROJECTS];
      this.save();
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.projects));
    } catch {
      // ignore storage errors
    }
  }

  createProject(name?: string): Project {
    const project: Project = {
      id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: name || "Untitled Project",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      elementCount: 0,
    };
    this.projects = [project, ...this.projects];
    this.save();
    return project;
  }

  listProjects(): Project[] {
    return this.projects;
  }

  deleteProject(id: string): void {
    this.projects = this.projects.filter((p) => p.id !== id);
    this.save();
  }

  getProject(id: string): Project | undefined {
    return this.projects.find((p) => p.id === id);
  }

  updateProject(id: string, updates: Partial<Project>): void {
    this.projects = this.projects.map((p) =>
      p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p,
    );
    this.save();
  }
}
