import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import { fn } from "@ember/helper";
import { inject as service } from "@ember/service";
import type ProjectStoreService from "atelier/services/project-store";
import type { Project } from "atelier/services/project-store";
import type AuthService from "atelier/services/auth-service";

const IconSparkles = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z"/><path d="M19 15l.5 2 2 .5-2 .5-.5 2-.5-2-2-.5 2-.5.5-2z"/></svg></template>;
const IconPlus = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></template>;
const IconTrash = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></template>;
const IconSearch = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></template>;
const IconFrame = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg></template>;
const IconRect = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="1"/></svg></template>;
const IconGrid = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg></template>;
const IconSignOut = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></template>;

export default class ProjectsHome extends Component {
  @service declare projectStore: ProjectStoreService;
  @service declare authService: AuthService;

  @tracked searchQuery: string = "";
  @tracked authMode: "signin" | "signup" = "signin";
  @tracked emailInput: string = "";
  @tracked passwordInput: string = "";
  @tracked showUserMenu: boolean = false;

  constructor(owner: unknown, args: Record<string, never>) {
    super(owner, args);
    // Load projects (async for Firestore)
    void this.initProjects();
  }

  private async initProjects(): Promise<void> {
    await this.authService.authReady;
    await this.projectStore.loadProjects();
  }

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

  createNewProject = async () => {
    const project = await this.projectStore.createProject();
    window.location.hash = `#/editor/${project.id}`;
  };

  openProject = (id: string) => {
    window.location.hash = `#/editor/${id}`;
  };

  deleteProject = async (id: string, e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    await this.projectStore.deleteProject(id);
  };

  createFromExample = async (type: string) => {
    const names: Record<string, string> = {
      "landing": "Landing Page",
      "mobile": "Mobile App",
      "dashboard": "Dashboard",
    };
    const project = await this.projectStore.createProject(names[type] || "New Project");
    // Store the template hint so the editor can generate it
    try {
      localStorage.setItem(`atelier-template-${project.id}`, type);
    } catch {
      // ignore
    }
    window.location.hash = `#/editor/${project.id}`;
  };

  // Auth actions
  signInWithGoogle = async () => {
    await this.authService.signInWithGoogle();
    if (this.authService.isAuthenticated) {
      await this.projectStore.loadProjects();
    }
  };

  submitEmailAuth = async (e: Event) => {
    e.preventDefault();
    if (!this.emailInput || !this.passwordInput) return;

    if (this.authMode === "signin") {
      await this.authService.signInWithEmail(this.emailInput, this.passwordInput);
    } else {
      await this.authService.signUpWithEmail(this.emailInput, this.passwordInput);
    }

    if (this.authService.isAuthenticated) {
      this.emailInput = "";
      this.passwordInput = "";
      await this.projectStore.loadProjects();
    }
  };

  toggleAuthMode = () => {
    this.authMode = this.authMode === "signin" ? "signup" : "signin";
    this.authService.error = null;
  };

  onEmailInput = (e: Event) => {
    this.emailInput = (e.target as HTMLInputElement).value;
  };

  onPasswordInput = (e: Event) => {
    this.passwordInput = (e.target as HTMLInputElement).value;
  };

  signOut = async () => {
    this.showUserMenu = false;
    await this.authService.signOut();
    await this.projectStore.loadProjects();
  };

  toggleUserMenu = () => {
    this.showUserMenu = !this.showUserMenu;
  };

  closeUserMenu = () => {
    this.showUserMenu = false;
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
          {{#if this.authService.isAuthenticated}}
            <button class="ph-btn-primary" type="button" {{on "click" this.createNewProject}}>
              <IconPlus />
              New Project
            </button>
            <div class="ph-user-menu-wrapper">
              <button class="ph-user-avatar-btn" type="button" {{on "click" this.toggleUserMenu}}>
                {{#if this.authService.photoURL}}
                  <img class="ph-user-avatar-img" src={{this.authService.photoURL}} alt="avatar" />
                {{else}}
                  <span class="ph-user-avatar-initials">{{this.authService.initials}}</span>
                {{/if}}
              </button>
              {{#if this.showUserMenu}}
                <div class="ph-user-dropdown">
                  <div class="ph-user-dropdown-header">
                    <div class="ph-user-dropdown-name">{{this.authService.displayName}}</div>
                    <div class="ph-user-dropdown-email">{{this.authService.email}}</div>
                  </div>
                  <div class="ph-user-dropdown-divider"></div>
                  <button class="ph-user-dropdown-item" type="button" {{on "click" this.signOut}}>
                    <IconSignOut />
                    Sign out
                  </button>
                </div>
              {{/if}}
            </div>
          {{else}}
            <button class="ph-btn-primary" type="button" {{on "click" this.createNewProject}}>
              <IconPlus />
              New Project
            </button>
          {{/if}}
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

      {{! Auth Section - shown when not authenticated }}
      {{#unless this.authService.isAuthenticated}}
        {{#unless this.authService.isLoading}}
          <div class="ph-auth-section">
            <div class="ph-auth-card">
              <h3 class="ph-auth-title">
                {{if (this.isSignIn this.authMode) "Sign in to sync your projects" "Create an account"}}
              </h3>
              <p class="ph-auth-subtitle">Save your work to the cloud and access it from anywhere.</p>

              <button class="ph-google-btn" type="button" {{on "click" this.signInWithGoogle}}>
                <svg class="ph-google-logo" viewBox="0 0 24 24" width="18" height="18">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>

              <div class="ph-auth-divider">
                <span>or</span>
              </div>

              <form class="ph-auth-form" {{on "submit" this.submitEmailAuth}}>
                <input
                  class="ph-auth-input"
                  type="email"
                  placeholder="Email address"
                  value={{this.emailInput}}
                  autocomplete="email"
                  {{on "input" this.onEmailInput}}
                />
                <input
                  class="ph-auth-input"
                  type="password"
                  placeholder="Password"
                  value={{this.passwordInput}}
                  autocomplete={{if (this.isSignIn this.authMode) "current-password" "new-password"}}
                  {{on "input" this.onPasswordInput}}
                />

                {{#if this.authService.error}}
                  <div class="ph-auth-error">{{this.authService.error}}</div>
                {{/if}}

                <button class="ph-auth-submit" type="submit">
                  {{if (this.isSignIn this.authMode) "Sign in" "Create account"}}
                </button>
              </form>

              <button class="ph-auth-toggle" type="button" {{on "click" this.toggleAuthMode}}>
                {{if (this.isSignIn this.authMode)
                  "Don't have an account? Sign up"
                  "Already have an account? Sign in"
                }}
              </button>
            </div>
          </div>
        {{/unless}}
      {{/unless}}

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

        {{! Loading state }}
        {{#if this.projectStore.isSyncing}}
          <div class="ph-syncing-indicator">
            <div class="ph-syncing-spinner"></div>
            Syncing projects...
          </div>
        {{/if}}

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

  isSignIn = (mode: string): boolean => mode === "signin";
}
