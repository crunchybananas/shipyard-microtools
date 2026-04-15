import Component from "@glimmer/component";
import { inject as service } from "@ember/service";
import { fn } from "@ember/helper";
import { on } from "@ember/modifier";
import type PresenceService from "harbor-chat/services/presence-service";
import type { User } from "harbor-chat/harbor-chat/types";

interface MemberListSignature {
  Args: {
    members: User[];
    workspaceId: string;
  };
}

export default class MemberList extends Component<MemberListSignature> {
  @service declare presenceService: PresenceService;

  get onlineMembers(): User[] {
    return this.args.members.filter(
      (u) => u.status === "online" || u.status === "away" || u.status === "dnd",
    );
  }

  get offlineMembers(): User[] {
    return this.args.members.filter((u) => u.status === "offline");
  }

  viewProfile = (userId: string) => {
    this.presenceService.viewUserProfile(userId);
  };

  initial = (name: string): string => {
    return name.charAt(0).toUpperCase();
  };

  <template>
    {{#if this.presenceService.showMemberList}}
      <aside class="member-list">
        <h4 class="member-section-title">Online — {{this.onlineMembers.length}}</h4>
        {{#each this.onlineMembers as |user|}}
          <button class="member-item" {{on "click" (fn this.viewProfile user.id)}}>
            <div class="member-avatar status-{{user.status}}">
              {{this.initial user.displayName}}
            </div>
            <div class="member-info">
              <span class="member-name">{{user.displayName}}</span>
              {{#if user.statusMessage}}
                <span class="member-status-msg">{{user.statusMessage}}</span>
              {{/if}}
            </div>
          </button>
        {{/each}}

        {{#if this.offlineMembers.length}}
          <h4 class="member-section-title">Offline — {{this.offlineMembers.length}}</h4>
          {{#each this.offlineMembers as |user|}}
            <button class="member-item" {{on "click" (fn this.viewProfile user.id)}}>
              <div class="member-avatar status-offline">
                {{this.initial user.displayName}}
              </div>
              <div class="member-info">
                <span class="member-name offline">{{user.displayName}}</span>
              </div>
            </button>
          {{/each}}
        {{/if}}
      </aside>
    {{/if}}
  </template>
}
