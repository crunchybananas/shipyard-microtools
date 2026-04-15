import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { inject as service } from "@ember/service";
import { fn } from "@ember/helper";
import { on } from "@ember/modifier";
import type RouterService from "@ember/routing/router-service";
import type WorkspaceStoreService from "harbor-chat/services/workspace-store";
import type MessageStoreService from "harbor-chat/services/message-store";
import type { Workspace, Channel } from "harbor-chat/harbor-chat/types";
import InvitePanel from "./invite-panel";
import CreateChannelModal from "./create-channel-modal";
import StartDmModal from "./start-dm-modal";
import WorkspaceSettings from "./workspace-settings";

interface SidebarSignature {
  Args: {
    workspace: Workspace;
    channels: Channel[];
    dms: Channel[];
  };
}

export default class Sidebar extends Component<SidebarSignature> {
  @service declare router: RouterService;
  @service declare workspaceStore: WorkspaceStoreService;
  @service declare messageStore: MessageStoreService;

  @tracked channelsCollapsed = false;
  @tracked dmsCollapsed = false;
  @tracked showCreateChannel = false;
  @tracked showStartDm = false;
  @tracked showWorkspaceSettings = false;

  get activeChannelId(): string | null {
    // Read from the URL via the router
    const params = this.router.currentRoute?.params as
      | { channel_id?: string }
      | undefined;
    return params?.channel_id ?? null;
  }

  toggleChannels = () => {
    this.channelsCollapsed = !this.channelsCollapsed;
  };

  toggleDMs = () => {
    this.dmsCollapsed = !this.dmsCollapsed;
  };

  openCreateChannel = () => {
    this.showCreateChannel = true;
  };

  closeCreateChannel = () => {
    this.showCreateChannel = false;
  };

  openStartDm = () => {
    this.showStartDm = true;
  };

  closeStartDm = () => {
    this.showStartDm = false;
  };

  openWorkspaceSettings = () => {
    this.showWorkspaceSettings = true;
  };

  closeWorkspaceSettings = () => {
    this.showWorkspaceSettings = false;
  };

  selectChannel = (channelId: string) => {
    this.router.transitionTo(
      "workspace.channel",
      this.args.workspace.id,
      channelId,
    );
  };

  isActive = (channelId: string): boolean => {
    return channelId === this.activeChannelId;
  };

  unreadCount = (channelId: string): number => {
    return this.messageStore.unreadCount(channelId);
  };

  dmName = (channel: Channel): string => {
    return this.workspaceStore.getDmDisplayName(channel);
  };

  dmPresence = (channel: Channel): string => {
    const otherId = channel.memberIds.find(
      (id) => id !== this.workspaceStore.currentUserId,
    );
    if (!otherId) return "offline";
    return this.workspaceStore.getUserById(otherId)?.status ?? "offline";
  };

  <template>
    <nav class="sidebar">
      <div class="sidebar-header">
        <button class="workspace-name-btn" {{on "click" this.openWorkspaceSettings}}>
          <h2 class="workspace-name">{{@workspace.name}}</h2>
          <span class="workspace-chevron">&#9662;</span>
        </button>
      </div>

      <div class="sidebar-sections">
        <div class="sidebar-section">
          <div class="section-header-row">
            <button class="section-header" {{on "click" this.toggleChannels}}>
              <span class="section-caret {{if this.channelsCollapsed 'collapsed'}}">&#9662;</span>
              <span>Channels</span>
            </button>
            <button class="section-add-btn" title="Create channel" {{on "click" this.openCreateChannel}}>+</button>
          </div>
          {{#unless this.channelsCollapsed}}
            <ul class="channel-list">
              {{#each @channels as |channel|}}
                <li>
                  <button
                    class="channel-item {{if (this.isActive channel.id) 'active'}} {{if (this.unreadCount channel.id) 'unread'}}"
                    {{on "click" (fn this.selectChannel channel.id)}}
                  >
                    <span class="channel-icon">{{if channel.isPrivate "🔒" "#"}}</span>
                    <span class="channel-name">{{channel.name}}</span>
                    {{#if (this.unreadCount channel.id)}}
                      <span class="unread-badge">{{this.unreadCount channel.id}}</span>
                    {{/if}}
                  </button>
                </li>
              {{/each}}
            </ul>
          {{/unless}}
        </div>

        <div class="sidebar-section">
          <div class="section-header-row">
            <button class="section-header" {{on "click" this.toggleDMs}}>
              <span class="section-caret {{if this.dmsCollapsed 'collapsed'}}">&#9662;</span>
              <span>Direct Messages</span>
            </button>
            <button class="section-add-btn" title="Start a DM" {{on "click" this.openStartDm}}>+</button>
          </div>
          {{#unless this.dmsCollapsed}}
            <ul class="channel-list">
              {{#each @dms as |channel|}}
                <li>
                  <button
                    class="channel-item {{if (this.isActive channel.id) 'active'}} {{if (this.unreadCount channel.id) 'unread'}}"
                    {{on "click" (fn this.selectChannel channel.id)}}
                  >
                    <span class="presence-dot-sm status-{{this.dmPresence channel}}"></span>
                    <span class="channel-name">{{this.dmName channel}}</span>
                    {{#if (this.unreadCount channel.id)}}
                      <span class="unread-badge">{{this.unreadCount channel.id}}</span>
                    {{/if}}
                  </button>
                </li>
              {{/each}}
            </ul>
          {{/unless}}
        </div>

        <InvitePanel
          @workspaceId={{@workspace.id}}
          @workspaceName={{@workspace.name}}
        />
      </div>

      <CreateChannelModal
        @isOpen={{this.showCreateChannel}}
        @onClose={{this.closeCreateChannel}}
        @workspaceId={{@workspace.id}}
      />
      <StartDmModal
        @isOpen={{this.showStartDm}}
        @onClose={{this.closeStartDm}}
        @workspaceId={{@workspace.id}}
        @members={{this.workspaceStore.membersForWorkspace @workspace.id}}
      />
      <WorkspaceSettings
        @isOpen={{this.showWorkspaceSettings}}
        @onClose={{this.closeWorkspaceSettings}}
        @workspaceId={{@workspace.id}}
      />
    </nav>
  </template>
}
