import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { inject as service } from "@ember/service";
import { on } from "@ember/modifier";
import type CallService from "harbor-chat/services/call-service";
import type PresenceService from "harbor-chat/services/presence-service";
import type WorkspaceStoreService from "harbor-chat/services/workspace-store";
import type { Channel } from "harbor-chat/harbor-chat/types";

interface ChannelHeaderSignature {
  Args: {
    channel: Channel;
    memberCount: number;
    onToggleSearch?: () => void;
    isSearchOpen?: boolean;
  };
}

export default class ChannelHeader extends Component<ChannelHeaderSignature> {
  @service declare callService: CallService;
  @service declare presenceService: PresenceService;
  @service declare workspaceStore: WorkspaceStoreService;

  get channelDisplayName(): string {
    const ch = this.args.channel;
    if (ch.kind === "dm" || ch.kind === "group") {
      return this.workspaceStore.getDmDisplayName(ch);
    }
    return ch.name;
  }

  get channelPrefix(): string {
    const ch = this.args.channel;
    if (ch.kind === "dm") return "";
    return ch.isPrivate ? "🔒 " : "# ";
  }

  startAudio = () => {
    this.callService.startCall(this.args.channel.id, "audio");
  };

  startVideo = () => {
    this.callService.startCall(this.args.channel.id, "video");
  };

  toggleSearch = () => {
    this.args.onToggleSearch?.();
  };

  <template>
    <header class="channel-header">
      <div class="channel-header-info">
        <h3 class="channel-header-name">
          {{this.channelPrefix}}{{this.channelDisplayName}}
        </h3>
        {{#if @channel.description}}
          <span class="channel-header-desc">{{@channel.description}}</span>
        {{/if}}
      </div>
      <div class="channel-header-actions">
        {{#if @channel.isPrivate}}
          <span class="encryption-badge" title="End-to-end encrypted">🔐 E2EE</span>
        {{/if}}
        <button
          class="header-btn {{if @isSearchOpen 'active'}}"
          title="Search messages"
          {{on "click" this.toggleSearch}}
        >
          🔍
        </button>
        <button class="header-btn" title="Start audio call" {{on "click" this.startAudio}}>
          🔊
        </button>
        <button class="header-btn" title="Start video call" {{on "click" this.startVideo}}>
          🎥
        </button>
        <button
          class="header-btn {{if this.presenceService.showMemberList 'active'}}"
          title="Toggle member list"
          {{on "click" this.presenceService.toggleMemberList}}
        >
          👥 {{@memberCount}}
        </button>
      </div>
    </header>
  </template>
}
