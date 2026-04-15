import Route from "@ember/routing/route";
import { inject as service } from "@ember/service";
import type RouterService from "@ember/routing/router-service";
import type WorkspaceStoreService from "harbor-chat/services/workspace-store";
import type MessageStoreService from "harbor-chat/services/message-store";
import type NotificationService from "harbor-chat/services/notification-service";
import type { WorkspaceModel } from "harbor-chat/routes/workspace";
import type { Channel, Message, User } from "harbor-chat/harbor-chat/types";

export interface ChannelModel {
  workspace: WorkspaceModel;
  channel: Channel;
  messages: Message[];
  members: User[];
}

/**
 * Channel route loads channel-specific data and subscribes
 * to real-time message updates via onSnapshot.
 */
export default class ChannelRoute extends Route {
  @service declare router: RouterService;
  @service declare workspaceStore: WorkspaceStoreService;
  @service declare messageStore: MessageStoreService;
  @service declare notificationService: NotificationService;

  model(params: { channel_id: string }): ChannelModel {
    const workspaceModel = this.modelFor("workspace") as WorkspaceModel;
    const channel = this.workspaceStore.getChannelById(params.channel_id);

    // Stale channel ID — redirect to first channel
    if (!channel) {
      const firstCh = workspaceModel.channels[0];
      if (firstCh) {
        this.router.transitionTo(
          "workspace.channel",
          workspaceModel.workspace.id,
          firstCh.id,
        );
      }
      return {
        workspace: workspaceModel,
        channel: {} as Channel,
        messages: [],
        members: [],
      };
    }

    this.messageStore.markRead(channel.id);
    this.messageStore.subscribeChannel(channel.id);

    // Set page title to channel name
    const displayName =
      channel.kind === "dm" || channel.kind === "group"
        ? this.workspaceStore.getDmDisplayName(channel)
        : channel.name;
    this.notificationService.setChannelTitle(displayName);

    // Request notification permission on first channel visit
    if (this.notificationService.permission === "default") {
      this.notificationService.requestPermission();
    }

    return {
      workspace: workspaceModel,
      channel,
      messages: this.messageStore.messagesForChannel(channel.id),
      members: workspaceModel.members,
    };
  }

  deactivate(): void {
    this.messageStore.closeThread();
  }
}
