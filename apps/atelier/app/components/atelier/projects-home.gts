import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import { fn } from "@ember/helper";
import { inject as service } from "@ember/service";
import type ProjectStoreService from "atelier/services/project-store";
import type { Project } from "atelier/services/project-store";

const IconSparkles = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z"/><path d="M19 15l.5 2 2 .5-2 .5-.5 2-.5-2-2-.5 2-.5.5-2z"/></svg></template>;
const IconPlus = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></template>;
const IconTrash = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></template>;
const IconSearch = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></template>;
const IconFrame = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg></template>;
const IconRect = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="1"/></svg></template>;
const IconGrid = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg></template>;

export default class ProjectsHome extends Component {
  @service declare projectStore: ProjectStoreService;

  @tracked searchQuery: string = "";

  get filteredProjects(): Project[] {
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) return this.projectStore.projects;
    return this.projectStore.projects.filter((p) =>
      p.name.toLowerCase().includes(q),
    );
  }

  formatDate = (dateStr: string): string => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  onSearchInput = (e: Event) => {
    this.searchQuery = (e.target as HTMLInputElement).value;
  };

  createNewProject = () => {
    const project = this.projectStore.createProject();
    window.location.hash = `#/editor/${project.id}`;
  };

  openProject = (id: string) => {
    window.location.hash = `#/editor/${id}`;
  };

  deleteProject = (id: string, e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    this.projectStore.deleteProject(id);
  };

  createFromExample = (type: string) => {
    const names: Record<string, string> = {
      "landing": "Landing Page",
      "mobile": "Mobile App",
      "dashboard": "Dashboard",
    };
    const project = this.projectStore.createProject(names[type] || "New Project");
    // Store the template hint so the editor can generate it
    try {
      localStorage.setItem(`atelier-template-${project.id}`, type);
    } catch {
      // ignore
    }
    window.location.hash = `#/editor/${project.id}`;
  };

  <template>
    <div class="projects-home">
      {{! Navigation }}
      <nav class="ph-nav">
        <div class="ph-nav-logo">
          <div class="ph-nav-logo-icon">
            <IconSparkles />
          </div>
          <span>Atelier</span>
        </div>
        <div class="ph-nav-actions">
          <button class="ph-btn-primary" type="button" {{on "click" this.createNewProject}}>
            <IconPlus />
            New Project
          </button>
        </div>
      </nav>

      {{! Hero Section }}
      <div class="ph-hero">
        <div class="ph-hero-content">
          <h1 class="ph-hero-title">
            Welcome to <span class="ph-hero-accent">Atelier</span>
          </h1>
          <p class="ph-hero-subtitle">
            Design beautiful interfaces with AI-powered generation. Start from scratch or pick a template below.
          </p>
        </div>
      </div>

      {{! Main Content }}
      <div class="ph-content">
        {{! Search Bar }}
        <div class="ph-search-container">
          <div class="ph-search">
            <span class="ph-search-icon"><IconSearch /></span>
            <input
              class="ph-search-input"
              type="text"
              placeholder="Search projects..."
              value={{this.searchQuery}}
              {{on "input" this.onSearchInput}}
            />
          </div>
        </div>

        {{! My Projects }}
        <div class="ph-section">
          <div class="ph-section-header">
            <h2 class="ph-section-title">My Projects</h2>
            <span class="ph-section-count">{{this.filteredProjects.length}} projects</span>
          </div>

          <div class="ph-projects-grid">
            {{! New Project Card }}
            <button class="ph-card ph-card-new" type="button" {{on "click" this.createNewProject}}>
              <div class="ph-card-new-icon">
                <IconPlus />
              </div>
              <span class="ph-card-new-label">New Project</span>
            </button>

            {{#each this.filteredProjects as |project|}}
              <div
                class="ph-card"
                role="button"
                {{on "click" (fn this.openProject project.id)}}
              >
                <div class="ph-card-preview">
                  <div class="ph-card-preview-inner">
                    <div class="ph-card-preview-mock-1"></div>
                    <div class="ph-card-preview-mock-2"></div>
                    <div class="ph-card-preview-mock-3"></div>
                  </div>
                </div>
                <div class="ph-card-info">
                  <div class="ph-card-name">{{project.name}}</div>
                  <div class="ph-card-meta">
                    <span>{{this.formatDate project.updatedAt}}</span>
                    <span class="ph-card-dot"></span>
                    <span>{{project.elementCount}} elements</span>
                  </div>
                </div>
                <button
                  class="ph-card-delete"
                  type="button"
                  title="Delete project"
                  {{on "click" (fn this.deleteProject project.id)}}
                >
                  <IconTrash />
                </button>
              </div>
            {{/each}}
          </div>
        </div>

        {{! Examples Section }}
        <div class="ph-section">
          <div class="ph-section-header">
            <h2 class="ph-section-title">Examples</h2>
            <span class="ph-section-count">Start with a template</span>
          </div>

          <div class="ph-examples-grid">
            <button class="ph-example-card" type="button" {{on "click" (fn this.createFromExample "landing")}}>
              <div class="ph-example-preview ph-example-landing">
                <div class="ph-ex-nav"></div>
                <div class="ph-ex-hero-text"></div>
                <div class="ph-ex-hero-sub"></div>
                <div class="ph-ex-buttons">
                  <div class="ph-ex-btn-primary"></div>
                  <div class="ph-ex-btn-secondary"></div>
                </div>
                <div class="ph-ex-cards-row">
                  <div class="ph-ex-card"></div>
                  <div class="ph-ex-card"></div>
                  <div class="ph-ex-card"></div>
                </div>
              </div>
              <div class="ph-example-info">
                <div class="ph-example-icon"><IconFrame /></div>
                <div>
                  <div class="ph-example-name">Landing Page</div>
                  <div class="ph-example-desc">SaaS landing with hero, features, stats</div>
                </div>
              </div>
            </button>

            <button class="ph-example-card" type="button" {{on "click" (fn this.createFromExample "mobile")}}>
              <div class="ph-example-preview ph-example-mobile">
                <div class="ph-ex-phone">
                  <div class="ph-ex-island"></div>
                  <div class="ph-ex-greeting"></div>
                  <div class="ph-ex-balance-card"></div>
                  <div class="ph-ex-tx"></div>
                  <div class="ph-ex-tx"></div>
                  <div class="ph-ex-tx"></div>
                </div>
              </div>
              <div class="ph-example-info">
                <div class="ph-example-icon"><IconRect /></div>
                <div>
                  <div class="ph-example-name">Mobile App</div>
                  <div class="ph-example-desc">Banking app with balance, transactions</div>
                </div>
              </div>
            </button>

            <button class="ph-example-card" type="button" {{on "click" (fn this.createFromExample "dashboard")}}>
              <div class="ph-example-preview ph-example-dashboard">
                <div class="ph-ex-sidebar"></div>
                <div class="ph-ex-main">
                  <div class="ph-ex-stats-row">
                    <div class="ph-ex-stat"></div>
                    <div class="ph-ex-stat"></div>
                    <div class="ph-ex-stat"></div>
                  </div>
                  <div class="ph-ex-chart"></div>
                  <div class="ph-ex-table"></div>
                </div>
              </div>
              <div class="ph-example-info">
                <div class="ph-example-icon"><IconGrid /></div>
                <div>
                  <div class="ph-example-name">Dashboard</div>
                  <div class="ph-example-desc">Analytics with charts, stats, data table</div>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  </template>
}
