import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import { fn } from "@ember/helper";
import { inject as service } from "@ember/service";
import type ProjectStoreService from "atelier/services/project-store";
import type { Project } from "atelier/services/project-store";
import type AuthService from "atelier/services/auth-service";
import type OrgService from "atelier/services/org-service";
import type RouterService from "@ember/routing/router-service";

const IconSparkles = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z"/><path d="M19 15l.5 2 2 .5-2 .5-.5 2-.5-2-2-.5 2-.5.5-2z"/></svg></template>;
const IconPlus = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></template>;
const IconTrash = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></template>;
const IconSearch = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></template>;
const IconFrame = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg></template>;
const IconRect = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="1"/></svg></template>;
const IconGrid = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg></template>;
const IconSignOut = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></template>;
const IconChevronDown = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></template>;
const IconUser = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></template>;
const IconBuilding = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="9" y1="6" x2="9" y2="6.01"/><line x1="15" y1="6" x2="15" y2="6.01"/><line x1="9" y1="10" x2="9" y2="10.01"/><line x1="15" y1="10" x2="15" y2="10.01"/><line x1="9" y1="14" x2="9" y2="14.01"/><line x1="15" y1="14" x2="15" y2="14.01"/><line x1="9" y1="18" x2="15" y2="18"/></svg></template>;
const IconSettings = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></template>;
const IconShare = <template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg></template>;

export default class ProjectsHome extends Component {
  @service declare projectStore: ProjectStoreService;
  @service declare authService: AuthService;
  @service declare orgService: OrgService;
  @service declare router: RouterService;

  @tracked searchQuery: string = "";
  @tracked authMode: "signin" | "signup" = "signin";
  @tracked emailInput: string = "";
  @tracked passwordInput: string = "";
  @tracked showUserMenu: boolean = false;
  @tracked showWorkspaceSwitcher: boolean = false;
  @tracked showCreateOrgModal: boolean = false;
  @tracked newOrgName: string = "";

  constructor(owner: unknown, args: Record<string, never>) {
    super(owner, args);
    void this.initProjects();
  }

  private async initProjects(): Promise<void> {
    await this.authService.authReady;
    if (this.authService.isAuthenticated) {
      await this.orgService.loadOrganizations();
      await this.orgService.checkPendingInvites();
    }
    await this.projectStore.loadProjects();
    if (this.authService.isAuthenticated) {
      await this.projectStore.loadSharedProjects();
    }
  }

  get filteredProjects(): Project[] {
    const q = this.searchQuery.toLowerCase().trim();
    const projects = this.projectStore.activeTab === "shared"
      ? this.projectStore.sharedProjects
      : this.projectStore.projects;
    if (!q) return projects;
    return projects.filter((p) =>
      p.name.toLowerCase().includes(q),
    );
  }

  get activeWorkspaceName(): string {
    if (this.orgService.isPersonalWorkspace) return "Personal";
    const org = this.orgService.activeOrg;
    return org?.name ?? "Organization";
  }

  get isSharedTab(): boolean {
    return this.projectStore.activeTab === "shared";
  }

  get isMyTab(): boolean {
    return this.projectStore.activeTab === "my";
  }

