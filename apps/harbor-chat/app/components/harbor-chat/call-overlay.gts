import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { inject as service } from "@ember/service";
import { on } from "@ember/modifier";
import type CallService from "harbor-chat/services/call-service";
import type WorkspaceStoreService from "harbor-chat/services/workspace-store";

export default class CallOverlay extends Component {
  @service declare callService: CallService;
  @service declare workspaceStore: WorkspaceStoreService;

  @tracked muted = false;
  @tracked videoOff = false;
  @tracked screenSharing = false;

  get call() {
    return this.callService.activeCall;
  }

  get isVideo(): boolean {
    return this.call?.kind === "video";
  }

  get channelName(): string {
    if (!this.call) return "";
    const ch = this.workspaceStore.getChannelById(this.call.channelId);
    if (!ch) return "";
    if (ch.kind === "dm" || ch.kind === "group") {
      return this.workspaceStore.getDmDisplayName(ch);
    }
    return `#${ch.name}`;
  }

  get channel() {
    if (!this.call) return null;
    return this.workspaceStore.getChannelById(this.call.channelId);
  }

  get callDuration(): string {
    if (!this.call) return "0:00";
    const elapsed = Math.floor((Date.now() - this.call.startedAt) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  get participantIds(): string[] {
    return this.channel?.memberIds ?? [];
  }

  initial = (userId: string): string => {
    const name = this.workspaceStore.getUserById(userId)?.displayName ?? "?";
    return name.charAt(0).toUpperCase();
  };

  memberName = (userId: string): string => {
    return this.workspaceStore.getUserById(userId)?.displayName ?? "Unknown";
  };

  toggleMute = () => {
    this.muted = !this.muted;
  };

  toggleVideo = () => {
    this.videoOff = !this.videoOff;
  };

  toggleScreen = () => {
    this.screenSharing = !this.screenSharing;
  };

  <template>
    {{#if this.call}}
      <div class="call-overlay">
        <div class="call-container">
          <div class="call-header">
            <span class="call-channel">{{this.channelName}}</span>
            <span class="call-timer">{{this.callDuration}}</span>
            {{#if this.channel.isPrivate}}
              <span class="encryption-badge">🔐 E2EE</span>
            {{/if}}
          </div>

          <div class="call-grid">
            {{#each this.participantIds as |memberId|}}
              <div class="call-participant">
                <div class="call-avatar">
                  {{this.initial memberId}}
                </div>
                <span class="call-name">{{this.memberName memberId}}</span>
              </div>
            {{/each}}
          </div>

          <div class="call-controls">
            <button
              class="call-btn {{if this.muted 'active'}}"
              title="{{if this.muted 'Unmute' 'Mute'}}"
              {{on "click" this.toggleMute}}
            >
              {{if this.muted "🔇" "🎙️"}}
            </button>
            {{#if this.isVideo}}
              <button
                class="call-btn {{if this.videoOff 'active'}}"
                title="{{if this.videoOff 'Turn on camera' 'Turn off camera'}}"
                {{on "click" this.toggleVideo}}
              >
                {{if this.videoOff "🚫" "🎥"}}
              </button>
            {{/if}}
            <button
              class="call-btn {{if this.screenSharing 'active'}}"
              title="{{if this.screenSharing 'Stop sharing' 'Share screen'}}"
              {{on "click" this.toggleScreen}}
            >
              💻
            </button>
            <button
              class="call-btn call-end"
              title="End call"
              {{on "click" this.callService.endCall}}
            >
              End
            </button>
          </div>
        </div>
      </div>
    {{/if}}
  </template>
}
