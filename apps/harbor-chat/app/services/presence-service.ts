import Service from "@ember/service";
import { inject as service } from "@ember/service";
import { tracked } from "@glimmer/tracking";
import type WorkspaceStoreService from "./workspace-store";

/**
 * Manages user presence and UI panel state.
 * In production, presence will sync via Firebase Realtime Database
 * (not Firestore — RTDB is better suited for ephemeral presence data).
 */
export default class PresenceService extends Service {
  @service declare workspaceStore: WorkspaceStoreService;

  @tracked showMemberList = false;
  @tracked showUserProfile: string | null = null;

  toggleMemberList = () => {
    this.showMemberList = !this.showMemberList;
  };

  viewUserProfile = (userId: string | null) => {
    this.showUserProfile = userId;
  };
}
