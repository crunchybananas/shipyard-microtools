import Service from "@ember/service";
import { tracked } from "@glimmer/tracking";
import type { CallSession } from "harbor-chat/harbor-chat/types";
import { inject as service } from "@ember/service";
import type WorkspaceStoreService from "./workspace-store";
import { generateId } from "harbor-chat/harbor-chat/mock-data";

/**
 * Manages WebRTC call state.
 * In production, signaling will go through Firebase RTDB,
 * with TURN/STUN server config for NAT traversal.
 */
export default class CallService extends Service {
  @service declare workspaceStore: WorkspaceStoreService;

  @tracked activeCall: CallSession | null = null;

  startCall = (channelId: string, kind: "audio" | "video") => {
    this.activeCall = {
      id: `call-${generateId()}`,
      channelId,
      initiatorId: this.workspaceStore.currentUserId,
      participantIds: [this.workspaceStore.currentUserId],
      kind,
      startedAt: Date.now(),
      active: true,
    };
  };

  endCall = () => {
    this.activeCall = null;
  };
}