  formatDate = (dateStr: string): string => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} min ago`;
    if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  onSearchInput = (e: Event) => {
    this.searchQuery = (e.target as HTMLInputElement).value;
  };

  createNewProject = async () => {
    const project = await this.projectStore.createProject();
    this.router.transitionTo('editor', project.id);
  };

  scrollToFeatures = () => {
    document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
  };

  openProject = (id: string) => {
    this.router.transitionTo('editor', id);
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
      "pricing": "Pricing Page",
      "signup": "Signup Form",
      "ecommerce": "Product Page",
      "blog": "Blog Layout",
    };
    const project = await this.projectStore.createProject(names[type] || "New Project");
    try {
      localStorage.setItem(`atelier-template-${project.id}`, type);
    } catch {
      // ignore
    }
    this.router.transitionTo('editor', project.id);
  };

  // Workspace switcher
  toggleWorkspaceSwitcher = () => {
    this.showWorkspaceSwitcher = !this.showWorkspaceSwitcher;
  };

  closeWorkspaceSwitcher = () => {
    this.showWorkspaceSwitcher = false;
  };

  switchToPersonal = async () => {
    this.orgService.switchWorkspace("personal");
    this.showWorkspaceSwitcher = false;
    this.projectStore.activeTab = "my";
    await this.projectStore.loadProjects();
  };

  switchToOrg = async (orgId: string) => {
    this.orgService.switchWorkspace("org", orgId);
    this.showWorkspaceSwitcher = false;
    this.projectStore.activeTab = "my";
    await this.projectStore.loadProjects();
  };

  openOrgSettings = (orgId: string, e: MouseEvent) => {
    e.stopPropagation();
    this.showWorkspaceSwitcher = false;
    this.router.transitionTo('org-settings', orgId);
  };

  goToOrgSettings = () => {
    const orgId = this.orgService.activeOrgId;
    if (orgId) {
      this.router.transitionTo('org-settings', orgId);
    }
  };

  // Create org modal
  openCreateOrg = () => {
    this.showWorkspaceSwitcher = false;
    this.showCreateOrgModal = true;
    this.newOrgName = "";
  };

  closeCreateOrg = () => {
    this.showCreateOrgModal = false;
  };

  onNewOrgNameInput = (e: Event) => {
    this.newOrgName = (e.target as HTMLInputElement).value;
  };

  createOrg = async (e: Event) => {
    e.preventDefault();
    if (!this.newOrgName.trim()) return;
    const orgId = await this.orgService.createOrganization(this.newOrgName.trim());
    this.showCreateOrgModal = false;
    if (orgId) {
      this.orgService.switchWorkspace("org", orgId);
      await this.projectStore.loadProjects();
    }
  };

  // Tabs
  switchToMyProjects = async () => {
    this.projectStore.activeTab = "my";
  };

  switchToShared = async () => {
    this.projectStore.activeTab = "shared";
    await this.projectStore.loadSharedProjects();
  };

  // Auth actions
  signInWithGoogle = async () => {
    await this.authService.signInWithGoogle();
    if (this.authService.isAuthenticated) {
      await this.orgService.loadOrganizations();
      await this.orgService.checkPendingInvites();
      await this.projectStore.loadProjects();
      await this.projectStore.loadSharedProjects();
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
      await this.orgService.loadOrganizations();
      await this.orgService.checkPendingInvites();
      await this.projectStore.loadProjects();
      await this.projectStore.loadSharedProjects();
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
    this.orgService.organizations = [];
    this.orgService.switchWorkspace("personal");
    await this.projectStore.loadProjects();
  };

  toggleUserMenu = () => {
    this.showUserMenu = !this.showUserMenu;
  };

  closeUserMenu = () => {
    this.showUserMenu = false;
  };

  stopPropagation = (e: MouseEvent) => {
    e.stopPropagation();
  };

  getOrgInitial = (name: string): string => {
    return name?.[0]?.toUpperCase() ?? "?";
  };

  <template>
    <div class="projects-home">
      {{! Navigation }}
      <nav class="ph-nav">
        <div class="ph-nav-left">
          <div class="ph-nav-logo">
            <div class="ph-nav-logo-icon">
              <IconSparkles />
            </div>
            <span>Atelier</span>
          </div>

          {{#if this.authService.isAuthenticated}}
            <div class="ws-switcher-wrapper">
              <button class="ws-switcher-btn" type="button" {{on "click" this.toggleWorkspaceSwitcher}}>
                {{#if this.orgService.isPersonalWorkspace}}
                  <span class="ws-switcher-icon ws-personal-icon"><IconUser /></span>
                {{else}}
                  <span class="ws-switcher-icon ws-org-icon">{{this.getOrgInitial this.activeWorkspaceName}}</span>
                {{/if}}
                <span class="ws-switcher-name">{{this.activeWorkspaceName}}</span>
                <span class="ws-switcher-chevron"><IconChevronDown /></span>
              </button>

              {{#if this.showWorkspaceSwitcher}}
                <div class="ws-dropdown">
                  <div class="ws-dropdown-label">Workspaces</div>
                  <button
                    class="ws-dropdown-item {{if this.orgService.isPersonalWorkspace 'active'}}"
                    type="button"
                    {{on "click" this.switchToPersonal}}
                  >
                    <span class="ws-item-icon ws-personal-icon"><IconUser /></span>
                    <span class="ws-item-name">Personal</span>
                    {{#if this.orgService.isPersonalWorkspace}}
                      <span class="ws-active-dot"></span>
                    {{/if}}
                  </button>

                  {{#each this.orgService.organizations as |org|}}
                    <button
                      class="ws-dropdown-item {{if (this.isActiveOrg org.id) 'active'}}"
                      type="button"
                      {{on "click" (fn this.switchToOrg org.id)}}
                    >
                      <span class="ws-item-icon ws-org-icon">{{this.getOrgInitial org.name}}</span>
                      <span class="ws-item-name">{{org.name}}</span>
                      {{#if (this.isActiveOrg org.id)}}
                        <span class="ws-active-dot"></span>
                      {{/if}}
                      <button
                        class="ws-item-settings"
                        type="button"
                        title="Organization settings"
                        {{on "click" (fn this.openOrgSettings org.id)}}
                      >
                        <IconSettings />
                      </button>
                    </button>
                  {{/each}}

                  <div class="ws-dropdown-divider"></div>
                  <button class="ws-dropdown-item ws-create-item" type="button" {{on "click" this.openCreateOrg}}>
                    <span class="ws-item-icon ws-create-icon"><IconPlus /></span>
                    <span class="ws-item-name">Create Organization</span>
                  </button>
                </div>
                <div
                  class="ws-backdrop"
                  role="button"
                  {{on "click" this.closeWorkspaceSwitcher}}
                ></div>
              {{/if}}
            </div>
          {{/if}}
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
      {{#if this.authService.isAuthenticated}}
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
      {{else}}
        {{! Marketing Landing Page }}
        <div class="mk-hero">
          <div class="mk-hero-badge">AI-native design tool</div>
          <h1 class="mk-hero-title">
            Design at the speed<br/>of <span class="mk-hero-accent">thought</span>
          </h1>
          <p class="mk-hero-subtitle">
            Voice-powered AI design that exports production-ready Ember, React, and SwiftUI components with real Tailwind classes. Not mockups — real code.
          </p>
          <div class="mk-hero-ctas">
            <button class="mk-cta-primary" type="button" {{on "click" this.createNewProject}}>
              Start designing — it's free
            </button>
            <button class="mk-cta-secondary" type="button" {{on "click" this.scrollToFeatures}}>
              See how it works
            </button>
          </div>
          <div class="mk-hero-stats">
            <div class="mk-stat">
              <span class="mk-stat-number">5</span>
              <span class="mk-stat-label">Export formats</span>
            </div>
            <div class="mk-stat-divider"></div>
            <div class="mk-stat">
              <span class="mk-stat-number">7</span>
              <span class="mk-stat-label">Starter templates</span>
            </div>
            <div class="mk-stat-divider"></div>
            <div class="mk-stat">
              <span class="mk-stat-number">AI</span>
              <span class="mk-stat-label">Voice + text</span>
            </div>
          </div>
        </div>

        {{! Features Section }}
        <div class="mk-features" id="features">
          <h2 class="mk-section-title">Everything Figma does.<br/>Plus everything it doesn't.</h2>
          <div class="mk-features-grid">
            <div class="mk-feature-card mk-feature-highlight">
              <div class="mk-feature-icon">AI</div>
              <h3 class="mk-feature-title">AI Design Generation</h3>
              <p class="mk-feature-desc">Describe any UI in text or voice. Claude generates a complete, editable design with proper hierarchy and spacing.</p>
            </div>
            <div class="mk-feature-card">
              <div class="mk-feature-icon">{'<>'}</div>
              <h3 class="mk-feature-title">Real Code Export</h3>
              <p class="mk-feature-desc">Export to Ember, React, and SwiftUI with smart layout detection. Flex, grid, and semantic HTML — not absolute positioning.</p>
            </div>
            <div class="mk-feature-card">
              <div class="mk-feature-icon">TW</div>
              <h3 class="mk-feature-title">Tailwind Native</h3>
              <p class="mk-feature-desc">Import your tailwind.config.js. Every color, spacing value, and font maps to your actual design tokens.</p>
            </div>
            <div class="mk-feature-card">
              <div class="mk-feature-icon">MIC</div>
              <h3 class="mk-feature-title">Voice Builder</h3>
              <p class="mk-feature-desc">"Add a navbar with 3 links and a signup button." Speak your design into existence with browser-native voice input.</p>
            </div>
            <div class="mk-feature-card">
              <div class="mk-feature-icon">SW</div>
              <h3 class="mk-feature-title">SwiftUI Export</h3>
              <p class="mk-feature-desc">Design once, ship to iOS. Generates HStack, VStack, LazyVGrid with proper modifiers and #Preview blocks.</p>
            </div>
            <div class="mk-feature-card">
              <div class="mk-feature-icon">LIVE</div>
              <h3 class="mk-feature-title">Live Preview</h3>
              <p class="mk-feature-desc">See your exported component rendered in a real iframe with Tailwind CDN. What you see is what you ship.</p>
            </div>
          </div>
        </div>

        {{! Pricing Section }}
        <div class="mk-pricing">
          <h2 class="mk-section-title">Simple, transparent pricing</h2>
          <p class="mk-section-subtitle">Start free. Upgrade when you need more power.</p>
          <div class="mk-pricing-grid">
            <div class="mk-price-card">
              <div class="mk-price-tier">Free</div>
              <div class="mk-price-amount"><span class="mk-price-dollar">$0</span><span class="mk-price-period">/mo</span></div>
              <ul class="mk-price-features">
                <li>3 projects</li>
                <li>SVG + Ember export</li>
                <li>Template generation</li>
                <li>Community support</li>
              </ul>
              <button class="mk-price-cta" type="button" {{on "click" this.createNewProject}}>Get started</button>
            </div>
            <div class="mk-price-card mk-price-featured">
              <div class="mk-price-badge">Most Popular</div>
              <div class="mk-price-tier">Pro</div>
              <div class="mk-price-amount"><span class="mk-price-dollar">$12</span><span class="mk-price-period">/mo</span></div>
              <ul class="mk-price-features">
                <li>Unlimited projects</li>
                <li>All 5 export formats</li>
                <li>Claude AI generation</li>
                <li>Custom Tailwind tokens</li>
                <li>Priority support</li>
              </ul>
              <button class="mk-price-cta mk-price-cta-primary" type="button" {{on "click" this.signInWithGoogle}}>Start free trial</button>
            </div>
            <div class="mk-price-card">
              <div class="mk-price-tier">Team</div>
              <div class="mk-price-amount"><span class="mk-price-dollar">$29</span><span class="mk-price-period">/user/mo</span></div>
              <ul class="mk-price-features">
                <li>Everything in Pro</li>
                <li>Team collaboration</li>
                <li>Shared design systems</li>
                <li>Version history</li>
                <li>SSO + admin controls</li>
              </ul>
              <button class="mk-price-cta" type="button" {{on "click" this.signInWithGoogle}}>Contact sales</button>
            </div>
          </div>
        </div>
      {{/if}}

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

        {{! Loading state — skeleton cards }}
        {{#if this.projectStore.isInitialLoading}}
          <div class="ph-skeleton-grid">
            <div class="ph-skeleton-card">
              <div class="ph-skeleton-preview"><div class="ph-skeleton-shimmer"></div></div>
              <div class="ph-skeleton-info">
                <div class="ph-skeleton-line ph-skeleton-title"></div>
                <div class="ph-skeleton-line ph-skeleton-meta"></div>
              </div>
            </div>
            <div class="ph-skeleton-card" style="animation-delay: 0.1s">
              <div class="ph-skeleton-preview"><div class="ph-skeleton-shimmer"></div></div>
              <div class="ph-skeleton-info">
                <div class="ph-skeleton-line ph-skeleton-title"></div>
                <div class="ph-skeleton-line ph-skeleton-meta"></div>
              </div>
            </div>
            <div class="ph-skeleton-card" style="animation-delay: 0.2s">
              <div class="ph-skeleton-preview"><div class="ph-skeleton-shimmer"></div></div>
              <div class="ph-skeleton-info">
                <div class="ph-skeleton-line ph-skeleton-title"></div>
                <div class="ph-skeleton-line ph-skeleton-meta"></div>
              </div>
            </div>
            <div class="ph-skeleton-card" style="animation-delay: 0.3s">
              <div class="ph-skeleton-preview"><div class="ph-skeleton-shimmer"></div></div>
              <div class="ph-skeleton-info">
                <div class="ph-skeleton-line ph-skeleton-title"></div>
                <div class="ph-skeleton-line ph-skeleton-meta"></div>
              </div>
            </div>
          </div>
        {{else if this.projectStore.isSyncing}}
          <div class="ph-syncing-indicator">
            <div class="ph-syncing-dot"></div>
            <span>Syncing...</span>
          </div>
        {{/if}}

        {{! Projects Tab Bar }}
        {{#if this.authService.isAuthenticated}}
          <div class="ph-tabs">
            <button
              class="ph-tab {{if this.isMyTab 'active'}}"
              type="button"
              {{on "click" this.switchToMyProjects}}
            >
              My Projects
            </button>
            <button
              class="ph-tab {{if this.isSharedTab 'active'}}"
              type="button"
              {{on "click" this.switchToShared}}
            >
              <IconShare />
              Shared with me
              {{#if this.projectStore.sharedProjects.length}}
                <span class="ph-tab-badge">{{this.projectStore.sharedProjects.length}}</span>
              {{/if}}
            </button>
          </div>
        {{/if}}

        {{! My Projects }}
        <div class="ph-section">
          {{#unless this.isSharedTab}}
            <div class="ph-section-header">
              <h2 class="ph-section-title">
                {{#if this.orgService.isPersonalWorkspace}}
                  My Projects
                {{else}}
                  {{this.activeWorkspaceName}} Projects
                {{/if}}
              </h2>
              {{#unless this.orgService.isPersonalWorkspace}}
                <button
                  class="ph-org-settings-btn"
                  type="button"
                  {{on "click" this.goToOrgSettings}}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  Manage Team
                </button>
              {{/unless}}
              <span class="ph-section-count">{{this.filteredProjects.length}} projects</span>
            </div>
          {{/unless}}

          {{#if this.isSharedTab}}
            <div class="ph-section-header">
              <h2 class="ph-section-title">Shared with me</h2>
              <span class="ph-section-count">{{this.filteredProjects.length}} projects</span>
            </div>
          {{/if}}

          <div class="ph-projects-grid">
            {{#unless this.isSharedTab}}
              {{! New Project Card }}
              <button class="ph-card ph-card-new" type="button" {{on "click" this.createNewProject}}>
                <div class="ph-card-new-icon">
                  <IconPlus />
                </div>
                <span class="ph-card-new-label">New Project</span>
              </button>
            {{/unless}}

            {{#each this.filteredProjects as |project|}}
              <div
                class="ph-card"
                role="button"
                {{on "click" (fn this.openProject project.id)}}
              >
                <div class="ph-card-preview">
                  {{#if project.elementCount}}
                    <div class="ph-card-preview-inner ph-card-has-content">
                      <div class="ph-card-preview-mock-1"></div>
                      <div class="ph-card-preview-mock-2"></div>
                      <div class="ph-card-preview-mock-3"></div>
                    </div>
                    <div class="ph-card-element-badge">{{project.elementCount}}</div>
                  {{else}}
                    <div class="ph-card-preview-inner ph-card-empty-content">
                      <div class="ph-card-empty-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                      </div>
                    </div>
                  {{/if}}
                </div>
                <div class="ph-card-info">
                  <div class="ph-card-name">{{project.name}}</div>
                  <div class="ph-card-meta">
                    <span>{{this.formatDate project.updatedAt}}</span>
                    <span class="ph-card-dot"></span>
                    <span>{{project.elementCount}} elements</span>
                  </div>
                  {{#if this.isSharedTab}}
                    <div class="ph-card-shared-by">
                      Shared project
                    </div>
                  {{/if}}
                </div>
                {{#unless this.isSharedTab}}
                  <button
                    class="ph-card-delete"
                    type="button"
                    title="Delete project"
                    {{on "click" (fn this.deleteProject project.id)}}
                  >
                    <IconTrash />
                  </button>
                {{/unless}}
              </div>
            {{/each}}
          </div>

          {{#if this.isSharedTab}}
            {{#unless this.filteredProjects.length}}
              <div class="ph-empty-shared">
                <IconShare />
                <p>No shared projects yet</p>
                <span>When someone shares a project with you, it will appear here.</span>
              </div>
            {{/unless}}
          {{/if}}
        </div>

        {{! Examples Section }}
        {{#unless this.isSharedTab}}
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

              <button class="ph-example-card" type="button" {{on "click" (fn this.createFromExample "pricing")}}>
                <div class="ph-example-preview ph-example-pricing">
                  <div class="ph-ex-pricing-title"></div>
                  <div class="ph-ex-pricing-cards">
                    <div class="ph-ex-pricing-card"></div>
                    <div class="ph-ex-pricing-card ph-ex-pricing-featured"></div>
                    <div class="ph-ex-pricing-card"></div>
                  </div>
                </div>
                <div class="ph-example-info">
                  <div class="ph-example-icon"><IconFrame /></div>
                  <div>
                    <div class="ph-example-name">Pricing Page</div>
                    <div class="ph-example-desc">Free, Pro, Team tier comparison</div>
                  </div>
                </div>
              </button>

              <button class="ph-example-card" type="button" {{on "click" (fn this.createFromExample "signup")}}>
                <div class="ph-example-preview ph-example-signup">
                  <div class="ph-ex-signup-left"></div>
                  <div class="ph-ex-signup-right">
                    <div class="ph-ex-signup-field"></div>
                    <div class="ph-ex-signup-field"></div>
                    <div class="ph-ex-signup-field"></div>
                    <div class="ph-ex-signup-btn"></div>
                  </div>
                </div>
                <div class="ph-example-info">
                  <div class="ph-example-icon"><IconRect /></div>
                  <div>
                    <div class="ph-example-name">Signup Form</div>
                    <div class="ph-example-desc">Auth page with branding + form fields</div>
                  </div>
                </div>
              </button>

              <button class="ph-example-card" type="button" {{on "click" (fn this.createFromExample "ecommerce")}}>
                <div class="ph-example-preview ph-example-ecommerce">
                  <div class="ph-ex-product-img"></div>
                  <div class="ph-ex-product-details">
                    <div class="ph-ex-product-title"></div>
                    <div class="ph-ex-product-price"></div>
                    <div class="ph-ex-product-cta"></div>
                  </div>
                </div>
                <div class="ph-example-info">
                  <div class="ph-example-icon"><IconShare /></div>
                  <div>
                    <div class="ph-example-name">Product Page</div>
                    <div class="ph-example-desc">E-commerce product with gallery, CTA</div>
                  </div>
                </div>
              </button>

              <button class="ph-example-card" type="button" {{on "click" (fn this.createFromExample "blog")}}>
                <div class="ph-example-preview ph-example-blog">
                  <div class="ph-ex-blog-featured"></div>
                  <div class="ph-ex-blog-grid">
                    <div class="ph-ex-blog-card"></div>
                    <div class="ph-ex-blog-card"></div>
                    <div class="ph-ex-blog-card"></div>
                  </div>
                </div>
                <div class="ph-example-info">
                  <div class="ph-example-icon"><IconGrid /></div>
                  <div>
                    <div class="ph-example-name">Blog Layout</div>
                    <div class="ph-example-desc">Featured article + article grid</div>
                  </div>
                </div>
              </button>
            </div>
          </div>
        {{/unless}}
      </div>

      {{! Create Organization Modal }}
      {{#if this.showCreateOrgModal}}
        <div class="modal-overlay" role="button" {{on "click" this.closeCreateOrg}}>
          <div class="create-org-modal" role="dialog" {{on "click" this.stopPropagation}}>
            <div class="create-org-header">
              <h2 class="create-org-title">Create Organization</h2>
              <p class="create-org-subtitle">Create a shared workspace for your team</p>
            </div>
            <form class="create-org-body" {{on "submit" this.createOrg}}>
              <input
                class="create-org-input"
                type="text"
                placeholder="Organization name"
                value={{this.newOrgName}}
                {{on "input" this.onNewOrgNameInput}}
              />
              <div class="create-org-actions">
                <button class="create-org-cancel" type="button" {{on "click" this.closeCreateOrg}}>Cancel</button>
                <button class="create-org-submit" type="submit" disabled={{this.isOrgNameEmpty}}>
                  Create Organization
                </button>
              </div>
            </form>
          </div>
        </div>
      {{/if}}
    </div>
  </template>

  isSignIn = (mode: string): boolean => mode === "signin";

  isActiveOrg = (orgId: string): boolean => {
    return this.orgService.activeOrgId === orgId;
  };

  get isOrgNameEmpty(): boolean {
    return !this.newOrgName.trim();
  }
}
