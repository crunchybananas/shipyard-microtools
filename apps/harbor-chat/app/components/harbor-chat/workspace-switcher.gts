import Component from "@glimmer/component";
import { inject as service } from "@ember/service";
import { fn } from "@ember/helper";
import { on } from "@ember/modifier";
import type RouterService from "@ember/routing/router-service";
import type WorkspaceStoreService from "harbor-chat/services/workspace-store";
import type PresenceService from "harbor-chat/services/presence-service";

interface WorkspaceSwitcherSignature {
  Args: {
    activeWorkspaceId: string;
  };
}

export default class WorkspaceSwitcher extends Component<WorkspaceSwitcherSignature> {
  @service declare router: RouterService;
  @service declare workspaceStore: WorkspaceStoreService;
  @service declare presenceService: PresenceService;

  get currentUserInitial(): string {
    const name = this.workspaceStore.currentUser?.displayName ?? "?";
    return name.charAt(0).toUpperCase();
  }

  get currentUserStatus(): string {
    return this.workspaceStore.currentUser?.status ?? "offline";
  }

  isActive = (wsId: string): boolean => {
    return wsId === this.args.activeWorkspaceId;
  };

  selectWorkspace = (workspaceId: string) => {
    this.router.transitionTo("workspace", workspaceId);
  };

  openProfile = () => {
    this.presenceService.viewUserProfile(this.workspaceStore.currentUserId);
  };

  <template>
    <aside class="workspace-switcher">
      {{#each this.workspaceStore.workspaces as |ws|}}
        <button
          class="ws-icon {{if (this.isActive ws.id) 'active'}}"
          title={{ws.name}}
          {{on "click" (fn this.selectWorkspace ws.id)}}
        >
          <span class="ws-icon-text">{{ws.icon}}</span>
        </button>
      {{/each}}
      <button class="ws-icon ws-add" title="Create workspace">
        <span class="ws-icon-text">+</span>
      </button>
      <div class="ws-spacer"></div>
      <button
        class="ws-icon ws-user"
        title="Profile & Status"
        {{on "click" this.openProfile}}
      >
        <span class="ws-icon-text">{{this.currentUserInitial}}</span>
        <span class="presence-dot status-{{this.currentUserStatus}}"></span>
      </button>
    </aside>
  </template>
}
